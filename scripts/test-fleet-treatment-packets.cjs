// F-07/F-08: authored source -> real resolver -> domain adapter -> diagnosis packet.
// No live fetch, timers, storage, trading or business execution. Finance is a control.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const DOMAINS = ('agriculture communication culture defense economy education energy environment ' +
  'finance governance industry infrastructure intelligence law medicine population religion science technology trade').split(' ');
const clone = value => JSON.parse(JSON.stringify(value));
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const sorted = values => Array.from(values).sort();
let passed = 0, failed = 0;
const counts = [];
async function test(name, run) {
  try { await run(); passed++; console.log('PASS ' + name); }
  catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message.split('\n')[0]); }
}
function harness(domain, portals = {}) {
  const win = { location: { pathname: '/', search: '' },
    LIMENDomainBrains: { register() {}, getAll: () => [] }, addEventListener() {}, dispatchEvent() {} };
  const sandbox = { window: win, URLSearchParams, console: { log() {}, warn() {}, error() {} },
    document: { createElement: () => ({}), head: { appendChild() {} }, addEventListener() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    setInterval: () => 0, clearInterval() {}, setTimeout: () => 0, clearTimeout() {},
    fetch: async url => {
      const match = String(url).match(/^\/assets\/data\/domains\/([A-Za-z0-9_]+)\.json$/);
      const data = match && (typeof portals === 'function' ? portals(match[1]) : portals[match[1]]);
      return { ok: !!data, status: data ? 200 : 404, json: async () => clone(data || {}) };
    }
  };
  Object.assign(win, { localStorage: sandbox.localStorage, document: sandbox.document,
    fetch: sandbox.fetch, setInterval: sandbox.setInterval });
  const ctx = vm.createContext(sandbox);
  for (const file of ['domain-brain-base.js', domain + '-brain.js', 'portal-content-resolver.js']) {
    vm.runInContext(read('assets/js/domain-brains/' + file), ctx, { filename: file });
    // Stop singleton startup only; explicitly exercise the real methods below.
    if (file === 'domain-brain-base.js') win.LIMENDomainBrainBase.prototype.start = function () {};
  }
  const name = ({ medicine: 'Health', science: 'Research', trade: 'SupplyChain' })[domain] ||
    domain[0].toUpperCase() + domain.slice(1);
  const brain = win['LIMEN' + name + 'Brain'];
  assert.ok(brain, domain + ' singleton');
  return { brain, resolver: win.LIMENPortalContentResolver };
}
// Use authored coordinates, never semantic labels or transient adapter IDs.
function sourceIdentity(domain, t) {
  assert.ok(t.treatmentSourceKey && t.sourcePortal, domain + ' authored source coordinates required');
  return JSON.stringify([t.treatmentSourceKey, t.sourcePortal, t.nodeId]);
}
function packet(brain, id) {
  return brain._buildDomainDiagnosisPacket(id == null ? null : { id, active: true }).treatmentContext;
}
function assertConservation(domain, h, ids) {
  const resolved = clone(h.brain.state.resolvedContent);
  assert.ok(resolved && resolved.totalTreatments > 0, domain + ' resolver must select records');
  const selected = Object.values(resolved.byDiagnosis).flatMap(pkg => pkg.treatments);
  const expected = new Map(selected.map(t => [sourceIdentity(domain, t), t]));
  assert.equal(expected.size, selected.length, 'resolver stores each selected identity once');
  const before = clone(h.brain.state.treatments);
  const runtimeKeys = before.map(t => sourceIdentity(domain, t));
  assert.equal(new Set(runtimeKeys).size, before.length, 'adapter must not introduce duplicate identities');
  assert.deepEqual(sorted(runtimeKeys), sorted([...expected.keys()]), 'exact resolver -> adapter identity set');
  const expectedPairs = [];
  const actualPairs = [];
  let nonHost = 0;
  for (const t of before) {
    const source = expected.get(sourceIdentity(domain, t));
    assert.deepEqual(sorted(t.diagnosisIds), sorted(source.diagnosisIds), 'adapter memberships');
    for (const field of ['label', 'nodeId', 'steps', 'cite', 'type', 'evidence', 'target', 'sourcePortal', 'treatmentSourceKey',
      'portalDomain', 'portalDomainId', 'ancestryPath', 'depth']) {
      assert.deepEqual(t[field], source[field], 'adapter preserves ' + field);
    }
    nonHost += source.diagnosisIds.filter(id => id !== t.diagnosisId).length;
  }
  for (const id of ids) {
    // Build the oracle from RESOLVER output, independently of the runtime filter.
    const wanted = selected.filter(t => t.diagnosisIds.includes(id));
    for (const t of wanted) expectedPairs.push(JSON.stringify([sourceIdentity(domain, t), id]));
    const context = packet(h.brain, id);
    const actualKeys = context.treatments.map(t => sourceIdentity(domain, t));
    const actualByKey = new Map(context.treatments.map(t => [sourceIdentity(domain, t), t]));
    for (const key of actualKeys) actualPairs.push(JSON.stringify([key, id]));
    assert.equal(new Set(actualKeys).size, actualKeys.length, id + ' no duplicate source');
    assert.deepEqual(sorted(actualKeys), sorted(wanted.map(t => sourceIdentity(domain, t))), id + ' exact source set');
    assert.deepEqual(clone(context.implementationSteps), wanted.flatMap(t => t.steps || []), id + ' implementation steps');
    for (const source of wanted) {
      assert.deepEqual(actualByKey.get(sourceIdentity(domain, source)).target, source.target, id + ' target');
    }
  }
  assert.deepEqual(sorted(actualPairs), sorted(expectedPairs), 'exact (source identity, diagnosis ID) set');
  assert.deepEqual(clone(packet(h.brain, 'F07_UNRELATED').treatments), []);
  assert.deepEqual(clone(packet(h.brain, 'F07_UNRELATED').implementationSteps), []);
  assert.deepEqual(clone(h.brain.state.treatments), before, 'packet building does not mutate records');
  return { pairs: sorted(actualPairs), entities: before.length, nonHost };
}
function fixture(domain) {
  const shared = domain + '_f07_shared', local = domain + '_f07_local';
  const portal = (id, label) => ({ domainId: id, activations: [{ brainNodeId: 'THAL', treatments: [
    { label, evidence: 'A', type: 'POLICY', target: id + ' authored target', cite: id + ' authored source', steps: [id + ' step 1', id + ' step 2'] }
  ] }] });
  const h = harness(domain, { [shared]: portal(shared, 'Shared action'), [local]: portal(local, 'Local action') });
  Object.assign(h.resolver.getDiagnosisPortalMap(), {
    F07_A: [shared], F07_B: [shared, local], F07_C: [local], F07_D: []
  });
  return h;
}
async function resolve(h, ids) {
  h.brain.state.diagnoses = ids.map(id => ({ id, active: true }));
  h.brain.state.treatments = [];
  await h.brain.resolveDeepContent();
}
function localPortal(slug) {
  const file = path.join(ROOT, 'assets/data/domains', slug + '.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}
// Independent oracle from authored JSON and diagnosis->portal mapping, not resolver
// output or its key helper. L1 scope matches the default per-cycle resolver call.
function authoredPools(h, ids, load) {
  const pools = new Map();
  for (const id of ids) {
    const records = new Map();
    for (const slug of new Set(h.resolver.getDiagnosisPortalMap()[id] || [])) {
      const doc = load(slug);
      if (!doc) continue;
      (doc.activations || []).forEach((a, ai) => (a.treatments || []).forEach((t, ti) => {
        const key = JSON.stringify([slug, a.brainNodeId || '', ai, ti]);
        records.set(key, { key, sourcePortal: slug, nodeId: a.brainNodeId || '', authored: t });
      }));
    }
    pools.set(id, records);
  }
  return pools;
}
function verifyAuthoredSelection(result, pools, uncapped, cap = 200) {
  const selected = Object.values(result.byDiagnosis).flatMap(p => p.treatments);
  const all = new Map();
  const associations = new Map();
  for (const [id, records] of pools) for (const [key, record] of records) {
    all.set(key, record);
    if (!associations.has(key)) associations.set(key, []);
    associations.get(key).push(id);
  }
  const keys = selected.map(t => t.treatmentSourceKey);
  assert.equal(new Set(keys).size, keys.length, 'no duplicated authored occurrence');
  if (uncapped) assert.deepEqual(sorted(keys), sorted([...all.keys()]), 'uncapped exact authored source set');
  // Independent L1 quota/rank oracle from source JSON. Preserve full-depth and
  // evidence priorities; authored keys only break ties. Verify hosts as well as sets.
  const evidence = { A: 10, Strong: 10, B: 7, Moderate: 7, C: 4, Emerging: 1 };
  const depth = t => !!(t.steps && t.steps.length && t.cite);
  const claimed = new Set();
  for (const id of sorted([...pools.keys()])) {
    const ranked = [...pools.get(id).values()].sort((a, b) =>
      Number(depth(b.authored)) - Number(depth(a.authored)) ||
      (evidence[b.authored.evidence] || 0) - (evidence[a.authored.evidence] || 0) ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const wanted = [];
    for (const source of ranked) {
      if (wanted.length >= (uncapped ? 100000 : cap)) break;
      if (!claimed.has(source.key)) { claimed.add(source.key); wanted.push(source.key); }
    }
    assert.deepEqual(sorted(result.byDiagnosis[id].treatments.map(t => t.treatmentSourceKey)), sorted(wanted), id + ' independent rank/quota/host selection');
  }
  for (const t of selected) {
    const source = all.get(t.treatmentSourceKey);
    assert.ok(source, 'selection points to actual authored coordinates');
    assert.equal(t.sourcePortal, source.sourcePortal);
    assert.equal(t.nodeId, source.nodeId);
    assert.equal(t.label, source.authored.label || '');
    assert.equal(t.cite, source.authored.cite || null);
    assert.deepEqual(clone(t.steps), source.authored.steps || []);
    assert.deepEqual(sorted(t.diagnosisIds), sorted(associations.get(source.key)), 'only genuine same-source associations');
  }
  const entries = [...pools.values()].reduce((n, p) => n + p.size, 0);
  assert.equal(result.poolEntries, entries);
  assert.equal(result.poolUniqueIdentities, all.size);
  assert.equal(result.poolDuplicates, entries - all.size);
  return { authored: all.size, legacy: new Set([...all.values()].map(t => JSON.stringify([t.nodeId, t.authored.label || '']))).size };
}
(async () => {
  await test('reported Communication CC collision retains both committed portal occurrences', async () => {
    const h = harness('communication', localPortal);
    const ids = localPortal('communication').issues.map(d => d.id);
    const result = await h.resolver.resolveForBrain({ domainId: 'communication', diagnoses: ids.map(id => ({ id, active: true })) }, { maxTreatments: 100000 });
    const collision = Object.values(result.byDiagnosis).flatMap(p => p.treatments).filter(t =>
      t.nodeId === 'CC' && t.label === 'Deploy Stakeholder Coordination Integrated Technology Platform');
    console.log('  REPORTED_COLLISION retained=' + collision.length + ' portals=' + JSON.stringify(collision.map(t => t.ancestryPath.at(-1))));
    assert.equal(collision.length, 2, 'both named committed occurrences must survive');
    assert.deepEqual(sorted(collision.map(t => t.sourcePortal)), ['communication_analytics', 'communication_disinfo']);
    verifyAuthoredSelection(result, authoredPools(h, ids, localPortal), true);
  });
  for (const domain of DOMAINS) {
    await test(domain + ': same-label authored positions stay distinct; shared sources merge only memberships', async () => {
      const a = domain + '_f08_a', b = domain + '_f08_b';
      const action = marker => ({ label: 'Identical label', cite: marker + ' citation', steps: [marker + ' step'], evidence: 'A' });
      // Deliberately reused payload domainId: fetched route must define source identity.
      const docs = { [a]: { domainId: 'reused', activations: [
        { brainNodeId: 'CC', treatments: [action('a0'), action('a1')] },
        { brainNodeId: 'CC', treatments: [action('a2')] }
      ] }, [b]: { domainId: 'reused', activations: [{ brainNodeId: 'CC', treatments: [action('b0')] }] } };
      const h = harness(domain, docs), ids = ['F08_A', 'F08_B', 'F08_C'];
      Object.assign(h.resolver.getDiagnosisPortalMap(), { F08_A: [a, a], F08_B: [a, b], F08_C: [b] });
      const pools = authoredPools(h, ids, slug => docs[slug]);
      let first;
      for (const order of [ids, ids.slice().reverse()]) {
        await resolve(h, order);
        assert.equal(h.brain.state.resolvedContent.totalUnique, 4, 'four authored occurrences, not one label');
        verifyAuthoredSelection(h.brain.state.resolvedContent, pools, true);
        const result = assertConservation(domain, h, ids);
        if (first) assert.deepEqual(result, first);
        first = result;
      }
      // Reverse cached full pools, not authored array positions; source coordinates
      // are immutable within this corpus revision. Ranking/ties must be deterministic.
      const state = { domainId: domain, diagnoses: ids.map(id => ({ id, active: true })) };
      const capped = await h.resolver.resolveForBrain(state, { maxTreatments: 1 });
      for (const id of ids) (await h.resolver.resolveForDiagnosis(id)).reverse();
      const reversed = await h.resolver.resolveForBrain(state, { maxTreatments: 1 });
      const view = r => Object.entries(r.byDiagnosis).map(([id, p]) => [id, p.treatments.map(t => [t.treatmentSourceKey, clone(t.diagnosisIds)])]);
      assert.deepEqual(view(reversed), view(capped), 'quota selection invariant to cached pool ordering');
      verifyAuthoredSelection(capped, pools, false, 1);
      // Missing keys cannot justify merging, even when node/label/portal match.
      for (const id of ids) for (const t of await h.resolver.resolveForDiagnosis(id)) delete t.treatmentSourceKey;
      const unknown = await h.resolver.resolveForBrain(state, { maxTreatments: 100000 });
      assert.equal(unknown.totalUnique, 8, 'unknown identity stays occurrence-local');
      assert.ok(Object.values(unknown.byDiagnosis).every(p => p.treatments.every(t =>
        t.diagnosisIds.length === 1 && t.diagnosisIds[0] === p.diagnosisId)), 'no inferred membership from missing keys');
    });
    await test(domain + ': real resolver memberships survive adapter and packets in three orders', async () => {
      const h = fixture(domain);
      const orders = [['F07_A', 'F07_B', 'F07_C', 'F07_D'], ['F07_D', 'F07_C', 'F07_B', 'F07_A'], ['F07_B', 'F07_D', 'F07_A', 'F07_C']];
      let first;
      for (const ids of orders) {
        await resolve(h, ids);
        const result = assertConservation(domain, h, ids);
        assert.equal(result.entities, 2);
        assert.equal(result.nonHost, 2);
        assert.equal(result.pairs.length, 4);
        if (first) assert.deepEqual(result.pairs, first, 'diagnosis order invariance');
        first = result.pairs;
        h.brain.state.treatments.reverse();
        for (const id of ids) {
          const keys = packet(h.brain, id).treatments.map(t => JSON.stringify([sourceIdentity(domain, t), id]));
          assert.deepEqual(sorted(keys), first.filter(pair => JSON.parse(pair)[1] === id), 'treatment order invariance');
        }
      }
    });
    await test(domain + ': singular hosts, member-only records, aggregate and malformed membership', async () => {
      const h = harness(domain);
      const records = [
        { id: 'legacy', diagnosisId: 'A', steps: ['legacy'] },
        { id: 'empty', diagnosisId: 'A', diagnosisIds: [], steps: ['empty'] },
        { id: 'shared', diagnosisId: 'A', diagnosisIds: ['A', 'B', 'B'], steps: ['shared'] },
        { id: 'member', diagnosisIds: ['B'], steps: ['member'] },
        { id: 'host-outside-array', diagnosisId: 'A', diagnosisIds: ['B'], steps: ['host-outside-array'] },
        { id: 'string', diagnosisId: 'C', diagnosisIds: 'B', steps: ['string'] },
        { id: 'object', diagnosisId: 'C', diagnosisIds: { 0: 'B' }, steps: ['object'] },
        { id: 'unassigned', steps: ['unassigned'] }
      ];
      h.brain.state.treatments = clone(records);
      const expect = { A: ['legacy', 'empty', 'shared', 'host-outside-array'], B: ['shared', 'member', 'host-outside-array'], C: ['string', 'object'], D: [] };
      for (const [id, keys] of Object.entries(expect)) {
        const context = packet(h.brain, id);
        assert.deepEqual(clone(context.treatments.map(t => t.id)), keys);
        assert.deepEqual(clone(context.implementationSteps), keys);
      }
      assert.deepEqual(clone(packet(h.brain, null).treatments), records);
      assert.deepEqual(clone(packet(h.brain, null).implementationSteps), records.flatMap(t => t.steps));
      assert.deepEqual(clone(h.brain.state.treatments), records);
    });
    await test(domain + ': committed corpus exact association pairs and steps through real adapter', async () => {
      const rootKey = domain === 'agriculture' ? 'p2_agri' : domain;
      const root = JSON.parse(read('assets/data/domains/' + rootKey + '.json'));
      const ids = root.issues.map(d => d.id);
      assert.ok(ids.length > 1, 'multiple real diagnoses required');
      const h = harness(domain, localPortal);
      const authored = authoredPools(h, ids, localPortal);
      await resolve(h, ids);
      const selected = Object.values(h.brain.state.resolvedContent.byDiagnosis).flatMap(pkg => pkg.treatments);
      const nonHost = selected.reduce((n, t) => n + t.diagnosisIds.length - 1, 0);
      console.log('  CORPUS ' + domain + ' selected=' + selected.length + ' nonHost=' + nonHost);
      assert.ok(selected.some(t => t.diagnosisIds.length > 1 && t.steps.length > 0), 'real shared implementation steps required');
      const forward = assertConservation(domain, h, ids);
      verifyAuthoredSelection(h.brain.state.resolvedContent, authored, false);
      await resolve(h, ids.slice().reverse());
      const reverse = assertConservation(domain, h, ids.slice().reverse());
      assert.deepEqual(reverse, forward, 'real corpus order invariance');
      const all = await h.resolver.resolveForBrain(h.brain.state, { maxTreatments: 100000 });
      const audit = verifyAuthoredSelection(all, authored, true);
      counts.push({ domain, entities: forward.entities, associations: forward.pairs.length, nonHost: forward.nonHost,
        authoredPool: audit.authored, legacyPool: audit.legacy, previouslyConflated: audit.authored - audit.legacy });
    });
  }
  console.log('CORPUS_COUNTS ' + JSON.stringify(counts));
  console.log(`${passed}/${passed + failed} fleet packet tests passed`);
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
