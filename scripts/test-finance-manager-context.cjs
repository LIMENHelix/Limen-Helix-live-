#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Context = require('../lib/finance-manager-context.js');
const homology = require('./test-finance-homology.cjs')();

const cycle = {
  domain: 'finance', ok: true,
  domainFunction: { evidence: { l3CurrentEvidenceComplete: true } }
};
const base = {
  financeCycle: cycle,
  company: { slug: 'example_co', ticker: 'EX', name: 'Example Co' },
  observations: [{
    sourceIdentity: { kind: 'publisher-item', value: 'publisher:item:1' },
    recordedAt: '2026-08-24T12:00:00Z',
    sourceUpdatedAt: '2026-08-24T11:55:00Z',
    title: 'Example policy statement',
    publisher: 'official-source'
  }],
  marketData: { asOf: '2026-08-24T12:01:00Z', sources: ['paper-market-fixture'] },
  policyStatements: [{ sourceIdentity: { kind: 'official', value: 'statement:1' }, recordedAt: '2026-08-24T12:00:00Z', claim: 'policy statement' }],
  kernelContext: { applicable: false, reason: 'no-company-specific-kernel-mapping' }
  ,homologyContext: homology
};

const ready = Context.build(base);
assert.equal(ready.schemaVersion, Context.SCHEMA);
assert.equal(ready.status, 'READY_FOR_PAPER_REVIEW');
assert.equal(ready.mode, 'sandbox-paper');
assert.equal(ready.liveExecution, false);
assert.equal(ready.blockers.length, 0);
assert.equal(ready.homologyContext.contextOnly, true);
assert.equal(ready.homologyContext.regulation.direction, 'unknown');

const twoSided = Context.build(Object.assign({}, base, {
  homologyContext: Object.assign({}, homology, {
    regulation: { state: 'DYSREGULATED', direction: 'hyper', regulatedVariable: 'allocation-capacity', evidence: [], source: 'test' }
  })
}));
assert.equal(twoSided.status, 'READY_FOR_PAPER_REVIEW');
assert.equal(twoSided.homologyContext.regulation.direction, 'hyper');
assert.equal(twoSided.homologyContext.regulation.state, 'DYSREGULATED');

const noHomology = Context.build(Object.assign({}, base, { homologyContext: null }));
assert.equal(noHomology.status, 'ABSTAINED');
assert(noHomology.blockers.includes('homology_context_required'));

const missing = Context.build(Object.assign({}, base, { observations: [], marketData: null }));
assert.equal(missing.status, 'ABSTAINED');
assert(missing.blockers.includes('semantic_source_observations_required'));
assert(missing.blockers.includes('market_data_snapshot_required'));

const kernelGap = Context.build(Object.assign({}, base, {
  kernelContext: { applicable: true }
}));
assert.equal(kernelGap.status, 'ABSTAINED');
assert(kernelGap.blockers.includes('applicable_kernel_requires_mapping_and_provenance'));

const badObservation = Context.build(Object.assign({}, base, {
  observations: [{ title: 'no identity or timestamp' }]
}));
assert.equal(badObservation.status, 'ABSTAINED');
assert(badObservation.blockers.includes('observation_0_missing_identity_timestamp_or_claim'));

console.log('finance manager context: 11/11 passed');
