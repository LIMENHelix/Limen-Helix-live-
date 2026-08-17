/**
 * Refusing reader for Pew Research Center's 2023 GRI and SHI country charts.
 *
 * Government Restrictions Index (GRI) and Social Hostilities Index (SHI) are
 * separate published measures. This module never combines them into a score.
 */
'use strict';

var crypto = require('crypto');

var PARSER_VERSION = 'pew-global-restrictions/1.0.0';
var TRANSFORM_VERSION = 'official-html:published-country-tables->paired-gri-shi-observations/1.0.0';
var REFERENCE_YEAR = 2023;
var PUBLICATION_DATE = 'June 12, 2026';
var EXPECTED_COUNTRIES = 198;
var REGIONS = ['Americas', 'Asia-Pacific', 'Europe', 'Middle East-North Africa', 'Sub-Saharan Africa'];
var CATEGORIES = ['Low', 'Moderate', 'High', 'Very high'];

var AXES = {
  gri: {
    id: 'gri',
    name: 'Government Restrictions Index',
    scoreHeader: '2023 GRI Score',
    pageMarker: 'Government restrictions on religion around the world in 2023',
    units: 'points on Pew Research Center Government Restrictions Index (0-10)',
    thresholds: [
      { min: 0, max: 2.3, category: 'Low' },
      { min: 2.4, max: 4.4, category: 'Moderate' },
      { min: 4.5, max: 6.5, category: 'High' },
      { min: 6.6, max: 10, category: 'Very high' }
    ]
  },
  shi: {
    id: 'shi',
    name: 'Social Hostilities Index',
    scoreHeader: '2023 SHI Score',
    pageMarker: 'Social hostilities involving religion around the world in 2023',
    units: 'points on Pew Research Center Social Hostilities Index (0-10)',
    thresholds: [
      { min: 0, max: 1.4, category: 'Low' },
      { min: 1.5, max: 3.5, category: 'Moderate' },
      { min: 3.6, max: 7.1, category: 'High' },
      { min: 7.2, max: 10, category: 'Very high' }
    ]
  }
};

var REVIEWED_ALIASES = {
  'Congo, Dem. Rep.': 'Congo, Democratic Republic',
  'Congo, Democratic Republic': 'Congo, Democratic Republic',
  'Congo, Rep.': 'Congo, Republic',
  'Congo, Republic': 'Congo, Republic'
};

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

function expectedCategory(axis, score) {
  var ranges = AXES[axis].thresholds;
  for (var i = 0; i < ranges.length; i++) {
    if (score >= ranges[i].min && score <= ranges[i].max) return ranges[i].category;
  }
  return null;
}

function canonicalCountry(name) {
  return Object.prototype.hasOwnProperty.call(REVIEWED_ALIASES, name)
    ? REVIEWED_ALIASES[name] : name;
}

function tableRows(html) {
  var out = [], tr, cells, m;
  var trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  while ((tr = trRe.exec(html))) {
    cells = [];
    var cellRe = /<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
    while ((m = cellRe.exec(tr[1]))) cells.push(cellText(m[1]));
    if (cells.length === 4) out.push(cells);
  }
  return out;
}

function tokenRows(html) {
  var lines = textFromHtml(html).split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
  var out = [];
  for (var i = 0; i <= lines.length - 4; i++) {
    if (REGIONS.indexOf(lines[i]) < 0) continue;
    if (CATEGORIES.indexOf(lines[i + 2]) < 0) continue;
    if (!/^\d+(?:\.\d+)?$/.test(lines[i + 3])) continue;
    out.push([lines[i], lines[i + 1], lines[i + 2], lines[i + 3]]);
    i += 3;
  }
  return out;
}

