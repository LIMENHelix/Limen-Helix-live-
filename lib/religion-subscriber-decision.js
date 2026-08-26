'use strict';

/** Religion-local B10 decision for one exact paid-subscriber fulfillment candidate. */
var crypto = require('node:crypto');
var Redis = require('./redis-kv.js');
var SCHEMA = 'religion-subscriber-decision/1.0';
var LOG_KEY = 'religion_subscriber_decision_log';
var PREFIX = 'religion_subscriber_decision:';
var MAX_COGNITION_AGE_MS = 45 * 60 * 1000;
var MAX_DECISION_AGE_MS = 10 * 60 * 1000;
function hash(value) { return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex'); }
function key(id) { return PREFIX + id; }
function text(v) { return typeof v === 'string' && v.trim() ? v.trim() : null; }
function candidate(subscriber, digest) {
  var email = text(subscriber && subscriber.email), domain = text(subscriber && subscriber.domain);
  var subject = text(digest && digest.subject), body = text(digest && digest.body), digestKey = text(digest && digest.key);
  if (!email || !domain || !subject || !body || !digestKey || !subscriber.active) return null;
  return {
    schemaVersion: 'religion-subscriber-candidate/1.0', productDomain: 'religion', ownerDomain: 'religion', lane: 'subscriber-email',
    email: email.toLowerCase(), emailHash: hash(email.toLowerCase()), subject: subject, subjectHash: hash(subject),
    body: body, contentHash: hash(body), digestKey: digestKey, subscriberDomain: domain,
    subscriptionIdentity: { active: true, subscriptionIdHash: subscriber.subscriptionId ? hash(String(subscriber.subscriptionId)) : null,
      customerIdHash: subscriber.customerId ? hash(String(subscriber.customerId)) : null },
    fulfillmentOnly: true, liveMoney: false
  };
}
function validateCandidate(v) {
  return !!(v && v.schemaVersion === 'religion-subscriber-candidate/1.0' && v.productDomain === 'religion' &&
    v.ownerDomain === 'religion' && v.lane === 'subscriber-email' && text(v.email) && v.email === v.email.toLowerCase() &&
    v.emailHash === hash(v.email) && text(v.subject) && v.subjectHash === hash(v.subject) && text(v.body) &&
    v.contentHash === hash(v.body) && text(v.digestKey) && text(v.subscriberDomain) &&
    v.subscriptionIdentity && v.subscriptionIdentity.active === true && v.fulfillmentOnly === true);
}
async function cognition(deps) { return deps && deps.cognition ? deps.cognition : (deps && deps.redisGet || Redis.redisGet)('limen:brain:cognition:religion'); }
function validCognition(entry, now) {
  var c = entry && entry.c, ts = Number(entry && entry.ts), p = c && c.serverPacket, generated = Date.parse(p && p.generatedAt);
  return !!(c && c.domain === 'religion' && Number.isFinite(ts) && now >= ts && now - ts <= MAX_COGNITION_AGE_MS &&
    p && p.schemaVersion === 'civilization-domain-packet/1.0' && p.domainId === 'religion' && p.sourceIdentity &&
    p.sourceIdentity.producer === 'brain-cognition-refresh/1' && Number.isFinite(generated) && now >= generated && now - generated <= MAX_COGNITION_AGE_MS);
}
async function persist(store, receipt) {
  var k = key(receipt.decisionReceiptId), created = await store.setIfAbsent(k, receipt), restored = await store.get(k);
  if (!restored || restored.schemaVersion !== SCHEMA || restored.status !== receipt.status || restored.actionId !== receipt.actionId) throw new Error('religion subscriber decision readback invalid');
  if (created) { await store.lpush(LOG_KEY, restored); await store.ltrim(LOG_KEY, 0, 999); }
  return restored;
}
function held(reason, blockers, extra) { return Object.assign({ ok: true, status: 'NO_ACTION', released: false, reason: reason,
  blockers: blockers || [], productDomain: 'religion', ownerDomain: 'religion', lane: 'subscriber-email',
  providerCalled: false, liveMoney: false }, extra || {}); }
async function decide(store, value, now, deps) {
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  if (!validateCandidate(value)) return held('religion-b10-candidate-refused', ['paid-subscriber-candidate-invalid']);
  try {
    store.assertDurable(); var entry = await cognition(deps || {}), blockers = [];
    if (!validCognition(entry, at)) blockers.push('religion-brain-state-missing-or-stale');
    var c = entry && entry.c || {}, p = c.serverPacket || {}, truth = p.truth || {}, organs = c.brainOrgans || {};
    if (!blockers.length) {
      if ((c.immune || {}).immuneState !== 'clear') blockers.push('religion-immune-veto');
      if ((c.awareness || {}).humanReviewRequired === true) blockers.push('religion-human-review-veto');
      if ((organs.autonomousInternalEmission || {}).holdReason) blockers.push('religion-b10-brake-held:' + organs.autonomousInternalEmission.holdReason);
      if (!truth.feedHealth || !(Number(truth.feedHealth.live) > 0)) blockers.push('religion-live-feeds-unavailable');
      var metabolism = organs.resourceMetabolism || {}, gates = metabolism.gates || {};
      if (metabolism.state !== 'AVAILABLE' || gates.mayRunInternalCycle !== true) blockers.push('religion-resource-metabolism-inhibited');
    }
    var actionId = 'rsa_' + hash({ emailHash: value.emailHash, digestKey: value.digestKey, contentHash: value.contentHash }).slice(0, 24);
    var status = blockers.length ? 'NO_ACTION' : 'RELEASED';
    var receipt = { schemaVersion: SCHEMA, decisionReceiptId: 'rsd_' + hash({ actionId: actionId, packetId: p.packetId || null, status: status, blockers: blockers }).slice(0, 24),
      actionId: actionId, status: status, released: status === 'RELEASED', reason: blockers.length ? 'religion-b10-held' : null, blockers: blockers,
      productDomain: 'religion', ownerDomain: 'religion', lane: 'subscriber-email', decisionContract: 'paid-subscriber-fulfillment-decision/1',
      emailHash: value.emailHash, subscriberDomain: value.subscriberDomain, digestKey: value.digestKey, subjectHash: value.subjectHash,
      contentHash: value.contentHash, religionPacketId: p.packetId || null,
      selectionReasons: blockers.length ? [] : ['active-paid-subscription', 'changed-source-grounded-digest', 'religion-brain-safe-to-fulfill'],
      predictedOutcome: blockers.length ? null : { providerAcceptance: true, mailServerEvent: 'delivered-or-terminal-failure' },
      decidedAt: at, expiresAt: at + MAX_DECISION_AGE_MS, providerCalled: false, liveMoney: false };
    return persist(store, receipt);
  } catch (error) { return held('religion-b10-unavailable', ['decision-persistence-or-input-unavailable'], { detail: String(error && error.message || error) }); }
}
function validateReceipt(receipt, value, now) {
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  return !!(validateCandidate(value) && receipt && receipt.schemaVersion === SCHEMA && receipt.status === 'RELEASED' && receipt.released === true &&
    receipt.actionId === 'rsa_' + hash({ emailHash: value.emailHash, digestKey: value.digestKey, contentHash: value.contentHash }).slice(0, 24) &&
    receipt.emailHash === value.emailHash && receipt.subjectHash === value.subjectHash && receipt.contentHash === value.contentHash &&
    Number(receipt.decidedAt) <= at && at < Number(receipt.expiresAt));
}
module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, MAX_COGNITION_AGE_MS: MAX_COGNITION_AGE_MS,
  hash: hash, key: key, candidate: candidate, validateCandidate: validateCandidate, validCognition: validCognition,
  decide: decide, validateReceipt: validateReceipt };
