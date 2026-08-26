#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
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
          updatedAt: '2026-08-26T01:00:00Z',
          properties: { lifecyclestage: 'opportunity', annualrevenue: '50000' },
          propertiesWithHistory: { lifecyclestage: [{ value: 'lead' }, { value: 'opportunity' }] }
        }
      };
    }
  });
  assert.equal(observation.status, 'STAGE_TRANSITION_OBSERVED');
  assert.equal(observation.independentOfCreateResponse, true);
  var learned = await Learning.recordObservation(store, observation);
  assert.equal(learned.resolvedCount, 1);

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

  console.log('industry crm: ranked WARN queue, cost gate, B10/B14 create, no ambiguous retry, independent stage learning, verified archive, and exact HubSpot adapter passed');
})().catch(function (error) {
  console.error(error);
  process.exit(1);
});
