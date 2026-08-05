/**
 * brain-v2/bind/agriculture.js — declaration only. No fixture exists; MANIFEST-ONLY.
 *
 * Thirteen channels, from the exact `agriculture: buildDomain('agriculture', [...])`
 * list. Every numeric meaning was read out of its fetcher.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * ZERO RELATIONSHIPS. THE TRAP IN THIS DOMAIN IS THE TWO DROUGHT CHANNELS.
 *
 *   USDA Drought Monitor   percentage of the contiguous US in D2-D4 drought — a measured
 *                          area, published weekly
 *   NOAA CPC Drought       the number of times "intensification" and related terms appear
 *                          in the Climate Prediction Center's seasonal outlook text
 *
 * Both are called drought. One is a measurement of how much land is in drought; the other
 * counts words in a forecast discussion. Relating them would declare that a measured area
 * and a count of forecasters' vocabulary observe one latent, and a gap between them —
 * which would occur every time the outlook was written in different language — would be
 * reported as a sensor disagreement.
 *
 * This is the same class of mistake as relating a keyword count to the thing the keywords
 * are about, and the units below say plainly which is which.
 * ═══════════════════════════════════════════════════════════════════════════════════
 *
 * FDA Recalls appears here and in medicine, because the snapshot feeds it to both. It is
 * an `<item>` count from a food-recall RSS and the snapshot tracks it under agriculture,
 * which is where it belongs; medicine declares it too, with units that say what it counts
 * so it can never be mistaken for drug enforcement.
 */

'use strict';

var FACTORY = require('./factory.js');

var HOUR = 3600000;
var DAY = 24 * HOUR;
var WEEK = 7 * DAY;
var YEAR = 365 * DAY;

