'use strict';

var crypto = require('node:crypto');
var Decision = require('./population-real-estate-decision.js');
var Executor = require('./population-real-estate-executor.js');

var SCHEMA = 'population-real-estate-observation/1.0';
var LOG_KEY = 'population_real_estate_observation_log';
var PREFIX = 'population_real_estate_observation:';
function key(id) { return PREFIX + id; }
function actionFromRecipients(recipients) { var list = Array.isArray(recipients) ? recipients : []; for (var i = 0; i < list.length; i++) { var match = String(list[i]).toLowerCase().match(/realestate\+(pra_[a-f0-9]{24})@/); if (match) return match[1]; } return null; }
async function record(store, event, verification) {
  if (!verification || verification.webhookSignatureVerified !== true) return { ok: false, status: 'REFUSED', reason: 'verified-webhook-context-required', sendEndpointCalled: false };
  if (!event || event.type !== 'email.received' || !event.data) return { ok: false, status: 'REFUSED', reason: 'verified-email-received-event-required', sendEndpointCalled: false };
  var data = event.data, actionId = actionFromRecipients(data.to), inboundId = String(data.email_id || '');
  if (!actionId || !inboundId || !data.from) return { ok: false, status: 'REFUSED', reason: 'action-address-email-id-and-sender-required', sendEndpointCalled: false };
  var action = await store.get(Executor.actionKey(actionId));
  if (!action || action.status !== 'INQUIRY_ACCEPTED') return { ok: false, status: 'REFUSED', reason: 'accepted-non-binding-property-inquiry-required', sendEndpointCalled: false };
  var command = await store.get(Executor.commandKey(action.commandId));
  if (!command || command.status !== 'INQUIRY_ACCEPTED' || command.counterpartyEmailHash !== Decision.hash(String(data.from).toLowerCase())) return { ok: false, status: 'REFUSED', reason: 'counterparty-sender-does-not-match-command', sendEndpointCalled: false };
  var sourceCreatedAt = event.created_at || data.created_at || null, sourceAt = Date.parse(sourceCreatedAt), observedAt = Date.now();
  if (command.schemaVersion !== Executor.SCHEMA || command.productDomain !== 'population' ||
      command.ownerDomain !== 'population' || command.lane !== 'real-estate' || command.actionId !== actionId ||
      command.commandId !== action.commandId || command.readbackVerified !== true || command.nonBinding !== true ||
      command.contractAuthorized !== false || command.earnestMoneyAuthorized !== false || command.fundsTransferAuthorized !== false ||
      command.liveMoney !== false || !Number.isFinite(command.commandedAt) || !Number.isFinite(sourceAt) ||
      sourceAt < command.commandedAt || sourceAt > observedAt) return { ok: false, status: 'REFUSED', reason: 'population-real-estate-reply-command-join-invalid', sendEndpointCalled: false };
  var observation = { schemaVersion: SCHEMA,
    observationId: 'pro_' + crypto.createHash('sha256').update(inboundId + ':' + actionId).digest('hex').slice(0, 24),
    commandId: command.commandId, actionId: actionId, providerInboundEmailId: inboundId,
    counterpartyEmailHash: command.counterpartyEmailHash, propertyRefHash: command.propertyRefHash,
    listingUrlHash: command.listingUrlHash, indicationPriceUsd: command.indicationPriceUsd,
    status: 'COUNTERPARTY_RESPONSE_OBSERVED', sourceEventType: 'email.received',
    sourceEventCreatedAt: sourceCreatedAt, independentOfSendResponse: true,
    webhookSignatureVerified: true, sendEndpointCalled: false, observedAt: observedAt, liveMoney: false };
  var created = await store.setIfAbsent(key(inboundId), observation), restored = await store.get(key(inboundId));
  if (!restored || Object.keys(observation).some(function (field) { return field !== 'observedAt' && restored[field] !== observation[field]; })) throw new Error('population real-estate observation readback invalid');
  if (created) { await store.lpush(LOG_KEY, restored); await store.ltrim(LOG_KEY, 0, 1999); }
  return Object.assign({ ok: true, duplicate: !created }, restored);
}
module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, key: key, actionFromRecipients: actionFromRecipients, record: record };
