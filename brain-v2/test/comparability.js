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
 *
 * T15 onward are negative controls for defects found in review of the first draft. Each
 * one FAILED before its fix, and each is written so that reverting the fix fails it.
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

var QUARTER_HOUR = 15 * 60 * 1000;
var CLOSE_SPEC = { referenceInterval: { kind: CMP.INTERVAL.SESSION_CLOSE, calendar: 'equities' } };
var TICK_SPEC  = { referenceInterval: { kind: CMP.INTERVAL.POINT_IN_TIME, calendar: 'equities', maxLagFromCloseMs: QUARTER_HOUR } };
var CLOSE_NH   = { referenceInterval: { kind: CMP.INTERVAL.SESSION_CLOSE, calendar: 'noHolidays' } };
var TICK_NH    = { referenceInterval: { kind: CMP.INTERVAL.POINT_IN_TIME, calendar: 'noHolidays', maxLagFromCloseMs: QUARTER_HOUR } };

function utc(y, mo, d, h, mi) { return Date.UTC(y, mo - 1, d, h || 0, mi || 0, 0); }
/**
 * `recordedAt` is OPTIONAL and is omitted entirely when not passed, so legacy fixtures have
 * no such key rather than a null one. Time is INJECTED here in every case; nothing in this
 * file reads a clock, which is what makes a pass today a pass in December.
 */
function obs(identity, value, observedAt, recordedAt) {
  var o = { identity: identity, value: value, observedAt: observedAt };
  if (recordedAt !== undefined) o.recordedAt = recordedAt;
  return o;
}
function dateOf(d) { return '2026-08-' + (d < 10 ? '0' + d : d); }

/* Six real trading sessions, weekend skipped. 2026-08-07 is a Friday. */
var SESSIONS = ['2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-10', '2026-08-11'];
var DAYNUM   = [4, 5, 6, 7, 10, 11];

function closeAtOf(d, cal) {
  cal = cal || CAL.noHolidays;
  return CMP.instantForLocal(dateOf(d), cal.close, cal.timeZone);
}

/** A close-side series: one settled figure per session, at that session's close instant. */
function closeSeries(days, baseValue, cal) {
  return days.map(function (d, i) { return obs('vendorA|day:' + dateOf(d), baseValue + i, closeAtOf(d, cal)); });
}

