'use strict';

/**
 * Bounded Industry CRM capability commissioning.
 *
 * This verifier uses the existing Industry-owned HubSpot company path with a
 * fixed, non-customer commissioning marker. It independently reads the
 * created record, archives it through the existing recovery boundary, and
 * independently reads the archived record before the capability pair is
 * persisted. It never consumes an Industry work item or selects a customer.
 * The production route is disabled unless explicitly enabled.
 */

var crypto = require('node:crypto');
var Cap = require('./product-domain-motor-capability.js');
var Motor = require('./product-domain-motor-receipt.js');
var Decision = require('./industry-crm-decision.js');
var Provider = require('./industry-crm-provider.js');
var AdapterGuard = require('./civilization-adapter-guard.js');

var SCHEMA = 'industry-crm-capability-commissioning/1.0';
var SLOT_KEY = 'industry_crm_capability_commissioning:v1';
var LOG_KEY = 'industry_crm_capability_commissioning_log';
var TTL_SECONDS = 6 * 60 * 60;
var TEXT = 'LIMEN Industry CRM motor commissioning — temporary owned marker. No customer, outreach, or sales action.';

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

function candidate(now) {
  var at = Number(now) || Date.now();
  return Decision.candidate({
    key: 'industry-capability-commissioning', company: TEXT, state: 'NA', city: 'NA', address: 'NA',
    industry: 'commissioning', affected: 0, effectiveDate: new Date(at).toISOString(), priority: 0,
    source: 'WARN', workFirst: true
  }, { identity: 'industry-capability-commissioning-source' });
}

function validMotor(motor) {
  return !!(motor && motor.schemaVersion === Motor.SCHEMA && motor.productDomain === 'industry' &&
    motor.ownerDomain === 'industry' && motor.contractId === 'industry-motor/1' && motor.lane === 'crm' &&
    motor.contracts && motor.contracts.decision === 'relationship-operation-decision/1' &&
    motor.contracts.budget === 'industry-crm-budget/1' && motor.contracts.receipt === 'crm-receipt' &&
    motor.contracts.independentOutcome === 'stage-transition-or-revenue' &&
    motor.contracts.rollback === 'revert-close-or-suppress');
}

function publicState(state) {
  if (!state) return null;
  return {
    schemaVersion: state.schemaVersion, commissioningId: state.commissioningId, status: state.status,
    reason: state.reason || null, claimedAt: state.claimedAt || null, createdAt: state.createdAt || null,
    observedAt: state.observedAt || null, rollbackAttemptedAt: state.rollbackAttemptedAt || null,
    archivedAt: state.archivedAt || null, completedAt: state.completedAt || null,
    verifiedAt: state.verifiedAt || null, exposureDurationMs: state.exposureDurationMs == null ? null : state.exposureDurationMs,
    hubspotCompanyId: state.hubspotCompanyId || null, providerCalled: false, liveMoney: false
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
    throw new Error('industry CRM commissioning transition readback invalid');
  }
  await append(store, restored);
  return { changed: true, state: restored };
}

function initialState(motor, now) {
  var c = candidate(now);
  return {
    schemaVersion: SCHEMA,
    commissioningId: 'iccap_' + hash({ receipt: motor.receiptId, text: TEXT }).slice(0, 24),
    status: 'CLAIMED', productDomain: 'industry', ownerDomain: 'industry', lane: 'crm',
    motorReceiptId: motor.receiptId, candidate: c, claimedAt: now,
    providerCalled: false, externalEffectMayExist: false, liveMoney: false
  };
}

