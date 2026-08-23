/**
 * brain-v2/test/spy-quote-identity.js — source identity for the three SPY quote channels.
 *
 *   node brain-v2/test/spy-quote-identity.js
 *
 * WHY THIS EXISTS. Finance declares three relationships on one latent, "SPY price level",
 * across Massive SPY, Finnhub and Alpha Vantage. A relationship is only worth recording if
 * the recorder can tell an OBSERVATION from a POLL, and until now none of the three could:
 * every one returned `updated: Date.now(), fetchedAt: Date.now()` and nothing else. That is
 * our clock. Two hundred polls of one unchanged quote were indistinguishable from two
 * hundred observations.
 *
 * Measured against the live recorder before this patch: of thirteen finance channels
 * exactly ONE supplied a publisher-side key. These three now supply one too, which is what
 * the declared relationship needs on both sides.
 *
 * WHAT IS VERIFIED AND WHAT IS NOT.
 *   Alpha Vantage  VERIFIED. `Global Quote["07. latest trading day"]` returns "YYYY-MM-DD",
 *                  checked against their documented demo key, so the helper validates the
 *                  format and a changed format fails closed.
 *   Finnhub        `data.t` per the operator and Finnhub's quote schema. The UNIT is NOT
 *                  asserted anywhere — the stamp is recorded verbatim under a label that
 *                  claims neither seconds nor milliseconds, because an identity needs to be
 *                  stable, not interpreted.
 *   Polygon        `results[0].t` likewise, verbatim, unit unclaimed.
 *
 * ALL FIXTURES BELOW ARE MOCKED. No network call and no API key is used.
 */

'use strict';

var DS = require('../../handlers/domain-snapshot.js');
var finnhub = DS._finnhubQuoteIdentity;
var alpha = DS._alphaVantageQuoteIdentity;
var polygon = DS._polygonAggregateIdentity;
var crudeFetcher = DS._fetchMassiveCrudeOil;

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

function fh(t) { return { c: 750.72, o: 748.10, h: 752.4, l: 747.2, pc: 748.1, t: t }; }
function av(day, price) {
  return { 'Global Quote': {
    '01. symbol': 'SPY', '05. price': String(price || 750.72),
    '07. latest trading day': day, '10. change percent': '0.35%'
  } };
}
function pg(t) { return { T: 'SPY', o: 748.1, c: 750.72, h: 752.4, l: 747.2, v: 1e6, t: t }; }

console.log('');
console.log('=== SPY QUOTE SOURCE IDENTITY (mocked; no network, no keys) ===');
console.log('');

// ── S1: a re-poll of one upstream record is ONE observation ──────────────────
(function () {
  console.log('S1 [the whole point]: polling the same upstream record twice yields one identity');
  assert('finnhub: same quote stamp, same identity',
    finnhub(fh(1785900000), 'SPY') === finnhub(fh(1785900000), 'SPY'), String(finnhub(fh(1785900000), 'SPY')));
  assert('alpha vantage: same trading day, same identity',
    alpha(av('2026-08-04'), 'SPY') === alpha(av('2026-08-04'), 'SPY'), String(alpha(av('2026-08-04'), 'SPY')));
  assert('polygon: same aggregate window, same identity',
    polygon(pg(1785900000000), 'SPY') === polygon(pg(1785900000000), 'SPY'), String(polygon(pg(1785900000000), 'SPY')));

  /* AND A CHANGED PRICE UNDER THE SAME UPSTREAM STAMP IS STILL ONE OBSERVATION. The
     identity keys the RECORD, not the number we read off it. */
  assert('alpha vantage: a different price on the same trading day does not fork the identity',
    alpha(av('2026-08-04', 750.72), 'SPY') === alpha(av('2026-08-04', 751.99), 'SPY'));
})();

