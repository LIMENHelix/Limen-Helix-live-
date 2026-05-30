#!/usr/bin/env node
/**
 * fix-fn-category-bleed.mjs — re-slot pure-misslot competitors into competitors.
 *
 * The enricher sometimes puts a competitor in the suppliers/customers/
 * logisticsPartners/capitalProviders slot. That mislabels stress-propagation
 * edge weights (supplier 0.85 vs competitor). This MOVES entries whose note
 * frames them ONLY as a competitor (no supply/customer/capital role verb) into
 * the competitors[] category. Entries that show BOTH roles (genuine coopetition,
 * e.g. "supplier of reagents AND a competitor") are LEFT in place — that
 * multi-role signal is intentional (corpus-richness).
 *
 * Move = remove from wrong slot, add to competitors[] (skip if slug already
 * there), set neuralRole 'Peer', tag _reslottedFrom for audit. brainNodeId is
 * left as-is (not guessing node bindings).
 *
 *   node scripts/fix-fn-category-bleed.mjs            # dry-run (default)
 *   node scripts/fix-fn-category-bleed.mjs --apply
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, '..', 'assets', 'data', 'companies');
const APPLY = process.argv.includes('--apply');

const NON_COMPETE_SLOTS = ['suppliers', 'customers', 'logisticsPartners', 'capitalProviders'];
const STRONG_COMPETE_RE = /\b(is\s+(?:a|the|one\s+of)\s+[^.]*\bcompetitor|competitor\s+(?:in|to|of)|competes\s+(?:directly\s+)?(?:with|in|against))/i;
const ROLE_RE = {
  suppliers: /\b(suppl(?:ies|ier|y)|provides|sources?\s+from|manufactures?\s+for|ships?\s+to\s+\w|raw\s+material|components?|ingredients?|API\b)/i,
  customers: /\b(customer|buys?\b|purchas|deploys?|uses?\s+\w+\s+(?:to|for)|client\b|orders?\b|reseller)/i,
  logisticsPartners: /\b(partner|integrat|logistics|delivery|fulfillment|carrier|freight|ships?\b|interconnect)/i,
  capitalProviders: /\b(lend|loan|credit|financ|underwrit|investor|capital|revolver|notes?\b|facility)/i
};
const noteOf = e => String(e.relationshipNote || '') + ' ' + String(e.brainNodeRole || '');

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
let portalsTouched = 0, moved = 0, leftCoopetition = 0;
const bySrc = {};
const examples = [];

for (const f of files) {
  let p; try { p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { continue; }
  const fn = p.functionalNetwork; if (!fn) continue;
  let changed = false;
  const competitors = Array.isArray(fn.competitors) ? fn.competitors : (fn.competitors ? [fn.competitors] : []);
  const compSlugs = new Set(competitors.map(e => e && e.slug).filter(Boolean));
  for (const cat of NON_COMPETE_SLOTS) {
    const arr = Array.isArray(fn[cat]) ? fn[cat] : (fn[cat] ? [fn[cat]] : []);
    if (!arr.length) continue;
    const keep = [];
    for (const e of arr) {
      if (!e || typeof e !== 'object') { keep.push(e); continue; }
      const note = noteOf(e);
      const pureMisslot = STRONG_COMPETE_RE.test(note) && !(ROLE_RE[cat] && ROLE_RE[cat].test(note));
      if (!pureMisslot) { if (STRONG_COMPETE_RE.test(note)) leftCoopetition++; keep.push(e); continue; }
      // move it
      moved++; bySrc[cat] = (bySrc[cat] || 0) + 1; changed = true;
      if (!compSlugs.has(e.slug)) {
        const m = { ...e, neuralRole: 'Peer', _reslottedFrom: cat };
        competitors.push(m); compSlugs.add(e.slug);
        if (examples.length < 25) examples.push(`${p.slug || f}: "${e.name}" ${cat} -> competitors`);
      } // else: duplicate of an existing competitor entry; just drop from wrong slot
    }
    fn[cat] = keep;
  }
  if (changed) {
    fn.competitors = competitors;
    portalsTouched++;
    if (APPLY) fs.writeFileSync(path.join(DIR, f), JSON.stringify(p, null, 2));
  }
}

console.log('=== category-bleed re-slot ' + (APPLY ? '(APPLIED)' : '(DRY RUN)') + ' ===');
console.log('portals touched:', portalsTouched, '| entries moved -> competitors:', moved, '| coopetition left in place:', leftCoopetition);
console.log('moved by source slot:', JSON.stringify(bySrc));
console.log('\nexamples:'); for (const e of examples) console.log('  ' + e);
if (!APPLY) console.log('\n(dry run — run with --apply to write)');
