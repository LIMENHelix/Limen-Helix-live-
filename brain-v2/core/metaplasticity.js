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


/* ═══════════════════════════════════════════════════════════════════════════════════
 * KALMAN NOISE, DERIVED FROM A CHANNEL'S OWN INNOVATIONS
 *
 * `q` and `r` are NOT learning rates and deriveRate() must not be pointed at them. A
 * rate is a step size in [0,1]; these are variances in the units of the signal squared.
 * Reusing the rate estimator because both are "a number that should be measured" is the
 * naming-over-mechanism substitution this project keeps having to unwind, so they get
 * their own estimator, which is the standard one.
 *
 * THE IDENTITY EVERYTHING RESTS ON. For a scalar filter the innovation v = z - x_prior
 * has theoretical variance
 *
 *     S = P_prior + r
 *
 * so if the filter is correctly tuned, the EMPIRICAL variance of the innovations must
 * match the average S it predicted. It usually does not, and the direction of the
 * mismatch says which parameter is wrong:
 *
 *   var(v) > mean(S)   the filter is over-confident. Either the world is noisier than r
 *                      says, or the state moves faster than q says.
 *   var(v) < mean(S)   over-cautious; it is discarding information it could have used.
 *
 * SEPARATING r FROM q NEEDS A SECOND OBSERVABLE, because that is one equation in two
 * unknowns. The second observable is WHITENESS. A correctly tuned filter produces
 * innovations with no serial correlation: each is the genuinely new part of the
 * observation. Positive lag-1 autocorrelation means the innovations carry a persistent
 * component the filter keeps failing to track, which is under-modelled STATE MOTION —
 * too small a q. Negative autocorrelation is over-correction. Observation noise is white
 * by assumption and moves the variance without touching the autocorrelation, which is
 * exactly what makes the two identifiable together.
 *
 * BOTH ABSTAIN. Below the sample floor they return the declared prior unchanged and say
 * so. A variance estimated from four numbers is not a measurement, and substituting one
 * for a declared prior would be a downgrade dressed as adaptation.
 *
 * Deterministic and pure: same history, same answer, no clock.
 * ═══════════════════════════════════════════════════════════════════════════════════ */

var NOISE_MIN_N = 12;        // innovations before a variance means anything
/* How far the mean attention gain may sit from 1 before the innovations stop being usable
   as a measurement of the world. Deliberately narrow: the bias grows quickly, and holding
   a prior costs nothing while writing a biased base compounds. */
var GAIN_TRUST_LO = 0.8, GAIN_TRUST_HI = 1.25;
var NOISE_DAMPING = 0.3;     // fraction of the way to the measurement, per derivation

/**
 * Observation noise from the innovation sequence.
 *
 *   innovations     signed v = z - x_prior, most recent last
 *   priorVariances  the P_prior that accompanied each one, same order and length
 *   opts.gains      the ATTENTION MULTIPLIER in force at each innovation, same order.
 *
 * WHAT THIS MEASURES: the WORLD's observation noise, and only when it is measurable.
 *
 * `var(v) - mean(P_prior)` estimates the true observation noise directly. It is NOT the
 * effective r the filter was configured with, and it must not be rescaled by the gain —
 * an early attempt to "divide the attention back out" was simply wrong, and measurably
 * so: at gain 4 it biased the estimate as far low as gain 0.25 biased it high.
 *
 * THE REAL PROBLEM IS SUBTLER AND IS NOT FIXABLE BY ARITHMETIC. The identity holds only
 * while the filter is close to correctly tuned. Attention deliberately runs the filter at
 * a noise level it does not believe, so `P_prior` stops being the true prior variance,
 * and what the subtraction returns is `r_true + (P_true - P_filter)` — a biased number
 * with no way to recover the bias from inside the window. Measured on a signal with a
 * known true r of 0.25: at gain 1.0 the estimate converges to 0.28, at gain 0.25 to 0.69,
 * at gain 4.0 to 0.089, and the three keep separating.
 *
 * SO IT ABSTAINS. Innovations collected through a filter that attention was actively
 * distorting cannot measure the world, and the honest answer is to say so and hold the
 * prior — the same measure-or-abstain discipline used for cadence, baselines and rates.
 * The two mechanisms simply cannot share a window: attention is a deliberate distortion
 * of the filter, and a distorted filter is not an instrument for calibrating itself.
 *
 * With no gains supplied the mean is 1 and this reduces to the plain estimate, which is
 * correct for a caller that has no attention mechanism.
 */
