'use strict';

/**
 * Durable B11/B14 trace for the asynchronous research/investment actuator.
 *
 * brain-v2's regulation loop already emits command-time efference copies for its
 * internal, synchronous effectors. Paid artifact generation deliberately does not
 * run inside that fast loop. This module carries the same ordering rule across the
 * asynchronous boundary:
 *
 *   persist command prediction -> dispatch provider work -> receive persistence
 *   receipt -> persist observed consequence -> update the forward model once
 *
 * The predicted consequence is operational and falsifiable: whether one commanded
 * artifact is durably persisted, and how long that takes. It is not a prediction of
 * investment return, publication, approval, or usefulness. Those later outcomes are
 * reward evidence and stay separate in /api/limen-outcome.
 */

var crypto = require('crypto');

var SCHEMA_VERSION = 1;
var MODEL_VERSION = 1;
var TRUST_N = 8;
var COMMAND_TIMEOUT_MS = 15 * 60 * 1000;
// Efference records are causal engrams and never expire. Only the pending
// worklist is transient; it may decay after its timeout/recovery window.
var PENDING_TTL_SECONDS = 90 * 86400;
var LOG_CAP = 1000;
var PENDING_LOG_KEY = 'autofire_efference_pending_log';
var SWEEP_CAP = 1000;
var LANES = { research: true, investment: true };

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function finiteNumber(value) {
  return typeof value === 'number' && isFinite(value);
}

function recordKey(id) { return 'autofire_efference:' + id; }
function modelKey(lane) { return 'autofire_forward_model:' + lane; }
function pendingKey(lane, subject, sourceIdentity) {
  return 'autofire_efference_pending:' + lane + ':' +
    hash({ subject: String(subject), sourceIdentity: sourceIdentity }).slice(0, 24);
}

function emptyModel(lane) {
  return {
    schemaVersion: SCHEMA_VERSION,
    modelVersion: MODEL_VERSION,
    lane: lane,
    variable: 'artifact_persisted',
    n: 0,
    successes: 0,
    failures: 0,
    meanLatencyMs: null,
    m2Latency: 0,
    lastUpdatedAt: null
  };
}

function validModel(value, lane) {
  return value && value.schemaVersion === SCHEMA_VERSION &&
    value.modelVersion === MODEL_VERSION && value.lane === lane &&
    value.variable === 'artifact_persisted' &&
    Number.isInteger(value.n) && value.n >= 0 &&
    Number.isInteger(value.successes) && value.successes >= 0 &&
    Number.isInteger(value.failures) && value.failures >= 0 &&
    value.successes + value.failures === value.n &&
    (value.meanLatencyMs === null || finiteNumber(value.meanLatencyMs));
}

async function loadModel(db, lane) {
  var stored = await db.get(modelKey(lane));
  if (!stored) return emptyModel(lane);
  if (!validModel(stored, lane)) {
    throw new Error('refusing malformed autofire forward model for lane ' + lane);
  }
  return stored;
}

function validateCommand(spec) {
  if (!spec || typeof spec !== 'object') return 'command-not-object';
  if (!LANES[spec.lane]) return 'lane-not-research-or-investment';
  if (!spec.cik && !spec.subjectId) return 'missing-cik-or-subject-id';
  if (!spec.sourceIdentity || !spec.sourceIdentity.kind || !spec.sourceIdentity.value) {
    return 'missing-source-identity';
  }
  if (!finiteNumber(spec.emittedAt)) return 'missing-emittedAt';
  return null;
}

async function appendLog(db, event) {
  try {
    if (typeof db.lpush !== 'function') return false;
    var ok = await db.lpush('autofire_efference_log', event);
    if (ok && typeof db.ltrim === 'function') {
      await db.ltrim('autofire_efference_log', 0, LOG_CAP - 1);
    }
    return !!ok;
  } catch (_) {
    // The record and pending index are the load-bearing durability boundary.
    // An audit-list failure must not turn a persisted artifact into a retry.
    return false;
  }
}

function durableStoreError(db) {
  if (!db || typeof db.assertDurable !== 'function') return 'strict-store-required';
  try { db.assertDurable(); }
  catch (err) { return (err && err.message) || String(err); }
  return null;
}

