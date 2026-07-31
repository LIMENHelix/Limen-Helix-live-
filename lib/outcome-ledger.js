/**
 * lib/outcome-ledger.js — the OUTCOME LOOP core (energy first). Pure: no Redis/Date/network.
 *
 * This is the artifact that unblocks the weights, the reference ranges, AND propagation — because all
 * three are gated on the same missing input: FORWARD OUTCOME DATA. It records what the estimator
 * flagged and, weeks later, scores it against what INDEPENDENTLY happened, and — the load-bearing part —
 * records WHICH CHANNEL was right when the channels disagreed. Those divergence resolutions are the
 * training signal (Creator 14: the differential is confirmed by the disease course, not by consensus).
 *
 * WHY a new module and not lib/feed-resolver.js: that resolver grades the feed-stress DIRECTION against
 * RECORDED FEED-STRESS at a 6h horizon — a signal against a near-copy of itself, for the fast plasticity
 * loop. Validating a distress CALL needs an INDEPENDENT forward outcome (realized market/company
 * deterioration) at a WEEKS horizon. Different instrument, same honesty rules borrowed:
 *   - FORWARD-ONLY: a forecast resolves only against an outcome observed AFTER it was made (no leakage).
 *   - ABSTAIN until aged past the horizon and matched — data-starved by construction; hit rates are
 *     null until enough resolve. Never claim "validated" (that word is Thing1's).
 *   - The OUTCOME DEFINITION and thresholds are STATED PRIORS [mark: prior]; the independent outcome
 *     for energy is the forward adverse MARKET move (crude/energy price), which is external to the news
 *     feeds and to the estimator.
 *
 * The per-channel hit rates this returns are exactly what will SET the precision weights (a channel that
 * predicts the outcome earns weight) and, over time, the reference ranges (the decision limit is the
 * channel level that best separates adverse from benign forward outcomes — Creator 15, decision-limit
 * method). This module GENERATES that data; it does not yet consume it.
 */

function r4(x) { return Math.round(x * 10000) / 10000; }
function clamp01(x) { return Math.max(0, Math.min(1, x)); }

// Phases that carry distress on the canonical arc (stuck/rupture bands): P3 Darkness, P5 Endurance,
// P7 Separation, P8 Conscience, P9 Threshold. [mark: prior] — the band choice is convention.
var DISTRESS_PHASES = [3, 5, 7, 8, 9];

// Distress mass of a likelihood/belief vector = how much of it sits in the distress band.
function distressMass(vec) {
  if (!Array.isArray(vec)) return 0;
  var s = 0;
  for (var i = 0; i < DISTRESS_PHASES.length; i++) s += (vec[DISTRESS_PHASES[i]] || 0);
  return s;
}

