#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var Decision = require('../lib/population-real-estate-decision.js');
var Executor = require('../lib/population-real-estate-executor.js');
var Observer = require('../lib/population-real-estate-observer.js');
var Recovery = require('../lib/population-real-estate-recovery.js');
var Learning = require('../lib/population-real-estate-learning.js');
var InboundHandler = require('../handlers/population-real-estate-inbound.js');
var Cycle = require('../handlers/population-real-estate-cycle.js');
var Webhook = require('svix').Webhook;

function memoryStore() {
  var data = new Map(), lists = new Map();
  return { assertDurable: function () { return true; },
    get: async function (key) { return data.has(key) ? JSON.parse(JSON.stringify(data.get(key))) : null; },
    set: async function (key, value) { data.set(key, JSON.parse(JSON.stringify(value))); return true; },
    setIfAbsent: async function (key, value) { if (data.has(key)) return false; data.set(key, JSON.parse(JSON.stringify(value))); return true; },
    del: async function (key) { return data.delete(key) ? 1 : 0; },
    lpush: async function (key, value) { var list = lists.get(key) || []; list.unshift(JSON.parse(JSON.stringify(value))); lists.set(key, list); return list.length; },
    ltrim: async function (key, start, stop) { lists.set(key, (lists.get(key) || []).slice(start, stop + 1)); return true; },
    lrange: async function (key, start, stop) { return JSON.parse(JSON.stringify((lists.get(key) || []).slice(start, stop + 1))); }
  };
}
function invoke(handler, raw, headers) { return new Promise(function (resolve) { var response = { statusCode: 0, headers: {}, setHeader: function (key, value) { this.headers[key] = value; }, end: function (body) { resolve({ status: this.statusCode, body: JSON.parse(body) }); } }; handler({ method: 'POST', body: raw, headers: headers || {} }, response); }); }

