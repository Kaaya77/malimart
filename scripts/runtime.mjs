/*
 * runtime.mjs – the workers. Deterministic plumbing around the model calls.
 *   loadRepoMap   – read repo-map.json
 *   listRepoFiles – deterministic file inventory the scout picks from
 *   verify        – run tsc --noEmit + vite build, return the contract's VerifyResult + logs
 *   applyEdits    – apply the builder's edits transactionally (rollback on failure)
 *   runScout      – cheap model picks which files the builder must read
 *   runBuilder    – call the builder WITH the selected files' contents, get edits JSON
 *   runReview     – run the conditional lenses in parallel + fold repo-map rule violations in
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { callModel } from './model-adapter.mjs';
import { SCOUT, BUILDER, LENS_PROMPTS } from './prompts.mjs';
import {
  lensesForChange, findingsFromRepoMapViolations,
  SCOUT_SCHEMA, EDITS_SCHEMA, FINDINGS_SCHEMA,
} from './findings-contract.mjs';

export function loadRepoMap(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'repo-map.json'), 'utf8'));
}

// ---- file inventory + capped reads ------------------------------------------
const APP_DIRS = ['components', 'pages', 'context', 'hooks', 'services', 'api', 'src', 'supabase/migrations'];
const APP_EXTS = new Set(['.ts', '.tsx', '.css', '.sql', '.json']);

export function listRepoFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) walk(fp);
      else if (APP_EXTS.has(path.extname(e.name))) out.push(path.relative(root, fp).replace(/\\/g, '/'));
    }
  };
  for (const d of APP_DIRS) { const fp = path.join(root, d); if (fs.existsSync(fp)) walk(fp); }
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (e.isFile() && APP_EXTS.has(path.extname(e.name)) && e.name !== 'package-lock.json') out.push(e.name);
  }
  return out.sort();
}

const MAX_PER_FILE = 60_000;   // chars – a file bigger than this is truncated with a marker
const MAX_TOTAL = 200_000;     // chars across all files handed to the builder (~50K tokens)

export function readFilesCapped(root, files) {
  const contents = {};
  let total = 0;
  for (const f of files) {
    const fp = path.join(root, f);
    if (!fs.existsSync(fp) || !fs.statSync(fp).isFile()) { contents[f] = '<<file not found>>'; continue; }
    let text = fs.readFileSync(fp, 'utf8');
    if (text.length > MAX_PER_FILE) text = text.slice(0, MAX_PER_FILE) + '\n<<truncated>>';
    if (total + text.length > MAX_TOTAL) { contents[f] = '<<omitted: file-content budget exhausted>>'; continue; }
    total += text.length;
    contents[f] = text;
  }
  return contents;
}

// ---- verify ------------------------------------------------------------------
export function verify(root) {
  const run = (cmd, args) => {
    try {
      execFileSync(cmd, args, { cwd: root, stdio: 'pipe', shell: process.platform === 'win32' });
      return { ok: true, errors: 0, out: '' };
    } catch (e) {
      const out = String((e.stdout || '') + (e.stderr || ''));
      return { ok: false, errors: (out.match(/error TS\d+/g) || []).length || 1, out };
    }
  };
  const tsc = run('npx', ['tsc', '--noEmit']);
  const build = run('npx', ['vite', 'build']);
  return { tsc: { ok: tsc.ok, errors: tsc.errors }, build: { ok: build.ok, errors: build.errors }, _logs: { tsc: tsc.out, build: build.out } };
}

// ---- transactional edit application ------------------------------------------
// All-or-nothing: if any edit in the batch fails, every file already touched is
// restored to its pre-batch state so a half-applied plan never reaches verify.
export function applyEdits(root, edits = []) {
  /** @type {Array<{ file: string, prev: string | null }>} prev=null means the file didn't exist */
  const snapshots = [];
  const snapshot = (fp, rel) => {
    if (snapshots.some((s) => s.file === rel)) return;
    snapshots.push({ file: rel, prev: fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : null });
  };
  const rollback = () => {
    for (const s of snapshots.reverse()) {
      const fp = path.join(root, s.file);
      if (s.prev === null) { if (fs.existsSync(fp)) fs.rmSync(fp); }
      else fs.writeFileSync(fp, s.prev);
    }
  };

  try {
    for (const e of edits) {
      const op = e.op || (e.oldText === '' ? 'create' : 'edit');
      const fp = path.join(root, e.file);

      if (op === 'delete') {
        if (!fs.existsSync(fp)) throw new Error(`delete: file not found: ${e.file}`);
        snapshot(fp, e.file);
        fs.rmSync(fp);
        continue;
      }

      if (op === 'create' || op === 'migration') {
        snapshot(fp, e.file);
        fs.mkdirSync(path.dirname(fp), { recursive: true });
        fs.writeFileSync(fp, e.newText);
        continue;
      }

      // op === 'edit'
      const s = fs.readFileSync(fp, 'utf8');
      const idx = s.indexOf(e.oldText);
      if (idx === -1) throw new Error(`edit oldText not found in ${e.file}`);
      if (s.indexOf(e.oldText, idx + 1) !== -1) throw new Error(`edit oldText not unique in ${e.file}`);
      snapshot(fp, e.file);
      fs.writeFileSync(fp, s.slice(0, idx) + e.newText + s.slice(idx + e.oldText.length));
    }
  } catch (err) {
    rollback();
    throw new Error(`applyEdits rolled back: ${err.message}`);
  }
}

