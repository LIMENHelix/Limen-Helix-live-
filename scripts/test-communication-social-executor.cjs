#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var Executor = require('../lib/communication-social-executor.js');
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

(async function () {
  assert.equal(Strict.assertKey(Executor.LOG_KEY), Executor.LOG_KEY);
  assert.equal(Strict.assertKey(Executor.PENDING_LOG_KEY), Executor.PENDING_LOG_KEY);
  assert.equal(Strict.assertKey(Executor.commandKey('x')), Executor.commandKey('x'));
  assert.equal(Strict.assertKey(Executor.motorClaimKey('x')), Executor.motorClaimKey('x'));
  var store = new Store();
  var first = await Executor.execute({ store: store, spec: { subjectDomain: 'defense', text: 'bounded post' }, motorAuthorization: motor, platform: platform, now: 1000 });
  assert.equal(first.status, 'POSTED');
  assert.equal(first.published, true);
  assert.equal(first.uri, 'at://did/app.bsky.feed.post/r1');
  assert.equal(platformCalls, 1);

  var differentContent = await Executor.execute({ store: store, spec: { subjectDomain: 'defense', text: 'different post' }, motorAuthorization: motor, platform: platform, now: 1000 });
  assert.equal(differentContent.status, 'REFUSED');
  assert.equal(differentContent.reason, 'communication-social-motor-receipt-already-consumed');
  assert.equal(platformCalls, 1);
  var command = await store.get(Executor.commandKey(first.commandId));
  assert.equal(command.receipt.readbackVerified, true);
  assert.equal(command.contentHash.length, 64);
  assert.equal(command.liveMoney, false);
  assert(store.log.some(function (row) { return row.key === Executor.PENDING_LOG_KEY && row.value.status === 'DISPATCHING'; }));

  var duplicate = await Executor.execute({ store: store, spec: { subjectDomain: 'defense', text: 'bounded post' }, motorAuthorization: motor, platform: platform, now: 1000 });
  assert.equal(duplicate.duplicate, true);
  assert.equal(platformCalls, 1);

  var heldCalls = 0;
  var held = await Executor.execute({
    store: new Store(), spec: { subjectDomain: 'defense', text: 'held post' },
    motorAuthorization: { authorize: async function () { return { authorized: false, reason: 'b10-held', receiptId: 'held' }; } },
    platform: { postToBluesky: async function () { heldCalls++; } }, now: 2000
  });
  assert.equal(held.status, 'HELD');
  assert.equal(heldCalls, 0);

  var failedStore = new Store();
  var failedCalls = 0;
  var failure = await Executor.execute({
    store: failedStore, spec: { subjectDomain: 'law', text: 'one shot' }, motorAuthorization: motor,
    platform: { postToBluesky: async function () { failedCalls++; return { ok: false, reason: 'provider-failed' }; } }, now: 3000
  });
  assert.equal(failure.status, 'FAILED');
  var noRetry = await Executor.execute({
    store: failedStore, spec: { subjectDomain: 'law', text: 'one shot' }, motorAuthorization: motor,
    platform: { postToBluesky: async function () { failedCalls++; } }, now: 3000
  });
  assert.equal(noRetry.reason, 'communication-social-command-already-claimed-no-retry');
  assert.equal(failedCalls, 1);

  console.log('communication social executor: B10 authorization, pre-dispatch durable command, strict receipt readback, idempotency, and ambiguous-failure no-retry passed');
})().catch(function (error) { console.error(error); process.exit(1); });
