'use strict';
var assert = require('node:assert/strict'); var Decision = require('../lib/law-automail-decision.js');
var Executor = require('../lib/law-automail-executor.js'); var Observer = require('../lib/law-automail-outcome-observer.js'); var Recovery = require('../lib/law-automail-recovery.js');
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
  var replay = await Executor.execute({ store: store, candidate: candidate, decision: decision, now: now, letterCostUsd: 1, dailyBudgetUsd: 2, dailyLetterCap: 2,
    motorAuthorization: motor('law-motor-2'), provider: { create: async function () { calls++; } } });
  assert.equal(replay.replayed, true); assert.equal(calls, 1);
  var observation = await Observer.observe(store, command, { apiKey: 'read-key', fetch: async function (_url, options) { assert.equal(options.method, 'GET');
    return { ok: true, status: 200, json: async function () { return { id: 'ltr_abc123', status: 'rendered', expected_delivery_date: '2026-09-01', date_created: new Date(now).toISOString(), date_modified: new Date(now).toISOString() }; } }; } });
  assert.equal(observation.status, 'PROVIDER_STATE_OBSERVED'); assert.equal(observation.independentOfCreateResponse, true);
  var canceled = 0, reads = 0, recovery = await Recovery.recover({ store: store, command: command, observation: observation,
    trigger: { type: 'law-automail-cancel', id: 'operator-cancel-1' }, now: now + 1, motorAuthorization: motor('law-motor-3'),
    provider: { cancel: async function (id) { canceled++; assert.equal(id, 'ltr_abc123'); return { ok: true, deleted: true }; },
      read: async function () { reads++; return { ok: true, deleted: true }; } } });
  assert.equal(recovery.status, 'CANCELED_VERIFIED'); assert.equal(canceled, 1); assert.equal(reads, 1);
  var persisted = JSON.stringify(Array.from(store.values.values()).concat(Array.from(store.lists.values())));
  assert.equal(persisted.includes('123 Private St'), false); assert.equal(persisted.includes('Private Owner'), false); assert.equal(persisted.includes('parcel-secret'), false);
  console.log('law sovereign B10/B14/Lob observation/cancel loop: PASS');
})().catch(function (error) { console.error(error); process.exitCode = 1; });
