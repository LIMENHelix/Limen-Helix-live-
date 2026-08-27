'use strict';

var crypto = require('node:crypto');
var Store = require('./autofire-efference-store.js');
var Registry = require('./civilization-valve-registry.js');
var ControlInventory = require('./civilization-control-inventory.js');
var ResearchDevelopmental = require('./research-paper-developmental-authority.js');
var FinanceCommissioning = require('./finance-sandbox-commissioning.js');

var SCHEMA = 'civilization-valve-receipt/1.0';
// Stable persisted key retained for receipt compatibility. "NUKE" is the
// operator-facing name: an external-to-the-organism emergency inhibitor, never
// an internal brain node or authority one domain may invoke against another.
var GLOBAL_ID = 'global:emergency';
var GLOBAL_DISPLAY_NAME = 'NUKE';
var LOG_KEY = 'civilization_valve_receipt_log';
var LOG_CAP = 500;
var NUKE_STAGES = Object.freeze([
  'NUKED', 'DIAGNOSTIC_READ_ONLY', 'SENSING_ONLY', 'INTERNAL_COGNITION',
  'SANDBOX_MOTOR', 'DOMAIN_RECOMMISSION', 'OPEN'
]);
var NUKE_NEXT = Object.freeze({
  NUKED: 'DIAGNOSTIC_READ_ONLY',
  DIAGNOSTIC_READ_ONLY: 'SENSING_ONLY',
  SENSING_ONLY: 'INTERNAL_COGNITION',
  INTERNAL_COGNITION: 'SANDBOX_MOTOR',
  SANDBOX_MOTOR: 'DOMAIN_RECOMMISSION',
  DOMAIN_RECOMMISSION: 'OPEN'
});

function key(id) { return 'civilization_valve:' + String(id || ''); }
function idFor(valveId, mode, at, stage) {
  return 'valve_' + crypto.createHash('sha256').update([valveId, mode, stage || '', at].join('\u0000')).digest('hex').slice(0, 24);
}
function validId(id) { return id === GLOBAL_ID || !!Registry.get(id); }
function normalize(record, id) {
  if (!record) return {
    valveId: id, runtimeMode: 'OPEN', source: 'DEFAULT_OPEN', receiptId: null, changedAt: null,
    nukeStage: id === GLOBAL_ID ? 'OPEN' : null, nukedAt: null
  };
  if (record.schemaVersion !== SCHEMA || record.valveId !== id || (record.runtimeMode !== 'OPEN' && record.runtimeMode !== 'CLOSED')) {
    throw new Error('civilization valve record invalid for ' + id);
  }
  if (id !== GLOBAL_ID) return record;
  var stage = record.nukeStage || (record.runtimeMode === 'OPEN' ? 'OPEN' : 'NUKED');
  if (NUKE_STAGES.indexOf(stage) < 0) throw new Error('civilization NUKE stage invalid');
  if ((stage === 'OPEN') !== (record.runtimeMode === 'OPEN')) throw new Error('civilization NUKE mode/stage mismatch');
  return Object.assign({}, record, { nukeStage: stage, nukedAt: record.nukedAt || record.changedAt || null });
}
async function read(id, store) {
  if (!validId(id)) throw new Error('unknown civilization valve');
  store = store || Store; store.assertDurable();
  return normalize(await store.get(key(id)), id);
}
async function set(id, mode, actor, store, now) {
  if (!validId(id)) throw new Error('unknown civilization valve');
  mode = String(mode || '').toUpperCase();
  if (mode !== 'OPEN' && mode !== 'CLOSED') throw new Error('civilization valve mode must be OPEN or CLOSED');
  store = store || Store; store.assertDurable();
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  var previous = await read(id, store);
  if (id === GLOBAL_ID && mode === 'OPEN' && previous.runtimeMode === 'CLOSED') {
    throw new Error('NUKE cannot reopen directly; advance the staged recovery sequence');
  }
  var nukeStage = id === GLOBAL_ID ? (mode === 'CLOSED' ? 'NUKED' : 'OPEN') : null;
  var changedAt = new Date(at).toISOString();
  var receipt = {
    schemaVersion: SCHEMA,
    receiptId: idFor(id, mode, at, nukeStage),
    valveId: id,
    runtimeMode: mode,
    changedAt: changedAt,
    changedBy: String(actor || 'master-operator'),
    effect: id === GLOBAL_ID && mode === 'CLOSED'
      ? 'all new civilization activity suppressed; persisted state preserved for diagnosis'
      : (mode === 'CLOSED' ? 'new efferent dispatch inhibited' : 'eligibility restored; brain, budget, provider and hard gates still bind'),
    displayName: id === GLOBAL_ID ? GLOBAL_DISPLAY_NAME : null,
    controlScope: id === GLOBAL_ID ? 'EXTERNAL_OPERATOR_ONLY' : 'DOMAIN_LOCAL_CIRCUIT_BREAKER',
    nukeStage: nukeStage,
    nukedAt: id === GLOBAL_ID && mode === 'CLOSED' ? changedAt : null,
    statePreserved: id === GLOBAL_ID ? true : null,
    observersRemainOpen: id === GLOBAL_ID ? mode === 'OPEN' : true,
    recoveryRemainsOpen: id === GLOBAL_ID ? mode === 'OPEN' : true,
    diagnosticReadsRemainOpen: id === GLOBAL_ID ? true : null
  };
  await store.set(key(id), receipt);
  var restored = normalize(await store.get(key(id)), id);
  if (restored.receiptId !== receipt.receiptId || restored.runtimeMode !== mode) throw new Error('civilization valve readback verification failed');
  await store.lpush(LOG_KEY, restored);
  await store.ltrim(LOG_KEY, 0, LOG_CAP - 1);
  return restored;
}

