/*
 * model-adapter.mjs – THE ONE THING YOU WIRE UP. Everything else is deterministic.
 *
 * callModel() returns the model's text output as a string. When a JSON `schema` is
 * supplied, the request uses structured outputs (output_config.format) so the model
 * is *guaranteed* to return schema-valid JSON – no fence-stripping, no parse retries.
 *
 * Tiering keeps cost down: 'strong' for hard edits + security review, 'cheap' for
 * scouting, routing, and log triage.
 *
 * Built-in on the Anthropic path:
 *   - adaptive thinking + effort on the strong tier (Opus 4.8)
 *   - prompt caching (cache_control breakpoints on system + stable user blocks)
 *   - retry with exponential backoff on 429/5xx/529, honoring retry-after
 *   - refusal stop_reason handling
 *   - per-run token + cost accounting (getUsageTotals / resetUsageTotals)
 *
 * Default provider: Anthropic Messages API (raw fetch – this repo's scripts are
 * deliberately zero-dependency; swap in @anthropic-ai/sdk if you ever relax that).
 * Set ANTHROPIC_API_KEY. Override models with AGENT_MODEL_STRONG / AGENT_MODEL_CHEAP.
 * Gemini adapter is implemented (GEMINI_API_KEY + AGENT_PROVIDER=gemini).
 *
 * Requires Node >= 18 (global fetch).
 */

const PROVIDER = process.env.AGENT_PROVIDER || 'anthropic';

const MODELS = {
  anthropic: {
    strong: process.env.AGENT_MODEL_STRONG || 'claude-opus-4-8',
    cheap: process.env.AGENT_MODEL_CHEAP || 'claude-haiku-4-5',
  },
  gemini: {
    strong: process.env.AGENT_MODEL_STRONG || 'gemini-2.5-pro',
    cheap: process.env.AGENT_MODEL_CHEAP || 'gemini-2.5-flash',
  },
};

// $/MTok – used for the per-run cost estimate in reports. Cache reads bill ~0.1x
// input, cache writes ~1.25x.
const PRICES = {
  'claude-opus-4-8': { in: 5, out: 25 },
  'claude-haiku-4-5': { in: 1, out: 5 },
};

// ---- usage accounting ------------------------------------------------------
const totals = { calls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, estimatedCostUSD: 0 };

export function getUsageTotals() {
  return { ...totals, estimatedCostUSD: Math.round(totals.estimatedCostUSD * 10000) / 10000 };
}
export function resetUsageTotals() {
  for (const k of Object.keys(totals)) totals[k] = 0;
}

function recordUsage(model, usage = {}) {
  const p = PRICES[model] || { in: 0, out: 0 };
  const inTok = usage.input_tokens || 0;
  const outTok = usage.output_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;
  const cacheWrite = usage.cache_creation_input_tokens || 0;
  totals.calls += 1;
  totals.inputTokens += inTok;
  totals.outputTokens += outTok;
  totals.cacheReadTokens += cacheRead;
  totals.cacheWriteTokens += cacheWrite;
  totals.estimatedCostUSD +=
    (inTok * p.in + outTok * p.out + cacheRead * p.in * 0.1 + cacheWrite * p.in * 1.25) / 1e6;
}

// ---- retry -----------------------------------------------------------------
const RETRYABLE = new Set([429, 500, 502, 503, 529]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, init, maxRetries = 4) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      if (!RETRYABLE.has(res.status) || attempt === maxRetries) {
        throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 500)}`);
      }
      const retryAfter = Number(res.headers.get('retry-after'));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt);
    } catch (e) {
      if (e.message?.startsWith('API ')) throw e; // non-retryable API error from above
      lastErr = e; // network error – retry
      if (attempt === maxRetries) throw lastErr;
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw lastErr;
}

/**
 * @param {{
 *   tier?: 'cheap'|'strong',
 *   system: string,
 *   user: string | Array<{ text: string, cache?: boolean }>,
 *   schema?: object,          // JSON schema -> structured outputs (guaranteed-valid JSON)
 *   maxTokens?: number,
 * }} opts
 * @returns {Promise<string>} the model's text output
 *
 * `user` may be an array of blocks; blocks with `cache: true` get a cache_control
 * breakpoint so stable context (repo map, conventions) is cached across attempts.
 */
export async function callModel({ tier = 'strong', system, user, schema, maxTokens = 16000 }) {
  if (PROVIDER === 'anthropic') return callAnthropic({ tier, system, user, schema, maxTokens });
  if (PROVIDER === 'gemini') return callGemini({ tier, system, user, schema, maxTokens });
  if (PROVIDER === 'openai') return callOpenAI();
  throw new Error(`Unknown AGENT_PROVIDER "${PROVIDER}" (use anthropic | gemini | openai)`);
}

function userToBlocks(user) {
  if (typeof user === 'string') return [{ type: 'text', text: user }];
  return user.map((b) => ({
    type: 'text',
    text: b.text,
    ...(b.cache ? { cache_control: { type: 'ephemeral' } } : {}),
  }));
}

async function callAnthropic({ tier, system, user, schema, maxTokens }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set (or set AGENT_PROVIDER=gemini with GEMINI_API_KEY)');
  const model = MODELS.anthropic[tier];

  const body = {
    model,
    max_tokens: maxTokens,
    // System prompts are stable per agent – a breakpoint here caches them across
    // attempts (silently a no-op below the model's minimum cacheable prefix).
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userToBlocks(user) }],
  };
  if (tier === 'strong') {
    // Opus 4.8: adaptive thinking (off unless set explicitly) + effort tuned for
    // coding/agentic work. Do NOT add temperature/top_p – they 400 on 4.7+.
    body.thinking = { type: 'adaptive' };
    body.output_config = { effort: 'high' };
  }
  if (schema) {
    body.output_config = { ...(body.output_config || {}), format: { type: 'json_schema', schema } };
  }

  const res = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  recordUsage(model, data.usage);

  if (data.stop_reason === 'refusal') {
    throw new Error(`model refused the request${data.stop_details?.category ? ` (${data.stop_details.category})` : ''}`);
  }
  if (data.stop_reason === 'max_tokens') {
    console.warn(`  [adapter] warning: ${model} hit max_tokens (${maxTokens}) – output may be truncated`);
  }
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

async function callGemini({ tier, system, user, schema, maxTokens }) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const model = MODELS.gemini[tier];
  const text = typeof user === 'string' ? user : user.map((b) => b.text).join('\n\n');

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text }] }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      ...(schema ? { responseMimeType: 'application/json' } : {}),
    },
  };
  const res = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
  );
  const data = await res.json();
  totals.calls += 1; // Gemini usage metadata differs; count the call, skip cost estimate
  return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
}

// --- implement and set AGENT_PROVIDER=openai to switch ---
async function callOpenAI() {
  throw new Error('OpenAI adapter not implemented. Add your call here and return the text.');
}
