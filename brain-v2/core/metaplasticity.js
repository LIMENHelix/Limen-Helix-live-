/**
 * brain-v2/core/metaplasticity.js — SPEC row 22 / B17. Learning rates measured, not set.
 *
 * SPEC B17: "Learning rates are derived from each block's own observed statistics,
 * never hand-set per block. The measure-or-abstain pattern (derive from own history;
 * abstain until known) is the correct shape."
 *
 * THE GAP THIS CLOSES. The project's own review history has logged this finding at
 * least four times and widened it every time. brain-v2 arrived with a hand-set
 * forward-model rate of 0.10, per-channel q and r, six critic weights, a trust
 * threshold and an accumulator bound: every one a constant somebody chose. A system
 * carrying N hand-tuned constants has N scale-specific special cases, which is an
 * INV-12 violation repeated N times.
 *
 * WHAT A DERIVED RATE ACTUALLY NEEDS TO BE.
 *
 * Not "big error means learn faster". That is a feedback loop with no damping and it
 * chases noise: a channel that is simply unpredictable would drive its own rate to
 * the ceiling and thrash. Two quantities are needed, and they pull opposite ways:
 *
 *   NEED       how far mean error sits from where it should be. High need argues
 *              for a faster rate: the model is wrong and should move.
 *   RELIABILITY how consistent that error is. Errors that scatter widely are noise,
 *              and moving fast on noise writes the noise into the weights. Low
 *              reliability argues for a slower rate however large the error.
 *
 * rate = min + (max - min) * need * reliability
 *
 * A model that is reliably wrong learns fast. A model that is wrong at random learns
 * slowly, which is correct: nothing there is learnable yet.
 *
 * RELIABILITY HAS TWO INDEPENDENT PARTS, and the first version had only one.
 *
 * That version mapped every error through Math.abs before measuring variance. So a
 * model erring +0.2, -0.2, +0.2, -0.2 — overshooting the target and reversing its
 * correction every single step — presented as zero variance, reliability 1.0, and
 * the MAXIMUM learning rate. Exactly backwards: alternating signs are the signature
 * of a learner already stepping too far, and the response has to be to slow down.
 * Measured before the fix: alternating +-0.2 and steady +0.2 both returned 0.2500.
 *
 *   DIRECTIONAL  |mean(e)| / mean(|e|), on SIGNED errors. 1.0 when every correction
 *                pulls the same way (a real bias worth chasing), 0 when they cancel
 *                (oscillation, or noise around a correct model).
 *   MAGNITUDE    1 / (1 + var(|e|)/mean(|e|)^2). Catches errors of wildly differing
 *                size that happen to share a sign.
 *
 * reliability = directional * magnitude — both must hold. A caller that passes
 * already-absolute errors gets directional = 1 and the old magnitude-only behaviour,
 * which is why kernel/predict.js records the SIGNED supervised error.
 *
 * THE SAFEGUARD THAT MATTERS MOST. The rate applied to update k must be derived from
 * history STRICTLY BEFORE k. Deriving it from history that includes k would let an
 * outcome set the rate that then grades it, which is the same circularity the
 * project has already found in its own stress pipeline. `deriveRate` therefore takes
 * a history array and the caller passes the prefix; it never sees the current error.
 *
 * Pure and deterministic. No clock, no I/O, no state of its own.
 */

'use strict';

var MIN_N = 8;          // resolved outcomes before a rate is anything but a guess
var RATE_MIN = 0.005;
var RATE_MAX = 0.25;

/**
 * Derive a learning rate from a block's own resolved-error history.
 *
 *   history      array of numbers: signed or absolute errors, most recent last.
 *                MUST NOT include the error currently being learned from.
 *   targetError  the error level this block should be operating at. Above it the
 *                model has work to do; at or below it there is little to gain.
 *
 * Returns { state, rate, basis } — `abstained` carries the floor rate, not zero:
 * a block with no history should still creep, just barely.
 */
