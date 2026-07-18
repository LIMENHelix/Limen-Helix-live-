/**
 * scripts/test-phase-percept.js — verification for the node-grounded phase
 * percept (run: node scripts/test-phase-percept.js).
 *
 *   T1  no scored nodes ⇒ UNGROUNDED, percept holds the prior, precision 0
 *       (the abstain-not-fabricate property — the whole point)
 *   T2  many scored nodes agreeing with the prior ⇒ grounded-aligned, high precision
 *   T3  scored nodes DISAGREEING with the prior ⇒ grounded-divergent, winner flips
 *       to the evidence phase, prediction error > 0 (the informative case)
 *   T4  precision is monotonic in coverage and in scored count
 *   T5  1 scored node (below MIN_SCORED) ⇒ ungrounded even if unanimous
 *   T6  partial coverage ⇒ posterior sits BETWEEN prior and evidence
 *   T7  ordinal error magnitude: p2→p3 (small) < p2→p9 (large)
 *   T8  unscored companies never count as evidence even with a .phase present
 */
var PH = require('../assets/js/limen-phase-percept.js');

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) { console.log('  PASS ' + name); }
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}
function scored(phase, n) { var a = []; for (var i = 0; i < n; i++) a.push({ phase: phase, scored: true }); return a; }
function unscored(phase, n) { var a = []; for (var i = 0; i < n; i++) a.push({ phase: phase, scored: false }); return a; }

// T1 — no evidence ⇒ abstain
(function () {
  console.log('T1: no scored nodes ⇒ ungrounded, holds prior');
  var r = PH.computePercept({ phase: 'p2', source: 'kernel' }, unscored('p3', 5));
  assert('ungrounded', r.grounded === false);
  assert('groundedPhase = prior (not fabricated)', r.groundedPhase === 'p2');
  assert('precision 0', r.precision === 0);
  assert('salience names the abstention', /ungrounded/.test(r.salience));
})();

// T2 — strong agreeing evidence
(function () {
  console.log('T2: many agreeing scored nodes ⇒ grounded-aligned');
  var r = PH.computePercept({ phase: 'p3', source: 'kernel' }, scored('p3', 8));
  assert('grounded', r.grounded === true);
  assert('phase = p3', r.groundedPhase === 'p3');
  assert('not divergent', r.divergent === false && r.salience === 'grounded-aligned');
  assert('high precision', r.precision > 0.6, 'w=' + r.precision);
  assert('prediction error ~0', r.predictionError.magnitude === 0, 'err=' + r.predictionError.magnitude);
})();

// T3 — evidence disagrees with prior (the signal)
(function () {
  console.log('T3: scored nodes disagree with prior ⇒ grounded-divergent');
  var r = PH.computePercept({ phase: 'p2', source: 'heuristic' }, scored('p7a', 8));
  assert('grounded', r.grounded === true);
  assert('winner flips to evidence phase p7a', r.groundedPhase === 'p7a', r.groundedPhase);
  assert('flagged divergent', r.divergent === true && r.salience === 'grounded-divergent');
  assert('prediction error > 0', r.predictionError.magnitude > 0, 'err=' + r.predictionError.magnitude);
  assert('weighted error > 0', r.predictionError.weighted > 0);
})();

// T4 — precision monotonicity
(function () {
  console.log('T4: precision rises with coverage and with count');
  var few = PH.computePercept({ phase: 'p3' }, scored('p3', 3));
  var many = PH.computePercept({ phase: 'p3' }, scored('p3', 12));
  assert('more scored ⇒ higher precision', many.precision > few.precision, few.precision + ' vs ' + many.precision);
  // same count, lower coverage (unscored dilute the map)
  var fullCov = PH.computePercept({ phase: 'p3' }, scored('p3', 5));
  var halfCov = PH.computePercept({ phase: 'p3' }, scored('p3', 5).concat(unscored('p3', 5)));
  assert('lower coverage ⇒ lower precision', halfCov.precision < fullCov.precision, fullCov.precision + ' vs ' + halfCov.precision);
})();

