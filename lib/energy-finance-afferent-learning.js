'use strict';

/*
 * Finance outcome -> Energy afferent evidence.
 *
 * Finance remains the owner of the investment decision and financial learner.
 * This small return channel only preserves the independently observed result
 * and the originating Energy opportunity identity so the Energy brain can see
 * what happened on its next read.  It never changes Energy's motor authority
 * or grants Energy brokerage capability.
 */

var crypto = require('crypto');
var LOCK_KEY = 'energy_finance_afferent_writer_lock';
var SCHEMA = 'energy-finance-afferent/1.0';
var EXTERNAL = 'product-domain-external-learning/1.0';
var STATE_KEY = 'energy_finance_afferent_state';
var CAUSE_PREFIX = 'energy_finance_afferent_cause:';
var MAX_SIGNALS = 200;

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
function causeKey(eventId) { return CAUSE_PREFIX + eventId; }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    var result = {};
    Object.keys(value).sort().forEach(function (key) { result[key] = canonical(value[key]); });
    return result;
  }
  return value;
}
function same(a, b) { return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b)); }
async function completeCause(store, cause, lockToken) {
  var completed = Object.assign({}, cause, { status: 'RECORDED' });
  if (!(await store.setIfLockOwned(LOCK_KEY, lockToken, causeKey(cause.eventId), completed))) throw new Error('energy-finance-afferent writer lease lost');
  if (!same(await store.get(causeKey(cause.eventId)), completed)) {
    throw new Error('energy-finance-afferent completion readback invalid');
  }
}


function fresh() {
  return { schemaVersion: SCHEMA, domain: 'energy', sourceDomain: 'finance', resolvedCount: 0,
    signals: [], processedEventIds: [], latestSignalId: null, latestObservedAt: null };
}

async function load(store) {
  var value = await store.get(STATE_KEY);
  if (!value) return fresh();
  if (value.schemaVersion !== SCHEMA || value.domain !== 'energy' || value.sourceDomain !== 'finance' ||
      !Array.isArray(value.signals) || !Array.isArray(value.processedEventIds)) {
    throw new Error('energy-finance-afferent state malformed');
  }
  return value;
}

async function save(store, value, lockToken) {
  if (!(await store.setIfLockOwned(LOCK_KEY, lockToken, STATE_KEY, value))) throw new Error('energy-finance-afferent writer lease lost');
  var restored = await store.get(STATE_KEY);
  if (!same(restored, value)) {
    throw new Error('energy-finance-afferent readback invalid');
  }
  return restored;
}

function sourceRefs(command) {
  var context = command && command.intent && command.intent.decisionContext || {};
  var rows = Array.isArray(context.sourceDomains) ? context.sourceDomains : [];
  return rows.filter(function (row) {
    return row && row.sourceDomain === 'energy' && (text(row.sourcePacketId) || text(row.opportunityId) || text(row.emissionId));
  }).slice(0, 16).map(clone);
}

function credit(outcomeResult) {
  var reward = outcomeResult && outcomeResult.assessment && outcomeResult.assessment.reward;
  return reward > 0 ? 1 : reward < 0 ? 0 : 0.5;
}

async function record(store, event, command, outcomeResult) {
  if (!store || typeof store.assertDurable !== 'function' || typeof store.get !== 'function' ||
      typeof store.set !== 'function' || typeof store.setIfAbsent !== 'function') {
    return { ok: false, reason: 'energy-finance-afferent-durable-store-required' };
  }
  if (!event || event.ownerDomain !== 'finance' || event.lane !== 'investment' ||
      event.eventType !== 'OUTCOME_INVESTMENT_PNL' || !text(event.eventId) || !text(event.actionId)) {
    return { ok: false, reason: 'finance-investment-outcome-required' };
  }
  var refs = sourceRefs(command);
  if (!refs.length) return { ok: true, status: 'ABSTAINED', reason: 'no-energy-source-domain-reference', eventId: event.eventId };
  if (!outcomeResult || outcomeResult.ok !== true || outcomeResult.learningAccepted === false) {
    return { ok: true, status: 'ABSTAINED', reason: 'finance-outcome-record-not-accepted', eventId: event.eventId };
  }
  store.assertDurable();
  if (typeof store.setIfLockOwned !== 'function' || typeof store.deleteIfValue !== 'function') {
    return { ok: false, reason: 'energy-finance-afferent-fenced-store-required' };
  }
  var lockToken = { eventId: event.eventId, nonce: crypto.randomBytes(16).toString('hex') };
  if (!(await store.setIfAbsent(LOCK_KEY, lockToken, 120))) {
    return { ok: true, status: 'ABSTAINED', reason: 'energy-finance-afferent-writer-busy', eventId: event.eventId };
  }
  try {
    return await recordOwned(store, event, refs, outcomeResult, lockToken);
  } finally {
    await store.deleteIfValue(LOCK_KEY, lockToken);
  }
}

