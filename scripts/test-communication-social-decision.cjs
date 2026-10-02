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
function candidate(now) {
  return { subjectDomain: 'law', text: 'A source-backed fact.\nhttps://limenhelix.com/law',
    sourceIdentity: { kind: 'limen-live-tool-response', value: 'https://limenhelix.com/api/law-tools',
      subjectDomain: 'law', retrievedAt: new Date(now - 100).toISOString(), responseHash: 'a'.repeat(64) } };
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
  assert.equal(released.immuneRouting.route,'PASS');
  const legacy={...released}; delete legacy.immuneRouting;
  assert.equal(Decision.validateReceipt(legacy,candidate(now),now),false);
  for (const scenario of [
    {route:'HOLD',immune:{immuneState:'watch',allowedWithWarning:true}},
    {route:'HOLD',immune:{immuneState:'clear',quarantines:['untrusted-source']}},
    {route:'QUARANTINE',immune:{immuneState:'alert'}},
    {route:'QUARANTINE',immune:{immuneState:'clear'},extra:{candidateQuarantined:true}},
    {route:'REJECT',immune:null},
    {route:'REJECT',immune:{immuneState:'clear'},extra:{invalid:true}}
  ]) {
    const current=brain('communication',now); current.c.immune=scenario.immune;
    const input={...candidate(now),...scenario.extra}; const isolated=new Store();
    const heldRoute=await Decision.decide(isolated,input,now,{cognition:{communication:current,law:brain('law',now)}});
    assert.equal(heldRoute.immuneRouting.route,scenario.route);
    assert.equal(heldRoute.status,'NO_ACTION'); assert.equal(heldRoute.released,false);
    assert.equal(heldRoute.immuneRouting.candidatePreserved,true);
    assert.equal(Decision.validateReceipt(heldRoute,input,now),false);
    assert.deepEqual(await Decision.decide(isolated,input,now,{cognition:{communication:current,law:brain('law',now)}}),heldRoute);
    assert.equal(isolated.log.length,1);
    const cleared=await Decision.decide(isolated,candidate(now+1),now+1,{cognition});
    assert.equal(cleared.status,'RELEASED'); assert.equal(cleared.immuneRouting.route,'PASS');
    assert.equal((await isolated.get(Decision.decisionKey(heldRoute.decisionReceiptId))).immuneRouting.route,scenario.route);
    assert.equal(isolated.log.length,2);
  }


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

  console.log('communication social decision: exact live source, separate Communication and subject packets, B10 brake/selection, salience, strict receipt, and no-action paths passed');
})().catch(function (error) { console.error(error); process.exit(1); });
