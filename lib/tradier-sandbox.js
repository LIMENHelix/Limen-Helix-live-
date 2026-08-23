'use strict';

/**
 * Read-only Tradier paper-account adapter.
 *
 * This module cannot select a production host and cannot submit an order. The
 * write boundary belongs in a later, separately reviewed B14 actuator.
 */

var BASE_URL = 'https://sandbox.tradier.com/v1';
var REQUEST_TIMEOUT_MS = 15000;

function configured() {
  return !!(process.env.TRADIER_SANDBOX_TOKEN && process.env.TRADIER_SANDBOX_ACCOUNT_ID);
}

function config() {
  var token = String(process.env.TRADIER_SANDBOX_TOKEN || '').trim();
  var accountId = String(process.env.TRADIER_SANDBOX_ACCOUNT_ID || '').trim();
  if (!token || !accountId) {
    var err = new Error('Tradier sandbox credentials are not configured');
    err.code = 'TRADIER_SANDBOX_NOT_CONFIGURED';
    throw err;
  }
  if (!/^VA[0-9]+$/i.test(accountId)) {
    var bad = new Error('Tradier sandbox account id must start with VA and contain digits only');
    bad.code = 'TRADIER_SANDBOX_ACCOUNT_INVALID';
    throw bad;
  }
  return { token: token, accountId: accountId.toUpperCase() };
}

async function get(pathname) {
  var cfg = config();
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS);
  var response;
  try {
    response = await fetch(BASE_URL + pathname, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + cfg.token,
        Accept: 'application/json'
      },
      signal: controller.signal
    });
  } catch (err) {
    var transport = new Error(err && err.name === 'AbortError'
      ? 'Tradier sandbox request timed out'
      : 'Tradier sandbox request failed');
    transport.code = err && err.name === 'AbortError'
      ? 'TRADIER_SANDBOX_TIMEOUT'
      : ((err && err.cause && err.cause.code) || 'TRADIER_SANDBOX_FETCH_FAILED');
    throw transport;
  } finally {
    clearTimeout(timer);
  }

  var text = await response.text();
  var body = null;
  try { body = text ? JSON.parse(text) : null; } catch (_) {}
  if (!response.ok) {
    var upstream = new Error('Tradier sandbox returned HTTP ' + response.status);
    upstream.code = 'TRADIER_SANDBOX_HTTP_' + response.status;
    upstream.status = response.status;
    upstream.upstream = body && body.errors ? body.errors : null;
    throw upstream;
  }
  if (!body || typeof body !== 'object') {
    var malformed = new Error('Tradier sandbox returned a non-JSON response');
    malformed.code = 'TRADIER_SANDBOX_MALFORMED_RESPONSE';
    throw malformed;
  }
  return body;
}

function asArray(value) {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function profileAccountIds(profileBody) {
  var profile = profileBody && profileBody.profile;
  var accounts = profile && profile.account;
  return asArray(accounts).map(function (account) {
    if (typeof account === 'string') return account;
    return account && (account.account_number || account.account_id || account.number);
  }).filter(Boolean).map(function (id) { return String(id).toUpperCase(); });
}

function positionsFrom(body) {
  var value = body && body.positions && body.positions.position;
  return asArray(value).filter(Boolean).map(function (position) {
    return {
      symbol: position.symbol || null,
      quantity: position.quantity === undefined ? null : Number(position.quantity),
      costBasis: position.cost_basis === undefined ? null : Number(position.cost_basis),
      marketValue: position.market_value === undefined ? null : Number(position.market_value),
      acquiredAt: position.date_acquired || null
    };
  });
}

function ordersFrom(body) {
  var value = body && body.orders && body.orders.order;
  return asArray(value).filter(Boolean).map(function (order) {
    return {
      id: order.id === undefined ? null : String(order.id),
      symbol: order.symbol || null,
      side: order.side || null,
      quantity: order.quantity === undefined ? null : Number(order.quantity),
      type: order.type || null,
      status: order.status || null,
      createdAt: order.create_date || order.transaction_date || null
    };
  });
}

async function probe() {
  var cfg = config();
  var profile = await get('/user/profile');
  var accountIds = profileAccountIds(profile);
  if (accountIds.indexOf(cfg.accountId) === -1) {
    var mismatch = new Error('Configured Tradier sandbox account is not present in the token profile');
    mismatch.code = 'TRADIER_SANDBOX_ACCOUNT_MISMATCH';
    throw mismatch;
  }

  var encoded = encodeURIComponent(cfg.accountId);
  var results = await Promise.all([
    get('/accounts/' + encoded + '/balances'),
    get('/accounts/' + encoded + '/positions'),
    get('/accounts/' + encoded + '/orders')
  ]);
  var balance = results[0] && results[0].balances ? results[0].balances : {};
  var positions = positionsFrom(results[1]);
  var orders = ordersFrom(results[2]);

  return {
    ok: true,
    broker: 'tradier',
    environment: 'sandbox',
    readOnly: true,
    accountId: cfg.accountId,
    profileMatched: true,
    accountType: balance.account_type || null,
    totalEquity: balance.total_equity === undefined ? null : Number(balance.total_equity),
    totalCash: balance.total_cash === undefined ? null : Number(balance.total_cash),
    stockBuyingPower: balance.stock_buying_power === undefined ? null : Number(balance.stock_buying_power),
    positions: positions,
    positionCount: positions.length,
    orders: orders,
    orderCount: orders.length,
    checkedAt: new Date().toISOString()
  };
}

module.exports = {
  BASE_URL: BASE_URL,
  REQUEST_TIMEOUT_MS: REQUEST_TIMEOUT_MS,
  configured: configured,
  profileAccountIds: profileAccountIds,
  positionsFrom: positionsFrom,
  ordersFrom: ordersFrom,
  probe: probe
};
