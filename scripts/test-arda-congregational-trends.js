#!/usr/bin/env node
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var A = require('../lib/arda-congregational-trends.js');
var H = require('../handlers/authority-arda.js');
var R = require('../handlers/authority-evidence.js');

var passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name); }
  catch (e) { console.error('FAIL ' + name + ': ' + e.message); process.exitCode = 1; }
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmt(n) { return Number(n).toLocaleString('en-US'); }

function bodyRows() {
  var rows = [];
  for (var i = 0; i < 372; i++) {
    var congregations = 959 + (i < 162 ? 1 : 0);
    var hasAdherents = i < 217;
    var adherents = hasAdherents ? 742968 + (i < 32 ? 1 : 0) : null;
    var rate = hasAdherents ? (adherents / 331449281 * 1000).toFixed(2) : '';
    rows.push('<tr><td><a href="https://www.thearda.com/us-religion/group-profiles/groups?D=' + (i + 1) + '">Structural Body ' +
      String(i + 1).padStart(3, '0') + '</a></td><td>' + esc(A.TRADITIONS[i % A.TRADITIONS.length].name) +
      '</td><td>Structural Family</td><td>' + fmt(congregations) + '</td><td>' +
      (adherents === null ? '' : fmt(adherents)) + '</td><td>' + rate + '</td></tr>');
  }
  return rows;
}

function chartScript(overrides) {
  overrides = overrides || {};
  var years = overrides.years || A.YEARS;
  var data = years.map(function (year, yi) {
    var row = { YEAR: String(year) };
    A.TRADITIONS.forEach(function (x, ti) { row[x.field] = yi + ti / 10; });
    return row;
  });
  if (overrides.outOfRange) data[0].R1 = 101;
  var series = A.TRADITIONS.map(function (x, i) {
    var name = overrides.renameField === x.field ? 'Changed Tradition' : x.name;
    return 'var series' + i + '={ name : ' + JSON.stringify(name) + ', valueYField : "' + x.field + '" };';
  }).join('\n');
  return '<script>var chartTitle="Religious Traditions (1980 - 2020), Percent of Population";' +
    'structural_data = ' + JSON.stringify(data) + ';' + series + '</script>';
}

function reportFixture(options) {
  options = options || {};
  var headers = options.headers || ['Religious Bodies', 'Tradition', 'Family', 'Congregations', 'Adherents', 'Adherence Rate'];
  var rows = bodyRows();
  if (options.dropLast) rows.pop();
  if (options.duplicate) rows[1] = rows[1].replace('Structural Body 002', 'Structural Body 001');
  if (options.badUrl) rows[0] = rows[0].replace('https://www.thearda.com/us-religion/group-profiles/groups?D=1', 'https://example.com/not-arda');
  if (options.splitMissingness) rows[217] = rows[217].replace('</td><td></td></tr>', '</td><td>1.00</td></tr>');
  if (options.badRate) rows[0] = rows[0].replace(/<td>2\.24<\/td><\/tr>$/, '<td>99.99</td></tr>');
  return '<!doctype html><html><body><h1>U.S. Membership Report (2020)</h1>' +
    '<p>Exact definitions of "congregations" and "adherents" vary by religious body</p>' +
    '<table id="RCMS0"><thead><tr>' + headers.map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') +
    '</tr></thead><tbody>' + rows.join('') + '</tbody>' +
    '<tfoot><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>356,910.0</td><td>161,224,088.0</td><td>&nbsp;</td></tr></tfoot></table>' +
    '<p>The population of the United States was 331,449,281 in 2020. The adherent totals of the religious groups listed above ' +
    '(161,224,088) included 48.6% of the total population in 2020.</p>' +
    chartScript(options.chart) + new Array(300).join('<p>published structural report context</p>') + '</body></html>';
}

function archiveFixture(options) {
  options = options || {};
  var total = options.congregations || '356,642';
  var augmentation = options.noAugmentation ? '' :
    '<p>In January 2024, the ARDA added 21 religious tradition (RELTRAD) variables to this dataset.</p>';
  return '<!doctype html><html><body><h1>U.S. Religion Census - Religious Congregations and Membership Study, 2020 (State File)</h1>' +
    '<p>10.17605/OSF.IO/6PGRZ</p><p>The 372 groups reported a total of ' + total +
    ' congregations with 161,224,088 adherents, comprising 48.6 percent of the total U.S. population of 331,449,281.</p>' +
    augmentation + new Array(250).join('<p>published archive metadata context</p>') + '</body></html>';
}

