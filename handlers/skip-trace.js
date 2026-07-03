/**
 * skip-trace.js — GATED server-side skip trace (key never leaves Vercel).
 *
 * The BatchData API key lives in the Vercel env on limen-helix-live (server-side).
 * This endpoint reads it, runs Skip Tracing V3 on owner records, and returns a
 * call/text list. Admin-only (LEAD_ADMIN_KEY). Costs real money per trace, so:
 *   ?check=1   → report whether the key is readable (NO trace, NO cost)
 *   ?probe=1   → trace exactly ONE record and return the raw response (~$0.07) so we
 *                confirm BatchData's schema before spending on the batch
 *   POST {records:[...], limit} → trace up to `limit` (default 1, hard cap 200)
 *
 * Results are cached in Redis by parcel (skiptrace:<parcel>, 30d) so re-runs never
 * re-charge. ?fresh=1 forces a re-trace.
 *
 * COMPLIANCE: BatchData skip trace returns DNC flags per phone where available; we
 * surface them. Scrub against the National DNC list + keep texts manual before dialing.
 */
var db = require('../lib/limen-db');

var KEY_NAMES = ['BATCHDATA_API_KEY', 'SKIPTRACE_KEY', 'BATCHDATA_KEY', 'BATCH_DATA_KEY'];
// v3 endpoint confirmed live for the property-skip-trace-v3 scope (v1 path 403s that scope).
var TRACE_URL = process.env.SKIPTRACE_URL || 'https://api.batchdata.com/api/v3/property/skip-trace';
var CACHE_TTL = 30 * 24 * 3600;
var HARD_CAP = 200;

function apiKey() { for (var i = 0; i < KEY_NAMES.length; i++) { if (process.env[KEY_NAMES[i]]) return { name: KEY_NAMES[i], val: process.env[KEY_NAMES[i]] }; } return null; }
function j(res, code, o) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('Cache-Control', 'private, no-store'); res.end(JSON.stringify(o)); }
function readBody(req) { return new Promise(function (r) { var b = ''; req.on('data', function (c) { b += c; if (b.length > 4e6) req.destroy(); }); req.on('end', function () { try { r(JSON.parse(b || '{}')); } catch (e) { r({}); } }); req.on('error', function () { r({}); }); }); }

var PHONE_RE = /(?:\+?1[-.\s]?)?\(?([2-9]\d{2})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})\b/g;
var EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// recursively pull phones (with dnc flag if the enclosing object has one) + emails
function harvest(node, phones, emails) {
  if (node == null) return;
  if (typeof node === 'string') { var m; PHONE_RE.lastIndex = 0; while ((m = PHONE_RE.exec(node))) phones[m[1] + m[2] + m[3]] = phones[m[1] + m[2] + m[3]] || {}; var e = node.match(EMAIL_RE); if (e) e.forEach(function (x) { emails[x.toLowerCase()] = 1; }); return; }
  if (typeof node === 'number') { var s = String(node); if (/^[2-9]\d{9}$/.test(s)) phones[s] = phones[s] || {}; return; }
  if (Array.isArray(node)) { node.forEach(function (n) { harvest(n, phones, emails); }); return; }
  if (typeof node === 'object') {
    // capture a phone object with its dnc/type metadata
    var num = node.number || node.phoneNumber || node.phone;
    if (num && /\d{7}/.test(String(num))) {
      var digits = String(num).replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
      if (/^[2-9]\d{9}$/.test(digits)) phones[digits] = { dnc: node.dnc === true || node.doNotCall === true, type: node.type || node.phoneType || '', tested: node.tested };
    }
    Object.keys(node).forEach(function (k) { harvest(node[k], phones, emails); });
  }
}

