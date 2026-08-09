/**
 * brain-v2/core/comparability.js — THE COMPARABILITY GATE.
 *
 * Two channels can carry plenty of distinct source identities and still be
 * incomparable. This module decides whether a declared pair's observations refer to the
 * SAME reference interval, and it produces the aligned subset that evidence must be
 * counted on. It activates nothing and grades nothing: `core/divergence.js` decides
 * whether an aligned pair AGREES. This decides whether the comparison is meaningful at
 * all, which is a question that has to be settled first.
 *
 * WHY THIS EXISTS, measured rather than supposed. On 2026-08-09 the strongest declared
 * pair in the system (finance, latent "SPY price level") carried 22 identities on one
 * side and 4 on the other. Of 110 rows where both sides carried an identity, 102 (93%)
 * compared an INTRADAY quote against the PREVIOUS DAY'S CLOSE. Mean absolute gap was
 * 0.445 on those and 0.120 when the two referred to the same session. Every large
 * apparent disagreement, up to 5.03 on a ~770 price, was staleness. Aligned properly the
 * two sources agree to within 0.04.
 *
 * A causal-hypothesis label was considered and rejected: naming a third cause still
 * performs the incomparable comparison and then explains it. **Align equivalent
 * reference intervals or abstain.** Abstention is a correct output here, not a failure.
 *
 * WHAT IT DOES NOT DO, deliberately:
 *   - it names no domain, channel, source, instrument, market or clock time. Every one
 *     of those arrives as declared data. `if (channel === 'finnhub')` is the failure mode
 *     this module exists to avoid, the same rule the shadow runtime already lives under.
 *   - it never infers cadence by parsing an identity string. An identity is opaque.
 *   - it never uses value similarity to decide comparability. Two sources agreeing is a
 *     RESULT; using agreement to decide whether they may be compared would assume the
 *     conclusion.
 *   - it does not lower, raise or reinterpret the evidence threshold. MIN_ALIGNED is
 *     imported from core/divergence.js rather than redefined, because a second copy of
 *     that number is a second thing to drift.
 */

'use strict';

var DIV = require('./divergence.js');

/**
 * THE THRESHOLD IS NOT REDEFINED HERE. Six aligned sessions, the same six that
 * divergence.js requires of distinct observations. What this module changes is WHAT gets
 * counted, never how many are needed.
 */
var MIN_ALIGNED = DIV.MIN_OBSERVATIONS;

/**
 * Declared reference-interval kinds. A channel says which one it publishes; nothing is
 * guessed from the data.
 *
 *   SESSION_CLOSE  the value is the settled figure FOR a session. One per session.
 *   POINT_IN_TIME  the value is an instantaneous reading AT an instant. Many per session,
 *                  which is why it must be reduced before it can meet a session close.
 */
var INTERVAL = {
  SESSION_CLOSE: 'session_close',
  POINT_IN_TIME: 'point_in_time'
};

/**
 * Every way this gate can decline, as named constants. A bare `false` sends the reader to
 * re-derive which half failed, which is the defect `divergence.blockedBy` already fixed
 * one level up.
 */
var ABSTAIN = {
  NO_INTERVAL:         'no_declared_reference_interval',
  UNKNOWN_INTERVAL:    'unknown_reference_interval_kind',
  NO_CALENDAR_DECLARED:'channel_declares_no_calendar',
  CALENDAR_MISMATCH:   'sides_declare_different_calendars',
  CALENDAR_MISSING:    'declared_calendar_was_not_supplied',
  CALENDAR_INCOMPLETE: 'calendar_missing_timezone_close_or_session_days',
  TIMEZONE_UNSUPPORTED:'runtime_cannot_resolve_calendar_timezone',
  NO_OBSERVED_AT:      'observation_carries_no_observedAt',
  NO_IDENTITY:         'observation_carries_no_identity',
  NO_VALUE:            'observation_carries_no_finite_value',
  NOT_A_SESSION_DAY:   'observation_falls_on_a_non_session_day',
  OUTSIDE_WINDOW:      'point_in_time_observation_outside_the_session_window',
  NO_SESSION_OVERLAP:  'no_session_is_covered_by_both_sides'
};

