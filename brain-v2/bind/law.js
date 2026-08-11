/**
 * brain-v2/bind/law.js — declaration only. No fixture exists; MANIFEST-ONLY.
 *
 * Fifteen channels, from the exact `law: buildDomain('law', [...])` list in
 * handlers/domain-snapshot.js. Every numeric meaning was read out of its fetcher.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * THIS DOMAIN CANNOT SEE ITSELF, AND THE MANIFEST SAYS SO.
 *
 * Fourteen of the fifteen channels count documents. Eight are RSS keyword queries —
 * CourtListener, PACER, DOJ press releases, SEC and CFPB enforcement, federal caseload,
 * AFCARS, Supreme Court opinions. Two are direct document counts: Federal Register recent
 * rules, and Regulations.gov filings today. Three are Federal Register agency counts. One
 * is an OFAC keyword-match count.
 *
 * Every one of those is a count of published legal artefacts. Case volume, docket
 * activity, enforcement actions and opinions are all real things, and what these channels
 * hold is the RATE AT WHICH DOCUMENTS ABOUT THEM APPEAR IN A FEED. A finding built on any
 * of them would fire when a court clerk had a busy week or a press office cleared a
 * backlog, and would be reported as a fact about law.
 *
 * So the one finding here is on CISA KEV, and it is about software vulnerabilities. That
 * is the honest shape of what this domain can currently measure, and stating it plainly
 * is more useful than a finding that would look like legal insight and not be one.
 *
 * ZERO RELATIONSHIPS. The enforcement feeds — DOJ, SEC, CFPB — look like three agencies
 * observing one latent called enforcement activity. They are three publication rates over
 * three jurisdictions with different remits and release schedules, so a gap between them
 * measures which agency published more that week.
 * ═══════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

var FACTORY = require('./factory.js');
var DIAGNOSES = require('./diagnosis-registry.js');

var HOUR = 3600000;
var DAY = 24 * HOUR;

var CHANNELS = [
  /* THE ONE MEASURED QUANTITY, and it is not about law. Entries added to the CISA
     known-exploited feed in 30 days. */
  { key: 'cisaKev',        name: 'CISA KEV',                    recordedField: 'v',  field: 'value',    source: 'CISA Known Exploited Vulnerabilities feed, entries added in 30d', cadenceMs: DAY, units: 'new KEV entries in 30d', q: 0.03, r: 0.10 },

  /* DIRECT DOCUMENT COUNTS. */
  { key: 'fedRegRules',    name: 'Federal Register',            recordedField: 'v',  field: 'value',    source: 'federalregister.gov, RULE documents, total matched', cadenceMs: DAY, units: 'rule documents',   q: 0.04, r: 0.18 },
  { key: 'regulationsGov', name: 'Regulations.gov',             recordedField: 'v',  field: 'value',    source: 'regulations.gov, filings today',        cadenceMs: DAY,  units: 'filings today',          q: 0.05, r: 0.20 },

  /* A KEYWORD-MATCH COUNT. Sanction-related terms in an OFAC feed. */
  { key: 'ofac',           name: 'OFAC Recent Actions',         recordedField: 'v',  field: 'value',    source: 'OFAC feed keyword match',               cadenceMs: DAY,  units: 'keyword mentions',       q: 0.06, r: 0.25 },

  /* NEWS RECENCY COUNTS across eight court, enforcement and caseload feeds. */
  { key: 'courtListener',  name: 'CourtListener',               recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, CourtListener',      cadenceMs: DAY,  units: 'articles/7d',            q: 0.06, r: 0.25 },
  { key: 'pacerDockets',   name: 'PACER Docket Activity',       recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, PACER docket activity', cadenceMs: DAY, units: 'articles/7d',          q: 0.06, r: 0.25 },
  { key: 'dojPress',       name: 'DOJ Press Releases',          recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, DOJ press releases', cadenceMs: DAY,  units: 'articles/7d',            q: 0.06, r: 0.25 },
  { key: 'secEnforcement', name: 'SEC Enforcement Actions',     recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, SEC enforcement',    cadenceMs: DAY,  units: 'articles/7d',            q: 0.06, r: 0.25 },
  { key: 'cfpbEnforcement', name: 'CFPB Enforcement',           recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, CFPB enforcement',   cadenceMs: DAY,  units: 'articles/7d',            q: 0.06, r: 0.25 },
  { key: 'federalCaseload', name: 'U.S. Courts Federal Caseload', recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, federal caseload', cadenceMs: DAY,  units: 'articles/7d',            q: 0.06, r: 0.25 },
  { key: 'afcars',         name: 'HHS AFCARS Family Court',     recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, AFCARS family court', cadenceMs: DAY, units: 'articles/7d',            q: 0.06, r: 0.25 },
  { key: 'scotusOpinions', name: 'Supreme Court Opinions',      recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Supreme Court opinions', cadenceMs: DAY, units: 'articles/7d',         q: 0.06, r: 0.25 },

  /* FEDERAL REGISTER AGENCY DOCUMENT COUNTS. */
  { key: 'fedRegDoj',      name: 'Fed Reg DOJ',                 recordedField: 'v',  field: 'value',    source: 'federalregister.gov, Justice, 30d',     cadenceMs: DAY,  units: 'documents in 30d',       q: 0.04, r: 0.18 },
  { key: 'fedRegDea',      name: 'Fed Reg DEA',                 recordedField: 'v',  field: 'value',    source: 'federalregister.gov, DEA, 30d',         cadenceMs: DAY,  units: 'documents in 30d',       q: 0.04, r: 0.18 },
  { key: 'fedRegBop',      name: 'Fed Reg BOP',                 recordedField: 'v',  field: 'value',    source: 'federalregister.gov, Bureau of Prisons, 30d', cadenceMs: DAY, units: 'documents in 30d',  q: 0.04, r: 0.18 }
];

var SIGMA = 2.0;   // [mark: prior]

/**
 * ONE FINDING, on the one measured quantity — and it concerns software vulnerabilities
 * rather than law. Fourteen of fifteen channels count published legal artefacts, and a
 * finding on any of them would report publishing volume as a legal condition.
 *
 * Docket activity and caseload are the sharpest case. They sound like measures of how
 * much litigation is happening; what the channels hold is how many ARTICLES mentioned
 * dockets and caseloads that week.
 */
/**
 * DIAGNOSES — declared as data in bind/diagnosis-registry.js, interpreted by
 * bind/diagnosis-forms.js. These 1 were this domain's inline `test:` functions until the
 * registry migration; the entries were generated from them and the equivalence is proved
 * in brain-v2/test/diagnosis-registry.js against the predicates as they were at ea5923ba.
 *
 * The registry is keyed (domain, id), so reading it by domain here is the whole coupling.
 */
var FINDINGS = DIAGNOSES.findingsFor('law');

module.exports = FACTORY.createBinder({
  domain: 'law',
  version: 'brain-v2/0.1.0-law',
  levelsPerSensor: 3,
  sigma: SIGMA,
  channels: CHANNELS,
  findings: FINDINGS,
  /* ZERO. DOJ, SEC and CFPB are three publication rates over three remits, not three
     instruments on one latent. */
  relationships: [],
  efferent: null   // R7
});
