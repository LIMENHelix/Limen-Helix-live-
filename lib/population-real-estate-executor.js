'use strict';

var crypto = require('node:crypto');
var Decision = require('./population-real-estate-decision.js');
var Motor = require('./product-domain-motor-authorization.js');
var Learning = require('./population-real-estate-learning.js');

var SCHEMA = 'population-real-estate-command/1.0';
var LOG_KEY = 'population_real_estate_command_log';
var PENDING_KEY = 'population_real_estate_pending_log';
var SUPPRESSION_KEY = 'population_real_estate_suppression_catalog';
var PREFIX = 'population_real_estate_command:';
var ACTION_PREFIX = 'population_real_estate_action:';
var MOTOR_PREFIX = 'population_real_estate_motor_claim:';
var BUDGET_PREFIX = 'population_real_estate_budget_slot:';
function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function commandKey(id) { return PREFIX + id; }
function actionKey(id) { return ACTION_PREFIX + id; }
function motorKey(id) { return MOTOR_PREFIX + id; }
function held(reason, extra) { return Object.assign({ ok: true, status: 'HELD', accepted: 0, reason: reason, providerCalls: 0, productDomain: 'population', ownerDomain: 'population', lane: 'real-estate', liveMoney: false }, extra || {}); }
async function save(store, value) { await store.set(commandKey(value.commandId), value); var restored = await store.get(commandKey(value.commandId)); if (!restored || restored.status !== value.status) throw new Error('population real-estate command readback invalid'); return restored; }
async function budgetSlot(store, actionId, slots, now, cost) { var day = new Date(now).toISOString().slice(0, 10); for (var i = 1; i <= slots; i++) { var key = BUDGET_PREFIX + day + ':' + i; var value = { schemaVersion: SCHEMA, actionId: actionId, day: day, slot: i, estimatedCostUsd: cost, claimedAt: now }; var created = await store.setIfAbsent(key, value), restored = await store.get(key); if (restored && restored.actionId === actionId) return { ok: true, slot: i, duplicate: !created }; } return { ok: false, reason: 'population-real-estate-daily-budget-exhausted' }; }

