/**
 * scripts/test-history-backfill.js — proves lib/history-backfill.js (energy market backtest). OFFLINE.
 * Run: node scripts/test-history-backfill.js
 *
 * The one property that matters most is NO LEAKAGE: a point-in-time input at date t must depend only on
 * prices up to t, so a future crash cannot change a past forecast. Also: forward-only outcomes, a full
 * crash scenario, and that the whole estimator->ledger path runs on real-shaped history.
 */

var H = require('../lib/history-backfill.js');

var pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) { pass++; console.log('  PASS  ' + name); } else { fail++; console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : '')); } }
function section(t) { console.log('\n' + t); }
var DAY = 24 * 3600 * 1000;

function series(prices) { return prices.map(function (v, i) { return { t: i * DAY, v: v }; }); }

// ── 1. NO LEAKAGE — a future price change must not alter a past point-in-time input ───────────────
section('1. LEAKAGE GUARD: marketStress at index i is invariant to anything after i');
var base = []; for (var i = 0; i < 40; i++) base.push(100 + Math.sin(i / 3) * 2);   // gently oscillating
var s1 = series(base.slice());
var s2base = base.slice(); s2base[35] = 10; s2base[36] = 8; s2base[37] = 6;          // insert a crash AFTER index 30
var s2 = series(s2base);
ok('marketStress(i=30) identical whether or not a crash happens at i=35',
   H.marketStress(s1, 30) === H.marketStress(s2, 30),
   'noCrash=' + H.marketStress(s1, 30) + ' withFutureCrash=' + H.marketStress(s2, 30));
ok('marketStress uses only trailing window (returns null too early)', H.marketStress(s1, 1) === null);

// ── 2. Forward outcome is forward-only and abstains without a full window ─────────────────────────
section('2. forwardAdverse looks forward and abstains at the tail (no look-ahead beyond data)');
ok('a forward price drop registers as adverse', (function () { var s = series([100,100,100,100,100,100,80,80,80,80,80,80,80,80,80,80,80]); var o = H.forwardAdverse(s, 0, { horizonSteps: 15 }); return o && o.adverse > 0.5; })());
ok('stable forward prices => low adverse', (function () { var s = series(new Array(20).fill(100)); var o = H.forwardAdverse(s, 0, { horizonSteps: 15 }); return o && o.adverse < 0.05; })());
ok('no full forward window => null (abstain, no look-ahead)', H.forwardAdverse(series([100,100,100]), 1, { horizonSteps: 15 }) === null);

// ── 3. Full backfill runs the real estimator->ledger path on a crash scenario ────────────────────
section('3. Backfill on a build-then-crash energy series runs end-to-end');
// 60 calm days ~100, then a sustained crash to ~60 — trailing weakness should precede forward drawdown
var prices = [];
for (i = 0; i < 60; i++) prices.push(100 + Math.sin(i / 4) * 1.5);
for (i = 0; i < 40; i++) prices.push(100 - i * 1.0);                                  // steady decline 100 -> 60
var bf = H.backfill(series(prices), { horizonSteps: 15 });
ok('backfill ok', bf.ok === true, JSON.stringify(bf.reason || ''));
ok('it built forecasts and resolved them (label data NOW, not weeks out)', bf.forecastsBuilt > 20 && bf.result.resolvedCount > 20);
ok('estimatorHitRate is a real number in [0,1] (not abstaining — we have history)',
   typeof bf.result.estimatorHitRate === 'number' && bf.result.estimatorHitRate >= 0 && bf.result.estimatorHitRate <= 1);
ok('reconstructed a phase trajectory to inspect the pattern', Array.isArray(bf.trajectory) && bf.trajectory.length > 20);
ok('scope note names the market-only limit + leakage discipline', /MARKET-ONLY/.test(bf.scope) && /test set/.test(bf.scope));
ok('skill block present with a real confusion matrix', bf.result.skill && bf.result.skill.n === bf.result.resolvedCount);
console.log('        backfill: points=' + bf.points + ' forecasts=' + bf.forecastsBuilt + ' resolved=' + bf.result.resolvedCount + ' estimatorHitRate=' + bf.result.estimatorHitRate);
console.log('        skill: precision=' + bf.result.skill.precision + ' recall=' + bf.result.skill.recall + ' f1=' + bf.result.skill.f1 + ' baseRate=' + bf.result.skill.baseRate);

// ── 4. Too-short series abstains rather than fabricating ─────────────────────────────────────────
section('4. Too-short history abstains, does not fabricate a result');
ok('series < 30 points => ok:false with a reason', H.backfill(series([1,2,3,4,5])).ok === false);

// ── 5. Determinism ───────────────────────────────────────────────────────────────────────────────
section('5. Backfill is deterministic (pure)');
var a = H.backfill(series(prices), { horizonSteps: 15 });
var b = H.backfill(series(prices), { horizonSteps: 15 });
ok('same input => same estimatorHitRate', a.result.estimatorHitRate === b.result.estimatorHitRate);

console.log('\n' + '-'.repeat(70));
console.log(pass + ' passed, ' + fail + ' failed');
console.log('-'.repeat(70));
process.exit(fail === 0 ? 0 : 1);
