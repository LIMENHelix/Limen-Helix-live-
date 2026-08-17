/**
 * Operator evidence API for PRRI's published disaffiliation and attendance
 * observations. These survey estimates remain documentary evidence only.
 */
'use strict';

var PRRI = require('../lib/prri-disaffiliation.js');

var SUPPORTED = 'prri_disaffiliation_trends';
var SOURCE_URL = 'https://prri.org/spotlight/2025-prri-census-of-american-religion/';
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
    name: 'PRRI Census of American Religion — disaffiliation and attendance',
    publisher: 'Public Religion Research Institute (PRRI)',
    landingPage: SOURCE_URL,
    methodologyPage: 'https://prri.org/about/methodology/',
    measureType: 'national probability-sample survey estimates',
    observationWindow: 'respondents surveyed during calendar year 2025; comparison years are preserved as published',
    publicationInterval: 'annual Census of American Religion edition; individual measures may not appear in every edition',
    geographicScope: 'United States adults and the explicitly named age/gender cohorts',
    units: 'published percentage of U.S. adults in the stated cohort',
    sampleStatement: 'PRRI states that the 2025 edition includes over 40,000 respondents.',
    operatorUse: 'Use this view to inspect PRRI-published affiliation and service-attendance estimates, compare only the stated cohorts and years, and open the source before drawing a substantive conclusion.',
    consumedBy: {
      religionFinding: false, brainChannel: false, thingLayer: null, pathway: false,
      statement: 'These survey observations are displayed for an operator. No Religion finding, brain channel, Thing layer, or pathway reads them, and they produce no stress value, diagnosis, score, or activation.'
    },
    boundaries: [
      'PRRI calls this product a Census of American Religion; it is a probability-sample survey, not the United States census or a complete enumeration.',
      'A percentage-point difference is not a significance test, causal explanation, mechanism, institutional-health score, or forecast.',
      'The displayed cohorts are not interchangeable. A national estimate, an age cohort, and an age-by-gender cohort answer different questions.',
      'The page preserves PRRI values and reference years. It does not interpolate missing years or manufacture a continuous annual series.',
      'Survey estimates may be revised or accompanied by methodology and weighting disclosures on the publisher site.',
      'No annual survey estimate may drive the 30-second loop or directly manufacture stress, a diagnosis, or pathway activation.'
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
      ok: r.status === 200, status: r.status, html: html,
      sourceUpdatedAt: r.headers.get('last-modified') || null,
      sourceEtag: r.headers.get('etag') || null,
      elapsedMs: Date.now() - started
    };
  } catch (e) {
    clearTimeout(timer);
    var timeout = e && (e.name === 'AbortError' || /abort/i.test(String(e.message || '')));
    return {
      ok: false, status: null,
      code: timeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_FETCH_FAILED',
      detail: timeout ? 'The PRRI source did not finish within the bounded fetch budget.' : String(e && e.message || e),
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
    ok: false, code: 'AUTHORITY_NOT_IMPLEMENTED',
    detail: 'This handler implements only ' + SUPPORTED + '.',
    requested: authority, supported: [SUPPORTED]
  });

  var got = await fetchReport(SOURCE_URL);
  if (!got.ok) return respond(res, 200, CACHE_TRANSIENT, {
    ok: false,
    code: got.code || 'UPSTREAM_HTTP_' + got.status,
    detail: got.detail || 'PRRI returned HTTP ' + got.status + '.',
    authority: descriptor(),
    abstentions: ['No survey values are shown because the official source page was not retrieved.'],
    diagnostics: { sourceUrl: SOURCE_URL, elapsedMs: got.elapsedMs, status: got.status }
  });

  var parsed = PRRI.parse(got.html);
  if (!parsed.ok) return respond(res, 200, CACHE_TRANSIENT, {
    ok: false, code: parsed.code, detail: parsed.detail,
    authority: descriptor(),
    abstentions: ['No survey values are shown because the source did not validate against the reviewed 2025 sentence contract.'],
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
  PRRI.stampSeries(parsed, {
    sourceUrl: SOURCE_URL,
    sourceUpdatedAt: got.sourceUpdatedAt,
    retrievedAt: retrievedAt
  });

  return respond(res, 200, CACHE_SUCCESS, {
    ok: true,
    viewKind: 'prri_disaffiliation',
    authority: descriptor(),
    evidence: {
      edition: parsed.edition,
      publishedDate: parsed.publishedDate,
      sampleFloor: parsed.sampleFloor,
      series: parsed.series
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
      parser: 'lib/prri-disaffiliation.js',
      parserVersion: PRRI.PARSER_VERSION,
      transformVersion: PRRI.TRANSFORM_VERSION,
      transformation: 'Reviewed official HTML sentences are normalised into named cohort/year percentage observations. No values are imputed, averaged, scored, ranked, weighted again, or interpreted as significance.',
      validation: 'Exact 2025 edition marker, publication date, over-40,000 sample statement, six reviewed series statements, closed 0..100 percentage range, and unique matches are required; otherwise the parser abstains.'
    },
    abstentions: descriptor().boundaries
  });
};

module.exports.descriptor = descriptor;
module.exports.fetchReport = fetchReport;
module.exports.SOURCE_URL = SOURCE_URL;
module.exports.FETCH_BUDGET_MS = FETCH_BUDGET_MS;
