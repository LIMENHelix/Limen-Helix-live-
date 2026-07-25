/**
 * api/agriculture-tools.js — the three free Agriculture Watch tools, server side.
 *
 *   GET /api/agriculture-tools?tool=drought  → state-by-state crop-stress map (US Drought Monitor)
 *   GET /api/agriculture-tools?tool=inputs   → fertilizer, diesel and gas input prices (FRED)
 *   GET /api/agriculture-tools?tool=prices   → live grain futures for the margin estimator (Yahoo)
 *   GET /api/agriculture-tools               → all three in one response
 *
 * Every number is fetched, never modelled. A source that fails returns ok:false with the
 * reason rather than a filler value: a farmer acting on a made-up fertilizer price is worse
 * off than one who sees "unavailable". Cached in Redis because Upstash bills bandwidth and
 * two of the three upstreams only update weekly or monthly.
 *
 * Sources
 *   Drought  U.S. Drought Monitor (NDMC/USDA/NOAA) — usdmdataservices.unl.edu, keyless CSV
 *   Inputs   FRED (St. Louis Fed) producer price indexes + weekly diesel + Henry Hub gas
 *   Prices   Yahoo Finance v8 chart endpoint, keyless (same source as agriculture-markets.js)
 */
var db = require('../lib/limen-db');

var TTL = { drought: 6 * 3600 * 1000, inputs: 12 * 3600 * 1000, prices: 15 * 60 * 1000 };
var KEY = { drought: 'agriculture:tool:drought:v1', inputs: 'agriculture:tool:inputs:v1', prices: 'agriculture:tool:prices:v1' };

// ── 1. CROP CONDITION / DROUGHT ────────────────────────────────────────────
// The 24 states that carry the bulk of US row-crop, wheat and cattle production, by FIPS.
// The Drought Monitor takes a comma list of FIPS codes and answers with one CSV row per
// state per weekly map. Columns are CUMULATIVE: the D1 column is "D1 or worse".
var AG_STATES = [
  { f: 19, s: 'IA', n: 'Iowa', c: 'corn, soybeans, hogs' },
  { f: 17, s: 'IL', n: 'Illinois', c: 'corn, soybeans' },
  { f: 31, s: 'NE', n: 'Nebraska', c: 'corn, cattle' },
  { f: 20, s: 'KS', n: 'Kansas', c: 'wheat, cattle, sorghum' },
  { f: 27, s: 'MN', n: 'Minnesota', c: 'corn, soybeans, sugarbeets' },
  { f: 18, s: 'IN', n: 'Indiana', c: 'corn, soybeans' },
  { f: 39, s: 'OH', n: 'Ohio', c: 'corn, soybeans' },
  { f: 29, s: 'MO', n: 'Missouri', c: 'soybeans, corn, cattle' },
  { f: 38, s: 'ND', n: 'North Dakota', c: 'spring wheat, canola, soybeans' },
  { f: 46, s: 'SD', n: 'South Dakota', c: 'corn, cattle, wheat' },
  { f: 55, s: 'WI', n: 'Wisconsin', c: 'dairy, corn' },
  { f: 26, s: 'MI', n: 'Michigan', c: 'corn, dairy, fruit' },
  { f: 48, s: 'TX', n: 'Texas', c: 'cattle, cotton, sorghum' },
  { f: 40, s: 'OK', n: 'Oklahoma', c: 'wheat, cattle' },
  { f: 6,  s: 'CA', n: 'California', c: 'produce, nuts, dairy' },
  { f: 53, s: 'WA', n: 'Washington', c: 'wheat, apples, potatoes' },
  { f: 16, s: 'ID', n: 'Idaho', c: 'potatoes, wheat, dairy' },
  { f: 5,  s: 'AR', n: 'Arkansas', c: 'rice, soybeans, cotton' },
  { f: 28, s: 'MS', n: 'Mississippi', c: 'soybeans, cotton, poultry' },
  { f: 22, s: 'LA', n: 'Louisiana', c: 'rice, sugarcane, soybeans' },
  { f: 21, s: 'KY', n: 'Kentucky', c: 'corn, soybeans, cattle' },
  { f: 47, s: 'TN', n: 'Tennessee', c: 'soybeans, cotton, corn' },
  { f: 37, s: 'NC', n: 'North Carolina', c: 'hogs, poultry, soybeans' },
  { f: 13, s: 'GA', n: 'Georgia', c: 'poultry, peanuts, cotton' }
];

function fmtDate(d) { return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear(); }

