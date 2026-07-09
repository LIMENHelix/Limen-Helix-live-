/**
 * energy-distress-fetch.js — ENERGY L1 signal worker. Pulls EIA operating-generator-capacity (EIA-860M),
 * keeps the RETIRING generators (planned retirement / retiring status), ranks by interconnection value
 * (lib/energy-distress), POSTs to /api/energy-distress-ingest. National, structured, free w/ EIA key.
 * Cron via energy-distress.yml. Env: LEAD_ADMIN_KEY, INGEST_URL, EIA_API_KEY.
 *
 * ⚠ First live run: this logs a sample row's field names (RA-style) so EIA v2 column names can be
 * confirmed/tuned — fromRecord() is fuzzy but EIA may name the retirement fields differently.
 */
'use strict';
var E = require('../lib/energy-distress');
var BASE = process.env.INGEST_URL || 'https://limenhelix.com';
var KEY = process.env.LEAD_ADMIN_KEY || '';
var EIA = process.env.EIA_API_KEY || '';
var PAGES = 6, LEN = 5000;
var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

async function fetchPage(offset) {
  var url = 'https://api.eia.gov/v2/electricity/operating-generator-capacity/data/' +
    '?api_key=' + encodeURIComponent(EIA) +
    '&frequency=monthly&data[0]=nameplate-capacity-mw' +
    '&sort[0][column]=period&sort[0][direction]=desc' +
    '&length=' + LEN + '&offset=' + offset;
  var r = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(45000) });
  if (!r.ok) throw new Error('EIA HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120));
  var j = await r.json();
  return (j && j.response && j.response.data) || [];
}

async function run() {
  if (!EIA) { console.log('no EIA_API_KEY — dry run. Register a free key at eia.gov/opendata, add as EIA_API_KEY secret.'); return; }
  var all = [], latestPeriod = null;
  for (var p = 0; p < PAGES; p++) {
    var rows;
    try { rows = await fetchPage(p * LEN); }
    catch (e) { console.log('page ' + p + ' FAILED ' + (e && e.message || e)); break; }
    if (p === 0 && rows[0]) console.log('EIA sample row fields:', Object.keys(rows[0]).join(', '));
    if (!rows.length) break;
    // only the most recent period (EIA-860M snapshot); rows are period-desc sorted
    if (!latestPeriod) latestPeriod = rows[0].period;
    rows = rows.filter(function (r) { return r.period === latestPeriod; });
    all = all.concat(rows);
    if (rows.length < LEN) break;
    await wait(250);
  }
  console.log('EIA rows (period ' + latestPeriod + '): ' + all.length);
  var deals = all.map(E.fromRecord).filter(E.isRetiring).map(E.enrichEnergy);
  // dedupe by plant|generator, keep most severe
  var byKey = {};
  deals.forEach(function (d) { if (!byKey[d.key] || d.priority > byKey[d.key].priority) byKey[d.key] = d; });
  deals = Object.keys(byKey).map(function (k) { return byKey[k]; })
    .sort(function (a, b) { return (a.tier - b.tier) || (b.priority - a.priority); });

  console.log('retiring generators: ' + deals.length + ' (' + deals.filter(function (d) { return d.workFirst; }).length + ' prime+)');
  deals.slice(0, 6).forEach(function (d) { console.log('    T' + d.tier + ' ' + d.plant + ' | ' + d.signalLabel + ' | ' + (d.capacityMw || '?') + 'MW | retire ' + (d.retireDate || '?') + ' | ' + d.state); });

  if (!KEY) { console.log('no LEAD_ADMIN_KEY - not storing'); return; }
  var res = await fetch(BASE + '/api/energy-distress-ingest', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ key: KEY, deals: deals, meta: { updatedMs: Date.now(), total: deals.length, period: latestPeriod } })
  });
  console.log('ingest -> ' + res.status + ' ' + (await res.text()).slice(0, 120));
}
run().catch(function (e) { console.error('ENERGY FATAL', e && e.stack || e); process.exit(1); });
