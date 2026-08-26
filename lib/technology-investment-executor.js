'use strict';

var Decision = require('./technology-investment-decision.js');
var Motor = require('./product-domain-motor-authorization.js');
var Developmental = require('./technology-investment-developmental-authority.js');
var B14 = require('./tradier-b14.js');
var SCHEMA = 'technology-investment-command/1.0';
var LOG_KEY = 'technology_investment_command_log';
var PREFIX = 'technology_investment_command:';
var ACTION_PREFIX = 'technology_investment_action:';
var MOTOR_PREFIX = 'technology_investment_motor_claim:';
var BUDGET_PREFIX = 'technology_investment_budget_slot:';

function commandKey(id) { return PREFIX + id; }
function actionKey(id) { return ACTION_PREFIX + id; }
function motorKey(id) { return MOTOR_PREFIX + id; }
function on(value) { return value === '1' || value === 'true' || value === 'TRUE'; }
function held(reason, extra) { return Object.assign({ ok: true, status: 'HELD', accepted: 0, reason: reason, productDomain: 'technology', ownerDomain: 'technology', lane: 'investments', paperOnly: true, liveMoney: false }, extra || {}); }
function priceFrom(quote, side) {
  var base = Number(side === 'buy' ? quote && (quote.ask || quote.last) : quote && (quote.bid || quote.last));
  if (!Number.isFinite(base) || base <= 0) return null;
  var guarded = side === 'buy' ? base * 1.002 : base * 0.998;
  return Math.max(0.01, Math.round(guarded * 100) / 100);
}
async function save(store, command) {
  await store.set(commandKey(command.commandId), command);
  var restored = await store.get(commandKey(command.commandId));
  if (!restored || restored.status !== command.status || restored.actionId !== command.actionId) throw new Error('technology investment command readback invalid');
  return restored;
}
async function budgetSlot(store, actionId, now, cap, reservedNotional) {
  var day = new Date(now).toISOString().slice(0, 10);
  for (var slot = 1; slot <= cap; slot++) {
    var record = { schemaVersion: SCHEMA, actionId: actionId, day: day, slot: slot, reservedNotionalUsd: reservedNotional, claimedAt: now };
    var key = BUDGET_PREFIX + day + ':' + slot, made = await store.setIfAbsent(key, record), restored = await store.get(key);
    if (restored && restored.actionId === actionId) return { ok: true, slot: slot, duplicate: !made };
  }
  return { ok: false, reason: 'technology-investment-daily-order-cap-exhausted' };
}
async function execute(options) {
  options = options || {};
  var store = options.store, candidate = options.candidate, decision = options.decision, broker = options.broker;
  var env = options.env || process.env, now = Number(options.now) || Date.now(), b14 = options.b14 || B14;
  if (!Decision.validateReceipt(decision, candidate, now)) return held('technology-investment-exact-b10-decision-required');
  if (!on(env.TECHNOLOGY_INVESTMENT_PAPER_ORDER_ENABLED)) return held('technology-investment-paper-order-switch-off');
  if (!on(env.TECHNOLOGY_INVESTMENT_RECOVERY_ENABLED)) return held('technology-investment-recovery-switch-must-be-on-before-entry');
  var hardMax = Number(options.maxNotionalUsd), dailyBudget = Number(options.dailyNotionalBudgetUsd), cap = Math.max(0, Math.min(10, Number(options.dailyOrderCap) || 0));
  if (!Number.isFinite(hardMax) || hardMax <= 0) return held('technology-investment-max-notional-not-configured');
  if (!Number.isFinite(dailyBudget) || dailyBudget <= 0 || !cap) return held('technology-investment-daily-budget-or-cap-not-configured');
  var perSlot = dailyBudget / cap;
  if (candidate.maxNotionalUsd > hardMax || candidate.maxNotionalUsd > perSlot) return held('technology-investment-candidate-exceeds-conservative-budget-slot');
  if (!broker || typeof broker.quote !== 'function' || typeof broker.accountSnapshot !== 'function') return held('technology-investment-broker-adapter-missing');
  try {
    store.assertDurable();
    var authorization = await (options.motorAuthorization || Motor).authorize(store, 'technology', 'investments', now);
    if (!authorization || !authorization.authorized) {
      authorization = await (options.developmentalAuthorization || Developmental).authorize(store, candidate.requestId, env, now);
      if (!authorization || !authorization.authorized) return held(authorization && authorization.reason || 'technology-investment-motor-held', { authorization: authorization || null });
    }
    var prior = await store.get(actionKey(decision.actionId));
    if (prior) return Object.assign({ ok: prior.status === 'COMMAND_RECEIPTED', accepted: prior.status === 'COMMAND_RECEIPTED' ? 1 : 0, replayed: true }, prior);
    var quotes = await Promise.all([broker.quote(candidate.symbol), broker.quote(candidate.benchmarkSymbol)]);
    var limitPrice = priceFrom(quotes[0], candidate.side), benchmarkBaseline = Number(quotes[1] && (quotes[1].last || quotes[1].bid || quotes[1].ask));
    if (!limitPrice || !Number.isFinite(benchmarkBaseline) || benchmarkBaseline <= 0) return held('technology-investment-market-quote-unmeasured');
    var quantity = Math.floor(candidate.maxNotionalUsd / limitPrice);
    if (quantity < 1) return held('technology-investment-notional-cannot-buy-one-whole-paper-share');
    var reserved = quantity * limitPrice;
    var budget = await budgetSlot(store, decision.actionId, now, cap, reserved);
    if (!budget.ok) return held(budget.reason);
    var commandId = 'tic_' + Decision.hash({ action: decision.actionId, motor: authorization.receiptId, quantity: quantity, limitPrice: limitPrice }).slice(0, 24);
    var command = { schemaVersion: SCHEMA, commandId: commandId, actionId: decision.actionId, decisionReceiptId: decision.decisionReceiptId,
      status: 'COMMANDING', productDomain: 'technology', ownerDomain: 'technology', lane: 'investments', productMotorReceiptId: authorization.receiptId,
      authorizationMode: authorization.authorizationMode || 'mature-production-capability', requestId: candidate.requestId, symbol: candidate.symbol,
      side: candidate.side, quantity: quantity, limitPrice: limitPrice, reservedNotionalUsd: reserved, maxNotionalUsd: candidate.maxNotionalUsd,
      benchmarkSymbol: candidate.benchmarkSymbol, benchmarkBaselineValue: benchmarkBaseline, riskLimitPct: candidate.riskLimitPct,
      thesisId: candidate.thesisId, evidenceHash: candidate.evidenceHash, predictedOutcome: decision.predictedOutcome,
      executionAdapter: 'tradier-paper-adapter/1', productionAdapterContract: 'broker-equity-order-adapter/1', budgetSlot: budget.slot,
      commandedAt: now, paperOnly: true, liveMoney: false };
    if (!await store.setIfAbsent(commandKey(commandId), command)) return store.get(commandKey(commandId));
    command = await store.get(commandKey(commandId));
    if (!command || command.status !== 'COMMANDING') throw new Error('technology investment pre-dispatch command readback invalid');
    if (!await store.setIfAbsent(motorKey(authorization.receiptId), { schemaVersion: SCHEMA, commandId: commandId, actionId: decision.actionId, claimedAt: now })) {
      command.status = 'REFUSED'; command.reason = 'technology-investment-motor-receipt-already-consumed'; return save(store, command);
    }
    var motorClaim = await store.get(motorKey(authorization.receiptId));
    if (!motorClaim || motorClaim.commandId !== commandId) throw new Error('technology investment motor claim readback invalid');
    var action = { schemaVersion: SCHEMA, actionId: decision.actionId, commandId: commandId, status: 'DISPATCHING', claimedAt: now };
    if (!await store.setIfAbsent(actionKey(decision.actionId), action)) return store.get(actionKey(decision.actionId));
    command.status = 'DISPATCHING'; command = await save(store, command);
    var preview = await b14.createPreview(store, broker, { symbol: candidate.symbol, side: candidate.side, quantity: quantity,
      limitPrice: limitPrice, maxNotionalUsd: candidate.maxNotionalUsd, benchmarkSymbol: candidate.benchmarkSymbol,
      benchmarkBaselineValue: benchmarkBaseline, riskLimitPct: candidate.riskLimitPct, sourceArtifactId: candidate.requestId,
      thesisId: candidate.thesisId, selectionId: decision.decisionReceiptId, actionId: decision.actionId, ownerDomain: 'technology', horizonDays: [30, 60, 90],
      decisionContext: { technologyPacketId: decision.technologyPacketId, brainOpportunityId: decision.brainOpportunityId, evidenceHash: candidate.evidenceHash } }, now);
    command.previewId = preview.previewId; command.status = 'PREVIEWED'; command = await save(store, command);
    var brokerCommand = await b14.submitApproved(store, broker, { previewId: preview.previewId, confirmation: preview.confirmationSummary }, now);
    command.brokerCommandId = brokerCommand.commandId; command.brokerOrderId = brokerCommand.receipt && brokerCommand.receipt.orderId || null;
    command.status = command.brokerOrderId ? 'COMMAND_RECEIPTED' : 'AMBIGUOUS'; command.brokerReceipt = brokerCommand.receipt || null;
    command.rollback = brokerCommand.rollback || null; command.completedAt = Date.now(); command.durableReceiptReadbackVerified = true;
    action.status = command.status; action.brokerCommandId = command.brokerCommandId; action.brokerOrderId = command.brokerOrderId; action.resolvedAt = command.completedAt;
    await store.set(actionKey(decision.actionId), action);
    var actionReadback = await store.get(actionKey(decision.actionId));
    if (!actionReadback || actionReadback.status !== command.status) throw new Error('technology investment action receipt readback invalid');
    command = await save(store, command); await store.lpush(LOG_KEY, command); await store.ltrim(LOG_KEY, 0, 999);
    return Object.assign({ ok: command.status === 'COMMAND_RECEIPTED', accepted: command.status === 'COMMAND_RECEIPTED' ? 1 : 0 }, command);
  } catch (error) {
    return { ok: false, status: 'UNRESOLVED', accepted: 0, reason: 'technology-investment-strict-boundary-unavailable', detail: String(error && error.message || error), paperOnly: true, liveMoney: false };
  }
}

module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, commandKey: commandKey, actionKey: actionKey, motorKey: motorKey, priceFrom: priceFrom, execute: execute };
