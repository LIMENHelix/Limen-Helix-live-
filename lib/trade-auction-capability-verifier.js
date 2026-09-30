'use strict';

/**
 * Bounded Trade auction commissioning.
 *
 * Uses the existing owned marketplace listing path with a fixed marker,
 * independently reads the public listing, closes it, independently verifies
 * public absence, and only then persists the short-lived capability pair.
 * Binding sale, order acceptance, payment, and buyer interaction remain off.
 */

var crypto = require('node:crypto');
var Cap = require('./product-domain-motor-capability.js');
var Motor = require('./product-domain-motor-receipt.js');
var Decision = require('./trade-auction-decision.js');
var Observer = require('./trade-auction-observer.js');
var Marketplace = require('./relay-marketplace.js');
var AdapterGuard = require('./civilization-adapter-guard.js');

var SCHEMA = 'trade-auction-capability-commissioning/1.0';
var SLOT_KEY = 'trade_auction_capability_commissioning:v1';
var LOG_KEY = 'trade_auction_capability_commissioning_log';
var TTL_SECONDS = 6 * 60 * 60;
var MAX_EXPOSURE_MS = Cap.MAX_REVERSIBLE_COMMISSIONING_EXPOSURE_MS;
var TEXT = 'LIMEN Trade auction motor commissioning — temporary owned-marketplace marker. No sale, order, payment, or binding acceptance.';

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
function candidate(now) {
  var at = Number(now) || Date.now();
  return Decision.candidate({
    listingRequestId: 'trade-capability-commissioning', marketplaceId: 'limen-commissioning-marketplace', sellerId: 'limen-commissioning-seller',
    assetRef: 'limen://trade-capability-commissioning/' + new Date(at).toISOString().slice(0, 10), title: TEXT,
    description: 'Temporary commissioning marker. No binding sale, order acceptance, or payment is authorized.', category: 'commissioning', condition: 'new',
    reservePriceUsd: 0.5, auctionEndsAt: new Date(at + 15 * 60 * 1000).toISOString(), brainOpportunityId: 'trade-capability-commissioning',
    evidenceId: 'trade-capability-commissioning-evidence', assetRightsConfirmed: true, bindingSaleAuthorized: false,
    orderAcceptanceAuthorized: false, paymentAuthorized: false, quantity: 1
  });
}
function validMotor(motor) {
  return !!(motor && motor.schemaVersion === Motor.SCHEMA && motor.productDomain === 'trade' && motor.ownerDomain === 'supplyChain' &&
    motor.contractId === 'trade-motor/1' && motor.lane === 'auction' && motor.contracts &&
    motor.contracts.receipt === 'marketplace-receipt' && motor.contracts.independentOutcome === 'win-loss-or-sale');
}
function publicState(state) {
  if (!state) return null;
  return { schemaVersion: state.schemaVersion, commissioningId: state.commissioningId, status: state.status, reason: state.reason || null,
    claimedAt: state.claimedAt || null, listedAt: state.listedAt || null, observedAt: state.observedAt || null,
    rollbackAttemptedAt: state.rollbackAttemptedAt || null, completedAt: state.completedAt || null, verifiedAt: state.verifiedAt || null,
    exposureDurationMs: state.exposureDurationMs == null ? null : state.exposureDurationMs, listingId: state.listingId || null,
    providerCalled: false, liveMoney: false };
}
async function append(store, state) { await store.lpush(LOG_KEY, publicState(state)); await store.ltrim(LOG_KEY, 0, 199); }
async function transition(store, current, next) {
  var changed = await store.replaceIfValue(SLOT_KEY, current, next);
  if (!changed) return { changed: false, state: await store.get(SLOT_KEY) };
  var restored = await store.get(SLOT_KEY);
  if (!restored || restored.commissioningId !== next.commissioningId || restored.status !== next.status) throw new Error('trade auction commissioning transition readback invalid');
  await append(store, restored); return { changed: true, state: restored };
}
function initialState(motor, now) {
  return { schemaVersion: SCHEMA, commissioningId: 'tacap_' + hash({ receipt: motor.receiptId, text: TEXT }).slice(0, 24), status: 'CLAIMED',
    productDomain: 'trade', ownerDomain: 'supplyChain', lane: 'auction', motorReceiptId: motor.receiptId, candidate: candidate(now), claimedAt: now,
    providerCalled: false, externalEffectMayExist: false, liveMoney: false };
}
async function persistCapabilities(store, motor, state, now) {
  var common = { schemaVersion: Cap.SCHEMA, status: 'VERIFIED', environment: 'production', productDomain: 'trade', ownerDomain: 'supplyChain', lane: 'auction',
    motorContractId: motor.contractId, verifiedAt: now, expiresAt: now + TTL_SECONDS * 1000 };
  var executor = Object.assign({}, common, { capabilityId: 'tace_' + hash({ commissioningId: state.commissioningId, at: now }).slice(0, 24), kind: Cap.EXECUTOR,
    contractId: motor.contracts.receipt, adapterId: 'limen-owned-marketplace-listing/1', verifierId: 'trade-auction-commissioning-verifier/1',
    evidenceReceiptId: 'trade-marketplace-create:' + state.listingId, verificationEffectExecuted: true, commissioningOnly: true, liveMoney: false,
    verificationSpendUsd: 0, rollbackVerified: true, zeroResidualEffectVerified: true, rollbackReceiptId: state.rollbackReceiptId,
    residualObserverReceiptId: state.residualObserverReceiptId, exposureDurationMs: state.exposureDurationMs });
  var observer = Object.assign({}, common, { capabilityId: 'taco_' + hash({ commissioningId: state.commissioningId, observedAt: state.observedAt }).slice(0, 24), kind: Cap.OBSERVER,
    contractId: motor.contracts.independentOutcome, adapterId: 'limen-owned-marketplace-public-read/1', verifierId: 'trade-auction-independent-read-verifier/1',
    evidenceReceiptId: state.presenceObserverReceiptId, independentSourceVerified: true, independentOfAdapterId: executor.adapterId });
  var ex = Cap.validate(executor, Cap.EXECUTOR, motor, now), ob = Cap.validate(observer, Cap.OBSERVER, motor, now);
  if (!ex.ok || !ob.ok) throw new Error('trade auction capability validation failed:' + (ex.reason || ob.reason));
  await store.set(Cap.capabilityKey('trade', Cap.EXECUTOR), executor, TTL_SECONDS);
  await store.set(Cap.capabilityKey('trade', Cap.OBSERVER), observer, TTL_SECONDS);
  var pair = await Cap.verifyPair(store, motor, now); if (!pair.ok) throw new Error('trade auction capability readback failed:' + pair.reason); return pair;
}
function commandFor(state) { return { schemaVersion: 'trade-auction-command/1.0', commandId: 'tacapcmd_' + state.commissioningId, actionId: 'tacapaction_' + state.commissioningId,
  status: 'LISTED', listingId: state.listingId, marketplaceId: state.candidate.marketplaceId, contentHash: state.candidate.contentHash }; }
