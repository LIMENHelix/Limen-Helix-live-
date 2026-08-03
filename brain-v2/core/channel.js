/**
 * brain-v2/core/channel.js — ONE SENSE CHANNEL, as a filter that knows when it is blind.
 *
 * A domain brain is not a scorer. It is a thing that holds a belief about a hidden state,
 * updates that belief when a sensor speaks, and — this is the part the old brain never had —
 * gets LESS certain when a sensor goes quiet. Certainty that decays without evidence is the
 * difference between a nervous system and a dashboard.
 *
 * WHY KALMAN AND NOT SOMETHING FANCIER, decided from measurement not taste:
 *   ~250 resolved observations over ~14 sensors. At ~10% event rate that is 1.8 events per
 *   variable; the literature floor for a stable fitted coefficient is 10 EPV (Peduzzi 1996)
 *   and ~20 before bootstrap-corrected estimates match held-out data (Austin & Steyerberg
 *   2017). We are 5-10x short. So every parameter here is SET, not learned, and the only
 *   thing that moves on its own is uncertainty.
 *
 *   Predictive coding IS this, in the linear-Gaussian case — Rao & Ballard derived their
 *   model from the Kalman filter, and Millidge et al. 2021 (arXiv:2102.10021) show the
 *   gradient approximation needs only local variance-weighted prediction errors. So this is
 *   predictive coding as the frame and Kalman as the implementation, which is honest;
 *   building predictive-coding NETWORKS (arXiv:2006.04182) would need a deep net and a
 *   training set, and we have neither.
 *
 * THE PROPERTY THAT MATTERS: with no observation we run predict-only and P grows. Nobody has
 * to remember to write an abstention rule — going blind is the same operation as time passing.
 * Sinopoli et al. show there is a critical observation-arrival rate below which the estimate
 * diverges, which gives a principled "I cannot say" instead of a hand-picked threshold.
 *
 * Pure: no Date, no I/O, no globals. `now` is passed in so a cycle is reproducible and a
 * replay of stored readings gives byte-identical output. That is R9 (version the apparatus)
 * made possible rather than promised.
 */

'use strict';

/** Channel state is small and fully inspectable on purpose. */
function createChannel(spec) {
  if (!spec || !spec.key) throw new Error('channel needs a key');
  return {
    key: spec.key,
    source: spec.source || null,          // R1: where the number comes from, declared
    cadenceMs: spec.cadenceMs || null,    // R6: this channel's own clock, stated
    units: spec.units || null,
    // belief
    x: (typeof spec.x0 === 'number') ? spec.x0 : 0.5,
    P: (typeof spec.P0 === 'number') ? spec.P0 : 1.0,
    /**
     * NOISE PARAMETERS (SPEC row 22). `q` and `r` are the EFFECTIVE values the filter
     * uses. They start at the declared prior and, once enough innovations exist, are
     * derived from this channel's own innovation sequence rather than staying set.
     *
     * r IS TWO FACTORS, AND THEY MUST NOT BE ONE NUMBER.
     *
     *   rBase   what the world's noise is measured to be. Owned by the estimator.
     *   rGain   how much attention is being paid. Owned by the raise/lower_attention
     *           actions, which is the loop's only real effector.
     *
     * They were the same field until row 22, which made the two mechanisms overwrite
     * each other: a derivation silently erased every attention change since the last
     * one, and the efference copy predicting that change would then be scored against a
     * variable somebody else had already reset. Splitting them lets attention and
     * measurement compose — r = rBase * rGain — so each mechanism owns exactly what it
     * is entitled to move.
     */
    q: (typeof spec.q === 'number') ? spec.q : 0.02,   // process noise per cadence-period
    r: (typeof spec.r === 'number') ? spec.r : 0.10,   // EFFECTIVE observation noise = rBase * rGain
    rBase: (typeof spec.r === 'number') ? spec.r : 0.10,
    rGain: 1.0,
    /* The declared values, kept so drift away from them stays visible and so a
       derivation can always be compared against what a human originally chose. */
    qDeclared: (typeof spec.q === 'number') ? spec.q : 0.02,
    rDeclared: (typeof spec.r === 'number') ? spec.r : 0.10,
    /* INNOVATION HISTORY — the estimator's only input. Each entry pairs the innovation
       with the P_prior that accompanied it, because r = var(v) - mean(P_prior) needs
       both and pairing them after the fact would mis-align them. */
    innov: [],
    innovP: [],
    /* The ATTENTION GAIN and the EFFECTIVE r actually in force when each innovation was
       produced. Recorded per sample rather than read at derivation time, because
       attention moves during a window and the current value says nothing about the
       conditions the older innovations were collected under. Without these the estimator
       measures effective r, stores it as base, and applyR() multiplies the gain in a
       second time. */
    innovG: [],
    innovR: [],
    noiseState: { q: 'prior', r: 'prior', derivations: 0, lastAt: null, why: 'no derivation yet' },
    // history: liveness test AND the per-channel baseline that makes fusion unit-free
    seen: [],
    lastObsAt: null,
    lastSampleAt: null,     // liveness/baseline sampling clock — see observe()
    updates: 0,
    /* CADENCE INFERENCE (SPEC row 27). Timestamps at which this channel's value
       actually CHANGED, and the last value seen. Deliberately not every observation:
       the interval between observations is the POLL rate, which is a fact about our
       scheduler, not about the world. A daily series polled hourly would measure as
       hourly and every downstream horizon would be wrong by 24x. The interval between
       changes is the rate the source can actually answer at. */
    changeAt: [],
    lastValue: null,
    /* SOURCE-SUPPLIED observation identity, from the adapter. See sourceIdentity(). */
    lastSourceIdentity: null
  };
}

