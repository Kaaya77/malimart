# MaliMart — Claude Code guide

Tanzanian marketplace webapp. React 19 + TypeScript + Vite + Tailwind v4, Supabase (auth/DB/RLS), Gemini for the in-app "Mali" assistant, deployed on Vercel.

## Layout — read this first
- **The live app is the ROOT directories:** `components/`, `pages/`, `context/`, `hooks/`, `services/`, `api/`, plus root `App.tsx` / `index.tsx` / `types.ts` / `constants.ts`.
- **`/src` is down to three load-bearing files** — `src/security.ts`, `src/services/aiService.ts`, `src/hooks/useDebounce.ts` (246 lines total), all imported by root files. The old stale twin has already been cleared out. Never add new code under `/src`.
- `repo-map.json` (generate: `node scripts/generate-repo-map.mjs`) maps routes, tables→RPC/RLS, and rule violations. Regenerate it before multi-file work instead of re-exploring.

## Non-negotiable rules
- **Never call `supabase.from(...)` in a component or page.** Cross-user data goes through `services/accountApi.ts` or approved RPCs. RLS is the only security boundary. (80 legacy violations remain, ALL of them inside `context/AppContext.tsx` and `hooks/useHomePageData.ts` — a contained refactor, not a sprawl. Don't add new ones; migrate ones you touch.)
- `orders` has **no `seller_id` column** — seller-side order reads must use the RPCs, not table filters.
- The Supabase auth callback must stay **synchronous** — making it async breaks the session handshake.
- Style with `components/UI.tsx` primitives and the editorial Tailwind theme tokens before writing custom styles.
- Migrations: timestamped SQL in `supabase/migrations/` (`YYYYMMDDHHMMSS_description.sql`), always with RLS policies for new tables. Never DROP columns/tables without explicit instruction.
- **Every new VIEW must revoke writes and set read grants explicitly.** Supabase's default ACL grants ALL on new `public` relations to `anon`/`authenticated`. A view has no RLS of its own, is SECURITY DEFINER by default, and if it selects from a single table it is auto-updatable — so a plain `create view` hands anonymous callers RLS-bypassing INSERT/UPDATE/DELETE on the base table. This was a live unauthenticated admin-escalation hole; see `supabase/migrations/20260902120000_view_write_grant_lockdown.sql`. Also never blanket-`grant select ... to anon` across views — grant per view, to the narrowest audience.
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
