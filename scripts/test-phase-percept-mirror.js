/**
 * scripts/test-phase-percept-mirror.js — drift guard.
 *
 * lib/phase-percept.js (server) and assets/js/limen-phase-percept.js (browser)
 * carry the same math in two places (browser can't require lib, handlers must
 * not require assets). This asserts they produce BYTE-IDENTICAL computePercept
 * output across a battery of cases, so a change to one that isn't mirrored to
 * the other fails CI instead of silently diverging in production.
 */
var LIB = require('../lib/phase-percept.js');
var BROWSER = require('../assets/js/limen-phase-percept.js');

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}
function scored(p, n) { var a = []; for (var i = 0; i < n; i++) a.push({ phase: p, scored: true }); return a; }

var cases = [
  { prior: { phase: 'p2' }, companies: [] },
  { prior: { phase: 'p3' }, companies: scored('p3', 8) },
  { prior: { phase: 'p2' }, companies: scored('p7a', 8) },
  { prior: { phase: 'p2' }, companies: scored('p3', 4).concat(scored('p2', 0)) },
  { prior: { phase: 'p5' }, companies: scored('p8', 7).concat(scored('p0', 2)).concat(scored('p3', 2)).concat(scored('p4', 2)).concat(scored('p10', 2)).concat(scored('p1', 1)).concat([{ phase: 'p0', scored: false }, { phase: 'p0', scored: false }]) },
  { prior: { phase: 'p2' }, companies: scored('p3', 4).concat([{ phase: 'ERROR', scored: true }]) },
  { prior: { phase: 'p9' }, companies: scored('p9', 1) },
  { prior: { phase: 'p1' }, companies: scored('p6', 3).concat(scored('p4', 3)) },
  { prior: { phase: 'p2' }, companies: [{ phase: 'P3a', scored: true }, { phase: 'P10b', scored: true }] },
  { prior: { phase: 'P7a' }, companies: scored('P7a', 2) },
  { prior: { phase: 'P7b' }, companies: scored('P7b', 2) },
  { prior: { phase: 'p2' }, companies: scored('P7a', 4).concat(scored('P7b', 4), [{ phase: 'P3a', scored: true }, { phase: 'P10b', scored: true }]) }
];

console.log('Mirror check: lib vs browser computePercept over ' + cases.length + ' cases');
for (var i = 0; i < cases.length; i++) {
  var a = LIB.computePercept(cases[i].prior, cases[i].companies);
  var b = BROWSER.computePercept(cases[i].prior, cases[i].companies);
  assert('case ' + i + ' identical', JSON.stringify(a) === JSON.stringify(b),
    '\n    lib=' + JSON.stringify(a) + '\n    brw=' + JSON.stringify(b));
}

// constants must match too
assert('W_FLOOR matches', LIB.W_FLOOR === BROWSER.W_FLOOR);
assert('MIN_SCORED matches', LIB.MIN_SCORED === BROWSER.MIN_SCORED);
assert('K_SAT matches', LIB.K_SAT === BROWSER.K_SAT);
assert('PHASE_ORDER matches', JSON.stringify(LIB.PHASE_ORDER) === JSON.stringify(BROWSER.PHASE_ORDER));

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
