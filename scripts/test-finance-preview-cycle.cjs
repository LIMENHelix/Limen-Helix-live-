#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Cycle = require('../lib/finance-preview-cycle.js');
const homology = require('./test-finance-homology.cjs')();

const registry = { byCik: { '1234': { slug: 'example_co', name: 'Example Co', ticker: 'EX' } } };
const titleSets = [{ t: '2026-08-24T16:00:00Z', d: 'finance', f: 'SEC', hh: 1, ck: 'headline_title', items: [
  { i: 0, ti: 'Example filing', au: 'https://www.sec.gov/Archives/edgar/data/1234/x', pa: '2026-08-24T15:59:00Z', pl: 'SEC' }
] }];
const common = {
  companyRegistry: registry, titleSets, now: '2026-08-24T16:04:00Z',
  financeCycle: { domain: 'finance', ok: true, domainFunction: { evidence: { l3CurrentEvidenceComplete: true } } },
  packets: [{ domainId: 'finance', sourceType: 'server-cognition-refresh', generatedAt: '2026-08-24T16:00:00Z', homologyContext: homology }],
  marketPayload: { updated: Date.parse('2026-08-24T16:01:00Z'), quotes: { EX: { live: true, price: 10, prevClose: 9.9 } } },
  networkPayload: { generatedAt: '2026-08-24T16:00:30Z', bySlug: { example_co: { total: 0.2, induced: 0.1, rank: 'MILD', hub: false, pushed: false } } }
};
const response = {
  schemaVersion: 'finance-manager-proposal/1.1', id: 'manager-preview-1', company: { slug: 'example_co', ticker: 'EX' },
  thesis: 'A named filing warrants a bounded paper review.',
  invalidation: 'Invalidate if the filing is corrected or the market observation reverses.',
  horizonDays: 30,
  scenarios: [{ name: 'base', condition: 'evidence persists', impact: 'monitor' }, { name: 'downside', condition: 'evidence reverses', impact: 'abstain' }],
  projectedMarginRanking: { metric: 'risk-adjusted-expected-total-return-pct', methodology: 'expectedReturnPct - abs(min(downsideReturnPct, 0)) * (1 - confidence)', entries: [{ company: { slug: 'example_co', ticker: 'EX' }, expectedReturnPct: 12, downsideReturnPct: -10, confidence: 0.8, riskAdjustedMarginPct: 10 }] },
  evidenceRefs: [{ role: 'semantic', sourceIdentity: { kind: 'headline-title', value: 'finance:SEC:1:0' } }, { role: 'market', sourceIdentity: { kind: 'market-quote-handler', value: 'asset-quote/yahoo-chart' } }, { role: 'network', sourceIdentity: { kind: 'network-snapshot', value: 'limen-stress-slim' } }],
  independenceAssessment: { status: 'UNASSESSED', reason: 'Publisher ownership and syndication are not established.' },
  paperOnly: true,
  provenance: { producer: 'preview-test', generatedAt: '2026-08-24T16:05:00Z' }
};

(async function () {
  const noProvider = await Cycle.run(common);
  assert.equal(noProvider.status, 'ABSTAINED');
  assert.equal(noProvider.reason, 'preview_provider_not_supplied');
  assert.equal(noProvider.providerCalled, false);
  assert.equal(noProvider.brokerTouched, false);

  let calls = 0;
  const withProvider = await Cycle.run(common, { provider: async function () {
    calls++;
    return { ok: true, provider: 'fixture', model: 'fixture', text: JSON.stringify(response) };
  } });
  assert.equal(calls, 1);
  assert.equal(withProvider.status, 'PAPER_CANDIDATE');
  assert.equal(withProvider.providerCalled, true);
  assert.equal(withProvider.brokerTouched, false);
  assert.equal(withProvider.candidate.liveExecution, false);
  assert.equal(withProvider.candidate.company.ticker, 'EX');
  assert.equal(withProvider.selectedCompany.ticker, 'EX');
  assert.equal(withProvider.manager.candidate.status, 'PAPER_CANDIDATE');

  const blocked = await Cycle.run(Object.assign({}, common, { financeCycle: null }), { provider: async function () { calls++; return null; } });
  assert.equal(blocked.status, 'ABSTAINED');
  assert.equal(blocked.reason, 'finance_preview_inputs_not_ready');
  assert.equal(calls, 1);
  assert.equal(blocked.providerCalled, false);

  console.log('finance preview cycle: 12/12 passed');
}()).catch(function (e) { console.error(e); process.exitCode = 1; });
