// Vercel serverless proxy for the Google Gemini API.
// Keeps GEMINI_API_KEY server-side only — it is never shipped to the browser.
// The @google/genai SDK in the client is pointed at /api/gemini via httpOptions.baseUrl,
// and this function forwards each request to generativelanguage.googleapis.com,
// attaching the real key from the environment.

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
  // Strip the /api/gemini prefix to recover the upstream path
  const upstreamPath = url.pathname.replace(/^\/api\/gemini/, '');
  const upstreamUrl = new URL(UPSTREAM + upstreamPath);

  // Copy query params, but never trust/forward a client-supplied key
  url.searchParams.forEach((v, k) => {
    if (k.toLowerCase() !== 'key') upstreamUrl.searchParams.set(k, v);
  });
  upstreamUrl.searchParams.set('key', key);

  // Forward only safe headers; replace any api-key header with the real one
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
    // @ts-expect-error - required by Node/edge fetch when streaming a request body
    duplex: 'half',
  });

  // Stream the response straight back (supports streamGenerateContent + media downloads)
  const resHeaders = new Headers();
  const resCt = upstreamRes.headers.get('content-type');
  if (resCt) resHeaders.set('content-type', resCt);
  resHeaders.set('cache-control', 'no-store');

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers: resHeaders,
  });
}