function deriveObservationNoise(innovations, priorVariances, opts) {
  opts = opts || {};
  var prior = num(opts.prior, 0.10);
  var min = num(opts.min, 1e-6);
  var max = num(opts.max, 1e6);
  var minN = num(opts.minN, NOISE_MIN_N);
  var damp = num(opts.damping, NOISE_DAMPING);

  var v = [], P = [], G = [];
  for (var i = 0; i < (innovations || []).length; i++) {
    var a = innovations[i], b = (priorVariances || [])[i];
    if (typeof a === 'number' && isFinite(a) && typeof b === 'number' && isFinite(b) && b >= 0) {
      v.push(a); P.push(b);
      var g = (opts.gains || [])[i];
      G.push((typeof g === 'number' && isFinite(g) && g > 0) ? g : 1);
    }
  }
  if (v.length < minN) {
    return { state: 'abstained', value: prior, n: v.length,
      why: 'only ' + v.length + ' usable innovation(s); ' + minN + ' needed before a variance is a measurement. Holding the declared prior ' + prior + '.' };
  }

  var mv = meanOf(v), sv = varianceOf(v, mv), mP = meanOf(P), mG = meanOf(G);

  /* THE ATTENTION GUARD. Outside this band the filter was deliberately mistuned while
     these innovations were produced, so the subtraction below returns a biased number
     rather than the world's noise. Holding the prior is the correct answer; writing the
     biased one into rBase would fold attention into the measurement and compound on the
     next derivation. */
  if (mG < GAIN_TRUST_LO || mG > GAIN_TRUST_HI) {
    return {
      state: 'abstained', value: prior, n: v.length,
      basis: { meanGain: mG, trustBand: [GAIN_TRUST_LO, GAIN_TRUST_HI] },
      why: 'mean attention gain ' + mG.toFixed(4) + ' over this window is outside the trusted band [' +
           GAIN_TRUST_LO + ', ' + GAIN_TRUST_HI + ']. The filter was running at a noise level it does not ' +
           'believe, so P_prior is not the true prior variance and var(v) - mean(P_prior) is biased by an ' +
           'amount this window cannot recover. Holding ' + prior + ' rather than folding attention into a ' +
           'measurement of the world.'
    };
  }

  /* EFFECTIVE r = var(v) - mean(P_prior). A NEGATIVE result is informative, not an error:
     it says the filter's own uncertainty already exceeds everything it observed, so the
     true observation noise is somewhere below the floor rather than unmeasurable.
     Clamping silently would present a floor value as a measurement. */
  var rawEffective = sv - mP;
  var underDispersed = rawEffective <= min;

  /* No rescaling. Past the guard above the filter was close enough to correctly tuned
     that this IS the world's noise, which is exactly the quantity rBase should hold. */
  var rawBase = rawEffective;
  var measured = clamp(rawBase, min, max);
  var value = clamp(prior + damp * (measured - prior), min, max);

  return {
    state: 'measured', value: value, n: v.length,
    basis: { innovationVariance: sv, innovationMean: mv, meanPriorVariance: mP,
             meanGain: mG, impliedEffectiveR: rawEffective, impliedBaseR: rawBase,
             dampedFrom: prior, damping: damp, underDispersed: underDispersed },
    why: 'var(innovation) ' + sv.toFixed(6) + ' - mean(P_prior) ' + mP.toFixed(6) + ' = ' +
         rawEffective.toFixed(6) + ' EFFECTIVE' +
         (underDispersed ? ' (at or below the floor: the filter is already more uncertain than anything it observed)' : '') +
         ' (mean attention gain ' + mG.toFixed(4) + ', inside the trusted band, so the filter was close ' +
         'enough to correctly tuned for this to measure the world)' +
         '; moved ' + (damp * 100).toFixed(0) + '% of the way from ' + prior + ' to ' + measured.toFixed(6) +
         ' = ' + value.toFixed(6) + '. Damped because a variance from ' + v.length + ' samples is itself noisy.'
  };
}

/**
 * Process noise q from the WHITENESS of the innovation sequence.
 *
 * Lag-1 autocorrelation is the signal, and it is the one thing observation noise cannot
 * fake: r shifts the variance of the innovations without introducing serial correlation.
 */
