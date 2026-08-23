#!/usr/bin/env node
'use strict';

/* Read-only production audit for persisted title sets. No writes, cron triggers,
 * query mutations, or credentials are used. The API's `n` parameter is a read cap,
 * so counts are reported as observed-at-cap, never as total retention.
 */

var registry = require('../brain-v2/bind/registry.js');
var baseArg = process.argv.find(function (a) { return a.indexOf('--base=') === 0; });
var base = (baseArg ? baseArg.slice('--base='.length) : 'https://limenhelix.com').replace(/\/$/, '');
var limit = 500;

function auditKey(key) {
  var url = base + '/api/feed-record?titles=' + encodeURIComponent(key) + '&n=' + limit;
  return fetch(url).then(function (response) {
    return response.json().then(function (body) {
      var sets = body && Array.isArray(body.titles) ? body.titles : [];
      var items = [];
      sets.forEach(function (set) { if (set && Array.isArray(set.items)) items = items.concat(set.items); });
      var complete = items.filter(function (item) { return item && item.au && item.pa !== undefined && item.pa !== null && item.pl; });
      return {
        key: key,
        httpStatus: response.status,
        ok: body && body.ok === true,
        sets: sets.length,
        items: items.length,
        provenanceComplete: complete.length,
        provenanceMissing: items.length - complete.length,
        error: body && body.error || null
      };
    });
  }).catch(function (err) {
    return { key: key, httpStatus: null, ok: false, sets: 0, items: 0,
      provenanceComplete: 0, provenanceMissing: 0, error: err.message };
  });
}

Promise.all(registry.SNAPSHOT_KEYS.map(auditKey)).then(function (rows) {
  var out = {
    readOnly: true,
    base: base,
    readLimit: limit,
    domains: rows.length,
    successfulEndpoints: rows.filter(function (r) { return r.ok; }).length,
    domainsWithSets: rows.filter(function (r) { return r.sets > 0; }).length,
    totalObservedSets: rows.reduce(function (n, r) { return n + r.sets; }, 0),
    totalObservedItems: rows.reduce(function (n, r) { return n + r.items; }, 0),
    totalCompleteProvenance: rows.reduce(function (n, r) { return n + r.provenanceComplete; }, 0),
    totalMissingProvenance: rows.reduce(function (n, r) { return n + r.provenanceMissing; }, 0),
    rows: rows
  };
  if (process.argv.indexOf('--json') !== -1) console.log(JSON.stringify(out, null, 2));
  else {
    console.log('Production title-transport audit (read-only; n=' + limit + ')');
    console.log(JSON.stringify({ domains: out.domains, successfulEndpoints: out.successfulEndpoints,
      domainsWithSets: out.domainsWithSets, totalObservedSets: out.totalObservedSets,
      totalObservedItems: out.totalObservedItems, totalCompleteProvenance: out.totalCompleteProvenance,
      totalMissingProvenance: out.totalMissingProvenance }, null, 2));
    rows.forEach(function (r) {
      console.log(r.key + ' sets=' + r.sets + ' items=' + r.items +
        ' provenance=' + r.provenanceComplete + '/' + r.items +
        (r.error ? ' error=' + r.error : ''));
    });
  }
  if (rows.some(function (r) { return !r.ok; })) process.exitCode = 1;
}).catch(function (err) {
  console.error('title transport audit failed: ' + err.message);
  process.exitCode = 1;
});

