'use strict';
var assert = require('node:assert/strict');
var fs = require('node:fs');
var Decision = require('../lib/religion-subscriber-decision.js');
var Executor = require('../lib/religion-subscriber-executor.js');
var Observer = require('../lib/religion-subscriber-outcome-observer.js');
var Recovery = require('../lib/religion-subscriber-recovery.js');
var Learning = require('../lib/religion-subscriber-learning.js');
var RevenueDecision = require('../lib/domain-revenue-decision.js');
function Store() { this.values = new Map(); this.lists = new Map(); }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (k) { return this.values.has(k) ? structuredClone(this.values.get(k)) : null; };
Store.prototype.set = async function (k, v) { this.values.set(k, structuredClone(v)); return true; };
Store.prototype.setIfAbsent = async function (k, v) { if (this.values.has(k)) return false; this.values.set(k, structuredClone(v)); return true; };
Store.prototype.lpush = async function (k, v) { var a = this.lists.get(k) || []; a.unshift(structuredClone(v)); this.lists.set(k, a); return a.length; };
Store.prototype.ltrim = async function (k, s, e) { this.lists.set(k, (this.lists.get(k) || []).slice(s, e + 1)); return true; };
Store.prototype.lrange = async function (k, s, e) { return structuredClone((this.lists.get(k) || []).slice(s, e + 1)); };
function cognition(now, review) { return { ts: now, c: { domain: 'religion', immune: { immuneState: 'clear' }, awareness: { humanReviewRequired: !!review },
  brainOrgans: { autonomousInternalEmission: { holdReason: null }, resourceMetabolism: { state: 'AVAILABLE', gates: { mayRunInternalCycle: true } } },
  serverPacket: { schemaVersion: 'civilization-domain-packet/1.0', domainId: 'religion', packetId: 'religion-packet-' + review, generatedAt: new Date(now).toISOString(),
    sourceIdentity: { producer: 'brain-cognition-refresh/1' }, truth: { feedHealth: { configured: 16, live: 16 } } } } }; }
function motor(id, authorized) { return { authorize: async function () { return { authorized: authorized !== false, receiptId: id, reason: authorized === false ? 'switch-off' : null }; } }; }
function sub(email) { return { email: email, domain: 'religion', active: true, subscriptionId: 'sub-secret', customerId: 'cus-secret' }; }
function digest(key) { var body = 'Source-grounded change.\n\nCheck any figure yourself: https://limenhelix.com/religion'; return { subject: 'Religion briefing', body: body, key: key,
  revenueDecision: RevenueDecision.create({ productDomain: 'religion', ownerDomain: 'religion', sourceMode: RevenueDecision.MODES.DOMAIN_WIDE_LIVE_READ,
    sourceRef: 'religion-live', digestKey: key, contentHash: Decision.hash(body) }) }; }
function budget() { return { emailCostUsd: 0.01, dailyBudgetUsd: 0.05, dailySendCap: 5 }; }

