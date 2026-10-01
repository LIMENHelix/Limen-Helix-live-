'use strict';
var assert = require('node:assert/strict');
var Policy = require('../lib/culture-hero-policy.js');
var Decision = require('../lib/culture-hero-decision.js');
var Executor = require('../lib/culture-hero-executor.js');
var Observer = require('../lib/culture-hero-outcome-observer.js');
var Recovery = require('../lib/culture-hero-recovery.js');
var Learning = require('../lib/culture-hero-learning.js');
var Trace = require('../lib/culture-business-trace-readout.js');

function Store() { this.values = new Map(); this.lists = new Map(); }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (k) { return this.values.has(k) ? structuredClone(this.values.get(k)) : null; };
Store.prototype.set = async function (k, v) { this.values.set(k, structuredClone(v)); return true; };
Store.prototype.setIfAbsent = async function (k, v) { if (this.values.has(k)) return false; this.values.set(k, structuredClone(v)); return true; };
Store.prototype.lpush = async function (k, v) { var a = this.lists.get(k) || []; a.unshift(structuredClone(v)); this.lists.set(k, a); return a.length; };
Store.prototype.ltrim = async function (k, s, e) { this.lists.set(k, (this.lists.get(k) || []).slice(s, e + 1)); return true; };
Store.prototype.lrange = async function (k, s, e) { return structuredClone((this.lists.get(k) || []).slice(s, e + 1)); };
function cognition(now) { return { ts: now, c: { domain: 'culture', immune: { immuneState: 'clear' }, awareness: { humanReviewRequired: false },
  brainOrgans: { autonomousInternalEmission: { holdReason: null }, resourceMetabolism: { state: 'AVAILABLE', gates: { mayRunInternalCycle: true } } },
  serverPacket: { schemaVersion: 'civilization-domain-packet/1.0', domainId: 'culture', packetId: 'culture-packet-1', generatedAt: new Date(now).toISOString(),
    sourceIdentity: { producer: 'brain-cognition-refresh/1' }, truth: { feedHealth: { configured: 16, live: 15 } } } } }; }
function motor(receipt) { return { authorize: async function () { return { authorized: true, receiptId: receipt, productDomain: 'culture', ownerDomain: 'culture', lane: 'hero-image' }; } }; }

