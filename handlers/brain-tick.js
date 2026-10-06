/**
 * handlers/brain-tick.js — advance the brain-v2 closed loop one live batch.
 *
 * GET/POST /api/brain-tick        (cron: every 30 min — see vercel.json)
 *
 * Reads the newest recorder rows for the bound domain(s) from the same Redis
 * history /api/feed-record serves, presents rows newer than the stored
 * watermark to the kernel (lib/brain-v2-live.js), and persists the serialized
 * loop. Predictions registered here resolve against rows that arrive six
 * recorded hours later, inside the same loop.
 *
 * AUTH: lib/cron-auth (Bearer CRON_SECRET). x-vercel-cron is informational
 * only and is never treated as a credential.
 *
 * ENERGY ONLY. Energy is the only binder backed by a measured fixture
 * (bind/registry.js). A second domain is added by binding it and extending
 * DOMAINS — nothing else here is domain-specific.
 *
 * OBSERVATIONAL: writes only its own brain_v2:<domain> state key. It does not
 * touch domain stress, portal scores, or any user-visible number.
 */

'use strict';

var db = require('../lib/limen-db');
var cronAuth = require('../lib/cron-auth');
var live = require('../lib/brain-v2-live');
var BIND = require('../brain-v2/bind/energy.js');

var DOMAINS = ['energy'];
var ROWS_PER_TICK = 72;   // newest-first lrange is reversed by advance(); generous catch-up headroom

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!cronAuth.enforce(req, res)) return;

  var results = [];
  for (var i = 0; i < DOMAINS.length; i++) {
    var domain = DOMAINS[i];
    var rows = await db.lrange('feedhist:' + domain, 0, ROWS_PER_TICK - 1);
    try {
      var stats = await live.advance(db, BIND, domain, rows || [], { maxTicks: 48 });
      results.push({ domain: domain, ok: true, stats: stats });
    } catch (err) {
      results.push({ domain: domain, ok: false, error: String(err && err.message || err) });
    }
  }

  var ok = results.every(function (r) { return r.ok; });
  res.status(ok ? 200 : 500).json({
    ok: ok,
    interpretiveOnly: true,
    note: 'brain-v2 observational loop; writes no user-visible scores',
    backend: db.getBackend(),
    results: results
  });
}

module.exports = require('../lib/heartbeat').wrap('brain-tick', handler);
