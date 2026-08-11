/**
 * brain-v2/bind/trade.js — declaration only. No fixture exists; MANIFEST-ONLY.
 *
 * TWO NAMES: the file is `trade`, the domain key is `supplyChain`. Same split
 * bind/medicine.js and bind/science.js document. A fixture would be filed as
 * `supplyChain-recorder.json`.
 *
 * Thirteen channels, from the exact `supplyChain: buildDomain('supplyChain', [...])`
 * list. Every numeric meaning was read out of its fetcher.
 *
 * ZERO DECLARED RELATIONSHIPS. Two channels here also appear in bind/environment.js —
 * NOAA NWS Alerts and USGS Earthquakes — because the snapshot feeds them to both domains.
 * That makes them tempting to relate, and they are still two different hazards counted
 * two different ways: active weather alerts against M4.5+ earthquakes in 24h. Both are
 * "disruption" in English and nothing alike as numbers.
 *
 * The two index channels are also not a pair. Freight PPI is a US producer price index
 * for freight, published monthly; the World Bank Logistics Performance Index is a survey
 * score published every few years. Different statistic, different geography, and horizons
 * that differ by orders of magnitude.
 *
 * A NOTE ON SHARED CHANNELS. Declaring the same source in two domains is not duplication
 * to be avoided: each domain reads it through its own filter with its own baseline, and
 * an earthquake count means something different to an environment brain than to a trade
 * brain. What must never happen is a relationship spanning the two, and none exists —
 * `test/domains.js` asserts every relationship stays inside its own channel set.
 */

'use strict';

var FACTORY = require('./factory.js');
var DIAGNOSES = require('./diagnosis-registry.js');

var HOUR = 3600000;
var DAY = 24 * HOUR;
var MONTH = 30 * DAY;
var YEAR = 365 * DAY;

var CHANNELS = [
  // ── Price and survey indices: real published quantities. ──
  { key: 'freightPpi',    name: 'BLS Freight PPI',            recordedField: 'v',  field: 'value',    source: 'BLS producer price index, freight',        cadenceMs: MONTH, units: 'index points',        q: 0.02, r: 0.06 },
  { key: 'logisticsIndex',name: 'World Bank Logistics Index', recordedField: 'v',  field: 'value',    source: 'World Bank Logistics Performance Index',   cadenceMs: YEAR,  units: 'index score',         q: 0.01, r: 0.10 },

  // ── Event counts. Real occurrences, shared with environment by the snapshot. ──
  { key: 'nwsAlerts',     name: 'NOAA NWS Alerts',            recordedField: 'v',  field: 'value',    source: 'api.weather.gov active alerts',            cadenceMs: HOUR,  units: 'active alerts',       q: 0.05, r: 0.15 },
  { key: 'earthquakes',   name: 'USGS Earthquakes',           recordedField: 'v',  field: 'value',    source: 'USGS feed, M4.5+ in 24h',                  cadenceMs: HOUR,  units: 'quakes M4.5+ in 24h', q: 0.05, r: 0.15 },
  /* A 30-DAY FLOW, not the catalogue size. `fetchCISAKEV()` counts entries whose
     `dateAdded` falls inside a 30-day cutoff; the catalogue total is computed in the same
     function and used only for the label string. */
  { key: 'cisaKev',       name: 'CISA KEV',                   recordedField: 'v',  field: 'value',    source: 'CISA Known Exploited Vulnerabilities feed, entries added in 30d', cadenceMs: DAY, units: 'new KEV entries in 30d', q: 0.03, r: 0.10 },

  /* NEWS RECENCY COUNT. */
  { key: 'supplyNews',    name: 'RSS Supply Chain',           recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, supply chain',          cadenceMs: DAY,   units: 'articles/7d',         q: 0.06, r: 0.25 },

  /* A KEYWORD-MATCH COUNT. Counts sanction-related TERMS in an OFAC feed, not confirmed
     actions — the units say so, and no finding is built on it. */
  { key: 'ofac',          name: 'OFAC Recent Actions',        recordedField: 'v',  field: 'value',    source: 'OFAC feed keyword match',                  cadenceMs: DAY,   units: 'keyword mentions',    q: 0.06, r: 0.25 },

  /* FEDERAL REGISTER DOCUMENT COUNTS across six transport and trade regulators. */
  { key: 'fedRegCbp',     name: 'Fed Reg CBP',                recordedField: 'v',  field: 'value',    source: 'federalregister.gov, CBP, 30d',            cadenceMs: DAY,   units: 'documents in 30d',    q: 0.04, r: 0.18 },
  { key: 'fedRegUscg',    name: 'Fed Reg Coast Guard',        recordedField: 'v',  field: 'value',    source: 'federalregister.gov, Coast Guard, 30d',    cadenceMs: DAY,   units: 'documents in 30d',    q: 0.04, r: 0.18 },
  { key: 'fedRegFaa',     name: 'Fed Reg FAA',                recordedField: 'v',  field: 'value',    source: 'federalregister.gov, FAA, 30d',            cadenceMs: DAY,   units: 'documents in 30d',    q: 0.04, r: 0.18 },
  { key: 'fedRegNhtsa',   name: 'Fed Reg NHTSA',              recordedField: 'v',  field: 'value',    source: 'federalregister.gov, NHTSA, 30d',          cadenceMs: DAY,   units: 'documents in 30d',    q: 0.04, r: 0.18 },
  { key: 'fedRegFmcsa',   name: 'Fed Reg FMCSA',              recordedField: 'v',  field: 'value',    source: 'federalregister.gov, FMCSA, 30d',          cadenceMs: DAY,   units: 'documents in 30d',    q: 0.04, r: 0.18 },
  { key: 'fedRegUstr',    name: 'Fed Reg USTR',               recordedField: 'v',  field: 'value',    source: 'federalregister.gov, USTR, 30d',           cadenceMs: DAY,   units: 'documents in 30d',    q: 0.04, r: 0.18 }
];

var SIGMA = 2.0;   // [mark: prior]

/**
 * FINDINGS. Neutrally named: each says a specific channel departed its own baseline and
 * stops there. A freight price index moving is not by itself a supply shock — it could be
 * fuel, capacity, seasonality or demand — and naming the finding after a cause would
 * assert something the number cannot carry.
 *
 * Nothing is built on the news count, the OFAC keyword count or the six Federal Register
 * counts. No fused-state finding: the domain already reports its own dysregulation, and
 * re-testing it restates a number the cycle has already emitted.
 */
/**
 * DIAGNOSES — declared as data in bind/diagnosis-registry.js, interpreted by
 * bind/diagnosis-forms.js. These 4 were this domain's inline `test:` functions until the
 * registry migration; the entries were generated from them and the equivalence is proved
 * in brain-v2/test/diagnosis-registry.js against the predicates as they were at ea5923ba.
 *
 * The registry is keyed (domain, id), so reading it by domain here is the whole coupling.
 */
var FINDINGS = DIAGNOSES.findingsFor('supplyChain');

module.exports = FACTORY.createBinder({
  /* THE SNAPSHOT KEY, not the filename. */
  domain: 'supplyChain',
  version: 'brain-v2/0.1.0-trade',
  levelsPerSensor: 3,
  sigma: SIGMA,
  channels: CHANNELS,
  findings: FINDINGS,
  /* ZERO. Two different hazard counts, and two indices whose horizons differ by orders
     of magnitude. */
  relationships: [],
  efferent: null   // R7
});
