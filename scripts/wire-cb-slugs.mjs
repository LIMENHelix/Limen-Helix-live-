#!/usr/bin/env node
/**
 * wire-cb-slugs.mjs — point command-board rows at the canonical portal slug.
 *
 * After build-fractal-portals.mjs writes assets/data/companies/<slug>.json, the
 * command board still links each row by its `s` field, which is ticker-derived
 * (a / cold / bax) and does NOT match the name-based portal slug. This re-points
 * `s` to the portal slug so the command-board click resolves the new deep portal.
 *
 * Matching: a CB row is updated when its CIK matches the portal's cik (primary),
 * OR its ticker matches the portal's ticker (fans out to cross-domain duplicate
 * rows — e.g. the two NICE Ltd rows in law + governance both point to nice_ltd).
 * Idempotent: only rows whose `s` actually differs are touched.
 *
 * Scope is limited to slugs produced in this build (read from the build log's
 * status:ok lines) so the CB diff stays small and inspectable — it does NOT
 * re-slug the entire board.
 *
 *   node scripts/wire-cb-slugs.mjs --dry-run
 *   node scripts/wire-cb-slugs.mjs                 # writes
 *   node scripts/wire-cb-slugs.mjs --slugs a,b,c   # explicit slug list
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'assets', 'data', 'companies');
const CB_PATH = path.join(ROOT, 'assets', 'data', 'command-board-data.json');
const LOG_PATH = path.join(__dirname, '_fractal-build-log.jsonl');

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const getArg = (n) => { const i = args.indexOf('--' + n); return i === -1 ? null : args[i + 1]; };
const normCik = c => String(c == null ? '' : c).replace(/^0+/, '') || '0';

function slugsFromLog() {
  const set = new Set();
  try {
    for (const line of fs.readFileSync(LOG_PATH, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { const o = JSON.parse(line); if (o.status === 'ok' && o.slug) set.add(o.slug); } catch (e) {}
    }
  } catch (e) {}
  return [...set];
}

const explicit = getArg('slugs');
const slugs = explicit ? explicit.split(',').map(s => s.trim()).filter(Boolean) : slugsFromLog();

// load portal identity for each target slug
const portals = [];
for (const slug of slugs) {
  const fp = path.join(DIR, slug + '.json');
  if (!fs.existsSync(fp)) { console.log(`  (skip ${slug}: no portal file)`); continue; }
  try { const p = JSON.parse(fs.readFileSync(fp, 'utf8')); portals.push({ slug, cik: normCik(p.cik), ticker: (p.ticker || '').toUpperCase() }); } catch (e) {}
}

const cb = JSON.parse(fs.readFileSync(CB_PATH, 'utf8'));
const rows = cb.companies || [];
const changes = [];
for (const p of portals) {
  for (const r of rows) {
    const cikMatch = p.cik !== '0' && normCik(r.c) === p.cik;
    const tickMatch = p.ticker && (r.t || '').toUpperCase() === p.ticker;
    if ((cikMatch || tickMatch) && r.s !== p.slug) {
      changes.push({ name: r.n, from: r.s, to: p.slug, via: cikMatch ? 'cik' : 'ticker', d: r.d });
      if (!DRY) r.s = p.slug;
    }
  }
}

console.log(`=== wire-cb-slugs ${DRY ? '(DRY RUN)' : ''} ===`);
console.log(`portals considered: ${portals.length}  CB rows: ${rows.length}  changes: ${changes.length}`);
for (const c of changes) console.log(`  ${c.name} [${c.d}]: s '${c.from}' -> '${c.to}'  (via ${c.via})`);
if (!DRY && changes.length) { fs.writeFileSync(CB_PATH, JSON.stringify(cb)); console.log('\ncommand-board-data.json written.'); }
else if (DRY) console.log('\n(dry run — no write)');
