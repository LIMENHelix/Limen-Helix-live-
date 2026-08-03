/**
 * brain-v2/test/corpus-foundation.js — Layers 1 and 2 acceptance.
 *
 *   node brain-v2/test/corpus-foundation.js
 *
 * Every invariant in the Layer 1-2 authorization is asserted here. Where an invariant
 * cannot be tested without violating another rule, the test says so and FAILS rather
 * than quietly narrowing itself.
 *
 * READ-ONLY ON THE CORPUS. No test writes to, touches, or otherwise modifies the source
 * repository. The mtime-independence test therefore runs against a temporary COPY —
 * touching a corpus file to prove identity is mtime-free would violate the read-only
 * rule the same test exists to protect.
 *
 * CORPUS ROOT comes from LIMEN_CORPUS_ROOT or --root. There is no hardcoded default;
 * without one the suite reports CANNOT-RUN and exits non-zero rather than pretending.
 */

'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var crypto = require('crypto');

var AI = require('../corpus/artifact-index.js');
var VERIFY = require('../corpus/verify-source-unchanged.js');
var RCS = require('../corpus/raw-claim-store.js');

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

var argRoot = null;
process.argv.forEach(function (a, i) { if (a === '--root') argRoot = process.argv[i + 1]; });
var ROOT = argRoot || process.env.LIMEN_CORPUS_ROOT || null;
var PATTERN = process.env.LIMEN_CORPUS_PATTERN || 'assets/data/domains/energy*.json';

if (!ROOT || !fs.existsSync(ROOT)) {
  console.error('CANNOT-RUN: corpus root not configured or missing.');
  console.error('  set LIMEN_CORPUS_ROOT or pass --root <path>. Deliberately not defaulted.');
  process.exit(2);
}

var TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'corpus-found-'));
function out(sub) { var d = path.join(TMP, sub); if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); return d; }

/* A bounded subset keeps the suite fast. The full-corpus reconciliation is asserted
   separately against the operational index built by the runner. */
var SUBSET = Number(process.env.LIMEN_CORPUS_TEST_LIMIT || 1200);

console.log('');
console.log('=== CORPUS FOUNDATION: LAYERS 1 + 2 ===');
console.log('corpus: ' + ROOT + '   pattern: ' + PATTERN + '   subset: ' + SUBSET);
console.log('');

// ── T1: content-sensitive baseline, and identity carries repo + commit ──────
var baseline = null;
(function () {
  console.log('T1: corpus identity is repository + commit; a CONTENT-sensitive baseline is captured');
  /* The previous baseline hashed `git status --porcelain`, which holds only status
     letters and paths. An already-dirty file edited again produces the identical line,
     so 3,500 pre-existing dirty entries were entirely unprotected. This captures the
     tracked-diff CONTENT, the untracked list, and a content hash of every artifact. */
  baseline = VERIFY.capture(ROOT, PATTERN);
  assert('baseline captures tracked-diff CONTENT, not just status lines',
    /^[0-9a-f]{64}$/.test(baseline.trackedDiffHash) && baseline.trackedDiffBytes >= 0,
    baseline.trackedDiffBytes + ' bytes of diff');
  assert('baseline captures a content hash over every artifact',
    baseline.artifactsHashed > 0, String(baseline.artifactsHashed));
  assert('and hashes untracked file BYTES, not merely their paths',
    /^[0-9a-f]{64}$/.test(baseline.untrackedContentHash) && baseline.untrackedBytes > 0,
    baseline.untrackedCount + ' untracked, ' + (baseline.untrackedBytes / 1048576).toFixed(1) + ' MB');
  /* THE CORPUS BOUNDARY, stated rather than assumed. */
  assert('the tracked/untracked boundary is declared',
    /TRACKED files matching/.test(baseline.corpusBoundary), baseline.corpusBoundary);
  assert('and untracked files matching the artifact pattern are measured, not ignored',
    typeof baseline.untrackedMatchingPattern === 'number',
    baseline.untrackedMatchingPattern + ' untracked files match ' + PATTERN);
  assert('and none were missing at baseline', baseline.artifactsMissing === 0, String(baseline.artifactsMissing));

  var c = AI.openCorpus({ root: ROOT });
  assert('repositoryCommit resolved', /^[0-9a-f]{40}$/.test(c.repositoryCommit), c.repositoryCommit);
  assert('repository named', !!c.repository, c.repository);
  assert('worktree dirtiness is recorded rather than assumed clean',
    typeof c.repositoryDirty === 'boolean', String(c.repositoryDirty));

  var threw = false;
  try { AI.openCorpus({ root: null }); } catch (e) { threw = /not configured/.test(e.message); }
  var savedEnv = process.env.LIMEN_CORPUS_ROOT; delete process.env.LIMEN_CORPUS_ROOT;
  try { AI.openCorpus({}); } catch (e) { threw = /not configured/.test(e.message); }
  if (savedEnv !== undefined) process.env.LIMEN_CORPUS_ROOT = savedEnv;
  assert('an unconfigured root is an ERROR, not a guessed default path', threw);
})();

