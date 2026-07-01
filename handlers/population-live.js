/**
 * api/population-live.js — REAL "where America is moving" data (free, no key).
 *
 * GET /api/population-live            → states gaining/losing people fastest + top
 *                                       landing counties (movers' destinations)
 * GET /api/population-live?zip=78701  → the above + YOUR county's net migration +
 *                                       your state's rank
 * GET /api/population-live?fresh=1    → bypass cache (ops)
 *
 * Source: U.S. Census Bureau Population Estimates (Vintage 2023) — the keyless CSV
 * files (NOT the api.census.gov API, which now requires a key). "Net domestic
 * migration" = Americans moving state-to-state / county-to-county (the relocation
 * signal); rate = per 1,000 residents (fair across big + small places).
 * ZIP → county via zippopotam (lat/lon) + the Census geocoder. Cached in Redis a day
 * (annual data). Stale-on-failure; each source isolated.
 */
var db = require('../lib/limen-db');

var STATE_CSV = 'https://www2.census.gov/programs-surveys/popest/datasets/2020-2023/state/totals/NST-EST2023-ALLDATA.csv';
var COUNTY_CSV = 'https://www2.census.gov/programs-surveys/popest/datasets/2020-2023/counties/totals/co-est2023-alldata.csv';
var NAT_KEY = 'pop:national:v1';
var CTY_KEY = 'pop:counties:v1';
var TTL_MS = 24 * 3600 * 1000;

function j(res, code, obj) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); }
function r1(v) { var n = parseFloat(v); return isFinite(n) ? Math.round(n * 10) / 10 : 0; }
function ri(v) { var n = parseFloat(v); return isFinite(n) ? Math.round(n) : 0; }

// Census PEP CSVs are plain (no embedded commas / quotes) → simple split is safe.
function parse(text) {
  var lines = text.split(/\r?\n/).filter(function (l) { return l.length; });
  var head = lines[0].split(','), idx = {};
  head.forEach(function (h, i) { idx[h] = i; });
  return { idx: idx, data: lines.slice(1).map(function (l) { return l.split(','); }) };
}
async function getText(url) { var r = await fetch(url, { headers: { 'User-Agent': 'LIMEN-PopulationWatch (limenhelix.com)' } }); if (!r.ok) throw new Error(url.slice(0, 50) + ' ' + r.status); return r.text(); }

async function buildStates() {
  var p = parse(await getText(STATE_CSV)), x = p.idx;
  var st = p.data.filter(function (c) { return c[x.SUMLEV] === '040'; }).map(function (c) {
    return { name: c[x.NAME], pop: ri(c[x.POPESTIMATE2023]), dmig: ri(c[x.DOMESTICMIG2023]), rate: r1(c[x.RDOMESTICMIG2023]) };
  });
  st.sort(function (a, b) { return b.rate - a.rate; });
  st.forEach(function (s, i) { s.rank = i + 1; }); // 1 = fastest gaining
  return st;
}
async function buildCounties() {
  var p = parse(await getText(COUNTY_CSV)), x = p.idx, map = {}, arr = [];
  p.data.forEach(function (c) {
    if (c[x.SUMLEV] !== '050') return;
    var fips = c[x.STATE] + c[x.COUNTY];
    var o = { n: c[x.CTYNAME], s: c[x.STNAME], d: ri(c[x.DOMESTICMIG2023]), r: r1(c[x.RDOMESTICMIG2023]), p: ri(c[x.POPESTIMATE2023]) };
    map[fips] = o; arr.push(o);
  });
  // landing spots = biggest net-in counties among places people actually move to (pop >= 150k)
  var landing = arr.filter(function (o) { return o.p >= 150000; }).sort(function (a, b) { return b.r - a.r; }).slice(0, 12)
    .map(function (o) { return { county: o.n, state: o.s, rate: o.r, netIn: o.d, pop: o.p }; });
  return { map: map, landing: landing };
}

async function buildAll() {
  var st = await buildStates();
  var counties = await buildCounties().catch(function () { return { map: {}, landing: [] }; });
  var national = {
    updated: new Date().toISOString(), updatedMs: Date.now(),
    gainers: st.slice(0, 8).map(function (s) { return { state: s.name, rate: s.rate, netIn: s.dmig, pop: s.pop, rank: s.rank }; }),
    losers: st.slice(-8).reverse().map(function (s) { return { state: s.name, rate: s.rate, netIn: s.dmig, pop: s.pop, rank: s.rank }; }),
    landing: counties.landing,
    totalStates: st.length,
    source: { name: 'U.S. Census Bureau, Population Estimates (Vintage 2023)', url: 'https://www.census.gov/programs-surveys/popest.html' }
  };
  try { await db.set(NAT_KEY, national); } catch (e) {}
  try { await db.set(CTY_KEY, { updatedMs: Date.now(), map: counties.map, states: stateRankMap(st) }); } catch (e) {}
  return national;
}
function stateRankMap(st) { var m = {}; st.forEach(function (s) { m[s.name] = { rate: s.rate, netIn: s.dmig, rank: s.rank }; }); return m; }

async function localForZip(zip) {
  var geo = await getText('https://api.zippopotam.us/us/' + encodeURIComponent(zip)).then(JSON.parse);
  var place = (geo.places && geo.places[0]) || {};
  var lat = parseFloat(place.latitude), lon = parseFloat(place.longitude), state = place.state || '';
  var out = { zip: zip, place: place['place name'] || '', state: state };
  // ZIP centroid → county FIPS via the Census geocoder
  try {
    var g = await getText('https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=' + lon + '&y=' + lat + '&benchmark=Public_AR_Current&vintage=Current_Current&layers=Counties&format=json').then(JSON.parse);
    var cc = g.result.geographies.Counties[0];
    var fips = cc.STATE + cc.COUNTY;
    var cty = null, srank = null;
    try {
      var cm = await db.get(CTY_KEY);
      if (!cm || !cm.map || !cm.map[fips]) { await buildAll(); cm = await db.get(CTY_KEY); }
      if (cm && cm.map) { cty = cm.map[fips]; srank = cm.states && cm.states[state]; }
    } catch (e) {}
    out.county = cc.NAME;
    if (cty) out.migration = { netIn: cty.d, rate: cty.r, pop: cty.p };
    if (srank) out.stateRank = srank;
  } catch (e) { out.error = 'Could not resolve that ZIP to a county.'; }
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  var q = {}; try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  var now = Date.now();

  var national = null;
  if (q.fresh !== '1') { try { var c = await db.get(NAT_KEY); if (c && c.updatedMs && (now - c.updatedMs) < TTL_MS) national = c; } catch (e) {} }
  if (!national) { try { national = await buildAll(); } catch (e) { try { national = await db.get(NAT_KEY); } catch (e2) {} } }

  var payload = { ok: true, national: national || null };

  var zip = (q.zip || '').replace(/[^0-9]/g, '').slice(0, 5);
  if (zip.length === 5) {
    var zkey = 'pop:zip:' + zip + ':v2', local = null;
    if (q.fresh !== '1') { try { var zc = await db.get(zkey); if (zc && zc.updatedMs && (now - zc.updatedMs) < TTL_MS) local = zc; } catch (e) {} }
    if (!local) { try { local = await localForZip(zip); local.updatedMs = now; await db.set(zkey, local); } catch (e) { local = { zip: zip, error: 'Lookup failed. Try again.' }; } }
    payload.local = local;
  }
  return j(res, 200, payload);
};
