/**
 * lib/domain-market-feed.js — LIVE market channel for EVERY domain, not just energy.
 * IMPURE (network + Date), same documented exception as lib/energy-market-feed.js.
 *
 * WHY THIS EXISTS (2026-07-28). Measured against the live channel store, the three weighted
 * CISS channels are almost information-free: `distress` carries ONE distinct value across 182
 * samples in ALL 20 domains, `granularity` likewise, and `unison` a median of two. That is 70%
 * of composite weight reading a constant. The one channel demonstrated to carry information end
 * to end is `marketScore`, and it was wired to exactly ONE domain (energy, off FRED WTI). Energy
 * is not better instrumented because its architecture differs; it is better instrumented because
 * it is the only domain with a real price series attached.
 *
 * The data to fix that was already in the repo and already in production: all 20
 * `handlers/*-markets.js` carry a curated ticker basket (358 symbols) fetched from Yahoo v8,
 * public and keyless. Those quotes were being used for DISPLAY only and never became a channel.
 *
 * WHAT IS REUSED, AND WHY IT MATTERS: the scoring function is
 * `history-backfill.marketStress()`, UNCHANGED — the same function validated on 40 years of real
 * WTI (memory: energy-backfill-first-result, precision 0.70 / recall 0.08). No parallel scoring
 * logic that can drift from what was validated. Only the SERIES it is handed is new.
 *
 * THE INSTRUMENT IS THE COMMON FACTOR, NOT DISPERSION. A prior session tested cross-sectional
 * dispersion as the market instrument and it FAILED its placebo, while the baskets themselves
 * PASSED as genuine clusters (17/19 above a size-matched null, common-factor varShare 0.12-0.46
 * vs 0.06-0.15 random). Dispersion is by construction the spread AROUND the common component, so
 * it discards the very thing that makes a domain a domain. This module therefore builds an
 * equal-weight INDEX (the common factor) and scores that. Do not re-litigate with dispersion.
 *
 * HONEST SCOPE:
 *  - This is a CHANNEL, one vote among several into the phase estimator. It is NOT an alarm.
 *    That distinction is load-bearing: `marketStress` is 0.7*drawdown + 0.3*volatility, and a
 *    common VOLATILITY regime is not removed by any of this. Eight domains were previously seen
 *    at ~2sd factor vol simultaneously. Anything that FIRES per-domain must first residualize
 *    against a common vol factor; that control has not been run and is not claimed here.
 *  - Equal-weight, not cap-weight: cap-weight would let one mega-cap be the domain.
 *  - Abstains rather than fabricates. Too few live tickers, too short a series, or any fetch
 *    failure returns null and the estimator runs on the remaining channels exactly as before.
 *  - `economy` must NOT be de-beta'd against the broad market: for economy the market factor IS
 *    the signal. Nothing here de-betas anything, which is the correct default for that reason.
 *  - religion's basket is faith-screened ETFs and is thin (2 live symbols); its real instrument
 *    is CMS HCRIS church-hospital margin, which is annual ground truth, not a fast channel.
 *    MIN_TICKERS makes religion abstain here rather than publish a two-ETF "index".
 */

var historyBackfill = require('./history-backfill');
var feedFractal = require('./feed-fractal');

var FETCH_TIMEOUT_MS = 7000;
var RANGE = '1y';               // ~252 trading days: enough for a 20-day trailing window plus slack
var MIN_TICKERS = 3;            // below this an "index" is one or two names, not a domain factor
var MIN_POINTS = 60;            // enough history for a stable trailing peak
var CONC = 8;                   // matches the concurrency the *-markets.js handlers already use

/**
 * Symbols that no longer resolve (corporate actions, delistings). Found while auditing the live
 * baskets; `GDIT` was never a ticker at all (GD's IT division). Skipped here so a dead symbol
 * cannot silently shrink a basket without being named. The baskets themselves are left alone:
 * editing 20 production handlers is a separate change from reading them.
 */
var DEAD_SYMBOLS = {
  ATGE: 1, CNHI: 1, DFS: 1, EDR: 1, FOVL: 1, GDIT: 1, KOCG: 1, MAXR: 1,
  PARA: 1, 'PSO.L': 1, SUM: 1, TWOU: 1, VRNT: 1, WWE: 1
};

/**
 * parseChartBars(json) — pure parser (no network), independently testable.
 * Yahoo v8 chart -> [{t(ms), v}] ascending, dropping null closes (holidays / halts).
 */