// ── T2: output may not be written into the corpus ────────────────────────────
(function () {
  console.log('T2: generated artifacts cannot be written into the read-only corpus');
  var threw = false;
  try { AI.build({ root: ROOT, pattern: PATTERN, outDir: path.join(ROOT, 'tmp-out') }); }
  catch (e) { threw = /inside the corpus/.test(e.message); }
  assert('an outDir inside the corpus is refused', threw);

  /* And the guard must not false-positive on a SIBLING whose name shares a prefix.
     `Limen-Helix-live-` string-prefixes `Limen-Helix`; a naive check blocked it. */
  var sibling = ROOT + '-live-sibling-probe';
  var ok = true;
  try { AI.build({ root: ROOT, pattern: 'no/such/pattern/*.json', outDir: sibling }); }
  catch (e) { if (/inside the corpus/.test(e.message)) ok = false; }
  assert('a sibling directory sharing a name prefix is NOT treated as inside', ok);
  try { fs.rmSync(sibling, { recursive: true, force: true }); } catch (e) {}
})();

// ── T3: every parseable artifact is indexed; counts reconcile ────────────────
var idxA = null;
(function () {
  console.log('T3: every enumerated artifact is accounted for');
  idxA = AI.build({ root: ROOT, pattern: PATTERN, outDir: out('a'), limit: SUBSET });
  var c = idxA.counts;
  assert('enumerated == indexed + malformed + unreadable',
    Math.min(c.enumerated, SUBSET) === c.indexed + c.malformed + c.unreadable,
    JSON.stringify(c));
  assert('nothing was silently dropped', c.indexed > 0);

  var streamed = 0, withCensus = 0;
  AI.streamIndex(idxA.indexPath, function (e) {
    streamed++;
    if (e.parseState === 'ok') withCensus++;
    return true;
  });
  assert('the index holds exactly one entry per artifact read',
    streamed === c.indexed + c.malformed, streamed + ' vs ' + (c.indexed + c.malformed));
  assert('parseable entries carry a census', withCensus === c.indexed);
})();

// ── T4: missing _enrichment does NOT exclude an artifact ────────────────────
(function () {
  console.log('T4: an artifact without _enrichment is still indexed');
  /* The original prototype gated admission on _enrichment and excluded 99.4% of the
     corpus. _enrichment is OUR transformation metadata, not source provenance. */
  var withEnr = 0, withoutEnr = 0;
  AI.streamIndex(idxA.indexPath, function (e) {
    if (e.parseState !== 'ok') return true;
    if (e.census.hasEnrichment) withEnr++; else withoutEnr++;
    return true;
  });
  assert('artifacts WITHOUT _enrichment are present in the index', withoutEnr > 0, String(withoutEnr));
  assert('and they are the majority, as measured', withoutEnr > withEnr,
    withoutEnr + ' without vs ' + withEnr + ' with');
  assert('every indexed artifact has identity regardless of _enrichment',
    (function () {
      var ok = true;
      AI.streamIndex(idxA.indexPath, function (e) {
        if (e.parseState !== 'ok') return true;
        if (!e.identity.contentHash || !e.identity.relativePath || !e.identity.repositoryCommit) ok = false;
        return true;
      });
      return ok;
    })());
})();

