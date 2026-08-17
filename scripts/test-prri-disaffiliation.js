#!/usr/bin/env node
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var PRRI = require('../lib/prri-disaffiliation.js');
var handler = require('../handlers/authority-prri.js');
var router = require('../handlers/authority-evidence.js');

var passed = 0;
function test(name, fn) {
  try { fn(); passed++; }
  catch (e) { console.error('FAIL ' + name + '\n' + (e && e.stack || e)); process.exit(1); }
}

var base = '<!doctype html><html><head><title>2025 PRRI Census of American Religion</title>' +
  '<style>.fake{content:"In 2025, 99% of Americans identify as having no religious tradition"}</style></head><body>' +
  '<h1>2025 PRRI Census of American Religion</h1><p>April 15, 2026</p>' +
  '<p>With over 40,000 respondents, the 2025 PRRI Census of American Religion provides a comprehensive profile.</p>' +
  '<p>After years of consistent growth, the percentage of religiously unaffiliated in America has plateaued: ' +
  'In 2025, 28% of Americans identify as having no religious tradition, similar to the previous year’s rate.</p>' +
  '<p>The share attending religious services at least weekly has consistently declined, from 31% in 2013 to 26% in 2025.</p>' +
  '<p>In contrast, the share of Americans who seldom or never attend religious services has increased substantially, ' +
  'rising from 42% in 2013 to 53% in 2025.</p>' +
  '<p>The percentage of young Americans who are religiously unaffiliated has remained unchanged in the past year, ' +
  'shifting from 38% in 2024 to 39% in 2025.</p>' +
  '<p>The percentage of young men (18-29) who identify as religiously unaffiliated has largely stayed the same since 2013, ' +
  'with 35% identifying as a “none” in 2013 and 35% identifying as a “none” in 2025.</p>' +
  '<p>In contrast, young women have steadily grown less likely to identify with a religious tradition since 2013, ' +
  'when 29% identified as religiously unaffiliated. In 2024, that figure grew to 40%, and in 2025, it increased to 43%.</p>' +
  '<script>var fake="In 2025, 77% of Americans identify as having no religious tradition";</script>' +
  '<div>' + 'official publication context '.repeat(30) + '</div></body></html>';

var parsed = PRRI.parse(base);

test('reviewed page parses', function () { assert.strictEqual(parsed.ok, true); });
test('edition preserved', function () { assert.strictEqual(parsed.edition, 2025); });
test('publication date preserved', function () { assert.strictEqual(parsed.publishedDate, 'April 15, 2026'); });
test('sample floor parsed', function () { assert.strictEqual(parsed.sampleFloor, 40000); });
test('six series emitted', function () { assert.strictEqual(parsed.series.length, 6); });
test('twelve observations emitted', function () {
  assert.strictEqual(parsed.series.reduce(function (n, s) { return n + s.observations.length; }, 0), 12);
});
test('national value is 28', function () { assert.strictEqual(parsed.series[0].observations[0].value, 28); });
test('weekly comparison is 31 to 26', function () {
  assert.deepStrictEqual(parsed.series[1].observations.map(function (x) { return [x.referenceYear, x.value]; }), [[2013,31],[2025,26]]);
});
test('seldom comparison is 42 to 53', function () {
  assert.deepStrictEqual(parsed.series[2].observations.map(function (x) { return [x.referenceYear, x.value]; }), [[2013,42],[2025,53]]);
});
test('young adults comparison is 38 to 39', function () {
  assert.deepStrictEqual(parsed.series[3].observations.map(function (x) { return [x.referenceYear, x.value]; }), [[2024,38],[2025,39]]);
});
test('young men comparison is 35 to 35', function () {
  assert.deepStrictEqual(parsed.series[4].observations.map(function (x) { return [x.referenceYear, x.value]; }), [[2013,35],[2025,35]]);
});
test('young women preserve all three published points', function () {
  assert.deepStrictEqual(parsed.series[5].observations.map(function (x) { return [x.referenceYear, x.value]; }), [[2013,29],[2024,40],[2025,43]]);
});
test('source hash is present', function () { assert.match(parsed.sourceSha256, /^[0-9a-f]{64}$/); });
test('source bytes are exact', function () { assert.strictEqual(parsed.sourceBytes, Buffer.byteLength(base, 'utf8')); });
test('units are cohort-specific percentages', function () {
  parsed.series.forEach(function (s) { s.observations.forEach(function (o) {
    assert.strictEqual(o.units, 'percent of U.S. adults in the stated cohort');
  }); });
});
test('script and style fake values are ignored', function () {
  assert.strictEqual(parsed.series[0].observations[0].value, 28);
});