async function execute(input) {
  input = input || {};
  var store = input.store, candidate = input.candidate, decision = input.decision, now = Number(input.now) || Date.now();
  if (!Decision.validateReceipt(decision, candidate, now)) return held('population-real-estate-exact-b10-decision-required');
  var cost = Number(input.emailCostUsd), budget = Number(input.dailyBudgetUsd), cap = Math.max(0, Math.min(1, Number(input.dailyRequestCap) || 0));
  if (input.emailCostUsd == null || !Number.isFinite(cost) || cost < 0) return held('population-real-estate-email-cost-not-configured');
  if (!cap) return held('population-real-estate-daily-request-cap-zero');
  if (cost > 0 && (!Number.isFinite(budget) || budget < cost)) return held('population-real-estate-daily-dollar-budget-not-configured-or-too-small');
  var slots = Math.min(cap, cost === 0 ? cap : Math.floor((budget + 1e-12) / cost));
  if (!slots) return held('population-real-estate-daily-budget-zero');
  try {
    store.assertDurable();
    var suppression = await store.get(SUPPRESSION_KEY);
    var suppressionIdentity = hash({ counterparty: candidate.counterpartyEmailHash, property: candidate.propertyRefHash });
    if (suppression && suppression[suppressionIdentity] && suppression[suppressionIdentity].suppressed) return held('population-real-estate-counterparty-property-suppressed');
    var auth = await (input.motorAuthorization || Motor).authorize(store, 'population', 'real-estate', now);
    if (!auth || !auth.authorized) return held(auth && auth.reason || 'population-real-estate-motor-held', { motorReceiptId: auth && auth.receiptId || null, motorBlockers: auth && auth.blockers || [] });
    var prior = await store.get(actionKey(decision.actionId));
    if (prior) return Object.assign({ ok: prior.status === 'INQUIRY_ACCEPTED', accepted: prior.status === 'INQUIRY_ACCEPTED' ? 1 : 0, replayed: true }, prior);
    var commandId = 'prc_' + hash({ actionId: decision.actionId, motor: auth.receiptId }).slice(0, 24);
    var command = { schemaVersion: SCHEMA, commandId: commandId, actionId: decision.actionId, decisionReceiptId: decision.decisionReceiptId,
      status: 'COMMANDING', productDomain: 'population', ownerDomain: 'population', lane: 'real-estate', productMotorReceiptId: auth.receiptId,
      inquiryId: candidate.inquiryId, counterpartyEmailHash: candidate.counterpartyEmailHash, propertyRefHash: candidate.propertyRefHash,
      transactionIntent: candidate.transactionIntent, listingUrlHash: candidate.listingUrlHash,
      indicationPriceUsd: candidate.indicationPriceUsd, brainOpportunityId: candidate.brainOpportunityId,
      nonBinding: true, contractAuthorized: false, earnestMoneyAuthorized: false, fundsTransferAuthorized: false,
      subjectHash: candidate.subjectHash, contentHash: candidate.contentHash, evidenceHash: candidate.evidenceHash,
      predictedOutcome: decision.predictedOutcome, emailCostUsd: cost, dailyBudgetUsd: cost === 0 ? 0 : budget,
      dailyRequestCap: cap, providerCalls: 0, commandedAt: now, liveMoney: false };
    var existing = await store.get(commandKey(commandId));
    if (existing) return Object.assign({ ok: existing.status === 'INQUIRY_ACCEPTED', accepted: existing.status === 'INQUIRY_ACCEPTED' ? 1 : 0, replayed: true }, existing);
    if (!(await store.setIfAbsent(commandKey(commandId), command))) return store.get(commandKey(commandId));
    command = await store.get(commandKey(commandId));
    if (!command || command.status !== 'COMMANDING') throw new Error('population real-estate pre-dispatch command readback invalid');
    if (!(await store.setIfAbsent(motorKey(auth.receiptId), { schemaVersion: SCHEMA, commandId: commandId, productMotorReceiptId: auth.receiptId, claimedAt: now }))) { command.status = 'REFUSED'; command.reason = 'population-real-estate-motor-receipt-already-consumed'; return save(store, command); }
    var motorClaim = await store.get(motorKey(auth.receiptId));
    if (!motorClaim || motorClaim.commandId !== commandId) throw new Error('population real-estate motor claim readback invalid');
    var slot = await budgetSlot(store, decision.actionId, slots, now, cost);
    if (!slot.ok) { command.status = 'HELD_BUDGET'; command.reason = slot.reason; return save(store, command); }
    command.budgetSlot = slot.slot;
    await store.lpush(PENDING_KEY, command); await store.ltrim(PENDING_KEY, 0, 999);
    var idempotencyKey = 'population-real-estate/' + decision.actionId;
    var action = { schemaVersion: SCHEMA, actionId: decision.actionId, commandId: commandId, status: 'DISPATCHING',
      idempotencyKey: idempotencyKey, nonBinding: true, contractAuthorized: false, earnestMoneyAuthorized: false,
      fundsTransferAuthorized: false, claimedAt: now };
    if (!(await store.setIfAbsent(actionKey(decision.actionId), action))) return store.get(actionKey(decision.actionId));
    var actionReadback = await store.get(actionKey(decision.actionId));
    if (!actionReadback || actionReadback.status !== 'DISPATCHING') throw new Error('population real-estate action claim readback invalid');
    command.status = 'DISPATCHING'; command.idempotencyKey = idempotencyKey; command = await save(store, command);
    await Learning.recordCommand(store, command);
    if (!input.transport || typeof input.transport.send !== 'function') throw new Error('population real-estate transport missing');
    var result;
    try { result = await input.transport.send(candidate, decision.actionId, idempotencyKey); }
    catch (error) { result = { ok: false, providerCalled: true, ambiguous: true, error: String(error && error.message || error) }; }
    command.providerCalls = result && result.providerCalled === false ? 0 : 1;
    command.providerEmailId = result && result.id || null;
    command.replyAddressHash = result && result.replyAddressHash || null;
    command.status = result && result.ok && result.id ? 'INQUIRY_ACCEPTED' : result && result.definitiveFailure ? 'FAILED' : 'AMBIGUOUS';
    command.failure = result && !result.ok ? String(result.error || 'send-unresolved').slice(0, 240) : null;
    command.resolvedAt = Date.now(); command.readbackVerified = true;
    action.status = command.status; action.providerEmailId = command.providerEmailId; action.resolvedAt = command.resolvedAt;
    await store.set(actionKey(decision.actionId), action); actionReadback = await store.get(actionKey(decision.actionId));
    if (!actionReadback || actionReadback.status !== command.status) throw new Error('population real-estate action receipt readback invalid');
    command = await save(store, command); await store.lpush(LOG_KEY, command); await store.ltrim(LOG_KEY, 0, 999);
    return Object.assign({ ok: command.status === 'INQUIRY_ACCEPTED', accepted: command.status === 'INQUIRY_ACCEPTED' ? 1 : 0 }, command);
  } catch (error) {
    return { ok: false, status: 'REFUSED', accepted: 0, reason: 'population-real-estate-strict-boundary-unavailable', detail: String(error && error.message || error), providerCalls: 0, liveMoney: false };
  }
}

module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, PENDING_KEY: PENDING_KEY, SUPPRESSION_KEY: SUPPRESSION_KEY,
  commandKey: commandKey, actionKey: actionKey, motorKey: motorKey, execute: execute };
