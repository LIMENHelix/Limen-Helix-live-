#!/usr/bin/env node
'use strict';

/**
 * test-relay-demand-webhook.js — the legacy relay-demand webhook is a write-free stub.
 *
 * Runs against the REAL lib/relay-finance-bridge verifier (HMAC over the raw body against
 * the STRIPE_WEBHOOK_SECRET family) with limen-db on its in-memory backend — signature
 * verification is the thing whose behaviour matters, so stubbing it would test the mock.
 * Events are signed with a throwaway secret; no network, no real Stripe state.
 *
 * WHY RETIRED. The previous handler wrote `relay:orders` (the Trade domain's shared
 * marketplace store — off-limits to Relay; Relay's own orders live under
 * `relay:store:orders`), `relay:finance-ledger`, `relay:purchase-queue`, and a seen-list.
 * Real payment reconciliation already exists: lib/relay-engine.js polls
 * relay-finance-bridge.paymentStatus(), requiring payment_status 'paid' AND status
 * 'complete'. This endpoint keeps its Stripe route registration (dashboard endpoint
 * removal is unverified; 404s invite retry storms) and mutates NOTHING.
 *
 * The properties under test, in order of how much damage getting them wrong would do:
 *   1. No secret configured → 503. Missing or invalid signature → 403. Fail closed.
 *   2. A verified event of ANY type — checkout.session.completed paid or unpaid,
 *      async_payment_succeeded, anything — → 200 acknowledging retirement.
 *   3. ZERO writes in every case: relay:orders, relay:store:orders,
 *      relay:finance-ledger, relay:purchase-queue and the retired seen-list are all
 *      deep-equal to their seeded state afterwards, and no db.set call occurs while
 *      the handler runs.
 *   4. Repeated delivery of the same event changes nothing.
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

const SEED_ORDERS_SHARED = [{ id: 'ord_shared', stripeSessionId: 'cs_test_known_session', status: 'awaiting-payment' }];
const SEED_ORDERS_STORE = { ord_store: { id: 'ord_store', status: 'awaiting-payment' } };
const SEED_LEDGER = [{ ts: '2026-01-01T00:00:00Z', type: 'margin', orderId: 'ord_prior', amount: 1 }];
const SEED_QUEUE = [{ ts: '2026-01-01T00:00:00Z', orderId: 'ord_prior', status: 'pending_auto_buy' }];
const SEED_SEEN = ['evt_prior'];

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

function event(id, sessionId, type, paymentStatus) {
  return JSON.stringify({
    id: id,
    type: type || 'checkout.session.completed',
    data: { object: { id: sessionId, payment_status: paymentStatus || 'paid' } }
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

async function seed() {
  await db.set('relay:orders', JSON.parse(JSON.stringify(SEED_ORDERS_SHARED)));
  await db.set('relay:store:orders', JSON.parse(JSON.stringify(SEED_ORDERS_STORE)));
  await db.set('relay:finance-ledger', JSON.parse(JSON.stringify(SEED_LEDGER)));
  await db.set('relay:purchase-queue', JSON.parse(JSON.stringify(SEED_QUEUE)));
  await db.set('relay:demand:events:seen:v1', JSON.parse(JSON.stringify(SEED_SEEN)));
}

/** Every protected key is deep-equal to its seed, and zero db.set ran during the invoke. */
async function assertNoWrites(label, setCalls) {
  check(label + ': zero db.set calls during invoke', setCalls, 0);
  check(label + ': relay:orders untouched',
    JSON.stringify(await db.get('relay:orders')), JSON.stringify(SEED_ORDERS_SHARED));
  check(label + ': relay:store:orders untouched',
    JSON.stringify(await db.get('relay:store:orders')), JSON.stringify(SEED_ORDERS_STORE));
  check(label + ': relay:finance-ledger untouched',
    JSON.stringify(await db.get('relay:finance-ledger')), JSON.stringify(SEED_LEDGER));
  check(label + ': relay:purchase-queue untouched',
    JSON.stringify(await db.get('relay:purchase-queue')), JSON.stringify(SEED_QUEUE));
  check(label + ': retired seen-list untouched',
    JSON.stringify(await db.get('relay:demand:events:seen:v1')), JSON.stringify(SEED_SEEN));
}

/** Invoke with a db.set counter wrapped around it, so zero writes is measured, not assumed. */
async function invokeCounted(req) {
  let sets = 0;
  const realSet = db.set;
  db.set = async function () { sets++; return realSet.apply(db, arguments); };
  try {
    const out = await invoke(req);
    return { out: out, sets: sets };
  } finally {
    db.set = realSet;
  }
}

