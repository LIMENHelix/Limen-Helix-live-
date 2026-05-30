/**
 * human-state-packet.js
 * LIMEN HELIX — Human Interoception Packet Builder
 *
 * Consumes the existing biosensor stack (window.LIMENBiosensor,
 * window.LIMENBiosensorBridge, window.LIMENDomainBiosensorAdapter) and
 * produces normalized humanStatePacket objects every POLL_MS.
 *
 * Does NOT re-derive raw signals (those belong to biosensorEngine.js).
 * Does NOT classify into the 5-state regulation set (the bridge already
 * does that). What this module adds:
 *
 *   - 8-phase human classifier (HUMAN_P0_BASELINE .. HUMAN_P7_REDLINE)
 *     mapped from arousal × coherence × cognitiveLoad × trend.
 *   - Derived state vector: arousal, coherence, cognitiveLoad, fatigue,
 *     frustration, flowState, overloadRisk — all 0..1, computed from
 *     existing biosensor outputs + simple time integrators.
 *   - recommendedSystemBehavior: uiMode / taskMode / promptStyle /
 *     interruptLevel / allowAutofire — derived deterministically from
 *     phase. This is what the human-context-gate uses to evaluate
 *     proposed actions.
 *   - Identity-filtered inputs: only signals declared in
 *     LIMENOperatorCanonicalIdentity.allowedInputs flow into the packet.
 *
 * Subscribers (the gate, the UI panel, optional server publish):
 *   window.LIMENHumanStatePacket.subscribe(fn)
 *
 * Per CLAUDE.md prime directive: packets live in RAM only. No
 * localStorage. No cookies. No fingerprinting. Server publishing is
 * opt-in via operator token and uses /api/limen-operator-calibration.
 *
 * Load order: AFTER biosensor-bridge.js + operator-canonical-identity.js.
 */
