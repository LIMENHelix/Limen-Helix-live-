'use strict';

var crypto = require('node:crypto');
var Redis = require('./redis-kv.js');

var SCHEMA = 'infrastructure-real-estate-decision/1.0';
var CANDIDATE_SCHEMA = 'infrastructure-real-estate-candidate/1.0';
var LOG_KEY = 'infrastructure_real_estate_decision_log';
var PREFIX = 'infrastructure_real_estate_decision:';
var MAX_BRAIN_AGE_MS = 45 * 60 * 1000;
var MAX_DECISION_AGE_MS = 10 * 60 * 1000;

function hash(value) { return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex'); }
function text(value, max) { var v = typeof value === 'string' ? value.trim() : ''; return v ? v.slice(0, max || 4000) : null; }
function validEmail(value) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value || ''); }
function validHttps(value) { try { return new URL(String(value)).protocol === 'https:'; } catch (_) { return false; } }
function key(id) { return PREFIX + id; }

function candidate(input) {
  input = input || {};
  var inquiryId = text(input.inquiryId, 160);
  var counterpartyEmail = text(input.counterpartyEmail, 320);
  var propertyRef = text(input.propertyRef, 320);
  var transactionIntent = text(input.transactionIntent, 160);
  var listingUrl = text(input.listingUrl, 2000);
  var indicationPriceUsd = Number(input.indicationPriceUsd);
  var brainOpportunityId = text(input.brainOpportunityId, 320);
  var subject = text(input.subject, 500);
  var body = text(input.body, 12000);
  var evidenceId = text(input.evidenceId, 320);
  if (!inquiryId || !validEmail(counterpartyEmail) || !propertyRef || transactionIntent !== 'non-binding-letter-of-interest' ||
      !validHttps(listingUrl) || !Number.isFinite(indicationPriceUsd) || indicationPriceUsd <= 0 || !brainOpportunityId ||
      !subject || !body || !evidenceId || input.nonBinding !== true || input.contractAuthorized !== false ||
      input.earnestMoneyAuthorized !== false || input.fundsTransferAuthorized !== false) return null;
  counterpartyEmail = counterpartyEmail.toLowerCase();
  return {
    schemaVersion: CANDIDATE_SCHEMA,
    productDomain: 'infrastructure', ownerDomain: 'infrastructure', lane: 'real-estate',
    inquiryId: inquiryId, counterpartyEmail: counterpartyEmail, counterpartyEmailHash: hash(counterpartyEmail),
    propertyRef: propertyRef, propertyRefHash: hash(propertyRef), transactionIntent: transactionIntent,
    listingUrl: listingUrl, listingUrlHash: hash(listingUrl), indicationPriceUsd: indicationPriceUsd,
    brainOpportunityId: brainOpportunityId,
    subject: subject, subjectHash: hash(subject), body: body, contentHash: hash(body),
    evidenceId: evidenceId, evidenceHash: hash(evidenceId), nonBinding: true, contractAuthorized: false,
    earnestMoneyAuthorized: false, fundsTransferAuthorized: false, liveMoney: false
  };
}

function validCandidate(value) {
  return !!(value && value.schemaVersion === CANDIDATE_SCHEMA && value.productDomain === 'infrastructure' &&
    value.ownerDomain === 'infrastructure' && value.lane === 'real-estate' && text(value.inquiryId) &&
    validEmail(value.counterpartyEmail) && value.counterpartyEmailHash === hash(value.counterpartyEmail) && text(value.propertyRef) &&
    value.propertyRefHash === hash(value.propertyRef) && value.transactionIntent === 'non-binding-letter-of-interest' &&
    validHttps(value.listingUrl) && value.listingUrlHash === hash(value.listingUrl) && Number.isFinite(value.indicationPriceUsd) &&
    value.indicationPriceUsd > 0 && text(value.brainOpportunityId) && value.nonBinding === true &&
    value.contractAuthorized === false && value.earnestMoneyAuthorized === false && value.fundsTransferAuthorized === false && text(value.subject) &&
    value.subjectHash === hash(value.subject) && text(value.body) && value.contentHash === hash(value.body) &&
    text(value.evidenceId) && value.evidenceHash === hash(value.evidenceId));
}

