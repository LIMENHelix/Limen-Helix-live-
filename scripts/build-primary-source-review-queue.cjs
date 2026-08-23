'use strict';

/* Build a bounded source-identity review surface for the first outward lanes.
 * This resolves no identifiers, fetches no providers, and admits nothing to
 * the runtime. It turns identifiers already present in checked-in source data
 * into explicit review tasks with their portal/file fan-out preserved.
 */
var fs = require('fs');
var path = require('path');
var PIPE = require('../lib/domain-authoring-pipeline.js');

var ROOT = path.join(__dirname, '..');
var DOMAIN_ROOT = path.join(ROOT, 'assets', 'data', 'domains');
var QUEUE_ROOT = path.join(ROOT, 'assets', 'data', 'deep');
var OUT = path.join(QUEUE_ROOT, 'primary-source-review-queue.json');
var DOMAINS = ['science', 'medicine', 'finance'];
var WRITE = process.argv.indexOf('--write') >= 0;

function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function key(domain, type, identifier) { return domain + '|' + type + '|' + identifier.toLowerCase(); }

function build() {
  var grouped = {};
  var rows = [];
  DOMAINS.forEach(function (domain) {
    var queueFile = path.join(QUEUE_ROOT, domain + '-authoring-queue.json');
    var queue = read(queueFile);
    var filesSeen = {};
    (queue.tasks || []).forEach(function (task) {
      var sourceFile = task.observed && task.observed.sourceFile;
      if (!sourceFile || filesSeen[sourceFile]) return;
      filesSeen[sourceFile] = true;
      var value;
      try { value = read(path.join(DOMAIN_ROOT, sourceFile)); }
      catch (err) { rows.push({ domain: domain, sourceFile: sourceFile, error: 'SOURCE_READ_FAILED' }); return; }
      var ids = PIPE.extractIdentifiers(value);
      ids.dois.forEach(function (identifier) {
        var k = key(domain, 'DOI', identifier);
        var row = grouped[k] || (grouped[k] = { domain: domain, identifierType: 'DOI', identifier: identifier, sourceFiles: [], portalTargets: [] });
        if (row.sourceFiles.indexOf(sourceFile) < 0) row.sourceFiles.push(sourceFile);
        if (row.portalTargets.indexOf(task.target) < 0) row.portalTargets.push(task.target);
      });
      ids.pmids.forEach(function (identifier) {
        var k = key(domain, 'PMID', identifier);
        var row = grouped[k] || (grouped[k] = { domain: domain, identifierType: 'PMID', identifier: identifier, sourceFiles: [], portalTargets: [] });
        if (row.sourceFiles.indexOf(sourceFile) < 0) row.sourceFiles.push(sourceFile);
        if (row.portalTargets.indexOf(task.target) < 0) row.portalTargets.push(task.target);
      });
    });
    rows.push({ domain: domain, queueTasks: (queue.tasks || []).length, sampledSourceFiles: Object.keys(filesSeen).length });
  });
  var tasks = Object.keys(grouped).sort().map(function (k, index) {
    var item = grouped[k];
    return {
      id: 'primary-source-review-' + String(index + 1).padStart(4, '0'),
      domain: item.domain,
      identifierType: item.identifierType,
      identifier: item.identifier,
      sourceFiles: item.sourceFiles.sort(),
      portalTargets: item.portalTargets.sort(),
      status: 'UNRESOLVED',
      requiredReview: [
        'resolve the identifier to the canonical source record',
        'verify ownership, publication identity, domain relevance, and syndication independence',
        'record sourceUpdatedAt, retrievedAt, raw identity, units, and any transformation/version',
        'keep the result observational until the separately reviewed evidence gate admits it'
      ],
      evidenceEligible: false,
      consumedByRuntime: false
    };
  });
  return {
    schemaVersion: 'primary-source-review-queue/1.0',
    generatedAt: new Date().toISOString(),
    readOnlyAdmission: true,
    domains: DOMAINS,
    note: 'Identifiers are extracted from checked-in domain data only. No identifier is resolved or admitted as evidence by this artifact.',
    summary: {
      sampledSourceFiles: rows.filter(function (x) { return x.sampledSourceFiles; }).reduce(function (n, x) { return n + x.sampledSourceFiles; }, 0),
      uniqueUnresolvedIdentifiers: tasks.length,
      byDomain: DOMAINS.reduce(function (out, domain) { out[domain] = tasks.filter(function (x) { return x.domain === domain; }).length; return out; }, {})
    },
    rows: rows,
    tasks: tasks
  };
}

var report = build();
if (WRITE) fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));