async function advanceNuke(nextStage, actor, store, now) {
  nextStage = String(nextStage || '').toUpperCase();
  if (NUKE_STAGES.indexOf(nextStage) < 0 || nextStage === 'NUKED') throw new Error('unknown NUKE recovery stage');
  store = store || Store; store.assertDurable();
  var previous = await read(GLOBAL_ID, store);
  if (previous.runtimeMode !== 'CLOSED') throw new Error('NUKE recovery requires an active NUKE state');
  if (NUKE_NEXT[previous.nukeStage] !== nextStage) {
    throw new Error('NUKE recovery transition must be ' + previous.nukeStage + ' -> ' + (NUKE_NEXT[previous.nukeStage] || 'none'));
  }
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  var changedAt = new Date(at).toISOString();
  var open = nextStage === 'OPEN';
  var receipt = {
    schemaVersion: SCHEMA,
    receiptId: idFor(GLOBAL_ID, open ? 'OPEN' : 'CLOSED', at, nextStage),
    valveId: GLOBAL_ID,
    runtimeMode: open ? 'OPEN' : 'CLOSED',
    changedAt: changedAt,
    changedBy: String(actor || 'master-operator'),
    displayName: GLOBAL_DISPLAY_NAME,
    controlScope: 'EXTERNAL_OPERATOR_ONLY',
    nukeStage: nextStage,
    nukedAt: previous.nukedAt,
    previousStage: previous.nukeStage,
    effect: open
      ? 'staged recovery completed; ordinary domain eligibility may be evaluated'
      : 'staged recovery advanced; activity remains bounded to ' + nextStage,
    statePreserved: true,
    observersRemainOpen: open,
    recoveryRemainsOpen: open,
    diagnosticReadsRemainOpen: true
  };
  await store.set(key(GLOBAL_ID), receipt);
  var restored = normalize(await store.get(key(GLOBAL_ID)), GLOBAL_ID);
  if (restored.receiptId !== receipt.receiptId || restored.nukeStage !== nextStage) throw new Error('NUKE recovery readback verification failed');
  await store.lpush(LOG_KEY, restored);
  await store.ltrim(LOG_KEY, 0, LOG_CAP - 1);
  return restored;
}
async function authorize(id, store) {
  if (!validId(id)) return { ok: false, allowed: false, valveId: id || null, reason: 'unknown-civilization-valve' };
  store = store || Store;
  try {
    store.assertDurable();
    var rows = await Promise.all([read(GLOBAL_ID, store), read(id, store)]);
    if (rows[0].runtimeMode === 'CLOSED') {
      if (rows[0].nukeStage !== 'DOMAIN_RECOMMISSION') {
        return { ok: true, allowed: false, valveId: id, reason: 'global-emergency-valve-closed', receipt: rows[0] };
      }
      var localChanged = rows[1].changedAt && Date.parse(rows[1].changedAt);
      var nukedAt = rows[0].nukedAt && Date.parse(rows[0].nukedAt);
      if (!rows[1].receiptId || !Number.isFinite(localChanged) || !Number.isFinite(nukedAt) || localChanged <= nukedAt) {
        return { ok: true, allowed: false, valveId: id, reason: 'post-nuke-domain-recommission-required', receipt: rows[0] };
      }
    }
    if (rows[1].runtimeMode === 'CLOSED') return { ok: true, allowed: false, valveId: id, reason: 'domain-runtime-valve-closed', receipt: rows[1] };
    return { ok: true, allowed: true, valveId: id, reason: 'runtime-valves-open', receipt: rows[1] };
  } catch (error) {
    return { ok: false, allowed: false, valveId: id, reason: 'valve-control-unavailable-fail-closed', detail: String(error && error.message || error) };
  }
}

