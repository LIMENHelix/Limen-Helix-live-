#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var report = require('../lib/product-domain-energy-parity-audit.js').audit();

assert.equal(report.schemaVersion, 'product-domain-energy-parity-audit/1.2');
assert.equal(report.summary.separateBrains, 20);
assert.equal(report.summary.commonPhysiologyImplemented, 20);
assert.equal(report.summary.brainV2LocalSpineComplete, 20);
assert.equal(report.summary.domainLocalDepthComplete, 20);
assert.equal(report.summary.energyCustomImplementations, 1);
assert.equal(report.summary.domainLocalExtensionImplementations, 19);
assert.equal(report.summary.genericPortImplementations, 0);
assert.equal(report.summary.phaseActuationEnabled, 9);
assert.equal(report.summary.phasePerceptArmed, 1);
assert.equal(report.summary.plasticityArmed, 20);
assert.equal(report.summary.externalAutonomyReady, 0);
assert.equal(report.businessExecutionQueue.length, 20);
assert.equal(report.domainLocalRepairQueue.length, 0);
assert(report.neurologistReviewQueue.length > 0);

var energy = report.domains.find(function (d) { return d.productDomain === 'energy'; });
var finance = report.domains.find(function (d) { return d.productDomain === 'finance'; });
var medicine = report.domains.find(function (d) { return d.productDomain === 'medicine'; });
assert.equal(energy.implementationMode, 'energy-custom-reference');
assert.equal(energy.domainLocalDepthComplete, true);
assert.equal(energy.brainV2LocalSpineComplete, true);
assert.equal(finance.implementationMode, 'domain-local-extension');
assert.equal(finance.domainLocalDepthComplete, true);
assert.deepEqual(finance.domainLocalDepthGaps, []);
assert.equal(finance.activation.phaseActuation, true);
assert.equal(finance.activation.phasePerceptArmed, false);
assert.equal(medicine.runtimeOwner, 'health');
assert(medicine.outwardGaps.includes('production-executor-unverified'));
assert(report.domains.every(function (d) { return d.brainV2LocalSpineGaps.length === 0; }));
assert(report.domains.every(function (d) { return d.domainLocalDepthGaps.length === 0; }));
assert.equal(report.referencePosture.activeInference, 'SHADOW_ADVISORY_NO_LIVE_CONSUMER');
assert.equal(report.referencePosture.outcome, 'NEXT-CYCLE_SELF_CONSISTENCY_NOT_AN_INDEPENDENT_BUSINESS_OUTCOME');
assert(report.domains.every(function (d) {
  return d.commonPhysiologyImplemented && d.separateBrainFile && d.outwardGaps.length === 4;
}));

var refreshSource = fs.readFileSync(path.join(__dirname, '..', 'handlers', 'brain-cognition-refresh.js'), 'utf8');
var baseAt = refreshSource.indexOf("'assets/js/domain-brains/domain-brain-base.js'");
['limen-k4-selfconsistency.js', 'limen-plasticity.js', 'limen-active-inference.js'].forEach(function (file) {
  var at = refreshSource.indexOf("'assets/js/" + file + "'");
  assert(at >= 0 && at < baseAt, file + ' must load before domain-brain-base in the autonomous cognition VM');
});
assert(!refreshSource.includes("'assets/js/limen-phase-percept.js'"), 'Thing 2 / phase percept remains outside this activation');

console.log('product domain Energy parity audit: implementation, activation, and external authority are separately measured');
