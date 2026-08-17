/**
 * Refusing reader for PRRI's 2025 Census of American Religion spotlight.
 *
 * The publisher page is HTML rather than a versioned data API. This module
 * consumes only reviewed sentences and refuses if their identity or wording
 * changes. Published percentages remain survey estimates; they are not scored,
 * weighted, interpolated, or promoted into a Religion finding.
 */
'use strict';

var crypto = require('crypto');

var PARSER_VERSION = 'prri-disaffiliation/1.0.0';
var TRANSFORM_VERSION = 'official-html:reviewed-sentences->published-percent-observations/1.0.0';
var EDITION = 2025;
var PUBLISHED_DATE = 'April 15, 2026';

function refusal(code, detail, extra) {
  var out = { ok: false, code: code, detail: detail };
  Object.keys(extra || {}).forEach(function (k) { out[k] = extra[k]; });
  return out;
}

function decodeEntities(s) {
  var named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', ldquo: '“', rdquo: '”' };
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
    .replace(/<(?:br|\/p|\/div|\/li|\/h\d)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function one(text, re, code, detail) {
  var flags = re.flags.indexOf('g') >= 0 ? re.flags : re.flags + 'g';
  var scan = new RegExp(re.source, flags);
  var matches = [], m;
  while ((m = scan.exec(text))) {
    matches.push(m);
    if (m[0] === '') scan.lastIndex++;
  }
  if (matches.length !== 1) {
    return refusal(code, detail, { matchCount: matches.length });
  }
  return { ok: true, match: matches[0] };
}

function percent(n, code) {
  n = Number(n);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    return refusal(code, 'A published percentage was outside the closed 0..100 range.', { value: n });
  }
  return { ok: true, value: n };
}

function point(year, value) {
  return { referenceYear: year, value: value, units: 'percent of U.S. adults in the stated cohort' };
}

function parse(html) {
  if (typeof html !== 'string' || Buffer.byteLength(html, 'utf8') < 500) {
    return refusal('NOT_A_PRRI_REPORT_PAGE', 'The response is too small to be the reviewed PRRI report page.');
  }

  var sourceSha256 = crypto.createHash('sha256').update(html).digest('hex');
  var text = textFromHtml(html);
  if (text.indexOf('2025 PRRI Census of American Religion') < 0) {
    return refusal('EDITION_MARKER_MISSING', 'The page does not identify the reviewed 2025 PRRI Census edition.', { sourceSha256: sourceSha256 });
  }
  if (text.indexOf(PUBLISHED_DATE) < 0) {
    return refusal('PUBLISHED_DATE_MISSING', 'The reviewed publication date is absent.', { sourceSha256: sourceSha256 });
  }

  var sample = one(text, /With over\s+([\d,]+)\s+respondents\b/i,
    'SAMPLE_SIZE_MISSING_OR_AMBIGUOUS', 'The reviewed sample-size sentence is missing or duplicated.');
  if (!sample.ok) { sample.sourceSha256 = sourceSha256; return sample; }
  var sampleFloor = Number(sample.match[1].replace(/,/g, ''));
  if (!Number.isInteger(sampleFloor) || sampleFloor < 40000) {
    return refusal('SAMPLE_SIZE_INVALID', 'The published sample floor is not the reviewed over-40,000 statement.', {
      sampleFloor: sampleFloor, sourceSha256: sourceSha256
    });
  }

  var national = one(text,
    /In 2025,\s*(\d+)% of Americans identify as having no religious tradition\b/i,
    'NATIONAL_UNAFFILIATED_MISSING_OR_AMBIGUOUS', 'The reviewed national unaffiliated observation is missing or duplicated.');
  if (!national.ok) { national.sourceSha256 = sourceSha256; return national; }

  var weekly = one(text,
    /share attending religious services at least weekly has consistently declined, from\s*(\d+)% in 2013 to\s*(\d+)% in 2025\b/i,
    'WEEKLY_ATTENDANCE_MISSING_OR_AMBIGUOUS', 'The reviewed weekly-attendance comparison is missing or duplicated.');
  if (!weekly.ok) { weekly.sourceSha256 = sourceSha256; return weekly; }

  var seldom = one(text,
    /share of Americans who seldom or never attend religious services has increased substantially, rising from\s*(\d+)% in 2013 to\s*(\d+)% in 2025\b/i,
    'SELDOM_NEVER_MISSING_OR_AMBIGUOUS', 'The reviewed seldom-or-never comparison is missing or duplicated.');
  if (!seldom.ok) { seldom.sourceSha256 = sourceSha256; return seldom; }

  var young = one(text,
    /percentage of young Americans who are religiously unaffiliated has remained unchanged in the past year, shifting from\s*(\d+)% in 2024 to\s*(\d+)% in 2025\b/i,
    'YOUNG_ADULT_MISSING_OR_AMBIGUOUS', 'The reviewed young-adult comparison is missing or duplicated.');
  if (!young.ok) { young.sourceSha256 = sourceSha256; return young; }

  var men = one(text,
    /percentage of young men\s*\(18-29\)[\s\S]{0,260}?with\s*(\d+)% identifying as (?:a\s+)?[“"]none[”"] in 2013 and\s*(\d+)% identifying as (?:a\s+)?[“"]none[”"] in 2025\b/i,
    'YOUNG_MEN_MISSING_OR_AMBIGUOUS', 'The reviewed young-men comparison is missing or duplicated.');
  if (!men.ok) { men.sourceSha256 = sourceSha256; return men; }

  var women = one(text,
    /young women[\s\S]{0,300}?since 2013, when\s*(\d+)% identified as religiously unaffiliated\. In 2024, that figure grew to\s*(\d+)%, and in 2025, it increased to\s*(\d+)%\b/i,
    'YOUNG_WOMEN_MISSING_OR_AMBIGUOUS', 'The reviewed young-women comparison is missing or duplicated.');
  if (!women.ok) { women.sourceSha256 = sourceSha256; return women; }

  var raw = [
    national.match[1],
    weekly.match[1], weekly.match[2],
    seldom.match[1], seldom.match[2],
    young.match[1], young.match[2],
    men.match[1], men.match[2],
    women.match[1], women.match[2], women.match[3]
  ];
  var values = [];
  for (var i = 0; i < raw.length; i++) {
    var checked = percent(raw[i], 'PUBLISHED_PERCENT_INVALID');
    if (!checked.ok) { checked.sourceSha256 = sourceSha256; return checked; }
    values.push(checked.value);
  }

  return {
    ok: true,
    edition: EDITION,
    publishedDate: PUBLISHED_DATE,
    sampleFloor: sampleFloor,
    series: [
      {
        variableId: 'religiously_unaffiliated_share',
        publishedLabel: 'Religiously unaffiliated',
        cohort: 'All U.S. adults',
        observations: [point(2025, values[0])]
      },
      {
        variableId: 'weekly_religious_service_attendance',
        publishedLabel: 'Attend religious services at least weekly',
        cohort: 'All U.S. adults',
        observations: [point(2013, values[1]), point(2025, values[2])]
      },
      {
        variableId: 'seldom_or_never_religious_service_attendance',
        publishedLabel: 'Seldom or never attend religious services',
        cohort: 'All U.S. adults',
        observations: [point(2013, values[3]), point(2025, values[4])]
      },
      {
        variableId: 'religiously_unaffiliated_share',
        publishedLabel: 'Religiously unaffiliated',
        cohort: 'U.S. adults ages 18-29',
        observations: [point(2024, values[5]), point(2025, values[6])]
      },
      {
        variableId: 'religiously_unaffiliated_share',
        publishedLabel: 'Religiously unaffiliated',
        cohort: 'U.S. men ages 18-29',
        observations: [point(2013, values[7]), point(2025, values[8])]
      },
      {
        variableId: 'religiously_unaffiliated_share',
        publishedLabel: 'Religiously unaffiliated',
        cohort: 'U.S. women ages 18-29',
        observations: [point(2013, values[9]), point(2024, values[10]), point(2025, values[11])]
      }
    ],
    sourceSha256: sourceSha256,
    sourceBytes: Buffer.byteLength(html, 'utf8'),
    parserVersion: PARSER_VERSION,
    transformVersion: TRANSFORM_VERSION
  };
}

function stampSeries(parsed, provenance) {
  if (!parsed || !parsed.ok) return parsed;
  parsed.series.forEach(function (series) {
    series.observations.forEach(function (observation) {
      observation.observationId = crypto.createHash('sha256')
        .update(series.variableId + '|' + series.cohort + '|' + observation.referenceYear + '|' + observation.value)
        .digest('hex');
      observation.provenance = {
        sourceUrl: provenance.sourceUrl,
        sourceSha256: parsed.sourceSha256,
        sourceUpdatedAt: provenance.sourceUpdatedAt || null,
        retrievedAt: provenance.retrievedAt,
        parserVersion: PARSER_VERSION,
        transformVersion: TRANSFORM_VERSION
      };
    });
  });
  return parsed;
}

module.exports = {
  parse: parse,
  stampSeries: stampSeries,
  textFromHtml: textFromHtml,
  PARSER_VERSION: PARSER_VERSION,
  TRANSFORM_VERSION: TRANSFORM_VERSION,
  EDITION: EDITION,
  PUBLISHED_DATE: PUBLISHED_DATE
};