/**
 * THE IDENTITY OF AN UPSTREAM OBSERVATION, and why it can only come from the adapter.
 *
 * Nothing computed locally can tell "the source published a new record" apart from "we
 * re-read a cached value". Three attempts got this wrong in turn:
 *
 *   ch.updates    counts POLLS — incremented on every valid reading, unchanged or not.
 *   ch.lastSampleAt  is a LOCAL CADENCE CLOCK. Demonstrated: the same value submitted
 *                 twice, two hours apart, advances it. A cached value crossing a
 *                 cadence boundary became "new evidence".
 *   value change  is sufficient but not necessary — see the ladder below.
 *
 * Only the adapter knows. It may supply, in order of preference:
 *
 *   observationId                  an opaque unique id per upstream record
 *   sourceRecordId + sourceVersion a record key plus its revision
 *   sourceObservedAt               when the SOURCE observed it, not when we polled
 *
 * Returns null when none is supplied. Null is NOT an invitation to substitute a local
 * clock — it means the caller cannot distinguish a fresh record from a cached one, and
 * anything counting evidence must degrade or abstain rather than guess.
 */
function sourceIdentity(reading) {
  if (!reading) return null;
  if (reading.observationId !== undefined && reading.observationId !== null) {
    return 'oid:' + reading.observationId;
  }
  if (reading.sourceRecordId !== undefined && reading.sourceRecordId !== null) {
    return 'rec:' + reading.sourceRecordId + '@' +
      (reading.sourceVersion !== undefined && reading.sourceVersion !== null ? reading.sourceVersion : '-');
  }
  if (typeof reading.sourceObservedAt === 'number' && isFinite(reading.sourceObservedAt)) {
    return 'sat:' + reading.sourceObservedAt;
  }
  return null;
}

var LIVENESS_WINDOW = 12;      // observations considered for the dead-channel test
var LIVENESS_MIN_N = 6;        // below this we cannot judge liveness — say so, do not guess
var LIVENESS_EPS = 1e-6;       // spread at or below this is a constant, not a reading

/**
 * THE LIVENESS GATE — the first of the three gates, and the one that has already cost this
 * project the most.
 *
 * A channel whose value never changes is DEAD, not calm. Fused as an observation it enters
 * with full precision and drags every domain toward the same number. That is exactly the
 * recorded failure where grounded CISS read 0.5042 for all twenty domains simultaneously.
 *
 * Returns 'live' | 'dead' | 'unknown'. `unknown` is not a soft 'live' — a caller must treat
 * it as unfused, because "I have not seen enough of this channel to know if it moves" is a
 * different fact from "it moves".
 */
function liveness(ch) {
  var s = ch.seen;
  if (s.length < LIVENESS_MIN_N) return 'unknown';
  var w = s.slice(-LIVENESS_WINDOW);
  var lo = w[0], hi = w[0];
  for (var i = 1; i < w.length; i++) { if (w[i] < lo) lo = w[i]; if (w[i] > hi) hi = w[i]; }
  return (hi - lo) <= LIVENESS_EPS ? 'dead' : 'live';
}

var CHANGE_EPS = 1e-9;
var CADENCE_MIN_CHANGES = 6;   // intervals need at least this many change events

