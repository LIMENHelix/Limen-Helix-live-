/**
 * tech-fetch.js — TECHNOLOGY signal worker. Pulls the layoffs.fyi tracker (national, single-source,
 * free-with-attribution), ranks the events (lib/tech), POSTs to /api/technology-distress-ingest.
 * Cron via technology.yml. Env: LEAD_ADMIN_KEY, INGEST_URL, optional LAYOFFS_EMBED.
 *
 * layoffs.fyi renders its data from an Airtable shared view. There is no stable public API, so this
 * SELF-BOOTSTRAPS a read token from the embed page on every run (the token + URL escaping rotate per
 * page load — do NOT hardcode them). ToS: data is "free to use with attribution to layoffs.fyi"
 * (each deal carries its source link). Brittle by nature; this is a rank 1-3 lagging finder, so an
 * occasional scraper fix is an acceptable maintenance cost, not a credibility risk.
 */
'use strict';
var T = require('../lib/tech');
var BASE = process.env.INGEST_URL || 'https://limenhelix.com';
var KEY = process.env.LEAD_ADMIN_KEY || '';
var EMBED = process.env.LAYOFFS_EMBED || 'https://airtable.com/embed/app1PaujS9zxVGUZ4/shroKsHx3SdYYOzeh';
var UA = 'Mozilla/5.0 (LIMEN Helix distress-monitor; chrishubbel72@gmail.com)';
var MAX_AGE_DAYS = 180;

function between(s, marker, endChar) {
  var i = s.indexOf(marker); if (i < 0) return null;
  var start = i + marker.length; var end = s.indexOf(endChar, start);
  return end < 0 ? null : s.slice(start, end);
}
function unescapePath(u) {
  return String(u || '').replace(/\\u002F/gi, '/').replace(/\\\//g, '/').replace(/\\u0026/gi, '&');
}
// collect first array found under `key`, and concat all arrays found under `key2`
function walk(o, key, out) {
  if (o && typeof o === 'object') {
    if (Array.isArray(o)) { for (var i = 0; i < o.length; i++) walk(o[i], key, out); }
    else { for (var k in o) { if (k === key) out.push(o[k]); walk(o[k], key, out); } }
  }
  return out;
}

async function fetchAirtable() {
  var page = await (await fetch(EMBED, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) })).text();
  var urlWithParams = unescapePath(between(page, 'urlWithParams: "', '"'));
  var appId = between(page, '"x-airtable-application-id":"', '"');
  var pageLoadId = between(page, '"x-airtable-page-load-id":"', '"');
  if (!urlWithParams || !appId) throw new Error('could not bootstrap Airtable token (embed layout changed)');
  var r = await fetch('https://airtable.com' + urlWithParams, {
    headers: {
      'user-agent': UA,
      'x-airtable-application-id': appId,
      'x-airtable-page-load-id': pageLoadId || '',
      'x-airtable-inter-service-client': 'webClient',
      'x-airtable-accept-msgpack': 'false',
      'x-requested-with': 'XMLHttpRequest'
    },
    signal: AbortSignal.timeout(30000)
  });
  if (!r.ok) throw new Error('readSharedViewData HTTP ' + r.status);
  var j = await r.json();
  var cols = (walk(j, 'columns', [])[0]) || [];
  var colName = {}; cols.forEach(function (c) { if (c && c.id) colName[c.id] = c.name; });
  var rowGroups = walk(j, 'rows', []);
  var rows = [];
  rowGroups.forEach(function (g) { if (Array.isArray(g)) g.forEach(function (r) { rows.push(r); }); });
  return rows.map(function (row) {
    var cv = row.cellValuesByColumnId || {};
    var obj = {}; for (var id in cv) obj[colName[id] || id] = cv[id];
    return obj;
  });
}

async function run() {
  var objs = await fetchAirtable();
  console.log('layoffs.fyi rows: ' + objs.length);
  var deals = objs.map(T.fromRow).filter(function (d) { return d.company; }).map(T.enrichTech);
  // freshness window + dedupe by key (keep most severe)
  deals = deals.filter(function (d) {
    if (!d.date) return true; var t = Date.parse(d.date);
    return isNaN(t) ? true : (Date.now() - t) / 86400000 <= MAX_AGE_DAYS;
  });
  var byKey = {};
  deals.forEach(function (d) { if (!byKey[d.key] || d.priority > byKey[d.key].priority) byKey[d.key] = d; });
  deals = Object.keys(byKey).map(function (k) { return byKey[k]; })
    .sort(function (a, b) { return (a.tier - b.tier) || (b.priority - a.priority) || String(b.date).localeCompare(String(a.date)); });

  console.log('distinct distress events (<=' + MAX_AGE_DAYS + 'd): ' + deals.length + ' (' + deals.filter(function (d) { return d.workFirst; }).length + ' severe+)');
  deals.slice(0, 6).forEach(function (d) { console.log('    T' + d.tier + ' ' + d.company + ' | ' + d.signalLabel + ' | ' + (d.pct != null ? d.pct + '%' : '') + ' ' + (d.count || '') + ' | ' + d.date); });

  if (!KEY) { console.log('no LEAD_ADMIN_KEY - dry run (nothing stored)'); return; }
  var res = await fetch(BASE + '/api/technology-distress-ingest', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key: KEY, deals: deals, meta: { updatedMs: Date.now(), total: deals.length } })
  });
  console.log('ingest -> ' + res.status + ' ' + (await res.text()).slice(0, 120));
}
run().catch(function (e) { console.error('TECH FATAL', e && e.stack || e); process.exit(1); });
