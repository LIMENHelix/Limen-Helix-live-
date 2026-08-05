/**
 * brain-v2/corpus/artifact-index.js — LAYER 1. Semantics-neutral index of every artifact.
 *
 * AUTHORIZED SCOPE: an index and a census. Nothing here interprets a field, grades a
 * claim, ranks anything, or writes to semantic memory. If a future edit needs to know
 * what a field MEANS in order to work, that edit does not belong in this file.
 *
 * ═════════════════════════════════════════════════════════════════════════════════
 * IDENTITY, AND WHAT IS DELIBERATELY EXCLUDED FROM IT
 *
 *   repository        which repo the artifact came from
 *   repositoryCommit  the commit it was read at — without this an index is unreproducible
 *   relativePath      unique within a commit; the PRIMARY KEY here
 *   contentHash       sha256 of the exact bytes
 *   domainId          the record's own declared id, which is NOT assumed unique
 *   byteSize          exact bytes read
 *
 * `fileModifiedAt` is recorded as OPERATIONAL METADATA ONLY. It never enters identity,
 * never gates admission, and never stands for an observation time. A checkout, a clone
 * or a touch changes mtime while changing nothing about the artifact — an identity that
 * moved with it would report phantom change on every fresh clone.
 *
 * DOMAINID IS NOT ASSUMED UNIQUE. It is measured. Where two artifacts declare the same
 * domainId, BOTH are indexed and the collision is reported. Keying on domainId would
 * silently drop one of them, and a silent drop is the failure mode this layer exists to
 * make impossible.
 * ═════════════════════════════════════════════════════════════════════════════════
 *
 * READ-ONLY ON THE SOURCE. The corpus is opened for reading and never written to.
 * Output goes to a caller-configured directory that must sit outside the corpus.
 *
 * NO HARDCODED CORPUS PATH. The root arrives via `opts.root` or `LIMEN_CORPUS_ROOT`,
 * and its absence is an error rather than a guess at somebody's drive layout.
 */

'use strict';

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var cp = require('child_process');

var INDEX_FORMAT = 2;   // 2 = mandatory trailer with entryCount + entriesHash + sourceSnapshotHash

/**
 * Is `child` genuinely inside `parent`? Compared by RESOLVED SEGMENTS, not by string
 * prefix. A prefix test reports `C:/x/Limen-Helix-live-` as inside `C:/x/Limen-Helix`
 * because the name is a prefix of the sibling's name — which it is not. That false
 * positive blocked the real output directory on the first run.
 */
function isInside(parent, child) {
  var rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}


/** Resolve and verify the corpus, read-only. Throws rather than guessing a path. */
function openCorpus(opts) {
  opts = opts || {};
  var root = opts.root || process.env.LIMEN_CORPUS_ROOT || null;
  if (!root) {
    throw new Error('corpus root not configured. Pass opts.root or set LIMEN_CORPUS_ROOT. ' +
      'This is deliberately not defaulted — a hardcoded path is machine-specific and would ' +
      'silently index the wrong tree on any other machine.');
  }
  if (!fs.existsSync(root)) throw new Error('corpus root does not exist: ' + root);
  var commit, repository;
  try {
    commit = cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    repository = cp.execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' }).trim();
  } catch (e) {
    throw new Error('corpus root is not a git repository (' + root + '): ' + e.message +
      '. repositoryCommit is required for a reproducible index.');
  }
  /* A COMMIT DOES NOT IDENTIFY A DIRTY WORKTREE. The measured corpus had 3,500 dirty
     entries at HEAD 57b3144a; describing that snapshot by commit alone would claim a
     reproducibility it does not have. The flag is recorded, and the aggregate
     sourceSnapshotHash below is what actually identifies what was read. */
  var dirty = null, dirtyEntries = 0;
  try {
    var porcelain = cp.execFileSync('git', ['status', '--porcelain'], { cwd: root, maxBuffer: 512 * 1024 * 1024, encoding: 'utf8' });
    dirtyEntries = porcelain.split('\n').filter(Boolean).length;
    dirty = dirtyEntries > 0;
  } catch (e) { dirty = null; }

  return {
    root: root, repository: path.basename(repository), repositoryPath: repository,
    repositoryCommit: commit, repositoryDirty: dirty, repositoryDirtyEntries: dirtyEntries
  };
}

