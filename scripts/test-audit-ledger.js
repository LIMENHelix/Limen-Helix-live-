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
 */
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

  console.log('\n' + (tests - failures) + '/' + tests + ' passed');
  process.exit(failures ? 1 : 0);
})();
