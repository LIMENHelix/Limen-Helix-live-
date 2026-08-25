'use strict';

/**
 * Finance-manager request/response contract.
 *
 * This module only builds a bounded prompt and parses a model's JSON response.
 * It does not call a provider, spend money, release a candidate, or submit an
 * order. The parsed proposal must still pass finance-opportunity-producer.js.
 */

var REQUEST_SCHEMA = 'finance-manager-request/1.0';
var RESPONSE_SCHEMA = 'finance-manager-proposal/1.0';
var MAX_OBSERVATIONS = 32;
var MAX_SCENARIOS = 4;
var Homology = require('./civilization-homology-context.js');

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function list(value) { return Array.isArray(value) ? value : []; }
function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
function timestamp(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }
function sourceIdentity(value) { return value && typeof value === 'object' && text(value.kind) && text(value.value); }

function validHomology(value) {
  if (!value) return false;
  try { Homology.normalize(value); return true; } catch (e) { return false; }
}

function allowedEvidenceRefs(candidate) {
  var ledger = candidate && candidate.ledger && candidate.ledger.ledger || {};
  var refs = [];
  list(ledger.semanticEvidence).forEach(function (row) {
    if (sourceIdentity(row && row.sourceIdentity)) refs.push({ role: 'semantic', sourceIdentity: clone(row.sourceIdentity) });
  });
  list(ledger.marketData && ledger.marketData.quotes).forEach(function (row) {
    if (sourceIdentity(row && row.sourceIdentity)) refs.push({ role: 'market', sourceIdentity: clone(row.sourceIdentity) });
  });
  list(ledger.networkEvidence).forEach(function (row) {
    if (sourceIdentity(row && row.sourceIdentity)) refs.push({ role: 'network', sourceIdentity: clone(row.sourceIdentity) });
  });
  return refs;
}

function candidateContexts(candidates) {
  return list(candidates).slice(0, 12).map(function (candidate) {
    var projected = clone(candidate);
    projected.allowedEvidenceRefs = allowedEvidenceRefs(candidate);
    return projected;
  });
}

function buildRequest(input) {
  input = input || {};
  var ctx = input.managerContext || input.context || null;
  if (!ctx || ctx.status !== 'READY_FOR_PAPER_REVIEW') {
    return { ok: false, status: 'ABSTAINED', reason: 'finance_manager_context_not_ready' };
  }
  var candidates = list(ctx.companyCandidates);
  var homologyContexts = list(ctx.homologyContexts);
  var homologyReady = validHomology(ctx.homologyContext) ||
    (candidates.length > 0 && homologyContexts.length === candidates.length && homologyContexts.every(function (row) {
      return row && validHomology(row.context);
    }));
  if (!homologyReady) return { ok: false, status: 'ABSTAINED', reason: 'finance_homology_context_not_ready' };
  var observations = list(ctx.observations).slice(0, MAX_OBSERVATIONS);
  return {
    ok: true,
    schemaVersion: REQUEST_SCHEMA,
    mode: 'sandbox-paper',
    instructions: [
      'Use only the supplied, source-identified records. Do not add facts, prices, ownership, independence, or causal claims.',
      'Return one JSON object only; no markdown and no prose outside the object.',
      'Create a paper candidate, never an order. Do not emit tradeIntent, order, side, quantity, limitPrice, or liveExecution.',
      'If companyCandidates are supplied, select exactly one company from that list; never invent or substitute an identity.',
      'After selecting a company, use evidence only from that same companyCandidates entry. Never cite an identity from another company ledger.',
      'Return exactly three evidenceRefs: one semantic, one market, and one network. Copy each from the selected company entry\'s allowedEvidenceRefs list.',
      'Set horizonDays to one integer: 30, 60, or 90. It must never be an array or a range.',
      'For every evidenceRefs item, copy the exact sourceIdentity object with both kind and value fields from the supplied context. Never replace it with a string, description, URL, or citation label.',
      'A title, stress value, Thing 1 result, Thing 2 phase, or model confidence cannot directly authorize an investment.',
      'Use the supplied observational homology context to relate phase, regulation direction, brain-node evidence, recovery, and business mappings to the review thesis. Preserve its abstentions; it is context only, never a trade trigger or authorization.',
      'Keep publisher ownership and syndication independence UNASSESSED unless a separate provenance review supplied evidence.',
      'If the supplied records do not support a bounded thesis and invalidation, abstain rather than complete the gaps.'
    ],
    outputSchema: {
      schemaVersion: RESPONSE_SCHEMA,
      id: 'string',
      company: { slug: 'string', ticker: 'string' },
      thesis: 'string',
      invalidation: 'string',
      horizonDays: 'integer; exactly one of 30, 60, or 90',
      scenarios: 'array (at least base and downside)',
      evidenceRefs: [{ role: 'semantic | market | network', sourceIdentity: { kind: 'exact supplied kind', value: 'exact supplied value' } }],
      independenceAssessment: { status: 'UNASSESSED', reason: 'string' },
      paperOnly: true,
      provenance: { producer: 'string', generatedAt: 'ISO-8601 timestamp' }
    },
    context: {
      company: clone(ctx.company),
      financeCycle: clone(ctx.financeCycle),
      observations: observations,
      marketData: clone(ctx.marketData),
      networkEvidence: clone(ctx.networkEvidence),
      thing1: clone(ctx.thing1 || { applicable: false, reason: 'not-supplied' }),
      thing2: clone(ctx.thing2 || { applicable: false, reason: 'not-supplied' }),
      homologyContext: clone(ctx.homologyContext || null),
      homologyContexts: clone(homologyContexts),
      policyStatements: clone(list(ctx.policyStatements)),
      companyCandidates: candidateContexts(ctx.companyCandidates)
    }
  };
}

