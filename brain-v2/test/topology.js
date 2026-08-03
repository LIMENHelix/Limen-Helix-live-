/**
 * brain-v2/test/topology.js — SPEC row 25. Reversible structural plasticity.
 *
 *   node brain-v2/test/topology.js
 *
 * The property under test is not "edges can be disabled". It is that the graph can be
 * EDITED and UN-EDITED on evidence: every transition is justified by resolved outcomes,
 * recorded with enough to undo it, survives restart, replays identically, and cannot be
 * used to route a packet the connectome's own rules would have refused.
 *
 * Deterministic throughout: `at` is supplied by the caller, so nothing here depends on a
 * clock and a replay produces identical topology.
 */

'use strict';

var T = require('../kernel/topology.js');
var CX = require('../kernel/connectome.js');
var PK = require('../kernel/packet.js');

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

var HOUR = 3600000, T0 = 1e12;

/** Feed n outcomes of a stated usefulness, one per hour. */
function feed(topo, id, n, useful, startAt) {
  for (var i = 0; i < n; i++) T.recordOutcome(topo, id, { at: startAt + i * HOUR, useful: useful, error: useful ? 0.1 : 0.9 });
  return startAt + n * HOUR;
}

console.log('');
console.log('=== TOPOLOGY: REVERSIBLE STRUCTURAL PLASTICITY (SPEC row 25) ===');
console.log('');

// ── T1: the lifecycle runs forward ────────────────────────────────────────────
(function () {
  console.log('T1: candidate -> active -> weakened -> dormant');
  var topo = T.createTopology();
  T.declare(topo, 'e1', { at: T0, reason: 'declared for test' });
  assert('a declared edge starts as CANDIDATE, not active', topo.edges.e1.state === T.STATE.CANDIDATE,
    topo.edges.e1.state);
  assert('declaration alone is not evidence — it does not route yet',
    T.routable(topo, 'e1') === false);

  var at = feed(topo, 'e1', 8, true, T0);
  T.evaluate(topo, at + 2 * HOUR);
  assert('positive resolved utility promotes it to ACTIVE', topo.edges.e1.state === T.STATE.ACTIVE,
    topo.edges.e1.state);
  assert('and it now routes', T.routable(topo, 'e1') === true);

  at = feed(topo, 'e1', 14, false, at);
  T.evaluate(topo, at + 2 * HOUR);
  assert('measured harm weakens it', topo.edges.e1.state === T.STATE.WEAKENED, topo.edges.e1.state);
  assert('a WEAKENED edge still routes — it is suspected, not suppressed', T.routable(topo, 'e1') === true);

  at = feed(topo, 'e1', 20, false, at);
  T.evaluate(topo, at + 2 * HOUR);
  assert('sustained harm makes it DORMANT', topo.edges.e1.state === T.STATE.DORMANT, topo.edges.e1.state);
  assert('a DORMANT edge does NOT route', T.routable(topo, 'e1') === false);
  assert('but it is retained, not deleted', !!topo.edges.e1 && topo.edges.e1.totalN > 0,
    String(topo.edges.e1 && topo.edges.e1.totalN));
})();

// ── T2: dormant is reversible ────────────────────────────────────────────────
(function () {
  console.log('T2: a dormant edge can be reactivated on new evidence');
  var topo = T.createTopology();
  T.declare(topo, 'e1', { at: T0 });
  var at = feed(topo, 'e1', 8, true, T0);
  T.evaluate(topo, at + 2 * HOUR);
  at = feed(topo, 'e1', 30, false, at);
  T.evaluate(topo, at + 2 * HOUR); T.evaluate(topo, at + 6 * HOUR);
  assert('it is dormant', topo.edges.e1.state === T.STATE.DORMANT, topo.edges.e1.state);

  var threw = false;
  try { T.reactivate(topo, 'e1', { at: at + 8 * HOUR }); } catch (e) { threw = /must state a reason/.test(e.message); }
  assert('reactivation without a stated reason is refused', threw);

  var r = T.reactivate(topo, 'e1', { at: at + 8 * HOUR, reason: 'upstream source repaired' });
  assert('reactivation succeeds with a reason', r.reactivated === true, JSON.stringify(r.why));
  assert('state is REACTIVATED', topo.edges.e1.state === T.STATE.REACTIVATED);
  assert('and it routes again', T.routable(topo, 'e1') === true);
  assert('the reason is on the transition record', /upstream source repaired/.test(r.transition.reason), r.transition.reason);

  /* Probation: harm again and it goes straight back to dormant. */
  var at2 = feed(topo, 'e1', 8, false, at + 10 * HOUR);
  T.evaluate(topo, at2 + 2 * HOUR);
  assert('failing probation returns it to dormant', topo.edges.e1.state === T.STATE.DORMANT, topo.edges.e1.state);
  assert('and the reason names probation', /probation/.test(topo.transitions[topo.transitions.length - 1].reason));
})();

