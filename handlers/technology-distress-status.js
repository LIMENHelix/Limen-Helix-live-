/**
 * technology-distress-status.js — per-deal CRM state for the Technology distress desk. The operator
 * tracks New -> Contacted -> Feed sent -> Deal -> Closed / Dead. Mirrors finance-distress-status.
 *
 * GET  ?key= -> { ok, statuses: { <dealKey>: {status,note,revenue,updatedMs,closedMs} } }
 * POST { key, dealKey, status?, note?, revenue? } -> upsert. Admin-only (LEAD_ADMIN_KEY).
 */
var db = require('../lib/limen-db');
var SKEY = 'technology:distress:status';
function j(res, c, o) { res.statusCode = c; res.setHeader('content-type', 'application/json'); res.setHeader('Cache-Control', 'private, no-store'); res.end(JSON.stringify(o)); }
function readBody(req) { return new Promise(function (r) { var b = ''; req.on('data', function (c) { b += c; if (b.length > 2e6) req.destroy(); }); req.on('end', function () { try { r(JSON.parse(b || '{}')); } catch (e) { r({}); } }); req.on('error', function () { r({}); }); }); }

module.exports = async function handler(req, res) {
  var ADMIN = process.env.LEAD_ADMIN_KEY || '';
  var q = {}; try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  var method = (req.method || 'GET').toUpperCase();
  var body = method === 'POST' ? await readBody(req) : {};
  if (ADMIN && (q.key || body.key) !== ADMIN) return j(res, 403, { ok: false, error: 'Admin key required. Not public.' });

  var st = (await db.get(SKEY)) || {};
  if (method === 'POST') {
    var k = body.dealKey;
    if (!k) return j(res, 400, { ok: false, error: 'dealKey required' });
    var cur = st[k] || {};
    if (body.status != null) cur.status = String(body.status);
    if (body.note != null) cur.note = String(body.note).slice(0, 500);
    if (body.revenue != null) cur.revenue = Number(body.revenue) || 0;
    cur.updatedMs = Date.now();
    if (cur.status === 'closed' && !cur.closedMs) cur.closedMs = Date.now();
    if (cur.status !== 'closed') cur.closedMs = null;
    st[k] = cur;
    await db.set(SKEY, st);
  }
  return j(res, 200, { ok: true, statuses: st });
};
