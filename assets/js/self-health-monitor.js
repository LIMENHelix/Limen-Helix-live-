/**
 * self-health-monitor.js
 * LIMEN HELIX — Self-Health Monitor
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 * Tracks LIMEN's own operational integrity: feed freshness,
 * module presence, stalled loops, empty states, event silence.
 *
 * Depends on: window.LIMENDebug, window.LIMENDomains, window.LIMENSourceAudit
 * Emits: limen:self-health-update (every cycle), limen:self-health-alert (on degradation)
 * Output: window.LIMENSelfHealth
 *
 * Load order: last module in bootstrap (after all others loaded)
 */

(function () {
  'use strict';

  var CHECK_MS = 10000;
  var STALE_THRESHOLD = 120000; // 2 minutes = stale feed
  var EVENT_SILENCE_THRESHOLD = 90000; // 90s without domain-update = silent

  // ─── State ───────────────────────────────────────────────────────────────

  var _interval = null;
  var _prevOverall = 'healthy';
  var _lastDomainEvent = 0;
  var _panelEl = null;

  // Track last event timestamp
  function _onDomainUpdate() {
    _lastDomainEvent = Date.now();
  }

  // ─── Module checks ────────────────────────────────────────────────────

  var MODULE_CHECKS = [
    { key: 'domainEngine',    api: 'LIMENDomainEngine',          label: 'Domain Engine' },
    { key: 'narrator',        api: 'LIMENEventNarrator',         label: 'Narrator' },
    { key: 'crossDomain',     api: 'LIMENCrossDomainDetector',   label: 'Cross-Domain' },
    { key: 'globalState',     api: 'LIMENGlobalStateEngine',     label: 'Global State' },
    { key: 'balanceMeter',    api: 'LIMENBalanceMeter',          label: 'Balance Meter' },
    { key: 'polarity',        api: 'LIMENReportPolarityEngine',  label: 'Polarity' },
    { key: 'marketTriage',    api: 'LIMENMarketStressTriage',    label: 'Market Triage' },
    { key: 'phaseEstimator',  api: 'LIMENPhaseEstimator',        label: 'Phase Estimator' }
  ];

  // ─── Health check ──────────────────────────────────────────────────────

  function _check() {
    var issues = [];
    var modules = {};
    var now = Date.now();

    // 1. Module presence
    var loadedDebug = (window.LIMENDebug && window.LIMENDebug.loadedModules) || [];
    for (var m = 0; m < MODULE_CHECKS.length; m++) {
      var mc = MODULE_CHECKS[m];
      if (window[mc.api]) {
        modules[mc.key] = 'ok';
      } else {
        modules[mc.key] = 'missing';
        issues.push(mc.label + ' not loaded');
      }
    }

    // 2. Feed freshness
    var domains = window.LIMENDomains || {};
    var audit = window.LIMENSourceAudit || {};
    var staleDomains = [];
    var emptyDomains = [];
    var fallbackDomains = [];

    var domainKeys = ['economy', 'energy', 'environment', 'health', 'technology', 'research', 'supplyChain', 'governance', 'infrastructure', 'agriculture', 'industry', 'education', 'communication', 'culture', 'defense', 'religion', 'population', 'law', 'finance', 'intelligence'];
    for (var i = 0; i < domainKeys.length; i++) {
      var k = domainKeys[i];
      var d = domains[k];

      // Empty state check
      if (!d || d.updated === null) {
        emptyDomains.push(k);
        continue;
      }

      // Stale feed check
      if (now - d.updated > STALE_THRESHOLD) {
        staleDomains.push(k);
      }

      // Fallback check
      var a = audit[k];
      if (a && a.status === 'FALLBACK') {
        fallbackDomains.push(k);
      }
    }

    if (emptyDomains.length > 0) {
      issues.push(emptyDomains.length + ' domain(s) empty: ' + emptyDomains.join(', '));
    }
    if (staleDomains.length > 0) {
      issues.push(staleDomains.length + ' domain(s) stale: ' + staleDomains.join(', '));
    }
    if (fallbackDomains.length > 0) {
      issues.push(fallbackDomains.length + ' domain(s) on fallback: ' + fallbackDomains.join(', '));
    }

    // 3. Event silence
    if (_lastDomainEvent > 0 && now - _lastDomainEvent > EVENT_SILENCE_THRESHOLD) {
      issues.push('domain-update event silence (' + Math.round((now - _lastDomainEvent) / 1000) + 's)');
      if (modules.domainEngine === 'ok') {
        modules.domainEngine = 'stalled';
      }
    }

    // 4. Feed gateway check
    var feedAlive = false;
    for (var f = 0; f < domainKeys.length; f++) {
      var fd = domains[domainKeys[f]];
      if (fd && fd.sources) {
        for (var s = 0; s < fd.sources.length; s++) {
          if (fd.sources[s].live) { feedAlive = true; break; }
        }
      }
      if (feedAlive) break;
    }
    modules.feedGateway = feedAlive ? 'ok' : 'degraded';
    if (!feedAlive) {
      issues.push('no live feed sources active');
    }

    // 5. Startup errors
    var startupErrors = (window.LIMENDebug && window.LIMENDebug.startupErrors) || [];
    if (startupErrors.length > 0) {
      issues.push(startupErrors.length + ' startup error(s)');
    }

    // 6. Missing UI panels
    var panelChecks = [
      { id: 'limen-domain-panel', label: 'Domain panel' },
      { id: 'limen-global-state-badge', label: 'Global state badge' }
    ];
    for (var p = 0; p < panelChecks.length; p++) {
      if (!document.getElementById(panelChecks[p].id)) {
        issues.push(panelChecks[p].label + ' not rendered');
      }
    }

    // 7. Deep directive extraction flag
    if (!window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) {
      modules.directiveExtraction = 'disabled';
      issues.push('Deep directive extraction flag is OFF \u2014 only L0 treatments visible');
      console.warn('[SelfHealth] Deep directive extraction flag is OFF \u2014 only L0 treatments visible');
    } else {
      modules.directiveExtraction = 'ok';
    }

    // 8. Deep pipeline execution status (domain-console pages only)
    var _domParam = (new URLSearchParams(window.location.search)).get('domain');
    if (_domParam && window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) {
      var _pascal = _domParam.charAt(0).toUpperCase() + _domParam.slice(1);
      var _bridgeName = 'LIMEN' + _pascal + 'PromotionBridge';
      var _bridge = window[_bridgeName];
      if (_bridge && typeof _bridge.getLastPromoted === 'function') {
        var _promoted = _bridge.getLastPromoted();
        modules.deepPipeline = (_promoted && _promoted.length > 0) ? 'active' : 'idle';
      } else {
        modules.deepPipeline = 'not-loaded';
      }
    }

    // 9. Multi-brain load status (civilization page — no ?domain= param)
    var _brCount = null;
    var _brActive = null;
    if (!_domParam) {
      var _br = window.LIMENDomainBrains;
      if (_br && typeof _br.getAllStates === 'function') {
        try {
          var _brStates = _br.getAllStates() || {};
          _brCount = Object.keys(_brStates).length;
          var _brDomains = window.LIMENDomains || {};
          _brActive = 0;
          for (var _bki in _brDomains) {
            if (!_brDomains.hasOwnProperty(_bki)) continue;
            var _bd = _brDomains[_bki];
            if (_bd && Array.isArray(_bd.brainDiagnoses)) {
              for (var _bdi = 0; _bdi < _bd.brainDiagnoses.length; _bdi++) {
                if (_bd.brainDiagnoses[_bdi] && _bd.brainDiagnoses[_bdi].active) {
                  _brActive++;
                  break;
                }
              }
            }
          }
        } catch (_e) { /* silent — diagnostic only */ }
      }
    }

    // ─── Overall assessment ─────────────────────────────────────────

    var overall = 'healthy';
    var missingCount = 0;
    var degradedCount = 0;
    for (var mk in modules) {
      if (modules[mk] === 'missing' || modules[mk] === 'disabled') missingCount++;
      if (modules[mk] === 'degraded' || modules[mk] === 'stalled') degradedCount++;
    }

    if (missingCount >= 3 || (staleDomains.length >= 4 && !feedAlive)) {
      overall = 'degraded';
    } else if (missingCount > 0 || degradedCount > 0 || staleDomains.length > 0 || fallbackDomains.length >= 3) {
      overall = 'degraded';
    } else if (issues.length === 0) {
      overall = 'healthy';
    }

    // Recovering: was degraded, now fewer issues
    if (_prevOverall === 'degraded' && issues.length > 0 && issues.length < 3 && missingCount === 0) {
      overall = 'recovering';
    }

    var health = {
      overall: overall,
      modules: modules,
      issues: issues,
      staleDomains: staleDomains,
      fallbackDomains: fallbackDomains,
      feedAlive: feedAlive,
      brainCount: _brCount,
      brainActive: _brActive,
      updated: now
    };

    window.LIMENSelfHealth = health;
    _dispatch('limen:self-health-update', health);

    // Alert on transition to degraded
    if (overall === 'degraded' && _prevOverall !== 'degraded') {
      _dispatch('limen:self-health-alert', health);
    }

    _prevOverall = overall;
    _renderStrip();
  }

  // ─── Health strip UI ───────────────────────────────────────────────────

  function _ensureStrip() {
    if (_panelEl) return;
    _panelEl = document.createElement('div');
    _panelEl.id = 'limen-health-strip';
    _panelEl.style.cssText = [
      'position:fixed',
      'bottom:8px',
      'right:12px',
      'background:rgba(8,9,12,0.85)',
      'border:1px solid rgba(201,169,78,0.12)',
      'padding:4px 10px',
      'font-family:"IBM Plex Mono",monospace',
      'font-size:0.40rem',
      'letter-spacing:1.5px',
      'z-index:9994',
      'border-radius:2px',
      'pointer-events:none',
      'line-height:1.6'
    ].join(';');
    document.body.appendChild(_panelEl);
  }

  function _renderStrip() {
    _ensureStrip();
    var health = window.LIMENSelfHealth || {};
    var overall = health.overall || 'healthy';

    var color = 'rgba(90,181,160,0.7)';
    if (overall === 'degraded') color = '#e85454';
    else if (overall === 'recovering') color = '#d4a44e';

    var issueCount = (health.issues && health.issues.length) || 0;
    var issueText = issueCount > 0 ? ' \u2022 ' + issueCount + ' issue' + (issueCount !== 1 ? 's' : '') : '';

    var dxFlag = window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION;
    var dxTag = dxFlag
      ? ''
      : ' <span style="color:#e85454">\u2022 DEEP-DX OFF</span>';

    var pipeTag = '';
    var pipeStatus = (health.modules && health.modules.deepPipeline) || null;
    if (pipeStatus === 'active') {
      pipeTag = ' <span style="color:rgba(90,181,160,0.7)">\u2022 DEEP-DX ON</span>';
    } else if (pipeStatus === 'idle') {
      pipeTag = ' <span style="color:rgba(201,169,78,0.5)">\u2022 DEEP-DX IDLE</span>';
    } else if (pipeStatus === 'not-loaded') {
      pipeTag = ' <span style="color:#e85454">\u2022 DEEP-DX NL</span>';
    }

    var brainTag = '';
    if (typeof health.brainCount === 'number') {
      var _bcColor = health.brainCount >= 20 ? 'rgba(90,181,160,0.7)' : (health.brainCount > 0 ? 'rgba(201,169,78,0.6)' : '#e85454');
      brainTag = ' <span style="color:' + _bcColor + '">\u2022 BRAINS ' + health.brainCount + '/20</span>';
      if (typeof health.brainActive === 'number') {
        var _baColor = health.brainActive > 0 ? 'rgba(90,181,160,0.7)' : 'rgba(200,195,184,0.35)';
        brainTag += ' <span style="color:' + _baColor + '">\u2022 ACTIVE ' + health.brainActive + '</span>';
      }
    }

    _panelEl.innerHTML =
      '<span style="color:rgba(201,169,78,0.35)">HEALTH </span>' +
      '<span style="color:' + color + '">' + overall.toUpperCase() + '</span>' +
      '<span style="color:rgba(200,195,184,0.25)">' + issueText + '</span>' +
      dxTag + pipeTag + brainTag;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  function start() {
    if (_interval) return;
    window.addEventListener('limen:domain-update', _onDomainUpdate);
    window.addEventListener('limen:self-health-alert', _onHealthAlertForNarrator);
    // Delay first check to let modules initialize
    setTimeout(function () {
      _check();
      _interval = setInterval(_check, CHECK_MS);
    }, 3000);
  }

  function stop() {
    if (_interval) {
      clearInterval(_interval);
      _interval = null;
    }
    window.removeEventListener('limen:domain-update', _onDomainUpdate);
    window.removeEventListener('limen:self-health-alert', _onHealthAlertForNarrator);
    if (_panelEl && _panelEl.parentNode) _panelEl.parentNode.removeChild(_panelEl);
    _panelEl = null;
  }

  // ─── Narrator integration ─────────────────────────────────────────────

  function _onHealthAlertForNarrator(e) {
    var health = e.detail;
    if (!health) return;
    // Dispatch a narrator-compatible phase-change event
    var drivers = (health.issues || []).slice(0, 4);
    _dispatch('limen:phase-change', {
      from: 'healthy',
      to: 'degraded',
      type: 'self-health',
      topDrivers: drivers
    });
  }

  // ─── Utilities ───────────────────────────────────────────────────────────

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  window.LIMENSelfHealth = {
    overall: 'healthy',
    modules: {},
    issues: [],
    updated: null
  };

  window.LIMENSelfHealthMonitor = {
    start: start,
    stop: stop
  };

})();
