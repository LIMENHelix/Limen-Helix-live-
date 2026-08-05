/**
 * brain-v2/test/un-population-selector.js — UN indicator 49 row selection.
 *
 *   node brain-v2/test/un-population-selector.js
 *
 * WHY THIS EXISTS. `fetchUNPopulation` requested `pageSize=1` and took `data.data[0]`.
 * Indicator 49 is "Total population by sex", so the endpoint returns male, female and
 * both-sexes rows across several years and variants. Asking for one row and taking it
 * handed the choice to whatever the server ordered first: the channel could have carried
 * male-only population for the wrong year under a projection variant, and every consumer
 * downstream would have treated it as the US total.
 *
 * That is not a hypothetical severity. The population binder briefly declared a
 * relationship between this channel and World Bank SP.POP.TOTL, and a relationship asserts
 * the two observe ONE latent. Had the selection been male-only, divergence would have
 * reported a permanent ~50% gap as a disagreement between publishers.
 *
 * THAT RELATIONSHIP HAS SINCE BEEN WITHDRAWN, on a defect none of this file's work
 * touches: WPP 2024's estimation period ends in 2023, so the latest completed calendar
 * year is a projection, and the World Bank side may sit on a different year. Selecting the
 * right row correctly is necessary and was never sufficient. These tests still matter —
 * the channel is still read, still recorded, and still carries a source identity.
 *
 * THE FIXTURES BELOW ARE BUILT FROM THE PUBLISHED SCHEMA, NOT FROM GUESSWORK. A previous
 * pass asserted the schema was unverifiable and matched by scanning every string field for
 * tokens like "total" and "both" — which is unsafe, because "total" also appears in
 * `category` and in the indicator name "Total population by sex". The portal publishes all
 * of this, and it was read before these fixtures were written (metadata endpoints answer
 * without a key; only the data endpoint is 401):
 *
 *   MainDataSetFullDto (swagger.json)   indicatorId, locationId, sourceId, revision,
 *                                       variantId, variant, variantShortName, variantLabel,
 *                                       timeId, timeLabel, timeMid, categoryId, category,
 *                                       estimateType, sexId, sex, ageLabel, value
 *   api/v1/Indicators/49                unitShortLabel "persons", unitScaling 1,
 *                                       defaultSexId 3, defaultVariantId 4
 *   api/v1/metadata/sexes/49            3 "Both sexes", 1 "Male", 2 "Female"
 *   api/v1/metadata/variants/49         4 "Median"; the rest are prediction-interval
 *                                       bounds and fertility scenarios
 *
 * UNITS ARE PERSONS. A US reading is ~342000000, not 342000, so the fixtures use whole
 * persons and the M label divides by 1e6.
 *
 * ALL FIXTURES ARE MOCKED. No network call is made, and the decoy rows are deliberately
 * placed BEFORE the correct one so any implementation that falls back to array order fails.
 */

'use strict';

var DS = require('../../handlers/domain-snapshot.js');
var select = DS._selectUNPopulationRow;
var windowFor = DS._unPopulationWindow;
var identityOf = DS._unPopulationIdentity;

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

/* A row as the portal documents it. Overrides replace or delete any field. */
function row(over) {
  var r = {
    locationId: 840, location: 'United States of America', iso3: 'USA', iso2: 'US',
    indicatorId: 49, indicator: 'Total population by sex',
    indicatorDisplayName: 'Total population by sex',
    sourceId: 27, source: 'World Population Prospects', revision: 2024,
    variantId: 4, variant: 'Median', variantShortName: 'Median', variantLabel: 'Median',
    timeId: 175, timeLabel: '2024', timeMid: '2024-07-01',
    /* estimateType's PERMITTED VALUES ARE NOT KNOWN — the data endpoint is 401 without a
       key, so this string is a deliberate placeholder rather than a claim about the
       vocabulary. Nothing selects on it; the tests only prove it is carried verbatim. */
    categoryId: 0, category: '', estimateType: 'PLACEHOLDER-vocabulary-unverified',
    sexId: 3, sex: 'Both sexes', ageLabel: 'Total', value: 342000000
  };
  Object.keys(over || {}).forEach(function (k) {
    if (over[k] === undefined) delete r[k]; else r[k] = over[k];
  });
  return r;
}
function male(over)   { return row(Object.assign({ sexId: 1, sex: 'Male',   value: 170000000 }, over || {})); }
function female(over) { return row(Object.assign({ sexId: 2, sex: 'Female', value: 172000000 }, over || {})); }

console.log('');
console.log('=== UN INDICATOR 49 ROW SELECTION (mocked; no network) ===');
console.log('');

