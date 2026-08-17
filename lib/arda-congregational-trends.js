/**
 * Refusing reader for ARDA's public 2020 U.S. membership report and its
 * companion archive summary. No archive download agreement is accepted here.
 */
'use strict';

var crypto = require('crypto');

var PARSER_VERSION = 'arda-congregational-trends/1.0.0';
var TRANSFORM_VERSION = 'official-html:published-values->identity-observations/1.0.0';
var REPORT_YEAR = 2020;
var YEARS = ['1980', '1990', '2000', '2010', '2020'];
var EXPECTED_BODY_COUNT = 372;
var EXPECTED_WITH_ADHERENTS = 217;
var EXPECTED_CONGREGATIONS_ONLY = 155;

var TRADITIONS = [
  { field: 'R1', name: 'Evangelical Protestant' },
  { field: 'R2', name: 'Mainline Protestant' },
  { field: 'R6', name: 'Black Protestant' },
  { field: 'R3', name: 'Catholic' },
  { field: 'R5', name: 'Orthodox' },
  { field: 'R4', name: 'Other' },
  { field: 'R7', name: 'Islam' },
  { field: 'R8', name: 'Judaism' },
  { field: 'R9', name: 'Hinduism' },
  { field: 'R10', name: 'Buddhism' },
  { field: 'R11', name: "Jehovah's Witnesses" },
  { field: 'R12', name: 'Latter-day Saints' },
  { field: 'R13', name: 'Other Christians' }
];

function refusal(code, detail, extra) {
  var out = { ok: false, code: code, detail: detail };
  Object.keys(extra || {}).forEach(function (k) { out[k] = extra[k]; });
  return out;
}

function decodeEntities(s) {
  var named = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”'
  };
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, function (_, n) { return String.fromCodePoint(parseInt(n, 16)); })
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCodePoint(parseInt(n, 10)); })
    .replace(/&([a-z]+);/gi, function (m, n) {
      return Object.prototype.hasOwnProperty.call(named, n.toLowerCase()) ? named[n.toLowerCase()] : m;
    });
}

