/**
 * Operator evidence API for Pew Research Center's 2023 GRI and SHI charts.
 * The two indexes remain separate published axes; no composite is created.
 */
'use strict';

var PEW = require('../lib/pew-global-restrictions.js');

var SUPPORTED = 'pew_global_restrictions';
var GRI_URL = 'https://www.pewresearch.org/chart/government-restrictions-on-religion-around-the-world-in-2023/';
var SHI_URL = 'https://www.pewresearch.org/chart/social-hostilities-involving-religion-around-the-world-in-2023/';
var INTERACTIVE_URL = 'https://www.pewresearch.org/religion/feature/religious-restrictions-around-the-world/';
var METHODOLOGY_URL = 'https://www.pewresearch.org/religion/2026/06/15/religious-restrictions-2023-methodology/';
var ERRATA_URL = 'https://www.pewresearch.org/religion/2026/06/15/errata-religious-restrictions-around-the-world/';
var UA = 'LIMEN-Helix/1.0 (operator evidence portal; +https://limenhelix.com)';
var FETCH_BUDGET_MS = 8000;
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
    name: 'Pew global restrictions on religion',
    publisher: 'Pew Research Center',
    landingPage: INTERACTIVE_URL,
    methodologyPage: METHODOLOGY_URL,
    errataPage: ERRATA_URL,
    measureType: 'two separate human-coded, multi-source country indexes',
    referencePeriod: 'calendar year 2023',
    publicationDate: PEW.PUBLICATION_DATE,
    publicationInterval: 'annual study; the 2023 observations were published in June 2026',
    geographicScope: '198 countries and self-governing territories in five published regions',
    units: {
      gri: PEW.AXES.gri.units,
      shi: PEW.AXES.shi.units
    },
    operatorUse: 'Use the two axes together to distinguish government-imposed restrictions from social hostilities. Inspect the published scores and categories separately; do not collapse them into an overall restriction score.',
    consumedBy: {
      religionFinding: false,
      brainChannel: false,
      thingLayer: null,
      pathway: false,
      statement: 'These annual index observations are displayed for an operator. No Religion finding, brain channel, Thing layer, or pathway reads them, and they produce no stress value, diagnosis, composite score, or activation.'
    },
    boundaries: [
      'GRI measures laws, policies and actions by government officials that restrict religious beliefs and practices. SHI measures actions by private individuals or groups. They are different variables and are never averaged or summed here.',
      'A 2023 score is a calendar-year observation published in June 2026, not a current reading and not a 2026 observation.',
      'The published categories use different thresholds on the two indexes. A GRI category must not be applied to SHI or vice versa.',
      'Pew describes the study as human coding of more than a dozen public sources. This portal does not treat the two indexes, or Pew and USCIRF, as proven independent evidence systems.',
      'The indexes measure reported restrictions and hostilities, not religious freedom, religious vitality, doctrinal truth, institutional health, or whether a restriction is justified.',
      'Country identity is joined only across the two official tables. Two reviewed Congo label differences are preserved and explicitly mapped; no fuzzy country matching is allowed.',
      'Pew published a June 2026 correction affecting six countries\' 2017 GRI values. This portal displays only 2023 and makes no claim about historical revisions or trend continuity.',
      'No annual index value may drive the 30-second loop or directly manufacture stress, a diagnosis, or pathway activation.'
    ]
  };
}

async function fetchPage(url) {
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
      detail: timeout ? 'A Pew chart did not finish within the bounded fetch budget.' : String(e && e.message || e),
      elapsedMs: Date.now() - started
    };
  }
}

