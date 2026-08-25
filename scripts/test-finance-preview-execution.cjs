#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const Execution = require('../lib/finance-preview-execution.js');
const homology = require('./test-finance-homology.cjs')();
const identities = require('../assets/data/finance-company-identities.json');

const packet = {
  packetId: 'finance:3:test-packet', domainId: 'finance', sourceType: 'server-cognition-refresh',
  generatedAt: '2026-08-24T16:00:00Z', homologyContext: homology,
  truth: { semanticEvidence: [{}, {}], opportunities: [] }
};
const input = {
  companyRegistry: { byCik: { '1234': { slug: 'example_co', name: 'Example Co', ticker: 'EX' } } },
  titleSets: [{ t: '2026-08-24T16:00:00Z', d: 'finance', f: 'SEC', hh: 1, ck: 'headline_title', items: [
    { i: 0, ti: 'Example filing', au: 'https://www.sec.gov/Archives/edgar/data/1234/x', pa: '2026-08-24T15:59:00Z', pl: 'SEC' }
  ] }],
  now: '2026-08-24T16:04:00Z',
  financeCycle: { domain: 'finance', ok: true, domainFunction: { evidence: { l3CurrentEvidenceComplete: true } } },
  packets: [packet],
  marketPayload: { updated: Date.parse('2026-08-24T16:01:00Z'), quotes: { EX: { live: true, price: 10, prevClose: 9.9 } } },
  networkPayload: { generatedAt: '2026-08-24T16:00:30Z', bySlug: { example_co: { total: .2, induced: .1, rank: 'MILD', hub: false, pushed: false } } }
};
const bundle = { input, packet, companies: [{ slug: 'example_co', ticker: 'EX', cik: '1234' }] };
const proposal = {
  schemaVersion: 'finance-manager-proposal/1.0', id: 'manager-preview-1', company: { slug: 'example_co', ticker: 'EX' },
  thesis: 'A named filing warrants a bounded paper review.', invalidation: 'Invalidate if the filing is corrected.', horizonDays: 30,
  scenarios: [{ name: 'base', condition: 'evidence persists', impact: 'monitor' }, { name: 'downside', condition: 'evidence reverses', impact: 'abstain' }],
  evidenceRefs: [{ role: 'semantic', sourceIdentity: { kind: 'headline-title', value: 'finance:SEC:1:0' } }, { role: 'market', sourceIdentity: { kind: 'market-quote-handler', value: 'asset-quote/yahoo-chart' } }, { role: 'network', sourceIdentity: { kind: 'network-snapshot', value: 'limen-stress-slim' } }],
  independenceAssessment: { status: 'UNASSESSED', reason: 'Publisher ownership is not established.' }, paperOnly: true,
  provenance: { producer: 'preview-test', generatedAt: '2026-08-24T16:05:00Z' }
};

function fakeStore() {
  const data = new Map(), log = [];
  return {
    data, log, durableChecks: 0,
    assertDurable() { this.durableChecks++; return true; },
    async get(k) { return data.has(k) ? data.get(k) : null; },
    async setIfAbsent(k, v) { if (data.has(k)) return false; data.set(k, v); return true; },
    async set(k, v) { data.set(k, v); return true; },
    async lpush(k, v) { log.unshift({ k, v }); return log.length; },
    async ltrim() { return true; }
  };
}

