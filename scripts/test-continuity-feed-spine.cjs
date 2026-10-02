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
  s.nativeEvents = [];
  s.addEventListener = noop; s.removeEventListener = noop;
  s.dispatchEvent = function (event) {
    if (event.type === 'limen:domain-brain-update') s.nativeEvents.push(event);
  };
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
  fixtures[key].sources[0].sourceUpdatedAt = 'LOCAL/FIXTURE source-record:' + row[0];
  fixtures[key].sources[0].fetchedAt = fixtures[key].sources[0].updated;
});
sb.LIMENDomains = fixtures;
(async function () {
  var Packet = require('../lib/civilization-server-packet.js');
  var SnapshotInput = require('../lib/brain-cognition-snapshot-input.js');
  var Consumer = require('../lib/civilization-handoff-consumer.js');
  var FinanceIntake = require('../lib/finance-domain-intake.js');
  var FinanceSource = require('../lib/finance-source-universe.js');
  var FinanceLedger = require('../lib/finance-input-ledger.js');
  var FinanceRegistry = require('../assets/data/finance-company-identities.json');
  var ResearchCandidate = require('../lib/domain-research-candidate.js');
  var DomainSemantic = require('../lib/domain-semantic-packet.js');
  var DomainBridge = require('../lib/autofire-domain-bridge.js');
  var MotorAuthorization = require('../lib/product-domain-motor-authorization.js');
  var DevelopmentalAuthority = require('../lib/research-paper-developmental-authority.js');
  var ResearchReadout = require('../lib/research-business-trace-readout.js');
  var CultureDecision = require('../lib/culture-hero-decision.js');
  var CulturePolicy = require('../lib/culture-hero-policy.js');
  var CultureReadout = require('../lib/culture-business-trace-readout.js');
  var shadowValues = new Map(), shadowLists = new Map();
  function shadowClone(value) { return value == null ? null : JSON.parse(JSON.stringify(value)); }
  var redisPath = require.resolve('../lib/brain-shadow-redis.js');
  require.cache[redisPath] = { id: redisPath, filename: redisPath, loaded: true, exports: {
    NAMESPACE_PREFIX: 'limen:', assertConfigured: function () { return true; },
    get: async function (key) { return shadowClone(shadowValues.get(key)); },
    set: async function (key, value) { shadowValues.set(key, shadowClone(value)); return true; },
    setNX: async function (key, value) { if (shadowValues.has(key)) return false; shadowValues.set(key, shadowClone(value)); return true; },
    lpush: async function (key, value) { var list = shadowLists.get(key) || []; list.unshift(shadowClone(value)); shadowLists.set(key, list); return list.length; },
    lrange: async function (key, start, end) { return shadowClone((shadowLists.get(key) || []).slice(start, end < 0 ? undefined : end + 1)); },
    ltrim: async function (key, start, end) { shadowLists.set(key, (shadowLists.get(key) || []).slice(start, end + 1)); return true; }
  } };
  var ShadowRuntime = require('../lib/brain-shadow-runtime.js');
  var ArtifactWorker = require('../handlers/limen-worker-autofire.js');
  var results = [];
  for (var row of domains) {
    var brain = sb[row[1]];
    await brain.cycle();
    var nativeEvent = sb.nativeEvents.find(function (event) { return event.detail.domainId === brain.domainId; });
    assert(nativeEvent, row[0] + ' actual cycle must emit its owning browser event');
    assert.equal(nativeEvent.detail.state, brain.state);
    var browserObservation = require('./continuity-native-browser-observation.cjs').observe(nativeEvent);
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
      var sourceRow = SnapshotInput.readDomain(fixtures, row[0]);
      assert.equal(sourceRow, fixtures[brain.snapshotKey], 'canonical alias must read its exact runtime snapshot');
      var nativeFeedEvidence = Packet.feedSourceEvidence(row[0], sourceRow);
      packet = Packet.fromBrainState(row[0], brain.state, { snapshotId: 'fixture-native-source-snapshot', fetchedAt: Date.now() }, 'fixture-native-refresh', new Date().toISOString(),
        { feedSourceEvidence: nativeFeedEvidence });
      assert.equal(packet.truth.feedSourceEvidence.ownerDomain, row[0]);
      assert.equal(packet.truth.feedSourceEvidence.sources[0].sourceUpdatedAt, sourceRow.sources[0].sourceUpdatedAt);
      assert.equal(packet.truth.feedSourceEvidence.sources[0].fetchedAt, sourceRow.sources[0].fetchedAt);
      assert.equal(packet.truth.feedSourceEvidence.authority, 'observation-only');
      var unobservedSources = Packet.feedSourceEvidence(row[0], null);
      assert.equal(unobservedSources.status, 'UNOBSERVED');
      assert.deepEqual(unobservedSources.sources, []);
      assert.equal(Packet.feedSourceEvidence(row[0], { sources: [{ name: 'missing identity', live: false }] }).sources[0].sourceUpdatedAt, null);
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
        get: async function (key) { return values.has(key) ? JSON.parse(JSON.stringify(values.get(key))) : null; },
        members: async function (key) { return Array.from(indexes.get(key) || []); },
        add: async function (key, value) { var entries = indexes.get(key) || new Set(); entries.add(value); indexes.set(key, entries); return entries.size; } };
      var consumer = Consumer.createConsumer({ store: store });
      var consumed = await consumer.consumePacket(packet);
      assert.equal(consumed.ok, true, JSON.stringify(consumed.failures));
      assert.equal(consumed.handoffsCreated, handoffs.length);
      for (var sourceHandoffId of await store.members('handoffs')) {
        var sourceHandoff = await store.get(store.handoffKey(sourceHandoffId));
        assert.deepEqual(sourceHandoff.feedSourceEvidence, nativeFeedEvidence);
        assert.equal(sourceHandoff.sourcePacketId, packet.packetId);
      }
      var primaryIntakeBoundary = null;
      if (row[0] === 'finance') {
        var nativeFinanceProducer = require('../lib/finance-opportunity-producer.js');
        var nativeFinanceAdmission = require('../lib/finance-paper-admission.js');
        var beforeNativeFinance = JSON.stringify(Array.from(values));
        var nativeFinanceChecks = packet.truth.opportunities.map(function (opportunity) {
          var refused = nativeFinanceProducer.build({ proposal: opportunity });
          assert.equal(refused.status, 'ABSTAINED');
          assert.equal(refused.company, null);
          assert.equal(refused.simulationOnly, true);
          assert.equal(refused.liveExecution, false);
          assert(refused.blockers.includes('finance_input_ledger_not_ready'));
          assert(refused.blockers.includes('proposal_schema_required'));
          return { opportunityId: opportunity.id, blockers: refused.blockers };
        });
        var nativeAdmissionStore = Object.assign({}, store, { assertDurable: function () {}, setIfAbsent: store.setNx });
        var nativeAdmissionAudit = await nativeFinanceAdmission.audit(nativeAdmissionStore, packet.packetId);
        assert.equal(nativeAdmissionAudit.status, 'ABSTAINED');
        assert(nativeAdmissionAudit.blockers.includes('finance_preview_receipt_required'));
        assert.equal(nativeAdmissionAudit.brokerTouched, false);
        assert.equal(nativeAdmissionAudit.orderPlaced, false);
        assert.equal(JSON.stringify(Array.from(values)), beforeNativeFinance);
        primaryIntakeBoundary = { ownerDomain: 'finance', lane: 'investment', sourcePacketId: packet.packetId,
          evidenceLevel: 'LOCAL/FIXTURE', nativeOpportunityChecks: nativeFinanceChecks,
          admission: { status: nativeAdmissionAudit.status, blockers: nativeAdmissionAudit.blockers },
          nextBoundary: 'finance_input_ledger_not_ready;proposal_schema_required', providerCalled: false,
          companyOrProposalInferred: false, candidateFabricated: false };
      }
      if (row[0] === 'agriculture') {
        var nativeWorker = require('../handlers/limen-worker-autofire.js');
        var beforeNativeQueue = JSON.stringify(Array.from(values));
        var nativeQueueChecks = [];
        for (var nativeHandoffId of indexes.get('handoffs')) {
          var nativeHandoff = await store.get(store.handoffKey(nativeHandoffId));
          assert.equal(nativeWorker.isEligibleCandidate(nativeHandoff, Date.parse(packet.generatedAt)), false);
          assert.equal(nativeWorker.isEligibleCandidate(nativeHandoff.opportunity, Date.parse(packet.generatedAt)), false);
          assert.equal(nativeHandoff.sourcePacketId, packet.packetId);
          assert.equal(nativeHandoff.opportunityId, nativeHandoff.opportunity.id);
          nativeQueueChecks.push({ handoffId: nativeHandoffId, opportunityId: nativeHandoff.opportunityId,
            lane: nativeHandoff.lane, eligible: false });
        }
        assert(nativeQueueChecks.length > 0);
        var agricultureReturnStore = Object.assign({}, store, { assertDurable: function () {} });
        var agricultureReturn = await require('../lib/autofire-learning.js').readAgricultureReturns(agricultureReturnStore);
        assert.equal(agricultureReturn.status, 'ABSTAINED');
        assert.equal(agricultureReturn.reason, 'agriculture-opportunity-owner-outcomes-not-yet-returned');
        assert.equal(agricultureReturn.returnedCount, 0); assert.equal(agricultureReturn.latest, null);
        assert.equal(agricultureReturn.observationOnly, true); assert.deepEqual(agricultureReturn.failures, []);
        var agricultureProjection = require('../lib/brain-cognition-compact.js').learningReadout({ domain: 'agriculture',
          status: 'ABSTAINED', reason: agricultureReturn.reason, routedOutcomeReturn: agricultureReturn });
        assert.equal(agricultureProjection.routedOutcomeReturn.reason, agricultureReturn.reason);
        assert.equal(agricultureProjection.routedOutcomeReturn.observationOnly, true);
        assert.equal(agricultureProjection.routedOutcomeReturn.latest, null);
        assert.equal(JSON.stringify(Array.from(values)), beforeNativeQueue);
        primaryIntakeBoundary = { ownerDomain: 'agriculture', lane: 'origin-routing', sourcePacketId: packet.packetId,
          nativeQueueChecks: nativeQueueChecks, evidenceLevel: 'LOCAL/FIXTURE', providerCalled: false,
          nextBoundary: 'native-agriculture-handoff-is-not-eligible-autofire-actor-candidate',
          destinationSelectionCreated: false, agricultureMotorCreated: false, homesteadExcluded: true,
          nativeReturnBoundary: agricultureProjection.routedOutcomeReturn };
      }
      var nativeCommercialJoin = null;
      if (['communication', 'culture'].includes(row[0])) {
        const nativeCommercial = require('../lib/domain-commercial-lanes.js').get(row[0]);
        const record = { ts: Date.parse(packet.generatedAt), c: { ...brain.state.cognition, domain: row[0],
          serverPacket: packet, serverPacketPersistence: consumed,
          brainOrgans: { resourceMetabolism: brain.state.resourceMetabolism } } };
        const reflex = nativeCommercial.evaluate(record, null, Date.parse(packet.generatedAt));
        console.log(row[0] + ' native commercial boundary', reflex.status, reflex.reason);
        assert.equal(reflex.status, 'ABSTAINED');
        assert.equal(reflex.reason, 'owning-domain-semantic-evidence-unavailable');
        assert.equal(reflex.externalEffectAuthorized, false);
        const artifact = require('../lib/domain-commercial-artifact.js').build(nativeCommercial.contract, reflex, Date.parse(packet.generatedAt));
        assert.notEqual(artifact.status, 'ARTIFACT_PREPARED');
        assert.equal(artifact.artifact, null);
        const semanticAt = Date.parse(packet.generatedAt);
        const commercialTitles = [0, 1].map(feed => ({ t: packet.generatedAt, d: row[0],
          f: 'LOCAL/FIXTURE ' + row[0] + ' feed ' + feed, hh: feed, ck: 'headline_title',
          items: [{ i: 0, ti: 'Identified fixture ' + row[0] + ' observation ' + feed,
            au: 'https://fixture.invalid/' + row[0] + '/' + feed, pa: packet.generatedAt, pl: 'Fixture publisher ' + feed }] }));
        const commercialSemantic = DomainSemantic.build(commercialTitles, row[0], semanticAt);
        commercialSemantic.meta.ownerDomain = row[0]; commercialSemantic.meta.sourceDomain = row[0];
        await Promise.resolve(brain.cycle());
        const commercialPacket = Packet.fromBrainState(row[0], brain.state,
          { snapshotId: 'fixture-native-source-snapshot', fetchedAt: semanticAt }, 'fixture-commercial-semantic-refresh', packet.generatedAt,
          { semanticEvidence: commercialSemantic.observations, semanticEvidenceMeta: commercialSemantic.meta, feedSourceEvidence: nativeFeedEvidence });
        const commercialConsumer = Consumer.createConsumer({ store: { ...store, packetIndexKey: 'commercial-packets', handoffIndexKey: 'commercial-handoffs' } });
        const commercialPersistence = await commercialConsumer.consumePacket(commercialPacket);
        assert.equal(commercialPersistence.ok, true, JSON.stringify(commercialPersistence));
        const commercialRecord = { ...record, c: { ...record.c, serverPacket: commercialPacket, serverPacketPersistence: commercialPersistence } };
        const plan = nativeCommercial.evaluate(commercialRecord, null, semanticAt);
        assert.equal(plan.status, 'PLANNED', plan.reason);
        const commercialLists = new Map();
        const commercialStore = { ...store, assertDurable() {}, setIfAbsent: store.setNx,
          set: async (key, value) => { values.set(key, JSON.parse(JSON.stringify(value))); return true; },
          replaceIfValue: async (key, expected, value) => { if (JSON.stringify(values.get(key) || null) !== JSON.stringify(expected)) return false;
            values.set(key, JSON.parse(JSON.stringify(value))); return true; },
          lpush: async (key, value) => { const rows = commercialLists.get(key) || []; rows.unshift(JSON.parse(JSON.stringify(value))); commercialLists.set(key, rows); return rows.length; },
          lrange: async (key, start, end) => JSON.parse(JSON.stringify((commercialLists.get(key) || []).slice(start, end + 1))),
          ltrim: async (key, start, end) => { commercialLists.set(key, (commercialLists.get(key) || []).slice(start, end + 1)); return true; } };
        const durablePlan = await nativeCommercial.persist(commercialStore, plan);
        assert.equal(durablePlan.readbackVerified, true);
        const prepared = require('../lib/domain-commercial-artifact.js').build(nativeCommercial.contract, durablePlan, semanticAt + 1);
        assert.equal(prepared.status, 'ARTIFACT_PREPARED', prepared.reason);
        assert.equal(prepared.artifact.sourcePacketId, commercialPacket.packetId);
        assert.equal(prepared.artifact.truthBoundary.fullTextRead, false);
        assert.equal(prepared.artifact.externalEffectAuthorized, false);
        const durableArtifact = await require('../lib/domain-commercial-artifact.js').persist(commercialStore, nativeCommercial.contract, prepared);
        assert.equal(durableArtifact.status, 'ARTIFACT_PREPARED');
        const socialCandidate = await require('../lib/domain-commercial-social-candidate.js').read(commercialStore, row[0], semanticAt + 2);
        assert.equal(socialCandidate.ok, true, socialCandidate.reason);
        assert.equal(socialCandidate.sourcePacketId, commercialPacket.packetId);
        const distribution = await require('../lib/domain-commercial-distribution-decision.js').decide(commercialStore, socialCandidate, semanticAt + 3,
          { cognition: { [row[0]]: commercialRecord } });
        const statusHandler = require('../handlers/domain-commercial-status.js').createHandler({ store: commercialStore,
          gate: { reqKey: () => 'fixture-operator', hasDomain: () => true, isMaster: () => false } });
        let operatorStatus;
        const statusResponse = { statusCode: 0, setHeader() {}, end(body) { operatorStatus = JSON.parse(body); } };
        const beforeStatus = JSON.stringify(Array.from(values));
        await statusHandler({ method: 'GET', url: '/api/domain-commercial-status?domain=' + row[0] }, statusResponse);
        assert.equal(statusResponse.statusCode, 200);
        assert.equal(operatorStatus.readOnly, true);
        assert.equal(operatorStatus.domains[0].distributionObservation.decision.id, distribution.decisionReceiptId);
        assert.equal(operatorStatus.domains[0].distributionObservation.decision.reason, 'subject-domain-immune-veto');
        assert.equal(operatorStatus.domains[0].distributionObservation.externalActionAuthorized, false);
        const projectionSource = fs.readFileSync(path.join(__dirname, '../handlers/brain-cognition-refresh.js'), 'utf8');
        const projectionLine = projectionSource.split(/\r?\n/).find(line => line.includes('c.distributionObservation = await domainCommercialDistribution.readObservation'));
        assert.ok(projectionLine, 'existing cognition refresh must project the distribution readout');
        const projected = {};
        await new (Object.getPrototypeOf(async function() {}).constructor)('c', 'domainCommercialDistribution', 'efferenceStore', 'dom', projectionLine)(
          projected, require('../lib/domain-commercial-distribution-decision.js'), commercialStore, row[0]);
        assert.equal(JSON.parse(JSON.stringify(projected)).distributionObservation.decision.id, distribution.decisionReceiptId);

        assert.equal(operatorStatus.providerCalled, false);
        assert.equal(operatorStatus.domains[0].artifact.sourcePacketId, commercialPacket.packetId);
        assert.equal(operatorStatus.domains[0].state.intent.intentId, durablePlan.intent.intentId);
        assert.equal(operatorStatus.domains[0].publicSocialOutcome.status, 'ABSTAINED');
        assert.equal(operatorStatus.domains[0].publicSocialOutcome.signal, null);
        assert.equal(JSON.stringify(Array.from(values)), beforeStatus);
        console.log(row[0] + ' native artifact distribution', distribution.status, distribution.reason || 'subject-distribution-released');
        assert.equal(distribution.providerCalled || false, false);
        assert.equal(distribution.status, 'NO_ACTION');
        assert.equal(distribution.reason, 'subject-domain-immune-veto');
        assert.equal(distribution.released, false);
        assert.equal(distribution.observationOnly, true);
        const distributionModule = require('../lib/domain-commercial-distribution-decision.js');
        assert.deepEqual(await commercialStore.get(distributionModule.key(row[0], socialCandidate.sourceArtifactId, distribution.decisionReceiptId)), distribution);
        assert.equal(distributionModule.validate(distribution, socialCandidate, semanticAt + 4), false);
        for (const corrupt of [
          row => ({ ...row, ownerDomain: 'research' }),
          row => ({ ...row, decidedAt: semanticAt + 1000 }),
          row => ({ ...row, externalEffectAuthorized: true }),
          row => ({ ...row, sourcePacketId: 'wrong-packet' })
        ]) {
          const badRow = corrupt(distribution);
          const badStore = { assertDurable() {}, lrange: async () => [badRow], get: async () => badRow };
          const readout = await distributionModule.readObservation(badStore, row[0], semanticAt + 4);
          assert.equal(readout.status, 'UNAVAILABLE');
          assert.equal(readout.decision, null);
          assert.equal(readout.externalActionAuthorized, false);
        }
        const mismatchedStore = { assertDurable() {}, lrange: async () => [distribution], get: async () => null };
        assert.equal((await distributionModule.readObservation(mismatchedStore, row[0], semanticAt + 4)).status, 'UNAVAILABLE');

        const replayHold = await distributionModule.decide(commercialStore, socialCandidate, semanticAt + 3,
          { cognition: { [row[0]]: commercialRecord } });
        assert.deepEqual(replayHold, distribution);
        assert.equal((await commercialStore.lrange(distributionModule.logKey(row[0]), 0, 99)).length, 1);
        const wrongOwnerRecord = JSON.parse(JSON.stringify(commercialRecord));
        wrongOwnerRecord.c.serverPacket.truth.semanticEvidenceMeta.ownerDomain = 'science';
        assert.equal(nativeCommercial.evaluate(wrongOwnerRecord, null, semanticAt).reason, 'owning-domain-semantic-evidence-unavailable');
        nativeCommercialJoin = { evidenceLevel: 'LOCAL/FIXTURE', sourcePacketId: commercialPacket.packetId,
          intentId: durablePlan.intent.intentId, artifactId: socialCandidate.sourceArtifactId,
          status: distribution.status, reason: distribution.reason, immuneRoute: distribution.immuneRouting.route,
          providerCalled: false, fullTextVerified: false };
        console.log(row[0] + ' native commercial semantic join', prepared.status, commercialPacket.packetId);
      }
      if (['communication', 'trade', 'religion'].includes(row[0])) {
        var channelFamily = { communication: 'social', trade: 'auction', religion: 'subscriber' }[row[0]];
        var channelDecision = require('../lib/' + row[0] + '-' + channelFamily + '-decision.js');
        var beforeChannel = JSON.stringify(Array.from(values));
        var channelChecks = [];
        for (var channelOpportunity of packet.truth.opportunities) {
          if (channelDecision.candidate) assert.equal(channelDecision.candidate(channelOpportunity), null);
          var channelRefused = await channelDecision.decide(store, channelOpportunity, Date.parse(packet.generatedAt));
          assert.equal(channelRefused.status, 'NO_ACTION');
          assert.equal(channelRefused.released, false);
          assert.equal(channelRefused.liveMoney, false);
          var requiredBlocker = { communication: 'candidate-identity-missing', trade: 'exact-owned-asset-auction-listing-record-required', religion: 'paid-subscriber-candidate-invalid' }[row[0]];
          assert(channelRefused.blockers.includes(requiredBlocker));
          channelChecks.push({ opportunityId: channelOpportunity.id, path: channelOpportunity.path,
            reason: channelRefused.reason, blockers: channelRefused.blockers });
        }
        assert(channelChecks.length > 0);
        assert.equal(JSON.stringify(Array.from(values)), beforeChannel);
        primaryIntakeBoundary = { ownerDomain: row[0] === 'trade' ? 'supplyChain' : row[0], lane: channelFamily,
          sourcePacketId: packet.packetId, evidenceLevel: 'LOCAL/FIXTURE', nativeOpportunityChecks: channelChecks,
          nextBoundary: requiredBlocker, providerCalled: false, candidateFabricated: false,
          assetRightsOrSubscriberOrContentAuthorityInferred: false, commercialJoin: nativeCommercialJoin };
      }
      var operationProfiles = {
        industry: ['crm', 'source-grounded-work-first-WARN-record-required'],
        intelligence: ['autopilot', 'exact-lead-email-action-required'],
        law: ['automail', 'exact-address-content-and-lead-time-required'],
        infrastructure: ['real-estate', 'exact-non-binding-property-interest-record-required'],
        population: ['real-estate', 'exact-non-binding-property-interest-record-required']
      };
      if (operationProfiles[row[0]]) {
        var operationProfile = operationProfiles[row[0]];
        var operationDecision = require('../lib/' + row[0] + '-' + operationProfile[0] + '-decision.js');
        var beforeOperation = JSON.stringify(Array.from(values));
        var operationChecks = [];
        for (var operationOpportunity of packet.truth.opportunities) {
          assert.equal(operationDecision.candidate(operationOpportunity), null);
          var operationRefused = await operationDecision.decide(store, operationOpportunity, Date.parse(packet.generatedAt));
          assert.equal(operationRefused.status, 'NO_ACTION');
          assert.equal(operationRefused.reason, row[0] + '-' + operationProfile[0] + '-candidate-invalid');
          assert.deepEqual(operationRefused.blockers, [operationProfile[1]]);
          assert.equal(operationRefused.providerCalled, false);
          assert.equal(operationRefused.liveMoney, false);
          operationChecks.push({ opportunityId: operationOpportunity.id, path: operationOpportunity.path,
            reason: operationRefused.reason, blockers: operationRefused.blockers });
        }
        assert(operationChecks.length > 0);
        assert.equal(JSON.stringify(Array.from(values)), beforeOperation);
        primaryIntakeBoundary = { ownerDomain: row[0], lane: operationProfile[0], sourcePacketId: packet.packetId,
          evidenceLevel: 'LOCAL/FIXTURE', nativeOpportunityChecks: operationChecks, providerCalled: false,
          nextBoundary: operationProfile[1], candidateFabricated: false, counterpartyOrConsentInferred: false };
      }
      if (row[0] === 'industry') {
        var crmDecision = require('../lib/industry-crm-decision.js'), crmAt = Date.parse(packet.generatedAt);
        var crmCognition = { ts: crmAt, c: Object.assign({}, JSON.parse(JSON.stringify(brain.state.cognition)), {
          domain: 'industry', serverPacket: packet, brainOrgans: { resourceMetabolism: brain.state.resourceMetabolism,
            autonomousInternalEmission: brain.state.domainAutoEmission || null }
        }) };
        // Separate identified typed intake: generic native opportunities above remain refused.
        var crmCandidate = crmDecision.candidate({ source: 'WARN', workFirst: true, key: 'LOCAL/FIXTURE:industry:warn-1',
          company: 'Identified LOCAL Fixture Company', state: 'CA', effectiveDate: '2026-10-01' },
          { identity: 'LOCAL/FIXTURE:identified-WARN-record' });
        assert(crmDecision.validateCandidate(crmCandidate));
        var crmLists = new Map();
        var crmStore = Object.assign({}, store, { assertDurable: function () {}, setIfAbsent: store.setNx,
          set: async function (key, value) { values.set(key, JSON.parse(JSON.stringify(value))); return true; },
          lpush: async function (key, value) { var rows = crmLists.get(key) || []; rows.unshift(JSON.parse(JSON.stringify(value))); crmLists.set(key, rows); return rows.length; },
          lrange: async function (key, start, end) { return JSON.parse(JSON.stringify((crmLists.get(key) || []).slice(start, end + 1))); },
          ltrim: async function (key, start, end) { crmLists.set(key, (crmLists.get(key) || []).slice(start, end + 1)); return true; }
        });
        var crmSelected = await crmDecision.decide(crmStore, crmCandidate, crmAt, { cognition: crmCognition });
        assert.equal(crmSelected.status, 'NO_ACTION');
        assert.equal(crmSelected.industryPacketId, packet.packetId);
        assert(['HOLD', 'QUARANTINE', 'REJECT'].includes(crmSelected.immuneRouting.route));
        assert.deepEqual(await crmStore.get(crmDecision.key(crmSelected.decisionReceiptId)), crmSelected);
        var crmTrace = await require('../lib/product-domain-business-trace-readout.js').read(crmStore, 'industry', crmAt + 1);
        assert.equal(crmTrace.status, 'RECORDED');
        assert.equal(crmTrace.decision.immuneRoute, crmSelected.immuneRouting.route);
        assert.equal(crmTrace.command, null); assert.equal(crmTrace.externalActionAuthorized, false);
        primaryIntakeBoundary.typedFixtureIntake = { candidateId: crmSelected.actionId, decisionId: crmSelected.decisionReceiptId,
          sourcePacketId: packet.packetId, immuneRoute: crmTrace.decision.immuneRoute, status: crmSelected.status,
          candidateDerivedFromGenericOpportunity: false, evidenceLevel: 'LOCAL/FIXTURE', providerCalled: false };
      }
      if (row[0] === 'intelligence') {
        var intelDecision = require('../lib/intelligence-autopilot-decision.js'), intelAt = Date.parse(packet.generatedAt);
        var intelCognition = { ts: intelAt, c: Object.assign({}, JSON.parse(JSON.stringify(brain.state.cognition)), {
          domain: 'intelligence', serverPacket: packet, brainOrgans: { resourceMetabolism: brain.state.resourceMetabolism,
            autonomousInternalEmission: brain.state.domainAutoEmission || null }
        }) };
        // Separate identified typed intake: generic native opportunities above remain refused.
        var intelCandidate = intelDecision.candidate({ leadId: 'LOCAL/FIXTURE:consented-lead', email: 'local-fixture@example.invalid',
          domain: 'intelligence', consent: true }, { kind: 'outreach', channel: 'email', transition: 'leads>appointments' },
          { subject: 'Identified LOCAL fixture message', body: 'LOCAL/FIXTURE typed email content; never sent.' });
        assert(intelDecision.validateCandidate(intelCandidate));
        var intelLists = new Map();
        var intelStore = Object.assign({}, store, { assertDurable: function () {}, setIfAbsent: store.setNx,
          set: async function (key, value) { values.set(key, JSON.parse(JSON.stringify(value))); return true; },
          lpush: async function (key, value) { var rows = intelLists.get(key) || []; rows.unshift(JSON.parse(JSON.stringify(value))); intelLists.set(key, rows); return rows.length; },
          lrange: async function (key, start, end) { return JSON.parse(JSON.stringify((intelLists.get(key) || []).slice(start, end + 1))); },
          ltrim: async function (key, start, end) { intelLists.set(key, (intelLists.get(key) || []).slice(start, end + 1)); return true; }
        });
        var intelSelected = await intelDecision.decide(intelStore, intelCandidate, intelAt, { cognition: { intelligence: intelCognition } });
        assert.equal(intelSelected.status, 'NO_ACTION');
        assert.equal(intelSelected.intelligencePacketId, packet.packetId);
        assert(['HOLD', 'QUARANTINE', 'REJECT'].includes(intelSelected.immuneRouting.route));
        assert.deepEqual(await intelStore.get(intelDecision.key(intelSelected.decisionReceiptId)), intelSelected);
        var intelTrace = await require('../lib/product-domain-business-trace-readout.js').read(intelStore, 'intelligence', intelAt + 1);
        assert.equal(intelTrace.status, 'RECORDED');
        assert.equal(intelTrace.decision.immuneRoute, intelSelected.immuneRouting.route);
        assert.equal(intelTrace.command, null); assert.equal(intelTrace.externalActionAuthorized, false);
        primaryIntakeBoundary.typedFixtureIntake = { candidateId: intelSelected.actionId, decisionId: intelSelected.decisionReceiptId,
          sourcePacketId: packet.packetId, immuneRoute: intelTrace.decision.immuneRoute, status: intelSelected.status,
          candidateDerivedFromGenericOpportunity: false, consentEvidenceLevel: 'LOCAL/FIXTURE', evidenceLevel: 'LOCAL/FIXTURE', providerCalled: false };
      }
      if (row[0] === 'law') {
        var lawMailDecision = require('../lib/law-automail-decision.js'), lawMailAt = Date.parse(packet.generatedAt);
        var lawMailCognition = { ts: lawMailAt, c: Object.assign({}, require('../lib/brain-cognition-compact.js').compact(brain.state.cognition), {
          domain: 'law', serverPacket: packet, brainOrgans: { resourceMetabolism: brain.state.resourceMetabolism,
            autonomousInternalEmission: brain.state.domainAutoEmission || null }
        }) };
        // Separate identified typed intake: generic native opportunities above remain refused.
        var lawMailCandidate = lawMailDecision.candidate({ parcel: 'LOCAL/FIXTURE:parcel', _daysOut: 30, saleDate: 'LOCAL/FIXTURE date',
          owner: { name: 'Identified LOCAL Fixture Owner', mailAddr: '1 Fixture Street', mailCity: 'Fixture City', mailState: 'FL', mailZip: '00000' } },
          '<html>LOCAL/FIXTURE typed marketing content, never mailed.</html>', 8);
        assert(lawMailDecision.validateCandidate(lawMailCandidate));
        var lawMailLists = new Map();
        var lawMailStore = Object.assign({}, store, { assertDurable: function () {}, setIfAbsent: store.setNx,
          set: async function (key, value) { values.set(key, JSON.parse(JSON.stringify(value))); return true; },
          lpush: async function (key, value) { var rows = lawMailLists.get(key) || []; rows.unshift(JSON.parse(JSON.stringify(value))); lawMailLists.set(key, rows); return rows.length; },
          lrange: async function (key, start, end) { return JSON.parse(JSON.stringify((lawMailLists.get(key) || []).slice(start, end + 1))); },
          ltrim: async function (key, start, end) { lawMailLists.set(key, (lawMailLists.get(key) || []).slice(start, end + 1)); return true; }
        });
        var lawMailSelected = await lawMailDecision.decide(lawMailStore, lawMailCandidate, lawMailAt, { cognition: lawMailCognition });
        assert.equal(lawMailSelected.status, 'NO_ACTION');
        assert.equal(lawMailSelected.lawPacketId, packet.packetId);
        assert(['HOLD', 'QUARANTINE', 'REJECT'].includes(lawMailSelected.immuneRouting.route));
        assert.deepEqual(await lawMailStore.get(lawMailDecision.key(lawMailSelected.decisionReceiptId)), lawMailSelected);
        var lawMailTrace = await require('../lib/product-domain-business-trace-readout.js').read(lawMailStore, 'law', lawMailAt + 1);
        assert.equal(lawMailTrace.status, 'RECORDED');
        assert.equal(lawMailTrace.decision.immuneRoute, lawMailSelected.immuneRouting.route);
        assert.equal(lawMailTrace.command, null); assert.equal(lawMailTrace.externalActionAuthorized, false);
        primaryIntakeBoundary.typedFixtureIntake = { candidateId: lawMailSelected.actionId, decisionId: lawMailSelected.decisionReceiptId,
          sourcePacketId: packet.packetId, immuneRoute: lawMailTrace.decision.immuneRoute, status: lawMailSelected.status,
          candidateDerivedFromGenericOpportunity: false, evidenceLevel: 'LOCAL/FIXTURE', providerCalled: false };
      }
      if (row[0] === 'infrastructure') {
        var infraPropertyDecision = require('../lib/infrastructure-real-estate-decision.js'), infraPropertyAt = Date.parse(packet.generatedAt);
        var infraPropertyCognition = { ts: infraPropertyAt, c: Object.assign({}, require('../lib/brain-cognition-compact.js').compact(brain.state.cognition), {
          domain: 'infrastructure', serverPacket: packet, brainOrgans: { resourceMetabolism: brain.state.resourceMetabolism,
            autonomousInternalEmission: brain.state.domainAutoEmission || null }
        }) };
        // Separate identified typed intake: generic native opportunities above remain refused.
        var propertyOpportunity = packet.truth.opportunities.find(function (item) { return item.path === 'RESEARCHABLE'; });
        assert(propertyOpportunity, 'native Infrastructure research selection must exist');
        var infraPropertyCandidate = infraPropertyDecision.candidate({ inquiryId: 'LOCAL/FIXTURE:property-interest',
          counterpartyEmail: 'local-fixture@example.invalid', propertyRef: 'LOCAL/FIXTURE:property',
          transactionIntent: 'non-binding-letter-of-interest', listingUrl: 'https://fixture.invalid/property',
          indicationPriceUsd: 250000, brainOpportunityId: propertyOpportunity.id,
          subject: 'LOCAL/FIXTURE nonbinding interest', body: 'LOCAL/FIXTURE diligence request; never sent.',
          evidenceId: 'LOCAL/FIXTURE:listing', nonBinding: true, contractAuthorized: false,
          earnestMoneyAuthorized: false, fundsTransferAuthorized: false });
        assert(infraPropertyDecision.validateCandidate(infraPropertyCandidate));
        var infraPropertyLists = new Map();
        var infraPropertyStore = Object.assign({}, store, { assertDurable: function () {}, setIfAbsent: store.setNx,
          set: async function (key, value) { values.set(key, JSON.parse(JSON.stringify(value))); return true; },
          lpush: async function (key, value) { var rows = infraPropertyLists.get(key) || []; rows.unshift(JSON.parse(JSON.stringify(value))); infraPropertyLists.set(key, rows); return rows.length; },
          lrange: async function (key, start, end) { return JSON.parse(JSON.stringify((infraPropertyLists.get(key) || []).slice(start, end + 1))); },
          ltrim: async function (key, start, end) { infraPropertyLists.set(key, (infraPropertyLists.get(key) || []).slice(start, end + 1)); return true; }
        });
        var infraPropertySelected = await infraPropertyDecision.decide(infraPropertyStore, infraPropertyCandidate, infraPropertyAt, { cognition: infraPropertyCognition, maxIndicationUsd: 300000 });
        assert.equal(infraPropertySelected.status, 'NO_ACTION');
        assert.equal(infraPropertySelected.infrastructurePacketId, packet.packetId);
        assert(['HOLD', 'QUARANTINE', 'REJECT'].includes(infraPropertySelected.immuneRouting.route));
        assert.deepEqual(await infraPropertyStore.get(infraPropertyDecision.key(infraPropertySelected.decisionReceiptId)), infraPropertySelected);
        var infraPropertyTrace = await require('../lib/product-domain-business-trace-readout.js').read(infraPropertyStore, 'infrastructure', infraPropertyAt + 1);
        assert.equal(infraPropertyTrace.status, 'RECORDED');
        assert.equal(infraPropertyTrace.decision.immuneRoute, infraPropertySelected.immuneRouting.route);
        assert.equal(infraPropertyTrace.command, null); assert.equal(infraPropertyTrace.externalActionAuthorized, false);
        primaryIntakeBoundary.typedFixtureIntake = { candidateId: infraPropertySelected.actionId, decisionId: infraPropertySelected.decisionReceiptId,
          sourcePacketId: packet.packetId, immuneRoute: infraPropertyTrace.decision.immuneRoute, status: infraPropertySelected.status,
          candidateDerivedFromGenericOpportunity: false, evidenceLevel: 'LOCAL/FIXTURE', providerCalled: false };
      }
      if (row[0] === 'population') {
        var populationPropertyDecision = require('../lib/population-real-estate-decision.js'), populationPropertyAt = Date.parse(packet.generatedAt);
        var populationPropertyCognition = { ts: populationPropertyAt, c: Object.assign({}, require('../lib/brain-cognition-compact.js').compact(brain.state.cognition), {
          domain: 'population', serverPacket: packet, brainOrgans: { resourceMetabolism: brain.state.resourceMetabolism,
            autonomousInternalEmission: brain.state.domainAutoEmission || null }
        }) };
        // Separate identified typed intake: generic native opportunities above remain refused.
        var propertyOpportunity = packet.truth.opportunities.find(function (item) { return item.path === 'RESEARCHABLE'; });
        assert(propertyOpportunity, 'native Population research selection must exist');
        var populationPropertyCandidate = populationPropertyDecision.candidate({ inquiryId: 'LOCAL/FIXTURE:property-interest',
          counterpartyEmail: 'local-fixture@example.invalid', propertyRef: 'LOCAL/FIXTURE:property',
          transactionIntent: 'non-binding-letter-of-interest', listingUrl: 'https://fixture.invalid/property',
          indicationPriceUsd: 175000, brainOpportunityId: propertyOpportunity.id,
          subject: 'LOCAL/FIXTURE nonbinding interest', body: 'LOCAL/FIXTURE diligence request; never sent.',
          evidenceId: 'LOCAL/FIXTURE:listing', nonBinding: true, contractAuthorized: false,
          earnestMoneyAuthorized: false, fundsTransferAuthorized: false });
        assert(populationPropertyDecision.validateCandidate(populationPropertyCandidate));
        var populationPropertyLists = new Map();
        var populationPropertyStore = Object.assign({}, store, { assertDurable: function () {}, setIfAbsent: store.setNx,
          set: async function (key, value) { values.set(key, JSON.parse(JSON.stringify(value))); return true; },
          lpush: async function (key, value) { var rows = populationPropertyLists.get(key) || []; rows.unshift(JSON.parse(JSON.stringify(value))); populationPropertyLists.set(key, rows); return rows.length; },
          lrange: async function (key, start, end) { return JSON.parse(JSON.stringify((populationPropertyLists.get(key) || []).slice(start, end + 1))); },
          ltrim: async function (key, start, end) { populationPropertyLists.set(key, (populationPropertyLists.get(key) || []).slice(start, end + 1)); return true; }
        });
        var populationPropertySelected = await populationPropertyDecision.decide(populationPropertyStore, populationPropertyCandidate, populationPropertyAt, { cognition: populationPropertyCognition, maxIndicationUsd: 200000 });
        assert.equal(populationPropertySelected.status, 'NO_ACTION');
        assert.equal(populationPropertySelected.populationPacketId, packet.packetId);
        assert(['HOLD', 'QUARANTINE', 'REJECT'].includes(populationPropertySelected.immuneRouting.route));
        assert.deepEqual(await populationPropertyStore.get(populationPropertyDecision.key(populationPropertySelected.decisionReceiptId)), populationPropertySelected);
        var populationPropertyTrace = await require('../lib/product-domain-business-trace-readout.js').read(populationPropertyStore, 'population', populationPropertyAt + 1);
        assert.equal(populationPropertyTrace.status, 'RECORDED');
        assert.equal(populationPropertyTrace.decision.immuneRoute, populationPropertySelected.immuneRouting.route);
        assert.equal(populationPropertyTrace.command, null); assert.equal(populationPropertyTrace.externalActionAuthorized, false);
        primaryIntakeBoundary.typedFixtureIntake = { candidateId: populationPropertySelected.actionId, decisionId: populationPropertySelected.decisionReceiptId,
          sourcePacketId: packet.packetId, immuneRoute: populationPropertyTrace.decision.immuneRoute, status: populationPropertySelected.status,
          candidateDerivedFromGenericOpportunity: false, evidenceLevel: 'LOCAL/FIXTURE', providerCalled: false };
      }
      if (row[0] === 'religion') {
        var religionSubscriberDecision = require('../lib/religion-subscriber-decision.js'), religionSubscriberAt = Date.parse(packet.generatedAt);
        var religionSubscriberCognition = { ts: religionSubscriberAt, c: Object.assign({}, require('../lib/brain-cognition-compact.js').compact(brain.state.cognition), {
          domain: 'religion', serverPacket: packet, brainOrgans: { resourceMetabolism: brain.state.resourceMetabolism,
            autonomousInternalEmission: brain.state.domainAutoEmission || null }
        }) };
        // Separate identified typed intake: generic native opportunities above remain refused.
        var subscriberRevenue = require('../lib/domain-revenue-decision.js');
        var subscriberBody = 'LOCAL/FIXTURE identified Religion briefing; never emailed.', subscriberDigestKey = 'LOCAL/FIXTURE:religion-digest';
        var religionSubscriberCandidate = religionSubscriberDecision.candidate({ email: 'local-subscriber@example.invalid',
          domain: 'religion', active: true, subscriptionId: 'LOCAL/FIXTURE:subscription' }, {
          subject: 'LOCAL/FIXTURE Religion briefing', body: subscriberBody, key: subscriberDigestKey,
          revenueDecision: subscriberRevenue.create({ productDomain: 'religion', ownerDomain: 'religion',
            sourceMode: subscriberRevenue.MODES.DOMAIN_WIDE_LIVE_READ, sourceRef: 'LOCAL/FIXTURE:' + packet.packetId,
            digestKey: subscriberDigestKey, contentHash: religionSubscriberDecision.hash(subscriberBody) }) });
        assert(religionSubscriberDecision.validateCandidate(religionSubscriberCandidate));
        var religionSubscriberLists = new Map();
        var religionSubscriberStore = Object.assign({}, store, { assertDurable: function () {}, setIfAbsent: store.setNx,
          set: async function (key, value) { values.set(key, JSON.parse(JSON.stringify(value))); return true; },
          lpush: async function (key, value) { var rows = religionSubscriberLists.get(key) || []; rows.unshift(JSON.parse(JSON.stringify(value))); religionSubscriberLists.set(key, rows); return rows.length; },
          lrange: async function (key, start, end) { return JSON.parse(JSON.stringify((religionSubscriberLists.get(key) || []).slice(start, end + 1))); },
          ltrim: async function (key, start, end) { religionSubscriberLists.set(key, (religionSubscriberLists.get(key) || []).slice(start, end + 1)); return true; }
        });
        var religionSubscriberSelected = await religionSubscriberDecision.decide(religionSubscriberStore, religionSubscriberCandidate, religionSubscriberAt, { cognition: religionSubscriberCognition });
        assert.equal(religionSubscriberSelected.status, 'NO_ACTION');
        assert.equal(religionSubscriberSelected.religionPacketId, packet.packetId);
        assert(['HOLD', 'QUARANTINE', 'REJECT'].includes(religionSubscriberSelected.immuneRouting.route));
        assert.deepEqual(await religionSubscriberStore.get(religionSubscriberDecision.key(religionSubscriberSelected.decisionReceiptId)), religionSubscriberSelected);
        var religionSubscriberTrace = await require('../lib/product-domain-business-trace-readout.js').read(religionSubscriberStore, 'religion', religionSubscriberAt + 1);
        assert.equal(religionSubscriberTrace.status, 'RECORDED');
        assert.equal(religionSubscriberTrace.decision.immuneRoute, religionSubscriberSelected.immuneRouting.route);
        assert.equal(religionSubscriberTrace.command, null); assert.equal(religionSubscriberTrace.externalActionAuthorized, false);
        primaryIntakeBoundary.typedFixtureIntake = { candidateId: religionSubscriberSelected.actionId, decisionId: religionSubscriberSelected.decisionReceiptId,
          sourcePacketId: packet.packetId, immuneRoute: religionSubscriberTrace.decision.immuneRoute, status: religionSubscriberSelected.status,
          candidateDerivedFromGenericOpportunity: false, subscriptionEvidenceLevel: 'LOCAL/FIXTURE', evidenceLevel: 'LOCAL/FIXTURE', providerCalled: false };
      }
      if (row[0] === 'trade') {
        var tradeAuctionDecision = require('../lib/trade-auction-decision.js'), tradeAuctionAt = Date.parse(packet.generatedAt);
        var tradeAuctionCognition = { ts: tradeAuctionAt, c: Object.assign({}, require('../lib/brain-cognition-compact.js').compact(brain.state.cognition), {
          domain: 'supplyChain', serverPacket: packet, brainOrgans: { resourceMetabolism: brain.state.resourceMetabolism,
            autonomousInternalEmission: brain.state.domainAutoEmission || null }
        }) };
        // Separate identified typed intake: generic native opportunities above remain refused.
        var tradeOpportunity = packet.truth.opportunities.find(function (op) { return op.path === 'RESEARCHABLE'; }) || packet.truth.opportunities[0];
        assert(tradeOpportunity && tradeOpportunity.id);
        var tradeAuctionCandidate = tradeAuctionDecision.candidate({ listingRequestId: 'LOCAL/FIXTURE:auction',
          marketplaceId: 'LOCAL/FIXTURE:marketplace', sellerId: 'LOCAL/FIXTURE:seller', assetRef: 'LOCAL/FIXTURE:owned-asset',
          title: 'LOCAL/FIXTURE owned equipment preview', description: 'LOCAL/FIXTURE nonbinding discovery; no real listing or payment.',
          category: 'equipment', condition: 'used', reservePriceUsd: 7500,
          auctionEndsAt: new Date(Date.now() + 7 * 86400000).toISOString(), brainOpportunityId: tradeOpportunity.id,
          evidenceId: 'LOCAL/FIXTURE:asset-rights', assetRightsConfirmed: true,
          bindingSaleAuthorized: false, orderAcceptanceAuthorized: false, paymentAuthorized: false });
        assert(tradeAuctionDecision.validateCandidate(tradeAuctionCandidate));
        var tradeAuctionLists = new Map();
        var tradeAuctionStore = Object.assign({}, store, { assertDurable: function () {}, setIfAbsent: store.setNx,
          set: async function (key, value) { values.set(key, JSON.parse(JSON.stringify(value))); return true; },
          lpush: async function (key, value) { var rows = tradeAuctionLists.get(key) || []; rows.unshift(JSON.parse(JSON.stringify(value))); tradeAuctionLists.set(key, rows); return rows.length; },
          lrange: async function (key, start, end) { return JSON.parse(JSON.stringify((tradeAuctionLists.get(key) || []).slice(start, end + 1))); },
          ltrim: async function (key, start, end) { tradeAuctionLists.set(key, (tradeAuctionLists.get(key) || []).slice(start, end + 1)); return true; }
        });
        var tradeAuctionSelected = await tradeAuctionDecision.decide(tradeAuctionStore, tradeAuctionCandidate, tradeAuctionAt, { cognition: tradeAuctionCognition, maxReserveUsd: 10000 });
        assert.equal(tradeAuctionSelected.status, 'NO_ACTION');
        assert.equal(tradeAuctionSelected.tradePacketId, packet.packetId);
        assert(['HOLD', 'QUARANTINE', 'REJECT'].includes(tradeAuctionSelected.immuneRouting.route));
        assert.deepEqual(await tradeAuctionStore.get(tradeAuctionDecision.key(tradeAuctionSelected.decisionReceiptId)), tradeAuctionSelected);
        var tradeAuctionTrace = await require('../lib/product-domain-business-trace-readout.js').read(tradeAuctionStore, 'trade', tradeAuctionAt + 1);
        assert.equal(tradeAuctionTrace.status, 'RECORDED');
        assert.equal(tradeAuctionTrace.decision.immuneRoute, tradeAuctionSelected.immuneRouting.route);
        assert.equal(tradeAuctionTrace.command, null); assert.equal(tradeAuctionTrace.externalActionAuthorized, false);
        primaryIntakeBoundary.typedFixtureIntake = { candidateId: tradeAuctionSelected.actionId, decisionId: tradeAuctionSelected.decisionReceiptId,
          sourcePacketId: packet.packetId, immuneRoute: tradeAuctionTrace.decision.immuneRoute, status: tradeAuctionSelected.status,
          candidateDerivedFromGenericOpportunity: false, assetRightsEvidenceLevel: 'LOCAL/FIXTURE', evidenceLevel: 'LOCAL/FIXTURE', providerCalled: false };
      }
      if (['economy', 'energy', 'technology'].includes(row[0])) {
        var investmentDecision = require('../lib/' + row[0] + '-investment-decision.js');
        var beforeInvestmentIntake = JSON.stringify(Array.from(values));
        var investmentChecks = [];
        for (var investmentOpportunity of packet.truth.opportunities.filter(function (opportunity) { return opportunity.path === 'INVESTABLE'; })) {
          assert.equal(investmentDecision.candidate(investmentOpportunity), null);
          var investmentRefused = await investmentDecision.decide(store, investmentOpportunity, Date.parse(packet.generatedAt));
          assert.equal(investmentRefused.status, 'NO_ACTION');
          assert.equal(investmentRefused.reason, row[0] + '-investment-candidate-invalid');
          assert.deepEqual(investmentRefused.blockers, ['exact-paper-investment-record-required']);
          assert.equal(investmentRefused.liveMoney, false);
          investmentChecks.push({ opportunityId: investmentOpportunity.id, reason: investmentRefused.reason, blockers: investmentRefused.blockers });
        }
        assert(investmentChecks.length > 0, row[0] + ' native investment opportunities required');
        assert.equal(JSON.stringify(Array.from(values)), beforeInvestmentIntake);
        primaryIntakeBoundary = { ownerDomain: row[0], lane: 'investments', sourcePacketId: packet.packetId,
          evidenceLevel: 'LOCAL/FIXTURE', nativeOpportunityChecks: investmentChecks, providerCalled: false,
          nextBoundary: 'exact-paper-investment-record-required', issuerOrSymbolInferred: false, candidateFabricated: false };
      }
      if (['defense', 'governance'].includes(row[0])) {
        var publicationSource = require('../lib/' + row[0] + '-publication-source.js');
        var publicationDecision = require('../lib/' + row[0] + '-publication-decision.js');
        var publicationAt = Date.parse(packet.generatedAt);
        var publicationCognition = { ts: publicationAt, c: Object.assign({}, JSON.parse(JSON.stringify(brain.state.cognition)), {
          domain: row[0], serverPacket: packet, brainOrgans: { resourceMetabolism: brain.state.resourceMetabolism, autonomousInternalEmission: brain.state.domainAutoEmission || brain.state.energyAutoEmission || null }
        }) };
        var publicationTitles = [0, 1].map(function (feed) { return { t: publicationAt, d: row[0], f: 'LOCAL/FIXTURE public feed ' + feed, hh: feed,
          items: [0, 1].map(function (item) { return { i: item, ti: 'Identified public fixture record ' + feed + ':' + item,
            au: 'https://fixture.invalid/' + row[0] + '/' + feed + '/' + item, pa: publicationAt, pl: 'Fixture publisher ' + feed }; }) }; });
        assert.equal(publicationSource.build([publicationTitles[0]], publicationCognition, publicationAt), null);
        var publicationCandidate = publicationSource.build(publicationTitles, publicationCognition, publicationAt);
        assert(publicationSource.validate(publicationCandidate));
        assert(packet.truth.opportunities.some(function (opportunity) { return opportunity.id === publicationCandidate.brainSelection.id && opportunity.path === 'RESEARCHABLE'; }));
        var publicationLists = new Map();
        var publicationStore = Object.assign({}, store, { assertDurable: function () {}, setIfAbsent: store.setNx,
          set: async function (key, value) { values.set(key, JSON.parse(JSON.stringify(value))); return true; },
          lpush: async function (key, value) { var rows = publicationLists.get(key) || []; rows.unshift(JSON.parse(JSON.stringify(value))); publicationLists.set(key, rows); return rows.length; },
          lrange: async function (key, start, end) { return JSON.parse(JSON.stringify((publicationLists.get(key) || []).slice(start, end < 0 ? undefined : end + 1))); },
          ltrim: async function (key, start, end) { publicationLists.set(key, (publicationLists.get(key) || []).slice(start, end + 1)); return true; }
        });
        var publicationSelected = await publicationDecision.decide(publicationStore, publicationCandidate, publicationAt, publicationCognition);
        assert(publicationSelected.decisionReceiptId, JSON.stringify(publicationSelected));
        assert.equal(publicationSelected[row[0] + 'PacketId'], packet.packetId);
        assert.deepEqual(await publicationStore.get(publicationDecision.key(publicationSelected.decisionReceiptId)), publicationSelected);
        assert.equal(publicationSelected.providerCalled, false);
        var publicationReplay = await publicationDecision.decide(publicationStore, publicationCandidate, publicationAt, publicationCognition);
        assert.equal(publicationReplay.decisionReceiptId, publicationSelected.decisionReceiptId);
        assert.equal(publicationSelected.status, 'NO_ACTION');
        assert(publicationSelected.blockers.includes(row[0] + '-immune-veto'));
        var beforePublicationDispatch = JSON.stringify(Array.from(values));
        var publicationExecutor = require('../lib/' + row[0] + '-publication-executor.js');
        var publicationHeld = await publicationExecutor.execute({ store: publicationStore, candidate: publicationCandidate,
          decision: publicationSelected, now: publicationAt, publisher: { publish: async function () { throw new Error('held native decision must not publish'); } } });
        assert.equal(publicationHeld.status, 'HELD');
        assert.equal(publicationHeld.reason, row[0] + '-publication-exact-b10-decision-required');
        assert.equal(publicationHeld.providerCalls, 0);
        var publicationTrace = await require('../lib/product-domain-business-trace-readout.js').read(publicationStore, row[0], publicationAt + 1);
        assert.equal(publicationTrace.status, 'RECORDED');
        assert.equal(publicationTrace.decision.packetId, packet.packetId);
        assert.equal(publicationTrace.decision.immuneRoute, publicationSelected.immuneRouting.route);
        assert(['HOLD', 'QUARANTINE', 'REJECT'].includes(publicationTrace.decision.immuneRoute));
        assert(publicationTrace.decision.blockers.includes(row[0] + '-immune-veto'));
        assert.equal(publicationTrace.command, null);
        assert.equal(publicationTrace.externalActionAuthorized, false);
        assert.equal(JSON.stringify(Array.from(values)), beforePublicationDispatch);
        primaryIntakeBoundary = { ownerDomain: row[0], lane: 'publication', candidateId: publicationCandidate.candidateId,
          nativeOpportunityId: publicationCandidate.brainSelection.id, decisionId: publicationSelected.decisionReceiptId,
          sourcePacketId: packet.packetId, status: publicationSelected.status, blockers: publicationSelected.blockers,
          titleSourceLevel: 'LOCAL/FIXTURE', providerCalled: false, executorGate: publicationHeld.reason, operatorReadout: publicationTrace.status, nextBoundary: 'native-publication-release-not-proven' };
      }
      if (row[0] === 'culture') {
        var beforeCulture = JSON.stringify(Array.from(values));
        var cultureAbstentions = [];
        for (var nativeOpportunity of packet.truth.opportunities) {
          var cultureDecision = await CultureDecision.decide(store, nativeOpportunity, Date.parse(packet.generatedAt));
          assert.equal(cultureDecision.status, 'NO_ACTION');
          assert.equal(cultureDecision.reason, 'culture-b10-candidate-refused');
          assert.equal(cultureDecision.providerCalled, false);
          cultureAbstentions.push({ opportunityId: nativeOpportunity.id, path: nativeOpportunity.path, reason: cultureDecision.reason });
        }
        assert.equal(JSON.stringify(Array.from(values)), beforeCulture);
        var cultureLists = new Map();
        var cultureStore = Object.assign({}, store, {
          assertDurable: function () {}, setIfAbsent: store.setNx,
          set: async function (key, value) { values.set(key, JSON.parse(JSON.stringify(value))); return true; },
          lpush: async function (key, value) { var rows = cultureLists.get(key) || []; rows.unshift(JSON.parse(JSON.stringify(value))); cultureLists.set(key, rows); return rows.length; },
          lrange: async function (key, start, end) { return JSON.parse(JSON.stringify((cultureLists.get(key) || []).slice(start, end < 0 ? undefined : end + 1))); },
          ltrim: async function (key, start, end) { cultureLists.set(key, (cultureLists.get(key) || []).slice(start, end + 1)); return true; }
        });
        var cultureCognition = Object.assign({}, JSON.parse(JSON.stringify(brain.state.cognition)), { domain: 'culture', serverPacket: packet,
          brainOrgans: { resourceMetabolism: brain.state.resourceMetabolism, autonomousInternalEmission: brain.state.domainAutoEmission || brain.state.energyAutoEmission || null } });
        var maintenance = CulturePolicy.candidate('culture', 'LOCAL/FIXTURE-model', 'missing-public-hero');
        var maintenanceDecision = await CultureDecision.decide(cultureStore, maintenance, Date.parse(packet.generatedAt), {
          cognition: { ts: Date.parse(packet.generatedAt), c: cultureCognition }
        });
        assert.notEqual(maintenanceDecision.reason, 'culture-b10-unavailable');
        assert(maintenanceDecision.decisionReceiptId);
        assert.equal(maintenanceDecision.culturePacketId, packet.packetId);
        assert.deepEqual(await cultureStore.get(CultureDecision.key(maintenanceDecision.decisionReceiptId)), maintenanceDecision);
        assert.equal(maintenanceDecision.providerCalled, false);
        assert.equal(typeof cultureCognition.immune.immuneState, 'string');
        assert.notEqual(cultureCognition.immune.immuneState, 'clear');
        assert(maintenanceDecision.blockers.includes('culture-immune-veto'));
        var maintenanceReplay = await CultureDecision.decide(cultureStore, maintenance, Date.parse(packet.generatedAt), { cognition: { ts: Date.parse(packet.generatedAt), c: cultureCognition } });
        assert.equal(maintenanceReplay.decisionReceiptId, maintenanceDecision.decisionReceiptId);
        var beforeCultureRead = JSON.stringify(Array.from(values));
        var cultureTrace = await CultureReadout.read(cultureStore, Date.parse(packet.generatedAt) + 1);
        assert.equal(cultureTrace.status, 'RECORDED');
        assert.equal(cultureTrace.decision.id, maintenanceDecision.decisionReceiptId);
        assert.equal(cultureTrace.decision.packetId, packet.packetId);
        assert(cultureTrace.decision.blockers.includes('culture-immune-veto'));
        assert.equal(cultureTrace.decision.immuneRoute, maintenanceDecision.immuneRouting.route);
        assert(['HOLD','QUARANTINE','REJECT'].includes(maintenanceDecision.immuneRouting.route));
        assert.equal(cultureTrace.command, null);
        assert.equal(cultureTrace.externalActionAuthorized, false);
        assert.equal(JSON.stringify(Array.from(values)), beforeCultureRead);
        var cultureKey = CultureDecision.key(maintenanceDecision.decisionReceiptId);
        values.set(cultureKey, Object.assign({}, maintenanceDecision, { ownerDomain: 'finance' }));
        var unavailableCulture = await CultureReadout.read(cultureStore, Date.parse(packet.generatedAt) + 1);
        assert.equal(unavailableCulture.status, 'UNAVAILABLE');
        assert.equal(unavailableCulture.decision, null);
        assert.equal(unavailableCulture.command, null);
        values.set(cultureKey, JSON.parse(JSON.stringify(maintenanceDecision)));
        assert.equal((await CultureReadout.read(cultureStore, Date.parse(packet.generatedAt) + 1)).status, 'RECORDED');
        primaryIntakeBoundary = { ownerDomain: 'culture', lane: 'hero-image', nativeOpportunityChecks: cultureAbstentions,
          firstUnprovenBoundary: 'native-investment-research-opportunity-is-not-canonical-hero-maintenance-candidate',
          existingTrigger: 'handlers/hero-image.js missing-public-hero -> culture-hero-policy.candidate', providerCalled: false };
        primaryIntakeBoundary.maintenanceJoin = { evidenceLevel: 'LOCAL/FIXTURE', trigger: 'identified fixture missing-public-hero',
          nativeCognitionInjected: false, nativeOpportunityReclassified: false, decisionId: maintenanceDecision.decisionReceiptId,
          status: maintenanceDecision.status, blockers: maintenanceDecision.blockers, sourcePacketId: maintenanceDecision.culturePacketId };
        primaryIntakeBoundary.maintenanceJoin.nativeImmuneState = cultureCognition.immune.immuneState;
        primaryIntakeBoundary.commercialJoin = nativeCommercialJoin;
        primaryIntakeBoundary.nextBoundary = nativeCommercialJoin.reason;
        primaryIntakeBoundary.maintenanceJoin.operatorReadout = { status: cultureTrace.status, decision: cultureTrace.decision,
          command: null, externalActionAuthorized: false, wrongOwnerReadFailsClosed: true, recoveryVerified: true };
      }
      var researchIntake = ResearchCandidate.build({ c: { serverPacket: packet, serverPacketPersistence: consumed } }, row[0], Date.parse(packet.generatedAt));
      assert.equal(researchIntake.status, 'ABSTAINED');
      assert.equal(researchIntake.candidate, null);
      assert.equal(researchIntake.reason, ['science', 'medicine', 'education', 'environment'].includes(row[0]) ? 'owning-domain-semantic-identity-invalid' : 'research-product-domain-not-enabled');
      var enrichedResearch = null;
      if (['science', 'medicine', 'education', 'environment'].includes(row[0])) {
        var sourceDomain = DomainSemantic.sourceDomainFor(row[0]);
        var sourceAt = Date.parse(packet.generatedAt);
        var titleSets = [0, 1].map(function (feed) {
          return { t: packet.generatedAt, d: sourceDomain, f: 'LOCAL/FIXTURE ' + sourceDomain + ' feed ' + feed, hh: feed, ck: 'headline_title',
            items: [0, 1].map(function (item) { return { i: item, ti: 'Identified fixture observation ' + feed + ':' + item,
              au: 'https://fixture.invalid/' + sourceDomain + '/' + feed + '/' + item, pa: packet.generatedAt, pl: 'Fixture publisher ' + feed }; }) };
        });
        var semantic = DomainSemantic.build(titleSets, sourceDomain, sourceAt);
        semantic.meta.ownerDomain = row[0]; semantic.meta.sourceDomain = sourceDomain;
        var enrichedPacket = Packet.fromBrainState(row[0], brain.state, { snapshotId: 'fixture-native-source-snapshot', fetchedAt: sourceAt },
          'fixture-native-semantic-refresh', packet.generatedAt, { semanticEvidence: semantic.observations, semanticEvidenceMeta: semantic.meta,
            feedSourceEvidence: nativeFeedEvidence });
        var enrichedConsumer = Consumer.createConsumer({ store: Object.assign({}, store, {
          packetIndexKey: 'semantic-packets', handoffIndexKey: 'semantic-handoffs',
          packetKey: function (id) { return 'semantic-packet:' + id; }, handoffKey: function (id) { return 'semantic-handoff:' + id; }
        }) });
        var enrichedPersistence = await enrichedConsumer.consumePacket(enrichedPacket);
        assert.equal(enrichedPersistence.ok, true);
        var enrichedRecord = { c: { serverPacket: enrichedPacket, serverPacketPersistence: enrichedPersistence } };
        var actor = ResearchCandidate.build(enrichedRecord, row[0], sourceAt);
        assert.equal(actor.status, 'READY_FOR_B10');
        assert.equal(actor.candidate.sourcePacketId, enrichedPacket.packetId);
        assert.equal(actor.candidate.ownerDomain, sourceDomain);
        // Join the actual native actor to the active worker's admission path.
        // Admission is scheduling evidence, never motor or provider authority.
        var admittedCandidate = Object.assign({}, actor.candidate, { status: 'PENDING' });
        var beforeAdmission = JSON.stringify(admittedCandidate);
        assert.equal(ArtifactWorker.isEligibleCandidate(admittedCandidate, sourceAt), true);
        assert.equal(ArtifactWorker.routedDomain(admittedCandidate), 'research');
        assert.equal(ArtifactWorker.selectionCandidate(admittedCandidate).domain, 'research');
        assert.equal(ArtifactWorker.selectionCandidate(admittedCandidate).originDomain, row[0]);
        assert.equal(ArtifactWorker.schedulerGroup(admittedCandidate), 'research:science');
        assert.equal(ArtifactWorker.candidateIdentity(admittedCandidate), 'subject:' + actor.candidate.subjectId);
        assert(ArtifactWorker.laneDedupeKey(admittedCandidate));
        assert.equal(ArtifactWorker.sameCandidate(admittedCandidate, JSON.parse(beforeAdmission)), true);
        assert.equal(ArtifactWorker.sameCandidate(admittedCandidate, Object.assign({}, admittedCandidate, { sourceArtifactRef: 'different-source-window' })), false);
        assert.equal(ArtifactWorker.isEligibleCandidate(admittedCandidate, sourceAt + ResearchCandidate.MAX_PACKET_AGE_MS + 1), false);
        assert.equal(ArtifactWorker.isEligibleCandidate(admittedCandidate, sourceAt - 1), false);
        assert.equal(ArtifactWorker.isEligibleCandidate(Object.assign({}, admittedCandidate, { status: 'FIRED' }), sourceAt), false);
        assert.equal(ArtifactWorker.isEligibleCandidate(Object.assign({}, admittedCandidate, { autofireEligible: false }), sourceAt), false);
        assert.equal(JSON.stringify(admittedCandidate), beforeAdmission, 'worker admission must not mutate the native candidate');
        assert.deepEqual(actor.candidate.researchContext.evidence.news.map(function (news) { return JSON.stringify(news.sourceIdentity); }).sort(), semantic.observations.map(function (observation) { return JSON.stringify(observation.sourceIdentity); }).sort());
        assert.equal(actor.candidate.researchContext.evidence.sourceBoundary.publisherIndependence, 'UNASSESSED');
        var undurable = JSON.parse(JSON.stringify(enrichedRecord)); undurable.c.serverPacketPersistence.ok = false;
        assert.equal(ResearchCandidate.build(undurable, row[0], sourceAt).reason, 'owning-domain-packet-not-durable');
        var wrongOwner = JSON.parse(JSON.stringify(enrichedRecord)); wrongOwner.c.serverPacket.truth.semanticEvidenceMeta.ownerDomain = 'agriculture';
        assert.equal(ResearchCandidate.build(wrongOwner, row[0], sourceAt).reason, 'owning-domain-semantic-identity-invalid');
        var decisionLists = new Map();
        var decisionStore = Object.assign({}, store, {
          assertDurable: function () {}, setIfAbsent: store.setNx,
          set: async function (key, value) { values.set(key, JSON.parse(JSON.stringify(value))); return true; },
          lpush: async function (key, value) { var rows = decisionLists.get(key) || []; rows.unshift(JSON.parse(JSON.stringify(value))); decisionLists.set(key, rows); return rows.length; },
          ltrim: async function (key, start, end) { decisionLists.set(key, (decisionLists.get(key) || []).slice(start, end + 1)); return true; }
        });
        decisionStore.lrange = async function (key, start, end) { return JSON.parse(JSON.stringify((decisionLists.get(key) || []).slice(start, end < 0 ? undefined : end + 1))); };
        var selection = await DomainBridge.select(decisionStore, { lane: 'research', candidate: actor.candidate, domainCycle: null, at: sourceAt });
        assert.equal(selection.ok, true);
        assert.equal(selection.receipt.status, 'HELD');
        assert.equal(selection.receipt.ownerDomain, sourceDomain);
        assert.equal(selection.receipt.candidate.sourcePacketId, enrichedPacket.packetId);
        assert(selection.receipt.reasons.includes('owning_domain_cycle_missing'));
        assert.deepEqual(await decisionStore.get('autofire_selection:' + selection.receipt.id), selection.receipt);
        var selectionReplay = await DomainBridge.select(decisionStore, { lane: 'research', candidate: actor.candidate, domainCycle: null, at: sourceAt });
        assert.equal(selectionReplay.receipt.id, selection.receipt.id);
        var recorded = JSON.parse(fs.readFileSync(path.join(ROOT, 'brain-v2/fixtures/' + sourceDomain + '-recorder.json'), 'utf8'));
        var runtimeCycle = await ShadowRuntime.runDomain(row[0], { rows: recorded.rows, now: sourceAt });
        assert.equal(runtimeCycle.ok, true, runtimeCycle.error);
        assert.equal(runtimeCycle.domain, sourceDomain);
        // Active paper routing uses Science's critic, while the source-domain
        // scenario below remains a separate observation of its own boundary.
        var scienceRows = JSON.parse(fs.readFileSync(path.join(ROOT, 'brain-v2/fixtures/research-recorder.json'), 'utf8'));
        var scienceCycle = await ShadowRuntime.runDomain('science', { rows: scienceRows.rows, now: sourceAt });
        assert.equal(scienceCycle.ok, true, scienceCycle.error);
        var activeScienceSelection = await DomainBridge.select(decisionStore, { lane: 'research',
          candidate: ArtifactWorker.selectionCandidate(admittedCandidate), domainCycle: scienceCycle, at: sourceAt });
        assert.equal(activeScienceSelection.ok, true);
        assert.equal(activeScienceSelection.receipt.ownerDomain, 'research');
        assert.equal(activeScienceSelection.receipt.routing.originDomain, row[0]);
        assert.equal(activeScienceSelection.receipt.routing.sourcePacketId, enrichedPacket.packetId);
        assert.equal(activeScienceSelection.receipt.routing.observationOnly, true);
        assert.deepEqual(await decisionStore.get('autofire_selection:' + activeScienceSelection.receipt.id), activeScienceSelection.receipt);
        var runtimeSelection = await DomainBridge.select(decisionStore, { lane: 'research', candidate: actor.candidate, domainCycle: runtimeCycle, at: sourceAt + 1 });
        assert.equal(runtimeSelection.ok, true);
        assert.equal(runtimeSelection.receipt.status, ['science', 'medicine'].includes(row[0]) ? 'RELEASED' : 'HELD', JSON.stringify(runtimeSelection.receipt.reasons));
        if (['education', 'environment'].includes(row[0])) {
          if (row[0] === 'education') assert(runtimeSelection.receipt.reasons.includes('owning_domain_has_no_current_l3_evidence'));
          assert(runtimeSelection.receipt.reasons.includes('owning_domain_has_no_declared_outward_consumer'), JSON.stringify(runtimeSelection.receipt.reasons));
        }
        assert.equal(runtimeSelection.receipt.ownerDomain, sourceDomain);
        assert.equal(runtimeSelection.receipt.candidate.sourcePacketId, enrichedPacket.packetId);
        assert(!runtimeSelection.receipt.reasons.includes('owning_domain_cycle_missing'));
        assert.deepEqual(await decisionStore.get('autofire_selection:' + runtimeSelection.receipt.id), runtimeSelection.receipt);
        var beforeAuthorization = JSON.stringify(Array.from(values));
        var motorAuthorization = await MotorAuthorization.authorize(decisionStore, row[0], 'research-papers', sourceAt + 2);
        assert.equal(motorAuthorization.authorized, false);
        assert.equal(motorAuthorization.reason, 'domain-motor-receipt-missing');
        var developmentalAuthorization = ['science', 'medicine'].includes(row[0]) ? await DevelopmentalAuthority.authorize(decisionStore, row[0], runtimeSelection.receipt, {}, sourceAt + 2) : { authorized: false, reason: 'not-evaluated-native-selection-held' };
        assert.equal(developmentalAuthorization.authorized, false);
        assert.equal(developmentalAuthorization.reason, ['science', 'medicine'].includes(row[0]) ? 'research-developmental-switch-off' : 'not-evaluated-native-selection-held');
        assert.equal(JSON.stringify(Array.from(values)), beforeAuthorization, 'held authorization must not write a command or create capability evidence');
        var operatorTrace = await ResearchReadout.read(decisionStore, row[0], sourceAt + 3);
        assert.equal(operatorTrace.status, 'RECORDED');
        assert.equal(operatorTrace.decision.id, runtimeSelection.receipt.id);
        assert.equal(operatorTrace.decision.packetId, enrichedPacket.packetId);
        assert.equal(operatorTrace.command, null);
        assert.equal(operatorTrace.dispatchGate.reason, motorAuthorization.reason);
        assert.equal(operatorTrace.dispatchGate.status, 'HELD');
        assert.equal(operatorTrace.externalActionAuthorized, false);
        assert.equal(JSON.stringify(Array.from(values)), beforeAuthorization, 'operator read must not mutate business state');
        enrichedResearch = { status: actor.status, sourcePacketId: enrichedPacket.packetId, ownerDomain: actor.candidate.ownerDomain,
          activeWorkerAdmission: { consumer: 'handlers/limen-worker-autofire.js', eligible: true, originDomain: row[0], routedOwnerDomain: 'research',
            owningSelection: { id: activeScienceSelection.receipt.id, status: activeScienceSelection.receipt.status,
              originDomain: activeScienceSelection.receipt.routing.originDomain, ownerDomain: activeScienceSelection.receipt.ownerDomain,
              sourcePacketId: activeScienceSelection.receipt.routing.sourcePacketId },
            subjectId: admittedCandidate.subjectId, staleRejected: true, futureRejected: true, terminalRejected: true,
            eligibilityRevokedRejected: true, sourceWindowIdentityPreserved: true, handlerInvoked: false, providerCalled: false },
          sourceKeys: semantic.observations.map(function (observation) { return observation.sourceIdentity.value; }),
          titleSourceLevel: 'LOCAL/FIXTURE', selection: { id: selection.receipt.id, status: selection.receipt.status, ownerDomain: selection.receipt.ownerDomain, reasons: selection.receipt.reasons },
          recordedRuntimeJoin: { fixture: 'brain-v2/fixtures/' + sourceDomain + '-recorder.json', rowsApplied: runtimeCycle.rowsApplied,
            domainFunction: runtimeCycle.domainFunction, selection: { id: runtimeSelection.receipt.id, status: runtimeSelection.receipt.status, reasons: runtimeSelection.receipt.reasons } },
          dispatchBoundary: { motor: motorAuthorization, developmental: developmentalAuthorization, commandCreated: false, providerCalled: false },
          nextBoundary: runtimeSelection.receipt.status === 'HELD' ? runtimeSelection.receipt.reasons.join(';') : 'domain-motor-receipt-and-capability-required-before-command', providerCalled: false };
      }
      var replay = await consumer.consumePacket(packet);
      assert.equal(replay.handoffsCreated, 0, 'same native packet cannot duplicate handoffs');
      Array.from(indexes.get('handoffs')).forEach(function (id) {
        var persisted = values.get(store.handoffKey(id));
        assert.equal(persisted.sourcePacketId, packet.packetId);
        assert.equal(persisted.sourceDomains[0], row[0]);
        assert.deepEqual(persisted.sourceDiagnoses, packet.truth.activeDiagnoses);
        assert.equal(persisted.opportunity.id, persisted.opportunityId);
      });
      // Finance's existing consumer reads packets, not the handoff index.
      // Join the actual native output without supplying a ticker or decision.
      var beforeIntake = JSON.stringify(Array.from(values));
      var intake = await FinanceIntake.read(store);
      assert.equal(intake.status, 'OBSERVED');
      assert.equal(intake.packetsRead, row[0] === 'finance' ? 0 : 1);
      if (row[0] !== 'finance') {
        assert.equal(intake.packets[0].packetId, packet.packetId);
        assert.deepEqual(intake.packets[0].sourceIdentity, packet.sourceIdentity);
        packet.truth.opportunities.slice(0, 32).forEach(function (opportunity) {
          var record = intake.records.find(function (r) { return r.opportunityId === opportunity.id; });
          assert(record, row[0] + ' native opportunity must survive Finance review intake');
          assert.equal(record.sourceDomain, row[0]);
          assert.equal(record.sourcePacketId, packet.packetId);
          assert.deepEqual(record.payload, opportunity);
          assert.equal(record.authority.sourceMayDecideInvestment, false);
          assert.equal(record.authority.executionInstruction, false);
          assert.equal(intake.financeRelevant.some(function (r) { return r.recordId === record.recordId; }), FinanceIntake.opportunityRelevant(opportunity));
        });
      } else assert.equal(intake.records.length, 0, 'Finance must not reimport its own source as cross-domain context');
      assert.equal(intake.authority.brokerTouched, false);
      assert.equal(intake.authority.orderPlaced, false);
      var nativeTickers = Array.from(new Set(intake.financeRelevant.flatMap(function (record) { return FinanceSource.emissionTickers(record); })));
      var companyContexts = nativeTickers.map(function (ticker) {
        var matched = FinanceSource.domainEmissionsForCompany(intake.financeRelevant, { ticker: ticker });
        assert(matched.length > 0, 'explicit native ticker must retain matching source context');
        matched.forEach(function (record) {
          assert.equal(record.sourcePacketId, packet.packetId);
          assert.equal(record.sourceDomain, row[0]);
          assert(FinanceSource.emissionTickers(record).includes(ticker));
          assert.equal(record.authority.executionInstruction, false);
        });
        var identities = Object.entries(FinanceRegistry.byCik).filter(function (entry) { return entry[1].ticker === ticker; });
        var gate = null;
        if (identities.length === 1) {
          var company = Object.assign({ cik: identities[0][0] }, identities[0][1]);
          // Native cross-domain context supplies no Finance cycle, manager,
          // market observation or semantic company evidence. Do not fabricate it.
          var ledger = FinanceLedger.build({ company: company, domainEmissions: matched, domainIntake: intake });
          assert.equal(ledger.status, 'ABSTAINED');
          assert(ledger.blockers.includes('finance_cycle_missing_or_not_ok'));
          assert(ledger.blockers.includes('semantic_feed_evidence_required'));
          assert(ledger.blockers.includes('market_data_snapshot_invalid'));
          assert.deepEqual(ledger.ledger.domainEmissions, matched);
          assert.equal(ledger.ledger.company.ticker, ticker);
          gate = { status: ledger.status, blockers: ledger.blockers, company: company };
        }
        return { ticker: ticker, recordIds: matched.map(function (record) { return record.recordId; }),
          financeInputGate: gate || { status: 'ABSTAINED', blockers: [identities.length ? 'company-registry-identity-ambiguous' : 'company-not-in-finance-registry'] } };
      });
      assert.deepEqual(FinanceSource.domainEmissionsForCompany(intake.financeRelevant, { ticker: 'FIXTURE_UNMATCHED_COMPANY' }), [], 'unmatched company must not adopt broad domain context');
      assert.deepEqual(FinanceSource.domainEmissionsForCompany(intake.financeRelevant, {}), [], 'missing company identity must not adopt domain context');
      assert.equal(JSON.stringify(Array.from(values)), beforeIntake, 'Finance review intake is read-only');
      var nativeFinanceReturnBoundary = null;
      if (row[0] === 'energy') {
        // Review context is not a Finance command or an independently observed
        // outcome. Exercise the existing return reader on this same store.
        var afferent = require('../lib/energy-finance-afferent-learning.js');
        var returnStore = Object.assign({}, store, { assertDurable: function () {}, setIfAbsent: store.setNx,
          set: async function (key, value) { values.set(key, JSON.parse(JSON.stringify(value))); return true; } });
        var absentReturn = await afferent.readForBrain(returnStore);
        assert.equal(absentReturn.status, 'ABSTAINED');
        assert.equal(absentReturn.reason, 'energy-has-no-returned-finance-outcome');
        assert.equal(absentReturn.signal, null); assert.equal(absentReturn.learningGate.ready, false);
        var energyProjection = require('../lib/brain-cognition-compact.js').learningReadout({ domain: 'energy',
          status: 'ABSTAINED', financialAfferent: absentReturn });
        assert.equal(energyProjection.financialAfferent.reason, absentReturn.reason);
        assert.equal(energyProjection.financialAfferent.signalId, null);
        assert.deepEqual(energyProjection.financialAfferent.sourceDomains, []);
        var absentOutcome = await afferent.record(returnStore, null, null, null);
        assert.equal(absentOutcome.ok, false); assert.equal(absentOutcome.reason, 'finance-investment-outcome-required');
        assert.equal(JSON.stringify(Array.from(values)), beforeIntake, 'absent outcome must create no return cause or signal');
        assert.equal(companyContexts.length, 0, 'this native Energy fixture has no explicit company association');
        nativeFinanceReturnBoundary = { sourcePacketId: packet.packetId, intakeRecordIds: intake.records.map(function (r) { return r.recordId; }),
          explicitCompanyContexts: 0, status: absentReturn.status, reason: absentReturn.reason,
          outcomeGate: absentOutcome.reason, signal: null, learningReady: false, commandCreated: false, eventFabricated: false };
      }
      var invalid = JSON.parse(JSON.stringify(packet));
      invalid.cycleId += ':missing-identity-fixture'; invalid = Packet.buildPacket(invalid);
      invalid.truth.opportunities = [Object.assign({}, packet.truth.opportunities.find(function (o) { return Packet.ACTIVE_LANES.includes(o.lane); }), { id: '' })];
      var rejected = await consumer.consumePacket(invalid);
      assert.equal(rejected.handoffsCreated, 0);
      assert.equal(rejected.failures.length, 1, 'missing native identity must fail at the handoff boundary');
      boundary = primaryIntakeBoundary && primaryIntakeBoundary.nextBoundary || enrichedResearch && enrichedResearch.nextBoundary || 'persisted-native-handoff-to-owning-business-motor-not-joined-in-this-test';
    } catch (err) { packetError = err.code || err.message; boundary = packetError; console.error(row[0], err); }
    assert.equal(packetError, null, row[0] + ' native packet/handoff chain failed');
    assert.equal(typeof brain.state.stress, 'number');
    assert.equal(Array.isArray(diagnoses), true);
    assert.equal(Array.isArray(opportunities), true);
    results.push({ productDomain: row[0], runtimeOwner: brain.domainId, snapshotKey: brain.snapshotKey,
      browserObservation: browserObservation,
      evidenceLevel: 'LOCAL/FIXTURE', source: fixtures[brain.snapshotKey].sources[0].name, sourceIngested: sensed,
      activeDiagnoses: active.map(function (d) { return d.id; }), typedOpportunities: typed.map(function (o) { return { id: o.id || null, path: o.path }; }),
      packetId: packet && packet.packetId, packetError: packetError, handoffs: handoffs,
      feedSourceEvidence: packet && packet.truth.feedSourceEvidence,
      primaryIntakeBoundary: primaryIntakeBoundary,
      nativeResearchIntake: { status: researchIntake.status, reason: researchIntake.reason, candidateCreated: false,
        semanticEvidenceInjected: false, evidenceLevel: 'LOCAL/FIXTURE', enrichedSourceIntake: enrichedResearch },
      financeReviewIntake: { status: intake.status, packetsRead: intake.packetsRead,
        recordsRead: intake.records.length, financiallyRelevant: intake.financeRelevant.length,
        explicitCompanyContexts: companyContexts, nativeReturnBoundary: nativeFinanceReturnBoundary,
        nextBoundary: row[0] === 'finance' ? 'own-finance-packet-excluded-from-cross-domain-intake' : companyContexts.length ? 'company-context-to-finance-owned-admission-not-joined' : 'native-context-has-no-explicit-company-identity',
        opportunityReadLimit: 32, evidenceLevel: 'LOCAL/FIXTURE', decisionProven: false, motorProven: false },
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
