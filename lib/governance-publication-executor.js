'use strict';

var Source = require('./governance-publication-source.js');
var Decision = require('./governance-publication-decision.js');
var Motor = require('./product-domain-motor-authorization.js');
var Publisher = require('./governance-publication-publisher.js');
var Learning = require('./governance-publication-learning.js');

var SCHEMA = 'governance-publication-command/1.0';
var LOG_KEY = 'governance_publication_command_log';
var PENDING_KEY = 'governance_publication_pending_log';
var SUPPRESSION_KEY = 'governance_publication_suppression_catalog';
var COMMAND_PREFIX = 'governance_publication_command:';
var ACTION_PREFIX = 'governance_publication_action:';
var MOTOR_PREFIX = 'governance_publication_motor_claim:';
var BUDGET_PREFIX = 'governance_publication_budget_slot:';

function commandKey(id) { return COMMAND_PREFIX + id; }
function actionKey(id) { return ACTION_PREFIX + id; }
function motorKey(id) { return MOTOR_PREFIX + id; }
function held(reason, extra) { return Object.assign({ ok: true, status: 'HELD', accepted: 0, reason: reason, providerCalls: 0, productDomain: 'governance', ownerDomain: 'governance', lane: 'publication', liveMoney: false }, extra || {}); }

async function save(store, command) {
  await store.set(commandKey(command.commandId), command);
  var restored = await store.get(commandKey(command.commandId));
  if (!restored || restored.status !== command.status || restored.actionId !== command.actionId) throw new Error('governance publication command readback invalid');
  return restored;
}

async function budgetSlot(store, actionId, slots, now, cost) {
  var day = new Date(now).toISOString().slice(0, 10);
  for (var i = 1; i <= slots; i++) {
    var key = BUDGET_PREFIX + day + ':' + i;
    var claim = { schemaVersion: SCHEMA, actionId: actionId, day: day, slot: i, estimatedCostUsd: cost, claimedAt: now };
    var created = await store.setIfAbsent(key, claim);
    var restored = await store.get(key);
    if (restored && restored.actionId === actionId) return { ok: true, slot: i, duplicate: !created };
  }
  return { ok: false, reason: 'governance-publication-daily-budget-exhausted' };
}