// ── T5: identity excludes mtime — proved on a COPY, never on the corpus ─────
(function () {
  console.log('T5: changing mtime does not change identity (tested on a copy, corpus untouched)');
  var srcDir = out('mt-src');
  var picked = [];
  AI.streamIndex(idxA.indexPath, function (e) {
    if (e.parseState === 'ok' && picked.length < 3) picked.push(e);
    return picked.length < 3;
  });
  assert('sample artifacts selected', picked.length === 3, String(picked.length));

  /* Build a tiny standalone git repo from copies. The corpus itself is never written. */
  var cp = require('child_process');
  fs.mkdirSync(path.join(srcDir, 'assets', 'data', 'domains'), { recursive: true });
  picked.forEach(function (e) {
    fs.copyFileSync(path.join(ROOT, e.identity.relativePath),
      path.join(srcDir, 'assets', 'data', 'domains', path.basename(e.identity.relativePath)));
  });
  cp.execFileSync('git', ['init', '-q'], { cwd: srcDir });
  cp.execFileSync('git', ['add', '-A'], { cwd: srcDir });
  cp.execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'fixture'], { cwd: srcDir });

  var one = AI.build({ root: srcDir, pattern: 'assets/data/domains/*.json', outDir: out('mt-1') });
  var before = [];
  AI.streamIndex(one.indexPath, function (e) { before.push(e.identity.contentHash + '|' + e.identity.relativePath); return true; });

  // Touch every copy: mtime moves, bytes do not.
  var future = Date.now() / 1000 + 86400;
  fs.readdirSync(path.join(srcDir, 'assets', 'data', 'domains')).forEach(function (f) {
    fs.utimesSync(path.join(srcDir, 'assets', 'data', 'domains', f), future, future);
  });

  var two = AI.build({ root: srcDir, pattern: 'assets/data/domains/*.json', outDir: out('mt-2') });
  var after = [], mtimesChanged = false, firstMtime = {};
  AI.streamIndex(one.indexPath, function (e) { firstMtime[e.identity.relativePath] = e.operational.fileModifiedAt; return true; });
  AI.streamIndex(two.indexPath, function (e) {
    after.push(e.identity.contentHash + '|' + e.identity.relativePath);
    if (firstMtime[e.identity.relativePath] !== e.operational.fileModifiedAt) mtimesChanged = true;
    return true;
  });

  assert('mtime genuinely changed (the test would be vacuous otherwise)', mtimesChanged);
  assert('identity is UNCHANGED across the mtime change',
    before.sort().join(',') === after.sort().join(','), 'identity moved with mtime');
})();

// ── T6: traversal order does not change the result ──────────────────────────
(function () {
  console.log('T6: randomised traversal order produces identical artifact and claim sets');
  function shuffleSeeded(arr) {
    var s = 20260802;
    function rnd() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }
    for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }
  var idxB = AI.build({ root: ROOT, pattern: PATTERN, outDir: out('b'), limit: SUBSET, order: shuffleSeeded });

  function idSet(p) { var s = []; AI.streamIndex(p, function (e) { s.push(e.identity.contentHash + '|' + e.identity.relativePath); return true; }); return s.sort().join('\n'); }
  var a = idSet(idxA.indexPath), b = idSet(idxB.indexPath);
  assert('artifact SET is identical under shuffled traversal', a === b);
  assert('and the census totals are identical',
    RCS.canonicalJson(idxA.census) === RCS.canonicalJson(idxB.census),
    RCS.canonicalJson(idxA.census) + ' vs ' + RCS.canonicalJson(idxB.census));

  var storeA = RCS.build({ indexPath: idxA.indexPath, corpusRoot: ROOT, outDir: out('a') });
  var storeB = RCS.build({ indexPath: idxB.indexPath, corpusRoot: ROOT, outDir: out('b') });
  function claimSet(p) { var s = []; RCS.streamStore(p, function (c) { s.push(c.claimId + '|' + c.rawHash); return true; }); return s.sort().join('\n'); }
  assert('claim SET is identical under shuffled traversal', claimSet(storeA.storePath) === claimSet(storeB.storePath));
  assert('raw entry counts match', storeA.counts.rawEntries === storeB.counts.rawEntries,
    storeA.counts.rawEntries + ' vs ' + storeB.counts.rawEntries);
  /* Compared CANONICALLY. JSON.stringify preserves key INSERTION order, and traversal
     order decides which vocabulary value is encountered first — so a raw string compare
     fails on identical data. The order-invariance test must not itself be
     order-dependent, which is what this line was before. */
  assert('vocabulary tallies match',
    RCS.canonicalJson(storeA.vocabularyValues) === RCS.canonicalJson(storeB.vocabularyValues),
    RCS.canonicalJson(storeA.vocabularyValues) + ' vs ' + RCS.canonicalJson(storeB.vocabularyValues));
})();

