/**
 * feed-state.js
 * LIMEN HELIX — Canonical Feed Store & Hydration Lifecycle
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 *
 * Single source of truth for all feed-derived state.
 * Lifecycle: booting → hydrating → hydrated → degraded
 *
 * Downstream modules gate their initial _compute() behind onHydrated()
 * so they never run on stale/empty data after a page refresh.
 *
 * Output: window.LIMENFeedState
 * Events: limen:feed-hydrated (once, on first successful feed ingest)
 *         limen:feed-state-change (on any lifecycle state change)
 *
 * Load order: BEFORE domain-signal-engine.js
 */

(function () {
  'use strict';

  // ─── Lifecycle states ───────────────────────────────────────────────────
  var STATE_BOOTING    = 'booting';
  var STATE_HYDRATING  = 'hydrating';
  var STATE_HYDRATED   = 'hydrated';
  var STATE_DEGRADED   = 'degraded';

  // ─── State ──────────────────────────────────────────────────────────────
  var _state = STATE_BOOTING;
  var _hydratedAt = null;
  var _lastIngestAt = null;
  var _ingestCount = 0;
  var _failCount = 0;
  var _callbacks = [];
  var _fired = false;

  // Feed data store
  var _domains = {};
  var _sourceHealth = {};
  var _snapshotMeta = {
    snapshotId: null,
    liveCount: 0,
    partialCount: 0,
    fallbackCount: 0,
    timestamp: null
  };

  // Staleness: if no successful ingest in 3 minutes, degrade
  var STALE_THRESHOLD_MS = 180000;
  var _staleCheckInterval = null;

  // ─── Lifecycle transitions ──────────────────────────────────────────────

  function _setState(newState) {
    if (_state === newState) return;
    var prev = _state;
    _state = newState;
    _dispatch('limen:feed-state-change', { from: prev, to: newState, timestamp: Date.now() });
  }

  // ─── Ingest — called by domain-signal-engine on each successful fetch ──

  function ingest(feedData) {
    if (!feedData || !feedData.domains) {
      _failCount++;
      if (_state === STATE_HYDRATED && _failCount >= 3) {
        _setState(STATE_DEGRADED);
      }
      return;
    }

    // Reset fail counter on success
    _failCount = 0;
    _ingestCount++;
    _lastIngestAt = Date.now();

    // Store canonical feed data
    _domains = feedData.domains;
    if (feedData.sourceHealth) {
      _sourceHealth = feedData.sourceHealth;
    }

    // Persist to feed store for refresh survival
    var store = window.LIMENFeedStore;
    if (store) {
      store.saveDomains(_domains);
      if (feedData.sourceHealth) store.saveSourceHealth(_sourceHealth);
    }

    // Use server meta if available, otherwise compute client-side
    if (feedData.meta) {
      _snapshotMeta = {
        snapshotId: feedData.meta.snapshotId || _ingestCount,
        liveCount: feedData.meta.liveCount || 0,
        partialCount: feedData.meta.partialCount || 0,
        fallbackCount: feedData.meta.fallbackCount || 0,
        timestamp: feedData.meta.fetchedAt || _lastIngestAt
      };
    } else {
      var liveCount = 0;
      var partialCount = 0;
      var fallbackCount = 0;
      for (var sk in _sourceHealth) {
        if (_sourceHealth[sk].status === 'live') liveCount++;
        else if (_sourceHealth[sk].status === 'partial') partialCount++;
        else fallbackCount++;
      }
      _snapshotMeta = {
        snapshotId: _ingestCount,
        liveCount: liveCount,
        partialCount: partialCount,
        fallbackCount: fallbackCount,
        timestamp: _lastIngestAt
      };
    }

    // Persist meta
    if (store) store.saveMeta(_snapshotMeta);

    // First successful ingest — transition to hydrated
    if (!_fired) {
      _fired = true;
      _hydratedAt = _lastIngestAt;
      _setState(STATE_HYDRATED);
      _dispatch('limen:feed-hydrated', {
        timestamp: _hydratedAt,
        snapshotMeta: _snapshotMeta
      });
      // Fire all queued callbacks
      for (var i = 0; i < _callbacks.length; i++) {
        try { _callbacks[i](); } catch (e) { /* silent */ }
      }
      _callbacks = [];
    }

    // If degraded but feed came back, recover
    if (_state === STATE_DEGRADED) {
      _setState(STATE_HYDRATED);
    }

    // Refresh badge immediately on ingest
    if (_badgeEl) _renderBadge();
  }

  // ─── Ingest failure — called by domain-signal-engine on fetch failure ──

  function ingestFail() {
    _failCount++;
    if (_state === STATE_BOOTING) {
      _setState(STATE_HYDRATING);
    }
    if (_state === STATE_HYDRATED && _failCount >= 3) {
      _setState(STATE_DEGRADED);
    }
  }

  // ─── onHydrated — downstream modules register here ─────────────────────

  function onHydrated(callback) {
    if (typeof callback !== 'function') return;

    // If already hydrated, fire immediately
    if (_fired) {
      try { callback(); } catch (e) { /* silent */ }
      return;
    }

    _callbacks.push(callback);
  }

  // ─── Staleness check ───────────────────────────────────────────────────

  function _checkStaleness() {
    if (_state !== STATE_HYDRATED) return;
    if (!_lastIngestAt) return;
    var age = Date.now() - _lastIngestAt;
    if (age > STALE_THRESHOLD_MS) {
      _setState(STATE_DEGRADED);
    }
  }

  // ─── Getters ────────────────────────────────────────────────────────────

  function getState() { return _state; }
  function isHydrated() { return _fired; }
  function getDomains() { return _domains; }
  function getSourceHealth() { return _sourceHealth; }
  function getSnapshotMeta() { return _snapshotMeta; }
  function getLastIngestAt() { return _lastIngestAt; }
  function getIngestCount() { return _ingestCount; }

  // ─── Feed inspector drawer UI ──────────────────────────────────────────

  var _drawerEl = null;
  var _drawerVisible = false;

  var _isConsolePage = (function() {
    var p = location.pathname.replace(/^\//, '').replace(/\.html$/, '');
    return p === '' || p === 'civilization' || p === 'connectome';
  })();

  function _ensureDrawer() {
    if (!_isConsolePage) return;
    if (_drawerEl) return;
    _drawerEl = document.createElement('div');
    _drawerEl.id = 'limen-feed-inspector';
    _drawerEl.style.cssText = [
      'position:fixed',
      'bottom:40px',
      'left:12px',
      'background:rgba(8,9,12,0.94)',
      'border:1px solid rgba(201,169,78,0.15)',
      'padding:10px 14px',
      'font-family:"IBM Plex Mono",monospace',
      'font-size:0.45rem',
      'letter-spacing:1.5px',
      'z-index:9996',
      'border-radius:2px',
      'pointer-events:auto',
      'box-shadow:0 2px 8px rgba(0,0,0,0.5)',
      'line-height:1.8',
      'min-width:200px',
      'max-width:300px',
      'max-height:40vh',
      'overflow-y:auto',
      'display:none',
      'cursor:default'
    ].join(';');
    document.body.appendChild(_drawerEl);
  }

  function _renderDrawer() {
    if (!_isConsolePage) return;
    _ensureDrawer();
    if (!_drawerVisible) {
      _drawerEl.style.display = 'none';
      return;
    }

    var gold = '#c9a94e';
    var teal = '#5ab5a0';
    var dim = 'rgba(201,169,78,0.4)';
    var red = '#e85454';
    var orange = '#d4a44e';
    var green = 'rgba(90,181,160,0.8)';

    var stateColor = teal;
    if (_state === STATE_BOOTING || _state === STATE_HYDRATING) stateColor = orange;
    else if (_state === STATE_DEGRADED) stateColor = red;

    var html = '<div style="color:' + gold + ';font-size:0.50rem;margin-bottom:4px">FEED INSPECTOR</div>';
    html += '<div style="color:' + dim + '">lifecycle: <span style="color:' + stateColor + '">' + _state.toUpperCase() + '</span></div>';
    html += '<div style="color:' + dim + '">ingests: ' + _ingestCount + '</div>';
    html += '<div style="color:' + dim + '">fails: ' + _failCount + '</div>';

    if (_lastIngestAt) {
      var age = Date.now() - _lastIngestAt;
      var fresh = age < 60000 ? 'just now' : (age < 3600000 ? Math.floor(age / 60000) + 'm ago' : Math.floor(age / 3600000) + 'h ago');
      html += '<div style="color:' + dim + '">last ingest: ' + fresh + '</div>';
    } else {
      html += '<div style="color:' + dim + '">last ingest: never</div>';
    }

    if (_hydratedAt) {
      var hAge = Date.now() - _hydratedAt;
      var hFresh = hAge < 60000 ? 'just now' : (hAge < 3600000 ? Math.floor(hAge / 60000) + 'm ago' : Math.floor(hAge / 3600000) + 'h ago');
      html += '<div style="color:' + dim + '">hydrated: ' + hFresh + '</div>';
    }

    // Snapshot metadata
    html += '<div style="color:' + gold + ';font-size:0.42rem;margin-top:6px">SNAPSHOT</div>';
    html += '<div style="color:' + dim + '">id: #' + (_snapshotMeta.snapshotId || 0) + '</div>';
    html += '<div style="color:' + green + '">' + _snapshotMeta.liveCount + ' live</div>';
    if (_snapshotMeta.partialCount > 0) {
      html += '<div style="color:' + orange + '">' + _snapshotMeta.partialCount + ' partial</div>';
    }
    if (_snapshotMeta.fallbackCount > 0) {
      html += '<div style="color:' + red + '">' + _snapshotMeta.fallbackCount + ' fallback</div>';
    }

    // Per-source health
    var healthKeys = [];
    for (var hk in _sourceHealth) healthKeys.push(hk);
    if (healthKeys.length > 0) {
      html += '<div style="color:' + gold + ';font-size:0.42rem;margin-top:6px">SOURCES</div>';
      for (var si = 0; si < healthKeys.length; si++) {
        var sk = healthKeys[si];
        var sh = _sourceHealth[sk];
        var srcColor = (sh.status === 'live') ? green : red;
        var srcTag = (sh.status === 'live') ? 'LIVE' : 'OFF';
        html += '<div style="color:' + dim + ';font-size:0.38rem">';
        html += '<span style="color:' + srcColor + '">[' + srcTag + ']</span> ' + sk;
        if (sh.reason) html += ' <span style="color:' + red + '">(' + sh.reason + ')</span>';
        html += '</div>';
      }
    }

    _drawerEl.style.display = 'block';
    _drawerEl.innerHTML = html;
  }

  function toggleDrawer() {
    _drawerVisible = !_drawerVisible;
    _renderDrawer();
  }

  // ─── Snapshot debug badge (one-line, bottom-left) ──────────────────────

  var _badgeEl = null;

  function _ensureBadge() {
    if (!_isConsolePage) return;
    if (_badgeEl) return;
    _badgeEl = document.createElement('div');
    _badgeEl.id = 'limen-snapshot-badge';
    _badgeEl.style.cssText = [
      'position:fixed',
      'bottom:8px',
      'left:12px',
      'font-family:"IBM Plex Mono",monospace',
      'font-size:0.40rem',
      'letter-spacing:1.5px',
      'z-index:9990',
      'pointer-events:auto',
      'cursor:pointer',
      'color:rgba(201,169,78,0.35)',
      'line-height:1'
    ].join(';');
    _badgeEl.addEventListener('click', function () { toggleDrawer(); });
    document.body.appendChild(_badgeEl);
  }

  function _renderBadge() {
    if (!_isConsolePage) return;
    _ensureBadge();
    var m = _snapshotMeta;
    var green = 'rgba(90,181,160,0.8)';
    var orange = '#d4a44e';
    var red = '#e85454';
    var dim = 'rgba(201,169,78,0.35)';

    var id = m.snapshotId ? String(m.snapshotId).slice(-6) : '--';
    var html = '<span style="color:' + dim + '">SNAPSHOT ' + id + '</span>';
    if (m.liveCount > 0) html += ' <span style="color:' + green + '">' + m.liveCount + ' LIVE</span>';
    if (m.partialCount > 0) html += ' <span style="color:' + orange + '">' + m.partialCount + ' PARTIAL</span>';
    if (m.fallbackCount > 0) html += ' <span style="color:' + red + '">' + m.fallbackCount + ' FALLBACK</span>';

    _badgeEl.innerHTML = html;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  function start() {
    _setState(STATE_HYDRATING);

    // Attempt rehydration from persisted feed store
    var store = window.LIMENFeedStore;
    if (store && store.hasPersistedState()) {
      var savedDomains = store.loadDomains();
      var savedHealth = store.loadSourceHealth();
      var savedMeta = store.loadMeta();
      if (savedDomains) {
        _domains = savedDomains;
        if (savedHealth) _sourceHealth = savedHealth;
        if (savedMeta) _snapshotMeta = savedMeta;
        _lastIngestAt = (_snapshotMeta && _snapshotMeta.timestamp) || Date.now();
        _ingestCount = 1; // mark as having data
        _fired = true;
        _hydratedAt = _lastIngestAt;
        _setState(STATE_HYDRATED);
        _dispatch('limen:feed-hydrated', {
          timestamp: _hydratedAt,
          snapshotMeta: _snapshotMeta,
          rehydrated: true
        });
        // Fire queued callbacks immediately
        for (var i = 0; i < _callbacks.length; i++) {
          try { _callbacks[i](); } catch (e) { /* silent */ }
        }
        _callbacks = [];
        console.log('[LIMEN] feed-state: rehydrated from persisted store');
      }
    }

    _staleCheckInterval = setInterval(function () {
      if (!document.hidden) _checkStaleness();
    }, 30000);
    // Refresh badge + drawer every 10s
    setInterval(function () {
      if (document.hidden) return;
      _renderBadge();
      if (_drawerVisible) _renderDrawer();
    }, 10000);
    // Initial badge render
    _renderBadge();
  }

  function stop() {
    if (_staleCheckInterval) {
      clearInterval(_staleCheckInterval);
      _staleCheckInterval = null;
    }
    if (_drawerEl) _drawerEl.style.display = 'none';
  }

  // ─── Utilities ──────────────────────────────────────────────────────────

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  window.LIMENFeedState = {
    getState: getState,
    isHydrated: isHydrated,
    getDomains: getDomains,
    getSourceHealth: getSourceHealth,
    getSnapshotMeta: getSnapshotMeta,
    getLastIngestAt: getLastIngestAt,
    getIngestCount: getIngestCount,
    ingest: ingest,
    ingestFail: ingestFail,
    onHydrated: onHydrated,
    toggleDrawer: toggleDrawer,
    start: start,
    stop: stop
  };

})();
