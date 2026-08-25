'use strict';

/**
 * Explicit input adapter for OUTCOME_RESEARCH_EVALUATED.
 *
 * This is not an autonomous evaluator. It accepts a separately supplied
 * evaluation record and delegates final shape validation to the versioned
 * outcome contract. A publication receipt, citation count, or domain signal
 * cannot pass this boundary by itself.
 */

var Outcome = require('./autofire-outcome-contract.js');
var MAPPINGS = Outcome.MAPPINGS;
var OWNERS = ['science', 'medicine'];
var SCHEMA = 'research-evaluation-input/1.0';

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function list(value) { return Array.isArray(value) ? value : []; }
function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function when(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }
function identity(value) { return value && typeof value === 'object' && text(value.kind) && text(value.value); }
function identityKey(value) { return identity(value) ? String(value.kind).trim().toLowerCase() + ':' + String(value.value).trim().toLowerCase() : null; }

function abstain(blockers) {
  return { schemaVersion: SCHEMA, status: 'ABSTAINED', blockers: blockers.slice(), event: null };
}

function build(input) {
  input = input || {};
  var blockers = [];
  var pub = input.publication || {};
  var evaluation = input.evaluation || {};
  var owner = pub.ownerDomain;
  if (OWNERS.indexOf(owner) < 0) blockers.push('research_owner_must_be_science_or_medicine');
  ['outputId', 'actionId', 'observationId', 'publicationId'].forEach(function (name) { if (!text(pub[name])) blockers.push('publication_' + name + '_required'); });
  if (!when(pub.observedAt) || !when(pub.publishedAt)) blockers.push('publication_timestamps_required');
  if (!identity(pub.sourceIdentity) || !text(pub.sourceIdentity.publisher) || !text(pub.sourceIdentity.url) ||
      !text(pub.sourceIdentity.contentHash) || !when(pub.sourceIdentity.retrievedAt)) blockers.push('publication_source_identity_incomplete');
  if (!['PROGRESS', 'REGRESSION', 'NO_CHANGE'].includes(evaluation.progress)) blockers.push('evaluation_progress_required');
  var records = list(evaluation.evidenceRecords);
  if (records.length < 2) blockers.push('at_least_two_independent_evidence_records_required');
  var evidenceIds = [];
  var identityKeys = [];
  var publicationIdentityKey = identityKey(pub.sourceIdentity);
  var evaluatorIdentityKey = identityKey(evaluation.sourceIdentity);
  if (!evaluatorIdentityKey || !when(evaluation.sourceIdentity.retrievedAt)) blockers.push('evaluation_source_identity_and_time_required');
  if (evaluatorIdentityKey && evaluatorIdentityKey === publicationIdentityKey) blockers.push('evaluation_source_must_differ_from_publication');
  records.forEach(function (record, index) {
    if (!record || !text(record.id) || !identity(record.sourceIdentity) || !when(record.retrievedAt) || !text(record.claim)) {
      blockers.push('evidence_record_' + index + '_identity_time_claim_required');
    } else {
      evidenceIds.push(record.id);
      var key = identityKey(record.sourceIdentity);
      identityKeys.push(key);
      if (key === publicationIdentityKey) blockers.push('evidence_record_' + index + '_duplicates_publication_identity');
    }
  });
  if (new Set(evidenceIds).size !== evidenceIds.length) blockers.push('evidence_record_ids_must_be_unique');
  if (new Set(identityKeys).size !== identityKeys.length) blockers.push('evidence_source_identities_must_be_distinct');
  if (evaluatorIdentityKey && identityKeys.indexOf(evaluatorIdentityKey) >= 0) blockers.push('evaluator_identity_must_differ_from_evidence_sources');
  var independence = evaluation.independenceAssessment;
  if (!independence || independence.status !== 'ESTABLISHED' || !text(independence.method) || !text(independence.basis)) {
    blockers.push('established_independence_assessment_required');
  }
  var coverage = evaluation.mappingCoverage || {};
  MAPPINGS.forEach(function (mapping) { if (coverage[mapping] !== true) blockers.push('mapping_' + mapping + '_required'); });
  if (evaluation.contradictions !== undefined && !Array.isArray(evaluation.contradictions)) blockers.push('contradictions_must_be_array');
  if (evaluation.retractions !== undefined && !Array.isArray(evaluation.retractions)) blockers.push('retractions_must_be_array');
  if (blockers.length) return abstain(blockers);
  try {
    var event = Outcome.buildResearchEvaluation({
      outputId: pub.outputId, actionId: pub.actionId, observationId: pub.observationId,
      observedAt: pub.observedAt, ownerDomain: owner,
      sourceIdentity: clone(evaluation.sourceIdentity),
      outcomeData: {
        progress: evaluation.progress, evidenceIds: evidenceIds,
        independenceAssessment: clone(independence), mappingCoverage: clone(coverage),
        contradictions: list(evaluation.contradictions), retractions: list(evaluation.retractions)
      }
    });
    return { schemaVersion: SCHEMA, status: 'EVALUATED', blockers: [], event: event };
  } catch (e) {
    return abstain(['outcome_contract_refused_' + String(e && e.code || 'UNKNOWN')]);
  }
}

module.exports = { SCHEMA: SCHEMA, MAPPINGS: MAPPINGS.slice(), build: build };
