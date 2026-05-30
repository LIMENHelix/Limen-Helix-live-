/**
 * LIMEN Executive UI Subscriber Layer — Phase 12B
 *
 * Subscribes to executive + simulation events.
 * Renders lightweight UI overlays on existing surfaces.
 * No business logic — reads only from APIs.
 *
 * Surfaces wired:
 *   1. Executive Queue (top of console/civilization)
 *   2. Domain panels (repair map regime/attention tags)
 *   3. Opportunities page (promote-to-intent, linked intent badge)
 *   4. Self-audit panel (executive state summary)
 *
 * Events consumed:
 *   limen:intent-created
 *   limen:intent-updated
 *   limen:intent-completed
 *   limen:intent-abandoned
 *   limen:step-waiting-user
 *   limen:attention-updated
 *   limen:simulation-created
 *   limen:domain-update
 */
(function () {
  'use strict';

  var QUEUE_CONTAINER_ID = 'limen-executive-queue';
  var AUDIT_CONTAINER_ID = 'limen-executive-audit-panel';

  // Restore-origin flag — set true when limen:intents-restored fires (server
  // replayed the prior session's intent bag into localStorage). Cleared on
  // the first user-initiated intent mutation (created/updated/completed/
  // abandoned). While true, the Executive Queue header carries a small
  // neutral label so the user knows the listed intents are from a prior
  // session, not this session.
  var _intentsWereRestored = false;

  // ══════════════════════════════════════════════════════════════════════
  // 1. EXECUTIVE QUEUE COMPONENT
  // Shows top 3 active intents with status, waitingReason, next step
  // ══════════════════════════════════════════════════════════════════════

  function _renderQueue() {
    var exec = window.LIMENExecutive;
    if (!exec) return;

    var container = document.getElementById(QUEUE_CONTAINER_ID);
    if (!container) {
      // Auto-create container at top of main content area
      container = document.createElement('div');
      container.id = QUEUE_CONTAINER_ID;
      // Try to insert before hero or at top of body
      var hero = document.querySelector('.clarity-hero') || document.querySelector('.hero-strip');
      if (hero && hero.parentNode) {
        hero.parentNode.insertBefore(container, hero.nextSibling);
      } else {
        var main = document.querySelector('main') || document.body;
        main.insertBefore(container, main.firstChild);
      }
    }

    var queue = exec.getExecutiveQueue();
    var attention = exec.getAttentionAllocation();

    if (queue.length === 0) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    var top3 = queue.slice(0, 3);

    var h = '<div style="margin:8px 16px;padding:10px 14px;background:rgba(0,0,0,0.15);border:1px solid rgba(74,143,212,0.12);border-radius:4px;font-family:\'IBM Plex Mono\',monospace">';
    h += '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px">';
    h += '<span style="font-size:0.42rem;letter-spacing:2.5px;color:rgba(74,143,212,0.5)">EXECUTIVE QUEUE</span>';
    h += '<span style="font-size:0.28rem;color:rgba(200,195,184,0.2)">' + queue.length + ' active intent' + (queue.length > 1 ? 's' : '') + '</span>';
    if (_intentsWereRestored) {
      h += '<span style="font-size:0.26rem;letter-spacing:1px;color:rgba(200,195,184,0.3);font-style:italic">· restored from prior session</span>';
    }
    h += '</div>';

    for (var i = 0; i < top3.length; i++) {
      var q = top3[i];
      var intent = exec.getIntent(q.intentId);
      if (!intent) continue;

      var statusColor = intent.status === 'WAITING_USER' ? '#C9A94E' : (intent.status === 'PAUSED' ? '#888' : '#4a8fd4');
      var wrLabel = intent.waitingReason ? intent.waitingReason.replace(/_/g, ' ') : '';
      var rtcBadge = intent.readyToComplete ? ' <span style="color:#5ab5a0;font-size:0.25rem">[READY]</span>' : '';

      h += '<div style="padding:6px 0;border-top:1px solid rgba(200,195,184,0.04)">';
      // Row 1: title + status
      h += '<div style="display:flex;justify-content:space-between;align-items:baseline">';
      h += '<span style="font-size:0.36rem;color:#d0cec8">' + _esc(intent.title) + '</span>';
      h += '<span style="font-size:0.28rem;color:' + statusColor + ';letter-spacing:1px">' + intent.status + rtcBadge + '</span>';
      h += '</div>';
      // Row 2: domain + progress + waiting reason
      h += '<div style="font-size:0.28rem;color:#666;margin-top:2px">';
      h += intent.domain.toUpperCase() + ' \u00b7 ' + Math.round(intent.progress * 100) + '% \u00b7 urgency ' + q.urgency;
      if (wrLabel) h += ' \u00b7 <span style="color:' + statusColor + '">' + wrLabel + '</span>';
      h += '</div>';
      // Row 3: next step recommendation
      if (q.nextStep && !q.nextStep.done) {
        h += '<div style="font-size:0.28rem;color:rgba(74,143,212,0.6);margin-top:3px;padding-left:8px;border-left:2px solid rgba(74,143,212,0.1)">';
        h += '\u2192 ' + _esc(q.nextStep.label || q.nextStep.recommendation || '');
        h += '</div>';
      }
      // Row 4: simulation confidence if available
      if (intent.simulation && intent.simulation.confidence !== undefined) {
        var simColor = intent.simulation.confidence >= 0.5 ? '#5ab5a0' : (intent.simulation.confidence >= 0.3 ? '#C9A94E' : '#e85454');
        h += '<div style="font-size:0.25rem;color:#555;margin-top:2px">';
        h += 'Sim: <span style="color:' + simColor + '">' + intent.simulation.evidenceLevel + ' (' + intent.simulation.confidence + ')</span>';
        if (intent.simulation.riskFlags && intent.simulation.riskFlags.length > 0) {
          h += ' \u00b7 ' + intent.simulation.riskFlags.slice(0, 2).join(', ');
        }
        h += '</div>';
      }
      h += '</div>';
    }

    h += '</div>';
    container.innerHTML = h;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 2. DOMAIN PANEL ENHANCEMENT
  // Adds attention weight + trajectory hint to domain-repair-map cards
  // ══════════════════════════════════════════════════════════════════════

  function _enhanceDomainPanels() {
    var exec = window.LIMENExecutive;
    var sim = window.LIMENSimulation;
    if (!exec) return;

    var attention = exec.getAttentionAllocation();
    var cards = document.querySelectorAll('.ldr-card');

    for (var ci = 0; ci < cards.length; ci++) {
      var card = cards[ci];
      // Get domain from card header
      var nameEl = card.querySelector('.ldr-domain-name');
      if (!nameEl) continue;
      var domainLabel = nameEl.textContent.trim().toLowerCase().replace(/\s+/g, '');
      // Match to domain key
      var domainKey = _matchDomainKey(domainLabel);
      if (!domainKey) continue;

      // Skip if already enhanced
      if (card.querySelector('.exec-attn-tag')) continue;

      // Attention weight tag
      var attnWeight = attention[domainKey];
      if (attnWeight !== undefined) {
        var attnEl = document.createElement('div');
        attnEl.className = 'exec-attn-tag';
        attnEl.style.cssText = 'font-size:0.4rem;color:rgba(74,143,212,0.4);margin:2px 0';
        attnEl.textContent = 'Attn: ' + Math.round(attnWeight * 100) + '%';
        // Add after trend line
        var trendEl = card.querySelector('.ldr-trend');
        if (trendEl && trendEl.parentNode) {
          trendEl.parentNode.insertBefore(attnEl, trendEl.nextSibling);
        }
      }

      // Linked intent badge
      var intents = exec.getActiveIntents();
      var linkedIntent = null;
      for (var ii = 0; ii < intents.length; ii++) {
        if (intents[ii].domain === domainKey) { linkedIntent = intents[ii]; break; }
      }
      if (linkedIntent) {
        var intentEl = document.createElement('div');
        intentEl.className = 'exec-attn-tag';
        intentEl.style.cssText = 'font-size:0.35rem;color:rgba(74,143,212,0.5);margin:2px 0;padding:2px 6px;background:rgba(74,143,212,0.04);border-radius:2px';
        var wrText = linkedIntent.waitingReason ? ' \u00b7 ' + linkedIntent.waitingReason.replace(/_/g, ' ') : '';
        intentEl.textContent = '\u25B6 ' + linkedIntent.status + wrText;
        card.appendChild(intentEl);
      }

      // Trajectory hint from simulation
      if (sim && sim.forecastBaseline) {
        var forecast = sim.forecastBaseline(domainKey);
        if (forecast.label !== 'INSUFFICIENT_DATA') {
          var fEl = document.createElement('div');
          fEl.className = 'exec-attn-tag';
          fEl.style.cssText = 'font-size:0.35rem;color:rgba(200,195,184,0.3);margin:2px 0';
          var arrow = forecast.projectedDirection === 'UP' ? '\u2191' : (forecast.projectedDirection === 'DOWN' ? '\u2193' : '\u2192');
          fEl.textContent = arrow + ' ' + forecast.label + ' (' + forecast.evidenceLevel + ')';
          card.appendChild(fEl);
        }
      }
    }
  }

  var DOMAIN_KEY_MAP = {
    'economy': 'economy', 'energy': 'energy', 'environment': 'environment',
    'health': 'health', 'technology': 'technology', 'research': 'research',
    'supplychain': 'supplyChain', 'governance': 'governance',
    'infrastructure': 'infrastructure', 'agriculture': 'agriculture',
    'industry': 'industry', 'education': 'education',
    'communication': 'communication', 'culture': 'culture',
    'defense': 'defense', 'religion': 'religion', 'population': 'population',
    'law': 'law', 'finance': 'finance', 'intelligence': 'intelligence',
    'trade': 'supplyChain',
    'supplychain': 'supplyChain'
  };

  function _matchDomainKey(label) {
    return DOMAIN_KEY_MAP[label] || null;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 3. OPPORTUNITIES PAGE ENHANCEMENT
  // Adds "Promote to Intent" button + linked intent badge
  // ══════════════════════════════════════════════════════════════════════

  function _enhanceOpportunities() {
    var exec = window.LIMENExecutive;
    if (!exec || !window._oppData) return;

    var cards = document.querySelectorAll('[data-idx]');
    for (var ci = 0; ci < cards.length; ci++) {
      var card = cards[ci];
      if (card.querySelector('.exec-promote-btn')) continue; // already enhanced

      var idx = parseInt(card.getAttribute('data-idx'), 10);
      var opp = window._oppData[idx];
      if (!opp || opp.status !== 'active') continue;

      var domain = opp.pb ? opp.pb.domains[0] : '';
      if (!domain) continue;

      // Check for linked intent
      var intents = exec.getActiveIntents();
      var linked = null;
      for (var ii = 0; ii < intents.length; ii++) {
        if (intents[ii].domain === domain && intents[ii].source === 'opportunity') {
          linked = intents[ii]; break;
        }
      }

      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'margin-top:6px;padding:4px 8px;background:rgba(74,143,212,0.03);border-radius:2px;font-size:0.32rem';

      if (linked) {
        // Show linked intent badge
        var statusColor = linked.status === 'WAITING_USER' ? '#C9A94E' : '#4a8fd4';
        wrapper.innerHTML = '<span style="color:' + statusColor + '">\u25B6 ' + linked.status + '</span>' +
          ' \u00b7 ' + Math.round(linked.progress * 100) + '% \u00b7 ' +
          '<span style="color:#888">' + (linked.waitingReason || '').replace(/_/g, ' ') + '</span>';
      } else {
        // Promote button
        wrapper.className = 'exec-promote-btn';
        wrapper.innerHTML = '<span style="color:rgba(74,143,212,0.5);cursor:pointer;letter-spacing:1px" ' +
          'onclick="if(window.LIMENExecutive){var r=window.LIMENExecutive.generateIntentFromDomain(\'' + _esc(domain) + '\');' +
          'if(r.error)alert(r.error);else alert(\'Intent created: \'+r.title)}">' +
          '\u25B6 PROMOTE TO INTENT</span>';
      }

      card.appendChild(wrapper);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // 4. SELF-AUDIT PANEL ADDITIONS
  // Appends executive state summary to existing audit panel
  // ══════════════════════════════════════════════════════════════════════

  function _renderAuditAdditions() {
    var exec = window.LIMENExecutive;
    var sim = window.LIMENSimulation;
    if (!exec) return '';

    var audit = exec.getExecutiveAudit();
    var simAudit = sim ? sim.getSimulationAudit() : {};
    var fmem = sim ? sim.getForecastMemory() : {};

    var h = '';
    var panelStyle = 'margin-top:12px;padding:8px 10px;border-radius:3px;';
    var headerStyle = 'font-size:0.42rem;letter-spacing:2.5px;margin-bottom:6px;';
    var lineStyle = 'font-size:0.34rem;color:rgba(200,195,184,0.5);padding:2px 0;';

    h += '<div style="' + panelStyle + 'border:1px solid rgba(74,143,212,0.1);background:rgba(0,0,0,0.08)">';
    h += '<div style="' + headerStyle + 'color:rgba(74,143,212,0.5)">EXECUTIVE STATE</div>';

    // Active / blocked / stale
    h += '<div style="' + lineStyle + '">';
    h += 'Active: ' + audit.activeCount;
    if (audit.staleCount > 0) h += ' \u00b7 <span style="color:#C9A94E">Stale: ' + audit.staleCount + '</span>';
    if (audit.blockedCount > 0) h += ' \u00b7 <span style="color:#e85454">Blocked: ' + audit.blockedCount + '</span>';
    h += ' \u00b7 Completion: ' + audit.completionRate + '%';
    h += '</div>';

    // Rejected transitions
    var rejCount = (audit.rejectedTransitions || []).length || 0;
    if (rejCount > 0) {
      h += '<div style="' + lineStyle + 'color:#e85454">Rejected transitions: ' + rejCount + '</div>';
    }

    // Plan memory summary
    if (audit.planMemorySummary && audit.planMemorySummary.length > 0) {
      h += '<div style="font-size:0.3rem;color:rgba(200,195,184,0.3);margin-top:4px">Plan memory:</div>';
      for (var pi = 0; pi < Math.min(audit.planMemorySummary.length, 3); pi++) {
        var pm = audit.planMemorySummary[pi];
        var pmColor = pm.factor > 1.05 ? '#5ab5a0' : (pm.factor < 0.95 ? '#e85454' : '#888');
        h += '<span style="font-size:0.28rem;color:' + pmColor + ';margin-right:6px">' + pm.key + ':' + pm.factor + 'x</span>';
      }
    }

    // Simulation stats
    if (simAudit.totalRun > 0) {
      h += '<div style="' + lineStyle + 'margin-top:4px">';
      h += 'Simulations: ' + simAudit.totalRun + ' \u00b7 Avg confidence: ' + (simAudit.avgConfidence || 0);
      h += '</div>';
    }

    // Forecast memory hit rate
    var fmKeys = typeof fmem === 'object' ? Object.keys(fmem) : [];
    if (fmKeys.length > 0) {
      h += '<div style="font-size:0.3rem;color:rgba(200,195,184,0.3);margin-top:4px">Forecast accuracy:</div>';
      for (var fi = 0; fi < Math.min(fmKeys.length, 3); fi++) {
        var fm = fmem[fmKeys[fi]];
        if (!fm) continue;
        var hrColor = fm.directionHitRate >= 0.6 ? '#5ab5a0' : (fm.directionHitRate >= 0.4 ? '#C9A94E' : '#e85454');
        h += '<span style="font-size:0.28rem;color:' + hrColor + ';margin-right:6px">';
        h += fmKeys[fi] + ': ' + Math.round(fm.directionHitRate * 100) + '% hit</span>';
      }
    }

    h += '</div>';
    return h;
  }

  // Make audit additions available to console-clarity's self-audit builder
  window._buildExecutiveAuditHtml = _renderAuditAdditions;

  // ══════════════════════════════════════════════════════════════════════
  // EVENT SUBSCRIPTIONS
  // ══════════════════════════════════════════════════════════════════════

  function _esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  // Audit dirty flag — set by executive/simulation events, cleared on rebuild
  var _auditDirty = true;

  function _onExecutiveChange() {
    _renderQueue();
    _auditDirty = true;
    // Debounce domain panel enhancement
    clearTimeout(_domainTimer);
    _domainTimer = setTimeout(function () {
      _enhanceDomainPanels();
      _enhanceOpportunities();
    }, 500);
  }

  // Expose dirty check so console-clarity can rebuild audit only when state changed
  window._isExecutiveAuditDirty = function () { return _auditDirty; };
  window._clearExecutiveAuditDirty = function () { _auditDirty = false; };

  var _domainTimer = null;

  if (typeof window !== 'undefined') {
    // Restore-origin flag management. These listeners are registered BEFORE
    // the _onExecutiveChange listeners so the flag-clearing fires before the
    // render on shared events (user-initiated intent mutations).
    window.addEventListener('limen:intents-restored', function () {
      _intentsWereRestored = true;
      _renderQueue();
    });
    function _clearRestoreFlag() { _intentsWereRestored = false; }
    window.addEventListener('limen:intent-created',   _clearRestoreFlag);
    window.addEventListener('limen:intent-updated',   _clearRestoreFlag);
    window.addEventListener('limen:intent-completed', _clearRestoreFlag);
    window.addEventListener('limen:intent-abandoned', _clearRestoreFlag);

    window.addEventListener('limen:intent-created', _onExecutiveChange);
    window.addEventListener('limen:intent-updated', _onExecutiveChange);
    window.addEventListener('limen:intent-completed', _onExecutiveChange);
    window.addEventListener('limen:intent-abandoned', _onExecutiveChange);
    window.addEventListener('limen:step-waiting-user', _onExecutiveChange);
    window.addEventListener('limen:simulation-created', _onExecutiveChange);
    window.addEventListener('limen:attention-updated', _onExecutiveChange);
    window.addEventListener('limen:forecast-memory-updated', function () { _auditDirty = true; });
    // Also refresh on domain updates (which triggers attention recalc)
    window.addEventListener('limen:domain-update', function () {
      setTimeout(_onExecutiveChange, 1000);
    });

    // Initial render after DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { setTimeout(_onExecutiveChange, 2000); });
    } else {
      setTimeout(_onExecutiveChange, 2000);
    }
  }

})();
