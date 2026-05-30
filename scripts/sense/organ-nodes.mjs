// scripts/sense/organ-nodes.mjs — 123 L1 brain regions.
//
// The taxonomy is FROZEN until 2026-12-01 (per [[limen_l1_taxonomy_freeze_2026_05_24]]).
// This organ verifies the taxonomy is structurally healthy:
//   - exactly 123 nodes
//   - every node has ≥1 domain binding
//   - canonical 20 domains all referenced
//   - no orphan nodes (zero bindings = receptor with nothing to receive)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const NODE_PATH = path.join(ROOT, 'assets', 'data', 'brain-node-domains.json');

export const id = 'l1Nodes';
export const role = '123 L1 neural operators (FROZEN)';
export const order = 20;

const CANONICAL_DOMAINS = ['agriculture','communication','culture','defense','economy','education','energy','environment','finance','governance','industry','infrastructure','intelligence','law','medicine','population','religion','science','supplyChain','technology'];
const EXPECTED_NODES = 123;

export function sense() {
  if (!fs.existsSync(NODE_PATH)) {
    return { score: 0, status: 'IN_PAIN', summary: 'brain-node-domains.json missing', metrics: {}, attention: [{ issue: 'L1 node taxonomy file missing', severity: 'high', count: 1, action: 'restore assets/data/brain-node-domains.json', organ: id }] };
  }
  const taxonomy = JSON.parse(fs.readFileSync(NODE_PATH, 'utf8'));
  const nodeIds = Object.keys(taxonomy);
  const orphans = [];
  const underused = [];   // node has only 1 domain binding
  const domainsHit = new Set();
  let totalBindings = 0;
  let bindingsByDomain = {};
  for (const nid of nodeIds) {
    const bindings = Array.isArray(taxonomy[nid]) ? taxonomy[nid] : [];
    if (bindings.length === 0) orphans.push(nid);
    else if (bindings.length === 1) underused.push({ id: nid, domain: bindings[0].domain });
    totalBindings += bindings.length;
    for (const b of bindings) { if (b.domain) { domainsHit.add(b.domain); bindingsByDomain[b.domain] = (bindingsByDomain[b.domain] || 0) + 1; } }
  }
  const canonicalCovered = CANONICAL_DOMAINS.filter(d => domainsHit.has(d));
  const canonicalMissing = CANONICAL_DOMAINS.filter(d => !domainsHit.has(d));
  const nonCanonicalDomains = [...domainsHit].filter(d => !CANONICAL_DOMAINS.includes(d));

  const attention = [];
  if (nodeIds.length !== EXPECTED_NODES) attention.push({ issue: 'L1 node count drift (expected 123, frozen until 2026-12-01)', severity: 'high', count: Math.abs(nodeIds.length - EXPECTED_NODES), action: 'investigate — taxonomy freeze violation', organ: id });
  if (orphans.length > 0) attention.push({ issue: 'Orphan L1 nodes (zero domain bindings — receptor with nothing to receive)', severity: 'high', count: orphans.length, action: 'add domain bindings or remove node: ' + orphans.slice(0, 5).join(', '), organ: id });
  if (canonicalMissing.length > 0) attention.push({ issue: 'Canonical domains with NO L1 node binding', severity: 'high', count: canonicalMissing.length, action: 'add bindings for: ' + canonicalMissing.join(', '), organ: id });

  // scoring
  const countScore = nodeIds.length === EXPECTED_NODES ? 100 : Math.max(0, 100 - Math.abs(nodeIds.length - EXPECTED_NODES) * 5);
  const orphanScore = orphans.length === 0 ? 100 : Math.max(0, 100 - orphans.length * 10);
  const domainScore = Math.round(canonicalCovered.length / CANONICAL_DOMAINS.length * 100);
  const score = Math.round((countScore + orphanScore + domainScore) / 3);
  const status = score >= 90 ? 'HEALTHY' : score >= 75 ? 'DEGRADED' : 'IN_PAIN';

  return {
    score, status,
    summary: `${nodeIds.length}/${EXPECTED_NODES} nodes · ${totalBindings} bindings · ${canonicalCovered.length}/${CANONICAL_DOMAINS.length} canonical domains covered · ${orphans.length} orphans · ${underused.length} single-binding`,
    metrics: { nodeCount: nodeIds.length, totalBindings, orphans, underused: underused.slice(0, 25), canonicalCovered, canonicalMissing, nonCanonicalDomains, bindingsByDomain, scoreParts: { count: countScore, orphan: orphanScore, domain: domainScore } },
    attention
  };
}
