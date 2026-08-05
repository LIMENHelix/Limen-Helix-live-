/**
 * brain-v2/kernel/topology.js — SPEC row 25. Reversible structural plasticity.
 *
 * WHAT THIS IS NOT. It is not weight learning and it is not memory retirement. Both of
 * those already exist and neither edits the graph: weights change how strongly an edge
 * is used, retirement drops episodes. Row 25 asks for a mechanism that changes WHICH
 * EDGES EXIST, and calling a scalar weight approaching zero "pruning" would be the same
 * naming-over-mechanism substitution this project keeps having to unwind.
 *
 * ═════════════════════════════════════════════════════════════════════════════════
 * WHY DORMANCY RATHER THAN DELETION
 *
 * A deleted edge cannot be wrong, because it cannot be examined. Dormancy keeps the
 * edge, its history, and the reason it was suppressed, so a later run can ask "was that
 * decision correct" and answer from evidence. Deletion converts a reversible judgement
 * into an unfalsifiable one.
 *
 *   candidate -> active -> weakened -> dormant -> reactivated -> active
 *                   ^__________|__________________|
 *
 * `retired` exists but is NOT reachable by rule. It requires an explicit reviewer and
 * reason through reviewedRetire(), because permanent removal is a different class of
 * decision from automatic suppression. Even then the audit history is preserved.
 *
 * ═════════════════════════════════════════════════════════════════════════════════
 * UTILITY, NOT TRAFFIC
 *
 * Transitions are driven by RESOLVED OUTCOMES — did routing through this edge help or
 * hurt — never by how often it carried a packet. Pruning on activity is how a rarely
 * used but critical edge dies: a crisis path that fires twice a year looks identical to
 * a dead one right up until the crisis. So:
 *
 *   - an edge with positive utility is never demoted for low volume;
 *   - an edge with NO resolved outcomes is never demoted at all, because "unmeasured"
 *     and "harmful" are different facts;
 *   - demotion requires measured harm across a minimum sample.
 *
 * HYSTERESIS. Promotion and demotion use different thresholds and a minimum dwell time.
 * Equal thresholds make an edge sitting exactly at the boundary oscillate every
 * evaluation, which produces a churning audit log and no information.
 *
 * DETERMINISTIC. No clock and no randomness. `at` is supplied by the caller, so
 * replaying the same outcome sequence produces byte-identical topology.
 */

'use strict';

var RULE_VERSION = 'topology/1';

var STATE = {
  CANDIDATE: 'candidate',       // declared, not yet earned routing
  ACTIVE: 'active',             // routes traffic
  WEAKENED: 'weakened',         // still routes, but measured harm is accumulating
  DORMANT: 'dormant',           // does NOT route; retained, auditable, reactivatable
  REACTIVATED: 'reactivated',   // routing again on new evidence, on probation
  RETIRED: 'retired'            // reviewer-only; does not route
};

/** States that may carry traffic. Dormant and retired deliberately may not. */
var ROUTABLE = [STATE.ACTIVE, STATE.WEAKENED, STATE.REACTIVATED];

var DEFAULTS = {
  /* Minimum RESOLVED outcomes before any rule may fire. One bad result must never move
     an edge; a single poisoned outcome is the commonest adversarial input here. */
  minEvidence: 6,
  /* Promotion needs clearly positive utility; demotion needs clearly negative. The gap
     between them IS the hysteresis band — inside it, nothing moves. */
  promoteUtility: 0.25,
  demoteUtility: -0.25,
  dormantUtility: -0.5,
  /* An edge may not change state again until this much caller-time has passed. Bounds
     churn even if outcomes arrive in a pathological order. */
  minDwellMs: 3600000,
  /* Outcome history per edge. Bounded so a long-lived topology cannot grow without
     limit; the aggregate counters below are cumulative and survive trimming. */
  historyCap: 128,
  transitionCap: 512
};

function createTopology(opts) {
  return {
    ruleVersion: RULE_VERSION,
    opts: Object.assign({}, DEFAULTS, opts || {}),
    edges: Object.create(null),
    transitions: [],
    droppedTransitions: 0,
    version: 0
  };
}

