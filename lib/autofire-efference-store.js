/**
 * Strict Redis store for the research/investment autofire efference boundary.
 *
 * This deliberately does not use lib/limen-db. That module keeps public pages
 * available by falling back to process memory, which is useful for display data
 * and fatal for the claim made here: the command copy must survive the serverless
 * process that dispatched the provider request.
 *
 * Only the four actuator namespaces below are addressable. Missing credentials,
 * transport failures, non-2xx responses, Redis errors, malformed replies, and
 * unexpected result shapes all throw. There is no memory fallback.
 */

'use strict';

var NAMESPACE_PREFIX = 'limen:';
var EXACT_KEYS = { autofire_efference_log: true, autofire_efference_pending_log: true };
var PREFIXES = [
  'autofire_efference:',
  'autofire_forward_model:',
  'autofire_efference_pending:'
];

function assertKey(key) {
  if (typeof key !== 'string' || !key) {
    throw new Error('autofire efference store: key must be a non-empty string');
  }
  if (EXACT_KEYS[key]) return key;
  for (var i = 0; i < PREFIXES.length; i++) {
    if (key.indexOf(PREFIXES[i]) === 0 && key.length > PREFIXES[i].length) return key;
  }
  throw new Error('autofire efference store: refusing key outside the actuator namespace: ' + key);
}

function credentials() {
  var url = process.env.UPSTASH_REDIS_REST_URL;
  var token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('autofire efference store: Redis is not configured; refusing process-memory persistence');
  }
  return { url: url, token: token };
}

async function command(method, args) {
  var cred = credentials();
  var response;
  try {
    response = await fetch(cred.url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + cred.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([method].concat(args || []))
    });
  } catch (err) {
    throw new Error('autofire efference store: ' + method + ' transport failed: ' +
      ((err && err.message) || String(err)));
  }
  if (!response || typeof response.status !== 'number' ||
      response.status < 200 || response.status >= 300) {
    throw new Error('autofire efference store: ' + method + ' returned HTTP ' +
      (response && response.status));
  }

  var text;
  try { text = await response.text(); }
  catch (err) {
    throw new Error('autofire efference store: ' + method + ' response body unreadable: ' + err.message);
  }
  var data;
  try { data = JSON.parse(text); }
  catch (_) {
    throw new Error('autofire efference store: ' + method + ' returned non-JSON');
  }
  if (data && data.error) {
    throw new Error('autofire efference store: ' + method + ' rejected by Redis: ' + data.error);
  }
  if (!data || !Object.prototype.hasOwnProperty.call(data, 'result')) {
    throw new Error('autofire efference store: ' + method + ' returned no result field');
  }
  return data.result;
}

function physicalKey(key) { return NAMESPACE_PREFIX + assertKey(key); }

function assertDurable() {
  credentials();
  return true;
}

async function get(key) {
  var result = await command('GET', [physicalKey(key)]);
  if (result === null || result === undefined) return null;
  if (typeof result !== 'string') {
    throw new Error('autofire efference store: GET returned a non-string value');
  }
  try { return JSON.parse(result); }
  catch (_) { throw new Error('autofire efference store: GET returned invalid JSON'); }
}

async function set(key, value, ttlSeconds) {
  var args = [physicalKey(key), JSON.stringify(value)];
  if (ttlSeconds) args.push('EX', String(ttlSeconds));
  var result = await command('SET', args);
  if (result !== 'OK') {
    throw new Error('autofire efference store: SET returned ' + JSON.stringify(result) + ', expected "OK"');
  }
  return true;
}

async function del(key) {
  var result = await command('DEL', [physicalKey(key)]);
  if (typeof result !== 'number' || !isFinite(result) || result < 0) {
    throw new Error('autofire efference store: DEL returned an invalid count');
  }
  return result;
}

async function lpush(key, value) {
  var result = await command('LPUSH', [physicalKey(key), JSON.stringify(value)]);
  if (typeof result !== 'number' || !isFinite(result) || result < 1) {
    throw new Error('autofire efference store: LPUSH returned an invalid list length');
  }
  return result;
}

async function ltrim(key, start, stop) {
  var result = await command('LTRIM', [physicalKey(key), String(start), String(stop)]);
  if (result !== 'OK') {
    throw new Error('autofire efference store: LTRIM returned ' + JSON.stringify(result) + ', expected "OK"');
  }
  return true;
}

async function lrange(key, start, stop) {
  var result = await command('LRANGE', [physicalKey(key), String(start), String(stop)]);
  if (!Array.isArray(result)) {
    throw new Error('autofire efference store: LRANGE returned a non-array value');
  }
  return result.map(function (value) {
    if (typeof value !== 'string') {
      throw new Error('autofire efference store: LRANGE item is not a string');
    }
    try { return JSON.parse(value); }
    catch (_) { throw new Error('autofire efference store: LRANGE item is invalid JSON'); }
  });
}

module.exports = {
  NAMESPACE_PREFIX: NAMESPACE_PREFIX,
  assertKey: assertKey,
  assertDurable: assertDurable,
  get: get,
  set: set,
  del: del,
  lpush: lpush,
  ltrim: ltrim,
  lrange: lrange
};