/**
 * INFER CADENCE from this channel's own observed change spacing. SPEC row 27.
 *
 * Returns the MEDIAN interval between changes, not the mean: one long outage would
 * drag a mean to nonsense, and a median survives it. Jitter is reported as the median
 * absolute deviation for the same reason.
 *
 * ABSTAINS below CADENCE_MIN_CHANGES. A channel that has changed twice has one
 * interval, and one interval is an anecdote. Abstaining hands the declared cadence
 * back to the caller, which is a stated prior rather than a measurement, and it is
 * labelled as such.
 */
function inferCadence(ch) {
  var t = ch.changeAt || [];
  if (t.length < CADENCE_MIN_CHANGES) {
    return {
      state: 'abstained',
      cadenceMs: ch.cadenceMs || null,
      source: 'declared',
      changes: t.length,
      why: 'only ' + t.length + ' change event(s); ' + CADENCE_MIN_CHANGES +
           ' needed before an interval is worth anything. Falling back to the DECLARED cadence, which is a prior.'
    };
  }
  var iv = [];
  for (var i = 1; i < t.length; i++) { var d = t[i] - t[i - 1]; if (d > 0) iv.push(d); }
  if (!iv.length) {
    return { state: 'abstained', cadenceMs: ch.cadenceMs || null, source: 'declared', changes: t.length,
             why: 'all change events share a timestamp; no interval to measure' };
  }
  var sorted = iv.slice().sort(function (a, b) { return a - b; });
  var med = sorted[Math.floor(sorted.length / 2)];
  var dev = sorted.map(function (x) { return Math.abs(x - med); }).sort(function (a, b) { return a - b; });
  var mad = dev[Math.floor(dev.length / 2)];

  var declared = ch.cadenceMs || null;
  var ratio = declared ? med / declared : null;
  return {
    state: 'measured',
    cadenceMs: med,
    jitterMs: mad,
    source: 'measured',
    changes: t.length,
    intervals: iv.length,
    declaredMs: declared,
    ratio: ratio,
    /* A large gap between declared and measured is the finding, not an error to
       silence: it means the manifest is wrong about how fast this source moves. */
    disagreesWithDeclared: ratio !== null && (ratio > 2 || ratio < 0.5),
    why: 'median of ' + iv.length + ' inter-change intervals' +
         (ratio !== null ? '; declared ' + Math.round(declared / 3600000) + 'h, measured ' +
          (med / 3600000).toFixed(1) + 'h (' + ratio.toFixed(2) + 'x)' : '')
  };
}

/** The cadence to actually USE: measured where earned, declared until then. */
function effectiveCadence(ch) {
  var c = inferCadence(ch);
  return c.cadenceMs || ch.cadenceMs || null;
}

/**
 * Advance the belief to `now` without an observation. Uncertainty grows in proportion to how
 * many of THIS channel's own periods have elapsed (R6) — a quarterly sensor silent for a day
 * has barely aged; an hourly one silent for a day is nearly blind.
 */
function predict(ch, now) {
  /* Uncertainty grows in units of THIS channel's own period. Using the measured
     cadence once it is earned means a source that turns out to move faster than
     declared also goes uncertain faster, which is the whole point of measuring it. */
  var period = effectiveCadence(ch);
  var dt;
  if (ch.lastObsAt == null) dt = 1;
  else if (!period) dt = 1;
  else dt = Math.max(0, (now - ch.lastObsAt) / period);
  ch.P = ch.P + ch.q * dt;
  return ch;
}

/**
 * Fold in an observation. Standard scalar Kalman update.
 * Returns the innovation (prediction error) — the quantity predictive coding calls the
 * thing that actually drives learning, and the only signal we will later let a delta rule see.
 */
