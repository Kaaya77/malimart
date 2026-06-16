#!/usr/bin/env node
/*
 * generate-repo-map.mjs  –  MaliMart repo map generator
 *
 * Builds repo-map.json: a compact, machine-generated index that agents load
 * INSTEAD of re-scanning the codebase on every task. Lookups replace exploration.
 *
 * Zero dependencies. Deterministic. Run from the repo root:
 *     node scripts/generate-repo-map.mjs
 *
 * Flags (all optional):
 *     --root   <dir>      repo root to scan            (default: cwd)
 *     --routes <file>     router file with <Route>s    (default: <root>/App.tsx)
 *     --schema <file.sql> Supabase schema dump          (default: first *.sql under root)
 *     --out    <file>     output path                  (default: <root>/repo-map.json)
 *
 * Also writes a short human digest next to the JSON (repo-map.md).
 */

import fs from 'node:fs';
import path from 'node:path';

const args = parseArgs(process.argv.slice(2));
const ROOT = path.resolve(args.root || process.cwd());
const OUT = path.resolve(args.out || path.join(ROOT, 'repo-map.json'));
const LIVE_DIRS = ['components', 'pages', 'context', 'hooks', 'services'];

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) o[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return o;
}

const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };
const rel = (p) => path.relative(ROOT, p) || path.basename(p);

function walk(dir, exts) {
  const out = [];
  if (!exists(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(fp, exts));
    else if (!exts || exts.includes(path.extname(e.name))) out.push(fp);
  }
  return out;
}

// ---------- routes ----------
function routesFile() { return path.resolve(args.routes || path.join(ROOT, 'App.tsx')); }

function scanRoutes() {
  const src = read(routesFile());
  if (!src) return [];
  const lazyMap = {};
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*lazy\(\(\)\s*=>\s*import\('([^']+)'\)/g)) lazyMap[m[1]] = m[2];

  const routes = [];
  for (const m of src.matchAll(/<Route\s+path="([^"]+)"\s+element=\{([\s\S]*?)\}\s*\/>/g)) {
    const routePath = m[1];
    const el = m[2];
    const role = (el.match(/requiredRole="(\w+)"/) || [])[1] || null;
    const authRequired = /RouteGuard/.test(el);
    const comps = [...el.matchAll(/<([A-Z]\w+)\b/g)].map((x) => x[1]).filter((n) => n !== 'RouteGuard' && n !== 'Navigate');
    const pages = comps.filter((c) => lazyMap[c]).map((c) => ({ component: c, file: lazyMap[c] }));
    routes.push({
      path: routePath,
      kind: pages.length ? 'page' : 'redirect',
      authRequired,
      role,
      pages,
      blastRadius: blastFor(routePath, role, authRequired),
    });
  }
  return routes;
}

function blastFor(p, role, auth) {
  const tags = new Set();
  if (auth) tags.add('auth');
  if (role) tags.add('role:' + role);
  if (/checkout|order|receipt|confirmation|cart|payment/i.test(p)) tags.add('payments');
  if (/buyer|seller|admin|orders|messages|notifications|settings|dashboard/i.test(p)) tags.add('cross-user');
  return [...tags];
}

// ---------- schema ----------
function schemaFile() {
  if (args.schema) return path.resolve(args.schema);
  const sqls = walk(ROOT, ['.sql']);
  return sqls.find((f) => /schema|database|public/i.test(path.basename(f))) || sqls[0] || null;
}