var DIAGNOSTIC_ROUTES = new Set([
  'civilization-valves', 'limen-autofire-log', 'audit-ledger', 'limen-health',
  'feed-status', 'redis-diag', 'finance-paper-status', 'paper-orders', 'paper-positions',
  'social-status', 'homestead-status', 'industry-status', 'finance-distress-status',
  'energy-distress-status', 'research-paper-developmental-status', 'product-domain-learning-state'
]);
var SENSING_ROUTES = new Set([
  'limen-worker-ingest', 'limen-worker-snapshot', 'limen-ingest', 'feed-record',
  'feed-resolve', 'feed-consolidate', 'domain-text-read', 'market-snapshot', 'asset-quote'
]);
var COGNITION_ROUTES = new Set([
  'brain-cognition-refresh', 'brain-cognition', 'brain-shadow', 'limen-worker-score',
  'limen-worker-stress-refresh', 'limen-worker-autoqueue', 'limen-autoqueue',
  'limen-worker-sleep-cycle', 'brain-weights-cron', 'brain-weights', 'system-gain'
]);
var SANDBOX_ROUTES = new Set([
  'kernel-experiment', 'pattern-proposal', 'paper-trade', 'limen-intents',
  'limen-iteration', 'limen-operator-calibration'
]);

function routeAllowedAtStage(stage, routeName, method) {
  if (routeName === 'civilization-valves') return true;
  var readOnly = String(method || 'GET').toUpperCase() === 'GET';
  if (stage === 'DIAGNOSTIC_READ_ONLY') return readOnly && DIAGNOSTIC_ROUTES.has(routeName);
  if (stage === 'SENSING_ONLY') return (readOnly && DIAGNOSTIC_ROUTES.has(routeName)) || SENSING_ROUTES.has(routeName);
  if (stage === 'INTERNAL_COGNITION') return (readOnly && DIAGNOSTIC_ROUTES.has(routeName)) || SENSING_ROUTES.has(routeName) || COGNITION_ROUTES.has(routeName);
  if (stage === 'SANDBOX_MOTOR') return (readOnly && DIAGNOSTIC_ROUTES.has(routeName)) || SENSING_ROUTES.has(routeName) || COGNITION_ROUTES.has(routeName) || SANDBOX_ROUTES.has(routeName);
  if (stage === 'DOMAIN_RECOMMISSION' || stage === 'OPEN') return true;
  return false;
}

async function authorizeActivity(routeName, method, store) {
  // The operator must never be locked out of the protected NUKE control route
  // by the very storage/control failure they are trying to diagnose.
  if (String(routeName || '') === 'civilization-valves') {
    return { ok: true, allowed: true, nukeStage: null, controlRoute: true };
  }
  try {
    store = store || Store; store.assertDurable();
    var global = await read(GLOBAL_ID, store);
    if (global.runtimeMode === 'OPEN') return { ok: true, allowed: true, nukeStage: 'OPEN' };
    var allowed = routeAllowedAtStage(global.nukeStage, String(routeName || ''), method);
    return {
      ok: true,
      allowed: allowed,
      nukeStage: global.nukeStage,
      reason: allowed ? null : 'nuke-stage-activity-suppressed',
      receipt: global
    };
  } catch (error) {
    return { ok: false, allowed: false, nukeStage: null, reason: 'nuke-control-unavailable-fail-closed', detail: String(error && error.message || error) };
  }
}

