/**
 * brain-v2/kernel/predict.js — BLOCK_B8 prediction registry + BLOCK_B14 forward model.
 *
 * SPEC B14, INV-14, Part 6 L4, Part 15. MASTER_PROMPT §8.5, §8.14. Fidelity: F1 (algorithmic).
 *
 * THIS FILE IS BUILT BEFORE THE MOTOR PATH ON PURPOSE.
 *
 * The neurologist's single disagreement with the standing build plan is that closing the motor
 * loop without a forward model does not produce a learning system, it produces a self-confirming
 * one: act, observe the effect of your own action, score it as independent evidence, grow more
 * confident, act harder. On a system whose actions change what it subsequently *perceives* —
 * which is exactly what an attention-reallocation action does — the contamination is upstream
 * of every downstream block.
 *
 * So the arithmetic here is the whole point, and it is one line:
 *
 *     residual = observed − predicted − efferenceExplained
 *
 * `efferenceExplained` is what the forward model said would happen *because we acted*. Only
 * what is left over is allowed to count as news about the world. Delete that middle term and
 * the system starts congratulating itself; the ablation test in test/loop-acceptance.js
 * demonstrates precisely that, on real data, rather than asserting it.
 *
 * TWO LEARNING SIGNALS, KEPT APART (SPEC B14 required property 3):
 *   - the forward model learns from SUPERVISED error: signed, per-variable, actual − predicted.
 *   - the critic learns from REWARD prediction error: scalar, in modulators.js.
 * Merging them is the classic shortcut and it destroys the ability to tell "my model of my own
 * effects is wrong" apart from "the outcome was worse than hoped".
 *
 * UNFALSIFIABLE PREDICTIONS ARE REFUSED AT REGISTRATION, not scored generously at resolution.
 * A band wide enough to always contain the answer is not a prediction, and a registry that
 * accepted one would report a rising hit-rate as it got vaguer.
 */

'use strict';

var PK = require('./packet.js');
var META = require('../core/metaplasticity.js');

// ─────────────────────────────────────────────────────────────────────────────────────────
// PREDICTION REGISTRY
// ─────────────────────────────────────────────────────────────────────────────────────────

var STATUS = {
  OPEN:         'open',
  RESOLVED:     'resolved',
  UNRESOLVABLE: 'unresolvable',   // the required observation never arrived. NOT an error of 0.
  EXPIRED:      'expired'
};

function createRegistry() {
  return { predictions: Object.create(null), order: [], resolved: [], version: 0 };
}

/**
 * Register a falsifiable prediction.
 *
 * `interval` is required and is checked against `priorSpread` — the spread the variable
 * already had. A band no tighter than the status quo predicts nothing; it is refused with a
 * reason rather than accepted and later counted as a hit.
 */
