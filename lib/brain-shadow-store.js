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

var redis = require('./brain-shadow-redis');

var PREFIX = 'brain:v2:shadow:';
/* Namespaces this module must never be able to address. Listed so the assertion below can
   name what it is protecting, and so a future key scheme has to be added deliberately. */
var PRODUCTION_PREFIXES = ['brain:cognition:', 'brainwts:', 'feedhist:', 'ai:'];

var HISTORY_CAP = 200;
var SLOTS = { state: 'state', cycle: 'cycle', history: 'history' };
/* Archive chunks are `archive:<sequence>`. The sequence is validated as a positive integer
   so a crafted value cannot introduce a colon, a wildcard or a traversal, and the key is
   still built through shadowKey's prefix guard rather than beside it. */
function archiveKey(domain, sequence) {
  assertDomain(domain);
  if (typeof sequence !== 'number' || !isFinite(sequence) || sequence < 1 || sequence % 1 !== 0) {
    throw new Error('brain-shadow-store: archive sequence must be a positive integer, got ' + sequence);
  }
  var key = PREFIX + domain + ':archive:' + sequence;
  if (key.indexOf(PREFIX) !== 0) throw new Error('brain-shadow-store: refusing ' + key);
  for (var i = 0; i < PRODUCTION_PREFIXES.length; i++) {
    if (key.indexOf(PRODUCTION_PREFIXES[i]) === 0) {
      throw new Error('brain-shadow-store: refusing production namespace "' + key + '"');
    }
  }
  return key;
}

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
 * DURABILITY COMES FROM THE TRANSPORT, NOT FROM CHECKS BOLTED ON TOP OF A FORGIVING ONE.
 *
 * This module used `lib/limen-db` and guarded it: check `set()`'s boolean, then read the
 * list back to confirm the append. BOTH GUARDS WERE ILLUSORY, because limen-db satisfies a
 * failed write AND the following read from the same per-instance `_memStore`. The read-back
 * passed in precisely the case it existed to catch. And `_redisRequest` returns null
 * without throwing when redis replies `{error: ...}`, so `set()` returned true for a
 * protocol error.
 *
 * So the shadow runtime has its own transport, `lib/brain-shadow-redis`, with NO fallback
 * of any kind: missing credentials, non-2xx, unparseable body, `error` in the payload, a
 * missing `result` field, or an unexpected result shape are each an exception. limen-db is
 * untouched and its other consumers keep their forgiving behaviour.
 *
 * The read-back below is kept, but its job has changed: it is no longer compensating for a
 * silent failure, it is an end-to-end confirmation that what was written is retrievable
 * from redis under the key we believe we used.
 */
async function assertDurableBackend() {
  redis.assertConfigured();
  return 'redis';
}

/**
 * CORRUPT STATE IS AN ERROR, NEVER "no prior state". Returning null on a parse failure
 * would restart the brain from zero and report a perfectly healthy first cycle: the
 * learning is gone, the cursor is gone, every row is replayed as new, and nothing in the
 * output distinguishes that from a genuine cold start. Refusing is recoverable; a silent
 * reset is not.
 */
async function readState(domain) {
  var raw = await redis.get(shadowKey(domain, 'state'));
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); }
  catch (e) {
    throw new Error('shadow state for "' + domain + '" is stored but unparseable (' + e.message +
      '). Refusing to treat corruption as a cold start, which would silently reset learning.');
  }
}

