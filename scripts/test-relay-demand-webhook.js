#!/usr/bin/env node
'use strict';

/**
 * test-relay-demand-webhook.js — payment events must PROVE they came from Stripe.
 *
 * Runs against the REAL lib/stripe-rail verifier (HMAC over the raw body against the
 * STRIPE_WEBHOOK_SECRET family) with limen-db on its in-memory backend — signature
 * verification is the thing whose behaviour matters, so stubbing it would test the
 * mock. Events are signed with a throwaway secret; no network, no real Stripe state.
 *
 * The properties under test, in order of how much damage getting them wrong would do:
 *   1. No secret configured → 503, zero writes (fail closed, never fail open).
 *   2. Missing or invalid signature → 403, zero writes. Nothing unverified mutates.
 *   3. Only checkout.session.completed is accepted; other event types are ignored
 *      without touching storage.
 *   4. Identity comes from the VERIFIED event object, never caller JSON: a decoy
 *      top-level stripeSessionId must not drive the lookup.
 *   5. A verified event pays exactly one order: one ledger entry, one queue entry,
 *      and the order is paid with the event id recorded.
 *   6. Re-delivery of the same event, or a new event for an already-paid order,
 *      changes nothing.
 *   7. An unknown session is a no-op, not an error.
 */

const assert = require('assert');
const crypto = require('node:crypto');

const SAVED = {};
['STRIPE_WEBHOOK_SECRET', 'STRIPE_WEBHOOK_SECRET_SUBS', 'STRIPE_WEBHOOK_SECRET_2',
 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'
].forEach(function (k) { SAVED[k] = process.env[k]; });

