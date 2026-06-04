/**
 * redis-kv.js — tiny shared Upstash REST client (CommonJS, no deps).
 *
 * Extracted so both the build script (scripts/build-engine-outputs.mjs via
 * createRequire) and the read endpoints (api/master-inbox.js) use the SAME
 * Redis path. This is the reroute that unfreezes master-inbox: the cron writes
 * fresh per-portal engine-outputs to Redis, the endpoint reads them Redis-first
 * (falling back to the committed file), so new approved patterns surface without
 * committing 461 portal files (the 2.5GB-bloat the cron deliberately discards).
 *
 * Every call no-ops gracefully when UPSTASH_REDIS_REST_URL/_TOKEN are absent —
 * so callers always fall back to the file path and never throw.
 */
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const HAS_REDIS = !!(REDIS_URL && REDIS_TOKEN);

async function redisCmd(cmd) {
  if (!HAS_REDIS) return { ok: false, error: 'no-redis' };
  try {
    const r = await fetch(REDIS_URL, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + REDIS_TOKEN, 'content-type': 'application/json' },
      body: JSON.stringify(cmd)
    });
    const j = await r.json();
    return { ok: r.ok, status: r.status, result: j && j.result };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
}

async function redisSet(key, value, ttlSeconds) {
  const args = ['SET', key, JSON.stringify(value)];
  if (ttlSeconds > 0) args.push('EX', String(ttlSeconds));
  return redisCmd(args);
}

async function redisGet(key) {
  const r = await redisCmd(['GET', key]);
  if (!r.ok || r.result == null) return null;
  try { return JSON.parse(r.result); } catch (_) { return r.result; }
}

// Batched read — one round-trip for many keys. Returns { key: parsedValue }
// (missing keys omitted).
async function redisMGet(keys) {
  if (!HAS_REDIS || !keys || !keys.length) return {};
  const r = await redisCmd(['MGET'].concat(keys));
  const out = {};
  if (r.ok && Array.isArray(r.result)) {
    for (let i = 0; i < keys.length; i++) {
      const v = r.result[i];
      if (v == null) continue;
      try { out[keys[i]] = JSON.parse(v); } catch (_) { out[keys[i]] = v; }
    }
  }
  return out;
}

module.exports = { HAS_REDIS, redisCmd, redisSet, redisGet, redisMGet };
