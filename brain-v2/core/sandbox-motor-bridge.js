/**
 * brain-v2/core/sandbox-motor-bridge.js
 *
 * Sandbox-only B11/B14 bridge for the active research and investment lanes.
 * This module deliberately has no network client, broker client, cron hook, or
 * production store. The caller injects a tiny append/read store so tests can
 * force persistence failures and prove ordering.
 *
 * The bridge is a rehearsal boundary, not an activation path:
 *   versioned Civilization handoff
 *       -> persist command receipt
 *       -> simulated result (explicitly not a world observation)
 *       -> persist independent sandbox outcome
 *       -> supervised B14 update
 *
 * "Independent" here means independent of the originating domain observation
 * inside the sandbox. It is not a claim of real-world independence.
 */

'use strict';

var crypto = require('crypto');
var PRED = require('../kernel/predict.js');

var MODULE_ID = 'brain-v2/core/sandbox-motor-bridge';
var SCHEMA_VERSION = 'sandbox-motor-bridge/1.0';
var HANDOFF_SCHEMA = 'civilization-handoff/1.0';
var ACTIVE_LANES = ['investments', 'research-papers'];

function clone(v) { return JSON.parse(JSON.stringify(v)); }

function stableId(prefix, value) {
  return prefix + '_' + crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 24);
}

function fail(message) { throw new Error(MODULE_ID + ': ' + message); }

function validateStore(store) {
  if (!store || typeof store.append !== 'function' || typeof store.read !== 'function') {
    fail('a sandbox store with append(record) and read() is required');
  }
}

function validateHandoff(handoff) {
  if (!handoff || handoff.schemaVersion !== HANDOFF_SCHEMA) fail('handoff schema must be ' + HANDOFF_SCHEMA);
  if (ACTIVE_LANES.indexOf(handoff.lane) < 0) {
    fail('lane "' + handoff.lane + '" is not an active research/investment sandbox lane');
  }
  if (typeof handoff.opportunityId !== 'string' || !handoff.opportunityId) fail('handoff opportunityId is required');
  if (!Array.isArray(handoff.sourceDomains) || !handoff.sourceDomains.length) fail('handoff sourceDomains is required');
  if (!handoff.motorClaim || typeof handoff.motorClaim.variable !== 'string' || !handoff.motorClaim.variable) {
    fail('handoff motorClaim.variable is required');
  }
  var magnitude = handoff.motorClaim.magnitude;
  if (typeof magnitude !== 'number' || !isFinite(magnitude)) fail('handoff motorClaim.magnitude must be finite');
  return true;
}

function create(opts) {
  opts = opts || {};
  validateStore(opts.store);
  var bridge = {
    schemaVersion: SCHEMA_VERSION,
    store: opts.store,
    forwardModel: opts.forwardModel || PRED.createForwardModel({ trustN: opts.trustN || 8 }),
    commands: Object.create(null),
    outcomes: Object.create(null),
    sequence: 0
  };
  return bridge;
}

function append(bridge, record) {
  var out = clone(record);
  out.bridgeSchemaVersion = SCHEMA_VERSION;
  out.module = MODULE_ID;
  bridge.store.append(out);
  return out;
}

/**
 * Accept a handoff only after the command receipt is persisted. No result is
 * generated here; callers must invoke complete() with an explicit sandbox result.
 */
function submit(bridge, handoff, now) {
  validateHandoff(handoff);
  var commandId = stableId('cmd', { opportunityId: handoff.opportunityId, lane: handoff.lane, sequence: bridge.sequence++ });
  var efference = PRED.efferenceCopy(bridge.forwardModel, {
    traceId: handoff.opportunityId,
    actionId: commandId,
    actionKind: handoff.lane,
    variable: handoff.motorClaim.variable,
    magnitude: handoff.motorClaim.magnitude,
    emittedAt: now
  });
  var command = {
    commandId: commandId,
    lane: handoff.lane,
    opportunityId: handoff.opportunityId,
    sourceDomains: handoff.sourceDomains.slice(),
    variable: handoff.motorClaim.variable,
    efferenceCopy: efference,
    issuedAt: now,
    status: 'RECEIPT_PERSISTED',
    resultProduced: false
  };
  // This append is the ordering boundary. If it throws, no command is returned
  // and a caller cannot legitimately produce a simulated result.
  append(bridge, { type: 'sandbox_command_receipt', command: command });
  bridge.commands[commandId] = command;
  return clone(command);
}

