/**
 * brain-v2/kernel/packet.js — THE CANONICAL SIGNAL CONTRACT
 *
 * MASTER_PROMPT §9. Fidelity: F0 (functional). This is a typed message envelope. It is not
 * a claim about axonal transmission and nothing here should be read as one.
 *
 * THE ONE RULE THIS FILE EXISTS TO ENFORCE, above all the field validation:
 *
 *     A packet that was PREDICTED, SIMULATED, or REPLAYED can never become an OBSERVATION.
 *
 * That is SPEC row 28's neighbour and MASTER_PROMPT §8.23's hard requirement, and it is the
 * failure mode this project has actually committed: a generated number stored beside measured
 * ones, indistinguishable a week later. The status is set at construction, it is covered by
 * the provenance hash, and `admitAsEvidence()` is the only door into anything that counts as
 * fact. There is no flag to flip it afterwards.
 *
 * DETERMINISM. No Date.now(), no Math.random(), no counters that survive across processes.
 * Every id is a hash of content the caller supplies, so replaying the same log produces
 * byte-identical packets. That is what makes TEST 14 (deterministic replay) possible rather
 * than merely asserted.
 */

'use strict';

var crypto = require('crypto');

var SCHEMA_VERSION = '1.0.0';

/**
 * SIGNAL KINDS — MASTER_PROMPT §9. These are closed. An unrecognised kind is a validation
 * failure, not a pass-through, because "some other kind of signal" is how untyped edges get
 * back in (SPEC Part 3: an untyped edge is undefined behavior).
 */
var KIND = {
  OBSERVATION:      'observation',
  INFERRED_STATE:   'inferred_state',
  PREDICTION:       'prediction',
  PREDICTION_ERROR: 'prediction_error',
  DIAGNOSIS:        'diagnosis',
  ACTION_CANDIDATE: 'action_candidate',
  INHIBITION:       'inhibition',
  MODULATION:       'modulation',
  SELECTED_ACTION:  'selected_action',
  EFFERENCE_COPY:   'efference_copy',
  OUTCOME:          'outcome',
  MEMORY_CUE:       'memory_cue',
  GOAL:             'goal',
  CONTRADICTION:    'contradiction',
  AUDIT_EVENT:      'audit_event'
};
var KINDS = Object.keys(KIND).map(function (k) { return KIND[k]; });

/**
 * EPISTEMIC STATUS — the field that separates a measurement from a story about one.
 * MASTER_PROMPT §4.27 requires the distinction; §8.23 requires it be structural.
 */
var STATUS = {
  OBSERVED:  'observed',    // a sensor reported this. The only status that is evidence.
  INFERRED:  'inferred',    // computed from observations. Traceable, but not itself measured.
  PREDICTED: 'predicted',   // a claim about the future. Falsifiable, currently unresolved.
  SIMULATED: 'simulated',   // counterfactual / sandbox. Never evidence, at any confidence.
  REPLAYED:  'replayed'     // reconstructed from the log. Identical content, different warrant.
};
var STATUSES = Object.keys(STATUS).map(function (k) { return STATUS[k]; });

/** ROLE — SPEC Part 3 / INV-8. Every edge is typed. A modulator may never fire a target alone. */
var ROLE = { DRIVER: 'driver', MODULATOR: 'modulator' };

/** DIRECTION — SPEC Part 3. Ascending carries residual only (INV-9). */
var DIRECTION = { ASCENDING: 'ascending', DESCENDING: 'descending', LATERAL: 'lateral' };

/** Stable stringify: sorted keys, so a hash of the same content is the same hash. */
function canonical(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  var keys = Object.keys(v).sort();
  return '{' + keys.map(function (k) { return JSON.stringify(k) + ':' + canonical(v[k]); }).join(',') + '}';
}

function sha256(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }

/**
 * PROVENANCE HASH — covers source identity, payload, event time AND epistemic status.
 *
 * Including `simulationStatus` in the hash is the point. If anything downstream rewrites a
 * simulated packet's status to 'observed' to get it past the barrier, the hash no longer
 * matches and `verify()` fails. The status is not advisory metadata; it is part of the
 * identity of the record.
 */