function deriveRate(history, opts) {
  opts = opts || {};
  var min = num(opts.min, RATE_MIN);
  var max = num(opts.max, RATE_MAX);
  var target = num(opts.targetError, 0.05);
  var minN = num(opts.minN, MIN_N);

  var h = (history || []).filter(function (x) { return typeof x === 'number' && isFinite(x); });

  if (h.length < minN) {
    return {
      state: 'abstained',
      rate: min,
      n: h.length,
      basis: null,
      why: 'only ' + h.length + ' resolved outcome(s); ' + minN + ' needed before an error ' +
           'distribution means anything. Creeping at the floor rate rather than guessing a faster one.'
    };
  }

  var errs = h.map(Math.abs);
  var mean = errs.reduce(function (a, b) { return a + b; }, 0) / errs.length;
  var varc = errs.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / errs.length;

  /* NEED. Saturates at 1: an error ten times the target is not ten times more urgent
     than an error twice the target, because the rate is bounded either way. */
  var need = clamp(mean / target, 0, 1);

  /* MAGNITUDE CONSISTENCY. Scale-free: variance is compared against the mean it
     belongs to, so a channel measured in dollars and one measured in article counts
     are judged on the same footing. Errors that scatter as widely as they are large
     get ~0.5 and halve their own rate. */
  var magRel = mean > 1e-12 ? 1 / (1 + varc / (mean * mean)) : 1;

  /* DIRECTIONAL CONSISTENCY, on the SIGNED errors. This is the part that was missing.
     |mean| / mean|.| is 1 when every correction pulls the same way and 0 when they
     cancel. A model whose errors alternate sign is overshooting; speeding it up makes
     the oscillation worse, so it must read as unreliable however tidy its magnitudes. */
  var signedMean = h.reduce(function (a, b) { return a + b; }, 0) / h.length;
  var dirRel = mean > 1e-12 ? Math.abs(signedMean) / mean : 1;

  var rel = dirRel * magRel;
  var rate = min + (max - min) * need * rel;

  return {
    state: 'measured',
    rate: clamp(rate, min, max),
    n: h.length,
    basis: {
      meanAbsError: mean,
      meanSignedError: signedMean,
      errorVariance: varc,
      targetError: target,
      need: need,
      directionalConsistency: dirRel,
      magnitudeConsistency: magRel,
      reliability: rel
    },
    why: 'n=' + h.length + ', mean |error| ' + mean.toFixed(4) + ' against target ' + target +
         ' ⇒ need ' + need.toFixed(3) + '; magnitude consistency ' + magRel.toFixed(3) +
         ' x directional consistency ' + dirRel.toFixed(3) + ' ⇒ reliability ' + rel.toFixed(3) +
         '. Reliably wrong learns fast; wrong at random, or oscillating in sign, learns slowly.'
  };
}

/**
 * A rolling error log per key, with the ordering guarantee the safeguard needs.
 *
 * `rateFor` returns a rate derived from everything recorded BEFORE the call, and
 * `record` appends after. Callers that keep that order cannot leak an outcome into
 * the rate that grades it. Doing it in one object rather than leaving it to each
 * caller is deliberate: the ordering is the safeguard, and a safeguard that depends
 * on every caller remembering is not one.
 */
function createLedger(opts) {
  return {
    opts: opts || {},
    hist: Object.create(null),
    applied: Object.create(null),   // last rate handed out per key, for rollback
    version: 0
  };
}

function rateFor(ledger, key, opts) {
  var r = deriveRate(ledger.hist[key] || [], Object.assign({}, ledger.opts, opts || {}));
  ledger.applied[key] = { rate: r.rate, state: r.state, n: r.n, at: ledger.version };
  return r;
}

var HIST_CAP = 256;

function record(ledger, key, error) {
  if (typeof error !== 'number' || !isFinite(error)) return { recorded: false, why: 'non-finite error' };
  if (!ledger.hist[key]) ledger.hist[key] = [];
  ledger.hist[key].push(error);
  var evicted = ledger.hist[key].length > HIST_CAP ? ledger.hist[key].shift() : null;
  ledger.version++;
  return { recorded: true, n: ledger.hist[key].length, evicted: evicted };
}

/**
 * UNRECORD — undo the most recent record() for a key.
 *
 * Rollback that restores weights but not the ledger that produced them is not
 * reversible, it is half-reversible, which is worse: the weights say an update never
 * happened while the learning rate still reflects it, so the next update is graded by
 * an error the system claims to have undone. That was live until 2026-08-01 — a
 * rolled-back poison update left its error in the ledger and inflated every
 * subsequent rate.
 *
 * EXACTNESS IS NOW A FACT, NOT A PROXY. The first version inferred it from array
 * length (`h.length < HIST_CAP - 1`), which was wrong in BOTH directions: a ledger
 * sitting exactly at the cap with no eviction ever reported `exact: false`, and a
 * ledger that HAD evicted 50 entries reported `exact: true` once unrecords brought its
 * length back down. Callers now pass back the value record() evicted, which is
 * restored to the head, so the undo is genuinely exact — and when the caller has no
 * evicted value to give, that is the only case reported inexact.
 *
 * `applied` is cleared too. It caches the last rate handed out for a key; leaving it
 * pointing at the undone update meant the self-model reported a rate that no longer
 * governed anything.
 */
