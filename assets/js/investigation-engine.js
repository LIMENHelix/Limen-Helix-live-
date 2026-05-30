/**
 * investigation-engine.js
 * LIMEN HELIX — Investigation Engine
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 * Generates guided investigation paths for active events and anomalies.
 * Suggests next checks, related signals, and focus paths based on
 * event type, domain state, balance, timeline persistence, and user history.
 *
 * Depends on: window.LIMENEvents, window.LIMENDomains, window.LIMENBalance,
 *             window.LIMENGlobalState, window.LIMENTimeline,
 *             window.LIMENDecisionMemory, window.LIMENSourceAudit
 * Listens: limen:event, limen:domain-update
 * Emits: limen:investigation-update
 * Output: window.LIMENInvestigations
 *
 * Load order: after event-engine.js, timeline-engine.js
 */

(function () {
  'use strict';

  var UPDATE_MS = 10000;
  var MAX_INVESTIGATIONS = 6;

  // ─── Investigation templates per event type ─────────────────────────────

  var TEMPLATES = {
    logistics_pressure: {
      title: 'Investigate logistics pressure',
      relatedDomains: ['economy'],
      checks: [
        'inspect oil and freight divergence',
        'trace supply chain exposure by sector',
        'check whether balance is worsening in energy',
        'compare supply chain stress with economic indicators'
      ]
    },
    energy_shock: {
      title: 'Investigate energy shock',
      relatedDomains: ['supplyChain', 'environment'],
      checks: [
        'compare crude price movement with baseline',
        'check environment stress for weather disruption link',
        'inspect supply chain downstream effects',
        'verify energy source confidence level'
      ]
    },
    financial_tightening: {
      title: 'Investigate financial tightening',
      relatedDomains: ['health', 'supplyChain'],
      checks: [
        'inspect employment contraction depth',
        'trace credit condition indicators',
        'check supply chain demand-supply imbalance',
        'compare with market stress triage readings'
      ]
    },
    medical_stress_cluster: {
      title: 'Investigate medical stress cluster',
      relatedDomains: ['economy'],
      checks: [
        'inspect adverse event reporting volume',
        'compare research publication rate with baseline',
        'trace clinical trial activity changes',
        'check whether health balance is improving or worsening'
      ]
    },
    innovation_acceleration: {
      title: 'Investigate innovation acceleration',
      relatedDomains: ['economy', 'health'],
      checks: [
        'inspect patent filing rate across technology domains',
        'compare research output with historical baseline',
        'trace research-to-market pipeline signals',
        'check whether innovation is sector-specific or broad'
      ]
    },
    recovery_signal: {
      title: 'Investigate recovery signal',
      relatedDomains: [],
      checks: [
        'verify which domains are driving recovery',
        'check whether falling stress is sustained over multiple cycles',
        'inspect balance improvement breadth',
        'confirm source confidence supports recovery reading'
      ]
    },
    feed_degradation: {
      title: 'Investigate feed degradation',
      relatedDomains: [],
      checks: [
        'identify which sources are offline',
        'check whether fallback computations are diverging from last live readings',
        'verify self-repair has attempted recovery',
        'assess confidence impact on active events'
      ]
    },
    systemic_fragmentation: {
      title: 'Investigate systemic fragmentation',
      relatedDomains: [],
      checks: [
        'identify which domains are rising vs falling',
        'check for conflicting cross-domain signals',
        'inspect whether fragmentation is narrowing or widening',
        'compare with previous fragmentation episodes in timeline'
      ]
    },
    escalation_rise: {
      title: 'Investigate escalation rise',
      relatedDomains: [],
      checks: [
        'identify the lead escalation domains',
        'check cross-domain patterns for systemic linkage',
        'inspect whether escalation is accelerating or plateauing',
        'compare current severity with recent peak'
      ]
    },
    stabilization_shift: {
      title: 'Investigate stabilization shift',
      relatedDomains: [],
      checks: [
        'verify which domains show balance improvement',
        'check whether stabilization is broad or isolated',
        'inspect whether any counter-signals threaten recovery',
        'compare stress trajectory with 15-minute trend'
      ]
    }
  };

  // ─── State ──────────────────────────────────────────────────────────────

  var _investigations = [];
  var _interval = null;
  var _drawerEl = null;
  var _drawerOpen = false;
  var _activeInvestigation = null;
  var _hooked = false;
  var _userScrolling = false;
  var _scrollTimer = null;

  // ─── Core generation ───────────────────────────────────────────────────

  function _generate() {
    var events = window.LIMENEvents || {};
    var active = events.active || [];
    var domains = window.LIMENDomains || {};
    var balance = window.LIMENBalance || {};
    var globalState = window.LIMENGlobalState || {};
    var timeline = window.LIMENTimeline || {};
    var audit = window.LIMENSourceAudit || {};
    var memory = window.LIMENDecisionMemory || {};
    var now = Date.now();

    var investigations = [];

    for (var i = 0; i < active.length && investigations.length < MAX_INVESTIGATIONS; i++) {
      var evt = active[i];
      var template = TEMPLATES[evt.type];
      if (!template) continue;

      // Build domain list: event domains + related
      var allDomains = (evt.domains || []).slice();
      if (template.relatedDomains) {
        for (var r = 0; r < template.relatedDomains.length; r++) {
          var rd = template.relatedDomains[r];
          if (allDomains.indexOf(rd) === -1) allDomains.push(rd);
        }
      }

      // Build contextualized checks
      var checks = _contextualizeChecks(template.checks, evt, domains, balance, timeline, audit);

      // Compute priority from event severity + freshness + confidence
      var ageFactor = 1;
      if (evt.firstSeen) {
        var ageMs = now - evt.firstSeen;
        if (ageMs > 600000) ageFactor = 0.85; // older events slightly deprioritized
      }
      var priority = _clamp(_round(
        (evt.severity || 0) * 0.50 +
        (evt.confidence || 0) * 0.25 +
        ageFactor * 0.25
      ), 0, 1);

      // Build reasoning
      var reasoning = _buildReasoning(evt, domains, balance, timeline, audit);

      // Build recent changes
      var recentChanges = _getRecentChanges(evt, timeline);

      investigations.push({
        eventId: evt.id,
        eventType: evt.type,
        title: template.title,
        domains: allDomains,
        suggestedChecks: checks,
        reasoning: reasoning,
        recentChanges: recentChanges,
        priority: priority,
        severity: evt.severity,
        confidence: evt.confidence,
        updated: now
      });
    }

    // Sort by priority
    investigations.sort(function (a, b) { return b.priority - a.priority; });

    _investigations = investigations;
    window.LIMENInvestigations = {
      active: investigations,
      count: investigations.length,
      updated: now
    };

    _dispatch('limen:investigation-update', {
      count: investigations.length,
      top: investigations.length > 0 ? investigations[0] : null,
      updated: now
    });

    // Update drawer if open — skip if user is actively scrolling/reading
    if (_drawerOpen && _activeInvestigation && !_userScrolling) {
      _renderDrawer(_activeInvestigation);
    }
  }

  // ─── Contextual check enrichment ───────────────────────────────────────

  function _contextualizeChecks(baseChecks, evt, domains, balance, timeline, audit) {
    var checks = baseChecks.slice(0, 3);

    // Add balance-specific check if relevant
    var evtDomains = evt.domains || [];
    for (var i = 0; i < evtDomains.length; i++) {
      var bal = balance[evtDomains[i]];
      if (bal) {
        if (bal.state === 'destabilizing') {
          checks.push(evtDomains[i] + ' balance is worsening — verify net trend');
        } else if (bal.state === 'improving') {
          checks.push(evtDomains[i] + ' balance improving — check if event is fading');
        }
        break; // one balance check is enough
      }
    }

    // Add timeline persistence check
    if (timeline && typeof timeline.getEventDuration === 'function') {
      var dur = timeline.getEventDuration(evt.type);
      if (dur && dur > 300000) {
        checks.push('this event has persisted ' + _duration(dur) + ' — check for structural cause');
      }
    }

    // Add confidence warning if low
    if (evt.confidence < 0.4) {
      checks.push('source confidence is low — verify underlying data quality');
    }

    // Limit to 4 checks
    return checks.slice(0, 4);
  }

  // ─── Reasoning builder ─────────────────────────────────────────────────

  function _buildReasoning(evt, domains, balance, timeline, audit) {
    var reasons = [];
    var evtDomains = evt.domains || [];

    // Severity reasoning
    if (evt.severity > 0.65) {
      reasons.push('Severity is high (' + Math.round(evt.severity * 100) + '%), indicating significant pressure.');
    } else if (evt.severity > 0.40) {
      reasons.push('Severity is moderate (' + Math.round(evt.severity * 100) + '%), worth monitoring.');
    }

    // Multi-domain reasoning
    if (evtDomains.length >= 2) {
      reasons.push('Multiple domains involved (' + evtDomains.join(', ') + '), suggesting systemic linkage.');
    }

    // Balance reasoning
    for (var i = 0; i < evtDomains.length; i++) {
      var bal = balance[evtDomains[i]];
      if (bal && bal.state === 'destabilizing') {
        reasons.push(evtDomains[i] + ' balance is destabilizing, amplifying this event.');
        break;
      }
    }

    // Source confidence reasoning
    for (var j = 0; j < evtDomains.length; j++) {
      var aud = audit[evtDomains[j]];
      if (aud && aud.status === 'FALLBACK') {
        reasons.push(evtDomains[j] + ' is on fallback data — readings may be less reliable.');
        break;
      }
    }

    // Duration reasoning
    if (timeline && typeof timeline.getEventDuration === 'function') {
      var dur = timeline.getEventDuration(evt.type);
      if (dur && dur > 600000) {
        reasons.push('This event has been active for ' + _duration(dur) + ', suggesting persistence rather than noise.');
      }
    }

    return reasons;
  }

  // ─── Recent changes for an event ───────────────────────────────────────

  function _getRecentChanges(evt, timeline) {
    if (!timeline || !timeline.entries) return [];
    var changes = [];
    var cutoff = Date.now() - (15 * 60 * 1000);
    var entries = timeline.entries || [];

    for (var i = entries.length - 1; i >= 0 && changes.length < 4; i--) {
      var e = entries[i];
      if (e.timestamp < cutoff) break;
      // Match entries related to this event's domains
      var related = false;
      var evtDomains = evt.domains || [];
      if (e.domains) {
        for (var d = 0; d < e.domains.length; d++) {
          if (evtDomains.indexOf(e.domains[d]) !== -1) { related = true; break; }
        }
      }
      if (e.label && e.label === evt.type) related = true;
      if (!related) continue;
      if (e.type === 'domain-state') continue; // skip snapshots
      changes.push({
        age: _age(e.timestamp),
        label: e.label,
        type: e.type,
        severity: e.severity
      });
    }
    return changes;
  }

  // ─── Investigation drawer UI ───────────────────────────────────────────

  function _ensureDrawer() {
    if (_drawerEl) return;
    _drawerEl = document.createElement('div');
    _drawerEl.id = 'limen-investigation-drawer';
    _drawerEl.style.cssText = [
      'position:fixed',
      'top:50%',
      'right:12px',
      'transform:translateY(-50%)',
      'background:rgba(8,9,12,0.94)',
      'border:1px solid rgba(201,169,78,0.18)',
      'padding:12px 16px',
      'font-family:"IBM Plex Mono",monospace',
      'font-size:0.44rem',
      'letter-spacing:1.2px',
      'z-index:9998',
      'border-radius:2px',
      'pointer-events:auto',
      'box-shadow:0 4px 16px rgba(0,0,0,0.6)',
      'line-height:1.7',
      'min-width:240px',
      'max-width:300px',
      'max-height:60vh',
      'overflow-y:auto',
      'display:none'
    ].join(';');
    document.body.appendChild(_drawerEl);
  }

  function openDrawer(eventId) {
    var inv = null;
    for (var i = 0; i < _investigations.length; i++) {
      if (_investigations[i].eventId === eventId) {
        inv = _investigations[i];
        break;
      }
    }
    if (!inv && _investigations.length > 0) {
      inv = _investigations[0];
    }
    if (!inv) return;

    _activeInvestigation = inv.eventId;
    _drawerOpen = true;
    _renderDrawer(inv.eventId);
    _saveDrawerState();
  }

  function closeDrawer() {
    _drawerOpen = false;
    _activeInvestigation = null;
    if (_drawerEl) {
      _drawerEl.style.display = 'none';
      _drawerEl.style.pointerEvents = 'none';
    }
    _saveDrawerState();
  }

  function _saveDrawerState() {
    if (window.LIMENUIState) {
      window.LIMENUIState.save({
        invDrawerOpen: _drawerOpen,
        invActiveId: _activeInvestigation,
        invScrollTop: _drawerEl ? _drawerEl.scrollTop : 0
      });
    }
  }

  function _renderDrawer(eventId) {
    _ensureDrawer();

    // Gate visibility behind panel state manager BEFORE touching DOM
    if (window.LIMENPanelState && !window.LIMENPanelState.isVisible('limen-investigation-drawer')) {
      return;
    }

    var inv = null;
    for (var i = 0; i < _investigations.length; i++) {
      if (_investigations[i].eventId === eventId) {
        inv = _investigations[i];
        break;
      }
    }
    if (!inv) {
      _drawerEl.style.display = 'none';
      return;
    }

    var gold = '#c9a94e';
    var teal = '#5ab5a0';
    var red = '#e85454';
    var orange = '#d4a44e';
    var dim = 'rgba(201,169,78,0.4)';
    var dimText = 'rgba(200,195,184,0.5)';
    var textColor = 'rgba(200,195,184,0.7)';

    var sevColor = teal;
    if (inv.severity > 0.65) sevColor = red;
    else if (inv.severity > 0.40) sevColor = orange;

    var html = '';

    // Header
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
    html += '<span style="color:' + gold + ';font-size:0.46rem;letter-spacing:2px">INVESTIGATION</span>';
    html += '<span id="limen-inv-close" style="color:' + dim + ';cursor:pointer;font-size:0.50rem">\u2715</span>';
    html += '</div>';

    // Title + severity
    html += '<div style="color:' + sevColor + ';font-size:0.46rem;margin-bottom:4px">' + inv.title + '</div>';
    html += '<div style="color:' + dim + ';font-size:0.38rem;margin-bottom:6px">';
    html += 'severity: ' + Math.round(inv.severity * 100) + '% ';
    html += 'confidence: ' + Math.round(inv.confidence * 100) + '% ';
    html += 'priority: ' + Math.round(inv.priority * 100) + '%';
    html += '</div>';

    // Domains
    html += '<div style="color:' + dim + ';font-size:0.40rem;margin-bottom:2px">Domains:</div>';
    html += '<div style="color:' + dimText + ';margin-bottom:6px;padding-left:6px">';
    html += inv.domains.join(', ');
    html += '</div>';

    // Why this matters
    if (inv.reasoning.length > 0) {
      html += '<div style="color:' + dim + ';font-size:0.40rem;margin-bottom:2px">Why this matters:</div>';
      for (var r = 0; r < inv.reasoning.length; r++) {
        html += '<div style="color:' + textColor + ';padding-left:6px;font-size:0.42rem">\u2022 ' + inv.reasoning[r] + '</div>';
      }
      html += '<div style="margin-bottom:6px"></div>';
    }

    // Recent changes
    if (inv.recentChanges.length > 0) {
      html += '<div style="color:' + dim + ';font-size:0.40rem;margin-bottom:2px">Recent changes:</div>';
      for (var c = 0; c < inv.recentChanges.length; c++) {
        var ch = inv.recentChanges[c];
        var chCol = dimText;
        if (ch.type === 'event-start') chCol = orange;
        else if (ch.type === 'event-end') chCol = teal;
        html += '<div style="color:' + chCol + ';padding-left:6px;font-size:0.40rem">';
        html += ch.age + ' \u2022 ' + ch.label;
        if (ch.severity > 0) html += ' (' + Math.round(ch.severity * 100) + '%)';
        html += '</div>';
      }
      html += '<div style="margin-bottom:6px"></div>';
    }

    // Suggested checks
    html += '<div style="color:' + gold + ';font-size:0.40rem;margin-bottom:2px">Suggested next checks:</div>';
    for (var s = 0; s < inv.suggestedChecks.length; s++) {
      html += '<div style="color:' + textColor + ';padding-left:6px;font-size:0.42rem">\u2022 ' + inv.suggestedChecks[s] + '</div>';
    }

    // Action buttons
    html += '<div style="margin-top:8px">';
    html += '<button class="limen-inv-action" data-action="inspect event" data-domain="' + (inv.domains[0] || '') + '" style="' + _btnStyle(teal) + '">[ inspect deeper ]</button>';
    if (inv.domains.length > 1) {
      html += '<button class="limen-inv-action" data-action="trace domains" data-domain="' + inv.domains.join('+') + '" style="' + _btnStyle(teal) + '">[ trace domains ]</button>';
    }
    html += '<button class="limen-inv-action" data-action="hold" data-domain="" style="' + _btnStyle(dim) + '">[ dismiss ]</button>';
    html += '</div>';

    // Preserve scroll position across content replacement
    var prevScroll = _drawerEl.scrollTop;
    _drawerEl.innerHTML = html;

    // Restore scroll after browser reflow so scrollHeight is accurate
    requestAnimationFrame(function () {
      if (_drawerEl) _drawerEl.scrollTop = prevScroll;
    });

    _drawerEl.style.display = 'block';
    _drawerEl.style.pointerEvents = 'auto';

    // Track user scroll activity so auto-updates don't interrupt reading
    _drawerEl.removeEventListener('scroll', _onDrawerScroll);
    _drawerEl.addEventListener('scroll', _onDrawerScroll);

    // Bind close
    var closeBtn = document.getElementById('limen-inv-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeDrawer);
    }

    // Bind action buttons
    var actions = _drawerEl.querySelectorAll('.limen-inv-action');
    for (var a = 0; a < actions.length; a++) {
      actions[a].addEventListener('click', function () {
        var action = this.getAttribute('data-action');
        var domain = this.getAttribute('data-domain');
        _dispatch('limen:user-action', {
          action: action,
          domain: domain,
          type: 'investigation',
          timestamp: Date.now()
        });
        closeDrawer();
      });
      actions[a].addEventListener('mouseenter', function () {
        this.style.background = 'rgba(201,169,78,0.12)';
        this.style.borderColor = 'rgba(201,169,78,0.3)';
      });
      actions[a].addEventListener('mouseleave', function () {
        this.style.background = 'rgba(201,169,78,0.06)';
        this.style.borderColor = 'rgba(201,169,78,0.15)';
      });
    }
  }

  function _onDrawerScroll() {
    _userScrolling = true;
    if (_scrollTimer) clearTimeout(_scrollTimer);
    _scrollTimer = setTimeout(function () { _userScrolling = false; }, 3000);
  }

  function _btnStyle(color) {
    return [
      'display:block',
      'width:100%',
      'text-align:left',
      'background:rgba(201,169,78,0.06)',
      'border:1px solid rgba(201,169,78,0.15)',
      'color:' + color,
      'font-family:"IBM Plex Mono",monospace',
      'font-size:0.42rem',
      'letter-spacing:1.2px',
      'padding:4px 8px',
      'margin:2px 0',
      'cursor:pointer',
      'border-radius:2px',
      'transition:background 0.2s,border-color 0.2s'
    ].join(';');
  }

  // ─── Event rail click integration ──────────────────────────────────────

  function _hookEventClicks() {
    if (_hooked) return;
    _hooked = true;

    // Listen for clicks on event rail items
    document.addEventListener('click', function (e) {
      var target = e.target;
      // Walk up to find an element inside the event rail
      while (target && target.id !== 'limen-event-rail') {
        target = target.parentNode;
      }
      if (!target || target.id !== 'limen-event-rail') return;

      // Open investigation for top event
      if (_investigations.length > 0) {
        openDrawer(_investigations[0].eventId);
      }
    });

    // Listen for domain panel clicks that might want investigation
    window.addEventListener('limen:user-action', function (e) {
      var detail = e.detail;
      if (!detail) return;
      if (detail.action === 'inspect event' && detail.type !== 'investigation') {
        // Find investigation matching this domain
        for (var i = 0; i < _investigations.length; i++) {
          if (_investigations[i].domains.indexOf(detail.domain) !== -1) {
            openDrawer(_investigations[i].eventId);
            return;
          }
        }
      }
    });
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  function start() {
    if (_interval) return;
    _hookEventClicks();
    var fs = window.LIMENFeedState;
    if (fs && typeof fs.onHydrated === 'function') {
      fs.onHydrated(function () {
        _generate();
        _interval = setInterval(function () { if (!document.hidden) _generate(); }, UPDATE_MS);
        window.addEventListener('limen:event', _onEvent);
        _restoreDrawerState();
      });
    } else {
      _generate();
      _interval = setInterval(function () { if (!document.hidden) _generate(); }, UPDATE_MS);
      window.addEventListener('limen:event', _onEvent);
      _restoreDrawerState();
    }
  }

  function _restoreDrawerState() {
    if (!window.LIMENUIState) return;
    var saved = window.LIMENUIState.restore({ samePageType: true });
    if (!saved || !saved.invDrawerOpen) return;
    if (saved.invActiveId) {
      openDrawer(saved.invActiveId);
      // Defer scroll restoration to after drawer render
      if (saved.invScrollTop && _drawerEl) {
        requestAnimationFrame(function () {
          if (_drawerEl) _drawerEl.scrollTop = saved.invScrollTop;
        });
      }
    }
  }

  function stop() {
    if (_interval) {
      clearInterval(_interval);
      _interval = null;
    }
    window.removeEventListener('limen:event', _onEvent);
    closeDrawer();
  }

  function _onEvent() {
    _generate();
  }

  // ─── Utilities ──────────────────────────────────────────────────────────

  function _clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function _round(v) { return Math.round(v * 100) / 100; }

  function _age(ts) {
    var ms = Date.now() - ts;
    if (ms < 60000) return 'now';
    if (ms < 3600000) return Math.floor(ms / 60000) + 'm ago';
    return Math.floor(ms / 3600000) + 'h ago';
  }

  function _duration(ms) {
    if (ms < 60000) return Math.round(ms / 1000) + 's';
    if (ms < 3600000) return Math.floor(ms / 60000) + 'm';
    return Math.floor(ms / 3600000) + 'h ' + Math.floor((ms % 3600000) / 60000) + 'm';
  }

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  window.LIMENInvestigations = {
    active: [],
    count: 0,
    updated: null
  };

  window.LIMENInvestigationEngine = {
    start: start,
    stop: stop,
    openDrawer: openDrawer,
    closeDrawer: closeDrawer
  };

})();
