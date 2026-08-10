/**
 * brain-v2/test/relationship-wiring.js — declared reference intervals reaching the gate.
 *
 *   node brain-v2/test/relationship-wiring.js
 *
 * The gate refuses to parse an identity, so the channel declares how its own identity carries
 * a reference time and `core/reference-time.js` applies that declaration. This proves the
 * declarations are applied, that nothing is invented when they do not fit, and that the three
 * finance relationships report what they actually are.
 *
 * NOTHING HERE ACTIVATES A PATHWAY, and one test asserts exactly that.
 *
 * Every instant is injected. Nothing reads a clock.
 */

'use strict';

var RT = require('../core/reference-time.js');
var CMP = require('../core/comparability.js');
var EVID = require('../core/relationship-evidence.js');
var CALS = require('../bind/calendars.js').CALENDARS;
var FIN = require('../bind/finance.js');

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

var SEC = { kind: RT.EXTRACT.EPOCH_SECONDS, after: 'quote-t:' };
var DAY = { kind: RT.EXTRACT.SESSION_DATE, after: 'trading-day:' };
function derive(id, rule, cal) { return RT.observedAtFor(id, rule, cal, CMP.instantForLocal); }

// ── T1: the two declared shapes ──────────────────────────────────────────────────────
(function () {
  console.log('T1: an epoch-seconds identity resolves to that instant');
  var r = derive('finnhub:quote|symbol:SPY|quote-t:1786132800', SEC);
  assert('ok', r.ok === true, r.why);
  assert('and the instant is the publisher\'s, times 1000',
    r.observedAt === 1786132800 * 1000, String(r.observedAt));
  assert('a marker in the MIDDLE of the token is read to the next separator',
    derive('a:1|quote-t:1786132800|z:9', SEC).observedAt === 1786132800000);

  console.log('T1b: a session-date identity resolves to that SESSION\'S CLOSE');
  var s = derive('alphavantage:global-quote|symbol:SPY|trading-day:2026-08-07', DAY, CALS.usEquity);
  assert('ok', s.ok === true, s.why);
  assert('16:00 New York on that date, which is 20:00Z in August',
    s.observedAt === Date.UTC(2026, 7, 7, 20, 0, 0), new Date(s.observedAt).toISOString());
  assert('and it follows DST rather than a fixed offset (January is 21:00Z)',
    derive('x|trading-day:2026-01-09', DAY, CALS.usEquity).observedAt === Date.UTC(2026, 0, 9, 21, 0, 0));
})();

// ── T2: nothing is ever invented ─────────────────────────────────────────────────────
(function () {
  console.log('T2: NEGATIVE CONTROLS — a rule that does not fit yields null and a reason');
  function why(id, rule, cal) { var r = derive(id, rule, cal); return r.ok ? 'OK(' + r.observedAt + ')' : r.why; }
  assert('no identity at all is its OWN reason, not a marker miss',
    why(undefined, SEC) === RT.REASON.NO_IDENTITY && why('', SEC) === RT.REASON.NO_IDENTITY);
  assert('an identity without the marker says so',
    why('finnhub:quote|symbol:SPY', SEC) === RT.REASON.MARKER_ABSENT);
  assert('a channel with no rule abstains', why('x|quote-t:1', null) === RT.REASON.NO_RULE);
  assert('an unknown extraction kind abstains',
    why('x|quote-t:1', { kind: 'vibes', after: 'quote-t:' }) === RT.REASON.UNKNOWN_KIND);
  assert('a rule with no marker abstains',
    why('x|quote-t:1', { kind: RT.EXTRACT.EPOCH_SECONDS }) === RT.REASON.NO_MARKER);
  assert('non-digits after the marker abstain rather than being coerced',
    why('x|quote-t:1786132800abc', SEC) === RT.REASON.UNPARSEABLE &&
    why('x|quote-t:', SEC) === RT.REASON.UNPARSEABLE);
  assert('a malformed session date abstains',
    why('x|trading-day:2026-8-7', DAY, CALS.usEquity) === RT.REASON.UNPARSEABLE);
  assert('a session date with no calendar abstains',
    why('x|trading-day:2026-08-07', DAY, null) === RT.REASON.NEEDS_CALENDAR);
  /* A seconds value read as milliseconds lands in 1970 and a millis value read as seconds
     lands in the year 56000. Both are refused here rather than surfacing later as a calendar
     fault, which would send a reader to the wrong module. */
  assert('an implausible instant abstains, in both directions',
    why('x|quote-t:1786132800', { kind: RT.EXTRACT.EPOCH_MILLIS, after: 'quote-t:' }) === RT.REASON.OUT_OF_RANGE &&
    why('x|quote-t:1786132800000', SEC) === RT.REASON.OUT_OF_RANGE);
  assert('but a correct millis rule on a millis token works',
    derive('x|quote-t:1786132800000', { kind: RT.EXTRACT.EPOCH_MILLIS, after: 'quote-t:' }).observedAt
      === 1786132800000);
})();

