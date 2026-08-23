/**
 * Job 3 admission audit.
 *
 * The Energy authoring queue is an external-bundle gap queue. The other deep
 * directive files are generated/retrieved surfaces and must not be copied into
 * that queue as if every directive were a human-authoring task. This audit
 * records the measured surface and creates one explicit reconciliation admission
 * for each domain whose deep surface has no corresponding authoring queue.
 *
 * Read-only by default. Pass --write to write
 * assets/data/deep/domain-authoring-admissions.json.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');
var DEEP = path.join(ROOT, 'assets', 'data', 'deep');
var OUT = path.join(DEEP, 'domain-authoring-admissions.json');
var DOMAINS = ['agriculture','communication','culture','defense','economy','education','energy',
  'environment','finance','governance','industry','infrastructure','intelligence','law','medicine',
  'population','religion','science','technology','trade'];

function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function sourceName(domain) { return domain === 'agriculture' ? 'p2_agri' : domain; }
function countSources(directives) {
  var withCitation = 0, withMonitoring = 0, withTarget = 0;
  directives.forEach(function (d) {
    if (d.treatmentCitation || d.treatmentCite || d.treatmentEvidence) withCitation++;
    if (d.treatmentMonitoring) withMonitoring++;
    if (d.treatmentTarget) withTarget++;
  });
  return { withCitation: withCitation, withMonitoring: withMonitoring, withTarget: withTarget };
}

var rows = DOMAINS.map(function (domain) {
  var stem = sourceName(domain);
  var directives = read(path.join(DEEP, stem + '-deep-directives.json'));
  var digest = read(path.join(DEEP, stem + '-diagnosis-digest.json'));
  var queueFile = path.join(DEEP, domain + '-authoring-queue.json');
  var queue = fs.existsSync(queueFile) ? read(queueFile) : null;
  var ds = directives.directives || [];
  var source = countSources(ds);
  var hasQueueTasks = !!(queue && queue.totalTasks > 0);
  return {
    domain: domain,
    deepDirectiveFile: stem + '-deep-directives.json',
    deepDirectiveCount: ds.length,
    deepFilesTraversed: directives.traversal && directives.traversal.filesTraversed || null,
    directiveCitationCount: source.withCitation,
    directiveMonitoringCount: source.withMonitoring,
    directiveTargetCount: source.withTarget,
    digestDiagnosisCount: digest.diagnosisCount || (digest.diagnoses || []).length,
    digestTreatmentTotal: digest.treatmentTotal || null,
    existingQueueTasks: queue && typeof queue.totalTasks === 'number' ? queue.totalTasks : null,
    admissionStatus: hasQueueTasks ? 'EXTERNAL_AUTHORING_QUEUE_PRESENT' : 'REQUIRES_QUEUE_RECONCILIATION',
    admissionReason: hasQueueTasks
      ? 'existing queue is domain-specific and is not replaced by generated directives'
      : 'deep surface exists, but no reviewed mapping says which items are human-authoring work; reconcile before creating tasks',
    nextAction: hasQueueTasks
      ? 'reconcile existing queue against source bundle and retain provenance'
      : 'review domain-specific source/authoring contract; create tasks only for measured gaps or record abstention'
  };
});

var output = {
  schemaVersion: 'domain-authoring-admissions/1.0',
  generatedAt: new Date().toISOString(),
  readOnlyMeasurement: true,
  note: 'Admission/reconciliation inventory, not a fabricated authoring task queue. Generated directives are not human-authoring tasks by default.',
  domains: rows.length,
  existingQueueDomains: rows.filter(function (r) { return r.admissionStatus === 'EXTERNAL_AUTHORING_QUEUE_PRESENT'; }).length,
  reconciliationRequiredDomains: rows.filter(function (r) { return r.admissionStatus === 'REQUIRES_QUEUE_RECONCILIATION'; }).length,
  rows: rows
};
console.log(JSON.stringify(output, null, 2));
if (process.argv.indexOf('--write') >= 0) fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n');