function provenanceHash(p) {
  return sha256(canonical({
    sourceDomain: p.sourceDomain,
    sourceModule: p.sourceModule,
    sourceVersion: p.sourceVersion,
    signalKind: p.signalKind,
    simulationStatus: p.simulationStatus,
    payload: p.payload,
    eventTime: p.eventTime
  }));
}

/** Deterministic id. Same trace + kind + seq + content = same id, across processes and runs. */
function packetId(traceId, kind, seq, provHash) {
  return 'pk_' + sha256(traceId + '|' + kind + '|' + seq + '|' + provHash).slice(0, 20);
}

function newTraceId(seedParts) {
  return 'tr_' + sha256(canonical(seedParts)).slice(0, 20);
}

var REQUIRED = [
  'traceId', 'sourceDomain', 'sourceModule', 'signalKind',
  'eventTime', 'observationTime', 'processingTime', 'simulationStatus'
];

/**
 * Construct a packet. Throws on anything the contract cannot express — a missing field, an
 * unknown kind, a bad status, an inverted clock. Throwing rather than defaulting is deliberate:
 * a silently defaulted confidence is exactly the "confidence field ≠ calibrated confidence"
 * row of the No-Shortcut Contract.
 */
function create(spec) {
  var p = {
    id: null,
    schemaVersion: SCHEMA_VERSION,
    traceId: spec.traceId,
    seq: (typeof spec.seq === 'number') ? spec.seq : 0,
    causalParentIds: (spec.causalParentIds || []).slice(),

    sourceDomain: spec.sourceDomain,
    sourceModule: spec.sourceModule,
    sourceVersion: spec.sourceVersion || 'brain-v2/kernel/1.0.0',
    intendedTargets: (spec.intendedTargets || []).slice(),

    signalKind: spec.signalKind,
    role: spec.role || ROLE.DRIVER,
    direction: spec.direction || DIRECTION.ASCENDING,
    modality: spec.modality || null,
    payload: (spec.payload === undefined) ? null : spec.payload,

    // Three clocks, kept apart (MASTER_PROMPT §10). Collapsing them is how a stale reading
    // gets treated as fresh: "when it happened" and "when we heard" are different facts.
    eventTime: spec.eventTime,
    observationTime: spec.observationTime,
    processingTime: spec.processingTime,
    validFrom: (spec.validFrom === undefined) ? spec.eventTime : spec.validFrom,
    expiresAt: (spec.expiresAt === undefined) ? null : spec.expiresAt,

    // Confidence and salience are SEPARATE axes and must stay that way (§8.3).
    // A loud signal is not a trustworthy one.
    confidence: numOrNull(spec.confidence),
    uncertainty: numOrNull(spec.uncertainty),
    sourceReliability: numOrNull(spec.sourceReliability),
    salience: numOrNull(spec.salience),
    novelty: numOrNull(spec.novelty),
    urgency: numOrNull(spec.urgency),
    predictedImpact: (spec.predictedImpact === undefined) ? null : spec.predictedImpact,

    evidenceReferences: (spec.evidenceReferences || []).slice(),
    permissionsRequired: (spec.permissionsRequired || []).slice(),

    simulationStatus: spec.simulationStatus,

    hopCount: (typeof spec.hopCount === 'number') ? spec.hopCount : 0,
    hopLimit: (typeof spec.hopLimit === 'number') ? spec.hopLimit : 4,
    processingBudget: (typeof spec.processingBudget === 'number') ? spec.processingBudget : 32,

    provenanceHash: null
  };

  var bad = validateShape(p);
  if (bad) throw new Error('packet contract violation: ' + bad);

  p.provenanceHash = provenanceHash(p);
  p.id = spec.id || packetId(p.traceId, p.signalKind, p.seq, p.provenanceHash);
  return Object.freeze(p);
}

function numOrNull(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }

