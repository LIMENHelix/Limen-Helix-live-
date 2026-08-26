'use strict';

/**
 * One-attempt bootstrap authority for the Science and Medicine paper pilots.
 *
 * The mature product-motor gate requires production executor and independent
 * observer evidence. Those receipts cannot exist before the first internal
 * research artifact exists. This boundary breaks only that circularity: each
 * owning product brain gets one separately switched, permanently claimed paid
 * generation attempt. It cannot publish, send, sell, or authorize another
 * domain, and it never upgrades the mature capability gate.
 */

var crypto = require('node:crypto');
var MotorReceipt = require('./product-domain-motor-receipt.js');
var MotorAuthorization = require('./product-domain-motor-authorization.js');

var SCHEMA = 'research-paper-developmental-authority/1.0';
var LOG_KEY = 'research_paper_developmental_log';
var SLOT_PREFIX = 'research_paper_developmental_slot:';
var LOG_CAP = 100;
var MAX_PROVIDER_CALLS = 1;
var MAX_ARTIFACTS = 1;
var ESTIMATED_CALL_BUDGET_USD = 0.30;
var OWNERS = {
  science: {
    productDomain: 'science', ownerDomain: 'research', contractId: 'science-motor/1',
    lane: 'research-papers', budgetId: 'science-research-budget/1',
    switchName: 'LIMEN_SCIENCE_RESEARCH_DEVELOPMENTAL_ENABLED'
  },
  medicine: {
    productDomain: 'medicine', ownerDomain: 'health', contractId: 'medicine-motor/1',
    lane: 'research-papers', budgetId: 'medicine-research-budget/1',
    switchName: 'LIMEN_MEDICINE_RESEARCH_DEVELOPMENTAL_ENABLED'
  }
};

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function slotKey(productDomain) { return SLOT_PREFIX + String(productDomain || ''); }
function receiptId(productDomain, selectionId) {
  return 'research_dev_' + crypto.createHash('sha256')
    .update(productDomain + '\u0000' + selectionId).digest('hex').slice(0, 24);
}
function held(reason, detail) {
  return { ok: true, authorized: false, status: 'HELD', reason: reason, detail: clone(detail || null) };
}
function enabled(identity, env) {
  return !!identity && String((env || process.env)[identity.switchName] || '') === '1';
}
function validSelection(selection, identity) {
  return selection && selection.status === 'RELEASED' && selection.lane === 'research' &&
    selection.command === 'generate_research_artifact' && selection.ownerDomain === identity.ownerDomain &&
    selection.authority && selection.authority.artifactGenerationOnly === true &&
    selection.authority.liveTradingAuthorized === false && selection.candidate &&
    selection.candidate.sourceIdentity && typeof selection.candidate.sourceIdentity.kind === 'string' &&
    typeof selection.candidate.sourceIdentity.value === 'string';
}
function validMotor(motor, identity, now) {
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  return motor && motor.schemaVersion === MotorReceipt.SCHEMA &&
    motor.productDomain === identity.productDomain && motor.ownerDomain === identity.ownerDomain &&
    motor.contractId === identity.contractId && motor.lane === identity.lane &&
    motor.contracts && motor.contracts.decision === 'research-artifact-decision/1' &&
    motor.contracts.budget === identity.budgetId && motor.contracts.receipt === 'artifact-receipt' &&
    motor.contracts.independentOutcome === 'citation-use-or-falsification' &&
    motor.contracts.rollback === 'withdraw-or-correct' &&
    motor.status === 'HELD' && Number.isFinite(Number(motor.persistedAt)) &&
    at >= Number(motor.persistedAt) && at - Number(motor.persistedAt) <= MotorAuthorization.MAX_AGE_MS &&
    motor.gates && motor.gates.mayPrepare === true && motor.gates.maySimulate === true &&
    motor.gates.mayDispatchExternal === false && motor.safety &&
    motor.safety.externalEffectExecuted === false && motor.safety.providerCalled === false &&
    motor.safety.brokerTouched === false && Number(motor.safety.spendUsd) === 0;
}
async function log(store, row) {
  await store.lpush(LOG_KEY, row);
  await store.ltrim(LOG_KEY, 0, LOG_CAP - 1);
}

