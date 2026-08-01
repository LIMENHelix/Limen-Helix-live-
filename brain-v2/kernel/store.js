/**
 * brain-v2/kernel/store.js — PERSISTENCE. Append-only log + versioned snapshots.
 *
 * MASTER_PROMPT §12 (restart-safe, idempotent, deterministic under replay), §16 T7.
 * Fidelity: F0. This is event sourcing. It is not a claim about engram stability.
 *
 * THE LOG IS THE TRUTH. The snapshot is a checkpoint and nothing else. Every question about
 * "what did the system actually know at time T" is answered by replaying the log to T, never
 * by reading current state. That is what makes TEST 14 a test rather than a hope, and it is
 * the reason the store is written before any of the cognitive modules: a loop that cannot be
 * replayed cannot be audited, and an unauditable loop is where "changed output ≠ learning"
 * gets violated without anyone noticing.
 *
 * IDEMPOTENCY. Records carry deterministic ids (see packet.js). Appending an id already in the
 * log is a no-op that reports itself. This is what makes duplicate signal delivery safe
 * (TEST 15) rather than a source of double-counted evidence.
 *
 * No external dependencies. fs + path only.
 */

'use strict';

var fs = require('fs');
var path = require('path');

var LOG_NAME = 'log.jsonl';
var SNAP_NAME = 'snapshot.json';
var QUAR_NAME = 'quarantine.jsonl';

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

/**
 * Open (or create) a store rooted at `dir`.
 *
 * Recovery on open is the whole point of this function: read the snapshot if there is one,
 * then read the log, then hand the caller everything after the snapshot's version so it can
 * replay forward. A store that came up empty because the snapshot was missing would silently
 * lose history, so a missing snapshot means replay from record zero, not start fresh.
 */
function open(dir) {
  ensureDir(dir);
  var s = {
    dir: dir,
    logPath: path.join(dir, LOG_NAME),
    snapPath: path.join(dir, SNAP_NAME),
    quarPath: path.join(dir, QUAR_NAME),
    seen: Object.create(null),
    count: 0,
    corrupt: []
  };
  if (!fs.existsSync(s.logPath)) fs.writeFileSync(s.logPath, '', 'utf8');
  var recs = readLog(s);
  recs.forEach(function (r) { if (r && r.id) s.seen[r.id] = true; });
  s.count = recs.length;
  return s;
}

/**
 * Read every log record.
 *
 * A truncated or malformed final line is NOT fatal and is NOT silently dropped — it goes to
 * `store.corrupt` and the caller can see it. A crash mid-append leaves exactly this, and a
 * store that threw on it would be unrecoverable from a power cut; a store that hid it would
 * be lying about its own history. Both are worse than reporting.
 */
function readLog(store) {
  var raw;
  try { raw = fs.readFileSync(store.logPath, 'utf8'); } catch (e) { return []; }
  var out = [];
  store.corrupt = [];
  var lines = raw.split('\n');
  for (var i = 0; i < lines.length; i++) {
    var ln = lines[i];
    if (!ln.trim()) continue;
    try { out.push(JSON.parse(ln)); }
    catch (e) { store.corrupt.push({ line: i + 1, bytes: ln.length, why: e.message }); }
  }
  return out;
}

/**
 * Append one record. Returns {written, reason}.
 *
 * Idempotent by `record.id`. `duplicate` is a normal, expected result — it is how the
 * connectome's loop containment shows up at the storage layer — so it is reported, not thrown.
 */
function append(store, record) {
  if (!record || !record.id) return { written: false, reason: 'record has no id — cannot be made idempotent' };
  if (store.seen[record.id]) return { written: false, reason: 'duplicate', id: record.id };
  var line = JSON.stringify(record) + '\n';
  fs.appendFileSync(store.logPath, line, 'utf8');
  store.seen[record.id] = true;
  store.count++;
  return { written: true, id: record.id, seq: store.count };
}

/**
 * Quarantine: a separate file, deliberately.
 *
 * Rejected input must be inspectable without being replayable. Putting it in the main log
 * would mean a rebuild re-ingests exactly the material the barrier refused, which is the
 * poisoned-replay case in MASTER_PROMPT §17.7. Separate file, never read by rebuild().
 */
function quarantine(store, record, reason, now) {
  var q = { at: now, reason: reason, record: record };
  fs.appendFileSync(store.quarPath, JSON.stringify(q) + '\n', 'utf8');
  return q;
}

