'use strict';

/**
 * Bounded, source-preserving semantic evidence window for the Finance packet.
 *
 * Title sets are already persisted by feed-record. This module only selects a
 * bounded newest window and records whether that window was truncated; it does
 * not classify, score, infer independence, or create an opportunity.
 */

var semantic = require('./finance-semantic-evidence');

var SCHEMA = 'finance-semantic-packet/1.0';
var MAX_SETS = 8;
var MAX_OBSERVATIONS = 32;

function list(value) { return Array.isArray(value) ? value : []; }
function timestamp(value) {
  var ms = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function build(titleSets, domain, now) {
  var all = list(titleSets);
  var selected = all.slice(0, MAX_SETS);
  var assembled = semantic.assemble(selected, domain);
  var observations = assembled.observations.slice(0, MAX_OBSERVATIONS);
  var hasMoreSets = all.length > MAX_SETS;
  var hasMoreObservations = assembled.observations.length > MAX_OBSERVATIONS;
  return {
    schemaVersion: SCHEMA,
    observations: observations,
    meta: {
      schemaVersion: SCHEMA,
      status: observations.length ? 'OBSERVED' : 'ABSTAINED',
      reason: observations.length ? null : 'no-valid-persisted-title-observations',
      sourceKey: 'feedtitles:' + String(domain || 'finance'),
      setsRead: selected.length,
      setReadLimit: MAX_SETS,
      observationsRead: observations.length,
      observationLimit: MAX_OBSERVATIONS,
      sourceAbstentions: assembled.abstentions.slice(0, MAX_OBSERVATIONS),
      truncated: hasMoreSets || hasMoreObservations,
      retrievedAt: timestamp(now == null ? Date.now() : now)
    }
  };
}

module.exports = {
  SCHEMA: SCHEMA,
  MAX_SETS: MAX_SETS,
  MAX_OBSERVATIONS: MAX_OBSERVATIONS,
  build: build
};
