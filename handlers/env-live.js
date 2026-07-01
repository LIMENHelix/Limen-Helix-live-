/**
 * api/env-live.js — REAL, government-sourced environment conditions.
 *
 * GET /api/env-live            → national alert counts + drought % + news
 * GET /api/env-live?zip=90210  → all the above + LOCAL active alerts, forecast,
 *                                and state drought category for that ZIP
 *
 * Sources (all free, no key, cited in the response + on the page):
 *   • National Weather Service / NOAA  — api.weather.gov  (active alerts + forecast)
 *   • U.S. Drought Monitor (NDMC/USDA/NOAA) — usdmdataservices.unl.edu
 *   • Zippopotam.us — ZIP → lat/lon/state geocode
 *   • Google News RSS — headlines + links to original sources (no body republished)
 *
 * Fetched server-side (CORS + User-Agent) and cached in Redis so each page load is
 * cheap and the upstreams are hit at most a few times/hour. Stale-on-failure; every
 * source is wrapped so a single outage still returns partial real data.
 */
var db = require('../lib/limen-db');

var UA = 'LIMEN-Helix-EnvWatch (limenhelix.com; chrishubbel72@gmail.com)';
var NAT_KEY = 'env:live:national:v4';
var NAT_TTL_MS = 20 * 60 * 1000;
var ZIP_TTL_MS = 30 * 60 * 1000;

var HEAT_WARN = ['Extreme Heat Warning', 'Excessive Heat Warning'];
var HEAT_ADV = ['Heat Advisory'];
var HEAT_WATCH = ['Extreme Heat Watch', 'Excessive Heat Watch'];

var STATE_FIPS = { AL:'01',AK:'02',AZ:'04',AR:'05',CA:'06',CO:'08',CT:'09',DE:'10',DC:'11',FL:'12',GA:'13',HI:'15',ID:'16',IL:'17',IN:'18',IA:'19',KS:'20',KY:'21',LA:'22',ME:'23',MD:'24',MA:'25',MI:'26',MN:'27',MS:'28',MO:'29',MT:'30',NE:'31',NV:'32',NH:'33',NJ:'34',NM:'35',NY:'36',NC:'37',ND:'38',OH:'39',OK:'40',OR:'41',PA:'42',RI:'44',SC:'45',SD:'46',TN:'47',TX:'48',UT:'49',VT:'50',VA:'51',WA:'53',WV:'54',WI:'55',WY:'56' };

function j(res, code, obj) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); }
function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
function fmtDate(d) { return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + '/' + d.getUTCFullYear(); }

async function getJSON(url, headers) {
  var r = await fetch(url, { headers: Object.assign({ 'User-Agent': UA, 'Accept': 'application/json' }, headers || {}) });
  if (!r.ok) throw new Error(url.slice(0, 60) + ' → ' + r.status);
  return r.json();
}

// ── NWS: count active alerts for a set of event names ──
async function countEvents(events) {
  var total = 0, samples = [];
  await Promise.all(events.map(async function (ev) {
    try {
      var d = await getJSON('https://api.weather.gov/alerts/active?event=' + encodeURIComponent(ev), { 'Accept': 'application/geo+json' });
      var f = (d && d.features) || [];
      total += f.length;
      for (var i = 0; i < f.length && samples.length < 4; i++) {
        var p = f[i].properties || {};
        samples.push({ event: p.event, area: p.areaDesc, sender: p.senderName, expires: p.expires });
      }
    } catch (e) {}
  }));
  return { count: total, samples: samples };
}

