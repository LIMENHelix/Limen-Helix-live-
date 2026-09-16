'use strict';

/**
 * One-shot production commissioning for Communication's Bluesky motor.
 *
 * The normal social motor cannot prove itself while its production capability
 * receipts are absent.  This narrower bootstrap path may publish only one
 * fixed, non-commercial marker to LIMEN's owned channel.  It independently
 * observes that marker through the public AppView, deletes it, independently
 * observes absence, and only then persists a short-lived executor/observer
 * capability pair.  It never selects domain content and never grants itself a
 * reusable post authority.
 */

var crypto = require('node:crypto');
var Cap = require('./product-domain-motor-capability.js');
var Motor = require('./product-domain-motor-receipt.js');
var Social = require('./social-post.js');
var Observer = require('./communication-social-outcome-observer.js');
var AdapterGuard = require('./civilization-adapter-guard.js');

var SCHEMA = 'communication-social-capability-commissioning/1.0';
var SLOT_KEY = 'communication_social_capability_commissioning:v1';
var LOG_KEY = 'communication_social_capability_commissioning_log';
var TTL_SECONDS = 6 * 60 * 60;
var MAX_EXPOSURE_MS = Cap.MAX_REVERSIBLE_COMMISSIONING_EXPOSURE_MS;
var POLL_ATTEMPTS = 20;
var POLL_DELAY_MS = 1500;
var TEXT = 'LIMEN Helix Communication motor commissioning — temporary verification post. No offer or prediction. https://limenhelix.com/communication';

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function validMotor(motor) {
  return !!(motor && motor.schemaVersion === Motor.SCHEMA && motor.productDomain === 'communication' &&
    motor.ownerDomain === 'communication' && motor.contractId === 'communication-motor/1' &&
    motor.lane === 'social' && motor.contracts && motor.contracts.receipt === 'platform-post-receipt' &&
    motor.contracts.independentOutcome === 'engagement-or-conversion');
}
function publicState(state) {
  if (!state) return null;
  return {
    schemaVersion: state.schemaVersion, commissioningId: state.commissioningId,
    status: state.status, reason: state.reason || null, claimedAt: state.claimedAt || null,
    postedAt: state.postedAt || null, observedAt: state.observedAt || null,
    rollbackAttemptedAt: state.rollbackAttemptedAt || null, completedAt: state.completedAt || null,
    verifiedAt: state.verifiedAt || null,
    exposureDurationMs: state.exposureDurationMs == null ? null : state.exposureDurationMs,
    postIdentity: state.postIdentity ? { uri: state.postIdentity.uri, cid: state.postIdentity.cid } : null,
    providerCalled: state.providerCalled === true, liveMoney: false
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
    throw new Error('communication social commissioning transition readback invalid');
  }
  await append(store, restored);
  return { changed: true, state: restored };
}
function postIdentity(row) {
  return row && row.uri && row.cid ? { uri: String(row.uri), cid: String(row.cid) } : null;
}
function fixedPostMatch(post, state) {
  var record = post && post.record || {};
  var createdAt = Date.parse(record.createdAt);
  return !!(postIdentity(post) && record.text === TEXT && Number.isFinite(createdAt) &&
    createdAt >= Number(state.claimedAt) - 60000 && createdAt <= Number(state.claimedAt) + MAX_EXPOSURE_MS);
}
async function reconcileDispatching(store, state, deps, now) {
  var feed = await (deps.authorFeed || Observer.authorFeed)(deps.handle || process.env.BLUESKY_HANDLE, deps.fetch);
  var matches = feed.filter(function (post) { return fixedPostMatch(post, state); });
  if (matches.length === 1) {
    var identity = postIdentity(matches[0]);
    return transition(store, state, Object.assign({}, state, {
      status: 'POSTED', postIdentity: identity, postedAt: Date.parse(matches[0].record.createdAt) || now,
      reconciledFromPublicAppView: true, providerCalled: true, reason: null
    }));
  }
  if (matches.length > 1) {
    return transition(store, state, Object.assign({}, state, {
      status: 'QUARANTINED', reason: 'multiple-commissioning-posts-observed', completedAt: now
    }));
  }
  if (now - Number(state.claimedAt) > MAX_EXPOSURE_MS) {
    return transition(store, state, Object.assign({}, state, {
      status: 'QUARANTINED', reason: 'ambiguous-dispatch-unresolved-within-exposure-window', completedAt: now
    }));
  }
  return { changed: false, state: state };
}
async function persistCapabilities(store, motor, state, now) {
  var exposure = Number(state.exposureDurationMs);
  var common = {
    schemaVersion: Cap.SCHEMA, status: 'VERIFIED', environment: 'production',
    productDomain: 'communication', ownerDomain: 'communication', lane: 'social',
    motorContractId: motor.contractId, verifiedAt: now, expiresAt: now + TTL_SECONDS * 1000
  };
  var executor = Object.assign({}, common, {
    capabilityId: 'csce_' + hash({ commissioningId: state.commissioningId, at: now }).slice(0, 24),
    kind: Cap.EXECUTOR, contractId: motor.contracts.receipt,
    adapterId: 'bluesky-pds-write-adapter/1', verifierId: 'communication-social-commissioning-verifier/1',
    evidenceReceiptId: 'bluesky-create:' + state.postIdentity.uri,
    verificationEffectExecuted: true, commissioningOnly: true, liveMoney: false,
    verificationSpendUsd: 0, rollbackVerified: true, zeroResidualEffectVerified: true,
    rollbackReceiptId: state.rollbackReceiptId,
    residualObserverReceiptId: state.residualObserverReceiptId,
    exposureDurationMs: exposure
  });
  var observer = Object.assign({}, common, {
    capabilityId: 'csco_' + hash({ commissioningId: state.commissioningId, observedAt: state.observedAt }).slice(0, 24),
    kind: Cap.OBSERVER, contractId: motor.contracts.independentOutcome,
    adapterId: 'bluesky-public-appview/1', verifierId: 'communication-social-independent-appview-verifier/1',
    evidenceReceiptId: state.presenceObserverReceiptId, independentSourceVerified: true,
    independentOfAdapterId: executor.adapterId
  });
  var executorValidation = Cap.validate(executor, Cap.EXECUTOR, motor, now);
  var observerValidation = Cap.validate(observer, Cap.OBSERVER, motor, now);
  if (!executorValidation.ok || !observerValidation.ok) {
    throw new Error('communication social capability validation failed:' +
      (executorValidation.reason || observerValidation.reason));
  }
  await store.set(Cap.capabilityKey('communication', Cap.EXECUTOR), executor, TTL_SECONDS);
  await store.set(Cap.capabilityKey('communication', Cap.OBSERVER), observer, TTL_SECONDS);
  var restored = await Cap.verifyPair(store, motor, now);
  if (!restored.ok) throw new Error('communication social capability readback failed:' + restored.reason);
  return restored;
}
async function step(store, state, motor, deps, now) {
  if (state.status === 'CLAIMED') {
    var guarded = await (deps.adapterGuard || AdapterGuard).checkpoint(
      store, 'communication:social-commissioning', 'bounded-reversible-commissioning-proof', now);
    var dispatching = Object.assign({}, state, {
      status: 'DISPATCHING', adapterGuard: guarded, dispatchStartedAt: now,
      providerCalled: false, reason: null
    });
    var claimed = await transition(store, state, dispatching);
    if (!claimed.changed) return claimed.state;
    var posted = await (deps.postToBluesky || Social.postToBluesky)(TEXT);
    if (!posted || !posted.ok) {
      var failed = Object.assign({}, claimed.state, {
        status: posted && posted.ambiguous ? 'DISPATCHING' : 'FAILED',
        reason: posted && posted.ambiguous ? 'provider-dispatch-ambiguous-awaiting-public-reconciliation' :
          'commissioning-post-failed',
        providerCalled: !!(posted && posted.providerCalled),
        definitiveFailure: !!(posted && posted.definitiveFailure),
        completedAt: posted && posted.ambiguous ? null : Date.now()
      });
      var savedFailure = await transition(store, claimed.state, failed);
      return savedFailure.state;
    }
    var identity = postIdentity(posted);
    if (!identity) throw new Error('communication social commissioning provider identity missing');
    var postedState = Object.assign({}, claimed.state, {
      status: 'POSTED', postIdentity: identity, postedAt: Date.now(), providerCalled: true,
      reason: null
    });
    var savedPost = await transition(store, claimed.state, postedState);
    return savedPost.state;
  }
  if (state.status === 'DISPATCHING') {
    return (await reconcileDispatching(store, state, deps, now)).state;
  }
  if (state.status === 'POSTED') {
    var presence = await (deps.appviewRead || Observer.appviewRead)(state.postIdentity.uri, deps.fetch);
    if (!presence || !presence.found || !presence.post || presence.post.cid !== state.postIdentity.cid) return state;
    var observed = Object.assign({}, state, {
      status: 'OBSERVED', observedAt: now,
      presenceObserverReceiptId: 'bluesky-appview-presence:' + hash({ uri: state.postIdentity.uri,
        cid: state.postIdentity.cid, indexedAt: presence.post.indexedAt || null }).slice(0, 24)
    });
    return (await transition(store, state, observed)).state;
  }
  if (state.status === 'OBSERVED') {
    var rollback = Object.assign({}, state, {
      status: 'ROLLBACK_DISPATCHING', rollbackAttemptedAt: now,
      rollbackReceiptId: 'bluesky-delete:' + hash({ uri: state.postIdentity.uri, at: now }).slice(0, 24)
    });
    var rollbackClaim = await transition(store, state, rollback);
    if (!rollbackClaim.changed) return rollbackClaim.state;
    await (deps.deleteBlueskyPost || Social.deleteBlueskyPost)(state.postIdentity.uri);
    return rollbackClaim.state;
  }
  if (state.status === 'ROLLBACK_DISPATCHING') {
    var residual = await (deps.appviewRead || Observer.appviewRead)(state.postIdentity.uri, deps.fetch);
    if (residual && residual.found) {
      await (deps.deleteBlueskyPost || Social.deleteBlueskyPost)(state.postIdentity.uri);
      return state;
    }
    var exposureDurationMs = now - Number(state.postedAt || state.claimedAt);
    var complete = Object.assign({}, state, {
      status: exposureDurationMs <= MAX_EXPOSURE_MS ? 'EVIDENCE_COMPLETE' : 'CLEANED_UP_EXPIRED',
      completedAt: now, exposureDurationMs: exposureDurationMs,
      residualObserverReceiptId: 'bluesky-appview-absence:' + hash({ uri: state.postIdentity.uri, at: now }).slice(0, 24),
      rollbackVerified: true, zeroResidualEffectVerified: true,
      reason: exposureDurationMs <= MAX_EXPOSURE_MS ? null : 'commissioning-exposure-window-exceeded'
    });
    return (await transition(store, state, complete)).state;
  }
  if (state.status === 'EVIDENCE_COMPLETE') {
    var pair = await persistCapabilities(store, motor, state, now);
    var verified = Object.assign({}, state, { status: 'VERIFIED', verifiedAt: now, capabilities: pair });
    return (await transition(store, state, verified)).state;
  }
  return state;
}
async function audit(store, now) {
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  store.assertDurable();
  var rows = await Promise.all([
    store.get(Motor.receiptKey('communication')),
    store.get(SLOT_KEY)
  ]);
  var motor = rows[0], pair = validMotor(motor) ? await Cap.verifyPair(store, motor, at) : { ok: false, reason: 'communication-motor-identity-invalid' };
  return {
    schemaVersion: SCHEMA, productDomain: 'communication', ownerDomain: 'communication', lane: 'social',
    measuredAt: new Date(at).toISOString(), readOnly: true, liveMoney: false,
    motorReceipt: { present: !!motor, identityMatched: validMotor(motor), receiptId: motor && motor.receiptId || null,
      status: motor && motor.status || null },
    commissioning: publicState(rows[1]),
    capabilities: pair
  };
}
async function commission(store, now, deps) {
  deps = deps || {};
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  store.assertDurable();
  if (String((deps.env || process.env).COMMUNICATION_SOCIAL_COMMISSIONING_ENABLED || '') !== '1') {
    return { ok: true, status: 'HELD', reason: 'communication-social-commissioning-disabled', liveMoney: false };
  }
  var motor = await store.get(Motor.receiptKey('communication'));
  if (!validMotor(motor)) return { ok: true, status: 'HELD', reason: 'communication-motor-receipt-missing-or-invalid', liveMoney: false };
  var existingPair = await Cap.verifyPair(store, motor, at);
  if (existingPair.ok) return { ok: true, status: 'VERIFIED', duplicate: true, capabilities: existingPair, liveMoney: false };
  var initial = {
    schemaVersion: SCHEMA,
    commissioningId: 'cscap_' + hash({ motorReceiptId: motor.receiptId, text: TEXT }).slice(0, 24),
    status: 'CLAIMED', productDomain: 'communication', ownerDomain: 'communication', lane: 'social',
    motorReceiptId: motor.receiptId, textHash: hash(TEXT), claimedAt: at,
    providerCalled: false, liveMoney: false
  };
  await store.setIfAbsent(SLOT_KEY, initial);
  var state = await store.get(SLOT_KEY);
  if (!state || state.schemaVersion !== SCHEMA || state.productDomain !== 'communication' ||
      state.ownerDomain !== 'communication' || state.lane !== 'social' || state.textHash !== hash(TEXT)) {
    throw new Error('communication social commissioning slot invalid');
  }
  // Capability receipts are short-lived authorization leases; the completed
  // create -> public read -> delete -> public absence evidence is durable.
  // Renewing a lease from that exact verified evidence must never replay the
  // public test effect. Provider health and the live valve are still checked
  // again by every real dispatch.
  if (state.status === 'VERIFIED' && state.rollbackVerified === true &&
      state.zeroResidualEffectVerified === true && Number(state.exposureDurationMs) <= MAX_EXPOSURE_MS &&
      state.postIdentity && state.presenceObserverReceiptId && state.rollbackReceiptId &&
      state.residualObserverReceiptId) {
    var renewedPair = await persistCapabilities(store, motor, state, at);
    var renewed = Object.assign({}, state, { verifiedAt: at, capabilities: renewedPair });
    var savedRenewal = await transition(store, state, renewed);
    return { ok: true, status: 'VERIFIED', renewed: true,
      commissioning: publicState(savedRenewal.state), capabilities: renewedPair, liveMoney: false };
  }
  var pause = deps.sleep || sleep;
  for (var i = 0; i < (deps.pollAttempts || POLL_ATTEMPTS); i++) {
    var before = state.status;
    state = await step(store, state, motor, deps, Date.now());
    if (state.status === 'VERIFIED' || state.status === 'FAILED' || state.status === 'QUARANTINED' ||
        state.status === 'CLEANED_UP_EXPIRED') break;
    if (state.status === before || state.status === 'POSTED' || state.status === 'ROLLBACK_DISPATCHING') {
      await pause(deps.pollDelayMs == null ? POLL_DELAY_MS : deps.pollDelayMs);
    }
  }
  return {
    ok: state.status === 'VERIFIED' || state.status === 'POSTED' || state.status === 'OBSERVED' ||
      state.status === 'ROLLBACK_DISPATCHING' || state.status === 'EVIDENCE_COMPLETE',
    status: state.status, reason: state.reason || null, commissioning: publicState(state),
    capabilities: state.capabilities || null, liveMoney: false
  };
}

module.exports = {
  SCHEMA: SCHEMA, SLOT_KEY: SLOT_KEY, LOG_KEY: LOG_KEY, TTL_SECONDS: TTL_SECONDS,
  MAX_EXPOSURE_MS: MAX_EXPOSURE_MS, POLL_ATTEMPTS: POLL_ATTEMPTS, POLL_DELAY_MS: POLL_DELAY_MS,
  TEXT: TEXT, hash: hash, validMotor: validMotor, publicState: publicState,
  fixedPostMatch: fixedPostMatch, persistCapabilities: persistCapabilities,
  audit: audit, commission: commission, step: step
};
