'use strict';
var assert = require('node:assert/strict');
var Orientation = require('../lib/g0-orientation.js');
var Actuator = require('../lib/g0-actuator.js');
var Envelope = require('../lib/g0-action-envelope.js');
var Lanes = require('../lib/g0-lane-registry.js');

function Store() { this.values = new Map(); this.lists = new Map(); }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (k) { return this.values.has(k) ? structuredClone(this.values.get(k)) : null; };
Store.prototype.set = async function (k, v) { this.values.set(k, structuredClone(v)); return true; };
Store.prototype.setIfAbsent = async function (k, v) { if (this.values.has(k)) return false; this.values.set(k, structuredClone(v)); return true; };
Store.prototype.lpush = async function (k, v) { var a = this.lists.get(k) || []; a.unshift(structuredClone(v)); this.lists.set(k, a); return a.length; };
Store.prototype.ltrim = async function (k, s, e) { this.lists.set(k, (this.lists.get(k) || []).slice(s, e + 1)); return true; };
Store.prototype.lrange = async function (k, s, e) { return structuredClone((this.lists.get(k) || []).slice(s, e + 1)); };

(async function () {
  assert.equal(Lanes.SCOPE.length, 7);
  assert.equal(Lanes.SOFT3.join(','), 'culture,religion,education');
  assert.equal(Lanes.CIVIC.join(','), 'law,population,governance,intelligence');

  var store = new Store();
  var now = Date.now();
  var oriented = await Orientation.boot('culture', { store: store, skipDefaultRedis: true, now: now });
  assert.equal(oriented.ok, true);
  assert.equal(oriented.boot.humanApprovalRequired, false);
  assert.equal(oriented.comprehension.source.memoryOrPrompt, false);
  assert.equal(oriented.comprehension.phases.length, 11);
  assert.equal(oriented.comprehension.grounded, true);
  assert.equal(Orientation.mayAct(oriented.boot, 'paper').ok, true);
  assert.equal(Orientation.mayAct(oriented.boot, 'live').ok, false);
  assert.equal(Orientation.mayAct(null, 'paper').ok, false);

  var sealed = Envelope.seal({
    domainId: 'culture', laneId: 'hero-image', action: 'paper-commissioning',
    payloadHash: Envelope.hash({ n: 1 }), idempotencyKey: 'gate/culture/1',
    decisionReceiptId: 'd1', authorizationReceiptId: 'a1',
    comprehensionReceiptId: oriented.boot.comprehensionReceiptId,
    orientationReceiptId: oriented.boot.orientationReceiptId,
    rollbackReference: 'replace-or-remove',
    outcomeObserverIdentity: 'culture-hero-public-asset-observer/1',
    budgetAuthorization: { budgetId: 'culture-media-budget/1', paperOnly: true, liveMoney: false, spendUsd: 0 },
    now: now
  });
  assert.equal(sealed.ok, true);

  var refused = await Actuator.execute({
    store: store, envelope: sealed.envelope, orientation: null, now: now,
    provider: { dispatch: async function () { throw new Error('must-not-run'); } }
  });
  assert.equal(refused.status, 'HELD');
  assert.match(refused.reason, /orientation/);

  var foreign = Object.assign({}, oriented.boot, { domainId: 'law' });
  var cross = await Actuator.execute({
    store: store, envelope: sealed.envelope, orientation: foreign, now: now,
    adapterGuard: { checkpoint: async function () { return { allowed: true }; } },
    provider: { dispatch: async function () { throw new Error('must-not-run'); } }
  });
  assert.equal(cross.reason, 'g0-actuator-foreign-brain');

  console.log('g0 orientation gate: paper ready, live held, no orientation no fire, foreign brain refused');
})().catch(function (error) { console.error(error); process.exit(1); });
