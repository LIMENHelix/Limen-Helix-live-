/**
 * brain-v2/bind/infrastructure.js — declaration only. No fixture exists; MANIFEST-ONLY.
 *
 * Eighteen channels, from the exact `infrastructure: buildDomain('infrastructure', [...])`
 * list. Every numeric meaning was read out of its fetcher. The largest domain declared so
 * far, and still zero relationships.
 *
 * THE THREE FRED SERIES ARE NOT A PAIR. Construction spending, the transportation
 * services index and federal investment all arrive as a percentage change, which makes
 * them look interchangeable. They are percentage changes OF DIFFERENT THINGS: private and
 * public construction outlays, freight and passenger transport volume, and federal
 * capital spending. Sharing a unit is not sharing a latent — "% change" is a
 * transformation, not a quantity, and relating them would grade the difference between
 * three separate parts of the economy as an instrument disagreement.
 *
 * The two World Bank channels are also unrelated to each other: a logistics performance
 * survey score and rail network kilometres are different measurements on different
 * schedules.
 *
 * NOAA NWS Alerts and USGS Earthquakes appear here as well as in environment and trade,
 * because the snapshot feeds them to all three. Each domain reads them through its own
 * baseline; what must never happen is a relationship spanning domains, and none exists.
 */

'use strict';

var FACTORY = require('./factory.js');
var DIAGNOSES = require('./diagnosis-registry.js');

var HOUR = 3600000;
var DAY = 24 * HOUR;
var MONTH = 30 * DAY;
var YEAR = 365 * DAY;