(function () {
  'use strict';

  var POLL_MS = 30000;          // Emit packet every 30s (per spec: 30-120s)
  var MIN_PACKET_INTERVAL = 5000; // Don't emit faster than every 5s on demand
  var HISTORY_SIZE = 20;        // ~10 minutes of 30s packets for trend/integration

  // ── State ──
  var _packetHistory = [];
  var _subscribers = [];
  var _interval = null;
  var _lastEmit = 0;
  var _operatorId = 'operator_chris';

  // Time-integrated state — these accumulate slowly across packets,
  // unlike arousal/coherence which are instantaneous biosensor readings.
  var _fatigueIntegrator = 0;   // 0..1, rises with sustained high load
  var _frustrationIntegrator = 0; // 0..1, rises with high backspace + low coherence
  var _flowIntegrator = 0;      // 0..1, rises with focused + steady arousal
  var _lastUpdateTs = Date.now();

  // ── Phase definitions ──
  // Maps each phase to its qualitative description + recommended system
  // behavior. The gate consumes recommendedSystemBehavior; the UI
  // consumes description.
  var HUMAN_PHASES = {
    HUMAN_P0_BASELINE: {
      description: 'Stable, normal cognition.',
      recommendedSystemBehavior: {
        uiMode: 'normal',
        taskMode: 'general',
        promptStyle: 'normal',
        interruptLevel: 'normal',
        allowAutofire: true
      }
    },
    HUMAN_P1_AROUSAL_RISE: {
      description: 'Activation rising; useful for execution but monitor drift.',
      recommendedSystemBehavior: {
        uiMode: 'normal',
        taskMode: 'execution',
        promptStyle: 'concise',
        interruptLevel: 'low',
        allowAutofire: true
      }
    },
    HUMAN_P2_FOCUSED_FLOW: {
      description: 'Best state for architecture, coding, synthesis.',
      recommendedSystemBehavior: {
        uiMode: 'minimal',
        taskMode: 'deep_work',
        promptStyle: 'direct',
        interruptLevel: 'minimal',
        allowAutofire: false   // don't interrupt flow with autofire
      }
    },
    HUMAN_P3_FRAGMENTATION: {
      description: 'Task switching, semantic overload, scattered direction.',
      recommendedSystemBehavior: {
        uiMode: 'guided',
        taskMode: 'summarize',
        promptStyle: 'structured',
        interruptLevel: 'low',
        allowAutofire: false
      }
    },
    HUMAN_P4_OVERLOAD: {
      description: 'High load; system should simplify and reduce choices.',
      recommendedSystemBehavior: {
        uiMode: 'simplified',
        taskMode: 'one_next_step',
        promptStyle: 'single_choice',
        interruptLevel: 'none',
        allowAutofire: false
      }
    },
    HUMAN_P5_DEPLETION: {
      description: 'Fatigue / brain fog; system should stop expansion and summarize only.',
      recommendedSystemBehavior: {
        uiMode: 'recap_only',
        taskMode: 'preserve_state',
        promptStyle: 'summary',
        interruptLevel: 'none',
        allowAutofire: false
      }
    },
    HUMAN_P6_RECOVERY: {
      description: 'Lower intensity; good for review, cleanup, documentation.',
      recommendedSystemBehavior: {
        uiMode: 'normal',
        taskMode: 'cleanup_review',
        promptStyle: 'reflective',
        interruptLevel: 'low',
        allowAutofire: false
      }
    },
    HUMAN_P7_REDLINE: {
      description: 'Do not make major decisions. No filing, sending, trading, deleting, committing.',
      recommendedSystemBehavior: {
        uiMode: 'safety_only',
        taskMode: 'do_nothing',
        promptStyle: 'safety_summary',
        interruptLevel: 'none',
        allowAutofire: false
      }
    }
  };

  // ── Helpers ──
  function _clamp01(x) {
    if (typeof x !== 'number' || isNaN(x)) return 0;
    return x < 0 ? 0 : (x > 1 ? 1 : x);
  }

  function _deepClone(v) {
    if (typeof structuredClone === 'function') {
      try { return structuredClone(v); } catch (e) { /* fall through */ }
    }
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return null; }
  }

  function _now() { return Date.now(); }

  // ── Read from existing biosensor stack (identity-filtered) ──
  function _readRawSignals() {
    var identity = (typeof window !== 'undefined' && window.LIMENOperatorCanonicalIdentity)
      ? window.LIMENOperatorCanonicalIdentity : null;
    var allow = function (name) {
      return !identity || identity.isInputAllowed(name);
    };

    var raw = {};

    // Pull from the domain-safe adapter — it already applies confidence /
    // staleness gating. If null, biosensor is unavailable or low-confidence.
    var adapter = (typeof window !== 'undefined') ? window.LIMENDomainBiosensorAdapter : null;
    var adapterState = adapter && typeof adapter.getRawState === 'function'
      ? adapter.getRawState() : null;

    if (!adapterState) return null;

    if (allow('arousal'))         raw.arousal         = adapterState.arousal;
    if (allow('coherence'))       raw.coherence       = adapterState.coherence;
    if (allow('cognitive_load'))  raw.cognitiveLoad   = adapterState.cognitiveLoad;
    if (allow('heart_rate'))      raw.heartRate       = adapterState.heartRate;
    if (allow('hrv_proxy'))       raw.hrv             = adapterState.hrv;

    // Pull raw biosensor for behavior-specific channels (typing, taps).
    var bio = (typeof window !== 'undefined') ? window.LIMENBiosensor : null;
    var bioState = (typeof window !== 'undefined' && window._limenBiosensor &&
                    typeof window._limenBiosensor.getState === 'function')
      ? window._limenBiosensor.getState() : null;

    if (bioState && bioState.channels) {
      var behavior = bioState.channels.behavior;
      if (behavior) {
        if (allow('typing_cadence') && typeof behavior.tapCadence === 'number') {
          raw.typingSpeedWpm = behavior.tapCadence * 12; // rough taps/s → wpm
        }
        if (allow('typing_variability') && typeof behavior.tapVariability === 'number') {
          raw.typingVariability = behavior.tapVariability;
        }
        if (allow('backspace_rate') && typeof behavior.backspaceRate === 'number') {
          raw.backspaceRate = behavior.backspaceRate;
        }
        if (allow('pause_duration') && typeof behavior.pauseDuration === 'number') {
          raw.pauseDuration = behavior.pauseDuration;
        }
        if (allow('interaction_latency') && typeof behavior.interactionLatency === 'number') {
          raw.interactionLatency = behavior.interactionLatency;
        }
        if (allow('task_switching_rate') && typeof behavior.taskSwitchingRate === 'number') {
          raw.taskSwitchingRate = behavior.taskSwitchingRate;
        }
        if (allow('error_correction_rate') && typeof behavior.errorCorrectionRate === 'number') {
          raw.errorCorrectionRate = behavior.errorCorrectionRate;
        }
      }
      var motion = bioState.channels.motion;
      if (motion && allow('camera_motion') && typeof motion.motionScore === 'number') {
        raw.motionInstability = motion.motionScore;
      }
      // Facial tension from rPPG channel if available
      var rppg = bioState.channels.rppg;
      if (rppg && allow('facial_tension') && typeof rppg.tensionScore === 'number') {
        raw.faceTensionScore = rppg.tensionScore;
      }
      if (rppg && typeof rppg.blinkRate === 'number') {
        raw.blinkRate = rppg.blinkRate;
      }
    }

    raw._adapterConfidence = adapterState.confidence;
    raw._adapterRegulation = adapterState.regulation;
    raw._adapterTimestamp = adapterState.timestamp;
    return raw;
  }

  // ── Derive composite state vector ──
  function _deriveState(raw, dtSec) {
    if (!raw) {
      return {
        arousal: 0, coherence: 0, cognitiveLoad: 0,
        fatigue: 0, frustration: 0, flowState: 0, overloadRisk: 0
      };
    }

    var arousal = _clamp01(raw.arousal || 0);
    var coherence = _clamp01(raw.coherence || 0);
    var load = _clamp01(raw.cognitiveLoad || 0);

    // Fatigue: rises slowly under sustained high load + low coherence.
    // Decays slowly under low load + high coherence (recovery).
    var fatigueRate = (load > 0.55 && coherence < 0.50) ? 0.0008 * dtSec
                    : (load < 0.30 && coherence > 0.55) ? -0.0005 * dtSec
                    : 0;
    _fatigueIntegrator = _clamp01(_fatigueIntegrator + fatigueRate);

    // Frustration: rises with high backspace/error correction + low coherence.
    var backspace = _clamp01(raw.backspaceRate || 0);
    var errorRate = _clamp01(raw.errorCorrectionRate || 0);
    var frustrationSignal = Math.max(backspace, errorRate);
    var frustrationRate = (frustrationSignal > 0.4 && coherence < 0.45) ? 0.0015 * dtSec
                        : -0.0010 * dtSec;
    _frustrationIntegrator = _clamp01(_frustrationIntegrator + frustrationRate);

    // Flow: rises with focused regulation state + arousal 0.35..0.65 + high coherence + load 0.45..0.75.
    var inFlowZone = (arousal >= 0.35 && arousal <= 0.65) &&
                     (load >= 0.45 && load <= 0.75) &&
                     (coherence >= 0.55);
    var flowRate = inFlowZone ? 0.0020 * dtSec : -0.0015 * dtSec;
    _flowIntegrator = _clamp01(_flowIntegrator + flowRate);

    // OverloadRisk: weighted combination — high load + high arousal + low coherence + rising fatigue.
    var overloadRisk = _clamp01(
      (load * 0.35) +
      (Math.max(0, arousal - 0.5) * 0.5) +
      ((1 - coherence) * 0.25) +
      (_fatigueIntegrator * 0.30)
    );

    return {
      arousal: arousal,
      coherence: coherence,
      cognitiveLoad: load,
      fatigue: _fatigueIntegrator,
      frustration: _frustrationIntegrator,
      flowState: _flowIntegrator,
      overloadRisk: overloadRisk
    };
  }

  // ── 8-phase classifier ──
  // Priority order matters: REDLINE > DEPLETION > OVERLOAD > FRAGMENTATION
  // > AROUSAL_RISE > FOCUSED_FLOW > RECOVERY > BASELINE.
  function _classifyPhase(derived, raw) {
    if (!derived) return { phase: 'HUMAN_P0_BASELINE', confidence: 0 };

    var regulation = raw && raw._adapterRegulation;
    var adapterConf = raw && raw._adapterConfidence ? raw._adapterConfidence : 0;

    // P7 REDLINE — extreme overload risk OR sustained high fatigue + frustration.
    if (derived.overloadRisk > 0.85 ||
        (derived.fatigue > 0.75 && derived.frustration > 0.65)) {
      return { phase: 'HUMAN_P7_REDLINE', confidence: Math.min(1, adapterConf + 0.2) };
    }

    // P5 DEPLETION — high fatigue, low arousal, low load. Brain fog signature.
    if (derived.fatigue > 0.65 && derived.arousal < 0.40 && derived.cognitiveLoad < 0.40) {
      return { phase: 'HUMAN_P5_DEPLETION', confidence: adapterConf };
    }

    // P4 OVERLOAD — explicit overload risk above threshold, regardless of fatigue.
    if (derived.overloadRisk > 0.65 || regulation === 'overloaded') {
      return { phase: 'HUMAN_P4_OVERLOAD', confidence: adapterConf };
    }

    // P3 FRAGMENTATION — high frustration + scattered (load > 0.4 with low coherence).
    if (derived.frustration > 0.55 ||
        (derived.cognitiveLoad > 0.4 && derived.coherence < 0.40)) {
      return { phase: 'HUMAN_P3_FRAGMENTATION', confidence: adapterConf };
    }

    // P2 FOCUSED_FLOW — strong flow integrator OR regulation=focused with good coherence.
    if (derived.flowState > 0.50 ||
        (regulation === 'focused' && derived.coherence > 0.55)) {
      return { phase: 'HUMAN_P2_FOCUSED_FLOW', confidence: adapterConf };
    }

    // P1 AROUSAL_RISE — arousal climbing, regulation=pressured but coherence holding.
    if (derived.arousal > 0.55 && derived.coherence > 0.40) {
      return { phase: 'HUMAN_P1_AROUSAL_RISE', confidence: adapterConf };
    }

    // P6 RECOVERY — bridge says recovering, OR fatigue declining + coherence rising.
    if (regulation === 'recovering' ||
        (derived.fatigue > 0.30 && derived.coherence > 0.55 && derived.arousal < 0.45)) {
      return { phase: 'HUMAN_P6_RECOVERY', confidence: adapterConf };
    }

    return { phase: 'HUMAN_P0_BASELINE', confidence: adapterConf };
  }

  // ── Build packet ──
  function buildPacket() {
    var now = _now();
    var dtSec = Math.max(0.1, Math.min(120, (now - _lastUpdateTs) / 1000));
    _lastUpdateTs = now;

    var raw = _readRawSignals();
    var derived = _deriveState(raw, dtSec);
    var classified = _classifyPhase(derived, raw);
    var phaseDef = HUMAN_PHASES[classified.phase] || HUMAN_PHASES.HUMAN_P0_BASELINE;

    var packet = {
      schemaVersion: '1.0.0',
      timestamp: now,
      operatorId: _operatorId,

      // Raw signals (identity-filtered)
      rawSignals: raw ? {
        typingSpeedWpm: raw.typingSpeedWpm || null,
        typingVariability: raw.typingVariability || null,
        backspaceRate: raw.backspaceRate || null,
        pauseDuration: raw.pauseDuration || null,
        hrvProxy: raw.hrv || null,
        faceTensionScore: raw.faceTensionScore || null,
        blinkRate: raw.blinkRate || null,
        motionInstability: raw.motionInstability || null,
        interactionLatency: raw.interactionLatency || null,
        heartRate: raw.heartRate || null,
        arousal: raw.arousal != null ? raw.arousal : null,
        coherence: raw.coherence != null ? raw.coherence : null,
        cognitiveLoad: raw.cognitiveLoad != null ? raw.cognitiveLoad : null
      } : null,

      // Derived composite vector (0..1 each)
      derivedState: derived,

      // 8-phase classification + confidence
      phase: classified.phase,
      phaseDescription: phaseDef.description,
      confidence: classified.confidence,

      // Inherited classification from bridge for cross-reference
      regulationState: raw ? raw._adapterRegulation : 'unknown',
      adapterConfidence: raw ? raw._adapterConfidence : 0,

      // What the gate should do given this phase
      recommendedSystemBehavior: _deepClone(phaseDef.recommendedSystemBehavior),

      // Provenance — which identity declaration governed this packet
      identityVersion: (typeof window !== 'undefined' && window.LIMENOperatorCanonicalIdentity)
        ? window.LIMENOperatorCanonicalIdentity.getVersion() : null,

      available: !!raw
    };

    return packet;
  }

  // ── Emission loop ──
  function _emit(force) {
    var now = _now();
    if (!force && (now - _lastEmit < MIN_PACKET_INTERVAL)) return;
    _lastEmit = now;

    var packet = buildPacket();
    _packetHistory.push(packet);
    if (_packetHistory.length > HISTORY_SIZE) _packetHistory.shift();

    for (var i = 0; i < _subscribers.length; i++) {
      try { _subscribers[i](packet); } catch (e) { /* silent — never break loop */ }
    }

    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('limen:human-state-packet', { detail: packet }));
      } catch (e) { /* silent */ }
    }
  }

  // ── Public API ──
  function start() {
    if (_interval) return;
    _interval = setInterval(function () {
      if (typeof document !== 'undefined' && document.hidden) return;
      _emit(false);
    }, POLL_MS);
    _emit(true); // initial packet immediately
  }

  function stop() {
    if (_interval) { clearInterval(_interval); _interval = null; }
  }

  function getLatestHumanStatePacket() {
    if (_packetHistory.length === 0) return buildPacket(); // on-demand build
    return _deepClone(_packetHistory[_packetHistory.length - 1]);
  }

  function getHistory(n) {
    var count = typeof n === 'number' ? Math.min(n, _packetHistory.length) : _packetHistory.length;
    var out = [];
    for (var i = _packetHistory.length - count; i < _packetHistory.length; i++) {
      out.push(_deepClone(_packetHistory[i]));
    }
    return out;
  }

  function subscribe(fn) {
    if (typeof fn === 'function') _subscribers.push(fn);
  }

  function getPhases() { return _deepClone(HUMAN_PHASES); }

  function forceEmit() { _emit(true); }

  if (typeof window !== 'undefined') {
    window.LIMENHumanStatePacket = {
      start: start,
      stop: stop,
      getLatestHumanStatePacket: getLatestHumanStatePacket,
      getHistory: getHistory,
      subscribe: subscribe,
      getPhases: getPhases,
      buildPacket: buildPacket,
      forceEmit: forceEmit,
      POLL_MS: POLL_MS
    };

    // Auto-start once the page is visible.
    if (typeof document !== 'undefined') {
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(start, 1000);
      } else {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 1000); });
      }
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      HUMAN_PHASES: HUMAN_PHASES,
      buildPacket: buildPacket,
      getLatestHumanStatePacket: getLatestHumanStatePacket,
      subscribe: subscribe,
      start: start,
      stop: stop
    };
  }
})();
