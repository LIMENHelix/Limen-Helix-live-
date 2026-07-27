/**
 * lib/feed-resolver.js — the RESOLVER's core math (hippocampus component 2).
 *
 * Grades the brain's stored forecasts against the RECORDER's realized values
 * (feedhist), forward-only, no leakage. This is what turns the plasticity
 * modulator from self-consistency (the brain grading its own stress calls) into
 * a GENUINE external outcome: the realized value comes from the recorded feed
 * stream — a deterministic readout of the external world — and it is INDEPENDENT
 * of the K-layer weights being trained, so it can teach them without circularity.
 *
 * HONESTY:
 *   - Forward-only: a forecast is resolved ONLY against a recorded row whose
 *     timestamp is AFTER the forecast was made (t > madeAt) and near the horizon.
 *     No future information leaks into a past forecast.
 *   - It grades the DIRECTION call (rising/falling/stable) against the realized
 *     delta, because direction is the falsifiable claim.
 *   - It is external calibration (recorded feed truth), NOT a validated distress
 *     event. Real reward, modest scope; never claim "validated" (that is Thing1's).
 *   - Data-starved by construction: returns externalHitRate=null until enough
 *     forecasts have aged past the horizon and been resolved. Callers must gate on
 *     resolvedCount before treating it as reward.
 *
 * Pure: no Redis, no network, no Date. The handler supplies rows + a `now`.
 */

function r4(x) { return Math.round(x * 10000) / 10000; }
function clamp01(x) { return Math.max(0, Math.min(1, x)); }

/**
 * THE DEAD-BAND, in the units the data is actually recorded in.
 *
 * Domain stress is rounded to two decimals (handlers/domain-snapshot.js, `round`),
 * so one quantization step is 0.01 and any change smaller than that is not a
 * movement, it is rounding. The dead-band is TWO steps: a change must clear the
 * measurement resolution twice over before it counts as a direction.
 *
 * ONE number now governs BOTH sides. It used to be two numbers in different units:
 * deriveForecast committed to a direction at slope > 0.005 PER STEP, while resolve
 * credited it only at |delta| > 0.05 OVER SIX STEPS. A slope of 0.005/step implies
 * 0.03 across the horizon, so the forecaster committed at 0.03 and was graded at
 * 0.05, and every call landing in that gap was an automatic miss however right it
 * was. Worse, 0.005 is HALF a quantization step, so directions were being fired by
 * rounding noise in data that cannot resolve them.
 *
 * Measured over the full recorder history (4,920 forecast/realized pairs, 20
 * domains): the old pair of thresholds produced 380 directional calls of which 17
 * were credited, and 4,540 "stable" calls. That is what made the reward signal read
 * as competence when it was mostly abstention.
 */
var DEAD_BAND = 0.02;

