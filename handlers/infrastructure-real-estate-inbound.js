'use strict';

var Webhook = require('svix').Webhook;
var Store = require('../lib/autofire-efference-store.js');
var Observer = require('../lib/infrastructure-real-estate-observer.js');
var Learning = require('../lib/infrastructure-real-estate-learning.js');
function json(res, code, value) { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(value)); }
function rawBody(req) { return new Promise(function (resolve) { if (typeof req.body === 'string') return resolve(req.body); if (Buffer.isBuffer(req.body)) return resolve(req.body.toString('utf8')); var chunks = [], size = 0; req.on('data', function (chunk) { var b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += b.length; if (size <= 1048576) chunks.push(b); }); req.on('end', function () { resolve(Buffer.concat(chunks).toString('utf8')); }); req.on('error', function () { resolve(''); }); }); }
function createHandler(deps) { deps = deps || {}; var store = deps.store || Store; return async function handler(req, res) {
  if (String(req.method || '').toUpperCase() !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });
  var raw = await rawBody(req), secret = deps.secret || process.env.INFRASTRUCTURE_REAL_ESTATE_RESEND_WEBHOOK_SECRET || '';
  var headers = req.headers || {}, event;
  try { if (!secret) throw new Error('webhook secret unavailable'); event = deps.verify ? deps.verify(raw, headers) : new Webhook(secret).verify(raw, { 'svix-id': headers['svix-id'], 'svix-timestamp': headers['svix-timestamp'], 'svix-signature': headers['svix-signature'] }); }
  catch (_) { return json(res, 400, { ok: false, error: 'invalid webhook signature', providerCalled: false, liveMoney: false }); }
  if (!event || event.type !== 'email.received') return json(res, 200, { ok: true, ignored: true, type: event && event.type || null });
  try { store.assertDurable(); var observation = await (deps.observer || Observer).record(store, event); if (!observation.ok) return json(res, 400, observation); var learning = await (deps.learning || Learning).recordObservation(store, observation); return json(res, 200, { ok: true, observationId: observation.observationId, actionId: observation.actionId, status: observation.status, duplicate: observation.duplicate === true, learned: learning.ok && !learning.duplicate, sendEndpointCalled: false, liveMoney: false }); }
  catch (error) { return json(res, 503, { ok: false, error: 'infrastructure-real-estate-inbound-unavailable', detail: String(error && error.message || error), sendEndpointCalled: false, liveMoney: false }); }
}; }
module.exports = createHandler(); module.exports.createHandler = createHandler; module.exports.rawBody = rawBody;