async function main() {
  console.log('backend:', db.getBackend());
  delete process.env.STRIPE_WEBHOOK_SECRET_SUBS;
  delete process.env.STRIPE_WEBHOOK_SECRET_2;

  await seed();

  // ── 1. no secret configured: fail closed ───────────────────────────────────
  delete process.env.STRIPE_WEBHOOK_SECRET;
  const RAW = event('evt_1', 'cs_test_known_session');
  let r = await invokeCounted(streamReq(RAW, { 'stripe-signature': sign(RAW, SECRET) }));
  check('unconfigured webhook refuses (status)', r.out.status, 503);
  await assertNoWrites('unconfigured', r.sets);
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;

  // ── 2. missing / invalid signature: refuse before anything is parsed ───────
  r = await invokeCounted(streamReq(RAW, {}));
  check('missing signature refuses (status)', r.out.status, 403);
  await assertNoWrites('missing signature', r.sets);

  r = await invokeCounted(streamReq(RAW, { 'stripe-signature': 't=1,v1=deadbeef' }));
  check('invalid signature refuses (status)', r.out.status, 403);
  await assertNoWrites('invalid signature', r.sets);

  r = await invokeCounted(streamReq(RAW, { 'stripe-signature': sign(RAW, 'whsec_some_other_secret') }));
  check('wrong-secret signature refuses (status)', r.out.status, 403);
  await assertNoWrites('wrong-secret signature', r.sets);

  // ── 3. verified checkout.session.completed, paid: acknowledged, ignored ────
  r = await invokeCounted(streamReq(RAW, { 'stripe-signature': sign(RAW, SECRET) }));
  check('verified paid session acknowledged (status)', r.out.status, 200);
  check('response marks the endpoint retired', r.out.body.retired, true);
  check('response states nothing was mutated', r.out.body.mutated, false);
  await assertNoWrites('verified paid session', r.sets);

  // ── 4. verified checkout.session.completed, UNPAID: same, still no writes ──
  const unpaidRaw = event('evt_2', 'cs_test_known_session', 'checkout.session.completed', 'unpaid');
  r = await invokeCounted(streamReq(unpaidRaw, { 'stripe-signature': sign(unpaidRaw, SECRET) }));
  check('verified unpaid session acknowledged (status)', r.out.status, 200);
  check('unpaid response also retired', r.out.body.retired, true);
  await assertNoWrites('verified unpaid session', r.sets);

  // ── 5. verified async_payment_succeeded: acknowledged, ignored ─────────────
  const asyncRaw = event('evt_3', 'cs_test_known_session', 'async_payment_succeeded', 'paid');
  r = await invokeCounted(streamReq(asyncRaw, { 'stripe-signature': sign(asyncRaw, SECRET) }));
  check('async_payment_succeeded acknowledged (status)', r.out.status, 200);
  await assertNoWrites('async_payment_succeeded', r.sets);

  // ── 6. unrelated event type: acknowledged, ignored ─────────────────────────
  const chargeRaw = event('evt_4', 'ch_test_1', 'charge.succeeded');
  r = await invokeCounted(streamReq(chargeRaw, { 'stripe-signature': sign(chargeRaw, SECRET) }));
  check('unrelated event type acknowledged (status)', r.out.status, 200);
  await assertNoWrites('unrelated event type', r.sets);

  // ── 7. repeated delivery of the same event: nothing changes ────────────────
  r = await invokeCounted(streamReq(RAW, { 'stripe-signature': sign(RAW, SECRET) }));
  check('repeated event acknowledged (status)', r.out.status, 200);
  await assertNoWrites('repeated event', r.sets);

  // ── method guard ───────────────────────────────────────────────────────────
  r = await invoke({ method: 'GET', url: '/api/relay-demand-webhook', headers: {}, on: function () { return this; } });
  check('GET refuses (status)', r.status, 405);

  // ── structural pin: the handler carries no store coupling at all ───────────
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'handlers', 'relay-demand-webhook.js'), 'utf8');
  check('handler does not import limen-db', src.indexOf("require('../lib/limen-db')"), -1);
  check('handler names no shared store key', src.indexOf("'relay:orders'"), -1);
  check('handler names no Relay store key', src.indexOf("'relay:store:orders'"), -1);
  check('handler names no finance ledger key', src.indexOf("'relay:finance-ledger'"), -1);
  check('handler names no purchase queue key', src.indexOf("'relay:purchase-queue'"), -1);
  check('handler names no seen-list key', src.indexOf("'relay:demand:events:seen:v1'"), -1);

  console.log(passed + '/' + passed + ' passed');
}

main().then(function () {
  restoreEnv();
}).catch(function (e) {
  restoreEnv();
  console.error(e && e.stack || e);
  process.exit(1);
});
