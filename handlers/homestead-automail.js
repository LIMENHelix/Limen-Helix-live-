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
var STATE = 'homestead:automail', MAILED = 'homestead:mailed', MCFG = 'homestead:mailconfig';
var CFG_FIELDS = ['fromName', 'fromLine1', 'fromCity', 'fromState', 'fromZip', 'contactPhone', 'contactName'];

function j(res, c, o) { res.statusCode = c; res.setHeader('content-type', 'application/json'); res.setHeader('Cache-Control', 'private, no-store'); res.end(JSON.stringify(o)); }
function readBody(req) { return new Promise(function (r) { var b = ''; req.on('data', function (c) { b += c; if (b.length > 2e6) req.destroy(); }); req.on('end', function () { try { r(JSON.parse(b || '{}')); } catch (e) { r({}); } }); req.on('error', function () { r({}); }); }); }

var tc = function (s) { return String(s || '').toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); }); };
function fmtDate(s) { var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || ''); var mo = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']; return m ? mo[+m[1] - 1] + ' ' + (+m[2]) + ', ' + m[3] : (s || 'soon'); }
function letterHTML(o, PHONE, NAME) {
  var addr = (o.street || o.address || 'your property') + (o.city ? ', ' + tc(o.city) : '');
  var body = 'Hello,<br><br>I work with homeowners in ' + (o.county || 'your') + ' County, and I noticed ' + addr + ' has a court sale scheduled for ' + fmtDate(o.saleDate) + '.<br><br>' +
    'If that date holds, the property is sold at auction, often for far less than it is worth, and any value above what is owed can be lost. Public records suggest ' + addr + ' may hold real equity worth protecting.<br><br>' +
    'You have options before that date. I can bring you a fair, no-obligation cash offer, so you can sell on your terms and walk away with money in hand instead of losing it at the sale. There is no fee, no pressure, and I am not your lender.<br><br>' +
    'If that is worth a quick conversation, call or text me at ' + (PHONE || '[phone]') + '.<br><br>' + (NAME || 'the Homestead team');
  // Lob stamps the recipient address + IMB barcode on the top-left of page 1, so the body must
  // start BELOW that zone (~3in) or it gets overlapped. margin:0 + explicit padding, UTF-8 forced.
  return '<html><head><meta charset="utf-8"></head>' +
    '<body style="font-family:Georgia,serif;font-size:12pt;line-height:1.6;color:#111;margin:0;padding:3.1in 1in 1in 1in">' + body + '</body></html>';
}
// some sources (e.g. TX TCAD py_address) give the whole mailing as one line, so the city ends up
// embedded in the street. Split it back out at the street-type suffix so Lob gets a real address_city.
function splitStreetCity(line) {
  var SUF = /^(ST|STREET|AVE|AVENUE|BLVD|BOULEVARD|DR|DRIVE|RD|ROAD|LN|LANE|CT|COURT|WAY|PL|PLACE|TER|TERRACE|CIR|CIRCLE|PKWY|PARKWAY|HWY|HIGHWAY|TRL|TRAIL|LOOP|RUN|PASS|PT|POINT|SQ|SQUARE|PLZ|PLAZA|ROW|PATH|XING|BND|BEND|CV|COVE|WALK|EXPY|FWY|TPKE)$/i;
  var UNIT = /^(#|APT|UNIT|STE|SUITE|FL|BLDG|RM|SPC|LOT|NO)/i;
  var toks = String(line || '').trim().split(/\s+/), suf = -1;
  for (var i = 0; i < toks.length; i++) { if (SUF.test(toks[i].replace(/[.,]/g, ''))) suf = i; }
  if (suf < 0 || suf >= toks.length - 1) return { street: line, city: '' };
  var end = suf + 1;
  while (end < toks.length && UNIT.test(toks[end])) { end++; if (end < toks.length && /^[0-9]/.test(toks[end])) end++; }
  if (end >= toks.length) return { street: line, city: '' };
  return { street: toks.slice(0, end).join(' '), city: toks.slice(end).join(' ') };
}
async function lobSend(o, LOB, FROM, PHONE, NAME) {
  var au = 'Basic ' + Buffer.from(LOB + ':').toString('base64'), ow = o.owner || {}, f = new URLSearchParams();
  var line1 = ow.mailAddr || o.street || '', city = ow.mailCity || o.city || '';
  if (!city && line1) { var sc = splitStreetCity(line1); if (sc.city) { line1 = sc.street; city = sc.city; } }
  f.set('description', 'Homestead ' + (o.parcel || o.caseNumber || ''));
  f.set('to[name]', ow.name || 'Current Owner'); f.set('to[address_line1]', line1);
  f.set('to[address_city]', city); f.set('to[address_state]', ow.mailState || 'FL'); f.set('to[address_zip]', String(ow.mailZip || o.zip || '').slice(0, 5));
  f.set('from[name]', FROM.name); f.set('from[address_line1]', FROM.line1); f.set('from[address_city]', FROM.city); f.set('from[address_state]', FROM.state); f.set('from[address_zip]', FROM.zip);
  f.set('file', letterHTML(o, PHONE, NAME)); f.set('color', 'false'); f.set('use_type', 'marketing');
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
  if (!Array.isArray(st.states)) st.states = ['FL']; // which states auto-mail is enabled for (opt-in)

  // Return address + contact come from a Redis config the operator sets in the admin form (nothing
  // secret prints on a letter), falling back to env vars. Only the LOB key must stay a Vercel secret.
  var cfg = (await db.get(MCFG)) || {};
  var fromCfg = function () {
    return { name: cfg.fromName || process.env.MAIL_FROM_NAME || '', line1: cfg.fromLine1 || process.env.MAIL_FROM_LINE1 || '',
      city: cfg.fromCity || process.env.MAIL_FROM_CITY || '', state: cfg.fromState || process.env.MAIL_FROM_STATE || 'FL', zip: cfg.fromZip || process.env.MAIL_FROM_ZIP || '' };
  };
  var CPHONE = cfg.contactPhone || process.env.CONTACT_PHONE || '', CNAME = cfg.contactName || process.env.CONTACT_NAME || '';

  // action=test — mail ONE letter to a given address (the operator's own) to verify the physical
  // piece BEFORE arming a mass run. Uses the live key + return address, so it's a real letter.
  if (method === 'POST' && body.action === 'test') {
    var TLOB = process.env.LOB_API_KEY || '', TFROM = fromCfg();
    if (!TLOB) return j(res, 200, { ok: false, error: 'No LOB_API_KEY on the server.' });
    if (!TFROM.line1) return j(res, 200, { ok: false, error: 'Set your return address in the Mail setup form first.' });
    var t = body.to || {};
    if (!t.line1) return j(res, 400, { ok: false, error: 'Test recipient line1 required.' });
    var sample = { county: t.county || 'Sample', street: t.line1, city: t.city || '', saleDate: '08/15/2026',
      owner: { name: t.name || 'Test Recipient', mailAddr: t.line1, mailCity: t.city || '', mailState: t.state || TFROM.state, mailZip: t.zip || '' } };
    var tr = await lobSend(sample, TLOB, TFROM, CPHONE, CNAME);
    return j(res, 200, { ok: tr.ok, id: tr.id, err: tr.err, mode: 'test-live' });
  }

  // action=mailone — mail ONE specific deal the operator clicked (manual mode). Deliberate, so it
  // works whether or not the auto-switch is armed. Looks the deal up server-side + dedupes.
  if (method === 'POST' && body.action === 'mailone') {
    var OLOB = process.env.LOB_API_KEY || '', OFROM = fromCfg();
    if (!OLOB) return j(res, 200, { ok: false, error: 'No LOB_API_KEY on the server.' });
    if (!OFROM.line1) return j(res, 200, { ok: false, error: 'Set your return address in Mail setup first.' });
    var dk = body.dealKey;
    if (!dk) return j(res, 400, { ok: false, error: 'dealKey required.' });
    var odeals = (await db.get('realauction:deals')) || [], od = null;
    for (var oi = 0; oi < odeals.length; oi++) { if ((odeals[oi].parcel || odeals[oi].caseNumber) === dk) { od = odeals[oi]; break; } }
    if (!od) return j(res, 404, { ok: false, error: 'Deal not found (list may have refreshed).' });
    if (!(od.owner && od.owner.mailAddr)) return j(res, 200, { ok: false, error: 'No mailing address for this owner.' });
    var omailed = (await db.get(MAILED)) || {};
    if (omailed[dk]) return j(res, 200, { ok: true, already: true, mode: 'already-mailed' });
    var orr = await lobSend(od, OLOB, OFROM, CPHONE, CNAME);
    if (orr.ok) { omailed[dk] = Date.now(); await db.set(MAILED, omailed); st.mailedTotal = (st.mailedTotal || 0) + 1; st.lastRunMs = Date.now(); await db.set(STATE, st); }
    return j(res, 200, { ok: orr.ok, id: orr.id, err: orr.err, mode: 'mailed-one' });
  }

  // action=send — the actual mail run (called by the daily cron). No-op unless armed;
  // dry-run unless LOB key + a return address (admin form or env) are set.
  if (method === 'POST' && body.action === 'send') {
    var LOB = process.env.LOB_API_KEY || '', FROM = fromCfg(), PHONE = CPHONE, NAME = CNAME;
    if (!st.armed) return j(res, 200, { ok: true, mode: 'disarmed', count: 0 });
    var live = !!(LOB && FROM.line1);
    var deals = (await db.get('realauction:deals')) || [];
    var mailed = (await db.get(MAILED)) || {};
    var enabled = (st.states && st.states.length) ? st.states : ['FL'];
    var picks = deals.filter(function (d) { return d.workFirst && d.owner && d.owner.mailAddr && (d.equity || 0) > 0 && enabled.indexOf((d.state || 'FL').toUpperCase()) >= 0; })
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
    if (Array.isArray(body.states)) st.states = body.states.map(function (s) { return String(s).toUpperCase().trim(); }).filter(Boolean);
    if (body.config && typeof body.config === 'object') {
      CFG_FIELDS.forEach(function (k) { if (body.config[k] != null) cfg[k] = String(body.config[k]).slice(0, 120).trim(); });
      await db.set(MCFG, cfg);
    }
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
  var conf = {}; CFG_FIELDS.forEach(function (k) { conf[k] = cfg[k] || ''; });
  return j(res, 200, {
    ok: true, armed: !!st.armed, cap: st.cap || 20, states: st.states,
    mailedTotal: st.mailedTotal || 0, lastRunMs: st.lastRunMs || null,
    mailedKeys: Object.keys(m), hasLobKey: !!(process.env.LOB_API_KEY),
    hasReturnAddr: !!fromCfg().line1, config: conf
  });
};
