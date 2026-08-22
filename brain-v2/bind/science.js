/**
 * brain-v2/bind/science.js — declaration only. No fixture exists; MANIFEST-ONLY.
 *
 * TWO NAMES: the file is `science`, the domain key is `research`. Same split
 * bind/medicine.js documents — `lib/domain-names.js` owns the mapping and
 * bind/registry.js resolves through it, so `inspect('science')` and `inspect('research')`
 * return one descriptor, the binder is `bind/science.js` and a fixture would be filed as
 * `research-recorder.json`.
 *
 * Fifteen channels, from the exact `research: buildDomain('research', [...])` list.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * ZERO RELATIONSHIPS, AND ONE PAIR IS WORTH RECORDING BECAUSE IT IS SO NEARLY ONE.
 *
 *   arXiv All   cumulative count of ALL arXiv papers
 *   arXiv CS    cumulative count of arXiv COMPUTER SCIENCE papers
 *
 * Same publisher, same units, same horizon, same instrument — and still not a shared
 * latent, because one is a SUBSET of the other. They cannot disagree in the way a
 * relationship tests for: their ratio drifts with the CS share of submissions, so a
 * declared `agree` pair would report a divergence every time the field's composition
 * changed, which is a fact about arXiv rather than about a disagreement between
 * instruments. A subset and its superset are one measurement at two scopes.
 *
 * PubMed and arXiv All are both cumulative publication totals, and are also not a pair:
 * one indexes biomedical literature, the other preprints across all fields. Different
 * corpora, so a gap between them measures what scientists chose to publish where.
 * ═══════════════════════════════════════════════════════════════════════════════════
 *
 * THIS DOMAIN IS ALMOST ENTIRELY PUBLICATION COUNTS, which is what a research domain
 * built from public feeds can see. That leaves exactly one channel carrying a measured
 * quantity, and exactly one finding. Declaring more would mean building findings on
 * publishing volume, which fires when somebody publishes.
 */

'use strict';

var FACTORY = require('./factory.js');
var DIAGNOSES = require('./diagnosis-registry.js');

var HOUR = 3600000;
var DAY = 24 * HOUR;
var YEAR = 365 * DAY;