function edgeRecord(edgeId, at, reason) {
  return {
    edgeId: edgeId,
    state: STATE.CANDIDATE,
    since: at,
    declaredAt: at,
    declaredReason: reason || null,
    /* Cumulative — never trimmed, so utility survives history trimming. */
    totalN: 0, usefulN: 0, harmfulN: 0, errorSum: 0,
    lastOutcomeAt: null, lastUsefulAt: null,
    history: [],          // bounded recent outcomes, for inspection
    probation: 0,         // consecutive harmful outcomes since reactivation
    /* Cumulative counters as of the last transition. Fresh-window utility is computed by
       subtraction, so it survives history trimming — reading the bounded history instead
       would silently change the answer on a long-lived edge. */
    mark: { totalN: 0, usefulN: 0, harmfulN: 0 }
  };
}

/** Declare an edge. Starts as CANDIDATE: declaration is not evidence. */
function declare(topo, edgeId, spec) {
  spec = spec || {};
  if (!edgeId) throw new Error('topology: an edge needs an id');
  if (typeof spec.at !== 'number') throw new Error('topology: declare needs a caller-supplied `at` (no clock in this module)');
  if (topo.edges[edgeId]) return topo.edges[edgeId];
  var e = edgeRecord(edgeId, spec.at, spec.reason);
  topo.edges[edgeId] = e;
  topo.version++;
  return e;
}

/**
 * ADOPT an edge that already exists in the wiring. Enters at ACTIVE, not CANDIDATE.
 *
 * WHY THIS IS NOT A LOOPHOLE, AND WHY IT IS NEEDED. Attaching a topology to a connectome
 * whose edges were declared by hand is a migration, not a discovery. If those edges entered
 * as CANDIDATE they would not route, and every packet in the system would drop as "no
 * consumer" the moment a topology was attached — the mechanism would delete working
 * structure on the basis of no evidence, which is the opposite of what it is for.
 *
 * So adoption starts from what IS, and topology can only demote from there. The cost is
 * recorded rather than hidden: the transition says the edge was grandfathered, its
 * `evidenceCount` is 0 and its `utility` is null, and `adopted:true` stays on the edge, so
 * an auditor reading report() can always separate structure that was EARNED from structure
 * that was INHERITED. An adopted edge is fully subject to demotion on measured harm.
 */
function adopt(topo, edgeId, spec) {
  spec = spec || {};
  if (typeof spec.at !== 'number') throw new Error('topology: adopt needs a caller-supplied `at`');
  if (!spec.reason) throw new Error('topology: adoption must state why this edge is pre-existing structure — an unexplained active edge is indistinguishable from one that earned it');
  if (topo.edges[edgeId]) return { adopted: false, why: 'edge already known to this topology (' + topo.edges[edgeId].state + ')' };
  var e = declare(topo, edgeId, { at: spec.at, reason: spec.reason });
  e.adopted = true;
  var rec = transition(topo, e, STATE.ACTIVE,
    'ADOPTED (not earned): ' + spec.reason, spec.at, { adopted: true, evidenceAtAdoption: 0 });
  return { adopted: true, transition: rec };
}

/**
 * Record a RESOLVED outcome for an edge.
 *
 * `useful` is the graded judgement; `error` is optional magnitude. Both come from the
 * caller's own resolution path — this module never decides whether an outcome was good,
 * which keeps the grader and the topology editor separate.
 */
function recordOutcome(topo, edgeId, o) {
  var e = topo.edges[edgeId];
  if (!e) return { recorded: false, why: 'unknown edge ' + edgeId };
  if (!o || typeof o.at !== 'number') throw new Error('topology: an outcome needs a caller-supplied `at`');
  if (typeof o.useful !== 'boolean') throw new Error('topology: an outcome must state `useful` explicitly — unknown is not false');

  e.totalN++;
  if (o.useful) { e.usefulN++; e.lastUsefulAt = o.at; e.probation = 0; }
  else { e.harmfulN++; e.probation++; }
  if (typeof o.error === 'number' && isFinite(o.error)) e.errorSum += Math.abs(o.error);
  e.lastOutcomeAt = o.at;

  e.history.push({ at: o.at, useful: o.useful, error: (typeof o.error === 'number') ? o.error : null, ref: o.ref || null });
  while (e.history.length > topo.opts.historyCap) e.history.shift();

  topo.version++;
  return { recorded: true, totalN: e.totalN, utility: utilityOf(e) };
}

