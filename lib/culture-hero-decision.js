'use strict';

/** Culture-local B10 decision for one exact canonical visual-maintenance action. */
var crypto = require('node:crypto');
var Redis = require('./redis-kv.js');
var Policy = require('./culture-hero-policy.js');

var SCHEMA = 'culture-hero-decision/1.0';
var LOG_KEY = 'culture_hero_decision_log';
var PREFIX = 'culture_hero_decision:';
var MAX_COGNITION_AGE_MS = 45 * 60 * 1000;
var MAX_DECISION_AGE_MS = 10 * 60 * 1000;
function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function key(id) { return PREFIX + id; }
function held(reason, blockers, extra) { return Object.assign({ ok: true, status: 'NO_ACTION', released: false,
  reason: reason, blockers: blockers || [], productDomain: 'culture', ownerDomain: 'culture', lane: 'hero-image',
  providerCalled: false, spentUsd: 0, liveMoney: false }, extra || {}); }
async function cognition(deps) {
  if (deps && deps.cognition) return deps.cognition;
  return (deps && deps.redisGet || Redis.redisGet)('limen:brain:cognition:culture');
}
function validCognition(entry, now) {
  var c = entry && entry.c, ts = Number(entry && entry.ts), p = c && c.serverPacket;
  var generated = Date.parse(p && p.generatedAt);
  return !!(c && c.domain === 'culture' && Number.isFinite(ts) && now >= ts && now - ts <= MAX_COGNITION_AGE_MS &&
    p && p.schemaVersion === 'civilization-domain-packet/1.0' && p.domainId === 'culture' &&
    p.sourceIdentity && p.sourceIdentity.producer === 'brain-cognition-refresh/1' &&
    Number.isFinite(generated) && now >= generated && now - generated <= MAX_COGNITION_AGE_MS);
}
async function persist(store, receipt) {
  var k = key(receipt.decisionReceiptId);
  var created = await store.setIfAbsent(k, receipt);
  var restored = await store.get(k);
  if (!restored || restored.schemaVersion !== SCHEMA || restored.decisionReceiptId !== receipt.decisionReceiptId ||
      restored.status !== receipt.status || restored.promptHash !== receipt.promptHash) {
    throw new Error('culture hero decision: receipt readback invalid');
  }
  if (created) { await store.lpush(LOG_KEY, restored); await store.ltrim(LOG_KEY, 0, 999); }
  return restored;
}
async function decide(store, candidate, now, deps) {
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  if (!Policy.validate(candidate)) return held('culture-b10-candidate-refused', ['candidate-not-canonical-culture-policy']);
  try {
    store.assertDurable();
    var entry = await cognition(deps || {}), blockers = [];
    if (!validCognition(entry, at)) blockers.push('culture-brain-state-missing-or-stale');
    var c = entry && entry.c || {}, packet = c.serverPacket || {}, truth = packet.truth || {};
    var immune = c.immune || {}, awareness = c.awareness || {}, organs = c.brainOrgans || {};
    var metabolism = organs.resourceMetabolism || {}, gates = metabolism.gates || {};
    if (!blockers.length) {
      if (immune.immuneState !== 'clear') blockers.push('culture-immune-veto');
      if (awareness.humanReviewRequired === true) blockers.push('culture-human-review-veto');
      if (!truth.feedHealth || !(Number(truth.feedHealth.live) > 0)) blockers.push('culture-live-feeds-unavailable');
      if (metabolism.state !== 'AVAILABLE' || gates.mayRunInternalCycle !== true) blockers.push('culture-resource-metabolism-inhibited');
      if ((organs.autonomousInternalEmission || {}).holdReason) blockers.push('culture-b10-brake-held:' + organs.autonomousInternalEmission.holdReason);
    }
    var status = blockers.length ? 'NO_ACTION' : 'RELEASED';
    var id = 'chd_' + hash({ status: status, promptHash: candidate.promptHash, packetId: packet.packetId || null,
      reason: candidate.reason, blockers: blockers }).slice(0, 24);
    return persist(store, {
      schemaVersion: SCHEMA, decisionReceiptId: id, status: status, released: status === 'RELEASED',
      reason: blockers.length ? 'culture-b10-held' : null, blockers: blockers,
      productDomain: 'culture', ownerDomain: 'culture', lane: 'hero-image',
      decisionContract: 'canonical-visual-maintenance-decision/1', assetDomain: candidate.assetDomain,
      model: candidate.model, promptHash: candidate.promptHash, policyIdentity: candidate.policyIdentity,
      culturePacketId: packet.packetId || null,
      selectionReasons: blockers.length ? [] : ['canonical-visual-backlog-present', 'culture-brain-safe-to-maintain'],
      predictedOutcome: blockers.length ? null : { publicAsset: 'RETRIEVABLE_IMAGE', catalogPresence: 'PRESENT' },
      decidedAt: at, expiresAt: at + MAX_DECISION_AGE_MS,
      providerCalled: false, spentUsd: 0, liveMoney: false
    });
  } catch (error) {
    return held('culture-b10-unavailable', ['decision-persistence-or-input-unavailable'], { detail: String(error && error.message || error) });
  }
}
function validateReceipt(receipt, candidate, now) {
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  return !!(Policy.validate(candidate) && receipt && receipt.schemaVersion === SCHEMA && receipt.status === 'RELEASED' &&
    receipt.released === true && receipt.productDomain === 'culture' && receipt.ownerDomain === 'culture' &&
    receipt.lane === 'hero-image' && receipt.assetDomain === candidate.assetDomain && receipt.model === candidate.model &&
    receipt.promptHash === candidate.promptHash && Number(receipt.decidedAt) <= at && at < Number(receipt.expiresAt));
}

module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, key: key, decide: decide, validateReceipt: validateReceipt,
  validCognition: validCognition, MAX_COGNITION_AGE_MS: MAX_COGNITION_AGE_MS };
