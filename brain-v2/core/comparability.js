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
 * WHAT BUILDING THIS THEN FOUND, which is larger than the pair it was built for. Running
 * the finished gate over the same rows dropped the candidate from four aligned sessions to
 * ONE, because Alpha Vantage RESTATES its session close under an unchanged identity about
 * two hours after first publishing it (769.77 -> 769.79, 768.60 -> 768.56,
 * 773.22 -> 773.26). Two consequences, both corrections to earlier claims:
 *
 *   1. **A source identity does not determine a value.** Counting distinct identities as a
 *      proxy for distinct observations quietly assumed it did.
 *   2. The "agreement to within 0.04" previously reported was measured on the PROVISIONAL
 *      figures, because that analysis kept the first occurrence under each identity. After
 *      settlement the two sources agree EXACTLY, 0.00, on every session.
 *
 * This module abstains on such a session, which is right as a fail-closed default and is
 * NOT the right final answer: a revision is not a contradiction. Separating them needs a
 * RECORDING time alongside `observedAt`, which observations do not currently carry. That
 * is a declaration change, deliberately not invented here.
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
 *     imported from core/divergence.js rather than redefined, and a caller cannot
 *     override it downward.
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
 *                  which is why it must be reduced before it can meet a session close,
 *                  and why it must additionally declare how close to the close its
 *                  reading has to be.
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
  NO_INTERVAL:          'no_declared_reference_interval',
  UNKNOWN_INTERVAL:     'unknown_reference_interval_kind',
  NO_CALENDAR_DECLARED: 'channel_declares_no_calendar',
  CALENDAR_MISMATCH:    'sides_declare_different_calendars',
  CALENDAR_MISSING:     'declared_calendar_was_not_supplied',
  CALENDAR_INCOMPLETE:  'calendar_missing_timezone_close_or_session_days',
  CALENDAR_BAD_TIME:    'calendar_open_or_close_is_not_a_valid_time_of_day',
  CALENDAR_WINDOW_INVERTED: 'calendar_open_is_not_before_close',
  CALENDAR_BAD_SESSION_DAYS: 'calendar_sessionDays_are_not_distinct_integers_0_to_6',
  CALENDAR_BAD_HOLIDAYS: 'calendar_holidays_are_not_well_formed_calendar_dates',
  TIMEZONE_UNSUPPORTED: 'runtime_cannot_resolve_calendar_timezone',
  NO_MAX_LAG:           'point_in_time_channel_declares_no_maxLagFromCloseMs',
  BAD_MAX_LAG:          'maxLagFromCloseMs_is_not_a_positive_finite_number',
  MIN_ALIGNED_TOO_LOW:  'minAligned_override_below_the_evidence_floor',
  NO_OBSERVED_AT:       'observation_carries_no_observedAt',
  NO_IDENTITY:          'observation_carries_no_identity',
  NO_VALUE:             'observation_carries_no_finite_value',
  NOT_A_SESSION_DAY:    'observation_falls_on_a_non_session_day',
  OUTSIDE_WINDOW:       'point_in_time_observation_outside_the_session_window',
  TOO_FAR_FROM_CLOSE:   'freshest_point_in_time_reading_is_older_than_the_declared_max_lag',
  CONFLICTING:          'one_identity_reported_two_values_at_a_single_receipt_time',
  CROSS_IDENTITY:       'two_identities_disagree_at_one_instant_and_no_receipt_can_choose_between_them',
  UNORDERABLE:          'one_identity_reported_differing_values_that_cannot_be_ordered_without_a_recordedAt',
  NO_SESSION_OVERLAP:   'no_session_is_covered_by_both_sides'
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

/* ── declaration validation, all of it fail-closed and named ──────────────────────── */

function validTimeOfDay(s) {
  if (typeof s !== 'string' || !/^\d{2}:\d{2}$/.test(s)) return false;
  var h = +s.slice(0, 2), m = +s.slice(3, 5);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}
function minutesOfDay(s) { return (+s.slice(0, 2)) * 60 + (+s.slice(3, 5)); }