// forecasts: [{ madeAt(ms), direction:'rising'|'falling'|'stable', currentStress }]
// recorder:  [{ t(ms), s }]  (the recorder rows; any order)
// opts: { horizonMs, tolMs, eps, now }
function resolve(forecasts, recorder, opts) {
  opts = opts || {};
  var horizonMs = opts.horizonMs || 6 * 3600 * 1000;   // grade the direction call 6h out
  var tolMs = (opts.tolMs != null) ? opts.tolMs : 2 * 3600 * 1000;  // realized row must be within +-2h of the target
  var eps = (opts.eps != null) ? opts.eps : DEAD_BAND; // see DEAD_BAND above
  var now = (typeof opts.now === 'number') ? opts.now : null;

  var rows = (recorder || []).filter(function (x) { return x && typeof x.t === 'number' && typeof x.s === 'number'; })
    .slice().sort(function (a, b) { return a.t - b.t; });

  var resolved = [], hits = 0, pending = 0;
  // The baseline: what a forecaster that NEVER calls a direction would score on
  // exactly these rows. Counted alongside, not afterwards, so it can never drift
  // out of sync with the sample it is the baseline for.
  var alwaysStable = 0, dirN = 0, dirHits = 0, signOK = 0;
  (forecasts || []).forEach(function (f) {
    if (!f || typeof f.madeAt !== 'number' || typeof f.currentStress !== 'number' || !f.direction) return;
    var target = f.madeAt + horizonMs;
    // If we know 'now' and the horizon hasn't elapsed, it's genuinely pending (not a miss).
    if (now !== null && now < target) { pending++; return; }
    // realized = the recorded row closest to the target time, strictly AFTER madeAt (no leakage), within tol.
    var best = null, bestDt = Infinity;
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (row.t <= f.madeAt) continue;                 // forward-only
      var dt = Math.abs(row.t - target);
      if (dt < bestDt && dt <= tolMs) { bestDt = dt; best = row; }
    }
    if (!best) { pending++; return; }                  // no recorded point near the horizon yet
    // Grade the ROUNDED delta, which is also the one reported below.
    //
    // Two reasons, and both bit. First, IEEE754: 0.52 - 0.5 is 0.020000000000000018,
    // so a move of exactly two quantization steps failed a two-step dead-band. With
    // 2dp source data that boundary is not an edge case, it is one of the commonest
    // values. Second, consistency: the row already reported r4(delta), so grading the
    // unrounded number could print a delta that contradicts its own hit flag.
    var delta = r4(best.s - f.currentStress);
    var hit = (f.direction === 'rising' && delta > eps) ||
              (f.direction === 'falling' && delta < -eps) ||
              (f.direction === 'stable' && Math.abs(delta) <= eps) ? 1 : 0;
    hits += hit;
    if (Math.abs(delta) <= eps) alwaysStable++;         // the baseline, on this same row
    if (f.direction !== 'stable') {
      dirN++; dirHits += hit;
      // Sign accuracy separates "called the direction right but the move was too
      // small to credit" from "called it backwards". Those need different fixes,
      // and a single hit rate cannot tell them apart.
      if ((f.direction === 'rising' && delta > 0) || (f.direction === 'falling' && delta < 0)) signOK++;
    }
    resolved.push({ madeAt: f.madeAt, direction: f.direction, currentStress: r4(f.currentStress),
      realizedStress: r4(best.s), delta: delta, hit: hit, realizedAt: best.t });
  });

  var n = resolved.length;
  var hitRate = n ? r4(hits / n) : null;
  var baseRate = n ? r4(alwaysStable / n) : null;
  var skill = (n && hitRate !== null && baseRate !== null) ? r4(hitRate - baseRate) : null;

  return {
    resolvedCount: n,
    pendingCount: pending,
    externalHitRate: hitRate,                          // null until at least one forecast resolves
    /**
     * THE BASELINE IS NOT OPTIONAL, AND CALLERS MUST GATE ON `skill`, NOT `externalHitRate`.
     *
     * A hit rate on its own is uninterpretable. Eight of the twenty domains record a
     * stress scalar with ZERO variance across the whole 262-hour history, so "stable"
     * is correct on every single row and the hit rate reads exactly 1.0. Four more
     * (defense, intelligence, law, research) move by exactly one 0.01 step in that
     * entire span, which is indistinguishable from constant once the dead-band is
     * applied: eleven of the twenty produce no directional call at all. That is a
     * constant being mistaken for competence, and it is how six domains came to
     * report perfect forecast accuracy.
     *
     * `alwaysStableRate` is what a forecaster that never calls a direction scores on
     * the SAME resolved rows. `skill` is the difference. Only skill can distinguish a
     * forecast from an abstention, so only skill is a teaching signal.
     *
     * Honest reading as of the 2026-07-27 sweep over the whole recorder history:
     * skill is NEGATIVE at every dead-band value tested (0.005 through 0.08), and
     * directional sign accuracy sits near 0.21 rather than 0.5. The forecaster is not
     * noisy, it is anti-correlated: it extrapolates a least-squares trend on a series
     * that mean-reverts. Widening or narrowing this dead-band cannot fix that, and
     * this field exists so nobody has to rediscover it from a hit rate again.
     */
    alwaysStableRate: baseRate,
    skill: skill,
    directional: { n: dirN, hits: dirHits,
      hitRate: dirN ? r4(dirHits / dirN) : null,
      signAccuracy: dirN ? r4(signOK / dirN) : null },
    horizonMs: horizonMs, eps: eps,
    resolved: resolved,
    note: !n
      ? 'no forecasts have aged past the horizon yet — external outcome ABSTAINS (caller falls back to self-consistency)'
      : ('external forecast-vs-realized calibration over ' + n + ' resolved forecast(s) vs recorded feed truth (forward-only). ' +
         'Hit rate ' + hitRate + ' against an always-stable baseline of ' + baseRate + ', so skill is ' +
         (skill > 0 ? '+' : '') + skill + '. ' +
         (skill === null ? '' : skill > 0
           ? 'Positive: the direction calls are carrying information.'
           : 'Not positive: this domain is not beaten by calling a direction, so the hit rate above is abstention, not competence.'))
  };
}

