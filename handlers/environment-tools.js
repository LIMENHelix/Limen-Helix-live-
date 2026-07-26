/**
 * api/environment-tools.js — the built Environment Watch tools, server side.
 *
 *   GET /api/environment-tools?tool=air&zip=97701 → air quality + active hazards at that ZIP
 *   GET /api/environment-tools?tool=fires         → active large wildfires nationwide (NIFC)
 *   GET /api/environment-tools?tool=drought       → drought by state, all 50 (US Drought Monitor)
 *   GET /api/environment-tools                    → fires + drought (air needs a ZIP)
 *
 * NOT included: drinking-water quality. EPA's Envirofacts service answered in 27-30s and
 * 500'd on the ZIP query when tested on 2026-07-25, which is too slow and too unreliable to
 * sit behind a live tool. Saying so is better than shipping a card that half works.
 *
 * Sources (all keyless)
 *   Zippopotam.us          ZIP -> place, state, lat/lon
 *   Open-Meteo Air Quality US AQI + PM2.5 / PM10 / ozone / NO2 / CO
 *   NWS api.weather.gov    active alerts at that exact point
 *   NIFC WFIGS (ArcGIS)    current wildfire incidents
 *   U.S. Drought Monitor   weekly state statistics
 */
var db = require('../lib/limen-db');

var TTL = { fires: 30 * 60 * 1000, drought: 6 * 3600 * 1000, air: 30 * 60 * 1000, support: 6 * 3600 * 1000 };
var KEY = { fires: 'environment:tool:fires:v1', drought: 'environment:tool:drought:v1', support: 'environment:tool:support:v1' };
var fema = require('../lib/fema');

function getJSON(url, ms, headers) {
  var ctl = new AbortController();
  var tid = setTimeout(function () { ctl.abort(); }, ms || 10000);
  var h = { 'User-Agent': 'LIMEN-Helix/1.0', 'Accept': 'application/json' };
  for (var k in (headers || {})) h[k] = headers[k];
  return fetch(url, { signal: ctl.signal, headers: h })
    .then(function (r) { clearTimeout(tid); return r.json().then(function (j) { return { status: r.status, body: j }; }); })
    .catch(function (e) { clearTimeout(tid); return { status: 0, body: null, err: e.message || 'timeout' }; });
}

// ── 1. AIR QUALITY BY ZIP ──────────────────────────────────────────────────
// EPA's official AQI bands. The band, not the number, is what tells someone what to do.
var AQI_BANDS = [
  { max: 50,  band: 'Good',       risk: 'low',      say: 'Air quality is satisfactory. No precautions needed.' },
  { max: 100, band: 'Moderate',   risk: 'low',      say: 'Fine for most people. Unusually sensitive people may want to limit long outdoor exertion.' },
  { max: 150, band: 'Unhealthy for sensitive groups', risk: 'medium', say: 'People with asthma, heart or lung disease, children and older adults should cut back on long or intense outdoor activity.' },
  { max: 200, band: 'Unhealthy',  risk: 'high',     say: 'Everyone may start to feel effects. Sensitive groups should avoid outdoor exertion; everyone else should reduce it.' },
  { max: 300, band: 'Very unhealthy', risk: 'high', say: 'Health alert. Everyone should avoid outdoor exertion; sensitive groups should stay indoors.' },
  { max: 1e9, band: 'Hazardous',  risk: 'high',     say: 'Emergency conditions. Everyone should stay indoors and keep exertion low.' }
];
function aqiBand(v) {
  for (var i = 0; i < AQI_BANDS.length; i++) if (v <= AQI_BANDS[i].max) return AQI_BANDS[i];
  return AQI_BANDS[AQI_BANDS.length - 1];
}