// Confidence-weighted distress promotion — the number the cockpit DISPLAYS.
//
// distressMass(belief) alone is unsafe as a headline: it sums belief probability over 5 of the 11
// arc phases (P3/P5/P7/P8/P9), so a DIFFUSE belief (the estimator is uncertain what phase a domain
// is in) smears across those five and saturates near 1.0 — even when the domain's direct company
// stress composite (CISS) is calm and its MAP phase is early. Live 2026-07-24 that inverted the
// board: agriculture/finance (confidence ~0.13, CISS ~0.25) displayed 0.98, ABOVE energy (0.80),
// the only domain with a real acute channel. Uncertainty was being rendered as maximum distress.
//
// Fix: trust the belief's distress mass only to the extent the belief is actually concentrated
// (confidence). Blend the remainder toward the CISS floor.
//   promoted = confidence * distressMass(belief) + (1 - confidence) * cissFloor
// When a genuine, concentrated signal raises confidence, the belief's mass dominates again. There
// is NO ceiling on real, well-grounded distress (energy climbs the moment its belief concentrates).
// cissFloor null/absent => raw mass is used unblended (no behavior change for a domain whose CISS
// could not ground).
//
// ── THE FLOOR IS NO LONGER INDEPENDENT OF THE BELIEF (corrected 2026-07-30) ───────────────────
// This comment used to call cissFloor "the direct company reading" and describe it as the honest
// conservative fallback when the belief is diffuse. Since main 830491d4 that is FALSE, and the
// claim is corrected here rather than left standing.
//
// grounded-stress CHANNEL_WEIGHTS became { distress 0.45, unison 0.30, marketScore 0.25 }, to
// unfreeze a composite that had been built entirely from quarterly company fundamentals and could
// not cross the forecaster's own 0.02 dead-band. But marketScore is ALSO pushed into
// bundle.readings by the worker (handlers/limen-worker-snapshot.js:309 for energy, :328 for every
// other domain), and it carries a real value-dependent likelihood loading P3/P5/P9
// (lib/feed-fractal.js:140), so it moves the belief as well. The same instrument now sits in BOTH
// terms of this blend.
//
// Consequence, stated now rather than discovered later: this function can no longer damp a
// market-driven excursion. Both terms rise together on a market shock, at every value of
// confidence. At the confidence levels actually observed on the diffuse domains (agriculture and
// finance near 0.13), about (1 - 0.13) * 0.25 = 0.22 of the displayed number tracks market data
// through the floor alone, before counting marketScore's share of the belief term.
//
// The 2026-07-24 inversion this function was written to fix was DIFFUSENESS rendered as distress.
// The failure mode it can no longer catch is CORRELATION rendered as confirmation. A frozen floor
// was worse than a correlated one, so this is a documented property, not a defect to revert. If an
// independent floor is wanted back, the fix is upstream: drop marketScore from CHANNEL_WEIGHTS and
// give the composite a fast channel that is not already an estimator reading. Do not change the
// arithmetic here.
function promotedStress(belief, confidence, cissFloor) {
  var mass = distressMass(belief);
  var floor = (typeof cissFloor === 'number' && isFinite(cissFloor)) ? clamp01(cissFloor) : mass;
  var c = (typeof confidence === 'number' && isFinite(confidence)) ? clamp01(confidence) : 0;
  return clamp01(c * mass + (1 - c) * floor);
}

/**
 * Build a forecast record from an estimator result + its input channels, for later resolution.
 * est: { belief, stuck } from phase-estimator. channels: [{ key, value, likelihood }] (the bundle readings).
 * Each channel's distress SIGNAL = value × distressMass(its phase-signature): high value on a
 * distress-loaded channel = a strong distress vote from that channel.
 */
function buildForecast(madeAt, est, channels) {
  var chan = {};
  (channels || []).forEach(function (c) {
    if (!c || !c.key) return;
    chan[c.key] = r4(clamp01((typeof c.value === 'number' ? c.value : 0) * distressMass(c.likelihood)));
  });
  return {
    madeAt: madeAt,
    stuck: r4(typeof est.stuck === 'number' ? est.stuck : 0),
    beliefDistress: r4(distressMass(est.belief)),   // estimator's fused distress mass
    channels: chan
  };
}

/**
 * resolve(forecasts, outcomes, opts) — score matured forecasts against the independent forward outcome.
 *
 * forecasts: [{ madeAt, stuck, beliefDistress, channels:{key:signal} }]  (from buildForecast)
 * outcomes:  [{ t, adverse }]  — realized forward adverse-outcome stream in [0,1] (1 = worst); the
 *            INDEPENDENT signal (e.g. forward adverse energy-market move). Any order.
 * opts: { horizonMs, tolMs, callThreshold, adverseThreshold, now }
 *
 * For each forecast aged past madeAt+horizon with a forward outcome near the horizon:
 *   adverseEvent      = realized adverse >= adverseThreshold        (did a bad thing actually happen)
 *   estimatorCalled   = beliefDistress   >= callThreshold           (did the estimator flag distress)
 *   hit               = estimatorCalled === adverseEvent
 *   per channel c:    channelCalled = signal_c >= callThreshold; channelHit = channelCalled === adverseEvent
 *   divergent         = channels disagreed with each other (some called, some didn't) — the high-info case
 *
 * Returns overall + per-channel hit rates, and per-channel hit rates RESTRICTED TO DIVERGENT cases —
 * the latter is the real signal for re-weighting (where channels agreed, you learn nothing).
 */
