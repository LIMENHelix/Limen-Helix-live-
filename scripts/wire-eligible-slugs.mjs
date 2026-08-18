#!/usr/bin/env node
/**
 * wire-eligible-slugs.mjs — wire command-board-eligible.json to portal corpus.
 *
 * For each company in command-board-eligible.json:
 *  - if a portal exists with matching CIK, set `s` to that portal's canonical
 *    slug (fixes the stale ticker-slug pointers — same mechanism wire-cb-slugs.mjs
 *    used on command-board-data.json).
 *  - set `hp` (hasPortal) = true/false so the board can conditionally render the
 *    COMPANY PORTAL button (no dead links during the eligible-portal build).
 *
 * Idempotent — re-run after each generation batch to pick up newly-built portals.
 *
 *   node scripts/wire-eligible-slugs.mjs --dry-run
 *   node scripts/wire-eligible-slugs.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveCompanyPortalSlug } from './_resolve-company-portal-slug.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'assets', 'data', 'companies');
const ELIG_PATH = path.join(ROOT, 'assets', 'data', 'command-board-eligible.json');
const ALIAS_PATH = path.join(ROOT, 'assets', 'data', 'company-aliases.json');
const DRY = process.argv.includes('--dry-run');

const norm = c => String(c == null ? '' : c).replace(/^0+/, '') || '0';
const has = s => fs.existsSync(path.join(DIR, s + '.json'));
let ALIAS = {};
try { ALIAS = JSON.parse(fs.readFileSync(ALIAS_PATH, 'utf8')).aliases || {}; } catch (e) {}

// cik -> canonical portal slug (by filename)
const c2s = {};
for (const f of fs.readdirSync(DIR)) {
  if (!f.endsWith('.json') || f.startsWith('_')) continue;
  try { const p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); if (p.cik) c2s[norm(p.cik)] = f.replace(/\.json$/, ''); } catch (e) {}
}

const elig = JSON.parse(fs.readFileSync(ELIG_PATH, 'utf8'));
const co = elig.companies || [];
let slugFixed = 0, hpTrue = 0, hpFalse = 0;
for (const r of co) {
  const cikSlug = c2s[norm(r.c)];
  const directOrAliasSlug = resolveCompanyPortalSlug(r.s, ALIAS, has);
  const eff = cikSlug || directOrAliasSlug;
  if (eff && r.s !== eff) { r.s = eff; slugFixed++; }
  const hp = !!eff;
  if (r.hp !== hp) { r.hp = hp; }
  if (hp) hpTrue++; else hpFalse++;
}
console.log('eligible companies:', co.length, '| hasPortal=true:', hpTrue, '| hasPortal=false:', hpFalse, '| slugs fixed:', slugFixed);
if (DRY) { console.log('(dry run — no write)'); }
else { fs.writeFileSync(ELIG_PATH, JSON.stringify(elig)); console.log('command-board-eligible.json written.'); }
