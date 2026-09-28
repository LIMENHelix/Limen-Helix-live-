'use strict';
// Offline ordering regression. Optional: --corpus <full-source-directory> runs
// the same three enumerations against all real domains IN MEMORY; no artifacts
// are written and no full-tree completeness/provenance claim is made here.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const KEYS = ['p2_agri', 'communication', 'culture', 'defense', 'economy', 'education',
  'energy', 'environment', 'finance', 'governance', 'industry', 'infrastructure',
  'intelligence', 'law', 'medicine', 'population', 'religion', 'science', 'technology', 'trade'];
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
let passed = 0, failed = 0;
const results = [];
function test(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name); }
  catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message.slice(0, 600)); }
}
function shuffle(names) {
  const out = names.slice(); let seed = 0x386;
  for (let i = out.length - 1; i > 0; i--) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const j = (seed >>> 0) % (i + 1); [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function fixture(pk) {
  const files = {};
  const tx = Array.from({ length: 8 }, (_, i) => ({ label: 'Authored care ' + i, evidence: 'A', cite: 'source', steps: ['step ' + i] }));
  const issue = (id, evidence = 'A') => ({ id, label: id, circuits: [{ nodeId: 'CC', evidence }] });
  const put = (slug, issues, count = 8) => { files[slug + '.json'] = JSON.stringify({ issues,
    activations: [{ brainNodeId: 'CC', treatments: tx.slice(0, count) }] }); };
  put(pk, [issue('ROOT_EXCLUDED')]);
  // Filename order deliberately opposes ID order; all scores tie and the pool
  // exceeds 180. Sorting filenames alone must NOT satisfy the ranking oracle.
  for (let i = 0; i < 210; i++) put(pk + '_f' + String(209 - i).padStart(3, '0'), [issue('DX' + String(i).padStart(3, '0'))]);
  // Equal-richness duplicates choose a canonical source; a richer source still
  // wins irrespective of slug. These low-priority rows stay in the manifest.
  put(pk + '_a', [issue('TWIN', 'B'), issue('RICH', 'B')], 1);
  put(pk + '_z', [issue('TWIN', 'B')], 1);
  put(pk + '_rich', [issue('RICH', 'B')], 2);
  return files;
}
function render(digest) {
  // Same compact digest serialization as the CLI, plus its complete route set.
  const { _manifest, ...body } = digest;
  return { bytes: JSON.stringify(body), manifest: JSON.stringify(_manifest),
    ids: body.diagnoses.map(d => d.id).sort(compare), body };
}
function rebuild(buildDigest, pk, dir, names, virtualFiles) {
  const readDir = fs.readdirSync, readFile = fs.readFileSync;
  const outputs = [];
  try {
    if (virtualFiles) fs.readFileSync = function (file, ...args) {
      if (path.dirname(String(file)) === dir) return virtualFiles[path.basename(String(file))];
      return readFile.call(this, file, ...args);
    };
    for (const [label, enumeration] of [['normal', names], ['reversed', names.slice().reverse()], ['shuffled', shuffle(names)]]) {
      fs.readdirSync = function (target, ...args) {
        return path.resolve(String(target)) === dir ? enumeration.slice() : readDir.call(this, target, ...args);
      };
      outputs.push({ label, ...render(buildDigest(pk, dir)) });
    }
  } finally { fs.readdirSync = readDir; fs.readFileSync = readFile; }
  return outputs;
}
(async () => {
  const { buildDigest } = await import('./build-diagnosis-digest.mjs');
  const corpusIndex = process.argv.indexOf('--corpus');
  const corpus = corpusIndex >= 0 ? fs.realpathSync(process.argv[corpusIndex + 1]) : null;
  const names = corpus ? fs.readdirSync(corpus) : null;
  for (const pk of KEYS) {
    const files = corpus ? null : fixture(pk);
    const dir = corpus || path.resolve(__dirname, '__virtual_digest_order__', pk);
    const outputs = rebuild(buildDigest, pk, dir, names || Object.keys(files).sort(compare), files);
    const base = outputs[0];
    test(pk + ': selected IDs and digest/manifest bytes ignore enumeration', () => {
      for (const candidate of outputs.slice(1)) {
        assert.deepEqual(candidate.ids, base.ids, candidate.label + ' selected IDs');
        assert.equal(hash(candidate.bytes), hash(base.bytes), candidate.label + ' digest bytes');
        assert.equal(candidate.bytes, base.bytes);
        assert.equal(candidate.manifest, base.manifest, candidate.label + ' manifest routes');
      }
      assert.equal(base.body.diagnosisCount, 180);
      assert.equal(base.body.diagnoses.length, new Set(base.ids).size);
    });
    if (!corpus) test(pk + ': ID tie-break, duplicate source and caps are explicit', () => {
      assert.deepEqual(base.ids, Array.from({ length: 180 }, (_, i) => 'DX' + String(i).padStart(3, '0')));
      const manifest = JSON.parse(base.manifest);
      assert.deepEqual(manifest.find(d => d[0] === 'TWIN'), ['TWIN', 'a', 2]);
      assert.deepEqual(manifest.find(d => d[0] === 'RICH'), ['RICH', 'rich', 2]);
      assert.ok(base.body.diagnoses.every(d => d.depth === 2 && d.tx.length === (pk === 'finance' ? 6 : 2)));
      assert.ok(!manifest.some(d => d[0] === 'ROOT_EXCLUDED'));
    });
    const published = corpus ? JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/data/deep', pk + '-diagnosis-digest.json'), 'utf8')) : null;
    results.push({ domain: pk, available: base.body.diagnosisTotalAvailable, selected: base.ids,
      enumerations: outputs.map(o => ({ name: o.label, digestSha256: hash(o.bytes), manifestSha256: hash(o.manifest) })),
      differsFromPublishedWindow: published ? base.ids.filter(id => !published.diagnoses.some(d => d.id === id)).length : null });
  }
  if (!corpus) test('urgency, richness and evidence priorities precede lexical identity', () => {
    const dir = path.resolve(__dirname, '__virtual_digest_order__', 'priority');
    const files = { 'finance_priority.json': JSON.stringify({
      issues: [
        { id: 'A', circuits: [{ nodeId: 'M', evidence: 'Emerging' }] },
        { id: 'Z', circuits: [{ nodeId: 'M', evidence: 'A' }] },
        { id: 'ZZ', circuits: [{ nodeId: 'N', evidence: 'Emerging' }] },
        { id: 'ZZZ', label: 'drought', circuits: [] }
      ], activations: [{ brainNodeId: 'M', treatments: [{ label: 'x' }] },
        { brainNodeId: 'N', treatments: [{ label: 'x' }, { label: 'y' }] }] }) };
    const out = rebuild(buildDigest, 'finance', dir, Object.keys(files), files)[0];
    assert.deepEqual(out.body.diagnoses.map(d => d.id), ['ZZZ', 'ZZ', 'Z', 'A']);
  });
  console.log(passed + '/' + (passed + failed) + ' digest determinism checks passed');
  if (corpus) console.log('RESULT_JSON ' + JSON.stringify({ corpus, passed, failed, domains: results }));
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
