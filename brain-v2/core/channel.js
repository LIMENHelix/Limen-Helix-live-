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
    // SET parameters [mark: prior] — see header on why these are not fitted
    q: (typeof spec.q === 'number') ? spec.q : 0.02,   // process noise per cadence-period
    r: (typeof spec.r === 'number') ? spec.r : 0.10,   // observation noise
    // history: liveness test AND the per-channel baseline that makes fusion unit-free
    seen: [],
    lastObsAt: null,
    lastSampleAt: null,     // liveness/baseline sampling clock — see observe()
    updates: 0
  };
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

/**
 * Advance the belief to `now` without an observation. Uncertainty grows in proportion to how
 * many of THIS channel's own periods have elapsed (R6) — a quarterly sensor silent for a day
 * has barely aged; an hourly one silent for a day is nearly blind.
 */
function predict(ch, now) {
  var dt;
  if (ch.lastObsAt == null) dt = 1;
  else if (!ch.cadenceMs) dt = 1;
  else dt = Math.max(0, (now - ch.lastObsAt) / ch.cadenceMs);
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
  var K = ch.P / (ch.P + ch.r);
  var innovation = z - ch.x;
  ch.x = ch.x + K * innovation;
  ch.P = (1 - K) * ch.P;
  ch.updates++;

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
  var period = ch.cadenceMs || 0;
  var newPeriod = (ch.lastSampleAt == null) || !period || (now - ch.lastSampleAt) >= period;
  if (newPeriod) {
    ch.seen.push(z);
    if (ch.seen.length > 64) ch.seen.shift();
    ch.lastSampleAt = now;
  }

  ch.lastObsAt = now;
  return { innovation: innovation, gain: K, prior: pre, posterior: ch.x, sampled: newPeriod };
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
    var per = ch.cadenceMs || 0;
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

  var upd = observe(ch, reading.value, now);
  out.value = ch.x; out.variance = ch.P; out.precision = 1 / Math.max(ch.P, 1e-9);
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
  createChannel: createChannel,
  departure: departure,
  BASELINE_MIN_N: BASELINE_MIN_N,
  liveness: liveness,
  predict: predict,
  observe: observe,
  step: step,
  LIVENESS_WINDOW: LIVENESS_WINDOW,
  LIVENESS_MIN_N: LIVENESS_MIN_N
};
