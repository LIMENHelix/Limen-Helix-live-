#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var report = require('../lib/product-domain-energy-parity-audit.js').audit();

assert.equal(report.schemaVersion, 'product-domain-energy-parity-audit/1.0');
assert.equal(report.summary.separateBrains, 20);
assert.equal(report.summary.commonPhysiologyImplemented, 20);
assert.equal(report.summary.energyCustomImplementations, 1);
assert.equal(report.summary.genericPortImplementations, 19);
assert.equal(report.summary.phaseActuationEnabled, 9);
assert.equal(report.summary.phasePerceptArmed, 1);
assert.equal(report.summary.plasticityArmed, 20);
assert.equal(report.summary.externalAutonomyReady, 0);
assert.equal(report.businessExecutionQueue.length, 20);
assert(report.neurologistReviewQueue.length > 0);

var energy = report.domains.find(function (d) { return d.productDomain === 'energy'; });
var finance = report.domains.find(function (d) { return d.productDomain === 'finance'; });
var medicine = report.domains.find(function (d) { return d.productDomain === 'medicine'; });
assert.equal(energy.implementationMode, 'energy-custom-reference');
assert.equal(finance.implementationMode, 'generic-port-plus-domain-specialization');
assert.equal(finance.activation.phaseActuation, true);
assert.equal(finance.activation.phasePerceptArmed, false);
assert.equal(medicine.runtimeOwner, 'health');
assert(medicine.outwardGaps.includes('production-executor-unverified'));
assert(report.domains.every(function (d) {
  return d.commonPhysiologyImplemented && d.separateBrainFile && d.outwardGaps.length === 4;
}));

console.log('product domain Energy parity audit: implementation, activation, and external authority are separately measured');
