'use strict';

var crypto = require('node:crypto');
var Redis = require('./redis-kv.js');

var SCHEMA = 'agriculture-homestead-decision/1.0';
var CANDIDATE_SCHEMA = 'agriculture-homestead-candidate/1.0';
var LOG_KEY = 'agriculture_homestead_decision_log';
var PREFIX = 'agriculture_homestead_decision:';
var MAX_BRAIN_AGE_MS = 45 * 60 * 1000;
var MAX_DECISION_AGE_MS = 10 * 60 * 1000;

function hash(value) { return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex'); }
function text(value, max) { var v = typeof value === 'string' ? value.trim() : ''; return v ? v.slice(0, max || 4000) : null; }
function validEmail(value) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value || ''); }
function key(id) { return PREFIX + id; }

function candidate(input) {
  input = input || {};
  var workOrderId = text(input.workOrderId, 160);
  var providerEmail = text(input.providerEmail, 320);
  var propertyRef = text(input.propertyRef, 320);
  var operationKind = text(input.operationKind, 160);
  var subject = text(input.subject, 500);
  var body = text(input.body, 12000);
  var evidenceId = text(input.evidenceId, 320);
  if (!workOrderId || !validEmail(providerEmail) || !propertyRef || !operationKind || !subject || !body || !evidenceId) return null;
  providerEmail = providerEmail.toLowerCase();
  return {
    schemaVersion: CANDIDATE_SCHEMA,
    productDomain: 'agriculture', ownerDomain: 'agriculture', lane: 'homestead',
    workOrderId: workOrderId, providerEmail: providerEmail, providerEmailHash: hash(providerEmail),
    propertyRef: propertyRef, propertyRefHash: hash(propertyRef), operationKind: operationKind,
    subject: subject, subjectHash: hash(subject), body: body, contentHash: hash(body),
    evidenceId: evidenceId, evidenceHash: hash(evidenceId), liveMoney: false
  };
}

function validCandidate(value) {
  return !!(value && value.schemaVersion === CANDIDATE_SCHEMA && value.productDomain === 'agriculture' &&
    value.ownerDomain === 'agriculture' && value.lane === 'homestead' && text(value.workOrderId) &&
    validEmail(value.providerEmail) && value.providerEmailHash === hash(value.providerEmail) && text(value.propertyRef) &&
    value.propertyRefHash === hash(value.propertyRef) && text(value.operationKind) && text(value.subject) &&
    value.subjectHash === hash(value.subject) && text(value.body) && value.contentHash === hash(value.body) &&
    text(value.evidenceId) && value.evidenceHash === hash(value.evidenceId));
}

async function brainEntry(deps) {
  if (deps && deps.cognition) return deps.cognition;
  return (deps && deps.redisGet || Redis.redisGet)('limen:brain:cognition:agriculture');
}

function validBrain(entry, now) {
  var cognition = entry && entry.c;
  var ts = Number(entry && entry.ts);
  var packet = cognition && cognition.serverPacket;
  var generated = Date.parse(packet && packet.generatedAt);
  return !!(cognition && cognition.domain === 'agriculture' && Number.isFinite(ts) && now >= ts &&
    now - ts <= MAX_BRAIN_AGE_MS && packet && packet.schemaVersion === 'civilization-domain-packet/1.0' &&
    packet.domainId === 'agriculture' && packet.sourceIdentity &&
    packet.sourceIdentity.producer === 'brain-cognition-refresh/1' && Number.isFinite(generated) &&
    now >= generated && now - generated <= MAX_BRAIN_AGE_MS);
}

async function persist(store, receipt) {
  var created = await store.setIfAbsent(key(receipt.decisionReceiptId), receipt);
  var restored = await store.get(key(receipt.decisionReceiptId));
  if (!restored || restored.actionId !== receipt.actionId || restored.status !== receipt.status) throw new Error('agriculture homestead decision readback invalid');
  if (created) { await store.lpush(LOG_KEY, restored); await store.ltrim(LOG_KEY, 0, 999); }
  return restored;
}

