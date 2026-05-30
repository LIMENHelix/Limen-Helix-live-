/**
 * narrative-memory.js
 * LIMEN HELIX — Narrative Memory Layer
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 * Lightweight session-only memory of evolving world signals.
 * No persistence. No localStorage. No cookies. RAM only.
 *
 * Output: window.LIMENNarrativeMemory — array of domain observation records
 * Max records: 50
 *
 * Load order: after cross-domain-detector.js
 */

(function () {
  'use strict';

  var MAX_RECORDS = 50;
  var MAX_EVENTS = 10;
  var _records = [];       // array of memory records
  var _recordMap = {};     // domain → record for fast lookup
  var _idCounter = 0;
  var _stressHistory = {}; // domain → rolling array of stress values

  // ─── Record management ───────────────────────────────────────────────────

  function _getOrCreateRecord(domain) {
    if (_recordMap[domain]) return _recordMap[domain];

    _idCounter++;
    var record = {
      id: domain + '_' + _idCounter,
      domain: domain,
      firstSeen: Date.now(),
      lastUpdate: Date.now(),
      events: [],
      trajectory: 'stable',
      significance: 0,
      narrativeState: 'emerging signal',
      tickCount: 0
    };

    _records.push(record);
    _recordMap[domain] = record;

    // Enforce max records
    if (_records.length > MAX_RECORDS) {
      _pruneLowest();
    }

    return record;
  }

  function _pruneLowest() {
    // Sort by significance ascending, remove lowest
    _records.sort(function (a, b) { return a.significance - b.significance; });
    var removed = _records.shift();
    if (removed) {
      delete _recordMap[removed.domain];
    }
  }

  // ─── Trajectory computation ──────────────────────────────────────────────

  function _computeTrajectory(domain) {
    var history = _stressHistory[domain] || [];
    if (history.length < 3) return 'stable';

    var last3 = history.slice(-3);

    // Rising: each higher than previous
    if (last3[0] < last3[1] && last3[1] < last3[2]) return 'rising';

    // Falling: each lower than previous
    if (last3[0] > last3[1] && last3[1] > last3[2]) return 'falling';

    return 'stable';
  }

  // ─── Narrative state computation ────────────────────────────────────────

  function _computeNarrativeState(record) {
    if (record.significance < 0.45 && record.tickCount <= 2) {
      return 'emerging signal';
    }
    if (record.significance >= 0.45 && record.significance <= 0.65) {
      return 'developing pattern';
    }
    if (record.significance > 0.65 && record.tickCount > 4) {
      return 'persistent structural stress';
    }
    // Default for edge cases
    if (record.significance > 0.65) return 'developing pattern';
    return 'emerging signal';
  }

  // ─── Update from domain signals ──────────────────────────────────────────

  function update() {
    var domains = window.LIMENDomains || {};
    var DOMAIN_KEYS = ['economy', 'energy', 'environment', 'health', 'technology', 'research', 'supplyChain', 'governance', 'infrastructure', 'agriculture', 'industry', 'education', 'communication', 'culture', 'defense', 'religion', 'population', 'law', 'finance', 'intelligence'];
    var now = Date.now();

    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var key = DOMAIN_KEYS[i];
      var d = domains[key];
      if (!d || d.stress === undefined) continue;

      // Only track domains with meaningful signal
      if (d.stress < 0.20) continue;

      // Update stress history
      if (!_stressHistory[key]) _stressHistory[key] = [];
      _stressHistory[key].push(d.stress);
      if (_stressHistory[key].length > 10) _stressHistory[key].shift();

      var record = _getOrCreateRecord(key);
      record.lastUpdate = now;
      record.tickCount++;

      // Update significance as running average of stress
      var history = _stressHistory[key];
      var sum = 0;
      for (var h = 0; h < history.length; h++) {
        sum += history[h];
      }
      record.significance = Math.round((sum / history.length) * 1000) / 1000;

      // Update trajectory
      record.trajectory = _computeTrajectory(key);

      // Add event if stress changed significantly
      if (history.length >= 2) {
        var delta = Math.abs(history[history.length - 1] - history[history.length - 2]);
        if (delta > 0.08) {
          var direction = history[history.length - 1] > history[history.length - 2] ? 'increased' : 'decreased';
          var eventText = key + ' stress ' + direction + ' to ' + Math.round(d.stress * 100) + '%';
          record.events.push(eventText);
          if (record.events.length > MAX_EVENTS) {
            record.events.shift();
          }
        }
      }

      // Update narrative state
      record.narrativeState = _computeNarrativeState(record);
    }

    // Publish
    window.LIMENNarrativeMemory = _records.slice();
  }

  // ─── Cross-domain event capture ──────────────────────────────────────────

  function _onOpportunity(e) {
    var detail = e.detail;
    if (!detail || !detail.domains) return;

    for (var i = 0; i < detail.domains.length; i++) {
      var record = _recordMap[detail.domains[i]];
      if (record) {
        var eventText = 'cross-domain: ' + detail.label;
        record.events.push(eventText);
        if (record.events.length > MAX_EVENTS) {
          record.events.shift();
        }
      }
    }
  }

  // ─── Event listeners ─────────────────────────────────────────────────────

  function _onWorldUpdate() {
    update();
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  function start() {
    window.addEventListener('limen:world-signals-updated', _onWorldUpdate);
    window.addEventListener('limen:domain-update', _onWorldUpdate);
    window.addEventListener('limen:opportunity-detected', _onOpportunity);
    update();
  }

  function stop() {
    window.removeEventListener('limen:world-signals-updated', _onWorldUpdate);
    window.removeEventListener('limen:domain-update', _onWorldUpdate);
    window.removeEventListener('limen:opportunity-detected', _onOpportunity);
  }

  function reset() {
    _records = [];
    _recordMap = {};
    _stressHistory = {};
    _idCounter = 0;
    window.LIMENNarrativeMemory = [];
  }

  function getMemory() {
    return _records.slice();
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  window.LIMENNarrativeMemory = [];

  window.LIMENNarrativeMemoryEngine = {
    start: start,
    stop: stop,
    reset: reset,
    getMemory: getMemory,
    update: update
  };

})();
