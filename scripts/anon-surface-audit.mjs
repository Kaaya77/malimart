#!/usr/bin/env node
// Audits what the PUBLIC (anonymous) API surface actually returns, over real
// HTTP, and fails if it drifts from scripts/anon-surface.expected.json.
//
// Complements supabase/tests/rls_invariants.sql:
//   - the SQL file asserts privilege/RLS invariants in the catalogs
//     (needs a DB connection)
//   - this file asserts the OBSERVABLE result as an anonymous caller
//     (needs only the anon key, which is public by design — so it runs in
//     CI with no secrets)
//
// READ-ONLY. It issues GETs only. It never probes writes: a write probe
// against production risks mutating real data if an assumption is wrong, and
// the catalog invariants already cover write privileges.
//
//   node scripts/anon-surface-audit.mjs
//   node scripts/anon-surface-audit.mjs --update   # re-baseline after an
//                                                  # intentional change
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXPECTED_PATH = join(HERE, 'anon-surface.expected.json');

// Same fallbacks vite.config.ts bakes in. The anon key is meant to be public;
// RLS is the boundary, not key secrecy.
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://ubpapxdmqlepynonhaeo.supabase.co';
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVicGFweGRtcWxlcHlub25oYWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0ODU2NTQsImV4cCI6MjA4MTA2MTY1NH0.kjkY_jrvek-7pp2KWQytVzxxK9LL2SL1sPhsMLnGBSY';

const UPDATE = process.argv.includes('--update');

/** Classify what an anonymous GET actually yields. */
async function probe(relation) {
  const url = `${SUPABASE_URL}/rest/v1/${relation}?select=*&limit=1`;
  let res;
  try {
    res = await fetch(url, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
  } catch (err) {
    return { status: 'network-error', detail: String(err.message || err) };
  }

  // 401/403 => no privilege at all. 404 => not exposed via PostgREST.
  if (res.status === 401 || res.status === 403) return { status: 'denied' };
  if (res.status === 404) return { status: 'not-exposed' };
  if (!res.ok) return { status: `http-${res.status}` };

  let body;
  try {
    body = await res.json();
  } catch {
    return { status: 'unparseable' };
  }
  if (!Array.isArray(body)) return { status: 'unexpected-shape' };

  // A grant can exist while RLS returns nothing — that is a meaningfully
  // different posture from actually handing out rows, so distinguish them.
  return body.length === 0
    ? { status: 'readable-empty' }
    : { status: 'readable-rows', columns: Object.keys(body[0]).sort() };
}

async function main() {
  const expected = JSON.parse(readFileSync(EXPECTED_PATH, 'utf8'));
  const relations = Object.keys(expected.relations).sort();

  const actual = {};
  for (const rel of relations) {
    actual[rel] = await probe(rel);
  }

  if (UPDATE) {
    writeFileSync(
      EXPECTED_PATH,
      JSON.stringify({ ...expected, relations: actual }, null, 2) + '\n',
    );
    console.log(`Re-baselined ${relations.length} relations -> ${EXPECTED_PATH}`);
    return;
  }

  const failures = [];
  for (const rel of relations) {
    const want = expected.relations[rel];
    const got = actual[rel];

    if (want.status !== got.status) {
      failures.push(
        `${rel}: expected "${want.status}", got "${got.status}"` +
          (got.detail ? ` (${got.detail})` : ''),
      );
      continue;
    }
    // Column-level drift matters: a widened view leaks fields without
    // changing its readable/denied status at all.
    if (want.columns) {
      const added = (got.columns || []).filter((c) => !want.columns.includes(c));
      if (added.length) {
        failures.push(
          `${rel}: now exposes NEW columns to anonymous callers: ${added.join(', ')}`,
        );
      }
    }
  }

  if (failures.length) {
    console.error(
      `\nAnonymous API surface drifted (${failures.length} problem(s)):\n` +
        failures.map((f) => `  - ${f}`).join('\n') +
        `\n\nIf this change is intentional, re-baseline with:\n` +
        `  node scripts/anon-surface-audit.mjs --update\n`,
    );
    process.exit(1);
  }

  console.log(`Anonymous API surface OK (${relations.length} relations checked).`);
}

main().catch((err) => {
  console.error('anon-surface-audit failed to run:', err);
  process.exit(1);
});
