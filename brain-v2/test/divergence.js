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
    departure: z === null ? null : { z: z, mean: 0.5, sd: 0.1, n: opts.n === undefined ? 12 : opts.n }
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
/**
 * A pair carrying ADAPTER-SUPPLIED observation identity — a distinct upstream record each
 * cycle, which is what genuine new evidence looks like.
 *
 * Deliberately `sourceIdentity`, not `sampleAt`. sampleAt is a LOCAL CADENCE CLOCK and
 * advances for a cached value that merely crosses a period boundary; keying evidence on
 * it was the third wrong answer to this question. Only the adapter can say that the
 * source produced a new record. T30 proves the real-channel behaviour; these shaped
 * sensors keep the lifecycle tests readable without re-deriving a baseline in each one.
 */
var _rec = 0;
function moving(za, zb) {
  var id = 'rec-' + (++_rec);
  var sa = withCadence(live('a', za)), sb = withCadence(live('b', zb));
  sa.sourceIdentity = 'oid:a-' + id; sb.sourceIdentity = 'oid:b-' + id;
  return [sa, sb];
}
/**
 * REAL SENSORS, from core/channel.js step(), not handmade objects.
 *
 * The previous version of this helper set `updates` by hand to make a cycle look like
 * new evidence. That tested my own comment rather than the runtime — and the comment was
 * wrong: channel.js increments `updates` on every poll, unchanged value or not. A
 * fixture built from an assumption cannot check that assumption.
 *
 * `feed` drives genuine channel.step() calls, so sampleAt, departure, precision,
 * liveness and the cadence verdict all come from the real pipeline.
 */
var CH = require('../core/channel.js');
function makePair(cadenceMs) {
  return {
    a: CH.createChannel({ key: 'a', cadenceMs: cadenceMs, r: 0.01 }),
    b: CH.createChannel({ key: 'b', cadenceMs: cadenceMs, r: 0.01 }),
    t: 1e12, i: 0
  };
}
/** One real cycle: both channels observe, at the channel's own cadence. */
function feed(P, va, vb, stepMs) {
  var at = P.t + (P.i++) * (stepMs || HOUR);
  return [CH.step(P.a, { value: va }, at), CH.step(P.b, { value: vb }, at)];
}
/** Build a baseline deep enough that departure() is defined, then diverge. */
function baselined(P, n) {
  for (var i = 0; i < (n || 14); i++) feed(P, 0.50 + (i % 4) * 0.01, 0.50 + (i % 4) * 0.01);
  return P;
}

// ── T11: a claim opens once and keeps its identity ────────────────────────────
(function () {
  console.log('T11: a standing disagreement is ONE claim, not a new alert every cycle');
  var led = DIV.createLedger();
  var t = 1e12;
  var c1 = DIV.observe(led, moving(-2.2, 2.2), REL, t);
  assert('one claim opened', c1.opened.length === 1 && c1.resolved.length === 0, JSON.stringify(c1.why));
  var id = c1.opened[0].id;
  /* The id must be unique to the RELATIONSHIP, not just the channel pair — see T22. */
  assert('it carries an id naming the full relationship',
    typeof id === 'string' && /^dv_a~b~shared latent~agree@/.test(id), id);
  assert('and an evaluation horizon derived from the channels',
    c1.opened[0].horizonMs === 12 * HOUR, String(c1.opened[0].horizonMs));
  assert('the horizon states its derivation', /12 periods of the slower channel/.test(c1.opened[0].horizonWhy),
    c1.opened[0].horizonWhy);

  var c2 = DIV.observe(led, moving(-2.3, 2.3), REL, t + HOUR);   // a genuinely new upstream record
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
  DIV.observe(led, moving(-2.2, 2.2), REL, t);
  for (var i = 1; i <= 12; i++) out = DIV.observe(led, moving(-2.2, 2.2), REL, t + i * HOUR);

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
  DIV.observe(led, moving(-6, 6), REL, t);
  for (var i = 1; i <= 12; i++) out = DIV.observe(led, moving(-6, 6), REL, t + i * HOUR);
  var r = out.resolved[0].resolution;
  /* Renamed from implausible_declaration. Significance cannot tell a wrong declaration
     from a genuine structural break, so the outcome no longer asserts which it is. */
  assert('outcome is extreme_persistent', r.outcome === DIV.OUTCOME.EXTREME, r.outcome);
  assert('the reason cites the MEASURED null behaviour, not an unearned p-value',
    /never fired under a simulated shared latent/.test(r.why) && !/1e-6/.test(r.why), r.why);
  assert('peak gap is recorded', r.peakGap >= DIV.IMPLAUSIBLE_Z, String(r.peakGap));
  assert('and extreme is confounded too — size does not settle the cause',
    r.confounded && r.confounded.hypotheses.indexOf('wrong_relationship_declaration') >= 0 &&
    /structural break/.test(r.confounded.why), JSON.stringify(r.confounded));
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
  assert('and grouped by the RELATIONSHIP that produced them',
    rep.byRelationship['a~b~shared latent~agree'].total === 2, JSON.stringify(Object.keys(rep.byRelationship)));
  assert('a pair with mixed outcomes is not flagged suspect', rep.suspectDeclarations.length === 0);
})();

