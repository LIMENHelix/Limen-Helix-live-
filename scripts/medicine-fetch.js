/**
 * medicine-fetch.js — MEDICINE signal worker. Pulls openFDA enforcement (drug + device recalls),
 * ranks by classification / tort-pattern / recency (lib/medicine), POSTs to /api/medicine-distress-
 * ingest. National, single-source, free, clean public API. Cron via medicine.yml.
 * Env: LEAD_ADMIN_KEY, INGEST_URL, optional OPENFDA_KEY (raises rate limits).
 */
'use strict';
var M = require('../lib/medicine');
var BASE = process.env.INGEST_URL || 'https://limenhelix.com';
var KEY = process.env.LEAD_ADMIN_KEY || '';
var FDA_KEY = process.env.OPENFDA_KEY || '';
var MAX_AGE_DAYS = 365;
var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
function ymd(offsetDays) { var d = new Date(Date.now() + offsetDays * 86400000); return d.toISOString().slice(0, 10).replace(/-/g, ''); }

async function fetchClass(productType, classLabel, startdt, enddt) {
  var search = 'report_date:[' + startdt + '+TO+' + enddt + ']+AND+classification:"' + classLabel.replace(/ /g, '+') + '"';
  var url = 'https://api.fda.gov/' + productType + '/enforcement.json?search=' + search + '&limit=100&sort=report_date:desc' + (FDA_KEY ? '&api_key=' + FDA_KEY : '');
  var r = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
  if (r.status === 404) return []; // openFDA returns 404 when a search matches zero records
  if (!r.ok) throw new Error('HTTP ' + r.status);
  var j = await r.json();
  return ((j && j.results) || []).map(function (rec) { return M.fromRecall(rec, productType); });
}

async function run() {
  var startdt = ymd(-MAX_AGE_DAYS), enddt = ymd(2), all = [];
  var jobs = [['drug', 'Class I'], ['drug', 'Class II'], ['device', 'Class I'], ['device', 'Class II']];
  for (var i = 0; i < jobs.length; i++) {
    var pt = jobs[i][0], cl = jobs[i][1];
    try { var got = await fetchClass(pt, cl, startdt, enddt); all = all.concat(got); console.log('  ' + pt + ' ' + cl + ': ' + got.length); }
    catch (e) { console.log('  ' + pt + ' ' + cl + ': FAILED ' + (e && e.message || e)); }
    await wait(300);
  }
  all = all.filter(function (d) { return d.firm; }).map(M.enrichMedicine);
  // dedupe by recall key, keep most severe
  var byKey = {};
  all.forEach(function (d) { if (!byKey[d.key] || d.priority > byKey[d.key].priority) byKey[d.key] = d; });
  var deals = Object.keys(byKey).map(function (k) { return byKey[k]; })
    .sort(function (a, b) { return (a.tier - b.tier) || (b.priority - a.priority) || String(b.date).localeCompare(String(a.date)); });

  console.log('distinct recalls (<=' + MAX_AGE_DAYS + 'd): ' + deals.length + ' (' + deals.filter(function (d) { return d.workFirst; }).length + ' severe+)');
  deals.slice(0, 6).forEach(function (d) { console.log('    T' + d.tier + ' ' + (d.brand || d.firm) + ' | ' + d.signalLabel + ' | ' + d.productType + ' | ' + d.date); });

  if (!KEY) { console.log('no LEAD_ADMIN_KEY - dry run (nothing stored)'); return; }
  var res = await fetch(BASE + '/api/medicine-distress-ingest', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key: KEY, deals: deals, meta: { updatedMs: Date.now(), total: deals.length } })
  });
  console.log('ingest -> ' + res.status + ' ' + (await res.text()).slice(0, 120));
}
run().catch(function (e) { console.error('MEDICINE FATAL', e && e.stack || e); process.exit(1); });
