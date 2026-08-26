#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Input = require('../lib/finance-position-input.js');

function homology() {
  return {
    schemaVersion: 'civilization-homology-context/1.0', status: 'OBSERVATIONAL',
    identity: { domainId: 'finance', domainLabel: 'Finance', joinStatus: 'joined', companies: [], issues: [] },
    phase: { value: 'p3', label: 'stress', evidence: [], abstention: null },
    regulation: { state: 'DYSREGULATED', direction: 'hyper', regulatedVariable: 'capital', evidence: [], source: 'brain' },
    brainNodes: [],
    mappings: {
      neurology_to_business_homology: { status: 'UNESTABLISHED' },
      business_to_neurology_homology: { status: 'UNESTABLISHED' },
      kernel_dynamics: { status: 'PRESENT', source: 'helix-reviewed', patternId: 'pattern-1', businessSignature: 'stress-arc', evidence: [] },
      p0_p10_proof_and_effects: { status: 'UNESTABLISHED' }
    },
    recovery: { status: 'UNOBSERVED', evidence: [] }, provenance: {}, abstentions: [], contextOnly: true
  };
}

function history(symbol, closes) {
  return { provider: 'tradier', symbol, interval: 'daily', rows: closes.map((close, i) => ({ date: '2026-08-' + String(i + 1).padStart(2, '0'), close })) };
}

const company = Input.companyByTicker('MS');
assert(company && company.cik && company.slug, 'MS must resolve to exact registry identity');
const titleSet = {
  t: '2026-08-26T15:00:00Z', d: 'finance', f: 'SEC EDGAR Filings', hh: 1,
  items: [{ i: 0, ti: 'Morgan Stanley files quarterly report on Form 10-Q', au: 'https://www.sec.gov/Archives/edgar/data/' + company.cik + '/x', pa: '2026-08-26T14:00:00Z', pl: 'SEC' }]
};
const report = {
  request_id: 'helix-1', cik: company.cik, entity_name: company.name, is_financial: true,
  latest_quarter: '2026Q2', history_quarters: 40, history_sufficiency: 'high', input_presence: { revenue_quarters: 40 },
  thing0_eligibility: { qualification_status: 'not_qualified', thing1_execution_status: 'not_applicable', permits_thing1_use: false, reasons: ['financial_institution_requires_regime_2_adapter'] },
  validated_signal: { available: false, validation_status: 'bank_adapter_required', alert: null },
  phase_tracker_signal: { available: true, validation_status: 'experimental', interpretive_only: true, dominant_phase: 'p3', kernel_id: 'thing2' },
  reconciliation: {
    action_authority: 'none', agree: 'indeterminate', masking_assessment: 'unassessed',
    thing2_role: 'alignment_and_masking_reconciliation_only', thing2_trade_weight: 0
  }, warnings: ['BANK_ADAPTER_REQUIRED']
};
const built = Input.build({
  position: { symbol: 'MS', quantity: 1, costBasis: 200, marketValue: 215 },
  quote: { symbol: 'MS', last: 215, bid: 214.9, ask: 215.1 },
  marketHistory: history('MS', [190, 195, 200, 205, 215]),
  benchmarkHistory: history('SPY', [600, 601, 602, 603, 604]),
  helixReport: report,
  openingCommand: { commandId: 'open-1', intent: { side: 'buy' }, order: { status: 'filled' } },
  openingDecision: { status: 'TRADE_INTENT_SELECTED', candidateId: 'candidate-1' },
  financeCycle: { domain: 'finance', ok: true },
  financePacket: { domainId: 'finance', sourceType: 'server-cognition-refresh', packetId: 'finance:1', generatedAt: '2026-08-26T15:00:00Z', homologyContext: homology() },
  titleSets: [titleSet], networkPayload: { generatedAt: '2026-08-26T15:00:00Z', bySlug: { [company.slug]: { total: 0.4, induced: 0.2, rank: 'MILD' } } },
  companyLearningPatterns: [], now: '2026-08-26T15:01:00Z'
});
assert.equal(built.status, 'READY_FOR_POSITION_REVIEW');
assert.equal(built.context.currentReportingEvidence[0].reportingType, '10-Q');
assert.equal(built.context.helixReport.thing0Eligibility.qualifiedForValidatedThing1, false);
assert.equal(built.context.helixReport.thing0Eligibility.qualificationStatus, 'not_qualified');
assert.equal(built.context.helixReport.thing1.applicable, false);
assert.equal(built.context.helixReport.thing2.observed, true);
assert.equal(built.context.helixReport.thing2.decisionWeight, 0);
assert.equal(built.context.helixReport.thing2.leverageAllowed, false);
assert.equal(built.context.helixReport.thing2.reconciliationRole, 'alignment_and_masking_reconciliation_only');
assert.equal(built.context.helixReport.thing2.maskingAssessment, 'unassessed');
assert.equal(built.context.marketPerformance.target.returnsPct.oneSession > 0, true);
assert.equal(built.context.marketPerformance.targetMinusBenchmarkPct.oneSession > 0, true);
assert.equal(built.context.kernelContext.usedAsContext, true);
assert.equal(built.context.interpretationBoundary.thing2DecisionWeight, 0);

const qualified = Input.helixSections(Object.assign({}, report, {
  is_financial: false,
  thing0_eligibility: { qualification_status: 'qualified', thing1_execution_status: 'ready', permits_thing1_use: true, reasons: ['non_financial_required_series_and_history_present'] },
  validated_signal: { available: true, validation_status: 'validated', alert: false },
  reconciliation: { action_authority: 'none', agree: true, masking_assessment: 'aligned_with_thing1_non_alert' }
}));
assert.equal(qualified.thing0Eligibility.qualifiedForValidatedThing1, true);
assert.equal(qualified.thing0Eligibility.permitsThing1Use, true);
assert.equal(qualified.thing1.applicable, true);
assert.equal(qualified.thing2.decisionWeight, 0);
assert.equal(qualified.thing2.maskingAssessment, 'aligned_with_thing1_non_alert');

const partial = Input.helixSections(Object.assign({}, report, {
  thing0_eligibility: { qualification_status: 'partially_qualified', thing1_execution_status: 'blocked_by_company_data', permits_thing1_use: false, reasons: ['quarterly_history_below_full_envelope'] },
  validated_signal: { available: false, validation_status: 'insufficient_data' }
}));
assert.equal(partial.thing0Eligibility.partiallyQualifiedForValidatedThing1, true);
assert.equal(partial.thing1.applicable, false);

console.log('finance position input: exact issuer reports, market history, guarded Thing 0/1, and zero-weight Thing 2 passed');