/* ── time, in the calendar's own zone ─────────────────────────────────────────────── */

/**
 * DST IS HANDLED BY ASKING THE RUNTIME, NOT BY A TABLE. A fixed UTC offset would be right
 * for half the year and silently wrong for the other half, and a session-close comparison
 * that is an hour out for six months is exactly the class of error this file exists to
 * stop. `Intl` already knows the rules; a hand-maintained offset table would not.
 */
function timeZoneUsable(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    /* A runtime built without full ICU accepts only UTC and throws on a named zone. That
       must fail the gate closed rather than silently fall back to UTC, which would look
       like a working comparison against the wrong instants. */
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(0);
    return true;
  } catch (e) { return false; }
}

function zonedParts(utcMs, tz) {
  var dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  var out = {};
  dtf.formatToParts(new Date(utcMs)).forEach(function (p) {
    if (p.type !== 'literal') out[p.type] = p.value;
  });
  /* Some implementations render midnight as hour 24 under hour12:false. */
  if (out.hour === '24') out.hour = '00';
  return out;
}

/** The calendar-local date of an instant, as YYYY-MM-DD. */
function localDateOf(utcMs, tz) {
  var p = zonedParts(utcMs, tz);
  return p.year + '-' + p.month + '-' + p.day;
}

function zoneOffsetMs(utcMs, tz) {
  var p = zonedParts(utcMs, tz);
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - utcMs;
}

/**
 * The UTC instant of a local wall-clock time on a local date. Two passes, because the
 * offset used to make the first guess may itself be the wrong side of a DST transition.
 */
function instantForLocal(dateStr, hhmm, tz) {
  var d = String(dateStr).split('-').map(Number);
  var t = String(hhmm).split(':').map(Number);
  var wall = Date.UTC(d[0], d[1] - 1, d[2], t[0], t[1], 0);
  var off = zoneOffsetMs(wall, tz);
  var inst = wall - off;
  var off2 = zoneOffsetMs(inst, tz);
  if (off2 !== off) inst = wall - off2;
  return inst;
}

/** Day of week of a local date string, 0=Sunday. Fixed by the date, independent of zone. */
function weekdayOf(dateStr) {
  var d = String(dateStr).split('-').map(Number);
  return new Date(Date.UTC(d[0], d[1] - 1, d[2])).getUTCDay();
}

/**
 * WEEKENDS AND HOLIDAYS ARE DECLARED, NOT ASSUMED, and this module ships no market
 * calendar of its own. Inventing a holiday list would be fabricating data, and an
 * incomplete one is worse than none: it would silently admit a session that never
 * happened. Sessions are derived from the observations that exist; the calendar's only
 * jobs are to place the session window and to REJECT a day that cannot be a session.
 */
function isSessionDay(dateStr, cal) {
  var dow = weekdayOf(dateStr);
  if (cal.sessionDays.indexOf(dow) < 0) return false;
  if (cal.holidays && cal.holidays.indexOf(dateStr) >= 0) return false;
  return true;
}

function calendarProblem(cal) {
  if (!cal) return ABSTAIN.CALENDAR_MISSING;
  if (typeof cal.timeZone !== 'string' || !cal.timeZone ||
      typeof cal.close !== 'string' || !/^\d{2}:\d{2}$/.test(cal.close) ||
      !Array.isArray(cal.sessionDays) || !cal.sessionDays.length) {
    return ABSTAIN.CALENDAR_INCOMPLETE;
  }
  if (!timeZoneUsable(cal.timeZone)) return ABSTAIN.TIMEZONE_UNSUPPORTED;
  return null;
}

function intervalProblem(spec) {
  if (!spec || !spec.referenceInterval) return ABSTAIN.NO_INTERVAL;
  var ri = spec.referenceInterval;
  if (ri.kind !== INTERVAL.SESSION_CLOSE && ri.kind !== INTERVAL.POINT_IN_TIME) {
    return ABSTAIN.UNKNOWN_INTERVAL;
  }
  if (typeof ri.calendar !== 'string' || !ri.calendar) return ABSTAIN.NO_CALENDAR_DECLARED;
  return null;
}

