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
  const titleInputs = [];
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
    const sourceNames = { GovTrack: 'GovTrack', CongressGov: 'Congress.gov', GAO: 'GAO Reports', CBO: 'CBO Publications' };
    titleInputs.push({ name: sourceNames[name], data: reading });
    titleFetchers.push({ name, requested, headlines: reading.headlines, identity: reading.sourceUpdatedAt });
  }
  for (const scenario of ['valid', 'effectiveness-unavailable', 'recovery', 'combined-title-feeds']) {
    const requests = [];
    global.fetch = async url => {
      const u = String(url); requests.push(u);
      assert(u.startsWith('https://api.worldbank.org/v2/country/USA/indicator/GOV_WGI_'));
      const unavailable = scenario === 'effectiveness-unavailable' && u.includes('GE.EST');
      return { ok: true, status: 200, json: async () => [{ page: 1 }, [{ date: '2025', value: unavailable ? null : -0.6 }]] };
    };
    const effectiveness = await H._fetchWBGovEffectiveness(), law = await H._fetchWBRuleOfLaw();
    assert.equal(effectiveness === null, scenario === 'effectiveness-unavailable'); assert(law);
    const inputs = [{ name: 'World Bank Gov Effectiveness', data: effectiveness }, { name: 'World Bank Rule of Law', data: law }];
    if (scenario === 'combined-title-feeds') inputs.push(...titleInputs);
    const snapshot = H.testBuildDomain('governance', inputs);
    let recordedTitles = [];
    if (scenario === 'combined-title-feeds') {
      const memory = new Map(), lists = new Map(), copy = v => v == null ? null : JSON.parse(JSON.stringify(v));
      const db = { getBackend: () => 'TEST_MEMORY', get: async k => copy(memory.get(k)), set: async (k, v) => { memory.set(k, copy(v)); return true; },
        lpush: async (k, v) => { const a = lists.get(k) || []; a.unshift(copy(v)); lists.set(k, a); return a.length; },
        lrange: async (k, a, b) => copy((lists.get(k) || []).slice(a, b < 0 ? undefined : b + 1)),
        ltrim: async (k, a, b) => { lists.set(k, (lists.get(k) || []).slice(a, b + 1)); return true; } };
      const recorderFile = path.join(root, 'handlers/feed-record.js'), recorder = new Module(recorderFile, module);
      recorder.filename = recorderFile; recorder.paths = Module._nodeModulePaths(path.dirname(recorderFile));
      const actualRequire = recorder.require.bind(recorder);
      recorder.require = id => id === '../lib/limen-db' ? db : id === '../lib/cron-auth' ? { enforce: () => true } :
        id === '../lib/heartbeat' ? { wrap: (_, handler) => handler } : actualRequire(id);
      recorder._compile(fs.readFileSync(recorderFile, 'utf8'), recorderFile);
      global.fetch = async () => ({ json: async () => ({ domains: { governance: snapshot }, meta: {} }) });
      let recorded;
      const response = { setHeader() {}, status() { return this; }, json(body) { recorded = body; return this; } };
      await recorder.exports({ url: '/api/feed-record', headers: {} }, response);
      assert(recorded && recorded.ok);
      recordedTitles = await db.lrange('feedtitles:governance', 0, -1);
      assert.equal(recordedTitles.length, 4);
      assert.equal(Source.collect(recordedTitles, Date.now()).length, 4);
    }
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
    let publication = null;
    if (scenario === 'combined-title-feeds') {
      const candidate = Source.build(recordedTitles, cognition, at);
      assert(Source.validate(candidate)); assert.equal(candidate.governancePacketId, packet.packetId);
      assert(packet.truth.opportunities.some(o => o.id === candidate.brainSelection.id && o.path === 'RESEARCHABLE'));
      const lists = new Map();
      const decisionStore = Object.assign({}, store, { assertDurable() {}, setIfAbsent: store.setNx,
        lpush: async (k, v) => { const a = lists.get(k) || []; a.unshift(clone(v)); lists.set(k, a); return a.length; },
        lrange: async (k, a, b) => clone((lists.get(k) || []).slice(a, b < 0 ? undefined : b + 1)),
        ltrim: async (k, a, b) => { lists.set(k, (lists.get(k) || []).slice(a, b + 1)); return true; } });
      const selected = await Decision.decide(decisionStore, candidate, at, cognition);
      assert(selected.decisionReceiptId, JSON.stringify(selected));
      assert.equal(selected.status, 'NO_ACTION'); assert(selected.blockers.includes('governance-immune-veto'));
      assert.deepEqual(await store.get(Decision.key(selected.decisionReceiptId)), selected);
      assert.equal((await Decision.decide(decisionStore, candidate, at, cognition)).decisionReceiptId, selected.decisionReceiptId);
      const beforeDispatch = JSON.stringify(Array.from(values));
      const held = await require('../lib/governance-publication-executor.js').execute({ store: decisionStore, candidate, decision: selected, now: at,
        publisher: { publish: async () => { throw new Error('native veto must not publish'); } } });
      assert.equal(held.reason, 'governance-publication-exact-b10-decision-required'); assert.equal(held.providerCalls, 0);
      const trace = await require('../lib/product-domain-business-trace-readout.js').read(decisionStore, 'governance', at + 1);
      assert.equal(trace.status, 'RECORDED'); assert.equal(trace.decision.packetId, packet.packetId);
      assert(trace.decision.blockers.includes('governance-immune-veto')); assert.equal(trace.command, null); assert.equal(trace.externalActionAuthorized, false);
      assert.equal(JSON.stringify(Array.from(values)), beforeDispatch);
      publication = { candidateId: candidate.candidateId, selectedOpportunityId: candidate.brainSelection.id, titleSets: recordedTitles.length,
        sources: candidate.sources, decisionId: selected.decisionReceiptId, blockers: selected.blockers, operatorReadout: trace.status, providerCalls: held.providerCalls };
    }
    results.push({ scenario, requests, sources: packet.truth.feedSourceEvidence, stress: snapshot.stress, lowSignal: snapshot.lowSignal,
      packetId: packet.packetId, diagnoses: packet.truth.activeDiagnoses.length, handoffs: consumed.handoffsCreated,
      publication, nextBoundary: publication ? publication.blockers.join(';') : 'source-grounded-governance-brief-required', providerCalled: false });
  }
  if (process.argv.includes('--write-evidence')) fs.writeFileSync(path.join(root, 'docs/audits/continuity-governance-source-join.json'),
    JSON.stringify({ level: 'LOCAL/FIXTURE', externalFetches: false, injectedDiagnoses: false, injectedOpportunities: false, titleFetchers, results }, null, 2) + '\n');
  console.log(JSON.stringify(results.map(({ scenario, stress, lowSignal, diagnoses, handoffs }) => ({ scenario, stress, lowSignal, diagnoses, handoffs }))));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.fetch = originalFetch; });