function observe(ch, z, now) {
  if (typeof z !== 'number' || !isFinite(z)) return null;
  var pre = ch.x;
  var Pprior = ch.P;
  var K = ch.P / (ch.P + ch.r);
  var innovation = z - ch.x;
  ch.x = ch.x + K * innovation;
  ch.P = (1 - K) * ch.P;
  ch.updates++;

  /* The estimator's input, recorded at the only point where both halves are true
     simultaneously. P_prior is captured BEFORE the update overwrites it. */
  ch.innov.push(innovation);
  ch.innovP.push(Pprior);
  /* The realised gain, r/rBase, not the nominal rGain: applyR clamps, so after a clamp
     the two differ and only the realised one describes the filter that ran. */
  ch.innovG.push(ch.rBase > 1e-12 ? ch.r / ch.rBase : 1);
  ch.innovR.push(ch.r);
  if (ch.innov.length > INNOV_CAP) { ch.innov.shift(); ch.innovP.shift(); ch.innovG.shift(); ch.innovR.shift(); }

  /**
   * LIVENESS SAMPLES ARE TAKEN AT THE CHANNEL'S OWN CADENCE, NOT PER OBSERVATION.
   *
   * Found by replaying 361 hours of real recorded energy: fredCrude was flagged DEAD. It is
   * not dead — FRED WTI is a DAILY series being read HOURLY, so of course twelve consecutive
   * hourly reads carry the same daily close. Judging liveness on raw consecutive observations
   * declares every slow channel dead the moment it is polled faster than it updates.
   *
   * That is the same defect this project has hit five times already under other names: one
   * clock applied to signals that move at different rates. The contract's own R6 says state
   * every clock; the first version of this file declared cadence and then ignored it.
   *
   * Fix: a liveness sample is only recorded once per cadence period. A daily channel polled
   * hourly contributes one sample per day, so "has this moved" is asked at the rate the
   * channel can actually answer. The Kalman update still runs on every observation — only the
   * liveness/baseline history is decimated.
   */
  /**
   * MEASURED cadence, not declared. This read ch.cadenceMs until 2026-08-01, which
   * made the cadence-inference commit half a fix: predict() grew uncertainty against
   * the measured period while sampling stayed decimated at the declared one. The
   * three channels found to change every 1-4h while declared 24h therefore still
   * threw away 23 of every 24 liveness samples — the exact information loss that
   * commit reported fixing. Measured before this line changed: 48 hourly
   * observations on a daily-declared channel retained 2 samples.
   *
   * NO FEEDBACK LOOP. inferCadence reads ch.changeAt, which is appended below on
   * every observation regardless of whether this period sampled. So the estimator's
   * input is never the estimator's own output; sampling can follow it safely.
   */
  var period = effectiveCadence(ch) || 0;
  var newPeriod = (ch.lastSampleAt == null) || !period || (now - ch.lastSampleAt) >= period;
  if (newPeriod) {
    ch.seen.push(z);
    if (ch.seen.length > 64) ch.seen.shift();
    ch.lastSampleAt = now;
  }

  /* Record only genuine changes. CHANGE_EPS exists because a float that differs in
     the fifteenth decimal place is not news; without it, quantisation noise would
     read as a change every poll and collapse the inferred cadence to the poll rate. */
  if (ch.lastValue === null || Math.abs(z - ch.lastValue) > CHANGE_EPS) {
    ch.changeAt.push(now);
    if (ch.changeAt.length > 64) ch.changeAt.shift();
    ch.lastValue = z;
  }

  ch.lastObsAt = now;
  return { innovation: innovation, gain: K, prior: pre, posterior: ch.x, sampled: newPeriod };
}

var INNOV_CAP = 64;

/**
 * DERIVE q AND r FROM THIS CHANNEL'S OWN INNOVATIONS. SPEC row 22.
 *
 * Called explicitly rather than inside observe(), for the same reason topology.evaluate
 * is: a caller must be able to replay a whole observation sequence and then derive once,
 * deterministically, and a control run must be able to not call it at all.
 *
 * THE PRIOR IS THE CURRENT VALUE, NOT THE DECLARED ONE. Damping toward the declared
 * constant would make it a spring: the estimate could never travel further than one
 * damped step from whatever a human first typed, and "derived" would describe a number
 * still anchored to a guess. Recursive updating converges instead, and the absolute
 * bounds plus the per-derivation factor limit are what keep it from running away.
 *
 * THE FEEDBACK IS REAL AND IS BOUNDED RATHER THAN DENIED. The innovations this reads
 * were produced by a filter using the r it is about to change, so the estimator consumes
 * its own output. That is inherent to adaptive filtering, not a defect introduced here,
 * and the controls on it are explicit: at most a 3x factor per derivation, 30% damping,
 * a floor and a ceiling, and a minimum sample count. What it is NOT allowed to do is
 * quietly absorb attention: attention moves rGain, this moves rBase.
 */
