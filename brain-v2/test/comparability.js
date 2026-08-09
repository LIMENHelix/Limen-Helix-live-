/**
 * brain-v2/test/comparability.js — the comparability gate.
 *
 *   node brain-v2/test/comparability.js
 *
 * SYNTHETIC ON PURPOSE, and the shape is taken from a real measurement rather than
 * imagined. On 2026-08-09 the strongest declared pair in the system compared an intraday
 * quote against the previous day's close in 93% of rows where both sides carried an
 * identity. These fixtures reproduce that shape deterministically so the gate can be
 * proven to refuse it, and to refuse it for the stated reason.
 *
 * Every fixture is built from explicit UTC instants. Nothing here reads the clock, so a
 * pass today is a pass in December.
 */

'use strict';

var CMP = require('../core/comparability.js');

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

/* Calendars are DECLARED DATA supplied by the caller. The module ships none, so these
   live in the test, which is the point: nothing about a market is compiled in. */
var CAL = {
  equities: {
    timeZone: 'America/New_York', open: '09:30', close: '16:00',
    sessionDays: [1, 2, 3, 4, 5], holidays: ['2026-08-06']
  },
  /* A second, structurally different calendar. If anything in the module were tuned to
     the first one, this is where it would show. Tokyo has no DST and a different close. */
  tokyo: {
    timeZone: 'Asia/Tokyo', open: '09:00', close: '15:00',
    sessionDays: [1, 2, 3, 4, 5], holidays: []
  },
  noHolidays: {
    timeZone: 'America/New_York', open: '09:30', close: '16:00',
    sessionDays: [1, 2, 3, 4, 5]
  }
};

var CLOSE_SPEC = { referenceInterval: { kind: CMP.INTERVAL.SESSION_CLOSE, calendar: 'equities' } };
var TICK_SPEC  = { referenceInterval: { kind: CMP.INTERVAL.POINT_IN_TIME, calendar: 'equities' } };
var CLOSE_NH   = { referenceInterval: { kind: CMP.INTERVAL.SESSION_CLOSE, calendar: 'noHolidays' } };
var TICK_NH    = { referenceInterval: { kind: CMP.INTERVAL.POINT_IN_TIME, calendar: 'noHolidays' } };

function utc(y, mo, d, h, mi) { return Date.UTC(y, mo - 1, d, h || 0, mi || 0, 0); }
function obs(identity, value, observedAt) { return { identity: identity, value: value, observedAt: observedAt }; }

/* Six real trading sessions, weekend skipped. 2026-08-07 is a Friday. */
var SESSIONS = ['2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-10', '2026-08-11'];
var DAYNUM   = [4, 5, 6, 7, 10, 11];

/** A close-side series: one settled figure per session, at that session's close instant. */
function closeSeries(days, baseValue, cal) {
  cal = cal || CAL.noHolidays;
  return days.map(function (d, i) {
    var date = '2026-08-' + (d < 10 ? '0' + d : d);
    return obs('vendorA|day:' + date, baseValue + i, CMP.instantForLocal(date, cal.close, cal.timeZone));
  });
}

/** A tick-side series: several intraday readings per session plus the closing one. */
function tickSeries(days, baseValue, cal) {
  cal = cal || CAL.noHolidays;
  var out = [];
  days.forEach(function (d, i) {
    var date = '2026-08-' + (d < 10 ? '0' + d : d);
    var closeAt = CMP.instantForLocal(date, cal.close, cal.timeZone);
    /* Two intraday readings at deliberately WRONG values, then the closing one. If the
       reducer picked any of the first two the aligned values would not match. */
    out.push(obs('vendorB|t:' + (closeAt - 7200000), baseValue + i + 5.0, closeAt - 7200000));
    out.push(obs('vendorB|t:' + (closeAt - 3600000), baseValue + i + 3.0, closeAt - 3600000));
    out.push(obs('vendorB|t:' + closeAt, baseValue + i, closeAt));
  });
  return out;
}

