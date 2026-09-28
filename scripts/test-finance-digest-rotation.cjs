// Stable-bucket regression for Finance and all19 other domains. No live services.
// --baseline replays the Finance-only repair (fleet tests expected to fail).
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const BEFORE = 'c255e4cdfb769ba67bf94651e7db992ee9ce8182';
const FILE = 'assets/js/domain-brains/domain-brain-base.js';
const oldSource = execFileSync('git', ['show', BEFORE + ':' + FILE], { cwd: ROOT, encoding: 'utf8', maxBuffer: 8e6 });
const source = process.argv.includes('--baseline') ? oldSource : fs.readFileSync(path.join(ROOT, FILE), 'utf8');
const digest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/deep/finance-diagnosis-digest.json')));
const DOMAINS = ['finance', 'p2_agri', 'communication', 'culture', 'defense', 'economy', 'education',
  'energy', 'environment', 'governance', 'industry', 'infrastructure', 'intelligence',
  'law', 'medicine', 'population', 'religion', 'science', 'technology', 'trade'];
const corpus = Object.fromEntries(DOMAINS.map(domain => [domain,
  JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/deep/' + domain + '-diagnosis-digest.json')))]));
let passed = 0, failed = 0;
function test(name, run) {
  try { run(); passed++; console.log('PASS ' + name); }
  catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message); }
}
function brain(data = digest, cap = 12, domain = 'finance', code = source) {
  const ctx = { window: {}, console: { log() {}, warn() {}, error() {} },
    fetch: async () => ({ ok: false }), setInterval: () => 0, clearInterval() {} };
  vm.runInNewContext(code, ctx);
  const b = Object.create(ctx.window.LIMENDomainBrainBase.prototype);
  Object.assign(b, { domainId: domain, groundedOnly: true, _deepDigest: data,
    _activeConditions: Array.from({ length: cap }, (_, i) => 'evidence_' + i),
    state: { stress: 0.5, diagnoses: [], treatments: [] } });
  return b;
}
function pick(b, existing = []) {
  b.state.diagnoses = JSON.parse(JSON.stringify(existing)); b.state.treatments = [];
  b._applyDeepDigest();
  return JSON.parse(JSON.stringify(b.state.diagnoses.filter(d => d.source === 'deep-digest')));
}
function schedule(b, n) { return Array.from({ length: n }, () => pick(b)); }
function ids(list) { return list.map(d => d.id); }
function tiny(sizes) {
  return { diagnoses: sizes.flatMap((n, di) => Array.from({ length: n }, (_, i) => ({
    id: 'L' + (di + 2) + '_' + i, depth: di + 2, label: 'Fixture', circuits: ['THAL'], tx: []
  }))) };
}
// Independent oracle: circular queues, never a numeric cursor into a spliced
// array. Each diagnosis can be drawn only once within a cycle.
function reference(data, cap, cycles) {
  const queues = {};
  data.diagnoses.forEach(d => (queues[d.depth] ||= []).push(d.id));
  const depths = Object.keys(queues).sort();
  return Array.from({ length: cycles }, (_, cycle) => {
    const selected = [], used = new Set();
    let progressed = true;
    while (selected.length < cap && progressed) {
      progressed = false;
      for (let k = 0; k < depths.length && selected.length < cap; k++) {
        const q = queues[depths[(cycle + k) % depths.length]];
        if (!q.length || used.has(q[0])) continue;
        const id = q.shift(); q.push(id); used.add(id); selected.push(id); progressed = true;
      }
    }
    return selected;
  });
}

// Independent coverage bound from depth slot allocation, without selecting IDs
// or using production cursors. Current corpus buckets can each supply their
// full within-cycle allocation. Across one depth-rotation period every depth
// receives exactly cap slots, giving a finite conservative search ceiling.
function coverageBound(data, cap) {
  const sizes = {};
  data.diagnoses.forEach(d => sizes[d.depth] = (sizes[d.depth] || 0) + 1);
  const depths = Object.keys(sizes).sort(), n = depths.length;
  assert.ok(Math.ceil(cap / n) <= Math.min(...Object.values(sizes)), 'bound precondition: no within-cycle exhaustion');
  const allocations = Array(n).fill(0);
  const ceiling = n * Math.ceil(Math.max(...Object.values(sizes)) / cap);
  for (let cycle = 0; cycle < ceiling; cycle++) {
    for (let slot = 0; slot < cap; slot++) allocations[(cycle + slot) % n]++;
    if (depths.every((depth, i) => allocations[i] >= sizes[depth])) return cycle + 1;
  }
  assert.fail('depth allocation exceeded its calculated bound');
}
function assertDepthOrder(data, windows, domain) {
  for (const depth of new Set(data.diagnoses.map(d => d.depth))) {
    const expected = ids(data.diagnoses.filter(d => d.depth === depth));
    const actual = ids(windows.flat().filter(d => d.depth === depth));
    actual.forEach((id, i) => assert.equal(id, expected[i % expected.length], domain + ' depth ' + depth + ' occurrence ' + i));
  }
}

test('actual cap12: no cycle2 repeats; complete coverage at the depth-balanced bound', () => {
  // Five balanced depths draw 48 times each in20 cycles. L3 has50 entries;
  // completing it takes cycle21, without changing the depth allocation policy.
  const windows = schedule(brain(), 21), first = new Set(ids(windows[0]));
  const repeated = ids(windows[1]).filter(id => first.has(id));
  const distinct = new Set(windows.flatMap(ids));
  const at20 = new Set(windows.slice(0, 20).flatMap(ids)).size;
  console.log('  cycle2 repeats=' + repeated.length + '; coverage20=' + at20 + '; coverage21=' + distinct.size + '/' + digest.diagnoses.length);
  assert.equal(repeated.length, 0, 'no source bucket exhausted in the first two windows');
  assert.equal(at20, 178);
  assert.equal(distinct.size, digest.diagnoses.length);
  assert.ok(windows.every(w => w.length === 12 && new Set(ids(w)).size === 12));
});
test('every depth follows its stable source order before wrapping', () => {
  const windows = schedule(brain(), 40);
  for (const dep of new Set(digest.diagnoses.map(d => d.depth))) {
    const expected = ids(digest.diagnoses.filter(d => d.depth === dep));
    const actual = ids(windows.flat().filter(d => d.depth === dep));
    actual.forEach((id, i) => assert.equal(id, expected[i % expected.length], 'depth ' + dep + ' occurrence ' + i));
  }
});
test('cap1..12 schedules match independent queue oracle and fresh instances', () => {
  for (let cap = 1; cap <= 12; cap++) {
    const a = schedule(brain(digest, cap), 30).map(ids);
    assert.deepEqual(a, reference(digest, cap, 30), 'cap ' + cap);
    assert.deepEqual(schedule(brain(digest, cap), 30).map(ids), a);
  }
});
test('small and uneven buckets fill available slots without repeating within a cycle', () => {
  for (const sizes of [[], [1], [1, 2], [2, 3, 4], [13], [1, 17, 2, 9]]) {
    const data = tiny(sizes);
    for (const cap of [1, 3, 12]) {
      const actual = schedule(brain(data, cap), 25).map(ids);
      assert.deepEqual(actual, reference(data, cap, 25), JSON.stringify({ sizes, cap }));
      assert.ok(actual.every(w => w.length === Math.min(cap, data.diagnoses.length) && new Set(w).size === w.length));
    }
  }
});
test('existing root diagnoses are excluded and evidence gates remain intact', () => {
  const data = tiny([5, 8]);
  const excluded = [{ id: data.diagnoses[0].id, active: true }];
  const b = brain(data);
  for (let i = 0; i < 5; i++) {
    const window = pick(b, excluded);
    assert.equal(window.length, 12);
    assert.ok(window.every(d => d.id !== excluded[0].id));
    assert.equal(new Set(ids(window)).size, 12);
  }
  b._activeConditions = ['_stress_only'];
  assert.deepEqual(pick(b), []);
});
for (const domain of DOMAINS) {
  test(domain + ': exact180-ID coverage at independently calculated cap12 bound', () => {
    const data = corpus[domain], bound = coverageBound(data, 12);
    const expected = ids(data.diagnoses).sort();
    assert.equal(expected.length, 180);
    assert.equal(new Set(expected).size, 180);
    const windows = schedule(brain(data, 12, domain), Math.max(20, bound));
    const atBound = Array.from(new Set(windows.slice(0, bound).flatMap(ids))).sort();
    const at20 = new Set(windows.slice(0, 20).flatMap(ids)).size;
    const repeat2 = ids(windows[1]).filter(id => ids(windows[0]).includes(id)).length;
    console.log('  ' + domain + ': cycle2 repeats=' + repeat2 + ', coverage20=' + at20 + '/180, bound=' + bound + ', coverageAtBound=' + atBound.length + '/180');
    assert.equal(atBound.length, expected.length, domain + ' must cover its full set by cycle ' + bound);
    assert.deepEqual(atBound, expected, domain + ' exact set, not just count');
    assert.ok(new Set(windows.slice(0, bound - 1).flatMap(ids)).size < 180, 'calculated first complete cycle');
    assert.ok(windows.every(w => w.length === 12 && new Set(ids(w)).size === 12));
    assertDepthOrder(data, windows, domain);
  });
}
test('all20 domains: caps1..12 preserve circular order and match independent queues', () => {
  for (const domain of DOMAINS) {
    const data = corpus[domain];
    for (let cap = 1; cap <= 12; cap++) {
      const bound = coverageBound(data, cap);
      const windows = schedule(brain(data, cap, domain), bound + 5);
      assert.deepEqual(windows.map(ids), reference(data, cap, bound + 5), domain + ' cap ' + cap);
      assert.deepEqual(schedule(brain(data, cap, domain), bound + 5).map(ids), windows.map(ids), 'fresh-instance determinism');
      assert.deepEqual(Array.from(new Set(windows.slice(0, bound).flatMap(ids))).sort(), ids(data.diagnoses).sort());
      assert.ok(windows.every(w => w.length === cap && new Set(ids(w)).size === cap));
      assertDepthOrder(data, windows, domain);
    }
  }
});
test('all20 domains: existing grounded and stress-driven gates/caps are unchanged', () => {
  for (const domain of DOMAINS) {
    const data = corpus[domain];
    for (const stress of [0, 0.29, 0.30, 0.5, 1]) {
      const current = brain(data, 12, domain), previous = brain(data, 12, domain, oldSource);
      current.groundedOnly = previous.groundedOnly = false;
      current.state.stress = previous.state.stress = stress;
      const expectedCap = stress < 0.30 ? 0 : Math.min(12, Math.round(stress * 12));
      const actual = schedule(current, 30), old = schedule(previous, 30);
      assert.ok(actual.every((w, i) => w.length === expectedCap && w.length === old[i].length));
      if (expectedCap) assert.deepEqual(actual.map(ids), reference(data, expectedCap, 30));
    }
    for (const conditions of [[], ['_stress_only'], ['evidence', '_flag'], Array(20).fill('evidence')]) {
      const current = brain(data, 12, domain), previous = brain(data, 12, domain, oldSource);
      current._activeConditions = previous._activeConditions = conditions;
      assert.equal(pick(current).length, pick(previous).length, domain + ' evidence gate/cap');
    }
  }
});
test('all20 domains: treatment fields and cognition unchanged except additive source coordinates', () => {
  for (const domain of DOMAINS) {
    const current = brain(corpus[domain], 12, domain), previous = brain(corpus[domain], 12, domain, oldSource);
    const cognition = { marker: domain };
    current.state.cognition = previous.state.cognition = cognition;
    for (const diagnosis of corpus[domain].diagnoses) {
      // Compare the same selected diagnosis; expected scheduling changes must
      // not hide changes to its injected fields, treatments or domain identity.
      current._deepDigest = previous._deepDigest = { diagnoses: [diagnosis] };
      assert.deepEqual(pick(current), pick(previous), domain + ' injected diagnosis');
      const comparable = JSON.parse(JSON.stringify(current.state.treatments));
      if (domain !== 'finance') comparable.forEach((t, i) => {
        assert.equal(t.nodeId, diagnosis.tx[i].n || null);
        assert.equal(t.sourcePortal, diagnosis.tx[i].p || null);
        assert.equal(t.treatmentSourceKey, diagnosis.tx[i].k || null);
        delete t.nodeId; delete t.sourcePortal; delete t.treatmentSourceKey;
      });
      assert.equal(JSON.stringify(comparable), JSON.stringify(previous.state.treatments), domain + ' other treatment fields');
      assert.equal(current.state.cognition, cognition);
    }
  }
});
test('Finance already-fixed schedules and cursors are preserved', () => {
  for (const cap of [1, 3, 12]) {
    const current = brain(digest, cap), previous = brain(digest, cap, 'finance', oldSource);
    for (let cycle = 0; cycle < 40; cycle++) {
      assert.deepEqual(pick(current), pick(previous));
      assert.equal(JSON.stringify(current.state.treatments), JSON.stringify(previous.state.treatments));
      assert.equal(JSON.stringify(current._deepDigestBucketCursors), JSON.stringify(previous._deepDigestBucketCursors));
    }
  }
});
console.log(passed + '/' + (passed + failed) + ' fleet rotation groups passed');
process.exitCode = failed ? 1 : 0;
