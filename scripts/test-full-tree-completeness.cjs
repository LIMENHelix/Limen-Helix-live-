'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const crypto = require('node:crypto'), vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const inventory = require('./data/full-tree-inventory.json');
const keys = Object.keys(inventory.domains);
const hash = names => crypto.createHash('sha256').update(names.slice().sort().join('\n') + '\n').digest('hex');
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.message); } }
const virtual = path.resolve(__dirname, '__full_tree_fixture__');
const all = keys.flatMap(k => [k + '.json', ...Array.from({ length: 17060 }, (_, i) =>
  k + '_' + Array(1 + i % 5).fill('level').join('_') + i + '.json')]);
const baseline = { schemaVersion: 1, domains: Object.fromEntries(keys.map(k => {
  const names = all.filter(n => n === k + '.json' || n.startsWith(k + '_'));
  return [k, { files: names.length, filenamesSha256: hash(names) }];
})) };
function report(fn, names, expected = baseline, nonfiles = new Set()) {
  const original = fs.readdirSync;
  try {
    fs.readdirSync = (dir, opts) => {
      assert.equal(path.resolve(dir), virtual);
      return opts && opts.withFileTypes ? names.map(name => ({ name, isFile: () => !nonfiles.has(name) })) : names.slice();
    };
    return fn(virtual, expected);
  } finally { fs.readdirSync = original; }
}
(async () => {
  let { fullTreeReport } = await import('./build-diagnosis-digest.mjs');
  if (!fullTreeReport) {
    // Pre-repair RED path: run the committed private gate without editing it.
    const source = fs.readFileSync(path.join(__dirname, 'build-diagnosis-digest.mjs'), 'utf8');
    const start = source.indexOf('function fullTreeReport(');
    const end = source.indexOf('// Corpus discovery', start);
    fullTreeReport = vm.runInNewContext('(' + source.slice(start, end).trim() + ')', { fs, PORTAL_KEYS: keys });
  }
  test('reported 1000-file/depths2-6 partial exports fail the pinned inventory', () => {
    const partial = keys.flatMap(k => all.filter(n => n === k + '.json' || n.startsWith(k + '_')).slice(0, 1001));
    assert.equal(report(fullTreeReport, partial, inventory).ok, false);
  });
  test('complete independently specified inventory passes in either enumeration order', () => {
    assert.equal(report(fullTreeReport, all).ok, true);
    assert.equal(report(fullTreeReport, all.slice().reverse()).ok, true);
  });
  for (const k of keys) {
    const target = all.find(n => n.startsWith(k + '_') && n !== k + '.json');
    test(k + ': one missing source fails even above old size/depth floor', () => {
      assert.equal(report(fullTreeReport, all.filter(n => n !== target)).ok, false);
    });
    test(k + ': same-count filename substitution fails', () => {
      assert.equal(report(fullTreeReport, all.map(n => n === target ? k + '_substitute.json' : n)).ok, false);
    });
    test(k + ': missing root fails', () => {
      assert.equal(report(fullTreeReport, all.filter(n => n !== k + '.json')).ok, false);
    });
    test(k + ': a directory or symbolic link cannot stand in for a file', () => {
      assert.equal(report(fullTreeReport, all, baseline, new Set([target])).ok, false);
    });
    test(k + ': new source requires reviewed inventory update', () => {
      assert.equal(report(fullTreeReport, all.concat(k + '_new.json')).ok, false);
    });
  }
  test('unrelated trees are ignored, including legal and psychedelic', () => {
    assert.equal(report(fullTreeReport, all.concat('legal_x.json', 'psychedelic_x.json', 'notes.txt')).ok, true);
  });
  test('invalid/missing baseline cannot self-attest a candidate directory', () => {
    for (const bad of [null, {}, { schemaVersion: 1, domains: {} }, { ...baseline, schemaVersion: 99 }]) {
      assert.equal(report(fullTreeReport, all, bad).ok, false);
    }
  });
  test('even internally consistent low-count baselines are rejected', () => {
    for (const count of [1000, 16999]) {
      const names = keys.flatMap(k => all.filter(n => n === k + '.json' || n.startsWith(k + '_')).slice(0, count + 1));
      const low = { schemaVersion: 1, domains: Object.fromEntries(keys.map(k => {
        const group = names.filter(n => n === k + '.json' || n.startsWith(k + '_'));
        return [k, { files: group.length, filenamesSha256: hash(group) }];
      })) };
      assert.equal(report(fullTreeReport, names, low).ok, false, count + ' subtree files');
    }
  });
  test('unreadable source fails closed', () => assert.equal(fullTreeReport(path.join(os.tmpdir(), 'absent-full-tree-' + process.pid)).ok, false));
  test('CLI fails before writing; explicit shallow opt-in remains labelled shallow', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'limen-full-tree-test-'));
    try {
      fs.mkdirSync(path.join(tmp, 'scripts/data'), { recursive: true });
      fs.mkdirSync(path.join(tmp, 'assets/data/domains'), { recursive: true });
      fs.copyFileSync(path.join(__dirname, 'build-diagnosis-digest.mjs'), path.join(tmp, 'scripts/build-diagnosis-digest.mjs'));
      fs.copyFileSync(path.join(__dirname, 'data/full-tree-inventory.json'), path.join(tmp, 'scripts/data/full-tree-inventory.json'));
      fs.writeFileSync(path.join(tmp, 'assets/data/domains/finance_leaf.json'), JSON.stringify({ issues: [{ id: 'ONLY_DX', circuits: [] }] }));
      const env = { ...process.env, LIMEN_FULL_DOMAINS_DIR: path.join(tmp, 'missing'), LIMEN_ALLOW_SHALLOW: '', BUILD_DIGEST_SKIP_MAIN: '' };
      const args = [path.join(tmp, 'scripts/build-diagnosis-digest.mjs'), 'finance'];
      const denied = spawnSync(process.execPath, args, { env, encoding: 'utf8' });
      assert.equal(denied.status, 1); assert.match(denied.stderr, /FAIL-CLOSED/);
      assert.equal(fs.existsSync(path.join(tmp, 'assets/data/deep')), false);
      const allowed = spawnSync(process.execPath, args.concat('--allow-shallow'), { env, encoding: 'utf8' });
      assert.equal(allowed.status, 0, allowed.stderr);
      const digest = JSON.parse(fs.readFileSync(path.join(tmp, 'assets/data/deep/finance-diagnosis-digest.json')));
      assert.equal(digest.source, 'live-shallow-authorized'); assert.equal(digest.diagnosisCount, 1);
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });
  const arg = process.argv.indexOf('--corpus');
  if (arg >= 0) test('actual full corpus matches pinned source inventory', () => {
    const result = fullTreeReport(process.argv[arg + 1]);
    assert.equal(result.ok, true, result.reason);
  });
  console.log(passed + '/' + (passed + failed) + ' full-tree completeness checks passed');
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
