/**
 * api/limen-drafts.js — Draft persistence endpoint
 *
 * GET  /api/limen-drafts  → read persisted drafts from Redis
 * POST /api/limen-drafts  → write drafts to Redis
 *
 * Browser writes through on every draft save.
 * Browser reads on boot (server-first, localStorage fallback).
 * 24h TTL — drafts older than that are stale anyway.
 */

var db = require('../lib/limen-db');

var TTL_SECONDS = 86400; // 24 hours

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // ── GET: read persisted drafts ──
  if (req.method === 'GET') {
    var drafts = await db.get('action_drafts');
    if (!drafts) {
      res.status(200).json({ ok: true, drafts: [], _source: 'empty' });
      return;
    }
    var age = drafts._savedAt ? Date.now() - drafts._savedAt : null;
    res.status(200).json({
      ok: true,
      drafts: drafts.data || [],
      _savedAt: drafts._savedAt || null,
      _age: age,
      _ageSeconds: age ? Math.round(age / 1000) : null,
      _source: 'redis'
    });
    return;
  }

  // ── POST: write drafts ──
  if (req.method === 'POST') {
    var body = req.body;
    if (!body || !Array.isArray(body.drafts)) {
      res.status(400).json({ ok: false, error: 'body.drafts must be an array' });
      return;
    }

    var envelope = {
      _savedAt: Date.now(),
      data: body.drafts
    };

    var ok = await db.set('action_drafts', envelope, TTL_SECONDS);
    res.status(200).json({ ok: ok, count: body.drafts.length, _savedAt: envelope._savedAt });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
