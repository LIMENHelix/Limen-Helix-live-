#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var Decision = require('../lib/communication-social-decision.js');
var Executor = require('../lib/communication-social-executor.js');
var Observer = require('../lib/communication-social-outcome-observer.js');
var Learning = require('../lib/communication-social-learning.js');

function Store() { this.map = new Map(); this.log = []; }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) { return this.map.get(key) || null; };
Store.prototype.set = async function (key, value) { this.map.set(key, JSON.parse(JSON.stringify(value))); return true; };
Store.prototype.setIfAbsent = async function (key, value) { if (this.map.has(key)) return false; await this.set(key, value); return true; };
Store.prototype.deleteIfValue = async function (key, value) {
  if (!this.map.has(key) || JSON.stringify(this.map.get(key)) !== JSON.stringify(value)) return 0;
  this.map.delete(key); return 1;
};
Store.prototype.lpush = async function (key, value) { this.log.unshift({ key: key, value: JSON.parse(JSON.stringify(value)) }); return this.log.length; };
Store.prototype.ltrim = async function () { return true; };
Store.prototype.lrange = async function (key, start, stop) { return structuredClone(this.log.filter(function (row) { return row.key === key; }).slice(start, stop + 1).map(function (row) { return row.value; })); };

function brain(domain, now) {
  return { ts: now, c: {
    domain: domain,
    immune: { immuneState: 'clear' },
    awareness: { humanReviewRequired: false },
    brainOrgans: { autonomousInternalEmission: { holdReason: null, emittedCount: 1 } },
    serverPacket: {
      schemaVersion: 'civilization-domain-packet/1.0', packetId: domain + '-packet-' + now,
      domainId: domain, sourceType: 'server-cognition-refresh', generatedAt: new Date(now).toISOString(),
      sourceIdentity: { producer: 'brain-cognition-refresh/1' },
      truth: { stressScore: 0.4, activeDiagnoses: [], opportunities: [{ id: domain + '-opportunity' }], feedHealth: { live: 2 } }
    }
  } };
}

function candidate(now, text) {
  return {
    subjectDomain: 'law', text: text,
    sourceIdentity: { kind: 'limen-live-tool-response', value: 'https://limenhelix.com/api/law-tools',
      subjectDomain: 'law', retrievedAt: new Date(now).toISOString(), responseHash: 'a'.repeat(64) }
  };
}

function responsePost(likes) {
  return async function () {
    return { status: 200, json: async function () { return { posts: [{
      uri: 'at://did:plc:test/app.bsky.feed.post/communication-loop', cid: 'cid-loop',
      replyCount: 0, repostCount: 0, likeCount: likes, quoteCount: 0,
      indexedAt: '2026-09-29T02:01:30.470Z'
    }] }; } };
  };
}

(async function () {
  var now = Date.now(), store = new Store();
  var firstCandidate = candidate(now, 'First source-backed fact.\nhttps://limenhelix.com/law');
  var cognition = { communication: brain('communication', now), law: brain('law', now) };
  var firstDecision = await Decision.decide(store, firstCandidate, now, { cognition: cognition });
  assert.equal(firstDecision.status, 'RELEASED');
  assert.equal(firstDecision.returnedOutcome.effect, 'NO_RETURNED_OUTCOME_YET');

  var posted = await Executor.execute({
    store: store,
    spec: { subjectDomain: 'law', text: firstCandidate.text, decisionReceipt: firstDecision },
    motorAuthorization: { authorize: async function () { return {
      authorized: true, productDomain: 'communication', ownerDomain: 'communication', lane: 'social', receiptId: 'communication-loop-motor'
    }; } },
    adapterGuard: { checkpoint: async function () { return { allowed: true }; } },
    platform: { postToBluesky: async function () { return {
      ok: true, uri: 'at://did:plc:test/app.bsky.feed.post/communication-loop', cid: 'cid-loop',
      url: 'https://bsky.app/profile/limenhelix/post/communication-loop'
    }; } },
    now: now + 1, nowFn: function () { return now + 1; }
  });
  assert.equal(posted.status, 'POSTED');
  assert.equal(posted.published, true);
  var command = await store.get(Executor.commandKey(posted.commandId));
  assert(command);

  var firstObservation = await Observer.observeOne(store,
    { uri: posted.uri, cid: posted.cid, commandId: posted.commandId }, now + 2,
    { fetch: responsePost(10) });
  assert.equal(firstObservation.status, 'OBSERVED');
  assert.equal((await Learning.recordObservation(store, command, firstObservation.receipt)).ok, true);

  var negativeObservation = await Observer.observeOne(store,
    { uri: posted.uri, cid: posted.cid, commandId: posted.commandId }, now + 3,
    { fetch: responsePost(0) });
  assert.equal(negativeObservation.status, 'OBSERVED');
  assert.equal(negativeObservation.receipt.engagementDelta, -10);
  var learned = await Learning.recordObservation(store, command, negativeObservation.receipt);
  assert.equal(learned.ok, true);
  assert.equal(learned.signal.outcome, 'ENGAGEMENT_DECREASED');

  var nextDecision = await Decision.decide(store,
    candidate(now + 4, 'Revised source-backed fact after observed consequence.\nhttps://limenhelix.com/law'),
    now + 4, { cognition: { communication: brain('communication', now + 4), law: brain('law', now + 4) } });
  assert.equal(nextDecision.status, 'NO_ACTION');
  assert(nextDecision.blockers.includes('communication-returned-outcome-requires-reassessment'));
  assert.equal(nextDecision.returnedOutcome.status, 'OBSERVED');
  assert.equal(nextDecision.returnedOutcome.signalOutcome, 'ENGAGEMENT_DECREASED');
  assert.equal(nextDecision.returnedOutcome.effect, 'HOLD_FOR_NEW_COMMUNICATION_EVIDENCE');
  assert.equal(nextDecision.returnedOutcome.actionId, command.commandId);

  await require('./assert-business-trace.cjs')(store, 'communication', command, 'PLATFORM-POST', now + 1000, nextDecision.communicationPacketId);
  console.log('communication social loop: decision -> posted receipt -> independent AppView observation -> returned negative learning -> next decision hold and business trace PASS');
})().catch(function (error) { console.error(error && error.stack || error); process.exit(1); });
