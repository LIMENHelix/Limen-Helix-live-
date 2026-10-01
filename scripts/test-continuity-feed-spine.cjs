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
  ['energy', 'LIMENEnergyBrain', 'energy'],
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

// Input fixtures enter through the shared snapshot and local portal reads.
// No diagnoses, opportunities, neurology or motor state are preloaded.
var fixtures = Object.create(null), reads = [];
sb.fetch = async function (url) {
  var relative = String(url).split('?')[0].replace(/^\//, '');
  var target = path.resolve(ROOT, relative);
  if (target.startsWith(ROOT + path.sep) && relative.endsWith('.json') && fs.existsSync(target)) {
    reads.push(relative);
    var body = JSON.parse(fs.readFileSync(target, 'utf8'));
    return { ok: true, status: 200, json: async function () { return body; }, text: async function () { return JSON.stringify(body); } };
  }
  return { ok: false, status: 404, json: async function () { return {}; } };
};
domains.forEach(function (row) {
  var brain = sb[row[1]], key = brain.snapshotKey;
  assert.equal(brain.state.diagnoses.length, 0);
  assert.equal(brain.state.opportunities.length, 0);
  fixtures[key] = { stress: 0.72, confidence: 0.85, activity: 0.7, phase: 'p0', phaseLabel: 'SOURCE', maturity: 'EARLY', signals: [],
    sources: [{ name: row[0] === 'agriculture' ? 'USDA Drought Monitor' : row[0] + ' identified fixture source',
      live: true, value: row[0] === 'agriculture' ? 45 : 0.72, label: 'LOCAL/FIXTURE', signal: 'identified fixture observation',
      channel: 'stress', quality: 0.9, classification: 'real', updated: Date.now() }] };
});
sb.LIMENDomains = fixtures;
(async function () {
  var Packet = require('../lib/civilization-server-packet.js');
  var Consumer = require('../lib/civilization-handoff-consumer.js');
  var results = [];
  for (var row of domains) {
    var brain = sb[row[1]];
    await brain.cycle();
    var feeds = brain.state.feeds || [], diagnoses = brain.state.diagnoses || [], opportunities = brain.state.opportunities || [];
    var active = diagnoses.filter(function (d) { return d.active === true; });
    var typed = opportunities.filter(function (o) { return typeof o.path === 'string' && o.path; });
    var sensed = feeds.some(function (f) { return f.name === fixtures[brain.snapshotKey].sources[0].name && f.live === true; });
    var boundary = !sensed ? 'identified-source-not-ingested' : !active.length ? 'fixture-source-has-no-active-native-diagnosis' : !typed.length ? 'native-diagnosis-has-no-typed-opportunity' : 'typed-opportunity-to-owning-business-consumer-not-joined-in-this-test';
    assert.equal(sensed, true, row[0] + ' must ingest its own identified snapshot source');
    assert(active.length > 0, row[0] + ' must derive an active native diagnosis');
    assert(typed.length > 0, row[0] + ' must derive a typed native opportunity');
    var packet = null, packetError = null, handoffs = [];
    try {
      packet = Packet.fromBrainState(row[0], brain.state, { snapshotId: 'fixture-native-source-snapshot', fetchedAt: Date.now() }, 'fixture-native-refresh', new Date().toISOString());
      assert.equal(packet.domainId, row[0]);
      assert(packet.truth.activeDiagnoses.length > 0);
      packet.truth.opportunities.forEach(function (opportunity) {
        if (Packet.ACTIVE_LANES.includes(opportunity.lane)) {
          try { var handoff = Packet.toHandoff(packet, opportunity.lane, opportunity); handoffs.push({ opportunityId: handoff.opportunityId, lane: handoff.lane, sourcePacketId: handoff.sourcePacketId }); }
          catch (err) { packetError = err.code || err.message; }
        }
      });
      assert.equal(packetError, null, row[0] + ' active-lane opportunities must retain their identity');
      assert(handoffs.length > 0, row[0] + ' must yield a native active-lane handoff');
      var values = new Map(), indexes = new Map();
      var store = { packetIndexKey: 'packets', handoffIndexKey: 'handoffs',
        packetKey: function (id) { return 'packet:' + id; }, handoffKey: function (id) { return 'handoff:' + id; },
        setNx: async function (key, value) { if (values.has(key)) return false; values.set(key, JSON.parse(JSON.stringify(value))); return true; },
        add: async function (key, value) { var entries = indexes.get(key) || new Set(); entries.add(value); indexes.set(key, entries); return entries.size; } };
      var consumer = Consumer.createConsumer({ store: store });
      var consumed = await consumer.consumePacket(packet);
      assert.equal(consumed.ok, true, JSON.stringify(consumed.failures));
      assert.equal(consumed.handoffsCreated, handoffs.length);
      var replay = await consumer.consumePacket(packet);
      assert.equal(replay.handoffsCreated, 0, 'same native packet cannot duplicate handoffs');
      Array.from(indexes.get('handoffs')).forEach(function (id) {
        var persisted = values.get(store.handoffKey(id));
        assert.equal(persisted.sourcePacketId, packet.packetId);
        assert.equal(persisted.sourceDomains[0], row[0]);
        assert.deepEqual(persisted.sourceDiagnoses, packet.truth.activeDiagnoses);
        assert.equal(persisted.opportunity.id, persisted.opportunityId);
      });
      var invalid = JSON.parse(JSON.stringify(packet));
      invalid.truth.opportunities = [Object.assign({}, packet.truth.opportunities.find(function (o) { return Packet.ACTIVE_LANES.includes(o.lane); }), { id: '' })];
      var rejected = await consumer.consumePacket(invalid);
      assert.equal(rejected.handoffsCreated, 0);
      assert.equal(rejected.failures.length, 1, 'missing native identity must fail at the handoff boundary');
      boundary = 'persisted-native-handoff-to-owning-business-motor-not-joined-in-this-test';
    } catch (err) { packetError = err.code || err.message; boundary = packetError; }
    assert.equal(packetError, null, row[0] + ' native packet/handoff chain failed');
    assert.equal(typeof brain.state.stress, 'number');
    assert.equal(Array.isArray(diagnoses), true);
    assert.equal(Array.isArray(opportunities), true);
    results.push({ productDomain: row[0], runtimeOwner: brain.domainId, snapshotKey: brain.snapshotKey,
      evidenceLevel: 'LOCAL/FIXTURE', source: fixtures[brain.snapshotKey].sources[0].name, sourceIngested: sensed,
      activeDiagnoses: active.map(function (d) { return d.id; }), typedOpportunities: typed.map(function (o) { return { id: o.id || null, path: o.path }; }),
      packetId: packet && packet.packetId, packetError: packetError, handoffs: handoffs,
      firstUnprovenBoundary: boundary, providerCalled: false });
  }
  assert.equal(results.length, 20);
  assert.equal(results.find(function (r) { return r.productDomain === 'agriculture'; }).sourceIngested, true);
  var evidence = { schemaVersion: 'continuity-native-feed-spine/1.0', generatedBy: 'scripts/test-continuity-feed-spine.cjs',
    level: 'LOCAL/FIXTURE', injectedDiagnoses: false, injectedOpportunities: false, externalFetches: false,
    localPortalReads: Array.from(new Set(reads)), domains: results };
  if (process.argv.includes('--write-evidence')) fs.writeFileSync(path.join(ROOT, 'docs/audits/continuity-native-feed-spine.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(results.map(function (r) { return { domain: r.productDomain, sensed: r.sourceIngested, diagnoses: r.activeDiagnoses.length, opportunities: r.typedOpportunities.length, boundary: r.firstUnprovenBoundary }; })));
})().catch(function (err) { console.error(err); process.exitCode = 1; });
