/**
 * lib/domain-series-feed.js — give every domain what energy has: a real, deep, free numeric
 * series scored by the SAME function validated on 40 years of WTI. IMPURE (network + Date),
 * the same documented exception as lib/energy-market-feed.js.
 *
 * WHY THIS EXISTS (2026-07-29). Energy was never architecturally special. It was the only domain
 * anybody had wired to FRED. Everything else reconstructed "is this domain stressed" from company
 * fundamentals that update quarterly, a Herfindahl with no mass data, and news article counts, and
 * the result was that thirteen of twenty domains recorded ONE distinct value across 202 samples.
 *
 * Probed 2026-07-29 against the live keyless FRED CSV endpoint, ten-year windows:
 *   technology  NASDAQCOM     2512 points, 2507 distinct   (had 1)
 *   energy      DCOILWTICO    2497 points, 2042 distinct
 *   environment DHHNGSP       2508 points,  523 distinct   (had 33)
 *   finance     NFCI           521 points,  321 distinct   (had 14)
 *   economy     T10Y2Y        2497 points,  259 distinct   (had 8)
 * and monthly series with ~119 points for the rest. The instrument gap was never structural. It
 * was one hardcoded series id.
 *
 * IT IS ITS OWN CHANNEL, NOT A REPLACEMENT. This emits `seriesScore`, separate from the
 * `marketScore` built off equity baskets. Swapping the source under an existing channel key would
 * mix two instruments inside one history and silently corrupt every rank taken against it — the
 * same defect that made the forecaster's stored ledger unusable when its model changed. Two
 * instruments, two channels, two histories.
 *
 * SCORING IS UNCHANGED. history-backfill.marketStress() is reused verbatim: 0.7*drawdown +
 * 0.3*trailing volatility over a trailing window, point-in-time, past-only. No parallel scoring
 * logic that can drift from what was validated.
 *
 * HONEST ABOUT INSTRUMENT QUALITY. Each series carries a `quality` tag. 'direct' means the series
 * measures the domain's own subject matter (WTI for energy, Nasdaq for technology, natural gas for
 * environment). 'proxy' means it is a defensible but indirect stand-in (a CPI component for a
 * domain with no traded instrument). Nothing is included that is merely generic: a placeholder
 * like headline CPI dressed up as "communication" would be a fabricated domain signal, and those
 * are omitted rather than shipped with a caveat. Five domains have no entry yet for that reason.
 */

var historyBackfill = require('./history-backfill');
var feedFractal = require('./feed-fractal');
var DOMAIN_NAMES = require('./domain-names');

var FETCH_TIMEOUT_MS = 9000;
var LOOKBACK_DAYS = 3650;        // ten years: deep enough for the trailing peak to mean something
var MIN_POINTS = 50;

/**
 * The instrument per domain. Every series id was verified live against FRED, and the scorer was
 * run over each one, before it was listed here.
 *
 * `lookbackDays` is per series and load-bearing. QUARTERLY series produce ~40 points over ten
 * years, which is under MIN_POINTS, so a uniform ten-year window reported defense, governance and
 * research as having no instrument at all. They have one; the window was starving them. Thirty
 * years gives 119 quarters and the scorer then returns 38-39 distinct values over the last 40
 * samples, comparable to the daily series.
 *
 * INTELLIGENCE IS STILL DELIBERATELY ABSENT. The only candidate that resolved for it was FDEFX,
 * which is defense's own series. Wiring the same series to two domains would make them perfectly
 * correlated and publish that as a distinction between them — a fabricated signal, and exactly
 * what the quality rule below exists to prevent. Intelligence relies on the text layer instead,
 * where it reads fine. Same for communication and religion: no defensible series found yet, and a
 * generic CPI dressed up as a domain instrument is worse than an honest abstention.
 */
