/**
 * LIMEN Helix — CIK Coverage Expander
 *
 * Pulls the command-board's company universe into a rotating candidate
 * pool for the Master Living Brain. Without this, master.fire() falls
 * back to a single hard-coded anchor CIK (Walmart) — so all artifacts
 * would be Walmart-only.
 *
 * Reads /assets/data/command-board-data.json once at init.
 * Filters by:
 *   - kernelStatus in {ELIGIBLE_NOW, INGESTION_SUSPECT} per the
 *     Operating Envelope (ERROR-tier stubs excluded)
 *   - per-lane affinity (heuristic per company.domain)
 * Rotates candidates per (lane, cycle) so we don't always pick the same
 * one. Skips candidates that already have a recent artifact for that
 * lane (cool-down to avoid duplicate work).
 *
 * Exposed via window.LIMENCikCoverage:
 *   .ready()                      → Promise<void>
 *   .getCandidatesForLane(lane, n) → [{cik, slug, name, domain, weight}]
 *   .nextCandidate(lane)          → {cik, slug, name, domain} | null
 *   .recordFire(cik, lane)        → cooldown tracker
 *   .stats()                      → coverage stats
 */
(function (root) {
  'use strict';

  // Per the engine sequence + command-board canonical map.
  // Maps each lane to the domains whose companies are good candidates.
  var LANE_AFFINITY = {
    patent:     ['technology', 'medicine', 'energy', 'infrastructure', 'industry', 'science', 'agriculture'],
    grant:      ['science', 'medicine', 'agriculture', 'energy', 'environment', 'education', 'defense', 'infrastructure'],
    sba:        ['economy', 'finance', 'industry', 'agriculture', 'supplyChain', 'infrastructure', 'communication'],
    franchise:  ['economy', 'industry', 'medicine', 'finance', 'communication', 'trade'],
    investment: ['finance', 'economy', 'technology', 'medicine', 'energy', 'industry', 'infrastructure'],
    research:   ['science', 'medicine', 'technology', 'environment', 'agriculture', 'energy', 'population']
  };

  var ALLOWED_KERNEL_STATUS = ['ELIGIBLE_NOW', 'INGESTION_SUSPECT', null, undefined];

  // Cool-down per (cik, lane). Once we fire on a (cik, lane), don't fire
  // again for COOLDOWN_MS even if rotation comes back around.
  var COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

  var _allCompanies = [];
  var _byLaneCache = {};
  var _lastFireAt = {};
  var _laneRotationIndex = {};
  var _loaded = false;
  var _loadPromise = null;
  var _loadError = null;

  function _normalizeCompany(c) {
    if (!c || typeof c !== 'object') return null;
    // Command-board entries use compact keys: c=cik, t=ticker, d=domain, p=phase, ds=stress
    return {
      cik: String(c.cik || c.c || '').trim() || null,
      ticker: c.ticker || c.t || null,
      slug: c.slug || (c.t ? String(c.t).toLowerCase() : null),
      name: c.name || c.n || c.companyName || null,
      domain: c.domain || c.d || null,
      subTag: c.subTag || c.subcategory || null,
      kernelStatus: c.kernelStatus || c.ks || null,
      phase: c.phase || c.p || null,
      stress: typeof c.stress === 'number' ? c.stress :
              (typeof c.ds === 'number' ? c.ds : null),
      alert: c.alert || c.a || null,
      composite: typeof c.composite === 'number' ? c.composite :
                 (typeof c.compositeScore === 'number' ? c.compositeScore : null)
    };
  }

  function _load() {
    if (_loadPromise) return _loadPromise;
    _loadPromise = fetch('/assets/data/command-board-data.json', { cache: 'force-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('command-board fetch ' + r.status);
        return r.json();
      })
      .then(function (j) {
        var raw = (j && Array.isArray(j.companies)) ? j.companies :
                  (Array.isArray(j) ? j : []);
        var seen = {};
        _allCompanies = [];
        for (var i = 0; i < raw.length; i++) {
          var c = _normalizeCompany(raw[i]);
          if (!c || !c.cik) continue;
          if (seen[c.cik]) continue;
          // Filter by kernel status
          if (ALLOWED_KERNEL_STATUS.indexOf(c.kernelStatus) === -1) continue;
          seen[c.cik] = true;
          _allCompanies.push(c);
        }
        _loaded = true;
        _loadError = null;
      })
      .catch(function (err) {
        _loadError = String(err && err.message || err);
        _allCompanies = [];
        _loaded = true; // mark loaded so callers don't hang; the array is just empty
      });
    return _loadPromise;
  }

  function ready() { return _load(); }

  // Build (and memoize) the per-lane sorted candidate list.
  function _candidatesForLane(lane) {
    if (_byLaneCache[lane]) return _byLaneCache[lane];
    var affinity = LANE_AFFINITY[lane] || [];
    var pool = _allCompanies.filter(function (c) {
      if (!c.domain) return false;
      return affinity.indexOf(c.domain) !== -1;
    });
    // Score: prefer ELIGIBLE_NOW, then higher composite if available.
    // For grant: prefer higher stress (need-driven framing). For
    // investment: prefer phase in p5/p6/p10 (order phases per memory).
    pool = pool.map(function (c) {
      var score = 0;
      if (c.kernelStatus === 'ELIGIBLE_NOW') score += 10;
      if (typeof c.composite === 'number') score += c.composite * 5;
      if (lane === 'grant' || lane === 'sba') {
        if (typeof c.stress === 'number') score += c.stress * 6;
      }
      if (lane === 'investment') {
        var orderPhases = { p5: 5, p6: 5, p10: 5, p4: 2 };
        score += orderPhases[c.phase] || 0;
      }
      if (lane === 'patent' || lane === 'research') {
        if (typeof c.stress === 'number') score += (1 - c.stress) * 4;
      }
      return Object.assign({}, c, { _score: score });
    });
    pool.sort(function (a, b) { return b._score - a._score; });
    _byLaneCache[lane] = pool;
    return pool;
  }

  function getCandidatesForLane(lane, n) {
    if (!_loaded) return [];
    n = Math.min(Math.max(n || 25, 1), 200);
    var pool = _candidatesForLane(lane);
    return pool.slice(0, n).map(function (c) {
      return {
        cik: c.cik, slug: c.slug, name: c.name, domain: c.domain,
        kernelStatus: c.kernelStatus, phase: c.phase, weight: c._score
      };
    });
  }

  // Pick the next candidate for a lane. Rotates through the top-K with
  // cool-down so we don't hit the same (cik, lane) repeatedly.
  function nextCandidate(lane) {
    if (!_loaded) return null;
    var pool = _candidatesForLane(lane);
    if (!pool.length) return null;
    var TOP_K = Math.min(20, pool.length); // rotate through top 20
    var idx = _laneRotationIndex[lane] || 0;
    var attempts = 0;
    while (attempts < TOP_K) {
      var c = pool[idx % TOP_K];
      idx = (idx + 1) % TOP_K;
      attempts++;
      // Cool-down check
      var k = c.cik + ':' + lane;
      var last = _lastFireAt[k] || 0;
      if (Date.now() - last >= COOLDOWN_MS) {
        _laneRotationIndex[lane] = idx;
        return {
          cik: c.cik, slug: c.slug, name: c.name, domain: c.domain,
          phase: c.phase, kernelStatus: c.kernelStatus
        };
      }
    }
    // All top-K are cooling; fall through to lane fallback
    return null;
  }

  function recordFire(cik, lane) {
    if (!cik || !lane) return;
    _lastFireAt[cik + ':' + lane] = Date.now();
  }

  function stats() {
    var totalsByDomain = {};
    var totalsByStatus = {};
    _allCompanies.forEach(function (c) {
      totalsByDomain[c.domain || 'unknown'] = (totalsByDomain[c.domain || 'unknown'] || 0) + 1;
      totalsByStatus[c.kernelStatus || 'null'] = (totalsByStatus[c.kernelStatus || 'null'] || 0) + 1;
    });
    var fires = 0;
    var keys = Object.keys(_lastFireAt);
    for (var i = 0; i < keys.length; i++) fires++;
    return {
      loaded: _loaded,
      loadError: _loadError,
      totalCompanies: _allCompanies.length,
      byDomain: totalsByDomain,
      byKernelStatus: totalsByStatus,
      totalFires: fires,
      cooldownMs: COOLDOWN_MS
    };
  }

  root.LIMENCikCoverage = {
    ready: ready,
    getCandidatesForLane: getCandidatesForLane,
    nextCandidate: nextCandidate,
    recordFire: recordFire,
    stats: stats,
    LANE_AFFINITY: LANE_AFFINITY
  };

  // Auto-load on script eval
  _load();

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
