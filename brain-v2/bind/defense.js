/**
 * brain-v2/bind/defense.js — declaration only. No fixture exists; MANIFEST-ONLY.
 *
 * Fifteen channels, from the exact `defense: buildDomain('defense', [...])` list in
 * handlers/domain-snapshot.js. Every numeric meaning was read out of its fetcher.
 *
 * ZERO RELATIONSHIPS, and the tempting pair here is a state-media one.
 *
 * TASS and Xinhua are both state-affiliated outlets, and a relationship between them
 * would read as two instruments observing one latent — how two governments are talking
 * about defence. What the numbers hold is two article counts from two outlets with
 * different editorial cycles and different national agendas. A gap between them measures
 * which government was publishing more that week, which is a fact about press offices.
 *
 * The same disqualifies Defense News against Breaking Defense, and ISW against NATO News:
 * every one of those is a coverage count.
 *
 * The only channels here that measure something that happened are the two physical hazard
 * counts and the vulnerability flow, all three shared with other domains by the snapshot.
 * That is worth stating plainly: this domain's own subject matter — defence activity — is
 * visible to it only through coverage, and its findings therefore rest on weather,
 * seismic and vulnerability data rather than on anything military.
 */

'use strict';

var FACTORY = require('./factory.js');
var DIAGNOSES = require('./diagnosis-registry.js');

var HOUR = 3600000;
var DAY = 24 * HOUR;

var CHANNELS = [
  /* EVENT COUNTS AND A VULNERABILITY FLOW. The only measured quantities in this domain,
     and all three arrive from outside its own subject matter. */
  { key: 'nwsAlerts',      name: 'NOAA NWS Alerts',     recordedField: 'v',  field: 'value',    source: 'api.weather.gov active alerts',           cadenceMs: HOUR, units: 'active alerts',          q: 0.05, r: 0.15 },
  { key: 'earthquakes',    name: 'USGS Earthquakes',    recordedField: 'v',  field: 'value',    source: 'USGS feed, M4.5+ in 24h',                 cadenceMs: HOUR, units: 'quakes M4.5+ in 24h',    q: 0.05, r: 0.15 },
  { key: 'cisaKev',        name: 'CISA KEV',            recordedField: 'v',  field: 'value',    source: 'CISA Known Exploited Vulnerabilities feed, entries added in 30d', cadenceMs: DAY, units: 'new KEV entries in 30d', q: 0.03, r: 0.10 },

  /* A KEYWORD-MATCH COUNT. Sanction-related terms in an OFAC feed, not confirmed actions. */
  { key: 'ofac',           name: 'OFAC Recent Actions', recordedField: 'v',  field: 'value',    source: 'OFAC feed keyword match',                 cadenceMs: DAY,  units: 'keyword mentions',       q: 0.06, r: 0.25 },

  /* NEWS RECENCY COUNTS. Seven defence and state-media feeds. */
  { key: 'defenseNews',    name: 'Defense News',        recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Defense News',         cadenceMs: DAY,  units: 'articles/7d',            q: 0.06, r: 0.25 },
  { key: 'breakingDefense', name: 'Breaking Defense',   recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Breaking Defense',     cadenceMs: DAY,  units: 'articles/7d',            q: 0.06, r: 0.25 },
  { key: 'isw',            name: 'ISW Daily Updates',   recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Institute for the Study of War', cadenceMs: DAY, units: 'articles/7d',   q: 0.06, r: 0.25 },
  { key: 'nato',           name: 'NATO News',           recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, NATO',                 cadenceMs: DAY,  units: 'articles/7d',            q: 0.06, r: 0.25 },
  { key: 'sipri',          name: 'SIPRI Arms Trade',    recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, SIPRI arms trade',     cadenceMs: DAY,  units: 'articles/7d',            q: 0.06, r: 0.25 },
  { key: 'tass',           name: 'TASS (Russia)',       recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, TASS state media',     cadenceMs: DAY,  units: 'articles/7d',            q: 0.06, r: 0.25 },
  { key: 'xinhua',         name: 'Xinhua (China)',      recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Xinhua state media',   cadenceMs: DAY,  units: 'articles/7d',            q: 0.06, r: 0.25 },
  { key: 'cisaAdvisories', name: 'CISA Advisories',     recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, CISA advisories',      cadenceMs: DAY,  units: 'articles/7d',            q: 0.06, r: 0.25 },

  /* FEDERAL REGISTER DOCUMENT COUNTS. */
  { key: 'fedRegDod',      name: 'Fed Reg DoD',         recordedField: 'v',  field: 'value',    source: 'federalregister.gov, Defense, 30d',       cadenceMs: DAY,  units: 'documents in 30d',       q: 0.04, r: 0.18 },
  { key: 'fedRegState',    name: 'Fed Reg State',       recordedField: 'v',  field: 'value',    source: 'federalregister.gov, State, 30d',         cadenceMs: DAY,  units: 'documents in 30d',       q: 0.04, r: 0.18 },
  { key: 'fedRegDhs',      name: 'Fed Reg DHS',         recordedField: 'v',  field: 'value',    source: 'federalregister.gov, DHS, 30d',           cadenceMs: DAY,  units: 'documents in 30d',       q: 0.04, r: 0.18 }
];

var SIGMA = 2.0;   // [mark: prior]

/**
 * FINDINGS on the three measured channels only. None of them is about defence, which is
 * the honest shape of what this domain can currently see: seven of its fifteen channels
 * are coverage counts of defence, and coverage is not the thing.
 *
 * Nothing on the OFAC keyword count either — it counts sanction-related TERMS, so a
 * finding would fire on a feed's vocabulary and be reported as a defence signal.
 */
/**
 * DIAGNOSES — declared as data in bind/diagnosis-registry.js, interpreted by
 * bind/diagnosis-forms.js. These 4 were this domain's inline `test:` functions until the
 * registry migration; the entries were generated from them and the equivalence is proved
 * in brain-v2/test/diagnosis-registry.js against the predicates as they were at ea5923ba.
 *
 * The registry is keyed (domain, id), so reading it by domain here is the whole coupling.
 */
var FINDINGS = DIAGNOSES.findingsFor('defense');

module.exports = FACTORY.createBinder({
  domain: 'defense',
  version: 'brain-v2/0.1.0-defense',
  levelsPerSensor: 3,
  sigma: SIGMA,
  channels: CHANNELS,
  findings: FINDINGS,
  /* ZERO. TASS and Xinhua are two article counts from two press offices; the same
     disqualifies every other pairing here. */
  relationships: [],
  efferent: null   // R7
});
