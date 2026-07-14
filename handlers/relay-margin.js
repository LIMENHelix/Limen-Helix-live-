/**
 * api/relay-margin — Relay (broker) margin control, stored in LIMEN's db.
 *
 * GET  /api/relay-margin                       → { margin }   (public read; the broker feed uses this)
 * GET  /api/relay-margin?set=0.40&key=SECRET   → sets margin, returns { ok, margin }   (gated)
 *
 * The margin lives in LIMEN so the cockpit (finance side) controls what the
 * storefront marks every item up by. Write is gated by RELAY_MARGIN_KEY.
 */

var db = require('../lib/limen-db');

var KEY = 'relay_margin';
var DEFAULT = 0.35;
var SECRET = process.env.RELAY_MARGIN_KEY || '';   // no committed fallback: writes fail closed when unset

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
    if (!isFinite(m) || m < 0 || m > 5) return sendJSON(res, 400, { error: 'margin must be 0–5 (e.g. 0.35 = 35%)' });
    try { await db.set(KEY, m); } catch (e) { return sendJSON(res, 500, { error: 'store failed' }); }
    return sendJSON(res, 200, { ok: true, margin: m });
  }

  // ── read ──
  var cur = null;
  try { cur = await db.get(KEY); } catch (e) {}
  var margin = (typeof cur === 'number' && isFinite(cur)) ? cur : DEFAULT;
  return sendJSON(res, 200, { margin: margin, source: (typeof cur === 'number') ? 'db' : 'default' });
};
