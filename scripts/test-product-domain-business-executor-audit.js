#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var Audit = require('../lib/product-domain-business-executor-audit.js');
var LaneContract = require('../brain-v2/core/sandbox-lane-contract.js');
var report = Audit.audit();

assert.equal(report.readOnly, true);
assert.equal(report.domains.length, 20);
assert.equal(report.summary.contractsDeclared, 20);
assert.equal(report.laneSurfaces.length, 13);
assert.deepEqual(report.laneSurfaces.map(function (row) { return row.lane; }).sort(), LaneContract.list().sort());
assert(report.laneSurfaces.every(function (row) { return row.filesPresent; }));

var bound = report.domains.filter(function (row) { return row.domainBoundExecutorImplemented; });
assert.deepEqual(bound.map(function (row) { return row.productDomain; }).sort(), [
  'communication', 'culture', 'finance', 'intelligence', 'law', 'medicine', 'religion', 'science'
]);
assert.equal(report.summary.domainBoundExecutorsImplemented, 8);
assert.equal(report.summary.actionReceiptsImplemented, 7);
assert.equal(report.summary.independentOutcomeObserversImplemented, 4);
assert.equal(report.summary.domainAuthorizedRollbacksImplemented, 3);
assert.equal(report.summary.sourceChainsComplete, 3);
assert.equal(report.summary.productionVerifiedByDomain, 0);
assert.equal(report.summary.autonomousExternalReady, 0);

var finance = report.domains.find(function (row) { return row.productDomain === 'finance'; });
assert.equal(finance.sourceChainComplete, true);
assert.equal(finance.actionReceiptStrength, 'DURABLE_IDEMPOTENT_SANDBOX_COMMAND_RECEIPT');
assert.equal(finance.observerScope, 'PAPER_30_60_90_PENDING_ELIGIBLE_COMMAND_AND_HORIZON');
assert.equal(finance.productionVerifiedByDomain, false);
var communication = report.domains.filter(function (row) { return row.productDomain === 'communication'; })[0];
assert.equal(communication.independentOutcomeObserverImplemented, true);
assert.equal(communication.observerScope, 'PUBLIC_APPVIEW_ENGAGEMENT_SNAPSHOT');
assert.equal(communication.domainAuthorizedRollbackImplemented, false);
assert.equal(finance.externalEnabled, false);

assert.equal(communication.domainBoundExecutorImplemented, true);

var science = report.domains.find(function (row) { return row.productDomain === 'science'; });
var medicine = report.domains.find(function (row) { return row.productDomain === 'medicine'; });
assert.equal(science.domainBoundExecutorImplemented, true);
assert.equal(medicine.domainBoundExecutorImplemented, true);
assert.equal(science.actionReceiptStrength, 'DURABLE_B14_COMMAND_AND_ARTIFACT_READBACK_RECEIPT');
assert.equal(medicine.actionReceiptStrength, 'DURABLE_B14_COMMAND_AND_ARTIFACT_READBACK_RECEIPT');
assert.equal(science.independentOutcomeObserverImplemented, true);
assert.equal(medicine.independentOutcomeObserverImplemented, true);
assert.equal(science.domainAuthorizedRollbackImplemented, true);
assert.equal(medicine.domainAuthorizedRollbackImplemented, true);
assert.equal(science.sourceChainComplete, true);
assert.equal(medicine.sourceChainComplete, true);
assert.equal(science.observerScope, 'EXTERNAL_EVALUATION_INPUT_GATED');
assert.equal(medicine.observerScope, 'EXTERNAL_EVALUATION_INPUT_GATED');

var agriculture = report.domains.find(function (row) { return row.productDomain === 'agriculture'; });
assert.equal(agriculture.lane, 'homestead');
assert.equal(agriculture.domainBoundExecutorImplemented, false);
assert(agriculture.gaps.includes('domain-bound-production-executor-missing'));

console.log('product domain business executor audit: contracts 20/20, bound executors 8/20, closed source chain 3/20, externally ready 0/20');