function parseResponse(raw) {
  var value = raw;
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw); } catch (e) {
      return { ok: false, status: 'ABSTAINED', reason: 'manager_response_must_be_json' };
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, status: 'ABSTAINED', reason: 'manager_response_must_be_an_object' };
  }
  var blockers = [];
  if (value.schemaVersion !== RESPONSE_SCHEMA) blockers.push('manager_response_schema_required');
  if (!text(value.id)) blockers.push('manager_response_id_required');
  if (!value.company || !text(value.company.slug) || !text(value.company.ticker)) blockers.push('manager_response_company_required');
  if (!text(value.thesis)) blockers.push('manager_response_thesis_required');
  if (!text(value.invalidation)) blockers.push('manager_response_invalidation_required');
  if ([30, 60, 90].indexOf(value.horizonDays) < 0) blockers.push('manager_response_horizon_required');
  if (!Array.isArray(value.scenarios) || value.scenarios.length < 2 || value.scenarios.length > MAX_SCENARIOS) blockers.push('manager_response_scenarios_invalid');
  if (!Array.isArray(value.evidenceRefs) || value.evidenceRefs.length !== 3) blockers.push('manager_response_evidence_refs_required');
  else {
    var evidenceRoles = { semantic: 0, market: 0, network: 0 };
    var evidenceValid = value.evidenceRefs.every(function (ref) {
      if (!ref || evidenceRoles[ref.role] === undefined || !sourceIdentity(ref.sourceIdentity)) return false;
      evidenceRoles[ref.role]++;
      return true;
    });
    if (!evidenceValid || Object.keys(evidenceRoles).some(function (role) { return evidenceRoles[role] !== 1; })) {
      blockers.push('manager_response_evidence_refs_invalid');
    }
  }
  if (!value.independenceAssessment || value.independenceAssessment.status !== 'UNASSESSED' || !text(value.independenceAssessment.reason)) blockers.push('manager_response_independence_must_be_unassessed');
  if (value.paperOnly !== true) blockers.push('manager_response_must_be_paper_only');
  if (!value.provenance || !text(value.provenance.producer) || !timestamp(value.provenance.generatedAt)) blockers.push('manager_response_provenance_required');
  if (value.liveExecution !== undefined) blockers.push('manager_response_live_execution_forbidden');
  return blockers.length ? { ok: false, status: 'ABSTAINED', reason: blockers[0], blockers: blockers } : { ok: true, status: 'PROPOSED', proposal: clone(value) };
}

module.exports = {
  REQUEST_SCHEMA: REQUEST_SCHEMA,
  RESPONSE_SCHEMA: RESPONSE_SCHEMA,
  MAX_OBSERVATIONS: MAX_OBSERVATIONS,
  allowedEvidenceRefs: allowedEvidenceRefs,
  buildRequest: buildRequest,
  parseResponse: parseResponse
};
