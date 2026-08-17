/**
 * Operator evidence API for ARDA's public U.S. congregational membership report.
 * This reads public HTML only; it does not accept the archive download agreement.
 */
'use strict';

var ARDA = require('../lib/arda-congregational-trends.js');

var SUPPORTED = 'arda_congregational_trends';
var REPORT_URL = 'https://www.thearda.com/us-religion/census/congregational-membership?t=4&y=2020';
var ARCHIVE_URL = 'https://thearda.com/data-archive?fid=RCMSST20';
var SOURCES_URL = 'https://www.thearda.com/us-religion/sources-for-religious-congregations-membership-data';
var DOI_URL = 'https://doi.org/10.17605/OSF.IO/6PGRZ';
var UA = 'LIMEN-Helix/1.0 (operator evidence portal; +https://limenhelix.com)';
var FETCH_BUDGET_MS = 10000;
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
    name: 'ARDA congregational membership trends',
    publisher: 'Association of Religion Data Archives (ARDA)',
    originalCollector: 'Association of Statisticians of American Religious Bodies (ASARB)',
    landingPage: REPORT_URL,
    archivePage: ARCHIVE_URL,
    sourcesPage: SOURCES_URL,
    doi: DOI_URL,
    measureType: 'decennial administrative counts and published tradition shares',
    referencePeriod: '1980, 1990, 2000, 2010, and 2020 tradition shares; 2020 body detail',
    publicationInterval: 'decennial U.S. Religion Census; latest displayed reference year is 2020',
    geographicScope: 'United States',
    operatorUse: 'Use the five published decennial snapshots to inspect long-window changes in the reported religious-body landscape, then drill into the 372-body 2020 table. Treat changes as questions for follow-up because coverage and collection methods change across censuses.',
    consumedBy: {
      religionFinding: false,
      brainChannel: false,
      thingLayer: null,
      pathway: false,
      statement: 'This evidence is displayed for an operator only. No Religion finding, brain channel, Thing layer, or pathway reads it, and it produces no stress value, diagnosis, ranking, or activation.'
    },
    boundaries: [
      'Congregations and adherents are administrative/reporting constructs whose exact definitions vary by religious body. They are not attendance, belief, participation intensity, institutional health, or resilience.',
      'ARDA is the archive and display publisher; ASARB designed and carried out the 2020 census. Those labels do not establish independent corroboration.',
      'The chart publishes percentages for 13 traditions across five decennial years. ARDA warns that collection methods change over time, so the portal preserves the values but does not calculate a growth rate, rank, or causal trend.',
      'The 2020 body table has adherent values for 217 bodies and congregation-only values for 155. Missing adherent values remain missing and are not imputed as zero.',
      'Some membership totals were estimated by the publisher. This portal does not recreate or validate those estimates.',
      'The 372 displayed body rows sum to a different congregation total than ARDA\'s archive summary. Both figures are retained and the 268 difference is unresolved; neither is silently preferred.',
      'ARDA added 21 RELTRAD variables in January 2024. That is an augmentation/revision boundary, not evidence that every historical category is definitionally stable.',
      'No decennial value may drive the 30-second loop or directly manufacture stress, a diagnosis, or pathway activation.'
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
      detail: timeout ? 'An ARDA source did not finish within the bounded fetch budget.' : String(e && e.message || e),
      elapsedMs: Date.now() - started
    };
  }
}

function traditionMatrix(parsed) {
  return parsed.traditions.map(function (spec) {
    return {
      field: spec.field,
      tradition: spec.name,
      observations: parsed.traditionObservations.filter(function (x) { return x.field === spec.field; })
    };
  });
}

