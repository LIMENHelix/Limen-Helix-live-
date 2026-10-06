/**
 * handlers/brain-state.js — read-only view of the live brain-v2 loop state.
 *
 * GET /api/brain-state?domain=energy
 *
 * Returns the persisted kernel snapshot: tick count, watermark, and prediction
 * registry counts (open / resolved). Read-only, public, mirrors the
 * handlers/limen-health.js discipline: no auth on reads, no mutation.
 *
 * LABELING: every response carries interpretiveOnly: true and an explicit
 * note. These predictions are a measurement instrument under calibration;
 * they are NOT validated distress reads and must not be rendered as if they
 * were (the gray "not a validated read" banding in scripts/rescore-portals.mjs
 * is the production precedent).
 */

'use strict';

var db = require('../lib/limen-db');
var live = require('../lib/brain-v2-live');

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  var q = (req && req.query) || {};
  var domain = typeof q.domain === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(q.domain) ? q.domain : 'energy';

  var record = await live.readState(db, domain);

  var out = {
    ok: true,
    interpretiveOnly: true,
    note: 'brain-v2 observational loop: kernel predictions under calibration. Not a validated read; no decision authority.',
    domain: domain,
    backend: db.getBackend(),
    dbPing: await db.ping(),
    brain: null
  };

  if (record && record.state) {
    var reg = record.state.registry || {};
    var open = Array.isArray(reg.order) ? reg.order.length : 0;
    var resolved = Array.isArray(reg.resolved) ? reg.resolved.length : 0;
    out.brain = {
      exists: true,
      version: record.state.version,
      ticks: record.state.ticks,
      lastTickAt: record.state.lastTickAt,
      lastTickAge: record.state.lastTickAt ? Math.round((Date.now() - record.state.lastTickAt) / 1000) + 's' : null,
      watermark: record.watermark,
      predictions: { open: open, resolved: resolved },
      savedAt: record.savedAt
    };
  } else {
    out.brain = { exists: false, reason: 'no stored loop state — brain-tick has not produced one yet' };
  }

  res.status(200).json(out);
}

module.exports = handler;
