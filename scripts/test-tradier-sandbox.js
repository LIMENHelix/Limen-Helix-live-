'use strict';

var path = require('node:path');
var ROOT = path.join(__dirname, '..');
var MODULE_PATH = path.join(ROOT, 'lib', 'tradier-sandbox.js');
var HANDLER_PATH = path.join(ROOT, 'handlers', 'tradier-sandbox.js');

var checks = 0;
function assert(name, condition, detail) {
  checks++;
  if (!condition) throw new Error('FAIL ' + name + (detail ? ': ' + detail : ''));
  console.log('PASS ' + name);
}

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status: status,
    async text() { return JSON.stringify(body); }
  };
}

function req(method, url, headers) {
  return { method: method, url: url, headers: headers || {}, query: {} };
}

async function invoke(handler, request) {
  var raw = '';
  var headers = {};
  var res = {
    statusCode: 200,
    setHeader: function (key, value) { headers[String(key).toLowerCase()] = value; },
    status: function (code) { this.statusCode = code; return this; },
    json: function (body) { raw = JSON.stringify(body); return this; },
    end: function (body) { if (body) raw += body; return this; }
  };
  await handler(request, res);
  return { status: res.statusCode, headers: headers, raw: raw, body: raw ? JSON.parse(raw) : null };
}

