'use strict';

/**
 * Bounded Defense publication commissioning.
 *
 * This verifier exercises the existing owned-publication motor with a fixed,
 * non-claim commissioning artifact, independently reads its public presence,
 * unpublishes it, independently verifies absence, and only then persists the
 * short-lived capability pair consumed by the product-brain overlay. It never
 * selects a Defense topic and never treats a local fixture as production
 * evidence.
 */

var crypto = require('node:crypto');
var Cap = require('./product-domain-motor-capability.js');
var Motor = require('./product-domain-motor-receipt.js');
var Publisher = require('./defense-publication-publisher.js');
var Observer = require('./defense-publication-observer.js');
var AdapterGuard = require('./civilization-adapter-guard.js');

var SCHEMA = 'defense-publication-capability-commissioning/1.0';
var SLOT_KEY = 'defense_publication_capability_commissioning:v1';
var LOG_KEY = 'defense_publication_capability_commissioning_log';
var TTL_SECONDS = 6 * 60 * 60;
var MAX_EXPOSURE_MS = Cap.MAX_REVERSIBLE_COMMISSIONING_EXPOSURE_MS;
var TEXT = 'LIMEN Defense publication motor commissioning — temporary verification artifact. No claim, alert, prediction, or recommendation.';

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
function sourceRows() {
  return [
    { sourceIdentity: { kind: 'commissioning-marker', value: 'defense-capability-source-a' }, title: 'Commissioning source A', url: 'https://limenhelix.com/defense-briefs' },
    { sourceIdentity: { kind: 'commissioning-marker', value: 'defense-capability-source-b' }, title: 'Commissioning source B', url: 'https://limenhelix.com/defense' },
    { sourceIdentity: { kind: 'commissioning-marker', value: 'defense-capability-source-c' }, title: 'Commissioning source C', url: 'https://limenhelix.com/' }
  ];
}
function candidate(now) {
  var sources = sourceRows();
  var title = TEXT;
  var summary = 'A temporary owned-site marker used only to verify the Defense publication adapter.';
  var body = summary + '\n\nThis artifact carries no Defense content and must be removed before capability evidence is accepted.';
  var packetId = 'defense-capability-commissioning';
  var selectedId = 'defense-capability-commissioning';
  var contentHash = hash({ title: title, summary: summary, body: body, sources: sources, packetId: packetId, selectedId: selectedId });
  return {
    schemaVersion: 'defense-publication-candidate/1.0', productDomain: 'defense', ownerDomain: 'defense', lane: 'publication',
    candidateId: 'dpcap_' + hash({ title: title, at: new Date(Number(now) || Date.now()).toISOString().slice(0, 10) }).slice(0, 24),
    title: title, summary: summary, body: body,
    disclaimer: 'Commissioning artifact only; no claim, alert, prediction, or recommendation.',
    sources: sources, sourceFingerprint: hash(sources.map(function (row) { return row.sourceIdentity.value; })),
    contentHash: contentHash, defensePacketId: packetId,
    brainSelection: { id: selectedId, title: 'commissioning marker', path: 'RESEARCHABLE' },
    stressScore: null, phase: null, diagnoses: [], generatedAt: new Date(Number(now) || Date.now()).toISOString(), liveMoney: false
  };
}
function validMotor(motor) {
  return !!(motor && motor.schemaVersion === Motor.SCHEMA && motor.productDomain === 'defense' &&
    motor.ownerDomain === 'defense' && motor.contractId === 'defense-motor/1' && motor.lane === 'publication' &&
    motor.contracts && motor.contracts.receipt === 'publication-receipt' &&
    motor.contracts.independentOutcome === 'reach-engagement-or-conversion');
}
function publicState(state) {
  if (!state) return null;
  return {
    schemaVersion: state.schemaVersion, commissioningId: state.commissioningId, status: state.status,
    reason: state.reason || null, claimedAt: state.claimedAt || null, publishedAt: state.publishedAt || null,
    observedAt: state.observedAt || null, rollbackAttemptedAt: state.rollbackAttemptedAt || null,
    completedAt: state.completedAt || null, verifiedAt: state.verifiedAt || null,
    exposureDurationMs: state.exposureDurationMs == null ? null : state.exposureDurationMs,
    articleId: state.articleId || null, providerCalled: false, liveMoney: false
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
    throw new Error('defense publication commissioning transition readback invalid');
  }
  await append(store, restored);
  return { changed: true, state: restored };
}
function initialState(motor, now, attempt) {
  var commissioningId = 'dpcap_' + hash({ motorReceiptId: motor.receiptId, text: TEXT, attempt: Math.max(1, Number(attempt) || 1) }).slice(0, 24);
  return {
    schemaVersion: SCHEMA, commissioningId: commissioningId, status: 'CLAIMED', productDomain: 'defense',
    ownerDomain: 'defense', lane: 'publication', motorReceiptId: motor.receiptId,
    candidate: candidate(now), claimedAt: now, attemptCount: Math.max(1, Number(attempt) || 1),
    providerCalled: false, externalEffectMayExist: false, liveMoney: false
  };
}
async function persistCapabilities(store, motor, state, now) {
  var common = {
    schemaVersion: Cap.SCHEMA, status: 'VERIFIED', environment: 'production', productDomain: 'defense',
    ownerDomain: 'defense', lane: 'publication', motorContractId: motor.contractId,
    verifiedAt: now, expiresAt: now + TTL_SECONDS * 1000
  };
  var executor = Object.assign({}, common, {
    capabilityId: 'dpce_' + hash({ commissioningId: state.commissioningId, at: now }).slice(0, 24),
    kind: Cap.EXECUTOR, contractId: motor.contracts.receipt,
    adapterId: 'defense-owned-publication-adapter/1', verifierId: 'defense-publication-commissioning-verifier/1',
    evidenceReceiptId: 'defense-publication-create:' + state.articleId,
    verificationEffectExecuted: true, commissioningOnly: true, liveMoney: false, verificationSpendUsd: 0,
    rollbackVerified: true, zeroResidualEffectVerified: true, rollbackReceiptId: state.rollbackReceiptId,
    residualObserverReceiptId: state.residualObserverReceiptId, exposureDurationMs: state.exposureDurationMs
  });
  var observer = Object.assign({}, common, {
    capabilityId: 'dpco_' + hash({ commissioningId: state.commissioningId, observedAt: state.observedAt }).slice(0, 24),
    kind: Cap.OBSERVER, contractId: motor.contracts.independentOutcome,
    adapterId: 'defense-independent-public-read/1', verifierId: 'defense-publication-independent-read-verifier/1',
    evidenceReceiptId: state.presenceObserverReceiptId, independentSourceVerified: true,
    independentOfAdapterId: executor.adapterId
  });
  var executorValidation = Cap.validate(executor, Cap.EXECUTOR, motor, now);
  var observerValidation = Cap.validate(observer, Cap.OBSERVER, motor, now);
  if (!executorValidation.ok || !observerValidation.ok) {
    throw new Error('defense publication capability validation failed:' + (executorValidation.reason || observerValidation.reason));
  }
  await store.set(Cap.capabilityKey('defense', Cap.EXECUTOR), executor, TTL_SECONDS);
  await store.set(Cap.capabilityKey('defense', Cap.OBSERVER), observer, TTL_SECONDS);
  var restored = await Cap.verifyPair(store, motor, now);
  if (!restored.ok) throw new Error('defense publication capability readback failed:' + restored.reason);
  return restored;
}
function commandFor(state) {
  return {
    schemaVersion: 'defense-publication-command/1.0', commandId: 'dpcapcmd_' + state.commissioningId,
    actionId: 'dpcapaction_' + state.commissioningId, status: 'PUBLISHED', articleId: state.articleId,
    contentHash: state.candidate.contentHash
  };
}
async function step(store, state, motor, deps, now) {
  if (state.status === 'CLAIMED') {
    var guarded = await (deps.adapterGuard || AdapterGuard).checkpoint(
      store, 'defense:publication', 'bounded-defense-publication-commissioning', now);
    var dispatching = Object.assign({}, state, { status: 'DISPATCHING', adapterGuard: guarded, dispatchStartedAt: now });
    var claimed = await transition(store, state, dispatching);
    if (!claimed.changed) return claimed.state;
    var published = await (deps.publisher || Publisher).publish(store, state.candidate, 'dpcapaction_' + state.commissioningId, now);
    if (!published || !published.ok || !published.articleId) {
      return (await transition(store, claimed.state, Object.assign({}, claimed.state, {
        status: 'FAILED', reason: published && published.error || 'defense-commissioning-publication-failed', completedAt: now
      }))).state;
    }
    return (await transition(store, claimed.state, Object.assign({}, claimed.state, {
      status: 'PUBLISHED', articleId: published.articleId, publicPath: published.publicPath, publishedAt: now
    }))).state;
  }
  if (state.status === 'PUBLISHED') {
    var presence = await (deps.observePresence || function () {
      return Observer.observePresence(store, commandFor(state), deps.fetch || global.fetch, deps.baseUrl || process.env.LIMEN_BASE_URL || 'https://limenhelix.com');
    })();
    if (!presence || presence.status !== 'PUBLIC_PRESENCE_OBSERVED') return state;
    return (await transition(store, state, Object.assign({}, state, {
      status: 'OBSERVED', observedAt: now, presenceObserverReceiptId: presence.observationId
    }))).state;
  }
  if (state.status === 'OBSERVED') {
    var rollbackReceiptId = 'defense-publication-unpublish:' + hash({ articleId: state.articleId, at: now }).slice(0, 24);
    var rollbackTransition = await transition(store, state, Object.assign({}, state, {
      status: 'ROLLBACK_DISPATCHING', rollbackAttemptedAt: now, rollbackReceiptId: rollbackReceiptId
    }));
    if (!rollbackTransition.changed) return rollbackTransition.state;
    var rollback = rollbackTransition.state;
    await (deps.publisher || Publisher).unpublish(store, state.articleId, rollbackReceiptId, now);
    return rollback;
  }
  if (state.status === 'ROLLBACK_DISPATCHING') {
    var absent = deps.observePublicAbsence ? await deps.observePublicAbsence(state.articleId) :
      await Observer.publicAbsent(deps.fetch || global.fetch, state.articleId, deps.baseUrl || process.env.LIMEN_BASE_URL || 'https://limenhelix.com');
    if (!absent) return state;
    return (await transition(store, state, Object.assign({}, state, {
      status: 'EVIDENCE_COMPLETE', completedAt: now,
      exposureDurationMs: now - Number(state.publishedAt || state.claimedAt),
      residualObserverReceiptId: 'defense-publication-absence:' + hash({ articleId: state.articleId, at: now }).slice(0, 24),
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
  var motor = await store.get(Motor.receiptKey('defense'));
  var pair = validMotor(motor) ? await Cap.verifyPair(store, motor, at) : { ok: false, reason: 'defense-motor-receipt-missing-or-invalid' };
  return { schemaVersion: SCHEMA, productDomain: 'defense', ownerDomain: 'defense', lane: 'publication', measuredAt: new Date(at).toISOString(), readOnly: true, liveMoney: false,
    motorReceipt: { present: !!motor, identityMatched: validMotor(motor), receiptId: motor && motor.receiptId || null, status: motor && motor.status || null },
    commissioning: publicState(await store.get(SLOT_KEY)), capabilities: pair };
}
async function commission(store, now, deps) {
  deps = deps || {};
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  store.assertDurable();
  if (String((deps.env || process.env).DEFENSE_PUBLICATION_COMMISSIONING_ENABLED || '') !== '1') {
    return { ok: true, status: 'HELD', reason: 'defense-publication-commissioning-disabled', liveMoney: false };
  }
  var motor = await store.get(Motor.receiptKey('defense'));
  if (!validMotor(motor)) return { ok: true, status: 'HELD', reason: 'defense-motor-receipt-missing-or-invalid', liveMoney: false };
  var existing = await Cap.verifyPair(store, motor, at);
  if (existing.ok) return { ok: true, status: 'VERIFIED', duplicate: true, capabilities: existing, liveMoney: false };
  var state = await store.get(SLOT_KEY);
  if (!state) { await store.setIfAbsent(SLOT_KEY, initialState(motor, at, 1)); state = await store.get(SLOT_KEY); }
  if (!state || state.schemaVersion !== SCHEMA || state.productDomain !== 'defense' || state.ownerDomain !== 'defense' || state.lane !== 'publication') {
    throw new Error('defense publication commissioning slot invalid');
  }
  var pause = deps.sleep || sleep;
  for (var i = 0; i < (deps.pollAttempts || 8); i++) {
    var before = state.status;
    state = await step(store, state, motor, deps, Number.isFinite(Number(deps.stepNow)) ? Number(deps.stepNow) + i : Date.now());
    if (state.status === 'VERIFIED' || state.status === 'FAILED' || state.status === 'QUARANTINED') break;
    if (state.status === before) await pause(deps.pollDelayMs == null ? 1000 : deps.pollDelayMs);
  }
  return { ok: state.status === 'VERIFIED', status: state.status, reason: state.reason || null, commissioning: publicState(state), capabilities: state.capabilities || null, liveMoney: false };
}

module.exports = {
  SCHEMA: SCHEMA, SLOT_KEY: SLOT_KEY, LOG_KEY: LOG_KEY, TTL_SECONDS: TTL_SECONDS, MAX_EXPOSURE_MS: MAX_EXPOSURE_MS,
  TEXT: TEXT, hash: hash, candidate: candidate, validMotor: validMotor, publicState: publicState,
  initialState: initialState, persistCapabilities: persistCapabilities, audit: audit, step: step, commission: commission
};