// FL statewide cadastral: owner name + mailing (free) — used when a record lacks owner
async function ownerFor(parcel) {
  var pid = String(parcel || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase(); if (!pid) return null;
  var url = 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query?where=' +
    encodeURIComponent("PARCEL_ID='" + pid + "'") + '&outFields=' + encodeURIComponent('OWN_NAME,OWN_ADDR1,OWN_CITY,OWN_STATE,OWN_ZIPCD') + '&returnGeometry=false&f=json';
  try { var a = (await (await fetch(url)).json()).features[0].attributes; return { name: a.OWN_NAME, mailAddr: a.OWN_ADDR1, mailCity: a.OWN_CITY, mailState: a.OWN_STATE, mailZip: String(a.OWN_ZIPCD || '').slice(0, 5) }; } catch (e) { return null; }
}

async function traceOne(rec, key, url) {
  var body = { requests: [{ propertyAddress: { street: rec.street, city: rec.city, state: rec.state || 'FL', zip: rec.zip } }] };
  var r = await fetch(url || TRACE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Bearer ' + key }, body: JSON.stringify(body) });
  var text = await r.text(); var json; try { json = JSON.parse(text); } catch (e) { json = text; }
  var phones = {}, emails = {}; harvest(json, phones, emails);
  var list = Object.keys(phones).map(function (p) { return { number: '(' + p.slice(0, 3) + ') ' + p.slice(3, 6) + '-' + p.slice(6), dnc: !!phones[p].dnc, type: phones[p].type || '' }; });
  return { ok: r.ok, status: r.status, phones: list, emails: Object.keys(emails), raw: json };
}

module.exports = async function handler(req, res) {
  var ADMIN = process.env.LEAD_ADMIN_KEY || '';
  var q = {}; try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  if (ADMIN && q.key !== ADMIN) return j(res, 403, { ok: false, error: 'Admin key required. Not public.' });

  var k = apiKey();

  // no-cost key check
  if (q.check === '1') return j(res, 200, { ok: true, keyFound: !!k, envVar: k ? k.name : null, checked: KEY_NAMES, traceUrl: TRACE_URL });

  if (!k) return j(res, 400, { ok: false, error: 'No skip-trace API key in env. Set one of: ' + KEY_NAMES.join(', ') });

  var body = {}; if ((req.method || 'GET').toUpperCase() === 'POST') body = await readBody(req);
  var records = Array.isArray(body.records) ? body.records : [];

  // if no records posted, pull from Redis realauction:deals (optionally ?county=)
  if (!records.length) {
    var deals = (await db.get('realauction:deals')) || [];
    if (q.county) deals = deals.filter(function (d) { return (d.county || '').toLowerCase() === String(q.county).toLowerCase(); });
    records = deals.sort(function (a, b) { return (b.equity || 0) - (a.equity || 0); });
  }
  if (!records.length) return j(res, 200, { ok: true, note: 'No records (post {records:[...]} or seed realauction:deals).', traced: 0, list: [] });

  var limit = q.probe === '1' ? 1 : Math.min(parseInt(body.limit || q.limit || '1', 10) || 1, HARD_CAP);
  records = records.slice(0, limit);

  var out = [], sample = null, spent = 0;
  for (var i = 0; i < records.length; i++) {
    var d = records[i];
    var cacheK = 'skiptrace:' + (d.parcel || d.street);
    var contact = q.fresh === '1' ? null : await db.get(cacheK);
    if (!contact) {
      // ensure owner
      var owner = d.owner || (d.parcel ? await ownerFor(d.parcel) : null);
      var t = await traceOne(d, k.val, q.traceUrl); spent++;
      if (i === 0 && (q.probe === '1' || q.debug === '1')) sample = t.raw;
      if (!t.ok) { out.push({ property: d.street, error: 'HTTP ' + t.status, owner: owner && owner.name }); continue; }
      contact = { owner: owner, phones: t.phones, emails: t.emails, ts: Date.now() };
      await db.set(cacheK, contact, CACHE_TTL);
    }
    out.push({
      equity: d.equity, saleDate: d.saleDate, owner: contact.owner && contact.owner.name, absentee: d.owner && d.owner.absentee,
      phones: contact.phones, emails: contact.emails,
      property: (d.street || '') + ', ' + (d.city || '') + ' ' + (d.zip || ''),
      mailing: contact.owner ? [contact.owner.mailAddr, contact.owner.mailCity, contact.owner.mailState, contact.owner.mailZip].filter(Boolean).join(', ') : ''
    });
  }
  return j(res, 200, { ok: true, traced: out.length, charged: spent, withPhone: out.filter(function (x) { return x.phones && x.phones.length; }).length, list: out, sample: sample });
};
