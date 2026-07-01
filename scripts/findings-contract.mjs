/*
 * findings-contract.mjs  –  MaliMart review/verify findings contract
 *
 * Every review lens (security, ai-integration, design-ux) and the verifier emit
 * findings in THIS shape. The builder consumes them; the orchestrator runs decideLoop()
 * to bound the fix loop. This is what makes the loop converge instead of thrash.
 *
 * Why this exists:
 *   - Structured, so the builder can apply fixes surgically and the loop can be decided in code.
 *   - blocking vs advisory: ONLY blocking findings force another loop iteration.
 *   - Every blocking finding must carry a concrete `fix` and a `location`, or it is rejected
 *     (a blocker with no fix is itself a defect – it would just make the builder guess).
 *
 * Plain ESM + JSDoc types. Runs in Node; usable in the Vite/TS app (enable checkJs for types).
 *   node scripts/findings-contract.mjs --selftest --out example-findings.json
 */

import fs from 'node:fs';

/** @typedef {'security'|'ai-integration'|'design-ux'|'verify'|'build'} LensName */
/** @typedef {'blocking'|'advisory'} Severity */
/** @typedef {'pass'|'changes_requested'|'escalate'} Verdict */
/** @typedef {{ file: string, line?: number, symbol?: string }} Location */
/** @typedef {{ id: string, lens: LensName, severity: Severity, title: string, location: Location, rationale: string, fix: string, ruleId?: string, blastRadius?: string[] }} Finding */
/** @typedef {{ tsc: { ok: boolean, errors: number }, build: { ok: boolean, errors: number } }} VerifyResult */
/** @typedef {{ schemaVersion: '1.0', task: string, attempt: number, maxAttempts: number, diffRef?: string, verify: VerifyResult, lensesRun: LensName[], findings: Finding[], verdict?: Verdict }} FindingsReport */

export const LENSES = ['security', 'ai-integration', 'design-ux', 'migration', 'verify', 'build'];
export const SEVERITIES = ['blocking', 'advisory'];

// ---- structured-output schemas ----------------------------------------------
// Passed to the model adapter's `schema` option (output_config.format) so the
// model is constrained to return valid JSON in exactly these shapes. Structured
// outputs require additionalProperties:false and no min/max constraints.

/** The scout picks which files the builder needs to read before editing. */
export const SCOUT_SCHEMA = {
  type: 'object',
  properties: {
    files: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['files', 'notes'],
  additionalProperties: false,
};

/** The builder's edit plan. Unused string fields are "" (e.g. oldText on create). */
export const EDITS_SCHEMA = {
  type: 'object',
  properties: {
    edits: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          op: { type: 'string', enum: ['edit', 'create', 'delete', 'migration'] },
          file: { type: 'string' },
          oldText: { type: 'string' },
          newText: { type: 'string' },
        },
        required: ['op', 'file', 'oldText', 'newText'],
        additionalProperties: false,
      },
    },
    touchedFiles: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['edits', 'touchedFiles', 'notes'],
  additionalProperties: false,
};

/** A review lens's findings, wrapped in an object (structured outputs want an object root). */
export const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          lens: { type: 'string', enum: ['security', 'ai-integration', 'design-ux', 'migration'] },
          severity: { type: 'string', enum: ['blocking', 'advisory'] },
          title: { type: 'string' },
          location: {
            type: 'object',
            properties: {
              file: { type: 'string' },
              line: { type: ['integer', 'null'] },
              symbol: { type: ['string', 'null'] },
            },
            required: ['file', 'line', 'symbol'],
            additionalProperties: false,
          },
          rationale: { type: 'string' },
          fix: { type: 'string' },
          ruleId: { type: ['string', 'null'] },
        },
        required: ['id', 'lens', 'severity', 'title', 'location', 'rationale', 'fix', 'ruleId'],
        additionalProperties: false,
      },
    },
  },
  required: ['findings'],
  additionalProperties: false,
};

/**
 * The blocking bar. A finding may ONLY be `blocking` if it is one of these.
 * Everything else – naming, polish, micro-perf, preference – is `advisory`.
 * Keeping this bar narrow is what stops the loop from polishing forever.
 */
export const BLOCKING_BAR = [
  'build or type failure (tsc / vite build not green)',
  'security-boundary breach: cross-user data exposure, missing/incorrect RLS, broken auth or route guard, or anything touching payments/wallet/payout',
  'data loss or corruption (destructive migration, dropped column, unscoped delete/update)',
  'a repo-map rule violation (e.g. supabase.from(...) called directly in a component/page)',
];

