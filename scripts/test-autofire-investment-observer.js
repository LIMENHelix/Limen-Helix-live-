'use strict';

var assert = require('assert');
var O = require('../lib/autofire-investment-observer');

var base = Date.parse('2026-01-01T00:00:00Z');
function command(overrides) {
  return Object.assign({
    commandId: 'tcmd_test-1',
    status: 'RECONCILED_TERMINAL',
    emittedAt: new Date(base).toISOString(),
    receipt: { orderId: 'order-1', receivedAt: new Date(base).toISOString() },
    intent: {
      symbol: 'SPY', side: 'buy', actionId: 'act-test-1',
      benchmarkSymbol: 'QQQ', benchmarkBaselineValue: 400, riskLimitPct: 20
    },
    accountBefore: { accountId: 'VA123', positions: [] },
    order: { id: 'order-1', status: 'filled', executedQuantity: 2, averageFillPrice: 100, transactionAt: new Date(base).toISOString() },
    reafference: { matchedSelfEffect: { executedQuantity: 2, averageFillPrice: 100 } },
    dispatchCashGuard: { commission: 0, fees: 1 },
    reconciliation: { actualFees: 1, interveningTrades: 0 }
  }, overrides || {});
}
function account(value, qty) {
  return { accountId: 'VA123', positions: [{ symbol: 'SPY', quantity: qty === undefined ? 2 : qty, marketValue: value }] };
}
function quote(value) { return { provider: 'tradier', symbol: 'QQQ', last: value, observedAt: new Date(base + 30 * O.DAY_MS).toISOString() }; }

var due = base + 30 * O.DAY_MS + 1000;
var result = O.inspectCommand(command(), account(220), quote(440), [
  { positionMarketValue: 200, observedAt: new Date(base + 10 * O.DAY_MS).toISOString() },
  { positionMarketValue: 190, observedAt: new Date(base + 20 * O.DAY_MS).toISOString() }
], due);
assert.strictEqual(result.status, 'ELIGIBLE');
assert.strictEqual(result.events.length, 1);
assert.strictEqual(result.events[0].eventType, 'OUTCOME_INVESTMENT_PNL');
assert.strictEqual(result.events[0].outcomeData.horizonDays, 30);
assert.strictEqual(result.events[0].outcomeData.investedAmount, 200);
assert.strictEqual(result.events[0].outcomeData.netPnl, 19);
assert.strictEqual(result.events[0].outcomeData.returnPct, 9.5);
assert.strictEqual(result.events[0].outcomeData.benchmarkReturnPct, 10);
assert.strictEqual(result.events[0].outcomeData.maxDrawdownPct, 5);
assert.strictEqual(result.events[0].outcomeData.riskBreach, false);
assert.strictEqual(result.events[0].outcomeData.executionMode, 'paper');
assert.ok(result.events[0].sourceIdentity.snapshotId);

var fastCommand = command({
  commandId: 'tcmd_fast-1',
  intent: Object.assign({}, command().intent, { actionId: 'act-fast-1', horizonDays: [1, 3, 7, 14, 30, 60, 90] })
});
var fast = O.inspectCommand(fastCommand, account(202), quote(404), [
  { positionMarketValue: 200, observedAt: new Date(base + O.DAY_MS / 2).toISOString() }
], base + O.DAY_MS + 1000);
assert.strictEqual(fast.status, 'ELIGIBLE');
assert.strictEqual(fast.events[0].outcomeData.horizonDays, 1);
assert.deepStrictEqual(O.configuredHorizons(fastCommand), [1, 3, 7, 14, 30, 60, 90]);

var shortCommand = command({
  commandId: 'tcmd_short-1',
  intent: Object.assign({}, command().intent, { side: 'sell_short', actionId: 'act-short-1' })
});
var shortResult = O.inspectCommand(shortCommand, account(-180, -2), quote(440), [
  { positionMarketValue: -200, observedAt: new Date(base + 10 * O.DAY_MS).toISOString() },
  { positionMarketValue: -190, observedAt: new Date(base + 20 * O.DAY_MS).toISOString() }
], due);
assert.strictEqual(shortResult.status, 'ELIGIBLE');
assert.strictEqual(shortResult.events[0].outcomeData.netPnl, 19);
assert.strictEqual(shortResult.events[0].outcomeData.returnPct, 9.5);
assert.strictEqual(shortResult.events[0].outcomeData.benchmarkReturnPct, -10);
assert.strictEqual(shortResult.events[0].outcomeData.sourceTerms.side, 'sell_short');

