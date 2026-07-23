// Vercel edge proxy for the Google Gemini API.
// All requests to /api/gemini/<anything> are rewritten here (see vercel.json),
// with the original path carried in the ?gpath= query param. The real
// GEMINI_API_KEY lives only in server env vars and never reaches the browser.
//
// ABUSE HARDENING — this endpoint spends our API quota, so it is NOT an open
// proxy: requests must look same-origin, may only reach the exact model
// actions the app uses, are size-capped, and are soft rate-limited per IP.

export const config = { runtime: 'edge' };

const UPSTREAM = 'https://generativelanguage.googleapis.com';

// Models the app is allowed to reach through this proxy (prefix match).
// KEEP IN SYNC with services/aiModels.ts (MODELS + IMAGE_MODEL_CHAIN).
// gemini-3-pro-image intentionally NOT here — it's Pro-tier (paid-only
// since 1 Apr 2026), see the note in aiModels.ts.
const ALLOWED_MODEL_PREFIXES = [
  'gemini-2.5-flash',      // TEXT + IMAGE ('gemini-2.5-flash-image')
  'gemini-3.1-flash-image',
  'gemini-3.5-flash',      // planned replacement (aiModels.ts note)
];
const ALLOWED_ACTIONS = ['generateContent', 'streamGenerateContent'];

// v1beta/models/<model>:<action>
const PATH_RE = /^v1(?:beta|alpha)?\/models\/([A-Za-z0-9.-]+):([A-Za-z]+)$/;

const MAX_BODY_BYTES = 8 * 1024 * 1024; // inline vision images fit well under this

// Soft per-IP rate limit. In-memory per edge isolate, so it's a damper rather
// than a guarantee — good enough to stop naive quota-burning loops.
const RL = new Map<string, { n: number; reset: number }>();
function rateLimited(ip: string, max = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = RL.get(ip);
  if (!b || now > b.reset) { RL.set(ip, { n: 1, reset: now + windowMs }); return false; }
  b.n += 1;
  if (RL.size > 10_000) RL.clear(); // crude memory bound
  return b.n > max;
}

function json(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status, headers: { 'content-type': 'application/json' },
  });
}

export default async function handler(req: Request): Promise<Response> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json(503, 'AI service not configured');

  const url = new URL(req.url);

  // Browser fetches from our own pages always carry a matching Origin on POST.
  // (A non-browser client can forge this — the model/action allowlist and rate
  // limit below bound the damage — but it shuts out casual third-party reuse.)
  const origin = req.headers.get('origin');
  if (req.method !== 'GET' && origin && origin !== url.origin) {
    return json(403, 'Forbidden');
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (rateLimited(ip)) return json(429, 'Too many requests — slow down');

  const gpath = url.searchParams.get('gpath') || '';
  const m = PATH_RE.exec(gpath);
  if (!m) return json(403, 'Unsupported API path');
  const [, model, action] = m;
  if (!ALLOWED_ACTIONS.includes(action) || !ALLOWED_MODEL_PREFIXES.some(p => model.startsWith(p))) {
    return json(403, 'Model or action not allowed');
  }

  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) return json(413, 'Request too large');

  const upstreamUrl = new URL(`${UPSTREAM}/${gpath}`);
  // Copy remaining query params; never trust a client-supplied key
  url.searchParams.forEach((v, k) => {
    if (!['gpath', 'path', 'key'].includes(k.toLowerCase()) && !k.startsWith('_vercel')) upstreamUrl.searchParams.set(k, v);
  });
  upstreamUrl.searchParams.set('key', key);

  const headers = new Headers();
  const ct = req.headers.get('content-type');
  if (ct) headers.set('content-type', ct);
  headers.set('x-goog-api-key', key);
  const apiClient = req.headers.get('x-goog-api-client');
  if (apiClient) headers.set('x-goog-api-client', apiClient);

  const upstreamRes = await fetch(upstreamUrl.toString(), {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req.body,
    // @ts-expect-error - required when streaming a request body
    duplex: 'half',
  });

  const resHeaders = new Headers();
  const resCt = upstreamRes.headers.get('content-type');
  if (resCt) resHeaders.set('content-type', resCt);
  resHeaders.set('cache-control', 'no-store');

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers: resHeaders,
  });
}
