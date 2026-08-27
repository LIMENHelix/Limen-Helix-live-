'use strict';

/** One-shot, zero-effect Tradier sandbox executor/rollback commissioning. */

var B14 = require('./tradier-b14.js');

var KEY = 'finance_sandbox_commissioning';
var SCHEMA = 'finance-sandbox-commissioning/1.0';
var OPEN = { pending: true, open: true, partially_filled: true };

function enabled(env) {
  var value = env && env.LIMEN_FINANCE_PAPER_COMMISSIONING_ENABLED;
  return value === '1' || value === 'true' || value === 'TRUE';
}
function switches(env) {
  function on(value) { return value === '1' || value === 'true' || value === 'TRUE'; }
  return on(env && env.TRADIER_SANDBOX_AUTONOMY_ENABLED) &&
    on(env && env.TRADIER_SANDBOX_ORDER_AUTONOMY_ENABLED);
}
function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
function held(reason, record) {
  return { ok: true, status: 'HELD', reason: reason, record: record || null, paperOnly: true, orderPlaced: false, liveMoney: false };
}
function freeSymbol(account) {
  var positions = account && Array.isArray(account.positions) ? account.positions : [];
  var orders = account && Array.isArray(account.orders) ? account.orders : [];
  return ['SPY', 'QQQ', 'IWM'].find(function (symbol) {
    var positioned = positions.some(function (row) { return String(row.symbol || '').toUpperCase() === symbol && Number(row.quantity) !== 0; });
    var ordered = orders.some(function (row) { return String(row.symbol || '').toUpperCase() === symbol && OPEN[String(row.status || '').toLowerCase()]; });
    return !positioned && !ordered;
  }) || null;
}
function verified(command) {
  return !!(command && command.status === 'RECONCILED_TERMINAL' && command.order &&
    command.order.status === 'canceled' && Number(command.order.executedQuantity) === 0 &&
    command.rollback && command.rollback.status === 'CANCEL_RECEIPT_PERSISTED' && command.reafference);
}

async function finish(store, broker, b14, record, wait) {
  var command = await b14.read(store, record.commandId);
  if (!command) return held('commissioning-command-missing', record);
  try {
    if (command.status === 'RECEIPT_PERSISTED' && command.rollback && command.rollback.confirmationSummary) {
      command = await b14.cancelApproved(store, broker, {
        commandId: command.commandId,
        confirmation: command.rollback.confirmationSummary,
        approval: {
          mode: 'commissioning', actor: 'finance-commissioning', ownerDomain: 'finance',
          authorizationReceiptId: KEY, authorizationMode: 'zero-effect-rollback-proof'
        }
      });
    }
  } catch (error) {
    if (error && error.code !== 'TRADIER_B14_CANCEL_TERMINAL') throw error;
  }
  for (var i = 0; i < 10; i++) {
    command = await b14.reconcile(store, broker, record.commandId);
    if (command.status === 'RECONCILED_TERMINAL') break;
    await wait(500);
  }
  record.updatedAt = new Date().toISOString();
  record.orderId = command.receipt && command.receipt.orderId || record.orderId || null;
  if (verified(command)) {
    record.status = 'VERIFIED_ZERO_EFFECT_ROLLBACK';
    record.verifiedAt = record.updatedAt;
    record.executedQuantity = 0;
    record.effectExecuted = false;
    await store.set(KEY, record);
    return { ok: true, status: record.status, idempotent: false, record: record, command: command, paperOnly: true, orderPlaced: true, liveMoney: false };
  }
  if (command.status === 'RECONCILED_TERMINAL') {
    record.status = 'COMMISSIONING_EFFECT_OR_TERMINAL_MISMATCH';
    record.effectExecuted = Number(command.order && command.order.executedQuantity) !== 0;
  } else {
    record.status = 'CANCEL_RECONCILIATION_PENDING';
  }
  await store.set(KEY, record);
  return held(record.status === 'CANCEL_RECONCILIATION_PENDING' ? 'cancel-reconciliation-pending' : 'zero-effect-proof-not-established', record);
}

async function execute(options) {
  options = options || {};
  var store = options.store;
  var broker = options.broker;
  var b14 = options.b14 || B14;
  var env = options.env || process.env;
  var wait = options.sleep || sleep;
  if (!enabled(env)) return held('commissioning-switch-off');
  if (!switches(env)) return held('sandbox-autonomy-switch-off');
  if (!store || typeof store.assertDurable !== 'function') return held('strict-store-required');
  store.assertDurable();
  if (!broker || typeof broker.configured !== 'function' || !broker.configured()) return held('tradier-sandbox-unconfigured');

  var existing = await store.get(KEY);
  if (existing && existing.status === 'VERIFIED_ZERO_EFFECT_ROLLBACK') {
    return { ok: true, status: existing.status, idempotent: true, record: existing, paperOnly: true, orderPlaced: true, liveMoney: false };
  }
  if (existing && existing.commandId) return finish(store, broker, b14, existing, wait);
  if (existing) return held('commissioning-claim-unresolved', existing);

  var account = await broker.accountSnapshot();
  var symbol = freeSymbol(account);
  if (!symbol) return held('no-unencumbered-commissioning-symbol');
  var quote = await broker.quote(symbol);
  var reference = Number(quote && (quote.bid || quote.last));
  if (!Number.isFinite(reference) || reference <= 0) return held('commissioning-quote-unmeasured');
  var limitPrice = Math.floor(Math.min(400, reference * 0.5) * 100) / 100;
  if (!(limitPrice > 0)) return held('commissioning-limit-invalid');
  var at = new Date().toISOString();
  var record = {
    schemaVersion: SCHEMA,
    status: 'CLAIMED',
    symbol: symbol,
    side: 'buy',
    quantity: 1,
    limitPrice: limitPrice,
    claimedAt: at,
    purpose: 'zero-effect executor and rollback verification',
    paperOnly: true,
    liveMoney: false
  };
  if (!await store.setIfAbsent(KEY, record)) {
    existing = await store.get(KEY);
    return existing && existing.commandId ? finish(store, broker, b14, existing, wait) : held('commissioning-claim-raced', existing);
  }

  var preview = await b14.createPreview(store, broker, {
    symbol: symbol,
    side: 'buy',
    quantity: 1,
    limitPrice: limitPrice,
    maxNotionalUsd: 500,
    benchmarkSymbol: symbol,
    benchmarkBaselineValue: Number(quote.last || reference),
    riskLimitPct: 0,
    sourceArtifactId: 'finance-sandbox-commissioning/1',
    thesisId: 'zero-effect-rollback-proof',
    actionId: 'finance-commissioning-zero-effect',
    ownerDomain: 'finance',
    horizonDays: [30, 60, 90]
  });
  record.previewId = preview.previewId;
  record.status = 'PREVIEWED';
  await store.set(KEY, record);
  var command = await b14.submitApproved(store, broker, {
    previewId: preview.previewId,
    confirmation: preview.confirmationSummary,
    approval: {
      mode: 'commissioning', actor: 'finance-commissioning', ownerDomain: 'finance',
      authorizationReceiptId: KEY, authorizationMode: 'zero-effect-rollback-proof'
    }
  });
  record.commandId = command.commandId;
  record.orderId = command.receipt && command.receipt.orderId || null;
  record.status = 'COMMAND_RECEIPTED';
  await store.set(KEY, record);
  return finish(store, broker, b14, record, wait);
}

module.exports = { SCHEMA: SCHEMA, KEY: KEY, enabled: enabled, switches: switches, freeSymbol: freeSymbol, verified: verified, execute: execute };
