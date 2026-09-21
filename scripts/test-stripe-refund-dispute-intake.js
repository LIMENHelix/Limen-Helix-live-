#!/usr/bin/env node
'use strict';

/**
 * test-stripe-refund-dispute-intake.js — PR-002 invariant tests.
 *
 * charge.refunded / charge.dispute.created / charge.dispute.closed must reconcile the
 * books exactly once each, no matter how often Stripe delivers them:
 *   (a) a refund of a booked charge reverses it once — redelivered, and re-sent
 *       under a NEW event id, still once
 *   (b) a full refund of a subscription charge nets every book to zero and stops
 *       delivery; a partial refund reverses proportionally and never deactivates
 *   (c) a refund for a charge this system never booked becomes a recorded exception
 *       on the unmatched list — no crash, no fabricated entry
 *   (e) a dispute is recorded with amount/reason/due date and alerted ONCE under
 *       replay; the customer record is never touched
 *   (f) dispute.closed (won) updates the record and attempts the release, idempotently
 *   (g) invoice.paid and invoice.payment_succeeded for the SAME renewal charge book
 *       one renewal (one receipt email claim, one sales:agg add, one treasury receipt)
 *   (h) a LOST dispute stays explicitly unresolved: recorded, alerted once, and no
 *       compensating transaction in any book — pinned, not merely implied
 *   (i) a claim-store outage fails CLOSED: 500 to Stripe, zero writes, and the retry
 *       after recovery books the reversal exactly once (claim was released)
 *
 * Same fake-but-faithful Upstash harness as test-stripe-income-single-book.js so the
 * durable-claim paths are the ones under test, not the process-memory fallbacks.
 */

var assert = require('node:assert/strict');
var crypto = require('node:crypto');

