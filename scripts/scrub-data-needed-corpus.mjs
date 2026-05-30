#!/usr/bin/env node
/**
 * scrub-data-needed-corpus.mjs — corpus-wide scrub of every string value in
 * every portal. Removes [DATA_NEEDED: ...] / (DATA_NEEDED: ...) / bare
 * DATA_NEEDED tokens from intelligenceCycle, financialHealth, portalRelevance,
 * warningSignals — everywhere they bled into operator-facing prose. Skips
 * structural ID fields (slug, cik, ticker, schemaVersion).
 *
 *   node scripts/scrub-data-needed-corpus.mjs            # dry-run
 *   node scripts/scrub-data-needed-corpus.mjs --apply
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, '..', 'assets', 'data', 'companies');
const APPLY = process.argv.includes('--apply');
const SKIP_KEYS = new Set(['slug', 'cik', 'ticker', 'sic', 'schemaVersion', 'type', 'companyId', 'domainId']);

function scrubString(s) {
  return String(s)
    .replace(/\s*\[DATA_NEEDED[:\s][^\]]*\]\s*/g, ' ')
    .replace(/\s*\(DATA_NEEDED[:\s][^)]*\)\s*/g, ' ')
    .replace(/\s*\[?DATA_NEEDED[:\s]?[^\s,.;\]]*\s*/g, ' ')
    .replace(/\s*#\s*$/g, '')
    .replace(/\s*[:,;]\s*$/g, '.')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\.{2,}/g, '.')
    .trim();
}
function walkScrub(node, parentKey) {
  if (node == null) return { node, changes: 0 };
  if (typeof node === 'string') {
    if (parentKey && SKIP_KEYS.has(parentKey)) return { node, changes: 0 };
    if (!/DATA_NEEDED/.test(node)) return { node, changes: 0 };
    const scrubbed = scrubString(node);
    return { node: scrubbed, changes: 1 };
  }
  if (Array.isArray(node)) {
    let n = 0;
    const out = node.map(v => { const r = walkScrub(v, parentKey); n += r.changes; return r.node; });
    return { node: out, changes: n };
  }
  if (typeof node === 'object') {
    let n = 0;
    for (const k of Object.keys(node)) { const r = walkScrub(node[k], k); n += r.changes; node[k] = r.node; }
    return { node, changes: n };
  }
  return { node, changes: 0 };
}

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
let portalsTouched = 0, fieldsScrubbed = 0;
for (const f of files) {
  let p; try { p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { continue; }
  const { node, changes } = walkScrub(p);
  if (changes > 0) {
    portalsTouched++;
    fieldsScrubbed += changes;
    if (APPLY) fs.writeFileSync(path.join(DIR, f), JSON.stringify(node, null, 2));
  }
}
console.log('=== corpus-wide DATA_NEEDED scrub ' + (APPLY ? '(APPLIED)' : '(DRY RUN)') + ' ===');
console.log('portals scanned:', files.length);
console.log('portals touched:', portalsTouched, '| string fields scrubbed:', fieldsScrubbed);
if (!APPLY) console.log('\n(dry run — re-run with --apply to write)');
