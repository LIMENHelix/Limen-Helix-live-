/**
 * brain-v2/test/divergence-calibration.js — does the statistic mean what it claims?
 *
 *   node brain-v2/test/divergence-calibration.js
 *
 * WHY THIS FILE EXISTS. test/divergence.js verifies the arithmetic of the formula in
 * core/divergence.js: given these z-scores and these n, the code computes this number.
 * That is a tautology dressed as a test. It cannot tell you whether the number deserves
 * to be called a STANDARD ERROR, and the module makes a much stronger claim than
 * arithmetic — it says a gap of 2.0 is the conventional 5% level and 5.0 is p < 1e-6.
 *
 * A significance claim is only worth anything if the false-positive rate under the null
 * matches it. So this file builds the null on purpose: two channels observing THE SAME
 * latent, differing only by their own independent measurement noise, with no divergence
 * present anywhere. Every detection is then a false positive by construction, and the
 * rate is measurable rather than asserted.
 *
 * If the measured rate at 2.0 is near 5%, the label is earned. If it is not, the label
 * is wrong and the module must stop making it. This test reports the number either way
 * and asserts only what the measurement supports.
 *
 * DETERMINISTIC. A seeded LCG, not Math.random, so the reported rates are reproducible
 * and a regression is a real change rather than a reroll.
 */

'use strict';

var DIV = require('../core/divergence.js');
var CH = require('../core/channel.js');

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

