/**
 * brain-v2/test/corpus-adversarial.js — Layers 1-2, hostile inputs.
 *
 *   node brain-v2/test/corpus-adversarial.js
 *
 * Each test does TWO things, and the first is what makes it worth having:
 *
 *   1. proves the hazard is real on this data — the guard is not tested against a
 *      hypothetical;
 *   2. proves the guard fires FOR THE INTENDED REASON, by asserting on the specific
 *      error and the specific field, never merely that "something threw".
 *
 * A test that only checks a throw happened will pass when the code breaks for an
 * unrelated reason, which is how a guard silently stops guarding.
 *
 * READ-ONLY ON THE REAL CORPUS. Every destructive scenario runs against a purpose-built
 * temporary git repository. Nothing here writes to the corpus.
 */

'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var cp = require('child_process');

var AI = require('../corpus/artifact-index.js');
var RCS = require('../corpus/raw-claim-store.js');

var failures = 0, tests = 0, skipped = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

var argRoot = null;
process.argv.forEach(function (a, i) { if (a === '--root') argRoot = process.argv[i + 1]; });
var ROOT = argRoot || process.env.LIMEN_CORPUS_ROOT || null;
var PATTERN = process.env.LIMEN_CORPUS_PATTERN || 'assets/data/domains/energy*.json';
var SUBSET = Number(process.env.LIMEN_CORPUS_TEST_LIMIT || 1200);

var TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'corpus-adv-'));
function out(sub) { var d = path.join(TMP, sub); if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); return d; }

/** A standalone corpus built from scratch. The real corpus is never written to. */
function fixtureRepo(name, files) {
  var d = out(name);
  fs.mkdirSync(path.join(d, 'assets', 'data', 'domains'), { recursive: true });
  Object.keys(files).forEach(function (f) { fs.writeFileSync(path.join(d, 'assets/data/domains', f), files[f]); });
  cp.execFileSync('git', ['init', '-q'], { cwd: d });
  cp.execFileSync('git', ['add', '-A'], { cwd: d });
  cp.execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'f'], { cwd: d });
  return d;
}
function artifact(id, extra) {
  var base = {
    domainId: id, title: id,
    issues: [{ id: 'I1', circuits: [{ nodeId: 'N1', evidence: 'Moderate' }] }],
    activations: [{ brainNodeId: 'B1', state: 'active', treatments: [{ label: 't', evidence: 'A', cite: 'SRC 1' }] }]
  };
  Object.keys(extra || {}).forEach(function (k) { base[k] = extra[k]; });
  return JSON.stringify(base);
}

console.log('');
console.log('=== CORPUS ADVERSARIAL: LAYERS 1 + 2 ===');
console.log('');

// ── A1: source modified between Layer 1 and Layer 2 ─────────────────────────
(function () {
  console.log('A1: a source file changed between Layer 1 and Layer 2');
  var d = fixtureRepo('race', { 'a.json': artifact('a'), 'b.json': artifact('b') });
  var idx = AI.build({ root: d, pattern: 'assets/data/domains/*.json', outDir: out('race-o') });

  var okBefore = true;
  try { RCS.build({ indexPath: idx.indexPath, corpusRoot: d, outDir: out('race-pre') }); }
  catch (e) { okBefore = false; }
  assert('Layer 2 succeeds while the source is unchanged (the hazard is not pre-existing)', okBefore);

  // Same path, different bytes, AFTER indexing.
  fs.writeFileSync(path.join(d, 'assets/data/domains/b.json'), artifact('b', { title: 'MUTATED' }));

  var err = null;
  try { RCS.build({ indexPath: idx.indexPath, corpusRoot: d, outDir: out('race-o2') }); }
  catch (e) { err = e; }
  assert('Layer 2 THROWS rather than storing new bytes under the old identity', !!err);
  assert('and it is SOURCE_CHANGED, not an incidental crash',
    !!err && /^SOURCE_CHANGED:/.test(err.message), err ? err.message.slice(0, 130) : 'no error');
  assert('naming the artifact that changed', !!err && /b\.json/.test(err.message), err ? err.message.slice(0, 130) : '');
  assert('and quoting both hashes so the mismatch is auditable',
    !!err && /contentHash [0-9a-f]+, now [0-9a-f]+/.test(err.message), err ? err.message.slice(0, 200) : '');
})();

