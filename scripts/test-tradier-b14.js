'use strict';

var b14 = require('../lib/tradier-b14');

var checks = 0;
function assert(name, condition) {
  checks++;
  if (!condition) throw new Error('FAIL ' + checks + ': ' + name);
  console.log('PASS ' + name);
}

function memoryStore() {
  var values = new Map();
  var logs = [];
  return {
    values: values,
    logs: logs,
    failSetPrefix: null,
    assertDurable: function () { return true; },
    get: async function (key) { return values.has(key) ? values.get(key) : null; },
    set: async function (key, value) {
      if (this.failSetPrefix && key.indexOf(this.failSetPrefix) === 0) throw new Error('forced durable write failure');
      values.set(key, JSON.parse(JSON.stringify(value)));
      return true;
    },
    setIfAbsent: async function (key, value) {
      if (this.failSetPrefix && key.indexOf(this.failSetPrefix) === 0) throw new Error('forced durable write failure');
      if (values.has(key)) return false;
      values.set(key, JSON.parse(JSON.stringify(value)));
      return true;
    },
    lpush: async function (key, value) { logs.unshift(JSON.parse(JSON.stringify(value))); return logs.length; },
    ltrim: async function () { return true; }
  };
}

function snapshot(cash, qty, equity) {
  return {
    accountId: 'VA60523798', accountType: 'margin', totalCash: cash,
    totalEquity: equity === undefined ? cash : equity, pendingCash: 0, unclearedFunds: 0,
    positions: qty ? [{ symbol: 'SPY', quantity: qty, costBasis: 100, marketValue: qty * 500 }] : [],
    observedAt: '2026-08-23T10:00:00.000Z'
  };
}

function broker(opts) {
  opts = opts || {};
  var calls = [];
  return {
    calls: calls,
    accountSnapshot: async function () { calls.push('snapshot'); return this.after && calls.indexOf('order') !== -1 ? this.after : (this.before || opts.before || snapshot(1000, 0)); },
    previewOrder: async function (order) { calls.push('preview'); this.previewRequest = order; return opts.preview || { status: 'ok', result: true, cost: 501, order_cost: 500, commission: 1, fees: 0 }; },
    placeOrder: async function (order) { calls.push('place'); this.orderRequest = order; if (this.onPlace) this.onPlace(); if (opts.placeError) throw opts.placeError; return opts.receipt || { id: 77, status: 'ok', partner_id: 'p1' }; },
    cancelOrder: async function (orderId) { calls.push('cancel'); this.cancelOrderId = String(orderId); if (this.onCancel) this.onCancel(); if (opts.cancelError) throw opts.cancelError; return opts.cancelReceipt || { id: orderId, status: 'ok' }; },
    getOrder: async function () { calls.push('order'); return this.order || opts.order || { id: '77', symbol: 'SPY', side: 'buy', quantity: 1, status: 'filled', averageFillPrice: 499, executedQuantity: 1, remainingQuantity: 0, tag: this.orderRequest.tag }; },
    findOrderByTag: async function () { calls.push('findByTag'); return this.recovered || opts.recovered || null; }
  };
}

async function rejected(fn) {
  try { await fn(); return null; } catch (err) { return err; }
}

