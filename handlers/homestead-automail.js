/**
 * homestead-automail.js — the ARM SWITCH for autonomous outreach.
 *
 * The pattern (generalizes to every domain/business): the machinery is fully wired,
 * but it only ACTS when the operator flips this switch. Off = dormant. On = the daily
 * job mails the top work-first sellers. The operator toggles it from /admin-homestead.
 *
 * GET  ?key=  -> { armed, cap, mailedTotal, lastRunMs, mailedKeys[], hasLobKey }
 * POST { key, armed?:bool, cap?:int }              -> operator toggles the switch
 * POST { key, run:{ mailed:[keys], count } }        -> executor records a run (dedupe + count)
 * Admin-only (LEAD_ADMIN_KEY). LOB key never leaves the server.
 */
var db = require('../lib/limen-db');
var STATE = 'homestead:automail', MAILED = 'homestead:mailed';

function j(res, c, o) { res.statusCode = c; res.setHeader('content-type', 'application/json'); res.setHeader('Cache-Control', 'private, no-store'); res.end(JSON.stringify(o)); }
function readBody(req) { return new Promise(function (r) { var b = ''; req.on('data', function (c) { b += c; if (b.length > 2e6) req.destroy(); }); req.on('end', function () { try { r(JSON.parse(b || '{}')); } catch (e) { r({}); } }); req.on('error', function () { r({}); }); }); }

module.exports = async function handler(req, res) {
  var ADMIN = process.env.LEAD_ADMIN_KEY || '';
  var q = {}; try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  var method = (req.method || 'GET').toUpperCase();
  var body = method === 'POST' ? await readBody(req) : {};
  var key = q.key || body.key;
  if (ADMIN && key !== ADMIN) return j(res, 403, { ok: false, error: 'Admin key required. Not public.' });

  var st = (await db.get(STATE)) || { armed: false, cap: 20, mailedTotal: 0, lastRunMs: null };

  if (method === 'POST') {
    if (typeof body.armed === 'boolean') st.armed = body.armed;
    if (body.cap != null) st.cap = Math.max(1, Math.min(200, parseInt(body.cap, 10) || 20));
    if (body.run && Array.isArray(body.run.mailed)) {
      var mailed = (await db.get(MAILED)) || {};
      body.run.mailed.forEach(function (k) { if (k) mailed[k] = Date.now(); });
      await db.set(MAILED, mailed);
      st.mailedTotal = (st.mailedTotal || 0) + (body.run.count || body.run.mailed.length);
      st.lastRunMs = Date.now();
    }
    await db.set(STATE, st);
  }

  var m = (await db.get(MAILED)) || {};
  return j(res, 200, {
    ok: true, armed: !!st.armed, cap: st.cap || 20,
    mailedTotal: st.mailedTotal || 0, lastRunMs: st.lastRunMs || null,
    mailedKeys: Object.keys(m), hasLobKey: !!(process.env.LOB_API_KEY)
  });
};
