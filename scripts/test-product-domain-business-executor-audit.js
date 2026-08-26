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
  'agriculture', 'communication', 'culture', 'defense', 'economy', 'education', 'energy', 'environment', 'finance', 'governance', 'industry', 'infrastructure', 'intelligence', 'law', 'medicine', 'population', 'religion', 'science', 'technology', 'trade'
]);
assert.equal(report.summary.domainBoundExecutorsImplemented, 20);
assert.equal(report.summary.actionReceiptsImplemented, 20);
assert.equal(report.summary.independentOutcomeObserversImplemented, 20);
assert.equal(report.summary.domainAuthorizedRollbacksImplemented, 20);
assert.equal(report.summary.sourceChainsComplete, 20);
assert.equal(report.summary.productionVerifiedByDomain, 0);
assert.equal(report.summary.autonomousExternalReady, 0);

var finance = report.domains.find(function (row) { return row.productDomain === 'finance'; });
assert.equal(finance.sourceChainComplete, true);
assert.equal(finance.actionReceiptStrength, 'DURABLE_IDEMPOTENT_SANDBOX_COMMAND_RECEIPT');
assert.equal(finance.observerScope, 'PAPER_30_60_90_PENDING_ELIGIBLE_COMMAND_AND_HORIZON');
assert.equal(finance.productionVerifiedByDomain, false);
var economy = report.domains.find(function (row) { return row.productDomain === 'economy'; });
assert.equal(economy.domainBoundExecutorImplemented, true);
assert.equal(economy.actionReceiptStrength, 'DURABLE_B10_B14_DOMAIN_OWNED_PAPER_BROKER_RECEIPT');
assert.equal(economy.observerScope, 'ECONOMY_PAPER_30_60_90_INDEPENDENT_ACCOUNT_AND_MARKET_RESOLUTION');
assert.equal(economy.domainAuthorizedRollbackImplemented, true);
assert.equal(economy.sourceChainComplete, true);
assert.equal(economy.externalEnabled, false);
var energy = report.domains.find(function (row) { return row.productDomain === 'energy'; });
assert.equal(energy.domainBoundExecutorImplemented, true);
assert.equal(energy.actionReceiptStrength, 'DURABLE_B10_B14_DOMAIN_OWNED_PAPER_BROKER_RECEIPT');
assert.equal(energy.observerScope, 'ENERGY_PAPER_30_60_90_INDEPENDENT_ACCOUNT_AND_MARKET_RESOLUTION');
assert.equal(energy.domainAuthorizedRollbackImplemented, true);
assert.equal(energy.sourceChainComplete, true);
assert.equal(energy.externalEnabled, false);
var technology = report.domains.find(function (row) { return row.productDomain === 'technology'; });
assert.equal(technology.domainBoundExecutorImplemented, true);
assert.equal(technology.actionReceiptStrength, 'DURABLE_B10_B14_DOMAIN_OWNED_PAPER_BROKER_RECEIPT');
assert.equal(technology.observerScope, 'TECHNOLOGY_PAPER_30_60_90_INDEPENDENT_ACCOUNT_AND_MARKET_RESOLUTION');
assert.equal(technology.domainAuthorizedRollbackImplemented, true);
assert.equal(technology.sourceChainComplete, true);
assert.equal(technology.externalEnabled, false);
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

var education = report.domains.find(function (row) { return row.productDomain === 'education'; });
assert.equal(education.domainBoundExecutorImplemented, true);
assert.equal(education.actionReceiptStrength, 'DURABLE_B14_COMMAND_AND_ARTIFACT_READBACK_RECEIPT');
assert.equal(education.independentOutcomeObserverImplemented, true);
assert.equal(education.domainAuthorizedRollbackImplemented, true);
assert.equal(education.sourceChainComplete, true);
assert.equal(education.observerScope, 'EXTERNAL_EVALUATION_INPUT_GATED');
assert.equal(education.externalEnabled, false);

var environment = report.domains.find(function (row) { return row.productDomain === 'environment'; });
assert.equal(environment.domainBoundExecutorImplemented, true);
assert.equal(environment.actionReceiptStrength, 'DURABLE_B14_COMMAND_AND_ARTIFACT_READBACK_RECEIPT');
assert.equal(environment.independentOutcomeObserverImplemented, true);
assert.equal(environment.domainAuthorizedRollbackImplemented, true);
assert.equal(environment.sourceChainComplete, true);
assert.equal(environment.observerScope, 'EXTERNAL_EVALUATION_INPUT_GATED');
assert.equal(environment.externalEnabled, false);

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

var infrastructure = report.domains.find(function (row) { return row.productDomain === 'infrastructure'; });
assert.equal(infrastructure.lane, 'real-estate');
assert.equal(infrastructure.actionReceiptStrength, 'DURABLE_B10_B14_NON_BINDING_PROPERTY_INQUIRY_RECEIPT');
assert.equal(infrastructure.observerScope, 'RESEND_SIGNED_INBOUND_COUNTERPARTY_RESPONSE_UNCLASSIFIED_ZERO_CREDIT');
assert.equal(infrastructure.sourceChainComplete, true);
assert.equal(infrastructure.externalEnabled, false);

var population = report.domains.find(function (row) { return row.productDomain === 'population'; });
assert.equal(population.lane, 'real-estate');
assert.equal(population.actionReceiptStrength, 'DURABLE_B10_B14_NON_BINDING_PROPERTY_INQUIRY_RECEIPT');
assert.equal(population.observerScope, 'RESEND_SIGNED_INBOUND_COUNTERPARTY_RESPONSE_UNCLASSIFIED_ZERO_CREDIT');
assert.equal(population.sourceChainComplete, true);
assert.equal(population.externalEnabled, false);

var trade = report.domains.find(function (row) { return row.productDomain === 'trade'; });
assert.equal(trade.lane, 'auction');
assert.equal(trade.actionReceiptStrength, 'DURABLE_B10_B14_OWNED_MARKETPLACE_LISTING_RECEIPT');
assert.equal(trade.observerScope, 'PUBLIC_OWNED_MARKETPLACE_LISTING_PRESENCE_ZERO_CREDIT_NO_ORDER_OR_SALE');
assert.equal(trade.sourceChainComplete, true);
assert.equal(trade.externalEnabled, false);

console.log('product domain business executor audit: contracts 20/20, bound executors 20/20, closed source chain 20/20, externally ready 0/20');
