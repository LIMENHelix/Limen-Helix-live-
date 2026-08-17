/**
 * Evidence API for /authority-portal?authority=wjp_rol_index.
 * Annual WJP scores are operator evidence only. They do not enter the 30-second
 * domain loop and cannot create stress, a diagnosis, or pathway activation.
 */
'use strict';

var WJP = require('../lib/wjp-rule-of-law.js');

var SUPPORTED = 'wjp_rol_index';
var SOURCE_URL = 'https://worldjusticeproject.org/rule-of-law-index/downloads/2025_wjp_rule_of_law_index_HISTORICAL_DATA_FILE.xlsx';
var UA = 'LIMEN-Helix/1.0 (operator evidence portal; +https://limenhelix.com)';
var FETCH_BUDGET_MS = 7000;
var CACHE_SUCCESS = 's-maxage=86400, stale-while-revalidate=604800';
var CACHE_TRANSIENT = 's-maxage=60, stale-while-revalidate=0';
var CACHE_NEVER = 'no-store';

function respond(res, status, cache, body) {
  res.setHeader('Cache-Control', cache);
  return res.status(status).json(body);
}

function descriptor() {
  return {
    id: SUPPORTED,
    name: 'World Justice Project — Rule of Law Index',
    publisher: 'World Justice Project',
    series: 'WJP Rule of Law Index 2025, Current & Historical Data',
    landingPage: 'https://worldjusticeproject.org/rule-of-law-index/',
    methodologyPage: 'https://worldjusticeproject.org/rule-of-law-index/about',
    measureType: 'annual composite index derived from household and expert surveys',
    publicationInterval: 'annual',
    geographicScope: '143 countries and jurisdictions in the 2025 edition',
    units: 'score from 0 to 1, where 1 is stronger adherence to the rule of law',
    consumedBy: {
      lawFinding: false, brainChannel: false, thingLayer: null, pathway: false,
      statement: 'This annual evidence is displayed for an operator. No Law finding, brain channel, Thing layer, or pathway reads it, and it produces no stress value, diagnosis, or activation.'
    },
    comparability: 'The portal begins its time series at 2015. WJP cautions that pre-2015 editions are not strictly comparable; the 2025 methodology uses a 2015 base year.',
    changeBoundary: 'The arithmetic difference shown here is current score minus prior score. It is not WJP statistical significance. WJP assesses significant change using bootstrap samples and statistical tests that are not present in the historical workbook.',
    operatorUse: 'Use this view to compare the published overall and factor scores for one jurisdiction across annual editions, identify which factor changed most arithmetically, and open the publisher source for methodological interpretation.'
  };
}

function projectMetric(metric) {
  return {
    value: metric.value,
    raw: metric.raw,
    units: metric.transformedUnits,
    provenance: metric.provenance
  };
}

function projectObservation(o) {
  if (!o) return null;
  var metrics = {};
  Object.keys(o.metrics).forEach(function (k) { metrics[k] = projectMetric(o.metrics[k]); });
  return {
    country: o.country, countryCode: o.countryCode, region: o.region,
    year: o.year, publishedYearLabel: o.publishedYearLabel, metrics: metrics
  };
}

