/**
 * brain-v2/core/divergence.js — SPEC row 10. Disagreement as a first-class signal.
 *
 * SPEC B5: "When two channels disagree about the same latent state, that disagreement
 * is a signal in its own right, logged with direction, magnitude and resolution
 * outcome. It is not averaged away."
 *
 * THE PROBLEM THIS FIXES, stated concretely.
 *
 * core/brain.js fuses every live channel's departure into one precision-weighted
 * scalar. That is the right way to estimate a latent state and the wrong way to
 * notice that your instruments disagree. Two credible sensors pointing in opposite
 * directions average to something unremarkable:
 *
 *     crude price   -1.8 sd   "calm"
 *     grid alerts   +2.4 sd   "acute"
 *     fused          +0.3 sd  "nothing to see"
 *
 * The fused number is not wrong. It is the correct mean of two readings. But the
 * interesting fact is the 4.2 sd gap between them, and fusion is where that fact
 * goes to die. A brain that only reports the mean cannot say "my instruments
 * disagree", which is a different and often more actionable claim than any value
 * either instrument reports.
 *
 * WHY A DECLARED RELATIONSHIP MAP RATHER THAN ALL-PAIRS.
 *
 * Comparing every channel to every other channel is noise. Crude price and NWS
 * weather alerts are not measuring the same thing, so their disagreement means
 * nothing and would fire constantly. A pair is only comparable when both channels
 * claim to observe the same or an explicitly related latent variable, and that claim
 * has to be DECLARED by whoever bound the domain, not inferred from a correlation
 * the system happened to find. An inferred relationship is a hypothesis; a declared
 * one is a commitment you can be wrong about in public.
 *
 * Unrelated channels are therefore never compared, and that is a feature.
 *
 * Pure and deterministic, like the rest of core/. No clock, no I/O.
 */

'use strict';

var CH = require('./channel.js');

/**
 * THE GAP IS A DIFFERENCE OF TWO ESTIMATES, AND HAS ITS OWN SPREAD.
 *
 * The first version of this file subtracted two per-channel z-scores and compared the
 * raw result against a flat 2 sd threshold. That is wrong in a way that inflates
 * detections. za and zb are each ALREADY standardised — each has unit variance by
 * construction — so even two channels tracking the same latent perfectly will differ
 * by roughly sqrt(2) = 1.41 sd from their own noise alone. Testing that difference
 * against 2.0 as though it were a single standardised quantity treats ordinary
 * two-channel noise as near-significant.
 *
 * The difference d = za - zb has
 *
 *     Var(d) = Var(za) + Var(zb) - 2*Cov(za, zb)
 *
 * and each term is available or honestly boundable:
 *
 *   Var(z) ~ 1                     APPROXIMATELY unit variance. An earlier version of
 *                                  this comment said "by construction, not by
 *                                  assumption", and that overstated it: departure z is
 *                                  a Kalman-FILTERED posterior divided by an ESTIMATED
 *                                  baseline sd, and neither step guarantees unit
 *                                  variance. The filter smooths, which shrinks it; the
 *                                  estimated denominator adds spread of its own. It is
 *                                  a serviceable approximation, not an identity, which
 *                                  is why the operating point below is measured rather
 *                                  than read off a normal table.
 *          + (1 + z^2/2) / n       the mean and sd were themselves estimated from n
 *                                  baseline samples, so z is an ESTIMATE. This is the
 *                                  delta-method standard error of a standardised
 *                                  value: a channel with a thin baseline produces a
 *                                  noisier z and needs a wider gap to be believed.
 *
 *   Cov    ASSUMED ZERO, and that assumption is conservative in the safe direction.
 *          Two channels genuinely observing one latent should be POSITIVELY
 *          correlated, and positive covariance SHRINKS Var(d). Ignoring it therefore
 *          overstates the spread and understates significance, so this under-detects
 *          rather than over-detects. Measuring the correlation is the right fix and
 *          needs paired history the corpus does not yet hold; until then the error
 *          points at silence rather than at false alarms.
 *
 * Posterior belief variance P is NOT folded in. It is expressed in the channel's raw
 * units while the baseline sd normalises them, and nothing currently guarantees the
 * two are commensurable — a synthetic channel with P=1 and sd=0.1 would contribute a
 * variance of 100 and swamp everything real. `jointPrecision` still travels with each
 * divergence so a caller can see belief confidence separately.
 */
