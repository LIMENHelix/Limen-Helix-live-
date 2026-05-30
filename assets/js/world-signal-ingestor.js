/**
 * world-signal-ingestor.js
 * LIMEN HELIX — World Signal Ingestor (Feed-Store Consumer)
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 *
 * ARCHITECTURE RULE: The browser NEVER calls external APIs directly.
 * All external data flows through /api/domain-snapshot (server-side).
 * This module reads the canonical feed store and emits domain events.
 *
 * Input: window.LIMENFeedState (populated by domain-signal-engine.js)
 * Output: updates window.LIMENWorld with per-domain world signals
 * Event: limen:world-signals-updated
 *
 * Load order: after feed-state.js and domain-signal-engine.js
 */

(function () {
  'use strict';

  var POLL_INTERVAL = 30000; // re-read feed store every 30s
  var _interval = null;
  var _isSimulated = {};

  var DOMAIN_KEYS = ['economy', 'energy', 'environment', 'health', 'technology', 'research', 'supplyChain', 'governance', 'infrastructure', 'agriculture', 'industry', 'education', 'communication', 'culture', 'defense', 'religion', 'population', 'law', 'finance', 'intelligence'];

  // ─── Read from canonical feed store ────────────────────────────────────

  function update() {
    var fs = window.LIMENFeedState;
    var domains = window.LIMENDomains || {};
    var world = {};

    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var key = DOMAIN_KEYS[i];
      var d = domains[key];

      if (d && d.updated && d.confidence > 0.1) {
        // Live data from server snapshot (via domain-signal-engine)
        _isSimulated[key] = false;
        world[key] = {
          score: d.stress || 0,
          trend: d.trend || 0,
          anomaly: d.stress > 0.65 ? d.stress : 0,
          description: _buildDescription(key, d),
          confidence: d.confidence || 0,
          updated: d.updated
        };
      } else {
        // No server data yet — use minimal fallback (no external calls)
        _isSimulated[key] = true;
        world[key] = {
          score: 0,
          trend: 0,
          anomaly: 0,
          description: 'awaiting server snapshot',
          confidence: 0,
          updated: null
        };
      }
    }

    window.LIMENWorld = { domains: world, updated: Date.now() };

    _dispatch('limen:world-signals-updated', {
      domains: world,
      simulated: Object.keys(_isSimulated).filter(function (k) { return _isSimulated[k]; }),
      timestamp: Date.now()
    });
  }

  function _buildDescription(key, d) {
    var sources = d.sources || [];
    var liveNames = [];
    for (var i = 0; i < sources.length; i++) {
      if (sources[i].live && sources[i].label) {
        liveNames.push(sources[i].label);
      }
    }
    if (liveNames.length > 0) return liveNames.join('; ');

    var signals = d.signals || [];
    if (signals.length > 0) return signals[0];

    return key + ' domain signal';
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  function start() {
    if (_interval) return;
    var fs = window.LIMENFeedState;
    if (fs && typeof fs.onHydrated === 'function') {
      fs.onHydrated(function () {
        update();
        _interval = setInterval(update, POLL_INTERVAL);
      });
    } else {
      update();
      _interval = setInterval(update, POLL_INTERVAL);
    }
  }

  function stop() {
    if (_interval) {
      clearInterval(_interval);
      _interval = null;
    }
  }

  // ─── Utilities ───────────────────────────────────────────────────────────

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  window.LIMENWorldIngestor = {
    start: start,
    stop: stop,
    update: update,
    isSimulated: function () { return _isSimulated; }
  };

})();
