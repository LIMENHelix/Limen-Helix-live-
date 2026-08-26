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

/* Only these exact production paths currently import the product-motor
 * authorization adapter and bind it to an exact owner + lane pair. Science
 * and Medicine share the research worker transport but keep distinct product
 * motor receipts and runtime owners. Other APIs
 * may send, publish, list, or store data, but they are not yet effectors of the
 * owning product brain and must not be counted as such. */
var BINDINGS = {
  research: {
    lane: 'research-papers',
    executor: [{ file: 'handlers/limen-worker-autofire.js', tokens: [
      "return { productDomain: 'science', ownerDomain: 'research', lane: 'research-papers' }",
      'motorAuthorization.authorize(',
      "fetch(BASE + '/api/expand-artifact-claude'"
    ] }],
    receipt: [
      { file: 'handlers/limen-worker-autofire.js', tokens: ['autofireEfference.command(', "fetch(BASE + '/api/limen-engine-output'"] },
      { file: 'lib/autofire-efference.js', tokens: ["type: 'REAFFERENCE'", 'outputId: resolved.receipt.outputId'] }
    ],
    receiptStrength: 'DURABLE_B14_COMMAND_AND_ARTIFACT_READBACK_RECEIPT',
    switchBudget: [{ file: 'handlers/limen-worker-autofire.js', tokens: [
      'productMotorAuthorization.authorized', 'autonomyBudget.check', 'aiKillSwitch.spendDisabled'
    ] }],
    rollback: [
      { file: 'handlers/limen-research-evaluation-observer.js', tokens: ['Recovery.recover(store, row.event'] },
      { file: 'lib/research-artifact-recovery.js', tokens: [
        'MotorAuthorization.authorize', 'store.setIfAbsent(key, command)',
        'store.set(artifactKey(event.outputId), updated)', 'readbackVerified: true'
      ] }
    ],
    rollbackNote: 'explicit source-separated retraction evidence can create an identity-bound durable withdrawal command with strict artifact and receipt readback',
    observer: [{ file: 'handlers/limen-research-evaluation-observer.js', tokens: [
      'Observer.inspect(store, log)', 'outcome.recordAutonomousOutcome(row.event)'
    ] }],
    observerScope: 'EXTERNAL_EVALUATION_INPUT_GATED'
  },
  health: {
    lane: 'research-papers',
    executor: [{ file: 'handlers/limen-worker-autofire.js', tokens: [
      "return { productDomain: 'medicine', ownerDomain: 'health', lane: 'research-papers' }",
      'motorAuthorization.authorize(',
      "fetch(BASE + '/api/expand-artifact-claude'"
    ] }],
    receipt: [
      { file: 'handlers/limen-worker-autofire.js', tokens: ['autofireEfference.command(', "fetch(BASE + '/api/limen-engine-output'"] },
      { file: 'lib/autofire-efference.js', tokens: ["type: 'REAFFERENCE'", 'outputId: resolved.receipt.outputId'] }
    ],
    receiptStrength: 'DURABLE_B14_COMMAND_AND_ARTIFACT_READBACK_RECEIPT',
    switchBudget: [{ file: 'handlers/limen-worker-autofire.js', tokens: [
      'productMotorAuthorization.authorized', 'autonomyBudget.check', 'aiKillSwitch.spendDisabled'
    ] }],
    rollback: [
      { file: 'handlers/limen-research-evaluation-observer.js', tokens: ['Recovery.recover(store, row.event'] },
      { file: 'lib/research-artifact-recovery.js', tokens: [
        'MotorAuthorization.authorize', 'store.setIfAbsent(key, command)',
        'store.set(artifactKey(event.outputId), updated)', 'readbackVerified: true'
      ] }
    ],
    rollbackNote: 'explicit source-separated retraction evidence can create an identity-bound durable withdrawal command with strict artifact and receipt readback',
    observer: [{ file: 'handlers/limen-research-evaluation-observer.js', tokens: [
      'Observer.inspect(store, log)', 'outcome.recordAutonomousOutcome(row.event)'
    ] }],
    observerScope: 'EXTERNAL_EVALUATION_INPUT_GATED'
  },
  communication: {
    lane: 'social',
    executor: [{ file: 'handlers/social-cron.js', tokens: [
      'socialDecision.decide(motorStore', "decision.status !== 'RELEASED'", 'socialExecutor.execute({',
      'store: motorStore', 'subjectDomain: post.domain'
    ] }, { file: 'lib/communication-social-executor.js', tokens: [
      'Decision.validateReceipt', "authorize.authorize(store, 'communication', 'social'", 'await store.setIfAbsent(key, command)',
      'await store.setIfAbsent(claimKey, motorClaim)', 'platform.postToBluesky(body)'
    ] }],
    receipt: [{ file: 'lib/communication-social-executor.js', tokens: [
      "status: 'POSTED'", 'readbackVerified: true', 'await store.set(key, resolved)',
      'restored.receipt.uri !== posted.uri', 'PENDING_LOG_KEY'
    ] }],
    receiptStrength: 'DURABLE_IDEMPOTENT_PLATFORM_COMMAND_RECEIPT',
    switchBudget: [{ file: 'lib/social-post.js', tokens: ['SOCIAL_POSTING_ENABLED', 'postingBlocked', 'claimRateSlot'] }],
    rollback: [
      { file: 'handlers/communication-social-recovery.js', tokens: [
        "gate.hasDomain(pass, 'communication')", 'recovery.recover({'
      ] },
      { file: 'lib/communication-social-recovery.js', tokens: [
        "authorize.authorize(store, 'communication', 'social'", 'await store.setIfAbsent(key, command)',
        'await store.setIfAbsent(motorClaimKey, motorClaim)',
        'platform.deleteBlueskyPost(original.receipt.uri)', 'publicAbsenceVerified: true'
      ] }
    ],
    rollbackNote: 'fresh Communication motor authorization claims one identity-bound delete command after independent presence observation and verifies public absence through AppView',
    observer: [{ file: 'handlers/communication-social-outcome-observer.js', tokens: [
      'observer.observeRecent(store, posts', "require('../lib/communication-social-outcome-observer.js')"
    ] }, { file: 'lib/communication-social-outcome-observer.js', tokens: [
      "endpointHost: 'public.api.bsky.app'", "independentOfAdapterId: 'bluesky-pds-write-adapter/1'",
      'await store.set(observationKey(identity.uri), receipt)'
    ] }, { file: 'lib/communication-social-outcome-observer.js', tokens: [
      'reconcilePending', 'reconciledFromPublicAppView: true', "current.status === 'DISPATCHING'"
    ] }],
    observerScope: 'PUBLIC_APPVIEW_ENGAGEMENT_SNAPSHOT'
  },
  culture: {
    lane: 'hero-image',
    executor: [{ file: 'handlers/hero-image.js', tokens: [
      'heroDecision.decide(motorStore, candidate', 'heroExecutor.execute({',
      'provider: { generate:'
    ] }, { file: 'lib/culture-hero-executor.js', tokens: [
      'Decision.validateReceipt', "authorize.authorize(store, 'culture', 'hero-image'",
      'await store.setIfAbsent(commandKey(commandId), command)', 'provider.generate(candidate)'
    ] }],
    receipt: [{ file: 'lib/culture-hero-executor.js', tokens: [
      "status: 'DISPATCHING'", "status: result && result.ok && result.url ? 'GENERATED'",
      'resolved = await strictSet(store, commandKey(commandId), resolved)', 'PENDING_LOG_KEY'
    ] }],
    receiptStrength: 'DURABLE_B10_B14_ONE_SHOT_ASSET_RECEIPT',
    switchBudget: [{ file: 'handlers/hero-image.js', tokens: ["require('../lib/ai-kill-switch')", "require('../lib/spend-meter')", 'reserve('] }],
    rollback: [
      { file: 'handlers/culture-hero-recovery.js', tokens: ["gate.hasDomain(pass, 'culture')", 'recovery.recover({' ] },
      { file: 'lib/culture-hero-recovery.js', tokens: [
        ").authorize(store, 'culture', 'hero-image'", 'culture_hero_suppression_catalog',
        'store.setIfAbsent(Executor.motorClaimKey', 'strictSuppressionReadback: true', 'independentPublicAbsenceVerified: absent'
      ] }
    ],
    rollbackNote: 'fresh Culture motor authority suppresses the identity-bound asset from LIMEN public catalogs and records independent public absence; provider-host deletion is not claimed',
    observer: [
      { file: 'handlers/culture-hero-outcome-observer.js', tokens: ['observer.observeRecent(store, commands', 'generationEndpointCalled: false'] },
      { file: 'lib/culture-hero-outcome-observer.js', tokens: [
        "fetcher(command.receipt.url, { method: 'GET'", 'independentReadPath: true', 'generationEndpointCalled: false'
      ] }
    ],
    observerScope: 'PUBLIC_ASSET_BYTES_CONTENT_TYPE_AND_HASH'
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
      'subs.activeListStrict()', 'subscriberDecision.decide(motorStore, candidate', 'subscriberExecutor.execute({',
      'crm.sendToLead(email, subject, body, options)', 'subs.markSentStrict('
    ] }, { file: 'lib/religion-subscriber-executor.js', tokens: [
      'Decision.validateReceipt', "authorize.authorize(store, 'religion', 'subscriber-email'",
      'store.setIfAbsent(commandKey(commandId), command)', 'transport.send(spec.candidate.email'
    ] }],
    receipt: [{ file: 'lib/religion-subscriber-executor.js', tokens: [
      "status: 'DISPATCHING'", "item.status = result && result.ok && result.id ? 'ACCEPTED'",
      'await store.set(actionKey(item.actionId), action)', 'readbackVerified = true'
    ] }],
    receiptStrength: 'DURABLE_CAPPED_IDEMPOTENT_EMAIL_ACCEPTANCE_RECEIPT',
    switchBudget: [
      { file: 'handlers/subscriber-digest.js', tokens: ['reallySend', 'SUBSCRIBER_DIGEST_MAX_SENDS', 'HARD_MAX_SENDS'] },
      { file: 'lib/religion-subscriber-executor.js', tokens: ['HARD_MAX_SENDS = 100', 'religion_subscriber_suppression_catalog'] }
    ],
    rollback: [
      { file: 'handlers/religion-subscriber-recovery.js', tokens: ["gate.hasDomain(pass, 'religion')", 'recovery.recover({' ] },
      { file: 'lib/religion-subscriber-recovery.js', tokens: [
        ").authorize(store, 'religion', 'subscriber-email'", 'irreversiblePriorEmail: true',
        'FUTURE_DELIVERY_SUPPRESSED', 'strictSuppressionReadback = true'
      ] }
    ],
    rollbackNote: 'fresh Religion motor authority suppresses future delivery after a negative independent outcome or policy trigger; prior email is explicitly irreversible and no recall is claimed',
    observer: [
      { file: 'handlers/religion-subscriber-outcome-observer.js', tokens: [
        'observer.observeRecent(store, commands', 'Learning).recordObservation(store, observation)',
        'Recovery).recover({', 'sendEndpointCalled: false'
      ] },
      { file: 'lib/religion-subscriber-outcome-observer.js', tokens: [
        "'https://api.resend.com/emails/'", 'independentOfSendResponse: true', 'mailServerFeedback:'
      ] }
    ],
    observerScope: 'RESEND_READ_API_MAIL_SERVER_LAST_EVENT'
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
    schemaVersion: 'product-domain-business-executor-audit/1.1',
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
