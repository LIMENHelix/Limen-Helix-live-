/**
 * scripts/test-audit-ledger.js — append-only, hash-chained, tamper-evident provenance ledger.
 * Run: node scripts/test-audit-ledger.js
 *
 *   T1  computeHash is deterministic; a changed field changes the hash
 *   T2  makeEntry seals the entry; genesis prevHash on the first link
 *   T3  a well-formed chain verifies ok
 *   T4  TAMPER: editing a past entry's payload breaks verify (hash mismatch)
 *   T5  TAMPER: reordering / deleting an entry breaks verify (prevHash / seq)
 *   T6  db round-trip: append builds a chain, read is newest-first, verify ok
 *   T7  db TAMPER: overwrite a stored entry ⇒ verify reports brokenAt
 *   T8  consumer proof: the consolidator handler appends a provenance event
 *
 * FIXTURE ISOLATION: this file builds thousands of entries. Redis configuration is
 * cleared BEFORE any module can cache availability, so bulk fixtures never write to
 * an environment's configured database.
 */
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

var L = require('../lib/audit-ledger');
var failures = 0, tests = 0;
function assert(name, cond, detail) { tests++; if (cond) console.log('  PASS ' + name); else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); } }

console.log('T1: deterministic hash');
var e = L.makeEntry(0, 1000, 'x', 'tester', { a: 1 }, L.GENESIS);
assert('hash is 64-hex', /^[0-9a-f]{64}$/.test(e.hash));
assert('same inputs ⇒ same hash', L.computeHash(e) === e.hash);
var e2 = L.makeEntry(0, 1000, 'x', 'tester', { a: 2 }, L.GENESIS);
assert('changed payload ⇒ different hash', e2.hash !== e.hash);

console.log('T2: sealed entry + genesis');
assert('first entry prevHash = genesis', e.prevHash === L.GENESIS);
assert('carries provenance fields', e.type === 'x' && e.actor === 'tester' && e.seq === 0 && e.ts === 1000);

console.log('T3: well-formed chain verifies');
var a = L.makeEntry(0, 1, 'a', 's', { i: 0 }, L.GENESIS);
var b = L.makeEntry(1, 2, 'b', 's', { i: 1 }, a.hash);
var c = L.makeEntry(2, 3, 'c', 's', { i: 2 }, b.hash);
var chain = [a, b, c];
assert('verifyChain ok', L.verifyChain(chain).ok === true);
assert('empty chain ok', L.verifyChain([]).ok === true);

console.log('T4: edit a past entry ⇒ break');
var tampered = [Object.assign({}, a), b, c];
tampered[0].payload = { i: 99 };   // edit content but keep old hash
var v4 = L.verifyChain(tampered);
assert('verify fails on edited entry', v4.ok === false && v4.brokenAt === 0, JSON.stringify(v4));
assert('reason = hash mismatch', /hash mismatch/.test(v4.reason));

console.log('T5: reorder / delete ⇒ break');
var reordered = [a, c, b];
assert('reorder breaks (prevHash)', L.verifyChain(reordered).ok === false);
var deleted = [a, c];              // dropped b
var v5 = L.verifyChain(deleted);
assert('deletion breaks', v5.ok === false && v5.brokenAt === 1, JSON.stringify(v5));

