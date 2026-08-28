'use strict';

var crypto = require('node:crypto');
var Decision = require('./agriculture-homestead-decision.js');
var Executor = require('./agriculture-homestead-executor.js');

var SCHEMA = 'agriculture-homestead-observation/1.0';
var LOG_KEY = 'agriculture_homestead_observation_log';
var PREFIX = 'agriculture_homestead_observation:';
function key(id) { return PREFIX + id; }
function actionFromRecipients(recipients) { var list = Array.isArray(recipients) ? recipients : []; for (var i = 0; i < list.length; i++) { var match = String(list[i]).toLowerCase().match(/homestead\+(aha_[a-f0-9]{24})@/); if (match) return match[1]; } return null; }
async function record(store, event) {
  if (!event || event.type !== 'email.received' || !event.data) return { ok: false, status: 'REFUSED', reason: 'verified-email-received-event-required', sendEndpointCalled: false };
  var data = event.data, actionId = actionFromRecipients(data.to), inboundId = String(data.email_id || '');
  if (!actionId || !inboundId || !data.from) return { ok: false, status: 'REFUSED', reason: 'action-address-email-id-and-sender-required', sendEndpointCalled: false };
  var action = await store.get(Executor.actionKey(actionId));
  if (!action || action.status !== 'ACCEPTED') return { ok: false, status: 'REFUSED', reason: 'accepted-property-operation-command-required', sendEndpointCalled: false };
  var command = await store.get(Executor.commandKey(action.commandId));
  if (!command || command.status !== 'ACCEPTED' || command.providerEmailHash !== Decision.hash(String(data.from).toLowerCase())) return { ok: false, status: 'REFUSED', reason: 'counterparty-sender-does-not-match-command', sendEndpointCalled: false };
  var observation = { schemaVersion: SCHEMA,
    observationId: 'aho_' + crypto.createHash('sha256').update(inboundId + ':' + actionId).digest('hex').slice(0, 24),
    commandId: command.commandId, actionId: actionId, providerInboundEmailId: inboundId,
    providerEmailHash: command.providerEmailHash, propertyRefHash: command.propertyRefHash,
    status: 'COUNTERPARTY_RESPONSE_OBSERVED', sourceEventType: 'email.received',
    sourceEventCreatedAt: event.created_at || data.created_at || null, independentOfSendResponse: true,
    webhookSignatureVerified: true, sendEndpointCalled: false, observedAt: Date.now(), liveMoney: false };
  var created = await store.setIfAbsent(key(inboundId), observation), restored = await store.get(key(inboundId));
  if (!restored || restored.observationId !== observation.observationId) throw new Error('agriculture homestead observation readback invalid');
  if (created) { await store.lpush(LOG_KEY, restored); await store.ltrim(LOG_KEY, 0, 1999); }
  return Object.assign({ ok: true, duplicate: !created }, restored);
}
module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, key: key, actionFromRecipients: actionFromRecipients, record: record };
