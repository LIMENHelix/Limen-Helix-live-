/**
 * brain-v2/kernel/select.js — BLOCK_B10. THE CRITIC AND THE GATE. Selection by disinhibition.
 *
 * SPEC B10, rows 17/18/19. MASTER_PROMPT §8.8. Fidelity: F1 (algorithmic).
 *
 * NEUROSCIENCE BASIS AND ITS LIMIT. The basal ganglia select by *disinhibition*: SNr/GPi
 * tonically inhibit their thalamic targets, and choosing an action means releasing one brake
 * rather than pushing one option. E1 as biology; the implementation here is E4/E5. This module
 * is NOT a basal ganglia and the No-Shortcut Contract forbids saying it is. What it copies is
 * one specific and unusual property — default-deny by tonic inhibition — plus the three-pathway
 * split, because the third pathway is the one everyone omits and it is the one that matters
 * under conflict.
 *
 * THREE PATHWAYS, THREE JOBS:
 *   DIRECT      release exactly one brake            (go)
 *   INDIRECT    actively suppress the alternatives   (no-go)
 *   HYPERDIRECT hold EVERYTHING while evidence accrues (global stop)
 *
 * The hyperdirect stop is not "reject". It is "nobody moves yet". Without it, a system under
 * conflicting evidence commits to whichever candidate happens to be marginally ahead, which is
 * premature commitment dressed up as decisiveness (SPEC row 17).
 *
 * ACTOR/CRITIC SEPARATION (row 19). The critic's value function below does NOT read the
 * candidate's own `rationale` or its self-reported benefit. It scores from independently
 * observable quantities — evidence quality, uncertainty, reversibility, historical outcomes of
 * this action kind. A critic that scored the proposer's own case for the proposal would be
 * measuring persuasiveness, not value.
 */

'use strict';

var INH = require('./inhibition.js');

var MODULE_ID = 'brain-v2/select';

var PATHWAY = { DIRECT: 'direct', INDIRECT: 'indirect', HYPERDIRECT: 'hyperdirect' };

var DEFAULTS = {
  tonicInhibition: 0.85,     // resting brake on EVERY option. Default-deny (row 18).
  releaseThreshold: 0.55,    // accumulated evidence needed to release a brake
  /**
   * Conflict is RELATIVE, not absolute: gap / top. Lateral inhibition compresses the whole
   * score range, so an absolute gap threshold gets harder to clear exactly as competition
   * gets stronger. Measured: at 0.15 absolute the gate held on 332 of 332 ticks, because
   * post-competition scores clustered around 0.5-0.7 and the raw gap sat just under the line.
   * A ratio is scale-free and stays meaningful however hard the field is competing.
   */
  conflictRatio: 0.06,
  lateralStrength: 0.6,      // competition among candidates
  minEvidenceQuality: 0.25,  // below this nothing is released, whatever it scores
  /**
   * EVIDENCE ACCUMULATION BOUND (SPEC B10: "evidence accumulation to threshold, with the
   * threshold itself modulated"). The leader's relative margin integrates across ticks; when
   * the integral crosses this bound the brake releases.
   *
   * This exists because a bare threshold cannot resolve a persistent near-tie. Measured on
   * real data: raise_attention 0.7838 against collect_evidence 0.7785 is a 0.68% margin that
   * recurred for 207 consecutive ticks, and a gate with no accumulator held every one of them.
   * Permanent indecision is over-inhibition, which SPEC Part 9 lists as a pathology of its own
   * — regulatory paralysis — not as caution. An accumulator lets a small consistent lead win
   * eventually while a genuinely oscillating field still never commits.
   */
  evidenceBound: 0.35,
  accumulatorDecay: 0.85
};

function createGate(opts) {
  return {
    opts: Object.assign({}, DEFAULTS, opts || {}),
    // Every option's brake, keyed by candidate id. Starts at tonic for everything.
    brakes: Object.create(null),
    // Actor/critic: the critic's own outcome history per action kind. Its value estimates
    // come from HERE, not from what the proposer claimed.
    outcomeHistory: Object.create(null),
    // The accumulator: which option is currently leading and how much integrated margin it has.
    accumulator: { leaderKind: null, evidence: 0, ticks: 0 },
    decisions: 0,
    stops: 0,
    version: 0
  };
}

/**
 * THE CRITIC'S VALUE FUNCTION.
 *
 * Deliberately does not read `rationale`, `expectedBenefits` text, or anything the actor wrote
 * to argue its case. Inputs are: measured evidence quality, uncertainty, reversibility class,
 * cost, urgency, and this gate's OWN recorded history for this action kind.
 *
 * `historicalEffect` is null until the kind has resolved outcomes. Null is carried through as
 * null — it is not treated as 0.5, because "we have never done this" and "this works half the
 * time" are different facts and averaging them away is how an untested action gets a middling
 * score that looks like a measurement.
 */