// ── W: the request window rolls, and is built without a network call ─────────
(function () {
  console.log('W [regression]: the request window is not frozen at 2023-2025');
  var w2026 = windowFor(new Date('2026-08-04T00:00:00Z'));
  var w2027 = windowFor(new Date('2027-01-01T00:00:00Z'));
  assert('the end year is the last COMPLETED calendar year', w2026.endYear === 2025, String(w2026.endYear));
  assert('and the start year precedes it by the declared span',
    w2026.startYear === 2022, String(w2026.startYear));
  assert('the window advances with the clock rather than staying at 2025',
    w2027.endYear === 2026 && w2027.startYear === 2023, w2027.startYear + '-' + w2027.endYear);
  assert('the URL carries the computed years, not literals',
    /[?&]startYear=2022(&|$)/.test(w2026.url) && /[?&]endYear=2025(&|$)/.test(w2026.url) &&
    /[?&]startYear=2023(&|$)/.test(w2027.url) && /[?&]endYear=2026(&|$)/.test(w2027.url), w2026.url);
  assert('and still asks for a full page, not one row',
    /pageSize=100/.test(w2026.url) && !/pageSize=1(&|$)/.test(w2026.url), w2026.url);
  assert('the URL names indicator 49 at location 840',
    /\/indicators\/49\/locations\/840(\?|$)/.test(w2026.url), w2026.url);

  /**
   * THE SERVER IS ASKED TO NARROW, RATHER THAN ONE PAGE BEING HOPED SUFFICIENT.
   * `pageSize` is documented as "defaults to 100, maximum 100", so a full page is exactly
   * what a truncated response looks like and proves nothing about completeness. The query
   * form of the endpoint takes `variants` and `sexes`, so both are sent.
   */
  assert('the request filters server-side to variantId 4 (Median)',
    /[?&]variants=4(&|$)/.test(w2026.url), w2026.url);
  assert('and to sexId 3 (Both sexes)',
    /[?&]sexes=3(&|$)/.test(w2026.url), w2026.url);
  assert('using the query form of the endpoint, which is the one that accepts those filters',
    !/\/start\/\d{4}\/end\/\d{4}/.test(w2026.url) && /\/locations\/840\?/.test(w2026.url), w2026.url);
  assert('but the filters do NOT replace per-row validation — an unfiltered response is still refused',
    select([male(), row({ variantId: 9, variant: 'High-fertility', variantShortName: 'High-fertility',
                          variantLabel: 'High-fertility' })], { maxYear: 2025 }).row === null,
    'a server ignoring an unknown query parameter returns everything');

  var live = windowFor(new Date());
  assert('a live call ends one year before the current UTC year',
    live.endYear === new Date().getUTCFullYear() - 1, String(live.endYear));

  /**
   * AND THE CEILING IS NOT THE SAME THING AS AN ESTIMATE. WPP 2024's estimation period
   * ends in 2023 ("For the estimation period between 1950 and 2023..." — WPP 2024 release
   * note), so a Median row for a later year is the revision's medium-variant PROJECTION.
   * The window is honest about being a completed-CALENDAR-year window and nothing here
   * claims it selects an estimate. That is why bind/population.js declares no relationship
   * against World Bank SP.POP.TOTL.
   */
  assert('the completed-year ceiling currently sits past the WPP 2024 estimation period',
    live.endYear > 2023,
    'so the selected row is a projection, which is why no relationship is declared');
})();

// ── U1: order must not decide ────────────────────────────────────────────────
(function () {
  console.log('U1 [regression]: decoys first, correct row last');
  var rows = [
    male(),
    female(),
    row({ timeLabel: '2023', value: 339000000 }),                                  // earlier year
    row({ variantId: 9, variant: 'High-fertility', variantShortName: 'High-fertility',
          variantLabel: 'High-fertility', value: 345000000 }),                      // wrong variant
    row({ locationId: 124, location: 'Canada', value: 40000000 }),                  // wrong location
    row({ indicatorId: 72, indicator: 'Total fertility rate', value: 1.6 }),         // wrong indicator
    row()                                                                            // the only correct row, last
  ];
  var r = select(rows, { maxYear: 2025 });
  assert('selects the both-sexes Median row for the latest completed year',
    r.row && r.row.value === 342000000, r.row ? String(r.row.value) : r.why);
  assert('and not the first row, which is male', r.row !== rows[0]);
  assert('nor the female row', r.row !== rows[1]);
  assert('nor the earlier year', r.row !== rows[2]);
  assert('nor the high-fertility variant', r.row !== rows[3]);
  assert('nor another country', r.row !== rows[4]);
  assert('nor another indicator', r.row !== rows[5]);
  assert('the year is reported alongside', r.year === 2024, String(r.year));
  assert('and so is the row own sex and variant, normalised',
    r.sex === 'both sexes' && r.variant === 'median', r.sex + ' / ' + r.variant);
  assert('naming which documented field the variant was read from',
    r.variantField === 'variant', String(r.variantField));
})();

