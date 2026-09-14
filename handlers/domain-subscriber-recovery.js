'use strict';

/** Protected exact-domain router for subscriber recovery. */
var Factory = require('../lib/sovereign-subscriber-route-handlers.js');
var Lanes = require('../lib/sovereign-domain-subscriber-lanes.js');

function domainOf(req) {
  try { return new URL(req.url, 'http://local').searchParams.get('domain'); } catch (_) { return null; }
}
function createHandler(deps) {
  deps = deps || {};
  return async function handler(req, res) {
    var domain = String(domainOf(req) || '').toLowerCase(), lane = Lanes.get(domain);
    if (!lane || ['finance', 'religion'].indexOf(domain) >= 0) {
      res.statusCode = 400; res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ ok: false, error: 'exact sovereign subscriber domain required' }));
    }
    return Factory.recovery(lane, deps)(req, res);
  };
}
var handler = createHandler(); handler.createHandler = createHandler; module.exports = handler;
