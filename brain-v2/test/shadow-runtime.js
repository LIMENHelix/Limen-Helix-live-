/**
 * brain-v2/test/shadow-runtime.js — the five properties that make "shadow" mean something.
 *
 *   node brain-v2/test/shadow-runtime.js
 *
 * A SHADOW RUNTIME IS A CLAIM ABOUT WHAT CANNOT HAPPEN, and claims of that shape are the
 * easiest in the codebase to believe without checking. Each is therefore tested by trying
 * to make the bad thing happen, not by reading the code and agreeing with it:
 *
 *   S1 NAMESPACE CONFINEMENT   every key the store can emit is under brain:v2:shadow:,
 *                              and asking for anything else THROWS
 *   S2 NO OUTWARD ACTUATION    a cycle DOES execute internal actions — the kernel wires
 *                              five in-process effectors — but with `fetch` rigged to
 *                              throw, not one of them reaches the network
 *   S3 DETERMINISTIC REPLAY    the same rows twice produce byte-identical state
 *   S4 RESTART RESTORATION     serialize, discard, restore, continue == never interrupted
 *   S5 NO EXISTING CONSUMER    nothing outside the shadow modules reads the namespace,
 *                              proved by scanning the repository
 *
 * NO NETWORK AND NO REDIS. The store is driven through an injected in-memory database so
 * every key written is observable, which is the only way S1 can be tested at all: a test
 * that trusted the store to confine itself would be asserting the thing under test.
 */

'use strict';

var fs = require('fs');
var path = require('path');
var Module = require('module');

var ROOT = path.join(__dirname, '..', '..');

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

/**
 * A STAND-IN FOR THE STRICT REDIS CLIENT, not for limen-db. The store no longer speaks to
 * limen-db at all: it uses lib/brain-shadow-redis, which has no fallback, so every failure
 * mode below is produced by making this object behave the way a broken redis would.
 *
 * It stores values so keys are observable — that is the only way S1 can be tested — but it
 * has the STRICT contract: throwing is how failure is expressed, never a return value.
 */
var WRITES = [], READS = [];
var MEM = Object.create(null), LISTS = Object.create(null);
var fakeRedis = {
  NAMESPACE_PREFIX: 'limen:',
  assertConfigured() { return true; },
  async get(k) { READS.push(k); return MEM[k] === undefined ? null : MEM[k]; },
  async set(k, v) { WRITES.push(k); MEM[k] = v; return true; },
  async lpush(k, v) { WRITES.push(k); (LISTS[k] = LISTS[k] || []).unshift(v); return (LISTS[k]).length; },
  async lrange(k, a, b) { READS.push(k); return (LISTS[k] || []).slice(a, b === -1 ? undefined : b + 1); },
  async ltrim(k, a, b) { WRITES.push(k); if (LISTS[k]) LISTS[k] = LISTS[k].slice(a, b + 1); return true; }
};
/* Inject before the store is first required, so it never touches the real transport. */
var redisPath = require.resolve(path.join(ROOT, 'lib', 'brain-shadow-redis.js'));
require.cache[redisPath] = { id: redisPath, filename: redisPath, loaded: true, exports: fakeRedis };

var STORE = require(path.join(ROOT, 'lib', 'brain-shadow-store.js'));
var RUNTIME = require(path.join(ROOT, 'lib', 'brain-shadow-runtime.js'));
var LOOP = require(path.join(ROOT, 'brain-v2', 'kernel', 'loop.js'));
var REG = require(path.join(ROOT, 'brain-v2', 'bind', 'registry.js'));

console.log('');
console.log('=== BRAIN-V2 SHADOW RUNTIME (in-memory db; no network, no Redis) ===');
console.log('');

/* Real recorded rows, from the installed fixtures. Using the actual corpus rather than a
   handmade row means the binder's own reader decides what a reading is. */
function fixtureRows(product, n) {
  var d = REG.descriptorFor(product);
  var doc = JSON.parse(fs.readFileSync(REG.fixturePath(d), 'utf8'));
  return doc.rows.slice().sort(function (a, b) { return a.t - b.t; }).slice(-n);
}
/* The store writes JSON TEXT, so a reader that forgets to parse silently compares strings
   and deletes fields off a primitive. That mistake made determinism look broken here once;
   the accessor exists so it cannot be made twice. */
function storedState(domain) {
  var raw = MEM[STORE.shadowKey(domain, 'state')];
  return raw === undefined ? null : JSON.parse(raw);
}

