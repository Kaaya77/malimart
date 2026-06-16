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
  // Single text model for all non-image tasks.
  TEXT: 'gemini-2.5-flash',

  // Primary image generation/editing model.
  IMAGE: 'gemini-2.5-flash-image',

  // Voice assistant (Live API, websocket).
  LIVE_AUDIO: 'gemini-2.5-flash-native-audio-preview-12-2025',
} as const;

// Ordered fallback chain for image generation.
// When the primary model hits 429, callers try models left to right.
export const IMAGE_MODEL_CHAIN = [
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image',
  'gemini-3-pro-image',
] as const;

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
