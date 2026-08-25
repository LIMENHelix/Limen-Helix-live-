#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Confirmation = require('../lib/finance-feed-confirmation.js');
const homology = require('./test-finance-homology.cjs')();

const packetId = 'finance:3:feed-confirmation';
const now = '2026-08-24T16:02:00Z';
const packet = { packetId, domainId: 'finance', sourceType: 'server-cognition-refresh', generatedAt: '2026-08-24T16:00:00Z', homologyContext: homology };
const input = {
  companyRegistry: { byCik: { '1234': { slug: 'example_co', name: 'Example Co', ticker: 'EX' } } },
  titleSets: [{ t: '2026-08-24T16:00:00Z', d: 'finance', f: 'SEC EDGAR', hh: 1, ck: 'headline_title', items: [
    { i: 0, ti: 'Example issuer material filing', au: 'https://www.sec.gov/Archives/edgar/data/1234/x', pa: '2026-08-24T15:59:00Z', pl: 'SEC' },
    { i: 1, ti: 'Example issuer follow-up', au: 'https://www.sec.gov/Archives/edgar/data/1234/y', pa: '2026-08-24T16:00:00Z', pl: 'SEC' }
  ] }],
  marketPayload: { updated: Date.parse('2026-08-24T16:01:00Z'), quotes: { EX: { live: true, price: 10, prevClose: 9.9 } } },
  networkPayload: { generatedAt: '2026-08-24T16:00:30Z', bySlug: { example_co: { total: 0.2, induced: 0.1, rank: 'MILD', hub: false, pushed: false } } },
  financeCycle: { domain: 'finance', ok: true, domainFunction: { evidence: { l3CurrentEvidenceComplete: true } } },
  packets: [packet],
  now
};
const candidate = {
  company: { cik: '1234', slug: 'example_co', name: 'Example Co', ticker: 'EX' },
  evidenceRefs: [
    { role: 'semantic', sourceIdentity: { kind: 'headline-title', value: 'finance:SEC EDGAR:1:0' } },
    { role: 'market', sourceIdentity: { kind: 'market-quote-handler', value: 'asset-quote/yahoo-chart' } },
    { role: 'network', sourceIdentity: { kind: 'network-snapshot', value: 'limen-stress-slim' } }
  ]
};

const confirmed = Confirmation.build({ bundle: { input, packet }, packetId, candidate, now });
assert.equal(confirmed.schemaVersion, Confirmation.SCHEMA);
assert.equal(confirmed.status, 'CONFIRMED_FOR_TRADE_DECISION');
assert.equal(confirmed.context.semanticEvidence.length, 2);
assert.equal(confirmed.context.semanticEvidence[0].title, 'Example issuer material filing');
assert.deepEqual(confirmed.context.sourceDiversity.feedLabels, ['SEC EDGAR']);
assert.equal(confirmed.context.sourceDiversity.publisherIndependence, 'UNASSESSED');
assert.equal(confirmed.context.interpretationBoundary.directionalClaim, false);
assert.equal(confirmed.context.interpretationBoundary.thing2Used, false);
assert.equal(Confirmation.validate(confirmed, packetId, candidate.company, now).ok, true);

const missingRef = JSON.parse(JSON.stringify(candidate));
missingRef.evidenceRefs[0].sourceIdentity.value = 'finance:SEC EDGAR:1:missing';
const heldRef = Confirmation.build({ bundle: { input, packet }, packetId, candidate: missingRef, now });
assert.equal(heldRef.status, 'ABSTAINED');
assert(heldRef.blockers.includes('finance_feed_confirmation_selected_evidence_not_current'));

const staleInput = JSON.parse(JSON.stringify(input));
staleInput.titleSets[0].t = '2026-08-22T12:00:00Z';
const stale = Confirmation.build({ bundle: { input: staleInput, packet }, packetId, candidate, now });
assert.equal(stale.status, 'ABSTAINED');
assert(stale.blockers.includes('finance_feed_confirmation_fresh_issuer_observation_required'));

const changed = Confirmation.build({ bundle: { input, packet: Object.assign({}, packet, { packetId: 'finance:3:new' }) }, packetId, candidate, now });
assert.equal(changed.status, 'ABSTAINED');
assert(changed.blockers.includes('finance_feed_confirmation_packet_changed'));

assert.equal(Confirmation.validate(confirmed, 'finance:3:other', candidate.company, now).reason, 'finance_feed_confirmation_identity_mismatch');
assert.equal(Confirmation.validate(confirmed, packetId, candidate.company, '2026-08-24T16:30:00Z').reason, 'finance_feed_confirmation_stale');

console.log('finance feed confirmation: current exact-issuer evidence, freshness, identity continuity, and Thing 2 hold passed');