var SERIES = {
  energy:         { id: 'DCOILWTICO',   label: 'WTI crude spot',            quality: 'direct', cadence: 'daily' },
  technology:     { id: 'NASDAQCOM',    label: 'Nasdaq composite',          quality: 'direct', cadence: 'daily' },
  environment:    { id: 'DHHNGSP',      label: 'Henry Hub natural gas spot', quality: 'direct', cadence: 'daily' },
  economy:        { id: 'T10Y2Y',       label: '10y-2y treasury spread',    quality: 'direct', cadence: 'daily' },
  finance:        { id: 'NFCI',         label: 'Chicago Fed financial conditions', quality: 'direct', cadence: 'weekly' },
  agriculture:    { id: 'PFOODINDEXM',  label: 'global food price index',   quality: 'direct', cadence: 'monthly' },
  industry:       { id: 'INDPRO',       label: 'industrial production',     quality: 'direct', cadence: 'monthly' },
  supplyChain:    { id: 'IPMAN',        label: 'manufacturing output',      quality: 'proxy',  cadence: 'monthly' },
  infrastructure: { id: 'IPUTIL',       label: 'utilities output',          quality: 'proxy',  cadence: 'monthly' },
  population:     { id: 'HOUST',        label: 'housing starts',            quality: 'proxy',  cadence: 'monthly' },
  health:         { id: 'CPIMEDSL',     label: 'medical care CPI',          quality: 'proxy',  cadence: 'monthly' },
  education:      { id: 'CUSR0000SEEB', label: 'education CPI',             quality: 'proxy',  cadence: 'monthly' },
  culture:        { id: 'CUSR0000SERA', label: 'recreation CPI',            quality: 'proxy',  cadence: 'monthly' },
  // Quarterly. These need the 30-year window; at ten years they fall under MIN_POINTS and
  // wrongly report as having no instrument.
  defense:        { id: 'FDEFX',        label: 'federal defense consumption + investment', quality: 'direct', cadence: 'quarterly', lookbackDays: 10950 },
  governance:     { id: 'FGEXPND',      label: 'federal government expenditures', quality: 'proxy', cadence: 'quarterly', lookbackDays: 10950 },
  research:       { id: 'Y694RC1Q027SBEA', label: 'R&D investment',        quality: 'direct', cadence: 'quarterly', lookbackDays: 10950 },
  law:            { id: 'PCU5411154111', label: 'legal services PPI',      quality: 'direct', cadence: 'monthly',   lookbackDays: 10950 }
};

/** parseFredCsv(text) — pure. Same shape as energy-market-feed's parser. [{t,v}] ascending. */
function parseFredCsv(text) {
  var lines = String(text || '').trim().split('\n');
  var out = [];
  for (var i = 1; i < lines.length; i++) {
    var parts = lines[i].split(',');
    if (parts.length < 2) continue;
    var t = Date.parse(parts[0]);
    var v = parseFloat(parts[1]);
    if (isFinite(t) && isFinite(v)) out.push({ t: t, v: v });     // FRED prints '.' for missing
  }
  out.sort(function (a, b) { return a.t - b.t; });
  return out;
}

/**
 * fetchSeries(id, opts) — live fetch of one FRED series, recent window only.
 * MUST use fetch(), not a raw https.get: the CSV endpoint redirects, and a client that does not
 * follow redirects gets an empty body and silently reports the series as unavailable. That cost
 * me a probe that reported 0 of 20 domains usable when the true answer was 15.
 */
async function fetchSeries(id, opts) {
  opts = opts || {};
  var days = opts.lookbackDays || LOOKBACK_DAYS;
  var cosd = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
  var url = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=' + encodeURIComponent(id) + '&cosd=' + cosd;
  try {
    var resp = await fetch(url, { signal: AbortSignal.timeout(opts.timeoutMs || FETCH_TIMEOUT_MS) });
    if (!resp.ok) return null;
    var series = parseFredCsv(await resp.text());
    return series.length >= MIN_POINTS ? series : null;
  } catch (e) { return null; }
}

/**
 * getSeriesChannel(domain, opts) — the one call the worker makes per domain.
 * Returns the same shape as the other market feeds so the worker treats them alike, or null to
 * abstain (no series listed, fetch failed, or too few points). Never a fabricated score.
 */
async function getSeriesChannel(domain, opts) {
  opts = opts || {};
  var key = DOMAIN_NAMES.toRuntime(domain);
  var spec = SERIES[key] || SERIES[DOMAIN_NAMES.toCanonical(domain)];
  if (!spec) return null;

  // Per-series lookback: quarterly instruments need a 30-year window to clear MIN_POINTS.
  var series = await fetchSeries(spec.id, Object.assign({}, opts, { lookbackDays: opts.lookbackDays || spec.lookbackDays || LOOKBACK_DAYS }));
  if (!series) return null;

  var idx = series.length - 1;
  var score = historyBackfill.marketStress(series, idx, opts.marketStressOpts);
  if (score === null) return null;

  var latest = series[idx];
  var distinct = {};
  for (var i = 0; i < series.length; i++) distinct[series[i].v] = 1;

  return {
    reading: { key: 'seriesScore', value: score, likelihood: null },
    score: score,
    seriesId: spec.id,
    label: spec.label,
    quality: spec.quality,
    cadence: spec.cadence,
    latestValue: latest.v,
    latestDate: new Date(latest.t).toISOString().slice(0, 10),
    points: series.length,
    distinct: Object.keys(distinct).length,
    source: 'FRED ' + spec.id + ' (' + spec.label + ', ' + spec.quality + ')'
  };
}

module.exports = {
  SERIES: SERIES,
  parseFredCsv: parseFredCsv,
  fetchSeries: fetchSeries,
  getSeriesChannel: getSeriesChannel,
  domains: Object.keys(SERIES)
};