// ── T18: a declaration that never holds is surfaced ───────────────────────────
(function () {
  console.log('T18: a relationship that only ever fails is flagged for re-examination');
  var led = DIV.createLedger();
  var t = 1e12;
  for (var k = 0; k < 3; k++) {
    var base = t + k * 100 * HOUR;
    DIV.observe(led, moving(-6, 6), REL, base);
    for (var i = 1; i <= 12; i++) DIV.observe(led, moving(-6, 6), REL, base + i * HOUR);
  }
  var rep = DIV.report(led);
  assert('three resolutions, all bad', rep.resolved === 3, JSON.stringify(rep.outcomes));
  /* The point of keeping outcome history at all: over time it says which declared
     relationships keep failing, which is a question about OUR model, not the world. */
  assert('the declaration itself is flagged suspect', rep.suspectDeclarations.length === 1,
    JSON.stringify(rep.suspectDeclarations));
  assert('naming the pair', rep.suspectDeclarations[0].pair.join('~') === 'a~b');
  assert('and the latent it was declared over', rep.suspectDeclarations[0].latent === 'shared latent',
    rep.suspectDeclarations[0].latent);
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
  assert('and the id contains no clock or random component',
    /^dv_a~b~shared latent~agree@1000000000000$/.test(JSON.parse(run()).closed[0].id),
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

// ═══════════════════════════════════════════════════════════════════════════════
// REGRESSIONS — every defect found in review on 2026-08-02, pinned so it cannot
// return quietly. Each was reproduced before it was fixed.
// ═══════════════════════════════════════════════════════════════════════════════

// ── T22: garbage in must not read as calm ─────────────────────────────────────
(function () {
  console.log('T22: a non-finite reading is UNMEASURABLE, never "no divergence"');
  /* The failure: NaN produced magnitude NaN, se NaN, and standardizedGap 0 — because
     `se > 0` is false for NaN. Infinity produced a NaN gap, and `NaN >= threshold` is
     also false. Either way a broken channel silently reported agreement, which is the
     worst possible direction for this module to fail. */
  [['NaN', NaN], ['Infinity', Infinity], ['-Infinity', -Infinity]].forEach(function (c) {
    var g = DIV.gapStatistic(sensor('a', c[1]), sensor('b', 0), 'agree');
    assert(c[0] + ' departure is not computable', g.computable === false, JSON.stringify(g));
    assert(c[0] + ' says UNMEASURABLE rather than agreement', /UNMEASURABLE, not agreement/.test(g.why), g.why);

    var r = DIV.detect([sensor('a', c[1]), sensor('b', 0)], [DIV.relate('a', 'b', 'x', 'agree', 'w')]);
    assert(c[0] + ' is skipped with a reason, not counted as comparable',
      r.comparable === 0 && r.skipped.length === 1 && r.skipped[0].reason === 'not_computable',
      JSON.stringify(r.skipped));
  });
})();

// ── T23: no baseline is not a confident baseline ──────────────────────────────
(function () {
  console.log('T23: n=0 abstains rather than posing as certainty');
  /* varianceOfZ returned 1 for n<1, which made a channel with ZERO baseline samples
     look more certain than one with a single sample (2.0 vs 5.125 total variance). */
  assert('n=0 is not computable', DIV.varianceOfZ(2.5, 0) === null, String(DIV.varianceOfZ(2.5, 0)));
  assert('n undefined is not computable', DIV.varianceOfZ(2.5, undefined) === null);
  assert('n=1 IS computable, and wide', DIV.varianceOfZ(2.5, 1) > 5);
  assert('and a zero-baseline pair is skipped, not compared',
    DIV.detect([sensor('a', 2.5, { n: 0 }), sensor('b', 0)], [DIV.relate('a', 'b', 'x', 'agree', 'w')]).comparable === 0);
})();

// ── T24: identity must include the whole declaration ──────────────────────────
(function () {
  console.log('T24: two relationships over the same pair get DIFFERENT ids');
  /* The id was pair + time, omitting latent and expect, so two declarations relating
     the same two channels through different latents opened with byte-identical ids and
     report() pooled their outcomes. An id that collides is not an id. */
  var led = DIV.createLedger(), t = 1e12;
  var two = [DIV.relate('a', 'b', 'latent ONE', 'agree', 'w'),
             DIV.relate('a', 'b', 'latent TWO', 'agree', 'w')];
  var o = DIV.observe(led, pair(-2.2, 2.2), two, t);
  assert('both opened', o.opened.length === 2, String(o.opened.length));
  assert('with distinct ids', o.opened[0].id !== o.opened[1].id,
    o.opened[0].id + ' vs ' + o.opened[1].id);
  assert('each naming its own latent', /latent ONE/.test(o.opened[0].id) && /latent TWO/.test(o.opened[1].id));

  DIV.observe(led, pair(0, 0), two, t + HOUR);
  var rep = DIV.report(led);
  assert('and report() keeps them apart', Object.keys(rep.byRelationship).length === 2,
    JSON.stringify(Object.keys(rep.byRelationship)));
  assert('each with its own count of 1',
    Object.keys(rep.byRelationship).every(function (k) { return rep.byRelationship[k].total === 1; }));
})();

// ── T25: time passing is not evidence arriving ────────────────────────────────
(function () {
  console.log('T25: persistence needs OBSERVATIONS, not just a clock');
  /* The failure: `now >= evaluateAt` alone. A process down for 12h that came back with
     one reading resolved `persistent` from two observations. */
  var led = DIV.createLedger(), t = 1e12;
  DIV.observe(led, moving(-2.2, 2.2), REL, t);
  var out = DIV.observe(led, moving(-2.2, 2.2), REL, t + 12 * HOUR);   // horizon elapsed, 2 observations

  assert('it does NOT resolve on the clock alone', out.resolved.length === 0, JSON.stringify(out.why));
  assert('it stays open', out.openCount === 1);
  assert('and says it is waiting for evidence, not for time',
    /waiting for evidence, not for the clock/.test(out.updated[0].pending), out.updated[0].pending);

  // Feed the missing observations; it resolves on whichever cycle earns it.
  var got = [];
  for (var i = 13; i <= 20; i++) {
    got = got.concat(DIV.observe(led, moving(-2.2, 2.2), REL, t + i * HOUR).resolved);
  }
  assert('once enough observations arrive it resolves', got.length === 1, String(got.length));
  assert('with at least the minimum observation count',
    got[0].resolution.observations >= DIV.MIN_OBSERVATIONS,
    String(got[0].resolution.observations));
  assert('and it is persistent, earned by evidence rather than elapsed time',
    got[0].resolution.outcome === DIV.OUTCOME.PERSISTENT, got[0].resolution.outcome);
})();

// ── T26: a spike does not brand a declaration for good ────────────────────────
(function () {
  console.log('T26: the verdict is the STANDING gap, not the worst reading ever seen');
  /* Classification ran off `peak`, so one extreme reading that decayed to a moderate
     standing gap still resolved as an implausible declaration. */
  var led = DIV.createLedger(), t = 1e12, got = [];
  DIV.observe(led, pair(-6, 6), REL, t);                                   // one spike
  for (var i = 1; i <= 14; i++) {                                          // then moderate
    got = got.concat(DIV.observe(led, moving(-2.2, 2.2), REL, t + i * HOUR).resolved);
  }
  assert('it resolved exactly once', got.length === 1, String(got.length));
  var r = got[0].resolution;
  assert('the peak is still recorded', r.peakGap > DIV.IMPLAUSIBLE_Z, String(r.peakGap));
  assert('but the verdict follows the final gap', r.finalGap < DIV.IMPLAUSIBLE_Z, String(r.finalGap));
  assert('so it is persistent, not extreme', r.outcome === DIV.OUTCOME.PERSISTENT, r.outcome);
})();

// ── T27: a withdrawn declaration must not strand its claim ────────────────────
(function () {
  console.log('T27: removing a declaration closes its open claim rather than orphaning it');
  /* observe() iterated only CURRENT relationships, so a claim whose declaration was
     removed sat open forever — invisible to the grader and still counted as open. */
  var led = DIV.createLedger(), t = 1e12;
  DIV.observe(led, pair(-2.2, 2.2), REL, t);
  assert('one claim open', Object.keys(led.open).length === 1);

  var out = DIV.observe(led, pair(-2.2, 2.2), [], t + HOUR);   // declaration withdrawn
  assert('the claim is closed, not stranded', Object.keys(led.open).length === 0 && out.resolved.length === 1,
    JSON.stringify(out.why));
  var r = out.resolved[0].resolution;
  assert('outcome names the withdrawal', r.outcome === DIV.OUTCOME.WITHDRAWN, r.outcome);
  assert('and says it is a change to OUR model, not a finding about the world',
    /change to our own model/.test(r.why), r.why);
})();

// ── T28: the closed list cannot grow without bound ────────────────────────────
(function () {
  console.log('T28: resolved history is bounded, and what was dropped is counted');
  /* ledger.closed grew forever and lives inside every snapshot, so snapshots grew
     without limit for as long as the process ran. */
  var led = DIV.createLedger(), t = 1e12;
  for (var i = 0; i < DIV.CLOSED_CAP + 25; i++) {
    var base = t + i * 100 * HOUR;
    DIV.observe(led, pair(-2.2, 2.2), REL, base);
    DIV.observe(led, pair(0, 0), REL, base + HOUR);
  }
  assert('the retained list is capped', led.closed.length === DIV.CLOSED_CAP, String(led.closed.length));
  assert('and the drops are counted, not silently forgotten', led.droppedClosed === 25, String(led.droppedClosed));
  var rep = DIV.report(led);
  assert('the report says so rather than reading as a quiet history',
    /older ones trimmed past the/.test(rep.why), rep.why);
})();

// ── T29: THE PATH THE APPLICATION ACTUALLY TAKES ──────────────────────────────
(function () {
  console.log('T29: an open claim survives LOOP.serialize/restore, not just DIV.serializeLedger');
  /* THE DEFECT THIS EXISTS FOR, and it is the sharpest lesson in this file.
     T19 above round-trips the ledger through DIV.serializeLedger and passed happily.
     But the application never calls that — it persists through kernel/loop.js
     serialize(), which saved channels, history and cycles and omitted
     brain.divergences entirely. So the claim "open claims survive restart" was true of
     the helper I wrote and false of the path anything real uses: every open divergence
     vanished on restart and could never resolve.

     A test that exercises a helper directly, under fixtures chosen by the same person
     who wrote the helper, confirms itself. This one goes through the real serialize. */
  var LOOP = require('../kernel/loop.js');
  var fs = require('fs'), os = require('os'), path = require('path');

  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'divloop-'));
  var HR = 3600000, t0 = 1e12;

  // Two channels declared to observe one latent, driven so they genuinely disagree.
  var spec = {
    domain: 'testdom',
    storeDir: dir,
    brainSpec: {
      domain: 'testdom', version: 'test/1', levelsPerSensor: 3,
      channels: [
        { key: 'up', source: 'synthetic', cadenceMs: HR, units: 'x' },
        { key: 'down', source: 'synthetic', cadenceMs: HR, units: 'x' }
      ],
      findings: [],
      relationships: [DIV.relate('up', 'down', 'one latent', 'agree', 'declared for this test')],
      efferent: null
    }
  };

  var loop = LOOP.create(spec);
  // Baselines first (both wander together), then a hard split.
  var i, v;
  for (i = 0; i < 30; i++) {
    v = 0.5 + (i % 5) * 0.01;
    LOOP.tick(loop, { up: { value: v }, down: { value: v } }, t0 + i * HR);
  }
  for (i = 30; i < 40; i++) {
    LOOP.tick(loop, { up: { value: 0.9 + (i % 3) * 0.01 }, down: { value: 0.1 - (i % 3) * 0.01 } }, t0 + i * HR);
  }

  var openBefore = Object.keys(loop.brain.divergences.open).length;
  assert('a divergence claim is genuinely open before the restart', openBefore > 0,
    'open=' + openBefore + ' — if this is 0 the test proves nothing, so it fails loudly rather than passing vacuously');

  var idsBefore = Object.keys(loop.brain.divergences.open)
    .map(function (k) { return loop.brain.divergences.open[k].id; }).sort().join(',');

  /* THROUGH THE REAL SERIALIZER, and through JSON, exactly as the store writes it. */
  var snap = JSON.parse(JSON.stringify(LOOP.serialize(loop)));
  var revived = LOOP.restore(spec, snap);

  var openAfter = Object.keys(revived.brain.divergences.open).length;
  var idsAfter = Object.keys(revived.brain.divergences.open)
    .map(function (k) { return revived.brain.divergences.open[k].id; }).sort().join(',');

  assert('the open claim survives LOOP.serialize -> LOOP.restore', openAfter === openBefore,
    openBefore + ' -> ' + openAfter);
  assert('with the same claim ids', idsAfter === idsBefore, idsBefore + ' -> ' + idsAfter);
  assert('and the serialized snapshot actually contains the ledger', !!snap.divergences,
    JSON.stringify(Object.keys(snap)).slice(0, 200));

  // And it must be able to RESOLVE after the restart, which is the point of persisting it.
  for (i = 40; i < 50; i++) {
    LOOP.tick(revived, { up: { value: 0.5 }, down: { value: 0.5 } }, t0 + i * HR);
  }
  assert('and the restored claim can then resolve, which is why it had to persist',
    revived.brain.divergences.closed.length > 0,
    'closed=' + revived.brain.divergences.closed.length);

  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* best effort */ }
})();

