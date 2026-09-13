'use strict';
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var Cap = require('../lib/product-domain-motor-capability.js');
var Lanes = require('../lib/g0-lane-registry.js');
var Comprehension = require('../lib/g0-domain-comprehension.js');
var Orientation = require('../lib/g0-orientation.js');
var Interdomain = require('../lib/g0-interdomain-request.js');
var Commissioning = require('../lib/g0-domain-loop-commissioning.js');
var Fulfillment = require('../lib/g0-desk-fulfillment.js');
var Afferent = require('../lib/g0-desk-afferent.js');
var Auth = require('../lib/product-domain-motor-authorization.js');

function Store() { this.values = new Map(); this.lists = new Map(); }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (k) { return this.values.has(k) ? structuredClone(this.values.get(k)) : null; };
Store.prototype.set = async function (k, v) { this.values.set(k, structuredClone(v)); return true; };
Store.prototype.setIfAbsent = async function (k, v) { if (this.values.has(k)) return false; this.values.set(k, structuredClone(v)); return true; };
Store.prototype.lpush = async function (k, v) { var a = this.lists.get(k) || []; a.unshift(structuredClone(v)); this.lists.set(k, a); return a.length; };
Store.prototype.ltrim = async function (k, s, e) { this.lists.set(k, (this.lists.get(k) || []).slice(s, e + 1)); return true; };
Store.prototype.lrange = async function (k, s, e) { return structuredClone((this.lists.get(k) || []).slice(s, e + 1)); };

(async function () {
  var root = path.join(__dirname, '..');
  Lanes.all().forEach(function (spec) {
    assert.equal(fs.existsSync(path.join(root, spec.binder)), true, spec.productDomain + ' binder');
    assert.equal(fs.existsSync(path.join(root, spec.executorFile)), true, spec.productDomain + ' executor');
    assert.equal(fs.existsSync(path.join(root, spec.observerFile)), true, spec.productDomain + ' observer');
    assert.equal(fs.existsSync(path.join(root, spec.recoveryFile)), true, spec.productDomain + ' rollback');
  });

  var store = new Store();
  var now = Date.now();
  var ask = Interdomain.seal({
    fromDomain: 'education', toDomain: 'communication',
    purpose: 'publication-ask', requestedValue: 'owned-brief-on-scorecard-release',
    expectedOutcome: 'communication-decides-own-post-or-holds',
    provenance: 'education-governor-paper-request', costUsd: 0, now: now
  });
  assert.equal(ask.ok, true);
  assert.equal(ask.request.sharedConsciousness, false);
  await Interdomain.persist(store, ask.request);
  assert.equal((await Interdomain.inbox(store, 'communication', now)).length, 1);

  var batch = await Commissioning.commissionScope(store, { skipDefaultRedis: true, now: now });
  assert.equal(batch.ok, true);
  assert.equal(batch.humanApprovalRequired, false);
  assert.deepEqual(batch.graduated.slice().sort(), Lanes.SCOPE.slice().sort());
  assert.equal(batch.held.length, 0);

  for (var i = 0; i < Lanes.SCOPE.length; i++) {
    var domain = Lanes.SCOPE[i];
    var spec = Lanes.get(domain);
    var composed = await Comprehension.compose(domain, { store: store, skipDefaultRedis: true, now: now + 10 });
    assert.equal(composed.ok, true, domain + ' comprehension');
    assert.equal(composed.record.grounded, true, domain + ' grounded');
    assert.equal(composed.record.source.memoryOrPrompt, false);
    assert.equal(composed.record.phases.length, 11);
    assert.ok(composed.record.phases.some(function (p) { return p.earned; }), domain + ' earned phase');
    var oriented = await Orientation.boot(domain, {
      store: store, comprehension: composed, skipDefaultRedis: true, now: now + 10
    });
    assert.equal(oriented.boot.canAct, true, domain + ' paper act');
    assert.equal(oriented.boot.humanApprovalRequired, false);
    var motor = await store.get('product_domain_motor_receipt:' + domain);
    var pair = await Cap.verifyPair(store, motor, now + 20);
    assert.equal(pair.ok, true, domain + ' capability pair: ' + (pair.reason || ''));
    var report = await store.get(Commissioning.PREFIX + domain);
    assert.equal(report.status, 'GRADUATED_PAPER');
    assert.equal(report.liveMoney, false);
  }

  assert.equal(Fulfillment.owns('culture'), true);
  assert.equal(Fulfillment.owns('law'), true);
  assert.equal(Fulfillment.owns('religion'), false);
  assert.equal(Fulfillment.owns('finance'), false);

  var welcome = await Fulfillment.enqueueAndAttempt({
    store: store, eventId: 'evt_culture_1', kind: 'welcome', now: now + 30,
    skipDefaultRedis: true,
    subscriber: { email: 'owner@limenhelix.com', domain: 'culture', active: true, watch: 'spotify' },
    message: { subject: 'Your culture watch', body: 'Royalty X-Ray is on.' }
  });
  assert.equal(welcome.status, 'COMPLETED');
  assert.equal(welcome.providerCalls, 0);

  var afferent = await Afferent.record(store, { domainId: 'education', tool: 'education-tools', query: 'Missouri State', now: now + 40 });
  assert.equal(afferent.ok, true);
  assert.equal((await Afferent.latest(store, 'education')).resolvedCount, 1);

  var liveAuth = await Auth.authorize(store, 'culture', 'hero-image', now + 50);
  assert.equal(liveAuth.authorized, false, 'live motor stays held until cognition overlay + env gates open');

  console.log('g0 soft3+civic closed loops: 7/7 paper graduated, desk fulfillment owned, afferent returned, live still gated');
})().catch(function (error) { console.error(error); process.exit(1); });