function deriveNoise(ch, now, opts) {
  var MP = require('./metaplasticity.js');
  opts = opts || {};
  if (ch.innov.length < MP.NOISE_MIN_N) {
    ch.noiseState = { q: ch.noiseState.q, r: ch.noiseState.r, derivations: ch.noiseState.derivations,
      lastAt: ch.noiseState.lastAt,
      why: 'only ' + ch.innov.length + ' innovations; ' + MP.NOISE_MIN_N + ' needed. Holding the declared prior.' };
    return { derived: false, why: ch.noiseState.why };
  }

  var rEst = MP.deriveObservationNoise(ch.innov, ch.innovP, Object.assign({
    prior: ch.rBase, min: 0.01, max: 4.0, gains: ch.innovG
  }, opts.r || {}));
  /* `r` is passed so the consistency ratio can be computed against the real S = P + r.
     Without it the whiteness test would adjust q on autocorrelation alone and walk a
     slow channel's q to the ceiling. */
  var qEst = MP.deriveProcessNoise(ch.innov, ch.innovP, Object.assign({
    prior: ch.q, min: 1e-6, max: 1.0, r: ch.r, rSeries: ch.innovR
  }, opts.q || {}));

  var before = { q: ch.q, r: ch.r, rBase: ch.rBase };
  if (rEst.state === 'measured') { ch.rBase = rEst.value; applyR(ch); }
  if (qEst.state === 'measured') ch.q = qEst.value;

  ch.noiseState = {
    q: qEst.state === 'measured' ? 'derived' : 'prior',
    r: rEst.state === 'measured' ? 'derived' : 'prior',
    derivations: ch.noiseState.derivations + 1,
    lastAt: now,
    n: ch.innov.length,
    why: 'r: ' + rEst.why + ' | q: ' + qEst.why
  };
  return { derived: true, before: before, after: { q: ch.q, r: ch.r, rBase: ch.rBase }, r: rEst, q: qEst };
}

/** Recompute the effective r from its two owners. The only place r is assigned. */
function applyR(ch) {
  var v = ch.rBase * ch.rGain;
  ch.r = v < 0.01 ? 0.01 : (v > 4.0 ? 4.0 : v);
  return ch.r;
}

/**
 * ATTENTION. Multiplies rGain, never rBase — attention is a statement about how closely
 * we are looking, not a claim about how noisy the world is.
 */
function setAttentionGain(ch, gain) {
  if (typeof gain !== 'number' || !isFinite(gain) || gain <= 0) return ch.r;
  ch.rGain = gain < 0.05 ? 0.05 : (gain > 20 ? 20 : gain);
  return applyR(ch);
}

/**
 * One channel step. This is the whole per-sensor contract:
 *   reading present  -> predict, then observe
 *   reading absent   -> predict only; P grows; state becomes 'absent'
 *   channel dead     -> predict only and REFUSE to fuse, however fresh the number is
 *
 * `state` is one of measured | absent | dead | unknown, never a boolean, because R2 says
 * missing is not empty and unmeasurable is not zero.
 */
