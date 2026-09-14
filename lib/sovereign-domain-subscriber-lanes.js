'use strict';

/** Eighteen separate product-domain subscriber brains; Finance and Religion
 * retain their older custom implementations. Shared code below is transport
 * physiology only: every imported module has its own identity and namespace. */
var LANES = Object.freeze({
  agriculture: require('./domain-subscriber/agriculture.js'),
  communication: require('./domain-subscriber/communication.js'),
  culture: require('./domain-subscriber/culture.js'),
  defense: require('./domain-subscriber/defense.js'),
  economy: require('./domain-subscriber/economy.js'),
  education: require('./domain-subscriber/education.js'),
  energy: require('./domain-subscriber/energy.js'),
  environment: require('./domain-subscriber/environment.js'),
  governance: require('./domain-subscriber/governance.js'),
  industry: require('./domain-subscriber/industry.js'),
  infrastructure: require('./domain-subscriber/infrastructure.js'),
  intelligence: require('./domain-subscriber/intelligence.js'),
  law: require('./domain-subscriber/law.js'),
  medicine: require('./domain-subscriber/medicine.js'),
  population: require('./domain-subscriber/population.js'),
  science: require('./domain-subscriber/science.js'),
  technology: require('./domain-subscriber/technology.js'),
  trade: require('./domain-subscriber/trade.js')
});
var DOMAINS = Object.freeze(Object.keys(LANES));
function get(domain) { return LANES[String(domain || '').toLowerCase()] || null; }
function list() { return DOMAINS.map(function (domain) { return LANES[domain]; }); }
module.exports = { get: get, list: list, DOMAINS: DOMAINS, LANES: LANES };
