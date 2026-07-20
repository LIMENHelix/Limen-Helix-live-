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

  var resolved = [], pending = 0, hits = 0;
  var chanAgg = {};        // key -> { hit, n }
  var chanAggDiv = {};     // key -> { hit, n }  (divergent cases only)

  (forecasts || []).forEach(function (f) {
    if (!f || typeof f.madeAt !== 'number') return;
    var target = f.madeAt + horizonMs;
    if (now !== null && now < target) { pending++; return; }
    // realized outcome nearest the horizon, strictly AFTER madeAt (forward-only), within tol
    var best = null, bestDt = Infinity;
    for (var i = 0; i < obs.length; i++) {
      if (obs[i].t <= f.madeAt) continue;
      var dt = Math.abs(obs[i].t - target);
      if (dt < bestDt && dt <= tolMs) { bestDt = dt; best = obs[i]; }
    }
    if (!best) { pending++; return; }

    var adverseEvent = best.adverse >= adverseThreshold;
    var estimatorCalled = (typeof f.beliefDistress === 'number' ? f.beliefDistress : 0) >= callThreshold;
    var hit = (estimatorCalled === adverseEvent) ? 1 : 0;
    hits += hit;

    // per-channel + divergence
    var keys = Object.keys(f.channels || {});
    var calls = keys.map(function (k) { return f.channels[k] >= callThreshold; });
    var divergent = calls.length > 1 && calls.some(Boolean) && !calls.every(Boolean);
    keys.forEach(function (k) {
      var ch = (chanAgg[k] || (chanAgg[k] = { hit: 0, n: 0 }));
      var chHit = ((f.channels[k] >= callThreshold) === adverseEvent) ? 1 : 0;
      ch.hit += chHit; ch.n += 1;
      if (divergent) { var cd = (chanAggDiv[k] || (chanAggDiv[k] = { hit: 0, n: 0 })); cd.hit += chHit; cd.n += 1; }
    });

    resolved.push({ madeAt: f.madeAt, realizedAt: best.t, adverse: r4(best.adverse), adverseEvent: adverseEvent,
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
    pendingCount: pending,
    estimatorHitRate: n ? r4(hits / n) : null,          // null until >=1 resolves — ABSTAIN, never "validated"
    perChannelHitRate: rates(chanAgg),                  // which channel predicts the forward outcome
    perChannelHitRateDivergent: rates(chanAggDiv),      // ...restricted to cases where channels DISAGREED (the training signal)
    horizonMs: horizonMs, callThreshold: callThreshold, adverseThreshold: adverseThreshold,
    resolved: resolved,
    note: n ? ('scored ' + n + ' forecast(s) vs independent forward outcome (forward-only, weeks horizon); per-channel-divergent rates are the re-weighting signal')
            : 'no forecasts aged past the horizon yet — outcome loop ABSTAINS (data-starved by construction; not validated)'
  };
}

module.exports = {
  buildForecast: buildForecast,
  resolve: resolve,
  distressMass: distressMass,
  DISTRESS_PHASES: DISTRESS_PHASES
};
