'use strict';

/**
 * Prepare one source-linked customer artifact from one domain's own durable
 * commercial intent. This worker makes no new world-fact claims: headline
 * observations remain attributed topic leads, while stress/program language is
 * explicitly an internal LIMEN interpretation. No model or external motor runs.
 */

var crypto = require('node:crypto');
var Catalog = require('./offer-catalog.js');

var SCHEMA = 'domain-commercial-artifact/1.0';
var MAX_INTENT_AGE_MS = 48 * 60 * 60 * 1000;

function hash(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}
function text(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function list(value) { return Array.isArray(value) ? value : []; }
function https(value) { try { return new URL(String(value)).protocol === 'https:'; } catch (_) { return false; } }
function title(domain) { return domain.charAt(0).toUpperCase() + domain.slice(1); }
function freshnessMs(cadence) {
  if (cadence === 'IMMEDIATE' || cadence === 'FOUR_HOURS') return 6 * 60 * 60 * 1000;
  if (cadence === 'TWELVE_HOURS') return 18 * 60 * 60 * 1000;
  return 36 * 60 * 60 * 1000;
}

function validateReflex(contract, state, now) {
  if (!contract || !state || state.schemaVersion !== 'domain-commercial-reflex/1.0' ||
      state.status !== 'PLANNED' || state.readbackVerified !== true || !state.intent) return 'durable-planned-reflex-required';
  var intent = state.intent;
  if (state.productDomain !== contract.productDomain || state.ownerDomain !== contract.ownerDomain ||
      intent.productDomain !== contract.productDomain || intent.ownerDomain !== contract.ownerDomain) return 'domain-commercial-identity-mismatch';
  if (intent.schemaVersion !== 'domain-commercial-intent/1.0' || intent.status !== 'PLANNED' ||
      !text(intent.intentId) || !text(intent.sourcePacketId) || !text(intent.selectedProgram)) return 'commercial-intent-invalid';
  if (contract.allowedPrograms.indexOf(intent.selectedProgram) < 0) return 'program-outside-domain-contract';
  if (!Number.isFinite(Number(intent.plannedAt)) || now < Number(intent.plannedAt) || now - Number(intent.plannedAt) > MAX_INTENT_AGE_MS) {
    return 'commercial-intent-stale';
  }
  if (!list(intent.evidence).length || list(intent.evidence).some(function (row) {
    return !row || !text(row.title) || !row.sourceIdentity || !text(row.sourceIdentity.kind) ||
      !text(row.sourceIdentity.value) || !https(row.sourceUrl) || row.authority !== 'topic-lead-only' || row.fullTextVerified !== false;
  })) return 'source-ledger-invalid';
  return null;
}

function offerFor(contract) {
  var entry = Catalog.CATALOG[contract.productDomain] || {};
  var rung = contract.offerRungs[0];
  var offer = entry.rungs && entry.rungs[rung];
  return offer ? { rung: rung, name: offer.name, line: offer.line, cadence: offer.cadence,
    priceCents: offer.priceCents } : null;
}

function build(contract, state, nowValue) {
  var now = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
  var invalid = validateReflex(contract, state, now);
  if (invalid) return { status: 'ABSTAINED', reason: invalid, artifact: null };
  var intent = state.intent;
  var domainLabel = title(contract.productDomain);
  var sources = intent.evidence.map(function (row) {
    return {
      sourceIdentity: row.sourceIdentity,
      title: row.title,
      publisher: row.publisher || row.feedName || 'Publisher not supplied',
      feedName: row.feedName || null,
      observedAt: row.observedAt,
      sourceUrl: row.sourceUrl,
      authority: 'publisher-title-observed-by-feed',
      fullTextVerified: false
    };
  });
  var interoception = state.homology && state.homology.interoception || {};
  var stress = interoception.stress == null ? 'unavailable' : Math.round(Number(interoception.stress) * 100) + '%';
  var delta = interoception.delta == null ? 'unavailable' : (Number(interoception.delta) >= 0 ? '+' : '') +
    Math.round(Number(interoception.delta) * 100) + ' points';
  var offer = offerFor(contract);
  var sourceLines = sources.map(function (source, index) {
    return String(index + 1) + '. ' + source.title + ' — ' + source.publisher + '\n   ' + source.sourceUrl;
  });
  var knowledge = intent.admittedKnowledgeRefs || {};
  var candidateLabels = list(knowledge.opportunities).slice(0, 3).map(function (row) {
    return text(row && (row.title || row.label || row.id));
  }).filter(Boolean);
  var sections = [
    {
      heading: 'The current domain read',
      body: domainLabel + ' stress is ' + stress + '; change from the last commercial cycle is ' + delta +
        '. LIMEN selected ' + intent.selectedProgram + ' at ' + intent.cadence +
        ' cadence with ' + String(intent.intensity && intent.intensity.band || 'BASELINE') + ' intensity.'
    },
    {
      heading: 'What the feeds surfaced',
      body: sourceLines.join('\n')
    },
    {
      heading: 'How to use this signal',
      body: 'These are source-attributed titles observed by the domain feeds, not claims that LIMEN independently verified the article bodies. Open the linked records before acting. The stress reading is an internal domain interpretation used to allocate attention and production; it is not a prediction.'
    }
  ];
  if (candidateLabels.length) sections.push({
    heading: 'Brain-selected follow-up candidates',
    body: candidateLabels.map(function (value) { return '- ' + value; }).join('\n') +
      '\nThese are internal candidates for further work, not established external facts or authorized actions.'
  });
  if (offer) sections.push({
    heading: 'Continue with this domain',
    body: offer.name + ': ' + offer.line + ' (' + (offer.priceCents / 100).toFixed(2) + ' USD; ' + offer.cadence + ').\n' +
      'https://limenhelix.com/' + contract.productDomain
  });
  // A retry must reproduce identical customer content even when it crosses
  // UTC midnight. Preparation time controls freshness; the immutable plan
  // time controls the issue label and therefore artifact identity.
  var subject = domainLabel + ' signal brief — ' + new Date(Number(intent.plannedAt)).toISOString().slice(0, 10);
  var body = sections.map(function (section) { return section.heading + '\n' + section.body; }).join('\n\n');
  // Customer-visible dedupe must not change merely because a new internal
  // packet/intent reached the same rendered result. Provenance remains in the
  // artifact identity; the delivery hash is content plus its source ledger.
  var contentHash = hash({ subject: subject, body: body, sources: sources });
  var artifactId = 'dca_' + hash({ domain: contract.productDomain, intent: intent.intentId, content: contentHash }).slice(0, 24);
  return {
    status: 'ARTIFACT_PREPARED',
    reason: null,
    artifact: {
      schemaVersion: SCHEMA,
      artifactId: artifactId,
      status: 'ARTIFACT_PREPARED',
      productDomain: contract.productDomain,
      ownerDomain: contract.ownerDomain,
      intentId: intent.intentId,
      sourcePacketId: intent.sourcePacketId,
      artifactKind: 'SOURCE_LINKED_DOMAIN_SIGNAL_BRIEF',
      targetProgram: intent.selectedProgram,
      subject: subject,
      body: body,
      sections: sections,
      sourceLedger: sources,
      offer: offer,
      contentHash: contentHash,
      preparedAt: now,
      freshnessExpiresAt: now + freshnessMs(intent.cadence),
      truthBoundary: {
        fullTextRead: false,
        titleClaimsAttributedOnly: true,
        internalStressIsNotExternalFact: true,
        eligibleForFactualExpansion: false,
        factualExpansionRequiresVerifiedFullText: true
      },
      homology: {
        sensoryInput: 'domain-feed-title-ledger',
        salience: state.priority,
        premotorPlan: intent.intentId,
        motorState: 'ARTIFACT_PREPARED_EFFECT_INHIBITED',
        efferenceCopy: contentHash,
        reafference: 'AWAITING_SEPARATE_DISTRIBUTION_AND_CUSTOMER_OUTCOME'
      },
      externalEffectAuthorized: false,
      providerCalled: false,
      spendUsd: 0
    }
  };
}

async function persist(store, contract, result) {
  if (!store || typeof store.assertDurable !== 'function') throw new Error('strict durable store required');
  store.assertDurable();
  if (!result || result.status !== 'ARTIFACT_PREPARED' || !result.artifact) return result;
  var artifact = result.artifact;
  var artifactKey = contract.artifactPrefix + artifact.artifactId;
  await store.setIfAbsent(artifactKey, artifact);
  var restored = await store.get(artifactKey);
  if (!restored || restored.artifactId !== artifact.artifactId || restored.contentHash !== artifact.contentHash ||
      restored.productDomain !== contract.productDomain || restored.ownerDomain !== contract.ownerDomain) {
    throw new Error('domain commercial artifact readback invalid');
  }
  var latest = null;
  for (var attempt = 0; attempt < 3; attempt++) {
    var current = await store.get(contract.artifactStateKey);
    if (current && Number(current.preparedAt || 0) > Number(restored.preparedAt || 0)) return current;
    var written = current
      ? await store.replaceIfValue(contract.artifactStateKey, current, restored)
      : await store.setIfAbsent(contract.artifactStateKey, restored);
    if (written) { latest = await store.get(contract.artifactStateKey); break; }
  }
  if (!latest || latest.artifactId !== restored.artifactId || latest.contentHash !== restored.contentHash) {
    throw new Error('domain commercial artifact latest-state readback invalid');
  }
  await store.lpush(contract.artifactLog, {
    schemaVersion: SCHEMA,
    artifactId: restored.artifactId,
    productDomain: restored.productDomain,
    ownerDomain: restored.ownerDomain,
    intentId: restored.intentId,
    status: restored.status,
    contentHash: restored.contentHash,
    preparedAt: restored.preparedAt,
    externalEffectAuthorized: false
  });
  await store.ltrim(contract.artifactLog, 0, 199);
  return latest;
}

module.exports = {
  SCHEMA: SCHEMA,
  MAX_INTENT_AGE_MS: MAX_INTENT_AGE_MS,
  validateReflex: validateReflex,
  build: build,
  persist: persist,
  hash: hash
};
