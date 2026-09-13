'use strict';

/** Four additional sovereign Soft-five subscriber lanes. Religion retains its
 * existing independent implementation; this registry never routes one domain
 * through another domain's decision or motor authority. */
var Factory = require('./sovereign-subscriber-lane.js');

var LANES = Object.freeze({
  culture: Factory.create({ productDomain: 'culture', ownerDomain: 'culture', envStem: 'CULTURE', short: 'cu' }),
  education: Factory.create({ productDomain: 'education', ownerDomain: 'education', envStem: 'EDUCATION', short: 'ed' }),
  communication: Factory.create({ productDomain: 'communication', ownerDomain: 'communication', envStem: 'COMMUNICATION', short: 'co' }),
  medicine: Factory.create({ productDomain: 'medicine', ownerDomain: 'health', envStem: 'MEDICINE', short: 'me' })
});

function get(domain) { return LANES[String(domain || '').toLowerCase()] || null; }
function list() { return Object.keys(LANES).map(function (domain) { return LANES[domain]; }); }

module.exports = { get: get, list: list, DOMAINS: Object.freeze(Object.keys(LANES)) };