// ── A2: corrupted line in the MIDDLE of a JSONL file ────────────────────────
(function () {
  console.log('A2: a corrupted middle line is never skipped');
  var d = fixtureRepo('mid', { 'a.json': artifact('a'), 'b.json': artifact('b'), 'c.json': artifact('c') });
  var idx = AI.build({ root: d, pattern: 'assets/data/domains/*.json', outDir: out('mid-o') });

  var before = 0;
  AI.streamIndex(idx.indexPath, function () { before++; return true; });
  assert('the index reads cleanly before corruption', before === 3, String(before));

  var lines = fs.readFileSync(idx.indexPath, 'utf8').split('\n').filter(Boolean);
  lines[2] = '{"identity":{"relativePath":"trunc';           // line 3 = second entry
  fs.writeFileSync(idx.indexPath, lines.join('\n') + '\n');

  var err = null, delivered = 0;
  try { AI.streamIndex(idx.indexPath, function () { delivered++; return true; }); } catch (e) { err = e; }
  assert('the reader THROWS instead of silently dropping the entry', !!err);
  assert('the error is STRICT_READ and states invalid JSON',
    !!err && /^STRICT_READ:.*invalid JSON/.test(err.message), err ? err.message.slice(0, 150) : 'no error');
  assert('naming the file and the 1-based line number',
    !!err && /artifact-index\.jsonl:3 /.test(err.message), err ? err.message.slice(0, 150) : '');
  assert('and it stopped AT the bad line rather than after it', delivered === 1, String(delivered));
})();

// ── A3: truncated final line ────────────────────────────────────────────────
(function () {
  console.log('A3: a truncated tail is an error, not a best-effort parse');
  var d = fixtureRepo('trunc', { 'a.json': artifact('a'), 'b.json': artifact('b') });
  var idx = AI.build({ root: d, pattern: 'assets/data/domains/*.json', outDir: out('trunc-o') });

  var content = fs.readFileSync(idx.indexPath, 'utf8');
  assert('the intact file ends with a newline', content.charAt(content.length - 1) === '\n');
  fs.writeFileSync(idx.indexPath, content.slice(0, content.length - 40));

  var err = null;
  try { AI.streamIndex(idx.indexPath, function () { return true; }); } catch (e) { err = e; }
  assert('a truncated final line THROWS', !!err);
  assert('and names truncation specifically, not generic invalid JSON',
    !!err && /STRICT_READ:.*truncated final line/.test(err.message), err ? err.message.slice(0, 150) : 'no error');
})();

// ── A4: missing header and wrong format version ─────────────────────────────
(function () {
  console.log('A4: a missing header or unsupported version is refused');
  var d = fixtureRepo('hdr', { 'a.json': artifact('a') });
  var idx = AI.build({ root: d, pattern: 'assets/data/domains/*.json', outDir: out('hdr-o') });
  var lines = fs.readFileSync(idx.indexPath, 'utf8').split('\n').filter(Boolean);

  var noHeader = path.join(out('hdr-o'), 'no-header.jsonl');
  fs.writeFileSync(noHeader, lines.slice(1).join('\n') + '\n');
  var e1 = null;
  try { AI.streamIndex(noHeader, function () { return true; }); } catch (e) { e1 = e; }
  assert('a file with no header THROWS', !!e1);
  assert('stating the header is missing', !!e1 && /missing header/.test(e1.message), e1 ? e1.message.slice(0, 130) : '');

  var badVer = path.join(out('hdr-o'), 'bad-version.jsonl');
  var h = JSON.parse(lines[0]); h._format = 99;
  fs.writeFileSync(badVer, [JSON.stringify(h)].concat(lines.slice(1)).join('\n') + '\n');
  var e2 = null;
  try { AI.streamIndex(badVer, function () { return true; }); } catch (e) { e2 = e; }
  assert('an unsupported format version THROWS', !!e2);
  assert('naming the version it saw and expected',
    !!e2 && new RegExp('unsupported format version 99, expected ' + AI.INDEX_FORMAT).test(e2.message), e2 ? e2.message.slice(0, 130) : '');
})();

