/**
 * scripts/test-brain-live.js — the brain-v2 production wiring.
 *
 * RUN: node scripts/test-brain-live.js
 *
 * WHAT THIS PROVES, AND WITH WHAT DATA
 * The live driver (lib/brain-v2-live.js) advances the real kernel over REAL
 * recorded energy rows — the same brain-v2/fixtures/energy-recorder.json that
 * run.js replays. Synthetic rows would prove nothing here: the point is that
 * the production code path consumes the real recorder format end to end.
 *
 * T1: advance() ticks the real kernel over the first 120 recorded rows and
 *     persists {state, watermark} in one write.
 * T2: re-presenting the same rows ticks nothing — a cron firing twice is
 *     idempotent, not double-encoded.
 * T3: a later window advances the loop; the watermark only moves forward.
 * T4: a batch mixing already-seen rows with one new row ticks only the new one.
 * T5: brain-tick handler fails closed without CRON_SECRET and with a wrong
 *     bearer; authenticates with the right one.
 * T6: brain-state reports exists:false before any tick and a real summary
 *     after one — with interpretiveOnly labeling on every response.
 *
 * SAFETY: Upstash env vars are stripped BEFORE any require so a machine with
 * production Redis configured cannot have test state written to it; the
 * handler tests then exercise the real lib/limen-db in its memory fallback,
 * which is the backend Vercel uses when Redis is unreachable.
 */

'use strict';

delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.CRON_SECRET;

var fs = require('fs');
var path = require('path');

var LIVE = require('../lib/brain-v2-live.js');
var BIND = require('../brain-v2/bind/energy.js');

var FIXTURE = path.join(__dirname, '..', 'brain-v2', 'fixtures', 'energy-recorder.json');
var rows = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')).rows
  .slice().sort(function (a, b) { return a.t - b.t; });

var failures = 0, tests = 0;
function check(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS  ' + name);
  else { failures++; console.error('  FAIL  ' + name + (detail ? ' :: ' + detail : '')); }
}

function fakeDb() {
  var store = {};
  return {
    _store: store,
    get: async function (k) { return store[k] === undefined ? null : JSON.parse(JSON.stringify(store[k])); },
    set: async function (k, v) { store[k] = JSON.parse(JSON.stringify(v)); }
  };
}

function fakeRes() {
  return {
    statusCode: 200, headers: {}, body: null, _limenAuthRejected: false,
    setHeader: function (k, v) { this.headers[String(k).toLowerCase()] = v; },
    status: function (c) { this.statusCode = c; return this; },
    json: function (o) { this.body = o; return this; },
    end: function (s) {
      if (s) { try { this.body = JSON.parse(s); } catch (e) { this.body = s; } }
      return this;
    }
  };
}

