'use strict';

/**
 * Deterministic premotor work order for a domain-selected short video.
 *
 * The renderer/uploader is deliberately outside this module. It may execute
 * these exact lines and abstract visual constraints, but it cannot select the
 * topic, upgrade a feed title into a fact, or grant itself publishing power.
 */

var crypto = require('node:crypto');
var Candidate = require('./domain-commercial-social-candidate.js');

var SCHEMA = 'domain-commercial-video-manifest/1.0';

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function text(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function list(value) { return Array.isArray(value) ? value : []; }
function label(domain) { return domain.charAt(0).toUpperCase() + domain.slice(1); }
function clip(value, max) {
  var chars = Array.from(String(value || '').replace(/\s+/g, ' ').trim());
  return chars.length <= max ? chars.join('') : chars.slice(0, Math.max(1, max - 1)).join('').replace(/[\s,;:.-]+$/, '') + '…';
}

function publicPayload(manifest) {
  return { title: manifest.title, description: manifest.description, beats: manifest.beats,
    format: manifest.format, visualContract: manifest.visualContract, sourceLedger: manifest.sourceLedger };
}

function build(contract, state, artifact, nowValue) {
  var now = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
  var invalid = Candidate.valid(contract, state, artifact, now);
  if (invalid) return { status: 'ABSTAINED', reason: invalid, manifest: null };
  if (artifact.targetProgram !== 'SHORT_VIDEO') {
    return { status: 'ABSTAINED', reason: 'domain-current-program-is-not-short-video', manifest: null };
  }
  var source = list(artifact.sourceLedger)[0];
  var domain = contract.productDomain;
  var domainLabel = label(domain);
  var rawStress = state.homology && state.homology.interoception && state.homology.interoception.stress;
  if (rawStress == null) rawStress = artifact.sourceStress;
  var stress = rawStress == null || !Number.isFinite(Number(rawStress))
    ? 'unavailable' : Math.round(Number(rawStress) * 100) + '%';
  var issueDate = new Date(Number(artifact.preparedAt)).toISOString().slice(0, 10);
  var title = domainLabel + ' watch: feed signal and internal stress · ' + issueDate;
  var description = 'Source-attributed topic lead from ' + source.publisher + ': ' + source.sourceUrl + '\n\n' +
    'LIMEN internal stress is an attention-allocation signal, not a prediction. Verify the source before acting.\n\n' +
    'https://limenhelix.com/' + domain;
  var beats = [
    {
      beat: 1, durationSeconds: 4,
      narration: domainLabel + ' watch. LIMEN internal domain stress is ' + stress + '.',
      onScreenText: domainLabel + ' · internal stress ' + stress
    },
    {
      beat: 2, durationSeconds: 8,
      narration: String(source.publisher) + ' published this feed title: ' + clip(source.title, 190) + '.',
      onScreenText: clip(source.title, 90) + ' — ' + clip(source.publisher, 34)
    },
    {
      beat: 3, durationSeconds: 6,
      narration: 'This is a source-attributed topic lead, not independent verification or a prediction.',
      onScreenText: 'Topic lead · verify the source'
    },
    {
      beat: 4, durationSeconds: 5,
      narration: 'See the current ' + domainLabel + ' domain read at limenhelix dot com.',
      onScreenText: 'limenhelix.com/' + domain
    }
  ];
  var format = { aspectRatio: '9:16', targetDurationSeconds: 23, captionsRequired: true,
    voiceoverRequired: true, musicOptional: true };
  var visualContract = {
    style: 'abstract-domain-data-visualization',
    required: ['domain label', 'source attribution', 'internal-stress label', 'verification disclaimer'],
    prohibited: ['literal depiction of the reported event', 'unverified people or logos',
      'investment-return claim', 'prediction language', 'fabricated quotation']
  };
  var sourceLedger = [{ sourceIdentity: source.sourceIdentity, title: source.title,
    publisher: source.publisher, sourceUrl: source.sourceUrl,
    authority: source.authority, fullTextVerified: false }];
  var publicContentHash = hash({ title: title, description: description, beats: beats,
    format: format, visualContract: visualContract, sourceLedger: sourceLedger });
  var manifestId = 'dvm_' + hash({ domain: domain, artifactId: artifact.artifactId,
    publicContentHash: publicContentHash }).slice(0, 24);
  return {
    status: 'VIDEO_MANIFEST_PREPARED',
    reason: null,
    manifest: {
      schemaVersion: SCHEMA,
      manifestId: manifestId,
      status: 'VIDEO_MANIFEST_PREPARED',
      productDomain: domain,
      ownerDomain: contract.ownerDomain,
      sourceArtifactId: artifact.artifactId,
      sourceIntentId: artifact.intentId,
      sourcePacketId: artifact.sourcePacketId,
      selectedProgram: artifact.targetProgram,
      issueDate: issueDate,
      title: title,
      description: description,
      beats: beats,
      format: format,
      visualContract: visualContract,
      sourceLedger: sourceLedger,
      publicContentHash: publicContentHash,
      preparedAt: now,
      expiresAt: Number(artifact.freshnessExpiresAt),
      truthBoundary: {
        fullTextRead: false,
        publisherTitleAttributedOnly: true,
        internalStressIsNotExternalFact: true,
        rendererMayNotAddWorldFacts: true,
        uploaderMayNotAlterNarration: true
      },
      homology: {
        afferentCause: artifact.sourcePacketId,
        subjectDomainSelection: artifact.intentId,
        premotorArtifact: artifact.artifactId,
        motorPlan: manifestId,
        motorState: 'RENDER_AND_UPLOAD_INHIBITED',
        efferenceCopy: publicContentHash,
        reafference: 'AWAITING_SEPARATE_VIDEO_PLATFORM_OUTCOME'
      },
      externalEffectAuthorized: false,
      modelCalled: false,
      rendererCalled: false,
      uploaderCalled: false,
      providerCalled: false,
      spendUsd: 0
    }
  };
}

function validManifest(contract, manifest, state, artifact, nowValue) {
  var now = Number.isFinite(Number(nowValue)) ? Number(nowValue) : Date.now();
  var source = manifest && list(manifest.sourceLedger)[0];
  return !!(contract && manifest && state && artifact && manifest.schemaVersion === SCHEMA &&
    manifest.status === 'VIDEO_MANIFEST_PREPARED' && manifest.productDomain === contract.productDomain &&
    manifest.ownerDomain === contract.ownerDomain && manifest.sourceArtifactId === artifact.artifactId &&
    manifest.sourceIntentId === artifact.intentId && manifest.sourcePacketId === artifact.sourcePacketId &&
    manifest.selectedProgram === 'SHORT_VIDEO' && artifact.targetProgram === 'SHORT_VIDEO' &&
    Number.isFinite(Number(manifest.preparedAt)) && Number.isFinite(Number(manifest.expiresAt)) &&
    now >= Number(manifest.preparedAt) && now < Number(manifest.expiresAt) &&
    text(manifest.publicContentHash) && hash(publicPayload(manifest)) === manifest.publicContentHash &&
    list(manifest.beats).length === 4 && source && source.fullTextVerified === false &&
    source.authority === 'publisher-title-observed-by-feed' &&
    manifest.truthBoundary && manifest.truthBoundary.rendererMayNotAddWorldFacts === true &&
    manifest.externalEffectAuthorized === false && manifest.rendererCalled === false &&
    manifest.uploaderCalled === false && Candidate.valid(contract, state, artifact, now) === null);
}

async function persist(store, contract, result) {
  store.assertDurable();
  if (!result || result.status !== 'VIDEO_MANIFEST_PREPARED' || !result.manifest) return result;
  var manifest = result.manifest;
  var immutableKey = contract.videoManifestPrefix + manifest.manifestId;
  var created = await store.setIfAbsent(immutableKey, manifest);
  var restored = await store.get(immutableKey);
  if (!restored || restored.manifestId !== manifest.manifestId ||
      restored.publicContentHash !== manifest.publicContentHash ||
      restored.productDomain !== contract.productDomain || restored.ownerDomain !== contract.ownerDomain) {
    throw new Error('domain commercial video manifest readback invalid');
  }
  var latest = null;
  for (var attempt = 0; attempt < 3; attempt++) {
    var current = await store.get(contract.videoManifestStateKey);
    if (current && Number(current.preparedAt || 0) > Number(restored.preparedAt || 0)) return current;
    var written = current ? await store.replaceIfValue(contract.videoManifestStateKey, current, restored)
      : await store.setIfAbsent(contract.videoManifestStateKey, restored);
    if (written) { latest = await store.get(contract.videoManifestStateKey); break; }
  }
  if (!latest || latest.manifestId !== restored.manifestId || latest.publicContentHash !== restored.publicContentHash) {
    throw new Error('domain commercial video manifest latest-state readback invalid');
  }
  if (created) {
    await store.lpush(contract.videoManifestLog, {
      schemaVersion: SCHEMA, manifestId: restored.manifestId, productDomain: restored.productDomain,
      ownerDomain: restored.ownerDomain, sourceArtifactId: restored.sourceArtifactId,
      publicContentHash: restored.publicContentHash, preparedAt: restored.preparedAt,
      externalEffectAuthorized: false
    });
    await store.ltrim(contract.videoManifestLog, 0, 199);
  }
  return latest;
}

module.exports = { SCHEMA: SCHEMA, build: build, validManifest: validManifest,
  persist: persist, publicPayload: publicPayload, hash: hash };