// ── US Drought Monitor: latest row in a date window (national or state).
// JSON fields are lowercase camelCase; statisticsType=1 = CUMULATIVE percent-area,
// so d0 already means "D0 or worse", d1 = "D1 or worse", etc. National (aoi=us)
// returns both CONUS + Total rows — we take CONUS (the "contiguous U.S." headline). ──
async function droughtStats(aoi) {
  var end = new Date();
  var start = new Date(Date.now() - 28 * 24 * 3600 * 1000);
  var base = aoi === 'us'
    ? 'https://usdmdataservices.unl.edu/api/USStatistics/GetDroughtSeverityStatisticsByAreaPercent'
    : 'https://usdmdataservices.unl.edu/api/StateStatistics/GetDroughtSeverityStatisticsByAreaPercent';
  var url = base + '?aoi=' + aoi + '&startdate=' + encodeURIComponent(fmtDate(start)) + '&enddate=' + encodeURIComponent(fmtDate(end)) + '&statisticsType=1';
  var rows = await getJSON(url);
  if (!Array.isArray(rows) || !rows.length) throw new Error('no drought rows');
  if (aoi === 'us') { var conus = rows.filter(function (r) { return String(r.areaOfInterest) === 'CONUS'; }); if (conus.length) rows = conus; }
  rows.sort(function (a, b) { return String(a.mapDate).localeCompare(String(b.mapDate)); });
  var r = rows[rows.length - 1];
  var none = num(r.none), d0 = num(r.d0), d1 = num(r.d1), d2 = num(r.d2), d3 = num(r.d3), d4 = num(r.d4);
  var rnd = function (x) { return Math.round(x * 10) / 10; };
  return {
    mapDate: String(r.mapDate || '').slice(0, 10),
    abnormalOrWorse: rnd(d0), // D0-D4 (cumulative)
    droughtOrWorse: rnd(d1),  // D1-D4 — official "in drought"
    severeOrWorse: rnd(d2),   // D2-D4
    D0: d0, D1: d1, D2: d2, D3: d3, D4: d4
  };
}
function droughtLabel(s) {
  if (s.D4 > 1) return 'Exceptional drought (D4) present';
  if (s.D3 > 1) return 'Extreme drought (D3) present';
  if (s.D2 > 1) return 'Severe drought (D2) present';
  if (s.D1 > 1) return 'Moderate drought (D1) present';
  if (s.D0 > 1) return 'Abnormally dry (D0)';
  return 'No significant drought';
}

// ── environment news (headlines + links only) ──
function decode(s) {
  return String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&#(\d+);/g, function (_, n) { try { return String.fromCharCode(+n); } catch (e) { return ''; } }).trim();
}
function m1(re, s) { var m = re.exec(s); return m ? m[1] : ''; }
async function fetchNews() {
  var q = '("heat wave" OR "excessive heat" OR "water shortage" OR drought OR "water restrictions" OR wildfire OR "air quality" OR "EPA" OR "boil water")';
  var url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=en-US&gl=US&ceid=US:en';
  var r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error('rss ' + r.status);
  var body = await r.text();
  var chunks = body.split('<item>').slice(1), items = [];
  for (var i = 0; i < chunks.length && items.length < 12; i++) {
    var c = chunks[i];
    var rawTitle = decode(m1(/<title>([\s\S]*?)<\/title>/, c));
    var link = decode(m1(/<link>([\s\S]*?)<\/link>/, c));
    var pub = decode(m1(/<pubDate>([\s\S]*?)<\/pubDate>/, c));
    var source = decode(m1(/<source[^>]*>([\s\S]*?)<\/source>/, c));
    var title = rawTitle;
    if (source && title.indexOf(' - ' + source) !== -1) title = title.slice(0, title.lastIndexOf(' - ' + source));
    else { var dash = title.lastIndexOf(' - '); if (dash > 30) { if (!source) source = title.slice(dash + 3); title = title.slice(0, dash); } }
    if (title && link) items.push({ title: title, link: link, source: source || 'News', pubDate: pub });
  }
  return items;
}

async function buildNational() {
  var out = { updated: new Date().toISOString(), updatedMs: Date.now() };
  var results = await Promise.all([
    countEvents(HEAT_WARN).catch(function () { return null; }),
    countEvents(HEAT_ADV).catch(function () { return null; }),
    countEvents(HEAT_WATCH).catch(function () { return null; }),
    countEvents(['Red Flag Warning']).catch(function () { return null; }),
    countEvents(['Flood Warning', 'Flash Flood Warning']).catch(function () { return null; }),
    droughtStats('us').catch(function () { return null; }),
    fetchNews().catch(function () { return []; })
  ]);
  var hw = results[0], ha = results[1], hwatch = results[2], rf = results[3], fl = results[4], dr = results[5], news = results[6];
  out.alerts = {
    heatWarnings: hw ? hw.count : null,
    heatAdvisories: ha ? ha.count : null,
    heatWatches: hwatch ? hwatch.count : null,
    redFlag: rf ? rf.count : null,
    floodWarnings: fl ? fl.count : null,
    heatSamples: (hw && hw.samples) || []
  };
  out.drought = dr;
  out.droughtLabel = dr ? droughtLabel(dr) : null;
  out.news = news || [];
  out.sources = [
    { name: 'National Weather Service (NOAA)', url: 'https://api.weather.gov/alerts/active' },
    { name: 'U.S. Drought Monitor (NDMC / USDA / NOAA)', url: 'https://droughtmonitor.unl.edu' }
  ];
  return out;
}

