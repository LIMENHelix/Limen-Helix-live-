/**
 * brain-v2/core/reference-time.js — WHAT INTERVAL AN OBSERVATION REFERS TO.
 *
 * `core/comparability.js` needs each observation's reference time and refuses to parse an
 * identity string to get one, deliberately: an identity is the source's own opaque token and
 * a gate that guessed at its format would be inventing provenance. But somebody has to know
 * the format, and that somebody is the channel, which is the only place the source is known.
 *
 * So the extraction rule is DECLARED per channel and applied here. This module knows nothing
 * about any particular source either; it applies whatever rule it is handed and abstains,
 * by name, when the rule does not fit the token it was given.
 *
 * DECLARATIVE, NOT A FUNCTION. Rules are plain data so they survive JSON, serialization and
 * replay, and so a reader can see what a channel claims about its own identity format
 * without executing anything. `brain-v2/test/domains.js` already records what happens when
 * behaviour hides inside a spec that a hash cannot see.
 *
 * NOTHING HERE INVENTS A TIME. Every rule reads a value the SOURCE put in its own identity.
 * A token that does not carry one yields null with a reason, never a fallback, never a clock
 * read, and never the recorder's receipt time — which answers a different question entirely
 * (see `recordedAt` in bind/factory.js).
 */

'use strict';

/**
 * The declared extraction kinds. Both take a marker, because these identities are composed
 * key/value strings (`vendor:thing|symbol:SPY|quote-t:1786000000`) and the marker names which
 * field carries the reference time. Reading a bare number out of an identity by position
 * would break the first time a publisher added a field.
 */
var EXTRACT = {
  /* Seconds since epoch, as an instant. The observation refers to that moment. */
  EPOCH_SECONDS: 'epoch_seconds',
  /* Milliseconds since epoch, as an instant. */
  EPOCH_MILLIS: 'epoch_millis',
  /* A calendar date naming a SESSION. The observation refers to that session's close, which
     is why resolving it needs the calendar rather than arithmetic. */
  SESSION_DATE: 'session_date'
};

var REASON = {
  /* DISTINCT FROM A MARKER MISS, and the difference is the whole point of counting these. A
     reading with no identity predates the recorder keeping `su` (or the source never supplied
     one); a reading whose identity lacks the marker means the DECLARED RULE does not fit a
     token the source did supply. The first is history, the second is a declaration bug, and
     reporting both as "marker absent" would hide the bug inside the history. */
  NO_IDENTITY:    'reading_carries_no_source_identity',
  NO_RULE:        'channel_declares_no_observedAt_rule',
  UNKNOWN_KIND:   'unknown_observedAt_extraction_kind',
  NO_MARKER:      'observedAt_rule_declares_no_after_marker',
  MARKER_ABSENT:  'identity_does_not_contain_the_declared_marker',
  UNPARSEABLE:    'the_text_after_the_marker_is_not_the_declared_shape',
  OUT_OF_RANGE:   'the_extracted_value_is_not_a_usable_instant',
  NEEDS_CALENDAR: 'session_date_extraction_needs_a_calendar_with_a_close_time'
};

/* Bounds a plausible instant. Not a business rule: it exists so a token like `quote-t:0` or a
   seconds value mistakenly read as milliseconds is refused rather than silently placing an
   observation in 1970 or the year 55000, either of which would land in no session at all and
   be reported as a calendar problem instead of a parsing one. */
var MIN_MS = Date.UTC(2000, 0, 1);
var MAX_MS = Date.UTC(2100, 0, 1);

function fail(why, detail) { return { ok: false, observedAt: null, why: why, detail: detail || null }; }

/** The text following the declared marker, up to the next field separator. */
function segmentAfter(identity, marker) {
  var s = String(identity);
  var i = s.indexOf(marker);
  if (i < 0) return null;
  var rest = s.slice(i + marker.length);
  var cut = rest.indexOf('|');
  return cut >= 0 ? rest.slice(0, cut) : rest;
}

