'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const Module = require('node:module'), acorn = require('acorn');
const root = path.resolve(__dirname, '..'), file = path.join(root, 'handlers/domain-snapshot.js');
const mod = new Module(file, module); mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file));
mod._compile(fs.readFileSync(file, 'utf8') + '\nmodule.exports.testBuildDomain = buildDomain;module.exports.testTitleFetchers = { GovTrack: fetchGovTrack, CongressGov: fetchCongressGov, GAO: fetchGAOReports, CBO: fetchCBOPublications };', file);
const H = mod.exports, Packet = require('../lib/civilization-server-packet.js'), Consumer = require('../lib/civilization-handoff-consumer.js');
const Decision = require('../lib/governance-publication-decision.js'), Source = require('../lib/governance-publication-source.js');
const harness = fs.readFileSync(path.join(__dirname, 'test-continuity-feed-spine.cjs'), 'utf8');
const helper = acorn.parse(harness, { ecmaVersion: 'latest' }).body.find(n => n.type === 'FunctionDeclaration' && n.id.name === 'sandbox');
const sandbox = new Function('global', harness.slice(helper.start, helper.end) + ';return sandbox();');
const originalFetch = global.fetch;
(async () => {
  const results = [];
  const titleFetchers = [];
  for (const [name, fetcher] of Object.entries(H.testTitleFetchers)) {
    const suppliedUrl = 'https://fixture.invalid/governance/' + name;
    const xml = '<rss><channel><item><title>LOCAL/FIXTURE ' + name + ' record</title><link>' + suppliedUrl +
      '</link><pubDate>Wed, 30 Sep 2026 12:00:00 GMT</pubDate><source>Supplied label</source></item>' +
      '<item><title>Missing provenance</title></item></channel></rss>';
    const requested = [];
    global.fetch = async url => { requested.push(String(url)); return { ok: true, status: 200, text: async () => xml }; };
    const reading = await fetcher();
    assert.equal(requested.length, 1, 'direct source succeeded without fallback');
    assert.equal(reading.value, 2); assert.equal(reading.headlines.length, 2);
    assert.equal(reading.headlineLinks[0], suppliedUrl);
    assert.equal(reading.headlinePublishers[0], 'Supplied label');
    assert.equal(reading.headlinePublishedAt[0], Date.parse('2026-09-30T12:00:00Z'));
    assert.equal(reading.headlineLinks[1], null); assert.equal(reading.headlinePublishers[1], null); assert.equal(reading.headlinePublishedAt[1], null);
    assert(reading.sourceUpdatedAt);
    titleFetchers.push({ name, requested, headlines: reading.headlines, identity: reading.sourceUpdatedAt });
  }
  for (const scenario of ['valid', 'effectiveness-unavailable', 'recovery']) {
    const requests = [];
    global.fetch = async url => {
      const u = String(url); requests.push(u);
      assert(u.startsWith('https://api.worldbank.org/v2/country/USA/indicator/GOV_WGI_'));
      const unavailable = scenario === 'effectiveness-unavailable' && u.includes('GE.EST');
      return { ok: true, status: 200, json: async () => [{ page: 1 }, [{ date: '2025', value: unavailable ? null : -0.6 }]] };
    };
    const effectiveness = await H._fetchWBGovEffectiveness(), law = await H._fetchWBRuleOfLaw();
    assert.equal(effectiveness === null, scenario === 'effectiveness-unavailable'); assert(law);
    const snapshot = H.testBuildDomain('governance', [{ name: 'World Bank Gov Effectiveness', data: effectiveness }, { name: 'World Bank Rule of Law', data: law }]);
    assert.equal(snapshot.sources[0].live, scenario !== 'effectiveness-unavailable');
    if (!effectiveness) { assert.equal(snapshot.sources[0].classification, 'broken'); assert.equal(snapshot.sources[0].value, null); assert(snapshot.lowSignal); }
    const sb = sandbox(global); sb.LIMENDomains = { governance: snapshot };
    sb.fetch = async url => {
      const relative = String(url).split('?')[0].replace(/^\//, ''), target = path.resolve(root, relative);
      if (!target.startsWith(root + path.sep) || !relative.endsWith('.json') || !fs.existsSync(target)) return { ok: false, status: 404 };
      const body = JSON.parse(fs.readFileSync(target, 'utf8')); return { ok: true, status: 200, json: async () => body };
    };
    vm.createContext(sb);
    for (const name of ['domain-identity.js', 'limen-k4-selfconsistency.js', 'limen-plasticity.js', 'limen-active-inference.js',
      'domain-brains/domain-brain-base.js', 'domain-brains/portal-content-resolver.js', 'domain-brains/inter-brain-bus.js',
      'domain-brains/domain-change-log.js', 'domain-brains/governance-brain.js'])
      vm.runInContext(fs.readFileSync(path.join(root, 'assets/js', name), 'utf8'), sb, { filename: name });
    const brain = sb.LIMENGovernanceBrain; await brain.cycle();
    const packet = Packet.fromBrainState('governance', brain.state, { snapshotId: 'fixture-governance-' + scenario, fetchedAt: Date.now() },
      'fixture-governance-source-join', new Date().toISOString(), { feedSourceEvidence: Packet.feedSourceEvidence('governance', snapshot) });
    assert.equal(packet.truth.feedSourceEvidence.sources[0].sourceUpdatedAt, effectiveness ? '2025' : null);
    assert.equal(packet.truth.feedSourceEvidence.sources[1].sourceUpdatedAt, '2025');
    const values = new Map(), indexes = new Map(), clone = v => v == null ? null : JSON.parse(JSON.stringify(v));
    const store = { packetIndexKey: 'packets', handoffIndexKey: 'handoffs', packetKey: id => 'packet:' + id, handoffKey: id => 'handoff:' + id,
      setNx: async (k, v) => { if (values.has(k)) return false; values.set(k, clone(v)); return true; }, get: async k => clone(values.get(k)),
      members: async k => Array.from(indexes.get(k) || []), add: async (k, v) => { const a = indexes.get(k) || new Set(); a.add(v); indexes.set(k, a); return a.size; } };
    const consumer = Consumer.createConsumer({ store }), consumed = await consumer.consumePacket(packet);
    assert(consumed.ok); assert(consumed.handoffsCreated > 0);
    for (const id of await store.members('handoffs')) {
      const handoff = await store.get(store.handoffKey(id));
      assert.equal(handoff.sourcePacketId, packet.packetId);
      assert.deepEqual(handoff.feedSourceEvidence, packet.truth.feedSourceEvidence);
    }
    const before = JSON.stringify(Array.from(values));
    const at = Date.parse(packet.generatedAt), cognition = { ts: at, c: Object.assign({}, JSON.parse(JSON.stringify(brain.state.cognition)),
      { domain: 'governance', serverPacket: packet, brainOrgans: { resourceMetabolism: brain.state.resourceMetabolism,
        autonomousInternalEmission: brain.state.domainAutoEmission || brain.state.energyAutoEmission || null } }) };
    assert.equal(Source.build([], cognition, at), null);
    for (const opportunity of packet.truth.opportunities) {
      const refusal = await Decision.decide(store, opportunity, at, cognition);
      assert.equal(refusal.status, 'NO_ACTION'); assert.deepEqual(refusal.blockers, ['source-grounded-governance-brief-required']);
    }
    assert.equal((await consumer.consumePacket(packet)).handoffsCreated, 0);
    assert.equal(JSON.stringify(Array.from(values)), before);
    results.push({ scenario, requests, sources: packet.truth.feedSourceEvidence, stress: snapshot.stress, lowSignal: snapshot.lowSignal,
      packetId: packet.packetId, diagnoses: packet.truth.activeDiagnoses.length, handoffs: consumed.handoffsCreated,
      nextBoundary: 'source-grounded-governance-brief-required', providerCalled: false });
  }
  if (process.argv.includes('--write-evidence')) fs.writeFileSync(path.join(root, 'docs/audits/continuity-governance-source-join.json'),
    JSON.stringify({ level: 'LOCAL/FIXTURE', externalFetches: false, injectedDiagnoses: false, injectedOpportunities: false, titleFetchers, results }, null, 2) + '\n');
  console.log(JSON.stringify(results.map(({ scenario, stress, lowSignal, diagnoses, handoffs }) => ({ scenario, stress, lowSignal, diagnoses, handoffs }))));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.fetch = originalFetch; });
