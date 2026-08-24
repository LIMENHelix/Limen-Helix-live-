'use strict';

var assert = require('assert');
var path = require('path');
var ROOT = path.join(__dirname, '..');
var HANDLER = path.join(ROOT, 'handlers', 'limen-investment-outcome-observer.js');
var STORE = path.join(ROOT, 'lib', 'autofire-efference-store.js');
var BROKER = path.join(ROOT, 'lib', 'tradier-sandbox.js');
var B14 = path.join(ROOT, 'lib', 'tradier-b14.js');
var OUTCOME = path.join(ROOT, 'handlers', 'limen-outcome.js');
var passed = 0;
function ok(name, value) { assert.ok(value, name); passed++; }
function res() { return { statusCode: 200, body: '', setHeader: function () {}, end: function (body) { this.body = body || ''; } }; }
function mock(file, exports, replacements) {
  var resolved = require.resolve(file);
  replacements.push([resolved, require.cache[resolved]]);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: exports };
}
function command() {
  var t = Date.now() - 31 * 24 * 60 * 60 * 1000;
  return {
    commandId: 'tcmd-handler', status: 'RECONCILED_TERMINAL', emittedAt: new Date(t).toISOString(),
    receipt: { orderId: 'order-handler', receivedAt: new Date(t).toISOString() },
    intent: { symbol: 'SPY', side: 'buy', actionId: 'act-handler', benchmarkSymbol: 'QQQ', benchmarkBaselineValue: 400, riskLimitPct: 20 },
    accountBefore: { accountId: 'VA123', positions: [] },
    order: { id: 'order-handler', status: 'filled', executedQuantity: 1, averageFillPrice: 100, transactionAt: new Date(t).toISOString() },
    reafference: { matchedSelfEffect: { executedQuantity: 1, averageFillPrice: 100 } },
    dispatchCashGuard: { commission: 0, fees: 0 }
  };
}
async function invoke(handler, headers) {
  var response = res();
  await handler({ method: 'GET', headers: headers || {}, url: '/api/limen-investment-outcome-observer' }, response);
  return { code: response.statusCode, json: JSON.parse(response.body || '{}') };
}

(async function () {
  var oldSecret = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'investment-observer-secret';
  var replacements = [];
  var writes = [];
  var recorded = [];
  mock(STORE, {
    assertDurable: function () {},
    lrange: async function (key) {
      if (key === 'tradier_b14_log') return [{ commandId: 'tcmd-handler' }];
      return [{ snapshotId: 'prior', positionMarketValue: 100, observedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }];
    },
    lpush: async function (key, value) { writes.push(['lpush', key, value]); return 1; },
    ltrim: async function (key) { writes.push(['ltrim', key]); return true; }
  }, replacements);
  mock(B14, { read: async function () { return command(); } }, replacements);
  mock(BROKER, {
    accountSnapshot: async function () { return { accountId: 'VA123', positions: [{ symbol: 'SPY', quantity: 1, marketValue: 120 }] }; },
    quote: async function (symbol) { return { provider: 'tradier', symbol: symbol, last: 440 }; }
  }, replacements);
  mock(OUTCOME, { recordAutonomousOutcome: async function (event) { recorded.push(event); return { ok: true, event: event }; } }, replacements);
  delete require.cache[require.resolve(HANDLER)];
  var handler = require(HANDLER);
  try {
    var unauth = await invoke(handler, {});
    ok('missing cron auth is refused', unauth.code === 401 && unauth.json.error === 'cron-unauthorized');
    var good = await invoke(handler, { authorization: 'Bearer investment-observer-secret' });
    ok('authorized observer succeeds', good.code === 200 && good.json.ok === true);
    ok('one horizon is eligible', good.json.eligible === 1 && good.json.recorded === 1);
    ok('observer writes durable history', writes.some(function (x) { return x[0] === 'lpush' && String(x[1]).indexOf('tradier_investment_observation:') === 0; }));
    ok('paper outcome reaches durable outcome path', recorded.length === 1 && recorded[0].eventType === 'OUTCOME_INVESTMENT_PNL' && recorded[0].outcomeData.executionMode === 'paper');
    ok('no live order is made', good.json.liveOrders === 0);
  } finally {
    if (oldSecret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = oldSecret;
    delete require.cache[require.resolve(HANDLER)];
    for (var i = 0; i < replacements.length; i++) {
      if (replacements[i][1]) require.cache[replacements[i][0]] = replacements[i][1];
      else delete require.cache[replacements[i][0]];
    }
  }
  console.log('autofire investment observer handler: ' + passed + '/' + passed + ' passed');
})().catch(function (err) { console.error(err.stack || err); process.exit(1); });
