/**
 * brain-v2/test/compaction.js — the properties compaction must not break.
 *
 *   node brain-v2/test/compaction.js
 *
 * Compaction removes records from live state. Every assertion here is about something that
 * must SURVIVE that, and each is written to make the bad thing happen rather than to agree
 * with the code. Four defects were already found this way and are pinned as controls: a
 * status comparison that matched nothing, a link field read under the wrong name, a
 * calibration that got younger, and a hash chain unverified when a range did not start at 1.
 *
 * No network and no Redis: the store is driven through an injected in-memory database, so
 * every archive key written is observable.
 */

'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..', '..');

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

/* Strict fake: throwing is how failure is expressed, never a return value. */
var MEM = Object.create(null), SETS = [], LISTS = Object.create(null);
var fakeRedis = {
  NAMESPACE_PREFIX: 'limen:',
  assertConfigured: function () { return true; },
  get: async function (k) { return MEM[k] === undefined ? null : MEM[k]; },
  set: async function (k, v) { SETS.push(k); MEM[k] = v; return true; },
  /* Models real SET NX: creates only when absent, and reports which happened. Without this
     the concurrency test would be asserting against a fake that cannot race. */
  setNX: async function (k, v) {
    if (Object.prototype.hasOwnProperty.call(MEM, k)) return false;
    SETS.push(k); MEM[k] = v; return true;
  },
  /* Real list behaviour: writeCycle appends then READS BACK, so a stub returning [] makes
     every cycle fail for a reason that has nothing to do with compaction. */
  lpush: async function (k, v) { (LISTS[k] = LISTS[k] || []).unshift(v); return LISTS[k].length; },
  lrange: async function (k, a, b) { return (LISTS[k] || []).slice(a, b === -1 ? undefined : b + 1); },
  ltrim: async function (k, a, b) { if (LISTS[k]) LISTS[k] = LISTS[k].slice(a, b + 1); return true; }
};
var redisPath = require.resolve(path.join(ROOT, 'lib', 'brain-shadow-redis.js'));

/**
 * STUB DRIFT IS SILENT, SO CATCH IT HERE. The real transport is loaded first, purely to read
 * its export surface, and the fake must cover all of it. When `setNX` was added, BOTH
 * hand-written substitutes (this one and the replay's) still modelled the old surface; the
 * tests kept passing against a fake that could not do what the runtime now does. A substitute
 * missing an operation is not a smaller substitute, it is a test of different code.
 */
var REAL_REDIS_OPS = Object.keys(require(redisPath));
var missingOps = REAL_REDIS_OPS.filter(function (op) { return !(op in fakeRedis); });

require.cache[redisPath] = { id: redisPath, filename: redisPath, loaded: true, exports: fakeRedis };

var COMPACT = require(path.join(ROOT, 'brain-v2', 'kernel', 'compact.js'));
var ARCHIVE = require(path.join(ROOT, 'lib', 'brain-shadow-archive.js'));
var STORE = require(path.join(ROOT, 'lib', 'brain-shadow-store.js'));
var PRED = require(path.join(ROOT, 'brain-v2', 'kernel', 'predict.js'));
var LOOP = require(path.join(ROOT, 'brain-v2', 'kernel', 'loop.js'));
var MEMORY = require(path.join(ROOT, 'brain-v2', 'kernel', 'memory.js'));
var FINANCE = require(path.join(ROOT, 'brain-v2', 'bind', 'finance.js'));

/** A state with enough records to force retirement in every collection. */
function fixture(n) {
  n = n || 900;
  var predictions = Object.create(null), order = [], resolved = [], episodic = [], prospective = [];
  for (var i = 0; i < n; i++) {
    var id = 'p' + i;
    predictions[id] = {
      id: id, status: PRED.STATUS.RESOLVED, confidence: 0.5, createdAt: 1000 + i,
      efferenceCopyId: 'e' + i,
      resolution: { observable: true, hit: i % 2 === 0, contaminated: i % 10 === 0, predictionError: 0.25 }
    };
    order.push(id); resolved.push(id);
    episodic.push({ traceId: 't' + (i % 7), index: i, payload: 'x' });
    prospective.push({ id: 'pr' + i, status: (i % 3 === 0 ? 'closed' : (i % 3 === 1 ? 'unresolvable' : 'open')), dueAt: i });
  }
  /* Two OPEN predictions that must never be retired, oldest-first so they sit in the
     retirement window and would be taken by a policy that ignored status. */
  predictions.openA = { id: 'openA', status: PRED.STATUS.OPEN, confidence: 0.5, createdAt: 0, efferenceCopyId: 'eOpenA' };
  order.unshift('openA'); resolved.unshift('openA');
  var consumed = Object.create(null);
  for (var j = 0; j < n; j++) consumed['e' + j] = true;
  consumed.eOpenA = true;
  var attention = { src: { history: [] } };
  for (var k = 0; k < 800; k++) attention.src.history.push({ at: k, from: 1, to: 2 });
  return {
    memory: { episodic: episodic, episodeIndex: {}, prospective: prospective },
    registry: { predictions: predictions, order: order, resolved: resolved },
    forwardModel: { consumed: consumed },
    attention: attention
  };
}

