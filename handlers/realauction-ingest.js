/**
 * realauction-ingest.js — private write/read bridge for the RealAuction scraper.
 *
 * The scraper (scripts/realauction-scrape.js, run by a GitHub Action cron) can't
 * touch Vercel's Redis directly without duplicating Upstash creds into GitHub. So
 * it POSTs the scraped distress deals here; this endpoint (which already has the
 * Vercel Upstash env) stores them. A POST to /api/* also bypasses the Vercel
 * Security Checkpoint that 403s browser GETs. Gated by LEAD_ADMIN_KEY — never public.
 *
 * POST body: { key, deals:[...], meta:{...} }  -> stores realauction:deals + :meta
 * GET  ?key=  -> returns the currently stored deals + meta (Deal Desk / debug)
 */
var db = require('../lib/limen-db');
var TTL = 60 * 60 * 30; // 30h — a daily cron keeps it fresh; stale falls off

function j(res, code, o) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.setHeader('Cache-Control', 'private, no-store');
  res.end(JSON.stringify(o));
}
function readBody(req) {
  return new Promise(function (resolve) {
    var b = '';
    req.on('data', function (c) { b += c; if (b.length > 5e6) req.destroy(); });
    req.on('end', function () { try { resolve(JSON.parse(b || '{}')); } catch (e) { resolve({}); } });
    req.on('error', function () { resolve({}); });
  });
}

module.exports = async function handler(req, res) {
  var ADMIN = process.env.LEAD_ADMIN_KEY || '';
  var q = {}; try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  var method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    if (ADMIN && q.key !== ADMIN) return j(res, 403, { ok: false, error: 'Admin key required. Not public.' });
    var deals = (await db.get('realauction:deals')) || [];
    var meta = (await db.get('realauction:meta')) || null;
    return j(res, 200, { ok: true, count: deals.length, meta: meta, deals: deals });
  }

  if (method === 'POST') {
    var body = await readBody(req);
    var key = (body && body.key) || q.key;
    if (ADMIN && key !== ADMIN) return j(res, 403, { ok: false, error: 'Admin key required. Not public.' });
    var deals = body && body.deals;
    if (!Array.isArray(deals)) return j(res, 400, { ok: false, error: 'deals[] required' });
    var meta = (body && body.meta) || { updatedMs: Date.now(), total: deals.length };
    meta.total = deals.length;
    await db.set('realauction:deals', deals, TTL);
    await db.set('realauction:meta', meta, TTL);
    return j(res, 200, { ok: true, stored: deals.length });
  }

  return j(res, 405, { ok: false, error: 'method not allowed' });
};
