#!/usr/bin/env node
'use strict';

/* Regression checks for the deep-diagnosis digest bridge.
 *
 * Canonical diagnosis circuits and authored functional circuits are different
 * representations. The digest must expose canonical circuits while still finding
 * treatments attached to the authored activation nodes.
 */

var fs = require('fs');
var path = require('path');
var assertCount = 0;
var failures = [];
var ROOT = path.join(__dirname, '..');
var DEEP = path.join(ROOT, 'assets', 'data', 'deep');

function check(label, condition) {
  assertCount++;
  if (condition) console.log('PASS ' + label);
  else { failures.push(label); console.log('FAIL ' + label); }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
}

var index = readJson('assets/data/opportunities-index.json');
var digestFiles = fs.readdirSync(DEEP).filter(function (f) { return /-diagnosis-digest\.json$/.test(f); });
var digestDomains = digestFiles.map(function (f) {
  return readJson(path.join('assets/data/deep', f)).domain;
});

check('twenty diagnosis digests are present', digestFiles.length === 20);
check('digest domains are unique', new Set(digestDomains).size === 20);
check('opportunity index counts every digest diagnosis',
  index.totalDiagnoses === digestFiles.reduce(function (n, f) {
    return n + readJson(path.join('assets/data/deep', f)).diagnoses.length;
  }, 0));
check('opportunity index counts the selected treatment arrays',
  index.totalTreatmentOpps === digestFiles.reduce(function (n, f) {
    var d = readJson(path.join('assets/data/deep', f));
    return n + d.diagnoses.reduce(function (m, x) { return m + (Array.isArray(x.tx) ? x.tx.length : 0); }, 0);
  }, 0));

var source = readJson('assets/data/domains/communication_accesscomm.json');
var issue = source.issues.find(function (x) { return x.id === 'COMMUNICATION_ACCESSCOMM_SYSTEM_FAILURE'; });
var authoredNode = issue && issue._authored && issue._authored[0] && issue._authored[0].nodeId;
var activation = (source.activations || []).find(function (x) { return x.brainNodeId === authoredNode; });
var authoredTreatment = activation && activation.treatments && activation.treatments[0] && activation.treatments[0].label;
var communication = readJson('assets/data/deep/communication-diagnosis-digest.json');
var digestIssue = communication.diagnoses.find(function (x) { return x.id === 'COMMUNICATION_ACCESSCOMM_SYSTEM_FAILURE'; });

check('canonical circuit remains the digest identity',
  !!digestIssue && digestIssue.circuits.indexOf('THAL') !== -1);
check('authored activation treatment survives canonical circuit reduction',
  !!authoredTreatment && !!digestIssue && digestIssue.tx.some(function (x) { return x.l === authoredTreatment; }));
check('agriculture remains the smaller 98-diagnosis surface',
  readJson('assets/data/deep/p2_agri-diagnosis-digest.json').diagnosisCount === 98);

if (failures.length) {
  console.error('\n' + failures.length + ' failed: ' + failures.join('; '));
  process.exitCode = 1;
} else {
  console.log('\n' + assertCount + '/' + assertCount + ' passed');
}