function register(reg, spec) {
  if (!spec.variable) throw new Error('prediction needs a variable');
  if (typeof spec.expected !== 'number' || !isFinite(spec.expected)) throw new Error('prediction needs a finite expected value');
  if (!Array.isArray(spec.interval) || spec.interval.length !== 2) throw new Error('prediction needs an interval [lo,hi] — a point estimate with no band cannot be falsified');
  var lo = spec.interval[0], hi = spec.interval[1];
  if (!isFinite(lo) || !isFinite(hi) || hi <= lo) throw new Error('prediction interval must be finite and ordered');
  if (typeof spec.evaluateAt !== 'number') throw new Error('prediction needs evaluateAt — an unscheduled check never closes (§8.12)');
  if (!spec.evaluationCondition) throw new Error('prediction needs a stated evaluationCondition — what observation resolves this');

  var width = hi - lo;
  var falsifiable = true, whyNot = null;
  if (typeof spec.priorSpread === 'number' && isFinite(spec.priorSpread) && spec.priorSpread > 0) {
    // A band must be tighter than what the variable does anyway, or it is not a claim.
    if (width >= spec.priorSpread * 2) {
      falsifiable = false;
      whyNot = 'interval width ' + width.toFixed(4) + ' is >= 2x the variable own prior spread ' +
               spec.priorSpread.toFixed(4) + ' — this band cannot be wrong, so it is not a prediction';
    }
  }
  if (!falsifiable) throw new Error('unfalsifiable prediction refused: ' + whyNot);

  var id = 'pr_' + PK.sha256(PK.canonical({
    t: spec.traceId, v: spec.variable, e: spec.expected, at: spec.evaluateAt
  })).slice(0, 20);

  var p = {
    id: id,
    traceId: spec.traceId,
    variable: spec.variable,
    expected: spec.expected,
    interval: [lo, hi],
    intervalWidth: width,
    priorSpread: (typeof spec.priorSpread === 'number') ? spec.priorSpread : null,
    confidence: (typeof spec.confidence === 'number') ? spec.confidence : null,
    uncertainty: (typeof spec.uncertainty === 'number') ? spec.uncertainty : null,
    assumptions: (spec.assumptions || []).slice(),
    evidence: (spec.evidence || []).slice(),
    createdAt: spec.createdAt,
    horizonMs: spec.evaluateAt - spec.createdAt,
    evaluateAt: spec.evaluateAt,
    expiresAt: (typeof spec.expiresAt === 'number') ? spec.expiresAt : spec.evaluateAt + (spec.evaluateAt - spec.createdAt),
    evaluationCondition: spec.evaluationCondition,
    responsibleDomain: spec.responsibleDomain || null,
    // Set at command time if this prediction is about a variable the system is also acting on.
    efferenceCopyId: spec.efferenceCopyId || null,
    status: STATUS.OPEN,
    resolution: null
  };
  reg.predictions[id] = p;
  reg.order.push(id);
  reg.version++;
  return p;
}

/** Predictions whose evaluation time has arrived and which have not yet resolved. */
function due(reg, now) {
  return reg.order
    .map(function (id) { return reg.predictions[id]; })
    .filter(function (p) { return p.status === STATUS.OPEN && now >= p.evaluateAt; });
}

/** Predictions past their expiry that never got their observation. Swept, not silently dropped. */
function sweepExpired(reg, now) {
  var swept = [];
  reg.order.forEach(function (id) {
    var p = reg.predictions[id];
    if (p.status === STATUS.OPEN && now > p.expiresAt) {
      p.status = STATUS.EXPIRED;
      p.resolution = {
        why: 'expired without the required observation — outcome was not observable, ' +
             'which is a fact about our sensors and NOT evidence the prediction was wrong',
        at: now
      };
      swept.push(p);
      reg.version++;
    }
  });
  return swept;
}

/**
 * RESOLVE — the load-bearing function.
 *
 * `observation` may be null, and that case is handled first and separately: an unobserved
 * outcome is UNRESOLVABLE, never an error of zero and never a miss. Scoring an absent
 * observation as either would silently convert a sensor gap into a learning signal, and
 * learning from a signal that is really just blindness is worse than not learning.
 *
 * `efferenceExplained` is the forward model's estimate of the self-caused component. It is
 * REQUIRED to be supplied explicitly (pass 0 with a stated reason if the action could not have
 * moved this variable). Defaulting it to zero would make the contamination invisible, which is
 * the exact failure this module exists to prevent.
 */
function resolve(reg, predictionId, observation, efferenceExplained, now) {
  var p = reg.predictions[predictionId];
  if (!p) return { error: 'unknown prediction ' + predictionId };
  if (p.status !== STATUS.OPEN) return { error: 'prediction already ' + p.status };

  if (observation === null || observation === undefined ||
      typeof observation.value !== 'number' || !isFinite(observation.value)) {
    p.status = STATUS.UNRESOLVABLE;
    p.resolution = {
      why: 'the required observation did not arrive: ' + p.evaluationCondition,
      observable: false,
      at: now
    };
    reg.version++;
    return { prediction: p, resolution: p.resolution, learnable: false };
  }

  if (typeof efferenceExplained !== 'number' || !isFinite(efferenceExplained)) {
    return { error: 'INV-14: efferenceExplained must be supplied explicitly. Pass 0 with a reason if this action could not move ' + p.variable + '.' };
  }

  var observed = observation.value;
  var rawError = observed - p.expected;
  var residual = rawError - efferenceExplained;
  var inInterval = observed >= p.interval[0] && observed <= p.interval[1];

  // Normalised magnitude: error in units of the band half-width, so errors on different
  // variables are comparable without pretending they share units.
  var half = p.intervalWidth / 2;
  var z = half > 0 ? residual / half : null;

  p.status = STATUS.RESOLVED;
  p.resolution = {
    observable: true,
    observed: observed,
    observedAt: observation.at !== undefined ? observation.at : now,
    expected: p.expected,
    rawError: rawError,
    efferenceExplained: efferenceExplained,
    predictionError: residual,
    direction: residual > 0 ? 'over' : (residual < 0 ? 'under' : 'exact'),
    magnitudeZ: z,
    hit: inInterval,
    // The honest headline. If most of the movement was self-caused, a "hit" is not evidence
    // about the world and must not be reported as though it were.
    selfCausedFraction: rawError !== 0 ? Math.abs(efferenceExplained) / Math.abs(rawError) : null,
    contaminated: rawError !== 0 && (Math.abs(efferenceExplained) / Math.abs(rawError)) > 0.5,
    evidenceRefs: (observation.evidence || []).slice(),
    at: now
  };
  reg.resolved.push(p.id);
  reg.version++;
  return { prediction: p, resolution: p.resolution, learnable: true };
}