/**
 * A DATE THAT DOES NOT EXIST MUST BE REJECTED, NOT ROLLED FORWARD. `Date.UTC(2026, 1, 30)`
 * happily yields 2 March, so a holiday declared as "2026-02-30" would silently suppress a
 * different day than the one written down. Round-tripping the components catches it.
 */
function validCalendarDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  var y = +s.slice(0, 4), mo = +s.slice(5, 7), d = +s.slice(8, 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  var dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/**
 * WEEKENDS AND HOLIDAYS ARE DECLARED, NOT ASSUMED, and this module ships no market
 * calendar of its own. Inventing a holiday list would be fabricating data, and an
 * incomplete one is worse than none: it would silently admit a session that never
 * happened. Sessions are derived from the observations that exist; the calendar's only
 * jobs are to place the session window and to REJECT a day that cannot be a session.
 */
function isSessionDay(dateStr, cal) {
  if (cal.sessionDays.indexOf(weekdayOf(dateStr)) < 0) return false;
  if (cal.holidays && cal.holidays.indexOf(dateStr) >= 0) return false;
  return true;
}

function calendarProblem(cal) {
  if (!cal) return ABSTAIN.CALENDAR_MISSING;
  if (typeof cal.timeZone !== 'string' || !cal.timeZone ||
      cal.close === undefined || cal.close === null ||
      !Array.isArray(cal.sessionDays) || !cal.sessionDays.length) {
    return ABSTAIN.CALENDAR_INCOMPLETE;
  }
  /* Structure before zone lookup, so a malformed calendar reports the specific fault
     rather than whichever check happens to run first. */
  if (!validTimeOfDay(cal.close)) return ABSTAIN.CALENDAR_BAD_TIME;
  if (cal.open !== undefined && cal.open !== null) {
    if (!validTimeOfDay(cal.open)) return ABSTAIN.CALENDAR_BAD_TIME;
    /* An open at or after the close is either a typo or an overnight session. This module
       does not model overnight sessions, and guessing which was meant would place every
       window wrongly, so it declines instead. */
    if (minutesOfDay(cal.open) >= minutesOfDay(cal.close)) return ABSTAIN.CALENDAR_WINDOW_INVERTED;
  }
  var seenDay = Object.create(null);
  for (var i = 0; i < cal.sessionDays.length; i++) {
    var d = cal.sessionDays[i];
    if (typeof d !== 'number' || !isFinite(d) || d % 1 !== 0 || d < 0 || d > 6 || seenDay[d]) {
      return ABSTAIN.CALENDAR_BAD_SESSION_DAYS;
    }
    seenDay[d] = true;
  }
  if (cal.holidays !== undefined && cal.holidays !== null) {
    if (!Array.isArray(cal.holidays)) return ABSTAIN.CALENDAR_BAD_HOLIDAYS;
    for (var h = 0; h < cal.holidays.length; h++) {
      if (!validCalendarDate(cal.holidays[h])) return ABSTAIN.CALENDAR_BAD_HOLIDAYS;
    }
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
  /**
   * A POINT-IN-TIME CHANNEL MUST DECLARE HOW STALE ITS READING MAY BE.
   *
   * Being inside the session window is not enough. A feed that dies at lunchtime still has
   * a "latest reading in the window", and comparing that against a settled close is the
   * same intraday-versus-close error this module exists to refuse, only harder to see
   * because both observations now carry the same session. The tolerance is a property of
   * the channel, so the channel declares it; an undeclared one abstains rather than
   * inheriting a default that would be wrong for some publisher.
   */
  if (ri.kind === INTERVAL.POINT_IN_TIME) {
    if (ri.maxLagFromCloseMs === undefined || ri.maxLagFromCloseMs === null) return ABSTAIN.NO_MAX_LAG;
    if (typeof ri.maxLagFromCloseMs !== 'number' || !isFinite(ri.maxLagFromCloseMs) ||
        ri.maxLagFromCloseMs <= 0) return ABSTAIN.BAD_MAX_LAG;
  }
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
 * Grouping happens first and selection second, so nothing about the result depends on
 * arrival order. An earlier draft folded selection into the scan, which made conflict
 * detection order-dependent: a contradictory pair that had already been superseded by a
 * later reading was never compared against anything and went unnoticed.
 *
 * Selection: the latest `observedAt`, ties broken by the lexicographically greatest
 * identity. The tie-break is not cosmetic — two aliases of one publication can share an
 * instant, and picking by arrival order would make replay and restoration non-deterministic.
 */
/**
 * One representative from a set of observations that already AGREE on value, or that have
 * already been narrowed to the winning value. Latest receipt first, then the
 * lexicographically greatest identity.
 *
 * The tie-break is not cosmetic and is not a way of settling disagreement: by the time this
 * runs, every candidate carries the same value, so which one is returned changes only the
 * identity reported, never the number. Picking by arrival order instead would make replay
 * and restoration non-deterministic for no gain.
 */
function pickOne(group) {
  var best = group[0];
  for (var i = 1; i < group.length; i++) {
    var o = group[i];
    var oRec = typeof o.recordedAt === 'number' && isFinite(o.recordedAt) ? o.recordedAt : -Infinity;
    var bRec = typeof best.recordedAt === 'number' && isFinite(best.recordedAt) ? best.recordedAt : -Infinity;
    if (oRec > bRec || (oRec === bRec && String(o.identity) > String(best.identity))) best = o;
  }
  return best;
}

function reduceToSessions(side, cal, notes) {
  var ri = side.spec.referenceInterval;
  var kind = ri.kind;
  var groups = Object.create(null);
  function drop(reason) { notes[reason] = (notes[reason] || 0) + 1; }

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

    (groups[session] || (groups[session] = [])).push(o);
  });

  var bySession = Object.create(null);
  var folded = 0;
  Object.keys(groups).forEach(function (session) {
    var arr = groups[session];

    /**
     * ONE IDENTITY CAN CARRY TWO VALUES, and separating a REVISION from a CONTRADICTION is
     * the whole job here.
     *
     * Measured 2026-08-09: Alpha Vantage restates its session close under an unchanged
     * identity about two hours after first publishing it (769.77 -> 769.79, 768.60 ->
     * 768.56, 773.22 -> 773.26), and the later figure is the settled one. An earlier
     * version of this module could not tell that from two simultaneous disagreeing claims,
     * so it abstained on both, which cost three of the candidate's four aligned sessions.
     *
     * `recordedAt` is what separates them, and ONLY receipt order may do so:
     *   later receipt, differing value  -> a revision; the later value wins
     *   equal receipt, differing values -> simultaneous contradiction; abstain
     *   any receipt missing             -> unorderable; abstain
     *
     * ONLY A SOURCE MAY REVISE ITSELF, which is the boundary the first draft did not draw.
     * Receipt order was applied across the whole instant, so a LATER-RECEIVED value from a
     * DIFFERENT identity silently overwrote an earlier one and the pair was recorded as a
     * revision. Two identities are two claims; one arriving later does not settle the
     * other, and calling that a restatement would let receipt order manufacture agreement
     * out of a genuine disagreement between sources. So resolution runs per identity, and
     * identities that still disagree afterwards are CONFLICTING whatever their receipts say.
     *
     * EVERY RECEIPT BUCKET IS CHECKED, not only the newest. Two rows sharing one receipt and
     * disagreeing are a contradiction at that moment, and a later revision does not make it
     * not have happened. Testing only the top bucket let any subsequent value erase it.
     *
     * ARRAY ORDER IS NEVER CONSULTED. Every decision below is a max over a group or a scan
     * of sorted keys, so a replay re-reading the same rows in another order produces the
     * same winner and the same superseded record. Falling back to position would order
     * observations by when they were REPLAYED, which is the defect this module was built to
     * refuse in a different costume.
     *
     * Abstention is still per SESSION, not per pair: one bad session must not discard five
     * sound ones.
     */
    var byInstant = Object.create(null);
    for (var i = 0; i < arr.length; i++) {
      var at = arr[i].observedAt;
      (byInstant[at] || (byInstant[at] = [])).push(arr[i]);
    }

    var resolved = [], revisionAt = Object.create(null), conflict = null;
    Object.keys(byInstant).forEach(function (at) {
      if (conflict) return;
      var group = byInstant[at];

      /* One bucket per source identity. A revision is a source restating itself, so this is
         the only scope in which receipt order is allowed to decide anything. */
      var byIdentity = Object.create(null);
      group.forEach(function (o) {
        var k = String(o.identity);
        (byIdentity[k] || (byIdentity[k] = [])).push(o);
      });

      /* Sorted, so the order identities are resolved in is fixed by their names rather than
         by arrival. Nothing below depends on it today; leaving it to insertion order would
         be a latent way for input order to re-enter. */
      var ids = Object.keys(byIdentity).sort();
      var settled = [];
      var superseded = Object.create(null);          // value -> latest receipt of that value

      for (var k = 0; k < ids.length; k++) {
        var mine = byIdentity[ids[k]];
        var distinct = Object.create(null);
        for (var d = 0; d < mine.length; d++) distinct[mine[d].value] = true;

        /* One identity, one value: nothing to order, and no receipt time is required. This
           is what keeps legacy rows that merely repeat themselves working untouched. */
        if (Object.keys(distinct).length === 1) { settled.push(pickOne(mine)); continue; }

        /* Unorderable is reported apart from contradictory, because without a receipt time we
           cannot even ask which came later. Calling that a contradiction would overstate what
           is known. */
        for (var g = 0; g < mine.length; g++) {
          if (typeof mine[g].recordedAt !== 'number' || !isFinite(mine[g].recordedAt)) {
            conflict = ABSTAIN.UNORDERABLE; return;
          }
        }

        /* A contradiction inside ANY receipt bucket, checked before a winner is picked. The
           source said two things at one moment; that it later said a third does not resolve
           which of the two it meant. */
        var buckets = Object.create(null);
        for (var m = 0; m < mine.length; m++) {
          var b = buckets[mine[m].recordedAt] || (buckets[mine[m].recordedAt] = Object.create(null));
          b[mine[m].value] = true;
        }
        var bks = Object.keys(buckets);
        for (var bi = 0; bi < bks.length; bi++) {
          if (Object.keys(buckets[bks[bi]]).length > 1) { conflict = ABSTAIN.CONFLICTING; return; }
        }

        var maxRec = -Infinity;
        for (var n = 0; n < mine.length; n++) if (mine[n].recordedAt > maxRec) maxRec = mine[n].recordedAt;
        var top = mine.filter(function (o) { return o.recordedAt === maxRec; });
        var winner = pickOne(top);

        /* SUPERSEDED VALUES STAY AUDITABLE. A revision that silently replaced a figure would
           leave the record unable to show that the number ever moved, which is the same
           complaint this file makes about repeated polls: the discard has to be visible.
           A provisional figure repeated across several polls carries several receipts, so
           the one recorded is the MAXIMUM: the last moment the source still stood by the
           value it went on to replace. Taking whichever happened to be scanned last made the
           record depend on arrival order for a fact that has nothing to do with it. */
        for (var s = 0; s < mine.length; s++) {
          if (mine[s].value === winner.value) continue;
          var prev = superseded[mine[s].value];
          if (prev === undefined || mine[s].recordedAt > prev) superseded[mine[s].value] = mine[s].recordedAt;
        }
        settled.push(winner);
      }
      if (conflict) return;

      /* Identities have each spoken once now. If they do not agree, this instant carries two
         claims and no receipt may choose between them. */
      var finalValues = Object.create(null);
      for (var f = 0; f < settled.length; f++) finalValues[settled[f].value] = true;
      /* REPORTED APART FROM A SINGLE-IDENTITY CONTRADICTION, because they are different
         faults with different remedies. One identity saying two things at one receipt is a
         publisher problem. Two identities disagreeing is the sources disagreeing, which is
         the very thing divergence exists to grade — but it cannot be graded from an instant
         that was never comparable, and no receipt time can choose between them, so it
         abstains here rather than being passed off as a revision. */
      if (Object.keys(finalValues).length > 1) { conflict = ABSTAIN.CROSS_IDENTITY; return; }

      /* Every survivor now carries the same value, so this decides only which identity and
         receipt are reported. Its receipt is the latest at which the settled value was
         asserted, which is what "the receipt that settled it" means. */
      var chosenHere = pickOne(settled);
      var supersededValues = Object.keys(superseded);
      if (supersededValues.length) {
        revisionAt[at] = {
          observedAt: Number(at), value: chosenHere.value, recordedAt: chosenHere.recordedAt,
          superseded: supersededValues.map(function (v) {
            return { value: Number(v), recordedAt: superseded[v] };
          }).sort(function (x, y) { return x.recordedAt - y.recordedAt || x.value - y.value; })
        };
      }
      resolved.push(chosenHere);
    });
    if (conflict) { notes[conflict] = (notes[conflict] || 0) + 1; return; }

    /* Across instants: the latest reference time. Instants are distinct keys by
       construction, so no tie-break on observedAt is reachable here. */
    var chosen = resolved[0];
    for (var j = 1; j < resolved.length; j++) {
      if (resolved[j].observedAt > chosen.observedAt) chosen = resolved[j];
    }

    /* Freshness is checked on the CHOSEN reading, not on every candidate: routine
       intraday readings are supposed to be far from the close, and counting each of them
       as a staleness event would bury the one fact this counter exists to surface, which
       is that a session's FRESHEST reading was too old to stand against a close. */
    if (kind === INTERVAL.POINT_IN_TIME) {
      var close2 = instantForLocal(session, cal.close, cal.timeZone);
      if (close2 - chosen.observedAt > ri.maxLagFromCloseMs) {
        notes[ABSTAIN.TOO_FAR_FROM_CLOSE] = (notes[ABSTAIN.TOO_FAR_FROM_CLOSE] || 0) + 1;
        return;
      }
    }

    /* Counted for EVERY surviving session, matched or not. An earlier version summed this
       over aligned pairs only, so persistence folded away on a session the other side
       never covered was invisible, and the reported figure understated how much repetition
       the gate had actually discarded. */
    folded += arr.length - 1;
    /* THE REVISION RECORD DESCRIBES THE READING THAT WAS ACTUALLY COMPARED, and nothing
       else. Earlier instants in the same session were never selected, so their restatements
       say nothing about the evidence this session contributes; reporting them made a pair
       look as though the figure it rests on had moved when it had not. `revisedSessions`
       counts off this, so the overstatement reached the verdict, not just the detail. */
    var revHere = revisionAt[chosen.observedAt];
    bySession[session] = {
      session: session, chosen: chosen, considered: arr.length,
      revisions: revHere ? [revHere] : []
    };
  });

  return { bySession: bySession, folded: folded };
}

/* ── the gate ─────────────────────────────────────────────────────────────────────── */

/**
 * Decide whether a declared pair is comparable, and on which sessions.
 *
 *   a, b       { spec, observations }
 *              spec.referenceInterval = { kind, calendar, maxLagFromCloseMs? }
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
  var notes = Object.create(null);
  var calId = null;

  /**
   * THE FLOOR CANNOT BE LOWERED BY A CALLER. `opts.minAligned` exists so a study can
   * demand MORE evidence, never less. An override below the floor is a programming error
   * and is refused by name rather than silently clamped, because a clamp would let a
   * caller believe it ran a relaxed gate and got a pass.
   */
  var minAligned = MIN_ALIGNED;
  if (opts.minAligned !== undefined && opts.minAligned !== null) {
    if (typeof opts.minAligned !== 'number' || !isFinite(opts.minAligned) ||
        opts.minAligned % 1 !== 0 || opts.minAligned < MIN_ALIGNED) {
      return verdict(false, ABSTAIN.MIN_ALIGNED_TOO_LOW, { requested: opts.minAligned, floor: MIN_ALIGNED });
    }
    minAligned = opts.minAligned;
  }

  var pa = intervalProblem(a && a.spec), pb = intervalProblem(b && b.spec);
  if (pa || pb) return verdict(false, pa || pb, { side: pa ? 'a' : 'b' });

  if (a.spec.referenceInterval.calendar !== b.spec.referenceInterval.calendar) {
    return verdict(false, ABSTAIN.CALENDAR_MISMATCH, {
      declared: [a.spec.referenceInterval.calendar, b.spec.referenceInterval.calendar]
    });
  }

  calId = a.spec.referenceInterval.calendar;
  var cal = (calendars || {})[calId];
  var cp = calendarProblem(cal);
  if (cp) return verdict(false, cp, { calendar: calId });

  var ra = reduceToSessions(a, cal, notes);
  var rb = reduceToSessions(b, cal, notes);
  var sa = ra.bySession, sb = rb.bySession;
  var collapsedAll = ra.folded + rb.folded;

  /* Sorted so the aligned set is byte-identical across runs, replays and restorations.
     Object key order is insertion order, which is arrival order, which is not stable. */
  var sessions = Object.keys(sa).filter(function (s) { return !!sb[s]; }).sort();

  var pairs = sessions.map(function (s) {
    return {
      session: s,
      a: { identity: sa[s].chosen.identity, value: sa[s].chosen.value, observedAt: sa[s].chosen.observedAt },
      b: { identity: sb[s].chosen.identity, value: sb[s].chosen.value, observedAt: sb[s].chosen.observedAt },
      collapsed: { a: sa[s].considered - 1, b: sb[s].considered - 1 },
      /* Every value this session's winner replaced, with the receipt time that settled it.
         Empty on a session nothing revised, so "no revision" and "revision not tracked" are
         not the same shape. */
      revisions: { a: sa[s].revisions, b: sb[s].revisions }
    };
  });

  /* MOVEMENT, ON THE ALIGNED SERIES. Same rule divergence uses, applied to the series
     actually being compared. Passing it is weak evidence and should not be read as a
     second hurdle cleared: any two distinct values satisfy it. */
  var va = {}, vb = {};
  pairs.forEach(function (p) { va[p.a.value] = 1; vb[p.b.value] = 1; });
  var movingA = Object.keys(va).length >= 2;
  var movingB = Object.keys(vb).length >= 2;

  if (!pairs.length) {
    return verdict(false, ABSTAIN.NO_SESSION_OVERLAP, { collapsed: collapsedAll });
  }

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
    /* EVERY observation folded away by session selection, across every surviving session
       on both sides, not only the aligned ones. `collapsedAligned` is the subset that sits
       under the pairs above; reporting only that one understated the discard. */
    collapsed: collapsedAll,
    collapsedAligned: pairs.reduce(function (n, p) { return n + p.collapsed.a + p.collapsed.b; }, 0),
    /* HOW MANY OF THE ALIGNED SESSIONS RESTED ON A REVISED FIGURE. Surfaced as a total
       because a pair whose evidence is mostly restatements is a different thing from one
       whose sources published once and stood by it, and the verdict should not have to be
       re-derived to see which it is. */
    revisedSessions: pairs.filter(function (p) {
      return p.revisions.a.length > 0 || p.revisions.b.length > 0;
    }).length,
    abstentions: notes
  };

  function verdict(comparable, why, extra) {
    var v = {
      comparable: comparable, eligible: false, why: why,
      calendar: calId, minAligned: minAligned,
      alignedSessions: 0, sessions: [], pairs: [],
      movement: { a: false, b: false },
      collapsed: (extra && typeof extra.collapsed === 'number') ? extra.collapsed : 0,
      collapsedAligned: 0,
      abstentions: notes
    };
    if (extra) Object.keys(extra).forEach(function (k) { if (k !== 'collapsed') v[k] = extra[k]; });
    return v;
  }
}

module.exports = {
  INTERVAL: INTERVAL,
  ABSTAIN: ABSTAIN,
  MIN_ALIGNED: MIN_ALIGNED,
  evaluate: evaluate,
  /* Exported for testing the time and declaration handling directly. All pure, no clock. */
  localDateOf: localDateOf,
  instantForLocal: instantForLocal,
  isSessionDay: isSessionDay,
  timeZoneUsable: timeZoneUsable,
  validCalendarDate: validCalendarDate,
  validTimeOfDay: validTimeOfDay
};
