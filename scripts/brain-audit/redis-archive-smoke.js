/**
 * scripts/brain-audit/redis-archive-smoke.js — the one thing a fake cannot prove.
 *
 *   node scripts/brain-audit/redis-archive-smoke.js
 *
 * Everything else about compaction is tested against an in-memory substitute, and that is
 * appropriate: the policy, the chain, the caps and the ordering are all our own code. ONE
 * assumption is not ours, and a substitute that we wrote cannot test it —
 *
 *   that real Upstash answers `SET key value NX` with "OK" when the key is absent and with
 *   nil when it is present.
 *
 * The write-once archive slot rests entirely on that. If Upstash's REST layer returned, say,
 * a bare `true`, or `{"result":"OK"}` on an existing key, then `setNX` would either throw on
 * a healthy write or report a create that never happened — and the fake, modelled on what we
 * BELIEVE the protocol does, would agree with us the whole way down. That is the shape of
 * every defect this PR already found: a test that mirrors the code's assumption instead of
 * checking it.
 *
 * ISOLATION. This writes only under `brain:v2:shadow:zzsmoke:archive:<seq>`, where <seq> is
 * the current epoch second, so it can never collide with a real domain, never occupies a
 * sequence a real chain would want, and never touches the hot state of an installed domain.
 * It is read-only with respect to everything the runtime cares about.
 *
 * LEFTOVERS, STATED PLAINLY. The shadow transport has no delete — deliberately, since nothing
 * in the runtime may remove archived history — so each run leaves ONE key of a few hundred
 * bytes behind under `zzsmoke`. That is the honest cost of testing a write path with real
 * writes; it is not cleaned up silently, and it is not pretended away.
 *
 * CREDENTIALS. Needs UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in the environment.
 * Those exist in Vercel's Production and Preview scopes and are not readable locally, so this
 * script exists to be run WHERE THEY ALREADY ARE rather than to have them moved to it.
 */

'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..', '..');

var REDIS = require(path.join(ROOT, 'lib', 'brain-shadow-redis.js'));
var STORE = require(path.join(ROOT, 'lib', 'brain-shadow-store.js'));
var ARCHIVE = require(path.join(ROOT, 'lib', 'brain-shadow-archive.js'));

var failures = 0;
function assert(name, cond, detail) {
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

var DOMAIN = 'zzsmoke';   // bare alphanumeric: the store's domain guard rejects anything else
var SEQ = Math.floor(Date.now() / 1000);

/* Two chunk bodies that differ, so "the slot did not change" is observable rather than
   assumed. Small: this is a protocol test, not a volume test. */
function records(tag) {
  return {
    episodic: [{ id: 'smoke-' + tag, t: SEQ }],
    prospective: [], predictions: [], consumed: [], attention: {}
  };
}

async function main() {
  console.log('REAL REDIS ARCHIVE SMOKE');
  console.log('key: ' + STORE.archiveKey(DOMAIN, SEQ));
  console.log('');

  try {
    REDIS.assertConfigured();
  } catch (e) {
    console.error('BLOCKED: ' + e.message);
    console.error('This script must run where UPSTASH_REDIS_REST_URL and ' +
      'UPSTASH_REDIS_REST_TOKEN are already present.');
    process.exit(2);
  }

  /* 1. CREATE. The slot is fresh, so this must be a real create, and it must read back. */
  var first = await ARCHIVE.writeChunk(DOMAIN, SEQ, null, records('a'));
  assert('a fresh sequence is created and reads back identically', first.reused === false,
    JSON.stringify(first));

  /* 2. NIL IS NOT AN ERROR. The same content again must be recognised as an existing slot and
     resolved as a retry. If SET NX misreported, this either throws or claims a second create. */
  var again = await ARCHIVE.writeChunk(DOMAIN, SEQ, null, records('a'));
  assert('an identical rewrite is reported as a reuse, not a second create',
    again.reused === true && again.hash === first.hash, JSON.stringify(again));

  /* 3. THE SLOT IS WRITE-ONCE. Different content must be refused, not silently overwritten. */
  var conflicted = false, wrongError = '';
  try {
    await ARCHIVE.writeChunk(DOMAIN, SEQ, null, records('b'));
  } catch (e) {
    conflicted = /conflict/.test(e.message);
    wrongError = e.message;
  }
  assert('different content on the same sequence is refused', conflicted, wrongError);

  /* 4. AND THE ORIGINAL SURVIVED. The refusal above would be worthless if the write had
     already landed before the check. */
  var stored = await STORE.readArchiveChunk(DOMAIN, SEQ);
  assert('the originally created chunk is still the one stored',
    stored && ARCHIVE.hashOf(stored) === first.hash,
    stored ? ARCHIVE.hashOf(stored).slice(0, 12) + ' vs ' + first.hash.slice(0, 12) : 'missing');

  /* 5. THE RAW PROTOCOL ANSWER, stated directly rather than inferred through the archive, so
     a future transport change is caught at the layer it happens in. */
  /* A SEPARATE, EQUALLY FRESH SLOT. `shadowKey` only addresses the four known slots, so the
     probe reuses the archive namespace at the next sequence rather than inventing a key
     shape the store's guard would (correctly) refuse. A fresh sequence each run keeps this
     check re-runnable; probing a fixed key would pass once and then report a false failure. */
  var probeKey = STORE.archiveKey(DOMAIN, SEQ + 1);
  var createdRaw = await REDIS.setNX(probeKey, 'v1');
  var repeatRaw = await REDIS.setNX(probeKey, 'v2');
  assert('real SET NX returns true on an absent key and false on a present one',
    createdRaw === true && repeatRaw === false, createdRaw + ' / ' + repeatRaw);
  assert('and the losing SET NX did not change the value',
    (await REDIS.get(probeKey)) === 'v1');

  console.log('');
  console.log(failures ? failures + ' FAILED' : 'all checks passed against real Redis');
  console.log('left behind (transport has no delete, by design): ' +
    STORE.archiveKey(DOMAIN, SEQ) + ', ' + probeKey);
  process.exit(failures ? 1 : 0);
}

main().catch(function (e) {
  console.error('THREW: ' + (e && e.stack || e));
  process.exit(1);
});
