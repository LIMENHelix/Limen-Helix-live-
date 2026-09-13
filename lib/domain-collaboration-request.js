'use strict';

/**
 * Durable typed requests between sovereign domain brains.
 *
 * A source domain may OFFER work to a target domain only from a fresh,
 * server-built Governor briefing. The request is afferent input for the target;
 * it is not acceptance, authority, a transfer, or an external action. The target
 * must make its own B10/B14 decision under its own budget and motor contract.
 */

var crypto = require('node:crypto');
var Names = require('./domain-names.js');
var Briefing = require('./master-briefing-packet.js');

var SCHEMA = 'domain-collaboration-request/1.0';
var PREFIX = 'domain_collaboration_request:';
var INBOX_PREFIX = 'domain_collaboration_inbox:';
var LOG_KEY = 'domain_collaboration_request_log';
var MAX_TTL_MS = 6 * 60 * 60 * 1000;
var MAX_INBOX = 100;

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function canonical(value) {
  return Names.toCanonical(String(value || '')).toLowerCase();
}

function text(value, max) {
  var result = typeof value === 'string' ? value.trim() : '';
  if (!result) return null;
  return result.slice(0, max || 500);
}

function cents(value) {
  var amount = Number(value == null ? 0 : value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

function validateInput(input, now) {
  var from = canonical(input && input.fromDomain);
  var to = canonical(input && input.toDomain);
  var expiresAt = Number(input && input.expiresAt || now + MAX_TTL_MS);
  if (Briefing.DOMAINS.indexOf(from) < 0 || Briefing.DOMAINS.indexOf(to) < 0 || from === to) {
    return { ok: false, reason: 'collaboration-domain-pair-invalid' };
  }
  var idempotencyKey = text(input.idempotencyKey, 240);
  var purpose = text(input.purpose, 180);
  var requestedService = text(input.requestedService, 500);
  var expectedOutcome = text(input.expectedOutcome, 500);
  var evidenceIds = Array.isArray(input.evidenceIds)
    ? input.evidenceIds.map(function (value) { return text(String(value || ''), 240); }).filter(Boolean).slice(0, 20)
    : [];
  var offered = cents(input.offeredCents);
  var requested = cents(input.requestedBudgetCents);
  if (!idempotencyKey || !purpose || !requestedService || !expectedOutcome || !evidenceIds.length) {
    return { ok: false, reason: 'collaboration-contract-incomplete' };
  }
  if (offered === null || requested === null) return { ok: false, reason: 'collaboration-economics-invalid' };
  if (!Number.isFinite(expiresAt) || expiresAt <= now || expiresAt > now + MAX_TTL_MS) {
    return { ok: false, reason: 'collaboration-expiry-invalid' };
  }
  return {
    ok: true,
    value: {
      fromDomain: from,
      toDomain: to,
      idempotencyKey: idempotencyKey,
      purpose: purpose,
      requestedService: requestedService,
      expectedOutcome: expectedOutcome,
      evidenceIds: evidenceIds,
      offeredCents: offered,
      requestedBudgetCents: requested,
      expiresAt: expiresAt
    }
  };
}

function groundingValid(result, domain) {
  var packet = result && result.packet;
  return !!(result && result.ok && packet && packet.schemaVersion === 'domain-governor-briefing/1.0' &&
    packet.domainId === domain && packet.packetId && packet.sourcePacketId && packet.readiness &&
    packet.readiness.canReason === true && packet.truthPolicy &&
    packet.truthPolicy.modelNarrativeCannotGrantAuthority === true);
}

async function propose(store, input, options) {
  options = options || {};
  var now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
  var valid = validateInput(input || {}, now);
  if (!valid.ok) return valid;
  if (!store || typeof store.assertDurable !== 'function') return { ok: false, reason: 'strict-durable-store-required' };
  store.assertDurable();
  var buildGrounding = options.buildGrounding || function (domain, buildOptions) {
    return require('./domain-governor-briefing.js').build(domain, buildOptions);
  };
  var grounded = await buildGrounding(valid.value.fromDomain, {
    store: store,
    env: options.env || process.env,
    now: now,
    db: options.db,
    redisMGet: options.redisMGet
  });
  if (!groundingValid(grounded, valid.value.fromDomain)) {
    return { ok: false, reason: 'source-domain-grounding-not-actionable' };
  }
  var body = {
    schemaVersion: SCHEMA,
    status: 'OFFERED',
    fromDomain: valid.value.fromDomain,
    toDomain: valid.value.toDomain,
    purpose: valid.value.purpose,
    requestedService: valid.value.requestedService,
    expectedOutcome: valid.value.expectedOutcome,
    evidenceIds: valid.value.evidenceIds,
    offeredCents: valid.value.offeredCents,
    requestedBudgetCents: valid.value.requestedBudgetCents,
    sourceGovernorPacketId: grounded.packet.packetId,
    sourceCivilizationPacketId: grounded.packet.sourcePacketId,
    idempotencyKey: valid.value.idempotencyKey,
    targetDecisionRequired: true,
    targetAuthorityBorrowed: false,
    targetBrainMutationAllowed: false,
    fundsCommitted: false,
    moneyMoved: false,
    externalEffectExecuted: false,
    createdAt: now,
    expiresAt: valid.value.expiresAt
  };
  body.contractHash = hash({
    fromDomain: body.fromDomain,
    toDomain: body.toDomain,
    purpose: body.purpose,
    requestedService: body.requestedService,
    expectedOutcome: body.expectedOutcome,
    evidenceIds: body.evidenceIds,
    offeredCents: body.offeredCents,
    requestedBudgetCents: body.requestedBudgetCents,
    expiresAt: body.expiresAt
  });
  body.requestId = 'dcr_' + hash({
    fromDomain: body.fromDomain,
    toDomain: body.toDomain,
    idempotencyKey: body.idempotencyKey
  }).slice(0, 24);
  var key = PREFIX + body.requestId;
  var created = await store.setIfAbsent(key, body, Math.ceil((body.expiresAt - now) / 1000));
  var restored = await store.get(key);
  if (restored && restored.contractHash !== body.contractHash) {
    return { ok: false, reason: 'collaboration-idempotency-conflict', requestId: body.requestId };
  }
  if (!restored || restored.requestId !== body.requestId || restored.status !== 'OFFERED' ||
      restored.fromDomain !== body.fromDomain || restored.toDomain !== body.toDomain) {
    throw new Error('domain collaboration request readback invalid');
  }
  if (created) {
    await store.lpush(INBOX_PREFIX + body.toDomain, {
      requestId: body.requestId,
      fromDomain: body.fromDomain,
      createdAt: body.createdAt,
      expiresAt: body.expiresAt
    });
    await store.ltrim(INBOX_PREFIX + body.toDomain, 0, MAX_INBOX - 1);
    await store.lpush(LOG_KEY, {
      requestId: body.requestId,
      fromDomain: body.fromDomain,
      toDomain: body.toDomain,
      status: body.status,
      createdAt: body.createdAt
    });
    await store.ltrim(LOG_KEY, 0, 499);
  }
  return { ok: true, created: created, request: restored };
}

async function inbox(store, domain, now) {
  var id = canonical(domain);
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  if (Briefing.DOMAINS.indexOf(id) < 0) return { ok: false, reason: 'unknown-product-domain', requests: [] };
  if (!store || typeof store.assertDurable !== 'function') return { ok: false, reason: 'strict-durable-store-required', requests: [] };
  store.assertDurable();
  var refs = await store.lrange(INBOX_PREFIX + id, 0, MAX_INBOX - 1);
  var requests = [];
  var seen = Object.create(null);
  for (var i = 0; i < (refs || []).length; i++) {
    var requestId = refs[i] && refs[i].requestId;
    if (!requestId || seen[requestId]) continue;
    seen[requestId] = true;
    var row = await store.get(PREFIX + requestId);
    if (!row || row.schemaVersion !== SCHEMA || row.toDomain !== id || row.status !== 'OFFERED') continue;
    if (Number(row.expiresAt) <= at) continue;
    if (row.targetAuthorityBorrowed !== false || row.targetBrainMutationAllowed !== false ||
        row.fundsCommitted !== false || row.moneyMoved !== false || row.externalEffectExecuted !== false) continue;
    requests.push(row);
  }
  return { ok: true, domainId: id, requests: requests };
}

module.exports = {
  SCHEMA: SCHEMA,
  PREFIX: PREFIX,
  INBOX_PREFIX: INBOX_PREFIX,
  LOG_KEY: LOG_KEY,
  MAX_TTL_MS: MAX_TTL_MS,
  propose: propose,
  inbox: inbox,
  validateInput: validateInput,
  groundingValid: groundingValid
};