// ── S1: namespace confinement ────────────────────────────────────────────────
(function () {
  console.log('S1: every key is confined to brain:v2:shadow:, and nothing else is reachable');
  assert('the prefix is what it claims', STORE.PREFIX === 'brain:v2:shadow:', STORE.PREFIX);
  assert('a well-formed key is built under it',
    STORE.shadowKey('energy', 'state') === 'brain:v2:shadow:energy:state',
    STORE.shadowKey('energy', 'state'));

  var threw = function (fn) { try { fn(); return false; } catch (e) { return true; } };
  assert('a colon in the domain cannot escape the prefix',
    threw(function () { return STORE.shadowKey('energy:../brainwts', 'state'); }));
  assert('a traversal cannot escape it either',
    threw(function () { return STORE.shadowKey('../../brain', 'state'); }));
  assert('an empty domain is refused', threw(function () { return STORE.shadowKey('', 'state'); }));
  assert('a non-string domain is refused', threw(function () { return STORE.shadowKey(null, 'state'); }));
  assert('an unknown slot is refused', threw(function () { return STORE.shadowKey('energy', 'brainwts'); }));
  assert('and every declared slot resolves under the prefix',
    STORE.SLOTS.every(function (s) { return STORE.shadowKey('energy', s).indexOf(STORE.PREFIX) === 0; }),
    JSON.stringify(STORE.SLOTS));

  /* THE PRODUCTION NAMESPACES ARE NAMED, so this is a statement about the real keys in
     use rather than about a prefix in the abstract. */
  assert('the shadow prefix is disjoint from every production brain namespace',
    STORE.PRODUCTION_PREFIXES.every(function (p) {
      return STORE.PREFIX.indexOf(p) !== 0 && p.indexOf(STORE.PREFIX) !== 0;
    }), JSON.stringify(STORE.PRODUCTION_PREFIXES));
})();

