/**
 * master-brain-consumer.js — phase-gated lane firing.
 *
 * Master Brain reads engine outputs across the corpus and decides which to
 * fire. Each artifact is scored:
 *   readiness = bridge.confidence × content-completeness
 *   salience  = kernel-phase severity + alert state + bridge confidence weighted
 *
 * Per-lane gates from master-living-brain.js: readiness ≥ R, salience ≥ S,
 * phase NOT in lane's phase-inhibit set. Artifacts passing all three →
 * READY_TO_FIRE. Otherwise INHIBITED with explicit reason.
 *
 * Output is a structured inbox (assets/data/_master-inbox.json) that the
 * operator surface reads. Inbox carries: per-lane queues (ready vs inhibited),
 * cross-lane top-priority, summary stats. Master Brain's job is not to do the
 * filings — it's to PRIORITIZE which to surface so an operator can decide.
 */
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'assets', 'data', 'companies');

// Thresholds from master-living-brain.js (per memory).
const LANE_THRESHOLDS = {
  patent:     { readiness: 0.55, salience: 0.30 },
  grant:      { readiness: 0.50, salience: 0.30 },
  sba:        { readiness: 0.55, salience: 0.30 },
  franchise:  { readiness: 0.60, salience: 0.30 },
  investment: { readiness: 0.60, salience: 0.40 },
  research:   { readiness: 0.40, salience: 0.20 }
};

// Phases that INHIBIT a given lane. (Anything not listed allows the lane to fire.)
const PHASE_INHIBIT = {
  patent:     ['p9', 'p10'],            // liquidation / resurrection blocks new IP filings
  grant:      ['p9'],                   // liquidated entities can't receive new grants
  sba:        ['p7a', 'p8', 'p9'],      // terminal / bankruptcy / liquidation blocks SBA
  franchise:  ['p7a', 'p8', 'p9'],      // same
  investment: [],                       // no phase block (short theses fire at terminal phases)
  research:   []                        // research can always fire — even on dead entities
};

// phase severity 0..1 — used to weight salience
const PHASE_SEVERITY = {
  p0: 0.00, p1: 0.10, p2: 0.20, p3: 0.50, p4: 0.40, p5: 0.30, p6: 0.20,
  p7: 0.70, p7a: 0.90, p7b: 0.60, p8: 0.85, p9: 0.95, p10: 0.40
};

function _phaseSeverity(phase) {
  const k = String(phase || '').toLowerCase();
  return PHASE_SEVERITY[k] != null ? PHASE_SEVERITY[k] : 0.30;
}

function _kernelPhase(portal) {
  const kr = portal.kernelReadings || {};
  if (kr.k2 && kr.k2.phase) return kr.k2.phase;
  if (kr.k1 && kr.k1.phase) return kr.k1.phase;
  if (portal.financialHealth && portal.financialHealth.dominantPhase) return portal.financialHealth.dominantPhase;
  return null;
}

function _alertFired(portal) {
  const kr = portal.kernelReadings || {};
  if (kr.k1 && kr.k1.alert === true) return true;
  if (portal.financialHealth && portal.financialHealth.alert === true) return true;
  return false;
}

// content-completeness: how many template slots in the artifact still carry
// operator-fill placeholders like [PRICE]. Fewer placeholders → more complete.
function _contentCompleteness(artifact) {
  if (!artifact || typeof artifact !== 'object') return 0;
  const text = JSON.stringify(artifact);
  const placeholders = (text.match(/\[[A-Z_][A-Z0-9_]*\]/g) || []).length;
  // 0 placeholders = 1.0 completeness; 20+ placeholders = 0.0
  return Math.max(0, Math.min(1, 1 - placeholders / 20));
}

function scoreArtifact(portal, item, laneId) {
  const phase = _kernelPhase(portal);
  const phaseSev = _phaseSeverity(phase);
  const alert = _alertFired(portal);
  const completeness = _contentCompleteness(item.artifact);
  const confidence = typeof item.confidence === 'number' ? item.confidence : 0.5;

  // readiness = weighted blend so well-formed high-confidence artifacts pass
  // the master-brain thresholds (0.40 for research, 0.60 for investment).
  // Confidence + completeness + light alert weight; produces scores that
  // separate "this is worth surfacing" from "still raw".
  const readiness = +(0.5 * confidence + 0.4 * completeness + (alert ? 0.1 : 0.05)).toFixed(3);

  // salience = weighted (bridge × phase severity × alert)
  const salience = +(0.4 * confidence + 0.4 * phaseSev + (alert ? 0.2 : 0.1)).toFixed(3);

  // phase inhibit check
  const inhibitedPhases = PHASE_INHIBIT[laneId] || [];
  const phaseInhibited = phase ? inhibitedPhases.includes(String(phase).toLowerCase()) : false;

  // gating
  const thresholds = LANE_THRESHOLDS[laneId] || { readiness: 0.50, salience: 0.30 };
  const readinessPass = readiness >= thresholds.readiness;
  const saliencePass = salience >= thresholds.salience;

  let status, reason;
  if (phaseInhibited) { status = 'INHIBITED'; reason = 'phase ' + phase + ' inhibits ' + laneId; }
  else if (!readinessPass && !saliencePass) { status = 'INHIBITED'; reason = 'readiness ' + readiness + ' < ' + thresholds.readiness + ' AND salience ' + salience + ' < ' + thresholds.salience; }
  else if (!readinessPass) { status = 'INHIBITED'; reason = 'readiness ' + readiness + ' < ' + thresholds.readiness; }
  else if (!saliencePass) { status = 'INHIBITED'; reason = 'salience ' + salience + ' < ' + thresholds.salience; }
  else { status = 'READY_TO_FIRE'; reason = null; }

  // fire score (composite priority — higher = surface sooner)
  const fireScore = +(readiness * salience).toFixed(3);

  return { readiness, salience, fireScore, phase, phaseSeverity: phaseSev, alert, completeness, phaseInhibited, status, reason };
}

