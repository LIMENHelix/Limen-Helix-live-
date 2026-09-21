#!/usr/bin/env node
'use strict';

/**
 * test-stripe-income-single-book.js — PR-001 invariant tests.
 *
 * One Stripe charge must produce exactly ONE income entry across every internal
 * book, no matter how the webhook is delivered:
 *   (a) the same event redelivered                    → one entry
 *   (b) the same charge via two different event types → one entry
 *   (c) >400 other events between delivery and replay → one entry (the old
 *       400-entry seen list would have evicted and re-booked)
 *   (d) a Relay C2C sale books commission+fee once and NEVER gross+commission
 *   (e) operator-typed close revenue is labeled estimate, never summed as cash
 *   (f) a claim-store failure fails CLOSED: 500 to Stripe, zero writes
 *
 * Everything runs against a fake but faithful Upstash Redis (in-memory, real
 * command semantics for GET/SET NX EX/list ops) so the durable-claim paths are
 * the ones under test, not the process-memory fallbacks.
 */

var assert = require('node:assert/strict');
var crypto = require('node:crypto');

var SECRET = 'whsec_pr001_test';
process.env.STRIPE_WEBHOOK_SECRET = SECRET;
process.env.UPSTASH_REDIS_REST_URL = 'https://fake-upstash.pr001.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'pr001-token';
delete process.env.SALES_ADMIN_KEY;
delete process.env.LEAD_ADMIN_KEY;

// ── Fake Upstash Redis ──────────────────────────────────────────────────────
var STORE = new Map();
var REDIS_DOWN = false;

function rv(key) { return STORE.has(key) ? STORE.get(key) : null; }
function asList(key) { var v = rv(key); return Array.isArray(v) ? v : []; }

function redisCommand(cmd) {
  var method = cmd[0], args = cmd.slice(1);
  switch (method) {
    case 'PING': return 'PONG';
    case 'GET': {
      var v = rv(args[0]);
      return v == null ? null : (typeof v === 'string' ? v : JSON.stringify(v));
    }
    case 'SET': {
      var nx = false, i;
      for (i = 2; i < args.length; i++) if (String(args[i]).toUpperCase() === 'NX') nx = true;
      if (nx && rv(args[0]) != null) return null;
      STORE.set(args[0], args[1]);
      return 'OK';
    }
    case 'DEL': {
      var n = 0;
      args.forEach(function (k) { if (STORE.delete(k)) n++; });
      return n;
    }
    case 'LPUSH': {
      var l = asList(args[0]);
      for (var j = 1; j < args.length; j++) l.unshift(args[j]);
      STORE.set(args[0], l);
      return l.length;
    }
    case 'LRANGE': {
      var la = asList(args[0]);
      var start = parseInt(args[1], 10), stop = parseInt(args[2], 10);
      var from = start < 0 ? Math.max(la.length + start, 0) : start;
      var through = stop < 0 ? la.length + stop : stop;
      return la.slice(from, through + 1);
    }
    case 'LTRIM': {
      var lt = asList(args[0]);
      var s2 = parseInt(args[1], 10), e2 = parseInt(args[2], 10);
      var f2 = s2 < 0 ? Math.max(lt.length + s2, 0) : s2;
      var t2 = e2 < 0 ? lt.length + e2 : e2;
      STORE.set(args[0], lt.slice(f2, t2 + 1));
      return 'OK';
    }
    case 'LLEN': return asList(args[0]).length;
    case 'LREM': {
      var lr = asList(args[0]), count = parseInt(args[1], 10), target = args[2], removed = 0, next = [];
      lr.forEach(function (row) {
        if ((count === 0 || removed < count) && row === target) removed++;
        else next.push(row);
      });
      STORE.set(args[0], next);
      return removed;
    }
    case 'HSET': {
      var h = rv(args[0]);
      if (!h || typeof h !== 'object' || Array.isArray(h)) h = {};
      for (var k = 1; k + 1 < args.length; k += 2) h[args[k]] = args[k + 1];
      STORE.set(args[0], h);
      return 1;
    }
    case 'HGETALL': {
      var hh = rv(args[0]) || {};
      var flat = [];
      Object.keys(hh).forEach(function (kk) { flat.push(kk, String(hh[kk])); });
      return flat;
    }
    case 'EVAL': {
      // Emulates the exact Lua scripts lib/autofire-efference-store issues.
      var script = args[0], nkeys = parseInt(args[1], 10);
      var keys = args.slice(2, 2 + nkeys), argv = args.slice(2 + nkeys);
      var get = function (k) { var v = rv(k); return v == null ? null : (typeof v === 'string' ? v : JSON.stringify(v)); };
      if (script.indexOf('return redis.call("DEL", KEYS[1])') !== -1) {
        if (get(keys[0]) === argv[0]) { STORE.delete(keys[0]); return 1; }
        return 0;
      }
      if (script.indexOf('redis.call("SET", KEYS[2], ARGV[2]); return 1') !== -1) {
        if (get(keys[0]) !== argv[0]) return 0;
        STORE.set(keys[1], argv[1]); return 1;
      }
      if (script.indexOf('redis.call("SET", KEYS[3], ARGV[3]); return 1') !== -1) {
        if (get(keys[0]) !== argv[0] || get(keys[1]) !== argv[1]) return 0;
        STORE.set(keys[2], argv[2]); return 1;
      }
      if (script.indexOf('redis.call("SET", KEYS[1], ARGV[2]); return 1') !== -1) {
        if (get(keys[0]) !== argv[0]) return 0;
        STORE.set(keys[0], argv[1]); return 1;
      }
      if (script.indexOf('LREM", KEYS[1], 0, ARGV[1]); return redis.call("LPUSH"') !== -1) {
        var l1 = asList(keys[0]).filter(function (row) { return row !== argv[0]; });
        l1.unshift(argv[0]); STORE.set(keys[0], l1); return l1.length;
      }
      if (script.indexOf('redis.call("LTRIM", KEYS[2], 0, ARGV[3])') !== -1) {
        if (get(keys[0]) !== argv[0]) return 0;
        var l2 = asList(keys[1]).filter(function (row) { return row !== argv[1]; });
        l2.unshift(argv[1]);
        STORE.set(keys[1], l2.slice(0, parseInt(argv[2], 10) + 1));
        STORE.set(keys[0], argv[3]); return 1;
      }
      if (script.indexOf('ARGV[3] == "1" and not current') !== -1) {
        if (get(keys[0]) !== argv[0] || get(keys[1]) !== argv[1]) return 0;
        var current = get(keys[2]);
        if ((argv[2] === '1' && current == null) || (argv[2] === '0' && current === argv[3])) {
          STORE.set(keys[2], argv[4]); return 1;
        }
        return 0;
      }
      throw new Error('fake-redis: unsupported EVAL script: ' + script.slice(0, 80));
    }
    default:
      throw new Error('fake-redis: unsupported command ' + method);
  }
}