async function brainEntry(deps) {
  if (deps && deps.cognition) return deps.cognition;
  return (deps && deps.redisGet || Redis.redisGet)('limen:brain:cognition:infrastructure');
}

function validBrain(entry, now) {
  var cognition = entry && entry.c;
  var ts = Number(entry && entry.ts);
  var packet = cognition && cognition.serverPacket;
  var generated = Date.parse(packet && packet.generatedAt);
  return !!(cognition && cognition.domain === 'infrastructure' && Number.isFinite(ts) && now >= ts &&
    now - ts <= MAX_BRAIN_AGE_MS && packet && packet.schemaVersion === 'civilization-domain-packet/1.0' &&
    packet.domainId === 'infrastructure' && packet.sourceIdentity &&
    packet.sourceIdentity.producer === 'brain-cognition-refresh/1' && Number.isFinite(generated) &&
    now >= generated && now - generated <= MAX_BRAIN_AGE_MS);
}

async function persist(store, receipt) {
  var created = await store.setIfAbsent(key(receipt.decisionReceiptId), receipt);
  var restored = await store.get(key(receipt.decisionReceiptId));
  if (!restored || restored.actionId !== receipt.actionId || restored.status !== receipt.status) throw new Error('infrastructure real-estate decision readback invalid');
  if (created) { await store.lpush(LOG_KEY, restored); await store.ltrim(LOG_KEY, 0, 999); }
  return restored;
}

async function decide(store, value, now, deps) {
  var at = Number(now) || Date.now();
  if (!validCandidate(value)) return { ok: true, status: 'NO_ACTION', released: false, reason: 'infrastructure-real-estate-candidate-invalid', blockers: ['exact-non-binding-property-interest-record-required'], providerCalled: false, liveMoney: false };
  try {
    store.assertDurable();
    var entry = await brainEntry(deps);
    var blockers = [];
    if (!validBrain(entry, at)) blockers.push('infrastructure-brain-state-missing-or-stale');
    var cognition = entry && entry.c || {};
    var packet = cognition.serverPacket || {};
    var organs = cognition.brainOrgans || {};
    if (!blockers.length) {
      if ((cognition.immune || {}).immuneState !== 'clear') blockers.push('infrastructure-immune-veto');
      if ((cognition.awareness || {}).humanReviewRequired === true) blockers.push('infrastructure-human-review-veto');
      var emission = organs.autonomousInternalEmission || {};
      if (emission.holdReason) blockers.push('infrastructure-b10-brake-held:' + emission.holdReason);
      if (!(Number(emission.emittedCount) > 0)) blockers.push('infrastructure-b10-no-action-selected');
      if (!packet.truth || !packet.truth.feedHealth || !(Number(packet.truth.feedHealth.live) > 0)) blockers.push('infrastructure-live-feeds-unavailable');
      var opportunity = (packet.truth && Array.isArray(packet.truth.opportunities) ? packet.truth.opportunities : []).find(function (row) {
        return row && String(row.id) === value.brainOpportunityId && row.path === 'RESEARCHABLE' && row.held !== true;
      });
      if (!opportunity) blockers.push('infrastructure-exact-brain-opportunity-not-selected');
      var maxIndicationUsd = Number(deps && deps.maxIndicationUsd);
      if (!Number.isFinite(maxIndicationUsd) || maxIndicationUsd <= 0) blockers.push('infrastructure-real-estate-indication-cap-not-configured');
      else if (value.indicationPriceUsd > maxIndicationUsd) blockers.push('infrastructure-real-estate-indication-exceeds-cap');
      var metabolism = organs.resourceMetabolism || {}, gates = metabolism.gates || {};
      if (metabolism.state !== 'AVAILABLE' || gates.mayRunInternalCycle !== true) blockers.push('infrastructure-resource-metabolism-inhibited');
    }
    var actionId = 'ira_' + hash({ inquiryId: value.inquiryId, counterparty: value.counterpartyEmailHash, property: value.propertyRefHash,
      listing: value.listingUrlHash, indication: value.indicationPriceUsd, opportunity: value.brainOpportunityId,
      kind: value.transactionIntent, content: value.contentHash, evidence: value.evidenceHash }).slice(0, 24);
    var status = blockers.length ? 'NO_ACTION' : 'RELEASED';
    return persist(store, {
      schemaVersion: SCHEMA, decisionReceiptId: 'ird_' + hash({ actionId: actionId, packet: packet.packetId || null, status: status, blockers: blockers }).slice(0, 24),
      actionId: actionId, status: status, released: status === 'RELEASED', reason: blockers.length ? 'infrastructure-b10-held' : null,
      blockers: blockers, productDomain: 'infrastructure', ownerDomain: 'infrastructure', lane: 'real-estate',
      decisionContract: 'non-binding-real-estate-interest-decision/1', inquiryId: value.inquiryId,
      counterpartyEmailHash: value.counterpartyEmailHash, propertyRefHash: value.propertyRefHash, transactionIntent: value.transactionIntent,
      listingUrlHash: value.listingUrlHash, indicationPriceUsd: value.indicationPriceUsd, brainOpportunityId: value.brainOpportunityId,
      nonBinding: true, contractAuthorized: false, earnestMoneyAuthorized: false, fundsTransferAuthorized: false,
      subjectHash: value.subjectHash, contentHash: value.contentHash, evidenceHash: value.evidenceHash,
      infrastructurePacketId: packet.packetId || null,
      predictedOutcome: blockers.length ? null : { emailProviderAcceptance: true, counterpartyReply: 'independently-observed-inbound-email-or-timeout', transactionState: 'non-binding-interest-only' },
      decidedAt: at, expiresAt: at + MAX_DECISION_AGE_MS, providerCalled: false, liveMoney: false
    });
  } catch (error) {
    return { ok: true, status: 'NO_ACTION', released: false, reason: 'infrastructure-b10-unavailable', blockers: ['decision-persistence-or-input-unavailable'], detail: String(error && error.message || error), providerCalled: false, liveMoney: false };
  }
}

