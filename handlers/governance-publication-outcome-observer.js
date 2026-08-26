'use strict';

var CronAuth = require('../lib/cron-auth.js');
var Store = require('../lib/autofire-efference-store.js');
var Executor = require('../lib/governance-publication-executor.js');
var Observer = require('../lib/governance-publication-observer.js');
var Learning = require('../lib/governance-publication-learning.js');

function createHandler(deps) {
  deps = deps || {};
  var store = deps.store || Store, auth = deps.cronAuth || CronAuth, observer = deps.observer || Observer, learning = deps.learning || Learning;
  return async function handler(req, res) {
    res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store');
    if (String(req.method || 'GET').toUpperCase() !== 'GET') { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: 'GET only' })); }
    if (!auth.enforce(req, res)) return;
    try {
      store.assertDurable();
      var commands = await store.lrange(Executor.LOG_KEY, 0, 99);
      var byAction = Object.create(null), presence = [];
      for (var i = 0; i < commands.length; i++) {
        var command = commands[i];
        if (!command || command.status !== 'PUBLISHED') continue;
        byAction[command.actionId] = command;
        presence.push(await observer.observePresence(store, command, deps.fetch || global.fetch, deps.baseUrl || process.env.LIMEN_BASE_URL || 'https://limenhelix.com'));
      }
      var events = await store.lrange(Observer.ENGAGEMENT_LOG_KEY, 0, 499), engagement = [], learned = 0;
      for (var e = 0; e < events.length; e++) {
        var observation = await observer.observeEngagement(store, events[e], byAction);
        engagement.push(observation);
        var result = await learning.recordObservation(store, observation);
        if (result.ok && !result.duplicate) learned++;
      }
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, schemaVersion: 'governance-publication-observer-cycle/1.0',
        inspectedCommands: commands.length, inspectedEngagementEvents: events.length, presence: presence,
        engagement: engagement, learned: learned, publishEndpointCalled: false, liveMoney: false }));
    } catch (error) {
      res.statusCode = 503;
      return res.end(JSON.stringify({ ok: false, error: 'governance-publication-observer-unavailable', detail: String(error && error.message || error), publishEndpointCalled: false, liveMoney: false }));
    }
  };
}

var handler = createHandler();
module.exports = require('../lib/heartbeat').wrap('governance-publication-outcome-observer', handler);
module.exports.createHandler = createHandler;
