'use strict';

var assert = require('assert');
var C = require('../lib/autofire-outcome-contract.js');

var base = { outputId: 'eo_research_1', actionId: 'act_1', observationId: 'obs_1', observedAt: '2026-08-24T00:00:00Z', ownerDomain: 'research' };
var pub = C.buildResearchPublication(Object.assign({}, base, {
  publicationId: 'pub_1', publishedAt: '2026-08-23T00:00:00Z',
  sourceIdentity: { kind: 'external-publication', value: 'doi:10.1234/example', publisher: 'Example Press', url: 'https://example.test/paper', retrievedAt: '2026-08-24T00:01:00Z', contentHash: 'sha256:abc' }
}));
assert.strictEqual(pub.schemaVersion, C.SCHEMA_VERSION);
assert.strictEqual(pub.eventType, 'OUTCOME_RESEARCH_PUBLISHED');
assert.strictEqual(pub.outcomeData.independenceAssessment.status, 'UNESTABLISHED');
assert.strictEqual(pub.outcomeData.sourceIdentity.contentHash, 'sha256:abc');

var evalEvent = C.buildResearchEvaluation(Object.assign({}, base, {
  observationId: 'obs_2', sourceIdentity: { kind: 'external-evaluation', value: 'eval_1' },
  outcomeData: {
    progress: 'PROGRESS', evidenceIds: ['doi:1'],
    independenceAssessment: { status: 'ESTABLISHED', basis: ['publisher-a', 'publisher-b'] },
    mappingCoverage: { neurology_to_business_homology: true, business_to_neurology_homology: true, kernel_dynamics: true, p0_p10_proof_and_effects: true },
    contradictions: [], retractions: []
  }
}));
assert.strictEqual(evalEvent.eventType, 'OUTCOME_RESEARCH_EVALUATED');
assert.deepStrictEqual(evalEvent.outcomeData.evidenceIds, ['doi:1']);

var inv = C.buildInvestmentPnl({
  outputId: 'eo_investment_1', actionId: 'act_i', observationId: 'obs_i', observedAt: '2026-08-24T00:00:00Z', ownerDomain: 'finance',
  sourceIdentity: { kind: 'broker-account-snapshot', value: 'tradier:order:77', provider: 'tradier', accountId: 'VA123', snapshotId: 'snap_1' },
  benchmarkIdentity: { kind: 'benchmark-series', value: 'SPY:2026-08-24' }, benchmarkBaselineValue: 500, benchmarkObservedValue: 505,
  outcomeData: { horizonDays: 30, investedAmount: 100, netPnl: 4, returnPct: 4, benchmarkReturnPct: 1, maxDrawdownPct: 2, riskBreach: false, executionMode: 'paper', brokerOrderId: '77' }
});
assert.strictEqual(inv.eventType, 'OUTCOME_INVESTMENT_PNL');
assert.strictEqual(inv.outcomeData.executionMode, 'paper');
assert.strictEqual(inv.outcomeData.brokerOrderId, '77');

assert.throws(function () { C.buildResearchPublication(Object.assign({}, base, { stress: 1 })); }, /cannot create an outcome/);
assert.throws(function () { C.buildResearchEvaluation(Object.assign({}, base, { sourceIdentity: { kind: 'x', value: 'y' }, outcomeData: { progress: 'PROGRESS', evidenceIds: ['x'], independenceAssessment: { status: 'ESTABLISHED' }, mappingCoverage: {} } })); }, /must be true/);
assert.throws(function () { C.buildInvestmentPnl({ outputId: 'x', actionId: 'a', observationId: 'o', observedAt: 't', ownerDomain: 'finance', sourceIdentity: { kind: 'x', value: 'y', provider: 'tradier', accountId: 'VA1', snapshotId: 's' }, benchmarkIdentity: { kind: 'x', value: 'b' }, benchmarkBaselineValue: 1, benchmarkObservedValue: 2, outcomeData: { horizonDays: 30, investedAmount: 1, netPnl: 1, returnPct: 1, benchmarkReturnPct: 1, maxDrawdownPct: 0, riskBreach: false, executionMode: 'live', brokerOrderId: '1' } }); }, /live investment outcome observer is disabled/);
assert.throws(function () { C.buildInvestmentPnl({ outputId: 'x', actionId: 'a', observationId: 'o', observedAt: 't', ownerDomain: 'finance', sourceIdentity: { kind: 'x', value: 'y', provider: 'tradier', accountId: 'VA1', snapshotId: 's' }, benchmarkIdentity: { kind: 'x', value: 'b' }, benchmarkBaselineValue: 1, benchmarkObservedValue: 2, outcomeData: { horizonDays: 30, investedAmount: 1, netPnl: 1, returnPct: 1, benchmarkReturnPct: 1, maxDrawdownPct: 0, riskBreach: false, executionMode: 'paper', brokerOrderId: '1', headlineCount: 3 } }); }, /cannot create an outcome/);
console.log('autofire outcome contract: 13/13 passed');
