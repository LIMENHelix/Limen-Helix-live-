/**
 * lib/brain-shadow-redis.js — a STRICT Redis client for the shadow runtime, and only it.
 *
 * WHY THIS EXISTS RATHER THAN REUSING lib/limen-db. That module is deliberately forgiving:
 * it keeps the site up when Redis is unavailable by serving a per-instance in-memory
 * object. For most callers that is the right trade. For a durability guarantee it is fatal,
 * and in a way that defeats the obvious defence:
 *
 *   - a read-back check written against limen-db proves nothing, because a failed LPUSH
 *     falls back to `_memStore` and the following LRANGE reads the value straight back out
 *     of that same object. The verification passes in exactly the case it exists to catch.
 *   - `_redisRequest` RETURNS NULL WITHOUT THROWING when Redis replies `{error: ...}`, so
 *     `set()` sees no exception and returns true. A protocol error reads as a durable write.
 *   - a non-2xx response is never checked as such.
 *
 * So the shadow runtime gets its own transport with NO FALLBACK ANYWHERE. Every failure is
 * an exception. If Redis is missing, unreachable, unhappy, or answers something unexpected,
 * the cycle fails and says why. A shadow cycle that cannot persist must not report success,
 * because a serverless instance discards its memory and the "success" would be a lie that
 * looks like progress.
 *
 * ADDITIVE. Nothing here changes lib/limen-db or any existing consumer of it.
 *
 * THE `limen:` PREFIX IS NOT DECORATION. limen-db prefixes every key with `limen:`, so the
 * recorder's history is physically stored at `limen:feedhist:<domain>`. This module applies
 * the same prefix deliberately: drop it and the shadow runtime would read an empty list
 * from a key nobody writes, and report a healthy cycle over zero rows.
 */

'use strict';

var NAMESPACE_PREFIX = 'limen:';

function credentials() {
  var url = process.env.UPSTASH_REDIS_REST_URL;
  var token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('shadow redis: UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN are not both set. ' +
      'There is no memory fallback here by design: a cycle that cannot reach redis must fail, ' +
      'not persist to an instance that is about to be discarded.');
  }
  return { url: url, token: token };
}

/**
 * Issue one command. Throws on every failure mode limen-db tolerates:
 * missing credentials, transport error, non-2xx, unparseable body, `error` in the payload,
 * and a response with no `result` field at all.
 */
async function command(method, args) {
  var cred = credentials();
  var resp, text;
  try {
    resp = await fetch(cred.url, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + cred.token, 'Content-Type': 'application/json' },
      body: JSON.stringify([method].concat(args || []))
    });
  } catch (e) {
    throw new Error('shadow redis: ' + method + ' transport failed: ' + ((e && e.message) || String(e)));
  }
  if (!resp || typeof resp.status !== 'number' || resp.status < 200 || resp.status >= 300) {
    throw new Error('shadow redis: ' + method + ' returned HTTP ' + (resp && resp.status));
  }
  try { text = await resp.text(); }
  catch (e) { throw new Error('shadow redis: ' + method + ' response body unreadable: ' + e.message); }

  var data;
  try { data = JSON.parse(text); }
  catch (e) {
    throw new Error('shadow redis: ' + method + ' returned a body that is not JSON (' +
      String(text).slice(0, 80) + ')');
  }
  if (data && data.error) {
    throw new Error('shadow redis: ' + method + ' rejected by redis: ' + data.error);
  }
  if (!data || !Object.prototype.hasOwnProperty.call(data, 'result')) {
    throw new Error('shadow redis: ' + method + ' returned no `result` field');
  }
  return data.result;
}

function k(key) { return NAMESPACE_PREFIX + key; }

/** GET. Returns the raw string, or null when the key is absent. Any other shape throws. */
async function get(key) {
  var r = await command('GET', [k(key)]);
  if (r === null || r === undefined) return null;
  if (typeof r !== 'string') {
    throw new Error('shadow redis: GET ' + key + ' returned ' + typeof r + ', expected a string or null');
  }
  return r;
}

/** SET. Redis answers OK; anything else is refused rather than assumed successful. */
async function set(key, value) {
  var r = await command('SET', [k(key), value]);
  var ok = (r === 'OK') || (r && typeof r === 'object' && r.result === 'OK');
  if (!ok) throw new Error('shadow redis: SET ' + key + ' returned ' + JSON.stringify(r) + ', expected "OK"');
  return true;
}

/** LPUSH. Redis answers the new list length; a non-number means the append did not happen. */
async function lpush(key, value) {
  var r = await command('LPUSH', [k(key), value]);
  if (typeof r !== 'number' || !isFinite(r) || r < 1) {
    throw new Error('shadow redis: LPUSH ' + key + ' returned ' + JSON.stringify(r) + ', expected a list length');
  }
  return r;
}

async function ltrim(key, start, stop) {
  var r = await command('LTRIM', [k(key), String(start), String(stop)]);
  if (r !== 'OK') throw new Error('shadow redis: LTRIM ' + key + ' returned ' + JSON.stringify(r) + ', expected "OK"');
  return true;
}

async function lrange(key, start, stop) {
  var r = await command('LRANGE', [k(key), String(start), String(stop)]);
  if (!Array.isArray(r)) {
    throw new Error('shadow redis: LRANGE ' + key + ' returned ' + typeof r + ', expected an array');
  }
  return r;
}

/** Credentials present? Throws with the reason when not; used to fail a cycle early. */
function assertConfigured() { credentials(); return true; }

/**
 * `command` IS DELIBERATELY NOT EXPORTED. It takes a raw method and raw arguments, so a
 * caller holding it could issue any redis command against any key — DEL on a production
 * key, KEYS across the whole database, a write outside `brain:v2:shadow:` — and every
 * guarantee this module and brain-shadow-store make would become a convention rather than
 * a boundary. The five typed operations below are the entire surface: each validates its
 * own result shape, and each is reached through `shadowKey()` upstream.
 *
 * `test/shadow-runtime.js` asserts the absence of this export, because a one-word addition
 * to this object is exactly the kind of change that passes review unnoticed.
 */
module.exports = {
  NAMESPACE_PREFIX: NAMESPACE_PREFIX,
  assertConfigured: assertConfigured,
  get: get,
  set: set,
  lpush: lpush,
  ltrim: ltrim,
  lrange: lrange
};
