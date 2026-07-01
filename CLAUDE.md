# MaliMart — Claude Code guide

Tanzanian marketplace webapp. React 19 + TypeScript + Vite + Tailwind v4, Supabase (auth/DB/RLS), Gemini for the in-app "Mali" assistant, deployed on Vercel.

## Layout — read this first
- **The live app is the ROOT directories:** `components/`, `pages/`, `context/`, `hooks/`, `services/`, `api/`, plus root `App.tsx` / `index.tsx` / `types.ts` / `constants.ts`.
- **`/src` is a stale twin.** Only `src/security.ts`, `src/services/aiService.ts`, and `src/hooks/useDebounce.ts` are load-bearing (imported by root files). Never add new code under `/src`.
- `repo-map.json` (generate: `node scripts/generate-repo-map.mjs`) maps routes, tables→RPC/RLS, and rule violations. Regenerate it before multi-file work instead of re-exploring.

## Non-negotiable rules
- **Never call `supabase.from(...)` in a component or page.** Cross-user data goes through `services/accountApi.ts` or approved RPCs. RLS is the only security boundary. (The repo has ~112 legacy violations — don't add new ones; migrate ones you touch.)
- `orders` has **no `seller_id` column** — seller-side order reads must use the RPCs, not table filters.
- The Supabase auth callback must stay **synchronous** — making it async breaks the session handshake.
- Style with `components/UI.tsx` primitives and the editorial Tailwind theme tokens before writing custom styles.
- Migrations: timestamped SQL in `supabase/migrations/` (`YYYYMMDDHHMMSS_description.sql`), always with RLS policies for new tables. Never DROP columns/tables without explicit instruction.
- AI code: keep `@google/genai` behind the lazy-load boundary in `App.tsx` — never import it on the critical path.
- Mali avatar UX: one persistent companion; reaction bubbles, not face swaps; deliberate emotes only (AI-chosen per reply, purchases, mood empathy).

## Verify
```
npx tsc --noEmit     # types
npx vite build       # production build
```
Both must be green before a change ships.

## The agency (agent workflow)
- `/agency <task>` — full build→verify→review loop with the MaliMart review lenses (see `.claude/commands/agency.md`).
- Review lens subagents live in `.claude/agents/` (security, ai-integration, design-ux, migration). Use them proactively after edits that touch their domain even outside `/agency`.
- Blocking bar (what forces a fix, vs. advisory): build/type failure · security-boundary breach (cross-user data, RLS, auth/route guards, payments/wallet/payout) · data loss/corruption · a repo-map rule violation. Everything else is advisory — note it, don't loop on it.
- `scripts/orchestrator.mjs` is the standalone/CI version of the same loop (needs an API key); inside Claude Code, run the loop directly instead.
