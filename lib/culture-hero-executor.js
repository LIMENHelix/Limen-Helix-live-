'use strict';

/** Culture-local one-shot executor. B10 decision and B14 command precede spend/provider dispatch. */
var crypto = require('node:crypto');
var Decision = require('./culture-hero-decision.js');
var MotorAuthorization = require('./product-domain-motor-authorization.js');
var Learning = require('./culture-hero-learning.js');
var AdapterGuard = require('./civilization-adapter-guard.js');

var SCHEMA = 'culture-hero-command/1.0';
var LOG_KEY = 'culture_hero_command_log';
var PENDING_LOG_KEY = 'culture_hero_pending_log';
var PREFIX = 'culture_hero_command:';
var MOTOR_PREFIX = 'culture_hero_motor_claim:';
function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function commandKey(id) { return PREFIX + id; }
function motorClaimKey(id) { return MOTOR_PREFIX + id; }
async function strictSet(store, key, value) {
  await store.set(key, value);
  var restored = await store.get(key);
  if (!restored || restored.schemaVersion !== value.schemaVersion || restored.commandId !== value.commandId || restored.status !== value.status) {
    throw new Error('culture hero executor: command readback invalid');
  }
  return restored;
}
function held(reason, extra) { return Object.assign({ ok: true, status: 'HELD', generated: false, reason: reason,
  productDomain: 'culture', ownerDomain: 'culture', lane: 'hero-image', liveMoney: false }, extra || {}); }

async function execute(input) {
  input = input || {};
  var store = input.store, candidate = input.candidate, decision = input.decision;
  var now = Number.isFinite(Number(input.now)) ? Number(input.now) : Date.now();
  if (!Decision.validateReceipt(decision, candidate, now)) return held('culture-hero-b10-decision-missing-invalid-or-expired');
  try {
    store.assertDurable();
    var authorize = input.motorAuthorization || MotorAuthorization;
    var motor = await authorize.authorize(store, 'culture', 'hero-image', now);
    if (!motor || !motor.authorized) return held(motor && motor.reason || 'culture-hero-motor-held', {
      motorReceiptId: motor && motor.receiptId || null, motorBlockers: motor && motor.blockers || []
    });
    var commandId = 'chc_' + hash({ decision: decision.decisionReceiptId, motor: motor.receiptId,
      promptHash: candidate.promptHash }).slice(0, 24);
    var existing = await store.get(commandKey(commandId));
    if (existing) return Object.assign({ ok: existing.status === 'GENERATED', generated: existing.status === 'GENERATED', replayed: true }, existing);
    var claim = { schemaVersion: SCHEMA, commandId: commandId, productMotorReceiptId: motor.receiptId,
      decisionReceiptId: decision.decisionReceiptId, claimedAt: now };
    if (!(await store.setIfAbsent(motorClaimKey(motor.receiptId), claim))) {
      return { ok: false, status: 'REFUSED', generated: false, reason: 'culture-hero-motor-receipt-already-consumed', liveMoney: false };
    }
    var restoredClaim = await store.get(motorClaimKey(motor.receiptId));
    if (!restoredClaim || restoredClaim.commandId !== commandId) throw new Error('culture hero executor: motor claim readback invalid');
    var command = {
      schemaVersion: SCHEMA, commandId: commandId, actionId: commandId, status: 'DISPATCHING', productDomain: 'culture', ownerDomain: 'culture', lane: 'hero-image',
      assetDomain: candidate.assetDomain, model: candidate.model, promptHash: candidate.promptHash,
      decisionReceiptId: decision.decisionReceiptId, productMotorReceiptId: motor.receiptId,
      predictedOutcome: decision.predictedOutcome, commandedAt: now, providerCalled: false, spentUsd: 0, liveMoney: false
    };
    if (!(await store.setIfAbsent(commandKey(commandId), command))) {
      return { ok: false, status: 'REFUSED', generated: false, reason: 'culture-hero-command-already-exists', commandId: commandId, liveMoney: false };
    }
    command = await store.get(commandKey(commandId));
    if (!command || command.status !== 'DISPATCHING') throw new Error('culture hero executor: pre-dispatch command readback invalid');
    var learnedCause = await Learning.recordCommand(store, command);
    if (!learnedCause || learnedCause.ok !== true) throw new Error('culture hero executor: causal memory unavailable');
    await store.lpush(PENDING_LOG_KEY, command); await store.ltrim(PENDING_LOG_KEY, 0, 999);
    var provider = input.provider;
    if (!provider || typeof provider.generate !== 'function') throw new Error('culture hero executor: provider adapter missing');
    var result;
    try {
      command.adapterGuard = await (input.adapterGuard || AdapterGuard).checkpoint(store, 'culture:hero-image', 'paid-image-generation');
      result = await provider.generate(candidate);
    }
    catch (error) { result = { ok: false, providerCalled: error && error.code === AdapterGuard.INHIBITED ? false : true,
      definitiveFailure: error && error.code === AdapterGuard.INHIBITED, ambiguous: error && error.code !== AdapterGuard.INHIBITED,
      error: String(error && error.message || error), spentUsd: null }; }
    var resolved = Object.assign({}, command, {
      status: result && result.ok && result.url ? 'GENERATED' : (result && result.definitiveFailure ? 'FAILED' : 'AMBIGUOUS'),
      providerCalled: !(result && result.providerCalled === false), providerAccepted: !!(result && result.ok && result.url),
      receipt: result && result.ok && result.url ? { url: result.url, providerRequestId: result.requestId || null } : null,
      failure: result && !result.ok ? { reason: result.error || 'provider-generation-unresolved', ambiguous: result.ambiguous !== false } : null,
      spentUsd: result && result.spentUsd != null ? result.spentUsd : null,
      completedAt: Date.now(), readbackVerified: true
    });
    resolved = await strictSet(store, commandKey(commandId), resolved);
    await store.lpush(LOG_KEY, resolved); await store.ltrim(LOG_KEY, 0, 999);
    return Object.assign({ ok: resolved.status === 'GENERATED', generated: resolved.status === 'GENERATED' }, resolved);
  } catch (error) {
    return { ok: false, status: 'REFUSED', generated: false, reason: 'culture-hero-strict-boundary-unavailable',
      detail: String(error && error.message || error), liveMoney: false };
  }
}

module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, PENDING_LOG_KEY: PENDING_LOG_KEY,
  commandKey: commandKey, motorClaimKey: motorClaimKey, execute: execute };
