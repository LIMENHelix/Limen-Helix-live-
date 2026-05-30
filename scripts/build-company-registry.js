#!/usr/bin/env node
/**
 * build-company-registry.js
 *
 * Scans assets/data/companies/*.json (all 23 v2 portals + 140 v1 legacy stubs)
 * and emits assets/data/company-registry.json — the canonical index over the
 * fractal-portal corpus.
 *
 * Output indices (all keyed for fast lookup, never duplicate names):
 *   byCik          → per-CIK record (slug, name, ticker, sic, domain,
 *                    kernelStatus, phaseState, brainNodeIds[], schemaVersion)
 *   bySlug         → slug → cik
 *   byBrainNode    → brainNodeId → [slug, ...]  (companies bound to that node
 *                    EITHER as their own brain map OR appearing as an entry
 *                    in another company's functionalNetwork)
 *   byDomain       → domainId → [slug, ...]
 *   bySic          → sic → [slug, ...]
 *   byPhaseState   → "p0".."p10" → [slug, ...]
 *   byKernelStatus → status → [slug, ...]
 *   graph          → slug → { suppliers, customers, logisticsPartners,
 *                              competitors, regulators, executives } of
 *                    {target_slug|target_cik|target_name} edges (used by the
 *                    reciprocity validator + supply-chain alert propagation)
 *
 * Usage:
 *   node scripts/build-company-registry.js
 */

const fs = require('fs');
const path = require('path');

const COMPANIES_DIR = path.join(__dirname, '..', 'assets', 'data', 'companies');
const REGISTRY_OUT  = path.join(__dirname, '..', 'assets', 'data', 'company-registry.json');

function loadCompany(file) {
  return JSON.parse(fs.readFileSync(path.join(COMPANIES_DIR, file), 'utf8'));
}

function add(idx, key, value) {
  if (!key) return;
  if (!idx[key]) idx[key] = [];
  if (!idx[key].includes(value)) idx[key].push(value);
}

const files = fs.readdirSync(COMPANIES_DIR).filter(f => f.endsWith('.json'));

const byCik          = {};
const bySlug         = {};
const byBrainNode    = {};
const byDomain       = {};
const bySic          = {};
const byPhaseState   = {};
const byKernelStatus = {};
const graph          = {};

const SLOT_TO_EDGE = {
  suppliers:         'suppliers',
  customers:         'customers',
  logisticsPartners: 'logisticsPartners',
  competitors:       'competitors',
  regulators:        'regulators',
  executiveTeam:     'executives',
};

let v2Count = 0;
let v1Count = 0;

