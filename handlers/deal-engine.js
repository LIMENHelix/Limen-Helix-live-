/**
 * api/deal-engine.js — REAL below-market homes, cross-referenced with where people are
 * moving (the arbitrage front-end: find cheap supply × our demand signal). Free, no key.
 *
 * GET /api/deal-engine?citystate=Houston,TX   → cheapest HUD foreclosures in that city
 * GET /api/deal-engine?state=TX               → cheapest across that state's major metros
 * GET /api/deal-engine?hot=1                   → cheapest across the top migration metros
 * GET /api/deal-engine?fresh=1                 → bypass cache (ops)
 *
 * Source: HUD HomeStore (hudhomestore.gov) — publicly listed FHA-foreclosed homes, sold
 * at a discount, listing pays a licensed broker a commission (the legal payout path).
 * Redis-cached ~2 h. We never own the asset; the engine finds + ranks, a licensed human
 * closes. Own nothing.
 */
var db = require('../lib/limen-db');
var TTL_MS = 2 * 3600 * 1000;
var UA = { 'User-Agent': 'Mozilla/5.0 (LIMEN-Helix DealEngine; limenhelix.com)', 'x-requested-with': 'XMLHttpRequest' };

var STATE_METROS = {
  TX: ['Houston,TX', 'San Antonio,TX', 'Dallas,TX', 'Austin,TX', 'Fort Worth,TX'],
  FL: ['Tampa,FL', 'Jacksonville,FL', 'Orlando,FL', 'Miami,FL'],
  NC: ['Charlotte,NC', 'Raleigh,NC', 'Greensboro,NC'],
  SC: ['Columbia,SC', 'Charleston,SC', 'Greenville,SC'],
  TN: ['Nashville,TN', 'Memphis,TN', 'Knoxville,TN'],
  GA: ['Atlanta,GA', 'Augusta,GA', 'Savannah,GA'],
  AZ: ['Phoenix,AZ', 'Tucson,AZ', 'Mesa,AZ'],
  NV: ['Las Vegas,NV', 'Reno,NV'],
  OH: ['Columbus,OH', 'Cleveland,OH', 'Cincinnati,OH'],
  IN: ['Indianapolis,IN', 'Fort Wayne,IN'],
  OK: ['Oklahoma City,OK', 'Tulsa,OK'],
  MO: ['Kansas City,MO', 'St. Louis,MO', 'Springfield,MO'],
  AL: ['Birmingham,AL', 'Huntsville,AL', 'Montgomery,AL'],
  CO: ['Denver,CO', 'Colorado Springs,CO'],
  ID: ['Boise,ID'], UT: ['Salt Lake City,UT'], VA: ['Richmond,VA', 'Virginia Beach,VA']
};
var HOT = ['Houston,TX', 'San Antonio,TX', 'Charlotte,NC', 'Tampa,FL', 'Phoenix,AZ', 'Columbia,SC', 'Nashville,TN', 'Atlanta,GA', 'Jacksonville,FL', 'Dallas,TX'];

function j(res, code, obj) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); }
function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
function decode(s) { return String(s == null ? '' : s).replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'); }

async function hudCity(citystate) {
  var r = await fetch('https://www.hudhomestore.gov/searchresult?citystate=' + encodeURIComponent(citystate), { headers: UA });
  if (!r.ok) return [];
  var h = await r.text();
  var m = h.match(/\[\{&quot;propertyCaseNumber[\s\S]*?\}\]/);
  if (!m) return [];
  var arr = [];
  try { arr = JSON.parse(decode(m[0])); } catch (e) { return []; }
  return arr.map(function (x) {
    return {
      price: num(x.listPrice), address: x.propertyAddress || '', city: x.propertyCity || '', state: x.propertyState || '',
      zip: x.propertyZip || '', county: x.propertyCounty || '', beds: x.bedrooms, baths: x.bathroomsdecimal || x.bathrooms,
      sqft: num(x.squareFootage), year: x.yearBuilt, status: x.propertyStatusDesc || x.propertyStatus,
      list_date: x.listDate, bid_deadline: x.periodDeadlineDate, hundred_down: x.SpecialProgram100Down === 'Y',
      broker_commission: x.sellingBrokerCommission, caseNumber: x.propertyCaseNumber,
      url: 'https://www.hudhomestore.gov/propertydetails?caseNumber=' + (x.propertyCaseNumber || '')
    };
  }).filter(function (d) { return d.price > 0; });
}

async function build(cities) {
  var out = [];
  for (var i = 0; i < cities.length; i++) {
    try { var l = await hudCity(cities[i]); out = out.concat(l); } catch (e) {}
  }
  // dedupe by case number, cheapest first
  var seen = {}, deals = [];
  out.sort(function (a, b) { return a.price - b.price; }).forEach(function (d) { if (!seen[d.caseNumber]) { seen[d.caseNumber] = 1; deals.push(d); } });
  return deals;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=7200');
  var q = {}; try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}

  var cities, key, zipCity = null, zipSt = null;
  if (q.zip) {
    try {
      var z = await (await fetch('https://api.zippopotam.us/us/' + encodeURIComponent(String(q.zip).replace(/[^0-9]/g, '').slice(0, 5)), { headers: UA })).json();
      if (z && z.places && z.places[0]) { zipSt = (z.places[0]['state abbreviation'] || '').toUpperCase(); zipCity = z.places[0]['place name']; }
    } catch (e) {}
  }
  if (q.citystate) { cities = [q.citystate]; key = 'deal:city:' + q.citystate.toLowerCase(); }
  else if (q.state) { var st = String(q.state).toUpperCase(); cities = STATE_METROS[st] || null; key = 'deal:state:' + st; }
  else if (zipSt) { cities = STATE_METROS[zipSt] || (zipCity ? [zipCity + ',' + zipSt] : null); key = 'deal:z:' + zipSt + ':' + (STATE_METROS[zipSt] ? 'm' : (zipCity || '')); }
  else { cities = HOT; key = 'deal:hot'; }

  if (!cities) return j(res, 200, { ok: true, deals: [], note: 'No HUD metros mapped for that area yet.' });

  var now = Date.now(), data = null;
  if (q.fresh !== '1') { try { var c = await db.get(key); if (c && c.updatedMs && (now - c.updatedMs) < TTL_MS) data = c; } catch (e) {} }
  if (!data) {
    try {
      var deals = await build(cities);
      data = { updatedMs: now, updated: new Date().toISOString(), source: 'HUD HomeStore (hudhomestore.gov)', scope: cities, count: deals.length, cheapest: deals[0] ? deals[0].price : null, deals: deals.slice(0, 30) };
      await db.set(key, data);
    } catch (e) { try { data = await db.get(key); } catch (e2) {} }
  }
  if (!data) return j(res, 503, { ok: false, error: 'warming up' });
  return j(res, 200, Object.assign({ ok: true }, data));
};