function varianceOfZ(z, n) {
  if (!isFinite(z)) return null;
  /* n < 1 means NO baseline. The first version returned est = 1 there, which made a
     channel with zero baseline samples look MORE certain than one with a single sample
     (est 1 vs 5.125). No data must abstain, not present as confidence. */
  if (typeof n !== 'number' || !isFinite(n) || n < 1) return null;
  return 1 + (1 + (z * z) / 2) / n;
}

/**
 * How much of a gap counts, in units of the difference's own estimated spread.
 *
 * 2.0 [mark: prior] — the same threshold core/brain.js uses for dysregulation, so "this
 * channel departed" and "these channels disagree" stay on one scale. It is STRICTER
 * than the old raw 2.0: a raw gap now needs roughly 2.9 sd to clear it.
 *
 * IT IS NOT THE 5% LEVEL, AND SAYING SO WAS WRONG. An earlier version of this comment
 * justified 2.0 as "the conventional 5% level (1.96)". That is what 2.0 would mean for
 * a genuine standard normal, and this quantity is not one: departure z is a
 * Kalman-filtered posterior divided by an estimated baseline sd, so unit variance is an
 * approximation rather than a construction, and the zero-covariance assumption makes
 * the denominator deliberately too wide.
 *
 * MEASURED instead of assumed, in test/divergence-calibration.js, by simulating two
 * channels observing ONE latent through the real channel.js pipeline so every detection
 * is a false positive by construction:
 *
 *     equal noise      0.76%  (34 / 4480 comparable readings)
 *     6x uneven noise  1.34%  (60 / 4480)
 *
 * So the true operating point is roughly 1%, about a sixth of nominal — conservative in
 * the documented direction, but NOT calibrated. Quote the measured rate, never a
 * p-value. Power is measured too, because a test that never fires is deaf rather than
 * careful: on data that genuinely separates it detects 69% of readings.
 */
var DIVERGE_Z = 2.0;

/**
 * Past this the gap is EXTREME. It is not, on its own, proof of anything.
 *
 * 5.0 [mark: prior]. An earlier version claimed "p < 1e-6" here. That number was never
 * measured and is not supported: calibration at 2.0 came in at 0.76% against a nominal
 * 5%, so this statistic's tail does not follow the normal quantiles the p-value was
 * read off. What IS measured is that 5.0 never fired once in 4480 null readings — a
 * bound, not a probability, and 4480 samples cannot evidence a one-in-a-million rate
 * either way. An earlier version also named the outcome
 * `implausible_declaration`, which asserts the declaration is at fault. That claim is
 * not available from significance alone — a genuine structural break can violate a
 * perfectly correct relationship by any margin you like, and no test can tell the two
 * apart from the gap's size. Size shifts which reading is more economical; it does not
 * settle it. The outcome is now `extreme_persistent` and carries the same `confounded`
 * record as `persistent`.
 */
var IMPLAUSIBLE_Z = 5.0;

/**
 * How long a divergence claim waits before it is graded as persistent, in periods of
 * the SLOWER of its two channels.
 *
 * Deliberately not a new constant: this is channel.js's own LIVENESS_WINDOW, the
 * number of samples that file already uses to decide whether a channel moves. One
 * notion of "enough observations to judge" across both files is worth more than a
 * second number tuned separately. The slower channel sets the clock because it bounds
 * how fast new information can arrive to settle the question — you cannot tell a
 * transient gap from a standing one faster than the slow side can speak.
 */
var HORIZON_PERIODS = CH.LIVENESS_WINDOW;

/** Every way a divergence claim can close. */
var OUTCOME = {
  CONVERGED:   'converged',              // came back into agreement, both sides live
  SENSOR:      'sensor_failure',         // a side stopped reporting while open
  PERSISTENT:  'persistent',             // survived the horizon with both sides live
  EXTREME:     'extreme_persistent',     // as persistent, but past the 5.0 se mark
  WITHDRAWN:   'declaration_withdrawn'   // the relationship was removed while open
};