async function main() {
  var oldFetch = global.fetch;
  var oldToken = process.env.TRADIER_SANDBOX_TOKEN;
  var oldAccount = process.env.TRADIER_SANDBOX_ACCOUNT_ID;
  var oldMaster = process.env.ADMIN_MASTER;
  try {
    delete process.env.TRADIER_SANDBOX_TOKEN;
    delete process.env.TRADIER_SANDBOX_ACCOUNT_ID;
    delete require.cache[require.resolve(MODULE_PATH)];
    var tradier = require(MODULE_PATH);

    assert('the adapter is permanently pinned to the Tradier sandbox host',
      tradier.BASE_URL === 'https://sandbox.tradier.com/v1');
    assert('configuration reports absent without the two sandbox values', tradier.configured() === false);
    var fetches = 0;
    global.fetch = async function () { fetches++; return response(500, {}); };
    var missing = null;
    try { await tradier.probe(); } catch (err) { missing = err; }
    assert('missing credentials fail before any request',
      missing && missing.code === 'TRADIER_SANDBOX_NOT_CONFIGURED' && fetches === 0);

    process.env.TRADIER_SANDBOX_TOKEN = 'sandbox-test-token';
    process.env.TRADIER_SANDBOX_ACCOUNT_ID = 'VA60523798';
    var calls = [];
    global.fetch = async function (url, options) {
      calls.push({ url: String(url), options: options });
      if (String(url).endsWith('/user/profile')) {
        return response(200, { profile: { account: { account_number: 'VA60523798', status: 'active' } } });
      }
      if (String(url).endsWith('/balances')) {
        return response(200, { balances: { account_type: 'cash', total_equity: 100000, total_cash: 99500, stock_buying_power: 99500 } });
      }
      if (String(url).endsWith('/positions')) {
        return response(200, { positions: { position: { symbol: 'SPY', quantity: 1, cost_basis: 500, market_value: 502 } } });
      }
      if (String(url).endsWith('/orders')) {
        return response(200, { orders: { order: [{ id: 7, symbol: 'SPY', side: 'buy', quantity: 1, type: 'market', status: 'filled' }] } });
      }
      throw new Error('unexpected URL ' + url);
    };
    var result = await tradier.probe();
    assert('profile, balances, positions, and orders are all read', calls.length === 4);
    assert('every request is GET-only', calls.every(function (call) { return call.options.method === 'GET' && !call.options.body; }));
    assert('every request stays on sandbox.tradier.com', calls.every(function (call) { return call.url.indexOf('https://sandbox.tradier.com/v1/') === 0; }));
    assert('the token is used as a bearer credential', calls.every(function (call) { return call.options.headers.Authorization === 'Bearer sandbox-test-token'; }));
    assert('the profile must contain the configured virtual account', result.profileMatched === true && result.accountId === 'VA60523798');
    assert('single-object positions normalize without disappearing', result.positionCount === 1 && result.positions[0].symbol === 'SPY');
    assert('array orders normalize without disappearing', result.orderCount === 1 && result.orders[0].id === '7');
    assert('the returned probe is explicitly read-only', result.environment === 'sandbox' && result.readOnly === true);
    assert('the token never enters the returned object', JSON.stringify(result).indexOf('sandbox-test-token') === -1);

    calls = [];
    global.fetch = async function (url, options) {
      calls.push({ url: String(url), options: options });
      if (String(url).endsWith('/balances')) return response(200, { balances: { account_type: 'margin', total_equity: 100000, total_cash: 1000, pending_cash: 50, uncleared_funds: 25 } });
      if (String(url).endsWith('/positions')) return response(200, { positions: { position: { symbol: 'SPY', quantity: 2 } } });
      if (String(url).indexOf('/orders?includeTags=true') !== -1) return response(200, { orders: { order: { id: 9, symbol: 'SPY', side: 'sell', quantity: 1, remaining_quantity: 1, status: 'open', tag: 'limen-b14-test' } } });
      if (String(url).endsWith('/orders/77?includeTags=true')) return response(200, { order: { id: 77, symbol: 'SPY', side: 'buy', quantity: 1, exec_quantity: 1, avg_fill_price: 499, status: 'filled', tag: 'limen-b14-order' } });
      if (String(url).endsWith('/orders/77') && options.method === 'DELETE') return response(200, { order: { id: 77, status: 'ok' } });
      if (String(url).indexOf('/markets/history?') !== -1) return response(200, { history: { day: [{ date: '2026-08-24', open: 490, high: 501, low: 489, close: 500, volume: 10 }] } });
      if (String(url).endsWith('/orders') && options.method === 'POST') {
        var form = new URLSearchParams(options.body);
        if (form.get('preview') === 'true') return response(200, { order: { status: 'ok', result: true, cost: 500, order_cost: 500 } });
        return response(200, { order: { id: 77, status: 'ok' } });
      }
      throw new Error('unexpected URL ' + url);
    };
    var snap = await tradier.accountSnapshot();
    assert('the account snapshot carries cash reservations and open orders', snap.pendingCash === 50 && snap.unclearedFunds === 25 && snap.orders[0].remainingQuantity === 1);
    var p = await tradier.previewOrder({ class: 'equity', symbol: 'SPY', side: 'buy', quantity: '1', type: 'limit', duration: 'day', price: '500.00' });
    assert('preview uses form encoding and preview=true', p.result === true && new URLSearchParams(calls[calls.length - 1].options.body).get('preview') === 'true');
    var placed = await tradier.placeOrder({ class: 'equity', symbol: 'SPY', side: 'buy', quantity: '1', type: 'limit', duration: 'day', price: '500.00', tag: 'limen-b14-order' });
    assert('placement omits the preview flag', placed.id === 77 && !new URLSearchParams(calls[calls.length - 1].options.body).has('preview'));
    var order = await tradier.getOrder('77');
    assert('order status exposes fill identity and quantity', order.id === '77' && order.executedQuantity === 1 && order.averageFillPrice === 499);
    var canceled = await tradier.cancelOrder('77');
    var cancelCall = calls[calls.length - 1];
    assert('cancel uses DELETE with no body against the sandbox order id', canceled.id === 77 && cancelCall.options.method === 'DELETE' && !cancelCall.options.body && /\/orders\/77$/.test(cancelCall.url));
    var tagged = await tradier.findOrderByTag('limen-b14-test');
    assert('a missing receipt can be recovered by command tag', tagged && tagged.id === '9' && tagged.tag === 'limen-b14-test');
    var historical = await tradier.history('SPY', { interval: 'daily', start: '2026-08-01', end: '2026-08-26' });
    assert('official historical prices normalize with source identity and bounded dates', historical.provider === 'tradier' && historical.symbol === 'SPY' && historical.rows[0].close === 500 && /symbol=SPY/.test(calls[calls.length - 1].url));
    assert('every write-capable request remains pinned to sandbox', calls.every(function (call) { return call.url.indexOf('https://sandbox.tradier.com/v1/') === 0; }));

    global.fetch = async function (url) {
      if (String(url).endsWith('/user/profile')) {
        return response(200, { profile: { account: { account_number: 'VA00000000' } } });
      }
      throw new Error('account endpoints must not run after profile mismatch');
    };
    var mismatch = null;
    try { await tradier.probe(); } catch (err) { mismatch = err; }
    assert('a token/account mismatch refuses instead of querying another account',
      mismatch && mismatch.code === 'TRADIER_SANDBOX_ACCOUNT_MISMATCH');

    process.env.ADMIN_MASTER = 'test-master';
    delete require.cache[require.resolve(HANDLER_PATH)];
    var handler = require(HANDLER_PATH);
    fetches = 0;
    global.fetch = async function () { fetches++; return response(500, {}); };
    var denied = await invoke(handler, req('GET', '/api/tradier-sandbox'));
    assert('the real handler refuses an unauthenticated read before network access', denied.status === 403 && fetches === 0);
    var post = await invoke(handler, req('POST', '/api/tradier-sandbox', { 'x-limen-pass': 'test-master' }));
    assert('the real handler exposes no write method', post.status === 405 && post.body.readOnly === true && fetches === 0);

    global.fetch = async function (url) {
      if (String(url).endsWith('/user/profile')) return response(200, { profile: { account: { account_number: 'VA60523798' } } });
      if (String(url).endsWith('/balances')) return response(200, { balances: { account_type: 'cash', total_equity: 100000, total_cash: 100000 } });
      if (String(url).endsWith('/positions')) return response(200, { positions: 'null' });
      if (String(url).endsWith('/orders')) return response(200, { orders: 'null' });
      throw new Error('unexpected URL');
    };
    var allowed = await invoke(handler, req('GET', '/api/tradier-sandbox', { 'x-limen-pass': 'test-master' }));
    assert('the authenticated real handler returns the read-only sandbox account',
      allowed.status === 200 && allowed.body.ok && allowed.body.accountId === 'VA60523798');
    assert('the handler response cannot leak the bearer token', allowed.raw.indexOf('sandbox-test-token') === -1);

    console.log('\n' + checks + '/' + checks + ' passed');
  } finally {
    global.fetch = oldFetch;
    if (oldToken === undefined) delete process.env.TRADIER_SANDBOX_TOKEN; else process.env.TRADIER_SANDBOX_TOKEN = oldToken;
    if (oldAccount === undefined) delete process.env.TRADIER_SANDBOX_ACCOUNT_ID; else process.env.TRADIER_SANDBOX_ACCOUNT_ID = oldAccount;
    if (oldMaster === undefined) delete process.env.ADMIN_MASTER; else process.env.ADMIN_MASTER = oldMaster;
    delete require.cache[require.resolve(MODULE_PATH)];
    delete require.cache[require.resolve(HANDLER_PATH)];
  }
}

main().catch(function (err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
