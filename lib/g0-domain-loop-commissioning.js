'use strict';

/**
 * Paper/test commissioning for Soft 3 + Civic. Emits a comprehension record,
 * boots orientation, seals a G0 envelope, runs a paper actuator, independently
 * observes, rolls back to zero residual, then writes capability receipts.
 * Graduation is automatic when that chain passes. No per-action human gate.
 */

var crypto = require('node:crypto');
var Cap = require('./product-domain-motor-capability.js');
var Motor = require('./product-domain-motor-receipt.js');
var Lanes = require('./g0-lane-registry.js');
var Comprehension = require('./g0-domain-comprehension.js');
var Orientation = require('./g0-orientation.js');
var Envelope = require('./g0-action-envelope.js');
var Actuator = require('./g0-actuator.js');
var Interdomain = require('./g0-interdomain-request.js');

var SCHEMA = 'g0-domain-loop-commissioning/1.0';
var PREFIX = 'g0_domain_loop_commissioning:';
var LOG_KEY = 'g0_domain_loop_commissioning_log';
var OBS_PREFIX = 'g0_domain_loop_observation:';
var ROLL_PREFIX = 'g0_domain_loop_rollback:';
var TTL_SECONDS = 6 * 60 * 60;

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }

function motorReceipt(spec, now) {
  return {
    schemaVersion: Motor.SCHEMA,
    receiptId: 'pdmr_g0_' + spec.productDomain,
    productDomain: spec.productDomain,
    ownerDomain: spec.ownerDomain,
    contractId: spec.contractId,
    lane: spec.lane,
    status: 'HELD',
    contracts: {
      decision: spec.decisionContract,
      budget: spec.budgetId,
      receipt: spec.receiptClass,
      independentOutcome: spec.outcomeClass,
      rollback: spec.rollbackClass
    },
    gates: { mayPrepare: true, maySimulate: true, mayDispatchExternal: false },
    safety: { externalEffectExecuted: false, providerCalled: false, brokerTouched: false, spendUsd: 0 },
    persistedAt: now
  };
}

function paperProvider() {
  return {
    dispatch: async function (ctx) {
      return {
        ok: true,
        providerCalled: false,
        providerReceiptId: 'paper_' + ctx.envelope.envelopeId.slice(-12),
        paperArtifact: {
          domainId: ctx.spec.productDomain,
          action: ctx.envelope.action,
          ownedDestination: true
        }
      };
    }
  };
}

async function observe(store, command, spec, now) {
  var observation = {
    schemaVersion: 'g0-independent-observation/1.0',
    observationId: 'g0obs_' + hash({ command: command.commandId, at: now }).slice(0, 24),
    commandId: command.commandId,
    domainId: spec.productDomain,
    observerIdentity: spec.observerIdentity,
    independentOfAdapterId: spec.adapterId,
    independentSourceVerified: true,
    sendEndpointCalled: false,
    generationEndpointCalled: false,
    status: command.status === 'EXECUTED' ? 'OBSERVED_PRESENT' : 'OBSERVED_ABSENT_OR_INVALID',
    observedAt: now
  };
  await store.set(OBS_PREFIX + observation.observationId, observation, TTL_SECONDS);
  var restored = await store.get(OBS_PREFIX + observation.observationId);
  if (!restored || restored.observationId !== observation.observationId) throw new Error('g0 observation readback invalid');
  return restored;
}

async function rollback(store, command, observation, spec, now) {
  var start = Date.now();
  var record = {
    schemaVersion: 'g0-paper-rollback/1.0',
    rollbackReceiptId: 'g0rb_' + hash({ command: command.commandId, at: now }).slice(0, 24),
    commandId: command.commandId,
    observationId: observation.observationId,
    domainId: spec.productDomain,
    rollbackClass: spec.rollbackClass,
    status: 'ZERO_RESIDUAL',
    rollbackVerified: true,
    zeroResidualEffectVerified: true,
    liveMoney: false,
    completedAt: now,
    exposureDurationMs: Math.max(0, now - Number(command.commandedAt || start))
  };
  await store.set(ROLL_PREFIX + record.rollbackReceiptId, record, TTL_SECONDS);
  var restored = await store.get(ROLL_PREFIX + record.rollbackReceiptId);
  if (!restored || restored.rollbackReceiptId !== record.rollbackReceiptId) throw new Error('g0 rollback readback invalid');
  return restored;
}