function parseChart(html, axis) {
  if (!Object.prototype.hasOwnProperty.call(AXES, axis)) {
    return refusal('UNKNOWN_AXIS', 'The chart axis must be gri or shi.', { axis: axis });
  }
  if (typeof html !== 'string' || Buffer.byteLength(html, 'utf8') < 5000) {
    return refusal('NOT_A_PEW_CHART_PAGE', 'The response is too small to be the reviewed Pew chart page.', { axis: axis });
  }

  var spec = AXES[axis];
  var sourceSha256 = crypto.createHash('sha256').update(html).digest('hex');
  var text = textFromHtml(html);

  if (text.indexOf(spec.pageMarker) < 0) {
    return refusal('CHART_MARKER_MISSING', 'The reviewed chart title is absent.', {
      axis: axis, sourceSha256: sourceSha256
    });
  }
  if (text.indexOf(PUBLICATION_DATE) < 0) {
    return refusal('PUBLICATION_DATE_MISSING', 'The reviewed publication date is absent.', {
      axis: axis, sourceSha256: sourceSha256
    });
  }
  if (text.indexOf(spec.scoreHeader) < 0) {
    return refusal('SCORE_HEADER_MISSING', 'The reviewed score column is absent.', {
      axis: axis, sourceSha256: sourceSha256
    });
  }
  if (text.indexOf('Pew Research Center analysis of external data') < 0) {
    return refusal('SOURCE_STATEMENT_MISSING', 'The publisher source statement is absent.', {
      axis: axis, sourceSha256: sourceSha256
    });
  }

  var candidates = tableRows(html);
  if (candidates.length < EXPECTED_COUNTRIES) candidates = tokenRows(html);

  var rows = [];
  candidates.forEach(function (cells) {
    if (REGIONS.indexOf(cells[0]) < 0 || CATEGORIES.indexOf(cells[2]) < 0) return;
    if (!/^\d+(?:\.\d+)?$/.test(cells[3])) return;
    rows.push({
      region: cells[0],
      publishedCountry: cells[1],
      country: canonicalCountry(cells[1]),
      category: cells[2],
      score: Number(cells[3])
    });
  });

  if (rows.length !== EXPECTED_COUNTRIES) {
    return refusal('COUNTRY_COUNT_CHANGED', 'The chart does not contain the reviewed 198 country/territory rows.', {
      axis: axis, expectedCount: EXPECTED_COUNTRIES, actualCount: rows.length,
      sourceSha256: sourceSha256
    });
  }

  var seen = Object.create(null), duplicates = [];
  rows.forEach(function (row) {
    if (seen[row.country]) duplicates.push(row.country);
    seen[row.country] = true;
  });
  if (duplicates.length) {
    return refusal('COUNTRY_IDENTITY_DUPLICATE', 'A canonical country identity appears more than once.', {
      axis: axis, duplicates: duplicates, sourceSha256: sourceSha256
    });
  }

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (!Number.isFinite(row.score) || row.score < 0 || row.score > 10) {
      return refusal('SCORE_OUT_OF_RANGE', 'A published index value is outside the closed 0..10 scale.', {
        axis: axis, country: row.country, value: row.score, sourceSha256: sourceSha256
      });
    }
    var expected = expectedCategory(axis, row.score);
    if (row.category !== expected) {
      return refusal('CATEGORY_SCORE_MISMATCH', 'A published category does not match the reviewed axis thresholds.', {
        axis: axis, country: row.country, score: row.score,
        publishedCategory: row.category, expectedCategory: expected,
        sourceSha256: sourceSha256
      });
    }
  }

  return {
    ok: true,
    axis: axis,
    referenceYear: REFERENCE_YEAR,
    publicationDate: PUBLICATION_DATE,
    rows: rows,
    sourceSha256: sourceSha256,
    sourceBytes: Buffer.byteLength(html, 'utf8')
  };
}