function deriveProcessNoise(innovations, priorVariances, opts) {
  opts = opts || {};
  var prior = num(opts.prior, 0.02);
  var min = num(opts.min, 1e-9);
  var max = num(opts.max, 1e3);
  var minN = num(opts.minN, NOISE_MIN_N);
  var damp = num(opts.damping, NOISE_DAMPING);

  var v = [];
  for (var i = 0; i < (innovations || []).length; i++) {
    var a = innovations[i];
    if (typeof a === 'number' && isFinite(a)) v.push(a);
  }
  if (v.length < minN + 1) {
    return { state: 'abstained', value: prior, n: v.length,
      why: 'only ' + v.length + ' innovation(s); ' + (minN + 1) + ' needed for a lag-1 autocorrelation. Holding the declared prior ' + prior + '.' };
  }

  var m = meanOf(v), s = varianceOf(v, m);
  if (!(s > 1e-15)) {
    return { state: 'abstained', value: prior, n: v.length,
      why: 'the innovations are constant, so autocorrelation is undefined — a channel that never surprises the filter cannot say whether q is wrong. Holding ' + prior + '.' };
  }
  var cov = 0;
  for (var j = 1; j < v.length; j++) cov += (v[j] - m) * (v[j - 1] - m);
  cov /= (v.length - 1);
  var rho = clamp(cov / s, -1, 1);

  /**
   * CONSISTENCY GATES THE ADJUSTMENT, and leaving it out was a real defect rather than
   * a refinement. The first version used the autocorrelation alone.
   *
   * Autocorrelation says WHICH WAY q is wrong. It does not say whether q is wrong at
   * all. A slowly drifting channel has positively correlated innovations no matter what
   * q is, because a first-order filter cannot track a trend — so "rho > 0, raise q"
   * fires on every derivation and, applied recursively, walks q to its ceiling. Measured
   * on the recorded corpus: seven near-constant channels all reached q = 0.811 from a
   * declared 0.02, which claims enormous process noise for series that barely move.
   *
   * The variance ratio is what says whether anything is wrong. If var(innovation)
   * already matches the S the filter predicted, the filter is consistent and there is
   * nothing to fix, however correlated the innovations are. So the adjustment is scaled
   * by the distance from consistency, and a consistent filter is left alone.
   */
  var consistency = null;
  if (priorVariances && priorVariances.length >= v.length) {
    /* S = P_prior + EFFECTIVE r, per sample. `rSeries` carries the effective r actually
       in force at each innovation; a single scalar would misjudge every window in which
       attention moved, which is exactly the windows worth judging. */
    var S = 0, nS = 0;
    for (var k = 0; k < v.length; k++) {
      var P = priorVariances[k];
      var rk = (opts.rSeries || [])[k];
      if (typeof rk !== 'number' || !isFinite(rk)) rk = num(opts.r, 0);
      if (typeof P === 'number' && isFinite(P) && P >= 0) { S += P + rk; nS++; }
    }
    if (nS) {
      var meanS = S / nS;
      consistency = meanS > 1e-15 ? s / meanS : null;      // 1.0 = perfectly consistent
    }
  }

  /**
   * THE VARIANCE RATIO SETS THE DIRECTION; THE AUTOCORRELATION SETS THE SHARE.
   *
   * Getting this the other way round was a real error, not a nuance. Using
   * `1 + 2*rho*|consistency-1|` made the magnitude depend on the mismatch but the SIGN
   * depend on rho alone — so a near-constant channel, whose innovations are far SMALLER
   * than the filter's stated uncertainty, read as maximally mismatched and had its q
   * raised because those tiny innovations happened to be correlated. Measured: seven
   * near-constant channels walked from a declared q of 0.02 to 0.806, claiming enormous
   * process noise for series that barely move. An over-cautious filter needs LESS
   * process noise; no amount of autocorrelation makes more of it the right answer.
   *
   *   excess < 0   the filter is already more uncertain than its errors justify. q comes
   *                down, whatever the autocorrelation says.
   *   excess > 0   the filter is over-confident, and something has to account for the
   *                gap. rho is the evidence for how much of it is state motion rather
   *                than observation noise: correlated residue is motion the filter keeps
   *                missing, white residue is noise and belongs to r.
   *   excess ~ 0   consistent. Nothing to fix, and q is left alone.
   */
  var excess = consistency === null ? 0 : clamp(consistency - 1, -1, 2);
  var share = Math.max(0, rho);
  var adj = excess >= 0 ? excess * share : excess;
  var factor = clamp(1 + adj, 1 / 3, 3);
  var measured = clamp(prior * factor, min, max);
  var value = clamp(prior + damp * (measured - prior), min, max);

  return {
    state: 'measured', value: value, n: v.length,
    basis: { lag1Autocorrelation: rho, innovationVariance: s, consistencyRatio: consistency,
             excess: excess, motionShare: share, factor: factor, dampedFrom: prior, damping: damp },
    why: (consistency !== null
            ? 'var(v)/mean(S) = ' + consistency.toFixed(3) +
              (Math.abs(excess) < 0.05 ? ' (consistent, so q is left alone regardless of autocorrelation). '
               : excess < 0 ? ' (over-cautious: q comes down whatever the autocorrelation says). '
               : ' (over-confident; ' + (share * 100).toFixed(0) + '% of the gap reads as state motion). ')
            : '') +
         'lag-1 autocorrelation ' + rho.toFixed(4) + ' over ' + v.length + ' innovations ' +
         (rho > 0.05 ? '(a persistent component the filter keeps missing: state motion is under-modelled)'
          : rho < -0.05 ? '(the filter is over-correcting)'
          : '(white, which is what a correctly tuned filter produces)') +
         ' => q x' + factor.toFixed(3) + ', damped to ' + value.toFixed(8) + ' from ' + prior + '.'
  };
}

