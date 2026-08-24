'use strict';

/**
 * Source-grounded Finance opportunity release.
 *
 * This is the only bridge from a Finance cognition packet into paper review.
 * It does not select a ticker, infer a trade, call a model, or authorize an
 * order. A packet without an explicit, provenance-bearing investment
 * opportunity remains abstained.
 */

var SCHEMA = 'finance-opportunity-release/1.0';

function list(value) { return Array.isArray(value) ? value : []; }
function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function identity(value) { return value && typeof value === 'object' && text(value.kind) && text(value.value); }
function citations(value) {
  return list(value).filter(function (item) {
    return text(item) || identity(item);
  });
}

function blocker(code, opportunityId) {
  return { code: code, opportunityId: opportunityId || null };
}

function validateOpportunity(packet, opportunity) {
  var id = text(opportunity && opportunity.id) ? opportunity.id : null;
  var blockers = [];
  if (!id) blockers.push(blocker('opportunity_id_required', id));
  if (!text(opportunity && opportunity.title)) blockers.push(blocker('opportunity_title_required', id));

  /* The canonical lane must already be present in the trusted packet. A raw
     INVESTABLE path is not a release by itself; the server packet's explicit
     vocabulary mapping must have produced investments. */
  if (!opportunity || opportunity.lane !== 'investments') {
    blockers.push(blocker('investment_lane_required', id));
  }

  var company = opportunity && opportunity.company;
  var ticker = opportunity && (opportunity.ticker || opportunity.symbol || (company && company.ticker));
  var slug = opportunity && (opportunity.companySlug || (company && company.slug));
  if (!text(slug) || !text(ticker)) blockers.push(blocker('company_binding_required', id));

  var evidenceIds = list(opportunity && opportunity.evidenceIds).filter(text);
  var sourceCitations = citations(opportunity && (opportunity.citations || opportunity.evidenceAnchors || opportunity.citationHints));
  if (!evidenceIds.length && !sourceCitations.length) blockers.push(blocker('source_evidence_identity_required', id));

  var diagnosisId = opportunity && (opportunity.diagnosisId || opportunity.claimId || opportunity.sourceClaimId);
  if (!text(diagnosisId)) blockers.push(blocker('source_claim_or_diagnosis_required', id));

  if (blockers.length) return { ok: false, blockers: blockers };
  return {
    ok: true,
    candidate: {
      schemaVersion: SCHEMA,
      id: id,
      title: opportunity.title,
      lane: 'investment',
      status: 'RELEASED_FOR_PAPER_REVIEW',
      sourcePacketId: packet.packetId,
      cycleId: packet.cycleId,
      company: { slug: slug, ticker: ticker },
      source: {
        diagnosisId: String(diagnosisId),
        evidenceIds: evidenceIds,
        citations: clone(sourceCitations)
      },
      terms: { executionMode: 'paper', liveExecution: false, horizonsDays: [30, 60, 90] },
      order: null,
      rationale: clone(opportunity.summary || opportunity.whyNow || opportunity.explain || null)
    }
  };
}

function build(input) {
  input = input || {};
  var packet = input.financePacket;
  var cycle = input.financeCycle;
  var blockers = [];
  if (!packet || packet.sourceType !== 'server-cognition-refresh' || packet.domainId !== 'finance' || !text(packet.packetId) || !text(packet.cycleId)) {
    blockers.push(blocker('finance_packet_missing_or_untrusted'));
  }
  if (!cycle || cycle.domain !== 'finance' || cycle.ok !== true) blockers.push(blocker('finance_cycle_missing_or_not_ok'));
  if (packet && cycle && packet.cycleId != null && cycle.cycleId != null && String(packet.cycleId) !== String(cycle.cycleId)) {
    blockers.push(blocker('finance_packet_cycle_mismatch'));
  }
  var opportunities = packet && packet.truth ? list(packet.truth.opportunities) : [];
  if (!opportunities.length) blockers.push(blocker('finance_packet_has_no_opportunity'));

  var rejected = [];
  var candidates = [];
  if (!blockers.length) {
    opportunities.forEach(function (opportunity) {
      var result = validateOpportunity(packet, opportunity || {});
      if (result.ok) candidates.push(result.candidate);
      else rejected.push.apply(rejected, result.blockers);
    });
    if (!candidates.length && rejected.length) blockers.push(blocker('no_source_grounded_investment_release'));
  }

  return {
    schemaVersion: SCHEMA,
    status: blockers.length ? 'ABSTAINED' : 'RELEASED_FOR_PAPER_REVIEW',
    blockers: blockers,
    rejected: rejected,
    candidates: candidates,
    candidate: candidates[0] || null,
    sourcePacketId: packet && packet.packetId || null,
    liveExecution: false
  };
}

module.exports = {
  SCHEMA: SCHEMA,
  build: build,
  validateOpportunity: validateOpportunity
};
