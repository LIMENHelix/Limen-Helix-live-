/**
 * scripts/test-plasticity.js — verification harness for the three-factor
 * plasticity build (run: node scripts/test-plasticity.js).
 *
 * Proves, with real before/after comparisons (not self-report):
 *   T1  weights shrink toward seed absent any modulator (decay from day one)
 *   T2  weights CHANGE after a modulator application (the learning claim)
 *   T3  eligibility trace bridges a DELAYED modulator (activity at t=0,
 *       modulator at t=5 still credits it); no activity ⇒ modulator inert
 *   T4  RPE centering: first event rpe=0; above-baseline credit ⇒ rpe>0;
 *       stale ledger (same resolvedSamples) never re-teaches
 *   T5  injected oscillation trips diag.oscillating
 *   T6  injected runaway (relentless positive modulator, high eta) trips diag.runaway
 *   T7  serialize → hydrate restores weights exactly (simulated restart);
 *       a changed seed config RESETS the layer instead of silently reusing it
 */
var P = require('../assets/js/limen-plasticity.js');

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) { console.log('  PASS ' + name); }
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

function mkLayer(over) {
  var cfg = { name: 'test', seed: [0.35, 0.2, 0.25], labels: ['a', 'b', 'c'],
    eta: 0.05, modScale: 1.0, traceDecay: 0.8, priorLambda: 0.01, minW: 0, maxW: 1.5 };
  for (var k in (over || {})) cfg[k] = over[k];
  return P.createLayer(cfg);
}

// T1 — decay toward seed with no modulator
(function () {
  console.log('T1: prior shrinkage (decay from day one)');
  var L = mkLayer();
  L.w = [0.9, 0.9, 0.9];                      // pretend past learning drifted it
  for (var i = 0; i < 200; i++) P.tick(L, [0.1, 0.1, 0.1], 0.1);
  var drift = L.diag.driftFromSeed;
  assert('weights relaxed toward seed', drift < 0.2, 'driftFromSeed=' + drift);
  assert('no modulator ⇒ zero updates', L.updates === 0);
})();

// T2 — weights change on modulator (before/after)
(function () {
  console.log('T2: three-factor update changes weights');
  var L = mkLayer();
  var before = L.w.slice();
  P.tick(L, [1, 0.5, 0.2], 0.8);              // build eligibility
  P.applyModulator(L, 0.5);                   // positive RPE
  var changed = L.w.some(function (w, i) { return Math.abs(w - before[i]) > 1e-6; });
  assert('weights moved after applyModulator', changed, JSON.stringify(L.w));
  assert('largest pre got largest change', (L.w[0] - before[0]) > (L.w[2] - before[2]));
  var up = L.w[0] > before[0];
  var L2 = mkLayer();
  P.tick(L2, [1, 0.5, 0.2], 0.8);
  P.applyModulator(L2, -0.5);                 // negative RPE weakens
  assert('positive rpe strengthens, negative weakens', up && L2.w[0] < 0.35);
})();

// T3 — eligibility bridges delayed modulator
(function () {
  console.log('T3: eligibility trace bridges the 3-20 cycle outcome delay');
  var L = mkLayer();
  P.tick(L, [1, 1, 1], 1);                    // activity at t=0
  for (var i = 0; i < 5; i++) P.tick(L, [0, 0, 0], 0);   // 5 quiet cycles (trace decays)
  var before = L.w.slice();
  P.applyModulator(L, 0.5);                   // modulator finally arrives at t=5
  var delta = L.w[0] - before[0];
  assert('delayed modulator still credits t=0 activity', delta > 1e-5, 'delta=' + delta);
  var expectedTrace = Math.pow(0.8, 5);       // decayed but nonzero
  assert('credit magnitude tracks decayed trace', Math.abs(delta - 0.05 * 1.0 * 0.5 * expectedTrace) < 0.01, 'delta=' + delta);
  var L2 = mkLayer();                         // NO activity at all
  var b2 = L2.w.slice();
  P.applyModulator(L2, 0.9);
  assert('no eligibility ⇒ modulator inert', L2.w.every(function (w, i) { return Math.abs(w - b2[i]) < 1e-9; }));
})();

