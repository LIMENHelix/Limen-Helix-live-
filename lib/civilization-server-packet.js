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
var caseRecord = require('./civilization-case-record.js');
var homologyContext = require('./civilization-homology-context.js');
var PACKET_SCHEMA = 'civilization-domain-packet/1.0';
var HANDOFF_SCHEMA = 'civilization-handoff/1.0';
var ACTIVE_LANES = ['investments', 'research-papers'];
var OPPORTUNITY_LANE_MAP = { INVESTABLE: 'investments', RESEARCHABLE: 'research-papers' };
var MAX_ITEMS = 32;
var MAX_PACKET_BYTES = 256 * 1024;

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

/* The domain brains currently publish these two explicit path constants. The
 * mapping is versioned and allowlisted here so the consumer never guesses from
 * titles, stress, or arbitrary fields. Unknown paths remain unassigned. */
function normalizeOpportunity(value) {
  var out = clone(value || {});
  if (!out.lane && typeof out.path === 'string' && OPPORTUNITY_LANE_MAP[out.path]) {
    out.lane = OPPORTUNITY_LANE_MAP[out.path];
    out.laneProvenance = { schema: 'domain-opportunity-path-map/1.0', sourceField: 'path', sourceValue: out.path, rule: 'explicit-domain-path' };
  }
  return out;
}

function normalizeReleasedOpportunity(value) {
  var out = clone(value || {});
  if (out.status !== 'READY_TO_FIRE' || out.lane !== 'investment' ||
      out.paperOnly !== true || out.liveExecution !== false ||
      typeof out.id !== 'string' || !out.id ||
      typeof out.artifactRef !== 'string' || !out.artifactRef ||
      typeof out.portalSlug !== 'string' || !out.portalSlug ||
      typeof out.portalTicker !== 'string' || !out.portalTicker ||
      !out.sourceIdentity || typeof out.sourceIdentity.kind !== 'string' ||
      typeof out.sourceIdentity.value !== 'string') {
    fail('RELEASED_OPPORTUNITY_INVALID', 'released opportunity must be a complete paper investment candidate');
  }
  return out;
}

function packetOpportunities(state, extras) {
  var values = (Array.isArray(state.opportunities) ? state.opportunities : []).map(normalizeOpportunity);
  var released = extras && Array.isArray(extras.releasedOpportunities)
    ? extras.releasedOpportunities.map(normalizeReleasedOpportunity) : [];
  var seen = Object.create(null), out = [];
  values.concat(released).forEach(function (value) {
    var key = value && (value.id || value.artifactRef);
    if (!key || seen[key] || out.length >= MAX_ITEMS) return;
    seen[key] = true;
    out.push(value);
  });
  return out;
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
    /* Optional source-preserving semantic evidence. It is intentionally a
       bounded packet field, never a derived score or a diagnosis. */
    semanticEvidence: truth.semanticEvidence == null ? null : clone(arr(truth.semanticEvidence, 'truth.semanticEvidence')),
    semanticEvidenceMeta: truth.semanticEvidenceMeta && typeof truth.semanticEvidenceMeta === 'object'
      ? clone(truth.semanticEvidenceMeta) : null,
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
  var homology = input.homologyContext == null ? null : homologyContext.normalize(input.homologyContext);
  var audit = input.civAudit && typeof input.civAudit === 'object' ? clone(input.civAudit) : {};
  var packetId = domainId + ':' + cycleId + ':' + source.snapshotId;
  var packet = {
    schemaVersion: PACKET_SCHEMA,
    packetId: packetId,
    domainId: domainId,
    domainLabel: input.domainLabel == null ? domainId : requiredString(input.domainLabel, 'domainLabel'),
    cycleId: cycleId,
    generatedAt: generatedAt,
    sourceType: input.sourceType,
    sourceIdentity: source,
    truth: truth,
    homologyContext: homology,
    civAudit: audit,
    provenance: {
      sourceIdentity: source,
      generatedAt: generatedAt,
      producer: source.producer
    }
  };
  if (Buffer.byteLength(JSON.stringify(packet), 'utf8') > MAX_PACKET_BYTES) {
    fail('PACKET_TOO_LARGE', 'packet exceeds the bounded byte limit');
  }
  return packet;
}