// ── T1: the pair the gate exists to admit ────────────────────────────────────────────
(function () {
  console.log('T1: six session-aligned pairs qualify, and the CLOSING tick is the one chosen');
  var v = CMP.evaluate(
    { spec: CLOSE_NH, observations: closeSeries(DAYNUM, 100) },
    { spec: TICK_NH,  observations: tickSeries(DAYNUM, 100) },
    CAL);
  assert('comparable', v.comparable === true, v.why);
  assert('eligible at six aligned sessions', v.eligible === true, v.why);
  assert('exactly six aligned sessions', v.alignedSessions === 6, String(v.alignedSessions));
  assert('sessions are the six declared, in sorted order',
    v.sessions.join(',') === SESSIONS.join(','), v.sessions.join(','));
  assert('the closing tick was selected on every session, not an intraday one',
    v.pairs.every(function (p) { return p.a.value === p.b.value; }),
    JSON.stringify(v.pairs.map(function (p) { return [p.a.value, p.b.value]; })));
  assert('and the two intraday readings per session were folded away',
    v.collapsed === 12, String(v.collapsed));
})();

// ── T2: THE THRESHOLD IS NOT WEAKENED ────────────────────────────────────────────────
(function () {
  console.log('T2: five aligned sessions do NOT qualify');
  var five = DAYNUM.slice(0, 5);
  var v = CMP.evaluate(
    { spec: CLOSE_NH, observations: closeSeries(five, 100) },
    { spec: TICK_NH,  observations: tickSeries(five, 100) },
    CAL);
  assert('comparable, because the sessions do align', v.comparable === true, v.why);
  assert('but NOT eligible', v.eligible === false);
  assert('five aligned sessions counted', v.alignedSessions === 5, String(v.alignedSessions));
  assert('and the reason names the shortfall', /only 5 aligned/.test(v.why), v.why);
  assert('the threshold is divergence.js MIN_OBSERVATIONS, not a local copy',
    CMP.MIN_ALIGNED === require('../core/divergence.js').MIN_OBSERVATIONS && CMP.MIN_ALIGNED === 6,
    String(CMP.MIN_ALIGNED));
})();

// ── T3: persistence must not manufacture evidence ────────────────────────────────────
(function () {
  console.log('T3: an identity repeated many times counts once');
  var closes = closeSeries(DAYNUM, 100);
  var repeated = [];
  /* The measured production shape: single identities re-recorded 11 to 49 times. */
  closes.forEach(function (o) { for (var i = 0; i < 49; i++) repeated.push(obs(o.identity, o.value, o.observedAt)); });
  var v = CMP.evaluate(
    { spec: CLOSE_NH, observations: repeated },
    { spec: TICK_NH,  observations: tickSeries(DAYNUM, 100) },
    CAL);
  assert('still six aligned sessions, not 294', v.alignedSessions === 6, String(v.alignedSessions));
  assert('eligible', v.eligible === true, v.why);
  assert('and the collapse is reported as a number, not assumed',
    v.collapsed === 6 * 48 + 12, String(v.collapsed));
})();

// ── T4: aliases of one publication must not become two observations ──────────────────
(function () {
  console.log('T4: two aliases for the same session collapse, deterministically');
  var closes = closeSeries(DAYNUM, 100);
  var aliased = [];
  closes.forEach(function (o) {
    aliased.push(o);
    /* Same session, same instant, different identity string, DIFFERENT value. If both
       survived, the aligned series would silently depend on which arrived first. */
    aliased.push(obs('vendorA-mirror|' + o.identity, o.value + 99, o.observedAt));
  });
  var v = CMP.evaluate(
    { spec: CLOSE_NH, observations: aliased },
    { spec: TICK_NH,  observations: tickSeries(DAYNUM, 100) },
    CAL);
  assert('six aligned sessions, not twelve', v.alignedSessions === 6, String(v.alignedSessions));
  var forward = v.pairs.map(function (p) { return p.a.identity; }).join('|');
  var rev = CMP.evaluate(
    { spec: CLOSE_NH, observations: aliased.slice().reverse() },
    { spec: TICK_NH,  observations: tickSeries(DAYNUM, 100).reverse() },
    CAL);
  assert('and reversing arrival order selects the SAME observation every time',
    rev.pairs.map(function (p) { return p.a.identity; }).join('|') === forward, forward);
})();