/** Enumerate tracked artifacts. git ls-files is read-only and excludes untracked scratch. */
function enumerate(corpus, pattern) {
  var out = cp.execFileSync('git', ['ls-files', '--', pattern], {
    cwd: corpus.root, maxBuffer: 512 * 1024 * 1024, encoding: 'utf8'
  });
  return out.split('\n').filter(Boolean);
}

/**
 * CENSUS of an artifact — counts only, no interpretation.
 *
 * Every counter is a structural fact ("how many objects are in this array"), never a
 * judgement ("how many are graded"). Grading requires knowing what the vocabulary means,
 * which is UNKNOWN and out of scope for this layer.
 */
function censusOf(rec) {
  var issues = Array.isArray(rec.issues) ? rec.issues : [];
  var acts = Array.isArray(rec.activations) ? rec.activations : [];
  var edges = Array.isArray(rec.edges) ? rec.edges : [];
  var circuits = 0, authoredBlocks = 0, resolvedBlocks = 0;
  issues.forEach(function (is) {
    if (is && Array.isArray(is.circuits)) circuits += is.circuits.length;
    if (is && is._authored !== undefined) authoredBlocks++;
    if (is && is.resolved !== undefined) resolvedBlocks++;
  });
  var treatments = 0, companyAssociations = 0, diagnosticTriggers = 0;
  acts.forEach(function (a) {
    if (a && Array.isArray(a.treatments)) treatments += a.treatments.length;
    if (a && Array.isArray(a.companies)) companyAssociations += a.companies.length;
    if (a && Array.isArray(a.diagnosticTriggers)) diagnosticTriggers += a.diagnosticTriggers.length;
  });
  return {
    issues: issues.length, circuits: circuits, authoredBlocks: authoredBlocks,
    resolvedBlocks: resolvedBlocks, activations: acts.length, treatments: treatments,
    companyAssociations: companyAssociations, diagnosticTriggers: diagnosticTriggers,
    edges: edges.length,
    hasEnrichment: rec._enrichment !== undefined
  };
}

/**
 * BUILD the index.
 *
 * Streams: one artifact is read, hashed, censused, written and released before the next
 * is opened. Nothing accumulates but counters and the domainId table needed to MEASURE
 * uniqueness — which is itself reported, so its cost is visible rather than assumed.
 *
 * A malformed artifact is RECORDED and the scan continues. Aborting on the first bad
 * file would make the census a function of scan order.
 */
