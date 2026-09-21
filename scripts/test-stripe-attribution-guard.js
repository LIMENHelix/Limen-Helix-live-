#!/usr/bin/env node
'use strict';

/**
 * test-stripe-attribution-guard.js — PR-002 follow-up invariant tests.
 *
 * The finance-ledger booker must record income for ventures THIS system runs and
 * nothing else. Every legitimate checkout creator leaves a recognized mark
 * (limen:'1', a treasury domain, a streamId, relay source/orderId); a foreign
 * charge sharing the Stripe account must be:
 *   (a) ignored — never booked, never consuming the charge claim
 *   (b) observed — counted in stats and recorded in a bounded skip list
 *   (c) replay-safe — a redelivery re-ignores without spamming the skip log
 * while every recognized checkout shape still books exactly once, and a
 * refund/dispute for a skipped charge falls into the reversals unmatched path
 * instead of fabricating a reversal against nothing.
 *
 * Same fake-but-faithful Upstash harness as test-stripe-income-single-book.js.
 */

var assert = require('node:assert/strict');
var crypto = require('node:crypto');

var SECRET = 'whsec_pr002_attr_test';
process.env.STRIPE_WEBHOOK_SECRET = SECRET;
process.env.UPSTASH_REDIS_REST_URL = 'https://fake-upstash.pr002attr.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'pr002attr-token';
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
  if (String(url).indexOf('fake-upstash.pr002attr.test') !== -1) {
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
var incomeBook = require('../lib/stripe-income-book');
var reversals = require('../lib/stripe-reversals');
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
  return rows.filter(function (e) { return e && e.type === 'income' && !(e.meta && e.meta.reversal); });
}
async function skips() {
  return (await db.lrange(incomeBook.SKIPPED_KEY, 0, 199)) || [];
}

var failures = 0;
function check(name, fn) {
  return Promise.resolve().then(fn).then(
    function () { console.log('  pass: ' + name); },
    function (e) { failures++; console.error('  FAIL: ' + name + ' — ' + (e && e.stack || e)); }
  );
}

