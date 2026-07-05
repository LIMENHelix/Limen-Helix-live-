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

var tc = function (s) { return String(s || '').toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); }); };
function fmtDate(s) { var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || ''); var mo = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']; return m ? mo[+m[1] - 1] + ' ' + (+m[2]) + ', ' + m[3] : (s || 'soon'); }
function letterHTML(o, PHONE, NAME) {
  var addr = (o.street || o.address || 'your property') + (o.city ? ', ' + tc(o.city) : '');
  var body = 'Hello,<br><br>I work with homeowners in ' + (o.county || 'your') + ' County, and I noticed ' + addr + ' has a court sale scheduled for ' + fmtDate(o.saleDate) + '.<br><br>' +
    'If that date holds, the property is sold at auction — often for far less than it is worth, and any value above what is owed can be lost. Public records suggest ' + addr + ' may hold real equity worth protecting.<br><br>' +
    'You have options before that date. I can bring you a fair, no-obligation cash offer, so you can sell on your terms and walk away with money in hand instead of losing it at the sale. There is no fee, no pressure, and I am not your lender.<br><br>' +
    'If that is worth a quick conversation, call or text me at ' + (PHONE || '[phone]') + '.<br><br>' + (NAME || 'the Homestead team');
  return '<html><body style="font-family:Georgia,serif;font-size:12pt;line-height:1.6;padding:1in">' + body + '</body></html>';
}
async function lobSend(o, LOB, FROM, PHONE, NAME) {
  var au = 'Basic ' + Buffer.from(LOB + ':').toString('base64'), ow = o.owner || {}, f = new URLSearchParams();
  f.set('description', 'Homestead ' + (o.parcel || o.caseNumber || ''));
  f.set('to[name]', ow.name || 'Current Owner'); f.set('to[address_line1]', ow.mailAddr || o.street || '');
  f.set('to[address_city]', ow.mailCity || o.city || ''); f.set('to[address_state]', ow.mailState || 'FL'); f.set('to[address_zip]', String(ow.mailZip || o.zip || '').slice(0, 5));
  f.set('from[name]', FROM.name); f.set('from[address_line1]', FROM.line1); f.set('from[address_city]', FROM.city); f.set('from[address_state]', FROM.state); f.set('from[address_zip]', FROM.zip);
  f.set('file', letterHTML(o, PHONE, NAME)); f.set('color', 'false');
  try { var r = await fetch('https://api.lob.com/v1/letters', { method: 'POST', headers: { Authorization: au, 'Content-Type': 'application/x-www-form-urlencoded' }, body: f.toString() }); var jr = await r.json(); return { ok: r.ok, id: jr.id, err: jr.error }; }
  catch (e) { return { ok: false, err: String(e && e.message || e) }; }
}

module.exports = async function handler(req, res) {
  var ADMIN = process.env.LEAD_ADMIN_KEY || '';
  var q = {}; try { q = Object.fromEntries(new URL(req.url, 'http://h').searchParams); } catch (e) {}
  var method = (req.method || 'GET').toUpperCase();
  var body = method === 'POST' ? await readBody(req) : {};
  var key = q.key || body.key;
  if (ADMIN && key !== ADMIN) return j(res, 403, { ok: false, error: 'Admin key required. Not public.' });

  var st = (await db.get(STATE)) || { armed: false, cap: 20, mailedTotal: 0, lastRunMs: null };

  // action=send — the actual mail run (called by the daily cron). No-op unless armed;
  // dry-run unless LOB_API_KEY + MAIL_FROM_* return address are set in Vercel env.
  if (method === 'POST' && body.action === 'send') {
    var LOB = process.env.LOB_API_KEY || '';
    var FROM = { name: process.env.MAIL_FROM_NAME || '', line1: process.env.MAIL_FROM_LINE1 || '', city: process.env.MAIL_FROM_CITY || '', state: process.env.MAIL_FROM_STATE || 'FL', zip: process.env.MAIL_FROM_ZIP || '' };
    var PHONE = process.env.CONTACT_PHONE || '', NAME = process.env.CONTACT_NAME || '';
    if (!st.armed) return j(res, 200, { ok: true, mode: 'disarmed', count: 0 });
    var live = !!(LOB && FROM.line1);
    var deals = (await db.get('realauction:deals')) || [];
    var mailed = (await db.get(MAILED)) || {};
    var picks = deals.filter(function (d) { return d.workFirst && d.owner && d.owner.mailAddr && (d.equity || 0) > 0 && (d.state || 'FL').toUpperCase() === 'FL'; })
      .filter(function (d) { return !mailed[d.parcel || d.caseNumber]; })
      .sort(function (a, b) { return ((a.tier || 9) - (b.tier || 9)) || ((b.priority || 0) - (a.priority || 0)); })
      .slice(0, st.cap || 20);
    var sent = [], fails = 0;
    for (var i = 0; i < picks.length; i++) {
      var d = picks[i], k = d.parcel || d.caseNumber;
      if (live) { var r = await lobSend(d, LOB, FROM, PHONE, NAME); if (r.ok) sent.push(k); else fails++; }
      else sent.push(k);
    }
    if (live && sent.length) { sent.forEach(function (k) { mailed[k] = Date.now(); }); await db.set(MAILED, mailed); st.mailedTotal = (st.mailedTotal || 0) + sent.length; st.lastRunMs = Date.now(); await db.set(STATE, st); }
    return j(res, 200, { ok: true, mode: live ? 'sent' : 'dry-run', count: sent.length, candidates: picks.length, fails: fails, needReturnAddress: !FROM.line1, hasLobKey: !!LOB });
  }

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
