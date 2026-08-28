'use strict';

/** Read-only Resend retrieval of mail-server outcome; separate from the send response. */
var crypto = require('node:crypto');
var Executor = require('./finance-subscriber-executor.js');
var SCHEMA = 'finance-subscriber-observation/1.0';
var LOG_KEY = 'finance_subscriber_observation_log', PREFIX = 'finance_subscriber_observation:';
var TERMINAL = { delivered: true, bounced: true, complained: true, failed: true, suppressed: true, canceled: true };
function key(providerId) { return PREFIX + providerId; }
async function observe(store, command, item, deps) {
  deps = deps || {};
  if (!command || command.schemaVersion !== Executor.SCHEMA || !item || item.status !== 'ACCEPTED' || !item.providerEmailId) return { ok: false, status: 'REFUSED', reason: 'accepted-provider-receipt-required', sendProviderCalled: false, liveMoney: false };
  var apiKey = deps.apiKey || process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: true, status: 'OBSERVATION_PENDING', reason: 'resend-read-credential-unavailable', actionId: item.actionId, sendProviderCalled: false, liveMoney: false };
  var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, 15000), response;
  try { response = await (deps.fetch || fetch)('https://api.resend.com/emails/' + encodeURIComponent(item.providerEmailId), {
    method: 'GET', signal: controller.signal, headers: { authorization: 'Bearer ' + apiKey, accept: 'application/json', 'user-agent': 'limen-helix/1.0' }
  }); } catch (_) { return { ok: true, status: 'OBSERVATION_PENDING', reason: 'resend-read-unreachable', actionId: item.actionId, sendProviderCalled: false, liveMoney: false }; }
  finally { clearTimeout(timer); }
  var body = await response.json().catch(function () { return null; });
  if (!response.ok || !body || body.id !== item.providerEmailId) return { ok: true, status: 'OBSERVATION_PENDING', reason: 'resend-read-not-authoritative', actionId: item.actionId, httpStatus: response.status, sendProviderCalled: false, liveMoney: false };
  var event = String(body.last_event || 'unknown').toLowerCase();
  var receipt = { schemaVersion: SCHEMA, observationId: 'fso_' + crypto.createHash('sha256').update(item.providerEmailId + ':' + event + ':' + String(body.created_at || '')).digest('hex').slice(0, 24),
    commandId: command.commandId, actionId: item.actionId, providerEmailId: item.providerEmailId, emailHash: item.emailHash,
    status: TERMINAL[event] ? 'TERMINAL_OBSERVED' : 'PENDING_OBSERVED', lastEvent: event,
    providerRecordCreatedAt: body.created_at || null, independentOfSendResponse: true,
    mailServerFeedback: event === 'delivered' || event === 'bounced' || event === 'complained' || event === 'delivery_delayed',
    sendEndpointCalled: false, observedAt: Date.now(), liveMoney: false };
  await store.set(key(item.providerEmailId), receipt); var restored = await store.get(key(item.providerEmailId));
  if (!restored || restored.observationId !== receipt.observationId || restored.lastEvent !== event) throw new Error('finance subscriber observation readback invalid');
  await store.lpush(LOG_KEY, restored); await store.ltrim(LOG_KEY, 0, 1999); return restored;
}
async function observeRecent(store, commands, deps) {
  var rows = [], list = Array.isArray(commands) ? commands : [];
  for (var i = 0; i < list.length; i++) for (var j = 0; j < (list[i].items || []).length; j++) {
    if (list[i].items[j] && list[i].items[j].status === 'ACCEPTED') rows.push(await observe(store, list[i], list[i].items[j], deps));
  }
  return rows;
}
module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, TERMINAL: TERMINAL, key: key, observe: observe, observeRecent: observeRecent };
