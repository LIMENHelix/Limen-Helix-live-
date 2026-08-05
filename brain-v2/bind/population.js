/**
 * brain-v2/bind/population.js — declaration only. No fixture exists; MANIFEST-ONLY.
 *
 * Fifteen channels, from the exact `population: buildDomain('population', [...])` list in
 * handlers/domain-snapshot.js. Every numeric meaning was read out of its fetcher.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * THE CLOSEST RELATIONSHIP CANDIDATE IN THE ENTIRE ROLLOUT, AND IT IS STILL REFUSED.
 *
 * Two channels look like two independent publishers estimating one quantity:
 *
 *   World Bank Population   api.worldbank.org/v2/country/USA/indicator/SP.POP.TOTL
 *   UN Population           population.un.org/dataportalapi/.../indicators/49/locations/840
 *
 * Different organisations, different APIs, same country (UN location 840 is the United
 * States), both annual. Unlike every earlier candidate this one is not disqualified by
 * population, denominator or horizon, and the difference in scale — people against
 * thousands — would not disqualify it either, because divergence standardises each
 * channel against its own baseline before comparing.
 *
 * IT IS REFUSED ON PROVENANCE, NOT ON PLAUSIBILITY. The World Bank side is
 * self-describing: `SP.POP.TOTL` is in the URL. The UN side is `indicators/49`, an opaque
 * numeric id. Nothing in the code establishes what indicator 49 measures — only the
 * fetcher's NAME and its LABEL say population, and both are exactly the evidence the
 * discipline excludes. A relationship declared on that basis would rest on a string
 * somebody typed, and the whole point of naming a latent is that the claim can be checked.
 *
 * WHAT WOULD SETTLE IT is one external lookup: confirm indicator 49 in the UN data
 * portal's indicator list. If it is total population, this becomes the first genuine
 * cross-publisher relationship in the system and belongs in the manifest. That check is
 * cheap and is not a code read, so it is left for the operator rather than guessed at
 * here. Until then the channel is declared with units that say exactly what is known and
 * no more, and it carries no finding.
 * ═══════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

var FACTORY = require('./factory.js');

var HOUR = 3600000;
var DAY = 24 * HOUR;
var YEAR = 365 * DAY;

var CHANNELS = [
  /* MEASURED DEMOGRAPHIC QUANTITIES, both from self-describing World Bank indicators. */
  { key: 'populationTotal', name: 'World Bank Population',   recordedField: 'v',  field: 'value',    source: 'World Bank SP.POP.TOTL, USA',            cadenceMs: YEAR, units: 'people',              q: 0.005, r: 0.04 },
  { key: 'fertilityRate',   name: 'World Bank Fertility',    recordedField: 'v',  field: 'value',    source: 'World Bank SP.DYN.TFRT.IN, USA',         cadenceMs: YEAR, units: 'births per woman',    q: 0.01,  r: 0.06 },

  /* AN UNIDENTIFIED UN INDICATOR. Location 840 is the USA and the value is on a
     thousands scale, but which statistic `indicators/49` is cannot be established from
     the code. Units say what is known; no finding rests on it. Key-gated. */
  { key: 'unIndicator49',   name: 'UN Population',           recordedField: 'v',  field: 'value',    source: 'UN data portal, indicator 49, location 840 (key-gated; indicator identity unverified)', cadenceMs: YEAR, units: 'thousands, statistic unverified', q: 0.01, r: 0.15 },

  /* NEWS RECENCY COUNTS across ten demographic, health and migration feeds. */
  { key: 'unfpa',           name: 'UNFPA',                   recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, UNFPA',               cadenceMs: DAY,  units: 'articles/7d',         q: 0.06, r: 0.25 },
  { key: 'cdcNchs',         name: 'CDC NCHS',                recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, CDC NCHS',            cadenceMs: DAY,  units: 'articles/7d',         q: 0.06, r: 0.25 },
  { key: 'whoGho',          name: 'WHO GHO',                 recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, WHO Global Health Observatory', cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },
  { key: 'unhcr',           name: 'UNHCR Displacement',      recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, UNHCR displacement',  cadenceMs: DAY,  units: 'articles/7d',         q: 0.06, r: 0.25 },
  { key: 'iom',             name: 'IOM Migration',           recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, IOM migration',       cadenceMs: DAY,  units: 'articles/7d',         q: 0.06, r: 0.25 },
  { key: 'ihme',            name: 'IHME Population Health',  recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, IHME',                cadenceMs: DAY,  units: 'articles/7d',         q: 0.06, r: 0.25 },
  { key: 'guttmacher',      name: 'Guttmacher Institute',    recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Guttmacher Institute', cadenceMs: DAY, units: 'articles/7d',         q: 0.06, r: 0.25 },
  { key: 'censusBureau',    name: 'Census Bureau',           recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Census Bureau',       cadenceMs: DAY,  units: 'articles/7d',         q: 0.06, r: 0.25 },
  { key: 'owid',            name: 'Our World in Data Pop',   recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Our World in Data',   cadenceMs: DAY,  units: 'articles/7d',         q: 0.06, r: 0.25 },
  { key: 'populationMatters', name: 'Population Matters',    recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Population Matters',  cadenceMs: DAY,  units: 'articles/7d',         q: 0.06, r: 0.25 },

  /* FEDERAL REGISTER DOCUMENT COUNTS. */
  { key: 'fedRegCensus',    name: 'Fed Reg Census',          recordedField: 'v',  field: 'value',    source: 'federalregister.gov, Census Bureau, 30d', cadenceMs: DAY, units: 'documents in 30d',    q: 0.04, r: 0.18 },
  { key: 'fedRegSsa',       name: 'Fed Reg SSA',             recordedField: 'v',  field: 'value',    source: 'federalregister.gov, SSA, 30d',          cadenceMs: DAY,  units: 'documents in 30d',    q: 0.04, r: 0.18 }
];

var SIGMA = 2.0;   // [mark: prior]

/**
 * TWO FINDINGS, on the two self-describing World Bank indicators. Both are annual and
 * will usually abstain.
 *
 * The UN channel carries none: a finding requires knowing what a number measures, and
 * indicator 49's identity is unverified. Omitted rather than declared with an uncertain
 * meaning — the same rule that omits a finding when direction is uncertain.
 *
 * Population total and fertility rate are kept separate. They are related in demography
 * and that is not the question: a joint finding would assert they move together on this
 * horizon, and a population total is a stock that fertility feeds over decades.
 */
var FINDINGS = [
  { id: 'POPULATION_TOTAL_DEPARTURE', requires: ['populationTotal'],
    basis: 'US total population departing its own baseline by >=2sd; annual, direction not interpreted',
    test: function (v, s, d) { return d.populationTotal && Math.abs(d.populationTotal.z) >= SIGMA; } },

  { id: 'FERTILITY_RATE_DEPARTURE', requires: ['fertilityRate'],
    basis: 'US total fertility rate, births per woman, departing its own baseline; annual, direction not interpreted',
    test: function (v, s, d) { return d.fertilityRate && Math.abs(d.fertilityRate.z) >= SIGMA; } }
];

module.exports = FACTORY.createBinder({
  domain: 'population',
  version: 'brain-v2/0.1.0-population',
  levelsPerSensor: 3,
  sigma: SIGMA,
  channels: CHANNELS,
  findings: FINDINGS,
  /* ZERO — but refused on PROVENANCE, not plausibility. See the header: the UN side is an
     opaque numeric indicator id whose meaning rests on a label. One external lookup would
     settle it. */
  relationships: [],
  efferent: null   // R7
});