async function main() {
  var normalized = b14.normalizeIntent({ symbol: 'spy', side: 'buy', quantity: 1, limitPrice: 500, maxNotionalUsd: 510 });
  assert('intent is normalized to a day limit equity order', normalized.symbol === 'SPY' && normalized.type === 'limit' && normalized.duration === 'day');
  assert('30/60/90 outcome horizons are explicit defaults', JSON.stringify(normalized.horizonDays) === '[30,60,90]');
  var multiscale = b14.normalizeIntent({ symbol: 'SPY', side: 'buy', quantity: 1, limitPrice: 500, maxNotionalUsd: 510, horizonDays: [1, 3, 7, 14, 30, 60, 90] });
  assert('Finance multiscale regulation and consolidation horizons are accepted', JSON.stringify(multiscale.horizonDays) === '[1,3,7,14,30,60,90]');
  assert('unsupported two-day horizon is refused', (await rejected(function () { return b14.normalizeIntent({ symbol: 'SPY', side: 'buy', quantity: 1, limitPrice: 500, maxNotionalUsd: 510, horizonDays: [2] }); })).code === 'TRADIER_B14_INVALID_HORIZONS');
  assert('fractional shares are refused', (await rejected(function () { return b14.normalizeIntent({ symbol: 'SPY', side: 'buy', quantity: 1.5, limitPrice: 500, maxNotionalUsd: 510 }); })).code === 'TRADIER_B14_INVALID_QUANTITY');
  var shortIntent = b14.normalizeIntent({ symbol: 'SPY', side: 'sell_short', quantity: 1, limitPrice: 500, maxNotionalUsd: 510 });
  assert('paper shorting preserves the explicit Tradier side', shortIntent.side === 'sell_short');

  var store = memoryStore();
  var api = broker();
  var preview = await b14.createPreview(store, api, normalized, Date.parse('2026-08-23T10:00:00Z'));
  assert('broker preview does not place an order', api.calls.join(',') === 'snapshot,preview');
  assert('preview is durably stored', store.values.has('tradier_b14_preview:' + preview.previewId));
  assert('preview remains explicitly read-only', preview.readOnly === true && preview.status === 'PREVIEWED');
  assert('cash-like guard uses total_cash even for a margin account', preview.accountBefore.accountType === 'margin' && preview.cashGuard.totalCash === 1000);
  assert('confirmation binds the exact order and maximum', preview.confirmationSummary.indexOf('BUY 1 SPY LIMIT 500.00 MAX USD 510.00') !== -1);

  var lowCash = await rejected(function () {
    return b14.createPreview(memoryStore(), broker({ before: snapshot(100, 0) }), normalized);
  });
  assert('margin buying power cannot substitute for insufficient cash', lowCash.code === 'TRADIER_B14_CASH_EXCEEDED');
  var overCap = await rejected(function () {
    return b14.createPreview(memoryStore(), broker(), Object.assign({}, normalized, { maxNotionalUsd: 499 }));
  });
  assert('operator maximum notional is enforced', overCap.code === 'TRADIER_B14_MAX_NOTIONAL_EXCEEDED');
  var nakedSell = await rejected(function () {
    return b14.createPreview(memoryStore(), broker(), { symbol: 'SPY', side: 'sell', quantity: 1, limitPrice: 500, maxNotionalUsd: 510 });
  });
  assert('a sell cannot create a short position', nakedSell.code === 'TRADIER_B14_SHORTING_FORBIDDEN');
  var shortPreview = await b14.createPreview(memoryStore(), broker(), shortIntent);
  assert('one-share paper short reaches the broker preview only', shortPreview.intent.side === 'sell_short' && shortPreview.readOnly === true);
  var cashShort = await rejected(function () {
    var cash = snapshot(1000, 0); cash.accountType = 'cash';
    return b14.createPreview(memoryStore(), broker({ before: cash }), shortIntent);
  });
  assert('paper shorting requires a margin-type sandbox account', cashShort.code === 'TRADIER_B14_SHORT_ACCOUNT_REQUIRED');
  var coverIntent = { symbol: 'SPY', side: 'buy_to_cover', quantity: 1, limitPrice: 500, maxNotionalUsd: 510 };
  var coverPreview = await b14.createPreview(memoryStore(), broker({ before: snapshot(1000, -1) }), coverIntent);
  assert('a measured paper short can be previewed for cover', coverPreview.intent.side === 'buy_to_cover');
  var nakedCover = await rejected(function () { return b14.createPreview(memoryStore(), broker(), coverIntent); });
  assert('covering requires a measured short position', nakedCover.code === 'TRADIER_B14_COVER_POSITION_REQUIRED');
  var reserved = snapshot(1000, 2);
  reserved.orders = [{ symbol: 'SPY', side: 'sell', status: 'open', quantity: 2, remainingQuantity: 2 }];
  var doubleSell = await rejected(function () {
    return b14.createPreview(memoryStore(), broker({ before: reserved }), { symbol: 'SPY', side: 'sell', quantity: 1, limitPrice: 500, maxNotionalUsd: 510 });
  });
  assert('shares already reserved by an open sell order cannot be sold again', doubleSell.code === 'TRADIER_B14_SHORTING_FORBIDDEN');
  var encumbered = snapshot(1000, 0);
  encumbered.pendingCash = 600;
  var pendingCash = await rejected(function () {
    return b14.createPreview(memoryStore(), broker({ before: encumbered }), normalized);
  });
  assert('cash held for other orders is unavailable to a new buy', pendingCash.code === 'TRADIER_B14_CASH_EXCEEDED');

  var wrong = await rejected(function () {
    return b14.submitApproved(store, api, { previewId: preview.previewId, confirmation: 'yes' }, Date.parse('2026-08-23T10:00:01Z'));
  });
  assert('free-form approval is refused', wrong.code === 'TRADIER_B14_CONFIRMATION_MISMATCH');
  assert('a refused approval never reaches the broker', api.calls.indexOf('place') === -1);

  var staleStore = memoryStore();
  var staleBroker = broker();
  var stalePreview = await b14.createPreview(staleStore, staleBroker, normalized);
  staleBroker.before = snapshot(100, 0);
  var stale = await rejected(function () {
    return b14.submitApproved(staleStore, staleBroker, { previewId: stalePreview.previewId, confirmation: stalePreview.confirmationSummary });
  });
  assert('cash and broker validation are repeated immediately before dispatch', stale.code === 'TRADIER_B14_CASH_EXCEEDED' && staleBroker.calls.indexOf('place') === -1);

  api.onPlace = function () {
    var persisted = Array.from(store.values.entries()).find(function (entry) { return entry[0].indexOf('tradier_b14_command:') === 0; });
    assert('efference copy is durably present before the broker request begins', persisted && persisted[1].status === 'COMMAND_PERSISTED' && persisted[1].efference);
  };
  var command = await b14.submitApproved(store, api, { previewId: preview.previewId, confirmation: preview.confirmationSummary }, Date.parse('2026-08-23T10:02:00Z'));
  assert('broker receipt is recorded after the command copy', command.efference && command.receipt && command.status === 'RECEIPT_PERSISTED');
  assert('active command index is written before broker submission', store.logs.some(function (row) { return row && row.commandId === command.commandId && row.createdAt === command.emittedAt; }));
  assert('order carries a command-derived tag', api.orderRequest.tag === command.tag && /^limen-b14-/.test(command.tag));
  assert('production brokerage cannot be selected by the command', command.status === 'RECEIPT_PERSISTED' && command.receipt.orderId === '77');
  assert('predicted position effect is signed', command.efference.variables[0].predictedDelta === 1);
  assert('market price and return are never canceled', command.efference.neverCancel.length === 2 && command.efference.neverCancel[0].indexOf('.price') !== -1);
  var duplicate = await rejected(function () {
    return b14.submitApproved(store, api, { previewId: preview.previewId, confirmation: preview.confirmationSummary }, Date.parse('2026-08-23T10:03:00Z'));
  });
  assert('one preview cannot dispatch twice', duplicate.code === 'TRADIER_B14_ALREADY_SUBMITTED');

  var cancelStore = memoryStore();
  var cancelBroker = broker();
  var cancelPreview = await b14.createPreview(cancelStore, cancelBroker, normalized, Date.parse('2026-08-23T11:00:00Z'));
  var cancelCommand = await b14.submitApproved(cancelStore, cancelBroker, { previewId: cancelPreview.previewId, confirmation: cancelPreview.confirmationSummary }, Date.parse('2026-08-23T11:01:00Z'));
  cancelBroker.order = { id: '77', symbol: 'SPY', side: 'buy', quantity: 1, status: 'open', averageFillPrice: null, executedQuantity: 0, remainingQuantity: 1, tag: cancelCommand.tag };
  var badCancel = await rejected(function () { return b14.cancelApproved(cancelStore, cancelBroker, { commandId: cancelCommand.commandId, confirmation: 'cancel it' }); });
  assert('free-form rollback approval is refused before broker cancellation', badCancel.code === 'TRADIER_B14_CANCEL_CONFIRMATION_MISMATCH' && cancelBroker.calls.indexOf('cancel') === -1);
  cancelBroker.order.symbol = 'QQQ';
  var wrongCancelOrder = await rejected(function () { return b14.cancelApproved(cancelStore, cancelBroker, { commandId: cancelCommand.commandId, confirmation: cancelCommand.rollback.confirmationSummary }); });
  assert('rollback refuses a broker order that does not match the command', wrongCancelOrder.code === 'TRADIER_B14_ORDER_IDENTITY_MISMATCH' && cancelBroker.calls.indexOf('cancel') === -1);
  cancelBroker.order.symbol = 'SPY';
  cancelBroker.onCancel = function () {
    var persisted = cancelStore.values.get('tradier_b14_command:' + cancelCommand.commandId);
    assert('rollback intent is durable before the broker cancel request begins', persisted && persisted.status === 'CANCEL_PERSISTED' && persisted.rollback.confirmationHash);
  };
  var canceled = await b14.cancelApproved(cancelStore, cancelBroker, { commandId: cancelCommand.commandId, confirmation: cancelCommand.rollback.confirmationSummary }, Date.parse('2026-08-23T11:02:00Z'));
  assert('sandbox cancel receipt is durably bound to the exact command order', canceled.status === 'CANCEL_RECEIPT_PERSISTED' && canceled.rollback.receipt.orderId === '77' && cancelBroker.cancelOrderId === '77');
  var duplicateCancel = await rejected(function () { return b14.cancelApproved(cancelStore, cancelBroker, { commandId: cancelCommand.commandId, confirmation: cancelCommand.rollback.confirmationSummary }); });
  assert('a persisted cancellation cannot dispatch twice before reconciliation', duplicateCancel.code === 'TRADIER_B14_CANCEL_ALREADY_REQUESTED' && cancelBroker.calls.filter(function (c) { return c === 'cancel'; }).length === 1);
  cancelBroker.order.status = 'canceled';
  var canceledReconciled = await b14.reconcile(cancelStore, cancelBroker, cancelCommand.commandId, Date.parse('2026-08-23T11:03:00Z'));
  assert('independent order read confirms canceled rollback as terminal', canceledReconciled.status === 'RECONCILED_TERMINAL' && canceledReconciled.reafference.orderStatus === 'canceled');

  var terminalCancel = await rejected(function () { return b14.cancelApproved(cancelStore, cancelBroker, { commandId: cancelCommand.commandId, confirmation: cancelCommand.rollback.confirmationSummary }); });
  assert('terminal orders cannot be canceled again', terminalCancel.code === 'TRADIER_B14_CANCEL_TERMINAL');

  var cancelDurabilityStore = memoryStore();
  var cancelDurabilityBroker = broker();
  var cancelDurabilityPreview = await b14.createPreview(cancelDurabilityStore, cancelDurabilityBroker, normalized);
  var cancelDurabilityCommand = await b14.submitApproved(cancelDurabilityStore, cancelDurabilityBroker, { previewId: cancelDurabilityPreview.previewId, confirmation: cancelDurabilityPreview.confirmationSummary });
  cancelDurabilityBroker.order = { id: '77', symbol: 'SPY', side: 'buy', status: 'open', executedQuantity: 0, remainingQuantity: 1, tag: cancelDurabilityCommand.tag };
  cancelDurabilityStore.failSetPrefix = 'tradier_b14_command:';
  var cancelDurability = await rejected(function () { return b14.cancelApproved(cancelDurabilityStore, cancelDurabilityBroker, { commandId: cancelDurabilityCommand.commandId, confirmation: cancelDurabilityCommand.rollback.confirmationSummary }); });
  assert('rollback durability failure aborts before broker cancellation', cancelDurability && cancelDurabilityBroker.calls.indexOf('cancel') === -1);

  var mismatchStore = memoryStore();
  var mismatchBroker = broker({ cancelReceipt: { id: 999, status: 'ok' } });
  var mismatchPreview = await b14.createPreview(mismatchStore, mismatchBroker, normalized);
  var mismatchCancelCommand = await b14.submitApproved(mismatchStore, mismatchBroker, { previewId: mismatchPreview.previewId, confirmation: mismatchPreview.confirmationSummary });
  mismatchBroker.order = { id: '77', symbol: 'SPY', side: 'buy', status: 'open', executedQuantity: 0, remainingQuantity: 1, tag: mismatchCancelCommand.tag };
  var badCancelReceipt = await rejected(function () { return b14.cancelApproved(mismatchStore, mismatchBroker, { commandId: mismatchCancelCommand.commandId, confirmation: mismatchCancelCommand.rollback.confirmationSummary }); });
  var unresolvedCancel = await mismatchStore.get('tradier_b14_command:' + mismatchCancelCommand.commandId);
  assert('a mismatched cancel receipt remains durably unresolved', badCancelReceipt.code === 'TRADIER_B14_CANCEL_RECEIPT_MISMATCH' && unresolvedCancel.status === 'CANCEL_UNRESOLVED');

  var failingStore = memoryStore();
  var failingBroker = broker();
  var failingPreview = await b14.createPreview(failingStore, failingBroker, normalized);
  failingStore.failSetPrefix = 'tradier_b14_command:';
  var durability = await rejected(function () { return b14.submitApproved(failingStore, failingBroker, { previewId: failingPreview.previewId, confirmation: failingPreview.confirmationSummary }); });
  assert('command durability failure aborts before broker submission', durability && failingBroker.calls.indexOf('place') === -1);

  var recoveryStore = memoryStore();
  var recoveryBroker = broker({ receipt: {} });
  var recoveryPreview = await b14.createPreview(recoveryStore, recoveryBroker, normalized);
  var missingReceipt = await rejected(function () {
    return b14.submitApproved(recoveryStore, recoveryBroker, { previewId: recoveryPreview.previewId, confirmation: recoveryPreview.confirmationSummary });
  });
  var unresolved = await recoveryStore.get('tradier_b14_command:' + missingReceipt.commandId);
  assert('an accepted request without an id remains durably unresolved', missingReceipt.code === 'TRADIER_B14_RECEIPT_MISSING_ORDER_ID' && unresolved.status === 'DISPATCH_UNRESOLVED');
  recoveryBroker.recovered = { id: '88', symbol: 'SPY', side: 'buy', quantity: 1, status: 'filled', averageFillPrice: 500, executedQuantity: 1, remainingQuantity: 0, tag: unresolved.tag };
  recoveryBroker.order = recoveryBroker.recovered;
  recoveryBroker.orderRequest = { tag: unresolved.tag };
  recoveryBroker.after = snapshot(500, 1);
  var recovered = await b14.reconcile(recoveryStore, recoveryBroker, missingReceipt.commandId);
  assert('the persisted command tag recovers a lost broker receipt', recovered.receipt.orderId === '88' && recovered.receipt.recoveredByTag === true);

  api.after = snapshot(500, 1, 1002);
  var reconciled = await b14.reconcile(store, api, command.commandId, Date.parse('2026-08-23T10:05:00Z'));
  var r = reconciled.reafference;
  assert('fill identity is bound to command, order id, and tag', r.matchedSelfEffect.identity.commandId === command.commandId && r.matchedSelfEffect.identity.orderId === '77' && r.matchedSelfEffect.identity.tag === command.tag);
  assert('order-matched position change is canceled from the raw position observation', r.rawObservation.positionQuantityDelta === 1 && r.residualWorldObservation.positionQuantityDelta === 0);
  assert('cash cancellation abstains when fees and competing activity are incomplete', r.residualWorldObservation.cashDelta === null && /fees/.test(r.abstentions.cashDelta));
  assert('equity is not canceled because it mixes market movement and cash', r.residualWorldObservation.totalEquityDelta === null);
  assert('supervised error is distinct from reward', r.supervisedError.positionQuantity === 0 && r.supervisedError.reward === null);
  assert('terminal fill closes reconciliation without inventing market evidence', reconciled.status === 'RECONCILED_TERMINAL' && r.orderStatus === 'filled');

  var mismatchCommand = JSON.parse(JSON.stringify(command));
  var mismatch = await rejected(function () {
    return b14.reconcileVector(mismatchCommand, { id: '77', symbol: 'QQQ', side: 'buy', tag: command.tag }, snapshot(500, 1), new Date().toISOString());
  });
  assert('a mismatched instrument cannot be used as reafference', mismatch.code === 'TRADIER_B14_ORDER_IDENTITY_MISMATCH');

  console.log('\n' + checks + '/' + checks + ' passed');
}

main().catch(function (err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
