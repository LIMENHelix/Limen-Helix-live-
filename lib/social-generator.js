'use strict';

/**
 * Build public-post candidates from the twenty domain brains' durable
 * commercial artifacts. The subject domain decides what is salient and what
 * response it selected; this module only projects the latest exact artifact
 * into Communication's bounded public-message format.
 *
 * No live endpoint is fetched here, no model is called, and no post is made.
 * If a domain has no current source-linked artifact, it abstains rather than
 * falling back to a hard-coded marketing template.
 */

var Store = require('./autofire-efference-store.js');
var Lanes = require('./domain-commercial-lanes.js');
var Candidate = require('./domain-commercial-social-candidate.js');
var Social = require('./social-post.js');
var ARTIFACT_CLAIM_PREFIX = 'domain_commercial:social-artifact-claim:';

function rotate(domains, after) {
  var rows = domains.slice();
  var at = rows.indexOf(String(after || '').toLowerCase());
  return at < 0 ? rows : rows.slice(at + 1).concat(rows.slice(0, at + 1));
}

async function available(options) {
  options = options || {};
  var store = options.store || Store;
  var now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  store.assertDurable();
  var only = options.domain ? String(options.domain).toLowerCase() : null;
  var domains = only ? [only] : rotate(Lanes.DOMAINS, options.after);
  var rows = [];
  for (var i = 0; i < domains.length; i++) {
    var domain = domains[i];
    if (!Lanes.get(domain)) {
      rows.push({ ok: false, domain: domain, reason: 'known-domain-required' });
      continue;
    }
    try {
      var candidate = await Candidate.read(store, domain, now);
      if (candidate.ok) {
        var claimed = await store.get(ARTIFACT_CLAIM_PREFIX + domain + ':' + candidate.sourceArtifactId);
        if (claimed) candidate = { ok: false, domain: domain,
          reason: 'domain-commercial-artifact-already-distributed-or-claimed', commandId: claimed.commandId || null };
      }
      rows.push(candidate);
    }
    catch (error) {
      rows.push({ ok: false, domain: domain, reason: 'domain-commercial-artifact-unavailable',
        detail: String(error && error.message || error) });
    }
  }
  return rows;
}

function rank(rows) {
  return rows.slice().sort(function (a, b) {
    var salience = Number(b.salience || 0) - Number(a.salience || 0);
    return salience || (Number(b.preparedAt || 0) - Number(a.preparedAt || 0));
  });
}

async function generate(options) {
  options = options || {};
  var rows = await available(options);
  var ready = rank(rows.filter(function (row) { return row && row.ok; }));
  if (!ready.length) {
    return { ok: false, reason: 'No domain has a fresh source-linked commercial artifact ready for public distribution.',
      tried: rows.map(function (row) { return row.domain; }),
      skipped: rows.filter(function (row) { return !row.ok; }).map(function (row) { return row.domain + ': ' + row.reason; }) };
  }
  var selected = ready[0];
  selected.tried = rows.map(function (row) { return row.domain; });
  selected.skipped = rows.filter(function (row) { return !row.ok; }).map(function (row) { return row.domain + ': ' + row.reason; });
  return selected;
}

async function previewAll(options) {
  var rows = await available(options || {});
  return rows.map(function (row) {
    if (!row.ok) return { domain: row.domain, ok: false, reason: row.reason };
    return Object.assign({}, row, {
      links: Social.buildFacets(row.text).length,
      externalEffectAuthorized: false,
      providerCalled: false
    });
  });
}

module.exports = {
  generate: generate,
  previewAll: previewAll,
  available: available,
  rank: rank,
  ARTIFACT_CLAIM_PREFIX: ARTIFACT_CLAIM_PREFIX,
  BUILDERS: Lanes.DOMAINS.slice()
};
