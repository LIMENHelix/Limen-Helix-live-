#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var Verifier = require('../lib/communication-social-capability-verifier.js');
var Cap = require('../lib/product-domain-motor-capability.js');
var Motor = require('../lib/product-domain-motor-receipt.js');
var Handler = require('../handlers/communication-social-capability.js');

function Store() { this.values = new Map(); this.logs = {}; }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) { return this.values.has(key) ? this.values.get(key) : null; };
Store.prototype.set = async function (key, value) { this.values.set(key, JSON.parse(JSON.stringify(value))); return true; };
Store.prototype.setIfAbsent = async function (key, value) { if (this.values.has(key)) return false; return this.set(key, value); };
Store.prototype.replaceIfValue = async function (key, prior, value) {
  if (this.values.get(key) !== prior) return false;
  return this.set(key, value);
};
Store.prototype.lpush = async function (key, value) {
  this.logs[key] = this.logs[key] || [];
  this.logs[key].unshift(JSON.parse(JSON.stringify(value)));
  return this.logs[key].length;
};
Store.prototype.ltrim = async function (key, start, stop) {
  this.logs[key] = (this.logs[key] || []).slice(start, stop + 1); return true;
};

function motor(now) {
  return {
    schemaVersion: Motor.SCHEMA, receiptId: 'communication-motor-receipt',
    productDomain: 'communication', ownerDomain: 'communication',
    contractId: 'communication-motor/1', lane: 'social', status: 'HELD', persistedAt: now,
    contracts: { decision: 'public-message-decision/1', budget: 'communication-social-budget/1',
      receipt: 'platform-post-receipt', independentOutcome: 'engagement-or-conversion', rollback: 'delete-or-correct' }
  };
}
function response() {
  return { statusCode: 200, headers: {}, setHeader: function (k, v) { this.headers[k] = v; },
    end: function (body) { this.body = body; return body; } };
}

