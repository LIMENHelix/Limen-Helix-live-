/**
 * Refusing reader for Gallup's March 25, 2024 church-attendance report.
 *
 * The report aggregates 2021-2023 telephone surveys. This reader consumes only
 * reviewed published sentences and preserves their reference windows. It does
 * not turn self-reported attendance into an institutional-health score.
 */
'use strict';

var crypto = require('crypto');

var PARSER_VERSION = 'gallup-religious-attendance/1.0.0';
var TRANSFORM_VERSION = 'official-html:reviewed-sentences->published-percent-observations/1.0.0';
var PUBLISHED_DATE = 'March 25, 2024';
var CURRENT_WINDOW = '2021-2023';

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
  var scan = new RegExp(re.source, re.flags.indexOf('g') >= 0 ? re.flags : re.flags + 'g');
  var matches = [], m;
  while ((m = scan.exec(text))) {
    matches.push(m);
    if (m[0] === '') scan.lastIndex++;
  }
  return matches.length === 1 ? { ok: true, match: matches[0] } :
    refusal(code, detail, { matchCount: matches.length });
}

function checkedPercent(value, code, sourceSha256) {
  var n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    return refusal(code, 'A published percentage was outside the closed 0..100 range.', {
      value: n, sourceSha256: sourceSha256
    });
  }
  return { ok: true, value: n };
}

function observation(referenceWindow, value) {
  return {
    referenceWindow: referenceWindow,
    value: value,
    units: 'percent of U.S. adults in the stated cohort'
  };
}