// T5 — below MIN_SCORED
(function () {
  console.log('T5: 1 scored node ⇒ ungrounded even if unanimous');
  var r = PH.computePercept({ phase: 'p2' }, scored('p7a', 1).concat(unscored('x', 1)));
  assert('ungrounded (below MIN_SCORED)', r.grounded === false, 'scored=' + r.evidence.scored);
  assert('holds prior', r.groundedPhase === 'p2');
})();

// T6 — partial coverage posterior between prior and evidence
(function () {
  console.log('T6: partial evidence ⇒ posterior between prior and evidence');
  var r = PH.computePercept({ phase: 'p2' }, scored('p3', 4).concat(unscored('p2', 6)));
  var dist = r.posterior.distribution;
  assert('both prior and evidence carry posterior mass', (dist.p2 || 0) > 0 && (dist.p3 || 0) > 0, JSON.stringify(dist));
  assert('precision strictly between 0 and 1', r.precision > 0 && r.precision < 1, 'w=' + r.precision);
})();

// T7 — ordinal error magnitude
(function () {
  console.log('T7: ordinal error magnitude scales with phase distance');
  var near = PH.computePercept({ phase: 'p2' }, scored('p3', 6));
  var far = PH.computePercept({ phase: 'p2' }, scored('p9', 6));
  assert('p2→p3 error < p2→p9 error', near.predictionError.magnitude < far.predictionError.magnitude,
    near.predictionError.magnitude + ' vs ' + far.predictionError.magnitude);
})();

// T8 — unscored with a phase is not evidence
(function () {
  console.log('T8: unscored .phase never counts as evidence');
  var r = PH.computePercept({ phase: 'p2' }, unscored('p9', 20));
  assert('zero scored despite 20 phases present', r.evidence.scored === 0);
  assert('ungrounded, prior held', r.grounded === false && r.groundedPhase === 'p2');
})();

// T9 — scored-but-ERROR phase excluded from evidence (real prod data hazard)
(function () {
  console.log('T9: scored node with ERROR/invalid phase is not evidence');
  var comps = scored('p3', 4).concat([{ phase: 'ERROR', scored: true }, { phase: 'UNKNOWN', scored: true }]);
  var r = PH.computePercept({ phase: 'p2' }, comps);
  assert('only the 4 valid phases counted as evidence', r.evidence.scored === 4, 'scored=' + r.evidence.scored);
  assert('invalid ones tallied separately', r.evidence.invalidScored === 2);
  assert('ERROR does not appear in the distribution', !('error' in r.evidence.distribution) && !('unknown' in r.evidence.distribution));
})();

// T10 — the REAL energy distribution pulled from prod (16 scored nodes, 2026-07-17)
(function () {
  console.log('T10: real prod energy distribution ⇒ grounded divergence from p5');
  var real = [];
  var add = function (p, n) { for (var i = 0; i < n; i++) real.push({ phase: p, scored: true }); };
  add('p8', 7); add('p0', 2); add('p3', 2); add('p4', 2); add('p10', 2); add('p1', 1);
  real.push({ name: 'Mapped-unscored-1', phase: 'p0', scored: false });
  real.push({ name: 'Mapped-unscored-2', phase: 'p0', scored: false });   // 18 mapped, 16 scored (matches prod)
  var r = PH.computePercept({ phase: 'p5', source: 'stress-heuristic' }, real);
  assert('grounded (16 scored, coverage ~0.89)', r.grounded === true && r.evidence.scored === 16, JSON.stringify({ g: r.grounded, s: r.evidence.scored, cov: r.evidence.coverage }));
  assert('precision high (~0.75)', r.precision > 0.6, 'w=' + r.precision);
  assert('grounded phase = p8 (companies mostly recovered), NOT the p5 heuristic', r.groundedPhase === 'p8', r.groundedPhase);
  assert('flagged divergent vs prior', r.divergent === true);
  assert('prediction error present (p5→p8)', r.predictionError.magnitude > 0, JSON.stringify(r.predictionError));
  console.log('    → live heuristic: p5/ENDURANCE  |  node-grounded: ' + r.groundedPhase +
    '  |  precision ' + r.precision + '  |  post-confidence ' + r.posterior.confidence +
    '  |  divergent=' + r.divergent);
})();

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
