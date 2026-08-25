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
  'communication', 'culture', 'finance', 'intelligence', 'law', 'religion'
]);
assert.equal(report.summary.domainBoundExecutorsImplemented, 6);
assert.equal(report.summary.actionReceiptsImplemented, 5);
assert.equal(report.summary.independentOutcomeObserversImplemented, 1);
assert.equal(report.summary.domainAuthorizedRollbacksImplemented, 1);
assert.equal(report.summary.sourceChainsComplete, 1);
assert.equal(report.summary.productionVerifiedByDomain, 0);
assert.equal(report.summary.autonomousExternalReady, 0);

var finance = report.domains.find(function (row) { return row.productDomain === 'finance'; });
assert.equal(finance.sourceChainComplete, true);
assert.equal(finance.actionReceiptStrength, 'DURABLE_IDEMPOTENT_SANDBOX_COMMAND_RECEIPT');
assert.equal(finance.observerScope, 'PAPER_30_60_90_PENDING_ELIGIBLE_COMMAND_AND_HORIZON');
assert.equal(finance.productionVerifiedByDomain, false);
assert.equal(finance.externalEnabled, false);

var communication = report.domains.find(function (row) { return row.productDomain === 'communication'; });
assert.equal(communication.domainBoundExecutorImplemented, true);
assert.equal(communication.domainAuthorizedRollbackImplemented, false);
assert.equal(communication.independentOutcomeObserverImplemented, false);

var agriculture = report.domains.find(function (row) { return row.productDomain === 'agriculture'; });
assert.equal(agriculture.lane, 'homestead');
assert.equal(agriculture.domainBoundExecutorImplemented, false);
assert(agriculture.gaps.includes('domain-bound-production-executor-missing'));

console.log('product domain business executor audit: contracts 20/20, bound executors 6/20, closed source chain 1/20, externally ready 0/20');
