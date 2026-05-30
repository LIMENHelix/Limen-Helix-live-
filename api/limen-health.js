/**
 * api/limen-health.js — System health check
 *
 * GET /api/limen-health
 *
 * Returns status of all backend systems.
 */

var db = require('./lib/limen-db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  var health = {
    timestamp: Date.now(),
    backend: db.getBackend(),
    dbPing: await db.ping(),
    snapshots: {},
    workers: {}
  };

  // Check snapshot freshness
  var console_snap = await db.get('console_snapshot');
  var opp_snap = await db.get('opportunities_snapshot');
  var latest_ingest = await db.get('latest_ingest');

  health.snapshots.console = console_snap ? {
    exists: true,
    age: Math.round((Date.now() - console_snap.generatedAt) / 1000) + 's',
    domains: console_snap.domainCount,
    live: console_snap.liveCount
  } : { exists: false };

  health.snapshots.opportunities = opp_snap ? {
    exists: true,
    age: Math.round((Date.now() - opp_snap.generatedAt) / 1000) + 's',
    count: opp_snap.count
  } : { exists: false };

  health.workers.ingest = latest_ingest ? {
    lastRun: Math.round((Date.now() - latest_ingest.timestamp) / 1000) + 's ago',
    articles: latest_ingest.totalArticles,
    signals: latest_ingest.signals ? latest_ingest.signals.length : 0,
    macroShock: latest_ingest.macroShock ? latest_ingest.macroShock.detected : false
  } : { lastRun: 'never' };

  // Overall status
  health.status = health.dbPing.status === 'ok' ? 'OK' : 'DEGRADED';

  res.status(200).json(health);
};
