/**
 * test-treasury-stripe-bridge.js — a Stripe payment becomes a real treasury receipt.
 *
 * Runs against the REAL lib/civilization-treasury-ledger.js, not a stub. The ledger is the
 * thing whose behaviour matters here (idempotency, digest conflict, readback verification,
 * deposit-only geometry), so stubbing it would test the mock. Only the STORE is a fake, and
 * it implements the full strict-durable contract the ledger asserts on.
 *
 * The properties under test, in order of how much damage getting them wrong would do:
 *   1. Relay marketplace revenue can never land in a product domain's account.
 *   2. A redelivered Stripe event books the money once, not twice.
 *   3. Money lands in `pending`, and the receipt is deposit-only.
 *   4. Every refusal is named AND recorded, never silently dropped.
 *   5. The bridge never throws, whatever the store does.
 */
'use strict';

var assert = require('assert');
var Treasury = require('../lib/civilization-treasury-ledger.js');
var bridge = require('../lib/treasury-stripe-bridge.js');

/** The full strict-durable contract from the ledger's assertStore. */
function memStore(opts) {
  opts = opts || {};
  var kv = new Map();
  var lists = new Map();
  return {
    assertDurable: function () { if (opts.notDurable) throw new Error('store not durable'); },
    get: async function (k) { if (opts.failGet) throw new Error('get boom'); return kv.has(k) ? kv.get(k) : null; },
    set: async function (k, v) { if (opts.failSet) throw new Error('set boom'); kv.set(k, v); return true; },
    setIfAbsent: async function (k, v) { if (kv.has(k)) return false; kv.set(k, v); return true; },
    lpush: async function (k, v) {
      if (opts.failLpush) throw new Error('lpush boom');
      if (!lists.has(k)) lists.set(k, []);
      lists.get(k).unshift(v); return true;
    },
    ltrim: async function (k, a, b) {
      if (lists.has(k)) lists.set(k, lists.get(k).slice(a, b + 1));
      return true;
    },
    lrange: async function (k, a, b) {
      var l = lists.get(k) || []; return l.slice(a, b + 1);
    },
    _lists: lists
  };
}

var failures = 0;
function check(name, fn) {
  return Promise.resolve().then(fn).then(
    function () { console.log('  pass: ' + name); },
    function (e) { failures++; console.error('  FAIL: ' + name + ' — ' + (e && e.message)); }
  );
}

