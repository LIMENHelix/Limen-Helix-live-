'use strict';
var assert = require('node:assert/strict');
var Lanes = require('../lib/soft-domain-subscriber-lanes.js');
var StripeWebhook = require('../handlers/stripe-webhook.js');
var SubscriberDigest = require('../handlers/subscriber-digest.js');
var Valves = require('../lib/civilization-valve-registry.js');
var MotorCapability = require('../lib/product-domain-motor-capability.js');

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function Store() { this.values = new Map(); this.lists = new Map(); }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) {
  if (this.failGetKeyOnce === key) { this.failGetKeyOnce = null; throw new Error('simulated durable read failure'); }
  return this.values.has(key) ? clone(this.values.get(key)) : null;
};
Store.prototype.set = async function (key, value) {
  if (this.failDispatchClaimOnce && key.indexOf(':action:') >= 0 && value && value.status === 'DISPATCHING') {
    this.failDispatchClaimOnce = false; throw new Error('simulated dispatch claim persistence failure');
  }
  this.values.set(key, clone(value)); return true;
};
Store.prototype.setIfAbsent = async function (key, value) {
  if (this.failLearningCauseOnce && key.indexOf(':learning-cause:') >= 0) {
    this.failLearningCauseOnce = false; throw new Error('simulated learning-cause persistence failure');
  }
  if (this.values.has(key)) return false;
  this.values.set(key, clone(value)); return true;
};
Store.prototype.del = async function (key) { return this.values.delete(key) ? 1 : 0; };
Store.prototype.deleteIfValue = async function (key, value) {
  if (!this.values.has(key) || JSON.stringify(this.values.get(key)) !== JSON.stringify(value)) return 0;
  this.values.delete(key); return 1;
};
Store.prototype.setIfLockOwned = async function (lockKey, lockValue, key, value) {
  if (!this.values.has(lockKey) || JSON.stringify(this.values.get(lockKey)) !== JSON.stringify(lockValue)) return false;
  this.values.set(key, clone(value)); return true;
};
Store.prototype.replaceIfValue = async function (key, expectedValue, value) {
  if (this.failDispatchClaimOnce && key.indexOf(':action:') >= 0 && value && value.status === 'DISPATCHING') {
    this.failDispatchClaimOnce = false; throw new Error('simulated dispatch claim persistence failure');
  }
  if (!this.values.has(key) || JSON.stringify(this.values.get(key)) !== JSON.stringify(expectedValue)) return false;
  this.values.set(key, clone(value)); return true;
};
Store.prototype.setIfLockAndValue = async function (lockKey, lockValue, compareKey, compareValue, key, value) {
  if (!this.values.has(lockKey) || JSON.stringify(this.values.get(lockKey)) !== JSON.stringify(lockValue) ||
      !this.values.has(compareKey) || JSON.stringify(this.values.get(compareKey)) !== JSON.stringify(compareValue)) return false;
  this.values.set(key, clone(value)); return true;
};
Store.prototype.ensureListMember = async function (key, value) {
  await this.lrem(key, 0, value); return this.lpush(key, value);
};
Store.prototype.lpush = async function (key, value) {
  var rows = this.lists.get(key) || []; rows.unshift(clone(value)); this.lists.set(key, rows); return rows.length;
};
Store.prototype.ltrim = async function (key, start, end) {
  this.lists.set(key, (this.lists.get(key) || []).slice(start, end + 1)); return true;
};
Store.prototype.lrange = async function (key, start, end) {
  var rows = this.lists.get(key) || [];
  var from = start < 0 ? Math.max(rows.length + start, 0) : start;
  var through = end < 0 ? rows.length + end : end;
  return clone(rows.slice(from, through + 1));
};
Store.prototype.lrem = async function (key, count, value) {
  var rows = this.lists.get(key) || [], target = JSON.stringify(value), removed = 0, next = [];
  rows.forEach(function (row) {
    if ((count === 0 || removed < count) && JSON.stringify(row) === target) removed++;
    else next.push(row);
  });
  this.lists.set(key, next); return removed;
};
Store.prototype.lmove = async function (source, destination, whereFrom, whereTo) {
  var sourceRows = this.lists.get(source) || [];
  if (!sourceRows.length) return null;
  var value = whereFrom === 'RIGHT' ? sourceRows.pop() : sourceRows.shift();
  var destinationRows = source === destination ? sourceRows : (this.lists.get(destination) || []);
  if (whereTo === 'RIGHT') destinationRows.push(value); else destinationRows.unshift(value);
  this.lists.set(source, sourceRows); this.lists.set(destination, destinationRows);
  return clone(value);
};
Store.prototype.llen = async function (key) { return (this.lists.get(key) || []).length; };

function cognition(lane, now) {
  return { ts: now, c: {
    domain: lane.config.ownerDomain,
    immune: { immuneState: 'clear' },
    awareness: { humanReviewRequired: false },
    brainOrgans: {
      autonomousInternalEmission: { holdReason: null },
      resourceMetabolism: { state: 'AVAILABLE', gates: { mayRunInternalCycle: true } }
    },
    serverPacket: {
      schemaVersion: 'civilization-domain-packet/1.0',
      domainId: lane.config.productDomain,
      packetId: lane.config.productDomain + '-packet-' + now,
      generatedAt: new Date(now).toISOString(),
      sourceIdentity: { producer: 'brain-cognition-refresh/1' },
      truth: { feedHealth: { live: 3 } }
    }
  } };
}

