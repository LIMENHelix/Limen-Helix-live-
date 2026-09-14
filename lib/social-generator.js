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
var CONTENT_CLAIM_PREFIX = 'domain_commercial:social-content-claim:';

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
  // Every candidate read is independent. Run the twenty Redis-backed reads in
  // parallel, while Promise.all preserves the rotated input order for stable
  // tie-breaking and fair scheduling.
  return Promise.all(domains.map(async function (domain) {
    if (!Lanes.get(domain)) {
      return { ok: false, domain: domain, reason: 'known-domain-required' };
    }
    try {
      var candidate = await Candidate.read(store, domain, now);
      if (candidate.ok) {
        var claims = await Promise.all([
          store.get(ARTIFACT_CLAIM_PREFIX + domain + ':' + candidate.sourceArtifactId),
          store.get(CONTENT_CLAIM_PREFIX + domain + ':' + Candidate.hash(candidate.text))
        ]);
        if (claims[0] || claims[1]) candidate = { ok: false, domain: domain,
          reason: claims[1] ? 'domain-commercial-public-content-already-distributed-or-claimed' :
            'domain-commercial-artifact-already-distributed-or-claimed',
          commandId: (claims[1] || claims[0]).commandId || null };
      }
      return candidate;
    }
    catch (error) {
      return { ok: false, domain: domain, reason: 'domain-commercial-artifact-unavailable',
        detail: String(error && error.message || error) };
    }
  }));
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
  // LAST_KEY is a refractory signal: when another domain is ready, the
  // previously posted subject cannot win again solely through higher stress.
  // Salience still ranks the remaining domains, and a sole ready domain may
  // continue rather than silencing the channel.
  var after = String(options.after || '').toLowerCase();
  var alternatives = after && ready.length > 1
    ? ready.filter(function (row) { return row.domain !== after; }) : ready;
  var selected = (alternatives.length ? alternatives : ready)[0];
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
  CONTENT_CLAIM_PREFIX: CONTENT_CLAIM_PREFIX,
  BUILDERS: Lanes.DOMAINS.slice()
};