/**
 * NORMALISED INNOVATION SQUARED — the standard filter-consistency check, and the metric
 * the control comparison is scored on.
 *
 * E[v^2 / S] = 1 for a correctly tuned filter, where S = P_prior + r. Above 1 the filter
 * is over-confident: it claims more certainty than its own errors justify. Below 1 it is
 * over-cautious. Scale-free, so channels in dollars and channels in article counts are
 * judged on one footing — and unlike raw error it cannot be improved by simply declaring
 * more uncertainty, which is what makes it usable as a scorecard number.
 */
function nis(innovations, priorVariances, r) {
  var acc = 0, n = 0;
  for (var i = 0; i < (innovations || []).length; i++) {
    var v = innovations[i], P = (priorVariances || [])[i];
    if (typeof v !== 'number' || !isFinite(v) || typeof P !== 'number' || !isFinite(P)) continue;
    var S = P + r;
    if (!(S > 0)) continue;
    acc += (v * v) / S; n++;
  }
  if (!n) return { state: 'abstained', value: null, n: 0, why: 'no usable innovations' };
  var m = acc / n;
  return {
    state: 'measured', value: m, n: n,
    /* Distance from 1 in either direction, on a log scale so a factor of 2 too confident
       and a factor of 2 too cautious score equally. A metric that punished only
       over-confidence would be trivially gamed by inflating uncertainty. */
    miscalibration: Math.abs(Math.log(m)),
    why: 'NIS ' + m.toFixed(4) + ' over ' + n + ' innovations (1.0 is correct; ' +
         (m > 1 ? 'above 1 = over-confident' : 'below 1 = over-cautious') + ')'
  };
}

function meanOf(a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; }
function varianceOf(a, m) { return a.reduce(function (x, y) { return x + (y - m) * (y - m); }, 0) / a.length; }

function clamp(v, lo, hi) { return (typeof v !== 'number' || !isFinite(v)) ? lo : (v < lo ? lo : (v > hi ? hi : v)); }
function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

module.exports = {
  deriveRate: deriveRate,
  deriveObservationNoise: deriveObservationNoise,
  deriveProcessNoise: deriveProcessNoise,
  nis: nis,
  createLedger: createLedger,
  rateFor: rateFor,
  record: record,
  unrecord: unrecord,
  serializeLedger: serializeLedger,
  restoreLedger: restoreLedger,
  report: report,
  MIN_N: MIN_N, RATE_MIN: RATE_MIN, RATE_MAX: RATE_MAX, HIST_CAP: HIST_CAP,
  NOISE_MIN_N: NOISE_MIN_N, NOISE_DAMPING: NOISE_DAMPING,
  GAIN_TRUST_LO: GAIN_TRUST_LO, GAIN_TRUST_HI: GAIN_TRUST_HI
};
