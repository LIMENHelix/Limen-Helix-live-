#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var Decision = require('../lib/communication-social-decision.js');
var Strict = require('../lib/autofire-efference-store.js');

function Store() { this.map = new Map(); this.log = []; }
Store.prototype.assertDurable = function () { return true; };
Store.prototype.get = async function (key) { return this.map.get(key) || null; };
Store.prototype.set = async function (key, value) { this.map.set(key, JSON.parse(JSON.stringify(value))); return true; };
Store.prototype.setIfAbsent = async function (key, value) { if (this.map.has(key)) return false; await this.set(key, value); return true; };
Store.prototype.lpush = async function (key, value) { this.log.unshift({ key: key, value: value }); return this.log.length; };
Store.prototype.ltrim = async function () { return true; };

function brain(domain, now, options) {
  options = options || {};
  return { ts: now - 1000, c: {
    domain: domain,
    immune: { immuneState: options.immune || 'clear' },
    awareness: { humanReviewRequired: !!options.review },
    brainOrgans: { autonomousInternalEmission: {
      holdReason: options.holdReason || null,
      emittedCount: options.emittedCount === undefined ? 1 : options.emittedCount
    } },
    serverPacket: {
      schemaVersion: 'civilization-domain-packet/1.0', packetId: domain + ':packet', domainId: domain,
      sourceType: 'server-cognition-refresh', generatedAt: new Date(now - 1000).toISOString(),
      sourceIdentity: { producer: 'brain-cognition-refresh/1' },
      truth: { stressScore: options.stress === undefined ? 0.4 : options.stress,
        activeDiagnoses: options.diagnoses || [], opportunities: options.opportunities || [],
        feedHealth: { configured: 2, live: 2 } }
    }
  } };
}
function candidate(now, domain) {
  domain = domain || 'law';
  return { subjectDomain: domain, text: 'A source-backed fact.\nhttps://limenhelix.com/' + domain,
    sourceIdentity: { kind: 'limen-live-tool-response', value: 'https://limenhelix.com/api/' + domain + '-tools',
      subjectDomain: domain, retrievedAt: new Date(now - 100).toISOString(), responseHash: 'a'.repeat(64) } };
}

(async function () {
  var now = 100000;
  assert.equal(Strict.assertKey(Decision.LOG_KEY), Decision.LOG_KEY);
  assert.equal(Strict.assertKey(Decision.decisionKey('x')), Decision.decisionKey('x'));
  var cognition = { communication: brain('communication', now), law: brain('law', now) };
  var store = new Store();
  var released = await Decision.decide(store, candidate(now), now, { cognition: cognition });
  assert.equal(released.status, 'RELEASED');
  assert.equal(released.decisionContract, 'public-message-decision/1');
  assert.equal(Decision.validateReceipt(released, { subjectDomain: 'law', text: candidate(now).text }, now), true);
  assert.equal(store.log.length, 1);

  var brake = { communication: brain('communication', now, { holdReason: 'brake-dampen' }), law: brain('law', now) };
  var heldStore = new Store();
  var held = await Decision.decide(heldStore, candidate(now), now, { cognition: brake });
  assert.equal(held.status, 'NO_ACTION');
  assert(held.blockers.includes('communication-b10-brake-held:brake-dampen'));
  assert.equal((await heldStore.get(Decision.decisionKey(held.decisionReceiptId))).status, 'NO_ACTION');
  assert.equal(heldStore.log.length, 1);

  var noSelection = { communication: brain('communication', now, { emittedCount: 0 }), law: brain('law', now) };
  held = await Decision.decide(new Store(), candidate(now), now, { cognition: noSelection });
  assert(held.blockers.includes('communication-b10-no-action-selected'));

  var noSalience = { communication: brain('communication', now), law: brain('law', now, { stress: 0.1 }) };
  held = await Decision.decide(new Store(), candidate(now), now, { cognition: noSalience });
  assert(held.blockers.includes('subject-brain-no-salient-condition'));

  var stale = candidate(now);
  stale.sourceIdentity.retrievedAt = new Date(now - Decision.MAX_SOURCE_AGE_MS - 1).toISOString();
  held = await Decision.decide(new Store(), stale, now, { cognition: cognition });
  assert.equal(held.reason, 'communication-b10-candidate-refused');

  var Override = require('../lib/communication-social-operator-override.js');
  var economyBrake = {
    communication: brain('communication', now, { holdReason: 'brake-dampen', emittedCount: 0 }),
    economy: brain('economy', now)
  };
  var noOverride = await Decision.decide(new Store(), candidate(now, 'economy'), now, { cognition: economyBrake });
  assert.equal(noOverride.status, 'NO_ACTION');
  assert.equal(noOverride.reason, 'communication-b10-held');
  assert(noOverride.blockers.includes('communication-b10-brake-held:brake-dampen'));
  assert(noOverride.blockers.includes('communication-b10-no-action-selected'));

  var otherDomain = await Decision.decide(new Store(), candidate(now, 'law'), now, {
    cognition: { communication: economyBrake.communication, law: brain('law', now) },
    allowOperatorOverride: true
  });
  assert.equal(otherDomain.status, 'NO_ACTION');
  assert(otherDomain.blockers.includes('communication-b10-brake-held:brake-dampen'));

  var overrideStore = new Store();
  var minted = await Override.mint(overrideStore, {
    subjectDomain: 'economy', operatorKeyClass: 'SOCIAL_CRON_KEY', now: now
  });
  assert.equal(minted.ok, true);
  var releasedOnce = await Decision.decide(overrideStore, candidate(now, 'economy'), now, {
    cognition: economyBrake, allowOperatorOverride: true
  });
  assert.equal(releasedOnce.status, 'RELEASED');
  assert.equal(releasedOnce.released, true);
  assert.equal(releasedOnce.subjectDomain, 'economy');
  assert.equal(releasedOnce.operatorOverride.operatorKeyClass, 'SOCIAL_CRON_KEY');
  assert.equal(releasedOnce.operatorOverride.decisionReceiptId, releasedOnce.decisionReceiptId);
  assert(releasedOnce.selectionReasons.includes('operator-override-economy-b10-release'));
  assert.equal((await overrideStore.get(Override.receiptKey('economy'))).status, 'CONSUMED');

  var second = await Decision.decide(overrideStore, candidate(now, 'economy'), now, {
    cognition: economyBrake, allowOperatorOverride: true
  });
  assert.equal(second.status, 'NO_ACTION');
  assert(second.blockers.includes('communication-b10-brake-held:brake-dampen'));

  var immuneHeld = await Decision.decide(new Store(), candidate(now, 'economy'), now, {
    cognition: {
      communication: brain('communication', now, { holdReason: 'brake-dampen', immune: 'veto' }),
      economy: brain('economy', now)
    },
    allowOperatorOverride: true
  });
  assert.equal(immuneHeld.status, 'NO_ACTION');
  assert(immuneHeld.blockers.includes('communication-immune-veto'));

  console.log('communication social decision: exact live source, separate Communication and subject packets, B10 brake/selection, salience, strict receipt, no-action, and economy operator-override paths passed');
})().catch(function (error) { console.error(error); process.exit(1); });
