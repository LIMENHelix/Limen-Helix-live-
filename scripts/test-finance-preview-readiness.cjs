#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Readiness = require('../lib/finance-preview-readiness.js');

const registry = { byCik: {
  '1234': { slug: 'example_co', name: 'Example Co', ticker: 'EX' },
  '5678': { slug: 'other_co', name: 'Other Co', ticker: 'OT' }
} };
const titles = [{ t: '2026-08-24T16:00:00Z', d: 'finance', f: 'SEC', hh: 1, ck: 'headline_title', items: [
  { i: 0, ti: 'Example filing', au: 'https://www.sec.gov/Archives/edgar/data/1234/x', pa: '2026-08-24T15:59:00Z', pl: 'SEC' },
  { i: 1, ti: 'Unmapped filing', au: 'https://www.sec.gov/Archives/edgar/data/9999/y', pa: '2026-08-24T15:58:00Z', pl: 'SEC' }
] }];
const marketPayload = { updated: Date.parse('2026-08-24T16:01:00Z'), quotes: {
  EX: { live: true, price: 10, prevClose: 9.9 }, OT: { live: true, price: 20, prevClose: 20 }
} };
const networkPayload = { generatedAt: '2026-08-24T16:00:30Z', bySlug: {
  example_co: { total: 0.2, induced: 0.1, rank: 'MILD', hub: false, pushed: false }
} };
const cycle = { domain: 'finance', ok: true, domainFunction: { evidence: { l3CurrentEvidenceComplete: true } } };
const packets = [{ domainId: 'finance', sourceType: 'server-cognition-refresh', generatedAt: '2026-08-24T16:00:00Z' }];

const out = Readiness.build({ companyRegistry: registry, titleSets: titles, marketPayload, networkPayload, financeCycle: cycle, packets, now: '2026-08-24T16:02:00Z' });
assert.equal(out.schemaVersion, Readiness.SCHEMA);
assert.equal(out.inputs.titleItems, 2);
assert.equal(out.inputs.identityCandidates, 1);
assert.equal(out.inputs.marketTickersRequested, 1);
assert.equal(out.inputs.financeCyclePresent, true);
assert.equal(out.inputs.financePacketPresent, true);
assert.equal(out.providerCalled, false);
assert.equal(out.brokerTouched, false);
assert.equal(out.universe.status, 'READY_FOR_MANAGER_REVIEW');
assert.equal(out.universe.candidates[0].company.ticker, 'EX');
assert.equal(out.next, 'operator-preview-gate');

const noCycle = Readiness.build({ companyRegistry: registry, titleSets: titles, marketPayload, networkPayload, packets, now: '2026-08-24T16:02:00Z' });
assert.equal(noCycle.status, 'ABSTAINED');
assert(noCycle.universe.abstentions[0].blockers.includes('finance_cycle_missing_or_not_ok'));
assert.equal(noCycle.providerCalled, false);

const noQuote = Readiness.build({ companyRegistry: registry, titleSets: titles, networkPayload, financeCycle: cycle, packets, now: '2026-08-24T16:02:00Z' });
assert.equal(noQuote.status, 'ABSTAINED');
assert.equal(noQuote.universe.candidates.length, 0);
assert(noQuote.universe.abstentions[0].blockers.includes('market_data_snapshot_invalid'));

console.log('finance preview readiness: 18/18 passed');