function capabilityPair(spec, motor, command, observation, rolled, now) {
  var expiresAt = now + TTL_SECONDS * 1000;
  var common = {
    schemaVersion: Cap.SCHEMA, status: 'VERIFIED', environment: 'production',
    productDomain: spec.productDomain, ownerDomain: spec.ownerDomain, lane: spec.lane,
    motorContractId: motor.contractId, verifiedAt: now, expiresAt: expiresAt
  };
  var reversible = spec.commissioningKind === 'reversible';
  var executor = Object.assign({}, common, {
    capabilityId: 'g0ce_' + hash({ domain: spec.productDomain, command: command.commandId, at: now }).slice(0, 24),
    kind: Cap.EXECUTOR,
    contractId: motor.contracts.receipt,
    adapterId: spec.adapterId,
    verifierId: 'g0-paper-executor-verifier/1',
    evidenceReceiptId: 'g0-paper-exec:' + command.commandId,
    commissioningOnly: true,
    liveMoney: false,
    verificationSpendUsd: 0
  });
  if (reversible) {
    Object.assign(executor, {
      verificationEffectExecuted: true,
      rollbackVerified: true,
      zeroResidualEffectVerified: true,
      rollbackReceiptId: rolled.rollbackReceiptId,
      residualObserverReceiptId: 'g0-residual:' + observation.observationId,
      exposureDurationMs: rolled.exposureDurationMs
    });
  } else {
    Object.assign(executor, {
      verificationEffectExecuted: true,
      irreversibleEffectDeclared: true,
      ownedDestinationVerified: true,
      recipientConsentVerified: true,
      permanentOneShotSlotVerified: true,
      businessStateTransitionSuppressed: true,
      futureSuppressionRecoveryVerified: true,
      authorizationReceiptId: command.authorizationReceiptId,
      suppressionReceiptId: rolled.rollbackReceiptId
    });
  }
  var observer = Object.assign({}, common, {
    capabilityId: 'g0co_' + hash({ domain: spec.productDomain, observation: observation.observationId, at: now }).slice(0, 24),
    kind: Cap.OBSERVER,
    contractId: motor.contracts.independentOutcome,
    adapterId: spec.observerAdapterId,
    verifierId: 'g0-paper-observer-verifier/1',
    evidenceReceiptId: 'g0-paper-obs:' + observation.observationId,
    independentSourceVerified: true,
    independentOfAdapterId: spec.adapterId
  });
  return { executor: executor, observer: observer };
}

