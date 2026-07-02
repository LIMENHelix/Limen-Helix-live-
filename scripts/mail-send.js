/**
 * mail-send.js — outbound physical-mail pipeline for the pre-foreclosure offer.
 *
 * WHY: the homeowner targets exist only as street addresses, so outreach is
 * PHYSICAL MAIL, not email (web3forms/Resend are the inbound side). This renders
 * the "sell before the auction" letter for each target and either:
 *   - DRY RUN (default / no LOB_API_KEY): writes each rendered letter to MAIL_OUT and
 *     prints a summary. Print these and stamp them yourself for a zero-setup test.
 *   - SEND: if LOB_API_KEY + a return address are set, mails each via Lob
 *     (lob.com, print + first-class postage, ~$0.90/letter). Add the key, it runs.
 *
 * Postage is the one unavoidable cost of this play (even DIY stamps are $0.73 each).
 * That is intrinsic to mailing letters, not a "paid tool" — flagged honestly.
 *
 * ENV:
 *   MAIL_CSV        path to the ranked list (default: scratchpad lee-mail-list.csv)
 *   MAIL_LIMIT      how many top rows to send (default 10)
 *   MAIL_OUT        dry-run output dir (default: ./_letters)
 *   PAGE_URL        CTA url (default https://limenhelix.com/sell-before-auction)
 *   CONTACT_PHONE   your call/text number for the letter
 *   MAIL_FROM_NAME / MAIL_FROM_COMPANY / MAIL_FROM_LINE1 / MAIL_FROM_CITY /
 *   MAIL_FROM_STATE / MAIL_FROM_ZIP   your return address (required to SEND)
 *   LOB_API_KEY     Lob key — presence flips DRY RUN → real mail
 */
'use strict';
var fs = require('fs');
var path = require('path');

var CSV = process.env.MAIL_CSV || path.join(__dirname, '..', '..', 'lee-mail-list.csv');
var LIMIT = parseInt(process.env.MAIL_LIMIT || '10', 10);
var OUT = process.env.MAIL_OUT || path.join(process.cwd(), '_letters');
var PAGE = process.env.PAGE_URL || 'https://limenhelix.com/sell-before-auction';
var PHONE = process.env.CONTACT_PHONE || '(your call/text number)';
var LOB = process.env.LOB_API_KEY || '';
var FROM = {
  name: process.env.MAIL_FROM_NAME || '', company: process.env.MAIL_FROM_COMPANY || '',
  line1: process.env.MAIL_FROM_LINE1 || '', city: process.env.MAIL_FROM_CITY || '',
  state: process.env.MAIL_FROM_STATE || 'FL', zip: process.env.MAIL_FROM_ZIP || ''
};

// minimal CSV parser (handles quoted fields)
function parseCSV(text) {
  var rows = [], row = [], cur = '', q = false;
  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (cur !== '' || row.length) { row.push(cur); rows.push(row); row = []; cur = ''; } if (c === '\r' && text[i + 1] === '\n') i++; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  var head = rows.shift();
  return rows.map(function (r) { var o = {}; head.forEach(function (h, i) { o[h] = r[i]; }); return o; });
}

