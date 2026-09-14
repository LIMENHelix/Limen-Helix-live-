'use strict';

/**
 * Deterministic neurology -> business reflex for one sovereign domain.
 *
 * This module never calls a model or an external provider.  It converts a
 * fresh, durable cognition packet into a write-ahead commercial intent that a
 * later domain worker may render and a separately authorized motor may enact.
 */

var crypto = require('node:crypto');

var SCHEMA = 'domain-commercial-reflex/1.0';
var INTENT_SCHEMA = 'domain-commercial-intent/1.0';
var MAX_PACKET_AGE_MS = 45 * 60 * 1000;
var MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
var MAX_EVIDENCE = 8;

function list(value) { return Array.isArray(value) ? value : []; }
function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
function clamp01(value) { return Math.max(0, Math.min(1, Number(value) || 0)); }
function round(value) { return Math.round(Number(value) * 1000) / 1000; }
function parsed(value) { var n = Date.parse(value); return Number.isFinite(n) ? n : null; }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function digest(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }

function validSourceIdentity(value) {
  return value && typeof value.kind === 'string' && value.kind.trim() &&
    typeof value.value === 'string' && value.value.trim();
}

function evidenceRow(row) {
  if (!row || !validSourceIdentity(row.sourceIdentity) || !row.title) return null;
  var observedAt = parsed(row.sourceUpdatedAt) || parsed(row.recordedAt);
  if (!observedAt) return null;
  var sourceUrl = row.canonicalUrl || row.aggregatorItemUrl || row.sourceRecordId || null;
  if (!sourceUrl) return null;
  return {
    sourceIdentity: clone(row.sourceIdentity),
    title: String(row.title).slice(0, 300),
    publisher: row.publisher || row.feedName || null,
    feedName: row.feedName || null,
    observedAt: observedAt,
    sourceUrl: sourceUrl,
    authority: 'topic-lead-only',
    fullTextVerified: false
  };
}

function selectEvidence(rows) {
  var valid = list(rows).map(evidenceRow).filter(Boolean);
  valid.sort(function (a, b) { return b.observedAt - a.observedAt; });
  var selected = [], seen = Object.create(null), feedSeen = Object.create(null);
  valid.forEach(function (row) {
    if (selected.length >= MAX_EVIDENCE) return;
    var id = row.sourceIdentity.kind + ':' + row.sourceIdentity.value;
    var feed = String(row.feedName || row.publisher || 'unknown');
    if (!seen[id] && !feedSeen[feed]) {
      selected.push(row); seen[id] = true; feedSeen[feed] = true;
    }
  });
  valid.forEach(function (row) {
    if (selected.length >= MAX_EVIDENCE) return;
    var id = row.sourceIdentity.kind + ':' + row.sourceIdentity.value;
    if (!seen[id]) { selected.push(row); seen[id] = true; }
  });
  return selected;
}

function phaseValue(truth, cognition) {
  var raw = String(truth.phase || cognition.phase || '').toLowerCase();
  var match = raw.match(/p(?:hase\s*)?([0-9]{1,2})/i);
  return match ? Math.max(0, Math.min(10, Number(match[1]))) : null;
}

function cadence(priority, newestAgeMs) {
  if (newestAgeMs <= 6 * 60 * 60 * 1000 && priority >= 0.55) return 'IMMEDIATE';
  if (priority >= 0.7) return 'FOUR_HOURS';
  if (priority >= 0.45) return 'TWELVE_HOURS';
  return 'DAILY';
}

function intensity(priority) {
  if (priority >= 0.75) return { band: 'SURGE', maxArtifacts24h: 3 };
  if (priority >= 0.5) return { band: 'ELEVATED', maxArtifacts24h: 2 };
  return { band: 'BASELINE', maxArtifacts24h: 1 };
}

function chooseProgram(contract, phase, priority, evidenceCount) {
  var special = contract.allowedPrograms[3];
  if (evidenceCount >= 2 && priority >= 0.72 &&
      ['INVESTMENT_REVIEW', 'RESEARCH_ARTIFACT_REVIEW', 'PUBLICATION_REVIEW'].indexOf(special) >= 0) {
    return special;
  }
  if (evidenceCount >= 1 && priority >= 0.62 && (phase == null || phase >= 3)) return 'SHORT_VIDEO';
  if (evidenceCount >= 1 && priority >= 0.42) return 'PUBLIC_ARTICLE';
  if (contract.offerRungs.length) return 'SUBSCRIBER_BRIEF';
  return special;
}

