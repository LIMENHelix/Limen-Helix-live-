/**
 * brain-v2/bind/energy.js — the ENERGY domain, bound to its real sensors.
 *
 * This is the manifest R1 demands: every channel names its upstream, its clock, and its units.
 * Nothing here is aspirational — each entry was verified present in the live
 * /api/domain-snapshot payload on 2026-08-01.
 *
 * THE ONE DESIGN DECISION THAT MATTERS: RSS channels read `rss.recent7d`, NOT `value`.
 *
 * Measured on the live payload, 11 RSS sources:
 *     9 of 11 are pinned at exactly value=100 (the Google News page size)
 *     distinct values across all 11 —  value: 3    recent7d: 9
 *     Grid Reliability  value=100  medianAgeDays=184.7   (median article is six months old)
 *     EIA Electricity   value=52   medianAgeDays=382.7   (median article is over a year old)
 *
 * The existing brain thresholds these at 20/30/50/60. Against a field that is 100 for nine of
 * eleven sources those conditions are latched permanently on — they are not detecting anything,
 * they are reporting that a Google News search returned a full page. `recent7d` is already
 * computed and already served alongside it; nothing new has to be built to use it.
 *
 * Cadence is declared per channel (R6) because it drives how fast uncertainty grows when a
 * sensor goes quiet. A daily price silent for six hours is barely stale; an hourly feed silent
 * for six hours is most of the way to blind.
 */

'use strict';

var HOUR = 3600000;
var DAY = 24 * HOUR;

/** Reads a value out of a live /api/domain-snapshot source object. */
function pickLive(src, field) {
  if (!src) return null;
  if (field === 'recent7d') {
    return (src.rss && typeof src.rss.recent7d === 'number') ? src.rss.recent7d : null;
  }
  return (typeof src.value === 'number' && isFinite(src.value)) ? src.value : null;
}

/**
 * THE MANIFEST.
 *
 * `field` is the honest part: 'recent7d' where the raw count saturates, 'value' where the
 * number is a real quantity (a price, an alert count, a filing count) and does not.
 *
 * q/r are SET, not fitted [mark: prior]. r is higher for news-derived channels than for price
 * series because an article count is a noisier read of the world than a settlement price. See
 * core/channel.js for why nothing here is learned at n=250.
 */
var CHANNELS = [
  // ── price series: real quantities, no saturation ────────────────────────────────────
  { key: 'fredCrude',  name: 'FRED Crude Oil',              field: 'value',     source: 'FRED DCOILWTICO',            cadenceMs: DAY, units: '$/bbl', q: 0.02, r: 0.05 },
  { key: 'eiaPetro',   name: 'EIA Petroleum',               field: 'value',     source: 'EIA v2 EPCBRENT',            cadenceMs: DAY, units: '$/bbl', q: 0.02, r: 0.05 },
  { key: 'massiveOil', name: 'Massive Crude Oil',           field: 'value',     source: 'Polygon CL (key-gated)',     cadenceMs: DAY, units: '$/bbl', q: 0.02, r: 0.08 },

  // ── event / filing counts: real quantities, bounded but not saturated ───────────────
  { key: 'nwsAlerts',  name: 'NOAA NWS Alerts',             field: 'value',     source: 'api.weather.gov active',     cadenceMs: HOUR, units: 'alerts',  q: 0.05, r: 0.15 },
  { key: 'cisaKev',    name: 'CISA KEV',                    field: 'value',     source: 'CISA KEV 30d',               cadenceMs: DAY,  units: 'CVEs',    q: 0.03, r: 0.10 },
  { key: 'fedRegNrc',  name: 'Fed Reg NRC',                 field: 'value',     source: 'federalregister.gov 30d',    cadenceMs: DAY,  units: 'docs',    q: 0.03, r: 0.10 },
  { key: 'fedRegDoe',  name: 'Fed Reg DOE',                 field: 'value',     source: 'federalregister.gov 30d',    cadenceMs: DAY,  units: 'docs',    q: 0.03, r: 0.10 },

  // ── news channels: read recent7d, NEVER value ───────────────────────────────────────
  { key: 'gridRel',    name: 'Grid Reliability (FERC/NERC)', field: 'recent7d', source: 'Google News RSS',            cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },
  { key: 'natGas',     name: 'EIA Natural Gas Weekly',       field: 'recent7d', source: 'Google News RSS',            cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },
  { key: 'petroStatus',name: 'EIA Weekly Petroleum Status',  field: 'recent7d', source: 'Google News RSS',            cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },
  { key: 'opec',       name: 'OPEC Reference Basket',        field: 'recent7d', source: 'Google News RSS',            cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },
  { key: 'nuclear',    name: 'Nuclear Energy News',          field: 'recent7d', source: 'Google News RSS',            cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },
  { key: 'electricity',name: 'EIA Electricity Monthly',      field: 'recent7d', source: 'Google News RSS',            cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },
  { key: 'lng',        name: 'LNG Market News',              field: 'recent7d', source: 'Google News RSS',            cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },
  { key: 'iea',        name: 'IEA Energy News',              field: 'recent7d', source: 'Google News RSS',            cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },
  { key: 'solar',      name: 'Solar Industry News',          field: 'recent7d', source: 'Google News RSS',            cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },
  { key: 'wind',       name: 'Wind Energy News',             field: 'recent7d', source: 'Google News RSS',            cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },
  { key: 'coal',       name: 'Coal Transition News',         field: 'recent7d', source: 'Google News RSS',            cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 }
];

