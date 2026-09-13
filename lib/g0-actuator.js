'use strict';

/**
 * G0 shared actuator and accounting rail.
 * Verify domain-signed envelope → last-moment valve → paper or owned provider
 * → receipt → independent observer identity. Does not decide what to sell.
 * Does not ask a human to approve each action.
 */

var crypto = require('node:crypto');
var Envelope = require('./g0-action-envelope.js');
var Orientation = require('./g0-orientation.js');
var Lanes = require('./g0-lane-registry.js');
var AdapterGuard = require('./civilization-adapter-guard.js');

var SCHEMA = 'g0-actuator-receipt/1.0';
var PREFIX = 'g0_actuator_receipt:';
var LOG_KEY = 'g0_actuator_receipt_log';
var CLAIM = 'g0_actuator_claim:';

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }

function held(reason, extra) {
  return Object.assign({
    ok: true, status: 'HELD', dispatched: false, reason: reason,
    liveMoney: false, humanApprovalRequired: false
  }, extra || {});
}

async function execute(input) {
  input = input || {};
  var store = input.store;
  var now = Number.isFinite(Number(input.now)) ? Number(input.now) : Date.now();
  var verified = Envelope.verify(input.envelope, now);
  if (!verified.ok) return held(verified.reason);
  var envelope = verified.envelope;
  var spec = Lanes.get(envelope.domainId);
  if (!spec || spec.lane !== envelope.laneId) return held('g0-actuator-lane-mismatch');
  var gate = Orientation.mayAct(input.orientation, envelope.paperOnly ? 'paper' : 'live');
  if (!gate.ok) return held(gate.reason);
  if (input.orientation.comprehensionReceiptId !== envelope.comprehensionReceiptId ||
      input.orientation.orientationReceiptId !== envelope.orientationReceiptId) {
    return held('g0-actuator-orientation-envelope-mismatch');
  }
  if (input.orientation.domainId !== envelope.domainId) return held('g0-actuator-foreign-brain');
  try {
    store.assertDurable();
    var valve = await (input.adapterGuard || AdapterGuard).checkpoint(store, spec.valveId, envelope.action, now);
    var commandId = 'g0a_' + hash({ envelope: envelope.envelopeId, action: envelope.action }).slice(0, 24);
    var existing = await store.get(PREFIX + commandId);
    if (existing) {
      return Object.assign({ ok: existing.status === 'EXECUTED', dispatched: existing.status === 'EXECUTED', replayed: true }, existing);
    }
    if (!(await store.setIfAbsent(CLAIM + envelope.idempotencyKey, { commandId: commandId, claimedAt: now }))) {
      return held('g0-actuator-idempotency-replay-or-race', { idempotencyKey: envelope.idempotencyKey });
    }
    var command = {
      schemaVersion: SCHEMA,
      commandId: commandId,
      envelopeId: envelope.envelopeId,
      domainId: envelope.domainId,
      ownerDomain: spec.ownerDomain,
      laneId: envelope.laneId,
      action: envelope.action,
      payloadHash: envelope.payloadHash,
      decisionReceiptId: envelope.decisionReceiptId,
      authorizationReceiptId: envelope.authorizationReceiptId,
      comprehensionReceiptId: envelope.comprehensionReceiptId,
      orientationReceiptId: envelope.orientationReceiptId,
      rollbackReference: envelope.rollbackReference,
      outcomeObserverIdentity: envelope.outcomeObserverIdentity,
      status: 'DISPATCHING',
      paperOnly: envelope.paperOnly === true,
      liveMoney: false,
      providerCalled: false,
      adapterGuard: valve,
      commandedAt: now
    };
    if (!(await store.setIfAbsent(PREFIX + commandId, command))) {
      return held('g0-actuator-command-exists', { commandId: commandId });
    }
    var provider = input.provider;
    if (!provider || typeof provider.dispatch !== 'function') throw new Error('g0-actuator-provider-missing');
    var result;
    try {
      result = await provider.dispatch({
        envelope: envelope, spec: spec, command: command, paperOnly: true, liveMoney: false
      });
    } catch (error) {
      result = { ok: false, providerCalled: error && error.code === AdapterGuard.INHIBITED ? false : true,
        error: String(error && error.message || error), definitiveFailure: error && error.code === AdapterGuard.INHIBITED };
    }
    var resolved = Object.assign({}, command, {
      status: result && result.ok ? 'EXECUTED' : (result && result.definitiveFailure ? 'FAILED' : 'AMBIGUOUS'),
      providerCalled: !(result && result.providerCalled === false),
      providerReceiptId: result && result.providerReceiptId || null,
      paperArtifact: result && result.paperArtifact || null,
      completedAt: Date.now(),
      readbackVerified: true
    });
    await store.set(PREFIX + commandId, resolved);
    var restored = await store.get(PREFIX + commandId);
    if (!restored || restored.commandId !== commandId || restored.status !== resolved.status) {
      throw new Error('g0-actuator-receipt-readback-invalid');
    }
    await store.lpush(LOG_KEY, restored);
    await store.ltrim(LOG_KEY, 0, 499);
    return Object.assign({ ok: restored.status === 'EXECUTED', dispatched: restored.status === 'EXECUTED' }, restored);
  } catch (error) {
    return { ok: false, status: 'REFUSED', dispatched: false, liveMoney: false,
      reason: 'g0-actuator-unavailable', detail: String(error && error.message || error) };
  }
}

module.exports = { SCHEMA: SCHEMA, PREFIX: PREFIX, LOG_KEY: LOG_KEY, execute: execute };
