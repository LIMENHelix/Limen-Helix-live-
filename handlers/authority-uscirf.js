/**
 * Operator evidence API for USCIRF's 2026 statutory-policy recommendations.
 * Recommendations remain documentary evidence; they are not designations,
 * country scores, incident measures, or brain inputs.
 */
'use strict';

var USCIRF = require('../lib/uscirf-annual-report.js');

var SUPPORTED = 'uscirf_annual_report';
var SOURCE_URL = 'https://www.uscirf.gov/countries/2026-recommendations';
var ANNUAL_REPORT_URL = 'https://www.uscirf.gov/annual-reports';
var IRFA_URL = 'https://uscode.house.gov/view.xhtml?path=/prelim@title22/chapter73&edition=prelim';
var UA = 'LIMEN-Helix/1.0 (operator evidence portal; +https://limenhelix.com)';
var FETCH_BUDGET_MS = 7000;
var CACHE_SUCCESS = 's-maxage=3600, stale-while-revalidate=86400';
var CACHE_TRANSIENT = 's-maxage=30, stale-while-revalidate=0';
var CACHE_NEVER = 'no-store';

function respond(res, status, cache, body) {
  res.setHeader('Cache-Control', cache);
  return res.status(status).json(body);
}

function descriptor() {
  return {
    id: SUPPORTED,
    name: 'USCIRF annual-report recommendations',
    publisher: 'U.S. Commission on International Religious Freedom (USCIRF)',
    landingPage: SOURCE_URL,
    annualReportsPage: ANNUAL_REPORT_URL,
    statutoryReference: IRFA_URL,
    measureType: 'independent federal commission policy recommendations under statutory standards',
    reportYear: 2026,
    conditionsPeriod: 'calendar year 2025',
    publicationInterval: 'annual report; recommendation membership is edition-specific',
    geographicScope: 'countries and named nonstate actors reviewed in USCIRF 2026 recommendations',
    units: 'named USCIRF policy recommendation in one published category',
    operatorUse: 'Use this view to see exactly whom USCIRF recommended for CPC, Special Watch List, or EPC treatment in the 2026 report and to preserve the institutional and reporting-period boundaries around that recommendation.',
    consumedBy: {
      religionFinding: false,
      brainChannel: false,
      thingLayer: null,
      pathway: false,
      statement: 'These recommendations are displayed for an operator. No Religion finding, brain channel, Thing layer, or pathway reads them, and they produce no stress value, diagnosis, score, or activation.'
    },
    boundaries: [
      'A USCIRF recommendation is not a U.S. State Department designation. USCIRF states that its mandate and reports are different from, and complementary to, the State Department mandate.',
      'The 2026 report assesses conditions during calendar year 2025; the report year is not the observation period.',
      'CPC and SWL are country recommendations. EPC recommendations concern named nonstate actors and are kept separate.',
      'The categories apply statutory standards; this portal does not convert category membership into a numeric severity, rank, trend, incident count, or forecast.',
      'Absence is not evidence of no problem or improvement. USCIRF explicitly says a country absence means only that it did not conclude the reporting-year conditions met the CPC or SWL standard.',
      'A recommendation is not proof of a particular article, event, causal mechanism, or current condition.',
      'No annual recommendation may drive the 30-second loop or directly manufacture stress, a diagnosis, or pathway activation.'
    ]
  };
}

