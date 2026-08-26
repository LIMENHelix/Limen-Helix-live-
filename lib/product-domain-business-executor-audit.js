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
  agriculture: {
    lane: 'homestead',
    executor: [
      { file: 'handlers/agriculture-homestead-cycle.js', tokens: ['Decision.candidate(body)', 'Decision).decide(store, task.candidate', 'Executor).execute({'] },
      { file: 'lib/agriculture-homestead-executor.js', tokens: ["authorize(store, 'agriculture', 'homestead'", 'input.transport.send(candidate, decision.actionId, idempotencyKey)'] }
    ],
    receipt: [{ file: 'lib/agriculture-homestead-executor.js', tokens: ["status: 'DISPATCHING'", "command.status = result && result.ok", 'providerEmailId', 'readbackVerified = true'] }],
    receiptStrength: 'DURABLE_B10_B14_IDEMPOTENT_SERVICE_REQUEST_RECEIPT',
    switchBudget: [
      { file: 'handlers/agriculture-homestead-cycle.js', tokens: ['AGRICULTURE_HOMESTEAD_ENABLED', 'AGRICULTURE_HOMESTEAD_DAILY_BUDGET_USD', 'AGRICULTURE_HOMESTEAD_DAILY_REQUEST_CAP'] },
      { file: 'lib/agriculture-homestead-executor.js', tokens: ['agriculture-homestead-email-cost-not-configured', 'agriculture_homestead_budget_slot:', 'dailyRequestCap'] }
    ],
    rollback: [
      { file: 'handlers/agriculture-homestead-recovery.js', tokens: ["Gate.hasDomain(pass, 'agriculture')", 'Recovery.recover({' ] },
      { file: 'lib/agriculture-homestead-recovery.js', tokens: [").authorize(store, 'agriculture', 'homestead'", 'FUTURE_REQUESTS_SUPPRESSED', 'strictSuppressionReadback'] }
    ],
    rollbackNote: 'fresh Agriculture motor suppresses future service requests to the exact provider after a signed inbound response or explicit provider policy; the prior request is irreversible',
    observer: [
      { file: 'handlers/agriculture-homestead-inbound.js', tokens: ["new Webhook(secret).verify", "event.type !== 'email.received'", 'Observer).record(store, event)'] },
      { file: 'lib/agriculture-homestead-observer.js', tokens: ['independentOfSendResponse: true', 'webhookSignatureVerified: true', 'COUNTERPARTY_RESPONSE_OBSERVED'] }
    ],
    observerScope: 'RESEND_SIGNED_INBOUND_COUNTERPARTY_RESPONSE'
  },
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
  education: {
    lane: 'research-papers',
    executor: [{ file: 'handlers/limen-worker-autofire.js', tokens: [
      "return { productDomain: 'education', ownerDomain: 'education', lane: 'research-papers' }",
      'motorAuthorization.authorize(',
      "fetch(BASE + '/api/expand-artifact-claude'"
    ] }],
    receipt: [
      { file: 'handlers/limen-worker-autofire.js', tokens: ['autofireEfference.command(', "fetch(BASE + '/api/limen-engine-output'"] },
      { file: 'lib/autofire-efference.js', tokens: ["type: 'REAFFERENCE'", 'outputId: resolved.receipt.outputId'] }
    ],
    receiptStrength: 'DURABLE_B14_COMMAND_AND_ARTIFACT_READBACK_RECEIPT',
    switchBudget: [{ file: 'lib/research-paper-developmental-authority.js', tokens: [
      'LIMEN_EDUCATION_RESEARCH_DEVELOPMENTAL_ENABLED', "productDomain: 'education', ownerDomain: 'education'",
      'estimatedCallBudgetUsd: ESTIMATED_CALL_BUDGET_USD'
    ] }],
    rollback: [
      { file: 'handlers/limen-research-evaluation-observer.js', tokens: ['Recovery.recover(store, row.event'] },
      { file: 'lib/research-artifact-recovery.js', tokens: [
        "education: { productDomain: 'education', ownerDomain: 'education'", 'MotorAuthorization.authorize',
        'store.setIfAbsent(key, command)', 'store.set(artifactKey(event.outputId), updated)', 'readbackVerified: true'
      ] }
    ],
    rollbackNote: 'explicit source-separated Education retraction evidence can create an Education-authorized identity-bound durable withdrawal command with strict artifact and receipt readback',
    observer: [
      { file: 'lib/research-evaluation-input-adapter.js', tokens: ["var OWNERS = ['science', 'medicine', 'education', 'environment']", 'at_least_two_independent_evidence_records_required'] },
      { file: 'handlers/limen-research-evaluation-observer.js', tokens: ['Observer.inspect(store, log)', 'outcome.recordAutonomousOutcome(row.event)'] }
    ],
    observerScope: 'EXTERNAL_EVALUATION_INPUT_GATED'
  },
  environment: {
    lane: 'research-papers',
    executor: [{ file: 'handlers/limen-worker-autofire.js', tokens: [
      "return { productDomain: 'environment', ownerDomain: 'environment', lane: 'research-papers' }",
      'motorAuthorization.authorize(', "fetch(BASE + '/api/expand-artifact-claude'"
    ] }],
    receipt: [
      { file: 'handlers/limen-worker-autofire.js', tokens: ['autofireEfference.command(', "fetch(BASE + '/api/limen-engine-output'"] },
      { file: 'lib/autofire-efference.js', tokens: ["type: 'REAFFERENCE'", 'outputId: resolved.receipt.outputId'] }
    ],
    receiptStrength: 'DURABLE_B14_COMMAND_AND_ARTIFACT_READBACK_RECEIPT',
    switchBudget: [{ file: 'lib/research-paper-developmental-authority.js', tokens: [
      'LIMEN_ENVIRONMENT_RESEARCH_DEVELOPMENTAL_ENABLED', "productDomain: 'environment', ownerDomain: 'environment'",
      'estimatedCallBudgetUsd: ESTIMATED_CALL_BUDGET_USD'
    ] }],
    rollback: [
      { file: 'handlers/limen-research-evaluation-observer.js', tokens: ['Recovery.recover(store, row.event'] },
      { file: 'lib/research-artifact-recovery.js', tokens: [
        "environment: { productDomain: 'environment', ownerDomain: 'environment'", 'MotorAuthorization.authorize',
        'store.setIfAbsent(key, command)', 'store.set(artifactKey(event.outputId), updated)', 'readbackVerified: true'
      ] }
    ],
    rollbackNote: 'explicit source-separated Environment retraction evidence can create an Environment-authorized identity-bound durable withdrawal command with strict artifact and receipt readback',
    observer: [
      { file: 'lib/research-evaluation-input-adapter.js', tokens: ["var OWNERS = ['science', 'medicine', 'education', 'environment']", 'at_least_two_independent_evidence_records_required'] },
      { file: 'handlers/limen-research-evaluation-observer.js', tokens: ['Observer.inspect(store, log)', 'outcome.recordAutonomousOutcome(row.event)'] }
    ],
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
  defense: {
    lane: 'publication',
    executor: [
      { file: 'handlers/defense-publication-cycle.js', tokens: ["Db.lrangeStrict)('feedtitles:defense'", 'Source).build(titleSets, cognition, now)', 'Decision).decide(store, candidate', 'Executor).execute({'] },
      { file: 'lib/defense-publication-executor.js', tokens: ["authorize(store, 'defense', 'publication'", 'Publisher).publish(store, candidate, decision.actionId'] }
    ],
    receipt: [{ file: 'lib/defense-publication-executor.js', tokens: ["status: 'DISPATCHING'", "command.status = result && result.ok", 'articleId', 'durableReceiptReadbackVerified = true'] }],
    receiptStrength: 'DURABLE_B10_B14_OWNED_PUBLIC_ARTICLE_RECEIPT',
    switchBudget: [
      { file: 'handlers/defense-publication-cycle.js', tokens: ['DEFENSE_PUBLICATION_ENABLED', 'DEFENSE_PUBLICATION_DAILY_BUDGET_USD', 'DEFENSE_PUBLICATION_DAILY_CAP'] },
      { file: 'lib/defense-publication-executor.js', tokens: ['defense-publication-operation-cost-not-configured', 'defense_publication_budget_slot:', 'dailyPublicationCap'] }
    ],
    rollback: [
      { file: 'handlers/defense-publication-recovery.js', tokens: ["Gate.hasDomain(pass, 'defense')", 'Recovery.recover({'] },
      { file: 'lib/defense-publication-recovery.js', tokens: ["authorize(store, 'defense', 'publication'", 'Publisher).unpublish', "status = absent ? 'UNPUBLISHED_VERIFIED'", 'independentPublicAbsenceVerified'] }
    ],
    rollbackNote: 'fresh Defense publication motor unpublishes the exact article, suppresses its source fingerprint, and independently verifies the public route returns absence',
    observer: [
      { file: 'handlers/defense-publication-outcome-observer.js', tokens: ['observer.observePresence', 'observer.observeEngagement', 'learning.recordObservation'] },
      { file: 'lib/defense-publication-observer.js', tokens: ['independentPublicRead: true', "status: 'SOURCE_CLICK_OBSERVED'", 'independentOfPublishResponse: true'] },
      { file: 'lib/defense-publication-learning.js', tokens: ["observation.status !== 'SOURCE_CLICK_OBSERVED'", 'minimumDistinctVisitors: 2', 'minimumDistinctArticles: 2'] }
    ],
    observerScope: 'PUBLIC_ARTICLE_PRESENCE_AND_ANONYMOUS_SOURCE_LINK_ENGAGEMENT'
  },
  governance: {
    lane: 'publication',
    executor: [
      { file: 'handlers/governance-publication-cycle.js', tokens: ["Db.lrangeStrict)('feedtitles:governance'", 'Source).build(titleSets, cognition, now)', 'Decision).decide(store, candidate', 'Executor).execute({'] },
      { file: 'lib/governance-publication-executor.js', tokens: ["authorize(store, 'governance', 'publication'", 'Publisher).publish(store, candidate, decision.actionId'] }
    ],
    receipt: [{ file: 'lib/governance-publication-executor.js', tokens: ["status: 'DISPATCHING'", "command.status = result && result.ok", 'articleId', 'durableReceiptReadbackVerified = true'] }],
    receiptStrength: 'DURABLE_B10_B14_OWNED_PUBLIC_ARTICLE_RECEIPT',
    switchBudget: [
      { file: 'handlers/governance-publication-cycle.js', tokens: ['GOVERNANCE_PUBLICATION_ENABLED', 'GOVERNANCE_PUBLICATION_DAILY_BUDGET_USD', 'GOVERNANCE_PUBLICATION_DAILY_CAP'] },
      { file: 'lib/governance-publication-executor.js', tokens: ['governance-publication-operation-cost-not-configured', 'governance_publication_budget_slot:', 'dailyPublicationCap'] }
    ],
    rollback: [
      { file: 'handlers/governance-publication-recovery.js', tokens: ["Gate.hasDomain(pass, 'governance')", 'Recovery.recover({'] },
      { file: 'lib/governance-publication-recovery.js', tokens: ["authorize(store, 'governance', 'publication'", 'Publisher).unpublish', "status = absent ? 'UNPUBLISHED_VERIFIED'", 'independentPublicAbsenceVerified'] }
    ],
    rollbackNote: 'fresh Governance publication motor unpublishes the exact article, suppresses its source fingerprint, and independently verifies the public route returns absence',
    observer: [
      { file: 'handlers/governance-publication-outcome-observer.js', tokens: ['observer.observePresence', 'observer.observeEngagement', 'learning.recordObservation'] },
      { file: 'lib/governance-publication-observer.js', tokens: ['independentPublicRead: true', "status: 'SOURCE_CLICK_OBSERVED'", 'independentOfPublishResponse: true'] },
      { file: 'lib/governance-publication-learning.js', tokens: ["observation.status !== 'SOURCE_CLICK_OBSERVED'", 'minimumDistinctVisitors: 2', 'minimumDistinctArticles: 2'] }
    ],
    observerScope: 'PUBLIC_ARTICLE_PRESENCE_AND_ANONYMOUS_SOURCE_LINK_ENGAGEMENT'
  },
  infrastructure: {
    lane: 'real-estate',
    executor: [
      { file: 'handlers/infrastructure-real-estate-cycle.js', tokens: ["Admin.hasDomain(pass, 'infrastructure')", 'Decision.candidate(body)', 'Decision).decide(store, task.candidate', 'Executor).execute({'] },
      { file: 'lib/infrastructure-real-estate-executor.js', tokens: ["authorize(store, 'infrastructure', 'real-estate'", 'input.transport.send(candidate, decision.actionId, idempotencyKey)'] }
    ],
    receipt: [{ file: 'lib/infrastructure-real-estate-executor.js', tokens: ["status: 'DISPATCHING'", "'INQUIRY_ACCEPTED'", 'providerEmailId', 'readbackVerified = true'] }],
    receiptStrength: 'DURABLE_B10_B14_NON_BINDING_PROPERTY_INQUIRY_RECEIPT',
    switchBudget: [
      { file: 'handlers/infrastructure-real-estate-cycle.js', tokens: ['INFRASTRUCTURE_REAL_ESTATE_ENABLED', 'INFRASTRUCTURE_REAL_ESTATE_MAX_INDICATION_USD', 'INFRASTRUCTURE_REAL_ESTATE_DAILY_BUDGET_USD', 'INFRASTRUCTURE_REAL_ESTATE_DAILY_REQUEST_CAP'] },
      { file: 'lib/infrastructure-real-estate-executor.js', tokens: ['infrastructure-real-estate-email-cost-not-configured', 'infrastructure_real_estate_budget_slot:', 'dailyRequestCap'] }
    ],
    rollback: [
      { file: 'handlers/infrastructure-real-estate-recovery.js', tokens: ["Gate.hasDomain(pass, 'infrastructure')", 'Recovery.recover({'] },
      { file: 'lib/infrastructure-real-estate-recovery.js', tokens: ["authorize(store, 'infrastructure', 'real-estate'", "recovery.status = 'FUTURE_INQUIRIES_SUPPRESSED'", 'strictSuppressionReadback'] }
    ],
    rollbackNote: 'fresh Infrastructure real-estate motor suppresses the exact counterparty/property pair; the prior inquiry is explicitly non-binding and cannot create a contract or funds-transfer authority',
    observer: [
      { file: 'handlers/infrastructure-real-estate-inbound.js', tokens: ['new Webhook(secret).verify', "event.type !== 'email.received'", 'Observer).record(store, event)'] },
      { file: 'lib/infrastructure-real-estate-observer.js', tokens: ['independentOfSendResponse: true', 'webhookSignatureVerified: true', 'COUNTERPARTY_RESPONSE_OBSERVED'] },
      { file: 'lib/infrastructure-real-estate-learning.js', tokens: ["eventType: 'OUTCOME_REAL_ESTATE_COUNTERPARTY_RESPONSE'", 'normalizedCredit: 0'] }
    ],
    observerScope: 'RESEND_SIGNED_INBOUND_COUNTERPARTY_RESPONSE_UNCLASSIFIED_ZERO_CREDIT'
  },
  population: {
    lane: 'real-estate',
    executor: [
      { file: 'handlers/population-real-estate-cycle.js', tokens: ["Admin.hasDomain(pass, 'population')", 'Decision.candidate(body)', 'Decision).decide(store, task.candidate', 'Executor).execute({'] },
      { file: 'lib/population-real-estate-executor.js', tokens: ["authorize(store, 'population', 'real-estate'", 'input.transport.send(candidate, decision.actionId, idempotencyKey)'] }
    ],
    receipt: [{ file: 'lib/population-real-estate-executor.js', tokens: ["status: 'DISPATCHING'", "'INQUIRY_ACCEPTED'", 'providerEmailId', 'readbackVerified = true'] }],
    receiptStrength: 'DURABLE_B10_B14_NON_BINDING_PROPERTY_INQUIRY_RECEIPT',
    switchBudget: [
      { file: 'handlers/population-real-estate-cycle.js', tokens: ['POPULATION_REAL_ESTATE_ENABLED', 'POPULATION_REAL_ESTATE_MAX_INDICATION_USD', 'POPULATION_REAL_ESTATE_DAILY_BUDGET_USD', 'POPULATION_REAL_ESTATE_DAILY_REQUEST_CAP'] },
      { file: 'lib/population-real-estate-executor.js', tokens: ['population-real-estate-email-cost-not-configured', 'population_real_estate_budget_slot:', 'dailyRequestCap'] }
    ],
    rollback: [
      { file: 'handlers/population-real-estate-recovery.js', tokens: ["Gate.hasDomain(pass, 'population')", 'Recovery.recover({'] },
      { file: 'lib/population-real-estate-recovery.js', tokens: ["authorize(store, 'population', 'real-estate'", "recovery.status = 'FUTURE_INQUIRIES_SUPPRESSED'", 'strictSuppressionReadback'] }
    ],
    rollbackNote: 'fresh Population real-estate motor suppresses the exact counterparty/property pair; the prior inquiry is explicitly non-binding and cannot create a contract or funds-transfer authority',
    observer: [
      { file: 'handlers/population-real-estate-inbound.js', tokens: ['new Webhook(secret).verify', "event.type !== 'email.received'", 'Observer).record(store, event)'] },
      { file: 'lib/population-real-estate-observer.js', tokens: ['independentOfSendResponse: true', 'webhookSignatureVerified: true', 'COUNTERPARTY_RESPONSE_OBSERVED'] },
      { file: 'lib/population-real-estate-learning.js', tokens: ["eventType: 'OUTCOME_REAL_ESTATE_COUNTERPARTY_RESPONSE'", 'normalizedCredit: 0'] }
    ],
    observerScope: 'RESEND_SIGNED_INBOUND_COUNTERPARTY_RESPONSE_UNCLASSIFIED_ZERO_CREDIT'
  },
  supplyChain: {
    lane: 'auction',
    executor: [
      { file: 'handlers/trade-auction-cycle.js', tokens: ["Admin.hasDomain(pass,'supplyChain')", 'Decision).decide(s,t.candidate', 'Executor).execute({'] },
      { file: 'lib/trade-auction-executor.js', tokens: ["authorize(s,'supplyChain','auction'", 'i.marketplace.createListing({'] }
    ],
    receipt: [{ file: 'lib/trade-auction-executor.js', tokens: ["status:'DISPATCHING'", "c.status=c.listingId?'LISTED'", 'listingId', 'durableReceiptReadbackVerified=true'] }],
    receiptStrength: 'DURABLE_B10_B14_OWNED_MARKETPLACE_LISTING_RECEIPT',
    switchBudget: [
      { file: 'handlers/trade-auction-cycle.js', tokens: ['TRADE_AUCTION_ENABLED', 'TRADE_AUCTION_MAX_RESERVE_USD', 'TRADE_AUCTION_DAILY_BUDGET_USD', 'TRADE_AUCTION_DAILY_LISTING_CAP'] },
      { file: 'lib/trade-auction-executor.js', tokens: ['trade-auction-operation-cost-not-configured', 'trade_auction_budget_slot:', 'dailyListingCap'] }
    ],
    rollback: [
      { file: 'handlers/trade-auction-recovery.js', tokens: ["Gate.hasDomain(pass,'supplyChain')", 'Recovery.recover({'] },
      { file: 'lib/trade-auction-recovery.js', tokens: ["authorize(s,'supplyChain','auction'", "status:'closed'", "r.status=absent?'CLOSED_VERIFIED'", 'independentPublicAbsenceVerified'] }
    ],
    rollbackNote: 'fresh Trade auction motor closes the exact owned-marketplace listing, suppresses the asset identity, and independently verifies public absence; no order, payment, or binding sale is authorized',
    observer: [
      { file: 'handlers/trade-auction-outcome-observer.js', tokens: ['Observer).observe(s,c', 'Learning.recordObservation(s,o)', 'createEndpointCalled:false'] },
      { file: 'lib/trade-auction-observer.js', tokens: ['independentOfCreateResponse:true', "status:present?'PUBLIC_LISTING_PRESENCE_OBSERVED'", 'orderObserved:false', 'saleObserved:false'] },
      { file: 'lib/trade-auction-learning.js', tokens: ["eventType:'OUTCOME_AUCTION_LISTING_PRESENCE_ONLY'", 'normalizedCredit:0'] }
    ],
    observerScope: 'PUBLIC_OWNED_MARKETPLACE_LISTING_PRESENCE_ZERO_CREDIT_NO_ORDER_OR_SALE'
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
      'motorStore.get(K.worklist)', 'intelligenceDecision.decide(motorStore, candidate', 'intelligenceExecutor.execute({'
    ] }, { file: 'lib/intelligence-autopilot-executor.js', tokens: [
      'Decision.validateReceipt', "authorize(store, 'intelligence', 'autopilot'", 'input.transport.send(v.email'
    ] }],
    receipt: [{ file: 'lib/intelligence-autopilot-executor.js', tokens: ["status: 'DISPATCHING'", "command.status = result && result.ok", 'providerEmailId', 'readbackVerified = true'] }],
    receiptStrength: 'DURABLE_B10_B14_IDEMPOTENT_EMAIL_ACCEPTANCE_RECEIPT',
    switchBudget: [{ file: 'handlers/autopilot.js', tokens: ['cfgT.armed', "cfg.mode === 'control'", 'INTELLIGENCE_AUTOPILOT_DAILY_BUDGET_USD'] },
      { file: 'lib/intelligence-autopilot-executor.js', tokens: ['intelligence-autopilot-email-cost-not-configured', 'intelligence_autopilot_budget_slot:', 'dailyEmailCap'] }],
    rollback: [{ file: 'handlers/intelligence-autopilot-recovery.js', tokens: ["Gate.hasDomain(pass,'intelligence')", 'Recovery.recover({' ] },
      { file: 'lib/intelligence-autopilot-recovery.js', tokens: [").authorize(store, 'intelligence', 'autopilot'", 'FUTURE_DELIVERY_SUPPRESSED', 'strictSuppressionReadback'] }],
    rollbackNote: 'fresh Intelligence motor suppresses future delivery after negative independent outcome or policy trigger; prior email is irreversible',
    observer: [{ file: 'handlers/intelligence-autopilot-outcome-observer.js', tokens: ['observer.observeRecent(store,commands', 'sendEndpointCalled:false'] },
      { file: 'lib/intelligence-autopilot-outcome-observer.js', tokens: ["method: 'GET'", 'independentOfSendResponse: true'] }],
    observerScope: 'RESEND_READ_API_MAIL_SERVER_LAST_EVENT'
  },
  industry: {
    lane: 'crm',
    executor: [{ file: 'handlers/industry-ingest.js', tokens: ['crmQueue.enqueueFromWarn(motorStore, body.deals'] }, { file: 'handlers/industry-crm-cycle.js', tokens: ['Decision).decide(store,task.candidate', 'Executor).execute({'] }, { file: 'lib/industry-crm-executor.js', tokens: ["authorize(s,'industry','crm'", 'i.provider.create(v)'] }],
    receipt: [{ file: 'lib/industry-crm-executor.js', tokens: ["status:'DISPATCHING'", "c.status=result&&result.ok", 'hubspotCompanyId', 'readbackVerified=true'] }],
    receiptStrength: 'DURABLE_B10_B14_HUBSPOT_COMPANY_RECEIPT',
    switchBudget: [{ file: 'handlers/industry-crm-cycle.js', tokens: ['INDUSTRY_CRM_ENABLED', 'INDUSTRY_CRM_DAILY_BUDGET_USD', 'INDUSTRY_CRM_DAILY_OPERATION_CAP'] }, { file: 'lib/industry-crm-executor.js', tokens: ['industry-crm-operation-cost-not-configured', 'industry_crm_budget_slot:', 'dailyOperationCap'] }],
    rollback: [{ file: 'handlers/industry-crm-recovery.js', tokens: ["Gate.hasDomain(pass,'industry')", 'Recovery.recover({'] }, { file: 'lib/industry-crm-recovery.js', tokens: ["authorize(s,'industry','crm'", 'provider.archive(c.hubspotCompanyId)', "status='ARCHIVED_VERIFIED'", 'independentArchivedReadback=true'] }],
    rollbackNote: 'fresh Industry motor archives the exact HubSpot company, independently verifies archived state, and suppresses replay of that WARN/company identity',
    observer: [{ file: 'handlers/industry-crm-outcome-observer.js', tokens: ['Observer).observeRecent(store,commands,provider)', 'createEndpointCalled:false'] }, { file: 'lib/industry-crm-observer.js', tokens: ['propertiesWithHistory', 'independentOfCreateResponse:true', 'STAGE_TRANSITION_OBSERVED'] }],
    observerScope: 'HUBSPOT_COMPANY_LIFECYCLE_HISTORY'
  },
  law: {
    lane: 'automail',
    executor: [{ file: 'handlers/homestead-automail.js', tokens: [
      'lawDecision.decide(motorStore, candidate', 'lawExecutor.execute({', 'lobCreate(exactCandidate, LOB, FROM, idempotencyKey)'
    ] }, { file: 'lib/law-automail-executor.js', tokens: [
      'Decision.validateReceipt', "authorize(store, 'law', 'automail'", 'input.provider.create(candidate, idempotencyKey)'
    ] }],
    receipt: [{ file: 'lib/law-automail-executor.js', tokens: [
      "status: 'DISPATCHING'", "command.status = result && result.ok", 'providerLetterId', 'readbackVerified = true'
    ] }],
    receiptStrength: 'DURABLE_B10_B14_IDEMPOTENT_LOB_ACCEPTANCE_RECEIPT',
    switchBudget: [
      { file: 'handlers/homestead-automail.js', tokens: ['st.armed', 'st.cap', 'MIN_LEAD_DAYS', 'LAW_AUTOMAIL_DAILY_BUDGET_USD'] },
      { file: 'lib/law-automail-executor.js', tokens: ['law-automail-letter-cost-not-configured', 'law_automail_budget_slot:', 'dailyLetterCap'] }
    ],
    rollback: [
      { file: 'handlers/law-automail-recovery.js', tokens: ["gate.hasDomain(pass, 'law')", 'recovery.recover({' ] },
      { file: 'lib/law-automail-recovery.js', tokens: [").authorize(store, 'law', 'automail'", 'provider.cancel(command.providerLetterId)', 'CANCELED_VERIFIED'] }
    ],
    rollbackNote: 'separate fresh Law motor may cancel an exact observed Lob letter inside the provider cancellation window and independently verify deleted state; otherwise residual physical production is explicit',
    observer: [
      { file: 'handlers/law-automail-outcome-observer.js', tokens: ['observer.observeRecent(store, commands', 'createEndpointCalled: false'] },
      { file: 'lib/law-automail-outcome-observer.js', tokens: ["method: 'GET'", 'independentOfCreateResponse: true', 'expectedDeliveryDate'] }
    ],
    observerScope: 'LOB_EXACT_LETTER_READ_RENDER_AND_EXPECTED_DELIVERY_STATE'
  },
  religion: {
    lane: 'subscriber-email',
    executor: [{ file: 'handlers/subscriber-digest.js', tokens: [
      'subs.activeListStrict()', 'subscriberDecision.decide(motorStore, candidate', 'subscriberExecutor.execute({',
      'crm.sendToLead(email, subject, body, options)', 'subs.markSentStrict('
    ] }, { file: 'handlers/stripe-webhook.js', tokens: [
      'subs.activateStrict({', 'religionFulfillment.enqueueAndAttempt({', 'subs.getStrict(email, motorStore)', 'subs.deactivateStrict('
    ] }, { file: 'lib/religion-revenue-fulfillment.js', tokens: [
      'store.setIfAbsent(key(id), task)', 'Decision.decide(store, candidate', 'Executor.execute({'
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
  'publication': { files: ['handlers/defense-publication-cycle.js', 'handlers/defense-publication-public.js', 'handlers/defense-publication-outcome-observer.js'], status: 'DOMAIN_BOUND_EXECUTOR' },
  'social': { files: ['handlers/social-cron.js', 'lib/social-post.js'], status: 'DOMAIN_BOUND_EXECUTOR' },
  'subscriber-email': { files: ['handlers/subscriber-digest.js', 'lib/crm-send.js'], status: 'DOMAIN_BOUND_EXECUTOR' },
  'automail': { files: ['handlers/homestead-automail.js'], status: 'DOMAIN_BOUND_EXECUTOR' },
  'autopilot': { files: ['handlers/autopilot.js'], status: 'DOMAIN_BOUND_EXECUTOR' },
  'hero-image': { files: ['handlers/hero-image.js'], status: 'DOMAIN_BOUND_EXECUTOR' },
  'auction': { files: ['handlers/trade-auction-cycle.js', 'handlers/trade-auction-outcome-observer.js'], status: 'DOMAIN_BOUND_EXECUTOR' },
  'homestead': { files: ['handlers/agriculture-homestead-cycle.js', 'handlers/agriculture-homestead-inbound.js'], status: 'DOMAIN_BOUND_EXECUTOR' },
  'crm': { files: ['handlers/industry-crm-cycle.js', 'handlers/industry-crm-outcome-observer.js'], status: 'DOMAIN_BOUND_EXECUTOR' },
  'real-estate': { files: ['handlers/infrastructure-real-estate-cycle.js', 'handlers/infrastructure-real-estate-inbound.js', 'handlers/infrastructure-real-estate-recovery.js'], status: 'DOMAIN_BOUND_EXECUTOR' },
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
