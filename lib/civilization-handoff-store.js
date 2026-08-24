'use strict';

/*
 * Strict durable store for the server-side civilization handoff.
 *
 * This is intentionally separate from lib/redis-kv.js.  That client is a
 * forgiving cache/read path; this boundary must never report a packet as
 * persisted when Redis is absent, rejected, or returned malformed data.
 */

var MODULE_ID = 'civilization-handoff-store';
var PREFIX = 'limen:civilization:handoff:v1:';
var RETENTION_SECONDS = 90 * 24 * 60 * 60;

function fail(code, message) {
  var err = new Error(MODULE_ID + ': ' + message);
  err.code = code;
  throw err;
}

function id(value, name) {
  if (typeof value !== 'string' || !value.trim()) fail('INVALID_ID', name + ' is required');
  return value.trim();
}

function key(kind, value) {
  return PREFIX + kind + ':' + encodeURIComponent(id(value, kind + ' id'));
}

function createStore(opts) {
  opts = opts || {};
  var fetchFn = opts.fetch || global.fetch;
  var urlName = opts.urlName || 'UPSTASH_REDIS_REST_URL';
  var tokenName = opts.tokenName || 'UPSTASH_REDIS_REST_TOKEN';

  function configured() {
    return !!(process.env[urlName] && process.env[tokenName]);
  }

  async function command(args) {
    if (!configured()) fail('REDIS_NOT_CONFIGURED', urlName + ' and ' + tokenName + ' are required for durable persistence');
    if (typeof fetchFn !== 'function') fail('FETCH_UNAVAILABLE', 'a fetch implementation is required');
    var response;
    try {
      response = await fetchFn(process.env[urlName], {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + process.env[tokenName], 'content-type': 'application/json' },
        body: JSON.stringify(args)
      });
    } catch (e) {
      fail('REDIS_TRANSPORT', String(e && e.message || e));
    }
    if (!response || !response.ok) fail('REDIS_HTTP', 'Redis returned HTTP ' + (response && response.status));
    var body;
    try { body = await response.json(); } catch (e) { fail('REDIS_RESPONSE', 'Redis response was not JSON'); }
    if (!body || !Object.prototype.hasOwnProperty.call(body, 'result')) fail('REDIS_RESPONSE', 'Redis response had no result');
    return body.result;
  }

  async function setNx(recordKey, value) {
    var result = await command(['SET', recordKey, JSON.stringify(value), 'NX', 'EX', String(RETENTION_SECONDS)]);
    if (result !== 'OK' && result !== null) fail('REDIS_RESULT', 'SET NX returned an unexpected result');
    return result === 'OK';
  }

  async function get(recordKey) {
    var result = await command(['GET', recordKey]);
    if (result == null) return null;
    try { return JSON.parse(result); } catch (e) { fail('REDIS_VALUE', 'stored value was not JSON'); }
  }

  async function add(indexKey, value) {
    var result = await command(['SADD', indexKey, id(value, 'index member')]);
    if (!Number.isInteger(result) || result < 0) fail('REDIS_RESULT', 'SADD returned an invalid count');
    return result;
  }

  async function members(indexKey) {
    var result = await command(['SMEMBERS', indexKey]);
    if (!Array.isArray(result)) fail('REDIS_RESULT', 'SMEMBERS returned a non-array');
    return result.map(function (v) { return id(v, 'index member'); });
  }

  return {
    configured: configured,
    setNx: setNx,
    get: get,
    add: add,
    members: members,
    packetKey: function (packetId) { return key('packet', packetId); },
    handoffKey: function (handoffId) { return key('handoff', handoffId); },
    packetIndexKey: PREFIX + 'index:packets',
    handoffIndexKey: PREFIX + 'index:handoffs',
    retentionSeconds: RETENTION_SECONDS
  };
}

module.exports = { MODULE_ID: MODULE_ID, PREFIX: PREFIX, RETENTION_SECONDS: RETENTION_SECONDS, createStore: createStore };
