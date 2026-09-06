/**
 * test-domain-paylink.js — every domain can mint a Stripe payment link, and only an
 * operator can mint one.
 *
 * NO NETWORK, NO STRIPE. The rail is injected, because minting for real creates a Product
 * and a Price on a LIVE account and neither can be deleted from here. What is under test
 * is the handler's own behaviour: the gate, validation, idempotency, and that the domain
 * reaches the rail intact.
 */
'use strict';

var assert = require('assert');
var Treasury = require('../lib/civilization-treasury-ledger.js');
var mod = require('../handlers/domain-paylink.js');

function fakeRes() {
  return {
    statusCode: 0, headers: {}, body: null,
    setHeader: function (k, v) { this.headers[k] = v; },
    end: function (s) { this.body = JSON.parse(s); }
  };
}
function fakeReq(method, url, body) {
  return { method: method, url: url || '/api/domain-paylink', body: body || undefined, on: function () {} };
}
function memDb() {
  var m = new Map();
  return { get: async function (k) { return m.has(k) ? m.get(k) : null; }, set: async function (k, v) { m.set(k, v); return true; } };
}
function railStub(opts) {
  opts = opts || {};
  var calls = [];
  return {
    calls: calls,
    hasKey: function () { return opts.noKey !== true; },
    keyMode: function () { return 'test'; },
    createPaymentLink: async function (o) {
      calls.push(o);
      if (opts.fail) return { ok: false, error: 'stripe said no' };
      return {
        ok: true, url: 'https://buy.stripe.com/test_' + o.domain,
        paymentLinkId: 'plink_' + o.domain, priceId: 'price_1', productId: 'prod_1',
        domain: o.domain, amountCents: o.amountCents, booksToTreasury: true
      };
    }
  };
}
var openGate = { reqKey: function () { return 'master'; }, isMaster: function () { return true; }, deny: function () {} };
var shutGate = {
  reqKey: function () { return null; }, isMaster: function () { return false; },
  deny: function (res) { res.statusCode = 401; res.end(JSON.stringify({ ok: false, error: 'unauthorized' })); }
};

var failures = 0;
function check(name, fn) {
  return Promise.resolve().then(fn).then(
    function () { console.log('  pass: ' + name); },
    function (e) { failures++; console.error('  FAIL: ' + name + ' — ' + (e && e.message)); }
  );
}

