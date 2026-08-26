'use strict';

/** Culture's read-only public asset observer; never invokes image generation. */
var CronAuth = require('../lib/cron-auth.js');
var Store = require('../lib/autofire-efference-store.js');
var Executor = require('../lib/culture-hero-executor.js');
var Observer = require('../lib/culture-hero-outcome-observer.js');
var Learning = require('../lib/culture-hero-learning.js');
function createHandler(deps) {
  deps = deps || {};
  var store = deps.store || Store, observer = deps.observer || Observer, cronAuth = deps.cronAuth || CronAuth;
  return async function handler(req, res) {
    res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store');
    if (String(req.method || 'GET').toUpperCase() !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); return res.end(JSON.stringify({ ok: false, error: 'GET only' })); }
    if (!cronAuth.enforce(req, res)) return;
    try {
      store.assertDurable();
      var commands = await store.lrange(Executor.LOG_KEY, 0, 99);
      var observations = await observer.observeRecent(store, commands, { fetch: deps.fetch || global.fetch });
      var learned = 0, failures = [];
      for (var i = 0; i < observations.length; i++) {
        if (!observations[i] || !observations[i].observationId) continue;
        var learnedResult = await Learning.recordObservation(store, observations[i]);
        if (learnedResult && learnedResult.ok) { if (!learnedResult.duplicate) learned++; }
        else failures.push({ observationId: observations[i].observationId, reason: learnedResult && learnedResult.reason || 'culture-learning-failed' });
      }
      res.statusCode = failures.length ? 207 : 200;
      return res.end(JSON.stringify({ ok: failures.length === 0, schemaVersion: 'culture-hero-observer-cycle/1.0',
        inspected: commands.length, observations: observations, learning: { recorded: learned, failures: failures }, generationEndpointCalled: false, providerCalled: false, liveMoney: false }));
    } catch (error) {
      res.statusCode = 503;
      return res.end(JSON.stringify({ ok: false, error: 'culture-hero-observer-unavailable', detail: String(error && error.message || error), providerCalled: false, liveMoney: false }));
    }
  };
}
var handler = createHandler();
module.exports = require('../lib/heartbeat').wrap('culture-hero-outcome-observer', handler);
module.exports.createHandler = createHandler;