function build(opts) {
  var corpus = openCorpus(opts);
  var pattern = opts.pattern;
  if (!pattern) throw new Error('opts.pattern is required (e.g. "assets/data/domains/energy*.json")');
  var outDir = opts.outDir;
  if (!outDir) throw new Error('opts.outDir is required — generated artifacts must not be written into the corpus');
  if (isInside(corpus.root, outDir)) {
    throw new Error('outDir is inside the corpus (' + outDir + '). The corpus is read-only; ' +
      'output must go elsewhere.');
  }
  var limit = (typeof opts.limit === 'number') ? opts.limit : Infinity;
  var order = opts.order || null;   // test hook: reorder enumeration to prove invariance

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  var indexPath = path.join(outDir, 'artifact-index.jsonl');
  var tmp = indexPath + '.tmp';

  /* LIMIT SELECTS, ORDER TRAVERSES, and the two must not be entangled.
     git ls-files returns a stable sorted list. Taking the limit FIRST means a bounded
     run always covers the same deterministic prefix; applying `order` afterwards changes
     only the sequence in which those artifacts are visited. Reversing this (shuffle then
     truncate) makes a bounded run sample a DIFFERENT subset every time the order changes,
     which is not a traversal-order property at all — it silently changes the population.
     The order-invariance test caught exactly that. */
  var files = enumerate(corpus, pattern);
  if (limit !== Infinity) files = files.slice(0, limit);
  if (order) files = order(files.slice());

  var counts = { enumerated: files.length, indexed: 0, malformed: 0, unreadable: 0, noDomainId: 0 };
  var census = { issues: 0, circuits: 0, authoredBlocks: 0, resolvedBlocks: 0, activations: 0,
                 treatments: 0, companyAssociations: 0, diagnosticTriggers: 0, edges: 0, withEnrichment: 0 };
  var byDomainId = Object.create(null);
  var problems = [];
  var peakHeap = 0, t0 = Date.now(), bytes = 0;
  /* AGGREGATE SNAPSHOT HASH. Folded over (relativePath, contentHash) in the CANONICAL
     sorted order, never traversal order, so it identifies the content set rather than
     the walk. This — not the commit — is what names a dirty-worktree snapshot. */
  var snapshotDigest = crypto.createHash('sha256');
  var snapshotPairs = [];
  /* Hash of the entry stream as written, so the reader can detect a deleted record. */
  var entriesDigest = crypto.createHash('sha256');
  var entriesWritten = 0;
  function writeEntry(obj) {
    var line = JSON.stringify(obj);
    entriesDigest.update(line).update('\n');
    entriesWritten++;
    fs.writeSync(fd, line + '\n');
  }

  var sourceSnapshotHash = null;
  var fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, JSON.stringify({
      _format: INDEX_FORMAT,
      repository: corpus.repository,
      repositoryCommit: corpus.repositoryCommit,
      repositoryDirty: corpus.repositoryDirty,
      repositoryDirtyEntries: corpus.repositoryDirtyEntries,
      pattern: pattern,
      note: 'Layer 1 artifact index. Semantics-neutral: counts and identity only. ' +
            'No field meaning is asserted anywhere in this file.'
    }) + '\n');

    for (var i = 0; i < files.length && counts.indexed + counts.malformed + counts.unreadable < limit; i++) {
      var rel = files[i];
      var abs = path.join(corpus.root, rel);
      var raw, stat;
      try {
        raw = fs.readFileSync(abs);
        stat = fs.statSync(abs);
      } catch (e) {
        /* AN UNREADABLE ARTIFACT STILL GETS AN INDEX ENTRY. Counting it and moving on
           left the path absent from the index entirely, so "every enumerated path has an
           entry" was true only because this run happened to hit zero of them. */
        counts.unreadable++;
        problems.push({ relativePath: rel, problem: 'unreadable', detail: e.message });
        /* EVERY ENUMERATED PATH participates in the snapshot hash. Omitting unreadable
           ones meant a corpus where a file became unreadable produced the SAME snapshot
           hash as one where it never existed. The canonical UNREADABLE marker keeps the
           path in the identity while asserting nothing about content. */
        snapshotPairs.push(rel + '\0UNREADABLE');
        /* writeEntry, NOT a raw write. Bypassing it wrote the line but left entryCount
           and entriesHash unaware of it, so the trailer under-declared by exactly the
           number of unreadable artifacts and every read of the index then failed. There
           must be one write path, or the trailer describes a different file. */
        writeEntry({
          identity: { repository: corpus.repository, repositoryCommit: corpus.repositoryCommit,
                      relativePath: rel, contentHash: null, domainId: null, byteSize: null },
          operational: { fileModifiedAt: null, note: 'NON-AUTHORITATIVE. Never identity, freshness or observation time.' },
          parseState: 'unreadable', parseDetail: e.message.slice(0, 200), census: null
        });
        continue;
      }
      bytes += raw.length;
      var contentHash = crypto.createHash('sha256').update(raw).digest('hex');

      var rec = null, parseState = 'ok', parseDetail = null;
      try { rec = JSON.parse(raw.toString('utf8')); }
      catch (e) { parseState = 'malformed'; parseDetail = e.message.slice(0, 140); }

      var entry;
      if (parseState === 'malformed') {
        counts.malformed++;
        problems.push({ relativePath: rel, problem: 'malformed', detail: parseDetail });
        entry = {
          identity: { repository: corpus.repository, repositoryCommit: corpus.repositoryCommit,
                      relativePath: rel, contentHash: contentHash, domainId: null, byteSize: raw.length },
          operational: { fileModifiedAt: stat.mtimeMs, note: 'NON-AUTHORITATIVE. Never identity, freshness or observation time.' },
          parseState: 'malformed', parseDetail: parseDetail, census: null
        };
      } else {
        var domainId = (rec && typeof rec.domainId === 'string' && rec.domainId) ? rec.domainId : null;
        if (domainId === null) {
          counts.noDomainId++;
          problems.push({ relativePath: rel, problem: 'no-domainId', detail: 'record parsed but declares no string domainId' });
        }
        var c = censusOf(rec || {});
        Object.keys(census).forEach(function (k) {
          if (k === 'withEnrichment') return;
          census[k] += c[k] || 0;
        });
        if (c.hasEnrichment) census.withEnrichment++;

        if (domainId !== null) {
          if (!byDomainId[domainId]) byDomainId[domainId] = [];
          byDomainId[domainId].push(rel);
        }
        counts.indexed++;
        entry = {
          identity: { repository: corpus.repository, repositoryCommit: corpus.repositoryCommit,
                      relativePath: rel, contentHash: contentHash, domainId: domainId, byteSize: raw.length },
          operational: { fileModifiedAt: stat.mtimeMs, note: 'NON-AUTHORITATIVE. Never identity, freshness or observation time.' },
          parseState: 'ok', parseDetail: null, census: c
        };
      }
      /* Readable artifacts contribute (path, contentHash). Unreadable ones contribute a
         canonical UNREADABLE marker above — every enumerated path is in the snapshot. */
      if (contentHash) snapshotPairs.push(rel + '\0' + contentHash);
      writeEntry(entry);
      rec = null; raw = null;

      if (i % 1000 === 0) {
        var h = process.memoryUsage().heapUsed / 1048576;
        if (h > peakHeap) peakHeap = h;
      }
    }

    /* THE TRAILER, written last inside the same handle. A file that stops early simply
       lacks it, which is the only way to distinguish "complete" from "truncated at a
       record boundary" — the latter leaves valid JSONL and a trailing newline, so
       nothing else would notice. sourceSnapshotHash lives HERE, not merely in the
       return value, so an index reopened tomorrow can recover and verify the snapshot
       identity it was built from. */
    snapshotPairs.sort();
    snapshotPairs.forEach(function (p) { snapshotDigest.update(p).update('\n'); });
    sourceSnapshotHash = snapshotDigest.digest('hex');
    fs.writeSync(fd, JSON.stringify({
      _end: true,
      entryCount: entriesWritten,
      entriesHash: entriesDigest.digest('hex'),
      sourceSnapshotHash: sourceSnapshotHash
    }) + '\n');
  } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, indexPath);

  var duplicates = [];
  Object.keys(byDomainId).forEach(function (d) {
    if (byDomainId[d].length > 1) duplicates.push({ domainId: d, count: byDomainId[d].length, paths: byDomainId[d].slice(0, 8) });
  });

  return {
    indexPath: indexPath,
    corpus: { repository: corpus.repository, repositoryCommit: corpus.repositoryCommit,
              repositoryDirty: corpus.repositoryDirty, repositoryDirtyEntries: corpus.repositoryDirtyEntries,
              root: corpus.root },
    sourceSnapshotHash: sourceSnapshotHash,
    snapshotNote: corpus.repositoryDirty
      ? 'WORKTREE IS DIRTY (' + corpus.repositoryDirtyEntries + ' entries). The commit does NOT identify ' +
        'this snapshot; sourceSnapshotHash does.'
      : 'worktree clean; commit and sourceSnapshotHash both identify this snapshot',
    counts: counts,
    census: census,
    distinctDomainIds: Object.keys(byDomainId).length,
    duplicateDomainIds: duplicates,
    duplicateDomainIdCount: duplicates.length,
    problems: problems,
    bytesRead: bytes,
    peakHeapMB: Math.round(peakHeap),
    elapsedMs: Date.now() - t0,
    reconciles: (limit === Infinity ? counts.enumerated : Math.min(counts.enumerated, limit))
                === (counts.indexed + counts.malformed + counts.unreadable),
    why: counts.enumerated + ' enumerated -> ' + counts.indexed + ' indexed, ' +
         counts.malformed + ' malformed, ' + counts.unreadable + ' unreadable, ' +
         counts.noDomainId + ' without domainId; ' + duplicates.length + ' duplicate domainIds'
  };
}

