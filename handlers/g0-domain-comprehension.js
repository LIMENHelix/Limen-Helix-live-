'use strict';

var Store = require('../lib/autofire-efference-store.js');
var Lanes = require('../lib/g0-lane-registry.js');
var Comprehension = require('../lib/g0-domain-comprehension.js');
var Orientation = require('../lib/g0-orientation.js');
var CronAuth = require('../lib/cron-auth.js');

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  return res.end(JSON.stringify(body));
}

function tokenOf(req) {
  var h = req.headers || {};
  return h['x-brain-token'] || String(h.authorization || '').replace(/^Bearer\s+/i, '');
}

function createHandler(deps) {
  deps = deps || {};
  var store = deps.store || Store;
  var env = deps.env || process.env;
  return async function (req, res) {
    if (String(req.method || 'GET').toUpperCase() !== 'GET') return send(res, 405, { ok: false, error: 'GET only' });
    var cron = CronAuth.authorize(req).ok;
    if (!cron) {
      if (!env.BRAIN_SHADOW_TOKEN) return send(res, 503, { ok: false, error: 'BRAIN_SHADOW_TOKEN not set; endpoint fails closed' });
      if (tokenOf(req) !== env.BRAIN_SHADOW_TOKEN) return send(res, 401, { ok: false, error: 'unauthorized' });
    }
    var domain = null;
    try { domain = new URL(req.url, 'http://local').searchParams.get('domain'); } catch (_) {}
    var domains = domain ? [domain] : Lanes.SCOPE;
    try {
      var rows = [];
      for (var i = 0; i < domains.length; i++) {
        var composed = await Comprehension.compose(domains[i], { store: store, env: env, now: Date.now() });
        if (!composed.ok) { rows.push(composed); continue; }
        if (cron) await Comprehension.persist(store, composed, Date.now());
        var oriented = await Orientation.boot(domains[i], { store: store, comprehension: composed, env: env, now: Date.now() });
        if (cron && oriented.ok) await Orientation.persist(store, oriented);
        rows.push({
          ok: true,
          domainId: domains[i],
          comprehension: composed.record,
          orientation: oriented.boot || null,
          canAct: !!(oriented.boot && oriented.boot.canAct)
        });
      }
      return send(res, 200, {
        ok: true, schemaVersion: 'g0-domain-comprehension-status/1.0',
        authMode: cron ? 'cron-write' : 'operator-read',
        liveMoney: false, humanApprovalRequired: false, domains: rows
      });
    } catch (error) {
      return send(res, 503, {
        ok: false, error: 'g0-domain-comprehension-failed',
        detail: String(error && error.message || error), liveMoney: false
      });
    }
  };
}

var handler = createHandler();
module.exports = require('../lib/heartbeat').wrap('g0-domain-comprehension', handler);
module.exports.createHandler = createHandler;