function fromBrainState(domainId, state, snapshotMeta, refreshId, now, extras) {
  if (!state || typeof state !== 'object') fail('BRAIN_STATE_REQUIRED', 'brain state is required');
  if (!snapshotMeta || typeof snapshotMeta !== 'object') fail('SNAPSHOT_META_REQUIRED', 'snapshot metadata is required');
  var cycle = state.cognition && state.cognition.model && state.cognition.model.cycle;
  if (typeof cycle !== 'number' || !Number.isFinite(cycle)) fail('CYCLE_ID_REQUIRED', 'brain cognition cycle is required');
  var snapshotId = requiredString(snapshotMeta.snapshotId, 'snapshotMeta.snapshotId');
  var fetched = snapshotMeta.fetchedAt;
  if (typeof fetched !== 'number' || !Number.isFinite(fetched)) fail('SNAPSHOT_TIME_REQUIRED', 'snapshotMeta.fetchedAt is required');
  var ts = now === undefined ? new Date().toISOString() : timestamp(now, 'generatedAt');
  var diagnoses = Array.isArray(state.diagnoses) ? state.diagnoses.filter(function (d) { return d && d.active === true; }) : [];
  var feeds = Array.isArray(state.feeds) ? state.feeds : [];
  var source = {
    snapshotId: snapshotId,
    retrievedAt: new Date(fetched).toISOString(),
    refreshId: requiredString(refreshId, 'refreshId'),
    producer: 'brain-cognition-refresh/1'
  };
  var homology = homologyContext.buildFromBrainState(domainId, state, source, extras || {});
  return buildPacket({
    schemaVersion: PACKET_SCHEMA,
    sourceType: 'server-cognition-refresh',
    domainId: domainId,
    domainLabel: state.label || domainId,
    cycleId: String(cycle),
    generatedAt: ts,
    sourceIdentity: source,
    truth: {
      stressScore: finite(state.stress, 'state.stress'),
      confidence: finite(state.confidence, 'state.confidence'),
      activityLevel: state.activityLevel || null,
      phase: state.phase || null,
      phaseLabel: state.phaseLabel || null,
      activeDiagnoses: diagnoses.slice(0, MAX_ITEMS),
      treatments: (Array.isArray(state.treatments) ? state.treatments : []).slice(0, MAX_ITEMS),
      opportunities: packetOpportunities(state, extras),
      directives: (Array.isArray(state.directives) ? state.directives : []).slice(0, MAX_ITEMS),
      semanticEvidence: extras && Array.isArray(extras.semanticEvidence)
        ? extras.semanticEvidence.slice(0, MAX_ITEMS) : null,
      semanticEvidenceMeta: extras && extras.semanticEvidenceMeta ? clone(extras.semanticEvidenceMeta) : null,
      feedHealth: { configured: feeds.length, live: feeds.filter(function (f) { return f && f.live === true; }).length }
    },
    homologyContext: homology,
    civAudit: {
      role: 'observer',
      sourceType: 'domain-brain',
      brainUpdatedAt: state.updated || null,
      source: 'server-cognition-refresh'
    }
  });
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
    homologyContext: packet.homologyContext ? clone(packet.homologyContext) : null,
    caseRecord: caseRecord.build(packet, lane, opportunity),
    createdAt: packet.generatedAt
  };
}

module.exports = {
  MODULE_ID: MODULE_ID,
  PACKET_SCHEMA: PACKET_SCHEMA,
  HANDOFF_SCHEMA: HANDOFF_SCHEMA,
  HOMOLOGY_SCHEMA: homologyContext.SCHEMA,
  ACTIVE_LANES: ACTIVE_LANES.slice(),
  MAX_ITEMS: MAX_ITEMS,
  MAX_PACKET_BYTES: MAX_PACKET_BYTES,
  OPPORTUNITY_LANE_MAP: Object.assign({}, OPPORTUNITY_LANE_MAP),
  normalizeReleasedOpportunity: normalizeReleasedOpportunity,
  buildPacket: buildPacket,
  fromBrainState: fromBrainState,
  toHandoff: toHandoff
};
