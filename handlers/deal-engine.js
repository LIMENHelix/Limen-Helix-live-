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
var NAME2ABBR = { 'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'District of Columbia': 'DC', 'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY' };

// Disposition side: the "big companies" that buy below-market SFR, with their public
// buy-box. A deal that fits a box = a place to assign/sell it to. Own nothing; a
// licensed human executes the contract/assignment (the legal sign-off).
var BUYERS = [
  { name: 'HomeVestors (We Buy Ugly Houses)', type: 'Cash buyer', states: 'ALL', min: 20000, max: 400000, minBeds: 0, note: 'Any condition, fast cash, national franchises', url: 'https://www.homevestors.com/sell-your-house/' },
  { name: 'Sundae', type: 'Cash marketplace', states: ['AZ', 'CA', 'CO', 'FL', 'GA', 'NV', 'SC', 'TN', 'TX', 'UT', 'WA'], min: 30000, max: 600000, minBeds: 0, note: 'As-is marketplace, multiple investor bids', url: 'https://sundae.com/sell/' },
  { name: 'Invitation Homes', type: 'SFR fund', states: ['AZ', 'CA', 'CO', 'FL', 'GA', 'IL', 'MN', 'NV', 'NC', 'SC', 'TN', 'TX', 'WA'], min: 180000, max: 500000, minBeds: 3, note: 'Buy-and-hold SFR, Sun Belt, rent-ready or light rehab', url: 'https://www.invitationhomes.com/' },
  { name: 'American Homes 4 Rent', type: 'SFR fund', states: ['AZ', 'FL', 'GA', 'NC', 'SC', 'TN', 'TX', 'NV', 'OH', 'IN', 'OK', 'AL', 'MO'], min: 140000, max: 400000, minBeds: 3, note: 'SFR buy-and-hold', url: 'https://www.amh.com/' },
  { name: 'Progress Residential', type: 'SFR fund', states: ['AZ', 'FL', 'GA', 'NC', 'SC', 'TN', 'TX', 'NV', 'AL', 'IN', 'OH', 'OK'], min: 130000, max: 400000, minBeds: 3, note: 'SFR buy-and-hold, Sun Belt', url: 'https://rentprogress.com/' },
  { name: 'Tricon Residential', type: 'SFR fund', states: ['AZ', 'FL', 'GA', 'NC', 'SC', 'TN', 'TX', 'NV'], min: 180000, max: 400000, minBeds: 3, note: 'SFR buy-and-hold', url: 'https://www.triconresidential.com/' },
  { name: 'FirstKey Homes', type: 'SFR fund', states: ['AL', 'FL', 'GA', 'NC', 'SC', 'TN', 'TX', 'OH', 'IN', 'OK', 'MO'], min: 100000, max: 350000, minBeds: 3, note: 'SFR buy-and-hold, Southeast/Midwest', url: 'https://firstkeyhomes.com/' },
  { name: 'Amherst / Main Street Renewal', type: 'SFR fund', states: ['AL', 'FL', 'GA', 'NC', 'SC', 'TN', 'TX', 'OH', 'IN', 'OK', 'MO', 'AZ'], min: 100000, max: 350000, minBeds: 3, note: 'SFR buy-and-hold', url: 'https://www.amherst.com/' },
  { name: 'Opendoor', type: 'iBuyer', states: ['AZ', 'TX', 'FL', 'GA', 'NC', 'SC', 'TN', 'NV', 'CO', 'UT', 'OH'], min: 100000, max: 600000, minBeds: 2, note: 'Instant offer, near-market condition preferred', url: 'https://www.opendoor.com/sell' },
  { name: 'Offerpad', type: 'iBuyer', states: ['AZ', 'TX', 'FL', 'GA', 'NC', 'SC', 'TN', 'NV', 'CO', 'AL'], min: 100000, max: 500000, minBeds: 2, note: 'Instant offer, lighter rehab', url: 'https://www.offerpad.com/' }
];
// price = the figure a disposition buyer underwrites to; beds may be unknown (RA).
function matchBuyersFor(state, price, beds) {
  var bd = (beds == null || beds === '') ? null : (parseInt(beds, 10) || 0);
  return BUYERS.filter(function (b) {
    var stOk = b.states === 'ALL' || b.states.indexOf(state) !== -1;
    var priceOk = price >= b.min && price <= b.max;
    var bedsOk = !b.minBeds || bd == null || bd >= b.minBeds; // unknown beds don't exclude
    return stOk && priceOk && bedsOk;
  }).map(function (b) { return { name: b.name, type: b.type, note: b.note, url: b.url }; });
}
function matchBuyers(d) { return matchBuyersFor(d.state, d.price, d.beds); }

// RealAuction distress supply (county foreclosure calendars, scraped by the cron
// worker → POSTed to /api/realauction-ingest → Redis). Match disposition buyers on
// the APPRAISED market value (resale target), not the judgment (acquisition cost).
async function readRealAuction(q) {
  var deals = (await db.get('realauction:deals')) || [];
  var meta = (await db.get('realauction:meta')) || null;
  var st = q.state ? String(q.state).toUpperCase() : null;
  var out = deals.filter(function (d) {
    if (st && (d.state || 'FL').toUpperCase() !== st) return false;
    return true;
  }).map(function (d) {
    return Object.assign({}, d, { buyers: matchBuyersFor(d.state || 'FL', d.marketValue || d.judgment || 0, null) });
  });
  return { updatedMs: meta && meta.updatedMs, source: 'RealAuction (county foreclosure calendars)', meta: meta, count: out.length, deals: out };
}

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
  deals.forEach(function (d) { d.buyers = matchBuyers(d); });
  return deals;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'private, no-store');
  var q = {}; try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  // ADMIN-ONLY. This is our arbitrage engine, never public. Gated by LEAD_ADMIN_KEY (?key=).
  var ADMIN = process.env.LEAD_ADMIN_KEY || '';
  if (ADMIN && q.key !== ADMIN) { res.statusCode = 403; res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ ok: false, error: 'Admin key required. This engine is not public.' })); }

  // RealAuction distress source (Redis, fed by the scraper cron). ?source=realauction
  // returns only county-foreclosure deals; ?source=all merges them ahead of HUD.
  if (q.source === 'realauction') {
    var ra = await readRealAuction(q);
    return j(res, 200, Object.assign({ ok: true }, ra));
  }

  var cities, key, zipCity = null, zipSt = null;
  if (q.zip) {
    try {
      var z = await (await fetch('https://api.zippopotam.us/us/' + encodeURIComponent(String(q.zip).replace(/[^0-9]/g, '').slice(0, 5)), { headers: { 'User-Agent': UA['User-Agent'] } })).json();
      var pl = (z && z.places && z.places[0]) || null;
      if (pl) { zipSt = (NAME2ABBR[pl.state] || pl['state abbreviation'] || '').toUpperCase(); zipCity = pl['place name']; }
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

  // ?source=all → prepend RealAuction distress deals (ranked by equity) to HUD.
  if (q.source === 'all') {
    try {
      var raAll = await readRealAuction(q);
      return j(res, 200, Object.assign({ ok: true }, data, {
        source: 'RealAuction + HUD', realauction: raAll.count, realauctionMeta: raAll.meta,
        deals: raAll.deals.concat(data.deals || [])
      }));
    } catch (e) {}
  }
  return j(res, 200, Object.assign({ ok: true }, data));
};
