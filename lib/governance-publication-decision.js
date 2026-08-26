'use strict';

var Source = require('./governance-publication-source.js');
var SCHEMA = 'governance-publication-decision/1.0';
var LOG_KEY = 'governance_publication_decision_log';
var PREFIX = 'governance_publication_decision:';
var MAX_BRAIN_AGE_MS = 45 * 60 * 1000;
var MAX_DECISION_AGE_MS = 10 * 60 * 1000;

function key(id) { return PREFIX + id; }

function validBrain(entry, now, packetId) {
  var c = entry && entry.c;
  var packet = c && c.serverPacket;
  var ts = Number(entry && entry.ts);
  var generated = Date.parse(packet && packet.generatedAt);
  return !!(c && c.domain === 'governance' && Number.isFinite(ts) && now >= ts && now - ts <= MAX_BRAIN_AGE_MS &&
    packet && packet.schemaVersion === 'civilization-domain-packet/1.0' && packet.domainId === 'governance' &&
    packet.packetId === packetId && packet.sourceIdentity && packet.sourceIdentity.producer === 'brain-cognition-refresh/1' &&
    Number.isFinite(generated) && now >= generated && now - generated <= MAX_BRAIN_AGE_MS);
}

async function persist(store, receipt) {
  var created = await store.setIfAbsent(key(receipt.decisionReceiptId), receipt);
  var restored = await store.get(key(receipt.decisionReceiptId));
  if (!restored || restored.actionId !== receipt.actionId || restored.status !== receipt.status) throw new Error('governance publication decision readback invalid');
  if (created) { await store.lpush(LOG_KEY, restored); await store.ltrim(LOG_KEY, 0, 999); }
  return restored;
}

async function decide(store, candidate, now, cognition) {
  var at = Number(now) || Date.now();
  if (!Source.validate(candidate)) return { ok: true, status: 'NO_ACTION', released: false, reason: 'governance-publication-candidate-invalid', blockers: ['source-grounded-governance-brief-required'], liveMoney: false };
  try {
    store.assertDurable();
    var blockers = [];
    if (!validBrain(cognition, at, candidate.governancePacketId)) blockers.push('governance-brain-state-missing-stale-or-mismatched');
    var c = cognition && cognition.c || {};
    var organs = c.brainOrgans || {};
    if (!blockers.length) {
      if ((c.immune || {}).immuneState !== 'clear') blockers.push('governance-immune-veto');
      if ((c.awareness || {}).humanReviewRequired === true) blockers.push('governance-human-review-veto');
      var emission = organs.autonomousInternalEmission || {};
      if (emission.holdReason) blockers.push('governance-b10-brake-held:' + emission.holdReason);
      if (!(Number(emission.emittedCount) > 0)) blockers.push('governance-b10-no-action-selected');
      if (!(Number(c.serverPacket && c.serverPacket.truth && c.serverPacket.truth.feedHealth && c.serverPacket.truth.feedHealth.live) > 0)) blockers.push('governance-live-feeds-unavailable');
      var metabolism = organs.resourceMetabolism || {};
      if (metabolism.state !== 'AVAILABLE' || !metabolism.gates || metabolism.gates.mayRunInternalCycle !== true) blockers.push('governance-resource-metabolism-inhibited');
    }
    var actionId = 'gpa_' + Source.hash({ candidate: candidate.candidateId, content: candidate.contentHash }).slice(0, 24);
    var status = blockers.length ? 'NO_ACTION' : 'RELEASED';
    return persist(store, {
      schemaVersion: SCHEMA,
      decisionReceiptId: 'gpd_' + Source.hash({ action: actionId, packet: candidate.governancePacketId, status: status, blockers: blockers }).slice(0, 24),
      actionId: actionId,
      status: status,
      released: status === 'RELEASED',
      reason: blockers.length ? 'governance-b10-held' : null,
      blockers: blockers,
      productDomain: 'governance', ownerDomain: 'governance', lane: 'publication',
      decisionContract: 'public-artifact-decision/1',
      candidateId: candidate.candidateId,
      contentHash: candidate.contentHash,
      sourceFingerprint: candidate.sourceFingerprint,
      governancePacketId: candidate.governancePacketId,
      predictedOutcome: blockers.length ? null : { publicPresence: true, engagement: 'independent-source-link-click' },
      decidedAt: at,
      expiresAt: at + MAX_DECISION_AGE_MS,
      providerCalled: false,
      liveMoney: false
    });
  } catch (error) {
    return { ok: true, status: 'NO_ACTION', released: false, reason: 'governance-publication-decision-unavailable', blockers: ['strict-decision-boundary-unavailable'], detail: String(error && error.message || error), liveMoney: false };
  }
}

function validateReceipt(receipt, candidate, now) {
  var at = Number(now) || Date.now();
  var actionId = 'gpa_' + Source.hash({ candidate: candidate && candidate.candidateId, content: candidate && candidate.contentHash }).slice(0, 24);
  return !!(Source.validate(candidate) && receipt && receipt.schemaVersion === SCHEMA && receipt.status === 'RELEASED' &&
    receipt.actionId === actionId && receipt.candidateId === candidate.candidateId && receipt.contentHash === candidate.contentHash &&
    Number(receipt.decidedAt) <= at && at < Number(receipt.expiresAt));
}

module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, key: key, validBrain: validBrain, decide: decide, validateReceipt: validateReceipt };