var CHANNELS = [
  /* MEASURED PHYSICAL AND PRODUCTION QUANTITIES. */
  { key: 'droughtArea',  name: 'USDA Drought Monitor',  recordedField: 'v',  field: 'value',    source: 'US Drought Monitor, CONUS area in D2-D4',   cadenceMs: WEEK, units: '% of CONUS in D2+ drought',  q: 0.02, r: 0.08 },
  { key: 'cornYield',    name: 'USDA NASS',             recordedField: 'v',  field: 'value',    source: 'USDA NASS, corn yield',                     cadenceMs: YEAR, units: 'bushels per acre',           q: 0.01, r: 0.08 },
  { key: 'wheatIndex',   name: 'FAO FAOSTAT',           recordedField: 'v',  field: 'value',    source: 'FAO FAOSTAT, wheat output indexed',         cadenceMs: YEAR, units: 'output index',               q: 0.01, r: 0.10 },
  { key: 'foodIndex',    name: 'World Bank Food Index', recordedField: 'v',  field: 'value',    source: 'World Bank food production index',          cadenceMs: YEAR, units: '% change YoY',               q: 0.01, r: 0.10 },
  { key: 'agAlerts',     name: 'NOAA NWS Ag Alerts',    recordedField: 'v',  field: 'value',    source: 'api.weather.gov, agriculture-impact alerts', cadenceMs: HOUR, units: 'ag-impact alerts',          q: 0.05, r: 0.15 },

  /* A KEYWORD COUNT OVER FORECAST TEXT. Counts how often intensification terms appear in
     the CPC seasonal outlook — a measure of how the outlook is WRITTEN, not of drought.
     Declared because it is in the domain's source list; excluded from every finding. */
  { key: 'cpcOutlook',   name: 'NOAA CPC Drought',      recordedField: 'v',  field: 'value',    source: 'NOAA CPC seasonal outlook, intensification term count', cadenceMs: WEEK, units: 'keyword mentions', q: 0.06, r: 0.25 },

  /* FEED ITEM COUNT. Food recalls; also declared by medicine, where its units say the
     same thing so the two can never be confused. */
  { key: 'fdaRecalls',   name: 'FDA Recalls',           recordedField: 'v',  field: 'value',    source: 'FDA recalls RSS, item count (food)',        cadenceMs: DAY,  units: 'feed items',                 q: 0.05, r: 0.20 },

  /* NEWS RECENCY COUNT. */
  { key: 'agNews',       name: 'RSS Agriculture',       recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, agriculture',            cadenceMs: DAY,  units: 'articles/7d',                q: 0.06, r: 0.25 },

  /* FEDERAL REGISTER DOCUMENT COUNTS across five agencies. */
  { key: 'fedRegUsda',   name: 'Fed Reg USDA',          recordedField: 'v',  field: 'value',    source: 'federalregister.gov, USDA, 30d',            cadenceMs: DAY,  units: 'documents in 30d',           q: 0.04, r: 0.18 },
  { key: 'fedRegFda',    name: 'Fed Reg FDA',           recordedField: 'v',  field: 'value',    source: 'federalregister.gov, FDA, 30d',             cadenceMs: DAY,  units: 'documents in 30d',           q: 0.04, r: 0.18 },
  { key: 'fedRegEpa',    name: 'Fed Reg EPA',           recordedField: 'v',  field: 'value',    source: 'federalregister.gov, EPA, 30d',             cadenceMs: DAY,  units: 'documents in 30d',           q: 0.04, r: 0.18 },
  { key: 'fedRegAphis',  name: 'Fed Reg APHIS',         recordedField: 'v',  field: 'value',    source: 'federalregister.gov, APHIS, 30d',           cadenceMs: DAY,  units: 'documents in 30d',           q: 0.04, r: 0.18 },
  { key: 'fedRegFsis',   name: 'Fed Reg FSIS',          recordedField: 'v',  field: 'value',    source: 'federalregister.gov, FSIS, 30d',            cadenceMs: DAY,  units: 'documents in 30d',           q: 0.04, r: 0.18 }
];

var SIGMA = 2.0;   // [mark: prior]

/**
 * FINDINGS. Only on the five channels that measure something physical or produced, each
 * stating that one channel departed its own baseline and nothing about why.
 *
 * Nothing on the CPC outlook term count, the recall feed item count, the news query or
 * the five Federal Register counts. A finding on the CPC channel in particular would fire
 * when forecasters changed their wording and be reported as a drought signal, next to a
 * channel that actually measures drought area — which is exactly how a keyword count gets
 * mistaken for the thing it names.
 */
var FINDINGS = [
  { id: 'DROUGHT_AREA_DEPARTURE', requires: ['droughtArea'],
    basis: 'percentage of CONUS in D2-D4 drought departing its own baseline by >=2sd; direction not interpreted',
    test: function (v, s, d) { return d.droughtArea && Math.abs(d.droughtArea.z) >= SIGMA; } },

  { id: 'CORN_YIELD_DEPARTURE', requires: ['cornYield'],
    basis: 'USDA corn yield departing its own baseline',
    test: function (v, s, d) { return d.cornYield && Math.abs(d.cornYield.z) >= SIGMA; } },

  { id: 'WHEAT_OUTPUT_DEPARTURE', requires: ['wheatIndex'],
    basis: 'FAO wheat output index departing its own baseline',
    test: function (v, s, d) { return d.wheatIndex && Math.abs(d.wheatIndex.z) >= SIGMA; } },

  { id: 'FOOD_PRODUCTION_DEPARTURE', requires: ['foodIndex'],
    basis: 'World Bank food production index departing its own baseline',
    test: function (v, s, d) { return d.foodIndex && Math.abs(d.foodIndex.z) >= SIGMA; } },

  { id: 'AG_ALERT_DEPARTURE', requires: ['agAlerts'],
    basis: 'agriculture-impact weather alert count departing its own baseline',
    test: function (v, s, d) { return d.agAlerts && Math.abs(d.agAlerts.z) >= SIGMA; } },

  { id: 'DROUGHT_AND_ALERTS_CO_DEPARTING', requires: ['droughtArea', 'agAlerts'],
    basis: 'measured drought area and agriculture-impact alerts both departing their own baselines — a slow area measure and a fast event count moving together, which either alone cannot distinguish from its own noise',
    test: function (v, s, d) {
      return d.droughtArea && d.agAlerts && Math.abs(d.droughtArea.z) >= 1.0 && Math.abs(d.agAlerts.z) >= 1.0 &&
             (Math.abs(d.droughtArea.z) + Math.abs(d.agAlerts.z)) >= 2.5;
    } }
];

module.exports = FACTORY.createBinder({
  domain: 'agriculture',
  version: 'brain-v2/0.1.0-agriculture',
  levelsPerSensor: 3,
  sigma: SIGMA,
  channels: CHANNELS,
  findings: FINDINGS,
  /* ZERO. The two drought channels measure an area and a vocabulary. */
  relationships: [],
  efferent: null   // R7
});