// D2+ (severe drought or worse) is the level at which yield loss and culling decisions start,
// so it drives the band. D0 alone is "abnormally dry" and routinely means nothing.
function droughtBand(d2plus, d1plus) {
  if (d2plus >= 50) return 'severe';
  if (d2plus >= 20) return 'stressed';
  if (d2plus > 0 || d1plus >= 25) return 'watch';
  return 'normal';
}

async function fetchDrought() {
  var end = new Date();
  var start = new Date(end.getTime() - 21 * 86400000);   // 3 weekly maps back, newest first
  // FIPS must be zero-padded: the service silently drops "6" but answers for "06",
  // which quietly cost California and Arkansas their rows.
  var aoi = AG_STATES.map(function (s) { return s.f < 10 ? '0' + s.f : String(s.f); }).join(',');
  var url = 'https://usdmdataservices.unl.edu/api/StateStatistics/GetDroughtSeverityStatisticsByAreaPercent'
    + '?aoi=' + aoi + '&startdate=' + encodeURIComponent(fmtDate(start))
    + '&enddate=' + encodeURIComponent(fmtDate(end)) + '&statisticsType=1';
  var ctl = new AbortController();
  var tid = setTimeout(function () { ctl.abort(); }, 12000);
  var csv;
  try {
    var r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    clearTimeout(tid);
    if (!r.ok) return { ok: false, reason: 'Drought Monitor returned ' + r.status };
    csv = await r.text();
  } catch (e) { clearTimeout(tid); return { ok: false, reason: 'Drought Monitor unreachable: ' + (e.message || 'timeout') }; }

  var lines = (csv || '').trim().split(/\r?\n/);
  if (lines.length < 2) return { ok: false, reason: 'Drought Monitor returned no rows' };

  // header: MapDate,StateAbbreviation,None,D0,D1,D2,D3,D4,ValidStart,ValidEnd,StatisticFormatID
  var latest = {}, prior = {}, mapDate = null;
  for (var i = 1; i < lines.length; i++) {
    var c = lines[i].split(',');
    if (c.length < 8) continue;
    var st = c[1], md = c[0];
    if (!mapDate || md > mapDate) mapDate = md;
    if (!latest[st] || md > latest[st].md) { if (latest[st]) prior[st] = latest[st]; latest[st] = { md: md, d0: +c[3], d1: +c[4], d2: +c[5], d3: +c[6], d4: +c[7], validStart: c[8] }; }
    else if (!prior[st] || md > prior[st].md) prior[st] = { md: md, d2: +c[5] };
  }

  var rows = [];
  for (var k = 0; k < AG_STATES.length; k++) {
    var s = AG_STATES[k], L = latest[s.s];
    if (!L) continue;
    var p = prior[s.s];
    rows.push({
      state: s.s, name: s.n, crops: s.c,
      d0: +L.d0.toFixed(1),           // abnormally dry or worse
      d1: +L.d1.toFixed(1),           // moderate drought or worse
      d2: +L.d2.toFixed(1),           // severe drought or worse
      d3: +L.d3.toFixed(1),           // extreme drought or worse
      d4: +L.d4.toFixed(1),           // exceptional drought
      band: droughtBand(L.d2, L.d1),
      changeD2: p && isFinite(p.d2) ? +(L.d2 - p.d2).toFixed(1) : null,
      validStart: L.validStart || null
    });
  }
  if (!rows.length) return { ok: false, reason: 'Drought Monitor returned no usable state rows' };
  rows.sort(function (a, b) { return (b.d2 - a.d2) || (b.d1 - a.d1); });
  return {
    ok: true, rows: rows, mapDate: mapDate,
    source: 'U.S. Drought Monitor (NDMC / USDA / NOAA)',
    sourceUrl: 'https://droughtmonitor.unl.edu/CurrentMap.aspx',
    note: 'Percent of each state\'s area in that drought class OR WORSE, from the weekly map released each Thursday. D2+ is severe drought, where yield loss and herd culling decisions begin.'
  };
}

// ── 2. INPUT & FERTILIZER PRICES ───────────────────────────────────────────
// Producer price indexes, not dollars per ton: PPI is what the public federal series
// actually publishes for fertilizer. Retail per-ton quotes are proprietary (DTN/Argus),
// so the honest free read is the index and its rate of change.
var FRED_SERIES = [
  { id: 'WPU0652', label: 'Fertilizer materials', kind: 'index', what: 'All fertilizer materials, producer price index (1982 = 100).' },
  { id: 'PCU325311325311', label: 'Nitrogen fertilizer', kind: 'index', what: 'Nitrogenous fertilizer manufacturing (urea, UAN, anhydrous ammonia).' },
  { id: 'PCU325312325312', label: 'Phosphate fertilizer', kind: 'index', what: 'Phosphatic fertilizer manufacturing (DAP, MAP).' },
  { id: 'PCU325314325314', label: 'Blended fertilizer', kind: 'index', what: 'Fertilizer mixing, the blends most retailers actually sell.' },
  { id: 'GASDESW', label: 'Diesel', kind: 'usd', unit: '$/gal', what: 'U.S. average on-highway diesel, the field and freight cost line.' },
  { id: 'DHHNGSP', label: 'Natural gas (Henry Hub)', kind: 'usd', unit: '$/MMBtu', what: 'Feedstock for nitrogen fertilizer. Gas leads N prices by months.' }
];

