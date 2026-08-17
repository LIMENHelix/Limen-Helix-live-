#!/usr/bin/env node
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var GALLUP = require('../lib/gallup-religious-attendance.js');
var handler = require('../handlers/authority-gallup.js');
var router = require('../handlers/authority-evidence.js');

var passed = 0;
function test(name, fn) {
  try { fn(); passed++; }
  catch (e) { console.error('FAIL ' + name + '\n' + (e && e.stack || e)); process.exit(1); }
}

var base = '<!doctype html><html><head><title>Church Attendance Has Declined in Most U.S. Religious Groups</title>' +
  '<style>.fake{content:"currently at 99%"}</style></head><body>' +
  '<h1>Church Attendance Has Declined in Most U.S. Religious Groups</h1><p>March 25, 2024</p>' +
  '<p>Three in 10 Americans say they attend religious services every week (21%) or almost every week (9%), ' +
  'while 11% report attending about once a month and 56% seldom (25%) or never (31%) attend.</p>' +
  '<p>The combined 2021-2023 data comprise interviews with more than 32,000 U.S. adults and at least 200 respondents ' +
  'in each religion, except for Orthodox churches and Hinduism.</p>' +
  '<p>Two decades ago, an average of 42% of U.S. adults attended religious services every week or nearly every week. ' +
  'A decade ago, the figure fell to 38%, and it is currently at 30%.</p>' +
  '<p>This decline is largely driven by the increase in the percentage of Americans with no religious affiliation -- ' +
  '9% in 2000-2003 versus 21% in 2021-2023 -- almost all of whom do not attend services regularly.</p>' +
  '<p>Specifically, more 18- to 29-year-olds, 35%, say they have no religious preference than identify with any specific faith. ' +
  'Additionally, young adults, both those with and without a religious preference, are much less likely to attend religious services -- ' +
  '22% attend regularly, eight points below the national average.</p>' +
  '<script>var fake="Two decades ago, an average of 99% of U.S. adults attended religious services every week or nearly every week. ' +
  'A decade ago, the figure fell to 99%, and it is currently at 99%";</script>' +
  '<div>' + 'official Gallup report context '.repeat(30) + '</div></body></html>';

var parsed = GALLUP.parse(base);

test('reviewed page parses', function () { assert.strictEqual(parsed.ok, true); });
test('publication date preserved', function () { assert.strictEqual(parsed.publishedDate, 'March 25, 2024'); });
test('current window preserved', function () { assert.strictEqual(parsed.currentWindow, '2021-2023'); });
test('sample floor parsed', function () { assert.strictEqual(parsed.sampleFloor, 32000); });
test('subgroup floor parsed', function () { assert.strictEqual(parsed.subgroupFloor, 200); });
test('nine series emitted', function () { assert.strictEqual(parsed.series.length, 9); });
test('thirteen observations emitted', function () {
  assert.strictEqual(parsed.series.reduce(function (n, s) { return n + s.observations.length; }, 0), 13);
});
test('frequency values preserve five categories', function () {
  assert.deepStrictEqual(parsed.series.slice(0,5).map(function (s) { return s.observations[0].value; }), [21,9,11,25,31]);
});
test('regular trend preserves three aggregate windows', function () {
  assert.deepStrictEqual(parsed.series[5].observations.map(function (o) { return [o.referenceWindow,o.value]; }),
    [['2000-2003',42],['2011-2013',38],['2021-2023',30]]);
});
test('unaffiliated trend preserves both windows', function () {
  assert.deepStrictEqual(parsed.series[6].observations.map(function (o) { return [o.referenceWindow,o.value]; }),
    [['2000-2003',9],['2021-2023',21]]);
});
test('young no-preference value preserved', function () { assert.strictEqual(parsed.series[7].observations[0].value, 35); });
test('young regular-attendance value preserved', function () { assert.strictEqual(parsed.series[8].observations[0].value, 22); });
test('source hash present', function () { assert.match(parsed.sourceSha256, /^[0-9a-f]{64}$/); });
test('source bytes exact', function () { assert.strictEqual(parsed.sourceBytes, Buffer.byteLength(base, 'utf8')); });
test('script and style fake values ignored', function () { assert.strictEqual(parsed.series[5].observations[2].value, 30); });
test('all units retain cohort scope', function () {
  parsed.series.forEach(function (s) { s.observations.forEach(function (o) {
    assert.strictEqual(o.units, 'percent of U.S. adults in the stated cohort');
  }); });
});