var reportHtml = reportFixture();
var archiveHtml = archiveFixture();
var report = A.parseReport(reportHtml);
var archive = A.parseArchiveSummary(archiveHtml);

t('structural public report parses 372 bodies', function () {
  assert.strictEqual(report.ok, true);
  assert.strictEqual(report.bodies.length, 372);
  assert.strictEqual(new Set(report.bodies.map(function (x) { return x.body; })).size, 372);
});
t('coverage remains 217 with adherents and 155 congregation-only', function () {
  assert.deepStrictEqual([report.bodyCounts.withAdherents, report.bodyCounts.congregationsOnly], [217, 155]);
});
t('live tfoot summary row is excluded from body observations', function () {
  assert.strictEqual(report.bodies.length, 372);
  assert.strictEqual(report.bodies.some(function (x) { return x.body === ''; }), false);
});
t('displayed rows reproduce the two measured sums', function () {
  assert.strictEqual(report.bodyCounts.displayedCongregationSum, 356910);
  assert.strictEqual(report.bodyCounts.displayedAdherentSum, 161224088);
});
t('chart retains 13 traditions and five exact decennial years', function () {
  assert.deepStrictEqual(report.traditionYears, [1980, 1990, 2000, 2010, 2020]);
  assert.strictEqual(report.traditionObservations.length, 65);
  assert.strictEqual(new Set(report.traditionObservations.map(function (x) { return x.tradition; })).size, 13);
});
t('archive summary parses its distinct congregation total', function () {
  assert.strictEqual(archive.ok, true);
  assert.strictEqual(archive.totals.congregations, 356642);
  assert.strictEqual(archive.totals.adherents, 161224088);
});

var stamped = A.stamp(report, archive, {
  report: { sourceUrl: H.REPORT_URL, sourceUpdatedAt: null, retrievedAt: '2026-08-17T22:00:00.000Z' }
});
var observations = [];
stamped.report.traditionObservations.forEach(function (x) { observations.push(x.observation); });
stamped.report.bodies.forEach(function (x) {
  Object.keys(x.observations).forEach(function (k) { if (x.observations[k]) observations.push(x.observations[k]); });
});
t('871 source observations are unique', function () {
  assert.strictEqual(observations.length, 871);
  assert.strictEqual(new Set(observations.map(function (x) { return x.observationId; })).size, 871);
});
t('every observation keeps raw/transformed identity and provenance', function () {
  observations.forEach(function (x) {
    assert.strictEqual(x.rawValue, x.transformedValue);
    assert.strictEqual(x.rawUnits, x.transformedUnits);
    assert.match(x.transformation, /^identity:/);
    assert.strictEqual(x.provenance.sourceUrl, H.REPORT_URL);
    assert.strictEqual(x.provenance.retrievedAt, '2026-08-17T22:00:00.000Z');
    assert.match(x.provenance.sourceSha256, /^[0-9a-f]{64}$/);
  });
});
t('publisher disagreement is preserved rather than reconciled by guess', function () {
  assert.strictEqual(stamped.reconciliation.congregationDifference, 268);
  assert.strictEqual(stamped.reconciliation.adherentDifference, 0);
  assert.strictEqual(stamped.reconciliation.resolved, false);
});
t('missing adherents remain null, not zero observations', function () {
  var row = stamped.report.bodies[217];
  assert.strictEqual(row.adherents, null);
  assert.strictEqual(row.adherenceRatePer1000, null);
  assert.strictEqual(row.observations.adherents, null);
  assert.strictEqual(row.observations.adherenceRate, null);
});