// ── T2b: the arrow back fires on FRESH evidence, and only on fresh evidence ──
(function () {
  console.log('T2b: a dormant edge recovers on evidence recorded AFTER it was suppressed');
  var topo = T.createTopology();
  T.declare(topo, 'e1', { at: T0 });

  var at = feed(topo, 'e1', 10, true, T0);
  T.evaluate(topo, at + 2 * HOUR);
  at = feed(topo, 'e1', 50, false, at);
  T.evaluate(topo, at + 2 * HOUR); T.evaluate(topo, at + 6 * HOUR);
  assert('it is dormant', topo.edges.e1.state === T.STATE.DORMANT, topo.edges.e1.state);

  /* NOTHING NEW ARRIVES. Evidence "since" is null rather than zero — unmeasured and
     recovered are different facts, and a rule that treated them alike would either
     revive every dormant edge or none of them. */
  var n0 = topo.transitions.length;
  T.evaluate(topo, at + 500 * HOUR);
  assert('with no fresh evidence it stays dormant', topo.edges.e1.state === T.STATE.DORMANT &&
    topo.transitions.length === n0, topo.edges.e1.state);
  assert('because "unmeasured since" is null, not "recovered"', T.utilitySince(topo, topo.edges.e1) === null);

  /* Fresh outcomes arrive — in a live loop, work already in flight when it was
     suppressed. Below the evidence floor, still nothing moves. */
  var at2 = feed(topo, 'e1', 4, true, at + 501 * HOUR);
  T.evaluate(topo, at2 + 2 * HOUR);
  assert('4 fresh outcomes is under the evidence floor, so it holds', topo.edges.e1.state === T.STATE.DORMANT,
    topo.edges.e1.state);

  at2 = feed(topo, 'e1', 4, true, at2);
  T.evaluate(topo, at2 + 2 * HOUR);
  assert('8 fresh useful outcomes reactivate it', topo.edges.e1.state === T.STATE.REACTIVATED,
    topo.edges.e1.state);

  /* THE DISCRIMINATOR, and the reason the window is not cumulative. At this moment the
     lifetime record is still deeply negative — a rule reading cumulative utility would
     leave a fully recovered edge suppressed forever, because a long bad run can never be
     outvoted by the trickle of outcomes a dormant edge is able to receive. This is the
     real-corpus failure, not a hypothetical: an integration edge went dormant at -0.500,
     took six further outcomes, all useful, and sat at +0.143 — still under the promote
     threshold, still suppressed. */
  var cum = T.utilityOf(topo.edges.e1);
  assert('while its LIFETIME utility is still below the promote threshold',
    cum < topo.opts.promoteUtility, 'cumulative ' + cum.toFixed(3));
  var last = topo.transitions[topo.transitions.length - 1];
  assert('so the reason cites the fresh window, and states the cumulative figure too',
    /FRESH evidence/.test(last.reason) && last.evidence.nSince === 8 &&
    new RegExp('cumulative ' + cum.toFixed(3)).test(last.reason), last.reason);
  assert('it routes again', T.routable(topo, 'e1') === true);
  assert('and it comes back on PROBATION, not straight to active',
    topo.edges.e1.state === T.STATE.REACTIVATED && topo.edges.e1.probation === 0);

  /* THE MIRROR: fresh evidence that is BAD must not revive it. */
  var t2 = T.createTopology();
  T.declare(t2, 'e2', { at: T0 });
  var a = feed(t2, 'e2', 10, true, T0);
  T.evaluate(t2, a + 2 * HOUR);
  a = feed(t2, 'e2', 50, false, a);
  T.evaluate(t2, a + 2 * HOUR); T.evaluate(t2, a + 6 * HOUR);
  a = feed(t2, 'e2', 12, false, a + 100 * HOUR);
  T.evaluate(t2, a + 2 * HOUR);
  assert('fresh HARMFUL evidence leaves it dormant', t2.edges.e2.state === T.STATE.DORMANT, t2.edges.e2.state);
})();

