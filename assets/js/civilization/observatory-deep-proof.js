/**
 * observatory-deep-proof.js — Lazy deep-proof loader for Observatory cards
 *
 * Hard rules:
 *   - Lazy-loaded only on EXPLICIT user action (call to load(diagnosisId)).
 *   - NO fetch on page boot. The module exposes API only; nothing fires
 *     until a caller invokes load().
 *   - LRU cache CAPPED AT 2 diagnosis entries. Each aggregated payload
 *     can be ~50 MB; capping at 2 prevents memory blow-up. A third
 *     load evicts the oldest cached entry.
 *   - Negative-cache 404 / missing files for 1 hour. Subsequent calls
 *     for a known-missing diagnosis return null without any fetch.
 *   - NEVER calls /api/fetch-portal. The only network endpoint touched
 *     is /assets/data/aggregated/<DIAGNOSIS>.deep.json (static path).
 *   - Concurrent calls for the same diagnosis dedupe to one in-flight
 *     promise.
 *
 * Loading-state hook:
 *   isLoading(diagnosisId) returns true while a fetch is in flight,
 *   so the UI can show "Loading large deep proof…" between click and
 *   resolution.
 *
 * Exposes: window.LIMENObservatoryDeepProof
 *   load(diagnosisId)        // Promise<data | null>
 *   getCached(diagnosisId)   // data | null (no fetch)
 *   isLoading(diagnosisId)   // boolean
 *   isMissing(diagnosisId)   // boolean (neg-cached)
 *   getStatus()              // diagnostic snapshot
 */
(function () {
  'use strict';

  var LRU_CAP = 2;                    // hard cap on cached diagnosis entries
  var NEG_CACHE_TTL = 3600000;        // 1 hour
  var BASE_PATH = '/assets/data/aggregated/';

  // LRU cache. Most-recently-accessed entry is at the END of the array.
  var _cache = [];                    // [{ diagnosisId, data, loadedAt }]
  var _negCache = {};                 // diagnosisId -> timestamp
  var _inFlight = {};                 // diagnosisId -> Promise (dedup)
  var _loadingState = {};             // diagnosisId -> true while fetching

  function _findIndex(diagnosisId) {
    for (var i = 0; i < _cache.length; i++) {
      if (_cache[i].diagnosisId === diagnosisId) return i;
    }
    return -1;
  }

  function _evictUntilUnderCap() {
    while (_cache.length >= LRU_CAP) {
      _cache.shift(); // remove oldest (least recently accessed)
    }
  }

  function _bumpToMRU(idx) {
    var entry = _cache.splice(idx, 1)[0];
    _cache.push(entry);
    return entry;
  }

  function getCached(diagnosisId) {
    if (!diagnosisId) return null;
    var idx = _findIndex(diagnosisId);
    if (idx === -1) return null;
    var entry = _bumpToMRU(idx);
    return entry.data;
  }

  function isLoading(diagnosisId) {
    return !!_loadingState[diagnosisId];
  }

  function isMissing(diagnosisId) {
    var ts = _negCache[diagnosisId];
    return !!(ts && (Date.now() - ts) < NEG_CACHE_TTL);
  }

  function load(diagnosisId) {
    if (!diagnosisId || typeof diagnosisId !== 'string') {
      return Promise.resolve(null);
    }

    // Cache hit (also bumps to MRU).
    var cached = getCached(diagnosisId);
    if (cached) return Promise.resolve(cached);

    // Negative cache — file confirmed missing within the last hour.
    if (isMissing(diagnosisId)) {
      return Promise.resolve(null);
    }

    // Dedup concurrent calls for the same id.
    if (_inFlight[diagnosisId]) {
      return _inFlight[diagnosisId];
    }

    _loadingState[diagnosisId] = true;
    var url = BASE_PATH + encodeURIComponent(diagnosisId) + '.deep.json';

    var promise = fetch(url)
      .then(function (r) {
        if (r.status === 404) {
          // File genuinely missing. Negative-cache for an hour.
          _negCache[diagnosisId] = Date.now();
          return null;
        }
        if (!r.ok) {
          // Other non-2xx (5xx, network) — treat as transient. Throw so
          // the outer .catch returns null without populating neg-cache,
          // allowing retry on next user action.
          throw new Error('deep-proof http ' + r.status);
        }
        return r.json();
      })
      .then(function (data) {
        if (data) {
          _evictUntilUnderCap();
          _cache.push({ diagnosisId: diagnosisId, data: data, loadedAt: Date.now() });
        }
        return data;
      })
      .catch(function () {
        // Transient. Do NOT neg-cache.
        return null;
      })
      .then(function (result) {
        _loadingState[diagnosisId] = false;
        delete _inFlight[diagnosisId];
        return result;
      });

    _inFlight[diagnosisId] = promise;
    return promise;
  }

  function getStatus() {
    return {
      cacheSize: _cache.length,
      cacheCap: LRU_CAP,
      cachedIds: _cache.map(function (e) { return e.diagnosisId; }),
      negCacheCount: Object.keys(_negCache).length,
      inFlight: Object.keys(_inFlight)
    };
  }

  window.LIMENObservatoryDeepProof = {
    load: load,
    getCached: getCached,
    isLoading: isLoading,
    isMissing: isMissing,
    getStatus: getStatus
  };

})();
