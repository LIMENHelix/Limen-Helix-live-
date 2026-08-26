'use strict';

var Executor = require('./energy-investment-executor.js');
var Motor = require('./product-domain-motor-authorization.js');
var Developmental = require('./energy-investment-developmental-authority.js');
var B14 = require('./tradier-b14.js');
var SCHEMA = 'energy-investment-recovery/1.0';
var LOG_KEY = 'energy_investment_recovery_log';
var PREFIX = 'energy_investment_recovery:';
function key(id) { return PREFIX + id; }
function on(value) { return value === '1' || value === 'true' || value === 'TRUE'; }
async function save(store, receipt) {
  await store.set(key(receipt.recoveryId), receipt);
  var restored = await store.get(key(receipt.recoveryId));
  if (!restored || restored.status !== receipt.status || restored.commandId !== receipt.commandId) throw new Error('energy investment recovery readback invalid');
  return restored;
}
async function recover(options) {
  options = options || {};
  var store = options.store, command = options.command, broker = options.broker, b14 = options.b14 || B14;
  var env = options.env || process.env, now = Number(options.now) || Date.now(), trigger = options.trigger || {};
  if (!on(env.ENERGY_INVESTMENT_RECOVERY_ENABLED)) return { ok: true, status: 'HELD', reason: 'energy-investment-recovery-switch-off', liveMoney: false };
  if (!command || command.schemaVersion !== Executor.SCHEMA || command.status !== 'COMMAND_RECEIPTED' || !command.brokerCommandId) {
    return { ok: false, status: 'REFUSED', reason: 'energy-investment-command-receipt-required', liveMoney: false };
  }
  if (!((trigger.type === 'energy-investment-kill' || trigger.type === 'independent-risk-breach') && String(trigger.id || '').trim())) {
    return { ok: false, status: 'REFUSED', reason: 'explicit-kill-or-independent-risk-breach-required', liveMoney: false };
  }
  try {
    store.assertDurable();
    var authorization = await (options.motorAuthorization || Motor).authorize(store, 'energy', 'investments', now);
    if (!authorization || !authorization.authorized) authorization = await (options.developmentalAuthorization || Developmental).authorize(store, command.requestId, env, now);
    if (!authorization || !authorization.authorized) return { ok: true, status: 'HELD', reason: authorization && authorization.reason || 'energy-recovery-motor-held', liveMoney: false };
    var recoveryId = 'enr_' + require('./energy-investment-decision.js').hash({ command: command.commandId, trigger: trigger.id, motor: authorization.receiptId }).slice(0, 24);
    var prior = await store.get(key(recoveryId)); if (prior) return prior;
    var receipt = { schemaVersion: SCHEMA, recoveryId: recoveryId, commandId: command.commandId, actionId: command.actionId,
      brokerCommandId: command.brokerCommandId, trigger: { type: trigger.type, id: String(trigger.id) }, status: 'RECONCILING',
      productDomain: 'energy', ownerDomain: 'energy', lane: 'investments', productMotorReceiptId: authorization.receiptId,
      commandedAt: now, paperOnly: true, liveMoney: false };
    if (!await store.setIfAbsent(key(recoveryId), receipt)) return store.get(key(recoveryId));
    var brokerCommand = await b14.reconcile(store, broker, command.brokerCommandId, now);
    var order = brokerCommand.order || {}, executed = Number(order.executedQuantity) || 0;
    if (executed <= 0 && !['filled', 'canceled', 'rejected', 'expired', 'error'].includes(String(order.status || '').toLowerCase())) {
      if (!brokerCommand.rollback || !brokerCommand.rollback.confirmationSummary) throw new Error('energy investment cancel receipt unavailable');
      brokerCommand = await b14.cancelApproved(store, broker, { commandId: brokerCommand.commandId, confirmation: brokerCommand.rollback.confirmationSummary }, now);
      receipt.status = 'CANCEL_RECEIPT_PERSISTED'; receipt.cancelCommandId = brokerCommand.commandId; receipt.cancelReceipt = brokerCommand.rollback && brokerCommand.rollback.receipt || null;
    } else if (executed <= 0) {
      receipt.status = 'NO_EXPOSURE_VERIFIED'; receipt.terminalOrderStatus = order.status || null;
    } else {
      var quote = await broker.quote(command.symbol), closeSide = command.side === 'sell_short' ? 'buy_to_cover' : 'sell';
      var closePrice = Executor.priceFrom(quote, closeSide === 'buy_to_cover' ? 'buy' : 'sell_short');
      if (!closePrice) throw new Error('energy investment close quote unmeasured');
      var preview = await b14.createPreview(store, broker, { symbol: command.symbol, side: closeSide, quantity: executed,
        limitPrice: closePrice, maxNotionalUsd: Math.max(command.maxNotionalUsd, closePrice * executed), benchmarkSymbol: command.benchmarkSymbol,
        benchmarkBaselineValue: command.benchmarkBaselineValue, riskLimitPct: 0, sourceArtifactId: 'recovery:' + command.requestId,
        thesisId: 'close:' + command.thesisId, selectionId: recoveryId, actionId: 'close:' + command.actionId,
        ownerDomain: 'energy', horizonDays: [30, 60, 90], decisionContext: { recoveryOf: command.commandId, trigger: receipt.trigger } }, now);
      var closeCommand = await b14.submitApproved(store, broker, { previewId: preview.previewId, confirmation: preview.confirmationSummary }, now);
      receipt.status = 'CLOSE_COMMAND_RECEIPTED'; receipt.closeBrokerCommandId = closeCommand.commandId;
      receipt.closeBrokerOrderId = closeCommand.receipt && closeCommand.receipt.orderId || null;
    }
    receipt.completedAt = Date.now(); receipt.rollbackReadbackVerified = true; receipt = await save(store, receipt);
    await store.lpush(LOG_KEY, receipt); await store.ltrim(LOG_KEY, 0, 999); return receipt;
  } catch (error) {
    return { ok: false, status: 'RECOVERY_UNRESOLVED', reason: 'energy-investment-recovery-unavailable', detail: String(error && error.message || error), paperOnly: true, liveMoney: false };
  }
}
module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, key: key, recover: recover };
