/**
 * LIMEN Helix — Iteration Cache Library (Phase 0 / W3)
 *
 * Mirrors the H4 idempotency pattern from api/limen-engine-output.js, but
 * scoped to predictive-coding iteration records. Engine-output uses
 *
 *     eo_{lane}_{cik}_{contentHash[0:8]}
 *
 * we use
 *
 *     iter_{slug}_{cycleN}_{iterN}_{inputHash[0:8]}
 *
 * Per the Phase 0 design doc (docs/phase-0-predictive-coding-prereqs.md, W3):
 *
 *   inputHash = FNV-1a({ portalSig, l2EdgesSig, classifierVersion,
 *                        propagatorVersion })
 *
 * The hash is computed over a key-sorted JSON serialization so callers can
 * pass inputs in any order without producing a different content key.
 *
 * Storage:
 *   - Primary: Upstash Redis if UPSTASH_REDIS_REST_URL + _TOKEN env vars
 *     present. Per-record key:
 *
 *         limen:iter:{iterId}                          (SET, TTL 7d)
 *         limen:iter_index:by_slug:{slug}              (LPUSH+LTRIM 200)
 *         limen:iter_index:by_cycle:{cycleN}           (LPUSH+LTRIM 200)
 *
 *   - Fallback: in-memory store (per cold-start; non-durable). Used both
 *     when Redis is unavailable AND for the test harness so unit tests
 *     never require live Redis.
 *
 * Hash algorithm consistency:
 *   We deliberately copy the FNV-1a folded-32 implementation byte-for-byte
 *   from api/limen-engine-output.js so iteration hashes and engine-output
 *   contentHashes remain inter-comparable for H1 chain verification.
 *   Do NOT swap to crypto.subtle, do NOT change constants.
 */

'use strict';

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const HAS_REDIS = !!(REDIS_URL && REDIS_TOKEN);

const ITER_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days, matches W4 hot tier
const INDEX_MAX = 200;                     // per-slug / per-cycle list cap

// In-memory fallback (per cold-start).
const _mem = {
  byId: new Map(),
  bySlug: new Map(),   // slug → string[] (LIFO)
  byCycle: new Map()   // cycleN → string[] (LIFO)
};

// ── FNV-1a folded-32 (copied from api/limen-engine-output.js) ────────
function _fnv1aFolded32(str) {
  let h1 = 0x811c9dc5;
  let h2 = 0x84222325;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 ^= c; h1 = (h1 * 0x01000193) >>> 0;
    h2 ^= c; h2 = (h2 * 0x100000001b3) >>> 0;
  }
  return ('00000000' + h1.toString(16)).slice(-8) +
         ('00000000' + h2.toString(16)).slice(-8);
}

// Key-sorted JSON serialization so input order does not affect the hash.
// We only need to sort the top-level keys; the iteration-input fields
// (portalSig, l2EdgesSig, classifierVersion, propagatorVersion) are flat
// strings/numbers per the design doc. We still walk recursively in case a
// caller passes an object value, to stay future-proof.
function _stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(_stableStringify).join(',') + ']';
  }
  const keys = Object.keys(value).sort();
  const parts = [];
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    parts.push(JSON.stringify(k) + ':' + _stableStringify(value[k]));
  }
  return '{' + parts.join(',') + '}';
}

/**
 * Compute the FNV-1a input hash over the iteration inputs.
 * Returns a 16-char hex string. Invariant to JSON key order.
 *
 * @param {{portalSig?:string, l2EdgesSig?:string, classifierVersion?:string, propagatorVersion?:string}} inputs
 * @returns {string}
 */
function computeInputHash(inputs) {
  const safe = inputs && typeof inputs === 'object' ? inputs : {};
  return _fnv1aFolded32(_stableStringify(safe));
}

/**
 * Build the iter idempotency key.
 *   iter_{slug}_{cycleN}_{iterN}_{inputHash[0:8]}
 *
 * @param {string} slug
 * @param {number|string} cycleN
 * @param {number|string} iterN
 * @param {string} inputHash
 * @returns {string}
 */
function computeIterId(slug, cycleN, iterN, inputHash) {
  const safeSlug = (slug || 'noslug').toString().replace(/[^a-zA-Z0-9_\-]/g, '_');
  const safeHash = (inputHash || '').toString().slice(0, 8);
  return ['iter', safeSlug, String(cycleN), String(iterN), safeHash].join('_');
}

// ── Redis helpers (REST) — same shape as engine-output ──────────────
async function _redisCmd(cmd) {
  if (!HAS_REDIS) return { ok: false, error: 'no-redis' };
  try {
    const r = await fetch(REDIS_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + REDIS_TOKEN,
        'content-type': 'application/json'
      },
      body: JSON.stringify(cmd)
    });
    const j = await r.json();
    return { ok: r.ok, status: r.status, result: j && j.result };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

async function _redisSet(key, value, ttlSeconds) {
  const args = ['SET', key, JSON.stringify(value)];
  if (ttlSeconds > 0) args.push('EX', String(ttlSeconds));
  return _redisCmd(args);
}

async function _redisGet(key) {
  const r = await _redisCmd(['GET', key]);
  if (!r.ok || !r.result) return null;
  try { return JSON.parse(r.result); } catch (_) { return r.result; }
}