async function fetchReport(url) {
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, FETCH_BUDGET_MS);
  var started = Date.now();
  try {
    var r = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' },
      signal: ctrl.signal
    });
    var html = await r.text();
    clearTimeout(timer);
    return {
      ok: r.status === 200,
      status: r.status,
      html: html,
      sourceUpdatedAt: r.headers.get('last-modified') || null,
      sourceEtag: r.headers.get('etag') || null,
      elapsedMs: Date.now() - started
    };
  } catch (e) {
    clearTimeout(timer);
    var timeout = e && (e.name === 'AbortError' || /abort/i.test(String(e.message || '')));
    return {
      ok: false,
      status: null,
      code: timeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_FETCH_FAILED',
      detail: timeout
        ? 'The USCIRF source did not finish within the bounded fetch budget.'
        : String(e && e.message || e),
      elapsedMs: Date.now() - started
    };
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  var authority = String((req.query && req.query.authority) || '').trim();

  if (!authority) return respond(res, 400, CACHE_NEVER, {
    ok: false, code: 'NO_AUTHORITY', detail: 'Supply ?authority=<id>.', supported: [SUPPORTED]
  });
  if (authority !== SUPPORTED) return respond(res, 404, CACHE_TRANSIENT, {
    ok: false,
    code: 'AUTHORITY_NOT_IMPLEMENTED',
    detail: 'This handler implements only ' + SUPPORTED + '.',
    requested: authority,
    supported: [SUPPORTED]
  });

  var got = await fetchReport(SOURCE_URL);
  if (!got.ok) return respond(res, 200, CACHE_TRANSIENT, {
    ok: false,
    code: got.code || 'UPSTREAM_HTTP_' + got.status,
    detail: got.detail || 'USCIRF returned HTTP ' + got.status + '.',
    authority: descriptor(),
    abstentions: ['No recommendation membership is shown because the official source page was not retrieved.'],
    diagnostics: { sourceUrl: SOURCE_URL, elapsedMs: got.elapsedMs, status: got.status }
  });

  var parsed = USCIRF.parse(got.html);
  if (!parsed.ok) return respond(res, 200, CACHE_TRANSIENT, {
    ok: false,
    code: parsed.code,
    detail: parsed.detail,
    authority: descriptor(),
    abstentions: ['No recommendation membership is shown because the source did not validate against the reviewed report contract.'],
    diagnostics: parsed,
    refusedFile: {
      url: SOURCE_URL,
      bytes: Buffer.byteLength(got.html, 'utf8'),
      sourceSha256: parsed.sourceSha256 || null,
      sourceUpdatedAt: got.sourceUpdatedAt
    },
    retrievedAt: new Date().toISOString()
  });

  var retrievedAt = new Date().toISOString();
  USCIRF.stampRecommendations(parsed, {
    sourceUrl: SOURCE_URL,
    sourceUpdatedAt: got.sourceUpdatedAt,
    retrievedAt: retrievedAt
  });

  return respond(res, 200, CACHE_SUCCESS, {
    ok: true,
    viewKind: 'uscirf_annual_report',
    authority: descriptor(),
    evidence: {
      reportYear: parsed.reportYear,
      conditionsYear: parsed.conditionsYear,
      categories: parsed.categories,
      counts: {
        countriesOfParticularConcern: parsed.categories[0].recommendations.length,
        specialWatchList: parsed.categories[1].recommendations.length,
        entitiesOfParticularConcern: parsed.categories[2].recommendations.length
      }
    },
    provenance: {
      source: {
        url: SOURCE_URL,
        sourceUpdatedAt: got.sourceUpdatedAt,
        sourceEtag: got.sourceEtag
      },
      sourceSha256: parsed.sourceSha256,
      sourceBytes: parsed.sourceBytes,
      retrievedAt: retrievedAt,
      elapsedMs: got.elapsedMs,
      parser: 'lib/uscirf-annual-report.js',
      parserVersion: USCIRF.PARSER_VERSION,
      transformVersion: USCIRF.TRANSFORM_VERSION,
      transformation: 'The reviewed official HTML recommendation sections are normalised into named, edition-bound policy-recommendation observations. No score, rank, interpolation, designation, event, or severity value is created.',
      validation: 'Exact report and conditions-year markers, institutional and absence boundaries, closed 18/11/7 category membership, uniqueness, country-category separation, and named EPC membership are required; otherwise the parser abstains.'
    },
    abstentions: descriptor().boundaries
  });
};

module.exports.descriptor = descriptor;
module.exports.fetchReport = fetchReport;
module.exports.SOURCE_URL = SOURCE_URL;
module.exports.FETCH_BUDGET_MS = FETCH_BUDGET_MS;
