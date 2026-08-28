'use strict';

/**
 * Source-grounded Finance company universe.
 *
 * This boundary supplies eligible company contexts to the manager without
 * ranking them or manufacturing a signal. Selection is an exact identity
 * lookup after the manager responds; no score, sentiment, stress threshold,
 * or single-publisher rule is introduced here.
 */

var Ledger = require('./finance-input-ledger.js');
var SCHEMA = 'finance-candidate-universe/1.0';
var MAX_CANDIDATES = 12;

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function list(value) { return Array.isArray(value) ? value : []; }
function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function identity(company) { return company && text(company.slug) && text(company.ticker); }

function build(input) {
  input = input || {};
  var source = list(input.candidates);
  var rows = source.slice(0, MAX_CANDIDATES);
  var accepted = [], abstentions = [];
  rows.forEach(function (row, index) {
    var company = row && row.company;
    if (!identity(company)) {
      abstentions.push({ index: index, reason: 'company_identity_incomplete' });
      return;
    }
    var ledger = Ledger.build(Object.assign({}, row, { company: company, candidate: null }));
    if (ledger.status !== 'READY_FOR_MANAGER_REVIEW') {
      abstentions.push({ index: index, company: clone(company), reason: 'candidate_inputs_not_ready', blockers: ledger.blockers.slice() });
      return;
    }
    accepted.push({ company: clone(company), ledger: ledger });
  });
  return {
    schemaVersion: SCHEMA,
    status: accepted.length ? 'READY_FOR_MANAGER_REVIEW' : 'ABSTAINED',
    selection: 'manager-must-select-an-exact-supplied-company-identity',
    candidates: accepted,
    abstentions: abstentions,
    truncated: rows.length < source.length,
    asOf: input.asOf || null
  };
}

function select(universe, company) {
  if (!universe || universe.schemaVersion !== SCHEMA || universe.status !== 'READY_FOR_MANAGER_REVIEW') {
    return { ok: false, status: 'ABSTAINED', reason: 'candidate_universe_not_ready' };
  }
  var found = list(universe.candidates).find(function (row) {
    return row && row.company && row.company.slug === (company && company.slug) && row.company.ticker === (company && company.ticker);
  });
  return found ? { ok: true, status: 'SELECTED', candidate: clone(found) } : { ok: false, status: 'ABSTAINED', reason: 'manager_company_not_in_candidate_universe' };
}

function rounded(value) { return Math.round(value * 10000) / 10000; }

/**
 * Validate the manager's cross-company estimate ledger before it can select a
 * candidate. The numbers remain labelled estimates; this boundary only proves
 * identity coverage, arithmetic, ordering, and a positive long-only margin.
 */
function validateProjectedMarginRanking(universe, proposal) {
  if (!universe || universe.schemaVersion !== SCHEMA || universe.status !== 'READY_FOR_MANAGER_REVIEW') {
    return { ok: false, status: 'ABSTAINED', reason: 'candidate_universe_not_ready' };
  }
  var ranking = proposal && proposal.projectedMarginRanking;
  var entries = ranking && list(ranking.entries);
  if (!ranking || ranking.metric !== 'risk-adjusted-expected-total-return-pct' ||
      ranking.methodology !== 'expectedReturnPct - abs(min(downsideReturnPct, 0)) * (1 - confidence)' || !entries.length) {
    return { ok: false, status: 'ABSTAINED', reason: 'projected_margin_ranking_required' };
  }
  var expected = Object.create(null);
  list(universe.candidates).forEach(function (row) {
    expected[row.company.slug + '\u0000' + row.company.ticker] = true;
  });
  if (entries.length !== Object.keys(expected).length) {
    return { ok: false, status: 'ABSTAINED', reason: 'projected_margin_ranking_must_cover_universe' };
  }
  var seen = Object.create(null);
  var normalized = clone(ranking);
  for (var i = 0; i < entries.length; i++) {
    var row = entries[i] || {}, company = row.company || {};
    var k = company.slug + '\u0000' + company.ticker;
    if (!expected[k] || seen[k]) return { ok: false, status: 'ABSTAINED', reason: 'projected_margin_ranking_identity_invalid' };
    seen[k] = true;
    var expectedReturn = Number(row.expectedReturnPct), downside = Number(row.downsideReturnPct);
    var confidence = Number(row.confidence);
    var side = row.side === undefined ? 'LONG' : row.side;
    if (['LONG', 'SHORT'].indexOf(side) < 0 || ![expectedReturn, downside, confidence].every(Number.isFinite) || downside > 0 || confidence < 0 || confidence > 1) {
      return { ok: false, status: 'ABSTAINED', reason: 'projected_margin_ranking_value_invalid' };
    }
    var calculated = rounded(expectedReturn - Math.abs(Math.min(downside, 0)) * (1 - confidence));
    // The model supplies bounded estimates; code owns arithmetic and ordering.
    // Trusting generated subtraction here caused a safe but needless production
    // abstention. Preserve the estimates, overwrite the derived value, and sort.
    normalized.entries[i].side = side;
    normalized.entries[i].riskAdjustedMarginPct = calculated;
  }
  normalized.entries.sort(function (a, b) {
    return b.riskAdjustedMarginPct - a.riskAdjustedMarginPct ||
      String(a.company.slug).localeCompare(String(b.company.slug));
  });
  var top = normalized.entries[0];
  if (!(top.riskAdjustedMarginPct > 0)) return { ok: false, status: 'ABSTAINED', reason: 'projected_margin_not_positive' };
  if (!proposal.company || proposal.company.slug !== top.company.slug || proposal.company.ticker !== top.company.ticker) {
    return { ok: false, status: 'ABSTAINED', reason: 'selected_company_must_be_top_projected_margin' };
  }
  var selected = clone(top);
  return { ok: true, status: 'RANKED', selected: selected, ranking: normalized };
}

function managerContext(universe) {
  if (!universe || universe.schemaVersion !== SCHEMA || universe.status !== 'READY_FOR_MANAGER_REVIEW') return null;
  return {
    status: 'READY_FOR_PAPER_REVIEW',
    company: null,
    homologyContexts: list(universe.candidates).map(function (row) {
      return { company: clone(row.company), context: clone(row.ledger && row.ledger.ledger && row.ledger.ledger.homologyContext) };
    }),
    companyCandidates: list(universe.candidates).map(function (row) {
      return { company: clone(row.company), ledger: clone(row.ledger) };
    })
  };
}

module.exports = { SCHEMA: SCHEMA, MAX_CANDIDATES: MAX_CANDIDATES, build: build, select: select, validateProjectedMarginRanking: validateProjectedMarginRanking, managerContext: managerContext };