/**
 * Validate a findings report against the contract.
 * Returns [] when valid; otherwise a list of issues. Blocking findings without a
 * concrete fix or a location are treated as contract violations.
 * @param {FindingsReport} report
 * @returns {{ path: string, message: string }[]}
 */
export function validateFindings(report) {
  /** @type {{ path: string, message: string }[]} */
  const issues = [];
  const bad = (path, message) => issues.push({ path, message });

  if (!report || typeof report !== 'object') return [{ path: '', message: 'report must be an object' }];
  if (report.schemaVersion !== '1.0') bad('schemaVersion', "must be '1.0'");
  if (!report.task || typeof report.task !== 'string') bad('task', 'required non-empty string');
  if (!Number.isInteger(report.attempt) || report.attempt < 1) bad('attempt', 'integer >= 1');
  if (!Number.isInteger(report.maxAttempts) || report.maxAttempts < 1) bad('maxAttempts', 'integer >= 1');
  if (Number.isInteger(report.attempt) && Number.isInteger(report.maxAttempts) && report.attempt > report.maxAttempts)
    bad('attempt', 'must not exceed maxAttempts');

  const v = report.verify;
  if (!v || typeof v !== 'object') bad('verify', 'required');
  else {
    for (const k of ['tsc', 'build']) {
      if (!v[k] || typeof v[k].ok !== 'boolean' || !Number.isInteger(v[k].errors))
        bad(`verify.${k}`, 'requires { ok: boolean, errors: integer }');
    }
  }

  if (!Array.isArray(report.lensesRun)) bad('lensesRun', 'must be an array');
  else for (const l of report.lensesRun) if (!LENSES.includes(l)) bad('lensesRun', `unknown lens: ${l}`);

  if (!Array.isArray(report.findings)) {
    bad('findings', 'must be an array');
    return issues;
  }

  const seen = new Set();
  report.findings.forEach((f, i) => {
    const p = `findings[${i}]`;
    if (!f.id) bad(`${p}.id`, 'required (stable id, e.g. SEC-001)');
    else if (seen.has(f.id)) bad(`${p}.id`, `duplicate id: ${f.id}`);
    else seen.add(f.id);
    if (!LENSES.includes(f.lens)) bad(`${p}.lens`, `must be one of ${LENSES.join(', ')}`);
    if (!SEVERITIES.includes(f.severity)) bad(`${p}.severity`, `must be one of ${SEVERITIES.join(', ')}`);
    if (!f.title) bad(`${p}.title`, 'required one-line summary');
    if (!f.location || !f.location.file) bad(`${p}.location.file`, 'required – findings must be actionable');
    if (!f.rationale) bad(`${p}.rationale`, 'required – why it matters');
    if (!f.fix || !String(f.fix).trim()) bad(`${p}.fix`, 'required – a concrete instruction or diff');
    if (f.severity === 'blocking' && (!f.fix || !String(f.fix).trim()))
      bad(`${p}.fix`, 'BLOCKING finding must include a concrete fix');
  });

  return issues;
}

/**
 * Decide whether the loop continues, ships, or escalates. This is the bounded loop.
 *   - any blocking finding OR a failed verify  ->  changes_requested (if retries left) else escalate
 *   - otherwise                                ->  pass (advisories are noted, then ship)
 * @param {FindingsReport} report
 * @returns {{ verdict: Verdict, blockers: Finding[], advisories: Finding[], retriesLeft: number, handBackToBuilder: boolean, escalateToHuman: boolean, summary: string }}
 */
export function decideLoop(report) {
  const blockers = report.findings.filter((f) => f.severity === 'blocking');
  const advisories = report.findings.filter((f) => f.severity === 'advisory');
  const verifyFailed = !report.verify.tsc.ok || !report.verify.build.ok;
  const hasBlocking = blockers.length > 0 || verifyFailed;
  const retriesLeft = Math.max(0, report.maxAttempts - report.attempt);

  /** @type {Verdict} */
  let verdict;
  if (!hasBlocking) verdict = 'pass';
  else if (retriesLeft > 0) verdict = 'changes_requested';
  else verdict = 'escalate';

  const buildNote = verifyFailed ? 'build red' : 'build green';
  const summary =
    verdict === 'pass'
      ? `Attempt ${report.attempt}/${report.maxAttempts} – no blocking issues, ${buildNote}. Shipping (${advisories.length} advisory noted).`
      : verdict === 'changes_requested'
        ? `Attempt ${report.attempt}/${report.maxAttempts} – ${blockers.length} blocking, ${buildNote}. Sending fixes to builder (${retriesLeft} retries left).`
        : `Attempt ${report.attempt}/${report.maxAttempts} – ${blockers.length} blocking still open after the cap. Escalating to you with the diff and remaining blockers.`;

  return {
    verdict,
    blockers,
    advisories,
    retriesLeft,
    handBackToBuilder: verdict === 'changes_requested',
    escalateToHuman: verdict === 'escalate',
    summary,
  };
}

