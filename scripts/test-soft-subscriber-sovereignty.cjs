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
Store.prototype.get = async function (key) { return this.values.has(key) ? clone(this.values.get(key)) : null; };
Store.prototype.set = async function (key, value) { this.values.set(key, clone(value)); return true; };
Store.prototype.setIfAbsent = async function (key, value) {
  if (this.values.has(key)) return false;
  this.values.set(key, clone(value)); return true;
};
Store.prototype.del = async function (key) { return this.values.delete(key) ? 1 : 0; };
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
  var store = new Store(), cultureCandidate = culture.decision.candidate(subscriber('culture'), digest('culture', 'a'));
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
  var observation = observedRows[0];
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
  var suppression = await store.get(culture.executor.suppressionKey(executed.items[0].emailHash));
  assert.equal(suppression.suppressed, true);
  assert.equal(await store.get(education.executor.suppressionKey(executed.items[0].emailHash)), null,
    'Culture recovery may not mutate Education suppression');

  var alternateCultureSubscriber = Object.assign(subscriber('culture'), { email: 'culture-two@example.test',
    subscriptionId: 'sub_culture_two', customerId: 'cus_culture_two' });
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
  assert.equal(await store.get(culture.executor.actionKey(inhibited.items[0].actionId)), null,
    'inhibited action claim must be released for a later retry');

  var medicine = Lanes.get('medicine'), medicineStore = new Store();
  var medCandidate = medicine.decision.candidate(subscriber('medicine'), digest('medicine', 'no-provider-id'));
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
  var task = await fulfillmentLane.fulfillment.enqueueAndAttempt({
    store: fulfillmentStore, eventId: 'evt-education-1', kind: 'welcome',
    subscriber: subscriber('education'), message: digest('education', 'welcome'), now: now,
    subscriptions: { getStrict: async function () { return subscriber('education'); } },
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
  var heldTask = await fulfillmentLane.fulfillment.enqueueAndAttempt({
    store: canceledStore, eventId: 'evt-education-canceled', kind: 'welcome',
    subscriber: subscriber('education'), message: digest('education', 'cancel-before-retry'), now: now,
    subscriptions: { getStrict: async function () { return subscriber('education'); } },
    decisionDeps: { cognition: cognition(fulfillmentLane, now) },
    authorizationDeps: { env: {}, cognition: cognition(fulfillmentLane, now) }
  });
  assert.equal(heldTask.status, 'HELD');
  var retried = await fulfillmentLane.fulfillment.retryRecent({ store: canceledStore,
    subscriptions: { getStrict: async function () { return Object.assign(subscriber('education'), { active: false }); } } });
  assert.equal(retried[0].status, 'CANCELED');
  assert.equal(retried[0].providerCalls, 0);
  var canceled = await canceledStore.get(fulfillmentLane.fulfillment.key(heldTask.taskId));
  assert.equal(canceled.message, undefined);
  assert.equal(canceled.subscriber.email, undefined);

  console.log('soft subscriber sovereignty: PASS (4 exact domain lanes, durable decisions and real capability proof required, cross-domain authority refused, terminal customer data minimized)');
})().catch(function (error) { console.error(error); process.exit(1); });