// ── T5: the measured production failure, reproduced and refused ──────────────────────
(function () {
  console.log('T5: a close compared against the NEXT session\'s intraday tick does not align');
  /* Side A publishes closes for Aug 4,5,6,7,10,11. Side B publishes ticks only on the
     FOLLOWING sessions. Same instrument, same calendar, six identities each, zero
     comparable sessions. This is the 93%-stale shape with the overlap removed. */
  var later = [5, 6, 7, 10, 11, 12];
  var v = CMP.evaluate(
    { spec: CLOSE_NH, observations: closeSeries([3, 4, 5, 6, 7, 10], 100) },
    { spec: TICK_NH,  observations: tickSeries([11, 12, 13, 14, 17, 18], 100) },
    CAL);
  assert('not comparable', v.comparable === false);
  assert('and the reason is that no session is covered by both',
    v.why === CMP.ABSTAIN.NO_SESSION_OVERLAP, v.why);
  assert('zero aligned sessions', v.alignedSessions === 0, String(v.alignedSessions));
  assert('six identities per side did not help', later.length === 6);
})();

// ── T6: an out-of-window tick is not the session's close ─────────────────────────────
(function () {
  console.log('T6: a tick after the close belongs to no session and is dropped');
  var after = DAYNUM.map(function (d) {
    var date = '2026-08-' + (d < 10 ? '0' + d : d);
    var closeAt = CMP.instantForLocal(date, CAL.noHolidays.close, CAL.noHolidays.timeZone);
    return obs('vendorB|after:' + date, 999, closeAt + 3600000);   // one hour after the close
  });
  var v = CMP.evaluate(
    { spec: CLOSE_NH, observations: closeSeries(DAYNUM, 100) },
    { spec: TICK_NH,  observations: after },
    CAL);
  assert('no overlap', v.comparable === false && v.why === CMP.ABSTAIN.NO_SESSION_OVERLAP, v.why);
  assert('and every after-close tick is counted under its own reason',
    v.abstentions[CMP.ABSTAIN.OUTSIDE_WINDOW] === 6,
    JSON.stringify(v.abstentions));

  console.log('T6b: a tick BEFORE the open is dropped for the same reason');
  var early = DAYNUM.map(function (d) {
    var date = '2026-08-' + (d < 10 ? '0' + d : d);
    return obs('vendorB|pre:' + date, 999,
      CMP.instantForLocal(date, CAL.noHolidays.open, CAL.noHolidays.timeZone) - 60000);
  });
  var v2 = CMP.evaluate(
    { spec: CLOSE_NH, observations: closeSeries(DAYNUM, 100) },
    { spec: TICK_NH,  observations: early }, CAL);
  assert('pre-open ticks dropped', v2.abstentions[CMP.ABSTAIN.OUTSIDE_WINDOW] === 6,
    JSON.stringify(v2.abstentions));
})();

// ── T7: weekends and declared holidays ───────────────────────────────────────────────
(function () {
  console.log('T7: a weekend observation is not a session');
  /* 2026-08-08 is a Saturday and 2026-08-09 a Sunday. */
  var weekend = [
    obs('w|sat', 100, utc(2026, 8, 8, 20, 0)),
    obs('w|sun', 101, utc(2026, 8, 9, 20, 0))
  ];
  var v = CMP.evaluate(
    { spec: CLOSE_NH, observations: weekend },
    { spec: CLOSE_NH, observations: weekend }, CAL);
  assert('both weekend days rejected', v.abstentions[CMP.ABSTAIN.NOT_A_SESSION_DAY] === 4,
    JSON.stringify(v.abstentions));
  assert('and nothing aligns', v.comparable === false, v.why);

  console.log('T7b: a DECLARED holiday is not a session, and the same date is fine without the declaration');
  var withHoliday = CMP.evaluate(
    { spec: CLOSE_SPEC, observations: closeSeries(DAYNUM, 100, CAL.equities) },
    { spec: TICK_SPEC,  observations: tickSeries(DAYNUM, 100, CAL.equities) }, CAL);
  assert('the holiday session is excluded, leaving five', withHoliday.alignedSessions === 5,
    String(withHoliday.alignedSessions));
  assert('so the pair no longer qualifies', withHoliday.eligible === false, withHoliday.why);
  assert('and 2026-08-06 is the missing one',
    withHoliday.sessions.indexOf('2026-08-06') < 0, withHoliday.sessions.join(','));
  assert('the SAME data qualifies under a calendar that declares no holiday',
    CMP.evaluate({ spec: CLOSE_NH, observations: closeSeries(DAYNUM, 100) },
                 { spec: TICK_NH,  observations: tickSeries(DAYNUM, 100) }, CAL).eligible === true);
})();

