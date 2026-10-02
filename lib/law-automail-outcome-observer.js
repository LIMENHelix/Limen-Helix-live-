'use strict';
var crypto = require('node:crypto');
var Executor = require('./law-automail-executor.js');
var SCHEMA = 'law-automail-observation/1.0', LOG_KEY = 'law_automail_observation_log', PREFIX = 'law_automail_observation:';
function key(id) { return PREFIX + id; } function auth(apiKey) { return 'Basic ' + Buffer.from(apiKey + ':').toString('base64'); }
async function readLetter(id, apiKey, fetcher) { var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, 15000);
  try { var response = await fetcher('https://api.lob.com/v1/letters/' + encodeURIComponent(id), { method: 'GET', signal: controller.signal,
      headers: { authorization: auth(apiKey), accept: 'application/json', 'user-agent': 'limen-helix/1.0' } });
    var body = await response.json().catch(function () { return null; }); return { response: response, body: body };
  } finally { clearTimeout(timer); } }
async function observe(store, command, deps) { deps = deps || {};
  if (!command || command.schemaVersion !== Executor.SCHEMA || command.status !== 'ACCEPTED' || !command.providerLetterId) return { ok: false, status: 'REFUSED', reason: 'accepted-lob-letter-receipt-required', createEndpointCalled: false, liveMoney: false };
  var apiKey = deps.apiKey || process.env.LOB_API_KEY; if (!apiKey) return { ok: true, status: 'OBSERVATION_PENDING', reason: 'lob-read-credential-unavailable', actionId: command.actionId, createEndpointCalled: false, liveMoney: false };
  var read; try { read = await readLetter(command.providerLetterId, apiKey, deps.fetch || fetch); } catch (_) { return { ok: true, status: 'OBSERVATION_PENDING', reason: 'lob-read-unreachable', actionId: command.actionId, createEndpointCalled: false, liveMoney: false }; }
  if (!read.response.ok || !read.body || read.body.id !== command.providerLetterId) return { ok: true, status: 'OBSERVATION_PENDING', reason: 'lob-read-not-authoritative', actionId: command.actionId, httpStatus: read.response.status, createEndpointCalled: false, liveMoney: false };
  var state = read.body.deleted ? 'deleted' : String(read.body.status || 'accepted').toLowerCase();
  var receipt = { schemaVersion: SCHEMA, observationId: 'lao_' + crypto.createHash('sha256').update(command.commandId + ':' + command.actionId + ':' + command.providerLetterId + ':' + state + ':' + String(read.body.date_modified || '')).digest('hex').slice(0, 24),
    commandId: command.commandId, actionId: command.actionId, providerLetterId: command.providerLetterId, status: state === 'failed' || state === 'deleted' ? 'TERMINAL_OBSERVED' : 'PROVIDER_STATE_OBSERVED',
    providerState: state, expectedDeliveryDate: read.body.expected_delivery_date || null, sendDate: read.body.send_date || null,
    providerCreatedAt: read.body.date_created || null, providerModifiedAt: read.body.date_modified || null,
    independentOfCreateResponse: true, readMethod: 'GET', createEndpointCalled: false, observedAt: Date.now(), liveMoney: command.liveMoney === true };
  var created = await store.setIfAbsent(key(receipt.observationId), receipt), restored = await store.get(key(receipt.observationId));
  if (!restored || Object.keys(receipt).some(function (field) { return field !== 'observedAt' && restored[field] !== receipt[field]; })) throw new Error('law automail observation readback invalid');
  await store.set(key(command.providerLetterId), restored);
  if (JSON.stringify(await store.get(key(command.providerLetterId))) !== JSON.stringify(restored)) throw new Error('law automail latest observation readback invalid');
  if (created) { await store.lpush(LOG_KEY, restored); await store.ltrim(LOG_KEY, 0, 1999); } return restored; }
async function observeRecent(store, commands, deps) { var out = [], rows = Array.isArray(commands) ? commands : [];
  for (var i = 0; i < rows.length; i++) if (rows[i] && rows[i].status === 'ACCEPTED') out.push(await observe(store, rows[i], deps)); return out; }
module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, key: key, readLetter: readLetter, observe: observe, observeRecent: observeRecent };