// ── T3: utility, not traffic. THE rare-but-useful protection ─────────────────
(function () {
  console.log('T3: a rarely used but useful edge is never pruned for being rare');
  var topo = T.createTopology();
  T.declare(topo, 'busy', { at: T0 });
  T.declare(topo, 'rare', { at: T0 });

  /* `busy` carries 200 outcomes and is mostly harmful. `rare` carries 3, all useful —
     the crisis path that fires twice a year. Activity-based pruning would keep the first
     and drop the second, which is exactly backwards. */
  var at = feed(topo, 'busy', 200, false, T0);
  feed(topo, 'rare', 3, true, T0);
  T.evaluate(topo, at + 2 * HOUR);

  assert('the high-traffic harmful edge is demoted', topo.edges.busy.state !== T.STATE.ACTIVE,
    topo.edges.busy.state);
  assert('the low-traffic useful edge is NOT demoted', topo.edges.rare.state === T.STATE.CANDIDATE,
    topo.edges.rare.state);
  assert('because it is below the evidence floor, not because it is rare',
    topo.edges.rare.totalN < topo.opts.minEvidence, String(topo.edges.rare.totalN));

  var rep = T.report(topo);
  assert('and it is reported as rare-but-useful, so the protection is visible',
    rep.rareButUseful.some(function (r) { return r.edgeId === 'rare'; }), JSON.stringify(rep.rareButUseful));

  /* Give it enough evidence and it promotes on utility alone, still at low volume. */
  feed(topo, 'rare', 5, true, T0 + 400 * HOUR);
  T.evaluate(topo, T0 + 500 * HOUR);
  assert('with enough evidence it promotes on UTILITY, not volume',
    topo.edges.rare.state === T.STATE.ACTIVE, topo.edges.rare.state);
  assert('at a fraction of the harmful edge\'s traffic',
    topo.edges.rare.totalN < topo.edges.busy.totalN / 10,
    topo.edges.rare.totalN + ' vs ' + topo.edges.busy.totalN);
})();

// ── T4: one poisoned outcome moves nothing ───────────────────────────────────
(function () {
  console.log('T4 [adversarial]: a single poisoned outcome cannot flip an edge');
  var topo = T.createTopology();
  T.declare(topo, 'e1', { at: T0 });
  var at = feed(topo, 'e1', 20, true, T0);
  T.evaluate(topo, at + 2 * HOUR);
  assert('the edge is active on a good record', topo.edges.e1.state === T.STATE.ACTIVE);

  T.recordOutcome(topo, 'e1', { at: at + 3 * HOUR, useful: false, error: 1e6 });   // one catastrophic result
  T.evaluate(topo, at + 5 * HOUR);
  assert('one bad outcome does NOT demote it', topo.edges.e1.state === T.STATE.ACTIVE,
    topo.edges.e1.state + ' utility=' + T.utilityOf(topo.edges.e1).toFixed(3));
  assert('because utility is a ratio over the whole record, not the last value',
    T.utilityOf(topo.edges.e1) > 0.8, String(T.utilityOf(topo.edges.e1)));

  var e = topo.edges.e1;
  var threw = false;
  try { T.recordOutcome(topo, 'e1', { at: at + 6 * HOUR }); } catch (err) { threw = /must state `useful` explicitly/.test(err.message); }
  assert('an outcome with no stated usefulness is refused — unknown is not false', threw);
  assert('and the refused outcome did not count', topo.edges.e1.totalN === e.totalN);
})();