function homologousState(cognition, truth, evidence, priorState, now) {
  var stress = finite(truth.stressScore) ? clamp01(truth.stressScore) :
    (finite(cognition.stress) ? clamp01(cognition.stress) : null);
  var previousStress = priorState && finite(priorState.lastStress) ? clamp01(priorState.lastStress) : null;
  var stressDelta = stress == null || previousStress == null ? 0 : stress - previousStress;
  var fingerprint = digest(evidence.map(function (row) { return row.sourceIdentity; }));
  var novelty = !priorState || priorState.evidenceFingerprint !== fingerprint ? 1 : 0;
  var newestAgeMs = evidence.length ? Math.max(0, now - evidence[0].observedAt) : Number.POSITIVE_INFINITY;
  var freshness = evidence.length ? clamp01(1 - newestAgeMs / (7 * 24 * 60 * 60 * 1000)) : 0;
  var predictionError = cognition.interoception && finite(cognition.interoception.divergence)
    ? clamp01(Math.abs(cognition.interoception.divergence)) : 0;
  var salience = round(clamp01(0.4 * novelty + 0.25 * (stress == null ? 0 : stress) +
    0.2 * Math.min(1, Math.abs(stressDelta) * 5) + 0.1 * freshness + 0.05 * predictionError));
  return {
    stress: stress,
    previousStress: previousStress,
    stressDelta: round(stressDelta),
    evidenceFingerprint: fingerprint,
    novelty: novelty,
    freshness: round(freshness),
    predictionError: round(predictionError),
    salience: salience,
    newestAgeMs: newestAgeMs
  };
}

function abstained(contract, reason, now, extra) {
  return Object.assign({
    schemaVersion: SCHEMA,
    productDomain: contract.productDomain,
    ownerDomain: contract.ownerDomain,
    status: 'ABSTAINED',
    reason: reason,
    evaluatedAt: now,
    externalEffectAuthorized: false,
    providerCalled: false,
    spendUsd: 0,
    intent: null
  }, extra || {});
}

function evaluate(contract, cognitionRecord, priorState, nowValue) {
  var now = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
  var cognition = cognitionRecord && cognitionRecord.c;
  var packet = cognition && cognition.serverPacket;
  if (!contract || !contract.productDomain) throw new Error('exact domain commercial contract required');
  if (!cognition || [contract.productDomain, contract.ownerDomain].indexOf(cognition.domain) < 0) {
    return abstained(contract, 'owning-domain-cognition-missing-or-mismatched', now);
  }
  if (!packet || packet.schemaVersion !== 'civilization-domain-packet/1.0' ||
      packet.domainId !== contract.productDomain || packet.sourceType !== 'server-cognition-refresh') {
    return abstained(contract, 'owning-domain-server-packet-missing-or-invalid', now);
  }
  var generatedAt = parsed(packet.generatedAt);
  if (!generatedAt || now - generatedAt > MAX_PACKET_AGE_MS || generatedAt - now > MAX_FUTURE_SKEW_MS) {
    return abstained(contract, 'owning-domain-server-packet-stale', now);
  }
  if (!cognition.serverPacketPersistence || cognition.serverPacketPersistence.ok !== true) {
    return abstained(contract, 'owning-domain-server-packet-not-durable', now);
  }
  var truth = packet.truth || {};
  var feedHealth = truth.feedHealth || {};
  if (!(Number(feedHealth.live) > 0)) return abstained(contract, 'owning-domain-live-feeds-unavailable', now);
  var metabolism = cognition.brainOrgans && cognition.brainOrgans.resourceMetabolism;
  if (!metabolism || metabolism.state !== 'AVAILABLE' || !metabolism.gates || metabolism.gates.mayRunInternalCycle !== true) {
    return abstained(contract, 'owning-domain-resource-metabolism-inhibited', now);
  }
  if (cognition.awareness && cognition.awareness.humanReviewRequired === true) {
    return abstained(contract, 'owning-domain-human-review-veto', now);
  }
  var meta = truth.semanticEvidenceMeta || {};
  if (meta.status !== 'OBSERVED' || meta.ownerDomain !== contract.productDomain) {
    return abstained(contract, 'owning-domain-semantic-evidence-unavailable', now);
  }
  var evidence = selectEvidence(truth.semanticEvidence);
  if (!evidence.length) return abstained(contract, 'owning-domain-has-no-admitted-topic-leads', now);

  var neural = homologousState(cognition, truth, evidence, priorState, now);
  var phase = phaseValue(truth, cognition);
  var meaningfulChange = neural.novelty === 1 || Math.abs(neural.stressDelta) >= 0.05;
  if (!meaningfulChange) {
    return abstained(contract, 'no-meaningful-afferent-or-stress-change', now, {
      packetId: packet.packetId,
      evidenceFingerprint: neural.evidenceFingerprint,
      lastStress: neural.stress,
      homology: {
        afferentSensing: 'NO_NOVEL_INPUT',
        interoception: { stress: neural.stress, delta: neural.stressDelta },
        salienceNetwork: neural.salience,
        basalGangliaSelection: 'ABSTAIN',
        motorCortex: 'INHIBITED',
        reafference: 'NOT_APPLICABLE'
      }
    });
  }

  var program = chooseProgram(contract, phase, neural.salience, evidence.length);
  var rate = cadence(neural.salience, neural.newestAgeMs);
  var output = intensity(neural.salience);
  var intentId = 'dci_' + digest({
    domain: contract.productDomain,
    packetId: packet.packetId,
    evidenceFingerprint: neural.evidenceFingerprint,
    program: program
  }).slice(0, 24);
  var intent = {
    schemaVersion: INTENT_SCHEMA,
    intentId: intentId,
    status: 'PLANNED',
    productDomain: contract.productDomain,
    ownerDomain: contract.ownerDomain,
    sourcePacketId: packet.packetId,
    sourcePacketGeneratedAt: packet.generatedAt,
    selectedProgram: program,
    allowedPrograms: contract.allowedPrograms.slice(),
    audience: contract.audience,
    offerRungs: contract.offerRungs.slice(),
    cadence: rate,
    intensity: output,
    evidence: evidence,
    admittedKnowledgeRefs: {
      opportunities: list(truth.opportunities).slice(0, 8),
      treatments: list(truth.treatments).slice(0, 8),
      directives: list(truth.directives).slice(0, 8)
    },
    renderContract: {
      status: 'EVIDENCE_FETCH_REQUIRED',
      headlineTitlesAreClaims: false,
      fullTextVerificationRequired: true,
      sourceLinkedSignalBriefPermitted: true,
      fullTextVerificationRequiredForClaimsBeyondSourceLedger: true,
      sourceAttributionRequired: true,
      prohibitedInputs: contract.sourceBoundary.prohibited.slice(),
      requiredOutputs: ['artifact-body', 'source-ledger', 'offer-cta', 'content-hash', 'freshness-expiry']
    },
    plannedAt: now,
    externalEffectAuthorized: false,
    providerCalled: false,
    spendUsd: 0
  };
  return {
    schemaVersion: SCHEMA,
    productDomain: contract.productDomain,
    ownerDomain: contract.ownerDomain,
    status: 'PLANNED',
    reason: null,
    packetId: packet.packetId,
    evidenceFingerprint: neural.evidenceFingerprint,
    lastStress: neural.stress,
    phase: phase,
    priority: neural.salience,
    evaluatedAt: now,
    externalEffectAuthorized: false,
    providerCalled: false,
    spendUsd: 0,
    homology: {
      afferentSensing: { novelty: neural.novelty, freshness: neural.freshness, evidenceCount: evidence.length },
      interoception: { stress: neural.stress, previousStress: neural.previousStress, delta: neural.stressDelta },
      predictionError: neural.predictionError,
      salienceNetwork: neural.salience,
      hypothalamicMetabolism: { state: metabolism.state, internalCycleAvailable: true },
      prefrontalBusinessPolicy: { allowedPrograms: contract.allowedPrograms.slice(), selectedProgram: program },
      basalGangliaSelection: 'DISINHIBIT_INTERNAL_PREPARATION_ONLY',
      motorCortex: 'WRITE_AHEAD_INTENT',
      efferenceCopy: { intentId: intentId, expectedNextState: 'ARTIFACT_PREPARED' },
      reafference: 'AWAITING_INDEPENDENT_EXTERNAL_OUTCOME'
    },
    intent: intent
  };
}