for (const file of files) {
  const j = loadCompany(file);
  const slug = j.slug || file.replace('.json', '');
  const isV2 = !!j.functionalNetwork && j.schemaVersion === '2.0.1';
  if (isV2) v2Count++; else v1Count++;

  // Primary indices
  const cik = j.cik || null;
  if (cik) {
    byCik[cik] = {
      slug,
      name: j.name || null,
      ticker: j.ticker || null,
      sic: j.sic || null,
      domain: j.domainId || null,
      kernelStatus: j.kernelStatus || 'NOT_PROBED',
      phaseState: j.financialHealth?.dominantPhase || null,
      phaseStateLabel: j.financialHealth?.phaseStateLabel || null,
      compositeScore: j.financialHealth?.compositeScore ?? null,
      alert: j.financialHealth?.alert ?? false,
      distressBand: j.financialHealth?.distressBand || null,
      schemaVersion: j.schemaVersion || 'v1',
      brainNodeIds: [],
    };
    bySlug[slug] = cik;
  }
  if (j.domainId) add(byDomain, j.domainId, slug);
  if (j.sic) add(bySic, j.sic, slug);
  if (j.financialHealth?.dominantPhase) add(byPhaseState, j.financialHealth.dominantPhase, slug);
  add(byKernelStatus, j.kernelStatus || 'NOT_PROBED', slug);

  // Brain-node index — every brainNodeId mention in this portal's functionalNetwork
  // adds a row { ownerSlug, slot, targetName, targetSlug?, targetCik?, neuralRole }.
  // Captures regulators / execs / signals (slugless) AND linked companies alike.
  if (j.functionalNetwork) {
    const nodes = new Set();
    const edges = { suppliers: [], customers: [], logisticsPartners: [], competitors: [], regulators: [], executives: [] };
    for (const [slot, slotEntries] of Object.entries(j.functionalNetwork)) {
      if (slot === 'model') continue;
      const entries = Array.isArray(slotEntries) ? slotEntries : (slotEntries ? [slotEntries] : []);
      for (const e of entries) {
        if (e.brainNodeId) {
          nodes.add(e.brainNodeId);
          if (!byBrainNode[e.brainNodeId]) byBrainNode[e.brainNodeId] = [];
          byBrainNode[e.brainNodeId].push({
            ownerSlug: slug,
            slot,
            targetName: e.name || e.shortName || null,
            targetSlug: e.slug || null,
            targetCik: e.cik || null,
            neuralRole: e.neuralRole || null,
            confidence: e.confidence || null,
          });
        }
        if (SLOT_TO_EDGE[slot]) {
          edges[SLOT_TO_EDGE[slot]].push({
            slug: e.slug || null,
            cik: e.cik || null,
            name: e.name || null,
            ticker: e.ticker || null,
            neuralRole: e.neuralRole || null,
            brainNodeId: e.brainNodeId || null,
            confidence: e.confidence || null,
            sourceType: e.sourceType || null,
          });
        }
      }
    }
    if (cik) byCik[cik].brainNodeIds = Array.from(nodes).sort();
    graph[slug] = edges;
  }
}

// Sort byBrainNode entries by (ownerSlug, slot, targetName) for stable diffs.
for (const k of Object.keys(byBrainNode)) {
  byBrainNode[k].sort((a, b) =>
    (a.ownerSlug || '').localeCompare(b.ownerSlug || '') ||
    (a.slot || '').localeCompare(b.slot || '') ||
    (a.targetName || '').localeCompare(b.targetName || '')
  );
}

// Sort string-array indices alphabetically for stable diffs
for (const idx of [byDomain, bySic, byPhaseState, byKernelStatus]) {
  for (const k of Object.keys(idx)) idx[k].sort();
}

const registry = {
  generatedAt: new Date().toISOString(),
  schemaVersion: '2.0.1',
  counts: {
    portals: files.length,
    v2: v2Count,
    v1Legacy: v1Count,
    uniqueCiks: Object.keys(byCik).length,
    uniqueBrainNodes: Object.keys(byBrainNode).length,
    domains: Object.keys(byDomain).length,
    sicCodes: Object.keys(bySic).length,
  },
  byCik,
  bySlug,
  byBrainNode,
  byDomain,
  bySic,
  byPhaseState,
  byKernelStatus,
  graph,
};

fs.writeFileSync(REGISTRY_OUT, JSON.stringify(registry, null, 2));

console.log(`Registry written: ${path.relative(process.cwd(), REGISTRY_OUT)}`);
console.log(`  portals scanned:    ${registry.counts.portals}`);
console.log(`  v2 (full):          ${registry.counts.v2}`);
console.log(`  v1 (legacy stubs):  ${registry.counts.v1Legacy}`);
console.log(`  unique CIKs:        ${registry.counts.uniqueCiks}`);
console.log(`  unique brain nodes: ${registry.counts.uniqueBrainNodes}`);
console.log(`  domains:            ${registry.counts.domains}`);
console.log(`  phase states:       ${Object.keys(byPhaseState).join(', ') || '(none)'}`);
console.log(`  kernel statuses:    ${Object.entries(byKernelStatus).map(([k,v])=>k+':'+v.length).join(', ')}`);
