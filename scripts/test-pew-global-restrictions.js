#!/usr/bin/env node
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var P = require('../lib/pew-global-restrictions.js');
var H = require('../handlers/authority-pew-restrictions.js');
var R = require('../handlers/authority-evidence.js');

var passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name); }
  catch (e) { console.error('FAIL ' + name + ': ' + e.message); process.exitCode = 1; }
}

var baseNames = ['United States', 'China', 'India', 'Congo, Dem. Rep.', 'Congo, Rep.'];
for (var i = 1; i <= 193; i++) baseNames.push('Structural Country ' + String(i).padStart(3, '0'));

function scoreFor(axis, i) {
  return axis === 'gri' ? [1, 3, 5, 8][i % 4] : [1, 2, 5, 8][i % 4];
}
function publishedName(axis, name) {
  if (axis === 'shi' && name === 'Congo, Dem. Rep.') return 'Congo, Democratic Republic';
  if (axis === 'shi' && name === 'Congo, Rep.') return 'Congo, Republic';
  return name;
}
function rowHtml(axis, name, i, override) {
  override = override || {};
  var region = override.region || P.REGIONS[i % P.REGIONS.length];
  var score = Object.prototype.hasOwnProperty.call(override, 'score') ? override.score : scoreFor(axis, i);
  var category = override.category || P.expectedCategory(axis, score) || 'Very high';
  var shown = override.name || publishedName(axis, name);
  return '<tr><td>' + region + '</td><td>' + shown + '</td><td>' + category + '</td><td>' + score + '</td></tr>';
}
function fixture(axis) {
  var spec = P.AXES[axis];
  return '<!doctype html><html><head><title>' + spec.pageMarker + '</title></head><body>' +
    '<p>' + P.PUBLICATION_DATE + '</p><h1>' + spec.pageMarker + '</h1>' +
    '<p>Pew Research Center analysis of external data. Refer to the Methodology for details.</p>' +
    '<table><thead><tr><th>Region</th><th>Country</th><th>' + axis.toUpperCase() +
    ' Category</th><th>' + spec.scoreHeader + '</th></tr></thead><tbody>' +
    baseNames.map(function (name, i) { return rowHtml(axis, name, i); }).join('') +
    '</tbody></table><p>' + new Array(80).join('reviewed chart context ') + '</p></body></html>';
}

var griHtml = fixture('gri');
var shiHtml = fixture('shi');
var gri = P.parseChart(griHtml, 'gri');
var shi = P.parseChart(shiHtml, 'shi');
var paired = P.pair(gri, shi);