/**
 * A claim is graded persistent only after this many DISTINCT observations, in addition
 * to the horizon elapsing.
 *
 * The horizon alone was not enough, and the failure was concrete: if the process is
 * down for 12 hours and comes back with one reading, `now >= evaluateAt` is true and
 * the claim resolved `persistent` on the strength of TWO observations. That is time
 * passing being mistaken for evidence arriving. Both conditions must hold now — enough
 * wall-clock for the slow channel to have spoken, AND enough actual readings to show
 * it did.
 */
var MIN_OBSERVATIONS = 6;

/** Resolved claims retained. Beyond this the oldest are dropped, and the count of
 *  dropped ones is reported rather than silently forgotten — an unbounded array inside
 *  a snapshot grows the snapshot forever. */
var CLOSED_CAP = 512;

/**
 * Declare a relationship between two channels.
 *
 *   a, b       channel keys
 *   latent     the thing BOTH claim to observe, named. Required, and it is the whole
 *              justification for comparing them — if you cannot name what they share,
 *              they are not comparable.
 *   expect     'agree'  the two should move together (same latent, same sign)
 *              'invert' the two should move oppositely (same latent, opposed sign)
 *   why        a sentence a human can check
 */
function relate(a, b, latent, expect, why) {
  if (!a || !b) throw new Error('a relationship needs two channel keys');
  if (a === b) throw new Error('a channel cannot diverge from itself: ' + a);
  if (!latent) throw new Error('relationship ' + a + '/' + b + ' must name the latent variable both claim to observe');
  if (expect !== 'agree' && expect !== 'invert') throw new Error("expect must be 'agree' or 'invert', got: " + expect);
  return { a: a, b: b, latent: latent, expect: expect, why: why || null };
}

/**
 * DETECT.
 *
 * `sensors` is the array core/brain.js cycle() produces. Only fusable channels are
 * compared: an absent, dead or unproven channel has not made a claim, and a channel
 * that has not spoken cannot disagree. That distinction matters — silence read as
 * disagreement would turn every outage into a false alarm.
 *
 * Returns { pairs, divergences, comparable, skipped } — the skipped list carries its
 * reason, so "no divergence found" and "nothing could be compared" never look alike.
 */
function detect(sensors, relationships, opts) {
  opts = opts || {};
  var zThresh = (typeof opts.z === 'number') ? opts.z : DIVERGE_Z;
  var byKey = {};
  (sensors || []).forEach(function (s) { byKey[s.key] = s; });

  var divergences = [], skipped = [], comparable = 0;

  (relationships || []).forEach(function (rel) {
    var a = byKey[rel.a], b = byKey[rel.b];

    if (!a || !b) {
      skipped.push({ pair: rel.a + '/' + rel.b, reason: 'missing', why: 'channel not in this brain: ' + (!a ? rel.a : rel.b) });
      return;
    }
    if (!a.fusable || !b.fusable) {
      var dead = !a.fusable ? a : b;
      skipped.push({
        pair: rel.a + '/' + rel.b, reason: 'not_fusable',
        why: dead.key + ' is not fusable (' + dead.state + ') — a channel that has not spoken cannot disagree'
      });
      return;
    }
    if (!a.departure || !b.departure) {
      skipped.push({ pair: rel.a + '/' + rel.b, reason: 'no_baseline', why: 'no baseline yet on one side; departure is null, which is not zero' });
      return;
    }

    var g = gapStatistic(a, b, rel.expect);
    if (!g.computable) {
      skipped.push({ pair: rel.a + '/' + rel.b, reason: 'not_computable', why: g.why });
      return;
    }

    comparable++;
    if (g.standardizedGap < zThresh) return;

    divergences.push({
      channels: [rel.a, rel.b],
      latent: rel.latent,
      expect: rel.expect,
      differenceZ: g.differenceZ,
      magnitude: g.magnitude,              // raw sd gap, for a human to read
      standardizedGap: g.standardizedGap,  // the quantity actually tested
      standardError: g.standardError,
      // Which side is reading high, in the pair's own terms.
      leading: g.differenceZ > 0 ? rel.a : rel.b,
      // The gap is only as trustworthy as the least trustworthy side of it.
      jointPrecision: Math.min(a.precision, b.precision),
      implausible: g.standardizedGap >= IMPLAUSIBLE_Z,
      basis: [
        rel.a + ' at ' + a.departure.z.toFixed(2) + ' sd over n=' + a.departure.n,
        rel.b + ' at ' + b.departure.z.toFixed(2) + ' sd over n=' + b.departure.n +
          (rel.expect === 'invert' ? ' (sign flipped: this pair is declared inverting)' : ''),
        'raw gap ' + g.magnitude.toFixed(2) + ' sd against a standard error of ' +
          g.standardError.toFixed(2) + ' ⇒ ' + g.standardizedGap.toFixed(2) + ' se'
      ],
      why: rel.why,
      note: g.standardizedGap >= IMPLAUSIBLE_Z
        ? 'at ' + g.standardizedGap.toFixed(1) + ' se the gap is far past anything measured under a shared ' +
          'latent (5.0 se never fired in 4480 null readings). A wrong relationship declaration is the more ' +
          'economical reading, though a real structural break can also violate a correct one by any margin. ' +
          'Check that ' + rel.a + ' and ' + rel.b + ' genuinely observe "' + rel.latent + '"'
        : 'both channels are live and disagree about "' + rel.latent + '" by ' + g.magnitude.toFixed(2) +
          ' sd (' + g.standardizedGap.toFixed(2) + ' se); this is a signal in its own right, not an averaging error'
    });
  });

  divergences.sort(function (x, y) { return y.standardizedGap - x.standardizedGap; });

  return {
    pairs: (relationships || []).length,
    comparable: comparable,
    divergences: divergences,
    skipped: skipped,
    /* The honest headline. "None found" and "none could be checked" are different
       facts and the caller must be able to tell them apart. */
    detected: divergences.length > 0,
    why: comparable === 0
      ? 'no declared pair had two fusable channels this cycle — divergence is UNMEASURED, not absent'
      : divergences.length === 0
        ? comparable + ' pair(s) compared, all within ' + zThresh + ' se'
        : divergences.length + ' of ' + comparable + ' comparable pair(s) disagree past ' + zThresh + ' se'
  };
}

