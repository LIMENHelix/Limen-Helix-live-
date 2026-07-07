/**
 * edgar-fetch.js — FINANCE signal worker. Runs the EDGAR full-text distress queries (lib/edgar.js),
 * ranks them, POSTs to /api/finance-distress-ingest. National, single-source, free. Cron via edgar.yml.
 * SEC requires a declared User-Agent with contact. Env: LEAD_ADMIN_KEY, INGEST_URL.
 */
'use strict';
var E = require('../lib/edgar');
var BASE = process.env.INGEST_URL || 'https://limenhelix.com';
var KEY = process.env.LEAD_ADMIN_KEY || '';
var UA = { 'user-agent': 'LIMEN Helix distress-monitor chrishubbel72@gmail.com', accept: 'application/json' };
var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
function ymd(offsetDays) { var d = new Date(Date.now() + offsetDays * 86400000); return d.toISOString().slice(0, 10); }

async function fetchSignal(sig, startdt, enddt) {
  var url = 'https://efts.sec.gov/LATEST/search-index?q=' + encodeURIComponent(sig.q) + '&forms=' + encodeURIComponent(sig.forms) + '&startdt=' + startdt + '&enddt=' + enddt;
  var r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  var j = await r.json();
  var hits = (j.hits && j.hits.hits) || [];
  return hits.map(function (h) { return E.fromHit(h, sig.key); }).filter(function (d) { return d.cik && d.company; });
}

async function run() {
  var startdt = ymd(-95), enddt = ymd(1), all = [];
  for (var i = 0; i < E.SIGNALS.length; i++) {
    var sig = E.SIGNALS[i];
    try { var got = await fetchSignal(sig, startdt, enddt); all = all.concat(got); console.log('  ' + sig.key + ': ' + got.length); }
    catch (e) { console.log('  ' + sig.key + ': FAILED ' + (e && e.message || e)); }
    await wait(300); // be polite to EDGAR (<10 req/s)
  }
  all = all.map(E.enrichEdgar);
  // dedupe by CIK, keep the single most-severe distress signal per company
  var byCik = {};
  all.forEach(function (d) { var c = d.cik; if (!byCik[c] || d.priority > byCik[c].priority) byCik[c] = d; });
  var deals = Object.keys(byCik).map(function (c) { return byCik[c]; }).sort(function (a, b) { return (a.tier - b.tier) || (b.priority - a.priority); });
  console.log('distinct distressed companies: ' + deals.length + ' (' + deals.filter(function (d) { return d.workFirst; }).length + ' severe+)');
  deals.slice(0, 6).forEach(function (d) { console.log('    T' + d.tier + ' ' + d.company + (d.ticker ? ' (' + d.ticker + ')' : '') + ' | ' + d.signalLabel + ' | ' + d.filingDate); });

  if (!KEY) { console.log('no LEAD_ADMIN_KEY - dry run'); return; }
  var res = await fetch(BASE + '/api/finance-distress-ingest', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key: KEY, deals: deals, meta: { updatedMs: Date.now(), total: deals.length } })
  });
  console.log('ingest -> ' + res.status + ' ' + (await res.text()).slice(0, 120));
}
run().catch(function (e) { console.error('EDGAR FATAL', e && e.stack || e); process.exit(1); });