/**
 * Calibration over resolved predictions. MASTER_PROMPT §18 — reported as MEASURED only when
 * n is stated alongside, because a hit-rate over three predictions is not a calibration.
 */
function calibration(reg) {
  var res = reg.resolved.map(function (id) { return reg.predictions[id]; })
    .filter(function (p) { return p.resolution && p.resolution.observable; });
  if (!res.length) return { n: 0, status: 'UNMEASURED', why: 'no resolved predictions' };
  var hits = res.filter(function (p) { return p.resolution.hit; }).length;
  var contaminated = res.filter(function (p) { return p.resolution.contaminated; }).length;
  var mae = res.reduce(function (a, p) { return a + Math.abs(p.resolution.predictionError); }, 0) / res.length;
  var brierish = res.reduce(function (a, p) {
    var c = (typeof p.confidence === 'number') ? p.confidence : 0.5;
    var o = p.resolution.hit ? 1 : 0;
    return a + (c - o) * (c - o);
  }, 0) / res.length;
  return {
    n: res.length,
    status: res.length >= 20 ? 'MEASURED' : 'ESTIMATED',
    why: res.length >= 20 ? null : 'n=' + res.length + ' is below the 20 needed for a stable estimate; treat as ESTIMATED',
    hitRate: hits / res.length,
    meanAbsoluteError: mae,
    brierScore: brierish,
    contaminatedFraction: contaminated / res.length
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// FORWARD MODEL — BLOCK_B14
// ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * One linear model per (actionKind, variable) pair: predicted self-caused delta = gain*m + bias.
 *
 * WHY LINEAR AND WHY SET-NOT-FITTED AT FIRST. Same measurement that governs core/channel.js:
 * ~250 resolved observations over ~14 sensors is under 2 events per variable against a floor
 * of 10. Nothing here can be fitted from the existing corpus, so gain and bias start at a
 * declared prior and move only under supervised error, bounded, with every step logged. The
 * alternative — a richer model fitted on n=250 — would look more sophisticated and be less
 * trustworthy.
 *
 * `trust` is the part that keeps this honest early. A model with n=0 says so, and the loop
 * treats a zero-trust efference estimate as "unknown self-caused component" rather than as
 * "no self-caused component". Those are different claims and only the second is a measurement.
 */
function createForwardModel(opts) {
  opts = opts || {};
  return {
    models: Object.create(null),
    /* lr is now a FLOOR and a fallback, not the operating rate. Each model derives
       its own from its own error history (SPEC row 22); this is what it uses until
       it has earned a measurement. */
    lr: (typeof opts.lr === 'number') ? opts.lr : 0.10,
    meta: META.createLedger({ targetError: (typeof opts.targetError === 'number') ? opts.targetError : 0.05 }),
    gainBound: (typeof opts.gainBound === 'number') ? opts.gainBound : 4.0,
    trustN: (typeof opts.trustN === 'number') ? opts.trustN : 8,  // observations before trusted
    version: 0,
    consumed: Object.create(null),   // efference ids already learned from — one claim, one update
    history: []      // every update, for rollback (§11: reversible, attributable, bounded)
  };
}

function modelKey(actionKind, variable) { return actionKind + '::' + variable; }

function getModel(fm, actionKind, variable) {
  var k = modelKey(actionKind, variable);
  if (!fm.models[k]) {
    fm.models[k] = {
      key: k, actionKind: actionKind, variable: variable,
      gain: 0.0,          // [mark: prior] start at "I do not know that I move this"
      bias: 0.0,
      latencyMs: null,    // B14's timing job: learned, null until observed
      n: 0, sse: 0,
      lastUpdate: null
    };
  }
  return fm.models[k];
}

/**
 * EFFERENCE COPY — emitted at COMMAND time, before any effect returns (SPEC B11, INV-14).
 *
 * Returns the record that must accompany the action into the log. It states, in advance and
 * on the record, what the system expects its own action to do. Emitting it afterwards would
 * be a rationalisation, which is why the actuator refuses to fire without one.
 */
function efferenceCopy(fm, spec) {
  var m = getModel(fm, spec.actionKind, spec.variable);
  var magnitude = (typeof spec.magnitude === 'number') ? spec.magnitude : 1;
  var predictedDelta = m.gain * magnitude + m.bias;
  var trusted = m.n >= fm.trustN;
  var id = 'ef_' + PK.sha256(PK.canonical({
    t: spec.traceId, a: spec.actionId, v: spec.variable, at: spec.emittedAt
  })).slice(0, 20);
  return {
    id: id,
    traceId: spec.traceId,
    actionId: spec.actionId,
    actionKind: spec.actionKind,
    variable: spec.variable,
    magnitude: magnitude,
    predictedDelta: predictedDelta,
    predictedLatencyMs: m.latencyMs,
    modelKey: m.key,
    modelN: m.n,
    trusted: trusted,
    // The honest label. An untrusted estimate must not be silently subtracted as though known.
    interpretation: trusted
      ? 'forward model has ' + m.n + ' observations; predictedDelta is subtracted from raw error'
      : 'forward model has only ' + m.n + ' observations (< ' + fm.trustN + '); the self-caused ' +
        'component is UNKNOWN, not zero. Subtracting it would overstate what we know; not ' +
        'subtracting it risks scoring our own effect as news. Both are recorded.',
    emittedAt: spec.emittedAt
  };
}

/**
 * How much of an observed change may be attributed to our own action.
 *
 * When the model is untrusted this returns 0 WITH a flag, and the flag travels with the
 * resolution. That is deliberate: refusing to subtract an unknown is right, but pretending
 * the unknown is zero is how the contamination hides. The loop reports both numbers.
 */
function explainedByAction(fm, efference) {
  if (!efference) return { value: 0, trusted: false, why: 'no efference copy for this variable — the action could not have moved it, or the copy was not emitted' };
  if (!efference.trusted) {
    return {
      value: 0,
      trusted: false,
      untrustedEstimate: efference.predictedDelta,
      why: 'forward model n=' + efference.modelN + ' below trust threshold; not subtracting. ' +
           'Raw error is therefore an UPPER BOUND on world-caused change, not a measurement of it.'
    };
  }
  return { value: efference.predictedDelta, trusted: true, why: 'forward model n=' + efference.modelN };
}

/**
 * LEARN — supervised error. actual − predicted, signed, per variable.
 *
 * Bounded (gain is clamped), attributable (every step recorded with its inputs), and
 * reversible (rollback replays history). This is the only place forward-model weights change.
 */
function learn(fm, efference, actualDelta, now) {
  if (!efference) return { updated: false, why: 'no efference copy' };
  if (typeof actualDelta !== 'number' || !isFinite(actualDelta)) return { updated: false, why: 'no finite actual delta' };

  /**
   * ONE SUPERVISED UPDATE PER EFFERENCE COPY. This guard is load-bearing.
   *
   * A copy is a single claim — "this command will move that variable by this much" — and it
   * gets exactly one comparison against reality. Without the guard, a copy sitting inside the
   * window of several predictions is learned from once per prediction, and `n` counts the same
   * event repeatedly. Measured: 2 copies produced 15 "observations", which pushed the model
   * past its trust gate on the strength of one real event and made `trusted` report MEASURED
   * off a sample of 2. An inflated n is worse than a small n, because the small one abstains
   * and the inflated one acts.
   */
  if (fm.consumed && fm.consumed[efference.id]) {
    return { updated: false, why: 'efference copy ' + efference.id + ' already produced its supervised update; one claim, one comparison' };
  }
  if (!fm.consumed) fm.consumed = Object.create(null);
  fm.consumed[efference.id] = true;

  var m = getModel(fm, efference.actionKind, efference.variable);
  var predicted = efference.predictedDelta;
  var err = actualDelta - predicted;           // SUPERVISED error. Signed. Not a reward.
  var mag = efference.magnitude || 1;

  var before = { gain: m.gain, bias: m.bias, n: m.n, sse: m.sse };

  /* METAPLASTICITY. The rate is derived from THIS model's own prior errors, and the
     order here is the safeguard: rateFor() reads history recorded before now, and
     the current error is recorded afterwards. Deriving the rate from history that
     included this error would let an outcome set the rate that then grades it. */
  var lrInfo = META.rateFor(fm.meta, m.key, { min: 0.005, max: 0.25 });
  /* USE THE DERIVED RATE IN BOTH STATES. This line read
       lrInfo.state === 'measured' ? lrInfo.rate : fm.lr
     until 2026-08-01, which threw the abstention floor away and applied the old
     hard-set 0.10 for exactly the first eight updates — the window where the model
     knows least and a fast rate does the most damage. It also made the feature a
     no-op for any model that never reached n=8, while the record still labelled the
     update `abstained`. Measured: first update reported state 'abstained' and
     applied 0.1. Abstention means CREEP AT THE FLOOR, not fall back to the constant
     this module exists to remove. */
  var lr = lrInfo.rate;

  // Normalised delta rule: the 1+mag^2 denominator stops a large-magnitude action from
  // dominating the fit, which at n<10 would otherwise let one event set the model.
  var step = lr * err / (1 + mag * mag);
  m.gain = clamp(m.gain + step * mag, -fm.gainBound, fm.gainBound);
  m.bias = clamp(m.bias + step * 0.5, -fm.gainBound, fm.gainBound);
  m.n++;
  m.sse += err * err;
  m.lastUpdate = now;

  var recorded = META.record(fm.meta, m.key, err);   // strictly AFTER the rate was taken

  var rec = {
    at: now, modelKey: m.key, traceId: efference.traceId, actionId: efference.actionId, efferenceId: efference.id,
    predicted: predicted, actual: actualDelta, supervisedError: err,
    learningRate: lr, rateState: lrInfo.state, rateBasis: lrInfo.why,
    /* If this record pushed the ledger past its cap, the value that fell off the front
       is carried here so rollback can put it back. Without it a deep rollback silently
       loses the oldest error and the restored rate is subtly wrong forever. */
    evictedFromLedger: recorded.evicted !== undefined ? recorded.evicted : null,
    before: before, after: { gain: m.gain, bias: m.bias, n: m.n }
  };
  fm.history.push(rec);
  if (fm.history.length > 4096) fm.history.shift();
  fm.version++;
  return { updated: true, record: rec, rmse: Math.sqrt(m.sse / m.n) };
}

/** Timing calibration — B14's second job. Observed latency folded in as a running mean. */
function learnLatency(fm, efference, observedLatencyMs) {
  if (!efference || typeof observedLatencyMs !== 'number' || !isFinite(observedLatencyMs)) {
    return { updated: false };
  }
  var m = getModel(fm, efference.actionKind, efference.variable);
  m.latencyMs = (m.latencyMs === null) ? observedLatencyMs : (m.latencyMs * 0.8 + observedLatencyMs * 0.2);
  fm.version++;
  return { updated: true, latencyMs: m.latencyMs };
}

/**
 * Undo the last k updates by replaying history. TEST 20 for the forward model specifically.
 *
 * AN UPDATE IS FOUR THINGS, NOT TWO. Until 2026-08-01 this restored gain, bias and n
 * and left behind both the squared error and the metaplasticity ledger entry. The
 * result was a model whose weights claimed an update never happened while its RMSE
 * and its next learning rate both still reflected it. Measured on a rolled-back
 * poison update: n correctly back to 10, sse 0.0542 -> 9788.37, ledger 10 -> 11.
 *
 * Half-reversible is worse than not reversible, because it looks clean. Everything
 * the update touched is undone here, or the undo is not one.
 */
function rollback(fm, k) {
  var undone = [], inexact = [];
  for (var i = 0; i < k && fm.history.length; i++) {
    var rec = fm.history.pop();
    var m = fm.models[rec.modelKey];
    if (m) {
      m.gain = rec.before.gain;
      m.bias = rec.before.bias;
      m.n = rec.before.n;
      /* before.sse was added 2026-08-01. Records written before that lack it, so fall
         back to subtracting the squared error — exact either way, since learn() adds
         precisely that. Clamped at 0 against float drift over a long history. */
      m.sse = (typeof rec.before.sse === 'number')
        ? rec.before.sse
        : Math.max(0, m.sse - rec.supervisedError * rec.supervisedError);
    }
    /* The error that set the NEXT rate has to go too, or an undone outcome keeps
       grading the updates that follow it. */
    var un = META.unrecord(fm.meta, rec.modelKey, rec.evictedFromLedger);
    if (un.removed && un.exact === false) inexact.push(rec.modelKey);
    if (rec.efferenceId && fm.consumed) delete fm.consumed[rec.efferenceId];   // undone means re-learnable
    undone.push(rec);
  }
  fm.version++;
  return {
    undone: undone.length,
    records: undone,
    /* Stated rather than silent: past the ledger's 256-entry cap the oldest errors
       have been evicted and cannot be restored, so a very deep rollback recovers the
       tail but not the head. */
    ledgerExact: inexact.length === 0,
    inexactKeys: inexact
  };
}

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

function forwardModelReport(fm) {
  return {
    models: Object.keys(fm.models).map(function (k) {
      var m = fm.models[k];
      return {
        key: k, gain: m.gain, bias: m.bias, n: m.n,
        rmse: m.n ? Math.sqrt(m.sse / m.n) : null,
        latencyMs: m.latencyMs,
        trusted: m.n >= fm.trustN,
        status: m.n >= fm.trustN ? 'MEASURED' : (m.n > 0 ? 'ESTIMATED' : 'UNMEASURED')
      };
    }),
    updates: fm.history.length,
    version: fm.version,
    learningRates: META.report(fm.meta)
  };
}

/**
 * Serialise / restore — the forward model must survive restart or L4 reopens every boot.
 *
 * THE LEARNING SYSTEM IS PART OF THE STATE. `meta` was omitted here until 2026-08-01,
 * so a restart restored the weights and dropped the error history that governs how
 * they change. Measured: a round trip kept the model and its ten observations and
 * returned learningRates: []. The restored brain therefore resumed at the abstention
 * floor and had to re-earn a rate it had already measured — not restart-equivalent,
 * which is the property the whole store layer exists to provide.
 */
function serialize(fm) {
  return {
    models: fm.models, lr: fm.lr, gainBound: fm.gainBound, trustN: fm.trustN,
    version: fm.version, consumed: fm.consumed, history: fm.history.slice(-512),
    meta: META.serializeLedger(fm.meta)
  };
}
function deserialize(o) {
  var fm = createForwardModel({ lr: o.lr, gainBound: o.gainBound, trustN: o.trustN });
  fm.models = o.models || Object.create(null);
  fm.version = o.version || 0;
  fm.consumed = o.consumed || Object.create(null);
  fm.history = o.history || [];
  /* A snapshot written before meta was serialised restores to an empty ledger, which
     is the old behaviour and correct for that data — there is nothing to restore. */
  fm.meta = META.restoreLedger(o.meta);
  return fm;
}

module.exports = {
  STATUS: STATUS,
  createRegistry: createRegistry,
  register: register,
  due: due,
  sweepExpired: sweepExpired,
  resolve: resolve,
  calibration: calibration,
  createForwardModel: createForwardModel,
  getModel: getModel,
  efferenceCopy: efferenceCopy,
  explainedByAction: explainedByAction,
  learn: learn,
  learnLatency: learnLatency,
  rollback: rollback,
  forwardModelReport: forwardModelReport,
  serialize: serialize,
  deserialize: deserialize
};