function validateShape(p) {
  for (var i = 0; i < REQUIRED.length; i++) {
    var f = REQUIRED[i];
    if (p[f] === undefined || p[f] === null || p[f] === '') return 'missing required field: ' + f;
  }
  if (KINDS.indexOf(p.signalKind) < 0) return 'unknown signalKind: ' + p.signalKind;
  if (STATUSES.indexOf(p.simulationStatus) < 0) return 'unknown simulationStatus: ' + p.simulationStatus;
  if (p.role !== ROLE.DRIVER && p.role !== ROLE.MODULATOR) return 'unknown role: ' + p.role;
  if ([DIRECTION.ASCENDING, DIRECTION.DESCENDING, DIRECTION.LATERAL].indexOf(p.direction) < 0) {
    return 'unknown direction: ' + p.direction;
  }
  if (typeof p.eventTime !== 'number' || typeof p.observationTime !== 'number' || typeof p.processingTime !== 'number') {
    return 'the three clocks must all be numeric ms';
  }
  if (p.observationTime < p.eventTime) return 'observationTime precedes eventTime — a reading cannot arrive before it happened';
  if (p.processingTime < p.observationTime) return 'processingTime precedes observationTime';
  if (p.hopCount > p.hopLimit) return 'hopCount ' + p.hopCount + ' exceeds hopLimit ' + p.hopLimit;
  if (p.confidence !== null && (p.confidence < 0 || p.confidence > 1)) return 'confidence out of [0,1]';
  // INV-8: a modulator that can fire a target by itself is a driver with a false label.
  if (p.role === ROLE.MODULATOR && p.signalKind === KIND.SELECTED_ACTION) {
    return 'INV-8: a selected_action is a driver by definition; it cannot be typed modulator';
  }
  // INV-9: only residual ascends. A full-state packet climbing the hierarchy is the
  // report-forward pathology (SPEC row 7) and it is rejected at construction.
  if (p.direction === DIRECTION.ASCENDING &&
      p.signalKind === KIND.INFERRED_STATE &&
      p.payload && p.payload.fullState === true) {
    return 'INV-9: full state may not ascend; send the residual';
  }
  return null;
}

/** Recompute and compare. Any post-hoc edit of source, payload, time or status fails here. */
function verify(p) {
  if (!p || !p.provenanceHash) return { ok: false, why: 'no provenance hash' };
  var h = provenanceHash(p);
  if (h !== p.provenanceHash) {
    return { ok: false, why: 'provenance hash mismatch — packet content or epistemic status was altered after construction' };
  }
  var bad = validateShape(p);
  if (bad) return { ok: false, why: bad };
  return { ok: true };
}

/**
 * THE EVIDENCE DOOR. MASTER_PROMPT §8.23 / SPEC row 28.
 *
 * Only an OBSERVED packet is evidence. Everything else — however confident, however useful —
 * is inference, forecast, sandbox, or reconstruction. `replayed` is refused too, and that is
 * not pedantry: a replayed observation is a real reading with a *different warrant*, because
 * the replay could be driven by a corrupted log. It may inform state; it may not re-enter the
 * record as though the sensor spoke again.
 */
function admitAsEvidence(p) {
  var v = verify(p);
  if (!v.ok) return { admitted: false, why: v.why };
  if (p.simulationStatus !== STATUS.OBSERVED) {
    return {
      admitted: false,
      why: 'simulationStatus=' + p.simulationStatus + ' — only "observed" is evidence. ' +
           'This is structural, not a threshold: there is no confidence at which a ' +
           p.simulationStatus + ' packet becomes a measurement.'
    };
  }
  return { admitted: true };
}

/** Advance a packet one hop. Returns null past the limit — the caller must handle the drop. */
function hop(p, target, now) {
  if (p.hopCount + 1 > p.hopLimit) return null;
  return create({
    traceId: p.traceId,
    seq: p.seq + 1,
    causalParentIds: [p.id],
    sourceDomain: p.sourceDomain,
    sourceModule: p.sourceModule,
    sourceVersion: p.sourceVersion,
    intendedTargets: [target],
    signalKind: p.signalKind,
    role: p.role,
    direction: p.direction,
    modality: p.modality,
    payload: p.payload,
    eventTime: p.eventTime,
    observationTime: p.observationTime,
    processingTime: now,
    validFrom: p.validFrom,
    expiresAt: p.expiresAt,
    confidence: p.confidence,
    uncertainty: p.uncertainty,
    sourceReliability: p.sourceReliability,
    salience: p.salience,
    novelty: p.novelty,
    urgency: p.urgency,
    evidenceReferences: p.evidenceReferences,
    permissionsRequired: p.permissionsRequired,
    simulationStatus: p.simulationStatus,
    hopCount: p.hopCount + 1,
    hopLimit: p.hopLimit,
    processingBudget: p.processingBudget - 1
  });
}

