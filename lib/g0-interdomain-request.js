'use strict';

/**
 * Typed durable cross-domain requests. No shared consciousness.
 * One domain may ask another for a bounded value; it may not overwrite
 * the other domain's brain. Outcomes return separately to each owner.
 */

var crypto = require('node:crypto');

var SCHEMA = 'g0-interdomain-request/1.0';
var PREFIX = 'g0_interdomain_request:';
var LOG_KEY = 'g0_interdomain_request_log';
var INBOX = 'g0_interdomain_inbox:';
var MAX_TTL_MS = 6 * 60 * 60 * 1000;

function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function text(value) { return typeof value === 'string' && value.trim() ? value.trim() : null; }

function seal(input) {
  input = input || {};
  var fromDomain = text(input.fromDomain);
  var toDomain = text(input.toDomain);
  var purpose = text(input.purpose);
  var requestedValue = text(input.requestedValue);
  var expectedOutcome = text(input.expectedOutcome);
  var provenance = text(input.provenance);
  var now = Number.isFinite(Number(input.now)) ? Number(input.now) : Date.now();
  var expiresAt = Number.isFinite(Number(input.expiresAt)) ? Number(input.expiresAt) : now + MAX_TTL_MS;
  var costUsd = Number(input.costUsd);
  if (!fromDomain || !toDomain || fromDomain === toDomain) return { ok: false, reason: 'interdomain-parties-invalid' };
  if (!purpose || !requestedValue || !expectedOutcome || !provenance) {
    return { ok: false, reason: 'interdomain-fields-incomplete' };
  }
  if (!Number.isFinite(costUsd) || costUsd < 0) return { ok: false, reason: 'interdomain-cost-invalid' };
  if (expiresAt <= now) return { ok: false, reason: 'interdomain-expired' };
  var body = {
    schemaVersion: SCHEMA,
    fromDomain: fromDomain,
    toDomain: toDomain,
    purpose: purpose,
    requestedValue: requestedValue,
    expectedOutcome: expectedOutcome,
    provenance: provenance,
    costUsd: costUsd,
    expiresAt: expiresAt,
    sharedConsciousness: false,
    overwritesForeignBrain: false,
    status: 'OPEN',
    createdAt: now,
    liveMoney: false
  };
  body.requestId = 'g0r_' + hash(body).slice(0, 24);
  return { ok: true, request: body };
}

async function persist(store, request) {
  if (!request || request.schemaVersion !== SCHEMA) return { ok: false, reason: 'interdomain-request-invalid' };
  store.assertDurable();
  var key = PREFIX + request.requestId;
  var created = await store.setIfAbsent(key, request);
  var restored = await store.get(key);
  if (!restored || restored.requestId !== request.requestId) throw new Error('interdomain request readback invalid');
  if (created) {
    await store.lpush(INBOX + request.toDomain, { requestId: request.requestId, fromDomain: request.fromDomain, createdAt: request.createdAt });
    await store.ltrim(INBOX + request.toDomain, 0, 99);
    await store.lpush(LOG_KEY, { requestId: request.requestId, fromDomain: request.fromDomain, toDomain: request.toDomain, createdAt: request.createdAt });
    await store.ltrim(LOG_KEY, 0, 199);
  }
  return { ok: true, request: restored, duplicate: !created };
}

async function inbox(store, domain, now) {
  store.assertDurable();
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  var refs = await store.lrange(INBOX + String(domain || ''), 0, 31);
  var out = [];
  for (var i = 0; i < (refs || []).length; i++) {
    var row = await store.get(PREFIX + (refs[i] && refs[i].requestId));
    if (!row || row.schemaVersion !== SCHEMA) continue;
    if (row.toDomain !== domain) continue;
    if (Number(row.expiresAt) <= at) continue;
    if (row.sharedConsciousness === true || row.overwritesForeignBrain === true) continue;
    out.push(row);
  }
  return out;
}

module.exports = { SCHEMA: SCHEMA, PREFIX: PREFIX, LOG_KEY: LOG_KEY, INBOX: INBOX, seal: seal, persist: persist, inbox: inbox };