/**
 * FINDINGS — the six that the existing energy brain actually carries, expressed against
 * channel DEPARTURES rather than raw thresholds.
 *
 * 18 channels x 3 levels = a cap of 54, so six is comfortably inside R3. That is the point:
 * the honest library was always small. The 180-entry digest was never buildable against 14
 * observable conditions, and the cap now makes that impossible to ship rather than merely
 * inadvisable.
 *
 * Each `requires` names the channels the finding rests on. If any is absent or dead this
 * cycle the finding is not evaluated — it goes to candidates as `unevaluated`, never to
 * findings as false. That is the difference between "did not fire" and "could not be judged".
 */
var SIGMA = 2.0;   // [mark: prior] — same threshold as the core detector, stated once

var FINDINGS = [
  { id: 'OIL_SHOCK', requires: ['fredCrude'],
    basis: 'FRED WTI departing its own baseline by >=2sd',
    test: function (v, s, d) { return d.fredCrude && d.fredCrude.z >= SIGMA; } },

  { id: 'GRID_COLLAPSE', requires: ['gridRel', 'electricity'],
    basis: 'grid-reliability AND electricity news volume both elevated vs own baseline',
    test: function (v, s, d) { return d.gridRel && d.electricity && d.gridRel.z >= SIGMA && d.electricity.z >= 1.0; } },

  { id: 'PIPELINE_DISRUPTION', requires: ['natGas', 'lng'],
    basis: 'gas and LNG news co-elevated — chokepoint signature',
    test: function (v, s, d) { return d.natGas && d.lng && (d.natGas.z >= SIGMA || d.lng.z >= SIGMA) && (d.natGas.z + d.lng.z) >= 2.5; } },

  { id: 'RENEWABLE_INTERMITTENCY', requires: ['solar', 'wind'],
    basis: 'solar and wind coverage elevated together',
    test: function (v, s, d) { return d.solar && d.wind && (d.solar.z + d.wind.z) >= 2.5; } },

  { id: 'NUCLEAR_INCIDENT', requires: ['nuclear', 'fedRegNrc'],
    basis: 'nuclear coverage AND NRC filing activity both departing baseline',
    test: function (v, s, d) { return d.nuclear && d.fedRegNrc && d.nuclear.z >= SIGMA && d.fedRegNrc.z >= 1.0; } },

  { id: 'SYSTEMIC_ENERGY_STRESS', requires: ['fredCrude', 'gridRel'],
    basis: 'the fused domain state itself past 2sd, with price and grid both live',
    test: function (v, s, d) { return typeof s.departure === 'number' && Math.abs(s.departure) >= SIGMA; } }
];

/** Build the readings object for one cycle from a live /api/domain-snapshot energy object. */
function readLive(energyDomain) {
  var byName = {};
  (energyDomain && energyDomain.sources || []).forEach(function (s) { byName[s.name] = s; });
  var out = {};
  CHANNELS.forEach(function (c) {
    var v = pickLive(byName[c.name], c.field);
    if (v !== null) out[c.key] = { value: v };
  });
  return out;
}

/**
 * Build readings from a RECORDER row (handlers/feed-record.js).
 *
 * IMPORTANT LIMITATION, stated rather than hidden: the recorder stores each source's `v`,
 * which is the SATURATED `value` field. It does not store recent7d. So a historical replay
 * can only ever see the saturated number.
 *
 * That is not a defect of the replay — it is the demonstration. Feeding the stored `v` through
 * the liveness gate shows exactly which channels the old brain was thresholding on while they
 * never moved.
 */
function readRecorderRow(row) {
  var byName = {};
  (row && row.src || []).forEach(function (s) { byName[s.n] = s; });
  var out = {};
  CHANNELS.forEach(function (c) {
    var s = byName[c.name];
    if (s && typeof s.v === 'number' && isFinite(s.v)) out[c.key] = { value: s.v };
  });
  return out;
}

module.exports = {
  domain: 'energy',
  CHANNELS: CHANNELS,
  FINDINGS: FINDINGS,
  SIGMA: SIGMA,
  readLive: readLive,
  readRecorderRow: readRecorderRow,
  spec: function () {
    return {
      domain: 'energy',
      version: 'brain-v2/0.1.0-energy',
      levelsPerSensor: 3,
      channels: CHANNELS,
      findings: FINDINGS,
      efferent: null   // R7: nothing consumes this yet, and it says so
    };
  }
};
