/**
 * philemon-voice-guide.js
 * LIMEN HELIX — PHILEMON: Named Voice Guide
 *
 * PHILEMON is LIMEN's front-facing interpretive guide — a calm, wise,
 * elder-sounding presence that orients the user, explains the current view,
 * summarizes what matters, recommends next actions, and responds to
 * plain-language verbal commands.
 *
 * Character: calm, deliberate, measured. Old-man archetype — not robotic,
 * not alarmist. Speaks as if he has watched civilizations rise and fall
 * and finds it all deeply interesting.
 *
 * Voice target: lower register, slower cadence, high clarity.
 * TTS profile: rate 0.78, pitch 0.72, volume 0.75
 *
 * Integrates with:
 *   - LIMENConsoleNarrator (TTS backend)
 *   - LIMENCommandBar (command registration)
 *   - LIMENDomains, LIMENGlobalState, LIMENReports (data sources)
 *   - LIMENEventNarrator (coordinates narration priority)
 *
 * Exposes: window.LIMENPhilemon
 * Load order: after console-narrator.js, before limen-bootstrap.js
 */

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // Persona Configuration
  // ═══════════════════════════════════════════════════════════════════════════

  var PERSONA = {
    name: 'PHILEMON',
    role: 'Interpretive Guide',
    character: 'calm, wise, elder-sounding',
    description: 'A named voice presence that watches over the LIMEN system ' +
      'and speaks to the operator with patience and clarity.'
  };

  // Voice profile — old-man style: slower, lower, clear
  var VOICE_PROFILE = {
    rate: 0.78,       // Slower than default (0.92) — deliberate cadence
    pitch: 0.72,      // Lower than default (0.95) — gravelly, elder register
    volume: 0.75,     // Slightly above default (0.7) — present but not loud
    preferredVoices: [
      'Daniel',                   // macOS male — warm, older
      'Google UK English Male',   // Chrome — measured
      'Microsoft David',          // Windows — clear male
      'Google US English',        // Fallback — neutral
      'Alex',                     // macOS — clear
      'Microsoft Mark'            // Windows — secondary
    ]
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Tone Templates — Sample Lines for All States
  // ═══════════════════════════════════════════════════════════════════════════

  var GREETINGS = {
    stable: [
      'Good {timeOfDay}, Chris. The system is quiet. All domains are nominal.',
      '{timeOfDay}, Chris. LIMEN is at rest. No immediate concerns.',
      'Welcome back. The observatory is calm. A good time to explore.'
    ],
    elevated: [
      'Chris. Some tension across the domains today. Let me walk you through it.',
      '{timeOfDay}. Several signals are elevated. Nothing critical, but worth watching.',
      'Welcome. The system is under moderate pressure. I will highlight what matters.'
    ],
    stressed: [
      'Chris. We have active stress across multiple domains. I will keep this brief.',
      'Attention. The system is under significant pressure. Let me orient you.',
      '{timeOfDay}. High stress detected. I recommend we start with the most affected domain.'
    ],
    noData: [
      'Chris. I am here, but domain feeds have not arrived yet. Standby.',
      '{timeOfDay}. Feeds are still loading. I will speak again when I have something to report.',
      'Welcome. The system is initializing. Give it a moment.'
    ]
  };

  var NARRATIONS = {
    // Page-level orientation
    console: 'You are on the Civilization Console. Three columns: signals on the left, system core in the center, health diagnostics on the right.',
    connectome: 'You are viewing the Connectome. This is the neural map of civilization domains and their interconnections.',
    unknown: 'You are on a LIMEN page. I can describe what I see when you ask.',

    // State descriptions
    stable: 'The system is stable. Stress levels are within normal bounds across all domains.',
    pressured: 'The system is pressured. Multiple domains show elevated stress, but no single domain has crossed into critical territory.',
    fragmented: 'The system is fragmented. Domain signals are conflicting. Some are rising while others are falling. This inconsistency itself is a signal.',
    escalating: 'The system is escalating. Multiple domains are rising together, which suggests systemic rather than isolated stress.',
    adaptive: 'The system is adapting. Stress is present but stabilizing. Recovery mechanisms are engaging.',
    recovering: 'The system is recovering. Net stress is declining. The worst appears to be passing.',

    // Transitions
    escalation_rise: 'I am seeing escalation. Multiple signals have crossed their thresholds simultaneously. This deserves immediate attention.',
    escalation_drop: 'The escalation is easing. Signals are returning below their thresholds. We can resume normal observation.',
    domain_spike: '{domain} has spiked. Stress is at {stress} percent. {drivers}.',
    phase_shift: 'The system has shifted phase. We have moved from {from} to {to}. This changes the interpretive frame.',

    // No data / degraded
    feed_degraded: 'Feed reliability has degraded. I am working with incomplete information. Confidence is reduced.',
    feed_restored: 'Feeds are back online. Confidence is restored.',
    registry_empty: 'The treatment registry has not been populated yet. Recommendations will be limited until portal data is harvested.'
  };

  var RESPONSES = {
    'what am i looking at': function () { return _describeCurrentView(); },
    'why is this important': function () { return _explainImportance(); },
    'what should i do': function () { return _suggestNextAction(); },
    'what changed': function () { return _describeRecentChanges(); },
    'which domain is worst': function () { return _identifyWorstDomain(); },
    'summarize': function () { return _buildSummary(); },
    'tell me more': function () { return _elaborateLastTopic(); },
    'what is the trend': function () { return _describeTrend(); },
    'are there treatments': function () { return _describeTreatments(); },
    'go quiet': function () { _setActive(false); return 'Very well. I will be silent. Say "Philemon" to wake me.'; },
    'wake up': function () { _setActive(true); return _buildSummary(); },
    'help': function () {
      return 'You can ask me: what am I looking at, why is this important, ' +
        'what should I do, what changed, which domain is worst, summarize, ' +
        'tell me more, what is the trend, are there treatments, go quiet, or help.';
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════════════════════════════

  var _active = true;
  var _started = false;
  var _greetingDone = false;
  var _lastTopic = null;         // Track last narration topic for "tell me more"
  var _lastSpokenDomain = null;  // For elaboration
  var _originalVoice = null;     // Store narrator's original voice settings
  var _philemonVoice = null;     // Our selected voice
  var _uiEl = null;              // Small indicator element
  var _inputEl = null;           // Text input for commands
  var _startupTimer = null;

  // ── Alert deduplication state ──────────────────────────────────────────
  var COOLDOWN_MS = 120000;           // 120s default cooldown per alert signature
  var SEVERITY_TIERS = { critical: 4, high: 3, escalating: 3, moderate: 2, elevated: 2, low: 1, stable: 0 };
  var CONFIDENCE_CHANGE_THRESHOLD = 0.15;  // 15% change = material

  // Map: signatureKey → { domain, alertType, severity, diagnosis, timestamp, actionHash, tierNum }
  var _alertMemory = {};

  function _alertSignature(alertType, domain) {
    return alertType + '::' + (domain || '*');
  }

  function _simpleHash(str) {
    if (!str) return 0;
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return h;
  }

  /**
   * Gate check: should this alert be spoken?
   * Returns true if it should speak, false if suppressed.
   */
  function _shouldSpeak(alertType, domain, severity, diagnosis, actionHash, confidence) {
    var key = _alertSignature(alertType, domain);
    var now = Date.now();
    var prev = _alertMemory[key];
    var tierNum = SEVERITY_TIERS[severity] != null ? SEVERITY_TIERS[severity] : 1;

    if (!prev) {
      // First occurrence — always speak (edge-trigger: entering state)
      _alertMemory[key] = {
        domain: domain, alertType: alertType, severity: severity,
        diagnosis: diagnosis, timestamp: now, actionHash: actionHash,
        tierNum: tierNum, confidence: confidence || 0
      };
      return true;
    }

    var elapsed = now - prev.timestamp;

    // 1. Cooldown check
    if (elapsed < COOLDOWN_MS) {
      // Within cooldown — only speak if material change
      var materialChange = _hasMaterialChange(prev, severity, diagnosis, actionHash, confidence, tierNum);
      if (!materialChange) {
        console.log('[PHILEMON] suppressed: cooldown (' + Math.round(elapsed / 1000) + 's/' +
          Math.round(COOLDOWN_MS / 1000) + 's) — ' + key);
        return false;
      }
      console.log('[PHILEMON] cooldown override: material change detected — ' + key);
    }

    // 2. Same-state dedup: if severity/diagnosis/actions haven't changed, suppress
    if (elapsed >= COOLDOWN_MS) {
      var changed = _hasMaterialChange(prev, severity, diagnosis, actionHash, confidence, tierNum);
      if (!changed) {
        console.log('[PHILEMON] suppressed: no material change — ' + key);
        // Bump timestamp so we don't log this every cycle
        prev.timestamp = now;
        return false;
      }
    }

    // 3. Edge-trigger: only re-announce if escalation intensified
    if (alertType === 'escalation' || alertType === 'domain-distress') {
      if (tierNum <= prev.tierNum && diagnosis === prev.diagnosis) {
        // Same or lower tier, same diagnosis — suppress
        if (elapsed < COOLDOWN_MS) {
          console.log('[PHILEMON] suppressed: same/lower tier — ' + key);
          return false;
        }
      }
    }

    // Update memory
    _alertMemory[key] = {
      domain: domain, alertType: alertType, severity: severity,
      diagnosis: diagnosis, timestamp: now, actionHash: actionHash,
      tierNum: tierNum, confidence: confidence || 0
    };
    return true;
  }

  function _hasMaterialChange(prev, severity, diagnosis, actionHash, confidence, tierNum) {
    // Severity increased
    if (tierNum > prev.tierNum) return true;
    // Diagnosis changed
    if (diagnosis && diagnosis !== prev.diagnosis) return true;
    // Action set changed
    if (actionHash && actionHash !== prev.actionHash) return true;
    // Confidence changed significantly
    if (confidence != null && prev.confidence != null &&
        Math.abs(confidence - prev.confidence) >= CONFIDENCE_CHANGE_THRESHOLD) return true;
    return false;
  }

  /**
   * Check if a domain has de-escalated (crossed down from distressed to non-distressed).
   * Returns the previous severity if de-escalation occurred, null otherwise.
   */
  function _checkDeescalation(domain) {
    var key = _alertSignature('domain-distress', domain);
    var prev = _alertMemory[key];
    if (!prev) return null;
    // If previous was distressed (tier >= 2) and current stress is below threshold
    var domains = window.LIMENDomains || {};
    var d = domains[domain];
    if (!d) return null;
    var currentStress = d.stress || 0;
    if (prev.tierNum >= 2 && currentStress < 0.55) {
      // De-escalated — clear memory so future escalation is fresh
      delete _alertMemory[key];
      return prev.severity;
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Voice Management
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Override speechSynthesis utterance parameters for PHILEMON's voice.
   * We create a custom voice backend wrapper that applies our profile.
   */
  function _speak(text, priority) {
    if (!_active || !text) return;

    var narrator = window.LIMENConsoleNarrator;
    if (!narrator) {
      console.log('[PHILEMON] ' + text);
      return;
    }

    // If narrator is in silent mode, skip
    if (narrator.getMode && narrator.getMode() === 'silent') return;

    // Direct speech with PHILEMON voice profile
    var synth = window.speechSynthesis;
    if (!synth) {
      narrator.speak(text, priority || 2);
      return;
    }

    // Build utterance with PHILEMON's voice
    var utt = new SpeechSynthesisUtterance(text);
    utt.rate = VOICE_PROFILE.rate;
    utt.pitch = VOICE_PROFILE.pitch;
    utt.volume = VOICE_PROFILE.volume;

    // Pick PHILEMON's preferred voice
    if (!_philemonVoice) _pickPhilemonVoice();
    if (_philemonVoice) utt.voice = _philemonVoice;

    // Cancel any current speech before PHILEMON speaks
    synth.cancel();
    synth.speak(utt);

    // Dispatch event for UI/logging
    _dispatch('limen:philemon-speak', { text: text, priority: priority || 2 });
  }

  function _pickPhilemonVoice() {
    var synth = window.speechSynthesis;
    if (!synth) return;
    var voices = synth.getVoices();
    if (!voices || voices.length === 0) return;

    for (var p = 0; p < VOICE_PROFILE.preferredVoices.length; p++) {
      var target = VOICE_PROFILE.preferredVoices[p];
      for (var v = 0; v < voices.length; v++) {
        if (voices[v].name.indexOf(target) !== -1) {
          _philemonVoice = voices[v];
          return;
        }
      }
    }
    // Fallback: first English male voice, or first English voice
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].lang && voices[i].lang.indexOf('en') === 0) {
        _philemonVoice = voices[i];
        return;
      }
    }
    _philemonVoice = voices[0];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Startup Greeting
  // ═══════════════════════════════════════════════════════════════════════════

  function _deliverGreeting() {
    if (_greetingDone) return;
    _greetingDone = true;

    var state = _assessSystemState();
    var pool = GREETINGS[state] || GREETINGS.noData;
    var template = pool[Math.floor(Math.random() * pool.length)];
    var text = template.replace('{timeOfDay}', _getTimeOfDay());

    // Add top issue if stressed/elevated
    if (state === 'stressed' || state === 'elevated') {
      var worst = _findWorstDomain();
      if (worst) {
        text += ' ' + worst.label + ' is the most affected at ' +
          Math.round(worst.stress * 100) + ' percent stress.';
      }
    }

    // Add suggestion
    if (state !== 'noData') {
      var suggestion = _getStartupSuggestion(state);
      if (suggestion) text += ' ' + suggestion;
    }

    _speak(text, 3);
    _lastTopic = 'greeting';
  }

  function _getTimeOfDay() {
    var h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function _getStartupSuggestion(state) {
    if (state === 'stressed') return 'I suggest starting with the escalation panel on the left.';
    if (state === 'elevated') return 'Consider reviewing the domain repair map on the right.';
    if (state === 'stable') return 'A good time to run a report or explore the connectome.';
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // System State Assessment
  // ═══════════════════════════════════════════════════════════════════════════

  function _assessSystemState() {
    var domains = window.LIMENDomains;
    if (!domains || Object.keys(domains).length === 0) return 'noData';

    var gs = window.LIMENGlobalState;
    if (gs && gs.mode) {
      if (gs.mode === 'escalating') return 'stressed';
      if (gs.mode === 'pressured' || gs.mode === 'fragmented') return 'elevated';
      if (gs.mode === 'stable' || gs.mode === 'recovering' || gs.mode === 'adaptive') return 'stable';
    }

    // Fallback: check domain stress directly
    var dk = Object.keys(domains);
    var maxStress = 0;
    var elevatedCount = 0;
    for (var i = 0; i < dk.length; i++) {
      var s = domains[dk[i]].stress || 0;
      if (s > maxStress) maxStress = s;
      if (s > 0.4) elevatedCount++;
    }
    if (maxStress > 0.65 || elevatedCount >= 3) return 'stressed';
    if (maxStress > 0.4 || elevatedCount >= 1) return 'elevated';
    return 'stable';
  }

  function _findWorstDomain() {
    var domains = window.LIMENDomains;
    if (!domains) return null;
    var dk = Object.keys(domains);
    var worst = null;
    var worstStress = 0;
    var LABELS = {
      economy: 'Economy', energy: 'Energy', environment: 'Environment',
      health: 'Health', technology: 'Technology', research: 'Research',
      supplyChain: 'Supply Chain'
    };
    for (var i = 0; i < dk.length; i++) {
      var s = domains[dk[i]].stress || 0;
      if (s > worstStress) {
        worstStress = s;
        worst = { key: dk[i], label: LABELS[dk[i]] || dk[i], stress: s };
      }
    }
    return worst;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Page Narration
  // ═══════════════════════════════════════════════════════════════════════════

  function _describeCurrentView() {
    var page = _detectPage();
    var text = NARRATIONS[page] || NARRATIONS.unknown;

    // Add system state
    var state = _assessSystemState();
    if (state !== 'noData') {
      text += ' ' + (NARRATIONS[state] || '');
    }

    // Add domain count
    var domains = window.LIMENDomains;
    if (domains) {
      var dk = Object.keys(domains);
      var elevated = 0;
      for (var i = 0; i < dk.length; i++) {
        if ((domains[dk[i]].stress || 0) > 0.4) elevated++;
      }
      if (elevated > 0) {
        text += ' ' + elevated + ' of ' + dk.length + ' domains are showing elevated stress.';
      }
    }

    _lastTopic = 'view';
    return text;
  }

  function _explainImportance() {
    var state = _assessSystemState();
    var text;

    if (state === 'noData') {
      text = 'I cannot assess importance without domain data. Feeds may still be loading.';
    } else if (state === 'stressed') {
      var worst = _findWorstDomain();
      text = 'The system is under significant stress.';
      if (worst) {
        text += ' ' + worst.label + ' is the primary concern at ' +
          Math.round(worst.stress * 100) + ' percent.';
      }
      text += ' When multiple domains escalate together, the risk is systemic, not isolated. Cross-domain propagation becomes a real concern.';
    } else if (state === 'elevated') {
      text = 'Several signals are elevated, which means the system is not at rest but not yet in crisis. This is the phase where intervention is most effective — before stress compounds.';
    } else {
      text = 'The system is calm. This is valuable. Stability is not the absence of signals — it means the signals that are present are within expected bounds. A good time for exploratory analysis.';
    }

    _lastTopic = 'importance';
    return text;
  }

  function _suggestNextAction() {
    var state = _assessSystemState();
    var text;

    if (state === 'noData') {
      text = 'Wait for feeds to arrive. Once domain data loads, I will have better guidance.';
    } else if (state === 'stressed') {
      var worst = _findWorstDomain();
      text = 'I recommend focusing on the most stressed domain.';
      if (worst) {
        text += ' Open an investigation on ' + worst.label + '.';
        text += ' Check if the stress is driven by a single indicator or a cluster.';
      }
      text += ' You might also review the escalation panel for cross-domain patterns.';
    } else if (state === 'elevated') {
      text = 'Generate a report to see the full picture. Then review the domain repair map for recommended treatments. The command bar, Ctrl K, can help you navigate quickly.';
    } else {
      text = 'The system is calm. Consider running a report for a baseline snapshot. Or explore the connectome to understand domain interconnections. You could also review the treatment registry for standing recommendations.';
    }

    _lastTopic = 'action';
    return text;
  }

  function _describeRecentChanges() {
    var text = '';
    var gs = window.LIMENGlobalState;
    if (gs && gs.lastShift) {
      text += 'The most recent state shift was from ' + (gs.lastShift.from || 'unknown') +
        ' to ' + (gs.lastShift.to || 'unknown') + '. ';
    }

    var domains = window.LIMENDomains;
    if (domains) {
      var dk = Object.keys(domains);
      var rising = [];
      var falling = [];
      for (var i = 0; i < dk.length; i++) {
        var trend = domains[dk[i]].trend;
        if (trend > 0.03) rising.push(dk[i]);
        else if (trend < -0.03) falling.push(dk[i]);
      }
      if (rising.length > 0) text += 'Rising: ' + rising.join(', ') + '. ';
      if (falling.length > 0) text += 'Declining: ' + falling.join(', ') + '. ';
      if (rising.length === 0 && falling.length === 0) text += 'No significant trend movement detected. ';
    }

    if (!text) text = 'I do not have enough history to describe recent changes yet.';
    _lastTopic = 'changes';
    return text;
  }

  function _identifyWorstDomain() {
    var worst = _findWorstDomain();
    if (!worst) return 'I cannot identify the worst domain without data.';

    var domains = window.LIMENDomains;
    var d = domains[worst.key] || {};
    var text = worst.label + ' is the most stressed domain at ' +
      Math.round(worst.stress * 100) + ' percent.';

    // Add trend
    if (d.trend > 0.03) text += ' And it is still rising.';
    else if (d.trend < -0.03) text += ' But it appears to be declining.';
    else text += ' It is currently stable at this level.';

    // Add signals
    var signals = d.signals || [];
    if (signals.length > 0) {
      text += ' Primary signals: ';
      var sigTexts = [];
      for (var i = 0; i < Math.min(signals.length, 3); i++) {
        sigTexts.push(typeof signals[i] === 'string' ? signals[i] : (signals[i].type || signals[i].name || 'signal'));
      }
      text += sigTexts.join(', ') + '.';
    }

    _lastSpokenDomain = worst.key;
    _lastTopic = 'worst-domain';
    return text;
  }

  function _buildSummary() {
    var state = _assessSystemState();
    if (state === 'noData') return 'Feeds are not yet available. I cannot summarize.';

    var domains = window.LIMENDomains || {};
    var dk = Object.keys(domains);
    var stressValues = [];
    var elevated = [];
    for (var i = 0; i < dk.length; i++) {
      var s = domains[dk[i]].stress || 0;
      stressValues.push(s);
      if (s > 0.4) elevated.push(dk[i]);
    }

    var avg = 0;
    for (var j = 0; j < stressValues.length; j++) avg += stressValues[j];
    avg = stressValues.length > 0 ? avg / stressValues.length : 0;

    var text = 'System summary. ' + dk.length + ' domains active. Average stress: ' +
      Math.round(avg * 100) + ' percent. ';

    if (elevated.length === 0) {
      text += 'No domains above threshold. The system is at rest.';
    } else {
      text += elevated.length + ' domain' + (elevated.length > 1 ? 's' : '') +
        ' above threshold: ' + elevated.join(', ') + '.';
    }

    // Reports status
    var reports = window.LIMENReports;
    if (reports && Object.keys(reports).length > 0) {
      text += ' Reports are available with ' + Object.keys(reports).length + ' sections.';
    } else {
      text += ' No reports generated yet.';
    }

    _lastTopic = 'summary';
    return text;
  }

  function _elaborateLastTopic() {
    if (!_lastTopic) return 'I have not spoken about anything yet. Try asking me to summarize.';

    switch (_lastTopic) {
      case 'greeting':
        return _describeCurrentView();
      case 'view':
        return _explainImportance();
      case 'importance':
        return _suggestNextAction();
      case 'action':
        return _describeTreatments();
      case 'worst-domain':
        return _describeDomainDetail(_lastSpokenDomain);
      case 'summary':
        return _explainImportance();
      default:
        return _buildSummary();
    }
  }

  function _describeTrend() {
    var domains = window.LIMENDomains;
    if (!domains) return 'No domain data available for trend analysis.';

    var dk = Object.keys(domains);
    var text = 'Trend overview. ';
    var rising = [], falling = [], flat = [];

    for (var i = 0; i < dk.length; i++) {
      var t = domains[dk[i]].trend;
      if (t > 0.03) rising.push(dk[i]);
      else if (t < -0.03) falling.push(dk[i]);
      else flat.push(dk[i]);
    }

    if (rising.length > 0) text += 'Rising: ' + rising.join(', ') + '. ';
    if (falling.length > 0) text += 'Falling: ' + falling.join(', ') + '. ';
    if (flat.length > 0) text += 'Flat: ' + flat.join(', ') + '. ';

    if (rising.length > falling.length) text += 'Net direction is upward. Stress may increase.';
    else if (falling.length > rising.length) text += 'Net direction is downward. The system may be recovering.';
    else text += 'No dominant trend direction.';

    _lastTopic = 'trend';
    return text;
  }

  function _describeTreatments() {
    var mgr = window.LIMENRemedyRegistryManager;
    if (!mgr) return 'The treatment registry is not loaded. I cannot describe available treatments.';

    var stats = mgr.stats();
    if (stats.treatments === 0) {
      return 'The treatment registry is empty. Generate a report first to populate it with portal data.';
    }

    var text = 'The registry contains ' + stats.treatments + ' treatments across ' +
      stats.diagnoses + ' diagnoses. ';

    // Find treatments for worst domain
    var worst = _findWorstDomain();
    if (worst) {
      var txList = mgr.getTreatmentsOnDomainStress(worst.key, worst.stress);
      var domainStress = {};
      domainStress[worst.key] = worst.stress;
      var prioritized = mgr.prioritize(txList, { domainStress: domainStress });
      if (prioritized.length > 0) {
        text += 'For ' + worst.label + ', the top treatment is: ' + prioritized[0].title + '.';
        if (prioritized[0].steps && prioritized[0].steps.length > 0) {
          text += ' First step: ' + prioritized[0].steps[0].action + '.';
        }
      } else {
        text += 'No specific treatments found for ' + worst.label + ' at this stress level.';
      }
    }

    _lastTopic = 'treatments';
    return text;
  }

  function _describeDomainDetail(domainKey) {
    if (!domainKey) return _buildSummary();
    var domains = window.LIMENDomains;
    if (!domains || !domains[domainKey]) return 'I do not have data for that domain.';

    var d = domains[domainKey];
    var LABELS = {
      economy: 'Economy', energy: 'Energy', environment: 'Environment',
      health: 'Health', technology: 'Technology', research: 'Research',
      supplyChain: 'Supply Chain'
    };
    var label = LABELS[domainKey] || domainKey;
    var text = label + ' domain detail. Stress: ' + Math.round((d.stress || 0) * 100) + ' percent. ';
    text += 'Confidence: ' + Math.round((d.confidence || 0) * 100) + ' percent. ';

    if (d.trend > 0.03) text += 'Trend is rising. ';
    else if (d.trend < -0.03) text += 'Trend is declining. ';
    else text += 'Trend is flat. ';

    var signals = d.signals || [];
    if (signals.length > 0) {
      text += 'Active signals: ';
      for (var i = 0; i < Math.min(signals.length, 3); i++) {
        text += (typeof signals[i] === 'string' ? signals[i] : (signals[i].type || signals[i].name || 'signal'));
        if (i < Math.min(signals.length, 3) - 1) text += ', ';
      }
      text += '. ';
    }

    // Check for treatments
    var mgr = window.LIMENRemedyRegistryManager;
    if (mgr) {
      var dxList = mgr.getDiagnosesForDomain(domainKey);
      if (dxList.length > 0) {
        text += dxList.length + ' diagnoses registered. Most severe: ' + dxList[0].title + '.';
      }
    }

    _lastTopic = 'domain-detail';
    _lastSpokenDomain = domainKey;
    return text;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Plain-Language Command Processing
  // ═══════════════════════════════════════════════════════════════════════════

  function _processCommand(input) {
    if (!input) return null;
    var normalized = input.toLowerCase().trim()
      .replace(/[?.!,]/g, '')
      .replace(/\s+/g, ' ');

    // Exact match first
    if (RESPONSES[normalized]) {
      return RESPONSES[normalized]();
    }

    // Fuzzy match — find best overlap
    var bestMatch = null;
    var bestScore = 0;
    for (var key in RESPONSES) {
      if (!RESPONSES.hasOwnProperty(key)) continue;
      var score = _commandSimilarity(normalized, key);
      if (score > bestScore && score >= 0.6) {
        bestScore = score;
        bestMatch = key;
      }
    }

    if (bestMatch) {
      return RESPONSES[bestMatch]();
    }

    // Domain-specific queries
    var domainMatch = _matchDomainQuery(normalized);
    if (domainMatch) return domainMatch;

    return null;
  }

  function _commandSimilarity(input, target) {
    var inputWords = input.split(' ');
    var targetWords = target.split(' ');
    var matches = 0;
    for (var i = 0; i < targetWords.length; i++) {
      for (var j = 0; j < inputWords.length; j++) {
        if (inputWords[j] === targetWords[i] ||
            (inputWords[j].length > 3 && targetWords[i].indexOf(inputWords[j]) !== -1) ||
            (targetWords[i].length > 3 && inputWords[j].indexOf(targetWords[i]) !== -1)) {
          matches++;
          break;
        }
      }
    }
    return targetWords.length > 0 ? matches / targetWords.length : 0;
  }

  function _matchDomainQuery(input) {
    var DOMAIN_KEYWORDS = {
      economy: ['economy', 'economic', 'market', 'financial'],
      energy: ['energy', 'power', 'oil', 'fuel'],
      environment: ['environment', 'climate', 'ecological'],
      health: ['health', 'medical', 'clinical'],
      technology: ['technology', 'tech', 'digital'],
      research: ['research', 'science', 'scientific'],
      supplyChain: ['supply', 'logistics', 'chain', 'trade']
    };

    for (var dk in DOMAIN_KEYWORDS) {
      if (!DOMAIN_KEYWORDS.hasOwnProperty(dk)) continue;
      var kws = DOMAIN_KEYWORDS[dk];
      for (var i = 0; i < kws.length; i++) {
        if (input.indexOf(kws[i]) !== -1) {
          return _describeDomainDetail(dk);
        }
      }
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Event Listeners — Reactive Narration
  // ═══════════════════════════════════════════════════════════════════════════

  function _onGlobalStateUpdate(e) {
    if (!_active || !_greetingDone) return;
    var detail = e.detail;
    if (!detail || !detail.mode) return;

    // Determine severity tier from mode
    var severity = detail.mode; // 'escalating', 'pressured', 'stable', etc.

    // Only narrate escalation / phase-shift transitions
    if (detail.mode === 'escalating') {
      if (!_shouldSpeak('escalation', '*', severity, null, null, null)) return;
      _speak(NARRATIONS.escalation_rise, 3);
    } else if (detail.mode === 'recovering' || detail.mode === 'adaptive' || detail.mode === 'stable') {
      // Check if we were previously escalating — announce de-escalation once
      var escKey = _alertSignature('escalation', '*');
      var prevEsc = _alertMemory[escKey];
      if (prevEsc && prevEsc.tierNum >= 3) {
        if (_shouldSpeak('de-escalation', '*', severity, null, null, null)) {
          _speak(NARRATIONS.escalation_drop, 2);
        }
        delete _alertMemory[escKey]; // Clear so future escalation is fresh
      }
    }
  }

  function _onDomainDistress(e) {
    if (!_active || !_greetingDone) return;
    var detail = e.detail;
    if (!detail || !detail.domain) return;

    var LABELS = {
      economy: 'Economy', energy: 'Energy', environment: 'Environment',
      health: 'Health', technology: 'Technology', research: 'Research',
      supplyChain: 'Supply Chain', governance: 'Governance',
      infrastructure: 'Infrastructure', agriculture: 'Agriculture',
      industry: 'Industry', education: 'Education',
      communication: 'Communication', culture: 'Culture',
      defense: 'Defense', religion: 'Religion',
      population: 'Population', law: 'Law',
      finance: 'Finance', intelligence: 'Intelligence'
    };

    var stress = detail.stress || 0;
    if (stress < 0.6) return; // Only speak on significant distress

    // Determine severity from stress level
    var severity = stress > 0.85 ? 'critical' : (stress > 0.65 ? 'high' : 'elevated');

    // Build diagnosis string from detail if available
    var diagnosis = detail.diagnosis || detail.type || null;

    // Build action hash from signals
    var actionHash = null;
    if (detail.signals && detail.signals.length > 0) {
      actionHash = _simpleHash(detail.signals.slice(0, 3).join(','));
    }

    var confidence = detail.confidence || null;

    // Gate check
    if (!_shouldSpeak('domain-distress', detail.domain, severity, diagnosis, actionHash, confidence)) return;

    var drivers = '';
    if (detail.signals && detail.signals.length > 0) {
      drivers = 'Driven by ' + detail.signals.slice(0, 2).join(' and ');
    }

    var text = NARRATIONS.domain_spike
      .replace('{domain}', LABELS[detail.domain] || detail.domain)
      .replace('{stress}', Math.round(stress * 100))
      .replace('{drivers}', drivers);

    _speak(text, 2);
    _lastSpokenDomain = detail.domain;
    _lastTopic = 'domain-spike';
  }

  function _onDomainUpdate() {
    if (!_active || !_greetingDone) return;
    // Check for de-escalation across all domains
    var domains = window.LIMENDomains || {};
    var dk = Object.keys(domains);
    var LABELS = {
      economy: 'Economy', energy: 'Energy', environment: 'Environment',
      health: 'Health', technology: 'Technology', research: 'Research',
      supplyChain: 'Supply Chain', governance: 'Governance',
      infrastructure: 'Infrastructure', agriculture: 'Agriculture',
      industry: 'Industry', education: 'Education',
      communication: 'Communication', culture: 'Culture',
      defense: 'Defense', religion: 'Religion',
      population: 'Population', law: 'Law',
      finance: 'Finance', intelligence: 'Intelligence'
    };
    for (var i = 0; i < dk.length; i++) {
      var prevSev = _checkDeescalation(dk[i]);
      if (prevSev) {
        var label = LABELS[dk[i]] || dk[i];
        var currentStress = (domains[dk[i]].stress || 0) * 100;
        _speak(label + ' has de-escalated. Stress is now at ' +
          Math.round(currentStress) + ' percent. The pressure appears to be easing.', 2);
        _lastTopic = 'de-escalation';
        _lastSpokenDomain = dk[i];
        break; // Only one recovery notice per cycle
      }
    }
  }

  function _onFeedStateChange(e) {
    if (!_active || !_greetingDone) return;
    var detail = e.detail;
    if (!detail) return;

    if (detail.to === 'degraded') {
      if (!_shouldSpeak('feed-state', '*', 'degraded', null, null, null)) return;
      _speak(NARRATIONS.feed_degraded, 3);
    } else if (detail.to === 'hydrated' && detail.from === 'degraded') {
      if (!_shouldSpeak('feed-state', '*', 'restored', null, null, null)) return;
      _speak(NARRATIONS.feed_restored, 2);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UI — Minimal Indicator + Input
  // ═══════════════════════════════════════════════════════════════════════════

  function _ensureUI() {
    if (_uiEl) return;

    _uiEl = document.createElement('div');
    _uiEl.id = 'limen-philemon-indicator';
    _uiEl.style.cssText = [
      'position:fixed',
      'bottom:32px',
      'left:12px',
      'z-index:9997',
      'display:flex',
      'flex-direction:column',
      'gap:4px',
      'font-family:"IBM Plex Mono",monospace'
    ].join(';');

    // Name badge
    var badge = document.createElement('div');
    badge.id = 'philemon-badge';
    badge.style.cssText = [
      'font-size:0.38rem',
      'letter-spacing:2px',
      'text-transform:uppercase',
      'color:rgba(201,169,78,0.4)',
      'cursor:pointer',
      'padding:3px 8px',
      'border:1px solid rgba(201,169,78,0.1)',
      'border-radius:2px',
      'background:rgba(201,169,78,0.03)',
      'transition:all 0.3s'
    ].join(';');
    badge.textContent = 'PHILEMON';
    badge.title = 'Click to toggle voice guide';
    badge.addEventListener('click', function () {
      _toggleInput();
    });
    badge.addEventListener('mouseenter', function () {
      badge.style.borderColor = 'rgba(201,169,78,0.3)';
      badge.style.color = 'rgba(201,169,78,0.7)';
    });
    badge.addEventListener('mouseleave', function () {
      badge.style.borderColor = 'rgba(201,169,78,0.1)';
      badge.style.color = _active ? 'rgba(201,169,78,0.4)' : 'rgba(232,84,84,0.4)';
    });

    // Input field (hidden by default)
    _inputEl = document.createElement('input');
    _inputEl.id = 'philemon-input';
    _inputEl.type = 'text';
    _inputEl.placeholder = 'Ask Philemon...';
    _inputEl.style.cssText = [
      'display:none',
      'width:220px',
      'background:rgba(8,10,16,0.95)',
      'border:1px solid rgba(201,169,78,0.2)',
      'border-radius:2px',
      'color:rgba(200,195,184,0.8)',
      'font-family:"IBM Plex Mono",monospace',
      'font-size:0.48rem',
      'letter-spacing:0.5px',
      'padding:5px 8px',
      'outline:none',
      'caret-color:rgba(201,169,78,0.6)'
    ].join(';');

    _inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var text = _inputEl.value.trim();
        if (text) {
          _handleUserInput(text);
          _inputEl.value = '';
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        _inputEl.style.display = 'none';
        _inputEl.blur();
      }
      e.stopPropagation(); // Prevent command bar from catching keystrokes
    });

    _uiEl.appendChild(badge);
    _uiEl.appendChild(_inputEl);
    document.body.appendChild(_uiEl);
  }

  function _toggleInput() {
    if (!_inputEl) return;
    var visible = _inputEl.style.display !== 'none';
    _inputEl.style.display = visible ? 'none' : 'block';
    if (!visible) {
      requestAnimationFrame(function () {
        _inputEl.focus();
      });
    }
  }

  function _handleUserInput(text) {
    var response = _processCommand(text);
    if (response) {
      _speak(response, 3);
    } else {
      _speak('I am not sure how to answer that. Try asking: what am I looking at, or say help.', 1);
    }
  }

  function _updateBadge() {
    var badge = document.getElementById('philemon-badge');
    if (!badge) return;
    badge.style.color = _active ? 'rgba(201,169,78,0.4)' : 'rgba(232,84,84,0.4)';
    badge.textContent = _active ? 'PHILEMON' : 'PHILEMON [SILENT]';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Command Bar Integration
  // ═══════════════════════════════════════════════════════════════════════════

  function _registerCommands() {
    // We can't modify the command bar COMMANDS array directly since it's in
    // an IIFE, but we can add PHILEMON-specific keyboard shortcut
    document.addEventListener('keydown', function (e) {
      // Alt+P — toggle PHILEMON input
      if (e.altKey && e.key === 'p') {
        e.preventDefault();
        _toggleInput();
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Utility
  // ═══════════════════════════════════════════════════════════════════════════

  function _detectPage() {
    var pathname = window.location.pathname.replace(/^\//, '').replace(/\/$/, '');
    if (pathname === 'civilization.html' || pathname === 'civilization' || pathname === '') return 'console';
    if (pathname === 'connectome.html' || pathname === 'connectome') return 'connectome';
    return 'unknown';
  }

  function _setActive(active) {
    _active = !!active;
    _updateBadge();
    if (!_active && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════════════════════

  function start() {
    if (_started) return;
    _started = true;

    // Pick voice early
    _pickPhilemonVoice();
    if (window.speechSynthesis && window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = function () {
        _pickPhilemonVoice();
      };
    }

    // Build UI
    _ensureUI();
    _registerCommands();

    // Listen for system events
    window.addEventListener('limen:global-state-update', _onGlobalStateUpdate);
    window.addEventListener('limen:domain-distress', _onDomainDistress);
    window.addEventListener('limen:domain-update', _onDomainUpdate);
    window.addEventListener('limen:feed-state-change', _onFeedStateChange);

    // Deliver startup greeting after a brief delay (allow feeds to arrive)
    _startupTimer = setTimeout(function () {
      _deliverGreeting();
    }, 4000);

    // If feeds arrive early, greet sooner
    window.addEventListener('limen:feed-hydrated', function () {
      if (!_greetingDone) {
        clearTimeout(_startupTimer);
        setTimeout(_deliverGreeting, 1500);
      }
    });

    // Also listen for domain updates in case greeting hasn't fired
    window.addEventListener('limen:domain-update', function () {
      if (!_greetingDone) {
        clearTimeout(_startupTimer);
        setTimeout(_deliverGreeting, 2000);
      }
    });

    console.log('[PHILEMON] voice guide started');
  }

  function stop() {
    if (!_started) return;
    _started = false;
    if (_startupTimer) clearTimeout(_startupTimer);
    window.removeEventListener('limen:global-state-update', _onGlobalStateUpdate);
    window.removeEventListener('limen:domain-distress', _onDomainDistress);
    window.removeEventListener('limen:domain-update', _onDomainUpdate);
    window.removeEventListener('limen:feed-state-change', _onFeedStateChange);
    _alertMemory = {};
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (_uiEl && _uiEl.parentNode) _uiEl.parentNode.removeChild(_uiEl);
    _uiEl = null;
    _inputEl = null;
    console.log('[PHILEMON] voice guide stopped');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════════════════

  window.LIMENPhilemon = {
    start: start,
    stop: stop,

    // Direct speech
    speak: function (text, priority) { _speak(text, priority); },

    // Command processing
    ask: function (question) {
      var response = _processCommand(question);
      if (response) _speak(response, 3);
      return response;
    },

    // State
    isActive: function () { return _active; },
    setActive: function (active) { _setActive(active); },

    // Narration on demand
    greet: function () { _greetingDone = false; _deliverGreeting(); },
    describeView: function () { var t = _describeCurrentView(); _speak(t, 2); return t; },
    summarize: function () { var t = _buildSummary(); _speak(t, 2); return t; },

    // Voice config (read-only exposure)
    VOICE_PROFILE: VOICE_PROFILE,
    PERSONA: PERSONA
  };

})();