function today() {
  var m = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var d = new Date();
  return m[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function letterHTML(rec) {
  var owner = (rec.owner && rec.owner.trim()) || 'Homeowner';
  var ret = [FROM.name || FROM.company, FROM.line1, (FROM.city ? FROM.city + ', ' + FROM.state + ' ' + FROM.zip : '')].filter(Boolean).join('<br>');
  return '<html><body style="font-family:Georgia,serif;font-size:12pt;line-height:1.5;color:#111;margin:1in 0.9in">' +
    (ret ? '<div style="margin-bottom:24px">' + ret + '</div>' : '<div style="height:24px"></div>') +
    '<div>' + today() + '</div>' +
    '<div style="margin:18px 0">' + esc(owner) + '<br>' + esc(rec.property_address) + '<br>' + esc(rec.city) + ', FL ' + esc(rec.zip) + '</div>' +
    '<div style="margin-bottom:10px"><b>Re: Your home at ' + esc(rec.property_address) + '</b></div>' +
    '<p>Dear ' + esc(owner) + ',</p>' +
    '<p>Public records show your home may have a foreclosure sale date coming up, around <b>' + esc(rec.sale_date) + '</b>. I am writing because there may be a much better outcome than letting it go at the courthouse auction.</p>' +
    '<p>At auction, homes often sell for far less than they are worth, and the equity you have built can disappear. My work is the opposite. I help homeowners sell for the <b>most</b> before the sale date, by putting the property in front of serious buyers who compete to pay top dollar, as-is, with no repairs and no cost to you.</p>' +
    '<p>You may already be getting calls from investors hoping to buy your home cheap. This is not that. The point here is to get the money to <b>you</b>, not to them.</p>' +
    '<p>For a free, no-obligation look at what your home could bring, please visit:</p>' +
    '<p style="text-align:center;font-size:13pt"><b>' + esc(PAGE.replace(/^https?:\/\//, '')) + '</b></p>' +
    '<p>or call or text me directly at <b>' + esc(PHONE) + '</b>.</p>' +
    '<p>There is never a fee charged to you, and you are under no obligation of any kind. If your goal is to keep your home instead, that is a good goal too. You can reach a free HUD-approved housing counselor at 888-995-4673.</p>' +
    '<p>Sincerely,</p><p>' + esc(FROM.name || '________________') + '<br>' + esc(FROM.company) + '</p>' +
    '<p style="font-size:11pt;color:#333"><i>P.S. Your sale date may be close. The sooner we talk, the more options you have.</i></p>' +
    '</body></html>';
}

async function lobSend(rec) {
  var owner = (rec.owner && rec.owner.trim()) || 'Current Resident';
  var form = new URLSearchParams();
  form.set('description', 'Pre-foreclosure offer ' + rec.property_address);
  form.set('to[name]', owner.slice(0, 40));
  form.set('to[address_line1]', rec.property_address);
  form.set('to[address_city]', rec.city);
  form.set('to[address_state]', 'FL');
  form.set('to[address_zip]', rec.zip);
  form.set('from[name]', (FROM.name || FROM.company).slice(0, 40));
  form.set('from[address_line1]', FROM.line1);
  form.set('from[address_city]', FROM.city);
  form.set('from[address_state]', FROM.state);
  form.set('from[address_zip]', FROM.zip);
  form.set('file', letterHTML(rec));
  form.set('color', 'false');
  form.set('address_placement', 'top_first_page');
  var r = await fetch('https://api.lob.com/v1/letters', {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + Buffer.from(LOB + ':').toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString()
  });
  var j = await r.json().catch(function () { return {}; });
  return { ok: r.ok, id: j.id, err: r.ok ? null : ((j.error && j.error.message) || JSON.stringify(j).slice(0, 120)) };
}

async function main() {
  if (!fs.existsSync(CSV)) { console.error('CSV not found:', CSV); process.exit(1); }
  var recs = parseCSV(fs.readFileSync(CSV, 'utf8')).slice(0, LIMIT);
  var haveFrom = FROM.line1 && FROM.city && FROM.zip;
  var willSend = !!LOB && haveFrom;

  console.log('== mail-send ==');
  console.log('  list: ' + CSV);
  console.log('  targets: ' + recs.length + ' (top ' + LIMIT + ')');
  console.log('  mode: ' + (willSend ? 'SEND via Lob (real letters, ~$0.90 each = ~$' + (recs.length * 0.9).toFixed(2) + ')' : 'DRY RUN (render only)'));
  if (LOB && !haveFrom) console.log('  NOTE: LOB_API_KEY set but return address missing (MAIL_FROM_LINE1/CITY/ZIP) — staying in DRY RUN.');
  if (!LOB) console.log('  NOTE: no LOB_API_KEY — rendering letters to print/stamp yourself. Add LOB_API_KEY + return address to auto-mail.');

  if (!willSend) {
    if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
    recs.forEach(function (rec, i) {
      var f = path.join(OUT, String(i + 1).padStart(2, '0') + '-' + (rec.property_address || 'x').replace(/[^a-z0-9]+/gi, '-').slice(0, 30) + '.html');
      fs.writeFileSync(f, letterHTML(rec));
      console.log('  ' + (i + 1) + '. ' + (rec.owner || 'Homeowner') + ' | ' + rec.property_address + ', ' + rec.city + ' ' + rec.zip + '  -> ' + path.basename(f));
    });
    console.log('  rendered ' + recs.length + ' letters to ' + OUT + ' (open in a browser, print, mail).');
    return;
  }

  var sent = 0;
  for (var i = 0; i < recs.length; i++) {
    try {
      var res = await lobSend(recs[i]);
      if (res.ok) { sent++; console.log('  SENT ' + (i + 1) + '/' + recs.length + ' ' + recs[i].property_address + ' (' + res.id + ')'); }
      else console.log('  FAIL ' + (i + 1) + ' ' + recs[i].property_address + ' :: ' + res.err);
    } catch (e) { console.log('  ERR ' + (i + 1) + ' ' + e.message); }
  }
  console.log('  mailed ' + sent + '/' + recs.length + '.');
}
main().catch(function (e) { console.error('FATAL', e); process.exit(1); });