async function fetchWorkbook() {
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, FETCH_BUDGET_MS);
  var started = Date.now();
  try {
    var r = await fetch(SOURCE_URL, {
      headers: { 'User-Agent': UA, 'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*' },
      signal: ctrl.signal
    });
    if (r.status !== 200) {
      clearTimeout(timer);
      return { ok: false, code: 'UPSTREAM_HTTP_' + r.status, detail: 'The official WJP workbook returned HTTP ' + r.status + '.', elapsedMs: Date.now() - started };
    }
    var ab = await r.arrayBuffer();
    clearTimeout(timer);
    var buf = Buffer.from(ab);
    if (buf.length < 1000 || buf.slice(0, 2).toString('latin1') !== 'PK') {
      return { ok: false, code: 'UPSTREAM_NOT_WORKBOOK', detail: 'The official WJP URL did not return workbook bytes.', elapsedMs: Date.now() - started };
    }
    return {
      ok: true, buffer: buf, bytes: buf.length, elapsedMs: Date.now() - started,
      sourceUpdatedAt: r.headers.get('last-modified') || null,
      sourceEtag: r.headers.get('etag') || null
    };
  } catch (e) {
    clearTimeout(timer);
    var timeout = e && (e.name === 'AbortError' || /abort/i.test(String(e.message || '')));
    return {
      ok: false,
      code: timeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_FETCH_FAILED',
      detail: timeout ? 'The official WJP workbook did not finish within the bounded fetch budget.' : String(e && e.message || e),
      elapsedMs: Date.now() - started
    };
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  var authority = String((req.query && req.query.authority) || '').trim();
  var country = String((req.query && req.query.country) || 'USA').trim().toUpperCase();

  if (!authority) return respond(res, 400, CACHE_NEVER, { ok: false, code: 'NO_AUTHORITY', detail: 'Supply ?authority=<id>.', supported: [SUPPORTED] });
  if (authority !== SUPPORTED) return respond(res, 404, CACHE_TRANSIENT, {
    ok: false, code: 'AUTHORITY_NOT_IMPLEMENTED', detail: 'This handler implements only ' + SUPPORTED + '.', requested: authority, supported: [SUPPORTED]
  });
  if (!/^[A-Z]{3}$/.test(country)) return respond(res, 400, CACHE_NEVER, {
    ok: false, code: 'INVALID_COUNTRY_CODE', detail: 'Supply a three-letter country code, for example ?country=USA.', requested: country
  });

  var got = await fetchWorkbook();
  if (!got.ok) return respond(res, 200, CACHE_TRANSIENT, {
    ok: false, code: got.code, detail: got.detail, authority: descriptor(),
    abstentions: ['No values are shown because the official workbook was not retrieved within the bounded request.'],
    retrievedAt: new Date().toISOString(), diagnostics: { sourceUrl: SOURCE_URL, elapsedMs: got.elapsedMs }
  });

  var parsed = WJP.parse(got.buffer);
  if (!parsed.ok) return respond(res, 200, CACHE_TRANSIENT, {
    ok: false, code: parsed.code, detail: parsed.detail, authority: descriptor(),
    abstentions: ['No values are shown because the workbook did not validate against the reviewed 2025 schema.'],
    diagnostics: parsed,
    refusedFile: { url: SOURCE_URL, bytes: got.bytes, sourceSha256: parsed.sourceSha256, sourceUpdatedAt: got.sourceUpdatedAt },
    retrievedAt: new Date().toISOString()
  });

  var view = WJP.countryView(parsed, country);
  if (!view.ok) return respond(res, 404, CACHE_TRANSIENT, {
    ok: false, code: view.code, detail: view.detail, requested: country,
    authority: descriptor(), availableCountries: parsed.countries,
    abstentions: ['No country values are shown because the requested current observation does not exist.']
  });

  var retrievedAt = new Date().toISOString();
  WJP.stampMetrics(parsed, {
    sourceUrl: SOURCE_URL,
    sourceUpdatedAt: got.sourceUpdatedAt,
    retrievedAt: retrievedAt
  });

  var history = view.history.map(function (o) {
    return {
      year: o.year,
      publishedYearLabel: o.publishedYearLabel,
      overall: projectMetric(o.metrics.overall)
    };
  });

  return respond(res, 200, CACHE_SUCCESS, {
    ok: true,
    viewKind: 'wjp_rule_of_law',
    authority: descriptor(),
    evidence: {
      edition: parsed.edition,
      schemaVersion: parsed.schemaVersion,
      currentCountryCount: parsed.currentCountryCount,
      selected: projectObservation(view.current),
      prior: projectObservation(view.prior),
      history: history,
      arithmeticChanges: view.arithmeticChanges,
      changeInterpretation: 'Arithmetic only: current published score minus prior published score. No significance, causation, stress, diagnosis, or activation is inferred.'
    },
    availableCountries: parsed.countries,
    provenance: {
      source: {
        url: SOURCE_URL,
        filename: '2025_wjp_rule_of_law_index_HISTORICAL_DATA_FILE.xlsx',
        bytes: got.bytes,
        sourceUpdatedAt: got.sourceUpdatedAt,
        sourceEtag: got.sourceEtag
      },
      sourceSha256: parsed.sourceSha256,
      sourceBytes: parsed.sourceBytes,
      workbook: parsed.workbook,
      retrievedAt: retrievedAt,
      elapsedMs: got.elapsedMs,
      parser: 'lib/wjp-rule-of-law.js',
      parserVersion: WJP.PARSER_VERSION,
      transformVersion: WJP.TRANSFORM_VERSION,
      validation: 'Exact Historical Data sheet; 58-column reviewed schema; exact consumed header names; unique country-year identities; score range 0..1; 2025 edition; 143 current observations.',
      transformation: 'Published score text is converted to a number on the same 0..1 scale. Arithmetic changes subtract the prior published score from the current published score. No rescaling, weighting, imputation, ranking, or significance test is performed.'
    },
    abstentions: [
      'No significance claim is made from arithmetic score differences.',
      'No causal explanation is inferred from a factor score.',
      'No pre-2015 comparison is rendered.',
      'No annual score is used as a 30-second sensor or allowed to manufacture stress, a diagnosis, or pathway activation.'
    ]
  });
};

module.exports.descriptor = descriptor;
module.exports.fetchWorkbook = fetchWorkbook;
module.exports.SOURCE_URL = SOURCE_URL;
module.exports.FETCH_BUDGET_MS = FETCH_BUDGET_MS;
module.exports.CACHE_SUCCESS = CACHE_SUCCESS;
module.exports.CACHE_TRANSIENT = CACHE_TRANSIENT;
module.exports.CACHE_NEVER = CACHE_NEVER;
