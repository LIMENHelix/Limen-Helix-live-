/**
 * LIMEN Domain Repair Map — Visual Component
 *
 * Renders a visual panel showing 20 civilization domains (DOMAINS array
 * below) with:
 *   - stress score bars
 *   - propagation depth indicators
 *   - dominant signals
 *   - recommended interventions
 *
 * Read-only consumer of domain/recommendation data.
 *
 * Gate B #9a — Source/measurement authority layer added 2026-06-01.
 * Map-level body suppression when window.LIMENDomains is absent or empty.
 * Per-domain ABSENT card when no measurement is present (replaces the
 * earlier zero-default rendering which would paint 0% bars + "unknown"
 * trend as if measured). Per-domain confidence badge above body when
 * confidence falls below 0.65 (LOW < 0.4, MODERATE < 0.65, FULL >= 0.65).
 *
 * Doctrine carried:
 *   Reliability signals govern rendering, not just display adjacent.
 *   (See feedback_panel_authority_vs_content_validation in operator memory.)
 *
 * Depends on:
 *   window.LIMENDomains
 *   window.LIMENRegulationReports
 *   window.LIMENReportSynthesizer
 *   window.LIMENRemedyRegistryManager
 *   window.LIMENRegulationRenderer  (optional, for compact regulation block)
 *   window.LIMENRegulationOutput     (optional)
 *   window.LIMENLongMemory           (optional, for regime tag)
 *
 * Exposes: window.LIMENDomainRepairMap
 */