async function fetchFredSeries(id, key) {
  var url = 'https://api.stlouisfed.org/fred/series/observations?series_id=' + id
    + '&api_key=' + key + '&file_type=json&sort_order=desc&limit=400';
  var ctl = new AbortController();
  var tid = setTimeout(function () { ctl.abort(); }, 9000);
  try {
    var r = await fetch(url, { signal: ctl.signal });
    clearTimeout(tid);
    if (!r.ok) return null;
    var j = await r.json();
    var obs = (j && j.observations || []).filter(function (o) { return o.value && o.value !== '.'; });
    if (!obs.length) return null;
    var cur = { d: obs[0].date, v: parseFloat(obs[0].value) };
    if (!isFinite(cur.v)) return null;
    // nearest observation at least ~30d and ~365d before the latest, for the change columns
    var curT = Date.parse(cur.d);
    function back(days) {
      var target = curT - days * 86400000;
      var best = null;
      for (var i = 1; i < obs.length; i++) {
        var t = Date.parse(obs[i].date);
        if (t <= target) { best = { d: obs[i].date, v: parseFloat(obs[i].value) }; break; }
      }
      return best && isFinite(best.v) ? best : null;
    }
    var m = back(30), y = back(365);
    return {
      date: cur.d, value: cur.v,
      changeMonth: m ? +(((cur.v - m.v) / m.v) * 100).toFixed(1) : null,
      changeYear: y ? +(((cur.v - y.v) / y.v) * 100).toFixed(1) : null
    };
  } catch (e) { clearTimeout(tid); return null; }
}

async function fetchInputs() {
  var key = process.env.FRED_API_KEY;
  if (!key) return { ok: false, reason: 'FRED_API_KEY is not set on this deployment, so input prices cannot be read.' };
  var results = await Promise.all(FRED_SERIES.map(function (s) { return fetchFredSeries(s.id, key); }));
  var rows = [];
  for (var i = 0; i < FRED_SERIES.length; i++) {
    var s = FRED_SERIES[i], r = results[i];
    rows.push({
      id: s.id, label: s.label, kind: s.kind, unit: s.unit || 'index', what: s.what,
      url: 'https://fred.stlouisfed.org/series/' + s.id,
      ok: !!r,
      value: r ? r.value : null, asOf: r ? r.date : null,
      changeMonth: r ? r.changeMonth : null, changeYear: r ? r.changeYear : null,
      reason: r ? null : 'series did not return data on this read'
    });
  }
  if (!rows.filter(function (x) { return x.ok; }).length) return { ok: false, reason: 'FRED returned no data for any series on this read.' };
  return {
    ok: true, rows: rows,
    source: 'Federal Reserve Bank of St. Louis (FRED), from BLS and EIA series',
    sourceUrl: 'https://fred.stlouisfed.org/',
    note: 'Fertilizer is published as a producer price INDEX, not dollars per ton: per-ton retail quotes are proprietary. The percent change is the usable signal. Index series lag by roughly a month; diesel is weekly and gas is daily.'
  };
}

// ── 3. GRAIN PRICES (feeds the margin estimator) ───────────────────────────
// Front-month CBOT futures. Grains quote in CENTS per bushel, so the handler converts to
// dollars once, here, rather than leaving a factor-of-100 trap in the page.
var CONTRACTS = [
  { sym: 'ZC=F', crop: 'corn', label: 'Corn', unit: 'bu', centsQuoted: true, typicalYield: 180 },
  { sym: 'ZS=F', crop: 'soybeans', label: 'Soybeans', unit: 'bu', centsQuoted: true, typicalYield: 52 },
  { sym: 'ZW=F', crop: 'wheat', label: 'Wheat (SRW)', unit: 'bu', centsQuoted: true, typicalYield: 50 }
];

