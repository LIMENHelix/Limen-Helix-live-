/**
 * brain-v2/bind/calendars.js — DECLARED SESSION CALENDARS.
 *
 * `core/comparability.js` ships no calendar of its own and never will: it would have to
 * invent one, and an incomplete market calendar is worse than none because it silently admits
 * a session that never happened. Calendars are therefore declared data, and this is where the
 * declarations live so several channels can name one without each restating it.
 *
 * A calendar answers two questions and no others: where does a session's window sit, and
 * which days cannot be sessions. It grades nothing and activates nothing.
 */

'use strict';

var CALENDARS = {
  /**
   * US equities regular session, 09:30 to 16:00 America/New_York.
   *
   * The zone is named rather than offset, so DST is the runtime's problem and not a table
   * here that would be right for half the year.
   *
   * ── HOLIDAYS ARE EMPTY, AND THAT IS A STATED LIMIT, NOT AN OVERSIGHT ──────────────────
   *
   * A correct US market holiday list is real data this repository does not have, and writing
   * a remembered one would be fabricating it — the exact failure the gate's own comment
   * warns about. Empty means "holidays are not modelled".
   *
   * WHY THAT IS SAFE HERE, AND WHERE IT WOULD NOT BE. Sessions are derived from observations
   * that exist, never enumerated from the calendar. On a closed day the exchange publishes
   * nothing, so no observation carries that date and no session is created: the empty list
   * costs nothing for a source that only speaks on trading days. It WOULD matter for a source
   * that publishes a dated figure every weekday regardless of whether the market opened,
   * because a holiday reading would then be admitted as a session. No channel declared here
   * is of that kind, and one that is must supply a real holiday list before being declared.
   */
  usEquity: {
    timeZone: 'America/New_York',
    open: '09:30',
    close: '16:00',
    sessionDays: [1, 2, 3, 4, 5],
    holidays: []
  }
};

module.exports = { CALENDARS: CALENDARS };