// ── A5: unreadable artifact ─────────────────────────────────────────────────
(function () {
  console.log('A5: an unreadable artifact is indexed, not merely counted');
  var d = fixtureRepo('unread', { 'a.json': artifact('a'), 'gone.json': artifact('gone'), 'c.json': artifact('c') });
  fs.unlinkSync(path.join(d, 'assets/data/domains/gone.json'));   // git still lists it

  var r = AI.build({ root: d, pattern: 'assets/data/domains/*.json', outDir: out('unread-o') });
  assert('the hazard is real: one artifact is unreadable', r.counts.unreadable === 1, String(r.counts.unreadable));
  assert('the scan completed the others rather than aborting', r.counts.indexed === 2, String(r.counts.indexed));

  var paths = [], states = {}, detail = null;
  AI.streamIndex(r.indexPath, function (e) {
    paths.push(e.identity.relativePath);
    states[e.parseState] = (states[e.parseState] || 0) + 1;
    if (e.parseState === 'unreadable') detail = e.parseDetail;
    return true;
  });
  assert('EVERY enumerated path has an index entry, including the unreadable one',
    paths.length === r.counts.enumerated, paths.length + ' entries vs ' + r.counts.enumerated + ' enumerated');
  assert('recorded with parseState "unreadable"', states.unreadable === 1, JSON.stringify(states));
  assert('carrying the underlying error', !!detail, String(detail));
  assert('and with a null contentHash rather than a fabricated one', (function () {
    var ok = true;
    AI.streamIndex(r.indexPath, function (e) { if (e.parseState === 'unreadable' && e.identity.contentHash !== null) ok = false; return true; });
    return ok;
  })());
})();

// ── A6: dirty worktree ──────────────────────────────────────────────────────
(function () {
  console.log('A6: a dirty worktree is declared and distinguishable');
  var d = fixtureRepo('dirty', { 'a.json': artifact('a'), 'b.json': artifact('b') });

  var clean = AI.build({ root: d, pattern: 'assets/data/domains/*.json', outDir: out('dirty-1') });
  assert('a clean worktree reports repositoryDirty false', clean.corpus.repositoryDirty === false,
    String(clean.corpus.repositoryDirty));
  assert('and says the commit identifies the snapshot',
    /commit and sourceSnapshotHash both/.test(clean.snapshotNote), clean.snapshotNote);

  fs.writeFileSync(path.join(d, 'assets/data/domains/b.json'), artifact('b', { title: 'DIRTY' }));
  var dirty = AI.build({ root: d, pattern: 'assets/data/domains/*.json', outDir: out('dirty-2') });

  assert('a dirty worktree reports repositoryDirty true', dirty.corpus.repositoryDirty === true);
  assert('with a dirty entry count', dirty.corpus.repositoryDirtyEntries >= 1, String(dirty.corpus.repositoryDirtyEntries));
  /* THE POINT: identical commit, different content. Only the snapshot hash separates them. */
  assert('the commit is IDENTICAL across both runs',
    clean.corpus.repositoryCommit === dirty.corpus.repositoryCommit);
  assert('but sourceSnapshotHash DIFFERS, so the snapshot is identifiable',
    clean.sourceSnapshotHash !== dirty.sourceSnapshotHash,
    clean.sourceSnapshotHash.slice(0, 12) + ' vs ' + dirty.sourceSnapshotHash.slice(0, 12));
  assert('and the note refuses to call a dirty tree reproducible from its commit',
    /commit does NOT identify this snapshot/.test(dirty.snapshotNote), dirty.snapshotNote);

  /* The snapshot hash must be order-independent — it names content, not the walk. */
  function rev(a) { return a.slice().reverse(); }
  var revd = AI.build({ root: d, pattern: 'assets/data/domains/*.json', outDir: out('dirty-3'), order: rev });
  assert('sourceSnapshotHash is invariant to traversal order',
    revd.sourceSnapshotHash === dirty.sourceSnapshotHash);
})();

