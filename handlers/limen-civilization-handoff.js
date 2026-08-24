'use strict';

/* Authenticated, read-only operator view of the durable Job 4 handoff. */
var storeFactory = require('../lib/civilization-handoff-store.js');
var store = storeFactory.createStore();

function auth(req) {
  var expected = process.env.BRAIN_SHADOW_TOKEN;
  if (!expected) return { ok: false, status: 503, error: 'operator token is not configured' };
  var value = req && req.headers && (req.headers['x-brain-token'] || req.headers.authorization);
  if (typeof value === 'string' && value.indexOf('Bearer ') === 0) value = value.slice(7);
  if (value !== expected) return { ok: false, status: 401, error: 'unauthorized' };
  return { ok: true };
}

function limit(req) {
  var q = query(req);
  var raw = q.limit;
  var n = Number(raw == null ? 50 : raw);
  if (!Number.isInteger(n) || n < 1) return 50;
  return Math.min(100, n);
}

function query(req) {
  if (req && req.query) return req.query;
  var out = {};
  try { new URL(req && req.url || '', 'http://limen').searchParams.forEach(function (v, k) { out[k] = v; }); } catch (e) {}
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  var a = auth(req);
  if (!a.ok) { res.statusCode = a.status; return res.end(JSON.stringify({ ok: false, error: a.error })); }
  if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('allow', 'GET'); return res.end(JSON.stringify({ ok: false, error: 'GET only' })); }
  try {
    var q = query(req);
    var packetIds = await store.members(store.packetIndexKey);
    var handoffIds = await store.members(store.handoffIndexKey);
    var packetFilter = q.packetId;
    var handoffFilter = q.handoffId;
    if (packetFilter) packetIds = packetIds.filter(function (id) { return id === packetFilter; });
    if (handoffFilter) handoffIds = handoffIds.filter(function (id) { return id === handoffFilter; });
    packetIds = packetIds.slice(-limit(req));
    handoffIds = handoffIds.slice(-limit(req));
    var packets = [], handoffs = [], missing = [];
    for (var i = 0; i < packetIds.length; i++) { var p = await store.get(store.packetKey(packetIds[i])); if (p) packets.push(p); else missing.push({ kind: 'packet', id: packetIds[i] }); }
    for (var j = 0; j < handoffIds.length; j++) { var h = await store.get(store.handoffKey(handoffIds[j])); if (h) handoffs.push(h); else missing.push({ kind: 'handoff', id: handoffIds[j] }); }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, packets: packets, handoffs: handoffs, missing: missing, count: { packets: packets.length, handoffs: handoffs.length } }));
  } catch (e) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ ok: false, error: e.code || 'CIVILIZATION_HANDOFF_READ_FAILED', detail: String(e.message || e) }));
  }
};