// ── T5: hysteresis stops oscillation at the threshold ────────────────────────
(function () {
  console.log('T5 [adversarial]: an edge sitting exactly at the boundary does not oscillate');
  var topo = T.createTopology();
  T.declare(topo, 'e1', { at: T0 });
  /* Alternating useful/harmful gives utility ~0, which sits INSIDE the band between
     demoteUtility (-0.25) and promoteUtility (+0.25). Equal thresholds would flip this
     edge on every evaluation. */
  var at = T0;
  for (var i = 0; i < 40; i++) {
    T.recordOutcome(topo, 'e1', { at: at, useful: i % 2 === 0 });
    at += HOUR;
  }
  var u = T.utilityOf(topo.edges.e1);
  assert('utility sits inside the hysteresis band', u > topo.opts.demoteUtility && u < topo.opts.promoteUtility,
    String(u));

  var before = topo.transitions.length;
  for (var k = 0; k < 20; k++) T.evaluate(topo, at + k * 10 * HOUR);
  assert('twenty evaluations produce ZERO transitions', topo.transitions.length === before,
    (topo.transitions.length - before) + ' transitions fired');
  assert('the edge stays where it was', topo.edges.e1.state === T.STATE.CANDIDATE, topo.edges.e1.state);

  /* And the dwell time bounds churn even when outcomes do cross a threshold. */
  var t2 = T.createTopology();
  T.declare(t2, 'e2', { at: T0 });
  feed(t2, 'e2', 10, true, T0);
  T.evaluate(t2, T0 + 11 * HOUR);
  assert('a promotion fired', t2.edges.e2.state === T.STATE.ACTIVE);
  feed(t2, 'e2', 40, false, T0 + 12 * HOUR);
  var n = t2.transitions.length;
  /* Strictly INSIDE the window: the promotion landed at T0+11h and the dwell is 1h, so
     probe at +0.5h. At exactly one dwell the edge is eligible again, which is the
     intended boundary. */
  T.evaluate(t2, T0 + 11.5 * HOUR);
  assert('a second transition inside the dwell window is suppressed', t2.transitions.length === n,
    'dwell ' + t2.opts.minDwellMs + 'ms; fired ' + (t2.transitions.length - n));
  T.evaluate(t2, T0 + 100 * HOUR);         // well past it
  assert('and fires once the dwell time has passed', t2.transitions.length > n);
})();

// ── T6: every transition is auditable and reversible ─────────────────────────
(function () {
  console.log('T6: transitions record reason, evidence, prior state, timestamp, rule version');
  var topo = T.createTopology();
  T.declare(topo, 'e1', { at: T0 });
  var at = feed(topo, 'e1', 10, true, T0);
  T.evaluate(topo, at + 2 * HOUR);
  var rec = topo.transitions[topo.transitions.length - 1];

  assert('records the prior state', rec.from === T.STATE.CANDIDATE, rec.from);
  assert('records the new state', rec.to === T.STATE.ACTIVE, rec.to);
  assert('records a caller-supplied timestamp', rec.at === at + 2 * HOUR, String(rec.at));
  assert('records the evidence count', rec.evidenceCount === 10, String(rec.evidenceCount));
  assert('records the measured utility', typeof rec.utility === 'number');
  assert('records the rule version', rec.ruleVersion === T.RULE_VERSION, rec.ruleVersion);
  assert('records a human-readable reason', /earned routing/.test(rec.reason), rec.reason);
  assert('and carries rollback data', !!rec.rollback && rec.rollback.state === T.STATE.CANDIDATE,
    JSON.stringify(rec.rollback));
})();

// ── T7: rollback restores exact prior topology ───────────────────────────────
(function () {
  console.log('T7: rollback restores the exact previous topology');
  var topo = T.createTopology();
  T.declare(topo, 'a', { at: T0 }); T.declare(topo, 'b', { at: T0 });
  var at = feed(topo, 'a', 10, true, T0);
  feed(topo, 'b', 10, true, T0);
  T.evaluate(topo, at + 2 * HOUR);

  /* STRUCTURE only. Outcome counters are a separate event stream and rollback
     deliberately does not rewind them — undoing a decision must not delete observations
     the world actually produced. */
  function snap() {
    return Object.keys(topo.edges).sort().map(function (id) {
      var e = topo.edges[id];
      return id + ':' + e.state + ':' + e.since + ':' + e.probation;
    }).join('|');
  }
  assert('both edges are active', /a:active/.test(snap()) && /b:active/.test(snap()), snap());

  at = feed(topo, 'a', 40, false, at + 3 * HOUR);
  var before = snap();                       // captured AFTER the outcomes, BEFORE the transition
  var r1 = T.evaluate(topo, at + 200 * HOUR);
  assert('a demotion fired', r1.transitions.length === 1, String(r1.transitions.length));
  assert('and the structure changed', snap() !== before);

  var rb = T.rollback(topo, 1);
  assert('rollback undid one transition', rb.undone === 1);
  assert('and reported the restoration as exact', rb.exact === true, JSON.stringify(rb.why));
  assert('topology is byte-identical to before the transition', snap() === before,
    snap() + '  vs  ' + before);
  /* And the outcome record is intact — rollback undid the decision, not the evidence. */
  assert('the outcomes recorded before the rollback are still there',
    topo.edges.a.totalN === 50 && topo.edges.a.harmfulN === 40,
    topo.edges.a.totalN + ' outcomes, ' + topo.edges.a.harmfulN + ' harmful');
})();