// ── U2: each wrong dimension on its own ──────────────────────────────────────
(function () {
  console.log('U2: a single-sex-only response is refused, not averaged or taken');
  var maleOnly = select([male(), female()], { maxYear: 2025 });
  assert('no both-sexes row means no value', maleOnly.row === null, JSON.stringify(maleOnly.row));
  assert('and the reason names the by-sex reporting',
    /both sexes/i.test(maleOnly.why) && /BY SEX/.test(maleOnly.why), maleOnly.why);

  console.log('U2b: a projection-bound-only response is refused');
  var bounds = [
    row({ variantId: 6, variant: '95% upper bound', variantShortName: '95% upper bound', variantLabel: '95% upper bound', value: 345000000 }),
    row({ variantId: 1, variant: '95% lower bound', variantShortName: '95% lower bound', variantLabel: '95% lower bound', value: 338000000 })
  ];
  var projOnly = select(bounds, { maxYear: 2025 });
  assert('no Median row means no value', projOnly.row === null, JSON.stringify(projOnly.row));
  assert('and the reason says a bound is a different statistic',
    /different statistic/.test(projOnly.why), projOnly.why);

  console.log('U2c: a future-year-only response is refused');
  var futureOnly = select([row({ timeLabel: '2030', value: 350000000 })], { maxYear: 2025 });
  assert('a row past maxYear is not used', futureOnly.row === null, JSON.stringify(futureOnly.row));

  console.log('U2d: the variant name and the variant id must agree');
  var mismatched = select([row({ variantId: 9 })], { maxYear: 2025 });
  assert('a row labelled Median but carrying variantId 9 is refused',
    mismatched.row === null, JSON.stringify(mismatched.row));
  var sexMismatch = select([row({ sexId: 1 })], { maxYear: 2025 });
  assert('a row labelled Both sexes but carrying sexId 1 is refused',
    sexMismatch.row === null, JSON.stringify(sexMismatch.row));
})();

// ── U3: ambiguity is refused, never resolved by position ─────────────────────
(function () {
  console.log('U3 [adversarial]: two equally-qualified rows are refused');
  var rows = [
    row({ value: 342000000 }),
    row({ sourceId: 26, revision: 2022, value: 341500000 })   // same year, both qualify
  ];
  var r = select(rows, { maxYear: 2025 });
  assert('a tie on the chosen year yields no row', r.row === null, JSON.stringify(r.row));
  assert('and says so rather than picking by position',
    /ambiguous/.test(r.why) && /position/.test(r.why), r.why);
})();

// ── U4: degenerate inputs fail closed ────────────────────────────────────────
(function () {
  console.log('U4: malformed input abstains rather than throwing');
  assert('an empty array yields no row', select([], { maxYear: 2025 }).row === null);
  assert('a non-array yields no row', select(null, { maxYear: 2025 }).row === null);
  assert('rows with no numeric value yield no row',
    select([row({ value: undefined })], { maxYear: 2025 }).row === null);
  assert('a non-finite value is not a value',
    select([row({ value: NaN })], { maxYear: 2025 }).row === null);
  assert('rows with no timeLabel yield no row',
    select([row({ timeLabel: undefined })], { maxYear: 2025 }).row === null);
  assert('a timeLabel that is not a four-digit year yields no row',
    select([row({ timeLabel: 'Total' })], { maxYear: 2025 }).row === null);
  assert('a missing maxYear ceiling is refused rather than defaulted',
    select([row()], {}).row === null, 'a default ceiling would silently admit projections');
  assert('every refusal carries a stated reason',
    [select([], {}), select(null, {}), select([{}], { maxYear: 2025 }), select([row()], {})]
      .every(function (r) { return typeof r.why === 'string' && r.why.length > 10; }));
})();

