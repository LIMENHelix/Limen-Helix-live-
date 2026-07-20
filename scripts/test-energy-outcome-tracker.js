/**
 * scripts/test-energy-outcome-tracker.js — proves lib/energy-outcome-tracker.js. OFFLINE.
 * Run: node scripts/test-energy-outcome-tracker.js
 */

var T = require('../lib/energy-outcome-tracker.js');

var pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) { pass++; console.log('  PASS  ' + name); } else { fail++; console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : '')); } }
function section(t) { console.log('\n' + t); }

var DAY = 24 * 3600 * 1000;
function spike(p) { var v = new Array(11); for (var i = 0; i < 11; i++) v[i] = 0.01; v[p] = 0.9; return v; }
function est(p) { return { belief: spike(p), stuck: 0.3 }; }

// ── 1. Recording cadence: at most once per day ────────────────────────────────────────────────────
section('1. Records at most once per RECORD_INTERVAL (daily), not every call');
var s = null;
var r1 = T.tick(s, 0, { v: 70 }, est(4), [{ key: 'm', value: 0.2, likelihood: spike(4) }]);
ok('first tick with a price+est records', r1.recorded === true);
var r2 = T.tick(r1.state, 1000, { v: 70.1 }, est(4), [{ key: 'm', value: 0.2, likelihood: spike(4) }]);
ok('a call 1 second later does NOT record again', r2.recorded === false && r2.state.prices.length === 1);
var r3 = T.tick(r2.state, T.RECORD_INTERVAL_MS + 1, { v: 71 }, est(4), [{ key: 'm', value: 0.2, likelihood: spike(4) }]);
ok('a call a full interval later DOES record', r3.recorded === true && r3.state.prices.length === 2);

// ── 2. No price/est => never records (never fabricate) ────────────────────────────────────────────
section('2. Missing price or estimator result => no record, no throw');
ok('null priceReading => no record', T.tick(null, 0, null, est(4), []).recorded === false);
ok('missing est => no record', T.tick(null, 0, { v: 70 }, null, []).recorded === false);
ok('cold start (state=null) does not throw', (function () { try { T.tick(null, 0, { v: 70 }, est(4), []); return true; } catch (e) { return false; } })());

// ── 3. Abstain until a forecast ages past the horizon (data-starved by construction) ───────────────
section('3. ABSTAINS (estimatorHitRate null) until a real forecast has aged past the horizon');
var st = null, t0 = 0;
// build up HORIZON_STEPS-1 days of calm history: not enough for even one to resolve yet
for (var d = 0; d < T.HORIZON_STEPS - 1; d++) {
  var tick = T.tick(st, t0 + d * DAY, { v: 70 + d * 0.1 }, est(4), [{ key: 'm', value: 0.1, likelihood: spike(4) }]);
  st = tick.state;
}
var early = T.tick(st, t0 + (T.HORIZON_STEPS - 1) * DAY, { v: 71 }, est(4), [{ key: 'm', value: 0.1, likelihood: spike(4) }]);
ok('not enough days yet => estimatorHitRate is null (abstain, not a fabricated number)', early.result.estimatorHitRate === null,
   'resolvedCount=' + early.result.resolvedCount);
ok('trackedForecasts grows even while nothing has resolved', early.result.trackedForecasts > 0);
ok('pendingCount accounts for the recorded-but-not-yet-aged forecasts', early.result.pendingCount === early.result.trackedForecasts - early.result.resolvedCount);

// ── 4. Once enough days pass, forecasts resolve and reuse the validated scoring core ───────────────
section('4. Forecasts resolve once the horizon elapses; reuses ledger.scorePairs unchanged');
// continue for enough MORE days that the very first forecast (day 0) has a full forward window
var st2 = st;
for (d = T.HORIZON_STEPS - 1; d <= T.HORIZON_STEPS + 3; d++) {
  var t2 = T.tick(st2, t0 + d * DAY, { v: 55 }, est(3), [{ key: 'm', value: 0.9, likelihood: spike(3) }]);   // price crashes, distress channel fires
  st2 = t2.state;
}
var mature = T.tick(st2, t0 + (T.HORIZON_STEPS + 4) * DAY, { v: 54 }, est(3), [{ key: 'm', value: 0.9, likelihood: spike(3) }]);
ok('at least one forecast has now resolved', mature.result.resolvedCount >= 1, 'resolvedCount=' + mature.result.resolvedCount);
ok('estimatorHitRate is a real number once something resolves', typeof mature.result.estimatorHitRate === 'number');
ok('skill block present (reused from outcome-ledger, not reimplemented)', mature.result.skill && typeof mature.result.skill.n === 'number');
console.log('        resolved=' + mature.result.resolvedCount + ' hitRate=' + mature.result.estimatorHitRate + ' pending=' + mature.result.pendingCount);

// ── 5. Caps prevent unbounded growth ────────────────────────────────────────────────────────────────
section('5. State is capped (CAP), does not grow unbounded');
var stc = null, tc = 0;
for (d = 0; d < T.CAP + 20; d++) {
  var tt = T.tick(stc, tc, { v: 70 }, est(4), [{ key: 'm', value: 0.1, likelihood: spike(4) }]);
  stc = tt.state; tc += T.RECORD_INTERVAL_MS;
}
ok('prices array capped at CAP', stc.prices.length === T.CAP, 'got ' + stc.prices.length);
ok('forecasts array capped at CAP', stc.forecasts.length === T.CAP, 'got ' + stc.forecasts.length);

// ── 6. Determinism ──────────────────────────────────────────────────────────────────────────────────
section('6. Deterministic given the same state/inputs (pure)');
var a = T.tick(st2, t0 + (T.HORIZON_STEPS + 4) * DAY, { v: 54 }, est(3), [{ key: 'm', value: 0.9, likelihood: spike(3) }]);
var b = T.tick(JSON.parse(JSON.stringify(st2)), t0 + (T.HORIZON_STEPS + 4) * DAY, { v: 54 }, est(3), [{ key: 'm', value: 0.9, likelihood: spike(3) }]);
ok('same state (even round-tripped through JSON) + same inputs => same result', a.result.estimatorHitRate === b.result.estimatorHitRate);

console.log('\n' + '-'.repeat(70));
console.log(pass + ' passed, ' + fail + ' failed');
console.log('-'.repeat(70));
process.exit(fail === 0 ? 0 : 1);
