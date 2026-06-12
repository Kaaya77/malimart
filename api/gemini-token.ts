// Mints short-lived ephemeral tokens for the Gemini Live (websocket) API.
// The browser can't use the HTTP proxy for websockets, so it requests one of
// these tokens and connects directly — the real key never leaves the server.

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: 'AI service not configured' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });
  }

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1alpha/auth_tokens',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        uses: 1,
        expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      }),
    },
  );

  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