// ── T7b: rollback must restore BEHAVIOUR, not just the visible fields ────────
(function () {
  console.log('T7b [adversarial]: after a rollback the edge must EVALUATE as it would have');
  /**
   * T7 compares state/since/probation and passes even when `mark` is stale, because
   * `mark` is not one of the fields it prints. `mark` is the baseline `utilitySince`
   * subtracts from, so a stale one silently changes which outcomes count as "fresh" and
   * the next evaluate() can reach a different decision from an edge that looks identical.
   *
   * THE SHAPE THIS NEEDS, and a first version of this test got it wrong. Outcomes must
   * arrive BETWEEN the two transitions. Without that gap the mark set by the undone
   * transition equals the one before it, nothing differs, and the test passes whether or
   * not the fix is present — a regression test that cannot fail is not one. Here the
   * edge reaches `weakened` at n=60, takes 20 more outcomes, and only then transitions:
   * the correct baseline is 60 and the stale one is 80.
   */
  var topo = T.createTopology();
  T.declare(topo, 'e', { at: T0 });
  var at = feed(topo, 'e', 10, true, T0);
  T.evaluate(topo, at + 2 * HOUR);                        // -> active
  at = feed(topo, 'e', 50, false, at);
  T.evaluate(topo, at + 2 * HOUR);                        // -> weakened, mark at n=60
  assert('the edge is weakened with its baseline at 60', topo.edges.e.state === T.STATE.WEAKENED &&
    topo.edges.e.mark.totalN === 60, topo.edges.e.state + ' mark=' + topo.edges.e.mark.totalN);

  /* THE GAP. Twenty further outcomes, so the next transition's mark differs from this
     one's, which is the only condition under which a missing restore is observable. */
  at = feed(topo, 'e', 20, false, at);

  /* A reference copy taken immediately BEFORE the transition that will be undone. This is
     the ground truth for "as if it had never happened". */
  var reference = T.deserialize(JSON.parse(JSON.stringify(T.serialize(topo))));

  T.evaluate(topo, at + 8 * HOUR);                        // weakened -> dormant, mark moves to 80
  assert('the transition being undone actually fired', topo.edges.e.state === T.STATE.DORMANT,
    topo.edges.e.state);
  assert('and it moved the baseline', topo.edges.e.mark.totalN === 80, String(topo.edges.e.mark.totalN));

  var rb = T.rollback(topo, 1);
  assert('rollback reports exact', rb.exact === true, rb.why || '');
  assert('state is back', topo.edges.e.state === reference.edges.e.state, topo.edges.e.state);
  assert('AND the fresh-evidence baseline is back to 60 — the field T7 never looked at',
    topo.edges.e.mark.totalN === reference.edges.e.mark.totalN,
    topo.edges.e.mark.totalN + ' vs ' + reference.edges.e.mark.totalN);

  /* NOW RUN BOTH. Identical fresh outcomes, identical evaluation. A stale baseline makes
     the rolled-back edge measure a 12-outcome window where the reference measures 32, so
     the two reach different decisions — which is the assertion field comparison cannot
     make and the reason this test exists. */
  var atA = feed(topo, 'e', 12, true, at + 100 * HOUR);
  var atB = feed(reference, 'e', 12, true, at + 100 * HOUR);
  assert('the fresh-window statistic matches the reference',
    JSON.stringify(T.utilitySince(topo, topo.edges.e)) ===
    JSON.stringify(T.utilitySince(reference, reference.edges.e)),
    JSON.stringify(T.utilitySince(topo, topo.edges.e)) + ' vs ' +
    JSON.stringify(T.utilitySince(reference, reference.edges.e)));

  var rA = T.evaluate(topo, atA + 2 * HOUR);
  var rB = T.evaluate(reference, atB + 2 * HOUR);
  assert('the rolled-back edge reaches the same state as one that never transitioned',
    topo.edges.e.state === reference.edges.e.state,
    'rolled-back ' + topo.edges.e.state + ' vs reference ' + reference.edges.e.state);
  assert('and fires the same transitions, with the same stated reasons',
    JSON.stringify(rA.transitions.map(function (t) { return t.from + '->' + t.to + '|' + t.reason; })) ===
    JSON.stringify(rB.transitions.map(function (t) { return t.from + '->' + t.to + '|' + t.reason; })),
    JSON.stringify(rA.transitions.map(function (t) { return t.to; })) + ' vs ' +
    JSON.stringify(rB.transitions.map(function (t) { return t.to; })));

  /* And the outcome log is still NOT rewound: rollback undoes a decision, not evidence. */
  assert('the outcomes remain intact through all of it',
    topo.edges.e.totalN === reference.edges.e.totalN && topo.edges.e.totalN === 92,
    topo.edges.e.totalN + ' vs ' + reference.edges.e.totalN);
})();

