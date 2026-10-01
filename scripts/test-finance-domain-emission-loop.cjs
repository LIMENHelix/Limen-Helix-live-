#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Packet = require('../lib/civilization-server-packet.js');
const Intake = require('../lib/finance-domain-intake.js');
const Readiness = require('../lib/finance-preview-readiness.js');
const Afferent = require('../lib/energy-finance-afferent-learning.js');
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
    async get(key) { return data.has(key) ? data.get(key) : null; },
    async set(key, value) { data.set(key, JSON.parse(JSON.stringify(value))); },
    async setIfAbsent(key, value) {
      if (data.has(key)) return false;
      data.set(key, JSON.parse(JSON.stringify(value)));
      return true;
    }
  };
}

(async function () {
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
  const returned = await Afferent.record(learning, event, command, { assessment: { reward: 1 } });
  assert.equal(returned.ok, true);
  assert.equal(returned.signal.sourceDomains[0].sourceDomain, 'energy');
  const readout = await Afferent.readForBrain(learning);
  assert.equal(readout.status, 'ELIGIBLE');
  assert.equal(readout.signal.outcome, 'POSITIVE_PNL');
  const duplicate = await Afferent.record(learning, event, command, { assessment: { reward: 1 } });
  assert.equal(duplicate.duplicate, true);

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

