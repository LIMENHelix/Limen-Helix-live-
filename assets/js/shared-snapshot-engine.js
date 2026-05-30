/**
 * shared-snapshot-engine.js — Single Snapshot Fetch Coordination Layer
 *
 * PERCEPTION ONLY. Does not interpret, score, or diagnose.
 *
 * Fetches /api/domain-snapshot ONCE per cycle.
 * Caches the latest payload in memory.
 * Broadcasts to all consumers via events.
 * Deduplicates concurrent fetches (one in-flight promise).
 *
 * Consumers (refresh controllers, signal engine, brains) subscribe
 * instead of fetching independently. Domain brains remain sovereign —
 * they interpret the shared snapshot in their own way.
 *
 * Exposes: window.LIMENSharedSnapshot
 */
(function () {
  'use strict';

  var FETCH_INTERVAL = 30000;  // 30 seconds
  var STALE_THRESHOLD = 60000; // 60 seconds — snapshot considered stale
  var ENDPOINT = '/api/domain-snapshot';

  var _latestSnapshot = null;
  var _latestTimestamp = 0;
  var _fetchCount = 0;
  var _inFlight = null;       // Promise — deduplicate concurrent requests
  var _subscribers = [];
  var _timer = null;
  var _started = false;
  var _errors = 0;

  // ══════════════════════════════════════════════════════════════════════
  // CORE FETCH — single in-flight promise, no duplicates
  // ══════════════════════════════════════════════════════════════════════

  function fetchSnapshot() {
    // If already fetching, return the existing promise
    if (_inFlight) return _inFlight;

    _inFlight = fetch(ENDPOINT)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        _inFlight = null;
        if (data && data.domains) {
          _latestSnapshot = data;
          _latestTimestamp = Date.now();
          _fetchCount++;
          _errors = 0;
          _broadcast('update', data);
        } else {
          _errors++;
          _broadcast('error', { reason: 'empty response', fetchCount: _fetchCount });
        }
        return data;
      })
      .catch(function (err) {
        _inFlight = null;
        _errors++;
        _broadcast('error', { reason: err.message, fetchCount: _fetchCount });
        return null;
      });

    return _inFlight;
  }

  // ══════════════════════════════════════════════════════════════════════
  // BROADCAST — notify all subscribers
  // ══════════════════════════════════════════════════════════════════════

  function _broadcast(type, data) {
    // Custom event for general listeners
    try {
      window.dispatchEvent(new CustomEvent('limen:snapshot-' + type, { detail: data }));
    } catch (e) {}

    // Direct subscriber callbacks
    for (var i = 0; i < _subscribers.length; i++) {
      try { _subscribers[i](type, data); } catch (e) {}
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  function start() {
    if (_started) return;
    _started = true;

    // Initial fetch
    fetchSnapshot();

    // Recurring fetch — single interval, single fetch
    _timer = setInterval(function () {
      if (document.hidden) return; // Don't fetch when tab is hidden
      fetchSnapshot();
    }, FETCH_INTERVAL);

    console.log('[SharedSnapshot] Started — single fetch every ' + (FETCH_INTERVAL / 1000) + 's');
  }

  function stop() {
    if (_timer) clearInterval(_timer);
    _started = false;
  }

  /**
   * Get the latest cached snapshot immediately.
   * Returns null if no snapshot has been fetched yet.
   */
  function getSnapshot() {
    return _latestSnapshot;
  }

  /**
   * Get a specific domain's data from the cached snapshot.
   */
  function getDomain(domainKey) {
    if (!_latestSnapshot || !_latestSnapshot.domains) return null;
    return _latestSnapshot.domains[domainKey] || null;
  }

  /**
   * Subscribe to snapshot updates.
   * callback(type, data) — type is 'update', 'error', or 'stale'
   */
  function subscribe(callback) {
    if (typeof callback === 'function') _subscribers.push(callback);
  }

  /**
   * Request a fresh fetch. Returns promise.
   * If a fetch is already in-flight, returns the same promise (deduplication).
   */
  function requestFresh() {
    return fetchSnapshot();
  }

  /**
   * Check freshness.
   */
  function isFresh() {
    return _latestTimestamp > 0 && (Date.now() - _latestTimestamp) < STALE_THRESHOLD;
  }

  /**
   * Diagnostic info.
   */
  function getDiagnostics() {
    return {
      fetchCount: _fetchCount,
      lastUpdated: _latestTimestamp,
      age: _latestTimestamp > 0 ? Date.now() - _latestTimestamp : -1,
      fresh: isFresh(),
      subscribers: _subscribers.length,
      errors: _errors,
      started: _started,
      inFlight: !!_inFlight
    };
  }

  window.LIMENSharedSnapshot = {
    start: start,
    stop: stop,
    getSnapshot: getSnapshot,
    getDomain: getDomain,
    subscribe: subscribe,
    requestFresh: requestFresh,
    isFresh: isFresh,
    getDiagnostics: getDiagnostics
  };

})();
