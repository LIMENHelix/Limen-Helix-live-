'use strict';

/**
 * Source-grounded Finance opportunity producer.
 *
 * This is the missing middle between the complete Finance input ledger and
 * the paper replay. It accepts a structured manager proposal, but it never
 * invents one from a title, stress value, Thing 1/Thing 2 reading, or model
 * confidence. A proposal is only a paper candidate until an explicit,
 * sandbox-only release policy is supplied.
 */

var SCHEMA = 'finance-opportunity-proposal/1.0';
var CANDIDATE_SCHEMA = 'finance-paper-candidate/1.0';
var HORIZONS = [30, 60, 90];
var FORBIDDEN = [
  'tradeIntent', 'order', 'quantity', 'side', 'limitPrice', 'stopPrice',
  'stressDirectlyTriggered', 'headlineDirectlyTriggered', 'liveExecution'
];

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function list(value) { return Array.isArray(value) ? value : []; }
function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function timestamp(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }
function identity(value) { return value && typeof value === 'object' && text(value.kind) && text(value.value); }

function walkForbidden(value, path, found) {
  if (!value || typeof value !== 'object') return;
  Object.keys(value).forEach(function (key) {
    var at = path ? path + '.' + key : key;
    if (FORBIDDEN.indexOf(key) >= 0) found.push(at);
    walkForbidden(value[key], at, found);
  });
}

function ledgerEvidence(ledger) {
  var out = {};
  var l = ledger && ledger.ledger || {};
  list(l.semanticEvidence).forEach(function (row) {
    if (identity(row && row.sourceIdentity)) out[row.sourceIdentity.value] = 'semantic';
  });
  var md = l.marketData || {};
  list(md.quotes).forEach(function (row) {
    if (identity(row && row.sourceIdentity)) out[row.sourceIdentity.value] = 'market';
  });
  list(l.networkEvidence).forEach(function (row) {
    if (identity(row && row.sourceIdentity)) out[row.sourceIdentity.value] = 'network';
  });
  return out;
}

function build(input) {
  input = input || {};
  var ledger = input.ledger || null;
  var proposal = input.proposal || null;
  var blockers = [];
  if (!ledger || ledger.schemaVersion !== 'finance-input-ledger/1.0' || ledger.status !== 'READY_FOR_PAPER_REVIEW') {
    blockers.push('finance_input_ledger_not_ready');
  }
  if (!proposal || proposal.schemaVersion !== SCHEMA) blockers.push('proposal_schema_required');
  var forbidden = [];
  walkForbidden(proposal, '', forbidden);
  forbidden.forEach(function (path) { blockers.push('proposal_forbidden_field_' + path); });

  var company = ledger && ledger.ledger && ledger.ledger.company;
  if (!proposal || !text(proposal.id)) blockers.push('proposal_id_required');
  if (!proposal || !proposal.company || proposal.company.slug !== (company && company.slug) ||
      proposal.company.ticker !== (company && company.ticker)) blockers.push('proposal_company_must_match_ledger');
  if (!proposal || !text(proposal.thesis)) blockers.push('proposal_thesis_required');
  if (!proposal || HORIZONS.indexOf(proposal.horizonDays) < 0) blockers.push('proposal_horizon_must_be_30_60_or_90_days');
  if (!proposal || !text(proposal.invalidation)) blockers.push('proposal_invalidation_required');
  if (!proposal || !Array.isArray(proposal.scenarios) || proposal.scenarios.length < 2) blockers.push('proposal_two_scenarios_required');
  if (!proposal || proposal.paperOnly !== true) blockers.push('proposal_must_be_paper_only');
  if (!proposal || proposal.independenceAssessment == null || proposal.independenceAssessment.status !== 'UNASSESSED' ||
      !text(proposal.independenceAssessment.reason)) blockers.push('publisher_independence_must_remain_explicitly_unassessed');
  if (!proposal || !proposal.provenance || !text(proposal.provenance.producer) || !timestamp(proposal.provenance.generatedAt)) {
    blockers.push('proposal_provenance_required');
  }

  var evidence = ledgerEvidence(ledger);
  var roles = { semantic: 0, market: 0, network: 0 };
  var refs = list(proposal && proposal.evidenceRefs);
  if (!refs.length) blockers.push('proposal_evidence_refs_required');
  refs.forEach(function (ref, index) {
    if (!ref || !identity(ref.sourceIdentity) || !text(ref.role)) {
      blockers.push('proposal_evidence_ref_' + index + '_invalid');
      return;
    }
    var actualRole = evidence[ref.sourceIdentity.value];
    if (!actualRole) blockers.push('proposal_evidence_ref_' + index + '_not_in_ledger');
    else if (actualRole !== ref.role) blockers.push('proposal_evidence_ref_' + index + '_role_mismatch');
    else if (roles[ref.role] !== undefined) roles[ref.role]++;
  });
  ['semantic', 'market', 'network'].forEach(function (role) {
    if (!roles[role]) blockers.push('proposal_' + role + '_evidence_required');
  });

  var status = blockers.length ? 'ABSTAINED' : 'PAPER_CANDIDATE';
  return {
    schemaVersion: CANDIDATE_SCHEMA,
    proposalSchemaVersion: SCHEMA,
    id: proposal && proposal.id || null,
    status: status,
    lane: 'investment',
    ownerDomain: 'finance',
    simulationOnly: true,
    liveExecution: false,
    company: clone(company),
    thesis: proposal && proposal.thesis || null,
    invalidation: proposal && proposal.invalidation || null,
    scenarios: clone(proposal && proposal.scenarios || []),
    horizonDays: proposal && proposal.horizonDays || null,
    evidenceRefs: clone(refs),
    independenceAssessment: clone(proposal && proposal.independenceAssessment || null),
    provenance: clone(proposal && proposal.provenance || null),
    blockers: blockers
  };
}

