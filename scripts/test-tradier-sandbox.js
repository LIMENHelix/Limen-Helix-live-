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