function researchProof(domain, record) {
  if (!record) return { status: 'NOT_CLAIMED', artifactPersisted: false, observedAt: null };
  var owner = ResearchDevelopmental.OWNERS[domain];
  var allowed = { CLAIMED: true, ARTIFACT_PERSISTED: true, ATTEMPT_RESOLVED_NO_ARTIFACT: true };
  if (!owner || record.schemaVersion !== ResearchDevelopmental.SCHEMA || record.productDomain !== domain ||
      record.ownerDomain !== owner.ownerDomain || !allowed[record.status] || record.paperOnly !== true ||
      record.liveMoney !== false || record.artifactGenerationOnly !== true || record.publicationAuthorized !== false) {
    throw new Error('civilization research commissioning proof invalid for ' + domain);
  }
  return {
    status: record.status,
    artifactPersisted: record.status === 'ARTIFACT_PERSISTED' && typeof record.outputId === 'string' && !!record.outputId,
    observedAt: record.resolvedAt || record.claimedAt || null
  };
}

function financeProof(record) {
  if (!record) return { status: 'NOT_COMMISSIONED', verified: false, observedAt: null };
  if (record.schemaVersion !== FinanceCommissioning.SCHEMA || typeof record.status !== 'string' ||
      record.paperOnly !== true || record.liveMoney !== false) {
    throw new Error('civilization Finance commissioning proof invalid');
  }
  return {
    status: record.status,
    verified: record.status === 'VERIFIED_ZERO_EFFECT_ROLLBACK' && record.effectExecuted === false && Number(record.executedQuantity) === 0,
    observedAt: record.verifiedAt || record.updatedAt || record.claimedAt || null
  };
}

async function snapshot(env, store) {
  store = store || Store; store.assertDurable();
  var ids = [GLOBAL_ID].concat(Registry.LINES.map(function (x) { return x.id; }));
  var records = await Promise.all(ids.map(function (id) { return read(id, store); }).concat([
    store.get(ResearchDevelopmental.slotKey('science')),
    store.get(ResearchDevelopmental.slotKey('medicine')),
    store.get(FinanceCommissioning.KEY)
  ]));
  var global = records[0];
  var proof = {
    researchDevelopmental: {
      science: researchProof('science', records[ids.length]),
      medicine: researchProof('medicine', records[ids.length + 1])
    },
    financeCommissioning: financeProof(records[ids.length + 2])
  };
  var lines = Registry.LINES.map(function (item, i) {
    var runtime = records[i + 1], hard = Registry.hardGateState(item, env || process.env);
    return Object.assign({}, item, {
      runtime: runtime,
      hardGate: hard,
      build: Registry.buildState(item, proof),
      effectiveEligibilityOpen: global.runtimeMode === 'OPEN' && runtime.runtimeMode === 'OPEN' && hard.open,
      interpretation: 'eligibility only; B10, B14, budget, provider, receipt and outcome gates remain independent'
    });
  });
  return {
    schemaVersion: 'civilization-valve-snapshot/1.0',
    generatedAt: new Date().toISOString(),
    emergency: Object.assign({}, global, {
      displayName: GLOBAL_DISPLAY_NAME,
      controlScope: 'EXTERNAL_OPERATOR_ONLY',
      internalNeuralHomolog: false,
      inhibits: 'all new sensing-adapter, cognition, selection, learning-write, and motor activity while NUKED',
      preserves: ['persisted state', 'weights', 'ledgers', 'receipts', 'decision traces'],
      recoverySequence: NUKE_STAGES.slice()
    }),
    controls: ControlInventory.snapshot(env || process.env),
    buildSummary: {
      sourceChainsImplemented: lines.filter(function (x) { return x.build.implementation === 'CLOSED_SOURCE_CHAIN'; }).length,
      currentJob7Pilots: lines.filter(function (x) { return x.build.sequence === 'JOB_7_CURRENT'; }).length,
      sequencedAfterJobs7And8: lines.filter(function (x) { return x.build.sequence === 'JOB_9_AFTER_JOBS_7_8'; }).length,
      externallyAutonomous: lines.filter(function (x) { return x.build.externalAutonomy === 'PROVEN'; }).length,
      interpretation: 'code presence is not production proof; production proof is not standing external autonomy'
    },
    lines: lines
  };
}

module.exports = {
  SCHEMA: SCHEMA, GLOBAL_ID: GLOBAL_ID, GLOBAL_DISPLAY_NAME: GLOBAL_DISPLAY_NAME,
  NUKE_STAGES: NUKE_STAGES, LOG_KEY: LOG_KEY, key: key, read: read, set: set,
  advanceNuke: advanceNuke, authorize: authorize, authorizeActivity: authorizeActivity,
  routeAllowedAtStage: routeAllowedAtStage, researchProof: researchProof,
  financeProof: financeProof, snapshot: snapshot
};
