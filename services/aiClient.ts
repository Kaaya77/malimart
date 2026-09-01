// `import type` is erased at build time, so importing this module never pulls
// the ~266KB @google/genai SDK. The SDK is loaded lazily via dynamic import
// only when an AI feature actually runs — keeping it off the critical path
// (Navbar → SearchModal → aiClient would otherwise drag it into first paint).
import type { GoogleGenAI } from '@google/genai';

// All Gemini traffic goes through our serverless proxy (/api/gemini), which
// holds the real API key server-side. The apiKey below is a non-secret
// placeholder the SDK requires; the proxy strips and replaces it.
let _ai: GoogleGenAI | null = null;

export const getAI = async (): Promise<GoogleGenAI> => {
  if (!_ai) {
    const { GoogleGenAI } = await import('@google/genai');
    _ai = new GoogleGenAI({
      apiKey: 'proxied',
      httpOptions: { baseUrl: `${window.location.origin}/api/gemini` },
    });
  }
  return _ai;
};

// Live (websocket) API can't use the HTTP proxy — fetch a short-lived
// ephemeral token from the server and connect with it directly.
export const getLiveAI = async (): Promise<GoogleGenAI> => {
  const { GoogleGenAI } = await import('@google/genai');
  const res = await fetch('/api/gemini-token', { method: 'POST' });
  if (!res.ok) throw new Error('Voice AI unavailable');
  const data = await res.json();
  const token = data.name || data.token;
  return new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1alpha' } });
};
