'use strict';

const assert = require('node:assert/strict');
const Release = require('../lib/finance-opportunity-release.js');

const cycle = { domain: 'finance', ok: true, cycleId: '7' };
const packet = {
  sourceType: 'server-cognition-refresh', domainId: 'finance', packetId: 'finance:7:s1', cycleId: '7',
  truth: { opportunities: [{
    id: 'opp-1', title: 'Paper position review', lane: 'investments', company: { slug: 'example-co', ticker: 'EX' },
    diagnosisId: 'MARKET_CONDITION', evidenceIds: ['ev-1']
  }] }
};

let passed = 0;
function ok(name, fn) { fn(); passed++; console.log('PASS ' + name); }

ok('releases a fully identified investment opportunity for paper review', function () {
  const result = Release.build({ financeCycle: cycle, financePacket: packet });
  assert.equal(result.status, 'RELEASED_FOR_PAPER_REVIEW');
  assert.equal(result.candidate.company.ticker, 'EX');
  assert.equal(result.candidate.terms.executionMode, 'paper');
  assert.equal(result.candidate.liveExecution, undefined);
  assert.equal(result.candidate.order, null);
});

ok('abstains when the packet has no opportunities', function () {
  const result = Release.build({ financeCycle: cycle, financePacket: { ...packet, truth: { opportunities: [] } } });
  assert.equal(result.status, 'ABSTAINED');
  assert(result.blockers.some((x) => x.code === 'finance_packet_has_no_opportunity'));
});

ok('rejects a master-inbox-shaped record with no trusted lane or evidence', function () {
  const result = Release.build({ financeCycle: cycle, financePacket: { ...packet, truth: { opportunities: [{ id: 'legacy', title: 'Legacy', status: 'READY_TO_FIRE', ticker: 'EX', companySlug: 'example-co' }] } } });
  assert.equal(result.status, 'ABSTAINED');
  assert(result.rejected.some((x) => x.code === 'investment_lane_required'));
  assert(result.rejected.some((x) => x.code === 'source_evidence_identity_required'));
});

ok('requires a source diagnosis or claim identity', function () {
  const result = Release.build({ financeCycle: cycle, financePacket: { ...packet, truth: { opportunities: [{ ...packet.truth.opportunities[0], diagnosisId: null, claimId: null }] } } });
  assert.equal(result.status, 'ABSTAINED');
  assert(result.rejected.some((x) => x.code === 'source_claim_or_diagnosis_required'));
});

ok('refuses a mismatched packet cycle', function () {
  const result = Release.build({ financeCycle: cycle, financePacket: { ...packet, cycleId: '8' } });
  assert.equal(result.status, 'ABSTAINED');
  assert(result.blockers.some((x) => x.code === 'finance_packet_cycle_mismatch'));
});

ok('requires packet cycle identity even when the opportunity is otherwise complete', function () {
  const invalid = { ...packet, cycleId: null };
  const result = Release.build({ financeCycle: cycle, financePacket: invalid });
  assert.equal(result.status, 'ABSTAINED');
  assert(result.blockers.some((x) => x.code === 'finance_packet_missing_or_untrusted'));
});

console.log(passed + '/6 passed');
