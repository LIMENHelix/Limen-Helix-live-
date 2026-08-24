'use strict';

/**
 * Read-only Tradier sandbox outcome observer.
 *
 * This module never places an order and never infers an investment from a
 * domain signal. It turns a persisted, reconciled B14 paper command into a
 * 30/60/90-day outcome only when the command carries all source terms needed
 * to attribute the position and compare it with an explicitly named
 * benchmark. Missing terms are abstentions, not zeroes.
 */

var crypto = require('node:crypto');
var contract = require('./autofire-outcome-contract');

var HORIZONS = [30, 60, 90];
var DAY_MS = 24 * 60 * 60 * 1000;
var HORIZON_LAG_MS = 48 * 60 * 60 * 1000;

function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function parseTime(value) {
  var n = Date.parse(String(value || ''));
  return Number.isFinite(n) ? n : null;
}
function position(snapshot, symbol) {
  var rows = snapshot && Array.isArray(snapshot.positions) ? snapshot.positions : [];
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].symbol || '').toUpperCase() === String(symbol || '').toUpperCase()) return rows[i];
  }
  return null;
}
function abstain(command, reason, extra) {
  return Object.assign({
    status: 'ABSTAINED',
    commandId: command && command.commandId || null,
    reason: reason,
    events: []
  }, extra || {});
}
function waiting(command, dueHorizons) {
  return {
    status: 'WAITING',
    commandId: command && command.commandId || null,
    dueHorizons: dueHorizons,
    events: []
  };
}
function orderTerms(command) {
  var order = command && command.order;
  var matched = command && command.reafference && command.reafference.matchedSelfEffect;
  var intent = command && command.intent || {};
  var executed = matched && matched.executedQuantity !== undefined
    ? Number(matched.executedQuantity) : Number(order && order.executedQuantity);
  var fill = matched && matched.averageFillPrice !== undefined
    ? Number(matched.averageFillPrice) : Number(order && order.averageFillPrice);
  var status = String(order && order.status || '').toLowerCase();
  if (!Number.isFinite(executed) || executed <= 0) return { error: 'executed-quantity-unmeasured' };
  if (!Number.isFinite(fill) || fill <= 0) return { error: 'average-fill-price-unmeasured' };
  if (status !== 'filled' && status !== 'partially_filled') return { error: 'order-not-filled' };
  if (intent.side !== 'buy') return { error: 'sell-attribution-not-supported' };
  return { executed: executed, fill: fill, order: order, intent: intent };
}
function fillTime(command, terms) {
  return parseTime(terms.order && (terms.order.transactionAt || terms.order.createdAt)) ||
    parseTime(command && command.receipt && command.receipt.receivedAt) ||
    parseTime(command && command.emittedAt);
}
function quoteValue(quote) {
  if (!quote || typeof quote !== 'object') return null;
  var value = quote.last === undefined ? (quote.price === undefined ? quote.value : quote.price) : quote.last;
  return finite(Number(value)) && Number(value) > 0 ? Number(value) : null;
}
function snapshotId(account, quote, observedAt) {
  return 'tsnap_' + hash({
    accountId: account && account.accountId || null,
    observedAt: observedAt,
    totalEquity: account && account.totalEquity,
    positions: account && account.positions || [],
    benchmark: quote && quote.symbol || null,
    benchmarkValue: quoteValue(quote)
  }).slice(0, 24);
}
function maxDrawdown(values) {
  var peak = null;
  var max = 0;
  values.forEach(function (value) {
    if (!finite(value) || value <= 0) return;
    if (peak === null || value > peak) peak = value;
    if (peak > 0) max = Math.max(max, ((peak - value) / peak) * 100);
  });
  return max;
}
function horizonMeasurement(history, dueAt) {
  var candidates = (Array.isArray(history) ? history : []).filter(function (row) {
    var at = parseTime(row && row.observedAt);
    return at !== null && at >= dueAt && at <= dueAt + HORIZON_LAG_MS &&
      finite(Number(row.positionMarketValue)) && Number(row.positionMarketValue) > 0 &&
      finite(Number(row.positionQuantity)) && Number(row.positionQuantity) > 0 &&
      finite(Number(row.benchmarkValue)) && Number(row.benchmarkValue) > 0;
  }).sort(function (a, b) { return parseTime(a.observedAt) - parseTime(b.observedAt); });
  return candidates.length ? candidates[0] : null;
}

