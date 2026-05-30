/**
 * event-narrator.js
 * LIMEN HELIX — Event Narrator
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 * Transforms domain events and phase changes into human-readable
 * narrative prompts. Acts as the interface voice of LIMEN.
 *
 * Tone: calm, observational, exploratory. Not alarmist.
 *
 * Listens for: limen:domain-distress, limen:phase-change
 * Displays: floating narrator panel with exploration options
 * Emits: limen:user-action when user selects an option
 *
 * Load order: after domain-signal-engine.js, before action-suggester.js
 */

(function () {
  'use strict';

  // ─── Narrative templates ─────────────────────────────────────────────────

  var DOMAIN_NARRATIVES = {
    economy: {
      observation: 'Economy domain stress above threshold.',
      drivers: ['market volatility', 'indicator divergence', 'financial clustering'],
      options: [
        { label: 'investigate market dynamics', type: 'analysis' },
        { label: 'explore economic resilience research', type: 'discovery' },
        { label: 'monitor financial stress indicators', type: 'monitoring' },
        { label: 'analyze structural vulnerabilities', type: 'analysis' }
      ]
    },
    energy: {
      observation: 'Energy domain stress above threshold.',
      drivers: ['oil price fluctuation', 'supply tightening', 'infrastructure strain'],
      options: [
        { label: 'investigate energy markets', type: 'analysis' },
        { label: 'explore renewable transition', type: 'discovery' },
        { label: 'monitor supply chain impact', type: 'monitoring' },
        { label: 'analyze grid resilience', type: 'analysis' }
      ]
    },
    environment: {
      observation: 'Environment domain stress above threshold.',
      drivers: ['temperature anomalies', 'forest loss signals', 'ecological indicators'],
      options: [
        { label: 'explore environmental design innovation', type: 'discovery' },
        { label: 'investigate renewable energy transition', type: 'discovery' },
        { label: 'monitor climate mitigation research', type: 'monitoring' },
        { label: 'analyze ecological tipping indicators', type: 'analysis' }
      ]
    },
    health: {
      observation: 'Health domain signals above threshold.',
      drivers: ['clinical outcome variance', 'treatment efficacy shifts', 'research activity spike'],
      options: [
        { label: 'review emerging treatment research', type: 'discovery' },
        { label: 'investigate therapy technologies', type: 'discovery' },
        { label: 'scan clinical trial registries', type: 'monitoring' },
        { label: 'analyze outcome pattern changes', type: 'analysis' }
      ]
    },
    technology: {
      observation: 'Technology domain stress above threshold.',
      drivers: ['innovation cycle shift', 'adoption stress', 'infrastructure vulnerability'],
      options: [
        { label: 'explore emerging technology domains', type: 'discovery' },
        { label: 'investigate disruption patterns', type: 'analysis' },
        { label: 'monitor infrastructure resilience', type: 'monitoring' },
        { label: 'analyze adoption trajectories', type: 'analysis' }
      ]
    },
    research: {
      observation: 'Research domain signals above threshold.',
      drivers: ['publication rate shift', 'reproducibility concerns', 'funding pattern changes'],
      options: [
        { label: 'investigate research quality metrics', type: 'analysis' },
        { label: 'explore open science initiatives', type: 'discovery' },
        { label: 'monitor publication integrity', type: 'monitoring' },
        { label: 'analyze funding allocation patterns', type: 'analysis' }
      ]
    },
    supplyChain: {
      observation: 'Supply chain domain stress above threshold.',
      drivers: ['logistics delays', 'shortages emerging', 'distribution stress'],
      options: [
        { label: 'identify affected industries', type: 'analysis' },
        { label: 'map disruption clusters', type: 'analysis' },
        { label: 'monitor recovery indicators', type: 'monitoring' },
        { label: 'detect innovation gaps', type: 'discovery' }
      ]
    }
  };

  // Phase change narratives
  var PHASE_NARRATIVES = {
    P1: 'Phase shift: P1 (Salience). Disruption-detection circuits elevated.',
    P3: 'Phase shift: P3 (Threat). Threat-processing activation detected.',
    P4: 'Phase shift: P4 (Executive). Regulatory control circuits dominant.',
    P5: 'Phase shift: P5 (Motor). Action-readiness pathways active.',
    P6: 'Phase shift: P6 (Thalamic). Sensory integration circuits dominant.',
    P7: 'Phase shift: P7 (Neuroendocrine). Hormonal regulation pathways active.',
    P9: 'Phase shift: P9 (Integration). Cross-network coherence elevated.',
    P10: 'Phase shift: P10 (Cerebellar). Coordination and timing circuits active.'
  };

  // ─── State ───────────────────────────────────────────────────────────────

  var messageQueue = [];
  var MAX_QUEUE = 5;
  var currentMessage = null;
  var dismissTimer = null;
  var DISMISS_DELAY = 15000;

  // ─── Message generation ──────────────────────────────────────────────────

  function _generateDomainMessage(detail) {
    var domain = detail.domain;
    var narrative = DOMAIN_NARRATIVES[domain];
    if (!narrative) return null;

    // Pick relevant drivers from actual signals
    var drivers = detail.signals && detail.signals.length > 0
      ? detail.signals.slice(0, 3)
      : narrative.drivers.slice(0, 2);

    // Pick 3 options
    var options = narrative.options.slice(0, 3);

    return {
      type: 'domain-distress',
      domain: domain,
      title: 'LIMEN OBSERVATION',
      body: narrative.observation,
      drivers: drivers,
      options: options,
      stress: detail.stress,
      timestamp: Date.now()
    };
  }

  // Global state shift narratives
  var STATE_NARRATIVES = {
    stable: 'System conditions are nominal. No significant stress detected across domains.',
    pressured: 'Multiple domains are showing elevated stress. The system is under pressure.',
    fragmented: 'Domain signals are conflicting. The system is in a fragmented state.',
    escalating: 'Multiple domains are rising together. Systemic stress is accelerating.',
    adaptive: 'Stress is present but stabilizing. The system is adapting.',
    recovering: 'Net stress is falling. The system appears to be recovering.'
  };

  function _generatePhaseMessage(detail) {
    // Handle global state shifts
    if (detail.type === 'global-state') {
      var stateText = STATE_NARRATIVES[detail.to] || ('Global state shifted to ' + detail.to + '.');
      var body = 'Global state shifted from ' + detail.from + ' to ' + detail.to + '.';
      var drivers = detail.topDrivers || [];
      return {
        type: 'global-state-shift',
        domain: null,
        title: 'LIMEN OBSERVATION',
        body: body,
        drivers: drivers,
        options: [],
        stress: detail.score || 0,
        timestamp: Date.now()
      };
    }

    // Handle self-health alerts
    if (detail.type === 'self-health') {
      var healthDrivers = detail.topDrivers || [];
      return {
        type: 'self-health',
        domain: null,
        title: 'LIMEN OBSERVATION',
        body: 'Internal monitoring detected degraded system health.',
        drivers: healthDrivers,
        options: [],
        stress: 0,
        timestamp: Date.now()
      };
    }

    // Handle escalation shifts
    if (detail.type === 'escalation') {
      var escDrivers = detail.topDrivers || [];
      var escOptions = detail.options || [];
      return {
        type: 'escalation',
        domain: null,
        title: 'LIMEN OBSERVATION',
        body: 'Escalation detected. Multiple signals have crossed the immediate threshold.',
        drivers: escDrivers,
        options: escOptions,
        stress: 0,
        timestamp: Date.now()
      };
    }

    // Handle system events from event engine
    if (detail.type === 'system-event') {
      var evtDrivers = detail.topDrivers || [];
      var evtOptions = detail.options || [];
      var evtBody = detail.body || 'A system event has been detected.';
      // Add temporal context from timeline
      var timeline = window.LIMENTimeline;
      if (timeline && typeof timeline.getEventDuration === 'function' && detail.eventType) {
        var dur = timeline.getEventDuration(detail.eventType);
        if (dur && dur > 120000) {
          evtBody += '\nThis event has persisted for ' + _durationText(dur) + '.';
        }
      }
      // Add investigation checks as drivers if available
      var invActive = (window.LIMENInvestigations && window.LIMENInvestigations.active) || [];
      for (var iv = 0; iv < invActive.length; iv++) {
        if (invActive[iv].eventType === detail.eventType) {
          var checks = invActive[iv].suggestedChecks || [];
          if (checks.length > 0) {
            evtDrivers = [];
            evtDrivers.push('Suggested next checks:');
            for (var ck = 0; ck < Math.min(checks.length, 3); ck++) {
              evtDrivers.push(checks[ck]);
            }
          }
          // Add inspect option
          evtOptions = [
            { label: 'inspect event', type: 'analysis' },
            { label: 'trace affected domains', type: 'analysis' },
            { label: 'hold', type: 'monitoring' }
          ];
          break;
        }
      }
      return {
        type: 'system-event',
        domain: null,
        title: 'LIMEN OBSERVATION',
        body: evtBody,
        drivers: evtDrivers,
        options: evtOptions,
        stress: 0,
        timestamp: Date.now()
      };
    }

    // Handle decision memory concentration
    if (detail.type === 'decision-memory') {
      var dmDrivers = detail.topDrivers || [];
      var dmOptions = detail.options || [];
      return {
        type: 'decision-memory',
        domain: null,
        title: 'LIMEN OBSERVATION',
        body: detail.body || 'Repeated observation posture detected.',
        drivers: dmDrivers,
        options: dmOptions,
        stress: 0,
        timestamp: Date.now()
      };
    }

    // Handle self-repair attempts
    if (detail.type === 'self-repair') {
      return {
        type: 'self-repair',
        domain: null,
        title: 'LIMEN OBSERVATION',
        body: 'A bounded recovery attempt is underway.',
        drivers: [
          'issue: ' + (detail.target || 'unknown'),
          'action: ' + (detail.action || 'retry')
        ],
        options: [],
        stress: 0,
        timestamp: Date.now()
      };
    }

    // Handle regular phase changes
    var phase = detail.to;
    var text = PHASE_NARRATIVES[phase];
    if (!text) return null;

    return {
      type: 'phase-change',
      domain: null,
      title: 'PHASE SHIFT',
      body: text,
      drivers: [],
      options: [],
      stress: 0,
      timestamp: Date.now()
    };
  }

  // ─── Event listeners ────────────────────────────────────────────────────

  function _onDomainDistress(e) {
    var msg = _generateDomainMessage(e.detail);
    if (msg) _enqueue(msg);
  }

  function _onPhaseChange(e) {
    var msg = _generatePhaseMessage(e.detail);
    if (msg) _enqueue(msg);
  }

  function _enqueue(msg) {
    // Deduplicate: don't queue same domain within 30 seconds
    for (var i = 0; i < messageQueue.length; i++) {
      if (messageQueue[i].domain === msg.domain &&
          msg.timestamp - messageQueue[i].timestamp < 30000) {
        return;
      }
    }
    if (currentMessage && currentMessage.domain === msg.domain &&
        msg.timestamp - currentMessage.timestamp < 30000) {
      return;
    }

    messageQueue.push(msg);
    if (messageQueue.length > MAX_QUEUE) {
      messageQueue.shift();
    }

    // Show immediately if nothing visible
    if (!currentMessage) {
      _showNext();
    }
  }

  // ─── UI panel ────────────────────────────────────────────────────────────

  var panelEl = null;

  function _ensurePanel() {
    if (panelEl) return;
    panelEl = document.createElement('div');
    panelEl.id = 'limen-narrator-panel';
    panelEl.style.cssText = [
      'position:fixed',
      'bottom:60px',
      'left:50%',
      'transform:translateX(-50%) translateY(20px)',
      'background:rgba(8,9,12,0.93)',
      'border:1px solid rgba(201,169,78,0.25)',
      'padding:16px 20px',
      'font-family:"IBM Plex Mono",monospace',
      'font-size:0.50rem',
      'letter-spacing:1.2px',
      'z-index:9999',
      'border-radius:3px',
      'box-shadow:0 4px 20px rgba(0,0,0,0.6)',
      'line-height:1.7',
      'min-width:280px',
      'max-width:400px',
      'display:none',
      'opacity:0',
      'transition:opacity 0.4s ease, transform 0.4s ease'
    ].join(';');
    document.body.appendChild(panelEl);
  }

  function _showNext() {
    if (messageQueue.length === 0) {
      currentMessage = null;
      return;
    }

    // Check panel state manager before showing
    var ps = window.LIMENPanelState;
    if (ps && typeof ps.shouldAutoOpen === 'function') {
      var msg = messageQueue[0];
      var eventKey = (msg.type || '') + ':' + (msg.domain || '') + ':' + Math.floor(msg.timestamp / 30000);
      if (!ps.shouldAutoOpen('limen-narrator-panel', eventKey)) {
        // Still consume the message so queue doesn't stall
        messageQueue.shift();
        currentMessage = null;
        // Try next message after brief pause
        if (messageQueue.length > 0) {
          setTimeout(_showNext, 500);
        }
        return;
      }
    }

    currentMessage = messageQueue.shift();
    _renderMessage(currentMessage);
  }

  function _renderMessage(msg) {
    _ensurePanel();

    var gold = '#c9a94e';
    var teal = '#5ab5a0';
    var dim = 'rgba(201,169,78,0.5)';
    var textColor = 'rgba(200,195,184,0.75)';

    var html = '';

    // Title
    html += '<div style="color:' + gold + ';font-size:0.55rem;letter-spacing:2px;margin-bottom:8px">' + msg.title + '</div>';

    // Body (safety-filtered)
    var _safeBody = msg.body;
    if (window.LIMENResponseSafety) _safeBody = window.LIMENResponseSafety.sanitize(_safeBody, 'event_narrator');
    html += '<div style="color:' + textColor + ';margin-bottom:8px">' + _escHtml(_safeBody) + '</div>';

    // Drivers with source transparency
    if (msg.drivers.length > 0) {
      html += '<div style="color:' + dim + ';margin-bottom:6px">Drivers detected:</div>';
      var domainSources = _getSourcesForDomain(msg.domain);
      for (var i = 0; i < msg.drivers.length; i++) {
        html += '<div style="color:' + textColor + ';padding-left:8px">\u2022 ' + _escHtml(msg.drivers[i]) + '</div>';
        // Append source attribution for this driver
        var srcInfo = _matchDriverSource(msg.drivers[i], domainSources);
        if (srcInfo) {
          var srcStatusTag = srcInfo.live ? 'LIVE' : 'FALLBACK';
          var srcStatusColor = srcInfo.live ? '#5ab5a0' : '#e85454';
          html += '<div style="color:rgba(200,195,184,0.3);padding-left:16px;font-size:0.42rem">';
          html += 'source: ' + _escHtml(srcInfo.name);
          html += ' \u2014 <span style="color:' + srcStatusColor + '">' + srcStatusTag + '</span>';
          html += ' \u2014 ' + _escHtml(srcInfo.freshness);
          html += '</div>';
        }
      }
    }

    // Options
    if (msg.options.length > 0) {
      html += '<div style="color:' + dim + ';margin-top:10px;margin-bottom:6px">Explore options:</div>';
      for (var j = 0; j < msg.options.length; j++) {
        var opt = msg.options[j];
        html += '<button class="narrator-option" data-action="' + _escHtml(opt.label) + '" data-domain="' + _escHtml(msg.domain || '') + '" data-type="' + _escHtml(opt.type) + '" style="' +
          'display:block;width:100%;text-align:left;background:rgba(201,169,78,0.06);' +
          'border:1px solid rgba(201,169,78,0.15);color:' + teal + ';' +
          'font-family:IBM Plex Mono,monospace;font-size:0.48rem;letter-spacing:1.2px;' +
          'padding:5px 10px;margin:3px 0;cursor:pointer;border-radius:2px;' +
          'transition:background 0.2s,border-color 0.2s' +
          '">[ ' + _escHtml(opt.label) + ' ]</button>';
      }

      // Dismiss button
      html += '<button class="narrator-dismiss" style="' +
        'display:block;width:100%;text-align:center;background:none;' +
        'border:1px solid rgba(200,195,184,0.1);color:rgba(200,195,184,0.3);' +
        'font-family:IBM Plex Mono,monospace;font-size:0.45rem;letter-spacing:1.5px;' +
        'padding:4px 10px;margin:6px 0 0;cursor:pointer;border-radius:2px' +
        '">[ dismiss ]</button>';
    }

    panelEl.innerHTML = html;

    // Gate visibility behind panel state manager
    if (window.LIMENPanelState && !window.LIMENPanelState.isVisible('limen-narrator-panel')) {
      return;
    }

    panelEl.style.display = 'block';
    panelEl.style.pointerEvents = 'auto';

    // Animate in
    requestAnimationFrame(function () {
      panelEl.style.opacity = '1';
      panelEl.style.transform = 'translateX(-50%) translateY(0)';
    });

    // Attach click handlers
    var buttons = panelEl.querySelectorAll('.narrator-option');
    for (var b = 0; b < buttons.length; b++) {
      buttons[b].addEventListener('click', _onOptionClick);
      buttons[b].addEventListener('mouseenter', function () {
        this.style.background = 'rgba(201,169,78,0.12)';
        this.style.borderColor = 'rgba(201,169,78,0.3)';
      });
      buttons[b].addEventListener('mouseleave', function () {
        this.style.background = 'rgba(201,169,78,0.06)';
        this.style.borderColor = 'rgba(201,169,78,0.15)';
      });
    }

    var dismissBtn = panelEl.querySelector('.narrator-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', _dismiss);
    }

    // Auto-dismiss
    if (dismissTimer) clearTimeout(dismissTimer);
    dismissTimer = setTimeout(_dismiss, DISMISS_DELAY);
  }

  function _onOptionClick(e) {
    var btn = e.currentTarget;
    var action = btn.getAttribute('data-action');
    var domain = btn.getAttribute('data-domain');
    var type = btn.getAttribute('data-type');

    _dispatch('limen:user-action', {
      action: action,
      domain: domain,
      type: type,
      timestamp: Date.now()
    });

    _dismiss();
  }

  function _dismiss() {
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }

    // Snooze through panel state manager
    if (window.LIMENPanelState && typeof window.LIMENPanelState.snooze === 'function') {
      window.LIMENPanelState.snooze('limen-narrator-panel', 60000);
    }

    if (panelEl) {
      panelEl.style.opacity = '0';
      panelEl.style.transform = 'translateX(-50%) translateY(20px)';
      setTimeout(function () {
        panelEl.style.display = 'none';
        panelEl.style.pointerEvents = 'none';
        currentMessage = null;
        // Show next queued message after brief pause
        setTimeout(_showNext, 1000);
      }, 400);
    }
  }

  // ─── Balance shift narrator ──────────────────────────────────────────────

  var DISPLAY_NAMES = {
    economy: 'Economy', energy: 'Energy', environment: 'Environment',
    health: 'Health', technology: 'Technology', research: 'Research',
    supplyChain: 'Supply chain'
  };

  function _onBalanceShift(e) {
    var detail = e.detail;
    if (!detail || !detail.domain) return;

    var domName = DISPLAY_NAMES[detail.domain] || detail.domain;
    var domains = window.LIMENDomains || {};
    var d = domains[detail.domain] || {};
    var signals = d.signals || [];

    var body, drivers;

    if (detail.to === 'improving') {
      body = domName + ' domain remains elevated,\nbut stabilizing signals are emerging.';
      drivers = [];
      for (var i = 0; i < signals.length && drivers.length < 2; i++) {
        drivers.push(signals[i]);
      }
      drivers.push('balance improving (net ' + (detail.net > 0 ? '+' : '') + detail.net.toFixed(2) + ')');
    } else if (detail.to === 'destabilizing') {
      body = domName + ' domain is destabilizing.\nPressure is building without offsetting recovery.';
      drivers = [];
      for (var j = 0; j < signals.length && drivers.length < 2; j++) {
        drivers.push(signals[j]);
      }
      drivers.push('balance worsening (net ' + detail.net.toFixed(2) + ')');
    } else {
      return; // don't narrate neutral transitions
    }

    var msg = {
      type: 'balance-shift',
      domain: detail.domain,
      title: 'LIMEN OBSERVATION',
      body: body,
      drivers: drivers,
      options: [],
      stress: d.stress || 0,
      timestamp: Date.now()
    };

    _enqueue(msg);
  }

  // ─── Report polarity narrator ────────────────────────────────────────────

  function _onReportPolarity(e) {
    var detail = e.detail;
    if (!detail || !detail.domain) return;
    // Only narrate strong polarity signals
    if (detail.polarity === 'mixed' || detail.polarity === 'uncertain') return;
    if (detail.confidence < 0.5) return;

    var domName = DISPLAY_NAMES[detail.domain] || detail.domain;
    var body, drivers;

    if (detail.polarity === 'negative') {
      body = 'Negative reporting pressure increasing in ' + domName + '.';
      drivers = (detail.drivers && detail.drivers.length > 0) ? detail.drivers : ['signal tone worsening'];
    } else {
      body = 'Positive signal cluster emerging in ' + domName + '.';
      drivers = (detail.drivers && detail.drivers.length > 0) ? detail.drivers : ['signal tone improving'];
    }

    var msg = {
      type: 'report-polarity',
      domain: detail.domain,
      title: 'LIMEN OBSERVATION',
      body: body,
      drivers: drivers,
      options: [],
      stress: 0,
      timestamp: Date.now()
    };

    _enqueue(msg);
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  function start() {
    window.addEventListener('limen:domain-distress', _onDomainDistress);
    window.addEventListener('limen:phase-change', _onPhaseChange);
    window.addEventListener('limen:opportunity-detected', _onOpportunityDetected);
    window.addEventListener('limen:balance-shift', _onBalanceShift);
    window.addEventListener('limen:report-polarity', _onReportPolarity);
  }

  function stop() {
    window.removeEventListener('limen:domain-distress', _onDomainDistress);
    window.removeEventListener('limen:phase-change', _onPhaseChange);
    window.removeEventListener('limen:opportunity-detected', _onOpportunityDetected);
    window.removeEventListener('limen:balance-shift', _onBalanceShift);
    window.removeEventListener('limen:report-polarity', _onReportPolarity);
    if (dismissTimer) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
    messageQueue = [];
    currentMessage = null;
    if (panelEl) panelEl.style.display = 'none';
  }

  // ─── Utilities ───────────────────────────────────────────────────────────

  function _durationText(ms) {
    if (ms < 60000) return Math.round(ms / 1000) + ' seconds';
    if (ms < 3600000) return Math.floor(ms / 60000) + ' minutes';
    var h = Math.floor(ms / 3600000);
    var m = Math.floor((ms % 3600000) / 60000);
    return h + ' hour' + (h > 1 ? 's' : '') + (m > 0 ? ' ' + m + ' minutes' : '');
  }

  function _escHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Source transparency helpers ─────────────────────────────────────────

  function _getSourcesForDomain(domainKey) {
    if (!domainKey) return [];
    var doms = window.LIMENDomains || {};
    var d = doms[domainKey];
    if (!d || !d.sources) return [];
    return d.sources;
  }

  function _freshness(ts) {
    if (!ts) return 'unknown';
    var age = Date.now() - ts;
    if (age < 60000) return 'just now';
    if (age < 3600000) return Math.floor(age / 60000) + 'm ago';
    if (age < 86400000) return Math.floor(age / 3600000) + 'h ago';
    return Math.floor(age / 86400000) + 'd ago';
  }

  function _matchDriverSource(driverText, sources) {
    if (!sources || sources.length === 0) return null;
    var lower = driverText.toLowerCase();
    // Try to match driver text to a source by keyword overlap
    for (var i = 0; i < sources.length; i++) {
      var srcName = (sources[i].name || '').toLowerCase();
      var srcLabel = (sources[i].label || '').toLowerCase();
      // Check if source name words appear in driver or driver words appear in label
      if (_wordOverlap(lower, srcName) || _wordOverlap(lower, srcLabel)) {
        return {
          name: sources[i].name,
          live: sources[i].live,
          freshness: _freshness(sources[i].updated)
        };
      }
    }
    // Default: attribute to first live source, or first source
    for (var j = 0; j < sources.length; j++) {
      if (sources[j].live) {
        return { name: sources[j].name, live: true, freshness: _freshness(sources[j].updated) };
      }
    }
    return { name: sources[0].name, live: sources[0].live, freshness: _freshness(sources[0].updated) };
  }

  function _wordOverlap(a, b) {
    if (!a || !b) return false;
    var wordsA = a.split(/\s+/);
    for (var i = 0; i < wordsA.length; i++) {
      if (wordsA[i].length > 3 && b.indexOf(wordsA[i]) !== -1) return true;
    }
    return false;
  }

  // ─── Cross-domain opportunity narrator ───────────────────────────────────

  function _onOpportunityDetected(e) {
    var detail = e.detail;
    if (!detail || !detail.domains || detail.domains.length < 2) return;

    var domainA = detail.domains[0];
    var domainB = detail.domains[1];
    var sig = detail.signal || {};

    // Use pattern name if available
    var patternName = sig.pattern || 'correlated stress';

    var body = 'A cross-domain pattern is emerging.\n\n' +
      domainA + ' stress and ' + domainB + ' stress are rising together.\n\n' +
      'Possible interpretation:\n' + patternName + '.';

    // Use signal drivers if available, otherwise fall back
    var drivers = (sig.drivers && sig.drivers.length > 0)
      ? sig.drivers
      : [domainA + ' elevated', domainB + ' elevated'];

    // Use signal options if available
    var options = [];
    if (sig.options && sig.options.length > 0) {
      for (var o = 0; o < sig.options.length; o++) {
        options.push({ label: sig.options[o].label, type: sig.options[o].type });
      }
    } else {
      options.push({ label: 'Investigate correlated stress patterns', type: 'analysis' });
      options.push({ label: 'Explore cross-domain research', type: 'discovery' });
      options.push({ label: 'hold', type: 'monitoring' });
    }

    var msg = {
      type: 'cross-domain',
      domain: domainA + '+' + domainB,
      title: 'LIMEN OBSERVATION',
      body: body,
      drivers: drivers,
      options: options,
      stress: sig.severity || detail.confidence || 0,
      timestamp: Date.now()
    };

    _enqueue(msg);
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  window.LIMENEventNarrator = {
    start: start,
    stop: stop,
    dismiss: _dismiss,

    // Read-only accessor for Civilization Event Rail narration merge
    // (Phase 2 step 2 — Narrator Panel → Event Rail rows).
    // Returns the static per-domain observation line if defined, else null.
    // Additive only — no behavior change to narrator panel rendering.
    getObservationFor: function (domain) {
      if (!domain) return null;
      var entry = DOMAIN_NARRATIVES[domain];
      return entry && entry.observation ? entry.observation : null;
    }
  };

})();
