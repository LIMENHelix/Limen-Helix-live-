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

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
