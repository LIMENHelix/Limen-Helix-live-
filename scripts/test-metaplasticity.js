/**
 * scripts/test-metaplasticity.js — BCM-like sliding-threshold metaplasticity in limen-plasticity.js
 * (run: node scripts/test-metaplasticity.js). The effective learning rate is DERIVED per layer from
 * the layer's OWN recent plasticity statistics (mean |Δ|w||), not a static hand-set schedule.
 *
 *   T1  every layer carries meta {theta, etaScale, samples}; etaScale refreshed each tick
 *   T2  a settled/quiet layer ⇒ etaScale ≈ 1 (θ tracks activity, self-normalizes)
 *   T3  a layer churning FASTER than its own baseline ⇒ etaScale < 1 (homeostatic damp)
 *   T4  oscillating/runaway diagnostics ⇒ etaScale hard-damps to the floor (loop closed)
 *   T5  applyModulator WITHOUT opts uses static η; WITH {metaplasticity:true} scales η by etaScale
 *   T6  meta state serializes + hydrates (survives restart)
 */
var P = require('../assets/js/limen-plasticity.js');
var failures = 0, tests = 0;
function assert(name, cond, detail) { tests++; if (cond) console.log('  PASS ' + name); else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); } }

function mkLayer() { return P.createLayer({ name: 'K', seed: [0.5], labels: ['x'], eta: 0.1, traceDecay: 0.85, priorLambda: 0.002, minW: 0, maxW: 2.0 }); }

console.log('T1: meta present + refreshed each tick');
var l1 = mkLayer();
assert('meta {theta,etaScale,samples} exists', l1.meta && l1.meta.etaScale === 1 && l1.meta.samples === 0);
P.tick(l1, [0.5], 0.3);
assert('etaScale still a finite number after a tick', typeof l1.meta.etaScale === 'number' && isFinite(l1.meta.etaScale));
assert('meta.samples advanced', l1.meta.samples === 1);

console.log('T2: settled/quiet layer ⇒ etaScale ≈ 1 (self-normalizing threshold)');
var l2 = mkLayer();
// constant gentle drive for many cycles: activity settles, θ tracks it ⇒ ratio ~0 ⇒ scale ~1
for (var i = 0; i < 60; i++) { P.tick(l2, [0.5], 0.2); if (i % 7 === 0) P.applyModulator(l2, 0.02); }
assert('etaScale within [0.8,1.2] once settled', l2.meta.etaScale >= 0.8 && l2.meta.etaScale <= 1.2, 'etaScale=' + l2.meta.etaScale);
assert('no instability flags', !l2.diag.oscillating && !l2.diag.runaway);

console.log('T3: churning faster than baseline ⇒ etaScale < 1 (homeostatic damp)');
var l3 = mkLayer();
for (var j = 0; j < 40; j++) P.tick(l3, [0.3], 0.1);         // quiet baseline (small activity) ⇒ low θ
var thetaLow = l3.meta.theta;
for (var b = 0; b < 3; b++) { P.tick(l3, [1.0], 1.0); P.applyModulator(l3, 0.8); }   // big surprise burst ⇒ activity >> θ
assert('a burst above baseline damps etaScale below 1', l3.meta.etaScale < 1, 'etaScale=' + l3.meta.etaScale + ' theta=' + thetaLow);
assert('etaScale respects the floor', l3.meta.etaScale >= 0.25 - 1e-9, 'etaScale=' + l3.meta.etaScale);

console.log('T4: runaway diagnostics ⇒ etaScale hard-damps to floor (loop closed)');
var l4 = mkLayer();
for (var g = 0; g < 30; g++) { P.tick(l4, [1.0], 1.0); P.applyModulator(l4, 1.0); }   // monotone growth ⇒ runaway
assert('runaway detected', l4.diag.runaway === true, JSON.stringify(l4.diag));
assert('etaScale hard-damped to the floor (0.25) under runaway', Math.abs(l4.meta.etaScale - 0.25) < 1e-9, 'etaScale=' + l4.meta.etaScale);

console.log('T5: applyModulator honors the metaplasticity opt (static vs adaptive η)');
// two identical layers, same eligibility + rpe; one damped etaScale. Adaptive step must be smaller.
function primed() { var l = mkLayer(); for (var k = 0; k < 5; k++) P.tick(l, [1.0], 1.0); return l; }
var lStatic = primed(), lAdapt = primed();
lStatic.meta.etaScale = 0.5; lAdapt.meta.etaScale = 0.5;   // same damp on both
lStatic.w = [0.5]; lAdapt.w = [0.5];
var wS0 = lStatic.w[0], wA0 = lAdapt.w[0];
P.applyModulator(lStatic, 0.5);                            // no opts ⇒ static η (etaScale ignored)
P.applyModulator(lAdapt, 0.5, { metaplasticity: true });  // adaptive ⇒ η * 0.5
var dS = Math.abs(lStatic.w[0] - wS0), dA = Math.abs(lAdapt.w[0] - wA0);
assert('static step used full η (bigger)', dS > dA + 1e-9, 'dStatic=' + dS + ' dAdapt=' + dA);
assert('adaptive step ≈ 0.5 × static step', Math.abs(dA - 0.5 * dS) < 1e-6, 'dStatic=' + dS + ' dAdapt=' + dA);

console.log('T6: meta serializes + hydrates');
var ls = mkLayer(); for (var s = 0; s < 20; s++) P.tick(ls, [0.6], 0.4);
var snap = P.serialize({ K: ls }, P.createModulator(), null);
assert('serialized layer carries meta', snap.layers.K.meta && typeof snap.layers.K.meta.theta === 'number');
var fresh = mkLayer();
P.hydrate({ K: fresh }, snap);
assert('hydrated meta.theta restored', Math.abs(fresh.meta.theta - ls.meta.theta) < 1e-6, 'restored=' + fresh.meta.theta + ' orig=' + ls.meta.theta);
assert('hydrated meta.samples restored', fresh.meta.samples === ls.meta.samples);

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