function parseChartBars(json) {
  var r = json && json.chart && json.chart.result && json.chart.result[0];
  if (!r || !r.timestamp || !r.indicators || !r.indicators.quote || !r.indicators.quote[0]) return null;
  var closes = r.indicators.quote[0].close || [];
  var out = [];
  for (var i = 0; i < r.timestamp.length; i++) {
    var v = closes[i];
    if (typeof v === 'number' && isFinite(v) && v > 0) out.push({ t: r.timestamp[i] * 1000, v: v });
  }
  out.sort(function (a, b) { return a.t - b.t; });
  return out.length ? out : null;
}

/**
 * buildIndex(seriesList) — pure. Equal-weight index of normalized closes.
 *
 * Each ticker is divided by its OWN first close so the index measures co-movement rather than
 * price level, then averaged across whatever tickers have a print on that date. Averaging per
 * date (not requiring a full panel) keeps a single late-listing or halted name from truncating
 * the whole basket. Returns [{t, v}] ascending.
 */
function buildIndex(seriesList) {
  var byDate = Object.create(null);
  for (var i = 0; i < seriesList.length; i++) {
    var s = seriesList[i];
    if (!s || !s.length) continue;
    var base = s[0].v;
    if (!base || !isFinite(base)) continue;
    for (var j = 0; j < s.length; j++) {
      var day = new Date(s[j].t).toISOString().slice(0, 10);
      (byDate[day] || (byDate[day] = [])).push(s[j].v / base);
    }
  }
  var days = Object.keys(byDate).sort();
  var out = [];
  for (var k = 0; k < days.length; k++) {
    var arr = byDate[days[k]], sum = 0;
    for (var m = 0; m < arr.length; m++) sum += arr[m];
    var v = sum / arr.length;
    if (isFinite(v) && v > 0) out.push({ t: Date.parse(days[k]), v: v, n: arr.length });
  }
  return out;
}

function fetchJson(url) {
  return new Promise(function (resolve) {
    var done = false;
    var finish = function (v) { if (!done) { done = true; resolve(v); } };
    var timer = setTimeout(function () { finish(null); }, FETCH_TIMEOUT_MS);
    try {
      fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { clearTimeout(timer); finish(j); })
        .catch(function () { clearTimeout(timer); finish(null); });
    } catch (e) { clearTimeout(timer); finish(null); }
  });
}

async function fetchBars(symbol) {
  var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' +
    encodeURIComponent(symbol) + '?range=' + RANGE + '&interval=1d';
  var j = await fetchJson(url);
  var bars = parseChartBars(j);
  return (bars && bars.length >= MIN_POINTS) ? bars : null;
}

/**
 * getLiveMarketChannel(domain, tickers, opts) — the live read for one domain.
 *
 * Returns the SAME shape as energy-market-feed.getLiveMarketChannel() so the worker can treat
 * both identically: { reading, score, latestPrice, latestDate, seriesLen, source }. Returns null
 * on abstain (thin basket, short series, or fetch failure) — never a fabricated score.
 */
async function getLiveMarketChannel(domain, tickers, opts) {
  opts = opts || {};
  var syms = (tickers || []).filter(function (s) { return s && !DEAD_SYMBOLS[s]; });
  if (syms.length < MIN_TICKERS) return null;                 // too thin to be a domain factor

  var got = [];
  for (var i = 0; i < syms.length; i += CONC) {
    var chunk = syms.slice(i, i + CONC);
    var res = await Promise.all(chunk.map(fetchBars));
    for (var j = 0; j < res.length; j++) if (res[j]) got.push(res[j]);
  }
  if (got.length < MIN_TICKERS) return null;                  // most of the basket failed -> abstain

  var series = buildIndex(got);
  if (series.length < MIN_POINTS) return null;

  var idx = series.length - 1;
  var score = historyBackfill.marketStress(series, idx, opts.marketStressOpts);
  if (score === null) return null;

  var latest = series[idx];
  return {
    reading: feedFractal.marketChannel(score),                // { key:'marketScore', value, likelihood }
    score: score,
    latestPrice: Math.round(latest.v * 10000) / 10000,        // index level (1.0 = basket start), not a price
    latestDate: new Date(latest.t).toISOString().slice(0, 10),
    seriesLen: series.length,
    tickersRequested: syms.length,
    tickersLive: got.length,
    source: 'basket index (' + got.length + '/' + syms.length + ' tickers, equal-weight, Yahoo v8 daily)'
  };
}

module.exports = {
  parseChartBars: parseChartBars,
  buildIndex: buildIndex,
  getLiveMarketChannel: getLiveMarketChannel,
  DEAD_SYMBOLS: DEAD_SYMBOLS,
  MIN_TICKERS: MIN_TICKERS,
  MIN_POINTS: MIN_POINTS
};
