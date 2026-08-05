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
 * That is not a hypothetical severity. The population binder was about to declare a
 * relationship between this channel and World Bank SP.POP.TOTL, and a relationship
 * asserts the two observe ONE latent. Had the selection been male-only, divergence would
 * have reported a permanent ~50% gap as a disagreement between publishers.
 *
 * ALL FIXTURES BELOW ARE MOCKED. No network call is made, and the decoy rows are
 * deliberately placed BEFORE the correct one so any implementation that falls back to
 * array order fails.
 */

'use strict';

var DS = require('../../handlers/domain-snapshot.js');
var select = DS._selectUNPopulationRow;

var failures = 0, tests = 0;
function assert(name, cond, detail) {
  tests++;
  if (cond) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

function row(sex, variant, year, value) {
  return { sex: sex, variantLabel: variant, timeLabel: String(year), value: value };
}

console.log('');
console.log('=== UN INDICATOR 49 ROW SELECTION (mocked; no network) ===');
console.log('');

// ── U1: order must not decide ────────────────────────────────────────────────
(function () {
  console.log('U1 [regression]: decoys first, correct row last');
  var rows = [
    row('Male', 'Median', 2024, 170000),
    row('Female', 'Median', 2024, 172000),
    row('Both sexes', 'Median', 2023, 339000),
    row('Both sexes', 'High', 2024, 345000),
    row('Both sexes', 'Median', 2024, 342000)      // the only correct row, last
  ];
  var r = select(rows, { maxYear: 2024 });
  assert('selects the both-sexes median row for the latest year', r.row && r.row.value === 342000,
    r.row ? String(r.row.value) : r.why);
  assert('and not the first row, which is male', r.row !== rows[0]);
  assert('nor the female row', r.row !== rows[1]);
  assert('nor the earlier year', r.row !== rows[2]);
  assert('nor the projection variant', r.row !== rows[3]);
  assert('the year is reported alongside', r.year === 2024, String(r.year));
})();

// ── U2: each wrong dimension on its own ──────────────────────────────────────
(function () {
  console.log('U2: a single-sex-only response is refused, not averaged or taken');
  var maleOnly = select([row('Male', 'Median', 2024, 170000), row('Female', 'Median', 2024, 172000)], { maxYear: 2024 });
  assert('no both-sexes row means no value', maleOnly.row === null, JSON.stringify(maleOnly.row));
  assert('and the reason names the by-sex reporting',
    /both sexes/.test(maleOnly.why) && /BY SEX/.test(maleOnly.why), maleOnly.why);

  console.log('U2b: a projection-only response is refused');
  var projOnly = select([row('Both sexes', 'High', 2024, 345000), row('Both sexes', 'Low', 2024, 338000)], { maxYear: 2024 });
  assert('no estimate/median row means no value', projOnly.row === null);
  assert('and the reason says a projection is a different statistic',
    /different statistic/.test(projOnly.why), projOnly.why);

  console.log('U2c: a future-year-only response is refused');
  var futureOnly = select([row('Both sexes', 'Median', 2030, 350000)], { maxYear: 2024 });
  assert('a row past maxYear is not used', futureOnly.row === null, JSON.stringify(futureOnly.row));
})();

// ── U3: ambiguity is refused, never resolved by position ─────────────────────
(function () {
  console.log('U3 [adversarial]: two equally-qualified rows are refused');
  var rows = [
    row('Both sexes', 'Median', 2024, 342000),
    row('Both sexes', 'Estimate', 2024, 341500)    // same year, both qualify
  ];
  var r = select(rows, { maxYear: 2024 });
  assert('a tie on the chosen year yields no row', r.row === null, JSON.stringify(r.row));
  assert('and says so rather than picking by position',
    /ambiguous/.test(r.why) && /position/.test(r.why), r.why);
})();

// ── U4: degenerate inputs fail closed ────────────────────────────────────────
(function () {
  console.log('U4: malformed input abstains rather than throwing');
  assert('an empty array yields no row', select([], {}).row === null);
  assert('a non-array yields no row', select(null, {}).row === null);
  assert('rows with no numeric value yield no row',
    select([{ sex: 'Both sexes', variantLabel: 'Median', timeLabel: '2024' }], { maxYear: 2024 }).row === null);
  assert('rows with no year yield no row',
    select([{ sex: 'Both sexes', variantLabel: 'Median', value: 342000 }], { maxYear: 2024 }).row === null);
  assert('every refusal carries a stated reason',
    [select([], {}), select(null, {}), select([{}], {})].every(function (r) {
      return typeof r.why === 'string' && r.why.length > 10;
    }));
})();

// ── U5: an unrecognised schema abstains rather than guessing ─────────────────
(function () {
  console.log('U5: a response whose shape is not recognised is refused');
  /**
   * The portal's exact field names are not verifiable from inside this repository, so the
   * selector matches on VALUES rather than on invented field names. The consequence has
   * to be that an unrecognised shape produces nothing — if it produced a number instead,
   * the "we cannot verify the schema" caveat would be decoration.
   */
  var opaque = [{ a: 'x', b: 'y', c: 2024, value: 342000 }];
  assert('a row with no sex or variant marker is refused', select(opaque, { maxYear: 2024 }).row === null);
  assert('even though it carries a plausible value and year',
    opaque[0].value === 342000 && opaque[0].c === 2024);
})();

// ── U6: the identity distinguishes what it must ──────────────────────────────
(function () {
  console.log('U6: source identity distinguishes indicator, location, year, sex and variant');
  var ci = DS._compositeIdentity;
  function id(year, sex, variant) {
    return ci([['un-indicator', '49'], ['location', '840'], ['year', year], ['sex', sex], ['variant', variant]]);
  }
  var base = id(2024, 'both', 'estimate');
  assert('a new year changes the identity', id(2025, 'both', 'estimate') !== base);
  assert('a different sex changes it', id(2024, 'male', 'estimate') !== base);
  assert('a different variant changes it', id(2024, 'both', 'high') !== base);
  assert('and a re-poll of the same observation does not', id(2024, 'both', 'estimate') === base);
  assert('the identity names all five components',
    /un-indicator:49/.test(base) && /location:840/.test(base) && /year:2024/.test(base) &&
    /sex:both/.test(base) && /variant:estimate/.test(base), base);
})();

console.log('');
console.log(failures ? (tests - failures) + '/' + tests + ' passed, ' + failures + ' FAILED'
                     : tests + '/' + tests + ' passed');
console.log('');
console.log('NOT PROVEN HERE: that the live portal uses these field names. The selector');
console.log('matches on values and abstains on an unrecognised shape, so a schema mismatch');
console.log('produces no reading rather than a wrong one.');
console.log('');
process.exit(failures ? 1 : 0);
