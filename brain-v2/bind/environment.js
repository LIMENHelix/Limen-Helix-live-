/**
 * brain-v2/bind/environment.js — declaration only. No fixture exists; MANIFEST-ONLY.
 *
 * Ten channels, from the exact `buildDomain('environment', [...])` list in
 * handlers/domain-snapshot.js. Every numeric meaning was read out of its fetcher.
 *
 * THIS DOMAIN IS THE CLEAREST CASE FOR ZERO RELATIONSHIPS. Its ten sources measure a
 * temperature anomaly, two different kinds of hazard count, five separate news queries
 * and two Federal Register document counts. No two of them measure the same statistic in
 * the same units — an earthquake count and a weather-alert count are both "hazards" in
 * English and nothing alike as numbers.
 *
 * Declaring a pair anyway to avoid an empty list would create a claim divergence must
 * then grade, and it would grade it against a latent nobody could defend. Zero is the
 * honest answer and the factory accepts it.
 *
 * FIVE OF THE TEN ARE RSS KEYWORD QUERIES, and they are declared `field: 'recent7d'` for
 * the reason bind/energy.js records: the raw `value` on those saturates, because a news
 * query returns a full page and pins the count at 100 forever. Unlike energy, this domain
 * has no legacy fixture, so they also declare `recordedField: 'r7'` — the un-saturated
 * recency count the recorder has stored since 2026-08-01. Energy's thirteen equivalents
 * stay on 'v' because their fixture predates that field; here there is no such history to
 * preserve, so the correct field is used from the start.
 */

'use strict';

var FACTORY = require('./factory.js');

var HOUR = 3600000;
var DAY = 24 * HOUR;
var MONTH = 30 * DAY;

/**
 * q/r are SET, not fitted [mark: prior]. A temperature anomaly is a measured physical
 * quantity and gets the lowest r; event counts sit in the middle; news recency counts get
 * the highest, because an article count is a read of coverage rather than of the world.
 */
var CHANNELS = [
  // ── Measured physical quantity. ──
  { key: 'tempAnomaly',  name: 'NOAA Climate',           recordedField: 'v',  field: 'value',     source: 'NOAA climate data, temperature anomaly',   cadenceMs: DAY,   units: 'degrees anomaly',      q: 0.01, r: 0.05 },

  // ── Event counts. Real occurrences, not publications about occurrences. ──
  { key: 'nwsAlerts',    name: 'NOAA Alerts',            recordedField: 'v',  field: 'value',     source: 'api.weather.gov active alerts',            cadenceMs: HOUR,  units: 'active alerts',        q: 0.05, r: 0.15 },
  { key: 'earthquakes',  name: 'USGS Earthquakes',       recordedField: 'v',  field: 'value',     source: 'USGS feed, M4.5+ in 24h',                  cadenceMs: HOUR,  units: 'quakes M4.5+ in 24h',  q: 0.05, r: 0.15 },

  /* NEWS RECENCY COUNTS. `recent7d`, not `value` — the raw count saturates at a full page.
     A measure of coverage, so no finding is built on any of them. */
  { key: 'epaNews',      name: 'EPA News',               recordedField: 'r7', field: 'recent7d',  source: 'RSS keyword query, EPA enforcement terms',  cadenceMs: DAY,   units: 'articles/7d',          q: 0.06, r: 0.25 },
  { key: 'usgsNews',     name: 'USGS News',              recordedField: 'r7', field: 'recent7d',  source: 'RSS keyword query, USGS earth science',     cadenceMs: DAY,   units: 'articles/7d',          q: 0.06, r: 0.25 },
  { key: 'forestWatch',  name: 'Global Forest Watch',    recordedField: 'r7', field: 'recent7d',  source: 'RSS keyword query, forest loss',            cadenceMs: DAY,   units: 'articles/7d',          q: 0.06, r: 0.25 },
  { key: 'iucn',         name: 'IUCN Red List',          recordedField: 'r7', field: 'recent7d',  source: 'RSS keyword query, biodiversity',           cadenceMs: DAY,   units: 'articles/7d',          q: 0.06, r: 0.25 },
  { key: 'climateNews',  name: 'Inside Climate News',    recordedField: 'r7', field: 'recent7d',  source: 'RSS keyword query, climate journalism',     cadenceMs: DAY,   units: 'articles/7d',          q: 0.06, r: 0.25 },

  /* DOCUMENT COUNTS. Publication volume; excluded from findings for the same reason. */
  { key: 'fedRegEpa',    name: 'Fed Reg EPA',            recordedField: 'v',  field: 'value',     source: 'federalregister.gov, EPA, 30d',            cadenceMs: DAY,   units: 'documents in 30d',     q: 0.04, r: 0.18 },
  { key: 'fedRegDoi',    name: 'Fed Reg Interior',       recordedField: 'v',  field: 'value',     source: 'federalregister.gov, Interior, 30d',       cadenceMs: DAY,   units: 'documents in 30d',     q: 0.04, r: 0.18 }
];

var SIGMA = 2.0;   // [mark: prior]

/**
 * FINDINGS. Only on the three channels that measure something that happened — a
 * temperature, a weather alert, an earthquake — and only as a departure from that
 * channel's own baseline. Nothing on the five news queries or the two document counts:
 * those move when somebody publishes, and a finding built on them would report a busy
 * newsroom as an environmental event.
 */
var FINDINGS = [
  { id: 'TEMPERATURE_ANOMALY', requires: ['tempAnomaly'],
    basis: 'temperature anomaly departing its own baseline by >=2sd',
    test: function (v, s, d) { return d.tempAnomaly && Math.abs(d.tempAnomaly.z) >= SIGMA; } },

  { id: 'SEISMIC_ACTIVITY', requires: ['earthquakes'],
    basis: 'M4.5+ earthquake count departing its own baseline',
    test: function (v, s, d) { return d.earthquakes && d.earthquakes.z >= SIGMA; } },

  { id: 'SEVERE_WEATHER', requires: ['nwsAlerts'],
    basis: 'active NWS alert count departing its own baseline',
    test: function (v, s, d) { return d.nwsAlerts && d.nwsAlerts.z >= SIGMA; } },

  { id: 'COMPOUND_HAZARD', requires: ['nwsAlerts', 'earthquakes'],
    basis: 'weather alerts and seismic activity both elevated — two independent hazard counts, which either alone cannot distinguish from its own noise',
    test: function (v, s, d) {
      return d.nwsAlerts && d.earthquakes && d.nwsAlerts.z >= 1.0 && d.earthquakes.z >= 1.0 &&
             (d.nwsAlerts.z + d.earthquakes.z) >= 2.5;
    } },

  { id: 'SYSTEMIC_ENVIRONMENTAL_STRESS', requires: ['tempAnomaly', 'nwsAlerts'],
    basis: 'the fused domain state itself past 2sd, with a physical measure and an event count both live',
    test: function (v, s, d) { return typeof s.departure === 'number' && Math.abs(s.departure) >= SIGMA; } }
];

module.exports = FACTORY.createBinder({
  domain: 'environment',
  version: 'brain-v2/0.1.0-environment',
  levelsPerSensor: 3,
  sigma: SIGMA,
  channels: CHANNELS,
  findings: FINDINGS,
  /* ZERO. A temperature, two hazard counts, five news queries and two document counts:
     no two measure the same statistic in the same units. */
  relationships: [],
  efferent: null   // R7
});
