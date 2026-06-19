/**
 * api/energy-entry.js — public Energy Bill X-Ray data capture (anonymized).
 *
 * POST /api/energy-entry        (public)  → persist ONE anonymized energy reading.
 *                                           Opt-in only (client sends contribute:true).
 *                                           NO PII: ZIP is truncated to 3 digits, no
 *                                           name/email/address/full-ZIP ever stored.
 * GET  /api/energy-entry?key=KEY (admin)  → list readings (newest first).
 *
 * Storage mirrors handlers/lead.js: lib/limen-db (Upstash). Each reading at
 * `energy:<id>`; index at `energy_index` (LPUSH). Admin read requires
 * ENERGY_ADMIN_KEY (falls back to LEAD_ADMIN_KEY); no fallback = disabled.
 *
 * Guardrail: nothing here contacts anyone or moves money. It only persists an
 * anonymized reading the operator can aggregate into utility/region views.
 * Cost: ONE Redis write per opt-in submission (low volume) — unrelated to the
 * AI-token / polling costs that were parked.
 */
var db = require('../lib/limen-db');

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body !== undefined && req.body !== null) return resolve(req.body);
    var data = '';
    req.on('data', function (c) { data += c; });
    req.on('end', function () { resolve(data); });
    req.on('error', function () { resolve(''); });
  });
}

function clip(v, n) { return String(v == null ? '' : v).slice(0, n); }
function num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  var method = (req.method || 'GET').toUpperCase();

  // ── POST: anonymized reading (public, opt-in) ─────────────────────────
  if (method === 'POST') {
    var raw = await readBody(req);
    var body = raw;
    if (typeof raw === 'string') { try { body = JSON.parse(raw); } catch (e) { body = {}; } }
    if (!body || typeof body !== 'object') body = {};

    if (body.contribute !== true) {
      res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'contribute opt-in required' }));
    }
    var bill = num(body.bill), kwh = num(body.kwh);
    if (bill == null || kwh == null || kwh <= 0) {
      res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'bill and kwh (positive) required' }));
    }

    var zip3 = clip(body.zip, 5).replace(/[^0-9]/g, '').slice(0, 3); // k-anonymity: 3 digits only
    var id = 'E' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
    var reading = {
      id: id,
      ts: new Date().toISOString(),
      zip3: zip3,                              // region only — never full ZIP
      utility: clip(body.utility, 120),
      month: clip(body.month, 16),
      bill: Math.round(bill * 100) / 100,
      kwh: Math.round(kwh),
      effectiveRate: Math.round((bill / kwh) * 1000) / 10, // ¢/kWh
      billShock: num(body.billShock),
      ratePressure: num(body.ratePressure),
      usagePressure: num(body.usagePressure),
      outageCount: num(body.outageCount),
      allElectric: body.allElectric === true,
      homeSqft: num(body.homeSqft)
      // intentionally NO name/email/address/full-zip/user-agent
    };

    try {
      await db.set('energy:' + id, reading);
      await db.lpush('energy_index', id);
      var check = await db.get('energy:' + id);
      if (!check || check.id !== id) {
        res.statusCode = 500; return res.end(JSON.stringify({ ok: false, error: 'Write could not be confirmed.' }));
      }
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, id: id }));
    } catch (e) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: String(e && e.message || e) }));
    }
  }

  // ── GET: admin read (key-gated) ───────────────────────────────────────
  var u;
  try { u = new URL(req.url, 'http://x'); } catch (e) { u = { searchParams: new URLSearchParams('') }; }
  var key = u.searchParams.get('key') || '';
  var ADMIN_KEY = process.env.ENERGY_ADMIN_KEY || process.env.LEAD_ADMIN_KEY || '';
  if (!ADMIN_KEY) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ ok: false, error: 'Energy admin access not configured (ENERGY_ADMIN_KEY/LEAD_ADMIN_KEY unset).' }));
  }
  if (!key || key !== ADMIN_KEY) {
    res.statusCode = 403;
    return res.end(JSON.stringify({ ok: false, error: 'Valid admin key required (?key=).' }));
  }

  if (method === 'GET') {
    try {
      var ids = (await db.lrange('energy_index', 0, -1)) || [];
      var rows = [];
      for (var i = 0; i < ids.length; i++) {
        var r = await db.get('energy:' + ids[i]);
        if (r) rows.push(r);
      }
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, count: rows.length, readings: rows }, null, 2));
    } catch (e) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: String(e && e.message || e) }));
    }
  }

  res.statusCode = 405;
  return res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
};