function subscriber(domain) {
  return { email: domain + '@example.test', domain: domain, active: true,
    rung: 'p2', subscriptionId: 'sub_' + domain, customerId: 'cus_' + domain };
}
async function putSubscriber(store, value) {
  var catalog = await store.get('subs:v1') || {};
  catalog[value.email.toLowerCase()] = value;
  await store.set('subs:v1', catalog);
}
function digest(domain, suffix) {
  return { subject: domain + ' current brief ' + suffix, body: 'Source-grounded ' + domain + ' detail ' + suffix,
    key: domain + ':' + suffix };
}
function openEnv(lane) {
  var env = {};
  env[lane.config.envNames.enabled] = '1';
  env[lane.config.envNames.observerEnabled] = '1';
  env[lane.config.envNames.maxSends] = '1';
  env[lane.config.envNames.emailCostUsd] = '0.001';
  env[lane.config.envNames.dailyBudgetUsd] = '0.01';
  env[lane.config.envNames.dailySendCap] = '2';
  return env;
}
async function commission(store, lane, now) {
  await store.set(lane.config.keys.executorCapability, {
    schemaVersion: MotorCapability.SCHEMA,
    kind: MotorCapability.EXECUTOR,
    status: 'VERIFIED',
    capabilityId: lane.config.productDomain + '-executor-capability-' + now,
    productDomain: lane.config.productDomain,
    ownerDomain: lane.config.ownerDomain,
    lane: lane.config.lane,
    environment: 'production',
    motorContractId: lane.authorization.motorReceipt.contractId,
    contractId: lane.config.schemas.command,
    adapterId: 'resend-send',
    verifierId: lane.config.productDomain + '-owned-destination-commissioner',
    evidenceReceiptId: lane.config.productDomain + '-send-evidence-' + now,
    verifiedAt: now - 1000,
    expiresAt: now + 60 * 60 * 1000,
    verificationEffectExecuted: true,
    commissioningOnly: true,
    irreversibleEffectDeclared: true,
    liveMoney: false,
    verificationSpendUsd: 0.001,
    ownedDestinationVerified: true,
    recipientConsentVerified: true,
    permanentOneShotSlotVerified: true,
    businessStateTransitionSuppressed: true,
    futureSuppressionRecoveryVerified: true,
    authorizationReceiptId: lane.config.productDomain + '-commission-auth-' + now,
    suppressionReceiptId: lane.config.productDomain + '-commission-suppression-' + now
  });
  await store.set(lane.config.keys.observerCapability, {
    schemaVersion: MotorCapability.SCHEMA,
    kind: MotorCapability.OBSERVER,
    status: 'VERIFIED',
    capabilityId: lane.config.productDomain + '-observer-capability-' + now,
    productDomain: lane.config.productDomain,
    ownerDomain: lane.config.ownerDomain,
    lane: lane.config.lane,
    environment: 'production',
    motorContractId: lane.authorization.motorReceipt.contractId,
    contractId: lane.config.schemas.observation,
    adapterId: 'resend-read',
    independentOfAdapterId: 'resend-send',
    verifierId: lane.config.productDomain + '-mail-event-verifier',
    evidenceReceiptId: lane.config.productDomain + '-observer-evidence-' + now,
    independentSourceVerified: true,
    verifiedAt: now - 1000,
    expiresAt: now + 60 * 60 * 1000
  });
}