// ── T3: readings to observations ─────────────────────────────────────────────────────
(function () {
  console.log('T3: recordedAt is carried through untouched, and omitted when absent');
  var out = RT.observationsFor([
    { identity: 'x|quote-t:1786132800', value: 1, recordedAt: 999 },
    { identity: 'x|quote-t:1786132801', value: 2 },
    { identity: 'x|no-marker', value: 3, recordedAt: 5 },
    { identity: 'x|quote-t:1786132802', value: NaN, recordedAt: 5 }
  ], SEC, null, CMP.instantForLocal);
  assert('two readings placed', out.observations.length === 2, JSON.stringify(out));
  assert('the one with a receipt keeps it', out.observations[0].recordedAt === 999);
  assert('the one without has NO recordedAt key, not a zero',
    !('recordedAt' in out.observations[1]), JSON.stringify(out.observations[1]));
  assert('and both drops are counted by reason',
    out.dropped[RT.REASON.MARKER_ABSENT] === 1 && out.dropped.no_finite_value === 1,
    JSON.stringify(out.dropped));
})();

// ── T4: the finance declarations, as they actually ship ──────────────────────────────
(function () {
  console.log('T4: finance declares intervals on the two live vendors and NOT on the dead one');
  var byKey = {};
  FIN.spec().channels.forEach(function (c) { byKey[c.key] = c; });
  assert('finnhub is point-in-time with a declared staleness tolerance',
    byKey.finnhub.referenceInterval.kind === CMP.INTERVAL.POINT_IN_TIME &&
    byKey.finnhub.referenceInterval.maxLagFromCloseMs === 15 * 60 * 1000,
    JSON.stringify(byKey.finnhub.referenceInterval));
  assert('alphaVantage is a session close',
    byKey.alphaVantage.referenceInterval.kind === CMP.INTERVAL.SESSION_CLOSE,
    JSON.stringify(byKey.alphaVantage.referenceInterval));
  assert('both name the same declared calendar',
    byKey.finnhub.referenceInterval.calendar === 'usEquity' &&
    byKey.alphaVantage.referenceInterval.calendar === 'usEquity');
  /* NOT AN OVERSIGHT. massiveSpy emits no numeric value at all in production, so nothing is
     known about an identity it has never produced; declaring one from vendor documentation
     would describe data that does not exist. */
  assert('massiveSpy declares NONE, because it has never published an identity',
    byKey.massiveSpy.referenceInterval === undefined);
  assert('the declared calendar exists and is complete enough for the gate',
    !!CALS.usEquity && CALS.usEquity.timeZone === 'America/New_York' &&
    CALS.usEquity.close === '16:00' && CALS.usEquity.sessionDays.length === 5);
})();