function unresolvedRecord(prior, at, reason) {
  return Object.assign({}, prior, {
    status: 'UNRESOLVED',
    resolvedAt: at,
    receipt: {
      applied: null,
      outputId: null,
      reason: reason,
      observedEffect: null,
      latencyMs: null
    },
    supervised: {
      variable: 'artifact_persisted',
      actual: null,
      predicted: prior.prediction && finiteNumber(prior.prediction.successProbability)
        ? prior.prediction.successProbability : null,
      error: null,
      signal: 'no observation; forward model not updated'
    }
  });
}

async function retireUnresolved(db, prior, at, reason) {
  var unresolved = unresolvedRecord(prior, at, reason);
  await db.set(recordKey(prior.id), unresolved);
  if (prior.pendingKey && typeof db.get === 'function' && typeof db.del === 'function') {
    var pointer = await db.get(prior.pendingKey);
    if (pointer && pointer.id === prior.id) await db.del(prior.pendingKey);
  }
  await appendLog(db, {
    at: at,
    type: 'UNRESOLVED',
    efferenceCopyId: prior.id,
    actionId: prior.actionId,
    lane: prior.lane,
    cik: prior.cik,
    why: reason
  });
  return unresolved;
}

/** Persist the copy before the provider request is allowed to start. */
async function command(db, spec) {
  var refusal = validateCommand(spec);
  if (refusal) return { ok: false, error: refusal };
  var storeError = durableStoreError(db);
  if (storeError) return { ok: false, error: 'durable-store-unavailable', detail: storeError };

  var commandSubject = spec.cik || spec.subjectId;
  var pending = pendingKey(spec.lane, commandSubject, spec.sourceIdentity);
  var priorPending;
  try { priorPending = await db.get(pending); }
  catch (err) { return { ok: false, error: 'pending-index-unreadable', detail: err.message }; }
  if (priorPending && priorPending.id) {
    var prior;
    try { prior = await db.get(recordKey(priorPending.id)); }
    catch (err) { return { ok: false, error: 'prior-command-unreadable', detail: err.message }; }
    if (prior && prior.status === 'COMMANDED') {
      var ageMs = spec.emittedAt - prior.emittedAt;
      if (ageMs < COMMAND_TIMEOUT_MS) {
        return {
          ok: false,
          error: 'command-already-in-flight',
          efferenceCopyId: prior.id,
          retryAfter: prior.emittedAt + COMMAND_TIMEOUT_MS
        };
      }
      // A serverless timeout can end the invocation before any receipt returns.
      // Absence is not a failed effect, so retire the old command as UNRESOLVED
      // and do not teach actual=0 to the model.
      try {
        await retireUnresolved(db, prior, spec.emittedAt,
          'no receipt returned before the next eligible command');
      } catch (err) {
        return {
          ok: false,
          error: 'stale-command-not-retired',
          detail: err.message,
          efferenceCopyId: prior.id
        };
      }
    }
  }

  var model;
  try {
    model = await loadModel(db, spec.lane);
  } catch (err) {
    return { ok: false, error: 'forward-model-unreadable', detail: err.message };
  }

  var successProbability = model.n > 0 ? model.successes / model.n : null;
  var trusted = model.n >= TRUST_N;
  var identity = {
    lane: spec.lane,
    cik: spec.cik ? String(spec.cik) : null,
    subjectId: spec.subjectId ? String(spec.subjectId) : null,
    sourceIdentity: spec.sourceIdentity,
    emittedAt: spec.emittedAt,
    attempt: Number.isInteger(spec.attempt) ? spec.attempt : 0
  };
  var id = 'efx_' + hash(identity).slice(0, 24);
  var copy = {
    schemaVersion: SCHEMA_VERSION,
    id: id,
    actionId: 'act_' + id.slice(4),
    actionKind: 'generate_' + spec.lane + '_artifact',
    lane: spec.lane,
    cik: spec.cik ? String(spec.cik) : null,
    subjectId: spec.subjectId ? String(spec.subjectId) : null,
    sourceIdentity: spec.sourceIdentity,
    movesVariable: 'artifact_persisted',
    commandedMagnitude: 1,
    prediction: {
      expectedObservation: { artifactPersisted: true },
      successProbability: successProbability,
      predictedLatencyMs: model.meanLatencyMs,
      modelN: model.n,
      trusted: trusted,
      interpretation: trusted
        ? 'empirical lane model is trusted for attribution after ' + model.n + ' resolved commands'
        : 'self-effect model has ' + model.n + ' resolved commands; probability/latency are not trusted and are not treated as external evidence'
    },
    status: 'COMMANDED',
    pendingKey: pending,
    emittedAt: spec.emittedAt,
    resolvedAt: null,
    receipt: null,
    supervised: null,
    externalOutcomePending: true
  };

  try {
    await db.set(recordKey(id), copy);
  } catch (err) {
    return { ok: false, error: 'efference-copy-not-persisted', detail: err.message };
  }
  try {
    await db.set(pending, { id: copy.id, emittedAt: copy.emittedAt }, PENDING_TTL_SECONDS);
    await db.lpush(PENDING_LOG_KEY, { id: copy.id, emittedAt: copy.emittedAt });
    await db.ltrim(PENDING_LOG_KEY, 0, SWEEP_CAP - 1);
  } catch (err) {
    var aborted = Object.assign({}, copy, {
      status: 'ABORTED',
      resolvedAt: copy.emittedAt,
      receipt: { applied: false, outputId: null, reason: 'pending-index-not-persisted', observedEffect: null, latencyMs: 0 }
    });
    try { await db.set(recordKey(id), aborted); } catch (_) {}
    return {
      ok: false,
      error: 'efference-pending-index-not-persisted',
      detail: err.message,
      efferenceCopyId: id
    };
  }
  await appendLog(db, {
    at: copy.emittedAt,
    type: 'COMMAND',
    efferenceCopyId: copy.id,
    actionId: copy.actionId,
    lane: copy.lane,
    cik: copy.cik,
    subjectId: copy.subjectId || null,
    sourceIdentity: copy.sourceIdentity,
    prediction: copy.prediction
  });
  return { ok: true, copy: copy };
}

