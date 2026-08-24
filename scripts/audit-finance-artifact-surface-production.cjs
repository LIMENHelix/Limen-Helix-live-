'use strict';

/* Read-only audit of the existing public Investment Artifacts surface.
 * This is deliberately not a Finance Preview input adapter: it measures the
 * legacy artifact store so READY_TO_SIGN records cannot be mistaken for
 * source-grounded Finance manager proposals. */

var ORIGIN = process.env.LIMEN_ORIGIN || 'https://limenhelix.com';
var LIMIT = 200;

function list(value) { return Array.isArray(value) ? value : []; }
function fetchJson(url) {
  return fetch(url, { headers: { accept: 'application/json' } }).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
    return r.json();
  });
}
function iso(ms) {
  return typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
function summarize(records, lane) {
  var rows = list(records).filter(function (r) { return r && r.lane === lane; });
  var byStatus = {};
  var placeholderTotal = 0;
  var stale = 0;
  var newest = null;
  var oldest = null;
  rows.forEach(function (r) {
    var status = String(r.status || 'UNKNOWN');
    byStatus[status] = (byStatus[status] || 0) + 1;
    var p = r.dataRequestMatrix && r.dataRequestMatrix.placeholderCount;
    if (typeof p === 'number') placeholderTotal += p;
    var at = r.freshness && r.freshness.persistedAt;
    if (typeof at === 'number') {
      if (newest === null || at > newest) newest = at;
      if (oldest === null || at < oldest) oldest = at;
      if (Date.now() - at > 30 * 24 * 3600 * 1000) stale++;
    }
  });
  return {
    lane: lane,
    records: rows.length,
    byStatus: byStatus,
    readyToSign: byStatus.READY_TO_SIGN || 0,
    draftNeedsData: byStatus.DRAFT_NEEDS_DATA || 0,
    placeholderCountTotal: placeholderTotal,
    staleOver30Days: stale,
    newestPersistedAt: iso(newest),
    oldestPersistedAt: iso(oldest),
    source: 'GET /api/limen-engine-output?lane=' + lane + '&limit=' + LIMIT
  };
}

async function main() {
  var lanes = ['investment', 'research'];
  var responses = await Promise.all(lanes.map(function (lane) {
    return fetchJson(ORIGIN + '/api/limen-engine-output?lane=' + lane + '&limit=' + LIMIT);
  }));
  var reports = lanes.map(function (lane, i) { return summarize(responses[i].records, lane); });
  var all = reports.reduce(function (n, r) { return n + r.records; }, 0);
  var ready = reports.reduce(function (n, r) { return n + r.readyToSign; }, 0);
  var drafts = reports.reduce(function (n, r) { return n + r.draftNeedsData; }, 0);
  console.log(JSON.stringify({
    origin: ORIGIN,
    readOnly: true,
    endpoint: '/api/limen-engine-output',
    records: all,
    readyToSign: ready,
    draftNeedsData: drafts,
    lanes: reports,
    interpretation: {
      readyToSignIsNotFinancePreviewInput: true,
      reason: 'legacy artifacts have no finance-input-ledger/1.0, manager proposal, source-linked semantic/market/network evidence, or explicit sandbox release policy',
      next: 'reconcile or retire this display source before treating it as a Finance opportunity producer'
    }
  }, null, 2));
}

main().catch(function (e) {
  console.error(e && e.stack || e);
  process.exitCode = 1;
});