async function authorize(store, productDomain, selection, env, now) {
  var identity = OWNERS[productDomain];
  if (!identity) return held('research-developmental-owner-invalid');
  if (!enabled(identity, env)) return held('research-developmental-switch-off');
  try {
    store.assertDurable();
    if (!validSelection(selection, identity)) return held('research-developmental-selection-invalid');
    var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    var motor = await store.get(MotorReceipt.receiptKey(productDomain));
    if (!validMotor(motor, identity, at)) return held('research-developmental-motor-receipt-invalid', motor);
    var slot = {
      schemaVersion: SCHEMA,
      receiptId: receiptId(productDomain, selection.id),
      productDomain: identity.productDomain,
      ownerDomain: identity.ownerDomain,
      contractId: identity.contractId,
      lane: identity.lane,
      budgetId: identity.budgetId,
      selectionId: selection.id,
      sourceIdentity: clone(selection.candidate.sourceIdentity),
      productMotorReceiptId: motor.receiptId,
      status: 'CLAIMED',
      claimedAt: new Date(at).toISOString(),
      maxProviderCalls: MAX_PROVIDER_CALLS,
      maxArtifacts: MAX_ARTIFACTS,
      estimatedCallBudgetUsd: ESTIMATED_CALL_BUDGET_USD,
      artifactGenerationOnly: true,
      publicationAuthorized: false,
      saleAuthorized: false,
      paperOnly: true,
      liveMoney: false
    };
    var created = await store.setIfAbsent(slotKey(productDomain), slot);
    if (!created) return held('research-developmental-attempt-cap-reached', await store.get(slotKey(productDomain)));
    var restored = await store.get(slotKey(productDomain));
    if (!restored || restored.schemaVersion !== SCHEMA || restored.receiptId !== slot.receiptId ||
        restored.status !== 'CLAIMED') {
      return held('research-developmental-claim-readback-failed');
    }
    await log(store, {
      type: 'CLAIMED', receiptId: slot.receiptId, productDomain: productDomain,
      ownerDomain: identity.ownerDomain, selectionId: selection.id, at: slot.claimedAt
    });
    return {
      ok: true,
      authorized: true,
      status: 'AUTHORIZED_DEVELOPMENTAL_PAPER',
      authorizationMode: 'developmental-research-paper',
      receiptId: slot.receiptId,
      productDomain: identity.productDomain,
      ownerDomain: identity.ownerDomain,
      contractId: identity.contractId,
      lane: identity.lane,
      slot: restored,
      paperOnly: true,
      publicationAuthorized: false,
      liveMoney: false
    };
  } catch (error) {
    return held('research-developmental-authorization-unavailable', {
      error: String(error && error.message || error)
    });
  }
}

async function resolve(store, authorization, result, motor) {
  if (!authorization || authorization.authorizationMode !== 'developmental-research-paper' ||
      !authorization.authorized || !OWNERS[authorization.productDomain]) {
    throw new Error('research-developmental-resolution-authorization-invalid');
  }
  store.assertDurable();
  var key = slotKey(authorization.productDomain);
  var slot = await store.get(key);
  if (!slot || slot.schemaVersion !== SCHEMA || slot.receiptId !== authorization.receiptId ||
      slot.selectionId !== authorization.slot.selectionId || slot.status !== 'CLAIMED') {
    throw new Error('research-developmental-resolution-claim-invalid');
  }
  var succeeded = result && result.ok === true && typeof result.outputId === 'string' && result.outputId;
  slot.status = succeeded ? 'ARTIFACT_PERSISTED' : 'ATTEMPT_RESOLVED_NO_ARTIFACT';
  slot.resolvedAt = new Date().toISOString();
  slot.providerCalled = !!(result && result.billableAttempt);
  slot.budgetDebitEstimateUsd = slot.providerCalled ? ESTIMATED_CALL_BUDGET_USD : 0;
  slot.outputId = succeeded ? result.outputId : null;
  slot.actionId = result && result.actionId || null;
  slot.efferenceCopyId = result && result.efferenceCopyId || null;
  slot.motorStatus = motor && motor.status || result && result.motorStatus || null;
  slot.resultReason = result && result.reason || null;
  slot.externalPublication = false;
  slot.liveMoney = false;
  await store.set(key, slot);
  var restored = await store.get(key);
  if (!restored || restored.receiptId !== slot.receiptId || restored.status !== slot.status ||
      restored.outputId !== slot.outputId) {
    throw new Error('research-developmental-resolution-readback-failed');
  }
  await log(store, {
    type: restored.status, receiptId: restored.receiptId, productDomain: restored.productDomain,
    ownerDomain: restored.ownerDomain, selectionId: restored.selectionId,
    outputId: restored.outputId, providerCalled: restored.providerCalled, at: restored.resolvedAt
  });
  return restored;
}

module.exports = {
  SCHEMA: SCHEMA,
  LOG_KEY: LOG_KEY,
  SLOT_PREFIX: SLOT_PREFIX,
  OWNERS: OWNERS,
  MAX_PROVIDER_CALLS: MAX_PROVIDER_CALLS,
  MAX_ARTIFACTS: MAX_ARTIFACTS,
  ESTIMATED_CALL_BUDGET_USD: ESTIMATED_CALL_BUDGET_USD,
  slotKey: slotKey,
  enabled: enabled,
  validSelection: validSelection,
  validMotor: validMotor,
  authorize: authorize,
  resolve: resolve
};
