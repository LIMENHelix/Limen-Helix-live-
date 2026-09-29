/**
 * api/homestead-read.js — Homestead Read: ZIP or street → educational stage clock.
 *
 *   GET  /api/homestead-read
 *   POST /api/homestead-read  { q, notice? }
 *
 * Place is a public lookup (Zippopotam for ZIP, Census geocoder for street).
 * Stage is educational from the notice the visitor named. Never an auction date.
 *
 * Domain firewall: Economy / Homestead only. No outbound spend.
 */
'use strict';

var T = require('../lib/tool-fetch');
var H = require('../lib/homestead-read');

var UA = 'LIMEN-Helix/1.0 (limenhelix.com Homestead Read)';

function queryOf(req) {
  if (req.query && typeof req.query === 'object' && !Array.isArray(req.query)) return req.query;
  try {
    var u = new URL(req.url, 'http://localhost');
    var out = {};
    u.searchParams.forEach(function (v, k) { out[k] = v; });
    return out;
  } catch (e) { return {}; }
}

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    var data = '';
    req.on('data', function (c) { data += c; if (data.length > 8000) data = data.slice(0, 8000); });
    req.on('end', function () { try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); } });
    req.on('error', function () { resolve({}); });
  });
}

function idle() {
  return {
    ok: true,
    mode: 'idle',
    educational: true,
    validated: false,
    inventedAuctionDate: false,
    noticeOptions: [
      { id: 'unsure', label: 'Not sure / just looking' },
      { id: 'none', label: 'Nothing filed that I know of' },
      { id: 'late', label: 'Late notices / collection calls' },
      { id: 'nod', label: 'Notice of Default (or equivalent)' },
      { id: 'sale', label: 'Sale / auction notice' },
      { id: 'sold', label: 'I think it already sold' }
    ],
    disclaimer: H.DISCLAIMER,
    note: 'Enter a ZIP or street address. We resolve the place from public sources and map an educational stage from what you say you received. We do not invent auction dates.'
  };
}

async function lookupZip(zip) {
  var r = await T.getJSON('https://api.zippopotam.us/us/' + encodeURIComponent(zip), 8000, { 'User-Agent': UA });
  if (r.status !== 200 || !r.body || !Array.isArray(r.body.places) || !r.body.places[0]) {
    return { ok: false, reason: 'That ZIP did not resolve. Check the five digits and try again.' };
  }
  var pl = r.body.places[0];
  return {
    ok: true,
    zip: zip,
    place: pl['place name'] || '',
    state: pl['state abbreviation'] || pl.state || '',
    stateName: pl.state || '',
    county: null,
    source: 'Zippopotam.us (public postal lookup)',
    sourceUrl: 'https://api.zippopotam.us/'
  };
}

async function lookupStreet(q) {
  var url = 'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress'
    + '?address=' + encodeURIComponent(q)
    + '&benchmark=Public_AR_Current&vintage=Current_Current&format=json';
  var r = await T.getJSON(url, 12000, { 'User-Agent': UA });
  var matches = r.body && r.body.result && r.body.result.addressMatches;
  if (r.status !== 200 || !Array.isArray(matches) || !matches[0]) {
    return { ok: false, reason: 'The Census geocoder did not match that street. Try a ZIP, or a fuller address (street, city, state).' };
  }
  var m = matches[0];
  var comps = m.addressComponents || {};
  var geos = m.geographies || {};
  var counties = geos.Counties || geos['Counties'] || [];
  var county = (counties[0] && (counties[0].NAME || counties[0].BASENAME)) || null;
  var zip = comps.zip || H.extractZip(q) || '';
  return {
    ok: true,
    zip: zip,
    place: comps.city || m.matchedAddress || '',
    state: comps.state || '',
    stateName: null,
    county: county,
    matchedAddress: m.matchedAddress || null,
    source: 'U.S. Census Bureau geocoder',
    sourceUrl: 'https://geocoding.geo.census.gov/',
    note: 'This is a place match, not a parcel or foreclosure-docket search.'
  };
}

async function resolvePlace(qRaw) {
  var q = String(qRaw || '').trim().slice(0, 160);
  if (!q) return { ok: false, reason: 'Enter a ZIP or street address.' };
  var zip = H.extractZip(q);
  if (zip && !H.looksLikeStreet(q)) return lookupZip(zip);
  if (H.looksLikeStreet(q)) {
    var street = await lookupStreet(q);
    if (street.ok) return street;
    if (zip) return lookupZip(zip);
    return street;
  }
  if (zip) return lookupZip(zip);
  return { ok: false, reason: 'Enter a 5-digit ZIP or a street address we can geocode.' };
}

module.exports = async function handler(req, res) {
  try {
    var method = String(req.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'POST') {
      return T.send(res, { ok: false, reason: 'GET or POST only' }, 405);
    }
    var q = queryOf(req);
    var body = method === 'POST' ? await readBody(req) : {};
    var query = body.q || body.zip || body.address || q.q || q.zip || q.address || '';
    var notice = body.notice || q.notice || 'unsure';
    if (!String(query).trim()) return T.send(res, idle());

    var place = await resolvePlace(query);
    if (!place.ok) return T.send(res, Object.assign({ educational: true, validated: false, inventedAuctionDate: false }, place));

    var read = H.clock(notice, {
      zip: place.zip,
      place: place.place,
      state: place.state,
      stateName: place.stateName,
      county: place.county,
      matchedAddress: place.matchedAddress || null
    });
    read.query = String(query).trim().slice(0, 160);
    read.placeSource = place.source;
    read.placeSourceUrl = place.sourceUrl;
    if (place.note) read.placeNote = place.note;
    return T.send(res, read);
  } catch (e) {
    return T.send(res, { ok: false, reason: e.message || 'homestead-read error', educational: true, inventedAuctionDate: false }, 500);
  }
};