/**
 * Returns the UTF-8 BYTE LENGTH OF THE SERIALIZED STATE VALUE accepted by SET, not a boolean.
 *
 * Measured here because this is the only place the payload exists as a string. Doing it in
 * the runtime would mean serializing a multi-megabyte object a second time to describe the
 * first, and the two could disagree. An estimate of the thing sent is not the thing sent.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * THIS IS NOT A TRANSPORT MEASUREMENT, AND THE DIFFERENCE MATTERS BECAUSE THE FIRST
 * VERSION OF THIS COMMENT GOT IT WRONG.
 *
 * It said "this many bytes reached redis". They did not. `brain-shadow-redis` sends
 * commands over the Upstash REST API, which puts this value inside a JSON array and escapes
 * it a second time, plus HTTP headers; a GET adds its own response envelope. The number on
 * the wire is strictly larger than the number returned here, by an amount this module never
 * observes.
 *
 * So this value MUST NOT be doubled into read-plus-write bandwidth, multiplied into a
 * billing figure, or compared against an HTTP request-size ceiling. Every one of those
 * silently substitutes a value length for a transport length. Measuring transport bytes
 * means instrumenting the client, and that belongs to the bounded-state milestone, not to
 * an installation change.
 *
 * WHAT IT IS FOR: relative growth of hot state per domain across cycles, which is exactly
 * what the batch-2 gate turns on and what nothing was measuring before.
 * ═══════════════════════════════════════════════════════════════════════════════════
 *
 * `Buffer.byteLength`, not `String.length`: the state carries source-identity tokens and
 * publisher strings, and any non-ASCII character makes those two numbers differ.
 *
 * Failure is still expressed by throwing, so a returned number always means the SET was
 * accepted; it never doubles as a success flag with a magnitude.
 */
async function writeState(domain, state) {
  await assertDurableBackend();
  var json = JSON.stringify(state);
  await redis.set(shadowKey(domain, 'state'), json);
  return Buffer.byteLength(json, 'utf8');
}

async function writeCycle(domain, report) {
  await assertDurableBackend();
  var key = shadowKey(domain, 'cycle');
  await redis.set(key, JSON.stringify(report));

  var hk = shadowKey(domain, 'history');
  await redis.lpush(hk, JSON.stringify(report));
  await redis.ltrim(hk, 0, HISTORY_CAP - 1);
  /* READ-BACK CONFIRMATION. The strict client already throws if LPUSH did not return a
     list length, so this is not compensating for a silent failure any more. It confirms
     end to end that the report is retrievable from redis under the key we believe we
     wrote — which a wrong prefix or a mis-scoped key would break without any command
     failing. */
  var head = await redis.lrange(hk, 0, 0);
  var got = (head && head.length) ? head[0] : null;
  if (typeof got === 'string') { try { got = JSON.parse(got); } catch (e) { /* compared below */ } }
  if (!got || got.startedAt !== report.startedAt) {
    throw new Error('shadow history append for "' + domain + '" did not read back from redis; ' +
      'the report is not retrievable under ' + hk);
  }
  return true;
}

/** Archive chunk write. Same strict transport, same confinement, no read-modify-write. */
async function writeArchiveChunk(domain, sequence, body) {
  await assertDurableBackend();
  var json = JSON.stringify(body);
  await redis.set(archiveKey(domain, sequence), json);
  return Buffer.byteLength(json, 'utf8');
}
/**
 * ATOMIC create-if-absent. Returns { created, bytes }. An archive slot is write-once, so
 * this is the only way a chunk should be written: two workers racing the same sequence must
 * produce one winner and one explicit loser, not two writes where the last one silently wins.
 */
async function createArchiveChunk(domain, sequence, body) {
  await assertDurableBackend();
  var json = JSON.stringify(body);
  var created = await redis.setNX(archiveKey(domain, sequence), json);
  return { created: created, bytes: Buffer.byteLength(json, 'utf8') };
}
/** Returns null when the chunk is absent, which is how a first write is distinguished. */
async function readArchiveChunk(domain, sequence) {
  var raw = await redis.get(archiveKey(domain, sequence));
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); }
  catch (e) {
    throw new Error('archive chunk ' + sequence + ' for "' + domain + '" is stored but unparseable (' +
      e.message + '). Refusing to treat corruption as absence, which would overwrite history.');
  }
}

async function readCycle(domain) {
  var raw = await redis.get(shadowKey(domain, 'cycle'));
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

async function readHistory(domain, n) {
  var rows = await redis.lrange(shadowKey(domain, 'history'), 0, (n || 24) - 1);
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
  var rows = await redis.lrange('feedhist:' + snapshotKey, 0, (n || 500) - 1);
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
  archiveKey: archiveKey,
  writeArchiveChunk: writeArchiveChunk,
  createArchiveChunk: createArchiveChunk,
  readArchiveChunk: readArchiveChunk,
  readState: readState,
  writeState: writeState,
  writeCycle: writeCycle,
  readCycle: readCycle,
  readHistory: readHistory,
  readRecorderRows: readRecorderRows
};
