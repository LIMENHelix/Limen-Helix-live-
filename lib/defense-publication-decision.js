'use strict';

var Source = require('./defense-publication-source.js');
var Learning = require('./defense-publication-learning.js');
var SCHEMA = 'defense-publication-decision/1.0';
var LOG_KEY = 'defense_publication_decision_log';
var PREFIX = 'defense_publication_decision:';
var MAX_BRAIN_AGE_MS = 45 * 60 * 1000;
var MAX_DECISION_AGE_MS = 10 * 60 * 1000;

function key(id) { return PREFIX + id; }

function validBrain(entry, now, packetId) {
  var c = entry && entry.c;
  var packet = c && c.serverPacket;
  var ts = Number(entry && entry.ts);
  var generated = Date.parse(packet && packet.generatedAt);
  return !!(c && c.domain === 'defense' && Number.isFinite(ts) && now >= ts && now - ts <= MAX_BRAIN_AGE_MS &&
    packet && packet.schemaVersion === 'civilization-domain-packet/1.0' && packet.domainId === 'defense' &&
    packet.packetId === packetId && packet.sourceIdentity && packet.sourceIdentity.producer === 'brain-cognition-refresh/1' &&
    Number.isFinite(generated) && now >= generated && now - generated <= MAX_BRAIN_AGE_MS);
}

async function persist(store, receipt) {
  var created = await store.setIfAbsent(key(receipt.decisionReceiptId), receipt);
  var restored = await store.get(key(receipt.decisionReceiptId));
  if (!restored || restored.actionId !== receipt.actionId || restored.status !== receipt.status) throw new Error('defense publication decision readback invalid');
  if (created) { await store.lpush(LOG_KEY, restored); await store.ltrim(LOG_KEY, 0, 999); }
  return restored;
}

function actionIdFor(candidate) {
  return 'dpa_' + Source.hash({ candidate: candidate && candidate.candidateId, content: candidate && candidate.contentHash }).slice(0, 24);
}

async function returnedOutcome(store, actionId) {
  var learning = await Learning.readForBrain(store), signal = learning && learning.signal;
  var valid = !!(signal && signal.ownerDomain === 'defense' && signal.lane === 'publication' &&
    signal.sourceKind === 'independent-action-outcome' && signal.signalId && signal.eventId && signal.actionId &&
    typeof signal.observedAt === 'number' && signal.articleId);
  return {
    schemaVersion: 'defense-returned-outcome/1.0', ownerDomain: 'defense', lane: 'publication',
    status: valid ? 'OBSERVED' : 'UNOBSERVED', signalId: valid ? signal.signalId : null,
    signalOutcome: valid ? signal.outcome || null : null, signalObservedAt: valid ? signal.observedAt : null,
    actionId: valid ? signal.actionId : null, articleId: valid ? signal.articleId : null,
    appliesToCurrentCandidate: valid && signal.actionId === actionId, resolvedCount: Number(learning && learning.resolvedCount || 0),
    learningGate: learning && learning.learningGate ? {
      ready: learning.learningGate.ready === true,
      minimumResolved: Number(learning.learningGate.minimumResolved || 5),
      distinctVisitors: Number(learning.learningGate.distinctVisitors || 0),
      minimumDistinctVisitors: Number(learning.learningGate.minimumDistinctVisitors || 2),
      distinctArticles: Number(learning.learningGate.distinctArticles || 0),
      minimumDistinctArticles: Number(learning.learningGate.minimumDistinctArticles || 2)
    } : { ready: false, minimumResolved: 5, distinctVisitors: 0, minimumDistinctVisitors: 2, distinctArticles: 0, minimumDistinctArticles: 2 },
    effect: valid ? (learning.learningGate && learning.learningGate.ready === true ? 'CONSUMED_AS_DEFENSE_AFFERENT' : 'RECORDED_NOT_YET_QUALIFIED') : 'NO_RETURNED_OUTCOME_YET'
  };
}