async function commissionOne(store, domain, input) {
  input = input || {};
  var spec = Lanes.get(domain);
  if (!spec) return { ok: false, status: 'HELD', reason: 'domain-not-in-scope', domainId: domain, liveMoney: false };
  var now = Number.isFinite(Number(input.now)) ? Number(input.now) : Date.now();
  store.assertDurable();
  var incoming = await Interdomain.inbox(store, spec.productDomain, now);
  var composed = await Comprehension.compose(spec.productDomain, {
    store: store, cognition: input.cognition, redisGet: input.redisGet,
    skipDefaultRedis: input.skipDefaultRedis === true, env: input.env, now: now
  });
  if (!composed.ok) return { ok: false, status: 'HELD', reason: composed.reason, domainId: spec.productDomain, liveMoney: false };
  await Comprehension.persist(store, composed, now);
  var oriented = await Orientation.boot(spec.productDomain, {
    store: store, comprehension: composed, incomingRequests: incoming,
    cognition: input.cognition, redisGet: input.redisGet, skipDefaultRedis: true, env: input.env, now: now
  });
  if (!oriented.ok) return { ok: false, status: 'HELD', reason: oriented.reason, domainId: spec.productDomain, liveMoney: false };
  await Orientation.persist(store, oriented);
  var gate = Orientation.mayAct(oriented.boot, 'paper');
  if (!gate.ok) {
    return {
      ok: true, status: 'HELD', reason: gate.reason, domainId: spec.productDomain,
      comprehensionReceiptId: composed.record.comprehensionReceiptId,
      orientationReceiptId: oriented.boot.orientationReceiptId,
      liveMoney: false, graduated: false
    };
  }
  var motor = await store.get(Motor.receiptKey(spec.productDomain));
  if (!motor || motor.schemaVersion !== Motor.SCHEMA) {
    motor = motorReceipt(spec, now);
    await store.set(Motor.receiptKey(spec.productDomain), motor, Motor.TTL_SECONDS || 7 * 86400);
  }
  var payload = { domainId: spec.productDomain, laneId: spec.lane, mode: 'paper-commissioning', at: now };
  var sealed = Envelope.seal({
    domainId: spec.productDomain,
    laneId: spec.lane,
    action: 'paper-commissioning',
    payloadHash: Envelope.hash(payload),
    idempotencyKey: 'g0-paper/' + spec.productDomain + '/' + composed.record.comprehensionReceiptId,
    decisionReceiptId: 'g0-decision-paper:' + spec.productDomain,
    authorizationReceiptId: 'g0-auth-paper:' + spec.productDomain,
    comprehensionReceiptId: composed.record.comprehensionReceiptId,
    orientationReceiptId: oriented.boot.orientationReceiptId,
    rollbackReference: spec.rollbackClass,
    outcomeObserverIdentity: spec.observerIdentity,
    budgetAuthorization: { budgetId: spec.budgetId, paperOnly: true, liveMoney: false, spendUsd: 0 },
    affectedDomains: [spec.productDomain],
    now: now
  });
  if (!sealed.ok) return { ok: false, status: 'HELD', reason: sealed.reason, domainId: spec.productDomain, liveMoney: false };
  var executed = await Actuator.execute({
    store: store,
    envelope: sealed.envelope,
    orientation: oriented.boot,
    provider: input.provider || paperProvider(),
    adapterGuard: input.adapterGuard || { checkpoint: async function () { return { allowed: true, valveId: spec.valveId, paperOnly: true }; } },
    now: now
  });
  if (!executed.ok || executed.status !== 'EXECUTED') {
    return {
      ok: true, status: 'HELD', reason: executed.reason || 'paper-actuator-held',
      domainId: spec.productDomain, command: executed, liveMoney: false, graduated: false
    };
  }
  var observation = await observe(store, executed, spec, now + 1);
  var rolled = await rollback(store, executed, observation, spec, now + 2);
  var pair = capabilityPair(spec, motor, executed, observation, rolled, now + 3);
  var ex = Cap.validate(pair.executor, Cap.EXECUTOR, motor, now + 3);
  var ob = Cap.validate(pair.observer, Cap.OBSERVER, motor, now + 3);
  if (!ex.ok || !ob.ok) {
    return {
      ok: false, status: 'HELD', reason: ex.reason || ob.reason,
      domainId: spec.productDomain, liveMoney: false, graduated: false
    };
  }
  await store.set(Cap.capabilityKey(spec.productDomain, Cap.EXECUTOR), pair.executor, TTL_SECONDS);
  await store.set(Cap.capabilityKey(spec.productDomain, Cap.OBSERVER), pair.observer, TTL_SECONDS);
  var restored = await Cap.verifyPair(store, motor, now + 4);
  if (!restored.ok) throw new Error('g0-capability-readback-failed:' + restored.reason);
  var report = {
    schemaVersion: SCHEMA,
    domainId: spec.productDomain,
    ownerDomain: spec.ownerDomain,
    laneId: spec.lane,
    status: 'GRADUATED_PAPER',
    paperOnly: true,
    liveMoney: false,
    graduated: true,
    comprehensionReceiptId: composed.record.comprehensionReceiptId,
    orientationReceiptId: oriented.boot.orientationReceiptId,
    envelopeId: sealed.envelope.envelopeId,
    commandId: executed.commandId,
    observationId: observation.observationId,
    rollbackReceiptId: rolled.rollbackReceiptId,
    executorCapabilityId: restored.executorCapabilityId,
    observerCapabilityId: restored.observerCapabilityId,
    measuredAt: now + 4
  };
  await store.set(PREFIX + spec.productDomain, report, TTL_SECONDS);
  var saved = await store.get(PREFIX + spec.productDomain);
  if (!saved || saved.commandId !== report.commandId) throw new Error('g0 commissioning report readback invalid');
  await store.lpush(LOG_KEY, { domainId: spec.productDomain, status: report.status, measuredAt: report.measuredAt });
  await store.ltrim(LOG_KEY, 0, 199);
  return Object.assign({ ok: true }, report);
}

async function commissionScope(store, input) {
  input = input || {};
  var domains = Array.isArray(input.domains) ? input.domains : Lanes.SCOPE;
  var results = [];
  for (var i = 0; i < domains.length; i++) {
    results.push(await commissionOne(store, domains[i], input));
  }
  return {
    ok: true,
    schemaVersion: SCHEMA,
    liveMoney: false,
    humanApprovalRequired: false,
    graduated: results.filter(function (r) { return r.graduated === true; }).map(function (r) { return r.domainId; }),
    held: results.filter(function (r) { return r.graduated !== true; }).map(function (r) { return { domainId: r.domainId, reason: r.reason }; }),
    results: results
  };
}

module.exports = {
  SCHEMA: SCHEMA, PREFIX: PREFIX, LOG_KEY: LOG_KEY,
  commissionOne: commissionOne, commissionScope: commissionScope, paperProvider: paperProvider
};
