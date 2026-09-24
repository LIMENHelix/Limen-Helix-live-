#!/usr/bin/env node
'use strict';

/**
 * test-subscriber-silence-watchdog.js — PR-007 invariant tests.
 *
 * A paying subscriber who receives nothing must become an operator-visible
 * exception, never silent churn:
 *   (a) the digest's nothing-to-say skip path records per-domain delivery health
 *       (silentSkips, activeCount) to subs:delivery-health:v1
 *   (b) the existing domain-subscriber-outcome-observer cron raises exactly one
 *       exception into subs:silence-exceptions:v1 for a silent domain with an
 *       active subscriber — and a second pass the same day dedups on domain+day
 *   (c) a delivery records lastDelivered and auto-clears the open exception
 *   (d) a store outage records an explicit 'unknown' health state and raises NO
 *       exception: an unreadable store is not silence
 *   (e) SUBSCRIBER_SILENCE_DAYS is the operator-tunable threshold (default 7)
 *
 * Same fake-but-faithful Upstash harness as test-stripe-refund-dispute-intake.js
 * so the strict-store paths are the ones under test, not process-memory fallbacks.
 */

var assert = require('node:assert/strict');

process.env.UPSTASH_REDIS_REST_URL = 'https://fake-upstash.pr007.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'pr007-token';
process.env.CRON_SECRET = 'pr007-cron-secret';
process.env.ADMIN_MASTER = 'pr007-admin-key';
// The digest's domain-wide live reads (THE TWENTY #1) fetch the site's own API.
// Point that at a dead port so the nothing-to-say premise is hermetic instead of
// depending on whether the live site happens to answer in CI.
process.env.PUBLIC_SITE_URL = 'http://127.0.0.1:9';

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
  if (String(url).indexOf('fake-upstash.pr007.test') !== -1) {
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
var motorStore = require('../lib/autofire-efference-store');
var subs = require('../lib/subscriptions');
var watchdog = require('../lib/subscriber-delivery-health');
var DigestHandler = require('../handlers/subscriber-digest');
var SharedObserver = require('../handlers/domain-subscriber-outcome-observer');

var NOW = Date.now();
var DAY = 86400000;

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

function cronReq(query) {
  return { method: 'GET', query: query || {},
    headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } };
}

async function seedSubscriber(email, domain, sinceMs) {
  var map = (await motorStore.get('subs:v1')) || {};
  map[email] = {
    email: email, domain: domain, rung: 'p1', offer: domain + ' Watch',
    priceCents: 400, subscriptionId: 'sub_' + domain, customerId: 'cus_' + domain,
    active: true, since: new Date(sinceMs).toISOString(), activatedAt: new Date(sinceMs).toISOString(),
    lastSentAt: null, lastSentKey: null
  };
  await motorStore.set('subs:v1', map);
}

async function exceptions() {
  return (await db.get(watchdog.EXCEPTIONS_KEY)) || {};
}
async function health() {
  return (await db.get(watchdog.HEALTH_KEY)) || {};
}

var failures = 0;
function check(name, fn) {
  return Promise.resolve().then(fn).then(
    function () { console.log('  pass: ' + name); },
    function (e) { failures++; console.error('  FAIL: ' + name + ' — ' + (e && e.stack || e)); }
  );
}

