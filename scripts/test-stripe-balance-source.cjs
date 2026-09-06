'use strict';

var assert = require('node:assert/strict');
var Source = require('../lib/stripe-balance-source.js');

(async function () {
  var calls = [];
  var fetch = async function (url, options) {
    calls.push({ url: url, options: options });
    return { ok: true, status: 200, json: async function () { return {
      livemode: true,
      available: [{ amount: 12345, currency: 'usd' }, { amount: 99, currency: 'eur' }],
      pending: [{ amount: 678, currency: 'usd' }],
      instant_available: [{ amount: 100, currency: 'usd' }]
    }; } };
  };
  var finance = await Source.read('finance', { env: { STRIPE_SECRET_KEY: 'sk_live_secret' }, fetch: fetch, now: 1000 });
  assert.equal(finance.ok, true); assert.equal(finance.scope, 'PLATFORM_FINANCE_ONLY');
  assert.equal(finance.availableCents, 12345); assert.equal(finance.pendingCents, 678);
  assert.equal(finance.outboundMoneyAuthorized, false);
  assert.equal(calls[0].options.headers['Stripe-Account'], undefined);
  assert.equal(JSON.stringify(finance).includes('sk_live_secret'), false);

  calls.length = 0;
  var science = await Source.read('science', { env: { STRIPE_SECRET_KEY: 'sk_live_secret' }, fetch: fetch });
  assert.equal(science.ok, true); assert.equal(science.observed, false);
  assert.equal(science.scope, 'INTERNAL_LEDGER_ONLY'); assert.equal(calls.length, 0);

  var env = { STRIPE_SECRET_KEY: 'sk_test_secret', LIMEN_STRIPE_CONNECTED_ACCOUNT_SCIENCE: 'acct_Science123' };
  science = await Source.read('science', { env: env, fetch: fetch });
  assert.equal(science.scope, 'CONNECTED_ACCOUNT'); assert.equal(science.keyMode, 'test');
  assert.equal(calls.length, 1); assert.equal(calls[0].options.headers['Stripe-Account'], 'acct_Science123');
  assert.equal(science.connectedAccountRef, 'acct_Scie…');
  assert.equal(JSON.stringify(science).includes('acct_Science123'), false);

  calls.length = 0;
  var invalid = await Source.read('science', { env: { STRIPE_SECRET_KEY: 'sk_live_secret',
    LIMEN_STRIPE_CONNECTED_ACCOUNT_SCIENCE: 'not-an-account' }, fetch: fetch });
  assert.equal(invalid.ok, false); assert.equal(invalid.providerCalled, false); assert.equal(calls.length, 0);
  console.log('Stripe balance source: Finance-only platform scope, exact connected-account scope, no shared balance copying');
})().catch(function (error) { console.error(error && error.stack || error); process.exit(1); });
