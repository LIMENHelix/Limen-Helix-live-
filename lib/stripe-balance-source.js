'use strict';

/** Read-only Stripe balance afference. It never creates or moves money. */

var Treasury = require('./civilization-treasury-ledger.js');
var SCHEMA = 'stripe-balance-observation/1.0';
var API = 'https://api.stripe.com/v1/balance';
var DEFAULT_TIMEOUT_MS = 8000;

function connectedVar(productDomain) {
  return 'LIMEN_STRIPE_CONNECTED_ACCOUNT_' + String(productDomain || '').toUpperCase().replace(/[^A-Z0-9]/g, '_');
}
function total(rows, currency) {
  return (Array.isArray(rows) ? rows : []).reduce(function (sum, row) {
    return sum + (row && String(row.currency || '').toLowerCase() === currency && Number.isSafeInteger(Number(row.amount))
      ? Number(row.amount) : 0);
  }, 0);
}
function mode(key) {
  if (/^(sk|rk)_live_/.test(key)) return 'live';
  if (/^(sk|rk)_test_/.test(key)) return 'test';
  return 'unknown';
}
async function read(productDomain, deps) {
  deps = deps || {};
  var env = deps.env || process.env;
  var fetchImpl = deps.fetch || global.fetch;
  var d = String(productDomain || '').trim().toLowerCase();
  if (Treasury.DOMAINS.indexOf(d) < 0) throw new Error('unknown Stripe balance product domain');
  var connected = d === 'finance' ? null : String(env[connectedVar(d)] || '').trim();
  if (d !== 'finance' && !connected) return {
    ok: true, observed: false, providerCalled: false, productDomain: d,
    scope: 'INTERNAL_LEDGER_ONLY', connectedAccountConfigured: false,
    reason: 'shared-platform-domain-uses-attributed-internal-subledger', accountingOnly: true,
    outboundMoneyAuthorized: false
  };
  if (connected && !/^acct_[A-Za-z0-9]+$/.test(connected)) return {
    ok: false, observed: false, providerCalled: false, productDomain: d,
    reason: 'stripe-connected-account-id-invalid', accountingOnly: true, outboundMoneyAuthorized: false
  };
  var key = env.STRIPE_SECRET_KEY;
  if (!key) return { ok: false, observed: false, providerCalled: false, productDomain: d,
    reason: 'stripe-secret-key-unavailable', accountingOnly: true, outboundMoneyAuthorized: false };
  var headers = { Authorization: 'Bearer ' + key };
  if (connected) headers['Stripe-Account'] = connected;
  var timeoutMs = Number.isFinite(Number(deps.timeoutMs))
    ? Math.max(1, Math.min(15000, Math.floor(Number(deps.timeoutMs)))) : DEFAULT_TIMEOUT_MS;
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, timeoutMs);
  var response, body;
  try {
    response = await fetchImpl(API, { method: 'GET', headers: headers, signal: controller.signal });
    body = await response.json();
  }
  catch (error) { return { ok: false, observed: false, providerCalled: true, productDomain: d,
    reason: 'stripe-balance-transport-failed', detail: String(error && error.message || error),
    accountingOnly: true, outboundMoneyAuthorized: false }; }
  finally { clearTimeout(timer); }
  if (!response.ok || !body || typeof body !== 'object' || !Array.isArray(body.available) ||
      !Array.isArray(body.pending) || (body.instant_available != null && !Array.isArray(body.instant_available))) return {
    ok: false, observed: false, providerCalled: true, productDomain: d,
    reason: 'stripe-balance-response-invalid', status: Number(response.status) || null,
    accountingOnly: true, outboundMoneyAuthorized: false
  };
  return {
    schemaVersion: SCHEMA,
    ok: true,
    observed: true,
    providerCalled: true,
    observedAt: new Date(Number.isFinite(Number(deps.now)) ? Number(deps.now) : Date.now()).toISOString(),
    productDomain: d,
    scope: connected ? 'CONNECTED_ACCOUNT' : 'PLATFORM_FINANCE_ONLY',
    connectedAccountConfigured: !!connected,
    connectedAccountRef: connected ? connected.slice(0, 9) + '…' : null,
    keyMode: mode(key),
    currency: 'usd',
    availableCents: total(body.available, 'usd'),
    pendingCents: total(body.pending, 'usd'),
    instantAvailableCents: total(body.instant_available, 'usd'),
    livemode: body.livemode === true,
    accountingOnly: true,
    outboundMoneyAuthorized: false,
    interpretation: connected
      ? 'exact connected-account balance observation; not shared with another domain'
      : 'platform balance visible to Finance only; not copied into domain spendable accounts'
  };
}

module.exports = { SCHEMA: SCHEMA, API: API, DEFAULT_TIMEOUT_MS: DEFAULT_TIMEOUT_MS,
  connectedVar: connectedVar, total: total, read: read };
