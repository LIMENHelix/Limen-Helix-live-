/**
 * api/relay-margin — Relay's markup, stored in LIMEN's db so the cockpit controls it.
 *
 * GET  /api/relay-margin                       → { margin }   (public read)
 * GET  /api/relay-margin?set=0.40&key=SECRET   → sets margin, returns { ok, margin }
 *
 * RESTORED 2026-08-30. Commit 5a0d0ea4 replaced this API with a page-server, which
 * deleted the only way to read or write the margin, and then a follow-up pointed that
 * page-server at a path that does not exist, so the route returned 500. Two things were
 * broken by that: the slider on /relay-margin could neither load nor save, and
 * relay-engine had no margin to price against. The page is served as a static file at
 * /relay-margin, so this route is the API again, which is what every caller expects.
 *
 * Write is gated by RELAY_MARGIN_KEY. No committed fallback: writes fail closed when
 * the env var is unset.
 */

var db = require('../lib/limen-db');

var KEY = 'relay_margin';
var DEFAULT = 0.35;
var SECRET = process.env.RELAY_MARGIN_KEY || '';

function sendJSON(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(obj));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if ((req.method || 'GET') === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  var q = {};
  try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}

  // ── write (gated) ──
  if (q.set != null) {
    if (!SECRET || q.key !== SECRET) return sendJSON(res, 403, { error: 'forbidden' });
    var m = parseFloat(q.set);
    if (!isFinite(m) || m < 0 || m > 5) {
      return sendJSON(res, 400, { error: 'margin must be 0-5 (e.g. 0.35 = 35%)' });
    }
    try { await db.set(KEY, m); } catch (e) { return sendJSON(res, 500, { error: 'store failed' }); }
    return sendJSON(res, 200, { ok: true, margin: m });
  }

  // ── read ──
  var cur = null;
  try { cur = await db.get(KEY); } catch (e) {}
  var margin = (typeof cur === 'number' && isFinite(cur)) ? cur : DEFAULT;
  return sendJSON(res, 200, { margin: margin, source: (typeof cur === 'number') ? 'db' : 'default' });
};
