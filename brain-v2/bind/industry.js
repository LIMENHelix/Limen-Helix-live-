/**
 * brain-v2/bind/industry.js — declaration only. No fixture exists; MANIFEST-ONLY.
 *
 * Eleven channels, from the exact `industry: buildDomain('industry', [...])` list in
 * handlers/domain-snapshot.js. Every numeric meaning was read out of its fetcher.
 *
 * ZERO RELATIONSHIPS. Two rejections, and the second is the one worth stating.
 *
 * BLS Manufacturing PPI is a producer PRICE index for manufactured goods. World Bank
 * Manufacturing is manufacturing VALUE ADDED as a percentage of GDP. Both are "how
 * manufacturing is doing" in words; one is a price level and the other a share of output,
 * on a monthly and an annual schedule respectively.
 *
 * NHTSA Recalls and CPSC Recalls are the tempting pair — two recall feeds, and a
 * relationship between them would look like two agencies observing one latent called
 * "product safety". They are RSS keyword recency counts over different product classes:
 * vehicles at one agency, consumer goods at the other. Two things follow, and either
 * alone is disqualifying. The populations differ, so a gap between them measures which
 * kind of product had a bad month. And both count ARTICLES, so what a relationship would
 * actually be comparing is two rates of publication — a disagreement between them would
 * be a fact about newsrooms, not about recalls.
 */

'use strict';

var FACTORY = require('./factory.js');
var DIAGNOSES = require('./diagnosis-registry.js');

var HOUR = 3600000;
var DAY = 24 * HOUR;
var MONTH = 30 * DAY;
var YEAR = 365 * DAY;

var CHANNELS = [
  /* MEASURED ECONOMIC QUANTITIES. A price index and a share of output. */
  { key: 'mfgPpi',       name: 'BLS Manufacturing PPI', recordedField: 'v',  field: 'value',    source: 'BLS producer price index, manufacturing',  cadenceMs: MONTH, units: 'index points',            q: 0.02, r: 0.06 },
  { key: 'mfgValueAdd',  name: 'World Bank Manufacturing', recordedField: 'v', field: 'value',   source: 'World Bank, manufacturing value added',     cadenceMs: YEAR,  units: '% of GDP',                q: 0.01, r: 0.10 },

  /* NEWS RECENCY COUNTS across five safety and labour feeds. Measures of coverage. */
  { key: 'nhtsaRecalls', name: 'NHTSA Recalls',         recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, vehicle recalls',        cadenceMs: DAY,   units: 'articles/7d',             q: 0.06, r: 0.25 },
  { key: 'cpscRecalls',  name: 'CPSC Recalls',          recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, consumer product recalls', cadenceMs: DAY, units: 'articles/7d',             q: 0.06, r: 0.25 },
  { key: 'phmsa',        name: 'PHMSA Incidents',       recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, pipeline incidents',      cadenceMs: DAY,  units: 'articles/7d',             q: 0.06, r: 0.25 },
  { key: 'csb',          name: 'CSB Investigations',    recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, chemical safety board',   cadenceMs: DAY,  units: 'articles/7d',             q: 0.06, r: 0.25 },
  { key: 'uawStrikes',   name: 'UAW Strike Tracker',    recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, UAW strikes',            cadenceMs: DAY,  units: 'articles/7d',             q: 0.06, r: 0.25 },

  /* FEDERAL REGISTER DOCUMENT COUNTS across four agencies. */
  { key: 'fedRegOsha',   name: 'Fed Reg OSHA',          recordedField: 'v',  field: 'value',    source: 'federalregister.gov, OSHA, 30d',            cadenceMs: DAY,  units: 'documents in 30d',        q: 0.04, r: 0.18 },
  { key: 'fedRegMsha',   name: 'Fed Reg MSHA',          recordedField: 'v',  field: 'value',    source: 'federalregister.gov, MSHA, 30d',            cadenceMs: DAY,  units: 'documents in 30d',        q: 0.04, r: 0.18 },
  { key: 'fedRegBis',    name: 'Fed Reg BIS',           recordedField: 'v',  field: 'value',    source: 'federalregister.gov, BIS, 30d',             cadenceMs: DAY,  units: 'documents in 30d',        q: 0.04, r: 0.18 },
  { key: 'fedRegDol',    name: 'Fed Reg DOL',           recordedField: 'v',  field: 'value',    source: 'federalregister.gov, Labor, 30d',           cadenceMs: DAY,  units: 'documents in 30d',        q: 0.04, r: 0.18 }
];

var SIGMA = 2.0;   // [mark: prior]

/**
 * TWO FINDINGS, on the two channels that measure an economic quantity. The other nine
 * count articles or documents; a finding on any of them would fire when a feed published.
 *
 * Neither is combined with the other: a price index and a share of output departing
 * together would be worth knowing, but asserting they should is the relationship this
 * file's header declined to declare.
 */
/**
 * DIAGNOSES — declared as data in bind/diagnosis-registry.js, interpreted by
 * bind/diagnosis-forms.js. These 2 were this domain's inline `test:` functions until the
 * registry migration; the entries were generated from them and the equivalence is proved
 * in brain-v2/test/diagnosis-registry.js against the predicates as they were at ea5923ba.
 *
 * The registry is keyed (domain, id), so reading it by domain here is the whole coupling.
 */
var FINDINGS = DIAGNOSES.findingsFor('industry');

module.exports = FACTORY.createBinder({
  domain: 'industry',
  version: 'brain-v2/0.1.0-industry',
  levelsPerSensor: 3,
  sigma: SIGMA,
  channels: CHANNELS,
  findings: FINDINGS,
  /* ZERO. A price index against a share of output; and the two recall feeds count
     articles about different product classes. */
  relationships: [],
  efferent: null   // R7
});
