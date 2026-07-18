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

// forecasts: [{ madeAt(ms), direction:'rising'|'falling'|'stable', currentStress }]
// recorder:  [{ t(ms), s }]  (the recorder rows; any order)
// opts: { horizonMs, tolMs, eps, now }
function resolve(forecasts, recorder, opts) {
  opts = opts || {};
  var horizonMs = opts.horizonMs || 6 * 3600 * 1000;   // grade the direction call 6h out
  var tolMs = (opts.tolMs != null) ? opts.tolMs : 2 * 3600 * 1000;  // realized row must be within +-2h of the target
  var eps = (opts.eps != null) ? opts.eps : 0.05;      // dead-band for a 'stable' call
  var now = (typeof opts.now === 'number') ? opts.now : null;

  var rows = (recorder || []).filter(function (x) { return x && typeof x.t === 'number' && typeof x.s === 'number'; })
    .slice().sort(function (a, b) { return a.t - b.t; });

  var resolved = [], hits = 0, pending = 0;
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
    var delta = best.s - f.currentStress;
    var hit = (f.direction === 'rising' && delta > eps) ||
              (f.direction === 'falling' && delta < -eps) ||
              (f.direction === 'stable' && Math.abs(delta) <= eps) ? 1 : 0;
    hits += hit;
    resolved.push({ madeAt: f.madeAt, direction: f.direction, currentStress: r4(f.currentStress),
      realizedStress: r4(best.s), delta: r4(delta), hit: hit, realizedAt: best.t });
  });

  var n = resolved.length;
  return {
    resolvedCount: n,
    pendingCount: pending,
    externalHitRate: n ? r4(hits / n) : null,          // null until at least one forecast resolves
    horizonMs: horizonMs, eps: eps,
    resolved: resolved,
    note: n ? ('external forecast-vs-realized calibration over ' + n + ' resolved forecast(s) vs recorded feed truth (forward-only)')
            : 'no forecasts have aged past the horizon yet — external outcome ABSTAINS (caller falls back to self-consistency)'
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
  var eps = (opts.eps != null) ? opts.eps : 0.005;  // slope dead-band for a 'stable' call
  var series = (rows || []).filter(function (x) { return x && typeof x.t === 'number' && typeof x.s === 'number'; })
    .slice().sort(function (a, b) { return a.t - b.t; });
  if (series.length < 3) return null;         // not enough history to call a direction
  var w = series.slice(-window), n = w.length, sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (var i = 0; i < n; i++) { var x = i, y = w[i].s; sx += x; sy += y; sxy += x * y; sxx += x * x; }
  var d = n * sxx - sx * sx;
  var slope = d !== 0 ? (n * sxy - sx * sy) / d : 0;
  var cur = w[n - 1].s;
  var projected = Math.max(0, Math.min(1, cur + slope * horizonSteps));
  return {
    direction: slope > eps ? 'rising' : slope < -eps ? 'falling' : 'stable',
    currentStress: r4(cur), projectedStress: r4(projected), slope: r4(slope), n: n
  };
}

module.exports = { resolve: resolve, deriveForecast: deriveForecast };
