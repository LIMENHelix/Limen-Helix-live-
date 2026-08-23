/**
 * Read-only reconciliation between domain aggregate treatments and the split
 * treatment-discovery cells. This does not write queues or promote a claim.
 *
 * Run:
 *   node scripts/reconcile-treatment-provenance.js
 */
'use strict';
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var AGG_DIR = path.join(ROOT, 'assets', 'data', 'domains');
var CELL_DIR = path.join(ROOT, 'assets', 'data', 'treatment-discovery', 'by-node');
var DOMAINS = ['agriculture','communication','culture','defense','economy','education','energy',
  'environment','finance','governance','industry','infrastructure','intelligence','law','medicine',
  'population','religion','science','technology','trade'];
var AGGREGATE = { agriculture: 'p2_agri.json' };

function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function norm(value) { return String(value || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function key(domain, label) { return domain + '|' + norm(label); }

var aggregate = {};
DOMAINS.forEach(function (domain) {
  var file = path.join(AGG_DIR, AGGREGATE[domain] || domain + '.json');
  var data = read(file);
  aggregate[domain] = {};
  (data.activations || []).forEach(function (activation, ai) {
    (activation.treatments || []).forEach(function (treatment, ti) {
      var label = treatment.label || treatment.name;
      if (!label) return;
      var k = key(domain, label);
      if (!aggregate[domain][k]) aggregate[domain][k] = { domain: domain, label: label, aggregateOccurrences: 0, activationIndexes: [] };
      aggregate[domain][k].aggregateOccurrences++;
      aggregate[domain][k].activationIndexes.push(ai + ':' + ti);
    });
  });
});

var cube = {};
var files = fs.existsSync(CELL_DIR) ? fs.readdirSync(CELL_DIR).filter(function (name) { return name.endsWith('.json'); }) : [];
files.forEach(function (name) {
  var data = read(path.join(CELL_DIR, name));
  (data.cells || []).forEach(function (cell) {
    var domain = cell.comparisonDomain;
    if (DOMAINS.indexOf(domain) < 0) return;
    (cell.domainTreatments || []).forEach(function (treatment) {
      var label = treatment.label || treatment.name;
      if (!label) return;
      var k = key(domain, label);
      if (!cube[k]) cube[k] = { domain: domain, label: label, cubeOccurrences: 0, withSourceProvenance: 0, withCitation: 0, verdicts: {} };
      var row = cube[k];
      row.cubeOccurrences++;
      if (treatment.sourceProvenance || treatment.source || treatment.url) row.withSourceProvenance++;
      if (Array.isArray(treatment.citations) && treatment.citations.length) row.withCitation++;
      var verdict = treatment.verification && treatment.verification.verdict || 'NONE';
      row.verdicts[verdict] = (row.verdicts[verdict] || 0) + 1;
    });
  });
});

var rows = [];
DOMAINS.forEach(function (domain) {
  var a = aggregate[domain];
  var labels = Object.keys(a);
  var matched = 0, unmatched = 0, matchedWithProvenance = 0;
  labels.forEach(function (k) {
    var c = cube[k];
    if (!c) { unmatched++; return; }
    matched++;
    if (c.withSourceProvenance || c.withCitation) matchedWithProvenance++;
  });
  rows.push({
    domain: domain,
    aggregateUniqueTreatments: labels.length,
    aggregateOccurrences: labels.reduce(function (sum, k) { return sum + a[k].aggregateOccurrences; }, 0),
    cubeMatchedUniqueTreatments: matched,
    cubeUnmatchedAggregateTreatments: unmatched,
    matchedWithAnyProvenanceOrCitation: matchedWithProvenance
  });
});

console.log(JSON.stringify({
  readOnly: true,
  aggregateFiles: DOMAINS.length,
  cubeFiles: files.length,
  cubeTreatmentKeys: Object.keys(cube).length,
  rows: rows
}, null, 2));