function categoryCounts(countries, axis) {
  var counts = { Low: 0, Moderate: 0, High: 0, 'Very high': 0 };
  countries.forEach(function (country) { counts[country[axis].category]++; });
  return counts;
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

  var fetched = await Promise.all([fetchPage(GRI_URL), fetchPage(SHI_URL)]);
  var gotGri = fetched[0], gotShi = fetched[1];
  if (!gotGri.ok || !gotShi.ok) return respond(res, 200, CACHE_TRANSIENT, {
    ok: false,
    code: 'UPSTREAM_PAIR_INCOMPLETE',
    detail: 'Both official Pew chart pages are required for the paired operator view.',
    authority: descriptor(),
    abstentions: ['No country scores are shown because one or both official chart pages were not retrieved.'],
    diagnostics: {
      gri: { ok: gotGri.ok, status: gotGri.status, code: gotGri.code || null, elapsedMs: gotGri.elapsedMs },
      shi: { ok: gotShi.ok, status: gotShi.status, code: gotShi.code || null, elapsedMs: gotShi.elapsedMs }
    }
  });

  var gri = PEW.parseChart(gotGri.html, 'gri');
  var shi = PEW.parseChart(gotShi.html, 'shi');
  if (!gri.ok || !shi.ok) {
    var failed = !gri.ok ? gri : shi;
    return respond(res, 200, CACHE_TRANSIENT, {
      ok: false, code: failed.code, detail: failed.detail,
      authority: descriptor(),
      abstentions: ['No country scores are shown because an official chart did not validate against the reviewed contract.'],
      diagnostics: { gri: gri.ok ? { ok: true } : gri, shi: shi.ok ? { ok: true } : shi },
      retrievedAt: new Date().toISOString()
    });
  }

  var paired = PEW.pair(gri, shi);
  if (!paired.ok) return respond(res, 200, CACHE_TRANSIENT, {
    ok: false, code: paired.code, detail: paired.detail,
    authority: descriptor(),
    abstentions: ['No country scores are shown because the two official chart memberships could not be joined exactly.'],
    diagnostics: paired,
    retrievedAt: new Date().toISOString()
  });

  var retrievedAt = new Date().toISOString();
  PEW.stamp(paired, {
    gri: { sourceUrl: GRI_URL, sourceUpdatedAt: gotGri.sourceUpdatedAt, retrievedAt: retrievedAt },
    shi: { sourceUrl: SHI_URL, sourceUpdatedAt: gotShi.sourceUpdatedAt, retrievedAt: retrievedAt }
  });

  return respond(res, 200, CACHE_SUCCESS, {
    ok: true,
    viewKind: 'pew_global_restrictions',
    authority: descriptor(),
    evidence: {
      referenceYear: paired.referenceYear,
      publicationDate: paired.publicationDate,
      countryCount: paired.countries.length,
      categoryCounts: {
        gri: categoryCounts(paired.countries, 'gri'),
        shi: categoryCounts(paired.countries, 'shi')
      },
      thresholds: {
        gri: PEW.AXES.gri.thresholds,
        shi: PEW.AXES.shi.thresholds
      },
      countries: paired.countries
    },
    provenance: {
      sources: {
        gri: {
          url: GRI_URL,
          sourceUpdatedAt: gotGri.sourceUpdatedAt,
          sourceEtag: gotGri.sourceEtag,
          sourceSha256: paired.sources.gri.sourceSha256,
          sourceBytes: paired.sources.gri.sourceBytes,
          elapsedMs: gotGri.elapsedMs
        },
        shi: {
          url: SHI_URL,
          sourceUpdatedAt: gotShi.sourceUpdatedAt,
          sourceEtag: gotShi.sourceEtag,
          sourceSha256: paired.sources.shi.sourceSha256,
          sourceBytes: paired.sources.shi.sourceBytes,
          elapsedMs: gotShi.elapsedMs
        }
      },
      retrievedAt: retrievedAt,
      parser: 'lib/pew-global-restrictions.js',
      parserVersion: PEW.PARSER_VERSION,
      transformVersion: PEW.TRANSFORM_VERSION,
      transformation: 'Two official 198-row chart tables are validated independently, joined by exact reviewed country identity, and retained as separate GRI and SHI observations. No composite, interpolation, ranking, or trend is created.',
      validation: 'Exact chart titles, publication date, source statements, score headers, 198 unique rows per axis, closed 0..10 scores, axis-specific category thresholds, five published regions, and exact paired membership are required; otherwise the reader abstains.'
    },
    abstentions: descriptor().boundaries
  });
};

module.exports.descriptor = descriptor;
module.exports.fetchPage = fetchPage;
module.exports.GRI_URL = GRI_URL;
module.exports.SHI_URL = SHI_URL;
module.exports.FETCH_BUDGET_MS = FETCH_BUDGET_MS;