var CHANNELS = [
  /* PERCENTAGE CHANGES OF THREE DIFFERENT SERIES. Same unit, different quantities. */
  { key: 'construction',   name: 'FRED Construction Spending', recordedField: 'v',  field: 'value',    source: 'FRED construction spending series',        cadenceMs: MONTH, units: '% change, construction outlays', q: 0.02, r: 0.08 },
  { key: 'transportIndex', name: 'FRED Transportation Index',  recordedField: 'v',  field: 'value',    source: 'FRED transportation services index',       cadenceMs: MONTH, units: '% change, transport volume',     q: 0.02, r: 0.08 },
  { key: 'fedInvestment',  name: 'FRED Federal Investment',    recordedField: 'v',  field: 'value',    source: 'FRED federal investment series',           cadenceMs: MONTH, units: '% change, federal capital spend', q: 0.02, r: 0.08 },

  /* PUBLISHED INDICES AND STOCKS, on multi-year schedules. */
  { key: 'logisticsIndex', name: 'World Bank Logistics Index', recordedField: 'v',  field: 'value',    source: 'World Bank Logistics Performance Index',   cadenceMs: YEAR,  units: 'index score',                    q: 0.01, r: 0.10 },
  { key: 'railKm',         name: 'World Bank Infrastructure',  recordedField: 'v',  field: 'value',    source: 'World Bank rail network length',           cadenceMs: YEAR,  units: 'rail kilometres',                q: 0.01, r: 0.10 },

  /* EVENT COUNTS. Real occurrences, shared with environment and trade by the snapshot. */
  { key: 'nwsAlerts',      name: 'NOAA NWS Alerts',            recordedField: 'v',  field: 'value',    source: 'api.weather.gov active alerts',            cadenceMs: HOUR,  units: 'active alerts',                  q: 0.05, r: 0.15 },
  { key: 'earthquakes',    name: 'USGS Earthquakes',           recordedField: 'v',  field: 'value',    source: 'USGS feed, M4.5+ in 24h',                  cadenceMs: HOUR,  units: 'quakes M4.5+ in 24h',            q: 0.05, r: 0.15 },
  { key: 'cisaKev',        name: 'CISA KEV',                   recordedField: 'v',  field: 'value',    source: 'CISA Known Exploited Vulnerabilities feed, entries added in 30d', cadenceMs: DAY, units: 'new KEV entries in 30d', q: 0.03, r: 0.10 },

  /* NEWS RECENCY COUNTS. */
  { key: 'phmsa',          name: 'PHMSA Incidents',            recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, pipeline incidents',    cadenceMs: DAY,   units: 'articles/7d',                    q: 0.06, r: 0.25 },
  { key: 'cisaAdvisories', name: 'CISA Advisories',            recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, CISA advisories',       cadenceMs: DAY,   units: 'articles/7d',                    q: 0.06, r: 0.25 },
  { key: 'uawStrikes',     name: 'UAW Strike Tracker',         recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, UAW strikes',           cadenceMs: DAY,   units: 'articles/7d',                    q: 0.06, r: 0.25 },

  /* FEDERAL REGISTER DOCUMENT COUNTS across seven agencies. */
  { key: 'fedRegOsha',     name: 'Fed Reg OSHA',               recordedField: 'v',  field: 'value',    source: 'federalregister.gov, OSHA, 30d',           cadenceMs: DAY,   units: 'documents in 30d',               q: 0.04, r: 0.18 },
  { key: 'fedRegDol',      name: 'Fed Reg DOL',                recordedField: 'v',  field: 'value',    source: 'federalregister.gov, Labor, 30d',          cadenceMs: DAY,   units: 'documents in 30d',               q: 0.04, r: 0.18 },
  { key: 'fedRegFerc',     name: 'Fed Reg FERC',               recordedField: 'v',  field: 'value',    source: 'federalregister.gov, FERC, 30d',           cadenceMs: DAY,   units: 'documents in 30d',               q: 0.04, r: 0.18 },
  { key: 'fedRegDhs',      name: 'Fed Reg DHS',                recordedField: 'v',  field: 'value',    source: 'federalregister.gov, DHS, 30d',            cadenceMs: DAY,   units: 'documents in 30d',               q: 0.04, r: 0.18 },
  { key: 'fedRegDot',      name: 'Fed Reg DOT',                recordedField: 'v',  field: 'value',    source: 'federalregister.gov, Transportation, 30d', cadenceMs: DAY,   units: 'documents in 30d',               q: 0.04, r: 0.18 },
  { key: 'fedRegHud',      name: 'Fed Reg HUD',                recordedField: 'v',  field: 'value',    source: 'federalregister.gov, HUD, 30d',            cadenceMs: DAY,   units: 'documents in 30d',               q: 0.04, r: 0.18 },
  { key: 'fedRegUsace',    name: 'Fed Reg Army Corps',         recordedField: 'v',  field: 'value',    source: 'federalregister.gov, Army Corps, 30d',     cadenceMs: DAY,   units: 'documents in 30d',               q: 0.04, r: 0.18 }
];

var SIGMA = 2.0;   // [mark: prior]

/**
 * FINDINGS. Only on the five channels carrying a measured quantity, each stating that one
 * channel departed its own baseline and nothing about why. Construction spending falling
 * could be rates, weather, materials or a completed cycle; naming it after a cause would
 * assert what a percentage change cannot carry.
 *
 * Nothing on the three RSS counts or the seven Federal Register counts.
 */
/**
 * DIAGNOSES — declared as data in bind/diagnosis-registry.js, interpreted by
 * bind/diagnosis-forms.js. These 6 were this domain's inline `test:` functions until the
 * registry migration; the entries were generated from them and the equivalence is proved
 * in brain-v2/test/diagnosis-registry.js against the predicates as they were at ea5923ba.
 *
 * The registry is keyed (domain, id), so reading it by domain here is the whole coupling.
 */
var FINDINGS = DIAGNOSES.findingsFor('infrastructure');

module.exports = FACTORY.createBinder({
  domain: 'infrastructure',
  version: 'brain-v2/0.1.0-infrastructure',
  levelsPerSensor: 3,
  sigma: SIGMA,
  channels: CHANNELS,
  findings: FINDINGS,
  /* ZERO. Three percentage changes of three different series; "% change" is a
     transformation, not a quantity. */
  relationships: [],
  efferent: null   // R7
});
