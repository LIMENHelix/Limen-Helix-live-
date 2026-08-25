'use strict';

/**
 * Import independently persisted motor evidence into one ephemeral product
 * brain instance. The product-domain source file remains the authority owner;
 * this overlay can only set its two verification facts. It cannot change the
 * domain's external-action/resource switches or dispatch an effector.
 */

var MotorReceipt = require('./product-domain-motor-receipt.js');
var Capability = require('./product-domain-motor-capability.js');

function held(productDomain, reason) {
  return {
    ok: true,
    productDomain: productDomain || null,
    verified: false,
    executorVerified: false,
    independentOutcomeObserverVerified: false,
    reason: reason
  };
}

async function inspect(store, productDomain, brain, refreshId, now) {
  try {
    if (!store || typeof store.assertDurable !== 'function') return held(productDomain, 'strict-store-required');
    store.assertDurable();
    if (!brain || !brain.state || !brain.motorAuthority) return held(productDomain, 'product-brain-motor-authority-missing');
    var draft = MotorReceipt.build(productDomain, brain.state, refreshId, now);
    var pair = await Capability.verifyPair(store, draft, now);
    if (!pair.ok) return Object.assign(held(productDomain, pair.reason), {
      ownerDomain: draft.ownerDomain,
      contractId: draft.contractId,
      lane: draft.lane
    });
    return {
      ok: true,
      productDomain: productDomain,
      ownerDomain: draft.ownerDomain,
      contractId: draft.contractId,
      lane: draft.lane,
      verified: true,
      executorVerified: true,
      independentOutcomeObserverVerified: true,
      executorCapabilityId: pair.executorCapabilityId,
      observerCapabilityId: pair.observerCapabilityId,
      executorEvidenceReceiptId: pair.executorEvidenceReceiptId,
      observerEvidenceReceiptId: pair.observerEvidenceReceiptId,
      reason: null
    };
  } catch (error) {
    return held(productDomain, 'capability-overlay-unavailable:' + String(error && error.message || error));
  }
}

async function apply(store, productDomain, brain, refreshId, now) {
  var result = await inspect(store, productDomain, brain, refreshId, now);
  if (brain && brain.motorAuthority) {
    // Always write both booleans. A stale positive must disappear immediately
    // when either short-lived capability expires or becomes unreadable.
    brain.motorAuthority.executorVerified = result.executorVerified === true;
    brain.motorAuthority.outcomeObserverVerified = result.independentOutcomeObserverVerified === true;
    if (brain.state && typeof brain._computeMotorReadiness === 'function') {
      brain._computeMotorReadiness();
    }
  }
  return result;
}

module.exports = { inspect: inspect, apply: apply };
