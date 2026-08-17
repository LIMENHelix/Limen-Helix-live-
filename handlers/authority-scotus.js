/**
 * Operator evidence API for one official Supreme Court docket.
 * Docket events remain documentary evidence. They are not a Law finding, brain
 * channel, Thing score, stress value, diagnosis, or pathway input.
 */
'use strict';

var SCOTUS = require('../lib/scotus-docket.js');

var SUPPORTED = 'scotus_docket';
var UA = 'LIMEN-Helix/1.0 (operator evidence portal; +https://limenhelix.com)';
var FETCH_BUDGET_MS = 7000;
var CACHE_SUCCESS = 's-maxage=300, stale-while-revalidate=1800';
var CACHE_TRANSIENT = 's-maxage=30, stale-while-revalidate=0';
var CACHE_NEVER = 'no-store';

function respond(res, status, cache, body) {
  res.setHeader('Cache-Control', cache);
  return res.status(status).json(body);
}

function descriptor() {
  return {
    id: SUPPORTED,
    name: 'Supreme Court of the United States — official docket',
    publisher: 'Supreme Court of the United States',
    landingPage: 'https://www.supremecourt.gov/Docket/SearchCase.aspx',
    caseDocumentsPage: 'https://www.supremecourt.gov/case_documents.aspx',
    measureType: 'case-specific administrative docket and filing chronology',
    publicationInterval: 'event-driven; the Court does not state a fixed update interval on the docket page',
    units: 'dated docket entries and source documents; no numeric stress unit',
    operatorUse: 'Use this view to verify what the Court has docketed, filed, distributed, ordered, argued, or decided in one identified case, then open the official docket or filing.',
    consumedBy: {
      lawFinding: false, brainChannel: false, thingLayer: null, pathway: false,
      statement: 'This official case chronology is displayed for an operator. No Law finding, brain channel, Thing layer, or pathway reads it, and it produces no stress value, diagnosis, score, or activation.'
    },
    boundaries: [
      'A docket entry proves that the Court recorded that procedural event; it does not establish the truth of claims in a filing.',
      'Filing volume is not case importance, legal merit, institutional stress, or likely outcome.',
      'The absence of a new docket entry is not evidence that no off-docket work occurred.',
      'This endpoint accepts an exact docket identifier. It does not perform party-name search or infer which case an operator meant.'
    ]
  };
}

async function fetchDocket(url) {
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
      detail: timeout ? 'The official docket did not finish within the bounded fetch budget.' : String(e && e.message || e),
      elapsedMs: Date.now() - started
    };
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  var authority = String((req.query && req.query.authority) || '').trim();
  var docketInput = String((req.query && req.query.docket) || '').trim();

  if (!authority) return respond(res, 400, CACHE_NEVER, { ok: false, code: 'NO_AUTHORITY', detail: 'Supply ?authority=<id>.', supported: [SUPPORTED] });
  if (authority !== SUPPORTED) return respond(res, 404, CACHE_TRANSIENT, {
    ok: false, code: 'AUTHORITY_NOT_IMPLEMENTED', detail: 'This handler implements only ' + SUPPORTED + '.', requested: authority, supported: [SUPPORTED]
  });
  if (!docketInput) return respond(res, 400, CACHE_NEVER, {
    ok: false, code: 'NO_DOCKET', detail: 'Supply an exact Supreme Court docket identifier, for example ?docket=25-250.',
    authority: descriptor(), abstentions: ['No case was selected, so no docket was fetched or inferred.']
  });

  var normalized = SCOTUS.normaliseDocket(docketInput);
  if (!normalized.ok) return respond(res, 400, CACHE_NEVER, {
    ok: false, code: normalized.code, detail: normalized.detail, requested: normalized.requested,
    authority: descriptor(), abstentions: ['No official request was made because the docket identifier was invalid.']
  });
  var sourceUrl = SCOTUS.officialUrl(normalized.docket);
  var got = await fetchDocket(sourceUrl);
  if (!got.ok) {
    var notFound = got.status === 404;
    return respond(res, notFound ? 404 : 200, CACHE_TRANSIENT, {
      ok: false,
      code: notFound ? 'DOCKET_NOT_FOUND' : (got.code || 'UPSTREAM_HTTP_' + got.status),
      detail: notFound ? 'The official Court site returned 404 for this exact docket identifier.' : (got.detail || 'The official Court site returned HTTP ' + got.status + '.'),
      requested: normalized.docket, authority: descriptor(),
      abstentions: ['No docket values are shown because the official page was not retrieved.'],
      diagnostics: { sourceUrl: sourceUrl, elapsedMs: got.elapsedMs }
    });
  }

  var parsed = SCOTUS.parse(got.html, normalized.docket);
  if (!parsed.ok) return respond(res, 200, CACHE_TRANSIENT, {
    ok: false, code: parsed.code, detail: parsed.detail, authority: descriptor(),
    abstentions: ['No docket values are shown because the official page did not validate against the reviewed parser contract.'],
    diagnostics: parsed,
    refusedFile: { url: sourceUrl, bytes: Buffer.byteLength(got.html, 'utf8'), sourceSha256: parsed.sourceSha256 || null, sourceUpdatedAt: got.sourceUpdatedAt },
    retrievedAt: new Date().toISOString()
  });

  var retrievedAt = new Date().toISOString();
  parsed.proceedings.forEach(function (event) {
    event.provenance = {
      sourceUrl: sourceUrl, sourceSha256: parsed.sourceSha256,
      sourceUpdatedAt: got.sourceUpdatedAt, retrievedAt: retrievedAt,
      parserVersion: SCOTUS.PARSER_VERSION, transformVersion: SCOTUS.TRANSFORM_VERSION
    };
  });

  return respond(res, 200, CACHE_SUCCESS, {
    ok: true,
    viewKind: 'scotus_docket',
    authority: descriptor(),
    evidence: {
      docket: parsed.docket, title: parsed.title, docketed: parsed.docketed,
      linkedWith: parsed.linkedWith, lowerCourt: parsed.lowerCourt,
      lowerCourtCaseNumbers: parsed.lowerCourtCaseNumbers,
      lowerCourtDecisionDate: parsed.lowerCourtDecisionDate,
      proceedings: parsed.proceedings,
      documentLinks: parsed.documentLinks
    },
    provenance: {
      source: { url: sourceUrl, sourceUpdatedAt: got.sourceUpdatedAt, sourceEtag: got.sourceEtag },
      sourceSha256: parsed.sourceSha256, sourceBytes: parsed.sourceBytes,
      retrievedAt: retrievedAt, elapsedMs: got.elapsedMs,
      parser: 'lib/scotus-docket.js', parserVersion: SCOTUS.PARSER_VERSION,
      transformVersion: SCOTUS.TRANSFORM_VERSION,
      transformation: 'Official HTML entities and presentation tags are normalised into identified fields and dated proceeding text. No filing is classified, scored, ranked, or treated as a finding.',
      validation: 'Exact docket identity, title, docketed date, and at least one dated proceeding are required; otherwise the parser abstains.'
    },
    abstentions: descriptor().boundaries
  });
};

module.exports.descriptor = descriptor;
module.exports.fetchDocket = fetchDocket;
