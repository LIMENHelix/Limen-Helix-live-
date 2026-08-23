#!/usr/bin/env node
'use strict';

/* Read-only coverage audit for the generic deep-directive surface.
 * This is deliberately separate from authoring queues and quality indices: a
 * populated directive pool proves only that existing portal data was traversed,
 * not that it is source-complete or safe to act on.
 */

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');
var DEEP = path.join(ROOT, 'assets', 'data', 'deep');
var DOMAINS = ['p2_agri','communication','culture','defense','economy','education','energy','environment','finance',
  'governance','industry','infrastructure','intelligence','law','medicine','population','religion','science','technology','trade'];

var rows = DOMAINS.map(function (domain) {
  var file = path.join(DEEP, domain + '-deep-directives.json');
  if (!fs.existsSync(file)) return { domain: domain, status: 'missing' };
  var doc;
  try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return { domain: domain, status: 'unparseable', reason: e.message }; }
  var t = doc.traversal || {};
  return {
    domain: domain,
    status: t.filesTraversed > 0 && t.totalCandidates > 0 && t.retained > 0 ? 'populated' : 'empty',
    generatedAt: doc.generatedAt || null,
    filesTraversed: t.filesTraversed || 0,
    totalDirectives: t.totalDirectives || 0,
    totalCandidates: t.totalCandidates || 0,
    retained: t.retained || 0,
    maxDepth: t.maxDepth || null
  };
});

var summary = {
  readOnly: true,
  domains: rows.length,
  populated: rows.filter(function (r) { return r.status === 'populated'; }).length,
  empty: rows.filter(function (r) { return r.status === 'empty'; }).length,
  missing: rows.filter(function (r) { return r.status === 'missing'; }).length,
  unparseable: rows.filter(function (r) { return r.status === 'unparseable'; }).length,
  filesTraversed: rows.reduce(function (n, r) { return n + (r.filesTraversed || 0); }, 0),
  totalDirectives: rows.reduce(function (n, r) { return n + (r.totalDirectives || 0); }, 0),
  totalCandidates: rows.reduce(function (n, r) { return n + (r.totalCandidates || 0); }, 0),
  retained: rows.reduce(function (n, r) { return n + (r.retained || 0); }, 0)
};

if (process.argv.indexOf('--json') !== -1) {
  console.log(JSON.stringify({ summary: summary, domains: rows }, null, 2));
} else {
  console.log('Deep-directive coverage audit (read-only)');
  console.log(JSON.stringify(summary, null, 2));
  rows.forEach(function (r) {
    console.log(r.domain + ' ' + r.status +
      (r.status === 'populated' ? ' files=' + r.filesTraversed + ' candidates=' + r.totalCandidates + ' retained=' + r.retained :
        (r.reason ? ' ' + r.reason : '')));
  });
}

