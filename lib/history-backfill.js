/**
 * lib/history-backfill.js — walk energy's HISTORY to get label data now, not weeks from now. Pure.
 *
 * Reconstructs dated forecasts from PAST data and resolves them against what actually happened forward,
 * so the estimator can be scored on real energy history immediately instead of waiting for live
 * forecasts to age. Reuses the real estimator (phase-estimator) and the real ledger (outcome-ledger),
 * so the backtest exercises the exact live path — no separate "backtest logic" that could drift.
 *
 * LEAKAGE IS THE ONLY THING THAT MATTERS HERE (the kernel already hit an overfit wall once):
 *   - INPUT channels are point-in-time: a forecast at date t uses ONLY series values with index <= t.
 *     marketStress() cannot see the future. Enforced, and tested.
 *   - The OUTCOME is forward: forwardAdverse() at t uses [t, t+horizon] — that is the label, allowed to
 *     look forward. It is INDEPENDENT of the input (realized price move, not the trailing read).
 *   - A date is scored ONLY if it has both enough trailing history AND a full forward window; the rest
 *     abstain. No partial-window fabrication.
 *
 * SCOPE — stated honestly, not buried:
 *   - MARKET-ONLY. This backfills the market channel (energy spot price: EIA/FRED, unrevised). It does
 *     NOT backfill the feed-fractal (news): we have no point-in-time news archive, and reconstructing
 *     past news from today's search is leakage. News-history is phase 2 (GDELT or similar). So this
 *     validates the market channel and the estimator/ledger plumbing, NOT the whole fractal.
 *   - It answers a modest, honest question: does trailing price weakness predict forward price weakness
 *     in energy, and does the estimator's distress call track it? A real backtest, narrow scope.
 *   - Spot prices only (unrevised). Do NOT feed a revised macro series as if it were known at date t.
 *   - Whoever fits weights on the output MUST hold out a test set (kernel overfit-wall lesson).
 */

var phaseEstimator = require('./phase-estimator');
var ledger = require('./outcome-ledger');
var feedFractal = require('./feed-fractal');

function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function r4(x) { return Math.round(x * 10000) / 10000; }

/**
 * marketStress(series, idx, opts) — point-in-time market distress read at index idx, from PAST ONLY.
 * = trailing drawdown from the recent peak, blended with trailing volatility. LEAKAGE-SAFE: touches
 * only series[max(0, idx-window) .. idx]. Returns [0,1] (1 = maximally stressed), or null if too little
 * trailing history.
 * series: [{ t, v }] sorted ascending by t.
 */
function marketStress(series, idx, opts) {
  opts = opts || {};
  var window = opts.window || 20;
  if (idx < 2) return null;
  var lo = Math.max(0, idx - window);
  var peak = -Infinity, cur = series[idx].v, i;
  for (i = lo; i <= idx; i++) if (series[i].v > peak) peak = series[i].v;             // trailing peak (<= idx)
  var drawdown = peak > 0 ? clamp01((peak - cur) / peak) : 0;                          // fall from recent peak
  // trailing volatility: mean abs daily log-ish change over the window, normalized
  var vsum = 0, n = 0;
  for (i = lo + 1; i <= idx; i++) { if (series[i - 1].v > 0) { vsum += Math.abs((series[i].v - series[i - 1].v) / series[i - 1].v); n++; } }
  var vol = n ? clamp01((vsum / n) / 0.05) : 0;                                        // ~5% avg daily move => vol 1
  return clamp01(0.7 * drawdown + 0.3 * vol);                                          // [mark: prior] blend
}

/**
 * forwardAdverse(series, idx, opts) — the OUTCOME (forward-looking, the label). Max forward drawdown
 * from series[idx].v over the horizon window [idx+1 .. idx+horizonSteps]. High = price fell forward =
 * adverse outcome happened. Returns null if the full forward window is not available (no look-ahead
 * beyond data).
 */
function forwardAdverse(series, idx, opts) {
  opts = opts || {};
  var h = opts.horizonSteps || 15;             // ~15 trading days ≈ 3 weeks
  var end = idx + h;
  if (end >= series.length) return null;       // full forward window not available -> abstain
  var base = series[idx].v, trough = Infinity;
  for (var i = idx + 1; i <= end; i++) if (series[i].v < trough) trough = series[i].v;
  return { t: series[idx].t, adverse: base > 0 ? clamp01((base - trough) / base / (opts.adverseScale || 0.15)) : 0 };
}

/**
 * backfill(series, opts) — walk the series in order (threading corrState + history exactly like live),
 * build a point-in-time market channel per date, run the real estimator, record a forecast, and resolve
 * all forecasts against the forward-adverse outcome stream. Returns the ledger result plus the
 * reconstructed phase trajectory (so you can SEE the pattern play out in energy's history).
 *
 * series: [{ t(ms or day-index), v(price) }]. opts.horizonSteps for the forward window.
 */
function backfill(series, opts) {
  opts = opts || {};
  series = (series || []).filter(function (p) { return p && typeof p.t === 'number' && typeof p.v === 'number'; })
    .slice().sort(function (a, b) { return a.t - b.t; });
  if (series.length < 30) return { ok: false, reason: 'series too short for a backfill (need >= 30 points)' };

  var corrState = null, history = { marketScore: [] };
  var pairs = [], trajectory = [];

  for (var idx = 0; idx < series.length; idx++) {
    var ms = marketStress(series, idx, opts);
    if (ms === null) continue;                                   // not enough trailing history yet
    var ch = feedFractal.marketChannel(ms);                      // point-in-time market channel (distress-band signature)
    // estimate, threading state forward exactly like the live worker
    var bundle = { substrate: 'domain', subjectId: 'energy-backfill', readings: [ch] };
    var est = phaseEstimator.estimate(bundle, { corrState: corrState, history: history });
    if (est.grounded) corrState = est.corrState;
    history.marketScore.push(ms);
    if (history.marketScore.length > 300) history.marketScore.splice(0, history.marketScore.length - 300);

    trajectory.push({ t: series[idx].t, marketStress: r4(ms), phaseMAP: est.phaseMAP, stuck: est.stuck, price: series[idx].v });

    // pair the forecast with its OWN forward outcome in lockstep (leakage-safe: outcome is [idx+1..idx+h])
    var out = forwardAdverse(series, idx, opts);
    if (out) pairs.push({ f: ledger.buildForecast(series[idx].t, est, [ch]), adverse: out.adverse, realizedAt: series[Math.min(idx + (opts.horizonSteps || 15), series.length - 1)].t });
  }

  var res = ledger.scorePairs(pairs, { callThreshold: opts.callThreshold, adverseThreshold: opts.adverseThreshold });

  return {
    ok: true,
    points: series.length,
    forecastsBuilt: pairs.length,
    result: res,                            // resolvedCount, estimatorHitRate, perChannelHitRate(Divergent), resolved[]
    trajectory: trajectory,                 // the reconstructed phase path — "track the pattern" in energy history
    scope: 'MARKET-ONLY backfill (energy spot price). Feed-fractal/news NOT backfilled (no point-in-time archive — leakage). Hold out a test set before fitting weights.'
  };
}

module.exports = {
  backfill: backfill,
  marketStress: marketStress,
  forwardAdverse: forwardAdverse
};
