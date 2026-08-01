/**
 * brain-v2/test/divergence.js — SPEC row 10.
 *
 *   node brain-v2/test/divergence.js
 *
 * Divergence is hard to prove on real data, because it only fires when two
 * genuinely related channels disagree, which is by construction uncommon. Waiting
 * for a real disagreement to arrive is not a test. So these are constructed sensor
 * fixtures: they are SYNTHETIC on purpose, and they exist to prove the mechanism
 * fires, refuses, and refuses for the right reason.
 *
 * The real-data runs are reported separately and are not a substitute for this.
 */

'use strict';

var DIV = require('../core/divergence.js');

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

/** A minimally shaped sensor, as core/brain.js cycle() emits them. */
function sensor(key, z, opts) {
  opts = opts || {};
  return {
    key: key,
    state: opts.state || 'measured',
    fusable: opts.fusable !== undefined ? opts.fusable : true,
    precision: opts.precision !== undefined ? opts.precision : 1.0,
    departure: z === null ? null : { z: z, mean: 0.5, sd: 0.1, n: opts.n || 12 }
  };
}

// ── T1: the case the whole file exists for ────────────────────────────────────
(function () {
  console.log('T1: two live channels pointing opposite ways are reported, not averaged');
  var sensors = [sensor('price', -1.8), sensor('alerts', 2.4)];
  var rel = [DIV.relate('price', 'alerts', 'grid stress', 'agree', 'both track strain')];
  var r = DIV.detect(sensors, rel);

  assert('divergence detected', r.detected, JSON.stringify(r.why));
  assert('one pair compared', r.comparable === 1, String(r.comparable));
  var d = r.divergences[0];
  assert('the gap is the full 4.2 sd, not the 0.3 sd mean', Math.abs(d.magnitude - 4.2) < 1e-9, String(d.magnitude));
  assert('the leading channel is named', d.leading === 'alerts', d.leading);
  assert('the latent variable is carried', d.latent === 'grid stress', d.latent);
  assert('both readings appear in the basis', d.basis.length === 2 && /price/.test(d.basis[0]) && /alerts/.test(d.basis[1]));
  assert('joint precision is the WEAKER side', d.jointPrecision === 1.0, String(d.jointPrecision));
})();

// ── T2: agreement is silence ──────────────────────────────────────────────────
(function () {
  console.log('T2: channels that agree produce no signal');
  var sensors = [sensor('a', 1.9), sensor('b', 2.1)];
  var r = DIV.detect(sensors, [DIV.relate('a', 'b', 'x', 'agree', 'w')]);
  assert('0.2 sd apart is not a divergence', !r.detected, JSON.stringify(r.divergences));
  assert('but the pair WAS compared', r.comparable === 1);
  assert('and the reason says so', /all within/.test(r.why), r.why);
})();

// ── T3: an inverting pair is judged on the flipped sign ───────────────────────
(function () {
  console.log('T3: a declared inverting pair agrees when it moves oppositely');
  // Equal and opposite is AGREEMENT for an inverting pair.
  var opposed = DIV.detect([sensor('coal', 2.0), sensor('solar', -2.0)],
    [DIV.relate('coal', 'solar', 'displacement', 'invert', 'two faces of one transition')]);
  assert('equal and opposite ⇒ no divergence', !opposed.detected, JSON.stringify(opposed.divergences));

  // Moving TOGETHER is the anomaly for this pair.
  var together = DIV.detect([sensor('coal', 2.2), sensor('solar', 2.2)],
    [DIV.relate('coal', 'solar', 'displacement', 'invert', 'two faces of one transition')]);
  assert('moving together ⇒ divergence', together.detected, JSON.stringify(together.why));
  assert('gap is 4.4 sd after the sign flip', Math.abs(together.divergences[0].magnitude - 4.4) < 1e-9,
    String(together.divergences[0].magnitude));
  assert('the basis says the sign was flipped', /sign flipped/.test(together.divergences[0].basis[1]));
})();

// ── T4: silence is not disagreement ───────────────────────────────────────────
(function () {
  console.log('T4: a channel that has not spoken cannot disagree');
  var dead = DIV.detect([sensor('a', 2.5), sensor('b', -2.5, { fusable: false, state: 'dead' })],
    [DIV.relate('a', 'b', 'x', 'agree', 'w')]);
  assert('a dead partner ⇒ no divergence claimed', !dead.detected);
  assert('and it is SKIPPED, not silently passed', dead.skipped.length === 1, JSON.stringify(dead.skipped));
  assert('the skip names the dead channel and why', /b is not fusable \(dead\)/.test(dead.skipped[0].why), dead.skipped[0].why);
  assert('comparable count is 0', dead.comparable === 0);

  var nobase = DIV.detect([sensor('a', 2.5), sensor('b', null)],
    [DIV.relate('a', 'b', 'x', 'agree', 'w')]);
  assert('a null departure is not read as zero', !nobase.detected && nobase.skipped.length === 1,
    JSON.stringify(nobase.skipped));
  assert('and the reason says null is not zero', /which is not zero/.test(nobase.skipped[0].why), nobase.skipped[0].why);
})();

