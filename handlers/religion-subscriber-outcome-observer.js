'use strict';
var CronAuth = require('../lib/cron-auth.js');
var Store = require('../lib/autofire-efference-store.js');
var Executor = require('../lib/religion-subscriber-executor.js');
var Observer = require('../lib/religion-subscriber-outcome-observer.js');
var Learning = require('../lib/religion-subscriber-learning.js');
var Recovery = require('../lib/religion-subscriber-recovery.js');
function createHandler(deps) {
  deps = deps || {}; var store = deps.store || Store, observer = deps.observer || Observer, cronAuth = deps.cronAuth || CronAuth;
  return async function handler(req, res) {
    res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store');
    if (String(req.method || 'GET').toUpperCase() !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); return res.end(JSON.stringify({ ok: false, error: 'GET only' })); }
    if (!cronAuth.enforce(req, res)) return;
    try {
      var commands = await store.lrange(Executor.LOG_KEY, 0, 99);
      var observations = await observer.observeRecent(store, commands, { fetch: deps.fetch || global.fetch, apiKey: deps.apiKey });
      var learned = 0, duplicates = 0, learningAbstentions = [], recoveries = [], recoveryHolds = [];
      for (var i = 0; i < observations.length; i++) {
        var observation = observations[i];
        if (!observation || observation.schemaVersion !== Observer.SCHEMA) { learningAbstentions.push(observation); continue; }
        var learnedResult = await (deps.learning || Learning).recordObservation(store, observation);
        if (learnedResult.ok && learnedResult.duplicate) duplicates++; else if (learnedResult.ok) learned++; else learningAbstentions.push(learnedResult);
        if (Recovery.NEGATIVE[observation.lastEvent]) {
          var command = commands.find(function (row) { return row && row.commandId === observation.commandId; });
          var recovered = await (deps.recovery || Recovery).recover({ store: store, command: command, actionId: observation.actionId, observation: observation, now: Date.now() });
          if (recovered.status === 'FUTURE_DELIVERY_SUPPRESSED') recoveries.push(recovered); else recoveryHolds.push(recovered);
        }
      }
      res.statusCode = 200; return res.end(JSON.stringify({ ok: true, schemaVersion: 'religion-subscriber-observer-cycle/1.0',
        inspectedCommands: commands.length, observations: observations, learned: learned, duplicates: duplicates,
        learningAbstentions: learningAbstentions, recoveries: recoveries.length, recoveryHolds: recoveryHolds,
        sendEndpointCalled: false, liveMoney: false }));
    } catch (error) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: 'religion-subscriber-observer-unavailable', detail: String(error && error.message || error), sendEndpointCalled: false, liveMoney: false })); }
  };
}
var handler = createHandler(); module.exports = require('../lib/heartbeat').wrap('religion-subscriber-outcome-observer', handler); module.exports.createHandler = createHandler;