(async function () {
  var domains = ['culture', 'education', 'communication', 'medicine'];
  assert.deepEqual(Lanes.DOMAINS, domains);

  domains.forEach(function (domain) {
    var lane = Lanes.get(domain);
    assert(lane, domain + ' lane missing');
    assert.equal(lane.config.productDomain, domain);
    assert.equal(StripeWebhook.fulfillmentFor(domain), lane.fulfillment);
    assert.equal(SubscriberDigest.motorFor(domain).executor, lane.executor);
    assert.equal(Valves.forRoute(domain + '-revenue-fulfillment'), domain + ':subscriber-email');
  });
  assert.equal(StripeWebhook.fulfillmentFor('law'), null, 'unsupported product may not inherit Religion fulfillment');
  assert.equal(SubscriberDigest.motorFor('law'), null, 'unsupported product may not inherit Religion motor');
  assert.notEqual(StripeWebhook.fulfillmentFor('culture'), StripeWebhook.fulfillmentFor('religion'));

  var now = Date.now(), culture = Lanes.get('culture'), education = Lanes.get('education');
  var store = new Store(), cultureSubscriber = subscriber('culture');
  await putSubscriber(store, cultureSubscriber);
  var cultureCandidate = culture.decision.candidate(cultureSubscriber, digest('culture', 'a'));
  assert(cultureCandidate);
  assert.equal(culture.decision.candidate(subscriber('education'), digest('culture', 'x')), null,
    'Culture must refuse another domain subscriber');

  var decision = await culture.decision.decide(store, cultureCandidate, now, { cognition: cognition(culture, now) });
  assert.equal(decision.status, 'RELEASED');
  var calls = 0;
  var held = await culture.executor.execute({
    store: store, specs: [{ candidate: cultureCandidate, decision: decision }], now: now,
    maxSends: 1, emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailySendCap: 2,
    authorizationDeps: { env: openEnv(culture), cognition: cognition(culture, now) },
    adapterGuard: { checkpoint: async function () { return { allowed: true }; } },
    transport: { send: async function () { calls++; return { ok: true, id: 'email-should-not-run' }; } }
  });
  assert.equal(held.status, 'HELD');
  assert.equal(held.reason, 'culture-subscriber-production-capability-missing-or-stale');
  assert.equal(calls, 0, 'missing durable capability must hold before provider');

  await commission(store, culture, now);
  var zeroEffectCapability = await store.get(culture.config.keys.executorCapability);
  zeroEffectCapability.verificationEffectExecuted = false;
  zeroEffectCapability.rollbackVerified = true;
  zeroEffectCapability.verificationSpendUsd = 0;
  await store.set(culture.config.keys.executorCapability, zeroEffectCapability);
  var zeroEffectPair = await culture.authorization.verifyCapabilityPair(store, now);
  assert.equal(zeroEffectPair.ok, false);
  assert.equal(zeroEffectPair.reason, 'culture-subscriber-executed-effect-proof-required');
  await commission(store, culture, now);
  var executed = await culture.executor.execute({
    store: store, specs: [{ candidate: cultureCandidate, decision: decision }], now: now,
    maxSends: 1, emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailySendCap: 2,
    authorizationDeps: { env: openEnv(culture), cognition: cognition(culture, now) },
    adapterGuard: { checkpoint: async function (_store, valveId) { assert.equal(valveId, 'culture:subscriber-email'); return { allowed: true }; } },
    transport: { send: async function () { calls++; return { ok: true, id: 're_culture_1', providerCalled: true }; } }
  });
  assert.equal(executed.status, 'RECEIPTS_PERSISTED');
  assert.equal(executed.accepted, 1);
  assert.equal(executed.providerCalls, 1);
  assert.equal(calls, 1);
  assert.equal(executed.items[0].subscriberDomain, 'culture');

  var fabricated = Object.assign({}, decision, { decisionReceiptId: 'fabricated-decision' });
  var fabricatedHeld = await culture.executor.execute({
    store: store, specs: [{ candidate: cultureCandidate, decision: fabricated }], now: now,
    maxSends: 1, emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailySendCap: 2,
    motorAuthorization: { authorize: async function () { throw new Error('must not authorize'); } },
    transport: { send: async function () { throw new Error('must not call'); } }
  });
  assert.equal(fabricatedHeld.reason, 'culture-subscriber-durable-decision-missing-or-invalid');

  var foreign = await education.executor.execute({
    store: store, specs: [{ candidate: cultureCandidate, decision: decision }], now: now,
    maxSends: 1, emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailySendCap: 2,
    authorizationDeps: { env: openEnv(education), cognition: cognition(education, now) },
    transport: { send: async function () { throw new Error('must not call'); } }
  });
  assert.equal(foreign.status, 'HELD');
  assert.equal(foreign.reason, 'education-subscriber-no-released-exact-decisions');

  var observedRows = await culture.observer.observePending(store, {
    apiKey: 'test-read-key',
    fetch: async function (url, options) {
      assert(url.endsWith('/re_culture_1'));
      assert.equal(options.method, 'GET');
      return { ok: true, status: 200, json: async function () {
        return { id: 're_culture_1', last_event: 'bounced', created_at: new Date(now).toISOString() };
      } };
    }
  });
  var observation = observedRows[0].observation;
  assert.equal((await store.lrange(culture.observer.PENDING_KEY, 0, -1)).length, 1,
    'terminal outcome remains pending until learning and recovery finish');
  assert.equal(observation.status, 'TERMINAL_OBSERVED');
  assert.equal(observation.productDomain, 'culture');
  assert.equal(observation.independentOfSendResponse, true);

  var learned = await culture.learning.recordObservation(store, observation);
  assert.equal(learned.ok, true);
  assert.equal(learned.signal.productDomain, 'culture');
  var refusedLearning = await education.learning.recordObservation(store, observation);
  assert.equal(refusedLearning.ok, false);

  var recovery = await culture.recovery.recover({ store: store, command: executed,
    actionId: executed.items[0].actionId, observation: observation, now: now + 1 });
  assert.equal(recovery.status, 'FUTURE_DELIVERY_SUPPRESSED');
  assert.equal(await culture.observer.acknowledge(store, observedRows[0].pendingRef), true);
  assert.equal(await culture.observer.releaseLease(store, observedRows[0].pendingRef, observedRows[0].leaseToken), true);
  assert.equal((await store.lrange(culture.observer.PENDING_KEY, 0, -1)).length, 0);
  var suppression = await store.get(culture.executor.suppressionKey(executed.items[0].emailHash));
  assert.equal(suppression.suppressed, true);
  assert.equal(await store.get(education.executor.suppressionKey(executed.items[0].emailHash)), null,
    'Culture recovery may not mutate Education suppression');
  var partialRecovery = Object.assign({}, recovery, { status: 'SUPPRESSING', completedAt: null });
  await store.set(culture.recovery.key(recovery.recoveryId), partialRecovery);
  await store.del(culture.executor.suppressionKey(executed.items[0].emailHash));
  var resumedRecovery = await culture.recovery.recover({ store: store, command: executed,
    actionId: executed.items[0].actionId, observation: observation, now: now + 4 });
  assert.equal(resumedRecovery.status, 'FUTURE_DELIVERY_SUPPRESSED');
  assert.equal((await store.get(culture.executor.suppressionKey(executed.items[0].emailHash))).suppressed, true);
  assert.equal(culture.observer.isResolved('opened'), true);
  assert.equal(culture.observer.isResolved('clicked'), true);

  var alternateCultureSubscriber = Object.assign(subscriber('culture'), { email: 'culture-two@example.test',
    subscriptionId: 'sub_culture_two', customerId: 'cus_culture_two' });
  await putSubscriber(store, alternateCultureSubscriber);
  var inhibitedCandidate = culture.decision.candidate(alternateCultureSubscriber, digest('culture', 'inhibited'));
  var inhibitedDecision = await culture.decision.decide(store, inhibitedCandidate, now + 1, { cognition: cognition(culture, now + 1) });
  var inhibitedError = new Error('valve closed'); inhibitedError.code = 'CIVILIZATION_ADAPTER_INHIBITED';
  var inhibited = await culture.executor.execute({
    store: store, specs: [{ candidate: inhibitedCandidate, decision: inhibitedDecision }], now: now + 1,
    maxSends: 1, emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailySendCap: 2,
    authorizationDeps: { env: openEnv(culture), cognition: cognition(culture, now + 1) },
    adapterGuard: { checkpoint: async function () { throw inhibitedError; } },
    transport: { send: async function () { throw new Error('provider must not run behind closed valve'); } }
  });
  assert.equal(inhibited.status, 'HELD_INHIBITED');
  assert.equal(inhibited.providerCalls, 0);
  var inhibitedClaim = await store.get(culture.executor.actionKey(inhibited.items[0].actionId));
  assert.equal(inhibitedClaim.status, 'HELD_INHIBITED');
  assert.equal(inhibitedClaim.providerCalled, false,
    'inhibited action claim must remain durably retryable without claiming a provider call');

  var lastMomentSubscriber = Object.assign(subscriber('culture'), { email: 'culture-suppressed@example.test',
    subscriptionId: 'sub_culture_suppressed', customerId: 'cus_culture_suppressed' });
  var lastMomentStore = new Store(); await commission(lastMomentStore, culture, now);
  await putSubscriber(lastMomentStore, lastMomentSubscriber);
  var lastMomentCandidate = culture.decision.candidate(lastMomentSubscriber, digest('culture', 'last-moment-suppression'));
  var lastMomentDecision = await culture.decision.decide(lastMomentStore, lastMomentCandidate, now + 2,
    { cognition: cognition(culture, now + 2) });
  var lastMomentCalls = 0;
  var lastMomentHeld = await culture.executor.execute({ store: lastMomentStore,
    specs: [{ candidate: lastMomentCandidate, decision: lastMomentDecision }], now: now + 2,
    maxSends: 1, emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailySendCap: 4,
    authorizationDeps: { env: openEnv(culture), cognition: cognition(culture, now + 2) },
    adapterGuard: { checkpoint: async function () {
      await lastMomentStore.set(culture.executor.suppressionKey(lastMomentCandidate.emailHash), {
        suppressed: true, reason: 'test-last-moment-suppression'
      });
      return { allowed: true };
    } },
    transport: { send: async function () { lastMomentCalls++; return { ok: true, id: 'must-not-send-suppressed' }; } }
  });
  assert.equal(lastMomentHeld.status, 'HELD_INHIBITED');
  assert.equal(lastMomentHeld.providerCalls, 0);
  assert.equal(lastMomentCalls, 0, 'suppression written at the adapter boundary must prevent provider dispatch');

  var preSendSubscriber = Object.assign(subscriber('culture'), { email: 'culture-three@example.test',
    subscriptionId: 'sub_culture_three', customerId: 'cus_culture_three' });
  await putSubscriber(store, preSendSubscriber);
  var preSendCandidate = culture.decision.candidate(preSendSubscriber, digest('culture', 'pre-send-retry'));
  var preSendDecision = await culture.decision.decide(store, preSendCandidate, now + 2, { cognition: cognition(culture, now + 2) });
  store.failLearningCauseOnce = true; var preSendCalls = 0;
  var preSendHeld = await culture.executor.execute({ store: store,
    specs: [{ candidate: preSendCandidate, decision: preSendDecision }], now: now + 2,
    maxSends: 1, emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailySendCap: 4,
    authorizationDeps: { env: openEnv(culture), cognition: cognition(culture, now + 2) },
    adapterGuard: { checkpoint: async function () { return { allowed: true }; } },
    transport: { send: async function () { preSendCalls++; return { ok: true, id: 'must-not-send-yet' }; } }
  });
  assert.equal(preSendHeld.status, 'HELD_PRE_SEND'); assert.equal(preSendHeld.providerCalls, 0);
  assert.equal(preSendCalls, 0);
  var retryDecision = await culture.decision.decide(store, preSendCandidate, now + 3, { cognition: cognition(culture, now + 3) });
  var preSendRetried = await culture.executor.execute({ store: store,
    specs: [{ candidate: preSendCandidate, decision: retryDecision }], now: now + 3,
    maxSends: 1, emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailySendCap: 4,
    authorizationDeps: { env: openEnv(culture), cognition: cognition(culture, now + 3) },
    adapterGuard: { checkpoint: async function () { return { allowed: true }; } },
    transport: { send: async function () { preSendCalls++; return { ok: true, id: 're_culture_retry', providerCalled: true }; } }
  });
  assert.equal(preSendRetried.status, 'RECEIPTS_PERSISTED'); assert.equal(preSendCalls, 1);

  var causeResumeSubscriber = Object.assign(subscriber('culture'), { email: 'culture-four@example.test',
    subscriptionId: 'sub_culture_four', customerId: 'cus_culture_four' });
  await putSubscriber(store, causeResumeSubscriber);
  var causeResumeCandidate = culture.decision.candidate(causeResumeSubscriber, digest('culture', 'cause-resume'));
  var causeResumeDecision = await culture.decision.decide(store, causeResumeCandidate, now + 5, { cognition: cognition(culture, now + 5) });
  store.failDispatchClaimOnce = true; var causeResumeCalls = 0;
  var causeResumeHeld = await culture.executor.execute({ store: store,
    specs: [{ candidate: causeResumeCandidate, decision: causeResumeDecision }], now: now + 5,
    maxSends: 1, emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailySendCap: 5,
    authorizationDeps: { env: openEnv(culture), cognition: cognition(culture, now + 5) },
    adapterGuard: { checkpoint: async function () { return { allowed: true }; } },
    transport: { send: async function () { causeResumeCalls++; return { ok: true, id: 'must-not-send-yet-2' }; } }
  });
  assert.equal(causeResumeHeld.status, 'HELD_PRE_SEND'); assert.equal(causeResumeCalls, 0);
  var causeRetryDecision = await culture.decision.decide(store, causeResumeCandidate, now + 6, { cognition: cognition(culture, now + 6) });
  var causeResumeSent = await culture.executor.execute({ store: store,
    specs: [{ candidate: causeResumeCandidate, decision: causeRetryDecision }], now: now + 6,
    maxSends: 1, emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailySendCap: 5,
    authorizationDeps: { env: openEnv(culture), cognition: cognition(culture, now + 6) },
    adapterGuard: { checkpoint: async function () { return { allowed: true }; } },
    transport: { send: async function () { causeResumeCalls++; return { ok: true, id: 're_culture_cause_resume', providerCalled: true }; } }
  });
  assert.equal(causeResumeSent.status, 'RECEIPTS_PERSISTED'); assert.equal(causeResumeCalls, 1);

  var concurrentSubscriber = Object.assign(subscriber('culture'), { email: 'culture-five@example.test',
    subscriptionId: 'sub_culture_five', customerId: 'cus_culture_five' });
  await putSubscriber(store, concurrentSubscriber);
  var concurrentCandidate = culture.decision.candidate(concurrentSubscriber, digest('culture', 'concurrent-claim'));
  var concurrentDecision = await culture.decision.decide(store, concurrentCandidate, now + 7, { cognition: cognition(culture, now + 7) });
  await store.set(culture.executor.actionKey(concurrentDecision.actionId), {
    schemaVersion: culture.executor.SCHEMA, productDomain: 'culture', actionId: concurrentDecision.actionId,
    commandId: 'active-other-command', status: 'PRE_SEND', providerCalled: false,
    claimToken: 'active-token', claimedAt: Date.now()
  });
  var concurrentCalls = 0;
  var concurrentHeld = await culture.executor.execute({ store: store,
    specs: [{ candidate: concurrentCandidate, decision: concurrentDecision }], now: now + 7,
    maxSends: 1, emailCostUsd: 0.001, dailyBudgetUsd: 0.02, dailySendCap: 20,
    authorizationDeps: { env: openEnv(culture), cognition: cognition(culture, now + 7) },
    adapterGuard: { checkpoint: async function () { return { allowed: true }; } },
    transport: { send: async function () { concurrentCalls++; return { ok: true, id: 'must-not-send-concurrently' }; } }
  });
  assert.equal(concurrentHeld.status, 'HELD_PRE_SEND'); assert.equal(concurrentCalls, 0);
  assert.equal((await store.get(culture.executor.actionKey(concurrentDecision.actionId))).claimToken, 'active-token');
  await store.set(culture.executor.actionKey(concurrentDecision.actionId), {
    schemaVersion: culture.executor.SCHEMA, productDomain: 'culture', actionId: concurrentDecision.actionId,
    commandId: 'abandoned-other-command', status: 'DISPATCHING', providerCalled: true,
    claimToken: 'abandoned-token', claimedAt: Date.now() - 11 * 60 * 1000,
    dispatchingAt: Date.now() - 11 * 60 * 1000
  });
  var abandoned = await culture.executor.execute({ store: store,
    specs: [{ candidate: concurrentCandidate, decision: concurrentDecision }], now: now + 8,
    maxSends: 1, emailCostUsd: 0.001, dailyBudgetUsd: 0.02, dailySendCap: 20,
    authorizationDeps: { env: openEnv(culture), cognition: cognition(culture, now + 8) },
    adapterGuard: { checkpoint: async function () { return { allowed: true }; } },
    transport: { send: async function () { concurrentCalls++; return { ok: true, id: 'must-not-resend-abandoned' }; } }
  });
  assert.equal(abandoned.status, 'PARTIAL_AMBIGUOUS'); assert.equal(concurrentCalls, 0);
  assert.equal((await store.get(culture.executor.actionKey(concurrentDecision.actionId))).status, 'AMBIGUOUS');

  var positiveFetches = 0, positiveItem = causeResumeSent.items[0];
  var delivered = await culture.observer.observe(store, causeResumeSent, positiveItem, {
    apiKey: 'test-read-key', now: now + 100,
    fetch: async function () { positiveFetches++; return { ok: true, status: 200, json: async function () {
      return { id: positiveItem.providerEmailId, last_event: 'delivered', created_at: new Date(now).toISOString() };
    } }; }
  });
  assert.equal(delivered.followUpComplete, false);
  assert.equal(culture.observer.isFinal(delivered), false,
    'delivery must remain observable during the bounded late-complaint window');
  var deferred = await culture.observer.observe(store, causeResumeSent, positiveItem, {
    apiKey: 'test-read-key', now: now + 60 * 60 * 1000,
    fetch: async function () { positiveFetches++; throw new Error('follow-up should be deferred'); }
  });
  assert.equal(deferred.status, 'OBSERVATION_DEFERRED'); assert.equal(positiveFetches, 1);
  var complained = await culture.observer.observe(store, causeResumeSent, positiveItem, {
    apiKey: 'test-read-key', now: now + 7 * 60 * 60 * 1000,
    fetch: async function () { positiveFetches++; return { ok: true, status: 200, json: async function () {
      return { id: positiveItem.providerEmailId, last_event: 'complained', created_at: new Date(now).toISOString() };
    } }; }
  });
  assert.equal(complained.lastEvent, 'complained'); assert.equal(culture.observer.isFinal(complained), true);
  var staleLearning = await culture.learning.recordObservation(store, delivered);
  assert.equal(staleLearning.ok, false);
  assert.equal(staleLearning.reason, 'culture-subscriber-observation-superseded');

  var rotationStore = new Store(), rotationCommand = {
    schemaVersion: culture.executor.SCHEMA, commandId: 'culture-rotation-command', productDomain: 'culture',
    items: [{ actionId: 'culture-rotation-action', status: 'ACCEPTED', providerEmailId: 're-rotation', emailHash: 'rotation-hash' }]
  };
  var rotationRef = { commandId: rotationCommand.commandId, actionId: 'culture-rotation-action' };
  await rotationStore.set(culture.executor.commandKey(rotationCommand.commandId), rotationCommand);
  await rotationStore.lpush(culture.observer.PENDING_KEY, rotationRef);
  var rotationSeen = {};
  var firstRotation = await culture.observer.observeNext(rotationStore, {
    apiKey: 'test-read-key', now: now,
    fetch: async function () { return { ok: true, status: 200, json: async function () {
      return { id: 're-rotation', last_event: 'delivered', created_at: new Date(now).toISOString() };
    } }; }
  }, rotationSeen);
  assert(firstRotation.observation);
  var revisitedRotation = await culture.observer.observeNext(rotationStore, { apiKey: 'test-read-key' }, rotationSeen);
  assert.equal(revisitedRotation.revisitedRef, true);
  assert.equal((await rotationStore.lrange(culture.observer.PENDING_KEY, 0, -1)).length, 1,
    'a concurrent/revisited physical ref may not be deleted as a presumed duplicate');
  await culture.observer.releaseLease(rotationStore, firstRotation.pendingRef, firstRotation.leaseToken);

  var concurrentStore = new Store(), observationA = {
    schemaVersion: culture.observer.SCHEMA, observationId: 'culture-concurrent-a', productDomain: 'culture',
    ownerDomain: 'culture', lane: 'subscriber-email', actionId: 'culture-concurrent-action-a', providerEmailId: 're-concurrent-a',
    lastEvent: 'delivered', observedAt: now + 10, liveMoney: false
  };
  var observationB = Object.assign({}, observationA, { observationId: 'culture-concurrent-b',
    actionId: 'culture-concurrent-action-b', providerEmailId: 're-concurrent-b', observedAt: now + 11 });
  await concurrentStore.set(culture.config.keys.learningCause(observationA.actionId), { actionId: observationA.actionId });
  await concurrentStore.set(culture.config.keys.learningCause(observationB.actionId), { actionId: observationB.actionId });
  await concurrentStore.set(culture.observer.key(observationA.providerEmailId), observationA);
  await concurrentStore.set(culture.observer.key(observationB.providerEmailId), observationB);
  var concurrent = await Promise.all([
    culture.learning.recordObservation(concurrentStore, observationA),
    culture.learning.recordObservation(concurrentStore, observationB)
  ]);
  assert.equal(concurrent.filter(function (row) { return row.ok; }).length, 1);
  var heldIndex = concurrent[0].ok ? 1 : 0;
  assert.match(concurrent[heldIndex].reason, /learning-update-in-progress/);
  var replayedLearning = await culture.learning.recordObservation(concurrentStore, heldIndex ? observationB : observationA);
  assert.equal(replayedLearning.ok, true);
  var concurrentState = await concurrentStore.get(culture.learning.STATE_KEY);
  assert.equal(concurrentState.resolvedCount, 2);
  assert.equal(concurrentState.processedObservationIds.includes(observationA.observationId), true);
  assert.equal(concurrentState.processedObservationIds.includes(observationB.observationId), true);

  var dedupeStore = new Store(), retainedObservation = Object.assign({}, observationA, {
    observationId: 'culture-retained-positive', actionId: 'culture-retained-action',
    providerEmailId: 're-retained-positive', observedAt: now, followUpUntil: now + 7 * 24 * 60 * 60 * 1000,
    followUpComplete: false, status: 'PENDING_OBSERVED', lastEvent: 'delivered'
  });
  var newObservation = Object.assign({}, observationA, {
    observationId: 'culture-new-positive', actionId: 'culture-new-action',
    providerEmailId: 're-new-positive', observedAt: now + 1, followUpUntil: now + 7 * 24 * 60 * 60 * 1000,
    followUpComplete: false, status: 'PENDING_OBSERVED', lastEvent: 'opened'
  });
  var legacyIds = [retainedObservation.observationId];
  for (var legacyIndex = 1; legacyIndex < 2000; legacyIndex++) legacyIds.push('legacy-observation-' + legacyIndex);
  await dedupeStore.set(culture.learning.STATE_KEY, { schemaVersion: culture.config.schemas.learning,
    domain: 'culture', productDomain: 'culture', lane: 'subscriber-email', resolvedCount: 2000,
    signals: [], processedObservationIds: legacyIds, lastOutcomeAt: now - 1 });
  await dedupeStore.set(culture.config.keys.learningCause(retainedObservation.actionId), { actionId: retainedObservation.actionId });
  await dedupeStore.set(culture.config.keys.learningCause(newObservation.actionId), { actionId: newObservation.actionId });
  await dedupeStore.set(culture.observer.key(retainedObservation.providerEmailId), retainedObservation);
  await dedupeStore.set(culture.observer.key(newObservation.providerEmailId), newObservation);
  var newLearned = await culture.learning.recordObservation(dedupeStore, newObservation);
  assert.equal(newLearned.ok, true); assert.equal(newLearned.duplicate, false);
  var retainedDuplicate = await culture.learning.recordObservation(dedupeStore, retainedObservation);
  assert.equal(retainedDuplicate.ok, true); assert.equal(retainedDuplicate.duplicate, true,
    'a positive observation must remain deduplicated throughout its seven-day follow-up window');
  assert.equal((await dedupeStore.get(culture.learning.STATE_KEY)).resolvedCount, 2001);

  var medicine = Lanes.get('medicine'), medicineStore = new Store(), medicineSubscriber = subscriber('medicine');
  await putSubscriber(medicineStore, medicineSubscriber);
  var medCandidate = medicine.decision.candidate(medicineSubscriber, digest('medicine', 'no-provider-id'));
  var medDecision = await medicine.decision.decide(medicineStore, medCandidate, now, { cognition: cognition(medicine, now) });
  await commission(medicineStore, medicine, now);
  var ambiguous = await medicine.executor.execute({
    store: medicineStore, specs: [{ candidate: medCandidate, decision: medDecision }], now: now,
    maxSends: 1, emailCostUsd: 0, dailyBudgetUsd: 0, dailySendCap: 1,
    authorizationDeps: { env: openEnv(medicine), cognition: cognition(medicine, now) },
    adapterGuard: { checkpoint: async function () { return { allowed: true }; } },
    transport: { send: async function () { return { ok: true, providerCalled: true }; } }
  });
  assert.equal(ambiguous.status, 'PARTIAL_AMBIGUOUS');
  assert.equal(ambiguous.accepted, 0, 'provider response without durable provider id is never fulfillment');

  var fulfillmentStore = new Store(), fulfillmentLane = Lanes.get('education');
  await commission(fulfillmentStore, fulfillmentLane, now);
  var educationSubscriber = subscriber('education');
  await fulfillmentStore.set('subs:v1', Object.fromEntries([[educationSubscriber.email, educationSubscriber]]));
  var task = await fulfillmentLane.fulfillment.enqueueAndAttempt({
    store: fulfillmentStore, eventId: 'evt-education-1', kind: 'welcome',
    subscriber: educationSubscriber, message: digest('education', 'welcome'), now: now,
    subscriptions: { getStrict: async function () { return educationSubscriber; } },
    decisionDeps: { cognition: cognition(fulfillmentLane, now) },
    authorizationDeps: { env: openEnv(fulfillmentLane), cognition: cognition(fulfillmentLane, now) },
    maxSends: 1, emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailySendCap: 1,
    adapterGuard: { checkpoint: async function () { return { allowed: true }; } },
    transport: { send: async function () { return { ok: true, id: 're_education_1', providerCalled: true }; } }
  });
  assert.equal(task.status, 'COMPLETED');
  var storedTask = await fulfillmentStore.get(fulfillmentLane.fulfillment.key(task.taskId));
  assert.equal(storedTask.message, undefined, 'terminal fulfillment may not retain message body');
  assert.equal(storedTask.subscriber.email, undefined, 'terminal fulfillment may not retain customer email');
  assert(storedTask.retainedIdentity.emailHash && storedTask.retainedIdentity.contentHash);

  var canceledStore = new Store(); await commission(canceledStore, fulfillmentLane, now);
  var canceledSubscriber = subscriber('education');
  await canceledStore.set('subs:v1', Object.fromEntries([[canceledSubscriber.email, canceledSubscriber]]));
  var heldTask = await fulfillmentLane.fulfillment.enqueueAndAttempt({
    store: canceledStore, eventId: 'evt-education-canceled', kind: 'welcome',
    subscriber: canceledSubscriber, message: digest('education', 'cancel-before-retry'), now: now,
    subscriptions: { getStrict: async function () { return canceledSubscriber; } },
    decisionDeps: { cognition: cognition(fulfillmentLane, now) },
    authorizationDeps: { env: {}, cognition: cognition(fulfillmentLane, now) }
  });
  assert.equal(heldTask.status, 'HELD');
  var inactiveSubscriber = Object.assign({}, canceledSubscriber, { active: false });
  await canceledStore.set('subs:v1', Object.fromEntries([[inactiveSubscriber.email, inactiveSubscriber]]));
  var retried = await fulfillmentLane.fulfillment.retryRecent({ store: canceledStore,
    subscriptions: { getStrict: async function () { return inactiveSubscriber; } } });
  assert.equal(retried[0].status, 'CANCELED');
  assert.equal(retried[0].providerCalls, 0);
  var canceled = await canceledStore.get(fulfillmentLane.fulfillment.key(heldTask.taskId));
  assert.equal(canceled.message, undefined);
  assert.equal(canceled.subscriber.email, undefined);

  var malformedStore = new Store(), malformedCalls = 0; await commission(malformedStore, fulfillmentLane, now);
  var malformedEmail = subscriber('education').email;
  await malformedStore.set('subs:v1', Object.fromEntries([[malformedEmail, {
    email: malformedEmail, domain: 'education', active: 'yes', subscriptionId: 'sub_education', customerId: 'cus_education'
  }]]));
  var malformedHeld = await fulfillmentLane.fulfillment.enqueueAndAttempt({
    store: malformedStore, eventId: 'evt-education-malformed-catalog', kind: 'welcome',
    subscriber: subscriber('education'), message: digest('education', 'malformed-catalog'), now: now,
    subscriptions: { getStrict: async function () { return { email: malformedEmail, domain: 'education', active: 'yes' }; } },
    transport: { send: async function () { malformedCalls++; return { ok: true, id: 'must-not-send' }; } }
  });
  assert.equal(malformedHeld.status, 'HELD');
  assert.equal(malformedHeld.reason, 'education-subscriber-entitlement-entry-malformed');
  assert.equal(malformedCalls, 0);
  var malformedTask = await malformedStore.get(fulfillmentLane.fulfillment.key(malformedHeld.taskId));
  assert(malformedTask.message && malformedTask.subscriber.email,
    'malformed entitlement storage must preserve paid work for repair and retry');

  var replayStore = new Store(); await commission(replayStore, fulfillmentLane, now);
  var replaySubscriber = subscriber('education');
  await replayStore.set('subs:v1', Object.fromEntries([[replaySubscriber.email, replaySubscriber]]));
  var replayInput = {
    store: replayStore, eventId: 'evt-education-reconcile-ref', kind: 'welcome',
    subscriber: replaySubscriber, message: digest('education', 'reconcile-ref'), now: now,
    subscriptions: { getStrict: async function () { return replaySubscriber; } },
    decisionDeps: { cognition: cognition(fulfillmentLane, now) },
    authorizationDeps: { env: {}, cognition: cognition(fulfillmentLane, now) }
  };
  var replayHeld = await fulfillmentLane.fulfillment.enqueueAndAttempt(replayInput);
  assert.equal(replayHeld.status, 'HELD');
  replayStore.lists.set(fulfillmentLane.config.keys.fulfillmentPending, []);
  await fulfillmentLane.fulfillment.enqueueAndAttempt(replayInput);
  await fulfillmentLane.fulfillment.enqueueAndAttempt(replayInput);
  var replayRefs = await replayStore.lrange(fulfillmentLane.config.keys.fulfillmentPending, 0, -1);
  assert.equal(replayRefs.length, 1, 'every nonterminal replay must restore exactly one pending reference');
  assert.equal(replayRefs[0].taskId, replayHeld.taskId);

  var concurrentTaskStore = new Store(); await commission(concurrentTaskStore, fulfillmentLane, now);
  var concurrentSubscriber = Object.assign(subscriber('education'), { email: 'education-concurrent@example.test',
    subscriptionId: 'sub_education_concurrent', customerId: 'cus_education_concurrent' });
  await concurrentTaskStore.set('subs:v1', Object.fromEntries([[concurrentSubscriber.email, concurrentSubscriber]]));
  var releaseProvider, providerEntered;
  var enteredProvider = new Promise(function (resolve) { providerEntered = resolve; });
  var heldProvider = new Promise(function (resolve) { releaseProvider = resolve; });
  var concurrentProviderCalls = 0;
  var concurrentTaskInput = {
    store: concurrentTaskStore, eventId: 'evt-education-concurrent-task', kind: 'welcome',
    subscriber: concurrentSubscriber, message: digest('education', 'concurrent-task'), now: now,
    subscriptions: { getStrict: async function () { return concurrentSubscriber; } },
    decisionDeps: { cognition: cognition(fulfillmentLane, now) },
    authorizationDeps: { env: openEnv(fulfillmentLane), cognition: cognition(fulfillmentLane, now) },
    maxSends: 1, emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailySendCap: 1,
    adapterGuard: { checkpoint: async function () { return { allowed: true }; } },
    transport: { send: async function () {
      concurrentProviderCalls++; providerEntered(); await heldProvider;
      return { ok: true, id: 're_education_concurrent', providerCalled: true };
    } }
  };
  var winningAttempt = fulfillmentLane.fulfillment.enqueueAndAttempt(concurrentTaskInput);
  await enteredProvider;
  var losingAttempt = await fulfillmentLane.fulfillment.enqueueAndAttempt(concurrentTaskInput);
  assert.equal(losingAttempt.status, 'HELD');
  assert.equal(losingAttempt.reason, 'education-revenue-fulfillment-attempt-in-progress');
  releaseProvider();
  var completedAttempt = await winningAttempt;
  assert.equal(completedAttempt.status, 'COMPLETED');
  assert.equal(concurrentProviderCalls, 1);
  var concurrentStoredTask = await concurrentTaskStore.get(fulfillmentLane.fulfillment.key(completedAttempt.taskId));
  assert.equal(concurrentStoredTask.status, 'COMPLETED');
  assert.equal(concurrentStoredTask.message, undefined,
    'a delayed concurrent attempt may not restore minimized terminal customer content');

  var legacyStore = new Store(); await commission(legacyStore, culture, now);
  var legacySubscriber = Object.assign(subscriber('culture'), { email: 'culture-legacy-suppressed@example.test',
    subscriptionId: 'sub_culture_legacy', customerId: 'cus_culture_legacy' });
  await putSubscriber(legacyStore, legacySubscriber);
  var legacyCandidate = culture.decision.candidate(legacySubscriber, digest('culture', 'legacy-suppression'));
  var legacyDecision = await culture.decision.decide(legacyStore, legacyCandidate, now,
    { cognition: cognition(culture, now) });
  await legacyStore.set(culture.config.keys.legacySuppression, Object.fromEntries([[legacyCandidate.emailHash, {
    suppressed: true, reason: 'legacy-complaint', at: now - 1000
  }]]));
  var legacyCalls = 0;
  var legacyHeld = await culture.executor.execute({ store: legacyStore,
    specs: [{ candidate: legacyCandidate, decision: legacyDecision }], now: now,
    maxSends: 1, emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailySendCap: 1,
    authorizationDeps: { env: openEnv(culture), cognition: cognition(culture, now) },
    transport: { send: async function () { legacyCalls++; return { ok: true, id: 'must-not-send-legacy' }; } }
  });
  assert.equal(legacyHeld.reason, 'culture-subscriber-all-candidates-suppressed');
  assert.equal(legacyCalls, 0);
  assert.equal((await legacyStore.get(culture.executor.suppressionKey(legacyCandidate.emailHash))).suppressed, true,
    'legacy suppression must be migrated before the new lookup can authorize delivery');

  var historicalStore = new Store(), historicalCommand = {
    schemaVersion: culture.config.schemas.command, commandId: 'culture-historical-command',
    productDomain: 'culture', ownerDomain: 'culture', status: 'RECEIPTS_PERSISTED', commandedAt: now - 10000,
    items: [{ actionId: 'culture-historical-action', status: 'ACCEPTED',
      providerEmailId: 're_culture_historical', emailHash: 'historical-email-hash' }]
  };
  await historicalStore.set(culture.executor.commandKey(historicalCommand.commandId), historicalCommand);
  await historicalStore.lpush(culture.executor.LOG_KEY, historicalCommand);
  var historicalMigration = await culture.observer.reconcileLegacyPending(historicalStore);
  assert.equal(historicalMigration.reconciledAcceptedActions, 1);
  var historicalRefs = await historicalStore.lrange(culture.observer.PENDING_KEY, 0, -1);
  assert.equal(historicalRefs.length, 1);
  assert.equal(historicalRefs[0].actionId, 'culture-historical-action');
  await culture.observer.reconcileLegacyPending(historicalStore);
  assert.equal((await historicalStore.lrange(culture.observer.PENDING_KEY, 0, -1)).length, 1,
    'completed legacy backfill may not duplicate provider observation work');

  var entitlementStore = new Store(); await commission(entitlementStore, culture, now);
  var entitlementSubscriber = Object.assign(subscriber('culture'), { email: 'culture-canceled-at-boundary@example.test',
    subscriptionId: 'sub_culture_boundary', customerId: 'cus_culture_boundary' });
  await putSubscriber(entitlementStore, entitlementSubscriber);
  var entitlementCandidate = culture.decision.candidate(entitlementSubscriber, digest('culture', 'entitlement-boundary'));
  var entitlementDecision = await culture.decision.decide(entitlementStore, entitlementCandidate, now,
    { cognition: cognition(culture, now) });
  var entitlementCalls = 0;
  var entitlementHeld = await culture.executor.execute({ store: entitlementStore,
    specs: [{ candidate: entitlementCandidate, decision: entitlementDecision }], now: now,
    maxSends: 1, emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailySendCap: 1,
    authorizationDeps: { env: openEnv(culture), cognition: cognition(culture, now) },
    adapterGuard: { checkpoint: async function () {
      await putSubscriber(entitlementStore, Object.assign({}, entitlementSubscriber, { active: false }));
      return { allowed: true };
    } },
    transport: { send: async function () { entitlementCalls++; return { ok: true, id: 'must-not-send-canceled' }; } }
  });
  assert.equal(entitlementHeld.status, 'HELD_PRE_SEND');
  assert.equal(entitlementHeld.providerCalls, 0);
  assert.equal(entitlementCalls, 0, 'entitlement revoked at the provider boundary must prevent delivery');

  var notReadyStore = new Store(); await commission(notReadyStore, culture, now);
  var notReadySubscriber = Object.assign(subscriber('culture'), { email: 'culture-provider-not-ready@example.test',
    subscriptionId: 'sub_culture_not_ready', customerId: 'cus_culture_not_ready' });
  await putSubscriber(notReadyStore, notReadySubscriber);
  var notReadyCandidate = culture.decision.candidate(notReadySubscriber, digest('culture', 'provider-not-ready'));
  var notReadyDecision = await culture.decision.decide(notReadyStore, notReadyCandidate, now,
    { cognition: cognition(culture, now) });
  var notReady = await culture.executor.execute({ store: notReadyStore,
    specs: [{ candidate: notReadyCandidate, decision: notReadyDecision }], now: now,
    maxSends: 1, emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailySendCap: 1,
    authorizationDeps: { env: openEnv(culture), cognition: cognition(culture, now) },
    adapterGuard: { checkpoint: async function () { return { allowed: true }; } },
    transport: { send: async function () { return { ok: false, error: 'provider config missing', notReady: true,
      providerCalled: false, definitiveFailure: true }; } }
  });
  assert.equal(notReady.status, 'HELD_PRE_SEND');
  assert.equal(notReady.providerCalls, 0, 'pre-provider configuration failure must remain retryable');

  var readFailureStore = new Store(); await commission(readFailureStore, culture, now);
  var readFailureSubscriber = Object.assign(subscriber('culture'), { email: 'culture-read-failure@example.test',
    subscriptionId: 'sub_culture_read_failure', customerId: 'cus_culture_read_failure' });
  await putSubscriber(readFailureStore, readFailureSubscriber);
  var readFailureCandidate = culture.decision.candidate(readFailureSubscriber, digest('culture', 'read-failure'));
  var readFailureDecision = await culture.decision.decide(readFailureStore, readFailureCandidate, now,
    { cognition: cognition(culture, now) });
  readFailureStore.failGetKeyOnce = 'subs:v1'; var readFailureCalls = 0;
  var readFailureHeld = await culture.executor.execute({ store: readFailureStore,
    specs: [{ candidate: readFailureCandidate, decision: readFailureDecision }], now: now,
    maxSends: 1, emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailySendCap: 1,
    authorizationDeps: { env: openEnv(culture), cognition: cognition(culture, now) },
    adapterGuard: { checkpoint: async function () { return { allowed: true }; } },
    transport: { send: async function () { readFailureCalls++; return { ok: true, id: 'must-not-send-read-failure' }; } }
  });
  assert.equal(readFailureHeld.status, 'HELD_PRE_SEND');
  assert.equal(readFailureHeld.providerCalls, 0);
  assert.equal(readFailureCalls, 0);
  var readFailureClaim = await readFailureStore.get(culture.executor.actionKey(readFailureDecision.actionId));
  if (readFailureClaim) assert.notEqual(readFailureClaim.status, 'DISPATCHING');

  var suppressedTaskStore = new Store(); await commission(suppressedTaskStore, fulfillmentLane, now);
  var suppressedTaskSubscriber = Object.assign(subscriber('education'), { email: 'education-suppressed@example.test',
    subscriptionId: 'sub_education_suppressed', customerId: 'cus_education_suppressed' });
  await putSubscriber(suppressedTaskStore, suppressedTaskSubscriber);
  var suppressedTaskCandidate = fulfillmentLane.decision.candidate(suppressedTaskSubscriber,
    digest('education', 'permanent-suppression'));
  await suppressedTaskStore.set(fulfillmentLane.executor.suppressionKey(suppressedTaskCandidate.emailHash), {
    suppressed: true, reason: 'complained', at: now - 1000
  });
  var suppressedTaskCalls = 0;
  var suppressedTask = await fulfillmentLane.fulfillment.enqueueAndAttempt({
    store: suppressedTaskStore, eventId: 'evt-education-suppressed-task', kind: 'welcome',
    subscriber: suppressedTaskSubscriber, message: digest('education', 'permanent-suppression'), now: now,
    subscriptions: { getStrict: async function () { return suppressedTaskSubscriber; } },
    decisionDeps: { cognition: cognition(fulfillmentLane, now) },
    authorizationDeps: { env: openEnv(fulfillmentLane), cognition: cognition(fulfillmentLane, now) },
    maxSends: 1, emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailySendCap: 1,
    transport: { send: async function () { suppressedTaskCalls++; return { ok: true, id: 'must-not-send-suppressed-task' }; } }
  });
  assert.equal(suppressedTask.status, 'CANCELED');
  assert.equal(suppressedTaskCalls, 0);
  var minimizedSuppressedTask = await suppressedTaskStore.get(fulfillmentLane.fulfillment.key(suppressedTask.taskId));
  assert.equal(minimizedSuppressedTask.message, undefined);
  assert.equal(minimizedSuppressedTask.subscriber.email, undefined,
    'permanently suppressed tasks must not retain customer content in an endless retry queue');

  var acceptedRaceStore = new Store(); await commission(acceptedRaceStore, fulfillmentLane, now);
  var acceptedRaceSubscriber = Object.assign(subscriber('education'), { email: 'education-accepted-race@example.test',
    subscriptionId: 'sub_education_accepted_race', customerId: 'cus_education_accepted_race' });
  await putSubscriber(acceptedRaceStore, acceptedRaceSubscriber);
  var acceptedRaceCandidate = fulfillmentLane.decision.candidate(acceptedRaceSubscriber,
    digest('education', 'accepted-suppression-race'));
  var acceptedRace = await fulfillmentLane.fulfillment.enqueueAndAttempt({
    store: acceptedRaceStore, eventId: 'evt-education-accepted-race', kind: 'welcome',
    subscriber: acceptedRaceSubscriber, message: digest('education', 'accepted-suppression-race'), now: now,
    subscriptions: { getStrict: async function () { return acceptedRaceSubscriber; } },
    decisionDeps: { cognition: cognition(fulfillmentLane, now) },
    authorizationDeps: { env: openEnv(fulfillmentLane), cognition: cognition(fulfillmentLane, now) },
    maxSends: 1, emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailySendCap: 1,
    adapterGuard: { checkpoint: async function () { return { allowed: true }; } },
    transport: { send: async function () {
      await acceptedRaceStore.set(fulfillmentLane.executor.suppressionKey(acceptedRaceCandidate.emailHash), {
        suppressed: true, reason: 'concurrent-older-message-complaint', at: now
      });
      return { ok: true, id: 're_education_accepted_race', providerCalled: true };
    } }
  });
  assert.equal(acceptedRace.status, 'COMPLETED',
    'an accepted irreversible send must remain completed if suppression arrives after dispatch');
  assert.equal(acceptedRace.providerEmailId, 're_education_accepted_race');

  console.log('soft subscriber sovereignty: PASS (4 exact domain lanes, durable decisions and real capability proof required, cross-domain authority refused, terminal customer data minimized)');
})().catch(function (error) { console.error(error); process.exit(1); });