async function fetchQuote(sym) {
  var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=1mo&interval=1d';
  var ctl = new AbortController();
  var tid = setTimeout(function () { ctl.abort(); }, 9000);
  try {
    var r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
    clearTimeout(tid);
    if (!r.ok) return null;
    var j = await r.json();
    var res = j && j.chart && j.chart.result && j.chart.result[0];
    var meta = res && res.meta;
    if (!meta || meta.regularMarketPrice == null) return null;
    var closes = (res.indicators && res.indicators.quote && res.indicators.quote[0] && res.indicators.quote[0].close || [])
      .filter(function (v) { return v != null; });
    // NOT meta.chartPreviousClose: on a multi-day range that is the close BEFORE the whole
    // window, so it reported a month's move as a one-day move (+19.7% on corn). The previous
    // session is the second-to-last daily close in the series.
    var prevClose = closes.length >= 2 ? closes[closes.length - 2] : null;
    var monthAgo = closes.length >= 2 ? closes[0] : null;
    return {
      price: meta.regularMarketPrice,
      prevClose: prevClose,
      monthAgo: monthAgo,
      currency: meta.currency || null
    };
  } catch (e) { clearTimeout(tid); return null; }
}

async function fetchPrices() {
  var qs = await Promise.all(CONTRACTS.map(function (c) { return fetchQuote(c.sym); }));
  var rows = [];
  for (var i = 0; i < CONTRACTS.length; i++) {
    var c = CONTRACTS[i], q = qs[i];
    if (!q) { rows.push({ crop: c.crop, label: c.label, ok: false, reason: 'no quote returned on this read' }); continue; }
    // Yahoo quotes grains in US cents ("USX"). Convert once, here.
    var div = c.centsQuoted ? 100 : 1;
    var usd = q.price / div;
    var prev = q.prevClose != null ? q.prevClose / div : null;
    var mo = q.monthAgo != null ? q.monthAgo / div : null;
    rows.push({
      crop: c.crop, label: c.label, symbol: c.sym, unit: c.unit, ok: true,
      price: +usd.toFixed(3),
      changeDay: prev ? +(((usd - prev) / prev) * 100).toFixed(2) : null,
      changeMonth: mo ? +(((usd - mo) / mo) * 100).toFixed(2) : null,
      typicalYield: c.typicalYield,
      url: 'https://finance.yahoo.com/quote/' + encodeURIComponent(c.sym)
    });
  }
  if (!rows.filter(function (x) { return x.ok; }).length) return { ok: false, reason: 'No grain quotes returned on this read.' };
  return {
    ok: true, rows: rows,
    source: 'CBOT front-month futures via Yahoo Finance',
    sourceUrl: 'https://www.cmegroup.com/markets/agriculture.html',
    note: 'Front-month futures in dollars per bushel. This is the board price, NOT your local cash price: subtract your elevator\'s basis. Front-month rolls between contracts, so a large one-day move can be a contract roll rather than a market move.'
  };
}

// ── cache + dispatch ───────────────────────────────────────────────────────
async function cached(tool, fn) {
  var now = Date.now();
  try {
    var c = await db.get(KEY[tool]);
    if (c && c.updatedMs && (now - c.updatedMs) < TTL[tool] && c.data && c.data.ok) {
      var hit = Object.assign({}, c.data);
      hit.cached = true; hit.updated = c.updated;
      return hit;
    }
  } catch (e) {}
  var data = await fn();
  if (data && data.ok) {
    try { await db.set(KEY[tool], { updated: new Date(now).toISOString(), updatedMs: now, data: data }); } catch (e) {}
    data.cached = false; data.updated = new Date(now).toISOString();
    return data;
  }
  // upstream failed: serve the last good copy, clearly marked stale, rather than nothing
  try {
    var stale = await db.get(KEY[tool]);
    if (stale && stale.data && stale.data.ok) {
      var s = Object.assign({}, stale.data);
      s.cached = true; s.stale = true; s.updated = stale.updated;
      s.staleReason = (data && data.reason) || 'upstream unavailable';
      return s;
    }
  } catch (e) {}
  return data || { ok: false, reason: 'unavailable' };
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
  var tool = (req.query && req.query.tool) || 'all';
  try {
    if (tool === 'drought') { res.statusCode = 200; return res.end(JSON.stringify(await cached('drought', fetchDrought))); }
    if (tool === 'inputs') { res.statusCode = 200; return res.end(JSON.stringify(await cached('inputs', fetchInputs))); }
    if (tool === 'prices') { res.statusCode = 200; return res.end(JSON.stringify(await cached('prices', fetchPrices))); }
    var all = await Promise.all([cached('drought', fetchDrought), cached('inputs', fetchInputs), cached('prices', fetchPrices)]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, drought: all[0], inputs: all[1], prices: all[2] }));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, reason: e.message || 'handler error' }));
  }
};
