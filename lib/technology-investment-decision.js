'use strict';

var crypto = require('node:crypto');
var SCHEMA = 'technology-investment-decision/1.0';
var CANDIDATE_SCHEMA = 'technology-investment-candidate/1.0';
var LOG_KEY = 'technology_investment_decision_log';
var PREFIX = 'technology_investment_decision:';
var MAX_BRAIN_AGE_MS = 45 * 60 * 1000;
var MAX_FEED_AGE_MS = 24 * 60 * 60 * 1000;
var MAX_DECISION_AGE_MS = 10 * 60 * 1000;

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function text(value, max) { value = typeof value === 'string' ? value.trim() : ''; return value ? value.slice(0, max || 4000) : null; }
function key(id) { return PREFIX + id; }
function https(value) { try { return new URL(String(value)).protocol === 'https:'; } catch (_) { return false; } }
function symbol(value) { value = String(value || '').trim().toUpperCase(); return /^[A-Z][A-Z0-9.\-]{0,9}$/.test(value) ? value : null; }
function source(value) {
  var at = Date.parse(value && value.recordedAt);
  if (!value || !text(value.title, 800) || !https(value.url) || !text(value.feedName, 200) || !Number.isFinite(at)) return null;
  return { title: text(value.title, 800), url: String(value.url), feedName: text(value.feedName, 200), recordedAt: new Date(at).toISOString() };
}
function candidate(input) {
  input = input || {};
  var requestId = text(input.requestId, 160), ticker = symbol(input.symbol), issuer = text(input.issuerName, 300);
  var side = String(input.side || '').toLowerCase(), maxNotional = Number(input.maxNotionalUsd), risk = Number(input.riskLimitPct);
  var evidence = (Array.isArray(input.feedEvidence) ? input.feedEvidence : []).map(source).filter(Boolean).slice(0, 12);
  var feeds = Object.create(null); evidence.forEach(function (row) { feeds[row.feedName] = true; });
  if (!requestId || !ticker || !issuer || ['buy', 'sell_short'].indexOf(side) < 0 || !Number.isFinite(maxNotional) || maxNotional <= 0 ||
      !Number.isFinite(risk) || risk < 0 || risk > 100 || !text(input.brainOpportunityId, 320) || !text(input.thesisId, 320) ||
      evidence.length < 2 || Object.keys(feeds).length < 2 || input.paperOnly !== true || input.liveMoney !== false) return null;
  return {
    schemaVersion: CANDIDATE_SCHEMA, productDomain: 'technology', ownerDomain: 'technology', lane: 'investments',
    requestId: requestId, symbol: ticker, issuerName: issuer, side: side, maxNotionalUsd: maxNotional,
    riskLimitPct: risk, benchmarkSymbol: symbol(input.benchmarkSymbol) || 'SPY', thesisId: text(input.thesisId, 320),
    brainOpportunityId: text(input.brainOpportunityId, 320), feedEvidence: evidence,
    evidenceHash: hash(evidence), paperOnly: true, liveMoney: false
  };
}
function validate(value) {
  return !!(value && value.schemaVersion === CANDIDATE_SCHEMA && value.productDomain === 'technology' && value.ownerDomain === 'technology' &&
    value.lane === 'investments' && text(value.requestId) && symbol(value.symbol) && text(value.issuerName) &&
    ['buy', 'sell_short'].indexOf(value.side) >= 0 && Number.isFinite(value.maxNotionalUsd) && value.maxNotionalUsd > 0 &&
    Number.isFinite(value.riskLimitPct) && value.riskLimitPct >= 0 && value.riskLimitPct <= 100 && symbol(value.benchmarkSymbol) &&
    text(value.thesisId) && text(value.brainOpportunityId) && Array.isArray(value.feedEvidence) && value.feedEvidence.length >= 2 &&
    value.feedEvidence.every(source) && value.evidenceHash === hash(value.feedEvidence) && value.paperOnly === true && value.liveMoney === false);
}
function validBrain(envelope, now) {
  var cognition = envelope && envelope.c, ts = Number(envelope && envelope.ts), packet = cognition && cognition.serverPacket;
  var generated = Date.parse(packet && packet.generatedAt);
  return !!(cognition && cognition.domain === 'technology' && Number.isFinite(ts) && now >= ts && now - ts <= MAX_BRAIN_AGE_MS &&
    packet && packet.schemaVersion === 'civilization-domain-packet/1.0' && packet.domainId === 'technology' &&
    packet.sourceIdentity && packet.sourceIdentity.producer === 'brain-cognition-refresh/1' && Number.isFinite(generated) && now >= generated && now - generated <= MAX_BRAIN_AGE_MS);
}
function feedMatches(titleSets, value, now) {
  var matched = [], feeds = Object.create(null), rows = Array.isArray(titleSets) ? titleSets : [];
  value.feedEvidence.forEach(function (wanted) {
    var found = false;
    rows.forEach(function (set) {
      var recorded = Number(set && set.t);
      if (found || !set || set.d !== 'technology' || !Number.isFinite(recorded) || now < recorded || now - recorded > MAX_FEED_AGE_MS || !Array.isArray(set.items)) return;
      set.items.forEach(function (item) {
        if (found || !item || item.tr === true) return;
        if (String(item.au || '') === wanted.url && String(item.ti || '').trim() === wanted.title && String(set.f || '') === wanted.feedName) {
          found = true; matched.push(wanted); feeds[wanted.feedName] = true;
        }
      });
    });
  });
  return { ok: matched.length >= 2 && Object.keys(feeds).length >= 2, matched: matched.length, distinctFeeds: Object.keys(feeds).length };
}
async function persist(store, receipt) {
  var made = await store.setIfAbsent(key(receipt.decisionReceiptId), receipt), restored = await store.get(key(receipt.decisionReceiptId));
  if (!restored || restored.actionId !== receipt.actionId || restored.status !== receipt.status) throw new Error('technology investment decision readback invalid');
  if (made) { await store.lpush(LOG_KEY, restored); await store.ltrim(LOG_KEY, 0, 999); }
  return restored;
}
async function decide(store, value, now, deps) {
  var at = Number(now) || Date.now(), blockers = [];
  if (!validate(value)) return { ok: true, status: 'NO_ACTION', reason: 'technology-investment-candidate-invalid', blockers: ['exact-paper-investment-record-required'], liveMoney: false };
  try {
    store.assertDurable();
    var envelope = deps && deps.cognition, titleSets = deps && deps.titleSets;
    if (!validBrain(envelope, at)) blockers.push('technology-brain-state-missing-or-stale');
    var cognition = envelope && envelope.c || {}, packet = cognition.serverPacket || {}, organs = cognition.brainOrgans || {};
    if (!blockers.length) {
      if ((cognition.immune || {}).immuneState !== 'clear') blockers.push('technology-immune-veto');
      if ((cognition.awareness || {}).humanReviewRequired === true) blockers.push('technology-human-review-veto');
      var emission = organs.autonomousInternalEmission || {};
      if (emission.holdReason) blockers.push('technology-b10-brake-held:' + emission.holdReason);
      if (!(Number(emission.emittedCount) > 0)) blockers.push('technology-b10-no-action-selected');
      if (!(Number(packet.truth && packet.truth.feedHealth && packet.truth.feedHealth.live) > 0)) blockers.push('technology-live-feeds-unavailable');
      var opportunity = (packet.truth && Array.isArray(packet.truth.opportunities) ? packet.truth.opportunities : []).find(function (row) {
        return row && String(row.id) === value.brainOpportunityId && row.path === 'INVESTABLE' && row.held !== true;
      });
      if (!opportunity) blockers.push('technology-exact-investable-opportunity-not-selected');
      var feeds = feedMatches(titleSets, value, at);
      if (!feeds.ok) blockers.push('technology-exact-current-feed-evidence-not-confirmed');
      var metabolism = organs.resourceMetabolism || {}, gates = metabolism.gates || {};
      if (metabolism.state !== 'AVAILABLE' || gates.mayRunInternalCycle !== true) blockers.push('technology-resource-metabolism-inhibited');
      var configuredMax = Number(deps && deps.maxNotionalUsd);
      if (!Number.isFinite(configuredMax) || configuredMax <= 0) blockers.push('technology-investment-max-notional-not-configured');
      else if (value.maxNotionalUsd > configuredMax) blockers.push('technology-investment-max-notional-exceeded');
    }
    var actionId = 'tia_' + hash({ request: value.requestId, symbol: value.symbol, side: value.side, thesis: value.thesisId, evidence: value.evidenceHash }).slice(0, 24);
    var status = blockers.length ? 'NO_ACTION' : 'RELEASED';
    return persist(store, {
      schemaVersion: SCHEMA, decisionReceiptId: 'tid_' + hash({ action: actionId, packet: packet.packetId || null, status: status, blockers: blockers }).slice(0, 24),
      actionId: actionId, status: status, released: status === 'RELEASED', reason: blockers.length ? 'technology-b10-held' : null, blockers: blockers,
      productDomain: 'technology', ownerDomain: 'technology', lane: 'investments', decisionContract: 'capital-decision/1',
      requestId: value.requestId, symbol: value.symbol, side: value.side, thesisId: value.thesisId, evidenceHash: value.evidenceHash,
      technologyPacketId: packet.packetId || null, brainOpportunityId: value.brainOpportunityId,
      predictedOutcome: blockers.length ? null : { brokerReceipt: true, horizonsDays: [30, 60, 90], profitClaim: false },
      decidedAt: at, expiresAt: at + MAX_DECISION_AGE_MS, paperOnly: true, liveMoney: false
    });
  } catch (error) {
    return { ok: true, status: 'NO_ACTION', reason: 'technology-b10-unavailable', blockers: ['decision-persistence-or-input-unavailable'], detail: String(error && error.message || error), liveMoney: false };
  }
}
function validateReceipt(receipt, value, now) {
  var at = Number(now) || Date.now();
  return !!(validate(value) && receipt && receipt.schemaVersion === SCHEMA && receipt.status === 'RELEASED' &&
    receipt.actionId === 'tia_' + hash({ request: value.requestId, symbol: value.symbol, side: value.side, thesis: value.thesisId, evidence: value.evidenceHash }).slice(0, 24) &&
    receipt.productDomain === 'technology' && receipt.ownerDomain === 'technology' && receipt.lane === 'investments' &&
    Number(receipt.decidedAt) <= at && at < Number(receipt.expiresAt));
}

module.exports = { SCHEMA: SCHEMA, CANDIDATE_SCHEMA: CANDIDATE_SCHEMA, LOG_KEY: LOG_KEY, key: key, hash: hash, candidate: candidate, validate: validate, validBrain: validBrain, feedMatches: feedMatches, decide: decide, validateReceipt: validateReceipt };
