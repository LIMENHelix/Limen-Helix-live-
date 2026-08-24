'use strict';

/**
 * Finance manager -> opportunity-producer boundary.
 *
 * The manager response and the producer proposal deliberately have different
 * schemas. This pure adapter is the reviewed handoff between them. It does
 * not call a model, release a candidate, write state, or submit an order.
 */

var MANAGER_SCHEMA = 'finance-manager-proposal/1.0';
var PRODUCER_SCHEMA = 'finance-opportunity-proposal/1.0';

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function timestamp(value) { return text(value) && Number.isFinite(Date.parse(value)); }

function adapt(parsed) {
  if (!parsed || parsed.ok !== true || parsed.status !== 'PROPOSED' || !parsed.proposal) {
    return { ok: false, status: 'ABSTAINED', reason: 'manager_proposal_not_accepted' };
  }
  var p = parsed.proposal;
  var blockers = [];
  if (p.schemaVersion !== MANAGER_SCHEMA) blockers.push('manager_proposal_schema_required');
  if (!text(p.id)) blockers.push('manager_proposal_id_required');
  if (!p.company || !text(p.company.slug) || !text(p.company.ticker)) blockers.push('manager_proposal_company_required');
  if (!text(p.thesis)) blockers.push('manager_proposal_thesis_required');
  if (!text(p.invalidation)) blockers.push('manager_proposal_invalidation_required');
  if ([30, 60, 90].indexOf(p.horizonDays) < 0) blockers.push('manager_proposal_horizon_required');
  if (!Array.isArray(p.scenarios) || p.scenarios.length < 2) blockers.push('manager_proposal_scenarios_required');
  if (!Array.isArray(p.evidenceRefs) || !p.evidenceRefs.length) blockers.push('manager_proposal_evidence_refs_required');
  if (!p.independenceAssessment || p.independenceAssessment.status !== 'UNASSESSED' ||
      !text(p.independenceAssessment.reason)) blockers.push('manager_proposal_independence_must_remain_unassessed');
  if (p.paperOnly !== true) blockers.push('manager_proposal_must_be_paper_only');
  if (!p.provenance || !text(p.provenance.producer) || !timestamp(p.provenance.generatedAt)) {
    blockers.push('manager_proposal_provenance_required');
  }
  if (Object.prototype.hasOwnProperty.call(p, 'liveExecution')) blockers.push('manager_proposal_live_execution_forbidden');
  if (blockers.length) return { ok: false, status: 'ABSTAINED', reason: blockers[0], blockers: blockers };

  return {
    ok: true,
    status: 'PROPOSAL_READY',
    proposal: {
      schemaVersion: PRODUCER_SCHEMA,
      id: p.id,
      company: clone(p.company),
      thesis: p.thesis,
      invalidation: p.invalidation,
      horizonDays: p.horizonDays,
      scenarios: clone(p.scenarios),
      evidenceRefs: clone(p.evidenceRefs),
      independenceAssessment: clone(p.independenceAssessment),
      paperOnly: true,
      provenance: Object.assign({}, clone(p.provenance), {
        managerResponseSchema: MANAGER_SCHEMA
      })
    }
  };
}

module.exports = {
  MANAGER_SCHEMA: MANAGER_SCHEMA,
  PRODUCER_SCHEMA: PRODUCER_SCHEMA,
  adapt: adapt
};
