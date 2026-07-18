/**
 * lib/audit-ledger.js — append-only, hash-chained, tamper-evident provenance ledger.
 *
 * The Phase-0 audit found every existing ledger is mutable and/or lossy (LPUSH re-push, 500-caps,
 * localStorage overwrite) — none is tamper-evident. This is the one shared primitive: an append-only
 * chain where each entry commits to the previous entry's hash, so any later edit/reorder/deletion of
 * a past entry breaks verification. It records provenance; it does NOT gate, spend, send, or act.
 *
 * IMMUTABILITY MODEL: the guarantee is tamper-EVIDENCE, not storage that physically forbids writes.
 * Redis LPUSH can be manipulated, so the hash chain is what detects it: verify() recomputes every
 * hash and checks each entry's prevHash against its predecessor. A broken link => tampering, surfaced.
 *
 * PROVENANCE FIELDS (per the spec's attributability principle): an entry carries type, actor, ts, and
 * a free payload where callers record prior-state / input / action / outcome / modulator / rule-version.
 *
 * Pure core (computeHash / makeEntry / verifyChain) has NO Date, NO Redis — deterministic, unit-testable.
 * The db-backed append/read/verify are thin wrappers. Concurrency: single-writer (crons/handlers); a
 * concurrent append could fork the chain — verify() surfaces that too. Not a lock, by design.
 */

var crypto = require('crypto');

var GENESIS = '0'.repeat(64);

// Deterministic content hash over the entry's committed fields (everything except `hash` itself).
function computeHash(entry) {
  var material = JSON.stringify([entry.seq, entry.ts, entry.type, entry.actor, entry.payload, entry.prevHash]);
  return crypto.createHash('sha256').update(material).digest('hex');
}

// Build a sealed entry. ts passed in (no Date in the pure core, so it stays deterministic/testable).
function makeEntry(seq, ts, type, actor, payload, prevHash) {
  var e = { seq: seq, ts: ts, type: String(type || 'event'), actor: String(actor || 'system'),
    payload: (payload === undefined ? null : payload), prevHash: prevHash || GENESIS };
  e.hash = computeHash(e);
  return e;
}

// Verify a chain given OLDEST-FIRST. Returns { ok, length, brokenAt, reason }.
function verifyChain(entriesOldestFirst) {
  var arr = entriesOldestFirst || [];
  var prev = GENESIS, expectSeq = 0;
  for (var i = 0; i < arr.length; i++) {
    var e = arr[i];
    if (!e || typeof e.hash !== 'string') return { ok: false, length: arr.length, brokenAt: i, reason: 'missing entry/hash' };
    if (e.prevHash !== prev) return { ok: false, length: arr.length, brokenAt: i, reason: 'prevHash mismatch (reorder/deletion)' };
    if (e.seq !== expectSeq) return { ok: false, length: arr.length, brokenAt: i, reason: 'seq gap/dup at ' + e.seq };
    if (computeHash(e) !== e.hash) return { ok: false, length: arr.length, brokenAt: i, reason: 'hash mismatch (entry edited)' };
    prev = e.hash; expectSeq++;
  }
  return { ok: true, length: arr.length, brokenAt: -1, reason: null };
}

// ── db-backed (Redis list `audit:<stream>`, LPUSH ⇒ index 0 = newest) ──
function key(stream) { return 'audit:' + String(stream).replace(/[^a-zA-Z0-9:_-]/g, ''); }

// Append one entry. rec: { ts, type, actor, payload }. ts must be supplied by the caller.
async function append(db, stream, rec) {
  rec = rec || {};
  var k = key(stream);
  var head = await db.lrange(k, 0, 0);
  var prevHash = (head && head[0] && head[0].hash) ? head[0].hash : GENESIS;
  var seq = (head && head[0] && typeof head[0].seq === 'number') ? head[0].seq + 1 : 0;
  var entry = makeEntry(seq, rec.ts, rec.type, rec.actor, rec.payload, prevHash);
  await db.lpush(k, entry);
  return entry;
}

// Read newest-first (for display).
async function read(db, stream, n) {
  return (await db.lrange(key(stream), 0, (n || 100) - 1)) || [];
}

// Verify the whole stored chain (reads all, reverses to oldest-first).
async function verify(db, stream, cap) {
  var all = (await db.lrange(key(stream), 0, (cap || 5000) - 1)) || [];
  var oldestFirst = all.slice().reverse();
  var r = verifyChain(oldestFirst);
  r.head = all[0] ? all[0].hash : GENESIS;
  return r;
}

module.exports = {
  GENESIS: GENESIS, computeHash: computeHash, makeEntry: makeEntry, verifyChain: verifyChain,
  append: append, read: read, verify: verify, key: key
};
