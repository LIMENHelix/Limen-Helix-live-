'use strict';

/**
 * Fresh Finance feed confirmation at the trade-decision boundary.
 *
 * The Preview manager already sees the inward Finance feeds. This separate
 * boundary rebuilds the current source universe after the manager selects a
 * company and supplies the exact issuer observations to the independent trade
 * actor. It proves identity, freshness, and evidence continuity only. It does
 * not classify sentiment, claim publisher independence, or authorize a side.
 */

var Readiness = require('./finance-preview-readiness.js');
var Universe = require('./finance-candidate-universe.js');

var SCHEMA = 'finance-feed-confirmation/1.0';
var MAX_SEMANTIC_AGE_MS = 24 * 60 * 60 * 1000;
var MAX_CONFIRMATION_AGE_MS = 15 * 60 * 1000;
var MAX_OBSERVATIONS = 20;

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function list(value) { return Array.isArray(value) ? value : []; }
function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function when(value) { var n = Date.parse(value); return Number.isFinite(n) ? n : null; }
function identity(value) { return value && typeof value === 'object' && text(value.kind) && text(value.value); }
function identityKey(value) { return identity(value) ? value.kind + '\u0000' + value.value : null; }
function companyMatches(a, b) {
  return !!(a && b && text(a.slug) && text(a.ticker) &&
    a.slug === b.slug && String(a.ticker).toUpperCase() === String(b.ticker).toUpperCase());
}
function companyIdentity(value) { return value && text(value.slug) && text(value.ticker); }

function uniqueLabels(rows, field) {
  var seen = Object.create(null), out = [];
  list(rows).forEach(function (row) {
    var value = row && text(row[field]) ? String(row[field]).trim() : null;
    if (value && !seen[value]) { seen[value] = true; out.push(value); }
  });
  return out;
}

function build(input) {
  input = input || {};
  var now = when(input.now) || Date.now();
  var packetId = text(input.packetId) ? input.packetId : null;
  var candidate = input.candidate || null;
  var bundle = input.bundle || null;
  var blockers = [];
  if (!packetId) blockers.push('finance_feed_confirmation_packet_required');
  if (!candidate || !companyIdentity(candidate.company)) {
    blockers.push('finance_feed_confirmation_company_required');
  }
  var readiness = bundle && bundle.input ? Readiness.build(bundle.input) : null;
  if (!readiness || readiness.status !== 'READY_FOR_MANAGER_REVIEW') {
    blockers.push('finance_feed_confirmation_current_inputs_not_ready');
  }
  if (bundle && bundle.packet && packetId && bundle.packet.packetId !== packetId) {
    blockers.push('finance_feed_confirmation_packet_changed');
  }
  var selected = readiness && readiness.universe
    ? Universe.select(readiness.universe, candidate && candidate.company) : null;
  if (!selected || selected.ok !== true) blockers.push('finance_feed_confirmation_company_not_in_current_universe');

  var ledger = selected && selected.candidate && selected.candidate.ledger;
  var source = ledger && ledger.ledger || {};
  var observations = list(source.semanticEvidence).filter(function (row) {
    var at = when(row && row.recordedAt);
    return identity(row && row.sourceIdentity) && at && now - at <= MAX_SEMANTIC_AGE_MS && at - now <= 5 * 60 * 1000;
  }).slice(0, MAX_OBSERVATIONS);
  if (!observations.length) blockers.push('finance_feed_confirmation_fresh_issuer_observation_required');

  var currentIdentities = Object.create(null);
  observations.forEach(function (row) { currentIdentities[identityKey(row.sourceIdentity)] = true; });
  var semanticRefs = list(candidate && candidate.evidenceRefs).filter(function (ref) { return ref && ref.role === 'semantic'; });
  if (!semanticRefs.length || !semanticRefs.some(function (ref) { return currentIdentities[identityKey(ref.sourceIdentity)] === true; })) {
    blockers.push('finance_feed_confirmation_selected_evidence_not_current');
  }

  var status = blockers.length ? 'ABSTAINED' : 'CONFIRMED_FOR_TRADE_DECISION';
  return {
    schemaVersion: SCHEMA,
    status: status,
    blockers: blockers,
    packetId: packetId,
    company: clone(candidate && candidate.company || null),
    confirmedAt: new Date(now).toISOString(),
    context: {
      semanticEvidence: clone(observations),
      currentNewsFirst: {
        status: observations.length ? 'CURRENT_EXACT_ISSUER_NEWS_PRESENT' : 'ABSTAINED',
        company: clone(candidate && candidate.company || null),
        observations: clone(observations),
        sequence: 'CURRENT_EXACT_ISSUER_NEWS_BEFORE_THING2_MASKING_CONTEXT',
        thing2MaskingConfirmation: 'DEFERRED_UNTIL_AFTER_ZERO_WEIGHT_THING2_RECONCILIATION',
        note: 'These current exact-issuer records must be shown first when an investment result is reviewed. They do not directly authorize a side.'
      },
      marketData: clone(source.marketData || null),
      networkEvidence: clone(list(source.networkEvidence)),
      selectedEvidenceRefs: clone(list(candidate && candidate.evidenceRefs)),
      sourceDiversity: {
        feedLabels: uniqueLabels(observations, 'feedName'),
        publisherLabels: uniqueLabels(observations, 'publisher'),
        publisherIndependence: 'UNASSESSED'
      },
      interpretationBoundary: {
        directionalClaim: false,
        sentimentClassified: false,
        thing2Used: false,
        note: 'Current exact-issuer feed evidence is supplied before any Thing 2 masking comparison; this confirmation does not assert that it supports a long or short or confirms masking.'
      }
    },
    paperOnly: true,
    orderPlaced: false,
    liveMoney: false
  };
}

function validate(value, packetId, company, now) {
  var at = when(value && value.confirmedAt);
  var measured = when(now) || Date.now();
  if (!value || value.schemaVersion !== SCHEMA || value.status !== 'CONFIRMED_FOR_TRADE_DECISION') {
    return { ok: false, reason: 'finance_feed_confirmation_required' };
  }
  if (value.packetId !== packetId || !companyMatches(value.company, company)) {
    return { ok: false, reason: 'finance_feed_confirmation_identity_mismatch' };
  }
  if (!at || measured - at > MAX_CONFIRMATION_AGE_MS || at - measured > 5 * 60 * 1000) {
    return { ok: false, reason: 'finance_feed_confirmation_stale' };
  }
  if (!value.context || !list(value.context.semanticEvidence).length ||
      !value.context.currentNewsFirst || value.context.currentNewsFirst.status !== 'CURRENT_EXACT_ISSUER_NEWS_PRESENT' ||
      !value.context.interpretationBoundary || value.context.interpretationBoundary.thing2Used !== false) {
    return { ok: false, reason: 'finance_feed_confirmation_context_invalid' };
  }
  return { ok: true, reason: null };
}

module.exports = {
  SCHEMA: SCHEMA,
  MAX_SEMANTIC_AGE_MS: MAX_SEMANTIC_AGE_MS,
  MAX_CONFIRMATION_AGE_MS: MAX_CONFIRMATION_AGE_MS,
  build: build,
  validate: validate
};