/**
 * UTILITY in [-1, 1]: (useful - harmful) / total. Symmetric, bounded, and independent
 * of volume — an edge used 4 times with 4 successes scores the same as one used 400
 * times with 400 successes, which is exactly the property that stops rare-but-useful
 * edges being pruned for being rare.
 */
function utilityOf(e) {
  if (!e.totalN) return null;
  return (e.usefulN - e.harmfulN) / e.totalN;
}

/**
 * Utility over outcomes recorded SINCE the edge entered its current state.
 *
 * The window matters. Cumulative utility would let a long good record drag a
 * just-demoted edge straight back, so the evidence that reverses a decision has to be
 * evidence that arrived AFTER it — otherwise the decision is being overturned by the
 * same numbers that produced it. Returns null below the evidence floor: "unmeasured
 * since" and "recovered since" are different facts.
 */
function utilitySince(topo, e) {
  var n = e.totalN - e.mark.totalN;
  if (n < topo.opts.minEvidence) return null;
  return { n: n, utility: ((e.usefulN - e.mark.usefulN) - (e.harmfulN - e.mark.harmfulN)) / n };
}

/** Is this edge permitted to carry traffic right now? */
function routable(topo, edgeId) {
  var e = topo.edges[edgeId];
  if (!e) return true;   // undeclared edges are governed by the connectome alone
  return ROUTABLE.indexOf(e.state) >= 0;
}

/**
 * Filter a target list. SUBTRACTIVE ONLY — this can never add a target.
 *
 * That is the structural guarantee that topology cannot evade the connectome's own
 * rules: route() has already applied kind, direction, domain, confidence, intendedTarget
 * and fanout limits, and this only removes from what survived. A topology edit therefore
 * cannot smuggle a packet past a type or provenance check.
 */
function filterTargets(topo, targets) {
  return (targets || []).filter(function (t) { return routable(topo, t); });
}

function transition(topo, e, next, reason, at, evidence) {
  var prior = {
    state: e.state, since: e.since, probation: e.probation,
    /* THE FRESH-EVIDENCE BASELINE, captured BEFORE this transition overwrites it below.
       `mark` is what utilitySince() subtracts from, so it decides which outcomes count as
       "since the current state". Omitting it made rollback restore an edge that LOOKED
       identical and BEHAVED differently: state/since/probation went back while the
       baseline stayed at the undone decision. Measured — an edge weakened at n=60, given
       20 more outcomes, then demoted and rolled back, went on to measure a 12-outcome
       fresh window where an edge that never transitioned measured 32, and the two reached
       opposite decisions from the same evidence. */
    mark: { totalN: e.mark.totalN, usefulN: e.mark.usefulN, harmfulN: e.mark.harmfulN },
    totalN: e.totalN, usefulN: e.usefulN, harmfulN: e.harmfulN, errorSum: e.errorSum,
    lastOutcomeAt: e.lastOutcomeAt, lastUsefulAt: e.lastUsefulAt
  };
  var rec = {
    edgeId: e.edgeId,
    from: e.state, to: next,
    at: at,
    reason: reason,
    evidenceCount: e.totalN,
    utility: utilityOf(e),
    ruleVersion: topo.ruleVersion,
    evidence: evidence || null,
    /* Everything needed to put the edge back exactly as it was. */
    rollback: prior
  };
  e.state = next;
  e.since = at;
  e.mark = { totalN: e.totalN, usefulN: e.usefulN, harmfulN: e.harmfulN };
  if (next === STATE.REACTIVATED) e.probation = 0;
  topo.transitions.push(rec);
  while (topo.transitions.length > topo.opts.transitionCap) { topo.transitions.shift(); topo.droppedTransitions++; }
  topo.version++;
  return rec;
}

/**
 * EVALUATE every edge against the rules. Returns the transitions that fired.
 *
 * Pure with respect to the clock: given the same edges and the same `at`, the same
 * transitions fire. Called explicitly rather than on every outcome so that a caller can
 * replay a whole outcome log and then evaluate once, deterministically.
 */
