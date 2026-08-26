'use strict';

/**
 * Finance-local, co-timed external authorization for paid subscriber email.
 *
 * Finance already owns a separate broker/order motor.  This local valve keeps
 * subscriber fulfillment from borrowing Religion's authority or overwriting
 * the broker lane.  It releases no effect itself: it only persists and reads
 * back a short-lived authorization receipt for the exact Finance packet.
 */
var crypto = require('node:crypto');
var Redis = require('./redis-kv.js');
var Decision = require('./finance-subscriber-decision.js');

var SCHEMA = 'finance-subscriber-motor-authorization/1.0';
var LOG_KEY = 'finance_subscriber_motor_authorization_log';
var PREFIX = 'finance_subscriber_motor_authorization:';
var MAX_AGE_MS = 10 * 60 * 1000;

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function held(reason, blockers) {
  return { ok: true, authorized: false, status: 'HELD', reason: reason,
    blockers: blockers || [], productDomain: 'finance', ownerDomain: 'finance',
    lane: 'subscriber-email', providerCalled: false, liveMoney: false };
}
function key(id) { return PREFIX + id; }

async function authorize(store, productDomain, lane, now, deps) {
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  if (productDomain !== 'finance' || lane !== 'subscriber-email') return held('finance-subscriber-authority-identity-mismatch');
  if (String(process.env.FINANCE_SUBSCRIBER_EMAIL_ENABLED || '') !== '1') return held('finance-subscriber-email-switch-closed');
  if (String(process.env.FINANCE_SUBSCRIBER_OUTCOME_OBSERVER_ENABLED || '') !== '1') return held('finance-subscriber-outcome-observer-switch-closed');
  try {
    store.assertDurable();
    var entry = deps && deps.cognition ? deps.cognition : await (deps && deps.redisGet || Redis.redisGet)('limen:brain:cognition:finance');
    if (!Decision.validCognition(entry, at)) return held('finance-brain-state-missing-or-stale');
    var c = entry.c || {}, organs = c.brainOrgans || {}, blockers = [];
    if ((c.immune || {}).immuneState !== 'clear') blockers.push('finance-immune-veto');
    if ((c.awareness || {}).humanReviewRequired === true) blockers.push('finance-human-review-veto');
    if ((organs.autonomousInternalEmission || {}).holdReason) blockers.push('finance-b10-brake-held:' + organs.autonomousInternalEmission.holdReason);
    var metabolism = organs.resourceMetabolism || {}, gates = metabolism.gates || {};
    if (metabolism.state !== 'AVAILABLE' || gates.mayRunInternalCycle !== true) blockers.push('finance-resource-metabolism-inhibited');
    if (blockers.length) return held('finance-subscriber-motor-held', blockers);
    var packet = c.serverPacket || {};
    var receiptId = 'fsmr_' + hash({ packetId: packet.packetId, lane: lane, authorizedAt: at }).slice(0, 24);
    var receipt = { schemaVersion: SCHEMA, receiptId: receiptId, authorized: true, status: 'AUTHORIZED',
      productDomain: 'finance', ownerDomain: 'finance', lane: 'subscriber-email',
      financePacketId: packet.packetId, authorizedAt: at, expiresAt: at + MAX_AGE_MS,
      safety: { externalEffectExecuted: false, providerCalled: false, spendUsd: 0 }, liveMoney: false };
    await store.setIfAbsent(key(receiptId), receipt);
    var restored = await store.get(key(receiptId));
    if (!restored || restored.schemaVersion !== SCHEMA || restored.receiptId !== receiptId || restored.authorized !== true) {
      throw new Error('finance subscriber motor authorization readback invalid');
    }
    await store.lpush(LOG_KEY, restored); await store.ltrim(LOG_KEY, 0, 999);
    return restored;
  } catch (error) {
    return held('finance-subscriber-motor-authorization-unavailable', [String(error && error.message || error)]);
  }
}

module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, MAX_AGE_MS: MAX_AGE_MS, key: key, authorize: authorize };
