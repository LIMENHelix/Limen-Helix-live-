'use strict';

/**
 * Finance input ledger.
 *
 * This is the production-shaped paper boundary for the Finance manager.  It
 * records inputs and provenance; it does not score, select, call a model, or
 * submit an order.  A missing, stale, contradictory, or non-identifiable
 * input produces ABSTAINED rather than an inferred substitute.
 */

var SCHEMA = 'finance-input-ledger/1.0';
var MAX_NETWORK_AGE_MS = 60 * 60 * 1000;
var Homology = require('./civilization-homology-context.js');

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function list(value) { return Array.isArray(value) ? value : []; }
function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function when(value) { var n = Date.parse(value); return Number.isFinite(n) ? n : null; }
function finite(value) { return typeof value === 'number' && Number.isFinite(value); }

function identity(value) {
  return value && typeof value === 'object' && text(value.kind) && text(value.value);
}

function semanticObservation(row) {
  if (!row || typeof row !== 'object') return false;
  if (!identity(row.sourceIdentity) || !when(row.recordedAt)) return false;
  if (row.sourceUpdatedAt != null && !when(row.sourceUpdatedAt)) return false;
  if (!text(row.publisher) && !text(row.feedName)) return false;
  if (!text(row.title) && !text(row.claim) && !text(row.bodyExcerpt)) return false;
  if (!text(row.canonicalUrl) && !text(row.sourceRecordId)) return false;
  return true;
}

function marketSnapshot(value) {
  if (!value || typeof value !== 'object' || !when(value.asOf)) return false;
  var rows = list(value.quotes);
  if (!rows.length || !list(value.sources).length) return false;
  return rows.every(function (row) {
    return row && text(row.symbol) && identity(row.sourceIdentity) &&
      when(row.observedAt || value.asOf) && (finite(row.price) || finite(row.bid) || finite(row.ask));
  });
}

function networkRow(row, now) {
  if (!row || typeof row !== 'object' || !identity(row.sourceIdentity)) return false;
  var at = when(row.asOf || row.recordedAt);
  if (!at || now - at > MAX_NETWORK_AGE_MS || at - now > MAX_NETWORK_AGE_MS) return false;
  return finite(row.value) || finite(row.stress) || text(row.claim);
}

function kernelContext(value, name) {
  if (!value || typeof value !== 'object' || typeof value.applicable !== 'boolean') {
    return name + '_applicability_must_be_explicit';
  }
  if (!value.applicable) return value.reason ? null : name + '_abstention_reason_required';
  if (!text(value.mappingId) || !value.provenance || !text(value.provenance.source)) {
    return name + '_mapping_and_provenance_required';
  }
  return null;
}

function homologyContext(value) {
  if (!value) return { error: 'homology_context_required', value: null };
  try {
    return { error: null, value: Homology.normalize(value) };
  } catch (e) {
    return { error: 'homology_context_invalid', value: null };
  }
}

function build(input) {
  input = input || {};
  var now = when(input.now) || Date.now();
  var blockers = [];
  var cycle = input.financeCycle;
  var packet = input.financePacket;
  var company = input.company;
  var observations = list(input.semanticEvidence);
  var marketData = input.marketData;
  var networkEvidence = list(input.networkEvidence);
  var candidate = input.candidate;
  var homology = homologyContext(input.homologyContext || (packet && packet.homologyContext));

  if (!cycle || cycle.domain !== 'finance' || cycle.ok !== true) blockers.push('finance_cycle_missing_or_not_ok');
  var cycleEvidence = cycle && cycle.domainFunction && cycle.domainFunction.evidence || {};
  if (cycleEvidence.l3CurrentEvidenceComplete !== true) blockers.push('finance_l3_evidence_incomplete');
  if (!packet || packet.sourceType !== 'server-cognition-refresh' || !when(packet.generatedAt)) {
    blockers.push('finance_packet_missing_or_untrusted');
  }
  if (homology.error) blockers.push(homology.error);
  if (!company || !text(company.slug) || !text(company.ticker)) blockers.push('company_identity_incomplete');
  if (!observations.length) blockers.push('semantic_feed_evidence_required');
  observations.forEach(function (row, index) {
    if (!semanticObservation(row)) blockers.push('semantic_observation_' + index + '_invalid');
  });
  if (!marketSnapshot(marketData)) blockers.push('market_data_snapshot_invalid');
  if (!networkEvidence.length) blockers.push('network_evidence_required');
  networkEvidence.forEach(function (row, index) {
    if (!networkRow(row, now)) blockers.push('network_evidence_' + index + '_stale_or_unidentified');
  });
  var thing1Error = kernelContext(input.thing1, 'thing1');
  var thing2Error = kernelContext(input.thing2, 'thing2');
  if (thing1Error) blockers.push(thing1Error);
  if (thing2Error) blockers.push(thing2Error);
  // A complete source ledger may be assembled before a manager proposal
  // exists. That is the input stage for the Finance manager. Once a candidate
  // is supplied, it must already carry the explicit paper release state before
  // the ledger can be used for sandbox replay. Requiring a candidate here at
  // all would make manager creation circular.
  if (candidate != null && (candidate.lane !== 'investment' || candidate.status !== 'READY_TO_FIRE')) {
    blockers.push('investment_candidate_not_explicitly_released');
  }

  var readyStatus = candidate == null ? 'READY_FOR_MANAGER_REVIEW' : 'READY_FOR_PAPER_REVIEW';

  return {
    schemaVersion: SCHEMA,
    status: blockers.length ? 'ABSTAINED' : readyStatus,
    simulationOnly: true,
    liveExecution: false,
    blockers: blockers,
    ledger: {
      financeCycle: clone(cycle),
      financePacket: clone(packet),
      company: clone(company),
      candidate: clone(candidate),
      semanticEvidence: clone(observations),
      marketData: clone(marketData),
      networkEvidence: clone(networkEvidence),
      thing1: clone(input.thing1),
      thing2: clone(input.thing2),
      homologyContext: clone(homology.value),
      policyStatements: clone(list(input.policyStatements)),
      createdAt: new Date(now).toISOString()
    }
  };
}

module.exports = {
  SCHEMA: SCHEMA,
  MAX_NETWORK_AGE_MS: MAX_NETWORK_AGE_MS,
  build: build,
  semanticObservation: semanticObservation,
  marketSnapshot: marketSnapshot
};
