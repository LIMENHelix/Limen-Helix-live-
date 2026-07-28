/**
 * lib/db-touch.js — when did each store last change?
 *
 * WHY
 * The wiring sheet draws a conductor for every store one file writes and another
 * reads. A conductor that never moves is indistinguishable from one that is dead,
 * and the only motion available before this was the heartbeat ledger, which
 * covers 18 scheduled jobs out of 253 files. So most of the data path could not
 * be shown as alive even when it was.
 *
 * Redis has no per-key write time. OBJECT IDLETIME reports last ACCESS, which a
 * read resets, so it cannot answer "did this change". This records the write
 * explicitly instead.
 *
 * WHAT IT COSTS, AND WHY IT IS SHAPED THIS WAY
 * Upstash bills bandwidth, and this sits on the write path of the entire system,
 * so it must not double the write count. Two things keep it cheap:
 *   1. It records a NAMESPACE, not a key. "limen:sales:agg" and
 *      "limen:sales:meta" are both "limen:sales". That caps the hash at a few
 *      dozen fields no matter how many keys exist.
 *   2. It coalesces. A namespace already recorded within COALESCE_MS in this
 *      process is skipped. Lambdas are short-lived, so in practice this is about
 *      one extra small write per namespace per invocation.
 *
 * IT MUST NEVER BREAK A WRITE
 * This is instrumentation on a hot path. Every call is wrapped, never awaited,
 * and its failure is silent. A store write must not fail because the sheet
 * wanted to draw a nicer picture.
 *
 * COVERAGE IS PARTIAL AND THE PANEL SAYS SO
 * Only writes routed through lib/limen-db are seen: 133 of 253 files. The six
 * files on lib/redis-kv and the nine holding their own Upstash credentials do
 * not report, so their conductors stay dark. Reported as `covered` rather than
 * quietly implied to be everything.
 */

'use strict';

var HASH = 'harness:touch';
var COALESCE_MS = 25000;

// Redis verbs that CHANGE a key. A read must never mark a store as fresh.
var WRITE_VERBS = {
  SET: 1, SETEX: 1, SETNX: 1, GETSET: 1, DEL: 1, APPEND: 1,
  LPUSH: 1, RPUSH: 1, LPOP: 1, RPOP: 1, LTRIM: 1, LSET: 1, LREM: 1,
  HSET: 1, HMSET: 1, HDEL: 1, HINCRBY: 1,
  SADD: 1, SREM: 1, SPOP: 1,
  ZADD: 1, ZREM: 1, ZINCRBY: 1,
  INCR: 1, INCRBY: 1, DECR: 1, DECRBY: 1,
  EXPIRE: 1, PEXPIRE: 1, PERSIST: 1, RENAME: 1
};

var _seen = {};        // namespace -> local ms of last record
var _busy = false;     // reentrancy guard: the touch write is itself a write

/**
 * Collapse a key to the namespace the sheet groups conductors by.
 * "limen:" is this repo's universal prefix, so it carries no information on its
 * own and the second segment is taken with it.
 */
function namespaceOf(key) {
  var parts = String(key || '').split(':');
  if (!parts[0]) return null;
  if (parts[0] === 'limen' && parts.length > 1) return 'limen:' + parts[1];
  return parts[0];
}

/**
 * Note a completed Redis command.
 *
 * @param method  the verb, e.g. 'SET'
 * @param args    the command arguments; args[0] is the key
 * @param exec    the caller's own request function, passed in to avoid a
 *                circular require between this and lib/limen-db
 */
function note(method, args, exec) {
  try {
    if (_busy) return;
    if (!WRITE_VERBS[String(method || '').toUpperCase()]) return;
    var key = args && args[0];
    if (!key || String(key).indexOf(HASH) === 0) return;   // never record ourselves

    var ns = namespaceOf(key);
    if (!ns) return;

    var now = Date.now();
    if (_seen[ns] && (now - _seen[ns]) < COALESCE_MS) return;
    _seen[ns] = now;

    _busy = true;
    // Deliberately not awaited. The caller's write has already succeeded and
    // must not wait on, or be failed by, this.
    Promise.resolve(exec('HSET', [HASH, ns, String(now)]))
      .catch(function () {})
      .then(function () { _busy = false; }, function () { _busy = false; });
  } catch (e) {
    _busy = false;
  }
}

/** Read the whole freshness map. Returns { namespace: msTimestamp }. */
async function read(exec) {
  try {
    var flat = await exec('HGETALL', [HASH]);
    if (!flat) return {};
    // Upstash returns either a flat [k,v,k,v] array or an object depending on
    // the command path; handle both rather than assuming one.
    var out = {};
    if (Array.isArray(flat)) {
      for (var i = 0; i + 1 < flat.length; i += 2) out[flat[i]] = parseInt(flat[i + 1], 10) || 0;
    } else if (typeof flat === 'object') {
      Object.keys(flat).forEach(function (k) { out[k] = parseInt(flat[k], 10) || 0; });
    }
    return out;
  } catch (e) {
    return {};
  }
}

module.exports = { note: note, read: read, namespaceOf: namespaceOf, HASH: HASH };