async function persist(store, contract, result) {
  if (!store || typeof store.assertDurable !== 'function') throw new Error('strict durable store required');
  store.assertDurable();
  var existing = result.intent ? await store.get(contract.intentPrefix + result.intent.intentId) : null;
  if (result.intent && !existing) {
    await store.setIfAbsent(contract.intentPrefix + result.intent.intentId, result.intent);
    existing = await store.get(contract.intentPrefix + result.intent.intentId);
  }
  if (result.intent && (!existing || existing.intentId !== result.intent.intentId || existing.productDomain !== contract.productDomain)) {
    throw new Error('domain commercial intent readback invalid');
  }
  var state = Object.assign({}, result, { intent: existing || null, persistedAt: Date.now(), readbackVerified: true });
  var restored = null;
  for (var attempt = 0; attempt < 3; attempt++) {
    var current = await store.get(contract.stateKey);
    if (current && Number(current.evaluatedAt || 0) > Number(state.evaluatedAt || 0)) return current;
    var written = current
      ? await store.replaceIfValue(contract.stateKey, current, state)
      : await store.setIfAbsent(contract.stateKey, state);
    if (written) { restored = await store.get(contract.stateKey); break; }
  }
  if (!restored || restored.schemaVersion !== SCHEMA || restored.productDomain !== contract.productDomain ||
      restored.status !== state.status || restored.evidenceFingerprint !== state.evidenceFingerprint) {
    throw new Error('domain commercial reflex state readback invalid');
  }
  await store.lpush(contract.receiptLog, {
    schemaVersion: SCHEMA,
    productDomain: contract.productDomain,
    ownerDomain: contract.ownerDomain,
    status: restored.status,
    reason: restored.reason,
    packetId: restored.packetId || null,
    intentId: restored.intent && restored.intent.intentId || null,
    evaluatedAt: restored.evaluatedAt,
    persistedAt: restored.persistedAt,
    externalEffectAuthorized: false
  });
  await store.ltrim(contract.receiptLog, 0, 199);
  return restored;
}

module.exports = {
  SCHEMA: SCHEMA,
  INTENT_SCHEMA: INTENT_SCHEMA,
  MAX_PACKET_AGE_MS: MAX_PACKET_AGE_MS,
  MAX_EVIDENCE: MAX_EVIDENCE,
  validSourceIdentity: validSourceIdentity,
  selectEvidence: selectEvidence,
  evaluate: evaluate,
  persist: persist
};
