'use strict';

/**
 * Durable, non-executing motor-state receipt for one product domain brain.
 *
 * The product brain remains the authority source. This adapter accepts only
 * the state produced by that brain's resource and motor organs, preserves the
 * separate owner/contract/budget/receipt/outcome/rollback identities, and
 * performs a strict Redis write/read-back. It never dispatches the action.
 */

var crypto = require('node:crypto');

var SCHEMA = 'product-domain-motor-receipt/1.0';
var LOG_KEY = 'product_domain_motor_receipt_log';
var LOG_CAP = 1000;
var TTL_SECONDS = 7 * 86400;

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function fail(code) {
  var error = new Error(code);
  error.code = code;
  throw error;
}
function receiptKey(productDomain) {
  if (typeof productDomain !== 'string' || !/^[a-z][A-Za-z0-9]*$/.test(productDomain)) fail('PRODUCT_DOMAIN_INVALID');
  return 'product_domain_motor_receipt:' + productDomain;
}

function build(productDomain, state, refreshId, now) {
  state = state || {};
  var resource = state.resourceMetabolism;
  var motor = state.motorReadiness;
  if (!resource || resource.schemaVersion !== 'product-domain-resource-metabolism/1.0') fail('RESOURCE_METABOLISM_MISSING');
  if (!motor || motor.schemaVersion !== 'product-domain-motor-readiness/1.0') fail('MOTOR_READINESS_MISSING');
  if (!resource.ownerDomain || motor.ownerDomain !== resource.ownerDomain) fail('MOTOR_RESOURCE_OWNER_MISMATCH');
  if (!motor.contractId || !motor.lane) fail('MOTOR_IDENTITY_MISSING');
  var contracts = motor.contracts || {};
  ['decision', 'budget', 'receipt', 'independentOutcome', 'rollback'].forEach(function (name) {
    if (typeof contracts[name] !== 'string' || !contracts[name]) fail('MOTOR_CONTRACT_' + name.toUpperCase() + '_MISSING');
  });
  if (typeof refreshId !== 'string' || !refreshId) fail('REFRESH_ID_MISSING');
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  var gates = motor.gates || {};
  var verification = motor.verification || {};
  var dispatchReady = gates.mayDispatchExternal === true;
  var identity = {
    productDomain: productDomain,
    ownerDomain: motor.ownerDomain,
    contractId: motor.contractId,
    lane: motor.lane,
    refreshId: refreshId,
    measuredAt: motor.measuredAt || at
  };
  return {
    schemaVersion: SCHEMA,
    receiptId: 'pdmr_' + hash(identity).slice(0, 24),
    productDomain: productDomain,
    ownerDomain: motor.ownerDomain,
    contractId: motor.contractId,
    lane: motor.lane,
    refreshId: refreshId,
    status: dispatchReady ? 'EXECUTOR_PENDING' : 'HELD',
    resourceState: resource.state || null,
    contracts: clone(contracts),
    verification: {
      executorVerified: verification.executorVerified === true,
      independentOutcomeObserverVerified: verification.independentOutcomeObserverVerified === true
    },
    gates: {
      mayPrepare: gates.mayPrepare === true,
      maySimulate: gates.maySimulate === true,
      mayDispatchExternal: dispatchReady
    },
    blockers: Array.isArray(motor.blockers) ? motor.blockers.slice() : [],
    safety: {
      externalEffectExecuted: false,
      providerCalled: false,
      brokerTouched: false,
      spendUsd: 0,
      note: 'readiness receipt only; an executor receipt is independently required'
    },
    measuredAt: motor.measuredAt || at,
    persistedAt: at
  };
}

async function persist(store, productDomain, state, refreshId, now) {
  try {
    if (!store || typeof store.assertDurable !== 'function') fail('STRICT_STORE_REQUIRED');
    store.assertDurable();
    var receipt = build(productDomain, state, refreshId, now);
    var key = receiptKey(productDomain);
    await store.set(key, receipt, TTL_SECONDS);
    var restored = await store.get(key);
    if (!restored || restored.schemaVersion !== SCHEMA || restored.receiptId !== receipt.receiptId) {
      fail('MOTOR_RECEIPT_READBACK_FAILED');
    }
    await store.lpush(LOG_KEY, {
      receiptId: receipt.receiptId,
      productDomain: productDomain,
      ownerDomain: receipt.ownerDomain,
      contractId: receipt.contractId,
      lane: receipt.lane,
      status: receipt.status,
      persistedAt: receipt.persistedAt
    });
    await store.ltrim(LOG_KEY, 0, LOG_CAP - 1);
    return { ok: true, restored: true, key: key, receipt: restored };
  } catch (error) {
    return {
      ok: false,
      restored: false,
      productDomain: productDomain || null,
      error: error && error.code || 'PRODUCT_DOMAIN_MOTOR_RECEIPT_FAILED',
      detail: String(error && error.message || error)
    };
  }
}

module.exports = {
  SCHEMA: SCHEMA,
  LOG_KEY: LOG_KEY,
  LOG_CAP: LOG_CAP,
  TTL_SECONDS: TTL_SECONDS,
  receiptKey: receiptKey,
  build: build,
  persist: persist
};
