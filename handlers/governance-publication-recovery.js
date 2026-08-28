'use strict';

var Gate = require('../lib/admin-gate.js');
var Store = require('../lib/autofire-efference-store.js');
var Executor = require('../lib/governance-publication-executor.js');
var Observer = require('../lib/governance-publication-observer.js');
var Recovery = require('../lib/governance-publication-recovery.js');
var Publisher = require('../lib/governance-publication-publisher.js');

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json'); res.setHeader('cache-control', 'no-store');
  if (String(req.method || '').toUpperCase() !== 'POST') { res.statusCode = 405; return res.end(JSON.stringify({ ok: false, error: 'POST only' })); }
  var pass = Gate.reqKey(req); if (!Gate.hasDomain(pass, 'governance')) return Gate.deny(res);
  try {
    var body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    var command = await Store.get(Executor.commandKey(body.commandId));
    var observations = await Store.lrange(Observer.LOG_KEY, 0, 499);
    var observation = observations.find(function (row) { return row && command && row.commandId === command.commandId; }) || null;
    var result = await Recovery.recover({
      store: Store, command: command, observation: observation, trigger: body.trigger, now: Date.now(),
      publisher: Publisher,
      observePublicAbsence: function (articleId) { return Observer.publicAbsent(global.fetch, articleId, process.env.LIMEN_BASE_URL || 'https://limenhelix.com'); }
    });
    res.statusCode = result.status === 'REFUSED' ? 400 : 200; return res.end(JSON.stringify(result));
  } catch (error) {
    res.statusCode = 503; return res.end(JSON.stringify({ ok: false, error: 'governance-publication-recovery-unavailable', detail: String(error && error.message || error) }));
  }
};
