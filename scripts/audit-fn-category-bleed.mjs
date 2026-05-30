#!/usr/bin/env node
/**
 * audit-fn-category-bleed.mjs — quantify functionalNetwork category mislabeling.
 *
 * The enricher sometimes drops a competitor into the suppliers/customers slot
 * with a competitor-framed relationshipNote (seen: ge_vernova Siemens Energy,
 * stellus_capital Ares in BOTH suppliers and competitors). The content is real
 * (passes the genericity guard) but the CATEGORY is wrong, which mislabels the
 * stress-propagation edge weight (supplier 0.85 vs competitor). This is a
 * READ-ONLY audit — it flags, counts, and reports; it changes nothing.
 *
 * Signals per entry:
 *   - "competitor in non-competitor slot": entry sits in suppliers / customers /
 *     logisticsPartners / capitalProviders but its note clearly frames it as a
 *     competitor ("competitor", "competes with", "rival", "vies with").
 *   - "duplicate slug across categories": same slug appears in >1 category in
 *     one portal (a strong tell of a mis-slotted entry).
 *
 *   node scripts/audit-fn-category-bleed.mjs            # summary
 *   node scripts/audit-fn-category-bleed.mjs --list     # per-entry detail
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, '..', 'assets', 'data', 'companies');
const LIST = process.argv.includes('--list');

const NON_COMPETE_SLOTS = new Set(['suppliers', 'customers', 'logisticsPartners', 'capitalProviders']);
// a note shows a REAL supply/customer/partner role (not just competition) when
// it uses these verbs — then a competitor mention = legit coopetition, keep it.
const ROLE_RE = {
  suppliers: /\b(suppl(?:ies|ier|y)|provides|sources?\s+from|manufactures?\s+for|ships?\s+to\s+\w|raw\s+material|components?|ingredients?|API\b)/i,
  customers: /\b(customer|buys?\b|purchas|deploys?|uses?\s+\w+\s+(?:to|for)|client\b|orders?\b|reseller)/i,
  logisticsPartners: /\b(partner|integrat|logistics|delivery|fulfillment|carrier|freight|ships?\b|interconnect)/i,
  capitalProviders: /\b(lend|loan|credit|financ|underwrit|investor|capital|revolver|notes?\b|facility)/i
};
const COMPETE_RE = /\b(competitor|competes\s+(?:with|directly|in|against)|primary\s+competitor|direct\s+competitor|chief\s+rival|rival|vies\s+with|competing\b)/i;
// guard: a supplier note may legitimately mention competition ("also competes");
// require the competitor framing to be the DOMINANT description (early in note
// or explicit "is a/the ... competitor").
const STRONG_COMPETE_RE = /\b(is\s+(?:a|the|one\s+of)\s+[^.]*\bcompetitor|competitor\s+(?:in|to|of)|competes\s+(?:directly\s+)?(?:with|in|against))/i;

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
let portalsWithBleed = 0, competitorMisslot = 0, dupAcrossCats = 0, totalEntries = 0;
let pureMisslot = 0, coopetition = 0;
const examples = [];

for (const f of files) {
  let p; try { p = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { continue; }
  const fn = p.functionalNetwork || {};
  const slugCats = {};   // slug -> Set(categories) within this portal
  let portalFlagged = false;
  for (const cat in fn) {
    const arr = Array.isArray(fn[cat]) ? fn[cat] : (fn[cat] && typeof fn[cat] === 'object' ? [fn[cat]] : []);
    for (const e of arr) {
      if (!e || typeof e !== 'object' || !e.slug) continue;
      totalEntries++;
      (slugCats[e.slug] = slugCats[e.slug] || new Set()).add(cat);
      const note = String(e.relationshipNote || '') + ' ' + String(e.brainNodeRole || '');
      if (NON_COMPETE_SLOTS.has(cat) && STRONG_COMPETE_RE.test(note)) {
        competitorMisslot++; portalFlagged = true;
        const hasRole = ROLE_RE[cat] && ROLE_RE[cat].test(note);
        if (hasRole) coopetition++; else pureMisslot++;
        if (!hasRole && examples.length < 40) examples.push(`${p.slug || f} [${cat}] ${e.name}: ${note.slice(0, 110).trim()}`);
      }
    }
  }
  for (const slug in slugCats) {
    const cats = [...slugCats[slug]];
    // dup across a competitor slot + a supply/customer slot is the bleed signature
    if (cats.length > 1 && cats.includes('competitors') && cats.some(c => NON_COMPETE_SLOTS.has(c))) { dupAcrossCats++; portalFlagged = true; }
  }
  if (portalFlagged) portalsWithBleed++;
}

console.log('=== functionalNetwork category-bleed audit ===');
console.log('portals scanned:', files.length, '| total fn entries:', totalEntries);
console.log('portals with >=1 bleed signal:', portalsWithBleed, `(${(portalsWithBleed / files.length * 100).toFixed(1)}%)`);
console.log('competitor-framed entries in supply/customer/capital slot:', competitorMisslot);
console.log('  -> PURE mis-slot (note shows NO supply/customer role — real error):', pureMisslot);
console.log('  -> coopetition (note shows BOTH roles — legit multi-role, keep):', coopetition);
console.log('slugs appearing in BOTH competitors and a supply/customer slot (same portal):', dupAcrossCats);
if (LIST) { console.log('\n-- PURE mis-slot examples (fix candidates) --'); for (const e of examples) console.log('  ' + e); }
else console.log('\n(run with --list for examples)');
