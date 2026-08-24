'use strict';

/**
 * B14 forward accounting for explicitly approved Tradier sandbox equity orders.
 *
 * This is not an investment selector. It accepts one operator-approved intent,
 * persists the predicted self-effect before dispatch, and later separates the
 * order-matched effect from the account movement observed around it.
 */

var crypto = require('node:crypto');

var PREVIEW_TTL_SECONDS = 30 * 60;
var LOG_CAP = 1000;
var ACTIVE_COMMAND_INDEX = 'tradier_b14_active_commands';
var TERMINAL = { filled: true, rejected: true, canceled: true, expired: true, error: true };

function fail(code, message) {
  var err = new Error(message);
  err.code = code;
  throw err;
}

function finite(value, name) {
  var n = Number(value);
  if (!Number.isFinite(n)) fail('TRADIER_B14_INVALID_' + name.toUpperCase(), name + ' must be finite');
  return n;
}

function normalizeIntent(input) {
  input = input || {};
  var symbol = String(input.symbol || '').trim().toUpperCase();
  var side = String(input.side || '').trim().toLowerCase();
  var quantity = finite(input.quantity, 'quantity');
  var limitPrice = finite(input.limitPrice, 'limit_price');
  var maxNotionalUsd = finite(input.maxNotionalUsd, 'max_notional_usd');
  if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) fail('TRADIER_B14_INVALID_SYMBOL', 'symbol is invalid');
  if (side !== 'buy' && side !== 'sell') fail('TRADIER_B14_INVALID_SIDE', 'only buy and sell are allowed; shorting is forbidden');
  if (!Number.isInteger(quantity) || quantity < 1) fail('TRADIER_B14_INVALID_QUANTITY', 'quantity must be a positive whole number');
  if (limitPrice <= 0) fail('TRADIER_B14_INVALID_LIMIT_PRICE', 'limitPrice must be positive');
  if (maxNotionalUsd <= 0) fail('TRADIER_B14_INVALID_MAX_NOTIONAL_USD', 'maxNotionalUsd must be positive');
  var horizons = Array.isArray(input.horizonDays) ? input.horizonDays.slice() : [30, 60, 90];
  if (JSON.stringify(horizons) !== '[30,60,90]') fail('TRADIER_B14_INVALID_HORIZONS', 'horizonDays must be exactly [30,60,90]');
  return {
    symbol: symbol,
    side: side,
    quantity: quantity,
    type: 'limit',
    duration: 'day',
    limitPrice: limitPrice,
    maxNotionalUsd: maxNotionalUsd,
    sourceArtifactId: input.sourceArtifactId ? String(input.sourceArtifactId) : null,
    thesisId: input.thesisId ? String(input.thesisId) : null,
    selectionId: input.selectionId ? String(input.selectionId) : null,
    actionId: input.actionId ? String(input.actionId) : null,
    ownerDomain: input.ownerDomain ? String(input.ownerDomain) : null,
    decisionContext: input.decisionContext && typeof input.decisionContext === 'object'
      ? JSON.parse(JSON.stringify(input.decisionContext)) : null,
    horizonDays: horizons
  };
}

function positionQuantity(snapshot, symbol) {
  var positions = snapshot && Array.isArray(snapshot.positions) ? snapshot.positions : [];
  for (var i = 0; i < positions.length; i++) {
    if (String(positions[i].symbol || '').toUpperCase() === symbol) return Number(positions[i].quantity) || 0;
  }
  return 0;
}

function reservedSellQuantity(snapshot, symbol) {
  var orders = snapshot && Array.isArray(snapshot.orders) ? snapshot.orders : [];
  var reserved = 0;
  for (var i = 0; i < orders.length; i++) {
    var order = orders[i];
    if (String(order.symbol || '').toUpperCase() !== symbol || order.side !== 'sell') continue;
    if (order.status !== 'pending' && order.status !== 'open' && order.status !== 'partially_filled') continue;
    var remaining = Number(order.remainingQuantity);
    reserved += Number.isFinite(remaining) ? Math.max(0, remaining) : Math.max(0, Number(order.quantity) || 0);
  }
  return reserved;
}

