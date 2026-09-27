// Finance-only stable-bucket regression. No live services or application writes.
// --baseline replays the pre-repair implementation (expected failure).
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const BEFORE = 'cbf9b4c299e18711886d4c93432aeb1861b32813';
const FILE = 'assets/js/domain-brains/domain-brain-base.js';
const oldSource = execFileSync('git', ['show', BEFORE + ':' + FILE], { cwd: ROOT, encoding: 'utf8', maxBuffer: 8e6 });
const source = process.argv.includes('--baseline') ? oldSource : fs.readFileSync(path.join(ROOT, FILE), 'utf8');
const digest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/deep/finance-diagnosis-digest.json')));
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
test('all19 non-Finance domains retain pre-fix schedules, treatment shapes and cursors', () => {
  for (const domain of ['p2_agri', 'communication', 'culture', 'defense', 'economy', 'education',
    'energy', 'environment', 'governance', 'industry', 'infrastructure', 'intelligence',
    'law', 'medicine', 'population', 'religion', 'science', 'technology', 'trade']) {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/deep/' + domain + '-diagnosis-digest.json')));
    for (const cap of [3, 12]) {
      const current = brain(data, cap, domain), previous = brain(data, cap, domain, oldSource);
      for (let cycle = 0; cycle < 20; cycle++) {
        assert.deepEqual(pick(current), pick(previous), domain + ' schedule');
        assert.equal(JSON.stringify(current.state.treatments), JSON.stringify(previous.state.treatments), domain + ' treatments');
        assert.equal(JSON.stringify(current._deepDigestBucketCursors), JSON.stringify(previous._deepDigestBucketCursors), domain + ' cursors');
      }
    }
  }
});
console.log(passed + '/' + (passed + failed) + ' Finance rotation groups passed');
process.exitCode = failed ? 1 : 0;