// ── A7: multi-byte UTF-8 across a read-chunk boundary ───────────────────────
(function () {
  console.log('A7: multi-byte UTF-8 straddling a 1 MB read boundary');
  /* MEASURED DEFECT, not hypothetical: buf.toString("utf8") per chunk split an em-dash
     across two reads and emitted replacement characters, so a store advertised as
     LOSSLESS silently mangled text. */
  var big = new Array(300001).join('x');
  var files = {};
  for (var i = 0; i < 6; i++) {
    files['u' + i + '.json'] = JSON.stringify({
      domainId: 'u' + i,
      activations: [{ brainNodeId: 'B', state: 'active', treatments: [{
        label: 'L', evidence: 'A', cite: 'C',
        note: big + ' — éü中文 ' + big
      }] }]
    });
  }
  var d = fixtureRepo('utf8', files);
  var idx = AI.build({ root: d, pattern: 'assets/data/domains/*.json', outDir: out('utf8-o') });
  var st = RCS.build({ indexPath: idx.indexPath, corpusRoot: d, outDir: out('utf8-o') });

  assert('the store exceeds one read chunk, so a boundary is crossed',
    fs.statSync(st.storePath).size > (1 << 20), String(fs.statSync(st.storePath).size));

  var mismatched = 0, replacement = 0, checked = 0;
  RCS.streamStore(st.storePath, function (c) {
    checked++;
    if (RCS.hashOf(c.raw) !== c.rawHash) mismatched++;
    if (JSON.stringify(c.raw).indexOf('�') >= 0) replacement++;
    return true;
  });
  assert('entries were read back', checked > 0, String(checked));
  assert('no entry contains a replacement character', replacement === 0, String(replacement));
  assert('every entry re-hashes exactly across the chunk boundary', mismatched === 0, String(mismatched));
})();

