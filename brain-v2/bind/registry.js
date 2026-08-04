/**
 * brain-v2/bind/registry.js — the 20 canonical domains, and what is actually bound.
 *
 * THE LIST IS NOT INVENTED HERE. It is the same 20 keys `handlers/domain-snapshot.js`
 * enumerates and `handlers/feed-record.js` records, copied deliberately rather than
 * imported: requiring the snapshot handler pulls in the whole live-fetch surface, and a
 * manifest of domain names should not need a network stack to load. `test/domains.js`
 * asserts this list still matches the handler's, so a domain added there and forgotten
 * here fails a test instead of silently going unbound.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * THREE STATES, AND THE MIDDLE ONE IS THE HONEST NEW ANSWER
 *
 *   BOUND          a binder exists AND a fixture exists to exercise it. The domain can
 *                  be replayed, measured, and argued about with numbers.
 *   MANIFEST_ONLY  a binder exists and validates, but no fixture does. Everything about
 *                  the domain is declared and nothing about it is observed.
 *   UNBOUND        no binder. The domain records into feed history and nothing reads it.
 *
 * Collapsing MANIFEST_ONLY into BOUND is the failure this file exists to prevent. A
 * declared manifest is cheap; nineteen of them would let the system report "20 domains
 * bound" while exactly one had ever seen a real observation. The count that matters is
 * BOUND, and it is 1.
 * ═══════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

var fs = require('fs');
var path = require('path');

/* Paths resolve against THIS FILE, never process.cwd(). A registry whose answer depends
   on the directory the caller happened to be in is not a registry. */
var BIND_DIR = __dirname;
var FIXTURE_DIR = path.join(__dirname, '..', 'fixtures');

/**
 * The canonical 20, in the order handlers/domain-snapshot.js lists them.
 * @see handlers/domain-snapshot.js — `var keys = [...]`
 */
var CANONICAL = [
  'economy', 'energy', 'environment', 'health', 'technology',
  'research', 'supplyChain', 'governance', 'infrastructure', 'agriculture',
  'industry', 'education', 'communication', 'culture', 'defense',
  'religion', 'population', 'law', 'finance', 'intelligence'
];

var STATE = {
  BOUND: 'bound',
  MANIFEST_ONLY: 'manifest-only',
  UNBOUND: 'unbound'
};

function binderPath(domain) { return path.join(BIND_DIR, domain + '.js'); }
function fixturePath(domain) { return path.join(FIXTURE_DIR, domain + '-recorder.json'); }

/**
 * Inspect one domain. Never throws: a binder that fails to load is a REPORTABLE state,
 * not a crash, or one broken manifest would hide the status of the other nineteen.
 */
function inspect(domain) {
  var bp = binderPath(domain), fp = fixturePath(domain);
  var hasBinder = fs.existsSync(bp);
  var hasFixture = fs.existsSync(fp);

  if (!hasBinder) {
    return {
      domain: domain, state: STATE.UNBOUND, binder: false, fixture: hasFixture,
      why: 'no binder at bind/' + domain + '.js. The domain is recorded into feed history by ' +
           'handlers/feed-record.js and nothing reads it.'
    };
  }

  var binder, spec;
  try {
    binder = require(bp);
    spec = binder.spec();
  } catch (e) {
    return {
      domain: domain, state: STATE.UNBOUND, binder: true, fixture: hasFixture, loadError: e.message,
      why: 'binder present but it did not load: ' + e.message
    };
  }

  var base = {
    domain: domain,
    binder: true,
    fixture: hasFixture,
    channels: (spec.channels || []).length,
    relationships: (spec.relationships || []).length,
    findings: (spec.findings || []).length,
    version: spec.version
  };

  if (!hasFixture) {
    return Object.assign(base, {
      state: STATE.MANIFEST_ONLY,
      why: 'binder validates (' + base.channels + ' channels, ' + base.relationships +
           ' declared relationships) but no fixture at fixtures/' + domain + '-recorder.json, ' +
           'so nothing here has been exercised against a real observation. Declaring a domain ' +
           'is not observing one.'
    });
  }

  return Object.assign(base, {
    state: STATE.BOUND,
    why: 'binder validates and fixtures/' + domain + '-recorder.json exists, so the domain can be replayed and measured'
  });
}

/** Every canonical domain, with its state and the reason for it. */
function survey() {
  return CANONICAL.map(inspect);
}

function summary() {
  var rows = survey();
  var by = Object.create(null);
  Object.keys(STATE).forEach(function (k) { by[STATE[k]] = 0; });
  rows.forEach(function (r) { by[r.state]++; });
  return {
    total: rows.length,
    byState: by,
    bound: rows.filter(function (r) { return r.state === STATE.BOUND; }).map(function (r) { return r.domain; }),
    manifestOnly: rows.filter(function (r) { return r.state === STATE.MANIFEST_ONLY; }).map(function (r) { return r.domain; }),
    /* The headline number is BOUND, never binder-count. A manifest is a claim about what
       a domain would observe; only a fixture makes it a claim about what it did. */
    why: by[STATE.BOUND] + ' of ' + rows.length + ' domains are bound with data behind them; ' +
         by[STATE.MANIFEST_ONLY] + ' declared but unobserved; ' + by[STATE.UNBOUND] + ' unbound'
  };
}

module.exports = {
  CANONICAL: CANONICAL,
  STATE: STATE,
  inspect: inspect,
  survey: survey,
  summary: summary,
  binderPath: binderPath,
  fixturePath: fixturePath
};
