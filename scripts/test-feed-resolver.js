/**
 * scripts/test-feed-resolver.js — the resolver core math (run: node scripts/test-feed-resolver.js).
 *
 *   T1  a correct RISING call graded against a recorded higher value ⇒ hit
 *   T2  a wrong FALLING call (stress actually rose) ⇒ miss
 *   T3  STABLE call within the dead-band ⇒ hit; outside ⇒ miss
 *   T4  FORWARD-ONLY: a recorded row BEFORE the forecast is never used (no leakage)
 *   T5  a forecast whose horizon hasn't elapsed (now < madeAt+horizon) is PENDING, not a miss
 *   T6  no resolved forecasts ⇒ externalHitRate null (abstain), pendingCount reflects the rest
 *   T7  externalHitRate = hits/resolved over a mixed batch
 */
var R = require('../lib/feed-resolver.js');

/**
 * THE HORIZON IS READ FROM PRODUCTION, NOT HARD-CODED.
 *
 * This file previously pinned H at 6h. Production moved to 24h and to a
 * mean-reversion model (mrev1), and these tests were left behind — they failed
 * for months without anyone noticing, because there was no runner that executed
 * them as a set.
 *
 * The move was evidence-backed, not cosmetic. lib/feed-resolver.js records the
 * held-out measurement in its own header:
 *     shipped  trend @ 6h  : skill -0.1248, directional sign accuracy 0.271
 *     this     mrev  @ 24h : skill +0.0455, directional sign accuracy 0.526
 * A directional accuracy of 0.271 is worse than a coin flip: the old model was
 * inverted. Mean reversion is the correction.
 *
 * Importing the constant rather than restating it means the next horizon change
 * cannot silently desynchronise these tests again.
 */
var H = R.DEFAULT_HORIZON_MS;
var HOUR = 3600 * 1000;

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

var t0 = 1000000000000;               // a fixed base time (no Date in the pure fn)
// Past the LAST forecast in any batch below (t0+90h) plus a full horizon.
// At the old 6h horizon t0+100h cleared everything; at 24h it does not.
var now = t0 + 200 * HOUR;

// T1 — correct rising
(function () {
  console.log('T1: correct rising call ⇒ hit');
  var f = [{ madeAt: t0, direction: 'rising', currentStress: 0.5 }];
  var rec = [{ t: t0 + H, s: 0.7 }];   // 6h later, stress rose
  var r = R.resolve(f, rec, { now: now });
  assert('resolved 1', r.resolvedCount === 1, JSON.stringify(r));
  assert('hit (rose as predicted)', r.externalHitRate === 1);
})();

// T2 — wrong falling
(function () {
  console.log('T2: falling call but stress rose ⇒ miss');
  var f = [{ madeAt: t0, direction: 'falling', currentStress: 0.5 }];
  var rec = [{ t: t0 + H, s: 0.7 }];
  var r = R.resolve(f, rec, { now: now });
  assert('resolved 1, hitRate 0', r.resolvedCount === 1 && r.externalHitRate === 0);
})();

// T3 — stable dead-band
(function () {
  console.log('T3: stable call inside vs outside the dead-band');
  var hit = R.resolve([{ madeAt: t0, direction: 'stable', currentStress: 0.5 }], [{ t: t0 + H, s: 0.52 }], { now: now });
  assert('within eps ⇒ hit', hit.externalHitRate === 1, JSON.stringify(hit));
  var miss = R.resolve([{ madeAt: t0, direction: 'stable', currentStress: 0.5 }], [{ t: t0 + H, s: 0.8 }], { now: now });
  assert('outside eps ⇒ miss', miss.externalHitRate === 0);
})();

