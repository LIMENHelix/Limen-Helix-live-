/**
 * brain-v2/bind/medicine.js — declaration only. No fixture exists; MANIFEST-ONLY.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * TWO NAMES. THE FILE IS `medicine`, THE DOMAIN KEY IS `health`.
 *
 * This is the first binder to exercise the alias split, so it is worth being explicit
 * about which name goes where:
 *
 *   bind/medicine.js              the PRODUCT name — what the portal and console call it
 *   domain: 'health'              the SNAPSHOT key — what domain-snapshot.js emits, what
 *                                 feed-record.js writes as `feedhist:health`, and what a
 *                                 fixture is filed under (health-recorder.json)
 *
 * `lib/domain-names.js` owns that mapping and `bind/registry.js` resolves through it, so
 * `inspect('medicine')` and `inspect('health')` return one descriptor. Getting it
 * backwards fails silently in both directions — a `medicine` feed key the recorder never
 * writes, or a `health` binder that will never exist — and both read as "this domain has
 * no data" rather than as an error.
 * ═══════════════════════════════════════════════════════════════════════════════════
 *
 * Fifteen channels, from the exact `health: buildDomain('health', [...])` list. Every
 * numeric meaning was read out of its fetcher, and one of them is worth recording:
 *
 *   openFDA Recalls   openFDA drug enforcement actions in a 30-day window
 *   FDA Recalls       `<item>` count from an FDA recalls RSS, tracked under AGRICULTURE
 *
 * Two sources whose names are nearly identical, measuring drug enforcement actions and
 * food-recall feed items respectively. They are the most plausible-looking relationship
 * in this domain and they are not a relationship at all.
 *
 * ZERO DECLARED RELATIONSHIPS. Nothing else pairs either: an adverse-event total, a
 * shortage count, five Federal Register document counts and six news queries measure six
 * different things. Zero is the honest answer.
 */

'use strict';

var FACTORY = require('./factory.js');

var HOUR = 3600000;
var DAY = 24 * HOUR;

/**
 * q/r are SET, not fitted [mark: prior]. Reported counts from a regulator get a lower r
 * than a news recency count, because a filed enforcement action is a far less noisy read
 * than an article about one.
 */
