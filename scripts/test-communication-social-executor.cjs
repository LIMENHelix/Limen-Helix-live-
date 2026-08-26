#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var crypto = require('node:crypto');
var Executor = require('../lib/communication-social-executor.js');
var Decision = require('../lib/communication-social-decision.js');
var Strict = require('../lib/autofire-efference-store.js');

function Store() { this.map = new Map(); this.log = []; }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) { return this.map.get(key) || null; };
Store.prototype.set = async function (key, value) { this.map.set(key, JSON.parse(JSON.stringify(value))); return true; };
Store.prototype.setIfAbsent = async function (key, value) { if (this.map.has(key)) return false; await this.set(key, value); return true; };
Store.prototype.lpush = async function (key, value) { this.log.unshift({ key: key, value: value }); return this.log.length; };
Store.prototype.ltrim = async function () { return true; };

var motor = { authorize: async function () { return { authorized: true, productDomain: 'communication', ownerDomain: 'communication', lane: 'social', receiptId: 'pdmr_comm_1' }; } };
var platformCalls = 0;
var platform = { postToBluesky: async function () { platformCalls++; return { ok: true, uri: 'at://did/app.bsky.feed.post/r1', cid: 'cid1', url: 'https://bsky.app/post/r1', used: 1, cap: 8 }; } };
function decisionReceipt(subjectDomain, body, now) {
  return {
    schemaVersion: Decision.SCHEMA, decisionReceiptId: 'csd_' + now + '_' + subjectDomain,
    status: 'RELEASED', released: true, productDomain: 'communication', ownerDomain: 'communication',
    lane: 'social', decisionContract: 'public-message-decision/1', subjectDomain: subjectDomain,
    contentHash: crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex'),
    decidedAt: now, expiresAt: now + 600000
  };
}
function spec(subjectDomain, body, now) { return { subjectDomain: subjectDomain, text: body, decisionReceipt: decisionReceipt(subjectDomain, body, now) }; }

(async function () {
  assert.equal(Strict.assertKey(Executor.LOG_KEY), Executor.LOG_KEY);
  assert.equal(Strict.assertKey(Executor.PENDING_LOG_KEY), Executor.PENDING_LOG_KEY);
  assert.equal(Strict.assertKey(Executor.commandKey('x')), Executor.commandKey('x'));
  assert.equal(Strict.assertKey(Executor.motorClaimKey('x')), Executor.motorClaimKey('x'));
  var store = new Store();
  var first = await Executor.execute({ store: store, spec: spec('defense', 'bounded post', 1000), motorAuthorization: motor, platform: platform, now: 1000 });
  assert.equal(first.status, 'POSTED');
  assert.equal(first.published, true);
  assert.equal(first.uri, 'at://did/app.bsky.feed.post/r1');
  assert.equal(platformCalls, 1);

  var differentContent = await Executor.execute({ store: store, spec: spec('defense', 'different post', 1000), motorAuthorization: motor, platform: platform, now: 1000 });
  assert.equal(differentContent.status, 'REFUSED');
  assert.equal(differentContent.reason, 'communication-social-motor-receipt-already-consumed');
  assert.equal(platformCalls, 1);
  var command = await store.get(Executor.commandKey(first.commandId));
  assert.equal(command.receipt.readbackVerified, true);
  assert.equal(command.contentHash.length, 64);
  assert.equal(command.liveMoney, false);
  assert(store.log.some(function (row) { return row.key === Executor.PENDING_LOG_KEY && row.value.status === 'DISPATCHING'; }));

  var duplicate = await Executor.execute({ store: store, spec: spec('defense', 'bounded post', 1000), motorAuthorization: motor, platform: platform, now: 1000 });
  assert.equal(duplicate.duplicate, true);
  assert.equal(platformCalls, 1);

  var heldCalls = 0;
  var held = await Executor.execute({
    store: new Store(), spec: spec('defense', 'held post', 2000),
    motorAuthorization: { authorize: async function () { return { authorized: false, reason: 'b10-held', receiptId: 'held' }; } },
    platform: { postToBluesky: async function () { heldCalls++; } }, now: 2000
  });
  assert.equal(held.status, 'HELD');
  assert.equal(heldCalls, 0);

  var failedStore = new Store();
  var failedCalls = 0;
  var failure = await Executor.execute({
    store: failedStore, spec: spec('law', 'one shot', 3000), motorAuthorization: motor,
    platform: { postToBluesky: async function () { failedCalls++; return { ok: false, reason: 'provider-failed' }; } }, now: 3000
  });
  assert.equal(failure.status, 'FAILED');
  var noRetry = await Executor.execute({
    store: failedStore, spec: spec('law', 'one shot', 3000), motorAuthorization: motor,
    platform: { postToBluesky: async function () { failedCalls++; } }, now: 3000
  });
  assert.equal(noRetry.reason, 'communication-social-command-already-claimed-no-retry');
  assert.equal(failedCalls, 1);

  var noDecisionCalls = 0;
  var noDecision = await Executor.execute({ store: new Store(), spec: { subjectDomain: 'law', text: 'no B10' }, motorAuthorization: motor,
    platform: { postToBluesky: async function () { noDecisionCalls++; } }, now: 4000 });
  assert.equal(noDecision.reason, 'communication-social-b10-decision-required');
  assert.equal(noDecisionCalls, 0);

  console.log('communication social executor: B10 authorization, pre-dispatch durable command, strict receipt readback, idempotency, and ambiguous-failure no-retry passed');
})().catch(function (error) { console.error(error); process.exit(1); });