function fakeResponse(payload) {
  return {
    ok: true, status: 200,
    json: async function () { return payload; },
    text: async function () { return JSON.stringify(payload); }
  };
}

var realFetch = global.fetch;
global.fetch = async function (url, opts) {
  if (String(url).indexOf('fake-upstash.pr001.test') !== -1) {
    if (REDIS_DOWN) return { ok: false, status: 500, json: async function () { return { error: 'simulated outage' }; }, text: async function () { return '{"error":"simulated outage"}'; } };
    try {
      return fakeResponse({ result: redisCommand(JSON.parse(opts.body)) });
    } catch (e) {
      return fakeResponse({ error: e.message });
    }
  }
  return realFetch.apply(this, arguments);
};

// ── Harness ─────────────────────────────────────────────────────────────────
var db = require('../lib/limen-db');
var ledger = require('../lib/finance-ledger');
var incomeBook = require('../lib/stripe-income-book');
var Sales = require('../lib/sales-engine');
var stripeWebhook = require('../handlers/stripe-webhook');

function sign(raw) {
  var t = Math.floor(Date.now() / 1000);
  var v1 = crypto.createHmac('sha256', SECRET).update(t + '.' + raw, 'utf8').digest('hex');
  return 't=' + t + ',v1=' + v1;
}

function streamReq(raw) {
  return {
    method: 'POST',
    headers: { 'stripe-signature': sign(raw) },
    on: function (ev, cb) {
      if (ev === 'data') cb(Buffer.from(raw));
      if (ev === 'end') cb();
      return this;
    }
  };
}