function textFromHtml(html) {
  return decodeEntities(String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(?:br|\/p|\/div|\/li|\/h\d|\/a|\/td|\/th|\/tr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function cellText(s) {
  return textFromHtml(s).replace(/\s+/g, ' ').trim();
}

function numberFromPublished(s, integer) {
  var x = String(s == null ? '' : s).trim();
  if (!x) return null;
  if (!(integer ? /^\d{1,3}(?:,\d{3})*$|^\d+$/ : /^\d+(?:\.\d+)?$/).test(x)) return NaN;
  return Number(x.replace(/,/g, ''));
}

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

function extractTable(html) {
  var m = String(html).match(/<table\b[^>]*\bid=["']RCMS0["'][^>]*>[\s\S]*?<\/table>/i);
  return m ? m[0] : null;
}

function extractCells(rowHtml) {
  var cells = [], m;
  var re = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
  while ((m = re.exec(rowHtml))) cells.push({ html: m[1], text: cellText(m[1]) });
  return cells;
}

function groupUrl(cellHtml) {
  var m = String(cellHtml).match(/<a\b[^>]*\bhref=["']([^"']+)["']/i);
  if (!m) return null;
  var url = decodeEntities(m[1]);
  if (/^\/us-religion\/group-profiles\/groups\?D=\d+$/.test(url)) return 'https://www.thearda.com' + url;
  if (/^https:\/\/www\.thearda\.com\/us-religion\/group-profiles\/groups\?D=\d+$/.test(url)) return url;
  return null;
}

function parseBodies(html, population) {
  var table = extractTable(html);
  if (!table) return refusal('BODY_TABLE_MISSING', 'The reviewed RCMS0 body table is absent.');

  var header = table.match(/<thead\b[^>]*>[\s\S]*?<\/thead>/i);
  var headers = [], hm;
  var hre = /<th\b[^>]*>([\s\S]*?)<\/th>/gi;
  while (header && (hm = hre.exec(header[0]))) headers.push(cellText(hm[1]));
  var expectedHeaders = ['Religious Bodies', 'Tradition', 'Family', 'Congregations', 'Adherents', 'Adherence Rate'];
  if (headers.join('|') !== expectedHeaders.join('|')) {
    return refusal('BODY_HEADERS_CHANGED', 'The six reviewed body-table headers changed.', {
      expected: expectedHeaders, actual: headers
    });
  }

  var rows = [], tr;
  var tre = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  while ((tr = tre.exec(table))) {
    var c = extractCells(tr[1]);
    if (c.length !== 6) continue;
    var congregations = numberFromPublished(c[3].text, true);
    var adherents = numberFromPublished(c[4].text, true);
    var rate = numberFromPublished(c[5].text, false);
    var url = groupUrl(c[0].html);
    if (!c[0].text || !c[1].text || !Number.isInteger(congregations) || congregations < 0 || !url) {
      return refusal('BODY_ROW_INVALID', 'A body row lacks reviewed identity, tradition, congregation count, or profile URL.', {
        row: c.map(function (x) { return x.text; })
      });
    }
    if ((adherents === null) !== (rate === null)) {
      return refusal('BODY_MISSINGNESS_SPLIT', 'Adherents and adherence rate must both be present or both be absent.', {
        body: c[0].text
      });
    }
    if (adherents !== null && (!Number.isInteger(adherents) || adherents < 0 || !Number.isFinite(rate) || rate < 0)) {
      return refusal('BODY_VALUE_INVALID', 'A published adherent count or rate is invalid.', { body: c[0].text });
    }
    if (adherents !== null) {
      var reproduced = adherents / population * 1000;
      if (Math.abs(reproduced - rate) > 0.006) {
        return refusal('ADHERENCE_RATE_NOT_REPRODUCIBLE', 'A published adherence rate does not reproduce from the body count and population within rounding tolerance.', {
          body: c[0].text, publishedRate: rate, reproducedRate: reproduced
        });
      }
    }
    rows.push({
      body: c[0].text,
      tradition: c[1].text,
      family: c[2].text || null,
      profileUrl: url,
      congregations: congregations,
      adherents: adherents,
      adherenceRatePer1000: rate
    });
  }

  if (rows.length !== EXPECTED_BODY_COUNT) {
    return refusal('BODY_COUNT_CHANGED', 'The public report does not contain the reviewed 372 body rows.', {
      expectedCount: EXPECTED_BODY_COUNT, actualCount: rows.length
    });
  }
  var seen = Object.create(null), duplicates = [];
  rows.forEach(function (x) {
    if (seen[x.body]) duplicates.push(x.body);
    seen[x.body] = true;
  });
  if (duplicates.length) return refusal('BODY_IDENTITY_DUPLICATE', 'A body identity appears more than once.', { duplicates: duplicates });

  var withAdherents = rows.filter(function (x) { return x.adherents !== null; }).length;
  var congregationsOnly = rows.length - withAdherents;
  if (withAdherents !== EXPECTED_WITH_ADHERENTS || congregationsOnly !== EXPECTED_CONGREGATIONS_ONLY) {
    return refusal('BODY_COVERAGE_CHANGED', 'The reviewed 217/155 publication coverage split changed.', {
      withAdherents: withAdherents, congregationsOnly: congregationsOnly
    });
  }

  return {
    ok: true,
    rows: rows,
    counts: {
      bodies: rows.length,
      withAdherents: withAdherents,
      congregationsOnly: congregationsOnly,
      displayedCongregationSum: rows.reduce(function (n, x) { return n + x.congregations; }, 0),
      displayedAdherentSum: rows.reduce(function (n, x) { return n + (x.adherents || 0); }, 0)
    }
  };
}

function parseChart(html) {
  var scripts = [], sm;
  var sre = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  while ((sm = sre.exec(String(html)))) {
    if (sm[1].indexOf('Religious Traditions (1980 - 2020), Percent of Population') >= 0) scripts.push(sm[1]);
  }
  if (scripts.length !== 1) {
    return refusal('TRADITION_CHART_NOT_UNIQUE', 'Exactly one reviewed 1980-2020 tradition chart script is required.', {
      chartScripts: scripts.length
    });
  }
  var script = scripts[0];
  var dm = script.match(/_data\s*=\s*(\[[\s\S]*?\])\s*;/);
  if (!dm) return refusal('TRADITION_DATA_MISSING', 'The chart data array is absent.');
  var data;
  try { data = JSON.parse(dm[1]); }
  catch (e) { return refusal('TRADITION_DATA_INVALID_JSON', 'The chart data array is not valid JSON.'); }
  if (!Array.isArray(data) || data.map(function (x) { return String(x.YEAR); }).join(',') !== YEARS.join(',')) {
    return refusal('TRADITION_YEARS_CHANGED', 'The chart must carry exactly the five reviewed decennial years.', {
      expected: YEARS, actual: Array.isArray(data) ? data.map(function (x) { return x.YEAR; }) : null
    });
  }

  var mapping = Object.create(null), mm;
  var mre = /name\s*:\s*"((?:\\.|[^"\\])*)"[\s\S]*?valueYField\s*:\s*"(R\d+)"/g;
  while ((mm = mre.exec(script))) {
    if (!Object.prototype.hasOwnProperty.call(mapping, mm[2])) {
      try { mapping[mm[2]] = JSON.parse('"' + mm[1].replace(/\\'/g, "'") + '"'); }
      catch (e) { return refusal('TRADITION_NAME_INVALID', 'A chart series name is not a valid quoted string.'); }
    }
  }
  var expectedMap = Object.create(null);
  TRADITIONS.forEach(function (x) { expectedMap[x.field] = x.name; });
  var expectedKeys = Object.keys(expectedMap).sort();
  var actualKeys = Object.keys(mapping).sort();
  if (actualKeys.join(',') !== expectedKeys.join(',')) {
    return refusal('TRADITION_FIELDS_CHANGED', 'The chart series field vocabulary changed.', {
      expected: expectedKeys, actual: actualKeys
    });
  }
  for (var i = 0; i < expectedKeys.length; i++) {
    var field = expectedKeys[i];
    if (mapping[field] !== expectedMap[field]) {
      return refusal('TRADITION_IDENTITY_CHANGED', 'A chart field no longer names the reviewed tradition.', {
        field: field, expected: expectedMap[field], actual: mapping[field]
      });
    }
  }

  var observations = [];
  data.forEach(function (yearRow) {
    var keys = Object.keys(yearRow).filter(function (k) { return k !== 'YEAR'; }).sort();
    if (keys.join(',') !== expectedKeys.join(',')) throw new Error('TRADITION_ROW_FIELDS_CHANGED');
    TRADITIONS.forEach(function (spec) {
      var value = yearRow[spec.field];
      if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error('TRADITION_VALUE_OUT_OF_RANGE');
      observations.push({
        year: Number(yearRow.YEAR),
        field: spec.field,
        tradition: spec.name,
        percentOfPopulation: value
      });
    });
  });
  return { ok: true, years: YEARS.map(Number), traditions: TRADITIONS, observations: observations };
}

function parseReport(html) {
  if (typeof html !== 'string' || Buffer.byteLength(html, 'utf8') < 50000) {
    return refusal('NOT_AN_ARDA_REPORT', 'The response is too small to be the reviewed public membership report.');
  }
  var text = textFromHtml(html);
  if (text.indexOf('U.S. Membership Report (2020)') < 0) return refusal('REPORT_MARKER_MISSING', 'The 2020 U.S. report marker is absent.');
  if (text.indexOf('Exact definitions of "congregations" and "adherents" vary by religious body') < 0) {
    return refusal('DEFINITION_WARNING_MISSING', 'The publisher definition warning is absent.');
  }
  var summary = text.match(/The population of the United States was ([\d,]+) in 2020\. The adherent totals of the religious groups listed above \(([\d,]+)\) included ([\d.]+)% of the total population in 2020\./);
  if (!summary) return refusal('REPORT_SUMMARY_MISSING', 'The reviewed population/adherent summary is absent.');
  var population = numberFromPublished(summary[1], true);
  var publishedAdherents = numberFromPublished(summary[2], true);
  var publishedShare = Number(summary[3]);
  if (population !== 331449281 || publishedAdherents !== 161224088 || publishedShare !== 48.6) {
    return refusal('REPORT_SUMMARY_CHANGED', 'The reviewed 2020 summary values changed.', {
      population: population, adherents: publishedAdherents, share: publishedShare
    });
  }
  var bodies = parseBodies(html, population);
  if (!bodies.ok) return bodies;
  if (bodies.counts.displayedAdherentSum !== publishedAdherents) {
    return refusal('ADHERENT_SUM_DISAGREES', 'The displayed body rows no longer sum to the page-level adherent total.', {
      displayed: bodies.counts.displayedAdherentSum, published: publishedAdherents
    });
  }
  var chart;
  try { chart = parseChart(html); }
  catch (e) { return refusal(e.message || 'TRADITION_CHART_INVALID', 'A tradition chart row failed its closed field or value contract.'); }
  if (!chart.ok) return chart;
  return {
    ok: true,
    referenceYear: REPORT_YEAR,
    population: population,
    publishedAdherents: publishedAdherents,
    publishedAdherentSharePercent: publishedShare,
    bodies: bodies.rows,
    bodyCounts: bodies.counts,
    traditionYears: chart.years,
    traditions: chart.traditions,
    traditionObservations: chart.observations,
    sourceSha256: sha256(html),
    sourceBytes: Buffer.byteLength(html, 'utf8')
  };
}

function parseArchiveSummary(html) {
  if (typeof html !== 'string' || Buffer.byteLength(html, 'utf8') < 5000) {
    return refusal('NOT_AN_ARDA_ARCHIVE_SUMMARY', 'The response is too small to be the reviewed archive summary.');
  }
  var text = textFromHtml(html);
  var required = [
    'U.S. Religion Census - Religious Congregations and Membership Study, 2020 (State File)',
    '10.17605/OSF.IO/6PGRZ',
    'In January 2024, the ARDA added 21 religious tradition (RELTRAD) variables to this dataset.'
  ];
  for (var i = 0; i < required.length; i++) {
    if (text.indexOf(required[i]) < 0) return refusal('ARCHIVE_MARKER_MISSING', 'A reviewed archive-summary marker is absent.', { marker: required[i] });
  }
  var totals = text.match(/The 372 groups reported a total of ([\d,]+) congregations with ([\d,]+) adherents, comprising ([\d.]+) percent of the total U\.S\. population of ([\d,]+)\./);
  if (!totals) return refusal('ARCHIVE_TOTALS_MISSING', 'The reviewed archive totals are absent.');
  var out = {
    congregations: numberFromPublished(totals[1], true),
    adherents: numberFromPublished(totals[2], true),
    adherentSharePercent: Number(totals[3]),
    population: numberFromPublished(totals[4], true)
  };
  if (out.congregations !== 356642 || out.adherents !== 161224088 || out.adherentSharePercent !== 48.6 || out.population !== 331449281) {
    return refusal('ARCHIVE_TOTALS_CHANGED', 'The reviewed archive-summary values changed.', out);
  }
  return {
    ok: true,
    doi: '10.17605/OSF.IO/6PGRZ',
    citationDate: '2023-03-31',
    reltradAugmentation: 'January 2024',
    cases: 52,
    variables: 835,
    weightVariable: null,
    totals: out,
    sourceSha256: sha256(html),
    sourceBytes: Buffer.byteLength(html, 'utf8')
  };
}

function stamp(report, archive, provenance) {
  if (!report || !report.ok || !archive || !archive.ok) return refusal('VALIDATED_SOURCE_PAIR_REQUIRED', 'Validated report and archive summary are both required.');
  var sourceRef = 'arda-report-2020:' + report.sourceSha256;
  var reportSource = provenance && provenance.report || {};
  function observation(kind, identity, year, value, units) {
    return {
      observationId: sha256(kind + '|' + identity + '|' + year + '|' + value + '|' + units + '|' + sourceRef),
      referenceYear: year,
      rawValue: value,
      transformedValue: value,
      rawUnits: units,
      transformedUnits: units,
      transformation: 'identity: published value retained without normalization, interpolation, ranking, or scoring',
      sourceRef: sourceRef,
      provenance: {
        sourceRef: sourceRef,
        sourceUrl: reportSource.sourceUrl || null,
        sourceSha256: report.sourceSha256,
        sourceUpdatedAt: reportSource.sourceUpdatedAt || null,
        retrievedAt: reportSource.retrievedAt || null,
        parserVersion: PARSER_VERSION,
        transformVersion: TRANSFORM_VERSION
      }
    };
  }
  report.traditionObservations.forEach(function (x) {
    x.observation = observation('tradition-share', x.field, x.year, x.percentOfPopulation, 'percent of U.S. population');
  });
  report.bodies.forEach(function (x) {
    x.observations = {
      congregations: observation('body-congregations', x.body, REPORT_YEAR, x.congregations, 'congregations'),
      adherents: x.adherents === null ? null : observation('body-adherents', x.body, REPORT_YEAR, x.adherents, 'adherents'),
      adherenceRate: x.adherenceRatePer1000 === null ? null : observation('body-adherence-rate', x.body, REPORT_YEAR, x.adherenceRatePer1000, 'adherents per 1,000 population')
    };
  });
  return {
    ok: true,
    report: report,
    archive: archive,
    reconciliation: {
      displayedBodyCongregationSum: report.bodyCounts.displayedCongregationSum,
      archiveCongregationTotal: archive.totals.congregations,
      congregationDifference: report.bodyCounts.displayedCongregationSum - archive.totals.congregations,
      displayedBodyAdherentSum: report.bodyCounts.displayedAdherentSum,
      archiveAdherentTotal: archive.totals.adherents,
      adherentDifference: report.bodyCounts.displayedAdherentSum - archive.totals.adherents,
      resolved: report.bodyCounts.displayedCongregationSum === archive.totals.congregations && report.bodyCounts.displayedAdherentSum === archive.totals.adherents
    },
    sourceRefs: {
      report: {
        sourceRef: sourceRef,
        sourceUrl: reportSource.sourceUrl || null,
        sourceSha256: report.sourceSha256,
        sourceUpdatedAt: reportSource.sourceUpdatedAt || null,
        retrievedAt: reportSource.retrievedAt || null
      }
    }
  };
}

module.exports = {
  parseReport: parseReport,
  parseArchiveSummary: parseArchiveSummary,
  parseChart: parseChart,
  stamp: stamp,
  textFromHtml: textFromHtml,
  TRADITIONS: TRADITIONS,
  YEARS: YEARS,
  REPORT_YEAR: REPORT_YEAR,
  EXPECTED_BODY_COUNT: EXPECTED_BODY_COUNT,
  EXPECTED_WITH_ADHERENTS: EXPECTED_WITH_ADHERENTS,
  EXPECTED_CONGREGATIONS_ONLY: EXPECTED_CONGREGATIONS_ONLY,
  PARSER_VERSION: PARSER_VERSION,
  TRANSFORM_VERSION: TRANSFORM_VERSION
};
