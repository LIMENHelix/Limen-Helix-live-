'use strict';

var assert = require('node:assert/strict');
var Handler = require('../handlers/civilization-treasury.js');

function response() {
  return { statusCode: 0, headers: {}, setHeader: function (k, v) { this.headers[String(k).toLowerCase()] = v; },
    end: function (value) { this.body = JSON.parse(value); } };
}
function request(method, domain, pass, includeStripe) {
  var query = [];
  if (domain) query.push('domain=' + domain);
  if (includeStripe) query.push('includeStripe=1');
  return { method: method, url: '/api/civilization-treasury' + (query.length ? '?' + query.join('&') : ''),
    headers: { 'x-limen-pass': pass || '' } };
}

(async function () {
  var reads = 0;
  var projection = {
    schemaVersion: 'civilization-treasury-projection/1.0', currency: 'usd', generatedAt: '2026-08-27T00:00:00.000Z',
    accounts: [{ productDomain: 'finance', availableCashCents: 0 }, { productDomain: 'science', availableCashCents: 0 }],
    blockers: ['external-balance-reconciliation-not-connected'], outboundMoneyAuthorized: false
  };
  var gate = { reqKey: function (req) { return req.headers['x-limen-pass']; },
    isMaster: function (pass) { return pass === 'master'; },
    deny: function (res) { res.statusCode = 403; res.end(JSON.stringify({ ok: false, error: 'denied' })); } };
  var treasury = { project: async function () { reads++; return projection; } };
  var stripeReads = [];
  var stripeBalance = { read: async function (domain) { stripeReads.push(domain); return {
    ok: true, observed: domain === 'finance', productDomain: domain,
    scope: domain === 'finance' ? 'PLATFORM_FINANCE_ONLY' : 'INTERNAL_LEDGER_ONLY',
    outboundMoneyAuthorized: false
  }; } };
  var handler = Handler.createHandler({ gate: gate, treasury: treasury, stripeBalance: stripeBalance, store: {} });

  var res = response();
  await handler(request('GET', '', 'wrong'), res);
  assert.equal(res.statusCode, 403); assert.equal(reads, 0);

  res = response();
  await handler(request('GET', '', 'master'), res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.readOnly, true);
  assert.equal(res.body.accountingOnly, true); assert.equal(res.body.projection.outboundMoneyAuthorized, false);

  res = response();
  await handler(request('GET', 'science', 'master'), res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.account.productDomain, 'science');
  assert.equal(res.body.outboundMoneyAuthorized, false);

  res = response();
  await handler(request('GET', 'science', 'master', true), res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.stripeBalance.scope, 'INTERNAL_LEDGER_ONLY');
  assert.deepEqual(stripeReads, ['science']);

  res = response();
  await handler(request('GET', '', 'master', true), res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.stripeScope, 'FINANCE_PLATFORM_ONLY_NOT_COPIED_TO_DOMAINS');
  assert.deepEqual(stripeReads, ['science', 'finance']);

  res = response();
  await handler(request('GET', 'unknown', 'master'), res);
  assert.equal(res.statusCode, 400);

  res = response();
  await handler(request('POST', '', 'master'), res);
  assert.equal(res.statusCode, 405); assert.equal(reads, 5);
  assert.equal(JSON.stringify(res.body).includes('master'), false);
  console.log('civilization treasury handler: protected read-only all-domain and sovereign-account projections');
})().catch(function (error) { console.error(error && error.stack || error); process.exit(1); });