// ── A8: per-kind reconciliation equations on real data ──────────────────────
(function () {
  console.log('A8: per-kind reconciliation equations');
  if (!ROOT || !fs.existsSync(ROOT)) {
    console.log('  SKIP external corpus root unavailable; fixture-based adversarial tests remain active');
    skipped++;
    return;
  }
  var idx = AI.build({ root: ROOT, pattern: PATTERN, outDir: out('recon'), limit: SUBSET });
  var st = RCS.build({ indexPath: idx.indexPath, corpusRoot: ROOT, outDir: out('recon') });
  function vsum(v) { return Object.keys(v).reduce(function (n, k) { return n + v[k]; }, 0); }

  assert('resolved-circuit vocabulary sums to the resolved-circuit count',
    vsum(st.vocabularyValues.resolvedCircuitEvidence) === st.byKind['resolved-circuit'],
    vsum(st.vocabularyValues.resolvedCircuitEvidence) + ' vs ' + st.byKind['resolved-circuit']);
  /* THE DEFECT THIS REPLACES: one shared tally summed to 225,894 against 223,342 real
     resolved circuits — 2,552 authored entries silently folded in. */
  assert('authored-circuit sums SEPARATELY to the authored count',
    vsum(st.vocabularyValues.authoredCircuitEvidence) === (st.byKind['authored-circuit'] || 0),
    vsum(st.vocabularyValues.authoredCircuitEvidence) + ' vs ' + (st.byKind['authored-circuit'] || 0));
  assert('treatment vocabulary sums to the treatment count',
    vsum(st.vocabularyValues.treatmentEvidence) === st.byKind.treatment);
  assert('activation vocabulary sums to the activation count',
    vsum(st.vocabularyValues.activationState) === st.byKind.activation);
  assert('rawEntries equals the sum of every per-kind count',
    st.counts.rawEntries === Object.keys(st.byKind).reduce(function (n, k) { return n + st.byKind[k]; }, 0),
    String(st.counts.rawEntries));

  Object.keys(st.citationsByKind).forEach(function (k) {
    assert('citations reconcile for ' + k + ' (' + st.citationsByKind[k].equation + ')',
      st.citationsByKind[k].reconciles, JSON.stringify(st.citationsByKind[k]));
  });
  assert('only treatments carry an applicable citation field',
    st.citationsByKind.treatment.citationApplicable === st.byKind.treatment &&
    st.citationsByKind['resolved-circuit'].citationApplicable === 0);
  /* A kind with no citation field has not LOST a citation. Pooling them reported
     370,874 unknown, of which 346,972 were records with no such field. */
  assert('a kind with no citation field contributes ZERO missing citations',
    st.citationsByKind['resolved-circuit'].unknown === 0 &&
    st.citationsByKind.activation.unknown === 0 &&
    st.citationsByKind['authored-circuit'].unknown === 0);
})();


// ── A9: an untracked file changed in place, same path ───────────────────────
(function () {
  console.log('A9: an untracked file rewritten in place is detected');
  var V = require('../corpus/verify-source-unchanged.js');
  var d = fixtureRepo('untracked', { 'a.json': artifact('a') });
  /* Untracked: created AFTER the commit, never added. */
  var u = path.join(d, 'assets/data/domains/scratch.txt');
  fs.writeFileSync(u, 'ORIGINAL CONTENT');

  var before = V.capture(d, 'assets/data/domains/*.json');
  assert('the untracked file is seen', before.untrackedCount >= 1, String(before.untrackedCount));
  assert('and its BYTES were hashed, not just its path', before.untrackedBytes > 0, String(before.untrackedBytes));

  /* SAME PATH, different bytes. A path-only hash cannot see this. */
  fs.writeFileSync(u, 'MUTATED CONTENT');
  var after = V.capture(d, 'assets/data/domains/*.json');

  assert('the untracked file COUNT is unchanged (a path-only hash would pass here)',
    before.untrackedCount === after.untrackedCount, before.untrackedCount + ' vs ' + after.untrackedCount);
  assert('but untrackedContentHash DIFFERS', before.untrackedContentHash !== after.untrackedContentHash,
    before.untrackedContentHash.slice(0, 12) + ' vs ' + after.untrackedContentHash.slice(0, 12));
  var cmp = V.compare(before, after);
  assert('the comparison reports the corpus as CHANGED', cmp.unchanged === false, cmp.why);
  assert('naming untrackedContent as the component that moved',
    cmp.changed.indexOf('untrackedContent') >= 0, JSON.stringify(cmp.changed));

  /* An untracked DIRECTORY must be expanded, or its contents are invisible. */
  fs.mkdirSync(path.join(d, 'newdir'));
  fs.writeFileSync(path.join(d, 'newdir', 'inner.txt'), 'INNER');
  var withDir = V.capture(d, 'assets/data/domains/*.json');
  assert('--untracked-files=all expands a directory into its files',
    withDir.untrackedCount > after.untrackedCount, after.untrackedCount + ' -> ' + withDir.untrackedCount);
})();