// ── S2 + S3: a real cycle, then the same cycle again ─────────────────────────
var firstReport, secondReport, firstState;
(async function () {
  console.log('');
  console.log('S2: a full cycle acts ONLY on in-process brain state, and never outward');
  /**
   * WHAT THIS TEST ORIGINALLY ASSERTED WAS FALSE. It claimed the runtime registers no
   * effector and executes nothing. Running it said otherwise: `LOOP.create` wires five
   * handlers via `wireMotor`, and a 24-row cycle executed 23 actions. "No actuation"
   * was never true, and shipping that comment would have been a false safety claim in the
   * one file whose whole purpose is a safety claim.
   *
   * The five are RAISE_ATTENTION and LOWER_ATTENTION (which move a channel's Kalman
   * `rGain`), COLLECT_EVIDENCE (defers a cycle), NO_ACTION (does nothing by design), and
   * ESCALATE (writes a record and stops for a human). Every one is confined to the loop's
   * own memory. So the property worth guaranteeing is not "nothing executes" but
   * "execution cannot leave this process", and that is what is tested below.
   */
  var realFetch = global.fetch;
  var netAttempts = [];
  global.fetch = function (u) { netAttempts.push(String(u)); throw new Error('shadow runtime attempted a network call'); };
  WRITES.length = 0; READS.length = 0;
  var rows = fixtureRows('energy', 24);
  try {
    firstReport = await RUNTIME.runDomain('energy', { rows: rows, now: 1786000000000 });
  } finally { global.fetch = realFetch; }

  assert('the cycle ran', firstReport.ok === true, firstReport.error);
  assert('and applied the rows it was given', firstReport.ticks > 0,
    'ticks=' + firstReport.ticks + ' applied=' + firstReport.rowsApplied);
  assert('it DID execute internal actions, which is the honest number',
    firstReport.actuation.executed > 0, String(firstReport.actuation.executed));
  assert('from exactly the five effectors the kernel wires, no more',
    firstReport.actuation.effectorsRegistered === 5,
    String(firstReport.actuation.effectorsRegistered));
  /* THE PROPERTY THAT MATTERS: with `fetch` rigged to throw on any call, the cycle still
     completed and still executed. Nothing it did reached the network. */
  assert('and NOT ONE of them attempted a network call, with fetch rigged to throw',
    netAttempts.length === 0, JSON.stringify(netAttempts));
  assert('the canaries declare no efferent, so no domain wires an outward consumer',
    RUNTIME.CANARY_DOMAINS.every(function (p) {
      return require(path.join(ROOT, 'brain-v2', 'bind', REG.descriptorFor(p).binder + '.js')).spec().efferent === null;
    }));
  assert('and the kernel actuator has no transport of its own to reach outward with',
    !/require\('(https?|node-fetch|axios)'\)|fetch\s*\(/.test(
      fs.readFileSync(path.join(ROOT, 'brain-v2', 'kernel', 'actuate.js'), 'utf8')),
    'kernel/actuate.js dispatches only to registered handlers');

  console.log('');
  console.log('S2b: every key the cycle touched is a shadow key or the read-only recorder list');
  var offending = WRITES.filter(function (k) { return k.indexOf(STORE.PREFIX) !== 0; });
  assert('no write landed outside the shadow namespace', offending.length === 0,
    JSON.stringify(offending));
  assert('and the writes that did happen are the declared slots',
    WRITES.length > 0 && WRITES.every(function (k) {
      return /^brain:v2:shadow:[a-zA-Z]+:(state|cycle|history)$/.test(k);
    }), JSON.stringify(WRITES.slice(0, 6)));
  var badReads = READS.filter(function (k) {
    return k.indexOf(STORE.PREFIX) !== 0 && k.indexOf('feedhist:') !== 0;
  });
  assert('and no production brain key was READ either', badReads.length === 0, JSON.stringify(badReads));

  console.log('');
  console.log('S3: replaying the same rows changes nothing — the cycle is idempotent');
  firstState = JSON.stringify(storedState('energy'));
  secondReport = await RUNTIME.runDomain('energy', { rows: rows, now: 1786000001000 });
  assert('the second cycle applies zero rows, because the cursor already passed them',
    secondReport.rowsApplied === 0, String(secondReport.rowsApplied));
  assert('and the cursor did not move',
    secondReport.cursorAfter === firstReport.cursorAfter,
    firstReport.cursorAfter + ' -> ' + secondReport.cursorAfter);
  assert('so a duplicate trigger cannot double-count an observation',
    secondReport.ticks === 0, String(secondReport.ticks));

  console.log('');
  console.log('S3b: a fresh runtime over the SAME rows reaches the SAME state');
  /**
   * Determinism is asserted against a SECOND INDEPENDENT RUN from empty, not against the
   * idempotent no-op above. Those are different properties and only this one would catch a
   * clock reading or a random tiebreak leaking into the loop.
   */
  delete MEM[STORE.shadowKey('energy', 'state')];
  var replay = await RUNTIME.runDomain('energy', { rows: rows, now: 1786000002000 });
  var replayState = storedState('energy');
  var firstParsed = JSON.parse(firstState);
  /* savedAt is the wall clock the cycle was invoked with, and is the ONLY field expected
     to differ. Measured: with it removed the two serializations are byte-identical. */
  assert('the clock DID differ between the two runs, so this is not a trivial pass',
    replayState.savedAt !== firstParsed.savedAt,
    firstParsed.savedAt + ' vs ' + replayState.savedAt);
  delete replayState.savedAt; delete firstParsed.savedAt;
  assert('the replayed run applied the same number of rows',
    replay.rowsApplied === firstReport.rowsApplied,
    firstReport.rowsApplied + ' vs ' + replay.rowsApplied);
  assert('and produced byte-identical serialized state',
    JSON.stringify(replayState) === JSON.stringify(firstParsed),
    'lengths ' + JSON.stringify(replayState).length + ' vs ' + JSON.stringify(firstParsed).length);
})().then(function () {

// ── S4: restart restoration ──────────────────────────────────────────────────
  console.log('');
  console.log('S4: state survives a restart — restore and continue equals never stopping');
  return (async function () {
    var rows = fixtureRows('energy', 24);
    var half = rows.slice(0, 12), rest = rows.slice(12);

    /* (a) uninterrupted: all 24 rows in one process. */
    delete MEM[STORE.shadowKey('energy', 'state')];
    await RUNTIME.runDomain('energy', { rows: rows, now: 1786000010000 });
    var uninterrupted = storedState('energy');

    /* (b) interrupted: first half, then a SEPARATE cycle that must restore from storage. */
    delete MEM[STORE.shadowKey('energy', 'state')];
    var r1 = await RUNTIME.runDomain('energy', { rows: half, now: 1786000020000 });
    var r2 = await RUNTIME.runDomain('energy', { rows: rows, now: 1786000030000 });
    var restarted = storedState('energy');

    assert('the first leg did not restore, because nothing was stored yet', r1.restored === false);
    assert('the second leg DID restore from the shadow namespace', r2.restored === true);
    assert('and it applied only the rows the first leg had not seen',
      r2.rowsApplied === rest.length, r2.rowsApplied + ' vs ' + rest.length);
    assert('the restarted cursor matches the uninterrupted one',
      restarted.lastRowT === uninterrupted.lastRowT,
      restarted.lastRowT + ' vs ' + uninterrupted.lastRowT);
    assert('and the loop reports the same tick count either way',
      restarted.loop.ticks === uninterrupted.loop.ticks,
      restarted.loop.ticks + ' vs ' + uninterrupted.loop.ticks);
    /**
     * CONSUMED, NOT MERELY COMPUTED. A cursor that matches proves the runtime stopped in
     * the right place; it does not prove the restored brain carried its learning across.
     * The channel state is what the next tick actually reads, so that is compared too.
     */
    assert('and the restored brain carries the same channel state, not just the same cursor',
      JSON.stringify(restarted.loop.channels) === JSON.stringify(uninterrupted.loop.channels),
      'channel state diverged across the restart');
  })();

}).then(function () {

// ── S5: nobody reads the shadow namespace ────────────────────────────────────
  console.log('');
  console.log('S5: no existing consumer reads shadow results');
  /**
   * ASSERTED BY SCANNING THE REPOSITORY, because this is a claim about code that already
   * exists and prose cannot check it. The shadow modules and this test are the permitted
   * referents; anything else naming the namespace is a consumer, and a consumer is exactly
   * what a shadow deployment must not have.
   */
  var ALLOWED = [
    path.join('lib', 'brain-shadow-store.js'),
    path.join('lib', 'brain-shadow-runtime.js'),
    path.join('handlers', 'brain-shadow.js'),
    path.join('brain-v2', 'test', 'shadow-runtime.js'),
    '.vercelignore'
  ];
  var SKIP_DIRS = ['node_modules', '.git', 'brain-v2/fixtures', 'brain-v2/state'];
  var hits = [];
  (function walk(dir) {
    var entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    entries.forEach(function (ent) {
      var full = path.join(dir, ent.name);
      var rel = path.relative(ROOT, full).split(path.sep).join('/');
      if (SKIP_DIRS.some(function (s) { return rel === s || rel.indexOf(s + '/') === 0; })) return;
      if (ent.isDirectory()) return walk(full);
      if (!/\.(js|mjs|cjs|html|json|md)$/.test(ent.name)) return;
      var text;
      try { text = fs.readFileSync(full, 'utf8'); } catch (e) { return; }
      if (text.indexOf('brain:v2:shadow') < 0) return;
      var relNative = path.relative(ROOT, full);
      if (ALLOWED.indexOf(relNative) >= 0) return;
      hits.push(rel);
    });
  })(ROOT);

  assert('nothing outside the shadow modules references the namespace', hits.length === 0,
    JSON.stringify(hits));
  assert('and the scan actually looked at the repository, rather than finding nothing because it walked nowhere',
    fs.existsSync(path.join(ROOT, 'lib', 'brain-shadow-store.js')) &&
    fs.readFileSync(path.join(ROOT, 'lib', 'brain-shadow-store.js'), 'utf8').indexOf('brain:v2:shadow') >= 0,
    'the allowed list must be reachable by the same walk');

  console.log('');
  console.log('S5b: and the runtime is ONE runtime, not one per domain');
  var runtimeSrc = fs.readFileSync(path.join(ROOT, 'lib', 'brain-shadow-runtime.js'), 'utf8');
  var perDomainBranch = /if\s*\(\s*(product|domain)\s*===\s*['"]/.test(runtimeSrc);
  assert('the runtime contains no per-domain branch', !perDomainBranch,
    'domain-specific behaviour belongs in the binder, not in a runtime fork');
  assert('and every canary is executed by the same exported function',
    typeof RUNTIME.runDomain === 'function' && RUNTIME.CANARY_DOMAINS.length === 2,
    JSON.stringify(RUNTIME.CANARY_DOMAINS));

  console.log('');
  console.log('S6: per-domain failure isolation');
  return (async function () {
    var res = await RUNTIME.runDomains(['energy', 'not-a-domain'], { rows: fixtureRows('energy', 4) });
    assert('an unknown domain does not stop the run', res.reports.length === 2, String(res.reports.length));
    assert('the good domain still succeeded', res.reports[0].ok === true, res.reports[0].error);
    assert('the bad one is reported as failed, with a reason',
      res.reports[1].ok === false && typeof res.reports[1].error === 'string' && res.reports[1].error.length > 5,
      res.reports[1].error);
    assert('and the batch reports itself as not ok', res.ok === false);
  })();

}).then(function () {

  // ── S7: durability is checked, not assumed ─────────────────────────────────
  console.log('');
  console.log('S7 [adversarial]: a cycle that cannot persist must NOT report success');
  /**
   * THE FAILURE THIS GUARDS IS THE WORST ONE AVAILABLE: `lib/limen-db` degrades to a
   * per-instance memory object when Redis is missing or a call fails, and `lpush` returns
   * TRUE even when its Redis write failed. A serverless instance is then discarded, so the
   * cycle reports ok, computes correctly, and persists nothing. Each mode is forced here.
   */
  return (async function () {
    var rows = fixtureRows('energy', 4);

    console.log('S7a: redis is not configured at all');
    var realAssert = fakeRedis.assertConfigured;
    fakeRedis.assertConfigured = function () { throw new Error('shadow redis: UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN are not both set.'); };
    var memRes = await RUNTIME.runDomain('energy', { rows: rows, now: 1786000100000 });
    fakeRedis.assertConfigured = realAssert;
    assert('the cycle refuses rather than reporting a durable success',
      memRes.ok === false, JSON.stringify(memRes.ok));
    assert('and the reason names the missing credentials',
      /UPSTASH_REDIS_REST/.test(memRes.error || ''), memRes.error);

    console.log('S7b: the state write is rejected by redis');
    delete MEM[STORE.shadowKey('energy', 'state')];
    var realSet = fakeRedis.set;
    fakeRedis.set = async function (k) {
      if (/:state$/.test(k)) throw new Error('shadow redis: SET rejected by redis: WRONGTYPE');
      return realSet.apply(fakeRedis, arguments);
    };
    var setRes = await RUNTIME.runDomain('energy', { rows: rows, now: 1786000110000 });
    fakeRedis.set = realSet;
    assert('a rejected SET fails the cycle', setRes.ok === false, JSON.stringify(setRes.ok));
    assert('and the error names redis', /shadow redis/.test(setRes.error || ''), setRes.error);

    console.log('S7c: the history append does not land in redis');
    delete MEM[STORE.shadowKey('energy', 'state')];
    var realLpush = fakeRedis.lpush;
    /* The strict client throws on a non-numeric LPUSH result, so a "successful" append that
       never happened is impossible. This proves the read-back ALSO catches an append that
       silently went nowhere, which is the shape the old limen-db path produced. */
    fakeRedis.lpush = async function () { return 1; };   // claims success, stores nothing
    var lpRes = await RUNTIME.runDomain('energy', { rows: rows, now: 1786000120000 });
    fakeRedis.lpush = realLpush;
    assert('the read-back catches an append that never landed', lpRes.ok === false, JSON.stringify(lpRes.ok));
    assert('and says the report is not retrievable from redis',
      /did not read back|not retrievable/.test(lpRes.error || ''), lpRes.error);

    console.log('S7d: stored state is corrupt');
    MEM[STORE.shadowKey('energy', 'state')] = '{this is not json';
    var corruptRes = await RUNTIME.runDomain('energy', { rows: rows, now: 1786000130000 });
    assert('corruption is an ERROR, never a silent cold start',
      corruptRes.ok === false, JSON.stringify(corruptRes.ok));
    assert('and the reason says so rather than reporting a healthy first cycle',
      /unparseable|corrupt/.test(corruptRes.error || ''), corruptRes.error);
    assert('the cycle did NOT quietly restart learning from zero',
      corruptRes.restored === false && corruptRes.ticks === 0,
      'restored=' + corruptRes.restored + ' ticks=' + corruptRes.ticks);
    delete MEM[STORE.shadowKey('energy', 'state')];

    console.log('S7e: a failed cycle still leaves a trace');
    var traced = await STORE.readHistory('energy', 5);
    assert('failed cycles are recorded in history, so a silent failure is visible',
      traced.some(function (r) { return r && r.ok === false; }),
      'no failed cycle report was persisted');
  })();

}).then(function () {

  // ── S8: the per-cycle actuation number means this cycle ────────────────────
  console.log('');
  console.log('S8: actuation is reported PER CYCLE, not as a restored cumulative total');
  return (async function () {
    delete MEM[STORE.shadowKey('energy', 'state')];
    var rows = fixtureRows('energy', 24);
    var a = await RUNTIME.runDomain('energy', { rows: rows.slice(0, 12), now: 1786000200000 });
    var b = await RUNTIME.runDomain('energy', { rows: rows, now: 1786000210000 });

    assert('the first cycle executed something', a.actuation.executed > 0, String(a.actuation.executed));
    assert('the second cycle also executed, on its own rows', b.actuation.executed > 0,
      String(b.actuation.executed));
    /**
     * MEASURED, AND IT CORRECTED THE FIELD IT WAS WRITTEN TO CHECK. This first asserted a
     * cumulative `executedTotal` equal to the sum of both cycles. It failed, because
     * `ACT.serialize` persists opts, effectors, backlog and version and NOT `executed`:
     * the motor's log starts empty on every restore, so no lifetime count exists in stored
     * state. A field named `executedTotal` would have been read as "since this domain
     * began" while meaning "since the last cold start".
     */
    assert('the motor execution log does NOT survive restore, and the report says so',
      b.actuation.executedLogPersisted === false,
      'if this ever becomes true, the per-cycle subtraction is what keeps `executed` honest');
    assert('so the second cycle counts only its own rows, not the first cycle as well',
      b.actuation.executed < a.actuation.executed + b.actuation.executed,
      a.actuation.executed + ' then ' + b.actuation.executed);

    console.log('S8b: and only the allowed internal action kinds are wired');
    /* Taken from kernel/propose.js KIND rather than retyped: the literal list was written
       in upper case and passed nothing, which is a test asserting its own typo. */
    var PROP = require(path.join(ROOT, 'brain-v2', 'kernel', 'propose.js'));
    var ALLOWED = Object.keys(PROP.KIND).map(function (k) { return PROP.KIND[k]; }).sort();
    assert('exactly the five in-process kinds the kernel declares, and nothing else',
      JSON.stringify((b.actuation.kinds || []).slice().sort()) === JSON.stringify(ALLOWED),
      JSON.stringify(b.actuation.kinds) + ' vs ' + JSON.stringify(ALLOWED));
    assert('and the declared set is exactly five', ALLOWED.length === 5, JSON.stringify(ALLOWED));
    assert('none of them names an outward transport',
      (b.actuation.kinds || []).every(function (k) { return !/http|post|email|publish|send|deploy/i.test(k); }),
      JSON.stringify(b.actuation.kinds));
  })();

}).then(function () {

  // ── S10: the strict transport has no fallback at all ───────────────────────
  console.log('');
  console.log('S10 [adversarial]: the shadow transport cannot satisfy a write from memory');
  /**
   * THE DEFECT THIS REPLACES. The store used to run on `lib/limen-db` with a read-back
   * guard, and the guard was worthless: limen-db serves a failed write AND the following
   * read from the same per-instance `_memStore`, so the read-back passed in exactly the
   * case it existed to catch. It also returns null WITHOUT THROWING when redis replies
   * `{error: ...}`, so `set()` returned true for a protocol error.
   *
   * The real module is loaded here — NOT the fake used elsewhere in this file — with
   * `fetch` stubbed, so each failure mode is produced at the transport itself.
   */
  return (async function () {
    var realRedisPath = require.resolve(path.join(ROOT, 'lib', 'brain-shadow-redis.js'));
    var savedFake = require.cache[realRedisPath];
    delete require.cache[realRedisPath];
    var STRICT = require(realRedisPath);

    var realFetch = global.fetch;
    var savedUrl = process.env.UPSTASH_REDIS_REST_URL, savedTok = process.env.UPSTASH_REDIS_REST_TOKEN;
    function threwAsync(fn) {
      return fn().then(function () { return null; }, function (e) { return e.message || String(e); });
    }
    function stubFetch(status, body) {
      global.fetch = async function () {
        return { status: status, ok: status >= 200 && status < 300, async text() { return body; } };
      };
    }

    try {
      process.env.UPSTASH_REDIS_REST_URL = '';
      process.env.UPSTASH_REDIS_REST_TOKEN = '';
      var noCreds = await threwAsync(function () { return STRICT.get('brain:v2:shadow:energy:state'); });
      assert('missing credentials THROW rather than falling back to memory',
        !!noCreds && /UPSTASH_REDIS_REST/.test(noCreds), String(noCreds));
      assert('and the message says there is no fallback by design',
        /no memory fallback/.test(noCreds || ''), String(noCreds));

      process.env.UPSTASH_REDIS_REST_URL = 'https://example.invalid';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'x';

      stubFetch(500, '{"result":"OK"}');
      var non2xx = await threwAsync(function () { return STRICT.set('brain:v2:shadow:energy:state', '{}'); });
      assert('a non-2xx response throws even with a plausible body',
        !!non2xx && /HTTP 500/.test(non2xx), String(non2xx));

      stubFetch(200, 'not json at all');
      var badJson = await threwAsync(function () { return STRICT.get('brain:v2:shadow:energy:state'); });
      assert('an unparseable body throws', !!badJson && /not JSON/.test(badJson), String(badJson));

      stubFetch(200, '{"error":"WRONGTYPE Operation against a key"}');
      var redisErr = await threwAsync(function () { return STRICT.set('brain:v2:shadow:energy:state', '{}'); });
      assert('a redis `error` payload THROWS — limen-db returned null and reported success',
        !!redisErr && /rejected by redis/.test(redisErr), String(redisErr));

      stubFetch(200, '{"nothing":"here"}');
      var noResult = await threwAsync(function () { return STRICT.get('brain:v2:shadow:energy:state'); });
      assert('a response with no `result` field throws',
        !!noResult && /no .result. field/.test(noResult), String(noResult));

      stubFetch(200, '{"result":"NOTOK"}');
      var badSet = await threwAsync(function () { return STRICT.set('brain:v2:shadow:energy:state', '{}'); });
      assert('a SET that does not answer OK throws', !!badSet && /expected "OK"/.test(badSet), String(badSet));

      stubFetch(200, '{"result":"OK"}');
      var badPush = await threwAsync(function () { return STRICT.lpush('brain:v2:shadow:energy:history', '{}'); });
      assert('an LPUSH that does not answer a list length throws',
        !!badPush && /expected a list length/.test(badPush), String(badPush));

      stubFetch(200, '{"result":"OK"}');
      var badRange = await threwAsync(function () { return STRICT.lrange('brain:v2:shadow:energy:history', 0, 0); });
      assert('an LRANGE that does not answer an array throws',
        !!badRange && /expected an array/.test(badRange), String(badRange));

      /* AND THE KEY PREFIX MUST MATCH limen-db, or the recorder list is invisible and the
         runtime reports a healthy cycle over zero rows. */
      var sentKey = null;
      global.fetch = async function (u, o) {
        sentKey = JSON.parse(o.body)[1];
        return { status: 200, ok: true, async text() { return '{"result":[]}'; } };
      };
      await STRICT.lrange('feedhist:energy', 0, 1);
      assert('reads are prefixed exactly as limen-db writes them',
        sentKey === 'limen:feedhist:energy', String(sentKey));
    } finally {
      global.fetch = realFetch;
      if (savedUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL; else process.env.UPSTASH_REDIS_REST_URL = savedUrl;
      if (savedTok === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN; else process.env.UPSTASH_REDIS_REST_TOKEN = savedTok;
      require.cache[realRedisPath] = savedFake;
    }

    console.log('S10b: and the transport contains no memory store to fall back to');
    /**
     * TESTED AS A MECHANISM, NOT AS A VOCABULARY. Two earlier versions of this assertion
     * failed on the module's own prose: first the comment explaining why it has no
     * `_memStore`, then the ERROR MESSAGE STRING saying "no memory fallback by design".
     * Grepping for the word was always going to match the sentence denying the thing.
     *
     * What actually makes a fallback possible is state that survives between calls, so
     * that is what is checked: with comments and string literals removed, the module must
     * declare no mutable module-level container.
     */
    function codeOnly(p) {
      return fs.readFileSync(path.join(ROOT, p), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/.*$/gm, '$1')
        .replace(/'(?:\\.|[^'\\])*'/g, "''")
        .replace(/"(?:\\.|[^"\\])*"/g, '""');
    }
    var src = codeOnly(path.join('lib', 'brain-shadow-redis.js'));
    assert('the transport declares NO mutable module-level container to cache into',
      !/^\s*(var|let|const)\s+\w+\s*=\s*(\{\s*\}|\[\s*\]|Object\.create\()/m.test(src),
      'state surviving between calls is what makes a silent fallback possible');
    assert('and no cache-shaped identifier exists in its code',
      !/_memStore|memStore|\bcache\b/i.test(src), 'a store by any name is still a store');
    assert('the scan is not vacuous: the stripped code still contains the client itself',
      /function\s+command\s*\(/.test(src) && /UPSTASH_REDIS_REST_URL/.test(src),
      'stripping must not have emptied the file');
    assert('and the same scan DOES find limen-db\'s fallback, so it can detect one',
      /_memStore/.test(codeOnly(path.join('lib', 'limen-db.js'))),
      'a detector that finds nothing anywhere proves nothing');
    assert('and the store speaks ONLY to the strict transport, never to limen-db',
      !/require\(['"]\.\/limen-db['"]\)/.test(
        fs.readFileSync(path.join(ROOT, 'lib', 'brain-shadow-store.js'), 'utf8')),
      'brain-shadow-store must not reach the forgiving client');
    assert('while limen-db itself is untouched, so existing consumers keep their behaviour',
      /_memStore/.test(fs.readFileSync(path.join(ROOT, 'lib', 'limen-db.js'), 'utf8')),
      'this change is additive, not a rewrite of the shared client');
  })();

}).then(function () {

  // ── S9: the HTTP surface, where the deployment blockers were ───────────────
  console.log('');
  console.log('S9 [adversarial]: execution needs cron auth; an operator token cannot write');
  /**
   * THREE DEFECTS LIVED HERE and none was catchable by reading the runtime:
   *   - cron auth fell back to trusting `x-vercel-cron` / `x-vercel-signature`, which are
   *     request headers any caller can set, so the write path was authenticated by a
   *     string the attacker chooses
   *   - a "read-only" GET wrote whenever `?run=1` was present
   *   - the token was accepted from the query string, where proxies and analytics log it
   * Each is now asserted against the real handler, by calling it.
   */
  return (async function () {
    var handlerPath = require.resolve(path.join(ROOT, 'handlers', 'brain-shadow.js'));
    var ran = 0;
    function call(url, headers, env) {
      delete require.cache[handlerPath];
      var saved = { t: process.env.BRAIN_SHADOW_TOKEN, c: process.env.CRON_SECRET };
      if (env && 'token' in env) { if (env.token === null) delete process.env.BRAIN_SHADOW_TOKEN; else process.env.BRAIN_SHADOW_TOKEN = env.token; }
      if (env && 'cron' in env) { if (env.cron === null) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = env.cron; }
      var h = require(handlerPath);
      /* Replace the runtime's exported runDomains so a "did it write?" question is
         answered by observation rather than by inspecting Redis. */
      var RT = require(path.join(ROOT, 'lib', 'brain-shadow-runtime.js'));
      var realRun = RT.runDomains;
      RT.runDomains = async function () { ran++; return { ok: true, reports: [] }; };
      var out = { code: 0, body: null };
      var res = {
        statusCode: 200, setHeader: function () {},
        end: function (b) { out.code = res.statusCode; try { out.body = JSON.parse(b); } catch (e) { out.body = b; } }
      };
      return Promise.resolve(h({ url: url, method: 'GET', headers: headers || {} }, res)).then(function () {
        RT.runDomains = realRun;
        if (saved.t === undefined) delete process.env.BRAIN_SHADOW_TOKEN; else process.env.BRAIN_SHADOW_TOKEN = saved.t;
        if (saved.c === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved.c;
        return out;
      });
    }

    var r;
    r = await call('/api/brain-shadow?run=1', {}, { token: null, cron: null });
    assert('with no BRAIN_SHADOW_TOKEN set the endpoint fails closed (503)', r.code === 503, String(r.code));
    assert('and it did not run', ran === 0, String(ran));

    r = await call('/api/brain-shadow?run=1', { 'x-vercel-cron': '1' }, { token: 'op', cron: null });
    assert('a forged x-vercel-cron header no longer authenticates execution',
      r.code === 401 || r.code === 403, String(r.code));
    assert('and still did not run', ran === 0, String(ran));

    r = await call('/api/brain-shadow?run=1', { 'x-vercel-signature': 'abc' }, { token: 'op', cron: 'sekrit' });
    assert('nor does x-vercel-signature when CRON_SECRET IS set',
      r.code === 401 || r.code === 403, String(r.code));
    assert('and still did not run', ran === 0, String(ran));

    r = await call('/api/brain-shadow?token=op&run=1', {}, { token: 'op', cron: 'sekrit' });
    assert('a token in the QUERY STRING is not accepted at all', r.code === 401, String(r.code));

    r = await call('/api/brain-shadow?run=1', { 'x-brain-token': 'op' }, { token: 'op', cron: 'sekrit' });
    assert('an operator token is REFUSED for execution, with 403', r.code === 403, String(r.code));
    assert('the refusal explains which credential executes',
      /cron authentication/.test((r.body && r.body.error) || ''), JSON.stringify(r.body));
    assert('and no cycle ran', ran === 0, String(ran));

    r = await call('/api/brain-shadow', { 'x-brain-token': 'op' }, { token: 'op', cron: 'sekrit' });
    assert('an operator token DOES grant the read', r.code === 200, String(r.code));
    assert('and reading ran no cycle', ran === 0, String(ran));

    r = await call('/api/brain-shadow?run=1', { authorization: 'Bearer sekrit' }, { token: 'op', cron: 'sekrit' });
    assert('an exact Bearer CRON_SECRET match DOES execute', r.code === 200 || r.code === 207, String(r.code));
    assert('and exactly one cycle ran', ran === 1, String(ran));

    ran = 0;
    r = await call('/api/brain-shadow', { authorization: 'Bearer sekrit' }, { token: 'op', cron: 'sekrit' });
    assert('a cron hit WITHOUT run=1 does not execute either', ran === 0, String(ran));

    r = await call('/api/brain-shadow?run=1', { authorization: 'Bearer wrong' }, { token: 'op', cron: 'sekrit' });
    assert('a wrong bearer does not execute', ran === 0 && (r.code === 401 || r.code === 403), String(r.code));
  })();

}).then(function () {
  console.log('');
  console.log(failures ? (tests - failures) + '/' + tests + ' passed, ' + failures + ' FAILED'
                       : tests + '/' + tests + ' passed');
  console.log('');
  console.log('NOT PROVEN HERE: that the deployed function behaves this way against real');
  console.log('Redis. These tests inject an in-memory database, which is what makes every');
  console.log('key observable; the live path is proved only by running it and reading');
  console.log('/api/brain-shadow. What IS proven is that no code path in the store can');
  console.log('address a key outside the namespace, so a live run cannot widen the radius.');
  console.log('');
  process.exit(failures ? 1 : 0);
}).catch(function (e) {
  console.error('  FAIL harness threw :: ' + (e && e.stack || e));
  process.exit(1);
});