/**
 * Natural cron maintenance. Retires indexed commands whose provider invocation
 * can no longer be running, even when that source is never attempted again.
 * Silence remains UNRESOLVED and never teaches a fabricated failure.
 */
async function sweep(db, now) {
  var storeError = durableStoreError(db);
  if (storeError) return { ok: false, error: 'durable-store-unavailable', detail: storeError };
  var at = finiteNumber(now) ? now : Date.now();
  var entries;
  try { entries = await db.lrange(PENDING_LOG_KEY, 0, SWEEP_CAP - 1); }
  catch (err) { return { ok: false, error: 'pending-log-unreadable', detail: err.message }; }

  var seen = {};
  var inspected = 0;
  var retired = 0;
  var failures = [];
  for (var i = 0; i < entries.length; i++) {
    var id = entries[i] && entries[i].id;
    if (!id || seen[id]) continue;
    seen[id] = true;
    inspected++;
    try {
      var record = await db.get(recordKey(id));
      if (!record || record.status !== 'COMMANDED') continue;
      if (at - record.emittedAt < COMMAND_TIMEOUT_MS) continue;
      await retireUnresolved(db, record, at,
        'no receipt returned before the autonomous timeout sweep');
      retired++;
    } catch (err) {
      failures.push({ efferenceCopyId: id, error: err.message });
    }
  }
  return {
    ok: failures.length === 0,
    inspected: inspected,
    retired: retired,
    failures: failures
  };
}

function updateModel(model, actual, latencyMs, at) {
  var next = Object.assign({}, model);
  var oldN = next.n;
  next.n = oldN + 1;
  if (actual === 1) next.successes++;
  else next.failures++;

  if (finiteNumber(latencyMs) && latencyMs >= 0) {
    var oldMean = finiteNumber(next.meanLatencyMs) ? next.meanLatencyMs : 0;
    var delta = latencyMs - oldMean;
    var newMean = oldMean + delta / next.n;
    var delta2 = latencyMs - newMean;
    next.meanLatencyMs = newMean;
    next.m2Latency = (finiteNumber(next.m2Latency) ? next.m2Latency : 0) + delta * delta2;
  }
  next.lastUpdatedAt = at;
  return next;
}

/**
 * Resolve exactly once from the actuator receipt. A persisted outputId is the
 * receipt that licenses EXECUTED. Later APPROVED/REJECTED/PUBLISHED/P&L events are
 * deliberately not consumed here; they teach reward, not the self-effect model.
 */
