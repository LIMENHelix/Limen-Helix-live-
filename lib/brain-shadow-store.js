/**
 * lib/brain-shadow-store.js — the ONLY door between the shadow runtime and durable state.
 *
 * SHADOW MEANS THE BLAST RADIUS IS A KEY PREFIX, so the prefix is enforced here rather
 * than remembered at each call site. Every read and every write in this module runs
 * through `shadowKey()`, which THROWS on anything that is not `brain:v2:shadow:<domain>:`.
 * A caller cannot reach production state through this module by passing a different
 * string, because there is no code path that accepts one.
 *
 * WHY A THROW AND NOT A SILENT REWRITE. A wrapper that quietly re-prefixed a bad key
 * would keep the guarantee and hide the bug: the caller believed it was writing somewhere
 * else and was wrong, and nothing would ever say so. The throw makes a confinement
 * violation a test failure at the moment it is written rather than a discrepancy someone
 * notices in Redis months later.
 *
 * WHAT LIVES HERE, per domain:
 *   brain:v2:shadow:<domain>:state    serialized loop state — the restart-restoration unit
 *   brain:v2:shadow:<domain>:cycle    the most recent cycle report
 *   brain:v2:shadow:<domain>:history  capped list of cycle reports, newest first
 *
 * PRODUCTION BRAIN STATE IS NOT TOUCHED. The keys already in use are `brain:cognition:*`,
 * `brainwts:*` and `brainwts:hist:*`; none of them share this prefix, and
 * `test/shadow-runtime.js` asserts that every key this module can emit is disjoint from
 * them rather than trusting the reader to compare strings.
 */

'use strict';

var db = require('./limen-db');

var PREFIX = 'brain:v2:shadow:';
/* Namespaces this module must never be able to address. Listed so the assertion below can
   name what it is protecting, and so a future key scheme has to be added deliberately. */
var PRODUCTION_PREFIXES = ['brain:cognition:', 'brainwts:', 'feedhist:', 'ai:'];

var HISTORY_CAP = 200;
var SLOTS = { state: 'state', cycle: 'cycle', history: 'history' };

/** A domain key component: lowercase alphanumerics only, so a crafted name cannot escape
 *  the prefix with a colon, a wildcard or a traversal. */
function assertDomain(domain) {
  if (typeof domain !== 'string' || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(domain)) {
    throw new Error('brain-shadow-store: invalid domain "' + domain + '" — expected a bare alphanumeric name');
  }
  return domain;
}

/**
 * Build a confined key, or throw. This is the single point the confinement property is
 * proved at, so it is exported for the test rather than re-implemented there.
 */
function shadowKey(domain, slot) {
  assertDomain(domain);
  if (!Object.prototype.hasOwnProperty.call(SLOTS, slot)) {
    throw new Error('brain-shadow-store: unknown slot "' + slot + '" — expected one of ' + Object.keys(SLOTS).join(', '));
  }
  var key = PREFIX + domain + ':' + slot;
  /* Belt and braces: the constructed key is re-checked against the prefix and against the
     production namespaces. If the construction above is ever edited into something that
     can escape, this fails loudly instead of silently widening the blast radius. */
  if (key.indexOf(PREFIX) !== 0) {
    throw new Error('brain-shadow-store: refusing to address "' + key + '" — outside ' + PREFIX);
  }
  for (var i = 0; i < PRODUCTION_PREFIXES.length; i++) {
    if (key.indexOf(PRODUCTION_PREFIXES[i]) === 0) {
      throw new Error('brain-shadow-store: refusing to address production namespace "' + key + '"');
    }
  }
  return key;
}

/**
 * DURABILITY IS CHECKED, NOT ASSUMED, and the reason is specific to this database module.
 * `lib/limen-db` degrades to a per-instance in-memory object when Redis is absent OR when
 * a Redis call fails, and it does not always say so:
 *
 *   set()    returns false when Redis SET fails            <- honest, so it is checked
 *   lpush()  returns TRUE even when Redis LPUSH fails      <- falls back to memory silently
 *   ltrim()  returns undefined and swallows every error
 *   with no Redis configured at all, set() returns true for a memory write
 *
 * A serverless instance is discarded after the invocation, so an in-memory "success" is a
 * cycle whose learning is thrown away while the report says ok. That is worse than a
 * failed cycle, because it looks like progress. So: the backend is gated before anything
 * is written, `set` results are checked, and the list write is VERIFIED BY READING IT BACK
 * rather than by trusting a return value that is hardcoded true.
 */