// ── T8: restart ──────────────────────────────────────────────────────────────
(function () {
  console.log('T8: candidate/active/dormant state survives serialize and restore');
  var topo = T.createTopology();
  T.declare(topo, 'act', { at: T0 }); T.declare(topo, 'dorm', { at: T0 }); T.declare(topo, 'cand', { at: T0 });
  var at = feed(topo, 'act', 10, true, T0);
  feed(topo, 'dorm', 40, false, T0);
  feed(topo, 'cand', 2, true, T0);
  T.evaluate(topo, at + 2 * HOUR); T.evaluate(topo, at + 300 * HOUR); T.evaluate(topo, at + 600 * HOUR);

  var states = { act: topo.edges.act.state, dorm: topo.edges.dorm.state, cand: topo.edges.cand.state };
  assert('three distinct states exist before restart',
    states.act === T.STATE.ACTIVE && states.dorm === T.STATE.DORMANT && states.cand === T.STATE.CANDIDATE,
    JSON.stringify(states));

  var round = T.deserialize(JSON.parse(JSON.stringify(T.serialize(topo))));
  assert('all three survive the round trip',
    round.edges.act.state === states.act && round.edges.dorm.state === states.dorm && round.edges.cand.state === states.cand,
    JSON.stringify({ act: round.edges.act.state, dorm: round.edges.dorm.state, cand: round.edges.cand.state }));
  assert('cumulative evidence survives', round.edges.dorm.totalN === topo.edges.dorm.totalN);
  assert('the transition log survives', round.transitions.length === topo.transitions.length);
  assert('the rule version survives', round.ruleVersion === topo.ruleVersion);
  assert('and a dormant edge still refuses to route after restart', T.routable(round, 'dorm') === false);
})();

// ── T9: deterministic replay ─────────────────────────────────────────────────
(function () {
  console.log('T9: replaying the same event log produces identical topology');
  var log = [];
  for (var i = 0; i < 60; i++) log.push({ id: i % 3 === 0 ? 'x' : 'y', at: T0 + i * HOUR, useful: (i % 7) !== 0 });

  function run() {
    var topo = T.createTopology();
    T.declare(topo, 'x', { at: T0 }); T.declare(topo, 'y', { at: T0 });
    log.forEach(function (o) { T.recordOutcome(topo, o.id, { at: o.at, useful: o.useful }); });
    T.evaluate(topo, T0 + 1000 * HOUR);
    T.evaluate(topo, T0 + 2000 * HOUR);
    return JSON.stringify(T.serialize(topo));
  }
  var a = run(), b = run();
  assert('two independent replays are byte-identical', a === b);
  assert('and the result is non-trivial', JSON.parse(a).transitions.length > 0,
    String(JSON.parse(a).transitions.length));
})();

// ── T10: retirement is reviewer-only ─────────────────────────────────────────
(function () {
  console.log('T10: no rule can retire an edge; only a named reviewer can');
  var topo = T.createTopology();
  T.declare(topo, 'e1', { at: T0 });
  var at = feed(topo, 'e1', 200, false, T0);
  for (var k = 0; k < 10; k++) T.evaluate(topo, at + k * 100 * HOUR);
  assert('relentless harm reaches DORMANT', topo.edges.e1.state === T.STATE.DORMANT, topo.edges.e1.state);
  assert('but never RETIRED by rule',
    topo.transitions.every(function (t) { return t.to !== T.STATE.RETIRED; }));

  var threwR = false, threwW = false;
  try { T.reviewedRetire(topo, 'e1', { reason: 'x', at: at }); } catch (e) { threwR = /named reviewer/.test(e.message); }
  try { T.reviewedRetire(topo, 'e1', { reviewer: 'op', at: at }); } catch (e) { threwW = /stated reason/.test(e.message); }
  assert('retirement without a reviewer is refused', threwR);
  assert('retirement without a reason is refused', threwW);

  var r = T.reviewedRetire(topo, 'e1', { reviewer: 'operator', reason: 'source permanently decommissioned', at: at + HOUR });
  assert('a reviewed retirement succeeds', r.retired === true, JSON.stringify(r.why));
  assert('the reviewer is named in the record', /RETIRED by operator/.test(r.transition.reason), r.transition.reason);
  assert('a retired edge does not route', T.routable(topo, 'e1') === false);
  /* Audit history is preserved — retirement is not deletion. */
  assert('its full outcome history is preserved, not deleted',
    topo.edges.e1.totalN === 200 && topo.edges.e1.history.length > 0,
    topo.edges.e1.totalN + ' outcomes, ' + topo.edges.e1.history.length + ' retained');
  assert('and no rule can move it afterwards', (function () {
    var n = topo.transitions.length;
    T.evaluate(topo, at + 10000 * HOUR);
    return topo.transitions.length === n;
  })());
})();

