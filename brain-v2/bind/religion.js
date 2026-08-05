/**
 * brain-v2/bind/religion.js — declaration only. No fixture exists; MANIFEST-ONLY.
 *
 * Fifteen channels, from the exact `religion: buildDomain('religion', [...])` list in
 * handlers/domain-snapshot.js.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * ZERO RELATIONSHIPS AND ZERO FINDINGS. ALL FIFTEEN CHANNELS ARE RSS KEYWORD QUERIES.
 *
 * Every source in this domain is a news feed: institutional (Vatican News, USCIRF, Pew),
 * broadcast (Al Jazeera, Times of Israel, Hindustan Times), and tradition-specific
 * (Christianity Today, BuddhistDoor, SikhNet, Orthodox Christianity, JTA). Not one of
 * them returns a measured quantity — no adherence figure, no attendance, no survey score.
 *
 * So this domain declares no finding, which is the honest output. The established rule is
 * that a finding must rest on a measured quantity and never on a publication, keyword or
 * discourse count; here that rule excludes every channel. A finding would have the
 * religion brain reporting a busy week in religious media as a religious condition.
 *
 * THE RELATIONSHIP TRAP HERE IS UNUSUALLY STRONG, because the channels partition so
 * neatly by tradition that they look like parallel instruments on one latent — global
 * religious activity. They are fifteen newsrooms with different languages, regions,
 * publication schedules and audiences. A gap between SikhNet and JTA measures which
 * newsroom published more this week, and declaring it as divergence on a shared latent
 * would turn an editorial fact into a finding about religion.
 *
 * WHAT WOULD CHANGE THIS is a channel carrying a measured quantity — Pew survey values
 * rather than coverage of Pew, congregation counts, attendance series. The current Pew
 * channel is an RSS query, so it reports articles about Pew rather than Pew's numbers.
 * The gap is in the instrumentation, and an empty findings list is what makes it visible.
 * ═══════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

var FACTORY = require('./factory.js');

var HOUR = 3600000;
var DAY = 24 * HOUR;

/**
 * q/r are SET, not fitted [mark: prior]. Every channel is a coverage count and carries
 * the high observation noise this project assigns to article counts.
 */
var CHANNELS = [
  /* INSTITUTIONAL AND RESEARCH FEEDS. */
  { key: 'vatican',        name: 'Vatican News',              recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Vatican News',            cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },
  { key: 'uscirf',         name: 'USCIRF',                    recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, USCIRF',                  cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },
  { key: 'pew',            name: 'Pew Religion',              recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Pew religion coverage',   cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },

  /* GENERAL AND BROADCAST FEEDS. */
  { key: 'religionEvents', name: 'RSS Religion Events',       recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, religion events',         cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },
  { key: 'religionNews',   name: 'RSS Religion News',         recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, religion news',           cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },
  { key: 'alJazeera',      name: 'Al Jazeera Religion',       recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Al Jazeera religion',     cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },
  { key: 'rns',            name: 'Religion News Service',     recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Religion News Service',   cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },
  { key: 'timesOfIsrael',  name: 'Times of Israel Religion',  recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Times of Israel religion', cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },
  { key: 'hindustanTimes', name: 'Hindustan Times Religion',  recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Hindustan Times religion', cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },

  /* TRADITION-SPECIFIC FEEDS. */
  { key: 'christianityToday', name: 'Christianity Today',     recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Christianity Today',      cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },
  { key: 'buddhistDoor',   name: 'BuddhistDoor Global',       recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, BuddhistDoor Global',     cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },
  { key: 'sikhNet',        name: 'SikhNet News',              recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, SikhNet',                 cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },
  { key: 'orthodox',       name: 'Orthodox Christianity',     recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Orthodox Christianity',   cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },
  { key: 'jta',            name: 'JTA Jewish News',           recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, JTA',                     cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },
  { key: 'esoteric',       name: 'Esoteric Spirituality',     recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, esoteric spirituality',   cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 }
];

var SIGMA = 2.0;   // [mark: prior] — declared for consistency; no finding uses it

module.exports = FACTORY.createBinder({
  domain: 'religion',
  version: 'brain-v2/0.1.0-religion',
  levelsPerSensor: 3,
  sigma: SIGMA,
  channels: CHANNELS,
  /* ZERO FINDINGS. All fifteen channels are RSS keyword queries; the discipline excludes
     every one. An empty list reports that this domain is instrumented entirely by
     coverage, which is a fact worth surfacing rather than hiding behind a finding. */
  findings: [],
  /* ZERO RELATIONSHIPS. The channels partition neatly by tradition and look like parallel
     instruments on one latent; they are fifteen newsrooms with different languages,
     regions and schedules. */
  relationships: [],
  efferent: null   // R7
});