// ── S2: a newer upstream record is a NEW observation ─────────────────────────
(function () {
  console.log('S2: a newer upstream stamp changes the identity');
  assert('finnhub: a later quote stamp is a different observation',
    finnhub(fh(1785900000), 'SPY') !== finnhub(fh(1785900060), 'SPY'));
  assert('alpha vantage: the next trading day is a different observation',
    alpha(av('2026-08-04'), 'SPY') !== alpha(av('2026-08-05'), 'SPY'));
  assert('polygon: a later aggregate window is a different observation',
    polygon(pg(1785900000000), 'SPY') !== polygon(pg(1785986400000), 'SPY'));

  console.log('S2b: and the symbol is part of the identity, so two tickers never collide');
  assert('finnhub: SPY and QQQ at the same instant are different observations',
    finnhub(fh(1785900000), 'SPY') !== finnhub(fh(1785900000), 'QQQ'));
  assert('alpha vantage: same day, different symbol, different identity',
    alpha(av('2026-08-04'), 'SPY') !== alpha(av('2026-08-04'), 'QQQ'));
  assert('polygon: same window, different symbol, different identity',
    polygon(pg(1785900000000), 'SPY') !== polygon(pg(1785900000000), 'QQQ'));
})();

// ── S3: missing or unusable upstream fields produce NO identity ──────────────
(function () {
  console.log('S3: an absent publisher stamp yields no identity, never a substitute');
  assert('finnhub: no `t` at all', finnhub({ c: 750.72 }, 'SPY') === null);
  assert('finnhub: `t` of zero is not a stamp', finnhub(fh(0), 'SPY') === null);
  assert('finnhub: a negative `t` is not a stamp', finnhub(fh(-1), 'SPY') === null);
  assert('finnhub: a non-finite `t` is not a stamp', finnhub(fh(NaN), 'SPY') === null &&
    finnhub(fh(Infinity), 'SPY') === null);
  assert('finnhub: a string `t` is not silently coerced', finnhub({ c: 1, t: '1785900000' }, 'SPY') === null);
  assert('finnhub: null and undefined input abstain', finnhub(null, 'SPY') === null &&
    finnhub(undefined, 'SPY') === null);

  assert('alpha vantage: no Global Quote', alpha({}, 'SPY') === null);
  assert('alpha vantage: no trading day field', alpha({ 'Global Quote': { '05. price': '750.72' } }, 'SPY') === null);
  assert('alpha vantage: an empty trading day', alpha(av(''), 'SPY') === null);
  assert('alpha vantage: a malformed date fails CLOSED rather than keying on a stray string',
    alpha(av('not-a-date'), 'SPY') === null && alpha(av('08/04/2026'), 'SPY') === null &&
    alpha(av('2026-8-4'), 'SPY') === null);
  assert('alpha vantage: null input abstains', alpha(null, 'SPY') === null);

  assert('polygon: no `t` on the aggregate', polygon({ c: 750.72 }, 'SPY') === null);
  assert('polygon: null input abstains', polygon(null, 'SPY') === null);

  /* AND A MISSING SYMBOL IS A MISSING COMPONENT. compositeIdentity is all-or-nothing: an
     identity with a hole cannot represent the observation, so it returns null instead. */
  assert('a missing symbol yields no identity rather than a partial one',
    finnhub(fh(1785900000), '') === null && finnhub(fh(1785900000), null) === null &&
    alpha(av('2026-08-04'), null) === null && polygon(pg(1785900000000), null) === null);
})();

// ── S4: our own clock can never enter the identity ───────────────────────────
(function () {
  console.log('S4 [regression]: local polling time is not part of any identity');
  /**
   * THIS IS THE DEFECT BEING FIXED, so it is proved directly rather than by inspection.
   * `Date.now` is moved by a year between two calls on identical input. If any helper
   * reached for the local clock the identities would differ.
   */
  var realNow = Date.now;
  var a, b;
  try {
    Date.now = function () { return 1000000000000; };
    a = [finnhub(fh(1785900000), 'SPY'), alpha(av('2026-08-04'), 'SPY'), polygon(pg(1785900000000), 'SPY')];
    Date.now = function () { return 1999999999999; };
    b = [finnhub(fh(1785900000), 'SPY'), alpha(av('2026-08-04'), 'SPY'), polygon(pg(1785900000000), 'SPY')];
  } finally { Date.now = realNow; }

  assert('finnhub is unmoved by a year of local clock drift', a[0] === b[0], a[0] + ' vs ' + b[0]);
  assert('alpha vantage is unmoved', a[1] === b[1], a[1] + ' vs ' + b[1]);
  assert('polygon is unmoved', a[2] === b[2], a[2] + ' vs ' + b[2]);
  assert('and no identity contains either faked clock reading',
    a.concat(b).every(function (s) { return !/1000000000000|1999999999999/.test(s); }), JSON.stringify(a));

  /* The real clock is also not in there. A live epoch is 13 digits; the identities carry
     only the upstream stamps they were given. */
  var live = [finnhub(fh(1785900000), 'SPY'), alpha(av('2026-08-04'), 'SPY'), polygon(pg(1785900000000), 'SPY')];
  var nowPrefix = String(realNow()).slice(0, 8);
  assert('nor any prefix of the real current epoch',
    live.every(function (s) { return s.indexOf(nowPrefix) < 0; }), nowPrefix + ' in ' + JSON.stringify(live));
})();

