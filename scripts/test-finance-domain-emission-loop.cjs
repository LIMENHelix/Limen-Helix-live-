#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Packet = require('../lib/civilization-server-packet.js');
const Intake = require('../lib/finance-domain-intake.js');
const Readiness = require('../lib/finance-preview-readiness.js');
const Afferent = require('../lib/energy-finance-afferent-learning.js');
const StrictStore = require('../lib/autofire-efference-store.js');
const EnergyExecutor = require('../lib/energy-investment-executor.js');
const homology = require('./test-finance-homology.cjs')();

function packet(domain, opportunity, emissions) {
  return Packet.buildPacket({
    schemaVersion: Packet.PACKET_SCHEMA,
    sourceType: 'server-cognition-refresh',
    domainId: domain,
    domainLabel: domain,
    cycleId: '7',
    generatedAt: '2026-09-29T20:00:00.000Z',
    sourceIdentity: {
      snapshotId: domain + '-snapshot',
      retrievedAt: '2026-09-29T19:59:00.000Z',
      refreshId: 'refresh-7',
      producer: 'test'
    },
    homologyContext: domain === 'finance' ? homology : null,
    truth: {
      stressScore: .7,
      confidence: .8,
      activityLevel: 'high',
      phase: 'p3',
      phaseLabel: 'RHYTHM',
      activeDiagnoses: [{ id: domain + '-dx' }],
      treatments: [{ id: domain + '-tx' }],
      opportunities: opportunity ? [opportunity] : [],
      crossDomainEmissions: emissions || [],
      directives: [],
      feedHealth: { configured: 1, live: 1 }
    }
  });
}

function fakePacketStore(packets) {
  const data = new Map();
  packets.forEach((value) => data.set('packet:' + value.packetId, value));
  return {
    packetIndexKey: 'packet-index',
    configured() { return true; },
    async members(key) { assert.equal(key, 'packet-index'); return packets.map((value) => value.packetId); },
    packetKey(id) { return 'packet:' + id; },
    async get(key) { return data.get(key) || null; }
  };
}

function fakeLearningStore() {
  const data = new Map();
  return {
    assertDurable() {},
    async get(key) { StrictStore.assertKey(key); return data.has(key) ? data.get(key) : null; },
    async set(key, value) { StrictStore.assertKey(key); data.set(key, JSON.parse(JSON.stringify(value))); },
    async setIfAbsent(key, value) {
      StrictStore.assertKey(key);
      if (data.has(key)) return false;
      data.set(key, JSON.parse(JSON.stringify(value)));
      return true;
    }
  };
}

