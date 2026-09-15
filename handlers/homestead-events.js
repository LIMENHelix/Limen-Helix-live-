/**
 * api/homestead-events.js — lightweight Homestead funnel counts.
 *
 *   POST /api/homestead-events  { event, zip? }
 *   GET  /api/homestead-events          → totals (no PII)
 *
 * Allowed events only. Fail-open: a storage miss must not break the page.
 * Reuses limen-db. No third-party pixel required.
 */
'use strict';

var db = require('../lib/limen-db');

var KEY = 'homestead:events:v1';
var ALLOWED = {
  read_complete: 1,
  email_capture: 1,
  chat_open: 1,
  chat_qualified: 1,
  checkout_start: 1
};

function send(res, obj, code) {
  res.statusCode = code || 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    var data = '';
    req.on('data', function (c) { data += c; if (data.length > 4000) data = data.slice(0, 4000); });
    req.on('end', function () { try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); } });
    req.on('error', function () { resolve({}); });
  });
}

async function totals() {
  try {
    var cur = await db.get(KEY);
    if (cur && typeof cur === 'object') return cur;
  } catch (e) {}
  return { events: {}, updated: null };
}

module.exports = async function handler(req, res) {
  var method = String(req.method || 'GET').toUpperCase();
  if (method === 'GET') {
    var t = await totals();
    return send(res, { ok: true, events: t.events || {}, updated: t.updated || null });
  }
  if (method !== 'POST') return send(res, { ok: false, error: 'GET or POST only' }, 405);

  var body = await readBody(req);
  var ev = String(body.event || '').toLowerCase().trim();
  if (!ALLOWED[ev]) return send(res, { ok: false, error: 'unknown event' }, 400);

  var zip = String(body.zip || '').replace(/[^0-9]/g, '').slice(0, 5);
  try {
    var cur = await totals();
    var events = cur.events || {};
    events[ev] = (events[ev] || 0) + 1;
    var rec = { events: events, updated: new Date().toISOString(), last: { event: ev, zip: zip.length === 5 ? zip : null } };
    await db.set(KEY, rec);
    return send(res, { ok: true, event: ev, count: events[ev] });
  } catch (e) {
    return send(res, { ok: true, event: ev, stored: false });
  }
};

module.exports.ALLOWED = ALLOWED;