async function decide(store, value, now, deps) {
  var at = Number(now) || Date.now();
  if (!validCandidate(value)) return { ok: true, status: 'NO_ACTION', released: false, reason: 'agriculture-homestead-candidate-invalid', blockers: ['exact-farm-property-work-order-required'], providerCalled: false, liveMoney: false };
  try {
    store.assertDurable();
    var entry = await brainEntry(deps);
    var blockers = [];
    if (!validBrain(entry, at)) blockers.push('agriculture-brain-state-missing-or-stale');
    var cognition = entry && entry.c || {};
    var packet = cognition.serverPacket || {};
    var organs = cognition.brainOrgans || {};
    if (!blockers.length) {
      if ((cognition.immune || {}).immuneState !== 'clear') blockers.push('agriculture-immune-veto');
      if ((cognition.awareness || {}).humanReviewRequired === true) blockers.push('agriculture-human-review-veto');
      var emission = organs.autonomousInternalEmission || {};
      if (emission.holdReason) blockers.push('agriculture-b10-brake-held:' + emission.holdReason);
      if (!(Number(emission.emittedCount) > 0)) blockers.push('agriculture-b10-no-action-selected');
      if (!packet.truth || !packet.truth.feedHealth || !(Number(packet.truth.feedHealth.live) > 0)) blockers.push('agriculture-live-feeds-unavailable');
      var metabolism = organs.resourceMetabolism || {}, gates = metabolism.gates || {};
      if (metabolism.state !== 'AVAILABLE' || gates.mayRunInternalCycle !== true) blockers.push('agriculture-resource-metabolism-inhibited');
    }
    var actionId = 'aha_' + hash({ workOrderId: value.workOrderId, provider: value.providerEmailHash, property: value.propertyRefHash,
      kind: value.operationKind, content: value.contentHash, evidence: value.evidenceHash }).slice(0, 24);
    var status = blockers.length ? 'NO_ACTION' : 'RELEASED';
    return persist(store, {
      schemaVersion: SCHEMA, decisionReceiptId: 'ahd_' + hash({ actionId: actionId, packet: packet.packetId || null, status: status, blockers: blockers }).slice(0, 24),
      actionId: actionId, status: status, released: status === 'RELEASED', reason: blockers.length ? 'agriculture-b10-held' : null,
      blockers: blockers, productDomain: 'agriculture', ownerDomain: 'agriculture', lane: 'homestead',
      decisionContract: 'property-operation-decision/1', workOrderId: value.workOrderId,
      providerEmailHash: value.providerEmailHash, propertyRefHash: value.propertyRefHash, operationKind: value.operationKind,
      subjectHash: value.subjectHash, contentHash: value.contentHash, evidenceHash: value.evidenceHash,
      agriculturePacketId: packet.packetId || null,
      predictedOutcome: blockers.length ? null : { providerAcceptance: true, counterpartyReply: 'independently-observed-inbound-email-or-timeout', operationCompletion: 'unobserved-until-separate-service-evidence' },
      decidedAt: at, expiresAt: at + MAX_DECISION_AGE_MS, providerCalled: false, liveMoney: false
    });
  } catch (error) {
    return { ok: true, status: 'NO_ACTION', released: false, reason: 'agriculture-b10-unavailable', blockers: ['decision-persistence-or-input-unavailable'], detail: String(error && error.message || error), providerCalled: false, liveMoney: false };
  }
}

function validateReceipt(receipt, value, now) {
  var at = Number(now) || Date.now();
  if (!validCandidate(value) || !receipt || receipt.schemaVersion !== SCHEMA || receipt.status !== 'RELEASED' || receipt.released !== true) return false;
  var actionId = 'aha_' + hash({ workOrderId: value.workOrderId, provider: value.providerEmailHash, property: value.propertyRefHash,
    kind: value.operationKind, content: value.contentHash, evidence: value.evidenceHash }).slice(0, 24);
  return receipt.actionId === actionId && receipt.providerEmailHash === value.providerEmailHash &&
    receipt.propertyRefHash === value.propertyRefHash && receipt.subjectHash === value.subjectHash &&
    receipt.contentHash === value.contentHash && Number(receipt.decidedAt) <= at && at < Number(receipt.expiresAt);
}

module.exports = { SCHEMA: SCHEMA, CANDIDATE_SCHEMA: CANDIDATE_SCHEMA, LOG_KEY: LOG_KEY, key: key, hash: hash,
  candidate: candidate, validateCandidate: validCandidate, validBrain: validBrain, decide: decide, validateReceipt: validateReceipt };