// T4 — RPE centering + freshness
(function () {
  console.log('T4: modulator centering + new-outcome-only teaching');
  var M = P.createModulator();
  var r1 = P.readModulator(M, { credit: 0.6, creditSource: 'call-consistency', isReward: false }, 1);
  assert('first resolved outcome: fresh, rpe=0 (baseline seeds)', r1.fresh && r1.rpe === 0);
  var r2 = P.readModulator(M, { credit: 0.6, creditSource: 'call-consistency', isReward: false }, 1);
  assert('same resolvedSamples ⇒ not fresh (no double-teach)', !r2.fresh && r2.rpe === null);
  var r3 = P.readModulator(M, { credit: 0.9, creditSource: 'call-consistency', isReward: false }, 2);
  assert('above-baseline credit ⇒ positive rpe', r3.fresh && r3.rpe > 0, 'rpe=' + r3.rpe);
  var r4x = P.readModulator(M, { credit: 0.1, creditSource: 'call-consistency', isReward: false }, 3);
  assert('below-baseline credit ⇒ negative rpe', r4x.fresh && r4x.rpe < 0, 'rpe=' + r4x.rpe);
  assert('isReward honestly false throughout', !r1.isReward && !r3.isReward);
})();

// T5 — injected oscillation trips the flag
(function () {
  console.log('T5: oscillation diagnostic (injected bounce)');
  var L = mkLayer({ eta: 0.6, priorLambda: 0 });
  for (var i = 0; i < P.DIAG_WINDOW + 8; i++) {
    P.tick(L, [1, 1, 1], 1);
    P.applyModulator(L, (i % 2 === 0) ? 0.9 : -0.9);   // alternate strong up/down
  }
  assert('alternating modulator ⇒ oscillating flagged', L.diag.oscillating === true, JSON.stringify(L.diag));
  assert('oscillating ⇒ not stable', L.diag.stable === false);
})();

// T6 — injected runaway trips the flag
(function () {
  console.log('T6: runaway diagnostic (relentless growth)');
  var L = mkLayer({ eta: 0.5, priorLambda: 0, maxW: 5 });
  for (var i = 0; i < P.DIAG_WINDOW + 4; i++) {
    P.tick(L, [1, 1, 1], 1);
    P.applyModulator(L, 0.9);                 // always-positive strong modulator
  }
  assert('monotone growth ⇒ runaway flagged', L.diag.runaway === true, JSON.stringify(L.diag));
  assert('runaway ⇒ not stable', L.diag.stable === false);
})();

// T7 — serialize/hydrate (the simulated-restart weight-reload proof)
(function () {
  console.log('T7: restart survival (serialize -> fresh layers -> hydrate)');
  var layers = { A: mkLayer(), B: mkLayer({ name: 'B', seed: [0.5], labels: ['x'] }) };
  for (var i = 0; i < 10; i++) {
    P.tick(layers.A, [1, 0.4, 0.2], 0.7);
    P.tick(layers.B, [0.6], 0.5);
  }
  P.applyModulator(layers.A, 0.4);
  P.applyModulator(layers.B, -0.2);
  var mod = P.createModulator();
  P.readModulator(mod, { credit: 0.7, creditSource: 'call-consistency', isReward: false }, 1);
  var snap = P.serialize(layers, mod, { domain: 'test' });
  assert('snapshot carries honest labels', snap.mode === 'shadow' && snap.isReward === false);

  // "restart": brand-new layer objects (defaults = seeds), then hydrate
  var fresh = { A: mkLayer(), B: mkLayer({ name: 'B', seed: [0.5], labels: ['x'] }) };
  var wasDefault = String(fresh.A.w) === String(fresh.A.seed);
  var res = P.hydrate(fresh, snap);
  var m2 = P.createModulator();
  P.hydrateModulator(m2, snap);
  assert('fresh layers started at seed (would have been the silent reset)', wasDefault);
  assert('both layers restored, none reset', res.restored.length === 2 && res.reset.length === 0, JSON.stringify(res));
  assert('weights reload EXACTLY (not defaults)', String(fresh.A.w.map(function (x) { return Math.round(x * 10000) / 10000; })) === String(snap.layers.A.w), fresh.A.w + ' vs ' + snap.layers.A.w);
  assert('update counters survive', fresh.A.updates === 1 && fresh.B.updates === 1);
  assert('modulator baseline survives', m2.baseline === mod.baseline && m2.lastResolvedSamples === 1);

  // changed seed config ⇒ honest reset, not silent reuse
  var changed = { A: mkLayer({ seed: [0.9, 0.2, 0.25] }), B: mkLayer({ name: 'B', seed: [0.5], labels: ['x'] }) };
  var res2 = P.hydrate(changed, snap);
  assert('changed seed ⇒ layer reset to new prior', res2.reset.indexOf('A') !== -1 && res2.restored.indexOf('B') !== -1, JSON.stringify(res2));
})();

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