// Derive a forecast SERVER-SIDE from the recorder's own history (the tab-independent source).
// Least-squares slope over the last `window` recorded stress points → a direction call, mirroring
// the brain's client forecast but computed from recorded truth so it needs no open browser tab.
// rows: [{ t, s }] (recorder rows, any order). Returns null if too little history.
function deriveForecast(rows, opts) {
  opts = opts || {};
  var window = opts.window || 12;             // last 12 recorded points (~12h at hourly cadence)
  var horizonSteps = opts.horizonSteps || 6;  // project 6 steps (~6h, matches the resolve horizon)
  // The SAME dead-band resolve grades with, in the SAME units: a change across the
  // whole horizon, not a slope per step. Passing one number to both is the point.
  var eps = (opts.eps != null) ? opts.eps : DEAD_BAND;
  var series = (rows || []).filter(function (x) { return x && typeof x.t === 'number' && typeof x.s === 'number'; })
    .slice().sort(function (a, b) { return a.t - b.t; });
  if (series.length < 3) return null;         // not enough history to call a direction
  var w = series.slice(-window), n = w.length, sx = 0, sy = 0, sxy = 0, sxx = 0;

  /**
   * REFUSE TO FORECAST A SERIES THAT DOES NOT MOVE.
   *
   * If the whole window spans less than the dead-band, then no direction is
   * expressible: whatever this series does next, the grader will score it "stable",
   * so a direction call cannot be right and "stable" cannot be wrong. Returning null
   * here means no forecast is stored, nothing is graded, and the resolver abstains
   * with externalHitRate null. That is the honest state, and it is what SHOULD have
   * been happening all along.
   *
   * This is the single change that fixes the "six domains report perfect accuracy"
   * result. Those domains were not forecasting well, they were calling "stable" on a
   * flat line, forever, and being credited every time.
   *
   * Measured over 262h of real recorder history across all 20 domains: 12 domains
   * refuse 100% of their windows (communication, culture, defense, education,
   * governance, health, intelligence, law, population, religion, research,
   * technology) because their stress scalar never moves by even one quantization
   * step. 8 refuse only sometimes, which is the point of testing the WINDOW rather
   * than the domain: agriculture 10%, finance 1%, energy 36%. A domain that goes
   * quiet for a day should abstain for that day and resume when it moves again.
   * Overall 66.4% of windows are refused, which is simply how much of this system
   * currently has nothing to say.
   */
  // Inclusive, matching the dead-band everywhere else in this file: a move of exactly
  // eps is graded "did not move" (|delta| <= eps is a stable hit), so a window that
  // spans exactly eps has not moved either and there is nothing to call.
  var lo = w[0].s, hi = w[0].s;
  for (var q = 1; q < n; q++) { if (w[q].s < lo) lo = w[q].s; if (w[q].s > hi) hi = w[q].s; }
  if (r4(hi - lo) <= eps) return null;
  for (var i = 0; i < n; i++) { var x = i, y = w[i].s; sx += x; sy += y; sxy += x * y; sxx += x * x; }
  var d = n * sxx - sx * sx;
  var slope = d !== 0 ? (n * sxy - sx * sy) / d : 0;
  var cur = w[n - 1].s;
  var projected = clamp01(cur + slope * horizonSteps);

  /**
   * The direction is read off the CLAMPED projection, not the raw slope.
   *
   * This matters at the boundaries, and the boundaries are not rare: 10.8% of all
   * recorded rows sit at exactly 1.0. A least-squares slope fitted to a series that
   * has just climbed to the ceiling is positive, so the old rule emitted "rising"
   * from a value with nowhere to rise to. The projection was already being clamped
   * one line above; the direction simply ignored it and read the unclamped slope.
   *
   * Taking the direction from the clamped projection makes that unrepresentable: at
   * 1.0 the projection is 1.0, the move is 0, and the honest call is "stable".
   * Verified against the full recorder history: 32 phantom "rising" calls made from
   * the ceiling, now 0.
   */
  // Rounded for the same IEEE754 reason resolve() rounds its delta, and so the
  // two sides of the dead-band compare like with like.
  var move = r4(projected - cur);
  return {
    direction: move > eps ? 'rising' : move < -eps ? 'falling' : 'stable',
    currentStress: r4(cur), projectedStress: r4(projected),
    projectedMove: move, slope: r4(slope), n: n
  };
}

module.exports = { resolve: resolve, deriveForecast: deriveForecast, DEAD_BAND: DEAD_BAND };