// ── A10: one complete middle record deleted ─────────────────────────────────
(function () {
  console.log('A10: a whole well-formed record deleted from the middle');
  var d = fixtureRepo('del', { 'a.json': artifact('a'), 'b.json': artifact('b'), 'c.json': artifact('c') });
  var idx = AI.build({ root: d, pattern: 'assets/data/domains/*.json', outDir: out('del-o') });

  var n0 = 0;
  AI.streamIndex(idx.indexPath, function () { n0++; return true; });
  assert('the intact index reads 3 entries', n0 === 3, String(n0));

  var lines = fs.readFileSync(idx.indexPath, 'utf8').split('\n').filter(Boolean);
  /* Remove entry 2 entirely: still valid JSONL, still a trailing newline, header and
     trailer both intact. Nothing structural is wrong — only the declared count and the
     entry-stream hash can notice. */
  lines.splice(2, 1);
  fs.writeFileSync(idx.indexPath, lines.join('\n') + '\n');

  var still = fs.readFileSync(idx.indexPath, 'utf8');
  assert('the damaged file is STILL valid JSONL with a trailing newline',
    still.charAt(still.length - 1) === '\n' &&
    still.split('\n').filter(Boolean).every(function (l) { try { JSON.parse(l); return true; } catch (e) { return false; } }));

  var err = null;
  try { AI.streamIndex(idx.indexPath, function () { return true; }); } catch (e) { err = e; }
  assert('the reader THROWS on the missing record', !!err);
  assert('reporting the entryCount mismatch',
    !!err && /trailer declares entryCount 3 but 2 entries were read/.test(err.message),
    err ? err.message.slice(0, 170) : 'no error');
  assert('and saying how many are missing', !!err && /1 record\(s\) missing or added/.test(err.message),
    err ? err.message.slice(0, 170) : '');
})();

// ── A11: the trailer deleted ────────────────────────────────────────────────
(function () {
  console.log('A11: the trailer removed — truncation at a record boundary');
  var d = fixtureRepo('notrail', { 'a.json': artifact('a'), 'b.json': artifact('b') });
  var idx = AI.build({ root: d, pattern: 'assets/data/domains/*.json', outDir: out('notrail-o') });

  var lines = fs.readFileSync(idx.indexPath, 'utf8').split('\n').filter(Boolean);
  var last = JSON.parse(lines[lines.length - 1]);
  assert('the intact file ends with a trailer', last._end === true, JSON.stringify(last).slice(0, 80));

  lines.pop();
  fs.writeFileSync(idx.indexPath, lines.join('\n') + '\n');

  var err = null;
  try { AI.streamIndex(idx.indexPath, function () { return true; }); } catch (e) { err = e; }
  assert('a missing trailer THROWS', !!err);
  assert('naming the trailer specifically', !!err && /has no final trailer/.test(err.message),
    err ? err.message.slice(0, 160) : 'no error');
  assert('and explaining that valid JSONL alone proves nothing',
    !!err && /truncated at a record boundary/.test(err.message), err ? err.message.slice(0, 200) : '');
})();

// ── A12: declared hashes in the trailer altered ─────────────────────────────
(function () {
  console.log('A12: an altered trailer hash is rejected, and the snapshot is recoverable');
  var d = fixtureRepo('tamper', { 'a.json': artifact('a'), 'b.json': artifact('b') });
  var idx = AI.build({ root: d, pattern: 'assets/data/domains/*.json', outDir: out('tamper-o') });
  var lines = fs.readFileSync(idx.indexPath, 'utf8').split('\n').filter(Boolean);

  /* Altering entriesHash must fail, or the trailer is decorative. */
  var t1 = JSON.parse(lines[lines.length - 1]);
  t1.entriesHash = new Array(9).join('deadbeef');
  var f1 = path.join(out('tamper-o'), 'bad-entries.jsonl');
  fs.writeFileSync(f1, lines.slice(0, -1).concat([JSON.stringify(t1)]).join('\n') + '\n');
  var e1 = null;
  try { AI.streamIndex(f1, function () { return true; }); } catch (e) { e1 = e; }
  assert('an altered entriesHash THROWS', !!e1);
  assert('reporting a hash mismatch with both values',
    !!e1 && /entriesHash mismatch. trailer deadbeef/.test(e1.message), e1 ? e1.message.slice(0, 180) : 'no error');

  /* The snapshot hash must be RECOVERABLE from the file, not only from a return value
     that vanishes when the process exits. */
  var read = AI.streamIndex(idx.indexPath, function () { return true; });
  assert('sourceSnapshotHash is recoverable from the persisted trailer',
    read.sourceSnapshotHash === idx.sourceSnapshotHash,
    String(read.sourceSnapshotHash).slice(0, 16) + ' vs ' + String(idx.sourceSnapshotHash).slice(0, 16));
  assert('and it is a real hash, not null', /^[0-9a-f]{64}$/.test(read.sourceSnapshotHash || ''));
})();

