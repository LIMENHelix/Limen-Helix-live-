/**
 * console-narrator.js
 * LIMEN HELIX — Console Voice & Narration Layer
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 *
 * Produces concise, calm, mission-control-style narration from:
 *   - Feed events (domain stress, escalation shifts)
 *   - Global state transitions
 *   - Biosensor regulation state changes
 *   - Feed reliability degradation
 *
 * Voice modes: silent, analyst, command
 * Uses browser speechSynthesis as local baseline.
 * Structured so premium TTS can be swapped in later.
 *
 * Output: window.LIMENConsoleNarrator
 * Events: limen:narrator-speak (on each narration)
 *
 * Load order: after biosensor-bridge.js, before limen-bootstrap.js
 */

(function () {
  'use strict';

  // ─── Constants ──────────────────────────────────────────────────────────

  var MODES = ['silent', 'analyst', 'command'];
  var SPEAK_COOLDOWN_MS = 8000;     // Min gap between spoken messages
  var MAX_QUEUE = 6;                 // Max pending narrations
  var PRIORITY_HIGH = 3;
  var PRIORITY_MEDIUM = 2;
  var PRIORITY_LOW = 1;
  var SPEAK_TIMEOUT_MS = 15000;     // Safety: reset _speaking if stuck this long

  // ─── State ──────────────────────────────────────────────────────────────

  var _mode = 'analyst';             // Current voice mode
  var _muted = false;                // Global mute
  var _queue = [];                   // Narration queue [{text, priority, timestamp}]
  var _lastSpokeAt = 0;             // Timestamp of last spoken message
  var _speakStartedAt = 0;          // When _speaking was set true (for timeout)
  var _interval = null;
  var _controlEl = null;
  var _synth = null;                 // SpeechSynthesis reference
  var _selectedVoice = null;         // Preferred voice
  var _speaking = false;
  var _lastGlobalMode = null;        // Track global state to only narrate shifts

  // Dedup: prevent same message within 30 seconds
  var _recentMessages = {};          // text → timestamp

  // ─── Voice synthesis abstraction ────────────────────────────────────────
  // This layer can be swapped out for premium TTS (ElevenLabs, etc.)

  var _voiceBackend = {
    type: 'browser',

    init: function () {
      if (typeof window.speechSynthesis === 'undefined') return false;
      _synth = window.speechSynthesis;
      // Pick a good voice once voices are loaded
      _pickVoice();
      if (_synth.onvoiceschanged !== undefined) {
        _synth.onvoiceschanged = _pickVoice;
      }
      return true;
    },

    speak: function (text, onEnd) {
      if (!_synth || _muted || _mode === 'silent') {
        if (onEnd) onEnd();
        return;
      }
      var utt = new SpeechSynthesisUtterance(text);
      utt.rate = 0.92;    // Slightly slow — calm, deliberate
      utt.pitch = 0.95;   // Slightly low — authoritative
      utt.volume = 0.7;   // Not loud — ambient
      if (_selectedVoice) utt.voice = _selectedVoice;
      utt.onend = function () {
        _speaking = false;
        _speakStartedAt = 0;
        if (onEnd) onEnd();
      };
      utt.onerror = function () {
        _speaking = false;
        _speakStartedAt = 0;
        if (onEnd) onEnd();
      };
      _speaking = true;
      _speakStartedAt = Date.now();
      _synth.speak(utt);
    },

    cancel: function () {
      if (_synth) _synth.cancel();
      _speaking = false;
    },

    isSpeaking: function () {
      // Safety timeout: if _speaking has been true for too long, reset it
      // (handles Chrome bug where onend/onerror never fires)
      if (_speaking && _speakStartedAt > 0 && (Date.now() - _speakStartedAt > SPEAK_TIMEOUT_MS)) {
        _speaking = false;
        _speakStartedAt = 0;
        if (_synth) _synth.cancel(); // Clear any stuck utterance
      }
      return _speaking || (_synth && _synth.speaking);
    }
  };

  function _pickVoice() {
    if (!_synth) return;
    var voices = _synth.getVoices();
    if (!voices || voices.length === 0) return;

    // Prefer English voices with natural/premium quality
    var preferred = ['Google UK English Female', 'Google US English', 'Samantha',
                     'Karen', 'Daniel', 'Microsoft Zira', 'Microsoft David'];
    for (var p = 0; p < preferred.length; p++) {
      for (var v = 0; v < voices.length; v++) {
        if (voices[v].name.indexOf(preferred[p]) !== -1) {
          _selectedVoice = voices[v];
          return;
        }
      }
    }
    // Fallback: first English voice
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].lang && voices[i].lang.indexOf('en') === 0) {
        _selectedVoice = voices[i];
        return;
      }
    }
    _selectedVoice = voices[0];
  }

  // ─── Narration generation ───────────────────────────────────────────────

  // Templates per mode
  var TEMPLATES = {
    analyst: {
      escalation_rise:     'Escalation rising. Multiple domains accelerating.',
      escalation_drop:     'Escalation easing. Immediate signals clearing.',
      domain_distress:     '{domain} domain pressure increasing.',
      // Infrastructure-specific distress voice — operational/engineering-grounded,
      // mirrors energy's per-diagnosis narration (energy-brain diagnosisIndex) but for
      // civil infrastructure: grid reliability, deferred maintenance, transport, funding, cyber-physical.
      infra_grid_degradation:    'Grid infrastructure under stress. Transmission and distribution reliability degrading.',
      infra_maintenance_deficit: 'Deferred maintenance accumulating. Asset condition deteriorating across the network.',
      infra_cyber_physical:      'Cyber-physical exposure rising. SCADA and control-system integrity at risk.',
      infra_transport_disruption:'Transport network strained. Roads, bridges, and transit capacity degrading.',
      infra_funding_collapse:    'Capital funding gap widening. Infrastructure investment falling behind need.',
      infra_generic:             'Infrastructure under stress. Public works and capital systems pressured.',
      global_shift:        'Global state shifted to {state}.',
      event_start:         '{event} detected.',
      event_end:           '{event} resolved.',
      feed_hydrated:       'Feeds online. System active.',
      feed_degradation:    'Feed reliability degraded. Falling back to inferred signals.',
      feed_recovery:       'Feed connectivity restored.',
      regulation_calm:     'User state: calm. System nominal.',
      regulation_focused:  'User state: focused.',
      regulation_pressured:'User state: pressured. Consider pacing.',
      regulation_overloaded:'User state: overloaded. Reducing information density.',
      regulation_recovering:'System stabilizing. Pressure is easing.'
    },
    command: {
      escalation_rise:     'Escalation. Multiple domains active. Review immediately.',
      escalation_drop:     'Escalation cleared. Resume monitoring.',
      domain_distress:     '{domain} elevated. Investigate.',
      infra_grid_degradation:    'Grid reliability degrading. Inspect transmission and distribution.',
      infra_maintenance_deficit: 'Maintenance backlog critical. Prioritize asset repair.',
      infra_cyber_physical:      'Cyber-physical threat. Harden SCADA and control systems.',
      infra_transport_disruption:'Transport disruption. Assess roads, bridges, transit.',
      infra_funding_collapse:    'Funding gap critical. Secure infrastructure capital.',
      infra_generic:             'Infrastructure elevated. Investigate public works.',
      global_shift:        'State change: {state}.',
      event_start:         'Event: {event}. Tracking.',
      event_end:           'Event cleared: {event}.',
      feed_hydrated:       'Feeds online. Monitoring.',
      feed_degradation:    'Feed degraded. Confidence reduced.',
      feed_recovery:       'Feeds restored.',
      regulation_calm:     'Operator nominal.',
      regulation_focused:  'Operator focused.',
      regulation_pressured:'Operator pressured. Manage load.',
      regulation_overloaded:'Operator overloaded. Reduce exposure.',
      regulation_recovering:'Operator recovering. Stabilizing.'
    }
  };

  function _template(key, vars) {
    var templates = TEMPLATES[_mode] || TEMPLATES.analyst;
    var text = templates[key];
    if (!text) return null;
    if (vars) {
      for (var k in vars) {
        text = text.replace('{' + k + '}', vars[k]);
      }
    }
    return text;
  }

  // ─── Narration queueing ─────────────────────────────────────────────────

  function _narrate(key, vars, priority) {
    if (_mode === 'silent') return;

    var text = _template(key, vars);
    if (!text) return;

    // Dedup check
    var now = Date.now();
    if (_recentMessages[text] && (now - _recentMessages[text]) < 30000) return;
    _recentMessages[text] = now;

    // Prune old dedup entries
    for (var msg in _recentMessages) {
      if (now - _recentMessages[msg] > 60000) delete _recentMessages[msg];
    }

    _queue.push({
      text: text,
      priority: priority || PRIORITY_MEDIUM,
      timestamp: now
    });

    // Sort by priority (high first), then by timestamp (oldest first)
    _queue.sort(function (a, b) {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.timestamp - b.timestamp;
    });

    // Enforce max queue
    while (_queue.length > MAX_QUEUE) _queue.pop();

    // Emit event for UI/logging
    _dispatch('limen:narrator-speak', { text: text, priority: priority, mode: _mode });
  }

  // ─── Queue processor ────────────────────────────────────────────────────

  function _processQueue() {
    if (_mode === 'silent' || _muted) return;
    if (_voiceBackend.isSpeaking()) return;
    if (_queue.length === 0) return;

    var now = Date.now();
    if (now - _lastSpokeAt < SPEAK_COOLDOWN_MS) return;

    var item = _queue.shift();
    if (!item) return;

    // Skip stale messages (older than 30 seconds)
    if (now - item.timestamp > 30000) {
      _processQueue(); // Try next
      return;
    }

    _lastSpokeAt = now;
    var _safeText = item.text;
    if (window.LIMENResponseSafety) _safeText = window.LIMENResponseSafety.sanitize(_safeText, 'narrator');
    _voiceBackend.speak(_safeText, function () {
      // After speaking, try next in queue
      setTimeout(_processQueue, 500);
    });
  }

  // ─── Event listeners ────────────────────────────────────────────────────

  function _onEscalationShift(e) {
    var detail = e.detail;
    if (!detail) return;
    if (detail.direction === 'escalating') {
      _narrate('escalation_rise', {}, PRIORITY_HIGH);
    } else if (detail.direction === 'deescalating') {
      _narrate('escalation_drop', {}, PRIORITY_MEDIUM);
    }
  }

  function _onDomainDistress(e) {
    var detail = e.detail;
    if (!detail || !detail.domain) return;
    var NAMES = {
      economy: 'Economy', energy: 'Energy', environment: 'Environment',
      health: 'Health', technology: 'Technology', research: 'Research',
      supplyChain: 'Supply chain', infrastructure: 'Infrastructure'
    };

    // Infrastructure parity: mirror energy's per-diagnosis voice. Energy distinguishes
    // OIL_SHOCK / GRID_COLLAPSE etc via its diagnosisIndex; here we classify the civil
    // distress flavor from the emitted signal content and narrate an infrastructure-
    // specific line instead of the generic '{domain} domain pressure increasing'.
    if (detail.domain === 'infrastructure') {
      var key = _classifyInfraDistress(detail.signals);
      if (key) {
        _narrate(key, {}, PRIORITY_MEDIUM);
        return;
      }
    }

    _narrate('domain_distress', { domain: NAMES[detail.domain] || detail.domain }, PRIORITY_MEDIUM);
  }

  // Map raw infrastructure signal content → a civil distress voice key.
  // Civil vocabulary mirrors infrastructure-brain diagnosisIndex (GRID_DEGRADATION /
  // MAINTENANCE_DEFICIT / CYBER_PHYSICAL_ATTACK / TRANSPORTATION_DISRUPTION /
  // INFRA_FUNDING_COLLAPSE). Translates energy oil/gas/nuclear content to civil
  // grid/transport/water/funding equivalents. Returns a TEMPLATES key, or null.
  function _classifyInfraDistress(signals) {
    var blob = '';
    if (Array.isArray(signals)) {
      for (var i = 0; i < signals.length; i++) {
        var s = signals[i];
        if (typeof s === 'string') blob += ' ' + s;
        else if (s && typeof s === 'object') {
          blob += ' ' + (s.type || '') + ' ' + (s.id || '') + ' ' + (s.label || '') + ' ' + (s.name || '');
        }
      }
    }
    blob = blob.toLowerCase();

    // Order by specificity: cyber-physical and funding are sharpest, then transport,
    // grid, maintenance; fall back to a generic infrastructure line.
    if (/cyber|scada|sabotage|control[\s_-]?system|ics\b/.test(blob)) return 'infra_cyber_physical';
    if (/fund|fiscal|budget|bond|capex|capital|grant/.test(blob))      return 'infra_funding_collapse';
    if (/bridge|road|transit|transport|port|congestion|last[\s_-]?mile|modal/.test(blob)) return 'infra_transport_disruption';
    if (/grid|transmission|distribution|substation|transformer|reserve[\s_-]?margin|utility|reliability/.test(blob)) return 'infra_grid_degradation';
    if (/maintenance|deferred|deterioration|inspection|asset[\s_-]?condition|aging|backlog/.test(blob)) return 'infra_maintenance_deficit';
    return 'infra_generic';
  }

  function _onGlobalStateUpdate(e) {
    var detail = e.detail;
    if (!detail || !detail.mode) return;
    // Only narrate when the mode actually changes, not on every 6s cycle
    if (detail.mode === _lastGlobalMode) return;
    _lastGlobalMode = detail.mode;
    _narrate('global_shift', { state: detail.mode }, PRIORITY_MEDIUM);
  }

  function _onEventAction(e) {
    var detail = e.detail;
    if (!detail || !detail.event) return;
    var evt = detail.event;
    var label = (evt.type || '').replace(/_/g, ' ');
    if (detail.action === 'start') {
      _narrate('event_start', { event: label }, PRIORITY_MEDIUM);
    } else if (detail.action === 'end') {
      _narrate('event_end', { event: label }, PRIORITY_LOW);
    }
  }

  function _onFeedStateChange(e) {
    var detail = e.detail;
    if (!detail) return;
    if (detail.to === 'degraded') {
      _narrate('feed_degradation', {}, PRIORITY_HIGH);
    } else if (detail.to === 'hydrated') {
      // Recovery from degraded OR initial hydration both trigger speech
      _narrate(detail.from === 'degraded' ? 'feed_recovery' : 'feed_hydrated', {}, PRIORITY_MEDIUM);
    }
  }

  function _onFeedHydrated(e) {
    // Primary trigger: feeds come online (fires once per page load)
    _narrate('feed_hydrated', {}, PRIORITY_MEDIUM);
  }

  function _onRegulationUpdate(e) {
    var detail = e.detail;
    if (!detail || !detail.state) return;
    var key = 'regulation_' + detail.state;
    // Only narrate meaningful transitions
    if (detail.state === 'unknown') return;
    _narrate(key, {}, PRIORITY_LOW);
  }

  // ─── Voice control UI ───────────────────────────────────────────────────

  function _ensureControl() {
    if (_controlEl) return;
    _controlEl = document.createElement('div');
    _controlEl.id = 'limen-voice-control';
    _controlEl.style.cssText = [
      'position:fixed',
      'bottom:4px',
      'right:12px',
      'font-family:"IBM Plex Mono",monospace',
      'font-size:0.38rem',
      'letter-spacing:1.2px',
      'z-index:9998',
      'pointer-events:auto',
      'display:flex',
      'gap:4px',
      'align-items:center'
    ].join(';');

    _renderControl();
    document.body.appendChild(_controlEl);
  }

  function _renderControl() {
    if (!_controlEl) return;

    var dim = 'rgba(201,169,78,0.35)';
    var active = 'rgba(201,169,78,0.7)';
    var btnBase = 'background:rgba(201,169,78,0.06);border:1px solid rgba(201,169,78,0.12);' +
      'color:{color};font-family:"IBM Plex Mono",monospace;font-size:0.36rem;' +
      'letter-spacing:1.2px;padding:2px 6px;cursor:pointer;border-radius:2px;' +
      'transition:background 0.2s,color 0.2s';

    var html = '';

    // Mute toggle
    var muteLabel = _muted ? 'MUTED' : 'VOICE';
    var muteColor = _muted ? 'rgba(232,84,84,0.6)' : dim;
    html += '<button id="limen-voice-mute" style="' + btnBase.replace('{color}', muteColor) + '">' + muteLabel + '</button>';

    // Mode buttons
    for (var i = 0; i < MODES.length; i++) {
      var m = MODES[i];
      var color = (m === _mode) ? active : dim;
      html += '<button class="limen-voice-mode" data-mode="' + m + '" style="' + btnBase.replace('{color}', color) + '">' + m.toUpperCase() + '</button>';
    }

    _controlEl.innerHTML = html;

    // Bind mute
    var muteBtn = document.getElementById('limen-voice-mute');
    if (muteBtn) {
      muteBtn.addEventListener('click', function () {
        _muted = !_muted;
        if (_muted) _voiceBackend.cancel();
        _renderControl();
      });
    }

    // Bind mode buttons
    var modeBtns = _controlEl.querySelectorAll('.limen-voice-mode');
    for (var b = 0; b < modeBtns.length; b++) {
      modeBtns[b].addEventListener('click', function () {
        var newMode = this.getAttribute('data-mode');
        if (MODES.indexOf(newMode) !== -1) {
          _mode = newMode;
          if (_mode === 'silent') _voiceBackend.cancel();
          _renderControl();
        }
      });
    }
  }

  // ─── Public API: mode and mute control ──────────────────────────────────

  function setMode(mode) {
    if (MODES.indexOf(mode) === -1) return;
    _mode = mode;
    if (_mode === 'silent') _voiceBackend.cancel();
    _renderControl();
  }

  function getMode() {
    return _mode;
  }

  function setMuted(muted) {
    _muted = !!muted;
    if (_muted) _voiceBackend.cancel();
    _renderControl();
  }

  function isMuted() {
    return _muted;
  }

  // Allow external modules to inject narration
  function speak(text, priority) {
    if (!text || _mode === 'silent') return;
    var prio = priority || PRIORITY_MEDIUM;
    var now = Date.now();
    if (_recentMessages[text] && (now - _recentMessages[text]) < 30000) return;
    _recentMessages[text] = now;
    _queue.push({ text: text, priority: prio, timestamp: now });
    _queue.sort(function (a, b) {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.timestamp - b.timestamp;
    });
    while (_queue.length > MAX_QUEUE) _queue.pop();
    _dispatch('limen:narrator-speak', { text: text, priority: prio, mode: _mode });
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  function start() {
    if (_interval) return;

    // Initialize voice backend
    _voiceBackend.init();

    // Create UI control
    _ensureControl();

    // Listen for system events
    window.addEventListener('limen:escalation-shift', _onEscalationShift);
    window.addEventListener('limen:domain-distress', _onDomainDistress);
    window.addEventListener('limen:global-state-update', _onGlobalStateUpdate);
    window.addEventListener('limen:event', _onEventAction);
    window.addEventListener('limen:feed-hydrated', _onFeedHydrated);
    window.addEventListener('limen:feed-state-change', _onFeedStateChange);
    window.addEventListener('limen:regulation-update', _onRegulationUpdate);

    // Catch up: if feeds already hydrated before we started listening,
    // queue the hydration narration now (bootstrap starts us last)
    var fs = window.LIMENFeedState;
    if (fs && typeof fs.isHydrated === 'function' && fs.isHydrated()) {
      _narrate('feed_hydrated', {}, PRIORITY_MEDIUM);
    }

    // Seed _lastGlobalMode from current state so we don't
    // narrate "shifted to stable" on the first routine update
    var gs = window.LIMENGlobalState;
    if (gs && gs.mode) {
      _lastGlobalMode = gs.mode;
    }

    // Process queue periodically
    _interval = setInterval(_processQueue, 1000);
  }

  function stop() {
    if (_interval) {
      clearInterval(_interval);
      _interval = null;
    }
    _voiceBackend.cancel();
    window.removeEventListener('limen:escalation-shift', _onEscalationShift);
    window.removeEventListener('limen:domain-distress', _onDomainDistress);
    window.removeEventListener('limen:global-state-update', _onGlobalStateUpdate);
    window.removeEventListener('limen:event', _onEventAction);
    window.removeEventListener('limen:feed-hydrated', _onFeedHydrated);
    window.removeEventListener('limen:feed-state-change', _onFeedStateChange);
    window.removeEventListener('limen:regulation-update', _onRegulationUpdate);
    if (_controlEl && _controlEl.parentNode) {
      _controlEl.parentNode.removeChild(_controlEl);
      _controlEl = null;
    }
  }

  // ─── Utilities ──────────────────────────────────────────────────────────

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  window.LIMENConsoleNarrator = {
    start: start,
    stop: stop,
    setMode: setMode,
    getMode: getMode,
    setMuted: setMuted,
    isMuted: isMuted,
    speak: speak,

    // For future TTS swap-in
    setVoiceBackend: function (backend) {
      if (backend && typeof backend.speak === 'function') {
        _voiceBackend.cancel();
        _voiceBackend = backend;
      }
    }
  };

})();
