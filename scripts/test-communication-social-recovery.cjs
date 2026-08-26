#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var Executor = require('../lib/communication-social-executor.js');
var Observer = require('../lib/communication-social-outcome-observer.js');
var Recovery = require('../lib/communication-social-recovery.js');
var RecoveryHandler = require('../handlers/communication-social-recovery.js');
var Strict = require('../lib/autofire-efference-store.js');

function Store() { this.map = new Map(); this.log = []; }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) { return this.map.get(key) || null; };
Store.prototype.set = async function (key, value) { this.map.set(key, JSON.parse(JSON.stringify(value))); return true; };
Store.prototype.setIfAbsent = async function (key, value) { if (this.map.has(key)) return false; await this.set(key, value); return true; };
Store.prototype.lpush = async function (key, value) { this.log.unshift({ key: key, value: value }); return this.log.length; };
Store.prototype.ltrim = async function () { return true; };

function motor() { return { authorize: async function () { return { authorized: true, productDomain: 'communication', ownerDomain: 'communication', lane: 'social', receiptId: 'pdmr_recovery_1' }; } }; }

async function seeded() {
  var store = new Store();
  var commandId = 'csc_seed';
  var uri = 'at://did/app.bsky.feed.post/r1';
  var cid = 'cid1';
  await store.set(Executor.commandKey(commandId), {
    schemaVersion: Executor.SCHEMA, commandId: commandId, status: 'POSTED',
    productDomain: 'communication', ownerDomain: 'communication', lane: 'social',
    productMotorReceiptId: 'pdmr_post_1', receipt: { uri: uri, cid: cid, url: 'https://bsky.app/post/r1' }
  });
  await store.set(Observer.observationKey(uri), {
    schemaVersion: Observer.SCHEMA, observationId: 'cso_presence_1', status: 'OBSERVED',
    postReceipt: { uri: uri, cid: cid }
  });
  return { store: store, commandId: commandId, uri: uri, cid: cid };
}

(async function () {
  assert.equal(Strict.assertKey(Recovery.LOG_KEY), Recovery.LOG_KEY);
  assert.equal(Strict.assertKey(Recovery.recoveryKey('x')), Recovery.recoveryKey('x'));

  var fixture = await seeded();
  var deletes = 0;
  var recovered = await Recovery.recover({
    store: fixture.store, commandId: fixture.commandId, reason: 'content-correction',
    trigger: { type: 'communication-policy', id: 'policy-1' }, motorAuthorization: motor(), now: 2000,
    platform: { deleteBlueskyPost: async function (uri) { deletes++; assert.equal(uri, fixture.uri); return { ok: true }; } },
    publicAbsent: async function () { return true; }
  });
  assert.equal(recovered.status, 'DELETED');
  assert.equal(recovered.publicAbsenceVerified, true);
  assert.equal(deletes, 1);
  var receipt = await fixture.store.get(Recovery.recoveryKey(fixture.commandId));
  assert.equal(receipt.receipt.readbackVerified, true);
  assert.equal(receipt.receipt.cid, fixture.cid);

  var duplicate = await Recovery.recover({
    store: fixture.store, commandId: fixture.commandId, reason: 'content-correction',
    trigger: { type: 'communication-policy', id: 'policy-1' }, motorAuthorization: motor(), now: 3000,
    platform: { deleteBlueskyPost: async function () { deletes++; } }, publicAbsent: async function () { return true; }
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(deletes, 1);

  var noObservation = await seeded();
  noObservation.store.map.delete(Observer.observationKey(noObservation.uri));
  var held = await Recovery.recover({ store: noObservation.store, commandId: noObservation.commandId,
    reason: 'policy-invalidation', trigger: { type: 'policy', id: 'p2' }, motorAuthorization: motor(), now: 4000,
    platform: { deleteBlueskyPost: async function () { throw new Error('must not delete'); } } });
  assert.equal(held.status, 'HELD');
  assert.equal(held.reason, 'independent-public-presence-observation-required');

  var pending = await seeded();
  var presentReads = 0;
  var accepted = await Recovery.recover({ store: pending.store, commandId: pending.commandId,
    reason: 'commissioning-complete', trigger: { type: 'commissioning', id: 'c1' }, motorAuthorization: motor(), now: 5000,
    platform: { deleteBlueskyPost: async function () { return { ok: true }; } },
    publicAbsent: async function () { presentReads++; return false; } });
  assert.equal(accepted.status, 'DELETE_ACCEPTED_AWAITING_ABSENCE');
  var reconciled = await Recovery.recover({ store: pending.store, commandId: pending.commandId,
    reason: 'commissioning-complete', trigger: { type: 'commissioning', id: 'c1' }, now: 6000,
    platform: { deleteBlueskyPost: async function () { throw new Error('must not retry'); } },
    publicAbsent: async function () { presentReads++; return true; } });
  assert.equal(reconciled.status, 'DELETED');
  assert.equal(presentReads, 2);

  var handlerCalled = 0;
  var handler = RecoveryHandler.createHandler({
    adminGate: {
      reqKey: function () { return 'communication-pass'; },
      hasDomain: function (pass, domain) { return pass === 'communication-pass' && domain === 'communication'; },
      deny: function (res) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false })); }
    },
    store: new Store(),
    recovery: { recover: async function (input) { handlerCalled++; assert.equal(input.commandId, 'csc_handler'); return { ok: true, status: 'HELD', liveMoney: false }; } }
  });
  var responseBody = null;
  var res = { headers: {}, setHeader: function (k, v) { this.headers[k] = v; }, end: function (body) { responseBody = JSON.parse(body); return this; } };
  await handler({ method: 'POST', headers: {}, body: { commandId: 'csc_handler', reason: 'policy-invalidation', trigger: { type: 'policy', id: 'x' } } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(responseBody.status, 'HELD');
  assert.equal(handlerCalled, 1);

  console.log('communication social recovery: exact post identity, independent presence, fresh domain authority, one-shot delete, absence verification, reconciliation, and routed domain gate passed');
})().catch(function (error) { console.error(error); process.exit(1); });