// T4 — forward-only (no leakage)
(function () {
  console.log('T4: a recorded row BEFORE the forecast is never used');
  var f = [{ madeAt: t0, direction: 'rising', currentStress: 0.5 }];
  // the only row near the target-in-time is BEFORE madeAt ⇒ must be ignored ⇒ not resolvable
  var rec = [{ t: t0 - H, s: 0.9 }];
  var r = R.resolve(f, rec, { now: now });
  assert('not resolved (pre-forecast row ignored)', r.resolvedCount === 0 && r.pendingCount === 1, JSON.stringify(r));
})();

// T5 — pending, not a miss
(function () {
  console.log('T5: horizon not yet elapsed ⇒ pending');
  var f = [{ madeAt: t0, direction: 'rising', currentStress: 0.5 }];
  var rec = [{ t: t0 + H, s: 0.7 }];
  var r = R.resolve(f, rec, { now: t0 + HOUR });   // only 1h past madeAt, well inside the horizon
  assert('pending, not resolved', r.resolvedCount === 0 && r.pendingCount === 1);
  assert('externalHitRate null (abstain)', r.externalHitRate === null);
})();

// T6 — abstain with nothing resolved
(function () {
  console.log('T6: no resolvable forecasts ⇒ abstain (null)');
  var r = R.resolve([{ madeAt: now, direction: 'rising', currentStress: 0.5 }], [], { now: now });
  assert('externalHitRate null', r.externalHitRate === null && r.resolvedCount === 0);
})();

// T7 — mixed batch hit-rate
(function () {
  console.log('T7: hitRate = hits/resolved over a mixed batch');
  var f = [
    { madeAt: t0 + 0 * HOUR, direction: 'rising', currentStress: 0.4 },   // rec 0.6 → hit
    { madeAt: t0 + 10 * HOUR, direction: 'falling', currentStress: 0.6 }, // rec 0.7 → miss
    { madeAt: t0 + 20 * HOUR, direction: 'rising', currentStress: 0.3 }   // rec 0.5 → hit
  ];
  var rec = [
    { t: t0 + 0 * HOUR + H, s: 0.6 }, { t: t0 + 10 * HOUR + H, s: 0.7 }, { t: t0 + 20 * HOUR + H, s: 0.5 }
  ];
  var r = R.resolve(f, rec, { now: now });
  assert('3 resolved', r.resolvedCount === 3, JSON.stringify(r));
  assert('hitRate 2/3', Math.abs(r.externalHitRate - 0.6667) < 0.001, 'rate=' + r.externalHitRate);
})();

// T8 — deriveForecast: server-side direction call from recorded history
(function () {
  console.log('T8: deriveForecast reads a direction from recorded history');
  var rising = []; for (var i = 0; i < 12; i++) rising.push({ t: t0 + i * HOUR, s: 0.3 + i * 0.03 });
  var fr = R.deriveForecast(rising);
  /* MEAN REVERSION, SO THE CALL IS THE OPPOSITE OF THE TREND.
     A series climbing to 0.63 against a window mean of 0.465 is projected back
     DOWN toward that mean, so the direction is 'falling'. Under the old
     trend-following model this asserted 'rising'; that model scored 0.271
     directional accuracy, i.e. reliably backwards. */
  assert('rising series reverts ⇒ direction falling', fr && fr.direction === 'falling', JSON.stringify(fr));
  assert('model stamp is mrev1', fr && fr.model === 'mrev1', JSON.stringify(fr && fr.model));
  assert('projection moves toward the window mean, not past the current value',
    fr && fr.projectedStress < fr.currentStress && fr.projectedStress > fr.windowMean,
    JSON.stringify({ cur: fr && fr.currentStress, proj: fr && fr.projectedStress, mean: fr && fr.windowMean }));
  assert('currentStress = latest recorded', fr && Math.abs(fr.currentStress - (0.3 + 11 * 0.03)) < 0.001);
  var falling = []; for (var j = 0; j < 12; j++) falling.push({ t: t0 + j * HOUR, s: 0.8 - j * 0.03 });
  var ff = R.deriveForecast(falling);
  assert('falling series reverts ⇒ direction rising', ff && ff.direction === 'rising', JSON.stringify(ff));
  assert('a reverted projection stays inside [0,1]',
    ff && ff.projectedStress >= 0 && ff.projectedStress <= 1, JSON.stringify(ff && ff.projectedStress));
  // A flat series REFUSES rather than calling "stable". Calling stable on a flat line
  // is always right, which is exactly how six domains came to report perfect accuracy.
  var flat = []; for (var k = 0; k < 12; k++) flat.push({ t: t0 + k * HOUR, s: 0.5 });
  assert('flat series ⇒ null (refuses, does not call stable)', R.deriveForecast(flat) === null,
    JSON.stringify(R.deriveForecast(flat)));
  assert('too little history ⇒ null', R.deriveForecast([{ t: t0, s: 0.5 }]) === null);
})();

