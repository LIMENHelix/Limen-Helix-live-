/**
 * api/env-live.js — REAL, government-sourced environment conditions (lots of feeds).
 *
 * GET /api/env-live            → national alert breakdown + drought + quakes + news
 * GET /api/env-live?zip=90210  → all the above + LOCAL alerts, forecast, air quality,
 *                                and state drought category for that ZIP
 * GET /api/env-live?fresh=1    → bypass cache (ops)
 *
 * Sources (all free, no key, cited on the page):
 *   • National Weather Service / NOAA — api.weather.gov (active alerts + forecast)
 *   • U.S. Drought Monitor (NDMC/USDA/NOAA) — usdmdataservices.unl.edu
 *   • USGS Earthquake Hazards Program — earthquake.usgs.gov
 *   • Open-Meteo Air Quality (CAMS/EPA-scale US AQI) — air-quality-api.open-meteo.com
 *   • Zippopotam.us — ZIP → lat/lon/state geocode
 *   • Google News RSS — headlines + links to original sources (no body republished)
 *
 * Fetched server-side and Redis-cached; every source is isolated so one outage still
 * returns partial real data. Stale-on-failure.
 */
var db = require('../lib/limen-db');

var UA = 'LIMEN-Helix-EnvWatch (limenhelix.com; chrishubbel72@gmail.com)';
var GEO = { 'Accept': 'application/geo+json' };
var NAT_KEY = 'env:live:national:v5';
var NAT_TTL_MS = 20 * 60 * 1000;
var ZIP_TTL_MS = 30 * 60 * 1000;

// NWS active-alert categories (each = one or more official event names)
var CATS = [
  { key: 'heatWarn', label: 'Extreme / Excessive Heat Warnings', names: ['Extreme Heat Warning', 'Excessive Heat Warning'] },
  { key: 'heatAdv', label: 'Heat Advisories', names: ['Heat Advisory'] },
  { key: 'redFlag', label: 'Red-Flag Fire Warnings', names: ['Red Flag Warning'] },
  { key: 'floodWarn', label: 'Flood & Flash-Flood Warnings', names: ['Flood Warning', 'Flash Flood Warning'] },
  { key: 'floodWatch', label: 'Flood Watches', names: ['Flood Watch', 'Flash Flood Watch'] },
  { key: 'tornado', label: 'Tornado Warnings & Watches', names: ['Tornado Warning', 'Tornado Watch'] },
  { key: 'tstorm', label: 'Severe Thunderstorm Alerts', names: ['Severe Thunderstorm Warning', 'Severe Thunderstorm Watch'] },
  { key: 'airQuality', label: 'Air Quality Alerts', names: ['Air Quality Alert'] },
  { key: 'wind', label: 'High-Wind Warnings', names: ['High Wind Warning', 'Wind Advisory'] },
  { key: 'coastal', label: 'Coastal Flood Alerts', names: ['Coastal Flood Warning', 'Coastal Flood Advisory'] }
];

var STATE_FIPS = { AL:'01',AK:'02',AZ:'04',AR:'05',CA:'06',CO:'08',CT:'09',DE:'10',DC:'11',FL:'12',GA:'13',HI:'15',ID:'16',IL:'17',IN:'18',IA:'19',KS:'20',KY:'21',LA:'22',ME:'23',MD:'24',MA:'25',MI:'26',MN:'27',MS:'28',MO:'29',MT:'30',NE:'31',NV:'32',NH:'33',NJ:'34',NM:'35',NY:'36',NC:'37',ND:'38',OH:'39',OK:'40',OR:'41',PA:'42',RI:'44',SC:'45',SD:'46',TN:'47',TX:'48',UT:'49',VT:'50',VA:'51',WA:'53',WV:'54',WI:'55',WY:'56' };

function j(res, code, obj) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); }
function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
function fmtDate(d) { return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + '/' + d.getUTCFullYear(); }

async function getJSON(url, headers) {
  var r = await fetch(url, { headers: Object.assign({ 'User-Agent': UA, 'Accept': 'application/json' }, headers || {}) });
  if (!r.ok) throw new Error(url.slice(0, 50) + ' -> ' + r.status);
  return r.json();
}

