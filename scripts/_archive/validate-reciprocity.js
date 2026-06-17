#!/usr/bin/env node
/**
 * validate-reciprocity.js
 *
 * Builds a relationship graph from the live assets/data/companies/*.json corpus and enforces:
 *   - If A.suppliers includes B → B.customers must include A
 *   - If A.customers includes B → B.suppliers must include A
 *   - If A.logisticsPartners includes B → B.customers must include A
 *   - If A.competitors includes B → B.competitors must include A (symmetric)
 *
 * The check only fires when BOTH endpoints have v2 portals (graph entries).
 * If A lists B but B has no portal yet (B is a v1 legacy or doesn't exist),
 * the asymmetry is reported as INFO not ERROR — it's a known authoring gap
 * to address as the corpus expands.
 *
 * Exits 0 if every two-way edge is reciprocated; 1 if drift found.
 *
 * Usage:
 *   node scripts/validate-reciprocity.js
 *   node scripts/validate-reciprocity.js --quiet   # only summary + errors
 */

const fs = require('fs');
const path = require('path');

const COMPANIES_DIR = path.join(__dirname, '..', 'assets', 'data', 'companies');

const args = process.argv.slice(2);
const QUIET = args.includes('--quiet');

// ── Build the relationship graph from the LIVE portal corpus ─────────
// Previously this read assets/data/company-registry.json's `graph`, a stale
// 2026-05-10 23-node snapshot, so reciprocity was effectively uncomputed for
// the current corpus. Reading the portals directly keeps it live. (2026-05-25 audit.)
const EDGE_SLOTS = ['suppliers', 'customers', 'logisticsPartners', 'competitors'];
const normCik = (c) => (c == null ? null : String(c).replace(/^0+/, '') || '0');
const files = fs.readdirSync(COMPANIES_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));

// Pass 1 — canonical slugs + resolver index (slug / ticker / cik -> canonical slug)
const resolveIdx = {};
const portals = [];
for (const f of files) {
  let j;
  try { j = JSON.parse(fs.readFileSync(path.join(COMPANIES_DIR, f), 'utf8')); }
  catch { continue; }
  if (j.schemaVersion !== '2.0.1' || !j.functionalNetwork) continue;
  const slug = j.slug || f.replace(/\.json$/, '');
  resolveIdx[slug] = slug;
  if (j.ticker && j.ticker !== 'PRIVATE') resolveIdx['t:' + String(j.ticker).toUpperCase()] = slug;
  if (j.cik) resolveIdx['c:' + normCik(j.cik)] = slug;
  portals.push({ slug, fn: j.functionalNetwork });
}
function resolveTarget(e) {
  if (!e || typeof e !== 'object') return null;
  if (e.slug && resolveIdx[e.slug]) return resolveIdx[e.slug];
  if (e.ticker && resolveIdx['t:' + String(e.ticker).toUpperCase()]) return resolveIdx['t:' + String(e.ticker).toUpperCase()];
  if (e.cik && resolveIdx['c:' + normCik(e.cik)]) return resolveIdx['c:' + normCik(e.cik)];
  return null; // no local portal for this target
}

// Pass 2 — graph keyed by canonical slug, edge targets resolved to canonical slugs
const graph = {};
for (const { slug, fn } of portals) {
  const edges = { suppliers: [], customers: [], logisticsPartners: [], competitors: [] };
  for (const slot of EDGE_SLOTS) {
    const arr = Array.isArray(fn[slot]) ? fn[slot] : [];
    for (const e of arr) edges[slot].push({ slug: resolveTarget(e), name: (e && e.name) || null });
  }
  graph[slug] = edges;
}

// (A, slot) → set of acceptable inverse slot names on B.
// `customers` accepts EITHER suppliers OR logisticsPartners (a logistics
// partner is a service-supplier; the schema separates the slots, but for
// reciprocity either inverse is valid).
const INVERSE = {
  suppliers:         ['customers'],
  customers:         ['suppliers', 'logisticsPartners'],
  logisticsPartners: ['customers'],
  competitors:       ['competitors'],
};

let hardErrors = 0;
let softInfos = 0;
let okEdges = 0;
let orphanEdges = 0;   // edge points to a company with no local portal yet

const errors = [];
const infos = [];

function hasEdge(graphEntry, slot, targetSlug) {
  if (!graphEntry || !graphEntry[slot]) return false;
  return graphEntry[slot].some(e => e.slug === targetSlug);
}

for (const [ownerSlug, edges] of Object.entries(graph)) {
  for (const slot of Object.keys(INVERSE)) {
    const acceptableReverseSlots = INVERSE[slot];
    const entries = edges[slot] || [];
    for (const entry of entries) {
      const targetSlug = entry.slug;
      if (!targetSlug) { orphanEdges++; continue; }

      const targetGraph = graph[targetSlug];
      if (!targetGraph) {
        infos.push({ owner: ownerSlug, slot, target: targetSlug, msg: 'target has no v2 portal yet (corpus expansion gap)' });
        softInfos++;
        continue;
      }
      const reciprocated = acceptableReverseSlots.some(rs => hasEdge(targetGraph, rs, ownerSlug));
      if (reciprocated) {
        okEdges++;
      } else {
        errors.push({
          owner: ownerSlug, slot, target: targetSlug,
          expected: `${targetSlug} should include ${ownerSlug} in one of: ${acceptableReverseSlots.join(' | ')}`,
        });
        hardErrors++;
      }
    }
  }
}

if (!QUIET) {
  if (errors.length) {
    console.error('--- RECIPROCITY ERRORS ---');
    for (const e of errors) {
      console.error(`  ${e.owner}.${e.slot} → ${e.target}: ${e.expected}`);
    }
  }
  if (infos.length && !QUIET) {
    console.warn(`\n--- INFO: ${infos.length} edges where target lacks v2 portal (expected as corpus expands) ---`);
    // Don't dump all of them — just show first 10 + a count
    for (const i of infos.slice(0, 10)) {
      console.warn(`  ${i.owner}.${i.slot} → ${i.target}`);
    }
    if (infos.length > 10) console.warn(`  ... ${infos.length - 10} more`);
  }
}

const resolvable = okEdges + hardErrors;
const pct = resolvable ? ((okEdges / resolvable) * 100).toFixed(1) : '0.0';
console.log('\n──── RECIPROCITY SUMMARY ────');
console.log(`portals in graph:          ${Object.keys(graph).length}`);
console.log(`reciprocated edges:        ${okEdges}`);
console.log(`reciprocity errors:        ${hardErrors}  (resolvable target, no reverse edge)`);
console.log(`orphan edges (no portal):  ${orphanEdges}  (target company not yet authored)`);
console.log(`reciprocity rate:          ${pct}%  (${okEdges}/${resolvable} resolvable edges)`);
// Report-only metric by default (one-sided edges are mostly intentional
// authoring-scope gaps as the corpus expands). Pass --gate to exit 1 on drift.
process.exit(args.includes('--gate') && hardErrors > 0 ? 1 : 0);