// ── T30: repeated polling is not evidence (REAL channels) ────────────────────
(function () {
  console.log('T30: polling the same reading is ONE observation — proved on real channel.step()');
  /* THIS TEST WAS WRONG BEFORE, and the way it was wrong is the lesson. It set
     `updates` by hand to simulate "no new data", on my comment that channel.js only
     advances updates for genuinely new readings. It does not — it advances on every
     poll. So the production bug survived while the test went green. This version drives
     real channels and never fabricates their internals. */
  var P = baselined(makePair(HOUR));
  var led = DIV.createLedger();

  // Diverge, then poll the SAME values many times inside one cadence period.
  var sensors = feed(P, 0.90, 0.10);
  DIV.observe(led, sensors, REL, P.t);
  var claim = led.open[Object.keys(led.open)[0]];
  assert('a claim opened on real sensors', !!claim, JSON.stringify(Object.keys(led.open)));

  /* Confirm the trap is real: updates DOES advance on unchanged re-reads, so anything
     counting evidence from it would count these. */
  var before = { updates: sensors[0].updates, sampleAt: sensors[0].sampleAt };
  var repeats = [], at = P.t + 3600000;
  for (var i = 0; i < 20; i++) {
    at += 60000;                                   // poll every minute, cadence is hourly
    repeats = [CH.step(P.a, { value: 0.90 }, at), CH.step(P.b, { value: 0.10 }, at)];
    DIV.observe(led, repeats, REL, at);
  }
  assert('updates DID advance on the repeats (the trap the old test hid)',
    repeats[0].updates > before.updates, before.updates + ' -> ' + repeats[0].updates);
  assert('but sampleAt advanced at most once per cadence period',
    repeats[0].sampleAt - before.sampleAt <= 3600000,
    String(repeats[0].sampleAt - before.sampleAt));
  assert('so sub-cadence polling did not manufacture observations',
    claim.slowObservations < DIV.MIN_OBSERVATIONS,
    claim.slowObservations + ' slow-side observations after 20 extra polls');
  assert('and the repeats are counted, not discarded silently', claim.repeatPolls > 0,
    String(claim.repeatPolls));
  assert('the claim has NOT resolved on polling alone', claim.status === 'open', claim.status);
})();