async function buildLocal(zip) {
  var geo = await getJSON('https://api.zippopotam.us/us/' + encodeURIComponent(zip));
  var place = (geo.places && geo.places[0]) || {};
  var lat = num(place.latitude), lon = num(place.longitude);
  var state = place['state abbreviation'] || '';
  var out = { zip: zip, place: place['place name'] || '', state: state, lat: lat, lon: lon };

  // active alerts at this point
  try {
    var al = await getJSON('https://api.weather.gov/alerts/active?point=' + lat + ',' + lon, { 'Accept': 'application/geo+json' });
    out.alerts = ((al && al.features) || []).map(function (f) {
      var p = f.properties || {};
      return { event: p.event, severity: p.severity, urgency: p.urgency, headline: p.headline, area: p.areaDesc, sender: p.senderName, onset: p.onset, expires: p.expires, instruction: p.instruction ? String(p.instruction).slice(0, 400) : '' };
    }).slice(0, 8);
  } catch (e) { out.alerts = []; }

  // today's forecast (heat read)
  try {
    var pts = await getJSON('https://api.weather.gov/points/' + lat + ',' + lon, { 'Accept': 'application/geo+json' });
    var fcUrl = pts && pts.properties && pts.properties.forecast;
    if (fcUrl) {
      var fc = await getJSON(fcUrl, { 'Accept': 'application/geo+json' });
      var per = (fc.properties && fc.properties.periods) || [];
      if (per[0]) out.forecast = { name: per[0].name, temp: per[0].temperature, unit: per[0].temperatureUnit, short: per[0].shortForecast, detailed: per[0].detailedForecast };
    }
  } catch (e) {}

  // state drought
  try {
    var fips = STATE_FIPS[state];
    if (fips) { out.drought = await droughtStats(fips); out.droughtLabel = droughtLabel(out.drought); }
  } catch (e) {}

  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
  var q = {};
  try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  var now = Date.now();

  // ── debug probe: raw NWS fetch result ──
  if (q.debug === '1') {
    var out = {};
    try {
      var r = await fetch('https://api.weather.gov/alerts/active?limit=5&event=Heat%20Advisory', { headers: { 'User-Agent': UA, 'Accept': 'application/geo+json' } });
      out.status = r.status;
      out.ct = r.headers.get('content-type');
      var t = await r.text();
      out.len = t.length;
      out.snippet = t.slice(0, 300);
    } catch (e) { out.error = String(e && e.message || e); }
    return j(res, 200, out);
  }

  // national (+news) — cached (?fresh=1 forces a live rebuild)
  var national = null;
  if (q.fresh !== '1') {
    try {
      var cached = await db.get(NAT_KEY);
      if (cached && cached.updatedMs && (now - cached.updatedMs) < NAT_TTL_MS) national = cached;
    } catch (e) {}
  }
  if (!national) {
    try { national = await buildNational(); await db.set(NAT_KEY, national); }
    catch (e) { try { national = await db.get(NAT_KEY); } catch (e2) {} }
  }

  var payload = { ok: true, national: national || null };

  // local (if zip) — cached per zip
  var zip = (q.zip || '').replace(/[^0-9]/g, '').slice(0, 5);
  if (zip.length === 5) {
    var zkey = 'env:live:zip:' + zip + ':v2';
    var local = null;
    try {
      var zc = await db.get(zkey);
      if (zc && zc.updatedMs && (now - zc.updatedMs) < ZIP_TTL_MS) local = zc;
    } catch (e) {}
    if (!local) {
      try { local = await buildLocal(zip); local.updatedMs = now; local.updated = new Date().toISOString(); await db.set(zkey, local); }
      catch (e) { local = { zip: zip, error: 'Could not read local data for that ZIP.' }; }
    }
    payload.local = local;
  }

  return j(res, 200, payload);
};
