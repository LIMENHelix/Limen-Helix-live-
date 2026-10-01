'use strict';

// Actual browser observation scripts, injected transport-only brain state.
// No native brain, packet diagnosis builder, governor or business motor runs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const profiles = [
  ['infrastructure', 'infraModel', 'brainInfrastructureModel'],
  ['culture', 'cultureModel', 'brainCultureModel'],
  ['finance', 'financeModel', 'brainFinanceModel'],
  ['economy', 'economyModel', 'brainEconomyModel'],
  ['industry', 'industryModel', 'brainIndustryModel'],
  ['population', 'populationModel', 'brainPopulationModel'],
  ['law', 'lawModel', 'brainLawModel'],
  ['energy', 'energyModel', 'brainEnergyModel'],
  ['supplyChain', 'supplyChainModel', 'brainSupplyChainModel'],
  ['environment', 'environmentModel', 'brainEnvironmentModel'],
  ['governance', 'governanceModel', 'brainGovernanceModel'],
  ['health', 'healthModel', 'brainHealthModel'],
  ['education', 'educationModel', 'brainEducationModel']
];
const files = ['assets/js/domain-brain-adapter.js', 'assets/js/civilization/domain-packet-adapter.js',
  'assets/js/civilization/handoff-contract.js', 'assets/js/limen-decision.js'];
const clone = value => JSON.parse(JSON.stringify(value));

function runtime() {
  const listeners = new Map();
  let now = Date.now();
  class FixtureDate extends Date { static now() { return now; } }
  const window = {
    LIMENDomains: {},
    addEventListener(name, cb) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(cb); },
    dispatchEvent(event) { for (const cb of listeners.get(event.type) || []) cb(event); }
  };
  const context = vm.createContext({ window, Date: FixtureDate, console, CustomEvent: class {
    constructor(type, options) { this.type = type; this.detail = options.detail; }
  }, setTimeout() { return 1; }, setInterval() { return 1; }, clearTimeout() {},
  fetch() { throw Error('Observation bridge must not make network requests'); } });
  for (const file of files) vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  return { window, emit: (domainId, state) => window.dispatchEvent({ type: 'limen:domain-brain-update', detail: { domainId, state } }),
    age(ms) { now += ms; } };
}

