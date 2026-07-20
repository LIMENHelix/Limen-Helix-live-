/**
 * lib/energy-outcome-tracker.js — the LIVE outcome loop (energy). Pure: no Redis/Date/network — the
 * caller supplies `now`, the live price reading, the estimator result, and prior state; persistence is
 * the worker's job (same contract as corrState throughout this stack).
 *
 * This is what starts the clock the historical backfill couldn't: lib/history-backfill.js proved the
 * mechanism on 40 YEARS OF PAST WTI data (memory: energy-backfill-first-result). This module runs the
 * SAME mechanism forward, incrementally, in production — recording today's forecast and, as days pass,
 * discovering whether it was right. Until this runs, the estimator never learns from anything it hasn't
 * already been told; this is the difference between "we validated a method on history" and "we are now
 * being validated by the future."
 *
 * REUSES, DOES NOT REIMPLEMENT: historyBackfill.forwardAdverse() (the exact outcome definition scored
 * on real WTI) and ledger.scorePairs() (the exact scoring core, incl. skill metrics + per-channel
 * divergence attribution). No parallel logic to drift from what was validated.
 *
 * DESIGN, stated honestly:
 *  - RECORDS AT MOST ONCE PER DAY (not once per 15-min worker tick) — matches the daily granularity the
 *    backfill was validated at, and keeps the ledger from filling with near-duplicate 15-minute samples.
 *  - Price and forecast are recorded IN LOCKSTEP, same index, same instant — so resolution can pair them
 *    positionally (exactly how the backfill itself pairs), no time-window matching needed.
 *  - RESOLUTION recomputes on every call (cheap, pure, over a small capped array) so the returned skill
 *    stats are always current given whatever has matured so far. Nothing is resolved until real time has
 *    actually passed the horizon — this is DATA-STARVED BY CONSTRUCTION. The first live forecast cannot
 *    resolve for ~3 weeks (HORIZON_STEPS trading-day-equivalents). Never claim "validated" before then.
 *  - A weekend/holiday recorded at the "once per day" cadence may repeat the last known WTI print (the
 *    feed doesn't move on non-trading days). This is a stated simplification, not a silent inaccuracy.
 */

var historyBackfill = require('./history-backfill');
var ledger = require('./outcome-ledger');

var RECORD_INTERVAL_MS = 24 * 3600 * 1000;   // once/day — matches the validated backfill's granularity [mark: prior]
var CAP = 400;                                // ~13 months at daily cadence — comfortably covers the 3-week horizon many times over
var HORIZON_STEPS = 15;                       // ~3 weeks; identical to the value scored on real 40y WTI history [mark: prior]

/**
 * tick(state, now, priceReading, est, channels, opts)
 *
 * state:        { prices:[{t,v}], forecasts:[...], lastRecordTs } | null (cold start)
 * now:          ms epoch (caller-supplied — this module never reads the clock itself)
 * priceReading: { v: number } | null — today's live price (from energy-market-feed); null => no record this tick
 * est:          the phase-estimator result for this tick ({ belief, stuck })
 * channels:     the bundle.readings array fused into est (so buildForecast can compute per-channel signals)
 * opts:         { horizonSteps, callThreshold, adverseThreshold }
 *
 * Returns { state, recorded, result }. `result` is ledger.scorePairs()'s output (resolvedCount,
 * estimatorHitRate, skill{precision,recall,f1,...}, perChannelHitRate(Divergent), ...) — ABSTAINS
 * (estimatorHitRate: null) until at least one recorded forecast has aged past the horizon.
 */
function tick(state, now, priceReading, est, channels, opts) {
  opts = opts || {};
  var horizonSteps = opts.horizonSteps || HORIZON_STEPS;
  state = state && Array.isArray(state.prices) && Array.isArray(state.forecasts)
    ? state : { prices: [], forecasts: [], lastRecordTs: null };

  // lastRecordTs uses null (never recorded), not 0, as the "no prior record" sentinel — 0 is a legitimate
  // epoch value and `now - 0 >= interval` would wrongly gate the very first record if `now` were ever
  // small (e.g. in tests using small offsets; real Date.now() values happen to always clear this, which
  // is exactly why the bug was latent rather than obviously broken).
  var neverRecorded = state.lastRecordTs == null;
  var recorded = false;
  if (priceReading && typeof priceReading.v === 'number' && isFinite(priceReading.v) &&
      est && (neverRecorded || (now - state.lastRecordTs) >= RECORD_INTERVAL_MS)) {
    state.prices.push({ t: now, v: priceReading.v });
    state.forecasts.push(ledger.buildForecast(now, est, channels || []));
    if (state.prices.length > CAP) state.prices.splice(0, state.prices.length - CAP);
    if (state.forecasts.length > CAP) state.forecasts.splice(0, state.forecasts.length - CAP);
    state.lastRecordTs = now;
    recorded = true;
  }

  // Pair every forecast that now has a full forward window with its OWN forward outcome, in lockstep
  // (same index in both arrays, by construction above) — exactly how history-backfill.js pairs.
  var pairs = [];
  for (var i = 0; i < state.forecasts.length; i++) {
    var out = historyBackfill.forwardAdverse(state.prices, i, { horizonSteps: horizonSteps });
    if (!out) continue;   // forward window not yet elapsed for this forecast — correctly still pending
    var realizedIdx = Math.min(i + horizonSteps, state.prices.length - 1);
    pairs.push({ f: state.forecasts[i], adverse: out.adverse, realizedAt: state.prices[realizedIdx].t });
  }

  var result = ledger.scorePairs(pairs, { callThreshold: opts.callThreshold, adverseThreshold: opts.adverseThreshold });
  result.pendingCount = state.forecasts.length - pairs.length;   // recorded but not yet aged past the horizon
  result.trackedForecasts = state.forecasts.length;

  return { state: state, recorded: recorded, result: result };
}

module.exports = {
  tick: tick,
  RECORD_INTERVAL_MS: RECORD_INTERVAL_MS,
  CAP: CAP,
  HORIZON_STEPS: HORIZON_STEPS
};
