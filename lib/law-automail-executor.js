'use strict';
var crypto = require('node:crypto');
var Decision = require('./law-automail-decision.js');
var Motor = require('./product-domain-motor-authorization.js');
var SCHEMA = 'law-automail-command/1.0', LOG_KEY = 'law_automail_command_log', PENDING_KEY = 'law_automail_pending_log';
var PREFIX = 'law_automail_command:', ACTION_PREFIX = 'law_automail_action:', MOTOR_PREFIX = 'law_automail_motor_claim:', BUDGET_PREFIX = 'law_automail_budget_slot:';
function hash(v) { return crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex'); }
function commandKey(id) { return PREFIX + id; } function actionKey(id) { return ACTION_PREFIX + id; } function motorKey(id) { return MOTOR_PREFIX + id; }
function held(reason, extra) { return Object.assign({ ok: true, status: 'HELD', accepted: 0, reason: reason, productDomain: 'law', ownerDomain: 'law', lane: 'automail', providerCalls: 0, liveMoney: false }, extra || {}); }
async function claimBudget(store, actionId, slots, now, cost) { var day = new Date(now).toISOString().slice(0, 10);
  for (var i = 1; i <= slots; i++) { var key = BUDGET_PREFIX + day + ':' + i, value = { schemaVersion: SCHEMA, actionId: actionId, slot: i, day: day, estimatedCostUsd: cost, claimedAt: now };
    var created = await store.setIfAbsent(key, value), restored = await store.get(key); if (restored && restored.actionId === actionId) return { ok: true, slot: i, duplicate: !created }; }
  return { ok: false, reason: 'law-automail-daily-budget-exhausted' }; }
async function save(store, command) { await store.set(commandKey(command.commandId), command); var restored = await store.get(commandKey(command.commandId));
  if (!restored || restored.commandId !== command.commandId || restored.status !== command.status) throw new Error('law automail command readback invalid'); return restored; }
async function execute(input) {
  input = input || {}; var store = input.store, candidate = input.candidate, decision = input.decision, now = Number(input.now) || Date.now();
  var liveMoney = input.liveMoney === true;
  if (!Decision.validateReceipt(decision, candidate, now)) return held('law-automail-exact-b10-decision-required');
  var cost = Number(input.letterCostUsd), budget = Number(input.dailyBudgetUsd), cap = Math.max(0, Math.min(200, Number(input.dailyLetterCap) || 0));
  if (!Number.isFinite(cost) || cost <= 0) return held('law-automail-letter-cost-not-configured');
  if (!Number.isFinite(budget) || budget < cost) return held('law-automail-daily-dollar-budget-not-configured-or-too-small');
  var slots = Math.min(cap, Math.floor((budget + 1e-12) / cost)); if (!slots) return held('law-automail-daily-cap-zero');
  try { store.assertDurable(); var authorize = input.motorAuthorization || Motor, motor = await authorize.authorize(store, 'law', 'automail', now);
    if (!motor || !motor.authorized) return held(motor && motor.reason || 'law-automail-motor-held', { motorReceiptId: motor && motor.receiptId || null, motorBlockers: motor && motor.blockers || [] });
    var commandId = 'lac_' + hash({ actionId: decision.actionId, motor: motor.receiptId }).slice(0, 24), existing = await store.get(commandKey(commandId));
    if (existing) return Object.assign({ ok: existing.status === 'ACCEPTED', replayed: true, accepted: existing.status === 'ACCEPTED' ? 1 : 0 }, existing);
    var prior = await store.get(actionKey(decision.actionId)); if (prior) return Object.assign({ ok: prior.status === 'ACCEPTED', replayed: true, accepted: prior.status === 'ACCEPTED' ? 1 : 0 }, prior);
    var command = { schemaVersion: SCHEMA, commandId: commandId, actionId: decision.actionId, decisionReceiptId: decision.decisionReceiptId,
      status: 'COMMANDING', productDomain: 'law', ownerDomain: 'law', lane: 'automail', productMotorReceiptId: motor.receiptId,
      parcelHash: candidate.parcelHash, addressHash: candidate.addressHash, contentHash: candidate.contentHash, predictedOutcome: decision.predictedOutcome,
      estimatedCostUsd: cost, dailyBudgetUsd: budget, dailyLetterCap: cap, providerCalls: 0, commandedAt: now, liveMoney: liveMoney };
    if (!(await store.setIfAbsent(commandKey(commandId), command))) return store.get(commandKey(commandId));
    command = await store.get(commandKey(commandId)); if (!command || command.status !== 'COMMANDING') throw new Error('law automail pre-dispatch command readback invalid');
    var motorClaim = { schemaVersion: SCHEMA, commandId: commandId, productMotorReceiptId: motor.receiptId, claimedAt: now };
    if (!(await store.setIfAbsent(motorKey(motor.receiptId), motorClaim))) { command.status = 'REFUSED'; command.reason = 'law-automail-motor-receipt-already-consumed'; return save(store, command); }
    var restoredMotor = await store.get(motorKey(motor.receiptId)); if (!restoredMotor || restoredMotor.commandId !== commandId) throw new Error('law automail motor claim readback invalid');
    var budgetClaim = await claimBudget(store, decision.actionId, slots, now, cost); if (!budgetClaim.ok) { command.status = 'HELD_BUDGET'; command.reason = budgetClaim.reason; return save(store, command); }
    command.budgetSlot = budgetClaim.slot; await store.lpush(PENDING_KEY, command); await store.ltrim(PENDING_KEY, 0, 999);
    var idempotencyKey = 'law-automail/' + decision.actionId, action = { schemaVersion: SCHEMA, actionId: decision.actionId, commandId: commandId, status: 'DISPATCHING', idempotencyKey: idempotencyKey, claimedAt: now };
    if (!(await store.setIfAbsent(actionKey(decision.actionId), action))) return store.get(actionKey(decision.actionId));
    var restoredAction = await store.get(actionKey(decision.actionId)); if (!restoredAction || restoredAction.status !== 'DISPATCHING') throw new Error('law automail action claim readback invalid');
    command.status = 'DISPATCHING'; command.idempotencyKey = idempotencyKey; command = await save(store, command);
    if (!input.provider || typeof input.provider.create !== 'function') throw new Error('law automail provider missing');
    var result; try { result = await input.provider.create(candidate, idempotencyKey); } catch (error) { result = { ok: false, providerCalled: true, ambiguous: true, error: String(error && error.message || error) }; }
    command.providerCalls = result && result.providerCalled === false ? 0 : 1; command.providerLetterId = result && result.id || null;
    command.status = result && result.ok && /^ltr_[A-Za-z0-9]+$/.test(String(result.id || '')) ? 'ACCEPTED' : result && result.definitiveFailure ? 'FAILED' : 'AMBIGUOUS';
    command.failure = result && !result.ok ? String(result.error || result.err || 'lob-create-unresolved').slice(0, 240) : null; command.resolvedAt = Date.now(); command.readbackVerified = true;
    action.status = command.status; action.providerLetterId = command.providerLetterId; action.resolvedAt = command.resolvedAt; await store.set(actionKey(decision.actionId), action);
    restoredAction = await store.get(actionKey(decision.actionId)); if (!restoredAction || restoredAction.status !== command.status) throw new Error('law automail action receipt readback invalid');
    command = await save(store, command); await store.lpush(LOG_KEY, command); await store.ltrim(LOG_KEY, 0, 999);
    return Object.assign({ ok: command.status === 'ACCEPTED', accepted: command.status === 'ACCEPTED' ? 1 : 0 }, command);
  } catch (error) { return { ok: false, status: 'REFUSED', accepted: 0, reason: 'law-automail-strict-boundary-unavailable', detail: String(error && error.message || error), providerCalls: 0, liveMoney: liveMoney }; }
}
module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, PENDING_KEY: PENDING_KEY, commandKey: commandKey, actionKey: actionKey, motorKey: motorKey, execute: execute };
