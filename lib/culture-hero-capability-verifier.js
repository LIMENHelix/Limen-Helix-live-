'use strict';

/**
 * Bounded Culture hero-asset capability commissioning.
 *
 * The normal hero motor remains fail-closed behind the product-domain
 * capability pair. This verifier may exercise only one fixed decorative
 * candidate, independently read its public bytes, suppress it from LIMEN's
 * public catalog, independently verify catalog absence, and then persist the
 * short-lived pair. A provider adapter is deliberately injected: the cron
 * route cannot invent one or fall back to the paid xAI route.
 */

var crypto = require('node:crypto');
var Cap = require('./product-domain-motor-capability.js');
var Motor = require('./product-domain-motor-receipt.js');
var Policy = require('./culture-hero-policy.js');
var Decision = require('./culture-hero-decision.js');
var Executor = require('./culture-hero-executor.js');
var Observer = require('./culture-hero-outcome-observer.js');
var Recovery = require('./culture-hero-recovery.js');
var AdapterGuard = require('./civilization-adapter-guard.js');

var SCHEMA = 'culture-hero-capability-commissioning/1.0';
var SLOT_KEY = 'culture_hero_capability_commissioning:v1';
var LOG_KEY = 'culture_hero_capability_commissioning_log';
var TTL_SECONDS = 6 * 60 * 60;
var MAX_EXPOSURE_MS = Cap.MAX_REVERSIBLE_COMMISSIONING_EXPOSURE_MS;
var TEXT_REASON = 'capability-commissioning';

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
function fixedCandidate(now) {
  var candidate = Policy.candidate('culture', 'commissioning-marker-v1', TEXT_REASON);
  return Object.assign({}, candidate, {
    commissioningOnly: true,
    commissioningAt: Number.isFinite(Number(now)) ? Number(now) : Date.now()
  });
}
function validMotor(motor) {
  return !!(motor && motor.schemaVersion === Motor.SCHEMA && motor.productDomain === 'culture' &&
    motor.ownerDomain === 'culture' && motor.contractId === 'culture-motor/1' && motor.lane === 'hero-image' &&
    motor.contracts && motor.contracts.receipt === 'asset-receipt' &&
    motor.contracts.independentOutcome === 'usage-engagement-or-conversion');
}
function publicState(state) {
  if (!state) return null;
  return {
    schemaVersion: state.schemaVersion, commissioningId: state.commissioningId,
    status: state.status, reason: state.reason || null, claimedAt: state.claimedAt || null,
    generatedAt: state.generatedAt || null, observedAt: state.observedAt || null,
    rollbackAttemptedAt: state.rollbackAttemptedAt || null, completedAt: state.completedAt || null,
    verifiedAt: state.verifiedAt || null, exposureDurationMs: state.exposureDurationMs == null ? null : state.exposureDurationMs,
    commandId: state.commandId || null, observationId: state.observationId || null,
    recoveryId: state.recoveryId || null, providerCalled: state.providerCalled === true, liveMoney: false
  };
}
async function append(store, state) {
  await store.lpush(LOG_KEY, publicState(state));
  await store.ltrim(LOG_KEY, 0, 199);
}
async function transition(store, current, next) {
  var changed = await store.replaceIfValue(SLOT_KEY, current, next);
  if (!changed) return { changed: false, state: await store.get(SLOT_KEY) };
  var restored = await store.get(SLOT_KEY);
  if (!restored || restored.commissioningId !== next.commissioningId || restored.status !== next.status) {
    throw new Error('culture hero commissioning transition readback invalid');
  }
  await append(store, restored);
  return { changed: true, state: restored };
}
function initialState(motor, now, attempt) {
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  var candidate = fixedCandidate(at);
  return {
    schemaVersion: SCHEMA,
    commissioningId: 'chcap_' + hash({ motorReceiptId: motor.receiptId, promptHash: candidate.promptHash, attempt: Math.max(1, Number(attempt) || 1) }).slice(0, 24),
    status: 'CLAIMED', productDomain: 'culture', ownerDomain: 'culture', lane: 'hero-image',
    motorReceiptId: motor.receiptId, candidate: candidate, claimedAt: at,
    providerCalled: false, externalEffectMayExist: false, liveMoney: false
  };
}
function commissioningAuth(state, motor, deps, phase) {
  if (deps && deps.motorAuthorization && typeof deps.motorAuthorization.authorize === 'function') {
    return deps.motorAuthorization;
  }
  return {
    authorize: async function () {
      return { authorized: true, receiptId: 'culture-hero-commissioning-' + phase + ':' + state.commissioningId,
        productDomain: motor.productDomain, ownerDomain: motor.ownerDomain, lane: motor.lane,
        commissioningOnly: true, liveMoney: false };
    }
  };
}
async function persistCapabilities(store, motor, state, now) {
  var common = {
    schemaVersion: Cap.SCHEMA, status: 'VERIFIED', environment: 'production', productDomain: 'culture',
    ownerDomain: 'culture', lane: 'hero-image', motorContractId: motor.contractId,
    verifiedAt: now, expiresAt: now + TTL_SECONDS * 1000
  };
  var executor = Object.assign({}, common, {
    capabilityId: 'chce_' + hash({ commissioningId: state.commissioningId, at: now }).slice(0, 24),
    kind: Cap.EXECUTOR, contractId: motor.contracts.receipt,
    adapterId: 'culture-hero-asset-provider/1', verifierId: 'culture-hero-commissioning-verifier/1',
    evidenceReceiptId: 'culture-hero-command:' + state.commandId,
    verificationEffectExecuted: true, commissioningOnly: true, liveMoney: false, verificationSpendUsd: 0,
    rollbackVerified: true, zeroResidualEffectVerified: true, rollbackReceiptId: state.recoveryId,
    residualObserverReceiptId: state.residualObserverReceiptId, exposureDurationMs: state.exposureDurationMs
  });
  var observer = Object.assign({}, common, {
    capabilityId: 'chco_' + hash({ commissioningId: state.commissioningId, observedAt: state.observedAt }).slice(0, 24),
    kind: Cap.OBSERVER, contractId: motor.contracts.independentOutcome,
    adapterId: 'culture-independent-public-asset-read/1', verifierId: 'culture-hero-independent-read-verifier/1',
    evidenceReceiptId: state.observationId, independentSourceVerified: true,
    independentOfAdapterId: executor.adapterId
  });
  var ex = Cap.validate(executor, Cap.EXECUTOR, motor, now);
  var ob = Cap.validate(observer, Cap.OBSERVER, motor, now);
  if (!ex.ok || !ob.ok) throw new Error('culture hero capability validation failed:' + (ex.reason || ob.reason));
  await store.set(Cap.capabilityKey('culture', Cap.EXECUTOR), executor, TTL_SECONDS);
  await store.set(Cap.capabilityKey('culture', Cap.OBSERVER), observer, TTL_SECONDS);
  var restored = await Cap.verifyPair(store, motor, now);
  if (!restored.ok) throw new Error('culture hero capability readback failed:' + restored.reason);
  return restored;
}
async function step(store, state, motor, deps, now) {
  deps = deps || {};
  if (state.status === 'CLAIMED') {
    if (!deps.provider || typeof deps.provider.generate !== 'function') {
      return (await transition(store, state, Object.assign({}, state, { status: 'HELD', reason: 'culture-hero-commissioning-provider-adapter-required' }))).state;
    }
    var guarded = await (deps.adapterGuard || AdapterGuard).checkpoint(
      store, 'culture:hero-image', 'bounded-reversible-culture-hero-commissioning', now);
    var decision = await Decision.decide(store, state.candidate, now, { cognition: deps.cognition });
    if (!decision || decision.status !== 'RELEASED') {
      return (await transition(store, state, Object.assign({}, state, { status: 'HELD', reason: decision && decision.blockers && decision.blockers.join(',') || 'culture-hero-commissioning-decision-held' }))).state;
    }
    var started = await transition(store, state, Object.assign({}, state, {
      status: 'DISPATCHING', adapterGuard: guarded, decisionReceiptId: decision.decisionReceiptId,
      dispatchStartedAt: now, providerCalled: false
    }));
    if (!started.changed) return started.state;
    var generated = await Executor.execute({
      store: store, candidate: state.candidate, decision: decision, now: now,
      motorAuthorization: commissioningAuth(state, motor, deps, 'executor'), provider: deps.provider,
      adapterGuard: deps.adapterGuard || AdapterGuard
    });
    if (!generated || generated.status !== 'GENERATED' || Number(generated.spentUsd || 0) !== 0) {
      return (await transition(store, started.state, Object.assign({}, started.state, {
        status: generated && generated.status === 'AMBIGUOUS' ? 'QUARANTINED' : 'FAILED',
        reason: generated && Number(generated.spentUsd || 0) !== 0 ? 'culture-hero-commissioning-spend-nonzero' : generated && generated.reason || 'culture-hero-commissioning-generation-failed',
        commandId: generated && generated.commandId || null, providerCalled: !!(generated && generated.providerCalled), completedAt: now
      }))).state;
    }
    return (await transition(store, started.state, Object.assign({}, started.state, {
      status: 'GENERATED', commandId: generated.commandId, generatedAt: now,
      providerCalled: true, externalEffectMayExist: true
    }))).state;
  }
  if (state.status === 'GENERATED') {
    var command = await store.get(Executor.commandKey(state.commandId));
    var observed = await Observer.observe(store, command, Object.assign({}, deps, { allowAnyHttpsForTest: deps.allowAnyHttpsForTest === true }));
    if (!observed || observed.status !== 'OBSERVED_PRESENT') return state;
    return (await transition(store, state, Object.assign({}, state, {
      status: 'OBSERVED', observedAt: now, observationId: observed.observationId
    }))).state;
  }
  if (state.status === 'OBSERVED') {
    var commandForRecovery = await store.get(Executor.commandKey(state.commandId));
    var observation = await store.get(Observer.key(state.commandId));
    var recovered = await Recovery.recover({
      store: store, command: commandForRecovery, observation: observation,
      trigger: { type: 'culture-capability-commissioning', id: state.commissioningId }, now: now,
      motorAuthorization: commissioningAuth(state, motor, deps, 'recovery'),
      observePublicCatalog: deps.observePublicCatalog
    });
    if (!recovered || recovered.status !== 'SUPPRESSED') return state;
    return (await transition(store, state, Object.assign({}, state, {
      status: 'EVIDENCE_COMPLETE', rollbackAttemptedAt: now, completedAt: now,
      recoveryId: recovered.recoveryId, residualObserverReceiptId: 'culture-public-catalog-absence:' + hash({ commissioningId: state.commissioningId, recoveryId: recovered.recoveryId }).slice(0, 24),
      exposureDurationMs: now - Number(state.generatedAt || state.claimedAt), rollbackVerified: true,
      zeroResidualEffectVerified: recovered.independentPublicAbsenceVerified === true
    }))).state;
  }
  if (state.status === 'EVIDENCE_COMPLETE') {
    if (state.zeroResidualEffectVerified !== true || Number(state.exposureDurationMs) > MAX_EXPOSURE_MS) {
      return (await transition(store, state, Object.assign({}, state, { status: 'FAILED', reason: 'culture-hero-commissioning-evidence-window-or-residual-check-failed', completedAt: now }))).state;
    }
    var pair = await persistCapabilities(store, motor, state, now);
    return (await transition(store, state, Object.assign({}, state, { status: 'VERIFIED', verifiedAt: now, capabilities: pair }))).state;
  }
  return state;
}
async function audit(store, now) {
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  store.assertDurable();
  var motor = await store.get(Motor.receiptKey('culture'));
  var pair = validMotor(motor) ? await Cap.verifyPair(store, motor, at) : { ok: false, reason: 'culture-motor-receipt-missing-or-invalid' };
  return { schemaVersion: SCHEMA, productDomain: 'culture', ownerDomain: 'culture', lane: 'hero-image', measuredAt: new Date(at).toISOString(), readOnly: true, liveMoney: false,
    motorReceipt: { present: !!motor, identityMatched: validMotor(motor), receiptId: motor && motor.receiptId || null, status: motor && motor.status || null },
    commissioning: publicState(await store.get(SLOT_KEY)), capabilities: pair };
}
async function commission(store, now, deps) {
  deps = deps || {};
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  store.assertDurable();
  if (String((deps.env || process.env).CULTURE_HERO_CAPABILITY_COMMISSIONING_ENABLED || '') !== '1') {
    return { ok: true, status: 'HELD', reason: 'culture-hero-capability-commissioning-disabled', liveMoney: false };
  }
  var motor = await store.get(Motor.receiptKey('culture'));
  if (!validMotor(motor)) return { ok: true, status: 'HELD', reason: 'culture-motor-receipt-missing-or-invalid', liveMoney: false };
  var existing = await Cap.verifyPair(store, motor, at);
  if (existing.ok) return { ok: true, status: 'VERIFIED', duplicate: true, capabilities: existing, liveMoney: false };
  var state = await store.get(SLOT_KEY);
  if (!state) { await store.setIfAbsent(SLOT_KEY, initialState(motor, at, 1)); state = await store.get(SLOT_KEY); }
  if (!state || state.schemaVersion !== SCHEMA || state.productDomain !== 'culture' || state.ownerDomain !== 'culture' || state.lane !== 'hero-image') {
    throw new Error('culture hero commissioning slot invalid');
  }
  var pause = deps.sleep || sleep;
  for (var i = 0; i < (deps.pollAttempts || 8); i++) {
    var before = state.status;
    state = await step(store, state, motor, deps, Number.isFinite(Number(deps.stepNow)) ? Number(deps.stepNow) + i : Date.now());
    if (state.status === 'VERIFIED' || state.status === 'FAILED' || state.status === 'QUARANTINED' || state.status === 'HELD') break;
    if (state.status === before) await pause(deps.pollDelayMs == null ? 1000 : deps.pollDelayMs);
  }
  return { ok: state.status === 'VERIFIED', status: state.status, reason: state.reason || null, commissioning: publicState(state), capabilities: state.capabilities || null, liveMoney: false };
}

module.exports = { SCHEMA: SCHEMA, SLOT_KEY: SLOT_KEY, LOG_KEY: LOG_KEY, TTL_SECONDS: TTL_SECONDS,
  MAX_EXPOSURE_MS: MAX_EXPOSURE_MS, TEXT_REASON: TEXT_REASON, hash: hash, fixedCandidate: fixedCandidate,
  validMotor: validMotor, publicState: publicState, initialState: initialState,
  persistCapabilities: persistCapabilities, audit: audit, step: step, commission: commission };
