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
var WRITE = process.argv.indexOf('--write') >= 0;
var QUEUE_OUT = path.join(ROOT, 'assets', 'data', 'deep', 'aggregate-treatment-provenance-queue.json');

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
var tasks = [];
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
  labels.forEach(function (k) {
    if (cube[k]) return;
    var item = a[k];
    tasks.push({
      id: 'aggregate-treatment-provenance-' + domain + '-' + norm(item.label).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      domain: domain,
      target: item.label,
      level: 'aggregate-treatment',
      authoringType: 'source provenance reconciliation needed',
      missingFields: ['exact discovery-cell match', 'sourceProvenance or citation'],
      existingContext: 'aggregate treatment is present, but no exact label match was found in the split discovery cells',
      sourceHints: 're-open the originating domain source; do not infer provenance from a similar treatment',
      requiredHumanAction: 'Locate the exact source and wire observation-level provenance, or explicitly retire/demote the treatment',
      priority: 1,
      whyItMatters: 'an unmatched aggregate treatment must not silently enter a downstream authoring or opportunity lane'
    });
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

var report = {
  readOnly: true,
  aggregateFiles: DOMAINS.length,
  cubeFiles: files.length,
  cubeTreatmentKeys: Object.keys(cube).length,
  tasks: tasks,
  rows: rows
};
if (WRITE) {
  report.readOnly = false;
  report.note = 'Reconciliation-only tasks. Not merged into per-domain authoring queues until reviewed.';
  report.generatedAt = new Date().toISOString();
  fs.writeFileSync(QUEUE_OUT, JSON.stringify(report, null, 2));
  console.error('wrote ' + path.relative(ROOT, QUEUE_OUT) + ': ' + tasks.length + ' tasks');
}
console.log(JSON.stringify(report, null, 2));
