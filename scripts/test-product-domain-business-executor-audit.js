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
  'agriculture', 'communication', 'culture', 'defense', 'finance', 'governance', 'industry', 'intelligence', 'law', 'medicine', 'religion', 'science'
]);
assert.equal(report.summary.domainBoundExecutorsImplemented, 12);
assert.equal(report.summary.actionReceiptsImplemented, 12);
assert.equal(report.summary.independentOutcomeObserversImplemented, 12);
assert.equal(report.summary.domainAuthorizedRollbacksImplemented, 12);
assert.equal(report.summary.sourceChainsComplete, 12);
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
assert.equal(communication.actionReceiptStrength, 'DURABLE_IDEMPOTENT_PLATFORM_COMMAND_RECEIPT');
assert.equal(communication.domainAuthorizedRollbackImplemented, true);
assert.equal(communication.sourceChainComplete, true);
assert.equal(finance.externalEnabled, false);

var culture = report.domains.find(function (row) { return row.productDomain === 'culture'; });
assert.equal(culture.actionReceiptStrength, 'DURABLE_B10_B14_ONE_SHOT_ASSET_RECEIPT');
assert.equal(culture.observerScope, 'PUBLIC_ASSET_BYTES_CONTENT_TYPE_AND_HASH');
assert.equal(culture.independentOutcomeObserverImplemented, true);
assert.equal(culture.domainAuthorizedRollbackImplemented, true);
assert.equal(culture.sourceChainComplete, true);
assert.equal(culture.externalEnabled, false);

var religion = report.domains.find(function (row) { return row.productDomain === 'religion'; });
assert.equal(religion.actionReceiptStrength, 'DURABLE_CAPPED_IDEMPOTENT_EMAIL_ACCEPTANCE_RECEIPT');
assert.equal(religion.observerScope, 'RESEND_READ_API_MAIL_SERVER_LAST_EVENT');
assert.equal(religion.independentOutcomeObserverImplemented, true);
assert.equal(religion.domainAuthorizedRollbackImplemented, true);
assert.equal(religion.switchAndBudgetEnforcedInExecutor, true);
assert.equal(religion.sourceChainComplete, true);
assert.equal(religion.externalEnabled, false);

var law = report.domains.find(function (row) { return row.productDomain === 'law'; });
assert.equal(law.actionReceiptStrength, 'DURABLE_B10_B14_IDEMPOTENT_LOB_ACCEPTANCE_RECEIPT');
assert.equal(law.observerScope, 'LOB_EXACT_LETTER_READ_RENDER_AND_EXPECTED_DELIVERY_STATE');
assert.equal(law.independentOutcomeObserverImplemented, true);
assert.equal(law.domainAuthorizedRollbackImplemented, true);
assert.equal(law.switchAndBudgetEnforcedInExecutor, true);
assert.equal(law.sourceChainComplete, true);
assert.equal(law.externalEnabled, false);

var intelligence = report.domains.find(function (row) { return row.productDomain === 'intelligence'; });
assert.equal(intelligence.actionReceiptStrength, 'DURABLE_B10_B14_IDEMPOTENT_EMAIL_ACCEPTANCE_RECEIPT');
assert.equal(intelligence.observerScope, 'RESEND_READ_API_MAIL_SERVER_LAST_EVENT');
assert.equal(intelligence.sourceChainComplete, true);
assert.equal(intelligence.externalEnabled, false);

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
assert.equal(agriculture.domainBoundExecutorImplemented, true);
assert.equal(agriculture.actionReceiptStrength, 'DURABLE_B10_B14_IDEMPOTENT_SERVICE_REQUEST_RECEIPT');
assert.equal(agriculture.observerScope, 'RESEND_SIGNED_INBOUND_COUNTERPARTY_RESPONSE');
assert.equal(agriculture.sourceChainComplete, true);
assert.equal(agriculture.externalEnabled, false);

var industry = report.domains.find(function (row) { return row.productDomain === 'industry'; });
assert.equal(industry.lane, 'crm');
assert.equal(industry.actionReceiptStrength, 'DURABLE_B10_B14_HUBSPOT_COMPANY_RECEIPT');
assert.equal(industry.observerScope, 'HUBSPOT_COMPANY_LIFECYCLE_HISTORY');
assert.equal(industry.sourceChainComplete, true);
assert.equal(industry.externalEnabled, false);

var defense = report.domains.find(function (row) { return row.productDomain === 'defense'; });
assert.equal(defense.lane, 'publication');
assert.equal(defense.actionReceiptStrength, 'DURABLE_B10_B14_OWNED_PUBLIC_ARTICLE_RECEIPT');
assert.equal(defense.observerScope, 'PUBLIC_ARTICLE_PRESENCE_AND_ANONYMOUS_SOURCE_LINK_ENGAGEMENT');
assert.equal(defense.sourceChainComplete, true);
assert.equal(defense.externalEnabled, false);

var governance = report.domains.find(function (row) { return row.productDomain === 'governance'; });
assert.equal(governance.lane, 'publication');
assert.equal(governance.actionReceiptStrength, 'DURABLE_B10_B14_OWNED_PUBLIC_ARTICLE_RECEIPT');
assert.equal(governance.observerScope, 'PUBLIC_ARTICLE_PRESENCE_AND_ANONYMOUS_SOURCE_LINK_ENGAGEMENT');
assert.equal(governance.sourceChainComplete, true);
assert.equal(governance.externalEnabled, false);

console.log('product domain business executor audit: contracts 20/20, bound executors 12/20, closed source chain 12/20, externally ready 0/20');