/**
 * STRICT line-delimited reader. Nothing is skipped, ever.
 *
 * Both readers previously did `try { JSON.parse(line) } catch { continue; }`, so a
 * corrupted or truncated line vanished without a word. A store advertised as LOSSLESS
 * that silently drops entries is worse than one that fails, because the loss is
 * invisible and downstream counts still reconcile against each other.
 *
 * Every failure below throws with the file and the 1-based line number:
 *   - invalid JSON on any line
 *   - a missing or malformed header
 *   - an unsupported format version
 *   - a trailing partial line (truncated write)
 *   - a declared entry count that does not match what was read
 */
function readStrict(filePath, formatKey, expectedFormat, fn) {
  if (!fs.existsSync(filePath)) throw new Error('STRICT_READ: file does not exist: ' + filePath);
  var fd = fs.openSync(filePath, 'r');
  var buf = Buffer.alloc(1 << 20);
  /* STRING DECODER, NOT buf.toString('utf8'). A multi-byte character straddling a chunk
     boundary is split across two reads; decoding each half independently emits U+FFFD
     replacement characters and silently corrupts the data. Measured: an em-dash became a
     replacement-character pair, so a supposedly LOSSLESS store was mangling text at every
     1 MB boundary that fell mid-character. StringDecoder holds the partial sequence. */
  var decoder = new (require('string_decoder').StringDecoder)('utf8');
  var carry = '', lineNo = 0, n = 0, header = null, trailer = null;
  /* THE ENTRY-STREAM HASH. Folded over each entry line in order, so DELETING a whole
     well-formed line — which leaves valid JSONL and a trailing newline — still changes
     it. Without this, a silent record deletion was undetectable: every remaining line
     parsed, the file ended correctly, and nothing disagreed. */
  var entriesDigest = crypto.createHash('sha256');
  function bad(msg) { throw new Error('STRICT_READ: ' + filePath + ':' + lineNo + ' ' + msg); }

  try {
    for (;;) {
      var read = fs.readSync(fd, buf, 0, buf.length, null);
      if (read <= 0) break;
      carry += decoder.write(buf.slice(0, read));
      var lines = carry.split('\n');
      carry = lines.pop();
      for (var i = 0; i < lines.length; i++) {
        lineNo++;
        if (lines[i] === '') bad('empty line — JSONL permits no blank lines here');
        var e;
        try { e = JSON.parse(lines[i]); } catch (err) { bad('invalid JSON (' + err.message.slice(0, 90) + ')'); }

        if (lineNo === 1) {
          if (!e || e[formatKey] === undefined) bad('missing header: expected a "' + formatKey + '" field on line 1');
          if (e[formatKey] !== expectedFormat) bad('unsupported format version ' + e[formatKey] + ', expected ' + expectedFormat);
          header = e;
          continue;
        }
        if (e && e[formatKey] !== undefined) bad('unexpected second header');
        if (trailer) bad('content after the trailer — the trailer must be the final line');
        if (e && e._end === true) { trailer = e; continue; }

        entriesDigest.update(lines[i]).update('\n');
        fn(e, n);
        n++;
      }
    }
    carry += decoder.end();
    if (carry.length) { lineNo++; bad('truncated final line (' + carry.length + ' chars, no trailing newline)'); }

    if (!header) throw new Error('STRICT_READ: ' + filePath + ' has no header line');
    /* MANDATORY. A file that simply stops is indistinguishable from a complete one
       without a trailer to demand. */
    if (!trailer) {
      throw new Error('STRICT_READ: ' + filePath + ' has no final trailer ({_end:true}). ' +
        'The file may be truncated at a record boundary — which leaves valid JSONL and a ' +
        'trailing newline, so nothing else would notice.');
    }
    if (typeof trailer.entryCount !== 'number') throw new Error('STRICT_READ: ' + filePath + ' trailer has no entryCount');
    if (trailer.entryCount !== n) {
      throw new Error('STRICT_READ: ' + filePath + ' trailer declares entryCount ' + trailer.entryCount +
        ' but ' + n + ' entries were read — ' + Math.abs(trailer.entryCount - n) + ' record(s) missing or added');
    }
    if (typeof trailer.entriesHash !== 'string') throw new Error('STRICT_READ: ' + filePath + ' trailer has no entriesHash');
    var actual = entriesDigest.digest('hex');
    if (trailer.entriesHash !== actual) {
      throw new Error('STRICT_READ: ' + filePath + ' entriesHash mismatch. trailer ' +
        trailer.entriesHash.slice(0, 16) + ', computed ' + actual.slice(0, 16) +
        ' — the entry stream was altered, reordered or substituted');
    }
  } finally { fs.closeSync(fd); }
  return { entries: n, header: header, trailer: trailer, entriesHash: trailer.entriesHash,
           sourceSnapshotHash: trailer.sourceSnapshotHash };
}

/** Stream the index back. STRICT: throws on any malformed line. */
function streamIndex(indexPath, fn) {
  return readStrict(indexPath, '_format', INDEX_FORMAT, fn);
}

module.exports = {
  INDEX_FORMAT: INDEX_FORMAT,
  readStrict: readStrict,
  openCorpus: openCorpus,
  enumerate: enumerate,
  censusOf: censusOf,
  build: build,
  streamIndex: streamIndex
};