// ── T31: the relationship key cannot collide ──────────────────────────────────
(function () {
  console.log('T31: delimiters inside channel names or latents cannot forge a collision');
  /* Raw concatenation with ~ is ambiguous: ('a~b','c') and ('a','b~c') produce the same
     string, so two different declarations would share one ledger slot and one id. */
  var led = DIV.createLedger(), t = 1e12;
  var tricky = [
    DIV.relate('a~b', 'c', 'L', 'agree', 'w'),
    DIV.relate('a', 'b~c', 'L', 'agree', 'w')
  ];
  var sensors = [
    withCadence(live('a~b', -2.2)), withCadence(live('c', 2.2)),
    withCadence(live('a', -2.2)), withCadence(live('b~c', 2.2))
  ];
  var o = DIV.observe(led, sensors, tricky, t);
  assert('both declarations open their own claim', o.opened.length === 2, String(o.opened.length));
  assert('under distinct ledger keys', Object.keys(led.open).length === 2,
    JSON.stringify(Object.keys(led.open)));
  assert('with distinct ids', o.opened[0].id !== o.opened[1].id,
    o.opened[0].id + ' vs ' + o.opened[1].id);

  // An @ in a latent must not forge the timestamp boundary either.
  var at = DIV.createLedger();
  var o2 = DIV.observe(at, pair(-2.2, 2.2),
    [DIV.relate('a', 'b', 'L@9999', 'agree', 'w')], t);
  assert('an @ inside a latent is escaped, not treated as the time separator',
    /\\@9999/.test(o2.opened[0].id), o2.opened[0].id);
})();