/**
 * ACTION PACKET — MASTER_PROMPT §9.
 *
 * `executionStatus` starts at 'selected' and there is NO setter here that writes 'executed'.
 * Only kernel/actuate.js does that, on receipt of effect. SPEC row 2: execution state is set
 * by the actuator, never by the approver. An approval that writes its own execution flag is a
 * system that believes its intentions are actions.
 */
function createAction(spec) {
  if (!spec.originatingTraceId) throw new Error('action needs originatingTraceId');
  if (!spec.proposedBy) throw new Error('action needs proposedBy');
  if (!spec.selectedBy) throw new Error('action needs selectedBy');
  if (spec.proposedBy === spec.selectedBy) {
    // SPEC row 19 — actor/critic separation. The thing that proposes may not be the thing
    // that selects, or scoring is self-confirming by construction.
    throw new Error('SPEC row 19: proposedBy and selectedBy must differ (actor/critic separation)');
  }
  var a = {
    actionId: null,
    schemaVersion: SCHEMA_VERSION,
    originatingTraceId: spec.originatingTraceId,
    proposedBy: spec.proposedBy,
    selectedBy: spec.selectedBy,
    kind: spec.kind,
    affectedDomains: (spec.affectedDomains || []).slice(),
    parameters: spec.parameters || {},
    expectedBenefits: (spec.expectedBenefits || []).slice(),
    expectedHarms: (spec.expectedHarms || []).slice(),
    uncertainty: numOrNull(spec.uncertainty),
    alternativesConsidered: (spec.alternativesConsidered || []).slice(),
    reasonForSelection: spec.reasonForSelection || null,
    reasonForRejectionOfAlternatives: (spec.reasonForRejectionOfAlternatives || []).slice(),
    authority: spec.authority,
    reversibility: spec.reversibility,
    rollbackPlan: spec.rollbackPlan || null,
    executionStatus: 'selected',      // selected | executed | failed | rolled_back
    executionTime: null,
    executedBy: null,
    selectedAt: spec.selectedAt,
    expectedEvaluationTime: spec.expectedEvaluationTime
  };
  if (!a.authority) throw new Error('action needs a declared authority (§13 capability)');
  if (!a.rollbackPlan) throw new Error('action needs a rollback plan (§13: reversible where possible)');
  if (typeof a.expectedEvaluationTime !== 'number') throw new Error('action needs expectedEvaluationTime — an action with no scheduled check does not close the loop (§8.12)');
  a.actionId = 'ac_' + sha256(canonical({
    t: a.originatingTraceId, k: a.kind, p: a.parameters, at: a.selectedAt
  })).slice(0, 20);
  return a;
}

/** OUTCOME PACKET — MASTER_PROMPT §9. Built by outcome resolution, never by the actor. */
function createOutcome(spec) {
  return {
    schemaVersion: SCHEMA_VERSION,
    actionId: spec.actionId,
    traceId: spec.traceId,
    predictedOutcome: spec.predictedOutcome,
    observedOutcome: spec.observedOutcome,
    observationWindow: spec.observationWindow,
    rawError: numOrNull(spec.rawError),
    efferenceExplained: numOrNull(spec.efferenceExplained),
    predictionError: numOrNull(spec.predictionError),
    sideEffects: (spec.sideEffects || []).slice(),
    confounders: (spec.confounders || []).slice(),
    causalAttributionConfidence: numOrNull(spec.causalAttributionConfidence),
    evidenceReferences: (spec.evidenceReferences || []).slice(),
    treatmentUpdateRecommendation: spec.treatmentUpdateRecommendation || null,
    memoryWritesProposed: (spec.memoryWritesProposed || []).slice(),
    resolvedAt: spec.resolvedAt
  };
}

module.exports = {
  SCHEMA_VERSION: SCHEMA_VERSION,
  KIND: KIND, KINDS: KINDS,
  STATUS: STATUS, STATUSES: STATUSES,
  ROLE: ROLE, DIRECTION: DIRECTION,
  create: create,
  createAction: createAction,
  createOutcome: createOutcome,
  verify: verify,
  admitAsEvidence: admitAsEvidence,
  hop: hop,
  newTraceId: newTraceId,
  packetId: packetId,
  provenanceHash: provenanceHash,
  canonical: canonical,
  sha256: sha256
};