function restoreEnv() {
  Object.keys(SAVED).forEach(function (k) {
    if (SAVED[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED[k];
  });
}

const SECRET = 'whsec_demand_test_throwaway';
const ORDER = {
  orderId: 'ord_1001',
  stripeSessionId: 'cs_test_known_session',
  margin: 12.5,
  sourceMarketplace: 'ebay',
  sourceUrl: 'https://example.com/item/1',
  sourceCost: 40,
  shippingAddress: { name: 'Buyer', line1: '1 Main St', city: 'Springfield', state: 'IL', postalCode: '62701', country: 'US' },
  status: 'awaiting-payment'
};

const db = require('../lib/limen-db');
const handler = require('../handlers/relay-demand-webhook.js');

let passed = 0;
function check(label, actual, expected) {
  assert.strictEqual(actual, expected, label);
  passed++;
}

function sign(raw, secret) {
  const t = Math.floor(Date.now() / 1000);
  return 't=' + t + ',v1=' + crypto.createHmac('sha256', secret).update(t + '.' + raw).digest('hex');
}

function event(id, sessionId, type) {
  return JSON.stringify({
    id: id,
    type: type || 'checkout.session.completed',
    data: { object: { id: sessionId, payment_status: 'paid' } }
  });
}

/** The webhook reads its RAW body off the request stream, so the fixture behaves like one. */
function streamReq(raw, headers) {
  return {
    method: 'POST',
    url: '/api/relay-demand-webhook',
    headers: headers || {},
    on: function (ev, cb) {
      if (ev === 'data') cb(Buffer.from(raw));
      if (ev === 'end') cb();
      return this;
    }
  };
}

/** Drive a handler the way Vercel does and capture what it sent. */
function invoke(req) {
  return new Promise(function (resolve) {
    const out = { status: 200, body: null, headers: {} };
    const res = {
      statusCode: 200,
      setHeader: function (k, v) { out.headers[k.toLowerCase()] = v; },
      status: function (c) { out.status = c; this.statusCode = c; return this; },
      json: function (o) { out.body = o; resolve(out); return this; },
      end: function (s) {
        out.status = res.statusCode || out.status;
        try { out.body = s ? JSON.parse(s) : null; } catch (e) { out.body = s; }
        resolve(out);
      }
    };
    Promise.resolve(handler(req, res)).catch(function (e) {
      out.status = 500; out.body = { error: e.message }; resolve(out);
    });
  });
}

async function ledgerLen() { return ((await db.get('relay:finance-ledger')) || []).length; }
async function queueLen() { return ((await db.get('relay:purchase-queue')) || []).length; }
async function orders() { return ((await db.get('relay:orders')) || []); }
async function seenLen() { return ((await db.get('relay:demand:events:seen:v1')) || []).length; }

async function assertNoWrites(label, expectedOrders) {
  const os = await orders();
  check(label + ': orders untouched', JSON.stringify(os), JSON.stringify(expectedOrders || []));
  check(label + ': no ledger entry', await ledgerLen(), 0);
  check(label + ': no queue entry', await queueLen(), 0);
  check(label + ': nothing marked seen', await seenLen(), 0);
}

async function main() {
  console.log('backend:', db.getBackend());
  delete process.env.STRIPE_WEBHOOK_SECRET_SUBS;
  delete process.env.STRIPE_WEBHOOK_SECRET_2;
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;

  const RAW = event('evt_1', ORDER.stripeSessionId);

  // ── 1. no secret configured: fail closed ───────────────────────────────────
  delete process.env.STRIPE_WEBHOOK_SECRET;
  let r = await invoke(streamReq(RAW, { 'stripe-signature': sign(RAW, SECRET) }));
  check('unconfigured webhook refuses (status)', r.status, 503);
  await assertNoWrites('unconfigured');
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;

  // ── 2. missing / invalid signature: refuse before anything is read ─────────
  r = await invoke(streamReq(RAW, {}));
  check('missing signature refuses (status)', r.status, 403);
  await assertNoWrites('missing signature');

  r = await invoke(streamReq(RAW, { 'stripe-signature': 't=1,v1=deadbeef' }));
  check('invalid signature refuses (status)', r.status, 403);
  await assertNoWrites('invalid signature');

  r = await invoke(streamReq(RAW, { 'stripe-signature': sign(RAW, 'whsec_some_other_secret') }));
  check('wrong-secret signature refuses (status)', r.status, 403);
  await assertNoWrites('wrong-secret signature');

  // ── 3. wrong event type: acknowledged, ignored, no writes ──────────────────
  const chargeRaw = event('evt_ignored', 'ch_test_1', 'charge.succeeded');
  r = await invoke(streamReq(chargeRaw, { 'stripe-signature': sign(chargeRaw, SECRET) }));
  check('wrong event type acknowledged (status)', r.status, 200);
  check('wrong event type ignored', r.body.ignored, 'charge.succeeded');
  await assertNoWrites('wrong event type');

  // ── seed one awaiting order ────────────────────────────────────────────────
  await db.set('relay:orders', [ORDER]);

  // ── 4. identity from the verified event, not caller JSON ───────────────────
  const decoyRaw = JSON.stringify({
    id: 'evt_2', type: 'checkout.session.completed', stripeSessionId: 'cs_test_decoy_never_ordered',
    data: { object: { id: ORDER.stripeSessionId, payment_status: 'paid' } }
  });
  r = await invoke(streamReq(decoyRaw, { 'stripe-signature': sign(decoyRaw, SECRET) }));
  check('verified event pays the order (status)', r.status, 200);
  check('verified event pays the session order', r.body.orderId, 'ord_1001');
  let os = await orders();
  check('order is paid', os[0].status, 'paid');
  check('order carries the verified event id', os[0].stripeEventId, 'evt_2');
  let ledger = await db.get('relay:finance-ledger');
  check('exactly one ledger entry so far', ledger.length, 1);
  check('decoy session id appears nowhere',
    (JSON.stringify(ledger) + JSON.stringify(await db.get('relay:purchase-queue'))).indexOf('decoy') === -1, true);
  check('ledger entry names the real order', ledger[0].orderId, 'ord_1001');

  // ── 5. exactly one ledger entry and one queue entry ────────────────────────
  check('exactly one ledger entry', ledger.length, 1);
  const queue = await db.get('relay:purchase-queue');
  check('exactly one queue entry', queue.length, 1);
  check('queue entry pending_auto_buy', queue[0].status, 'pending_auto_buy');
  check('ledger is the reconciliation artifact (margin, event id)', ledger[0].stripeEventId, 'evt_2');
  check('event marked seen', await seenLen(), 1);

  // ── 6. re-delivery changes nothing; neither does a new event, same session ─
  r = await invoke(streamReq(decoyRaw, { 'stripe-signature': sign(decoyRaw, SECRET) }));
  check('duplicate delivery acknowledged (status)', r.status, 200);
  check('duplicate flagged', r.body.duplicate, true);
  check('duplicate adds no ledger entry', await ledgerLen(), 1);
  check('duplicate adds no queue entry', await queueLen(), 1);

  const againRaw = event('evt_3', ORDER.stripeSessionId);
  r = await invoke(streamReq(againRaw, { 'stripe-signature': sign(againRaw, SECRET) }));
  check('new event for paid order acknowledged (status)', r.status, 200);
  check('already-paid flagged', r.body.alreadyPaid, true);
  check('already-paid adds no ledger entry', await ledgerLen(), 1);
  check('already-paid adds no queue entry', await queueLen(), 1);
  check('only the first event is marked seen', await seenLen(), 1);

  // ── 7. unknown session: no-op, not an error ────────────────────────────────
  const unknownRaw = event('evt_4', 'cs_test_never_heard_of');
  r = await invoke(streamReq(unknownRaw, { 'stripe-signature': sign(unknownRaw, SECRET) }));
  check('unknown session acknowledged (status)', r.status, 200);
  check('unknown session is a no-op', r.body.orderId === undefined, true);
  check('unknown session adds no ledger entry', await ledgerLen(), 1);
  check('unknown session adds no queue entry', await queueLen(), 1);

  // ── method guard ───────────────────────────────────────────────────────────
  r = await invoke({ method: 'GET', url: '/api/relay-demand-webhook', headers: {}, on: function () { return this; } });
  check('GET refuses (status)', r.status, 405);

  console.log(passed + '/' + passed + ' passed');
}

main().then(function () {
  restoreEnv();
}).catch(function (e) {
  restoreEnv();
  console.error(e && e.stack || e);
  process.exit(1);
});