// ── T32: the trim count survives restart ──────────────────────────────────────
(function () {
  console.log('T32: droppedClosed persists, or a trimmed history reads as a quiet one');
  var led = DIV.createLedger(), t = 1e12;
  for (var i = 0; i < DIV.CLOSED_CAP + 7; i++) {
    var base = t + i * 100 * HOUR;
    DIV.observe(led, pair(-2.2, 2.2), REL, base);
    DIV.observe(led, pair(0, 0), REL, base + HOUR);
  }
  assert('some were trimmed', led.droppedClosed === 7, String(led.droppedClosed));

  var round = DIV.restoreLedger(JSON.parse(JSON.stringify(DIV.serializeLedger(led))));
  /* Without this the counter reset to zero on every restart, so a long-lived ledger
     would report a short, clean history while having silently discarded resolutions. */
  assert('the trim count survives the round trip', round.droppedClosed === 7,
    String(round.droppedClosed));
  assert('and the report still admits the history is incomplete',
    /older ones trimmed past the/.test(DIV.report(round).why), DIV.report(round).why);
})();

// ── T33: a cached value crossing a cadence boundary is NOT new evidence ──────
(function () {
  console.log('T33: sampleAt is a local clock; only adapter identity counts');
  /* The third wrong answer. sampleAt advances when a cadence period elapses, regardless
     of whether the source produced anything — demonstrated below on real channels. */
  var P = baselined(makePair(HOUR));
  var at = P.t + 40 * HOUR;
  var s1 = [CH.step(P.a, { value: 0.90 }, at), CH.step(P.b, { value: 0.10 }, at)];
  var s2 = [CH.step(P.a, { value: 0.90 }, at + 2 * HOUR),
            CH.step(P.b, { value: 0.10 }, at + 2 * HOUR)];
  assert('sampleAt DID advance on the identical value (the trap)',
    s2[0].sampleAt !== s1[0].sampleAt, s1[0].sampleAt + ' -> ' + s2[0].sampleAt);
  assert('but raw-value changes did NOT', s2[0].changes === s1[0].changes,
    s1[0].changes + ' -> ' + s2[0].changes);

  var led = DIV.createLedger();
  DIV.observe(led, s1, REL, at);
  var claim = led.open[Object.keys(led.open)[0]];
  var before = claim.observations;
  DIV.observe(led, s2, REL, at + 2 * HOUR);
  assert('so the cached re-read added no observation', claim.observations === before,
    before + ' -> ' + claim.observations);
  assert('and the claim records its evidence is inferred, not adapter-supplied',
    claim.evidenceTier === 'change', String(claim.evidenceTier));

  var P2 = baselined(makePair(HOUR));
  var b1 = [CH.step(P2.a, { value: 0.90, observationId: 'r1' }, at),
            CH.step(P2.b, { value: 0.10, observationId: 'r1' }, at)];
  var b2 = [CH.step(P2.a, { value: 0.90, observationId: 'r2' }, at + 2 * HOUR),
            CH.step(P2.b, { value: 0.10, observationId: 'r2' }, at + 2 * HOUR)];
  var led2 = DIV.createLedger();
  DIV.observe(led2, b1, REL, at);
  var c2 = led2.open[Object.keys(led2.open)[0]];
  DIV.observe(led2, b2, REL, at + 2 * HOUR);
  assert('a NEW upstream record with an unchanged value DOES count', c2.observations === 2,
    String(c2.observations));
  assert('and that claim reports source-grade evidence', c2.evidenceTier === 'source',
    String(c2.evidenceTier));
})();

