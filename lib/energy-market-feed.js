/**
 * lib/energy-market-feed.js — LIVE market channel for energy. IMPURE (network + Date), unlike the
 * rest of the estimator stack — documented as such, same convention as lib/company-phase-scorer.js's
 * kernel POST. Fetches real WTI crude spot price (FRED DCOILWTICO, keyless, unrevised) and turns
 * trailing price action into the SAME marketScore channel already proven on 40 years of real history
 * in lib/history-backfill.js (see memory: energy-backfill-first-result — precision 0.70, recall 0.08,
 * bug found+fixed in marketChannel's value-dependence).
 *
 * WHY THIS EXISTS NOW (2026-07-20): a live crisis (Hormuz/Iran) is real and showing up in price (WTI
 * jumped ~$70 -> $79 in one session) and in the macro-shock keyword detector, but energy's live
 * phaseBelief read P4/calm/confidence-0.999 — because the live worker only fed it company-node
 * distress (kernel quarterly financials, which lag a live war by design). This wires the ALREADY-BUILT,
 * ALREADY-VALIDATED market channel into the live path so a real price move is not invisible to the
 * domain's belief the way company financials necessarily are.
 *
 * SCOPING, stated honestly:
 *  - ENERGY ONLY. This is the one domain with a real, keyless, unrevised, decades-deep spot-price
 *    series we've validated. Do not extend to other domains without equally real data — fabricating
 *    a market channel for a domain with no real price series is the exact thing this whole effort
 *    exists to avoid.
 *  - Reuses history-backfill.marketStress() UNCHANGED — the exact function scored on real WTI history.
 *    No parallel scoring logic to drift from what was validated.
 *  - Fails soft: any fetch/parse error returns null, never throws. The worker must keep computing the
 *    phaseBelief from company channels alone if this is unavailable (same abstain discipline as
 *    everything else — a missing channel is a lower-precision estimate, not a broken run).
 */

var historyBackfill = require('./history-backfill');
var feedFractal = require('./feed-fractal');

var FRED_SERIES_ID = 'DCOILWTICO';
var LOOKBACK_DAYS = 45;     // enough calendar days to guarantee >=20 trading points after weekday/holiday gaps
var FETCH_TIMEOUT_MS = 6000;

/**
 * parseFredCsv(text) — pure parser (no network), so it's independently testable without hitting FRED.
 * Returns [{ t(ms), v }] ascending, skipping header/blank/non-numeric rows (FRED prints holidays as
 * an empty value, e.g. "2026-07-03,").
 */
function parseFredCsv(text) {
  var lines = String(text || '').trim().split('\n');
  var out = [];
  for (var i = 1; i < lines.length; i++) {          // skip header row
    var parts = lines[i].split(',');
    if (parts.length < 2) continue;
    var t = Date.parse(parts[0]);
    var v = parseFloat(parts[1]);
    if (isFinite(t) && isFinite(v) && v > 0) out.push({ t: t, v: v });
  }
  return out.sort(function (a, b) { return a.t - b.t; });
}

/**
 * fetchWtiSeries(opts) — live fetch, recent window only (keeps payload tiny via FRED's cosd param).
 * Returns [{t,v}] ascending, or null on any failure (network, timeout, empty/garbled response).
 */
async function fetchWtiSeries(opts) {
  opts = opts || {};
  var lookbackDays = opts.lookbackDays || LOOKBACK_DAYS;
  var cosd = new Date(Date.now() - lookbackDays * 24 * 3600 * 1000).toISOString().slice(0, 10);
  var url = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=' + FRED_SERIES_ID + '&cosd=' + cosd;
  try {
    var resp = await fetch(url, { signal: AbortSignal.timeout(opts.timeoutMs || FETCH_TIMEOUT_MS) });
    if (!resp.ok) return null;
    var text = await resp.text();
    var series = parseFredCsv(text);
    return series.length ? series : null;
  } catch (e) {
    return null;
  }
}

/**
 * getLiveMarketChannel(opts) — the one call the worker makes. Fetches the live WTI window, scores it
 * with the SAME marketStress() used in the validated backfill, and returns a ChannelReading (or null
 * if data is unavailable, too thin, or the fetch failed — abstain, never fabricate).
 */
async function getLiveMarketChannel(opts) {
  opts = opts || {};
  var series = await fetchWtiSeries(opts);
  if (!series || series.length < 3) return null;             // marketStress needs >=2 trailing points; guard a bit above that
  var idx = series.length - 1;                                // score the most recent point
  var score = historyBackfill.marketStress(series, idx, opts.marketStressOpts);
  if (score === null) return null;
  var latest = series[idx];
  return {
    reading: feedFractal.marketChannel(score),                // { key:'marketScore', value, likelihood } — value-dependent (fixed bug)
    score: score,
    latestPrice: latest.v,
    latestDate: new Date(latest.t).toISOString().slice(0, 10),
    seriesLen: series.length,
    source: 'FRED ' + FRED_SERIES_ID
  };
}

module.exports = {
  parseFredCsv: parseFredCsv,
  fetchWtiSeries: fetchWtiSeries,
  getLiveMarketChannel: getLiveMarketChannel,
  FRED_SERIES_ID: FRED_SERIES_ID
};
