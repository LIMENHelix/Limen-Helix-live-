#!/usr/bin/env node
'use strict';

var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var vm = require('node:vm');

var ROOT = path.join(__dirname, '..');
var domains = [
  ['agriculture', 'LIMENAgricultureBrain', 'agriculture'],
  ['communication', 'LIMENCommunicationBrain', 'communication'],
  ['culture', 'LIMENCultureBrain', 'culture'],
  ['defense', 'LIMENDefenseBrain', 'defense'],
  ['economy', 'LIMENEconomyBrain', 'economy'],
  ['education', 'LIMENEducationBrain', 'education'],
  ['environment', 'LIMENEnvironmentBrain', 'environment'],
  ['finance', 'LIMENFinanceBrain', 'finance'],
  ['governance', 'LIMENGovernanceBrain', 'governance'],
  ['industry', 'LIMENIndustryBrain', 'industry'],
  ['infrastructure', 'LIMENInfrastructureBrain', 'infrastructure'],
  ['intelligence', 'LIMENIntelligenceBrain', 'intelligence'],
  ['law', 'LIMENLawBrain', 'law'],
  ['medicine', 'LIMENHealthBrain', 'health'],
  ['population', 'LIMENPopulationBrain', 'population'],
  ['religion', 'LIMENReligionBrain', 'religion'],
  ['science', 'LIMENResearchBrain', 'research'],
  ['technology', 'LIMENTechnologyBrain', 'technology'],
  ['trade', 'LIMENSupplyChainBrain', 'supplyChain']
];

function sandbox() {
  var noop = function () {};
  var s = { console: { log: noop, warn: noop, error: noop, info: noop } };
  s.window = s; s.globalThis = s; s.self = s;
  ['JSON','Math','Date','Object','Array','String','Number','Boolean','Promise','RegExp','Error','Map','Set','WeakMap','Symbol','URL','URLSearchParams'].forEach(function (name) { s[name] = global[name]; });
  s.parseInt = parseInt; s.parseFloat = parseFloat; s.isNaN = isNaN; s.isFinite = isFinite;
  s.encodeURIComponent = encodeURIComponent; s.decodeURIComponent = decodeURIComponent;
  s.setTimeout = function () { return 0; }; s.clearTimeout = noop;
  s.setInterval = function () { return 0; }; s.clearInterval = noop;
  s.requestAnimationFrame = function () { return 0; }; s.cancelAnimationFrame = noop;
  s.CustomEvent = function (type, init) { this.type = type; this.detail = init && init.detail; };
  s.Event = function (type) { this.type = type; };
  s.localStorage = { getItem: function () { return null; }, setItem: noop, removeItem: noop };
  var elt = function () { return { setAttribute: noop, appendChild: noop, addEventListener: noop, classList: { add: noop, remove: noop }, style: {}, dataset: {} }; };
  s.document = { createElement: elt, createElementNS: elt, head: { appendChild: noop }, body: { appendChild: noop },
    getElementById: function () { return null; }, querySelector: function () { return null; }, querySelectorAll: function () { return []; },
    addEventListener: noop, removeEventListener: noop, dispatchEvent: noop, documentElement: { style: {} }, readyState: 'complete' };
  s.addEventListener = noop; s.removeEventListener = noop; s.dispatchEvent = noop;
  s.location = { href: 'https://local.invalid/', pathname: '/', search: '', origin: 'https://local.invalid' };
  s.navigator = { userAgent: 'domain-local-runtime-test' };
  s.fetch = function () { return Promise.resolve({ ok: false, status: 404, json: function () { return Promise.resolve({}); }, text: function () { return Promise.resolve(''); } }); };
  s.LIMENDomains = {};
  s.LIMENSharedSnapshot = { getSnapshot: function () { return { domains: s.LIMENDomains, meta: {} }; },
    requestFresh: function () { return Promise.resolve({ domains: s.LIMENDomains, meta: {} }); }, getDomain: function (id) { return s.LIMENDomains[id] || null; },
    start: noop, subscribe: noop, onUpdate: noop };
  s.LIMENFastBoot = { getConsoleSnapshotSync: function () { return { domains: s.LIMENDomains, meta: {}, domainCompanyJoin: {} }; },
    getOpportunitiesSnapshotSync: function () { return {}; } };
  return s;
}

