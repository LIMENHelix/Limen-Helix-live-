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
var MAX_REVERSIBLE_COMMISSIONING_EXPOSURE_MS = 5 * 60 * 1000;
var MAX_OWNED_DESTINATION_COMMISSIONING_SPEND_USD = 0.01;

function capabilityKey(productDomain, kind) {
  if (typeof productDomain !== 'string' || !/^[a-z][A-Za-z0-9]*$/.test(productDomain)) {
    throw new Error('PRODUCT_DOMAIN_INVALID');
  }
  if (kind !== EXECUTOR && kind !== OBSERVER) throw new Error('CAPABILITY_KIND_INVALID');
  return 'product_domain_motor_capability:' + productDomain + ':' + kind;
}

function text(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }

/**
 * Some effectors cannot be tested through a provider preview. A publication,
 * message, CRM mutation, or marketplace listing has to exist briefly before an
 * independent read can prove that the provider accepted it and a second read
 * can prove that rollback removed it. Treat that as commissioning evidence only
 * when the complete action -> observation -> recovery -> zero-residual chain is
 * named. A successful create call by itself never qualifies.
 */
function reversibleCommissioningVerified(receipt) {
  var exposure = Number(receipt && receipt.exposureDurationMs);
  return !!(receipt &&
    receipt.verificationEffectExecuted === true &&
    receipt.commissioningOnly === true &&
    receipt.liveMoney === false &&
    receipt.rollbackVerified === true &&
    receipt.zeroResidualEffectVerified === true &&
    Number(receipt.verificationSpendUsd) === 0 &&
    Number.isFinite(exposure) && exposure >= 0 &&
    exposure <= MAX_REVERSIBLE_COMMISSIONING_EXPOSURE_MS &&
    text(receipt.rollbackReceiptId) &&
    text(receipt.residualObserverReceiptId) &&
    receipt.rollbackReceiptId !== receipt.evidenceReceiptId &&
    receipt.residualObserverReceiptId !== receipt.evidenceReceiptId &&
    receipt.residualObserverReceiptId !== receipt.rollbackReceiptId);
}

/**
 * Some effects are intrinsically irreversible. An email that has been accepted
 * by a mail provider cannot honestly be "rolled back" after delivery. A single
 * owned-destination commissioning action can still prove the executor when the
 * destination and consent are verified before dispatch, one permanent slot is
 * consumed, no business-state transition is applied, and future delivery to the
 * address is durably suppressed. The independent observer remains a separate
 * receipt and verifier under verifyPair().
 */
function boundedIrreversibleCommissioningVerified(receipt) {
  var spend = Number(receipt && receipt.verificationSpendUsd);
  return !!(receipt &&
    receipt.verificationEffectExecuted === true &&
    receipt.commissioningOnly === true &&
    receipt.irreversibleEffectDeclared === true &&
    receipt.liveMoney === false &&
    Number.isFinite(spend) && spend >= 0 && spend <= MAX_OWNED_DESTINATION_COMMISSIONING_SPEND_USD &&
    receipt.ownedDestinationVerified === true &&
    receipt.recipientConsentVerified === true &&
    receipt.permanentOneShotSlotVerified === true &&
    receipt.businessStateTransitionSuppressed === true &&
    receipt.futureSuppressionRecoveryVerified === true &&
    text(receipt.authorizationReceiptId) &&
    text(receipt.suppressionReceiptId) &&
    receipt.authorizationReceiptId !== receipt.evidenceReceiptId &&
    receipt.suppressionReceiptId !== receipt.evidenceReceiptId);
}

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
    var zeroEffect = receipt.rollbackVerified === true &&
      receipt.verificationEffectExecuted === false &&
      Number(receipt.verificationSpendUsd) === 0;
    if (!zeroEffect && !reversibleCommissioningVerified(receipt) &&
        !boundedIrreversibleCommissioningVerified(receipt)) {
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
  MAX_REVERSIBLE_COMMISSIONING_EXPOSURE_MS: MAX_REVERSIBLE_COMMISSIONING_EXPOSURE_MS,
  MAX_OWNED_DESTINATION_COMMISSIONING_SPEND_USD: MAX_OWNED_DESTINATION_COMMISSIONING_SPEND_USD,
  capabilityKey: capabilityKey,
  reversibleCommissioningVerified: reversibleCommissioningVerified,
  boundedIrreversibleCommissioningVerified: boundedIrreversibleCommissioningVerified,
  validate: validate,
  verifyPair: verifyPair
};
