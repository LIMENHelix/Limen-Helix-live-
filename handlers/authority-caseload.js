/**
 * handlers/authority-caseload.js — evidence API behind /authority-portal?authority=us_courts_caseload
 *
 * GET /api/authority-caseload?authority=us_courts_caseload
 *
 * WHAT THIS SERVES. One authority: the Administrative Office of the U.S. Courts
 * "Statistical Tables for the Federal Judiciary", Table B (U.S. Courts of Appeals). It
 * fetches the published workbook, parses it through the VERSIONED reader in
 * lib/uscourts-caseload.js, and returns a fully-provenanced record or an explicit
 * abstention. It never fills a gap with a guess and never invents a value.
 *
 * WHAT IT IS NOT.
 *  - It is NOT Law's `federalCaseload` brain channel. That channel is an RSS keyword query
 *    whose units are `articles/7d` — a count of NEWS ITEMS mentioning federal caseloads.
 *    This handler serves the actual case counts published by the AO. The two share a
 *    subject and nothing else, and the portal states that difference explicitly.
 *  - Nothing here is consumed by a Law finding, a brain channel, a Thing layer, or a
 *    pathway. It creates no stress value, no diagnosis, and no activation.
 *
 * The other 13 registry authorities are deliberately unimplemented; this handler refuses
 * them by name rather than rendering an empty shell that looks built.
 */

'use strict';

var CASELOAD = require('../lib/uscourts-caseload.js');

var SUPPORTED = 'us_courts_caseload';

var BASES = [
  'https://www.uscourts.gov/sites/default/files/document/',
  'https://www.uscourts.gov/sites/default/files/data_tables/'
];
var UA = 'LIMEN-Helix/1.0 (operator evidence portal; +https://limenhelix.com)';
var FETCH_TIMEOUT_MS = 9000;

/* Reporting endpoints, newest period first. Derived from `now`, never hardcoded to a year. */
function candidateEditions(now) {
  var y = now.getUTCFullYear();
  var out = [];
  for (var yy = y; yy >= y - 3; yy--) {
    out.push({ endpoint: '1231', year: yy, periodEnd: Date.UTC(yy, 11, 31) });
    out.push({ endpoint: '630', year: yy, periodEnd: Date.UTC(yy, 5, 30) });
  }
  return out
    .filter(function (e) { return e.periodEnd <= now.getTime(); })
    .sort(function (a, b) { return b.periodEnd - a.periodEnd; });
}

function filenameFor(ed) { return 'stfj_b_' + ed.endpoint + '.' + ed.year + '.xlsx'; }