async function assertDurableBackend() {
  var backend = db.getBackend();
  if (backend !== 'redis') {
    throw new Error('shadow store refuses to write: backend is "' + backend + '", not redis. ' +
      'A serverless instance discards memory between invocations, so this cycle would report ' +
      'success and persist nothing.');
  }
  return backend;
}

/**
 * CORRUPT STATE IS AN ERROR, NEVER "no prior state". Returning null on a parse failure
 * would restart the brain from zero and report a perfectly healthy first cycle: the
 * learning is gone, the cursor is gone, every row is replayed as new, and nothing in the
 * output distinguishes that from a genuine cold start. Refusing is recoverable; a silent
 * reset is not.
 */
async function readState(domain) {
  var raw = await db.get(shadowKey(domain, 'state'));
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); }
  catch (e) {
    throw new Error('shadow state for "' + domain + '" is stored but unparseable (' + e.message +
      '). Refusing to treat corruption as a cold start, which would silently reset learning.');
  }
}

async function writeState(domain, state) {
  await assertDurableBackend();
  var ok = await db.set(shadowKey(domain, 'state'), JSON.stringify(state));
  if (ok === false) throw new Error('shadow state write for "' + domain + '" failed at the database');
  return true;
}

async function writeCycle(domain, report) {
  await assertDurableBackend();
  var key = shadowKey(domain, 'cycle');
  var ok = await db.set(key, JSON.stringify(report));
  if (ok === false) throw new Error('shadow cycle write for "' + domain + '" failed at the database');

  var hk = shadowKey(domain, 'history');
  await db.lpush(hk, report);
  await db.ltrim(hk, 0, HISTORY_CAP - 1);
  /* READ-BACK VERIFICATION. lpush cannot report its own failure, so the only way to know
     the append landed is to look. A mismatch means the list write went to memory. */
  var head = await db.lrange(hk, 0, 0);
  var got = (head && head.length) ? head[0] : null;
  if (typeof got === 'string') { try { got = JSON.parse(got); } catch (e) { /* compared below */ } }
  if (!got || got.startedAt !== report.startedAt) {
    throw new Error('shadow history append for "' + domain + '" did not read back; the list write ' +
      'did not reach redis (lpush reports success even when it falls back to memory)');
  }
  return true;
}

async function readCycle(domain) {
  var raw = await db.get(shadowKey(domain, 'cycle'));
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

async function readHistory(domain, n) {
  var rows = await db.lrange(shadowKey(domain, 'history'), 0, (n || 24) - 1);
  return (rows || []).map(function (r) {
    if (typeof r !== 'string') return r;
    try { return JSON.parse(r); } catch (e) { return null; }
  }).filter(Boolean);
}

/**
 * THE RECORDER IS READ, NEVER WRITTEN. `feedhist:*` belongs to the recorder and this
 * module is the only place the shadow runtime is allowed to touch it, through a function
 * that offers no write. Kept here so "what may the shadow runtime reach" is one file.
 */
async function readRecorderRows(snapshotKey, n) {
  assertDomain(snapshotKey);
  var rows = await db.lrange('feedhist:' + snapshotKey, 0, (n || 500) - 1);
  return (rows || []).map(function (r) {
    if (typeof r !== 'string') return r;
    try { return JSON.parse(r); } catch (e) { return null; }
  }).filter(function (r) { return r && typeof r.t === 'number'; });
}

module.exports = {
  assertDurableBackend: assertDurableBackend,
  PREFIX: PREFIX,
  PRODUCTION_PREFIXES: PRODUCTION_PREFIXES,
  SLOTS: Object.keys(SLOTS),
  HISTORY_CAP: HISTORY_CAP,
  shadowKey: shadowKey,
  readState: readState,
  writeState: writeState,
  writeCycle: writeCycle,
  readCycle: readCycle,
  readHistory: readHistory,
  readRecorderRows: readRecorderRows
};
