/**
 * recall-scan.js — Tuned Monitoring: scan a clinic's inventory against the live FDA recall feed.
 *
 * POST /api/recall-scan { key, csv } | { key, items:[{product,manufacturer,ndc,lot}] }
 *   -> { ok, matchedItems, counts:{exact,likely,watch,possible}, results:[...] }
 *
 * Reads the daily openFDA recall set (medicine:distress). Admin-gated for now (LEAD_ADMIN_KEY);
 * clinic access + Stripe subscription gating is the next step. Never invents a match — every result
 * is real clinic input vs. real openFDA data, labeled by confidence tier.
 */
'use strict';
var db = require('../lib/limen-db');
var csv = require('../lib/inventory-csv');
var matcher = require('../lib/recall-match');

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    var d = ''; req.on('data', function (c) { d += c; });
    req.on('end', function () { try { resolve(JSON.parse(d)); } catch (e) { resolve({}); } });
    req.on('error', function () { resolve({}); });
  });
}
function j(res, c, o) { res.statusCode = c; res.setHeader('content-type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(o)); }

module.exports = async function handler(req, res) {
  if ((req.method || 'GET').toUpperCase() !== 'POST') return j(res, 405, { ok: false, error: 'POST only' });
  var body = await readBody(req);
  var ADMIN = process.env.LEAD_ADMIN_KEY || '';
  if (ADMIN && (body.key || '') !== ADMIN) return j(res, 403, { ok: false, error: 'Admin key required (clinic access + billing land next, via Stripe).' });

  var parsed;
  if (typeof body.csv === 'string' && body.csv.trim()) parsed = csv.parseInventory(body.csv);
  else if (Array.isArray(body.items)) parsed = { items: body.items.slice(0, 5000), mode: 'items', columns: null };
  else return j(res, 400, { ok: false, error: 'Provide { csv: "<distributor export>" } or { items: [{product,manufacturer,ndc,lot}] }.' });

  var recalls = (await db.get('medicine:distress')) || [];
  if (!recalls.length) return j(res, 200, { ok: true, note: 'no recalls loaded yet — the openFDA ingest runs daily', inventoryCount: parsed.items.length, matchedItems: 0, results: [] });

  var results = matcher.scanInventory(parsed.items, recalls);
  var counts = { exact: 0, likely: 0, watch: 0, possible: 0 };
  results.forEach(function (r) { counts[r.bestTier] = (counts[r.bestTier] || 0) + 1; });

  return j(res, 200, {
    ok: true, mode: parsed.mode, columns: parsed.columns,
    inventoryCount: parsed.items.length, recallsScanned: recalls.length,
    matchedItems: results.length, counts: counts,
    results: results.slice(0, 200)
  });
};
