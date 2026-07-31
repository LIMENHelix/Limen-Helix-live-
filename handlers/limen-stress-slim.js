/**
 * api/limen-stress-slim.js — Lightweight browser-readable network-stress map.
 *
 * GET /api/limen-stress-slim
 *   -> { ok, source, generatedAt, count,
 *        bySlug: { <slug>: { induced, total, rank, hub, pushed } } }
 *
 * Lets the company portal + command board weight each fractal vendor edge by
 * its spider-web network-induced stress WITHOUT shipping the ~4.5 MB full
 * snapshot to the browser. Source priority:
 *   1. Redis limen:stress_slim  (fresh, written by limen-worker-stress-refresh)
 *   2. bundled assets/data/stress-network-state.json  (derive slim on the fly)
 * Either way the response is ~tens of KB and cacheable.
 */

var db = require('../lib/limen-db');
var fs = require('fs');
var path = require('path');

var STATE_PATHS = [
  path.join(__dirname, '..', 'assets', 'data', 'stress-network-state.json'),
  '/var/task/assets/data/stress-network-state.json',
  path.join(process.cwd(), 'assets', 'data', 'stress-network-state.json')
];

function _fromFile() {
  for (var i = 0; i < STATE_PATHS.length; i++) {
    try {
      if (!fs.existsSync(STATE_PATHS[i])) continue;
      var sn = JSON.parse(fs.readFileSync(STATE_PATHS[i], 'utf8'));
      var arr = (sn && sn.propagated) || [];
      var bySlug = {};
      for (var j = 0; j < arr.length; j++) {
        var n = arr[j];
        if (!n || !n.slug) continue;
        bySlug[n.slug] = {
          induced: n.inducedStress, total: n.totalStress,
          rank: n.amplificationRank, hub: !!n.isHub, pushed: !!n.networkPushed
        };
      }
      return { generatedAt: (sn && sn.generatedAt) || null, bySlug: bySlug, source: 'file' };
    } catch (e) { /* try next */ }
  }
  return { generatedAt: null, bySlug: {}, source: 'none' };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('content-type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=120');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  try {
    var bySlug = {}, generatedAt = null, source = 'file';
    /**
     * The propagator's own stats were computed every run and dropped here, which is why an
     * inhibitory-edge outage was invisible from outside for weeks: stats.inhibitoryEdgesLoaded
     * was the only place it surfaced, and this endpoint is the only fresh (Redis-backed) view
     * of a run. Passing them through costs a few hundred bytes and makes "is regulation actually
     * on in production" answerable with a fetch instead of a code read.
     */
    var stats = null;
    var slim = await db.get('stress_slim');
    if (slim && slim.byCik) {
      var keys = Object.keys(slim.byCik);
      for (var i = 0; i < keys.length; i++) {
        var e = slim.byCik[keys[i]];
        if (e && e.slug) {
          bySlug[e.slug] = {
            induced: e.inducedStress, total: e.totalStress,
            rank: e.amplificationRank, hub: !!e.isHub, pushed: !!e.networkPushed
          };
        }
      }
      generatedAt = slim.generatedAt || null;
      stats = slim.stats || null;
      source = 'redis';
    } else {
      var f = _fromFile();
      bySlug = f.bySlug; generatedAt = f.generatedAt; source = f.source;
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, source: source, generatedAt: generatedAt, count: Object.keys(bySlug).length, stats: stats, bySlug: bySlug }));
  } catch (err) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: 'internal', detail: String((err && err.message) || err) }));
  }
};
