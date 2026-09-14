'use strict';

/**
 * Twenty immutable commercial-reflex identities.
 *
 * The list is shared infrastructure in the same sense as a clock or a wire
 * bundle.  It is not shared cognition: every entry closes over a different
 * product/owner identity, durable namespace, action vocabulary and offers.
 * A caller must resolve one exact domain before it can evaluate anything.
 */

var catalog = require('./offer-catalog.js');

var DECLARATIONS = Object.freeze([
  require('./domain-commercial/agriculture.js'),
  require('./domain-commercial/communication.js'),
  require('./domain-commercial/culture.js'),
  require('./domain-commercial/defense.js'),
  require('./domain-commercial/economy.js'),
  require('./domain-commercial/education.js'),
  require('./domain-commercial/energy.js'),
  require('./domain-commercial/environment.js'),
  require('./domain-commercial/finance.js'),
  require('./domain-commercial/governance.js'),
  require('./domain-commercial/industry.js'),
  require('./domain-commercial/infrastructure.js'),
  require('./domain-commercial/intelligence.js'),
  require('./domain-commercial/law.js'),
  require('./domain-commercial/medicine.js'),
  require('./domain-commercial/population.js'),
  require('./domain-commercial/religion.js'),
  require('./domain-commercial/science.js'),
  require('./domain-commercial/technology.js'),
  require('./domain-commercial/trade.js')
]);
var DOMAINS = Object.freeze(DECLARATIONS.map(function (row) { return row.productDomain; }));

function rungsFor(domain) {
  var entry = catalog.CATALOG[domain];
  return entry ? Object.keys(entry.rungs || {}).sort() : [];
}

function build(declaration) {
  var domain = declaration.productDomain;
  var entry = catalog.CATALOG[domain] || {};
  var ownerDomain = declaration.ownerDomain;
  return Object.freeze({
    schemaVersion: 'domain-commercial-contract/1.0',
    productDomain: domain,
    ownerDomain: ownerDomain,
    stateKey: 'domain_commercial:state:' + domain,
    intentPrefix: 'domain_commercial:intent:' + domain + ':',
    intentQueue: 'domain_commercial:intent-queue:' + domain,
    receiptLog: 'domain_commercial_receipt_log:' + domain,
    artifactPrefix: 'domain_commercial:artifact:' + domain + ':',
    artifactStateKey: 'domain_commercial:artifact-state:' + domain,
    artifactLog: 'domain_commercial:artifact-log:' + domain,
    allowedPrograms: Object.freeze([
      'SUBSCRIBER_BRIEF',
      'PUBLIC_ARTICLE',
      'SHORT_VIDEO',
      declaration.specialProgram
    ]),
    offerRungs: Object.freeze(rungsFor(domain)),
    audience: entry.who || null,
    sourceBoundary: Object.freeze({
      admitted: Object.freeze(['server-cognition-refresh', 'domain-semantic-packet/1.0']),
      headlineAuthority: 'topic-lead-only',
      deepPortalAuthority: 'admitted-references-only',
      prohibited: Object.freeze(['quarantined-portal-content', 'unverified-model-narrative'])
    })
  });
}

var CONTRACTS = Object.create(null);
DECLARATIONS.forEach(function (declaration) { CONTRACTS[declaration.productDomain] = build(declaration); });
Object.freeze(CONTRACTS);

function get(domain) { return CONTRACTS[String(domain || '').toLowerCase()] || null; }

module.exports = {
  DOMAINS: DOMAINS,
  DECLARATIONS: DECLARATIONS,
  CONTRACTS: CONTRACTS,
  get: get
};
