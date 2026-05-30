/**
 * LIMEN Helix — Outcome Aggregator (client)
 *
 * Caches and exposes per-lane / per-domain / per-cik outcome efficacy
 * counters so the Master Living Brain can bias readiness scoring by
 * historical approval rate.
 *
 * Pulled from GET /api/limen-outcome?byLane=1.
 *
 * Master uses the laneEfficacyMultiplier (range [0.5, 1.5], neutral
 * 1.0 when sample size is 0) to scale operator-readiness scores. When
 * approval rate is high, the master fires that lane more aggressively;
 * when historical rejection is dominant, the lane is throttled.
 *
 * Exposed via window.LIMENOutcomeAggregator.
 *
 *   .ready()                              → Promise<void>
 *   .getLaneEfficacy(lane)                → multiplier ∈ [0.5, 1.5]
 *   .getLaneCounters(lane)                → {submitted, approved, rejected, ...}
 *   .getDomainEfficacy(domain)            → multiplier
 *   .getCikEfficacy(cik)                  → multiplier (note: per-CIK pulls are eager, not cached)
 *   .refresh()                            → re-fetch lane aggregate
 *   .recordOutcome(outputId, eventType, opts)  → POST event
 */
(function (root) {
  'use strict';

  var ENDPOINT = '/api/limen-outcome';
  var REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 min between auto-refresh

  var _laneCache = null;   // { lane: { approved, rejected, laneEfficacyMultiplier, ... } }
  var _laneFetchedAt = 0;
  var _readyPromise = null;
  var _cikCache = new Map();  // cik → counters (TTL 5 min)
  var _domainCache = new Map();

  function fetchLanes() {
    return fetch(ENDPOINT + '?byLane=1', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.ok && j.byLane) {
          _laneCache = j.byLane;
          _laneFetchedAt = Date.now();
        }
        return _laneCache;
      })
      .catch(function () { return _laneCache; });
  }

  function ready() {
    if (_readyPromise) return _readyPromise;
    _readyPromise = fetchLanes();
    return _readyPromise;
  }

  function _maybeRefresh() {
    if (Date.now() - _laneFetchedAt > REFRESH_INTERVAL_MS) {
      return fetchLanes();
    }
    return Promise.resolve(_laneCache);
  }

  function getLaneCounters(lane) {
    if (!_laneCache) return null;
    return _laneCache[lane] || null;
  }

  function getLaneEfficacy(lane) {
    var c = getLaneCounters(lane);
    if (!c) return 1.0;
    return (typeof c.laneEfficacyMultiplier === 'number') ? c.laneEfficacyMultiplier : 1.0;
  }

  function getDomainEfficacy(domain) {
    if (!domain) return 1.0;
    var c = _domainCache.get(domain);
    if (c && (Date.now() - c.fetchedAt) < REFRESH_INTERVAL_MS) {
      return c.value;
    }
    // Fetch async; return neutral until next call cycle
    fetch(ENDPOINT + '?domain=' + encodeURIComponent(domain), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var m = (j && j.counters && j.counters.laneEfficacyMultiplier) || 1.0;
        _domainCache.set(domain, { value: m, fetchedAt: Date.now() });
      })
      .catch(function () {});
    return c ? c.value : 1.0;
  }

  function getCikEfficacy(cik) {
    if (!cik) return 1.0;
    var c = _cikCache.get(cik);
    if (c && (Date.now() - c.fetchedAt) < REFRESH_INTERVAL_MS) {
      return c.value;
    }
    fetch(ENDPOINT + '?cik=' + encodeURIComponent(cik), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var m = (j && j.counters && j.counters.laneEfficacyMultiplier) || 1.0;
        _cikCache.set(cik, { value: m, fetchedAt: Date.now() });
      })
      .catch(function () {});
    return c ? c.value : 1.0;
  }

  // POST an outcome event. Used by viewer UI status-promote action, by
  // ops dashboards, etc.
  function recordOutcome(outputId, eventType, opts) {
    if (!outputId || !eventType) {
      return Promise.reject(new Error('outputId + eventType required'));
    }
    opts = opts || {};
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        outputId: outputId,
        eventType: eventType,
        actor: opts.actor || null,
        notes: opts.notes || null,
        amount: opts.amount || null,
        externalRefId: opts.externalRefId || null,
        lane: opts.lane || null,
        domain: opts.domain || null,
        cik: opts.cik || null
      })
    })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      // Invalidate the lane cache so the next master cycle picks up
      // the new aggregate.
      if (j && j.ok) { _laneFetchedAt = 0; }
      return j;
    });
  }

  function refresh() { return fetchLanes(); }

  function stats() {
    return {
      hasCache: !!_laneCache,
      lanes: _laneCache ? Object.keys(_laneCache).length : 0,
      cikCached: _cikCache.size,
      domainCached: _domainCache.size,
      laneFetchedAt: _laneFetchedAt,
      laneAgeSec: _laneFetchedAt > 0 ? Math.round((Date.now() - _laneFetchedAt) / 1000) : null
    };
  }

  root.LIMENOutcomeAggregator = {
    ready: ready,
    getLaneCounters: getLaneCounters,
    getLaneEfficacy: getLaneEfficacy,
    getDomainEfficacy: getDomainEfficacy,
    getCikEfficacy: getCikEfficacy,
    recordOutcome: recordOutcome,
    refresh: refresh,
    stats: stats,
    _maybeRefresh: _maybeRefresh
  };

  // Auto-load on script eval
  ready();

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