function check(profile, index) {
  const [domain, stateField, payloadField] = profile;
  const run = runtime();
  const diagnosisPacket = { identity: { diagnosisId: 'transport-fixture-' + domain },
    promptView: { retainedBlockers: ['source-bundle-build-required'], retainedWarnings: ['transport fixture only'] } };
  const model = { cycle: 1, readyForHandoff: false, domainDiagnosisPacket: diagnosisPacket };
  const state = { domainId: domain, updated: Date.now(), stress: null, confidence: null,
    diagnoses: [], opportunities: [], treatments: [], feeds: [], [stateField]: model };
  if (domain === 'economy') state.brainEconomyModel = { interpretiveMacroMarker: 'not-the-recurrent-model' };
  const before = JSON.stringify(state);
  run.emit(domain, state);
  const slot = run.window.LIMENDomains[domain];
  assert.ok(slot[payloadField], `${domain}: owning model is missing from actual event adapter output`);
  assert.deepEqual(clone(slot[payloadField]), model, `${domain}: actual event bridge must forward the existing owning model`);
  const packet = run.window.LIMENCivilizationAdapter.rebuildNow()[domain];
  assert.ok(packet.deepBrain, `${domain}: existing packet consumer must receive the model`);
  assert.deepEqual(clone(packet.deepBrain.domainDiagnosisPacket), diagnosisPacket, 'Diagnostic packet and retained blockers survive');
  assert.equal(JSON.stringify(state), before, 'Observation does not mutate brain state');
  assert.deepEqual(clone(packet.truth.activeDiagnoses), []);
  assert.deepEqual(clone(packet.truth.opportunities), []);
  assert.equal(run.window.LIMENMainBrainHandoff.recompute().totalPackets, 0, 'A model cannot fabricate a routed opportunity');
  assert.equal(slot.decision.boundedAction, 'monitor', 'Browser decision stays interpretive observation');
  // Snapshot replacement preserves model only while the existing cache is live.
  run.window.LIMENDomains[domain] = {};
  run.window.dispatchEvent({ type: 'limen:domain-update' });
  assert.deepEqual(clone(run.window.LIMENDomains[domain][payloadField]), model);
  run.age(6 * 60 * 1000);
  run.window.LIMENDomains[domain] = {};
  run.window.dispatchEvent({ type: 'limen:domain-update' });
  assert.equal(run.window.LIMENDomains[domain][payloadField], undefined, 'Expired cache cannot restore a model');
  assert.equal(run.window.LIMENCivilizationAdapter.rebuildNow()[domain].deepBrain, null);
  const absent = runtime();
  absent.emit(domain, state);
  const cleared = { ...state, [stateField]: null };
  absent.emit(domain, cleared);
  assert.equal(absent.window.LIMENDomains[domain][payloadField], null, 'A later absent model replaces the old observation');
  assert.equal(absent.window.LIMENCivilizationAdapter.rebuildNow()[domain].deepBrain, null);
  if (index < 7) {
    const mismatch = runtime();
    mismatch.emit('education', state);
    assert.equal(mismatch.window.LIMENDomains.education[payloadField], null, 'New model projection must not borrow another owner');
  }
  if (domain === 'industry' || domain === 'education') {
    const rootField = domain + 'DomainDiagnosisPacket';
    const projectedField = domain === 'industry' ? 'brainIndustryDiagnosisPacket' : 'brainEducationDiagnosisPacket';
    const root = runtime();
    const rootState = { ...state, [stateField]: { cycle: 1 }, [rootField]: diagnosisPacket };
    root.emit(domain, rootState);
    assert.deepEqual(clone(root.window.LIMENCivilizationAdapter.rebuildNow()[domain].deepBrain.domainDiagnosisPacket), diagnosisPacket);
    assert.equal(root.window.LIMENMainBrainHandoff.recompute().totalPackets, 0, 'Separate diagnosis packet remains observation only');
    root.emit(domain, { ...rootState, [rootField]: null });
    assert.equal(root.window.LIMENCivilizationAdapter.rebuildNow()[domain].deepBrain.domainDiagnosisPacket, null, 'Absent native root packet replaces earlier observation');
    const mismatched = runtime();
    mismatched.emit('energy', rootState);
    assert.equal(mismatched.window.LIMENDomains.energy[projectedField], null, 'Separate packet must not borrow another event owner');
    const preferred = runtime();
    preferred.emit(domain, { ...state, [rootField]: { identity: { diagnosisId: 'root-must-not-replace-model-packet' } } });
    assert.deepEqual(clone(preferred.window.LIMENCivilizationAdapter.rebuildNow()[domain].deepBrain.domainDiagnosisPacket), diagnosisPacket, 'Existing model packet precedence retained');
  }
  if (domain === 'law') {
    const circular = runtime();
    const auditPacket = { identity: { diagnosisId: 'cycle-transport-fixture' }, audit: {} };
    const auditModel = { cycle: 1, domainDiagnosisPacket: auditPacket };
    auditPacket.audit.lawModel = auditModel;
    const shared = { retained: 'ordinary sibling alias' };
    auditPacket.sharedA = shared; auditPacket.sharedB = shared;
    auditPacket['a/b~'] = {}; auditPacket['a/b~'].self = auditPacket['a/b~'];
    auditPacket.array = []; auditPacket.array.push(auditPacket.array);
    circular.emit(domain, { ...state, [stateField]: auditModel });
    const transported = JSON.parse(JSON.stringify(circular.window.LIMENCivilizationAdapter.rebuildNow()[domain]));
    const projected = transported.deepBrain.domainDiagnosisPacket;
    assert.deepEqual(projected.audit.lawModel.domainDiagnosisPacket, { $limenObservationRef: '#/domainDiagnosisPacket', $limenObservationRoot: 'deepBrain' });
    assert.deepEqual(projected.sharedA, shared); assert.deepEqual(projected.sharedB, shared);
    assert.equal(projected['a/b~'].self.$limenObservationRef, '#/domainDiagnosisPacket/a~1b~0');
    assert.equal(projected.array[0].$limenObservationRef, '#/domainDiagnosisPacket/array');
    assert.equal(auditModel.domainDiagnosisPacket, auditPacket, 'Native model graph is not rewritten');
    assert.equal(auditPacket.audit.lawModel, auditModel, 'Native audit graph is not rewritten');
    assert.deepEqual(transported.truth.opportunities, []);
    assert.equal(circular.window.LIMENMainBrainHandoff.recompute().totalPackets, 0);
  }
  return { domain, stateField, payloadField, packetPreserved: true, canonicalArraysUnchanged: true,
    handoffs: 0, ttlRespected: true, absenceReplaced: true };
}

const results = [], failures = [];
for (let index = 0; index < profiles.length; index++) {
  try { results.push(check(profiles[index], index)); console.log('PASS ' + profiles[index][0] + ': event, existing packet, retained blockers, canonical arrays, TTL, replacement'); }
  catch (error) { failures.push(profiles[index][0]); console.error('FAIL ' + profiles[index][0] + ': ' + error.message); }
}
assert.deepEqual(failures, [], 'All thirteen currently implemented recurrent packet consumers need their existing bridge');
if (process.argv.includes('--write-evidence')) fs.writeFileSync('docs/audits/continuity-browser-model-bridge-20261001.json', JSON.stringify({
  level: 'LOCAL/BROWSER TRANSPORT FIXTURE', nativeCognitionProof: false, networkCalls: 0,
  files: files.map(file => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') })), results
}, null, 2) + '\n');