async function main() {
  console.log('subscriber silence watchdog (PR-007)');

  // ── (a) nothing-to-say skip records per-domain delivery health ────────────
  await check('(a) a real digest run with nothing to say records silent health for the domain', async function () {
    await seedSubscriber('culture@example.test', 'culture', NOW - 10 * DAY);

    var r = await invoke(DigestHandler, cronReq({}));
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.ok, true, JSON.stringify(r.body));
    var row = (r.body.results || []).find(function (x) { return x.domain === 'culture'; });
    assert(row, 'the culture subscriber was evaluated');
    assert.equal(row.action, 'nothing-to-say', 'no fresh artifact: the silent skip path, got ' + row.action);

    assert(r.body.deliveryHealth && r.body.deliveryHealth.length === 1, 'the run reports its health write');
    assert.equal(r.body.deliveryHealth[0].domain, 'culture');
    assert.equal(r.body.deliveryHealth[0].ok, true);

    var h = await health();
    assert(h.culture, 'health entry written on the skip path, not only on deliveries');
    assert.equal(h.culture.state, 'silent');
    assert.equal(h.culture.silentSkips, 1);
    assert.equal(h.culture.activeCount, 1);
    assert.equal(h.culture.lastDelivered, null, 'no actual send yet');
  });

  // ── (b) observer pass raises exactly one exception, deduped per day ────────
  await check('(b) the existing observer cron raises one exception for the silent domain; a second pass dedups', async function () {
    var cycle = await SharedObserver.run({ store: motorStore, now: NOW, domains: [] });
    assert.equal(cycle.ok, true);
    assert(cycle.silence, 'the observer cycle carries the silence pass');
    assert.equal(cycle.silence.status, 'OBSERVED', JSON.stringify(cycle.silence));
    assert.deepEqual(cycle.silence.raised, ['culture']);
    assert.equal(cycle.silence.open, 1);

    var exc = await exceptions();
    var key = 'culture:' + watchdog.dayKey(NOW);
    assert(exc[key], 'exception keyed by domain+day');
    assert.equal(exc[key].status, 'open');
    assert.equal(exc[key].activeCount, 1);
    assert.equal(exc[key].silenceDays, 7, 'default threshold');
    assert.equal(exc[key].lastDelivered, null);
    assert.equal(exc[key].reason, 'no-delivery-in-7-days');

    var again = await SharedObserver.run({ store: motorStore, now: NOW + 3600000, domains: [] });
    assert.equal(again.silence.raised.length, 0, 'same domain+day never re-raises');
    assert.equal(again.silence.open, 1);
    assert.equal(Object.keys(await exceptions()).length, 1, 'one exception per domain per day, never spam');
  });

  // ── (c) delivery resumption records lastDelivered and auto-clears ─────────
  await check('(c) a delivery advances lastDelivered and clears the open exception', async function () {
    var wr = await watchdog.recordRun('culture', { delivered: 1, silent: 0, activeCount: 1, now: NOW + 7200000 });
    assert.equal(wr.ok, true);
    assert.equal(wr.clearedExceptions.length, 1, 'the open exception auto-clears on resumption');

    var h = await health();
    assert.equal(h.culture.state, 'delivered');
    assert(h.culture.lastDelivered, 'timestamp of the last actual send recorded');
    assert.equal(h.culture.silentSkips, 1, 'the skip count is cumulative history, not erased');

    var exc = await exceptions();
    var key = 'culture:' + watchdog.dayKey(NOW);
    assert.equal(exc[key].status, 'cleared');
    assert.equal(exc[key].clearedReason, 'delivery-resumed');
    assert(exc[key].clearedAt);

    var cycle = await SharedObserver.run({ store: motorStore, now: NOW + 7300000, domains: [] });
    assert.equal(cycle.silence.open, 0, 'no open exception once the domain is served');
    assert.equal(cycle.silence.raised.length, 0, 'a served domain raises nothing');
  });

  // ── (d) store outage: explicit unknown, zero false exceptions ─────────────
  await check('(d) a store outage records unknown and raises nothing', async function () {
    await seedSubscriber('medicine@example.test', 'medicine', NOW - 30 * DAY);
    var before = Object.keys(await exceptions()).length;

    REDIS_DOWN = true;
    var cycle = await SharedObserver.run({ store: motorStore, now: NOW + 7400000, domains: [] });

    assert(cycle.silence, 'the pass reports even when it cannot evaluate');
    assert.equal(cycle.silence.status, 'UNKNOWN');
    assert(cycle.silence.reason.indexOf('unreachable') !== -1, 'named reason: ' + cycle.silence.reason);
    assert.equal(cycle.silence.open, null, 'no count is claimed during an outage');
    assert.equal(Object.keys(await exceptions()).length, before, 'a store outage mints no false exceptions');

    // The explicit unknown state is recorded in the only place reachable during the
    // outage (the warm process store); the payload above is the durable signal.
    var summaryDown = await watchdog.operatorSummary();
    assert.equal(summaryDown.health.culture.state, 'unknown', 'known domains flip to the explicit unknown state');
    assert(summaryDown.observer && summaryDown.observer.state === 'unknown', 'the observer outage marker is recorded');
    assert(summaryDown.observer.reason.indexOf('unreachable') !== -1);
    REDIS_DOWN = false;

    // After recovery the genuinely silent domain (never delivered, subscribed 30d
    // ago) is caught by the subscriber-since anchor — the next pass, per spec retries.
    var recovered = await SharedObserver.run({ store: motorStore, now: NOW + 7500000, domains: [] });
    assert.equal(recovered.silence.status, 'OBSERVED');
    assert(recovered.silence.raised.indexOf('medicine') !== -1,
      'a never-delivered domain with an old subscriber is silence, raised: ' + JSON.stringify(recovered.silence.raised));
    assert(recovered.silence.raised.indexOf('culture') === -1, 'the served domain stays quiet');
  });

  // ── (e) threshold is an operator decision via SUBSCRIBER_SILENCE_DAYS ──────
  await check('(e) SUBSCRIBER_SILENCE_DAYS tunes the threshold, default 7', async function () {
    assert.equal(watchdog.silenceDays({}), 7);
    assert.equal(watchdog.silenceDays({ SUBSCRIBER_SILENCE_DAYS: '3' }), 3);
    assert.equal(watchdog.silenceDays({ SUBSCRIBER_SILENCE_DAYS: '0' }), 7, 'invalid values fall back to the default');

    // A fresh subscriber (2 days) is NOT silent under the default, but IS under 1 day.
    await seedSubscriber('trade@example.test', 'trade', NOW - 2 * DAY);
    var fresh = await watchdog.check({ store: motorStore, now: NOW + 7600000 });
    assert(fresh.raised.indexOf('trade') === -1, 'two days unserved is inside the default window');

    var strict = await watchdog.check({ store: motorStore, now: NOW + 7600000, env: { SUBSCRIBER_SILENCE_DAYS: '1' } });
    assert(strict.raised.indexOf('trade') !== -1, 'the env threshold is honored');
  });

  // ── operator surface: both stores readable, fail-soft ──────────────────────
  await check('operator summary exposes health and exceptions read-only', async function () {
    var summary = await watchdog.operatorSummary();
    assert.equal(summary.ok, true);
    assert.equal(summary.silenceDays, 7);
    assert(summary.health.culture, 'per-domain health readable');
    assert(summary.exceptions.total >= 2, 'raised exceptions readable');
    assert(summary.exceptions.open >= 1, 'open count readable');
    assert(summary.exceptions.recent.length > 0);
  });

  if (failures) {
    console.error('\n' + failures + ' check(s) failed');
    process.exit(1);
  }
  console.log('\nsubscriber silence watchdog: PASS');
}

main().catch(function (e) { console.error(e); process.exit(1); });
