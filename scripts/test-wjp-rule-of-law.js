'use strict';

var fs = require('fs');
var path = require('path');
var W = require('../lib/wjp-rule-of-law.js');
var H = require('../handlers/authority-wjp.js');
var R = require('../handlers/authority-evidence.js');

var tests = 0, failures = 0;
function assert(name, ok, detail) {
  tests++;
  if (ok) console.log('  PASS ' + name);
  else { failures++; console.error('  FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

function headers() {
  var out = [
    W.FIELDS.countryYear, W.FIELDS.country, W.FIELDS.code, W.FIELDS.region, W.FIELDS.year,
    W.FIELDS.overall, W.FIELDS.f1, W.FIELDS.f2, W.FIELDS.f3, W.FIELDS.f4,
    W.FIELDS.f5, W.FIELDS.f6, W.FIELDS.f7, W.FIELDS.f8
  ];
  while (out.length < W.EXPECTED_COLUMN_COUNT) out.push('Unused reviewed column ' + (out.length + 1));
  return out;
}

function codeFor(i) {
  var n = i, s = '';
  for (var p = 0; p < 3; p++) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
}

function workbook(maxYear) {
  var h = headers(), pos = {};
  h.forEach(function (x, i) { pos[x] = i; });
  var rows = [{ number: 1, values: h.slice() }];
  for (var year = 2015; year <= maxYear; year++) {
    for (var i = 0; i < W.EXPECTED_CURRENT_ROWS; i++) {
      var code = i === 0 ? 'USA' : codeFor(i);
      var v = new Array(h.length).fill('');
      v[pos[W.FIELDS.countryYear]] = code + '-' + year;
      v[pos[W.FIELDS.country]] = i === 0 ? 'United States' : 'Country ' + code;
      v[pos[W.FIELDS.code]] = code;
      v[pos[W.FIELDS.region]] = i === 0 ? 'EU, EFTA, and North America' : 'Test Region';
      v[pos[W.FIELDS.year]] = String(year);
      W.METRICS.forEach(function (m, j) {
        v[pos[m[1]]] = String((0.35 + (i % 20) / 100 + (year - 2015) / 1000 + j / 1000).toFixed(3));
      });
      rows.push({ number: rows.length + 1, values: v });
    }
  }
  return rows;
}

console.log('\n1. REVIEWED SCHEMA');
var goodRows = workbook(2025);
var parsed = W.parseRows(goodRows, { sheetNames: ['Historical Data'], sheetPath: 'xl/worksheets/sheet14.xml' });
assert('the reviewed 58-column schema parses', parsed.ok === true, parsed.code);
assert('the edition is 2025', parsed.edition === 2025, String(parsed.edition));
assert('all 143 current jurisdictions are required', parsed.currentCountryCount === 143, String(parsed.currentCountryCount));
assert('the history is not a one-row smoke test', parsed.rowCount === 1573, String(parsed.rowCount));
assert('country list is unique and complete', new Set(parsed.countries.map(function (x) { return x.code; })).size === 143);
assert('all nine consumed metrics survive', Object.keys(parsed.observations[0].metrics).length === 9);

console.log('\n2. COUNTRY VIEW AND ARITHMETIC');
var usa = W.countryView(parsed, 'USA');
assert('USA resolves', usa.ok && usa.current.country === 'United States');
assert('current and prior editions remain distinct', usa.current.year === 2025 && usa.prior.year === 2024);
assert('history begins at 2015', usa.history[0].year === 2015 && usa.history.length === 11);
assert('arithmetic change is current minus prior', Math.abs(usa.arithmeticChanges.overall - 0.001) < 1e-12, String(usa.arithmeticChanges.overall));
assert('unknown country abstains', W.countryView(parsed, 'ZZZ').code === 'COUNTRY_NOT_FOUND');
assert('malformed country refuses', W.countryView(parsed, 'US').code === 'INVALID_COUNTRY_CODE');

console.log('\n3. REFUSALS');
function clone(x) { return JSON.parse(JSON.stringify(x)); }
var x = clone(goodRows); x[0].values.pop();
assert('57 columns refuse', W.parseRows(x).code === 'COLUMN_COUNT_MISMATCH');
x = clone(goodRows); x[0].values.push('extra');
assert('59 columns refuse', W.parseRows(x).code === 'COLUMN_COUNT_MISMATCH');
x = clone(goodRows); x[0].values[x[0].values.indexOf(W.FIELDS.f7)] = 'renamed civil justice';
assert('a consumed header rename refuses', W.parseRows(x).code === 'REQUIRED_HEADER_MISSING');
x = clone(goodRows); x[0].values[x[0].values.length - 1] = W.FIELDS.f7;
assert('a duplicate consumed header refuses', W.parseRows(x).code === 'DUPLICATE_HEADER');
x = clone(goodRows); x[1].values[x[0].values.indexOf(W.FIELDS.overall)] = '1.1';
assert('score above one refuses', W.parseRows(x).code === 'ROW_VALIDATION_FAILED');
x = clone(goodRows); x[1].values[x[0].values.indexOf(W.FIELDS.code)] = 'US';
assert('bad country identity refuses', W.parseRows(x).code === 'ROW_VALIDATION_FAILED');
x = workbook(2024);
assert('an unreviewed edition refuses', W.parseRows(x).code === 'EDITION_MISMATCH');
x = clone(goodRows);
var yearPos = x[0].values.indexOf(W.FIELDS.year);
var codePos = x[0].values.indexOf(W.FIELDS.code);
x = x.filter(function (r) { return r.number === 1 || !(r.values[yearPos] === '2025' && r.values[codePos] === codeFor(142)); });
assert('142 current jurisdictions refuse', W.parseRows(x).code === 'CURRENT_COVERAGE_MISMATCH');
x = clone(goodRows); x.push(clone(x[1])); x[x.length - 1].number = x.length;
assert('a duplicate country-year refuses', W.parseRows(x).code === 'DUPLICATE_OBSERVATION');

console.log('\n4. OBSERVATION PROVENANCE');
W.stampMetrics(parsed, {
  sourceRef: 'WJP-ROL-2025@abcdef012345',
  sourceSha256: 'a'.repeat(64),
  sourceUrl: H.SOURCE_URL,
  sourceUpdatedAt: 'Tue, 28 Oct 2025 00:00:00 GMT',
  retrievedAt: '2026-08-16T00:00:00.000Z',
  parserVersion: W.PARSER_VERSION,
  transformVersion: W.TRANSFORM_VERSION
});
var metric = parsed.observations[0].metrics.overall;
assert('each metric carries raw and transformed values', metric.raw && typeof metric.value === 'number');
assert('each metric carries immutable source identity', metric.provenance.sourceSha256 === 'a'.repeat(64));
assert('each metric carries source and retrieval times', /2025/.test(metric.provenance.sourceUpdatedAt) && /2026/.test(metric.provenance.retrievedAt));
assert('each metric carries parser and transform versions', metric.provenance.parserVersion === W.PARSER_VERSION && metric.provenance.transformVersion === W.TRANSFORM_VERSION);
assert('every metric on every observation is stamped', parsed.observations.every(function (o) {
  return Object.keys(o.metrics).every(function (k) { return o.metrics[k].provenance && o.metrics[k].provenance.sourceUrl === H.SOURCE_URL; });
}));

console.log('\n5. HANDLER AND ROUTER BOUNDARIES');
var d = H.descriptor();
assert('descriptor identifies an annual composite index', d.publicationInterval === 'annual' && /composite index/.test(d.measureType));
assert('descriptor states no Law finding consumption', d.consumedBy.lawFinding === false);
assert('descriptor states no brain channel consumption', d.consumedBy.brainChannel === false);
assert('descriptor states no Thing layer', d.consumedBy.thingLayer === null);
assert('descriptor states no pathway use', d.consumedBy.pathway === false);
assert('descriptor distinguishes arithmetic from significance', /not WJP statistical significance/.test(d.changeBoundary));
assert('descriptor refuses 30-second interpretation', /annual/.test(d.publicationInterval));
assert('the shared router exposes exactly the two built authorities', R.SUPPORTED.join(',') === 'us_courts_caseload,wjp_rol_index', R.SUPPORTED.join(','));

console.log('\n6. SHARED PAGE CONTRACT');
var page = fs.readFileSync(path.join(__dirname, '..', 'authority-portal.html'), 'utf8');
assert('page calls the shared evidence router', /\/api\/authority-evidence\?authority=/.test(page));
assert('page preserves an explicit country identity', /country=/.test(page) && /ap-country/.test(page));
assert('page has a dedicated WJP renderer', /function renderWjp\(d\)/.test(page));
assert('page labels arithmetic change as non-significant', /Arithmetic only/.test(page) || /changeBoundary/.test(page));
assert('page renders no hardcoded observed WJP score', !/>0\.\d+</.test(page));
assert('page states no pathway activation', /Produces stress \/ diagnosis \/ activation/.test(page));
assert('US Courts remains linked', /authority=us_courts_caseload/.test(page));
assert('WJP is linked from the empty state', /authority=wjp_rol_index/.test(page));

console.log('\n' + (tests - failures) + '/' + tests + ' passed');
process.exit(failures ? 1 : 0);
