#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Context = require('../lib/finance-manager-context.js');
const Prompt = require('../lib/finance-manager-prompt.js');
const Adapter = require('../lib/finance-manager-producer-adapter.js');
const Producer = require('../lib/finance-opportunity-producer.js');
const Replay = require('../lib/investment-sandbox-replay.js');

const semanticId = 'finance:official-feed:cycle-1';
const marketId = 'quote:paper-provider:EX';
const networkId = 'network:limen-stress-slim:example_co';
const financeCycle = {
  domain: 'finance', ok: true,
  domainFunction: { evidence: { l3CurrentEvidenceComplete: true, outwardConnected: true } }
};
const semanticEvidence = [{
  sourceIdentity: { kind: 'publisher-item', value: semanticId },
  recordedAt: '2026-08-24T16:00:00Z', sourceUpdatedAt: null,
  publisher: 'Official Finance Feed', feedName: 'Official Finance Feed',
  title: 'Example issuer publishes a material update',
  canonicalUrl: 'https://example.test/issuer-update'
}];
const marketData = {
  asOf: '2026-08-24T16:01:00Z', sources: ['paper-market-fixture'],
  quotes: [{ symbol: 'EX', price: 10, observedAt: '2026-08-24T16:01:00Z',
    sourceIdentity: { kind: 'market-quote', value: marketId } }]
};
const networkEvidence = [{ asOf: '2026-08-24T16:00:30Z', value: 0.1,
  sourceIdentity: { kind: 'network-snapshot', value: networkId } }];

const context = Context.build({
  financeCycle, company: { slug: 'example_co', ticker: 'EX' },
  observations: semanticEvidence, marketData, networkEvidence,
  kernelContext: { applicable: false, reason: 'no-company-specific-kernel-mapping' }
});
assert.equal(context.status, 'READY_FOR_PAPER_REVIEW');

const request = Prompt.buildRequest({ managerContext: context });
assert.equal(request.ok, true);
assert.equal(request.schemaVersion, Prompt.REQUEST_SCHEMA);

// Deterministic stand-in for a provider response. No provider is called by
// this test; the real parser and every downstream boundary are invoked.
const parsed = Prompt.parseResponse({
  schemaVersion: Prompt.RESPONSE_SCHEMA, id: 'manager-proposal-1',
  company: { slug: 'example_co', ticker: 'EX' },
  thesis: 'The named event supports a bounded paper scenario review.',
  invalidation: 'Invalidate if the source is corrected or the market condition reverses.',
  horizonDays: 30,
  scenarios: [
    { name: 'base', condition: 'event persists', impact: 'monitor' },
    { name: 'downside', condition: 'event reverses', impact: 'abstain' }
  ],
  evidenceRefs: [
    { role: 'semantic', sourceIdentity: { kind: 'publisher-item', value: semanticId } },
    { role: 'market', sourceIdentity: { kind: 'market-quote', value: marketId } },
    { role: 'network', sourceIdentity: { kind: 'network-snapshot', value: networkId } }
  ],
  independenceAssessment: { status: 'UNASSESSED', reason: 'Ownership and syndication are not established.' },
  paperOnly: true,
  provenance: { producer: 'test-manager', generatedAt: '2026-08-24T16:02:00Z' }
});
assert.equal(parsed.ok, true);
assert.equal(parsed.status, 'PROPOSED');

const adapted = Adapter.adapt(parsed);
assert.equal(adapted.ok, true);
assert.equal(adapted.status, 'PROPOSAL_READY');
assert.equal(adapted.proposal.schemaVersion, Producer.SCHEMA);
assert.equal(adapted.proposal.provenance.managerResponseSchema, Prompt.RESPONSE_SCHEMA);

const ledger = {
  schemaVersion: 'finance-input-ledger/1.0', status: 'READY_FOR_PAPER_REVIEW',
  ledger: {
    company: { slug: 'example_co', ticker: 'EX' },
    semanticEvidence,
    marketData,
    networkEvidence
  }
};
const candidate = Producer.build({ ledger, proposal: adapted.proposal });
assert.equal(candidate.status, 'PAPER_CANDIDATE');
assert.equal(candidate.blockers.length, 0);
assert.equal(candidate.liveExecution, false);

const released = Producer.releaseForPaper(candidate, {
  mode: 'sandbox-paper', policyId: 'finance-paper-policy/1', releasedAt: '2026-08-24T16:03:00Z'
});
assert.equal(released.status, 'READY_TO_FIRE');
assert.equal(released.release.mode, 'sandbox-paper');
const replayCandidate = Producer.toReplayCandidate(released);
assert.equal(replayCandidate.paperOnly, true);

const replay = Replay.summarize({
  now: '2026-08-24T16:04:00Z',
  snapshot: { domains: { finance: { sources: [{ name: 'Official Finance Feed' }] } } },
  brainShadow: { cycles: { finance: financeCycle } },
  handoff: { packets: [{ domainId: 'finance', sourceType: 'server-cognition-refresh', generatedAt: '2026-08-24T16:01:00Z',
    truth: { opportunities: [replayCandidate], semanticEvidence } }] },
  masterInbox: { readyForAutofire: [replayCandidate] },
  semanticEvidence, marketData, networkStress: networkEvidence[0]
});
assert.equal(replay.status, 'READY_FOR_PAPER_SIMULATION');
assert.equal(replay.inputLedger.status, 'READY_FOR_PAPER_REVIEW');
assert.equal(replay.brokerOrderSubmitted, false);

const blocked = Adapter.adapt({ ok: true, status: 'PROPOSED', proposal: Object.assign({}, parsed.proposal, { paperOnly: false }) });
assert.equal(blocked.status, 'ABSTAINED');
assert.equal(blocked.reason, 'manager_proposal_must_be_paper_only');

console.log('finance manager cycle: 18/18 passed');