function critique(gate, cand) {
  var h = gate.outcomeHistory[cand.kind];
  var historicalEffect = (h && h.n > 0) ? (h.sumEffect / h.n) : null;
  var historicalN = h ? h.n : 0;

  var reversibilityWeight = cand.reversibility === 'full' ? 1.0
    : cand.reversibility === 'partial' ? 0.6 : 0.2;

  // Value is built from independently checkable quantities only.
  var evidenceTerm = cand.evidenceQuality;                 // [0,1] measured coverage
  var certaintyTerm = 1 - Math.min(1, cand.uncertainty);   // [0,1]
  var costTerm = 1 / (1 + cand.cost);
  var urgencyTerm = cand.urgency;
  var relevanceTerm = numOr(cand.addressesState, 0);       // does it engage the detected state

  /**
   * RELEVANCE CARRIES THE LARGEST WEIGHT, AND THAT IS A CORRECTION, NOT A PREFERENCE.
   *
   * The first weighting here was 0.35 evidence + 0.25 certainty + 0.20 reversibility +
   * 0.10 cost + 0.10 urgency. Run over 332 ticks of real energy history it released
   * `no_action` 90 times out of 90 — because doing nothing is maximally certain, maximally
   * reversible, free, and perfectly evidenced, so it wins on every safety term simultaneously.
   * A critic built only from safety terms is not scoring value; it is scoring inertia, and it
   * will never act however bad the state gets.
   *
   * Relevance is what makes opportunity cost visible to the score: when a departure is detected
   * the null action's relevance collapses to 0.10 and a candidate that engages the departure
   * can outrank it. The safety terms still bound the decision — they just no longer decide it
   * alone.
   */
  var base = 0.34 * relevanceTerm + 0.22 * evidenceTerm + 0.16 * certaintyTerm
           + 0.14 * reversibilityWeight + 0.06 * costTerm + 0.08 * urgencyTerm;

  // History nudges, and only when it exists. Weight grows with n, so one outcome cannot
  // dominate — this is the "do not promote a one-time success into a procedure" rule (§8.11).
  var value = base;
  var historyWeight = 0;
  if (historicalEffect !== null) {
    historyWeight = Math.min(0.30, historicalN / 20 * 0.30);
    value = base * (1 - historyWeight) + clamp01((historicalEffect + 1) / 2) * historyWeight;
  }

  return {
    candidateId: cand.id,
    critic: MODULE_ID,
    value: clamp01(value),
    terms: { relevanceTerm: relevanceTerm, evidenceTerm: evidenceTerm, certaintyTerm: certaintyTerm, reversibilityWeight: reversibilityWeight, costTerm: costTerm, urgencyTerm: urgencyTerm },
    historicalEffect: historicalEffect,
    historicalN: historicalN,
    historyWeight: historyWeight,
    valuedFrom: 'measured candidate attributes and this gate own outcome history; the proposer stated case was not read'
  };
}

/**
 * SELECT.
 *
 * `modulation` comes from BLOCK_B12 and shifts the threshold — SPEC B10 requires the threshold
 * itself be modulated rather than fixed. Tonic dopamine raises vigor (lower threshold), and
 * serotonin's patience raises it (wait longer).
 */