var CHANNELS = [
  // ── Reported regulatory quantities. Things that were filed, not written about. ──
  { key: 'adverseEvents', name: 'openFDA Events',        recordedField: 'v',  field: 'value',    source: 'openFDA adverse event reports, cumulative total', cadenceMs: DAY, units: 'adverse event reports', q: 0.02, r: 0.08 },
  { key: 'drugRecalls',   name: 'openFDA Recalls',       recordedField: 'v',  field: 'value',    source: 'openFDA drug enforcement, 30d window',            cadenceMs: DAY, units: 'enforcement actions in 30d', q: 0.04, r: 0.12 },
  { key: 'drugShortages', name: 'FDA Drug Shortages',    recordedField: 'v',  field: 'value',    source: 'openFDA drug shortage list',                      cadenceMs: DAY, units: 'tracked shortages',     q: 0.03, r: 0.10 },

  /* A DIFFERENT THING WITH A SIMILAR NAME. `<item>` count from an FDA recalls RSS, and
     tracked under agriculture in the snapshot: food recalls, not drug enforcement. Units
     say what it counts so it can never be mistaken for the channel above. */
  { key: 'fdaRecallFeed', name: 'FDA Recalls',           recordedField: 'v',  field: 'value',    source: 'FDA recalls RSS, item count (food; agriculture-tracked)', cadenceMs: DAY, units: 'feed items', q: 0.05, r: 0.20 },

  /* NEWS AND PUBLICATION RECENCY COUNTS. `recent7d`, because the raw count saturates. */
  { key: 'cdcMmwr',       name: 'CDC MMWR',              recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, CDC MMWR',                     cadenceMs: DAY, units: 'articles/7d',           q: 0.06, r: 0.25 },
  { key: 'whoOutbreak',   name: 'WHO Disease Outbreak',  recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, WHO outbreak news',            cadenceMs: DAY, units: 'articles/7d',           q: 0.06, r: 0.25 },
  { key: 'clinicalTrials',name: 'ClinicalTrials.gov',    recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, trial registrations',          cadenceMs: DAY, units: 'articles/7d',           q: 0.06, r: 0.25 },
  { key: 'nihGrants',     name: 'NIH Grants',            recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, NIH awards',                   cadenceMs: DAY, units: 'articles/7d',           q: 0.06, r: 0.25 },
  { key: 'retractions',   name: 'Retraction Watch',      recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, retractions',                  cadenceMs: DAY, units: 'articles/7d',           q: 0.06, r: 0.25 },
  { key: 'pubmed',        name: 'PubMed',                recordedField: 'v',  field: 'value',    source: 'PubMed search, result total',                     cadenceMs: DAY, units: 'search result total',   q: 0.05, r: 0.20 },

  /* FEDERAL REGISTER DOCUMENT COUNTS. Publication volume for five health agencies. */
  { key: 'fedRegHhs',     name: 'Fed Reg HHS',           recordedField: 'v',  field: 'value',    source: 'federalregister.gov, HHS, 30d',                   cadenceMs: DAY, units: 'documents in 30d',      q: 0.04, r: 0.18 },
  { key: 'fedRegCdc',     name: 'Fed Reg CDC',           recordedField: 'v',  field: 'value',    source: 'federalregister.gov, CDC, 30d',                   cadenceMs: DAY, units: 'documents in 30d',      q: 0.04, r: 0.18 },
  { key: 'fedRegCms',     name: 'Fed Reg CMS',           recordedField: 'v',  field: 'value',    source: 'federalregister.gov, CMS, 30d',                   cadenceMs: DAY, units: 'documents in 30d',      q: 0.04, r: 0.18 },
  { key: 'fedRegNih',     name: 'Fed Reg NIH',           recordedField: 'v',  field: 'value',    source: 'federalregister.gov, NIH, 30d',                   cadenceMs: DAY, units: 'documents in 30d',      q: 0.04, r: 0.18 },
  { key: 'fedRegFda',     name: 'Fed Reg FDA',           recordedField: 'v',  field: 'value',    source: 'federalregister.gov, FDA, 30d',                   cadenceMs: DAY, units: 'documents in 30d',      q: 0.04, r: 0.18 }
];

var SIGMA = 2.0;   // [mark: prior]

/**
 * FINDINGS. Only on the three channels that count something a regulator recorded, and
 * only as a departure from that channel's own baseline.
 *
 * Nothing is built on the news counts, the PubMed total or the Federal Register counts.
 * A finding on those would fire when an agency publishes or a journal indexes, and would
 * be reported as a health condition — which in this domain is not merely wrong but the
 * kind of wrong somebody might act on.
 */
var FINDINGS = [
  { id: 'ADVERSE_EVENT_SURGE', requires: ['adverseEvents'],
    basis: 'openFDA adverse event reports departing their own baseline by >=2sd',
    test: function (v, s, d) { return d.adverseEvents && d.adverseEvents.z >= SIGMA; } },

  { id: 'ENFORCEMENT_SURGE', requires: ['drugRecalls'],
    basis: 'openFDA drug enforcement actions in the 30d window departing their own baseline',
    test: function (v, s, d) { return d.drugRecalls && d.drugRecalls.z >= SIGMA; } },

  { id: 'SUPPLY_SHORTAGE', requires: ['drugShortages'],
    basis: 'tracked drug shortages departing their own baseline',
    test: function (v, s, d) { return d.drugShortages && d.drugShortages.z >= SIGMA; } },

  { id: 'SAFETY_AND_SUPPLY_TOGETHER', requires: ['drugRecalls', 'drugShortages'],
    basis: 'enforcement actions and tracked shortages both elevated — two separately reported quantities moving together, which either alone cannot distinguish from its own noise',
    test: function (v, s, d) {
      return d.drugRecalls && d.drugShortages && d.drugRecalls.z >= 1.0 && d.drugShortages.z >= 1.0 &&
             (d.drugRecalls.z + d.drugShortages.z) >= 2.5;
    } },

  { id: 'SYSTEMIC_HEALTH_STRESS', requires: ['adverseEvents', 'drugShortages'],
    basis: 'the fused domain state itself past 2sd, with two reported quantities live',
    test: function (v, s, d) { return typeof s.departure === 'number' && Math.abs(s.departure) >= SIGMA; } }
];

module.exports = FACTORY.createBinder({
  /* THE SNAPSHOT KEY, not the filename. See the header. */
  domain: 'health',
  version: 'brain-v2/0.1.0-medicine',
  levelsPerSensor: 3,
  sigma: SIGMA,
  channels: CHANNELS,
  findings: FINDINGS,
  /* ZERO. The closest-looking pair — openFDA Recalls and FDA Recalls — measures drug
     enforcement actions and food-recall feed items. Nothing else pairs at all. */
  relationships: [],
  efferent: null   // R7
});
