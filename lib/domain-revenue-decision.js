'use strict';

/** Stable, domain-owned pin for a paid-revenue fulfillment decision. */
var crypto = require('node:crypto');
var SCHEMA = 'domain-revenue-decision/1.0';
var LANE = 'subscriber-email';
var MODES = Object.freeze({
  PERSONAL_LIVE_READ: 'personal-live-read',
  DOMAIN_WIDE_LIVE_READ: 'domain-wide-live-read',
  COMMERCIAL_ARTIFACT: 'commercial-artifact',
  SUBSCRIPTION_EVENT: 'subscription-event'
});
function text(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function hash(value) { return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex'); }
function identityOf(value) { return {
  productDomain: value.productDomain, ownerDomain: value.ownerDomain, lane: LANE,
  sourceMode: value.sourceMode, sourceRef: value.sourceRef,
  sourceArtifactId: value.sourceArtifactId || null, sourceIntentId: value.sourceIntentId || null,
  digestKey: value.digestKey, contentHash: value.contentHash
}; }
function create(input) {
  input = input || {};
  var productDomain = text(input.productDomain), ownerDomain = text(input.ownerDomain) || productDomain;
  var sourceMode = text(input.sourceMode), sourceRef = text(input.sourceRef);
  var digestKey = text(input.digestKey), contentHash = text(input.contentHash);
  if (!productDomain || !ownerDomain || !sourceMode || !MODES[sourceMode.replace(/-/g, '_').toUpperCase()] ||
      !sourceRef || !digestKey || !contentHash) return null;
  var value = { schemaVersion: SCHEMA, decision: 'FULFILL_PAID_SUBSCRIBER', productDomain: productDomain,
    ownerDomain: ownerDomain, lane: LANE, sourceMode: sourceMode, sourceRef: sourceRef,
    sourceArtifactId: text(input.sourceArtifactId), sourceIntentId: text(input.sourceIntentId),
    digestKey: digestKey, contentHash: contentHash };
  value.decisionId = 'drd_' + hash(identityOf(value)).slice(0, 24);
  return value;
}
function validate(value, productDomain, ownerDomain) {
  if (!value || value.schemaVersion !== SCHEMA || value.decision !== 'FULFILL_PAID_SUBSCRIBER' ||
      value.lane !== LANE || value.productDomain !== productDomain || value.ownerDomain !== ownerDomain ||
      !text(value.sourceMode) || !MODES[value.sourceMode.replace(/-/g, '_').toUpperCase()] ||
      !text(value.sourceRef) || !text(value.digestKey) || !text(value.contentHash) || !text(value.decisionId)) return false;
  return value.decisionId === 'drd_' + hash(identityOf(value)).slice(0, 24);
}
module.exports = { SCHEMA: SCHEMA, LANE: LANE, MODES: MODES, hash: hash, create: create, validate: validate };
