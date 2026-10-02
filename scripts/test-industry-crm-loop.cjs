#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var Queue = require('../lib/industry-crm-queue.js');
var Decision = require('../lib/industry-crm-decision.js');
var Executor = require('../lib/industry-crm-executor.js');
var Observer = require('../lib/industry-crm-observer.js');
var Learning = require('../lib/industry-crm-learning.js');
var Recovery = require('../lib/industry-crm-recovery.js');
var Provider = require('../lib/industry-crm-provider.js');

function memory() {
  var data = new Map();
  var lists = new Map();
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  return {
    assertDurable: function () { return true; },
    get: async function (key) { return data.has(key) ? clone(data.get(key)) : null; },
    set: async function (key, value) { data.set(key, clone(value)); return true; },
    setIfAbsent: async function (key, value) {
      if (data.has(key)) return false;
      data.set(key, clone(value));
      return true;
    },
    lpush: async function (key, value) {
      var list = lists.get(key) || [];
      list.unshift(clone(value));
      lists.set(key, list);
      return list.length;
    },
    ltrim: async function (key, start, end) {
      lists.set(key, (lists.get(key) || []).slice(start, end + 1));
      return true;
    },
    lrange: async function (key, start, end) {
      return clone((lists.get(key) || []).slice(start, end + 1));
    }
  };
}

function cognition(now) {
  return {
    ts: now,
    c: {
      domain: 'industry',
      immune: { immuneState: 'clear' },
      awareness: { humanReviewRequired: false },
      brainOrgans: {
        autonomousInternalEmission: { holdReason: null, emittedCount: 1 },
        resourceMetabolism: { state: 'AVAILABLE', gates: { mayRunInternalCycle: true } }
      },
      serverPacket: {
        schemaVersion: 'civilization-domain-packet/1.0',
        domainId: 'industry',
        packetId: 'industry_packet_1',
        generatedAt: new Date(now).toISOString(),
        sourceIdentity: { producer: 'brain-cognition-refresh/1' },
        truth: { feedHealth: { live: 5 } }
      }
    }
  };
}

function warnDeal(overrides) {
  return Object.assign({
    source: 'WARN',
    key: 'CA|PLANTCO|2026-10-01',
    company: 'Plant Co',
    state: 'CA',
    city: 'Fresno',
    address: '1 Plant Way',
    industry: 'Manufacturing',
    affected: 240,
    effectiveDate: '2026-10-01',
    priority: 75,
    workFirst: true
  }, overrides || {});
}