async function main() {
  console.log('treasury stripe bridge');

  // ── 1. The guard that protects every domain account from marketplace revenue ──
  await check('Relay session metadata is not a LIMEN product sale', function () {
    assert.equal(bridge.isLimenProductSale({ surface: 'legacy-storefront', items: '3' }), false);
    assert.equal(bridge.isLimenProductSale({ lines: '2', buyer: 'b_1' }), false);
    assert.equal(bridge.isLimenProductSale({ domain: 'medicine' }), false, 'domain alone must not qualify');
    assert.equal(bridge.isLimenProductSale(null), false);
    assert.equal(bridge.isLimenProductSale({ limen: '1', domain: 'medicine' }), true);
  });

  // ── 2. Money lands, once, in the right bucket ──
  await check('a captured sale books to the domain pending bucket', async function () {
    var store = memStore();
    var r = await bridge.bookCapturedSale({
      store: store, domain: 'medicine', grossCents: 4900, eventId: 'evt_test_1'
    });
    assert.equal(r.booked, true, r.reason || '');
    assert.ok(r.receiptId, 'a receipt id must come back');

    var proj = await Treasury.project(store);
    var med = proj.accounts.find(function (a) { return a.productDomain === 'medicine'; });
    assert.equal(med.pendingCashCents, 4900, 'gross lands in pending');
    assert.equal(med.availableCashCents, 0, 'available stays 0 until SALE_SETTLED is wired');
    assert.equal(proj.outboundMoneyAuthorized, false, 'the ledger must remain deposit-only');
  });

  await check('a redelivered Stripe event books the money exactly once', async function () {
    var store = memStore();
    var a = await bridge.bookCapturedSale({ store: store, domain: 'religion', grossCents: 2500, eventId: 'evt_dupe' });
    var b = await bridge.bookCapturedSale({ store: store, domain: 'religion', grossCents: 2500, eventId: 'evt_dupe' });
    assert.equal(a.booked, true);
    assert.equal(b.booked, true, 'a replay is a success, not an error');
    assert.equal(b.duplicate, true, 'and it must be reported as a duplicate');
    assert.equal(a.receiptId, b.receiptId, 'same event, same receipt');

    var proj = await Treasury.project(store);
    var rel = proj.accounts.find(function (a2) { return a2.productDomain === 'religion'; });
    assert.equal(rel.pendingCashCents, 2500, 'charged once, booked once');
  });

  await check('two different events on one domain both book', async function () {
    var store = memStore();
    await bridge.bookCapturedSale({ store: store, domain: 'finance', grossCents: 1000, eventId: 'evt_a' });
    await bridge.bookCapturedSale({ store: store, domain: 'finance', grossCents: 250, eventId: 'evt_b' });
    var proj = await Treasury.project(store);
    var fin = proj.accounts.find(function (a) { return a.productDomain === 'finance'; });
    assert.equal(fin.pendingCashCents, 1250);
  });

  // ── 3. Every refusal is named and recorded ──
  await check('refusals are named, and each one is logged rather than dropped', async function () {
    var store = memStore();
    var cases = [
      [{ domain: 'medicine', grossCents: 100 }, 'no-stripe-event-id'],
      [{ domain: '', grossCents: 100, eventId: 'e1' }, 'no-domain-on-payment'],
      [{ domain: 'not_a_domain', grossCents: 100, eventId: 'e2' }, 'not-a-product-domain:not_a_domain'],
      [{ domain: 'medicine', grossCents: 0, eventId: 'e3' }, 'non-positive-amount'],
      [{ domain: 'medicine', grossCents: -500, eventId: 'e4' }, 'non-positive-amount'],
      [{ domain: 'medicine', grossCents: 12.5, eventId: 'e5' }, 'non-positive-amount']
    ];
    for (var i = 0; i < cases.length; i++) {
      var r = await bridge.bookCapturedSale(Object.assign({ store: store }, cases[i][0]));
      assert.equal(r.booked, false, 'case ' + i + ' must refuse');
      assert.equal(r.reason, cases[i][1], 'case ' + i + ' reason');
    }
    var log = await bridge.unbooked(store);
    assert.equal(log.length, cases.length, 'every refusal must be recorded, got ' + log.length);

    var proj = await Treasury.project(store);
    proj.accounts.forEach(function (a) {
      assert.equal(a.pendingCashCents, 0, a.productDomain + ' must hold nothing after refusals');
    });
  });

  await check('the canonical/runtime alias trap is refused, not silently mapped', async function () {
    var store = memStore();
    /* The snapshot runtime calls these health/research/supplyChain; the treasury and the
       offer catalog both use medicine/science/trade. If a caller ever passes a runtime key
       it must be refused loudly rather than guessed at. */
    var r = await bridge.bookCapturedSale({ store: store, domain: 'health', grossCents: 100, eventId: 'evt_alias' });
    assert.equal(r.booked, false);
    assert.equal(r.reason, 'not-a-product-domain:health');
  });

  // ── 4. The non-throwing contract, which the webhook depends on ──
  await check('a broken store refuses without throwing', async function () {
    var r = await bridge.bookCapturedSale({
      store: memStore({ failLpush: true }), domain: 'medicine', grossCents: 100, eventId: 'evt_broken'
    });
    assert.equal(r.booked, false);
    assert.ok(/^post-failed:/.test(r.reason), 'expected post-failed, got ' + r.reason);
  });

  await check('a non-durable store refuses without throwing', async function () {
    var r = await bridge.bookCapturedSale({
      store: memStore({ notDurable: true }), domain: 'medicine', grossCents: 100, eventId: 'evt_nd'
    });
    assert.equal(r.booked, false);
    assert.ok(/^post-failed:/.test(r.reason), 'expected post-failed, got ' + r.reason);
  });

  await check('a missing store refuses without throwing', async function () {
    var r = await bridge.bookCapturedSale({ domain: 'medicine', grossCents: 100, eventId: 'evt_nostore' });
    assert.equal(r.booked, false);
    assert.equal(r.reason, 'no-store');
  });

  // ── 5. EVERY domain can take a deposit, including the ones with nothing to sell ──
  await check('all 20 domains can receive a deposit, sellable today or not', async function () {
    var store = memStore();
    var names = Treasury.DOMAINS;
    assert.equal(names.length, 20, 'expected 20 product domains');
    for (var i = 0; i < names.length; i++) {
      var r = await bridge.bookCapturedSale({
        store: store, domain: names[i], grossCents: 100, eventId: 'evt_all_' + i
      });
      assert.equal(r.booked, true, names[i] + ' must be able to take a deposit: ' + r.reason);
    }
    var proj = await Treasury.project(store);
    assert.equal(proj.accounts.length, 20, 'the projection must expose all 20 accounts');
    proj.accounts.forEach(function (a) {
      assert.equal(a.pendingCashCents, 100, a.productDomain + ' must hold its deposit');
    });
    /* The five with no priced offer today — communication, culture, energy, industry,
       infrastructure — are included deliberately. Their accounts are live and will book
       the moment an offer exists, with no code change. Nothing about the deposit path
       depends on whether a domain currently sells anything. */
  });

  await check('every offer-catalog domain is a valid treasury domain', async function () {
    var catalog = require('../lib/offer-catalog.js');
    var store = memStore();
    var names = catalog.domains();
    assert.ok(names.length > 0, 'catalog must expose domains');
    for (var i = 0; i < names.length; i++) {
      var r = await bridge.bookCapturedSale({
        store: store, domain: names[i], grossCents: 100, eventId: 'evt_cat_' + i
      });
      assert.equal(r.booked, true, names[i] + ' must be bookable: ' + r.reason);
    }
    var proj = await Treasury.project(store);
    var funded = proj.accounts.filter(function (a) { return a.pendingCashCents > 0; });
    assert.equal(funded.length, names.length, 'each catalog domain gets its own account');
  });

  console.log('');
  if (failures) {
    console.error(failures + ' failure(s)');
    process.exit(1);
  }
  console.log('treasury stripe bridge: all checks passed');
}

main().catch(function (e) {
  console.error('harness error: ' + (e && e.stack || e));
  process.exit(1);
});