/**
 * The gap and its spread. Separated out because the lifecycle grader needs exactly the
 * same arithmetic on every subsequent cycle, and two copies of a statistic drift apart.
 */
function gapStatistic(a, b, expect) {
  /* For an inverting pair, flip one side before comparing. Two channels that are
     SUPPOSED to move oppositely are in agreement when their departures are equal and
     opposite, and it is their AGREEMENT that would be the anomaly. */
  var za = a.departure.z;
  var zb = expect === 'invert' ? -b.departure.z : b.departure.z;

  /* NON-FINITE INPUT MUST NOT READ AS CALM. Until 2026-08-02 a NaN departure produced
     magnitude NaN, se NaN and standardizedGap 0 — because `se > 0` is false for NaN —
     so a broken channel silently reported NO DIVERGENCE. An Infinity produced a NaN
     gap, and `NaN >= threshold` is also false, with the same result. Garbage in, false
     reassurance out, which is the single worst direction for this module to fail. */
  var va = varianceOfZ(za, a.departure.n);
  var vb = varianceOfZ(zb, b.departure.n);
  if (va === null || vb === null) {
    return {
      computable: false,
      differenceZ: null, magnitude: null, standardError: null, standardizedGap: null,
      why: 'not computable: ' +
        (!isFinite(za) ? a.key + ' departure is ' + za :
         !isFinite(zb) ? b.key + ' departure is ' + zb :
         'a baseline count is missing or below 1 (' + a.key + ' n=' + a.departure.n +
         ', ' + b.key + ' n=' + b.departure.n + ')') +
        '. This is UNMEASURABLE, not agreement.'
    };
  }

  var d = za - zb;
  var se = Math.sqrt(va + vb);
  return {
    computable: true,
    differenceZ: d,
    magnitude: Math.abs(d),
    standardError: se,
    standardizedGap: Math.abs(d) / se     // se >= sqrt(2) always, so never a divide by zero
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// RESOLUTION LIFECYCLE — the second half of SPEC B5, and the half detect() cannot do
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * SPEC B5 asks for disagreement "logged with direction, magnitude AND RESOLUTION
 * OUTCOME". detect() gives the first two and structurally cannot give the third: it
 * is a pure function of one cycle, so every cycle it recomputes the gap from nothing
 * and the previous cycle's claim ceases to exist. An instantaneous alert that is
 * reborn and forgotten 24 times a day is not a claim anyone can be wrong about.
 *
 * WHY THE OUTCOME IS THE POINT RATHER THAN A NICETY. A gap of 3 se means one of at
 * least four quite different things, and the alert alone cannot say which:
 *
 *   the world moved and settled          -> converged
 *   one of our instruments broke         -> sensor_failure   (says nothing about the world)
 *   the two really did come apart        -> persistent
 *   we declared a relationship that is   -> implausible_declaration
 *     not real
 *
 * Only the third is evidence about the domain. Treating all four alike — which is
 * what an unresolved alert does — means an outage and a regime change enter downstream
 * reasoning as the same fact. That is the failure mode this project already has on
 * record under other names, so the grader exists to keep them apart.
 *
 * A claim opens when a declared pair first clears the threshold, carries a stable id
 * for as long as it stands, and closes exactly once with a stated outcome.
 *
 * Deterministic: `now` is passed in, ids derive from (pair, latent, openedAt), and
 * nothing here reads a clock or a random source. A replay produces identical ledgers.
 */
function createLedger(opts) {
  return {
    opts: opts || {},
    open: Object.create(null),   // relKey -> claim. At most one open claim per relationship.
    closed: [],                  // resolved claims, oldest first
    droppedClosed: 0,            // trimmed past CLOSED_CAP, counted rather than forgotten
    version: 0
  };
}

/**
 * A relationship's identity is (a, b, latent, expect) — NOT just the channel pair.
 *
 * Two declarations can legitimately relate the same two channels through different
 * latents, and they are different claims that can resolve differently. The public id
 * omitted latent and expect until 2026-08-02, so two such relationships opening on the
 * same tick received byte-identical ids and `report()` merged their outcomes into one
 * row. An id that collides is not an id.
 */
function relKey(rel) { return rel.a + '~' + rel.b + '~' + rel.latent + '~' + rel.expect; }
function claimId(rel, now) { return 'dv_' + relKey(rel) + '@' + now; }

/**
 * The horizon this claim will be graded on, derived from the channels rather than set.
 *
 * Returns null when neither channel can state a cadence. A claim with no horizon is
 * NOT auto-expired into `persistent` — it stays open until it converges or a sensor
 * fails, because "we waited long enough" is meaningless without knowing how fast the
 * slower instrument can speak. Inventing a horizon there would manufacture a
 * regime-separation finding out of ignorance about our own sampling.
 */
function deriveHorizon(a, b, periods) {
  var ca = sensorCadence(a), cb = sensorCadence(b);
  if (!ca && !cb) return null;
  var slower = Math.max(ca || 0, cb || 0);
  return slower > 0 ? slower * periods : null;
}

function sensorCadence(s) {
  if (!s) return null;
  if (s.cadence && typeof s.cadence.cadenceMs === 'number' && s.cadence.cadenceMs > 0) return s.cadence.cadenceMs;
  if (typeof s.cadenceMs === 'number' && s.cadenceMs > 0) return s.cadenceMs;
  return null;
}

/**
 * ONE CYCLE OF THE LIFECYCLE. Call once per brain cycle, after the sensors are built.
 *
 * Opens claims that have just cleared the threshold, updates the ones still standing,
 * and closes the ones that have earned an outcome. Returns what changed this cycle so
 * a caller can log transitions rather than poll state.
 */
function observe(ledger, sensors, relationships, now, opts) {
  opts = opts || {};
  var zThresh = (typeof opts.z === 'number') ? opts.z : DIVERGE_Z;
  var implausibleZ = (typeof opts.implausibleZ === 'number') ? opts.implausibleZ : IMPLAUSIBLE_Z;
  var periods = (typeof opts.horizonPeriods === 'number') ? opts.horizonPeriods : HORIZON_PERIODS;

  var byKey = {};
  (sensors || []).forEach(function (s) { byKey[s.key] = s; });

  var opened = [], updated = [], resolved = [];
  var minObs = (typeof opts.minObservations === 'number') ? opts.minObservations : MIN_OBSERVATIONS;

  /* WITHDRAWN DECLARATIONS. Only current relationships are iterated below, so a claim
     whose declaration was removed from the manifest would sit open forever — invisible
     to the grader and still counted in `open`. Sweep them first and close them honestly:
     the claim did not resolve, its question was retracted. */
  var declared = Object.create(null);
  (relationships || []).forEach(function (rel) { declared[relKey(rel)] = true; });
  Object.keys(ledger.open).forEach(function (k) {
    if (declared[k]) return;
    var stranded = ledger.open[k];
    resolved.push(close(ledger, k, stranded, OUTCOME.WITHDRAWN, now, null,
      'the relationship declaration was removed from the manifest while this divergence was ' +
      'open, so the question it was asking no longer exists. This is NOT a finding about ' +
      stranded.latent + ' — it is a change to our own model, recorded so the claim does not ' +
      'sit open forever unexamined.'));
  });

  (relationships || []).forEach(function (rel) {
    var k = relKey(rel);
    var claim = ledger.open[k] || null;
    var a = byKey[rel.a], b = byKey[rel.b];
    var comparable = a && b && a.fusable && b.fusable && a.departure && b.departure;

    // ── a side went quiet ────────────────────────────────────────────────────────
    if (!comparable) {
      if (claim) {
        var which = !a ? rel.a : (!b ? rel.b : (!a.fusable || !a.departure ? rel.a : rel.b));
        resolved.push(close(ledger, k, claim, OUTCOME.SENSOR, now, null,
          which + ' stopped reporting while this divergence was open. The gap is a fact about ' +
          'our instruments, NOT about "' + rel.latent + '" — it must not be counted as evidence ' +
          'that the two sources came apart.'));
      }
      return;
    }

    var g = gapStatistic(a, b, rel.expect);
    if (!g.computable) {
      /* Unmeasurable is not agreement and not disagreement. An open claim cannot be
         graded on a reading that does not exist, so it simply waits. */
      if (claim) { claim.lastUncomputableAt = now; claim.uncomputable = (claim.uncomputable || 0) + 1; }
      return;
    }
    var diverging = g.standardizedGap >= zThresh;

    // ── still standing, or newly opened ──────────────────────────────────────────
    if (diverging) {
      if (!claim) {
        claim = {
          id: claimId(rel, now),
          channels: [rel.a, rel.b],
          latent: rel.latent,
          expect: rel.expect,
          why: rel.why,
          status: 'open',
          openedAt: now,
          horizonMs: deriveHorizon(a, b, periods),
          opening: g,
          peak: { standardizedGap: g.standardizedGap, magnitude: g.magnitude, at: now },
          latest: g,
          leading: g.differenceZ > 0 ? rel.a : rel.b,
          observations: 1,
          lastSeenAt: now,
          resolution: null
        };
        claim.evaluateAt = claim.horizonMs === null ? null : now + claim.horizonMs;
        claim.horizonWhy = claim.horizonMs === null
          ? 'neither channel states a cadence, so there is no defensible horizon. This claim will ' +
            'close on convergence or sensor failure but will never be graded persistent — we cannot ' +
            'say we waited long enough without knowing how fast the slower side can speak.'
          : periods + ' periods of the slower channel (' +
            (Math.max(sensorCadence(a) || 0, sensorCadence(b) || 0) / 3600000).toFixed(1) + 'h)';
        ledger.open[k] = claim;
        ledger.version++;
        opened.push(claim);
        return;
      }

      claim.observations++;
      claim.lastSeenAt = now;
      claim.latest = g;
      claim.leading = g.differenceZ > 0 ? rel.a : rel.b;
      if (g.standardizedGap > claim.peak.standardizedGap) {
        claim.peak = { standardizedGap: g.standardizedGap, magnitude: g.magnitude, at: now };
      }
      ledger.version++;

      /* TWO CONDITIONS, NOT ONE. Elapsed horizon says enough time passed for the slow
         channel to have spoken; the observation count says it actually did. Grading on
         the clock alone let a 12-hour outage plus one reading resolve `persistent` from
         two observations. */
      var timeUp = claim.evaluateAt !== null && now >= claim.evaluateAt;
      var enoughEvidence = claim.observations >= minObs;

      if (timeUp && enoughEvidence) {
        /* JUDGED ON THE STANDING GAP, NOT A SINGLE SPIKE. The first version classified
           on `peak`, so one extreme reading that then decayed to a moderate standing gap
           still branded the declaration implausible for good. What matters at resolution
           is what the gap IS, not the worst it ever was; the peak is still reported. */
        var extreme = g.standardizedGap >= implausibleZ;
        resolved.push(close(ledger, k, claim,
          extreme ? OUTCOME.EXTREME : OUTCOME.PERSISTENT, now, g,
          'stood for its full horizon with both channels live, across ' + claim.observations +
          ' observations, ending at ' + g.standardizedGap.toFixed(2) + ' se (peak ' +
          claim.peak.standardizedGap.toFixed(2) + ')' +
          (extreme ? ' — past 5.0 se, which never fired under a simulated shared latent.' : '.')));
      } else {
        claim.pending = timeUp
          ? 'horizon elapsed but only ' + claim.observations + ' of ' + minObs +
            ' observations — waiting for evidence, not for the clock'
          : null;
        updated.push(claim);
      }
      return;
    }

    // ── back into agreement ──────────────────────────────────────────────────────
    if (claim) {
      resolved.push(close(ledger, k, claim, OUTCOME.CONVERGED, now, g,
        'returned to within ' + zThresh + ' se with both channels live, after ' +
        claim.observations + ' check(s) and a peak of ' + claim.peak.standardizedGap.toFixed(2) +
        ' se. The disagreement was transient — the declared relationship survives it.'));
    }
  });

  return {
    opened: opened, updated: updated, resolved: resolved,
    open: openClaims(ledger),
    openCount: openClaims(ledger).length,
    why: describe(opened, updated, resolved, ledger)
  };
}

function close(ledger, k, claim, outcome, now, finalGap, why) {
  claim.status = 'resolved';
  claim.resolution = {
    outcome: outcome,
    at: now,
    durationMs: now - claim.openedAt,
    observations: claim.observations,
    openingGap: claim.opening.standardizedGap,
    peakGap: claim.peak.standardizedGap,
    finalGap: finalGap ? finalGap.standardizedGap : null,
    why: why,
    /* WHAT THIS OUTCOME CANNOT SETTLE, stated rather than left for a reader to assume.
       A standing gap between two live channels is equally consistent with the sources
       having genuinely come apart and with the relationship having been mis-declared.
       The data cannot separate them, so the record says so instead of picking one.

       EXTREME IS CONFOUNDED TOO. An earlier version called the extreme case
       `implausible_declaration`, which asserts the declaration is the fault. Statistical
       significance cannot distinguish a wrong declaration from a genuine structural
       break — a real regime change can violate a perfectly correct relationship by any
       margin you like. Size shifts which hypothesis is more economical; it does not
       settle it, and the outcome name no longer pretends otherwise. */
    confounded: (outcome === OUTCOME.PERSISTENT || outcome === OUTCOME.EXTREME)
      ? {
          hypotheses: ['regime_separation', 'wrong_relationship_declaration'],
          why: 'a standing gap between two live channels fits both. Separating them needs ' +
               'evidence this brain does not have: whether the pair agreed over a longer prior ' +
               'history, or an independent third channel on the same latent.' +
               (outcome === OUTCOME.EXTREME
                 ? ' The size makes a wrong declaration the more economical reading, but a real ' +
                   'structural break can violate a correct relationship by any margin — significance ' +
                   'does not decide between them.'
                 : '')
        }
      : null
  };
  delete ledger.open[k];
  ledger.closed.push(claim);
  /* Bounded. An unbounded array lives inside every snapshot, so "keep everything" means
     the snapshot grows without limit for as long as the process runs. What was dropped
     is counted, because a silently shortened history reads as a quiet one. */
  while (ledger.closed.length > CLOSED_CAP) { ledger.closed.shift(); ledger.droppedClosed++; }
  ledger.version++;
  return claim;
}

function openClaims(ledger) {
  return Object.keys(ledger.open).map(function (k) { return ledger.open[k]; })
    .sort(function (x, y) { return y.latest.standardizedGap - x.latest.standardizedGap; });
}

function describe(opened, updated, resolved, ledger) {
  var parts = [];
  if (opened.length) parts.push(opened.length + ' opened');
  if (updated.length) parts.push(updated.length + ' still standing');
  if (resolved.length) {
    var by = {};
    resolved.forEach(function (c) { by[c.resolution.outcome] = (by[c.resolution.outcome] || 0) + 1; });
    parts.push(Object.keys(by).map(function (o) { return by[o] + ' ' + o; }).join(', '));
  }
  if (!parts.length) return 'no declared pair diverging; ' + ledger.closed.length + ' resolved to date';
  return parts.join('; ');
}

/**
 * THE OUTCOME HISTORY. This is the part that makes divergence auditable rather than
 * merely noisy: over time it says how often the declared relationships hold, and which
 * declarations keep failing.
 */
function report(ledger) {
  var counts = {};
  Object.keys(OUTCOME).forEach(function (k) { counts[OUTCOME[k]] = 0; });
  ledger.closed.forEach(function (c) { counts[c.resolution.outcome]++; });

  /* KEYED BY THE RELATIONSHIP, NOT THE CHANNEL PAIR. Grouping on channels alone merged
     two declarations that relate the same pair through different latents, so their
     outcomes were pooled and neither could be judged on its own record. */
  var byRelationship = {};
  ledger.closed.forEach(function (c) {
    var k = c.channels[0] + '~' + c.channels[1] + '~' + c.latent + '~' + c.expect;
    if (!byRelationship[k]) {
      byRelationship[k] = { pair: c.channels, latent: c.latent, expect: c.expect, total: 0, outcomes: {} };
    }
    byRelationship[k].total++;
    byRelationship[k].outcomes[c.resolution.outcome] = (byRelationship[k].outcomes[c.resolution.outcome] || 0) + 1;
  });

  /* A declaration that only ever resolves into a standing gap is worth re-examining,
     and this is the surface that says so. Sensor failures and withdrawals are excluded
     from the denominator: neither is evidence about the declaration. */
  var suspect = Object.keys(byRelationship).map(function (k) { return byRelationship[k]; })
    .filter(function (p) {
      var informative = (p.outcomes[OUTCOME.CONVERGED] || 0) + (p.outcomes[OUTCOME.PERSISTENT] || 0) +
                        (p.outcomes[OUTCOME.EXTREME] || 0);
      var bad = (p.outcomes[OUTCOME.EXTREME] || 0) + (p.outcomes[OUTCOME.PERSISTENT] || 0);
      return informative >= 3 && bad === informative;
    });

  return {
    open: openClaims(ledger).length,
    resolved: ledger.closed.length,
    droppedClosed: ledger.droppedClosed || 0,
    outcomes: counts,
    byRelationship: byRelationship,
    suspectDeclarations: suspect,
    why: ledger.closed.length === 0
      ? 'no divergence has resolved yet — outcome distribution is UNMEASURED, not empty'
      : ledger.closed.length + ' resolved' +
        (ledger.droppedClosed ? ' (+' + ledger.droppedClosed + ' older ones trimmed past the ' + CLOSED_CAP + ' cap)' : '') +
        ': ' + Object.keys(counts).filter(function (o) { return counts[o]; })
          .map(function (o) { return counts[o] + ' ' + o; }).join(', ')
  };
}

/** Restore across restart — an open claim that forgets it was open cannot resolve. */
function serializeLedger(ledger) {
  return { opts: ledger.opts, open: ledger.open, closed: ledger.closed, version: ledger.version };
}
function restoreLedger(o) {
  var l = createLedger((o && o.opts) || {});
  if (o) {
    l.open = o.open || Object.create(null);
    l.closed = o.closed || [];
    l.version = o.version || 0;
  }
  return l;
}

module.exports = {
  relate: relate,
  detect: detect,
  gapStatistic: gapStatistic,
  varianceOfZ: varianceOfZ,
  createLedger: createLedger,
  observe: observe,
  report: report,
  serializeLedger: serializeLedger,
  restoreLedger: restoreLedger,
  OUTCOME: OUTCOME,
  DIVERGE_Z: DIVERGE_Z,
  IMPLAUSIBLE_Z: IMPLAUSIBLE_Z,
  MIN_OBSERVATIONS: MIN_OBSERVATIONS,
  CLOSED_CAP: CLOSED_CAP,
  HORIZON_PERIODS: HORIZON_PERIODS
};