t('changed header refuses', function () {
  assert.strictEqual(A.parseReport(reportFixture({ headers: ['Bodies', 'Tradition', 'Family', 'Congregations', 'Adherents', 'Adherence Rate'] })).code,
    'BODY_HEADERS_CHANGED');
});
t('missing body refuses', function () {
  assert.strictEqual(A.parseReport(reportFixture({ dropLast: true })).code, 'BODY_COUNT_CHANGED');
});
t('duplicate body identity refuses', function () {
  assert.strictEqual(A.parseReport(reportFixture({ duplicate: true })).code, 'BODY_IDENTITY_DUPLICATE');
});
t('non-ARDA profile URL refuses', function () {
  assert.strictEqual(A.parseReport(reportFixture({ badUrl: true })).code, 'BODY_ROW_INVALID');
});
t('split missingness refuses', function () {
  assert.strictEqual(A.parseReport(reportFixture({ splitMissingness: true })).code, 'BODY_MISSINGNESS_SPLIT');
});
t('unreproducible published rate refuses', function () {
  var x = reportFixture().replace('<td>2.24</td></tr>', '<td>99.99</td></tr>');
  assert.strictEqual(A.parseReport(x).code, 'ADHERENCE_RATE_NOT_REPRODUCIBLE');
});
t('changed chart years refuse', function () {
  assert.strictEqual(A.parseReport(reportFixture({ chart: { years: ['1980', '1990', '2000', '2010', '2021'] } })).code,
    'TRADITION_YEARS_CHANGED');
});
t('changed tradition identity refuses', function () {
  assert.strictEqual(A.parseReport(reportFixture({ chart: { renameField: 'R7' } })).code, 'TRADITION_IDENTITY_CHANGED');
});
t('out-of-range tradition share refuses', function () {
  assert.strictEqual(A.parseReport(reportFixture({ chart: { outOfRange: true } })).code, 'TRADITION_VALUE_OUT_OF_RANGE');
});
t('changed archive total refuses', function () {
  assert.strictEqual(A.parseArchiveSummary(archiveFixture({ congregations: '356,643' })).code, 'ARCHIVE_TOTALS_CHANGED');
});
t('missing archive augmentation marker refuses', function () {
  assert.strictEqual(A.parseArchiveSummary(archiveFixture({ noAugmentation: true })).code, 'ARCHIVE_MARKER_MISSING');
});

var d = H.descriptor();
t('descriptor refuses attendance and resilience interpretations', function () {
  assert.ok(d.boundaries.some(function (x) { return /not attendance.*resilience/.test(x); }));
  assert.ok(d.boundaries.some(function (x) { return /268 difference is unresolved/.test(x); }));
});
t('descriptor names ARDA and ASARB as different roles, not independent evidence', function () {
  assert.strictEqual(d.publisher.indexOf('ARDA') >= 0, true);
  assert.strictEqual(d.originalCollector.indexOf('ASARB') >= 0, true);
  assert.ok(d.boundaries.some(function (x) { return /do not establish independent corroboration/.test(x); }));
});
t('no brain Thing or pathway consumer is declared', function () {
  assert.deepStrictEqual([d.consumedBy.religionFinding, d.consumedBy.brainChannel, d.consumedBy.thingLayer, d.consumedBy.pathway],
    [false, false, null, false]);
});
t('public report and archive URLs are HTTPS ARDA sources', function () {
  assert.match(H.REPORT_URL, /^https:\/\/www\.thearda\.com\//);
  assert.match(H.ARCHIVE_URL, /^https:\/\/thearda\.com\//);
});
t('shared router exposes exactly eight implemented authorities', function () {
  assert.strictEqual(R.SUPPORTED.join(','),
    'arda_congregational_trends,ats_seminary_enrollment,gallup_religious_attendance,pew_global_restrictions,scotus_docket,us_courts_caseload,uscirf_annual_report,wjp_rol_index');
  assert.strictEqual(R.PROVIDERS.arda_congregational_trends, H);
});

var page = fs.readFileSync(path.join(__dirname, '..', 'authority-portal.html'), 'utf8');
t('portal has a dedicated ARDA renderer and source disagreement warning', function () {
  assert.ok(page.indexOf('function renderArdaTrends(d)') >= 0);
  assert.ok(page.indexOf("d.viewKind === 'arda_congregational_trends'") >= 0);
  assert.ok(/authority=arda_congregational_trends/.test(page));
  assert.ok(/unresolved source difference/i.test(page));
});

var hs = fs.readFileSync(path.join(__dirname, '..', 'handlers', 'authority-arda.js'), 'utf8');
var ps = fs.readFileSync(path.join(__dirname, '..', 'lib', 'arda-congregational-trends.js'), 'utf8');
t('implementation imports no brain or Thing code', function () {
  [hs, ps].forEach(function (s) {
    assert.strictEqual(/require\([^)]*(brain-v2|thing-formulas|brain-signals|thing1|thing2)/i.test(s), false);
  });
});
t('payload vocabulary creates no score rank stress diagnosis or pathway', function () {
  JSON.stringify(stamped.report).split(/[{}:,\[\]"]+/).forEach(function (token) {
    assert.strictEqual(/^(score|rank|stress|diagnosis|pathway|activation)$/i.test(token.trim()), false);
  });
});

if (process.exitCode) process.exit(1);
console.log(passed + '/' + passed + ' passed');