// ── S5: the identities are labelled, and name their publisher ────────────────
(function () {
  console.log('S5: each identity names its publisher, its symbol and the upstream stamp');
  var f = finnhub(fh(1785900000), 'SPY');
  var v = alpha(av('2026-08-04'), 'SPY');
  var p = polygon(pg(1785900000000), 'SPY');
  assert('finnhub', /finnhub:quote/.test(f) && /symbol:SPY/.test(f) && /quote-t:1785900000/.test(f), f);
  assert('alpha vantage', /alphavantage:global-quote/.test(v) && /symbol:SPY/.test(v) &&
    /trading-day:2026-08-04/.test(v), v);
  assert('polygon', /polygon:prev-agg/.test(p) && /symbol:SPY/.test(p) && /agg-t:1785900000000/.test(p), p);

  /* THE THREE CANNOT COLLIDE WITH EACH OTHER. They observe one latent from three
     publishers; if two produced the same key the recorder would count one observation. */
  assert('and no two publishers can produce the same key',
    f !== v && v !== p && f !== p);

  console.log('S5b: the unit of the upstream stamp is recorded, not interpreted');
  assert('finnhub uses a unit-free label',
    /quote-t:/.test(f) && !/sec|ms|milli|epoch-ms/.test(f), f);
  assert('polygon uses a unit-free label',
    /agg-t:/.test(p) && !/sec|ms|milli|epoch-ms/.test(p), p);
})();

// ── S6: what the relationship actually needs on both sides ───────────────────
(function () {
  console.log('S6: the declared SPY pair can now accumulate distinct observations on both sides');
  /**
   * The row-10 verdict wants at least six DISTINCT source-supplied keys on each side of one
   * declared relationship. This asserts the shape that makes that possible; it does not
   * assert that six exist, which is a measurement the recorder has to make over real time.
   */
  var days = ['2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-10', '2026-08-11'];
  var avKeys = {};
  days.forEach(function (d) { avKeys[alpha(av(d), 'SPY')] = 1; });
  assert('six trading days give alpha vantage six distinct keys', Object.keys(avKeys).length === 6);

  var fhKeys = {};
  [0, 60, 120, 180, 240, 300].forEach(function (o) { fhKeys[finnhub(fh(1785900000 + o), 'SPY')] = 1; });
  assert('six distinct quote stamps give finnhub six distinct keys', Object.keys(fhKeys).length === 6);

  /* AND THE CADENCES DIFFER, which is the operationally important part: Alpha Vantage's
     key is DAILY, so a day of hourly polling contributes ONE observation on that side. */
  var oneDay = {};
  [0, 1, 2, 3, 4, 5, 6, 7].forEach(function () { oneDay[alpha(av('2026-08-04'), 'SPY')] = 1; });
  assert('eight polls inside one trading day give alpha vantage exactly ONE key',
    Object.keys(oneDay).length === 1,
    'so six keys on that side takes about six TRADING DAYS, not six hours');
})();

