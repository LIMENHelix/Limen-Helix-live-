/**
 * Refusing reader for USCIRF's 2026 recommendations page.
 *
 * The page publishes policy recommendations under statutory standards. A
 * USCIRF recommendation is not a State Department designation, a country
 * score, an incident count, or a brain signal.
 */
'use strict';

var crypto = require('crypto');

var PARSER_VERSION = 'uscirf-annual-report/1.0.0';
var TRANSFORM_VERSION = 'official-html:reviewed-recommendation-sections->named-policy-recommendations/1.0.0';
var REPORT_YEAR = 2026;
var CONDITIONS_YEAR = 2025;

var EXPECTED_CPC = [
  'Afghanistan', 'Burma', 'China', 'Cuba', 'Eritrea', 'India', 'Iran', 'Libya',
  'Nicaragua', 'Nigeria', 'North Korea', 'Pakistan', 'Russia', 'Saudi Arabia',
  'Syria', 'Tajikistan', 'Turkmenistan', 'Vietnam'
];
var EXPECTED_SWL = [
  'Algeria', 'Azerbaijan', 'Egypt', 'Indonesia', 'Iraq', 'Kazakhstan',
  'Kyrgyzstan', 'Malaysia', 'Qatar', 'Turkey', 'Uzbekistan'
];
var EXPECTED_EPC = [
  'al-Shabaab', 'Boko Haram', 'Houthis', 'Islamic State Sahel Province (IS Sahel)',
  'Islamic State in West Africa Province (ISWAP / ISIS-West Africa)',
  'Jamaat Nasr al-Islam wal Muslimin (JNIM)', 'Rapid Support Forces'
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
    .replace(/<(?:br|\/p|\/div|\/li|\/h\d|\/a)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function canonicalText(s) {
  return textFromHtml(s).replace(/\s+/g, ' ').trim();
}

function exactMembers(actual, expected, code, sourceSha256) {
  var seen = Object.create(null);
  var duplicates = [];
  actual.forEach(function (name) {
    if (seen[name]) duplicates.push(name);
    seen[name] = true;
  });
  if (duplicates.length) {
    return refusal(code + '_DUPLICATE', 'The reviewed recommendation section contains duplicate names.', {
      duplicates: duplicates, sourceSha256: sourceSha256
    });
  }
  var missing = expected.filter(function (name) { return actual.indexOf(name) < 0; });
  var unexpected = actual.filter(function (name) { return expected.indexOf(name) < 0; });
  if (actual.length !== expected.length || missing.length || unexpected.length) {
    return refusal(code + '_MEMBERSHIP_CHANGED',
      'The recommendation membership differs from the reviewed ' + REPORT_YEAR + ' contract.', {
        expectedCount: expected.length, actualCount: actual.length,
        missing: missing, unexpected: unexpected, sourceSha256: sourceSha256
      });
  }
  return { ok: true };
}

function countryLinksBetween(html, startMarker, endMarker) {
  var lower = html.toLowerCase();
  var startNeedle = startMarker.toLowerCase();
  var endNeedle = endMarker.toLowerCase();
  var positions = [];
  var from = 0, at;
  while ((at = lower.indexOf(startNeedle, from)) >= 0) {
    positions.push(at);
    from = at + startNeedle.length;
  }

  var candidates = [];
  positions.forEach(function (start) {
    var end = lower.indexOf(endNeedle, start + startNeedle.length);
    if (end < 0) return;
    var slice = html.slice(start + startNeedle.length, end);
    var names = [], m;
    var re = /<a\b[^>]*href\s*=\s*["'][^"']*\/countries\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/gi;
    while ((m = re.exec(slice))) {
      var name = canonicalText(m[1]);
      if (name) names.push(name);
    }
    if (names.length) candidates.push(names);
  });
  candidates.sort(function (a, b) { return a.length - b.length; });
  return candidates.length ? candidates[0] : [];
}

function containsOnce(text, phrase) {
  var escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var m = text.match(new RegExp(escaped, 'g'));
  return m ? m.length : 0;
}

function parse(html) {
  if (typeof html !== 'string' || Buffer.byteLength(html, 'utf8') < 1000) {
    return refusal('NOT_A_USCIRF_RECOMMENDATIONS_PAGE',
      'The response is too small to be the reviewed USCIRF recommendations page.');
  }

  var sourceSha256 = crypto.createHash('sha256').update(html).digest('hex');
  var text = textFromHtml(html);

  if (text.indexOf('2026 Recommendations') < 0) {
    return refusal('REPORT_MARKER_MISSING', 'The reviewed 2026 Recommendations marker is absent.', {
      sourceSha256: sourceSha256
    });
  }
  if (!/2026 Annual Report assesses religious freedom conditions abroad during calendar year 2025/i.test(text)) {
    return refusal('REFERENCE_PERIOD_MISSING',
      'The page no longer states that the 2026 report assesses calendar year 2025.', {
        sourceSha256: sourceSha256
      });
  }
  if (!/different from, and complementary to,[\s\S]{0,180}State Department/i.test(text)) {
    return refusal('INSTITUTIONAL_BOUNDARY_MISSING',
      'The page no longer states USCIRF\'s relationship to the State Department mandate.', {
        sourceSha256: sourceSha256
      });
  }
  if (!/not covered in this report does not mean[\s\S]{0,220}(issues do not exist|have improved)/i.test(text)) {
    return refusal('ABSENCE_BOUNDARY_MISSING',
      'The publisher\'s warning against absence-as-improvement inference is absent.', {
        sourceSha256: sourceSha256
      });
  }

  var cpc = countryLinksBetween(html, 'Countries of Particular Concern', 'Special Watch List');
  var swl = countryLinksBetween(html, 'Special Watch List', 'The USCIRF Annual Report');
  if (!cpc.length) {
    return refusal('CPC_SECTION_MISSING', 'No country links were found in the reviewed CPC section.', {
      sourceSha256: sourceSha256
    });
  }
  if (!swl.length) {
    return refusal('SWL_SECTION_MISSING', 'No country links were found in the reviewed SWL section.', {
      sourceSha256: sourceSha256
    });
  }

  var check = exactMembers(cpc, EXPECTED_CPC, 'CPC', sourceSha256);
  if (!check.ok) return check;
  check = exactMembers(swl, EXPECTED_SWL, 'SWL', sourceSha256);
  if (!check.ok) return check;

  var overlap = cpc.filter(function (name) { return swl.indexOf(name) >= 0; });
  if (overlap.length) {
    return refusal('COUNTRY_CATEGORY_OVERLAP',
      'A country appears in both reviewed recommendation categories.', {
        overlap: overlap, sourceSha256: sourceSha256
      });
  }

  var epcStart = text.lastIndexOf('Entities of Particular Concern');
  if (epcStart < 0) {
    return refusal('EPC_SECTION_MISSING', 'The reviewed EPC section is absent.', {
      sourceSha256: sourceSha256
    });
  }
  var epcText = text.slice(epcStart);
  if (!/designate seven non-state actors as EPCs/i.test(epcText)) {
    return refusal('EPC_COUNT_STATEMENT_MISSING',
      'The reviewed seven-EPC recommendation statement is absent.', {
        sourceSha256: sourceSha256
      });
  }

  var epcAliases = {
    'al-Shabaab': ['al-Shabaab'],
    'Boko Haram': ['Boko Haram'],
    'Houthis': ['the Houthis'],
    'Islamic State Sahel Province (IS Sahel)': ['Islamic State Sahel Province (IS Sahel)'],
    'Islamic State in West Africa Province (ISWAP / ISIS-West Africa)': [
      'Islamic State in West Africa Province (ISWAP) (also referred to as ISIS-West Africa)'
    ],
    'Jamaat Nasr al-Islam wal Muslimin (JNIM)': ['Jamaat Nasr al-Islam wal Muslimin (JNIM)'],
    'Rapid Support Forces': ['Rapid Support Forces']
  };
  var epc = [];
  for (var i = 0; i < EXPECTED_EPC.length; i++) {
    var name = EXPECTED_EPC[i];
    var aliases = epcAliases[name];
    var count = 0;
    aliases.forEach(function (alias) { count += containsOnce(epcText, alias); });
    if (count !== 1) {
      return refusal('EPC_MEMBER_MISSING_OR_AMBIGUOUS',
        'A reviewed EPC recommendation is missing or duplicated.', {
          member: name, matchCount: count, sourceSha256: sourceSha256
        });
    }
    epc.push(name);
  }

  return {
    ok: true,
    reportYear: REPORT_YEAR,
    conditionsYear: CONDITIONS_YEAR,
    categories: [
      {
        categoryId: 'cpc_recommendation',
        publishedLabel: 'Countries of Particular Concern',
        subjectType: 'country',
        recommendations: cpc
      },
      {
        categoryId: 'swl_recommendation',
        publishedLabel: 'Special Watch List',
        subjectType: 'country',
        recommendations: swl
      },
      {
        categoryId: 'epc_recommendation',
        publishedLabel: 'Entities of Particular Concern',
        subjectType: 'nonstate actor',
        recommendations: epc
      }
    ],
    sourceSha256: sourceSha256,
    sourceBytes: Buffer.byteLength(html, 'utf8'),
    parserVersion: PARSER_VERSION,
    transformVersion: TRANSFORM_VERSION
  };
}

function stampRecommendations(parsed, provenance) {
  if (!parsed || !parsed.ok) return parsed;
  parsed.categories.forEach(function (category) {
    category.recommendations = category.recommendations.map(function (name) {
      return {
        observationId: crypto.createHash('sha256')
          .update(parsed.reportYear + '|' + category.categoryId + '|' + name)
          .digest('hex'),
        publishedName: name,
        categoryId: category.categoryId,
        categoryLabel: category.publishedLabel,
        subjectType: category.subjectType,
        reportYear: parsed.reportYear,
        conditionsYear: parsed.conditionsYear,
        units: 'USCIRF policy recommendation',
        provenance: {
          sourceUrl: provenance.sourceUrl,
          sourceSha256: parsed.sourceSha256,
          sourceUpdatedAt: provenance.sourceUpdatedAt || null,
          retrievedAt: provenance.retrievedAt,
          parserVersion: PARSER_VERSION,
          transformVersion: TRANSFORM_VERSION
        }
      };
    });
  });
  return parsed;
}

module.exports = {
  parse: parse,
  stampRecommendations: stampRecommendations,
  textFromHtml: textFromHtml,
  EXPECTED_CPC: EXPECTED_CPC,
  EXPECTED_SWL: EXPECTED_SWL,
  EXPECTED_EPC: EXPECTED_EPC,
  REPORT_YEAR: REPORT_YEAR,
  CONDITIONS_YEAR: CONDITIONS_YEAR,
  PARSER_VERSION: PARSER_VERSION,
  TRANSFORM_VERSION: TRANSFORM_VERSION
};