function evaluate(topo, at, opts) {
  if (typeof at !== 'number') throw new Error('topology: evaluate needs a caller-supplied `at`');
  opts = opts || {};
  var o = topo.opts;
  var fired = [];

  Object.keys(topo.edges).forEach(function (id) {
    var e = topo.edges[id];
    if (e.state === STATE.RETIRED) return;                  // reviewer-only state, never auto-changed
    if (e.totalN < o.minEvidence) return;                   // unmeasured is not harmful
    if (at - e.since < o.minDwellMs && !opts.ignoreDwell) return;   // hysteresis in time

    var u = utilityOf(e);
    var ev = { totalN: e.totalN, usefulN: e.usefulN, harmfulN: e.harmfulN, utility: u,
               meanError: e.totalN ? e.errorSum / e.totalN : null };

    if (e.state === STATE.CANDIDATE) {
      if (u >= o.promoteUtility) {
        fired.push(transition(topo, e, STATE.ACTIVE,
          'earned routing: utility ' + u.toFixed(3) + ' over ' + e.totalN + ' resolved outcomes', at, ev));
      } else if (u <= o.dormantUtility) {
        /* A candidate that MEASURES harmful goes dormant rather than lingering as
           unjudged. "Candidate" means not yet assessed; once the evidence is in and it
           is bad, leaving it in that state would misreport an evaluated edge as an
           un-evaluated one, and no rule could ever move it again. */
        fired.push(transition(topo, e, STATE.DORMANT,
          'never earned routing: utility ' + u.toFixed(3) + ' at or below ' + o.dormantUtility +
          ' over ' + e.totalN + ' resolved outcomes; suppressed but retained and reactivatable', at, ev));
      }
      return;
    }

    if (e.state === STATE.ACTIVE) {
      if (u <= o.demoteUtility) {
        fired.push(transition(topo, e, STATE.WEAKENED,
          'measured harm: utility ' + u.toFixed(3) + ' at or below ' + o.demoteUtility, at, ev));
      }
      return;
    }

    if (e.state === STATE.WEAKENED) {
      if (u <= o.dormantUtility) {
        fired.push(transition(topo, e, STATE.DORMANT,
          'sustained harm: utility ' + u.toFixed(3) + ' at or below ' + o.dormantUtility +
          '; suppressed but retained and reactivatable', at, ev));
      } else if (u >= o.promoteUtility) {
        fired.push(transition(topo, e, STATE.ACTIVE,
          'recovered: utility ' + u.toFixed(3) + ' back at or above ' + o.promoteUtility, at, ev));
      }
      return;
    }

    if (e.state === STATE.DORMANT) {
      /**
       * THE ARROW BACK. Without this rule dormancy is one-way under rules alone, and a
       * mechanism built to make the graph editable would only ever be able to shrink it —
       * the exact mirror of the "the graph can only grow" problem row 25 exists to fix.
       *
       * Measured on the real corpus: an integration edge went dormant at utility -0.500,
       * then took six further outcomes, all useful, ending at +0.143 — and stayed
       * suppressed, because at the time nothing but an explicit caller could revive it.
       *
       * The evidence must be FRESH. utilitySince() counts only outcomes recorded after
       * the edge entered dormancy, so the decision is reversed by what happened next, not
       * re-litigated with the same numbers that produced it. A dormant edge routes
       * nothing, so fresh outcomes normally arrive only from work already in flight when
       * it was suppressed, or from a caller deliberately presenting evidence. If none
       * arrive it stays dormant, which is correct: unmeasured is not recovered.
       */
      var since = utilitySince(topo, e);
      if (since && since.utility >= o.promoteUtility) {
        ev.utilitySince = since.utility; ev.nSince = since.n;
        fired.push(transition(topo, e, STATE.REACTIVATED,
          'recovered on FRESH evidence: utility ' + since.utility.toFixed(3) + ' over ' + since.n +
          ' outcomes recorded since dormancy (cumulative ' + u.toFixed(3) + '); on probation', at, ev));
      }
      return;
    }

    if (e.state === STATE.REACTIVATED) {
      /* Probation: a reactivated edge that harms again goes straight back to dormant
         without a second full demotion cycle. */
      if (e.probation >= o.minEvidence || u <= o.dormantUtility) {
        fired.push(transition(topo, e, STATE.DORMANT,
          'failed probation after reactivation: ' + e.probation + ' consecutive harmful outcomes', at, ev));
      } else if (u >= o.promoteUtility) {
        fired.push(transition(topo, e, STATE.ACTIVE,
          'probation passed: utility ' + u.toFixed(3), at, ev));
      }
      return;
    }
  });

  return { at: at, transitions: fired, ruleVersion: topo.ruleVersion };
}

