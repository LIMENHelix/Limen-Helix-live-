import { createHash } from 'node:crypto';

export const K3_SCHEMA_VERSION = 'k3-relational-topology/1.0';
export const K3_KERNEL_ID = 'k3-relational-kernel/1.0';

export const K3_THRESHOLDS = Object.freeze({
  minimumRelationships: 20,
  minimumCategories: 6,
  minimumNeuralRoles: 5,
  minimumTopologyTaggedRate: 0.90,
  minimumEvidenceTaggedRate: 0.90
});

function relationRows(portal) {
  const rows = [];
  const network = portal && portal.functionalNetwork;
  if (!network || typeof network !== 'object') return rows;
  for (const [category, entries] of Object.entries(network)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (entry && typeof entry === 'object') rows.push({ category, entry });
    }
  }
  return rows;
}

function rate(numerator, denominator) {
  return denominator ? +(numerator / denominator).toFixed(3) : 0;
}

function hasSource(entry) {
  if (Array.isArray(entry.sourceType)) return entry.sourceType.some(Boolean);
  return !!entry.sourceType;
}

export function inspectK3RelationalTopology(portal) {
  const rows = relationRows(portal);
  const categories = new Set();
  const neuralRoles = new Set();
  let topologyTagged = 0;
  let evidenceTagged = 0;
  let inferredRelations = 0;

  for (const { category, entry } of rows) {
    categories.add(category);
    if (entry.neuralRole) neuralRoles.add(String(entry.neuralRole));
    if (entry.brainNodeId && entry.neuralRole && entry.brainNodeRole) topologyTagged++;
    if (hasSource(entry) && entry.confidence) evidenceTagged++;
    const sources = Array.isArray(entry.sourceType) ? entry.sourceType : [entry.sourceType];
    if (sources.some(source => /(^|_)inferred$/i.test(String(source || '')))) inferredRelations++;
  }

  const metrics = {
    relationshipCount: rows.length,
    categoryCount: categories.size,
    neuralRoleCount: neuralRoles.size,
    topologyTaggedCount: topologyTagged,
    topologyTaggedRate: rate(topologyTagged, rows.length),
    evidenceTaggedCount: evidenceTagged,
    evidenceTaggedRate: rate(evidenceTagged, rows.length),
    inferredRelationCount: inferredRelations,
    inferredRelationRate: rate(inferredRelations, rows.length),
    categories: [...categories].sort(),
    neuralRoles: [...neuralRoles].sort()
  };

  const gates = {
    relationships: metrics.relationshipCount >= K3_THRESHOLDS.minimumRelationships,
    categories: metrics.categoryCount >= K3_THRESHOLDS.minimumCategories,
    neuralRoles: metrics.neuralRoleCount >= K3_THRESHOLDS.minimumNeuralRoles,
    topologyTaggedRate: metrics.topologyTaggedRate >= K3_THRESHOLDS.minimumTopologyTaggedRate,
    evidenceTaggedRate: metrics.evidenceTaggedRate >= K3_THRESHOLDS.minimumEvidenceTaggedRate
  };

  return {
    eligible: Object.values(gates).every(Boolean),
    gates,
    failedGates: Object.entries(gates).filter(([, passed]) => !passed).map(([name]) => name),
    metrics,
    sourceFingerprint: createHash('sha256')
      .update(JSON.stringify((portal && portal.functionalNetwork) || {}))
      .digest('hex')
  };
}

export function buildK3RelationalReading(portal, evaluatedAt) {
  const inspection = inspectK3RelationalTopology(portal);
  if (!inspection.eligible) return { inspection, reading: null };
  if (!evaluatedAt || Number.isNaN(Date.parse(evaluatedAt))) {
    throw new Error('evaluatedAt must be an ISO-8601 timestamp');
  }

  return {
    inspection,
    reading: {
      schemaVersion: K3_SCHEMA_VERSION,
      state: 'RELATIONAL_MAP_OBSERVED',
      readingType: 'relational_topology',
      phase: null,
      composite: null,
      alert: false,
      coverage: inspection.metrics,
      sourceFingerprint: inspection.sourceFingerprint,
      limitations: [
        'INTERPRETIVE_ONLY',
        'NOT_A_FINANCIAL_PHASE',
        'NOT_OUTCOME_VALIDATED',
        'SOURCE_CLAIMS_NOT_INDEPENDENTLY_VERIFIED'
      ],
      kernelId: K3_KERNEL_ID,
      lastScored: evaluatedAt
    }
  };
}

export function hasK1Reading(portal) {
  const financial = (portal && portal.financialHealth) || {};
  return typeof financial.compositeScore === 'number' ||
    typeof financial.composite === 'number' ||
    typeof portal?.kernelReadings?.k1?.composite === 'number';
}

export function hasK2Reading(portal) {
  const k2 = portal?.kernelReadings?.k2;
  return !!(k2 && typeof k2 === 'object' &&
    (k2.phase || k2.dominantPhase || k2.coupling_mode));
}

export function hasK3Reading(portal) {
  const k3 = portal?.kernelReadings?.k3;
  return !!(k3 && typeof k3 === 'object' &&
    k3.schemaVersion === K3_SCHEMA_VERSION &&
    k3.state === 'RELATIONAL_MAP_OBSERVED' &&
    k3.readingType === 'relational_topology');
}
