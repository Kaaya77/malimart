/*
 * model-adapter.mjs – THE ONE THING YOU WIRE UP. Everything else is deterministic.
 *
 * callModel() returns the model's text output as a string. The builder and reviewers are
 * instructed to return JSON, so callers parse the returned text.
 *
 * Tiering keeps cost down: 'strong' for hard edits + security review, 'cheap' for routing,
 * exploration, and log triage.
 *
 * Default provider: Anthropic Messages API. Set ANTHROPIC_API_KEY in your env.
 *   - Override models with AGENT_MODEL_STRONG / AGENT_MODEL_CHEAP.
 * To use Gemini or OpenAI instead, implement the marked stub and set AGENT_PROVIDER.
 *
 * Requires Node >= 18 (global fetch).
 */

const PROVIDER = process.env.AGENT_PROVIDER || 'anthropic';

const MODELS = {
  anthropic: {
    strong: process.env.AGENT_MODEL_STRONG || 'claude-opus-4-8',
    cheap: process.env.AGENT_MODEL_CHEAP || 'claude-haiku-4-5-20251001',
  },
};

/**
 * @param {{ tier?: 'cheap'|'strong', system: string, user: string, maxTokens?: number }} opts
 * @returns {Promise<string>} the model's text output
 */
export async function callModel({ tier = 'strong', system, user, maxTokens = 4096 }) {
  if (PROVIDER === 'anthropic') return callAnthropic({ tier, system, user, maxTokens });
  if (PROVIDER === 'gemini') return callGemini({ tier, system, user, maxTokens });
  if (PROVIDER === 'openai') return callOpenAI({ tier, system, user, maxTokens });
  throw new Error(`Unknown AGENT_PROVIDER "${PROVIDER}" (use anthropic | gemini | openai)`);
}

async function callAnthropic({ tier, system, user, maxTokens }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set (or implement another provider in model-adapter.mjs)');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODELS.anthropic[tier],
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

// --- implement one of these and set AGENT_PROVIDER to switch ---
async function callGemini() {
  throw new Error('Gemini adapter not implemented. Add your @google/genai call here and return the text.');
}
async function callOpenAI() {
  throw new Error('OpenAI adapter not implemented. Add your call here and return the text.');
}
