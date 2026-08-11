/**
 * brain-v2/bind/education.js — declaration only. No fixture exists; MANIFEST-ONLY.
 *
 * Ten channels, from the exact `education: buildDomain('education', [...])` list in
 * handlers/domain-snapshot.js. Every numeric meaning was read out of its fetcher.
 *
 * ZERO RELATIONSHIPS. The two World Bank channels are the candidate and they measure
 * different things:
 *
 *   World Bank Education   education expenditure, % of GDP — what is SPENT
 *   World Bank Tertiary    gross tertiary enrolment ratio, % — who is ENROLLED
 *
 * An input and an outcome. They share a publisher, a unit symbol and an annual horizon,
 * and a gap between them is the interesting thing about an education system rather than a
 * fault in an instrument: spending can rise while enrolment falls, and that is a finding
 * about policy, not a sensor disagreement. `%` is not a unit in the sense a relationship
 * needs — a percentage of GDP and a percentage of a cohort are different quantities
 * wearing the same symbol.
 *
 * OpenAlex Institutions is also declared here — the snapshot tracks it under education —
 * and counts indexed scholarly works. It is a publication count, so it neither relates to
 * anything nor carries a finding.
 */

'use strict';

var FACTORY = require('./factory.js');
var DIAGNOSES = require('./diagnosis-registry.js');

var HOUR = 3600000;
var DAY = 24 * HOUR;
var YEAR = 365 * DAY;

var CHANNELS = [
  /* MEASURED QUANTITIES. An input and an outcome, both annual, both written as a
     percentage OF DIFFERENT DENOMINATORS. */
  { key: 'eduSpend',     name: 'World Bank Education',  recordedField: 'v',  field: 'value',    source: 'World Bank, education expenditure',      cadenceMs: YEAR, units: '% of GDP',                q: 0.01, r: 0.10 },
  { key: 'tertiaryEnrol', name: 'World Bank Tertiary',  recordedField: 'v',  field: 'value',    source: 'World Bank, gross tertiary enrolment',   cadenceMs: YEAR, units: '% gross enrolment ratio', q: 0.01, r: 0.10 },

  /* A PUBLICATION COUNT. Indexed scholarly works from top institutions. */
  { key: 'openAlex',     name: 'OpenAlex Institutions', recordedField: 'v',  field: 'value',    source: 'OpenAlex, works from top institutions',  cadenceMs: DAY,  units: 'indexed works',           q: 0.02, r: 0.15 },

  /* NEWS RECENCY COUNTS across five education feeds. */
  { key: 'edGovNews',    name: 'ED.gov News',           recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Department of Education', cadenceMs: DAY, units: 'articles/7d',          q: 0.06, r: 0.25 },
  { key: 'ncesNews',     name: 'NCES News',             recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, NCES',                cadenceMs: DAY,  units: 'articles/7d',             q: 0.06, r: 0.25 },
  { key: 'edWeek',       name: 'EdWeek News',           recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Education Week',      cadenceMs: DAY,  units: 'articles/7d',             q: 0.06, r: 0.25 },
  { key: 'iesNews',      name: 'IES News',              recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, IES',                 cadenceMs: DAY,  units: 'articles/7d',             q: 0.06, r: 0.25 },
  { key: 'chronicle',    name: 'Chronicle of Higher Ed', recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Chronicle of Higher Education', cadenceMs: DAY, units: 'articles/7d',   q: 0.06, r: 0.25 },

  /* FEDERAL REGISTER DOCUMENT COUNTS. */
  { key: 'fedRegEdu',    name: 'Fed Reg Education',     recordedField: 'v',  field: 'value',    source: 'federalregister.gov, Education, 30d',    cadenceMs: DAY,  units: 'documents in 30d',        q: 0.04, r: 0.18 },
  { key: 'fedRegNsf',    name: 'Fed Reg NSF',           recordedField: 'v',  field: 'value',    source: 'federalregister.gov, NSF, 30d',          cadenceMs: DAY,  units: 'documents in 30d',        q: 0.04, r: 0.18 }
];

var SIGMA = 2.0;   // [mark: prior]

/**
 * TWO FINDINGS, one per measured quantity, kept separate for the same reason they are not
 * related: spending and enrolment are an input and an outcome, and a joint finding would
 * assert they move together.
 *
 * Both are annual and will usually abstain. That is a true statement about how fast the
 * World Bank publishes, not a gap to be filled by promoting one of the five news counts
 * or the works index — every one of those measures publishing.
 */
/**
 * DIAGNOSES — declared as data in bind/diagnosis-registry.js, interpreted by
 * bind/diagnosis-forms.js. These 2 were this domain's inline `test:` functions until the
 * registry migration; the entries were generated from them and the equivalence is proved
 * in brain-v2/test/diagnosis-registry.js against the predicates as they were at ea5923ba.
 *
 * The registry is keyed (domain, id), so reading it by domain here is the whole coupling.
 */
var FINDINGS = DIAGNOSES.findingsFor('education');

module.exports = FACTORY.createBinder({
  domain: 'education',
  version: 'brain-v2/0.1.0-education',
  levelsPerSensor: 3,
  sigma: SIGMA,
  channels: CHANNELS,
  findings: FINDINGS,
  /* ZERO. Spending and enrolment are an input and an outcome; a percentage of GDP and a
     percentage of a cohort are different quantities wearing the same symbol. */
  relationships: [],
  efferent: null   // R7
});