// ── U5: nothing outside the documented fields is treated as evidence ─────────
(function () {
  console.log('U5 [adversarial]: "Total" anywhere else is not proof of both sexes');
  /**
   * THE EXACT SHAPE THE OLD SCANNER WOULD HAVE ACCEPTED. `category: "Total"` and
   * `ageLabel: "Total"` are ordinary values on this endpoint, and the indicator is itself
   * NAMED "Total population by sex". A scanner looking for the token "total" in any string
   * field accepts every one of these rows as the combined total.
   */
  var noSex = row({ category: 'Total', sex: undefined, sexId: undefined });
  assert('a row with category Total, Median variant, a plausible year and value, but NO sex, is refused',
    select([noSex], { maxYear: 2025 }).row === null, JSON.stringify(select([noSex], { maxYear: 2025 }).row));

  var wrongSex = row({ category: 'Total', sexId: 1, sex: 'Male', value: 170000000 });
  assert('and the same row with the WRONG sex is refused too',
    select([wrongSex], { maxYear: 2025 }).row === null, JSON.stringify(select([wrongSex], { maxYear: 2025 }).row));

  assert('the refusal is on sex, not on something incidental',
    /rejected on `sex`/.test(select([wrongSex], { maxYear: 2025 }).why),
    select([wrongSex], { maxYear: 2025 }).why);

  assert('both decoys really do carry the token the old scanner matched',
    noSex.category === 'Total' && /Total/.test(noSex.indicator) && wrongSex.ageLabel === 'Total');

  console.log('U5b: an unrecognised shape is refused rather than guessed at');
  var opaque = [{ a: 'both sexes', b: 'median', c: '2024', value: 342000000 }];
  assert('a row without the documented id fields is refused',
    select(opaque, { maxYear: 2025 }).row === null);
  assert('even though its string values would have satisfied a token scan',
    opaque[0].a === 'both sexes' && opaque[0].b === 'median');
})();

// ── U6: the identity is built from the row that was accepted ─────────────────
(function () {
  console.log('U6: source identity records the row own fields, not what was asked for');
  function idFor(over) {
    return identityOf(select([row(over || {})], { maxYear: 2025 }));
  }
  var base = idFor();
  assert('an accepted row produces an identity', typeof base === 'string' && base.length > 0, String(base));
  assert('it names indicator, location, year, sex and the ACTUAL variant',
    /un-indicator:49/.test(base) && /location:840/.test(base) && /year:2024/.test(base) &&
    /sex:both sexes/.test(base) && /variant:median/.test(base), base);
  assert('a Median row is NEVER recorded as variant:estimate',
    !/variant:estimate\b/.test(base), base);
  assert('it carries the publisher source and revision as well',
    /source:27/.test(base) && /revision:2024/.test(base), base);
  assert('and the estimate type verbatim, which is what would separate an estimate from a projection',
    /estimate-type:placeholder-vocabulary-unverified/.test(base), base);

  assert('a new year changes the identity', idFor({ timeLabel: '2023' }) !== base);
  assert('a new WPP revision of the same year changes it', idFor({ revision: 2022 }) !== base);
  assert('a different source changes it', idFor({ sourceId: 26 }) !== base);
  assert('and a re-poll of the same observation does not', idFor() === base);

  assert('a refusal has no identity at all',
    identityOf(select([male()], { maxYear: 2025 })) === null &&
    identityOf(null) === null);

  console.log('U6b: the identity survives a row that omits the optional provenance fields');
  var lean = identityOf(select([row({ sourceId: undefined, revision: undefined, estimateType: undefined })], { maxYear: 2025 }));
  assert('the five required components still produce an identity',
    typeof lean === 'string' && /un-indicator:49/.test(lean) && /variant:median/.test(lean), String(lean));
  assert('and it differs from the fuller one, because it describes less',
    lean !== base);
})();

// ── U7: the variant may be read from any documented variant field ────────────
(function () {
  console.log('U7: the variant is read from the DTO variant fields, in declared order');
  var short = select([row({ variant: undefined })], { maxYear: 2025 });
  assert('variantShortName is used when variant is absent',
    short.row !== null && short.variantField === 'variantShortName', String(short.variantField || short.why));
  var label = select([row({ variant: undefined, variantShortName: undefined })], { maxYear: 2025 });
  assert('variantLabel is used when both are absent',
    label.row !== null && label.variantField === 'variantLabel', String(label.variantField || label.why));
  var none = select([row({ variant: undefined, variantShortName: undefined, variantLabel: undefined })], { maxYear: 2025 });
  assert('and a row carrying no variant name at all is refused',
    none.row === null, JSON.stringify(none.row));
})();

console.log('');
console.log(failures ? (tests - failures) + '/' + tests + ' passed, ' + failures + ' FAILED'
                     : tests + '/' + tests + ' passed');
console.log('');
console.log('NOT PROVEN HERE: that a LIVE response carries these values. The field names and');
console.log('the sex/variant vocabularies were read from the portal own published metadata,');
console.log('but the data endpoint requires a key and was not called. A row that does not');
console.log('match the documented schema is refused, so a mismatch produces no reading');
console.log('rather than a wrong one. Nothing here filters on `estimateType`, whose');
console.log('permitted values could not be read; it is recorded, not interpreted.');
console.log('');
process.exit(failures ? 1 : 0);
