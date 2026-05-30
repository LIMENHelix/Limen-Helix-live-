#!/usr/bin/env node
/**
 * strip-placeholder-portals.mjs — remove [DATA_NEEDED:] entries; delete portals
 * left too thin.
 *
 * Two passes over every portal:
 *   (a) strip any functionalNetwork entry whose `name` begins with "[DATA_NEEDED"
 *       (purely fake entry — no real entity behind it).
 *   (b) after strip, if fnTotal < MIN_FN_ENTRIES the portal is placeholder soup
 *       with nothing real left — DELETE it. Conditional COMPANY PORTAL button
 *       + hp=false on the eligible board renders the missing-portal state
 *       honestly (no dead link).
 *
 * Read-only by default (--dry-run is implicit); use --apply to write.
 *
 *   node scripts/strip-placeholder-portals.mjs              # dry-run
 *   node scripts/strip-placeholder-portals.mjs --apply
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, '..', 'assets', 'data', 'companies');
const APPLY = process.argv.includes('--apply');
const MIN_FN_ENTRIES = 20;            // below this after strip = delete (a portal w/ <20 real-entity edges isn't a portal, it's a stub)

const arrOf = x => Array.isArray(x) ? x : (x && typeof x === 'object' ? [x] : []);
const isPlaceholderName = n => /^\s*\[?DATA_NEEDED/i.test(String(n || ''));
const countDN = s => (String(s || '').match(/DATA_NEEDED/g) || []).length;
const entryDN = e => countDN(e && e.name) + countDN(e && e.relationshipNote) + countDN(e && e.brainNodeRole);
// scrub bracketed placeholders from kept notes: "...represents [DATA_NEEDED: % of revenue]..." -> "...represents..."
function scrubNote(s) {
  if (!s) return s;
  return String(s)
    .replace(/\s*\[DATA_NEEDED:[^\]]*\]\s*/g, ' ')   // [DATA_NEEDED: ...]
    .replace(/\s*\(DATA_NEEDED:[^)]*\)\s*/g, ' ')    // (DATA_NEEDED: ...)
    .replace(/\bDATA_NEEDED\b/g, '')                 // bare DATA_NEEDED tokens
    .replace(/#\s*$/g, '')                            // dangling "#" from "license #[..]"
    .replace(/:\s*$/g, '')                            // dangling ":"
    .replace(/\s+/g, ' ')                             // collapse whitespace
    .replace(/\s+\./g, '.')
    .replace(/\s+,/g, ',')
    .trim();
}

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
let portalsStripped = 0, portalsDeleted = 0, entriesStripped = 0, totalSurvived = 0;
const deletions = [], strips = [];

for (const f of files) {
  let p; try { p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { continue; }
  const slug = f.replace(/\.json$/, '');
  const fn = p.functionalNetwork || {};
  let stripped = 0;
  for (const cat in fn) {
    const arr = arrOf(fn[cat]);
    const keep = [];
    for (const e of arr) {
      if (!e || typeof e !== 'object') { keep.push(e); continue; }
      // strip if name is placeholder OR the entry's TEXT is mostly DATA_NEEDED
      // (≥3 DATA_NEEDED markers in name+note+role = the model didn't really know
      // anything specific — keeping it would be fabrication-by-omission).
      if (isPlaceholderName(e.name) || entryDN(e) >= 3) { stripped++; continue; }
      // entry survives; SCRUB residual [DATA_NEEDED: ...] from the note (and role)
      if (e.relationshipNote) e.relationshipNote = scrubNote(e.relationshipNote);
      if (e.brainNodeRole) e.brainNodeRole = scrubNote(e.brainNodeRole);
      keep.push(e);
    }
    fn[cat] = keep;
  }
  const fnTotal = Object.values(fn).reduce((s, v) => s + arrOf(v).length, 0);
  if (stripped === 0) { totalSurvived++; continue; }
  if (fnTotal < MIN_FN_ENTRIES) {
    portalsDeleted++;
    deletions.push({ slug, name: p.name, fnAfter: fnTotal, stripped });
    if (APPLY) fs.unlinkSync(path.join(DIR, f));
  } else {
    portalsStripped++;
    entriesStripped += stripped;
    strips.push({ slug, fnAfter: fnTotal, stripped });
    if (APPLY) fs.writeFileSync(path.join(DIR, f), JSON.stringify(p, null, 2));
  }
}

console.log('=== strip-placeholder-portals ' + (APPLY ? '(APPLIED)' : '(DRY RUN)') + ' ===');
console.log('portals scanned:', files.length);
console.log('untouched (no placeholder entries):', totalSurvived);
console.log('portals STRIPPED (kept, ≥' + MIN_FN_ENTRIES + ' fn after strip):', portalsStripped, '| total entries stripped:', entriesStripped);
console.log('portals DELETED (fn dropped below', MIN_FN_ENTRIES + ' after strip):', portalsDeleted);
console.log('\nDELETIONS (sample 25):');
deletions.sort((a, b) => a.fnAfter - b.fnAfter).slice(0, 25).forEach(d => console.log('  ' + d.slug.padEnd(40) + ' fn-after=' + d.fnAfter + ' stripped=' + d.stripped + '   "' + (d.name || '') + '"'));
console.log('\nSTRIPS (sample 25 by most-stripped):');
strips.sort((a, b) => b.stripped - a.stripped).slice(0, 25).forEach(s => console.log('  ' + s.slug.padEnd(40) + ' stripped=' + s.stripped + '  fn-remaining=' + s.fnAfter));
if (!APPLY) console.log('\n(dry run — re-run with --apply to write)');
