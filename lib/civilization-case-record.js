'use strict';

/*
 * Reviewable case record carried by a Civilization handoff.
 *
 * This is not a legal opinion, an order, a research result, or an investment
 * recommendation. It is the durable, versioned record of what the system
 * knows, what it does not know, and why it has not authorized an outward act.
 */

var SCHEMA = 'civilization-case-record/1.0';
var MAPPINGS = ['neurology_to_business_homology', 'business_to_neurology_homology', 'kernel_dynamics', 'p0_p10_proof_and_effects'];
var ACTIVE_LANES = ['investments', 'research-papers'];

function fail(code, message) { var e = new Error('civilization-case-record: ' + message); e.code = code; throw e; }
function string(v, name) { if (typeof v !== 'string' || !v.trim()) fail('CASE_' + name.toUpperCase() + '_REQUIRED', name + ' is required'); return v.trim(); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function arr(v) { return Array.isArray(v) ? clone(v) : []; }
function value(v) { return v == null ? null : clone(v); }

function build(packet, lane, opportunity) {
  if (!packet || typeof packet !== 'object') fail('CASE_PACKET_REQUIRED', 'packet is required');
  if (ACTIVE_LANES.indexOf(lane) < 0) fail('CASE_LANE_UNSUPPORTED', 'lane is not active');
  if (!opportunity || typeof opportunity !== 'object') fail('CASE_OPPORTUNITY_REQUIRED', 'opportunity is required');
  var opportunityId = string(opportunity.id, 'opportunityId');
  var title = string(opportunity.title || opportunity.label || opportunityId, 'title');
  var domain = string(packet.domainId, 'domainId');
  var activeDiagnoses = arr(packet.truth && packet.truth.activeDiagnoses);
  var treatments = arr(packet.truth && packet.truth.treatments);
  var directives = arr(packet.truth && packet.truth.directives);
  var abstentions = [];
  var citations = arr(opportunity.citations || opportunity.citationHints || opportunity.evidenceAnchors);
  var evidenceIds = arr(opportunity.evidenceIds).map(function (v) { return String(v); });
  if (!citations.length) abstentions.push('no-citation-list-on-opportunity');
  if (!evidenceIds.length) abstentions.push('no-independent-evidence-ids');
  if (lane === 'research-papers' && domain !== 'science' && domain !== 'medicine') abstentions.push('research-owner-domain-not-science-or-medicine');
  if (lane === 'investments' && domain !== 'finance') abstentions.push('investment-origin-is-not-finance');
  return {
    schemaVersion: SCHEMA,
    recordId: packet.packetId + ':' + lane + ':' + opportunityId,
    recordType: lane === 'research-papers' ? 'research-opportunity-review' : 'investment-opportunity-review',
    recordVersion: 1,
    status: 'OBSERVATIONAL',
    authorization: { status: 'NOT_AUTHORIZED', liveExecution: false, paperOnly: lane === 'investments', humanReviewRequired: true },
    origin: { domainId: domain, cycleId: packet.cycleId, packetId: packet.packetId, sourceIdentity: clone(packet.sourceIdentity) },
    claim: { opportunityId: opportunityId, title: title, summary: value(opportunity.summary || opportunity.description || opportunity.whyNow), diagnosisIds: activeDiagnoses.map(function (d) { return d && (d.id || null); }).filter(Boolean) },
    basis: { treatments: treatments, directives: directives, phase: value(packet.truth && packet.truth.phase), phaseLabel: value(packet.truth && packet.truth.phaseLabel), confidence: value(packet.truth && packet.truth.confidence), contextOnly: true },
    evidence: { citations: citations, evidenceIds: evidenceIds, sourceIdentity: clone(packet.sourceIdentity), independenceAssessment: { status: 'UNESTABLISHED', method: null, basis: 'handoff record alone does not establish independence' }, contradictions: [], retractions: [], mappingCoverage: { neurology_to_business_homology: false, business_to_neurology_homology: false, kernel_dynamics: false, p0_p10_proof_and_effects: false } },
    laneTerms: lane === 'research-papers' ? {
      accountableOwner: domain === 'science' || domain === 'medicine' ? domain : null,
      evaluationStatus: 'NOT_EVALUATED', publicationStatus: 'NOT_A_PUBLICATION_RECEIPT', requiredMappings: MAPPINGS.slice(), progress: null
    } : {
      accountableOwner: 'finance', executionMode: 'paper-only', horizonsDays: [30, 60, 90], instrument: value(opportunity.ticker || opportunity.symbol || opportunity.instrument), quantity: null, budget: null, broker: null, account: null, order: null, riskLimits: { maxLoss: null, maxDrawdown: null, stop: null }, outcomeStatus: 'NOT_OBSERVED'
    },
    decision: { status: 'ABSTAINED', reasons: abstentions.concat(['case-record-is-not-an-authorization']) },
    provenance: { generatedAt: packet.generatedAt, producer: packet.sourceIdentity.producer, sourcePacketSchema: packet.schemaVersion }
  };
}

module.exports = { SCHEMA: SCHEMA, MAPPINGS: MAPPINGS.slice(), ACTIVE_LANES: ACTIVE_LANES.slice(), build: build };
