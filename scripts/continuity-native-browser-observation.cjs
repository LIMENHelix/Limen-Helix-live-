'use strict';

// Test helper: consumes the event emitted by an actual native fixture cycle.
// Does not construct or alter brain models, diagnoses, opportunities or motors.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const files = ['assets/js/domain-brain-adapter.js', 'assets/js/civilization/domain-packet-adapter.js', 'assets/js/limen-decision.js'];
const models = {
  infrastructure: ['infraModel', 'brainInfrastructureModel'], culture: ['cultureModel', 'brainCultureModel'],
  finance: ['financeModel', 'brainFinanceModel'], economy: ['economyModel', 'brainEconomyModel'],
  industry: ['industryModel', 'brainIndustryModel'], population: ['populationModel', 'brainPopulationModel'],
  law: ['lawModel', 'brainLawModel'], energy: ['energyModel', 'brainEnergyModel'],
  supplyChain: ['supplyChainModel', 'brainSupplyChainModel'], environment: ['environmentModel', 'brainEnvironmentModel'],
  governance: ['governanceModel', 'brainGovernanceModel'], health: ['healthModel', 'brainHealthModel'],
  education: ['educationModel', 'brainEducationModel']
};
function clone(value, seen = new Map()) {
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  const out = Array.isArray(value) ? [] : {};
  seen.set(value, out);
  for (const key of Object.keys(value)) out[key] = clone(value[key], seen);
  return out;
}
exports.observe = function (event) {
  const { domainId, state } = event.detail;
  const before = clone(state), listeners = new Map();
  const window = { LIMENDomains: {}, addEventListener(name, cb) {
    if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(cb);
  }, dispatchEvent(event) { for (const cb of listeners.get(event.type) || []) cb(event); } };
  const context = vm.createContext({ window, Date, console, CustomEvent: class {
    constructor(type, options) { this.type = type; this.detail = options.detail; }
  }, setTimeout() { return 1; }, setInterval() { return 1; }, clearTimeout() {},
  fetch() { throw Error('Native event observation must not fetch'); } });
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  window.dispatchEvent(event);
  const slot = window.LIMENDomains[domainId];
  assert(slot, domainId + ': emitted owner must receive observation');
  assert.deepEqual(clone(slot.brainDiagnoses), clone(state.diagnoses));
  assert.deepEqual(clone(slot.brainOpportunities), clone(state.opportunities));
  const packet = window.LIMENCivilizationAdapter.rebuildNow()[domainId];
  assert(packet, domainId + ': actual packet reader must observe owner');
  assert.deepEqual(clone(packet.truth.opportunities), clone(state.opportunities));
  const profile = models[domainId];
  const model = profile && state[profile[0]];
  const rootPacket = domainId === 'education' ? state.educationDomainDiagnosisPacket :
    domainId === 'industry' ? state.industryDomainDiagnosisPacket : null;
  if (profile) {
    assert.deepEqual(clone(slot[profile[1]]), model && typeof model === 'object' && !Array.isArray(model) ? clone(model) : null);
    assert.equal(!!packet.deepBrain, !!model, domainId + ': actual model presence must survive');
    if (model && model.domainDiagnosisPacket) assert.deepEqual(clone(packet.deepBrain.domainDiagnosisPacket), clone(model.domainDiagnosisPacket));
    if (rootPacket) {
      assert.ok(packet.deepBrain.domainDiagnosisPacket, domainId + ': separately stored native diagnosis packet is missing');
      assert.deepEqual(clone(packet.deepBrain.domainDiagnosisPacket), clone(rootPacket), domainId + ': actual separately stored native diagnosis packet must reach the existing observation envelope');
    }
  } else assert.equal(packet.deepBrain, null, 'Absent domain-specific reader cannot fabricate a model');
  assert.deepEqual(clone(state), before, 'Observation must not mutate native brain state');
  return { level: 'LOCAL/NATIVE FIXTURE EVENT', emittedOwner: domainId,
    canonicalDiagnosesPreserved: true, canonicalOpportunitiesPreserved: true,
    modelReaderExists: !!profile, modelStateField: profile ? profile[0] : null,
    modelPresent: !!model, diagnosisPacketPresent: !!(packet.deepBrain && packet.deepBrain.domainDiagnosisPacket),
    firstObservationBoundary: !profile ? 'no-existing-domain-specific-model-reader' : !model ? 'native-cycle-produced-no-model' :
      !packet.deepBrain.domainDiagnosisPacket ? 'native-model-produced-no-diagnosis-packet' : 'native-diagnosis-packet-observed',
    decision: slot.decision ? clone(slot.decision) : null, motorExecutionProven: false, externalRequests: 0,
    sources: files.map(file => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '..', file))).digest('hex') })) };
};
