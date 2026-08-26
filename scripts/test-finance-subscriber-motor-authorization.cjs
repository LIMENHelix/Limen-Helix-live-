'use strict';
var assert = require('node:assert/strict');
var Auth = require('../lib/finance-subscriber-motor-authorization.js');
var StrictStore = require('../lib/autofire-efference-store.js');

function Store() { this.values = new Map(); this.lists = new Map(); }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (k) { return this.values.get(k) || null; };
Store.prototype.setIfAbsent = async function (k, v) { if (this.values.has(k)) return false; this.values.set(k, structuredClone(v)); return true; };
Store.prototype.lpush = async function (k, v) { var a = this.lists.get(k) || []; a.unshift(structuredClone(v)); this.lists.set(k, a); return a.length; };
Store.prototype.ltrim = async function () { return true; };

function cognition(now, review) {
  return { ts: now, c: { domain: 'finance', immune: { immuneState: 'clear' }, awareness: { humanReviewRequired: !!review },
    brainOrgans: { autonomousInternalEmission: { holdReason: null }, resourceMetabolism: { state: 'AVAILABLE', gates: { mayRunInternalCycle: true } } },
    serverPacket: { schemaVersion: 'civilization-domain-packet/1.0', domainId: 'finance', packetId: 'finance-subscriber-packet',
      generatedAt: new Date(now).toISOString(), sourceIdentity: { producer: 'brain-cognition-refresh/1' }, truth: { feedHealth: { live: 3 } } } } };
}

(async function () {
  var oldEmail = process.env.FINANCE_SUBSCRIBER_EMAIL_ENABLED;
  var oldObserver = process.env.FINANCE_SUBSCRIBER_OUTCOME_OBSERVER_ENABLED;
  try {
    var now = Date.now(), store = new Store();
    delete process.env.FINANCE_SUBSCRIBER_EMAIL_ENABLED;
    delete process.env.FINANCE_SUBSCRIBER_OUTCOME_OBSERVER_ENABLED;
    var closed = await Auth.authorize(store, 'finance', 'subscriber-email', now, { cognition: cognition(now, false) });
    assert.equal(closed.authorized, false); assert.equal(closed.reason, 'finance-subscriber-email-switch-closed');
    process.env.FINANCE_SUBSCRIBER_EMAIL_ENABLED = '1';
    var observerClosed = await Auth.authorize(store, 'finance', 'subscriber-email', now, { cognition: cognition(now, false) });
    assert.equal(observerClosed.reason, 'finance-subscriber-outcome-observer-switch-closed');
    process.env.FINANCE_SUBSCRIBER_OUTCOME_OBSERVER_ENABLED = '1';
    var reviewHeld = await Auth.authorize(store, 'finance', 'subscriber-email', now, { cognition: cognition(now, true) });
    assert.equal(reviewHeld.authorized, false); assert(reviewHeld.blockers.includes('finance-human-review-veto'));
    var authorized = await Auth.authorize(store, 'finance', 'subscriber-email', now, { cognition: cognition(now, false) });
    assert.equal(authorized.authorized, true); assert.equal(authorized.productDomain, 'finance'); assert.equal(authorized.lane, 'subscriber-email');
    assert.equal(authorized.safety.externalEffectExecuted, false); assert.equal(authorized.safety.providerCalled, false);
    assert.equal(StrictStore.assertKey(Auth.key(authorized.receiptId)), Auth.key(authorized.receiptId));
    assert.equal(StrictStore.assertKey(Auth.LOG_KEY), Auth.LOG_KEY);
    console.log('finance subscriber motor authorization: local switches, fresh Finance cognition, and durable readback passed');
  } finally {
    if (oldEmail === undefined) delete process.env.FINANCE_SUBSCRIBER_EMAIL_ENABLED; else process.env.FINANCE_SUBSCRIBER_EMAIL_ENABLED = oldEmail;
    if (oldObserver === undefined) delete process.env.FINANCE_SUBSCRIBER_OUTCOME_OBSERVER_ENABLED; else process.env.FINANCE_SUBSCRIBER_OUTCOME_OBSERVER_ENABLED = oldObserver;
  }
})().catch(function (error) { console.error(error && error.stack || error); process.exitCode = 1; });