/**
 * REACTIVATE a dormant edge by CALLER DECISION, without waiting for fresh outcomes.
 *
 * evaluate() reactivates on fresh measured evidence; this is the other route, for when
 * the reason lives outside the outcome record — an upstream source repaired, a
 * mis-declared relationship corrected. A dormant edge routes nothing and so normally
 * accrues no new outcomes, which is why a purely evidence-driven path cannot be the only
 * one. The reason is mandatory and recorded either way.
 */
function reactivate(topo, edgeId, spec) {
  var e = topo.edges[edgeId];
  if (!e) return { reactivated: false, why: 'unknown edge ' + edgeId };
  if (e.state !== STATE.DORMANT) return { reactivated: false, why: 'edge is ' + e.state + ', not dormant' };
  if (!spec || typeof spec.at !== 'number') throw new Error('topology: reactivate needs a caller-supplied `at`');
  if (!spec.reason) throw new Error('topology: reactivation must state a reason — a silent revival is not auditable');
  var rec = transition(topo, e, STATE.REACTIVATED, 'reactivated: ' + spec.reason, spec.at, spec.evidence || null);
  return { reactivated: true, transition: rec };
}

/**
 * RETIRE — reviewer-only, and the only path to a permanent state.
 *
 * No rule reaches this. Automatic suppression and permanent removal are different kinds
 * of decision, and conflating them would let an accumulation of ordinary bad outcomes
 * quietly delete a connection nobody chose to delete.
 */
function reviewedRetire(topo, edgeId, spec) {
  var e = topo.edges[edgeId];
  if (!e) return { retired: false, why: 'unknown edge ' + edgeId };
  if (!spec || !spec.reviewer) throw new Error('topology: retirement requires a named reviewer');
  if (!spec.reason) throw new Error('topology: retirement requires a stated reason');
  if (typeof spec.at !== 'number') throw new Error('topology: retirement needs a caller-supplied `at`');
  if (e.state !== STATE.DORMANT && !spec.force) {
    return { retired: false, why: 'edge is ' + e.state + '; retire from dormant, or pass force with justification' };
  }
  var rec = transition(topo, e, STATE.RETIRED,
    'RETIRED by ' + spec.reviewer + ': ' + spec.reason, spec.at,
    { reviewer: spec.reviewer, forced: !!spec.force });
  /* History is NOT deleted. A retired edge remains fully auditable. */
  return { retired: true, transition: rec };
}

/**
 * Undo the last k TRANSITIONS, restoring exact prior topology.
 *
 * WHAT IS AND IS NOT RESTORED, because the distinction is load-bearing:
 *
 *   restored      state, since, probation, mark — the STRUCTURE. That is what a
 *                 transition changed, and undoing a transition means undoing exactly
 *                 that. `mark` belongs here because it is the boundary of the current
 *                 state's evidence window: leave it behind and the edge LOOKS restored
 *                 while `utilitySince` still measures from the undone decision, so the
 *                 next evaluation can differ from the one the original state produces.
 *                 Visually restored is not restored.
 *   NOT restored  totalN / usefulN / harmfulN / errorSum — the OUTCOME LOG. Those are a
 *                 separate event stream recorded by recordOutcome(), and outcomes that
 *                 arrived after the transition are real observations. Rewinding them
 *                 would delete evidence the world actually produced, which is a
 *                 different and much worse operation than undoing a decision.
 *
 * The counters ARE captured in `rollback` as evidence context — what the numbers were
 * when the decision was taken — so an auditor can see the basis without the undo
 * silently rewriting history.
 */
