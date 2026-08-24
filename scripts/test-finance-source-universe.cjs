#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Source = require('../lib/finance-source-universe.js');

const titleSets = [{
  t: '2026-08-24T16:00:00Z', d: 'finance', f: 'SEC EDGAR Filings', ck: 'headline_title', hh: 123,
  items: [
    { i: 0, ti: 'Example filing', au: 'https://www.sec.gov/Archives/edgar/data/1234/0001-index.htm', pa: '2026-08-24T15:59:00Z', pl: 'SEC' },
    { i: 1, ti: 'Unknown filing', au: 'https://www.sec.gov/Archives/edgar/data/9999/0002-index.htm', pa: '2026-08-24T15:58:00Z', pl: 'SEC' },
    { i: 2, ti: 'No identity', au: 'https://example.test/item', pa: '2026-08-24T15:57:00Z', pl: 'Feed' }
  ]
}];
const common = {
  domain: 'finance', titleSets,
  now: '2026-08-24T16:04:00Z',
  companies: [{ cik: '00001234', slug: 'example_co', ticker: 'EX', name: 'Example Co' }],
  financeCycle: { domain: 'finance', ok: true, domainFunction: { evidence: { l3CurrentEvidenceComplete: true } } },
  financePacket: { sourceType: 'server-cognition-refresh', generatedAt: '2026-08-24T16:00:00Z' },
  marketDataByTicker: { EX: { asOf: '2026-08-24T16:00:00Z', sources: ['quote'], quotes: [{ symbol: 'EX', price: 10, observedAt: '2026-08-24T16:00:00Z', sourceIdentity: { kind: 'market', value: 'quote' } }] } },
  networkBySlug: { example_co: { asOf: '2026-08-24T16:00:00Z', value: 0.1, sourceIdentity: { kind: 'network', value: 'stress-slim' } } }
};

assert.equal(Source.cikFromRecord('https://www.sec.gov/Archives/edgar/data/00001234/x'), '1234');
assert.equal(Source.cikFromRecord('cik:00001234'), '1234');
assert.equal(Source.cikFromRecord('https://example.test/no-cik'), null);
assert.deepEqual(Source.identityIndex(common.companies).collisions, []);
const out = Source.assemble(common);
assert.equal(out.schemaVersion, Source.SCHEMA);
assert.equal(out.mappedCikCount, 1);
assert.equal(out.universe.status, 'READY_FOR_MANAGER_REVIEW');
assert.equal(out.universe.candidates.length, 1);
assert.equal(out.universe.candidates[0].company.slug, 'example_co');
assert.equal(out.universe.candidates[0].ledger.ledger.semanticEvidence.length, 1);
assert.equal(out.universe.candidates[0].ledger.ledger.marketData.quotes[0].symbol, 'EX');
assert.equal(out.sourceAbstentions.some((x) => x.reason === 'title_cik_not_in_company_identity_index'), true);
assert.equal(out.sourceAbstentions.some((x) => x.reason === 'title_identity_has_no_sec_cik'), true);

const missingMarket = Source.assemble(Object.assign({}, common, { marketDataByTicker: {} }));
assert.equal(missingMarket.universe.status, 'ABSTAINED');
assert.equal(missingMarket.universe.abstentions[0].reason, 'candidate_inputs_not_ready');
assert(missingMarket.universe.abstentions[0].blockers.includes('market_data_snapshot_invalid'));

const collision = Source.assemble(Object.assign({}, common, {
  companies: common.companies.concat([{ cik: '1234', slug: 'other_co', ticker: 'OT' }])
}));
assert.equal(collision.universe.status, 'ABSTAINED');
assert.equal(collision.identityCollisions.length, 1);
assert(collision.sourceAbstentions.some((x) => x.reason === 'company_identity_cik_collision'));

const aggregateOnly = Source.assemble(Object.assign({}, common, {
  marketDataByTicker: { EX: { asOf: '2026-08-24T16:00:00Z', sources: ['aggregate'], quotes: [{ symbol: 'SPY', price: 500, observedAt: '2026-08-24T16:00:00Z', sourceIdentity: { kind: 'market', value: 'aggregate' } }] } }
}));
assert.equal(aggregateOnly.universe.status, 'ABSTAINED');
assert(aggregateOnly.universe.abstentions[0].blockers.includes('market_data_snapshot_invalid'));

console.log('finance source universe: 17/17 passed');