// ── S7: the REAL fetcher path, not just the helper ───────────────────────────
(function () {
  console.log('S7 [real path]: the fetchers attach the identity they compute');
  /**
   * The helper being correct proves nothing about the three lines that actually put it on
   * the returned reading. `fetch` is stubbed and the real fetchers are run, so the wiring
   * is exercised end to end without a network call or an API key.
   */
  var realFetch = global.fetch;
  var realEnv = {
    FINNHUB_API_KEY: process.env.FINNHUB_API_KEY,
    ALPHA_VANTAGE_API_KEY: process.env.ALPHA_VANTAGE_API_KEY,
    MASSIVE_API_KEY: process.env.MASSIVE_API_KEY
  };
  function stub(payload) {
    global.fetch = function () {
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(payload); } });
    };
  }
  var results = {};
  return (async function () {
    try {
      process.env.FINNHUB_API_KEY = 'test-key';
      process.env.ALPHA_VANTAGE_API_KEY = 'test-key';
      process.env.MASSIVE_API_KEY = 'test-key';

      stub(fh(1785900000));                       results.fhWith = await DS._fetchFinnhub();
      stub({ c: 750.72, o: 748.1 });              results.fhNone = await DS._fetchFinnhub();
      stub(av('2026-08-04'));                     results.avWith = await DS._fetchAlphaVantage();
      stub({ 'Global Quote': { '05. price': '750.72', '10. change percent': '0.35%' } });
                                                  results.avNone = await DS._fetchAlphaVantage();
      stub({ status: 'OK', results: [pg(1785900000000)] });  results.pgWith = await DS._fetchMassiveSPY();
      stub({ status: 'OK', results: [{ o: 748.1, c: 750.72 }] });  results.pgNone = await DS._fetchMassiveSPY();
      stub({ status: 'OK', results: [{ T: 'CL', o: 72.1, c: 73.4, t: 1785900000000 }] }); results.crudeWith = await crudeFetcher();
      stub({ status: 'OK', results: [{ T: 'CL', o: 72.1, c: 73.4 }] }); results.crudeNone = await crudeFetcher();
    } finally {
      global.fetch = realFetch;
      Object.keys(realEnv).forEach(function (k) {
        if (realEnv[k] === undefined) delete process.env[k]; else process.env[k] = realEnv[k];
      });
    }

    assert('finnhub returns a reading carrying the computed identity',
      results.fhWith && results.fhWith.sourceUpdatedAt === finnhub(fh(1785900000), 'SPY'),
      JSON.stringify(results.fhWith));
    assert('alpha vantage returns a reading carrying the computed identity',
      results.avWith && results.avWith.sourceUpdatedAt === alpha(av('2026-08-04'), 'SPY'),
      JSON.stringify(results.avWith));
    assert('massive returns a reading carrying the computed identity',
      results.pgWith && results.pgWith.sourceUpdatedAt === polygon(pg(1785900000000), 'SPY'),
      JSON.stringify(results.pgWith));
    assert('massive crude returns a reading carrying the CL aggregate identity',
      results.crudeWith && results.crudeWith.sourceUpdatedAt === polygon({ t: 1785900000000 }, 'CL'),
      JSON.stringify(results.crudeWith));

    console.log('S7b: and when the upstream stamp is missing, the READING SURVIVES');
    assert('finnhub still reports the price, with no sourceUpdatedAt property',
      results.fhNone && results.fhNone.value === 750.72 &&
      !('sourceUpdatedAt' in results.fhNone), JSON.stringify(results.fhNone));
    assert('alpha vantage still reports the price, with no sourceUpdatedAt property',
      results.avNone && results.avNone.value === 750.72 &&
      !('sourceUpdatedAt' in results.avNone), JSON.stringify(results.avNone));
    assert('massive still reports the price, with no sourceUpdatedAt property',
      results.pgNone && results.pgNone.value === 750.72 &&
      !('sourceUpdatedAt' in results.pgNone), JSON.stringify(results.pgNone));
    assert('massive crude still reports the price when its aggregate stamp is absent',
      results.crudeNone && results.crudeNone.value === 73.4 &&
      !('sourceUpdatedAt' in results.crudeNone), JSON.stringify(results.crudeNone));

    assert('and the identity is never our own clock, on the real path either',
      [results.fhWith, results.avWith, results.pgWith].every(function (r) {
        return String(r.sourceUpdatedAt).indexOf(String(Date.now()).slice(0, 8)) < 0;
      }));

    finish();
  })();
})();

function finish() {
console.log('');
console.log(failures ? (tests - failures) + '/' + tests + ' passed, ' + failures + ' FAILED'
                     : tests + '/' + tests + ' passed');
console.log('');
console.log('NOT PROVEN HERE: that the live upstreams actually populate these fields. That');
console.log('needs FINNHUB_API_KEY / ALPHA_VANTAGE_API_KEY / MASSIVE_API_KEY, none of which');
console.log('are set locally. Alpha Vantage\'s field name and "YYYY-MM-DD" format WERE');
console.log('verified against their documented demo key. If an upstream field is absent the');
console.log('reading is still recorded and the identity is simply omitted, so the failure');
console.log('mode is a missing key, never a fabricated one.');
console.log('');
process.exit(failures ? 1 : 0);
}