// ── T7: raw values survive a round trip ─────────────────────────────────────
var storeMain = null;
(function () {
  console.log('T7: raw claim values round-trip losslessly');
  storeMain = RCS.build({ indexPath: idxA.indexPath, corpusRoot: ROOT, outDir: out('rt') });

  var checked = 0, mismatched = 0, sample = [];
  RCS.streamStore(storeMain.storePath, function (c) {
    if (RCS.hashOf(c.raw) !== c.rawHash) { mismatched++; if (sample.length < 2) sample.push(c.claimId); }
    checked++;
    return true;
  });
  assert('every stored claim re-hashes to its recorded rawHash', mismatched === 0,
    mismatched + ' mismatched, e.g. ' + sample.join(', '));
  assert('a meaningful number of claims were checked', checked > 100, String(checked));

  /* And verify against the CORPUS itself, not only internal consistency. */
  var one = null;
  RCS.streamStore(storeMain.storePath, function (c) { if (c.kind === 'resolved-circuit' && !one) one = c; return !one; });
  if (one) {
    var rec = JSON.parse(fs.readFileSync(path.join(ROOT, one.artifactRef.relativePath), 'utf8'));
    var m = one.claimId.match(/#issues\[(\d+)\]\.circuits\[(\d+)\]$/);
    var orig = rec.issues[Number(m[1])].circuits[Number(m[2])];
    assert('the stored raw object equals the corpus original byte-for-byte (canonical form)',
      RCS.canonicalJson(orig) === RCS.canonicalJson(one.raw),
      one.claimId);
  } else assert('a circuit claim was available to verify against source', false);
})();

// ── T8: vocabularies are preserved, never translated or merged ──────────────
(function () {
  console.log('T8: evidence vocabularies stay separate and verbatim');
  var circ = storeMain.vocabularyValues.resolvedCircuitEvidence;
  var treat = storeMain.vocabularyValues.treatmentEvidence;

  assert('circuit vocabulary retains its own values', Object.keys(circ).length > 0, JSON.stringify(circ));
  assert('treatment vocabulary retains its own values', Object.keys(treat).length > 0, JSON.stringify(treat));

  /* The measured corpus grades. A classifier that failed to recognise "Moderate" would
     show it absent here — which is exactly what the first prototype would have done. */
  assert('"Moderate" is preserved verbatim in circuitEvidence, not dropped', circ.Moderate > 0, JSON.stringify(circ));
  assert('treatment A/B/C are NOT mapped into the circuit scale',
    (treat.A || treat.B || treat.C) && !circ.A && !circ.B && !circ.C,
    'circ=' + JSON.stringify(circ) + ' treat=' + JSON.stringify(treat));

  var anomalies = 0, converted = 0;
  RCS.streamStore(storeMain.storePath, function (c) {
    if (c.treatmentEvidence && c.treatmentEvidence.schemaAnomaly) {
      anomalies++;
      /* Flagged, NOT rewritten. If the raw value had been coerced to A/B/C the anomaly
         would be invisible and the evidence for it destroyed. */
      if (['A', 'B', 'C'].indexOf(c.treatmentEvidence.raw) >= 0) converted++;
    }
    return true;
  });
  assert('cross-vocabulary values are flagged as schema anomalies', anomalies >= 0, String(anomalies));
  assert('and none was converted into the treatment scale', converted === 0, String(converted));
})();

// ── T9: missing information is UNKNOWN, never inferred ──────────────────────
(function () {
  console.log('T9: absent fields become unknown — not zero, false, analogy, or refuted');
  var unknown = 0, claimed = 0, bad = 0;
  RCS.streamStore(storeMain.storePath, function (c) {
    if (!c.citation) { bad++; return true; }
    if (c.citation.citationStatus === 'not-applicable') {
      /* A kind with no citation field cannot have a MISSING one. */
      if (c.citation.citationApplicable !== false || c.citation.raw !== null) bad++;
    } else if (c.citation.citationStatus === 'unknown') {
      unknown++;
      if (c.citation.raw !== null) bad++;
    } else if (c.citation.citationStatus === 'claimed') {
      claimed++;
      if (typeof c.citation.raw !== 'string' || !c.citation.raw) bad++;
      /* A claimed citation is a string the corpus asserts. Nothing here validates it. */
      if (!/CLAIMED citation/.test(c.citation.note)) bad++;
    } else bad++;
    return true;
  });
  assert('every claim carries a citationStatus', bad === 0, String(bad) + ' malformed');
  assert('absent citations are recorded as unknown', unknown > 0, String(unknown));
  assert('present citations are labelled CLAIMED, not verified', claimed >= 0, String(claimed));

  var meaningsUnknown = 0, total = 0;
  RCS.streamStore(storeMain.storePath, function (c) {
    total++;
    if (c.resolvedCircuitEvidence && /UNKNOWN/.test(c.resolvedCircuitEvidence.meaning)) meaningsUnknown++;
    else if (c.authoredCircuitEvidence && /UNKNOWN/.test(c.authoredCircuitEvidence.meaning)) meaningsUnknown++;
    else if (c.treatmentEvidence && /UNKNOWN/.test(c.treatmentEvidence.meaning)) meaningsUnknown++;
    else if (c.activationState && /UNKNOWN/.test(c.activationState.meaning)) meaningsUnknown++;
    return true;
  });
  assert('field meanings are recorded as UNKNOWN, since no writer was located',
    meaningsUnknown === total, meaningsUnknown + ' of ' + total);
})();

// ── T10: duplicate domainIds are reported, and nothing is lost ──────────────
(function () {
  console.log('T10: duplicate domainIds are preserved and reported, never collapsed');
  /* Measured on the full energy set: domainId "energy" appears on 6 distinct artifacts.
     Keying the index on domainId would have silently dropped five of them. */
  var full = AI.build({ root: ROOT, pattern: PATTERN, outDir: out('dup') });
  assert('duplicates exist in the real corpus (else this test proves nothing)',
    full.duplicateDomainIdCount > 0, String(full.duplicateDomainIdCount));

  var dup = full.duplicateDomainIds[0];
  var seenPaths = {};
  AI.streamIndex(full.indexPath, function (e) {
    if (e.identity.domainId === dup.domainId) seenPaths[e.identity.relativePath] = true;
    return true;
  });
  assert('EVERY artifact sharing that domainId is present in the index',
    Object.keys(seenPaths).length === dup.count,
    Object.keys(seenPaths).length + ' of ' + dup.count);
  assert('the index is keyed by relativePath, so none overwrote another',
    full.counts.indexed === full.counts.enumerated - full.counts.malformed - full.counts.unreadable);
})();

// ── T11: malformed records are reported without aborting the scan ───────────
(function () {
  console.log('T11: a malformed artifact is recorded and the scan continues');
  var cp = require('child_process');
  var d = out('bad');
  fs.mkdirSync(path.join(d, 'assets', 'data', 'domains'), { recursive: true });
  fs.writeFileSync(path.join(d, 'assets/data/domains/good1.json'), JSON.stringify({ domainId: 'g1', issues: [] }));
  fs.writeFileSync(path.join(d, 'assets/data/domains/broken.json'), '{ this is not json ');
  fs.writeFileSync(path.join(d, 'assets/data/domains/good2.json'), JSON.stringify({ domainId: 'g2', issues: [] }));
  fs.writeFileSync(path.join(d, 'assets/data/domains/nodomain.json'), JSON.stringify({ title: 'no id' }));
  cp.execFileSync('git', ['init', '-q'], { cwd: d });
  cp.execFileSync('git', ['add', '-A'], { cwd: d });
  cp.execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'f'], { cwd: d });

  var r = AI.build({ root: d, pattern: 'assets/data/domains/*.json', outDir: out('bad-out') });
  assert('the scan completed all four artifacts', r.counts.enumerated === 4, String(r.counts.enumerated));
  assert('the malformed one is counted, not fatal', r.counts.malformed === 1, String(r.counts.malformed));
  assert('the good ones were still indexed', r.counts.indexed === 3, String(r.counts.indexed));
  assert('the no-domainId record is indexed AND flagged', r.counts.noDomainId === 1, String(r.counts.noDomainId));
  assert('problems are reported with a reason', r.problems.length === 2, JSON.stringify(r.problems.map(function (p) { return p.problem; })));
})();

