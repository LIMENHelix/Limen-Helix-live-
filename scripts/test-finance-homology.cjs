'use strict';

// Minimal explicit context for Finance contract tests.  It is deliberately
// observational and leaves every mapping / recovery claim unestablished.
module.exports = function financeHomology(domainId) {
  domainId = domainId || 'finance';
  return {
    schemaVersion: 'civilization-homology-context/1.0',
    status: 'OBSERVATIONAL',
    identity: { domainId, domainLabel: domainId, joinStatus: 'UNOBSERVED', companies: [], issues: [] },
    phase: { value: 'p3', label: 'DARKNESS', evidence: [], abstention: 'test fixture' },
    regulation: { state: 'UNOBSERVED', direction: 'unknown', regulatedVariable: null, evidence: [], source: null },
    brainNodes: [],
    mappings: {},
    recovery: { status: 'UNOBSERVED', regulatedVariable: null, evidence: [], note: 'test fixture' },
    provenance: { producer: 'test-fixture' },
    abstentions: ['test fixture leaves business bridge unestablished'],
    contextOnly: true
  };
};
