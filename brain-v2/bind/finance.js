/**
 * brain-v2/bind/finance.js — the second bound domain.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * THIS IS A DECLARATION, NOT EVIDENCE. NO FIXTURE EXISTS FOR IT YET.
 *
 * Binding a domain and having data about it are different things, and only the first is
 * done here. `handlers/feed-record.js` has been recording finance into `feedhist:finance`
 * all along — the same loop that records every domain — but no fixture has been pulled
 * from it, so nothing below has been exercised against a single real observation.
 *
 * SPEC row 24 therefore does NOT move, and a finance fixture alone will not move it
 * either. That is worth stating plainly, because "get the fixture and row 24 completes"
 * is the obvious reading and it is wrong. A fixture is NECESSARY AND NOT SUFFICIENT.
 *
 * Row 24 asks whether peer domains inform each other usefully. Three things are missing,
 * and the fixture is only the first:
 *
 *   1. OBSERVATIONS      a finance fixture whose evidence check passes, so finance has
 *                        something of its own to say.
 *   2. A DECLARED LATENT shared by energy and finance. None exists. Nothing in either
 *                        binder establishes a common observable, and an oil price and an
 *                        equity price being "plausibly related" is exactly the standard
 *                        this project refuses — a wrong declaration is worse than a
 *                        missing one, because divergence would then grade a real
 *                        relationship against a latent nobody can defend.
 *   3. MEASURED TRANSFER evidence that routing across that link IMPROVES something —
 *                        held-out prediction or calibration — against a control with the
 *                        link withheld. A link that carries traffic is not a link that
 *                        helps, and lateral.js already refuses structural credit for
 *                        exactly this reason.
 *
 * `test/domains.js` reports finance as MANIFEST-ONLY until step 1, and row 24 stays
 * partial until step 3.
 * ═══════════════════════════════════════════════════════════════════════════════════
 *
 * EVERY CHANNEL BELOW WAS READ OUT OF THE FETCHER THAT PRODUCES IT, not inferred from
 * its name. That distinction has cost this project real time: a channel was once built on
 * a field that held one value corpus-wide, and evidence was counted four different wrong
 * ways before landing on adapter-supplied identity. So `units` says what the number
 * physically is, and where a source is a keyword-match count over a feed, it says so
 * rather than calling itself a measurement of the thing the keywords are about.
 *
 * WHY ONLY THREE RELATIONSHIPS, WHEN THIRTEEN CHANNELS ARE DECLARED.
 *
 * A relationship is a claim that two channels observe ONE latent, and it is falsifiable.
 * Three of these sources — Massive, Finnhub, Alpha Vantage — demonstrably fetch the same
 * instrument: the URLs are `.../ticker/SPY/prev`, `quote?symbol=SPY` and
 * `GLOBAL_QUOTE&symbol=SPY`, and each extracts a dollar price. Same symbol, same units,
 * same quantity. A gap between them is a data problem, which is worth knowing on its own.
 *
 * Nothing else here clears that bar from the code. It is tempting to relate the
 * enforcement counts — FDIC, OCC, CFTC, FINRA, NCUA — under something like "regulatory
 * action volume", and it might even be true. But what the code shows is five independent
 * keyword-match counts over five different feeds run by five agencies with different
 * remits, and "these plausibly move together" is a hypothesis about the world rather than
 * something the fetchers establish. Declaring it would manufacture exactly the kind of
 * claim the latent requirement exists to prevent, and a wrong declaration is worse than a
 * missing one: divergence would grade a real relationship against a latent nobody can
 * defend. They stay unrelated until something measures them.
 */

'use strict';

var DIV = require('../core/divergence.js');
var FACTORY = require('./factory.js');

var HOUR = 3600000;
var DAY = 24 * HOUR;
var WEEK = 7 * DAY;

/**
 * THE MANIFEST.
 *
 * q/r are SET, not fitted [mark: prior], on the same principle bind/energy.js states: r
 * is lower for a settlement price than for a keyword count, because an article count is a
 * far noisier read of the world than a quoted price. core/channel.js derives both from
 * each channel's own innovations once enough have accumulated, and abstains until then.
 *
 * `recordedField: 'v'` throughout, and it is a claim rather than a default: every finance
 * fetcher emits its number as `value`, which handlers/feed-record.js stores as `v`. None
 * of these is an RSS recency count, so none reads `r7`. A future finance channel backed by
 * a news query would declare `'r7'` and would be read differently — which is the point of
 * declaring it per channel instead of inferring it.
 */