var CHANNELS = [
  /* THE ONE MEASURED QUANTITY. Annual, so it moves once a year — declared honestly at
     that cadence rather than at the rate we happen to poll it. */
  { key: 'rndIntensity', name: 'World Bank R&D',         recordedField: 'v',  field: 'value',    source: 'World Bank GB.XPD.RSDV.GD.ZS, USA',    cadenceMs: YEAR, units: '% of GDP, annual',    q: 0.01, r: 0.10 },

  /* CUMULATIVE PUBLICATION TOTALS. Real counts of documents indexed. */
  { key: 'pubmed',       name: 'PubMed',                 recordedField: 'v',  field: 'value',    source: 'PubMed search, cumulative result total', cadenceMs: DAY, units: 'cumulative articles', q: 0.02, r: 0.15 },
  { key: 'arxivAll',     name: 'arXiv All',              recordedField: 'v',  field: 'value',    source: 'arXiv, cumulative paper count',         cadenceMs: DAY, units: 'cumulative papers',   q: 0.02, r: 0.15 },
  { key: 'arxivCs',      name: 'arXiv CS',               recordedField: 'v',  field: 'value',    source: 'arXiv, cumulative CS paper count (a SUBSET of arXiv All)', cadenceMs: DAY, units: 'cumulative papers', q: 0.02, r: 0.15 },
  { key: 'openAlex',     name: 'OpenAlex Institutions',  recordedField: 'v',  field: 'value',    source: 'OpenAlex, works from top institutions',  cadenceMs: DAY, units: 'indexed works',       q: 0.02, r: 0.15 },

  /* NEWS RECENCY COUNTS. `recent7d`, because the raw count saturates at a full page. */
  { key: 'nsfAwards',    name: 'NSF Awards',             recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, NSF awards',          cadenceMs: DAY, units: 'articles/7d',         q: 0.06, r: 0.25 },
  { key: 'retractions',  name: 'Retraction Watch',       recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, retractions',         cadenceMs: DAY, units: 'articles/7d',         q: 0.06, r: 0.25 },
  { key: 'nihGrants',    name: 'NIH Grants',             recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, NIH awards',          cadenceMs: DAY, units: 'articles/7d',         q: 0.06, r: 0.25 },
  { key: 'naturePress',  name: 'Nature / Science Press', recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Nature/Science press', cadenceMs: DAY, units: 'articles/7d',        q: 0.06, r: 0.25 },

  /* FEDERAL REGISTER DOCUMENT COUNTS across six research-adjacent agencies. */
  { key: 'fedRegPto',    name: 'Fed Reg PTO',            recordedField: 'v',  field: 'value',    source: 'federalregister.gov, USPTO, 30d',        cadenceMs: DAY, units: 'documents in 30d',    q: 0.04, r: 0.18 },
  { key: 'fedRegNsf',    name: 'Fed Reg NSF',            recordedField: 'v',  field: 'value',    source: 'federalregister.gov, NSF, 30d',          cadenceMs: DAY, units: 'documents in 30d',    q: 0.04, r: 0.18 },
  { key: 'fedRegEdu',    name: 'Fed Reg Education',      recordedField: 'v',  field: 'value',    source: 'federalregister.gov, Education, 30d',    cadenceMs: DAY, units: 'documents in 30d',    q: 0.04, r: 0.18 },
  { key: 'fedRegNasa',   name: 'Fed Reg NASA',           recordedField: 'v',  field: 'value',    source: 'federalregister.gov, NASA, 30d',         cadenceMs: DAY, units: 'documents in 30d',    q: 0.04, r: 0.18 },
  { key: 'fedRegSi',     name: 'Fed Reg Smithsonian',    recordedField: 'v',  field: 'value',    source: 'federalregister.gov, Smithsonian, 30d',  cadenceMs: DAY, units: 'documents in 30d',    q: 0.04, r: 0.18 },
  { key: 'fedRegDoe',    name: 'Fed Reg DOE',            recordedField: 'v',  field: 'value',    source: 'federalregister.gov, DOE, 30d',          cadenceMs: DAY, units: 'documents in 30d',    q: 0.04, r: 0.18 }
];

var SIGMA = 2.0;   // [mark: prior]

/**
 * ONE FINDING, and that is the honest count for this domain.
 *
 * Fourteen of the fifteen channels count publications. A finding on any of them would
 * fire when journals index, agencies file or feeds publish, and would be reported as a
 * fact about research. R&D as a share of GDP is the only channel here that measures
 * something other than publishing.
 *
 * It is annual, so it will rarely have enough observations for a baseline and will
 * usually abstain. That is a true statement about what this domain can see from public
 * feeds, not a gap to be filled by promoting a publication count.
 *
 * No fused-state finding: the domain already reports its own dysregulation, and a finding
 * that re-tests it restates a number the cycle has already emitted.
 */
/**
 * DIAGNOSES — declared as data in bind/diagnosis-registry.js, interpreted by
 * bind/diagnosis-forms.js. These 1 were this domain's inline `test:` functions until the
 * registry migration; the entries were generated from them and the equivalence is proved
 * in brain-v2/test/diagnosis-registry.js against the predicates as they were at ea5923ba.
 *
 * The registry is keyed (domain, id), so reading it by domain here is the whole coupling.
 */
var FINDINGS = DIAGNOSES.findingsFor('research');

module.exports = FACTORY.createBinder({
  /* THE SNAPSHOT KEY, not the filename. */
  domain: 'research',
  version: 'brain-v2/0.1.0-science',
  levelsPerSensor: 3,
  sigma: SIGMA,
  channels: CHANNELS,
  findings: FINDINGS,
  /* ZERO. arXiv CS is a subset of arXiv All — one measurement at two scopes, not two
     instruments observing one latent. PubMed and arXiv index different corpora. */
  relationships: [],
  efferent: [{
    consumer: 'autofire-domain-bridge',
    command: 'generate_research_artifact',
    authority: 'publication_evidence_only'
  }]
});
