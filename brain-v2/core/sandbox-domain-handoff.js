/*
 * Domain-packet -> sandbox handoff adapter.
 *
 * This is a sandbox-only seam. It consumes the versioned Civilization domain
 * packet shape, carries its diagnosis/treatment identity into the active
 * domain-owned sandbox handoff, and refuses empty or unversioned packets. It
 * does not call a provider, create an opportunity, or activate a lane.
 */
'use strict';

var MODULE_ID = 'brain-v2/core/sandbox-domain-handoff';
var PACKET_SCHEMA = 'civilization-domain-packet/1.0';
var HANDOFF_SCHEMA = 'civilization-handoff/1.0';
var LaneContract = require('./sandbox-lane-contract.js');
var ACTIVE_LANES = LaneContract.list();

function fail(message) { throw new Error(MODULE_ID + ': ' + message); }
function arr(value) { return Array.isArray(value) ? value : []; }

function fromPacket(packet, opportunity, lane, now) {
  if (!packet || packet.schemaVersion !== PACKET_SCHEMA) fail('domain packet schema must be ' + PACKET_SCHEMA);
  if (typeof packet.domainId !== 'string' || !packet.domainId) fail('domain packet domainId is required');
  if (ACTIVE_LANES.indexOf(lane) < 0) fail('lane is not an active civilization sandbox lane');
  if (!opportunity || typeof opportunity.id !== 'string' || !opportunity.id) fail('opportunity id is required');
  if (!opportunity.motorClaim || typeof opportunity.motorClaim.variable !== 'string' || !opportunity.motorClaim.variable) {
    fail('opportunity motorClaim.variable is required');
  }
  if (typeof opportunity.motorClaim.magnitude !== 'number' || !isFinite(opportunity.motorClaim.magnitude)) {
    fail('opportunity motorClaim.magnitude must be finite');
  }

  var diagnoses = arr(packet.activeDiagnoses);
  var treatments = arr(packet.treatments);
  if (!diagnoses.length) fail('domain packet has no active diagnoses');
  if (!treatments.length) fail('domain packet has no treatments');

  return {
    schemaVersion: HANDOFF_SCHEMA,
    opportunityId: opportunity.id,
    lane: lane,
    sourceDomains: [packet.domainId],
    sourceDiagnoses: diagnoses.map(function (d) {
      return { domain: packet.domainId, id: d.id || null, label: d.label || d.summary || '', summary: d.summary || d.label || '', relevance: d.relevance == null ? null : d.relevance };
    }),
    sourceTreatments: treatments.map(function (t) {
      return { domain: packet.domainId, treatment: t.treatment || t };
    }),
    motorClaim: { variable: opportunity.motorClaim.variable, magnitude: opportunity.motorClaim.magnitude },
    laneContract: LaneContract.get(lane),
    sourcePacketSchema: packet.schemaVersion,
    packetSourceType: packet.sourceType || null,
    createdAt: now
  };
}

module.exports = {
  MODULE_ID: MODULE_ID,
  PACKET_SCHEMA: PACKET_SCHEMA,
  HANDOFF_SCHEMA: HANDOFF_SCHEMA,
  ACTIVE_LANES: ACTIVE_LANES.slice(),
  fromPacket: fromPacket
};
