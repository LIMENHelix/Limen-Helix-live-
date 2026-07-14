/**
 * finance-distress-ingest.js — write/read bridge for the EDGAR distress worker (scripts/edgar-fetch.js).
 * Mirrors industry-ingest. Gated by LEAD_ADMIN_KEY. Stores finance:distress + finance:distress:meta.
 */
var db = require('../lib/limen-db');
// 45-day TTL: the feed is refreshed by a daily GitHub Actions cron, but scheduled runs
// get dropped/delayed. A 10-day TTL blanked the desk after a few missed runs; 45 days
// keeps the last-known feed visible while the cron recovers. Freshness is shown via meta.updatedMs.
var TTL = 60 * 60 * 24 * 45;
function j(res, c, o) { res.statusCode = c; res.setHeader('content-type', 'application/json'); res.setHeader('Cache-Control', 'private, no-store'); res.end(JSON.stringify(o)); }
function readBody(req) { return new Promise(function (r) { var b = ''; req.on('data', function (c) { b += c; if (b.length > 6e6) req.destroy(); }); req.on('end', function () { try { r(JSON.parse(b || '{}')); } catch (e) { r({}); } }); req.on('error', function () { r({}); }); }); }
module.exports = async function handler(req, res) {
  var ADMIN = process.env.LEAD_ADMIN_KEY || '';
  var q = {}; try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  var method = (req.method || 'GET').toUpperCase();
  if (method === 'GET') {
    if (!ADMIN || q.key !== ADMIN) return j(res, 403, { ok: false, error: 'Admin key required.' });
    return j(res, 200, { ok: true, count: ((await db.get('finance:distress')) || []).length, meta: (await db.get('finance:distress:meta')) || null, deals: (await db.get('finance:distress')) || [] });
  }
  if (method === 'POST') {
    var body = await readBody(req);
    if (!ADMIN || (body.key || q.key) !== ADMIN) return j(res, 403, { ok: false, error: 'Admin key required.' });
    if (!Array.isArray(body.deals)) return j(res, 400, { ok: false, error: 'deals[] required' });
    var meta = body.meta || { updatedMs: Date.now() }; meta.total = body.deals.length;
    await db.set('finance:distress', body.deals, TTL);
    await db.set('finance:distress:meta', meta, TTL);
    return j(res, 200, { ok: true, stored: body.deals.length });
  }
  return j(res, 405, { ok: false, error: 'method not allowed' });
};
