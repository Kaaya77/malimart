#!/usr/bin/env node
/*
 * orchestrator.mjs – the conductor's loop.
 *
 *   scout (cheap: pick files) -> build (with file contents) -> verify
 *   -> review (only the lenses the change needs, in parallel) -> decideLoop
 *   -> pass: stop (changes left in working tree)
 *   -> changes_requested: send blockers + verify errors back to the builder
 *   -> escalate: stop and hand you the report + open blockers (cap reached)
 *
 * Usage:
 *   node orchestrator.mjs --task "Make CheckoutPage load orders via the RPC layer"
 *   node orchestrator.mjs --task "..." --root . --max-attempts 3
 *   node orchestrator.mjs --task "..." --dry-run        # no API key; mock model + mock verify
 *
 * Real runs need a model: see model-adapter.mjs (ANTHROPIC_API_KEY by default;
 * AGENT_PROVIDER=gemini + GEMINI_API_KEY also works).
 * Requires repo-map.json at --root (generate with generate-repo-map.mjs first).
 *
 * Reports (agent-out/report-N.json) include per-run token usage + estimated cost.
 */

import fs from 'node:fs';
import path from 'node:path';
import { loadRepoMap, verify, applyEdits, runScout, runBuilder, runReview } from './runtime.mjs';
import { decideLoop, validateFindings } from './findings-contract.mjs';
import { getUsageTotals, resetUsageTotals } from './model-adapter.mjs';

const args = parseArgs(process.argv.slice(2));
const ROOT = path.resolve(args.root || process.cwd());
const TASK = args.task;
const MAX = Number(args['max-attempts'] || 3);
const DRY = !!args['dry-run'];

if (!TASK) {
  console.error('Usage: node orchestrator.mjs --task "..." [--root .] [--max-attempts 3] [--dry-run]');
  process.exit(1);
}

const repoMap = loadRepoMap(ROOT);
const callFn = DRY ? makeMockModel() : undefined; // undefined -> runtime uses the real callModel

(async function run() {
  resetUsageTotals();
  let attempt = 1;
  let priorFindings = [];
  let verifyLog = '';

  // Scout once – the relevant files don't change between retry attempts, and the
  // retry loop already force-includes files named in open findings.
  const scout = await runScout({ task: TASK, repoMap, root: ROOT, ...(callFn ? { callFn } : {}) });
  console.log(`[scout] ${scout.files.length} files: ${scout.files.join(', ')}`);
  if (scout.notes) console.log(`  ${scout.notes}`);

  while (true) {
    const built = await runBuilder({
      task: TASK, repoMap, scoutFiles: scout.files, root: ROOT,
      priorFindings, verifyLog, ...(callFn ? { callFn } : {}),
    });
    if (!DRY) applyEdits(ROOT, built.edits || []);
    const changedFiles = built.touchedFiles || (built.edits || []).map((e) => e.file);
    const blastRadius = blastFor(changedFiles, repoMap);

    const v = DRY ? mockVerify() : verify(ROOT);
    verifyLog = (v._logs ? `${v._logs.tsc}\n${v._logs.build}` : '').slice(0, 4000);

    const reviewed = await runReview({ edits: built.edits || [], repoMap, blastRadius, changedFiles, ...(callFn ? { callFn } : {}) });

    const report = {
      schemaVersion: '1.0',
      task: TASK,
      attempt,
      maxAttempts: MAX,
      scoutFiles: scout.files,
      verify: { tsc: v.tsc, build: v.build },
      lensesRun: reviewed.lensesRun,
      findings: reviewed.findings,
      usage: getUsageTotals(),
    };
    const issues = validateFindings(report);
    if (issues.length) console.warn('  contract warnings:', issues);

    const decision = decideLoop(report);
    report.verdict = decision.verdict;
    writeReport(ROOT, report);
    console.log(`\n[attempt ${attempt}] lenses: ${reviewed.lensesRun.join(', ')}`);
    console.log(`  ${decision.summary}`);
    for (const b of decision.blockers) console.log(`  · BLOCK ${b.id} (${b.lens}) ${b.location.file}: ${b.title}`);

    if (decision.verdict === 'pass') {
      console.log(`\nshipped – changes are in the working tree, build green, no blockers.`);
      logUsage();
      break;
    }
    if (decision.verdict === 'escalate') {
      console.log(`\nescalated to you – see agent-out/report-${attempt}.json and the ${decision.blockers.length} open blocker(s) above.`);
      logUsage();
      break;
    }
    priorFindings = decision.blockers;
    attempt++;
  }
})().catch((e) => {
  console.error('orchestrator error:', e.message);
  process.exit(1);
});

function logUsage() {
  const u = getUsageTotals();
  if (!u.calls) return;
  console.log(`usage: ${u.calls} calls · ${u.inputTokens} in / ${u.outputTokens} out · cache ${u.cacheReadTokens} read / ${u.cacheWriteTokens} write · ~$${u.estimatedCostUSD}`);
}

// derive a change's blast radius from the routes/pages it touches
function blastFor(files, map) {
  const tags = new Set();
  for (const r of map.routes || []) {
    for (const p of r.pages || []) {
      const f = p.file.replace(/^\.\//, '');
      if (files.some((x) => x.includes(f))) (r.blastRadius || []).forEach((t) => tags.add(t));
    }
  }
  if (files.some((f) => /aiService|AIChatAssistant/i.test(f))) tags.add('ai');
  return [...tags];
}

function writeReport(root, report) {
  const dir = path.join(root, 'agent-out');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `report-${report.attempt}.json`), JSON.stringify(report, null, 2));
}

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) o[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return o;
}

// ---- dry-run mocks: no API key, clearly fake, just to show the loop turn ----
function makeMockModel() {
  let builds = 0;
  return async ({ system, user }) => {
    const userText = typeof user === 'string' ? user : user.map((b) => b.text).join('\n');
    if (/you are the scout/i.test(system)) {
      return JSON.stringify({ files: ['pages/CheckoutPage.tsx', 'services/accountApi.ts'], notes: 'mock scout' });
    }
    const isBuilder = /builder agent/i.test(system) || /return the edits json/i.test(userText);
    if (isBuilder) {
      builds++;
      return JSON.stringify({
        edits: [{ op: 'edit', file: 'pages/CheckoutPage.tsx', oldText: `MOCK_${builds}`, newText: `MOCK_${builds}_fixed` }],
        touchedFiles: ['pages/CheckoutPage.tsx'],
        notes: `mock build #${builds}`,
      });
    }
    // security reviewer: blocks on the first pass, clean afterward (simulates the fix landing)
    if (/security reviewer/i.test(system) && builds < 2) {
      return JSON.stringify({ findings: [{
        id: 'SEC-001', lens: 'security', severity: 'blocking',
        title: 'mock: CheckoutPage reads orders directly',
        location: { file: 'pages/CheckoutPage.tsx', line: 88, symbol: null },
        rationale: 'mock', fix: 'use the get_buyer_order_summary RPC', ruleId: 'no-direct-supabase-from-in-component',
      }] });
    }
    return JSON.stringify({ findings: [] });
  };
}
function mockVerify() {
  return { tsc: { ok: true, errors: 0 }, build: { ok: true, errors: 0 }, _logs: { tsc: '', build: '' } };
}