async function decide(store, candidate, now, cognition) {
  var at = Number(now) || Date.now();
  if (!Source.validate(candidate)) return { ok: true, status: 'NO_ACTION', released: false, reason: 'defense-publication-candidate-invalid', blockers: ['source-grounded-defense-brief-required'], liveMoney: false };
  try {
    store.assertDurable();
    var blockers = [];
    var actionId = actionIdFor(candidate), returned = await returnedOutcome(store, actionId);
    if (!validBrain(cognition, at, candidate.defensePacketId)) blockers.push('defense-brain-state-missing-stale-or-mismatched');
    var c = cognition && cognition.c || {};
    var organs = c.brainOrgans || {};
    if (!blockers.length) {
      if ((c.immune || {}).immuneState !== 'clear') blockers.push('defense-immune-veto');
      if ((c.awareness || {}).humanReviewRequired === true) blockers.push('defense-human-review-veto');
      var emission = organs.autonomousInternalEmission || {};
      if (emission.holdReason) blockers.push('defense-b10-brake-held:' + emission.holdReason);
      if (!(Number(emission.emittedCount) > 0)) blockers.push('defense-b10-no-action-selected');
      if (!(Number(c.serverPacket && c.serverPacket.truth && c.serverPacket.truth.feedHealth && c.serverPacket.truth.feedHealth.live) > 0)) blockers.push('defense-live-feeds-unavailable');
      var metabolism = organs.resourceMetabolism || {};
      if (metabolism.state !== 'AVAILABLE' || !metabolism.gates || metabolism.gates.mayRunInternalCycle !== true) blockers.push('defense-resource-metabolism-inhibited');
    }
    var status = blockers.length ? 'NO_ACTION' : 'RELEASED';
    return persist(store, {
      schemaVersion: SCHEMA,
      decisionReceiptId: 'dpd_' + Source.hash({ action: actionId, packet: candidate.defensePacketId, status: status, blockers: blockers,
        returnedOutcome: { status: returned.status, signalId: returned.signalId, signalObservedAt: returned.signalObservedAt,
          resolvedCount: returned.resolvedCount } }).slice(0, 24),
      actionId: actionId,
      status: status,
      released: status === 'RELEASED',
      reason: blockers.length ? 'defense-b10-held' : null,
      blockers: blockers,
      productDomain: 'defense', ownerDomain: 'defense', lane: 'publication',
      decisionContract: 'public-artifact-decision/1',
      candidateId: candidate.candidateId,
      contentHash: candidate.contentHash,
      sourceFingerprint: candidate.sourceFingerprint,
      defensePacketId: candidate.defensePacketId,
      returnedOutcome: returned,
      predictedOutcome: blockers.length ? null : { publicPresence: true, engagement: 'independent-source-link-click' },
      decidedAt: at,
      expiresAt: at + MAX_DECISION_AGE_MS,
      providerCalled: false,
      liveMoney: false
    });
  } catch (error) {
    return { ok: true, status: 'NO_ACTION', released: false, reason: 'defense-publication-decision-unavailable', blockers: ['strict-decision-boundary-unavailable'], detail: String(error && error.message || error), liveMoney: false };
  }
}

function validateReceipt(receipt, candidate, now) {
  var at = Number(now) || Date.now();
  var actionId = actionIdFor(candidate);
  return !!(Source.validate(candidate) && receipt && receipt.schemaVersion === SCHEMA && receipt.status === 'RELEASED' &&
    receipt.actionId === actionId && receipt.candidateId === candidate.candidateId && receipt.contentHash === candidate.contentHash &&
    Number(receipt.decidedAt) <= at && at < Number(receipt.expiresAt));
}

module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, key: key, validBrain: validBrain, decide: decide, validateReceipt: validateReceipt, returnedOutcome: returnedOutcome, actionIdFor: actionIdFor };
