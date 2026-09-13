'use strict';

/**
 * Machine-grounded domain comprehension from the current repository plus the
 * live domain brain. Not a personality prompt. Not a memory summary.
 */

var fs = require('node:fs');
var path = require('node:path');
var crypto = require('node:crypto');
var Lanes = require('./g0-lane-registry.js');
var PhaseSpec = require('./phase-spec.js');
var PhaseMap = require('./phase-map.js');
var Catalog = require('./offer-catalog.js');
var Valve = require('./civilization-valve-registry.js');
var Motor = require('./product-domain-motor-receipt.js');
var Cap = require('./product-domain-motor-capability.js');
var Redis = require('./redis-kv.js');
var Names = require('./domain-names.js');

var SCHEMA = 'g0-domain-comprehension/1.0';
var ROOT = path.join(__dirname, '..');
var LOG_KEY = 'g0_domain_comprehension_log';
var PREFIX = 'g0_domain_comprehension:';
var TTL_SECONDS = 45 * 60;

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function readBinder(rel) {
  try { return require(path.join(ROOT, rel)); } catch (error) { return { error: String(error && error.message || error) }; }
}
function phaseVector(domain, liveTruth) {
  var mapped = PhaseMap.MAP[domain] || null;
  var livePhase = liveTruth && (liveTruth.phase || liveTruth.phaseLabel) || null;
  return PhaseSpec.PHASES.map(function (spec) {
    var code = spec.code.toLowerCase();
    var earned = mapped && mapped.phases && mapped.phases[code] || null;
    return {
      code: spec.code,
      title: spec.title,
      state: spec.state,
      earned: !!earned,
      signal: earned && earned.signal || null,
      field: earned && earned.field || null,
      evidence: earned && earned.evidence || null,
      liveMatch: livePhase ? String(livePhase).toLowerCase() === code : false,
      absentReason: earned ? null : 'source-does-not-express-this-phase'
    };
  });
}
function products(domain) {
  var row = Catalog.CATALOG[domain];
  if (!row || !row.rungs) return { who: null, rungs: [] };
  return {
    who: row.who || null,
    rungs: Object.keys(row.rungs).map(function (code) {
      var r = row.rungs[code];
      return { rung: code, name: r.name, cadence: r.cadence, priceCents: r.priceCents, shape: r.shape };
    })
  };
}
function brainV2(spec) {
  var binderMod = exists(spec.binder) ? readBinder(spec.binder) : null;
  var channels = binderMod && Array.isArray(binderMod.CHANNELS)
    ? binderMod.CHANNELS
    : (binderMod && binderMod.channels) || [];
  if (!channels.length && binderMod && typeof binderMod === 'object') {
    try {
      var factory = binderMod;
      channels = (factory.channels || factory.CHANNELS || []);
    } catch (_) {}
  }
  var channelNames = [];
  if (binderMod && binderMod.domain) {
    /* factory binders export createBinder result; channels stay on the module if attached */
  }
  try {
    var src = fs.readFileSync(path.join(ROOT, spec.binder), 'utf8');
    var keys = src.match(/key:\s*'([^']+)'/g) || [];
    channelNames = keys.map(function (row) { return row.replace(/^key:\s*'/, '').replace(/'$/, ''); });
  } catch (_) {}
  return {
    binderFile: spec.binder,
    binderPresent: exists(spec.binder),
    brainFile: spec.brain,
    brainPresent: exists(spec.brain),
    runtimeName: Names.toRuntime(spec.productDomain),
    productName: Names.toCanonical(spec.productDomain),
    channelCount: channelNames.length,
    channels: channelNames.slice(0, 24),
    findingsDeclared: /findings:\s*\[\s*\]/.test(exists(spec.binder) ? fs.readFileSync(path.join(ROOT, spec.binder), 'utf8') : '')
      ? 0
      : null
  };
}

function repoLoop(spec) {
  return {
    decision: { file: spec.decisionFile, present: exists(spec.decisionFile) },
    executor: { file: spec.executorFile, present: exists(spec.executorFile) },
    observer: { file: spec.observerFile, present: exists(spec.observerFile) },
    rollback: { file: spec.recoveryFile, present: exists(spec.recoveryFile) },
    learning: { file: spec.learningFile, present: exists(spec.learningFile) },
    cycleRoute: spec.cycleRoute,
    observerRoute: spec.observerRoute,
    recoveryRoute: spec.recoveryRoute,
    observerIdentity: spec.observerIdentity
  };
}

