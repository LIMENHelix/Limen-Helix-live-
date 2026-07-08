/**
 * calendly-link.js — resolves the operator's Calendly scheduling URL from the Calendly API using the
 * token already in the environment, so sales pages can wire a "Book a call" button WITHOUT hardcoding
 * the link. GET /api/calendly-link -> { ok, url }. Cached 24h in Redis (the URL rarely changes).
 * Public (returns only the already-public scheduling URL, never the token).
 */
var db = require('../lib/limen-db');
var CACHE = 'calendly:url';
function j(res, c, o) { res.statusCode = c; res.setHeader('content-type', 'application/json'); res.setHeader('Cache-Control', 'public, max-age=3600'); res.end(JSON.stringify(o)); }

module.exports = async function handler(req, res) {
  try {
    var cached = await db.get(CACHE);
    if (cached && cached.url) return j(res, 200, { ok: true, url: cached.url, cached: true });
  } catch (e) {}
  var token = process.env.CALENDLY_API_KEY || process.env.CALENDLY_TOKEN || process.env.CALENDLY_PAT || process.env.CALENDLY_KEY || process.env.CALENDLY_PERSONAL_TOKEN || '';
  if (!token) return j(res, 200, { ok: false, error: 'Calendly token not configured', url: null });
  try {
    var r = await fetch('https://api.calendly.com/users/me', {
      headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(15000)
    });
    if (!r.ok) return j(res, 200, { ok: false, error: 'Calendly API ' + r.status, url: null });
    var data = await r.json();
    var url = data && data.resource && data.resource.scheduling_url;
    if (!url) return j(res, 200, { ok: false, error: 'no scheduling_url', url: null });
    try { await db.set(CACHE, { url: url }, 60 * 60 * 24); } catch (e) {}
    return j(res, 200, { ok: true, url: url });
  } catch (e) {
    return j(res, 200, { ok: false, error: String(e && e.message || e), url: null });
  }
};