// ── T8: DST, which a fixed offset would get wrong for half the year ──────────────────
(function () {
  console.log('T8: the session close follows DST');
  assert('16:00 New York in August is 20:00Z (EDT)',
    CMP.instantForLocal('2026-08-07', '16:00', 'America/New_York') === utc(2026, 8, 7, 20, 0));
  assert('16:00 New York in January is 21:00Z (EST)',
    CMP.instantForLocal('2026-01-09', '16:00', 'America/New_York') === utc(2026, 1, 9, 21, 0));
  assert('the two differ by exactly one hour',
    (CMP.instantForLocal('2026-01-09', '16:00', 'America/New_York') - utc(2026, 1, 9, 16, 0)) -
    (CMP.instantForLocal('2026-08-07', '16:00', 'America/New_York') - utc(2026, 8, 7, 16, 0)) === 3600000);

  /* A winter tick at 20:30Z is INSIDE the session (15:30 EST); the identical wall-clock
     instant in summer would be after the close. A fixed offset cannot get both right. */
  var winterClose = CMP.instantForLocal('2026-01-09', '16:00', 'America/New_York');
  var v = CMP.evaluate(
    { spec: CLOSE_NH, observations: [obs('a|w', 50, winterClose)] },
    { spec: TICK_NH,  observations: [obs('b|w', 50, utc(2026, 1, 9, 20, 30))] }, CAL);
  assert('a 20:30Z winter tick is inside the session and aligns', v.alignedSessions === 1,
    JSON.stringify(v.abstentions));
  var v2 = CMP.evaluate(
    { spec: CLOSE_NH, observations: [obs('a|s', 50, CMP.instantForLocal('2026-08-07', '16:00', 'America/New_York'))] },
    { spec: TICK_NH,  observations: [obs('b|s', 50, utc(2026, 8, 7, 20, 30))] }, CAL);
  assert('the same 20:30Z clock time in summer is AFTER the close and is dropped',
    v2.abstentions[CMP.ABSTAIN.OUTSIDE_WINDOW] === 1, JSON.stringify(v2.abstentions));
})();

// ── T9: counts come from the aligned subset, not the channel ─────────────────────────
(function () {
  console.log('T9: movement is judged on the aligned series, not the whole channel');
  /* The tick channel is wildly active intraday, but every CLOSING tick is the same
     number, and the close side is flat too. The channel moves; the comparison does not. */
  var flatCloses = DAYNUM.map(function (d) {
    var date = '2026-08-' + (d < 10 ? '0' + d : d);
    return obs('a|' + date, 500, CMP.instantForLocal(date, CAL.noHolidays.close, CAL.noHolidays.timeZone));
  });
  var busyTicks = [];
  DAYNUM.forEach(function (d, i) {
    var date = '2026-08-' + (d < 10 ? '0' + d : d);
    var closeAt = CMP.instantForLocal(date, CAL.noHolidays.close, CAL.noHolidays.timeZone);
    busyTicks.push(obs('b|x' + i, 400 + i * 13, closeAt - 7200000));
    busyTicks.push(obs('b|y' + i, 600 - i * 11, closeAt - 3600000));
    busyTicks.push(obs('b|c' + i, 500, closeAt));
  });
  var v = CMP.evaluate({ spec: CLOSE_NH, observations: flatCloses },
                       { spec: TICK_NH,  observations: busyTicks }, CAL);
  assert('six aligned sessions', v.alignedSessions === 6, String(v.alignedSessions));
  assert('but the aligned series does not move on either side',
    v.movement.a === false && v.movement.b === false, JSON.stringify(v.movement));
  assert('so it is NOT eligible despite a channel with 13 distinct values',
    v.eligible === false, v.why);
  assert('and the reason names movement, not the count', /does not move/.test(v.why), v.why);
})();

