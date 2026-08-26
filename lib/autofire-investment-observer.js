'use strict';

/**
 * Read-only Tradier sandbox outcome observer.
 *
 * This module never places an order and never infers an investment from a
 * domain signal. It turns a persisted, reconciled B14 paper command into a
 * multiscale outcome only when the command carries all source terms needed
 * to attribute the position and compare it with an explicitly named
 * benchmark. Missing terms are abstentions, not zeroes.
 */

var crypto = require('node:crypto');
var contract = require('./autofire-outcome-contract');

var HORIZONS = [1, 3, 7, 14, 30, 60, 90];
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
function configuredHorizons(command) {
  var values = command && command.intent && command.intent.horizonDays;
  if (!Array.isArray(values) || !values.length) return [30, 60, 90];
  var valid = values.every(function (h, i) {
    return HORIZONS.indexOf(h) >= 0 && (i === 0 || values[i - 1] < h);
  });
  return valid ? values.slice() : [30, 60, 90];
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
  if (status !== 'filled') return { error: 'order-not-terminal-filled' };
  if (intent.side !== 'buy' && intent.side !== 'sell_short') return { error: 'opening-side-attribution-not-supported' };
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
    if (!finite(value)) return;
    if (peak === null || value > peak) peak = value;
    if (peak > 0) max = Math.max(max, ((peak - value) / peak) * 100);
  });
  return max;
}
function horizonMeasurement(history, dueAt, side) {
  var candidates = (Array.isArray(history) ? history : []).filter(function (row) {
    var at = parseTime(row && row.observedAt);
    return at !== null && at >= dueAt && at <= dueAt + HORIZON_LAG_MS &&
      finite(Number(row.positionMarketValue)) &&
      finite(Number(row.positionQuantity)) &&
      (side === 'sell_short' ? Number(row.positionQuantity) < 0 : Number(row.positionQuantity) > 0) &&
      finite(Number(row.benchmarkValue)) && Number(row.benchmarkValue) > 0;
  }).sort(function (a, b) { return parseTime(a.observedAt) - parseTime(b.observedAt); });
  return candidates.length ? candidates[0] : null;
}

function observationSnapshot(command, account, quote, observedAt, positionQuote) {
  var terms = orderTerms(command);
  var current = terms.error ? null : position(account, terms.intent.symbol);
  var quantity = current && current.quantity !== null && current.quantity !== undefined && finite(Number(current.quantity))
    ? Number(current.quantity) : null;
  var marked = current && current.marketValue !== null && current.marketValue !== undefined && finite(Number(current.marketValue))
    ? Number(current.marketValue) : null;
  if (marked === null && quantity !== null && positionQuote && terms.intent &&
      String(positionQuote.symbol || '').toUpperCase() === String(terms.intent.symbol || '').toUpperCase()) {
    var price = quoteValue(positionQuote);
    if (price !== null) marked = quantity * price;
  }
  return {
    snapshotId: snapshotId(account, quote, observedAt),
    observedAt: observedAt,
    accountId: account && account.accountId || null,
    symbol: terms.intent && terms.intent.symbol || null,
    positionQuantity: quantity,
    positionMarketValue: marked,
    benchmarkSymbol: quote && quote.symbol || null,
    benchmarkValue: quoteValue(quote)
  };
}