function codeFor(html) { return GALLUP.parse(html).code; }
test('small response refuses', function () { assert.strictEqual(codeFor('<html>no</html>'), 'NOT_A_GALLUP_REPORT_PAGE'); });
test('wrong report refuses', function () {
  assert.strictEqual(codeFor(base.replace(/Church Attendance Has Declined in Most U\.S\. Religious Groups/g, 'A different Gallup report')), 'REPORT_MARKER_MISSING');
});
test('wrong publication date refuses', function () {
  assert.strictEqual(codeFor(base.replace('March 25, 2024', 'March 24, 2024')), 'PUBLISHED_DATE_MISSING');
});
test('missing sample statement refuses', function () {
  assert.strictEqual(codeFor(base.replace('The combined 2021-2023 data comprise interviews with more than 32,000 U.S. adults and at least 200 respondents in each religion', 'Gallup combined several surveys')),
    'SAMPLE_STATEMENT_MISSING_OR_AMBIGUOUS');
});
test('low sample floor refuses', function () {
  assert.strictEqual(codeFor(base.replace('more than 32,000 U.S. adults', 'more than 3,200 U.S. adults')), 'SAMPLE_STATEMENT_INVALID');
});
test('duplicate sample statement refuses', function () {
  assert.strictEqual(codeFor(base.replace('</body>', '<p>The combined 2021-2023 data comprise interviews with more than 32,000 U.S. adults and at least 200 respondents in each religion.</p></body>')),
    'SAMPLE_STATEMENT_MISSING_OR_AMBIGUOUS');
});
test('missing frequency distribution refuses', function () {
  assert.strictEqual(codeFor(base.replace('attend religious services every week (21%)', 'report several attendance frequencies')),
    'FREQUENCY_DISTRIBUTION_MISSING_OR_AMBIGUOUS');
});
test('duplicate frequency distribution refuses', function () {
  var sentence = 'attend religious services every week (21%) or almost every week (9%), while 11% report attending about once a month and 56% seldom (25%) or never (31%) attend';
  assert.strictEqual(codeFor(base.replace('</body>', '<p>' + sentence + '</p></body>')), 'FREQUENCY_DISTRIBUTION_MISSING_OR_AMBIGUOUS');
});
test('missing regular trend refuses', function () {
  assert.strictEqual(codeFor(base.replace('Two decades ago, an average of 42%', 'Two decades ago the report discussed attendance')),
    'REGULAR_TREND_MISSING_OR_AMBIGUOUS');
});
test('missing unaffiliated trend refuses', function () {
  assert.strictEqual(codeFor(base.replace('Americans with no religious affiliation -- 9%', 'Americans without an affiliation changed over time')),
    'UNAFFILIATED_TREND_MISSING_OR_AMBIGUOUS');
});
test('missing young context refuses', function () {
  assert.strictEqual(codeFor(base.replace('more 18- to 29-year-olds, 35%', 'more young adults')),
    'YOUNG_ADULT_CONTEXT_MISSING_OR_AMBIGUOUS');
});
test('out-of-range value refuses', function () {
  assert.strictEqual(codeFor(base.replace('every week (21%)', 'every week (121%)')), 'PUBLISHED_PERCENT_INVALID');
});
test('regular arithmetic cross-check refuses', function () {
  assert.strictEqual(codeFor(base.replace('currently at 30%', 'currently at 31%')), 'REGULAR_ATTENDANCE_CROSSCHECK_FAILED');
});
test('seldom arithmetic cross-check refuses', function () {
  assert.strictEqual(codeFor(base.replace('56% seldom (25%) or never (31%)', '57% seldom (25%) or never (31%)')), 'SELDOM_NEVER_CROSSCHECK_FAILED');
});

test('stamping gives every observation unique identity and provenance', function () {
  var copy = GALLUP.parse(base);
  GALLUP.stampSeries(copy, { sourceUrl: handler.SOURCE_URL, sourceUpdatedAt: null, retrievedAt: '2026-08-17T00:00:00.000Z' });
  var ids = {};
  copy.series.forEach(function (s) { s.observations.forEach(function (o) {
    assert.match(o.observationId, /^[0-9a-f]{64}$/);
    assert.strictEqual(o.provenance.sourceUrl, handler.SOURCE_URL);
    assert.strictEqual(o.provenance.retrievedAt, '2026-08-17T00:00:00.000Z');
    assert.ok(!ids[o.observationId]);
    ids[o.observationId] = true;
  }); });
  assert.strictEqual(Object.keys(ids).length, 13);
});
test('source URL is official Gallup HTTPS', function () {
  assert.match(handler.SOURCE_URL, /^https:\/\/news\.gallup\.com\//);
});
test('descriptor keeps observations operator-only', function () {
  var d = handler.descriptor();
  assert.strictEqual(d.consumedBy.religionFinding, false);
  assert.strictEqual(d.consumedBy.brainChannel, false);
  assert.strictEqual(d.consumedBy.thingLayer, null);
  assert.strictEqual(d.consumedBy.pathway, false);
  assert.ok(d.boundaries.some(function (x) { return /not turnstile counts/i.test(x); }));
  assert.ok(d.boundaries.some(function (x) { return /No survey estimate may drive/i.test(x); }));
});
test('shared router exposes exact authority id', function () {
  assert.strictEqual(router.PROVIDERS.gallup_religious_attendance, handler);
  assert.ok(router.SUPPORTED.indexOf('gallup_religious_attendance') >= 0);
});
test('portal has dedicated renderer and cohort warning', function () {
  var portal = fs.readFileSync(path.join(__dirname, '..', 'authority-portal.html'), 'utf8');
  assert.ok(portal.indexOf('function renderGallup(d)') >= 0);
  assert.ok(portal.indexOf("d.viewKind === 'gallup_religious_attendance'") >= 0);
  assert.ok(portal.indexOf('retains Gallup') >= 0);
});
test('no series carries a score field', function () {
  assert.strictEqual(parsed.series.some(function (s) { return Object.prototype.hasOwnProperty.call(s, 'score'); }), false);
});

console.log(passed + '/' + passed + ' passed');
