# MaliMart AI Repair — commit these 4 files (paths match your repo root)

## Root cause
Google shut down `gemini-2.0-flash` on **1 June 2026**. Your code called it in
24 places, so every AI feature began returning 404 "model not found" twelve
days ago. `gemini-3-pro-preview` (shop assistant ranking) died even earlier,
on 9 March 2026. Your proxy (api/gemini.ts) and key handling were fine.

## Files
- `services/aiModels.ts` (NEW) — central model registry + safeJson + prompt
  fencing. Next deprecation = one-line change. ⚠️ gemini-2.5-flash family
  shuts down 16 Oct 2026 → set a September reminder to switch to gemini-3.5-flash.
- `services/geminiService.ts` — all 26 model refs migrated:
  • utility calls → gemini-2.5-flash-lite (same price as old 2.0-flash)
  • assistant/disputes/trending/recipes → gemini-2.5-flash
  • generateProductImage / refineProductImage / generateRecipeCardImage →
    gemini-2.5-flash-image (they previously pointed at a TEXT model, so image
    generation could never work — now it will)
  • dead `window.aistudio` key-picker branches removed (AI Studio leftovers
    that silently swallowed errors in production)
  • model-retired errors now fail fast instead of retrying 3× with backoff
- `components/AIChatAssistant.tsx` — chat + voice models from registry.
- `src/services/aiService.ts` — rewritten: retry added, JSON parsing made
  crash-proof, moderation prompt fenced against prompt injection, KYC
  extraction moved to the smarter model.

## After committing
Confirm `GEMINI_API_KEY` is still set in Vercel → Project → Settings →
Environment Variables, then redeploy. Test order: welcome greeting (cheap),
chat assistant, then image generation.
