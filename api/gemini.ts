// Vercel edge proxy for the Google Gemini API.
// All requests to /api/gemini/<anything> are rewritten here (see vercel.json),
// with the original path carried in the ?gpath= query param. The real
// GEMINI_API_KEY lives only in server env vars and never reaches the browser.

export const config = { runtime: 'edge' };

const UPSTREAM = 'https://generativelanguage.googleapis.com';

export default async function handler(req: Request): Promise<Response> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: 'AI service not configured' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const gpath = url.searchParams.get('gpath') || '';
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