t('GRI structural chart parses 198 rows', function () {
  assert.strictEqual(gri.ok, true);
  assert.strictEqual(gri.rows.length, 198);
});
t('SHI structural chart parses 198 rows', function () {
  assert.strictEqual(shi.ok, true);
  assert.strictEqual(shi.rows.length, 198);
});
t('the two axes pair without a composite', function () {
  assert.strictEqual(paired.ok, true);
  assert.strictEqual(paired.countries.length, 198);
  paired.countries.forEach(function (x) {
    assert.ok(x.gri && x.shi);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(x, 'score'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(x, 'combined'), false);
  });
});
t('only two reviewed country-label aliases are applied', function () {
  var aliased = paired.countries.filter(function (x) { return x.aliasApplied; });
  assert.strictEqual(aliased.length, 2);
  assert.deepStrictEqual(aliased.map(function (x) { return x.country; }).sort(),
    ['Congo, Democratic Republic', 'Congo, Republic']);
  assert.strictEqual(aliased[0].publishedCountry.gri !== aliased[0].publishedCountry.shi, true);
});
t('GRI and SHI thresholds remain distinct', function () {
  assert.strictEqual(P.expectedCategory('gri', 2.3), 'Low');
  assert.strictEqual(P.expectedCategory('gri', 2.4), 'Moderate');
  assert.strictEqual(P.expectedCategory('gri', 6.5), 'High');
  assert.strictEqual(P.expectedCategory('gri', 6.6), 'Very high');
  assert.strictEqual(P.expectedCategory('shi', 1.4), 'Low');
  assert.strictEqual(P.expectedCategory('shi', 1.5), 'Moderate');
  assert.strictEqual(P.expectedCategory('shi', 7.1), 'High');
  assert.strictEqual(P.expectedCategory('shi', 7.2), 'Very high');
});
t('unknown axis refuses', function () {
  assert.strictEqual(P.parseChart(griHtml, 'overall').code, 'UNKNOWN_AXIS');
});
t('small response refuses', function () {
  assert.strictEqual(P.parseChart('<h1>chart</h1>', 'gri').code, 'NOT_A_PEW_CHART_PAGE');
});
t('chart marker removal refuses', function () {
  assert.strictEqual(P.parseChart(griHtml.replace(new RegExp(P.AXES.gri.pageMarker, 'g'), 'Different chart'), 'gri').code,
    'CHART_MARKER_MISSING');
});
t('publication date removal refuses', function () {
  assert.strictEqual(P.parseChart(griHtml.replace(P.PUBLICATION_DATE, 'June 2026'), 'gri').code,
    'PUBLICATION_DATE_MISSING');
});
t('source statement removal refuses', function () {
  assert.strictEqual(P.parseChart(griHtml.replace('Pew Research Center analysis of external data', 'Publisher analysis'), 'gri').code,
    'SOURCE_STATEMENT_MISSING');
});
t('missing country row refuses', function () {
  var last = baseNames.length - 1;
  assert.strictEqual(P.parseChart(griHtml.replace(rowHtml('gri', baseNames[last], last), ''), 'gri').code,
    'COUNTRY_COUNT_CHANGED');
});
t('duplicate canonical identity refuses', function () {
  var x = griHtml.replace('Structural Country 001', 'United States');
  assert.strictEqual(P.parseChart(x, 'gri').code, 'COUNTRY_IDENTITY_DUPLICATE');
});
t('out-of-range published score refuses', function () {
  var old = rowHtml('gri', baseNames[0], 0);
  var x = griHtml.replace(old, rowHtml('gri', baseNames[0], 0, { score: 11, category: 'Very high' }));
  assert.strictEqual(P.parseChart(x, 'gri').code, 'SCORE_OUT_OF_RANGE');
});
t('axis-specific category mismatch refuses', function () {
  var old = rowHtml('shi', baseNames[0], 0);
  var x = shiHtml.replace(old, rowHtml('shi', baseNames[0], 0, { score: 8, category: 'Low' }));
  assert.strictEqual(P.parseChart(x, 'shi').code, 'CATEGORY_SCORE_MISMATCH');
});
t('pair refuses a region mismatch', function () {
  var altered = JSON.parse(JSON.stringify(shi));
  altered.rows[0].region = altered.rows[0].region === 'Americas' ? 'Europe' : 'Americas';
  assert.strictEqual(P.pair(gri, altered).code, 'AXIS_MEMBERSHIP_MISMATCH');
});
t('pair refuses an unreviewed identity mismatch', function () {
  var altered = JSON.parse(JSON.stringify(shi));
  altered.rows[0].country = 'Unreviewed identity';
  altered.rows[0].publishedCountry = 'Unreviewed identity';
  assert.strictEqual(P.pair(gri, altered).code, 'AXIS_MEMBERSHIP_MISMATCH');
});