// ── T11: topology cannot evade the connectome's own rules ────────────────────
(function () {
  console.log('T11: a topology edit cannot smuggle a packet past type, domain or fanout rules');
  var cx = CX.create({ maxFanout: 2 });
  CX.connect(cx, 'obs:a', { kinds: [PK.KIND.OBSERVATION], direction: PK.DIRECTION.ASCENDING, domains: ['energy'] });
  CX.connect(cx, 'obs:b', { kinds: [PK.KIND.OBSERVATION], direction: PK.DIRECTION.ASCENDING, domains: ['energy'] });
  CX.connect(cx, 'obs:c', { kinds: [PK.KIND.OBSERVATION], direction: PK.DIRECTION.ASCENDING, domains: ['energy'] });
  CX.connect(cx, 'pred:x', { kinds: [PK.KIND.PREDICTION], direction: PK.DIRECTION.DESCENDING });

  function pkt(kind, domain) {
    return PK.create({
      traceId: 'tr', seq: 1, sourceDomain: domain, sourceModule: 'test',
      signalKind: kind, role: PK.ROLE.DRIVER, direction: PK.DIRECTION.ASCENDING,
      payload: { v: 1 }, eventTime: T0, observationTime: T0, processingTime: T0,
      simulationStatus: PK.STATUS.OBSERVED, confidence: null, salience: null
    });
  }

  var noTopo = CX.route(cx, pkt(PK.KIND.OBSERVATION, 'energy'));
  assert('without topology, fanout still caps the target list', noTopo.length === 2,
    JSON.stringify(noTopo));

  var topo = T.createTopology();
  ['obs:a', 'obs:b', 'obs:c', 'pred:x'].forEach(function (id) { T.declare(topo, id, { at: T0 }); });
  ['obs:a', 'obs:b', 'obs:c', 'pred:x'].forEach(function (id) {
    feed(topo, id, 10, true, T0);
  });
  T.evaluate(topo, T0 + 100 * HOUR);
  CX.attachTopology(cx, topo);

  var withTopo = CX.route(cx, pkt(PK.KIND.OBSERVATION, 'energy'));
  assert('all edges active: routing is unchanged', withTopo.length === 2, JSON.stringify(withTopo));

  /* A PREDICTION packet must never reach an OBSERVATION edge, however active topology
     says those edges are. */
  var wrongKind = CX.route(cx, pkt(PK.KIND.PREDICTION, 'energy'));
  assert('an active topology cannot deliver a PREDICTION to OBSERVATION edges',
    wrongKind.every(function (t) { return t === 'pred:x'; }), JSON.stringify(wrongKind));

  /* A foreign-domain packet must never reach a domain-scoped edge. */
  var wrongDomain = CX.route(cx, pkt(PK.KIND.OBSERVATION, 'finance'));
  assert('an active topology cannot deliver a foreign-domain packet to a scoped edge',
    wrongDomain.length === 0, JSON.stringify(wrongDomain));

  /* And topology can only SUBTRACT. */
  var at2 = feed(topo, 'obs:a', 60, false, T0 + 200 * HOUR);
  T.evaluate(topo, at2 + 100 * HOUR); T.evaluate(topo, at2 + 400 * HOUR); T.evaluate(topo, at2 + 800 * HOUR);
  assert('obs:a is now dormant', topo.edges['obs:a'].state === T.STATE.DORMANT, topo.edges['obs:a'].state);
  var afterDormant = CX.route(cx, pkt(PK.KIND.OBSERVATION, 'energy'));
  assert('the dormant edge is removed from routing', afterDormant.indexOf('obs:a') < 0, JSON.stringify(afterDormant));
  assert('and the surviving targets are a SUBSET of what the connectome allowed',
    afterDormant.every(function (t) { return ['obs:a', 'obs:b', 'obs:c'].indexOf(t) >= 0; }),
    JSON.stringify(afterDormant));
})();

