/**
 * api/limen-snapshot.js — Fast snapshot reader
 *
 * GET /api/limen-snapshot?type=console
 * GET /api/limen-snapshot?type=opportunities
 *
 * Returns pre-built snapshot from DB. Sub-100ms response.
 * Browser reads this instead of computing everything client-side.
 */

var db = require('./lib/limen-db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=5');

  var type = (req.query && req.query.type) || 'console';

  var key = type === 'opportunities' ? 'opportunities_snapshot' : 'console_snapshot';
  var snapshot = await db.get(key);

  if (!snapshot) {
    res.status(200).json({ ok: false, stale: true, message: 'No snapshot available yet. Worker has not run.' });
    return;
  }

  // Add age info
  snapshot._age = Date.now() - snapshot.generatedAt;
  snapshot._ageSeconds = Math.round(snapshot._age / 1000);
  snapshot._stale = snapshot._age > 5 * 60 * 1000;

  res.status(200).json(snapshot);
};