var CHANNELS = [
  // ── One instrument, three independent vendors. SPY, in dollars, verified per URL. ──
  /**
   * MASSIVE SPY DECLARES NO REFERENCE INTERVAL, DELIBERATELY. It emits no numeric value at
   * all in production — 500 recorded rows, 0 distinct values, 0 source identities, measured
   * 2026-08-09 — so nothing is known about the shape of an identity it has never produced.
   * Declaring an interval from its vendor documentation would be describing data that does
   * not exist. Its two relationships therefore abstain by name, which is the honest report,
   * and it can be declared the day it publishes something.
   */
  { key: 'massiveSpy',   name: 'Massive SPY',                 recordedField: 'v', field: 'value', source: 'Polygon SPY prev close (key-gated)', cadenceMs: DAY,  units: '$/share',   q: 0.02, r: 0.05 },
  /**
   * REFERENCE INTERVAL, declared because the comparability gate refuses to guess one.
   *
   * Finnhub publishes an instantaneous quote stamped with the publisher's own `quote-t`, so
   * the reading refers to THAT MOMENT, not to the session. `maxLagFromCloseMs` is 15 minutes:
   * being inside the session window is not the same as being near the close, and a feed that
   * died at lunchtime must not stand against a settled closing figure. Measured 2026-08-09,
   * Finnhub carries a quote at exactly the 16:00 close on every session in the window, so the
   * tolerance is met by real data rather than chosen to fit.
   */
  { key: 'finnhub',      name: 'Finnhub Market',              recordedField: 'v', field: 'value', source: 'Finnhub quote SPY (key-gated)',      cadenceMs: HOUR, units: '$/share',   q: 0.02, r: 0.06,
    referenceInterval: { kind: 'point_in_time', calendar: 'usEquity', maxLagFromCloseMs: 15 * 60 * 1000,
      observedAt: { kind: 'epoch_seconds', after: 'quote-t:' } } },
  /**
   * Alpha Vantage keys on `trading-day`, so its figure is the SESSION'S settled close and
   * refers to the whole session rather than to an instant. It is polled hourly (`cadenceMs`)
   * and that is a different fact from what it refers to; conflating the two is what produced
   * 93% intraday-versus-previous-close comparisons before the gate existed.
   *
   * It also RESTATES that close under the unchanged identity about two hours after first
   * publishing it, which is why receipt ordering had to exist before this could be declared.
   */
  { key: 'alphaVantage', name: 'Alpha Vantage Market',        recordedField: 'v', field: 'value', source: 'Alpha Vantage GLOBAL_QUOTE SPY (key-gated)', cadenceMs: HOUR, units: '$/share', q: 0.02, r: 0.06,
    referenceInterval: { kind: 'session_close', calendar: 'usEquity',
      observedAt: { kind: 'session_date', after: 'trading-day:' } } },

  // ── Rates and balances: real quantities with their own publication schedules. ──
  { key: 'sofr',         name: 'NY Fed SOFR',                 recordedField: 'v', field: 'value', source: 'NY Fed markets API, secured/sofr',   cadenceMs: DAY,  units: '% overnight', q: 0.01, r: 0.04 },
  { key: 'yieldCurve',   name: 'Treasury Yield Curve',        recordedField: 'v', field: 'value', source: 'Treasury fiscaldata avg_interest_rates (Bills minus Notes)', cadenceMs: DAY, units: 'percentage points', q: 0.01, r: 0.05 },
  { key: 'treasuryDebt', name: 'Treasury Debt',               recordedField: 'v', field: 'value', source: 'Treasury fiscaldata debt',           cadenceMs: DAY,  units: '$ trillions', q: 0.005, r: 0.03 },

  // ── Publication-volume counts. Real numbers, but counts of documents, not of events. ──
  { key: 'secEdgar',     name: 'SEC EDGAR Filings',           recordedField: 'v', field: 'value', source: 'SEC EDGAR current filings Atom',     cadenceMs: HOUR, units: 'filings in window',   q: 0.05, r: 0.15 },
  { key: 'fedH41',       name: 'Fed H.4.1 Balance Sheet',     recordedField: 'v', field: 'value', source: 'Federal Reserve H.4.1 RSS',          cadenceMs: WEEK, units: 'releases',            q: 0.04, r: 0.15 },
  { key: 'finra',        name: 'FINRA Disciplinary',          recordedField: 'v', field: 'value', source: 'FINRA disciplinary feed',            cadenceMs: DAY,  units: 'disciplinary entries', q: 0.05, r: 0.18 },

  /* KEYWORD-MATCH COUNTS. The units say so deliberately: these count MENTIONS in a feed,
     not confirmed actions, and a mention count is a measure of publication, not of the
     world. Naming them 'bank failures' or 'enforcement actions' would be the same
     naming-over-mechanism substitution this project keeps unwinding. */
  { key: 'fdic',         name: 'FDIC Bank Failures',          recordedField: 'v', field: 'value', source: 'FDIC feed keyword match',            cadenceMs: DAY,  units: 'keyword mentions', q: 0.06, r: 0.25 },
  { key: 'occ',          name: 'OCC Enforcement',             recordedField: 'v', field: 'value', source: 'OCC feed keyword match',             cadenceMs: DAY,  units: 'keyword mentions', q: 0.06, r: 0.25 },
  { key: 'cftc',         name: 'CFTC Press',                  recordedField: 'v', field: 'value', source: 'CFTC press feed keyword match',      cadenceMs: DAY,  units: 'keyword mentions', q: 0.06, r: 0.25 },
  { key: 'ncua',         name: 'NCUA Credit Unions',          recordedField: 'v', field: 'value', source: 'NCUA feed keyword match',            cadenceMs: DAY,  units: 'keyword mentions', q: 0.06, r: 0.25 }
];

