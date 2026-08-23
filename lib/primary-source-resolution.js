'use strict';

var https = require('https');

function requestCrossref(identifier) {
  var startUrl = 'https://api.crossref.org/works/' + encodeURIComponent(identifier);
  function get(url, depth, redirects) {
    return new Promise(function (resolve) {
      var req = https.get(url, {
      headers: { 'User-Agent': 'LIMEN-Helix-source-audit/1.0 (read-only)' }
      }, function (res) {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && depth < 4) {
          var next = new URL(res.headers.location, url).toString();
          res.resume();
          get(next, depth + 1, redirects.concat([next])).then(resolve);
          return;
        }
      var body = '';
      res.setEncoding('utf8');
      res.on('data', function (chunk) { body += chunk; });
      res.on('end', function () {
        var payload = null;
        try { payload = JSON.parse(body); } catch (err) { /* handled below */ }
        resolve({ statusCode: res.statusCode, payload: payload, redirects: redirects });
      });
      });
      req.on('error', function (err) { resolve({ statusCode: null, error: err.message, redirects: redirects }); });
      req.setTimeout(20000, function () { req.destroy(new Error('CROSSREF_TIMEOUT')); });
    });
  }
  return get(startUrl, 0, []);
}

function normalizeCrossref(item, response, retrievedAt) {
  var message = response && response.payload && response.payload.message;
  var canonical = message && (message.DOI || message.doi);
  if (!message || !canonical) {
    return {
      domain: item.domain,
      identifierType: item.identifierType,
      identifier: item.identifier,
      status: 'UNRESOLVED',
      reason: response && response.error ? response.error : 'CROSSREF_NO_WORK_METADATA',
      httpStatus: response ? response.statusCode : null,
    registry: 'Crossref',
      redirects: response && response.redirects && response.redirects.length ? response.redirects : [],
      retrievedAt: retrievedAt,
      evidenceEligible: false,
      consumedByRuntime: false
    };
  }
  return {
    domain: item.domain,
    identifierType: item.identifierType,
    identifier: item.identifier,
    canonicalIdentifier: canonical,
    status: 'RESOLVED_METADATA_ONLY',
    title: Array.isArray(message.title) ? message.title[0] : null,
    publisher: message.publisher || null,
    workType: message.type || null,
    issued: message.issued || null,
    publishedOnline: message['published-online'] || null,
    registryUrl: message.URL || ('https://doi.org/' + encodeURIComponent(canonical)),
    registry: 'Crossref',
    redirects: response && response.redirects && response.redirects.length ? response.redirects : [],
    retrievedAt: retrievedAt,
    evidenceEligible: false,
    consumedByRuntime: false,
    limitations: [
      'Crossref metadata resolves an identity pointer; it does not verify the source content or claim',
      'publisher and DOI do not establish editorial, ownership, or syndication independence',
      'no title, abstract, result, or numeric value is admitted to brain-v2 by this record'
    ]
  };
}

async function resolveQueue(queue, fetcher, clock) {
  var now = clock || function () { return new Date().toISOString(); };
  var records = [];
  var tasks = queue && Array.isArray(queue.tasks) ? queue.tasks : [];
  for (var i = 0; i < tasks.length; i++) {
    var task = tasks[i];
    var response = await fetcher(task.identifier);
    records.push(normalizeCrossref(task, response, now()));
    if (i + 1 < tasks.length) await new Promise(function (resolve) { setTimeout(resolve, 200); });
  }
  return records;
}

module.exports = { requestCrossref: requestCrossref, normalizeCrossref: normalizeCrossref, resolveQueue: resolveQueue };
