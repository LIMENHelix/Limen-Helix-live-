/**
 * brain-v2/test/recorded-at-propagation.js — the recorder's receipt time reaching the binder.
 *
 *   node brain-v2/test/recorded-at-propagation.js
 *
 * THREE FACTS THAT MUST NOT COLLAPSE INTO EACH OTHER:
 *
 *   observationId  the SOURCE'S identity (`su`). WHICH observation.
 *   value          what it said.
 *   recordedAt     WHEN WE RECEIVED IT (`row.t`, stamped by handlers/feed-record.js).
 *
 * `recordedAt` is our clock on purpose. It is not evidence that a source published
 * anything, and nothing may count it as such. Its single job is ORDERING two values that
 * arrive under ONE identity, which is what separates a revision from a contradiction.
 *
 * Measured 2026-08-09: Alpha Vantage restates its session close under an unchanged identity
 * about two hours later. Without a receipt time the restatement and a genuine simultaneous
 * disagreement are indistinguishable and both have to abstain, which is what cost the
 * strongest candidate three of its four aligned sessions.
 *
 * Every timestamp here is injected. Nothing reads a clock.
 */

'use strict';

var path = require('path');
var REG = require('../bind/registry.js');

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

function binderFor(product) {
  var d = REG.descriptorFor(product);
  return require(path.join(__dirname, '..', 'bind', d.binder + '.js'));
}

/** A row in the exact shape handlers/feed-record.js writes: `t` plus compacted sources. */
function row(t, sources) {
  var r = { src: sources };
  if (t !== undefined) r.t = t;
  return r;
}

var RECEIPT = 1786000123456;

// ── T1: the receipt time reaches the reading ─────────────────────────────────────────
(function () {
  console.log('T1: readRecorderRow carries the row\'s receipt time onto every reading');
  var b = binderFor('finance');
  var out = b.readRecorderRow(row(RECEIPT, [
    { n: 'Finnhub Market', v: 770.5, su: 'sid-A' },
    { n: 'Alpha Vantage Market', v: 770.4, su: 'sid-B' }
  ]));
  assert('both channels read', !!out.finnhub && !!out.alphaVantage, JSON.stringify(Object.keys(out)));
  assert('recordedAt is the ROW\'s t, not something derived per source',
    out.finnhub.recordedAt === RECEIPT && out.alphaVantage.recordedAt === RECEIPT,
    JSON.stringify(out));
  assert('and the three facts stay separate on the reading',
    out.finnhub.value === 770.5 && out.finnhub.observationId === 'sid-A' &&
    out.finnhub.recordedAt === RECEIPT, JSON.stringify(out.finnhub));

  /* THE POINT OF THE WHOLE CHANGE, in one assertion: one identity, two receipts, two
     values. Before this the second row was indistinguishable from a contradiction. */
  var later = b.readRecorderRow(row(RECEIPT + 7200000, [{ n: 'Alpha Vantage Market', v: 770.9, su: 'sid-B' }]));
  assert('the same identity re-read later is ORDERABLE by receipt',
    later.alphaVantage.observationId === out.alphaVantage.observationId &&
    later.alphaVantage.value !== out.alphaVantage.value &&
    later.alphaVantage.recordedAt > out.alphaVantage.recordedAt,
    JSON.stringify([out.alphaVantage, later.alphaVantage]));
})();

// ── T2: it is never invented ─────────────────────────────────────────────────────────
(function () {
  console.log('T2: NEGATIVE CONTROL — a row with no usable receipt yields no recordedAt');
  var b = binderFor('finance');
  var src = [{ n: 'Finnhub Market', v: 770.5, su: 'sid-A' }];
  [undefined, null, NaN, Infinity, '1786000123456', {}].forEach(function (bad) {
    var out = b.readRecorderRow(row(bad, src));
    assert('t=' + JSON.stringify(bad) + ' produces a reading with NO recordedAt key',
      !!out.finnhub && !('recordedAt' in out.finnhub), JSON.stringify(out.finnhub));
    assert('  and the reading is otherwise intact', out.finnhub.value === 770.5 &&
      out.finnhub.observationId === 'sid-A');
  });
  /* A missing receipt must read as "cannot order", never as first or last. Absent is the
     honest shape; a 0 or a Date.now() would both be fabrications. */
  var out2 = b.readRecorderRow(row(undefined, src));
  assert('absent rather than zero, so nothing can sort it as earliest',
    out2.finnhub.recordedAt === undefined, JSON.stringify(out2.finnhub));
})();

// ── T3: a live read has no recorder receipt and must not pretend otherwise ───────────
(function () {
  console.log('T3: readLive attaches no recordedAt, because no row was received');
  var b = binderFor('finance');
  var live = b.readLive({ sources: [{ name: 'Finnhub Market', value: 770.5, sourceUpdatedAt: 'sid-A' }] });
  assert('the live reading exists', !!live.finnhub, JSON.stringify(Object.keys(live)));
  assert('and carries identity but NO receipt time',
    live.finnhub.observationId === 'sid-A' && !('recordedAt' in live.finnhub),
    JSON.stringify(live.finnhub));
})();

// ── T4: identity and receipt are independent ─────────────────────────────────────────
(function () {
  console.log('T4: a source with no identity still gets a receipt, and vice versa');
  var b = binderFor('finance');
  var noId = b.readRecorderRow(row(RECEIPT, [{ n: 'Finnhub Market', v: 1 }]));
  assert('no su, but recordedAt is present',
    noId.finnhub.recordedAt === RECEIPT && noId.finnhub.observationId === undefined,
    JSON.stringify(noId.finnhub));
  var noT = b.readRecorderRow(row(undefined, [{ n: 'Finnhub Market', v: 1, su: 'sid-A' }]));
  assert('su, but no recordedAt',
    noT.finnhub.observationId === 'sid-A' && noT.finnhub.recordedAt === undefined,
    JSON.stringify(noT.finnhub));
})();

// ── T5: every installed binder behaves the same way ──────────────────────────────────
(function () {
  console.log('T5: the behaviour is the factory\'s, not one binder\'s');
  var checked = 0, ok = 0, missing = [];
  REG.INSTALLED_DOMAINS.forEach(function (product) {
    var b = binderFor(product);
    var spec = b.spec();
    var ch = spec.channels[0];
    if (!ch) return;
    var s = { n: ch.name, su: 'sid-' + product };
    s[ch.recordedField] = 1.25;
    var out = b.readRecorderRow(row(RECEIPT, [s]));
    var r = out[ch.key];
    checked++;
    if (r && r.recordedAt === RECEIPT) ok++; else missing.push(product);
  });
  assert('all ' + checked + ' installed domains carry the receipt through',
    checked === REG.INSTALLED_DOMAINS.length && ok === checked,
    'missing: ' + (missing.join(',') || 'none'));
  assert('and that is twenty domains, not a sample',
    checked === 20, String(checked));
})();

// ── T6: determinism ──────────────────────────────────────────────────────────────────
(function () {
  console.log('T6: reading the same row twice, and after a JSON round trip, is identical');
  var b = binderFor('finance');
  var r = row(RECEIPT, [{ n: 'Finnhub Market', v: 770.5, su: 'sid-A' }]);
  var a1 = JSON.stringify(b.readRecorderRow(r));
  var a2 = JSON.stringify(b.readRecorderRow(JSON.parse(JSON.stringify(r))));
  assert('identical', a1 === a2, a1 + ' vs ' + a2);
  assert('and the receipt survives the round trip', JSON.parse(a2).finnhub.recordedAt === RECEIPT);
})();

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