async function resolve(db, copyOrId, result, resolvedAt) {
  var storeError = durableStoreError(db);
  if (storeError) return { ok: false, error: 'durable-store-unavailable', detail: storeError };
  var id = typeof copyOrId === 'string' ? copyOrId : copyOrId && copyOrId.id;
  if (!id) return { ok: false, error: 'missing-efference-copy-id' };
  var copy;
  try { copy = await db.get(recordKey(id)); }
  catch (err) {
    return { ok: false, error: 'efference-copy-unreadable', detail: err.message, efferenceCopyId: id };
  }
  if (!copy) return { ok: false, error: 'efference-copy-not-found', efferenceCopyId: id };
  if (copy.status !== 'COMMANDED') {
    return {
      ok: true,
      duplicate: true,
      efferenceCopyId: id,
      status: copy.status,
      modelUpdated: false,
      why: 'one command, one returned consequence; this copy was already resolved'
    };
  }

  var at = finiteNumber(resolvedAt) ? resolvedAt : Date.now();
  var succeeded = !!(result && result.ok && !result.skipped && result.outputId);
  var actual = succeeded ? 1 : 0;
  var latencyMs = Math.max(0, at - copy.emittedAt);
  var predicted = copy.prediction && copy.prediction.successProbability;
  var supervisedError = finiteNumber(predicted) ? actual - predicted : null;

  var resolved = Object.assign({}, copy, {
    status: succeeded ? 'EXECUTED' : 'FAILED',
    resolvedAt: at,
    receipt: {
      applied: succeeded,
      outputId: succeeded ? result.outputId : null,
      wordCount: result && finiteNumber(result.wordCount) ? result.wordCount : null,
      reason: succeeded ? null : (result && result.reason) || 'unknown',
      errorCode: succeeded ? null : (result && result.errorCode) || null,
      observedEffect: { artifactPersisted: succeeded },
      latencyMs: latencyMs
    },
    supervised: {
      variable: 'artifact_persisted',
      actual: actual,
      predicted: finiteNumber(predicted) ? predicted : null,
      error: supervisedError,
      signal: 'actual - predicted; signed per-variable supervised error, not reward error',
      attribution: 'the persistence receipt is reafference from this command and is not independent evidence about the company, market, or research claim'
    }
  });

  try {
    await db.set(recordKey(id), resolved);
  } catch (err) {
    return {
      ok: false,
      error: 'efference-resolution-not-persisted',
      detail: err.message,
      efferenceCopyId: id,
      status: 'UNCONFIRMED',
      modelUpdated: false
    };
  }

  if (copy.pendingKey && typeof db.del === 'function') {
    try { await db.del(copy.pendingKey); } catch (_) {}
  }

  var model;
  var next;
  var modelPersisted = false;
  var modelError = null;
  try {
    model = await loadModel(db, copy.lane);
    next = updateModel(model, actual, latencyMs, at);
    await db.set(modelKey(copy.lane), next);
    modelPersisted = true;
  } catch (err) {
    modelError = err.message;
    model = model || emptyModel(copy.lane);
    next = next || model;
  }
  await appendLog(db, {
    at: at,
    type: 'REAFFERENCE',
    efferenceCopyId: id,
    actionId: copy.actionId,
    lane: copy.lane,
    cik: copy.cik,
    status: resolved.status,
    actual: actual,
    predicted: resolved.supervised.predicted,
    supervisedError: supervisedError,
    latencyMs: latencyMs,
    outputId: resolved.receipt.outputId,
    modelUpdated: modelPersisted
  });

  return {
    ok: true,
    duplicate: false,
    efferenceCopyId: id,
    actionId: copy.actionId,
    status: resolved.status,
    actual: actual,
    predicted: resolved.supervised.predicted,
    supervisedError: supervisedError,
    latencyMs: latencyMs,
    modelUpdated: modelPersisted,
    modelError: modelError,
    modelN: modelPersisted ? next.n : model.n,
    trustedForNextCommand: modelPersisted ? next.n >= TRUST_N : model.n >= TRUST_N,
    externalOutcomePending: true
  };
}

module.exports = {
  SCHEMA_VERSION: SCHEMA_VERSION,
  MODEL_VERSION: MODEL_VERSION,
  TRUST_N: TRUST_N,
  COMMAND_TIMEOUT_MS: COMMAND_TIMEOUT_MS,
  PENDING_LOG_KEY: PENDING_LOG_KEY,
  SWEEP_CAP: SWEEP_CAP,
  command: command,
  sweep: sweep,
  resolve: resolve,
  recordKey: recordKey,
  modelKey: modelKey,
  pendingKey: pendingKey,
  emptyModel: emptyModel
};