/**
 * Which lenses should run for a change, from its repo-map blastRadius + changed files.
 * verify and build always run; the rest are conditional, so a CSS tweak never pays for
 * a security review and a non-AI change never loads the ai-integration lens.
 * @param {string[]} blastRadius
 * @param {string[]} changedFiles
 * @returns {LensName[]}
 */
export function lensesForChange(blastRadius = [], changedFiles = []) {
  /** @type {Set<LensName>} */
  const set = new Set(['verify', 'build']);
  if (blastRadius.some((t) => t === 'auth' || t === 'cross-user' || t === 'payments' || t.startsWith('role:')))
    set.add('security');
  if (changedFiles.some((f) => /aiService|AIChatAssistant|genai/i.test(f))) set.add('ai-integration');
  if (changedFiles.some((f) => /\.(tsx|css)$/i.test(f) || /components\/UI/i.test(f))) set.add('design-ux');
  if (changedFiles.some((f) => /supabase\/migrations\/.*\.sql$/i.test(f))) set.add('migration');
  return [...set];
}

/**
 * Turn repo-map ruleViolations (direct supabase.from in a component) into seed blocking findings.
 * Lets the security lens start from facts the map already proved, for free.
 * @param {{ file: string, table: string, rule: string }[]} violations
 * @returns {Finding[]}
 */
export function findingsFromRepoMapViolations(violations = []) {
  return violations.map((v, i) => ({
    id: `SEC-RM-${String(i + 1).padStart(3, '0')}`,
    lens: 'security',
    severity: 'blocking',
    title: `Direct table query in component: ${v.table}`,
    location: { file: v.file },
    rationale: 'Components must not query tables directly – it bypasses the RPC/RLS boundary, the only security boundary.',
    fix: `Route the read/write through the matching RPC in services/accountApi.ts (add one if missing). Remove the supabase.from('${v.table}') call from the component.`,
    ruleId: v.rule,
  }));
}

// --- self-test: builds a worked example, validates it, runs decideLoop, optionally writes JSON ---
function selfTest(outPath) {
  /** @type {FindingsReport} */
  const example = {
    schemaVersion: '1.0',
    task: 'Make CheckoutPage load the buyer order summary via the RPC layer',
    attempt: 1,
    maxAttempts: 3,
    diffRef: 'patch-7f3a1c',
    verify: { tsc: { ok: true, errors: 0 }, build: { ok: true, errors: 0 } },
    lensesRun: ['verify', 'build', 'security', 'design-ux'],
    findings: [
      {
        id: 'SEC-001',
        lens: 'security',
        severity: 'blocking',
        title: 'CheckoutPage reads orders directly via supabase.from',
        location: { file: 'pages/CheckoutPage.tsx', line: 88, symbol: 'loadSummary' },
        rationale: 'Direct table access bypasses RLS/RPC; a buyer could read order rows the policy is meant to scope.',
        fix: "Replace supabase.from('orders')... with the get_buyer_order_summary RPC in services/accountApi.ts.",
        ruleId: 'no-direct-supabase-from-in-component',
        blastRadius: ['auth', 'payments', 'cross-user'],
      },
      {
        id: 'UX-001',
        lens: 'design-ux',
        severity: 'advisory',
        title: 'Confirm button is a raw <button>, not the UI primitive',
        location: { file: 'pages/CheckoutPage.tsx', line: 142, symbol: 'ConfirmButton' },
        rationale: 'Skips the editorial theme tokens and focus styles the Button primitive provides.',
        fix: "Use Button from components/UI.tsx instead of the inline <button>.",
      },
    ],
  };

  const issues = validateFindings(example);
  const decision = decideLoop(example);
  example.verdict = decision.verdict;

  console.log('validation issues:', issues.length === 0 ? 'none (valid)' : issues);
  console.log('decision:', JSON.stringify({ verdict: decision.verdict, retriesLeft: decision.retriesLeft, blockers: decision.blockers.length }, null, 0));
  console.log('summary:', decision.summary);

  if (outPath) {
    fs.writeFileSync(outPath, JSON.stringify(example, null, 2));
    console.log('wrote example to', outPath);
  }
  if (issues.length) process.exitCode = 1;
}

if (process.argv.includes('--selftest')) {
  const i = process.argv.indexOf('--out');
  selfTest(i > -1 ? process.argv[i + 1] : null);
}
