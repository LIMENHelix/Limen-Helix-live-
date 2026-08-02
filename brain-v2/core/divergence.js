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
 *   Var(z) = 1                     a standardised quantity has unit variance, by
 *                                  construction, not by assumption.
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
  var est = (typeof n === 'number' && n > 0) ? (1 + (z * z) / 2) / n : 1;
  return 1 + est;
}

/**
 * How much of a gap counts, IN UNITS OF ITS OWN STANDARD ERROR.
 *
 * 2.0 [mark: prior] — two justifications that happen to agree. It is the threshold
 * core/brain.js uses for dysregulation, so "this channel departed" and "these channels
 * disagree" stay on one scale; and for a two-sided test it is the conventional 5%
 * level (1.96). Note this is STRICTER than the old raw 2.0: a raw gap now needs to be
 * roughly 2.9 sd before it clears the same number.
 */
var DIVERGE_Z = 2.0;

/**
 * Past this, the relationship DECLARATION is the likelier fault rather than the world.
 *
 * 5.0 [mark: prior], and the reasoning is the point: at 5 standard errors the null
 * "these two observe the same latent" is rejected at p < 1e-6. A one-in-a-million
 * disagreement between instruments is a less economical explanation than someone
 * having declared a relationship that does not hold.
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
  IMPLAUSIBLE: 'implausible_declaration' // too far apart for the declaration to hold
};

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

    comparable++;

    var g = gapStatistic(a, b, rel.expect);
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
        ? 'at ' + g.standardizedGap.toFixed(1) + ' standard errors the shared-latent claim is rejected at p < 1e-6 — ' +
          'a wrong relationship declaration is a more economical explanation than a real disagreement this large. ' +
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
  var d = za - zb;
  var se = Math.sqrt(varianceOfZ(za, a.departure.n) + varianceOfZ(zb, b.departure.n));
  return {
    differenceZ: d,
    magnitude: Math.abs(d),
    standardError: se,
    standardizedGap: se > 0 ? Math.abs(d) / se : 0
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
    open: Object.create(null),   // pairKey -> claim. At most one open claim per pair.
    closed: [],                  // resolved claims, oldest first
    version: 0
  };
}

function pairKey(rel) { return rel.a + '~' + rel.b + '~' + rel.latent; }

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

  (relationships || []).forEach(function (rel) {
    var k = pairKey(rel);
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
    var diverging = g.standardizedGap >= zThresh;

    // ── still standing, or newly opened ──────────────────────────────────────────
    if (diverging) {
      if (!claim) {
        claim = {
          id: 'dv_' + rel.a + '~' + rel.b + '@' + now,
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

      if (claim.evaluateAt !== null && now >= claim.evaluateAt) {
        var implausible = claim.peak.standardizedGap >= implausibleZ;
        resolved.push(close(ledger, k, claim,
          implausible ? OUTCOME.IMPLAUSIBLE : OUTCOME.PERSISTENT, now, g,
          implausible
            ? 'stood for its full horizon and peaked at ' + claim.peak.standardizedGap.toFixed(1) +
              ' se, past the p < 1e-6 point. A relationship declared between ' + rel.a + ' and ' +
              rel.b + ' over "' + rel.latent + '" that is violated this hard is more likely wrong ' +
              'than describing a real split.'
            : 'stood for its full horizon with both channels live, across ' + claim.observations +
              ' checks. The two sources are genuinely reporting different things about "' +
              rel.latent + '".'));
      } else {
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
       `persistent` is the one that matters: a standing gap between two live channels
       is equally consistent with the sources having genuinely come apart and with the
       relationship having been mis-declared in the first place. The data cannot
       separate them, so the record says so instead of picking the flattering one. */
    confounded: outcome === OUTCOME.PERSISTENT
      ? {
          hypotheses: ['regime_separation', 'wrong_relationship_declaration'],
          why: 'a standing gap between two live channels fits both. Separating them needs ' +
               'evidence this brain does not have: whether the pair agreed over a longer prior ' +
               'history, or an independent third channel on the same latent.'
        }
      : null
  };
  delete ledger.open[k];
  ledger.closed.push(claim);
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

  var byPair = {};
  ledger.closed.forEach(function (c) {
    var k = c.channels.join('~');
    if (!byPair[k]) byPair[k] = { pair: c.channels, latent: c.latent, total: 0, outcomes: {} };
    byPair[k].total++;
    byPair[k].outcomes[c.resolution.outcome] = (byPair[k].outcomes[c.resolution.outcome] || 0) + 1;
  });

  /* A declaration that only ever resolves implausible or persistent is a declaration
     worth re-examining, and this is the surface that says so. */
  var suspect = Object.keys(byPair).map(function (k) { return byPair[k]; })
    .filter(function (p) {
      var bad = (p.outcomes[OUTCOME.IMPLAUSIBLE] || 0) + (p.outcomes[OUTCOME.PERSISTENT] || 0);
      return p.total >= 3 && bad === p.total;
    });

  return {
    open: openClaims(ledger).length,
    resolved: ledger.closed.length,
    outcomes: counts,
    byPair: byPair,
    suspectDeclarations: suspect,
    why: ledger.closed.length === 0
      ? 'no divergence has resolved yet — outcome distribution is UNMEASURED, not empty'
      : ledger.closed.length + ' resolved: ' +
        Object.keys(counts).filter(function (o) { return counts[o]; })
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
  HORIZON_PERIODS: HORIZON_PERIODS
};