function observationCount(parsed) {
  var n = parsed.traditionObservations.length;
  parsed.bodies.forEach(function (x) {
    n += 1;
    if (x.observations.adherents) n++;
    if (x.observations.adherenceRate) n++;
  });
  return n;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  var authority = String((req.query && req.query.authority) || '').trim();
  if (!authority) return respond(res, 400, CACHE_NEVER, {
    ok: false, code: 'NO_AUTHORITY', detail: 'Supply ?authority=<id>.', supported: [SUPPORTED]
  });
  if (authority !== SUPPORTED) return respond(res, 404, CACHE_TRANSIENT, {
    ok: false, code: 'AUTHORITY_NOT_IMPLEMENTED', detail: 'This handler implements only ' + SUPPORTED + '.',
    requested: authority, supported: [SUPPORTED]
  });

  var fetched = await Promise.all([fetchPage(REPORT_URL), fetchPage(ARCHIVE_URL)]);
  var reportFetch = fetched[0], archiveFetch = fetched[1];
  if (!reportFetch.ok || !archiveFetch.ok) return respond(res, 200, CACHE_TRANSIENT, {
    ok: false, code: 'UPSTREAM_PAIR_INCOMPLETE',
    detail: 'Both official ARDA public pages are required for the reconciled operator view.',
    authority: descriptor(),
    abstentions: ['No values are shown because the public membership report or archive summary was not retrieved.'],
    diagnostics: {
      report: { ok: reportFetch.ok, status: reportFetch.status, code: reportFetch.code || null, elapsedMs: reportFetch.elapsedMs },
      archive: { ok: archiveFetch.ok, status: archiveFetch.status, code: archiveFetch.code || null, elapsedMs: archiveFetch.elapsedMs }
    }
  });

  var report = ARDA.parseReport(reportFetch.html);
  var archive = ARDA.parseArchiveSummary(archiveFetch.html);
  if (!report.ok || !archive.ok) {
    var failed = !report.ok ? report : archive;
    return respond(res, 200, CACHE_TRANSIENT, {
      ok: false, code: failed.code, detail: failed.detail,
      authority: descriptor(),
      abstentions: ['No values are shown because one official ARDA page did not validate against the reviewed contract.'],
      diagnostics: { report: report.ok ? { ok: true } : report, archive: archive.ok ? { ok: true } : archive },
      retrievedAt: new Date().toISOString()
    });
  }

  var retrievedAt = new Date().toISOString();
  var stamped = ARDA.stamp(report, archive, {
    report: { sourceUrl: REPORT_URL, sourceUpdatedAt: reportFetch.sourceUpdatedAt, retrievedAt: retrievedAt }
  });
  if (!stamped.ok) return respond(res, 200, CACHE_TRANSIENT, stamped);

  return respond(res, 200, CACHE_SUCCESS, {
    ok: true,
    viewKind: 'arda_congregational_trends',
    authority: descriptor(),
    evidence: {
      referenceYear: report.referenceYear,
      population: report.population,
      publishedAdherents: report.publishedAdherents,
      publishedAdherentSharePercent: report.publishedAdherentSharePercent,
      bodyCounts: report.bodyCounts,
      traditionYears: report.traditionYears,
      traditions: traditionMatrix(report),
      bodies: report.bodies,
      archive: {
        doi: archive.doi,
        citationDate: archive.citationDate,
        reltradAugmentation: archive.reltradAugmentation,
        cases: archive.cases,
        variables: archive.variables,
        weightVariable: archive.weightVariable,
        totals: archive.totals
      },
      reconciliation: stamped.reconciliation,
      observationCount: observationCount(report)
    },
    provenance: {
      sources: {
        report: {
          url: REPORT_URL,
          sourceUpdatedAt: reportFetch.sourceUpdatedAt,
          sourceEtag: reportFetch.sourceEtag,
          sourceSha256: report.sourceSha256,
          sourceBytes: report.sourceBytes,
          elapsedMs: reportFetch.elapsedMs
        },
        archive: {
          url: ARCHIVE_URL,
          sourceUpdatedAt: archiveFetch.sourceUpdatedAt,
          sourceEtag: archiveFetch.sourceEtag,
          sourceSha256: archive.sourceSha256,
          sourceBytes: archive.sourceBytes,
          elapsedMs: archiveFetch.elapsedMs
        }
      },
      retrievedAt: retrievedAt,
      parser: 'lib/arda-congregational-trends.js',
      parserVersion: ARDA.PARSER_VERSION,
      transformVersion: ARDA.TRANSFORM_VERSION,
      transformation: 'Published body counts, rates, and chart percentages are retained by identity transformation. Missing adherent values remain null. No interpolation, normalization, ranking, composite, or trend score is created.',
      validation: 'The reader requires the exact six body-table headers, 372 unique body identities, the reviewed 217/155 coverage split, reproducible published rates, exact five-year and 13-tradition chart vocabularies, and the reviewed archive markers and totals; otherwise it abstains.'
    },
    abstentions: descriptor().boundaries
  });
};

module.exports.descriptor = descriptor;
module.exports.fetchPage = fetchPage;
module.exports.REPORT_URL = REPORT_URL;
module.exports.ARCHIVE_URL = ARCHIVE_URL;
module.exports.FETCH_BUDGET_MS = FETCH_BUDGET_MS;