console.log('T6-T8: db-backed (in-memory limen-db)');
(async function () {
  var db = require('../lib/limen-db');
  assert('audit tests use an isolated in-memory store',
    db.getBackend() === 'memory', db.getBackend());
  var STREAM = 'testchain';
  var x1 = await L.append(db, STREAM, { ts: 10, type: 'evt', actor: 'unit', payload: { n: 1 } });
  var x2 = await L.append(db, STREAM, { ts: 20, type: 'evt', actor: 'unit', payload: { n: 2 } });
  var x3 = await L.append(db, STREAM, { ts: 30, type: 'evt', actor: 'unit', payload: { n: 3 } });
  assert('seqs are 0,1,2', x1.seq === 0 && x2.seq === 1 && x3.seq === 2);
  assert('x2 chains to x1', x2.prevHash === x1.hash && x3.prevHash === x2.hash);
  var readBack = await L.read(db, STREAM, 10);
  assert('read is newest-first', readBack[0].seq === 2 && readBack[2].seq === 0);
  var v6 = await L.verify(db, STREAM);
  assert('stored chain verifies ok', v6.ok === true && v6.length === 3, JSON.stringify(v6));
  assert('verify reports the head hash', v6.head === x3.hash);

  // T7: tamper the stored list directly (simulate an attacker editing Redis)
  var raw = await db.lrange('audit:' + STREAM, 0, 10);
  raw[1].payload = { n: 999 };            // edit the middle entry in place
  await db.set('__noop', 1);              // (raw is a live ref in the in-memory store; mutation already applied)
  var v7 = await L.verify(db, STREAM);
  assert('verify catches the in-store tamper', v7.ok === false, JSON.stringify(v7));

  // T6b: chains longer than the old 5,000-entry read cap must verify, not report tamper.
  async function bulkChain(stream, n) {
    await db.del('audit:' + stream);
    var chain = [], prev = L.GENESIS;
    for (var i = 0; i < n; i++) {
      var e = L.makeEntry(i, i, 'bulk', 'unit', { i: i }, prev);
      chain.push(e); prev = e.hash;
    }
    // LPUSH prepends, so push oldest-first to leave the newest at index 0.
    for (var j = 0; j < chain.length; j++) await db.lpush('audit:' + stream, chain[j]);
    return chain;
  }

  var LONG = 'testchain-long';
  var longChain = await bulkChain(LONG, 5003);
  var vLong = await L.verify(db, LONG);
  assert('a 5,003-entry intact chain verifies', vLong.ok === true, JSON.stringify(vLong));
  assert('whole-chain check reports the true length', vLong.length === 5003 && vLong.partial === false, JSON.stringify(vLong));
  assert('whole-chain check is anchored at genesis', vLong.genesisAnchored === true, JSON.stringify(vLong));
  assert('whole-chain check reports the long-chain head', vLong.head === longChain[5002].hash, JSON.stringify(vLong.head));

  var vWindow = await L.verify(db, LONG, 5000);
  assert('bounded verify of the same chain is ok', vWindow.ok === true, JSON.stringify(vWindow));
  assert('bounded verify is marked partial and boundary-checked',
    vWindow.partial === true && vWindow.boundaryChecked === true, JSON.stringify(vWindow));
  assert('bounded window spans seq 3..5002',
    vWindow.firstSeq === 3 && vWindow.lastSeq === 5002, JSON.stringify(vWindow));
  assert('bounded window does not claim genesis anchoring', vWindow.genesisAnchored === false, JSON.stringify(vWindow));

  // T6c: tampering at the window boundary must still be caught.
  var BOUNDARY = 'testchain-boundary';
  await bulkChain(BOUNDARY, 5003);
  var rawB = await db.lrange('audit:' + BOUNDARY, 0, 5003);
  rawB[5000].payload = { i: 'edited-at-boundary' };   // seq 2, just outside the 5,000 window
  var vBoundary = await L.verify(db, BOUNDARY, 5000);
  assert('bounded verify catches an edited boundary entry',
    vBoundary.ok === false && /boundary hash mismatch/.test(vBoundary.reason), JSON.stringify(vBoundary));

  // T6d: tampering inside the window must still be caught.
  var WINDOW = 'testchain-window';
  await bulkChain(WINDOW, 5003);
  var rawW = await db.lrange('audit:' + WINDOW, 0, 5003);
  rawW[100].payload = { i: 'edited-in-window' };       // seq 4902
  var vWindowTamper = await L.verify(db, WINDOW, 5000);
  assert('bounded verify catches an edited window entry',
    vWindowTamper.ok === false && /hash mismatch/.test(vWindowTamper.reason)
      && vWindowTamper.brokenAt > 0, JSON.stringify(vWindowTamper));

  // T6e: malformed entries are a structured result, not a thrown TypeError.
  function fakeDb(pages) {
    var i = 0;
    return { lrange: async function () { return pages[Math.min(i++, pages.length - 1)]; } };
  }
  var tailEntry = L.makeEntry(1, 2, 'b', 's', { i: 1 }, 'f'.repeat(64));

  var fullNull = await L.verify(fakeDb([[tailEntry, null]]), 'null-full');
  assert('full verify with a null oldest entry does not throw',
    fullNull.ok === false && /missing entry\/hash/.test(fullNull.reason), JSON.stringify(fullNull));
  assert('full verify null metadata is guarded',
    fullNull.firstSeq === null && fullNull.lastSeq === 1, JSON.stringify(fullNull));

  var cappedNull = await L.verify(fakeDb([[tailEntry, null, tailEntry]]), 'null-capped', 2);
  assert('capped verify with a null window anchor does not throw',
    cappedNull.ok === false && /missing entry\/hash/.test(cappedNull.reason), JSON.stringify(cappedNull));
  assert('capped null result keeps partial/boundary semantics',
    cappedNull.partial === true && cappedNull.boundaryChecked === false,
    JSON.stringify(cappedNull));

  var cappedNullNoBoundary = await L.verify(fakeDb([[tailEntry, null]]), 'null-capped-end', 2);
  assert('capped verify with a null oldest entry and no boundary is structured',
    cappedNullNoBoundary.ok === false && cappedNullNoBoundary.firstSeq === null,
    JSON.stringify(cappedNullNoBoundary));

  var onlyNull = await L.verify(fakeDb([[null]]), 'null-only');
  assert('full verify with only a null entry is structured',
    onlyNull.ok === false && onlyNull.head === null && onlyNull.lastSeq === null,
    JSON.stringify(onlyNull));

  // T6f: a boundary that exists but is malformed is not "absent". All four falsy
  // shapes must be rejected, not treated as the end of the chain.
  var c0 = L.makeEntry(0, 0, 'b', 's', { i: 0 }, L.GENESIS);
  var c1 = L.makeEntry(1, 1, 'b', 's', { i: 1 }, c0.hash);
  var malformedBoundaries = [null, false, 0, ''];
  for (var mb = 0; mb < malformedBoundaries.length; mb++) {
    var value = malformedBoundaries[mb];
    /* A genesis-anchored window: treating the malformed boundary as absent would
       verify this window clean, which is exactly the reported false pass. */
    var mv = await L.verify(fakeDb([[c1, c0, value]]), 'boundary-' + mb, 2);
    assert('malformed boundary ' + JSON.stringify(value) + ' is rejected',
      mv.ok === false && /window boundary entry missing hash/.test(mv.reason),
      JSON.stringify(mv));
    assert('malformed boundary ' + JSON.stringify(value) + ' is not reported clean',
      mv.partial === true && mv.boundaryChecked === false, JSON.stringify(mv));
  }
  var b0 = L.makeEntry(0, 0, 'b', 's', { i: 0 }, L.GENESIS);
  var b1 = L.makeEntry(1, 1, 'b', 's', { i: 1 }, b0.hash);
  var b2 = L.makeEntry(2, 2, 'b', 's', { i: 2 }, b1.hash);
  var validBoundary = await L.verify(fakeDb([[b2, b1, b0]]), 'boundary-valid', 2);
  assert('a valid boundary still verifies as a checked partial window',
    validBoundary.ok === true && validBoundary.partial === true
      && validBoundary.boundaryChecked === true, JSON.stringify(validBoundary));

  // T6g: window and boundary come from ONE snapshot, so an append between reads
  // cannot make a legitimate chain look tampered.
  var callCount = 0, ranges = [];
  var singleSnapshot = {
    lrange: async function (k, start, stop) {
      callCount++;
      ranges.push([start, stop]);
      if (callCount === 1) return [b2, b1, b0];
      return ['stale-boundary-that-must-not-be-read'];
    }
  };
  var vSingle = await L.verify(singleSnapshot, 'single-read', 2);
  assert('capped verify reads window and boundary in one LRANGE',
    callCount === 1 && ranges[0][0] === 0 && ranges[0][1] === 2,
    JSON.stringify({ callCount: callCount, ranges: ranges }));
  assert('one-snapshot verify accepts the valid boundary',
    vSingle.ok === true && vSingle.partial === true && vSingle.boundaryChecked === true,
    JSON.stringify(vSingle));

  // T6h: boundaryChecked reflects checks actually performed.
  var e2Edited = Object.assign({}, b2);
  e2Edited.payload = { i: 'edited-newest' };
  var windowFail = await L.verify(fakeDb([[e2Edited, b1, b0]]), 'window-fail', 2);
  assert('an in-window hash failure reports boundaryChecked:false',
    windowFail.ok === false && /hash mismatch/.test(windowFail.reason)
      && windowFail.boundaryChecked === false, JSON.stringify(windowFail));

  var e0Edited = Object.assign({}, b0);
  e0Edited.payload = { i: 'edited-boundary' };
  var boundaryFail = await L.verify(fakeDb([[b2, b1, e0Edited]]), 'boundary-fail', 2);
  assert('a performed boundary check reports boundaryChecked:true even when it fails',
    boundaryFail.ok === false && /boundary hash mismatch/.test(boundaryFail.reason)
      && boundaryFail.boundaryChecked === true, JSON.stringify(boundaryFail));

  // T8: consumer proof — the consolidator appends a provenance event
  await db.set('feedhist:index', ['energy']);
  var t0 = 1700000000000;
  await db.lpush('forecasthist:energy', { madeAt: t0, direction: 'rising', currentStress: 0.4 });
  await db.lpush('feedhist:energy', { t: t0 + 6 * 3600 * 1000, s: 0.7 });
  var handler = require('../handlers/feed-consolidate');
  await new Promise(function (resolve) { var res = { setHeader: function () {}, statusCode: 200, end: function () { resolve(); } }; handler({ method: 'GET', url: '/api/feed-consolidate?run=1', headers: {} }, res); });
  var prov = await L.read(db, 'consolidation', 10);
  assert('consolidator wrote a provenance event', prov.length >= 1 && prov[0].type === 'consolidation.proposal', JSON.stringify(prov[0] || {}).slice(0, 160));
  assert('provenance event marks applied:false', prov[0] && prov[0].payload && prov[0].payload.applied === false);
  var vProv = await L.verify(db, 'consolidation');
  assert('consolidation audit chain verifies', vProv.ok === true, JSON.stringify(vProv));

  // T8b: the unauthenticated handler uses a fixed cap and discloses partial coverage.
  var PUBLIC = 'testchain-public-cap';
  await bulkChain(PUBLIC, 5003);
  var auditHandler = require('../handlers/audit-ledger');
  var payload = null;
  await new Promise(function (resolve) {
    var res = {
      setHeader: function () {}, statusCode: 200,
      end: function (s) { payload = JSON.parse(s); resolve(); }
    };
    auditHandler({ method: 'GET', url: '/api/audit-ledger?stream=' + PUBLIC + '&verify=1', headers: {} }, res);
  });
  assert('public verify response is returned', !!payload && payload.ok === true, JSON.stringify(payload));
  assert('public verify cap is disclosed', payload.verifyCap === L.PUBLIC_VERIFY_CAP, JSON.stringify(payload));
  assert('public verify is marked partial with a checked boundary',
    payload.verify.partial === true && payload.verify.boundaryChecked === true,
    JSON.stringify(payload.verify));
  assert('public verify reads only the capped window',
    payload.verify.length === L.PUBLIC_VERIFY_CAP, JSON.stringify(payload.verify));

  var transferSource = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'handlers', 'transfer-record.js'), 'utf8');
  assert('transfer-record public verify also uses the fixed cap',
    /audit\.verify\(db, TL\.stream\(target\), audit\.PUBLIC_VERIFY_CAP\)/.test(transferSource));

  console.log('\n' + (tests - failures) + '/' + tests + ' passed');
  process.exit(failures ? 1 : 0);
})();
