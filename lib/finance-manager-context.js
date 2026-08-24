'use strict';

/**
 * Finance-manager context contract.
 *
 * This is a paper/sandbox assembly boundary. It does not select a security,
 * calculate a composite score, call a model, or submit an order. It preserves
 * explicit evidence and abstains when the Finance manager would otherwise be
 * asked to fill a gap with a universal kernel rule.
 */

var SCHEMA = 'finance-manager-context/1.0';

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function list(value) { return Array.isArray(value) ? value : []; }
function finite(value) { return typeof value === 'number' && Number.isFinite(value); }

function validObservation(row) {
  return row && typeof row === 'object' &&
    row.sourceIdentity && row.sourceIdentity.value &&
    row.recordedAt && !Number.isNaN(Date.parse(row.recordedAt)) &&
    (row.sourceUpdatedAt == null || !Number.isNaN(Date.parse(row.sourceUpdatedAt))) &&
    (row.title || row.claim || row.rawValue !== undefined);
}

function build(input) {
  input = input || {};
  var financeCycle = input.financeCycle || null;
  var company = input.company || null;
  var observations = list(input.observations);
  var marketData = input.marketData || null;
  var kernel = input.kernelContext || { applicable: false, reason: 'no-company-specific-kernel-mapping' };
  var blockers = [];

  if (!financeCycle || financeCycle.domain !== 'finance' || financeCycle.ok !== true) {
    blockers.push('finance_cycle_missing_or_not_ok');
  }
  var fnEvidence = financeCycle && financeCycle.domainFunction && financeCycle.domainFunction.evidence || {};
  if (fnEvidence.l3CurrentEvidenceComplete !== true) blockers.push('finance_l3_evidence_incomplete');
  if (!company || !company.slug || !company.ticker) blockers.push('company_identity_incomplete');
  if (!observations.length) blockers.push('semantic_source_observations_required');
  observations.forEach(function (row, index) {
    if (!validObservation(row)) blockers.push('observation_' + index + '_missing_identity_timestamp_or_claim');
  });
  if (!marketData || !marketData.asOf || !list(marketData.sources).length) {
    blockers.push('market_data_snapshot_required');
  }
  if (!kernel || typeof kernel.applicable !== 'boolean') {
    blockers.push('kernel_applicability_must_be_explicit');
  } else if (kernel.applicable && (!kernel.mappingId || !kernel.provenance)) {
    blockers.push('applicable_kernel_requires_mapping_and_provenance');
  }

  return {
    schemaVersion: SCHEMA,
    lane: 'investment',
    ownerDomain: 'finance',
    mode: 'sandbox-paper',
    liveExecution: false,
    company: clone(company),
    financeCycle: clone(financeCycle),
    observations: clone(observations),
    marketData: clone(marketData),
    policyStatements: clone(list(input.policyStatements)),
    networkEvidence: clone(list(input.networkEvidence)),
    kernelContext: clone(kernel),
    blockers: blockers,
    status: blockers.length ? 'ABSTAINED' : 'READY_FOR_PAPER_REVIEW'
  };
}

module.exports = { SCHEMA: SCHEMA, build: build, validObservation: validObservation };