async function fetchAir(zipRaw) {
  var zip = String(zipRaw || '').replace(/\D/g, '').slice(0, 5);
  if (zip.length !== 5) return { ok: false, reason: 'Enter a 5-digit US ZIP code.' };
  var cacheKey = 'environment:tool:air:' + zip;
  try {
    var hit = await db.get(cacheKey);
    if (hit && hit.updatedMs && (Date.now() - hit.updatedMs) < TTL.air && hit.data) {
      var h = Object.assign({}, hit.data); h.cached = true; return h;
    }
  } catch (e) {}

  var z = await getJSON('https://api.zippopotam.us/us/' + zip, 8000);
  if (z.status === 404) return { ok: false, reason: 'No US place found for ZIP ' + zip + '.' };
  if (z.status !== 200 || !z.body || !z.body.places || !z.body.places.length) {
    return { ok: false, reason: 'ZIP lookup returned ' + (z.status || 'no response') + '.' };
  }
  var p = z.body.places[0];
  var lat = parseFloat(p.latitude), lon = parseFloat(p.longitude);
  if (!isFinite(lat) || !isFinite(lon)) return { ok: false, reason: 'ZIP ' + zip + ' has no usable coordinates.' };

  var results = await Promise.all([
    getJSON('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + lat + '&longitude=' + lon
      + '&current=us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,carbon_monoxide&timezone=auto', 9000),
    getJSON('https://api.weather.gov/alerts/active?point=' + lat + ',' + lon, 9000)
  ]);
  var aq = results[0], nws = results[1];
  if (aq.status !== 200 || !aq.body || !aq.body.current || aq.body.current.us_aqi == null) {
    return { ok: false, reason: 'The air-quality service returned ' + (aq.status || 'no response') + ' for that location.' };
  }
  var cur = aq.body.current, units = aq.body.current_units || {};
  var b = aqiBand(cur.us_aqi);
  var alerts = [];
  if (nws.status === 200 && nws.body && Array.isArray(nws.body.features)) {
    alerts = nws.body.features.slice(0, 6).map(function (f) {
      var pr = f.properties || {};
      return { event: pr.event || null, severity: pr.severity || null, urgency: pr.urgency || null, headline: pr.headline || null, ends: pr.ends || pr.expires || null };
    });
  }
  var out = {
    ok: true, zip: zip,
    place: p['place name'] || null, state: p['state abbreviation'] || null,
    lat: lat, lon: lon,
    aqi: Math.round(cur.us_aqi), band: b.band, risk: b.risk, advice: b.say,
    observedAt: cur.time || null,
    pollutants: [
      { key: 'PM2.5', value: cur.pm2_5, unit: units.pm2_5 || 'µg/m³', what: 'Fine soot and smoke. The particle that gets deepest into the lungs; the one wildfire smoke is made of.' },
      { key: 'PM10', value: cur.pm10, unit: units.pm10 || 'µg/m³', what: 'Coarser dust and pollen.' },
      { key: 'Ozone', value: cur.ozone, unit: units.ozone || 'µg/m³', what: 'Formed by sunlight acting on traffic and industrial exhaust. Peaks on hot afternoons.' },
      { key: 'NO2', value: cur.nitrogen_dioxide, unit: units.nitrogen_dioxide || 'µg/m³', what: 'Combustion exhaust, mostly traffic.' },
      { key: 'CO', value: cur.carbon_monoxide, unit: units.carbon_monoxide || 'µg/m³', what: 'Carbon monoxide, also combustion.' }
    ].filter(function (x) { return x.value != null; }),
    alerts: alerts,
    source: 'Open-Meteo Air Quality (CAMS model output) and the National Weather Service',
    sourceUrl: 'https://open-meteo.com/en/docs/air-quality-api',
    note: 'This is modelled air quality for your coordinates, not a reading from a monitor in your town. For the official regulatory reading, check AirNow.'
  };
  try { await db.set(cacheKey, { updatedMs: Date.now(), data: out }, Math.round(TTL.air / 1000)); } catch (e) {}
  out.cached = false;
  return out;
}

// ── 2. ACTIVE WILDFIRES ────────────────────────────────────────────────────
// NIFC WFIGS current incident locations. IncidentSize is acres; the layer carries 97 fields,
// so ask only for the six that matter and skip geometry.
async function fetchFires() {
  var base = 'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0/query';
  var q = base + '?where=' + encodeURIComponent('IncidentSize>100')
    + '&outFields=' + encodeURIComponent('IncidentName,IncidentSize,POOState,PercentContained,FireDiscoveryDateTime,FireCauseGeneral')
    + '&orderByFields=' + encodeURIComponent('IncidentSize DESC')
    + '&resultRecordCount=15&returnGeometry=false&f=json';
  var r = await getJSON(q, 14000);
  if (r.status !== 200 || !r.body || !Array.isArray(r.body.features)) {
    return { ok: false, reason: 'The wildfire service returned ' + (r.status || 'no response') + '.' };
  }
  var rows = r.body.features.map(function (f) {
    var a = f.attributes || {};
    return {
      name: a.IncidentName || null,
      acres: a.IncidentSize != null ? Math.round(a.IncidentSize) : null,
      state: String(a.POOState || '').replace(/^US-/, '') || null,
      contained: a.PercentContained != null ? Math.round(a.PercentContained) : null,
      discovered: a.FireDiscoveryDateTime ? new Date(a.FireDiscoveryDateTime).toISOString().slice(0, 10) : null,
      cause: a.FireCauseGeneral || null
    };
  }).filter(function (x) { return x.name && x.acres; });
  if (!rows.length) return { ok: false, reason: 'The wildfire service returned no incidents over 100 acres.' };
  var totalAcres = rows.reduce(function (s, x) { return s + x.acres; }, 0);
  var uncontained = rows.filter(function (x) { return x.contained != null && x.contained < 100; }).length;
  return {
    ok: true, rows: rows, totalAcres: totalAcres, uncontained: uncontained,
    source: 'National Interagency Fire Center (WFIGS)',
    sourceUrl: 'https://www.nifc.gov/fire-information/nfn',
    note: 'The largest current incidents over 100 acres, by size. Containment is the percent of the perimeter held, NOT how much of the fire is out. A 100% contained fire can still be burning inside its lines.'
  };
}

