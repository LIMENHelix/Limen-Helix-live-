/**
 * lib/brain-shadow-archive.js — the durable home for records retired from hot state.
 *
 * Retired records are HISTORY, not rubbish. Compaction moves them here and hot state keeps
 * only a constant-shape head; nothing is silently deleted, and chunks 1..head.sequence
 * reconstruct the pre-compaction record exactly.
 *
 * CONFINEMENT. Keys are built by brain-shadow-store.shadowKey, so an archive key can only
 * be `brain:v2:shadow:<domain>:archive:<sequence>` and the store's existing guard applies
 * unchanged. This module never speaks to redis directly.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * ORDER OF OPERATIONS, AND WHY IT IS THIS WAY
 *
 *   1. write the archive chunk
 *   2. READ IT BACK
 *   3. only then write the compacted hot state
 *
 * Reversed, a cycle that compacted successfully and failed to archive would have destroyed
 * the records it claimed to preserve, and reported ok. The read-back is not decoration: the
 * strict transport throws on a rejected SET, but a wrong key or a mis-scoped prefix would
 * fail neither the SET nor the caller, and the history would simply not be there.
 *
 * IDEMPOTENT BY CONTENT, NOT BY ATTEMPT. Retrying sequence N with identical content
 * succeeds and writes nothing new, because the shadow cycle has no lock and a retry after a
 * timeout is expected. Sequence N with DIFFERENT content throws: that means two different
 * histories claim the same slot, and picking one silently would corrupt the chain.
 *
 * THE CHAIN. Every chunk carries the previous chunk's hash, so a missing or altered chunk
 * is detectable rather than merely absent. `hash` is over the canonical chunk body.
 *
 * WHAT THIS DOES NOT DO: bound TOTAL archive storage. It bounds per-cycle hot state and
 * therefore request size. Cold export and archive retention are a later milestone, and
 * saying so here keeps the claim honest.
 * ═══════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

var crypto = require('crypto');
var STORE = require('./brain-shadow-store');

/**
 * CANONICAL SERIALIZATION. JSON.stringify preserves insertion order, so two structurally
 * identical chunks built in different key orders would hash differently and a legitimate
 * retry would look like a conflict. Keys are sorted at every level.
 */
function canonical(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  return '{' + Object.keys(v).sort().map(function (k) {
    return JSON.stringify(k) + ':' + canonical(v[k]);
  }).join(',') + '}';
}
function hashOf(body) { return crypto.createHash('sha256').update(canonical(body), 'utf8').digest('hex'); }

/** The chunk body. `records` is what left hot state; `counts` states it without reading it. */
function buildChunk(domain, sequence, prevHash, retired) {
  var counts = {
    episodic: (retired.episodic || []).length,
    prospective: (retired.prospective || []).length,
    predictions: (retired.predictions || []).length,
    consumed: (retired.consumed || []).length,
    attention: Object.keys(retired.attention || {}).reduce(function (a, k) {
      return a + (retired.attention[k] || []).length;
    }, 0)
  };
  var body = {
    domain: domain,
    sequence: sequence,
    prevHash: prevHash === undefined ? null : prevHash,
    counts: counts,
    records: retired
  };
  return { body: body, hash: hashOf(body), counts: counts };
}

/**
 * Write chunk `sequence`, then read it back. Returns { hash, counts, reused }.
 *
 * `reused` is true when an identical chunk was already present, which is the retry path.
 */
async function writeChunk(domain, sequence, prevHash, retired) {
  var built = buildChunk(domain, sequence, prevHash, retired);

  var existing = await STORE.readArchiveChunk(domain, sequence);
  if (existing) {
    var existingHash = hashOf(existing);
    if (existingHash === built.hash) return { hash: built.hash, counts: built.counts, reused: true };
    throw new Error('archive conflict at ' + domain + ' sequence ' + sequence +
      ': a different chunk already occupies this slot (' + existingHash.slice(0, 12) +
      ' vs ' + built.hash.slice(0, 12) + '). Two histories cannot share one sequence.');
  }

  await STORE.writeArchiveChunk(domain, sequence, built.body);

  /* READ-BACK, before the caller is allowed to drop anything from hot state. */
  var back = await STORE.readArchiveChunk(domain, sequence);
  if (!back || hashOf(back) !== built.hash) {
    throw new Error('archive chunk ' + sequence + ' for ' + domain +
      ' did not read back identically; hot state must NOT be compacted');
  }
  return { hash: built.hash, counts: built.counts, reused: false };
}

/**
 * Reconstruct chunks 1..sequence, verifying the hash chain. Bounded by the caller: an
 * operator asks for a range, never "everything", because the whole point of the archive is
 * that it is larger than anything a request should return by default.
 */
async function reconstruct(domain, fromSeq, toSeq) {
  var out = [], prev = null;
  /* ANCHOR A RANGE THAT DOES NOT START AT 1. An earlier version only validated the chain
     when fromSeq was 1, so any other range was returned unverified: a tampered or missing
     predecessor was undetectable precisely when a reader asked for a slice. The chunk
     before the range is read purely to anchor it, and is not returned. */
  if (fromSeq > 1) {
    var anchor = await STORE.readArchiveChunk(domain, fromSeq - 1);
    /* A MISSING PREDECESSOR IS A FAILURE, not a reason to skip validation. Returning the
       range unverified is exactly the hole this anchor exists to close: the caller would
       receive chunks that no longer chain to anything and could not tell. */
    if (!anchor) {
      throw new Error('archive anchor missing: ' + domain + ' chunk ' + (fromSeq - 1) +
        ' is required to validate a range starting at ' + fromSeq);
    }
    prev = hashOf(anchor);
  }
  for (var s = fromSeq; s <= toSeq; s++) {
    var c = await STORE.readArchiveChunk(domain, s);
    if (!c) throw new Error('archive gap: ' + domain + ' chunk ' + s + ' is missing');
    if (s > 1 && c.prevHash !== prev) {
      throw new Error('archive chain broken at ' + domain + ' chunk ' + s +
        ': prevHash does not match chunk ' + (s - 1));
    }
    prev = hashOf(c);
    out.push(c);
  }
  return out;
}

module.exports = {
  canonical: canonical,
  hashOf: hashOf,
  buildChunk: buildChunk,
  writeChunk: writeChunk,
  reconstruct: reconstruct
};
