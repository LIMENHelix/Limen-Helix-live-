'use strict';

var crypto = require('node:crypto');
var Store = require('./autofire-efference-store.js');
var Registry = require('./civilization-valve-registry.js');
var ControlInventory = require('./civilization-control-inventory.js');
var ResearchDevelopmental = require('./research-paper-developmental-authority.js');
var FinanceCommissioning = require('./finance-sandbox-commissioning.js');

var SCHEMA = 'civilization-valve-receipt/1.0';
var GLOBAL_ID = 'global:emergency';
var LOG_KEY = 'civilization_valve_receipt_log';
var LOG_CAP = 500;

function key(id) { return 'civilization_valve:' + String(id || ''); }
function idFor(valveId, mode, at) {
  return 'valve_' + crypto.createHash('sha256').update([valveId, mode, at].join('\u0000')).digest('hex').slice(0, 24);
}
function validId(id) { return id === GLOBAL_ID || !!Registry.get(id); }
function normalize(record, id) {
  if (!record) return { valveId: id, runtimeMode: 'OPEN', source: 'DEFAULT_OPEN', receiptId: null, changedAt: null };
  if (record.schemaVersion !== SCHEMA || record.valveId !== id || (record.runtimeMode !== 'OPEN' && record.runtimeMode !== 'CLOSED')) {
    throw new Error('civilization valve record invalid for ' + id);
  }
  return record;
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
  var receipt = {
    schemaVersion: SCHEMA,
    receiptId: idFor(id, mode, at),
    valveId: id,
    runtimeMode: mode,
    changedAt: new Date(at).toISOString(),
    changedBy: String(actor || 'master-operator'),
    effect: mode === 'CLOSED' ? 'new efferent dispatch inhibited' : 'eligibility restored; brain, budget, provider and hard gates still bind',
    observersRemainOpen: true,
    recoveryRemainsOpen: true
  };
  await store.set(key(id), receipt);
  var restored = normalize(await store.get(key(id)), id);
  if (restored.receiptId !== receipt.receiptId || restored.runtimeMode !== mode) throw new Error('civilization valve readback verification failed');
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
    if (rows[0].runtimeMode === 'CLOSED') return { ok: true, allowed: false, valveId: id, reason: 'global-emergency-valve-closed', receipt: rows[0] };
    if (rows[1].runtimeMode === 'CLOSED') return { ok: true, allowed: false, valveId: id, reason: 'domain-runtime-valve-closed', receipt: rows[1] };
    return { ok: true, allowed: true, valveId: id, reason: 'runtime-valves-open', receipt: rows[1] };
  } catch (error) {
    return { ok: false, allowed: false, valveId: id, reason: 'valve-control-unavailable-fail-closed', detail: String(error && error.message || error) };
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
    emergency: global,
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

module.exports = { SCHEMA: SCHEMA, GLOBAL_ID: GLOBAL_ID, LOG_KEY: LOG_KEY, key: key, read: read, set: set, authorize: authorize, researchProof: researchProof, financeProof: financeProof, snapshot: snapshot };
