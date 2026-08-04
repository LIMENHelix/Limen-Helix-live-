/**
 * brain-v2/bind/governance.js — declaration only. No fixture exists; MANIFEST-ONLY.
 *
 * Twelve channels, from the exact `governance: buildDomain('governance', [...])` list in
 * handlers/domain-snapshot.js. Every numeric meaning was read out of its fetcher.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * ZERO RELATIONSHIPS, AND THIS DOMAIN HAS THE HARDEST REJECTION SO FAR.
 *
 * Three channels come from the World Bank's Worldwide Governance Indicators:
 *
 *   World Bank Governance          control of corruption
 *   World Bank Gov Effectiveness   government effectiveness
 *   World Bank Rule of Law         rule of law
 *
 * Same publisher, same construction, same units, same geography, same annual horizon.
 * Every surface property a relationship is checked on matches, and they are still not a
 * shared latent — because the WGI is explicitly a set of SIX DISTINCT DIMENSIONS. Control
 * of corruption and government effectiveness are designed to measure different things;
 * that they correlate across countries is a finding about governance, not evidence that
 * two instruments are reading one quantity.
 *
 * This is the case where "same units and same horizon" is most tempting and least
 * sufficient. A relationship asserts the two observe ONE latent, so that a gap between
 * them is a fault. Here a gap is the signal: a state can be effective and corrupt, and
 * divergence would report that real distinction as an instrument failure.
 * ═══════════════════════════════════════════════════════════════════════════════════
 *
 * The other nine channels are seven RSS keyword queries, a Federal Register document
 * count and a vulnerability flow. None pairs with anything.
 */

'use strict';

var FACTORY = require('./factory.js');

var HOUR = 3600000;
var DAY = 24 * HOUR;
var YEAR = 365 * DAY;

var CHANNELS = [
  /* PUBLISHED COMPOSITE INDICES. Survey-derived statistics, annual — three different
     dimensions of one indicator family, not three reads of one dimension. */
  { key: 'corruption',   name: 'World Bank Governance',        recordedField: 'v',  field: 'value',    source: 'World Bank WGI, control of corruption',   cadenceMs: YEAR, units: 'index score',        q: 0.01, r: 0.08 },
  { key: 'govEffect',    name: 'World Bank Gov Effectiveness', recordedField: 'v',  field: 'value',    source: 'World Bank WGI, government effectiveness', cadenceMs: YEAR, units: 'index score',       q: 0.01, r: 0.08 },
  { key: 'ruleOfLaw',    name: 'World Bank Rule of Law',       recordedField: 'v',  field: 'value',    source: 'World Bank WGI, rule of law',             cadenceMs: YEAR, units: 'index score',        q: 0.01, r: 0.08 },

  /* A VULNERABILITY FLOW. Entries added to the CISA known-exploited feed in 30 days;
     the catalogue total never reaches this channel. */
  { key: 'cisaKev',      name: 'CISA KEV',                     recordedField: 'v',  field: 'value',    source: 'CISA Known Exploited Vulnerabilities feed, entries added in 30d', cadenceMs: DAY, units: 'new KEV entries in 30d', q: 0.03, r: 0.10 },

  /* NEWS RECENCY COUNTS. Seven queries across legislative, oversight and watchdog
     sources. Measures of coverage, so no finding is built on any of them. */
  { key: 'govTrack',     name: 'GovTrack',                     recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, legislative tracking',  cadenceMs: DAY,  units: 'articles/7d',        q: 0.06, r: 0.25 },
  { key: 'congress',     name: 'Congress.gov',                 recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Congress.gov',          cadenceMs: DAY,  units: 'articles/7d',        q: 0.06, r: 0.25 },
  { key: 'gao',          name: 'GAO Reports',                  recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, GAO reports',           cadenceMs: DAY,  units: 'articles/7d',        q: 0.06, r: 0.25 },
  { key: 'cbo',          name: 'CBO Publications',             recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, CBO publications',      cadenceMs: DAY,  units: 'articles/7d',        q: 0.06, r: 0.25 },
  { key: 'omb',          name: 'OMB Releases',                 recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, OMB releases',          cadenceMs: DAY,  units: 'articles/7d',        q: 0.06, r: 0.25 },
  { key: 'brennan',      name: 'Brennan Center',               recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Brennan Center',        cadenceMs: DAY,  units: 'articles/7d',        q: 0.06, r: 0.25 },
  { key: 'pogo',         name: 'POGO',                         recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, POGO',                  cadenceMs: DAY,  units: 'articles/7d',        q: 0.06, r: 0.25 },

  /* FEDERAL REGISTER DOCUMENT COUNT. */
  { key: 'fedRegEop',    name: 'Fed Reg EOP',                  recordedField: 'v',  field: 'value',    source: 'federalregister.gov, Executive Office of the President, 30d', cadenceMs: DAY, units: 'documents in 30d', q: 0.04, r: 0.18 }
];

var SIGMA = 2.0;   // [mark: prior]

/**
 * FINDINGS. Three, one per published index, each saying only that a specific score
 * departed its own baseline. They are annual, so they will usually abstain — that is a
 * true statement about how fast the World Bank publishes, not a gap to fill by promoting
 * one of the seven news counts.
 *
 * Deliberately separate rather than combined. A joint finding across the three would
 * assert they should move together, which is the relationship this file spent its header
 * refusing to declare.
 */
var FINDINGS = [
  { id: 'CORRUPTION_INDEX_DEPARTURE', requires: ['corruption'],
    basis: 'control-of-corruption index departing its own baseline by >=2sd; direction not interpreted',
    test: function (v, s, d) { return d.corruption && Math.abs(d.corruption.z) >= SIGMA; } },

  { id: 'GOV_EFFECTIVENESS_DEPARTURE', requires: ['govEffect'],
    basis: 'government-effectiveness index departing its own baseline; direction not interpreted',
    test: function (v, s, d) { return d.govEffect && Math.abs(d.govEffect.z) >= SIGMA; } },

  { id: 'RULE_OF_LAW_DEPARTURE', requires: ['ruleOfLaw'],
    basis: 'rule-of-law index departing its own baseline; direction not interpreted',
    test: function (v, s, d) { return d.ruleOfLaw && Math.abs(d.ruleOfLaw.z) >= SIGMA; } }
];

module.exports = FACTORY.createBinder({
  domain: 'governance',
  version: 'brain-v2/0.1.0-governance',
  levelsPerSensor: 3,
  sigma: SIGMA,
  channels: CHANNELS,
  findings: FINDINGS,
  /* ZERO. The three WGI indices share every surface property and measure three different
     dimensions by design; a gap between them is the signal, not a fault. */
  relationships: [],
  efferent: null   // R7
});