// T9 — the baseline is reported, and a constant series shows hitRate 1.0 with ZERO skill
(function () {
  console.log('T9: a constant series reads 1.0 hit rate and 0 skill');
  var f = [], rec = [];
  for (var i = 0; i < 10; i++) {
    f.push({ madeAt: t0 + i * 10 * HOUR, direction: 'stable', currentStress: 0.51 });
    rec.push({ t: t0 + i * 10 * HOUR + H, s: 0.51 });   // never moves, ever
  }
  var r = R.resolve(f, rec, { now: now });
  assert('hit rate is a perfect 1.0', r.externalHitRate === 1, JSON.stringify(r.externalHitRate));
  assert('but the always-stable baseline is ALSO 1.0', r.alwaysStableRate === 1, JSON.stringify(r.alwaysStableRate));
  assert('so skill is 0, not competence', r.skill === 0, JSON.stringify(r.skill));
  assert('the note says so rather than leaving 1.0 to be misread',
    /abstention, not competence/.test(r.note), r.note);
})();

// T10 — genuine skill is distinguishable from abstention
(function () {
  console.log('T10: correct direction calls on a moving series show POSITIVE skill');
  var f = [], rec = [];
  for (var i = 0; i < 10; i++) {
    // stress alternates by a clear 0.2, and the forecast calls it right every time
    var up = i % 2 === 0;
    f.push({ madeAt: t0 + i * 10 * HOUR, direction: up ? 'rising' : 'falling', currentStress: 0.5 });
    rec.push({ t: t0 + i * 10 * HOUR + H, s: up ? 0.7 : 0.3 });
  }
  var r = R.resolve(f, rec, { now: now });
  assert('hit rate 1.0', r.externalHitRate === 1);
  assert('always-stable baseline is 0 (every move cleared the band)', r.alwaysStableRate === 0);
  assert('skill is +1: this is real information', r.skill === 1, JSON.stringify(r.skill));
  assert('directional sign accuracy is 1.0', r.directional.signAccuracy === 1, JSON.stringify(r.directional));
})();

// T11 — sign accuracy separates "backwards" from "too small to credit"
(function () {
  console.log('T11: a backwards call is distinguishable from an uncreditable one');
  // called rising, actually fell hard ⇒ wrong SIGN
  var back = R.resolve([{ madeAt: t0, direction: 'rising', currentStress: 0.5 }], [{ t: t0 + H, s: 0.2 }], { now: now });
  assert('backwards ⇒ sign accuracy 0', back.directional.signAccuracy === 0, JSON.stringify(back.directional));
  // called rising, did rise but only by one quantization step ⇒ right sign, no credit
  var small = R.resolve([{ madeAt: t0, direction: 'rising', currentStress: 0.5 }], [{ t: t0 + H, s: 0.51 }], { now: now });
  assert('right sign, too small ⇒ no hit', small.externalHitRate === 0, JSON.stringify(small.externalHitRate));
  assert('right sign, too small ⇒ sign accuracy 1', small.directional.signAccuracy === 1, JSON.stringify(small.directional));
})();