function parse(html) {
  if (typeof html !== 'string' || Buffer.byteLength(html, 'utf8') < 500) {
    return refusal('NOT_A_GALLUP_REPORT_PAGE', 'The response is too small to be the reviewed Gallup report page.');
  }
  var sourceSha256 = crypto.createHash('sha256').update(html).digest('hex');
  var text = textFromHtml(html);

  if (text.indexOf('Church Attendance Has Declined in Most U.S. Religious Groups') < 0) {
    return refusal('REPORT_MARKER_MISSING', 'The reviewed Gallup report title is absent.', { sourceSha256: sourceSha256 });
  }
  if (text.indexOf(PUBLISHED_DATE) < 0) {
    return refusal('PUBLISHED_DATE_MISSING', 'The reviewed publication date is absent.', { sourceSha256: sourceSha256 });
  }

  var sample = one(text,
    /combined 2021-2023 data comprise interviews with more than\s+([\d,]+)\s+U\.S\. adults and at least\s+(\d+)\s+respondents in each religion/i,
    'SAMPLE_STATEMENT_MISSING_OR_AMBIGUOUS', 'The reviewed aggregate-sample statement is missing or duplicated.');
  if (!sample.ok) { sample.sourceSha256 = sourceSha256; return sample; }
  var sampleFloor = Number(sample.match[1].replace(/,/g, ''));
  var subgroupFloor = Number(sample.match[2]);
  if (!Number.isInteger(sampleFloor) || sampleFloor < 32000 || !Number.isInteger(subgroupFloor) || subgroupFloor < 200) {
    return refusal('SAMPLE_STATEMENT_INVALID', 'The aggregate sample floors do not match the reviewed publication statement.', {
      sampleFloor: sampleFloor, subgroupFloor: subgroupFloor, sourceSha256: sourceSha256
    });
  }

  var frequency = one(text,
    /attend religious services every week\s*\((\d+)%\) or almost every week\s*\((\d+)%\), while\s*(\d+)% report attending about once a month and\s*(\d+)% seldom\s*\((\d+)%\) or never\s*\((\d+)%\) attend/i,
    'FREQUENCY_DISTRIBUTION_MISSING_OR_AMBIGUOUS', 'The reviewed attendance-frequency distribution is missing or duplicated.');
  if (!frequency.ok) { frequency.sourceSha256 = sourceSha256; return frequency; }

  var regular = one(text,
    /Two decades ago, an average of\s*(\d+)% of U\.S\. adults attended religious services every week or nearly every week\. A decade ago, the figure fell to\s*(\d+)%, and it is currently at\s*(\d+)%/i,
    'REGULAR_TREND_MISSING_OR_AMBIGUOUS', 'The reviewed regular-attendance trend is missing or duplicated.');
  if (!regular.ok) { regular.sourceSha256 = sourceSha256; return regular; }

  var unaffiliated = one(text,
    /Americans with no religious affiliation\s*--\s*(\d+)% in 2000-2003 versus\s*(\d+)% in 2021-2023/i,
    'UNAFFILIATED_TREND_MISSING_OR_AMBIGUOUS', 'The reviewed unaffiliated-share comparison is missing or duplicated.');
  if (!unaffiliated.ok) { unaffiliated.sourceSha256 = sourceSha256; return unaffiliated; }

  var young = one(text,
    /more 18-\s*to 29-year-olds,\s*(\d+)%, say they have no religious preference[\s\S]{0,320}?young adults[\s\S]{0,180}?(\d+)% attend regularly/i,
    'YOUNG_ADULT_CONTEXT_MISSING_OR_AMBIGUOUS', 'The reviewed young-adult observations are missing or duplicated.');
  if (!young.ok) { young.sourceSha256 = sourceSha256; return young; }

  var raw = frequency.match.slice(1, 7)
    .concat(regular.match.slice(1, 4))
    .concat(unaffiliated.match.slice(1, 3))
    .concat(young.match.slice(1, 3));
  var values = [];
  for (var i = 0; i < raw.length; i++) {
    var p = checkedPercent(raw[i], 'PUBLISHED_PERCENT_INVALID', sourceSha256);
    if (!p.ok) return p;
    values.push(p.value);
  }

  if (values[0] + values[1] !== values[8]) {
    return refusal('REGULAR_ATTENDANCE_CROSSCHECK_FAILED',
      'Every-week plus almost-every-week does not equal the separately published current regular-attendance share.', {
        components: [values[0], values[1]], publishedRegular: values[8], sourceSha256: sourceSha256
      });
  }
  if (values[4] + values[5] !== values[3]) {
    return refusal('SELDOM_NEVER_CROSSCHECK_FAILED',
      'Seldom plus never does not equal the separately published combined share.', {
        components: [values[4], values[5]], publishedCombined: values[3], sourceSha256: sourceSha256
      });
  }

  return {
    ok: true,
    publishedDate: PUBLISHED_DATE,
    currentWindow: CURRENT_WINDOW,
    sampleFloor: sampleFloor,
    subgroupFloor: subgroupFloor,
    series: [
      { variableId: 'attendance_every_week', publishedLabel: 'Attend every week', cohort: 'All U.S. adults', observations: [observation(CURRENT_WINDOW, values[0])] },
      { variableId: 'attendance_almost_every_week', publishedLabel: 'Attend almost every week', cohort: 'All U.S. adults', observations: [observation(CURRENT_WINDOW, values[1])] },
      { variableId: 'attendance_about_monthly', publishedLabel: 'Attend about once a month', cohort: 'All U.S. adults', observations: [observation(CURRENT_WINDOW, values[2])] },
      { variableId: 'attendance_seldom', publishedLabel: 'Attend seldom', cohort: 'All U.S. adults', observations: [observation(CURRENT_WINDOW, values[4])] },
      { variableId: 'attendance_never', publishedLabel: 'Never attend', cohort: 'All U.S. adults', observations: [observation(CURRENT_WINDOW, values[5])] },
      {
        variableId: 'attendance_regular',
        publishedLabel: 'Attend every week or nearly every week',
        cohort: 'All U.S. adults',
        observations: [
          observation('2000-2003', values[6]),
          observation('2011-2013', values[7]),
          observation(CURRENT_WINDOW, values[8])
        ]
      },
      {
        variableId: 'no_religious_affiliation',
        publishedLabel: 'No religious affiliation',
        cohort: 'All U.S. adults',
        observations: [observation('2000-2003', values[9]), observation(CURRENT_WINDOW, values[10])]
      },
      { variableId: 'no_religious_preference', publishedLabel: 'No religious preference', cohort: 'U.S. adults ages 18-29', observations: [observation(CURRENT_WINDOW, values[11])] },
      { variableId: 'attendance_regular', publishedLabel: 'Attend regularly', cohort: 'U.S. adults ages 18-29', observations: [observation(CURRENT_WINDOW, values[12])] }
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
    series.observations.forEach(function (o) {
      o.observationId = crypto.createHash('sha256')
        .update(series.variableId + '|' + series.cohort + '|' + o.referenceWindow + '|' + o.value)
        .digest('hex');
      o.provenance = {
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
  PUBLISHED_DATE: PUBLISHED_DATE,
  CURRENT_WINDOW: CURRENT_WINDOW
};
