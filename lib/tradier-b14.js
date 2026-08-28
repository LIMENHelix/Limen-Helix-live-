'use strict';

/**
 * B14 forward accounting for explicitly approved Tradier sandbox equity orders.
 *
 * This is not an investment selector. It accepts one operator-approved intent,
 * persists the predicted self-effect before dispatch, and later separates the
 * order-matched effect from the account movement observed around it.
 */

var crypto = require('node:crypto');
var AdapterGuard = require('./civilization-adapter-guard.js');

var PREVIEW_TTL_SECONDS = 30 * 60;
var LOG_CAP = 1000;
var ACTIVE_COMMAND_INDEX = 'tradier_b14_active_commands';
var TERMINAL = { filled: true, rejected: true, canceled: true, expired: true, error: true };
var APPROVAL_MODES = { operator: true, 'domain-autonomous': true, commissioning: true, recovery: true };

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
  var benchmarkSymbol = input.benchmarkSymbol == null ? null : String(input.benchmarkSymbol).trim().toUpperCase();
  var benchmarkBaselineValue = input.benchmarkBaselineValue == null ? null : finite(input.benchmarkBaselineValue, 'benchmark_baseline_value');
  var riskLimitPct = input.riskLimitPct == null ? null : finite(input.riskLimitPct, 'risk_limit_pct');
  if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) fail('TRADIER_B14_INVALID_SYMBOL', 'symbol is invalid');
  if (['buy', 'sell', 'sell_short', 'buy_to_cover'].indexOf(side) < 0) {
    fail('TRADIER_B14_INVALID_SIDE', 'side must be buy, sell, sell_short, or buy_to_cover');
  }
  if (!Number.isInteger(quantity) || quantity < 1) fail('TRADIER_B14_INVALID_QUANTITY', 'quantity must be a positive whole number');
  if (limitPrice <= 0) fail('TRADIER_B14_INVALID_LIMIT_PRICE', 'limitPrice must be positive');
  if (maxNotionalUsd <= 0) fail('TRADIER_B14_INVALID_MAX_NOTIONAL_USD', 'maxNotionalUsd must be positive');
  if (benchmarkSymbol !== null && !/^[A-Z][A-Z0-9.\-]{0,9}$/.test(benchmarkSymbol)) fail('TRADIER_B14_INVALID_BENCHMARK_SYMBOL', 'benchmarkSymbol is invalid');
  if (benchmarkBaselineValue !== null && benchmarkBaselineValue <= 0) fail('TRADIER_B14_INVALID_BENCHMARK_BASELINE_VALUE', 'benchmarkBaselineValue must be positive');
  if (riskLimitPct !== null && (riskLimitPct < 0 || riskLimitPct > 100)) fail('TRADIER_B14_INVALID_RISK_LIMIT_PCT', 'riskLimitPct must be between 0 and 100');
  var horizons = Array.isArray(input.horizonDays) ? input.horizonDays.slice() : [30, 60, 90];
  var allowedHorizons = [1, 3, 7, 14, 30, 60, 90];
  if (!horizons.length || horizons.some(function (h, i) {
    return allowedHorizons.indexOf(h) < 0 || (i > 0 && horizons[i - 1] >= h);
  })) fail('TRADIER_B14_INVALID_HORIZONS', 'horizonDays must be a strictly increasing subset of [1,3,7,14,30,60,90]');
  return {
    symbol: symbol,
    side: side,
    quantity: quantity,
    type: 'limit',
    duration: 'day',
    limitPrice: limitPrice,
    maxNotionalUsd: maxNotionalUsd,
    benchmarkSymbol: benchmarkSymbol,
    benchmarkBaselineValue: benchmarkBaselineValue,
    riskLimitPct: riskLimitPct,
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

function isBuySide(side) { return side === 'buy' || side === 'buy_to_cover'; }

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

function reservedCoverQuantity(snapshot, symbol) {
  var orders = snapshot && Array.isArray(snapshot.orders) ? snapshot.orders : [];
  var reserved = 0;
  for (var i = 0; i < orders.length; i++) {
    var order = orders[i];
    if (String(order.symbol || '').toUpperCase() !== symbol || order.side !== 'buy_to_cover') continue;
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
  var reservedCover = reservedCoverQuantity(snapshot, intent.symbol);
  var availableLongQuantity = Math.max(0, heldQuantity - reservedQuantity);
  var availableShortQuantity = Math.max(0, Math.abs(Math.min(0, heldQuantity)) - reservedCover);
  if (isBuySide(intent.side) && guardedNotional > availableCash + 1e-8) {
    fail('TRADIER_B14_CASH_EXCEEDED', 'preview exceeds total_cash; margin buying power is forbidden');
  }
  if (intent.side === 'sell' && availableLongQuantity < intent.quantity) {
    fail('TRADIER_B14_SHORTING_FORBIDDEN', 'sell quantity exceeds the measured long position');
  }
  if (intent.side === 'sell_short') {
    if (String(snapshot.accountType || '').toLowerCase() !== 'margin') {
      fail('TRADIER_B14_SHORT_ACCOUNT_REQUIRED', 'Tradier sandbox short preview requires a margin-type paper account');
    }
    if (heldQuantity !== 0) fail('TRADIER_B14_SHORT_STACKING_FORBIDDEN', 'a new paper short requires no existing position');
  }
  if (intent.side === 'buy_to_cover' && availableShortQuantity < intent.quantity) {
    fail('TRADIER_B14_COVER_POSITION_REQUIRED', 'cover quantity exceeds the measured short position');
  }
  return {
    totalCash: snapshot.totalCash,
    pendingCash: pendingCash,
    unclearedFunds: unclearedFunds,
    availableCash: availableCash,
    heldQuantity: heldQuantity,
    reservedSellQuantity: reservedQuantity,
    reservedCoverQuantity: reservedCover,
    availableLongQuantity: availableLongQuantity,
    availableShortQuantity: availableShortQuantity,
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
function approvalEnvelope(input, intent, operation) {
  var value = input && input.approval || {};
  var mode = String(value.mode || '').trim();
  var actor = String(value.actor || '').trim();
  var ownerDomain = String(value.ownerDomain || '').trim().toLowerCase();
  var authorizationReceiptId = String(value.authorizationReceiptId || '').trim();
  var expectedOwner = String(intent && intent.ownerDomain || '').trim().toLowerCase();
  if (!APPROVAL_MODES[mode] || !actor || !ownerDomain || !authorizationReceiptId) {
    fail('TRADIER_B14_APPROVAL_AUTHORITY_REQUIRED', 'an explicit operator, domain-autonomous, commissioning, or recovery authority receipt is required');
  }
  if (!expectedOwner || ownerDomain !== expectedOwner) {
    fail('TRADIER_B14_APPROVAL_OWNER_MISMATCH', 'approval owner domain must match the persisted intent owner');
  }
  return {
    mode: mode,
    actor: actor,
    ownerDomain: ownerDomain,
    authorizationReceiptId: authorizationReceiptId,
    authorizationMode: value.authorizationMode ? String(value.authorizationMode) : null,
    operation: operation
  };
}
function previewKey(id) { return 'tradier_b14_preview:' + id; }
function commandKey(id) { return 'tradier_b14_command:' + id; }
function cancellationSummary(command) {
  if (!command || !command.commandId || !command.receipt || !command.receipt.orderId) {
    fail('TRADIER_B14_CANCEL_UNAVAILABLE', 'a persisted command and broker order id are required');
  }
  return 'CANCEL TRADIER SANDBOX ORDER ' + String(command.receipt.orderId) + ' COMMAND ' + String(command.commandId);
}

async function log(store, event) {
  await store.lpush('tradier_b14_log', event);
  await store.ltrim('tradier_b14_log', 0, LOG_CAP - 1);
}

// The event log is capped, but multiscale outcome commands must remain discoverable
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
  var ownerDomain = intent.ownerDomain || 'finance';
  var sign = isBuySide(intent.side) ? 1 : -1;
  var cashSign = isBuySide(intent.side) ? -1 : 1;
  var previewCost = Number(preview.cashGuard.brokerCost);
  return {
    schemaVersion: 1,
    efferenceCopyId: 'tef_' + commandId.slice(4),
    emittedAt: emittedAt,
    commandId: commandId,
    actionKind: 'tradier_sandbox_equity_order',
    variables: [
      {
        variable: ownerDomain + '.position.' + intent.symbol + '.quantity',
        predictedDelta: sign * intent.quantity,
        unit: 'shares',
        cancellationRule: 'only the executed quantity on the matching Tradier order id and tag'
      },
      {
        variable: ownerDomain + '.account.cash',
        predictedDelta: Number.isFinite(previewCost) ? cashSign * previewCost : null,
        unit: 'USD',
        cancellationRule: 'abstain unless fill value and all fees are established'
      }
    ],
    neverCancel: [ownerDomain + '.market.' + intent.symbol + '.price', ownerDomain + '.market.' + intent.symbol + '.return'],
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
  var approval = approvalEnvelope(input, preview.intent, 'submit');

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
    approval: Object.assign({}, approval, { approvedAt: emittedAt, confirmationHash: hash(input.confirmation) })
  };
  // No TTL: this command is the multiscale attribution record. Expiring it
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
    var adapterValveId = AdapterGuard.investmentValve(command.intent && command.intent.ownerDomain);
    if (!adapterValveId) fail(AdapterGuard.INHIBITED, 'no investment valve is declared for the intent owner');
    command.adapterGuard = await AdapterGuard.checkpoint(store, adapterValveId, 'tradier-sandbox-order-placement');
    receipt = await broker.placeOrder(orderRequest);
  } catch (err) {
    command.status = err && err.code === AdapterGuard.INHIBITED ? 'DISPATCH_INHIBITED' : 'DISPATCH_UNRESOLVED';
    command.dispatchError = { code: err && err.code || 'TRADIER_B14_DISPATCH_FAILED', message: err && err.message || String(err) };
    command.providerCalled = err && err.code === AdapterGuard.INHIBITED ? false : null;
    command.updatedAt = nowIso();
    await store.set(commandKey(commandId), command);
    await log(store, { type: command.status, commandId: commandId, at: command.updatedAt, error: command.dispatchError });
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
  command.rollback = {
    policy: 'cancel-unfilled-remainder',
    confirmationSummary: cancellationSummary(command),
    status: 'AVAILABLE'
  };
  command.updatedAt = command.receipt.receivedAt;
  await store.set(commandKey(commandId), command);
  await log(store, { type: 'RECEIPT_PERSISTED', commandId: commandId, at: command.updatedAt, receipt: command.receipt });
  return command;
}

async function cancelApproved(store, broker, input, now) {
  store.assertDurable();
  input = input || {};
  var commandId = String(input.commandId || '');
  var command = await store.get(commandKey(commandId));
  if (!command) fail('TRADIER_B14_COMMAND_NOT_FOUND', 'command was not found');
  if (!command.receipt || !command.receipt.orderId) {
    fail('TRADIER_B14_CANCEL_UNAVAILABLE', 'command has no persisted broker order id; reconcile it first');
  }
  var expected = cancellationSummary(command);
  if (String(input.confirmation || '') !== expected) {
    fail('TRADIER_B14_CANCEL_CONFIRMATION_MISMATCH', 'cancellation must exactly match the stored rollback summary');
  }
  var approval = approvalEnvelope(input, command.intent, 'cancel');
  var order = await broker.getOrder(command.receipt.orderId);
  if (!order || String(order.id) !== String(command.receipt.orderId) || order.tag !== command.tag ||
      order.symbol !== command.intent.symbol || order.side !== command.intent.side) {
    fail('TRADIER_B14_ORDER_IDENTITY_MISMATCH', 'order identity does not match the persisted command');
  }
  if (TERMINAL[order.status]) fail('TRADIER_B14_CANCEL_TERMINAL', 'terminal order cannot be canceled');
  if (command.rollback && command.rollback.status && command.rollback.status !== 'AVAILABLE') {
    fail('TRADIER_B14_CANCEL_ALREADY_REQUESTED', 'cancellation was already requested; reconcile before any further action');
  }

  var requestedAt = nowIso(now);
  command.rollback = {
    schemaVersion: 1,
    policy: 'cancel-unfilled-remainder',
    confirmationSummary: expected,
    confirmationHash: hash(input.confirmation),
    approval: approval,
    requestedAt: requestedAt,
    status: 'CANCEL_PERSISTED',
    orderBefore: order,
    predictedEffect: 'prevent any not-yet-executed quantity; preserve and reconcile any partial fill'
  };
  command.status = 'CANCEL_PERSISTED';
  command.updatedAt = requestedAt;
  await store.set(commandKey(commandId), command);
  await log(store, { type: 'CANCEL_PERSISTED', commandId: commandId, orderId: command.receipt.orderId, at: requestedAt, rollback: command.rollback });

  var cancelReceipt;
  try {
    cancelReceipt = await broker.cancelOrder(command.receipt.orderId);
  } catch (err) {
    command.status = 'CANCEL_UNRESOLVED';
    command.rollback.status = 'CANCEL_UNRESOLVED';
    command.rollback.error = { code: err && err.code || 'TRADIER_B14_CANCEL_FAILED', message: err && err.message || String(err) };
    command.updatedAt = nowIso();
    await store.set(commandKey(commandId), command);
    await log(store, { type: 'CANCEL_UNRESOLVED', commandId: commandId, orderId: command.receipt.orderId, at: command.updatedAt, error: command.rollback.error });
    err.commandId = commandId;
    throw err;
  }
  if (!cancelReceipt || cancelReceipt.id === undefined || String(cancelReceipt.id) !== String(command.receipt.orderId)) {
    var identityError = new Error('Tradier cancel receipt did not match the persisted order id');
    identityError.code = 'TRADIER_B14_CANCEL_RECEIPT_MISMATCH';
    identityError.commandId = commandId;
    command.status = 'CANCEL_UNRESOLVED';
    command.rollback.status = 'CANCEL_UNRESOLVED';
    command.rollback.error = { code: identityError.code, message: identityError.message };
    command.updatedAt = nowIso();
    await store.set(commandKey(commandId), command);
    await log(store, { type: 'CANCEL_UNRESOLVED', commandId: commandId, orderId: command.receipt.orderId, at: command.updatedAt, error: command.rollback.error });
    throw identityError;
  }
  command.status = 'CANCEL_RECEIPT_PERSISTED';
  command.rollback.status = 'CANCEL_RECEIPT_PERSISTED';
  command.rollback.receipt = {
    orderId: String(cancelReceipt.id),
    brokerStatus: cancelReceipt && cancelReceipt.status || null,
    receivedAt: nowIso()
  };
  command.updatedAt = command.rollback.receipt.receivedAt;
  await store.set(commandKey(commandId), command);
  await log(store, { type: 'CANCEL_RECEIPT_PERSISTED', commandId: commandId, orderId: command.receipt.orderId, at: command.updatedAt, receipt: command.rollback.receipt });
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
  var sign = isBuySide(command.intent.side) ? 1 : -1;
  var beforeQty = positionQuantity(command.accountBefore, command.intent.symbol);
  var afterQty = positionQuantity(accountAfter, command.intent.symbol);
  var rawQtyDelta = afterQty - beforeQty;
  var selfQtyDelta = sign * executed;
  var averageFillPrice = Number(order.averageFillPrice);
  var cashKnown = Number.isFinite(averageFillPrice) && executed > 0;
  var selfCashEstimate = cashKnown ? (isBuySide(command.intent.side) ? -1 : 1) * averageFillPrice * executed : null;
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
  ACTIVE_COMMAND_INDEX: ACTIVE_COMMAND_INDEX,
  APPROVAL_MODES: Object.assign({}, APPROVAL_MODES),
  normalizeIntent: normalizeIntent,
  approvalEnvelope: approvalEnvelope,
  validateCashLike: validateCashLike,
  positionQuantity: positionQuantity,
  reservedSellQuantity: reservedSellQuantity,
  createPreview: createPreview,
  submitApproved: submitApproved,
  cancellationSummary: cancellationSummary,
  cancelApproved: cancelApproved,
  reconcileVector: reconcileVector,
  reconcile: reconcile,
  read: read
};