async function execute(input) {
  input = input || {};
  var store = input.store, candidate = input.candidate, decision = input.decision;
  var now = Number(input.now) || Date.now();
  if (!Decision.validateReceipt(decision, candidate, now)) return held('governance-publication-exact-b10-decision-required');
  var cost = Number(input.operationCostUsd), budget = Number(input.dailyBudgetUsd);
  var cap = Math.max(0, Math.min(1, Number(input.dailyPublicationCap) || 0));
  if (input.operationCostUsd == null || !Number.isFinite(cost) || cost < 0) return held('governance-publication-operation-cost-not-configured');
  if (!cap) return held('governance-publication-daily-publication-cap-zero');
  if (cost > 0 && (!Number.isFinite(budget) || budget < cost)) return held('governance-publication-daily-dollar-budget-not-configured-or-too-small');
  var slots = Math.min(cap, cost === 0 ? cap : Math.floor((budget + 1e-12) / cost));
  try {
    store.assertDurable();
    var suppression = await store.get(SUPPRESSION_KEY);
    if (suppression && suppression[candidate.sourceFingerprint] && suppression[candidate.sourceFingerprint].suppressed) return held('governance-publication-source-fingerprint-suppressed');
    var authorization = await (input.motorAuthorization || Motor).authorize(store, 'governance', 'publication', now);
    if (!authorization || !authorization.authorized) return held(authorization && authorization.reason || 'governance-publication-motor-held', { motorReceiptId: authorization && authorization.receiptId || null });
    var prior = await store.get(actionKey(decision.actionId));
    if (prior) return Object.assign({ ok: prior.status === 'PUBLISHED', accepted: prior.status === 'PUBLISHED' ? 1 : 0, replayed: true }, prior);
    var commandId = 'gpcmd_' + Source.hash({ action: decision.actionId, motor: authorization.receiptId }).slice(0, 24);
    var command = {
      schemaVersion: SCHEMA, commandId: commandId, actionId: decision.actionId, decisionReceiptId: decision.decisionReceiptId,
      status: 'COMMANDING', productDomain: 'governance', ownerDomain: 'governance', lane: 'publication',
      productMotorReceiptId: authorization.receiptId, candidateId: candidate.candidateId, contentHash: candidate.contentHash,
      sourceFingerprint: candidate.sourceFingerprint, governancePacketId: candidate.governancePacketId,
      predictedOutcome: decision.predictedOutcome, operationCostUsd: cost, dailyBudgetUsd: cost === 0 ? 0 : budget,
      dailyPublicationCap: cap, providerCalls: 0, commandedAt: now, liveMoney: false
    };
    if (!await store.setIfAbsent(commandKey(commandId), command)) return store.get(commandKey(commandId));
    command = await store.get(commandKey(commandId));
    if (!command || command.status !== 'COMMANDING') throw new Error('governance publication pre-dispatch readback invalid');
    if (!await store.setIfAbsent(motorKey(authorization.receiptId), { schemaVersion: SCHEMA, commandId: commandId, productMotorReceiptId: authorization.receiptId, claimedAt: now })) {
      command.status = 'REFUSED'; command.reason = 'governance-publication-motor-receipt-already-consumed'; return save(store, command);
    }
    var motorClaim = await store.get(motorKey(authorization.receiptId));
    if (!motorClaim || motorClaim.commandId !== commandId) throw new Error('governance publication motor claim readback invalid');
    var slot = await budgetSlot(store, decision.actionId, slots, now, cost);
    if (!slot.ok) { command.status = 'HELD_BUDGET'; command.reason = slot.reason; return save(store, command); }
    command.budgetSlot = slot.slot;
    await store.lpush(PENDING_KEY, command); await store.ltrim(PENDING_KEY, 0, 999);
    var action = { schemaVersion: SCHEMA, actionId: decision.actionId, commandId: commandId, status: 'DISPATCHING', claimedAt: now };
    if (!await store.setIfAbsent(actionKey(decision.actionId), action)) return store.get(actionKey(decision.actionId));
    command.status = 'DISPATCHING'; command = await save(store, command);
    await Learning.recordCommand(store, command);
    var result;
    try { result = await (input.publisher || Publisher).publish(store, candidate, decision.actionId, now); }
    catch (error) { result = { ok: false, ambiguous: true, error: String(error && error.message || error), providerCalled: false }; }
    command.providerCalls = 0;
    command.articleId = result && result.articleId || null;
    command.publicPath = result && result.publicPath || null;
    command.status = result && result.ok && result.articleId ? 'PUBLISHED' : result && result.definitiveFailure ? 'FAILED' : 'AMBIGUOUS';
    command.failure = result && !result.ok ? String(result.error || 'publication-unresolved').slice(0, 240) : null;
    command.resolvedAt = Date.now();
    command.durableReceiptReadbackVerified = true;
    command.externalEffectExecuted = command.status === 'PUBLISHED';
    command.publicEffectExecuted = command.status === 'PUBLISHED';
    action.status = command.status; action.articleId = command.articleId; action.resolvedAt = command.resolvedAt;
    await store.set(actionKey(decision.actionId), action);
    var restoredAction = await store.get(actionKey(decision.actionId));
    if (!restoredAction || restoredAction.status !== command.status) throw new Error('governance publication action receipt readback invalid');
    command = await save(store, command);
    await store.lpush(LOG_KEY, command); await store.ltrim(LOG_KEY, 0, 999);
    return Object.assign({ ok: command.status === 'PUBLISHED', accepted: command.status === 'PUBLISHED' ? 1 : 0 }, command);
  } catch (error) {
    return { ok: false, status: 'REFUSED', accepted: 0, reason: 'governance-publication-strict-boundary-unavailable', detail: String(error && error.message || error), providerCalls: 0, liveMoney: false };
  }
}

module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, PENDING_KEY: PENDING_KEY, SUPPRESSION_KEY: SUPPRESSION_KEY,
  commandKey: commandKey, actionKey: actionKey, motorKey: motorKey, execute: execute };
