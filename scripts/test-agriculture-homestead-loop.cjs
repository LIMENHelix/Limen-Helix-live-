#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var Decision = require('../lib/agriculture-homestead-decision.js');
var Executor = require('../lib/agriculture-homestead-executor.js');
var Observer = require('../lib/agriculture-homestead-observer.js');
var Recovery = require('../lib/agriculture-homestead-recovery.js');
var Learning = require('../lib/agriculture-homestead-learning.js');
var InboundHandler = require('../handlers/agriculture-homestead-inbound.js');
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
  var cognition = { ts: now, c: { domain: 'agriculture', immune: { immuneState: 'clear' }, awareness: { humanReviewRequired: false },
    brainOrgans: { autonomousInternalEmission: { holdReason: null, emittedCount: 1 }, resourceMetabolism: { state: 'AVAILABLE', gates: { mayRunInternalCycle: true } } },
    serverPacket: { schemaVersion: 'civilization-domain-packet/1.0', domainId: 'agriculture', packetId: 'ag_packet_1', generatedAt: new Date(now).toISOString(), sourceIdentity: { producer: 'brain-cognition-refresh/1' }, truth: { feedHealth: { live: 8 } } } } };
  var candidate = Decision.candidate({ workOrderId: 'farm-work-001', providerEmail: 'vendor@example.com', propertyRef: 'farm-field-alpha', operationKind: 'equipment-inspection-quote', subject: 'Request for inspection quote', body: 'Please provide scope, availability, and a written no-obligation estimate.', evidenceId: 'agriculture-feed-bundle-001' });
  assert(candidate); assert.equal(Decision.validateCandidate(candidate), true);
  var invalid = Decision.candidate({ workOrderId: 'x' }); assert.equal(invalid, null);
  var decision = await Decision.decide(store, candidate, now, { cognition: cognition });
  assert.equal(decision.status, 'RELEASED'); assert.equal(decision.providerCalled, false);
  var motorCount = 0, motor = { authorize: async function () { motorCount++; return { authorized: true, receiptId: 'motor_' + motorCount }; } };
  var calls = 0, command = await Executor.execute({ store: store, candidate: candidate, decision: decision, now: now + 1, motorAuthorization: motor,
    emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailyRequestCap: 2,
    transport: { send: async function (value, actionId, idempotencyKey) { calls++; assert.equal(value.workOrderId, 'farm-work-001'); assert.match(actionId, /^aha_/); assert.equal(idempotencyKey, 'agriculture-homestead/' + actionId); return { ok: true, id: 'email_out_1', providerCalled: true, replyAddressHash: 'reply_hash' }; } } });
  assert.equal(command.status, 'ACCEPTED'); assert.equal(command.readbackVerified, true); assert.equal(calls, 1);
  var replay = await Executor.execute({ store: store, candidate: candidate, decision: decision, now: now + 2, motorAuthorization: motor, emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailyRequestCap: 2, transport: { send: async function () { calls++; } } });
  assert.equal(replay.replayed, true); assert.equal(calls, 1);
  var event = { type: 'email.received', created_at: new Date(now + 1000).toISOString(), data: { email_id: 'email_in_1', from: 'vendor@example.com', to: ['homestead+' + command.actionId + '@receive.example.com'] } };
  var observation = await Observer.record(store, event);
  assert.equal(observation.status, 'COUNTERPARTY_RESPONSE_OBSERVED'); assert.equal(observation.independentOfSendResponse, true); assert.equal(observation.webhookSignatureVerified, true);
  var learned = await Learning.recordObservation(store, observation); assert.equal(learned.ok, true); assert.equal(learned.resolvedCount, 1);
  var secret = 'whsec_' + Buffer.from('agriculture-homestead-webhook-test-secret').toString('base64');
  var webhook = new Webhook(secret), stamp = new Date(), messageId = 'msg_agriculture_1';
  var signedEvent = { type: 'email.received', created_at: stamp.toISOString(), data: { email_id: 'email_in_2', from: 'vendor@example.com', to: ['homestead+' + command.actionId + '@receive.example.com'] } };
  var raw = JSON.stringify(signedEvent), signature = webhook.sign(messageId, stamp, raw);
  var inbound = InboundHandler.createHandler({ store: store, secret: secret });
  var verified = await invoke(inbound, raw, { 'svix-id': messageId, 'svix-timestamp': String(Math.floor(stamp.getTime() / 1000)), 'svix-signature': signature });
  assert.equal(verified.status, 200); assert.equal(verified.body.status, 'COUNTERPARTY_RESPONSE_OBSERVED'); assert.equal(verified.body.sendEndpointCalled, false);
  var forged = await invoke(inbound, raw, { 'svix-id': messageId, 'svix-timestamp': String(Math.floor(stamp.getTime() / 1000)), 'svix-signature': 'v1,forged' });
  assert.equal(forged.status, 400); assert.equal(forged.body.error, 'invalid webhook signature');
  var learningState = await Learning.readForBrain(store); assert.equal(learningState.status, 'ELIGIBLE'); assert.equal(learningState.learningGate.ready, false);
  var recovery = await Recovery.recover({ store: store, command: command, observation: observation, now: now + 2000, motorAuthorization: motor });
  assert.equal(recovery.status, 'FUTURE_REQUESTS_SUPPRESSED'); assert.equal(recovery.strictSuppressionReadback, true); assert.equal(recovery.irreversiblePriorRequest, true);
  var held = await Executor.execute({ store: store, candidate: candidate, decision: decision, now: now + 3, motorAuthorization: motor, emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailyRequestCap: 2, transport: { send: async function () { calls++; } } });
  assert.equal(held.reason, 'agriculture-homestead-provider-suppressed'); assert.equal(calls, 1);
  console.log('agriculture homestead: sovereign decision, budgeted B14 request, idempotent receipt, signed-inbound observation, learning, and recovery passed');
})().catch(function (error) { console.error(error); process.exit(1); });