async function persistCapabilities(store, motor, state, now) {
  var common = {
    schemaVersion: Cap.SCHEMA, status: 'VERIFIED', environment: 'production',
    productDomain: 'industry', ownerDomain: 'industry', lane: 'crm', motorContractId: motor.contractId,
    verifiedAt: now, expiresAt: now + TTL_SECONDS * 1000
  };
  var executor = Object.assign({}, common, {
    capabilityId: 'icce_' + hash({ commissioningId: state.commissioningId, at: now }).slice(0, 24),
    kind: Cap.EXECUTOR, contractId: motor.contracts.receipt,
    adapterId: 'hubspot-company-create/1', verifierId: 'industry-crm-commissioning-verifier/1',
    evidenceReceiptId: 'industry-crm-create:' + state.hubspotCompanyId,
    verificationEffectExecuted: true, commissioningOnly: true, liveMoney: false, verificationSpendUsd: 0,
    rollbackVerified: true, zeroResidualEffectVerified: true, rollbackReceiptId: state.rollbackReceiptId,
    residualObserverReceiptId: state.residualObserverReceiptId, exposureDurationMs: state.exposureDurationMs
  });
  var observer = Object.assign({}, common, {
    capabilityId: 'icco_' + hash({ commissioningId: state.commissioningId, observedAt: state.observedAt, archivedAt: state.archivedAt }).slice(0, 24),
    kind: Cap.OBSERVER, contractId: motor.contracts.independentOutcome,
    adapterId: 'hubspot-company-independent-read/1', verifierId: 'industry-crm-independent-read-verifier/1',
    evidenceReceiptId: state.presenceObserverReceiptId, independentSourceVerified: true,
    independentOfAdapterId: executor.adapterId
  });
  var ex = Cap.validate(executor, Cap.EXECUTOR, motor, now), ob = Cap.validate(observer, Cap.OBSERVER, motor, now);
  if (!ex.ok || !ob.ok) throw new Error('industry CRM capability validation failed:' + (ex.reason || ob.reason));
  await store.set(Cap.capabilityKey('industry', Cap.EXECUTOR), executor, TTL_SECONDS);
  await store.set(Cap.capabilityKey('industry', Cap.OBSERVER), observer, TTL_SECONDS);
  var pair = await Cap.verifyPair(store, motor, now);
  if (!pair.ok) throw new Error('industry CRM capability readback failed:' + pair.reason);
  return pair;
}

function independentPresence(result, id) {
  return !!(result && result.ok && result.record && String(result.record.id) === String(id) &&
    result.record.archived !== true && result.record.properties &&
    result.record.properties.name === TEXT);
}

function independentAbsence(result, id) {
  return !!(result && result.ok && result.record && String(result.record.id) === String(id) && result.record.archived === true);
}

async function step(store, state, motor, deps, now) {
  var provider = deps.provider || {
    create: function (c) { return Provider.create(c, deps.providerDeps); },
    get: function (id, archived) { return Provider.get(id, deps.providerDeps, archived); },
    archive: function (id) { return Provider.archive(id, deps.providerDeps); }
  };
  if (state.status === 'CLAIMED') {
    var guard = await (deps.adapterGuard || AdapterGuard).checkpoint(store, 'industry:crm', 'bounded-industry-crm-commissioning', now);
    var started = await transition(store, state, Object.assign({}, state, { status: 'DISPATCHING', adapterGuard: guard, dispatchStartedAt: now }));
    if (!started.changed) return started.state;
    var created = await provider.create(state.candidate);
    if (!created || !created.ok || !created.id) return (await transition(store, started.state, Object.assign({}, started.state, {
      status: 'FAILED', reason: created && created.error || 'industry-crm-commissioning-create-failed', completedAt: now
    }))).state;
    return (await transition(store, started.state, Object.assign({}, started.state, {
      status: 'CREATED', hubspotCompanyId: created.id, createdAt: now
    }))).state;
  }
  if (state.status === 'CREATED') {
    var present = await provider.get(state.hubspotCompanyId, false);
    if (!independentPresence(present, state.hubspotCompanyId)) return state;
    return (await transition(store, state, Object.assign({}, state, {
      status: 'OBSERVED', observedAt: now,
      presenceObserverReceiptId: 'industry-crm-presence:' + hash({ id: state.hubspotCompanyId, at: now }).slice(0, 24)
    }))).state;
  }
  if (state.status === 'OBSERVED') {
    var rollbackReceiptId = 'industry-crm-archive:' + hash({ id: state.hubspotCompanyId, at: now }).slice(0, 24);
    var closing = await transition(store, state, Object.assign({}, state, {
      status: 'ROLLBACK_DISPATCHING', rollbackAttemptedAt: now, rollbackReceiptId: rollbackReceiptId
    }));
    if (!closing.changed) return closing.state;
    var rollbackGuard = await (deps.adapterGuard || AdapterGuard).checkpoint(
      store, 'industry:crm', 'bounded-industry-crm-commissioning-archive', now);
    var guarded = await transition(store, closing.state, Object.assign({}, closing.state, { rollbackAdapterGuard: rollbackGuard }));
    if (!guarded.changed) return guarded.state;
    closing.state = guarded.state;
    var archived = await provider.archive(state.hubspotCompanyId);
    if (!archived || !archived.ok) return (await transition(store, closing.state, Object.assign({}, closing.state, {
      status: 'FAILED', reason: archived && archived.error || 'industry-crm-commissioning-archive-failed', completedAt: now
    }))).state;
    return (await transition(store, closing.state, Object.assign({}, closing.state, { status: 'ARCHIVE_DISPATCHED', archivedAt: now }))).state;
  }
  if (state.status === 'ARCHIVE_DISPATCHED') {
    var absent = await provider.get(state.hubspotCompanyId, true);
    if (!independentAbsence(absent, state.hubspotCompanyId)) return state;
    return (await transition(store, state, Object.assign({}, state, {
      status: 'EVIDENCE_COMPLETE', completedAt: now,
      exposureDurationMs: now - Number(state.createdAt || state.claimedAt),
      residualObserverReceiptId: 'industry-crm-archive-read:' + hash({ id: state.hubspotCompanyId, at: now }).slice(0, 24),
      rollbackVerified: true, zeroResidualEffectVerified: true
    }))).state;
  }
  if (state.status === 'EVIDENCE_COMPLETE') {
    var pair = await persistCapabilities(store, motor, state, now);
    return (await transition(store, state, Object.assign({}, state, { status: 'VERIFIED', verifiedAt: now, capabilities: pair }))).state;
  }
  return state;
}

