'use strict';
var fs = require('node:fs');
var assert = require('node:assert/strict'), Decision = require('../lib/intelligence-autopilot-decision.js'), Executor = require('../lib/intelligence-autopilot-executor.js'), Observer = require('../lib/intelligence-autopilot-outcome-observer.js'), Recovery = require('../lib/intelligence-autopilot-recovery.js'), Learning = require('../lib/intelligence-autopilot-learning.js'), Autopilot = require('../handlers/autopilot.js');
function Store() { this.values = new Map(); this.lists = new Map(); } Store.prototype.assertDurable = function () { return true; }; Store.prototype.get = async function (k) { return this.values.has(k) ? structuredClone(this.values.get(k)) : null; }; Store.prototype.set = async function (k, v) { this.values.set(k, structuredClone(v)); return true; }; Store.prototype.setIfAbsent = async function (k, v) { if (this.values.has(k)) return false; this.values.set(k, structuredClone(v)); return true; }; Store.prototype.lpush = async function (k, v) { var a = this.lists.get(k) || []; a.unshift(structuredClone(v)); this.lists.set(k, a); return a.length; }; Store.prototype.ltrim = async function (k, s, e) { this.lists.set(k, (this.lists.get(k) || []).slice(s, e + 1)); };
Store.prototype.lrange = async function (key, start, stop) { return structuredClone((this.lists.get(key) || []).slice(start, stop + 1)); };
function brain(domain, now, review) { return { ts: now, c: { domain: domain, immune: { immuneState: 'clear' }, awareness: { humanReviewRequired: !!review }, brainOrgans: { autonomousInternalEmission: { holdReason: null, emittedCount: 1 }, resourceMetabolism: { state: 'AVAILABLE', gates: { mayRunInternalCycle: true } } }, serverPacket: { schemaVersion: 'civilization-domain-packet/1.0', domainId: domain, packetId: domain + '-packet-' + review, generatedAt: new Date(now).toISOString(), sourceIdentity: { producer: 'brain-cognition-refresh/1' }, truth: { feedHealth: { configured: 10, live: 10 } } } } }; }
function motor(id) { return { authorize: async function () { return { authorized: true, receiptId: id }; } }; }
(async function () { var store = new Store(), now = Date.now(), cognition = { intelligence: brain('intelligence', now, false), energy: brain('energy', now, false) };
  var action = { kind: 'outreach', channel: 'email', transition: 'leads>appointments' }, mail = { subject: 'Quick note', body: 'Source-grounded business message.' };
  assert.equal(Autopilot.domainGate({ domain: 'intelligence', consent: true }).allow, true);
  assert.equal(Autopilot.domainGate({ domain: 'energy', consent: true }).reason, 'owning-domain-autonomous-outreach-not-commissioned');
  assert.equal(Autopilot.domainGate({ domain: 'intelligence', consent: false }).reason, 'explicit-contact-consent-required');
  var commissioningAction = Autopilot.nextAction({ rung: 'commissioning', domain: 'intelligence', consent: true, status: 'new' }, [], [], now);
  assert.equal(commissioningAction.kind, 'commissioning'); assert.equal(commissioningAction.autoExecutable, true);
  assert.match(Autopilot.emailFor(commissioningAction, {}).body, /No prospect outreach/);
  assert.equal(Decision.candidate({ leadId: 'no-consent', email: 'lead@example.com', domain: 'intelligence' }, action, mail), null);
  assert.equal(Decision.candidate({ leadId: 'wrong-owner', email: 'lead@example.com', domain: 'energy', consent: true }, action, mail), null);
  var state = { leadId: 'lead-secret', email: 'lead@example.com', domain: 'intelligence', consent: true };
  var candidate = Decision.candidate(state, action, mail), brainEntry = cognition.intelligence;
  // LOCAL proof: the existing source-valid candidate stays represented on every immune route.
  var routeStore = new Store(), candidateBefore = JSON.stringify(candidate);
  for (var routeCase of [
    ['PASS', { immuneState: 'clear' }],
    ['HOLD', { immuneState: 'clear', quarantines: ['unresolved-domain-evidence'] }],
    ['QUARANTINE', { immuneState: 'alert', candidateScoped: true, integrityThreat: true }],
    ['REJECT', null]
  ]) {
    var routeBrain = JSON.parse(JSON.stringify(brainEntry)); routeBrain.c.immune = routeCase[1];
    var routed = await Decision.decide(routeStore, candidate, now, { cognition: { intelligence: routeBrain } });
    assert.equal(routed.immuneRouting.route, routeCase[0]);
    assert.equal(routed.immuneRouting.candidatePreserved, true);
    var readonlyRouteStore = Object.create(routeStore);
    ['set', 'setIfAbsent', 'lpush', 'ltrim', 'del'].forEach(function (method) {
      readonlyRouteStore[method] = async function () { throw Error('route read attempted write'); };
    });
    readonlyRouteStore.lrange = async function (key, start, end) {
      return key === Decision.LOG_KEY ? [routed] : routeStore.lrange(key, start, end);
    };
    var routeTrace = await require('../lib/product-domain-business-trace-readout.js').read(readonlyRouteStore, 'intelligence', now);
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
        return url.includes('brain-cognition') ? { cognition: { 'intelligence': { ts: now, c: { businessTrace: routeTrace } } } } : {};
      } }; }
    });
    await routeWindow.LIMENExecutionObservatory.refresh();
    assert(routeElement.innerHTML.includes(routed.decisionReceiptId));
    assert(routeElement.innerHTML.includes(routeCase[0]));
    assert.equal(routed.status, routeCase[0] === 'PASS' ? 'RELEASED' : 'NO_ACTION');
    assert.equal(Decision.validateReceipt(routed, candidate, now), routeCase[0] === 'PASS');
    assert.deepEqual(await routeStore.get(Decision.key(routed.decisionReceiptId)), routed);
    assert.deepEqual(await Decision.decide(routeStore, candidate, now, { cognition: { intelligence: routeBrain } }), routed, 'immutable route replay');
    if (routeCase[0] !== 'PASS') {
      var reconsidered = await Decision.decide(routeStore, candidate, now + 1, { cognition: { intelligence: brainEntry } });
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
  var legacy = await Decision.decide(new Store(), candidate, now, { cognition: { intelligence: brainEntry } });
  delete legacy.immuneRouting;
  assert.equal(Decision.validateReceipt(legacy, candidate, now), false, 'unclassified release cannot authorize publication');

  var decision = await Decision.decide(store, candidate, now, { cognition: cognition }); assert.equal(decision.status, 'RELEASED');
  var noCost = await Executor.execute({ store: store, candidate: candidate, decision: decision, now: now, emailCostUsd: null, dailyEmailCap: 1 }); assert.equal(noCost.status, 'HELD'); assert.equal(noCost.reason, 'intelligence-autopilot-email-cost-not-configured');
  var calls = 0, saw = false, command = await Executor.execute({ store: store, candidate: candidate, decision: decision, now: now, emailCostUsd: 0.01, dailyBudgetUsd: 0.05, dailyEmailCap: 5, motorAuthorization: motor('intel-motor-1'), transport: { send: async function (_e, _s, _b, options) { calls++; saw = Array.from(store.values.values()).some(function (v) { return v && v.status === 'DISPATCHING' && v.commandId; }); assert.equal(options.idempotencyKey, 'intelligence-autopilot/' + decision.actionId); return { ok: true, id: 'email-intel-1', providerCalled: true }; } } });
  assert.equal(command.status, 'ACCEPTED'); assert.equal(calls, 1); assert.equal(saw, true); var replay = await Executor.execute({ store: store, candidate: candidate, decision: decision, now: now, emailCostUsd: 0.01, dailyBudgetUsd: 0.05, dailyEmailCap: 5, motorAuthorization: motor('intel-motor-2'), transport: { send: async function () { calls++; } } }); assert.equal(replay.replayed, true); assert.equal(calls, 1);
  var observation = await Observer.observe(store, command, { apiKey: 'read', fetch: async function (_u, options) { assert.equal(options.method, 'GET'); return { ok: true, status: 200, json: async function () { return { id: 'email-intel-1', last_event: 'bounced', created_at: new Date(now).toISOString() }; } }; } }); assert.equal(observation.independentOfSendResponse, true);
  var learned = await Learning.recordObservation(store, observation); assert.equal(learned.ok, true); assert.equal(learned.resolvedCount, 1); assert.equal((await Learning.readForBrain(store)).learningGate.ready, false);
  var returned = await Decision.decide(store, candidate, now + 1, { cognition: cognition });
  assert.equal(returned.status, 'NO_ACTION');
  assert(returned.blockers.includes('intelligence-returned-outcome-requires-reassessment'));
  assert.equal(returned.returnedOutcome.status, 'OBSERVED');
  assert.equal(returned.returnedOutcome.signalOutcome, 'bounced');
  assert.equal(returned.returnedOutcome.normalizedCredit, 0);
  assert.equal(returned.returnedOutcome.requiresReassessment, true);
  assert.equal(returned.returnedOutcome.effect, 'CONSUMED_AS_INTELLIGENCE_AFFERENT');
  assert.notEqual(returned.decisionReceiptId, decision.decisionReceiptId, 'returned consequence must change the next decision receipt identity');
  var recovery = await Recovery.recover({ store: store, command: command, observation: observation, now: now + 1, motorAuthorization: motor('intel-motor-3') }); assert.equal(recovery.status, 'FUTURE_DELIVERY_SUPPRESSED');
  var persisted = JSON.stringify(Array.from(store.values.values()).concat(Array.from(store.lists.values()))); assert.equal(persisted.includes('lead@example.com'), false); assert.equal(persisted.includes('lead-secret'), false);
  await require('./assert-business-trace.cjs')(store, 'intelligence', command, 'EMAIL-ACCEPTED', now + 1000, 'intelligence-packet-false');
  console.log('intelligence sovereign B10/B14/email outcome/recovery loop and business trace: PASS');
})().catch(function (error) { console.error(error); process.exitCode = 1; });
