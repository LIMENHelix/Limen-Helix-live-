'use strict';

/**
 * Automatic orientation / reflex check. Not human approval.
 * A Governor cannot fire the G0 actuator without these boot fields.
 *
 * Boot order:
 * 1 identity+authority
 * 2 Brain v2
 * 3 P0-P10 / stress / diagnoses / treatments / predictions / inhibition
 * 4 feeds / evidence
 * 5 product / executor / observer / rollback / provider paths
 * 6 economics
 * 7 recent actions / outcomes / prediction errors
 * 8 incoming typed inter-domain requests
 * 9 decide via own domain brain
 * 10 execute / observe / feed back to same brain
 */

var crypto = require('node:crypto');
var Lanes = require('./g0-lane-registry.js');
var Comprehension = require('./g0-domain-comprehension.js');

var SCHEMA = 'g0-orientation-boot/1.0';
var PREFIX = 'g0_orientation_boot:';
var LOG_KEY = 'g0_orientation_boot_log';
var TTL_SECONDS = 45 * 60;

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function text(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }

function identify(record, incoming) {
  var spec = Lanes.get(record && record.domainId);
  var loop = record && record.loop || {};
  var missing = [];
  var identity = text(record && record.domainId);
  var localBrain = text(record && record.liveBrain && record.liveBrain.domainId) || (spec && spec.ownerDomain) || null;
  var evidencePaths = !!(loop.decision && loop.decision.present && loop.executor && loop.executor.present);
  var observerPath = !!(loop.observer && loop.observer.present && text(loop.observerIdentity));
  var rollbackPath = !!(loop.rollback && loop.rollback.present && spec && spec.rollbackClass);
  var authorityMoney = !!(record && record.authorities && record.authorities.contractId && record.authorities.budgetId);
  var affected = record && record.dependencies && Array.isArray(record.dependencies.affectedDomains)
    ? record.dependencies.affectedDomains.slice()
    : [];
  if (!identity) missing.push('domain-identity');
  if (!localBrain) missing.push('local-brain');
  if (!evidencePaths) missing.push('evidence-or-code-paths');
  if (!authorityMoney) missing.push('authority-or-money');
  if (!affected.length) missing.push('affected-domains');
  if (!observerPath) missing.push('success-fail-observer');
  if (!rollbackPath) missing.push('stop-rollback-path');
  if (!record || record.grounded !== true) missing.push('comprehension-not-grounded');
  if (record && record.source && record.source.memoryOrPrompt) missing.push('comprehension-from-memory-or-prompt');
  return {
    domainIdentity: identity,
    localBrain: localBrain,
    evidenceAndCodePaths: evidencePaths,
    authorityAndMoney: authorityMoney,
    affectedDomains: affected,
    observerIdentity: loop.observerIdentity || null,
    rollbackClass: spec && spec.rollbackClass || null,
    incomingRequests: Array.isArray(incoming) ? incoming.length : 0,
    missing: missing
  };
}

function steps(record, identified, incoming) {
  return [
    { n: 1, name: 'identity-authority', ok: !!(identified.domainIdentity && identified.authorityAndMoney) },
    { n: 2, name: 'brain-v2', ok: !!(record && record.brainV2 && record.brainV2.binderPresent) },
    { n: 3, name: 'p0-p10-stress-diagnoses', ok: !!(record && Array.isArray(record.phases) && record.phases.length === 11) },
    { n: 4, name: 'feeds-evidence', ok: !!(record && record.feeds && record.feeds.source) },
    { n: 5, name: 'product-executor-observer-rollback', ok: !!(identified.evidenceAndCodePaths && identified.observerIdentity && identified.rollbackClass) },
    { n: 6, name: 'economics', ok: !!(record && record.economics && record.economics.productDomain === record.domainId) },
    { n: 7, name: 'recent-actions-outcomes', ok: true },
    { n: 8, name: 'incoming-typed-requests', ok: true, count: identified.incomingRequests },
    { n: 9, name: 'own-domain-brain-decides', ok: identified.localBrain === (record && record.ownerDomain) },
    { n: 10, name: 'execute-observe-same-brain', ok: !!(identified.observerIdentity && record && record.loop && record.loop.learning && record.loop.learning.present) }
  ];
}

