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

function managerContext(universe) {
  if (!universe || universe.schemaVersion !== SCHEMA || universe.status !== 'READY_FOR_MANAGER_REVIEW') return null;
  return {
    status: 'READY_FOR_PAPER_REVIEW',
    company: null,
    companyCandidates: list(universe.candidates).map(function (row) {
      return { company: clone(row.company), ledger: clone(row.ledger) };
    })
  };
}

module.exports = { SCHEMA: SCHEMA, MAX_CANDIDATES: MAX_CANDIDATES, build: build, select: select, managerContext: managerContext };