function resolve(forecasts, outcomes, opts) {
  opts = opts || {};
  var horizonMs = opts.horizonMs || 21 * 24 * 3600 * 1000;   // 3 weeks: distress-call forward window [mark: prior]
  var tolMs = (opts.tolMs != null) ? opts.tolMs : 3 * 24 * 3600 * 1000;   // outcome within +-3d of the horizon
  var callThreshold = (opts.callThreshold != null) ? opts.callThreshold : 0.4;      // [mark: prior]
  var adverseThreshold = (opts.adverseThreshold != null) ? opts.adverseThreshold : 0.5;  // [mark: prior]
  var now = (typeof opts.now === 'number') ? opts.now : null;

  var obs = (outcomes || []).filter(function (o) { return o && typeof o.t === 'number' && typeof o.adverse === 'number'; })
    .slice().sort(function (a, b) { return a.t - b.t; });

  // Time-match each forecast to its forward outcome (forward-only, no leakage), then score the pairs.
  var pairs = [], pending = 0;
  (forecasts || []).forEach(function (f) {
    if (!f || typeof f.madeAt !== 'number') return;
    var target = f.madeAt + horizonMs;
    if (now !== null && now < target) { pending++; return; }
    var best = null, bestDt = Infinity;
    for (var i = 0; i < obs.length; i++) {
      if (obs[i].t <= f.madeAt) continue;                        // forward-only: outcome strictly after the forecast
      var dt = Math.abs(obs[i].t - target);
      if (dt < bestDt && dt <= tolMs) { bestDt = dt; best = obs[i]; }
    }
    if (!best) { pending++; return; }
    pairs.push({ f: f, adverse: best.adverse, realizedAt: best.t });
  });

  var scored = scorePairs(pairs, { callThreshold: callThreshold, adverseThreshold: adverseThreshold });
  scored.pendingCount = pending;
  scored.horizonMs = horizonMs;
  return scored;
}

/**
 * scorePairs(pairs, opts) — score ALREADY-MATCHED (forecast, adverse) pairs. Used directly by the
 * history backfill (which pairs in lockstep), and by resolve() after its time-matching. This is the
 * pure scoring core: estimator hit, per-channel hit, and the per-channel divergent signal.
 * pairs: [{ f: forecast, adverse: number, realizedAt? }]
 */
