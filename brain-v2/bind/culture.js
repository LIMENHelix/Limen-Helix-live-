/**
 * brain-v2/bind/culture.js — declaration only. No fixture exists; MANIFEST-ONLY.
 *
 * Sixteen channels, from the exact `culture: buildDomain('culture', [...])` list in
 * handlers/domain-snapshot.js.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════
 * ZERO RELATIONSHIPS AND ZERO FINDINGS. EVERY CHANNEL COUNTS PUBLISHED ARTEFACTS.
 *
 * Fifteen are RSS keyword queries; the sixteenth, Event Registry, returns a count of
 * cultural articles. There is no channel here that measures anything other than how much
 * was written, streamed, charted or announced.
 *
 * So this domain declares no finding at all, and that is the honest output rather than a
 * failure to try. Every rule under the established discipline — a finding must rest on a
 * measured quantity, never on a publication, keyword or discourse count — excludes all
 * sixteen. Declaring one anyway would mean the culture brain reporting a busy week in
 * entertainment media as a cultural condition, which is precisely the substitution the
 * rule exists to stop.
 *
 * WHAT WOULD CHANGE THIS is a channel carrying a measured quantity: ticket sales,
 * attendance, streaming volume as a number rather than a chart article, arts funding as a
 * share of spending. None is in the snapshot's culture list today. The gap is in the
 * instrumentation, not in the binder, and writing a finding here would hide it.
 *
 * The music channels are the clearest case. Spotify Streaming Charts, Billboard Charts,
 * Pitchfork, Genius, Songkick, SoundCloud and Music Scene Discourse look like seven reads
 * of one music-popularity latent. Every one of them counts ARTICLES ABOUT music, from
 * seven outlets with different editorial cycles, so a relationship would compare seven
 * publication rates. A streaming CHART is not streaming VOLUME.
 * ═══════════════════════════════════════════════════════════════════════════════════
 */

'use strict';

var FACTORY = require('./factory.js');

var HOUR = 3600000;
var DAY = 24 * HOUR;

/**
 * q/r are SET, not fitted [mark: prior]. Every channel here is a coverage count, so they
 * all carry the high observation noise this project assigns to article counts.
 */
var CHANNELS = [
  /* AN ARTICLE COUNT, returned as `value` rather than through the RSS recency path. */
  { key: 'eventRegistry', name: 'Event Registry',           recordedField: 'v',  field: 'value',    source: 'Event Registry, cultural article count', cadenceMs: DAY, units: 'articles matched', q: 0.05, r: 0.22 },

  /* FIFTEEN RSS KEYWORD QUERIES. Institutional, arts-press and music-press sources. */
  { key: 'rssCulture',    name: 'RSS Culture',              recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, culture',             cadenceMs: DAY, units: 'articles/7d',      q: 0.06, r: 0.25 },
  { key: 'nea',           name: 'NEA News',                 recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, National Endowment for the Arts', cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },
  { key: 'neh',           name: 'NEH News',                 recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, National Endowment for the Humanities', cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },
  { key: 'unesco',        name: 'UNESCO Culture',           recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, UNESCO culture',      cadenceMs: DAY, units: 'articles/7d',      q: 0.06, r: 0.25 },
  { key: 'penAmerica',    name: 'PEN America',              recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, PEN America',         cadenceMs: DAY, units: 'articles/7d',      q: 0.06, r: 0.25 },
  { key: 'artNewspaper',  name: 'Art Newspaper',            recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, The Art Newspaper',   cadenceMs: DAY, units: 'articles/7d',      q: 0.06, r: 0.25 },
  { key: 'variety',       name: 'Variety Entertainment',    recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Variety',             cadenceMs: DAY, units: 'articles/7d',      q: 0.06, r: 0.25 },
  { key: 'hypebeast',     name: 'Hypebeast Trends',         recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Hypebeast',           cadenceMs: DAY, units: 'articles/7d',      q: 0.06, r: 0.25 },
  { key: 'pitchfork',     name: 'Pitchfork Music',          recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Pitchfork',           cadenceMs: DAY, units: 'articles/7d',      q: 0.06, r: 0.25 },
  { key: 'spotifyCharts', name: 'Spotify Streaming Charts', recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Spotify charts coverage', cadenceMs: DAY, units: 'articles/7d',  q: 0.06, r: 0.25 },
  { key: 'billboard',     name: 'Billboard Charts',         recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Billboard charts coverage', cadenceMs: DAY, units: 'articles/7d', q: 0.06, r: 0.25 },
  { key: 'genius',        name: 'Genius Commentary',        recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Genius',              cadenceMs: DAY, units: 'articles/7d',      q: 0.06, r: 0.25 },
  { key: 'songkick',      name: 'Songkick Tours',           recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, Songkick tours',      cadenceMs: DAY, units: 'articles/7d',      q: 0.06, r: 0.25 },
  { key: 'soundcloud',    name: 'SoundCloud Emerging',      recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, SoundCloud emerging', cadenceMs: DAY, units: 'articles/7d',      q: 0.06, r: 0.25 },
  { key: 'musicScene',    name: 'Music Scene Discourse',    recordedField: 'r7', field: 'recent7d', source: 'RSS keyword query, music scene discourse', cadenceMs: DAY, units: 'articles/7d',    q: 0.06, r: 0.25 }
];

var SIGMA = 2.0;   // [mark: prior] — declared for consistency; no finding uses it

module.exports = FACTORY.createBinder({
  domain: 'culture',
  version: 'brain-v2/0.1.0-culture',
  levelsPerSensor: 3,
  sigma: SIGMA,
  channels: CHANNELS,
  /* ZERO FINDINGS. Every one of the sixteen channels counts published artefacts, and the
     discipline excludes all of them. An empty list is the honest report that this domain
     is instrumented entirely by coverage. */
  findings: [],
  /* ZERO RELATIONSHIPS. Seven music channels look like reads of one popularity latent and
     are seven publication rates; a streaming CHART is not streaming VOLUME. */
  relationships: [],
  efferent: null   // R7
});