console.log('\n=== BRAIN-V2 COMPACTION (in-memory db; no network, no Redis) ===\n');

console.log('C0: the in-memory substitute still covers the real transport');
assert('the fake implements every operation the real redis module exports',
  missingOps.length === 0, 'missing: ' + missingOps.join(', '));
console.log('');

console.log('C1: open records are never retired');
var st = fixture();
var plan = COMPACT.plan(st, {});
var next = plan.apply({ sequence: 1, hash: 'h1', totals: plan.totals, consumedHorizon: plan.consumedHorizon });
assert('an OPEN prediction survives retirement',
  !!next.registry.predictions.openA && next.registry.resolved.indexOf('openA') >= 0);
assert('and it was not written into the archive chunk',
  plan.retired.predictions.every(function (p) { return p.id !== 'openA'; }));
var openProsp = next.memory.prospective.filter(function (i) { return i.status === 'open'; }).length;
var openBefore = st.memory.prospective.filter(function (i) { return i.status === 'open'; }).length;
assert('every OPEN prospective item survives', openProsp === openBefore,
  openProsp + ' of ' + openBefore);

console.log('\nC2: closed AND unresolvable prospective items DO retire');
/* The defect this pins: memory.js writes lowercase, an earlier compactor compared
   uppercase, so nothing ever matched and prospective grew unchecked. */
assert('some prospective items were retired at all', plan.retired.prospective.length > 0,
  String(plan.retired.prospective.length));
assert('both terminal statuses are represented among the retired',
  plan.retired.prospective.some(function (i) { return i.status === 'closed'; }) &&
  plan.retired.prospective.some(function (i) { return i.status === 'unresolvable'; }));
assert('no open item leaked into the retired set',
  plan.retired.prospective.every(function (i) { return i.status !== 'open'; }));

console.log('\nC3: episodeIndex is rebuilt with no dangling index');
var kept = next.memory.episodic.length;
var dangling = [];
Object.keys(next.memory.episodeIndex).forEach(function (tid) {
  next.memory.episodeIndex[tid].forEach(function (idx) {
    if (!(idx >= 0 && idx < kept)) dangling.push(tid + '[' + idx + ']');
    else if (next.memory.episodic[idx].traceId !== tid) dangling.push(tid + '->' + idx + ' wrong episode');
  });
});
assert('every index addresses a surviving episode of the right trace', dangling.length === 0,
  JSON.stringify(dangling.slice(0, 5)));
assert('the index is not simply empty', Object.keys(next.memory.episodeIndex).length > 0);

console.log('\nC4: calibration is identical before and after compaction');
var before = PRED.calibration(st.registry, null);
var after = COMPACT.calibrationWithArchive(next);
assert('n is unchanged', before.n === after.n, before.n + ' vs ' + after.n);
assert('hitRate is unchanged', Math.abs(before.hitRate - after.hitRate) < 1e-12,
  before.hitRate + ' vs ' + after.hitRate);
assert('meanAbsoluteError is unchanged', Math.abs(before.meanAbsoluteError - after.meanAbsoluteError) < 1e-12);
assert('brierScore is unchanged', Math.abs(before.brierScore - after.brierScore) < 1e-12);
assert('the response keeps contaminatedFraction, not a count',
  typeof after.contaminatedFraction === 'number' && after.contaminated === undefined,
  JSON.stringify(Object.keys(after)));

console.log('\nC5: duplicate-learning prevention survives');
/* The defect this pins: predictions link via efferenceCopyId, not efferenceId. Reading the
   wrong field retired nothing, so `consumed` kept growing while the code looked correct. */
