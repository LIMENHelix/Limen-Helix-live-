/**
 * handlers/authority-caseload.js — evidence API behind /authority-portal?authority=us_courts_caseload
 *
 * GET /api/authority-caseload?authority=us_courts_caseload
 *
 * WHAT THIS SERVES. One authority: the Administrative Office of the U.S. Courts
 * "Statistical Tables for the Federal Judiciary", Table B (U.S. Courts of Appeals). It
 * fetches the published workbook, parses it through the VERSIONED reader in
 * lib/uscourts-caseload.js, and returns a fully-provenanced observation or an explicit
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
 *
 * ── TWO OPERATIONAL RULES THAT ARE EASY TO GET WRONG ────────────────────────────────────
 *
 * 1. THE UPSTREAM BUDGET IS BOUNDED IN TOTAL, not per request. Editions are probed newest
 *    first across two directories, so a naive per-attempt timeout multiplies: before a new
 *    edition is published, the newest candidates legitimately 404 or hang, and a handful of
 *    slow misses can burn the whole function budget before reaching the edition that
 *    exists. One deadline governs every attempt, and running out of budget is reported as
 *    an abstention rather than a hang.
 *
 * 2. CACHE SUCCESS HARD, NEVER CACHE A REFUSAL HARD. The upstream changes twice a year, so
 *    validated evidence is cached for hours. A refusal or a transient upstream failure is
 *    cached for one minute at most: caching those for six hours plus stale-while-revalidate
 *    would pin a broken or empty portal in front of an operator long after upstream
 *    recovered.
 */

'use strict';

var CASELOAD = require('../lib/uscourts-caseload.js');

var SUPPORTED = 'us_courts_caseload';

var BASES = [
  'https://www.uscourts.gov/sites/default/files/document/',
  'https://www.uscourts.gov/sites/default/files/data_tables/'
];
var UA = 'LIMEN-Helix/1.0 (operator evidence portal; +https://limenhelix.com)';

/* One budget for every upstream attempt in a request, and a per-attempt ceiling inside it. */
var TOTAL_FETCH_BUDGET_MS = 7000;
var PER_ATTEMPT_TIMEOUT_MS = 2500;

/* Cache only VALIDATED evidence for long. Everything else is short-lived. */
var CACHE_SUCCESS = 's-maxage=21600, stale-while-revalidate=86400';
var CACHE_TRANSIENT = 's-maxage=60, stale-while-revalidate=0';
var CACHE_NEVER = 'no-store';

function respond(res, status, cacheControl, body) {
  res.setHeader('Cache-Control', cacheControl);
  return res.status(status).json(body);
}

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

/**
 * fetchWorkbook(ed, deadlineMs) — try each directory until one returns a workbook.
 * Every attempt is clipped to whatever remains of the shared deadline.
 */