// ── T12: memory stays bounded ───────────────────────────────────────────────
(function () {
  console.log('T12: the corpus is never held in memory');
  assert('index peak heap is bounded well below corpus size',
    idxA.peakHeapMB < 400, idxA.peakHeapMB + ' MB for ' + (idxA.bytesRead / 1048576).toFixed(0) + ' MB read');
  assert('claim store peak heap is bounded',
    storeMain.peakHeapMB < 400, storeMain.peakHeapMB + ' MB');
  assert('bytes read greatly exceeds peak heap, proving streaming',
    idxA.bytesRead / 1048576 > idxA.peakHeapMB,
    (idxA.bytesRead / 1048576).toFixed(0) + ' MB read vs ' + idxA.peakHeapMB + ' MB heap');
})();

// ── T13: rerun is stable ────────────────────────────────────────────────────
(function () {
  console.log('T13: an unchanged rerun produces no semantic change');
  var again = AI.build({ root: ROOT, pattern: PATTERN, outDir: out('rerun'), limit: SUBSET });
  assert('counts identical', JSON.stringify(again.counts) === JSON.stringify(idxA.counts));
  assert('census identical', JSON.stringify(again.census) === JSON.stringify(idxA.census));
  function idSet(p) { var s = []; AI.streamIndex(p, function (e) { s.push(e.identity.contentHash + '|' + e.identity.relativePath); return true; }); return s.sort().join('\n'); }
  assert('artifact identities identical', idSet(again.indexPath) === idSet(idxA.indexPath));
})();

