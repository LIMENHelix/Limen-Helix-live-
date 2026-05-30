/**
 * decision-memory.js
 * LIMEN HELIX — Decision Memory
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 * Tracks recent user choices (domain focus, action type) and emits
 * concentration signals when repeated attention patterns emerge.
 *
 * Depends on: window.LIMENGlobalState, window.LIMENCrossDomain
 * Listens: limen:user-action
 * Emits: limen:decision-memory-update, limen:phase-change (concentration)
 * Output: window.LIMENDecisionMemory
 *
 * Load order: after event-narrator.js
 */

(function () {
  'use strict';

  var MAX_ENTRIES = 20;
  var CONCENTRATION_THRESHOLD = 3; // same domain N times triggers narrator
  var CONCENTRATION_COOLDOWN = 120000; // 2 min between concentration narrations
  var CHECK_MS = 10000;

  // ─── State ───────────────────────────────────────────────────────────────

  var _entries = [];
  var _lastConcentrationTime = 0;
  var _lastConcentrationDomain = null;
  var _interval = null;

  // ─── Record decision ─────────────────────────────────────────────────────

  function _onUserAction(e) {
    var detail = e.detail;
    if (!detail) return;

    var globalState = window.LIMENGlobalState || {};
    var crossDomain = (window.LIMENCrossDomain && window.LIMENCrossDomain.active) || [];

    // Find matching cross-domain pattern for this domain
    var matchedPattern = null;
    var domain = detail.domain || null;
    if (domain) {
      for (var i = 0; i < crossDomain.length; i++) {
        var pat = crossDomain[i];
        if (pat.domains && pat.domains.indexOf(domain) !== -1) {
          matchedPattern = pat.pattern || pat.patternId || null;
          break;
        }
      }
    }

    var entry = {
      domain: domain,
      action: detail.action || detail.type || 'unknown',
      type: detail.type || 'unknown',
      timestamp: Date.now(),
      globalState: globalState.mode || 'unknown',
      crossDomainPattern: matchedPattern
    };

    _entries.push(entry);
    if (_entries.length > MAX_ENTRIES) {
      _entries.shift();
    }

    _publish();
    _checkConcentration();
  }

  // ─── Concentration detection ──────────────────────────────────────────────

  function _checkConcentration() {
    var now = Date.now();
    if (now - _lastConcentrationTime < CONCENTRATION_COOLDOWN) return;
    if (_entries.length < CONCENTRATION_THRESHOLD) return;

    // Count domain frequency in recent entries (last 10)
    var recent = _entries.slice(-10);
    var counts = {};
    for (var i = 0; i < recent.length; i++) {
      var d = recent[i].domain;
      if (!d) continue;
      // Normalize compound domains (e.g. "energy+environment")
      var parts = d.split('+');
      for (var p = 0; p < parts.length; p++) {
        var pk = parts[p];
        if (pk) {
          counts[pk] = (counts[pk] || 0) + 1;
        }
      }
    }

    // Find domains meeting threshold
    var concentrated = [];
    for (var dk in counts) {
      if (counts[dk] >= CONCENTRATION_THRESHOLD) {
        concentrated.push(dk);
      }
    }

    if (concentrated.length === 0) return;

    // Don't re-narrate the same single-domain concentration
    if (concentrated.length === 1 && concentrated[0] === _lastConcentrationDomain) return;

    _lastConcentrationTime = now;
    _lastConcentrationDomain = concentrated.length === 1 ? concentrated[0] : null;

    // Build narrator message
    var drivers = [];
    var body;

    if (concentrated.length === 1) {
      body = 'Repeated observation posture detected in ' + concentrated[0] + '.';
      drivers.push(counts[concentrated[0]] + ' recent actions in ' + concentrated[0]);
    } else {
      body = 'User attention remains concentrated in ' + concentrated.join(' and ') + '.';
      for (var c = 0; c < concentrated.length; c++) {
        drivers.push(counts[concentrated[c]] + ' recent actions in ' + concentrated[c]);
      }
    }

    // Suggest broadening or deepening
    var options = [];
    for (var o = 0; o < Math.min(concentrated.length, 2); o++) {
      options.push({ label: 'deepen ' + concentrated[o] + ' analysis', type: 'analysis' });
    }
    options.push({ label: 'broaden scope', type: 'monitoring' });
    options.push({ label: 'hold', type: 'monitoring' });

    _dispatch('limen:phase-change', {
      from: 'observing',
      to: 'concentrated',
      type: 'decision-memory',
      topDrivers: drivers,
      options: options,
      body: body
    });
  }

  // ─── Publish ──────────────────────────────────────────────────────────────

  function _publish() {
    var summary = {
      entries: _entries,
      count: _entries.length,
      recentDomains: _recentDomains(5),
      updated: Date.now()
    };

    window.LIMENDecisionMemory = summary;
    _dispatch('limen:decision-memory-update', summary);
  }

  function _recentDomains(n) {
    var seen = {};
    var result = [];
    for (var i = _entries.length - 1; i >= 0 && result.length < n; i--) {
      var d = _entries[i].domain;
      if (d && !seen[d]) {
        seen[d] = true;
        result.push(d);
      }
    }
    return result;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  function start() {
    window.addEventListener('limen:user-action', _onUserAction);
    _publish();
  }

  function stop() {
    window.removeEventListener('limen:user-action', _onUserAction);
    if (_interval) {
      clearInterval(_interval);
      _interval = null;
    }
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  window.LIMENDecisionMemory = {
    entries: [],
    count: 0,
    recentDomains: [],
    updated: null
  };

  window.LIMENDecisionMemoryEngine = {
    start: start,
    stop: stop
  };

})();