async function audit(store, now) {
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  store.assertDurable();
  var motor = await store.get(Motor.receiptKey('industry'));
  var pair = validMotor(motor) ? await Cap.verifyPair(store, motor, at) : { ok: false, reason: 'industry-motor-receipt-missing-or-invalid' };
  return { schemaVersion: SCHEMA, productDomain: 'industry', ownerDomain: 'industry', lane: 'crm', measuredAt: new Date(at).toISOString(), readOnly: true, liveMoney: false,
    motorReceipt: { present: !!motor, identityMatched: validMotor(motor), receiptId: motor && motor.receiptId || null, status: motor && motor.status || null },
    commissioning: publicState(await store.get(SLOT_KEY)), capabilities: pair };
}

async function commission(store, now, deps) {
  deps = deps || {};
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  store.assertDurable();
  if (String((deps.env || process.env).INDUSTRY_CRM_COMMISSIONING_ENABLED || '') !== '1') return { ok: true, status: 'HELD', reason: 'industry-crm-commissioning-disabled', liveMoney: false };
  var motor = await store.get(Motor.receiptKey('industry'));
  if (!validMotor(motor)) return { ok: true, status: 'HELD', reason: 'industry-motor-receipt-missing-or-invalid', liveMoney: false };
  var existing = await Cap.verifyPair(store, motor, at);
  if (existing.ok) return { ok: true, status: 'VERIFIED', duplicate: true, capabilities: existing, liveMoney: false };
  var state = await store.get(SLOT_KEY);
  if (!state) { await store.setIfAbsent(SLOT_KEY, initialState(motor, at)); state = await store.get(SLOT_KEY); }
  if (!state || state.schemaVersion !== SCHEMA || state.productDomain !== 'industry' || state.ownerDomain !== 'industry' || state.lane !== 'crm') throw new Error('industry CRM commissioning slot invalid');
  var pause = deps.sleep || sleep;
  for (var i = 0; i < (deps.pollAttempts || 8); i++) {
    var before = state.status;
    state = await step(store, state, motor, deps, Number.isFinite(Number(deps.stepNow)) ? Number(deps.stepNow) + i : Date.now());
    if (state.status === 'VERIFIED' || state.status === 'FAILED' || state.status === 'QUARANTINED') break;
    if (state.status === before) await pause(deps.pollDelayMs == null ? 1000 : deps.pollDelayMs);
  }
  return { ok: state.status === 'VERIFIED', status: state.status, reason: state.reason || null, commissioning: publicState(state), capabilities: state.capabilities || null, liveMoney: false };
}

module.exports = { SCHEMA: SCHEMA, SLOT_KEY: SLOT_KEY, LOG_KEY: LOG_KEY, TTL_SECONDS: TTL_SECONDS, TEXT: TEXT,
  hash: hash, candidate: candidate, validMotor: validMotor, publicState: publicState, initialState: initialState,
  persistCapabilities: persistCapabilities, audit: audit, step: step, commission: commission };
