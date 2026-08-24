'use strict';

/**
 * Cron-driven observer for persisted research publication receipts.
 *
 * This worker reads the owned journal only; it never publishes, calls an AI
 * provider, places an order, or interprets a publication as progress. It
 * requires Redis because a process-memory article list cannot support a
 * durable outcome claim. Research evaluation and investment P&L remain
 * separate observers and are not manufactured here.
 */

var db = require('../lib/limen-db');
var cronAuth = require('../lib/cron-auth');
var observer = require('../lib/autofire-outcome-observer');
var outcome = require('./limen-outcome');

module.exports = async function handler(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    return res.end(JSON.stringify({ ok: false, error: 'GET only' }));
  }
  if (!cronAuth.enforce(req, res)) return;
  if (db.getBackend() !== 'redis') {
    res.statusCode = 503;
    return res.end(JSON.stringify({
      ok: false,
      error: 'observer-storage-not-durable',
      reason: 'owned-site publication observations require Redis-backed source and outcome stores'
    }));
  }

  try {
    var read = typeof db.lrangeStrict === 'function' ? db.lrangeStrict : db.lrange;
    var articles = await read('site:articles', 0, 499);
    var inspected = observer.inspectArticles(articles, Date.now());
    var recorded = 0;
    var duplicates = 0;
    var failures = [];
    for (var i = 0; i < inspected.events.length; i++) {
      var result = await outcome.recordAutonomousOutcome(inspected.events[i]);
      if (result && result.ok && result.learningAccepted !== false) {
        if (result.duplicate) duplicates++;
        else recorded++;
      } else {
        failures.push({
          observationId: inspected.events[i].observationId,
          error: result && (result.error || result.detail) || 'outcome-record-failed'
        });
      }
    }
    res.statusCode = failures.length ? 503 : 200;
    return res.end(JSON.stringify({
      ok: failures.length === 0,
      source: 'owned-site-journal',
      examined: inspected.examined,
      eligible: inspected.eligible,
      recorded: recorded,
      duplicates: duplicates,
      abstentions: inspected.abstentions,
      failures: failures,
      evaluated: 0,
      note: 'publication receipts are observations only; no research progress or investment outcome is emitted'
    }));
  } catch (err) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ ok: false, error: 'observer-failed', detail: String(err && err.message || err) }));
  }
};