(async function () {
  var now = Date.now(), store = new Store(), c1 = Decision.candidate(sub('buyer@example.com'), digest('digest-1'));
  assert.equal(Decision.validateCandidate(c1), true);
  var candidate = c1, brain = cognition(now, false);
  // LOCAL proof: the existing source-valid candidate stays represented on every immune route.
  var routeStore = new Store(), candidateBefore = JSON.stringify(candidate);
  for (var routeCase of [
    ['PASS', { immuneState: 'clear' }],
    ['HOLD', { immuneState: 'clear', quarantines: ['unresolved-domain-evidence'] }],
    ['QUARANTINE', { immuneState: 'alert', candidateScoped: true, integrityThreat: true }],
    ['REJECT', null]
  ]) {
    var routeBrain = JSON.parse(JSON.stringify(brain)); routeBrain.c.immune = routeCase[1];
    var routed = await Decision.decide(routeStore, candidate, now, { cognition: routeBrain });
    assert.equal(routed.immuneRouting.route, routeCase[0]);
    assert.equal(routed.immuneRouting.candidatePreserved, true);
    var readonlyRouteStore = Object.create(routeStore);
    ['set', 'setIfAbsent', 'lpush', 'ltrim', 'del'].forEach(function (method) {
      readonlyRouteStore[method] = async function () { throw Error('route read attempted write'); };
    });
    readonlyRouteStore.lrange = async function (key, start, end) {
      return key === Decision.LOG_KEY ? [routed] : routeStore.lrange(key, start, end);
    };
    var routeTrace = await require('../lib/product-domain-business-trace-readout.js').read(readonlyRouteStore, 'religion', now);
    assert.equal(routeTrace.status, 'RECORDED');
    assert.equal(routeTrace.decision.id, routed.decisionReceiptId);
    assert.equal(routeTrace.decision.immuneRoute, routeCase[0]);
    assert.equal(routeTrace.command, null);
    assert.equal(routeTrace.externalActionAuthorized, false);
    var routeElement = { innerHTML: '' }, routeWindow = { addEventListener: function () {} };
    require('node:vm').runInNewContext(fs.readFileSync('assets/js/civilization/execution-observatory.js', 'utf8'), {
      window: routeWindow, Date: Date, setTimeout: setTimeout, clearTimeout: clearTimeout, AbortController: AbortController, setInterval: function () {},
      document: { readyState: 'loading', addEventListener: function () {}, getElementById: function () { return routeElement; } },
      fetch: async function (url) { return { ok: true, json: async function () {
        return url.includes('brain-cognition') ? { cognition: { 'religion': { ts: now, c: { businessTrace: routeTrace } } } } : {};
      } }; }
    });
    await routeWindow.LIMENExecutionObservatory.refresh();
    assert(routeElement.innerHTML.includes(routed.decisionReceiptId));
    assert(routeElement.innerHTML.includes(routeCase[0]));
    assert.equal(routed.status, routeCase[0] === 'PASS' ? 'RELEASED' : 'NO_ACTION');
    assert.equal(Decision.validateReceipt(routed, candidate, now), routeCase[0] === 'PASS');
    assert.deepEqual(await routeStore.get(Decision.key(routed.decisionReceiptId)), routed);
    assert.deepEqual(await Decision.decide(routeStore, candidate, now, { cognition: routeBrain }), routed, 'immutable route replay');
    if (routeCase[0] !== 'PASS') {
      var reconsidered = await Decision.decide(routeStore, candidate, now + 1, { cognition: brain });
      assert.equal(reconsidered.immuneRouting.route, 'PASS');
      assert.notEqual(reconsidered.decisionReceiptId, routed.decisionReceiptId);
      assert.deepEqual(await routeStore.get(Decision.key(routed.decisionReceiptId)), routed, 'reconsideration preserves prior route');
      var refused = await Executor.execute(Object.assign({ store: routeStore, specs: [{ candidate: candidate, decision: routed }], maxSends: 1, now: now + 1,
        motorAuthorization: { authorize: async function () { throw Error('non-PASS reached motor'); } },
        transport: { send: async function () { throw Error('non-PASS reached transport'); } } }, budget()));
      assert.equal(refused.reason, 'religion-subscriber-no-released-exact-decisions');
      assert.equal(refused.accepted, 0);
    }
  }
  assert.equal((await routeStore.lrange(Decision.LOG_KEY, 0, 99)).length, 4);
  assert.equal(JSON.stringify(candidate), candidateBefore);
  var legacy = await Decision.decide(new Store(), candidate, now, { cognition: brain });
  delete legacy.immuneRouting;
  assert.equal(Decision.validateReceipt(legacy, candidate, now), false, 'unclassified release cannot authorize an inquiry');

  var held = await Decision.decide(store, c1, now, { cognition: cognition(now, true) });
  assert.equal(held.status, 'NO_ACTION'); assert(held.blockers.includes('religion-human-review-veto'));
  var released = await Decision.decide(store, c1, now, { cognition: cognition(now, false) });
  assert.equal(released.status, 'RELEASED'); assert.equal(Decision.validateReceipt(released, c1, now), true);

  var sends = 0;
  var noBudget = await Executor.execute(Object.assign({ store: new Store(), specs: [{ candidate: c1, decision: released }], maxSends: 1, now: now,
    motorAuthorization: motor('not-reached'), transport: { send: async function () { sends++; } } }, { dailySendCap: 5 }));
  assert.equal(noBudget.status, 'HELD'); assert.equal(noBudget.reason, 'religion-subscriber-email-unit-cost-not-configured'); assert.equal(sends, 0);
  var motorHeld = await Executor.execute(Object.assign({ store: new Store(), specs: [{ candidate: c1, decision: released }], maxSends: 1, now: now,
    motorAuthorization: motor('held', false), transport: { send: async function () { sends++; } } }, budget()));
  assert.equal(motorHeld.status, 'HELD'); assert.equal(sends, 0);

  var c2 = Decision.candidate(sub('second@example.com'), digest('digest-2'));
  var d2 = await Decision.decide(store, c2, now, { cognition: cognition(now, false) });
  var sawCommand = false, idem = null;
  var result = await Executor.execute(Object.assign({ store: store, specs: [{ candidate: c1, decision: released }, { candidate: c2, decision: d2 }], maxSends: 1, now: now,
    motorAuthorization: motor('religion-motor-1'), transport: { send: async function (_email, _subject, _body, options) {
      sends++; idem = options.idempotencyKey; sawCommand = Array.from(store.values.values()).some(function (v) { return v && v.status === 'DISPATCHING'; });
      return { ok: true, id: 'email-provider-1', providerCalled: true };
    } } }, budget()));
  assert.equal(result.status, 'RECEIPTS_PERSISTED'); assert.equal(result.accepted, 1); assert.equal(result.items.length, 1);
  assert.equal(sends, 1); assert.equal(sawCommand, true); assert.equal(idem, 'religion-digest/' + released.actionId);
  var replay = await Executor.execute(Object.assign({ store: store, specs: [{ candidate: c1, decision: released }], maxSends: 1, now: now,
    motorAuthorization: motor('religion-motor-1'), transport: { send: async function () { sends++; } } }, budget()));
  assert.equal(replay.replayed, true); assert.equal(sends, 1);
  var laterMotor = await Executor.execute(Object.assign({ store: store, specs: [{ candidate: c1, decision: released }], maxSends: 1, now: now,
    motorAuthorization: motor('religion-motor-2'), transport: { send: async function () { sends++; } } }, budget()));
  assert.equal(laterMotor.accepted, 1); assert.equal(sends, 1);

  var budgetStore = new Store(), budgetSends = 0;
  await Decision.decide(budgetStore, c1, now, { cognition: cognition(now, false) });
  await Decision.decide(budgetStore, c2, now, { cognition: cognition(now, false) });
  var budgetLimited = await Executor.execute({ store: budgetStore,
    specs: [{ candidate: c1, decision: released }, { candidate: c2, decision: d2 }], maxSends: 2, now: now,
    emailCostUsd: 0.01, dailyBudgetUsd: 0.01, dailySendCap: 5,
    motorAuthorization: motor('religion-budget-motor'), transport: { send: async function () {
      budgetSends++; return { ok: true, id: 'budget-provider-' + budgetSends, providerCalled: true };
    } } });
  assert.equal(budgetLimited.accepted, 1); assert.equal(budgetLimited.budgetHeld, 1); assert.equal(budgetSends, 1);
  assert.equal(budgetLimited.estimatedCommittedUsd, 0.01);

  var observation = await Observer.observe(store, result, result.items[0], { apiKey: 'read-key', fetch: async function (_url, options) {
    assert.equal(options.method, 'GET'); return { ok: true, status: 200, json: async function () { return { id: 'email-provider-1', last_event: 'bounced', created_at: new Date(now).toISOString() }; } };
  } });
  assert.equal(observation.status, 'TERMINAL_OBSERVED'); assert.equal(observation.lastEvent, 'bounced'); assert.equal(observation.independentOfSendResponse, true);
  var unsafeStore = Object.create(store), unsafeWrites = 0;
  ['set', 'setIfAbsent', 'lpush', 'ltrim'].forEach(function (method) {
    unsafeStore[method] = async function () { unsafeWrites++; throw Error('invalid evidence attempted learning write'); };
  });
  var unsaved = await Learning.recordObservation(unsafeStore, Object.assign({}, observation, { observationId: 'LOCAL-NOT-SAVED' }));
  assert.equal(unsaved.ok, false); assert.equal(unsaved.reason, 'religion-observation-causal-join-invalid');
  assert.equal(unsafeWrites, 0);
  assert.deepEqual(await store.get(Observer.key(observation.observationId)), observation);
  var originalLog = await store.lrange(Observer.LOG_KEY, 0, 99);
  var repeatRead = { apiKey: 'LOCAL/read', fetch: async function () { return { ok: true, status: 200, json: async function () {
    return { id: observation.providerEmailId, last_event: observation.lastEvent, created_at: observation.providerRecordCreatedAt };
  } }; } };
  assert.deepEqual(await Observer.observe(store, result, result.items[0], repeatRead), observation);
  assert.deepEqual(await Observer.observe(store, laterMotor, laterMotor.items[0], repeatRead), observation, 'reused receipts retain original command identity');
  assert.deepEqual(await store.lrange(Observer.LOG_KEY, 0, 99), originalLog);
  var badReadbackStore = Object.create(store);
  badReadbackStore.get = async function (key) {
    var value = await store.get(key);
    return key === Observer.key(observation.observationId) ? Object.assign({}, value, { emailHash: 'corrupt-readback' }) : value;
  };
  await assert.rejects(Observer.observe(badReadbackStore, result, result.items[0], repeatRead), /readback invalid/);
  var savedAction = await store.get(Executor.actionKey(observation.actionId));
  await store.set(Executor.actionKey(observation.actionId), Object.assign({}, savedAction, { schemaVersion: 'foreign-action/1' }));
  assert.equal((await Learning.recordObservation(unsafeStore, observation)).ok, false);
  assert.equal((await Observer.observe(unsafeStore, result, result.items[0], repeatRead)).ok, false);
  await store.set(Executor.actionKey(observation.actionId), savedAction);
  var savedCause = await store.get(Learning.causeKey(observation.actionId));
  await store.set(Learning.causeKey(observation.actionId), Object.assign({}, savedCause, { domain: 'intelligence' }));
  assert.equal((await Learning.recordObservation(unsafeStore, observation)).ok, false);
  await store.set(Learning.causeKey(observation.actionId), savedCause);
  for (var corrupt of [{ commandId: 'foreign-command' }, { providerEmailId: 'foreign-provider' }, { emailHash: 'foreign-email' },
    { independentOfSendResponse: false }, { sendEndpointCalled: true }, { readMethod: 'POST' },
    { observedAt: result.commandedAt - 1 }, { observedAt: Date.now() + 60000 }, { liveMoney: true }]) {
    var corrupted = Object.assign({}, observation, corrupt);
    await store.set(Observer.key(observation.observationId), corrupted);
    assert.equal((await Learning.recordObservation(unsafeStore, corrupted)).ok, false, JSON.stringify(corrupt));
  }
  await store.set(Observer.key(observation.observationId), observation);
  var originalCommand = await store.get(Executor.commandKey(result.commandId));
  for (var change of [{ ownerDomain: 'intelligence' }, { readbackVerified: false }, { status: 'DISPATCHING' }, { liveMoney: true }]) {
    await store.set(Executor.commandKey(result.commandId), Object.assign({}, originalCommand, change));
    assert.equal((await Learning.recordObservation(unsafeStore, observation)).ok, false);
  }
  var corruptItemCommand = structuredClone(originalCommand); corruptItemCommand.items[0].revenueDecisionId = 'foreign-revenue';
  await store.set(Executor.commandKey(result.commandId), corruptItemCommand);
  assert.equal((await Learning.recordObservation(unsafeStore, observation)).ok, false);
  corruptItemCommand = structuredClone(originalCommand); corruptItemCommand.items.push(structuredClone(corruptItemCommand.items[0]));
  await store.set(Executor.commandKey(result.commandId), corruptItemCommand);
  assert.equal((await Learning.recordObservation(unsafeStore, observation)).ok, false);
  await store.set(Executor.commandKey(result.commandId), originalCommand);
  assert.equal(unsafeWrites, 0);
  var learned = await Learning.recordObservation(store, observation); assert.equal(learned.ok, true); assert.equal(learned.resolvedCount, 1);
  var laterObservation = await Observer.observe(store, result, result.items[0], { apiKey: 'LOCAL/read', fetch: async function () {
    return { ok: true, status: 200, json: async function () { return { id: observation.providerEmailId, last_event: 'delivered', created_at: observation.providerRecordCreatedAt }; } };
  } });
  assert.notEqual(laterObservation.observationId, observation.observationId);
  assert.deepEqual(await store.get(Observer.key(observation.observationId)), observation);
  assert.deepEqual(await store.get(Observer.key(observation.providerEmailId)), laterObservation);
  assert.equal((await Learning.recordObservation(store, observation)).duplicate, true);
  assert.equal((await Learning.readForBrain(store)).resolvedCount, 1);
  var returned = await Decision.decide(store, c1, now + 1, { cognition: cognition(now + 1, false) });
  assert.equal(returned.status, 'NO_ACTION');
  assert(returned.blockers.includes('religion-returned-outcome-requires-reassessment'));
  assert.equal(returned.returnedOutcome.status, 'OBSERVED');
  assert.equal(returned.returnedOutcome.signalOutcome, 'bounced');
  assert.equal(returned.returnedOutcome.normalizedCredit, 0);
  assert.equal(returned.returnedOutcome.effect, 'CONSUMED_AS_RELIGION_AFFERENT');
  assert.notEqual(returned.decisionReceiptId, released.decisionReceiptId, 'returned consequence must change the next decision receipt identity');
  var earlySignal = await Learning.readForBrain(store); assert.equal(earlySignal.learningGate.ready, false);
  for (var n = 2; n <= 5; n++) {
    var fixtureCandidate = Decision.candidate(sub('LOCAL-fixture-' + n + '@example.invalid'), digest('LOCAL-fixture-digest-' + n));
    var fixtureDecision = await Decision.decide(store, fixtureCandidate, now, { cognition: cognition(now, false) });
    var fixtureCommand = await Executor.execute(Object.assign({ store: store, specs: [{ candidate: fixtureCandidate, decision: fixtureDecision }],
      maxSends: 1, now: now, motorAuthorization: motor('LOCAL-fixture-motor-' + n),
      transport: { send: async function () { return { ok: true, id: 'LOCAL-fixture-provider-' + n, providerCalled: true }; } } }, budget()));
    assert.equal(fixtureCommand.accepted, 1);
    var fixtureObservation = await Observer.observe(store, fixtureCommand, fixtureCommand.items[0], { apiKey: 'LOCAL/read-fixture',
      fetch: async function (_url, options) { assert.equal(options.method, 'GET'); return { ok: true, status: 200,
        json: async function () { return { id: fixtureCommand.items[0].providerEmailId, last_event: 'delivered', created_at: new Date(now).toISOString() }; } }; } });
    assert.equal((await Learning.recordObservation(store, fixtureObservation)).ok, true);
  }
  var readySignal = await Learning.readForBrain(store); assert.equal(readySignal.learningGate.ready, true);
  assert.equal(readySignal.resolvedCount, 5); assert.equal(readySignal.signal.sourceKind, 'independent-action-outcome');
  var storePath = require.resolve('../lib/autofire-efference-store.js');
  var handlerPath = require.resolve('../handlers/product-domain-learning-state.js');
  var previousStore = require.cache[storePath], previousHandler = require.cache[handlerPath];
  async function endpointRead(proofStore) {
    var readonly = Object.create(proofStore);
    ['set', 'setIfAbsent', 'lpush', 'ltrim', 'del'].forEach(function (method) { readonly[method] = async function () { throw Error('endpoint read wrote state'); }; });
    require.cache[storePath] = { id: storePath, filename: storePath, loaded: true, exports: readonly };
    delete require.cache[handlerPath];
    var result, response = { statusCode: 0, setHeader: function () {}, end: function (body) { result = JSON.parse(body); } };
    await require(handlerPath)({ method: 'GET', url: '/api/product-domain-learning-state?domain=religion' }, response);
    assert.equal(response.statusCode, 200); return result;
  }
  try {
    var qualifiedReadout = await endpointRead(store), emptyReadout = await endpointRead(new Store());
    assert.equal(qualifiedReadout.resolvedCount, 5);
    assert.equal(qualifiedReadout.learningGate.ready, true);
    assert.equal(qualifiedReadout.signal.normalizedCredit, readySignal.signal.normalizedCredit);
    assert.equal(qualifiedReadout.signal.ownerDomain, 'religion');
    assert.equal(emptyReadout.resolvedCount, 0); assert.equal(emptyReadout.signal, null);
    var nativeCycle = require('./fixtures/publication-native-cycle.cjs');
    var qualifiedNative = await nativeCycle('religion', qualifiedReadout, now + 1000);
    var emptyNative = await nativeCycle('religion', emptyReadout, now + 1000);
    assert.equal(qualifiedNative.externalRewardEligible, false, 'existing K4 policy excludes this owner');
    assert.equal(qualifiedNative.plasticity.rewardActive, false);
    assert.deepEqual(qualifiedNative.evaluated, emptyNative.evaluated, 'retained outcome is not proof of changed native evaluation');
    assert.equal(emptyNative.plasticity.rewardActive, false);
    var gateControl = JSON.parse(JSON.stringify(qualifiedReadout)); gateControl.learningGate.ready = false;
    var gatedNative = await nativeCycle('religion', gateControl, now + 1000);
    assert.equal(gatedNative.plasticity.rewardActive, false);
    console.log('religion native return proof', JSON.stringify({ ownSignal: qualifiedNative.learning.signal.signalId,
      qualifiedReward: qualifiedNative.plasticity.rewardActive, noOutcomeReward: emptyNative.plasticity.rewardActive,
      gatedReward: gatedNative.plasticity.rewardActive, sameEvaluation: JSON.stringify(qualifiedNative.evaluated) === JSON.stringify(emptyNative.evaluated) }));
  } finally {
    if (previousStore) require.cache[storePath] = previousStore; else delete require.cache[storePath];
    if (previousHandler) require.cache[handlerPath] = previousHandler; else delete require.cache[handlerPath];
  }

  var recovery = await Recovery.recover({ store: store, command: result, actionId: released.actionId, observation: observation,
    motorAuthorization: motor('religion-motor-3'), now: now + 1 });
  assert.equal(recovery.status, 'FUTURE_DELIVERY_SUPPRESSED'); assert.equal(recovery.strictSuppressionReadback, true);
  assert.equal(recovery.irreversiblePriorEmail, true); assert.match(recovery.residual, /cannot be recalled/);

  var c3 = Decision.candidate(sub('buyer@example.com'), digest('digest-3'));
  var d3 = await Decision.decide(store, c3, now, { cognition: cognition(now, false) });
  var suppressed = await Executor.execute(Object.assign({ store: store, specs: [{ candidate: c3, decision: d3 }], maxSends: 1, now: now,
    motorAuthorization: motor('religion-motor-4'), transport: { send: async function () { sends++; } } }, budget()));
  assert.equal(suppressed.status, 'HELD'); assert.equal(suppressed.reason, 'religion-subscriber-all-candidates-suppressed'); assert.equal(sends, 1);

  var persisted = JSON.stringify(Array.from(store.values.values()).concat(Array.from(store.lists.values())));
  assert.equal(persisted.includes('buyer@example.com'), false); assert.equal(persisted.includes('sub-secret'), false); assert.equal(persisted.includes('cus-secret'), false);
  var Trace = require('../lib/product-domain-business-trace-readout.js');
  var readOnly = Object.create(store);
  ['set', 'setIfAbsent', 'lpush', 'ltrim'].forEach(function (method) { readOnly[method] = async function () { throw Error('reader attempted write'); }; });
  var trace = await Trace.read(readOnly, 'religion', now + 1000);
  assert.equal(trace.status, 'RECORDED', trace.reason); assert.equal(trace.externalActionAuthorized, false);
  assert.equal(trace.command.items.length, 1); assert.equal(trace.command.items[0].decisionId, released.decisionReceiptId);
  assert.equal(trace.command.items[0].receipt.id, 'email-provider-1');
  assert.equal(trace.command.items[0].receipt.commandId, result.commandId, 'a reused receipt retains its actual originating command');
  assert(!JSON.stringify(trace).includes('@')); assert(!JSON.stringify(trace).includes('sub-secret'));
  var partial = await Trace.read(budgetStore, 'religion', now + 1000);
  assert.equal(partial.status, 'RECORDED', partial.reason); assert.equal(partial.command.receipt.kind, 'EMAIL-BATCH');
  assert.equal(partial.command.receipt.acceptedCount, 1); assert.equal(partial.command.receipt.itemCount, 2);
  assert.equal(partial.command.items[1].status, 'BUDGET_HELD'); assert.equal(partial.command.items[1].receipt, null);
  var saved = await budgetStore.get(Executor.commandKey(budgetLimited.commandId));
  var invalid = structuredClone(saved); invalid.items[1].decisionReceiptId = 'missing';
  await budgetStore.set(Executor.commandKey(saved.commandId), invalid);
  assert.equal((await Trace.read(budgetStore, 'religion', now + 1000)).reason, 'subscriber-item-decision-link-invalid');
  invalid = structuredClone(saved); invalid.items[1].actionId = invalid.items[0].actionId;
  await budgetStore.set(Executor.commandKey(saved.commandId), invalid);
  assert.equal((await Trace.read(budgetStore, 'religion', now + 1000)).reason, 'subscriber-item-invalid');
  await budgetStore.set(Executor.commandKey(saved.commandId), saved);
  assert.equal((await Trace.read(budgetStore, 'religion', now + 1000)).status, 'RECORDED');
  var actionKey = Executor.actionKey(saved.items[0].actionId), actionCopy = await budgetStore.get(actionKey);
  await budgetStore.set(actionKey, Object.assign({}, actionCopy, { commandId: 'unrelated-command' }));
  assert.equal((await Trace.read(budgetStore, 'religion', now + 1000)).reason, 'subscriber-receipt-command-link-invalid');
  await budgetStore.set(actionKey, actionCopy);
  console.log('religion subscriber sovereign B10/B14/delivery/recovery loop and per-item business trace: PASS');
})().catch(function (error) { console.error(error); process.exitCode = 1; });