/* ── a seeded generator ──────────────────────────────────────────────────────── */
function lcg(seed) {
  var s = seed >>> 0;
  return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function gaussian(rand) {
  // Box-Muller. Two uniforms in, one standard normal out.
  var u = Math.max(rand(), 1e-12), v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * ONE TRIAL UNDER THE NULL.
 *
 * A latent random walk. Two channels each observe it with their own independent noise
 * and build their own baseline exactly as core/channel.js does — the same Kalman filter,
 * the same departure() standardisation — so the z-scores fed to the statistic are
 * produced by the real pipeline rather than hand-written.
 *
 * There is NO divergence in this data. The two channels track one latent. Any detection
 * is a false positive.
 */
function nullTrial(rand, steps, noiseA, noiseB) {
  var a = CH.createChannel({ key: 'a', cadenceMs: 3600000, r: noiseA * noiseA });
  var b = CH.createChannel({ key: 'b', cadenceMs: 3600000, r: noiseB * noiseB });
  var latent = 0.5, t = 1e12, fired = 0, comparable = 0;

  for (var i = 0; i < steps; i++) {
    latent += gaussian(rand) * 0.02;                       // the shared truth
    var sa = CH.step(a, { value: latent + gaussian(rand) * noiseA }, t + i * 3600000);
    var sb = CH.step(b, { value: latent + gaussian(rand) * noiseB }, t + i * 3600000);
    if (!sa.fusable || !sb.fusable) continue;
    var g = DIV.gapStatistic(sa, sb, 'agree');
    if (!g.computable) continue;
    comparable++;
    if (g.standardizedGap >= DIV.DIVERGE_Z) fired++;
  }
  return { fired: fired, comparable: comparable };
}

function measureFalsePositiveRate(seed, trials, steps, noiseA, noiseB) {
  var rand = lcg(seed), fired = 0, comparable = 0;
  for (var i = 0; i < trials; i++) {
    var r = nullTrial(rand, steps, noiseA, noiseB);
    fired += r.fired; comparable += r.comparable;
  }
  return { rate: comparable ? fired / comparable : null, fired: fired, comparable: comparable };
}

// ── T1: THE MEASUREMENT ───────────────────────────────────────────────────────
console.log('T1: false-positive rate under a true shared latent');
var equal = measureFalsePositiveRate(12345, 40, 120, 0.05, 0.05);
console.log('      equal noise      : ' + (equal.rate * 100).toFixed(2) + '%  (' +
            equal.fired + '/' + equal.comparable + ' comparable readings fired)');

var uneven = measureFalsePositiveRate(6789, 40, 120, 0.02, 0.12);
console.log('      6x uneven noise  : ' + (uneven.rate * 100).toFixed(2) + '%  (' +
            uneven.fired + '/' + uneven.comparable + ')');

assert('the null produced enough comparable readings to measure anything',
  equal.comparable > 500, String(equal.comparable));

/* THE HONEST ASSERTION. The nominal claim is 5%. What this test enforces is the
   direction the module documents — that ignoring the positive covariance between two
   channels on one latent makes the test CONSERVATIVE, so the false-positive rate must
   come in at or below nominal. A rate ABOVE 5% would mean the module is over-detecting
   while claiming to under-detect, and the "p < 0.05" label would be false advertising. */
assert('false-positive rate at 2.0 se does not EXCEED the nominal 5%',
  equal.rate <= 0.05, (equal.rate * 100).toFixed(2) + '% — if this fails, the significance label is wrong');
assert('the same holds when the two channels have very different noise',
  uneven.rate <= 0.05, (uneven.rate * 100).toFixed(2) + '%');

// ── T2: how conservative, stated as a number ──────────────────────────────────
console.log('\nT2: how far below nominal, i.e. the cost of assuming zero covariance');
var ratio = equal.rate / 0.05;
console.log('      measured/nominal : ' + ratio.toFixed(3) +
            '  (1.0 would be exactly calibrated, below 1.0 is conservative)');
/* Recorded rather than asserted tightly. This number is the honest measure of how much
   sensitivity the zero-covariance assumption costs, and it is what a future correlation
   estimate should be judged against. */
assert('the conservatism is reported as a number, not left as a claim', isFinite(ratio));

// ── T3: the extreme threshold ─────────────────────────────────────────────────
console.log('\nT3: the 5.0 se threshold under the null');
var extremeFired = 0, extremeComparable = 0;
(function () {
  var rand = lcg(999), i, j;
  for (i = 0; i < 40; i++) {
    var a = CH.createChannel({ key: 'a', cadenceMs: 3600000, r: 0.0025 });
    var b = CH.createChannel({ key: 'b', cadenceMs: 3600000, r: 0.0025 });
    var latent = 0.5, t = 1e12;
    for (j = 0; j < 120; j++) {
      latent += gaussian(rand) * 0.02;
      var sa = CH.step(a, { value: latent + gaussian(rand) * 0.05 }, t + j * 3600000);
      var sb = CH.step(b, { value: latent + gaussian(rand) * 0.05 }, t + j * 3600000);
      if (!sa.fusable || !sb.fusable) continue;
      var g = DIV.gapStatistic(sa, sb, 'agree');
      if (!g.computable) continue;
      extremeComparable++;
      if (g.standardizedGap >= DIV.IMPLAUSIBLE_Z) extremeFired++;
    }
  }
})();
console.log('      at 5.0 se        : ' + extremeFired + '/' + extremeComparable +
            ' (' + ((extremeFired / extremeComparable) * 100).toFixed(3) + '%)');
assert('the extreme threshold is not routinely tripped by noise alone',
  extremeFired / extremeComparable < 0.01,
  (extremeFired / extremeComparable * 100).toFixed(3) + '%');

// ── T4: POWER. A conservative test that never fires is also useless ───────────
console.log('\nT4: it still detects a real divergence (a test that never fires is not conservative, it is deaf)');
(function () {
  var rand = lcg(4242), fired = 0, comparable = 0;
  for (var i = 0; i < 40; i++) {
    var a = CH.createChannel({ key: 'a', cadenceMs: 3600000, r: 0.0025 });
    var b = CH.createChannel({ key: 'b', cadenceMs: 3600000, r: 0.0025 });
    var la = 0.5, lb = 0.5, t = 1e12;
    for (var j = 0; j < 120; j++) {
      var shock = gaussian(rand) * 0.02;
      la += shock;
      lb += shock;
      // From the halfway point the two latents genuinely separate.
      if (j > 60) { la += 0.010; lb -= 0.010; }
      var sa = CH.step(a, { value: la + gaussian(rand) * 0.05 }, t + j * 3600000);
      var sb = CH.step(b, { value: lb + gaussian(rand) * 0.05 }, t + j * 3600000);
      if (!sa.fusable || !sb.fusable || j <= 60) continue;
      var g = DIV.gapStatistic(sa, sb, 'agree');
      if (!g.computable) continue;
      comparable++;
      if (g.standardizedGap >= DIV.DIVERGE_Z) fired++;
    }
  }
  var power = comparable ? fired / comparable : 0;
  console.log('      genuine split    : ' + (power * 100).toFixed(1) + '%  (' + fired + '/' + comparable + ')');
  assert('a real separation IS detected, so the conservatism has not made it deaf',
    power > 0.20, (power * 100).toFixed(1) + '% — detection rate on data that really does diverge');
})();

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
