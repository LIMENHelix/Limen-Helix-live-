'use strict';

/**
 * Fail-closed production authorization from a restored product-domain motor
 * receipt. Cron/admin authentication permits evaluation only; it is not a
 * substitute for the owning brain's fresh external-action decision.
 */

var receiptContract = require('./product-domain-motor-receipt.js');

var MAX_AGE_MS = 45 * 60 * 1000;

function held(reason, receipt) {
  return {
    ok: true,
    authorized: false,
    status: 'HELD',
    reason: reason,
    receiptId: receipt && receipt.receiptId || null,
    ownerDomain: receipt && receipt.ownerDomain || null,
    lane: receipt && receipt.lane || null,
    blockers: receipt && Array.isArray(receipt.blockers) ? receipt.blockers.slice() : []
  };
}

async function authorize(store, productDomain, lane, now) {
  try {
    if (!store || typeof store.assertDurable !== 'function') return held('strict-store-required');
    store.assertDurable();
    var receipt = await store.get(receiptContract.receiptKey(productDomain));
    if (!receipt) return held('domain-motor-receipt-missing');
    if (receipt.schemaVersion !== receiptContract.SCHEMA) return held('domain-motor-receipt-schema-invalid', receipt);
    if (receipt.productDomain !== productDomain) return held('product-domain-mismatch', receipt);
    if (receipt.lane !== lane) return held('motor-lane-mismatch', receipt);
    var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    var persistedAt = Number(receipt.persistedAt);
    if (!Number.isFinite(persistedAt) || at < persistedAt || at - persistedAt > MAX_AGE_MS) {
      return held('domain-motor-receipt-stale', receipt);
    }
    if (receipt.status !== 'EXECUTOR_PENDING') return held('domain-motor-not-external-ready', receipt);
    var verification = receipt.verification || {};
    if (verification.executorVerified !== true) return held('production-executor-unverified', receipt);
    if (verification.independentOutcomeObserverVerified !== true) return held('independent-outcome-observer-unverified', receipt);
    if (!receipt.gates || receipt.gates.mayDispatchExternal !== true) return held('external-dispatch-gate-closed', receipt);
    if (Array.isArray(receipt.blockers) && receipt.blockers.length) return held('domain-motor-blockers-present', receipt);
    var safety = receipt.safety || {};
    if (safety.externalEffectExecuted !== false || safety.providerCalled !== false ||
        safety.brokerTouched !== false || safety.spendUsd !== 0) {
      return held('pre-action-safety-state-invalid', receipt);
    }
    return {
      ok: true,
      authorized: true,
      status: 'AUTHORIZED',
      receiptId: receipt.receiptId,
      productDomain: productDomain,
      ownerDomain: receipt.ownerDomain,
      contractId: receipt.contractId,
      lane: lane,
      contracts: receipt.contracts,
      persistedAt: persistedAt
    };
  } catch (error) {
    return held('domain-motor-authorization-unavailable:' + String(error && error.message || error));
  }
}

module.exports = { MAX_AGE_MS: MAX_AGE_MS, authorize: authorize };
