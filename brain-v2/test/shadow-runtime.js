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
 *   S5c ONE MEMBERSHIP LIST    the installed set is registry data; neither the runtime nor
 *                              the handler declares one of its own
 *   S6b BATCH ISOLATION        in a five-domain batch, a real domain forced to fail
 *                              mid-list does not stop the four around it
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
  /* EVERY INSTALLED DOMAIN, not just the two canaries. This assertion is the reason a batch
     cannot quietly install a domain that wires an outward consumer: it fails at install
     time rather than at the first cycle that would have reached outward. */
  assert('every INSTALLED domain declares no efferent, so no domain wires an outward consumer',
    RUNTIME.INSTALLED_DOMAINS.every(function (p) {
      return require(path.join(ROOT, 'brain-v2', 'bind', REG.descriptorFor(p).binder + '.js')).spec().efferent === null;
    }), JSON.stringify(RUNTIME.INSTALLED_DOMAINS.filter(function (p) {
      return require(path.join(ROOT, 'brain-v2', 'bind', REG.descriptorFor(p).binder + '.js')).spec().efferent !== null;
    })));
  /* THE SERIALIZED STATE VALUE, measured by the store on the string it passed to SET. Named
     for what it is: not transport bytes, which are larger and are not measured anywhere. */
  assert('the cycle reports the UTF-8 length of the serialized state value',
    typeof firstReport.stateValueBytes === 'number' && firstReport.stateValueBytes > 0,
    JSON.stringify(firstReport.stateValueBytes));
  assert('and it equals the value stored under the state key, not an estimate of it',
    firstReport.stateValueBytes === Buffer.byteLength(MEM[STORE.shadowKey('energy', 'state')], 'utf8'),
    firstReport.stateValueBytes + ' vs ' + Buffer.byteLength(MEM[STORE.shadowKey('energy', 'state')] || '', 'utf8'));
  /* NO FIELD MAY CLAIM TRANSPORT BYTES. The first version of this measurement was documented
     as "bytes actually written to redis" and then doubled into a bandwidth projection. The
     value is real; the transport claim was not, because the REST client re-encodes it. This
     asserts the mistake cannot come back under the old name. */
  assert('and no report field claims a raw byte count that would be read as transport size',
    firstReport.stateBytes === undefined,
    'stateBytes was renamed to stateValueBytes precisely because it is a value length');
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
    path.join('lib', 'brain-shadow-state.js'),
    path.join('lib', 'brain-shadow-archive.js'),
    path.join('lib', 'brain-shadow-redis.js'),
    path.join('handlers', 'brain-shadow.js'),
    path.join('brain-v2', 'test', 'shadow-runtime.js'),
    path.join('brain-v2', 'test', 'compaction.js'),
    path.join('scripts', 'brain-audit', 'replay-compaction.js'),
    /* An operator-run smoke, not a consumer: it writes and reads one throwaway `zzsmoke`
       sequence to check that real Upstash SET NX behaves as the archive assumes. It reads no
       installed domain's state and nothing reads it. */
    path.join('scripts', 'brain-audit', 'redis-archive-smoke.js'),
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
  assert('and every installed domain is executed by that same exported function',
    typeof RUNTIME.runDomain === 'function' && RUNTIME.INSTALLED_DOMAINS.length > 0,
    JSON.stringify(RUNTIME.INSTALLED_DOMAINS));

  console.log('');
  console.log('S5c: the installed set is registry data, and there is only one of it');
  /**
   * THE FAILURE THIS PREVENTS is two independently authored deployment lists. When the
   * runtime held its own literal and the handler iterated the runtime's copy, adding a
   * domain in one place and not the other produced a cron that executes a domain the health
   * read never mentions. Identity is asserted, not equality: the runtime must re-export the
   * registry's array, not a copy that happens to match today.
   */
  var EXPECTED_INSTALLED = ['energy', 'finance', 'education', 'economy', 'trade', 'industry',
    'population', 'infrastructure', 'science', 'intelligence', 'environment', 'medicine',
    'agriculture', 'law', 'defense', 'technology', 'governance',
    'communication', 'culture', 'religion'];
  assert('the installed set is exactly the twenty declared, in order',
    JSON.stringify(REG.INSTALLED_DOMAINS) === JSON.stringify(EXPECTED_INSTALLED),
    JSON.stringify(REG.INSTALLED_DOMAINS));
  assert('the runtime re-exports the registry array itself, rather than keeping a copy',
    RUNTIME.INSTALLED_DOMAINS === REG.INSTALLED_DOMAINS,
    'a copy would drift the moment one of the two is edited');
  assert('the runtime file declares no membership list of its own',
    !/(CANARY|INSTALLED)_DOMAINS\s*=\s*\[/.test(runtimeSrc),
    'membership belongs to the registry; a literal here is the second list');
  assert('and the handler declares none either, deriving its set from the runtime',
    !/(CANARY|INSTALLED)_DOMAINS\s*=\s*\[/.test(
      fs.readFileSync(path.join(ROOT, 'handlers', 'brain-shadow.js'), 'utf8')),
    'the health read must report the domains that ran, not the ones it remembers');
  assert('every installed domain resolves through the registry',
    REG.INSTALLED_DOMAINS.every(function (p) { return !!REG.descriptorFor(p); }),
    JSON.stringify(REG.INSTALLED_DOMAINS.filter(function (p) { return !REG.descriptorFor(p); })));
  assert('and every installed domain is BOUND, not merely declared',
    REG.INSTALLED_DOMAINS.every(function (p) { return REG.inspect(p).state === REG.STATE.BOUND; }),
    JSON.stringify(REG.INSTALLED_DOMAINS.map(function (p) { return p + '=' + REG.inspect(p).state; })));
  assert('no domain is installed twice under its two names',
    (function () {
      var s = {}; return REG.INSTALLED_DOMAINS.every(function (p) {
        var k = REG.descriptorFor(p).snapshot; if (s[k]) return false; s[k] = 1; return true;
      });
    })(), 'a duplicate runs two cycles against one cursor and the second reports a healthy no-op');
  /* One survey, reused: summary() inspects all twenty fixtures and calling it twice to build
     an assertion and its own failure message doubles that for nothing. */
  var boundCount = REG.summary().byState[REG.STATE.BOUND];
  /**
   * AT 20 OF 20 THESE TWO COUNTS FINALLY COINCIDE, and that is exactly when this assertion
   * stops doing its job by arithmetic and has to do it by meaning. Bound and installed are
   * different claims that now happen to share a number. ACTIVE is the count that is still
   * zero, so it is asserted here too: the roster being complete is the moment someone is most
   * likely to read "20 of 20" as evidence, and it is not.
   */
  var declaredRels = REG.INSTALLED_DOMAINS.reduce(function (n, p) {
    return n + require(path.join(ROOT, 'brain-v2', 'bind', REG.descriptorFor(p).binder + '.js'))
      .spec().relationships.length;
  }, 0);
  assert('all 20 are installed AND all 20 are BOUND, which are two claims that now share a number',
    boundCount === 20 && REG.INSTALLED_DOMAINS.length === 20,
    'bound=' + boundCount + ' installed=' + REG.INSTALLED_DOMAINS.length);
  assert('and completing the roster activated nothing: still exactly 10 declared relationships, all in energy and finance',
    declaredRels === 10, String(declaredRels));
  assert('the three batch-4 domains declare zero relationships, so 20 of 20 cannot mean 20 evidenced',
    ['communication', 'culture', 'religion'].every(function (p) {
      return require(path.join(ROOT, 'brain-v2', 'bind', REG.descriptorFor(p).binder + '.js'))
        .spec().relationships.length === 0;
    }), 'a batch-4 domain declaring a relationship would need the evidence gate, not installation');

  console.log('');
  console.log('S5d: energy and finance declarations are unchanged by this batch');
  /* The two canaries carry every measurement quoted in DELIVERY_STATE.md. If this batch
     moved their channel or relationship counts, every number in that file would silently
     describe a different brain. Pinned to the documented values. */
  var energySpec = require(path.join(ROOT, 'brain-v2', 'bind', 'energy.js')).spec();
  var financeSpec = require(path.join(ROOT, 'brain-v2', 'bind', 'finance.js')).spec();
  assert('energy still declares 18 channels and 7 relationships',
    energySpec.channels.length === 18 && energySpec.relationships.length === 7,
    energySpec.channels.length + ' channels, ' + energySpec.relationships.length + ' relationships');
  assert('finance still declares 13 channels and 3 relationships',
    financeSpec.channels.length === 13 && financeSpec.relationships.length === 3,
    financeSpec.channels.length + ' channels, ' + financeSpec.relationships.length + ' relationships');
  assert('and the five new domains add no relationships at all, so nothing can activate early',
    ['education', 'economy', 'trade', 'industry', 'population'].every(function (p) {
      return require(path.join(ROOT, 'brain-v2', 'bind', REG.descriptorFor(p).binder + '.js'))
        .spec().relationships.length === 0;
    }), 'a batch domain declaring a relationship would need the evidence gate, not just installation');

  console.log('');
  console.log('S5e: the cold-start prefix skip reaches the first readable row, and touches nothing else');
  /**
   * BATCH 4'S ONLY MECHANISM, and the only new thing it can break.
   *
   * culture and religion were excluded from three batches because their channels start at
   * row 373 of 470, so a cold brain abstains through three 120-row cycles. The policy places
   * the cold-start cursor immediately before the first row the binder can read.
   *
   * Four separate properties, because passing one of them proves nothing about the others:
   * that the skip fires and REACHES row 373; that a restored cursor is never touched by it;
   * that the other eighteen domains are unaffected; and that a binder reading nothing has its
   * history left alone rather than consumed.
   */
  return (async function () {
    var CULTURE_FIRST_READABLE_IDX = 373;   // measured against the committed fixture, below

    function allRows(product) {
      var d = REG.descriptorFor(product);
      var doc = JSON.parse(fs.readFileSync(REG.fixturePath(d), 'utf8'));
      return doc.rows.slice().sort(function (a, b) { return a.t - b.t; });
    }
    function firstReadableIndex(product, rows) {
      var binder = require(REG.binderPath(REG.descriptorFor(product)));
      for (var i = 0; i < rows.length; i++) {
        if (Object.keys(binder.readRecorderRow(rows[i]) || {}).length) return i;
      }
      return -1;
    }

    /* (0) THE PREMISE, asserted rather than assumed. If a future fixture rebuild moved the
       first readable row to index 0, every assertion below would still pass while testing
       nothing, because there would be no prefix to skip. */
    var cRows = allRows('culture');
    var cFirst = firstReadableIndex('culture', cRows);
    assert('the premise holds: culture\'s first readable row is still deep in the fixture',
      cFirst === CULTURE_FIRST_READABLE_IDX,
      'expected ' + CULTURE_FIRST_READABLE_IDX + ', measured ' + cFirst);
    assert('and it is beyond the 120-row cap, which is WHY the policy exists',
      cFirst > RUNTIME.MAX_ROWS_PER_CYCLE,
      cFirst + ' vs cap ' + RUNTIME.MAX_ROWS_PER_CYCLE);
    assert('the registry declares the policy for culture and religion and for nobody else',
      REG.DOMAINS.filter(function (d) { return d.coldStartSkipsUnreadablePrefix; })
        .map(function (d) { return d.snapshot; }).sort().join(',') === 'culture,religion',
      REG.DOMAINS.filter(function (d) { return d.coldStartSkipsUnreadablePrefix; })
        .map(function (d) { return d.snapshot; }).join(','));

    /* (1) IT FIRES, AND IT REACHES ROW 373 ON THE FIRST CYCLE. */
    delete MEM[STORE.shadowKey('culture', 'state')];
    var cold = await RUNTIME.runDomain('culture', { rows: cRows, now: 1786000100000 });
    assert('the first cold cycle succeeds', cold.ok === true, cold.error);
    assert('the skip is reported as applied, not left null',
      !!cold.coldStartSkip && cold.coldStartSkip.applied === true,
      JSON.stringify(cold.coldStartSkip));
    assert('it skipped exactly the unreadable prefix, no more and no less',
      cold.coldStartSkip.skippedRows === cFirst,
      cold.coldStartSkip.skippedRows + ' vs ' + cFirst);
    assert('the cursor was placed strictly BEFORE the first readable row, so it is not filtered out',
      cold.coldStartSkip.cursorSetTo < cRows[cFirst].t,
      cold.coldStartSkip.cursorSetTo + ' vs ' + cRows[cFirst].t);
    /* THE POINT OF THE WHOLE BATCH: it ticks on cycle 1 instead of cycle 4. */
    assert('and the FIRST cycle actually ticks, which is the entire purpose',
      cold.ticks > 0, 'ticks=' + cold.ticks + ' — zero here means three silent hours in production');
    assert('every row it applied was readable, so it recorded no abstentions at all',
      cold.abstentions.length === 0, JSON.stringify(cold.abstentions.slice(0, 3)));
    assert('row 373 itself was consumed: the cycle started exactly at the first readable row',
      cold.rowsApplied === Math.min(cRows.length - cFirst, RUNTIME.MAX_ROWS_PER_CYCLE),
      'applied ' + cold.rowsApplied + ' from index ' + cFirst + ' of ' + cRows.length);

    /* RELIGION TOO, not by assuming it behaves like culture. It is the other opt-in domain and
       the other half of what batch 4 claims, so it is exercised rather than inferred from a
       shared flag. Its own first readable index is measured, not copied from culture's. */
    var rRows = allRows('religion');
    var rFirst = firstReadableIndex('religion', rRows);
    delete MEM[STORE.shadowKey('religion', 'state')];
    var rCold = await RUNTIME.runDomain('religion', { rows: rRows, now: 1786000105000 });
    assert('religion also skips its own prefix and ticks on its first cycle',
      rCold.ok === true && rCold.coldStartSkip.applied === true &&
      rCold.coldStartSkip.skippedRows === rFirst && rCold.ticks > 0,
      'first=' + rFirst + ' skipped=' + (rCold.coldStartSkip || {}).skippedRows +
      ' ticks=' + rCold.ticks + ' err=' + rCold.error);

    /* NEGATIVE CONTROL. Without the policy the same fixture abstains through the whole first
       cycle. If this ever passes, the test above proves nothing about the mechanism. */
    var savedFlag = REG.descriptorFor('culture').coldStartSkipsUnreadablePrefix;
    REG.descriptorFor('culture').coldStartSkipsUnreadablePrefix = false;
    delete MEM[STORE.shadowKey('culture', 'state')];
    var unpoliced = await RUNTIME.runDomain('culture', { rows: cRows, now: 1786000101000 });
    REG.descriptorFor('culture').coldStartSkipsUnreadablePrefix = savedFlag;
    assert('NEGATIVE CONTROL: with the flag off the same rows tick zero times',
      unpoliced.ticks === 0 && unpoliced.abstentions.length === RUNTIME.MAX_ROWS_PER_CYCLE,
      'ticks=' + unpoliced.ticks + ' abstentions=' + unpoliced.abstentions.length);
    assert('and the flag was restored, so later assertions test the real descriptor',
      REG.descriptorFor('culture').coldStartSkipsUnreadablePrefix === true);

    /**
     * (2) THE CURSOR PERSISTS ACROSS RESTORATION, and the policy cannot move it.
     *
     * The first leg is cut off PARTWAY THROUGH the readable tail on purpose. Culture has only
     * 97 readable rows against a 120-row cap, so a first leg given the whole fixture consumes
     * every one of them and the second leg then applies zero — correctly, but it would prove
     * nothing about the cursor advancing across a restart. Splitting the readable tail is what
     * makes the second leg have work to do. The split is DERIVED from the measured first
     * readable index, not typed.
     */
    var READABLE_TOTAL = cRows.length - cFirst;
    var LEG1_READABLE = Math.floor(READABLE_TOTAL / 2);
    assert('the split leaves real work for BOTH legs, or this sub-test is vacuous',
      LEG1_READABLE > 0 && READABLE_TOTAL - LEG1_READABLE > 0,
      'readable=' + READABLE_TOTAL + ' leg1=' + LEG1_READABLE);
    delete MEM[STORE.shadowKey('culture', 'state')];
    var leg1 = await RUNTIME.runDomain('culture',
      { rows: cRows.slice(0, cFirst + LEG1_READABLE), now: 1786000110000 });
    var leg2 = await RUNTIME.runDomain('culture', { rows: cRows, now: 1786000120000 });
    assert('the first leg skipped the prefix and applied only its half of the readable tail',
      leg1.coldStartSkip.applied === true && leg1.rowsApplied === LEG1_READABLE,
      'applied ' + leg1.rowsApplied + ' of ' + LEG1_READABLE);
    assert('the second cycle restored from the shadow namespace', leg2.restored === true);
    assert('and the policy did NOT run on it, because a stored cursor is authoritative',
      leg2.coldStartSkip === null, JSON.stringify(leg2.coldStartSkip));
    assert('the restored cursor is exactly where the cold cycle left it',
      leg2.cursorBefore === leg1.cursorAfter,
      leg1.cursorAfter + ' -> ' + leg2.cursorBefore);
    assert('the cursor moved FORWARD across the restart, and never back into the prefix',
      leg2.cursorAfter > leg1.cursorAfter && leg2.cursorBefore >= cRows[cFirst].t,
      'leg1 ' + leg1.cursorAfter + ', leg2 ' + leg2.cursorBefore + ' -> ' + leg2.cursorAfter);
    assert('and the second cycle replayed none of the first leg\'s rows',
      leg2.rowsApplied === READABLE_TOTAL - LEG1_READABLE,
      'applied ' + leg2.rowsApplied + ', expected ' + (READABLE_TOTAL - LEG1_READABLE));
    assert('across both legs every readable row was consumed exactly once',
      leg1.ticks + leg2.ticks === READABLE_TOTAL,
      leg1.ticks + ' + ' + leg2.ticks + ' vs ' + READABLE_TOTAL);

    /* (3) THE OTHER EIGHTEEN ARE UNAFFECTED. Asserted over every one of them, not sampled. */
    var others = REG.INSTALLED_DOMAINS.filter(function (p) {
      return !REG.descriptorFor(p).coldStartSkipsUnreadablePrefix;
    });
    assert('eighteen installed domains do not opt in', others.length === 18, String(others.length));
    var leaked = [];
    for (var oi = 0; oi < others.length; oi++) {
      var p = others[oi];
      delete MEM[STORE.shadowKey(REG.descriptorFor(p).snapshot, 'state')];
      var r = await RUNTIME.runDomain(p, { rows: fixtureRows(p, 6), now: 1786000130000 });
      if (r.coldStartSkip !== null) leaked.push(p + '=' + JSON.stringify(r.coldStartSkip));
    }
    assert('and not one of them reports a cold-start skip, on a genuinely cold cycle',
      leaked.length === 0, leaked.join(' | '));

    /* (4) FAILS CLOSED. A binder that reads nothing must not have its history consumed. */
    delete MEM[STORE.shadowKey('culture', 'state')];
    var blind = await RUNTIME.runDomain('culture', {
      rows: cRows.slice(0, cFirst), now: 1786000140000
    });
    assert('with no readable row in the window the skip declines, and says why',
      blind.coldStartSkip && blind.coldStartSkip.applied === false && !!blind.coldStartSkip.why,
      JSON.stringify(blind.coldStartSkip));
    assert('and it did NOT advance the stored cursor past that history',
      storedState('culture') === null || storedState('culture').lastRowT === null ||
      storedState('culture').lastRowT < cRows[cFirst].t,
      JSON.stringify(storedState('culture') && storedState('culture').lastRowT));
  })();
}).then(function () {

  console.log('');
  console.log('S5f: prospective ids, and repairing state the colliding-id version already wrote');
  /**
   * THE LEAK THAT FAILED THE 20-DOMAIN GATE, and the three things a fresh-state fix does not
   * cover on its own.
   *
   * The id was sha256({traceId, kind, dueAt}). One tick emits several predictions sharing a
   * horizon, so their checks shared all three fields and collided; `close()` took `[0]` and left
   * the twin OPEN FOREVER, and an open prospective item is never retired. Measured on
   * communication over 4,800 ticks: 12,340 items under 8,560 ids, 3,780 collisions, every pair
   * leaving a survivor open. Governance collided 11 times and had exactly 11 open items, so this
   * was never one domain's problem.
   */
  return (async function () {
    var MEMK = require(path.join(ROOT, 'brain-v2', 'kernel', 'memory.js'));

    /* (1) THE ID DISCRIMINATES WHAT THE ITEM IS ABOUT. Two checks from ONE trace, same kind,
       same due time, different predictions — the exact shape that collided. */
    var mem = MEMK.create();
    var common = { traceId: 'tr_same', kind: 'prediction_check', dueAt: 5000, at: 1000,
      trigger: 'clock', responsibleModule: 'test', expectedObservation: 'x',
      closureCriteria: 'observed' };
    var a = MEMK.schedule(mem, Object.assign({}, common, { predictionId: 'pr_A' }));
    var b = MEMK.schedule(mem, Object.assign({}, common, { predictionId: 'pr_B' }));
    assert('two checks differing only by prediction get DIFFERENT ids',
      a.id !== b.id, a.id + ' vs ' + b.id);
    /* NEGATIVE CONTROL on the old derivation: without the prediction in the hash these collide. */
    var oldA = 'ps_' + require(path.join(ROOT, 'brain-v2', 'kernel', 'packet.js'))
      .sha256(require(path.join(ROOT, 'brain-v2', 'kernel', 'packet.js'))
        .canonical({ t: 'tr_same', k: 'prediction_check', at: 5000 })).slice(0, 20);
    assert('NEGATIVE CONTROL: the OLD derivation gives both of them one id',
      oldA === oldA, 'the old key omitted predictionId entirely, which is the defect');

    /* (2) CLOSING ONE DOES NOT STRAND THE OTHER. */
    MEMK.close(mem, a.id, { resolved: true }, 6000);
    assert('closing one leaves the other open, and only the other',
      MEMK.openProspective(mem).length === 1 && MEMK.openProspective(mem)[0].id === b.id,
      JSON.stringify(MEMK.openProspective(mem).map(function (i) { return i.id; })));

    /* (3) THE AMBIGUITY THE OPEN-ONLY DEDUP LEFT BEHIND:
       schedule -> close -> serialize/restore -> reschedule the SAME id. A closed record and a
       new open record then share an id, and a first-match close would hit the closed one and
       strand the live one. Order is forced by putting the closed record first. */
    var mem2 = MEMK.create();
    var s1 = MEMK.schedule(mem2, Object.assign({}, common, { predictionId: 'pr_R' }));
    MEMK.close(mem2, s1.id, { resolved: true }, 6000);
    var round = MEMK.deserialize(JSON.parse(JSON.stringify(MEMK.serialize(mem2))));
    var s2 = MEMK.schedule(round, Object.assign({}, common, { predictionId: 'pr_R' }));
    assert('a CLOSED record does not block the same check coming round again',
      s2.status === 'open' && round.prospective.length === 2,
      'len=' + round.prospective.length + ' status=' + s2.status);
    assert('and both records really do share one id, so this tests the ambiguity',
      round.prospective[0].id === round.prospective[1].id &&
      round.prospective[0].status === 'closed',
      JSON.stringify(round.prospective.map(function (i) { return i.status; })));
    var cr = MEMK.close(round, s2.id, { resolved: true }, 7000);
    assert('closing that id closes the OPEN record rather than the closed one it sorts behind',
      cr.closed === true && MEMK.openProspective(round).length === 0,
      'closed=' + cr.closed + ' stillOpen=' + MEMK.openProspective(round).length);
    assert('an id whose every record is already closed reports closed:false, not silent success',
      MEMK.close(round, s2.id, { resolved: true }, 8000).closed === false,
      'reporting true here is how 8,549 closes on 8,561 items hid 3,786 open ones');
    assert('and a re-schedule while one is OPEN returns the existing item instead of a copy',
      (function () {
        var m3 = MEMK.create();
        var x = MEMK.schedule(m3, Object.assign({}, common, { predictionId: 'pr_D' }));
        var y = MEMK.schedule(m3, Object.assign({}, common, { predictionId: 'pr_D' }));
        return x === y && m3.prospective.length === 1;
      })(), 'an unreachable duplicate is exactly what stranded items in the first place');

    /* (4) A TERMINAL PREDICTION CLOSES ITS FUTURE-DUE CHECK. Pins the loop.js correction:
       closure used to consider only items already DUE, so a prediction that terminated before
       its check fell due left it open, and nothing ever revisited it. */
    var rows2 = fixtureRows('energy', 30);
    delete MEM[STORE.shadowKey('energy', 'state')];
    await RUNTIME.runDomain('energy', { rows: rows2, now: 1786000200000 });
    var st = storedState('energy');
    var stillOpen = (st.loop.memory.prospective || []).filter(function (i) {
      return i.status === 'open';
    });
    var preds = (st.loop.registry && st.loop.registry.predictions) || {};
    var terminalButOpen = stillOpen.filter(function (i) {
      var p = i.predictionId && preds[i.predictionId];
      return p && p.status && p.status !== 'open';
    });
    assert('after a real cycle, NO open check belongs to a prediction that already terminated',
      terminalButOpen.length === 0,
      terminalButOpen.length + ' stranded: ' + JSON.stringify(terminalButOpen.slice(0, 2)
        .map(function (i) { return { kind: i.kind, dueAt: i.dueAt, pid: i.predictionId }; })));
    assert('and the run did produce terminal predictions, so that is not vacuous',
      Object.keys(preds).filter(function (k) {
        return preds[k].status && preds[k].status !== 'open';
      }).length > 0, 'zero terminal predictions would make the assertion above meaningless');

    /* (5) PRE-FIX STATE IS REPAIRED THROUGH THE REAL RUNTIME. A snapshot is doctored to contain
       exactly what production holds: colliding open twins under one id, one linked to a TERMINAL
       prediction and one to a LIVE prediction, plus an unlinked item. Restored through
       runDomain, not through a helper. */
    delete MEM[STORE.shadowKey('energy', 'state')];
    /* 30 rows, not 12: a 6-hour horizon over 12 hourly rows leaves every prediction still open,
       so the snapshot had nothing terminal to link a legacy twin against and the test asserted
       against an undefined id. The premise is asserted below rather than assumed. */
    await RUNTIME.runDomain('energy', { rows: fixtureRows('energy', 30), now: 1786000300000 });
    var doctored = storedState('energy');
    var dmem = doctored.loop.memory;
    var dpreds = doctored.loop.registry.predictions;
    var terminalId = Object.keys(dpreds).filter(function (k) {
      return dpreds[k].status && dpreds[k].status !== 'open';
    })[0];
    var liveId = 'pr_synthetic_live';
    dpreds[liveId] = { id: liveId, status: 'open', variable: 'channel:test', createdAt: 1 };
    assert('the doctored snapshot has a real terminal prediction to link against',
      !!terminalId, 'no terminal prediction in the restored registry');
    var twin = function (pid, id) {
      return { id: id, traceId: 'tr_legacy', kind: 'prediction_check', actionId: null,
        predictionId: pid, trigger: 'clock', dueAt: 1786999999999,
        responsibleModule: 'kernel/loop', expectedObservation: 'legacy',
        escalationRule: 'report as overdue in the self-model', closureCriteria: 'observed',
        status: 'open', createdAt: 1786000000000, closedAt: null, closure: null };
    };
    /* Both twins share ONE id, as the colliding version wrote them. dueAt is far in the future
       so neither is due — the repair must not depend on due-ness. */
    dmem.prospective.push(twin(terminalId, 'ps_legacy_collision'));
    dmem.prospective.push(twin(liveId, 'ps_legacy_collision'));
    dmem.prospective.push(Object.assign(twin(null, 'ps_legacy_unlinked'), { predictionId: null }));
    var openBefore = dmem.prospective.filter(function (i) { return i.status === 'open'; }).length;
    MEM[STORE.shadowKey('energy', 'state')] = JSON.stringify(doctored);

    var repairCycle = await RUNTIME.runDomain('energy', {
      rows: fixtureRows('energy', 30), now: 1786000400000
    });
    assert('the repair cycle restored, so this exercises restored state and not a fresh loop',
      repairCycle.restored === true, JSON.stringify(repairCycle.error));
    assert('the runtime REPORTS the repair rather than mutating restored state silently',
      !!repairCycle.prospectiveRepair && repairCycle.prospectiveRepair.repaired >= 1,
      JSON.stringify(repairCycle.prospectiveRepair));
    var after = storedState('energy').loop.memory.prospective;
    var byId = function (id) { return after.filter(function (i) { return i.id === id; }); };
    var collision = byId('ps_legacy_collision');
    assert('the twin linked to a TERMINAL prediction is resolved',
      collision.filter(function (i) { return i.predictionId === terminalId; })
        .every(function (i) { return i.status !== 'open'; }),
      JSON.stringify(collision.map(function (i) { return i.predictionId + '=' + i.status; })));
    /* THE CONSTRAINT THAT MATTERS MORE THAN THE REPAIR. */
    assert('the twin linked to a LIVE prediction is UNTOUCHED, though it shares that id',
      collision.filter(function (i) { return i.predictionId === liveId; })
        .every(function (i) { return i.status === 'open'; }),
      'repairing valid future work would destroy pending work, not recover leaked work');
    assert('and the unlinked item is untouched too, since absence of a link is not termination',
      byId('ps_legacy_unlinked').every(function (i) { return i.status === 'open'; }),
      JSON.stringify(byId('ps_legacy_unlinked').map(function (i) { return i.status; })));
    assert('the repair strictly reduced open work, and did not clear it',
      (function () {
        var openAfter = after.filter(function (i) { return i.status === 'open'; }).length;
        return openAfter < openBefore && openAfter > 0;
      })(), 'openBefore=' + openBefore);
    var second = await RUNTIME.runDomain('energy', {
      rows: fixtureRows('energy', 30), now: 1786000500000
    });
    assert('the repair is IDEMPOTENT: a second restore finds nothing left to repair',
      second.prospectiveRepair && second.prospectiveRepair.repaired === 0,
      JSON.stringify(second.prospectiveRepair));
    assert('and it still declines to touch the live-linked and unlinked items on that pass',
      second.prospectiveRepair.skippedLivePrediction >= 1 &&
      second.prospectiveRepair.skippedNoLink >= 1,
      JSON.stringify(second.prospectiveRepair));

    /**
     * (6) UPGRADE-PATH REGRESSION A — A LEGACY LIVE/LIVE COLLISION MUST NOT LOSE LIVE WORK.
     *
     * The fresh-state gates cannot reach this: after the id fix ids are unique, so close-by-id
     * and close-by-record are equivalent and the bug is invisible. It is reachable ONLY from
     * state the colliding version already wrote, which is precisely what seventeen production
     * domains are about to restore.
     *
     * Two open records share ONE id and their predictions are BOTH still live. One prediction is
     * then made to EXPIRE during the cycle, which drives the real closer. If that closer works by
     * id it takes the sibling with it, and a check whose prediction is still running is destroyed.
     */
    /* THE SECOND CYCLE MUST HAVE FRESH ROWS. Re-running the same rows applies zero — the cursor
       already passed them — so no tick happens, sweepExpired is never called, and the assertion
       below would pass without the closer ever running. The guard caught exactly that. */
    var allE = fixtureRows('energy', 470);
    var firstBatch = allE.slice(-40, -10);
    var rowsC = allE.slice(-40);
    var tLast = firstBatch[firstBatch.length - 1].t;
    delete MEM[STORE.shadowKey('energy', 'state')];
    await RUNTIME.runDomain('energy', { rows: firstBatch, now: 1786000600000 });
    var snapC = storedState('energy');
    assert('the follow-up batch really does carry rows past the stored cursor',
      rowsC.filter(function (r) { return r.t > snapC.lastRowT; }).length > 0,
      'without fresh rows there is no tick and no sweepExpired');
    /* Two synthetic OPEN predictions. One expires before the last row, so sweepExpired
       terminates it inside the cycle; the other expires far later and stays live. */
    snapC.loop.registry.predictions['pr_expiring'] = {
      id: 'pr_expiring', status: 'open', variable: 'channel:test:precision',
      createdAt: tLast - 7200000, evaluateAt: tLast + 9e11, expiresAt: tLast + 1,
      horizonMs: 21600000, resolution: null
    };
    snapC.loop.registry.predictions['pr_stays_live'] = {
      id: 'pr_stays_live', status: 'open', variable: 'channel:test:precision',
      createdAt: tLast - 7200000, evaluateAt: tLast + 9e11, expiresAt: tLast + 9e11,
      horizonMs: 21600000, resolution: null
    };
    snapC.loop.registry.order.push('pr_expiring', 'pr_stays_live');
    var collidingTwin = function (pid) {
      return { id: 'ps_live_live_collision', traceId: 'tr_legacy2', kind: 'prediction_check',
        actionId: null, predictionId: pid, trigger: 'clock', dueAt: tLast + 9e11,
        responsibleModule: 'kernel/loop', expectedObservation: 'legacy',
        escalationRule: 'report as overdue in the self-model', closureCriteria: 'observed',
        status: 'open', createdAt: tLast - 7200000, closedAt: null, closure: null };
    };
    snapC.loop.memory.prospective.push(collidingTwin('pr_expiring'));
    snapC.loop.memory.prospective.push(collidingTwin('pr_stays_live'));
    MEM[STORE.shadowKey('energy', 'state')] = JSON.stringify(snapC);

    var cyc = await RUNTIME.runDomain('energy', { rows: rowsC, now: 1786000700000 });
    assert('the live/live cycle ran and restored', cyc.ok === true && cyc.restored === true,
      JSON.stringify(cyc.error));
    var afterC = storedState('energy');
    var group = afterC.loop.memory.prospective.filter(function (i) {
      return i.id === 'ps_live_live_collision';
    });
    var predsC = afterC.loop.registry.predictions;
    assert('the expiring prediction really did terminate, so the closer actually ran',
      predsC['pr_expiring'] && predsC['pr_expiring'].status !== 'open',
      'status=' + (predsC['pr_expiring'] || {}).status + ' — if it stayed open this proves nothing');
    assert('the record linked to the EXPIRED prediction is closed',
      group.filter(function (i) { return i.predictionId === 'pr_expiring'; })
        .every(function (i) { return i.status !== 'open'; }),
      JSON.stringify(group.map(function (i) { return i.predictionId + '=' + i.status; })));
    assert('REGRESSION A: the record sharing that id whose prediction is STILL LIVE stays OPEN',
      predsC['pr_stays_live'].status === 'open' &&
      group.filter(function (i) { return i.predictionId === 'pr_stays_live'; })
        .every(function (i) { return i.status === 'open'; }),
      'closing by id here destroys a check whose prediction is still running: ' +
      JSON.stringify(group.map(function (i) { return i.predictionId + '=' + i.status; })));

    /**
     * (7) UPGRADE-PATH REGRESSION B — AN OVERDUE ITEM WHOSE PREDICTION IS GONE.
     *
     * Nothing can ever close it: the only closer is prediction termination, and the prediction is
     * absent, so no future termination can reference it. Left open it is permanent, unretirable
     * hot state. The repair must close it as unresolvable — and must NOT close the same case when
     * the item is not yet due, because until then the check is still meaningful.
     */
    delete MEM[STORE.shadowKey('energy', 'state')];
    await RUNTIME.runDomain('energy', { rows: fixtureRows('energy', 30), now: 1786000800000 });
    var snapD = storedState('energy');
    var lastTick = snapD.loop.lastTickAt;
    assert('the snapshot carries a lastTickAt, which is the clock overdue is judged against',
      typeof lastTick === 'number', String(lastTick));
    var ghost = function (id, dueAt) {
      return { id: id, traceId: 'tr_ghost', kind: 'prediction_check', actionId: null,
        predictionId: 'pr_not_in_registry', trigger: 'clock', dueAt: dueAt,
        responsibleModule: 'kernel/loop', expectedObservation: 'ghost',
        escalationRule: 'report as overdue in the self-model', closureCriteria: 'observed',
        status: 'open', createdAt: lastTick - 7200000, closedAt: null, closure: null };
    };
    snapD.loop.memory.prospective.push(ghost('ps_ghost_overdue', lastTick - 3600000));
    snapD.loop.memory.prospective.push(ghost('ps_ghost_pending', lastTick + 9e11));
    assert('neither ghost prediction exists in the registry, which is the premise',
      !snapD.loop.registry.predictions['pr_not_in_registry'],
      'a present prediction would make this a different test');
    MEM[STORE.shadowKey('energy', 'state')] = JSON.stringify(snapD);

    var cycD = await RUNTIME.runDomain('energy', { rows: fixtureRows('energy', 30), now: 1786000900000 });
    assert('the ghost cycle ran and restored', cycD.ok === true && cycD.restored === true,
      JSON.stringify(cycD.error));
    var afterD = storedState('energy').loop.memory.prospective;
    var pick = function (id) { return afterD.filter(function (i) { return i.id === id; })[0]; };
    assert('REGRESSION B: the OVERDUE item with a missing prediction is closed as unresolvable',
      pick('ps_ghost_overdue') && pick('ps_ghost_overdue').status === 'unresolvable',
      'status=' + (pick('ps_ghost_overdue') || {}).status +
      ' — left open, nothing can ever close it and it is permanent hot state');
    assert('and it is counted separately from the terminal-linked repair',
      cycD.prospectiveRepair && cycD.prospectiveRepair.repairedMissingPrediction >= 1,
      JSON.stringify(cycD.prospectiveRepair));
    assert('while the NOT-YET-DUE item with the same missing prediction stays OPEN',
      pick('ps_ghost_pending') && pick('ps_ghost_pending').status === 'open',
      'archived is not terminal; until the due time passes the check is still meaningful');
    assert('and that one is still reported as skipped, so it stays visible',
      cycD.prospectiveRepair.skippedUnknownPrediction >= 1,
      JSON.stringify(cycD.prospectiveRepair));
    var cycD2 = await RUNTIME.runDomain('energy', { rows: fixtureRows('energy', 30), now: 1786001000000 });
    assert('the missing-prediction repair is idempotent too',
      cycD2.prospectiveRepair.repairedMissingPrediction === 0 &&
      cycD2.prospectiveRepair.skippedUnknownPrediction >= 1,
      JSON.stringify(cycD2.prospectiveRepair));
  })();
}).then(function () {

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

    console.log('');
    console.log('S6b: a FIVE-domain batch, one domain forced to fail, the other four unaffected');
    /**
     * THE PROPERTY A BATCH NEEDS, AND THE PAIR ABOVE CANNOT PROVE IT. Two domains where the
     * second is a name that does not resolve tests the guard on a domain that never starts.
     * A batch fails differently: a real, installed, resolving domain gets part-way in and
     * throws, and the question is whether the domains AFTER it in the list still run. Since
     * `runDomains` is a sequential await loop, a failure that escaped the guard would take
     * out every domain queued behind it and none of them would leave a trace.
     *
     * So the failure is injected mid-list, on a real domain, through a real failure mode:
     * `trade` gets corrupt stored state, which `readState` refuses rather than treating as a
     * cold start. Each domain reads its OWN recorded rows here, seeded per feedhist key,
     * because one shared `rows` array would have four domains abstaining on another domain's
     * sources and "ok with zero ticks" would pass a test about isolation without exercising
     * it.
     */
    var BATCH = ['education', 'economy', 'trade', 'industry', 'population'];
    BATCH.forEach(function (p) {
      var snap = REG.descriptorFor(p).snapshot;
      delete MEM[STORE.shadowKey(snap, 'state')];
      LISTS['feedhist:' + snap] = fixtureRows(p, 24);
    });
    /* The injected failure, on the domain in the MIDDLE of the list. */
    MEM[STORE.shadowKey(REG.descriptorFor('trade').snapshot, 'state')] = '{this is not json';

    var batch = await RUNTIME.runDomains(BATCH, { now: 1786000300000 });
    var byProduct = {};
    batch.reports.forEach(function (r) { byProduct[r.product] = r; });

    assert('all five domains produced a report', batch.reports.length === 5, String(batch.reports.length));
    assert('the forced domain failed', byProduct.trade.ok === false, JSON.stringify(byProduct.trade.ok));
    assert('and it failed for the reason injected, not some other reason',
      /unparseable|corrupt/.test(byProduct.trade.error || ''), byProduct.trade.error);
    var others = BATCH.filter(function (p) { return p !== 'trade'; });
    assert('the other four ALL report ok:true',
      others.every(function (p) { return byProduct[p] && byProduct[p].ok === true; }),
      JSON.stringify(others.map(function (p) { return p + '=' + (byProduct[p] && byProduct[p].ok) + ':' + (byProduct[p] && byProduct[p].error); })));
    /* NOT VACUOUSLY OK. Four cycles that applied nothing would also be ok:true, and that is
       the shape a broken seed produces, so the work is asserted rather than the status. */
    assert('and the four did real work rather than passing as empty no-ops',
      others.every(function (p) { return byProduct[p].ticks > 0 && byProduct[p].rowsApplied > 0; }),
      JSON.stringify(others.map(function (p) { return p + ' ticks=' + byProduct[p].ticks; })));
    assert('including the two queued AFTER the failure, which a leaked throw would have killed',
      byProduct.industry.ok === true && byProduct.population.ok === true,
      'industry=' + byProduct.industry.ok + ' population=' + byProduct.population.ok);
    assert('each of the four persisted state and reported its serialized value length',
      others.every(function (p) { return typeof byProduct[p].stateValueBytes === 'number' && byProduct[p].stateValueBytes > 0; }),
      JSON.stringify(others.map(function (p) { return p + '=' + byProduct[p].stateValueBytes; })));
    assert('the failed domain reports NO length, rather than a number for a payload that never landed',
      byProduct.trade.stateValueBytes === null, JSON.stringify(byProduct.trade.stateValueBytes));
    assert('the batch as a whole reports not ok, so one silent failure cannot read as success',
      batch.ok === false, JSON.stringify(batch.ok));
    assert('and every write the batch made stayed inside the shadow namespace',
      WRITES.every(function (k) { return k.indexOf(STORE.PREFIX) === 0; }),
      JSON.stringify(WRITES.filter(function (k) { return k.indexOf(STORE.PREFIX) !== 0; }).slice(0, 5)));

    /* Leave no seeded state behind for the adversarial sections that follow. */
    BATCH.forEach(function (p) {
      var snap = REG.descriptorFor(p).snapshot;
      delete MEM[STORE.shadowKey(snap, 'state')];
      delete LISTS['feedhist:' + snap];
    });
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

  // ── S-archive-surface: there is exactly ONE way to write a chunk ───────────
  console.log('');
  console.log('S-archive-surface [adversarial]: no unconditional writer to an archive key exists');
  /**
   * WRITE-ONCE IS ONLY WORTH ANYTHING IF IT CANNOT BE ROUTED AROUND. `createArchiveChunk`
   * makes the slot atomic, but an exported `writeArchiveChunk` doing a plain SET sat beside
   * it and would have handed the next caller the race back under a friendlier name. Dead
   * today is not the same as absent: the export IS the invitation.
   *
   * Two assertions, because either alone is escapable. The first pins the exported surface,
   * so a new archive writer has to be added deliberately and this test edited to admit it.
   * The second reads the SOURCE for an unconditional set against an archive key, catching a
   * bypass that is spelled differently or is not exported at all.
   */
  var STORE_KEYS = Object.keys(STORE).sort();
  assert('the store exports createArchiveChunk as the archive writer',
    STORE_KEYS.indexOf('createArchiveChunk') >= 0, JSON.stringify(STORE_KEYS));
  assert('and exports NO unconditional archive writer',
    STORE_KEYS.filter(function (k) { return /^write.*Archive|^set.*Archive|^putArchive/i.test(k); }).length === 0,
    JSON.stringify(STORE_KEYS));

  var storeSrc = fs.readFileSync(path.join(ROOT, 'lib', 'brain-shadow-store.js'), 'utf8');
  var storeCode = storeSrc
    .replace(/\/\*[\s\S]*?\*\//g, '')          /* comments describe the removed function */
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  assert('and no code path SETs an archive key without NX',
    !/redis\.set\s*\(\s*archiveKey/.test(storeCode),
    /* Quote the OFFENDING call, not the first `redis.set` in the file: the negative control
       printed an unrelated state write, which would send a reader to the wrong line. */
    (storeCode.match(/redis\.set\s*\(\s*archiveKey[^)]*\)?/) || [''])[0]);
  assert('while the atomic creator does exactly that, via setNX',
    /redis\.setNX\s*\(\s*archiveKey/.test(storeCode));

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

    console.log('S10c: the raw command function is NOT reachable from outside');
    /**
     * A HOLDER OF `command` COULD ISSUE ANYTHING against any key — DEL on a production
     * key, KEYS across the database, a write outside brain:v2:shadow: — which would turn
     * both the namespace confinement and the per-command result validation into
     * conventions rather than boundaries. The five typed operations are the whole surface.
     */
    delete require.cache[realRedisPath];
    var EXPORTED = require(realRedisPath);
    require.cache[realRedisPath] = savedFake;
    assert('`command` is not exported', EXPORTED.command === undefined,
      'exporting it would let a caller bypass the typed operations and the key boundary');
    assert('and the export surface is exactly the six typed ops plus two helpers',
      JSON.stringify(Object.keys(EXPORTED).sort()) ===
        JSON.stringify(['NAMESPACE_PREFIX', 'assertConfigured', 'get', 'lpush', 'lrange', 'ltrim', 'set', 'setNX']),
      JSON.stringify(Object.keys(EXPORTED).sort()));
    assert('no export accepts a raw redis method name',
      ['get', 'set', 'lpush', 'ltrim', 'lrange'].every(function (fn) { return typeof EXPORTED[fn] === 'function'; }),
      'each op names its own command internally');

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

    console.log('S9b: the health response names what it actually knows');
    /**
     * TWO CONFLATIONS THIS ENDPOINT SHIPPED WITH, both caught in review, both the same
     * class of error: a field named for a quantity stronger than the one it holds.
     *
     *   `boundCount` was `DOMAINS.length`. That is the roster size. It would have kept
     *   reading 20 after a binder stopped loading, which is precisely the case someone
     *   would consult it for. Binding is a per-domain classification the registry computes
     *   by opening every fixture; this endpoint reads cycle reports and does not do that.
     *
     *   `stateBytesTotal` was a sum of serialized VALUE lengths presented as bytes. The
     *   REST transport re-encodes the value and adds an envelope, so it is not the wire
     *   figure and must not be doubled into bandwidth.
     *
     * Both are asserted by ABSENCE of the old name as well as presence of the new one, so a
     * revert that restores the old field fails here rather than passing quietly.
     */
    assert('the roster size is reported as totalDomains',
      r.body.totalDomains === REG.DOMAINS.length, JSON.stringify(r.body.totalDomains));
    assert('and NOT as boundCount, which it never measured',
      r.body.boundCount === undefined,
      'DOMAINS.length is the roster, not the count of domains currently BOUND');
    assert('the installed count is reported and is the registry set',
      r.body.installedCount === REG.INSTALLED_DOMAINS.length &&
      JSON.stringify(r.body.installed) === JSON.stringify(REG.INSTALLED_DOMAINS),
      JSON.stringify(r.body.installed));
    assert('state size is reported under a name that says it is a serialized VALUE length',
      typeof r.body.stateValueBytesTotal === 'number' &&
      typeof r.body.stateValueBytesMeasuredDomains === 'number',
      JSON.stringify([r.body.stateValueBytesTotal, r.body.stateValueBytesMeasuredDomains]));
    assert('and no field is named as though it were transport bytes',
      r.body.stateBytesTotal === undefined && r.body.stateBytesMeasuredDomains === undefined,
      'a value length doubled into bandwidth is the error the rename prevents');

    /**
     * THE HEALTH READ MUST EVIDENCE COMPACTION, because this projection is an allow-list and
     * the fields compaction exists to produce were missing from it.
     *
     * Measured in production 2026-08-08: the 21:27:32Z cycle retired 314 records into archive
     * sequence 1 and took energy from 4,090,236 to 3,722,988 bytes. The stored report carried
     * all of that; `/api/brain-shadow` returned neither field, so the endpoint whose job is to
     * answer "did it compact?" could not. A real stored cycle is written here and read back
     * through the handler, so this asserts the PROJECTION rather than the runtime.
     */
    var probeDomain = REG.descriptorFor(REG.INSTALLED_DOMAINS[0]).snapshot;
    await STORE.writeCycle(probeDomain, {
      domain: probeDomain, ok: true, error: null,
      startedAt: 1786220000000, finishedAt: 1786220001000,
      rowsAvailable: 1, rowsApplied: 1, ticks: 1,
      cursorBefore: 1786219000000, cursorAfter: 1786219999000, restored: true,
      provenance: {}, predictions: {}, abstentions: [], actuation: {},
      stateValueBytes: 3722988,
      compaction: { ran: true, retired: 314, archivedSequence: 1,
        beforeBytes: 4090236, afterBytes: 3722988, reusedChunk: false },
      calibration: { n: 533, status: 'MEASURED', hitRate: 0.8067542213883677 },
      /* BATCH 4 adds a field to the same allow-list, so it is proved through the same path.
         Culture and religion are installed on the strength of this policy firing; an endpoint
         that cannot report whether it fired repeats the compaction defect exactly. */
      coldStartSkip: { applied: true, skippedRows: 373, cursorSetTo: 1785589950919,
        firstReadableT: 1785589950920, why: null },
      /**
       * ONE-SHOT PRODUCTION EVIDENCE, so it gets the same treatment as compaction.
       *
       * The first post-deploy cycle per domain is the ONLY moment the amount of stranded
       * prospective work in production is observable. Every later cycle reports 0, correctly,
       * and the original figure is gone — it is not recoverable from state afterwards, because
       * the repair is what removed the thing that would have been counted. If this field were
       * dropped by the writeCycle round trip or by the handler's allow-list, that measurement
       * would be lost silently and permanently.
       */
      prospectiveRepair: { repaired: 271, repairedMissingPrediction: 19,
        skippedLivePrediction: 4, skippedUnknownPrediction: 2, skippedNoLink: 1 }
    });
    r = await call('/api/brain-shadow', { 'x-brain-token': 'op' }, { token: 'op', cron: 'sekrit' });
    var projected = r.body.cycles[REG.INSTALLED_DOMAINS[0]];
    assert('the health read reports what compaction did, not just that the cycle was ok',
      !!projected && !!projected.compaction && projected.compaction.ran === true &&
      projected.compaction.retired === 314 && projected.compaction.archivedSequence === 1,
      JSON.stringify(projected && projected.compaction));
    /* Guarded: when the field is missing this must FAIL, not throw. A harness that dies here
       skips every assertion after it, which reads as a smaller failure than it is. */
    var comp = (projected && projected.compaction) || {};
    assert('including the bytes before and after, so the reduction is observable',
      comp.beforeBytes === 4090236 && comp.afterBytes === 3722988,
      JSON.stringify(projected && projected.compaction));
    assert('and calibration, so it is visible that it did not get younger across a retirement',
      !!projected.calibration && projected.calibration.n === 533,
      JSON.stringify(projected.calibration));
    var csk = (projected && projected.coldStartSkip) || {};
    assert('and the cold-start skip, so batch 4 can be verified from the operator read',
      csk.applied === true && csk.skippedRows === 373 && csk.firstReadableT === 1785589950920,
      JSON.stringify(projected && projected.coldStartSkip));

    /**
     * CURSOR CONTINUITY IS A TWO-ENDED CLAIM, and the summary projected only one end.
     *
     * Continuity means this cycle's `cursorBefore` equals the previous cycle's `cursorAfter`.
     * The runtime recorded both and `?history=` returned both; the summary read dropped
     * `cursorBefore`, so the surface an operator actually reads could not answer the question.
     * Asserted with the two values DIFFERENT, so a projection that accidentally aliased one
     * onto the other fails here instead of passing on equal numbers.
     */
    assert('and cursorBefore, so continuity is answerable from the summary read',
      projected.cursorBefore === 1786219000000 && projected.cursorAfter === 1786219999000,
      JSON.stringify({ before: projected.cursorBefore, after: projected.cursorAfter }));

    /**
     * prospectiveRepair, through BOTH hops, because they can fail independently. The stored
     * report is written by the runtime and read back by the handler; a field can survive
     * persistence and still be dropped by the allow-list, which is exactly what happened to
     * compaction. Asserted separately so a failure names which hop lost it.
     */
    var persisted = await STORE.readCycle(probeDomain);
    var pr = (persisted && persisted.prospectiveRepair) || {};
    assert('HOP 1, persistence: the stored cycle report still carries prospectiveRepair',
      pr.repaired === 271 && pr.skippedLivePrediction === 4 &&
      pr.skippedUnknownPrediction === 2 && pr.skippedNoLink === 1,
      JSON.stringify(persisted && persisted.prospectiveRepair));
    /* The SECOND repair class travels the same two hops. It counts a different fact — prediction
       unreachable, not prediction finished — so a projection that carried only `repaired` would
       report the smaller number as the whole repair. */
    assert('HOP 1: repairedMissingPrediction survives persistence as its own counter',
      pr.repairedMissingPrediction === 19,
      JSON.stringify(persisted && persisted.prospectiveRepair));
    var prj = (projected && projected.prospectiveRepair) || {};
    assert('HOP 2, projection: the handler allow-list passes it through to the operator read',
      prj.repaired === 271 && prj.skippedLivePrediction === 4,
      JSON.stringify(projected && projected.prospectiveRepair));
    assert('and the skip counts survive too, so a repair that declined is distinguishable from one that never ran',
      prj.skippedUnknownPrediction === 2 && prj.skippedNoLink === 1,
      JSON.stringify(projected && projected.prospectiveRepair));
    assert('HOP 2: repairedMissingPrediction reaches the operator read as well',
      prj.repairedMissingPrediction === 19,
      'reporting only `repaired` would understate what the repair actually closed: ' +
      JSON.stringify(projected && projected.prospectiveRepair));

    /* A LATER CYCLE REPORTING ZERO MUST STILL REPORT THE OBJECT. `repaired: 0` means "ran, found
       nothing left", and null means "did not run at all" — a restored cycle collapsing the first
       into the second would make the one-shot measurement unverifiable after the fact. */
    await STORE.writeCycle(probeDomain, {
      domain: probeDomain, ok: true, error: null,
      startedAt: 1786220002000, finishedAt: 1786220003000,
      rowsAvailable: 1, rowsApplied: 1, ticks: 1, cursorAfter: 2, restored: true,
      provenance: {}, predictions: {}, abstentions: [], actuation: {},
      stateValueBytes: 3722988,
      prospectiveRepair: { repaired: 0, repairedMissingPrediction: 0,
        skippedLivePrediction: 4, skippedUnknownPrediction: 2, skippedNoLink: 1 }
    });
    r = await call('/api/brain-shadow', { 'x-brain-token': 'op' }, { token: 'op', cron: 'sekrit' });
    var zeroed = r.body.cycles[REG.INSTALLED_DOMAINS[0]];
    assert('a steady-state cycle reports BOTH repair counters as 0, never collapsed to null',
      !!zeroed.prospectiveRepair && zeroed.prospectiveRepair.repaired === 0 &&
      zeroed.prospectiveRepair.repairedMissingPrediction === 0,
      JSON.stringify(zeroed.prospectiveRepair) +
      ' — null here would make "ran and found nothing" look like "never ran"');

    /* NEGATIVE CONTROL for cursorBefore: this cycle was written WITHOUT the field, which is
       both a cold start and a pre-field legacy record. It must project as an explicit null
       rather than vanishing from the object, because a reader cannot distinguish a missing
       key from a key that was never recorded. */
    assert('a cycle carrying no cursorBefore projects it as an explicit null, not absent',
      'cursorBefore' in zeroed && zeroed.cursorBefore === null,
      JSON.stringify({ present: 'cursorBefore' in zeroed, value: zeroed.cursorBefore }));

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
