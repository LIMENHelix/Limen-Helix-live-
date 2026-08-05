/**
 * brain-v2/corpus/verify-source-unchanged.js — CONTENT-SENSITIVE preservation proof.
 *
 * TWO EARLIER VERSIONS OF THIS PROOF WERE NOT PROOFS.
 *
 *   v1 hashed `git status --porcelain`. That is status letters and paths only. A file
 *      already modified before the run could be modified again during it — different
 *      bytes, identical " M path" line, identical hash. With 3,500 pre-existing dirty
 *      entries that left 3,500 files entirely unprotected.
 *
 *   v2 hashed the tracked diff CONTENT and every artifact's bytes, but hashed only the
 *      untracked file NAMES. An untracked file could be rewritten in place, keeping its
 *      path, and the hash would not move.
 *
 * This version hashes BYTES for every component:
 *
 *   trackedDiffHash       sha256 of `git diff HEAD` as a BUFFER, never decoded first.
 *                         Decoding to UTF-8 replaces invalid sequences, so two genuinely
 *                         different binary diffs could hash identically.
 *   untrackedContentHash  sha256 folded over (path, sha256(bytes)) for every untracked
 *                         file from `--untracked-files=all`, which expands untracked
 *                         DIRECTORIES into their individual files. Without `=all` a
 *                         directory appears as one entry and its contents are unseen.
 *   artifactSnapshotHash  sha256 folded over (path, sha256(bytes)) for every artifact
 *                         matching the pattern, in sorted order.
 *
 * THE CORPUS BOUNDARY IS DECLARED, NOT ASSUMED. `git ls-files` returns TRACKED files
 * only. Untracked files matching the artifact pattern are counted and reported
 * separately, so "corpus" never silently means "the tracked subset".
 *
 * Read-only: git plumbing and file reads. Nothing here writes to the corpus.
 */

'use strict';

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var cp = require('child_process');

function shaBuf(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

/**
 * Fold (path, contentHash) pairs in sorted order — order-independent by construction.
 * An unreadable path folds a canonical marker rather than being skipped, so a file that
 * disappears changes the hash instead of silently shrinking the set.
 */
function foldPaths(root, relPaths) {
  var digest = crypto.createHash('sha256');
  var hashed = 0, missing = 0, bytes = 0;
  relPaths.slice().sort().forEach(function (rel) {
    var buf;
    try { buf = fs.readFileSync(path.join(root, rel)); }
    catch (e) { missing++; digest.update(rel).update('\0UNREADABLE\n'); return; }
    bytes += buf.length;
    digest.update(rel).update('\0').update(shaBuf(buf)).update('\n');
    hashed++;
  });
  return { hash: digest.digest('hex'), hashed: hashed, missing: missing, bytes: bytes };
}

/** Convert a git pathspec glob to a regex, for measuring the tracked/untracked boundary. */
function patternToRegExp(pattern) {
  var esc = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  esc = esc.replace(/\*/g, '[^/]*');
  return new RegExp('^' + esc + '$');
}

/**
 * Capture a content-sensitive fingerprint.
 *
 * `pattern` scopes the artifact set. Hashing all 595,286 files would cost minutes for no
 * extra assurance about the subset actually being read.
 */
function capture(root, pattern) {
  if (!fs.existsSync(root)) throw new Error('corpus root does not exist: ' + root);
  function git(args, opts) {
    return cp.execFileSync('git', args,
      Object.assign({ cwd: root, maxBuffer: 1024 * 1024 * 1024 }, opts || {}));
  }

  /* BUFFER, not string — see the header on why decoding first would let diffs collide. */
  var trackedDiff = git(['diff', 'HEAD']);

  var untrackedDirEntries = git(['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' })
    .split('\n').filter(Boolean);

  /* --untracked-files=all expands directories into files. */
  var untrackedAll = git(['status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' })
    .split('\n').filter(Boolean)
    .filter(function (l) { return l.slice(0, 2) === '??'; })
    .map(function (l) { return l.slice(3).replace(/^"|"$/g, ''); });

  var untrackedFold = foldPaths(root, untrackedAll);

  var tracked = git(['ls-files', '--', pattern], { encoding: 'utf8' }).split('\n').filter(Boolean);
  var artifactFold = foldPaths(root, tracked);

  /* THE BOUNDARY, MEASURED rather than assumed away: how many untracked files would
     have matched the artifact pattern? A non-zero count means "corpus = tracked" is a
     choice that has to be stated, not an accident of tooling. */
  var re = patternToRegExp(pattern);
  var untrackedMatching = untrackedAll.filter(function (p) { return re.test(p); });

  return {
    root: root, pattern: pattern,
    commit: git(['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),

    trackedDiffHash: shaBuf(trackedDiff),
    trackedDiffBytes: trackedDiff.length,

    untrackedContentHash: untrackedFold.hash,
    untrackedCount: untrackedAll.length,
    untrackedBytes: untrackedFold.bytes,
    untrackedUnreadable: untrackedFold.missing,
    untrackedDirEntryCount: untrackedDirEntries.length,

    artifactSnapshotHash: artifactFold.hash,
    artifactsHashed: artifactFold.hashed,
    artifactsMissing: artifactFold.missing,
    artifactBytes: artifactFold.bytes,

    corpusBoundary: 'TRACKED files matching ' + pattern + ' (git ls-files). Untracked files ' +
      'matching the same pattern are NOT indexed and are reported separately.',
    untrackedMatchingPattern: untrackedMatching.length,
    untrackedMatchingExamples: untrackedMatching.slice(0, 5)
  };
}

/** Compare two captures. Reports which components moved. */
function compare(before, after) {
  var parts = {
    commit: before.commit === after.commit,
    trackedDiff: before.trackedDiffHash === after.trackedDiffHash,
    untrackedContent: before.untrackedContentHash === after.untrackedContentHash,
    untrackedCount: before.untrackedCount === after.untrackedCount,
    artifactSnapshot: before.artifactSnapshotHash === after.artifactSnapshotHash,
    artifactCount: before.artifactsHashed === after.artifactsHashed
  };
  var changed = Object.keys(parts).filter(function (k) { return !parts[k]; });
  return {
    unchanged: changed.length === 0,
    parts: parts,
    changed: changed,
    why: changed.length === 0
      ? 'corpus unchanged: commit, tracked-diff CONTENT, untracked CONTENT (' +
        after.untrackedCount + ' files, ' + (after.untrackedBytes / 1048576).toFixed(1) +
        ' MB), and the content hash of all ' + after.artifactsHashed + ' artifacts all match'
      : 'CORPUS CHANGED in: ' + changed.join(', ')
  };
}

module.exports = { capture: capture, compare: compare, shaBuf: shaBuf, foldPaths: foldPaths, patternToRegExp: patternToRegExp };