function pair(gri, shi) {
  if (!gri || !gri.ok || gri.axis !== 'gri') return refusal('GRI_NOT_VALIDATED', 'A validated GRI chart is required.');
  if (!shi || !shi.ok || shi.axis !== 'shi') return refusal('SHI_NOT_VALIDATED', 'A validated SHI chart is required.');

  var byCountry = Object.create(null);
  shi.rows.forEach(function (row) { byCountry[row.country] = row; });
  var missing = [], regionMismatch = [], paired = [];

  gri.rows.forEach(function (g) {
    var s = byCountry[g.country];
    if (!s) { missing.push(g.country); return; }
    if (s.region !== g.region) {
      regionMismatch.push({ country: g.country, griRegion: g.region, shiRegion: s.region });
      return;
    }
    paired.push({
      country: g.country,
      region: g.region,
      publishedCountry: { gri: g.publishedCountry, shi: s.publishedCountry },
      aliasApplied: g.publishedCountry !== s.publishedCountry,
      gri: { score: g.score, category: g.category },
      shi: { score: s.score, category: s.category }
    });
  });

  var extras = shi.rows.filter(function (s) {
    return !gri.rows.some(function (g) { return g.country === s.country; });
  }).map(function (x) { return x.country; });

  if (missing.length || extras.length || regionMismatch.length || paired.length !== EXPECTED_COUNTRIES) {
    return refusal('AXIS_MEMBERSHIP_MISMATCH', 'GRI and SHI do not describe the same reviewed country/territory membership.', {
      missingFromShi: missing, extraInShi: extras, regionMismatch: regionMismatch,
      pairedCount: paired.length
    });
  }

  return {
    ok: true,
    referenceYear: REFERENCE_YEAR,
    publicationDate: PUBLICATION_DATE,
    countries: paired,
    sources: {
      gri: { sourceSha256: gri.sourceSha256, sourceBytes: gri.sourceBytes },
      shi: { sourceSha256: shi.sourceSha256, sourceBytes: shi.sourceBytes }
    },
    parserVersion: PARSER_VERSION,
    transformVersion: TRANSFORM_VERSION
  };
}

function stamp(parsed, provenance) {
  if (!parsed || !parsed.ok) return parsed;
  parsed.countries.forEach(function (country) {
    ['gri', 'shi'].forEach(function (axis) {
      var observation = country[axis];
      var source = provenance[axis];
      observation.observationId = crypto.createHash('sha256')
        .update(axis + '|' + country.country + '|' + parsed.referenceYear + '|' + observation.score + '|' + observation.category)
        .digest('hex');
      observation.axis = axis;
      observation.axisName = AXES[axis].name;
      observation.referenceYear = parsed.referenceYear;
      observation.rawValue = observation.score;
      observation.transformedValue = observation.score;
      observation.rawUnits = AXES[axis].units;
      observation.transformedUnits = AXES[axis].units;
      observation.units = AXES[axis].units;
      observation.transformation = 'identity: preserve the published score and category without normalization, aggregation, interpolation, or ranking';
      observation.provenance = {
        sourceUrl: source.sourceUrl,
        sourceSha256: parsed.sources[axis].sourceSha256,
        sourceUpdatedAt: source.sourceUpdatedAt || null,
        retrievedAt: source.retrievedAt,
        parserVersion: PARSER_VERSION,
        transformVersion: TRANSFORM_VERSION
      };
    });
  });
  return parsed;
}

module.exports = {
  parseChart: parseChart,
  pair: pair,
  stamp: stamp,
  textFromHtml: textFromHtml,
  expectedCategory: expectedCategory,
  canonicalCountry: canonicalCountry,
  AXES: AXES,
  REGIONS: REGIONS,
  CATEGORIES: CATEGORIES,
  REVIEWED_ALIASES: REVIEWED_ALIASES,
  REFERENCE_YEAR: REFERENCE_YEAR,
  PUBLICATION_DATE: PUBLICATION_DATE,
  EXPECTED_COUNTRIES: EXPECTED_COUNTRIES,
  PARSER_VERSION: PARSER_VERSION,
  TRANSFORM_VERSION: TRANSFORM_VERSION
};
