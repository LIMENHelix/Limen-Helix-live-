/**
 * biosensor-bridge.js
 * LIMEN HELIX — Biosensor Integration Layer
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 *
 * Wrapper/controller that reads available biosensor outputs from
 * biosensorEngine.js and maps them into simple regulation states
 * for the console UI. Does NOT rewrite biosensor core logic.
 *
 * Regulation states: calm, focused, pressured, overloaded, recovering
 *
 * Consumed from biosensor: arousal, coherence, cognitiveLoad, valence,
 *                          heartRate, hrv, archetype
 *
 * Output: window.LIMENBiosensorBridge
 * Events: limen:regulation-update (on state change)
 *
 * Load order: after biosensorEngine.js, before limen-bootstrap.js
 */

(function () {
  'use strict';

  // ─── Constants ──────────────────────────────────────────────────────────

  var POLL_MS = 1000;          // Check biosensor state every second
  var HISTORY_SIZE = 10;       // Rolling history for trend detection
  var STABILITY_WINDOW = 3;    // Must hold a state this many cycles to confirm

  // Regulation state thresholds
  var THRESHOLDS = {
    calm:       { arousalMax: 0.35, coherenceMin: 0.55 },
    focused:    { arousalMin: 0.25, arousalMax: 0.65, loadMin: 0.45, coherenceMin: 0.35 },
    pressured:  { arousalMin: 0.55, coherenceMax: 0.45 },
    overloaded: { arousalMin: 0.65, loadMin: 0.60, coherenceMax: 0.35 },
    recovering: { arousalTrendDown: true, coherenceTrendUp: true }
  };

  // ─── State ──────────────────────────────────────────────────────────────

  var _engine = null;              // Reference to biosensor engine instance
  var _interval = null;
  var _badgeEl = null;
  var _subscribers = [];

  var _regulationState = 'unknown'; // calm | focused | pressured | overloaded | recovering | unknown
  var _pendingState = null;
  var _pendingCount = 0;
  var _confidence = 0;              // 0-1 how confident in current regulation reading
  var _lastBioState = null;         // Last raw biosensor state
  var _trackerState = null;         // State received from the /biosensor tracker tab (BroadcastChannel)
  var _trackerTs = 0;
  var _bc = null;

  // Rolling history for trend detection
  var _arousalHistory = [];
  var _coherenceHistory = [];

  // ─── Biosensor engine discovery ─────────────────────────────────────────

  function _findEngine() {
    // The biosensor engine is created via window.startBiosensorEngine()
    // It might be stored in various places depending on how the page initializes it
    if (window._limenBiosensor) return window._limenBiosensor;
    if (window.biosensorEngine) return window.biosensorEngine;
    // Check if the factory function exists but engine not yet started
    if (typeof window.startBiosensorEngine === 'function') return null;
    return null;
  }

  function _ensureEngine() {
    if (_engine) return true;
    _engine = _findEngine();
    if (_engine && typeof _engine.subscribe === 'function') {
      // Subscribe to fusion updates for live data
      _engine.subscribe(_onBioUpdate);
      return true;
    }
    return false;
  }

  // ─── Biosensor update handler ───────────────────────────────────────────

  function _onBioUpdate(bioState) {
    _lastBioState = bioState;
  }

  // ─── Regulation state classification ────────────────────────────────────

  function _classify(bioState) {
    if (!bioState) return 'unknown';

    var arousal = bioState.arousal || 0;
    var coherence = bioState.coherence || 0;
    var load = bioState.cognitiveLoad || 0;

    // Record history for trend detection
    _arousalHistory.push(arousal);
    _coherenceHistory.push(coherence);
    if (_arousalHistory.length > HISTORY_SIZE) _arousalHistory.shift();
    if (_coherenceHistory.length > HISTORY_SIZE) _coherenceHistory.shift();

    var arousalTrend = _trend(_arousalHistory);
    var coherenceTrend = _trend(_coherenceHistory);

    // Classification priority: overloaded > pressured > recovering > focused > calm
    if (arousal >= THRESHOLDS.overloaded.arousalMin &&
        load >= THRESHOLDS.overloaded.loadMin &&
        coherence <= THRESHOLDS.overloaded.coherenceMax) {
      return 'overloaded';
    }

    if (arousal >= THRESHOLDS.pressured.arousalMin &&
        coherence <= THRESHOLDS.pressured.coherenceMax) {
      return 'pressured';
    }

    // Recovering: arousal trending down AND coherence trending up
    if (_arousalHistory.length >= 4 &&
        arousalTrend < -0.02 && coherenceTrend > 0.02 &&
        arousal > 0.25) {
      return 'recovering';
    }

    if (arousal >= THRESHOLDS.focused.arousalMin &&
        arousal <= THRESHOLDS.focused.arousalMax &&
        load >= THRESHOLDS.focused.loadMin &&
        coherence >= THRESHOLDS.focused.coherenceMin) {
      return 'focused';
    }

    if (arousal <= THRESHOLDS.calm.arousalMax &&
        coherence >= THRESHOLDS.calm.coherenceMin) {
      return 'calm';
    }

    // Default: closest match by distance
    return _closestState(arousal, coherence, load);
  }

  function _closestState(arousal, coherence, load) {
    // Simple heuristic fallback
    if (arousal < 0.4) return 'calm';
    if (load > 0.5 && coherence > 0.3) return 'focused';
    if (arousal > 0.5) return 'pressured';
    return 'calm';
  }

  function _trend(arr) {
    if (arr.length < 3) return 0;
    var recent = arr.slice(-3);
    return (recent[recent.length - 1] - recent[0]) / recent.length;
  }

  // ─── Confidence computation ─────────────────────────────────────────────

  function _computeConfidence(bioState) {
    if (!bioState) return 0;
    var conf = 0;
    // Behavioral channel is always active
    if (bioState.channels && bioState.channels.behavior) conf += 0.3;
    // Camera/BLE heart rate
    if (bioState.heartRate > 0) conf += 0.35;
    // Motion sensor
    if (bioState.channels && bioState.channels.motion) conf += 0.15;
    // Signal quality
    if (bioState.signalQuality > 0.5) conf += 0.20;
    else if (bioState.signalQuality > 0.3) conf += 0.10;
    return Math.min(conf, 1);
  }

  // ─── Polling loop ───────────────────────────────────────────────────────

  function _poll() {
    var trackerFresh = _trackerState && (Date.now() - _trackerTs) < 3000;
    // Need a local engine OR a fresh broadcast from the /biosensor tracker tab
    if (!_ensureEngine() && !trackerFresh) {
      return;
    }

    // The tracker tab (rich: camera + BLE + inferred phase) wins over the local engine.
    var bioState = trackerFresh ? _trackerState : _lastBioState;
    if (!bioState && _engine && typeof _engine.getState === 'function') {
      bioState = _engine.getState();
    }
    if (!bioState) return;

    // Classify regulation state
    var newState = _classify(bioState);
    _confidence = _computeConfidence(bioState);

    // Stability filter: require STABILITY_WINDOW consecutive same-state readings
    if (newState === _pendingState) {
      _pendingCount++;
    } else {
      _pendingState = newState;
      _pendingCount = 1;
    }

    if (_pendingCount >= STABILITY_WINDOW && newState !== _regulationState) {
      var prev = _regulationState;
      _regulationState = newState;
      _dispatch('limen:regulation-update', {
        state: _regulationState,
        previous: prev,
        confidence: _confidence,
        arousal: bioState.arousal,
        coherence: bioState.coherence,
        cognitiveLoad: bioState.cognitiveLoad,
        heartRate: bioState.heartRate || 0,
        archetype: bioState.archetype || 'unknown',
        timestamp: Date.now()
      });

      // Notify subscribers
      for (var i = 0; i < _subscribers.length; i++) {
        try { _subscribers[i](_regulationState, bioState); } catch (e) { /* silent */ }
      }
    }

    // Update badge regardless
    _renderBadge(bioState);

    // Drive signal router: gather inputs → map to seeds → feed propagation
    _routeSignals();
  }

  var _routeSkip = 0;
  function _routeSignals() {
    // Run every 3rd poll cycle (~3s) to avoid overwhelming propagation
    if (++_routeSkip % 3 !== 0) return;
    if (!window.LIMENSignalRouter || !window.SignalMapper) return;
    var signals = window.LIMENSignalRouter.gatherInputs();
    if (!signals || !signals.length) return;
    var seeds = window.SignalMapper.mapSignals(signals);
    // Store seeds for any consumer (connectome-core, renderer, etc.)
    // Does NOT call LIMENPropagation.activate() directly — that is owned by connectome-core
    window.LIMENRouterSeeds = seeds;
    _dispatch('limen:router-seeds', { seeds: seeds, signalCount: signals.length, timestamp: Date.now() });
  }

  // ─── Compact badge UI ───────────────────────────────────────────────────

  function _ensureBadge() {
    if (_badgeEl) return;
    // Floating badge superseded by the global top bar (assets/js/limen-topbar.js),
    // which surfaces LIMEN BIOSENSOR · LIVE plus the regulation state inline.
    // Keep a hidden stub so callers that read _badgeEl don't NPE.
    _badgeEl = document.createElement('div');
    _badgeEl.id = 'limen-biosensor-badge';
    _badgeEl.style.cssText = 'display:none';
    document.body.appendChild(_badgeEl);
  }

  var STATE_DISPLAY = {
    calm:       { label: 'CALM',       color: 'rgba(90,181,160,0.7)' },
    focused:    { label: 'FOCUSED',    color: 'rgba(59,130,246,0.7)' },
    pressured:  { label: 'PRESSURED',  color: 'rgba(212,164,78,0.7)' },
    overloaded: { label: 'OVERLOADED', color: 'rgba(232,84,84,0.7)' },
    recovering: { label: 'RECOVERING', color: 'rgba(139,92,246,0.7)' },
    unknown:    { label: 'SENSING',    color: 'rgba(200,195,184,0.3)' }
  };

  function _renderBadge(bioState) {
    _ensureBadge();

    var display = STATE_DISPLAY[_regulationState] || STATE_DISPLAY.unknown;
    var dim = 'rgba(200,195,184,0.25)';

    var html = '<span style="color:' + display.color + '">' + display.label + '</span>';

    // Show HR if available
    if (bioState && bioState.heartRate > 0) {
      html += ' <span style="color:' + dim + '">' + Math.round(bioState.heartRate) + ' bpm</span>';
    }

    // Confidence indicator
    if (_confidence > 0) {
      var confDots = _confidence > 0.7 ? '\u2022\u2022\u2022' : (_confidence > 0.4 ? '\u2022\u2022' : '\u2022');
      html += ' <span style="color:' + dim + ';font-size:0.34rem">' + confDots + '</span>';
    }

    _badgeEl.innerHTML = html;
  }

  // ─── Public getters ─────────────────────────────────────────────────────

  function getRegulationState() {
    return _regulationState;
  }

  function getConfidence() {
    return _confidence;
  }

  function getBioState() {
    return _lastBioState;
  }

  function isActive() {
    return !!_engine && _confidence > 0;
  }

  function subscribe(fn) {
    if (typeof fn === 'function') _subscribers.push(fn);
  }

  // ─── Engine initialization helper ───────────────────────────────────────
  // Call this if the page wants to auto-start the biosensor engine

  function initEngine(opts) {
    if (_engine) return;
    if (typeof window.startBiosensorEngine !== 'function') {
      console.warn('[LIMEN] biosensor-bridge: biosensorEngine.js not loaded');
      return;
    }
    var engineOpts = opts || { camera: false, hud: false };
    _engine = window.startBiosensorEngine(engineOpts);
    // Store reference for other modules
    window._limenBiosensor = _engine;
    // Compatibility alias — signal-router.js reads window.LIMENBiosensor
    window.LIMENBiosensor = {
      get active() { return !!_engine && _confidence > 0; },
      get heartRate() { return _lastBioState ? (_lastBioState.heartRate || 0) : 0; },
      get hrv() { return _lastBioState ? (_lastBioState.hrv || 0) : 0; },
      get arousal() { return _lastBioState ? (_lastBioState.arousal || 0) : 0; },
      get coherence() { return _lastBioState ? (_lastBioState.coherence || 0) : 0; },
      get cognitiveLoad() { return _lastBioState ? (_lastBioState.cognitiveLoad || 0) : 0; },
      get viz() { return _lastBioState ? (_lastBioState.viz || null) : null; }
    };
    // Subscribe to fusion updates
    if (typeof _engine.subscribe === 'function') {
      _engine.subscribe(_onBioUpdate);
    }
    // Start the engine (async — behavioral starts immediately, camera/motion if enabled)
    if (typeof _engine.start === 'function') {
      _engine.start();
    }
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  // ─── Receive live state from the EXTERNAL biosensor tracker site ─────────
  // The outside tracker app POSTs to /api/biosensor-state (Redis, TTL 30s); we
  // poll it so the cockpit reflects the human. Cross-origin source, so no
  // BroadcastChannel — the API + Redis is the bridge.
  function _initTrackerReceiver() {
    if (_bc) return; _bc = true;
    function poll() {
      try {
        fetch('/api/biosensor-state', { cache: 'no-store' })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            var m = j && j.ok && j.state;
            if (m && (Date.now() - (m.ts || 0) < 30000)) {
              _trackerState = {
                arousal: m.arousal, coherence: m.coherence, cognitiveLoad: m.cognitiveLoad,
                valence: m.valence, heartRate: m.hr || 0, hrv: m.hrv || 0,
                archetype: (m.phase && m.phase.id) || 'unknown', trackerPhase: m.phase || null
              };
              _trackerTs = Date.now();
            }
          }).catch(function () {});
      } catch (e) {}
    }
    poll();
    setInterval(poll, 2500);
  }

  function start() {
    if (_interval) return;
    _initTrackerReceiver();
    // Receive-only: no on-site sensing (the biosensor lives in the external app).
    // We only poll /api/biosensor-state for the operator's live phase.
    _interval = setInterval(function () { if (!document.hidden) _poll(); }, POLL_MS);
    _poll();
  }

  function stop() {
    if (_interval) {
      clearInterval(_interval);
      _interval = null;
    }
    if (_badgeEl && _badgeEl.parentNode) {
      _badgeEl.parentNode.removeChild(_badgeEl);
      _badgeEl = null;
    }
  }

  // ─── Utilities ──────────────────────────────────────────────────────────

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  window.LIMENBiosensorBridge = {
    start: start,
    stop: stop,
    getRegulationState: getRegulationState,
    getConfidence: getConfidence,
    getBioState: getBioState,
    isActive: isActive,
    subscribe: subscribe,
    initEngine: initEngine
  };

  // Auto-start receive-only: with the on-site panel removed, nothing else starts the
  // bridge — so it starts itself and polls /api/biosensor-state to reflect the operator.
  try {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  } catch (e) {}

})();