async function _redisLPush(key, value, trimLen) {
  await _redisCmd(['LPUSH', key, JSON.stringify(value)]);
  if (trimLen > 0) await _redisCmd(['LTRIM', key, '0', String(trimLen - 1)]);
}

async function _redisLRange(key, start, stop) {
  const r = await _redisCmd(['LRANGE', key, String(start), String(stop)]);
  if (!r.ok || !Array.isArray(r.result)) return [];
  return r.result.map(s => { try { return JSON.parse(s); } catch (_) { return s; } });
}

/**
 * Fetch a single iteration record by id.
 * Redis first; falls back to in-memory map.
 *
 * @param {string} iterId
 * @returns {Promise<object|null>}
 */
async function getIterRecord(iterId) {
  if (!iterId) return null;
  if (HAS_REDIS) {
    const r = await _redisGet('limen:iter:' + iterId);
    if (r) return r;
  }
  return _mem.byId.get(iterId) || null;
}

/**
 * Store a single iteration record.
 * Redis SET (TTL 7d) + per-slug + per-cycle index LPUSH/LTRIM 200.
 * Falls back to in-memory if Redis SET fails.
 *
 * The record is expected to carry { slug, cycleN, iterN, ... }. Indexes
 * are populated from the record itself, not from the iterId, so callers
 * that pass an externally-derived iterId still get correct fan-out.
 *
 * @param {string} iterId
 * @param {object} record
 * @returns {Promise<{ok:boolean, storage:string, redisError?:string}>}
 */
async function putIterRecord(iterId, record) {
  if (!iterId || !record || typeof record !== 'object') {
    return { ok: false, storage: 'none', error: 'invalid-args' };
  }
  let storage = 'memory';
  let redisError = null;

  if (HAS_REDIS) {
    const setR = await _redisSet('limen:iter:' + iterId, record, ITER_TTL_SECONDS);
    if (setR && setR.ok) {
      storage = 'redis';
      // Index by slug (best-effort)
      if (record.slug) {
        await _redisLPush('limen:iter_index:by_slug:' + record.slug, iterId, INDEX_MAX);
      }
      // Index by cycleN (best-effort)
      if (record.cycleN !== undefined && record.cycleN !== null) {
        await _redisLPush('limen:iter_index:by_cycle:' + record.cycleN, iterId, INDEX_MAX);
      }
    } else {
      redisError = (setR && (setR.error || ('http ' + setR.status))) || 'unknown';
    }
  }

  // Always also write to in-memory so the dev/test path works AND so a
  // partial-Redis-failure doesn't lose the record between cold-starts.
  _mem.byId.set(iterId, record);
  if (record.slug) {
    const list = _mem.bySlug.get(record.slug) || [];
    list.unshift(iterId);
    if (list.length > INDEX_MAX) list.length = INDEX_MAX;
    _mem.bySlug.set(record.slug, list);
  }
  if (record.cycleN !== undefined && record.cycleN !== null) {
    const key = String(record.cycleN);
    const list = _mem.byCycle.get(key) || [];
    list.unshift(iterId);
    if (list.length > INDEX_MAX) list.length = INDEX_MAX;
    _mem.byCycle.set(key, list);
  }

  return { ok: true, storage: storage, redisError: redisError };
}

async function _hydrateIds(ids, limit) {
  const cap = Math.min(Math.max(parseInt(limit) || 50, 1), INDEX_MAX);
  const out = [];
  for (let i = 0; i < ids.length && out.length < cap; i++) {
    const r = await getIterRecord(ids[i]);
    if (r) out.push(r);
  }
  return out;
}

/**
 * List most-recent iteration records for a given slug (LIFO order).
 *
 * @param {string} slug
 * @param {number} [limit=50]
 * @returns {Promise<object[]>}
 */
async function listIterBySlug(slug, limit) {
  if (!slug) return [];
  let ids = [];
  if (HAS_REDIS) {
    ids = await _redisLRange('limen:iter_index:by_slug:' + slug, 0, INDEX_MAX - 1);
  }
  if (!ids.length) {
    ids = (_mem.bySlug.get(slug) || []).slice();
  }
  return _hydrateIds(ids, limit);
}

/**
 * List most-recent iteration records for a given cycle number (LIFO).
 *
 * @param {number|string} cycleN
 * @param {number} [limit=50]
 * @returns {Promise<object[]>}
 */
async function listIterByCycle(cycleN, limit) {
  if (cycleN === undefined || cycleN === null) return [];
  let ids = [];
  if (HAS_REDIS) {
    ids = await _redisLRange('limen:iter_index:by_cycle:' + cycleN, 0, INDEX_MAX - 1);
  }
  if (!ids.length) {
    ids = (_mem.byCycle.get(String(cycleN)) || []).slice();
  }
  return _hydrateIds(ids, limit);
}

// ── Test/maintenance helpers ────────────────────────────────────────
function _resetMemForTests() {
  _mem.byId.clear();
  _mem.bySlug.clear();
  _mem.byCycle.clear();
}

module.exports = {
  computeInputHash,
  computeIterId,
  getIterRecord,
  putIterRecord,
  listIterBySlug,
  listIterByCycle,
  // exposed for tests + diagnostics; not for production callers
  _resetMemForTests,
  _HAS_REDIS: HAS_REDIS,
  _ITER_TTL_SECONDS: ITER_TTL_SECONDS,
  _INDEX_MAX: INDEX_MAX
};
