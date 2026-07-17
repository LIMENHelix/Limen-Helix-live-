'use strict';
/**
 * town-enum.js — enumerate the businesses in a US town from OpenStreetMap.
 *
 * Free, read-only. Geocodes the town to a bounding box (Nominatim), then pulls
 * commercial shop/craft/office/amenity features in that box (Overpass). Returns
 * one seed per business with its OSM-tagged contact fields (geo-placed, so
 * location-correct) plus the town's local phone area codes (self-calibrated
 * from those tags) so a caller can reject wrong-location enrichment matches.
 *
 * Shared by scripts/enrich-town.mjs (CLI) and handlers/leadgen.js (the /admin
 * "enrich a town" button). Contacts no one; performs no enrichment itself.
 */

// Amenity values that are actual businesses. Worship/school/government/civic
// are excluded — not a sales lead.
var COMMERCIAL_AMENITY = new Set([
  'restaurant', 'fast_food', 'cafe', 'bar', 'pub', 'biergarten', 'food_court', 'ice_cream',
  'bank', 'pharmacy', 'fuel', 'car_wash', 'car_rental', 'car_repair', 'charging_station',
  'dentist', 'doctors', 'clinic', 'veterinary', 'childcare', 'kindergarten',
  'cinema', 'nightclub', 'casino', 'marketplace', 'fitness_centre', 'bureau_de_change'
]);
var EXCLUDE_OFFICE = new Set(['government', 'diplomatic', 'political_party', 'ngo', 'quango']);

function isBusiness(t) {
  if (!t || !t.name) return false;
  if (t.shop || t.craft) return true;
  if (t.office && !EXCLUDE_OFFICE.has(t.office)) return true;
  if (t.amenity && COMMERCIAL_AMENITY.has(t.amenity)) return true;
  return false;
}

function osmAddress(t, city, state) {
  var hn = t['addr:housenumber'], st = t['addr:street'];
  if (!hn || !st) return '';
  var c = t['addr:city'] || city, s = t['addr:state'] || state, z = t['addr:postcode'] || '';
  return (hn + ' ' + st + ', ' + c + ', ' + s + (z ? ' ' + z : '')).trim();
}

function areaCode(phone) {
  var p = String(phone || '').replace(/[^\d]/g, '');
  if (p.length === 11 && p[0] === '1') p = p.slice(1);
  if (p.length !== 10) return '';
  if (p[0] === '0' || p[0] === '1') return ''; // invalid NANP area code
  return p.slice(0, 3);
}
function isTollFree(ac) { return /^8(00|33|44|55|66|77|88)$/.test(ac); }

function withTimeout(ms) {
  try { if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) return { signal: AbortSignal.timeout(ms) }; } catch (e) { /* older runtime */ }
  return {};
}

var UA = 'LIMEN-enrich/1.0 (chrishubbel72@gmail.com)';

async function geocodeBbox(city, state, fetchImpl) {
  var url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&country=USA&state='
    + encodeURIComponent(state) + '&city=' + encodeURIComponent(city);
  var r = await fetchImpl(url, Object.assign({ headers: { 'user-agent': UA } }, withTimeout(12000)));
  if (!r || !r.ok) throw new Error('geocode failed (' + (r && r.status) + ')');
  var d = await r.json();
  if (!d.length || !d[0].boundingbox) throw new Error('town not found: ' + city + ', ' + state);
  var bb = d[0].boundingbox.map(Number); // [south, north, west, east]
  return { south: bb[0], north: bb[1], west: bb[2], east: bb[3] };
}

async function overpass(box, fetchImpl) {
  var q = '[out:json][timeout:40];('
    + 'nwr["shop"](' + box + ');'
    + 'nwr["craft"](' + box + ');'
    + 'nwr["office"](' + box + ');'
    + 'nwr["amenity"](' + box + ');'
    + ');out tags 2000;';
  // Overpass mirrors return 429/504 when busy — common and usually transient.
  // Try both mirrors, up to 3 rounds with a short backoff, before giving up.
  var hosts = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  var ROUNDS = 3;
  for (var round = 0; round < ROUNDS; round++) {
    for (var i = 0; i < hosts.length; i++) {
      try {
        var r = await fetchImpl(hosts[i], Object.assign({
          method: 'POST',
          headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(q)
        }, withTimeout(45000)));
        if (!r || !r.ok) continue; // 429/504/etc -> next mirror
        var d = await r.json();
        return d.elements || [];
      } catch (e) { /* next mirror */ }
    }
    if (round < ROUNDS - 1) await new Promise(function (res) { setTimeout(res, 1500 * (round + 1)); });
  }
  return null; // all mirrors busy across every round
}

// Enumerate. Returns { city, state, count, localAreas:[...], businesses:[
//   { name, category, website, email, phone, address } ] } — contact fields are
// the OSM tags only (no enrichment). `cap` bounds the list. Throws on geocode
// failure; returns null businesses list on total Overpass failure.
async function enumerateTown(city, state, opts) {
  opts = opts || {};
  var fetchImpl = opts.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!fetchImpl) throw new Error('no fetch');
  var cap = opts.cap != null ? opts.cap : 400;

  var box = await geocodeBbox(city, state, fetchImpl);
  var els = await overpass(box.south + ',' + box.west + ',' + box.north + ',' + box.east, fetchImpl);
  if (els == null) return { city: city, state: state, count: 0, localAreas: [], businesses: [], overpassFailed: true };

  var biz = els.filter(function (e) { return isBusiness(e.tags); });
  var seen = {}, uniq = [];
  for (var i = 0; i < biz.length; i++) {
    var kkey = biz[i].tags.name.toLowerCase().trim();
    if (seen[kkey]) continue;
    seen[kkey] = 1; uniq.push(biz[i]);
  }
  uniq = uniq.slice(0, cap);

  var localAreas = {};
  for (var b = 0; b < uniq.length; b++) {
    var ac = areaCode(uniq[b].tags.phone || uniq[b].tags['contact:phone'] || uniq[b].tags['contact:mobile'] || '');
    if (ac && !isTollFree(ac)) localAreas[ac] = 1;
  }

  var businesses = uniq.map(function (e) {
    var t = e.tags;
    return {
      name: t.name,
      category: t.shop || t.craft || t.office || t.amenity || '',
      website: t.website || t['contact:website'] || '',
      email: t.email || t['contact:email'] || '',
      phone: t.phone || t['contact:phone'] || t['contact:mobile'] || '',
      address: osmAddress(t, city, state)
    };
  });

  return { city: city, state: state, count: businesses.length, localAreas: Object.keys(localAreas), businesses: businesses };
}

module.exports = {
  enumerateTown: enumerateTown,
  isBusiness: isBusiness,
  osmAddress: osmAddress,
  areaCode: areaCode,
  isTollFree: isTollFree,
  _COMMERCIAL_AMENITY: COMMERCIAL_AMENITY
};
