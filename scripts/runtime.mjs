/*
 * runtime.mjs – the workers. Deterministic plumbing around the model calls.
 *   loadRepoMap  – read repo-map.json
 *   verify       – run tsc --noEmit + vite build, return the contract's VerifyResult + logs
 *   applyEdits   – apply the builder's {file, oldText, newText} edits (str_replace-style)
 *   runBuilder   – call the builder, get edits JSON
 *   runReview    – run the conditional lenses + fold repo-map rule violations into findings
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { callModel } from './model-adapter.mjs';
import { BUILDER, LENS_PROMPTS } from './prompts.mjs';
import { lensesForChange, findingsFromRepoMapViolations } from './findings-contract.mjs';

export function loadRepoMap(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'repo-map.json'), 'utf8'));
}

export function verify(root) {
  const run = (cmd, args) => {
    try {
      execFileSync(cmd, args, { cwd: root, stdio: 'pipe' });
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

export function applyEdits(root, edits = []) {
  for (const e of edits) {
    const fp = path.join(root, e.file);
    if (e.oldText === '') {
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, e.newText);
      continue;
    }
    const s = fs.readFileSync(fp, 'utf8');
    const idx = s.indexOf(e.oldText);
    if (idx === -1) throw new Error(`edit oldText not found in ${e.file}`);
    if (s.indexOf(e.oldText, idx + 1) !== -1) throw new Error(`edit oldText not unique in ${e.file}`);
    fs.writeFileSync(fp, s.slice(0, idx) + e.newText + s.slice(idx + e.oldText.length));
  }
}

export async function runBuilder({ task, repoMap, priorFindings = [], verifyLog = '', callFn = callModel }) {
  const ctx = {
    task,
    conventions: repoMap.conventions,
    srcManifest: repoMap.srcManifest,
    duplicateComponents: repoMap.duplicateComponents,
    blockingFindings: priorFindings,
    verifyErrors: verifyLog,
  };
  const user = `Task and repo-map context below. Return the edits JSON only.\n\n${JSON.stringify(ctx, null, 2)}`;
  return parseJson(await callFn({ tier: 'strong', system: BUILDER, user }));
}

export async function runReview({ edits, repoMap, blastRadius = [], changedFiles = [], callFn = callModel }) {
  const lensesRun = lensesForChange(blastRadius, changedFiles);
  const reviewLenses = lensesRun.filter((l) => l !== 'verify' && l !== 'build');
  let findings = findingsFromRepoMapViolations(repoMap.ruleViolations || []);
  for (const l of reviewLenses) {
    const system = LENS_PROMPTS[l];
    if (!system) continue;
    const user = `Edits under review, plus the change's blastRadius. Return a JSON array of Finding objects only.\n\n${JSON.stringify({ edits, blastRadius }, null, 2)}`;
    const arr = parseJson(await callFn({ tier: l === 'security' ? 'strong' : 'cheap', system, user }));
    if (Array.isArray(arr)) findings = findings.concat(arr);
  }
  return { lensesRun, findings };
}

function parseJson(s) {
  const fenced = String(s).match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = (fenced ? fenced[1] : s).trim();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('model did not return valid JSON: ' + text.slice(0, 200));
  }
}