function observationSnapshot(command, account, quote, observedAt) {
  var terms = orderTerms(command);
  var current = terms.error ? null : position(account, terms.intent.symbol);
  return {
    snapshotId: snapshotId(account, quote, observedAt),
    observedAt: observedAt,
    accountId: account && account.accountId || null,
    symbol: terms.intent && terms.intent.symbol || null,
    positionQuantity: current && finite(Number(current.quantity)) ? Number(current.quantity) : null,
    positionMarketValue: current && finite(Number(current.marketValue)) ? Number(current.marketValue) : null,
    benchmarkSymbol: quote && quote.symbol || null,
    benchmarkValue: quoteValue(quote)
  };
}

function buildEvent(command, account, quote, history, horizon, now) {
  var terms = orderTerms(command);
  if (terms.error) return abstain(command, terms.error, { horizonDays: horizon });
  var intent = terms.intent;
  if (!command || !command.commandId) return abstain(command, 'command-id-missing', { horizonDays: horizon });
  if (String(command.status || '').indexOf('RECONCILED_') !== 0 || !command.reafference) {
    return abstain(command, 'command-not-reconciled', { horizonDays: horizon });
  }
  if (!intent.actionId) return abstain(command, 'action-id-missing', { horizonDays: horizon });
  if (!intent.benchmarkSymbol) return abstain(command, 'benchmark-symbol-missing', { horizonDays: horizon });
  if (!finite(Number(intent.benchmarkBaselineValue)) || Number(intent.benchmarkBaselineValue) <= 0) {
    return abstain(command, 'benchmark-baseline-unmeasured', { horizonDays: horizon });
  }
  if (typeof intent.riskLimitPct !== 'number' || !finite(intent.riskLimitPct) || intent.riskLimitPct < 0) {
    return abstain(command, 'risk-limit-missing', { horizonDays: horizon });
  }
  if (!Array.isArray(history) || history.length < 2) {
    return abstain(command, 'drawdown-history-insufficient', { horizonDays: horizon });
  }
  var started = fillTime(command, terms);
  var measurement = horizonMeasurement(history, started + horizon * DAY_MS);
  if (!measurement) return abstain(command, 'horizon-observation-missing', { horizonDays: horizon });
  if (!measurement.accountId) return abstain(command, 'account-identity-missing', { horizonDays: horizon });
  var before = position(command.accountBefore, intent.symbol);
  var beforeQty = before && finite(Number(before.quantity)) ? Number(before.quantity) : 0;
  var currentQty = Number(measurement.positionQuantity);
  var currentValue = Number(measurement.positionMarketValue);
  if (beforeQty !== 0 || currentQty !== terms.executed || currentValue === null) {
    return abstain(command, 'position-attribution-unavailable', {
      horizonDays: horizon,
      beforeQuantity: beforeQty,
      currentQuantity: currentQty,
      executedQuantity: terms.executed
    });
  }
  var benchmarkObserved = Number(measurement.benchmarkValue);
  if (!finite(benchmarkObserved) || benchmarkObserved <= 0) return abstain(command, 'benchmark-observation-unmeasured', { horizonDays: horizon });
  var fees = Number(command.dispatchCashGuard && command.dispatchCashGuard.commission) +
    Number(command.dispatchCashGuard && command.dispatchCashGuard.fees);
  if (!Number.isFinite(fees) || fees < 0) return abstain(command, 'fees-unmeasured', { horizonDays: horizon });
  var invested = terms.fill * terms.executed;
  var netPnl = currentValue - invested - fees;
  var returnPct = (netPnl / invested) * 100;
  var measurementAt = parseTime(measurement.observedAt);
  var values = (history || []).filter(function (row) {
    var at = parseTime(row && row.observedAt);
    return at !== null && at <= measurementAt;
  }).map(function (row) { return Number(row.positionMarketValue); }).filter(function (v) { return finite(v) && v > 0; });
  values.push(currentValue);
  var drawdown = maxDrawdown([invested].concat(values));
  var riskBreach = drawdown > Number(intent.riskLimitPct);
  var observedAt = new Date(measurementAt).toISOString();
  var source = {
    kind: 'tradier-sandbox-account-snapshot',
    value: 'account:' + String(measurement.accountId) + ':' + String(measurement.snapshotId),
    provider: 'tradier',
    accountId: String(measurement.accountId),
    snapshotId: String(measurement.snapshotId),
    retrievedAt: observedAt
  };
  var benchmark = {
    kind: 'tradier-sandbox-benchmark-quote',
    value: 'symbol:' + String(intent.benchmarkSymbol).toUpperCase(),
    provider: 'tradier',
    symbol: String(intent.benchmarkSymbol).toUpperCase(),
    retrievedAt: observedAt
  };
  var input = {
    outputId: 'tradier-command:' + command.commandId,
    actionId: String(intent.actionId),
    observationId: 'tradier-pnl:' + command.commandId + ':' + horizon,
    observedAt: observedAt,
    ownerDomain: 'finance',
    sourceIdentity: source,
    benchmarkIdentity: benchmark,
    benchmarkBaselineValue: Number(intent.benchmarkBaselineValue),
    benchmarkObservedValue: benchmarkObserved,
    outcomeData: {
      horizonDays: horizon,
      investedAmount: invested,
      netPnl: netPnl,
      returnPct: returnPct,
      benchmarkReturnPct: ((benchmarkObserved - Number(intent.benchmarkBaselineValue)) / Number(intent.benchmarkBaselineValue)) * 100,
      maxDrawdownPct: drawdown,
      riskBreach: riskBreach,
      executionMode: 'paper',
      brokerOrderId: String(command.receipt.orderId),
      drawdownMethod: 'sampled-position-values',
      fees: fees
    }
  };
  return { status: 'ELIGIBLE', horizonDays: horizon, event: contract.buildInvestmentPnl(input) };
}

