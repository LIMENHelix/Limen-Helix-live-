'use strict';
var assert = require('node:assert/strict');
var Subs = require('../lib/subscriptions.js');
var Fulfillment = require('../lib/finance-revenue-fulfillment.js');
function Store() { this.values = new Map(); this.lists = new Map(); }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (k) { return this.values.has(k) ? structuredClone(this.values.get(k)) : null; };
Store.prototype.set = async function (k, v) { this.values.set(k, structuredClone(v)); return true; };
Store.prototype.setIfAbsent = async function (k, v) { if (this.values.has(k)) return false; this.values.set(k, structuredClone(v)); return true; };
Store.prototype.lpush = async function (k, v) { var a = this.lists.get(k) || []; a.unshift(structuredClone(v)); this.lists.set(k, a); return a.length; };
Store.prototype.ltrim = async function (k, s, e) { this.lists.set(k, (this.lists.get(k) || []).slice(s, e + 1)); return true; };
Store.prototype.lrange = async function (k, s, e) { return structuredClone((this.lists.get(k) || []).slice(s, e + 1)); };
function cognition(now, review) { return { ts: now, c: { domain: 'finance', immune: { immuneState: 'clear' }, awareness: { humanReviewRequired: review },
  brainOrgans: { autonomousInternalEmission: { holdReason: null }, resourceMetabolism: { state: 'AVAILABLE', gates: { mayRunInternalCycle: true } } },
  serverPacket: { schemaVersion: 'civilization-domain-packet/1.0', domainId: 'finance', packetId: 'finance-revenue-' + review,
    generatedAt: new Date(now).toISOString(), sourceIdentity: { producer: 'brain-cognition-refresh/1' }, truth: { feedHealth: { configured: 14, live: 14 } } } } }; }
function motor(id) { return { authorize: async function () { return { authorized: true, receiptId: id }; } }; }
(async function () {
  var store = new Store(), now = Date.now(), sends = 0;
  var active = await Subs.activateStrict({ email: 'payer@example.com', domain: 'finance', rung: 'watch', offer: 'Finance Watch',
    priceCents: 900, subscriptionId: 'sub_1', customerId: 'cus_1' }, store);
  var held = await Fulfillment.enqueueAndAttempt({ store: store, eventId: 'evt_finance_1', kind: 'welcome', subscriber: active.subscriber,
    message: { subject: 'Welcome', body: 'Your paid Finance watch is active.' }, now: now,
    decisionDeps: { cognition: cognition(now, true) }, emailCostUsd: 0.01, dailyBudgetUsd: 0.05, dailySendCap: 5,
    motorAuthorization: motor('not-used'), transport: { send: async function () { sends++; } } });
  assert.equal(held.status, 'HELD'); assert.equal(sends, 0);
  var retried = await Fulfillment.retryRecent({ store: store, now: now, decisionDeps: { cognition: cognition(now, false) },
    emailCostUsd: 0.01, dailyBudgetUsd: 0.05, dailySendCap: 5, motorAuthorization: motor('finance-revenue-motor-1'),
    transport: { send: async function (_email, _subject, _body, options) { sends++; assert.match(options.idempotencyKey, /^finance-digest\//);
      return { ok: true, id: 'resend-finance-welcome-1', providerCalled: true }; } } });
  assert.equal(retried.length, 1); assert.equal(retried[0].status, 'COMPLETED'); assert.equal(sends, 1);
  var religion = await Subs.activateStrict({ email: 'other@example.com', domain: 'religion', rung: 'watch', offer: 'Religion Watch', subscriptionId: 'sub_2' }, store);
  var refused = await Fulfillment.enqueueAndAttempt({ store: store, eventId: 'evt_wrong_domain', kind: 'welcome', subscriber: religion.subscriber,
    message: { subject: 'Wrong', body: 'Wrong domain.' } });
  assert.equal(refused.status, 'REFUSED'); assert.equal(sends, 1);
  console.log('finance Stripe welcome and renewal stay inside the Finance subscriber brain: PASS');
})().catch(function (error) { console.error(error); process.exitCode = 1; });
