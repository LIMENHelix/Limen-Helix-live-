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
 * verify() reads the whole chain by default; a caller-supplied cap verifies a bounded window, checks
 * the entry at the window boundary, and reports partial:true rather than claiming whole-chain proof.
 * Public handlers pass PUBLIC_VERIFY_CAP so an unauthenticated request cannot force a whole-chain
 * read. Trusted internal callers omit the cap for full verification.
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

/* Public verify endpoints must not be able to force an unbounded read. Trusted
   internal callers may omit the cap and verify the whole chain. */
var PUBLIC_VERIFY_CAP = 5000;

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

// Verify a chain given OLDEST-FIRST. An optional anchor lets a WINDOW be checked
// without pretending it starts at genesis: the anchor supplies the window's first
// expected prevHash/seq. Returns { ok, length, brokenAt, reason }.
function verifyChain(entriesOldestFirst, anchor) {
  var arr = entriesOldestFirst || [];
  var prev = anchor ? anchor.prevHash : GENESIS;
  var expectSeq = anchor ? anchor.seq : 0;
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

/**
 * Verify the stored chain.
 *
 * WITHOUT `cap`: reads the whole chain in one LRANGE and verifies it from genesis.
 * WITH `cap`: verifies the newest `cap` entries as a WINDOW. The entry immediately
 * older than the window is also read and checked (hash, seq, and link), and the
 * result is marked `partial:true`. A window is never reported as the whole chain.
 *
 * The previous implementation read the newest 5,000 entries and then verified them
 * as if they began at genesis, so every intact chain longer than 5,000 entries was
 * reported as tampered at the oldest fetched entry.
 */
async function verify(db, stream, cap) {
  var limit = (typeof cap === 'number' && isFinite(cap) && cap > 0) ? Math.floor(cap) : null;
  var all = (await db.lrange(key(stream), 0, limit ? limit - 1 : -1)) || [];
  var oldestFirst = all.slice().reverse();
  var r;

  if (!oldestFirst.length) {
    r = verifyChain([]);
    r.head = GENESIS;
    r.partial = false;
    r.boundaryChecked = false;
    r.firstSeq = null;
    r.lastSeq = null;
    r.genesisAnchored = true;
    return r;
  }

  /* Malformed entries are a verification RESULT, not an exception. A null or
     hash-less oldest entry must be reported as missing entry/hash, and it must
     not be dereferenced while building the result. */
  var oldest = oldestFirst[0];
  var newest = oldestFirst[oldestFirst.length - 1];
  var oldestUsable = !!oldest && typeof oldest === 'object'
    && typeof oldest.hash === 'string';

  if (limit && all.length >= limit) {
    // The window filled. Read one more entry to learn whether the chain continues
    // past it and, if so, to check the link at the window boundary.
    var extra = (await db.lrange(key(stream), limit, limit)) || [];
    var hasBoundary = Array.isArray(extra) && extra.length > 0;
    var boundary = hasBoundary ? extra[0] : null;
    if (hasBoundary) {
      /* ARRAY LENGTH, NOT TRUTHINESS. A boundary that exists but is null, false,
         0 or '' is malformed, not absent. Treating it as absent would return
         ok:true for a window whose continuation was never checked. */
      if (boundary === null || typeof boundary !== 'object'
        || typeof boundary.hash !== 'string') {
        r = { ok: false, length: oldestFirst.length, brokenAt: 0,
              reason: 'window boundary entry missing hash' };
        r.boundaryChecked = false;
      } else if (!oldestUsable) {
        r = { ok: false, length: oldestFirst.length, brokenAt: 0,
              reason: 'missing entry/hash' };
        r.boundaryChecked = false;
      } else {
        var anchor = oldest;
        r = verifyChain(oldestFirst, { prevHash: anchor.prevHash, seq: anchor.seq });
        if (r.ok && computeHash(boundary) !== boundary.hash) {
          r = { ok: false, length: oldestFirst.length, brokenAt: 0,
                reason: 'window boundary hash mismatch (entry edited)' };
        } else if (r.ok && boundary.seq !== anchor.seq - 1) {
          r = { ok: false, length: oldestFirst.length, brokenAt: 0,
                reason: 'window boundary seq mismatch (entry deleted/inserted)' };
        } else if (r.ok && anchor.prevHash !== boundary.hash) {
          r = { ok: false, length: oldestFirst.length, brokenAt: 0,
                reason: 'window boundary link mismatch (reorder/deletion)' };
        }
        r.boundaryChecked = true;
      }
      r.partial = true;
    } else {
      // Exactly `limit` entries; the window is the whole chain.
      r = verifyChain(oldestFirst);
      r.partial = false;
      r.boundaryChecked = false;
    }
  } else {
    r = verifyChain(oldestFirst);
    r.partial = false;
    r.boundaryChecked = false;
  }

  r.head = (all[0] && typeof all[0] === 'object' && typeof all[0].hash === 'string')
    ? all[0].hash : null;
  r.firstSeq = (oldest && typeof oldest === 'object' && typeof oldest.seq === 'number')
    ? oldest.seq : null;
  r.lastSeq = (newest && typeof newest === 'object' && typeof newest.seq === 'number')
    ? newest.seq : null;
  r.genesisAnchored = !r.partial && oldestUsable
    && oldest.seq === 0 && oldest.prevHash === GENESIS;
  return r;
}

module.exports = {
  GENESIS: GENESIS, PUBLIC_VERIFY_CAP: PUBLIC_VERIFY_CAP,
  computeHash: computeHash, makeEntry: makeEntry, verifyChain: verifyChain,
  append: append, read: read, verify: verify, key: key
};