(async function () {
  var now = Date.now(), candidate = Policy.candidate('culture', 'test-model', 'missing-public-hero');
  assert.equal(Policy.validate(candidate), true);
  assert.equal(Policy.validate(Object.assign({}, candidate, { prompt: 'arbitrary prompt' })), false);

  var store = new Store();
  var stale = await Decision.decide(store, candidate, now, { cognition: cognition(now - Decision.MAX_COGNITION_AGE_MS - 1) });
  assert.equal(stale.status, 'NO_ACTION');
  assert.equal(stale.providerCalled, false);
  var released = await Decision.decide(store, candidate, now, { cognition: cognition(now) });
  assert.equal(released.status, 'RELEASED');
  assert.equal(Decision.validateReceipt(released, candidate, now), true);

  var heldStore = new Store(), heldDecision = await Decision.decide(heldStore, candidate, now, { cognition: cognition(now) });
  var heldProviderCalls = 0;
  var motorHeld = await Executor.execute({ store: heldStore, candidate: candidate, decision: heldDecision, now: now,
    motorAuthorization: { authorize: async function () { return { authorized: false, reason: 'culture-switch-off', receiptId: 'held-motor' }; } },
    provider: { generate: async function () { heldProviderCalls++; } } });
  assert.equal(motorHeld.status, 'HELD'); assert.equal(heldProviderCalls, 0);

  var calls = 0, sawCommandBeforeCall = false;
  var executed = await Executor.execute({ store: store, candidate: candidate, decision: released, now: now,
    motorAuthorization: motor('culture-motor-1'), provider: { generate: async function () {
      calls++; sawCommandBeforeCall = Array.from(store.values.values()).some(function (v) { return v && v.status === 'DISPATCHING'; });
      return { ok: true, url: 'https://assets.example/culture.jpg', requestId: 'provider-1', spentUsd: 0.02 };
    } } });
  assert.equal(executed.status, 'GENERATED');
  assert.equal(executed.readbackVerified, true);
  assert.equal(sawCommandBeforeCall, true);
  assert(await store.get(Learning.causeKey(executed.commandId)));
  var replay = await Executor.execute({ store: store, candidate: candidate, decision: released, now: now,
    motorAuthorization: motor('culture-motor-1'), provider: { generate: async function () { calls++; } } });
  assert.equal(replay.replayed, true); assert.equal(calls, 1);

  var observed = await Observer.observe(store, executed, { allowAnyHttpsForTest: true, fetch: async function () { return {
    status: 200, headers: { get: function () { return 'image/jpeg'; } }, arrayBuffer: async function () { return Buffer.from('image-bytes'); }
  }; } });
  assert.equal(observed.status, 'OBSERVED_PRESENT');
  assert.equal(observed.independentReadPath, true);
  assert.equal(observed.generationEndpointCalled, false);
  assert.equal((await Learning.recordObservation(store, observed)).ok, true);
  assert.equal((await Learning.readForBrain(store)).status, 'ELIGIBLE');
  var reaffirmed = await Decision.decide(store, candidate, now + 1, { cognition: cognition(now + 1) });
  assert.equal(reaffirmed.status, 'RELEASED');
  assert.equal(reaffirmed.returnedOutcome.status, 'OBSERVED');
  assert.equal(reaffirmed.returnedOutcome.signalOutcome, 'PUBLIC_ASSET_RETRIEVABLE');
  assert.equal(reaffirmed.returnedOutcome.effect, 'CONSUMED_AS_CULTURE_AFFERENT');

  var invalidCandidate = Policy.candidate('culture', 'test-model', 'missing-public-hero-2');
  var invalidDecision = await Decision.decide(store, invalidCandidate, now + 2, { cognition: cognition(now + 2) });
  assert.equal(invalidDecision.status, 'RELEASED');
  var invalidGenerated = await Executor.execute({ store: store, candidate: invalidCandidate, decision: invalidDecision, now: now + 2,
    motorAuthorization: motor('culture-motor-4'), provider: { generate: async function () {
      return { ok: true, url: 'https://assets.example/culture-invalid.jpg', requestId: 'provider-invalid', spentUsd: 0.02 };
    } } });
  assert.equal(invalidGenerated.status, 'GENERATED');
  var invalidObserved = await Observer.observe(store, invalidGenerated, { allowAnyHttpsForTest: true, fetch: async function () { return {
    status: 404, headers: { get: function (name) { return name === 'content-type' ? 'text/plain' : null; } },
    arrayBuffer: async function () { return Buffer.from('not an image'); }
  }; } });
  assert.equal(invalidObserved.status, 'OBSERVED_ABSENT_OR_INVALID');
  assert.equal((await Learning.recordObservation(store, invalidObserved)).ok, true);
  var heldAfterNegative = await Decision.decide(store,
    Policy.candidate('culture', 'test-model', 'missing-public-hero-3'), now + 3, { cognition: cognition(now + 3) });
  assert.equal(heldAfterNegative.status, 'NO_ACTION');
  assert(heldAfterNegative.blockers.includes('culture-returned-outcome-requires-reassessment'));
  assert.equal(heldAfterNegative.returnedOutcome.signalOutcome, 'PUBLIC_ASSET_INVALID_OR_ABSENT');
  assert.equal(heldAfterNegative.returnedOutcome.effect, 'HOLD_FOR_NEW_CULTURE_EVIDENCE');

  var recovered = await Recovery.recover({ store: store, command: executed, observation: observed,
    trigger: { type: 'culture-policy', id: 'policy-event-1' }, motorAuthorization: motor('culture-motor-2'), now: now + 1,
    observePublicCatalog: async function () { return { ok: true, images: {} }; } });
  assert.equal(recovered.status, 'SUPPRESSED');
  assert.equal(recovered.strictSuppressionReadback, true);
  assert.equal(recovered.independentPublicAbsenceVerified, true);
  var catalog = await store.get(Recovery.CATALOG_KEY); assert.equal(catalog.culture.suppressed, true);

  var ambiguousStore = new Store();
  var decision2 = await Decision.decide(ambiguousStore, candidate, now, { cognition: cognition(now) });
  var ambiguousCalls = 0;
  var ambiguous = await Executor.execute({ store: ambiguousStore, candidate: candidate, decision: decision2, now: now,
    motorAuthorization: motor('culture-motor-3'), provider: { generate: async function () { ambiguousCalls++; throw new Error('response lost'); } } });
  assert.equal(ambiguous.status, 'AMBIGUOUS');
  var noRetry = await Executor.execute({ store: ambiguousStore, candidate: candidate, decision: decision2, now: now,
    motorAuthorization: motor('culture-motor-3'), provider: { generate: async function () { ambiguousCalls++; } } });
  assert.equal(noRetry.replayed, true); assert.equal(noRetry.status, 'AMBIGUOUS'); assert.equal(ambiguousCalls, 1);

  var beforeTrace = JSON.stringify([Array.from(store.values), Array.from(store.lists)]);
  var trace = await Trace.read(store, now + 10);
  assert.equal(trace.status, 'RECORDED');
  assert.equal(trace.decision.id, heldAfterNegative.decisionReceiptId);
  assert.equal(trace.decision.status, 'NO_ACTION');
  assert.equal(trace.command.id, invalidGenerated.commandId);
  assert.equal(trace.command.decisionId, invalidDecision.decisionReceiptId);
  assert.equal(trace.command.providerReceiptId, 'provider-invalid');
  assert.equal(trace.externalActionAuthorized, false);
  assert.equal(JSON.stringify([Array.from(store.values), Array.from(store.lists)]), beforeTrace, 'trace reader must not mutate any ledger');
  assert(!JSON.stringify(trace).includes('https://assets.example'), 'public projection excludes asset URLs');
  var ambiguousTrace = await Trace.read(ambiguousStore, now + 10);
  assert.equal(ambiguousTrace.command.status, 'AMBIGUOUS');
  assert.equal(ambiguousTrace.command.providerReceiptId, null);
  var emptyTrace = await Trace.read(new Store(), now + 10);
  assert.equal(emptyTrace.status, 'UNOBSERVED');
  var heldTrace = await Trace.read(heldStore, now + 10);
  assert.equal(heldTrace.decision.status, 'RELEASED');
  assert.equal(heldTrace.command, null, 'a released decision with held motor is not a command');
  var original = await store.get(Executor.commandKey(invalidGenerated.commandId));
  await store.set(Executor.commandKey(original.commandId), Object.assign({}, original, { ownerDomain: 'finance' }));
  var bad = await Trace.read(store, now + 10);
  assert.equal(bad.status, 'UNAVAILABLE'); assert.equal(bad.command, null); assert.equal(bad.decision, null);
  await store.set(Executor.commandKey(original.commandId), Object.assign({}, original, { decisionReceiptId: 'missing' }));
  assert.equal((await Trace.read(store, now + 10)).reason, 'command-decision-link-invalid');
  await store.set(Executor.commandKey(original.commandId), Object.assign({}, original, { promptHash: null }));
  assert.equal((await Trace.read(store, now + 10)).reason, 'command-readback-invalid');
  await store.set(Executor.commandKey(original.commandId), original);
  var originalCause = await store.get(Decision.key(original.decisionReceiptId));
  await store.set(Decision.key(original.decisionReceiptId), Object.assign({}, originalCause, { expiresAt: original.commandedAt }));
  assert.equal((await Trace.read(store, now + 10)).reason, 'command-decision-link-invalid');
  await store.set(Decision.key(original.decisionReceiptId), originalCause);
  assert.equal((await Trace.read(store, now + 10)).status, 'RECORDED');
  var pendingOnly = new Store();
  await pendingOnly.set(Decision.key(released.decisionReceiptId), released);
  var dispatching = Object.assign({}, executed, { status: 'DISPATCHING', providerAccepted: false, receipt: null });
  await pendingOnly.set(Executor.commandKey(dispatching.commandId), dispatching);
  await pendingOnly.lpush(Executor.PENDING_LOG_KEY, dispatching);
  assert.equal((await Trace.read(pendingOnly, now + 10)).command.status, 'DISPATCHING');
  assert.equal((await Trace.read(store, now - 1)).status, 'UNAVAILABLE', 'future-dated records cannot be presented as proof');
  console.log('culture hero sovereign B10/B14/observer/recovery loop and read-only business trace: PASS');
})().catch(function (error) { console.error(error); process.exitCode = 1; });
