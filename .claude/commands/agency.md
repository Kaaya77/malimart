---
description: Run the MaliMart agency loop on a task — build, verify (tsc + vite build), review with the relevant lens subagents, fix blockers, ship
argument-hint: <task to implement>
---

Run the MaliMart agency loop on this task: $ARGUMENTS

Follow this loop exactly. Conventions and the blocking bar are in CLAUDE.md.

## 1. Map
If `repo-map.json` is missing or older than the last commit, run `node scripts/generate-repo-map.mjs`. Use it (routes, tables→RPC/RLS, srcManifest, duplicateComponents) to locate the change instead of broad exploration.

## 2. Build
Read the files you will edit plus their immediate dependencies (the service/RPC layer a page calls, the UI primitives used, the types involved). Make the smallest diff that satisfies the task, per CLAUDE.md conventions. Migrations go in `supabase/migrations/` with RLS.

## 3. Verify
```
npx tsc --noEmit
npx vite build
```
If either fails, fix and re-verify before reviewing.

## 4. Review — only the lenses this change needs, in parallel
Launch the matching subagents concurrently (single message, multiple Agent calls), passing each the task, the list of changed files, and the diff (`git diff`):
- **malimart-security** — if the change touches auth, route guards, orders, payments/wallet/payout, cross-user data, or any Supabase query.
- **malimart-ai-integration** — if it touches AIChatAssistant, aiService/aiClient/aiModels, maliPersonality, api/gemini*, or anything importing @google/genai.
- **malimart-design-ux** — if it touches .tsx/.css UI.
- **malimart-migration** — if it adds/edits .sql.

A pure logic change may need only one lens; a CSS tweak never pays for a security review.

## 5. Decide (bounded loop, max 3 attempts)
- **Blocking findings or red verify** → fix exactly those, surgically, then re-verify and re-run only the lenses that raised them. Count the attempt.
- **After 3 attempts with blockers still open** → STOP and escalate: show the user the remaining blockers, the diff, and your recommendation. Do not keep polishing.
- **No blockers** → ship. List advisory findings for the user without acting on them (unless trivial and in files you already changed).

## 6. Report
End with: what changed (files + one line each), verify status, lenses run, blocking findings fixed, advisories noted. Lead with the outcome.