// ── T5: end to end, over recorder rows ───────────────────────────────────────────────
(function () {
  console.log('T5: the three declared relationships report what they actually are');
  /* Rows in the recorder's own shape. Four sessions, each with an Alpha Vantage close that is
     RESTATED two hours later, and a Finnhub quote at the close. This is the measured
     production shape, reproduced deterministically. */
  var days = ['2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07'];
  var rows = [];
  days.forEach(function (d, i) {
    var close = CMP.instantForLocal(d, '16:00', 'America/New_York');
    rows.push({ t: close + 1000, src: [
      { n: 'Finnhub Market', v: 700 + i, su: 'finnhub:quote|symbol:SPY|quote-t:' + Math.floor(close / 1000) },
      { n: 'Alpha Vantage Market', v: 700 + i + 0.02, su: 'alphavantage:global-quote|symbol:SPY|trading-day:' + d }
    ] });
    rows.push({ t: close + 7200000, src: [
      { n: 'Alpha Vantage Market', v: 700 + i, su: 'alphavantage:global-quote|symbol:SPY|trading-day:' + d }
    ] });
  });

  var out = EVID.evaluate(FIN, rows, CALS);
  assert('every declared relationship is reported, including the blocked ones',
    out.length === 3, String(out.length));
  var blocked = out.filter(function (r) { return r.blockedBy === 'massiveSpy'; });
  assert('the two massiveSpy pairs are blocked BY NAME',
    blocked.length === 2 && blocked.every(function (r) {
      return r.comparable === false && r.why === 'channel_declares_no_referenceInterval';
    }), JSON.stringify(blocked.map(function (r) { return r.why; })));

  var live = out.filter(function (r) { return r.a === 'finnhub' && r.b === 'alphaVantage'; })[0];
  assert('the live pair is comparable', live.comparable === true, live.why);
  assert('on four sessions', live.alignedSessions === 4, String(live.alignedSessions));
  /* ALL FOUR, because this fixture restates every session. Production shows 3 of 4, since the
     earliest session's restatement predates the recorded window. The number belongs to the
     fixture and must not be read as the production figure. */
  assert('all four rest on a revision, which is this fixture\'s shape',
    live.revisedSessions === 4, String(live.revisedSessions));
  assert('and it is NOT eligible at four of six', live.eligible === false, live.why);
  assert('the floor is unchanged', live.minAligned === 6, String(live.minAligned));
  assert('both sides placed every reading the rule fits',
    live.placed.a === 4 && live.placed.b === 8, JSON.stringify(live.placed));

  console.log('T5b: the evaluation is read-only and order-independent');
  var before = JSON.stringify(rows);
  var again = EVID.evaluate(FIN, rows.slice().reverse(), CALS);
  assert('reversing the rows changes nothing', JSON.stringify(again) === JSON.stringify(out));
  assert('and the rows themselves were not mutated', JSON.stringify(rows) === before);
})();

// ── T6: wiring activates nothing ─────────────────────────────────────────────────────
(function () {
  console.log('T6: this wiring cannot activate a pathway or move the floor');
  var api = Object.keys(EVID).concat(Object.keys(RT)).sort().join(',');
  assert('no activate/enable/promote anywhere in the surface',
    !/activat|enable|promote/i.test(api), api);
  assert('the floor still comes from divergence.js and is six',
    CMP.MIN_ALIGNED === require('../core/divergence.js').MIN_OBSERVATIONS && CMP.MIN_ALIGNED === 6);
  /* A domain declaring no relationships must produce nothing at all rather than an empty
     verdict that could later be mistaken for "evaluated and found nothing". */
  var ENERGY = require('../bind/energy.js');
  assert('energy declares relationships, so it is evaluated',
    EVID.evaluate(ENERGY, [], CALS).length === 7, String(EVID.evaluate(ENERGY, [], CALS).length));
  assert('and with no rows every one of them abstains rather than passing',
    EVID.evaluate(ENERGY, [], CALS).every(function (r) { return r.eligible === false; }));
})();

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