// ── A13: unreadable artifact participates in the snapshot hash ──────────────
(function () {
  console.log('A13: an unreadable artifact changes the snapshot hash');
  var files = { 'a.json': artifact('a'), 'b.json': artifact('b'), 'c.json': artifact('c') };
  var d1 = fixtureRepo('unread-hash-1', files);
  var full = AI.build({ root: d1, pattern: 'assets/data/domains/*.json', outDir: out('uh1') });

  var d2 = fixtureRepo('unread-hash-2', files);
  fs.unlinkSync(path.join(d2, 'assets/data/domains/b.json'));   // enumerated, unreadable

  var partial = AI.build({ root: d2, pattern: 'assets/data/domains/*.json', outDir: out('uh2') });
  assert('the hazard is real: one artifact is unreadable', partial.counts.unreadable === 1,
    String(partial.counts.unreadable));
  assert('both runs enumerate the same paths',
    full.counts.enumerated === partial.counts.enumerated,
    full.counts.enumerated + ' vs ' + partial.counts.enumerated);
  /* Omitting unreadable paths made "exists but unreadable" hash identically to "never
     existed". The canonical UNREADABLE marker keeps the path inside the identity. */
  assert('the snapshot hashes DIFFER, so unreadability is visible in identity',
    full.sourceSnapshotHash !== partial.sourceSnapshotHash,
    full.sourceSnapshotHash.slice(0, 12) + ' vs ' + partial.sourceSnapshotHash.slice(0, 12));

  var marked = 0;
  AI.streamIndex(partial.indexPath, function (e) { if (e.parseState === 'unreadable') marked++; return true; });
  assert('and the unreadable artifact is present in the index', marked === 1, String(marked));
})();

// ── A14: no literal NUL bytes in any source file ────────────────────────────
(function () {
  console.log('A14: source files contain no literal NUL bytes');
  /* Scripted edits inserted real NUL characters into JavaScript string literals, which
     is why grep reported these files as binary. A runtime NUL delimiter must be written
     as the two-character escape, never as the byte itself. */
  var roots = [path.join(__dirname, '..', 'corpus'), __dirname];
  var scanned = 0, offenders = [];
  roots.forEach(function (dir) {
    fs.readdirSync(dir).forEach(function (f) {
      if (!/\.(js|mjs|cjs|md)$/.test(f)) return;
      var p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) return;
      scanned++;
      var buf = fs.readFileSync(p);
      if (buf.indexOf(0) >= 0) offenders.push(f + ' (offset ' + buf.indexOf(0) + ')');
    });
  });
  assert('source files were scanned', scanned > 5, String(scanned));
  assert('no source file contains a literal NUL byte', offenders.length === 0, offenders.join(', '));

  /* The escape must still produce a real NUL at runtime — the delimiter has to work. */
  assert('the JS escape yields a genuine NUL delimiter at runtime',
    'a\0b'.length === 3 && 'a\0b'.charCodeAt(1) === 0);
})();

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* best effort */ }

console.log('\n' + (tests - failures) + '/' + tests + ' passed, ' + skipped + ' skipped');
process.exit(failures ? 1 : 0);