async function fetchWorkbook(ed) {
  var name = filenameFor(ed);
  var attempts = [];
  for (var i = 0; i < BASES.length; i++) {
    var url = BASES[i] + name;
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, FETCH_TIMEOUT_MS);
    try {
      var r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': '*/*' }, signal: ctrl.signal });
      clearTimeout(timer);
      if (r.status !== 200) { attempts.push({ url: url, status: r.status }); continue; }
      var buf = Buffer.from(await r.arrayBuffer());
      if (buf.slice(0, 2).toString('latin1') !== 'PK') {
        attempts.push({ url: url, status: r.status, reason: 'response is not a workbook' });
        continue;
      }
      return { ok: true, url: url, filename: name, bytes: buf.length, buffer: buf, attempts: attempts };
    } catch (e) {
      clearTimeout(timer);
      attempts.push({ url: url, error: String(e && e.message || e) });
    }
  }
  return { ok: false, filename: name, attempts: attempts };
}

/** The static description of what this evidence IS. No measured value belongs here. */
function descriptor() {
  return {
    id: SUPPORTED,
    name: 'U.S. Courts — Federal Judicial Caseload (Table B, Courts of Appeals)',
    publisher: 'Administrative Office of the United States Courts',
    series: 'Statistical Tables for the Federal Judiciary, Table B',
    landingPage: 'https://www.uscourts.gov/statistics-reports/caseload-statistics-data-tables',
    measureType: 'administrative case counts',
    observationWindow: '12 months, rolling',
    publicationInterval: 'semiannual (12-month periods ending June 30 and December 31)',
    publicationLagObserved: '18 to 42 days after period end (n=14 workbooks, median 25)',
    geographicScope: '12 regional circuits (DC, 1st-11th) plus a Total row',
    excluded: 'U.S. Court of Appeals for the Federal Circuit is not included in this table',
    units: 'cases (integer counts)',
    knownBreak: 'Beginning March 2014 the data include miscellaneous cases not previously included; series crossing that point are not comparable without adjustment.',
    suppressionRule: 'Percent change is not computed when fewer than 10 cases were reported for the previous period. Across 1,092 observed count cells the minimum was 803, so this rule was never triggered at circuit level in the surveyed vintages.',
    consumedBy: {
      lawFinding: false, brainChannel: false, thingLayer: null, pathway: false,
      statement: 'This evidence is displayed for an operator. It is not read by any Law finding, brain channel, Thing layer, or pathway, and it produces no stress value, diagnosis, or activation.'
    },
    notTheSameAs: {
      channel: 'law.federalCaseload',
      channelUnits: 'articles/7d',
      channelSource: 'RSS keyword query against uscourts.gov news items',
      statement: "Law's `federalCaseload` brain channel counts NEWS ARTICLES mentioning federal caseloads over 7 days. It is a publication-rate proxy and is not this statistic. The two must never be read as the same quantity."
    }
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Upstream changes twice a year; cache hard and revalidate in the background.
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');

  var authority = String((req.query && req.query.authority) || '').trim();

  if (!authority) {
    return res.status(400).json({
      ok: false, code: 'NO_AUTHORITY',
      detail: 'Supply ?authority=<id>.',
      supported: [SUPPORTED]
    });
  }
  if (authority !== SUPPORTED) {
    // Deliberate: the other registry authorities have no evidence implementation. Saying so
    // is the honest response; rendering an empty portal would imply one exists.
    return res.status(404).json({
      ok: false, code: 'AUTHORITY_NOT_IMPLEMENTED',
      detail: 'No evidence implementation exists for this authority. Only ' + SUPPORTED + ' is built.',
      requested: authority, supported: [SUPPORTED]
    });
  }

  var now = new Date();
  var cands = candidateEditions(now);
  var current = null, currentEd = null, tried = [];

  for (var i = 0; i < cands.length && !current; i++) {
    var got = await fetchWorkbook(cands[i]);
    tried.push({ filename: got.filename, found: got.ok, attempts: got.attempts });
    if (!got.ok) continue;
    var parsed = CASELOAD.parse(got.buffer, { filename: got.filename });
    if (!parsed.ok) {
      // A reachable file we refuse to parse is reported, not silently skipped: a schema
      // change upstream must surface as a refusal, never as a fallback to an older edition.
      return res.status(200).json({
        ok: false, code: parsed.code, detail: parsed.detail,
        refusedFile: { url: got.url, filename: got.filename, bytes: got.bytes },
        diagnostics: parsed,
        authority: descriptor(),
        abstentions: ['No values are shown because the published workbook did not validate against a declared schema version.'],
        retrievedAt: now.toISOString()
      });
    }
    current = parsed; currentEd = cands[i];
    current._source = { url: got.url, filename: got.filename, bytes: got.bytes };
  }

  if (!current) {
    return res.status(200).json({
      ok: false, code: 'NO_EDITION_RETRIEVED',
      detail: 'No published Table B workbook could be retrieved.',
      attempted: tried, authority: descriptor(),
      abstentions: ['No values are shown because no workbook was retrievable.'],
      retrievedAt: now.toISOString()
    });
  }

  /* Prior edition at the SAME reporting endpoint: its current period is this edition's
     prior period, which is the only pair that can show a restatement. */
  var priorEd = { endpoint: currentEd.endpoint, year: currentEd.year - 1 };
  var priorGot = await fetchWorkbook(priorEd);
  var prior = null, priorProblem = null;
  if (priorGot.ok) {
    var pp = CASELOAD.parse(priorGot.buffer, { filename: priorGot.filename });
    if (pp.ok) { prior = pp; prior._source = { url: priorGot.url, filename: priorGot.filename, bytes: priorGot.bytes }; }
    else priorProblem = { code: pp.code, detail: pp.detail };
  } else {
    priorProblem = { code: 'PRIOR_EDITION_UNAVAILABLE', attempts: priorGot.attempts };
  }

  var supers = prior ? CASELOAD.supersession(current, prior) : null;

  var abstentions = [];
  if (!prior) {
    abstentions.push('Revision status is not shown: the prior same-endpoint edition (' +
      filenameFor(priorEd) + ') could not be parsed, so no restatement comparison was possible.');
  }
  if (supers && supers.ok && supers.labelBoundaryCrossed) {
    abstentions.push('The two editions compared use different published labels for the first variable (' +
      supers.priorLabel + ' then ' + supers.currentLabel + '). Their equivalence is not established by any publisher documentation, so the comparison is shown as published rather than as one continuous series.');
  }
  abstentions.push('Percent change is reproduced as published; it is not recomputed here.');

  return res.status(200).json({
    ok: true,
    authority: descriptor(),
    evidence: {
      table: current.table,
      tableTitle: current.tableTitle,
      schemaVersion: current.schemaVersion,
      schemaSpan: current.schemaSpan,
      firstVariableLabel: current.firstVariableLabel,
      firstVariableEquivalenceEstablished: current.equivalenceEstablished,
      reportingEndpoint: current.endpoint,
      reportingEndpointLabel: current.endpointLabel,
      currentPeriod: current.currentPeriod,
      priorPeriod: current.priorPeriod,
      circuits: current.circuits,
      publisherNote: current.note,
      revisionMarkerDeclaredBySchema: current.revisionMarkerDeclared
    },
    supersession: supers && supers.ok ? {
      overlapPeriod: supers.overlapPeriod,
      comparedCells: supers.comparedCells,
      restatedCount: supers.restatedCount,
      changes: supers.changes,
      comparedAgainst: prior._source,
      scope: 'All three variables are compared. Absence of an observed restatement is not evidence of finality; supersession capability is retained for every variable.'
    } : null,
    supersessionUnavailable: priorProblem,
    provenance: {
      source: current._source,
      workbook: current.workbook,
      retrievedAt: now.toISOString(),
      parser: 'lib/uscourts-caseload.js',
      validation: 'normalised headers + expected cell positions + required merged ranges; unknown schemas are refused'
    },
    abstentions: abstentions
  });
};

module.exports.candidateEditions = candidateEditions;
module.exports.descriptor = descriptor;
module.exports.filenameFor = filenameFor;
