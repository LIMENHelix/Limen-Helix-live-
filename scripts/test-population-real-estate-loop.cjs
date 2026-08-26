#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
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
  var event = { type: 'email.received', created_at: new Date(now + 1000).toISOString(), data: { email_id: 'email_in_1', from: 'broker@example.com', to: ['population-realestate+' + command.actionId + '@receive.example.com'] } };
  var observation = await Observer.record(store, event);
  assert.equal(observation.status, 'COUNTERPARTY_RESPONSE_OBSERVED'); assert.equal(observation.independentOfSendResponse, true); assert.equal(observation.webhookSignatureVerified, true);
  var learned = await Learning.recordObservation(store, observation); assert.equal(learned.ok, true); assert.equal(learned.resolvedCount, 1);
  assert.equal(learned.signal.normalizedCredit, 0, 'an unclassified reply cannot be treated as a positive real-estate outcome');
  var secret = 'whsec_' + Buffer.from('population-real-estate-webhook-test-secret').toString('base64');
  var webhook = new Webhook(secret), stamp = new Date(), messageId = 'msg_population_1';
  var signedEvent = { type: 'email.received', created_at: stamp.toISOString(), data: { email_id: 'email_in_2', from: 'broker@example.com', to: ['population-realestate+' + command.actionId + '@receive.example.com'] } };
  var raw = JSON.stringify(signedEvent), signature = webhook.sign(messageId, stamp, raw);
  var inbound = InboundHandler.createHandler({ store: store, secret: secret });
  var verified = await invoke(inbound, raw, { 'svix-id': messageId, 'svix-timestamp': String(Math.floor(stamp.getTime() / 1000)), 'svix-signature': signature });
  assert.equal(verified.status, 200); assert.equal(verified.body.status, 'COUNTERPARTY_RESPONSE_OBSERVED'); assert.equal(verified.body.sendEndpointCalled, false);
  var forged = await invoke(inbound, raw, { 'svix-id': messageId, 'svix-timestamp': String(Math.floor(stamp.getTime() / 1000)), 'svix-signature': 'v1,forged' });
  assert.equal(forged.status, 400); assert.equal(forged.body.error, 'invalid webhook signature');
  var learningState = await Learning.readForBrain(store); assert.equal(learningState.status, 'ELIGIBLE'); assert.equal(learningState.learningGate.ready, false);
  var recovery = await Recovery.recover({ store: store, command: command, observation: observation, now: now + 2000, motorAuthorization: motor });
  assert.equal(recovery.status, 'FUTURE_INQUIRIES_SUPPRESSED'); assert.equal(recovery.strictSuppressionReadback, true); assert.equal(recovery.irreversiblePriorInquiry, true);
  var held = await Executor.execute({ store: store, candidate: candidate, decision: decision, now: now + 3, motorAuthorization: motor, emailCostUsd: 0.001, dailyBudgetUsd: 0.01, dailyRequestCap: 2, transport: { send: async function () { calls++; } } });
  assert.equal(held.reason, 'population-real-estate-counterparty-property-suppressed'); assert.equal(calls, 1);
  console.log('population real-estate: sovereign non-binding decision, capped B14 inquiry, signed-inbound observation, zero-credit learning, and recovery passed');
})().catch(function (error) { console.error(error); process.exit(1); });