assert.strictEqual(O.inspectCommand(command(), account(220), quote(440), [], base + 5 * O.DAY_MS).status, 'WAITING');
assert.ok(O.inspectCommand(command({ intent: Object.assign({}, command().intent, { benchmarkSymbol: null }) }), account(220), null, [], due).abstentions.some(function (x) { return x.reason === 'benchmark-symbol-missing'; }));
assert.ok(O.inspectCommand(command({ intent: Object.assign({}, command().intent, { riskLimitPct: null }) }), account(220), quote(440), [], due).abstentions.some(function (x) { return x.reason === 'risk-limit-missing'; }));
var priorHistory = [{ positionMarketValue: 200 }, { positionMarketValue: 210 }];
assert.strictEqual(O.inspectCommand(command(), account(220, 3), quote(440), priorHistory, due).reason, 'no-qualifying-horizon');
assert.ok(O.inspectCommand(command(), account(220, 3), quote(440), priorHistory, due).abstentions.some(function (x) { return x.reason === 'position-attribution-unavailable'; }));
var lateHistory = [
  { snapshotId: 'at-30d', observedAt: new Date(base + 30 * O.DAY_MS + 10 * 60 * 1000).toISOString(), positionQuantity: 2, positionMarketValue: 215, accountId: 'VA123', benchmarkValue: 430 },
  { snapshotId: 'at-70d', observedAt: new Date(base + 70 * O.DAY_MS).toISOString(), positionQuantity: 2, positionMarketValue: 230, accountId: 'VA123', benchmarkValue: 450 }
];
var late = O.inspectCommand(command(), account(230), quote(450), lateHistory, base + 70 * O.DAY_MS);
assert.ok(late.events.some(function (event) { return event.outcomeData.horizonDays === 30 && event.outcomeData.netPnl === 14; }));
assert.ok(late.abstentions.some(function (x) { return x.horizonDays === 60 && x.reason === 'horizon-observation-missing'; }));
assert.strictEqual(O.maxDrawdown([100, 90, 95, 80]), 20);
var markedFromQuote = O.inspectCommand(command(), account(null), quote(440), [
  { positionMarketValue: 200, observedAt: new Date(base + 10 * O.DAY_MS).toISOString() },
  { positionMarketValue: 190, observedAt: new Date(base + 20 * O.DAY_MS).toISOString() }
], due, { symbol: 'SPY', last: 110 });
assert.strictEqual(markedFromQuote.status, 'ELIGIBLE');
assert.strictEqual(markedFromQuote.events[0].outcomeData.sourceTerms.positionMarketValue, 220);
var wrongAccount = account(220);
wrongAccount.accountId = 'VA999';
var wrongAccountResult = O.inspectCommand(command(), wrongAccount, quote(440), [
  { positionMarketValue: 200, observedAt: new Date(base + 10 * O.DAY_MS).toISOString() },
  { positionMarketValue: 190, observedAt: new Date(base + 20 * O.DAY_MS).toISOString() }
], due);
assert.ok(wrongAccountResult.abstentions.some(function (x) { return x.reason === 'account-identity-mismatch'; }));
var noFees = O.inspectCommand(command({ reconciliation: { interveningTrades: 0 } }), account(220), quote(440), [
  { positionMarketValue: 200, observedAt: new Date(base + 10 * O.DAY_MS).toISOString() },
  { positionMarketValue: 190, observedAt: new Date(base + 20 * O.DAY_MS).toISOString() }
], due);
assert.ok(noFees.abstentions.some(function (x) { return x.reason === 'fees-unmeasured'; }));
var noTradeHistory = O.inspectCommand(command({ reconciliation: { actualFees: 1 } }), account(220), quote(440), [
  { positionMarketValue: 200, observedAt: new Date(base + 10 * O.DAY_MS).toISOString() },
  { positionMarketValue: 190, observedAt: new Date(base + 20 * O.DAY_MS).toISOString() }
], due);
assert.ok(noTradeHistory.abstentions.some(function (x) { return x.reason === 'intervening-trade-history-unavailable'; }));
var partial = O.inspectCommand(command({ order: Object.assign({}, command().order, { status: 'partially_filled' }) }), account(220), quote(440), [], due);
assert.strictEqual(partial.reason, 'order-not-terminal-filled');
console.log('autofire investment observer: 24/24 passed');
