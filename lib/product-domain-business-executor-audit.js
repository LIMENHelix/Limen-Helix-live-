'use strict';

/**
 * Read-only source audit for the business/motor half of the 20 product brains.
 *
 * A lane declaration is not an executor, and an executor is not a closed loop.
 * This ledger therefore measures each boundary separately:
 *
 *   domain contract -> domain-bound executor -> action receipt
 *   -> independent outcome observer -> rollback -> switch/budget
 *
 * It does not call providers, Redis, brokers, or deployed endpoints.
 */

var fs = require('node:fs');
var path = require('node:path');
var ProductAudit = require('./product-domain-brain-audit.js');
var LaneContract = require('../brain-v2/core/sandbox-lane-contract.js');

var ROOT = path.join(__dirname, '..');

function read(relative) {
  var file = path.join(ROOT, relative);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function proves(spec) {
  if (!spec) return false;
  return spec.every(function (claim) {
    var source = read(claim.file);
    return source && claim.tokens.every(function (token) { return source.indexOf(token) >= 0; });
  });
}

function filesExist(files) {
  return files.every(function (file) { return fs.existsSync(path.join(ROOT, file)); });
}

/* Only these six production paths currently import the product-motor
 * authorization adapter and bind it to an exact owner + lane pair. Other APIs
 * may send, publish, list, or store data, but they are not yet effectors of the
 * owning product brain and must not be counted as such. */
var BINDINGS = {
  communication: {
    lane: 'social',
    executor: [{ file: 'handlers/social-cron.js', tokens: [
      "motorAuthorization.authorize(motorStore, 'communication', 'social'",
      'social.postToBluesky(post.text)'
    ] }],
    receipt: [{ file: 'handlers/social-cron.js', tokens: ['uri: r.uri', 'await db.set(LAST_KEY'] }],
    receiptStrength: 'PROVIDER_ID_RECORDED_NO_STRICT_READBACK',
    switchBudget: [{ file: 'lib/social-post.js', tokens: ['SOCIAL_POSTING_ENABLED', 'postingBlocked', 'claimRateSlot'] }],
    rollback: null,
    rollbackNote: 'delete utility exists, but no domain-authorized rollback command is wired',
    observer: null
  },
  culture: {
    lane: 'hero-image',
    executor: [{ file: 'handlers/hero-image.js', tokens: [
      "motorAuthorization.authorize(motorStore, 'culture', 'hero-image'",
      'await fetch(ENDPOINT'
    ] }],
    receipt: [{ file: 'handlers/hero-image.js', tokens: ['await db.set(STORE_KEY', 'motorReceiptId'] }],
    receiptStrength: 'ASSET_RECORD_NO_STRICT_READBACK',
    switchBudget: [{ file: 'handlers/hero-image.js', tokens: ["require('../lib/ai-kill-switch')", "require('../lib/spend-meter')", 'reserve('] }],
    rollback: null,
    rollbackNote: 'no domain-authorized replace/remove command is wired',
    observer: null
  },
  finance: {
    lane: 'broker/order',
    executor: [{ file: 'lib/finance-paper-executor.js', tokens: [
      "motorAuthorization.authorize(store, 'finance', 'broker/order'",
      'b14.submitApproved'
    ] }],
    receipt: [{ file: 'lib/tradier-b14.js', tokens: [
      "type: 'RECEIPT_PERSISTED'",
      'command.receipt = { orderId:',
      'setIfAbsent(commandKey(commandId)'
    ] }],
    receiptStrength: 'DURABLE_IDEMPOTENT_SANDBOX_COMMAND_RECEIPT',
    switchBudget: [
      { file: 'lib/finance-b14-bridge.js', tokens: ['previewAutonomyEnabled', 'orderAutonomyEnabled', 'executionReadiness'] },
      { file: 'lib/finance-trade-decision.js', tokens: ['HARD_MAX_NOTIONAL_USD', 'maxGrossNotionalUsd', 'MIN_ACTION_CONFIDENCE'] }
    ],
    rollback: [
      { file: 'handlers/tradier-b14.js', tokens: ["body.action === 'cancel'", 'b14.cancelApproved'] },
      { file: 'lib/tradier-b14.js', tokens: ["type: 'CANCEL_RECEIPT_PERSISTED'", 'broker.cancelOrder'] }
    ],
    rollbackNote: 'sandbox cancel is identity-bound and separately receipted',
    observer: [{ file: 'handlers/limen-investment-outcome-observer.js', tokens: [
      'observer.inspectCommand',
      'outcome.recordAutonomousOutcome',
      "executionMode: 'paper'"
    ] }],
    observerScope: 'PAPER_30_60_90_PENDING_ELIGIBLE_COMMAND_AND_HORIZON'
  },
  intelligence: {
    lane: 'autopilot',
    executor: [{ file: 'handlers/autopilot.js', tokens: [
      "motorAuthorization.authorize(motorStore, 'intelligence', 'autopilot'",
      'send.sendToLead'
    ] }],
    receipt: null,
    receiptStrength: 'NONE',
    switchBudget: [{ file: 'handlers/autopilot.js', tokens: ['cfgT.armed', "cfg.mode === 'control'", 'cfg.maxPerTick'] }],
    rollback: null,
    rollbackNote: 'disarm/suppression exists, but kill-and-compensate rollback is not wired',
    observer: null
  },
  law: {
    lane: 'automail',
    executor: [{ file: 'handlers/homestead-automail.js', tokens: [
      "motorAuthorization.authorize(motorStore, 'law', 'automail'",
      'https://api.lob.com/v1/letters'
    ] }],
    receipt: [{ file: 'handlers/homestead-automail.js', tokens: ['id: jr.id', 'mailedTotal'] }],
    receiptStrength: 'PROVIDER_ID_RECORDED_NO_STRICT_READBACK',
    switchBudget: [{ file: 'handlers/homestead-automail.js', tokens: ['st.armed', 'st.cap', 'minLeadDays'] }],
    rollback: null,
    rollbackNote: 'no provider cancellation receipt or suppression compensation is wired',
    observer: null
  },
  religion: {
    lane: 'subscriber-email',
    executor: [{ file: 'handlers/subscriber-digest.js', tokens: [
      "motorAuthorization.authorize(motorStore, 'religion', 'subscriber-email'",
      'crm.sendToLead'
    ] }],
    receipt: [{ file: 'handlers/subscriber-digest.js', tokens: ['subs.markSent', "row.action = 'sent'"] }],
    receiptStrength: 'SEND_ACCEPTANCE_RECORDED_NO_DELIVERY_WEBHOOK',
    switchBudget: [{ file: 'handlers/subscriber-digest.js', tokens: ['reallySend', 'MAX_SEND'] }],
    rollback: null,
    rollbackNote: 'no domain-authorized suppress/correct rollback command is wired',
    observer: null
  }
};

var LANE_SURFACES = {
  'research-papers': { files: ['handlers/limen-worker-autofire.js', 'handlers/limen-outcome-observer.js'], status: 'INTERNAL_ARTIFACT_AND_PUBLICATION_RECEIPT_ONLY' },
  'investments': { files: ['handlers/limen-worker-autofire.js', 'handlers/limen-investment-outcome-observer.js'], status: 'FINANCE_PAPER_COMPONENTS_NOT_BOUND_TO_THESE_DOMAIN_OWNERS' },
  'publication': { files: ['handlers/limen-engine-output.js', 'handlers/limen-outcome-observer.js'], status: 'PERSISTENCE_IS_NOT_A_PUBLICATION_EXECUTOR' },
  'social': { files: ['handlers/social-cron.js', 'lib/social-post.js'], status: 'DOMAIN_BOUND_EXECUTOR' },
  'subscriber-email': { files: ['handlers/subscriber-digest.js', 'lib/crm-send.js'], status: 'DOMAIN_BOUND_EXECUTOR' },
  'automail': { files: ['handlers/homestead-automail.js'], status: 'DOMAIN_BOUND_EXECUTOR' },
  'autopilot': { files: ['handlers/autopilot.js'], status: 'DOMAIN_BOUND_EXECUTOR' },
  'hero-image': { files: ['handlers/hero-image.js'], status: 'DOMAIN_BOUND_EXECUTOR' },
  'auction': { files: ['handlers/relay-marketplace.js', 'handlers/realauction-ingest.js'], status: 'MANUAL_API_NOT_DOMAIN_BOUND' },
  'homestead': { files: ['handlers/homestead.js'], status: 'SENSING_AND_DEAL_SURFACE_NOT_DOMAIN_BOUND' },
  'crm': { files: ['handlers/crm.js'], status: 'MANUAL_API_NOT_DOMAIN_BOUND' },
  'real-estate': { files: ['handlers/homestead.js', 'handlers/realauction-ingest.js'], status: 'SENSING_AND_INGEST_NOT_DOMAIN_BOUND' },
  'broker/order': { files: ['lib/finance-paper-executor.js', 'lib/tradier-b14.js'], status: 'DOMAIN_BOUND_SANDBOX_EXECUTOR' }
};

function audit() {
  var product = ProductAudit.audit();
  var domains = product.domains.map(function (domain) {
    var binding = BINDINGS[domain.runtime] || null;
    var exactBinding = !!binding && binding.lane === domain.motorAuthority.lane;
    var executor = exactBinding && proves(binding.executor);
    var receipt = executor && proves(binding.receipt);
    var observer = executor && proves(binding.observer);
    var rollback = executor && proves(binding.rollback);
    var switchBudget = executor && proves(binding.switchBudget);
    var declaredContracts = domain.parts.motorReadiness === true;
    var verifiedByBrain = domain.motorAuthority.executorVerified === true &&
      domain.motorAuthority.outcomeObserverVerified === true;
    var externalEnabled = domain.resourceAuthority.externalAction === true &&
      domain.motorAuthority.external === true;
    var sourceChainComplete = executor && receipt && observer && rollback && switchBudget;
    var gaps = [];
    if (!executor) gaps.push('domain-bound-production-executor-missing');
    if (!receipt) gaps.push('executor-action-receipt-missing-or-insufficient');
    if (!observer) gaps.push('independent-outcome-observer-missing');
    if (!rollback) gaps.push('domain-authorized-rollback-missing');
    if (!switchBudget) gaps.push('executor-switch-or-budget-enforcement-missing');
    if (!verifiedByBrain) gaps.push('executor-and-observer-not-production-verified-by-domain');
    if (!externalEnabled) gaps.push('external-domain-switches-off');
    return {
      productDomain: domain.product,
      runtimeOwner: domain.runtime,
      lane: domain.motorAuthority.lane,
      contractsDeclared: declaredContracts,
      domainBoundExecutorImplemented: executor,
      actionReceiptImplemented: receipt,
      actionReceiptStrength: receipt ? binding.receiptStrength : 'NONE',
      independentOutcomeObserverImplemented: observer,
      observerScope: observer ? binding.observerScope || 'UNSPECIFIED' : 'NONE',
      domainAuthorizedRollbackImplemented: rollback,
      rollbackNote: binding ? binding.rollbackNote : 'no exact domain-bound executor exists',
      switchAndBudgetEnforcedInExecutor: switchBudget,
      sourceChainComplete: sourceChainComplete,
      productionVerifiedByDomain: verifiedByBrain,
      externalEnabled: externalEnabled,
      autonomousExternalReady: sourceChainComplete && verifiedByBrain && externalEnabled,
      gaps: gaps
    };
  });

  var laneSurfaces = LaneContract.list().map(function (lane) {
    var surface = LANE_SURFACES[lane];
    return {
      lane: lane,
      filesPresent: !!surface && filesExist(surface.files),
      files: surface ? surface.files.slice() : [],
      status: surface ? surface.status : 'NO_SURFACE_REGISTERED',
      warning: 'surface presence does not establish domain binding, receipt durability, outcome independence, or authority'
    };
  });

  return {
    schemaVersion: 'product-domain-business-executor-audit/1.0',
    measuredAt: new Date().toISOString(),
    readOnly: true,
    semantics: {
      executor: 'production code imports product-domain motor authorization and binds an exact owner/lane before the effect',
      receipt: 'the effect path records a provider or broker identity; strength states whether strict durability is established',
      observer: 'a separate path can measure an external result; self-reported send/publish success is not an independent outcome',
      ready: 'source chain complete plus domain production verification plus both external switches enabled'
    },
    summary: {
      domains: domains.length,
      contractsDeclared: domains.filter(function (d) { return d.contractsDeclared; }).length,
      domainBoundExecutorsImplemented: domains.filter(function (d) { return d.domainBoundExecutorImplemented; }).length,
      actionReceiptsImplemented: domains.filter(function (d) { return d.actionReceiptImplemented; }).length,
      independentOutcomeObserversImplemented: domains.filter(function (d) { return d.independentOutcomeObserverImplemented; }).length,
      domainAuthorizedRollbacksImplemented: domains.filter(function (d) { return d.domainAuthorizedRollbackImplemented; }).length,
      sourceChainsComplete: domains.filter(function (d) { return d.sourceChainComplete; }).length,
      productionVerifiedByDomain: domains.filter(function (d) { return d.productionVerifiedByDomain; }).length,
      autonomousExternalReady: domains.filter(function (d) { return d.autonomousExternalReady; }).length
    },
    laneSurfaces: laneSurfaces,
    domains: domains
  };
}

module.exports = { audit: audit, BINDINGS: BINDINGS, LANE_SURFACES: LANE_SURFACES };
