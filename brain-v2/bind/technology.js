/**
 * brain-v2/bind/technology.js — declaration only. No fixture exists; MANIFEST-ONLY.
 *
 * Ten channels, from the exact `buildDomain('technology', [...])` list in
 * handlers/domain-snapshot.js. Every numeric meaning was read out of its fetcher.
 *
 * ZERO DECLARED RELATIONSHIPS. The one pair that looks relatable is not:
 *
 *   CISA KEV          KEV entries ADDED in the last 30 days — vulnerabilities newly
 *                     observed being exploited in the wild
 *   NVD Recent CVEs   ALL CVEs PUBLISHED in the last 7 days
 *
 * BOTH ARE FLOWS. An earlier version of this header described the first as a running
 * total, on the assumption that the KEV channel carried the catalogue size. It does not:
 * `fetchCISAKEV()` walks the feed counting entries whose `dateAdded` falls inside a
 * 30-day cutoff and returns that count. The catalogue total is computed in the same
 * function and used only to build the human-readable label string, so it never reaches
 * this channel.
 *
 * The stale description survived review because it was internally consistent — the units,
 * the finding name and this paragraph all agreed with each other and all disagreed with
 * the fetcher. That is why `test/domains.js` now asserts against this file's TEXT as well
 * as its manifest: a wrong claim in a comment is what the next reader will believe.
 *
 * They still must not be related, for two reasons that survive the correction:
 *
 *   POPULATION  KEV counts only vulnerabilities observed being exploited — a small,
 *               deliberately curated subset. NVD counts every CVE published, exploited
 *               or not. One is a filtered view of a different question.
 *   HORIZON     30 days against 7. A monthly flow and a weekly flow do not share a
 *               baseline, and a declared pair would report the difference between two
 *               window lengths as a disagreement between instruments.
 *
 * Nothing else here pairs at all.
 */

'use strict';

var FACTORY = require('./factory.js');
var DIAGNOSES = require('./diagnosis-registry.js');

var HOUR = 3600000;
var DAY = 24 * HOUR;

/**
 * q/r are SET, not fitted [mark: prior]. A vulnerability-record count gets a lower r than
 * a news recency count, because a filed CVE is a less noisy read than an article about one.
 */
var CHANNELS = [
  // ── Vulnerability flows. Records of findings, not articles about them. ──
  { key: 'cisaKev',      name: 'CISA KEV',                   recordedField: 'v',  field: 'value',    source: 'CISA Known Exploited Vulnerabilities feed, entries added in 30d', cadenceMs: DAY, units: 'new KEV entries in 30d', q: 0.03, r: 0.10 },
  { key: 'nvdCves',      name: 'NVD Recent CVEs',            recordedField: 'v',  field: 'value',    source: 'NIST NVD, CVEs published in 7d',                 cadenceMs: DAY,  units: 'new CVEs in 7d',         q: 0.04, r: 0.12 },

  /* PUBLICATION AND DISCOURSE COUNTS. Real numbers, counts of documents and posts. */
  { key: 'patents',      name: 'USPTO Patents',              recordedField: 'v',  field: 'value',    source: 'USPTO patent applications search (key-gated)',   cadenceMs: DAY,  units: 'applications matched',   q: 0.04, r: 0.18 },
  { key: 'arxivCs',      name: 'arXiv CS',                   recordedField: 'v',  field: 'value',    source: 'arXiv, cumulative CS paper count',               cadenceMs: DAY,  units: 'cumulative papers',      q: 0.02, r: 0.15 },
  { key: 'hackerNews',   name: 'Hacker News',                recordedField: 'v',  field: 'value',    source: 'Hacker News top stories count',                  cadenceMs: HOUR, units: 'top stories',            q: 0.05, r: 0.22 },
  { key: 'krebs',        name: 'Krebs Security',             recordedField: 'r7', field: 'recent7d', source: 'RSS, Krebs on Security',                         cadenceMs: DAY,  units: 'articles/7d',            q: 0.06, r: 0.25 },
  { key: 'githubAdv',    name: 'GitHub Security Advisories', recordedField: 'r7', field: 'recent7d', source: 'RSS, GitHub security advisories',                cadenceMs: DAY,  units: 'articles/7d',            q: 0.06, r: 0.25 },

  /* FEDERAL REGISTER DOCUMENT COUNTS. Publication volume for three tech regulators. */
  { key: 'fedRegFcc',    name: 'Fed Reg FCC',                recordedField: 'v',  field: 'value',    source: 'federalregister.gov, FCC, 30d',                  cadenceMs: DAY,  units: 'documents in 30d',       q: 0.04, r: 0.18 },
  { key: 'fedRegNist',   name: 'Fed Reg NIST',               recordedField: 'v',  field: 'value',    source: 'federalregister.gov, NIST, 30d',                 cadenceMs: DAY,  units: 'documents in 30d',       q: 0.04, r: 0.18 },
  { key: 'fedRegFtc',    name: 'Fed Reg FTC',                recordedField: 'v',  field: 'value',    source: 'federalregister.gov, FTC, 30d',                  cadenceMs: DAY,  units: 'documents in 30d',       q: 0.04, r: 0.18 }
];

var SIGMA = 2.0;   // [mark: prior]

/**
 * FINDINGS. Neutrally named, and each says only that a specific channel departed its own
 * baseline — not what that departure means. A rise in newly published CVEs could be a
 * disclosure wave, a scanning campaign or a quiet week ending; naming the finding
 * `SECURITY_CRISIS` would assert a cause the number cannot support.
 *
 * Only the two vulnerability flows qualify. Patents, arXiv, Hacker News, the two RSS
 * feeds and the three Federal Register counts all measure publishing, and a finding on
 * publishing fires when somebody publishes.
 *
 * No fused-state finding. The domain already reports its own dysregulation from the fused
 * departure; a finding that re-tests `state.departure` restates a number the cycle has
 * already emitted, so it adds a second voice saying the same thing rather than evidence.
 */
/**
 * DIAGNOSES — declared as data in bind/diagnosis-registry.js, interpreted by
 * bind/diagnosis-forms.js. These 3 were this domain's inline `test:` functions until the
 * registry migration; the entries were generated from them and the equivalence is proved
 * in brain-v2/test/diagnosis-registry.js against the predicates as they were at ea5923ba.
 *
 * The registry is keyed (domain, id), so reading it by domain here is the whole coupling.
 */
var FINDINGS = DIAGNOSES.findingsFor('technology');

module.exports = FACTORY.createBinder({
  domain: 'technology',
  version: 'brain-v2/0.1.0-technology',
  levelsPerSensor: 3,
  sigma: SIGMA,
  channels: CHANNELS,
  findings: FINDINGS,
  /* ZERO. Two flows over different populations and different windows — 30-day
     exploited-in-the-wild against 7-day all-published — not two instruments observing
     one latent. */
  relationships: [],
  efferent: null   // R7
});