function rollback(topo, k) {
  var undone = [], inexact = [], inexactMark = [];
  for (var i = 0; i < k && topo.transitions.length; i++) {
    var rec = topo.transitions.pop();
    var e = topo.edges[rec.edgeId];
    if (!e) { inexact.push(rec.edgeId); continue; }
    var p = rec.rollback;
    e.state = p.state; e.since = p.since; e.probation = p.probation;
    /* Restored WITH the structure, because it IS structure: the boundary of the current
       state's evidence window, not an observation. A snapshot written before `mark` was
       captured has none, and such an edge keeps its present baseline — inventing one
       would be worse than leaving the gap visible, so `exact` reports it below. */
    if (p.mark) e.mark = { totalN: p.mark.totalN, usefulN: p.mark.usefulN, harmfulN: p.mark.harmfulN };
    else inexactMark.push(rec.edgeId);
    undone.push(rec);
  }
  topo.version++;
  return {
    undone: undone.length, records: undone,
    exact: inexact.length === 0 && inexactMark.length === 0 && topo.droppedTransitions === 0,
    /* Stated rather than silent: past the transition cap the oldest records are gone and
       a rollback that deep cannot be exact. */
    why: topo.droppedTransitions
      ? topo.droppedTransitions + ' transition(s) were trimmed past the ' + topo.opts.transitionCap +
        ' cap; a rollback reaching them cannot be exact'
      : inexactMark.length
      ? inexactMark.length + ' transition record(s) predate the fresh-evidence baseline being ' +
        'captured (' + inexactMark.join(', ') + '), so state was restored but the evidence window ' +
        'was not; the next evaluation may differ from the original'
      : null
  };
}

function report(topo) {
  var byState = Object.create(null);
  Object.keys(STATE).forEach(function (k) { byState[STATE[k]] = 0; });
  var rare = [], harmful = [], adopted = [], earned = [];
  Object.keys(topo.edges).forEach(function (id) {
    var e = topo.edges[id];
    byState[e.state]++;
    /* Inherited structure vs structure this mechanism actually promoted. Kept apart so a
       report can never present a grandfathered edge as evidence the editor is working. */
    if (e.adopted) adopted.push(id); else if (e.state !== STATE.CANDIDATE) earned.push(id);
    var u = utilityOf(e);
    /* Rare but useful: low volume, no measured harm. Reported so the protection is
       visible rather than merely implemented. */
    if (e.totalN > 0 && e.totalN < topo.opts.minEvidence && e.harmfulN === 0) rare.push({ edgeId: id, totalN: e.totalN, utility: u });
    if (u !== null && u <= topo.opts.demoteUtility) harmful.push({ edgeId: id, utility: u, state: e.state });
  });
  return {
    ruleVersion: topo.ruleVersion,
    edges: Object.keys(topo.edges).length,
    byState: byState,
    routableEdges: Object.keys(topo.edges).filter(function (id) { return routable(topo, id); }).length,
    transitions: topo.transitions.length,
    droppedTransitions: topo.droppedTransitions,
    rareButUseful: rare,
    harmful: harmful,
    adoptedEdges: adopted,
    earnedEdges: earned,
    why: byState[STATE.DORMANT] + ' dormant (retained, reactivatable), ' +
         byState[STATE.RETIRED] + ' retired by review, ' + rare.length +
         ' rare-but-useful protected from activity-based pruning; ' + adopted.length +
         ' adopted (inherited, never earned), ' + earned.length + ' moved by measured utility'
  };
}

function serialize(topo) {
  return {
    ruleVersion: topo.ruleVersion, opts: topo.opts, edges: topo.edges,
    transitions: topo.transitions, droppedTransitions: topo.droppedTransitions, version: topo.version
  };
}
function deserialize(o) {
  var t = createTopology((o && o.opts) || {});
  if (o) {
    t.ruleVersion = o.ruleVersion || RULE_VERSION;
    t.edges = o.edges || Object.create(null);
    t.transitions = o.transitions || [];
    t.droppedTransitions = o.droppedTransitions || 0;
    t.version = o.version || 0;
  }
  return t;
}

module.exports = {
  RULE_VERSION: RULE_VERSION,
  STATE: STATE,
  ROUTABLE: ROUTABLE,
  DEFAULTS: DEFAULTS,
  createTopology: createTopology,
  declare: declare,
  adopt: adopt,
  recordOutcome: recordOutcome,
  utilityOf: utilityOf,
  utilitySince: utilitySince,
  routable: routable,
  filterTargets: filterTargets,
  evaluate: evaluate,
  reactivate: reactivate,
  reviewedRetire: reviewedRetire,
  rollback: rollback,
  report: report,
  serialize: serialize,
  deserialize: deserialize
};