/**
 * Complete a persisted command with a sandbox-only outcome. The outcome must
 * carry its own identity and explicitly identify the originating-domain
 * observation as excluded from the outcome source.
 */
function complete(bridge, commandId, result, now) {
  var command = bridge.commands[commandId];
  if (!command) fail('cannot complete unknown or unpersisted command ' + commandId);
  if (command.status !== 'RECEIPT_PERSISTED') fail('command ' + commandId + ' is already terminal');
  if (!result || typeof result.outcomeId !== 'string' || !result.outcomeId) fail('sandbox outcomeId is required');
  if (result.sourceType !== 'sandbox-counterfactual') fail('outcome sourceType must be sandbox-counterfactual');
  if (result.independentOf !== 'originating-domain-observation') {
    fail('outcome must state independentOf=originating-domain-observation');
  }
  if (typeof result.observedDelta !== 'number' || !isFinite(result.observedDelta)) fail('observedDelta must be finite');
  if (typeof result.observedAt !== 'number' || !isFinite(result.observedAt)) fail('observedAt must be finite');

  var outcome = {
    outcomeId: result.outcomeId,
    commandId: commandId,
    sourceType: result.sourceType,
    independentOf: result.independentOf,
    observedDelta: result.observedDelta,
    observedAt: result.observedAt,
    receivedAt: now
  };
  var attribution = PRED.explainedByAction(bridge.forwardModel, command.efferenceCopy);
  outcome.reafference = {
    predictedDelta: attribution.value,
    trusted: attribution.trusted,
    residualDelta: result.observedDelta - attribution.value,
    why: attribution.why
  };
  // Persist the outcome before changing the in-memory model. A failed append
  // leaves the command retryable and cannot silently train B14.
  append(bridge, { type: 'sandbox_outcome', outcome: outcome });
  var learned = PRED.learn(bridge.forwardModel, command.efferenceCopy, result.observedDelta, now);
  var latency = PRED.learnLatency(bridge.forwardModel, command.efferenceCopy, Math.max(0, now - command.issuedAt));
  append(bridge, { type: 'sandbox_forward_model_update', commandId: commandId, learned: learned, latency: latency });
  command.status = 'OUTCOME_PERSISTED';
  command.resultProduced = true;
  bridge.outcomes[commandId] = outcome;
  return { command: clone(command), outcome: clone(outcome), learned: clone(learned), latency: clone(latency) };
}

function report(bridge) {
  return {
    schemaVersion: SCHEMA_VERSION,
    commands: Object.keys(bridge.commands).length,
    outcomes: Object.keys(bridge.outcomes).length,
    pending: Object.keys(bridge.commands).filter(function (id) { return bridge.commands[id].status !== 'OUTCOME_PERSISTED'; }).length,
    forwardModel: PRED.forwardModelReport(bridge.forwardModel),
    boundary: 'sandbox only; no broker, network, spend, cron, or production state'
  };
}

function serialize(bridge) {
  return {
    schemaVersion: SCHEMA_VERSION,
    sequence: bridge.sequence,
    commands: bridge.commands,
    outcomes: bridge.outcomes,
    forwardModel: PRED.serialize(bridge.forwardModel)
  };
}

function restore(snapshot, opts) {
  if (!snapshot || snapshot.schemaVersion !== SCHEMA_VERSION) fail('snapshot schema must be ' + SCHEMA_VERSION);
  var bridge = create({ store: opts && opts.store, forwardModel: PRED.deserialize(snapshot.forwardModel) });
  bridge.sequence = snapshot.sequence || 0;
  bridge.commands = snapshot.commands || Object.create(null);
  bridge.outcomes = snapshot.outcomes || Object.create(null);
  return bridge;
}

module.exports = {
  MODULE_ID: MODULE_ID,
  SCHEMA_VERSION: SCHEMA_VERSION,
  HANDOFF_SCHEMA: HANDOFF_SCHEMA,
  ACTIVE_LANES: ACTIVE_LANES.slice(),
  create: create,
  submit: submit,
  complete: complete,
  report: report,
  serialize: serialize,
  restore: restore
};