async function recordOwned(store, event, refs, outcomeResult, lockToken) {
  var state = await load(store);
  var signal = {
    schemaVersion: EXTERNAL,
    signalId: 'efa_' + event.eventId,
    eventId: event.eventId,
    actionId: event.actionId,
    ownerDomain: 'energy',
    sourceDomain: 'finance',
    lane: 'finance-investment-outcome',
    eventType: 'OUTCOME_FINANCE_INVESTMENT_RETURNED_TO_ENERGY',
    observedAt: event.ts || Date.now(),
    outcome: event.outcomeData && event.outcomeData.netPnl > 0 ? 'POSITIVE_PNL'
      : event.outcomeData && event.outcomeData.netPnl < 0 ? 'NEGATIVE_PNL' : 'NEUTRAL_PNL',
    normalizedCredit: credit(outcomeResult),
    sourceKind: 'independent-action-outcome',
    sourceIdentity: clone(event.sourceIdentity || null),
    financialOutcome: clone(event.outcomeData || null),
    sourceDomains: refs,
    authority: {
      financeRemainsDecisionOwner: true,
      energyReceivesAfferentEvidence: true,
      energyBrokerageAuthority: false
    }
  };
  var identity = { actionId: event.actionId, observedAt: event.ts || null,
    sourceDomains: refs, sourceIdentity: event.sourceIdentity || null,
    financialOutcome: event.outcomeData || null, normalizedCredit: credit(outcomeResult) };
  var proposedCause = { schemaVersion: SCHEMA, eventId: event.eventId, sourceDomains: refs,
    identity: clone(identity), signal: clone(signal), baseResolvedCount: state.resolvedCount, status: 'PENDING' };
  var created = await store.setIfAbsent(causeKey(event.eventId), proposedCause);
  var cause = await store.get(causeKey(event.eventId));
  if (!cause || cause.schemaVersion !== SCHEMA || cause.eventId !== event.eventId ||
      !same(cause.sourceDomains, refs)) throw new Error('energy-finance-afferent cause readback invalid');
  // Old records contain no durable completion evidence. Never guess whether an
  // evicted event completed or was interrupted before its state write.
  if (!cause.identity || !cause.signal || !cause.status) {
    return { ok: true, status: 'ABSTAINED', reason: 'energy-finance-afferent-legacy-cause-reconciliation-required', eventId: event.eventId };
  }
  var expectedSignal = Object.assign({}, signal, { observedAt: event.ts || cause.signal.observedAt });
  if (!same(cause.identity, identity) || !same(cause.signal, expectedSignal) || !finite(cause.signal.observedAt) ||
      !finite(cause.baseResolvedCount) || ['PENDING', 'RECORDED'].indexOf(cause.status) < 0 || cause.signal.eventId !== event.eventId) {
    throw new Error('energy-finance-afferent cause identity mismatch');
  }
  if (cause.status === 'RECORDED') return { ok: true, duplicate: true, eventId: event.eventId };
  if (state.processedEventIds.indexOf(event.eventId) >= 0) {
    await completeCause(store, cause, lockToken);
    return { ok: true, duplicate: true, eventId: event.eventId };
  }
  if (state.resolvedCount !== cause.baseResolvedCount) {
    return { ok: true, status: 'ABSTAINED', reason: 'energy-finance-afferent-pending-cause-reconciliation-required', eventId: event.eventId };
  }
  // Retry the exact pending signal if cause creation outlived a failed state write.
  signal = clone(cause.signal);
  state.signals.push(signal);
  state.signals = state.signals.slice(-MAX_SIGNALS);
  state.processedEventIds.push(event.eventId);
  state.processedEventIds = state.processedEventIds.slice(-2000);
  state.resolvedCount++;
  state.latestSignalId = signal.signalId;
  state.latestObservedAt = signal.observedAt;
  await save(store, state, lockToken);
  await completeCause(store, cause, lockToken);
  return { ok: true, duplicate: false, recovered: !created, signal: signal, resolvedCount: state.resolvedCount };
}

async function readForBrain(store) {
  var state = await load(store);
  var signal = state.signals.length ? state.signals[state.signals.length - 1] : null;
  return {
    schemaVersion: EXTERNAL,
    domain: 'energy',
    status: signal ? 'ELIGIBLE' : 'ABSTAINED',
    reason: signal ? null : 'energy-has-no-returned-finance-outcome',
    resolvedCount: state.resolvedCount,
    learningGate: { ready: !!signal, minimumResolved: 1, distinctSources: signal ? 1 : 0, minimumDistinctSources: 1 },
    signal: signal ? {
      schemaVersion: signal.schemaVersion,
      signalId: signal.signalId,
      eventId: signal.eventId,
      actionId: signal.actionId,
      ownerDomain: signal.ownerDomain,
      sourceDomain: signal.sourceDomain,
      lane: signal.lane,
      eventType: signal.eventType,
      observedAt: signal.observedAt,
      outcome: signal.outcome,
      normalizedCredit: signal.normalizedCredit,
      sourceKind: signal.sourceKind,
      sourceIdentity: clone(signal.sourceIdentity),
      sourceDomains: clone(signal.sourceDomains),
      financialOutcome: clone(signal.financialOutcome),
      authority: clone(signal.authority)
    } : null
  };
}

module.exports = {
  LOCK_KEY: LOCK_KEY,
  SCHEMA: SCHEMA,
  EXTERNAL_LEARNING_SCHEMA: EXTERNAL,
  STATE_KEY: STATE_KEY,
  causeKey: causeKey,
  record: record,
  readForBrain: readForBrain,
  _fresh: fresh
};

