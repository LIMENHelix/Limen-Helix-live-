'use strict';
var assert = require('node:assert/strict'); var fs = require('node:fs'); var Decision = require('../lib/law-automail-decision.js');
var Executor = require('../lib/law-automail-executor.js'); var Observer = require('../lib/law-automail-outcome-observer.js'); var Recovery = require('../lib/law-automail-recovery.js');
var Learning = require('../lib/law-automail-learning.js');
function Store() { this.values = new Map(); this.lists = new Map(); } Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (k) { return this.values.has(k) ? structuredClone(this.values.get(k)) : null; };
Store.prototype.set = async function (k, v) { this.values.set(k, structuredClone(v)); return true; };
Store.prototype.setIfAbsent = async function (k, v) { if (this.values.has(k)) return false; this.values.set(k, structuredClone(v)); return true; };
Store.prototype.lpush = async function (k, v) { var a = this.lists.get(k) || []; a.unshift(structuredClone(v)); this.lists.set(k, a); return a.length; };
Store.prototype.ltrim = async function (k, s, e) { this.lists.set(k, (this.lists.get(k) || []).slice(s, e + 1)); };
Store.prototype.lrange = async function (k, s, e) { return structuredClone((this.lists.get(k) || []).slice(s, e + 1)); };
function cognition(now, review) { return { ts: now, c: { domain: 'law', immune: { immuneState: 'clear' }, awareness: { humanReviewRequired: review },
  brainOrgans: { autonomousInternalEmission: { holdReason: null }, resourceMetabolism: { state: 'AVAILABLE', gates: { mayRunInternalCycle: true } } },
  serverPacket: { schemaVersion: 'civilization-domain-packet/1.0', domainId: 'law', packetId: 'law-packet-' + review, generatedAt: new Date(now).toISOString(),
    sourceIdentity: { producer: 'brain-cognition-refresh/1' }, truth: { feedHealth: { configured: 12, live: 12 } } } } }; }
