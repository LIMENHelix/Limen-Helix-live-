'use strict';

/** Twenty separate closures over the common commercial-reflex physiology. */
var Contracts = require('./domain-commercial-contracts.js');
var Reflex = require('./domain-commercial-reflex.js');

var LANES = Object.create(null);
Contracts.DOMAINS.forEach(function (domain) {
  var contract = Contracts.get(domain);
  LANES[domain] = Object.freeze({
    contract: contract,
    evaluate: function (cognitionRecord, priorState, now) {
      return Reflex.evaluate(contract, cognitionRecord, priorState, now);
    },
    persist: function (store, result) { return Reflex.persist(store, contract, result); }
  });
});
Object.freeze(LANES);

function get(domain) { return LANES[String(domain || '').toLowerCase()] || null; }

module.exports = { DOMAINS: Contracts.DOMAINS, LANES: LANES, get: get };