async function liveOverlay(spec, input) {
  var cognition = input.cognition || null;
  if (!cognition && input.redisGet) cognition = await input.redisGet('limen:brain:cognition:' + spec.ownerDomain);
  if (!cognition && !input.skipDefaultRedis) {
    try { cognition = await Redis.redisGet('limen:brain:cognition:' + spec.ownerDomain); } catch (_) { cognition = null; }
  }
  var c = cognition && cognition.c || null;
  var packet = c && c.serverPacket || null;
  var truth = packet && packet.truth || {};
  var organs = c && c.brainOrgans || {};
  var store = input.store;
  var motor = null, capability = null, valve = null, economics = null, learning = null;
  if (store && typeof store.get === 'function') {
    try { motor = await store.get(Motor.receiptKey(spec.productDomain)); } catch (_) { motor = null; }
    try {
      if (motor) capability = await Cap.verifyPair(store, motor, input.now);
    } catch (_) { capability = { ok: false, reason: 'capability-unreadable' }; }
    try {
      var Control = require('./civilization-valve-control.js');
      valve = await Control.authorize(spec.valveId, store);
    } catch (error) {
      valve = { ok: false, allowed: false, reason: 'valve-unreadable:' + String(error && error.message || error) };
    }
    try {
      var Treasury = require('./civilization-treasury-ledger.js');
      var projection = await Treasury.project(store, 200);
      economics = (projection.accounts || []).find(function (row) { return row.productDomain === spec.productDomain; }) || null;
    } catch (_) { economics = null; }
    try {
      var Learning = require('../handlers/product-domain-learning-state.js');
      learning = await Learning.read(spec.ownerDomain === 'education' ? 'education' : spec.ownerDomain);
    } catch (_) { learning = null; }
  }
  var feedHealth = truth.feedHealth || null;
  var generatedAt = packet && packet.generatedAt ? Date.parse(packet.generatedAt) : NaN;
  var ts = Number(cognition && cognition.ts);
  var at = Number(input.now) || Date.now();
  var freshnessMs = Number.isFinite(generatedAt) ? at - generatedAt : (Number.isFinite(ts) ? at - ts : null);
  return {
    present: !!c,
    domainId: c && c.domain || null,
    packetId: packet && packet.packetId || null,
    producer: packet && packet.sourceIdentity && packet.sourceIdentity.producer || null,
    freshnessMs: freshnessMs,
    stale: freshnessMs == null || freshnessMs > 45 * 60 * 1000,
    immuneState: c && c.immune && c.immune.immuneState || null,
    humanReviewRequired: !!(c && c.awareness && c.awareness.humanReviewRequired),
    holdReason: organs.autonomousInternalEmission && organs.autonomousInternalEmission.holdReason || null,
    emittedCount: organs.autonomousInternalEmission ? Number(organs.autonomousInternalEmission.emittedCount || 0) : 0,
    resourceState: organs.resourceMetabolism && organs.resourceMetabolism.state || null,
    feedHealth: feedHealth,
    stressScore: truth.stressScore == null ? null : Number(truth.stressScore),
    phase: truth.phase || truth.phaseLabel || null,
    diagnoses: Array.isArray(truth.activeDiagnoses) ? truth.activeDiagnoses.slice(0, 16) : [],
    treatments: Array.isArray(truth.treatments) ? truth.treatments.slice(0, 16) : [],
    motorReceipt: motor ? { receiptId: motor.receiptId, status: motor.status, lane: motor.lane } : null,
    capability: capability && capability.ok ? { ok: true } : { ok: false, reason: capability && capability.reason || 'missing' },
    valve: valve,
    economics: economics,
    learning: learning ? { status: learning.status, resolvedCount: learning.resolvedCount } : null,
    _cognition: cognition
  };
}

function inhibitors(spec, live, env) {
  env = env || process.env;
  var hard = Valve.hardGateState(Valve.get(spec.valveId) || { hardGates: [] }, env);
  var out = [];
  if (!live.present) out.push('live-domain-brain-absent');
  else {
    if (live.stale) out.push('live-domain-brain-stale');
    if (live.immuneState && live.immuneState !== 'clear') out.push('immune-veto:' + live.immuneState);
    if (live.humanReviewRequired) out.push('human-review-flag-present');
    if (live.holdReason) out.push('b10-brake:' + live.holdReason);
    if (live.resourceState && live.resourceState !== 'AVAILABLE') out.push('resource-metabolism:' + live.resourceState);
    if (!live.feedHealth || !(Number(live.feedHealth.live) > 0)) out.push('live-feeds-unavailable');
  }
  if (!live.capability || live.capability.ok !== true) out.push('production-capability-unverified');
  if (live.valve && live.valve.allowed !== true) out.push('runtime-valve:' + (live.valve.reason || 'closed'));
  if (!hard.open) out.push('hard-env-gate-closed');
  hard.gates.forEach(function (g) { if (!g.open) out.push('env:' + g.name); });
  return { hardGates: hard, list: out };
}

