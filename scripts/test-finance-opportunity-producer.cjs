#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Producer = require('../lib/finance-opportunity-producer.js');
const Replay = require('../lib/investment-sandbox-replay.js');

const semanticId = 'finance:official-feed:h1:0';
const baseLedger = {
  schemaVersion: 'finance-input-ledger/1.0', status: 'READY_FOR_PAPER_REVIEW',
  ledger: {
    company: { slug: 'example_co', ticker: 'EX' },
    semanticEvidence: [{ sourceIdentity: { kind: 'publisher-item', value: semanticId } }],
    marketData: { quotes: [{ sourceIdentity: { kind: 'market-quote-handler', value: 'asset-quote/yahoo-chart' } }] },
    networkEvidence: [{ sourceIdentity: { kind: 'network-snapshot', value: 'limen-stress-slim' } }]
  }
};
const proposal = {
  schemaVersion: Producer.SCHEMA, id: 'finance-paper-example-1',
  company: { slug: 'example_co', ticker: 'EX' },
  thesis: 'A source-identified event warrants a bounded paper scenario review.',
  invalidation: 'Invalidate if the named event is corrected or the market observation reverses the stated condition.',
  scenarios: [{ name: 'base', condition: 'event persists', impact: 'monitor' }, { name: 'downside', condition: 'event reverses', impact: 'abstain' }],
  horizonDays: 30, paperOnly: true,
  independenceAssessment: { status: 'UNASSESSED', reason: 'Ownership and syndication have not been independently established.' },
  evidenceRefs: [
    { role: 'semantic', sourceIdentity: { kind: 'publisher-item', value: semanticId } },
    { role: 'market', sourceIdentity: { kind: 'market-quote-handler', value: 'asset-quote/yahoo-chart' } },
    { role: 'network', sourceIdentity: { kind: 'network-snapshot', value: 'limen-stress-slim' } }
  ],
  provenance: { producer: 'finance-manager/test', generatedAt: '2026-08-24T16:00:00Z' }
};

const ready = Producer.build({ ledger: baseLedger, proposal });
assert.equal(ready.status, 'PAPER_CANDIDATE');
assert.equal(ready.simulationOnly, true);
assert.equal(ready.liveExecution, false);
assert.equal(ready.company.ticker, 'EX');
assert.equal(ready.evidenceRefs.length, 3);
assert.equal(ready.blockers.length, 0);

const released = Producer.releaseForPaper(ready, {
  mode: 'sandbox-paper', policyId: 'finance-paper-policy/1', releasedAt: '2026-08-24T16:01:00Z'
});
assert.equal(released.status, 'READY_TO_FIRE');
assert.equal(released.release.mode, 'sandbox-paper');
assert.equal(released.liveExecution, false);
const replayCandidate = Producer.toReplayCandidate(released);
assert.equal(replayCandidate.status, 'READY_TO_FIRE');
assert.equal(replayCandidate.portalTicker, 'EX');
assert.equal(replayCandidate.paperOnly, true);

const replay = Replay.summarize({
  snapshot: { domains: { finance: { sources: [{ name: 'Official feed' }, { name: 'Market feed' }] } } },
  brainShadow: { cycles: { finance: { domain: 'finance', ok: true,
    domainFunction: { evidence: { l3CurrentEvidenceComplete: true, outwardConnected: true } } } } },
  handoff: { packets: [{ domainId: 'finance', sourceType: 'server-cognition-refresh', generatedAt: '2026-08-24T16:00:00Z',
    truth: { opportunities: [replayCandidate], semanticEvidence: [{
      sourceIdentity: { kind: 'publisher-item', value: semanticId }, recordedAt: '2026-08-24T15:59:00Z',
      publisher: 'Official feed', feedName: 'Official feed', title: 'Example event', canonicalUrl: 'https://example.test/event'
    }] } }] },
  masterInbox: { readyForAutofire: [replayCandidate] },
  semanticEvidence: [{ sourceIdentity: { kind: 'publisher-item', value: semanticId }, recordedAt: '2026-08-24T15:59:00Z',
    publisher: 'Official feed', feedName: 'Official feed', title: 'Example event', canonicalUrl: 'https://example.test/event' }],
  marketData: { asOf: '2026-08-24T16:00:00Z', sources: ['asset-quote/yahoo-chart'], quotes: [{
    symbol: 'EX', price: 10, observedAt: '2026-08-24T16:00:00Z',
    sourceIdentity: { kind: 'market-quote-handler', value: 'asset-quote/yahoo-chart' }
  }] },
  networkStress: { asOf: '2026-08-24T15:59:30Z', value: 0.1,
    sourceIdentity: { kind: 'network-snapshot', value: 'limen-stress-slim' } }
});
assert.equal(replay.status, 'READY_FOR_PAPER_SIMULATION');
assert.equal(replay.inputLedger.status, 'READY_FOR_PAPER_REVIEW');
assert.equal(replay.brokerOrderSubmitted, false);

function blocked(change, code) {
  const out = Producer.build({ ledger: baseLedger, proposal: Object.assign({}, proposal, change) });
  assert.equal(out.status, 'ABSTAINED');
  assert(out.blockers.includes(code), code);
}
blocked({ evidenceRefs: proposal.evidenceRefs.slice(0, 2) }, 'proposal_network_evidence_required');
blocked({ paperOnly: false }, 'proposal_must_be_paper_only');
blocked({ horizonDays: 15 }, 'proposal_horizon_must_be_30_60_or_90_days');
blocked({ independenceAssessment: { status: 'ASSESSED', reason: 'guess' } }, 'publisher_independence_must_remain_explicitly_unassessed');
blocked({ tradeIntent: { side: 'buy' } }, 'proposal_forbidden_field_tradeIntent');
blocked({ evidenceRefs: [{ role: 'semantic', sourceIdentity: { kind: 'publisher-item', value: 'missing' } }, proposal.evidenceRefs[1], proposal.evidenceRefs[2]] }, 'proposal_evidence_ref_0_not_in_ledger');

const noRelease = Producer.releaseForPaper(ready, { mode: 'sandbox-paper', policyId: 'x' });
assert.equal(noRelease.status, 'ABSTAINED');
assert.equal(noRelease.reason, 'paper_release_policy_required');
const notReady = Producer.releaseForPaper(Object.assign({}, ready, { status: 'ABSTAINED' }), { mode: 'sandbox-paper', policyId: 'x', releasedAt: '2026-08-24T16:01:00Z' });
assert.equal(notReady.status, 'ABSTAINED');

console.log('finance opportunity producer: 31/31 passed');