function codeFor(html) { return PRRI.parse(html).code; }
test('small response refuses', function () { assert.strictEqual(codeFor('<html>no</html>'), 'NOT_A_PRRI_REPORT_PAGE'); });
test('wrong edition refuses', function () {
  assert.strictEqual(codeFor(base.replace(/2025 PRRI Census of American Religion/g, '2024 PRRI Census of American Religion')), 'EDITION_MARKER_MISSING');
});
test('missing published date refuses', function () {
  assert.strictEqual(codeFor(base.replace('April 15, 2026', 'April 14, 2026')), 'PUBLISHED_DATE_MISSING');
});
test('sample below reviewed floor refuses', function () {
  assert.strictEqual(codeFor(base.replace('over 40,000 respondents', 'over 4,000 respondents')), 'SAMPLE_SIZE_INVALID');
});
test('missing sample statement refuses', function () {
  assert.strictEqual(codeFor(base.replace('With over 40,000 respondents', 'The report has many respondents')), 'SAMPLE_SIZE_MISSING_OR_AMBIGUOUS');
});
test('duplicate sample statement refuses', function () {
  assert.strictEqual(codeFor(base.replace('</body>', '<p>With over 40,000 respondents</p></body>')), 'SAMPLE_SIZE_MISSING_OR_AMBIGUOUS');
});
test('missing national statement refuses', function () {
  assert.strictEqual(codeFor(base.replace('In 2025, 28% of Americans identify as having no religious tradition', 'In 2025 the report describes unaffiliated adults')), 'NATIONAL_UNAFFILIATED_MISSING_OR_AMBIGUOUS');
});
test('duplicate national statement refuses', function () {
  var sentence = 'In 2025, 28% of Americans identify as having no religious tradition';
  assert.strictEqual(codeFor(base.replace('</body>', '<p>' + sentence + '</p></body>')), 'NATIONAL_UNAFFILIATED_MISSING_OR_AMBIGUOUS');
});
test('out-of-range national percentage refuses', function () {
  assert.strictEqual(codeFor(base.replace('In 2025, 28%', 'In 2025, 128%')), 'PUBLISHED_PERCENT_INVALID');
});
test('missing weekly statement refuses', function () {
  assert.strictEqual(codeFor(base.replace('has consistently declined, from 31% in 2013 to 26% in 2025', 'was discussed by the publisher')), 'WEEKLY_ATTENDANCE_MISSING_OR_AMBIGUOUS');
});
test('missing seldom statement refuses', function () {
  assert.strictEqual(codeFor(base.replace('has increased substantially, rising from 42% in 2013 to 53% in 2025', 'was discussed by the publisher')), 'SELDOM_NEVER_MISSING_OR_AMBIGUOUS');
});
test('missing young-adult statement refuses', function () {
  assert.strictEqual(codeFor(base.replace('has remained unchanged in the past year, shifting from 38% in 2024 to 39% in 2025', 'was discussed by the publisher')), 'YOUNG_ADULT_MISSING_OR_AMBIGUOUS');
});
test('missing young-men statement refuses', function () {
  assert.strictEqual(codeFor(base.replace('with 35% identifying as a “none” in 2013 and 35% identifying as a “none” in 2025', 'with values discussed elsewhere')), 'YOUNG_MEN_MISSING_OR_AMBIGUOUS');
});
test('missing young-women statement refuses', function () {
  assert.strictEqual(codeFor(base.replace('when 29% identified as religiously unaffiliated. In 2024, that figure grew to 40%, and in 2025, it increased to 43%', 'with values discussed elsewhere')), 'YOUNG_WOMEN_MISSING_OR_AMBIGUOUS');
});

test('stamping gives every observation an identity and provenance', function () {
  var copy = PRRI.parse(base);
  PRRI.stampSeries(copy, { sourceUrl: handler.SOURCE_URL, sourceUpdatedAt: null, retrievedAt: '2026-08-17T00:00:00.000Z' });
  var ids = {};
  copy.series.forEach(function (s) { s.observations.forEach(function (o) {
    assert.match(o.observationId, /^[0-9a-f]{64}$/);
    assert.strictEqual(o.provenance.sourceUrl, handler.SOURCE_URL);
    assert.strictEqual(o.provenance.retrievedAt, '2026-08-17T00:00:00.000Z');
    assert.ok(!ids[o.observationId]);
    ids[o.observationId] = true;
  }); });
  assert.strictEqual(Object.keys(ids).length, 12);
});
test('source URL is official PRRI HTTPS', function () {
  assert.match(handler.SOURCE_URL, /^https:\/\/prri\.org\//);
});
test('descriptor keeps evidence observational', function () {
  var d = handler.descriptor();
  assert.strictEqual(d.consumedBy.religionFinding, false);
  assert.strictEqual(d.consumedBy.brainChannel, false);
  assert.strictEqual(d.consumedBy.thingLayer, null);
  assert.strictEqual(d.consumedBy.pathway, false);
  assert.ok(d.boundaries.some(function (x) { return /not the United States census/i.test(x); }));
  assert.ok(d.boundaries.some(function (x) { return /No annual survey estimate may drive/i.test(x); }));
});
test('shared router exposes exact authority id', function () {
  assert.strictEqual(router.PROVIDERS.prri_disaffiliation_trends, handler);
  assert.ok(router.SUPPORTED.indexOf('prri_disaffiliation_trends') >= 0);
});
test('portal has a dedicated renderer and no score field', function () {
  var portal = fs.readFileSync(path.join(__dirname, '..', 'authority-portal.html'), 'utf8');
  assert.ok(portal.indexOf("function renderPrri(d)") >= 0);
  assert.ok(portal.indexOf("d.viewKind === 'prri_disaffiliation'") >= 0);
  assert.ok(portal.indexOf('Do not compare unlike cohorts') >= 0);
  assert.strictEqual(parsed.series.some(function (s) { return Object.prototype.hasOwnProperty.call(s, 'score'); }), false);
});

console.log(passed + '/' + passed + ' passed');