// ── T10: fail closed on missing or ambiguous metadata ────────────────────────────────
(function () {
  console.log('T10: every metadata gap abstains with a named reason');
  var good = { spec: CLOSE_NH, observations: closeSeries(DAYNUM, 100) };
  function why(a, b, cals) { return CMP.evaluate(a, b, cals === undefined ? CAL : cals).why; }

  assert('no declared reference interval',
    why({ spec: {}, observations: [] }, good) === CMP.ABSTAIN.NO_INTERVAL);
  assert('unknown interval kind',
    why({ spec: { referenceInterval: { kind: 'weekly', calendar: 'noHolidays' } }, observations: [] }, good)
      === CMP.ABSTAIN.UNKNOWN_INTERVAL);
  assert('interval declares no calendar',
    why({ spec: { referenceInterval: { kind: CMP.INTERVAL.SESSION_CLOSE } }, observations: [] }, good)
      === CMP.ABSTAIN.NO_CALENDAR_DECLARED);
  assert('the two sides declare different calendars',
    why({ spec: CLOSE_SPEC, observations: [] }, good) === CMP.ABSTAIN.CALENDAR_MISMATCH);
  assert('the declared calendar was not supplied',
    why(good, good, {}) === CMP.ABSTAIN.CALENDAR_MISSING);
  assert('the calendar is missing a close time',
    why(good, good, { noHolidays: { timeZone: 'America/New_York', sessionDays: [1] } })
      === CMP.ABSTAIN.CALENDAR_INCOMPLETE);
  assert('the calendar is missing session days',
    why(good, good, { noHolidays: { timeZone: 'America/New_York', close: '16:00' } })
      === CMP.ABSTAIN.CALENDAR_INCOMPLETE);
  assert('the runtime cannot resolve the timezone',
    why(good, good, { noHolidays: { timeZone: 'Mars/Olympus', close: '16:00', sessionDays: [1, 2, 3, 4, 5] } })
      === CMP.ABSTAIN.TIMEZONE_UNSUPPORTED);
  assert('a real zone IS resolvable, so the check above is not passing vacuously',
    CMP.timeZoneUsable('America/New_York') === true && CMP.timeZoneUsable('Mars/Olympus') === false);

  console.log('T10b: unusable observations are dropped and counted, never silently');
  var v = CMP.evaluate(
    { spec: CLOSE_NH, observations: [
      obs('', 1, utc(2026, 8, 7, 20, 0)),
      obs('x', 1, undefined),
      obs('y', NaN, utc(2026, 8, 7, 20, 0))
    ] }, good, CAL);
  assert('missing identity counted', v.abstentions[CMP.ABSTAIN.NO_IDENTITY] === 1, JSON.stringify(v.abstentions));
  assert('missing observedAt counted', v.abstentions[CMP.ABSTAIN.NO_OBSERVED_AT] === 1, JSON.stringify(v.abstentions));
  assert('non-finite value counted', v.abstentions[CMP.ABSTAIN.NO_VALUE] === 1, JSON.stringify(v.abstentions));
  assert('and nothing qualified out of them', v.eligible === false);
})();

// ── T11: determinism across serialization, restoration and reordering ────────────────
(function () {
  console.log('T11: the verdict survives a serialize/restore round trip byte-identically');
  var a = { spec: CLOSE_NH, observations: closeSeries(DAYNUM, 100) };
  var b = { spec: TICK_NH,  observations: tickSeries(DAYNUM, 100) };
  var first = CMP.evaluate(a, b, CAL);

  var a2 = JSON.parse(JSON.stringify(a)), b2 = JSON.parse(JSON.stringify(b)), cal2 = JSON.parse(JSON.stringify(CAL));
  var second = CMP.evaluate(a2, b2, cal2);
  assert('identical after a JSON round trip of every input',
    JSON.stringify(first) === JSON.stringify(second));

  /* Recording order is not evidence. A replay that re-reads the same rows in a different
     order must not produce a different aligned set. */
  var shuffled = { spec: TICK_NH, observations: b.observations.slice().sort(function (x, y) {
    return String(x.identity) < String(y.identity) ? -1 : 1; }) };
  assert('and identical when the observations arrive in a different order',
    JSON.stringify(CMP.evaluate(a, shuffled, CAL)) === JSON.stringify(first));

  assert('running it twice on the same input changes nothing',
    JSON.stringify(CMP.evaluate(a, b, CAL)) === JSON.stringify(first));
})();