/* ── reducing one side to at most one observation per session ─────────────────────── */

/**
 * AT MOST ONE OBSERVATION PER SOURCE PER SESSION, chosen deterministically.
 *
 * This is what stops persistence from manufacturing evidence. The recorder re-records an
 * unchanged publisher reading on every poll; in the measured finance data single
 * identities carried 11, 16, 18 and 49 occurrences. Keying by SESSION and selecting one
 * makes those collapse to one, exactly as repeated polls of one identity already collapse
 * to one identity. Nothing about how long a value persists may raise its evidential
 * weight.
 *
 * Selection: the latest `observedAt` at or before the session close, ties broken by the
 * lexicographically greatest identity. The tie-break is not cosmetic. Two aliases of one
 * publication can share an instant, and picking by arrival order would make the result
 * depend on recording order, which would break replay and restoration determinism.
 */
function reduceToSessions(side, cal, notes) {
  var kind = side.spec.referenceInterval.kind;
  var bySession = Object.create(null);
  var dropped = Object.create(null);
  function drop(reason) { dropped[reason] = (dropped[reason] || 0) + 1; }

  (side.observations || []).forEach(function (o) {
    if (!o || o.identity === undefined || o.identity === null || o.identity === '') return drop(ABSTAIN.NO_IDENTITY);
    if (typeof o.observedAt !== 'number' || !isFinite(o.observedAt)) return drop(ABSTAIN.NO_OBSERVED_AT);
    if (typeof o.value !== 'number' || !isFinite(o.value)) return drop(ABSTAIN.NO_VALUE);

    var session = localDateOf(o.observedAt, cal.timeZone);
    if (!isSessionDay(session, cal)) return drop(ABSTAIN.NOT_A_SESSION_DAY);

    /* A point-in-time reading only speaks for the session it happened INSIDE. One taken
       after the close is the next session's business, or nobody's; admitting it would
       reintroduce exactly the stale-versus-live comparison this gate removes. A session
       close is the session's settled figure and is not subject to the window. */
    if (kind === INTERVAL.POINT_IN_TIME) {
      var closeAt = instantForLocal(session, cal.close, cal.timeZone);
      var openAt = cal.open ? instantForLocal(session, cal.open, cal.timeZone) : -Infinity;
      if (o.observedAt > closeAt || o.observedAt < openAt) return drop(ABSTAIN.OUTSIDE_WINDOW);
    }

    var held = bySession[session];
    if (!held) { bySession[session] = { session: session, chosen: o, considered: 1 }; return; }
    held.considered++;
    if (o.observedAt > held.chosen.observedAt ||
       (o.observedAt === held.chosen.observedAt && String(o.identity) > String(held.chosen.identity))) {
      held.chosen = o;
    }
  });

  Object.keys(dropped).forEach(function (r) { notes[r] = (notes[r] || 0) + dropped[r]; });
  return bySession;
}

/* ── the gate ─────────────────────────────────────────────────────────────────────── */

/**
 * Decide whether a declared pair is comparable, and on which sessions.
 *
 *   a, b       { spec, observations }
 *              spec.referenceInterval = { kind, calendar }
 *              observations = [{ identity, value, observedAt }]
 *   calendars  { <id>: { timeZone, close, sessionDays, open?, holidays? } }
 *
 * Returns a verdict that always states its own reason. `comparable:false` with a `why` is
 * a legitimate, expected outcome and is not an error.
 *
 * THE COUNTS ARE TAKEN ON THE ALIGNED SUBSET AND NOWHERE ELSE. Counting identities or
 * movement over the full channel measures the channel, not the comparison: in the
 * measured finance case one side carried 107 distinct values across the channel and 4
 * across the sessions it could actually be compared on. The larger number describes
 * activity the relationship never sees.
 */
