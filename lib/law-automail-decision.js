'use strict';
var crypto = require('node:crypto');
var Redis = require('./redis-kv.js');
var SCHEMA = 'law-automail-decision/1.0', LOG_KEY = 'law_automail_decision_log', PREFIX = 'law_automail_decision:';
var MAX_COGNITION_AGE_MS = 45 * 60 * 1000, MAX_DECISION_AGE_MS = 10 * 60 * 1000;
function hash(v) { return crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex'); }
function key(id) { return PREFIX + id; }
function text(v) { return typeof v === 'string' && v.trim() ? v.trim() : null; }
function candidate(deal, html, minLeadDays) {
  deal = deal || {}; var owner = deal.owner || {}, parcelKey = text(deal.parcel || deal.caseNumber), body = text(html);
  var address = { name: text(owner.name) || 'Current Owner', line1: text(owner.mailAddr || deal.street), city: text(owner.mailCity || deal.city),
    state: text(owner.mailState || deal.state || 'FL'), zip: text(String(owner.mailZip || deal.zip || '').slice(0, 5)) };
  var daysOut = Number(deal._daysOut);
  if (!parcelKey || !body || !address.line1 || !address.city || !address.state || !address.zip || !Number.isFinite(daysOut)) return null;
  return { schemaVersion: 'law-automail-candidate/1.0', productDomain: 'law', ownerDomain: 'law', lane: 'automail',
    parcelKey: parcelKey, parcelHash: hash(parcelKey), saleDate: text(deal.saleDate), daysOut: daysOut,
    minimumLeadDays: Math.max(0, Number(minLeadDays) || 0), address: address, addressHash: hash(address), html: body, contentHash: hash(body),
    marketingMail: true, liveMoney: false };
}
function validateCandidate(v) { return !!(v && v.schemaVersion === 'law-automail-candidate/1.0' && v.productDomain === 'law' && v.ownerDomain === 'law' &&
  v.lane === 'automail' && text(v.parcelKey) && v.parcelHash === hash(v.parcelKey) && v.address && v.addressHash === hash(v.address) &&
  text(v.html) && v.contentHash === hash(v.html) && Number.isFinite(Number(v.daysOut)) && Number(v.daysOut) >= Number(v.minimumLeadDays) && v.marketingMail === true); }
function validCognition(entry, now) { var c = entry && entry.c, ts = Number(entry && entry.ts), p = c && c.serverPacket, generated = Date.parse(p && p.generatedAt);
  return !!(c && c.domain === 'law' && Number.isFinite(ts) && now >= ts && now - ts <= MAX_COGNITION_AGE_MS && p && p.schemaVersion === 'civilization-domain-packet/1.0' &&
    p.domainId === 'law' && p.sourceIdentity && p.sourceIdentity.producer === 'brain-cognition-refresh/1' && Number.isFinite(generated) && now >= generated && now - generated <= MAX_COGNITION_AGE_MS); }
async function persist(store, receipt) { var created = await store.setIfAbsent(key(receipt.decisionReceiptId), receipt), restored = await store.get(key(receipt.decisionReceiptId));
  if (!restored || restored.actionId !== receipt.actionId || restored.status !== receipt.status) throw new Error('law automail decision readback invalid');
  if (created) { await store.lpush(LOG_KEY, restored); await store.ltrim(LOG_KEY, 0, 999); } return restored; }
async function decide(store, value, now, deps) {
  var at = Number(now) || Date.now(); if (!validateCandidate(value)) return { ok: true, status: 'NO_ACTION', released: false, reason: 'law-automail-candidate-invalid', blockers: ['exact-address-content-and-lead-time-required'], providerCalled: false, liveMoney: false };
  try { store.assertDurable(); var entry = deps && deps.cognition ? deps.cognition : await (deps && deps.redisGet || Redis.redisGet)('limen:brain:cognition:law');
    var blockers = [], c = entry && entry.c || {}, p = c.serverPacket || {}, truth = p.truth || {}, organs = c.brainOrgans || {};
    if (!validCognition(entry, at)) blockers.push('law-brain-state-missing-or-stale');
    if (!blockers.length) { if ((c.immune || {}).immuneState !== 'clear') blockers.push('law-immune-veto');
      if ((c.awareness || {}).humanReviewRequired === true) blockers.push('law-human-review-veto');
      if ((organs.autonomousInternalEmission || {}).holdReason) blockers.push('law-b10-brake-held:' + organs.autonomousInternalEmission.holdReason);
      if (!truth.feedHealth || !(Number(truth.feedHealth.live) > 0)) blockers.push('law-live-feeds-unavailable');
      var metabolism = organs.resourceMetabolism || {}, gates = metabolism.gates || {};
      if (metabolism.state !== 'AVAILABLE' || gates.mayRunInternalCycle !== true) blockers.push('law-resource-metabolism-inhibited'); }
    var actionId = 'laa_' + hash({ parcelHash: value.parcelHash, addressHash: value.addressHash, contentHash: value.contentHash, saleDate: value.saleDate }).slice(0, 24);
    var status = blockers.length ? 'NO_ACTION' : 'RELEASED'; return persist(store, { schemaVersion: SCHEMA,
      decisionReceiptId: 'lad_' + hash({ actionId: actionId, packetId: p.packetId || null, status: status, blockers: blockers }).slice(0, 24),
      actionId: actionId, status: status, released: status === 'RELEASED', reason: blockers.length ? 'law-b10-held' : null, blockers: blockers,
      productDomain: 'law', ownerDomain: 'law', lane: 'automail', decisionContract: 'law-physical-mail-decision/1', parcelHash: value.parcelHash,
      addressHash: value.addressHash, contentHash: value.contentHash, saleDate: value.saleDate, daysOut: value.daysOut, lawPacketId: p.packetId || null,
      predictedOutcome: blockers.length ? null : { providerAcceptance: true, renderStatus: 'rendered-or-failed', delivery: 'provider-tracked-if-available' },
      decidedAt: at, expiresAt: at + MAX_DECISION_AGE_MS, providerCalled: false, liveMoney: false });
  } catch (error) { return { ok: true, status: 'NO_ACTION', released: false, reason: 'law-b10-unavailable', blockers: ['decision-persistence-or-input-unavailable'], detail: String(error && error.message || error), providerCalled: false, liveMoney: false }; }
}
function validateReceipt(r, v, now) { var at = Number(now) || Date.now(); return !!(validateCandidate(v) && r && r.schemaVersion === SCHEMA && r.status === 'RELEASED' &&
  r.actionId === 'laa_' + hash({ parcelHash: v.parcelHash, addressHash: v.addressHash, contentHash: v.contentHash, saleDate: v.saleDate }).slice(0, 24) &&
  r.addressHash === v.addressHash && r.contentHash === v.contentHash && Number(r.decidedAt) <= at && at < Number(r.expiresAt)); }
module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, candidate: candidate, validateCandidate: validateCandidate, validCognition: validCognition,
  key: key, decide: decide, validateReceipt: validateReceipt };
