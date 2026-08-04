/**
 * brain-v2/bind/technology.js — declaration only. No fixture exists; MANIFEST-ONLY.
 *
 * Ten channels, from the exact `buildDomain('technology', [...])` list in
 * handlers/domain-snapshot.js. Every numeric meaning was read out of its fetcher.
 *
 * ZERO DECLARED RELATIONSHIPS. The one pair that looks relatable is not:
 *
 *   CISA KEV          the size of the Known Exploited Vulnerabilities catalogue — a
 *                     cumulative list of vulnerabilities observed being exploited
 *   NVD Recent CVEs   NEW CVEs published in the last 7 days
 *
 * A running total and a seven-day flow. They move together only in the sense that a
 * stock and its inflow do, which is not two instruments observing one latent — it is one
 * quantity and its derivative, and they would diverge by construction whenever disclosure
 * outpaced exploitation. Nothing else here pairs at all.
 */

'use strict';

var FACTORY = require('./factory.js');

var HOUR = 3600000;
var DAY = 24 * HOUR;

/**
 * q/r are SET, not fitted [mark: prior]. A catalogued vulnerability count gets a lower r
 * than a news recency count, because a filed CVE is a less noisy read than an article
 * about one.
 */
var CHANNELS = [
  // ── Catalogued vulnerability counts. Records of findings, not articles about them. ──
  { key: 'cisaKev',      name: 'CISA KEV',                   recordedField: 'v',  field: 'value',    source: 'CISA Known Exploited Vulnerabilities catalogue', cadenceMs: DAY,  units: 'catalogued CVEs',        q: 0.03, r: 0.10 },
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
 * Only the two vulnerability counts qualify. Patents, arXiv, Hacker News, the two RSS
 * feeds and the three Federal Register counts all measure publishing, and a finding on
 * publishing fires when somebody publishes.
 *
 * No fused-state finding. The domain already reports its own dysregulation from the fused
 * departure; a finding that re-tests `state.departure` restates a number the cycle has
 * already emitted, so it adds a second voice saying the same thing rather than evidence.
 */
var FINDINGS = [
  { id: 'KEV_CATALOGUE_DEPARTURE', requires: ['cisaKev'],
    basis: 'size of the CISA known-exploited catalogue departing its own baseline by >=2sd; direction not interpreted',
    test: function (v, s, d) { return d.cisaKev && Math.abs(d.cisaKev.z) >= SIGMA; } },

  { id: 'NEW_CVE_RATE_DEPARTURE', requires: ['nvdCves'],
    basis: 'count of CVEs published in the last 7 days departing its own baseline; direction not interpreted',
    test: function (v, s, d) { return d.nvdCves && Math.abs(d.nvdCves.z) >= SIGMA; } },

  { id: 'VULNERABILITY_COUNTS_CO_DEPARTING', requires: ['cisaKev', 'nvdCves'],
    basis: 'the catalogue total and the 7-day publication rate both departing their own baselines — a stock and its inflow moving together, which either alone cannot distinguish from its own noise',
    test: function (v, s, d) {
      return d.cisaKev && d.nvdCves && Math.abs(d.cisaKev.z) >= 1.0 && Math.abs(d.nvdCves.z) >= 1.0 &&
             (Math.abs(d.cisaKev.z) + Math.abs(d.nvdCves.z)) >= 2.5;
    } }
];

module.exports = FACTORY.createBinder({
  domain: 'technology',
  version: 'brain-v2/0.1.0-technology',
  levelsPerSensor: 3,
  sigma: SIGMA,
  channels: CHANNELS,
  findings: FINDINGS,
  /* ZERO. A cumulative catalogue and a 7-day flow are one quantity and its derivative,
     not two instruments observing one latent. */
  relationships: [],
  efferent: null   // R7
});
