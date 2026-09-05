/**
 * api/limen-health.js — System health check
 *
 * GET /api/limen-health
 *
 * Returns status of all backend systems.
 */

var db = require('../lib/limen-db');
var cronAuth = require('../lib/cron-auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  var health = {
    timestamp: Date.now(),
    backend: db.getBackend(),
    dbPing: await db.ping(),
    snapshots: {},
    workers: {}
  };

  // Check snapshot freshness
  var console_snap = await db.get('console_snapshot');
  var opp_snap = await db.get('opportunities_snapshot');
  var latest_ingest = await db.get('latest_ingest');

  health.snapshots.console = console_snap ? {
    exists: true,
    age: Math.round((Date.now() - console_snap.generatedAt) / 1000) + 's',
    domains: console_snap.domainCount,
    live: console_snap.liveCount
  } : { exists: false };

  health.snapshots.opportunities = opp_snap ? {
    exists: true,
    age: Math.round((Date.now() - opp_snap.generatedAt) / 1000) + 's',
    count: opp_snap.count
  } : { exists: false };

  health.workers.ingest = latest_ingest ? {
    lastRun: Math.round((Date.now() - latest_ingest.timestamp) / 1000) + 's ago',
    articles: latest_ingest.totalArticles,
    signals: latest_ingest.signals ? latest_ingest.signals.length : 0,
    macroShock: latest_ingest.macroShock ? latest_ingest.macroShock.detected : false
  } : { lastRun: 'never' };

  // ── Stress-promotion visibility (2026-09-05) ──
  // The worker ALREADY computes why a domain fails to ground: limen-worker-snapshot.js:467
  // runs phaseAbstentionDiagnostic.inspect() on exactly the abstaining path and stores the
  // result at console_snapshot.domains[pk].phaseBelief. Nothing ever read it back, so a
  // domain could sit un-promoted indefinitely with its own reason computed every cycle and
  // visible to no one. Measured 2026-09-05: energy, education and law were all un-promoted.
  //
  // Promotion is double-gated (limen-worker-snapshot.js:497):
  //   isStressPromotionEligible(pk) && est.grounded
  // The allowlist defaults to all twenty domains, so in the default configuration an
  // un-promoted domain is ALWAYS an ungrounded estimator, never an allowlist omission.
  // `eligible` is reported per domain anyway so an operator who narrows the env var can
  // still tell the two causes apart without reading the worker.
  //
  // An un-promoted domain keeps the feed-volume stress the worker's own comment calls
  // KNOWN-BAD. Read-only and fails soft: any error leaves the section absent and the rest
  // of the health payload unchanged.
  // BEARER-GATED, AND ONLY THIS SECTION.
  //
  // This endpoint was already public and its existing fields STAY public. Narrowing a
  // pre-existing public surface is an operator decision, not a side effect of adding a
  // field to it, so the gate covers exactly what this change introduced and nothing else.
  // Abstention reasons, precision floors and per-channel precision are internal estimator
  // state, and this URL has no auth of any kind.
  //
  // `authorize` and not `enforce`: enforce() ends the response 401, which would take the
  // whole health payload private. A caller without a token gets everything it got before,
  // minus this block.
  //
  // FAILS CLOSED. cron-auth returns ok:false when CRON_SECRET is unset
  // (reason 'cron-secret-unconfigured'), so a misconfigured environment omits the section
  // rather than publishing it. The marker names the reason so an operator can tell "gated"
  // apart from "no un-promoted domains" without guessing, and carries no diagnostic content.
  var diagAuth = cronAuth.authorize(req);
  if (!diagAuth.ok) health.stressPromotion = { gated: true, reason: diagAuth.reason };
  else try {
    var csDomains = (console_snap && console_snap.domains) || null;
    if (csDomains) {
      var promotion = { promoted: 0, unpromoted: 0, domains: {} };
      for (var pk in csDomains) {
        if (!Object.prototype.hasOwnProperty.call(csDomains, pk)) continue;
        var d = csDomains[pk] || {};
        if (d.stressSource === 'node-market-feed-grounded') { promotion.promoted++; continue; }
        promotion.unpromoted++;

        // Only un-promoted domains are detailed. The promoted ones have nothing to explain,
        // and this is a health endpoint, not a data surface.
        var pb = d.phaseBelief || {};
        var diag = pb.precisionDiagnostic || null;
        var chans = Array.isArray(pb.channels) ? pb.channels : [];
        var entry = {
          grounded: pb.grounded === true,
          reason: pb.reason || null,
          confidence: typeof pb.confidence === 'number' ? pb.confidence : null,
          // Legacy feed-volume stress is what this domain is publishing INSTEAD.
          feedStress: typeof d.stress === 'number' ? d.stress : null
        };
        if (diag) {
          entry.precisionFloor = diag.floor;
          entry.totalPrecision = diag.totalPrecision;
          // How far short, so an operator can see whether this is a near-miss or a chasm.
          entry.precisionShortfall = (typeof diag.floor === 'number' && typeof diag.totalPrecision === 'number')
            ? Math.round((diag.floor - diag.totalPrecision) * 1000) / 1000
            : null;
          if (Array.isArray(diag.channels)) chans = diag.channels;
        }
        if (chans.length) {
          entry.channelsTotal = chans.length;
          entry.channelsInformative = chans.filter(function (c) { return c && c.informative; }).length;
          // The five weakest channels: this is the list to attack when raising precision.
          entry.weakestChannels = chans
            .filter(function (c) { return c && typeof c.precision === 'number'; })
            .sort(function (a, b) { return a.precision - b.precision; })
            .slice(0, 5)
            .map(function (c) { return { key: c.key, precision: c.precision, informative: !!c.informative }; });
        }
        promotion.domains[pk] = entry;
      }
      health.stressPromotion = promotion;
    }
  } catch (e) {
    health.stressPromotion = { error: 'unavailable: ' + e.message };
  }

  // Overall status
  health.status = health.dbPing.status === 'ok' ? 'OK' : 'DEGRADED';

  res.status(200).json(health);
};
