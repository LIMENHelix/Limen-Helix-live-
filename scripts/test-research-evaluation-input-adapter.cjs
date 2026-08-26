#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const Adapter = require('../lib/research-evaluation-input-adapter.js');

const publication = {
  ownerDomain: 'science', outputId: 'research-output-1', actionId: 'research-action-1',
  observationId: 'research-observation-1', publicationId: 'pub-1',
  observedAt: '2026-08-24T16:00:00Z', publishedAt: '2026-08-23T12:00:00Z',
  sourceIdentity: { kind: 'external-publication', value: 'doi:10.1234/example', publisher: 'Example Journal', url: 'https://example.test/paper', retrievedAt: '2026-08-24T16:01:00Z', contentHash: 'sha256:paper' }
};
const evaluation = {
  progress: 'PROGRESS',
  sourceIdentity: { kind: 'external-evaluator', value: 'evaluator:neurology-business-panel', retrievedAt: '2026-08-24T16:01:30Z' },
  evidenceRecords: [
    { id: 'evidence-1', sourceIdentity: { kind: 'independent-study', value: 'doi:10.1234/replication' }, retrievedAt: '2026-08-24T16:02:00Z', claim: 'Independent replication reports the measured outcome.' },
    { id: 'evidence-2', sourceIdentity: { kind: 'dataset', value: 'dataset:1' }, retrievedAt: '2026-08-24T16:03:00Z', claim: 'The underlying dataset is available for review.' }
  ],
  independenceAssessment: { status: 'ESTABLISHED', method: 'source-comparison', basis: 'Two separately identified records with distinct provenance.' },
  mappingCoverage: { neurology_to_business_homology: true, business_to_neurology_homology: true, kernel_dynamics: true, p0_p10_proof_and_effects: true },
  contradictions: [], retractions: []
};

const out = Adapter.build({ publication, evaluation });
assert.equal(out.schemaVersion, Adapter.SCHEMA);
assert.equal(out.status, 'EVALUATED');
assert.equal(out.event.eventType, 'OUTCOME_RESEARCH_EVALUATED');
assert.deepEqual(out.event.outcomeData.evidenceIds, ['evidence-1', 'evidence-2']);
assert.equal(out.event.ownerDomain, 'science');

function blocked(change, code) {
  const got = Adapter.build(change);
  assert.equal(got.status, 'ABSTAINED');
  assert(got.blockers.includes(code), code);
}
blocked({ publication, evaluation: {} }, 'at_least_two_independent_evidence_records_required');
blocked({ publication: Object.assign({}, publication, { ownerDomain: 'finance' }), evaluation }, 'research_owner_must_be_registered_product_domain');
const education = Adapter.build({ publication: Object.assign({}, publication, { ownerDomain: 'education', observationId: 'education-observation-1' }), evaluation });
assert.equal(education.status, 'EVALUATED');
assert.equal(education.event.ownerDomain, 'education');
blocked({ publication, evaluation: Object.assign({}, evaluation, { independenceAssessment: { status: 'UNESTABLISHED', reason: 'unknown' } }) }, 'established_independence_assessment_required');
blocked({ publication, evaluation: Object.assign({}, evaluation, { mappingCoverage: {} }) }, 'mapping_neurology_to_business_homology_required');
blocked({ publication, evaluation: Object.assign({}, evaluation, { evidenceRecords: [{ id: 'x', claim: 'no identity' }] }) }, 'evidence_record_0_identity_time_claim_required');
blocked({ publication, evaluation: Object.assign({}, evaluation, { contradictions: {} }) }, 'contradictions_must_be_array');
blocked({ publication, evaluation: Object.assign({}, evaluation, { progress: 'UNKNOWN' }) }, 'evaluation_progress_required');
blocked({ publication: Object.assign({}, publication, { sourceIdentity: { kind: 'x', value: 'y' } }), evaluation }, 'publication_source_identity_incomplete');
blocked({ publication, evaluation: Object.assign({}, evaluation, { evidenceRecords: [evaluation.evidenceRecords[0]] }) }, 'at_least_two_independent_evidence_records_required');
blocked({ publication, evaluation: Object.assign({}, evaluation, { evidenceRecords: [evaluation.evidenceRecords[0], Object.assign({}, evaluation.evidenceRecords[1], { id: 'evidence-1' })] }) }, 'evidence_record_ids_must_be_unique');
blocked({ publication, evaluation: Object.assign({}, evaluation, { evidenceRecords: [evaluation.evidenceRecords[0], Object.assign({}, evaluation.evidenceRecords[1], { sourceIdentity: evaluation.evidenceRecords[0].sourceIdentity })] }) }, 'evidence_source_identities_must_be_distinct');
blocked({ publication, evaluation: Object.assign({}, evaluation, { evidenceRecords: [Object.assign({}, evaluation.evidenceRecords[0], { sourceIdentity: publication.sourceIdentity }), evaluation.evidenceRecords[1]] }) }, 'evidence_record_0_duplicates_publication_identity');
blocked({ publication, evaluation: Object.assign({}, evaluation, { sourceIdentity: publication.sourceIdentity }) }, 'evaluation_source_must_differ_from_publication');
blocked({ publication, evaluation: Object.assign({}, evaluation, { sourceIdentity: evaluation.evidenceRecords[0].sourceIdentity }) }, 'evaluator_identity_must_differ_from_evidence_sources');
const forbidden = Adapter.build({ publication, evaluation: Object.assign({}, evaluation, { articleCount: 2 }) });
assert.equal(forbidden.status, 'EVALUATED'); // irrelevant fields are not accepted as evidence or copied into the event
assert.equal(forbidden.event.outcomeData.articleCount, undefined);

console.log('research evaluation input adapter: source separation and mapping gates passed');
