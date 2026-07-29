#!/usr/bin/env node
/**
 * scripts/test-auction-horizon.js — the auction-date horizon.
 *
 * THE BUG THIS PINS DOWN
 * The scraper read the CURRENT month's calendar only and kept the soonest N
 * dates. That makes the usable horizon collapse as the month runs out: scraped
 * on the 29th of a 31-day month, the only remaining days ARE the 29th, 30th and
 * 31st. Two days of lead time. On the 31st, none at all.
 *
 * A physical letter needs roughly eight days to arrive before the sale, so most
 * of the harvest was unmailable by construction — and worst exactly when the
 * operator would least expect it, at month end.
 *
 * Tested here is the PURE part: given a set of calendar days and a date, which
 * ones survive and in what order. The browser navigation that gathers the extra
 * months cannot be tested from here — the sites are WAF-protected and driven by
 * Puppeteer — and it is written to VERIFY that the calendar moved rather than
 * assume it, falling back to one month if it did not.
 *
 * RUN: node scripts/test-auction-horizon.js
 */

'use strict';

var path = require('path');
var S = require(path.join(__dirname, 'realauction-scrape.js'));

var fails = [], checks = 0;
function ok(c, m) { checks++; if (!c) fails.push(m); }

function mdy(d) {
  return String(d.getMonth() + 1).padStart(2, '0') + '/' +
         String(d.getDate()).padStart(2, '0') + '/' + d.getFullYear();
}
function plus(from, days) { return mdy(new Date(from.getFullYear(), from.getMonth(), from.getDate() + days)); }

// ── the exact scenario the operator hit: late July, one month of calendar ────
var JUL29 = new Date(2026, 6, 29);           // 2026-07-29, a 31-day month

var julyOnly = ['07/29/2026', '07/30/2026', '07/31/2026'];
var withAugust = julyOnly.concat(['08/05/2026', '08/12/2026', '08/19/2026', '08/26/2026']);

// 1. The old behaviour, reproduced: one month at month-end is 2 days of lead.
var oneMonth = S.pickDates(julyOnly, JUL29, 3);
ok(oneMonth.length === 3, 'expected the 3 remaining July dates, got ' + oneMonth.length);
ok(S.daysBetween(JUL29, oneMonth[oneMonth.length - 1]) === 2,
   'the furthest date in a month-end scrape should be 2 days out, got ' +
   S.daysBetween(JUL29, oneMonth[oneMonth.length - 1]));

// 2. Reading further out is what actually fixes it.
var wider = S.pickDates(withAugust, JUL29, 8);
ok(wider.length === 7, 'expected all 7 future dates, got ' + wider.length);
ok(S.daysBetween(JUL29, wider[wider.length - 1]) === 28,
   'with August in view the horizon should reach 28 days, got ' +
   S.daysBetween(JUL29, wider[wider.length - 1]));
// 08/05 is SEVEN days out, so it misses an 8-day floor by one. Worth pinning:
// "about a week" is not enough for first class, which is why the floor is 8.
var mailable = wider.filter(function (d) { return S.daysBetween(JUL29, d) >= 8; });
ok(mailable.length === 3,
   'expected 3 dates clearing an 8-day floor, got ' + mailable.length);
ok(S.daysBetween(JUL29, '08/05/2026') === 7,
   'the near-miss date should be exactly 7 days out');

// 3. A cap that is too small re-creates the bug even with more months read.
//    This is why RA_MAX_DATES had to rise alongside the month walk: 3 dates
//    from a wide window are still the three SOONEST, which are the unmailable ones.
var cappedLow = S.pickDates(withAugust, JUL29, 3);
ok(cappedLow.every(function (d) { return S.daysBetween(JUL29, d) < 8; }),
   'a cap of 3 should still yield only unmailable dates — that is the point of raising it');

// 4. Ordering, dedupe, and the past.
var messy = ['07/31/2026', '07/29/2026', '07/29/2026', '07/01/2026', 'not-a-date', '', '08/05/2026'];
var cleaned = S.pickDates(messy, JUL29, 10);
ok(cleaned.join(',') === '07/29/2026,07/31/2026,08/05/2026',
   'dedupe/past/sort wrong: ' + cleaned.join(','));
ok(cleaned.indexOf('07/01/2026') === -1, 'a past date survived');
ok(S.parseMDY('not-a-date') === null, 'a malformed date should not parse');

// 5. Today counts as future — same-day auctions are real, just not mailable.
ok(cleaned[0] === '07/29/2026', "today's auction should be kept, not dropped");

// 6. Year boundary: December must roll into January, not sort as smaller.
var DEC28 = new Date(2026, 11, 28);
var across = S.pickDates(['12/29/2026', '01/06/2027', '12/31/2026'], DEC28, 10);
ok(across.join(',') === '12/29/2026,12/31/2026,01/06/2027',
   'year boundary sorted wrong: ' + across.join(','));
ok(S.daysBetween(DEC28, '01/06/2027') === 9, 'cross-year day count wrong: ' +
   S.daysBetween(DEC28, '01/06/2027'));

console.log('[horizon] month-end with one month: ' +
  S.daysBetween(JUL29, oneMonth[oneMonth.length - 1]) + ' days of lead · ' +
  'with two months: ' + S.daysBetween(JUL29, wider[wider.length - 1]) + ' days, ' +
  mailable.length + ' of ' + wider.length + ' mailable at an 8-day floor');
console.log('[horizon] ' + (checks - fails.length) + '/' + checks + ' checks passed');
if (fails.length) { fails.forEach(function (f) { console.error('  FAIL  ' + f); }); process.exit(1); }
console.log('[horizon] the window no longer ends at a calendar boundary');
