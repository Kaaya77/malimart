# MaliMart review/verify findings contract

Every review lens and the verifier emit findings in one shape. The builder applies them; the
orchestrator runs `decideLoop()` to bound the fix loop. Enforcement lives in `findings-contract.mjs`.

## Why a contract at all
A vague review note ("this could be cleaner") makes the builder thrash. A structured finding –
location, reason, and a concrete fix – lets the builder apply it in one move and the loop
converge. The split between **blocking** and **advisory** is what keeps the loop bounded: only
blocking findings trigger another iteration; advisories are recorded and shipped.

## The report shape
```
FindingsReport {
  schemaVersion: "1.0"
  task: string
  attempt: number            // 1-based loop iteration
  maxAttempts: number        // the cap, e.g. 3
  diffRef?: string           // patch/commit under review
  verify:  { tsc: {ok, errors}, build: {ok, errors} }   // always runs
  lensesRun: LensName[]      // which lenses fired (driven by blastRadius)
  findings: Finding[]
  verdict?: "pass" | "changes_requested" | "escalate"   // filled by decideLoop()
}

Finding {
  id: string                 // stable, e.g. "SEC-001" – same issue keeps its id across attempts
  lens: "security" | "ai-integration" | "design-ux" | "verify" | "build"
  severity: "blocking" | "advisory"
  title: string              // one line
  location: { file, line?, symbol? }   // required – findings must be actionable
  rationale: string          // why it matters, 1-2 sentences
  fix: string                // concrete instruction or unified diff (required)
  ruleId?: string            // e.g. "no-direct-supabase-from-in-component"
  blastRadius?: string[]     // tags carried from the route/change
}
```

## The blocking bar (narrow on purpose)
A finding may be `blocking` ONLY if it is one of these. Everything else is `advisory`.
1. Build or type failure – `tsc --noEmit` or `vite build` not green.
2. Security-boundary breach – cross-user data exposure, missing/incorrect RLS, broken auth or
   route guard, or anything touching payments/wallet/payout.
3. Data loss or corruption – destructive migration, dropped column, unscoped delete/update.
4. A repo-map rule violation – e.g. `supabase.from(...)` called directly in a component/page.

Two hard rules the validator enforces: every blocking finding must have a concrete `fix`, and
every finding must have a `location.file`. A blocker with no fix is itself a defect – it just
makes the builder guess.

## Verdict and loop
`decideLoop(report)`:
- any blocking finding OR a failed verify → `changes_requested` if retries remain, else `escalate`
- otherwise → `pass` (advisories noted, then ship)

So a green build with an open blocking security finding does NOT ship – it loops. And the loop
can never run forever: once `attempt` reaches `maxAttempts` with blockers still open, it
escalates to you with the diff and the remaining blockers.

## What each reviewer is told (prompt template)
Give each lens this, swapping `{LENS}` and the focus line:

> You are the **{LENS}** reviewer for MaliMart. Review ONLY the supplied diff, for {LENS}
> concerns only. Output a JSON array of `Finding` objects matching the contract – nothing else,
> no prose, no praise, no restating the diff.
> Mark a finding `blocking` ONLY if it meets the blocking bar (build/type failure;
> security-boundary breach incl. cross-user/RLS/auth/payments; data loss; or a repo-map rule
> violation). Everything else is `advisory`.
> Every finding needs a `location`; every blocking finding needs a concrete `fix` (exact
> instruction or unified diff). Use stable ids so an unfixed issue keeps its id next attempt.
> If you find nothing, return `[]`.

Focus lines:
- security: RLS coverage, cross-user reads/writes, route guards, CSRF/anomaly checks, payments/wallet.
- ai-integration: Gemini prompt + cost, the `@google/genai` lazy-load boundary, error handling.
- design-ux: `components/UI.tsx` primitives, editorial theme tokens, accessibility.

The verifier is not a prompt – it runs `tsc --noEmit` and `vite build`, sets `verify`, and emits
`verify`/`build` findings (severity `blocking`) for failures, parsing only the errors.

## How it consumes the repo map
- `lensesForChange(blastRadius, changedFiles)` reads the route's `blastRadius` from `repo-map.json`
  to decide which lenses fire – security only on `auth | cross-user | payments | role:*`, so a
  static-page edit skips it.
- `findingsFromRepoMapViolations(repoMap.ruleViolations)` converts the map's direct-query
  violations into seed blocking security findings, so the lens starts from proven facts.

## Use
```
import { validateFindings, decideLoop, lensesForChange, findingsFromRepoMapViolations } from './findings-contract.mjs';

const lenses = lensesForChange(route.blastRadius, changedFiles);   // which reviewers to run
const report = { schemaVersion: '1.0', task, attempt, maxAttempts: 3, verify, lensesRun: lenses, findings };
const issues = validateFindings(report);     // [] when the report itself is well-formed
const decision = decideLoop(report);         // { verdict, blockers, retriesLeft, summary, ... }
```
`example-findings.json` is a validated, worked instance.