// T12 — REGRESSION. The forecaster and the grader must use the same dead-band in
// the same units. The original bug: deriveForecast committed at slope > 0.005/step
// (0.03 across the horizon) while resolve credited only above 0.05, so every call
// in that gap was an automatic miss no matter how right it was.
//
// The assertion is deliberately model-AGNOSTIC. It used to demand direction
// 'rising' from a gently climbing series, which was really testing the old
// trend model rather than the coupling this regression is about. Under mean
// reversion that same series projects DOWN, and the test failed for a reason
// that had nothing to do with the bug it guards. What matters is only that a
// direction the forecaster commits to is one the grader will credit.
(function () {
  console.log('T12: a call the forecaster commits to is creditable by the grader');
  var rows = []; for (var i = 0; i < 12; i++) rows.push({ t: t0 + i * HOUR, s: 0.40 + i * 0.02 });
  var fc = R.deriveForecast(rows);
  assert('forecaster commits to a direction, not stable', fc && fc.direction !== 'stable', JSON.stringify(fc));
  assert('and the committed move clears the shared dead-band',
    fc && Math.abs(fc.projectedMove) > R.DEAD_BAND, JSON.stringify(fc && fc.projectedMove));
  // Now let the world do exactly what the forecaster projected, and grade it.
  var f = [{ madeAt: t0 + 11 * HOUR, direction: fc.direction, currentStress: fc.currentStress }];
  var rec = [{ t: t0 + 11 * HOUR + H, s: fc.projectedStress }];
  var r = R.resolve(f, rec, { now: now });
  assert('and the grader CREDITS it (the gap is closed)', r.externalHitRate === 1,
    'projected ' + fc.projectedStress + ' from ' + fc.currentStress + ' ⇒ ' + JSON.stringify(r.resolved));
  assert('both sides used the same dead-band', r.eps === R.DEAD_BAND, 'eps=' + r.eps + ' DEAD_BAND=' + R.DEAD_BAND);
})();

// T13 — REGRESSION. A projection must respect the [0,1] bounds of the scale.
// 10.8% of real recorded rows sit at exactly 1.0, and the original rule read the
// UNCLAMPED slope, so a series pinned at the ceiling was called "rising" — a
// forecast that stress above maximum would rise further.
//
// Under the old trend model the guard showed up as direction 'stable' and a zero
// move, because clamping removed the whole projection. Mean reversion satisfies
// the same requirement differently and more sensibly: a series at 1.0 has nowhere
// to go but down, so it is called 'falling'. Asserting 'stable' here was pinning
// the OLD model's mechanism rather than the property that matters, which is that
// the projection never leaves the scale and never points off the end of it.
(function () {
  console.log('T13: a projection never leaves the [0,1] scale');
  var rows = [];
  for (var i = 0; i < 12; i++) rows.push({ t: t0 + i * HOUR, s: Math.min(1, 0.6 + i * 0.08) });
  var last = rows[rows.length - 1];
  assert('the series really is pinned at 1.0', last.s === 1, JSON.stringify(last));
  var fc = R.deriveForecast(rows);
  assert('slope is positive (the old rule would have said rising)', fc.slope > 0, 'slope=' + fc.slope);
  assert('at the ceiling it is never called rising', fc.direction !== 'rising', JSON.stringify(fc));
  assert('and the projection stays at or below 1.0', fc.projectedStress <= 1, JSON.stringify(fc.projectedStress));

  var floor = []; for (var j = 0; j < 12; j++) floor.push({ t: t0 + j * HOUR, s: Math.max(0, 0.4 - j * 0.08) });
  var ff = R.deriveForecast(floor);
  assert('at the floor it is never called falling', ff.direction !== 'falling', JSON.stringify(ff));
  assert('and the projection stays at or above 0', ff.projectedStress >= 0, JSON.stringify(ff.projectedStress));
})();

