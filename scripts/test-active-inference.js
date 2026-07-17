/**
 * scripts/test-active-inference.js — verification harness for active
 * inference v1 (run: node scripts/test-active-inference.js).
 *
 *   T1  belief updating: constant observations pull level to them and SHRINK
 *       uncertainty (a real posterior, not a point estimate)
 *   T2  a rising series produces positive slope beliefs + higher prediction
 *   T3  EFE action selection: high uncertainty prefers hold over emit;
 *       confident + rising + calibrated prefers emit over hold
 *   T4  epistemic value: broaden-attention beats observe when uncertainty
 *       dominates (ambiguity term is doing real work)
 *   T5  preference: observations far from the set-point raise risk for all
 *       actions (pragmatic term is doing real work)
 *   T6  serialize/hydrate round-trip
 */
var A = require('../assets/js/limen-active-inference.js');

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) { console.log('  PASS ' + name); }
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}
function G(sel, id) { return sel.actions.filter(function (a) { return a.id === id; })[0].G; }

// T1 — posterior convergence
(function () {
  console.log('T1: belief update converges + uncertainty shrinks');
  var ai = A.create({ level0: 0.5 });
  var v0 = ai.S[0];
  for (var i = 0; i < 30; i++) A.updateBeliefs(ai, 0.8);
  assert('level converged toward observations', Math.abs(ai.mu[0] - 0.8) < 0.05, 'level=' + ai.mu[0]);
  assert('level variance shrank', ai.S[0] < v0 / 5, v0 + ' -> ' + ai.S[0]);
})();

// T2 — slope tracking
(function () {
  console.log('T2: rising series -> positive slope belief');
  var ai = A.create({ level0: 0.2 });
  for (var i = 0; i < 20; i++) A.updateBeliefs(ai, 0.2 + i * 0.02);
  assert('slope belief positive', ai.mu[1] > 0.005, 'slope=' + ai.mu[1]);
  var sel = A.selectAction(ai, { setpoint: 0.35 });
  assert('prediction exceeds current level', sel.beliefs.predictedNext > sel.beliefs.level);
})();

// T3 — emit vs hold flips with confidence + calibration
(function () {
  console.log('T3: EFE ordering (uncertain->hold, proven->emit)');
  var fresh = A.create({ level0: 0.5 });
  A.updateBeliefs(fresh, 0.6);                       // one observation: still very uncertain
  var s1 = A.selectAction(fresh, { setpoint: 0.35, callHitRate: null });
  assert('uncertain + uncalibrated: hold-emission beats emit-call', G(s1, 'hold-emission') < G(s1, 'emit-call'),
    'hold=' + G(s1, 'hold-emission') + ' emit=' + G(s1, 'emit-call'));

  var proven = A.create({ level0: 0.5 });
  for (var i = 0; i < 40; i++) A.updateBeliefs(proven, 0.5 + i * 0.005);   // long rising, converged
  var s2 = A.selectAction(proven, { setpoint: 0.35, callHitRate: 0.9 });
  assert('confident + rising + calibrated: emit-call beats hold-emission', G(s2, 'emit-call') < G(s2, 'hold-emission'),
    'emit=' + G(s2, 'emit-call') + ' hold=' + G(s2, 'hold-emission'));
})();

// T4 — ambiguity term rewards precision-raising action under uncertainty
(function () {
  console.log('T4: epistemic value of broaden-attention');
  var ai = A.create({ level0: 0.5 });
  A.updateBeliefs(ai, 0.5);
  var sel = A.selectAction(ai, { setpoint: 0.5, callHitRate: null });
  assert('broaden-attention beats plain observe under uncertainty', G(sel, 'broaden-attention') < G(sel, 'observe'),
    'broaden=' + G(sel, 'broaden-attention') + ' observe=' + G(sel, 'observe'));
})();

// T5 — pragmatic (preference) term
(function () {
  console.log('T5: divergence from set-point raises risk');
  var near = A.create({ level0: 0.35 });
  for (var i = 0; i < 20; i++) A.updateBeliefs(near, 0.35);
  var far = A.create({ level0: 0.9 });
  for (var j = 0; j < 20; j++) A.updateBeliefs(far, 0.9);
  var sNear = A.selectAction(near, { setpoint: 0.35 });
  var sFar = A.selectAction(far, { setpoint: 0.35 });
  assert('observing far from preference costs more', G(sFar, 'observe') > G(sNear, 'observe'),
    'far=' + G(sFar, 'observe') + ' near=' + G(sNear, 'observe'));
})();

// T6 — restart round-trip
(function () {
  console.log('T6: serialize/hydrate');
  var ai = A.create({ level0: 0.5 });
  for (var i = 0; i < 15; i++) A.updateBeliefs(ai, 0.7);
  var snap = A.serialize(ai);
  var fresh = A.create({ level0: 0.5 });
  var ok = A.hydrate(fresh, snap);
  assert('hydrate accepts snapshot', ok);
  assert('beliefs survive restart', Math.abs(fresh.mu[0] - ai.mu[0]) < 1e-3 && fresh.steps === ai.steps);
})();

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