(function () {
  'use strict';

  var _container = null;
  var _data = null;

  var DOMAINS = ['economy', 'energy', 'environment', 'health', 'technology', 'research', 'supplyChain', 'governance', 'infrastructure', 'agriculture', 'industry', 'education', 'communication', 'culture', 'defense', 'religion', 'population', 'law', 'finance', 'intelligence'];

  var DOMAIN_LABELS = {
    economy: 'Economy',
    energy: 'Energy',
    environment: 'Environment',
    health: 'Health',
    technology: 'Technology',
    research: 'Research',
    supplyChain: 'Supply Chain',
    governance: 'Governance',
    infrastructure: 'Infrastructure',
    agriculture: 'Agriculture',
    industry: 'Industry',
    education: 'Education',
    communication: 'Communication',
    culture: 'Culture',
    defense: 'Defense',
    religion: 'Religion',
    population: 'Population',
    law: 'Law',
    finance: 'Finance',
    intelligence: 'Intelligence'
  };

  var DOMAIN_ICONS = {
    economy: '\u25B2',     // triangle
    energy: '\u26A1',      // lightning
    environment: '\u25CF', // circle
    health: '\u2665',      // heart
    technology: '\u2699',  // gear
    research: '\u2606',    // star
    supplyChain: '\u21C4', // arrows
    governance: '\u2690',
    infrastructure: '\u2692',
    agriculture: '\u2618',
    industry: '\u2699',
    education: '\u270E',
    communication: '\u260E',
    culture: '\u266B',
    defense: '\u2694',
    religion: '\u2721',
    population: '\u2302',
    law: '\u2696',
    finance: '\u00A4',
    intelligence: '\u26A0'
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Styling
  // ═══════════════════════════════════════════════════════════════════════════

  function _injectStyles() {
    if (document.getElementById('limen-domain-repair-css')) return;
    var style = document.createElement('style');
    style.id = 'limen-domain-repair-css';
    style.textContent = [
      '.ldr-container { font-family:"IBM Plex Mono",monospace; color:#d0cec8; }',
      '.ldr-title { font-size:0.7rem; letter-spacing:2px; text-transform:uppercase; color:#C9A94E;',
      '  margin:0 0 12px; padding-bottom:6px; border-bottom:1px solid rgba(201,169,78,0.12); }',
      '.ldr-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }',
      '@media (max-width:600px) { .ldr-grid { grid-template-columns:1fr; } }',
      '.ldr-card { background:#181a20; border:1px solid rgba(201,169,78,0.08); border-radius:4px;',
      '  padding:10px 12px; transition:border-color 0.3s; }',
      '.ldr-card.stressed { border-left:3px solid #e85454; }',
      '.ldr-card.elevated { border-left:3px solid #FF9800; }',
      '.ldr-card.stable { border-left:3px solid #4CAF50; }',
      '.ldr-card-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }',
      '.ldr-domain-name { font-size:0.68rem; letter-spacing:1px; text-transform:uppercase; color:#C9A94E; }',
      '.ldr-domain-icon { font-size:0.8rem; opacity:0.5; }',
      '.ldr-bar-row { display:flex; align-items:center; gap:6px; margin:3px 0; }',
      '.ldr-bar-label { width:55px; font-size:0.55rem; color:#888; text-transform:uppercase; letter-spacing:0.5px; }',
      '.ldr-bar-track { flex:1; height:4px; background:rgba(255,255,255,0.06); border-radius:2px; overflow:hidden; }',
      '.ldr-bar-fill { height:100%; border-radius:2px; transition:width 0.5s ease; }',
      '.ldr-bar-fill.stress-fill { background:linear-gradient(90deg,#4a8fd4,#FF9800,#e85454); }',
      '.ldr-bar-fill.conf-fill { background:linear-gradient(90deg,#F44336,#FF9800,#4CAF50); }',
      '.ldr-bar-value { width:36px; text-align:right; font-size:0.55rem; color:#999; }',
      '.ldr-signal { font-size:0.55rem; color:#999; margin:2px 0; padding-left:8px;',
      '  border-left:2px solid rgba(201,169,78,0.1); }',
      '.ldr-signal.active { border-left-color:#C9A94E; color:#bbb; }',
      '.ldr-intervention { font-size:0.55rem; color:#C9A94E; margin:4px 0 0; padding:4px 8px;',
      '  background:rgba(201,169,78,0.06); border-radius:2px; }',
      '.ldr-trend { font-size:0.55rem; display:inline-block; margin-left:4px; }',
      '.ldr-trend.rising { color:#e85454; }',
      '.ldr-trend.declining { color:#4a8fd4; }',
      '.ldr-trend.stable { color:#888; }',

      /* Gate B #9a — authority badges + suppression */
      '.ldr-map-suppress { padding:18px 16px; border:1px solid rgba(232,84,84,0.3); background:rgba(232,84,84,0.04); border-radius:4px; text-align:center; }',
      '.ldr-map-suppress-title { font-size:0.5rem; letter-spacing:1.5px; color:#e85454; text-transform:uppercase; margin-bottom:6px; }',
      '.ldr-map-suppress-reason { font-size:0.4rem; color:rgba(220,215,200,0.55); line-height:1.5; }',
      '.ldr-card.absent { border-left:3px solid rgba(232,84,84,0.5); opacity:0.7; }',
      '.ldr-absent-banner { font-size:0.5rem; letter-spacing:1.5px; color:#e85454; text-transform:uppercase; padding:6px 0 2px; }',
      '.ldr-absent-reason { font-size:0.45rem; color:rgba(220,215,200,0.45); margin-top:2px; line-height:1.4; }',
      '.ldr-conf-badge { font-size:0.45rem; letter-spacing:1.5px; padding:3px 6px; border-radius:2px; margin:4px 0 6px; text-transform:uppercase; display:inline-block; }',
      '.ldr-conf-badge.low { color:#e85454; background:rgba(232,84,84,0.07); border:1px solid rgba(232,84,84,0.25); }',
      '.ldr-conf-badge.moderate { color:#FF9800; background:rgba(255,152,0,0.06); border:1px solid rgba(255,152,0,0.25); }'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Gate B #9a — authority classification
  //
  // Doctrine: reliability signals govern rendering, not just display adjacent.
  // Map-level: suppress whole map when source (window.LIMENDomains) absent.
  // Per-domain: replace zero-default render with explicit ABSENT card when the
  //   domain has no measurement of any kind.
  // Per-domain visual downgrade: confidence < 0.65 surfaces a badge above the
  //   body content. Body remains visible at all confidence levels — this is
  //   downgrade, not suppression.
  // ═══════════════════════════════════════════════════════════════════════════

  function _classifyMapAuthority() {
    var src = window.LIMENDomains;
    if (src == null) {
      return {
        level: 'NO_SOURCE',
        title: 'DOMAIN DATA NOT AVAILABLE',
        reason: 'window.LIMENDomains is not loaded. The Domain Repair Map requires the domain data pipeline to be populated before it can render.',
        suppressBody: true
      };
    }
    if (typeof src !== 'object' || Array.isArray(src)) {
      return {
        level: 'NO_SOURCE',
        title: 'DOMAIN DATA SHAPE INVALID',
        reason: 'window.LIMENDomains is not an object map. Expected { domainKey: data, ... }.',
        suppressBody: true
      };
    }
    if (Object.keys(src).length === 0) {
      return {
        level: 'NO_SOURCE',
        title: 'DOMAIN DATA EMPTY',
        reason: 'window.LIMENDomains is an empty object — no domain entries available to render.',
        suppressBody: true
      };
    }
    return { level: 'OK', title: null, reason: null, suppressBody: false };
  }

  // A "measurement" is any non-zero stress, non-zero confidence, or any non-
  // empty signals / interventions / diagnoses array. A card with all-zero,
  // all-empty data is treated as ABSENT — the earlier behavior of rendering
  // zero-default bars + "unknown" trend made absent domains look measured.
  function _hasMeasurement(info) {
    if (!info) return false;
    if (typeof info.stress === 'number' && info.stress > 0) return true;
    if (typeof info.confidence === 'number' && info.confidence > 0) return true;
    if (Array.isArray(info.signals) && info.signals.length > 0) return true;
    if (Array.isArray(info.interventions) && info.interventions.length > 0) return true;
    if (Array.isArray(info.diagnoses) && info.diagnoses.length > 0) return true;
    return false;
  }

  function _classifyCardAuthority(domainKey, info) {
    if (!info || !_hasMeasurement(info)) {
      return {
        level: 'ABSENT',
        badge: null,
        suppressBody: true,
        reason: 'No measurement available for ' + (DOMAIN_LABELS[domainKey] || domainKey) + '.'
      };
    }
    var conf = typeof info.confidence === 'number' ? info.confidence : 0;
    if (conf < 0.4) {
      return {
        level: 'LOW_CONFIDENCE',
        badge: 'LOW CONFIDENCE · ' + Math.round(conf * 100) + '%',
        suppressBody: false,
        reason: null
      };
    }
    if (conf < 0.65) {
      return {
        level: 'MODERATE_CONFIDENCE',
        badge: 'MODERATE CONFIDENCE · ' + Math.round(conf * 100) + '%',
        suppressBody: false,
        reason: null
      };
    }
    return { level: 'FULL', badge: null, suppressBody: false, reason: null };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Rendering
  // ═══════════════════════════════════════════════════════════════════════════

  function render(targetEl, reportData) {
    _injectStyles();

    var el = typeof targetEl === 'string' ? document.getElementById(targetEl) : targetEl;
    if (!el) {
      el = document.createElement('div');
      el.id = 'limen-domain-repair-map';
    }
    _container = el;

    el.className = 'ldr-container';
    el.innerHTML = '';

    var title = document.createElement('div');
    title.className = 'ldr-title';
    title.textContent = 'Domain Repair Map';
    el.appendChild(title);

    // Gate B #9a — map-level source-absent suppression. If the caller passed
    // reportData explicitly, trust it as data; otherwise gather from the
    // pipeline globals and check whether window.LIMENDomains is present.
    if (reportData) {
      _data = reportData;
    } else {
      var mapAuth = _classifyMapAuthority();
      if (mapAuth.suppressBody) {
        var sup = document.createElement('div');
        sup.className = 'ldr-map-suppress';
        var sTitle = document.createElement('div');
        sTitle.className = 'ldr-map-suppress-title';
        sTitle.textContent = mapAuth.title;
        var sReason = document.createElement('div');
        sReason.className = 'ldr-map-suppress-reason';
        sReason.textContent = mapAuth.reason;
        sup.appendChild(sTitle);
        sup.appendChild(sReason);
        el.appendChild(sup);
        return el;
      }
      _data = _gatherData();
    }

    var grid = document.createElement('div');
    grid.className = 'ldr-grid';

    for (var i = 0; i < DOMAINS.length; i++) {
      grid.appendChild(_renderDomainCard(DOMAINS[i]));
    }

    el.appendChild(grid);
    return el;
  }

  function _renderDomainCard(domainKey) {
    // Gate B #9a — no zero-default fallback. _data[domainKey] either exists
    // with measurement OR the card classifies as ABSENT and renders the
    // explicit "no measurement" variant. Earlier behavior would paint 0%
    // stress + 0% confidence + "unknown" trend as if measured.
    var info = _data[domainKey] || null;
    var cardAuth = _classifyCardAuthority(domainKey, info);

    if (cardAuth.suppressBody) {
      // ABSENT card — minimal render. Operator sees the domain slot is occupied
      // but no measurement is available; not a zero reading.
      var absentCard = document.createElement('div');
      absentCard.className = 'ldr-card absent';
      var absentHeader = document.createElement('div');
      absentHeader.className = 'ldr-card-header';
      absentHeader.innerHTML = '<span class="ldr-domain-name">' + (DOMAIN_LABELS[domainKey] || domainKey) + '</span>' +
        '<span class="ldr-domain-icon">' + (DOMAIN_ICONS[domainKey] || '') + '</span>';
      absentCard.appendChild(absentHeader);
      var absentBanner = document.createElement('div');
      absentBanner.className = 'ldr-absent-banner';
      absentBanner.textContent = 'ABSENT — no measurement';
      absentCard.appendChild(absentBanner);
      var absentReason = document.createElement('div');
      absentReason.className = 'ldr-absent-reason';
      absentReason.textContent = cardAuth.reason;
      absentCard.appendChild(absentReason);
      return absentCard;
    }

    var stressClass = info.stress > 0.65 ? 'stressed' : (info.stress > 0.4 ? 'elevated' : 'stable');
    var trendClass = info.trend === 'rising' ? 'rising' : (info.trend === 'declining' ? 'declining' : 'stable');

    var card = document.createElement('div');
    card.className = 'ldr-card ' + stressClass;

    // Header
    var header = document.createElement('div');
    header.className = 'ldr-card-header';
    header.innerHTML = '<span class="ldr-domain-name">' + (DOMAIN_LABELS[domainKey] || domainKey) + '</span>' +
      '<span class="ldr-domain-icon">' + (DOMAIN_ICONS[domainKey] || '') + '</span>';
    card.appendChild(header);

    // Gate B #9a — confidence authority badge above the body content.
    // Visual downgrade only; body stays visible at all confidence levels.
    if (cardAuth.badge) {
      var badge = document.createElement('div');
      var badgeClass = cardAuth.level === 'LOW_CONFIDENCE' ? 'low' : 'moderate';
      badge.className = 'ldr-conf-badge ' + badgeClass;
      badge.textContent = cardAuth.badge;
      card.appendChild(badge);
    }

    // Stress bar
    card.appendChild(_barRow('Stress', info.stress, 'stress-fill'));

    // Confidence bar
    card.appendChild(_barRow('Conf', info.confidence, 'conf-fill'));

    // Trend + long-term regime tag
    var trendEl = document.createElement('div');
    trendEl.style.cssText = 'font-size:0.55rem;color:#888;margin:2px 0';
    var trendHtml = 'Trend: <span class="ldr-trend ' + trendClass + '">' +
      (info.trend === 'rising' ? '\u2191' : (info.trend === 'declining' ? '\u2193' : '\u2192')) + ' ' + info.trend + '</span>';
    // Append long-term regime tag if available
    var longMem = window.LIMENLongMemory;
    if (longMem && longMem.getRegime) {
      var regime = longMem.getRegime(domainKey, 30);
      if (regime === 'EXTREME') {
        trendHtml += ' <span style="color:#e85454;font-size:0.45rem;letter-spacing:0.5px;margin-left:4px">\u26A0 EXTREME</span>';
      } else if (regime === 'ELEVATED') {
        trendHtml += ' <span style="color:#FF9800;font-size:0.45rem;letter-spacing:0.5px;margin-left:4px">ELEVATED</span>';
      }
    }
    trendEl.innerHTML = trendHtml;
    card.appendChild(trendEl);

    // Signals
    var signals = info.signals || [];
    for (var s = 0; s < Math.min(signals.length, 3); s++) {
      var sigEl = document.createElement('div');
      sigEl.className = 'ldr-signal active';
      sigEl.textContent = signals[s];
      card.appendChild(sigEl);
    }

    // Unified regulation output: summary, fractal answer, impact, evidence
    var renderer = window.LIMENRegulationRenderer;
    var regOutput = window.LIMENRegulationOutput;
    if (renderer && renderer.renderCompactRegulation && regOutput && regOutput[domainKey]) {
      renderer.renderCompactRegulation(domainKey, card);
    } else {
      // Fallback: show raw registry data when regulation engine hasn't run
      var diagnoses = info.diagnoses || [];
      if (diagnoses.length > 0) {
        var dxLabel = document.createElement('div');
        dxLabel.style.cssText = 'font-size:0.5rem;letter-spacing:1px;text-transform:uppercase;color:rgba(201,169,78,0.5);margin:4px 0 2px;';
        dxLabel.textContent = 'Diagnoses';
        card.appendChild(dxLabel);
        for (var dx = 0; dx < diagnoses.length; dx++) {
          var dxEl = document.createElement('div');
          dxEl.className = 'ldr-signal active';
          dxEl.textContent = diagnoses[dx];
          card.appendChild(dxEl);
        }
      }
      var interventions = info.interventions || [];
      if (interventions.length > 0) {
        var txLabel = document.createElement('div');
        txLabel.style.cssText = 'font-size:0.5rem;letter-spacing:1px;text-transform:uppercase;color:rgba(201,169,78,0.5);margin:4px 0 2px;';
        txLabel.textContent = 'Treatments';
        card.appendChild(txLabel);
        for (var iv = 0; iv < Math.min(interventions.length, 3); iv++) {
          var intEl = document.createElement('div');
          intEl.className = 'ldr-intervention';
          intEl.textContent = '\u2192 ' + interventions[iv];
          card.appendChild(intEl);
        }
      } else {
        var emptyEl = document.createElement('div');
        emptyEl.style.cssText = 'font-size:0.5rem;color:#555;font-style:italic;margin:4px 0;';
        emptyEl.textContent = 'registry empty';
        card.appendChild(emptyEl);
      }
      var steps = info.steps || [];
      if (steps.length > 0) {
        var stLabel = document.createElement('div');
        stLabel.style.cssText = 'font-size:0.5rem;letter-spacing:1px;text-transform:uppercase;color:rgba(201,169,78,0.5);margin:4px 0 2px;';
        stLabel.textContent = 'Next Steps';
        card.appendChild(stLabel);
        for (var st = 0; st < Math.min(steps.length, 3); st++) {
          var stEl = document.createElement('div');
          stEl.className = 'ldr-signal';
          stEl.style.fontSize = '0.5rem';
          stEl.textContent = steps[st];
          card.appendChild(stEl);
        }
      }
    }

    return card;
  }

  function _barRow(label, value, fillClass) {
    var row = document.createElement('div');
    row.className = 'ldr-bar-row';
    row.innerHTML = '<span class="ldr-bar-label">' + label + '</span>';
    var track = document.createElement('div');
    track.className = 'ldr-bar-track';
    var fill = document.createElement('div');
    fill.className = 'ldr-bar-fill ' + fillClass;
    fill.style.width = (Math.min(value, 1) * 100) + '%';
    track.appendChild(fill);
    row.appendChild(track);
    var val = document.createElement('span');
    val.className = 'ldr-bar-value';
    val.textContent = value.toFixed(2);
    row.appendChild(val);
    return row;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Data gathering
  // ═══════════════════════════════════════════════════════════════════════════

  function _gatherData() {
    var domains = window.LIMENDomains || {};
    var data = {};

    for (var i = 0; i < DOMAINS.length; i++) {
      var dk = DOMAINS[i];
      var d = domains[dk] || {};
      var trend = 'unknown';
      if (d.trend > 0.03) trend = 'rising';
      else if (d.trend < -0.03) trend = 'declining';
      else if (d.trend !== undefined) trend = 'stable';

      var signals = [];
      if (d.signals && d.signals.length > 0) {
        for (var s = 0; s < Math.min(d.signals.length, 3); s++) {
          signals.push(typeof d.signals[s] === 'string' ? d.signals[s] : (d.signals[s].type || d.signals[s].name || ''));
        }
      }
      if (d.stress > 0.65) signals.push('elevated stress');
      if (trend === 'rising' && d.stress > 0.4) signals.push('upward pressure');

      // Get interventions from registry first, then fall back to regulation reports
      var interventions = [];
      var diagnoses = [];
      var steps = [];
      var mgr = window.LIMENRemedyRegistryManager;
      if (mgr) {
        // Query registry for prioritized treatments
        var txList = mgr.getTreatmentsOnDomainStress(dk, d.stress || 0);
        var stressCtx = {};
        stressCtx[dk] = d.stress || 0;
        var prioritized = mgr.prioritize(txList, { domainStress: stressCtx });
        for (var ti = 0; ti < Math.min(prioritized.length, 3); ti++) {
          interventions.push(prioritized[ti].title);
          // Collect steps from top treatments
          var txSteps = prioritized[ti].steps || [];
          for (var tsi = 0; tsi < Math.min(txSteps.length, 2); tsi++) {
            steps.push('[' + txSteps[tsi].sequence + '] ' + txSteps[tsi].action);
          }
        }
        // Query diagnoses
        var dxList = mgr.getDiagnosesForDomain(dk);
        for (var dxi = 0; dxi < Math.min(dxList.length, 2); dxi++) {
          diagnoses.push(dxList[dxi].severity + ': ' + dxList[dxi].title);
        }
      }

      // Fallback: regulation reports library
      if (interventions.length === 0) {
        var regReports = window.LIMENRegulationReports;
        if (regReports && regReports.getLibrary && regReports.getLibrary()) {
          var lib = regReports.getLibrary();
          if (lib.entries) {
            for (var e = 0; e < lib.entries.length; e++) {
              if (lib.entries[e].domain === dk) {
                var rems = lib.entries[e].remedy || [];
                for (var r = 0; r < rems.length; r++) {
                  interventions.push(rems[r]);
                }
              }
            }
          }
        }
      }

      data[dk] = {
        stress: d.stress || 0,
        trend: trend,
        confidence: d.confidence || 0,
        signals: signals,
        interventions: interventions,
        diagnoses: diagnoses,
        steps: steps,
        sources: d.sources || []
      };
    }

    return data;
  }

  function update(reportData) {
    if (_container) {
      render(_container, reportData);
    }
  }

  // Event listener
  if (typeof window !== 'undefined') {
    window.addEventListener('limen:domain-update', function () {
      if (_container) update();
    });
    window.addEventListener('limen:regulation-ready', function () {
      if (_container) update();
    });
    window.addEventListener('limen:report-update', function (e) {
      if (_container && e.detail && e.detail.reports && e.detail.reports.domain) {
        var dr = e.detail.reports.domain;
        if (dr.domainStress) update(dr.domainStress);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════════════════

  function detach() {
    _container = null;
  }

  window.LIMENDomainRepairMap = {
    render:  render,
    update:  update,
    detach:  detach,
    DOMAINS: DOMAINS
  };

})();