(async function () {
  var now = Date.now();
  var store = new Store();
  await store.set(Motor.receiptKey('communication'), motor(now));
  var posted = 0, deleted = 0, reads = 0;
  var deps = {
    env: { COMMUNICATION_SOCIAL_COMMISSIONING_ENABLED: '1' },
    adapterGuard: { checkpoint: async function (ignoredStore, valveId) {
      assert.equal(valveId, 'communication:social-commissioning');
      return { allowed: true, valveId: valveId };
    } },
    postToBluesky: async function (text) {
      posted++;
      assert.equal(text, Verifier.TEXT);
      return { ok: true, providerCalled: true,
        uri: 'at://did:plc:limen/app.bsky.feed.post/commission-one', cid: 'cid-one' };
    },
    appviewRead: async function () {
      reads++;
      return reads === 1
        ? { found: true, post: { uri: 'at://did:plc:limen/app.bsky.feed.post/commission-one',
          cid: 'cid-one', indexedAt: new Date(now).toISOString() } }
        : { found: false, post: null };
    },
    deleteBlueskyPost: async function () { deleted++; return { ok: true }; },
    sleep: async function () {}, pollAttempts: 10, pollDelayMs: 0
  };
  var result = await Verifier.commission(store, now, deps);
  assert.equal(result.status, 'VERIFIED');
  assert.equal(posted, 1);
  assert.equal(deleted, 1);
  assert.equal((await store.get(Verifier.SLOT_KEY)).status, 'VERIFIED');
  var pair = await Cap.verifyPair(store, motor(now), Date.now());
  assert.equal(pair.ok, true);
  assert.notEqual(pair.executorEvidenceReceiptId, pair.observerEvidenceReceiptId);

  var duplicate = await Verifier.commission(store, Date.now(), deps);
  assert.equal(duplicate.status, 'VERIFIED');
  assert.equal(duplicate.duplicate, true);
  assert.equal(posted, 1, 'a verified one-shot never posts again');

  store.values.delete(Cap.capabilityKey('communication', Cap.EXECUTOR));
  store.values.delete(Cap.capabilityKey('communication', Cap.OBSERVER));
  var renewed = await Verifier.commission(store, now + Verifier.TTL_SECONDS * 1000 + 1, deps);
  assert.equal(renewed.status, 'VERIFIED');
  assert.equal(renewed.renewed, true);
  assert.equal(posted, 1, 'renewing a short authority lease must not replay the public proof');
  assert.equal((await Cap.verifyPair(store, motor(now), now + Verifier.TTL_SECONDS * 1000 + 2)).ok, true);

  var expiredStore = new Store();
  await expiredStore.set(Motor.receiptKey('communication'), motor(now));
  var expiredState = {
    schemaVersion: Verifier.SCHEMA, commissioningId: 'expired', status: 'ROLLBACK_DISPATCHING',
    productDomain: 'communication', ownerDomain: 'communication', lane: 'social',
    motorReceiptId: 'communication-motor-receipt', textHash: Verifier.hash(Verifier.TEXT),
    claimedAt: now - Verifier.MAX_EXPOSURE_MS - 2000,
    postedAt: now - Verifier.MAX_EXPOSURE_MS - 1000,
    observedAt: now - Verifier.MAX_EXPOSURE_MS,
    postIdentity: { uri: 'at://did:plc:limen/app.bsky.feed.post/expired', cid: 'cid-expired' },
    presenceObserverReceiptId: 'presence-expired', rollbackReceiptId: 'rollback-expired',
    providerCalled: true, liveMoney: false
  };
  await expiredStore.set(Verifier.SLOT_KEY, expiredState);
  var expiredCurrent = await expiredStore.get(Verifier.SLOT_KEY);
  var expired = await Verifier.step(expiredStore, expiredCurrent, motor(now), {
    appviewRead: async function () { return { found: false, post: null }; }
  }, now);
  assert.equal(expired.status, 'CLEANED_UP_EXPIRED');
  assert.equal(await expiredStore.get(Cap.capabilityKey('communication', Cap.EXECUTOR)), null);
  assert.equal(await expiredStore.get(Cap.capabilityKey('communication', Cap.OBSERVER)), null);

  var disabledStore = new Store();
  await disabledStore.set(Motor.receiptKey('communication'), motor(now));
  var disabled = await Verifier.commission(disabledStore, now, { env: {}, postToBluesky: async function () { throw new Error('must not post'); } });
  assert.equal(disabled.status, 'HELD');
  assert.equal(disabled.reason, 'communication-social-commissioning-disabled');

  var ambiguousStore = new Store();
  await ambiguousStore.set(Motor.receiptKey('communication'), motor(now));
  var ambiguousCalls = 0;
  var ambiguous = await Verifier.commission(ambiguousStore, now, {
    env: { COMMUNICATION_SOCIAL_COMMISSIONING_ENABLED: '1' },
    adapterGuard: { checkpoint: async function () { return { allowed: true }; } },
    postToBluesky: async function () { ambiguousCalls++; return { ok: false, providerCalled: true, ambiguous: true }; },
    authorFeed: async function () { return []; }, handle: 'limen.test',
    sleep: async function () {}, pollAttempts: 3, pollDelayMs: 0
  });
  assert.equal(ambiguous.status, 'DISPATCHING');
  assert.equal(ambiguousCalls, 1, 'an ambiguous provider result is reconciled and never reposted');

  var deniedStore = new Store();
  await deniedStore.set(Motor.receiptKey('communication'), motor(now));
  await assert.rejects(function () { return Verifier.commission(deniedStore, now, {
    env: { COMMUNICATION_SOCIAL_COMMISSIONING_ENABLED: '1' },
    adapterGuard: { checkpoint: async function () { throw new Error('valve closed'); } },
    postToBluesky: async function () { throw new Error('must not post'); },
    pollAttempts: 1
  }); }, /valve closed/);

  var calls = { commission: 0, audit: 0 };
  var handler = Handler.createHandler({ store: store, env: { CRON_SECRET: 'cron', BRAIN_SHADOW_TOKEN: 'brain' },
    verifier: {
      commission: async function () { calls.commission++; return { ok: true, status: 'VERIFIED' }; },
      audit: async function () { calls.audit++; return { readOnly: true }; }
    } });
  var cronRes = response();
  await handler({ method: 'GET', headers: { authorization: 'Bearer cron' } }, cronRes);
  assert.equal(cronRes.statusCode, 200); assert.equal(calls.commission, 1);
  var auditRes = response();
  await handler({ method: 'GET', headers: { 'x-brain-token': 'brain' } }, auditRes);
  assert.equal(auditRes.statusCode, 200); assert.equal(calls.audit, 1);
  var deniedRes = response();
  await handler({ method: 'GET', headers: {} }, deniedRes);
  assert.equal(deniedRes.statusCode, 401);

  console.log('communication social capability: one-shot post, independent presence, rollback, absence proof, lease renewal without replay, exposure expiry, ambiguity inhibition, and auth passed');
})().catch(function (error) { console.error(error); process.exit(1); });
