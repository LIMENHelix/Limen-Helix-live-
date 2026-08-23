'use strict';

/*
 * Build the domain-authoring reconciliation queue.
 *
 * This is deliberately not an authoring queue. It records the measured work
 * needed to admit a domain into its own authoring pipeline. Empty source
 * queues are abstentions, not evidence that a domain has no work.
 */
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var DEEP = path.join(ROOT, 'assets', 'data', 'deep');
var OUT = path.join(DEEP, 'domain-authoring-reconciliation-queue.json');
var DOMAINS = ['agriculture','communication','culture','defense','economy','education','energy',
  'environment','finance','governance','industry','infrastructure','intelligence','law','medicine',
  'population','religion','science','technology','trade'];

function read(name) {
  var file = path.join(DEEP, name);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function n(value) { return typeof value === 'number' ? value : 0; }
function stem(domain) { return domain === 'agriculture' ? 'agriculture' : domain; }

function row(domain) {
  var queue = read(domain + '-authoring-queue.json');
  var admissions = read('domain-authoring-admissions.json');
  var admission = admissions && (admissions.rows || []).filter(function (r) { return r.domain === domain; })[0];
  var cortex = read(domain + '-certified-cortex-index.json');
  var quality = read(domain + '-portal-quality-index.json');
  var directives = read((domain === 'agriculture' ? 'p2_agri' : domain) + '-deep-directives.json');
  var digest = read((domain === 'agriculture' ? 'p2_agri' : domain) + '-diagnosis-digest.json');
  var existing = queue && n(queue.totalTasks);
  var candidates = quality && Array.isArray(quality.authoringCandidates) ? quality.authoringCandidates.length : 0;
  var rehydration = cortex && Array.isArray(cortex.needsRehydration) ? cortex.needsRehydration.length : 0;
  var bundles = cortex && cortex.evidenceEligible && Array.isArray(cortex.evidenceEligible.externalBundles)
    ? cortex.evidenceEligible.externalBundles.length : 0;
  var pipelineRan = candidates > 0 || rehydration > 0 || bundles > 0 || (quality && n(quality.sampledTotal) > 0);
  var status = existing > 0 ? 'EXISTING_AUTHORING_QUEUE'
    : pipelineRan ? 'PIPELINE_OUTPUT_REQUIRES_REVIEW'
    : 'PIPELINE_NOT_RUN_OR_NO_ADMISSIBLE_GAPS';
  return {
    domain: domain,
    status: status,
    existingAuthoringTasks: existing,
    measured: {
      deepDirectiveCount: admission ? n(admission.deepDirectiveCount) : directives && Array.isArray(directives.directives) ? directives.directives.length : 0,
      digestDiagnosisCount: admission ? n(admission.digestDiagnosisCount) : digest ? n(digest.diagnosisCount) : 0,
      digestTreatmentTotal: admission ? admission.digestTreatmentTotal : digest ? digest.treatmentTotal : null,
      qualitySampled: quality ? n(quality.sampledTotal) : 0,
      qualityAuthoringCandidates: candidates,
      cortexNeedsRehydration: rehydration,
      cortexExternalBundles: bundles,
      consumedByRuntime: cortex ? cortex.consumedByRuntime === true : false
    },
    abstention: existing > 0 ? null : {
      reason: status === 'PIPELINE_NOT_RUN_OR_NO_ADMISSIBLE_GAPS'
        ? 'no domain-specific authoring pipeline output is present; do not infer that the domain has no work'
        : 'pipeline output exists but has not been reviewed into a domain authoring queue',
      requiredAction: status === 'PIPELINE_NOT_RUN_OR_NO_ADMISSIBLE_GAPS'
        ? 'run the domain-specific pipeline, then review its source and provenance admissions'
        : 'review pipeline gaps and admit only measured authoring tasks with provenance',
      sourceFiles: [
        (domain === 'agriculture' ? 'p2_agri' : domain) + '-deep-directives.json',
        (domain === 'agriculture' ? 'p2_agri' : domain) + '-diagnosis-digest.json',
        domain + '-portal-quality-index.json',
        domain + '-certified-cortex-index.json'
      ]
    }
  };
}

var rows = DOMAINS.map(row);
var tasks = rows.filter(function (r) { return r.abstention; }).map(function (r, i) {
  return {
    taskId: 'domain-authoring-reconcile-' + r.domain,
    domain: r.domain,
    priority: r.domain === 'science' || r.domain === 'medicine' || r.domain === 'finance' ? 1 : 2,
    type: 'domain-pipeline-admission',
    status: 'OPEN',
    measuredStatus: r.status,
    requiredAction: r.abstention.requiredAction,
    reason: r.abstention.reason,
    sourceFiles: r.abstention.sourceFiles,
    createdOrder: i
  };
});

var output = {
  schemaVersion: 'domain-authoring-reconciliation-queue/1.0',
  generatedAt: new Date().toISOString(),
  readOnlyAdmission: true,
  note: 'Reconciliation admissions are not authored opportunities, evidence, diagnoses, or execution input. No candidate content is fabricated.',
  domains: rows.length,
  existingAuthoringQueueDomains: rows.filter(function (r) { return r.status === 'EXISTING_AUTHORING_QUEUE'; }).length,
  openReconciliationTasks: tasks.length,
  rows: rows,
  tasks: tasks
};

if (process.argv.indexOf('--write') >= 0) fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