// T14 — REGRESSION. A move of exactly two quantization steps sits INSIDE a
// two-step dead-band. IEEE754 made 0.52-0.5 = 0.020000000000000018 and this
// commonest-of-all boundary graded backwards.
(function () {
  console.log('T14: a move of exactly the dead-band is inside it');
  var r = R.resolve([{ madeAt: t0, direction: 'stable', currentStress: 0.5 }], [{ t: t0 + H, s: 0.52 }], { now: now });
  assert('|delta| == eps ⇒ stable is a hit', r.externalHitRate === 1, JSON.stringify(r.resolved));
  assert('the reported delta matches what was graded', r.resolved[0].delta === 0.02, JSON.stringify(r.resolved[0].delta));
  var r2 = R.resolve([{ madeAt: t0, direction: 'stable', currentStress: 0.5 }], [{ t: t0 + H, s: 0.53 }], { now: now });
  assert('one step beyond the band ⇒ miss', r2.externalHitRate === 0, JSON.stringify(r2.resolved));
})();

// T15 — REGRESSION. The variance gate: a window spanning less than the dead-band has
// no expressible direction, so the forecaster must abstain instead of taking a free
// hit. This is the single change that ends "six domains report 1.0 accuracy".
(function () {
  console.log('T15: a series that does not move is refused, not forecast');
  function mk(vals) { return vals.map(function (v, i) { return { t: t0 + i * HOUR, s: v }; }); }

  assert('zero variance ⇒ refused', R.deriveForecast(mk([0.51, 0.51, 0.51, 0.51, 0.51, 0.51])) === null);
  // moves, but by less than one dead-band across the whole window (the law/defense shape)
  assert('range 0.01, under the band ⇒ refused',
    R.deriveForecast(mk([0.50, 0.51, 0.50, 0.51, 0.50, 0.51])) === null,
    JSON.stringify(R.deriveForecast(mk([0.50, 0.51, 0.50, 0.51, 0.50, 0.51]))));
  // exactly at the band is still refused: it must CLEAR the band, not merely touch it
  assert('range exactly 0.02 ⇒ refused', R.deriveForecast(mk([0.50, 0.52, 0.50, 0.52])) === null);
  var live = R.deriveForecast(mk([0.50, 0.53, 0.50, 0.53, 0.50, 0.53]));
  assert('range 0.03, over the band ⇒ forecast made', live !== null, JSON.stringify(live));

  // The gate is per-WINDOW, not per-domain: a domain that goes quiet abstains for that
  // stretch and resumes when it moves again.
  var quietThenAlive = mk([0.40, 0.40, 0.40, 0.40, 0.40, 0.40, 0.40, 0.55]);
  assert('a quiet stretch alone ⇒ refused', R.deriveForecast(quietThenAlive.slice(0, 7)) === null);
  assert('the same series once it moves ⇒ forecast made', R.deriveForecast(quietThenAlive) !== null);
})();

// T16 — the end-to-end consequence, in the exact shape of law/culture/technology in
// production: a flat domain ABSTAINS instead of reporting a perfect hit rate.
(function () {
  console.log('T16: a flat domain abstains instead of scoring 1.0');
  var rows = [], fcs = [];
  for (var i = 0; i < 40; i++) rows.push({ t: t0 + i * HOUR, s: 0.51 });
  for (var k = 12; k < 34; k++) {
    var fc = R.deriveForecast(rows.slice(0, k + 1));
    if (fc) fcs.push({ madeAt: rows[k].t, direction: fc.direction, currentStress: fc.currentStress });
  }
  assert('no forecast is even produced', fcs.length === 0, 'produced ' + fcs.length);
  var r = R.resolve(fcs, rows, { now: now });
  assert('so the resolver abstains (null), not 1.0', r.externalHitRate === null, JSON.stringify(r.externalHitRate));
  assert('and skill is null, not a misleading 0', r.skill === null, JSON.stringify(r.skill));
})();

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