(async function () {
  var store = memory();
  var now = Date.now();
  var deal = warnDeal();
  var excluded = warnDeal({ key: 'CA|LOWRANK|2026-10-02', company: 'Low Rank Co', workFirst: false });
  var queued = await Queue.enqueueFromWarn(store, [excluded, deal], { identity: 'warn-ingest:1:2' });
  assert.deepEqual(queued, { eligible: 1, added: 1 });
  assert.equal(await store.get(Queue.key(excluded.key)), null, 'non-work-first WARN input must not enter the action queue');

  var task = await store.get(Queue.key(deal.key));
  var candidate = task.candidate;
  assert(Decision.validateCandidate(candidate));
  var brain = cognition(now);
  // LOCAL proof: the existing source-valid candidate stays represented on every immune route.
  var routeStore = memory(), candidateBefore = JSON.stringify(candidate);
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
    var routeTrace = await require('../lib/product-domain-business-trace-readout.js').read(readonlyRouteStore, 'industry', now);
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
        return url.includes('brain-cognition') ? { cognition: { 'industry': { ts: now, c: { businessTrace: routeTrace } } } } : {};
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
      assert.notEqual(refused.status, 'PUBLISHED');
    }
  }
  assert.equal((await routeStore.lrange(Decision.LOG_KEY, 0, 99)).length, 4);
  assert.equal(JSON.stringify(candidate), candidateBefore);
  var legacy = await Decision.decide(memory(), candidate, now, { cognition: brain });
  delete legacy.immuneRouting;
  assert.equal(Decision.validateReceipt(legacy, candidate, now), false, 'unclassified release cannot authorize publication');

  var decision = await Decision.decide(store, candidate, now, { cognition: cognition(now) });
  assert.equal(decision.status, 'RELEASED');

  var providerCalls = 0;
  var held = await Executor.execute({
    store: store,
    candidate: candidate,
    decision: decision,
    now: now + 1,
    motorAuthorization: { authorize: async function () { throw new Error('motor must not run before cost gate'); } },
    dailyBudgetUsd: 0,
    dailyOperationCap: 2,
    provider: { create: async function () { providerCalls++; return { ok: true, id: 'unexpected' }; } }
  });
  assert.equal(held.status, 'HELD');
  assert.equal(held.reason, 'industry-crm-operation-cost-not-configured');
  assert.equal(providerCalls, 0);

  var motors = 0;
  var motor = { authorize: async function () { return { authorized: true, receiptId: 'm_' + (++motors) }; } };
  var creates = 0;
  var provider = {
    create: async function (value) {
      creates++;
      assert.equal(value.company, 'Plant Co');
      return { ok: true, id: 'hs_123', providerCalled: true };
    }
  };
  var command = await Executor.execute({
    store: store,
    candidate: candidate,
    decision: decision,
    now: now + 2,
    motorAuthorization: motor,
    operationCostUsd: 0,
    dailyBudgetUsd: 0,
    dailyOperationCap: 2,
    provider: provider
  });
  assert.equal(command.status, 'ACCEPTED');
  assert.equal(command.readbackVerified, true);
  var replay = await Executor.execute({
    store: store,
    candidate: candidate,
    decision: decision,
    now: now + 3,
    motorAuthorization: motor,
    operationCostUsd: 0,
    dailyBudgetUsd: 0,
    dailyOperationCap: 2,
    provider: provider
  });
  assert.equal(replay.replayed, true);
  assert.equal(creates, 1, 'durable action identity must inhibit a second provider create');

  var pendingObservation = await Observer.observe(store, command, {
    get: async function (id) {
      return {
        ok: true,
        record: {
          id: id,
          updatedAt: '2026-08-26T00:30:00Z',
          properties: { lifecyclestage: 'lead' },
          propertiesWithHistory: { lifecyclestage: [{ value: 'lead' }] }
        }
      };
    }
  });
  assert.equal(pendingObservation.status, 'PENDING_OBSERVED');
  var prematureLearning = await Learning.recordObservation(store, pendingObservation);
  assert.equal(prematureLearning.ok, false, 'record existence alone must not become a business outcome');
  assert.equal((await Learning.readForBrain(store)).status, 'ABSTAINED');

  var observation = await Observer.observe(store, command, {
    get: async function (id) {
      return {
        ok: true,
        record: {
          id: id,
          archived: false,
          updatedAt: new Date(now + 3).toISOString(),
          properties: { lifecyclestage: 'opportunity', annualrevenue: '50000' },
          propertiesWithHistory: { lifecyclestage: [{ value: 'lead' }, { value: 'opportunity' }] }
        }
      };
    }
  });
  assert.equal(observation.status, 'STAGE_TRANSITION_OBSERVED');
  assert.equal(observation.independentOfCreateResponse, true);
  assert.deepEqual(await store.get(Observer.key(observation.observationId)), observation);
  var observationLogBeforeReplay = await store.lrange(Observer.LOG_KEY, 0, 99);
  var duplicateObservation = await Observer.observe(store, command, { get: async function (id) { return { ok: true,
    record: { id: id, updatedAt: observation.providerUpdatedAt, properties: { lifecyclestage: 'opportunity', annualrevenue: '50000' },
      propertiesWithHistory: { lifecyclestage: [{ value: 'lead' }, { value: 'opportunity' }] } } }; } });
  assert.deepEqual(duplicateObservation, observation);
  assert.deepEqual(await store.lrange(Observer.LOG_KEY, 0, 99), observationLogBeforeReplay);
  var stateBeforeAdmission = await store.get(Learning.STATE_KEY);
  assert.equal((await Learning.recordObservation(store, Object.assign({}, observation, { observationId: 'unsaved-observation' }))).ok, false);
  assert.equal((await Learning.recordObservation(store, Object.assign({}, observation, { hubspotCompanyId: 'foreign-company' }))).ok, false);
  var savedCause = await store.get(Learning.causeKey(command.actionId));
  await store.set(Learning.causeKey(command.actionId), Object.assign({}, savedCause, { domain: 'finance' }));
  assert.equal((await Learning.recordObservation(store, observation)).ok, false);
  await store.set(Learning.causeKey(command.actionId), savedCause);
  var savedCommand = await store.get(Executor.commandKey(command.commandId));
  await store.set(Executor.commandKey(command.commandId), Object.assign({}, savedCommand, { status: 'AMBIGUOUS' }));
  assert.equal((await Learning.recordObservation(store, observation)).ok, false);
  await store.set(Executor.commandKey(command.commandId), savedCommand);
  var corruptSaved = Object.assign({}, observation, { independentOfCreateResponse: false });
  await store.set(Observer.key(observation.observationId), corruptSaved);
  assert.equal((await Learning.recordObservation(store, corruptSaved)).ok, false);
  var preCommand = Object.assign({}, observation, { providerUpdatedAt: new Date(now - 1000).toISOString() });
  await store.set(Observer.key(observation.observationId), preCommand);
  assert.equal((await Learning.recordObservation(store, preCommand)).ok, false, 'provider snapshot predating command cannot train');
  await store.set(Observer.key(observation.observationId), observation);
  assert.deepEqual(await store.get(Learning.STATE_KEY), stateBeforeAdmission, 'refused evidence cannot write learning');
  var learned = await Learning.recordObservation(store, observation);
  assert.equal(learned.resolvedCount, 1);
  var laterObservation = await Observer.observe(store, command, { get: async function (id) { return { ok: true,
    record: { id: id, updatedAt: new Date(now + 4).toISOString(), properties: { lifecyclestage: 'customer' },
      propertiesWithHistory: { lifecyclestage: [{ value: 'lead' }, { value: 'customer' }] } } }; } });
  assert.notEqual(laterObservation.observationId, observation.observationId);
  assert.deepEqual(await store.get(Observer.key(observation.observationId)), observation);
  assert.deepEqual(await store.get(Observer.key(command.hubspotCompanyId)), laterObservation);
  assert.equal((await Learning.recordObservation(store, observation)).duplicate, true);
  assert.equal((await Learning.readForBrain(store)).resolvedCount, 1);
  var returned = await Decision.decide(store, candidate, now + 7, { cognition: cognition(now + 7) });
  assert.equal(returned.status, 'RELEASED');
  assert.equal(returned.returnedOutcome.status, 'OBSERVED');
  assert.equal(returned.returnedOutcome.signalOutcome, 'opportunity');
  assert.equal(returned.returnedOutcome.effect, 'CONSUMED_AS_INDUSTRY_AFFERENT');
  assert.notEqual(returned.decisionReceiptId, decision.decisionReceiptId, 'returned consequence must change the next decision receipt identity');

  var ambiguousStore = memory();
  var ambiguousCandidate = Decision.candidate(warnDeal({
    key: 'TX|AMBIGUOUS|2026-10-03', company: 'Ambiguous Co', state: 'TX'
  }), { identity: 'warn-ingest:2:1' });
  var ambiguousDecision = await Decision.decide(ambiguousStore, ambiguousCandidate, now, { cognition: cognition(now) });
  var ambiguousCalls = 0;
  var ambiguousProvider = {
    create: async function () {
      ambiguousCalls++;
      return { ok: false, providerCalled: true, ambiguous: true, error: 'timeout after dispatch' };
    }
  };
  var ambiguous = await Executor.execute({
    store: ambiguousStore,
    candidate: ambiguousCandidate,
    decision: ambiguousDecision,
    now: now + 4,
    motorAuthorization: motor,
    operationCostUsd: 0,
    dailyBudgetUsd: 0,
    dailyOperationCap: 2,
    provider: ambiguousProvider
  });
  assert.equal(ambiguous.status, 'AMBIGUOUS');
  var ambiguousReplay = await Executor.execute({
    store: ambiguousStore,
    candidate: ambiguousCandidate,
    decision: ambiguousDecision,
    now: now + 5,
    motorAuthorization: motor,
    operationCostUsd: 0,
    dailyBudgetUsd: 0,
    dailyOperationCap: 2,
    provider: ambiguousProvider
  });
  assert.equal(ambiguousReplay.replayed, true);
  assert.equal(ambiguousCalls, 1, 'an ambiguous create must never be blindly retried');

  var archives = 0;
  var recovery = await Recovery.recover({
    store: store,
    command: command,
    observation: observation,
    now: now + 6,
    motorAuthorization: motor,
    provider: {
      archive: async function () { archives++; return { ok: true, status: 204, providerCalled: true }; },
      get: async function (id, archived) {
        assert.equal(archived, true);
        return { ok: true, record: { id: id, archived: true } };
      }
    }
  });
  assert.equal(recovery.status, 'ARCHIVED_VERIFIED');
  assert.equal(recovery.independentArchivedReadback, true);
  assert.equal(archives, 1);

  var requests = [];
  var created = await Provider.create(candidate, {
    token: 'test-only-token',
    fetch: async function (url, options) {
      requests.push({ url: url, options: options });
      return {
        ok: true,
        status: 201,
        json: async function () {
          return { id: 'hs_adapter_1', properties: { lifecyclestage: 'lead' } };
        }
      };
    }
  });
  assert.equal(created.id, 'hs_adapter_1');
  assert.equal(requests[0].url, Provider.BASE);
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[0].options.headers.authorization, 'Bearer test-only-token');
  assert.equal(JSON.parse(requests[0].options.body).properties.name, candidate.company);
  assert.equal(JSON.parse(requests[0].options.body).properties.lifecyclestage, 'lead');

  var read = await Provider.get('hs_adapter_1', {
    token: 'test-only-token',
    fetch: async function (url, options) {
      requests.push({ url: url, options: options });
      return {
        ok: true,
        status: 200,
        json: async function () { return { id: 'hs_adapter_1' }; }
      };
    }
  }, false);
  assert.equal(read.ok, true);
  assert.match(requests[1].url, /propertiesWithHistory=lifecyclestage,annualrevenue/);
  assert.match(requests[1].url, /archived=false/);
  assert.equal(requests[1].options.method, 'GET');

  var archived = await Provider.archive('hs_adapter_1', {
    token: 'test-only-token',
    fetch: async function (url, options) {
      requests.push({ url: url, options: options });
      return { ok: true, status: 204 };
    }
  });
  assert.equal(archived.ok, true);
  assert.equal(requests[2].url, Provider.BASE + '/hs_adapter_1');
  assert.equal(requests[2].options.method, 'DELETE');

  await require('./assert-business-trace.cjs')(store, 'industry', command, 'CRM-ACCEPTED', now + 1000, 'industry_packet_1');
  // LOCAL/FIXTURE: exact accepted CRM commands and independent reads, no live HubSpot requests.
  var qualifiedStore = memory(), stageNumber = 0;
  for (var companyNumber = 0; companyNumber < 2; companyNumber++) {
    var proofCandidate = Decision.candidate(warnDeal({ key: 'LOCAL/FIXTURE:qualified:' + companyNumber,
      company: 'Identified fixture company ' + companyNumber }), { identity: 'LOCAL/FIXTURE:WARN:' + companyNumber });
    var proofDecision = await Decision.decide(qualifiedStore, proofCandidate, now, { cognition: cognition(now) });
    var proofCommand = await Executor.execute({ store: qualifiedStore, candidate: proofCandidate, decision: proofDecision,
      now: now + 2, motorAuthorization: motor, operationCostUsd: 0, dailyBudgetUsd: 0, dailyOperationCap: 2,
      provider: { create: async function () { return { ok: true, id: 'LOCAL-company-' + companyNumber, providerCalled: true }; } } });
    assert.equal(proofCommand.status, 'ACCEPTED');
    for (var stage of (companyNumber === 0 ? ['opportunity', 'customer', 'salesqualifiedlead'] : ['customer', 'opportunity'])) {
      var providerAt = new Date(now + 10 + stageNumber).toISOString();
      var proofObservation = await Observer.observe(qualifiedStore, proofCommand, { get: async function (id) { return { ok: true,
        record: { id: id, updatedAt: providerAt, properties: { lifecyclestage: stage },
          propertiesWithHistory: { lifecyclestage: [{ value: 'lead' }, { value: stage }] } } }; } });
      assert.equal((await Learning.recordObservation(qualifiedStore, proofObservation)).ok, true);
      stageNumber++;
    }
  }
  var storePath = require.resolve('../lib/autofire-efference-store.js');
  var handlerPath = require.resolve('../handlers/product-domain-learning-state.js');
  var previousStore = require.cache[storePath], previousHandler = require.cache[handlerPath];
  async function endpointRead(proofStore) {
    var readonly = Object.create(proofStore);
    ['set', 'setIfAbsent', 'lpush', 'ltrim', 'del'].forEach(function (method) { readonly[method] = async function () { throw Error('endpoint read wrote state'); }; });
    require.cache[storePath] = { id: storePath, filename: storePath, loaded: true, exports: readonly };
    delete require.cache[handlerPath];
    var result, response = { statusCode: 0, setHeader: function () {}, end: function (body) { result = JSON.parse(body); } };
    await require(handlerPath)({ method: 'GET', url: '/api/product-domain-learning-state?domain=industry' }, response);
    assert.equal(response.statusCode, 200); return result;
  }
  try {
    var qualifiedReadout = await endpointRead(qualifiedStore), emptyReadout = await endpointRead(memory());
    assert.equal(qualifiedReadout.resolvedCount, 5);
    assert.equal(qualifiedReadout.learningGate.ready, true);
    assert.equal((await Learning.readForBrain(qualifiedStore)).learningGate.distinctSources, 2);
    assert.equal(qualifiedReadout.signal.ownerDomain, 'industry');
    assert.equal(emptyReadout.resolvedCount, 0); assert.equal(emptyReadout.signal, null);
    var nativeCycle = require('./fixtures/publication-native-cycle.cjs');
    var qualifiedNative = await nativeCycle('industry', qualifiedReadout, now + 1000);
    var emptyNative = await nativeCycle('industry', emptyReadout, now + 1000);
    assert.equal(qualifiedNative.externalRewardEligible, false, 'existing K4 policy excludes this owner');
    assert.equal(qualifiedNative.plasticity.rewardActive, false);
    assert.deepEqual(qualifiedNative.evaluated, emptyNative.evaluated, 'retained outcome is not proof of changed native evaluation');
    assert.equal(emptyNative.plasticity.rewardActive, false);
    var gateControl = JSON.parse(JSON.stringify(qualifiedReadout)); gateControl.learningGate.ready = false;
    var gatedNative = await nativeCycle('industry', gateControl, now + 1000);
    assert.equal(gatedNative.plasticity.rewardActive, false);
    console.log('industry native return proof', JSON.stringify({ ownSignal: qualifiedNative.learning.signal.signalId,
      qualifiedReward: qualifiedNative.plasticity.rewardActive, noOutcomeReward: emptyNative.plasticity.rewardActive,
      gatedReward: gatedNative.plasticity.rewardActive, sameEvaluation: JSON.stringify(qualifiedNative.evaluated) === JSON.stringify(emptyNative.evaluated) }));
  } finally {
    if (previousStore) require.cache[storePath] = previousStore; else delete require.cache[storePath];
    if (previousHandler) require.cache[handlerPath] = previousHandler; else delete require.cache[handlerPath];
  }
  console.log('industry crm: ranked WARN queue, cost gate, B10/B14 create, no ambiguous retry, independent stage learning, verified archive, exact HubSpot adapter and business trace passed');
})().catch(function (error) {
  console.error(error);
  process.exit(1);
});