function inspectCommand(command, account, quote, history, now) {
  now = now === undefined ? Date.now() : Number(now);
  var terms = orderTerms(command);
  if (terms.error) return abstain(command, terms.error);
  var started = fillTime(command, terms);
  if (started === null) return abstain(command, 'fill-time-unmeasured');
  var due = HORIZONS.filter(function (h) { return now >= started + h * DAY_MS; });
  if (!due.length) return waiting(command, HORIZONS.filter(function (h) { return now < started + h * DAY_MS; }));
  var currentSnapshot = observationSnapshot(command, account, quote, new Date(now).toISOString());
  var timeline = (Array.isArray(history) ? history.slice() : []);
  if (!timeline.some(function (row) { return row && row.snapshotId === currentSnapshot.snapshotId; })) timeline.push(currentSnapshot);
  var events = [];
  var abstentions = [];
  due.forEach(function (h) {
    var result = buildEvent(command, account, quote, timeline, h, now);
    if (result.status === 'ELIGIBLE') events.push(result.event);
    else abstentions.push(result);
  });
  if (!events.length) return Object.assign(abstain(command, 'no-qualifying-horizon', { dueHorizons: due }), { abstentions: abstentions });
  return { status: 'ELIGIBLE', commandId: command.commandId, dueHorizons: due, events: events, abstentions: abstentions };
}

module.exports = {
  HORIZONS: HORIZONS.slice(),
  DAY_MS: DAY_MS,
  HORIZON_LAG_MS: HORIZON_LAG_MS,
  snapshotId: snapshotId,
  observationSnapshot: observationSnapshot,
  inspectCommand: inspectCommand,
  maxDrawdown: maxDrawdown
};