var SECRET = 'whsec_pr002_test';
process.env.STRIPE_WEBHOOK_SECRET = SECRET;
process.env.UPSTASH_REDIS_REST_URL = 'https://fake-upstash.pr002.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'pr002-token';
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
  if (String(url).indexOf('fake-upstash.pr002.test') !== -1) {
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
var treasuryBridge = require('../lib/treasury-stripe-bridge');
var Treasury = require('../lib/civilization-treasury-ledger.js');
var motorStore = require('../lib/autofire-efference-store');
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
async function reversalEntries(refundId) {
  var rows = await incomeEntries();
  return rows.filter(function (e) {
    var m = e.meta || {};
    return m.reversal === true && (!refundId || m.refundId === refundId);
  });
}
async function alerts(kind) {
  var rows = await db.lrange(reversals.ALERTS_KEY, 0, 199);
  return (rows || []).filter(function (a) { return a && (!kind || a.kind === kind); });
}
async function unmatched() {
  return (await db.lrange(reversals.UNMATCHED_KEY, 0, 499)) || [];
}
async function accountFor(domain) {
  var proj = await Treasury.project(motorStore);
  return proj.accounts.find(function (a) { return a.productDomain === domain; });
}
async function subRevenue() {
  var agg = (await db.get('sales:agg')) || {};
  var t = agg['shows>enrollments'] || {};
  return t.subscriptions || { attempts: 0, wins: 0, revenueCents: 0 };
}
function checkoutSession(evtId, o) {
  return evt(evtId, 'checkout.session.completed', {
    id: 'cs_' + evtId, mode: 'subscription', subscription: o.subscriptionId,
    payment_intent: null, amount_total: o.amountCents, currency: 'usd',
    customer: o.customerId,
    customer_details: { email: o.email, name: o.email },
    metadata: { limen: '1', domain: o.domain, rung: 'p1', offer: o.domain + ' Watch' }
  });
}
function renewalInvoice(evtId, type, o) {
  return evt(evtId, type, {
    id: 'in_' + evtId, billing_reason: 'subscription_cycle', amount_paid: o.amountCents,
    total: o.amountCents, currency: 'usd', charge: o.chargeId, customer: o.customerId,
    subscription: o.subscriptionId, customer_email: o.email
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
  console.log('stripe reversals: refund, dispute and reversal intake');

  // ── (a) a refund reverses a booked charge exactly once ───────────────────
  await check('(a) duplicate refund delivery (same event id, then new event id) = exactly one reversal', async function () {
    var book = evt('evt_a_book', 'checkout.session.completed', {
      id: 'cs_a_book', mode: 'payment', payment_intent: 'pi_a1', amount_total: 1000,
      currency: 'usd', metadata: { streamId: 'wmc-tips' }
    });
    var booked = await invoke(stripeWebhook, streamReq(book));
    assert.equal(booked.body.income.recorded, true, 'setup: income booked');

    var refund = evt('evt_a_ref', 'charge.refunded', {
      id: 'ch_a1', object: 'charge', payment_intent: 'pi_a1', amount: 1000, amount_refunded: 1000,
      currency: 'usd', refunds: { data: [{ id: 're_a1', amount: 1000, currency: 'usd', status: 'succeeded' }] }
    });
    var first = await invoke(stripeWebhook, streamReq(refund));
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.reversal.refunds[0].booked, true, JSON.stringify(first.body));
    assert.equal(first.body.reversal.refunds[0].ledgerEntry, true);

    var replay = await invoke(stripeWebhook, streamReq(refund));
    assert.equal(replay.body.duplicate, true, 'same event id replays at the event claim');

    var newEventSameRefund = evt('evt_a_ref2', 'charge.refunded', {
      id: 'ch_a1', object: 'charge', payment_intent: 'pi_a1', amount: 1000, amount_refunded: 1000,
      currency: 'usd', refunds: { data: [{ id: 're_a1', amount: 1000, currency: 'usd', status: 'succeeded' }] }
    });
    var second = await invoke(stripeWebhook, streamReq(newEventSameRefund));
    assert.equal(second.status, 200);
    assert.equal(second.body.reversal.refunds[0].duplicate, true, 'same refund id under a new event id dedups on the reversal claim');

    var revs = await reversalEntries('re_a1');
    assert.equal(revs.length, 1, 'exactly one reversal entry');
    assert.equal(revs[0].amount, -10, 'the reversal is a negative entry against the original stream');
    assert.equal(revs[0].streamId, 'wmc-tips');
    assert.equal(revs[0].meta.originalChargeKey, 'pi_a1', 'linked back to the original booking');

    var refundAlerts = (await alerts('refund')).filter(function (a) { return a.refundId === 're_a1'; });
    assert.equal(refundAlerts.length, 1, 'one operator alert, not one per delivery');
  });

  // ── (b) full refund of a subscription charge: every book nets to zero, delivery stops ──
  await check('(b) full subscription refund nets treasury + sales:agg to zero and deactivates', async function () {
    var sub = { email: 'buyer-b@example.test', domain: 'medicine', subscriptionId: 'sub_b1', customerId: 'cus_b1', amountCents: 4900 };
    var bought = await invoke(stripeWebhook, streamReq(checkoutSession('evt_b_buy', sub)));
    assert.equal(bought.body.activated, true, JSON.stringify(bought.body));
    assert.equal((await accountFor('medicine')).pendingCashCents, 4900, 'setup: treasury booked');
    assert.equal((await subRevenue()).revenueCents, 4900, 'setup: sales:agg booked');

    var refund = evt('evt_b_ref', 'charge.refunded', {
      id: 'ch_b1', object: 'charge', amount: 4900, amount_refunded: 4900, currency: 'usd',
      customer: 'cus_b1',
      refunds: { data: [{ id: 're_b1', amount: 4900, currency: 'usd', status: 'succeeded' }] }
    });
    var r = await invoke(stripeWebhook, streamReq(refund));
    assert.equal(r.status, 200, JSON.stringify(r.body));
    var outcome = r.body.reversal.refunds[0];
    assert.equal(outcome.booked, true, JSON.stringify(r.body.reversal));
    assert.equal(outcome.fullRefund, true);
    assert.equal(outcome.deactivated, 1, 'a full refund of the subscription charge stops delivery');
    assert.equal(outcome.treasuryBooked, true, 'treasury REFUND posts from the pending bucket');

    assert.equal((await accountFor('medicine')).pendingCashCents, 0, 'treasury nets to zero');
    var rev = await subRevenue();
    assert.equal(rev.revenueCents, 0, 'sales:agg revenue nets to zero');
    assert.equal(rev.reversedCents, 4900, 'and the reversal is labeled, not silently vanished');

    var subsLib = require('../lib/subscriptions');
    var who = await subsLib.getStrict('buyer-b@example.test', motorStore);
    assert.equal(who.active, false);
    assert.equal(who.endedReason, 'refunded');

    var revs = await reversalEntries('re_b1');
    assert.equal(revs.length, 1, 'finance ledger carries one negative entry (booked under the subscription key)');
    assert.equal(revs[0].meta.originalChargeKey, 'sub_b1');

    var replay = await invoke(stripeWebhook, streamReq(refund));
    assert.equal(replay.body.duplicate, true);
    assert.equal((await accountFor('medicine')).pendingCashCents, 0, 'replay changes nothing');
    assert.equal((await subRevenue()).reversedCents, 4900, 'replay reverses nothing twice');
    assert.equal((await reversalEntries('re_b1')).length, 1);
  });

  // ── (c) partial refund: proportional reversal, delivery continues ────────
  await check('(c) partial refund reverses proportionally and never deactivates', async function () {
    var sub = { email: 'buyer-c@example.test', domain: 'religion', subscriptionId: 'sub_c1', customerId: 'cus_c1', amountCents: 4900 };
    var bought = await invoke(stripeWebhook, streamReq(checkoutSession('evt_c_buy', sub)));
    assert.equal(bought.body.activated, true, JSON.stringify(bought.body));

    var refund = evt('evt_c_ref', 'charge.refunded', {
      id: 'ch_c1', object: 'charge', amount: 4900, amount_refunded: 1000, currency: 'usd',
      customer: 'cus_c1',
      refunds: { data: [{ id: 're_c1', amount: 1000, currency: 'usd', status: 'succeeded' }] }
    });
    var r = await invoke(stripeWebhook, streamReq(refund));
    assert.equal(r.status, 200, JSON.stringify(r.body));
    var outcome = r.body.reversal.refunds[0];
    assert.equal(outcome.booked, true);
    assert.equal(outcome.fullRefund, false);
    assert.equal(outcome.deactivated, 0, 'a partial refund is a service gesture, not a cancellation');

    assert.equal((await accountFor('religion')).pendingCashCents, 3900, 'treasury keeps the unrefunded portion');
    var subsLib = require('../lib/subscriptions');
    var who = await subsLib.getStrict('buyer-c@example.test', motorStore);
    assert.equal(who.active, true, 'delivery continues');
  });

  // ── (d) refund of an unknown charge: recorded exception, nothing fabricated ──
  await check('(d) refund for an unknown charge lands on the unmatched list, writes no entry, survives replay', async function () {
    var before = (await reversalEntries()).length;
    var refund = evt('evt_d_ref', 'charge.refunded', {
      id: 'ch_unknown1', object: 'charge', amount: 500, amount_refunded: 500, currency: 'usd',
      refunds: { data: [{ id: 're_unknown1', amount: 500, currency: 'usd', status: 'succeeded' }] }
    });
    var r = await invoke(stripeWebhook, streamReq(refund));
    assert.equal(r.status, 200, JSON.stringify(r.body), 'unknown charges must not crash the handler');
    assert.equal(r.body.reversal.refunds[0].unmatched, true);

    assert.equal((await reversalEntries()).length, before, 'no ledger entry fabricated against nothing');
    var um = await unmatched();
    var mine = um.filter(function (u) { return u.refundId === 're_unknown1'; });
    assert.equal(mine.length, 1, 'one recorded exception');
    assert.equal(mine[0].amountCents, 500);
    var ua = (await alerts('refund-unmatched')).filter(function (a) { return a.refundId === 're_unknown1'; });
    assert.equal(ua.length, 1, 'one unmatched alert');

    var newEventSameRefund = evt('evt_d_ref2', 'charge.refunded', {
      id: 'ch_unknown1', object: 'charge', amount: 500, amount_refunded: 500, currency: 'usd',
      refunds: { data: [{ id: 're_unknown1', amount: 500, currency: 'usd', status: 'succeeded' }] }
    });
    var replay = await invoke(stripeWebhook, streamReq(newEventSameRefund));
    assert.equal(replay.body.reversal.refunds[0].duplicate, true);
    um = await unmatched();
    assert.equal(um.filter(function (u) { return u.refundId === 're_unknown1'; }).length, 1, 'replay does not re-record the exception');
  });

  // ── (e) dispute.created: recorded with amount/reason/due date, alerted once ──
  await check('(e) dispute.created records amount/reason/due date, alerts once under replay, customer untouched', async function () {
    var sub = { email: 'buyer-e@example.test', domain: 'energy', subscriptionId: 'sub_e1', customerId: 'cus_e1', amountCents: 800 };
    var bought = await invoke(stripeWebhook, streamReq(checkoutSession('evt_e_buy', sub)));
    assert.equal(bought.body.activated, true, JSON.stringify(bought.body));
    // A renewal writes the charge→domain attribution the dispute intake reconciles from.
    var ren = await invoke(stripeWebhook, streamReq(renewalInvoice('evt_e_ren', 'invoice.payment_succeeded',
      { chargeId: 'ch_e1', customerId: 'cus_e1', subscriptionId: 'sub_e1', email: sub.email, amountCents: 800 })));
    assert.equal(ren.status, 200, JSON.stringify(ren.body));

    var dueBy = Math.floor(Date.now() / 1000) + 7 * 86400;
    var dispute = evt('evt_e_dp', 'charge.dispute.created', {
      id: 'dp_e1', object: 'dispute', charge: 'ch_e1', amount: 800, currency: 'usd',
      reason: 'fraudulent', status: 'warning_needs_response',
      evidence_details: { due_by: dueBy, has_evidence: false }
    });
    var r = await invoke(stripeWebhook, streamReq(dispute));
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.dispute.recorded, true);
    assert.equal(r.body.dispute.reason, 'fraudulent');
    assert.equal(r.body.dispute.dueBy, new Date(dueBy * 1000).toISOString(), 'evidence due date recorded');
    assert.equal(r.body.dispute.domain, 'energy', 'attributed to the booking domain');

    var disputes = (await db.get(reversals.DISPUTES_KEY)) || {};
    assert(disputes.dp_e1, 'dispute persisted');
    assert.equal(disputes.dp_e1.amountCents, 800);
    assert.equal(disputes.dp_e1.reason, 'fraudulent');
    assert.equal(disputes.dp_e1.subscriber, 'buyer-e@example.test');

    var da = (await alerts('dispute')).filter(function (a) { return a.disputeId === 'dp_e1'; });
    assert.equal(da.length, 1, 'one operator alert');
    assert.equal(da[0].dueBy, new Date(dueBy * 1000).toISOString());

    // The hold draws on `available`, which is zero before settlement exists: the
    // refusal is expected, named, and logged — the dispute record stands regardless.
    assert.equal(r.body.dispute.treasuryBooked, false);
    assert(String(r.body.dispute.treasuryReason).indexOf('post-failed') === 0, 'named treasury reason, got: ' + r.body.dispute.treasuryReason);
    var unbooked = await treasuryBridge.unbooked(motorStore, 50);
    assert(unbooked.some(function (u) { return u && u.kind === 'DISPUTE_HOLD' && u.disputeId === 'dp_e1'; }), 'the failed hold is on the treasury unbooked log, countable');

    // The customer record is never touched by a dispute.
    var subsLib = require('../lib/subscriptions');
    var who = await subsLib.getStrict('buyer-e@example.test', motorStore);
    assert.equal(who.active, true, 'a dispute is an accusation, not a cancellation');

    var replay = await invoke(stripeWebhook, streamReq(dispute));
    assert.equal(replay.body.duplicate, true);
    assert.equal((await alerts('dispute')).filter(function (a) { return a.disputeId === 'dp_e1'; }).length, 1, 'replay does not re-alert');
  });

  // ── (f) dispute.closed (won): record updated, release attempted, idempotent ──
  await check('(f) dispute.closed won updates the record and attempts the release once', async function () {
    var closed = evt('evt_f_dp', 'charge.dispute.closed', {
      id: 'dp_e1', object: 'dispute', charge: 'ch_e1', amount: 800, currency: 'usd',
      reason: 'fraudulent', status: 'won'
    });
    var r = await invoke(stripeWebhook, streamReq(closed));
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.dispute.recorded, true);
    assert.equal(r.body.dispute.status, 'won');

    var disputes = (await db.get(reversals.DISPUTES_KEY)) || {};
    assert.equal(disputes.dp_e1.status, 'won', 'outcome lands on the same dispute record');
    assert(disputes.dp_e1.dueBy, 'the created-phase record (due date) survives the update');

    // Release draws on the dispute obligation, which is empty because the hold could
    // not post pre-settlement: named refusal, no crash, no fabricated movement.
    assert.equal(r.body.dispute.treasuryBooked, false);
    assert(String(r.body.dispute.treasuryReason).length > 0);

    var ca = (await alerts('dispute-closed')).filter(function (a) { return a.disputeId === 'dp_e1'; });
    assert.equal(ca.length, 1, 'closed alerted once');
    var replay = await invoke(stripeWebhook, streamReq(closed));
    assert.equal(replay.body.duplicate, true);
    assert.equal((await alerts('dispute-closed')).filter(function (a) { return a.disputeId === 'dp_e1'; }).length, 1);
  });

  // ── (g) invoice.paid alias: one renewal charge, one booking across both event types ──
  await check('(g) invoice.paid + invoice.payment_succeeded for one charge = one renewal everywhere', async function () {
    var sub = { email: 'buyer-g@example.test', domain: 'culture', subscriptionId: 'sub_g1', customerId: 'cus_g1', amountCents: 600 };
    var bought = await invoke(stripeWebhook, streamReq(checkoutSession('evt_g_buy', sub)));
    assert.equal(bought.body.activated, true, JSON.stringify(bought.body));
    var aggBefore = (await subRevenue()).revenueCents;
    var cultureBefore = (await accountFor('culture')).pendingCashCents;

    // invoice.paid arrives FIRST (the new endpoint sends it); the alias must book it.
    var paid = await invoke(stripeWebhook, streamReq(renewalInvoice('evt_g_paid', 'invoice.paid',
      { chargeId: 'ch_g1', customerId: 'cus_g1', subscriptionId: 'sub_g1', email: sub.email, amountCents: 600 })));
    assert.equal(paid.status, 200, JSON.stringify(paid.body));
    assert.equal(paid.body.aliasedFrom, 'invoice.paid', 'the alias is explicit in the response');
    assert.equal(paid.body.treasuryBooked, true, JSON.stringify(paid.body));

    // invoice.payment_succeeded for the SAME charge arrives second and books nothing again.
    var succeeded = await invoke(stripeWebhook, streamReq(renewalInvoice('evt_g_succ', 'invoice.payment_succeeded',
      { chargeId: 'ch_g1', customerId: 'cus_g1', subscriptionId: 'sub_g1', email: sub.email, amountCents: 600 })));
    assert.equal(succeeded.status, 200, JSON.stringify(succeeded.body));
    assert.equal(succeeded.body.receiptDuplicate, true, 'the receipt email is claimed per charge, not per event');

    assert.equal((await subRevenue()).revenueCents, aggBefore + 600, 'sales:agg added once across both event types');
    assert.equal((await accountFor('culture')).pendingCashCents, cultureBefore + 600, 'treasury booked once across both event types');

    // Attribution from the renewal lets a later refund of this renewal charge reconcile.
    var refund = evt('evt_g_ref', 'charge.refunded', {
      id: 'ch_g1', object: 'charge', amount: 600, amount_refunded: 600, currency: 'usd',
      customer: 'cus_g1',
      refunds: { data: [{ id: 're_g1', amount: 600, currency: 'usd', status: 'succeeded' }] }
    });
    var rr = await invoke(stripeWebhook, streamReq(refund));
    assert.equal(rr.body.reversal.refunds[0].booked, true, JSON.stringify(rr.body.reversal));
    assert.equal(rr.body.reversal.refunds[0].treasuryBooked, true, 'renewal refund reverses the treasury pending cash');
    assert.equal((await accountFor('culture')).pendingCashCents, cultureBefore, 'renewal money fully reversed');
  });

  // ── (h) a LOST dispute stays explicitly unresolved — no compensating movement ──
  await check('(h) dispute.closed lost: recorded as unresolved, zero compensating entries anywhere', async function () {
    var sub = { email: 'buyer-h@example.test', domain: 'infrastructure', subscriptionId: 'sub_h1', customerId: 'cus_h1', amountCents: 800 };
    var bought = await invoke(stripeWebhook, streamReq(checkoutSession('evt_h_buy', sub)));
    assert.equal(bought.body.activated, true, JSON.stringify(bought.body));
    var ren = await invoke(stripeWebhook, streamReq(renewalInvoice('evt_h_ren', 'invoice.payment_succeeded',
      { chargeId: 'ch_h1', customerId: 'cus_h1', subscriptionId: 'sub_h1', email: sub.email, amountCents: 800 })));
    assert.equal(ren.status, 200, JSON.stringify(ren.body), 'setup: renewal writes the charge attribution');

    var dueBy = Math.floor(Date.now() / 1000) + 7 * 86400;
    var created = await invoke(stripeWebhook, streamReq(evt('evt_h_dp', 'charge.dispute.created', {
      id: 'dp_h1', object: 'dispute', charge: 'ch_h1', amount: 800, currency: 'usd',
      reason: 'product_not_received', status: 'needs_response',
      evidence_details: { due_by: dueBy, has_evidence: true }
    })));
    assert.equal(created.body.dispute.recorded, true, JSON.stringify(created.body));

    var ledgerBefore = await db.lrange('finance:ledger', 0, 4999);
    var aggBefore = (await subRevenue()).revenueCents;
    var treasuryBefore = (await accountFor('infrastructure')).pendingCashCents;

    var closed = evt('evt_h_dp_lost', 'charge.dispute.closed', {
      id: 'dp_h1', object: 'dispute', charge: 'ch_h1', amount: 800, currency: 'usd',
      reason: 'product_not_received', status: 'lost'
    });
    var r = await invoke(stripeWebhook, streamReq(closed));
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.dispute.recorded, true);
    assert.equal(r.body.dispute.status, 'lost');

    var disputes = (await db.get(reversals.DISPUTES_KEY)) || {};
    assert.equal(disputes.dp_h1.status, 'lost', 'the record carries the loss explicitly');
    assert.equal(disputes.dp_h1.reason, 'product_not_received', 'created-phase fields survive');
    assert.equal(disputes.dp_h1.dueBy, new Date(dueBy * 1000).toISOString());
    assert(disputes.dp_h1.createdAt && disputes.dp_h1.createdAt !== disputes.dp_h1.updatedAt,
      'the record shows both phases, not an overwrite');

    /* THE PIN: a lost dispute must never silently generate a compensating transaction.
       The named refusal is the whole story — no treasury call, no ledger reversal, no
       sales:agg adjustment, no entitlement change. */
    assert.equal(r.body.dispute.treasuryBooked, false);
    assert.equal(r.body.dispute.treasuryReason, 'dispute-lost-no-automatic-reversal',
      'the reason names the deliberate non-action, got: ' + r.body.dispute.treasuryReason);

    var ledgerAfter = await db.lrange('finance:ledger', 0, 4999);
    assert.equal(ledgerAfter.length, ledgerBefore.length, 'finance:ledger gained no entry from the loss');
    assert.equal(ledgerAfter.filter(function (e) {
      return e && e.meta && e.meta.reversal === true && e.meta.chargeId === 'ch_h1';
    }).length, 0, 'no reversal entry for the lost charge');
    assert.equal((await subRevenue()).revenueCents, aggBefore, 'sales:agg revenue untouched by the loss');
    assert.equal((await accountFor('infrastructure')).pendingCashCents, treasuryBefore, 'treasury pending untouched by the loss');

    var subsLib = require('../lib/subscriptions');
    var who = await subsLib.getStrict('buyer-h@example.test', motorStore);
    assert.equal(who.active, true, 'the subscriber record is untouched: a dispute never cancels');

    var ca = (await alerts('dispute-closed')).filter(function (a) { return a.disputeId === 'dp_h1'; });
    assert.equal(ca.length, 1, 'the loss is alerted exactly once');
    assert.equal(ca[0].status, 'lost');
    assert.equal(ca[0].treasuryReason, 'dispute-lost-no-automatic-reversal', 'the alert carries the named non-action');

    var replay = await invoke(stripeWebhook, streamReq(closed));
    assert.equal(replay.body.duplicate, true, 'replay dedups at the dispute claim');
    assert.equal((await alerts('dispute-closed')).filter(function (a) { return a.disputeId === 'dp_h1'; }).length, 1,
      'replay does not re-alert');
    assert.equal((await db.lrange('finance:ledger', 0, 4999)).length, ledgerBefore.length,
      'replay still writes nothing');
    assert.equal((await subRevenue()).revenueCents, aggBefore, 'replay still adjusts nothing');
  });

  // ── (i) fail closed: store outage → 500, zero writes, retry books once ────
  await check('(i) a storage outage answers 500 and writes nothing; the retry after recovery reverses once', async function () {
    var book = evt('evt_i_book', 'checkout.session.completed', {
      id: 'cs_i_book', mode: 'payment', payment_intent: 'pi_i1', amount_total: 700,
      currency: 'usd', metadata: { streamId: 'wmc-tips' }
    });
    var booked = await invoke(stripeWebhook, streamReq(book));
    assert.equal(booked.body.income.recorded, true, 'setup: income booked');

    var refund = evt('evt_i_ref', 'charge.refunded', {
      id: 'ch_i1', object: 'charge', payment_intent: 'pi_i1', amount: 700, amount_refunded: 700,
      currency: 'usd', refunds: { data: [{ id: 're_i1', amount: 700, currency: 'usd', status: 'succeeded' }] }
    });
    REDIS_DOWN = true;
    var down = await invoke(stripeWebhook, streamReq(refund));
    assert.equal(down.status, 500, 'an unreadable claim store must fail closed');
    assert.equal((await reversalEntries('re_i1')).length, 0, 'zero reversal writes during the outage');

    REDIS_DOWN = false;
    var up = await invoke(stripeWebhook, streamReq(refund));
    assert.equal(up.status, 200, JSON.stringify(up.body));
    assert.equal(up.body.reversal.refunds[0].booked, true, 'Stripe retry after recovery completes the reversal');
    assert.equal((await reversalEntries('re_i1')).length, 1, 'exactly once: the failed attempt released its claim');
  });

  // ── operator surface: the subscribers admin JSON carries the reversal view ──
  await check('operator summary exposes stats, alerts, unmatched and disputes read-only', async function () {
    var summary = await reversals.operatorSummary();
    assert.equal(summary.ok, true);
    assert(summary.stats.refundsBooked >= 3, 'refund counters move');
    assert(summary.stats.disputesCreated >= 1, 'dispute counters move');
    assert(summary.unmatched.count >= 1, 'unmatched roster readable');
    assert(summary.disputes.total >= 1 && summary.disputes.open >= 0, 'dispute roster readable');
    assert(summary.recentAlerts.length > 0, 'recent alerts readable');
  });

  if (failures) {
    console.error('\n' + failures + ' check(s) failed');
    process.exit(1);
  }
  console.log('\nstripe refund/dispute intake: PASS');
}

main().catch(function (e) { console.error(e); process.exit(1); });