// ── 3. DROUGHT BY STATE ────────────────────────────────────────────────────
// All 50 states in one keyless call. FIPS must be zero-padded or the service drops them.
var STATE_FIPS = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE','12':'FL','13':'GA',
  '15':'HI','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD',
  '25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ',
  '35':'NM','36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC',
  '46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV','55':'WI','56':'WY'
};
function fmtDate(d) { return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear(); }
function band(d2, d1) {
  if (d2 >= 50) return 'severe';
  if (d2 >= 20) return 'stressed';
  if (d2 > 0 || d1 >= 25) return 'watch';
  return 'normal';
}

async function fetchDrought() {
  var end = new Date(), start = new Date(end.getTime() - 21 * 86400000);
  var aoi = Object.keys(STATE_FIPS).join(',');
  var url = 'https://usdmdataservices.unl.edu/api/StateStatistics/GetDroughtSeverityStatisticsByAreaPercent'
    + '?aoi=' + aoi + '&startdate=' + encodeURIComponent(fmtDate(start))
    + '&enddate=' + encodeURIComponent(fmtDate(end)) + '&statisticsType=1';
  var ctl = new AbortController();
  var tid = setTimeout(function () { ctl.abort(); }, 14000);
  var csv;
  try {
    var r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'LIMEN-Helix/1.0' } });
    clearTimeout(tid);
    if (!r.ok) return { ok: false, reason: 'Drought Monitor returned ' + r.status };
    csv = await r.text();
  } catch (e) { clearTimeout(tid); return { ok: false, reason: 'Drought Monitor unreachable: ' + (e.message || 'timeout') }; }

  var lines = (csv || '').trim().split(/\r?\n/);
  if (lines.length < 2) return { ok: false, reason: 'Drought Monitor returned no rows' };
  var latest = {}, prior = {}, mapDate = null;
  for (var i = 1; i < lines.length; i++) {
    var c = lines[i].split(',');
    if (c.length < 8) continue;
    var st = c[1], md = c[0];
    if (!mapDate || md > mapDate) mapDate = md;
    if (!latest[st] || md > latest[st].md) { if (latest[st]) prior[st] = latest[st]; latest[st] = { md: md, d0: +c[3], d1: +c[4], d2: +c[5], d3: +c[6], d4: +c[7] }; }
    else if (!prior[st] || md > prior[st].md) prior[st] = { md: md, d2: +c[5] };
  }
  var rows = [];
  for (var k in latest) {
    var L = latest[k], p = prior[k];
    rows.push({
      state: k, d0: +L.d0.toFixed(1), d1: +L.d1.toFixed(1), d2: +L.d2.toFixed(1),
      d3: +L.d3.toFixed(1), d4: +L.d4.toFixed(1), band: band(L.d2, L.d1),
      changeD2: p && isFinite(p.d2) ? +(L.d2 - p.d2).toFixed(1) : null
    });
  }
  if (!rows.length) return { ok: false, reason: 'Drought Monitor returned no usable state rows' };
  rows.sort(function (a, b) { return (b.d2 - a.d2) || (b.d1 - a.d1); });
  var inDrought = rows.filter(function (r) { return r.d2 > 0; }).length;
  return {
    ok: true, rows: rows, mapDate: mapDate, statesWithSevere: inDrought,
    source: 'U.S. Drought Monitor (NDMC / USDA / NOAA)',
    sourceUrl: 'https://droughtmonitor.unl.edu/CurrentMap.aspx',
    note: 'Percent of each state in severe drought or worse (D2-D4). Released weekly on Thursday. Columns are cumulative: D2 means D2, D3 and D4 combined.'
  };
}

// ── cache + dispatch ───────────────────────────────────────────────────────
async function cached(tool, fn) {
  var now = Date.now();
  try {
    var c = await db.get(KEY[tool]);
    if (c && c.updatedMs && (now - c.updatedMs) < TTL[tool] && c.data && c.data.ok) {
      var hit = Object.assign({}, c.data); hit.cached = true; hit.updated = c.updated; return hit;
    }
  } catch (e) {}
  var data = await fn();
  if (data && data.ok) {
    try { await db.set(KEY[tool], { updated: new Date(now).toISOString(), updatedMs: now, data: data }); } catch (e) {}
    data.cached = false; data.updated = new Date(now).toISOString();
    return data;
  }
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
  var q = req.query || {};
  var tool = q.tool || 'all';
  try {
    if (tool === 'air') { res.statusCode = 200; return res.end(JSON.stringify(await fetchAir(q.zip))); }
    if (tool === 'fires') { res.statusCode = 200; return res.end(JSON.stringify(await cached('fires', fetchFires))); }
    if (tool === 'drought') { res.statusCode = 200; return res.end(JSON.stringify(await cached('drought', fetchDrought))); }
    // P4 SCAFFOLDING: federal support switched on. A declaration is the moment a state stops
    // absorbing an event alone, which is the arc's definition of external structure holding a
    // fracture, published as a dated fact rather than inferred from a number.
    if (tool === 'support') {
      res.statusCode = 200;
      return res.end(JSON.stringify(await cached('support', function () { return fema.recent({ days: 90 }); })));
    }
    var all = await Promise.all([cached('fires', fetchFires), cached('drought', fetchDrought)]);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, fires: all[0], drought: all[1] }));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, reason: e.message || 'handler error' }));
  }
};
