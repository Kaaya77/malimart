// =====================================================================
// aiModels.ts — single source of truth for every Gemini model ID.
// WHY THIS FILE EXISTS: gemini-2.0-flash (24 call sites) was shut down
// by Google on 1 June 2026 — that's what killed all AI features.
// gemini-3-pro-preview died 9 March 2026. Hardcoded model IDs are a
// production liability; from now on, change them HERE only.
//
// NEXT KNOWN DEADLINE: gemini-2.5-flash family shuts down 16 Oct 2026
// (replacement: gemini-3.5-flash). Set a reminder for September 2026.
// =====================================================================

export const MODELS = {
  // High-volume utility calls (tags, SKU, price, translation, captions).
  // 2.5-flash-lite is priced identically to the old 2.0-flash.
  FAST: 'gemini-2.5-flash-lite',

  // Quality reasoning (shopping assistant, dispute analysis, trending,
  // conversation analysis).
  SMART: 'gemini-2.5-flash',

  // Image generation & editing ("Nano Banana"). The old code pointed
  // image generation at a text model, which never returned images.
  IMAGE: 'gemini-2.5-flash-image',

  // Marketing video generation.
  VIDEO: 'veo-3.1-fast-generate-preview',

  // Voice assistant (Live API, websocket).
  LIVE_AUDIO: 'gemini-2.5-flash-native-audio-preview-12-2025',
} as const;

// Defensive JSON parse for structured responses — strips ```json fences
// and never throws on malformed output.
export const safeJson = <T>(text: string | undefined, fallback: T): T => {
  if (!text) return fallback;
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim()) as T;
  } catch {
    return fallback;
  }
};

// Wrap untrusted user text before interpolating into prompts, so product
// names/messages can't smuggle instructions into the model.
export const fence = (s: string) =>
  `<user_data>${(s || '').replace(/<\/?user_data>/g, '')}</user_data>`;