function select(gate, candidates, ctx) {
  ctx = ctx || {};
  var now = ctx.now;
  var mod = ctx.modulation || {};
  var opts = gate.opts;
  gate.version++;

  if (!candidates || candidates.length < 2) {
    return {
      outcome: 'refused',
      why: 'fewer than two candidates — a selection among one option is not a selection (§8.8)',
      candidateCount: candidates ? candidates.length : 0
    };
  }

  // 1. TONIC INHIBITION. Everything starts braked. This is row 18 and it is the resting state,
  //    not a policy applied to suspicious options.
  var brakes = {};
  candidates.forEach(function (c) { brakes[c.id] = opts.tonicInhibition; });

  // 2. CRITIC scores each candidate.
  var scored = candidates.map(function (c) {
    return { cand: c, critique: critique(gate, c) };
  });

  // 3. LATERAL INHIBITION — competition. Each candidate is shunted in proportion to the mass of
  //    its competitors, so a field of equally good options suppresses all of them, which is the
  //    correct behaviour: many good options means the choice is not obvious.
  var acts = {};
  scored.forEach(function (s) { acts[s.cand.id] = s.critique.value; });
  var lat = INH.lateral(acts, opts.lateralStrength);
  scored.forEach(function (s) { s.competed = lat.out[s.cand.id]; });

  scored.sort(function (a, b) { return b.competed - a.competed; });
  var top = scored[0], second = scored[1];
  var gap = top.competed - second.competed;

  // 4. THRESHOLD, modulated (not fixed).
  //    tonic DA -> vigor -> act sooner. 5-HT -> patience -> wait longer.
  var vigor = numOr(mod.vigor, 0);
  var patience = numOr(mod.patience, 0);
  var threshold = clamp01(opts.releaseThreshold - 0.15 * vigor + 0.15 * patience);

  /**
   * THE THRESHOLD IS APPLIED TO THE CRITIC VALUE, NOT THE POST-COMPETITION SCORE.
   *
   * These are two different jobs and the first version conflated them. Lateral inhibition
   * decides WHO wins (competition, opportunity cost); the threshold decides WHETHER anyone
   * wins (evidence sufficiency). Shunting scales every score by roughly (1 - s(N-1)/N), so
   * comparing a post-shunt score against a fixed bar means each extra candidate makes action
   * less likely. Measured: with four candidates every score fell to ~0.44 against a 0.53 bar,
   * so nothing could ever be released. More options should make a decision better informed,
   * not impossible.
   */
  var surprise = numOr(mod.unexpectedUncertainty, 0);
  var relGap = top.competed > 1e-9 ? gap / top.competed : 0;

  // 5. EVIDENCE ACCUMULATION. The leader's relative margin integrates across ticks.
  var acc = gate.accumulator;
  if (acc.leaderKind === top.cand.kind) {
    acc.evidence = acc.evidence * opts.accumulatorDecay + relGap;
    acc.ticks++;
  } else {
    acc.leaderKind = top.cand.kind;
    acc.evidence = relGap;
    acc.ticks = 1;
  }
  var accumulated = acc.evidence;
  var accBound = opts.evidenceBound * (1 + 0.5 * patience - 0.5 * vigor);

  // 6. HYPERDIRECT STOP — the pathway everyone omits (row 17).
  //    Two triggers, and they are different failures:
  //      conflict    the field has not separated AND the accumulator has not yet reached bound
  //      modelDoubt  NE says the current model is failing, so acting on it is worse than waiting
  //    Result is HOLD, not reject: nothing is released, the candidates survive, evidence keeps
  //    integrating. The accumulator is what stops this from becoming permanent paralysis.
  var conflict = relGap < opts.conflictRatio && accumulated < accBound;
  var modelDoubt = surprise > 0.7;
  if (conflict || modelDoubt) {
    gate.stops++;
    return {
      outcome: 'held',
      pathway: PATHWAY.HYPERDIRECT,
      relativeGap: relGap,
      accumulated: accumulated,
      accumulatorBound: accBound,
      accumulatorTicks: acc.ticks,
      why: conflict
        ? 'top two separated by ' + (relGap * 100).toFixed(2) + '% of the leader (< ' +
          (opts.conflictRatio * 100).toFixed(1) + '%), and integrated evidence ' + accumulated.toFixed(3) +
          ' has not yet reached the bound ' + accBound.toFixed(3) + ' after ' + acc.ticks +
          ' ticks leading — holding rather than committing to a coin-flip'
        : 'unexpected uncertainty ' + surprise.toFixed(2) + ' indicates the current model is failing; ' +
          'acting on a model we have reason to doubt is worse than waiting',
      threshold: threshold,
      gap: gap,
      ranked: rank(scored),
      released: null,
      brakes: brakes,
      inhibitionMotifs: [INH.MOTIF.LATERAL],
      at: now
    };
  }

  // 7. Floor checks that no score and no accumulation can override.
  if (top.cand.evidenceQuality < opts.minEvidenceQuality) {
    return {
      outcome: 'held',
      pathway: PATHWAY.HYPERDIRECT,
      why: 'leading candidate evidence quality ' + top.cand.evidenceQuality.toFixed(3) +
           ' is below the floor ' + opts.minEvidenceQuality + ' — no score and no accumulation may buy past this',
      threshold: threshold, gap: gap, accumulated: accumulated, ranked: rank(scored), released: null, brakes: brakes,
      inhibitionMotifs: [INH.MOTIF.LATERAL], at: now
    };
  }
  if (top.critique.value < threshold) {
    return {
      outcome: 'held',
      pathway: PATHWAY.INDIRECT,
      why: 'best candidate critic value ' + top.critique.value.toFixed(4) + ' below release threshold ' + threshold.toFixed(4),
      threshold: threshold, gap: gap, accumulated: accumulated, ranked: rank(scored), released: null, brakes: brakes,
      inhibitionMotifs: [INH.MOTIF.LATERAL], at: now
    };
  }

  // 7. INDIRECT PATHWAY — actively suppress the alternatives. Not merely "not chosen":
  //    their brakes are pushed UP, which is what stops a near-miss re-proposing next tick.
  var rejections = [];
  scored.slice(1).forEach(function (s) {
    brakes[s.cand.id] = clamp01(opts.tonicInhibition + 0.10);
    rejections.push({
      candidateId: s.cand.id,
      kind: s.cand.kind,
      score: s.competed,
      why: 'suppressed by the indirect pathway: scored ' + s.competed.toFixed(4) +
           ' against the winner ' + top.competed.toFixed(4)
    });
  });

  // 9. DIRECT PATHWAY — release exactly one brake, by DISINHIBITION.
  //    Note this calls inhibition.disinhibit rather than setting a flag: selection is
  //    brake-release and shares its primitive with VIP+ gating (SPEC Part 4).
  var vip = clamp01((top.critique.value - threshold) / Math.max(1e-6, 1 - threshold));
  var release = INH.disinhibit(brakes[top.cand.id], vip);
  brakes[top.cand.id] = release.conductanceAfter;

  // The accumulator discharges on commitment. Carrying it forward would let one decision's
  // integrated evidence pay for the next one.
  gate.accumulator = { leaderKind: null, evidence: 0, ticks: 0 };
  gate.decisions++;
  return {
    outcome: 'released',
    pathway: PATHWAY.DIRECT,
    accumulated: accumulated,
    accumulatorBound: accBound,
    released: {
      candidateId: top.cand.id,
      kind: top.cand.kind,
      candidate: top.cand,
      score: top.competed,
      criticValue: top.critique.value,
      brakeBefore: release.conductanceBefore,
      brakeAfter: release.conductanceAfter,
      vip: vip,
      addedDrive: release.addedDrive
    },
    reasonForSelection: 'critic value ' + top.critique.value.toFixed(4) + ' >= threshold ' +
      threshold.toFixed(4) + '; won competition at ' + top.competed.toFixed(4) + ' with a relative margin of ' +
      (relGap * 100).toFixed(2) + '% over the runner-up, integrated evidence ' + accumulated.toFixed(3) +
      ' against bound ' + accBound.toFixed(3),
    reasonForRejectionOfAlternatives: rejections,
    threshold: threshold,
    gap: gap,
    ranked: rank(scored),
    brakes: brakes,
    selectedBy: MODULE_ID,
    inhibitionMotifs: [INH.MOTIF.LATERAL, INH.MOTIF.DISINHIBIT],
    at: now
  };
}

