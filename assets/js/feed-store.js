/**
 * feed-store.js
 * LIMEN HELIX — Persistent Feed Store
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 *
 * Normalized event store with localStorage persistence for feed reliability.
 * Survives page refresh, rehydrates on load, prevents duplicate entries,
 * and ensures relative timestamps are always recomputed from absolute timestamps.
 *
 * Storage keys: limen_feed_domains, limen_feed_events, limen_feed_timeline,
 *               limen_feed_meta, limen_feed_source_health
 *
 * TTL: 30 minutes — stale data is discarded on load.
 *
 * Output: window.LIMENFeedStore
 * Events: limen:feed-store-ready (on successful rehydration or init)
 *
 * Load order: AFTER feed-state.js, BEFORE domain-signal-engine.js
 */

(function () {
  'use strict';

  var STORAGE_PREFIX = 'limen_feed_';
  var TTL_MS = 30 * 60 * 1000; // 30 minutes
  var SAVE_DEBOUNCE_MS = 2000;

  // Keys we persist
  var KEYS = {
    domains:      STORAGE_PREFIX + 'domains',
    events:       STORAGE_PREFIX + 'events',
    timeline:     STORAGE_PREFIX + 'timeline',
    meta:         STORAGE_PREFIX + 'meta',
    sourceHealth: STORAGE_PREFIX + 'source_health',
    seenIds:      STORAGE_PREFIX + 'seen_ids'
  };

  // ─── State ──────────────────────────────────────────────────────────────

  var _ready = false;
  var _saveTimers = {};
  var _seenIds = {};  // dedup: itemKey → timestamp

  // ─── localStorage safety wrapper ────────────────────────────────────────

  function _lsGet(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var envelope = JSON.parse(raw);
      if (!envelope || !envelope.ts || !envelope.data) return null;
      // TTL check
      if (Date.now() - envelope.ts > TTL_MS) {
        localStorage.removeItem(key);
        return null;
      }
      return envelope.data;
    } catch (e) {
      return null;
    }
  }

  function _lsSet(key, data) {
    try {
      var envelope = { ts: Date.now(), data: data };
      localStorage.setItem(key, JSON.stringify(envelope));
    } catch (e) {
      // Storage full or disabled — degrade silently
    }
  }

  function _lsRemove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* silent */ }
  }

  // ─── Debounced save ─────────────────────────────────────────────────────

  function _debouncedSave(storageKey, data) {
    if (_saveTimers[storageKey]) clearTimeout(_saveTimers[storageKey]);
    _saveTimers[storageKey] = setTimeout(function () {
      _lsSet(storageKey, data);
      _saveTimers[storageKey] = null;
    }, SAVE_DEBOUNCE_MS);
  }

  // ─── Deduplication ──────────────────────────────────────────────────────

  function _dedupKey(type, id, domain) {
    return (type || '') + ':' + (id || '') + ':' + (domain || '');
  }

  function hasSeen(type, id, domain, windowMs) {
    var key = _dedupKey(type, id, domain);
    var lastSeen = _seenIds[key];
    if (!lastSeen) return false;
    var w = windowMs || 30000;
    return (Date.now() - lastSeen) < w;
  }

  function markSeen(type, id, domain) {
    var key = _dedupKey(type, id, domain);
    _seenIds[key] = Date.now();
  }

  function _pruneSeenIds() {
    var now = Date.now();
    var cutoff = 5 * 60 * 1000; // 5 minutes
    for (var key in _seenIds) {
      if (now - _seenIds[key] > cutoff) {
        delete _seenIds[key];
      }
    }
  }

  // ─── Domain feed persistence ────────────────────────────────────────────

  function saveDomains(domains) {
    if (!domains) return;
    _debouncedSave(KEYS.domains, domains);
  }

  function loadDomains() {
    return _lsGet(KEYS.domains);
  }

  // ─── Source health persistence ──────────────────────────────────────────

  function saveSourceHealth(health) {
    if (!health) return;
    _debouncedSave(KEYS.sourceHealth, health);
  }

  function loadSourceHealth() {
    return _lsGet(KEYS.sourceHealth);
  }

  // ─── Snapshot meta persistence ──────────────────────────────────────────

  function saveMeta(meta) {
    if (!meta) return;
    _debouncedSave(KEYS.meta, meta);
  }

  function loadMeta() {
    return _lsGet(KEYS.meta);
  }

  // ─── Event log persistence ──────────────────────────────────────────────

  function saveEvents(activeEvents, eventLog) {
    var data = {
      active: {},
      log: []
    };
    // Serialize active events (keyed by type)
    if (activeEvents) {
      for (var type in activeEvents) {
        var evt = activeEvents[type];
        data.active[type] = {
          id: evt.id,
          type: evt.type,
          severity: evt.severity,
          confidence: evt.confidence,
          status: evt.status,
          domains: evt.domains,
          drivers: evt.drivers,
          firstSeen: evt.firstSeen,
          updated: evt.updated
        };
      }
    }
    // Serialize event log (plain objects with absolute timestamps)
    if (eventLog) {
      for (var i = 0; i < eventLog.length; i++) {
        var e = eventLog[i];
        data.log.push({
          id: e.id,
          type: e.type,
          severity: e.severity,
          confidence: e.confidence,
          status: e.status,
          domains: e.domains,
          drivers: e.drivers,
          firstSeen: e.firstSeen,
          updated: e.updated
        });
      }
    }
    _debouncedSave(KEYS.events, data);
  }

  function loadEvents() {
    return _lsGet(KEYS.events);
  }

  // ─── Timeline persistence ───────────────────────────────────────────────

  function saveTimeline(entries) {
    if (!entries || entries.length === 0) return;
    // Only persist the last 100 entries to keep storage lean
    var toSave = entries.slice(-100).map(function (e) {
      return {
        timestamp: e.timestamp,
        type: e.type,
        label: e.label,
        severity: e.severity,
        domains: e.domains,
        confidence: e.confidence
      };
    });
    _debouncedSave(KEYS.timeline, toSave);
  }

  function loadTimeline() {
    return _lsGet(KEYS.timeline);
  }

  // ─── Relative timestamp computation ─────────────────────────────────────
  // All modules should use this instead of their own _freshness/_age
  // to ensure consistent, always-recomputed-from-absolute timestamps.

  function freshness(ts) {
    if (!ts) return 'unknown';
    var age = Date.now() - ts;
    if (age < 0) return 'just now'; // clock skew safety
    if (age < 60000) return 'just now';
    if (age < 3600000) return Math.floor(age / 60000) + 'm ago';
    if (age < 86400000) return Math.floor(age / 3600000) + 'h ago';
    return Math.floor(age / 86400000) + 'd ago';
  }

  function age(ts) {
    if (!ts) return '?';
    var ms = Date.now() - ts;
    if (ms < 0) return 'now';
    if (ms < 60000) return 'now';
    if (ms < 3600000) return Math.floor(ms / 60000) + 'm';
    if (ms < 86400000) return Math.floor(ms / 3600000) + 'h';
    return Math.floor(ms / 86400000) + 'd';
  }

  // ─── Full rehydration check ─────────────────────────────────────────────

  function hasPersistedState() {
    return !!_lsGet(KEYS.domains);
  }

  // ─── Clear all persisted state ──────────────────────────────────────────

  function clear() {
    for (var k in KEYS) {
      _lsRemove(KEYS[k]);
    }
    _seenIds = {};
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  function start() {
    // Load seen IDs from storage for dedup continuity
    var savedSeen = _lsGet(KEYS.seenIds);
    if (savedSeen) {
      _seenIds = savedSeen;
      _pruneSeenIds();
    }

    // Periodic seen-ID persistence and pruning
    setInterval(function () {
      _pruneSeenIds();
      _lsSet(KEYS.seenIds, _seenIds);
    }, 30000);

    _ready = true;
    _dispatch('limen:feed-store-ready', { hasPersistedState: hasPersistedState() });
  }

  function stop() {
    // Flush any pending saves immediately
    for (var key in _saveTimers) {
      if (_saveTimers[key]) {
        clearTimeout(_saveTimers[key]);
        _saveTimers[key] = null;
      }
    }
    // Final save of seen IDs
    _lsSet(KEYS.seenIds, _seenIds);
  }

  // ─── Utilities ──────────────────────────────────────────────────────────

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  window.LIMENFeedStore = {
    // Lifecycle
    start: start,
    stop: stop,
    isReady: function () { return _ready; },

    // Domain feeds
    saveDomains: saveDomains,
    loadDomains: loadDomains,

    // Source health
    saveSourceHealth: saveSourceHealth,
    loadSourceHealth: loadSourceHealth,

    // Snapshot meta
    saveMeta: saveMeta,
    loadMeta: loadMeta,

    // Events
    saveEvents: saveEvents,
    loadEvents: loadEvents,

    // Timeline
    saveTimeline: saveTimeline,
    loadTimeline: loadTimeline,

    // Deduplication
    hasSeen: hasSeen,
    markSeen: markSeen,

    // Timestamps
    freshness: freshness,
    age: age,

    // State check
    hasPersistedState: hasPersistedState,
    clear: clear
  };

})();
