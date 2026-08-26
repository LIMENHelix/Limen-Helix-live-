'use strict';
var crypto = require('node:crypto'), Executor = require('./intelligence-autopilot-executor.js');
var SCHEMA = 'intelligence-autopilot-observation/1.0', LOG_KEY = 'intelligence_autopilot_observation_log', PREFIX = 'intelligence_autopilot_observation:';
function key(id) { return PREFIX + id; } var TERMINAL = { delivered: true, bounced: true, complained: true, failed: true, suppressed: true, canceled: true };
async function observe(store, command, deps) { deps = deps || {}; if (!command || command.schemaVersion !== Executor.SCHEMA || command.status !== 'ACCEPTED' || !command.providerEmailId) return { ok: false, status: 'REFUSED', reason: 'accepted-provider-receipt-required', sendEndpointCalled: false };
  var apiKey = deps.apiKey || process.env.RESEND_API_KEY; if (!apiKey) return { ok: true, status: 'OBSERVATION_PENDING', reason: 'resend-read-credential-unavailable', actionId: command.actionId, sendEndpointCalled: false };
  var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, 15000), response;
  try { response = await (deps.fetch || fetch)('https://api.resend.com/emails/' + encodeURIComponent(command.providerEmailId), { method: 'GET', signal: controller.signal, headers: { authorization: 'Bearer ' + apiKey, accept: 'application/json', 'user-agent': 'limen-helix/1.0' } }); }
  catch (_) { return { ok: true, status: 'OBSERVATION_PENDING', reason: 'resend-read-unreachable', actionId: command.actionId, sendEndpointCalled: false }; } finally { clearTimeout(timer); }
  var body = await response.json().catch(function () { return null; }); if (!response.ok || !body || body.id !== command.providerEmailId) return { ok: true, status: 'OBSERVATION_PENDING', reason: 'resend-read-not-authoritative', actionId: command.actionId, httpStatus: response.status, sendEndpointCalled: false };
  var event = String(body.last_event || 'unknown').toLowerCase(), receipt = { schemaVersion: SCHEMA,
    observationId: 'iao_' + crypto.createHash('sha256').update(command.providerEmailId + ':' + event + ':' + String(body.created_at || '')).digest('hex').slice(0, 24),
    commandId: command.commandId, actionId: command.actionId, providerEmailId: command.providerEmailId, emailHash: command.emailHash, subjectDomain: command.subjectDomain,
    status: TERMINAL[event] ? 'TERMINAL_OBSERVED' : 'PENDING_OBSERVED', lastEvent: event, providerRecordCreatedAt: body.created_at || null,
    independentOfSendResponse: true, sendEndpointCalled: false, observedAt: Date.now(), liveMoney: false };
  await store.set(key(command.providerEmailId), receipt); var restored = await store.get(key(command.providerEmailId)); if (!restored || restored.observationId !== receipt.observationId) throw new Error('intelligence autopilot observation readback invalid');
  await store.lpush(LOG_KEY, restored); await store.ltrim(LOG_KEY, 0, 1999); return restored; }
async function observeRecent(store, commands, deps) { var out = []; for (var i = 0; i < (commands || []).length; i++) if (commands[i] && commands[i].status === 'ACCEPTED') out.push(await observe(store, commands[i], deps)); return out; }
module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, TERMINAL: TERMINAL, key: key, observe: observe, observeRecent: observeRecent };
