/**
 * automail-run.js — autonomous outreach executor. Run daily by .github/workflows/automail.yml
 * AFTER the scrape/enrich. It does NOTHING unless the operator armed the switch on the desk.
 * Armed: mails the top-N (cap) work-first sellers with a mailing address, deduped, via Lob.
 * DRY RUN if LOB_API_KEY / return address are missing — logs who it WOULD mail, sends nothing.
 * The switch is the safety gate; the Lob key is the spend gate. Both must be set to actually mail.
 */
'use strict';
var BASE = process.env.AUTOMAIL_BASE || 'https://limenhelix.com';
var KEY = process.env.LEAD_ADMIN_KEY || '';
var LOB = process.env.LOB_API_KEY || '';
var PHONE = process.env.CONTACT_PHONE || '';
var NAME = process.env.CONTACT_NAME || 'the Homestead team';
var FROM = { name: process.env.MAIL_FROM_NAME || '', line1: process.env.MAIL_FROM_LINE1 || '', city: process.env.MAIL_FROM_CITY || '', state: process.env.MAIL_FROM_STATE || 'FL', zip: process.env.MAIL_FROM_ZIP || '' };
var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
var tc = function (s) { return String(s || '').toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); }); };
function fmtDate(s) { var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || ''); var mo = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']; return m ? mo[+m[1] - 1] + ' ' + (+m[2]) + ', ' + m[3] : (s || 'soon'); }

function letterHTML(o) {
  var addr = (o.address || 'your property') + (o.city ? ', ' + tc(o.city) : '');
  var body = 'Hello,<br><br>' +
    'I work with homeowners in ' + (o.county || 'your') + ' County, and I noticed ' + addr + ' has a court sale scheduled for ' + fmtDate(o.saleDate) + '.<br><br>' +
    'If that date holds, the property is sold at auction — often for far less than it is worth, and any value above what is owed can be lost. Public records suggest ' + addr + ' may hold real equity worth protecting.<br><br>' +
    'You have options before that date. I can bring you a fair, no-obligation cash offer, so you can sell on your terms and walk away with money in hand instead of losing it at the sale. There is no fee, no pressure, and I am not your lender.<br><br>' +
    'If that is worth a quick conversation, call or text me at ' + (PHONE || '[your phone]') + '.<br><br>' + NAME;
  return '<html><body style="font-family:Georgia,serif;font-size:12pt;line-height:1.6;padding:1in">' + body + '</body></html>';
}
async function lobSend(o) {
  var au = 'Basic ' + Buffer.from(LOB + ':').toString('base64');
  var f = new URLSearchParams();
  f.set('description', 'Homestead outreach ' + (o.parcel || o.caseNumber || ''));
  f.set('to[name]', o.owner || 'Current Owner'); f.set('to[address_line1]', o.mailAddr || o.address || '');
  f.set('to[address_city]', o.mailCity || o.city || ''); f.set('to[address_state]', o.mailState || 'FL'); f.set('to[address_zip]', o.mailZip || o.zip || '');
  f.set('from[name]', FROM.name); f.set('from[address_line1]', FROM.line1); f.set('from[address_city]', FROM.city); f.set('from[address_state]', FROM.state); f.set('from[address_zip]', FROM.zip);
  f.set('file', letterHTML(o)); f.set('color', 'false');
  var r = await fetch('https://api.lob.com/v1/letters', { method: 'POST', headers: { Authorization: au, 'Content-Type': 'application/x-www-form-urlencoded' }, body: f.toString() });
  var j = await r.json(); return { ok: r.ok, id: j.id, err: j.error };
}

(async () => {
  if (!KEY) { console.error('automail: LEAD_ADMIN_KEY missing'); process.exit(2); }
  var st = await (await fetch(BASE + '/api/homestead-automail?key=' + encodeURIComponent(KEY))).json();
  if (!st.ok) { console.error('automail: state fetch failed', st); process.exit(1); }
  console.log('SWITCH:', st.armed ? 'ARMED' : 'DISARMED', '| cap', st.cap, '| already mailed', (st.mailedKeys || []).length, '| Lob', st.hasLobKey ? 'present' : 'MISSING');
  if (!st.armed) { console.log('automail: switch OFF — sending nothing. (Operator arms it on /admin-homestead.)'); return; }

  var hs = await (await fetch(BASE + '/api/homestead?state=FL&perCounty=300&key=' + encodeURIComponent(KEY))).json();
  if (!hs.ok) { console.error('automail: homestead fetch failed'); process.exit(1); }
  var all = (hs.counties || []).reduce(function (a, c) { return a.concat(c.opportunities || []); }, []);
  var mailed = {}; (st.mailedKeys || []).forEach(function (k) { mailed[k] = 1; });
  var picks = all
    .filter(function (o) { return o.workFirst && o.mailTo && (o.equity || 0) > 0 && o.mailState; })
    .filter(function (o) { return !mailed[o.parcel || o.caseNumber]; })
    .sort(function (a, b) { return (a.tier - b.tier) || (b.priority - a.priority); })
    .slice(0, st.cap);
  console.log('automail: ' + picks.length + ' new work-first sellers within cap');

  var live = !!(LOB && FROM.line1), sent = [];
  for (var i = 0; i < picks.length; i++) {
    var o = picks[i], k = o.parcel || o.caseNumber;
    if (live) {
      var r = await lobSend(o);
      if (r.ok) { console.log('  MAILED ' + o.owner + ' @ ' + o.mailCity + ' (' + r.id + ')'); sent.push(k); }
      else console.error('  Lob FAIL ' + k + ': ' + JSON.stringify(r.err).slice(0, 140));
      await wait(400);
    } else { console.log('  DRY RUN would mail: ' + o.owner + ' — ' + o.mailTo); }
  }
  if (live && sent.length) {
    await fetch(BASE + '/api/homestead-automail', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: KEY, run: { mailed: sent, count: sent.length } }) });
    console.log('automail: SENT + recorded ' + sent.length + ' letters.');
  } else if (!live) {
    console.log('automail: DRY RUN complete (' + picks.length + ' would send). Add LOB_API_KEY + MAIL_FROM_* return address to go live.');
  }
})().catch(function (e) { console.error('automail FATAL', e && e.stack || e); process.exit(1); });
