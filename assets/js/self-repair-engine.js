/**
 * self-repair-engine.js
 * LIMEN HELIX — Bounded Self-Repair Engine
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 * Attempts small, reversible local recoveries when safe.
 * Never touches protected kernel files or performs mass rewrites.
 *
 * Allowed repairs:
 *   - restart stalled polling loop
 *   - retry failed feed fetch with backoff
 *   - recreate missing UI panel
 *   - restore event listeners via module restart
 *   - recover missing advisory module initialization
 *
 * Depends on: window.LIMENSelfHealth, window.LIMENDebug
 * Listens: limen:self-health-update
 * Emits: limen:self-repair-attempt, limen:self-repair-result
 * Output: window.LIMENRepairLog
 *
 * Load order: after self-health-monitor.js
 */

(function () {
  'use strict';

  var MAX_LOG = 30;
  var COOLDOWN_MS = 60000; // 1 minute cooldown per target
  var MAX_RETRIES = 3;     // max repair attempts per target per session
  var BACKOFF_BASE = 5000; // 5s base backoff for feed retry

  // ─── State ───────────────────────────────────────────────────────────────

  var _repairLog = [];
  var _cooldowns = {};   // target → last attempt timestamp
  var _retryCounts = {}; // target → count this session

  // ─── Startable modules (api global → start method) ────────────────────

  var RESTARTABLE = [
    { key: 'domainEngine',   api: 'LIMENDomainEngine' },
    { key: 'narrator',       api: 'LIMENEventNarrator' },
    { key: 'crossDomain',    api: 'LIMENCrossDomainDetector' },
    { key: 'globalState',    api: 'LIMENGlobalStateEngine' },
    { key: 'balanceMeter',   api: 'LIMENBalanceMeter' },
    { key: 'polarity',       api: 'LIMENReportPolarityEngine' },
    { key: 'marketTriage',   api: 'LIMENMarketStressTriage' },
    { key: 'phaseEstimator', api: 'LIMENPhaseEstimator' },
    { key: 'selfHealth',     api: 'LIMENSelfHealthMonitor' }
  ];

  // ─── Core repair logic ────────────────────────────────────────────────

  function _onHealthUpdate(e) {
    var health = e.detail;
    if (!health || health.overall === 'healthy') return;

    var modules = health.modules || {};
    var now = Date.now();

    // 1. Restart stalled modules
    for (var mk in modules) {
      if (modules[mk] === 'stalled' || modules[mk] === 'missing') {
        _tryRestartModule(mk, now);
      }
    }

    // 2. Retry feed if gateway degraded
    if (modules.feedGateway === 'degraded') {
      _tryRetryFeed(now);
    }

    // 3. Recreate missing UI panels
    _tryRecreatePanel('limen-domain-panel', 'domainEngine', now);
    _tryRecreatePanel('limen-global-state-badge', 'globalState', now);

    // 4. Stale domain recovery — trigger a manual poll
    var staleDomains = health.staleDomains || [];
    if (staleDomains.length > 0) {
      _tryRefreshDomains(now);
    }
  }

  // ─── Repair: restart module ─────────────────────────────────────────────

  function _tryRestartModule(moduleKey, now) {
    if (!_canAttempt(moduleKey, now)) return;

    var mod = null;
    for (var i = 0; i < RESTARTABLE.length; i++) {
      if (RESTARTABLE[i].key === moduleKey) {
        mod = RESTARTABLE[i];
        break;
      }
    }
    if (!mod) return;

    var obj = window[mod.api];
    if (!obj || typeof obj.start !== 'function') return;

    _logAttempt(moduleKey, 'restart-module', now);

    try {
      // Stop first if possible
      if (typeof obj.stop === 'function') {
        obj.stop();
      }
      obj.start();
      _logResult(moduleKey, 'restart-module', 'success');
    } catch (err) {
      _logResult(moduleKey, 'restart-module', 'failed: ' + (err.message || err));
    }
  }

  // ─── Repair: retry feed ─────────────────────────────────────────────────

  function _tryRetryFeed(now) {
    var target = 'feedGateway';
    if (!_canAttempt(target, now)) return;

    var engine = window.LIMENDomainEngine;
    if (!engine || typeof engine.update !== 'function') return;

    var retryNum = _retryCounts[target] || 0;
    var delay = BACKOFF_BASE * Math.pow(2, Math.min(retryNum, 4));

    _logAttempt(target, 'retry-feed (backoff ' + Math.round(delay / 1000) + 's)', now);

    setTimeout(function () {
      try {
        engine.update();
        _logResult(target, 'retry-feed', 'attempted');
      } catch (err) {
        _logResult(target, 'retry-feed', 'failed: ' + (err.message || err));
      }
    }, delay);
  }

  // ─── Repair: recreate panel ─────────────────────────────────────────────

  function _tryRecreatePanel(panelId, moduleKey, now) {
    if (document.getElementById(panelId)) return;

    var target = 'panel-' + panelId;
    if (!_canAttempt(target, now)) return;

    // Restarting the module should recreate its panel
    var mod = null;
    for (var i = 0; i < RESTARTABLE.length; i++) {
      if (RESTARTABLE[i].key === moduleKey) {
        mod = RESTARTABLE[i];
        break;
      }
    }
    if (!mod) return;

    var obj = window[mod.api];
    if (!obj || typeof obj.start !== 'function') return;

    _logAttempt(target, 'recreate-panel', now);

    try {
      if (typeof obj.stop === 'function') obj.stop();
      obj.start();
      // Verify
      setTimeout(function () {
        var success = !!document.getElementById(panelId);
        _logResult(target, 'recreate-panel', success ? 'success' : 'panel still missing');
      }, 2000);
    } catch (err) {
      _logResult(target, 'recreate-panel', 'failed: ' + (err.message || err));
    }
  }

  // ─── Repair: refresh stale domains ──────────────────────────────────────

  function _tryRefreshDomains(now) {
    var target = 'staleDomains';
    if (!_canAttempt(target, now)) return;

    var engine = window.LIMENDomainEngine;
    if (!engine || typeof engine.update !== 'function') return;

    _logAttempt(target, 'refresh-domains', now);

    try {
      engine.update();
      _logResult(target, 'refresh-domains', 'poll triggered');
    } catch (err) {
      _logResult(target, 'refresh-domains', 'failed: ' + (err.message || err));
    }
  }

  // ─── Cooldown + retry limits ────────────────────────────────────────────

  function _canAttempt(target, now) {
    // Check retry limit
    var count = _retryCounts[target] || 0;
    if (count >= MAX_RETRIES) return false;

    // Check cooldown
    var last = _cooldowns[target] || 0;
    if (now - last < COOLDOWN_MS) return false;

    return true;
  }

  // ─── Logging ────────────────────────────────────────────────────────────

  function _logAttempt(target, action, now) {
    _cooldowns[target] = now;
    _retryCounts[target] = (_retryCounts[target] || 0) + 1;

    var entry = {
      timestamp: now,
      target: target,
      action: action,
      result: 'pending'
    };
    _repairLog.push(entry);
    if (_repairLog.length > MAX_LOG) _repairLog.shift();

    window.LIMENRepairLog = _repairLog;
    _dispatch('limen:self-repair-attempt', entry);

    // Narrate the attempt
    _dispatch('limen:phase-change', {
      from: 'degraded',
      to: 'repairing',
      type: 'self-repair',
      target: target,
      action: action
    });
  }

  function _logResult(target, action, result) {
    var entry = {
      timestamp: Date.now(),
      target: target,
      action: action,
      result: result
    };

    // Update last pending entry for this target if exists
    for (var i = _repairLog.length - 1; i >= 0; i--) {
      if (_repairLog[i].target === target && _repairLog[i].result === 'pending') {
        _repairLog[i].result = result;
        break;
      }
    }

    window.LIMENRepairLog = _repairLog;
    _dispatch('limen:self-repair-result', entry);
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  function start() {
    window.addEventListener('limen:self-health-update', _onHealthUpdate);
  }

  function stop() {
    window.removeEventListener('limen:self-health-update', _onHealthUpdate);
  }

  // ─── Utilities ───────────────────────────────────────────────────────────

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  window.LIMENRepairLog = _repairLog;

  window.LIMENSelfRepairEngine = {
    start: start,
    stop: stop
  };

})();