function validateReceipt(receipt, value, now) {
  var at = Number(now) || Date.now();
  if (!validCandidate(value) || !receipt || receipt.schemaVersion !== SCHEMA || receipt.status !== 'RELEASED' || receipt.released !== true) return false;
  var actionId = 'ira_' + hash({ inquiryId: value.inquiryId, counterparty: value.counterpartyEmailHash, property: value.propertyRefHash,
    listing: value.listingUrlHash, indication: value.indicationPriceUsd, opportunity: value.brainOpportunityId,
    kind: value.transactionIntent, content: value.contentHash, evidence: value.evidenceHash }).slice(0, 24);
  return receipt.actionId === actionId && receipt.counterpartyEmailHash === value.counterpartyEmailHash &&
    receipt.propertyRefHash === value.propertyRefHash && receipt.listingUrlHash === value.listingUrlHash &&
    receipt.indicationPriceUsd === value.indicationPriceUsd && receipt.brainOpportunityId === value.brainOpportunityId && receipt.subjectHash === value.subjectHash &&
    receipt.contentHash === value.contentHash && receipt.nonBinding === true && receipt.contractAuthorized === false &&
    receipt.earnestMoneyAuthorized === false && receipt.fundsTransferAuthorized === false &&
    Number(receipt.decidedAt) <= at && at < Number(receipt.expiresAt);
}

module.exports = { SCHEMA: SCHEMA, CANDIDATE_SCHEMA: CANDIDATE_SCHEMA, LOG_KEY: LOG_KEY, key: key, hash: hash,
  candidate: candidate, validateCandidate: validCandidate, validBrain: validBrain, decide: decide, validateReceipt: validateReceipt };
