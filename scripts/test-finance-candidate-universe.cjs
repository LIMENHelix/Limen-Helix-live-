#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Universe = require('../lib/finance-candidate-universe.js');
const homology = require('./test-finance-homology.cjs')();

function row(slug, ticker, valid) {
  return {
    company: { slug, ticker },
    financeCycle: { domain: 'finance', ok: true, domainFunction: { evidence: { l3CurrentEvidenceComplete: true } } },
    financePacket: { sourceType: 'server-cognition-refresh', generatedAt: '2026-08-24T16:00:00Z', homologyContext: homology },
    semanticEvidence: valid ? [{ sourceIdentity: { kind: 'publisher-item', value: slug + ':item' }, recordedAt: '2026-08-24T15:59:00Z', publisher: 'Official feed', title: 'Named event', canonicalUrl: 'https://example.test/' + slug }] : [],
    marketData: valid ? { asOf: '2026-08-24T16:00:00Z', sources: ['paper-market'], quotes: [{ symbol: ticker, price: 10, observedAt: '2026-08-24T16:00:00Z', sourceIdentity: { kind: 'market', value: slug + ':quote' } }] } : null,
    networkEvidence: valid ? [{ asOf: '2026-08-24T15:59:30Z', value: 0.1, sourceIdentity: { kind: 'network', value: slug + ':network' } }] : [],
    thing1: { applicable: false, reason: 'not-supplied' }, thing2: { applicable: false, reason: 'not-supplied' }, now: '2026-08-24T16:00:00Z'
  };
}

const universe = Universe.build({ asOf: '2026-08-24T16:00:00Z', candidates: [row('alpha_co', 'ALP', true), row('missing_co', 'MIS', false), { company: { slug: 'bad', ticker: '' } }] });
assert.equal(universe.schemaVersion, Universe.SCHEMA);
assert.equal(universe.status, 'READY_FOR_MANAGER_REVIEW');
assert.equal(universe.candidates.length, 1);
assert.equal(universe.abstentions.length, 2);
assert.equal(universe.candidates[0].ledger.status, 'READY_FOR_MANAGER_REVIEW');
assert.equal(universe.selection, 'manager-must-select-an-exact-supplied-company-identity');

const selected = Universe.select(universe, { slug: 'alpha_co', ticker: 'ALP' });
assert.equal(selected.status, 'SELECTED');
assert.equal(selected.candidate.company.slug, 'alpha_co');
assert.equal(Universe.select(universe, { slug: 'other', ticker: 'OTH' }).reason, 'manager_company_not_in_candidate_universe');
assert.equal(Universe.managerContext(universe).companyCandidates.length, 1);
const rankedProposal = {
  company: { slug: 'alpha_co', ticker: 'ALP' },
  projectedMarginRanking: {
    metric: 'risk-adjusted-expected-total-return-pct',
    methodology: 'expectedReturnPct - abs(min(downsideReturnPct, 0)) * (1 - confidence)',
    entries: [{ company: { slug: 'alpha_co', ticker: 'ALP' }, expectedReturnPct: 12, downsideReturnPct: -10, confidence: 0.8, riskAdjustedMarginPct: 10 }]
  }
};
assert.equal(Universe.validateProjectedMarginRanking(universe, rankedProposal).status, 'RANKED');
assert.equal(Universe.validateProjectedMarginRanking(universe, { company: rankedProposal.company }).reason, 'projected_margin_ranking_required');
const arithmetic = JSON.parse(JSON.stringify(rankedProposal)); arithmetic.projectedMarginRanking.entries[0].riskAdjustedMarginPct = 11;
assert.equal(Universe.validateProjectedMarginRanking(universe, arithmetic).ranking.entries[0].riskAdjustedMarginPct, 10);
const negative = JSON.parse(JSON.stringify(rankedProposal)); negative.projectedMarginRanking.entries[0] = { company: rankedProposal.company, expectedReturnPct: -1, downsideReturnPct: -10, confidence: 0.8, riskAdjustedMarginPct: -3 };
assert.equal(Universe.validateProjectedMarginRanking(universe, negative).reason, 'projected_margin_not_positive');
assert.equal(Universe.build({ candidates: [row('none', 'NON', false)] }).status, 'ABSTAINED');
const thirteen = Array.from({ length: 13 }, function (_, i) { return row('co' + i, 'C' + i, true); });
assert.equal(Universe.build({ candidates: thirteen }).truncated, true);

console.log('finance candidate universe: 12/12 passed');