function _shortPreview(item, laneId) {
  const a = item.artifact || {};
  if (laneId === 'patent') return (a.title || a.abstract || '').slice(0, 180);
  if (laneId === 'grant') return (a.title || a.abstract || (a.specificAims && a.specificAims.longTermGoal) || '').slice(0, 180);
  if (laneId === 'investment') return (a.thesisStatement || a.variantView || '').slice(0, 180);
  if (laneId === 'research') return (a.hypothesis || a.title || '').slice(0, 180);
  return '';
}

function consumePortal(portal) {
  const eo = portal.engineOutputs;
  if (!eo || eo.totalArtifacts === 0) return null;
  const slug = portal.slug || (portal.name || '').toLowerCase().replace(/\s+/g, '_');
  const items = [];
  for (const laneId of Object.keys(LANE_THRESHOLDS)) {
    const laneItems = eo[laneId] || [];
    for (let i = 0; i < laneItems.length; i++) {
      const it = laneItems[i];
      const score = scoreArtifact(portal, it, laneId);
      items.push({
        portalSlug: slug,
        portalName: portal.name || slug,
        portalCik: portal.cik || null,
        portalTicker: portal.ticker || null,
        portalDomain: portal.domainId || portal.sector || null,
        lane: laneId,
        patternId: it.patternId,
        confidence: it.confidence,
        artifactRef: slug + '/' + laneId + '/' + i,
        preview: _shortPreview(it, laneId),
        ...score
      });
    }
  }
  return items;
}

function buildInbox(corpusPortalsIterable) {
  const all = [];
  let portalsScanned = 0, portalsWithArtifacts = 0;
  for (const p of corpusPortalsIterable) {
    portalsScanned++;
    const items = consumePortal(p);
    if (items && items.length) { portalsWithArtifacts++; all.push(...items); }
  }
  // per-lane queues
  const queues = {};
  for (const laneId of Object.keys(LANE_THRESHOLDS)) {
    const laneItems = all.filter(x => x.lane === laneId);
    const ready = laneItems.filter(x => x.status === 'READY_TO_FIRE').sort((a, b) => b.fireScore - a.fireScore);
    const inhibited = laneItems.filter(x => x.status === 'INHIBITED').sort((a, b) => b.fireScore - a.fireScore);
    queues[laneId] = {
      thresholds: LANE_THRESHOLDS[laneId],
      phaseInhibit: PHASE_INHIBIT[laneId],
      totalCandidates: laneItems.length,
      readyCount: ready.length,
      inhibitedCount: inhibited.length,
      ready: ready.slice(0, 50),     // cap per lane in inbox
      inhibitedSample: inhibited.slice(0, 15)
    };
  }
  // cross-lane top priority — top 25 ready-to-fire across all lanes
  const topPriority = all.filter(x => x.status === 'READY_TO_FIRE').sort((a, b) => b.fireScore - a.fireScore).slice(0, 25);

  return {
    schemaVersion: 'master-inbox/1.0',
    generatedAt: new Date().toISOString(),
    stats: {
      portalsScanned,
      portalsWithArtifacts,
      totalCandidates: all.length,
      readyToFire: all.filter(x => x.status === 'READY_TO_FIRE').length,
      inhibited: all.filter(x => x.status === 'INHIBITED').length,
      byLaneReady: Object.fromEntries(Object.keys(queues).map(k => [k, queues[k].readyCount]))
    },
    laneThresholds: LANE_THRESHOLDS,
    phaseInhibit: PHASE_INHIBIT,
    queues,
    topPriority
  };
}

module.exports = { consumePortal, buildInbox, scoreArtifact, LANE_THRESHOLDS, PHASE_INHIBIT, PHASE_SEVERITY };