function validateCashLike(intent, snapshot, brokerPreview) {
  if (!snapshot || !Number.isFinite(snapshot.totalCash)) {
    fail('TRADIER_B14_CASH_UNMEASURED', 'total_cash is required; buying power is never substituted');
  }
  if (!brokerPreview || brokerPreview.result !== true || brokerPreview.status !== 'ok') {
    fail('TRADIER_B14_PREVIEW_REFUSED', 'Tradier did not approve the preview');
  }
  var commission = Number(brokerPreview.commission) || 0;
  var fees = Number(brokerPreview.fees) || 0;
  var limitNotional = intent.quantity * intent.limitPrice;
  var brokerCost = Number(brokerPreview.cost);
  var guardedNotional = Number.isFinite(brokerCost) && brokerCost > 0
    ? Math.max(limitNotional, brokerCost)
    : limitNotional + commission + fees;
  if (guardedNotional > intent.maxNotionalUsd + 1e-8) {
    fail('TRADIER_B14_MAX_NOTIONAL_EXCEEDED', 'preview exceeds the operator-supplied maximum notional');
  }
  var pendingCash = Number.isFinite(snapshot.pendingCash) ? Math.max(0, snapshot.pendingCash) : 0;
  var unclearedFunds = Number.isFinite(snapshot.unclearedFunds) ? Math.max(0, snapshot.unclearedFunds) : 0;
  var availableCash = Math.max(0, snapshot.totalCash - pendingCash - unclearedFunds);
  var heldQuantity = positionQuantity(snapshot, intent.symbol);
  var reservedQuantity = reservedSellQuantity(snapshot, intent.symbol);
  var availableLongQuantity = Math.max(0, heldQuantity - reservedQuantity);
  if (intent.side === 'buy' && guardedNotional > availableCash + 1e-8) {
    fail('TRADIER_B14_CASH_EXCEEDED', 'preview exceeds total_cash; margin buying power is forbidden');
  }
  if (intent.side === 'sell' && availableLongQuantity < intent.quantity) {
    fail('TRADIER_B14_SHORTING_FORBIDDEN', 'sell quantity exceeds the measured long position');
  }
  return {
    totalCash: snapshot.totalCash,
    pendingCash: pendingCash,
    unclearedFunds: unclearedFunds,
    availableCash: availableCash,
    heldQuantity: heldQuantity,
    reservedSellQuantity: reservedQuantity,
    availableLongQuantity: availableLongQuantity,
    limitNotional: limitNotional,
    brokerCost: Number.isFinite(brokerCost) ? brokerCost : null,
    guardedNotional: guardedNotional,
    commission: commission,
    fees: fees
  };
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function nowIso(now) { return new Date(now === undefined ? Date.now() : now).toISOString(); }
function previewKey(id) { return 'tradier_b14_preview:' + id; }
function commandKey(id) { return 'tradier_b14_command:' + id; }

async function log(store, event) {
  await store.lpush('tradier_b14_log', event);
  await store.ltrim('tradier_b14_log', 0, LOG_CAP - 1);
}

// The event log is capped, but 30/60/90-day commands must remain discoverable
// after their later receipt events roll out of that log. This index is durable
// and intentionally not trimmed; the observer deduplicates command IDs.
async function indexActiveCommand(store, command) {
  await store.lpush(ACTIVE_COMMAND_INDEX, {
    commandId: command.commandId,
    createdAt: command.emittedAt,
    horizonDays: command.intent && command.intent.horizonDays || [30, 60, 90]
  });
}

async function createPreview(store, broker, input, now) {
  store.assertDurable();
  var intent = normalizeIntent(input);
  var accountBefore = await broker.accountSnapshot();
  var brokerRequest = {
    class: 'equity', symbol: intent.symbol, side: intent.side,
    quantity: String(intent.quantity), type: 'limit', duration: 'day',
    price: intent.limitPrice.toFixed(2)
  };
  var brokerPreview = await broker.previewOrder(brokerRequest);
  var cashGuard = validateCashLike(intent, accountBefore, brokerPreview);
  var createdAt = nowIso(now);
  var core = { schemaVersion: 1, environment: 'sandbox', intent: intent, accountBefore: accountBefore, brokerPreview: brokerPreview, cashGuard: cashGuard, createdAt: createdAt };
  var previewId = 'tpv_' + hash(core).slice(0, 24);
  var expiresAt = nowIso(new Date(createdAt).getTime() + PREVIEW_TTL_SECONDS * 1000);
  var confirmationSummary = 'APPROVE TRADIER SANDBOX ' + intent.side.toUpperCase() + ' ' + intent.quantity + ' ' + intent.symbol +
    ' LIMIT ' + intent.limitPrice.toFixed(2) + ' MAX USD ' + intent.maxNotionalUsd.toFixed(2) + ' PREVIEW ' + previewId;
  var record = Object.assign({}, core, {
    previewId: previewId,
    expiresAt: expiresAt,
    confirmationSummary: confirmationSummary,
    status: 'PREVIEWED',
    readOnly: true
  });
  await store.set(previewKey(previewId), record, PREVIEW_TTL_SECONDS);
  await log(store, { type: 'PREVIEWED', previewId: previewId, at: createdAt, intent: intent, cashGuard: cashGuard });
  return record;
}

function predictedEffects(preview, commandId, emittedAt) {
  var intent = preview.intent;
  var sign = intent.side === 'buy' ? 1 : -1;
  var cashSign = intent.side === 'buy' ? -1 : 1;
  var previewCost = Number(preview.cashGuard.brokerCost);
  return {
    schemaVersion: 1,
    efferenceCopyId: 'tef_' + commandId.slice(4),
    emittedAt: emittedAt,
    commandId: commandId,
    actionKind: 'tradier_sandbox_equity_order',
    variables: [
      {
        variable: 'finance.position.' + intent.symbol + '.quantity',
        predictedDelta: sign * intent.quantity,
        unit: 'shares',
        cancellationRule: 'only the executed quantity on the matching Tradier order id and tag'
      },
      {
        variable: 'finance.account.cash',
        predictedDelta: Number.isFinite(previewCost) ? cashSign * previewCost : null,
        unit: 'USD',
        cancellationRule: 'abstain unless fill value and all fees are established'
      }
    ],
    neverCancel: ['finance.market.' + intent.symbol + '.price', 'finance.market.' + intent.symbol + '.return'],
    supervisedSignal: 'actual self-effect minus predicted self-effect; never reward'
  };
}

async function submitApproved(store, broker, input, now) {
  store.assertDurable();
  input = input || {};
  var previewId = String(input.previewId || '');
  var preview = await store.get(previewKey(previewId));
  if (!preview) fail('TRADIER_B14_PREVIEW_NOT_FOUND', 'preview is missing or expired');
  if (preview.status !== 'PREVIEWED') fail('TRADIER_B14_PREVIEW_NOT_OPEN', 'preview is not open for approval');
  if (Date.parse(preview.expiresAt) <= (now === undefined ? Date.now() : Number(now))) fail('TRADIER_B14_PREVIEW_EXPIRED', 'preview has expired');
  if (String(input.confirmation || '') !== preview.confirmationSummary) {
    fail('TRADIER_B14_CONFIRMATION_MISMATCH', 'confirmation must exactly match the stored preview summary');
  }

  // Approval binds the order envelope, not stale account state. Re-read both the
  // account and Tradier's preview immediately before dispatch and reapply every
  // cash-like constraint.
  var orderRequest = {
    class: 'equity', symbol: preview.intent.symbol, side: preview.intent.side,
    quantity: String(preview.intent.quantity), type: 'limit', duration: 'day',
    price: preview.intent.limitPrice.toFixed(2)
  };
  var accountBefore = await broker.accountSnapshot();
  var dispatchPreview = await broker.previewOrder(orderRequest);
  var dispatchCashGuard = validateCashLike(preview.intent, accountBefore, dispatchPreview);

  var commandId = 'tcmd_' + hash({ previewId: previewId, confirmation: input.confirmation }).slice(0, 24);
  var emittedAt = nowIso(now);
  var tag = 'limen-b14-' + commandId.slice(-12);
  var command = {
    schemaVersion: 1,
    commandId: commandId,
    previewId: previewId,
    status: 'COMMAND_PERSISTED',
    emittedAt: emittedAt,
    intent: preview.intent,
    accountBefore: accountBefore,
    approvedBrokerPreview: preview.brokerPreview,
    dispatchBrokerPreview: dispatchPreview,
    dispatchCashGuard: dispatchCashGuard,
    tag: tag,
    efference: predictedEffects(Object.assign({}, preview, { cashGuard: dispatchCashGuard }), commandId, emittedAt),
    approval: { approvedBy: 'operator', approvedAt: emittedAt, confirmationHash: hash(input.confirmation) }
  };
  // No TTL: this command is the 30/60/90-day attribution record. Expiring it
  // before those outcome windows would sever the motor event from its evidence.
  var claimed = await store.setIfAbsent(commandKey(commandId), command);
  if (!claimed) fail('TRADIER_B14_ALREADY_SUBMITTED', 'this preview has already been claimed');
  await log(store, { type: 'COMMAND_PERSISTED', commandId: commandId, previewId: previewId, at: emittedAt, efference: command.efference });
  try {
    await indexActiveCommand(store, command);
  } catch (err) {
    command.status = 'DISPATCH_UNRESOLVED';
    command.dispatchError = { code: 'TRADIER_B14_ACTIVE_INDEX_FAILED', message: err && err.message || String(err) };
    command.updatedAt = nowIso();
    await store.set(commandKey(commandId), command);
    var indexError = new Error(command.dispatchError.message);
    indexError.code = command.dispatchError.code;
    indexError.commandId = commandId;
    throw indexError;
  }

  orderRequest.tag = tag;
  var receipt;
  try {
    receipt = await broker.placeOrder(orderRequest);
  } catch (err) {
    command.status = 'DISPATCH_UNRESOLVED';
    command.dispatchError = { code: err && err.code || 'TRADIER_B14_DISPATCH_FAILED', message: err && err.message || String(err) };
    command.updatedAt = nowIso();
    await store.set(commandKey(commandId), command);
    await log(store, { type: 'DISPATCH_UNRESOLVED', commandId: commandId, at: command.updatedAt, error: command.dispatchError });
    err.commandId = commandId;
    throw err;
  }
  if (!receipt || receipt.id === undefined || receipt.id === null) {
    command.status = 'DISPATCH_UNRESOLVED';
    command.dispatchError = { code: 'TRADIER_B14_RECEIPT_MISSING_ORDER_ID', message: 'Tradier accepted the request without an order id; reconcile by command tag' };
    command.updatedAt = nowIso();
    await store.set(commandKey(commandId), command);
    await log(store, { type: 'DISPATCH_UNRESOLVED', commandId: commandId, at: command.updatedAt, error: command.dispatchError });
    var missing = new Error(command.dispatchError.message);
    missing.code = command.dispatchError.code;
    missing.commandId = commandId;
    throw missing;
  }
  command.status = 'RECEIPT_PERSISTED';
  command.receipt = { orderId: String(receipt.id), brokerStatus: receipt.status || null, partnerId: receipt.partner_id || null, receivedAt: nowIso() };
  command.updatedAt = command.receipt.receivedAt;
  await store.set(commandKey(commandId), command);
  await log(store, { type: 'RECEIPT_PERSISTED', commandId: commandId, at: command.updatedAt, receipt: command.receipt });
  return command;
}

function reconcileVector(command, order, accountAfter, observedAt) {
  if (!order) fail('TRADIER_B14_ORDER_NOT_FOUND', 'Tradier order was not found');
  if (String(order.id) !== String(command.receipt && command.receipt.orderId) || order.tag !== command.tag ||
      order.symbol !== command.intent.symbol || order.side !== command.intent.side) {
    fail('TRADIER_B14_ORDER_IDENTITY_MISMATCH', 'order identity does not match the persisted command');
  }
  var executed = Number(order.executedQuantity);
  if (!Number.isFinite(executed) || executed < 0) executed = 0;
  var sign = command.intent.side === 'buy' ? 1 : -1;
  var beforeQty = positionQuantity(command.accountBefore, command.intent.symbol);
  var afterQty = positionQuantity(accountAfter, command.intent.symbol);
  var rawQtyDelta = afterQty - beforeQty;
  var selfQtyDelta = sign * executed;
  var averageFillPrice = Number(order.averageFillPrice);
  var cashKnown = Number.isFinite(averageFillPrice) && executed > 0;
  var selfCashEstimate = cashKnown ? (command.intent.side === 'buy' ? -1 : 1) * averageFillPrice * executed : null;
  var rawCashDelta = Number.isFinite(command.accountBefore.totalCash) && Number.isFinite(accountAfter.totalCash)
    ? accountAfter.totalCash - command.accountBefore.totalCash : null;
  return {
    schemaVersion: 1,
    commandId: command.commandId,
    orderId: String(order.id),
    observedAt: observedAt,
    terminal: !!TERMINAL[order.status],
    orderStatus: order.status,
    rawObservation: {
      positionQuantityDelta: rawQtyDelta,
      cashDelta: rawCashDelta,
      totalEquityDelta: Number.isFinite(command.accountBefore.totalEquity) && Number.isFinite(accountAfter.totalEquity)
        ? accountAfter.totalEquity - command.accountBefore.totalEquity : null,
      marketPriceDelta: null
    },
    matchedSelfEffect: {
      positionQuantityDelta: selfQtyDelta,
      cashDeltaEstimateBeforeFees: selfCashEstimate,
      identity: { commandId: command.commandId, orderId: String(order.id), tag: order.tag },
      averageFillPrice: Number.isFinite(averageFillPrice) ? averageFillPrice : null,
      executedQuantity: executed
    },
    residualWorldObservation: {
      positionQuantityDelta: rawQtyDelta - selfQtyDelta,
      cashDelta: null,
      totalEquityDelta: null,
      marketPriceDelta: null
    },
    abstentions: {
      cashDelta: 'order status does not establish all commissions, fees, settlement, or competing account activity',
      totalEquityDelta: 'equity mixes cash, position value, and external market price',
      marketPriceDelta: 'market price is external and is never canceled as a self-effect'
    },
    supervisedError: {
      positionQuantity: selfQtyDelta - command.efference.variables[0].predictedDelta,
      cash: null,
      reward: null
    }
  };
}

async function reconcile(store, broker, commandId, now) {
  store.assertDurable();
  var command = await store.get(commandKey(String(commandId || '')));
  if (!command) fail('TRADIER_B14_COMMAND_NOT_FOUND', 'command was not found');
  if (!command.receipt || !command.receipt.orderId) {
    var recovered = await broker.findOrderByTag(command.tag);
    if (!recovered || !recovered.id) fail('TRADIER_B14_COMMAND_UNRESOLVED', 'command has no persisted or tag-recoverable broker order id');
    command.receipt = { orderId: String(recovered.id), brokerStatus: recovered.status || null, partnerId: null, receivedAt: nowIso(now), recoveredByTag: true };
    command.status = 'RECEIPT_RECOVERED';
    await store.set(commandKey(command.commandId), command);
    await log(store, { type: 'RECEIPT_RECOVERED', commandId: command.commandId, at: command.receipt.receivedAt, receipt: command.receipt });
  }
  var results = await Promise.all([broker.getOrder(command.receipt.orderId), broker.accountSnapshot()]);
  var observedAt = nowIso(now);
  var reafference = reconcileVector(command, results[0], results[1], observedAt);
  command.status = reafference.terminal ? 'RECONCILED_TERMINAL' : 'RECONCILED_UNRESOLVED';
  command.order = results[0];
  command.accountAfter = results[1];
  command.reafference = reafference;
  command.updatedAt = observedAt;
  await store.set(commandKey(command.commandId), command);
  await log(store, { type: command.status, commandId: command.commandId, at: observedAt, reafference: reafference });
  return command;
}

async function read(store, commandId) {
  store.assertDurable();
  return store.get(commandKey(String(commandId || '')));
}

module.exports = {
  PREVIEW_TTL_SECONDS: PREVIEW_TTL_SECONDS,
  normalizeIntent: normalizeIntent,
  validateCashLike: validateCashLike,
  positionQuantity: positionQuantity,
  reservedSellQuantity: reservedSellQuantity,
  createPreview: createPreview,
  submitApproved: submitApproved,
  reconcileVector: reconcileVector,
  reconcile: reconcile,
  read: read
};
