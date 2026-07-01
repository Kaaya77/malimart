import { GoogleGenAI } from '@google/genai';

// All Gemini traffic goes through our serverless proxy (/api/gemini), which
// holds the real API key server-side. The apiKey below is a non-secret
// placeholder the SDK requires; the proxy strips and replaces it.
let _ai: GoogleGenAI | null = null;

export const getAI = (): GoogleGenAI => {
  if (!_ai) {
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
  const res = await fetch('/api/gemini-token', { method: 'POST' });
  if (!res.ok) throw new Error('Voice AI unavailable');
  const data = await res.json();
  const token = data.name || data.token;
  return new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1alpha' } });
};
