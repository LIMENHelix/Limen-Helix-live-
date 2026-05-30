/**
 * api/limen-intents.js — Intent persistence endpoint
 *
 * GET  /api/limen-intents  → read persisted intents from Redis
 * POST /api/limen-intents  → write intents to Redis
 *
 * Browser writes through on every intent save.
 * Browser reads on boot (server-first, localStorage fallback).
 * 24h TTL — intents older than that are stale anyway.
 */

var db = require('./lib/limen-db');

var TTL_SECONDS = 86400; // 24 hours

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // ── GET: read persisted intents ──
  if (req.method === 'GET') {
    var intents = await db.get('active_intents');
    if (!intents) {
      res.status(200).json({ ok: true, intents: [], _source: 'empty' });
      return;
    }
    var age = intents._savedAt ? Date.now() - intents._savedAt : null;
    res.status(200).json({
      ok: true,
      intents: intents.data || [],
      _savedAt: intents._savedAt || null,
      _age: age,
      _ageSeconds: age ? Math.round(age / 1000) : null,
      _source: 'redis'
    });
    return;
  }

  // ── POST: write intents ──
  if (req.method === 'POST') {
    var body = req.body;
    if (!body || !Array.isArray(body.intents)) {
      res.status(400).json({ ok: false, error: 'body.intents must be an array' });
      return;
    }

    var envelope = {
      _savedAt: Date.now(),
      data: body.intents
    };

    var ok = await db.set('active_intents', envelope, TTL_SECONDS);
    res.status(200).json({ ok: ok, count: body.intents.length, _savedAt: envelope._savedAt });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
