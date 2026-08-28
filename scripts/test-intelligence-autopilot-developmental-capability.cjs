'use strict';
var assert = require('node:assert/strict');
var Decision = require('../lib/intelligence-autopilot-decision.js');
var Executor = require('../lib/intelligence-autopilot-executor.js');
var Observer = require('../lib/intelligence-autopilot-outcome-observer.js');
var Developmental = require('../lib/intelligence-autopilot-developmental-authority.js');
var Verifier = require('../lib/intelligence-autopilot-capability-verifier.js');
var Cap = require('../lib/product-domain-motor-capability.js');
var Motor = require('../lib/product-domain-motor-receipt.js');

function Store() { this.values = new Map(); this.lists = new Map(); this.writes = []; }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (k) { return this.values.has(k) ? structuredClone(this.values.get(k)) : null; };
Store.prototype.set = async function (k, v) { this.writes.push(k); this.values.set(k, structuredClone(v)); return true; };
Store.prototype.setIfAbsent = async function (k, v) { if (this.values.has(k)) return false; this.values.set(k, structuredClone(v)); return true; };
Store.prototype.lpush = async function (k, v) { var a = this.lists.get(k) || []; a.unshift(structuredClone(v)); this.lists.set(k, a); return a.length; };
Store.prototype.ltrim = async function (k, s, e) { this.lists.set(k, (this.lists.get(k) || []).slice(s, e + 1)); };
Store.prototype.lrange = async function (k, s, e) { return structuredClone((this.lists.get(k) || []).slice(s, e + 1)); };

function brain(now) { return { ts: now, c: { domain: 'intelligence', immune: { immuneState: 'clear' }, awareness: { humanReviewRequired: false },
  brainOrgans: { autonomousInternalEmission: { holdReason: null, emittedCount: 1 }, resourceMetabolism: { state: 'AVAILABLE', gates: { mayRunInternalCycle: true } } },
  serverPacket: { schemaVersion: 'civilization-domain-packet/1.0', domainId: 'intelligence', packetId: 'intelligence-packet', generatedAt: new Date(now).toISOString(),
    sourceIdentity: { producer: 'brain-cognition-refresh/1' }, truth: { feedHealth: { configured: 2, live: 2 } } } } }; }
function motor(now) { return { schemaVersion: Motor.SCHEMA, receiptId: 'pdmr_intelligence_bootstrap', productDomain: 'intelligence', ownerDomain: 'intelligence',
  contractId: 'intelligence-motor/1', lane: 'autopilot', status: 'HELD', contracts: { decision: 'bounded-command-decision/1', budget: 'intelligence-autopilot-budget/1',
    receipt: 'command-receipt', independentOutcome: 'independent-world-measurement', rollback: 'kill-and-compensate' },
  gates: { mayPrepare: true, maySimulate: true, mayDispatchExternal: false }, safety: { externalEffectExecuted: false, providerCalled: false, brokerTouched: false, spendUsd: 0 }, persistedAt: now }; }
function heldMotor() { return { authorize: async function () { return { authorized: false, reason: 'domain-motor-not-external-ready' }; } }; }

(async function () {
  var now = Date.now(), store = new Store(), email = 'autonomy-commissioning@limenhelix.com';
  await store.set(Motor.receiptKey('intelligence'), motor(now)); store.writes = [];
  var candidate = Decision.candidate({ leadId: 'commissioning-owned', email: email, domain: 'intelligence', consent: true },
    { kind: 'outreach', channel: 'email', transition: 'leads>appointments' }, { subject: 'LIMEN motor commissioning', body: 'Internal owned-destination commissioning.' });
  var decision = await Decision.decide(store, candidate, now, { cognition: { intelligence: brain(now) } });
  assert.equal(decision.status, 'RELEASED');
  var env = { INTELLIGENCE_AUTOPILOT_DEVELOPMENTAL_ENABLED: '1', INTELLIGENCE_AUTOPILOT_COMMISSIONING_EMAIL: email };
  var calls = 0, command = await Executor.execute({ store: store, candidate: candidate, decision: decision, now: now,
    emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailyEmailCap: 1, env: env, motorAuthorization: heldMotor(),
    transport: { send: async function () { calls++; return { ok: true, id: 'resend-owned-1', providerCalled: true }; } } });
  assert.equal(command.status, 'ACCEPTED'); assert.equal(command.commissioningOnly, true); assert.equal(command.businessStateTransitionSuppressed, true);
  assert.equal(command.futureSuppressionRecoveryVerified, true); assert.equal(calls, 1);
  var replay = await Executor.execute({ store: store, candidate: candidate, decision: decision, now: now + 1,
    emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailyEmailCap: 1, env: env, motorAuthorization: heldMotor(), transport: { send: async function () { calls++; } } });
  assert.equal(replay.status, 'HELD'); assert.equal(replay.reason, 'intelligence-autopilot-recipient-suppressed'); assert.equal(calls, 1);
  var observation = await Observer.observe(store, command, { apiKey: 'read', fetch: async function () { return { ok: true, status: 200,
    json: async function () { return { id: 'resend-owned-1', last_event: 'delivered', created_at: new Date(now).toISOString() }; } }; } });
  assert.equal(observation.independentOfSendResponse, true);
  var verified = await Verifier.verifyAndPersist(store, now + 2);
  assert.equal(verified.status, 'VERIFIED'); assert.equal(verified.persisted, true);
  assert.equal((await Cap.verifyPair(store, motor(now), now + 3)).ok, true);
  var other = Decision.candidate({ leadId: 'other', email: 'other@limenhelix.com', domain: 'intelligence', consent: true },
    { kind: 'outreach', channel: 'email', transition: 'leads>appointments' }, { subject: 'Other', body: 'Must not send.' });
  var otherDecision = await Decision.decide(store, other, now + 3, { cognition: { intelligence: brain(now + 3) } });
  var denied = await Developmental.authorize(store, other, otherDecision, env, now + 3);
  assert.equal(denied.authorized, false); assert.equal(denied.reason, 'intelligence-autopilot-developmental-owned-recipient-mismatch');
  console.log('intelligence owned-destination developmental commissioning and independent capability promotion: PASS');
})().catch(function (error) { console.error(error); process.exit(1); });
