# MaliMart agent system

A token-efficient agent system for the MaliMart repo. One builder engine, conditional review
lenses, and a bounded fix loop – all reading a generated repo map instead of re-scanning the code.
Everything here is deterministic except one model call you wire to your provider.

## Files
- `generate-repo-map.mjs` – builds `repo-map.json`: routes, table→RPC/RLS flags, duplicate
  components, the `/src` load-bearing manifest, and any `supabase.from(...)`-in-component violations.
- `findings-contract.mjs` – the schema, validator, and `decideLoop()` (the bounded loop).
- `findings-contract.md` – the contract spec + the exact reviewer prompts.
- `example-findings.json` – a validated worked finding report.
- `prompts.mjs` – the agents: the builder and the three review lenses (security, ai-integration, design-ux).
- `model-adapter.mjs` – **the one seam you wire up** (Anthropic by default; stubs for Gemini/OpenAI).
- `runtime.mjs` – workers: load map, run `tsc` + `vite build`, apply edits, call builder/lenses.
- `orchestrator.mjs` – the loop and CLI.

## Requirements
Node >= 18 (global `fetch`). No npm dependencies.

## 1. Generate the map
```
node scripts/generate-repo-map.mjs
```
Reads `App.tsx` for routes and your schema dump for tables. Wire this into a pre-commit hook or
CI so the map never drifts. The generated `repo-map.json` and `repo-map.md` land at the repo root.

## 2. See the loop turn (no API key)
```
node scripts/orchestrator.mjs --task "..." --root . --dry-run
```
Uses a mock model + mock verify. Shows lens selection, the build→review→decide loop, and the cap.

## 3. Run for real
```
export ANTHROPIC_API_KEY=sk-...
node scripts/orchestrator.mjs --task "Make CheckoutPage load the buyer order summary via the RPC layer" --root .
```
Reports are written to `agent-out/report-N.json`. Edits land in your working tree – review the diff before committing.

## How it fits
1. `generate-repo-map.mjs` → `repo-map.json` (the shared map every agent reads).
2. The orchestrator asks the **builder** for a minimal edit (returns `{file, oldText, newText}` diffs).
3. `verify()` runs `tsc` + `vite build`.
4. `runReview()` runs **only the lenses the change needs** – security fires on `auth`/`cross-user`/`payments`/`role:*`, ai-integration on AI-file changes, design-ux on UI changes – and folds the map's rule violations into seed blocking findings.
5. `decideLoop()` – ship, loop (send blockers back, capped), or escalate to you.

## The token levers (why it stays cheap)
- The map replaces exploration – agents look up, they don't re-read 50 tables on every task.
- Lenses are conditional, so most changes never pay for a security review.
- The builder edits as diffs, not whole files.
- Tiering: `cheap` model for triage, `strong` only for hard edits + security.
- The loop is capped, so a stubborn problem becomes your decision instead of a token sink.

## Tuning
- Blocking bar and verdict rules: `findings-contract.mjs` (`BLOCKING_BAR`, `decideLoop`).
- Lens firing rules: `lensesForChange` in `findings-contract.mjs`.
- Agent behavior: edit the prompts in `prompts.mjs`.
- Provider / model ids: `model-adapter.mjs`.