function scorePairs(pairs, opts) {
  opts = opts || {};
  var callThreshold = (opts.callThreshold != null) ? opts.callThreshold : 0.4;
  var adverseThreshold = (opts.adverseThreshold != null) ? opts.adverseThreshold : 0.5;
  var resolved = [], hits = 0, chanAgg = {}, chanAggDiv = {};

  (pairs || []).forEach(function (p) {
    if (!p || !p.f || typeof p.adverse !== 'number') return;
    var f = p.f;
    var adverseEvent = p.adverse >= adverseThreshold;
    var estimatorCalled = (typeof f.beliefDistress === 'number' ? f.beliefDistress : 0) >= callThreshold;
    var hit = (estimatorCalled === adverseEvent) ? 1 : 0;
    hits += hit;

    var keys = Object.keys(f.channels || {});
    var calls = keys.map(function (k) { return f.channels[k] >= callThreshold; });
    var divergent = calls.length > 1 && calls.some(Boolean) && !calls.every(Boolean);
    keys.forEach(function (k) {
      var ch = (chanAgg[k] || (chanAgg[k] = { hit: 0, n: 0 }));
      var chHit = ((f.channels[k] >= callThreshold) === adverseEvent) ? 1 : 0;
      ch.hit += chHit; ch.n += 1;
      if (divergent) { var cd = (chanAggDiv[k] || (chanAggDiv[k] = { hit: 0, n: 0 })); cd.hit += chHit; cd.n += 1; }
    });

    resolved.push({ madeAt: f.madeAt, realizedAt: p.realizedAt, adverse: r4(p.adverse), adverseEvent: adverseEvent,
      beliefDistress: f.beliefDistress, estimatorCalled: estimatorCalled, hit: hit, divergent: divergent });
  });

  function rates(agg) {
    var out = {};
    Object.keys(agg).forEach(function (k) { out[k] = { hitRate: agg[k].n ? r4(agg[k].hit / agg[k].n) : null, n: agg[k].n }; });
    return out;
  }
  var n = resolved.length;
  return {
    resolvedCount: n,
    pendingCount: 0,
    estimatorHitRate: n ? r4(hits / n) : null,          // null until >=1 resolves — ABSTAIN, never "validated"
    skill: skillMetrics(resolved),                      // confusion matrix + precision/recall/F1 — accuracy alone hides a majority-class predictor
    perChannelHitRate: rates(chanAgg),                  // which channel predicts the forward outcome
    perChannelHitRateDivergent: rates(chanAggDiv),      // ...restricted to cases where channels DISAGREED (the training signal)
    callThreshold: callThreshold, adverseThreshold: adverseThreshold,
    resolved: resolved,
    note: n ? ('scored ' + n + ' forecast(s) vs independent forward outcome; per-channel-divergent rates are the re-weighting signal')
            : 'no forecasts resolved yet — outcome loop ABSTAINS (data-starved by construction; not validated)'
  };
}

/**
 * skillMetrics(resolved) — confusion matrix + precision/recall/F1 over already-scored records
 * ({ estimatorCalled, adverseEvent }). ACCURACY (hitRate) ALONE IS MISLEADING when the adverse base
 * rate is skewed: a detector that NEVER calls distress scores hitRate = 1 - baseRate and looks "good"
 * while catching nothing (recall 0). This is the check that catches that — a majority-class predictor
 * (e.g. "always call calm") shows recall = 0 or precision = null even at high accuracy. Null (not 0)
 * when a rate's denominator is 0, so an untested regime is visibly UNTESTED, not silently scored 0.
 */
function skillMetrics(resolved) {
  var tp = 0, fp = 0, fn = 0, tn = 0;
  (resolved || []).forEach(function (r) {
    if (r.estimatorCalled && r.adverseEvent) tp++;
    else if (r.estimatorCalled && !r.adverseEvent) fp++;
    else if (!r.estimatorCalled && r.adverseEvent) fn++;
    else tn++;
  });
  var n = tp + fp + fn + tn;
  var precision = (tp + fp) > 0 ? r4(tp / (tp + fp)) : null;   // of calls made, how many were right — null if NO calls made
  var recall = (tp + fn) > 0 ? r4(tp / (tp + fn)) : null;      // of real adverse events, how many were caught — null if NO adverse events occurred
  var f1 = (precision != null && recall != null && (precision + recall) > 0) ? r4(2 * precision * recall / (precision + recall)) : null;
  var baseRate = n ? r4((tp + fn) / n) : null;                  // share of resolved cases that were actually adverse
  var callRate = n ? r4((tp + fp) / n) : null;                  // share of cases the estimator called distress
  return {
    tp: tp, fp: fp, fn: fn, tn: tn, n: n,
    precision: precision, recall: recall, f1: f1,
    baseRate: baseRate, callRate: callRate,
    note: (recall === 0 || precision === null)
      ? 'WARNING: recall 0 or no positive calls made — this may be a majority-class predictor riding a skewed base rate, not a real detector; do not trust accuracy alone'
      : 'precision/recall/F1 computed from the confusion matrix; compare against baseRate to judge whether accuracy reflects real skill'
  };
}

module.exports = {
  buildForecast: buildForecast,
  resolve: resolve,
  scorePairs: scorePairs,
  skillMetrics: skillMetrics,
  distressMass: distressMass,
  promotedStress: promotedStress,
  DISTRESS_PHASES: DISTRESS_PHASES
};
