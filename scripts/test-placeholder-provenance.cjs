'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..'), BEFORE = '141bd5748afcd5f3590debf7ade69e1c0d2b2ea3';
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const pinned = file => JSON.parse(execFileSync('git', ['show', BEFORE + ':' + file], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16e6 }));
const clone = x => JSON.parse(JSON.stringify(x));
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message.slice(0, 500)); } }
const valid = { label: 'Named intervention', cite: 'Author (2024), measured field study, doi:10.1000/field', steps: ['Measure soil water weekly at the specified sites.'] };
const cases = [
  ['concrete citation and steps', {}, 0], ['scaffold remains scaffold', { label: 'Deploy Assessment Protocol' }, 1],
  ['reported citation marker', { cite: '[CITATION NEEDED: missing source]' }, 2],
  ['case and separator variant', { cite: '[citation_needed: missing source]' }, 2],
  ['embedded missing reference', { cite: 'Unverified notes; reference pending' }, 2],
  ['citation TODO', { cite: 'TODO: add a citation' }, 2],
  ['whitespace citation', { cite: '      ' }, 2], ['object is not a citation', { cite: { text: 'source' } }, 2],
  ['empty steps', { steps: [] }, 2], ['blank step', { steps: ['   '] }, 2],
  ['step placeholder', { steps: ['[IMPLEMENTATION NEEDED]'] }, 2], ['step TBD', { steps: ['TBD'] }, 2],
  ['mixed complete and placeholder steps', { steps: [valid.steps[0], 'TODO: implement'] }, 2],
  ['nontext step', { steps: [null] }, 2], ['no citation', { cite: null }, 2]
];
function browser() {
  const window = { location: { pathname: '/domain-console', search: '?domain=finance' }, addEventListener() {}, dispatchEvent() {},
    LIMENDomainBrains: { register() {} }, LIMENDomainIsolator: { isDomainScoped: () => true, getActiveDomain: () => 'finance', getResolvedKey: () => 'finance', getDomainLabel: () => 'Finance' } };
  const document = { readyState: 'complete', addEventListener() {}, head: { appendChild() {} },
    createElement: () => ({ style: {}, appendChild() {} }), createTextNode: s => s,
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
  const localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
  const sandbox = { window, document, localStorage, fetch, URLSearchParams, console: { log() {}, warn() {}, error() {} },
    setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {}, requestAnimationFrame() {} };
  Object.assign(window, { document, localStorage, fetch, requestAnimationFrame() {} });
  const ctx = vm.createContext(sandbox);
  for (const file of ['domain-brain-base.js', 'finance-brain.js', 'domain-console-brain.js']) {
    vm.runInContext(read('assets/js/domain-brains/' + file), ctx);
    if (file === 'domain-brain-base.js') window.LIMENDomainBrainBase.prototype.start = function () {};
  }
  return { window, brain: window.LIMENFinanceBrain, classify: window.LIMENDomainConsoleBrain.classifyProvenance };
}
(async () => {
  const { buildDigest } = await import('./build-diagnosis-digest.mjs');
  for (const pk of Object.keys(require('./data/full-tree-inventory.json').domains)) await test(pk + ': builder rejects empty/placeholder evidence without dropping context', () => {
    const dir = path.resolve(__dirname, '__provenance__', pk), docs = {};
    cases.forEach(([name, change], i) => { docs[pk + '_case' + i + '.json'] = { issues: [{ id: 'DX' + i, circuits: [{ nodeId: 'THAL' }] }],
      activations: [{ brainNodeId: 'THAL', treatments: [{ ...valid, ...change }] }] }; });
    const rd = fs.readdirSync, rf = fs.readFileSync;
    let digest;
    try {
      fs.readdirSync = p => { assert.equal(p, dir); return Object.keys(docs); };
      fs.readFileSync = (p, ...args) => path.dirname(p) === dir ? JSON.stringify(docs[path.basename(p)]) : rf(p, ...args);
      digest = buildDigest(pk, dir);
    } finally { fs.readdirSync = rd; fs.readFileSync = rf; }
    assert.equal(digest.diagnoses.length, cases.length);
    cases.forEach(([name, change, syn], i) => {
      const t = digest.diagnoses.find(d => d.id === 'DX' + i).tx[0];
      assert.equal(t.syn, syn, name); assert.equal(t.k, JSON.stringify([pk + '_case' + i, 'THAL', 0, 0]));
      if (name === 'reported citation marker') { assert.equal(t.c, change.cite); assert.deepEqual(t.st, valid.steps); }
    });
  });
  for (const [name, change, syn] of cases) await test('runtime producer/consumer: ' + name, async () => {
    const h = browser(), b = h.brain, t = { ...valid, ...change }, snapshot = clone(t);
    b.state.diagnoses = [{ id: 'DX', active: true, circuits: [{ nodeId: 'THAL' }] }];
    b._getPortalContent = async () => ({ activations: [{ brainNodeId: 'THAL', treatments: [t] }] });
    await b.recommendTreatments();
    const expected = syn === 0 ? false : syn === 1 ? true : undefined;
    assert.equal(b.state.treatments[0].synthetic, expected, 'root verdict');
    b.state.treatments = [];
    h.window.LIMENPortalContentResolver = { resolveForBrain: async () => ({ byDiagnosis: { DX: { treatments: [{ ...t,
      nodeId: 'THAL', sourcePortal: 'finance_case', treatmentSourceKey: '["finance_case","THAL",0,0]', hasDepth: true }] } } }) };
    await b.resolveDeepContent();
    assert.equal(b.state.treatments[0].synthetic, expected, 'resolver verdict');
    assert.equal(h.classify(b.state.treatments[0]), syn, 'tagged resolver classification');
    assert.equal(h.classify({ ...t, hasDepth: true }), syn, 'untagged depth cannot override missing evidence');
    if (syn === 2) assert.equal(h.classify({ ...t, synthetic: false, hasDepth: true }), 2, 'contradictory supplied evidence defeats a stale flag');
    assert.deepEqual(t, snapshot, 'source is not rewritten');
  });
  await test('hasDepth alone is not provenance; bare legacy affirmative flag remains compatible', () => {
    const h = browser();
    assert.equal(h.classify({ label: valid.label, hasDepth: true }), 2);
    assert.equal(h.classify({ label: valid.label, synthetic: false }), 0);
  });
  const file = 'assets/data/deep/p2_agri-diagnosis-digest.json', before = pinned(file), expected = clone(before);
  const affected = new Set(); let count = 0;
  for (const d of expected.diagnoses) for (const t of d.tx) if (t.syn === 0 && /^\[CITATION NEEDED:/.test(t.c || '')) {
    t.syn = 2; count++; affected.add(JSON.stringify([d.id, t.l]));
  }
  expected.unknownTreatments += count;
  await test('actual11 Agriculture incidences demoted; every other field/identity/order is unchanged', () => {
    assert.equal(count, 11); assert.deepEqual(JSON.parse(read(file)), expected);
  });
  await test('all11 runtime digest records stay unknown even after structural depth enrichment', () => {
    const h = browser(), current = JSON.parse(read(file));
    for (const d of current.diagnoses) {
      h.brain._deepDigest = { diagnoses: [d] }; h.brain._activeConditions = ['observed'];
      h.brain.state.diagnoses = []; h.brain.state.treatments = []; h.brain.state.stress = 0.5;
      h.brain._applyDeepDigest();
      for (const t of h.brain.state.treatments) if (affected.has(JSON.stringify([d.id, t.label]))) {
        assert.equal(t.synthetic, undefined); assert.equal(h.classify({ ...t, hasDepth: true }), 2);
      }
    }
  });
  await test('index changes only the same11 flags and provenance totals', () => {
    const p = 'assets/data/opportunities-index.json', wanted = pinned(p); let edits = 0;
    for (const o of wanted.opportunities) if (o.d === 'p2_agri') for (const t of o.tx) if (affected.has(JSON.stringify([o.id, t.l]))) { assert.equal(t.s, 0); t.s = 2; edits++; }
    assert.equal(edits, 11);
    for (const totals of [wanted.provenance, wanted.perDomain.p2_agri.provenance]) { totals.verifiedEligible -= edits; totals.unknown += edits; }
    assert.deepEqual(JSON.parse(read(p)), wanted);
    assert.equal(wanted.provenance.verifiedEligible, 190); assert.equal(wanted.provenance.unknown, 12);
  });
  console.log(passed + '/' + (passed + failed) + ' placeholder provenance checks passed');
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
