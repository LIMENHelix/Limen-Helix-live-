'use strict';
var assert = require('node:assert/strict');
var Decision = require('../lib/religion-subscriber-decision.js');
var Executor = require('../lib/religion-subscriber-executor.js');
var Observer = require('../lib/religion-subscriber-outcome-observer.js');
var Recovery = require('../lib/religion-subscriber-recovery.js');
var Learning = require('../lib/religion-subscriber-learning.js');
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
function digest(key) { return { subject: 'Religion briefing', body: 'Source-grounded change.\n\nCheck any figure yourself: https://limenhelix.com/religion', key: key }; }
function budget() { return { emailCostUsd: 0.01, dailyBudgetUsd: 0.05, dailySendCap: 5 }; }

(async function () {
  var now = Date.now(), store = new Store(), c1 = Decision.candidate(sub('buyer@example.com'), digest('digest-1'));
  assert.equal(Decision.validateCandidate(c1), true);
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
  var learned = await Learning.recordObservation(store, observation); assert.equal(learned.ok, true); assert.equal(learned.resolvedCount, 1);
  var earlySignal = await Learning.readForBrain(store); assert.equal(earlySignal.learningGate.ready, false);
  for (var n = 2; n <= 5; n++) {
    var itemN = { actionId: 'religion-action-' + n, decisionReceiptId: 'decision-' + n, contentHash: 'content-' + n };
    await Learning.recordCommand(store, { commandId: 'command-' + n }, itemN);
    await Learning.recordObservation(store, { observationId: 'observation-' + n, actionId: itemN.actionId,
      providerEmailId: 'provider-' + n, lastEvent: 'delivered', observedAt: now + n });
  }
  var readySignal = await Learning.readForBrain(store); assert.equal(readySignal.learningGate.ready, true);
  assert.equal(readySignal.resolvedCount, 5); assert.equal(readySignal.signal.sourceKind, 'independent-action-outcome');
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
  console.log('religion subscriber sovereign B10/B14/delivery/recovery loop: PASS');
})().catch(function (error) { console.error(error); process.exitCode = 1; });
