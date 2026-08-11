/**
 * brain-v2/bind/communication.js — declaration only. No fixture exists; MANIFEST-ONLY.
 *
 * Eleven channels, from the exact `communication: buildDomain('communication', [...])`
 * list in handlers/domain-snapshot.js. Every numeric meaning was read out of its fetcher.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * ZERO RELATIONSHIPS, AND THIS DOMAIN IS ALMOST ENTIRELY MADE OF THE THING ITS OWN
 * SUBJECT IS ABOUT.
 *
 * TEN OF ELEVEN CHANNELS COUNT PUBLISHED ARTEFACTS. A BBC feed's item count and seven
 * RSS keyword queries make eight article and feed counts, across media-industry,
 * press-freedom and fact-checking sources; two Federal Register document counts bring the
 * total to ten. A domain whose subject is communication, instrumented by counting
 * communications.
 *
 * That makes two pairs look relatable and neither is. Reporters Without Borders and CPJ
 * Press Freedom both cover press freedom, and a relationship would read as two watchdogs
 * observing one latent — but what the numbers hold is two rates of publication over
 * different editorial agendas, so a gap between them measures which organisation was
 * publishing that week. The same applies to Snopes, Poynter and Nieman Lab.
 *
 * The one non-publication measurement here is the share of individuals using the
 * internet, and it is annual. So this domain carries one finding, and that is the honest
 * count rather than a shortfall to be padded.
 * ═══════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

var FACTORY = require('./factory.js');
var DIAGNOSES = require('./diagnosis-registry.js');

var HOUR = 3600000;
var DAY = 24 * HOUR;
var YEAR = 365 * DAY;

var CHANNELS = [
  /* THE ONE MEASURED QUANTITY. Share of population using the internet, annual. */
  { key: 'internetUsers', name: 'World Bank Internet Users',   recordedField: 'v',  field: 'value',    source: 'World Bank, individuals using the internet', cadenceMs: YEAR, units: '% of population',  q: 0.01, r: 0.10 },

  /* A FEED ITEM COUNT. Items in the BBC World feed — a count of what was published. */
  { key: 'bbcItems',      name: 'BBC World News',              recordedField: 'v',  field: 'value',    source: 'BBC World feed, item count',                cadenceMs: HOUR, units: 'feed items',       q: 0.05, r: 0.20 },

  /* NEWS RECENCY COUNTS. Seven RSS keyword queries across media, press-freedom and
     fact-checking sources. */
  { key: 'rssMedia',      name: 'RSS Media',                   recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, media industry',         cadenceMs: DAY,  units: 'articles/7d',      q: 0.06, r: 0.25 },
  { key: 'rsf',           name: 'Reporters Without Borders',   recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, RSF',                    cadenceMs: DAY,  units: 'articles/7d',      q: 0.06, r: 0.25 },
  { key: 'cpj',           name: 'CPJ Press Freedom',           recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, CPJ',                    cadenceMs: DAY,  units: 'articles/7d',      q: 0.06, r: 0.25 },
  { key: 'snopes',        name: 'Snopes Fact Checks',          recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Snopes',                 cadenceMs: DAY,  units: 'articles/7d',      q: 0.06, r: 0.25 },
  { key: 'poynter',       name: 'Poynter Media News',          recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Poynter',                cadenceMs: DAY,  units: 'articles/7d',      q: 0.06, r: 0.25 },
  { key: 'niemanLab',     name: 'Nieman Lab',                  recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Nieman Lab',             cadenceMs: DAY,  units: 'articles/7d',      q: 0.06, r: 0.25 },
  { key: 'cisaAdvisories', name: 'CISA Advisories',            recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, CISA advisories',        cadenceMs: DAY,  units: 'articles/7d',      q: 0.06, r: 0.25 },

  /* FEDERAL REGISTER DOCUMENT COUNTS. */
  { key: 'fedRegFcc',     name: 'Fed Reg FCC',                 recordedField: 'v',  field: 'value',    source: 'federalregister.gov, FCC, 30d',             cadenceMs: DAY,  units: 'documents in 30d', q: 0.04, r: 0.18 },
  { key: 'fedRegFtc',     name: 'Fed Reg FTC',                 recordedField: 'v',  field: 'value',    source: 'federalregister.gov, FTC, 30d',             cadenceMs: DAY,  units: 'documents in 30d', q: 0.04, r: 0.18 }
];

var SIGMA = 2.0;   // [mark: prior]

/**
 * ONE FINDING. Ten of the eleven channels count published artefacts — eight article and
 * feed counts plus two Federal Register document counts; the eleventh measures what share
 * of people are online.
 *
 * A finding on any of the ten would fire when a newsroom had a busy week and be reported
 * as a fact about communication — which in this domain is especially misleading, because
 * a rise in press-freedom coverage plausibly accompanies both an improving and a
 * deteriorating situation, and the count cannot tell them apart. Omitted rather than
 * declared with an uncertain direction.
 */
/**
 * DIAGNOSES — declared as data in bind/diagnosis-registry.js, interpreted by
 * bind/diagnosis-forms.js. These 1 were this domain's inline `test:` functions until the
 * registry migration; the entries were generated from them and the equivalence is proved
 * in brain-v2/test/diagnosis-registry.js against the predicates as they were at ea5923ba.
 *
 * The registry is keyed (domain, id), so reading it by domain here is the whole coupling.
 */
var FINDINGS = DIAGNOSES.findingsFor('communication');

module.exports = FACTORY.createBinder({
  domain: 'communication',
  version: 'brain-v2/0.1.0-communication',
  levelsPerSensor: 3,
  sigma: SIGMA,
  channels: CHANNELS,
  findings: FINDINGS,
  /* ZERO. Eight of eleven channels count articles or feed items; relating two of them
     would compare two rates of publication over different editorial agendas. */
  relationships: [],
  efferent: null   // R7
});
