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
    // history, only for the liveness test
    seen: [],
    lastObsAt: null,
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
  ch.lastObsAt = now;
  ch.updates++;
  ch.seen.push(z);
  if (ch.seen.length > 64) ch.seen.shift();
  return { innovation: innovation, gain: K, prior: pre, posterior: ch.x };
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
    liveness: live, updates: ch.updates, innovation: null,
    state: 'absent', why: null, fusable: false
  };

  if (reading == null || typeof reading.value !== 'number' || !isFinite(reading.value)) {
    out.why = 'no reading this cycle — predict-only, variance grew to ' + ch.P.toFixed(4);
    out.fusable = live === 'live';   // a live channel still contributes its (now weaker) belief
    return out;
  }

  if (live === 'dead') {
    ch.seen.push(reading.value);
    if (ch.seen.length > 64) ch.seen.shift();
    out.state = 'dead';
    out.why = 'constant across the last ' + Math.min(ch.seen.length, LIVENESS_WINDOW) +
              ' readings — a channel that does not move is dead, not calm; refusing to fuse it';
    out.fusable = false;
    return out;
  }

  var upd = observe(ch, reading.value, now);
  out.value = ch.x; out.variance = ch.P; out.precision = 1 / Math.max(ch.P, 1e-9);
  out.innovation = upd ? upd.innovation : null;
  out.liveness = liveness(ch);
  out.state = out.liveness === 'unknown' ? 'unknown' : 'measured';
  out.why = out.liveness === 'unknown'
    ? 'only ' + ch.updates + ' observations — cannot yet judge whether this channel moves'
    : null;
  out.fusable = out.liveness === 'live';
  return out;
}

module.exports = {
  createChannel: createChannel,
  liveness: liveness,
  predict: predict,
  observe: observe,
  step: step,
  LIVENESS_WINDOW: LIVENESS_WINDOW,
  LIVENESS_MIN_N: LIVENESS_MIN_N
};