async function boot(domain, input) {
  input = input || {};
  var spec = Lanes.get(domain);
  if (!spec) return { ok: false, canAct: false, reason: 'domain-not-in-soft3-civic-scope' };
  var composed = input.comprehension || await Comprehension.compose(domain, input);
  if (!composed || !composed.ok) return { ok: false, canAct: false, reason: composed && composed.reason || 'comprehension-failed' };
  var record = composed.record;
  var incoming = input.incomingRequests || [];
  var identified = identify(record, incoming);
  var bootSteps = steps(record, identified, incoming);
  var paperReady = identified.missing.filter(function (m) { return m !== 'comprehension-not-grounded'; }).length === 0
    && record.grounded === true
    && bootSteps.filter(function (s) { return s.n <= 6 && !s.ok; }).length === 0;
  var liveReady = paperReady
    && record.liveBrain && record.liveBrain.present === true && record.liveBrain.stale === false
    && record.authorities && record.authorities.capabilityVerified === true
    && (!record.inhibitors || record.inhibitors.indexOf('runtime-valve:global-emergency-valve-closed') < 0);
  var body = {
    schemaVersion: SCHEMA,
    domainId: spec.productDomain,
    ownerDomain: spec.ownerDomain,
    laneId: spec.lane,
    comprehensionReceiptId: record.comprehensionReceiptId,
    identified: identified,
    steps: bootSteps,
    paperReady: paperReady,
    liveReady: liveReady,
    canAct: paperReady,
    liveMoney: false,
    humanApprovalRequired: false,
    measuredAt: record.measuredAt
  };
  body.orientationReceiptId = 'g0o_' + hash({
    domain: spec.productDomain, comprehension: record.comprehensionReceiptId, missing: identified.missing
  }).slice(0, 24);
  if (!paperReady) body.reason = 'orientation-identification-incomplete';
  return { ok: true, boot: body, comprehension: record };
}

function mayAct(boot, mode) {
  if (!boot || boot.schemaVersion !== SCHEMA) return { ok: false, reason: 'orientation-boot-missing' };
  if (boot.humanApprovalRequired === true) return { ok: false, reason: 'orientation-must-not-require-human-approval' };
  if (mode === 'live') {
    if (boot.liveReady !== true) return { ok: false, reason: 'orientation-live-not-ready' };
    return { ok: true, mode: 'live' };
  }
  if (boot.canAct !== true || boot.paperReady !== true) return { ok: false, reason: boot.reason || 'orientation-paper-not-ready' };
  return { ok: true, mode: 'paper' };
}

async function persist(store, result) {
  if (!result || !result.ok || !result.boot) return { ok: false, reason: 'orientation-missing' };
  store.assertDurable();
  var boot = result.boot;
  var key = PREFIX + boot.domainId;
  await store.set(key, boot, TTL_SECONDS);
  var restored = await store.get(key);
  if (!restored || restored.orientationReceiptId !== boot.orientationReceiptId) {
    throw new Error('g0 orientation readback invalid');
  }
  await store.lpush(LOG_KEY, {
    orientationReceiptId: boot.orientationReceiptId, domainId: boot.domainId,
    paperReady: boot.paperReady, liveReady: boot.liveReady, measuredAt: boot.measuredAt
  });
  await store.ltrim(LOG_KEY, 0, 199);
  return { ok: true, boot: restored };
}

module.exports = {
  SCHEMA: SCHEMA, PREFIX: PREFIX, LOG_KEY: LOG_KEY, TTL_SECONDS: TTL_SECONDS,
  boot: boot, mayAct: mayAct, persist: persist, identify: identify
};
