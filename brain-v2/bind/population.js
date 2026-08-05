/**
 * brain-v2/bind/population.js — declaration only. No fixture exists; MANIFEST-ONLY.
 *
 * Fifteen channels, from the exact `population: buildDomain('population', [...])` list in
 * handlers/domain-snapshot.js. Every numeric meaning was read out of its fetcher.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * THE FIRST CROSS-PUBLISHER RELATIONSHIP IN THE SYSTEM, AND WHAT IT COST TO EARN IT.
 *
 * Two channels estimate one quantity from two organisations:
 *
 *   World Bank Population   api.worldbank.org/v2/country/USA/indicator/SP.POP.TOTL
 *   UN Population           population.un.org/.../indicators/49/locations/840
 *
 * Batch 6 declared no relationship between them, and was right to. The World Bank side is
 * self-describing — SP.POP.TOTL is in the URL — while the UN side was `indicators/49`, an
 * opaque id whose meaning rested on the fetcher's name and label. Declaring a latent on
 * that basis would have meant trusting a string somebody typed.
 *
 * THE TITLE ALONE WAS NOT ENOUGH EITHER. Indicator 49 is "Total population by sex", and
 * that is exactly why the old fetcher could not be trusted: it requested `pageSize=1` and
 * took `data.data[0]`, so the row it read could have been male-only, the wrong year, or a
 * projection variant, chosen by whatever the server ordered first. A relationship asserts
 * the two channels observe ONE latent — had the selection been male-only, divergence
 * would have reported a permanent ~50% gap as a disagreement between publishers.
 *
 * `fetchUNPopulation` now requests a full page over a ROLLING completed-year window and
 * selects on the portal's DOCUMENTED FIELDS: indicatorId 49, locationId 840, sex "Both
 * sexes" (sexId 3), the "Median" variant (variantId 4), and the latest year in `timeLabel`
 * at or before the window end. It refuses outright when the observation is absent or
 * ambiguous rather than falling back to position, and it emits a source identity built
 * from the accepted row's own fields — indicator, location, year, sex, its actual variant,
 * plus sourceId, revision and estimateType when present — so a new year or a new WPP
 * revision reads as a new observation and a re-poll does not.
 *
 * Those field names and vocabularies are not assumptions. They were read from the portal's
 * OpenAPI MainDataSetFullDto and its `metadata/sexes/49`, `metadata/variants/49` and
 * `Indicators/49` endpoints, which answer without a key. The same read is what corrected
 * the unit below from thousands to persons.
 *
 * `test/un-population-selector.js` proves the selector ignores array order, with decoy
 * rows placed first, and refuses a row whose `category` says "Total" but whose `sex` does
 * not — the exact row an earlier all-string token scan would have accepted.
 *
 * Only then is the relationship declared, on the latent `usa_total_population`.
 * ═══════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

var DIV = require('../core/divergence.js');
var FACTORY = require('./factory.js');

var HOUR = 3600000;
var DAY = 24 * HOUR;
var YEAR = 365 * DAY;

var CHANNELS = [
  /* MEASURED DEMOGRAPHIC QUANTITIES, both from self-describing World Bank indicators. */
  { key: 'populationTotal', name: 'World Bank Population',   recordedField: 'v',  field: 'value',    source: 'World Bank SP.POP.TOTL, USA',            cadenceMs: YEAR, units: 'people',              q: 0.005, r: 0.04 },
  { key: 'fertilityRate',   name: 'World Bank Fertility',    recordedField: 'v',  field: 'value',    source: 'World Bank SP.DYN.TFRT.IN, USA',         cadenceMs: YEAR, units: 'births per woman',    q: 0.01,  r: 0.06 },

  /* THE UN TOTAL, verified against the portal's own published metadata: indicator 49 is
     "Total population by sex", and the fetcher selects the row whose documented fields say
     indicator 49, location 840, sex "Both sexes" (sexId 3) and the "Median" variant
     (variantId 4), for the latest completed year, refusing when the observation is
     ambiguous. UNITS ARE PERSONS: api/v1/Indicators/49 gives unitShortLabel "persons" and
     unitScaling 1, so a US reading is ~342000000. Key-gated. */
  { key: 'unPopulation',    name: 'UN Population',           recordedField: 'v',  field: 'value',    source: 'UN data portal indicator 49, location 840, both sexes, Median variant, persons (key-gated)', cadenceMs: YEAR, units: 'people', q: 0.005, r: 0.06 },

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

/**
 * ONE DECLARED RELATIONSHIP. Two organisations, one quantity: the total number of people
 * in the United States. Same statistic, same geography, same annual horizon, and both
 * sides now verified — the World Bank by its self-describing indicator code, the UN by a
 * selector that proves which row it read.
 *
 * BOTH SIDES ARE IN PERSONS. An earlier version of this file said the UN reported
 * thousands and leaned on divergence standardising the scale away. The unit was wrong:
 * indicator 49 carries unitScaling 1 and unitShortLabel "persons". The standardisation
 * point still holds — `divergence.js` compares each channel against its OWN baseline, so
 * the gap statistic is unit-free — but it is no longer doing any work here, and a
 * relationship should not rest on a claim about units that was never checked.
 *
 * A sustained gap here means one publisher revised or one feed went stale — a data
 * problem worth knowing about, which is exactly what a declared relationship is for.
 */
var REL = [
  DIV.relate('populationTotal', 'unPopulation', 'usa_total_population', 'agree',
    'World Bank SP.POP.TOTL and UN Data Portal indicator 49 (both sexes, Median variant) both estimate the total resident population of the United States, annually, in persons. A sustained divergence indicates a revision or a stale feed rather than a change in population.')
];

var SIGMA = 2.0;   // [mark: prior]

/**
 * TWO FINDINGS, on the two self-describing World Bank indicators. Both are annual and
 * will usually abstain.
 *
 * The UN channel carries NO FINDING OF ITS OWN, and that is deliberate now rather than
 * forced. It measures the same quantity as the World Bank channel, so a second
 * `POPULATION_TOTAL_DEPARTURE` would fire twice on one event and be reported as two
 * findings. The relationship is where the second source earns its place: it lets the two
 * be compared, which is more than either could say alone.
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
  relationships: REL,
  efferent: null   // R7
});