// ── T12: a cyclic peer graph is bounded ──────────────────────────────────────
(function () {
  console.log('T12 [adversarial]: a cyclic topology does not amplify or hang');
  var topo = T.createTopology();
  /* A -> B -> C -> A, each edge active. Topology holds no traversal of its own, so the
     cycle can only matter through the connectome — whose dedup and hop limits already
     bound it. This asserts the topology adds no new path around them. */
  ['a->b', 'b->c', 'c->a'].forEach(function (id) {
    T.declare(topo, id, { at: T0 });
    feed(topo, id, 10, true, T0);
  });
  T.evaluate(topo, T0 + 100 * HOUR);
  assert('all three cycle edges are active',
    ['a->b', 'b->c', 'c->a'].every(function (id) { return topo.edges[id].state === T.STATE.ACTIVE; }));

  var t0 = Date.now();
  var rep = T.report(topo);
  var filtered = T.filterTargets(topo, ['a->b', 'b->c', 'c->a', 'unknown']);
  assert('report and filter terminate on a cyclic graph', Date.now() - t0 < 1000);
  assert('filtering is purely per-edge — no traversal, so no cycle to follow',
    filtered.length === 4, JSON.stringify(filtered));
  assert('an undeclared target is left alone for the connectome to govern',
    filtered.indexOf('unknown') >= 0);
  assert('the report counts every edge exactly once', rep.edges === 3, String(rep.edges));
})();

// ── T13: lesion — a dormant edge does not break the rest ─────────────────────
(function () {
  console.log('T13 [lesion]: suppressing one edge does not disturb the others');
  var topo = T.createTopology();
  ['keep1', 'keep2', 'lesion'].forEach(function (id) { T.declare(topo, id, { at: T0 }); });
  feed(topo, 'keep1', 10, true, T0);
  feed(topo, 'keep2', 10, true, T0);
  var at = feed(topo, 'lesion', 10, true, T0);
  T.evaluate(topo, at + 2 * HOUR);
  var before = { k1: topo.edges.keep1.state, k2: topo.edges.keep2.state };

  at = feed(topo, 'lesion', 60, false, at + 3 * HOUR);
  T.evaluate(topo, at + 100 * HOUR); T.evaluate(topo, at + 400 * HOUR); T.evaluate(topo, at + 800 * HOUR);
  assert('the lesioned edge is dormant', topo.edges.lesion.state === T.STATE.DORMANT, topo.edges.lesion.state);
  assert('the healthy edges are untouched',
    topo.edges.keep1.state === before.k1 && topo.edges.keep2.state === before.k2,
    JSON.stringify({ k1: topo.edges.keep1.state, k2: topo.edges.keep2.state }));
  assert('and they still route', T.routable(topo, 'keep1') && T.routable(topo, 'keep2'));

  var rep = T.report(topo);
  assert('the report states what was suppressed and that it is reactivatable',
    /dormant \(retained, reactivatable\)/.test(rep.why), rep.why);
})();

// ── T14: no clock, no randomness ─────────────────────────────────────────────
(function () {
  console.log('T14: the module reads no clock and no random source');
  var fs = require('fs'), path = require('path');
  var src = fs.readFileSync(path.join(__dirname, '..', 'kernel', 'topology.js'), 'utf8');
  var body = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert('no Date.now()', body.indexOf('Date.now') < 0);
  assert('no new Date()', body.indexOf('new Date') < 0);
  assert('no Math.random()', body.indexOf('Math.random') < 0);

  var threw = false;
  try { T.declare(T.createTopology(), 'e', {}); } catch (e) { threw = /caller-supplied `at`/.test(e.message); }
  assert('declare refuses to invent a timestamp', threw);
  var threw2 = false;
  try { T.evaluate(T.createTopology()); } catch (e) { threw2 = /caller-supplied `at`/.test(e.message); }
  assert('evaluate refuses to invent a timestamp', threw2);
})();

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
