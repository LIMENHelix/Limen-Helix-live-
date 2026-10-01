'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const acorn = require('acorn');
const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'handlers/domain-snapshot.js');
const mod = new Module(filename, module);
mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
mod._compile(fs.readFileSync(filename, 'utf8') + '\nmodule.exports.testBuildDomain = buildDomain;', filename);
const H = mod.exports;
const harness = fs.readFileSync(path.join(__dirname, 'test-continuity-feed-spine.cjs'), 'utf8');
const helper = acorn.parse(harness, { ecmaVersion: 'latest' }).body.find(n => n.type === 'FunctionDeclaration' && n.id.name === 'sandbox');
const makeSandbox = new Function('global', harness.slice(helper.start, helper.end) + ';return sandbox();');
const Packet = require('../lib/civilization-server-packet.js');
const Consumer = require('../lib/civilization-handoff-consumer.js');
const PublicationSource = require('../lib/defense-publication-source.js');
const PublicationDecision = require('../lib/defense-publication-decision.js');
const PublicationExecutor = require('../lib/defense-publication-executor.js');
const originalFetch = global.fetch;
(async () => {
  const results = [];
  for (const scenario of ['valid', 'ofac-unavailable', 'recovery']) {
    const requests = [];
    const html = '<html>' + 'official source '.repeat(25) + '<div class="views-row"><a href="/recent-actions/20260929">' +
      'sanctions designation '.repeat(12) + '</a></div></html>';
    const kev = { catalogVersion: 'LOCAL-FIXTURE-1', count: 18, dateReleased: new Date().toISOString(), vulnerabilities:
      Array.from({ length: 18 }, (_, i) => ({ cveID: 'CVE-2026-' + (1000 + i), dateAdded: new Date().toISOString().slice(0, 10), knownRansomwareCampaignUse: 'Known' })) };
    global.fetch = async url => {
      requests.push(String(url));
      if (String(url) === 'https://ofac.treasury.gov/recent-actions')
        return { ok: true, status: 200, text: async () => scenario === 'ofac-unavailable' ? '' : html };
      assert.equal(String(url), 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json');
      return { ok: true, status: 200, json: async () => kev };
    };
    const ofac = await H._fetchOFACRecentActions(), cisa = await H._fetchCISAKEV();
    assert(cisa && cisa.sourceUpdatedAt);
    assert.equal(ofac === null, scenario === 'ofac-unavailable');
    const snapshot = H.testBuildDomain('defense', [{ name: 'OFAC Recent Actions', data: ofac }, { name: 'CISA KEV', data: cisa }]);
    assert.equal(snapshot.sources[0].live, scenario !== 'ofac-unavailable');
    if (!ofac) { assert.equal(snapshot.sources[0].classification, 'broken'); assert.equal(snapshot.sources[0].value, null); assert.equal(snapshot.lowSignal, true); }
    const sb = makeSandbox(global);
    sb.LIMENDomains = { defense: snapshot };
    sb.fetch = async url => {
      const relative = String(url).split('?')[0].replace(/^\//, ''), file = path.resolve(root, relative);
      if (!file.startsWith(root + path.sep) || !relative.endsWith('.json') || !fs.existsSync(file)) return { ok: false, status: 404 };
      const body = JSON.parse(fs.readFileSync(file, 'utf8'));
      return { ok: true, status: 200, json: async () => body };
    };
    vm.createContext(sb);
    for (const file of ['domain-identity.js', 'limen-k4-selfconsistency.js', 'limen-plasticity.js', 'limen-active-inference.js',
      'domain-brains/domain-brain-base.js', 'domain-brains/portal-content-resolver.js', 'domain-brains/inter-brain-bus.js',
      'domain-brains/domain-change-log.js', 'domain-brains/defense-brain.js'])
      vm.runInContext(fs.readFileSync(path.join(root, 'assets/js', file), 'utf8'), sb, { filename: file });
    const brain = sb.LIMENDefenseBrain;
    await brain.cycle();
    assert.equal(brain.state.feeds[0].live, snapshot.sources[0].live);
    const packet = Packet.fromBrainState('defense', brain.state,
      { snapshotId: 'fixture-defense-source-' + scenario, fetchedAt: Date.now() }, 'fixture-defense-source-join', new Date().toISOString(),
      { feedSourceEvidence: Packet.feedSourceEvidence('defense', snapshot) });
    assert.equal(packet.truth.feedSourceEvidence.sources[0].sourceUpdatedAt, ofac && ofac.sourceUpdatedAt);
    assert.equal(packet.truth.feedSourceEvidence.sources[1].sourceUpdatedAt, cisa.sourceUpdatedAt);
    const handoffs = packet.truth.opportunities.filter(o => Packet.ACTIVE_LANES.includes(o.lane)).map(o => Packet.toHandoff(packet, o.lane, o));
    for (const handoff of handoffs) assert.deepEqual(handoff.feedSourceEvidence, packet.truth.feedSourceEvidence);
    assert(handoffs.length > 0);
    const values = new Map(), indexes = new Map(), clone = value => value == null ? null : JSON.parse(JSON.stringify(value));
    const store = { packetIndexKey: 'packets', handoffIndexKey: 'handoffs', packetKey: id => 'packet:' + id, handoffKey: id => 'handoff:' + id,
      setNx: async (key, value) => { if (values.has(key)) return false; values.set(key, clone(value)); return true; },
      get: async key => clone(values.get(key)), members: async key => Array.from(indexes.get(key) || []),
      add: async (key, value) => { const entries = indexes.get(key) || new Set(); entries.add(value); indexes.set(key, entries); return entries.size; } };
    const consumer = Consumer.createConsumer({ store });
    const persisted = await consumer.consumePacket(packet);
    assert.equal(persisted.ok, true); assert.equal(persisted.handoffsCreated, handoffs.length);
    for (const handoff of handoffs) assert.deepEqual((await store.get(store.handoffKey(handoff.handoffId))).feedSourceEvidence, packet.truth.feedSourceEvidence);
    const before = JSON.stringify(Array.from(values));
    assert.equal((await consumer.consumePacket(packet)).handoffsCreated, 0);
    assert.equal(JSON.stringify(Array.from(values)), before);
    const at = Date.parse(packet.generatedAt);
    const cognition = { ts: at, c: Object.assign({}, JSON.parse(JSON.stringify(brain.state.cognition)), {
      domain: 'defense', serverPacket: packet, brainOrgans: { resourceMetabolism: brain.state.resourceMetabolism,
        autonomousInternalEmission: brain.state.domainAutoEmission || brain.state.energyAutoEmission || null } }) };
    // These parsers produce count/collection identities, not publication title sets.
    // Do not manufacture headline URLs or publisher independence from them.
    assert.equal(ofac && ofac.headlines || null, null);
    assert.equal(cisa.headlines || null, null);
    const publicationCandidate = PublicationSource.build([], cognition, at);
    assert.equal(publicationCandidate, null);
    const refusals = [];
    for (const opportunity of packet.truth.opportunities) {
      const refused = await PublicationDecision.decide(store, opportunity, at, cognition);
      assert.equal(refused.status, 'NO_ACTION');
      assert.equal(refused.reason, 'defense-publication-candidate-invalid');
      assert.deepEqual(refused.blockers, ['source-grounded-defense-brief-required']);
      const held = await PublicationExecutor.execute({ store, candidate: opportunity, decision: refused, now: at,
        publisher: { publish: async () => { throw new Error('source-refused native opportunity cannot publish'); } } });
      assert.equal(held.status, 'HELD');
      assert.equal(held.reason, 'defense-publication-exact-b10-decision-required');
      assert.equal(held.providerCalls, 0);
      refusals.push({ opportunityId: opportunity.id, reason: refused.reason, blockers: refused.blockers, executorReason: held.reason });
    }
    assert.equal(JSON.stringify(Array.from(values)), before);
    results.push({ scenario, requests, snapshotStress: snapshot.stress, stressBasis: snapshot.stressBasis,
      lowSignal: snapshot.lowSignal, feedSourceEvidence: packet.truth.feedSourceEvidence, packetId: packet.packetId,
      diagnoses: packet.truth.activeDiagnoses.length, opportunities: packet.truth.opportunities.length, handoffs: handoffs.length,
      publicationIntake: { candidateCreated: false, headlineSetsInvented: false, refusals, storedValuesUnchanged: true },
      nextBoundary: 'source-grounded-defense-brief-required', providerCalled: false });
  }
  if (process.argv.includes('--write-evidence')) fs.writeFileSync(path.join(root, 'docs/audits/continuity-defense-source-join.json'),
    JSON.stringify({ level: 'LOCAL/FIXTURE', externalFetches: false, injectedDiagnoses: false, injectedOpportunities: false, results }, null, 2) + '\n');
  console.log(JSON.stringify(results.map(({ scenario, snapshotStress, lowSignal, diagnoses, opportunities, handoffs }) =>
    ({ scenario, snapshotStress, lowSignal, diagnoses, opportunities, handoffs }))));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.fetch = originalFetch; });