// ---- agents ------------------------------------------------------------------

/** Cheap pass: which files does the builder need to read? */
export async function runScout({ task, repoMap, root, callFn = callModel }) {
  const ctx = {
    task,
    files: listRepoFiles(root),
    routes: repoMap.routes,
    srcManifest: repoMap.srcManifest,
    duplicateComponents: repoMap.duplicateComponents,
  };
  const out = parseJson(await callFn({
    tier: 'cheap',
    system: SCOUT,
    user: `Pick the files the builder must read for this task.\n\n${JSON.stringify(ctx, null, 2)}`,
    schema: SCOUT_SCHEMA,
    maxTokens: 2000,
  }));
  return { files: (out.files || []).slice(0, 8), notes: out.notes || '' };
}

export async function runBuilder({ task, repoMap, scoutFiles = [], root, priorFindings = [], verifyLog = '', callFn = callModel }) {
  // Files named in open findings are load-bearing on a retry – make sure the
  // builder can see them even if the scout didn't pick them.
  const files = [...new Set([...scoutFiles, ...priorFindings.map((f) => f.location?.file).filter(Boolean)])];
  const fileContents = root ? readFilesCapped(root, files) : {};

  // Split stable context (cached across attempts) from volatile context.
  const stable = {
    conventions: repoMap.conventions,
    srcManifest: repoMap.srcManifest,
    duplicateComponents: repoMap.duplicateComponents,
  };
  const volatile = {
    task,
    fileContents,
    blockingFindings: priorFindings,
    verifyErrors: verifyLog,
  };
  return parseJson(await callFn({
    tier: 'strong',
    system: BUILDER,
    user: [
      { text: `Repo-map context (stable):\n${JSON.stringify(stable, null, 2)}`, cache: true },
      { text: `Task, file contents, and open findings:\n${JSON.stringify(volatile, null, 2)}\n\nReturn the edits JSON only.` },
    ],
    schema: EDITS_SCHEMA,
  }));
}

export async function runReview({ edits, repoMap, blastRadius = [], changedFiles = [], callFn = callModel }) {
  const lensesRun = lensesForChange(blastRadius, changedFiles);
  const reviewLenses = lensesRun.filter((l) => l !== 'verify' && l !== 'build' && LENS_PROMPTS[l]);
  // Seed only the violations that live in files this change touched – pre-existing
  // violations elsewhere in the repo are real, but they aren't this task's blockers.
  const norm = (p) => String(p || '').replace(/\\/g, '/');
  const touched = new Set(changedFiles.map(norm));
  const relevantViolations = (repoMap.ruleViolations || []).filter((v) => touched.has(norm(v.file)));
  const seedFindings = findingsFromRepoMapViolations(relevantViolations);
  const strongLenses = new Set(['security', 'migration']);

  // Lenses are independent – run them in parallel.
  const results = await Promise.all(reviewLenses.map(async (l) => {
    // migration lens only sees migration edits; others see everything
    const scopedEdits = l === 'migration'
      ? edits.filter((e) => /supabase\/migrations\/.*\.sql$/i.test(e.file))
      : edits;
    const out = parseJson(await callFn({
      tier: strongLenses.has(l) ? 'strong' : 'cheap',
      system: LENS_PROMPTS[l],
      user: `Edits under review, plus the change's blastRadius. Return the findings JSON only.\n\n${JSON.stringify({ edits: scopedEdits, blastRadius }, null, 2)}`,
      schema: FINDINGS_SCHEMA,
    }));
    // schema wraps findings in an object; older mocks may return a bare array
    return Array.isArray(out) ? out : (out.findings || []);
  }));

  return { lensesRun, findings: seedFindings.concat(...results) };
}

function parseJson(s) {
  if (typeof s === 'object' && s !== null) return s;
  const fenced = String(s).match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = (fenced ? fenced[1] : s).trim();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('model did not return valid JSON: ' + text.slice(0, 200));
  }
}