(async function () {
  const registryText = fs.readFileSync(require.resolve('../assets/data/company-registry.json'), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(identities.source.sha256, crypto.createHash('sha256').update(registryText, 'utf8').digest('hex'));
  assert.equal(identities.count, Object.keys(identities.byCik).length);
  assert(identities.count > 500);
  const exact = Execution.companiesForTitles([{ items: [{ au: 'https://www.sec.gov/Archives/edgar/data/831001/filing' }] }]);
  assert.equal(exact.length, 1);
  assert.equal(exact[0].slug, 'citigroup');
  assert.equal(exact[0].ticker, 'C');

  const audit = Execution.audit(bundle);
  assert.equal(audit.status, 'READY_FOR_MANAGER_REVIEW');
  assert.equal(audit.packetId, packet.packetId);
  assert.equal(audit.providerCalled, false);
  assert.equal(audit.brokerTouched, false);

  const store = fakeStore();
  let calls = 0;
  const provider = async () => { calls++; return { ok: true, provider: 'fixture', model: 'fixture', text: JSON.stringify(proposal) }; };
  let result = await Execution.execute(store, bundle, { approve: false, packetId: packet.packetId }, { provider });
  assert.equal(result.reason, 'explicit_preview_approval_required');
  assert.equal(calls, 0);
  result = await Execution.execute(store, bundle, { approve: true, packetId: 'finance:3:wrong' }, { provider });
  assert.equal(result.reason, 'approved_packet_must_match_current_packet');
  assert.equal(calls, 0);

  result = await Execution.execute(store, bundle, { approve: true, packetId: packet.packetId }, { provider, now: '2026-08-24T16:06:00Z', completedAt: '2026-08-24T16:06:01Z' });
  assert.equal(result.ok, true);
  assert.equal(result.idempotent, false);
  assert.equal(calls, 1);
  assert.equal(result.receipt.status, 'PAPER_CANDIDATE');
  assert.equal(result.receipt.providerCalled, true);
  assert.equal(result.receipt.brokerTouched, false);
  assert.equal(result.receipt.safety.candidateReleased, false);
  assert.equal(result.receipt.safety.orderPlaced, false);
  assert.equal(result.receipt.safety.liveMoney, false);
  assert.equal(store.log.length, 1);

  const duplicate = await Execution.execute(store, bundle, { approve: true, packetId: packet.packetId }, { provider });
  assert.equal(duplicate.idempotent, true);
  assert.equal(calls, 1);
  assert.equal(store.log.length, 1);

  const failedPacket = Object.assign({}, packet, { packetId: 'finance:3:failed-call' });
  const failedBundle = {
    packet: failedPacket,
    companies: bundle.companies,
    input: Object.assign({}, input, { packets: [failedPacket] })
  };
  const failed = await Execution.execute(fakeStore(), failedBundle, { approve: true, packetId: failedPacket.packetId }, {
    provider: async () => { throw new Error('simulated provider transport failure'); }
  });
  assert.equal(failed.receipt.status, 'ABSTAINED');
  assert.equal(failed.receipt.providerCalled, true);
  assert.equal(failed.receipt.reason, 'finance_manager_provider_failed');

  const invalidPacket = Object.assign({}, packet, { packetId: 'finance:3:invalid-response' });
  const invalidBundle = { packet: invalidPacket, companies: bundle.companies, input: Object.assign({}, input, { packets: [invalidPacket] }) };
  const invalid = await Execution.execute(fakeStore(), invalidBundle, { approve: true, packetId: invalidPacket.packetId }, {
    provider: async () => ({ ok: true, provider: 'fixture', model: 'fixture-model', tokensIn: 8, tokensOut: 9,
      text: JSON.stringify(Object.assign({}, proposal, { horizonDays: [30, 60, 90] })) })
  });
  assert.equal(invalid.receipt.status, 'ABSTAINED');
  assert.equal(invalid.receipt.reason, 'manager_response_horizon_required');
  assert(invalid.receipt.blockers.includes('manager_response_horizon_required'));
  assert.equal(invalid.receipt.provider.name, 'fixture');
  assert.equal(invalid.receipt.provider.model, 'fixture-model');
  assert.equal(invalid.receipt.provider.tokensOut, 9);

  const producerPacket = Object.assign({}, packet, { packetId: 'finance:3:producer-abstention' });
  const producerBundle = { packet: producerPacket, companies: bundle.companies, input: Object.assign({}, input, { packets: [producerPacket] }) };
  const wrongEvidence = JSON.parse(JSON.stringify(proposal));
  wrongEvidence.evidenceRefs[0].sourceIdentity.value = 'not-in-ledger';
  const producerBlocked = await Execution.execute(fakeStore(), producerBundle, { approve: true, packetId: producerPacket.packetId }, {
    provider: async () => ({ ok: true, provider: 'fixture', model: 'fixture-model', text: JSON.stringify(wrongEvidence) })
  });
  assert.equal(producerBlocked.receipt.status, 'ABSTAINED');
  assert.equal(producerBlocked.receipt.reason, 'proposal_evidence_ref_0_not_in_ledger');
  assert(producerBlocked.receipt.blockers.includes('proposal_evidence_ref_0_not_in_ledger'));
  assert.equal(producerBlocked.receipt.candidate.status, 'ABSTAINED');
  assert.equal(producerBlocked.receipt.selectedCompany.slug, 'example_co');

  const notReady = { input: Object.assign({}, input, { financeCycle: null }), packet, companies: bundle.companies };
  result = await Execution.execute(fakeStore(), notReady, { approve: true, packetId: packet.packetId }, { provider });
  assert.equal(result.reason, 'finance_preview_inputs_not_ready');
  assert.equal(calls, 1);

  console.log('finance preview execution: 43/43 passed');
}()).catch(e => { console.error(e); process.exitCode = 1; });
