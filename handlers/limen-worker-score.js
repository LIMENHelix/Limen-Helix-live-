// handlers/limen-worker-score.js — lightweight, FREQUENT company scorer.
//
// The heavy snapshot worker (limen-worker-snapshot, every 15 min) also scores,
// but it re-fetches all external feeds to rebuild the snapshot — expensive, so it
// can't run often. This decoupled cron does ONLY scoring: it reads domain stress
// from the already-cached console_snapshot (Redis, no external calls, no cost) and
// scores a batch every 5 min, writing company_phase_* keys. The snapshot worker's
// buildDomainJoin() picks those scores up. Net effect: ~3x faster CIK coverage at
// the SAME per-run concurrency (avoids the EDGAR-throttling that bigger batches hit).

var db = require('../lib/limen-db');
var DOMAIN_NAMES = require('../lib/domain-names');
var companyScorer = require('../lib/company-phase-scorer');

// snapshot uses runtime keys; the company registry (scoreBatch) uses portal keys —
// map so dual-key domains (research/health/supplyChain) get priority scoring too.
// Domain naming is reconciled in ONE place: lib/domain-names.js. This map used to be
// written out here by hand, one of eight such copies. See that file for how a missing
// alias disguises itself as absent data.


module.exports = async function handler(req, res) {
  try {
    var snap = await db.get('console_snapshot');
    var domains = (snap && snap.domains) || {};
    var domainHealth = {};
    for (var dk in domains) {
      if (!domains.hasOwnProperty(dk)) continue;
      var pk = DOMAIN_NAMES.toCanonical(dk);
      domainHealth[pk] = { stress: (domains[dk] && domains[dk].stress) || 0 };
    }
    // scoreBatch reads only domainHealth[key].stress. If no cached snapshot, it
    // falls back to pure round-robin (still advances coverage) — graceful.
    var result = await companyScorer.scoreBatch(domainHealth);
    res.status(200).json({
      ok: true,
      totalScored: result.totalScored,
      priorityCount: result.priorityCount,
      roundRobinCount: result.roundRobinCount,
      domainsWithHealth: Object.keys(domainHealth).length
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
};

// Every run records itself. lib/heartbeat is the spike log the /main-brain view
// animates: one beat is one spike, and silence is what starves an edge to nothing.
module.exports = require('../lib/heartbeat').wrap('limen-worker-score', module.exports);