function buildEvent(command, account, quote, history, horizon, now, positionQuote) {
  var terms = orderTerms(command);
  if (terms.error) return abstain(command, terms.error, { horizonDays: horizon });
  var intent = terms.intent;
  if (!command || !command.commandId) return abstain(command, 'command-id-missing', { horizonDays: horizon });
  if (String(command.status || '') !== 'RECONCILED_TERMINAL' || !command.reafference) {
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
  var measurement = horizonMeasurement(history, started + horizon * DAY_MS, intent.side);
  if (!measurement) return abstain(command, 'horizon-observation-missing', { horizonDays: horizon });
  if (!measurement.accountId) return abstain(command, 'account-identity-missing', { horizonDays: horizon });
  if (!command.accountBefore || !command.accountBefore.accountId ||
      String(measurement.accountId) !== String(command.accountBefore.accountId)) {
    return abstain(command, 'account-identity-mismatch', { horizonDays: horizon });
  }
  var before = position(command.accountBefore, intent.symbol);
  var beforeQty = before && finite(Number(before.quantity)) ? Number(before.quantity) : 0;
  var currentQty = Number(measurement.positionQuantity);
  var currentValue = Number(measurement.positionMarketValue);
  var expectedQuantity = intent.side === 'sell_short' ? -terms.executed : terms.executed;
  if (beforeQty !== 0 || currentQty !== expectedQuantity || !finite(currentValue)) {
    return abstain(command, 'position-attribution-unavailable', {
      horizonDays: horizon,
      beforeQuantity: beforeQty,
      currentQuantity: currentQty,
      executedQuantity: terms.executed
    });
  }
  var benchmarkObserved = Number(measurement.benchmarkValue);
  if (!finite(benchmarkObserved) || benchmarkObserved <= 0) return abstain(command, 'benchmark-observation-unmeasured', { horizonDays: horizon });
  if (!command.reconciliation || command.reconciliation.interveningTrades !== 0) {
    return abstain(command, 'intervening-trade-history-unavailable', { horizonDays: horizon });
  }
  var actualFees = command.reconciliation && command.reconciliation.actualFees;
  var fees = actualFees === null || actualFees === undefined ? NaN : Number(actualFees);
  if (!Number.isFinite(fees) || fees < 0) return abstain(command, 'fees-unmeasured', { horizonDays: horizon });
  var invested = terms.fill * terms.executed;
  var netPnl = intent.side === 'sell_short'
    ? invested - Math.abs(currentValue) - fees
    : currentValue - invested - fees;
  var returnPct = (netPnl / invested) * 100;
  var measurementAt = parseTime(measurement.observedAt);
  var values = (history || []).filter(function (row) {
    var at = parseTime(row && row.observedAt);
    return at !== null && at <= measurementAt;
  }).sort(function (a, b) { return parseTime(a.observedAt) - parseTime(b.observedAt); })
    .map(function (row) {
      var marked = Number(row.positionMarketValue);
      return intent.side === 'sell_short' ? invested + (invested - Math.abs(marked)) : marked;
    }).filter(function (v) { return finite(v); });
  var currentStrategyValue = intent.side === 'sell_short'
    ? invested + (invested - Math.abs(currentValue)) : currentValue;
  values.push(currentStrategyValue);
  var drawdown = maxDrawdown([invested].concat(values));
  var riskBreach = drawdown > Number(intent.riskLimitPct);
  var observedAt = new Date(measurementAt).toISOString();
  var ownerDomain = String(intent.ownerDomain || 'finance');
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
  var rawBenchmarkReturn = ((benchmarkObserved - Number(intent.benchmarkBaselineValue)) / Number(intent.benchmarkBaselineValue)) * 100;
  var input = {
    outputId: 'tradier-command:' + command.commandId,
    commandId: command.commandId,
    actionId: String(intent.actionId),
    observationId: 'tradier-pnl:' + command.commandId + ':' + horizon,
    observedAt: observedAt,
    ownerDomain: ownerDomain,
    sourceIdentity: source,
    benchmarkIdentity: benchmark,
    benchmarkBaselineValue: Number(intent.benchmarkBaselineValue),
    benchmarkObservedValue: benchmarkObserved,
    sourceTerms: {
      executedQuantity: terms.executed,
      averageFillPrice: terms.fill,
      positionMarketValue: Math.abs(currentValue),
      side: intent.side,
      fees: fees
    },
    outcomeData: {
      horizonDays: horizon,
      investedAmount: invested,
      netPnl: netPnl,
      returnPct: returnPct,
      benchmarkReturnPct: intent.side === 'sell_short' ? -rawBenchmarkReturn : rawBenchmarkReturn,
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

function inspectCommand(command, account, quote, history, now, positionQuote) {
  now = now === undefined ? Date.now() : Number(now);
  var terms = orderTerms(command);
  if (terms.error) return abstain(command, terms.error);
  var started = fillTime(command, terms);
  if (started === null) return abstain(command, 'fill-time-unmeasured');
  var horizons = configuredHorizons(command);
  var due = horizons.filter(function (h) { return now >= started + h * DAY_MS; });
  if (!due.length) return waiting(command, horizons.filter(function (h) { return now < started + h * DAY_MS; }));
  var currentSnapshot = observationSnapshot(command, account, quote, new Date(now).toISOString(), positionQuote);
  var timeline = (Array.isArray(history) ? history.slice() : []);
  if (!timeline.some(function (row) { return row && row.snapshotId === currentSnapshot.snapshotId; })) timeline.push(currentSnapshot);
  var events = [];
  var abstentions = [];
  due.forEach(function (h) {
    var result = buildEvent(command, account, quote, timeline, h, now, positionQuote);
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
  configuredHorizons: configuredHorizons,
  snapshotId: snapshotId,
  observationSnapshot: observationSnapshot,
  inspectCommand: inspectCommand,
  maxDrawdown: maxDrawdown
};
