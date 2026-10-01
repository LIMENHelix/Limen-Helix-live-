'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const acorn = require('acorn');
const root = path.resolve(__dirname, '..');
// Test-only access to the actual private assembler; no runtime export added.
const filename = path.join(root, 'handlers/domain-snapshot.js');
const sourceModule = new Module(filename, module);
sourceModule.filename = filename;
sourceModule.paths = Module._nodeModulePaths(path.dirname(filename));
sourceModule._compile(fs.readFileSync(filename, 'utf8') + '\nmodule.exports.testBuildDomain = buildDomain;', filename);
const H = sourceModule.exports;
const harness = fs.readFileSync(path.join(__dirname, 'test-continuity-feed-spine.cjs'), 'utf8');
const helper = acorn.parse(harness, { ecmaVersion: 'latest' }).body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'sandbox');
assert(helper, 'use the existing native runtime sandbox');
const makeSandbox = new Function('global', harness.slice(helper.start, helper.end) + ';return sandbox();');
const Packet = require('../lib/civilization-server-packet.js');
const Consumer = require('../lib/civilization-handoff-consumer.js');
const Worker = require('../handlers/limen-worker-autofire.js');
const originalFetch = global.fetch;
const scenarios = [['measured', '45', '10'], ['invalid', 'bad', '10'], ['zero', '0', '0'], ['recovery', '45', '10']];
(async () => {
  const results = [];
  for (const [name, d2, d3] of scenarios) {
    const requested = [];
    const csv = 'MapDate,AreaOfInterest,None,D0,D1,D2,D3,D4,ValidStart,ValidEnd,StatisticFormatID\n' +
      '20260929,CONUS,20,60,50,' + d2 + ',' + d3 + ',0,20260929,20261005,1\n';
    const html = '<html>' + 'official assessment '.repeat(20) + '<!-- Begin content area -->' +
      'drought persists '.repeat(16) + '<!-- End content area --></html>';
    global.fetch = async url => {
      requested.push(String(url));
      const body = String(url).includes('usdmdataservices.unl.edu') ? csv : html;
      assert(/usdmdataservices\.unl\.edu|www\.cpc\.ncep\.noaa\.gov/.test(String(url)), 'only identified upstream fixture URLs');
      return { ok: true, status: 200, text: async () => body };
    };
    const drought = await H._fetchUSDADroughtMonitor();
    const outlook = await H._fetchNOAACPCDrought();
    assert(outlook && outlook.sourceUpdatedAt);
    assert.equal(drought === null, name === 'invalid');
    const snapshot = H.testBuildDomain('agriculture', [
      { name: 'USDA Drought Monitor', data: drought }, { name: 'NOAA CPC Drought', data: outlook }
    ]);
    assert.equal(snapshot.sources[0].live, name !== 'invalid');
    if (name === 'invalid') {
      assert.equal(snapshot.sources[0].classification, 'broken');
      assert.equal(snapshot.sources[0].value, null);
      assert.equal(snapshot.sources[0].failReason, 'invalid cumulative D2/D3 percentages');
      assert.equal(snapshot.lowSignal, true);
      assert(snapshot.stress <= 0.3);
    } else {
      assert.equal(snapshot.sources[0].sourceUpdatedAt, '20260929');
      assert.equal(snapshot.sources[0].value, Number(d2));
    }
    const sb = makeSandbox(global);
    sb.LIMENDomains = { agriculture: snapshot };
    sb.fetch = async url => {
      const relative = String(url).split('?')[0].replace(/^\//, '');
      const file = path.resolve(root, relative);
      if (!file.startsWith(root + path.sep) || !relative.endsWith('.json') || !fs.existsSync(file)) return { ok: false, status: 404 };
      const body = JSON.parse(fs.readFileSync(file, 'utf8'));
      return { ok: true, status: 200, json: async () => body };
    };
    vm.createContext(sb);
    for (const file of ['domain-identity.js', 'limen-k4-selfconsistency.js', 'limen-plasticity.js', 'limen-active-inference.js',
      'domain-brains/domain-brain-base.js', 'domain-brains/portal-content-resolver.js', 'domain-brains/inter-brain-bus.js',
      'domain-brains/domain-change-log.js', 'domain-brains/agriculture-brain.js']) {
      vm.runInContext(fs.readFileSync(path.join(root, 'assets/js', file), 'utf8'), sb, { filename: file });
    }
    const brain = sb.LIMENAgricultureBrain;
    await brain.cycle();
    assert.equal(brain.state.feeds[0].live, snapshot.sources[0].live);
    assert.equal(brain.state.feeds[0].value, snapshot.sources[0].value);
    const packet = Packet.fromBrainState('agriculture', brain.state,
      { snapshotId: 'fixture-upstream-agriculture-' + name, fetchedAt: Date.now() }, 'fixture-source-join', new Date().toISOString());
    assert.equal(packet.domainId, 'agriculture');
    const values = new Map(), indexes = new Map();
    const clone = value => value == null ? null : JSON.parse(JSON.stringify(value));
    const store = { packetIndexKey: 'packets', handoffIndexKey: 'handoffs',
      packetKey: id => 'packet:' + id, handoffKey: id => 'handoff:' + id,
      setNx: async (key, value) => { if (values.has(key)) return false; values.set(key, clone(value)); return true; },
      get: async key => clone(values.get(key)), members: async key => Array.from(indexes.get(key) || []),
      add: async (key, value) => { const entries = indexes.get(key) || new Set(); entries.add(value); indexes.set(key, entries); return entries.size; } };
    const consumer = Consumer.createConsumer({ store });
    const consumed = await consumer.consumePacket(packet);
    assert.equal(consumed.ok, true);
    assert(consumed.handoffsCreated > 0);
    const before = JSON.stringify(Array.from(values));
    const handoffs = [];
    for (const id of await store.members('handoffs')) {
      const handoff = await store.get(store.handoffKey(id));
      assert.equal(handoff.sourcePacketId, packet.packetId);
      assert.equal(Worker.isEligibleCandidate(handoff, Date.parse(packet.generatedAt)), false);
      assert.equal(Worker.isEligibleCandidate(handoff.opportunity, Date.parse(packet.generatedAt)), false);
      handoffs.push({ handoffId: id, opportunityId: handoff.opportunityId, lane: handoff.lane, eligible: false });
    }
    const replay = await consumer.consumePacket(packet);
    assert.equal(replay.ok, true);
    assert.equal(replay.handoffsCreated, 0);
    assert.equal(JSON.stringify(Array.from(values)), before);
    results.push({ scenario: name, upstreamRequests: requested, sources: snapshot.sources,
      stress: snapshot.stress, stressBasis: snapshot.stressBasis, lowSignal: snapshot.lowSignal,
      packetId: packet.packetId, diagnoses: packet.truth.activeDiagnoses.length, opportunities: packet.truth.opportunities.length,
      handoffs, nextBoundary: 'native-agriculture-handoff-is-not-eligible-autofire-actor-candidate', providerCalled: false });
  }
  if (process.argv.includes('--write-evidence')) fs.writeFileSync(path.join(root, 'docs/audits/continuity-agriculture-source-join.json'),
    JSON.stringify({ level: 'LOCAL/FIXTURE', externalFetches: false, injectedDiagnoses: false, injectedOpportunities: false, results }, null, 2) + '\n');
  console.log(JSON.stringify(results.map(({ scenario, stress, stressBasis, lowSignal, diagnoses, opportunities }) =>
    ({ scenario, stress, stressBasis, lowSignal, diagnoses, opportunities }))));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.fetch = originalFetch; });
