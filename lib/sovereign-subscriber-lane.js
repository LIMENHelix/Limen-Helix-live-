'use strict';

/**
 * Shared transport physiology for a sovereign domain's paid-subscriber lane.
 *
 * The code is shared infrastructure, not shared cognition. create() closes over
 * one immutable product/owner identity and gives that domain its own B10
 * decision records, capability and motor receipts, budget slots, commands,
 * outcomes, learning state, recovery catalog, and fulfillment queue. A receipt
 * from one instance is structurally invalid in every other instance.
 */

var crypto = require('node:crypto');
var Redis = require('./redis-kv.js');
var AdapterGuard = require('./civilization-adapter-guard.js');
var Store = require('./autofire-efference-store.js');
var Crm = require('./crm-send.js');
var Subscriptions = require('./subscriptions.js');
var MotorCapability = require('./product-domain-motor-capability.js');
var CommercialContracts = require('./domain-commercial-contracts.js');
var SubscriberPolicy = require('./subscriber-email-policy.js');

var LANE = 'subscriber-email';
var MAX_COGNITION_AGE_MS = 45 * 60 * 1000;
var MAX_DECISION_AGE_MS = 10 * 60 * 1000;
var MAX_CAPABILITY_AGE_MS = 7 * 24 * 60 * 60 * 1000;
var HARD_MAX_SENDS = 100;
var POSITIVE_FOLLOW_UP_MS = 7 * 24 * 60 * 60 * 1000;
var POSITIVE_POLL_MS = 6 * 60 * 60 * 1000;
var LEARNING_DEDUPE_RETENTION_MS = POSITIVE_FOLLOW_UP_MS + POSITIVE_POLL_MS;
var ACTION_CLAIM_STALE_MS = 10 * 60 * 1000;
var OBSERVATION_LEASE_SECONDS = 120;
var NEGATIVE = Object.freeze({ bounced: true, complained: true, failed: true, suppressed: true });
var TERMINAL = Object.freeze({ delivered: true, bounced: true, complained: true, failed: true, suppressed: true, canceled: true });
var POSITIVE = Object.freeze({ delivered: true, opened: true, clicked: true });