function readQuarantine(store) {
  if (!fs.existsSync(store.quarPath)) return [];
  return fs.readFileSync(store.quarPath, 'utf8').split('\n')
    .filter(function (l) { return l.trim(); })
    .map(function (l) { try { return JSON.parse(l); } catch (e) { return { unparseable: l }; } });
}

/**
 * Atomic snapshot: write a temp file, then rename over the target.
 *
 * A half-written snapshot read on restart is a corrupted brain that believes it is fine, which
 * is worse than no snapshot at all (the log can always rebuild). rename() is the cheapest
 * primitive that is atomic on both NTFS and POSIX.
 */
function snapshot(store, state, version, now) {
  var body = { version: version, at: now, logCount: store.count, state: state };
  var tmp = store.snapPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(body, null, 2), 'utf8');
  try {
    fs.renameSync(tmp, store.snapPath);
  } catch (e) {
    // Windows can refuse rename-over-existing depending on handles. Unlink then retry.
    try { fs.unlinkSync(store.snapPath); } catch (e2) { /* nothing to remove */ }
    fs.renameSync(tmp, store.snapPath);
  }
  return body;
}

function loadSnapshot(store) {
  if (!fs.existsSync(store.snapPath)) return null;
  try { return JSON.parse(fs.readFileSync(store.snapPath, 'utf8')); }
  catch (e) { return { corrupt: true, why: e.message }; }
}

/**
 * REBUILD — the restart path and the replay path, deliberately the same code.
 *
 * If they were different functions, "we can replay it" would be a claim about a code path
 * nothing exercises in production. Here, every restart IS a replay, so TEST 13 and TEST 14
 * test the same machinery and a divergence between them is impossible to hide.
 *
 * `reducer(state, record, index)` must be pure. `fromScratch` ignores the snapshot, which is
 * how a deterministic replay is proven against a checkpointed one.
 */
function rebuild(store, reducer, initialState, opts) {
  opts = opts || {};
  var snap = opts.fromScratch ? null : loadSnapshot(store);
  var state, startAt = 0, base = 'log record 0';
  if (snap && !snap.corrupt && snap.state) {
    state = JSON.parse(JSON.stringify(snap.state));
    startAt = snap.logCount || 0;
    base = 'snapshot v' + snap.version + ' (log record ' + startAt + ')';
  } else {
    state = JSON.parse(JSON.stringify(initialState));
    if (snap && snap.corrupt) base = 'log record 0 (snapshot was corrupt: ' + snap.why + ')';
  }
  var recs = readLog(store);
  var applied = 0;
  for (var i = startAt; i < recs.length; i++) {
    state = reducer(state, recs[i], i);
    applied++;
  }
  return {
    state: state,
    replayedFrom: base,
    recordsApplied: applied,
    totalRecords: recs.length,
    corruptLines: store.corrupt.slice()
  };
}

/**
 * ROLLBACK — TEST 20. Restore state as of log record N, without destroying the log.
 *
 * Truncating the log would make the bad update unauditable, and "what did we roll back and
 * why" is exactly the question a rollback mechanism exists to answer. So the log is immutable
 * and rollback is a rebuild to a prefix: the harmful records are still there, still readable,
 * just no longer applied.
 */
function rollbackTo(store, reducer, initialState, recordIndex) {
  var recs = readLog(store);
  var state = JSON.parse(JSON.stringify(initialState));
  var n = Math.min(recordIndex, recs.length);
  for (var i = 0; i < n; i++) state = reducer(state, recs[i], i);
  return { state: state, appliedRecords: n, discardedFromApplication: recs.length - n, logIntact: true };
}

/** Every record on one trace, in order. This is the audit trace (MASTER_PROMPT §22.15). */
function byTrace(store, traceId) {
  return readLog(store).filter(function (r) {
    return r && (r.traceId === traceId || (r.packet && r.packet.traceId === traceId));
  });
}

function stats(store) {
  return {
    dir: store.dir,
    records: store.count,
    uniqueIds: Object.keys(store.seen).length,
    corruptLines: store.corrupt.length,
    hasSnapshot: fs.existsSync(store.snapPath),
    quarantined: fs.existsSync(store.quarPath) ? readQuarantine(store).length : 0
  };
}

module.exports = {
  open: open,
  append: append,
  readLog: readLog,
  quarantine: quarantine,
  readQuarantine: readQuarantine,
  snapshot: snapshot,
  loadSnapshot: loadSnapshot,
  rebuild: rebuild,
  rollbackTo: rollbackTo,
  byTrace: byTrace,
  stats: stats,
  LOG_NAME: LOG_NAME,
  SNAP_NAME: SNAP_NAME
};