async function fetchWorkbook(ed, deadlineMs) {
  var name = filenameFor(ed);
  var attempts = [];
  for (var i = 0; i < BASES.length; i++) {
    var remaining = deadlineMs - Date.now();
    if (remaining <= 50) {
      return { ok: false, filename: name, budgetExhausted: true, attempts: attempts };
    }
    var url = BASES[i] + name;
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, Math.min(PER_ATTEMPT_TIMEOUT_MS, remaining));
    var startedAt = Date.now();
    try {
      var r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': '*/*' }, signal: ctrl.signal });
      if (r.status !== 200) {
        clearTimeout(timer);
        attempts.push({ url: url, status: r.status, ms: Date.now() - startedAt });
        continue;
      }
      /* THE ABORT TIMER STAYS ARMED THROUGH BODY CONSUMPTION. Headers arriving is not the
         end of the attempt: a 200 whose body then stalls would hang forever if the timer
         were cleared here, because arrayBuffer() has no timeout of its own and the shared
         deadline can only be enforced through this signal. Clear it once the bytes are in
         hand, and in the catch. */
      var ab = await r.arrayBuffer();
      clearTimeout(timer);
      var buf = Buffer.from(ab);
      if (buf.slice(0, 2).toString('latin1') !== 'PK') {
        attempts.push({ url: url, status: r.status, reason: 'response is not a workbook', ms: Date.now() - startedAt });
        continue;
      }
      return {
        ok: true, url: url, filename: name, bytes: buf.length, buffer: buf, attempts: attempts,
        // The publisher's own statement of when this artefact last changed, when it gives one.
        sourceUpdatedAt: r.headers.get('last-modified') || null,
        sourceEtag: r.headers.get('etag') || null,
        fetchMs: Date.now() - startedAt
      };
    } catch (e) {
      clearTimeout(timer);
      var aborted = e && (e.name === 'AbortError' || /abort/i.test(String(e.message || '')));
      attempts.push({ url: url, error: aborted ? 'timeout' : String(e && e.message || e), ms: Date.now() - startedAt });
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

  var authority = String((req.query && req.query.authority) || '').trim();

  if (!authority) {
    return respond(res, 400, CACHE_NEVER, {
      ok: false, code: 'NO_AUTHORITY', detail: 'Supply ?authority=<id>.', supported: [SUPPORTED]
    });
  }
  if (authority !== SUPPORTED) {
    // Deliberate: the other registry authorities have no evidence implementation. Saying so
    // is the honest response; rendering an empty portal would imply one exists. This answer
    // is a property of the code, not of upstream, so it is safe to cache briefly.
    return respond(res, 404, CACHE_TRANSIENT, {
      ok: false, code: 'AUTHORITY_NOT_IMPLEMENTED',
      detail: 'No evidence implementation exists for this authority. Only ' + SUPPORTED + ' is built.',
      requested: authority, supported: [SUPPORTED]
    });
  }

  var startedAt = Date.now();
  var deadline = startedAt + TOTAL_FETCH_BUDGET_MS;
  var now = new Date(startedAt);
  var cands = candidateEditions(now);
  var current = null, currentEd = null, tried = [], budgetExhausted = false;

  for (var i = 0; i < cands.length && !current; i++) {
    if (Date.now() >= deadline) { budgetExhausted = true; break; }
    var got = await fetchWorkbook(cands[i], deadline);
    tried.push({ filename: got.filename, found: got.ok, attempts: got.attempts, budgetExhausted: !!got.budgetExhausted });
    if (got.budgetExhausted) { budgetExhausted = true; break; }
    if (!got.ok) continue;

    var parsed = CASELOAD.parse(got.buffer, { filename: got.filename });
    if (!parsed.ok) {
      // A reachable file we refuse to parse is reported, not silently skipped: a schema
      // change upstream must surface as a refusal, never as a fallback to an older edition.
      // Never cached hard — upstream may correct it within the hour.
      return respond(res, 200, CACHE_TRANSIENT, {
        ok: false, code: parsed.code, detail: parsed.detail,
        refusedFile: {
          url: got.url, filename: got.filename, bytes: got.bytes,
          sourceSha256: parsed.sourceSha256 || null,
          sourceUpdatedAt: got.sourceUpdatedAt, sourceEtag: got.sourceEtag
        },
        diagnostics: parsed,
        authority: descriptor(),
        abstentions: ['No values are shown because the published workbook did not validate against a declared schema version.'],
        retrievedAt: new Date().toISOString(),
        parserVersion: CASELOAD.PARSER_VERSION
      });
    }
    current = parsed; currentEd = cands[i];
    current._source = {
      url: got.url, filename: got.filename, bytes: got.bytes,
      sourceUpdatedAt: got.sourceUpdatedAt, sourceEtag: got.sourceEtag, fetchMs: got.fetchMs
    };
  }

  if (!current) {
    return respond(res, 200, CACHE_TRANSIENT, {
      ok: false,
      code: budgetExhausted ? 'UPSTREAM_BUDGET_EXHAUSTED' : 'NO_EDITION_RETRIEVED',
      detail: budgetExhausted
        ? 'The upstream fetch budget of ' + TOTAL_FETCH_BUDGET_MS + 'ms was spent before an edition could be retrieved.'
        : 'No published Table B workbook could be retrieved.',
      attempted: tried, elapsedMs: Date.now() - startedAt,
      authority: descriptor(),
      abstentions: ['No values are shown because no workbook was retrievable within the request budget.'],
      retrievedAt: new Date().toISOString(),
      parserVersion: CASELOAD.PARSER_VERSION
    });
  }

  /* Prior edition at the SAME reporting endpoint: its current period is this edition's
     prior period, which is the only pair that can show a restatement. Best-effort — it is
     skipped rather than allowed to overrun the budget, and its absence is an abstention. */
  var priorEd = { endpoint: currentEd.endpoint, year: currentEd.year - 1 };
  var prior = null, priorProblem = null;
  if (Date.now() >= deadline) {
    priorProblem = { code: 'PRIOR_EDITION_SKIPPED_BUDGET', detail: 'Fetch budget spent on the current edition.' };
  } else {
    var priorGot = await fetchWorkbook(priorEd, deadline);
    if (priorGot.ok) {
      var pp = CASELOAD.parse(priorGot.buffer, { filename: priorGot.filename });
      if (pp.ok) {
        prior = pp;
        prior._source = {
          url: priorGot.url, filename: priorGot.filename, bytes: priorGot.bytes,
          sourceSha256: pp.sourceSha256, sourceUpdatedAt: priorGot.sourceUpdatedAt, sourceEtag: priorGot.sourceEtag
        };
      } else priorProblem = { code: pp.code, detail: pp.detail };
    } else {
      priorProblem = {
        code: priorGot.budgetExhausted ? 'PRIOR_EDITION_SKIPPED_BUDGET' : 'PRIOR_EDITION_UNAVAILABLE',
        attempts: priorGot.attempts
      };
    }
  }

  var supers = prior ? CASELOAD.supersession(current, prior) : null;

  var abstentions = [];
  if (!prior) {
    abstentions.push('Revision status is not shown: the prior same-endpoint edition (' +
      filenameFor(priorEd) + ') was not parsed' +
      (priorProblem && /BUDGET/.test(priorProblem.code) ? ' within the request budget' : '') +
      ', so no restatement comparison was possible.');
  }
  if (supers && supers.ok && supers.labelBoundaryCrossed) {
    abstentions.push('The two editions compared use different published labels for the first variable (' +
      supers.priorLabel + ' then ' + supers.currentLabel + '). Their equivalence is not established by any publisher documentation, so the comparison is shown as published rather than as one continuous series.');
  }
  abstentions.push('Percent change is reproduced as published; it is not recomputed here.');

  var retrievedAt = new Date().toISOString();

  /* Complete the observation-level provenance with the facts only the fetch knows. The
     parser has already stamped source identity and code versions onto every observation;
     these two are network-time and cannot be derived from the bytes. */
  CASELOAD.stampObservations(current, {
    sourceUrl: current._source.url,
    sourceUpdatedAt: current._source.sourceUpdatedAt,
    retrievedAt: retrievedAt
  });

  return respond(res, 200, CACHE_SUCCESS, {
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

    /* Observation provenance: what the artefact was, when it changed, when we read it, and
       exactly which code turned bytes into the numbers above. */
    provenance: {
      source: current._source,
      sourceSha256: current.sourceSha256,            // immutable identifier for these bytes
      sourceBytes: current.sourceBytes,
      sourceUpdatedAt: current._source.sourceUpdatedAt,   // publisher's Last-Modified, if given
      workbookCreated: current.workbook.created,          // the workbook's own timestamps
      workbookModified: current.workbook.modified,
      retrievedAt: retrievedAt,
      elapsedMs: Date.now() - startedAt,
      workbook: current.workbook,
      parser: 'lib/uscourts-caseload.js',
      parserVersion: current.parserVersion,
      transformVersion: current.transformVersion,
      transformation: 'Cell text is converted to integers (counts) and floats (percent change). No rescaling, no unit conversion, no imputation. Both the raw published text and the transformed value are carried per cell.',
      rawUnits: 'cases, as published integer text',
      transformedUnits: 'cases (integer)',
      validation: 'normalised headers + expected cell positions + required merged ranges + cross-group period agreement + filename/header period agreement + schema era; unknown schemas are refused'
    },
    abstentions: abstentions
  });
};

module.exports.candidateEditions = candidateEditions;
module.exports.descriptor = descriptor;
module.exports.filenameFor = filenameFor;
module.exports.TOTAL_FETCH_BUDGET_MS = TOTAL_FETCH_BUDGET_MS;
module.exports.PER_ATTEMPT_TIMEOUT_MS = PER_ATTEMPT_TIMEOUT_MS;
module.exports.CACHE_SUCCESS = CACHE_SUCCESS;
module.exports.CACHE_TRANSIENT = CACHE_TRANSIENT;
module.exports.CACHE_NEVER = CACHE_NEVER;