/** A tick-side series: several intraday readings per session plus the closing one. */
function tickSeries(days, baseValue, cal) {
  var out = [];
  days.forEach(function (d, i) {
    var closeAt = closeAtOf(d, cal);
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
    v.collapsed === 12 && v.collapsedAligned === 12, String(v.collapsed));
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
  console.log('T4: two aliases carrying the SAME value collapse, deterministically');
  var closes = closeSeries(DAYNUM, 100);
  var aliased = [];
  closes.forEach(function (o) {
    aliased.push(o);
    /* Same session, same instant, different identity string, SAME value: a genuine alias
       of one publication. Conflicting values at one instant are T18's business. */
    aliased.push(obs('vendorA-mirror|' + o.identity, o.value, o.observedAt));
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
  console.log('T5: a close compared against a LATER session\'s intraday tick does not align');
  var v = CMP.evaluate(
    { spec: CLOSE_NH, observations: closeSeries([3, 4, 5, 6, 7, 10], 100) },
    { spec: TICK_NH,  observations: tickSeries([11, 12, 13, 14, 17, 18], 100) },
    CAL);
  assert('not comparable', v.comparable === false);
  assert('and the reason is that no session is covered by both',
    v.why === CMP.ABSTAIN.NO_SESSION_OVERLAP, v.why);
  assert('zero aligned sessions', v.alignedSessions === 0, String(v.alignedSessions));
  assert('six identities per side did not help', v.pairs.length === 0);
})();

// ── T6: an out-of-window tick is not the session's close ─────────────────────────────
(function () {
  console.log('T6: a tick after the close belongs to no session and is dropped');
  var after = DAYNUM.map(function (d) { return obs('vendorB|after:' + dateOf(d), 999, closeAtOf(d) + 3600000); });
  var v = CMP.evaluate(
    { spec: CLOSE_NH, observations: closeSeries(DAYNUM, 100) },
    { spec: TICK_NH,  observations: after },
    CAL);
  assert('no overlap', v.comparable === false && v.why === CMP.ABSTAIN.NO_SESSION_OVERLAP, v.why);
  assert('and every after-close tick is counted under its own reason',
    v.abstentions[CMP.ABSTAIN.OUTSIDE_WINDOW] === 6, JSON.stringify(v.abstentions));

  console.log('T6b: a tick BEFORE the open is dropped for the same reason');
  var early = DAYNUM.map(function (d) {
    return obs('vendorB|pre:' + dateOf(d), 999,
      CMP.instantForLocal(dateOf(d), CAL.noHolidays.open, CAL.noHolidays.timeZone) - 60000);
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
  var weekend = [obs('w|sat', 100, utc(2026, 8, 8, 20, 0)), obs('w|sun', 101, utc(2026, 8, 9, 20, 0))];
  var v = CMP.evaluate({ spec: CLOSE_NH, observations: weekend },
                       { spec: CLOSE_NH, observations: weekend }, CAL);
  assert('both weekend days rejected on both sides',
    v.abstentions[CMP.ABSTAIN.NOT_A_SESSION_DAY] === 4, JSON.stringify(v.abstentions));
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
     instant in summer is after the close. A fixed offset cannot get both right. This spec
     declares an hour of tolerance so the DST point is tested independently of T15's. */
  var HOUR_TICK = { referenceInterval: { kind: CMP.INTERVAL.POINT_IN_TIME, calendar: 'noHolidays', maxLagFromCloseMs: 3600000 } };
  var v = CMP.evaluate(
    { spec: CLOSE_NH, observations: [obs('a|w', 50, CMP.instantForLocal('2026-01-09', '16:00', 'America/New_York'))] },
    { spec: HOUR_TICK, observations: [obs('b|w', 50, utc(2026, 1, 9, 20, 30))] }, CAL);
  assert('a 20:30Z winter tick is inside the session and aligns', v.alignedSessions === 1,
    JSON.stringify(v.abstentions));
  var v2 = CMP.evaluate(
    { spec: CLOSE_NH, observations: [obs('a|s', 50, CMP.instantForLocal('2026-08-07', '16:00', 'America/New_York'))] },
    { spec: HOUR_TICK, observations: [obs('b|s', 50, utc(2026, 8, 7, 20, 30))] }, CAL);
  assert('the same 20:30Z clock time in summer is AFTER the close and is dropped',
    v2.abstentions[CMP.ABSTAIN.OUTSIDE_WINDOW] === 1, JSON.stringify(v2.abstentions));
})();

// ── T9: counts come from the aligned subset, not the channel ─────────────────────────
(function () {
  console.log('T9: movement is judged on the aligned series, not the whole channel');
  var flatCloses = DAYNUM.map(function (d) { return obs('a|' + dateOf(d), 500, closeAtOf(d)); });
  var busyTicks = [];
  DAYNUM.forEach(function (d, i) {
    var closeAt = closeAtOf(d);
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
  assert('the declared calendar was not supplied', why(good, good, {}) === CMP.ABSTAIN.CALENDAR_MISSING);
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

  var second = CMP.evaluate(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)),
                            JSON.parse(JSON.stringify(CAL)));
  assert('identical after a JSON round trip of every input',
    JSON.stringify(first) === JSON.stringify(second));

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
  var days = DAYNUM;
  var closes = days.map(function (d, i) { return obs('jp|' + dateOf(d), 3000 + i, closeAtOf(d, CAL.tokyo)); });
  var ticks = [];
  days.forEach(function (d, i) {
    var closeAt = closeAtOf(d, CAL.tokyo);
    ticks.push(obs('jp2|early' + i, 9999, closeAt - 5400000));
    ticks.push(obs('jp2|' + dateOf(d), 3000 + i, closeAt));
  });
  var v = CMP.evaluate(
    { spec: { referenceInterval: { kind: CMP.INTERVAL.SESSION_CLOSE, calendar: 'tokyo' } }, observations: closes },
    { spec: { referenceInterval: { kind: CMP.INTERVAL.POINT_IN_TIME, calendar: 'tokyo', maxLagFromCloseMs: QUARTER_HOUR } }, observations: ticks },
    CAL);
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
  var wild = DAYNUM.map(function (d, i) { return obs('b|' + dateOf(d), 1000000 * (i + 1), closeAtOf(d)); });
  var v = CMP.evaluate({ spec: CLOSE_NH, observations: closeSeries(DAYNUM, 100) },
                       { spec: CLOSE_NH, observations: wild }, CAL);
  assert('two sides that violently disagree are still COMPARABLE', v.comparable === true, v.why);
  assert('and eligible, because whether they agree is divergence\'s question, not this one',
    v.eligible === true, v.why);

  var flat = function (days) {
    return days.map(function (d) { return obs('x|' + dateOf(d), 42, closeAtOf(d)); });
  };
  var v2 = CMP.evaluate({ spec: CLOSE_NH, observations: flat([3, 4, 5, 6, 7, 10]) },
                        { spec: CLOSE_NH, observations: flat([11, 12, 13, 14, 17, 18]) }, CAL);
  assert('and perfectly equal values on disjoint sessions do NOT align',
    v2.comparable === false && v2.why === CMP.ABSTAIN.NO_SESSION_OVERLAP, v2.why);
})();

// ── T14: the gate activates nothing ──────────────────────────────────────────────────
(function () {
  console.log('T14: the module cannot activate a pathway');
  var api = Object.keys(require('../core/comparability.js')).sort().join(',');
  assert('its surface is a verdict and pure helpers, with no activate/enable/promote',
    !/activat|enable|promote|install/i.test(api), api);
})();

// ── T15: a feed that stops early must not stand against a settled close ──────────────
(function () {
  console.log('T15: NEGATIVE CONTROL — inside the window is not the same as near the close');
  /* Every session has ticks, all comfortably inside the window, but the feed dies three
     hours before the close. Before the maxLag rule these produced six aligned sessions and
     a PASS, comparing a lunchtime reading against a settled close. */
  var early = [];
  DAYNUM.forEach(function (d, i) {
    var closeAt = closeAtOf(d);
    early.push(obs('b|a' + i, 700 + i, closeAt - 14400000));
    early.push(obs('b|b' + i, 701 + i, closeAt - 10800000));
  });
  var v = CMP.evaluate({ spec: CLOSE_NH, observations: closeSeries(DAYNUM, 100) },
                       { spec: TICK_NH,  observations: early }, CAL);
  assert('no session survives', v.comparable === false && v.why === CMP.ABSTAIN.NO_SESSION_OVERLAP, v.why);
  assert('each session is counted ONCE as too far from the close, not once per tick',
    v.abstentions[CMP.ABSTAIN.TOO_FAR_FROM_CLOSE] === 6, JSON.stringify(v.abstentions));
  assert('and routine intraday ticks are not miscounted as staleness on a healthy feed',
    CMP.evaluate({ spec: CLOSE_NH, observations: closeSeries(DAYNUM, 100) },
                 { spec: TICK_NH,  observations: tickSeries(DAYNUM, 100) }, CAL)
      .abstentions[CMP.ABSTAIN.TOO_FAR_FROM_CLOSE] === undefined);

  console.log('T15b: the tolerance is declared, and its absence fails closed');
  var noLag = { referenceInterval: { kind: CMP.INTERVAL.POINT_IN_TIME, calendar: 'noHolidays' } };
  assert('a point-in-time channel with no maxLagFromCloseMs abstains',
    CMP.evaluate({ spec: CLOSE_NH, observations: [] }, { spec: noLag, observations: [] }, CAL).why
      === CMP.ABSTAIN.NO_MAX_LAG);
  [0, -1, 'soon', NaN, Infinity].forEach(function (bad) {
    var s = { referenceInterval: { kind: CMP.INTERVAL.POINT_IN_TIME, calendar: 'noHolidays', maxLagFromCloseMs: bad } };
    assert('a maxLagFromCloseMs of ' + JSON.stringify(bad) + ' abstains',
      CMP.evaluate({ spec: CLOSE_NH, observations: [] }, { spec: s, observations: [] }, CAL).why
        === CMP.ABSTAIN.BAD_MAX_LAG);
  });
  assert('a session close is NOT subject to the lag rule, having no intraday samples',
    CMP.evaluate({ spec: CLOSE_NH, observations: closeSeries(DAYNUM, 100) },
                 { spec: CLOSE_NH, observations: closeSeries(DAYNUM, 200) }, CAL).eligible === true);
})();

// ── T16: the floor cannot be lowered by a caller ─────────────────────────────────────
(function () {
  console.log('T16: NEGATIVE CONTROL — opts.minAligned cannot go below the evidence floor');
  var two = DAYNUM.slice(0, 2);
  var a = { spec: CLOSE_NH, observations: closeSeries(two, 1) };
  var b = { spec: TICK_NH,  observations: tickSeries(two, 1) };
  [1, 2, 5, 0, -3].forEach(function (n) {
    var v = CMP.evaluate(a, b, CAL, { minAligned: n });
    assert('minAligned ' + n + ' is refused by name, not clamped',
      v.eligible === false && v.why === CMP.ABSTAIN.MIN_ALIGNED_TOO_LOW, v.why);
  });
  assert('a non-integer override is refused too',
    CMP.evaluate(a, b, CAL, { minAligned: 6.5 }).why === CMP.ABSTAIN.MIN_ALIGNED_TOO_LOW);
  assert('the floor itself is accepted', CMP.evaluate(a, b, CAL, { minAligned: 6 }).minAligned === 6);
  assert('and a STRICTER override is honoured and reported',
    CMP.evaluate({ spec: CLOSE_NH, observations: closeSeries(DAYNUM, 1) },
                 { spec: TICK_NH,  observations: tickSeries(DAYNUM, 1) }, CAL, { minAligned: 10 })
      .eligible === false);
  assert('while the default remains six', CMP.evaluate(a, b, CAL).minAligned === 6);
})();

// ── T17: calendar declarations are validated, never normalised ───────────────────────
(function () {
  console.log('T17: NEGATIVE CONTROL — a malformed calendar abstains by name and never rolls a date forward');
  var good = { spec: CLOSE_NH, observations: closeSeries(DAYNUM, 100) };
  function whyCal(cal) { return CMP.evaluate(good, good, { noHolidays: cal }).why; }
  var base = { timeZone: 'America/New_York', close: '16:00', sessionDays: [1, 2, 3, 4, 5] };
  function with_(k, v) { var c = Object.assign({}, base); c[k] = v; return c; }

  assert('an out-of-range close abstains', whyCal(with_('close', '99:99')) === CMP.ABSTAIN.CALENDAR_BAD_TIME);
  assert('a close of 24:00 abstains', whyCal(with_('close', '24:00')) === CMP.ABSTAIN.CALENDAR_BAD_TIME);
  assert('a malformed close abstains', whyCal(with_('close', '4pm')) === CMP.ABSTAIN.CALENDAR_BAD_TIME);
  assert('an out-of-range open abstains', whyCal(with_('open', '25:00')) === CMP.ABSTAIN.CALENDAR_BAD_TIME);
  assert('a non-string open abstains', whyCal(with_('open', 930)) === CMP.ABSTAIN.CALENDAR_BAD_TIME);
  assert('an open after the close abstains rather than modelling an overnight session',
    whyCal(with_('open', '17:00')) === CMP.ABSTAIN.CALENDAR_WINDOW_INVERTED);
  assert('an open EQUAL to the close abstains, since the window would be empty',
    whyCal(with_('open', '16:00')) === CMP.ABSTAIN.CALENDAR_WINDOW_INVERTED);

  [[7], [-1], [1, 1], [1.5], ['1'], [null]].forEach(function (bad) {
    assert('sessionDays ' + JSON.stringify(bad) + ' abstains',
      whyCal(with_('sessionDays', bad)) === CMP.ABSTAIN.CALENDAR_BAD_SESSION_DAYS);
  });

  assert('a non-array holidays abstains',
    whyCal(with_('holidays', '2026-08-06')) === CMP.ABSTAIN.CALENDAR_BAD_HOLIDAYS);
  assert('a malformed holiday date abstains',
    whyCal(with_('holidays', ['2026-8-6'])) === CMP.ABSTAIN.CALENDAR_BAD_HOLIDAYS);
  /* THE ONE THAT WOULD HAVE SUPPRESSED THE WRONG DAY. Date.UTC(2026, 1, 30) is 2 March, so
     a normalising implementation would quietly close a session nobody declared. */
  assert('a date that does not exist abstains instead of rolling into the next month',
    whyCal(with_('holidays', ['2026-02-30'])) === CMP.ABSTAIN.CALENDAR_BAD_HOLIDAYS);
  assert('and the underlying check agrees',
    CMP.validCalendarDate('2026-02-30') === false && CMP.validCalendarDate('2026-02-28') === true &&
    CMP.validCalendarDate('2026-13-01') === false && CMP.validCalendarDate('2026-08-06') === true);
  assert('a well-formed holiday list is still accepted',
    whyCal(with_('holidays', ['2026-08-06'])) === null || whyCal(with_('holidays', ['2026-08-06'])) === undefined ||
    CMP.evaluate(good, good, { noHolidays: with_('holidays', ['2026-08-06']) }).comparable === true);
})();

// ── T18: contradictory evidence abstains rather than being tie-broken ────────────────
(function () {
  console.log('T18: NEGATIVE CONTROL — two values stamped at one instant cannot be resolved by ordering');
  var closes = closeSeries(DAYNUM, 100);
  var conflicted = [];
  closes.forEach(function (o, i) {
    conflicted.push(o);
    /* Same session, same instant, DIFFERENT value. Lexical tie-breaking would have picked
       one of them and reported a clean pair. */
    if (i === 0) conflicted.push(obs('vendorA-zz|' + o.identity, o.value + 5, o.observedAt));
  });
  var v = CMP.evaluate({ spec: CLOSE_NH, observations: conflicted },
                       { spec: TICK_NH,  observations: tickSeries(DAYNUM, 100) }, CAL);
  assert('the conflicted session is excluded', v.alignedSessions === 5, String(v.alignedSessions));
  assert('and it is the first one', v.sessions.indexOf('2026-08-04') < 0, v.sessions.join(','));
  /* UNORDERABLE, not CONFLICTING: these observations carry no `recordedAt`, so the question
     "which came later" cannot even be asked. Calling that a contradiction would claim more
     than is known. The contradiction case proper is T21c. */
  assert('counted as unorderable, because neither carries a receipt time',
    v.abstentions[CMP.ABSTAIN.UNORDERABLE] === 1, JSON.stringify(v.abstentions));
  assert('so the pair no longer qualifies', v.eligible === false, v.why);
  assert('only the conflicted session is lost, not the sound ones', v.comparable === true);

  /* ORDER INDEPENDENCE. An earlier draft detected conflicts only against the currently
     selected observation, so a contradictory pair already superseded by a later reading
     was never noticed. Here the contradiction sits BEFORE a later reading in one ordering
     and after it in the other; both must abstain. */
  var late = closeAtOf(4) ;
  var trio = [
    obs('c|1', 10, late - 60000),
    obs('c|2', 20, late - 60000),
    obs('c|3', 30, late)
  ];
  var f = CMP.evaluate({ spec: CLOSE_NH, observations: trio }, { spec: CLOSE_NH, observations: trio }, CAL);
  var r = CMP.evaluate({ spec: CLOSE_NH, observations: trio.slice().reverse() },
                       { spec: CLOSE_NH, observations: trio.slice().reverse() }, CAL);
  assert('a superseded contradiction is still detected', f.alignedSessions === 0, JSON.stringify(f.abstentions));
  assert('and detection does not depend on arrival order',
    JSON.stringify(f.abstentions) === JSON.stringify(r.abstentions), JSON.stringify(r.abstentions));

  console.log('T18b: identical values at one instant are an alias, not a conflict');
  var same = [obs('d|1', 10, late), obs('d|2', 10, late)];
  var v2 = CMP.evaluate({ spec: CLOSE_NH, observations: same }, { spec: CLOSE_NH, observations: same }, CAL);
  assert('they collapse to one observation', v2.alignedSessions === 1, JSON.stringify(v2.abstentions));
  assert('with no conflict recorded', v2.abstentions[CMP.ABSTAIN.CONFLICTING] === undefined,
    JSON.stringify(v2.abstentions));
})();

// ── T19: the collapse figure covers every session, not only the aligned ones ─────────
(function () {
  console.log('T19: NEGATIVE CONTROL — persistence folded away on unmatched sessions is still counted');
  /* Side A covers six sessions with 5 copies each; side B covers only three of them. The
     folds on A's three unmatched sessions are real discards and were previously invisible,
     because the total was summed over aligned pairs only. */
  var a = [];
  DAYNUM.forEach(function (d) {
    for (var i = 0; i < 5; i++) a.push(obs('a|' + dateOf(d), 100 + d, closeAtOf(d)));
  });
  var b = [];
  [4, 5, 6].forEach(function (d) {
    for (var i = 0; i < 3; i++) b.push(obs('b|' + dateOf(d), 100 + d, closeAtOf(d)));
  });
  var v = CMP.evaluate({ spec: CLOSE_NH, observations: a }, { spec: CLOSE_NH, observations: b }, CAL);
  assert('three aligned sessions', v.alignedSessions === 3, String(v.alignedSessions));
  assert('the aligned-only figure is 4 per session on A plus 2 on B',
    v.collapsedAligned === 3 * 4 + 3 * 2, String(v.collapsedAligned));
  assert('but the reported total also covers A\'s three unmatched sessions',
    v.collapsed === 6 * 4 + 3 * 2, String(v.collapsed));
  assert('and the total is strictly larger than the aligned-only figure here',
    v.collapsed > v.collapsedAligned);

  console.log('T19b: and it is reported even when NOTHING aligns');
  var v2 = CMP.evaluate(
    { spec: CLOSE_NH, observations: a },
    { spec: CLOSE_NH, observations: [obs('z|1', 1, closeAtOf(17)), obs('z|2', 1, closeAtOf(17))] }, CAL);
  assert('no overlap', v2.comparable === false && v2.why === CMP.ABSTAIN.NO_SESSION_OVERLAP);
  assert('yet the discarded repetition is still counted', v2.collapsed === 6 * 4 + 1,
    String(v2.collapsed));
})();

// ── T20: the production shape that the conflict rule actually caught ─────────────────
(function () {
  console.log('T20: a source that RESTATES a value under an unchanged identity abstains');
  /**
   * MEASURED, 2026-08-09, and it corrected a number this file's own header quoted.
   *
   * Alpha Vantage publishes a session close, then revises it about two hours later under
   * the SAME `trading-day` identity: 769.77 -> 769.79 (Aug 5), 768.60 -> 768.56 (Aug 6),
   * 773.22 -> 773.26 (Aug 7). The revised figure is the one that matches the other side's
   * close exactly. An earlier analysis kept only the first occurrence per identity and so
   * reported "agreement to within 0.04"; after settlement the two agree to 0.00.
   *
   * THE IDENTITY THEREFORE DOES NOT DETERMINE THE VALUE, which is a hole in the evidence
   * model one level up: counting distinct identities silently assumed it did.
   *
   * The gate abstains here and that is the correct fail-closed behaviour, but abstention is
   * not the RIGHT long-term answer: a revision is not a contradiction, and telling them
   * apart needs a recording time the observation does not currently carry. Deliberately
   * not invented here. This test pins the behaviour so the decision is made explicitly
   * rather than by whoever edits the reducer next.
   */
  var closeAt = closeAtOf(5);
  var revised = [
    obs('av|trading-day:2026-08-05', 769.77, closeAt),
    obs('av|trading-day:2026-08-05', 769.77, closeAt),
    obs('av|trading-day:2026-08-05', 769.79, closeAt),
    obs('av|trading-day:2026-08-05', 769.79, closeAt)
  ];
  var other = [obs('fh|close', 769.79, closeAt)];
  var v = CMP.evaluate({ spec: CLOSE_NH, observations: revised },
                       { spec: CLOSE_NH, observations: other }, CAL);
  assert('WITHOUT a receipt time the restated session still abstains, as unorderable',
    v.alignedSessions === 0 && v.abstentions[CMP.ABSTAIN.UNORDERABLE] === 1,
    JSON.stringify(v.abstentions));
  assert('and it abstains whichever order the two values arrive in',
    JSON.stringify(CMP.evaluate({ spec: CLOSE_NH, observations: revised.slice().reverse() },
                                { spec: CLOSE_NH, observations: other }, CAL).abstentions)
      === JSON.stringify(v.abstentions));
  assert('a source that does NOT restate is unaffected',
    CMP.evaluate({ spec: CLOSE_NH, observations: [obs('av|x', 769.79, closeAt), obs('av|x', 769.79, closeAt)] },
                 { spec: CLOSE_NH, observations: other }, CAL).alignedSessions === 1);
})();

// ── T21: revision ordering, the thing recordedAt exists for ──────────────────────────
(function () {
  console.log('T21: a later RECEIPT settles a restated value; the earlier one stays auditable');
  /* Every instant here is explicit. Nothing reads a clock, so receipt times are injected
     exactly as the recorder would have stamped them (handlers/feed-record.js row.t). */
  var REC = { first: 1786000000000, revised: 1786007200000 };   // two hours apart
  function rev(days) {
    var out = [];
    days.forEach(function (d, i) {
      var at = closeAtOf(d);
      out.push(obs('av|' + dateOf(d), 700 + i + 0.02, at, REC.first));     // provisional
      out.push(obs('av|' + dateOf(d), 700 + i, at, REC.revised));          // restatement
    });
    return out;
  }
  var other = DAYNUM.map(function (d, i) { return obs('fh|' + dateOf(d), 700 + i, closeAtOf(d)); });
  var v = CMP.evaluate({ spec: CLOSE_NH, observations: rev(DAYNUM) },
                       { spec: CLOSE_NH, observations: other }, CAL);
  assert('all six sessions resolve instead of abstaining', v.alignedSessions === 6,
    JSON.stringify(v.abstentions));
  assert('the LATER receipt is the value used, not the first-published one',
    v.pairs.every(function (p) { return p.a.value === p.b.value; }),
    JSON.stringify(v.pairs.map(function (p) { return [p.a.value, p.b.value]; })));
  assert('every session is marked as resting on a revision', v.revisedSessions === 6,
    String(v.revisedSessions));
  var r0 = v.pairs[0].revisions.a[0];
  assert('and the superseded figure is retained with the receipt that settled it',
    !!r0 && r0.recordedAt === REC.revised && r0.superseded.length === 1 &&
    r0.superseded[0].recordedAt === REC.first,
    JSON.stringify(r0));
  assert('the other side, which never revised, records none',
    v.pairs.every(function (p) { return p.revisions.b.length === 0; }));

  console.log('T21b: receipt order decides it, NOT array order');
  var forward = CMP.evaluate({ spec: CLOSE_NH, observations: rev(DAYNUM) },
                             { spec: CLOSE_NH, observations: other }, CAL);
  var reversed = CMP.evaluate({ spec: CLOSE_NH, observations: rev(DAYNUM).reverse() },
                              { spec: CLOSE_NH, observations: other.slice().reverse() }, CAL);
  assert('reversing every input array changes nothing at all',
    JSON.stringify(forward) === JSON.stringify(reversed));
  /* The decisive control: put the PROVISIONAL row last in the array but keep it earlier by
     receipt. Anything falling back to position would now pick the wrong value. */
  var provisionalLast = [];
  DAYNUM.forEach(function (d, i) {
    var at = closeAtOf(d);
    provisionalLast.push(obs('av|' + dateOf(d), 700 + i, at, REC.revised));
    provisionalLast.push(obs('av|' + dateOf(d), 700 + i + 0.02, at, REC.first));
  });
  var v2 = CMP.evaluate({ spec: CLOSE_NH, observations: provisionalLast },
                        { spec: CLOSE_NH, observations: other }, CAL);
  assert('the last-in-array provisional value still loses to the earlier-received revision',
    v2.alignedSessions === 6 && v2.pairs.every(function (p) { return p.a.value === p.b.value; }),
    JSON.stringify(v2.pairs.map(function (p) { return p.a.value; })));

  console.log('T21c: EQUAL receipt with differing values is a contradiction, not a revision');
  var at0 = closeAtOf(4);
  var tie = [obs('x|1', 10, at0, 1786000000000), obs('x|2', 20, at0, 1786000000000)];
  var v3 = CMP.evaluate({ spec: CLOSE_NH, observations: tie },
                        { spec: CLOSE_NH, observations: [obs('y', 10, at0, 1786000000000)] }, CAL);
  assert('it abstains', v3.alignedSessions === 0);
  assert('under CONFLICTING, distinct from unorderable',
    v3.abstentions[CMP.ABSTAIN.CONFLICTING] === 1 &&
    v3.abstentions[CMP.ABSTAIN.UNORDERABLE] === undefined, JSON.stringify(v3.abstentions));

  console.log('T21d: a MISSING receipt on either side of a disagreement abstains');
  [[obs('x|1', 10, at0, 1786000000000), obs('x|2', 20, at0)],
   [obs('x|1', 10, at0), obs('x|2', 20, at0, 1786000000000)]].forEach(function (pair, i) {
    var vv = CMP.evaluate({ spec: CLOSE_NH, observations: pair },
                          { spec: CLOSE_NH, observations: [obs('y', 10, at0)] }, CAL);
    assert('case ' + (i + 1) + ': unorderable, never silently ordered',
      vv.alignedSessions === 0 && vv.abstentions[CMP.ABSTAIN.UNORDERABLE] === 1,
      JSON.stringify(vv.abstentions));
  });

  console.log('T21e: LEGACY rows, carrying no receipt time at all, are unaffected when they agree');
  var legacy = DAYNUM.map(function (d, i) { return obs('L|' + dateOf(d), 800 + i, closeAtOf(d)); });
  var v4 = CMP.evaluate({ spec: CLOSE_NH, observations: legacy },
                        { spec: CLOSE_NH, observations: legacy }, CAL);
  assert('six aligned sessions with no recordedAt anywhere', v4.alignedSessions === 6,
    JSON.stringify(v4.abstentions));
  assert('and no revision is claimed for them', v4.revisedSessions === 0, String(v4.revisedSessions));

  console.log('T21f: the verdict survives serialization with revisions intact');
  var round = JSON.parse(JSON.stringify(v));
  assert('byte-identical after a JSON round trip',
    JSON.stringify(CMP.evaluate(JSON.parse(JSON.stringify({ spec: CLOSE_NH, observations: rev(DAYNUM) })),
                                JSON.parse(JSON.stringify({ spec: CLOSE_NH, observations: other })),
                                JSON.parse(JSON.stringify(CAL)))) === JSON.stringify(v));
  assert('and the superseded record survives it',
    round.pairs[0].revisions.a[0].superseded[0].value === v.pairs[0].revisions.a[0].superseded[0].value);
})();

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
