/**
 * LIMEN Fast Boot — Phase 20C (Server-First)
 *
 * Boot priority: SERVER snapshot → localStorage cache → empty shell.
 * localStorage is CACHE ONLY — never primary truth when server has data.
 *
 * Strategy:
 *   1. Fire non-blocking fetch to /api/limen-snapshot (console + opportunities)
 *   2. While fetch is in flight, render from localStorage cache if available
 *   3. When server responds, overwrite UI + cache localStorage
 *   4. Show stale badge if snapshot age > threshold
 *   5. Background refresh via limen:domain-update replaces stale badge
 *
 * Storage keys (cache only):
 *   limen_console_snapshot       — cached console state
 *   limen_opportunities_snapshot — cached opportunities state
 *   limen_boot_timings           — performance metrics
 *   limen_boot_source            — 'server' | 'cache' | 'empty' (last boot)
 */
(function () {
  'use strict';

  var CONSOLE_SNAP_KEY = 'limen_console_snapshot';
  var OPP_SNAP_KEY = 'limen_opportunities_snapshot';
  var TIMINGS_KEY = 'limen_boot_timings';
  var SESSION_KEY = 'limen_session_state';
  var STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

  var _bootStart = Date.now();
  var _timings = {};
  var _serverConsole = null;   // resolved server console snapshot
  var _serverOpps = null;      // resolved server opportunities snapshot
  var _bootSource = 'empty';   // tracks what powered first paint

  function _mark(label) {
    _timings[label] = Date.now() - _bootStart;
  }

  // ══════════════════════════════════════════════════════════════════════
  // A. SERVER-FIRST SNAPSHOT FETCHING
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Fetch snapshot from server. Returns parsed JSON or null.
   * Timeout: 4s — if server is slow, fall back to cache.
   */
  function _fetchServerSnapshot(type) {
    return fetch('/api/limen-snapshot?type=' + type, {
      signal: AbortSignal.timeout(4000)
    }).then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || data.stale === true || data._stale === true || !data.generatedAt) return null;
        return data;
      })
      .catch(function () { return null; });
  }

  // Fire both fetches immediately on script load
  var _serverConsoleFetch = _fetchServerSnapshot('console');
  var _serverOppsFetch = _fetchServerSnapshot('opportunities');

  /**
   * Get console snapshot — server-first, localStorage fallback.
   * Returns a Promise that resolves to snapshot or null.
   */
  function getConsoleSnapshot() {
    if (_serverConsole) {
      return Promise.resolve(_serverConsole);
    }
    return _serverConsoleFetch.then(function (snap) {
      if (snap) {
        _serverConsole = snap;
        _bootSource = 'server';
        _mark('server_console_arrived');
        // Cache to localStorage
        try { localStorage.setItem(CONSOLE_SNAP_KEY, JSON.stringify(snap)); } catch (e) {}
        return snap;
      }
      // Fallback: localStorage cache
      _mark('cache_console_fallback');
      return _getLocalSnapshot(CONSOLE_SNAP_KEY);
    });
  }

  /**
   * Get opportunities snapshot — server-first, localStorage fallback.
   * Returns a Promise that resolves to snapshot or null.
   */
  function getOpportunitiesSnapshot() {
    if (_serverOpps) {
      return Promise.resolve(_serverOpps);
    }
    return _serverOppsFetch.then(function (snap) {
      if (snap) {
        _serverOpps = snap;
        _mark('server_opps_arrived');
        // Cache to localStorage
        try { localStorage.setItem(OPP_SNAP_KEY, JSON.stringify(snap)); } catch (e) {}
        return snap;
      }
      // Fallback: localStorage cache
      _mark('cache_opps_fallback');
      return _getLocalSnapshot(OPP_SNAP_KEY);
    });
  }

  /**
   * Synchronous localStorage read — used as fallback only.
   */
  function _getLocalSnapshot(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var snap = JSON.parse(raw);
      if (!snap || !snap.generatedAt) return null;
      snap._stale = (Date.now() - snap.generatedAt) > STALE_THRESHOLD_MS;
      snap._source = 'cache';
      if (_bootSource === 'empty') _bootSource = 'cache';
      return snap;
    } catch (e) { return null; }
  }

  /**
   * Synchronous snapshot read — for callers that cannot await.
   * Returns cached server snapshot if available, else localStorage, else null.
   */
  function getConsoleSnapshotSync() {
    if (_serverConsole) return _serverConsole;
    return _getLocalSnapshot(CONSOLE_SNAP_KEY);
  }

  function getOpportunitiesSnapshotSync() {
    if (_serverOpps) return _serverOpps;
    return _getLocalSnapshot(OPP_SNAP_KEY);
  }

  // ══════════════════════════════════════════════════════════════════════
  // B. CACHE WRITERS (localStorage as cache, not truth)
  // ══════════════════════════════════════════════════════════════════════

  function saveConsoleSnapshot() {
    var domains = window.LIMENDomains;
    if (!domains || Object.keys(domains).length === 0) return;

    var exec = window.LIMENExecutive;
    var snap = {
      generatedAt: Date.now(),
      version: 2,
      domains: {},
      executiveSummary: null,
      topOpportunities: null,
      _source: 'client'
    };

    for (var dk in domains) {
      if (domains.hasOwnProperty(dk)) {
        snap.domains[dk] = {
          stress: domains[dk].stress || 0,
          trend: domains[dk].trend || 0,
          status: domains[dk].status || ''
        };
      }
    }

    if (exec) {
      try {
        var queue = exec.getExecutiveQueue();
        snap.executiveSummary = {
          activeCount: exec.getActiveIntents().length,
          topIntents: queue.slice(0, 3).map(function(q) {
            return { title: q.title, domain: q.domain, status: q.status, urgency: q.urgency };
          })
        };
      } catch (e) {}
    }

    if (window._capOpportunities) {
      var opps = Object.values(window._capOpportunities);
      opps.sort(function(a, b) { return (b._priority || 0) - (a._priority || 0); });
      snap.topOpportunities = opps.slice(0, 10).map(function(o) {
        return { domain: o.domain, path: o.path, priority: o._priority, title: o.title || o.path };
      });
    }

    try { localStorage.setItem(CONSOLE_SNAP_KEY, JSON.stringify(snap)); } catch (e) {}
    // Update in-memory server cache too
    _serverConsole = snap;
  }

  function saveOpportunitiesSnapshot() {
    if (!window._oppData) return;
    var snap = {
      generatedAt: Date.now(),
      version: 2,
      opportunities: window._oppData.slice(0, 30).map(function(o) {
        return {
          title: o.pb ? o.pb.title : '',
          status: o.status,
          urgency: o.urgency,
          confidence: o.confidence,
          rankScore: o._rankScore || 0,
          domains: o.pb ? o.pb.domains : []
        };
      }),
      count: window._oppData.length,
      _source: 'client'
    };
    try { localStorage.setItem(OPP_SNAP_KEY, JSON.stringify(snap)); } catch (e) {}
    _serverOpps = snap;
  }

  // ══════════════════════════════════════════════════════════════════════
  // C. STALE BADGE
  // ══════════════════════════════════════════════════════════════════════

  function _showStaleBadge(container) {
    var badge = document.createElement('div');
    badge.id = 'limen-stale-badge';
    badge.style.cssText = 'position:fixed;top:4px;right:4px;background:rgba(201,169,78,0.15);color:#C9A94E;' +
      'font-family:"IBM Plex Mono",monospace;font-size:0.35rem;padding:4px 8px;border-radius:2px;z-index:999;' +
      'letter-spacing:1px;pointer-events:none';
    badge.textContent = _bootSource === 'cache' ? 'CACHED · REFRESHING...' : 'LOADING...';
    document.body.appendChild(badge);
    return badge;
  }

  function _removeStaleBadge() {
    var badge = document.getElementById('limen-stale-badge');
    if (badge) badge.remove();
  }

  // ══════════════════════════════════════════════════════════════════════
  // D. SESSION STATE PERSISTENCE
  // ══════════════════════════════════════════════════════════════════════

  function _saveSessionState() {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        savedAt: Date.now(),
        bootSource: _bootSource,
        hasDomains: !!(window.LIMENDomains && Object.keys(window.LIMENDomains).length > 0),
        hasExecutive: !!window.LIMENExecutive,
        hasReports: !!(window.LIMENReports && Object.keys(window.LIMENReports).length > 0)
      }));
    } catch (e) {}
  }

  function _getSessionState() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
    catch (e) { return null; }
  }

  // ══════════════════════════════════════════════════════════════════════
  // E. MEMOIZATION HELPER
  // ══════════════════════════════════════════════════════════════════════

  var _memoCache = {};

  function memoize(key, fn, ttlMs) {
    ttlMs = ttlMs || 30000;
    var entry = _memoCache[key];
    if (entry && (Date.now() - entry.at) < ttlMs) return entry.value;
    var result = fn();
    _memoCache[key] = { value: result, at: Date.now() };
    return result;
  }

  function invalidateMemo(key) {
    if (key) delete _memoCache[key];
    else _memoCache = {};
  }

  // ══════════════════════════════════════════════════════════════════════
  // F. DEFERRED WORK QUEUE
  // ══════════════════════════════════════════════════════════════════════

  var _deferredQueue = [];
  var _deferredRunning = false;

  function defer(fn, label) {
    _deferredQueue.push({ fn: fn, label: label || 'deferred' });
    if (!_deferredRunning) _runDeferred();
  }

  function _runDeferred() {
    if (_deferredQueue.length === 0) { _deferredRunning = false; return; }
    _deferredRunning = true;
    var task = _deferredQueue.shift();
    requestAnimationFrame(function () {
      setTimeout(function () {
        try {
          var start = Date.now();
          task.fn();
          _timings['deferred:' + task.label] = Date.now() - start;
        } catch (e) {
          console.warn('[FastBoot] Deferred task failed: ' + task.label, e.message);
        }
        _runDeferred();
      }, 0);
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // G. BOOT ORCHESTRATION
  // ══════════════════════════════════════════════════════════════════════

  function _persistTimings() {
    _timings.totalBoot = Date.now() - _bootStart;
    _timings.bootSource = _bootSource;
    try { localStorage.setItem(TIMINGS_KEY, JSON.stringify(_timings)); } catch(e) {}
    try { localStorage.setItem('limen_boot_source', _bootSource); } catch(e) {}
  }

  if (typeof window !== 'undefined') {
    // When fresh domain data arrives, update cache + remove stale badge
    window.addEventListener('limen:domain-update', function () {
      saveConsoleSnapshot();
      _saveSessionState();
      _removeStaleBadge();
      _mark('fresh_data_arrived');
    });

    // Save on page leave
    window.addEventListener('beforeunload', function () {
      saveConsoleSnapshot();
      saveOpportunitiesSnapshot();
      _saveSessionState();
      _persistTimings();
    });

    _mark('fastboot_loaded');
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  window.LIMENFastBoot = {
    // Async server-first (preferred)
    getConsoleSnapshot: getConsoleSnapshot,
    getOpportunitiesSnapshot: getOpportunitiesSnapshot,
    // Sync fallback (for callers that cannot await)
    getConsoleSnapshotSync: getConsoleSnapshotSync,
    getOpportunitiesSnapshotSync: getOpportunitiesSnapshotSync,
    // Cache writers
    saveConsoleSnapshot: saveConsoleSnapshot,
    saveOpportunitiesSnapshot: saveOpportunitiesSnapshot,
    // Stale badge
    showStaleBadge: _showStaleBadge,
    removeStaleBadge: _removeStaleBadge,
    // Session
    getSessionState: _getSessionState,
    // Utilities
    memoize: memoize,
    invalidateMemo: invalidateMemo,
    defer: defer,
    mark: _mark,
    getTimings: function () { _persistTimings(); return _timings; },
    getBootSource: function () { return _bootSource; }
  };

})();
