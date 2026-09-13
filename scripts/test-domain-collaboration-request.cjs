'use strict';

var assert = require('node:assert/strict');
var Collaboration = require('../lib/domain-collaboration-request.js');
var Strict = require('../lib/autofire-efference-store.js');

function Store() { this.values = new Map(); this.lists = new Map(); this.writes = 0; }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) { return this.values.has(key) ? structuredClone(this.values.get(key)) : null; };
Store.prototype.setIfAbsent = async function (key, value) {
  if (this.values.has(key)) return false;
  this.values.set(key, structuredClone(value)); this.writes++; return true;
};
Store.prototype.lpush = async function (key, value) {
  var list = this.lists.get(key) || []; list.unshift(structuredClone(value)); this.lists.set(key, list); this.writes++; return list.length;
};
Store.prototype.ltrim = async function (key, start, end) {
  this.lists.set(key, (this.lists.get(key) || []).slice(start, end + 1)); this.writes++; return true;
};
Store.prototype.lrange = async function (key, start, end) {
  return structuredClone((this.lists.get(key) || []).slice(start, end + 1));
};

function grounding(domain) {
  return {
    ok: true,
    packet: {
      schemaVersion: 'domain-governor-briefing/1.0',
      domainId: domain,
      packetId: 'governor-' + domain,
      sourcePacketId: 'civilization-' + domain,
      readiness: { canReason: true },
      truthPolicy: { modelNarrativeCannotGrantAuthority: true }
    }
  };
}

(async function () {
  assert.equal(Strict.assertKey(Collaboration.LOG_KEY), Collaboration.LOG_KEY);
  assert.equal(Strict.assertKey(Collaboration.PREFIX + 'x'), Collaboration.PREFIX + 'x');
  assert.equal(Strict.assertKey(Collaboration.INBOX_PREFIX + 'finance'), Collaboration.INBOX_PREFIX + 'finance');

  var now = Date.now();
  var store = new Store();
  var input = {
    fromDomain: 'science',
    toDomain: 'communication',
    idempotencyKey: 'science-publication-1',
    purpose: 'publish-source-grounded-trial-summary',
    requestedService: 'evaluate one owned publication candidate',
    expectedOutcome: 'Communication independently publishes or refuses with a receipt',
    evidenceIds: ['science-packet-1', 'trial-record-4'],
    offeredCents: 0,
    requestedBudgetCents: 0,
    expiresAt: now + 60_000
  };
  var offered = await Collaboration.propose(store, input, {
    now: now,
    buildGrounding: async function (domain) { return grounding(domain); }
  });
  assert.equal(offered.ok, true);
  assert.equal(offered.created, true);
  assert.equal(offered.request.status, 'OFFERED');
  assert.equal(offered.request.targetDecisionRequired, true);
  assert.equal(offered.request.targetAuthorityBorrowed, false);
  assert.equal(offered.request.targetBrainMutationAllowed, false);
  assert.equal(offered.request.moneyMoved, false);
  assert.equal(offered.request.externalEffectExecuted, false);

  var inbox = await Collaboration.inbox(store, 'communication', now + 1);
  assert.equal(inbox.ok, true);
  assert.equal(inbox.requests.length, 1);
  assert.equal(inbox.requests[0].fromDomain, 'science');

  var duplicate = await Collaboration.propose(store, input, {
    now: now + 100,
    buildGrounding: async function (domain) { return grounding(domain); }
  });
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.created, false);
  assert.equal((await Collaboration.inbox(store, 'communication', now + 1)).requests.length, 1);

  var conflict = await Collaboration.propose(store, Object.assign({}, input, { requestedService: 'different service' }), {
    now: now + 101,
    buildGrounding: async function (domain) { return grounding(domain); }
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.reason, 'collaboration-idempotency-conflict');

  var before = store.writes;
  var forged = await Collaboration.propose(store, input, {
    now: now + 2,
    buildGrounding: async function () { return grounding('finance'); }
  });
  assert.equal(forged.ok, false);
  assert.equal(forged.reason, 'source-domain-grounding-not-actionable');
  assert.equal(store.writes, before);

  var stale = await Collaboration.propose(store, Object.assign({}, input, { purpose: 'second-request' }), {
    now: now + 3,
    buildGrounding: async function (domain) {
      var value = grounding(domain); value.packet.readiness.canReason = false; return value;
    }
  });
  assert.equal(stale.ok, false);
  assert.equal(store.writes, before);

  assert.equal(Collaboration.validateInput(Object.assign({}, input, { toDomain: 'science' }), now).ok, false);
  assert.equal(Collaboration.validateInput(Object.assign({}, input, { evidenceIds: [] }), now).ok, false);
  assert.equal(Collaboration.validateInput(Object.assign({}, input, { requestedBudgetCents: -1 }), now).ok, false);
  assert.equal((await Collaboration.inbox(store, 'communication', now + 60_001)).requests.length, 0);

  console.log('domain collaboration request: grounded source, typed contract, idempotent inbox, expiry, and no borrowed authority/money/effect passed');
})().catch(function (error) { console.error(error); process.exit(1); });
