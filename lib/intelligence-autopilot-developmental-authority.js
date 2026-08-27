'use strict';

/**
 * One permanent bootstrap slot for the Intelligence CRM email motor.
 *
 * This does not grant ordinary outreach authority. It can release only the
 * exact consented Intelligence candidate whose normalized recipient matches
 * the explicitly configured LIMEN-owned commissioning address. B10 must have
 * released first and the current product motor must still prove simulation
 * readiness. The slot is permanent, so retries can replay the same action but
 * cannot send a second candidate.
 */

var crypto = require('node:crypto');
var Decision = require('./intelligence-autopilot-decision.js');
var MotorReceipt = require('./product-domain-motor-receipt.js');
var MotorAuthorization = require('./product-domain-motor-authorization.js');

var SCHEMA = 'intelligence-autopilot-developmental-authority/1.0';
var SLOT_KEY = 'intelligence_autopilot_developmental_slot:1';
var LOG_KEY = 'intelligence_autopilot_developmental_log';

function hash(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function normalizeEmail(value) { return typeof value === 'string' ? value.trim().toLowerCase() : ''; }
function held(reason, detail) {
  return { ok: true, authorized: false, status: 'HELD', reason: reason, detail: detail || null, liveMoney: false };
}
function enabled(env) { return String((env || process.env).INTELLIGENCE_AUTOPILOT_DEVELOPMENTAL_ENABLED || '') === '1'; }
function commissioningEmail(env) { return normalizeEmail((env || process.env).INTELLIGENCE_AUTOPILOT_COMMISSIONING_EMAIL); }
function validMotor(motor, now) {
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  return !!(motor && motor.schemaVersion === MotorReceipt.SCHEMA &&
    motor.productDomain === 'intelligence' && motor.ownerDomain === 'intelligence' &&
    motor.contractId === 'intelligence-motor/1' && motor.lane === 'autopilot' &&
    motor.status === 'HELD' && motor.gates && motor.gates.mayPrepare === true &&
    motor.gates.maySimulate === true && motor.gates.mayDispatchExternal === false &&
    motor.safety && motor.safety.externalEffectExecuted === false &&
    motor.safety.providerCalled === false && motor.safety.brokerTouched === false &&
    Number(motor.safety.spendUsd) === 0 && Number.isFinite(Number(motor.persistedAt)) &&
    at >= Number(motor.persistedAt) && at - Number(motor.persistedAt) <= MotorAuthorization.MAX_AGE_MS);
}

async function authorize(store, candidate, decision, env, now) {
  if (!enabled(env)) return held('intelligence-autopilot-developmental-switch-off');
  var target = commissioningEmail(env);
  if (!target) return held('intelligence-autopilot-commissioning-address-missing');
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  if (!Decision.validateCandidate(candidate) || !Decision.validateReceipt(decision, candidate, at)) {
    return held('intelligence-autopilot-developmental-exact-b10-decision-required');
  }
  if (candidate.email !== target || candidate.emailHash !== hash(target) || candidate.consentVerified !== true) {
    return held('intelligence-autopilot-developmental-owned-recipient-mismatch');
  }
  try {
    store.assertDurable();
    var motor = await store.get(MotorReceipt.receiptKey('intelligence'));
    if (!validMotor(motor, at)) return held('intelligence-autopilot-developmental-motor-receipt-invalid', motor);
    var slot = {
      schemaVersion: SCHEMA,
      receiptId: 'ia_dev_' + hash(decision.actionId + '\u0000' + motor.receiptId).slice(0, 24),
      slot: 1,
      status: 'CLAIMED',
      productDomain: 'intelligence',
      ownerDomain: 'intelligence',
      lane: 'autopilot',
      actionId: decision.actionId,
      decisionReceiptId: decision.decisionReceiptId,
      emailHash: candidate.emailHash,
      productMotorReceiptId: motor.receiptId,
      claimedAt: new Date(at).toISOString(),
      maxProviderCalls: 1,
      ownedDestinationVerified: true,
      recipientConsentVerified: true,
      commissioningOnly: true,
      businessStateTransitionAuthorized: false,
      liveMoney: false
    };
    var created = await store.setIfAbsent(SLOT_KEY, slot);
    var restored = await store.get(SLOT_KEY);
    if (!created && (!restored || restored.actionId !== decision.actionId || restored.emailHash !== candidate.emailHash)) {
      return held('intelligence-autopilot-developmental-attempt-cap-reached', restored);
    }
    if (!restored || restored.schemaVersion !== SCHEMA || restored.receiptId !== slot.receiptId || restored.status !== 'CLAIMED') {
      return held('intelligence-autopilot-developmental-claim-readback-failed');
    }
    if (created) {
      await store.lpush(LOG_KEY, { type: 'CLAIMED', receiptId: restored.receiptId, actionId: restored.actionId, at: restored.claimedAt });
      await store.ltrim(LOG_KEY, 0, 99);
    }
    return {
      ok: true,
      authorized: true,
      status: 'AUTHORIZED_DEVELOPMENTAL_AUTOPILOT',
      authorizationMode: 'developmental-autopilot-commissioning',
      receiptId: restored.receiptId,
      productDomain: 'intelligence',
      ownerDomain: 'intelligence',
      contractId: motor.contractId,
      lane: 'autopilot',
      slot: restored,
      commissioningOnly: true,
      ownedDestinationVerified: true,
      recipientConsentVerified: true,
      liveMoney: false
    };
  } catch (error) {
    return held('intelligence-autopilot-developmental-authorization-unavailable', String(error && error.message || error));
  }
}

module.exports = {
  SCHEMA: SCHEMA,
  SLOT_KEY: SLOT_KEY,
  LOG_KEY: LOG_KEY,
  enabled: enabled,
  commissioningEmail: commissioningEmail,
  validMotor: validMotor,
  authorize: authorize
};
