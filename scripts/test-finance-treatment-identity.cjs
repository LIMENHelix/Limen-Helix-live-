// F-01: offline identity conservation through the REAL digest rotation, resolver
// and Finance merge. No network, timers, trading, storage, or deployed state.
// Run: node scripts/test-finance-treatment-identity.cjs
// Reproduce the original defect (expected exit 1): append --baseline.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const BASELINE = process.argv.includes('--baseline');
const BASE_SHA = 'bab392ebaa2745032040950fb325a099e639d8fe';
function readPinned(file) {
  return execFileSync('git', ['show', BASE_SHA + ':' + file], { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
}
function readSource(file) {
  return BASELINE ? readPinned(file) : fs.readFileSync(path.join(ROOT, file), 'utf8');
}
const clone = x => JSON.parse(JSON.stringify(x));
let passed = 0, failed = 0;
async function test(name, run) {
  try { await run(); passed++; console.log('PASS ' + name); }
  catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message); }
}
function harness(portals = {}, read = readSource) {
  const win = { location: { pathname: '/', search: '' },
    LIMENDomainBrains: { register() {} }, addEventListener() {}, dispatchEvent() {} };
  const sandbox = { window: win, URLSearchParams, console: { log() {}, warn() {}, error() {} },
    document: { createElement: () => ({}), head: { appendChild() {} }, addEventListener() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    setInterval: () => 0, clearInterval() {}, setTimeout: () => 0, clearTimeout() {},
    fetch: async url => {
      const match = String(url).match(/^\/assets\/data\/domains\/(.+)\.json$/);
      const data = match && (typeof portals === 'function' ? portals(match[1]) : portals[match[1]]);
      return { ok: !!data, status: data ? 200 : 404, json: async () => clone(data || {}) };
    }
  };
  Object.assign(win, { localStorage: sandbox.localStorage, document: sandbox.document,
    fetch: sandbox.fetch, setInterval: sandbox.setInterval });
  const ctx = vm.createContext(sandbox);
  for (const file of ['domain-brain-base.js', 'finance-brain.js', 'portal-content-resolver.js']) {
    vm.runInContext(read('assets/js/domain-brains/' + file), ctx, { filename: file });
    // Prevent the browser singleton's automatic background cycle. Exercise the
    // real methods explicitly below, without a racing startup pipeline.
    if (file === 'domain-brain-base.js') win.LIMENDomainBrainBase.prototype.start = function () {};
  }
  return { win, brain: win.LIMENFinanceBrain, resolver: win.LIMENPortalContentResolver };
}
function portal(id, node = 'THAL', labels = ['Same action']) {
  return { domainId: id, activations: [{ brainNodeId: node,
    treatments: labels.map(label => ({ label, evidence: 'A', type: 'POLICY' })) }] };
}
function normalized(records) {
  return clone(records).map(t => ({ key: t.treatmentSourceKey || null, label: t.label,
    node: t.nodeId || null, portal: t.sourcePortal || null,
    diagnoses: (t.diagnosisIds || [t.diagnosisId]).slice().sort() }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
function rotateEight(brain, read = readSource) {
  brain._deepDigest = JSON.parse(read('assets/data/deep/finance-diagnosis-digest.json'));
  brain._deepDigestRotation = 0;
  brain._deepDigestBucketCursors = {};
  brain._activeConditions = Array.from({ length: 14 }, (_, i) => 'observed_' + i);
  for (let cycle = 1; cycle <= 8; cycle++) {
    brain.state.diagnoses = []; brain.state.treatments = [];
    brain._applyDeepDigest();
  }
  return clone(brain.state.treatments);
}
function historicalWindow(brain) {
  // Pin the *reported* window to its original scheduler and corpus. A scheduler
  // repair must not silently replace this identity regression with another set.
  const old = harness({}, readPinned).brain;
  const original = rotateEight(old, readPinned);
  const selected = new Set(old.state.diagnoses.map(d => d.id));
  const digest = JSON.parse(readSource('assets/data/deep/finance-diagnosis-digest.json'));
  brain._deepDigest = { diagnoses: digest.diagnoses.filter(d => selected.has(d.id)) };
  assert.equal(brain._deepDigest.diagnoses.length, 12);
  brain._activeConditions = Array.from({ length: 14 }, (_, i) => 'observed_' + i);
  brain.state.diagnoses = []; brain.state.treatments = [];
  brain._applyDeepDigest();
  const window = clone(brain.state.treatments);
  const occurrence = records => records.map(t => JSON.stringify([t.id, t.label, t.diagnosisId])).sort();
  assert.deepEqual(occurrence(window), occurrence(original), 'same 72 authored records as the pinned cycle eight');
  return window;
}
function wire(h, map) { Object.assign(h.resolver.getDiagnosisPortalMap(), map); }

(async () => {
  await test('pinned original cycle eight: 72 injected entities survive final merge in three input orders', async () => {
    const h = harness({ finance_f01_trigger: portal('finance_f01_trigger', 'THAL', ['F01 merge trigger']) });
    wire(h, { F01_TRIGGER: ['finance_f01_trigger'] });
    const window = historicalWindow(h.brain);
    assert.equal(window.length, 72, 'fixture must replay the real 12-diagnosis/72-treatment window');
    const label = 'Deploy Resource Planning Integrated Technology Platform';
    const collision = window.filter(t => t.label === label);
    assert.equal(collision.length, 2, 'must include the reported colliding pair');
    const dx = h.brain.state.diagnoses;
    assert.deepEqual(clone(dx.filter(d => collision.some(t => t.diagnosisId === d.id)).map(d => d.subportal).sort()),
      ['finance_compliance_mktcond_conflict_impl', 'finance_findata_credanlt_migrat_impl']);
    const expected = normalized(window);
    const orders = [window, window.slice().reverse(), window.filter((_, i) => i % 2).concat(window.filter((_, i) => !(i % 2)))];
    for (const ordered of orders) {
      h.brain.state.treatments = clone(ordered);
      h.brain.state.diagnoses = [{ id: 'F01_TRIGGER', active: true }];
      await h.brain.resolveDeepContent();
      const kept = h.brain.state.treatments.filter(t => t.source === 'deep-digest');
      console.log('  cycle8 injected=72 retained=' + kept.length + ' resolver=' + h.brain.state.resolvedContent.totalTreatments);
      assert.equal(kept.length, 72);
      assert.deepEqual(normalized(kept), expected, 'diagnosis/node/portal associations must not leak');
      const before = normalized(h.brain.state.treatments);
      await h.brain.resolveDeepContent();
      assert.deepEqual(normalized(h.brain.state.treatments), before, 'known resolver identity must be idempotent');
    }
    assert.ok(window.every(t => t.nodeId && t.sourcePortal && t.treatmentSourceKey), 'all 72 carry authored source coordinates');
    assert.equal(new Set(window.map(t => t.treatmentSourceKey)).size, 72);
  });

  if (BASELINE) {
    console.log('Original cycle-eight replay against ' + BASE_SHA + ': ' + passed + '/1 passed (failure expected).');
    process.exitCode = failed ? 1 : 0;
    return;
  }

  await test('current scheduler cycle eight also preserves all 72 identities and memberships', async () => {
    const h = harness({ finance_f01_trigger: portal('finance_f01_trigger', 'THAL', ['F01 merge trigger']) });
    wire(h, { F01_TRIGGER: ['finance_f01_trigger'] });
    const window = rotateEight(h.brain);
    assert.equal(window.length, 72);
    assert.equal(new Set(window.map(t => t.treatmentSourceKey)).size, 72);
    for (const ordered of [window, window.slice().reverse()]) {
      h.brain.state.diagnoses = [{ id: 'F01_TRIGGER', active: true }];
      h.brain.state.treatments = clone(ordered);
      await h.brain.resolveDeepContent();
      assert.deepEqual(normalized(h.brain.state.treatments.filter(t => t.source === 'deep-digest')), normalized(window));
    }
  });

  await test('real resolver separates portals and source records; unions only proven duplicate sources', async () => {
    const h = harness({ finance_f01_a: portal('finance_f01_a', 'THAL', ['Same action', 'Same action']),
      finance_f01_b: portal('finance_f01_b') });
    wire(h, { F01_A: ['finance_f01_a', 'finance_f01_b'], F01_B: ['finance_f01_a'] });
    const state = { domainId: 'finance', diagnoses: [{ id: 'F01_A', active: true }, { id: 'F01_B', active: true }] };
    const result = await h.resolver.resolveForBrain(state);
    assert.equal(result.totalTreatments, 3, 'two same-label entries in A and one in B are three entities');
    assert.equal(result.poolEntries, 5);
    assert.equal(result.poolUniqueIdentities, 3);
    assert.equal(result.poolDuplicates, 2);
    const records = Object.values(result.byDiagnosis).flatMap(p => p.treatments);
    assert.equal(new Set(records.map(t => t.treatmentSourceKey)).size, 3);
    assert.ok(records.filter(t => t.sourcePortal === 'finance_f01_a').every(t => t.diagnosisIds.join() === 'F01_A,F01_B'));
    assert.deepEqual(clone(records.find(t => t.sourcePortal === 'finance_f01_b').diagnosisIds), ['F01_A']);
    const again = await h.resolver.resolveForBrain({ ...state, diagnoses: state.diagnoses.slice().reverse() });
    assert.deepEqual(normalized(Object.values(again.byDiagnosis).flatMap(p => p.treatments)), normalized(records));
    h.brain.state = { ...state, treatments: [] };
    await h.brain.resolveDeepContent();
    assert.equal(h.brain.state.treatments.length, 3, 'final merge must not undo resolver separation');
    assert.equal(new Set(h.brain.state.treatments.map(t => t.id)).size, 3, 'runtime IDs retain distinct source identity');
    await h.brain.resolveDeepContent();
    assert.equal(h.brain.state.treatments.length, 3);
  });

  await test('unknown identities are not evidence of equivalence, even with the same label/node', async () => {
    for (const reverse of [false, true]) {
      const h = harness({ finance_f01_trigger: portal('finance_f01_trigger', 'THAL', ['F01 trigger']) });
      wire(h, { F01_TRIGGER: ['finance_f01_trigger'] });
      h.brain.state.diagnoses = [{ id: 'F01_TRIGGER', active: true }];
      const entries = [{ id: 'u1', label: 'Unknown action', diagnosisId: 'D1' },
        { id: 'u2', label: 'Unknown action', diagnosisId: 'D2' },
        { id: 'u3', label: 'Unknown action', nodeId: 'THAL', diagnosisId: 'D3' },
        { id: 'u4', label: 'Unknown action', nodeId: 'THAL', diagnosisId: 'D4' }];
      h.brain.state.treatments = reverse ? entries.slice().reverse() : entries;
      await h.brain.resolveDeepContent();
      assert.equal(h.brain.state.treatments.length, 5);
      assert.deepEqual(normalized(h.brain.state.treatments.filter(t => t.label === 'Unknown action')), normalized(entries));
    }
  });

  await test('missing node in real resolver remains distinct; fetched route supplies portal context', async () => {
    const h = harness({ finance_f01_unknown: portal('', '', ['Unknown action', 'Unknown action']) });
    wire(h, { F01_A: ['finance_f01_unknown'], F01_B: ['finance_f01_unknown'] });
    const result = await h.resolver.resolveForBrain({ domainId: 'finance',
      diagnoses: [{ id: 'F01_A', active: true }, { id: 'F01_B', active: true }] });
    // A fetched source path + activation/treatment index proves occurrence identity
    // even when the authored node is missing. Separate positions never collapse.
    assert.equal(result.totalTreatments, 2);
    const records = Object.values(result.byDiagnosis).flatMap(p => p.treatments);
    assert.ok(records.every(t => t.sourcePortal === 'finance_f01_unknown' && t.treatmentSourceKey));
  });

  await test('capped real-resolver selection is invariant to reordered pools and diagnoses', async () => {
    const h = harness({ finance_f01_a: portal('finance_f01_a', 'THAL', ['Same action', 'Same action']),
      finance_f01_b: portal('finance_f01_b', 'THAL', ['Same action', 'Same action']) });
    wire(h, { F01_A: ['finance_f01_a', 'finance_f01_b'], F01_B: ['finance_f01_a', 'finance_f01_b'] });
    const state = { domainId: 'finance', diagnoses: [{ id: 'F01_A', active: true }, { id: 'F01_B', active: true }] };
    const first = await h.resolver.resolveForBrain(state, { maxTreatments: 1 });
    const a = await h.resolver.resolveForDiagnosis('F01_A');
    const b = await h.resolver.resolveForDiagnosis('F01_B');
    a.reverse(); b.reverse(); // Simulate reordered inputs, retaining source identities.
    const second = await h.resolver.resolveForBrain({ ...state, diagnoses: state.diagnoses.slice().reverse() }, { maxTreatments: 1 });
    const selected = r => Object.fromEntries(Object.entries(r.byDiagnosis).map(([dx, p]) => [dx, normalized(p.treatments)]));
    assert.deepEqual(selected(second), selected(first));
    assert.equal(second.totalTreatments, 2);
    assert.equal(second.poolUniqueIdentities, 4);
    assert.equal(second.poolDuplicates, 4);
  });

  await test('builder, digest injection, root and resolver agree on authored occurrence identities', async () => {
    const { buildDigest } = await import(pathToFileURL(path.join(ROOT, 'scripts/build-diagnosis-digest.mjs')));
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'limen-f01-'));
    try {
      const source = portal('finance_f01_authored', 'THAL', ['Same action', 'Same action', 'Other action']);
      source.activations[0].treatments[0].evidence = 'C';
      source.activations.push({ brainNodeId: 'THAL', treatments: [{ label: 'Same action', evidence: 'A' }] });
      source.issues = [{ id: 'F01_DX', label: 'Fixture', circuits: [{ nodeId: 'THAL' }] }];
      fs.writeFileSync(path.join(temp, 'finance_f01_authored.json'), JSON.stringify(source));
      const digest = buildDigest('finance', temp);
      const tx = digest.diagnoses[0].tx;
      assert.equal(tx.length, 4);
      assert.equal(new Set(tx.map(t => t.k)).size, 4, 'same-label entries and repeated node activations stay distinct');
      assert.deepEqual(JSON.parse(tx[0].k), ['finance_f01_authored', 'THAL', 0, 1], 'source index precedes evidence ranking');
      assert.deepEqual(JSON.parse(tx[3].k), ['finance_f01_authored', 'THAL', 0, 0]);
      const h = harness({ finance_f01_authored: source, finance: source });
      wire(h, { F01_DX: ['finance_f01_authored'], F01_COPY: ['finance_f01_authored'], F01_ROOT: ['finance'] });
      h.brain._deepDigest = digest;
      h.brain._activeConditions = ['fixture_observation'];
      h.brain.state.diagnoses = []; h.brain.state.treatments = [];
      h.brain._applyDeepDigest();
      h.brain.state.diagnoses.push({ id: 'F01_COPY', active: true });
      const injected = clone(h.brain.state.treatments);
      await h.brain.resolveDeepContent();
      assert.equal(h.brain.state.treatments.length, 4, 'four digest records merge with their four real resolver copies');
      assert.equal(new Set(h.brain.state.treatments.map(t => t.treatmentSourceKey)).size, 4);
      assert.ok(h.brain.state.treatments.every(t => t.diagnosisIds.join() === 'F01_COPY,F01_DX'));
      const forward = normalized(h.brain.state.treatments);
      h.brain.state.treatments = injected.reverse();
      h.brain.state.diagnoses.reverse();
      (await h.resolver.resolveForDiagnosis('F01_DX')).reverse();
      (await h.resolver.resolveForDiagnosis('F01_COPY')).reverse();
      await h.brain.resolveDeepContent();
      assert.deepEqual(normalized(h.brain.state.treatments), forward, 'reordered digest/resolver copies');
      await h.brain.resolveDeepContent();
      assert.deepEqual(normalized(h.brain.state.treatments), forward, 'repeat builder/resolver integration');
      h.brain.state.diagnoses = [{ id: 'F01_ROOT', active: true, circuits: [{ nodeId: 'THAL' }] }];
      h.brain._getPortalContent = async () => source;
      await h.brain.recommendTreatments();
      assert.equal(new Set(h.brain.state.treatments.map(t => t.id)).size, 4);
      await h.brain.resolveDeepContent();
      assert.equal(h.brain.state.treatments.length, 4, 'root and resolver use the fetched finance route, not payload domainId');
      assert.ok(h.brain.state.treatments.every(t => t.sourcePortal === 'finance'));

      for (const domain of ['p2_agri', 'communication', 'culture', 'defense', 'economy', 'education',
        'energy', 'environment', 'governance', 'industry', 'infrastructure', 'intelligence',
        'law', 'medicine', 'population', 'religion', 'science', 'technology', 'trade']) {
        const slug = domain + '_f01';
        fs.writeFileSync(path.join(temp, slug + '.json'), JSON.stringify({ ...source, domainId: slug }));
        const other = buildDigest(domain, temp);
        assert.deepEqual(other.diagnoses[0].tx, [
          { l: 'Same action', t: 'POLICY', e: 'A', syn: 2 },
          { l: 'Other action', t: 'POLICY', e: 'A', syn: 2 }
        ], domain + ' retains its two-record cap, ranking, provenance and field shape');
        const base = new h.win.LIMENDomainBrainBase({ domainId: domain, groundedOnly: true });
        base._deepDigest = other; base._activeConditions = ['fixture_observation'];
        base._applyDeepDigest();
        assert.equal(base.state.treatments.length, 2);
        assert.ok(base.state.treatments.every(t => !('treatmentSourceKey' in t) && !('nodeId' in t) && !('sourcePortal' in t)));
      }
    } finally {
      // Only this test's newly created, resolved temporary directory is removed.
      assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()));
      assert.ok(path.basename(temp).startsWith('limen-f01-'));
      fs.rmSync(temp, { recursive: true, force: true });
    }
  });

  await test('positive keys with contradictory node/portal context do not merge', async () => {
    const h = harness({ finance_f01_trigger: portal('finance_f01_trigger', 'THAL', ['Trigger']) });
    wire(h, { F01_TRIGGER: ['finance_f01_trigger'] });
    h.brain.state.diagnoses = [{ id: 'F01_TRIGGER', active: true }];
    h.brain.state.treatments = [
      { id: 'c1', label: 'Conflict', treatmentSourceKey: 'same-key', sourcePortal: 'finance_a', nodeId: 'THAL', diagnosisId: 'D1' },
      { id: 'c2', label: 'Conflict', treatmentSourceKey: 'same-key', sourcePortal: 'finance_b', nodeId: 'THAL', diagnosisId: 'D2' },
      { id: 'c3', label: 'Conflict', treatmentSourceKey: 'same-key', sourcePortal: 'finance_a', nodeId: 'HYPO', diagnosisId: 'D3' }
    ];
    await h.brain.resolveDeepContent();
    assert.equal(h.brain.state.treatments.length, 4);
  });

  await test('shared resolver treatments reach every Finance member packet once, including steps', async () => {
    const source = portal('finance_f01_shared');
    source.activations[0].treatments[0].steps = ['Shared authored implementation step'];
    const h = harness({ finance_f01_shared: source });
    wire(h, { F01_A: ['finance_f01_shared'], F01_B: ['finance_f01_shared'] });
    for (const order of [['F01_A', 'F01_B', 'F01_C'], ['F01_C', 'F01_B', 'F01_A'], ['F01_B', 'F01_C', 'F01_A']]) {
      h.brain.state.diagnoses = order.map(id => ({ id, active: true }));
      await h.brain.resolveDeepContent();
      assert.equal(h.brain.state.treatments.length, 1, 'one entity globally, not one copy per membership');
      const before = clone(h.brain.state.treatments);
      assert.deepEqual(before[0].diagnosisIds, ['F01_A', 'F01_B']);
      h.brain._updateFinanceModel();
      const packets = h.brain.state.financeDomainDiagnosisPackets;
      assert.equal(packets.length, 3);
      for (const id of ['F01_A', 'F01_B']) {
        const packet = packets.find(p => p.identity.diagnosisId === id);
        assert.equal(packet.treatmentContext.treatments.length, 1, id + ' must retain the shared treatment');
        assert.deepEqual(normalized(packet.treatmentContext.treatments), normalized(before));
        assert.deepEqual(clone(packet.treatmentContext.implementationSteps), source.activations[0].treatments[0].steps);
      }
      const unrelated = packets.find(p => p.identity.diagnosisId === 'F01_C');
      assert.deepEqual(clone(unrelated.treatmentContext.treatments), []);
      assert.deepEqual(clone(unrelated.treatmentContext.implementationSteps), []);
      const primary = h.brain.state.financeModel.domainDiagnosisPacket;
      assert.equal(primary.identity.diagnosisId, order[0]);
      assert.deepEqual(normalized(primary.treatmentContext.treatments), order[0] === 'F01_C' ? [] : normalized(before));
      assert.deepEqual(clone(h.brain.state.treatments), before, 'packet building must not mutate source entities');
    }
  });

  await test('Finance packet membership preserves legacy hosts and aggregate behavior without duplicates', async () => {
    const h = harness();
    const records = [
      { id: 'legacy', diagnosisId: 'F01_A', steps: ['Legacy step'] },
      { id: 'empty-members', diagnosisId: 'F01_A', diagnosisIds: [], steps: ['Empty-list legacy step'] },
      { id: 'shared', diagnosisId: 'F01_A', diagnosisIds: ['F01_A', 'F01_B', 'F01_B'], steps: ['Shared step'] },
      { id: 'member-only', diagnosisIds: ['F01_B'], steps: ['Membership-only step'] },
      { id: 'not-an-array', diagnosisId: 'F01_C', diagnosisIds: 'F01_B', steps: ['Unrelated step'] },
      { id: 'unassigned', steps: ['Unassigned step'] }
    ];
    h.brain.state.treatments = clone(records);
    function packet(id) { return h.brain._buildDomainDiagnosisPacket(id ? { id } : null).treatmentContext; }
    assert.deepEqual(clone(packet('F01_A').treatments.map(t => t.id)), ['legacy', 'empty-members', 'shared']);
    assert.deepEqual(clone(packet('F01_B').treatments.map(t => t.id)), ['shared', 'member-only']);
    assert.deepEqual(clone(packet('F01_B').implementationSteps), ['Shared step', 'Membership-only step']);
    assert.deepEqual(clone(packet('F01_C').treatments.map(t => t.id)), ['not-an-array']);
    assert.deepEqual(clone(packet('F01_UNRELATED').treatments), []);
    assert.deepEqual(clone(packet(null).treatments), records);
    assert.deepEqual(clone(packet(null).implementationSteps), records.flatMap(t => t.steps));
    assert.deepEqual(clone(h.brain.state.treatments), records);
  });

  await test('committed Finance corpus conserves shared memberships through model packet production', async () => {
    const h = harness(slug => {
      if (!/^finance(?:_[A-Za-z0-9_]+)?$/.test(slug)) return null;
      const file = path.join(ROOT, 'assets/data/domains', slug + '.json');
      return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
    });
    const finance = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/domains/finance.json'), 'utf8'));
    const ids = finance.issues.map(d => d.id);
    h.brain.state.diagnoses = ids.map(id => ({ id, active: true }));
    await h.brain.resolveDeepContent();
    const before = clone(h.brain.state.treatments);
    assert.ok(before.some(t => t.diagnosisIds.length > 1 && t.steps.length > 0), 'real corpus must exercise shared steps');
    let nonHostMemberships = 0;
    h.brain._updateFinanceModel();
    assert.equal(h.brain.state.financeDomainDiagnosisPackets.length, ids.length);
    for (const packet of h.brain.state.financeDomainDiagnosisPackets) {
      const dxId = packet.identity.diagnosisId;
      const expected = before.filter(t => t.diagnosisIds.includes(dxId));
      nonHostMemberships += expected.filter(t => t.diagnosisId !== dxId).length;
      assert.equal(packet.treatmentContext.treatments.length, expected.length, dxId + ' packet count');
      assert.deepEqual(normalized(packet.treatmentContext.treatments), normalized(expected), dxId + ' membership conservation');
      assert.deepEqual(clone(packet.treatmentContext.implementationSteps), expected.flatMap(t => t.steps || []));
      assert.equal(new Set(packet.treatmentContext.treatments.map(t => t.treatmentSourceKey)).size, expected.length);
    }
    assert.ok(nonHostMemberships > 0);
    console.log('  corpus global entities=' + before.length + '; non-host packet memberships=' + nonHostMemberships);
    assert.deepEqual(clone(h.brain.state.treatments), before);
  });

  await test('non-Finance resolver retains its existing label/node behavior and shape', async () => {
    const h = harness({ energy_f01_a: portal('energy_f01_a'), energy_f01_b: portal('energy_f01_b') });
    wire(h, { F01_E: ['energy_f01_a', 'energy_f01_b'] });
    const result = await h.resolver.resolveForBrain({ domainId: 'energy', diagnoses: [{ id: 'F01_E', active: true }] });
    assert.equal(result.totalTreatments, 1);
    assert.ok(!('treatmentSourceKey' in result.byDiagnosis.F01_E.treatments[0]));
    assert.ok(!('sourcePortal' in result.byDiagnosis.F01_E.treatments[0]));
  });
  console.log(`${passed}/${passed + failed} identity tests passed`);
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
