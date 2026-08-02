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
  assert('both readings appear in the basis', d.basis.length === 3 && /price/.test(d.basis[0]) && /alerts/.test(d.basis[1]));
  assert('and the basis shows the gap AGAINST its standard error', /raw gap .* against a standard error/.test(d.basis[2]), d.basis[2]);
  assert('joint precision is the WEAKER side', d.jointPrecision === 1.0, String(d.jointPrecision));

  /* The raw 4.2 sd gap is still what a human reads, but the test is on the gap in
     units of ITS OWN standard error. Two already-standardised quantities differ by
     ~1.4 sd from their own noise alone, so 4.2 raw is 2.63 se. */
  assert('the standardized gap is reported alongside the raw one',
    Math.abs(d.standardizedGap - 4.2 / d.standardError) < 1e-9, String(d.standardizedGap));
  assert('and it is meaningfully smaller than the raw gap', d.standardizedGap < d.magnitude,
    d.standardizedGap.toFixed(2) + ' se vs ' + d.magnitude.toFixed(2) + ' sd');
})();

// ── T1b: the statistic itself ─────────────────────────────────────────────────
(function () {
  console.log('T1b: the gap is tested against its own spread, not a flat threshold');
  /* The bug this closes: subtracting two z-scores and comparing to a flat 2.0 treated
     the difference as though it were a single standardised quantity. It is not — each
     side already has unit variance, so their difference carries ~sqrt(2). */
  var wide = DIV.varianceOfZ(0, 12), thin = DIV.varianceOfZ(0, 3);
  assert('a thinner baseline yields a wider spread', thin > wide, thin + ' vs ' + wide);
  assert('unit variance is present even with a perfect baseline', DIV.varianceOfZ(0, 1e9) > 0.999);
  assert('a larger departure is itself less precisely estimated',
    DIV.varianceOfZ(4, 12) > DIV.varianceOfZ(0, 12));

  // Same raw gap, different baseline depth ⇒ different verdict. That is the point.
  function s(k, z, n) { return sensor(k, z, { n: n }); }
  var rel = [DIV.relate('a', 'b', 'x', 'agree', 'w')];
  var solid = DIV.detect([s('a', -1.6, 40), s('b', 1.6, 40)], rel);
  var flimsy = DIV.detect([s('a', -1.6, 3), s('b', 1.6, 3)], rel);
  assert('a 3.2 sd gap on deep baselines is believed', solid.detected, JSON.stringify(solid.why));
  assert('the SAME gap on 3-sample baselines is not', !flimsy.detected, JSON.stringify(flimsy.why));
  assert('because the thin one has a wider standard error',
    DIV.gapStatistic(s('a', -1.6, 3), s('b', 1.6, 3), 'agree').standardError >
    DIV.gapStatistic(s('a', -1.6, 40), s('b', 1.6, 40), 'agree').standardError);
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
  console.log('T9: divergences are ordered by significance');
  /* THIS TEST CHANGED, and the change is the finding. It used to pair 3.0 against 5.0
     and expect BOTH detected, because the old rule compared the raw gap to a flat 2.0.
     Under the corrected statistic a raw 3.0 sd gap between two channels each estimated
     from n=12 is 1.88 se — NOT significant. The old test was asserting a detection that
     the arithmetic does not support. Both magnitudes here are raised so the test
     measures ORDERING, which is what it was for. */
  var sensors = [sensor('a', 4.5), sensor('b', 0.0), sensor('c', 7.0), sensor('d', 0.0)];
  var r = DIV.detect(sensors, [
    DIV.relate('a', 'b', 'x', 'agree', 'w'),
    DIV.relate('c', 'd', 'y', 'agree', 'w')
  ]);
  assert('both detected', r.divergences.length === 2, JSON.stringify(r.why));
  assert('most significant first',
    r.divergences[0].standardizedGap > r.divergences[1].standardizedGap,
    JSON.stringify(r.divergences.map(function (x) { return x.standardizedGap.toFixed(2); })));

  // The old raw-threshold case, kept as a regression so it cannot creep back.
  var under = DIV.detect([sensor('a', 3.0), sensor('b', 0.0)], [DIV.relate('a', 'b', 'x', 'agree', 'w')]);
  assert('a raw 3.0 sd gap on n=12 is NOT significant, though the old rule fired on it',
    !under.detected, JSON.stringify(DIV.gapStatistic(sensor('a', 3.0), sensor('b', 0.0), 'agree')));
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

// ═══════════════════════════════════════════════════════════════════════════════
// THE RESOLUTION LIFECYCLE — SPEC B5's third requirement
//
// A divergence must not only be detected, it must CLOSE, with an outcome that says
// which of four quite different things it was. The tests above prove detection; these
// prove a claim opens once, keeps an identity while it stands, and resolves exactly
// once into an outcome a reader can act on.
// ═══════════════════════════════════════════════════════════════════════════════

var HOUR = 3600000;
function live(k, z) { return sensor(k, z, { n: 24 }); }
function gone(k) { return sensor(k, null, { fusable: false, state: 'dead' }); }
var REL = [DIV.relate('a', 'b', 'shared latent', 'agree', 'both track it')];
/* cadence must be present for a horizon to exist: 1h each ⇒ horizon 12h. */
function withCadence(s) { s.cadenceMs = HOUR; s.cadence = { state: 'measured', cadenceMs: HOUR }; return s; }
function pair(za, zb) { return [withCadence(live('a', za)), withCadence(live('b', zb))]; }

// ── T11: a claim opens once and keeps its identity ────────────────────────────
(function () {
  console.log('T11: a standing disagreement is ONE claim, not a new alert every cycle');
  var led = DIV.createLedger();
  var t = 1e12;
  var c1 = DIV.observe(led, pair(-2.2, 2.2), REL, t);
  assert('one claim opened', c1.opened.length === 1 && c1.resolved.length === 0, JSON.stringify(c1.why));
  var id = c1.opened[0].id;
  assert('it carries an id', typeof id === 'string' && /^dv_a~b@/.test(id), id);
  assert('and an evaluation horizon derived from the channels',
    c1.opened[0].horizonMs === 12 * HOUR, String(c1.opened[0].horizonMs));
  assert('the horizon states its derivation', /12 periods of the slower channel/.test(c1.opened[0].horizonWhy),
    c1.opened[0].horizonWhy);

  var c2 = DIV.observe(led, pair(-2.3, 2.3), REL, t + HOUR);
  assert('the next cycle does NOT open a second claim', c2.opened.length === 0, JSON.stringify(c2.why));
  assert('it updates the same one', c2.updated.length === 1 && c2.updated[0].id === id);
  assert('observations accumulate', c2.updated[0].observations === 2, String(c2.updated[0].observations));
  assert('and the peak tracks the worst reading so far',
    c2.updated[0].peak.standardizedGap > c1.opened[0].opening.standardizedGap);
  assert('exactly one claim is open', c2.openCount === 1);
})();

// ── T12: converged ────────────────────────────────────────────────────────────
(function () {
  console.log('T12: a gap that closes resolves as CONVERGED, not left hanging');
  var led = DIV.createLedger();
  var t = 1e12;
  DIV.observe(led, pair(-2.2, 2.2), REL, t);
  var out = DIV.observe(led, pair(0.1, 0.2), REL, t + 2 * HOUR);

  assert('resolved on the cycle the gap closed', out.resolved.length === 1, JSON.stringify(out.why));
  var r = out.resolved[0].resolution;
  assert('outcome is converged', r.outcome === DIV.OUTCOME.CONVERGED, r.outcome);
  assert('nothing left open', out.openCount === 0);
  assert('duration recorded', r.durationMs === 2 * HOUR, String(r.durationMs));
  assert('and the reason says the declaration survived', /declared relationship survives/.test(r.why), r.why);
  assert('a converged outcome is NOT confounded', r.confounded === null);
})();

// ── T13: THE one that matters. An outage is not a finding ─────────────────────
(function () {
  console.log('T13: a channel dropping out resolves as SENSOR FAILURE, never as a real split');
  var led = DIV.createLedger();
  var t = 1e12;
  DIV.observe(led, pair(-2.2, 2.2), REL, t);
  var out = DIV.observe(led, [withCadence(live('a', -2.2)), gone('b')], REL, t + HOUR);

  assert('the claim closed', out.resolved.length === 1, JSON.stringify(out.why));
  var r = out.resolved[0].resolution;
  assert('outcome is sensor_failure', r.outcome === DIV.OUTCOME.SENSOR, r.outcome);
  /* This is the whole reason the grader exists. Without it, an outage and a genuine
     regime split enter downstream reasoning as the same fact. */
  assert('and it says explicitly this is NOT evidence about the world',
    /NOT about|fact about our instruments/i.test(r.why), r.why);
  assert('it names the channel that went quiet', /b stopped reporting/.test(r.why), r.why);
  assert('a sensor failure is never graded persistent', r.outcome !== DIV.OUTCOME.PERSISTENT);
})();

// ── T14: persistent, and honest about what it cannot separate ─────────────────
(function () {
  console.log('T14: a gap that survives its horizon resolves as PERSISTENT, and says what it cannot prove');
  var led = DIV.createLedger();
  var t = 1e12, out = null;
  DIV.observe(led, pair(-2.2, 2.2), REL, t);
  for (var i = 1; i <= 12; i++) out = DIV.observe(led, pair(-2.2, 2.2), REL, t + i * HOUR);

  assert('resolved at the horizon, not before', out.resolved.length === 1, JSON.stringify(out.why));
  var r = out.resolved[0].resolution;
  assert('outcome is persistent', r.outcome === DIV.OUTCOME.PERSISTENT, r.outcome);
  assert('it took the full horizon', r.durationMs === 12 * HOUR, String(r.durationMs));
  /* The honesty requirement. A standing gap between two live channels fits BOTH a real
     regime split and a mis-declared relationship, and the record must not quietly pick
     the flattering one. */
  assert('and it declares the two hypotheses it CANNOT separate',
    r.confounded && r.confounded.hypotheses.length === 2 &&
    r.confounded.hypotheses.indexOf('wrong_relationship_declaration') >= 0,
    JSON.stringify(r.confounded));
  assert('and states what evidence would separate them',
    /independent third channel|longer prior history/.test(r.confounded.why), r.confounded.why);
})();

// ── T15: implausible ──────────────────────────────────────────────────────────
(function () {
  console.log('T15: a gap past p<1e-6 blames the declaration, not the world');
  var led = DIV.createLedger();
  var t = 1e12, out = null;
  DIV.observe(led, pair(-6, 6), REL, t);
  for (var i = 1; i <= 12; i++) out = DIV.observe(led, pair(-6, 6), REL, t + i * HOUR);
  var r = out.resolved[0].resolution;
  assert('outcome is implausible_declaration', r.outcome === DIV.OUTCOME.IMPLAUSIBLE, r.outcome);
  assert('the reason cites the significance, not just the size', /p < 1e-6/.test(r.why), r.why);
  assert('peak gap is recorded', r.peakGap >= DIV.IMPLAUSIBLE_Z, String(r.peakGap));
})();

// ── T16: no cadence means no horizon, and no invented persistence ─────────────
(function () {
  console.log('T16: without a cadence a claim is never graded persistent');
  var led = DIV.createLedger();
  var t = 1e12, out = null;
  // channels with no declared or measured cadence at all
  var s = function () { return [live('a', -2.2), live('b', 2.2)]; };
  var o1 = DIV.observe(led, s(), REL, t);
  assert('the claim still opens', o1.opened.length === 1);
  assert('but has no horizon', o1.opened[0].horizonMs === null && o1.opened[0].evaluateAt === null);
  assert('and says why rather than defaulting to one',
    /no defensible horizon/.test(o1.opened[0].horizonWhy), o1.opened[0].horizonWhy);

  for (var i = 1; i <= 500; i++) out = DIV.observe(led, s(), REL, t + i * HOUR);
  assert('it never auto-resolves, however long it stands', out.resolved.length === 0 && out.openCount === 1);
  /* Manufacturing a regime-separation finding out of ignorance about our own sampling
     rate would be exactly the kind of unearned claim this project keeps catching. */
  assert('so no persistent verdict was invented', led.closed.length === 0);
})();

// ── T17: the outcome history ──────────────────────────────────────────────────
(function () {
  console.log('T17: outcomes accumulate into an auditable history');
  var led = DIV.createLedger();
  var t = 1e12;
  assert('an empty ledger says UNMEASURED, not zero', /UNMEASURED, not empty/.test(DIV.report(led).why));

  // one converge, one sensor failure
  DIV.observe(led, pair(-2.2, 2.2), REL, t);
  DIV.observe(led, pair(0, 0), REL, t + HOUR);
  DIV.observe(led, pair(-2.2, 2.2), REL, t + 2 * HOUR);
  DIV.observe(led, [withCadence(live('a', -2.2)), gone('b')], REL, t + 3 * HOUR);

  var rep = DIV.report(led);
  assert('two resolved', rep.resolved === 2, JSON.stringify(rep.outcomes));
  assert('counted by outcome', rep.outcomes[DIV.OUTCOME.CONVERGED] === 1 && rep.outcomes[DIV.OUTCOME.SENSOR] === 1,
    JSON.stringify(rep.outcomes));
  assert('and grouped by the pair that produced them', rep.byPair['a~b'].total === 2);
  assert('a pair with mixed outcomes is not flagged suspect', rep.suspectDeclarations.length === 0);
})();

// ── T18: a declaration that never holds is surfaced ───────────────────────────
(function () {
  console.log('T18: a relationship that only ever fails is flagged for re-examination');
  var led = DIV.createLedger();
  var t = 1e12;
  for (var k = 0; k < 3; k++) {
    var base = t + k * 100 * HOUR;
    DIV.observe(led, pair(-6, 6), REL, base);
    for (var i = 1; i <= 12; i++) DIV.observe(led, pair(-6, 6), REL, base + i * HOUR);
  }
  var rep = DIV.report(led);
  assert('three resolutions, all bad', rep.resolved === 3, JSON.stringify(rep.outcomes));
  /* The point of keeping outcome history at all: over time it says which declared
     relationships keep failing, which is a question about OUR model, not the world. */
  assert('the declaration itself is flagged suspect', rep.suspectDeclarations.length === 1,
    JSON.stringify(rep.suspectDeclarations));
  assert('naming the pair', rep.suspectDeclarations[0].pair.join('~') === 'a~b');
})();

// ── T19: an open claim must survive restart ───────────────────────────────────
(function () {
  console.log('T19: open claims survive serialize/restore, or they can never resolve');
  var led = DIV.createLedger();
  var t = 1e12;
  var o = DIV.observe(led, pair(-2.2, 2.2), REL, t);
  var id = o.opened[0].id;

  var round = DIV.restoreLedger(JSON.parse(JSON.stringify(DIV.serializeLedger(led))));
  assert('the open claim came back', DIV.report(round).open === 1);

  // and it resolves against the RESTORED claim, keeping its original id and duration
  var after = DIV.observe(round, pair(0, 0), REL, t + 3 * HOUR);
  assert('it resolves after restart', after.resolved.length === 1, JSON.stringify(after.why));
  assert('with the same id it opened under', after.resolved[0].id === id, after.resolved[0].id);
  assert('and the duration spans the restart', after.resolved[0].resolution.durationMs === 3 * HOUR,
    String(after.resolved[0].resolution.durationMs));
})();

// ── T20: determinism ──────────────────────────────────────────────────────────
(function () {
  console.log('T20: the same inputs produce byte-identical ledgers');
  function run() {
    var led = DIV.createLedger(), t = 1e12;
    DIV.observe(led, pair(-2.2, 2.2), REL, t);
    DIV.observe(led, pair(-2.4, 2.4), REL, t + HOUR);
    DIV.observe(led, pair(0, 0), REL, t + 2 * HOUR);
    return JSON.stringify(DIV.serializeLedger(led));
  }
  assert('two independent runs match exactly', run() === run());
  assert('and the id contains no clock or random component', /^dv_a~b@1000000000000$/.test(JSON.parse(run()).closed[0].id),
    JSON.parse(run()).closed[0].id);
})();

// ── T21: end to end on the real energy binding ────────────────────────────────
(function () {
  console.log('T21: the lifecycle runs on 362 hours of real recorded energy');
  var B = require('../core/brain.js'), BIND = require('../bind/energy.js'), fs = require('fs'), path = require('path');
  var rows = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'energy-recorder.json'), 'utf8'))
    .rows.slice().sort(function (a, b) { return a.t - b.t; });
  var brain = B.createBrain(BIND.spec()), out = null;
  rows.forEach(function (r) { out = B.cycle(brain, BIND.readRecorderRow(r), r.t); });

  assert('the cycle carries a lifecycle result', !!out.divergence.lifecycle, JSON.stringify(Object.keys(out.divergence)));
  assert('and an outcome history', !!out.divergence.outcomes);
  var rep = out.divergence.outcomes;
  assert('every resolved claim has an outcome and a reason',
    brain.divergences.closed.every(function (c) { return c.resolution && c.resolution.outcome && c.resolution.why; }));
  assert('every open claim has an id and an opening gap',
    Object.keys(brain.divergences.open).every(function (k) {
      var c = brain.divergences.open[k];
      return c.id && c.opening && typeof c.opening.standardizedGap === 'number';
    }));
  assert('no claim is both open and closed', Object.keys(brain.divergences.open)
    .every(function (k) { return brain.divergences.open[k].status === 'open'; }));

  /* THE REAL RUN FIRES NOTHING, AND THAT IS A FINDING ABOUT THE BINDING.
     Replaying all 362 hours: 6 of the 7 declared energy relationships were skipped on
     EVERY single cycle because one side is permanently non-fusable — 11 of 18 energy
     channels are dead. Those six declarations are dead letters: they can never produce
     a divergence, in either direction, no matter what the world does. The seventh
     (gridRel/electricity) was comparable in 140 of 362 cycles and never cleared the
     threshold.

     So the lifecycle above is proven on constructed fixtures and UNEXERCISED on real
     data. Both facts are asserted here so neither can quietly change: if someone
     revives those channels this test will fail and demand the numbers be re-read. */
  var perPair = {};
  var brain2 = B.createBrain(BIND.spec());
  rows.forEach(function (r) {
    var o = B.cycle(brain2, BIND.readRecorderRow(r), r.t);
    BIND.RELATIONSHIPS.forEach(function (rel) {
      var k = rel.a + '/' + rel.b;
      perPair[k] = perPair[k] || { comparable: 0 };
      if (!o.divergence.skipped.some(function (s) { return s.pair === k; })) perPair[k].comparable++;
    });
  });
  var neverComparable = Object.keys(perPair).filter(function (k) { return perPair[k].comparable === 0; });
  assert('6 of 7 declared energy relationships can NEVER fire (one side permanently dead)',
    neverComparable.length === 6, neverComparable.join(', '));
  assert('the one live pair is gridRel/electricity', perPair['gridRel/electricity'].comparable > 100,
    String(perPair['gridRel/electricity'].comparable));
  assert('and even it never cleared the threshold on this corpus', rep.resolved === 0 && rep.open === 0,
    JSON.stringify(rep.outcomes));

  console.log('      real run: ' + rep.open + ' open, ' + rep.resolved + ' resolved');
  console.log('      DEAD-LETTER DECLARATIONS (never comparable in 362 cycles): ' + neverComparable.join(', '));
  console.log('      gridRel/electricity comparable in ' + perPair['gridRel/electricity'].comparable +
              '/362 cycles, never past ' + DIV.DIVERGE_Z + ' se');
})();

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
