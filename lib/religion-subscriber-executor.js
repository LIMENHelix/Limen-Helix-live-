'use strict';

/** Religion-local capped batch executor with durable per-message identity. */
var crypto = require('node:crypto');
var Decision = require('./religion-subscriber-decision.js');
var MotorAuthorization = require('./product-domain-motor-authorization.js');
var Learning = require('./religion-subscriber-learning.js');
var SCHEMA = 'religion-subscriber-command/1.0';
var LOG_KEY = 'religion_subscriber_command_log', PENDING_LOG_KEY = 'religion_subscriber_pending_log';
var PREFIX = 'religion_subscriber_command:', MOTOR_PREFIX = 'religion_subscriber_motor_claim:', ACTION_PREFIX = 'religion_subscriber_action:';
var BUDGET_PREFIX = 'religion_subscriber_budget_slot:';
var SUPPRESSION_KEY = 'religion_subscriber_suppression_catalog';
var HARD_MAX_SENDS = 100;
function hash(v) { return crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex'); }
function commandKey(id) { return PREFIX + id; } function motorClaimKey(id) { return MOTOR_PREFIX + id; } function actionKey(id) { return ACTION_PREFIX + id; }
function dayKey(now) { return new Date(now).toISOString().slice(0, 10); }
function budgetSlotKey(day, slot) { return BUDGET_PREFIX + day + ':' + slot; }
async function claimBudgetSlot(store, actionId, slots, now, costUsd) {
  var day = dayKey(now);
  for (var i = 1; i <= slots; i++) {
    var key = budgetSlotKey(day, i), value = { schemaVersion: SCHEMA, actionId: actionId, day: day, slot: i, estimatedCostUsd: costUsd, claimedAt: now };
    var created = await store.setIfAbsent(key, value), restored = await store.get(key);
    if (restored && restored.actionId === actionId) return { ok: true, key: key, slot: i, duplicate: !created };
  }
  return { ok: false, reason: 'religion-subscriber-daily-budget-exhausted' };
}
async function setCommand(store, value) { await store.set(commandKey(value.commandId), value); var r = await store.get(commandKey(value.commandId));
  if (!r || r.commandId !== value.commandId || r.status !== value.status) throw new Error('religion subscriber command readback invalid'); return r; }
function held(reason, extra) { return Object.assign({ ok: true, status: 'HELD', accepted: 0, reason: reason, productDomain: 'religion', ownerDomain: 'religion', lane: 'subscriber-email', liveMoney: false }, extra || {}); }
async function execute(input) {
  input = input || {}; var store = input.store, specs = Array.isArray(input.specs) ? input.specs : [], now = Number(input.now) || Date.now();
  var cap = Math.max(0, Math.min(HARD_MAX_SENDS, Number(input.maxSends) || 0));
  if (!cap) return held('religion-subscriber-send-cap-zero');
  var emailCostUsd = Number(input.emailCostUsd), dailySendCap = Math.max(0, Math.min(1000, Number(input.dailySendCap) || 0));
  var dailyBudgetUsd = Number(input.dailyBudgetUsd);
  if (input.emailCostUsd == null || !Number.isFinite(emailCostUsd) || emailCostUsd < 0) return held('religion-subscriber-email-unit-cost-not-configured');
  if (!dailySendCap) return held('religion-subscriber-daily-send-cap-zero');
  if (emailCostUsd > 0 && (!Number.isFinite(dailyBudgetUsd) || dailyBudgetUsd < emailCostUsd)) return held('religion-subscriber-daily-dollar-budget-not-configured-or-too-small');
  var dailySlots = Math.min(dailySendCap, emailCostUsd === 0 ? dailySendCap : Math.floor((dailyBudgetUsd + 1e-12) / emailCostUsd));
  if (!dailySlots) return held('religion-subscriber-daily-budget-zero');
  specs = specs.filter(function (s) { return s && Decision.validateReceipt(s.decision, s.candidate, now); }).slice(0, cap);
  if (!specs.length) return held('religion-subscriber-no-released-exact-decisions');
  try {
    store.assertDurable(); var suppression = await store.get(SUPPRESSION_KEY); if (!suppression || typeof suppression !== 'object') suppression = {};
    specs = specs.filter(function (s) { return !(suppression[s.candidate.emailHash] && suppression[s.candidate.emailHash].suppressed); });
    if (!specs.length) return held('religion-subscriber-all-candidates-suppressed');
    var authorize = input.motorAuthorization || MotorAuthorization;
    var motor = await authorize.authorize(store, 'religion', 'subscriber-email', now);
    if (!motor || !motor.authorized) return held(motor && motor.reason || 'religion-subscriber-motor-held', { motorReceiptId: motor && motor.receiptId || null, motorBlockers: motor && motor.blockers || [] });
    var commandId = 'rsc_' + hash({ motor: motor.receiptId, actions: specs.map(function (s) { return s.decision.actionId; }) }).slice(0, 24);
    var existing = await store.get(commandKey(commandId)); if (existing) return Object.assign({ ok: true, replayed: true, accepted: existing.accepted || 0 }, existing);
    var command = { schemaVersion: SCHEMA, commandId: commandId, status: 'COMMANDING', productDomain: 'religion', ownerDomain: 'religion', lane: 'subscriber-email',
      productMotorReceiptId: motor.receiptId, maxSends: cap, items: specs.map(function (s) { return { actionId: s.decision.actionId, decisionReceiptId: s.decision.decisionReceiptId,
        emailHash: s.candidate.emailHash, subscriberDomain: s.candidate.subscriberDomain, digestKey: s.candidate.digestKey,
        subjectHash: s.candidate.subjectHash, contentHash: s.candidate.contentHash, status: 'QUEUED' }; }),
      predictedCount: specs.length, accepted: 0, failed: 0, ambiguous: 0, budgetHeld: 0, providerCalls: 0,
      emailCostUsd: emailCostUsd, dailyBudgetUsd: emailCostUsd === 0 ? 0 : dailyBudgetUsd, dailySendCap: dailySlots,
      commandedAt: now, liveMoney: false };
    if (!(await store.setIfAbsent(commandKey(commandId), command))) return store.get(commandKey(commandId));
    command = await store.get(commandKey(commandId)); if (!command || command.status !== 'COMMANDING') throw new Error('religion subscriber pre-dispatch command readback invalid');
    var motorClaim = { schemaVersion: SCHEMA, commandId: commandId, productMotorReceiptId: motor.receiptId, claimedAt: now };
    if (!(await store.setIfAbsent(motorClaimKey(motor.receiptId), motorClaim))) { command.status = 'REFUSED'; command.reason = 'religion-subscriber-motor-receipt-already-consumed'; return setCommand(store, command); }
    var restoredMotorClaim = await store.get(motorClaimKey(motor.receiptId));
    if (!restoredMotorClaim || restoredMotorClaim.commandId !== commandId) throw new Error('religion subscriber motor claim readback invalid');
    await store.lpush(PENDING_LOG_KEY, command); await store.ltrim(PENDING_LOG_KEY, 0, 999);
    var transport = input.transport; if (!transport || typeof transport.send !== 'function') throw new Error('religion subscriber transport missing');
    for (var i = 0; i < specs.length; i++) {
      var spec = specs[i], item = command.items[i], idempotencyKey = 'religion-digest/' + item.actionId;
      var claim = { schemaVersion: SCHEMA, actionId: item.actionId, commandId: commandId, status: 'DISPATCHING', idempotencyKey: idempotencyKey, claimedAt: Date.now() };
      var prior = await store.get(actionKey(item.actionId));
      if (prior) {
        item.status = prior.status || 'PREVIOUSLY_CLAIMED'; item.providerEmailId = prior.providerEmailId || null;
        if (item.status === 'ACCEPTED') command.accepted++; else if (item.status === 'FAILED') command.failed++; else command.ambiguous++;
        continue;
      }
      var budgetClaim = await claimBudgetSlot(store, item.actionId, dailySlots, now, emailCostUsd);
      if (!budgetClaim.ok) { item.status = 'BUDGET_HELD'; item.failure = budgetClaim.reason; command.budgetHeld++; continue; }
      item.budgetSlot = budgetClaim.slot; item.estimatedCostUsd = emailCostUsd;
      if (!(await store.setIfAbsent(actionKey(item.actionId), claim))) {
        prior = await store.get(actionKey(item.actionId)); item.status = prior && prior.status || 'PREVIOUSLY_CLAIMED'; item.providerEmailId = prior && prior.providerEmailId || null;
        if (item.status === 'ACCEPTED') command.accepted++; else if (item.status === 'FAILED') command.failed++; else command.ambiguous++;
        continue;
      }
      var restoredClaim = await store.get(actionKey(item.actionId));
      if (!restoredClaim || restoredClaim.commandId !== commandId || restoredClaim.status !== 'DISPATCHING') throw new Error('religion subscriber action claim readback invalid');
      item.status = 'DISPATCHING'; item.idempotencyKey = idempotencyKey; command.status = 'DISPATCHING'; command = await setCommand(store, command);
      item = command.items[i];
      await Learning.recordCommand(store, command, item);
      var result; try { result = await transport.send(spec.candidate.email, spec.candidate.subject, spec.candidate.body, { idempotencyKey: idempotencyKey }); }
      catch (error) { result = { ok: false, ambiguous: true, providerCalled: true, error: String(error && error.message || error) }; }
      item.status = result && result.ok && result.id ? 'ACCEPTED' : (result && result.definitiveFailure ? 'FAILED' : 'AMBIGUOUS');
      item.providerEmailId = result && result.id || null; item.providerCalled = !(result && result.providerCalled === false);
      item.failure = result && !result.ok ? String(result.error || 'send-unresolved').slice(0, 240) : null; item.resolvedAt = Date.now();
      if (item.providerCalled) command.providerCalls++; if (item.status === 'ACCEPTED') command.accepted++; else if (item.status === 'FAILED') command.failed++; else command.ambiguous++;
      var action = Object.assign({}, claim, { status: item.status, providerEmailId: item.providerEmailId, providerCalled: item.providerCalled, resolvedAt: item.resolvedAt });
      await store.set(actionKey(item.actionId), action); var restoredAction = await store.get(actionKey(item.actionId));
      if (!restoredAction || restoredAction.status !== item.status || restoredAction.commandId !== commandId) throw new Error('religion subscriber action readback invalid');
      command = await setCommand(store, command);
    }
    command.status = command.ambiguous ? 'PARTIAL_AMBIGUOUS' : command.failed && !command.accepted ? 'FAILED'
      : command.budgetHeld && !command.accepted ? 'HELD_BUDGET' : 'RECEIPTS_PERSISTED';
    command.estimatedCommittedUsd = (command.accepted + command.ambiguous + command.failed) * emailCostUsd;
    command.completedAt = Date.now(); command.readbackVerified = true; command = await setCommand(store, command);
    await store.lpush(LOG_KEY, command); await store.ltrim(LOG_KEY, 0, 999);
    return Object.assign({ ok: command.status === 'RECEIPTS_PERSISTED' || command.accepted > 0 }, command);
  } catch (error) { return { ok: false, status: 'REFUSED', accepted: 0, reason: 'religion-subscriber-strict-boundary-unavailable', detail: String(error && error.message || error), liveMoney: false }; }
}
module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, PENDING_LOG_KEY: PENDING_LOG_KEY, SUPPRESSION_KEY: SUPPRESSION_KEY,
  HARD_MAX_SENDS: HARD_MAX_SENDS, commandKey: commandKey, motorClaimKey: motorClaimKey, actionKey: actionKey, execute: execute };
