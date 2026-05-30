/**
 * LIMEN Domain Repair Map — Visual Component
 *
 * Renders a visual panel showing 7 civilization domains with:
 *   - stress score bars
 *   - propagation depth indicators
 *   - dominant signals
 *   - recommended interventions
 *
 * Read-only consumer of domain/recommendation data.
 *
 * Depends on:
 *   window.LIMENDomains
 *   window.LIMENRegulationReports
 *   window.LIMENReportSynthesizer
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
      '.ldr-trend.stable { color:#888; }'
    ].join('\n');
    document.head.appendChild(style);
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
    _data = reportData || _gatherData();

    el.className = 'ldr-container';
    el.innerHTML = '';

    var title = document.createElement('div');
    title.className = 'ldr-title';
    title.textContent = 'Domain Repair Map';
    el.appendChild(title);

    var grid = document.createElement('div');
    grid.className = 'ldr-grid';

    for (var i = 0; i < DOMAINS.length; i++) {
      grid.appendChild(_renderDomainCard(DOMAINS[i]));
    }

    el.appendChild(grid);
    return el;
  }

  function _renderDomainCard(domainKey) {
    var info = _data[domainKey] || { stress: 0, trend: 'unknown', confidence: 0, signals: [], interventions: [] };
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