function invoke(handler, req) {
  return new Promise(function (resolve, reject) {
    var res = {
      statusCode: 0,
      setHeader: function () {},
      end: function (body) {
        var parsed = null;
        try { parsed = body ? JSON.parse(body) : null; } catch (e) { parsed = body; }
        resolve({ status: res.statusCode, body: parsed });
      }
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

function evt(id, type, obj) {
  return JSON.stringify({ id: id, type: type, data: { object: obj } });
}

async function incomeEntries() {
  var rows = await db.lrange('finance:ledger', 0, 4999);
  return rows.filter(function (e) { return e && e.type === 'income'; });
}
async function entriesFor(chargeId) {
  var rows = await incomeEntries();
  return rows.filter(function (e) {
    var m = e.meta || {};
    return m.chargeId === chargeId || m.id === chargeId;
  });
}

var failures = 0;
function check(name, fn) {
  return Promise.resolve().then(fn).then(
    function () { console.log('  pass: ' + name); },
    function (e) { failures++; console.error('  FAIL: ' + name + ' — ' + (e && e.stack || e)); }
  );
}

async function main() {
  console.log('stripe income: one charge, one book entry, idempotent everywhere');

  // ── (a) the same event redelivered books once ──────────────────────────
  await check('(a) redelivered checkout.session.completed produces exactly one entry', async function () {
    var raw = evt('evt_a1', 'checkout.session.completed', {
      id: 'cs_a1', mode: 'payment', payment_intent: 'pi_a1', amount_total: 500,
      currency: 'usd', metadata: { streamId: 'wmc-tips' }
    });
    var first = await invoke(stripeWebhook, streamReq(raw));
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.income.recorded, true);

    var replay = await invoke(stripeWebhook, streamReq(raw));
    assert.equal(replay.status, 200);
    assert.equal(replay.body.duplicate, true, 'redelivery must be acknowledged as a duplicate');

    assert.equal((await entriesFor('pi_a1')).length, 1, 'one charge, one finance:ledger entry');
  });

  // ── (b) the same charge via two different event types books once ───────
  await check('(b) checkout.session.completed + payment_intent.succeeded on one charge = one entry', async function () {
    var session = evt('evt_b1', 'checkout.session.completed', {
      id: 'cs_b1', mode: 'payment', payment_intent: 'pi_b1', amount_total: 1200,
      currency: 'usd', metadata: { streamId: 'wmc-tips' }
    });
    var pi = evt('evt_b2', 'payment_intent.succeeded', {
      id: 'pi_b1', amount_received: 1200, currency: 'usd', metadata: { streamId: 'wmc-tips' }
    });
    var r1 = await invoke(stripeWebhook, streamReq(session));
    assert.equal(r1.body.income.recorded, true);
    var r2 = await invoke(stripeWebhook, streamReq(pi));
    assert.equal(r2.status, 200);
    assert.equal(r2.body.income.duplicate, true, 'the second event type about the same charge must not book');
    assert.equal((await entriesFor('pi_b1')).length, 1);
  });

  // ── (c) more than 400 events later, a redelivery still books nothing ───
  await check('(c) redelivery after 450 newer events (old seen-cache would have evicted) books nothing', async function () {
    var firstRaw = evt('evt_c0', 'payment_intent.succeeded', {
      id: 'pi_c0', amount_received: 100, currency: 'usd', metadata: { streamId: 'eviction-probe' }
    });
    await invoke(stripeWebhook, streamReq(firstRaw));
    for (var i = 1; i <= 450; i++) {
      var raw = evt('evt_c' + i, 'payment_intent.succeeded', {
        id: 'pi_c' + i, amount_received: 100, currency: 'usd', metadata: { streamId: 'eviction-probe' }
      });
      var r = await invoke(stripeWebhook, streamReq(raw));
      assert.equal(r.status, 200, 'event ' + i + ': ' + JSON.stringify(r.body));
    }
    assert.equal((await entriesFor('pi_c0')).length, 1, 'setup: booked once');
    var replay = await invoke(stripeWebhook, streamReq(firstRaw));
    assert.equal(replay.body.duplicate, true);
    assert.equal((await entriesFor('pi_c0')).length, 1, 'durable claim survives what evicted the old 400-entry cache');
  });

  // ── (d) C2C: generic endpoint excludes gross; relay books commission once ──
  await check('(d) C2C sale: gross never books on the generic endpoint, commission+fee book once', async function () {
    var marketplace = require('../lib/relay-marketplace');
    var relayWebhook = require('../handlers/relay-stripe-webhook');

    var mkt = await marketplace.createMarketplace({ name: 'PR001 C2C', commissionRate: 0.15, franchiseFeeRate: 0.05 });
    var seller = await marketplace.createUser({ email: 'seller@pr001.test', role: 'seller' });
    var listing = await marketplace.createListing({ marketplaceId: mkt.id, sellerId: seller.id, title: 'Widget', price: 100 });
    var order = await marketplace.createOrder({
      marketplaceId: mkt.id, buyerId: 'buyer_pr001', sellerId: seller.id, listingId: listing.id, subtotal: 100
    });
    assert(order && order.id, 'order seeded');

    // The C2C checkout session ALSO reaches the generic endpoint (same Stripe account).
    var c2cSession = evt('evt_d1', 'checkout.session.completed', {
      id: 'cs_d1', mode: 'payment', payment_intent: 'pi_d1', amount_total: 10000,
      currency: 'usd', metadata: { orderId: order.id, marketplace: mkt.id }
    });
    var generic = await invoke(stripeWebhook, streamReq(c2cSession));
    assert.equal(generic.status, 200, JSON.stringify(generic.body));
    assert.equal(generic.body.income.excluded, 'relay-c2c', 'generic booker must refuse C2C gross with a named reason');
    assert.equal((await entriesFor('pi_d1')).length, 0, 'no gross entry on the generic book');

    // The relay endpoint settles the same payment, from two different event types.
    var piEvent = evt('evt_d2', 'payment_intent.succeeded', {
      id: 'pi_d1', amount_received: 10000, currency: 'usd',
      metadata: { orderId: order.id, marketplace: mkt.id }
    });
    var settle1 = await invoke(relayWebhook, streamReq(piEvent));
    assert.equal(settle1.status, 200, JSON.stringify(settle1.body));
    assert.equal(settle1.body.paid, true);

    var settle2 = await invoke(relayWebhook, streamReq(c2cSession));
    assert.equal(settle2.status, 200, JSON.stringify(settle2.body));

    var all = await incomeEntries();
    var commission = all.filter(function (e) { return e.streamId === 'relay-c2c-commission' && e.meta && e.meta.orderId === order.id; });
    var franchise = all.filter(function (e) { return e.streamId === 'relay-c2c-franchise-fee' && e.meta && e.meta.orderId === order.id; });
    assert.equal(commission.length, 1, 'commission books exactly once across both event types');
    assert.equal(commission[0].amount, 15);
    assert.equal(franchise.length, 1, 'franchise fee books exactly once');
    assert.equal(franchise[0].amount, 5);
    var gross = all.filter(function (e) { return e.meta && (e.meta.chargeId === 'pi_d1' || e.meta.id === 'pi_d1' || e.meta.id === 'cs_d1'); });
    assert.equal(gross.length, 0, 'the $100 gross never books: commission+fee is the only C2C revenue');
  });

  // ── (e) typed desk revenue is labeled estimate, never summed as cash ───
  await check('(e) cash, configured estimates and typed operator revenue stay separately labeled', async function () {
    var agg = Sales.emptyAgg();
    agg['shows>enrollments'] = { subscriptions: { attempts: 1, wins: 1, costCents: 0, revenueCents: 4900 } };

    // A CRM close with a typed figure: estimate-class, and it must not ALSO
    // generate the configured deal-value guess for the same deal.
    Sales.applyEvent(agg, { transitionId: 'shows>enrollments', from: 'shows', to: 'enrollments',
      unit: 'closing', won: true, costCents: 0, dealSize: 'medium', typedRevenueCents: 120000 });
    // A CRM close without a typed figure: configured estimate, as before.
    Sales.applyEvent(agg, { transitionId: 'shows>enrollments', from: 'shows', to: 'enrollments',
      unit: 'rapport', won: true, costCents: 0, dealSize: 'small' });

    var funnel = Sales.computeFunnel(agg);
    assert.equal(funnel.actualRevenueCents, 4900, 'cash is payment-rail receipts only');
    assert.equal(funnel.typedRevenueCents, 120000, 'typed close revenue is labeled operator-estimate class');
    assert.equal(funnel.estimatedRevenueCents, Sales.defaultConfig().dealValueCents.small,
      'the typed close produced no configured guess; the untyped one did');
    assert.equal(funnel.revenueCents, 4900 + 120000 + Sales.defaultConfig().dealValueCents.small,
      'the headline is the labeled sum of the three components');
    assert(!agg.__enroll.medium, 'a typed close is never double-estimated through __enroll');
  });

  // ── (f) claim-store failure fails CLOSED ───────────────────────────────
  await check('(f) a storage outage answers 500 and writes nothing; recovery books once', async function () {
    var raw = evt('evt_f1', 'checkout.session.completed', {
      id: 'cs_f1', mode: 'payment', payment_intent: 'pi_f1', amount_total: 700,
      currency: 'usd', metadata: { streamId: 'wmc-tips' }
    });
    REDIS_DOWN = true;
    var down = await invoke(stripeWebhook, streamReq(raw));
    assert.equal(down.status, 500, 'an unreadable claim store must fail closed, not book blind');
    assert.equal((await entriesFor('pi_f1')).length, 0, 'zero entries written during the outage');

    await assert.rejects(incomeBook.bookIncome(JSON.parse(raw)), /redis/, 'the booker itself throws rather than risking a double-book');

    REDIS_DOWN = false;
    var up = await invoke(stripeWebhook, streamReq(raw));
    assert.equal(up.status, 200, JSON.stringify(up.body));
    assert.equal(up.body.income.recorded, true, 'Stripe retry after recovery books the charge');
    assert.equal((await entriesFor('pi_f1')).length, 1);
  });

  // ── integration: full subscription checkout books once in EVERY book ───
  await check('integration: limen subscription checkout books treasury + finance + sales:agg exactly once', async function () {
    var Treasury = require('../lib/civilization-treasury-ledger.js');
    var motorStore = require('../lib/autofire-efference-store');
    var raw = evt('evt_g1', 'checkout.session.completed', {
      id: 'cs_g1', mode: 'subscription', subscription: 'sub_g1', payment_intent: null,
      amount_total: 4900, currency: 'usd',
      customer_details: { email: 'buyer-g1@example.test', name: 'G One' },
      metadata: { limen: '1', domain: 'medicine', rung: 'p1', offer: 'Medicine Watch' }
    });
    var first = await invoke(stripeWebhook, streamReq(raw));
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.activated, true, JSON.stringify(first.body));

    var replay = await invoke(stripeWebhook, streamReq(raw));
    assert.equal(replay.body.duplicate, true);

    assert.equal((await entriesFor('sub_g1')).length, 1, 'finance:ledger booked once, keyed on the subscription');

    var proj = await Treasury.project(motorStore);
    var med = proj.accounts.find(function (a) { return a.productDomain === 'medicine'; });
    assert.equal(med.pendingCashCents, 4900, 'treasury booked once (digest idempotency)');

    var agg = (await db.get('sales:agg')) || {};
    var subUnit = agg['shows>enrollments'] && agg['shows>enrollments'].subscriptions;
    assert.equal(subUnit.revenueCents, 4900, 'sales:agg cash booked once, not re-added on replay');
    assert.equal(subUnit.attempts, 1, 'and the enrollment was not double-counted');
  });

  // ── the removed parallel booker stays gone ─────────────────────────────
  await check('capital-engine?action=stripe-webhook is gone (410), not a parallel booker', async function () {
    var capitalEngine = require('../handlers/capital-engine');
    process.env.ADMIN_MASTER = 'pr001-admin-pass';
    var res = await new Promise(function (resolve, reject) {
      var r = {
        statusCode: 0,
        status: function (code) { r.statusCode = code; return r; },
        json: function (obj) { resolve({ status: r.statusCode, body: obj }); },
        setHeader: function () {}, end: function () { resolve({ status: r.statusCode, body: null }); }
      };
      Promise.resolve(capitalEngine({
        method: 'POST',
        url: '/api/capital-engine?action=stripe-webhook&key=pr001-admin-pass',
        query: { action: 'stripe-webhook', key: 'pr001-admin-pass' },
        headers: {},
        on: function (ev, cb) { if (ev === 'end') cb(); return this; }
      }, r)).catch(reject);
    });
    delete process.env.ADMIN_MASTER;
    assert.equal(res.status, 410, 'the parallel booker must answer 410');
  });

  if (failures) {
    console.error('\n' + failures + ' check(s) failed');
    process.exit(1);
  }
  console.log('\nstripe income single-book: PASS');
}

main().catch(function (e) { console.error(e); process.exit(1); });
