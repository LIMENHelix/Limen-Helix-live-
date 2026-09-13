'use strict';

/**
 * Shared G0 action envelope. G0 verifies this object; it does not decide what
 * to sell and it does not ask a human to approve each action.
 */

var crypto = require('node:crypto');

var SCHEMA = 'g0-action-envelope/1.0';
var MAX_AGE_MS = 10 * 60 * 1000;

function hash(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}
function text(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function finite(value) { var n = Number(value); return Number.isFinite(n) ? n : null; }

function seal(input) {
  input = input || {};
  var domainId = text(input.domainId);
  var laneId = text(input.laneId);
  var action = text(input.action);
  var payloadHash = text(input.payloadHash);
  var idempotencyKey = text(input.idempotencyKey);
  var decisionReceiptId = text(input.decisionReceiptId);
  var authorizationReceiptId = text(input.authorizationReceiptId);
  var comprehensionReceiptId = text(input.comprehensionReceiptId);
  var orientationReceiptId = text(input.orientationReceiptId);
  var rollbackReference = text(input.rollbackReference);
  var outcomeObserverIdentity = text(input.outcomeObserverIdentity);
  var now = finite(input.now) != null ? finite(input.now) : Date.now();
  var expiresAt = finite(input.authorityExpiresAt) != null ? finite(input.authorityExpiresAt) : now + MAX_AGE_MS;
  if (!domainId || !laneId || !action || !payloadHash || !idempotencyKey) {
    return { ok: false, reason: 'g0-envelope-identity-incomplete' };
  }
  if (!decisionReceiptId || !authorizationReceiptId || !comprehensionReceiptId || !orientationReceiptId) {
    return { ok: false, reason: 'g0-envelope-authority-incomplete' };
  }
  if (!rollbackReference || !outcomeObserverIdentity) {
    return { ok: false, reason: 'g0-envelope-observer-or-rollback-missing' };
  }
  if (!/^[a-f0-9]{64}$/.test(payloadHash)) return { ok: false, reason: 'g0-envelope-payload-hash-invalid' };
  if (expiresAt <= now) return { ok: false, reason: 'g0-envelope-authority-expired' };
  var budget = input.budgetAuthorization && typeof input.budgetAuthorization === 'object'
    ? {
      budgetId: text(input.budgetAuthorization.budgetId),
      paperOnly: input.budgetAuthorization.paperOnly === true,
      liveMoney: input.budgetAuthorization.liveMoney === true,
      spendUsd: Number(input.budgetAuthorization.spendUsd || 0)
    }
    : null;
  if (!budget || !budget.budgetId) return { ok: false, reason: 'g0-envelope-budget-missing' };
  if (budget.liveMoney === true) return { ok: false, reason: 'g0-envelope-live-money-refused' };
  if (!(budget.spendUsd >= 0) || !Number.isFinite(budget.spendUsd)) return { ok: false, reason: 'g0-envelope-budget-invalid' };
  var body = {
    schemaVersion: SCHEMA,
    domainId: domainId,
    laneId: laneId,
    decisionReceiptId: decisionReceiptId,
    authorizationReceiptId: authorizationReceiptId,
    comprehensionReceiptId: comprehensionReceiptId,
    orientationReceiptId: orientationReceiptId,
    action: action,
    payloadHash: payloadHash,
    budgetAuthorization: budget,
    idempotencyKey: idempotencyKey,
    authorityExpiresAt: expiresAt,
    rollbackReference: rollbackReference,
    outcomeObserverIdentity: outcomeObserverIdentity,
    affectedDomains: Array.isArray(input.affectedDomains) ? input.affectedDomains.slice() : [domainId],
    paperOnly: budget.paperOnly === true,
    liveMoney: false,
    sealedAt: now
  };
  body.envelopeId = 'g0e_' + hash(body).slice(0, 24);
  body.envelopeHash = hash(body);
  return { ok: true, envelope: body };
}

function verify(envelope, now) {
  var at = finite(now) != null ? finite(now) : Date.now();
  if (!envelope || envelope.schemaVersion !== SCHEMA) return { ok: false, reason: 'g0-envelope-schema-invalid' };
  var copy = Object.assign({}, envelope);
  var envelopeHash = copy.envelopeHash;
  delete copy.envelopeHash;
  if (hash(copy) !== envelopeHash) return { ok: false, reason: 'g0-envelope-hash-mismatch' };
  if (!text(envelope.envelopeId) || envelope.envelopeId !== copy.envelopeId) {
    return { ok: false, reason: 'g0-envelope-id-mismatch' };
  }
  var reseal = seal(Object.assign({}, envelope, { now: envelope.sealedAt, authorityExpiresAt: envelope.authorityExpiresAt }));
  if (!reseal.ok || reseal.envelope.envelopeId !== envelope.envelopeId) {
    return { ok: false, reason: reseal.reason || 'g0-envelope-reseal-failed' };
  }
  if (Number(envelope.authorityExpiresAt) <= at) return { ok: false, reason: 'g0-envelope-authority-expired' };
  if (envelope.liveMoney === true || envelope.budgetAuthorization.liveMoney === true) {
    return { ok: false, reason: 'g0-envelope-live-money-refused' };
  }
  return { ok: true, envelope: envelope };
}

module.exports = { SCHEMA: SCHEMA, MAX_AGE_MS: MAX_AGE_MS, hash: hash, seal: seal, verify: verify };