(async function () {
  var store = memoryStore(), now = Date.now();
  var cognition = { ts: now, c: { domain: 'population', immune: { immuneState: 'clear' }, awareness: { humanReviewRequired: false },
    brainOrgans: { autonomousInternalEmission: { holdReason: null, emittedCount: 1 }, resourceMetabolism: { state: 'AVAILABLE', gates: { mayRunInternalCycle: true } } },
    serverPacket: { schemaVersion: 'civilization-domain-packet/1.0', domainId: 'population', packetId: 'population_packet_1', generatedAt: new Date(now).toISOString(), sourceIdentity: { producer: 'brain-cognition-refresh/1' }, truth: { feedHealth: { live: 8 }, opportunities: [
      { id: 'population-housing-001', title: 'Review a residential housing listing', path: 'RESEARCHABLE', held: false }
    ] } } } };
  var candidate = Decision.candidate({ inquiryId: 'population-housing-inquiry-001', counterpartyEmail: 'broker@example.com',
    propertyRef: 'housing-property-alpha', transactionIntent: 'non-binding-letter-of-interest',
    listingUrl: 'https://example.com/listings/housing-property-alpha', indicationPriceUsd: 175000,
    brainOpportunityId: 'population-housing-001', subject: 'Non-binding interest in housing property alpha',
    body: 'Please confirm availability and provide the disclosures and diligence package for the referenced property.',
    evidenceId: 'population-housing-listing-evidence-001', nonBinding: true, contractAuthorized: false,
    earnestMoneyAuthorized: false, fundsTransferAuthorized: false });
  assert(candidate); assert.equal(Decision.validateCandidate(candidate), true);
  var brain = cognition;
  // LOCAL proof: the existing source-valid candidate stays represented on every immune route.
  var routeStore = memoryStore(), candidateBefore = JSON.stringify(candidate);
  for (var routeCase of [
    ['PASS', { immuneState: 'clear' }],
    ['HOLD', { immuneState: 'clear', quarantines: ['unresolved-domain-evidence'] }],
    ['QUARANTINE', { immuneState: 'alert', candidateScoped: true, integrityThreat: true }],
    ['REJECT', null]
  ]) {
    var routeBrain = JSON.parse(JSON.stringify(brain)); routeBrain.c.immune = routeCase[1];
    var routed = await Decision.decide(routeStore, candidate, now, { cognition: routeBrain, maxIndicationUsd: 200000 });
    assert.equal(routed.immuneRouting.route, routeCase[0]);
    assert.equal(routed.immuneRouting.candidatePreserved, true);
    var readonlyRouteStore = Object.create(routeStore);
    ['set', 'setIfAbsent', 'lpush', 'ltrim', 'del'].forEach(function (method) {
      readonlyRouteStore[method] = async function () { throw Error('route read attempted write'); };
    });
    readonlyRouteStore.lrange = async function (key, start, end) {
      return key === Decision.LOG_KEY ? [routed] : routeStore.lrange(key, start, end);
    };
    var routeTrace = await require('../lib/product-domain-business-trace-readout.js').read(readonlyRouteStore, 'population', now);
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
        return url.includes('brain-cognition') ? { cognition: { 'population': { ts: now, c: { businessTrace: routeTrace } } } } : {};
      } }; }
    });
    await routeWindow.LIMENExecutionObservatory.refresh();
    assert(routeElement.innerHTML.includes(routed.decisionReceiptId));
    assert(routeElement.innerHTML.includes(routeCase[0]));
    assert.equal(routed.status, routeCase[0] === 'PASS' ? 'RELEASED' : 'NO_ACTION');
    assert.equal(Decision.validateReceipt(routed, candidate, now), routeCase[0] === 'PASS');
    assert.deepEqual(await routeStore.get(Decision.key(routed.decisionReceiptId)), routed);
    assert.deepEqual(await Decision.decide(routeStore, candidate, now, { cognition: routeBrain, maxIndicationUsd: 200000 }), routed, 'immutable route replay');
    if (routeCase[0] !== 'PASS') {
      var reconsidered = await Decision.decide(routeStore, candidate, now + 1, { cognition: brain, maxIndicationUsd: 200000 });
      assert.equal(reconsidered.immuneRouting.route, 'PASS');
      assert.notEqual(reconsidered.decisionReceiptId, routed.decisionReceiptId);
      assert.deepEqual(await routeStore.get(Decision.key(routed.decisionReceiptId)), routed, 'reconsideration preserves prior route');
      var refused = await Executor.execute({ store: routeStore, candidate: candidate, decision: routed, now: now + 1,
        motorAuthorization: { authorize: async function () { throw new Error('non-PASS must never reach motor'); } },
        emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailyRequestCap: 1 });
      assert.equal(refused.reason, 'population-real-estate-exact-b10-decision-required');
      assert.equal(refused.providerCalls, 0);
    }
  }
  assert.equal((await routeStore.lrange(Decision.LOG_KEY, 0, 99)).length, 4);
  assert.equal(JSON.stringify(candidate), candidateBefore);
  var legacy = await Decision.decide(memoryStore(), candidate, now, { cognition: brain, maxIndicationUsd: 200000 });
  delete legacy.immuneRouting;
  assert.equal(Decision.validateReceipt(legacy, candidate, now), false, 'unclassified release cannot authorize an inquiry');

  var oldReceivingDomain = process.env.POPULATION_REAL_ESTATE_RECEIVING_DOMAIN;
  process.env.POPULATION_REAL_ESTATE_RECEIVING_DOMAIN = 'receive.example.com';
  var outboundPayload;
  var sendProof = await Cycle.send(candidate, 'pra_' + 'a'.repeat(24), 'population-real-estate/send-proof', {
    apiKey: 'test-key', from: 'LIMEN <sender@example.com>', fetch: async function (_url, options) {
      outboundPayload = JSON.parse(options.body); return { ok: true, status: 200, json: async function () { return { id: 'email_proof_1' }; } };
    }
  });
  if (oldReceivingDomain == null) delete process.env.POPULATION_REAL_ESTATE_RECEIVING_DOMAIN; else process.env.POPULATION_REAL_ESTATE_RECEIVING_DOMAIN = oldReceivingDomain;
  assert.equal(sendProof.ok, true); assert.match(outboundPayload.text, /non-binding expression of interest only/i);
  assert.match(outboundPayload.text, /not an offer capable of acceptance/i); assert.match(outboundPayload.text, /requires separate human-approved contracts and financing/i);
  var invalid = Decision.candidate({ inquiryId: 'x' }); assert.equal(invalid, null);
  var noCap = await Decision.decide(memoryStore(), candidate, now, { cognition: cognition });
  assert(noCap.blockers.includes('population-real-estate-indication-cap-not-configured'));
  var overCap = await Decision.decide(memoryStore(), candidate, now, { cognition: cognition, maxIndicationUsd: 100000 });
  assert(overCap.blockers.includes('population-real-estate-indication-exceeds-cap'));
  var heldBrain = JSON.parse(JSON.stringify(cognition)); heldBrain.c.serverPacket.truth.opportunities[0].held = true;
  var heldSelection = await Decision.decide(memoryStore(), candidate, now, { cognition: heldBrain, maxIndicationUsd: 200000 });
  assert(heldSelection.blockers.includes('population-exact-brain-opportunity-not-selected'));
  var decision = await Decision.decide(store, candidate, now, { cognition: cognition, maxIndicationUsd: 200000 });
  assert.equal(decision.status, 'RELEASED'); assert.equal(decision.providerCalled, false);
  var motorCount = 0, motor = { authorize: async function () { motorCount++; return { authorized: true, receiptId: 'population_motor_' + motorCount }; } };
  var calls = 0, command = await Executor.execute({ store: store, candidate: candidate, decision: decision, now: now + 1, motorAuthorization: motor,
    emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailyRequestCap: 2,
    transport: { send: async function (value, actionId, idempotencyKey) { calls++; assert.equal(value.inquiryId, 'population-housing-inquiry-001'); assert.match(actionId, /^pra_/); assert.equal(idempotencyKey, 'population-real-estate/' + actionId); return { ok: true, id: 'email_out_1', providerCalled: true, replyAddressHash: 'reply_hash' }; } } });
  assert.equal(command.status, 'INQUIRY_ACCEPTED'); assert.equal(command.readbackVerified, true); assert.equal(calls, 1);
  assert.equal(command.nonBinding, true); assert.equal(command.contractAuthorized, false);
  assert.equal(command.earnestMoneyAuthorized, false); assert.equal(command.fundsTransferAuthorized, false);
  var replay = await Executor.execute({ store: store, candidate: candidate, decision: decision, now: now + 2, motorAuthorization: motor, emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailyRequestCap: 2, transport: { send: async function () { calls++; } } });
  assert.equal(replay.replayed, true); assert.equal(calls, 1);
  var unsafeWrites = 0, unsafeStore = Object.create(store);
  ['set', 'setIfAbsent', 'lpush', 'ltrim', 'del'].forEach(function (name) {
    unsafeStore[name] = async function () { unsafeWrites++; throw Error('invalid admission attempted write'); };
  });
  var unsaved = await Learning.recordObservation(unsafeStore, { status: 'COUNTERPARTY_RESPONSE_OBSERVED',
    observationId: 'LOCAL-NOT-SAVED', actionId: command.actionId, commandId: command.commandId,
    providerInboundEmailId: 'LOCAL-NOT-VERIFIED', observedAt: Date.now() });
  assert.equal(unsaved.ok, false); assert.equal(unsaved.reason, 'population-real-estate-observation-causal-join-invalid');
  assert.equal(unsafeWrites, 0);
  var event = { type: 'email.received', created_at: new Date().toISOString(), data: { email_id: 'email_in_1', from: 'broker@example.com', to: ['population-realestate+' + command.actionId + '@receive.example.com'] } };
  var observation = await Observer.record(store, event, { webhookSignatureVerified: true });
  assert.equal(observation.status, 'COUNTERPARTY_RESPONSE_OBSERVED'); assert.equal(observation.independentOfSendResponse, true); assert.equal(observation.webhookSignatureVerified, true);
  var unverifiedObservation = await Observer.record(unsafeStore, event);
  assert.equal(unverifiedObservation.reason, 'verified-webhook-context-required'); assert.equal(unsafeWrites, 0);
  for (var badEvent of [
    Object.assign({}, event, { created_at: new Date(command.commandedAt - 1).toISOString() }),
    Object.assign({}, event, { created_at: new Date(Date.now() + 60000).toISOString() }),
    Object.assign({}, event, { created_at: null }),
    Object.assign({}, event, { data: Object.assign({}, event.data, { from: 'foreign@example.invalid' }) })
  ]) {
    assert.equal((await Observer.record(unsafeStore, badEvent, { webhookSignatureVerified: true })).ok, false);
    assert.equal(unsafeWrites, 0);
  }
  var observerReplay = await Observer.record(store, event, { webhookSignatureVerified: true });
  assert.equal(observerReplay.duplicate, true); assert.equal(observerReplay.observedAt, observation.observedAt);
  assert.equal((await store.lrange(Observer.LOG_KEY, 0, 99)).length, 1);
  var permanent = await store.get(Observer.key(observation.providerInboundEmailId));
  for (var changes of [
    { commandId: 'foreign-command' }, { actionId: 'foreign-action' }, { propertyRefHash: 'wrong-property' },
    { listingUrlHash: 'wrong-listing' }, { counterpartyEmailHash: 'wrong-sender' }, { indicationPriceUsd: 1 },
    { independentOfSendResponse: false }, { webhookSignatureVerified: false }, { sendEndpointCalled: true },
    { sourceEventType: 'email.sent' }, { observedAt: command.commandedAt - 1 }, { observedAt: Date.now() + 60000 },
    { sourceEventCreatedAt: new Date(command.commandedAt - 1).toISOString() },
    { sourceEventCreatedAt: new Date(Date.now() + 60000).toISOString() }, { liveMoney: true },
    { schemaVersion: 'foreign-observation/1' }, { observationId: 'wrong-identity' }
  ]) {
    var corrupt = Object.assign({}, permanent, changes);
    await store.set(Observer.key(observation.providerInboundEmailId), corrupt);
    var rejected = await Learning.recordObservation(unsafeStore, corrupt);
    assert.equal(rejected.ok, false, JSON.stringify(changes)); assert.equal(unsafeWrites, 0);
  }
  await store.set(Observer.key(observation.providerInboundEmailId), permanent);
  for (var commandChanges of [{ status: 'AMBIGUOUS' }, { ownerDomain: 'infrastructure' }, { contentHash: 'changed-content' },
    { readbackVerified: false }, { fundsTransferAuthorized: true }, { providerEmailId: 'wrong-outbound-email' }]) {
    await store.set(Executor.commandKey(command.commandId), Object.assign({}, command, commandChanges));
    assert.equal((await Learning.recordObservation(unsafeStore, observation)).ok, false);
    assert.equal(unsafeWrites, 0);
  }
  await store.set(Executor.commandKey(command.commandId), command);
  var corruptReadbackStore = Object.create(store);
  corruptReadbackStore.get = async function (key) {
    var value = await store.get(key);
    return key === Observer.key(observation.providerInboundEmailId) ? Object.assign({}, value, { propertyRefHash: 'corrupt-readback' }) : value;
  };
  await assert.rejects(Observer.record(corruptReadbackStore, event, { webhookSignatureVerified: true }), /readback invalid/);
  var learned = await Learning.recordObservation(store, observation); assert.equal(learned.ok, true); assert.equal(learned.resolvedCount, 1);
  assert.equal((await Learning.recordObservation(store, observerReplay)).duplicate, true);
  assert.equal((await Learning.readForBrain(store)).resolvedCount, 1);
  assert.equal(learned.signal.normalizedCredit, 0, 'an unclassified reply cannot be treated as a positive real-estate outcome');
  var returned = await Decision.decide(store, candidate, now + 1500, { cognition: cognition, maxIndicationUsd: 200000 });
  assert.equal(returned.status, 'RELEASED');
  assert.equal(returned.returnedOutcome.status, 'OBSERVED');
  assert.equal(returned.returnedOutcome.signalOutcome, 'counterparty-response-unclassified');
  assert.equal(returned.returnedOutcome.normalizedCredit, 0);
  assert.equal(returned.returnedOutcome.requiresReassessment, true);
  assert.equal(returned.returnedOutcome.effect, 'CONSUMED_AS_POPULATION_AFFERENT');
  assert.notEqual(returned.decisionReceiptId, decision.decisionReceiptId, 'returned consequence must change the next decision receipt identity');
  var secret = 'whsec_' + Buffer.from('population-real-estate-webhook-test-secret').toString('base64');
  var webhook = new Webhook(secret), stamp = new Date(), messageId = 'msg_population_1';
  var signedEvent = { type: 'email.received', created_at: stamp.toISOString(), data: { email_id: 'email_in_2', from: 'broker@example.com', to: ['population-realestate+' + command.actionId + '@receive.example.com'] } };
  var raw = JSON.stringify(signedEvent), signature = webhook.sign(messageId, stamp, raw);
  var inbound = InboundHandler.createHandler({ store: store, secret: secret });
  var verified = await invoke(inbound, raw, { 'svix-id': messageId, 'svix-timestamp': String(Math.floor(stamp.getTime() / 1000)), 'svix-signature': signature });
  assert.equal(verified.status, 200); assert.equal(verified.body.status, 'COUNTERPARTY_RESPONSE_OBSERVED'); assert.equal(verified.body.sendEndpointCalled, false); assert.equal(verified.body.learned, true);
  assert.equal((await store.get(Observer.key(observation.providerInboundEmailId))).observationId, observation.observationId);
  assert.equal((await Learning.recordObservation(store, observation)).duplicate, true);
  assert.equal((await Learning.readForBrain(store)).resolvedCount, 2);
  var verifiedReplay = await invoke(inbound, raw, { 'svix-id': messageId, 'svix-timestamp': String(Math.floor(stamp.getTime() / 1000)), 'svix-signature': signature });
  assert.equal(verifiedReplay.status, 200); assert.equal(verifiedReplay.body.duplicate, true); assert.equal(verifiedReplay.body.learned, false);
  assert.equal((await Learning.readForBrain(store)).resolvedCount, 2);
  var forged = await invoke(inbound, raw, { 'svix-id': messageId, 'svix-timestamp': String(Math.floor(stamp.getTime() / 1000)), 'svix-signature': 'v1,forged' });
  assert.equal(forged.status, 400); assert.equal(forged.body.error, 'invalid webhook signature');
  var learningState = await Learning.readForBrain(store); assert.equal(learningState.status, 'ELIGIBLE'); assert.equal(learningState.learningGate.ready, false);
  var recovery = await Recovery.recover({ store: store, command: command, observation: observation, now: now + 2000, motorAuthorization: motor });
  assert.equal(recovery.status, 'FUTURE_INQUIRIES_SUPPRESSED'); assert.equal(recovery.strictSuppressionReadback, true); assert.equal(recovery.irreversiblePriorInquiry, true);
  var held = await Executor.execute({ store: store, candidate: candidate, decision: decision, now: now + 3, motorAuthorization: motor, emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailyRequestCap: 2, transport: { send: async function () { calls++; } } });
  assert.equal(held.reason, 'population-real-estate-counterparty-property-suppressed'); assert.equal(calls, 1);
  await require('./assert-business-trace.cjs')(store, 'population', command, 'INQUIRY-ACCEPTED', now + 2000, 'population_packet_1');
  console.log('population real-estate: sovereign non-binding decision, capped B14 inquiry, signed-inbound observation, zero-credit learning, recovery and business trace passed');
})().catch(function (error) { console.error(error); process.exit(1); });