(async function () {
  assert.throws(() => StrictStore.assertKey('energy_finance_afferent_cause:'), /refusing key/);
  assert.throws(() => StrictStore.assertKey('energy_finance_afferent_state:other'), /refusing key/);
  assert.throws(() => StrictStore.assertKey('energy_finance_afferent_unrelated'), /refusing key/);
  const energyPacket = packet('energy', {
    id: 'energy-opp-1', title: 'Grid resilience company', path: 'INVESTABLE', ticker: 'EX',
    evidenceIds: ['energy-evidence-1']
  }, [{ sourceDomain: 'energy', targetDomain: 'finance', signal: 'grid-capital-pressure', magnitude: .8 }]);
  const agriculturePacket = packet('agriculture', {
    id: 'ag-opp-1', title: 'Homestead service opportunity', path: 'RESEARCHABLE'
  }, [{ sourceDomain: 'agriculture', targetDomain: 'energy', signal: 'biofuel-input-stress', magnitude: .5 }]);

  assert.equal(energyPacket.truth.crossDomainEmissions.length, 1);
  const intake = await Intake.read(fakePacketStore([energyPacket, agriculturePacket]));
  assert.equal(intake.status, 'OBSERVED');
  assert.equal(intake.records.length, 4);
  assert.equal(intake.financeRelevant.length, 2);
  assert.equal(intake.financeRelevant[0].authority.sourceMayDecideInvestment, false);
  assert.equal(intake.financeRelevant[0].authority.executionInstruction, false);
  const mismatchedStore = fakePacketStore([energyPacket]);
  mismatchedStore.get = async () => agriculturePacket;
  const mismatchedIntake = await Intake.read(mismatchedStore);
  assert.equal(mismatchedIntake.records.length, 0, 'a different packet must not borrow an indexed identity');
  assert.equal(mismatchedIntake.abstentions[0].reason, 'packet-key-identity-mismatch');

  const ready = Readiness.build({
    companyRegistry: { byCik: { '1234': { slug: 'example_co', ticker: 'EX' } } },
    titleSets: [{ t: '2026-09-29T19:59:00Z', d: 'finance', f: 'SEC', hh: 1, ck: 'headline_title', items: [{ i: 0, ti: 'Finance filing', au: 'https://www.sec.gov/Archives/edgar/data/1234/x', pa: '2026-09-29T19:59:00Z', pl: 'SEC', ck: 'headline_title' }] }],
    now: '2026-09-29T20:01:00Z',
    financeCycle: { domain: 'finance', ok: true, domainFunction: { evidence: { l3CurrentEvidenceComplete: true } } },
    packets: [packet('finance', null, [])],
    marketPayload: { quotes: { EX: { live: true, price: 10, prevClose: 9.9 } }, updated: Date.parse('2026-09-29T20:00:30Z') },
    networkPayload: { generatedAt: '2026-09-29T20:00:30Z', bySlug: { example_co: { total: .2, induced: .1, rank: 'MILD', hub: false, pushed: false } } },
    domainIntake: intake,
    domainEmissions: intake.financeRelevant
  });
  assert.equal(ready.status, 'READY_FOR_MANAGER_REVIEW');
  assert.equal(ready.inputs.domainEmissionCount, 2);
  assert.equal(ready.universe.domainEmissions.length, 2);
  assert.equal(ready.universe.candidates[0].ledger.ledger.domainEmissions.length, 1);
  assert.equal(ready.universe.candidates[0].ledger.ledger.company.ticker, 'EX');

  const learning = fakeLearningStore();
  const event = {
    eventId: 'event-1', actionId: 'finance-action-1', ownerDomain: 'finance', lane: 'investment',
    eventType: 'OUTCOME_INVESTMENT_PNL', ts: Date.now(),
    sourceIdentity: { kind: 'tradier-sandbox-account-snapshot', value: 'account:test:snap', provider: 'tradier' },
    outcomeData: { netPnl: 4.25 }
  };
  const command = { intent: { decisionContext: { sourceDomains: [{ sourceDomain: 'energy', sourcePacketId: energyPacket.packetId, opportunityId: 'energy-opp-1' }] } } };
  const rejectedStore = fakeLearningStore();
  for (const rejectedResult of [null, {}, { ok: false }, { ok: true, learningAccepted: false }]) {
    const rejected = await Afferent.record(rejectedStore, event, command, rejectedResult);
    assert.equal(rejected.status, 'ABSTAINED');
    assert.equal(rejected.reason, 'finance-outcome-record-not-accepted');
    assert.equal((await Afferent.readForBrain(rejectedStore)).status, 'ABSTAINED');
    assert.equal(await rejectedStore.get(Afferent.causeKey(event.eventId)), null);
    assert.equal(await rejectedStore.get(Afferent.STATE_KEY), null);
  }
  const recovered = await Afferent.record(rejectedStore, event, command, { ok: true, learningAccepted: true, assessment: { reward: 1 } });
  assert.equal(recovered.ok, true);
  assert.equal(recovered.resolvedCount, 1);
  assert.equal((await Afferent.readForBrain(rejectedStore)).signal.eventId, event.eventId);
  const beforeRejectedReplay = JSON.stringify(await rejectedStore.get(Afferent.STATE_KEY));
  const rejectedReplay = await Afferent.record(rejectedStore, event, command, { ok: false });
  assert.equal(rejectedReplay.reason, 'finance-outcome-record-not-accepted');
  assert.equal(JSON.stringify(await rejectedStore.get(Afferent.STATE_KEY)), beforeRejectedReplay);
  const returned = await Afferent.record(learning, event, command, { ok: true, learningAccepted: true, assessment: { reward: 1 } });
  assert.equal(returned.ok, true);
  assert.equal(returned.signal.sourceDomains[0].sourceDomain, 'energy');
  const readout = await Afferent.readForBrain(learning);
  assert.equal(readout.status, 'ELIGIBLE');
  assert.equal(readout.signal.outcome, 'POSITIVE_PNL');
  const duplicate = await Afferent.record(learning, event, command, { ok: true, learningAccepted: true, assessment: { reward: 1 } });
  assert.equal(duplicate.duplicate, true);

  const agedStore = fakeLearningStore();
  for (let i = 0; i <= 2000; i++) {
    await Afferent.record(agedStore, Object.assign({}, event, { eventId: 'aged-event-' + i }), command, { ok: true, learningAccepted: true });
  }
  const agedBefore = JSON.stringify(await agedStore.get(Afferent.STATE_KEY));
  const agedReplay = await Afferent.record(agedStore, Object.assign({}, event, { eventId: 'aged-event-0' }), command, { ok: true, learningAccepted: true });
  assert.equal(agedReplay.duplicate, true);
  assert.equal(agedReplay.signal, undefined, 'a permanently recorded old event must not issue a second return signal');
  assert.equal(JSON.stringify(await agedStore.get(Afferent.STATE_KEY)), agedBefore, 'aged replay must not earn resolved credit twice');

  await assert.rejects(() => Afferent.record(agedStore, Object.assign({}, event, { eventId: 'aged-event-0', actionId: 'different-action' }), command, { ok: true, learningAccepted: true }), /cause identity mismatch/);
  assert.equal(JSON.stringify(await agedStore.get(Afferent.STATE_KEY)), agedBefore);

  const interruptedStore = fakeLearningStore();
  const interruptedSet = interruptedStore.set;
  let failState = true;
  interruptedStore.set = async (key, value) => {
    if (key === Afferent.STATE_KEY && failState) throw new Error('simulated state write failure');
    return interruptedSet(key, value);
  };
  await assert.rejects(() => Afferent.record(interruptedStore, event, command, { ok: true }), /simulated state write failure/);
  assert.equal((await interruptedStore.get(Afferent.causeKey(event.eventId))).status, 'PENDING');
  assert.equal(await interruptedStore.get(Afferent.STATE_KEY), null);
  failState = false;
  const repairedPending = await Afferent.record(interruptedStore, event, command, { ok: true });
  assert.equal(repairedPending.resolvedCount, 1);
  assert.equal((await interruptedStore.get(Afferent.causeKey(event.eventId))).status, 'RECORDED');

  const completionStore = fakeLearningStore();
  const completionSet = completionStore.set;
  let failCompletion = true;
  completionStore.set = async (key, value) => {
    if (key === Afferent.causeKey(event.eventId) && failCompletion) throw new Error('simulated completion write failure');
    return completionSet(key, value);
  };
  await assert.rejects(() => Afferent.record(completionStore, event, command, { ok: true }), /simulated completion write failure/);
  assert.equal((await completionStore.get(Afferent.STATE_KEY)).resolvedCount, 1);
  failCompletion = false;
  const completedRetry = await Afferent.record(completionStore, event, command, { ok: true });
  assert.equal(completedRetry.duplicate, true);
  assert.equal(completedRetry.signal, undefined);
  assert.equal((await completionStore.get(Afferent.STATE_KEY)).resolvedCount, 1);
  assert.equal((await completionStore.get(Afferent.causeKey(event.eventId))).status, 'RECORDED');

  const pendingAgedStore = fakeLearningStore();
  const pendingAgedSet = pendingAgedStore.set;
  pendingAgedStore.set = async (key, value) => {
    if (key === Afferent.causeKey(event.eventId)) throw new Error('completion unavailable');
    return pendingAgedSet(key, value);
  };
  await assert.rejects(() => Afferent.record(pendingAgedStore, event, command, { ok: true }), /completion unavailable/);
  pendingAgedStore.set = pendingAgedSet;
  // Model retained state after other events advanced and evicted this pending ID.
  const advanced = await pendingAgedStore.get(Afferent.STATE_KEY);
  advanced.processedEventIds = [];
  advanced.signals = [];
  advanced.resolvedCount = 2001;
  await pendingAgedStore.set(Afferent.STATE_KEY, advanced);
  const pendingAgedBefore = JSON.stringify(await pendingAgedStore.get(Afferent.STATE_KEY));
  const pendingAgedReplay = await Afferent.record(pendingAgedStore, event, command, { ok: true });
  assert.equal(pendingAgedReplay.reason, 'energy-finance-afferent-pending-cause-reconciliation-required');
  assert.equal(JSON.stringify(await pendingAgedStore.get(Afferent.STATE_KEY)), pendingAgedBefore);

  const legacyStore = fakeLearningStore();
  await legacyStore.set(Afferent.causeKey(event.eventId), { schemaVersion: Afferent.SCHEMA, eventId: event.eventId, sourceDomains: command.intent.decisionContext.sourceDomains });
  const legacy = await Afferent.record(legacyStore, event, command, { ok: true });
  assert.equal(legacy.reason, 'energy-finance-afferent-legacy-cause-reconciliation-required');
  assert.equal(await legacyStore.get(Afferent.STATE_KEY), null);

  const wrongReadStore = fakeLearningStore();
  const originalGet = wrongReadStore.get;
  wrongReadStore.get = async key => {
    const value = await originalGet(key);
    return key === Afferent.causeKey(event.eventId) && value ? Object.assign({}, value, { eventId: 'wrong-key-event' }) : value;
  };
  await assert.rejects(() => Afferent.record(wrongReadStore, event, command, { ok: true }), /cause readback invalid/);
  assert.equal(await wrongReadStore.get(Afferent.STATE_KEY), null);

  const quarantined = await EnergyExecutor.execute({
    broker: { quote: async () => { throw new Error('broker must not be called'); } },
    b14: { createPreview: async () => { throw new Error('B14 must not be called'); } }
  });
  assert.equal(quarantined.status, 'HELD');
  assert.equal(quarantined.reason, 'energy-investment-exact-b10-decision-required');
  assert.equal(quarantined.brokerCalls, 0);
  assert.equal(quarantined.orderSubmissionCalls, 0);

  console.log('finance domain emission loop: packet preservation, Finance intake, source-context evaluation, and Energy afferent return passed');
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });

