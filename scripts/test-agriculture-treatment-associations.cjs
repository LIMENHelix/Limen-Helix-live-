// F-05: offline real resolver -> real Agriculture matrix, including its real node directory.
// No network, timers, approvals, trades, or persistent storage. --report emits exact set evidence.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const clone = x => JSON.parse(JSON.stringify(x));
const sorted = x => Array.from(x).sort();
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('PASS ' + name); }
  catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message.split('\n')[0]); }
}
function localPortal(slug) {
  const file = path.join(ROOT, 'assets/data/domains', slug + '.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}
function harness({ enabled = true, query = '?domain=agriculture' } = {}) {
  const brain = { state: {} }, ds = { brainDiagnoses: [], brainResolvedContent: null };
  const win = { location: { pathname: '/', search: query },
    LIMEN_ENABLE_AGRICULTURE_OPPORTUNITY_MATRIX: enabled,
    LIMENDomains: { agriculture: ds }, LIMENDomainBrains: { get: () => brain },
    addEventListener() {}, dispatchEvent() {} };
  const storage = { getItem: () => null, setItem() { throw new Error('storage write forbidden'); } };
  const sandbox = { window: win, URLSearchParams, console: { log() {}, warn() {}, error() {} },
    localStorage: storage, sessionStorage: storage, setTimeout: () => 0, clearTimeout() {},
    fetch: async url => {
      if (url === 'assets/data/command-board-data.json') return { ok: true, json: async () => ({ companies: [] }) };
      const match = String(url).match(/^\/assets\/data\/domains\/([A-Za-z0-9_]+)\.json$/);
      const doc = match && localPortal(match[1]);
      return { ok: !!doc, status: doc ? 200 : 404, json: async () => clone(doc || {}) };
    }
  };
  const ctx = vm.createContext(sandbox);
  for (const file of ['assets/js/domain-brains/portal-content-resolver.js',
    'assets/js/agriculture-node-business-engine.js', 'assets/js/agriculture-opportunity-matrix.js']) {
    vm.runInContext(read(file), ctx, { filename: file });
  }
  const api = win.LIMENAgricultureOpportunityMatrix;
  return { win, brain, ds, api, resolver: win.LIMENPortalContentResolver,
    compute(content, diagnoses = []) {
      ds.brainResolvedContent = content;
      ds.brainDiagnoses = diagnoses;
      return new Promise(resolve => {
        const off = api.subscribe(rows => { off(); resolve(clone(rows)); });
        api.recompute();
      });
    }
  };
}
function entries(content) {
  return Object.entries(content.byDiagnosis).flatMap(([host, p]) => p.treatments.map(t => ({ host, t })));
}
function memberships(t, host) {
  return sorted(new Set([host].concat(Array.isArray(t.diagnosisIds) ? t.diagnosisIds : [])
    .filter(id => typeof id === 'string' && id.trim())));
}
const pair = (key, id) => JSON.stringify([key, id]);
function difference(expected, actual) {
  const want = new Set(expected), counts = new Map();
  for (const key of actual) counts.set(key, (counts.get(key) || 0) + 1);
  return { missing: sorted([...want].filter(k => !counts.has(k))),
    extra: sorted([...counts.keys()].filter(k => !want.has(k))),
    duplicates: [...counts].filter(([, n]) => n > 1).sort(([a], [b]) => a.localeCompare(b)) };
}
function assertEmpty(diff, name) {
  assert.deepEqual(diff, { missing: [], extra: [], duplicates: [] }, name);
}
// Baseline matrix omits the source key entirely. For measurement ONLY, recover a
// key by a unique exact match of every retained evidence field to resolver input.
// Never infer identity from label/node alone. Corrected-output assertions below
// require an explicit source key, so this diagnostic join cannot hide a regression.
function fingerprint(node, t) {
  return JSON.stringify([node, t.label || null, t.type || null, t.evidence || null,
    t.description || null, t.cite || t.citation || null, t.steps || [],
    t.monitoring || null, t.escalation || null, t.target || null,
    t.depth == null ? null : t.depth, t.ancestryPath || null,
    t.portalDomainId || null, t.portalTitle || null, !!(t.cite && Array.isArray(t.steps) && t.steps.length)]);
}
async function measure(h, content, diagnoses) {
  const source = entries(content);
  const expected = source.flatMap(({ host, t }) => memberships(t, host).map(id => pair(t.treatmentSourceKey, id)));
  const fingerprints = new Map();
  for (const { t } of source) {
    const fp = fingerprint(t.nodeId, t);
    if (!fingerprints.has(fp)) fingerprints.set(fp, []);
    fingerprints.get(fp).push(t.treatmentSourceKey);
  }
  const before = clone(content);
  const rows = await h.compute(content, diagnoses);
  const evidencePairs = [], unmatchedEvidence = [], evidenceSourceKeys = [];
  let unkeyedEvidence = 0;
  for (const row of rows) for (const t of row.deepEvidence) {
    let key = t.treatmentSourceKey;
    if (!key) {
      unkeyedEvidence++;
      const matches = fingerprints.get(fingerprint(row.nodeId, t)) || [];
      if (matches.length === 1) key = matches[0];
      else { unmatchedEvidence.push({ node: row.nodeId, label: t.label, matches: matches.length }); continue; }
    }
    evidenceSourceKeys.push(key);
    for (const id of memberships(t, t.diagnosisId)) evidencePairs.push(pair(key, id));
  }
  const expectedNodes = source.flatMap(({ host, t }) => memberships(t, host).map(id => pair(t.nodeId, id)));
  const actualNodes = rows.flatMap(row => row.coverage.envelopes.map(id => pair(row.nodeId, id)));
  // Node envelope unions can mask lost memberships. Replay each actual source
  // alone through the public matrix API to observe exact source->envelope pairs.
  const isolatedPairs = [];
  for (const { host, t } of source) {
    const one = await h.compute({ byDiagnosis: { [host]: { treatments: [t] } } }, []);
    for (const row of one) for (const id of row.coverage.envelopes) isolatedPairs.push(pair(t.treatmentSourceKey, id));
  }
  assert.deepEqual(clone(content), before, 'matrix must not mutate resolver/cache records');
  // Intern identical differences so exact 602-pair lists are retained once,
  // referenced explicitly by both consumers, rather than replaced by totals.
  const sets = {}, references = {};
  for (const [name, diff] of Object.entries({ deepEvidence: difference(expected, evidencePairs),
    isolatedSourceEnvelopes: difference(expected, isolatedPairs),
    aggregateNodeEnvelopes: difference(expectedNodes, actualNodes) })) {
    const existing = Object.keys(sets).find(k => JSON.stringify(sets[k]) === JSON.stringify(diff));
    references[name] = existing || name;
    if (!existing) sets[name] = diff;
  }
  return { report: { scope: 'all six committed Agriculture root diagnoses; default resolver quota; B-only activation',
    selectedSources: source.length, expectedSourceDiagnosisPairs: new Set(expected).size,
    evidenceRows: evidenceSourceKeys.length, unkeyedEvidence, unmatchedEvidence,
    references, differenceSets: sets }, rows };
}
function synthetic(key, dxs, node = 'THAL') {
  return { label: 'Same authored label', type: 'POLICY', evidence: 'A', nodeId: node,
    treatmentSourceKey: key, sourcePortal: 'ag_fixture', portalDomainId: 'ag_fixture',
    ancestryPath: ['ag_fixture'], depth: 0, cite: key + ' citation', steps: [key + ' step'], diagnosisIds: dxs };
}
(async () => {
  const h = harness();
  const ids = localPortal('p2_agri').issues.map(d => d.id);
  const diagnoses = ids.map(id => ({ id, active: true, circuits: [] }));
  const content = await h.resolver.resolveForBrain({ domainId: 'agriculture', diagnoses });
  const measured = await measure(h, content, diagnoses);
  if (process.argv.includes('--report')) console.log('AUDIT_JSON ' + JSON.stringify(measured.report));
  const summary = Object.fromEntries(Object.entries(measured.report.references).map(([name, ref]) => {
    const d = measured.report.differenceSets[ref];
    return [name, { missing: d.missing.length, extra: d.extra.length, duplicates: d.duplicates.length }];
  }));
  console.log('REBASELINE ' + JSON.stringify({ selected: measured.report.selectedSources,
    expectedPairs: measured.report.expectedSourceDiagnosisPairs, unkeyedEvidence: measured.report.unkeyedEvidence, ...summary }));
  await test('committed corpus exact authored evidence and isolated activation sets', async () => {
    assert.equal(measured.report.selectedSources, 1002, 'pinned ea6a6e27 resolver population');
    assert.equal(measured.report.expectedSourceDiagnosisPairs, 1604);
    assert.equal(measured.report.unmatchedEvidence.length, 0, 'baseline diagnostic join must be unambiguous');
    for (const [name, ref] of Object.entries(measured.report.references)) assertEmpty(measured.report.differenceSets[ref], name);
    assert.equal(measured.report.unkeyedEvidence, 0, 'evidence must explicitly preserve source identity');
  });
  await test('each source stays once with full membership, citation, steps and source context', async () => {
    const source = new Map(entries(content).map(({ host, t }) => [t.treatmentSourceKey, { host, t }]));
    const retained = [];
    for (const row of measured.rows) {
      assert.equal(row.coverage.deepTreatmentCount, row.deepEvidence.length);
      for (const ev of row.deepEvidence) {
        const original = source.get(ev.treatmentSourceKey);
        assert.ok(original, 'explicit authored identity');
        retained.push(ev.treatmentSourceKey);
        assert.equal(row.nodeId, original.t.nodeId);
        assert.equal(ev.sourcePortal, original.t.sourcePortal);
        assert.equal(ev.diagnosisId, original.host, 'legacy host field preserved');
        assert.deepEqual(sorted(ev.diagnosisIds), memberships(original.t, original.host));
        assert.equal(fingerprint(row.nodeId, ev), fingerprint(row.nodeId, original.t));
      }
    }
    assert.deepEqual(sorted(retained), sorted([...source.keys()]));
  });
  await test('real corpus association sets invariant to package and treatment order', async () => {
    const reversed = { byDiagnosis: Object.fromEntries(Object.entries(content.byDiagnosis).reverse()
      .map(([id, p]) => [id, { ...p, treatments: p.treatments.slice().reverse() }])) };
    const other = await measure(h, reversed, diagnoses.slice().reverse());
    assert.deepEqual(other.report, measured.report);
    for (const [name, ref] of Object.entries(other.report.references)) assertEmpty(other.report.differenceSets[ref], name);
  });
  await test('shared, unrelated, legacy, malformed and unknown identities preserve one evidence record each', async () => {
    const records = [synthetic('shared', ['B', 'B', null, 7, '', ' ']), synthetic('other', ['C'], 'HIPP'),
      { ...synthetic('legacy', undefined), diagnosisIds: undefined },
      synthetic('empty', []), synthetic('string', 'B'), synthetic('object', { 0: 'B' }),
      { ...synthetic('unknown1', ['A', 'B']), treatmentSourceKey: undefined },
      { ...synthetic('unknown2', ['A', 'B']), treatmentSourceKey: undefined }];
    const fixture = { byDiagnosis: { A: { treatments: records.filter(t => t.nodeId === 'THAL') }, C: { treatments: [records[1]] } } };
    const before = clone(fixture);
    const rows = await h.compute(fixture);
    const thal = rows.find(r => r.nodeId === 'THAL'), other = rows.find(r => r.nodeId === 'HIPP');
    assert.deepEqual(sorted(thal.coverage.envelopes), ['A', 'B']);
    assert.deepEqual(sorted(other.coverage.envelopes), ['C']);
    assert.equal(thal.deepEvidence.length, 7, 'do not multiply records by membership or merge unknowns');
    for (const ev of thal.deepEvidence) {
      assert.equal(ev.diagnosisId, 'A');
      assert.deepEqual(sorted(ev.diagnosisIds), /^(shared|unknown)/.test(ev.cite) ? ['A', 'B'] : ['A']);
    }
    assert.deepEqual(sorted(other.deepEvidence[0].diagnosisIds), ['C']);
    thal.deepEvidence[0].diagnosisIds.push('UNRELATED');
    thal.deepEvidence[0].steps.push('modified output');
    assert.deepEqual(clone(fixture), before, 'evidence arrays must not alias resolver input');
  });
  await test('diagnosis circuit activation, domain/feature gates and output lane types preserved', async () => {
    const rows = await h.compute({ byDiagnosis: { A: { treatments: [synthetic('shared', ['A', 'B'])] } } },
      [{ id: 'CIRCUIT', active: true, circuits: [{ nodeId: 'THAL' }] }]);
    const row = rows.find(r => r.nodeId === 'THAL');
    assert.deepEqual(row.coverage.predicates, ['A', 'B']);
    assert.deepEqual(sorted(row.coverage.envelopes), ['A', 'B', 'CIRCUIT']);
    assert.equal(row.derivedDiagnosis.id, 'CIRCUIT', 'existing active circuit remains primary');
    assert.deepEqual(Object.keys(row.opportunityLanes).sort(), ['investments', 'operatorServices', 'research', 'targetCompanies']);
    assert.deepEqual(clone(h.brain.state.opportunityMatrix), rows, 'brain projection matches public matrix');
    const disabled = harness({ enabled: false });
    assert.equal(disabled.api.isEnabled(), false);
    assert.deepEqual(clone(disabled.api.recompute()), []);
    assert.equal(harness({ query: '?domain=finance' }).api, undefined);
  });
  console.log(`${passed}/${passed + failed} Agriculture matrix tests passed`);
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
