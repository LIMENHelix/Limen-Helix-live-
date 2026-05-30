/**
 * escalation-console.js
 * LIMEN HELIX — Escalation Console
 *
 * CLIENT-SIDE ADVISORY LAYER ONLY.
 * Triages active signals into IMMEDIATE / DEVELOPING / WATCH tiers
 * based on severity, freshness, confidence, and domain count.
 *
 * Depends on: window.LIMENDomains, window.LIMENSourceAudit,
 *             window.LIMENCrossDomain, window.LIMENBalance,
 *             window.LIMENGlobalState
 * Listens: limen:domain-update
 * Emits: limen:escalation-update, limen:escalation-shift
 * Output: window.LIMENEscalation
 *
 * Load order: after balance-meter.js
 */

(function () {
  'use strict';

  var DOMAIN_KEYS = ['economy', 'energy', 'environment', 'health', 'technology', 'research', 'supplyChain', 'governance', 'infrastructure', 'agriculture', 'industry', 'education', 'communication', 'culture', 'defense', 'religion', 'population', 'law', 'finance', 'intelligence'];
  var UPDATE_MS = 8000;

  // Tier thresholds
  var IMMEDIATE_SCORE = 0.70;
  var DEVELOPING_SCORE = 0.40;
  // Below DEVELOPING = WATCH

  // ─── State ───────────────────────────────────────────────────────────────

  var _items = [];
  var _tiers = { immediate: [], developing: [], watch: [] };
  var _interval = null;
  var _panelEl = null;
  var _prevImmediateCount = 0;

  // ─── Triage computation ────────────────────────────────────────────────

  function _compute() {
    var domains = window.LIMENDomains || {};
    var audit = window.LIMENSourceAudit || {};
    var crossDomain = (window.LIMENCrossDomain && window.LIMENCrossDomain.active) || [];
    var balance = window.LIMENBalance || {};
    var globalState = window.LIMENGlobalState || {};
    var now = Date.now();

    var items = [];

    // 1. Score each elevated domain as an item
    for (var i = 0; i < DOMAIN_KEYS.length; i++) {
      var k = DOMAIN_KEYS[i];
      var d = domains[k];
      if (!d || d.stress < 0.20) continue;

      var score = _scoreDomain(k, d, audit[k], balance[k]);
      var freshMs = d.updated ? now - d.updated : 999999;
      var label = _domainLabel(k, d, balance[k]);

      items.push({
        id: 'domain-' + k,
        type: 'domain',
        label: label,
        domain: k,
        score: score,
        confidence: d.confidence || 0,
        freshness: _freshness(d.updated),
        freshMs: freshMs,
        stress: d.stress,
        trend: d.trend || 0
      });
    }

    // 2. Score cross-domain patterns
    for (var c = 0; c < crossDomain.length; c++) {
      var pat = crossDomain[c];
      var patScore = _scorePattern(pat);

      items.push({
        id: 'cross-' + (pat.patternId || c),
        type: 'cross-domain',
        label: pat.pattern || 'cross-domain signal',
        domain: pat.domains ? pat.domains.join('+') : 'multi',
        score: patScore,
        confidence: pat.confidence || 0,
        freshness: _freshness(pat.updated),
        freshMs: pat.updated ? now - pat.updated : 999999,
        stress: pat.severity || 0,
        trend: 0
      });
    }

    // 3. Global state escalation boost
    if (globalState.mode === 'escalating') {
      for (var g = 0; g < items.length; g++) {
        items[g].score = _clamp(items[g].score + 0.10, 0, 1);
      }
    }

    // Sort by score descending
    items.sort(function (a, b) { return b.score - a.score; });

    // Classify into tiers
    var immediate = [];
    var developing = [];
    var watch = [];

    for (var t = 0; t < items.length; t++) {
      var item = items[t];
      if (item.score >= IMMEDIATE_SCORE) {
        immediate.push(item);
      } else if (item.score >= DEVELOPING_SCORE) {
        developing.push(item);
      } else {
        watch.push(item);
      }
    }

    // Limit display
    immediate = immediate.slice(0, 3);
    developing = developing.slice(0, 3);
    watch = watch.slice(0, 3);

    _items = items;
    _tiers = { immediate: immediate, developing: developing, watch: watch };

    var escalation = {
      tiers: _tiers,
      itemCount: items.length,
      immediateCount: immediate.length,
      updated: now
    };

    window.LIMENEscalation = escalation;
    _dispatch('limen:escalation-update', escalation);

    // Emit shift when immediate tier changes
    if (immediate.length > 0 && _prevImmediateCount === 0) {
      _dispatch('limen:escalation-shift', {
        direction: 'escalating',
        immediate: immediate,
        developing: developing,
        updated: now
      });
    } else if (immediate.length === 0 && _prevImmediateCount > 0) {
      _dispatch('limen:escalation-shift', {
        direction: 'deescalating',
        immediate: immediate,
        developing: developing,
        updated: now
      });
    }
    _prevImmediateCount = immediate.length;

    _renderPanel();
  }

  // ─── Scoring functions ──────────────────────────────────────────────────

  function _scoreDomain(key, d, auditEntry, bal) {
    var score = 0;

    // Stress is primary (0-1)
    score += (d.stress || 0) * 0.45;

    // Rising trend amplifies
    var trend = d.trend || 0;
    if (trend > 0.03) score += trend * 1.5;

    // Confidence boosts real data, penalizes fallback
    var conf = d.confidence || 0;
    score += conf * 0.15;

    // Freshness: recent data scores higher
    if (d.updated && (Date.now() - d.updated) < 60000) {
      score += 0.05;
    }

    // Source status: LIVE gets boost
    if (auditEntry && auditEntry.status === 'LIVE') {
      score += 0.08;
    }

    // Destabilizing balance amplifies
    if (bal && bal.state === 'destabilizing') {
      score += 0.10;
    } else if (bal && bal.state === 'improving') {
      score -= 0.08;
    }

    return _clamp(_round(score), 0, 1);
  }

  function _scorePattern(pat) {
    var score = 0;
    score += (pat.severity || 0) * 0.50;
    score += (pat.confidence || 0) * 0.20;
    // Multi-domain patterns are inherently more urgent
    if (pat.domains && pat.domains.length >= 2) score += 0.15;
    return _clamp(_round(score), 0, 1);
  }

  function _domainLabel(key, d, bal) {
    var signals = d.signals || [];
    if (signals.length > 0) return signals[0];
    if (bal && bal.state === 'destabilizing') return key + ' destabilizing';
    if (d.stress > 0.65) return key + ' stress elevated';
    return key + ' pressure';
  }

  // ─── UI panel ────────────────────────────────────────────────────────────

  function _ensurePanel() {
    if (_panelEl) return;
    _panelEl = document.createElement('div');
    _panelEl.id = 'limen-escalation-panel';
    _panelEl.style.cssText = [
      'position:fixed',
      'top:140px',
      'left:12px',
      'background:rgba(8,9,12,0.92)',
      'border:1px solid rgba(201,169,78,0.15)',
      'padding:8px 12px',
      'font-family:"IBM Plex Mono",monospace',
      'font-size:0.45rem',
      'letter-spacing:1.5px',
      'z-index:9995',
      'border-radius:2px',
      'pointer-events:none',
      'box-shadow:0 2px 8px rgba(0,0,0,0.5)',
      'line-height:1.7',
      'min-width:190px',
      'max-width:240px',
      'display:none'
    ].join(';');
    document.body.appendChild(_panelEl);
  }

  function _renderPanel() {
    // Panel rendering disabled — data still computed for events/API
    return;

    var gold = '#c9a94e';
    var red = '#e85454';
    var orange = '#d4a44e';
    var teal = '#5ab5a0';
    var dim = 'rgba(201,169,78,0.35)';
    var dimText = 'rgba(200,195,184,0.5)';

    var html = '<div style="color:' + gold + ';font-size:0.48rem;margin-bottom:4px">ESCALATION</div>';

    // IMMEDIATE
    if (_tiers.immediate.length > 0) {
      html += '<div style="color:' + red + ';font-size:0.42rem;margin-top:3px">IMMEDIATE</div>';
      for (var a = 0; a < _tiers.immediate.length; a++) {
        html += _renderItem(_tiers.immediate[a], red, dimText, dim);
      }
    }

    // DEVELOPING
    if (_tiers.developing.length > 0) {
      html += '<div style="color:' + orange + ';font-size:0.42rem;margin-top:4px">DEVELOPING</div>';
      for (var b = 0; b < _tiers.developing.length; b++) {
        html += _renderItem(_tiers.developing[b], orange, dimText, dim);
      }
    }

    // WATCH (only show if no immediate to save space)
    if (_tiers.watch.length > 0 && _tiers.immediate.length === 0) {
      html += '<div style="color:' + teal + ';font-size:0.42rem;margin-top:4px">WATCH</div>';
      for (var w = 0; w < Math.min(_tiers.watch.length, 2); w++) {
        html += _renderItem(_tiers.watch[w], teal, dimText, dim);
      }
    }

    // Gate visibility behind panel state manager — hide if no manager present
    if (!window.LIMENPanelState || !window.LIMENPanelState.isVisible('limen-escalation-panel')) {
      return;
    }
    _panelEl.style.display = 'block';
    _panelEl.innerHTML = html;
  }

  function _renderItem(item, color, dimText, dim) {
    var confPct = Math.round(item.confidence * 100);
    // Source status for this item
    var audit = window.LIMENSourceAudit || {};
    var statusLabel = 'FALLBACK';
    if (item.type === 'domain' && audit[item.domain]) {
      statusLabel = audit[item.domain].status || 'FALLBACK';
    } else if (item.type === 'cross-domain') {
      // Use best status from involved domains
      var parts = item.domain.split('+');
      var hasLive = false;
      var hasPartial = false;
      for (var p = 0; p < parts.length; p++) {
        var a = audit[parts[p]];
        if (a && a.status === 'LIVE') hasLive = true;
        else if (a && a.status === 'PARTIAL') hasPartial = true;
      }
      statusLabel = hasLive ? 'LIVE' : (hasPartial ? 'PARTIAL' : 'FALLBACK');
    }
    var teal = '#5ab5a0';
    var orange = '#d4a44e';
    var red = '#e85454';
    var statusColor = statusLabel === 'LIVE' ? teal : (statusLabel === 'PARTIAL' ? orange : red);
    var dataType = statusLabel === 'LIVE' ? 'raw' : (statusLabel === 'PARTIAL' ? 'mixed' : 'inferred');

    var html = '<div style="margin-left:6px;margin-bottom:2px">';
    html += '<span style="color:' + color + '">\u2022</span> ';
    html += '<span style="color:' + dimText + '">' + _truncate(item.label, 28) + '</span>';
    html += '<br><span style="color:' + dim + ';margin-left:10px;font-size:0.38rem">';
    html += item.domain + ' \u2022 ' + confPct + '% \u2022 ' + item.freshness;
    html += ' \u2022 <span style="color:' + statusColor + '">' + statusLabel + '</span>';
    html += ' \u2022 ' + dataType;
    html += '</span>';
    html += '</div>';
    return html;
  }

  // ─── Narrator integration ─────────────────────────────────────────────

  function _onEscalationShift(e) {
    var detail = e.detail;
    if (!detail || detail.direction !== 'escalating') return;

    var imm = detail.immediate || [];
    var dev = detail.developing || [];
    var drivers = [];

    if (imm.length > 0) {
      drivers.push('Immediate:');
      for (var i = 0; i < imm.length; i++) {
        drivers.push('\u2022 ' + imm[i].label);
      }
    }
    if (dev.length > 0) {
      drivers.push('Developing:');
      for (var d = 0; d < Math.min(dev.length, 2); d++) {
        drivers.push('\u2022 ' + dev[d].label);
      }
    }

    // Build focus options from involved domains
    var seenDomains = {};
    var options = [];
    var allItems = imm.concat(dev);
    for (var o = 0; o < allItems.length && options.length < 3; o++) {
      var dk = allItems[o].domain;
      if (dk && !seenDomains[dk]) {
        seenDomains[dk] = true;
        options.push({ label: dk, type: 'analysis' });
      }
    }
    options.push({ label: 'systemwide', type: 'monitoring' });
    options.push({ label: 'hold', type: 'monitoring' });

    _dispatch('limen:phase-change', {
      from: 'nominal',
      to: 'escalating',
      type: 'escalation',
      topDrivers: drivers,
      options: options
    });
  }

  // ─── Event listener ──────────────────────────────────────────────────────

  function _onDomainUpdate() {
    _compute();
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  function start() {
    if (_interval) return;
    var fs = window.LIMENFeedState;
    if (fs && typeof fs.onHydrated === 'function') {
      fs.onHydrated(function () {
        window.addEventListener('limen:domain-update', _onDomainUpdate);
        window.addEventListener('limen:escalation-shift', _onEscalationShift);
        _compute();
        _interval = setInterval(function () { if (!document.hidden) _compute(); }, UPDATE_MS);
      });
    } else {
      window.addEventListener('limen:domain-update', _onDomainUpdate);
      window.addEventListener('limen:escalation-shift', _onEscalationShift);
      _compute();
      _interval = setInterval(function () { if (!document.hidden) _compute(); }, UPDATE_MS);
    }
  }

  function stop() {
    if (_interval) {
      clearInterval(_interval);
      _interval = null;
    }
    window.removeEventListener('limen:domain-update', _onDomainUpdate);
    window.removeEventListener('limen:escalation-shift', _onEscalationShift);
    if (_panelEl) _panelEl.style.display = 'none';
  }

  // ─── Utilities ───────────────────────────────────────────────────────────

  function _clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function _round(v) { return Math.round(v * 100) / 100; }

  function _freshness(ts) {
    if (!ts) return 'unknown';
    var age = Date.now() - ts;
    if (age < 60000) return 'just now';
    if (age < 3600000) return Math.floor(age / 60000) + 'm ago';
    if (age < 86400000) return Math.floor(age / 3600000) + 'h ago';
    return Math.floor(age / 86400000) + 'd ago';
  }

  function _truncate(str, max) {
    if (!str) return '';
    if (str.length <= max) return str;
    return str.substring(0, max - 1) + '\u2026';
  }

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  window.LIMENEscalation = {
    tiers: { immediate: [], developing: [], watch: [] },
    itemCount: 0,
    immediateCount: 0,
    updated: null
  };

  window.LIMENEscalationConsole = {
    start: start,
    stop: stop
  };

})();