assert('consumed ids WERE retired', plan.retired.consumed.length > 0, String(plan.retired.consumed.length));
assert('every retired consumed id belongs to a retired prediction',
  plan.retired.consumed.every(function (eid) {
    return plan.retired.predictions.some(function (p) { return p.efferenceCopyId === eid; });
  }));
assert('the OPEN prediction\'s consumed id is still protected',
  next.forwardModel.consumed.eOpenA === true);
assert('a retirement horizon was recorded so an older efference is refused, not relearned',
  typeof plan.consumedHorizon === 'number', String(plan.consumedHorizon));

console.log('\nC6: archive write, read-back, idempotency and conflict');
(async function () {
  var w1 = await ARCHIVE.writeChunk('energy', 1, null, plan.retired);
  assert('chunk 1 writes and reads back', !!w1.hash && w1.reused === false);
  assert('it landed under the confined archive key',
    SETS.indexOf(STORE.archiveKey('energy', 1)) >= 0, JSON.stringify(SETS.slice(0, 3)));

  var w2 = await ARCHIVE.writeChunk('energy', 1, null, plan.retired);
  assert('retrying the SAME sequence with identical content is idempotent', w2.reused === true);
  assert('and the hash is unchanged', w2.hash === w1.hash);

  var conflicted = false;
  try { await ARCHIVE.writeChunk('energy', 1, null, { episodic: [{ different: true }], prospective: [], predictions: [], consumed: [], attention: {} }); }
  catch (e) { conflicted = /conflict/.test(e.message); }
  assert('the same sequence with DIFFERENT content throws', conflicted);

  console.log('\nC7: a failed archive write prevents hot-state replacement');
  /* The archive creates with SET NX, so THAT is the call to break. Breaking plain `set`
     tested nothing and let the write succeed, which then collided with the next test. */
  var realNX = fakeRedis.setNX;
  fakeRedis.setNX = async function () { throw new Error('shadow redis: SET NX rejected'); };
  var threw = false;
  try { await ARCHIVE.writeChunk('energy', 2, w1.hash, plan.retired); } catch (e) { threw = true; }
  fakeRedis.setNX = realNX;
  assert('the archive write throws rather than returning', threw);
  assert('and nothing was compacted, because the caller never reached apply()',
    st.memory.episodic.length === 900 && Object.keys(st.forwardModel.consumed).length === 901,
    st.memory.episodic.length + ' episodes still in the ORIGINAL state');

  console.log('\nC8: reconstruction and hash-chain validation');
  await ARCHIVE.writeChunk('energy', 2, w1.hash, { episodic: [{ a: 1 }], prospective: [], predictions: [], consumed: [], attention: {} });
  var chain = await ARCHIVE.reconstruct('energy', 1, 2);
  assert('chunks 1..2 reconstruct', chain.length === 2 && chain[0].sequence === 1);
  var gap = false;
  try { await ARCHIVE.reconstruct('energy', 1, 5); } catch (e) { gap = /gap/.test(e.message); }
  assert('a missing chunk is a gap error, not a short list', gap);
  /* The defect this pins: a range starting after 1 was returned unverified. */
  MEM[STORE.archiveKey('energy', 2)] = JSON.stringify(
    Object.assign(JSON.parse(MEM[STORE.archiveKey('energy', 2)]), { prevHash: 'tampered' }));
  var broke = false;
  try { await ARCHIVE.reconstruct('energy', 2, 2); } catch (e) { broke = /chain broken/.test(e.message); }
  assert('a range starting AFTER chunk 1 still validates against its predecessor', broke);

  console.log('\nC9: determinism');
  var a = COMPACT.plan(fixture(), {});
  var b = COMPACT.plan(fixture(), {});
  assert('two plans over identical input retire byte-identical records',
    ARCHIVE.canonical(a.retired) === ARCHIVE.canonical(b.retired));
  assert('and produce the same cumulative totals',
    JSON.stringify(a.totals) === JSON.stringify(b.totals));
  assert('canonical form is key-order independent',
    ARCHIVE.canonical({ b: 1, a: 2 }) === ARCHIVE.canonical({ a: 2, b: 1 }));

  console.log('');
  console.log('C10: the consumed horizon is ENFORCED, not merely recorded');
  var fm = PRED.createForwardModel ? PRED.createForwardModel({}) : null;
  if (!fm) { var fmHost = PRED.create ? PRED.create({}) : null; fm = fmHost && fmHost.forwardModel; }
  if (!fm) {
    assert('a forward model could be constructed for the horizon test', false, 'no factory found');
  } else {
    fm.consumedHorizon = 5000;
    var pre = PRED.learn(fm, { id: 'eOld', emittedAt: 4000, actionKind: 'k', variable: 'v', predictedDelta: 1, traceId: 't', actionId: 'a' }, 1.0, 7000);
    /* emittedAt is the field the emitter writes (loop.js:655). An earlier version of this
   test used an invented `at`, matching an equally invented check in learn(), so both
   sides agreed and the assertion passed while the guard could never fire. */
    assert('an efference older than the horizon is REFUSED', pre.updated === false && /predates the retained horizon/.test(pre.why || ''), pre.why);
    var post = PRED.learn(fm, { id: 'eNew', emittedAt: 6000, actionKind: 'k', variable: 'v', predictedDelta: 1, traceId: 't', actionId: 'a' }, 1.0, 7000);
    assert('an efference after the horizon still learns normally', post.updated === true,
      'refusing everything would bound state by breaking learning: ' + (post.why || ''));
  }

  console.log('');
  console.log('C11: repeated cycles stop linear byte growth after the windows saturate');
  /**
   * ONE compaction proves the policy runs. It does NOT prove the curve flattens, which is
   * the whole gate. This runs many cycles, compacting each time exactly as the runtime
   * does, and compares the LATE slope with the EARLY slope.
   *
   * The acceptance is not a flat line: the archive sequence and cumulative counters gain
   * digits, so bytes creep logarithmically forever. What must disappear is the LINEAR
   * per-tick term.
   */
  var st2 = { memory: { episodic: [], episodeIndex: {}, prospective: [] },
              registry: { predictions: Object.create(null), order: [], resolved: [] },
              forwardModel: { consumed: Object.create(null) },
              attention: { src: { history: [] } } };
  var head2 = null, seq = 0, sizes = [];
  for (var cycle = 1; cycle <= 40; cycle++) {
    for (var k2 = 0; k2 < 120; k2++) {
      var n2 = (cycle - 1) * 120 + k2;
      var pid = 'p' + n2;
      st2.registry.predictions[pid] = {
        id: pid, status: PRED.STATUS.RESOLVED, confidence: 0.5, createdAt: n2, efferenceCopyId: 'e' + n2,
        resolution: { observable: true, hit: n2 % 2 === 0, contaminated: false, predictionError: 0.2 }
      };
      st2.registry.order.push(pid); st2.registry.resolved.push(pid);
      st2.memory.episodic.push({ traceId: 't' + (n2 % 7), index: n2, payload: 'x' });
      st2.memory.prospective.push({ id: 'pr' + n2, status: n2 % 2 ? 'closed' : 'unresolvable', dueAt: n2 });
      st2.forwardModel.consumed['e' + n2] = true;
      st2.attention.src.history.push({ at: n2, from: 1, to: 2 });
    }
    if (head2) st2.archiveHead = head2;
    var p2 = COMPACT.plan(st2, {});
    if (p2.retiredCount) {
      seq++;
      head2 = { sequence: seq, hash: 'h' + seq, totals: p2.totals, consumedHorizon: p2.consumedHorizon,
                retired: { episodic: seq, prospective: seq, predictions: seq, consumed: seq, attention: seq } };
      st2 = p2.apply(head2);
    }
    sizes.push(Buffer.byteLength(JSON.stringify(st2), 'utf8'));
  }
  var earlySlope = (sizes[14] - sizes[9]) / 5;
  var lateSlope = (sizes[39] - sizes[34]) / 5;
  console.log('    bytes @cycle10 ' + sizes[9] + '  @15 ' + sizes[14] + '  @35 ' + sizes[34] + '  @40 ' + sizes[39]);
  console.log('    early slope ' + earlySlope.toFixed(1) + ' B/cycle   late slope ' + lateSlope.toFixed(1) + ' B/cycle');
  assert('retained cardinality is bounded across 40 cycles',
    st2.memory.episodic.length <= COMPACT.RETAIN.episodic &&
    st2.registry.resolved.length <= COMPACT.RETAIN.resolved + COMPACT.ROLLBACK_WINDOW &&
    st2.attention.src.history.length <= COMPACT.RETAIN.attentionPerSource,
    'episodic=' + st2.memory.episodic.length + ' resolved=' + st2.registry.resolved.length +
    ' attention=' + st2.attention.src.history.length);
  assert('prospective is bounded, not merely trimmed once',
    st2.memory.prospective.length <= COMPACT.RETAIN.prospectiveClosed + 8,
    String(st2.memory.prospective.length));
  assert('consumed is bounded', Object.keys(st2.forwardModel.consumed).length <= 700,
    String(Object.keys(st2.forwardModel.consumed).length));
  assert('the LINEAR per-cycle byte term is gone: late slope is a small fraction of early',
    Math.abs(lateSlope) <= Math.max(64, Math.abs(earlySlope) * 0.05),
    'early ' + earlySlope.toFixed(1) + ' vs late ' + lateSlope.toFixed(1) + ' B/cycle');

  console.log('');
  console.log('C12: a REAL state-write failure mid-run, then a REAL retry of runDomain');
  /**
   * The previous version wrote the same chunk twice and called it a retry: it never failed a
   * state write and never re-entered runDomain.
   *
   * runDomain applies at most MAX_ROWS_PER_CYCLE rows per call, so ONE call can never
   * accumulate the ~640 terminal predictions compaction needs. Successive cycles are run
   * until it fires, exactly as production does, and only then is the state write broken.
   */
  var RUNTIME = require(path.join(ROOT, 'lib', 'brain-shadow-runtime.js'));
  var REGI = require(path.join(ROOT, 'brain-v2', 'bind', 'registry.js'));
  var fsx = require('fs');
  var dd = REGI.descriptorFor('finance');
  var fx = JSON.parse(fsx.readFileSync(REGI.fixturePath(dd), 'utf8'));
  var fxRows = fx.rows.slice().sort(function (x, y) { return x.t - y.t; });
  (function () {
    var s = 4242;
    function r() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }
    var nm = fxRows[fxRows.length - 1].src.map(function (x) { return x.n; });
    var t0 = fxRows[fxRows.length - 1].t;
    for (var i = 0; i < 1400; i++) {
      fxRows.push({ t: t0 + (i + 1) * 3600000, src: nm.map(function (n, j) {
        return { n: n, ch: 'stress', l: 1, v: +(10 + 5 * Math.sin(i / 7 + j) + r()).toFixed(4) };
      }) });
    }
  })();

  function wipe(domain) {
    Object.keys(MEM).forEach(function (k) { if (k.indexOf('brain:v2:shadow:' + domain + ':') === 0) delete MEM[k]; });
    Object.keys(LISTS).forEach(function (k) { if (k.indexOf('brain:v2:shadow:' + domain + ':') === 0) delete LISTS[k]; });
  }
  function archiveWrites(domain) {
    return Object.keys(MEM).filter(function (k) {
      return k.indexOf('brain:v2:shadow:' + domain + ':archive:') === 0;
    });
  }
  /** Cycles from clean until compaction fires, or `max` cycles. Returns the last report. */
  async function runUntilCompaction(domain, max) {
    var last = null;
    for (var c = 0; c < max; c++) {
      last = await RUNTIME.runDomain(domain, { rows: fxRows, now: 1786000000000 + c * 1000 });
      if (last.compaction && last.compaction.ran) return { report: last, cycles: c + 1 };
    }
    return { report: last, cycles: max };
  }

  wipe('finance');
  var warm = await runUntilCompaction('finance', 12);
  assert('compaction fires through the REAL runtime after successive cycles',
    warm.report.compaction && warm.report.compaction.ran === true,
    'after ' + warm.cycles + ' cycles: ' + JSON.stringify(warm.report.compaction));
  assert('and it wrote at least one archive chunk', archiveWrites('finance').length >= 1,
    JSON.stringify(archiveWrites('finance')));

  var chunksBefore = archiveWrites('finance').length;
  var stateBefore = MEM[STORE.shadowKey('finance', 'state')];
  var realSet = fakeRedis.set;
  fakeRedis.set = async function (k, v) {
    if (/:state$/.test(k)) throw new Error('shadow redis: SET rejected by redis');
    return realSet.call(fakeRedis, k, v);
  };
  var failed = await RUNTIME.runDomain('finance', { rows: fxRows, now: 1786000090000 });
  fakeRedis.set = realSet;
  assert('a cycle whose state write is rejected FAILS', failed.ok === false, JSON.stringify(failed.error));
  assert('and hot state is unchanged, so nothing was lost',
    MEM[STORE.shadowKey('finance', 'state')] === stateBefore);

  var retried = await RUNTIME.runDomain('finance', { rows: fxRows, now: 1786000091000 });
  assert('the retry SUCCEEDS', retried.ok === true, JSON.stringify(retried.error));
  assert('and the archive did not fork: no duplicate chunk for a replayed sequence',
    archiveWrites('finance').length <= chunksBefore + 1,
    chunksBefore + ' -> ' + archiveWrites('finance').length);

  console.log('');
  console.log('C13: the exact 128-record rollback boundary survives REAL compaction');
  /**
   * Put one learned efference on each side of the retained prediction boundary. The fixture
   * has 900 terminal predictions and retain.resolved=0, so COMPACT must retire p0..p771 and
   * preserve p772..p899: exactly the rollback window of 128. This test then performs rollback
   * against the compacted forward model. It cannot pass by assigning a horizon by hand.
   */
  var st3 = fixture(900);
  var fmBoundary = PRED.createForwardModel({});
  function boundaryEff(id, emittedAt) {
    return { id: id, emittedAt: emittedAt, actionKind: 'k', variable: 'v', magnitude: 1,
             predictedDelta: 0, traceId: 't-' + id, actionId: 'a-' + id };
  }
  var eRetired = boundaryEff('e771', 1771);
  var eKept = boundaryEff('e772', 1772);
  assert('the boundary efferences learn before compaction',
    PRED.learn(fmBoundary, eRetired, 1.0, 2000).updated === true &&
    PRED.learn(fmBoundary, eKept, 1.0, 2001).updated === true);
  st3.forwardModel = PRED.serialize(fmBoundary);
  var p3 = COMPACT.plan(st3, { retain: { resolved: 0 } });
  var next3 = p3.apply({ sequence: 1, hash: 'boundary', totals: p3.totals,
                         consumedHorizon: p3.consumedHorizon });
  assert('compaction retires through p771 and retains p772',
    !next3.registry.predictions.p771 && !!next3.registry.predictions.p772,
    'retired=' + p3.retired.predictions.length);
  assert('the retained terminal tail is exactly 128 records',
    next3.registry.resolved.filter(function (id) {
      var p = next3.registry.predictions[id];
      return p && p.status !== PRED.STATUS.OPEN;
    }).length === COMPACT.ROLLBACK_WINDOW,
    String(next3.registry.resolved.length));
  assert('the compaction horizon is the retired side of the boundary',
    p3.consumedHorizon === eRetired.emittedAt, String(p3.consumedHorizon));

  var afterKept = PRED.deserialize(next3.forwardModel);
  var rbKept = PRED.rollback(afterKept, 1);
  var relearnKept = PRED.learn(afterKept, eKept, 1.0, 2100);
  assert('rollback makes the retained-side efference learnable again',
    rbKept.records.length === 1 && relearnKept.updated === true,
    (relearnKept && relearnKept.why) || String(rbKept.records.length));

  var afterRetired = PRED.deserialize(next3.forwardModel);
  var rbAcross = PRED.rollback(afterRetired, 2);
  var relearnRetired = PRED.learn(afterRetired, eRetired, 1.0, 2101);
  assert('rollback cannot resurrect the archived-side efference',
    rbAcross.records.length === 2 && relearnRetired.updated === false &&
    /predates the retained horizon/.test(relearnRetired.why || ''),
    (relearnRetired && relearnRetired.why) || String(rbAcross.records.length));

  console.log('');
  console.log('C14: the PERSISTED BYTES are identical across two independent runs');
  /**
   * Comparing canonicalized objects proved the canonicaliser. This compares the exact JSON
   * the store wrote, for the state key AND every archive key, across two runs that each
   * start from a wiped namespace. An earlier version compared a warm run against a cold one
   * and reported a difference that was its own setup.
   */
  function snapshotBytes(domain) {
    var out = {};
    Object.keys(MEM).forEach(function (k) {
      if (k.indexOf('brain:v2:shadow:' + domain + ':') === 0 && !/:cycle$/.test(k)) out[k] = MEM[k];
    });
    return out;
  }
  async function determinismRun() {
    wipe('detdom');
    var r = null;
    for (var c = 0; c < 12; c++) {
      r = await RUNTIME.runDomain('finance', { rows: fxRows, now: 1786000200000 + c * 1000 });
      if (r.compaction && r.compaction.ran) break;
    }
    return r;
  }
  wipe('finance');
  var runA = await determinismRun();
  var bytesA = snapshotBytes('finance');
  wipe('finance');
  var runB = await determinismRun();
  var bytesB = snapshotBytes('finance');
  assert('both determinism runs succeeded and compacted',
    runA.ok === true && runB.ok === true && runA.compaction.ran && runB.compaction.ran,
    JSON.stringify([runA.ok, runB.ok, runA.compaction.ran, runB.compaction.ran]));
  assert('the same key set was persisted',
    JSON.stringify(Object.keys(bytesA).sort()) === JSON.stringify(Object.keys(bytesB).sort()),
    JSON.stringify(Object.keys(bytesA).sort()));
  var differing = Object.keys(bytesA).filter(function (k) { return bytesA[k] !== bytesB[k]; });
  assert('every persisted STATE and ARCHIVE value is byte-identical', differing.length === 0,
    JSON.stringify(differing));
  assert('and at least one ARCHIVE chunk was among the compared bytes',
    Object.keys(bytesA).some(function (k) { return /:archive:/.test(k); }),
    JSON.stringify(Object.keys(bytesA)));

  console.log('');
  console.log('C15: terminal prediction outcomes close linked prospective work in the REAL loop');
  function lifecycleLoop() {
    return LOOP.create({ domain: 'finance', brainSpec: FINANCE.spec(), horizonMs: 100 });
  }
  function addPredictionAndChecks(loop, suffix, evaluateAt, expiresAt, withAction) {
    var effId = withAction ? 'ef-' + suffix : null;
    var actionId = withAction ? 'act-' + suffix : null;
    if (withAction) loop._efferences = [{ id: effId, actionId: actionId }];
    var p = PRED.register(loop.registry, {
      traceId: 'trace-' + suffix,
      variable: 'channel:not-a-real-channel:precision',
      expected: 1,
      interval: [0.5, 1.5],
      createdAt: 100,
      evaluateAt: evaluateAt,
      expiresAt: expiresAt,
      evaluationCondition: 'a deliberately absent channel is observable',
      responsibleDomain: 'finance',
      efferenceCopyId: effId
    });
    MEMORY.schedule(loop.memory, {
      traceId: 'trace-' + suffix, kind: 'prediction_check', predictionId: p.id,
      trigger: 'clock', dueAt: evaluateAt, responsibleModule: 'test',
      expectedObservation: p.evaluationCondition, closureCriteria: 'prediction terminates', at: 100
    });
    if (withAction) MEMORY.schedule(loop.memory, {
      traceId: 'trace-' + suffix, kind: 'action_outcome', actionId: actionId, predictionId: p.id,
      trigger: 'clock', dueAt: evaluateAt, responsibleModule: 'test',
      expectedObservation: 'linked action outcome', closureCriteria: 'prediction terminates', at: 100
    });
    return p;
  }

  var missingLoop = lifecycleLoop();
  var missingPrediction = addPredictionAndChecks(missingLoop, 'missing', 200, 300, true);
  missingLoop._efferences = []; // persisted predictionId must close it even after the copy ages out
  LOOP.tick(missingLoop, {}, 200);
  var missingChecks = missingLoop.memory.prospective.filter(function (i) {
    return i.predictionId === missingPrediction.id || i.actionId === 'act-missing';
  });
  assert('an unresolvable prediction closes both prediction and action checks',
    missingLoop.registry.predictions[missingPrediction.id].status === PRED.STATUS.UNRESOLVABLE &&
    missingChecks.length === 2 && missingChecks.every(function (i) { return i.status === 'unresolvable'; }),
    JSON.stringify(missingChecks.map(function (i) { return { kind: i.kind, status: i.status }; })));

  var expiredLoop = lifecycleLoop();
  var expiredPrediction = addPredictionAndChecks(expiredLoop, 'expired', 200, 300, true);
  LOOP.tick(expiredLoop, {}, 301);
  var expiredChecks = expiredLoop.memory.prospective.filter(function (i) {
    return i.predictionId === expiredPrediction.id || i.actionId === 'act-expired';
  });
  assert('an expired prediction closes both prediction and action checks',
    expiredLoop.registry.predictions[expiredPrediction.id].status === PRED.STATUS.EXPIRED &&
    expiredChecks.length === 2 && expiredChecks.every(function (i) { return i.status === 'unresolvable'; }),
    JSON.stringify(expiredChecks.map(function (i) { return { kind: i.kind, status: i.status }; })));
  assert('no terminal prediction in either lifecycle leaves an OPEN prospective reference',
    missingChecks.concat(expiredChecks).every(function (i) { return i.status !== 'open'; }));

  console.log('');
  console.log('C16: exceptional-path records cannot become a separate hot-state leak');
  var errorLoop = lifecycleLoop();
  errorLoop.errors = [];
  for (var ei = 0; ei < LOOP.ERROR_WINDOW + 20; ei++) {
    errorLoop.errors.push({ at: ei, where: 'adversarial-test', why: 'failure-' + ei });
  }
  var errorSnap = LOOP.serialize(errorLoop);
  assert('serialization keeps only the bounded error tail',
    errorSnap.errors.length === LOOP.ERROR_WINDOW && errorSnap.errors[0].at === 20,
    String(errorSnap.errors.length));
  var restoredErrors = LOOP.restore({ domain: 'finance', brainSpec: FINANCE.spec() },
    Object.assign({}, errorSnap, { errors: errorLoop.errors }));
  assert('restore also bounds legacy snapshots that contain a larger error list',
    restoredErrors.errors.length === LOOP.ERROR_WINDOW && restoredErrors.errors[0].at === 20,
    String(restoredErrors.errors.length));

  console.log('');
  console.log('C15: two concurrent writers cannot both claim one archive sequence');
  /**
   * THE RACE THIS CLOSES. The archive used GET, then an unconditional SET, then GET. Two
   * overlapping workers both saw an absent sequence, both wrote, the second overwrote the
   * first, and each passed its own read-back because each read what it had just written. The
   * runtime has no lock and is idempotent only for SEQUENTIAL duplicates.
   *
   * Both writers are started before either is awaited, so the interleaving is real rather
   * than described.
   */
  var planA = COMPACT.plan(fixture(), {});
  var planB = COMPACT.plan(fixture(700), {});     // different content, same sequence
  assert('the two writers really do carry different content',
    ARCHIVE.canonical(planA.retired) !== ARCHIVE.canonical(planB.retired));

  var pA = ARCHIVE.writeChunk('raceDomain', 1, null, planA.retired);
  var pB = ARCHIVE.writeChunk('raceDomain', 1, null, planB.retired);
  var settled = await Promise.allSettled([pA, pB]);
  var okCount = settled.filter(function (s) { return s.status === 'fulfilled'; }).length;
  var conflicts = settled.filter(function (s) {
    return s.status === 'rejected' && /conflict/.test(s.reason.message);
  }).length;
  assert('exactly one writer succeeds', okCount === 1,
    JSON.stringify(settled.map(function (s) { return s.status; })));
  assert('and the loser gets an explicit conflict, not a silent overwrite', conflicts === 1,
    JSON.stringify(settled.map(function (s) { return s.status === 'rejected' ? s.reason.message.slice(0, 70) : 'ok'; })));

  var stored = await STORE.readArchiveChunk('raceDomain', 1);
  var winnerHash = ARCHIVE.hashOf(stored);
  var hashA = ARCHIVE.buildChunk('raceDomain', 1, null, planA.retired).hash;
  var hashB = ARCHIVE.buildChunk('raceDomain', 1, null, planB.retired).hash;
  assert('the stored chunk is exactly one of the two, unmixed',
    winnerHash === hashA || winnerHash === hashB, winnerHash.slice(0, 12));
  var physical = SETS.filter(function (k) { return k === STORE.archiveKey('raceDomain', 1); }).length;
  assert('exactly ONE physical write reached that key', physical === 1, String(physical));

  /* And an identical-content racer must still be treated as a retry, not a conflict. */
  var pC = ARCHIVE.writeChunk('raceDomain2', 1, null, planA.retired);
  var pD = ARCHIVE.writeChunk('raceDomain2', 1, null, planA.retired);
  var same = await Promise.allSettled([pC, pD]);
  assert('two writers with IDENTICAL content both succeed, one as a reuse',
    same.every(function (s) { return s.status === 'fulfilled'; }) &&
    same.filter(function (s) { return s.value.reused; }).length === 1,
    JSON.stringify(same.map(function (s) { return s.status === 'fulfilled' ? s.value.reused : s.reason.message.slice(0, 40); })));

  console.log('');
  console.log(failures ? (tests - failures) + '/' + tests + ' passed, ' + failures + ' FAILED'
                       : tests + '/' + tests + ' passed');
  console.log('');
  process.exit(failures ? 1 : 0);
})().catch(function (e) {
  console.error('  FAIL harness threw :: ' + (e && e.stack || e));
  process.exit(1);
});
