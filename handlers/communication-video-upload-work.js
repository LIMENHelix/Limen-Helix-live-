'use strict';

var Auth = require('../lib/media-worker-auth.js');
var Store = require('../lib/autofire-efference-store.js');
var Upload = require('../lib/communication-video-upload-bridge.js');

function readBody(req) {
  if (req && req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise(function (resolve, reject) {
    var chunks = [], size = 0;
    req.on('data', function (chunk) {
      size += chunk.length;
      if (size > 64 * 1024) reject(new Error('body-too-large')); else chunks.push(chunk);
    });
    req.on('end', function () {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (_) { reject(new Error('invalid-json')); }
    });
    req.on('error', reject);
  });
}

function createHandler(deps) {
  deps = deps || {};
  var store = deps.store || Store;
  var auth = deps.auth || Auth;
  var bridge = deps.bridge || Upload;
  return async function handler(req, res) {
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'private, no-store');
    var method = String(req.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'POST') {
      res.statusCode = 405; res.setHeader('Allow', 'GET, POST');
      return res.end(JSON.stringify({ ok: false, error: 'GET or POST only' }));
    }
    var admitted = auth.enforce(req, res, deps.env || process.env);
    if (!admitted) return;
    try {
      var body = method === 'POST' ? await readBody(req) : null;
      var result = method === 'GET'
        ? await bridge.claim(store, admitted.workerId, deps.now, deps.env || process.env, deps)
        : (body && body.action === 'AUTHORIZE_PROVIDER_CALL'
          ? await bridge.preflight(store, admitted.workerId, body, deps.now, deps.env || process.env, deps)
          : await bridge.complete(store, admitted.workerId, body, deps.now));
      res.statusCode = result.ok ? 200 : 409;
      return res.end(JSON.stringify(result));
    } catch (error) {
      var providerDefinitelyNotCalled = method === 'GET' ||
        (body && body.action === 'AUTHORIZE_PROVIDER_CALL');
      res.statusCode = 503;
      return res.end(JSON.stringify({ ok: false, error: 'communication-video-upload-work-unavailable',
        detail: String(error && error.message || error),
        providerCalled: providerDefinitelyNotCalled ? false : null,
        providerCallStatus: providerDefinitelyNotCalled ? 'NOT_CALLED' : 'UNKNOWN_RECEIPT_RECONCILIATION_REQUIRED',
        externalEffectAuthorized: providerDefinitelyNotCalled ? false : null, liveMoney: false }));
    }
  };
}

var handler = createHandler();
handler.createHandler = createHandler;
handler.readBody = readBody;
module.exports = handler;