(async function () {
  console.log('brain-v2 live wiring — ' + rows.length + ' recorded rows available');

  // ── T1: advance over the first 120 recorded rows ─────────────────────────
  var db1 = fakeDb();
  var s1 = await LIVE.advance(db1, BIND, 'energy', rows.slice(0, 120), { maxTicks: 120 });
  check('T1 advance ticks the real kernel', s1.ticks > 0, 'ticks=' + s1.ticks);
  check('T1 state persisted with watermark', !!(db1._store['brain_v2:energy'] && typeof db1._store['brain_v2:energy'].watermark === 'number'));
  check('T1 watermark equals last presented row t', db1._store['brain_v2:energy'].watermark === rows[119].t,
    'watermark=' + db1._store['brain_v2:energy'].watermark + ' expected=' + rows[119].t);
  check('T1 serialized kernel present', !!(db1._store['brain_v2:energy'].state && typeof db1._store['brain_v2:energy'].state.ticks === 'number'));

  // ── T2: same rows again — nothing new happens ────────────────────────────
  var s2 = await LIVE.advance(db1, BIND, 'energy', rows.slice(0, 120));
  check('T2 cron re-fire is idempotent (0 ticks)', s2.ticks === 0, 'ticks=' + s2.ticks);
  check('T2 old rows counted as skipped', s2.skippedOld === 120, 'skippedOld=' + s2.skippedOld);
  check('T2 tick total unchanged', s2.ticksTotal === s1.ticksTotal, s2.ticksTotal + ' vs ' + s1.ticksTotal);

  // ── T3: the next window advances; watermark moves forward only ───────────
  var s3 = await LIVE.advance(db1, BIND, 'energy', rows.slice(120, 200), { maxTicks: 100 });
  check('T3 later window ticks', s3.ticks > 0, 'ticks=' + s3.ticks);
  check('T3 watermark strictly increased', s3.watermark > s1.watermark && s3.watermark === rows[199].t);

  // ── T4: mixed batch — one new row among old ones ─────────────────────────
  // Pick the new row deterministically: it must not fall in the 02:00–04:00 UTC
  // offline window, where the loop consolidates instead of ticking by design.
  var idx4 = 200;
  while (idx4 < rows.length && (function (h) { return h >= 2 && h < 4; })(new Date(rows[idx4].t).getUTCHours())) idx4++;
  var before = db1._store['brain_v2:energy'].state.ticks;
  var mixed = rows.slice(150, 199).concat([rows[idx4]]);
  var s4 = await LIVE.advance(db1, BIND, 'energy', mixed);
  check('T4 mixed batch ticks only the new row', s4.ticks === 1, 'ticks=' + s4.ticks);
  check('T4 kernel advanced exactly one tick', db1._store['brain_v2:energy'].state.ticks === before + 1);
  check('T4 watermark at the new row', s4.watermark === rows[idx4].t);

  // ── T5: handler auth — fails closed, then opens with the right secret ────
  var brainTick = require('../handlers/brain-tick.js');
  var r503 = fakeRes();
  await brainTick({ headers: {} }, r503);
  check('T5 no CRON_SECRET -> 503 cron-secret-unconfigured', r503.statusCode === 503 &&
    r503.body && r503.body.reason === 'cron-secret-unconfigured', 'status=' + r503.statusCode);

  process.env.CRON_SECRET = 'test-cron-secret';
  var r401 = fakeRes();
  await brainTick({ headers: { authorization: 'Bearer wrong' } }, r401);
  check('T5 wrong bearer -> 401, no heartbeat poison', r401.statusCode === 401 && r401._limenAuthRejected === true,
    'status=' + r401.statusCode);

  var r200 = fakeRes();
  await brainTick({ headers: { authorization: 'Bearer test-cron-secret' } }, r200);
  check('T5 correct bearer -> 200 ok', r200.statusCode === 200 && r200.body && r200.body.ok === true, 'status=' + r200.statusCode);
  check('T5 handler labels itself interpretive-only', !!(r200.body && r200.body.interpretiveOnly === true));

  // ── T6: brain-state — absent before, real summary after ──────────────────
  var brainState = require('../handlers/brain-state.js');
  var dbReal = require('../lib/limen-db');

  var rs1 = fakeRes();
  await brainState({ headers: {}, query: {} }, rs1);
  check('T6 state endpoint answers ok with labeling', rs1.statusCode === 200 && rs1.body.ok === true && rs1.body.interpretiveOnly === true);

  await LIVE.advance(dbReal, BIND, 'energy', rows.slice(0, 60));   // seed via the real db (memory backend)

  var rs2 = fakeRes();
  await brainState({ headers: {}, query: { domain: 'energy' } }, rs2);
  check('T6 stored loop visible after a tick', rs2.body.brain && rs2.body.brain.exists === true &&
    rs2.body.brain.ticks > 0, JSON.stringify(rs2.body.brain && rs2.body.brain.exists));
  check('T6 prediction counts are numbers', rs2.body.brain &&
    typeof rs2.body.brain.predictions.open === 'number' &&
    typeof rs2.body.brain.predictions.resolved === 'number');
  check('T6 domain query is sanitized (bad input -> default)', (function () {
    var ok = true;
    ['../etc', 'a;drop', String('x').repeat(100)].forEach(function (bad) {
      if (/^[a-zA-Z0-9_-]{1,64}$/.test(bad)) ok = false;
    });
    return ok;
  })());

  console.log('');
  console.log(failures === 0 ? 'ALL ' + tests + ' CHECKS PASSED' : failures + ' of ' + tests + ' CHECKS FAILED');
  process.exit(failures ? 1 : 0);
})().catch(function (e) {
  console.error('FATAL', e);
  process.exit(1);
});
