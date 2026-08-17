/**
 * Operator evidence API for Gallup's published religious-attendance aggregates.
 * Self-reported survey percentages remain documentary evidence only.
 */
'use strict';

var GALLUP = require('../lib/gallup-religious-attendance.js');

var SUPPORTED = 'gallup_religious_attendance';
var SOURCE_URL = 'https://news.gallup.com/poll/642548/church-attendance-declined-religious-groups.aspx';
var METHODOLOGY_URL = 'https://www.gallup.com/178685/methodology-center.aspx';
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
    name: 'Gallup religious-service attendance',
    publisher: 'Gallup',
    landingPage: SOURCE_URL,
    methodologyPage: METHODOLOGY_URL,
    measureType: 'aggregated self-reported telephone survey estimates',
    observationWindow: 'current observations aggregate Gallup U.S. surveys conducted in 2021, 2022, and 2023',
    publicationInterval: 'report-specific; this article was published March 25, 2024 and does not promise a fixed refresh cadence',
    geographicScope: 'United States adults and one explicitly named 18-29 cohort',
    units: 'published percentage of U.S. adults in the stated cohort',
    sampleStatement: 'Gallup states that the combined 2021-2023 data comprise more than 32,000 U.S. adults and at least 200 respondents in each religion, with stated exceptions.',
    operatorUse: 'Use this view to inspect Gallup-published attendance frequency and long-window comparisons, while preserving the cohort and aggregate period attached to each value.',
    consumedBy: {
      religionFinding: false, brainChannel: false, thingLayer: null, pathway: false,
      statement: 'These survey observations are displayed for an operator. No Religion finding, brain channel, Thing layer, or pathway reads them, and they produce no stress value, diagnosis, score, or activation.'
    },
    boundaries: [
      'These are self-reported survey estimates, not turnstile counts, membership rolls, congregation counts, or a census.',
      'Regular attendance combines every week and almost every week exactly as Gallup publishes it.',
      'The current values pool 2021-2023 surveys. They are not a point observation dated March 25, 2024.',
      'A percentage-point difference is not a significance test, causal mechanism, institutional-health score, or forecast.',
      'No unreported year is interpolated, and no cohort is substituted for another.',
      'Gallup states sample exceptions for Orthodox churches and Hinduism; this portal does not render religion-specific subgroup estimates.',
      'No survey estimate may drive the 30-second loop or directly manufacture stress, a diagnosis, or pathway activation.'
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
      detail: timeout ? 'The Gallup source did not finish within the bounded fetch budget.' : String(e && e.message || e),
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
    detail: got.detail || 'Gallup returned HTTP ' + got.status + '.',
    authority: descriptor(),
    abstentions: ['No survey values are shown because the official source page was not retrieved.'],
    diagnostics: { sourceUrl: SOURCE_URL, elapsedMs: got.elapsedMs, status: got.status }
  });

  var parsed = GALLUP.parse(got.html);
  if (!parsed.ok) return respond(res, 200, CACHE_TRANSIENT, {
    ok: false, code: parsed.code, detail: parsed.detail,
    authority: descriptor(),
    abstentions: ['No survey values are shown because the source did not validate against the reviewed report contract.'],
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
  GALLUP.stampSeries(parsed, {
    sourceUrl: SOURCE_URL,
    sourceUpdatedAt: got.sourceUpdatedAt,
    retrievedAt: retrievedAt
  });

  return respond(res, 200, CACHE_SUCCESS, {
    ok: true,
    viewKind: 'gallup_religious_attendance',
    authority: descriptor(),
    evidence: {
      publishedDate: parsed.publishedDate,
      currentWindow: parsed.currentWindow,
      sampleFloor: parsed.sampleFloor,
      subgroupFloor: parsed.subgroupFloor,
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
      parser: 'lib/gallup-religious-attendance.js',
      parserVersion: GALLUP.PARSER_VERSION,
      transformVersion: GALLUP.TRANSFORM_VERSION,
      transformation: 'Reviewed official HTML sentences are normalised into named cohort/window percentage observations. No value is imputed, averaged again, scored, ranked, or interpreted as significance.',
      validation: 'Exact report title, publication date, aggregate-sample statement, four reviewed evidence statements, unique matches, closed 0..100 range, and two arithmetic cross-checks are required; otherwise the parser abstains.'
    },
    abstentions: descriptor().boundaries
  });
};

module.exports.descriptor = descriptor;
module.exports.fetchReport = fetchReport;
module.exports.SOURCE_URL = SOURCE_URL;
module.exports.FETCH_BUDGET_MS = FETCH_BUDGET_MS;
