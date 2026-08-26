'use strict';

/**
 * Tradier paper-account transport.
 *
 * The host is permanently sandbox. Order validation, approval, durability, and
 * B14 accounting live in lib/tradier-b14.js; this module only speaks the broker
 * protocol and never selects a production host.
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

async function request(method, pathname, form) {
  var cfg = config();
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS);
  var response;
  try {
    var headers = {
      Authorization: 'Bearer ' + cfg.token,
      Accept: 'application/json'
    };
    var options = {
      method: method,
      headers: headers,
      signal: controller.signal
    };
    if (form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      options.body = new URLSearchParams(form).toString();
    }
    response = await fetch(BASE_URL + pathname, options);
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

function get(pathname) { return request('GET', pathname); }
function post(pathname, form) { return request('POST', pathname, form); }
function del(pathname) { return request('DELETE', pathname); }

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
      price: order.price === undefined ? null : Number(order.price),
      averageFillPrice: order.avg_fill_price === undefined ? null : Number(order.avg_fill_price),
      executedQuantity: order.exec_quantity === undefined ? null : Number(order.exec_quantity),
      remainingQuantity: order.remaining_quantity === undefined ? null : Number(order.remaining_quantity),
      tag: order.tag || null,
      reason: order.reason_description || null,
      createdAt: order.create_date || null,
      transactionAt: order.transaction_date || null
    };
  });
}

function accountIdPath(suffix) {
  return '/accounts/' + encodeURIComponent(config().accountId) + suffix;
}

async function accountSnapshot() {
  var cfg = config();
  var encoded = encodeURIComponent(cfg.accountId);
  var results = await Promise.all([
    get('/accounts/' + encoded + '/balances'),
    get('/accounts/' + encoded + '/positions'),
    get('/accounts/' + encoded + '/orders?includeTags=true&limit=1000')
  ]);
  var balance = results[0] && results[0].balances ? results[0].balances : {};
  return {
    accountId: cfg.accountId,
    accountType: balance.account_type || null,
    totalEquity: balance.total_equity === undefined ? null : Number(balance.total_equity),
    totalCash: balance.total_cash === undefined ? null : Number(balance.total_cash),
    pendingCash: balance.pending_cash === undefined ? null : Number(balance.pending_cash),
    unclearedFunds: balance.uncleared_funds === undefined ? null : Number(balance.uncleared_funds),
    positions: positionsFrom(results[1]),
    orders: ordersFrom(results[2]),
    observedAt: new Date().toISOString()
  };
}

async function previewOrder(order) {
  var body = await post(accountIdPath('/orders'), Object.assign({}, order, { preview: 'true' }));
  return body && body.order ? body.order : null;
}

async function placeOrder(order) {
  var body = await post(accountIdPath('/orders'), order);
  return body && body.order ? body.order : null;
}

async function getOrder(orderId) {
  var body = await get(accountIdPath('/orders/' + encodeURIComponent(String(orderId)) + '?includeTags=true'));
  var value = body && body.order ? body.order : body;
  var rows = ordersFrom({ orders: { order: value } });
  return rows[0] || null;
}

async function cancelOrder(orderId) {
  var normalized = String(orderId || '').trim();
  if (!/^[A-Za-z0-9._-]+$/.test(normalized)) {
    var invalid = new Error('Tradier sandbox order id is invalid');
    invalid.code = 'TRADIER_SANDBOX_ORDER_ID_INVALID';
    throw invalid;
  }
  var body = await del(accountIdPath('/orders/' + encodeURIComponent(normalized)));
  var value = body && body.order ? body.order : body;
  return value && typeof value === 'object' ? value : null;
}

async function quote(symbol) {
  var normalized = String(symbol || '').trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(normalized)) {
    var invalid = new Error('Tradier sandbox quote symbol is invalid');
    invalid.code = 'TRADIER_SANDBOX_QUOTE_SYMBOL_INVALID';
    throw invalid;
  }
  var body = await get('/markets/quotes?symbols=' + encodeURIComponent(normalized) + '&greeks=false');
  var value = body && body.quotes && body.quotes.quote;
  if (Array.isArray(value)) value = value[0];
  if (!value || String(value.symbol || '').toUpperCase() !== normalized) {
    var missing = new Error('Tradier sandbox returned no quote for ' + normalized);
    missing.code = 'TRADIER_SANDBOX_QUOTE_MISSING';
    throw missing;
  }
  var last = Number(value.last === undefined ? value.close : value.last);
  if (!Number.isFinite(last) || last <= 0) {
    var malformed = new Error('Tradier sandbox quote has no finite positive last price');
    malformed.code = 'TRADIER_SANDBOX_QUOTE_UNMEASURED';
    throw malformed;
  }
  return {
    provider: 'tradier',
    symbol: normalized,
    last: last,
    bid: value.bid === undefined ? null : Number(value.bid),
    ask: value.ask === undefined ? null : Number(value.ask),
    observedAt: new Date().toISOString()
  };
}

function isoDate(value) {
  var date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

/** Official Tradier daily/weekly/monthly historical-price surface. */
async function history(symbol, options) {
  options = options || {};
  var normalized = String(symbol || '').trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(normalized)) {
    var invalid = new Error('Tradier sandbox history symbol is invalid');
    invalid.code = 'TRADIER_SANDBOX_HISTORY_SYMBOL_INVALID';
    throw invalid;
  }
  var interval = String(options.interval || 'daily').toLowerCase();
  if (['daily', 'weekly', 'monthly'].indexOf(interval) < 0) {
    var badInterval = new Error('Tradier history interval must be daily, weekly, or monthly');
    badInterval.code = 'TRADIER_SANDBOX_HISTORY_INTERVAL_INVALID';
    throw badInterval;
  }
  var end = isoDate(options.end || new Date());
  var defaultStart = new Date((options.end ? new Date(options.end) : new Date()).getTime() - 400 * 24 * 60 * 60 * 1000);
  var start = isoDate(options.start || defaultStart);
  if (!start || !end || start > end) {
    var badDates = new Error('Tradier history dates must be an ordered YYYY-MM-DD range');
    badDates.code = 'TRADIER_SANDBOX_HISTORY_DATES_INVALID';
    throw badDates;
  }
  var body = await get('/markets/history?symbol=' + encodeURIComponent(normalized) +
    '&interval=' + encodeURIComponent(interval) + '&start=' + encodeURIComponent(start) + '&end=' + encodeURIComponent(end));
  var rows = asArray(body && body.history && body.history.day).filter(Boolean).map(function (row) {
    return {
      date: row.date || null,
      open: row.open === undefined ? null : Number(row.open),
      high: row.high === undefined ? null : Number(row.high),
      low: row.low === undefined ? null : Number(row.low),
      close: row.close === undefined ? null : Number(row.close),
      volume: row.volume === undefined ? null : Number(row.volume)
    };
  }).filter(function (row) { return row.date && Number.isFinite(row.close) && row.close > 0; });
  return { provider: 'tradier', symbol: normalized, interval: interval, start: start, end: end, rows: rows, observedAt: new Date().toISOString() };
}

async function findOrderByTag(tag) {
  var body = await get(accountIdPath('/orders?includeTags=true&limit=1000'));
  var rows = ordersFrom(body);
  for (var i = 0; i < rows.length; i++) if (rows[i].tag === tag) return rows[i];
  return null;
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
  probe: probe,
  accountSnapshot: accountSnapshot,
  quote: quote,
  history: history,
  previewOrder: previewOrder,
  placeOrder: placeOrder,
  cancelOrder: cancelOrder,
  getOrder: getOrder,
  findOrderByTag: findOrderByTag
};