function scanSchema() {
  const f = schemaFile();
  const sql = f && read(f);
  if (!sql) return [];
  const tables = [];
  const blocks = sql.split(/CREATE TABLE /).slice(1);
  for (const b of blocks) {
    const end = b.indexOf('\n);');
    const head = end > -1 ? b.slice(0, end) : b;
    const name = (head.match(/^(?:\w+\.)?(\w+)/) || [])[1];
    if (!name) continue;
    const foreignKeys = [...head.matchAll(/FOREIGN KEY \(([^)]+)\) REFERENCES (?:\w+\.)?(\w+)/g)].map((m) => ({
      column: m[1].trim(),
      refTable: m[2],
    }));
    const primaryKey = ((head.match(/PRIMARY KEY \(([^)]+)\)/) || [])[1] || '')
      .split(',').map((s) => s.trim()).filter(Boolean);
    const profileFks = foreignKeys.filter((fk) => fk.refTable === 'profiles').length;
    const multiParty = /\b(seller_id|buyer_id|sender_id|receiver_id|referrer_id|referee_id|blocker_id|blocked_id|assigned_to|recorded_by|performed_by|changed_by|created_by)\b/.test(head);
    const crossUser = profileFks >= 2 || multiParty;
    const money = /\b(payment|payout|wallet|commission|amount|balance|refund|total|subtotal|net_payout|price|fee)\b/i.test(name + ' ' + head);
    const sensitiveColumns = [...new Set(
      [...head.matchAll(/^\s*(\w+)\s+\w/gm)].map((m) => m[1])
        .filter((c) => /(price|amount|balance|commission|payout|wallet|refund|total|fee|phone|email|ip_address|tin|account_number|bank|password|token|address)/i.test(c))
    )];
    tables.push({ name, primaryKey, foreignKeys, crossUser, money, sensitiveColumns });
  }
  return tables;
}