async function main() {
  console.log('stripe income attribution guard: foreign charges ignored, observed, never booked');

  // ── (a) foreign checkout: not booked, not claimed, skip recorded ─────────
  await check('(a) foreign checkout.session.completed (empty metadata) is ignored, unclaimed, recorded', async function () {
    var raw = evt('evt_a1', 'checkout.session.completed', {
      id: 'cs_a1', mode: 'payment', payment_intent: 'pi_a1', amount_total: 9900,
      currency: 'usd', metadata: {}
    });
    var r = await invoke(stripeWebhook, streamReq(raw));
    assert.equal(r.status, 200, JSON.stringify(r.body), 'an ignored charge is still acknowledged');
    assert.equal(r.body.income.ignored, 'no-attribution', JSON.stringify(r.body.income));
    assert.equal((await incomeEntries()).length, 0, 'nothing booked');
    assert(!STORE.has('limen:stripe:charge-booked:pi_a1'), 'the charge claim was NOT consumed');

    var skipRows = await skips();
    assert.equal(skipRows.length, 1, 'the refusal is recorded');
    assert.equal(skipRows[0].chargeId, 'pi_a1');
    assert.equal(skipRows[0].amountCents, 9900);
    assert.equal(skipRows[0].reason, 'no-attribution');
    assert.equal((await incomeBook.stats()).skippedNoAttribution, 1, 'and counted');

    // The claim being free means a later, properly-attributed event for the same
    // charge books normally — the ignore did not poison the charge.
    var legit = evt('evt_a2', 'payment_intent.succeeded', {
      id: 'pi_a1', amount_received: 9900, currency: 'usd', metadata: { streamId: 'late-attributed' }
    });
    var r2 = await invoke(stripeWebhook, streamReq(legit));
    assert.equal(r2.body.income.recorded, true, 'an ignored charge can still book once attributed');
    assert.equal((await incomeEntries()).length, 1);
  });

  // ── (b) replay + unrelated metadata keys: re-ignores, no skip spam ───────
  await check('(b) redelivery and unrelated metadata keys re-ignore without spamming the skip log', async function () {
    var raw = evt('evt_b1', 'checkout.session.completed', {
      id: 'cs_b1', mode: 'payment', payment_intent: 'pi_b1', amount_total: 2500,
      currency: 'usd', metadata: { foo: 'bar', note: 'unrelated keys' }
    });
    var r = await invoke(stripeWebhook, streamReq(raw));
    assert.equal(r.body.income.ignored, 'no-attribution');

    var replay = await invoke(stripeWebhook, streamReq(raw));
    assert.equal(replay.body.duplicate, true, 'same event id dedups at the event claim');

    var newEventSameCharge = evt('evt_b2', 'checkout.session.completed', {
      id: 'cs_b1', mode: 'payment', payment_intent: 'pi_b1', amount_total: 2500,
      currency: 'usd', metadata: { foo: 'bar', note: 'unrelated keys' }
    });
    var r2 = await invoke(stripeWebhook, streamReq(newEventSameCharge));
    assert.equal(r2.body.income.ignored, 'no-attribution', 'a new event id re-ignores harmlessly');

    var skipRows = await skips();
    assert.equal(skipRows.filter(function (s) { return s.chargeId === 'pi_b1'; }).length, 1,
      'one skip record per charge, however often Stripe re-sends it');
    assert((await incomeBook.stats()).skippedNoAttribution >= 2, 'the counter still moves per skip event');
    assert.equal((await incomeEntries()).filter(function (e) {
      var m = e.meta || {}; return m.chargeId === 'pi_b1' || m.id === 'pi_b1';
    }).length, 0, 'never booked');
  });

  // ── (c) every recognized checkout shape still books ──────────────────────
  await check('(c) recognized shapes book: limen:1, treasury domain, streamId, relay source/orderId', async function () {
    // Domain pay-link legacy shape: domain:'finance', empty streamId, no limen mark.
    var paylink = evt('evt_c1', 'checkout.session.completed', {
      id: 'cs_c1', mode: 'payment', payment_intent: 'pi_c1', amount_total: 1200,
      currency: 'usd', metadata: { domain: 'finance', streamId: '' }
    });
    var r1 = await invoke(stripeWebhook, streamReq(paylink));
    assert.equal(r1.body.income.recorded, true, 'legacy finance pay-link books: ' + JSON.stringify(r1.body.income));

    // Treasury-domain pay-link without the limen mark (domain alone is a recognized mark).
    var domainLink = evt('evt_c2', 'checkout.session.completed', {
      id: 'cs_c2', mode: 'payment', payment_intent: 'pi_c2', amount_total: 800,
      currency: 'usd', metadata: { domain: 'agriculture' }
    });
    var r2 = await invoke(stripeWebhook, streamReq(domainLink));
    assert.equal(r2.body.income.recorded, true, 'treasury-domain pay-link books');

    // Product shape: non-empty streamId.
    var product = evt('evt_c3', 'checkout.session.completed', {
      id: 'cs_c3', mode: 'payment', payment_intent: 'pi_c3', amount_total: 500,
      currency: 'usd', metadata: { streamId: 'wmc-tips' }
    });
    var r3 = await invoke(stripeWebhook, streamReq(product));
    assert.equal(r3.body.income.recorded, true, 'product streamId books');

    // Relay order link shape: source:'relay' + orderId (orderId alone must not trip
    // the C2C exclusion, which also requires marketplace).
    var relayOrder = evt('evt_c4', 'checkout.session.completed', {
      id: 'cs_c4', mode: 'payment', payment_intent: 'pi_c4', amount_total: 4200,
      currency: 'usd', metadata: { source: 'relay', orderId: 'order_c4' }
    });
    var r4 = await invoke(stripeWebhook, streamReq(relayOrder));
    assert.equal(r4.body.income.recorded, true, 'relay order books: ' + JSON.stringify(r4.body.income));

    // Subscription shape (limen:'1') — the pure predicate, exercised end-to-end by
    // test-stripe-income-single-book.js's integration check.
    assert.equal(incomeBook.isAttributed({ limen: '1', domain: 'medicine', rung: 'p1' }), true);
    assert.equal(incomeBook.isAttributed({}), false);
    assert.equal(incomeBook.isAttributed({ streamId: '   ' }), false, 'whitespace streamId is not attribution');
    assert.equal((await skips()).length, 2, 'no recognized shape produced a skip record');
  });

  // ── (d) refund/dispute for a skipped foreign charge → unmatched, nothing fabricated ──
  await check('(d) refund and dispute for a skipped foreign charge take the unmatched path', async function () {
    var foreign = evt('evt_d1', 'checkout.session.completed', {
      id: 'cs_d1', mode: 'payment', payment_intent: 'pi_d1', amount_total: 3000,
      currency: 'usd', metadata: {}
    });
    var ignored = await invoke(stripeWebhook, streamReq(foreign));
    assert.equal(ignored.body.income.ignored, 'no-attribution', 'setup: foreign charge skipped');

    var refund = evt('evt_d2', 'charge.refunded', {
      id: 'ch_d1', object: 'charge', payment_intent: 'pi_d1', amount: 3000, amount_refunded: 3000,
      currency: 'usd', refunds: { data: [{ id: 're_d1', amount: 3000, currency: 'usd', status: 'succeeded' }] }
    });
    var rr = await invoke(stripeWebhook, streamReq(refund));
    assert.equal(rr.status, 200, JSON.stringify(rr.body));
    assert.equal(rr.body.reversal.refunds[0].unmatched, true, 'a skipped charge is unknown to the reversal intake');
    var ledgerRows = await db.lrange('finance:ledger', 0, 4999);
    assert.equal(ledgerRows.filter(function (e) {
      return e && e.meta && e.meta.reversal === true && e.meta.refundId === 're_d1';
    }).length, 0, 'no fabricated reversal entry');

    var dispute = evt('evt_d3', 'charge.dispute.created', {
      id: 'dp_d1', object: 'dispute', charge: 'ch_d1', amount: 3000, currency: 'usd',
      reason: 'unrecognized', status: 'needs_response', evidence_details: { due_by: 1900000000 }
    });
    var dr = await invoke(stripeWebhook, streamReq(dispute));
    assert.equal(dr.status, 200, JSON.stringify(dr.body));
    assert.equal(dr.body.dispute.recorded, true, 'the dispute itself is still recorded and alerted');
    assert.equal(dr.body.dispute.treasuryBooked, false, 'but nothing is posted against an unattributed domain');
  });

  // ── (e) operator surface exposes the skip roster read-only ───────────────
  await check('(e) operator summary carries the foreign-skip count and roster', async function () {
    var summary = await reversals.operatorSummary();
    assert.equal(summary.ok, true);
    assert(summary.foreignSkips, 'foreignSkips present on the reversals summary');
    assert(summary.foreignSkips.count >= 3, 'cumulative skip count readable, got ' + summary.foreignSkips.count);
    assert(summary.foreignSkips.recent.length >= 1, 'recent skips readable');
    assert(summary.foreignSkips.recent.some(function (s) { return s.chargeId === 'pi_b1'; }), 'the recorded refusals are inspectable');
  });

  if (failures) {
    console.error('\n' + failures + ' check(s) failed');
    process.exit(1);
  }
  console.log('\nstripe attribution guard: PASS');
}

main().catch(function (e) { console.error(e); process.exit(1); });
