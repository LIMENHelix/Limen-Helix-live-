/**
 * industry-ingest.js — private write/read bridge for the WARN worker (scripts/warn-fetch.js).
 * The cron worker can't touch Redis directly, so it POSTs ranked WARN deals here. Mirrors
 * realauction-ingest. Gated by LEAD_ADMIN_KEY. Stores warn:deals + warn:meta.
 *
 * POST { key, deals:[...], meta } -> replace warn:deals
 * GET  ?key= -> current deals + meta
 */
var db = require('../lib/limen-db');
var TTL = 60 * 60 * 24 * 10; // WARN notices are dated events; 10-day freshness with a daily cron

function j(res, c, o) { res.statusCode = c; res.setHeader('content-type', 'application/json'); res.setHeader('Cache-Control', 'private, no-store'); res.end(JSON.stringify(o)); }
function readBody(req) { return new Promise(function (r) { var b = ''; req.on('data', function (c) { b += c; if (b.length > 5e6) req.destroy(); }); req.on('end', function () { try { r(JSON.parse(b || '{}')); } catch (e) { r({}); } }); req.on('error', function () { r({}); }); }); }

module.exports = async function handler(req, res) {
  var ADMIN = process.env.LEAD_ADMIN_KEY || '';
  var q = {}; try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  var method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    if (ADMIN && q.key !== ADMIN) return j(res, 403, { ok: false, error: 'Admin key required. Not public.' });
    return j(res, 200, { ok: true, count: ((await db.get('warn:deals')) || []).length, meta: (await db.get('warn:meta')) || null, deals: (await db.get('warn:deals')) || [] });
  }
  if (method === 'POST') {
    var body = await readBody(req);
    if (ADMIN && (body.key || q.key) !== ADMIN) return j(res, 403, { ok: false, error: 'Admin key required. Not public.' });
    if (!Array.isArray(body.deals)) return j(res, 400, { ok: false, error: 'deals[] required' });
    var meta = body.meta || { updatedMs: Date.now() }; meta.total = body.deals.length;
    await db.set('warn:deals', body.deals, TTL);
    await db.set('warn:meta', meta, TTL);
    return j(res, 200, { ok: true, stored: body.deals.length });
  }
  return j(res, 405, { ok: false, error: 'method not allowed' });
};