function step(ch, reading, now) {
  predict(ch, now);
  var live = liveness(ch);
  var out = {
    key: ch.key, source: ch.source, cadenceMs: ch.cadenceMs, units: ch.units,
    value: ch.x, variance: ch.P, precision: 1 / Math.max(ch.P, 1e-9),
    departure: null,                       // set below; the unit-free quantity fusion uses
    liveness: live, updates: ch.updates, innovation: null,
    cadence: inferCadence(ch),
    /**
     * THE SOURCE-CADENCE OBSERVATION IDENTITY. Consumers that need to know "did this
     * channel actually say something new" must use these, NOT `updates`.
     *
     * `updates` counts POLLS: observe() increments it on every valid reading, including
     * a re-read of an unchanged value. Verified — observing 5 five times takes updates
     * from 0 to 5 while the value never moved. Anything counting evidence from it is
     * counting the scheduler.
     *
     *   sampleAt  advances at most once per the channel's own (measured) cadence
     *             period. Polling faster than the source cannot advance it, which is
     *             exactly the property "new data arrived" needs.
     *   changes   genuine value changes recorded, from the same clock cadence
     *             inference uses.
     */
    sampleAt: ch.lastSampleAt,
    samples: ch.seen.length,
    changes: ch.changeAt.length,
    updates: ch.updates,
    /* THE ONLY FIELD A CONSUMER MAY COUNT EVIDENCE FROM. Null when the adapter supplied
       no identity, and null must be treated as "cannot tell", never as "no new data"
       and never as grounds to substitute sampleAt (a local cadence clock). */
    sourceIdentity: ch.lastSourceIdentity,
    state: 'absent', why: null, fusable: false
  };

  if (reading == null || typeof reading.value !== 'number' || !isFinite(reading.value)) {
    out.why = 'no reading this cycle — predict-only, variance grew to ' + ch.P.toFixed(4);
    out.departure = departure(ch);
    out.fusable = live === 'live' && out.departure !== null;
    if (live === 'live' && out.departure === null) out.why += '; no baseline yet — not fusable';
    return out;
  }

  if (live === 'dead') {
    /* THE SECOND SAMPLING PATH, and it read ch.cadenceMs until 2026-08-01 too. This
       one governs how fast a dead channel can come back: liveness needs 12 samples
       showing movement, so sampling a revived channel at a wrongly-declared 24h means
       12 days to be called live again instead of 12 of its real periods. Fixing
       observe() alone would have left recovery broken while making detection work. */
    var per = effectiveCadence(ch) || 0;
    if (ch.lastSampleAt == null || !per || (now - ch.lastSampleAt) >= per) {
      ch.seen.push(reading.value);
      if (ch.seen.length > 64) ch.seen.shift();
      ch.lastSampleAt = now;
    }
    out.state = 'dead';
    out.why = 'constant across the last ' + Math.min(ch.seen.length, LIVENESS_WINDOW) +
              ' readings — a channel that does not move is dead, not calm; refusing to fuse it';
    out.fusable = false;
    return out;
  }

  /* Recorded from the READING, before the Kalman update, because it is a property of
     the upstream record and not of our filter. */
  ch.lastSourceIdentity = sourceIdentity(reading);
  var upd = observe(ch, reading.value, now);
  out.value = ch.x; out.variance = ch.P; out.precision = 1 / Math.max(ch.P, 1e-9);
  /* Re-read AFTER observe(), or the sensor reports the pre-observation identity and a
     consumer counting evidence is always one cycle behind. */
  out.sampleAt = ch.lastSampleAt; out.samples = ch.seen.length;
  out.changes = ch.changeAt.length; out.updates = ch.updates;
  out.sourceIdentity = ch.lastSourceIdentity;
  out.innovation = upd ? upd.innovation : null;
  out.departure = departure(ch);
  out.liveness = liveness(ch);
  out.state = out.liveness === 'unknown' ? 'unknown' : 'measured';
  out.why = out.liveness === 'unknown'
    ? 'only ' + ch.updates + ' observations — cannot yet judge whether this channel moves'
    : (out.departure === null ? 'no baseline yet — measured but not fusable' : null);
  out.fusable = out.liveness === 'live' && out.departure !== null;
  return out;
}

var BASELINE_MIN_N = 8;

/**
 * DEPARTURE — the channel's reading expressed in its OWN standard deviations.
 *
 * This is what makes cross-channel fusion mean anything. Crude is $/bbl, an RSS channel is
 * an article count, KEV is a vulnerability count. A precision-weighted mean of the raw values
 * is arithmetic on incommensurable units and would be dominated by whichever channel happens
 * to have the largest numbers. Measured on the live payload: energy's RSS values run 52-100
 * while recent7d runs 1-34, so raw fusion would let a saturated count outvote a real price move.
 *
 * Departure removes the unit. Every channel then contributes the same thing — "how far am I
 * from my own normal" — which is also exactly the quantity dysregulation is defined on, so
 * the fused state and the detector finally speak the same language.
 *
 * Returns null when the baseline is too thin to be meaningful. null is NOT zero: a channel
 * with no baseline has not said "I am normal", it has said nothing.
 */
function departure(ch) {
  var h = ch.seen.slice(0, -1);
  if (h.length < BASELINE_MIN_N) return null;
  var m = h.reduce(function (a, b) { return a + b; }, 0) / h.length;
  var sd = Math.sqrt(h.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / h.length);
  if (sd <= 1e-9) return null;              // constant baseline — the liveness gate owns this case
  return { z: (ch.x - m) / sd, mean: m, sd: sd, n: h.length };
}

module.exports = {
  deriveNoise: deriveNoise,
  setAttentionGain: setAttentionGain,
  applyR: applyR,
  INNOV_CAP: INNOV_CAP,
  createChannel: createChannel,
  sourceIdentity: sourceIdentity,
  inferCadence: inferCadence,
  effectiveCadence: effectiveCadence,
  CADENCE_MIN_CHANGES: CADENCE_MIN_CHANGES,
  departure: departure,
  BASELINE_MIN_N: BASELINE_MIN_N,
  liveness: liveness,
  predict: predict,
  observe: observe,
  step: step,
  LIVENESS_WINDOW: LIVENESS_WINDOW,
  LIVENESS_MIN_N: LIVENESS_MIN_N
};