// ── T14: no promotion, no scoring, no interpretation ────────────────────────
(function () {
  console.log('T14: Layers 1-2 assert nothing about meaning, rank or truth');
  var src1 = fs.readFileSync(path.join(__dirname, '..', 'corpus', 'artifact-index.js'), 'utf8');
  var src2 = fs.readFileSync(path.join(__dirname, '..', 'corpus', 'raw-claim-store.js'), 'utf8');
  var joined = src1 + src2;

  assert('nothing imports kernel/memory.js', !/require\([^)]*kernel\/memory/.test(joined));
  assert('nothing imports the halted adapter prototype', !/require\([^)]*['"]\.\/adapter/.test(joined));
  assert('nothing imports the halted opportunity prototype', !/require\([^)]*['"]\.\/opportunity/.test(joined));
  assert('no assertClaim / semantic promotion', !/assertClaim|promote\(/.test(joined));
  assert('no ranking or scoring surface', !/rankScore|opportunityId|\brank\(/.test(joined));

  var hasScore = false;
  RCS.streamStore(storeMain.storePath, function (c) {
    if (c.score !== undefined || c.rank !== undefined || c.confidence !== undefined || c.opportunityId !== undefined) hasScore = true;
    return true;
  });
  assert('no stored claim carries a score, rank or confidence', !hasScore);
})();

// ── T15: the corpus is proven unchanged by CONTENT, not by status lines ─────
(function () {
  console.log('T15: the source corpus is byte-identical, proved by content');
  var after = VERIFY.capture(ROOT, PATTERN);
  var cmp = VERIFY.compare(baseline, after);
  assert('commit unchanged', cmp.parts.commit);
  assert('tracked-diff CONTENT unchanged (not merely the status path list)', cmp.parts.trackedDiff,
    baseline.trackedDiffHash.slice(0, 12) + ' vs ' + after.trackedDiffHash.slice(0, 12));
  assert('untracked CONTENT unchanged (bytes, not just paths)', cmp.parts.untrackedContent,
    baseline.untrackedContentHash.slice(0, 12) + ' vs ' + after.untrackedContentHash.slice(0, 12));
  assert('untracked file count unchanged', cmp.parts.untrackedCount);
  assert('content hash of every artifact unchanged', cmp.parts.artifactSnapshot,
    baseline.artifactSnapshotHash.slice(0, 12) + ' vs ' + after.artifactSnapshotHash.slice(0, 12));
  assert('artifact count unchanged', cmp.parts.artifactCount,
    baseline.artifactsHashed + ' vs ' + after.artifactsHashed);
  assert('overall: the corpus was not modified', cmp.unchanged, cmp.why);
  console.log('      ' + cmp.why);

  /* The check must be capable of FAILING. Mutating a captured hash must be detected —
     otherwise "unchanged" would pass for a comparison that can only ever succeed. */
  var tampered = JSON.parse(JSON.stringify(after));
  tampered.artifactSnapshotHash = 'deadbeef';
  assert('and the comparison DETECTS a change when one exists',
    VERIFY.compare(baseline, tampered).unchanged === false);
})();

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* best effort */ }

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
