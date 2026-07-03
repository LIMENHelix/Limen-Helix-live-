/**
 * skip-trace.js — attach PHONE + EMAIL to enriched owner records.
 *
 * This is the ONE paid step. Phone/email is proprietary broker data, not public —
 * it needs a skip-trace provider account + API key (pay-as-you-go, ~$0.10-0.15/hit).
 * Recommended: BatchData (batchdata.com, REST API, often free trial credits). Any
 * provider works: point SKIPTRACE_URL at their skip-trace endpoint.
 *
 * Robust by design: it sends owner name + address, then RECURSIVELY scans the JSON
 * response for anything phone-shaped or email-shaped, so it extracts contacts even
 * if the provider's field names differ from what we guessed. On the first real run
 * we confirm the hit rate and adjust the request body to the provider's docs if needed.
 *
 * RUN: SKIPTRACE_KEY=... node scripts/skip-trace.js <enriched.json> [outCsv]
 *   no key -> DRY RUN (shows what it would send, writes nothing paid).
 *
 * COMPLIANCE (do this before dialing): scrub numbers against the National DNC registry,
 * and prefer manual one-to-one texts — mass/autodialed texts to these carry TCPA risk.
 */
'use strict';
var fs = require('fs');

var KEY = process.env.SKIPTRACE_KEY || '';
var URL = process.env.SKIPTRACE_URL || 'https://api.batchdata.com/api/v1/property/skip-trace';
var AUTH_SCHEME = process.env.SKIPTRACE_AUTH || 'Bearer';
var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

var PHONE_RE = /(?:\+?1[-.\s]?)?\(?([2-9]\d{2})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})\b/g;
var EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// recursively pull phone + email strings out of any response shape
function harvest(node, phones, emails) {
  if (node == null) return;
  if (typeof node === 'string') {
    var m; PHONE_RE.lastIndex = 0;
    while ((m = PHONE_RE.exec(node))) phones.add(m[1] + m[2] + m[3]);
    var e = node.match(EMAIL_RE); if (e) e.forEach(function (x) { emails.add(x.toLowerCase()); });
    return;
  }
  if (typeof node === 'number') { var s = String(node); if (/^\d{10}$/.test(s) && /^[2-9]/.test(s)) phones.add(s); return; }
  if (Array.isArray(node)) { node.forEach(function (n) { harvest(n, phones, emails); }); return; }
  if (typeof node === 'object') { Object.keys(node).forEach(function (k) { harvest(node[k], phones, emails); }); }
}
function fmtPhone(p) { return '(' + p.slice(0, 3) + ') ' + p.slice(3, 6) + '-' + p.slice(6); }

// BatchData-shaped request; adjust body here if your provider differs.
function buildBody(rec) {
  var o = rec.owner || {};
  var nameParts = (o.name || '').replace(/\s+\+.*$/, '').trim();
  return {
    requests: [{
      name: { full: nameParts },
      propertyAddress: { street: rec.street, city: rec.city, state: rec.state || 'FL', zip: rec.zip },
      mailingAddress: o.mailAddr ? { street: o.mailAddr, city: o.mailCity, state: o.mailState, zip: o.mailZip } : undefined
    }]
  };
}

async function trace(rec) {
  var r = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': AUTH_SCHEME + ' ' + KEY },
    body: JSON.stringify(buildBody(rec))
  });
  var text = await r.text();
  var json; try { json = JSON.parse(text); } catch (e) { json = text; }
  var phones = new Set(), emails = new Set();
  harvest(json, phones, emails);
  return { ok: r.ok, status: r.status, phones: Array.from(phones), emails: Array.from(emails), raw: r.ok ? null : String(text).slice(0, 160) };
}

function csvCell(s) { s = String(s == null ? '' : s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

async function main() {
  var inPath = process.argv[2];
  if (!inPath || !fs.existsSync(inPath)) { console.error('usage: SKIPTRACE_KEY=... node scripts/skip-trace.js <enriched.json> [outCsv]'); process.exit(1); }
  var outCsv = process.argv[3] || inPath.replace(/\.(enriched\.)?json$/, '') + '.calllist.csv';
  var deals = JSON.parse(fs.readFileSync(inPath, 'utf8')).filter(function (d) { return d.equity != null; }).sort(function (a, b) { return b.equity - a.equity; });

  if (!KEY) {
    console.log('== skip-trace DRY RUN (no SKIPTRACE_KEY) ==');
    console.log('  provider endpoint: ' + URL);
    console.log('  would trace ' + deals.length + ' owners (~$' + (deals.length * 0.12).toFixed(2) + ' at ~$0.12/hit).');
    console.log('  sample request body for #1 (' + (deals[0] && deals[0].owner && deals[0].owner.name) + '):');
    console.log('  ' + JSON.stringify(buildBody(deals[0])));
    console.log('\n  To run: get a BatchData (or similar) API key, then:');
    console.log('    SKIPTRACE_KEY=your_key node scripts/skip-trace.js "' + inPath + '"');
    return;
  }

  console.log('== skip-trace ' + deals.length + ' owners via ' + URL + ' ==');
  var withPhone = 0, rows = [['rank', 'equity', 'sale_date', 'owner', 'absentee', 'phones', 'emails', 'property_address', 'property_city', 'property_zip', 'mailing']];
  for (var i = 0; i < deals.length; i++) {
    var d = deals[i], o = d.owner || {};
    var res;
    try { res = await trace(d); } catch (e) { res = { ok: false, phones: [], emails: [], raw: e.message }; }
    if (res.phones.length) withPhone++;
    d.contact = { phones: res.phones, emails: res.emails };
    if (!res.ok) console.log('  ' + (i + 1) + ' ' + (o.name || '') + ' -> HTTP ' + res.status + ' ' + (res.raw || ''));
    else console.log('  ' + (i + 1) + ' ' + (o.name || '') + ' -> ' + res.phones.length + ' phone(s), ' + res.emails.length + ' email(s)');
    rows.push([i + 1, d.equity, d.saleDate, o.name || '', o.absentee ? 'YES' : '', res.phones.map(fmtPhone).join(' | '), res.emails.join(' | '), d.street, d.city, d.zip, [o.mailAddr, o.mailCity, o.mailState, o.mailZip].filter(Boolean).join(', ')]);
    await wait(250);
  }
  fs.writeFileSync(outCsv, rows.map(function (r) { return r.map(csvCell).join(','); }).join('\n'));
  fs.writeFileSync(inPath.replace(/\.json$/, '') + '.contacts.json', JSON.stringify(deals, null, 1));
  console.log('\n  got phones for ' + withPhone + '/' + deals.length + '. wrote ' + outCsv);
  console.log('  REMINDER: scrub against the National DNC registry before dialing; manual texts only.');
}
main().catch(function (e) { console.error('FATAL', e); process.exit(1); });
