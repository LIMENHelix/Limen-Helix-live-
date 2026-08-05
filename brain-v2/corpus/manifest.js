/**
 * brain-v2/corpus/manifest.js — an incremental, streaming index of the domain corpus.
 *
 * THE CONSTRAINT THAT SHAPES THIS FILE. The corpus is 465,939 domain JSON files
 * (measured 2026-08-02, `git ls-files 'assets/data/domains/*.json' | wc -l` in the FULL
 * repo). Reading them into one array is not an option, and neither is holding their
 * parsed contents. So nothing here ever holds more than one file's contents at a time,
 * and the manifest itself is written to disk as JSONL and streamed back line by line.
 *
 * WHY A MANIFEST AT ALL, rather than walking the tree each run. Three reasons, all
 * operational:
 *
 *   1. INCREMENTAL. A second run should only re-read what changed. The manifest records
 *      size and mtime per file, so an unchanged file is skipped without opening it.
 *   2. STABLE ORDER. Opportunity ranking has to be reproducible, and directory
 *      enumeration order is not guaranteed. The manifest is sorted by path once and
 *      that order is the corpus order forever after.
 *   3. STAGED SCALE. The build plan runs 1,000 -> 10,000 -> 100,000 -> all. A manifest
 *      lets a run take a bounded, deterministic prefix rather than a random sample.
 *
 * READ-ONLY. This module opens the corpus repository for reading and never writes to
 * it. The manifest is written to brain-v2's own state directory.
 */

'use strict';

var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var MANIFEST_VERSION = 1;

/**
 * Enumerate corpus files via git, which is dramatically faster than a recursive walk on
 * a 595,286-file tree and gives tracked files only — untracked scratch never enters.
 */
function enumerate(root, pattern) {
  var out = cp.execFileSync('git', ['ls-files', '--', pattern], {
    cwd: root, maxBuffer: 512 * 1024 * 1024, encoding: 'utf8'
  });
  return out.split('\n').filter(Boolean).sort();
}

/**
 * BUILD or REFRESH the manifest.
 *
 * Writes JSONL: one {path, size, mtimeMs, seq} per line. Returns counts only — never
 * the entries, so the caller cannot accidentally materialise 465,939 objects.
 *
 * `previous` is read first when present, so an unchanged file keeps its recorded stats
 * and is marked unchanged rather than re-stat'ed into a "new" state.
 */
function build(opts) {
  var root = opts.root;
  var pattern = opts.pattern || 'assets/data/domains/*.json';
  var manifestPath = opts.manifestPath;
  var limit = (typeof opts.limit === 'number') ? opts.limit : Infinity;

  if (!fs.existsSync(root)) throw new Error('corpus root does not exist: ' + root);

  var prior = Object.create(null), priorCount = 0;
  if (opts.incremental !== false && fs.existsSync(manifestPath)) {
    streamManifest(manifestPath, function (e) { prior[e.path] = e; priorCount++; });
  }

  var files = enumerate(root, pattern);
  var dir = path.dirname(manifestPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  var tmp = manifestPath + '.tmp';
  var fd = fs.openSync(tmp, 'w');
  var stats = { total: 0, added: 0, changed: 0, unchanged: 0, unreadable: 0, bytes: 0 };

  try {
    fs.writeSync(fd, JSON.stringify({
      _manifest: MANIFEST_VERSION, root: root, pattern: pattern,
      builtEntries: Math.min(files.length, limit === Infinity ? files.length : limit)
    }) + '\n');

    for (var i = 0; i < files.length && stats.total < limit; i++) {
      var rel = files[i], st;
      try { st = fs.statSync(path.join(root, rel)); }
      catch (e) { stats.unreadable++; continue; }

      var p = prior[rel];
      if (p && p.size === st.size && p.mtimeMs === st.mtimeMs) stats.unchanged++;
      else if (p) stats.changed++;
      else stats.added++;

      fs.writeSync(fd, JSON.stringify({
        path: rel, size: st.size, mtimeMs: st.mtimeMs, seq: stats.total
      }) + '\n');
      stats.total++;
      stats.bytes += st.size;
    }
  } finally { fs.closeSync(fd); }

  fs.renameSync(tmp, manifestPath);
  return {
    manifestPath: manifestPath, priorEntries: priorCount, stats: stats,
    corpusFiles: files.length,
    truncated: files.length > stats.total,
    why: stats.total + ' of ' + files.length + ' corpus files indexed' +
         (files.length > stats.total ? ' (limit ' + limit + ' — this is a STAGED subset, not the corpus)' : '') +
         '; ' + stats.added + ' new, ' + stats.changed + ' changed, ' + stats.unchanged + ' unchanged'
  };
}

/**
 * Stream the manifest line by line. `fn(entry, index)` may return false to stop early.
 *
 * Chunked reading with a carry buffer: the file can be tens of megabytes and
 * readFileSync + split would defeat the whole point of streaming.
 */
function streamManifest(manifestPath, fn, opts) {
  opts = opts || {};
  var limit = (typeof opts.limit === 'number') ? opts.limit : Infinity;
  var fd = fs.openSync(manifestPath, 'r');
  var buf = Buffer.alloc(1 << 20);
  var carry = '', n = 0, header = null, stopped = false;

  try {
    for (;;) {
      var read = fs.readSync(fd, buf, 0, buf.length, null);
      if (read <= 0) break;
      carry += buf.toString('utf8', 0, read);
      var lines = carry.split('\n');
      carry = lines.pop();
      for (var i = 0; i < lines.length; i++) {
        if (!lines[i]) continue;
        var e;
        try { e = JSON.parse(lines[i]); } catch (err) { continue; }
        if (e._manifest) { header = e; continue; }
        if (n >= limit) { stopped = true; break; }
        if (fn(e, n) === false) { stopped = true; break; }
        n++;
      }
      if (stopped) break;
    }
    if (!stopped && carry) {
      try {
        var last = JSON.parse(carry);
        if (!last._manifest && n < limit) { fn(last, n); n++; }
      } catch (err) { /* trailing partial line */ }
    }
  } finally { fs.closeSync(fd); }

  return { entries: n, header: header, stoppedEarly: stopped };
}

module.exports = {
  MANIFEST_VERSION: MANIFEST_VERSION,
  build: build,
  streamManifest: streamManifest,
  enumerate: enumerate
};