// ── T12: nothing here is tuned to one market ─────────────────────────────────────────
(function () {
  console.log('T12: a structurally different calendar works with no code change');
  var days = [4, 5, 6, 7, 10, 11];
  var closes = days.map(function (d, i) {
    var date = '2026-08-' + (d < 10 ? '0' + d : d);
    return obs('jp|' + date, 3000 + i, CMP.instantForLocal(date, CAL.tokyo.close, CAL.tokyo.timeZone));
  });
  var ticks = [];
  days.forEach(function (d, i) {
    var date = '2026-08-' + (d < 10 ? '0' + d : d);
    var closeAt = CMP.instantForLocal(date, CAL.tokyo.close, CAL.tokyo.timeZone);
    ticks.push(obs('jp2|early' + i, 9999, closeAt - 5400000));
    ticks.push(obs('jp2|' + date, 3000 + i, closeAt));
  });
  var TOKYO_CLOSE = { referenceInterval: { kind: CMP.INTERVAL.SESSION_CLOSE, calendar: 'tokyo' } };
  var TOKYO_TICK  = { referenceInterval: { kind: CMP.INTERVAL.POINT_IN_TIME, calendar: 'tokyo' } };
  var v = CMP.evaluate({ spec: TOKYO_CLOSE, observations: closes },
                       { spec: TOKYO_TICK,  observations: ticks }, CAL);
  assert('six aligned sessions on a different exchange calendar', v.alignedSessions === 6,
    String(v.alignedSessions));
  assert('eligible', v.eligible === true, v.why);
  assert('15:00 Tokyo is 06:00Z and does not shift with DST',
    CMP.instantForLocal('2026-08-04', '15:00', 'Asia/Tokyo') === utc(2026, 8, 4, 6, 0) &&
    CMP.instantForLocal('2026-01-09', '15:00', 'Asia/Tokyo') === utc(2026, 1, 9, 6, 0));
})();

// ── T13: comparability is not decided by agreement ───────────────────────────────────
(function () {
  console.log('T13: values never decide comparability');
  var closes = closeSeries(DAYNUM, 100);
  var wild = DAYNUM.map(function (d, i) {
    var date = '2026-08-' + (d < 10 ? '0' + d : d);
    return obs('b|' + date, 1000000 * (i + 1),
      CMP.instantForLocal(date, CAL.noHolidays.close, CAL.noHolidays.timeZone));
  });
  var v = CMP.evaluate({ spec: CLOSE_NH, observations: closes },
                       { spec: CLOSE_NH, observations: wild }, CAL);
  assert('two sides that violently disagree are still COMPARABLE', v.comparable === true, v.why);
  assert('and eligible, because whether they agree is divergence\'s question, not this one',
    v.eligible === true, v.why);

  /* The mirror: identical values on sessions that do not overlap must not align. */
  var same = [3, 4, 5, 6, 7, 10];
  var other = [11, 12, 13, 14, 17, 18];
  var v2 = CMP.evaluate(
    { spec: CLOSE_NH, observations: closeSeries(same, 42).map(function (o) { return obs(o.identity, 42, o.observedAt); }) },
    { spec: CLOSE_NH, observations: closeSeries(other, 42).map(function (o) { return obs(o.identity, 42, o.observedAt); }) },
    CAL);
  assert('and perfectly equal values on disjoint sessions do NOT align',
    v2.comparable === false && v2.why === CMP.ABSTAIN.NO_SESSION_OVERLAP, v2.why);
})();

// ── T14: the gate activates nothing ──────────────────────────────────────────────────
(function () {
  console.log('T14: the module cannot activate a pathway or move a threshold');
  var api = Object.keys(require('../core/comparability.js')).sort().join(',');
  assert('its surface is a verdict and time helpers, with no activate/enable/promote',
    !/activat|enable|promote|install/i.test(api), api);
  assert('MIN_ALIGNED is read-only in practice: a caller override cannot go below the floor',
    CMP.evaluate({ spec: CLOSE_NH, observations: closeSeries(DAYNUM.slice(0, 2), 1) },
                 { spec: TICK_NH,  observations: tickSeries(DAYNUM.slice(0, 2), 1) },
                 CAL, { minAligned: 2 }).minAligned === 2,
    'an explicit opts.minAligned is honoured and REPORTED, so a relaxed run cannot be mistaken for a default one');
  assert('while the default remains six',
    CMP.evaluate({ spec: CLOSE_NH, observations: closeSeries(DAYNUM.slice(0, 2), 1) },
                 { spec: TICK_NH,  observations: tickSeries(DAYNUM.slice(0, 2), 1) },
                 CAL).minAligned === 6);
})();

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