function evaluate(a, b, calendars, opts) {
  opts = opts || {};
  var minAligned = (typeof opts.minAligned === 'number') ? opts.minAligned : MIN_ALIGNED;
  var notes = Object.create(null);

  var pa = intervalProblem(a && a.spec), pb = intervalProblem(b && b.spec);
  if (pa || pb) return verdict(false, pa || pb, { side: pa ? 'a' : 'b' });

  if (a.spec.referenceInterval.calendar !== b.spec.referenceInterval.calendar) {
    return verdict(false, ABSTAIN.CALENDAR_MISMATCH, {
      declared: [a.spec.referenceInterval.calendar, b.spec.referenceInterval.calendar]
    });
  }

  var calId = a.spec.referenceInterval.calendar;
  var cal = (calendars || {})[calId];
  var cp = calendarProblem(cal);
  if (cp) return verdict(false, cp, { calendar: calId });

  var sa = reduceToSessions(a, cal, notes);
  var sb = reduceToSessions(b, cal, notes);

  /* Sorted so the aligned set is byte-identical across runs, replays and restorations.
     Object key order is insertion order, which is arrival order, which is not stable. */
  var sessions = Object.keys(sa).filter(function (s) { return !!sb[s]; }).sort();

  var pairs = sessions.map(function (s) {
    return {
      session: s,
      a: { identity: sa[s].chosen.identity, value: sa[s].chosen.value, observedAt: sa[s].chosen.observedAt },
      b: { identity: sb[s].chosen.identity, value: sb[s].chosen.value, observedAt: sb[s].chosen.observedAt },
      /* How many observations were folded away on each side for this session. Evidence of
         collapse having happened, rather than an assurance that it did. */
      collapsed: { a: sa[s].considered - 1, b: sb[s].considered - 1 }
    };
  });

  /* MOVEMENT, ON THE ALIGNED SERIES. Same rule divergence uses, applied to the series
     actually being compared. Passing it is weak evidence and should not be read as a
     second hurdle cleared: any two distinct values satisfy it. */
  var va = {}, vb = {};
  pairs.forEach(function (p) { va[p.a.value] = 1; vb[p.b.value] = 1; });
  var movingA = Object.keys(va).length >= 2;
  var movingB = Object.keys(vb).length >= 2;

  if (!pairs.length) return verdict(false, ABSTAIN.NO_SESSION_OVERLAP, { pairs: pairs, notes: notes });

  var enough = pairs.length >= minAligned;
  return {
    comparable: true,
    eligible: enough && movingA && movingB,
    why: enough && movingA && movingB ? null
       : (!enough ? 'only ' + pairs.length + ' aligned session(s), ' + minAligned + ' required'
                  : 'aligned series does not move on side ' + (!movingA ? 'a' : 'b')),
    calendar: calId,
    minAligned: minAligned,
    alignedSessions: pairs.length,
    sessions: sessions,
    pairs: pairs,
    movement: { a: movingA, b: movingB },
    /* Collapse totals across every session, so "persistence did not inflate this" is a
       number a reader can check rather than a claim they have to take. */
    collapsed: pairs.reduce(function (n, p) { return n + p.collapsed.a + p.collapsed.b; }, 0),
    abstentions: notes
  };

  function verdict(comparable, why, extra) {
    var v = {
      comparable: comparable, eligible: false, why: why,
      calendar: calId || null, minAligned: minAligned,
      alignedSessions: (extra && extra.pairs) ? extra.pairs.length : 0,
      sessions: [], pairs: (extra && extra.pairs) || [],
      movement: { a: false, b: false }, collapsed: 0,
      abstentions: (extra && extra.notes) || notes
    };
    if (extra) Object.keys(extra).forEach(function (k) {
      if (k !== 'pairs' && k !== 'notes') v[k] = extra[k];
    });
    return v;
  }
}

module.exports = {
  INTERVAL: INTERVAL,
  ABSTAIN: ABSTAIN,
  MIN_ALIGNED: MIN_ALIGNED,
  evaluate: evaluate,
  /* Exported for testing the time handling directly. Pure, no clock read. */
  localDateOf: localDateOf,
  instantForLocal: instantForLocal,
  isSessionDay: isSessionDay,
  timeZoneUsable: timeZoneUsable
};
