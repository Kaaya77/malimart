# MaliMart agent system

> **Using Claude Code?** This same loop is wired in natively — run `/agency <task>` (see
> `.claude/commands/agency.md`; lens subagents in `.claude/agents/`, conventions in `CLAUDE.md`).
> No API key needed there. The scripts below are the standalone/CI version of the loop.

A token-efficient agent system for the MaliMart repo. A cheap scout, one builder engine that
reads the files it edits, conditional review lenses run in parallel, and a bounded fix loop –
all reading a generated repo map instead of re-scanning the code. Everything here is
deterministic except the model calls you wire to your provider.

## Files
- `generate-repo-map.mjs` – builds `repo-map.json`: routes, table→RPC/RLS flags, duplicate
  components, the `/src` load-bearing manifest, and any `supabase.from(...)`-in-component violations.
- `findings-contract.mjs` – the schema, validator, `decideLoop()` (the bounded loop), and the
  structured-output JSON schemas (scout / edits / findings).
- `findings-contract.md` – the contract spec + the exact reviewer prompts.
- `example-findings.json` – a validated worked finding report.
- `prompts.mjs` – the agents: the scout, the builder, and the review lenses (security, ai-integration, design-ux, migration).
- `model-adapter.mjs` – **the one seam you wire up** (Anthropic by default; Gemini implemented; OpenAI stub).
- `runtime.mjs` – workers: load map, list/read files, run `tsc` + `vite build`, apply edits transactionally, call scout/builder/lenses.
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
2. The **scout** (cheap model) picks ≤8 files from the map + file inventory.
3. The **builder** (strong model) receives those files' *contents* and returns a minimal edit
   plan (`{op, file, oldText, newText}` – schema-enforced via structured outputs, so it can't
   return malformed JSON). Edits apply transactionally: any failure rolls the whole batch back.
4. `verify()` runs `tsc` + `vite build`.
5. `runReview()` runs **only the lenses the change needs, in parallel** – security fires on
   `auth`/`cross-user`/`payments`/`role:*`, ai-integration on AI-file changes, design-ux on UI
   changes, migration on SQL – and folds the map's rule violations into seed blocking findings.
6. `decideLoop()` – ship, loop (send blockers back, capped), or escalate to you. On a retry the
   builder is force-fed the files named in open findings, even if the scout missed them.

Reports (`agent-out/report-N.json`) include cumulative token usage and estimated cost.

## The token levers (why it stays cheap)
- The map replaces exploration – agents look up, they don't re-read 50 tables on every task.
- The scout is a cheap-tier call; the strong model only ever sees the ≤8 files it needs
  (capped at ~200KB total), not the repo.
- Prompt caching: system prompts and the stable repo-map block carry `cache_control`
  breakpoints, so retry attempts read the prefix at ~0.1× price.
- Lenses are conditional (and parallel), so most changes never pay for a security review.
- The builder edits as diffs, not whole files; structured outputs kill JSON-parse retries.
- Tiering: `cheap` model (Haiku 4.5) for scouting + soft lenses, `strong` (Opus 4.8, adaptive
  thinking + high effort) only for edits, security, and migrations.
- The loop is capped, so a stubborn problem becomes your decision instead of a token sink.
- The adapter retries 429/5xx with backoff (honoring `retry-after`) so transient errors don't
  burn an attempt.

## Tuning
- Blocking bar and verdict rules: `findings-contract.mjs` (`BLOCKING_BAR`, `decideLoop`).
- Lens firing rules: `lensesForChange` in `findings-contract.mjs`.
- Agent behavior: edit the prompts in `prompts.mjs`.
- Provider / model ids / effort: `model-adapter.mjs` (env: `AGENT_PROVIDER`,
  `AGENT_MODEL_STRONG`, `AGENT_MODEL_CHEAP`).
- File budget for the builder: `MAX_PER_FILE` / `MAX_TOTAL` in `runtime.mjs`.