async function step(store, state, motor, deps, now) {
  var market = deps.marketplace || Marketplace;
  if (state.status === 'CLAIMED') {
    var guard = await (deps.adapterGuard || AdapterGuard).checkpoint(store, 'trade:auction', 'bounded-trade-auction-commissioning', now);
    var started = await transition(store, state, Object.assign({}, state, { status: 'DISPATCHING', adapterGuard: guard, dispatchStartedAt: now }));
    if (!started.changed) return started.state;
    var listed = await market.createListing({ marketplaceId: state.candidate.marketplaceId, sellerId: state.candidate.sellerId, title: state.candidate.title,
      price: state.candidate.reservePriceUsd, description: state.candidate.description, category: state.candidate.category, condition: state.candidate.condition,
      quantity: state.candidate.quantity, saleMode: 'auction', assetRef: state.candidate.assetRef, assetRefHash: state.candidate.assetRefHash,
      contentHash: state.candidate.contentHash, auctionEndsAt: state.candidate.auctionEndsAt, bindingSaleAuthorized: false, orderAcceptanceAuthorized: false, paymentAuthorized: false });
    if (!listed || !listed.id) return (await transition(store, started.state, Object.assign({}, started.state, { status: 'FAILED', reason: 'trade-commissioning-listing-failed', completedAt: now }))).state;
    return (await transition(store, started.state, Object.assign({}, started.state, { status: 'LISTED', listingId: listed.id, listedAt: now }))).state;
  }
  if (state.status === 'LISTED') {
    var presence = deps.observePresence ? await deps.observePresence(state) : await Observer.observe(store, Object.assign({ schemaVersion: 'trade-auction-command/1.0', commandId: 'tacapcmd_' + state.commissioningId,
      actionId: 'tacapaction_' + state.commissioningId, status: 'LISTED', listingId: state.listingId, marketplaceId: state.candidate.marketplaceId, contentHash: state.candidate.contentHash }), deps.fetch || global.fetch, deps.baseUrl || process.env.LIMEN_BASE_URL || 'https://limenhelix.com');
    if (!presence || presence.status !== 'PUBLIC_LISTING_PRESENCE_OBSERVED') return state;
    return (await transition(store, state, Object.assign({}, state, { status: 'OBSERVED', observedAt: now, presenceObserverReceiptId: presence.observationId }))).state;
  }
  if (state.status === 'OBSERVED') {
    var recoveryId = 'trade-auction-close:' + hash({ listingId: state.listingId, at: now }).slice(0, 24);
    var closing = await transition(store, state, Object.assign({}, state, { status: 'ROLLBACK_DISPATCHING', rollbackAttemptedAt: now, rollbackReceiptId: recoveryId }));
    if (!closing.changed) return closing.state;
    await market.updateListing(state.listingId, { status: 'closed', closedByRecoveryId: recoveryId, bindingSaleAuthorized: false, orderAcceptanceAuthorized: false, paymentAuthorized: false });
    return closing.state;
  }
  if (state.status === 'ROLLBACK_DISPATCHING') {
    var absent = deps.observePublicAbsence ? await deps.observePublicAbsence(state) : await Observer.publicAbsent(deps.fetch || global.fetch, { marketplaceId: state.candidate.marketplaceId, listingId: state.listingId }, deps.baseUrl || process.env.LIMEN_BASE_URL || 'https://limenhelix.com');
    if (!absent) return state;
    return (await transition(store, state, Object.assign({}, state, { status: 'EVIDENCE_COMPLETE', completedAt: now, exposureDurationMs: now - Number(state.listedAt || state.claimedAt),
      residualObserverReceiptId: 'trade-auction-absence:' + hash({ listingId: state.listingId, at: now }).slice(0, 24), rollbackVerified: true, zeroResidualEffectVerified: true }))).state;
  }
  if (state.status === 'EVIDENCE_COMPLETE') {
    var pair = await persistCapabilities(store, motor, state, now);
    return (await transition(store, state, Object.assign({}, state, { status: 'VERIFIED', verifiedAt: now, capabilities: pair }))).state;
  }
  return state;
}
async function audit(store, now) {
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now(); store.assertDurable();
  var motor = await store.get(Motor.receiptKey('trade')); var pair = validMotor(motor) ? await Cap.verifyPair(store, motor, at) : { ok: false, reason: 'trade-motor-receipt-missing-or-invalid' };
  return { schemaVersion: SCHEMA, productDomain: 'trade', ownerDomain: 'supplyChain', lane: 'auction', measuredAt: new Date(at).toISOString(), readOnly: true, liveMoney: false,
    motorReceipt: { present: !!motor, identityMatched: validMotor(motor), receiptId: motor && motor.receiptId || null, status: motor && motor.status || null }, commissioning: publicState(await store.get(SLOT_KEY)), capabilities: pair };
}
async function commission(store, now, deps) {
  deps = deps || {}; var at = Number.isFinite(Number(now)) ? Number(now) : Date.now(); store.assertDurable();
  if (String((deps.env || process.env).TRADE_AUCTION_COMMISSIONING_ENABLED || '') !== '1') return { ok: true, status: 'HELD', reason: 'trade-auction-commissioning-disabled', liveMoney: false };
  var motor = await store.get(Motor.receiptKey('trade')); if (!validMotor(motor)) return { ok: true, status: 'HELD', reason: 'trade-motor-receipt-missing-or-invalid', liveMoney: false };
  var existing = await Cap.verifyPair(store, motor, at); if (existing.ok) return { ok: true, status: 'VERIFIED', duplicate: true, capabilities: existing, liveMoney: false };
  var state = await store.get(SLOT_KEY); if (!state) { await store.setIfAbsent(SLOT_KEY, initialState(motor, at)); state = await store.get(SLOT_KEY); }
  if (!state || state.schemaVersion !== SCHEMA || state.productDomain !== 'trade' || state.ownerDomain !== 'supplyChain' || state.lane !== 'auction') throw new Error('trade auction commissioning slot invalid');
  var pause = deps.sleep || sleep;
  for (var i = 0; i < (deps.pollAttempts || 8); i++) { var before = state.status; state = await step(store, state, motor, deps, Number.isFinite(Number(deps.stepNow)) ? Number(deps.stepNow) + i : Date.now());
    if (state.status === 'VERIFIED' || state.status === 'FAILED' || state.status === 'QUARANTINED') break; if (state.status === before) await pause(deps.pollDelayMs == null ? 1000 : deps.pollDelayMs); }
  return { ok: state.status === 'VERIFIED', status: state.status, reason: state.reason || null, commissioning: publicState(state), capabilities: state.capabilities || null, liveMoney: false };
}
module.exports = { SCHEMA: SCHEMA, SLOT_KEY: SLOT_KEY, LOG_KEY: LOG_KEY, TTL_SECONDS: TTL_SECONDS, MAX_EXPOSURE_MS: MAX_EXPOSURE_MS,
  TEXT: TEXT, hash: hash, candidate: candidate, validMotor: validMotor, publicState: publicState, initialState: initialState, persistCapabilities: persistCapabilities, audit: audit, step: step, commission: commission };
