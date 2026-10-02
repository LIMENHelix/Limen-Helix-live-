'use strict';

/** Independent public asset read-back; never calls the image-generation endpoint. */
var crypto = require('node:crypto');
var Executor = require('./culture-hero-executor.js');
var Decision = require('./culture-hero-decision.js');
var Learning = require('./culture-hero-learning.js');
var SCHEMA = 'culture-hero-observation/1.0';
var LOG_KEY = 'culture_hero_observation_log';
var PREFIX = 'culture_hero_observation:';
var MAX_IMAGE_BYTES = 10 * 1024 * 1024;
function key(commandId) { return PREFIX + commandId; }
async function joinedCommand(store, input) {
  var command = input && await store.get(Executor.commandKey(input.commandId));
  if (!command || command.schemaVersion !== Executor.SCHEMA || command.productDomain !== 'culture' || command.ownerDomain !== 'culture' ||
      command.lane !== 'hero-image' || command.status !== 'GENERATED' || command.actionId !== command.commandId || command.liveMoney !== false ||
      command.readbackVerified !== true || command.providerAccepted !== true || !command.receipt || !command.receipt.url ||
      !Number.isFinite(command.commandedAt) || command.commandedAt > Date.now() ||
      !Number.isFinite(command.completedAt) || command.completedAt < command.commandedAt || command.completedAt > Date.now() ||
      ['schemaVersion','commandId','actionId','status','productDomain','ownerDomain','lane','assetDomain','model','promptHash','decisionReceiptId','productMotorReceiptId','commandedAt','completedAt','readbackVerified','providerAccepted','liveMoney'].some(function (field) { return command[field] !== input[field]; }) ||
      JSON.stringify(command.receipt) !== JSON.stringify(input.receipt)) return null;
  var decision = await store.get(Decision.key(command.decisionReceiptId)), cause = await store.get(Learning.causeKey(command.commandId));
  var motor = await store.get(Executor.motorClaimKey(command.productMotorReceiptId));
  if (!decision || decision.schemaVersion !== Decision.SCHEMA || decision.status !== 'RELEASED' || decision.released !== true ||
      decision.productDomain !== 'culture' || decision.ownerDomain !== 'culture' || decision.lane !== 'hero-image' || decision.liveMoney !== false ||
      decision.decisionReceiptId !== command.decisionReceiptId || ['assetDomain','model','promptHash'].some(function (field) { return decision[field] !== command[field]; }) ||
      !Number.isFinite(decision.decidedAt) || decision.decidedAt > command.commandedAt || !Number.isFinite(decision.expiresAt) || command.commandedAt >= decision.expiresAt ||
      !cause || cause.schemaVersion !== Learning.SCHEMA || cause.domain !== 'culture' || cause.lane !== 'hero-image' ||
      cause.actionId !== command.commandId || cause.commandId !== command.commandId || cause.decisionReceiptId !== command.decisionReceiptId ||
      cause.assetDomain !== command.assetDomain || cause.promptHash !== command.promptHash || cause.commandedAt !== command.commandedAt ||
      !motor || motor.schemaVersion !== Executor.SCHEMA || motor.commandId !== command.commandId || motor.productMotorReceiptId !== command.productMotorReceiptId || motor.decisionReceiptId !== command.decisionReceiptId) return null;
  return command;
}
function observationMatches(observation, command) {
  return !!(observation && observation.schemaVersion === SCHEMA && observation.commandId === command.commandId &&
    observation.assetDomain === command.assetDomain && observation.publicUrl === command.receipt.url && allowedUrl(observation.publicUrl, { allowAnyHttpsForTest: true }) &&
    ['OBSERVED_PRESENT', 'OBSERVED_ABSENT_OR_INVALID'].indexOf(observation.status) >= 0 &&
    observation.observationId === 'cho_' + crypto.createHash('sha256').update(command.commandId + ':' + String(observation.httpStatus) + ':' + observation.bytes).digest('hex').slice(0, 24) &&
    observation.independentReadPath === true && observation.generationEndpointCalled === false && observation.providerCalled === false && observation.liveMoney === false &&
    Number.isFinite(observation.observedAt) && observation.observedAt >= command.completedAt && observation.observedAt <= Date.now() &&
    Number.isInteger(observation.httpStatus) && observation.httpStatus >= 100 && observation.httpStatus <= 599 &&
    typeof observation.contentType === 'string' && Number.isInteger(observation.bytes) && observation.bytes >= 0 && observation.bytes <= MAX_IMAGE_BYTES &&
    (observation.bytes === 0 ? observation.contentSha256 === null : /^[a-f0-9]{64}$/.test(observation.contentSha256)) &&
    (observation.status === 'OBSERVED_PRESENT') === (observation.httpStatus >= 200 && observation.httpStatus < 300 && /^image\//i.test(observation.contentType) && observation.bytes > 0));
}
async function admittedObservation(store, observation) {
  if (!observation || !observation.commandId) return false;
  var command = await joinedCommand(store, await store.get(Executor.commandKey(observation.commandId)));
  var saved = await store.get(key(observation.commandId));
  return !!(command && observationMatches(observation, command) && JSON.stringify(saved) === JSON.stringify(observation));
}
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
  command = await joinedCommand(store, command);
  if (!command) return { ok: false, status: 'REFUSED', reason: 'culture-hero-command-causal-join-invalid', providerCalled: false, liveMoney: false };
  var existing = await store.get(key(command.commandId));
  if (existing && existing.status === 'OBSERVED_PRESENT') {
    if (!observationMatches(existing, command)) return { ok: false, status: 'REFUSED', reason: 'culture-hero-observation-readback-invalid', providerCalled: false, liveMoney: false };
    return existing;
  }
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
  if (!observationMatches(restored, command) || JSON.stringify(restored) !== JSON.stringify(receipt)) throw new Error('culture hero observer: receipt readback invalid');
  await store.lpush(LOG_KEY, restored); await store.ltrim(LOG_KEY, 0, 999);
  return restored;
}
async function observeRecent(store, commands, deps) {
  var rows = [], list = Array.isArray(commands) ? commands : [];
  for (var i = 0; i < list.length; i++) if (list[i] && list[i].status === 'GENERATED') rows.push(await observe(store, list[i], deps));
  return rows;
}
module.exports = { SCHEMA: SCHEMA, LOG_KEY: LOG_KEY, MAX_IMAGE_BYTES: MAX_IMAGE_BYTES,
  key: key, allowedUrl: allowedUrl, joinedCommand: joinedCommand, admittedObservation: admittedObservation, observe: observe, observeRecent: observeRecent };
