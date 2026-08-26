'use strict';

/**
 * Bounded, source-preserving semantic evidence window for one domain brain.
 *
 * This is transport only. It does not classify, score, select, infer source
 * independence, or grant another domain authority over the owning brain.
 */

var semantic = require('./domain-semantic-evidence');

var SCHEMA = 'domain-semantic-packet/1.0';
var MAX_SETS = 8;
var MAX_OBSERVATIONS = 32;
var SOURCE_DOMAIN = { medicine: 'health', science: 'research', trade: 'supplyChain' };

function list(value) { return Array.isArray(value) ? value : []; }
function timestamp(value) {
  var ms = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function sourceDomainFor(ownerDomain) {
  return SOURCE_DOMAIN[ownerDomain] || ownerDomain;
}

function build(titleSets, domain, now) {
  var all = list(titleSets);
  var selected = all.slice(0, MAX_SETS);
  var assembled = semantic.assemble(selected, domain);
  var observations = assembled.observations.slice(0, MAX_OBSERVATIONS);
  return {
    schemaVersion: SCHEMA,
    observations: observations,
    meta: {
      schemaVersion: SCHEMA,
      status: observations.length ? 'OBSERVED' : 'ABSTAINED',
      reason: observations.length ? null : 'no-valid-persisted-title-observations',
      sourceKey: 'feedtitles:' + String(domain || 'unknown'),
      setsRead: selected.length,
      setReadLimit: MAX_SETS,
      observationsRead: observations.length,
      observationLimit: MAX_OBSERVATIONS,
      sourceAbstentions: assembled.abstentions.slice(0, MAX_OBSERVATIONS),
      truncated: all.length > MAX_SETS || assembled.observations.length > MAX_OBSERVATIONS,
      retrievedAt: timestamp(now == null ? Date.now() : now),
      authority: 'observation-only'
    }
  };
}

module.exports = {
  SCHEMA: SCHEMA,
  MAX_SETS: MAX_SETS,
  MAX_OBSERVATIONS: MAX_OBSERVATIONS,
  sourceDomainFor: sourceDomainFor,
  build: build
};