// ── T34: migrating a pre-totals snapshot must not erase history ──────────────
(function () {
  console.log('T34: restoring an old ledger rebuilds cumulative totals from its records');
  var legacy = {
    opts: {}, open: {}, droppedClosed: 0, version: 5,
    closed: [{
      channels: ['a', 'b'], latent: 'L', expect: 'agree', status: 'resolved',
      resolution: { outcome: 'converged', at: 1, durationMs: 1, observations: 2,
                    openingGap: 3, peakGap: 3, finalGap: 0, why: 'x', confounded: null }
    }]
  };
  var rep = DIV.report(DIV.restoreLedger(legacy));
  assert('the retained record is counted', rep.resolved === 1, String(rep.resolved));
  assert('under its own outcome', rep.outcomes.converged === 1, JSON.stringify(rep.outcomes));
  assert('and the rebuild is flagged, not passed off as original', rep.totalsReconstructed === true);
  assert('with the relationship rollup restored too',
    Object.keys(DIV.restoreLedger(legacy).totals.byRelationship).length === 1);

  var trimmed = Object.assign({}, legacy, { droppedClosed: 7 });
  var rep2 = DIV.report(DIV.restoreLedger(trimmed));
  assert('a rebuild over a trimmed history is marked incomplete', rep2.totalsIncomplete === true);
  assert('and says how many are unrecoverable', rep2.totalsMissing === 7, String(rep2.totalsMissing));
})();

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
