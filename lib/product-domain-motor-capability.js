'use strict';

/**
 * Independent production-capability evidence for one product-domain motor.
 *
 * A product brain may declare its executor and observer ready, but that
 * declaration is not proof. Authorization also reads two separately persisted
 * capability receipts: one for the executor and one for the independent world
 * outcome observer. This module validates those receipts against the exact
 * product domain, runtime owner, lane, motor contract, and receipt/outcome
 * contracts named by the brain's current motor receipt.
 *
 * This module has no writer and no actuator. A future lane-specific verifier
 * must produce these records from measured production evidence.
 */

var SCHEMA = 'product-domain-motor-capability/1.0';
var EXECUTOR = 'executor';
var OBSERVER = 'independent-outcome-observer';

function capabilityKey(productDomain, kind) {
  if (typeof productDomain !== 'string' || !/^[a-z][A-Za-z0-9]*$/.test(productDomain)) {
    throw new Error('PRODUCT_DOMAIN_INVALID');
  }
  if (kind !== EXECUTOR && kind !== OBSERVER) throw new Error('CAPABILITY_KIND_INVALID');
  return 'product_domain_motor_capability:' + productDomain + ':' + kind;
}

function text(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }

function validate(receipt, kind, motorReceipt, now) {
  if (!receipt) return { ok: false, reason: kind === EXECUTOR ? 'domain-executor-capability-missing' : 'domain-outcome-observer-capability-missing' };
  if (receipt.schemaVersion !== SCHEMA || receipt.kind !== kind || receipt.status !== 'VERIFIED') {
    return { ok: false, reason: kind === EXECUTOR ? 'domain-executor-capability-invalid' : 'domain-outcome-observer-capability-invalid' };
  }
  if (receipt.environment !== 'production') return { ok: false, reason: 'domain-capability-not-production' };
  if (receipt.productDomain !== motorReceipt.productDomain || receipt.ownerDomain !== motorReceipt.ownerDomain ||
      receipt.lane !== motorReceipt.lane || receipt.motorContractId !== motorReceipt.contractId) {
    return { ok: false, reason: 'domain-capability-identity-mismatch' };
  }
  var expectedContract = kind === EXECUTOR ? motorReceipt.contracts.receipt : motorReceipt.contracts.independentOutcome;
  if (receipt.contractId !== expectedContract) return { ok: false, reason: 'domain-capability-contract-mismatch' };
  if (!text(receipt.capabilityId) || !text(receipt.adapterId) || !text(receipt.verifierId) ||
      !text(receipt.evidenceReceiptId)) {
    return { ok: false, reason: 'domain-capability-evidence-incomplete' };
  }
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  var verifiedAt = Number(receipt.verifiedAt);
  var expiresAt = Number(receipt.expiresAt);
  if (!Number.isFinite(verifiedAt) || !Number.isFinite(expiresAt) || verifiedAt > at || expiresAt <= at || expiresAt <= verifiedAt) {
    return { ok: false, reason: 'domain-capability-stale' };
  }
  if (kind === EXECUTOR) {
    if (receipt.rollbackVerified !== true || receipt.verificationEffectExecuted !== false ||
        Number(receipt.verificationSpendUsd) !== 0) {
      return { ok: false, reason: 'domain-executor-capability-unsafe' };
    }
  } else if (receipt.independentSourceVerified !== true) {
    return { ok: false, reason: 'domain-outcome-observer-not-independent' };
  }
  return { ok: true, receipt: receipt };
}

async function verifyPair(store, motorReceipt, now) {
  var executor = await store.get(capabilityKey(motorReceipt.productDomain, EXECUTOR));
  var ex = validate(executor, EXECUTOR, motorReceipt, now);
  if (!ex.ok) return ex;
  var observer = await store.get(capabilityKey(motorReceipt.productDomain, OBSERVER));
  var ob = validate(observer, OBSERVER, motorReceipt, now);
  if (!ob.ok) return ob;
  if (executor.capabilityId === observer.capabilityId || executor.evidenceReceiptId === observer.evidenceReceiptId ||
      executor.verifierId === observer.verifierId) {
    return { ok: false, reason: 'domain-outcome-observer-not-independent' };
  }
  if (observer.independentOfAdapterId !== executor.adapterId) {
    return { ok: false, reason: 'domain-outcome-observer-executor-link-missing' };
  }
  return {
    ok: true,
    executorCapabilityId: executor.capabilityId,
    observerCapabilityId: observer.capabilityId,
    executorEvidenceReceiptId: executor.evidenceReceiptId,
    observerEvidenceReceiptId: observer.evidenceReceiptId
  };
}

module.exports = {
  SCHEMA: SCHEMA,
  EXECUTOR: EXECUTOR,
  OBSERVER: OBSERVER,
  capabilityKey: capabilityKey,
  validate: validate,
  verifyPair: verifyPair
};
