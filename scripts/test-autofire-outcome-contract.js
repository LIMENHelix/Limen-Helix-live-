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
  observationId: 'obs_2', sourceIdentity: { kind: 'external-evaluation', value: 'eval_1', retrievedAt: '2026-08-24T00:00:00Z' },
  outcomeData: {
    progress: 'PROGRESS', evidenceIds: ['doi:1'],
    independenceAssessment: { status: 'ESTABLISHED', method: 'source-comparison', basis: 'publisher-a and publisher-b have distinct records' },
    mappingCoverage: { neurology_to_business_homology: true, business_to_neurology_homology: true, kernel_dynamics: true, p0_p10_proof_and_effects: true },
    contradictions: [], retractions: []
  }
}));
assert.strictEqual(evalEvent.eventType, 'OUTCOME_RESEARCH_EVALUATED');
assert.deepStrictEqual(evalEvent.outcomeData.evidenceIds, ['doi:1']);
assert.strictEqual(evalEvent.sourceIdentity.retrievedAt, '2026-08-24T00:00:00.000Z');
var scienceEval = C.buildResearchEvaluation(Object.assign({}, base, {
  ownerDomain: 'science', observationId: 'obs_science',
  sourceIdentity: { kind: 'external-evaluation', value: 'eval_science', retrievedAt: '2026-08-24T00:00:00Z' },
  outcomeData: { progress: 'NO_CHANGE', evidenceIds: ['doi:science'], independenceAssessment: { status: 'ESTABLISHED', method: 'review', basis: 'distinct records' }, mappingCoverage: { neurology_to_business_homology: true, business_to_neurology_homology: true, kernel_dynamics: true, p0_p10_proof_and_effects: true } }
}));
assert.strictEqual(scienceEval.ownerDomain, 'science');
var medicineEval = C.buildResearchEvaluation(Object.assign({}, base, {
  ownerDomain: 'medicine', observationId: 'obs_medicine',
  sourceIdentity: { kind: 'external-evaluation', value: 'eval_medicine', retrievedAt: '2026-08-24T00:00:00Z' },
  outcomeData: { progress: 'REGRESSION', evidenceIds: ['doi:medicine'], independenceAssessment: { status: 'ESTABLISHED', method: 'review', basis: 'distinct records' }, mappingCoverage: { neurology_to_business_homology: true, business_to_neurology_homology: true, kernel_dynamics: true, p0_p10_proof_and_effects: true } }
}));
assert.strictEqual(medicineEval.ownerDomain, 'medicine');

var inv = C.buildInvestmentPnl({
  outputId: 'eo_investment_1', actionId: 'act_i', observationId: 'obs_i', observedAt: '2026-08-24T00:00:00Z', ownerDomain: 'finance',
  sourceIdentity: { kind: 'broker-account-snapshot', value: 'tradier:order:77', provider: 'tradier', accountId: 'VA123', snapshotId: 'snap_1', retrievedAt: '2026-08-24T00:00:00Z' },
  benchmarkIdentity: { kind: 'benchmark-series', value: 'SPY:2026-08-24', retrievedAt: '2026-08-24T00:00:00Z' }, benchmarkBaselineValue: 500, benchmarkObservedValue: 505,
  sourceTerms: { executedQuantity: 1, averageFillPrice: 100, positionMarketValue: 105, fees: 1 },
  outcomeData: { horizonDays: 30, investedAmount: 100, netPnl: 4, returnPct: 4, benchmarkReturnPct: 1, maxDrawdownPct: 2, riskBreach: false, executionMode: 'paper', brokerOrderId: '77' }
});
assert.strictEqual(inv.eventType, 'OUTCOME_INVESTMENT_PNL');
assert.strictEqual(inv.outcomeData.executionMode, 'paper');
assert.strictEqual(inv.outcomeData.brokerOrderId, '77');
assert.strictEqual(inv.commandId, undefined);
assert.strictEqual(inv.outcomeData.sourceTerms.fees, 1);