/**
 * DECLARED RELATIONSHIPS.
 *
 * A full triangle rather than a star, and that is a considered choice. All three vendors
 * are key-gated, so any of them may be absent; a star centred on one would make that one
 * source's absence kill every pair at once. Each edge here is independently justified —
 * two vendors quoting one instrument — so whichever two happen to be present still leave
 * a testable pair, which is the whole point of declaring them.
 */
var REL = [
  DIV.relate('massiveSpy', 'finnhub', 'SPY price level', 'agree',
    'Polygon previous close and Finnhub live quote are the same instrument priced by two vendors; a sustained gap is a data problem, not a market one'),
  DIV.relate('massiveSpy', 'alphaVantage', 'SPY price level', 'agree',
    'Polygon and Alpha Vantage both quote SPY in dollars; disagreement points at a stale or expired feed rather than at the market'),
  DIV.relate('finnhub', 'alphaVantage', 'SPY price level', 'agree',
    'two live-quote vendors on one symbol; this pair survives when the Polygon key is absent, which is why it is declared rather than inferred from the other two')
];

var SIGMA = 2.0;   // [mark: prior] — same threshold the core detector uses, stated once

/**
 * FINDINGS. Deliberately few, and each grounded in a channel that carries a real
 * quantity rather than a publication count. A finding on a keyword-match count would fire
 * on a news cycle and be reported as a financial condition.
 */
var FINDINGS = [
  { id: 'MARKET_DISLOCATION', requires: ['finnhub'],
    basis: 'SPY departing its own baseline by >=2sd on a live quote',
    test: function (v, s, d) { return d.finnhub && Math.abs(d.finnhub.z) >= SIGMA; } },

  { id: 'FUNDING_STRESS', requires: ['sofr'],
    basis: 'overnight secured rate departing its own baseline — a funding-market signal, not a level judgement',
    test: function (v, s, d) { return d.sofr && Math.abs(d.sofr.z) >= SIGMA; } },

  { id: 'CURVE_SHIFT', requires: ['yieldCurve'],
    basis: 'bills-minus-notes spread departing its own baseline',
    test: function (v, s, d) { return d.yieldCurve && Math.abs(d.yieldCurve.z) >= SIGMA; } },

  { id: 'VENDOR_DISAGREEMENT', requires: ['massiveSpy', 'finnhub'],
    basis: 'two vendors on ONE instrument departing in opposite directions — an instrument cannot do that, so this is an instrumentation fault',
    test: function (v, s, d) {
      return d.massiveSpy && d.finnhub &&
             Math.sign(d.massiveSpy.z) !== Math.sign(d.finnhub.z) &&
             Math.abs(d.massiveSpy.z - d.finnhub.z) >= SIGMA;
    } },

  { id: 'SYSTEMIC_FINANCIAL_STRESS', requires: ['finnhub', 'sofr'],
    basis: 'the fused domain state itself past 2sd, with a price and a rate both live',
    test: function (v, s, d) { return typeof s.departure === 'number' && Math.abs(s.departure) >= SIGMA; } }
];

module.exports = FACTORY.createBinder({
  domain: 'finance',
  version: 'brain-v2/0.1.0-finance',
  levelsPerSensor: 3,
  sigma: SIGMA,
  channels: CHANNELS,
  findings: FINDINGS,
  relationships: REL,
  efferent: null   // R7: nothing consumes this domain's output yet, and it says so
});
