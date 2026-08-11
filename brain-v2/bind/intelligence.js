/**
 * brain-v2/bind/intelligence.js — declaration only. No fixture exists; MANIFEST-ONLY.
 *
 * Fifteen channels, from the exact `intelligence: buildDomain('intelligence', [...])`
 * list in handlers/domain-snapshot.js. Every numeric meaning was read out of its fetcher.
 *
 * ZERO RELATIONSHIPS, ONE FINDING, AND THE FINDING IS NOT ABOUT INTELLIGENCE.
 *
 * Ten channels are RSS keyword queries across institutional advisories (CISA, NSA, FBI,
 * DNI), trade press (CyberScoop, The Record), analysis (Lawfare) and open-source
 * investigation (Bellingcat, The Intercept). Three are Federal Register agency document
 * counts. One is an OFAC keyword-match count. The remaining channel — entries added to
 * the CISA known-exploited feed in 30 days — is the only measured quantity, and it
 * concerns software vulnerabilities.
 *
 * The rejection worth recording is the advisory cluster. CISA Advisories, NSA
 * Cybersecurity Advisories and FBI Cyber Division look like three agencies observing one
 * latent called cyber threat activity, and it is a genuinely tempting reading: they
 * cover overlapping incidents and often publish about the same campaign. What the
 * channels hold is three article counts from three press operations with different
 * classification rules, review cycles and disclosure policies. A gap between them
 * measures which agency was cleared to publish that week — which, in this domain
 * especially, is a fact about secrecy rather than about threat.
 *
 * The same disqualifies Bellingcat against The Intercept, and CyberScoop against The
 * Record.
 */

'use strict';

var FACTORY = require('./factory.js');
var DIAGNOSES = require('./diagnosis-registry.js');

var HOUR = 3600000;
var DAY = 24 * HOUR;

var CHANNELS = [
  /* THE ONE MEASURED QUANTITY. */
  { key: 'cisaKev',        name: 'CISA KEV',                      recordedField: 'v',  field: 'value',    source: 'CISA Known Exploited Vulnerabilities feed, entries added in 30d', cadenceMs: DAY, units: 'new KEV entries in 30d', q: 0.03, r: 0.10 },

  /* A KEYWORD-MATCH COUNT. */
  { key: 'ofac',           name: 'OFAC Recent Actions',           recordedField: 'v',  field: 'value',    source: 'OFAC feed keyword match',              cadenceMs: DAY,  units: 'keyword mentions',       q: 0.06, r: 0.25 },

  /* NEWS RECENCY COUNTS. Four institutional advisory feeds. */
  { key: 'cisaAdvisories', name: 'CISA Advisories',               recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, CISA advisories',   cadenceMs: DAY,  units: 'articles/7d',            q: 0.06, r: 0.25 },
  { key: 'nsaAdvisories',  name: 'NSA Cybersecurity Advisories',  recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, NSA advisories',    cadenceMs: DAY,  units: 'articles/7d',            q: 0.06, r: 0.25 },
  { key: 'fbiCyber',       name: 'FBI Cyber Division',            recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, FBI cyber',         cadenceMs: DAY,  units: 'articles/7d',            q: 0.06, r: 0.25 },
  { key: 'dniThreat',      name: 'DNI Annual Threat',             recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, DNI threat assessment', cadenceMs: DAY, units: 'articles/7d',         q: 0.06, r: 0.25 },

  /* Trade press, analysis and open-source investigation. */
  { key: 'rssIntel',       name: 'RSS Intel Signals',             recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, intelligence',      cadenceMs: DAY,  units: 'articles/7d',            q: 0.06, r: 0.25 },
  { key: 'cyberScoop',     name: 'CyberScoop News',               recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, CyberScoop',        cadenceMs: DAY,  units: 'articles/7d',            q: 0.06, r: 0.25 },
  { key: 'theRecord',      name: 'The Record',                    recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, The Record',        cadenceMs: DAY,  units: 'articles/7d',            q: 0.06, r: 0.25 },
  { key: 'lawfare',        name: 'Lawfare NatSec',                recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Lawfare',           cadenceMs: DAY,  units: 'articles/7d',            q: 0.06, r: 0.25 },
  { key: 'bellingcat',     name: 'Bellingcat OSINT',              recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Bellingcat',        cadenceMs: DAY,  units: 'articles/7d',            q: 0.06, r: 0.25 },
  { key: 'intercept',      name: 'The Intercept NatSec',          recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, The Intercept',     cadenceMs: DAY,  units: 'articles/7d',            q: 0.06, r: 0.25 },

  /* FEDERAL REGISTER AGENCY DOCUMENT COUNTS. */
  { key: 'fedRegFbi',      name: 'Fed Reg FBI',                   recordedField: 'v',  field: 'value',    source: 'federalregister.gov, FBI, 30d',        cadenceMs: DAY,  units: 'documents in 30d',       q: 0.04, r: 0.18 },
  { key: 'fedRegCia',      name: 'Fed Reg CIA',                   recordedField: 'v',  field: 'value',    source: 'federalregister.gov, CIA, 30d',        cadenceMs: DAY,  units: 'documents in 30d',       q: 0.04, r: 0.18 },
  { key: 'fedRegNsa',      name: 'Fed Reg NSA',                   recordedField: 'v',  field: 'value',    source: 'federalregister.gov, NSA, 30d',        cadenceMs: DAY,  units: 'documents in 30d',       q: 0.04, r: 0.18 }
];

var SIGMA = 2.0;   // [mark: prior]

/**
 * ONE FINDING, on the vulnerability flow. Fourteen of fifteen channels count published
 * artefacts, and a finding on any of them would fire when an agency or a newsroom
 * published and be reported as an intelligence signal.
 *
 * That failure mode is worse here than elsewhere. Publication volume in this domain is
 * governed by classification and disclosure policy, so a quiet week may mean less
 * activity or more secrecy, and the count cannot tell them apart. Omitted rather than
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
var FINDINGS = DIAGNOSES.findingsFor('intelligence');

module.exports = FACTORY.createBinder({
  domain: 'intelligence',
  version: 'brain-v2/0.1.0-intelligence',
  levelsPerSensor: 3,
  sigma: SIGMA,
  channels: CHANNELS,
  findings: FINDINGS,
  /* ZERO. The three advisory feeds are three press operations with different
     classification rules; a gap between them measures who was cleared to publish. */
  relationships: [],
  efferent: null   // R7
});