assert.throws(function () { C.buildResearchPublication(Object.assign({}, base, { stress: 1 })); }, /cannot create an outcome/);
assert.throws(function () { C.buildResearchEvaluation(Object.assign({}, base, { sourceIdentity: { kind: 'x', value: 'y', retrievedAt: '2026-08-24T00:00:00Z' }, outcomeData: { progress: 'PROGRESS', evidenceIds: ['x'], independenceAssessment: { status: 'ESTABLISHED', method: 'x', basis: 'y' }, mappingCoverage: {} } })); }, /must be true/);
assert.throws(function () { C.buildResearchEvaluation(Object.assign({}, base, { sourceIdentity: { kind: 'x', value: 'y', retrievedAt: '2026-08-24T00:00:00Z' }, outcomeData: { progress: 'PROGRESS', evidenceIds: [null], independenceAssessment: { status: 'ESTABLISHED', method: 'x', basis: 'y' }, mappingCoverage: { neurology_to_business_homology: true, business_to_neurology_homology: true, kernel_dynamics: true, p0_p10_proof_and_effects: true } } })); }, /evidenceIds\[0\] is required/);
assert.throws(function () { C.buildResearchEvaluation(Object.assign({}, base, { sourceIdentity: { kind: 'x', value: 'y', retrievedAt: '2026-08-24T00:00:00Z' }, outcomeData: { progress: 'PROGRESS', evidenceIds: ['x'], independenceAssessment: { status: 'ESTABLISHED' }, mappingCoverage: { neurology_to_business_homology: true, business_to_neurology_homology: true, kernel_dynamics: true, p0_p10_proof_and_effects: true } } })); }, /independenceAssessment.method is required/);
assert.throws(function () { C.buildResearchEvaluation(Object.assign({}, base, { sourceIdentity: { kind: 'x', value: 'y', retrievedAt: '2026-08-24T00:00:00Z' }, outcomeData: { progress: 'PROGRESS', evidenceIds: ['x'], independenceAssessment: { status: 'ESTABLISHED', method: 'x', basis: 'y' }, mappingCoverage: { neurology_to_business_homology: true, business_to_neurology_homology: true, kernel_dynamics: true, p0_p10_proof_and_effects: true }, contradictions: {} } })); }, /contradictions must be an array/);
assert.throws(function () { C.buildInvestmentPnl({ outputId: 'x', actionId: 'a', observationId: 'o', observedAt: '2026-08-24T00:00:00Z', ownerDomain: 'finance', sourceIdentity: { kind: 'x', value: 'y', provider: 'tradier', accountId: 'VA1', snapshotId: 's' }, benchmarkIdentity: { kind: 'x', value: 'b' }, benchmarkBaselineValue: 1, benchmarkObservedValue: 2, outcomeData: { horizonDays: 30, investedAmount: 1, netPnl: 1, returnPct: 1, benchmarkReturnPct: 1, maxDrawdownPct: 0, riskBreach: false, executionMode: 'live', brokerOrderId: '1' } }); }, /live investment outcome observer is disabled/);
assert.throws(function () { C.buildInvestmentPnl({ outputId: 'x', actionId: 'a', observationId: 'o', observedAt: 't', ownerDomain: 'finance', sourceIdentity: { kind: 'x', value: 'y', provider: 'tradier', accountId: 'VA1', snapshotId: 's' }, benchmarkIdentity: { kind: 'x', value: 'b' }, benchmarkBaselineValue: 1, benchmarkObservedValue: 2, outcomeData: { horizonDays: 30, investedAmount: 1, netPnl: 1, returnPct: 1, benchmarkReturnPct: 1, maxDrawdownPct: 0, riskBreach: false, executionMode: 'paper', brokerOrderId: '1', headlineCount: 3 } }); }, /cannot create an outcome/);
assert.throws(function () { C.buildInvestmentPnl({ outputId: 'x', actionId: 'a', observationId: 'o', observedAt: '2026-08-24T00:00:00Z', ownerDomain: 'finance', sourceIdentity: { kind: 'x', value: 'y', provider: 'tradier', accountId: 'VA1', snapshotId: 's', retrievedAt: '2026-08-24T00:00:00Z' }, benchmarkIdentity: { kind: 'x', value: 'b', retrievedAt: '2026-08-24T00:00:00Z' }, benchmarkBaselineValue: 1, benchmarkObservedValue: 2, sourceTerms: { executedQuantity: 1, averageFillPrice: 1, positionMarketValue: 2, fees: 0 }, outcomeData: { horizonDays: 30, investedAmount: 1, netPnl: 99, returnPct: 9900, benchmarkReturnPct: 100, maxDrawdownPct: 0, riskBreach: false, executionMode: 'paper', brokerOrderId: '1' } }); }, /netPnl does not match source terms/);
console.log('autofire outcome contract: 22/22 passed');