// ── T5: "none found" and "none checkable" must not look alike ─────────────────
(function () {
  console.log('T5: unmeasured is distinguishable from absent');
  var none = DIV.detect([sensor('a', 0.1), sensor('b', 0.2)], [DIV.relate('a', 'b', 'x', 'agree', 'w')]);
  var cannot = DIV.detect([sensor('a', 0.1, { fusable: false, state: 'absent' })],
    [DIV.relate('a', 'b', 'x', 'agree', 'w')]);
  assert('checked-and-clear says "all within"', /all within/.test(none.why), none.why);
  assert('could-not-check says UNMEASURED', /UNMEASURED, not absent/.test(cannot.why), cannot.why);
  assert('the two reasons differ', none.why !== cannot.why);
})();

// ── T6: only declared pairs are ever compared ─────────────────────────────────
(function () {
  console.log('T6: undeclared channels are never compared, however far apart');
  var sensors = [sensor('crude', -3.0), sensor('weather', 3.0)];
  var r = DIV.detect(sensors, []);            // nothing declared
  assert('no relationships ⇒ nothing compared', r.comparable === 0 && !r.detected);
  assert('a 6 sd gap between unrelated channels is correctly ignored', r.divergences.length === 0);
})();

// ── T7: an implausible gap is flagged as a bad declaration ────────────────────
(function () {
  console.log('T7: an impossible gap reads as a wrong declaration, not a real disagreement');
  var r = DIV.detect([sensor('a', 6.0), sensor('b', -6.0)], [DIV.relate('a', 'b', 'x', 'agree', 'w')]);
  assert('detected', r.detected);
  assert('flagged implausible at 12 sd', r.divergences[0].implausible === true, String(r.divergences[0].magnitude));
  assert('the note points at the declaration, not the world',
    /wrong relationship declaration/.test(r.divergences[0].note), r.divergences[0].note);
})();

// ── T8: a relationship must justify itself ────────────────────────────────────
(function () {
  console.log('T8: a relationship cannot be declared without naming what it shares');
  var threw = false;
  try { DIV.relate('a', 'b', '', 'agree', 'w'); } catch (e) { threw = /name the latent variable/.test(e.message); }
  assert('an unnamed latent variable is refused', threw);

  var self = false;
  try { DIV.relate('a', 'a', 'x', 'agree', 'w'); } catch (e) { self = /cannot diverge from itself/.test(e.message); }
  assert('a channel cannot be related to itself', self);

  var bad = false;
  try { DIV.relate('a', 'b', 'x', 'sometimes', 'w'); } catch (e) { bad = /expect must be/.test(e.message); }
  assert('an unknown expectation is refused', bad);
})();

// ── T9: strongest disagreement first ──────────────────────────────────────────
(function () {
  console.log('T9: divergences are ordered by magnitude');
  var sensors = [sensor('a', 3.0), sensor('b', 0.0), sensor('c', 5.0), sensor('d', 0.0)];
  var r = DIV.detect(sensors, [
    DIV.relate('a', 'b', 'x', 'agree', 'w'),
    DIV.relate('c', 'd', 'y', 'agree', 'w')
  ]);
  assert('both detected', r.divergences.length === 2);
  assert('largest first', r.divergences[0].magnitude === 5 && r.divergences[1].magnitude === 3,
    JSON.stringify(r.divergences.map(function (x) { return x.magnitude; })));
})();

// ── T10: the real binding declares real pairs ─────────────────────────────────
(function () {
  console.log('T10: the energy binding declares usable relationships');
  var BIND = require('../bind/energy.js');
  var keys = {};
  BIND.CHANNELS.forEach(function (c) { keys[c.key] = 1; });
  var rels = BIND.RELATIONSHIPS || [];
  assert('relationships are declared', rels.length >= 5, String(rels.length));
  var unknown = [];
  rels.forEach(function (r) {
    if (!keys[r.a]) unknown.push(r.a);
    if (!keys[r.b]) unknown.push(r.b);
  });
  assert('every related channel exists in the manifest', unknown.length === 0, unknown.join(', '));
  assert('every relationship names its latent variable', rels.every(function (r) { return !!r.latent; }));
  assert('at least one inverting pair is declared', rels.some(function (r) { return r.expect === 'invert'; }));
})();

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
