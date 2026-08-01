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

/**
 * How much of a gap counts. Two channels expressed in their own standard deviations
 * are directly comparable, so this is in sd units.
 *
 * 2.0 [mark: prior] — the same threshold core/brain.js uses for dysregulation. Using
 * one number for "this channel departed" and "these channels disagree" keeps the two
 * claims on one scale, so a reader does not have to hold two different notions of
 * "big" at once. It is a prior, not a fitted value: nothing in the corpus yet
 * measures how often genuinely related channels drift apart.
 */
var DIVERGE_SIGMA = 2.0;

/** A gap this large is not disagreement, it is a broken relationship declaration. */
var IMPLAUSIBLE_SIGMA = 8.0;

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
  var sigma = (typeof opts.sigma === 'number') ? opts.sigma : DIVERGE_SIGMA;
  var byKey = {};
  (sensors || []).forEach(function (s) { byKey[s.key] = s; });

  var divergences = [], skipped = [], comparable = 0;

  (relationships || []).forEach(function (rel) {
    var a = byKey[rel.a], b = byKey[rel.b];

    if (!a || !b) {
      skipped.push({ pair: rel.a + '/' + rel.b, why: 'channel not in this brain: ' + (!a ? rel.a : rel.b) });
      return;
    }
    if (!a.fusable || !b.fusable) {
      var dead = !a.fusable ? a : b;
      skipped.push({
        pair: rel.a + '/' + rel.b,
        why: dead.key + ' is not fusable (' + dead.state + ') — a channel that has not spoken cannot disagree'
      });
      return;
    }
    if (!a.departure || !b.departure) {
      skipped.push({ pair: rel.a + '/' + rel.b, why: 'no baseline yet on one side; departure is null, which is not zero' });
      return;
    }

    comparable++;

    /* For an inverting pair, flip one side before comparing. Two channels that are
       SUPPOSED to move oppositely are in agreement when their departures are equal
       and opposite, and it is their AGREEMENT that would be the anomaly. */
    var za = a.departure.z;
    var zb = rel.expect === 'invert' ? -b.departure.z : b.departure.z;
    var gap = za - zb;
    var mag = Math.abs(gap);

    if (mag < sigma) return;

    divergences.push({
      channels: [rel.a, rel.b],
      latent: rel.latent,
      expect: rel.expect,
      differenceZ: gap,
      magnitude: mag,
      // Which side is reading high, in the pair's own terms.
      leading: gap > 0 ? rel.a : rel.b,
      // The gap is only as trustworthy as the least trustworthy side of it.
      jointPrecision: Math.min(a.precision, b.precision),
      implausible: mag >= IMPLAUSIBLE_SIGMA,
      basis: [
        rel.a + ' at ' + za.toFixed(2) + ' sd over n=' + a.departure.n,
        rel.b + ' at ' + b.departure.z.toFixed(2) + ' sd over n=' + b.departure.n +
          (rel.expect === 'invert' ? ' (sign flipped: this pair is declared inverting)' : '')
      ],
      why: rel.why,
      note: mag >= IMPLAUSIBLE_SIGMA
        ? 'a gap this wide is more likely a wrong relationship declaration than a real disagreement — check that ' +
          rel.a + ' and ' + rel.b + ' genuinely observe "' + rel.latent + '"'
        : 'both channels are live and disagree about "' + rel.latent + '" by ' + mag.toFixed(2) +
          ' sd; this is a signal in its own right, not an averaging error'
    });
  });

  divergences.sort(function (x, y) { return y.magnitude - x.magnitude; });

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
        ? comparable + ' pair(s) compared, all within ' + sigma + ' sd'
        : divergences.length + ' of ' + comparable + ' comparable pair(s) disagree past ' + sigma + ' sd'
  };
}

module.exports = {
  relate: relate,
  detect: detect,
  DIVERGE_SIGMA: DIVERGE_SIGMA,
  IMPLAUSIBLE_SIGMA: IMPLAUSIBLE_SIGMA
};