// count active alerts for a set of NWS event names
async function countEvents(events) {
  var total = 0;
  await Promise.all(events.map(async function (ev) {
    try {
      var d = await getJSON('https://api.weather.gov/alerts/active?event=' + encodeURIComponent(ev), GEO);
      total += ((d && d.features) || []).length;
    } catch (e) {}
  }));
  return total;
}

// US Drought Monitor (cumulative %; national uses the CONUS row; camelCase JSON)
async function droughtStats(aoi) {
  var end = new Date(), start = new Date(Date.now() - 28 * 24 * 3600 * 1000);
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
  return { mapDate: String(r.mapDate || '').slice(0, 10), abnormalOrWorse: rnd(d0), droughtOrWorse: rnd(d1), severeOrWorse: rnd(d2), D0: d0, D1: d1, D2: d2, D3: d3, D4: d4 };
}
function droughtLabel(s) {
  if (s.D4 > 1) return 'Exceptional drought (D4) present';
  if (s.D3 > 1) return 'Extreme drought (D3) present';
  if (s.D2 > 1) return 'Severe drought (D2) present';
  if (s.D1 > 1) return 'Moderate drought (D1) present';
  if (s.D0 > 1) return 'Abnormally dry (D0)';
  return 'No significant drought';
}

// USGS earthquakes, magnitude 2.5+ in the past day
async function quakes() {
  var d = await getJSON('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson');
  var f = (d && d.features) || [];
  var big = null;
  for (var i = 0; i < f.length; i++) { var p = f[i].properties || {}; if (!big || (p.mag || 0) > (big.mag || 0)) big = { mag: p.mag, place: p.place }; }
  return { count: f.length, largest: big };
}