async function main() {
  console.log('domain paylink');

  await check('without the master key nothing mints', async function () {
    var rail = railStub();
    var h = mod.createHandler({ gate: shutGate, rail: rail, store: memDb() });
    var res = fakeRes();
    await h(fakeReq('POST', null, { domain: 'medicine', name: 'X', amountCents: 500 }), res);
    assert.equal(res.statusCode, 401);
    assert.equal(rail.calls.length, 0, 'the rail must never be reached without the gate');
  });

  await check('ALL TWENTY domains can mint a link', async function () {
    var rail = railStub();
    var store = memDb();
    var h = mod.createHandler({ gate: openGate, rail: rail, store: store });
    for (var i = 0; i < Treasury.DOMAINS.length; i++) {
      var d = Treasury.DOMAINS[i];
      var res = fakeRes();
      await h(fakeReq('POST', null, { domain: d, name: 'Thing for ' + d, amountCents: 1500 }), res);
      assert.equal(res.statusCode, 200, d + ' must mint: ' + JSON.stringify(res.body));
      assert.equal(res.body.ok, true, d);
      assert.equal(res.body.domain, d, d + ' must be stamped as itself');
      assert.ok(res.body.url, d + ' must get a URL');
      assert.equal(res.body.booksToTreasury, true, d + ' link must book to its treasury account');
    }
    assert.equal(rail.calls.length, 20, 'twenty mints, twenty rail calls');
    /* The five with no catalog rung are included on purpose: a domain does not need a
       pre-declared subscription product to take money. */
    ['communication', 'culture', 'energy', 'industry', 'infrastructure'].forEach(function (d) {
      assert.ok(rail.calls.some(function (c) { return c.domain === d; }), d + ' must have minted');
    });
  });

  await check('re-minting the same offer reuses the link instead of duplicating it', async function () {
    var rail = railStub();
    var store = memDb();
    var h = mod.createHandler({ gate: openGate, rail: rail, store: store });
    var a = fakeRes(), b = fakeRes();
    await h(fakeReq('POST', null, { domain: 'energy', name: 'Bill audit', amountCents: 2500 }), a);
    await h(fakeReq('POST', null, { domain: 'energy', name: 'Bill audit', amountCents: 2500 }), b);
    assert.equal(a.body.reused, false);
    assert.equal(b.body.reused, true, 'the second call must reuse');
    assert.equal(b.body.url, a.body.url);
    assert.equal(rail.calls.length, 1, 'a live account must not accumulate duplicate Products');
  });

  await check('a different price is a different offer and mints again', async function () {
    var rail = railStub();
    var h = mod.createHandler({ gate: openGate, rail: rail, store: memDb() });
    await h(fakeReq('POST', null, { domain: 'energy', name: 'Bill audit', amountCents: 2500 }), fakeRes());
    await h(fakeReq('POST', null, { domain: 'energy', name: 'Bill audit', amountCents: 4000 }), fakeRes());
    assert.equal(rail.calls.length, 2);
  });

  await check('bad input is refused before Stripe is touched', async function () {
    var rail = railStub();
    var h = mod.createHandler({ gate: openGate, rail: rail, store: memDb() });
    var cases = [
      { domain: 'health', name: 'x', amountCents: 500 },       // runtime alias, not a product domain
      { domain: 'nonsense', name: 'x', amountCents: 500 },
      { domain: 'medicine', name: '', amountCents: 500 },
      { domain: 'medicine', name: 'x', amountCents: 49 },
      { domain: 'medicine', name: 'x', amountCents: 10.5 },
      { domain: 'medicine', name: 'x', amountCents: -100 }
    ];
    for (var i = 0; i < cases.length; i++) {
      var res = fakeRes();
      await h(fakeReq('POST', null, cases[i]), res);
      assert.equal(res.statusCode, 400, 'case ' + i + ' must be refused');
      assert.equal(res.body.ok, false);
    }
    assert.equal(rail.calls.length, 0, 'no invalid input may reach a live Stripe account');
  });

  await check('with no Stripe key it refuses instead of pretending', async function () {
    var h = mod.createHandler({ gate: openGate, rail: railStub({ noKey: true }), store: memDb() });
    var res = fakeRes();
    await h(fakeReq('POST', null, { domain: 'medicine', name: 'x', amountCents: 500 }), res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.ok, false);
  });

  await check('a Stripe failure is not persisted as a usable link', async function () {
    var store = memDb();
    var h = mod.createHandler({ gate: openGate, rail: railStub({ fail: true }), store: store });
    var res = fakeRes();
    await h(fakeReq('POST', null, { domain: 'medicine', name: 'x', amountCents: 500 }), res);
    assert.equal(res.statusCode, 502);
    var saved = await store.get(mod.LINKS_KEY);
    assert.ok(!saved || Object.keys(saved).length === 0, 'a failed mint must leave no dead URL behind');
  });

  await check('GET lists all twenty accounts, empty ones included', async function () {
    var store = memDb();
    var h = mod.createHandler({ gate: openGate, rail: railStub(), store: store });
    await h(fakeReq('POST', null, { domain: 'medicine', name: 'Recall alert', amountCents: 800 }), fakeRes());
    var res = fakeRes();
    await h(fakeReq('GET'), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.domains, 20);
    assert.equal(Object.keys(res.body.byDomain).length, 20, 'all twenty listed');
    assert.equal(res.body.byDomain.medicine.length, 1);
    assert.equal(res.body.byDomain.culture.length, 0, 'an empty account is visibly empty, not absent');
    assert.equal(res.body.totalLinks, 1);
  });

  await check('GET can filter to one domain', async function () {
    var h = mod.createHandler({ gate: openGate, rail: railStub(), store: memDb() });
    await h(fakeReq('POST', null, { domain: 'medicine', name: 'A', amountCents: 800 }), fakeRes());
    await h(fakeReq('POST', null, { domain: 'law', name: 'B', amountCents: 900 }), fakeRes());
    var res = fakeRes();
    await h(fakeReq('GET', '/api/domain-paylink?domain=law'), res);
    assert.equal(res.body.totalLinks, 1);
    assert.equal(res.body.byDomain.law.length, 1);
    assert.equal(res.body.byDomain.medicine.length, 0);
  });

  console.log('');
  if (failures) { console.error(failures + ' failure(s)'); process.exit(1); }
  console.log('domain paylink: all checks passed');
}

main().catch(function (e) { console.error('harness error: ' + (e && e.stack || e)); process.exit(1); });
