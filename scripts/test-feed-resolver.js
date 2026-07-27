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
var H = 6 * 3600 * 1000;      // 6h horizon (default)
var HOUR = 3600 * 1000;

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

var t0 = 1000000000000;               // a fixed base time (no Date in the pure fn)
var now = t0 + 100 * HOUR;            // "now" well past all horizons below

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
  var r = R.resolve(f, rec, { now: t0 + HOUR });   // now is only 1h past madeAt (< 6h horizon)
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
  assert('rising series ⇒ direction rising', fr && fr.direction === 'rising', JSON.stringify(fr));
  assert('currentStress = latest recorded', fr && Math.abs(fr.currentStress - (0.3 + 11 * 0.03)) < 0.001);
  var falling = []; for (var j = 0; j < 12; j++) falling.push({ t: t0 + j * HOUR, s: 0.8 - j * 0.03 });
  assert('falling series ⇒ falling', R.deriveForecast(falling).direction === 'falling');
  var flat = []; for (var k = 0; k < 12; k++) flat.push({ t: t0 + k * HOUR, s: 0.5 });
  assert('flat series ⇒ stable', R.deriveForecast(flat).direction === 'stable');
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
(function () {
  console.log('T12: a call the forecaster commits to is creditable by the grader');
  // A series rising at 0.006/step: clears the OLD forecaster threshold (0.005),
  // projects +0.036 over 6 steps, which the OLD grader (0.05) would have refused.
  var rows = []; for (var i = 0; i < 12; i++) rows.push({ t: t0 + i * HOUR, s: 0.40 + i * 0.006 });
  var fc = R.deriveForecast(rows);
  assert('forecaster commits to rising', fc.direction === 'rising', JSON.stringify(fc));
  // Now let the world do exactly what the forecaster projected, and grade it.
  var f = [{ madeAt: t0 + 11 * HOUR, direction: fc.direction, currentStress: fc.currentStress }];
  var rec = [{ t: t0 + 11 * HOUR + H, s: fc.projectedStress }];
  var r = R.resolve(f, rec, { now: now });
  assert('and the grader CREDITS it (the gap is closed)', r.externalHitRate === 1,
    'projected ' + fc.projectedStress + ' from ' + fc.currentStress + ' ⇒ ' + JSON.stringify(r.resolved));
  assert('both sides used the same dead-band', r.eps === R.DEAD_BAND, 'eps=' + r.eps + ' DEAD_BAND=' + R.DEAD_BAND);
})();

// T13 — REGRESSION. Direction comes from the CLAMPED projection, so a series
// pinned at the ceiling cannot be called "rising". 10.8% of real recorded rows
// sit at exactly 1.0, and the old rule read the unclamped slope.
(function () {
  console.log('T13: a series at the ceiling is never called rising');
  var rows = [];
  for (var i = 0; i < 12; i++) rows.push({ t: t0 + i * HOUR, s: Math.min(1, 0.6 + i * 0.08) });
  var last = rows[rows.length - 1];
  assert('the series really is pinned at 1.0', last.s === 1, JSON.stringify(last));
  var fc = R.deriveForecast(rows);
  assert('slope is positive (the old rule would have said rising)', fc.slope > 0, 'slope=' + fc.slope);
  assert('but direction is stable: 1.0 cannot rise', fc.direction === 'stable', JSON.stringify(fc));
  assert('projected move is 0, not positive', fc.projectedMove === 0, JSON.stringify(fc.projectedMove));
  // and the floor behaves the same way
  var floor = []; for (var j = 0; j < 12; j++) floor.push({ t: t0 + j * HOUR, s: Math.max(0, 0.4 - j * 0.08) });
  assert('a series at 0 is never called falling', R.deriveForecast(floor).direction === 'stable');
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

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