// Open-Meteo US AQI at a point
function aqiLabel(a) {
  if (a == null) return null;
  if (a <= 50) return 'Good'; if (a <= 100) return 'Moderate'; if (a <= 150) return 'Unhealthy for sensitive groups';
  if (a <= 200) return 'Unhealthy'; if (a <= 300) return 'Very unhealthy'; return 'Hazardous';
}
async function localAQI(lat, lon) {
  var d = await getJSON('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + lat + '&longitude=' + lon + '&current=us_aqi,pm2_5,ozone');
  var c = (d && d.current) || {};
  return { usAqi: c.us_aqi != null ? Math.round(c.us_aqi) : null, pm25: c.pm2_5, ozone: c.ozone, label: aqiLabel(c.us_aqi) };
}

// environment news (headlines + links only)
function decode(s) {
  return String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&#(\d+);/g, function (_, n) { try { return String.fromCharCode(+n); } catch (e) { return ''; } }).trim();
}
function m1(re, s) { var m = re.exec(s); return m ? m[1] : ''; }
async function fetchNews() {
  var q = '("heat wave" OR "excessive heat" OR "water shortage" OR drought OR "water restrictions" OR wildfire OR "air quality" OR "EPA" OR "boil water" OR flooding)';
  var url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=en-US&gl=US&ceid=US:en';
  var r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error('rss ' + r.status);
  var body = await r.text(), chunks = body.split('<item>').slice(1), items = [];
  for (var i = 0; i < chunks.length && items.length < 18; i++) {
    var c = chunks[i];
    var rawTitle = decode(m1(/<title>([\s\S]*?)<\/title>/, c)), link = decode(m1(/<link>([\s\S]*?)<\/link>/, c));
    var pub = decode(m1(/<pubDate>([\s\S]*?)<\/pubDate>/, c)), source = decode(m1(/<source[^>]*>([\s\S]*?)<\/source>/, c));
    var title = rawTitle;
    if (source && title.indexOf(' - ' + source) !== -1) title = title.slice(0, title.lastIndexOf(' - ' + source));
    else { var dash = title.lastIndexOf(' - '); if (dash > 30) { if (!source) source = title.slice(dash + 3); title = title.slice(0, dash); } }
    if (title && link) items.push({ title: title, link: link, source: source || 'News', pubDate: pub });
  }
  return items;
}

async function buildNational() {
  var out = { updated: new Date().toISOString(), updatedMs: Date.now() };
  var catCounts = await Promise.all(CATS.map(function (c) { return countEvents(c.names).then(function (n) { return { key: c.key, label: c.label, count: n }; }).catch(function () { return { key: c.key, label: c.label, count: null }; }); }));
  var byKey = {}; catCounts.forEach(function (c) { byKey[c.key] = c.count; });
  var extras = await Promise.all([
    droughtStats('us').catch(function () { return null; }),
    quakes().catch(function () { return null; }),
    fetchNews().catch(function () { return []; })
  ]);
  var total = catCounts.reduce(function (s, c) { return s + (c.count || 0); }, 0);
  out.breakdown = catCounts.filter(function (c) { return c.count != null; }).sort(function (a, b) { return (b.count || 0) - (a.count || 0); });
  out.totalAlerts = total;
  out.alerts = { heatWarnings: byKey.heatWarn, heatAdvisories: byKey.heatAdv, redFlag: byKey.redFlag, floodWarnings: byKey.floodWarn, tornado: byKey.tornado, airQuality: byKey.airQuality };
  out.drought = extras[0];
  out.droughtLabel = extras[0] ? droughtLabel(extras[0]) : null;
  out.quakes = extras[1];
  out.news = extras[2] || [];
  out.sources = [
    { name: 'National Weather Service (NOAA)', url: 'https://api.weather.gov' },
    { name: 'U.S. Drought Monitor (NDMC/USDA/NOAA)', url: 'https://droughtmonitor.unl.edu' },
    { name: 'USGS Earthquake Hazards Program', url: 'https://earthquake.usgs.gov' },
    { name: 'Open-Meteo Air Quality', url: 'https://open-meteo.com' }
  ];
  return out;
}

async function buildLocal(zip) {
  var geo = await getJSON('https://api.zippopotam.us/us/' + encodeURIComponent(zip));
  var place = (geo.places && geo.places[0]) || {};
  var lat = num(place.latitude), lon = num(place.longitude), state = place['state abbreviation'] || '';
  var out = { zip: zip, place: place['place name'] || '', state: state, lat: lat, lon: lon };
  try {
    var al = await getJSON('https://api.weather.gov/alerts/active?point=' + lat + ',' + lon, GEO);
    out.alerts = ((al && al.features) || []).map(function (f) { var p = f.properties || {}; return { event: p.event, severity: p.severity, urgency: p.urgency, headline: p.headline, area: p.areaDesc, sender: p.senderName, onset: p.onset, expires: p.expires }; }).slice(0, 10);
  } catch (e) { out.alerts = []; }
  try {
    var pts = await getJSON('https://api.weather.gov/points/' + lat + ',' + lon, GEO);
    var fcUrl = pts && pts.properties && pts.properties.forecast;
    if (fcUrl) { var fc = await getJSON(fcUrl, GEO); var per = (fc.properties && fc.properties.periods) || []; if (per[0]) out.forecast = { name: per[0].name, temp: per[0].temperature, unit: per[0].temperatureUnit, short: per[0].shortForecast, detailed: per[0].detailedForecast }; }
  } catch (e) {}
  try { out.air = await localAQI(lat, lon); } catch (e) {}
  try { var fips = STATE_FIPS[state]; if (fips) { out.drought = await droughtStats(fips); out.droughtLabel = droughtLabel(out.drought); } } catch (e) {}
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
  var q = {};
  try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  var now = Date.now();

  var national = null;
  if (q.fresh !== '1') { try { var cached = await db.get(NAT_KEY); if (cached && cached.updatedMs && (now - cached.updatedMs) < NAT_TTL_MS) national = cached; } catch (e) {} }
  if (!national) { try { national = await buildNational(); await db.set(NAT_KEY, national); } catch (e) { try { national = await db.get(NAT_KEY); } catch (e2) {} } }

  var payload = { ok: true, national: national || null };

  var zip = (q.zip || '').replace(/[^0-9]/g, '').slice(0, 5);
  if (zip.length === 5) {
    var zkey = 'env:live:zip:' + zip + ':v3', local = null;
    try { var zc = await db.get(zkey); if (zc && zc.updatedMs && (now - zc.updatedMs) < ZIP_TTL_MS) local = zc; } catch (e) {}
    if (!local) { try { local = await buildLocal(zip); local.updatedMs = now; local.updated = new Date().toISOString(); await db.set(zkey, local); } catch (e) { local = { zip: zip, error: 'Could not read local data for that ZIP.' }; } }
    payload.local = local;
  }
  return j(res, 200, payload);
};
