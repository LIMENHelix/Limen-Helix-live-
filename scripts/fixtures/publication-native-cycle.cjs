'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../..');
module.exports = async function nativeBusinessCycle(origin, readout, fixedAt) {
  const source = fs.readFileSync(path.join(ROOT, 'scripts/test-continuity-feed-spine.cjs'), 'utf8');
  const start = source.indexOf('function sandbox() {');
  const end = source.indexOf('var sb = sandbox();', start);
  assert(start >= 0 && end > start);
  const sb = new Function(source.slice(start, end) + 'return sandbox();')();

  const NativeDate = Date;
  sb.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [fixedAt])); } static now() { return fixedAt; } };
  sb.Math = Object.create(Math); sb.Math.random = () => 0.5;
  vm.createContext(sb);
  const files = ['domain-identity.js', 'limen-k4-selfconsistency.js', 'limen-plasticity.js', 'limen-active-inference.js',
    'domain-brains/domain-brain-base.js', 'domain-brains/portal-content-resolver.js',
    'domain-brains/inter-brain-bus.js', 'domain-brains/domain-change-log.js', 'domain-brains/' + origin + '-brain.js'];
  files.forEach(file => vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js', file), 'utf8'), sb, { filename: file }));
  const names = { defense: 'LIMENDefenseBrain', governance: 'LIMENGovernanceBrain', industry: 'LIMENIndustryBrain', intelligence: 'LIMENIntelligenceBrain', law: 'LIMENLawBrain', infrastructure: 'LIMENInfrastructureBrain' };
  const brain = sb[names[origin]];
  assert(brain && typeof brain.cycle === 'function');
  sb.LIMENDomains[brain.snapshotKey] = { stress: 0.72, confidence: 0.85, activity: 0.7,
    phase: 'p0', phaseLabel: 'SOURCE', maturity: 'EARLY', signals: [], sources: [{
      name: origin + ' identified fixture source', live: true, value: 0.72, label: 'LOCAL/FIXTURE',
      signal: 'identified fixture observation', channel: 'stress', quality: 0.9, classification: 'real',
      updated: fixedAt, fetchedAt: fixedAt, sourceUpdatedAt: 'LOCAL/FIXTURE:' + origin }] };
  let reads = 0;
  sb.fetch = async url => {
    if (String(url).startsWith('/api/product-domain-learning-state?')) {
      assert(String(url).endsWith('domain=' + readout.domain)); reads++;
      return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(readout)) };
    }
    const relative = String(url).split('?')[0].replace(/^\//, '');
    const target = path.resolve(ROOT, relative);
    if (target.startsWith(ROOT + path.sep) && relative.endsWith('.json') && fs.existsSync(target)) {
      return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(target, 'utf8')) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  await Promise.resolve(brain.cycle());
  await new Promise(resolve => setImmediate(resolve));
  assert(reads > 0, 'native cycle did not read its learning endpoint');
  assert.deepEqual(JSON.parse(JSON.stringify(brain.state.domainActionLearning.signal)), readout.signal);
  const before = brain._cycleCount;
  await Promise.resolve(brain.cycle());
  await new Promise(resolve => setImmediate(resolve));
  assert(brain._cycleCount > before, 'subsequent native evaluation did not run');
  assert(brain.state.cognition);
  assert(brain.state.diagnoses.length > 0 && brain.state.opportunities.length > 0, 'comparison requires nonempty native evaluations');
  assert.equal(brain.state.domainActionLearning.learningGate.ready, readout.learningGate.ready);

  return { externalRewardEligible: sb.LIMENK4.externalRewardEligible(brain.domainId, 'independent-action-outcome'), learning: JSON.parse(JSON.stringify(brain.state.domainActionLearning)),
    plasticity: JSON.parse(JSON.stringify(brain.state.domainPlasticity || null)),
    evaluated: JSON.parse(JSON.stringify({ diagnoses: brain.state.diagnoses, opportunities: brain.state.opportunities,
      stress: brain.state.stress, confidence: brain.state.confidence })) };
};
