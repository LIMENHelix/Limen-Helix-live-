/**
 * scripts/test-outcome-ledger.js — proves lib/outcome-ledger.js (the energy outcome loop). OFFLINE.
 * Run: node scripts/test-outcome-ledger.js
 *
 * Verifies the properties that make this a valid label generator: forward-only (no leakage), abstain
 * until resolved, correct hit accounting, and — the load-bearing part — per-channel attribution that
 * isolates WHICH channel was right on the divergent cases.
 */

var L = require('../lib/outcome-ledger.js');

var pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) { pass++; console.log('  PASS  ' + name); } else { fail++; console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : '')); } }
function section(t) { console.log('\n' + t); }

var DAY = 24 * 3600 * 1000;
function spike(p) { var v = new Array(11); for (var i = 0; i < 11; i++) v[i] = 0.01; v[p] = 0.9; return v; }

// ── 1. distressMass / buildForecast ─────────────────────────────────────────────────────────────
section('1. buildForecast computes distress mass and per-channel distress signals');
ok('distressMass sums the distress band (P3,P5,P7,P8,P9)', Math.abs(L.distressMass(spike(3)) - 0.94) < 1e-9);   // 0.9 + 4x0.01 floor
ok('a constructive-phase belief has low distress mass', L.distressMass(spike(4)) <= 0.06);                     // P4 not in band => only the 0.01 floors
var fc = L.buildForecast(1000, { belief: spike(3), stuck: 0.6 }, [
  { key: 'feed_workforce', value: 0.8, likelihood: spike(7) },   // high value, distress-loaded => strong signal
  { key: 'marketScore', value: 0.1, likelihood: spike(3) }       // low value => weak signal
]);
ok('forecast carries beliefDistress + stuck', fc.beliefDistress > 0.85 && fc.stuck === 0.6);
ok('distress-loaded high-value channel => strong signal', fc.channels.feed_workforce > 0.7);
ok('low-value channel => weak signal', fc.channels.marketScore < 0.1);

// ── 2. Forward-only (no leakage) + abstain until resolved ────────────────────────────────────────
section('2. Forward-only and data-starved: abstains until forecasts age past the horizon');
var f0 = L.buildForecast(0, { belief: spike(3), stuck: 0.6 }, [{ key: 'c', value: 0.8, likelihood: spike(3) }]);
var horizon = 21 * DAY;
// outcome exists but only BEFORE the horizon, and 'now' is before horizon => pending, not resolved
var early = L.resolve([f0], [{ t: 5 * DAY, adverse: 0.9 }], { now: 10 * DAY, horizonMs: horizon });
ok('not yet aged past horizon => pending, hit rate null (abstain)', early.resolvedCount === 0 && early.estimatorHitRate === null && early.pendingCount === 1);
// an outcome BEFORE madeAt must never be used (leakage guard)
var leak = L.resolve([L.buildForecast(30 * DAY, { belief: spike(3), stuck: 0.6 }, [{ key: 'c', value: 0.8, likelihood: spike(3) }])],
  [{ t: 10 * DAY, adverse: 0.9 }], { now: 100 * DAY, horizonMs: horizon });
ok('outcome before the forecast is never matched (no leakage)', leak.resolvedCount === 0);

// ── 3. Hit accounting — estimator call vs realized adverse event ─────────────────────────────────
section('3. Estimator hit = did the distress call match the realized adverse outcome');
// true positive: called distress, adverse happened
var tp = L.resolve([f0], [{ t: horizon + 1 * DAY, adverse: 0.9 }], { now: 100 * DAY, horizonMs: horizon });
ok('called distress + adverse happened => hit', tp.resolvedCount === 1 && tp.estimatorHitRate === 1);
// true negative: called calm, benign happened
var calmF = L.buildForecast(0, { belief: spike(4), stuck: 0.05 }, [{ key: 'c', value: 0.1, likelihood: spike(4) }]);
var tn = L.resolve([calmF], [{ t: horizon, adverse: 0.1 }], { now: 100 * DAY, horizonMs: horizon });
ok('called calm + benign happened => hit', tn.estimatorHitRate === 1);
// false positive: called distress, benign happened
var fp = L.resolve([f0], [{ t: horizon, adverse: 0.1 }], { now: 100 * DAY, horizonMs: horizon });
ok('called distress + benign happened => miss', fp.estimatorHitRate === 0);

// ── 4. Per-channel attribution + the DIVERGENCE training signal ──────────────────────────────────
section('4. Per-channel hit rates isolate WHICH channel was right on the divergent cases');
// Build 6 forecasts where feed_A always calls distress, market_B always calls calm; adverse actually
// happens every time. feed_A should be right (called distress -> adverse), market_B wrong.
var forecasts = [], outcomes = [];
for (var i = 0; i < 6; i++) {
  var made = i * 40 * DAY;
  forecasts.push({
    madeAt: made, stuck: 0.6, beliefDistress: 0.7,
    channels: { feed_A: 0.8, market_B: 0.1 }    // feed_A calls distress (>=0.4), market_B calls calm (<0.4) => DIVERGENT
  });
  outcomes.push({ t: made + horizon, adverse: 0.9 });   // adverse always happens
}
var r = L.resolve(forecasts, outcomes, { now: 1000 * DAY, horizonMs: horizon });
ok('all 6 resolve', r.resolvedCount === 6);
ok('feed_A (called distress, adverse happened) has hitRate 1', r.perChannelHitRate.feed_A.hitRate === 1, JSON.stringify(r.perChannelHitRate));
ok('market_B (called calm, adverse happened) has hitRate 0', r.perChannelHitRate.market_B.hitRate === 0);
ok('divergent-only rates populated (all 6 were divergent)', r.perChannelHitRateDivergent.feed_A.n === 6 && r.perChannelHitRateDivergent.feed_A.hitRate === 1);
ok('divergent market_B rate 0 — this is the re-weighting signal (trust feed_A over market_B here)',
   r.perChannelHitRateDivergent.market_B.hitRate === 0);
console.log('        per-channel (divergent): feed_A=' + r.perChannelHitRateDivergent.feed_A.hitRate + ' market_B=' + r.perChannelHitRateDivergent.market_B.hitRate);

// ── 5. Agreement cases are excluded from the divergent signal ────────────────────────────────────
section('5. Cases where channels AGREE are not counted in the divergent signal (you learn nothing there)');
var agree = [{ madeAt: 0, stuck: 0.6, beliefDistress: 0.7, channels: { a: 0.8, b: 0.8 } }];  // both call distress
var ar = L.resolve(agree, [{ t: horizon, adverse: 0.9 }], { now: 100 * DAY, horizonMs: horizon });
ok('agreeing channels counted overall', ar.perChannelHitRate.a.n === 1);
ok('but NOT in the divergent signal', !ar.perChannelHitRateDivergent.a || ar.perChannelHitRateDivergent.a.n === 0);

console.log('\n' + '-'.repeat(70));
console.log(pass + ' passed, ' + fail + ' failed');
console.log('-'.repeat(70));
process.exit(fail === 0 ? 0 : 1);