function hash(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}
function text(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function day(now) { return new Date(now).toISOString().slice(0, 10); }
function create(input) {
  input = input || {};
  var productDomain = String(input.productDomain || '').toLowerCase();
  var ownerDomain = String(input.ownerDomain || productDomain);
  var envStem = String(input.envStem || productDomain).toUpperCase().replace(/[^A-Z0-9]/g, '_');
  var short = String(input.short || productDomain.slice(0, 2)).toLowerCase().replace(/[^a-z0-9]/g, '');
  var commercialContract = CommercialContracts.get(productDomain);
  if (!commercialContract || commercialContract.ownerDomain !== ownerDomain || !short) {
    throw new Error('unsupported or identity-mismatched sovereign subscriber lane');
  }

  var ns = 'soft_subscriber:' + productDomain + ':';
  var schemas = Object.freeze({
    candidate: productDomain + '-subscriber-candidate/1.0',
    decision: productDomain + '-subscriber-decision/1.0',
    authorization: productDomain + '-subscriber-motor-authorization/1.0',
    capability: productDomain + '-subscriber-capability/1.0',
    command: productDomain + '-subscriber-command/1.0',
    observation: productDomain + '-subscriber-observation/1.0',
    learning: productDomain + '-subscriber-learning/1.0',
    recovery: productDomain + '-subscriber-recovery/1.0',
    fulfillment: productDomain + '-revenue-fulfillment/1.0'
  });
  var keys = Object.freeze({
    decision: function (id) { return ns + 'decision:' + id; },
    decisionLog: ns + 'decision-log',
    executorCapability: ns + 'capability:executor',
    observerCapability: ns + 'capability:independent-outcome-observer',
    authorization: function (id) { return ns + 'authorization:' + id; },
    authorizationLog: ns + 'authorization-log',
    command: function (id) { return ns + 'command:' + id; },
    commandLog: ns + 'command-log',
    pendingCommandLog: ns + 'pending-command-log',
    action: function (id) { return ns + 'action:' + id; },
    motorClaim: function (id) { return ns + 'motor-claim:' + id; },
    budgetSlot: function (date, slot) { return ns + 'budget:' + date + ':' + slot; },
    legacySuppression: ns + 'suppression',
    suppression: function (emailHash) { return ns + 'suppression:' + emailHash; },
    observation: function (id) { return ns + 'observation:' + id; },
    observationLog: ns + 'observation-log',
    observationPending: ns + 'observation-pending',
    observationPendingMigration: ns + 'migration:observation-pending-v1',
    observationLease: function (id) { return ns + 'observation-lease:' + id; },
    learning: ns + 'learning',
    learningLock: ns + 'learning-lock',
    learningCause: function (id) { return ns + 'learning-cause:' + id; },
    recovery: function (id) { return ns + 'recovery:' + id; },
    recoveryLog: ns + 'recovery-log',
    fulfillment: function (id) { return ns + 'fulfillment:' + id; },
    fulfillmentLease: function (id) { return ns + 'fulfillment-lease:' + id; },
    fulfillmentPending: ns + 'fulfillment-pending'
  });
  var envNames = Object.freeze({
    enabled: envStem + '_SUBSCRIBER_EMAIL_ENABLED',
    observerEnabled: envStem + '_SUBSCRIBER_OUTCOME_OBSERVER_ENABLED',
    maxSends: envStem + '_SUBSCRIBER_MAX_SENDS',
    emailCostUsd: envStem + '_SUBSCRIBER_EMAIL_USD',
    dailyBudgetUsd: envStem + '_SUBSCRIBER_DAILY_BUDGET_USD',
    dailySendCap: envStem + '_SUBSCRIBER_DAILY_SEND_CAP'
  });
  var valveId = productDomain + ':subscriber-email';
  var motorReceipt = Object.freeze({
    productDomain: productDomain,
    ownerDomain: ownerDomain,
    lane: LANE,
    contractId: productDomain + '-subscriber-motor/1.0',
    contracts: Object.freeze({ receipt: schemas.command, independentOutcome: schemas.observation })
  });

  function candidate(subscriber, digest) {
    var email = text(subscriber && subscriber.email);
    var subscriberDomain = String(subscriber && subscriber.domain || '').toLowerCase();
    var subject = text(digest && digest.subject), body = text(digest && digest.body), digestKey = text(digest && digest.key);
    if (!email || subscriberDomain !== productDomain || !subject || !body || !digestKey || subscriber.active !== true) return null;
    return {
      schemaVersion: schemas.candidate,
      productDomain: productDomain,
      ownerDomain: ownerDomain,
      lane: LANE,
      email: email.toLowerCase(),
      emailHash: hash(email.toLowerCase()),
      subject: subject,
      subjectHash: hash(subject),
      body: body,
      contentHash: hash(body),
      digestKey: digestKey,
      subscriberDomain: subscriberDomain,
      subscriptionIdentity: {
        active: true,
        subscriptionIdHash: subscriber.subscriptionId ? hash(String(subscriber.subscriptionId)) : null,
        customerIdHash: subscriber.customerId ? hash(String(subscriber.customerId)) : null
      },
      fulfillmentOnly: true,
      liveMoney: false
    };
  }

  function validateCandidate(value) {
    return !!(value && value.schemaVersion === schemas.candidate && value.productDomain === productDomain &&
      value.ownerDomain === ownerDomain && value.lane === LANE && value.subscriberDomain === productDomain &&
      text(value.email) && value.email === value.email.toLowerCase() && value.emailHash === hash(value.email) &&
      text(value.subject) && value.subjectHash === hash(value.subject) && text(value.body) &&
      value.contentHash === hash(value.body) && text(value.digestKey) && value.subscriptionIdentity &&
      value.subscriptionIdentity.active === true && value.fulfillmentOnly === true);
  }

  function validCognition(entry, now) {
    var cognition = entry && entry.c, recorded = Number(entry && entry.ts);
    var packet = cognition && cognition.serverPacket, generated = Date.parse(packet && packet.generatedAt);
    var cognitionOwner = String(cognition && cognition.domain || '');
    return !!(cognition && (cognitionOwner === productDomain || cognitionOwner === ownerDomain) &&
      Number.isFinite(recorded) && now >= recorded && now - recorded <= MAX_COGNITION_AGE_MS &&
      packet && packet.schemaVersion === 'civilization-domain-packet/1.0' && packet.domainId === productDomain &&
      packet.sourceIdentity && packet.sourceIdentity.producer === 'brain-cognition-refresh/1' &&
      Number.isFinite(generated) && now >= generated && now - generated <= MAX_COGNITION_AGE_MS);
  }

  async function readCognition(deps) {
    return deps && deps.cognition ? deps.cognition : (deps && deps.redisGet || Redis.redisGet)('limen:brain:cognition:' + productDomain);
  }

  function heldDecision(reason, blockers, extra) {
    return Object.assign({ ok: true, status: 'NO_ACTION', released: false, reason: reason,
      blockers: blockers || [], productDomain: productDomain, ownerDomain: ownerDomain,
      lane: LANE, providerCalled: false, liveMoney: false }, extra || {});
  }

  async function decide(store, value, now, deps) {
    var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    if (!validateCandidate(value)) return heldDecision(productDomain + '-b10-candidate-refused', ['paid-subscriber-candidate-invalid']);
    try {
      store.assertDurable();
      var entry = await readCognition(deps || {}), blockers = [];
      if (!validCognition(entry, at)) blockers.push(productDomain + '-brain-state-missing-or-stale');
      var cognition = entry && entry.c || {}, packet = cognition.serverPacket || {}, organs = cognition.brainOrgans || {};
      if (!blockers.length) {
        if ((cognition.immune || {}).immuneState !== 'clear') blockers.push(productDomain + '-immune-veto');
        if ((cognition.awareness || {}).humanReviewRequired === true) blockers.push(productDomain + '-human-review-veto');
        if ((organs.autonomousInternalEmission || {}).holdReason) blockers.push(productDomain + '-b10-brake-held:' + organs.autonomousInternalEmission.holdReason);
        if (!packet.truth || !packet.truth.feedHealth || !(Number(packet.truth.feedHealth.live) > 0)) blockers.push(productDomain + '-live-feeds-unavailable');
        var metabolism = organs.resourceMetabolism || {}, gates = metabolism.gates || {};
        if (metabolism.state !== 'AVAILABLE' || gates.mayRunInternalCycle !== true) blockers.push(productDomain + '-resource-metabolism-inhibited');
      }
      var actionId = short + 'sa_' + hash({ emailHash: value.emailHash, digestKey: value.digestKey, contentHash: value.contentHash }).slice(0, 24);
      var status = blockers.length ? 'NO_ACTION' : 'RELEASED';
      var receipt = {
        schemaVersion: schemas.decision,
        decisionReceiptId: short + 'sd_' + hash({ actionId: actionId, packetId: packet.packetId || null, status: status, blockers: blockers }).slice(0, 24),
        actionId: actionId,
        status: status,
        released: status === 'RELEASED',
        reason: blockers.length ? productDomain + '-b10-held' : null,
        blockers: blockers,
        productDomain: productDomain,
        ownerDomain: ownerDomain,
        lane: LANE,
        decisionContract: 'paid-subscriber-fulfillment-decision/1',
        emailHash: value.emailHash,
        subscriberDomain: value.subscriberDomain,
        digestKey: value.digestKey,
        subjectHash: value.subjectHash,
        contentHash: value.contentHash,
        domainPacketId: packet.packetId || null,
        selectionReasons: blockers.length ? [] : ['active-paid-subscription', 'changed-source-grounded-digest', productDomain + '-brain-safe-to-fulfill'],
        predictedOutcome: blockers.length ? null : { providerAcceptance: true, mailServerEvent: 'delivered-or-terminal-failure' },
        decidedAt: at,
        expiresAt: at + MAX_DECISION_AGE_MS,
        providerCalled: false,
        liveMoney: false
      };
      var created = await store.setIfAbsent(keys.decision(receipt.decisionReceiptId), receipt);
      var restored = await store.get(keys.decision(receipt.decisionReceiptId));
      if (!restored || restored.schemaVersion !== schemas.decision || restored.actionId !== actionId || restored.status !== status) throw new Error(productDomain + ' subscriber decision readback invalid');
      if (created) { await store.lpush(keys.decisionLog, restored); await store.ltrim(keys.decisionLog, 0, 999); }
      return restored;
    } catch (error) {
      return heldDecision(productDomain + '-b10-unavailable', ['decision-persistence-or-input-unavailable'], { detail: String(error && error.message || error) });
    }
  }

  function validateDecision(receipt, value, now) {
    var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    var actionId = short + 'sa_' + hash({ emailHash: value && value.emailHash, digestKey: value && value.digestKey, contentHash: value && value.contentHash }).slice(0, 24);
    return !!(validateCandidate(value) && receipt && receipt.schemaVersion === schemas.decision &&
      receipt.productDomain === productDomain && receipt.ownerDomain === ownerDomain && receipt.status === 'RELEASED' &&
      receipt.released === true && receipt.actionId === actionId && receipt.emailHash === value.emailHash &&
      receipt.subjectHash === value.subjectHash && receipt.contentHash === value.contentHash &&
      Number(receipt.decidedAt) <= at && at < Number(receipt.expiresAt));
  }

  function heldAuthorization(reason, blockers) {
    return { ok: true, authorized: false, status: 'HELD', reason: reason, blockers: blockers || [],
      productDomain: productDomain, ownerDomain: ownerDomain, lane: LANE, providerCalled: false, liveMoney: false };
  }

  async function verifyCapabilityPair(store, now) {
    var executor = await store.get(keys.executorCapability);
    var observer = await store.get(keys.observerCapability);
    var pair = MotorCapability.verifyPairReceipts(executor, observer, motorReceipt, now);
    if (!pair.ok) return pair;
    if (!MotorCapability.boundedIrreversibleCommissioningVerified(executor)) {
      return { ok: false, reason: productDomain + '-subscriber-executed-effect-proof-required' };
    }
    var at = Number(now);
    var executorAge = at - Number(executor.verifiedAt), observerAge = at - Number(observer.verifiedAt);
    var executorWindow = Number(executor.expiresAt) - Number(executor.verifiedAt);
    var observerWindow = Number(observer.expiresAt) - Number(observer.verifiedAt);
    if (executorAge > MAX_CAPABILITY_AGE_MS || observerAge > MAX_CAPABILITY_AGE_MS ||
        executorWindow > MAX_CAPABILITY_AGE_MS || observerWindow > MAX_CAPABILITY_AGE_MS) {
      return { ok: false, reason: productDomain + '-subscriber-capability-window-too-wide' };
    }
    return Object.assign({ ok: true }, pair);
  }

  async function authorize(store, requestedProduct, requestedLane, now, deps) {
    var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    var env = deps && deps.env || process.env;
    if (requestedProduct !== productDomain || requestedLane !== LANE) return heldAuthorization(productDomain + '-subscriber-authority-identity-mismatch');
    var policy = SubscriberPolicy.resolve(env, envNames);
    if (!policy.enabled) return heldAuthorization(productDomain + '-subscriber-email-switch-closed');
    if (!policy.observerEnabled) return heldAuthorization(productDomain + '-subscriber-outcome-observer-switch-closed');
    try {
      store.assertDurable();
      var capability = await verifyCapabilityPair(store, at);
      if (!capability.ok) return heldAuthorization(productDomain + '-subscriber-production-capability-missing-or-stale', [capability.reason]);
      var entry = await readCognition(deps || {}), blockers = [];
      if (!validCognition(entry, at)) blockers.push(productDomain + '-brain-state-missing-or-stale');
      var cognition = entry && entry.c || {}, organs = cognition.brainOrgans || {};
      if (!blockers.length) {
        if ((cognition.immune || {}).immuneState !== 'clear') blockers.push(productDomain + '-immune-veto');
        if ((cognition.awareness || {}).humanReviewRequired === true) blockers.push(productDomain + '-human-review-veto');
        if ((organs.autonomousInternalEmission || {}).holdReason) blockers.push(productDomain + '-b10-brake-held:' + organs.autonomousInternalEmission.holdReason);
        var metabolism = organs.resourceMetabolism || {}, gates = metabolism.gates || {};
        if (metabolism.state !== 'AVAILABLE' || gates.mayRunInternalCycle !== true) blockers.push(productDomain + '-resource-metabolism-inhibited');
      }
      if (blockers.length) return heldAuthorization(productDomain + '-subscriber-motor-held', blockers);
      var packet = cognition.serverPacket || {};
      var receiptId = short + 'smr_' + hash({ packetId: packet.packetId,
        executorCapabilityId: capability.executorCapabilityId,
        observerCapabilityId: capability.observerCapabilityId, lane: LANE, at: at }).slice(0, 24);
      var receipt = {
        schemaVersion: schemas.authorization,
        receiptId: receiptId,
        authorized: true,
        status: 'AUTHORIZED',
        productDomain: productDomain,
        ownerDomain: ownerDomain,
        lane: LANE,
        domainPacketId: packet.packetId,
        executorCapabilityId: capability.executorCapabilityId,
        observerCapabilityId: capability.observerCapabilityId,
        executorEvidenceReceiptId: capability.executorEvidenceReceiptId,
        observerEvidenceReceiptId: capability.observerEvidenceReceiptId,
        authorizedAt: at,
        expiresAt: at + MAX_DECISION_AGE_MS,
        safety: { externalEffectExecuted: false, providerCalled: false, spendUsd: 0 },
        liveMoney: false
      };
      await store.setIfAbsent(keys.authorization(receiptId), receipt);
      var restored = await store.get(keys.authorization(receiptId));
      if (!restored || restored.schemaVersion !== schemas.authorization || restored.receiptId !== receiptId || restored.authorized !== true) throw new Error(productDomain + ' subscriber authorization readback invalid');
      await store.lpush(keys.authorizationLog, restored); await store.ltrim(keys.authorizationLog, 0, 999);
      return restored;
    } catch (error) {
      return heldAuthorization(productDomain + '-subscriber-motor-authorization-unavailable', [String(error && error.message || error)]);
    }
  }

  async function setCommand(store, value) {
    await store.set(keys.command(value.commandId), value);
    var restored = await store.get(keys.command(value.commandId));
    if (!restored || restored.commandId !== value.commandId || restored.status !== value.status) throw new Error(productDomain + ' subscriber command readback invalid');
    return restored;
  }

  async function ensureObservationQueued(store, command, index) {
    var item = command && command.items && command.items[index];
    if (!item || item.status !== 'ACCEPTED' || !item.providerEmailId || item.observationEnqueuedAt) return command;
    var enqueuedAt = Date.now();
    await store.lpush(keys.observationPending, { commandId: command.commandId, actionId: item.actionId,
      providerEmailId: item.providerEmailId, enqueuedAt: enqueuedAt });
    item.observationEnqueuedAt = enqueuedAt;
    return setCommand(store, command);
  }

  async function reconcileAcceptedObservations(store, command) {
    for (var i = 0; i < (command.items || []).length; i++) {
      command = await ensureObservationQueued(store, command, i);
    }
    return command;
  }

  async function finalizeCommandIfSettled(store, command) {
    var unsettled = (command.items || []).some(function (item) {
      return item && ['QUEUED', 'PRE_SEND', 'DISPATCHING'].indexOf(item.status) >= 0;
    });
    if (unsettled) return command;
    command.status = command.ambiguous ? 'PARTIAL_AMBIGUOUS' : command.failed && !command.accepted ? 'FAILED'
      : command.inhibitedHeld && !command.accepted ? 'HELD_INHIBITED'
      : command.preSendHeld && !command.accepted ? 'HELD_PRE_SEND'
      : command.budgetHeld && !command.accepted ? 'HELD_BUDGET' : 'RECEIPTS_PERSISTED';
    command.estimatedCommittedUsd = (command.accepted + command.ambiguous + command.failed) * command.emailCostUsd;
    command.completedAt = command.completedAt || Date.now(); command.readbackVerified = true;
    return setCommand(store, command);
  }

  async function claimBudget(store, actionId, slots, now, costUsd) {
    var date = day(now);
    for (var i = 1; i <= slots; i++) {
      var key = keys.budgetSlot(date, i), value = { schemaVersion: schemas.command, productDomain: productDomain,
        actionId: actionId, day: date, slot: i, estimatedCostUsd: costUsd, claimedAt: now };
      var created = await store.setIfAbsent(key, value), restored = await store.get(key);
      if (restored && restored.productDomain === productDomain && restored.actionId === actionId) return { ok: true, slot: i, duplicate: !created };
    }
    return { ok: false, reason: productDomain + '-subscriber-daily-budget-exhausted' };
  }

  function heldExecution(reason, extra) {
    return Object.assign({ ok: true, status: 'HELD', accepted: 0, reason: reason,
      productDomain: productDomain, ownerDomain: ownerDomain, lane: LANE, providerCalls: 0, liveMoney: false }, extra || {});
  }

  async function recordCommand(store, command, item) {
    var cause = { schemaVersion: schemas.learning, domain: ownerDomain, productDomain: productDomain, lane: LANE,
      actionId: item.actionId, commandId: command.commandId, decisionReceiptId: item.decisionReceiptId,
      contentHash: item.contentHash, predictedOutcome: { mailServerEvent: 'delivered-or-terminal-failure' }, commandedAt: Date.now() };
    var created = await store.setIfAbsent(keys.learningCause(item.actionId), cause);
    var restored = await store.get(keys.learningCause(item.actionId));
    if (!restored || restored.schemaVersion !== schemas.learning || restored.productDomain !== productDomain ||
        restored.actionId !== item.actionId || restored.contentHash !== item.contentHash) {
      throw new Error(productDomain + ' subscriber learning cause readback invalid');
    }
    return { ok: true, duplicate: !created, cause: restored };
  }

  async function readSuppression(store, emailHash) {
    var current = await store.get(keys.suppression(emailHash));
    if (current && current.suppressed === true) return current;
    var legacy = await store.get(keys.legacySuppression);
    var prior = legacy && typeof legacy === 'object' && !Array.isArray(legacy) ? legacy[emailHash] : null;
    if (!(prior && prior.suppressed === true)) return current;
    var migrated = Object.assign({}, prior, { migratedFrom: keys.legacySuppression, migratedAt: Date.now() });
    await store.setIfAbsent(keys.suppression(emailHash), migrated);
    var restored = await store.get(keys.suppression(emailHash));
    if (!restored || restored.suppressed !== true) {
      throw new Error(productDomain + ' subscriber legacy suppression migration failed');
    }
    return restored;
  }

  function validFinalEntitlement(catalog, value) {
    var subscriber = catalog && typeof catalog === 'object' && !Array.isArray(catalog) ?
      catalog[Subscriptions.norm(value && value.email)] : null;
    if (!subscriber || subscriber.active !== true || Subscriptions.norm(subscriber.email) !== value.email ||
        String(subscriber.domain || '').toLowerCase() !== productDomain) return false;
    var identity = value.subscriptionIdentity || {};
    if (identity.subscriptionIdHash && hash(String(subscriber.subscriptionId || '')) !== identity.subscriptionIdHash) return false;
    if (identity.customerIdHash && hash(String(subscriber.customerId || '')) !== identity.customerIdHash) return false;
    return true;
  }

  async function execute(input) {
    input = input || {};
    var store = input.store, specs = Array.isArray(input.specs) ? input.specs : [], now = Number(input.now) || Date.now();
    var cap = Math.max(0, Math.min(HARD_MAX_SENDS, Number(input.maxSends) || 0));
    if (!cap) return heldExecution(productDomain + '-subscriber-send-cap-zero');
    var emailCostUsd = Number(input.emailCostUsd), dailySendCap = Math.max(0, Math.min(1000, Number(input.dailySendCap) || 0));
    var dailyBudgetUsd = Number(input.dailyBudgetUsd);
    if (input.emailCostUsd == null || !Number.isFinite(emailCostUsd) || emailCostUsd < 0) return heldExecution(productDomain + '-subscriber-email-unit-cost-not-configured');
    if (!dailySendCap) return heldExecution(productDomain + '-subscriber-daily-send-cap-zero');
    if (emailCostUsd > 0 && (!Number.isFinite(dailyBudgetUsd) || dailyBudgetUsd < emailCostUsd)) return heldExecution(productDomain + '-subscriber-daily-dollar-budget-not-configured-or-too-small');
    var dailySlots = Math.min(dailySendCap, emailCostUsd === 0 ? dailySendCap : Math.floor((dailyBudgetUsd + 1e-12) / emailCostUsd));
    if (!dailySlots) return heldExecution(productDomain + '-subscriber-daily-budget-zero');
    specs = specs.filter(function (row) { return row && validateDecision(row.decision, row.candidate, now); }).slice(0, cap);
    if (!specs.length) return heldExecution(productDomain + '-subscriber-no-released-exact-decisions');
    try {
      store.assertDurable();
      var durableSpecs = [];
      for (var d = 0; d < specs.length; d++) {
        var submitted = specs[d];
        var durableDecision = await store.get(keys.decision(submitted.decision.decisionReceiptId));
        if (validateDecision(durableDecision, submitted.candidate, now)) {
          durableSpecs.push({ candidate: submitted.candidate, decision: durableDecision });
        }
      }
      specs = durableSpecs;
      if (!specs.length) return heldExecution(productDomain + '-subscriber-durable-decision-missing-or-invalid');
      var unsuppressed = [];
      for (var s = 0; s < specs.length; s++) {
        var suppression = await readSuppression(store, specs[s].candidate.emailHash);
        if (!(suppression && suppression.suppressed === true)) unsuppressed.push(specs[s]);
      }
      specs = unsuppressed;
      if (!specs.length) return heldExecution(productDomain + '-subscriber-all-candidates-suppressed');
      var motor = await (input.motorAuthorization || { authorize: authorize }).authorize(store, productDomain, LANE, now, input.authorizationDeps);
      if (!motor || !motor.authorized) return heldExecution(motor && motor.reason || productDomain + '-subscriber-motor-held', {
        motorReceiptId: motor && motor.receiptId || null, motorBlockers: motor && motor.blockers || []
      });
      var commandId = short + 'sc_' + hash({ motor: motor.receiptId, actions: specs.map(function (row) { return row.decision.actionId; }) }).slice(0, 24);
      var existing = await store.get(keys.command(commandId));
      if (existing) {
        existing = await finalizeCommandIfSettled(store, existing);
        existing = await reconcileAcceptedObservations(store, existing);
        return Object.assign({ ok: true, replayed: true, accepted: existing.accepted || 0 }, existing);
      }
      var command = {
        schemaVersion: schemas.command, commandId: commandId, status: 'COMMANDING', productDomain: productDomain,
        ownerDomain: ownerDomain, lane: LANE, productMotorReceiptId: motor.receiptId,
        executorCapabilityId: motor.executorCapabilityId, observerCapabilityId: motor.observerCapabilityId,
        maxSends: cap, items: specs.map(function (row) { return {
          actionId: row.decision.actionId, decisionReceiptId: row.decision.decisionReceiptId,
          emailHash: row.candidate.emailHash, subscriberDomain: row.candidate.subscriberDomain,
          digestKey: row.candidate.digestKey, subjectHash: row.candidate.subjectHash,
          contentHash: row.candidate.contentHash, status: 'QUEUED'
        }; }),
        predictedCount: specs.length, accepted: 0, failed: 0, ambiguous: 0, budgetHeld: 0, providerCalls: 0,
        emailCostUsd: emailCostUsd, dailyBudgetUsd: emailCostUsd === 0 ? 0 : dailyBudgetUsd,
        dailySendCap: dailySlots, commandedAt: now, liveMoney: false
      };
      if (!(await store.setIfAbsent(keys.command(commandId), command))) return store.get(keys.command(commandId));
      command = await store.get(keys.command(commandId));
      if (!command || command.status !== 'COMMANDING') throw new Error(productDomain + ' subscriber pre-dispatch command readback invalid');
      if (!(await store.setIfAbsent(keys.motorClaim(motor.receiptId), { schemaVersion: schemas.command, productDomain: productDomain,
        commandId: commandId, productMotorReceiptId: motor.receiptId, claimedAt: now }))) {
        command.status = 'REFUSED'; command.reason = productDomain + '-subscriber-motor-receipt-already-consumed'; return setCommand(store, command);
      }
      var restoredMotor = await store.get(keys.motorClaim(motor.receiptId));
      if (!restoredMotor || restoredMotor.productDomain !== productDomain || restoredMotor.commandId !== commandId) throw new Error(productDomain + ' subscriber motor claim readback invalid');
      await store.lpush(keys.pendingCommandLog, command); await store.ltrim(keys.pendingCommandLog, 0, 999);
      if (!input.transport || typeof input.transport.send !== 'function') throw new Error(productDomain + ' subscriber transport missing');
      for (var i = 0; i < specs.length; i++) {
        var spec = specs[i], item = command.items[i], idempotencyKey = productDomain + '-digest/' + item.actionId;
        var prior = await store.get(keys.action(item.actionId));
        var stalePreSend = !!(prior && prior.status === 'PRE_SEND' && Number.isFinite(Number(prior.claimedAt)) &&
          Date.now() - Number(prior.claimedAt) > ACTION_CLAIM_STALE_MS);
        var resumablePrior = prior && (['HELD_INHIBITED', 'HELD_PRE_SEND'].indexOf(prior.status) >= 0 || stalePreSend);
        if (prior && !resumablePrior) {
          var staleDispatch = prior.status === 'DISPATCHING' && Number.isFinite(Number(prior.dispatchingAt)) &&
            Date.now() - Number(prior.dispatchingAt) > ACTION_CLAIM_STALE_MS;
          if (staleDispatch) {
            var abandoned = Object.assign({}, prior, { status: 'AMBIGUOUS', providerCalled: true,
              failure: 'abandoned-dispatch-outcome-unknown', resolvedAt: Date.now() });
            if (await store.replaceIfValue(keys.action(item.actionId), prior, abandoned)) {
              item.status = 'AMBIGUOUS'; item.providerCalled = true; item.providerEmailId = null;
              item.failure = abandoned.failure; item.resolvedAt = abandoned.resolvedAt; command.ambiguous++;
              continue;
            }
            prior = await store.get(keys.action(item.actionId));
          }
          if (prior && (prior.status === 'PRE_SEND' || prior.status === 'DISPATCHING')) {
            item.status = 'HELD_PRE_SEND'; item.providerCalled = false;
            item.providerCallMayBeInFlight = prior.status === 'DISPATCHING';
            item.failure = 'same-action-dispatch-already-in-progress'; command.preSendHeld = Number(command.preSendHeld || 0) + 1;
            continue;
          }
          item.status = prior.status || 'PREVIOUSLY_CLAIMED';
          item.providerEmailId = prior.providerEmailId || null;
          item.providerCalled = prior.providerCalled !== false;
          if (item.status === 'ACCEPTED') command.accepted++; else if (item.status === 'FAILED') command.failed++; else command.ambiguous++;
          continue;
        }
        var budget = await claimBudget(store, item.actionId, dailySlots, now, emailCostUsd);
        if (!budget.ok) { item.status = 'BUDGET_HELD'; item.failure = budget.reason; command.budgetHeld++; continue; }
        item.budgetSlot = budget.slot; item.estimatedCostUsd = emailCostUsd;
        var claim = { schemaVersion: schemas.command, productDomain: productDomain, actionId: item.actionId,
          commandId: commandId, status: 'PRE_SEND', providerCalled: false,
          idempotencyKey: idempotencyKey, claimToken: crypto.randomBytes(16).toString('hex'), claimedAt: Date.now() };
        var claimed = resumablePrior ? (await store.replaceIfValue(keys.action(item.actionId), prior, claim)) :
          (await store.setIfAbsent(keys.action(item.actionId), claim));
        if (!claimed) {
          prior = await store.get(keys.action(item.actionId));
          if (prior && (prior.status === 'PRE_SEND' || prior.status === 'DISPATCHING')) {
            item.status = 'HELD_PRE_SEND'; item.providerCalled = false;
            item.failure = 'same-action-dispatch-claim-won-concurrently';
            command.preSendHeld = Number(command.preSendHeld || 0) + 1;
          } else {
            item.status = prior && prior.status || 'PREVIOUSLY_CLAIMED';
            item.providerEmailId = prior && prior.providerEmailId || null;
            if (item.status === 'ACCEPTED') command.accepted++;
            else if (item.status === 'FAILED') command.failed++;
            else command.ambiguous++;
          }
          continue;
        }
        var restoredClaim = await store.get(keys.action(item.actionId));
        if (!restoredClaim || restoredClaim.productDomain !== productDomain || restoredClaim.commandId !== commandId || restoredClaim.status !== 'PRE_SEND') throw new Error(productDomain + ' subscriber action claim readback invalid');
        item.status = 'PRE_SEND'; item.idempotencyKey = idempotencyKey; command.status = 'PRE_SEND'; command = await setCommand(store, command); item = command.items[i];
        var result, activeClaim = claim;
        if (!result) {
          try { await recordCommand(store, command, item); }
          catch (error) {
            result = { ok: false, providerCalled: false, definitiveFailure: false,
              preSendHeld: true, ambiguous: false, error: String(error && error.message || error) };
          }
        }
        if (!result) {
          try {
            item.adapterGuard = await (input.adapterGuard || AdapterGuard).checkpoint(store, valveId, 'resend-subscriber-email', Date.now());
          } catch (error) {
            var inhibited = !!(error && error.code === AdapterGuard.INHIBITED);
            result = { ok: false, providerCalled: false, definitiveFailure: false,
              inhibited: inhibited, preSendHeld: !inhibited, ambiguous: false,
              error: String(error && error.message || error) };
          }
        }
        if (!result) {
          try {
            var lastMomentSuppression = await readSuppression(store, item.emailHash);
            if (lastMomentSuppression && lastMomentSuppression.suppressed === true) {
              result = { ok: false, providerCalled: false, definitiveFailure: false,
                inhibited: true, preSendHeld: false, ambiguous: false,
                error: productDomain + '-subscriber-suppressed-before-provider' };
            }
          } catch (error) {
            result = { ok: false, providerCalled: false, definitiveFailure: false,
              inhibited: false, preSendHeld: true, ambiguous: false,
              error: String(error && error.message || error) };
          }
        }
        if (!result) {
          try {
            var finalEntitlementCatalog = await store.get('subs:v1');
            if (!validFinalEntitlement(finalEntitlementCatalog, spec.candidate)) {
              result = { ok: false, providerCalled: false, definitiveFailure: false,
                inhibited: false, preSendHeld: true, ambiguous: false,
                error: productDomain + '-subscriber-entitlement-changed-before-provider' };
            }
          } catch (error) {
            result = { ok: false, providerCalled: false, definitiveFailure: false,
              inhibited: false, preSendHeld: true, ambiguous: false,
              error: String(error && error.message || error) };
          }
        }
        if (!result) {
          try {
            var nextClaim = Object.assign({}, claim, { status: 'DISPATCHING',
              providerCalled: true, dispatchingAt: Date.now() });
            if (!(await store.replaceIfValue(keys.action(item.actionId), activeClaim, nextClaim))) {
              throw new Error(productDomain + ' subscriber action claim lost before dispatch');
            }
            activeClaim = nextClaim;
            var dispatchClaim = await store.get(keys.action(item.actionId));
            if (!dispatchClaim || dispatchClaim.status !== 'DISPATCHING' || dispatchClaim.commandId !== commandId ||
                dispatchClaim.claimToken !== claim.claimToken) {
              throw new Error(productDomain + ' subscriber dispatch claim readback invalid');
            }
            item.status = 'DISPATCHING'; command.status = 'DISPATCHING'; command = await setCommand(store, command);
            item = command.items[i];
          } catch (error) {
            result = { ok: false, providerCalled: false, definitiveFailure: false,
              preSendHeld: true, ambiguous: false, error: String(error && error.message || error) };
          }
        }
        if (!result) {
          try {
            result = await input.transport.send(spec.candidate.email, spec.candidate.subject, spec.candidate.body, { idempotencyKey: idempotencyKey });
          } catch (error) {
            result = { ok: false, providerCalled: true, definitiveFailure: false,
              ambiguous: true, error: String(error && error.message || error) };
          }
        }
        if (result && result.notReady === true && result.providerCalled === false) {
          result.definitiveFailure = false; result.preSendHeld = true;
        }
        item.status = result && result.ok && result.id ? 'ACCEPTED' : (result && result.inhibited ? 'HELD_INHIBITED'
          : (result && result.preSendHeld ? 'HELD_PRE_SEND'
          : (result && result.definitiveFailure ? 'FAILED' : 'AMBIGUOUS')));
        item.providerEmailId = result && result.id || null; item.providerCalled = !(result && result.providerCalled === false);
        item.failure = result && !result.ok ? String(result.error || 'send-unresolved').slice(0, 240) : null;
        item.resolvedAt = result && (result.inhibited || result.preSendHeld) ? null : Date.now();
        item.heldAt = result && (result.inhibited || result.preSendHeld) ? Date.now() : null;
        if (item.providerCalled) command.providerCalls++;
        if (item.status === 'ACCEPTED') command.accepted++;
        else if (item.status === 'FAILED') command.failed++;
        else if (item.status === 'HELD_INHIBITED') command.inhibitedHeld = Number(command.inhibitedHeld || 0) + 1;
        else if (item.status === 'HELD_PRE_SEND') command.preSendHeld = Number(command.preSendHeld || 0) + 1;
        else command.ambiguous++;
        if (['HELD_INHIBITED', 'HELD_PRE_SEND'].indexOf(item.status) >= 0) {
          var heldClaim = Object.assign({}, claim, { status: item.status,
            providerCalled: false, failure: item.failure, heldAt: item.heldAt });
          if (!(await store.replaceIfValue(keys.action(item.actionId), activeClaim, heldClaim))) {
            throw new Error(productDomain + ' subscriber action claim lost while holding');
          }
          var restoredHeld = await store.get(keys.action(item.actionId));
          if (!restoredHeld || restoredHeld.status !== item.status || restoredHeld.providerCalled !== false ||
              restoredHeld.claimToken !== claim.claimToken) {
            throw new Error(productDomain + ' subscriber pre-send hold readback invalid');
          }
        } else {
          var finalClaim = Object.assign({}, claim, { status: item.status,
            providerEmailId: item.providerEmailId, providerCalled: item.providerCalled, resolvedAt: item.resolvedAt });
          if (!(await store.replaceIfValue(keys.action(item.actionId), activeClaim, finalClaim))) {
            throw new Error(productDomain + ' subscriber action claim lost while finalizing');
          }
          var restoredAction = await store.get(keys.action(item.actionId));
          if (!restoredAction || restoredAction.status !== item.status || restoredAction.commandId !== commandId ||
              restoredAction.claimToken !== claim.claimToken) throw new Error(productDomain + ' subscriber action readback invalid');
        }
        command = await setCommand(store, command);
      }
      command = await finalizeCommandIfSettled(store, command);
      command = await reconcileAcceptedObservations(store, command);
      await store.lpush(keys.commandLog, command); await store.ltrim(keys.commandLog, 0, 999);
      return Object.assign({ ok: command.status === 'RECEIPTS_PERSISTED' || command.accepted > 0 }, command);
    } catch (error) {
      return { ok: false, status: 'REFUSED', accepted: 0, reason: productDomain + '-subscriber-strict-boundary-unavailable',
        detail: String(error && error.message || error), productDomain: productDomain, ownerDomain: ownerDomain,
        lane: LANE, providerCalls: 0, liveMoney: false };
    }
  }

  async function observe(store, command, item, deps) {
    deps = deps || {};
    if (!command || command.schemaVersion !== schemas.command || command.productDomain !== productDomain ||
        !item || item.status !== 'ACCEPTED' || !item.providerEmailId) {
      return { ok: false, status: 'REFUSED', reason: 'accepted-provider-receipt-required', sendProviderCalled: false, liveMoney: false };
    }
    var apiKey = deps.apiKey || process.env.RESEND_API_KEY;
    if (!apiKey) return { ok: true, status: 'OBSERVATION_PENDING', reason: 'resend-read-credential-unavailable', actionId: item.actionId, providerReadAttempted: false, sendProviderCalled: false, liveMoney: false };
    var observedNow = Number.isFinite(Number(deps.now)) ? Number(deps.now) : Date.now();
    var previous = await store.get(keys.observation(item.providerEmailId));
    if (previous && previous.productDomain === productDomain && previous.actionId === item.actionId &&
        previous.followUpUntil && !previous.followUpComplete && Number(previous.nextPollAt || 0) > observedNow) {
      return { ok: true, status: 'OBSERVATION_DEFERRED', reason: 'positive-lifecycle-follow-up-not-due',
        actionId: item.actionId, providerEmailId: item.providerEmailId, nextPollAt: previous.nextPollAt,
        followUpUntil: previous.followUpUntil, providerReadAttempted: false, sendProviderCalled: false, liveMoney: false };
    }
    var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, 15000), response, body;
    try {
      response = await (deps.fetch || fetch)('https://api.resend.com/emails/' + encodeURIComponent(item.providerEmailId), {
        method: 'GET', signal: controller.signal,
        headers: { authorization: 'Bearer ' + apiKey, accept: 'application/json', 'user-agent': 'limen-helix/1.0' }
      });
      body = await response.json().catch(function () { return null; });
    } catch (_) {
      return { ok: true, status: 'OBSERVATION_PENDING', reason: 'resend-read-unreachable', actionId: item.actionId, providerReadAttempted: true, sendProviderCalled: false, liveMoney: false };
    } finally { clearTimeout(timer); }
    if (!response.ok || !body || body.id !== item.providerEmailId) return { ok: true, status: 'OBSERVATION_PENDING', reason: 'resend-read-not-authoritative', actionId: item.actionId, httpStatus: response.status, providerReadAttempted: true, sendProviderCalled: false, liveMoney: false };
    var event = String(body.last_event || 'unknown').toLowerCase();
    var providerCreatedAt = Date.parse(body.created_at || ''), followUpStartedAt = previous && previous.followUpStartedAt;
    if (!Number.isFinite(followUpStartedAt)) followUpStartedAt = Number.isFinite(providerCreatedAt) && providerCreatedAt <= observedNow ? providerCreatedAt : observedNow;
    var followUpUntil = POSITIVE[event] ? Number(previous && previous.followUpUntil || followUpStartedAt + POSITIVE_FOLLOW_UP_MS) : null;
    var followUpComplete = !!(POSITIVE[event] && observedNow >= followUpUntil);
    var finalObserved = !!(NEGATIVE[event] || event === 'canceled' || followUpComplete);
    var receipt = {
      schemaVersion: schemas.observation,
      observationId: short + 'so_' + hash(item.providerEmailId + ':' + event + ':' + String(body.created_at || '')).slice(0, 24),
      productDomain: productDomain, ownerDomain: ownerDomain, lane: LANE,
      commandId: command.commandId, actionId: item.actionId, providerEmailId: item.providerEmailId,
      emailHash: item.emailHash, status: finalObserved ? 'TERMINAL_OBSERVED' : 'PENDING_OBSERVED',
      lastEvent: event, providerRecordCreatedAt: body.created_at || null, independentOfSendResponse: true,
      mailServerFeedback: ['delivered', 'bounced', 'complained', 'delivery_delayed'].indexOf(event) >= 0,
      followUpStartedAt: POSITIVE[event] ? followUpStartedAt : null,
      followUpUntil: followUpUntil, followUpComplete: followUpComplete,
      nextPollAt: POSITIVE[event] && !followUpComplete ? Math.min(followUpUntil, observedNow + POSITIVE_POLL_MS) : null,
      providerReadAttempted: true, sendEndpointCalled: false, observedAt: observedNow, liveMoney: false
    };
    if (deps.observationLeaseToken) {
      if (!(await store.setIfLockOwned(keys.observationLease(item.actionId), deps.observationLeaseToken,
        keys.observation(item.providerEmailId), receipt))) {
        throw new Error(productDomain + ' subscriber observation lease expired before commit');
      }
    } else await store.set(keys.observation(item.providerEmailId), receipt);
    var restored = await store.get(keys.observation(item.providerEmailId));
    if (!restored || restored.observationId !== receipt.observationId || restored.productDomain !== productDomain || restored.lastEvent !== event) throw new Error(productDomain + ' subscriber observation readback invalid');
    await store.lpush(keys.observationLog, restored); await store.ltrim(keys.observationLog, 0, 1999);
    return restored;
  }

  async function observeRecent(store, commands, deps) {
    var rows = [], list = Array.isArray(commands) ? commands : [];
    for (var i = 0; i < list.length; i++) {
      if (!list[i] || list[i].productDomain !== productDomain) continue;
      for (var j = 0; j < (list[i].items || []).length; j++) {
        if (list[i].items[j] && list[i].items[j].status === 'ACCEPTED') rows.push(await observe(store, list[i], list[i].items[j], deps));
      }
    }
    return rows;
  }

  async function observeNext(store, deps, seen) {
    seen = seen || {};
    var ref = await store.lmove(keys.observationPending, keys.observationPending, 'RIGHT', 'LEFT');
    if (!ref) return { cycleComplete: true };
    if (!ref.commandId || !ref.actionId) {
      await store.lrem(keys.observationPending, 1, ref);
      return { skipped: true };
    }
    if (seen[ref.actionId]) {
      return { skipped: true, revisitedRef: true };
    }
    seen[ref.actionId] = true;
    var leaseToken = { actionId: ref.actionId, nonce: crypto.randomBytes(16).toString('hex') };
    if (!(await store.setIfAbsent(keys.observationLease(ref.actionId), leaseToken, OBSERVATION_LEASE_SECONDS))) {
      return { skipped: true, leaseHeld: true };
    }
    var command = await store.get(keys.command(ref.commandId));
    var item = findItem(command, ref.actionId);
    if (!command || command.productDomain !== productDomain || !item || item.status !== 'ACCEPTED') {
      var transitional = command && command.productDomain === productDomain && item &&
        ['DISPATCHING', 'COMMANDING'].indexOf(item.status) >= 0;
      if (!transitional) await store.lrem(keys.observationPending, 1, ref);
      await store.deleteIfValue(keys.observationLease(ref.actionId), leaseToken);
      return { skipped: true };
    }
    var observeDeps = Object.assign({}, deps || {}, { observationLeaseToken: leaseToken });
    return { observation: await observe(store, command, item, observeDeps), pendingRef: ref, leaseToken: leaseToken };
  }

  async function releaseObservationLease(store, ref, leaseToken) {
    if (!ref || !ref.actionId || !leaseToken) return false;
    return (await store.deleteIfValue(keys.observationLease(ref.actionId), leaseToken)) > 0;
  }

  async function observePending(store, deps) {
    var rows = [], seen = {}, depth = await store.llen(keys.observationPending);
    for (var i = 0; i < Math.min(100, depth); i++) {
      var next = await observeNext(store, deps, seen);
      if (next.cycleComplete) break;
      if (next.observation) rows.push(next);
    }
    return rows;
  }

  async function acknowledgeObservation(store, ref) {
    if (!ref || !ref.commandId || !ref.actionId) return false;
    var removed = (await store.lrem(keys.observationPending, 1, ref)) > 0;
    if (!removed || !ref.providerEmailId) return removed;
    var lockToken = { actionId: ref.actionId, nonce: crypto.randomBytes(16).toString('hex') };
    if (!(await store.setIfAbsent(keys.learningLock, lockToken, 120))) return removed;
    try {
      var state = await loadLearning(store);
      var records = retainedObservationRecords(state, Date.now()).filter(function (row) {
        return row.providerEmailId !== ref.providerEmailId;
      });
      state.processedObservations = records;
      state.processedObservationIds = records.map(function (row) { return row.observationId; });
      if (!(await store.setIfLockOwned(keys.learningLock, lockToken, keys.learning, state))) {
        throw new Error(productDomain + ' subscriber learning dedupe acknowledgement lost its lock');
      }
    } finally {
      await store.deleteIfValue(keys.learningLock, lockToken);
    }
    return removed;
  }

  function observationDepth(store) { return store.llen(keys.observationPending); }

  async function reconcileLegacyObservationPending(store) {
    var completed = await store.get(keys.observationPendingMigration);
    if (completed && completed.status === 'COMPLETED') return completed;
    var commands = await store.lrange(keys.commandLog, 0, 999), queued = 0;
    for (var i = 0; i < commands.length; i++) {
      var logged = commands[i];
      if (!logged || logged.productDomain !== productDomain || !logged.commandId) continue;
      var command = await store.get(keys.command(logged.commandId)) || logged;
      if (!command || command.productDomain !== productDomain) continue;
      for (var j = 0; j < (command.items || []).length; j++) {
        var item = command.items[j];
        if (!item || item.status !== 'ACCEPTED' || !item.actionId || !item.providerEmailId) continue;
        await store.ensureListMember(keys.observationPending, { commandId: command.commandId,
          actionId: item.actionId, providerEmailId: item.providerEmailId,
          enqueuedAt: item.observationEnqueuedAt || command.completedAt || command.commandedAt });
        queued++;
      }
    }
    var receipt = { schemaVersion: productDomain + '-subscriber-observation-pending-migration/1.0',
      productDomain: productDomain, status: 'COMPLETED', inspectedCommands: commands.length,
      reconciledAcceptedActions: queued, completedAt: Date.now() };
    await store.setIfAbsent(keys.observationPendingMigration, receipt);
    var restored = await store.get(keys.observationPendingMigration);
    if (!restored || restored.status !== 'COMPLETED' || restored.productDomain !== productDomain) {
      throw new Error(productDomain + ' subscriber observation queue migration readback invalid');
    }
    return restored;
  }

  function credit(event) { if (event === 'clicked') return 1; if (event === 'delivered' || event === 'opened') return 0.5; return 0; }
  function resolved(event) { return ['delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed', 'suppressed', 'canceled'].indexOf(event) >= 0; }
  function finalObservation(observation) {
    return !!(observation && (NEGATIVE[observation.lastEvent] || observation.lastEvent === 'canceled' ||
      (POSITIVE[observation.lastEvent] && observation.followUpComplete === true)));
  }
  function validLearningSignal(signal) {
    return !!(signal && signal.schemaVersion === 'product-domain-external-learning/1.0' &&
      signal.ownerDomain === ownerDomain && signal.productDomain === productDomain && signal.lane === LANE &&
      signal.sourceKind === 'independent-action-outcome' && signal.sourceIdentity &&
      typeof signal.sourceIdentity.kind === 'string' && signal.sourceIdentity.kind.trim() &&
      typeof signal.sourceIdentity.value === 'string' && signal.sourceIdentity.value.trim() &&
      typeof signal.normalizedCredit === 'number' && signal.normalizedCredit >= 0 && signal.normalizedCredit <= 1 &&
      text(signal.signalId) && text(signal.eventId) && text(signal.actionId) && text(signal.eventType) &&
      text(signal.outcome) && typeof signal.observedAt === 'number' && Number.isFinite(signal.observedAt));
  }
  async function loadLearning(store) {
    var state = await store.get(keys.learning);
    if (!state) return { schemaVersion: schemas.learning, domain: ownerDomain, productDomain: productDomain,
      lane: LANE, resolvedCount: 0, signals: [], processedObservationIds: [], processedObservations: [], lastOutcomeAt: null };
    if (state.schemaVersion !== schemas.learning || state.domain !== ownerDomain || state.productDomain !== productDomain ||
        state.lane !== LANE || !Number.isInteger(state.resolvedCount) || state.resolvedCount < 0 ||
        !Array.isArray(state.signals) || !Array.isArray(state.processedObservationIds) ||
        !state.signals.every(validLearningSignal) || !state.processedObservationIds.every(function (id) { return !!text(id); }) ||
        new Set(state.processedObservationIds).size !== state.processedObservationIds.length ||
        (state.processedObservations != null && (!Array.isArray(state.processedObservations) ||
          !state.processedObservations.every(function (row) {
            return row && text(row.observationId) && Number.isFinite(Number(row.retainUntil));
          }) || new Set(state.processedObservations.map(function (row) { return row.observationId; })).size !== state.processedObservations.length)) ||
        state.resolvedCount < state.processedObservationIds.length) throw new Error(productDomain + ' subscriber learning state malformed');
    return state;
  }
  function retainedObservationRecords(state, now) {
    var records = Array.isArray(state.processedObservations) ? state.processedObservations.slice() : [];
    var known = {};
    records.forEach(function (row) { known[row.observationId] = true; });
    state.processedObservationIds.forEach(function (id) {
      if (known[id]) return;
      var signal = state.signals.find(function (row) { return row && row.eventId === id; });
      records.push({ observationId: id,
        retainUntil: Number(signal && signal.observedAt || now) + LEARNING_DEDUPE_RETENTION_MS,
        migratedFromIdOnlyState: true });
    });
    return records;
  }
  async function recordObservation(store, observation) {
    if (!observation || observation.schemaVersion !== schemas.observation || observation.productDomain !== productDomain ||
        observation.ownerDomain !== ownerDomain || observation.lane !== LANE || !text(observation.providerEmailId) ||
        !text(observation.observationId) || !text(observation.actionId) ||
        typeof observation.observedAt !== 'number' || !Number.isFinite(observation.observedAt) ||
        !resolved(observation.lastEvent)) return { ok: false, reason: 'resolved-' + productDomain + '-observation-required' };
    if (!(await store.get(keys.learningCause(observation.actionId)))) return { ok: false, reason: productDomain + '-action-cause-missing' };
    var authoritativeObservation = await store.get(keys.observation(observation.providerEmailId));
    if (!authoritativeObservation || authoritativeObservation.observationId !== observation.observationId ||
        authoritativeObservation.actionId !== observation.actionId) {
      return { ok: false, reason: productDomain + '-subscriber-observation-superseded' };
    }
    var lockToken = { observationId: observation.observationId, nonce: crypto.randomBytes(16).toString('hex') };
    if (!(await store.setIfAbsent(keys.learningLock, lockToken, 120))) {
      return { ok: false, reason: productDomain + '-subscriber-learning-update-in-progress' };
    }
    try {
      var state = await loadLearning(store);
      var retained = retainedObservationRecords(state, observation.observedAt);
      if (retained.some(function (row) { return row.observationId === observation.observationId; })) {
        return { ok: true, duplicate: true, observationId: observation.observationId };
      }
      var signal = {
        schemaVersion: 'product-domain-external-learning/1.0', signalId: 'els_' + observation.observationId,
        eventId: observation.observationId, actionId: observation.actionId, ownerDomain: ownerDomain,
        productDomain: productDomain, lane: LANE, eventType: 'OUTCOME_SUBSCRIBER_' + observation.lastEvent.toUpperCase(),
        observedAt: observation.observedAt, outcome: observation.lastEvent, normalizedCredit: credit(observation.lastEvent),
        sourceKind: 'independent-action-outcome', sourceIdentity: { kind: 'resend-read-api-mail-server-event', value: observation.providerEmailId }
      };
      state.signals.push(signal); state.signals = state.signals.slice(-200);
      retained.push({ observationId: observation.observationId,
        providerEmailId: observation.providerEmailId, actionId: observation.actionId,
        retainUntil: Math.max(Number(observation.followUpUntil || 0), observation.observedAt + LEARNING_DEDUPE_RETENTION_MS) });
      state.processedObservations = retained;
      state.processedObservationIds = retained.map(function (row) { return row.observationId; });
      state.resolvedCount++; state.latestSignalId = signal.signalId; state.lastOutcomeAt = observation.observedAt;
      if (!(await store.setIfLockAndValue(keys.learningLock, lockToken,
        keys.observation(observation.providerEmailId), authoritativeObservation, keys.learning, state))) {
        throw new Error(productDomain + ' subscriber learning or observation authority expired before commit');
      }
      var restored = await store.get(keys.learning);
      if (!restored || restored.productDomain !== productDomain ||
          restored.processedObservationIds.indexOf(observation.observationId) < 0 ||
          !restored.signals.some(function (row) { return row && row.signalId === signal.signalId; })) {
        throw new Error(productDomain + ' subscriber learning readback invalid');
      }
      return { ok: true, duplicate: false, signal: signal, resolvedCount: restored.resolvedCount };
    } finally {
      await store.deleteIfValue(keys.learningLock, lockToken);
    }
  }
  async function readForBrain(store) {
    var state = await loadLearning(store), signal = state.signals.length ? state.signals[state.signals.length - 1] : null;
    var identities = {};
    state.signals.forEach(function (row) { if (row && row.sourceIdentity) identities[row.sourceIdentity.kind + ':' + row.sourceIdentity.value] = true; });
    var distinct = Object.keys(identities).length;
    return { schemaVersion: 'product-domain-external-learning/1.0', domain: ownerDomain, productDomain: productDomain,
      status: signal ? 'ELIGIBLE' : 'ABSTAINED', reason: signal ? null : 'domain-has-no-graded-subscriber-outcome',
      resolvedCount: state.resolvedCount, learningGate: { ready: state.resolvedCount >= 5 && distinct >= 2,
        minimumResolved: 5, distinctSources: distinct, minimumDistinctSources: 2 }, signal: signal };
  }

  function findItem(command, actionId) { return command && (command.items || []).find(function (row) { return row.actionId === actionId; }); }
  async function recover(input) {
    input = input || {};
    var store = input.store, command = input.command, observation = input.observation, trigger = input.trigger || {};
    var item = findItem(command, input.actionId || observation && observation.actionId);
    var sourceSeparated = !!(item && observation && observation.schemaVersion === schemas.observation &&
      observation.productDomain === productDomain && observation.actionId === item.actionId && NEGATIVE[observation.lastEvent]);
    var policyTrigger = trigger.type === 'subscriber-policy' && text(trigger.id);
    if (!command || command.schemaVersion !== schemas.command || command.productDomain !== productDomain || !item ||
        item.status !== 'ACCEPTED' || (!sourceSeparated && !policyTrigger)) return { ok: false, status: 'REFUSED', reason: 'accepted-action-and-negative-outcome-or-policy-trigger-required', liveMoney: false };
    if (policyTrigger && String((input.env || process.env)[envStem + '_SUBSCRIBER_RECOVERY_ENABLED'] || '') !== '1') return { ok: true, status: 'HELD', reason: productDomain + '-subscriber-policy-recovery-switch-closed', liveMoney: false };
    var now = Number(input.now) || Date.now();
    var recoveryId = short + 'sr_' + hash({ actionId: item.actionId, observation: observation && observation.observationId || null,
      trigger: { type: trigger.type, id: trigger.id }, domain: productDomain }).slice(0, 24);
    var existing = await store.get(keys.recovery(recoveryId));
    if (existing && existing.status === 'FUTURE_DELIVERY_SUPPRESSED') return existing;
    if (existing && (existing.schemaVersion !== schemas.recovery || existing.productDomain !== productDomain ||
        existing.actionId !== item.actionId || existing.status !== 'SUPPRESSING')) {
      throw new Error(productDomain + ' subscriber existing recovery invalid');
    }
    var recovery = existing || {
      schemaVersion: schemas.recovery, recoveryId: recoveryId, status: 'SUPPRESSING', productDomain: productDomain,
      ownerDomain: ownerDomain, lane: LANE, commandId: command.commandId, actionId: item.actionId,
      emailHash: item.emailHash, observationId: observation && observation.observationId || null,
      trigger: { type: trigger.type || 'negative-delivery-outcome', id: trigger.id || observation.observationId },
      commandedAt: now, irreversiblePriorEmail: true, correctiveEmailSent: false, liveMoney: false
    };
    if (!existing && !(await store.setIfAbsent(keys.recovery(recoveryId), recovery))) {
      recovery = await store.get(keys.recovery(recoveryId));
      if (!recovery || recovery.schemaVersion !== schemas.recovery || recovery.productDomain !== productDomain ||
          recovery.actionId !== item.actionId) throw new Error(productDomain + ' subscriber concurrent recovery invalid');
      if (recovery.status === 'FUTURE_DELIVERY_SUPPRESSED') return recovery;
      if (recovery.status !== 'SUPPRESSING') throw new Error(productDomain + ' subscriber concurrent recovery state invalid');
    }
    var suppression = { suppressed: true, recoveryId: recoveryId, actionId: item.actionId,
      reason: observation && observation.lastEvent || trigger.type, at: now };
    await store.set(keys.suppression(item.emailHash), suppression);
    var restoredSuppression = await store.get(keys.suppression(item.emailHash));
    if (!restoredSuppression || restoredSuppression.recoveryId !== recoveryId) throw new Error(productDomain + ' subscriber suppression readback invalid');
    recovery.status = 'FUTURE_DELIVERY_SUPPRESSED'; recovery.strictSuppressionReadback = true;
    recovery.residual = 'previously delivered email cannot be recalled'; recovery.completedAt = Date.now();
    await store.set(keys.recovery(recoveryId), recovery); var restored = await store.get(keys.recovery(recoveryId));
    if (!restored || restored.status !== recovery.status || restored.productDomain !== productDomain) throw new Error(productDomain + ' subscriber recovery readback invalid');
    await store.lpush(keys.recoveryLog, restored); await store.ltrim(keys.recoveryLog, 0, 999); return restored;
  }

  function taskId(eventId, kind) { return short + 'rf_' + hash({ eventId: eventId, kind: kind, domain: productDomain }).slice(0, 24); }
  async function persistTask(store, task) {
    await store.set(keys.fulfillment(task.taskId), task); var restored = await store.get(keys.fulfillment(task.taskId));
    if (!restored || restored.taskId !== task.taskId || restored.productDomain !== productDomain || restored.status !== task.status) throw new Error(productDomain + ' revenue fulfillment readback invalid');
    return restored;
  }
  async function persistTaskIfCurrent(store, expected, task) {
    if (!(await store.replaceIfValue(keys.fulfillment(task.taskId), expected, task))) {
      throw new Error(productDomain + ' revenue fulfillment task changed concurrently');
    }
    var restored = await store.get(keys.fulfillment(task.taskId));
    if (!restored || restored.taskId !== task.taskId || restored.productDomain !== productDomain ||
        restored.status !== task.status || restored.attemptToken !== task.attemptToken) {
      throw new Error(productDomain + ' revenue fulfillment conditional readback invalid');
    }
    return restored;
  }
  function minimizeTerminalTask(task) {
    if (!task || ['COMPLETED', 'AMBIGUOUS', 'FAILED', 'CANCELED'].indexOf(task.status) < 0) return task;
    var subscriber = task.subscriber || {}, message = task.message || {};
    task.retainedIdentity = {
      emailHash: subscriber.email ? hash(String(subscriber.email).toLowerCase()) : null,
      subscriptionIdHash: subscriber.subscriptionId ? hash(String(subscriber.subscriptionId)) : null,
      customerIdHash: subscriber.customerId ? hash(String(subscriber.customerId)) : null,
      subjectHash: message.subject ? hash(String(message.subject)) : null,
      contentHash: message.body ? hash(String(message.body)) : null
    };
    task.subscriber = { domain: productDomain, rung: subscriber.rung || null, activeAtDispatch: subscriber.active === true };
    delete task.message;
    task.dataMinimizedAt = Date.now();
    return task;
  }
  async function fulfill(input) {
    input = input || {}; var store = input.store || Store, eventId = text(input.eventId), kind = text(input.kind);
    if (!eventId || ['welcome', 'renewal'].indexOf(kind) < 0 || !input.message || !input.message.subject || !input.message.body) return { ok: false, status: 'REFUSED', reason: 'exact-' + productDomain + '-stripe-fulfillment-candidate-required', providerCalls: 0, liveMoney: false };
    var value = candidate(input.subscriber, { subject: input.message.subject, body: input.message.body, key: 'stripe:' + eventId + ':' + kind });
    if (!value) return { ok: false, status: 'REFUSED', reason: 'active-paid-' + productDomain + '-subscriber-required', providerCalls: 0, liveMoney: false };
    var now = Number(input.now) || Date.now(), decision = await decide(store, value, now, input.decisionDeps);
    if (decision.status !== 'RELEASED') return { ok: true, status: 'HELD', reason: decision.reason, blockers: decision.blockers || [], decisionReceiptId: decision.decisionReceiptId || null, actionId: decision.actionId || null, providerCalls: 0, liveMoney: false };
    var env = input.env || process.env, policy = SubscriberPolicy.resolve(env, envNames);
    var result = await execute({ store: store, specs: [{ candidate: value, decision: decision }], now: now,
      maxSends: input.maxSends != null ? input.maxSends : policy.maxSends,
      emailCostUsd: input.emailCostUsd != null ? input.emailCostUsd : policy.emailCostUsd,
      dailyBudgetUsd: input.dailyBudgetUsd != null ? input.dailyBudgetUsd : policy.dailyBudgetUsd,
      dailySendCap: input.dailySendCap != null ? input.dailySendCap : policy.dailySendCap,
      authorizationDeps: input.authorizationDeps, motorAuthorization: input.motorAuthorization,
      adapterGuard: input.adapterGuard,
      transport: input.transport || { send: function (email, subject, body, options) { return Crm.sendToLead(email, subject, body, options); } }
    });
    return Object.assign({ decisionReceiptId: decision.decisionReceiptId, actionId: decision.actionId, kind: kind }, result);
  }
  async function attemptTask(input) {
    input = input || {}; var store = input.store || Store, task = input.task;
    if (!task && input.taskId) task = await store.get(keys.fulfillment(input.taskId));
    if (!task || task.schemaVersion !== schemas.fulfillment || task.productDomain !== productDomain) return { ok: false, status: 'REFUSED', reason: productDomain + '-revenue-task-not-found', providerCalls: 0 };
    if (['COMPLETED', 'AMBIGUOUS', 'FAILED', 'CANCELED'].indexOf(task.status) >= 0) return { ok: task.status === 'COMPLETED', status: task.status, taskId: task.taskId, replayed: true, providerCalls: 0 };
    var attemptToken = { taskId: task.taskId, nonce: crypto.randomBytes(16).toString('hex') };
    if (!(await store.setIfAbsent(keys.fulfillmentLease(task.taskId), attemptToken, 600))) {
      return { ok: true, status: 'HELD', taskId: task.taskId, productDomain: productDomain,
        ownerDomain: ownerDomain, reason: productDomain + '-revenue-fulfillment-attempt-in-progress',
        blockers: ['same-task-attempt-in-progress'], providerCalls: 0, liveMoney: false };
    }
    try {
    var unclaimedTask = task;
    task = Object.assign({}, task, { attemptToken: attemptToken.nonce, attemptStartedAt: Date.now() });
    task = await persistTaskIfCurrent(store, unclaimedTask, task);
    var subscriptions = input.subscriptions || Subscriptions;
    var entitlementCatalog = await store.get('subs:v1');
    if (entitlementCatalog !== null && (typeof entitlementCatalog !== 'object' || Array.isArray(entitlementCatalog))) {
      return { ok: true, status: 'HELD', taskId: task.taskId, productDomain: productDomain,
        ownerDomain: ownerDomain, reason: productDomain + '-subscriber-entitlement-catalog-malformed',
        blockers: ['repair-durable-stripe-entitlement-catalog'], providerCalls: 0, liveMoney: false };
    }
    var normalizedEmail = Subscriptions.norm(task.subscriber && task.subscriber.email);
    var hasStoredEntitlement = !!(entitlementCatalog && Object.prototype.hasOwnProperty.call(entitlementCatalog, normalizedEmail));
    var storedEntitlement = hasStoredEntitlement ? entitlementCatalog[normalizedEmail] : null;
    function validEntitlement(value) {
      return !!(value && typeof value === 'object' && !Array.isArray(value) &&
        typeof value.active === 'boolean' && Subscriptions.validEmail(value.email) &&
        Subscriptions.norm(value.email) === normalizedEmail && typeof value.domain === 'string' && value.domain.trim() &&
        (value.subscriptionId == null || text(String(value.subscriptionId))) &&
        (value.customerId == null || text(String(value.customerId))));
    }
    if (hasStoredEntitlement && !validEntitlement(storedEntitlement)) {
      return { ok: true, status: 'HELD', taskId: task.taskId, productDomain: productDomain,
        ownerDomain: ownerDomain, reason: productDomain + '-subscriber-entitlement-entry-malformed',
        blockers: ['repair-durable-stripe-entitlement-entry'], providerCalls: 0, liveMoney: false };
    }
    var current = await subscriptions.getStrict(task.subscriber && task.subscriber.email, store);
    if ((current && !validEntitlement(current)) || hasStoredEntitlement !== !!current ||
        (current && hash(current) !== hash(storedEntitlement))) {
      return { ok: true, status: 'HELD', taskId: task.taskId, productDomain: productDomain,
        ownerDomain: ownerDomain, reason: productDomain + '-subscriber-entitlement-readback-inconsistent',
        blockers: ['retry-fresh-durable-stripe-entitlement-read'], providerCalls: 0, liveMoney: false };
    }
    var sameSubscription = !task.subscriber.subscriptionId || current && current.subscriptionId === task.subscriber.subscriptionId;
    var sameCustomer = !task.subscriber.customerId || current && current.customerId === task.subscriber.customerId;
    if (!current || current.active !== true || String(current.domain || '').toLowerCase() !== productDomain ||
        !sameSubscription || !sameCustomer) {
      var canceledExpected = task;
      task = Object.assign({}, task, { status: 'CANCELED',
        lastReason: productDomain + '-subscriber-entitlement-no-longer-active',
        lastBlockers: ['fresh-stripe-entitlement-required'], canceledAt: Date.now() });
      task = minimizeTerminalTask(task);
      await persistTaskIfCurrent(store, canceledExpected, task);
      return { ok: false, status: 'CANCELED', taskId: task.taskId, productDomain: productDomain,
        ownerDomain: ownerDomain, reason: task.lastReason, blockers: task.lastBlockers, providerCalls: 0, liveMoney: false };
    }
    var attemptExpected = task;
    task = Object.assign({}, task, { subscriber: current,
      attempts: Number(task.attempts || 0) + 1, lastAttemptAt: Date.now() });
    task = await persistTaskIfCurrent(store, attemptExpected, task);
    var result = await fulfill(Object.assign({}, input, { store: store, subscriber: task.subscriber,
      message: task.message, eventId: task.eventId, kind: task.kind }));
    var finalExpected = task; task = Object.assign({}, task);
    task.lastDecisionReceiptId = result.decisionReceiptId || null; task.lastActionId = result.actionId || null;
    task.lastReason = result.reason || null; task.lastBlockers = result.blockers || [];
    var taskSuppression = await readSuppression(store, hash(Subscriptions.norm(task.subscriber && task.subscriber.email)));
    task.status = result.accepted > 0 ? 'COMPLETED'
      : taskSuppression && taskSuppression.suppressed === true ? 'CANCELED'
      : result.status === 'PARTIAL_AMBIGUOUS' ? 'AMBIGUOUS'
      : result.status === 'FAILED' ? 'FAILED' : 'HELD';
    if (task.status === 'CANCELED') {
      task.lastReason = productDomain + '-subscriber-permanently-suppressed';
      task.lastBlockers = ['durable-recipient-suppression']; task.canceledAt = Date.now();
    }
    task.providerEmailId = result.items && result.items[0] && result.items[0].providerEmailId || null;
    task.completedAt = task.status === 'COMPLETED' ? Date.now() : null;
    task = minimizeTerminalTask(task); task = await persistTaskIfCurrent(store, finalExpected, task);
    return { ok: task.status === 'COMPLETED', status: task.status, taskId: task.taskId,
      productDomain: productDomain, ownerDomain: ownerDomain, decisionReceiptId: task.lastDecisionReceiptId,
      actionId: task.lastActionId, reason: task.lastReason, blockers: task.lastBlockers,
      providerEmailId: task.providerEmailId, providerCalls: result.providerCalls || 0, liveMoney: false };
    } finally {
      await store.deleteIfValue(keys.fulfillmentLease(task.taskId), attemptToken);
    }
  }
  async function enqueueAndAttempt(input) {
    input = input || {}; var store = input.store || Store, eventId = text(input.eventId), kind = text(input.kind);
    if (!eventId || ['welcome', 'renewal'].indexOf(kind) < 0 || !input.subscriber ||
        String(input.subscriber.domain || '').toLowerCase() !== productDomain || !input.message) return { ok: false, status: 'REFUSED', reason: 'exact-' + productDomain + '-stripe-fulfillment-task-required', providerCalls: 0 };
    store.assertDurable(); var id = taskId(eventId, kind);
    var task = { schemaVersion: schemas.fulfillment, taskId: id, productDomain: productDomain, ownerDomain: ownerDomain,
      eventId: eventId, kind: kind, subscriber: input.subscriber, message: input.message,
      status: 'PENDING', attempts: 0, createdAt: Date.now(), liveMoney: false };
    var created = await store.setIfAbsent(keys.fulfillment(id), task); task = await store.get(keys.fulfillment(id));
    if (!task || task.schemaVersion !== schemas.fulfillment || task.productDomain !== productDomain || task.eventId !== eventId || task.kind !== kind) throw new Error(productDomain + ' revenue task creation readback invalid');
    if (['PENDING', 'HELD'].indexOf(task.status) >= 0) {
      await store.ensureListMember(keys.fulfillmentPending, { taskId: id, productDomain: productDomain, enqueuedAt: task.createdAt });
    }
    return attemptTask(Object.assign({}, input, { task: task, store: store }));
  }
  async function retryRecent(input) {
    input = input || {}; var store = input.store || Store, results = [], seen = {};
    for (var i = 0; i < 100; i++) {
      var ref = await store.lmove(keys.fulfillmentPending, keys.fulfillmentPending, 'RIGHT', 'LEFT');
      if (!ref) break;
      var id = ref && ref.taskId;
      if (!id) { await store.lrem(keys.fulfillmentPending, 1, ref); continue; }
      if (seen[id]) break;
      seen[id] = true;
      var task = await store.get(keys.fulfillment(id));
      if (!task || task.productDomain !== productDomain || ['PENDING', 'HELD'].indexOf(task.status) < 0) {
        await store.lrem(keys.fulfillmentPending, 1, ref); continue;
      }
      var result = await attemptTask(Object.assign({}, input, { store: store, task: task }));
      results.push(result);
      if (result.status !== 'HELD') await store.lrem(keys.fulfillmentPending, 1, ref);
    }
    return results;
  }

  return Object.freeze({
    config: Object.freeze({ productDomain: productDomain, ownerDomain: ownerDomain, lane: LANE,
      valveId: valveId, envNames: envNames, schemas: schemas, keys: keys }),
    decision: Object.freeze({ candidate: candidate, validateCandidate: validateCandidate,
      validCognition: validCognition, decide: decide, validateReceipt: validateDecision }),
    authorization: Object.freeze({ authorize: authorize, verifyCapabilityPair: verifyCapabilityPair,
      motorReceipt: motorReceipt }),
    executor: Object.freeze({ SCHEMA: schemas.command, HARD_MAX_SENDS: HARD_MAX_SENDS,
      execute: execute, commandKey: keys.command, actionKey: keys.action, motorClaimKey: keys.motorClaim,
      LOG_KEY: keys.commandLog, suppressionKey: keys.suppression }),
    observer: Object.freeze({ SCHEMA: schemas.observation, LOG_KEY: keys.observationLog,
      PENDING_KEY: keys.observationPending, TERMINAL: TERMINAL, key: keys.observation,
      observe: observe, observeRecent: observeRecent, observeNext: observeNext,
      observePending: observePending, acknowledge: acknowledgeObservation,
      releaseLease: releaseObservationLease, reconcileLegacyPending: reconcileLegacyObservationPending,
      isResolved: resolved, isFinal: finalObservation, depth: observationDepth }),
    learning: Object.freeze({ SCHEMA: schemas.learning, STATE_KEY: keys.learning, recordCommand: recordCommand,
      recordObservation: recordObservation, readForBrain: readForBrain }),
    recovery: Object.freeze({ SCHEMA: schemas.recovery, LOG_KEY: keys.recoveryLog,
      NEGATIVE: NEGATIVE, key: keys.recovery, recover: recover }),
    fulfillment: Object.freeze({ SCHEMA: schemas.fulfillment, PENDING_KEY: keys.fulfillmentPending,
      key: keys.fulfillment, taskId: taskId, fulfill: fulfill, enqueueAndAttempt: enqueueAndAttempt,
      attemptTask: attemptTask, retryRecent: retryRecent })
  });
}

module.exports = {
  LANE: LANE,
  MAX_COGNITION_AGE_MS: MAX_COGNITION_AGE_MS,
  MAX_DECISION_AGE_MS: MAX_DECISION_AGE_MS,
  MAX_CAPABILITY_AGE_MS: MAX_CAPABILITY_AGE_MS,
  HARD_MAX_SENDS: HARD_MAX_SENDS,
  POSITIVE_FOLLOW_UP_MS: POSITIVE_FOLLOW_UP_MS,
  POSITIVE_POLL_MS: POSITIVE_POLL_MS,
  ACTION_CLAIM_STALE_MS: ACTION_CLAIM_STALE_MS,
  create: create
};