function unrecord(ledger, key, evicted, previousApplied) {
  var h = ledger.hist[key];
  if (!h || !h.length) return { removed: false, why: 'nothing recorded for ' + key };
  var v = h.pop();

  /**
   * EXACTNESS COMES FROM PROVENANCE, NOT FROM LENGTH. Two wrong versions preceded this:
   *
   *   v1  `h.length < HIST_CAP - 1`  — wrong in both directions: false at the cap with
   *       no eviction, true again after evictions had already lost data.
   *   v2  `restored || h.length < HIST_CAP` — evaluated AFTER pop(), so the array is
   *       necessarily below the cap and the flag was effectively ALWAYS true. It
   *       reported exact restoration even when no provenance existed at all.
   *
   * The caller is the only one who knows. record() returns `evicted`: a number when it
   * pushed something off the front, null when it did not. So there are three states and
   * they must not collapse into two:
   *
   *   a finite number  -> restored to the head; exact
   *   null             -> caller KNOWS nothing was evicted; exact
   *   undefined        -> no provenance (legacy record); UNKNOWN, and unknown is not exact
   */
  var restored = false, provenance;
  if (typeof evicted === 'number' && isFinite(evicted)) { h.unshift(evicted); restored = true; provenance = 'restored'; }
  else if (evicted === null) provenance = 'none_evicted';
  else provenance = 'unknown';

  /* RESTORE the cached rate, do not just drop it. Deleting left the ledger in a state
     it was never actually in, which is not an undo — it is a third state. When the
     caller supplies what was there before, put it back; only when it cannot is the key
     cleared, and then `appliedRestored` says so. */
  if (previousApplied === null) delete ledger.applied[key];
  else if (previousApplied !== undefined) ledger.applied[key] = previousApplied;
  else delete ledger.applied[key];

  ledger.version++;
  return {
    removed: true, value: v, n: h.length,
    restoredEvicted: restored,
    appliedRestored: previousApplied !== undefined,
    provenance: provenance,
    exact: provenance !== 'unknown' && previousApplied !== undefined,
    why: provenance === 'unknown'
      ? 'no eviction provenance was supplied, so whether the oldest error was lost is UNKNOWN — reported inexact rather than assumed clean'
      : null
  };
}

/** Serialise the whole ledger. Weights that survive restart with a blank error history
 *  are not restart-equivalent: the same model resumes at the abstention floor and has
 *  to re-earn a rate it already measured. */
function serializeLedger(ledger) {
  return { opts: ledger.opts, hist: ledger.hist, applied: ledger.applied, version: ledger.version };
}

function restoreLedger(o) {
  var led = createLedger((o && o.opts) || {});
  if (o) {
    led.hist = o.hist || Object.create(null);
    led.applied = o.applied || Object.create(null);
    led.version = o.version || 0;
  }
  return led;
}

/** What every key is currently doing, for the self-model. */
function report(ledger) {
  return Object.keys(ledger.hist).map(function (k) {
    var r = deriveRate(ledger.hist[k], ledger.opts);
    return {
      key: k, n: r.n, state: r.state, rate: r.rate,
      meanAbsError: r.basis ? r.basis.meanAbsError : null,
      reliability: r.basis ? r.basis.reliability : null
    };
  }).sort(function (a, b) { return b.rate - a.rate; });
}

function clamp(v, lo, hi) { return (typeof v !== 'number' || !isFinite(v)) ? lo : (v < lo ? lo : (v > hi ? hi : v)); }
function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

module.exports = {
  deriveRate: deriveRate,
  createLedger: createLedger,
  rateFor: rateFor,
  record: record,
  unrecord: unrecord,
  serializeLedger: serializeLedger,
  restoreLedger: restoreLedger,
  report: report,
  MIN_N: MIN_N, RATE_MIN: RATE_MIN, RATE_MAX: RATE_MAX, HIST_CAP: HIST_CAP
};
