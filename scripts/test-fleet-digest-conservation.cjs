// F-10/F-11: offline root resolver + rotated digest -> adapter -> packets.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const ROOT = path.resolve(__dirname, '..');
const DOMAINS = ('agriculture communication culture defense economy education energy environment finance governance industry infrastructure intelligence law medicine population religion science technology trade').split(' ');
const clone = x => JSON.parse(JSON.stringify(x));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const registry = JSON.parse(read('assets/data/canonical-nodes.json')).nodes;
const pkOf = d => d === 'agriculture' ? 'p2_agri' : d;
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message.split('\n')[0]); } }
function harness(domain, docs) {
  const window = { location: { pathname: '/', search: '' }, LIMENDomainBrains: { register() {}, getAll: () => [] }, addEventListener() {}, dispatchEvent() {} };
  const sandbox = { window, URLSearchParams, console: { log() {}, warn() {}, error() {} },
    document: { createElement: () => ({}), head: { appendChild() {} }, addEventListener() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    setInterval: () => 0, clearInterval() {}, setTimeout: () => 0, clearTimeout() {},
    fetch: async url => {
      const match = String(url).match(/^\/assets\/data\/domains\/([A-Za-z0-9_]+)\.json$/);
      const file = match && path.join(ROOT, 'assets/data/domains', match[1] + '.json');
      const data = match && (docs ? docs[match[1]] : fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);
      return { ok: !!data, status: data ? 200 : 404, json: async () => clone(data || {}) };
    } };
  Object.assign(window, { document: sandbox.document, localStorage: sandbox.localStorage, fetch: sandbox.fetch });
  const context = vm.createContext(sandbox);
  for (const file of ['domain-brain-base.js', domain + '-brain.js', 'portal-content-resolver.js']) {
    vm.runInContext(read('assets/js/domain-brains/' + file), context);
    if (file === 'domain-brain-base.js') window.LIMENDomainBrainBase.prototype.start = function () {};
  }
  const name = ({ medicine: 'Health', science: 'Research', trade: 'SupplyChain' })[domain] || domain[0].toUpperCase() + domain.slice(1);
  return { brain: window['LIMEN' + name + 'Brain'], resolver: window.LIMENPortalContentResolver, window };
}
const identity = t => { assert.ok(t.treatmentSourceKey && t.sourcePortal && t.nodeId, 'missing source coordinates'); return JSON.stringify([t.treatmentSourceKey, t.sourcePortal, t.nodeId]); };
const members = t => [...new Set([t.diagnosisId, ...(t.diagnosisIds || [])].filter(Boolean))].sort();
const pairs = records => clone(records).flatMap(t => members(t).map(id => JSON.stringify([identity(t), id])));
const sorted = xs => [...new Set(xs)].sort();
// Independent pre-merge oracle: derive memberships from raw selected digest
// rows, not already-deduplicated runtime output (which could hide lost links).
function rawDigestTreatments(digest, diagnoses) {
  const ids = new Set(diagnoses.map(d => d.id));
  return digest.diagnoses.filter(d => ids.has(d.id)).flatMap(d => d.tx.map(t => ({
    diagnosisId: d.id, label: t.l, nodeId: t.n, sourcePortal: t.p,
    treatmentSourceKey: t.k, cite: t.c, steps: t.st || []
  })));
}
function prepareDigest(brain, digest) {
  brain._deepDigest = digest; brain._activeConditions = Array.from({ length: 6 }, (_, i) => 'observed_' + i);
  brain.state.stress = 0.5; brain.state.diagnoses = []; brain.state.treatments = []; brain.state.opportunities = [];
}
function verify(brain, before, selected) {
  const expected = sorted(pairs(before.concat(selected)));
  const actual = pairs(brain.state.treatments);
  assert.deepEqual(actual.slice().sort(), expected, 'exact union: no missing, extra or duplicate source/diagnosis pairs');
  assert.equal(new Set(brain.state.treatments.map(identity)).size, brain.state.treatments.length, 'one global record per authored identity');
  const allIds = sorted(before.concat(selected).flatMap(members));
  for (const id of allIds.concat('UNRELATED_F10')) {
    const context = brain._buildDomainDiagnosisPacket({ id, active: true }).treatmentContext;
    const wanted = expected.filter(p => JSON.parse(p)[1] === id);
    assert.deepEqual(clone(context.treatments).map(t => JSON.stringify([identity(t), id])).sort(), wanted, id + ' packet source set');
    assert.deepEqual(clone(context.implementationSteps), clone(context.treatments.flatMap(t => t.steps || [])), id + ' packet steps');
  }
  const bySource = new Map(brain.state.treatments.map(t => [identity(t), t]));
  for (const t of before.concat(selected)) {
    const kept = bySource.get(identity(t));
    if (t.cite) assert.equal(kept.cite, t.cite);
    if (t.steps && t.steps.length) assert.deepEqual(clone(kept.steps), clone(t.steps));
  }
  return expected;
}
(async () => {
  let total = 0;
  for (const domain of DOMAINS) {
    const pk = pkOf(domain), digest = JSON.parse(read('assets/data/deep/' + pk + '-diagnosis-digest.json'));
    if (domain !== 'finance') total += digest.diagnoses.reduce((n, d) => n + d.tx.length, 0);
    await test(domain + ': every digest treatment has registry-valid authored coordinates', () => {
      for (const d of digest.diagnoses) for (const t of d.tx) {
        assert.ok(registry[t.n], 'registry node missing: ' + t.n);
        const [portal, node, ai, ti] = JSON.parse(t.k);
        assert.equal(portal, d.slug); assert.equal(t.p, portal); assert.equal(node, t.n);
        assert.ok(Number.isInteger(ai) && ai >= 0 && Number.isInteger(ti) && ti >= 0);
      }
    });
    await test(domain + ': actual first6 digest window survives resolver portal failures without duplicates', async () => {
      const h = harness(domain, {}), b = h.brain; // actual resolver, every portal fetch404
      prepareDigest(b, digest); b._applyDeepDigest();
      const expected = rawDigestTreatments(digest, b.state.diagnoses);
      assert.equal(b.state.diagnoses.length, 6);
      await b.resolveDeepContent();
      assert.equal(Object.values(b.state.resolvedContent.byDiagnosis).flatMap(p => p.treatments).length, 0);
      verify(b, expected, []);
      if (domain === 'agriculture') {
        assert.equal(expected.length, 12); assert.equal(b.state.treatments.length, 10);
        const shared = b.state.treatments.filter(t => members(t).includes('INTEREST_RATE_SHOCK') && members(t).includes('SUCCESSION_FAILURE'));
        assert.equal(shared.length, 2); assert.ok(shared.every(t => t.sourcePortal === 'p2_agri_finance'));
        console.log('  p2_agri:12 diagnosis-treatment incidences ->10 authored sources, all12 memberships retained');
      }
    });
    await test(domain + ': shared digest sources remain unique with empty/null/rejected/absent resolver', async () => {
      const slug = pk + '_f14';
      const t = { l: 'Shared authored action', n: 'THAL', p: slug, k: JSON.stringify([slug, 'THAL', 0, 0]), syn: 0, c: 'authored citation', st: ['authored step'] };
      for (const mode of ['empty', 'null', 'rejected', 'absent']) for (const reverse of [false, true]) {
        const h = harness(domain, {}), b = h.brain;
        const data = { diagnoses: ['F14_A', 'F14_B', 'F14_C'].map(id => ({ id, slug, depth: 2, tx: [id === 'F14_C'
          ? { ...t, p: slug + '_other', k: JSON.stringify([slug + '_other', 'THAL', 0, 0]) } : clone(t)] })) };
        if (reverse) data.diagnoses.reverse();
        const snapshot = clone(data), cognition = { unchanged: domain };
        prepareDigest(b, data); b.state.cognition = cognition;
        if (mode === 'absent') delete h.window.LIMENPortalContentResolver;
        else h.resolver.resolveForBrain = async () => {
          if (mode === 'rejected') throw new Error('offline unavailable');
          return mode === 'null' ? null : { byDiagnosis: {} };
        };
        b._applyDeepDigest();
        const expected = rawDigestTreatments(data, b.state.diagnoses);
        assert.equal(b.state.treatments.length, 2, mode + ': unique before resolver');
        const expectedPairs = verify(b, expected, []);
        await b.resolveDeepContent(); assert.deepEqual(verify(b, expected, []), expectedPairs);
        b.state.treatments.reverse(); b._applyDeepDigest(); await b.resolveDeepContent();
        assert.deepEqual(verify(b, expected, []), expectedPairs, 'repeat injection/resolution');
        assert.deepEqual(data, snapshot, 'authored digest not mutated'); assert.equal(b.state.cognition, cognition);
      }
    });
    await test(domain + ': injection keeps unknown and conflicting sources separate', async () => {
      const slug = pk + '_f14', h = harness(domain, {}), b = h.brain;
      const t = { l: 'Same label', n: 'THAL', p: slug, k: JSON.stringify([slug, 'THAL', 0, 0]), syn: 1 };
      const unknown = { l: t.l, n: t.n, p: t.p, syn: 1 };
      const data = { diagnoses: [
        { id: 'A', depth: 2, tx: [t] }, { id: 'B', depth: 2, tx: [clone(t)] },
        { id: 'C', depth: 2, tx: [{ ...t, p: slug + '_other', k: JSON.stringify([slug + '_other', 'THAL', 0, 0]) }] },
        { id: 'UNKNOWN', depth: 2, tx: [unknown, clone(unknown)] },
        { id: 'CONFLICT', depth: 2, tx: [{ ...t, n: 'PFC' }] }
      ] };
      prepareDigest(b, data); b._applyDeepDigest(); await b.resolveDeepContent();
      const expected = rawDigestTreatments(data, b.state.diagnoses).filter(t => t.treatmentSourceKey);
      assert.deepEqual(pairs(b.state.treatments.filter(t => t.treatmentSourceKey)).sort(), sorted(pairs(expected)));
      assert.equal(b.state.treatments.length, 5, 'three known identities plus two unknown occurrences');
      assert.equal(b.state.treatments.filter(t => !t.treatmentSourceKey).length, 2);
      assert.equal(b._buildDomainDiagnosisPacket({ id: 'UNKNOWN', active: true }).treatmentContext.treatments.length, 2);
      assert.equal(b._buildDomainDiagnosisPacket({ id: 'UNRELATED_F14', active: true }).treatmentContext.treatments.length, 0);
    });
    await test(domain + ': root-plus-digest cycles retain all treatments through packets', async () => {
      const h = harness(domain), b = h.brain;
      const root = JSON.parse(read('assets/data/domains/' + pk + '.json'));
      b._deepDigest = digest; b._activeConditions = Array.from({ length: 12 }, (_, i) => 'observed_' + i);
      b.state.stress = 1; b.state.opportunities = [];
      const covered = new Set();
      const nonOverlap = digest.diagnoses.filter(d => !root.issues.some(r => r.id === d.id));
      for (let cycle = 0; cycle < 30; cycle++) {
        b.state.diagnoses = root.issues.map(d => ({ id: d.id, active: true })); b.state.treatments = [];
        b._applyDeepDigest();
        const before = clone(b.state.treatments);
        b.state.diagnoses.filter(d => d.source === 'deep-digest').forEach(d => covered.add(d.id));
        await b.resolveDeepContent();
        // Reproduce replacement even on old digests which have no source keys.
        const retained = before.filter(t => b.state.treatments.some(k => t.treatmentSourceKey
          ? identity(k) === identity(t) && members(k).includes(t.diagnosisId) : k.id === t.id));
        assert.equal(retained.length, before.length, 'cycle ' + (cycle + 1) + ': retained ' + retained.length + '/' + before.length + ' digest records');
        const selected = Object.values(b.state.resolvedContent.byDiagnosis).flatMap(p => p.treatments);
        const expected = verify(b, before, selected);
        if (cycle === 0) {
          await b.resolveDeepContent(); assert.deepEqual(verify(b, before, selected), expected, 'repeat resolution');
          b.state.treatments.reverse(); b.state.diagnoses.reverse();
          await b.resolveDeepContent(); assert.deepEqual(verify(b, before, selected), expected, 'order invariance');
        }
        if (nonOverlap.every(d => covered.has(d.id))) break;
      }
      // The base deliberately excludes a digest diagnosis already present at
      // root (p2_agri has PEST_OUTBREAK). Exercise those rows in a root window
      // without that overlap; do not change the runtime's existing exclusion.
      const overlap = digest.diagnoses.filter(d => root.issues.some(r => r.id === d.id));
      if (overlap.length) {
        b._deepDigest = { diagnoses: overlap };
        b.state.diagnoses = root.issues.filter(r => !overlap.some(d => d.id === r.id)).map(r => ({ id: r.id, active: true }));
        b.state.treatments = []; b._applyDeepDigest();
        b.state.diagnoses.filter(d => d.source === 'deep-digest').forEach(d => covered.add(d.id));
        const before = clone(b.state.treatments);
        await b.resolveDeepContent();
        verify(b, before, Object.values(b.state.resolvedContent.byDiagnosis).flatMap(p => p.treatments));
      }
      assert.deepEqual([...covered].sort(), digest.diagnoses.map(d => d.id).sort(), 'exact full selected diagnosis set (including empty-treatment diagnoses)');
    });
    await test(domain + ': same-source twins union memberships and preserve detailed evidence', async () => {
      const slug = pk + '_f10_source';
      const authored = { label: 'Identical action', cite: 'authored citation', steps: ['authored step'], evidence: 'A', description: 'detail' };
      const h = harness(domain, { [slug]: { activations: [{ brainNodeId: 'THAL', treatments: [authored, authored] }] } });
      Object.assign(h.resolver.getDiagnosisPortalMap(), { F10_ROOT: [slug] });
      const b = h.brain; b.state.diagnoses = [{ id: 'F10_ROOT', active: true }, { id: 'F10_DEEP', active: true }];
      const t = { id: 'digest_source', label: authored.label, diagnosisId: 'F10_DEEP', nodeId: 'THAL', sourcePortal: slug, treatmentSourceKey: JSON.stringify([slug, 'THAL', 0, 0]), source: 'deep-digest', steps: [] };
      b.state.treatments = [clone(t)]; b.state.opportunities = [];
      await b.resolveDeepContent();
      const selected = Object.values(b.state.resolvedContent.byDiagnosis).flatMap(p => p.treatments);
      verify(b, [t], selected); assert.equal(b.state.treatments.length, 2, 'two authored positions, not one label');
      const known = clone(b.state.treatments), unknown = { label: authored.label, diagnosisId: 'UNKNOWN' };
      b.state.treatments.push(clone(unknown), clone(unknown), { ...clone(t), nodeId: 'PFC', diagnosisId: 'CONFLICT' });
      await b.resolveDeepContent();
      assert.equal(b.state.treatments.filter(t => !t.treatmentSourceKey).length, 2, 'unknowns cannot merge by label');
      assert.equal(b.state.treatments.filter(t => t.nodeId === 'PFC').length, 1, 'conflicting coordinates stay separate');
      assert.equal(b.state.treatments.length, known.length + 3);
      const snapshot = clone(b.state.treatments);
      h.resolver.resolveForBrain = async () => ({ byDiagnosis: {} });
      await b.resolveDeepContent(); assert.deepEqual(clone(b.state.treatments), snapshot, 'empty resolver preserves state');
    });
  }
  assert.equal(total, 6836, 'reported selected non-Finance incidences (not unique authored entities)');
  process.env.BUILD_DIGEST_SKIP_MAIN = '1';
  const { buildDigest } = await import(pathToFileURL(path.join(ROOT, 'scripts/build-diagnosis-digest.mjs')));
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'limen-fleet-source-'));
  try {
    for (const domain of DOMAINS) await test(domain + ': builder assigns coordinates before evidence sorting/capping', () => {
      const pk = pkOf(domain), slug = pk + '_fixture';
      const treatments = [{ label: 'Same', evidence: 'B' }, { label: 'Same', evidence: 'A' }];
      fs.writeFileSync(path.join(temp, slug + '.json'), JSON.stringify({ issues: [{ id: 'DX', circuits: [{ nodeId: 'THAL' }] }], activations: [{ brainNodeId: 'THAL', treatments }, { brainNodeId: 'THAL', treatments }] }));
      const tx = buildDigest(pk, temp).diagnoses[0].tx;
      assert.equal(tx[0].k, JSON.stringify([slug, 'THAL', 0, 1]));
      assert.equal(tx[1].k, JSON.stringify([slug, 'THAL', 1, 1]));
      assert.ok(tx.every(t => t.n === 'THAL' && t.p === slug));
    });
  } finally {
    const resolved = fs.realpathSync(temp);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir())); assert.ok(path.basename(resolved).startsWith('limen-fleet-source-'));
    fs.rmSync(resolved, { recursive: true });
  }
  console.log(passed + '/' + (passed + failed) + ' fleet digest conservation groups passed; selected non-Finance incidences=' + total);
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
