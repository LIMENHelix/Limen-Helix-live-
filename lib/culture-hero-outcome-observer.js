'use strict';

/** Independent public asset read-back; never calls the image-generation endpoint. */
var crypto = require('node:crypto');
var Executor = require('./culture-hero-executor.js');
var SCHEMA = 'culture-hero-observation/1.0';
var LOG_KEY = 'culture_hero_observation_log';
var PREFIX = 'culture_hero_observation:';
var MAX_IMAGE_BYTES = 10 * 1024 * 1024;
function key(commandId) { return PREFIX + commandId; }
function allowedUrl(value, deps) {
  try {
    var u = new URL(String(value));
    if (deps && deps.allowAnyHttpsForTest === true) return u.protocol === 'https:';
    return u.protocol === 'https:' && (u.hostname === 'x.ai' || u.hostname.endsWith('.x.ai'));
  } catch (_) { return false; }
}
async function observe(store, command, deps) {
  deps = deps || {};
  if (!command || command.schemaVersion !== Executor.SCHEMA || command.status !== 'GENERATED' ||
      !command.receipt || !allowedUrl(command.receipt.url, deps)) {
    return { ok: false, status: 'REFUSED', reason: 'generated-command-receipt-required', providerCalled: false, liveMoney: false };
  }
  var existing = await store.get(key(command.commandId));
  if (existing && existing.status === 'OBSERVED_PRESENT') return existing;
  var fetcher = deps.fetch || fetch, response, controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, 15000);
  try { response = await fetcher(command.receipt.url, { method: 'GET', headers: { 'accept': 'image/*' }, signal: controller.signal }); }
  catch (error) { return { ok: true, status: 'OBSERVATION_PENDING', reason: 'public-asset-read-unreachable', commandId: command.commandId, providerCalled: false, liveMoney: false }; }
  finally { clearTimeout(timer); }
  var type = response && response.headers && response.headers.get ? String(response.headers.get('content-type') || '') : '';
  var declaredLength = Number(response && response.headers && response.headers.get && response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
    return { ok: true, status: 'OBSERVED_INVALID', reason: 'public-asset-over-size-limit', commandId: command.commandId,
      declaredBytes: declaredLength, providerCalled: false, liveMoney: false };
  }
  var bytes = Buffer.from(await response.arrayBuffer());
  var present = response.status >= 200 && response.status < 300 && /^image\//i.test(type) && bytes.length > 0 && bytes.length <= MAX_IMAGE_BYTES;
  var receipt = {
    schemaVersion: SCHEMA, observationId: 'cho_' + crypto.createHash('sha256').update(command.commandId + ':' + String(response.status) + ':' + bytes.length).digest('hex').slice(0, 24),
    commandId: command.commandId, assetDomain: command.assetDomain, status: present ? 'OBSERVED_PRESENT' : 'OBSERVED_ABSENT_OR_INVALID',
    publicUrl: command.receipt.url, httpStatus: response.status, contentType: type, bytes: bytes.length,
    contentSha256: bytes.length ? crypto.createHash('sha256').update(bytes).digest('hex') : null,
    independentReadPath: true, generationEndpointCalled: false, observedAt: Date.now(), providerCalled: false, liveMoney: false
  };
  await store.set(key(command.commandId), receipt);
  var restored = await store.get(key(command.commandId));
  if (!restored || restored.observationId !== receipt.observationId || restored.status !== receipt.status) throw new Error('culture hero observer: receipt readback invalid');
  await store.lpush(LOG_KEY, restored); await store.ltrim(LOG_KEY, 0, 999);
  return restored;
}
async function observeRecent(store, commands, deps) {
  var rows = [], list = Array.isArray(commands) ? commands : [];
  for (var i = 0; i < list.length; i++) if (list[i] && list[i].status === 'GENERATED') rows.push(await observe(store, list[i], deps));
  return rows;
}
module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, MAX_IMAGE_BYTES: MAX_IMAGE_BYTES,
  key: key, allowedUrl: allowedUrl, observe: observe, observeRecent: observeRecent };