var sb = sandbox();
vm.createContext(sb);
[
  'assets/js/domain-identity.js',
  'assets/js/limen-k4-selfconsistency.js',
  'assets/js/limen-plasticity.js',
  'assets/js/limen-active-inference.js',
  'assets/js/domain-brains/domain-brain-base.js',
  'assets/js/domain-brains/portal-content-resolver.js',
  'assets/js/domain-brains/inter-brain-bus.js',
  'assets/js/domain-brains/domain-change-log.js'
].concat(domains.map(function (d) { return 'assets/js/domain-brains/' + d[0] + '-brain.js'; }))
  .forEach(function (file) { vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sb, { filename: file }); });

domains.forEach(function (row) {
  var brain = sb[row[1]];
  assert(brain && typeof brain === 'object', row[0] + ' singleton must load');
  var state = brain.state;
  state.stress = 0.42;
  state.diagnoses = [{ active: true, relevance: 0.7 }];
  state.opportunities = [
    { id: row[0] + '-r', title: row[0] + ' research', path: 'RESEARCHABLE', confidence: 67 },
    { id: row[0] + '-i', title: row[0] + ' capital', path: 'INVESTABLE', confidence: 58 }
  ];
  state.resourceMetabolism = { gates: { mayEmitInternal: true } };
  state.domainNeuro = {
    brake: { level: 'clear' },
    gainControl: { inhibition: 0.2, outputScale: 0.8 },
    attention: { focus: [{ salience: 0.6 }], driver: 'evidence-driven' },
    slowModel: { expectedStress: 0.4, fastSlowDivergence: 0.02 },
    homeostasis: { baseline: 0.4, adaptiveThreshold: 0.35 },
    outcomeLedger: { hitRate: 0.5, samples: 2, resolvedTotal: 2 },
    forecast: { direction: 'stable', projectedStress: 0.42, horizonPeriods: 2, confidence: 0.4 }
  };
  state.cognition = { domain: brain.domainId, model: { predictionError: { total: 0.1 } }, immune: { immuneState: 'clear' }, neuro: state.domainNeuro };

  var localRefresh = Object.keys(Object.getPrototypeOf(brain)).filter(function (name) { return /^_refresh.+ActionOutcome$/.test(name); });
  assert.equal(localRefresh.length, 1, row[0] + ' must own one action-outcome refresh method');
  var actionSlot = '_' + row[0] + 'ActionOutcome';
  brain[actionSlot] = {
    ok: true, schemaVersion: 'product-domain-external-learning/1.0', domain: brain.domainId,
    status: 'ELIGIBLE', resolvedCount: 5,
    learningGate: { ready: true, minimumResolved: 5, distinctSources: 2, minimumDistinctSources: 2 },
    signal: { normalizedCredit: 0.8, sourceKind: 'independent-action-outcome' }
  };

  var plasticity = brain._computeDomainPlasticity();
  var queue = brain._computeGenericEmissionQueue();
  var emission = brain._runGenericAutonomousEmission();
  var interoception = brain._computeGenericInteroception();
  var activeInference = brain._computeGenericActiveInference();

  [plasticity, queue, emission, interoception, activeInference].forEach(function (organ) {
    assert(organ && organ.localOwner === true, row[0] + ' organ must execute from its local implementation');
    assert.equal(organ.domain, brain.domainId);
  });
  assert.equal(state[row[2] + 'Plasticity'], plasticity);
  assert.equal(state[row[2] + 'EmissionQueue'], queue);
  assert.equal(state[row[2] + 'AutoEmission'], emission);
  assert.equal(state[row[2] + 'Interoception'], interoception);
  assert.equal(state[row[2] + 'ActiveInference'], activeInference);
  assert.equal(emission.externalEffects, 0);
  assert.equal(interoception.channelCount, interoception.channels.length);
  assert.equal(activeInference.liveConsumer, false);
  assert.equal(activeInference.thing2Consumed, false);
  assert(queue.packages.some(function (p) { return p.requiresSignoff === true; }));
  var actionAuthorized = brain.domainId === 'finance' || brain.domainId === 'research' || brain.domainId === 'health';
  assert.equal(plasticity.rewardActive, actionAuthorized, row[0] + ' action-outcome reward authority must match its domain');
  if (actionAuthorized) assert.equal(plasticity.externalOutcome.source, 'independent-action-outcome');
});

console.log('19 domain-local five-organ implementations execute with separate state and inhibited external authority');
