#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Ledger = require('../lib/finance-input-ledger.js');
const homology = require('./test-finance-homology.cjs')();

function fixture() {
  return {
    now: '2026-08-24T12:00:00Z',
    financeCycle: {
      domain: 'finance', ok: true,
      domainFunction: { evidence: { l3CurrentEvidenceComplete: true } },
      truth: { phase: 'p3', stressScore: 0.3 }
    },
    financePacket: { sourceType: 'server-cognition-refresh', generatedAt: '2026-08-24T11:59:00Z', homologyContext: homology },
    company: { slug: 'acme', ticker: 'ACME' },
    candidate: { lane: 'investment', status: 'READY_TO_FIRE', artifactRef: 'acme/investment/0' },
    semanticEvidence: [{
      sourceIdentity: { kind: 'feed', value: 'official-company-feed' },
      publisher: 'Acme', feedName: 'Acme IR', recordedAt: '2026-08-24T11:58:00Z',
      sourceUpdatedAt: '2026-08-24T11:57:00Z', title: 'Quarterly update',
      canonicalUrl: 'https://example.test/update', contentKind: 'title'
    }],
    marketData: {
      asOf: '2026-08-24T11:59:30Z', sources: ['provider:paper'],
      quotes: [{ symbol: 'ACME', price: 10, observedAt: '2026-08-24T11:59:30Z',
        sourceIdentity: { kind: 'quote-provider', value: 'provider:paper' } }]
    },
    networkEvidence: [{ sourceIdentity: { kind: 'network', value: 'stress-slim' }, asOf: '2026-08-24T11:59:00Z', value: 0.1 }],
    thing1: { applicable: false, reason: 'no-protected-screen-for-company' },
    thing2: { applicable: true, mappingId: 'acme-homology-1', provenance: { source: 'reviewed-mapping' } }
  };
}

const ready = Ledger.build(fixture());
assert.equal(ready.status, 'READY_FOR_PAPER_REVIEW');
assert.equal(ready.simulationOnly, true);
assert.equal(ready.liveExecution, false);
assert.equal(ready.ledger.semanticEvidence.length, 1);

const managerReady = Ledger.build(Object.assign(fixture(), { candidate: null }));
assert.equal(managerReady.status, 'READY_FOR_MANAGER_REVIEW');
assert.equal(managerReady.ledger.homologyContext.contextOnly, true);
assert.equal(managerReady.ledger.candidate, null);

const missing = Ledger.build(Object.assign(fixture(), { semanticEvidence: [] }));
assert.equal(missing.status, 'ABSTAINED');
assert(missing.blockers.includes('semantic_feed_evidence_required'));
const noHomology = Ledger.build(Object.assign({}, fixture(), { financePacket: { sourceType: 'server-cognition-refresh', generatedAt: '2026-08-24T11:59:00Z' } }));
assert(noHomology.blockers.includes('homology_context_required'));

const stale = Ledger.build(Object.assign(fixture(), {
  networkEvidence: [{ sourceIdentity: { kind: 'network', value: 'stress-slim' }, asOf: '2026-08-22T00:00:00Z', value: 0.1 }]
}));
assert(stale.blockers.includes('network_evidence_0_stale_or_unidentified'));

const noKernelReason = Ledger.build(Object.assign(fixture(), { thing2: { applicable: false } }));
assert(noKernelReason.blockers.includes('thing2_abstention_reason_required'));

const missingProvenance = Ledger.build(Object.assign(fixture(), {
  thing2: { applicable: true, mappingId: 'm1', provenance: {} }
}));
assert(missingProvenance.blockers.includes('thing2_mapping_and_provenance_required'));

console.log('finance input ledger: 12/12 passed');