// ---------- services: rpcs + rule violations ----------
function scanServices() {
  const rpcs = {};
  for (const f of walk(path.join(ROOT, 'services'), ['.ts', '.tsx'])) {
    const s = read(f) || '';
    for (const m of s.matchAll(/\.rpc\(\s*['"]([^'"]+)['"]/g)) {
      (rpcs[m[1]] = rpcs[m[1]] || { name: m[1], calledFrom: new Set() }).calledFrom.add(rel(f));
    }
  }
  const violations = [];
  const surfaces = [...walk(path.join(ROOT, 'components'), ['.tsx', '.ts']), ...walk(path.join(ROOT, 'pages'), ['.tsx', '.ts'])];
  for (const f of surfaces) {
    const s = read(f) || '';
    for (const m of s.matchAll(/supabase\s*\.\s*from\(\s*['"]([^'"]+)['"]/g)) {
      violations.push({ file: rel(f), table: m[1], rule: 'no-direct-supabase-from-in-component' });
    }
  }
  return { rpcs: Object.values(rpcs).map((r) => ({ name: r.name, calledFrom: [...r.calledFrom] })), violations };
}

// ---------- duplicate components ----------
function scanDuplicates() {
  const map = {};
  const add = (f, zone) => {
    const base = path.basename(f).replace(/\.(tsx|ts)$/, '');
    (map[base] = map[base] || []).push({ file: rel(f), zone });
  };
  for (const f of walk(path.join(ROOT, 'components'), ['.tsx', '.ts'])) add(f, 'live');
  for (const f of walk(path.join(ROOT, 'src'), ['.tsx', '.ts'])) add(f, 'src');
  const dups = [];
  for (const [name, locs] of Object.entries(map)) {
    if (locs.length > 1) {
      const canonical = (locs.find((l) => l.zone === 'live') || locs[0]).file;
      dups.push({ name, canonical, all: locs.map((l) => l.file) });
    }
  }
  return dups;
}

// ---------- /src load-bearing manifest ----------
function scanSrcManifest() {
  const referenced = new Set();
  const liveFiles = [
    ...LIVE_DIRS.flatMap((d) => walk(path.join(ROOT, d), ['.ts', '.tsx'])),
    ...(exists(routesFile()) ? [routesFile()] : []),
  ];
  for (const f of liveFiles) {
    const s = read(f) || '';
    for (const m of s.matchAll(/from\s+['"]((?:\.\/|\.\.\/)?src\/[^'"]+)['"]/g)) {
      referenced.add(m[1].replace(/^\.\.?\//, ''));
    }
  }
  return {
    loadBearing: [...referenced].sort(),
    note: '/src is otherwise a stale twin; only these files are imported by the live app.',
  };
}

// ---------- UI primitives ----------
function scanUiPrimitives() {
  const s = read(path.join(ROOT, 'components', 'UI.tsx'));
  if (!s) return [];
  const names = new Set();
  for (const m of s.matchAll(/export\s+(?:const|function|class)\s+(\w+)/g)) names.add(m[1]);
  for (const m of s.matchAll(/export\s*\{([^}]+)\}/g)) {
    m[1].split(',').forEach((n) => { const c = n.trim().split(/\s+as\s+/)[0].trim(); if (c) names.add(c); });
  }
  return [...names].sort();
}

// ---------- assemble ----------
const svc = scanServices();
const map = {
  generatedAt: new Date().toISOString(),
  root: path.relative(process.cwd(), ROOT) || '.',
  coverage: {
    routes: exists(routesFile()),
    schema: !!schemaFile(),
    services: exists(path.join(ROOT, 'services')),
    components: exists(path.join(ROOT, 'components')),
    src: exists(path.join(ROOT, 'src')),
    ui: exists(path.join(ROOT, 'components', 'UI.tsx')),
  },
  conventions: {
    liveAppDirs: LIVE_DIRS,
    srcStatus: 'partial dead twin – NOT the live app',
    securityModel:
      'RLS is the only boundary; public anon key is expected. Cross-user data goes through services/accountApi.ts or approved RPCs – never supabase.from(...) in components.',
  },
  srcManifest: scanSrcManifest(),
  routes: scanRoutes(),
  tables: scanSchema(),
  rpcs: svc.rpcs,
  ruleViolations: svc.violations,
  duplicateComponents: scanDuplicates(),
  uiPrimitives: scanUiPrimitives(),
};

fs.writeFileSync(OUT, JSON.stringify(map, null, 2));
fs.writeFileSync(OUT.replace(/\.json$/, '.md'), digest(map));

// ---------- human digest ----------
function digest(m) {
  const crossUser = m.tables.filter((t) => t.crossUser).map((t) => t.name);
  const money = m.tables.filter((t) => t.money).map((t) => t.name);
  const byRole = (r) => m.routes.filter((x) => x.role === r).map((x) => x.path).join(', ') || '–';
  const cov = Object.entries(m.coverage).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none';
  const skipped = Object.entries(m.coverage).filter(([, v]) => !v).map(([k]) => k).join(', ') || 'none';
  return [
    '# MaliMart repo map (digest)',
    `Generated ${m.generatedAt}`,
    '',
    `Scanned: ${cov}.  Skipped (source not found at this root): ${skipped}.`,
    '',
    `Routes: ${m.routes.length}  ·  Tables: ${m.tables.length}  ·  RPCs: ${m.rpcs.length}  ·  Duplicate components: ${m.duplicateComponents.length}  ·  Rule violations: ${m.ruleViolations.length}`,
    '',
    `Admin routes: ${byRole('admin')}`,
    `Seller routes: ${byRole('seller')}`,
    `Buyer routes: ${byRole('buyer')}`,
    '',
    `Cross-user tables (security lens MUST review changes here): ${crossUser.join(', ') || '–'}`,
    `Money tables: ${money.join(', ') || '–'}`,
    m.ruleViolations.length
      ? '\nRULE VIOLATIONS – direct supabase.from(...) in a component/page:\n' +
        m.ruleViolations.map((v) => `  - ${v.file} → ${v.table}`).join('\n')
      : '\nNo direct-query rule violations found.',
    '',
    `Load-bearing /src files: ${m.srcManifest.loadBearing.join(', ') || '(run at repo root to populate)'}`,
    '',
  ].join('\n');
}

const c = map.coverage;
console.log(
  `repo-map.json written to ${OUT}\n` +
    `  routes ${map.routes.length}${c.routes ? '' : ' (no router file)'} · ` +
    `tables ${map.tables.length}${c.schema ? '' : ' (no schema)'} · ` +
    `rpcs ${map.rpcs.length} · dup ${map.duplicateComponents.length} · violations ${map.ruleViolations.length}`
);