P.stamp(paired, {
  gri: { sourceUrl: H.GRI_URL, sourceUpdatedAt: null, retrievedAt: '2026-08-17T20:00:00.000Z' },
  shi: { sourceUrl: H.SHI_URL, sourceUpdatedAt: null, retrievedAt: '2026-08-17T20:00:00.000Z' }
});
var observations = [];
paired.countries.forEach(function (country) {
  observations.push(country.gri, country.shi);
});
t('stamping produces 396 unique axis observations', function () {
  assert.strictEqual(observations.length, 396);
  assert.strictEqual(new Set(observations.map(function (x) { return x.observationId; })).size, 396);
});
t('each axis observation retains its own source', function () {
  paired.countries.forEach(function (country) {
    assert.strictEqual(country.gri.provenance.sourceUrl, H.GRI_URL);
    assert.strictEqual(country.shi.provenance.sourceUrl, H.SHI_URL);
    assert.strictEqual(country.gri.axis, 'gri');
    assert.strictEqual(country.shi.axis, 'shi');
    assert.notStrictEqual(country.gri.units, country.shi.units);
  });
});
t('no country record gains stress or activation fields', function () {
  paired.countries.forEach(function (x) {
    ['stress', 'diagnosis', 'pathway', 'activation', 'rank', 'compositeScore'].forEach(function (k) {
      assert.strictEqual(Object.prototype.hasOwnProperty.call(x, k), false);
    });
  });
});

var d = H.descriptor();
t('descriptor requires separate operator interpretation', function () {
  assert.ok(/never averaged or summed/.test(d.boundaries[0]));
  assert.ok(/not a current reading/.test(d.boundaries[1]));
  assert.ok(/different thresholds/.test(d.boundaries[2]));
  assert.ok(/not.*proven independent evidence systems/.test(d.boundaries[3]));
});
t('descriptor keeps historical correction out of the 2023 slice', function () {
  assert.ok(d.boundaries.some(function (x) { return /2017 GRI/.test(x) && /only 2023/.test(x); }));
});
t('annual indexes cannot enter the fast loop', function () {
  assert.ok(d.boundaries.some(function (x) { return /30-second loop/.test(x); }));
});
t('no brain Thing or pathway consumer is declared', function () {
  assert.deepStrictEqual([
    d.consumedBy.religionFinding, d.consumedBy.brainChannel,
    d.consumedBy.thingLayer, d.consumedBy.pathway
  ], [false, false, null, false]);
});
t('both official chart URLs are HTTPS Pew sources', function () {
  assert.match(H.GRI_URL, /^https:\/\/www\.pewresearch\.org\/chart\//);
  assert.match(H.SHI_URL, /^https:\/\/www\.pewresearch\.org\/chart\//);
});
t('shared router exposes exactly six implemented authorities', function () {
  assert.strictEqual(R.SUPPORTED.join(','),
    'gallup_religious_attendance,pew_global_restrictions,scotus_docket,us_courts_caseload,uscirf_annual_report,wjp_rol_index');
  assert.strictEqual(R.PROVIDERS.pew_global_restrictions, H);
});

var page = fs.readFileSync(path.join(__dirname, '..', 'authority-portal.html'), 'utf8');
t('portal has a dedicated paired-axis renderer', function () {
  assert.ok(page.indexOf('function renderPewRestrictions(d)') >= 0);
  assert.ok(page.indexOf("d.viewKind === 'pew_global_restrictions'") >= 0);
  assert.ok(/authority=pew_global_restrictions/.test(page));
  assert.ok(/No composite restriction score/.test(page));
});
var hs = fs.readFileSync(path.join(__dirname, '..', 'handlers', 'authority-pew-restrictions.js'), 'utf8');
var ps = fs.readFileSync(path.join(__dirname, '..', 'lib', 'pew-global-restrictions.js'), 'utf8');
t('implementation imports no brain or Thing code', function () {
  [hs, ps].forEach(function (s) {
    assert.strictEqual(/require\([^)]*(brain-v2|thing-formulas|brain-signals|thing1|thing2)/i.test(s), false);
  });
});
t('implementation exposes no promotion or actuation verb', function () {
  assert.strictEqual(/\b(promote|activate|consolidate|efferent)\b/i.test(hs + ps), false);
});

if (process.exitCode) process.exit(1);
console.log(passed + '/' + passed + ' passed');
