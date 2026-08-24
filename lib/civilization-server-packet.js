'use strict';

/*
 * Trusted server-side producer contract for the Civilization handoff.
 *
 * The browser adapter remains an observer of window state. This module is the
 * boundary a future cron producer must use after it has rebuilt a packet from
 * persisted server inputs. It deliberately has no network, storage, provider,
 * lane-firing, or activation authority.
 */

var MODULE_ID = 'civilization-server-packet';
var PACKET_SCHEMA = 'civilization-domain-packet/1.0';
var HANDOFF_SCHEMA = 'civilization-handoff/1.0';
var ACTIVE_LANES = ['investments', 'research-papers'];
var MAX_ITEMS = 32;

function fail(code, message) {
  var err = new Error(MODULE_ID + ': ' + message);
  err.code = code;
  throw err;
}

function requiredString(value, name) {
  if (typeof value !== 'string' || !value.trim()) fail('REQUIRED_' + name.toUpperCase(), name + ' is required');
  return value.trim();
}

function timestamp(value, name) {
  var s = requiredString(value, name);
  var ms = Date.parse(s);
  if (!Number.isFinite(ms)) fail('INVALID_' + name.toUpperCase(), name + ' must be a parseable timestamp');
  return new Date(ms).toISOString();
}

function arr(value, name) {
  if (!Array.isArray(value)) fail('INVALID_' + name.toUpperCase(), name + ' must be an array');
  if (value.length > MAX_ITEMS) fail('OVERFLOW_' + name.toUpperCase(), name + ' exceeds the bounded packet limit');
  return value;
}

function finite(value, name) {
  if (value !== null && value !== undefined && (!Number.isFinite(value) || typeof value !== 'number')) {
    fail('INVALID_' + name.toUpperCase(), name + ' must be a finite number or null');
  }
  return value === undefined ? null : value;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sourceIdentity(input) {
  var source = input && input.sourceIdentity;
  if (!source || typeof source !== 'object' || Array.isArray(source)) fail('SOURCE_IDENTITY_REQUIRED', 'sourceIdentity is required');
  return {
    snapshotId: requiredString(source.snapshotId, 'sourceIdentity.snapshotId'),
    retrievedAt: timestamp(source.retrievedAt, 'sourceIdentity.retrievedAt'),
    refreshId: requiredString(source.refreshId, 'sourceIdentity.refreshId'),
    producer: requiredString(source.producer, 'sourceIdentity.producer')
  };
}

function normalizeTruth(input) {
  var truth = input && input.truth;
  if (!truth || typeof truth !== 'object' || Array.isArray(truth)) fail('TRUTH_REQUIRED', 'truth is required');
  return {
    stressScore: finite(truth.stressScore, 'truth.stressScore'),
    confidence: finite(truth.confidence, 'truth.confidence'),
    activityLevel: truth.activityLevel == null ? null : requiredString(truth.activityLevel, 'truth.activityLevel'),
    phase: truth.phase == null ? null : requiredString(truth.phase, 'truth.phase'),
    phaseLabel: truth.phaseLabel == null ? null : requiredString(truth.phaseLabel, 'truth.phaseLabel'),
    activeDiagnoses: clone(arr(truth.activeDiagnoses, 'truth.activeDiagnoses')),
    treatments: clone(arr(truth.treatments, 'truth.treatments')),
    opportunities: clone(arr(truth.opportunities, 'truth.opportunities')),
    directives: clone(arr(truth.directives, 'truth.directives')),
    feedHealth: truth.feedHealth && typeof truth.feedHealth === 'object' ? clone(truth.feedHealth) : null
  };
}

function buildPacket(input) {
  input = input || {};
  if (input.schemaVersion !== PACKET_SCHEMA) fail('SCHEMA_REQUIRED', 'schemaVersion must be ' + PACKET_SCHEMA);
  if (input.sourceType !== 'server-cognition-refresh') fail('SOURCE_TYPE_REQUIRED', 'sourceType must be server-cognition-refresh');
  var domainId = requiredString(input.domainId, 'domainId');
  var cycleId = requiredString(input.cycleId, 'cycleId');
  var generatedAt = timestamp(input.generatedAt, 'generatedAt');
  var source = sourceIdentity(input);
  var truth = normalizeTruth(input);
  var audit = input.civAudit && typeof input.civAudit === 'object' ? clone(input.civAudit) : {};
  var packetId = domainId + ':' + cycleId + ':' + source.snapshotId;
  return {
    schemaVersion: PACKET_SCHEMA,
    packetId: packetId,
    domainId: domainId,
    domainLabel: input.domainLabel == null ? domainId : requiredString(input.domainLabel, 'domainLabel'),
    cycleId: cycleId,
    generatedAt: generatedAt,
    sourceType: input.sourceType,
    sourceIdentity: source,
    truth: truth,
    civAudit: audit,
    provenance: {
      sourceIdentity: source,
      generatedAt: generatedAt,
      producer: source.producer
    }
  };
}

function toHandoff(packet, lane, opportunity) {
  if (!packet || packet.schemaVersion !== PACKET_SCHEMA) fail('PACKET_REQUIRED', 'a validated server packet is required');
  if (ACTIVE_LANES.indexOf(lane) < 0) fail('LANE_UNSUPPORTED', 'lane is not active');
  if (!opportunity || typeof opportunity !== 'object') fail('OPPORTUNITY_REQUIRED', 'opportunity is required');
  var opportunityId = requiredString(opportunity.id, 'opportunity.id');
  return {
    schemaVersion: HANDOFF_SCHEMA,
    handoffId: packet.packetId + ':' + lane + ':' + opportunityId,
    opportunityId: opportunityId,
    lane: lane,
    sourceDomains: [packet.domainId],
    sourceDiagnoses: packet.truth.activeDiagnoses,
    sourceTreatments: packet.truth.treatments,
    opportunity: clone(opportunity),
    sourcePacketId: packet.packetId,
    sourcePacketSchema: packet.schemaVersion,
    sourceIdentity: clone(packet.sourceIdentity),
    createdAt: packet.generatedAt
  };
}

module.exports = {
  MODULE_ID: MODULE_ID,
  PACKET_SCHEMA: PACKET_SCHEMA,
  HANDOFF_SCHEMA: HANDOFF_SCHEMA,
  ACTIVE_LANES: ACTIVE_LANES.slice(),
  MAX_ITEMS: MAX_ITEMS,
  buildPacket: buildPacket,
  toHandoff: toHandoff
};
