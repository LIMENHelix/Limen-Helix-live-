/**
 * warn-fetch.js — INDUSTRY signal worker. Pulls WARN notices (plant closings / mass layoffs) from
 * the clean free state feeds, ranks them (lib/warn.js), and POSTs to /api/industry-ingest (gated by
 * LEAD_ADMIN_KEY). Run by a GitHub Action cron, same pattern as the RealAuction worker.
 *
 * Sources: Texas + Oregon (Socrata JSON, trivial) and California (EDD .xlsx, richest — carries the
 * closure-vs-layoff flag + NAICS). Keeps recent/active notices (assets not yet gone).
 * Env: LEAD_ADMIN_KEY (POST auth), INGEST_URL (default limenhelix.com).
 */
'use strict';
var W = require('../lib/warn');
var BASE = process.env.INGEST_URL || 'https://limenhelix.com';
var KEY = process.env.LEAD_ADMIN_KEY || '';
var UA = 'Mozilla/5.0 (compatible; limen-warn/1.0)';
function get(url, json) { return fetch(url, { headers: { 'user-agent': UA, accept: json ? 'application/json' : '*/*' }, signal: AbortSignal.timeout(30000) }); }
function recent(d) { // keep if effective within [today-150, +540] days, else drop stale/ancient
  if (!d.effectiveDate) return true;
  var t = Date.parse(d.effectiveDate + 'T00:00:00Z'); if (isNaN(t)) return true;
  var days = (t - Date.now()) / 86400000; return days >= -150 && days <= 540;
}

async function texas() {
  var r = await get('https://data.texas.gov/resource/8w53-c4f6.json?$order=notice_date%20DESC&$limit=400', true);
  var rows = await r.json();
  return rows.map(W.normTX);
}
async function oregon() {
  var r = await get('https://data.oregon.gov/resource/ijbz-jpx8.json?$order=received_date%20DESC&$limit=200', true);
  var rows = await r.json();
  return rows.map(W.normOR);
}
async function california() {
  var XLSX; try { XLSX = require('xlsx'); } catch (e) { console.log('  CA: xlsx module not installed, skipping'); return []; }
  var r = await get('https://edd.ca.gov/siteassets/files/jobs_and_training/warn/warn_report1.xlsx', false);
  var buf = Buffer.from(await r.arrayBuffer());
  var wb = XLSX.read(buf, { type: 'buffer' });
  var sheet = wb.SheetNames.find(function (n) { return /detail/i.test(n); }) || wb.SheetNames[0];
  var aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, raw: false });
  var hi = aoa.findIndex(function (row) { return (row || []).some(function (c) { return /^company$/i.test(String(c).trim()); }) && (row || []).some(function (c) { return /notice date/i.test(String(c)); }); });
  if (hi < 0) return [];
  var hdr = aoa[hi].map(function (c) { return String(c).trim(); });
  var out = [];
  for (var i = hi + 1; i < aoa.length; i++) {
    var row = aoa[i]; if (!row || !row.length) continue;
    var o = {}; hdr.forEach(function (h, j) { o[h] = row[j]; });
    if (!o['Company'] || !String(o['Company']).trim()) continue;
    out.push(W.normCA(o));
  }
  return out;
}

async function run() {
  var all = [], srcs = [['TX', texas], ['OR', oregon], ['CA', california]];
  for (var i = 0; i < srcs.length; i++) {
    try { var got = await srcs[i][1](); all = all.concat(got); console.log('  ' + srcs[i][0] + ': ' + got.length + ' notices'); }
    catch (e) { console.log('  ' + srcs[i][0] + ': FAILED ' + (e && e.message || e)); }
  }
  var deals = all.filter(function (d) { return d.company && d.affected > 0; }).filter(recent).map(W.enrichWarn);
  // dedupe by key, keep highest priority
  var byKey = {}; deals.forEach(function (d) { if (!byKey[d.key] || d.priority > byKey[d.key].priority) byKey[d.key] = d; });
  deals = Object.keys(byKey).map(function (k) { return byKey[k]; }).sort(function (a, b) { return (a.tier - b.tier) || (b.priority - a.priority); });
  console.log('total active WARN deals: ' + deals.length + ' (' + deals.filter(function (d) { return d.workFirst; }).length + ' work-first)');
  console.log('  top 5:');
  deals.slice(0, 5).forEach(function (d) { console.log('    T' + d.tier + ' ' + d.state + ' | ' + d.company + ' | ' + d.affected + ' aff | ' + (d.signals || []).join(',')); });

  if (!KEY) { console.log('no LEAD_ADMIN_KEY - dry run, not posting'); return; }
  var res = await fetch(BASE + '/api/industry-ingest', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key: KEY, deals: deals, meta: { updatedMs: Date.now(), total: deals.length } })
  });
  console.log('ingest -> ' + res.status + ' ' + (await res.text()).slice(0, 120));
}
run().catch(function (e) { console.error('WARN FATAL', e && e.stack || e); process.exit(1); });