function motor(id) { return { authorize: async function () { return { authorized: true, receiptId: id }; } }; }
(async function () { var store = new Store(), now = Date.now(), deal = { parcel: 'parcel-secret', saleDate: '10/15/2026', _daysOut: 50,
    owner: { name: 'Private Owner', mailAddr: '123 Private St', mailCity: 'Tampa', mailState: 'FL', mailZip: '33601' } };
  var candidate = Decision.candidate(deal, '<html>Exact lawful marketing letter</html>', 8); assert.equal(Decision.validateCandidate(candidate), true);
  var brain = cognition(now, false);
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
    var routeTrace = await require('../lib/product-domain-business-trace-readout.js').read(readonlyRouteStore, 'law', now);
    assert.equal(routeTrace.status, 'RECORDED');
    assert.equal(routeTrace.decision.id, routed.decisionReceiptId);
    assert.equal(routeTrace.decision.immuneRoute, routeCase[0]);
    assert.equal(routeTrace.command, null);
    assert.equal(routeTrace.externalActionAuthorized, false);
    var routeElement = { innerHTML: '' }, routeWindow = { addEventListener: function () {} };
    require('node:vm').runInNewContext(fs.readFileSync('assets/js/civilization/execution-observatory.js', 'utf8'), {
      window: routeWindow, Date: Date, setInterval: function () {},
      document: { readyState: 'loading', addEventListener: function () {}, getElementById: function () { return routeElement; } },
      fetch: async function (url) { return { ok: true, json: async function () {
        return url.includes('brain-cognition') ? { cognition: { 'law': { ts: now, c: { businessTrace: routeTrace } } } } : {};
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
      var refused = await Executor.execute({ store: routeStore, candidate: candidate, decision: routed, now: now + 1,
        motorAuthorization: { authorize: async function () { throw new Error('non-PASS must never reach motor'); } },
        operationCostUsd: 0, dailyBudgetUsd: 0, dailyPublicationCap: 1 });
      assert.equal(refused.status, 'HELD');
      assert.equal(refused.reason, 'law-automail-exact-b10-decision-required');
    }
  }
  assert.equal((await routeStore.lrange(Decision.LOG_KEY, 0, 99)).length, 4);
  assert.equal(JSON.stringify(candidate), candidateBefore);
  var legacy = await Decision.decide(new Store(), candidate, now, { cognition: brain });
  delete legacy.immuneRouting;
  assert.equal(Decision.validateReceipt(legacy, candidate, now), false, 'unclassified release cannot authorize publication');

  var heldDecision = await Decision.decide(store, candidate, now, { cognition: cognition(now, true) }); assert.equal(heldDecision.status, 'NO_ACTION');
  var decision = await Decision.decide(store, candidate, now, { cognition: cognition(now, false) }); assert.equal(decision.status, 'RELEASED');
  var noBudget = await Executor.execute({ store: store, candidate: candidate, decision: decision, now: now, dailyLetterCap: 1 });
  assert.equal(noBudget.status, 'HELD'); assert.equal(noBudget.reason, 'law-automail-letter-cost-not-configured');
  var calls = 0, sawCommand = false, idem = null;
  var command = await Executor.execute({ store: store, candidate: candidate, decision: decision, now: now, letterCostUsd: 1, dailyBudgetUsd: 2, dailyLetterCap: 2,
    motorAuthorization: motor('law-motor-1'), provider: { create: async function (_candidate, key) { calls++; idem = key;
      sawCommand = Array.from(store.values.values()).some(function (v) { return v && v.status === 'DISPATCHING' && v.commandId; });
      return { ok: true, id: 'ltr_abc123', providerCalled: true }; } } });
  assert.equal(command.status, 'ACCEPTED'); assert.equal(command.accepted, 1); assert.equal(calls, 1); assert.equal(sawCommand, true); assert.equal(idem, 'law-automail/' + decision.actionId);
  assert(await store.get(Learning.causeKey(decision.actionId)));
  var replay = await Executor.execute({ store: store, candidate: candidate, decision: decision, now: now, letterCostUsd: 1, dailyBudgetUsd: 2, dailyLetterCap: 2,
    motorAuthorization: motor('law-motor-2'), provider: { create: async function () { calls++; } } });
  assert.equal(replay.replayed, true); assert.equal(calls, 1);
  var observation = await Observer.observe(store, command, { apiKey: 'read-key', fetch: async function (_url, options) { assert.equal(options.method, 'GET');
    return { ok: true, status: 200, json: async function () { return { id: 'ltr_abc123', status: 'rendered', expected_delivery_date: '2026-09-01', date_created: new Date(now).toISOString(), date_modified: new Date(now).toISOString() }; } }; } });
  assert.equal(observation.status, 'PROVIDER_STATE_OBSERVED'); assert.equal(observation.independentOfCreateResponse, true);
  assert.deepEqual(await store.get(Observer.key(observation.observationId)), observation);
  var originalLog = await store.lrange(Observer.LOG_KEY, 0, 99);
  var duplicateObservation = await Observer.observe(store, command, { apiKey: 'LOCAL/read', fetch: async function () { return {
    ok: true, status: 200, json: async function () { return { id: command.providerLetterId, status: 'rendered',
      expected_delivery_date: observation.expectedDeliveryDate, date_created: observation.providerCreatedAt, date_modified: observation.providerModifiedAt }; }
  }; } });
  assert.deepEqual(duplicateObservation, observation);
  assert.deepEqual(await store.lrange(Observer.LOG_KEY, 0, 99), originalLog);
  var beforeAdmission = await store.get(Learning.STATE_KEY);
  assert.equal((await Learning.recordObservation(store, Object.assign({}, observation, { observationId: 'unsaved-observation' }))).ok, false);
  assert.equal((await Learning.recordObservation(store, Object.assign({}, observation, { providerLetterId: 'ltr_foreign' }))).ok, false);
  var savedCause = await store.get(Learning.causeKey(command.actionId));
  await store.set(Learning.causeKey(command.actionId), Object.assign({}, savedCause, { domain: 'finance' }));
  assert.equal((await Learning.recordObservation(store, observation)).ok, false);
  await store.set(Learning.causeKey(command.actionId), savedCause);
  var savedCommand = await store.get(Executor.commandKey(command.commandId));
  await store.set(Executor.commandKey(command.commandId), Object.assign({}, savedCommand, { status: 'AMBIGUOUS' }));
  assert.equal((await Learning.recordObservation(store, observation)).ok, false);
  await store.set(Executor.commandKey(command.commandId), savedCommand);
  for (var corruption of [{ independentOfCreateResponse: false }, { createEndpointCalled: true }, { readMethod: 'POST' },
    { observedAt: command.commandedAt - 1 }, { observedAt: Date.now() + 86400000 }, { liveMoney: !command.liveMoney }]) {
    var corruptObservation = Object.assign({}, observation, corruption);
    await store.set(Observer.key(observation.observationId), corruptObservation);
    assert.equal((await Learning.recordObservation(store, corruptObservation)).ok, false);
  }
  await store.set(Observer.key(observation.observationId), observation);
  assert.deepEqual(await store.get(Learning.STATE_KEY), beforeAdmission, 'refused evidence cannot write learner state');
  assert.equal((await Learning.recordObservation(store, observation)).ok, true); assert.equal((await Learning.readForBrain(store)).status, 'ELIGIBLE');
  var returned = await Decision.decide(store, candidate, now + 1, { cognition: cognition(now + 1, false) });
  assert.equal(returned.status, 'RELEASED');
  assert.equal(returned.returnedOutcome.status, 'OBSERVED');
  assert.equal(returned.returnedOutcome.signalOutcome, 'rendered');
  assert.equal(returned.returnedOutcome.normalizedCredit, 0.5);
  assert.equal(returned.returnedOutcome.effect, 'CONSUMED_AS_LAW_AFFERENT');
  assert.notEqual(returned.decisionReceiptId, decision.decisionReceiptId, 'returned consequence must change the next decision receipt identity');
  var failedObservation = await Observer.observe(store, command, { apiKey: 'LOCAL/read', fetch: async function () { return {
    ok: true, status: 200, json: async function () { return { id: command.providerLetterId, status: 'failed',
      date_created: observation.providerCreatedAt, date_modified: new Date(now + 2).toISOString() }; }
  }; } });
  assert.notEqual(failedObservation.observationId, observation.observationId);
  assert.deepEqual(await store.get(Observer.key(observation.observationId)), observation);
  assert.deepEqual(await store.get(Observer.key(command.providerLetterId)), failedObservation);
  assert.equal((await Learning.recordObservation(store, observation)).duplicate, true);
  assert.equal((await Learning.readForBrain(store)).resolvedCount, 1);
  assert.equal((await Learning.recordObservation(store, failedObservation)).resolvedCount, 2);
  var failedReturn = await Decision.decide(store, candidate, now + 2, { cognition: cognition(now + 2, false) });
  assert.equal(failedReturn.status, 'NO_ACTION');
  assert(failedReturn.blockers.includes('law-returned-outcome-requires-reassessment'));
  assert.equal(failedReturn.returnedOutcome.signalOutcome, 'failed');
  assert.equal(failedReturn.returnedOutcome.normalizedCredit, 0);
  var canceled = 0, reads = 0, recovery = await Recovery.recover({ store: store, command: command, observation: observation,
    trigger: { type: 'law-automail-cancel', id: 'operator-cancel-1' }, now: now + 1, motorAuthorization: motor('law-motor-3'),
    provider: { cancel: async function (id) { canceled++; assert.equal(id, 'ltr_abc123'); return { ok: true, deleted: true }; },
      read: async function () { reads++; return { ok: true, deleted: true }; } } });
  assert.equal(recovery.status, 'CANCELED_VERIFIED'); assert.equal(canceled, 1); assert.equal(reads, 1);
  var persisted = JSON.stringify(Array.from(store.values.values()).concat(Array.from(store.lists.values())));
  assert.equal(persisted.includes('123 Private St'), false); assert.equal(persisted.includes('Private Owner'), false); assert.equal(persisted.includes('parcel-secret'), false);
  await require('./assert-business-trace.cjs')(store, 'law', command, 'LETTER-ACCEPTED', now + 1000, 'law-packet-false');
  console.log('law sovereign B10/B14/Lob observation/cancel loop and business trace: PASS');
})().catch(function (error) { console.error(error); process.exitCode = 1; });
