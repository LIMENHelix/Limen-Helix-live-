/**
 * LIMEN Persistence Layer — Phase 20 Step 1
 *
 * Abstraction over storage backend.
 * Priority: Upstash Redis → in-memory fallback
 *
 * All reads: DB first, localStorage fallback (browser only)
 * All writes: DB (when available)
 *
 * Usage:
 *   var db = require('./lib/limen-db');
 *   await db.set('domains', data);
 *   var data = await db.get('domains');
 *
 * Env vars needed for Redis:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */

var TOUCH = require('./db-touch');

var _memStore = {}; // in-memory fallback (per cold start)
var _redisAvailable = null; // cached check

function _hasRedis() {
  if (_redisAvailable !== null) return _redisAvailable;
  _redisAvailable = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  return _redisAvailable;
}

async function _redisRequest(method, args) {
  var url = process.env.UPSTASH_REDIS_REST_URL;
  var token = process.env.UPSTASH_REDIS_REST_TOKEN;

  var body = [method].concat(args);

  var resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  var data = await resp.json();
  if (data.error) {
    console.error('[LIMEN-DB] Redis error:', data.error);
    return null;
  }

  // Freshness instrumentation. Records WHEN a store last changed so the wiring
  // sheet can show a conductor carrying traffic instead of only the 18 jobs the
  // heartbeat ledger covers. Never awaited, never throws, and skipped entirely
  // for reads. See lib/db-touch.js for why it records a namespace and not a key.
  try { TOUCH.note(method, args, _redisRequest); } catch (e) { /* never break a write */ }

  return data.result;
}

// ═══════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════

async function get(key) {
  var prefixed = 'limen:' + key;
  if (_hasRedis()) {
    try {
      var val = await _redisRequest('GET', [prefixed]);
      if (val) return JSON.parse(val);
    } catch (e) {
      console.warn('[LIMEN-DB] Redis GET failed:', e.message);
    }
  }
  // Fallback: in-memory
  return _memStore[prefixed] || null;
}

async function set(key, value, ttlSeconds) {
  var prefixed = 'limen:' + key;
  var json = JSON.stringify(value);

  // Always write to memory (warm lambda cache)
  _memStore[prefixed] = value;

  if (_hasRedis()) {
    try {
      if (ttlSeconds) {
        await _redisRequest('SET', [prefixed, json, 'EX', String(ttlSeconds)]);
      } else {
        await _redisRequest('SET', [prefixed, json]);
      }
      return true;
    } catch (e) {
      console.warn('[LIMEN-DB] Redis SET failed:', e.message);
      return false;
    }
  }
  return true; // in-memory write succeeded
}

async function del(key) {
  var prefixed = 'limen:' + key;
  delete _memStore[prefixed];
  if (_hasRedis()) {
    try { await _redisRequest('DEL', [prefixed]); } catch (e) {}
  }
}

// List operations (for arrays like intents, opportunities)
async function lpush(key, value) {
  var prefixed = 'limen:' + key;
  var json = JSON.stringify(value);
  if (_hasRedis()) {
    try { await _redisRequest('LPUSH', [prefixed, json]); return true; }
    catch (e) { console.warn('[LIMEN-DB] LPUSH failed:', e.message); }
  }
  // Fallback: in-memory array
  if (!_memStore[prefixed]) _memStore[prefixed] = [];
  _memStore[prefixed].unshift(value);
  return true;
}

async function lrange(key, start, stop) {
  var prefixed = 'limen:' + key;
  if (_hasRedis()) {
    try {
      var vals = await _redisRequest('LRANGE', [prefixed, String(start), String(stop)]);
      if (vals && Array.isArray(vals)) return vals.map(function(v) { try { return JSON.parse(v); } catch(e) { return v; } });
    } catch (e) { console.warn('[LIMEN-DB] LRANGE failed:', e.message); }
  }
  var arr = _memStore[prefixed] || [];
  var end = stop === -1 ? arr.length : stop + 1;
  return arr.slice(start, end);
}

async function ltrim(key, start, stop) {
  var prefixed = 'limen:' + key;
  if (_hasRedis()) {
    try { await _redisRequest('LTRIM', [prefixed, String(start), String(stop)]); } catch (e) {}
  }
  var arr = _memStore[prefixed] || [];
  var end = stop === -1 ? arr.length : stop + 1;
  _memStore[prefixed] = arr.slice(start, end);
}

// Health check
async function ping() {
  if (!_hasRedis()) return { backend: 'memory', status: 'ok' };
  try {
    var result = await _redisRequest('PING', []);
    return { backend: 'redis', status: result === 'PONG' ? 'ok' : 'error', result: result };
  } catch (e) {
    return { backend: 'redis', status: 'error', error: e.message };
  }
}

function getBackend() {
  return _hasRedis() ? 'redis' : 'memory';
}

/**
 * Read the store-freshness map recorded by lib/db-touch: { namespace: msWritten }.
 * Kept here rather than exposing _redisRequest, so the raw command channel stays
 * private to this module.
 */
async function touched() {
  if (!_hasRedis()) return {};
  return TOUCH.read(_redisRequest);
}

module.exports = {
  get: get,
  set: set,
  del: del,
  lpush: lpush,
  lrange: lrange,
  ltrim: ltrim,
  ping: ping,
  touched: touched,
  getBackend: getBackend
};
