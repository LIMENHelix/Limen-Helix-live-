'use strict';

/** Cron return path for already-admitted independent research evaluations. */

var cronAuth = require('../lib/cron-auth.js');
var store = require('../lib/autofire-efference-store.js');
var Intake = require('../lib/research-evaluation-intake.js');
var Observer = require('../lib/research-evaluation-observer.js');
var outcome = require('./limen-outcome.js');

async function researchEvaluationObserverHandler(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    return res.end(JSON.stringify({ ok: false, error: 'GET only' }));
  }
  if (!cronAuth.enforce(req, res)) return;
  try {
    store.assertDurable();
    var log = await store.lrange(Intake.LOG_KEY, 0, 199);
    var inspected = await Observer.inspect(store, log);
    var recorded = 0, duplicates = 0, abstentions = [], failures = [];
    for (var i = 0; i < inspected.length; i++) {
      var row = inspected[i];
      if (row.status !== 'ELIGIBLE') { abstentions.push(row); continue; }
      var result = await outcome.recordAutonomousOutcome(row.event);
      if (result && result.ok && result.learningAccepted !== false) {
        if (result.duplicate) duplicates++;
        else recorded++;
      } else failures.push({ observationId: row.observationId, error: result && (result.error || result.detail) || 'outcome-record-failed' });
    }
    res.statusCode = failures.length ? 503 : 200;
    return res.end(JSON.stringify({
      ok: failures.length === 0,
      source: Intake.LOG_KEY,
      examined: inspected.length,
      eligible: inspected.filter(function (row) { return row.status === 'ELIGIBLE'; }).length,
      recorded: recorded,
      duplicates: duplicates,
      abstentions: abstentions,
      failures: failures,
      note: 'only durably admitted, source-separated Science/Medicine evaluation records can reach learning'
    }));
  } catch (error) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ ok: false, error: 'research-evaluation-observer-failed', detail: String(error && error.message || error) }));
  }
}

module.exports = require('../lib/heartbeat').wrap('limen-research-evaluation-observer', researchEvaluationObserverHandler);

