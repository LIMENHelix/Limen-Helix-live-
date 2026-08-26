'use strict';

var crypto = require('node:crypto');

var SCHEMA = 'defense-publication-candidate/1.0';
var MAX_TITLE_SET_AGE_MS = 6 * 60 * 60 * 1000;
var MAX_SOURCES = 6;

function hash(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

function text(value, max) {
  if (typeof value !== 'string' || !value.trim()) return null;
  return value.trim().slice(0, max || 2000);
}

function when(value) {
  var ms = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function https(value) {
  try { return new URL(String(value)).protocol === 'https:'; }
  catch (_) { return false; }
}

function collect(titleSets, now) {
  var at = Number(now) || Date.now();
  var seen = Object.create(null);
  var sources = [];
  (Array.isArray(titleSets) ? titleSets : []).forEach(function (set) {
    var recordedMs = when(set && set.t);
    if (!set || !recordedMs || at < recordedMs || at - recordedMs > MAX_TITLE_SET_AGE_MS ||
        !text(set.f, 200) || !Array.isArray(set.items)) return;
    set.items.forEach(function (item, index) {
      if (sources.length >= MAX_SOURCES || !item || item.tr === true || !text(item.ti) || !https(item.au) || seen[item.au]) return;
      seen[item.au] = true;
      var identity = 'defense:' + String(set.f) + ':' + String(set.hh) + ':' + String(item.i == null ? index : item.i);
      sources.push({
        sourceIdentity: { kind: 'headline-title', value: identity },
        title: text(item.ti, 600),
        url: String(item.au),
        publisher: text(item.pl, 200),
        feedName: text(set.f, 200),
        recordedAt: new Date(recordedMs).toISOString(),
        sourcePublishedAt: when(item.pa) == null ? null : new Date(when(item.pa)).toISOString(),
        publisherIndependence: 'unassessed'
      });
    });
  });
  return sources;
}

function build(titleSets, cognition, now) {
  var at = Number(now) || Date.now();
  var c = cognition && cognition.c;
  var packet = c && c.serverPacket;
  var sources = collect(titleSets, at);
  var feeds = Object.create(null);
  sources.forEach(function (source) { feeds[source.feedName] = true; });
  if (!packet || packet.schemaVersion !== 'civilization-domain-packet/1.0' || packet.domainId !== 'defense' ||
      sources.length < 3 || Object.keys(feeds).length < 2) return null;
  var selected = (packet.truth.opportunities || []).find(function (row) {
    return row && row.path === 'RESEARCHABLE' && row.held !== true && text(row.id, 300);
  });
  if (!selected) return null;
  var diagnoses = (packet.truth.activeDiagnoses || []).slice(0, 6).map(function (row) {
    return { id: text(row && row.id, 120), label: text(row && (row.label || row.id), 240), relevance: Number.isFinite(Number(row && row.relevance)) ? Number(row.relevance) : null };
  }).filter(function (row) { return row.id; });
  var day = new Date(at).toISOString().slice(0, 10);
  var sourceFingerprint = hash(sources.map(function (source) { return source.sourceIdentity.value; }));
  var title = 'Defense Source Watch — ' + day;
  var summary = 'An automated, source-linked watch of recently observed Defense feed headlines and LIMEN model state.';
  var disclaimer = 'This source watch records what public feeds published. It does not independently verify events, infer intent, predict conflict, or recommend an investment or military action.';
  var body = [
    summary,
    disclaimer,
    'LIMEN state: stress ' + String(packet.truth.stressScore == null ? 'unavailable' : packet.truth.stressScore) +
      '; phase ' + String(packet.truth.phaseLabel || packet.truth.phase || 'unavailable') +
      '; model labels ' + (diagnoses.length ? diagnoses.map(function (row) { return row.id; }).join(', ') : 'none') + '.',
    'Selected internal research topic: ' + String(selected.title || selected.id) + '. This label is a work-selection record, not an external fact.',
    'Read the linked original records before making any decision.'
  ].join('\n\n');
  var contentHash = hash({ title: title, summary: summary, body: body, sources: sources, packetId: packet.packetId, selectedId: selected.id });
  return {
    schemaVersion: SCHEMA,
    productDomain: 'defense',
    ownerDomain: 'defense',
    lane: 'publication',
    candidateId: 'dpc_' + hash({ day: day, source: sourceFingerprint, selected: selected.id }).slice(0, 24),
    title: title,
    summary: summary,
    body: body,
    disclaimer: disclaimer,
    sources: sources,
    sourceFingerprint: sourceFingerprint,
    contentHash: contentHash,
    defensePacketId: packet.packetId,
    brainSelection: { id: String(selected.id), title: text(selected.title, 400), path: 'RESEARCHABLE' },
    stressScore: packet.truth.stressScore,
    phase: packet.truth.phaseLabel || packet.truth.phase || null,
    diagnoses: diagnoses,
    generatedAt: new Date(at).toISOString(),
    liveMoney: false
  };
}

function validate(candidate) {
  return !!(candidate && candidate.schemaVersion === SCHEMA && candidate.productDomain === 'defense' &&
    candidate.ownerDomain === 'defense' && candidate.lane === 'publication' && text(candidate.candidateId) &&
    text(candidate.title) && text(candidate.body) && Array.isArray(candidate.sources) && candidate.sources.length >= 3 &&
    candidate.sources.every(function (source) { return text(source.title) && https(source.url) && source.sourceIdentity && text(source.sourceIdentity.value); }) &&
    candidate.sourceFingerprint === hash(candidate.sources.map(function (source) { return source.sourceIdentity.value; })) &&
    candidate.contentHash === hash({ title: candidate.title, summary: candidate.summary, body: candidate.body, sources: candidate.sources,
      packetId: candidate.defensePacketId, selectedId: candidate.brainSelection && candidate.brainSelection.id }));
}

module.exports = {
  SCHEMA: SCHEMA,
  MAX_TITLE_SET_AGE_MS: MAX_TITLE_SET_AGE_MS,
  MAX_SOURCES: MAX_SOURCES,
  hash: hash,
  collect: collect,
  build: build,
  validate: validate
};
