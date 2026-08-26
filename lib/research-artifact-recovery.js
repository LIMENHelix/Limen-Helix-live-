'use strict';

/**
 * Domain-authorized recovery for Science/Medicine research artifacts.
 *
 * A negative evaluation remains an outcome. Only an explicitly structured,
 * source-separated publisher retraction can request withdrawal. The original
 * content is never deleted: recovery appends a history transition after a
 * durable command, verifies Redis readback, and records a durable receipt.
 */

var crypto = require('node:crypto');
var MotorAuthorization = require('./product-domain-motor-authorization.js');

var SCHEMA = 'research-artifact-recovery/1.0';
var LOG_KEY = 'research_artifact_recovery_log';
var ENGINE_LOG_KEY = 'engine_output_log';
var LOG_CAP = 1000;
var COMMAND_TIMEOUT_MS = 15 * 60 * 1000;
var OWNER = {
  science: { productDomain: 'science', ownerDomain: 'research', lane: 'research-papers' },
  medicine: { productDomain: 'medicine', ownerDomain: 'health', lane: 'research-papers' }
};

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function text(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function instant(value) { var n = Date.parse(value); return Number.isFinite(n) ? n : null; }
function identityKey(value) {
  return value && text(value.kind) && text(value.value)
    ? text(value.kind).toLowerCase() + ':' + text(value.value).toLowerCase() : null;
}
function commandKey(observationId) { return 'research_artifact_recovery:' + String(observationId); }
function artifactKey(outputId) { return 'engine_output:' + String(outputId); }
function efferenceId(actionId) {
  return text(actionId) && actionId.indexOf('act_') === 0 ? 'efx_' + actionId.slice(4) : null;
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function result(status, reason, extra) {
  return Object.assign({ ok: status !== 'FAILED' && status !== 'REFUSED', status: status, applied: status === 'WITHDRAWN', reason: reason || null }, extra || {});
}

function validateRetractionEvent(event, now, context) {
  if (!event || event.schemaVersion !== 'autofire-outcome-observation/1.0' ||
      event.eventType !== 'OUTCOME_RESEARCH_EVALUATED' || event.lane !== 'research' ||
      !OWNER[event.ownerDomain] || !text(event.outputId) || !text(event.actionId) ||
      !text(event.observationId) || !identityKey(event.sourceIdentity) || instant(event.observedAt) === null) {
    return { eligible: false, reason: 'research-evaluation-identity-invalid' };
  }
  var data = event.outcomeData || {};
  var retractions = Array.isArray(data.retractions) ? data.retractions : [];
  if (!retractions.length) return { eligible: false, reason: 'no-explicit-retraction-evidence' };
  if (data.progress !== 'REGRESSION') return { eligible: false, reason: 'retraction-without-regression-classification' };
  var observedAt = instant(event.observedAt);
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  var evaluatorKey = identityKey(event.sourceIdentity);
  var admitted = context && Array.isArray(context.evidenceRecords) ? context.evidenceRecords : [];
  if (identityKey(context && context.evaluatorIdentity) !== evaluatorKey || admitted.length < 2) {
    return { eligible: false, reason: 'explicit-retraction-evidence-invalid' };
  }
  var admittedById = Object.create(null);
  admitted.forEach(function (row) {
    if (row && text(row.id) && identityKey(row.sourceIdentity) && instant(row.retrievedAt) !== null) admittedById[row.id] = row;
  });
  var ids = Object.create(null);
  var sources = Object.create(null);
  for (var i = 0; i < retractions.length; i++) {
    var row = retractions[i] || {};
    var source = row.sourceIdentity || {};
    var sourceKey = identityKey(source);
    var admittedEvidence = text(row.evidenceId) ? admittedById[row.evidenceId] : null;
    var retractedAt = instant(row.retractedAt);
    var retrievedAt = instant(source.retrievedAt);
    if (!text(row.retractionId) || !text(row.evidenceId) || !text(row.publicationId) || !text(row.reason) ||
        !sourceKey || sourceKey === evaluatorKey || !text(source.publisher) ||
        !text(source.url) || !text(source.contentHash) || retractedAt === null ||
        retrievedAt === null || retractedAt > retrievedAt || retrievedAt > observedAt || observedAt > at ||
        !admittedEvidence || identityKey(admittedEvidence.sourceIdentity) !== sourceKey ||
        instant(admittedEvidence.retrievedAt) !== retrievedAt ||
        !Array.isArray(data.evidenceIds) || data.evidenceIds.indexOf(row.evidenceId) < 0 ||
        ids[row.retractionId] || sources[sourceKey]) {
      return { eligible: false, reason: 'explicit-retraction-evidence-invalid' };
    }
    ids[row.retractionId] = true;
    sources[sourceKey] = true;
  }
  return { eligible: true, retractions: retractions, owner: OWNER[event.ownerDomain] };
}

function validateArtifact(event, owner, artifact, causal) {
  if (!artifact || artifact.outputId !== event.outputId || artifact.lane !== 'research' || !text(artifact.contentHash)) {
    return 'research-artifact-missing-or-invalid';
  }
  var autofire = artifact.payload && artifact.payload.autofire;
  if (!autofire || autofire.productDomain !== owner.productDomain || autofire.ownerDomain !== owner.ownerDomain) {
    return 'artifact-domain-identity-mismatch';
  }
  if (autofire.actionId !== event.actionId || autofire.efferenceCopyId !== causal.efferenceCopyId || !text(autofire.productMotorReceiptId)) {
    return 'artifact-action-identity-mismatch';
  }
  var record = causal.record;
  if (causal.kind === 'efference') {
    if (!record || record.schemaVersion !== 1 || record.actionId !== event.actionId ||
        record.actionKind !== 'generate_research_artifact' || record.lane !== 'research' ||
        record.status !== 'EXECUTED' || !record.receipt || record.receipt.applied !== true ||
        record.receipt.outputId !== event.outputId) return 'efference-artifact-receipt-invalid';
  } else if (causal.kind === 'permanent-action-link') {
    if (!record || record.actionId !== event.actionId || record.efferenceCopyId !== causal.efferenceCopyId ||
        record.lane !== 'research' || record.domain !== owner.ownerDomain || !text(record.selectionId) || !text(record.episodeId)) {
      return 'permanent-action-link-invalid';
    }
  } else {
    return 'action-causal-record-invalid';
  }
  return null;
}

async function append(store, key, value) {
  await store.lpush(key, value);
  await store.ltrim(key, 0, LOG_CAP - 1);
}

async function recover(store, event, now, authorize, context) {
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  var checked = validateRetractionEvent(event, at, context);
  if (!checked.eligible) return result('ABSTAINED', checked.reason);
  var owner = checked.owner;
  var recoveryId = 'rar_' + hash({
    observationId: event.observationId,
    outputId: event.outputId,
    actionId: event.actionId,
    retractions: checked.retractions.map(function (row) { return row.retractionId; })
  }).slice(0, 24);
  try {
    if (!store || typeof store.assertDurable !== 'function') throw new Error('strict-store-required');
    store.assertDurable();
    var authorizeFn = typeof authorize === 'function' ? authorize : MotorAuthorization.authorize;
    var authorization = await authorizeFn(store, owner.productDomain, owner.lane, at);
    if (!authorization || authorization.authorized !== true) {
      return result('HELD', authorization && authorization.reason || 'product-domain-recovery-not-authorized', {
        recoveryId: recoveryId, productDomain: owner.productDomain, ownerDomain: owner.ownerDomain
      });
    }
    if (authorization.ownerDomain !== owner.ownerDomain || authorization.lane !== owner.lane || !text(authorization.receiptId)) {
      return result('REFUSED', 'recovery-authorization-identity-mismatch', { recoveryId: recoveryId });
    }

    var efxId = efferenceId(event.actionId);
    var efference = efxId ? await store.get('autofire_efference:' + efxId) : null;
    var permanent = efference ? null : await store.get('autofire_learning_cause:' + event.actionId);
    if (!efference && !permanent) return result('REFUSED', 'action-causal-record-missing', { recoveryId: recoveryId });
    var causal = efference
      ? { kind: 'efference', record: efference, efferenceCopyId: efference.id }
      : { kind: 'permanent-action-link', record: permanent, efferenceCopyId: permanent.efferenceCopyId };
    var artifact = await store.get(artifactKey(event.outputId));
    var invalid = validateArtifact(event, owner, artifact, causal);
    if (invalid) return result('REFUSED', invalid, { recoveryId: recoveryId });

    var key = commandKey(event.observationId);
    var known = await store.get(key);
    if (!known && artifact.status === 'WITHDRAWN') {
      return result('REFUSED', 'artifact-already-withdrawn-outside-this-recovery', { recoveryId: recoveryId });
    }
    var command = {
      schemaVersion: SCHEMA,
      recoveryId: recoveryId,
      status: 'COMMANDED',
      productDomain: owner.productDomain,
      ownerDomain: owner.ownerDomain,
      lane: owner.lane,
      outputId: event.outputId,
      contentHash: artifact.contentHash,
      actionId: event.actionId,
      efferenceCopyId: causal.efferenceCopyId,
      causalRecordKind: causal.kind,
      observationId: event.observationId,
      productMotorReceiptId: authorization.receiptId,
      originalProductMotorReceiptId: artifact.payload.autofire.productMotorReceiptId,
      retractionEvidence: checked.retractions.map(function (row) {
        return { retractionId: row.retractionId, publicationId: row.publicationId, sourceIdentity: clone(row.sourceIdentity), retractedAt: row.retractedAt };
      }),
      prediction: { variable: 'artifact_status', from: artifact.status, to: 'WITHDRAWN', contentHashUnchanged: true },
      commandedAt: at,
      receipt: null
    };
    var inserted = await store.setIfAbsent(key, command);
    var prior = await store.get(key);
    if (!prior || prior.schemaVersion !== SCHEMA || prior.recoveryId !== recoveryId ||
        prior.outputId !== event.outputId || prior.actionId !== event.actionId || prior.productDomain !== owner.productDomain ||
        prior.contentHash !== artifact.contentHash) {
      throw new Error('recovery-command-readback-invalid');
    }
    if (!inserted) {
      if (prior.status === 'WITHDRAWN' && prior.receipt && prior.receipt.readbackVerified === true) {
        return result('WITHDRAWN', null, {
          recoveryId: recoveryId, duplicate: true, readbackVerified: true,
          productDomain: owner.productDomain, ownerDomain: owner.ownerDomain, outputId: event.outputId
        });
      }
      if (prior.status !== 'COMMANDED') return result('REFUSED', 'recovery-command-state-invalid', { recoveryId: recoveryId });
      if (at - Number(prior.commandedAt) < COMMAND_TIMEOUT_MS) {
        return result('HELD', 'recovery-command-in-flight', { recoveryId: recoveryId });
      }
    }
    var activeCommand = inserted ? command : prior;

    artifact = await store.get(artifactKey(event.outputId));
    var history = Array.isArray(artifact.history) ? artifact.history : [];
    var appliedHistory = history.filter(function (row) { return row && row.recoveryId === recoveryId; })[0];
    var fromStatus = activeCommand.prediction.from;
    if (artifact.status === 'WITHDRAWN' && !appliedHistory) {
      return result('REFUSED', 'artifact-already-withdrawn-outside-this-recovery', { recoveryId: recoveryId });
    }
    if (!appliedHistory) {
      var updated = clone(artifact);
      updated.status = 'WITHDRAWN';
      updated.history = history.slice();
      updated.history.push({
        at: at,
        status: 'WITHDRAWN',
        actor: 'product-domain-recovery:' + owner.productDomain,
        notes: 'withdrawn after independently admitted publisher retraction evidence',
        recoveryId: recoveryId,
        observationId: event.observationId,
        from: artifact.status,
        transitionSig: hash({ recoveryId: recoveryId, outputId: event.outputId, from: artifact.status, to: 'WITHDRAWN', at: at })
      });
      await store.set(artifactKey(event.outputId), updated);
      artifact = await store.get(artifactKey(event.outputId));
    }

    var restoredHistory = artifact && Array.isArray(artifact.history) ? artifact.history : [];
    var restoredTransition = restoredHistory.filter(function (row) { return row && row.recoveryId === recoveryId; })[0];
    if (!artifact || artifact.status !== 'WITHDRAWN' || artifact.outputId !== event.outputId ||
        artifact.contentHash !== activeCommand.contentHash || !restoredTransition) {
      throw new Error('research-artifact-withdrawal-readback-invalid');
    }
    await append(store, ENGINE_LOG_KEY, {
      at: at, outputId: event.outputId, lane: 'research',
      transition: { from: fromStatus, to: 'WITHDRAWN' },
      actor: 'product-domain-recovery:' + owner.productDomain,
      recoveryId: recoveryId, observationId: event.observationId
    });
    await append(store, LOG_KEY, {
      at: at, recoveryId: recoveryId, status: 'WITHDRAWN', productDomain: owner.productDomain,
      ownerDomain: owner.ownerDomain, outputId: event.outputId, actionId: event.actionId,
      observationId: event.observationId, productMotorReceiptId: authorization.receiptId
    });
    var resolved = Object.assign({}, activeCommand, {
      status: 'WITHDRAWN',
      resolvedAt: at,
      receipt: {
        applied: true,
        outputId: event.outputId,
        fromStatus: fromStatus,
        toStatus: 'WITHDRAWN',
        contentHash: artifact.contentHash,
        contentHashUnchanged: artifact.contentHash === activeCommand.contentHash,
        historyTransitionSig: restoredTransition.transitionSig,
        readbackVerified: true
      }
    });
    await store.set(key, resolved);
    var receipt = await store.get(key);
    if (!receipt || receipt.status !== 'WITHDRAWN' || !receipt.receipt || receipt.receipt.readbackVerified !== true ||
        receipt.recoveryId !== recoveryId) throw new Error('recovery-receipt-readback-invalid');
    return result('WITHDRAWN', null, {
      recoveryId: recoveryId, duplicate: false, readbackVerified: true,
      productDomain: owner.productDomain, ownerDomain: owner.ownerDomain,
      outputId: event.outputId, actionId: event.actionId
    });
  } catch (error) {
    return result('FAILED', 'research-artifact-recovery-failed', {
      recoveryId: recoveryId, detail: String(error && error.message || error)
    });
  }
}

module.exports = {
  SCHEMA: SCHEMA,
  LOG_KEY: LOG_KEY,
  ENGINE_LOG_KEY: ENGINE_LOG_KEY,
  LOG_CAP: LOG_CAP,
  COMMAND_TIMEOUT_MS: COMMAND_TIMEOUT_MS,
  commandKey: commandKey,
  artifactKey: artifactKey,
  recover: recover,
  _validateRetractionEvent: validateRetractionEvent
};
