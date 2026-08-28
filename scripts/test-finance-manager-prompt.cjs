#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Prompt = require('../lib/finance-manager-prompt.js');
const homology = require('./test-finance-homology.cjs')();

const context = {
  status: 'READY_FOR_PAPER_REVIEW',
  company: { slug: 'example_co', ticker: 'EX' },
  financeCycle: { domain: 'finance', ok: true },
  observations: [{ sourceIdentity: { kind: 'publisher-item', value: 'semantic:1' }, title: 'Observed event' }],
  marketData: { asOf: '2026-08-24T16:00:00Z' },
  networkEvidence: [{ sourceIdentity: { kind: 'network-snapshot', value: 'network:1' } }],
  thing1: { applicable: false, reason: 'no-company-specific-mapping' },
  thing2: { applicable: false, reason: 'no-company-specific-mapping' }
  ,homologyContext: homology
};

const req = Prompt.buildRequest({ managerContext: context });
assert.equal(req.ok, true);
assert.equal(req.schemaVersion, Prompt.REQUEST_SCHEMA);
assert.equal(req.mode, 'sandbox-paper');
assert(req.instructions.some((x) => x.includes('never an order')));
assert.equal(req.context.observations.length, 1);
assert.equal(Object.prototype.hasOwnProperty.call(req.context, 'thing2'), false);
assert.equal(req.context.postDecisionMaskingReconciliationDeferred, true);
assert.equal(req.outputSchema.paperOnly, true);
assert.match(req.outputSchema.horizonDays, /exactly one/);
assert(req.instructions.some((x) => x.includes('horizonDays') && x.includes('never be an array')));
assert.equal(req.context.homologyContext.contextOnly, true);
assert(req.instructions.some((x) => x.includes('observational homology context')));

const candidateContext = {
  status: 'READY_FOR_PAPER_REVIEW',
  homologyContexts: [{ company: { slug: 'example_co', ticker: 'EX' }, context: homology }],
  companyCandidates: [{
    company: { slug: 'example_co', ticker: 'EX' },
    ledger: { ledger: {
      semanticEvidence: [{ sourceIdentity: { kind: 'publisher-item', value: 'semantic:1' } }],
      marketData: { quotes: [{ sourceIdentity: { kind: 'market-quote', value: 'market:1' } }] },
      networkEvidence: [{ sourceIdentity: { kind: 'network-snapshot', value: 'network:1' } }]
    } }
  }]
};
const candidateReq = Prompt.buildRequest({ managerContext: candidateContext });
assert.equal(candidateReq.ok, true);
assert.deepEqual(candidateReq.context.companyCandidates[0].allowedEvidenceRefs, [
  { role: 'semantic', sourceIdentity: { kind: 'publisher-item', value: 'semantic:1' } },
  { role: 'market', sourceIdentity: { kind: 'market-quote', value: 'market:1' } },
  { role: 'network', sourceIdentity: { kind: 'network-snapshot', value: 'network:1' } }
]);
assert.equal(Object.prototype.hasOwnProperty.call(candidateReq.context.companyCandidates[0].ledger.ledger, 'thing2'), false);
assert(candidateReq.instructions.some((x) => x.includes('same companyCandidates entry')));
assert(candidateReq.instructions.some((x) => x.includes('exactly three evidenceRefs')));

const proposal = {
  schemaVersion: Prompt.RESPONSE_SCHEMA, id: 'proposal-1',
  company: { slug: 'example_co', ticker: 'EX' },
  thesis: 'Bounded paper thesis.', invalidation: 'Invalidate on correction.', horizonDays: 30,
  scenarios: [{ name: 'base' }, { name: 'downside' }],
  evidenceRefs: [
    { role: 'semantic', sourceIdentity: { kind: 'publisher-item', value: 'semantic:1' } },
    { role: 'market', sourceIdentity: { kind: 'market-quote', value: 'market:1' } },
    { role: 'network', sourceIdentity: { kind: 'network-snapshot', value: 'network:1' } }
  ],
  independenceAssessment: { status: 'UNASSESSED', reason: 'Not assessed.' }, paperOnly: true,
  provenance: { producer: 'finance-manager/test', generatedAt: '2026-08-24T16:00:00Z' }
};
assert.equal(Prompt.parseResponse(JSON.stringify(proposal)).status, 'PROPOSED');
assert.equal(Prompt.parseResponse(proposal).ok, true);
assert.equal(Prompt.parseResponse('{bad').reason, 'manager_response_must_be_json');
assert.equal(Prompt.parseResponse(Object.assign({}, proposal, { paperOnly: false })).reason, 'manager_response_must_be_paper_only');
assert.equal(Prompt.parseResponse(Object.assign({}, proposal, { liveExecution: false })).reason, 'manager_response_live_execution_forbidden');
assert.equal(Prompt.parseResponse(Object.assign({}, proposal, { independenceAssessment: { status: 'ASSESSED', reason: 'guess' } })).reason, 'manager_response_independence_must_be_unassessed');
assert.equal(Prompt.parseResponse(Object.assign({}, proposal, { evidenceRefs: [
  { role: 'semantic', sourceIdentity: 'semantic:1' }, proposal.evidenceRefs[1], proposal.evidenceRefs[2]
] })).reason, 'manager_response_evidence_refs_invalid');
assert.equal(Prompt.parseResponse(Object.assign({}, proposal, { evidenceRefs: [
  proposal.evidenceRefs[0], proposal.evidenceRefs[0], proposal.evidenceRefs[2]
] })).reason, 'manager_response_evidence_refs_invalid');
assert.equal(Prompt.parseResponse(Object.assign({}, proposal, {
  evidenceRefs: proposal.evidenceRefs.concat(proposal.evidenceRefs[0])
})).reason, 'manager_response_evidence_refs_required');
assert.equal(Prompt.buildRequest({ managerContext: { status: 'ABSTAINED' } }).reason, 'finance_manager_context_not_ready');
assert.equal(Prompt.buildRequest({ managerContext: Object.assign({}, context, { homologyContext: null }) }).reason, 'finance_homology_context_not_ready');

console.log('finance manager prompt: 23/23 passed');