function grounded(spec, loop, live, phases) {
  var missing = [];
  if (!spec) missing.push('lane-unknown');
  if (!loop.decision.present || !loop.executor.present || !loop.observer.present || !loop.rollback.present) {
    missing.push('source-loop-files-incomplete');
  }
  if (!phases.some(function (p) { return p.earned; })) missing.push('no-earned-p0-p10-signal');
  return { ok: missing.length === 0, missing: missing };
}

async function compose(domain, input) {
  input = input || {};
  var spec = Lanes.get(domain);
  if (!spec) return { ok: false, reason: 'domain-not-in-soft3-civic-scope', domainId: domain || null };
  var at = Number.isFinite(Number(input.now)) ? Number(input.now) : Date.now();
  var live = await liveOverlay(spec, Object.assign({}, input, { now: at }));
  var loop = repoLoop(spec);
  var phases = phaseVector(spec.productDomain, live);
  var v2 = brainV2(spec);
  var offer = products(spec.productDomain);
  var holds = inhibitors(spec, live, input.env);
  var ground = grounded(spec, loop, live, phases);
  var record = {
    schemaVersion: SCHEMA,
    domainId: spec.productDomain,
    ownerDomain: spec.ownerDomain,
    laneId: spec.lane,
    valveId: spec.valveId,
    desk: spec.desk,
    measuredAt: at,
    grounded: ground.ok,
    groundedMissing: ground.missing,
    source: { repository: true, liveBrain: live.present === true, memoryOrPrompt: false },
    phases: phases,
    brainV2: v2,
    feeds: {
      source: (PhaseMap.MAP[spec.productDomain] && PhaseMap.MAP[spec.productDomain].source) || null,
      live: live.feedHealth,
      freshnessMs: live.freshnessMs,
      provenanceProducer: live.producer || null
    },
    products: offer,
    authorities: {
      contractId: spec.contractId,
      decisionContract: spec.decisionContract,
      budgetId: spec.budgetId,
      motorReceiptId: live.motorReceipt && live.motorReceipt.receiptId || null,
      capabilityVerified: !!(live.capability && live.capability.ok)
    },
    loop: loop,
    economics: live.economics || {
      productDomain: spec.productDomain, availableCashCents: null, pendingCashCents: null,
      statutoryTaxLiabilityCents: null, recognizedRevenueCents: null, spendableCents: null,
      unobserved: true
    },
    dependencies: {
      valveId: spec.valveId,
      provider: spec.provider,
      affectedDomains: [spec.productDomain],
      crossDomainConsciousness: false
    },
    inhibitors: holds.list,
    liveBrain: {
      present: live.present,
      domainId: live.domainId,
      packetId: live.packetId,
      stale: live.stale,
      phase: live.phase,
      stressScore: live.stressScore,
      diagnoses: live.diagnoses,
      treatments: live.treatments,
      holdReason: live.holdReason,
      learning: live.learning
    }
  };
  record.comprehensionReceiptId = 'g0c_' + hash({
    domain: spec.productDomain, at: at, grounded: record.grounded, live: live.packetId || null, inhibitors: holds.list
  }).slice(0, 24);
  return { ok: true, record: record, _live: live };
}

async function persist(store, composed, now) {
  if (!composed || !composed.ok || !composed.record) return { ok: false, reason: 'comprehension-missing' };
  store.assertDurable();
  var record = composed.record;
  var key = PREFIX + record.domainId;
  await store.set(key, record, TTL_SECONDS);
  var restored = await store.get(key);
  if (!restored || restored.comprehensionReceiptId !== record.comprehensionReceiptId) {
    throw new Error('g0 comprehension readback invalid');
  }
  await store.lpush(LOG_KEY, {
    comprehensionReceiptId: record.comprehensionReceiptId, domainId: record.domainId,
    grounded: record.grounded, measuredAt: record.measuredAt
  });
  await store.ltrim(LOG_KEY, 0, 199);
  return { ok: true, record: restored, persistedAt: Number(now) || Date.now() };
}

module.exports = {
  SCHEMA: SCHEMA, PREFIX: PREFIX, LOG_KEY: LOG_KEY, TTL_SECONDS: TTL_SECONDS,
  compose: compose, persist: persist, phaseVector: phaseVector
};