/**
 * The critic learns from resolved outcomes. Separate from the forward model's supervised
 * error (predict.js): this is a scalar effect signal per action kind, the critic's own record.
 */
function recordOutcome(gate, actionKind, effect, now) {
  if (typeof effect !== 'number' || !isFinite(effect)) return { recorded: false, why: 'no finite effect' };
  var h = gate.outcomeHistory[actionKind];
  if (!h) h = gate.outcomeHistory[actionKind] = { n: 0, sumEffect: 0, last: null };
  h.n++; h.sumEffect += effect; h.last = { effect: effect, at: now };
  gate.version++;
  return { recorded: true, kind: actionKind, n: h.n, mean: h.sumEffect / h.n };
}

function rank(scored) {
  return scored.map(function (s) {
    return {
      candidateId: s.cand.id, kind: s.cand.kind,
      criticValue: s.critique.value, afterCompetition: s.competed,
      historicalN: s.critique.historicalN, historicalEffect: s.critique.historicalEffect
    };
  });
}

function serialize(gate) { return { opts: gate.opts, outcomeHistory: gate.outcomeHistory, accumulator: gate.accumulator, decisions: gate.decisions, stops: gate.stops, version: gate.version }; }
function deserialize(o) { var g = createGate(o.opts); g.outcomeHistory = o.outcomeHistory || Object.create(null); g.accumulator = o.accumulator || { leaderKind: null, evidence: 0, ticks: 0 }; g.decisions = o.decisions || 0; g.stops = o.stops || 0; g.version = o.version || 0; return g; }

function clamp01(v) { return (typeof v !== 'number' || !isFinite(v)) ? 0 : (v < 0 ? 0 : (v > 1 ? 1 : v)); }
function numOr(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

module.exports = {
  MODULE_ID: MODULE_ID,
  PATHWAY: PATHWAY,
  DEFAULTS: DEFAULTS,
  createGate: createGate,
  critique: critique,
  select: select,
  recordOutcome: recordOutcome,
  serialize: serialize,
  deserialize: deserialize
};