/**
 * Derive one observation's reference time.
 *
 *   identity   the source's own token, exactly as recorded (`su`)
 *   rule       { kind, after }            declared on the channel
 *   calendar   required for SESSION_DATE  { timeZone, close, ... }
 *   resolve    instantForLocal(dateStr, hhmm, tz), injected so this module does no
 *              timezone work of its own and cannot drift from the gate's clock handling
 *
 * Returns { ok, observedAt, why }. `ok:false` is an expected outcome and is never an error.
 */
function observedAtFor(identity, rule, calendar, resolve) {
  if (identity === undefined || identity === null || identity === '') return fail(REASON.NO_IDENTITY);
  if (!rule || !rule.kind) return fail(REASON.NO_RULE);
  if (rule.kind !== EXTRACT.EPOCH_SECONDS && rule.kind !== EXTRACT.EPOCH_MILLIS &&
      rule.kind !== EXTRACT.SESSION_DATE) {
    return fail(REASON.UNKNOWN_KIND, rule.kind);
  }
  if (typeof rule.after !== 'string' || !rule.after) return fail(REASON.NO_MARKER);

  var seg = segmentAfter(identity, rule.after);
  if (seg === null) return fail(REASON.MARKER_ABSENT, rule.after);

  if (rule.kind === EXTRACT.SESSION_DATE) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(seg)) return fail(REASON.UNPARSEABLE, seg);
    if (!calendar || typeof calendar.timeZone !== 'string' || typeof calendar.close !== 'string') {
      return fail(REASON.NEEDS_CALENDAR);
    }
    if (typeof resolve !== 'function') return fail(REASON.NEEDS_CALENDAR);
    var at = resolve(seg, calendar.close, calendar.timeZone);
    if (typeof at !== 'number' || !isFinite(at) || at < MIN_MS || at > MAX_MS) {
      return fail(REASON.OUT_OF_RANGE, seg);
    }
    return { ok: true, observedAt: at, why: null, detail: null };
  }

  /* Digits only. `parseInt` would accept "1786000000abc" and quietly discard the tail, which
     is how a malformed token becomes a confident-looking timestamp. */
  if (!/^\d+$/.test(seg)) return fail(REASON.UNPARSEABLE, seg);
  var n = Number(seg);
  var ms = rule.kind === EXTRACT.EPOCH_SECONDS ? n * 1000 : n;
  if (!isFinite(ms) || ms < MIN_MS || ms > MAX_MS) return fail(REASON.OUT_OF_RANGE, seg);
  return { ok: true, observedAt: ms, why: null, detail: null };
}

/**
 * Turn a channel's recorded readings into gate observations, dropping any the rule cannot
 * place and counting why. The counts are the point: a channel silently contributing nothing
 * looks identical to a channel with no data until somebody asks.
 *
 * `readings` is [{ identity, value, recordedAt }] as bind/factory.js produces them.
 */
function observationsFor(readings, rule, calendar, resolve) {
  var out = [], dropped = Object.create(null);
  (readings || []).forEach(function (r) {
    if (!r || typeof r.value !== 'number' || !isFinite(r.value)) {
      dropped.no_finite_value = (dropped.no_finite_value || 0) + 1;
      return;
    }
    var d = observedAtFor(r.identity, rule, calendar, resolve);
    if (!d.ok) { dropped[d.why] = (dropped[d.why] || 0) + 1; return; }
    var o = { identity: r.identity, value: r.value, observedAt: d.observedAt };
    /* Carried through untouched when present and OMITTED when not, so the gate sees the same
       "cannot order" shape the binder produced rather than a fabricated zero. */
    if (typeof r.recordedAt === 'number' && isFinite(r.recordedAt)) o.recordedAt = r.recordedAt;
    out.push(o);
  });
  return { observations: out, dropped: dropped };
}

module.exports = {
  EXTRACT: EXTRACT,
  REASON: REASON,
  observedAtFor: observedAtFor,
  observationsFor: observationsFor
};