function releaseForPaper(candidate, release) {
  if (!candidate || candidate.schemaVersion !== CANDIDATE_SCHEMA || candidate.status !== 'PAPER_CANDIDATE') {
    return { ok: false, status: 'ABSTAINED', reason: 'candidate_not_ready_for_paper_release' };
  }
  if (!release || release.mode !== 'sandbox-paper' || !text(release.policyId) || !timestamp(release.releasedAt)) {
    return { ok: false, status: 'ABSTAINED', reason: 'paper_release_policy_required' };
  }
  return Object.assign({}, clone(candidate), {
    schemaVersion: 'finance-paper-candidate/1.0',
    status: 'READY_TO_FIRE',
    release: { mode: 'sandbox-paper', policyId: release.policyId, releasedAt: new Date(Date.parse(release.releasedAt)).toISOString() }
  });
}

function toReplayCandidate(candidate) {
  if (!candidate || candidate.schemaVersion !== CANDIDATE_SCHEMA || candidate.status !== 'READY_TO_FIRE') {
    throw new Error('finance-opportunity-producer: a released paper candidate is required');
  }
  var company = candidate.company || {};
  var primary = list(candidate.evidenceRefs).find(function (ref) { return ref && ref.role === 'semantic'; });
  if (!text(company.slug) || !text(company.ticker) || !primary || !identity(primary.sourceIdentity)) {
    throw new Error('finance-opportunity-producer: replay candidate identity is incomplete');
  }
  return {
    status: 'READY_TO_FIRE',
    lane: 'investment',
    artifactRef: candidate.id,
    portalSlug: company.slug,
    portalTicker: company.ticker,
    patternId: 'finance-manager-proposal/1',
    phase: null,
    fireScore: null,
    sourceIdentity: clone(primary.sourceIdentity),
    proposalSchemaVersion: candidate.proposalSchemaVersion,
    paperOnly: true,
    liveExecution: false
  };
}

module.exports = {
  SCHEMA: SCHEMA,
  CANDIDATE_SCHEMA: CANDIDATE_SCHEMA,
  HORIZONS: HORIZONS.slice(),
  build: build,
  releaseForPaper: releaseForPaper,
  toReplayCandidate: toReplayCandidate
};
