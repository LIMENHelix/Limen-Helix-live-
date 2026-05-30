/**
 * LIMEN Report Console — UI Panel Renderer
 *
 * Subscribes to recommendation + report events and renders
 * live panels inside a report console overlay.
 *
 * Panels:
 *   RECOMMENDATIONS    — pattern, remedies, confidence, urgency
 *   DOMAIN REPAIR      — domainRepairReport signals
 *   CIVILIZATION REPORT — global state, drivers, cross-scale
 *   PATENT OPPORTUNITIES — filing gaps, novelty, convergence
 *   EVIDENCE CHAIN      — full reasoning pipeline visualization
 *
 * Does NOT modify any locked engine. Read-only consumer.
 *
 * Depends on:
 *   window.LIMENReportSynthesizer
 *   window.LIMENRecommendationEngine
 *   window.LIMENDomains
 *   window.LIMENGlobalState
 *
 * Exposes: window.LIMENReportConsole
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════════════════════════════

  var _container = null;
  var _visible = false;
  var _currentReports = null;
  var _currentRecSet = null;
  var _activeTab = 'recommendations';

  var TABS = [
    { id: 'recommendations',   label: 'Recommendations' },
    { id: 'domain-repair',     label: 'Domain Repair' },
    { id: 'civilization',      label: 'Civilization' },
    { id: 'patent',            label: 'Patent Opportunities' },
    { id: 'evidence-chain',    label: 'Evidence Chain' }
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // DOM Construction
  // ═══════════════════════════════════════════════════════════════════════════

  function _injectStyles() {
    if (document.getElementById('limen-report-console-css')) return;
    var style = document.createElement('style');
    style.id = 'limen-report-console-css';
    style.textContent = [
      '.lrc-overlay { position:fixed; top:0; left:0; width:100%; height:100%; z-index:9000;',
      '  background:rgba(12,13,16,0.92); display:none; overflow:auto; font-family:"IBM Plex Mono",monospace; color:#d0cec8; }',
      '.lrc-overlay.active { display:flex; flex-direction:column; }',
      '.lrc-header { display:flex; align-items:center; justify-content:space-between; padding:12px 24px;',
      '  border-bottom:1px solid rgba(201,169,78,0.15); background:#131519; flex-shrink:0; }',
      '.lrc-header h2 { margin:0; font-size:0.85rem; letter-spacing:2px; text-transform:uppercase; color:#C9A94E; }',
      '.lrc-close { background:none; border:1px solid rgba(201,169,78,0.25); color:#C9A94E; cursor:pointer;',
      '  padding:4px 12px; font-size:0.7rem; letter-spacing:1px; text-transform:uppercase; font-family:inherit; }',
      '.lrc-close:hover { background:rgba(201,169,78,0.12); }',
      '.lrc-tabs { display:flex; gap:0; border-bottom:1px solid rgba(201,169,78,0.1); background:#111318; flex-shrink:0; }',
      '.lrc-tab { padding:8px 16px; font-size:0.65rem; letter-spacing:1px; text-transform:uppercase; cursor:pointer;',
      '  color:#888; border:none; background:none; border-bottom:2px solid transparent; font-family:inherit; }',
      '.lrc-tab:hover { color:#C9A94E; }',
      '.lrc-tab.active { color:#C9A94E; border-bottom-color:#C9A94E; }',
      '.lrc-body { flex:1; overflow:auto; padding:16px 24px; }',
      '.lrc-panel { display:none; }',
      '.lrc-panel.active { display:block; }',
      '.lrc-card { background:#181a20; border:1px solid rgba(201,169,78,0.08); border-radius:4px;',
      '  padding:12px 16px; margin-bottom:12px; }',
      '.lrc-card-title { font-size:0.7rem; letter-spacing:2px; text-transform:uppercase; color:#C9A94E;',
      '  margin:0 0 8px 0; padding-bottom:4px; border-bottom:1px solid rgba(201,169,78,0.08); }',
      '.lrc-row { display:flex; justify-content:space-between; padding:3px 0; font-size:0.68rem; }',
      '.lrc-label { color:#888; }',
      '.lrc-value { color:#d0cec8; }',
      '.lrc-value.high { color:#4CAF50; }',
      '.lrc-value.moderate { color:#FF9800; }',
      '.lrc-value.low { color:#F44336; }',
      '.lrc-value.insufficient { color:#9E9E9E; }',
      '.lrc-value.hyper { color:#e85454; }',
      '.lrc-value.hypo { color:#4a8fd4; }',
      '.lrc-chain { position:relative; padding-left:20px; }',
      '.lrc-chain-step { position:relative; padding:8px 0 8px 16px; font-size:0.65rem; border-left:2px solid rgba(201,169,78,0.15); }',
      '.lrc-chain-step:before { content:""; position:absolute; left:-5px; top:12px; width:8px; height:8px;',
      '  border-radius:50%; background:#C9A94E; border:2px solid #131519; }',
      '.lrc-chain-step .lrc-step-label { color:#C9A94E; text-transform:uppercase; letter-spacing:1px; font-size:0.6rem; }',
      '.lrc-chain-step .lrc-step-detail { color:#999; margin-top:2px; }',
      '.lrc-chain-arrow { color:rgba(201,169,78,0.3); text-align:center; font-size:0.6rem; padding:2px 0; }',
      '.lrc-signal-bar { display:flex; align-items:center; gap:8px; margin:4px 0; }',
      '.lrc-bar-track { flex:1; height:4px; background:rgba(255,255,255,0.06); border-radius:2px; overflow:hidden; }',
      '.lrc-bar-fill { height:100%; border-radius:2px; transition:width 0.3s ease; }',
      '.lrc-bar-fill.stress { background:linear-gradient(90deg,#4a8fd4,#e85454); }',
      '.lrc-bar-fill.confidence { background:linear-gradient(90deg,#F44336,#FF9800,#4CAF50); }',
      '.lrc-bar-fill.opportunity { background:linear-gradient(90deg,#4a8fd4,#C9A94E); }',
      '.lrc-empty { color:#555; font-size:0.65rem; font-style:italic; padding:20px; text-align:center; }',
      '.lrc-actions-list { list-style:none; padding:0; margin:4px 0; }',
      '.lrc-actions-list li { padding:4px 0 4px 12px; font-size:0.65rem; color:#bbb;',
      '  border-left:2px solid rgba(201,169,78,0.12); margin-bottom:2px; }',
      '.lrc-actions-list li:before { content:"→ "; color:#C9A94E; }',
      '.lrc-toolbar { display:flex; gap:8px; padding:8px 24px; border-top:1px solid rgba(201,169,78,0.1);',
      '  background:#111318; flex-shrink:0; }',
      '.lrc-btn { background:rgba(201,169,78,0.08); border:1px solid rgba(201,169,78,0.2); color:#C9A94E;',
      '  padding:6px 14px; font-size:0.62rem; letter-spacing:1px; text-transform:uppercase; cursor:pointer; font-family:inherit; }',
      '.lrc-btn:hover { background:rgba(201,169,78,0.18); }',
      '@media print { .lrc-overlay { position:static; display:block!important; background:#fff; color:#111; }',
      '  .lrc-header, .lrc-tabs, .lrc-toolbar, .lrc-close { display:none!important; }',
      '  .lrc-panel { display:block!important; } .lrc-card { border-color:#ccc; break-inside:avoid; }',
      '  .lrc-card-title { color:#333; } .lrc-row { color:#333; } .lrc-label { color:#666; } }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function _buildDOM() {
    if (_container) return _container;
    _injectStyles();

    _container = document.createElement('div');
    _container.className = 'lrc-overlay';
    _container.id = 'limen-report-console';

    // Header
    var header = document.createElement('div');
    header.className = 'lrc-header';
    header.innerHTML = '<h2>LIMEN Insight &amp; Regulation Reports</h2>';
    var closeBtn = document.createElement('button');
    closeBtn.className = 'lrc-close';
    closeBtn.textContent = 'CLOSE [ESC]';
    closeBtn.onclick = function () { hide(); };
    header.appendChild(closeBtn);
    _container.appendChild(header);

    // Tabs
    var tabBar = document.createElement('div');
    tabBar.className = 'lrc-tabs';
    for (var i = 0; i < TABS.length; i++) {
      var tab = document.createElement('button');
      tab.className = 'lrc-tab' + (TABS[i].id === _activeTab ? ' active' : '');
      tab.textContent = TABS[i].label;
      tab.dataset.tab = TABS[i].id;
      tab.onclick = _onTabClick;
      tabBar.appendChild(tab);
    }
    _container.appendChild(tabBar);

    // Body
    var body = document.createElement('div');
    body.className = 'lrc-body';
    for (var j = 0; j < TABS.length; j++) {
      var panel = document.createElement('div');
      panel.className = 'lrc-panel' + (TABS[j].id === _activeTab ? ' active' : '');
      panel.id = 'lrc-panel-' + TABS[j].id;
      body.appendChild(panel);
    }
    _container.appendChild(body);

    // Toolbar
    var toolbar = document.createElement('div');
    toolbar.className = 'lrc-toolbar';

    var btnRefresh = _btn('Refresh', function () {
      _triggerRefresh();
    });
    var btnPrintCurrent = _btn('Print Current Tab', function () {
      _printCurrentTab();
    });
    var btnPrintAll = _btn('Print All Reports', function () {
      _printAll();
    });
    var btnJSON = _btn('Export JSON', function () {
      _exportJSON();
    });
    var btnHTML = _btn('Export HTML', function () {
      _exportHTML();
    });
    toolbar.appendChild(btnRefresh);
    toolbar.appendChild(btnPrintCurrent);
    toolbar.appendChild(btnPrintAll);
    toolbar.appendChild(btnJSON);
    toolbar.appendChild(btnHTML);
    _container.appendChild(toolbar);

    document.body.appendChild(_container);

    // ESC to close
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && _visible) hide();
    });

    return _container;
  }

  function _btn(label, onclick) {
    var b = document.createElement('button');
    b.className = 'lrc-btn';
    b.textContent = label;
    b.onclick = onclick;
    return b;
  }

  function _onTabClick(e) {
    _activeTab = e.target.dataset.tab;
    var tabs = _container.querySelectorAll('.lrc-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].className = 'lrc-tab' + (tabs[i].dataset.tab === _activeTab ? ' active' : '');
    }
    var panels = _container.querySelectorAll('.lrc-panel');
    for (var j = 0; j < panels.length; j++) {
      panels[j].className = 'lrc-panel' + (panels[j].id === 'lrc-panel-' + _activeTab ? ' active' : '');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Panel Renderers
  // ═══════════════════════════════════════════════════════════════════════════

  function _renderRecommendations(recSet, reports) {
    var panel = document.getElementById('lrc-panel-recommendations');
    if (!panel) return;
    panel.innerHTML = '';

    var scales = ['mainUser', 'portalUser', 'business', 'domain', 'civilization'];
    var hasAny = false;

    for (var s = 0; s < scales.length; s++) {
      var recs = recSet[scales[s]] || [];
      if (recs.length === 0) continue;
      hasAny = true;

      for (var r = 0; r < recs.length; r++) {
        var rec = recs[r];
        var card = _card(scales[s].toUpperCase() + ' — ' + (rec.patternClass || '').replace(/_/g, ' '));
        _addRow(card, 'Pattern', rec.patternClass);
        _addRow(card, 'Nodes', (rec.affectedNodes || []).join(', '));
        _addRow(card, 'Systems', (rec.affectedSystems || []).join(', '));

        var tier = rec.confidenceDetail ? rec.confidenceDetail.confidenceTier : 'moderate';
        _addRow(card, 'Confidence', (rec.confidence * 100).toFixed(0) + '% (' + tier + ')', tier);
        _addRow(card, 'Evidence Tier', rec.evidenceEnvelope ? rec.evidenceEnvelope.overallTier : 'n/a');
        _addRow(card, 'Time Horizon', rec.timeHorizon);
        _addRow(card, 'Urgency', rec.urgency.toFixed(2));

        // Remedy
        var actions = rec.recommendedActions || [];
        if (actions.length > 0) {
          var ul = document.createElement('ul');
          ul.className = 'lrc-actions-list';
          for (var a = 0; a < actions.length; a++) {
            var li = document.createElement('li');
            li.textContent = actions[a].text || actions[a].label || actions[a].type || '';
            ul.appendChild(li);
          }
          card.appendChild(ul);
        }

        // Conflicts
        if (rec.conflicts && rec.conflicts.length > 0) {
          _addRow(card, 'Conflicts', rec.conflicts.length + ' detected');
        }

        panel.appendChild(card);
      }
    }

    // MainUser summary from report
    if (reports && reports.mainUser) {
      var mu = reports.mainUser;
      var summaryCard = _card('USER SUMMARY');
      _addRow(summaryCard, 'Headline', mu.summary.headline);
      _addRow(summaryCard, 'Confidence', mu.summary.confidenceLabel);
      _addRow(summaryCard, 'Trajectory', mu.temporal.trajectory);
      if (mu.dataNote) _addRow(summaryCard, 'Data Note', mu.dataNote);
      panel.insertBefore(summaryCard, panel.firstChild);
    }

    if (!hasAny) {
      panel.innerHTML = '<div class="lrc-empty">No recommendations generated yet. Waiting for propagation cycle.</div>';
    }
  }

  function _renderDomainRepair(reports) {
    var panel = document.getElementById('lrc-panel-domain-repair');
    if (!panel) return;
    panel.innerHTML = '';

    var report = reports ? reports.domain : null;
    if (!report) {
      panel.innerHTML = '<div class="lrc-empty">No domain repair report available.</div>';
      return;
    }

    // Summary
    var summaryCard = _card('DOMAIN REPAIR SUMMARY');
    _addRow(summaryCard, 'Pattern', report.summary.patternLabel);
    _addRow(summaryCard, 'Propagation Steps', report.propagationSteps);
    _addRow(summaryCard, 'Converged', report.convergenceAchieved ? 'Yes' : 'No');
    _addRow(summaryCard, 'Confidence', (report.summary.confidence * 100).toFixed(0) + '%', report.summary.confidenceTier);
    _addRow(summaryCard, 'Urgency', report.summary.urgency.toFixed(2));
    panel.appendChild(summaryCard);

    // Domain stress
    var stressCard = _card('DOMAIN STRESS MAP');
    var domains = report.domainStress || {};
    var dk = Object.keys(domains);
    for (var i = 0; i < dk.length; i++) {
      var d = domains[dk[i]];
      var row = document.createElement('div');
      row.className = 'lrc-signal-bar';
      row.innerHTML = '<span class="lrc-label" style="width:90px;font-size:0.62rem">' + dk[i] + '</span>';
      var track = document.createElement('div');
      track.className = 'lrc-bar-track';
      var fill = document.createElement('div');
      fill.className = 'lrc-bar-fill stress';
      fill.style.width = (d.stress * 100) + '%';
      track.appendChild(fill);
      row.appendChild(track);
      var val = document.createElement('span');
      val.className = 'lrc-value';
      val.style.fontSize = '0.6rem';
      val.style.width = '80px';
      val.style.textAlign = 'right';
      val.textContent = d.stress.toFixed(2) + ' ' + d.trend;
      row.appendChild(val);
      stressCard.appendChild(row);
    }
    panel.appendChild(stressCard);

    // Signals
    if (report.signals && report.signals.length > 0) {
      var sigCard = _card('REPAIR SIGNALS');
      for (var s = 0; s < report.signals.length; s++) {
        var sig = report.signals[s];
        _addRow(sigCard, sig.type, sig.narrative);
        if (sig.recommendation) {
          var recEl = document.createElement('div');
          recEl.style.cssText = 'padding:2px 0 6px 12px;font-size:0.6rem;color:#C9A94E;';
          recEl.textContent = '→ ' + sig.recommendation;
          sigCard.appendChild(recEl);
        }
      }
      panel.appendChild(sigCard);
    }

    // ═══ REGISTRY: Portal diagnoses, treatment pathways, step sequences ═══
    _renderRegistrySection(panel, report, 'PORTAL DIAGNOSES & TREATMENT PATHWAYS');

    // Evidence
    _renderEvidence(panel, report.evidence);
  }

  function _renderCivilization(reports) {
    var panel = document.getElementById('lrc-panel-civilization');
    if (!panel) return;
    panel.innerHTML = '';

    var report = reports ? reports.civilization : null;
    if (!report) {
      panel.innerHTML = '<div class="lrc-empty">No civilization report available.</div>';
      return;
    }

    // Global state
    var globalCard = _card('GLOBAL STATE');
    _addRow(globalCard, 'Mode', report.summary.globalMode);
    _addRow(globalCard, 'Score', report.summary.globalScore.toFixed(2));
    _addRow(globalCard, 'Confidence', report.summary.globalConfidence.toFixed(2));
    _addRow(globalCard, 'Top Drivers', (report.summary.topDrivers || []).join(', '));
    _addRow(globalCard, 'Pattern', report.summary.patternLabel);
    _addRow(globalCard, 'Urgency', report.summary.urgency.toFixed(2));
    panel.appendChild(globalCard);

    // Domain overview
    var domCard = _card('DOMAIN OVERVIEW');
    var doms = report.domainOverview || [];
    for (var i = 0; i < doms.length; i++) {
      var d = doms[i];
      var row = document.createElement('div');
      row.className = 'lrc-signal-bar';
      row.innerHTML = '<span class="lrc-label" style="width:90px;font-size:0.62rem">' + d.domain + '</span>';
      var track = document.createElement('div');
      track.className = 'lrc-bar-track';
      var fill = document.createElement('div');
      fill.className = 'lrc-bar-fill stress';
      fill.style.width = (d.stress * 100) + '%';
      track.appendChild(fill);
      row.appendChild(track);
      var val = document.createElement('span');
      val.className = 'lrc-value';
      val.style.fontSize = '0.6rem';
      val.style.width = '80px';
      val.style.textAlign = 'right';
      val.textContent = d.stress.toFixed(2) + ' ' + d.trend;
      row.appendChild(val);
      domCard.appendChild(row);
    }
    panel.appendChild(domCard);

    // Polarity
    if (report.polarity) {
      var polCard = _card('POLARITY');
      _addRow(polCard, 'Overall', report.polarity.overall.toFixed(2));
      _addRow(polCard, 'Trend', report.polarity.trend || 'n/a');
      if (report.polarity.byDomain) {
        var pdk = Object.keys(report.polarity.byDomain);
        for (var p = 0; p < pdk.length; p++) {
          _addRow(polCard, pdk[p], report.polarity.byDomain[pdk[p]].toFixed(2));
        }
      }
      panel.appendChild(polCard);
    }

    // Scale summary
    if (report.scaleSummary) {
      var scaleCard = _card('SCALE SUMMARY');
      _addRow(scaleCard, 'Main User', report.scaleSummary.mainUser);
      _addRow(scaleCard, 'Portal User', report.scaleSummary.portalUser);
      _addRow(scaleCard, 'Business', report.scaleSummary.business);
      _addRow(scaleCard, 'Domain', report.scaleSummary.domain);
      _addRow(scaleCard, 'Civilization', report.scaleSummary.civilization);
      _addRow(scaleCard, 'Total', report.scaleSummary.total);
      panel.appendChild(scaleCard);
    }

    // ═══ REGISTRY: Detected Diagnoses, Treatments, Steps per domain ═══
    _renderRegistrySection(panel, report, 'DETECTED DIAGNOSES & TREATMENTS');

    // Conflicts
    if (report.conflicts && report.conflicts.length > 0) {
      var confCard = _card('CROSS-SCALE CONFLICTS (' + report.conflicts.length + ')');
      for (var c = 0; c < report.conflicts.length; c++) {
        var cf = report.conflicts[c];
        _addRow(confCard, cf.type, cf.scaleA + ' vs ' + cf.scaleB +
          (cf.resolution ? ' → ' + cf.resolution.strategy : ''));
      }
      panel.appendChild(confCard);
    }

    // Evidence
    _renderEvidence(panel, report.evidence);
  }

  function _renderPatent(reports) {
    var panel = document.getElementById('lrc-panel-patent');
    if (!panel) return;
    panel.innerHTML = '';

    var report = reports ? reports.patentOpportunity : null;
    if (!report) {
      panel.innerHTML = '<div class="lrc-empty">No patent opportunity report available.</div>';
      return;
    }

    // Summary
    var summaryCard = _card('PATENT OPPORTUNITY SUMMARY');
    _addRow(summaryCard, 'Opportunity Score', report.summary.opportunityScore.toFixed(2));
    _addRow(summaryCard, 'Signal Count', report.summary.signalCount);
    _addRow(summaryCard, 'Top Domain', report.summary.topDomain || 'none');
    _addRow(summaryCard, 'Tech Hub Activation', report.techHubActivation.toFixed(2));
    _addRow(summaryCard, 'Legal Review', report.legalReviewRequired ? 'Required' : 'Not Required');
    _addRow(summaryCard, 'Confidence', (report.summary.confidence * 100).toFixed(0) + '%', report.summary.confidenceTier);
    panel.appendChild(summaryCard);

    // Signals
    if (report.signals && report.signals.length > 0) {
      var sigCard = _card('PATENT SIGNALS');
      for (var i = 0; i < report.signals.length; i++) {
        var sig = report.signals[i];
        _addRow(sigCard, sig.type.replace(/_/g, ' '), sig.indication);
        if (sig.opportunityScore) {
          var bar = document.createElement('div');
          bar.className = 'lrc-signal-bar';
          bar.innerHTML = '<span class="lrc-label" style="width:60px;font-size:0.58rem">score</span>';
          var track = document.createElement('div');
          track.className = 'lrc-bar-track';
          var fill = document.createElement('div');
          fill.className = 'lrc-bar-fill opportunity';
          fill.style.width = (sig.opportunityScore * 100) + '%';
          track.appendChild(fill);
          bar.appendChild(track);
          sigCard.appendChild(bar);
        }
      }
      panel.appendChild(sigCard);
    }

    // Patent data details
    if (report.patentData) {
      var pd = report.patentData;
      if (pd.noveltySignal) {
        var novCard = _card('NOVELTY SIGNAL');
        _addRow(novCard, 'Spike Detected', pd.noveltySignal.spikeDetected ? 'Yes' : 'No');
        _addRow(novCard, 'Prediction Error', ((pd.noveltySignal.predictionError || 0) * 100).toFixed(0) + '%');
        panel.appendChild(novCard);
      }
      if (pd.convergenceSignal) {
        var convCard = _card('CONVERGENCE SIGNAL');
        _addRow(convCard, 'Detected', pd.convergenceSignal.detected ? 'Yes' : 'No');
        _addRow(convCard, 'Domains', (pd.convergenceSignal.domains || []).join(', '));
        _addRow(convCard, 'Strength', (pd.convergenceSignal.strength || 0).toFixed(2));
        panel.appendChild(convCard);
      }
    }

    // Contextual recommendations
    if (report.contextualRecommendations) {
      var ctxCard = _card('CONTEXTUAL RECOMMENDATIONS');
      var ctx = report.contextualRecommendations;
      var all = (ctx.domain || []).concat(ctx.civilization || []);
      for (var j = 0; j < all.length; j++) {
        _addRow(ctxCard, all[j].pattern, all[j].action + ' (' + (all[j].confidence * 100).toFixed(0) + '%)');
      }
      if (all.length === 0) {
        ctxCard.innerHTML += '<div class="lrc-empty">No contextual recommendations.</div>';
      }
      panel.appendChild(ctxCard);
    }
  }

  function _renderEvidenceChain(recSet, reports) {
    var panel = document.getElementById('lrc-panel-evidence-chain');
    if (!panel) return;
    panel.innerHTML = '';

    // Build reasoning chain from source chain
    var sourceChain = null;
    if (reports) {
      var rTypes = ['portalUser', 'domain', 'mainUser', 'civilization'];
      for (var i = 0; i < rTypes.length; i++) {
        if (reports[rTypes[i]] && reports[rTypes[i]].sourceChain) {
          sourceChain = reports[rTypes[i]].sourceChain;
          break;
        }
      }
    }

    var chain = document.createElement('div');
    chain.className = 'lrc-chain';

    // Step 1: Feeds
    var feedStep = _chainStep('FEEDS', sourceChain
      ? (sourceChain.feeds || []).join(', ') || 'No feeds'
      : 'Waiting for feed data');
    chain.appendChild(feedStep);

    // Step 2: Seeds
    var seedDetail = 'No seed data';
    if (sourceChain && sourceChain.seedNodes) {
      var seedKeys = Object.keys(sourceChain.seedNodes);
      seedDetail = seedKeys.length + ' nodes seeded: ' + seedKeys.map(function (k) {
        return 'node ' + k + ' (' + sourceChain.seedNodes[k].toFixed(2) + ')';
      }).join(', ');
    }
    chain.appendChild(_chainStep('SEEDS', seedDetail));

    // Step 3: Propagation
    var propDetail = 'No propagation data';
    if (sourceChain) {
      propDetail = sourceChain.propagationSteps + ' steps';
      if (sourceChain.convergenceStep !== null && sourceChain.convergenceStep !== undefined) {
        propDetail += ', converged at step ' + sourceChain.convergenceStep;
      }
    }
    chain.appendChild(_chainStep('PROPAGATION', propDetail));

    // Step 4: Pattern class
    var patternDetail = 'No patterns detected';
    if (sourceChain && sourceChain.patternsDetected) {
      var pd = sourceChain.patternsDetected;
      var parts = [];
      if (pd.hotClusters > 0) parts.push(pd.hotClusters + ' hot clusters');
      if (pd.coldGaps > 0) parts.push(pd.coldGaps + ' cold gaps');
      if (pd.predictionViolations > 0) parts.push(pd.predictionViolations + ' prediction violations');
      if (pd.oscillations > 0) parts.push(pd.oscillations + ' oscillations');
      patternDetail = parts.length > 0 ? parts.join(', ') : 'No significant patterns';
    }
    // Add detected pattern classes from recSet
    if (recSet) {
      var patternClasses = {};
      var scales = ['mainUser', 'portalUser', 'business', 'domain', 'civilization'];
      for (var s = 0; s < scales.length; s++) {
        var recs = recSet[scales[s]] || [];
        for (var r = 0; r < recs.length; r++) {
          patternClasses[recs[r].patternClass] = true;
        }
      }
      var pList = Object.keys(patternClasses);
      if (pList.length > 0) {
        patternDetail += ' → ' + pList.map(function (p) { return p.replace(/_/g, ' '); }).join(', ');
      }
    }
    chain.appendChild(_chainStep('PATTERN CLASS', patternDetail));

    // Step 5: Remedy match
    var remedyDetail = 'No remedies matched';
    if (sourceChain) {
      remedyDetail = sourceChain.remedyLookups + ' remedy lookups performed';
    }
    chain.appendChild(_chainStep('REMEDY MATCH', remedyDetail));

    // Step 6: Scale translation
    var scaleDetail = 'Not translated';
    if (recSet) {
      var counts = [];
      var scaleNames = ['mainUser', 'portalUser', 'business', 'domain', 'civilization'];
      for (var si = 0; si < scaleNames.length; si++) {
        var cnt = (recSet[scaleNames[si]] || []).length;
        if (cnt > 0) counts.push(scaleNames[si] + ': ' + cnt);
      }
      scaleDetail = counts.length > 0 ? counts.join(', ') : 'No scale translations produced';
    }
    chain.appendChild(_chainStep('SCALE TRANSLATION', scaleDetail));

    // Step 7: Report
    var reportDetail = 'No reports generated';
    if (reports) {
      var reportTypes = Object.keys(reports);
      reportDetail = reportTypes.length + ' reports: ' + reportTypes.join(', ');
    }
    chain.appendChild(_chainStep('REPORT', reportDetail));

    panel.appendChild(chain);

    // Evidence envelope details
    var envelope = null;
    if (recSet) {
      var esc = ['portalUser', 'mainUser', 'business', 'domain', 'civilization'];
      for (var ei = 0; ei < esc.length; ei++) {
        var erecs = recSet[esc[ei]] || [];
        if (erecs.length > 0 && erecs[0].evidenceEnvelope) {
          envelope = erecs[0].evidenceEnvelope;
          break;
        }
      }
    }

    if (envelope) {
      _renderEvidence(panel, {
        historical: {
          available: envelope.historical.analogueCount > 0,
          analogueCount: envelope.historical.analogueCount,
          coverageGrade: envelope.historical.coverageGrade,
          summary: envelope.historical.summaryNarrative
        },
        current: {
          available: true,
          dataQuality: envelope.currentState.dataQuality ? {
            grade: envelope.currentState.dataQuality.qualityGrade,
            statement: envelope.currentState.dataQuality.qualityStatement
          } : null,
          feeds: (envelope.currentState.feedSnapshot || []).map(function (f) { return { name: f.feedName, stress: f.stress, live: f.live }; })
        },
        predictive: {
          available: envelope.projected.projectionCount > 0,
          projectionCount: envelope.projected.projectionCount,
          dominantTrajectory: envelope.projected.dominantTrajectory,
          methodStatement: envelope.projected.methodStatement
        },
        uncertaintyStatement: envelope.uncertaintyStatement,
        overallConfidence: envelope.overallConfidence,
        overallTier: envelope.overallTier
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Registry rendering — diagnoses, treatments, steps from LIMENRemedyRegistry
  // ═══════════════════════════════════════════════════════════════════════════

  function _renderRegistrySection(panel, report, sectionTitle) {
    var regDx = report ? report.registryDiagnoses : null;
    var regTx = report ? report.registryTreatments : null;
    var regSteps = report ? report.registrySteps : null;

    // Fallback: query registry directly if report doesn't have embedded data
    if (!regDx || Object.keys(regDx).length === 0) {
      var mgr = window.LIMENRemedyRegistryManager;
      if (mgr) {
        var domains = window.LIMENDomains || {};
        var dk = Object.keys(domains);
        regDx = {};
        regTx = {};
        regSteps = {};
        for (var qi = 0; qi < dk.length; qi++) {
          regDx[dk[qi]] = mgr.getDiagnosesForDomain(dk[qi]);
          var txs = mgr.getTreatmentsOnDomainStress(dk[qi], (domains[dk[qi]] || {}).stress || 0);
          var stressCtx = {};
          stressCtx[dk[qi]] = (domains[dk[qi]] || {}).stress || 0;
          regTx[dk[qi]] = mgr.prioritize(txs, { domainStress: stressCtx });
          regSteps[dk[qi]] = [];
          for (var txi = 0; txi < Math.min(regTx[dk[qi]].length, 5); txi++) {
            var sts = mgr.getStepsForTreatment(regTx[dk[qi]][txi].id);
            regSteps[dk[qi]] = regSteps[dk[qi]].concat(sts);
          }
        }
      }
    }

    if (!regDx || Object.keys(regDx).length === 0) {
      var emptyCard = _card(sectionTitle);
      var emptyMsg = document.createElement('div');
      emptyMsg.className = 'lrc-empty';
      emptyMsg.textContent = 'Registry empty — no portal diagnoses harvested yet.';
      emptyCard.appendChild(emptyMsg);
      panel.appendChild(emptyCard);
      return;
    }

    var domKeys = Object.keys(regDx);
    for (var di = 0; di < domKeys.length; di++) {
      var domId = domKeys[di];
      var dxList = regDx[domId] || [];
      var txList = regTx ? (regTx[domId] || []) : [];
      var stepList = regSteps ? (regSteps[domId] || []) : [];

      if (dxList.length === 0 && txList.length === 0) continue;

      // Domain header card
      var domCard = _card(sectionTitle + ' — ' + domId.toUpperCase());

      // Diagnoses
      if (dxList.length > 0) {
        var dxHeader = document.createElement('div');
        dxHeader.style.cssText = 'font-size:0.62rem;letter-spacing:1.5px;text-transform:uppercase;color:#C9A94E;margin:6px 0 4px;';
        dxHeader.textContent = 'Diagnoses (' + dxList.length + ')';
        domCard.appendChild(dxHeader);

        for (var dxi = 0; dxi < Math.min(dxList.length, 5); dxi++) {
          var dx = dxList[dxi];
          var sevClass = dx.severity === 'critical' ? 'low' : (dx.severity === 'high' ? 'moderate' : 'high');
          _addRow(domCard, dx.title, dx.severity + (dx.confidence ? ' · ' + (dx.confidence * 100).toFixed(0) + '%' : ''), sevClass);
          if (dx.description) {
            var descEl = document.createElement('div');
            descEl.style.cssText = 'font-size:0.58rem;color:#888;padding:0 0 4px 12px;';
            descEl.textContent = dx.description.substring(0, 120);
            domCard.appendChild(descEl);
          }
          // Propagation risk
          if (dx.propagation && dx.propagation.length > 0) {
            for (var pri = 0; pri < dx.propagation.length; pri++) {
              var prop = dx.propagation[pri];
              var propEl = document.createElement('div');
              propEl.style.cssText = 'font-size:0.55rem;color:#e85454;padding:0 0 2px 16px;';
              propEl.textContent = '⚡ spillover → ' + prop.targetDomainId + ' (' + (prop.magnitude * 100).toFixed(0) + '%)';
              domCard.appendChild(propEl);
            }
          }
        }
        if (dxList.length > 5) {
          _addRow(domCard, '...', '+' + (dxList.length - 5) + ' more diagnoses');
        }
      }

      // Treatments
      if (txList.length > 0) {
        var txHeader = document.createElement('div');
        txHeader.style.cssText = 'font-size:0.62rem;letter-spacing:1.5px;text-transform:uppercase;color:#C9A94E;margin:8px 0 4px;border-top:1px solid rgba(201,169,78,0.08);padding-top:6px;';
        txHeader.textContent = 'Treatments (' + txList.length + ')';
        domCard.appendChild(txHeader);

        for (var txi2 = 0; txi2 < Math.min(txList.length, 5); txi2++) {
          var tx = txList[txi2];
          var confStr = tx.confidence ? (tx.confidence * 100).toFixed(0) + '%' : '?';
          var evStr = tx.evidence && tx.evidence.grade ? tx.evidence.grade : '';
          _addRow(domCard, tx.title.substring(0, 50), tx.type + ' · ' + confStr + (evStr ? ' · ' + evStr : ''));

          // Steps
          var txSteps = tx.steps || [];
          if (txSteps.length > 0) {
            var stepsEl = document.createElement('ul');
            stepsEl.className = 'lrc-actions-list';
            for (var ssi = 0; ssi < Math.min(txSteps.length, 3); ssi++) {
              var li = document.createElement('li');
              li.textContent = '[' + txSteps[ssi].sequence + '] ' + txSteps[ssi].action;
              stepsEl.appendChild(li);
            }
            if (txSteps.length > 3) {
              var more = document.createElement('li');
              more.style.color = '#666';
              more.textContent = '+' + (txSteps.length - 3) + ' more steps';
              stepsEl.appendChild(more);
            }
            domCard.appendChild(stepsEl);
          }
        }
        if (txList.length > 5) {
          _addRow(domCard, '...', '+' + (txList.length - 5) + ' more treatments');
        }
      }

      // Evidence chain summary
      if (txList.length > 0 && txList[0].evidence) {
        var ev = txList[0].evidence;
        var evEl = document.createElement('div');
        evEl.style.cssText = 'font-size:0.55rem;color:#888;margin-top:6px;padding-top:4px;border-top:1px solid rgba(201,169,78,0.06);';
        evEl.textContent = 'Evidence: ' + (ev.grade || '?') + ' via ' + (ev.method || 'unknown') + ' (' + (ev.temporal || '?') + ')';
        domCard.appendChild(evEl);
      }

      panel.appendChild(domCard);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Shared rendering helpers
  // ═══════════════════════════════════════════════════════════════════════════

  function _card(title) {
    var card = document.createElement('div');
    card.className = 'lrc-card';
    var h = document.createElement('div');
    h.className = 'lrc-card-title';
    h.textContent = title;
    card.appendChild(h);
    return card;
  }

  function _addRow(parent, label, value, tierClass) {
    var row = document.createElement('div');
    row.className = 'lrc-row';
    row.innerHTML = '<span class="lrc-label">' + _esc(label) + '</span>' +
      '<span class="lrc-value' + (tierClass ? ' ' + tierClass : '') + '">' + _esc(String(value)) + '</span>';
    parent.appendChild(row);
  }

  function _chainStep(label, detail) {
    var step = document.createElement('div');
    step.className = 'lrc-chain-step';
    step.innerHTML = '<div class="lrc-step-label">' + _esc(label) + '</div>' +
      '<div class="lrc-step-detail">' + _esc(detail) + '</div>';
    return step;
  }

  function _renderEvidence(panel, evidence) {
    if (!evidence) return;

    var evCard = _card('EVIDENCE');
    if (evidence.overallConfidence !== undefined) {
      _addRow(evCard, 'Overall Confidence', (evidence.overallConfidence * 100).toFixed(0) + '%', evidence.overallTier);
    }
    if (evidence.uncertaintyStatement) {
      _addRow(evCard, 'Uncertainty', evidence.uncertaintyStatement);
    }

    // Historical
    if (evidence.historical) {
      var h = evidence.historical;
      _addRow(evCard, 'Historical', h.available
        ? h.analogueCount + ' analogues (' + (h.coverageGrade || '') + ')'
        : 'No historical data');
      if (h.summary) _addRow(evCard, 'Summary', h.summary.substring(0, 120));
    }

    // Current
    if (evidence.current) {
      var c = evidence.current;
      if (c.dataQuality) {
        _addRow(evCard, 'Data Quality', c.dataQuality.grade || c.dataQuality.statement || '');
      }
    }

    // Predictive
    if (evidence.predictive) {
      var p = evidence.predictive;
      _addRow(evCard, 'Predictive', p.available
        ? p.projectionCount + ' projections, trajectory: ' + p.dominantTrajectory
        : 'No projections');
    }

    panel.appendChild(evCard);
  }

  function _esc(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Export functions
  // ═══════════════════════════════════════════════════════════════════════════

  function _exportJSON() {
    if (!_currentReports) return;
    var data = {
      exportedAt: new Date().toISOString(),
      recommendations: _currentRecSet || null,
      reports: _currentReports
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'limen-report-' + Date.now() + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function _exportHTML() {
    if (!_container) return;
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>LIMEN Report</title>' +
      '<style>' + (document.getElementById('limen-report-console-css') || { textContent: '' }).textContent + '</style>' +
      '</head><body>' + _container.querySelector('.lrc-body').innerHTML + '</body></html>';
    var blob = new Blob([html], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'limen-report-' + Date.now() + '.html';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Tab-to-report-type mapping
  var TAB_REPORT_MAP = {
    'recommendations': 'mainUser',
    'domain-repair':   'domain',
    'civilization':    'civilization',
    'patent':          'patentOpportunity',
    'evidence-chain':  'portalUser'
  };

  function _printCurrentTab() {
    if (!_currentReports) {
      alert('No reports generated yet. Click Refresh first.');
      return;
    }
    var exporter = window.LIMENReportExporter;
    if (!exporter) {
      alert('Report exporter not loaded.');
      return;
    }
    var reportType = TAB_REPORT_MAP[_activeTab] || 'mainUser';
    var report = _currentReports[reportType];
    if (!report) {
      alert('No ' + reportType + ' report available.');
      return;
    }
    exporter.exportReport(reportType, report, 'pdf');
  }

  function _printAll() {
    if (!_currentReports || Object.keys(_currentReports).length === 0) {
      alert('No reports generated yet. Click Refresh first.');
      return;
    }
    var exporter = window.LIMENReportExporter;
    if (!exporter) {
      alert('Report exporter not loaded.');
      return;
    }
    exporter.exportAll(_currentReports, 'pdf');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Refresh / Update
  // ═══════════════════════════════════════════════════════════════════════════

  function _triggerRefresh() {
    // If generateAndReport is available, use it
    var synth = window.LIMENReportSynthesizer;
    var engine = window.LIMENRecommendationEngine;
    if (synth && engine && typeof synth.generateAndReport === 'function') {
      // Gather current system state
      var prop = window.LIMENPropagation;
      var router = window.LIMENSignalRouter;
      if (prop && router) {
        try {
          var signals = router.gatherInputs();
          var mapper = window.SignalMapper;
          var seeds = mapper ? mapper.mapSignals(signals) : {};
          var result = prop.activate(seeds);
          var patentData = window.LIMENPatentOpportunity || null;
          var bundle = synth.generateAndReport({
            propagationResult: result,
            nodeStates: _buildNodeStates(result),
            feedSources: _gatherFeedSources(),
            sourceHealth: _computeSourceHealth()
          }, { patentData: patentData });
          update(bundle.recommendations, bundle.reports);
        } catch (e) {
          console.warn('[LIMENReportConsole] Refresh failed:', e.message);
        }
      }
    }
  }

  function _buildNodeStates(propResult) {
    var states = {};
    var acts = propResult.activations || {};
    var hyper = propResult.hyper || [];
    for (var id in acts) {
      if (!acts.hasOwnProperty(id)) continue;
      states[id] = {
        activation: acts[id],
        direction: hyper.indexOf(parseInt(id, 10)) >= 0 ? 'hyper' : (acts[id] < 0.2 ? 'hypo' : 'silent'),
        predictionError: 0,
        system: 'unknown',
        label: 'node-' + id,
        salience: acts[id],
        activationMean: 0.3,
        activationVar: 0.05,
        seedSource: null
      };
    }
    return states;
  }

  function _gatherFeedSources() {
    var domains = window.LIMENDomains || {};
    var feeds = [];
    var dk = Object.keys(domains);
    for (var i = 0; i < dk.length; i++) {
      var d = domains[dk[i]];
      feeds.push({
        feedId: dk[i],
        feedName: dk[i],
        domain: dk[i],
        stress: d.stress || 0,
        live: true,
        fetchedAt: d.updated || Date.now(),
        contributesTo: []
      });
    }
    return feeds;
  }

  function _computeSourceHealth() {
    var domains = window.LIMENDomains || {};
    var dk = Object.keys(domains);
    if (dk.length === 0) return 0.5;
    var total = 0;
    for (var i = 0; i < dk.length; i++) {
      total += (domains[dk[i]].confidence || 0.5);
    }
    return total / dk.length;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Event subscribers
  // ═══════════════════════════════════════════════════════════════════════════

  function _bindEvents() {
    window.addEventListener('limen:recommendation-generated', function (e) {
      if (e.detail) update(e.detail.recommendations, e.detail.reports);
    });
    window.addEventListener('limen:report-generated', function (e) {
      if (e.detail) {
        _currentReports = e.detail.reports || e.detail;
        _renderAll();
      }
    });
    window.addEventListener('limen:domain-repair', function (e) {
      if (e.detail && _currentReports) {
        _currentReports.domain = e.detail;
        _renderDomainRepair(_currentReports);
      }
    });
    window.addEventListener('limen:patent-opportunity', function (e) {
      if (e.detail && _currentReports) {
        _currentReports.patentOpportunity = e.detail;
        _renderPatent(_currentReports);
      }
    });
    window.addEventListener('limen:report-update', function (e) {
      if (e.detail) {
        if (e.detail.recSet) _currentRecSet = e.detail.recSet;
        if (e.detail.reports) _currentReports = e.detail.reports;
        _renderAll();
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════════════════

  function init() {
    _buildDOM();
    _bindEvents();
  }

  function show() {
    _buildDOM();
    _container.classList.add('active');
    _visible = true;
  }

  function hide() {
    if (_container) _container.classList.remove('active');
    _visible = false;
  }

  function toggle() {
    _visible ? hide() : show();
  }

  function update(recSet, reports) {
    _currentRecSet = recSet;
    _currentReports = reports;
    _renderAll();
    window.dispatchEvent(new CustomEvent('limen:report-update', {
      detail: { recSet: recSet, reports: reports }
    }));
  }

  function _renderAll() {
    if (!_container) return;
    _renderRecommendations(_currentRecSet || {}, _currentReports);
    _renderDomainRepair(_currentReports);
    _renderCivilization(_currentReports);
    _renderPatent(_currentReports);
    _renderEvidenceChain(_currentRecSet, _currentReports);
  }

  function isVisible() { return _visible; }
  function getReports() { return _currentReports; }
  function getRecSet() { return _currentRecSet; }

  // Auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.LIMENReportConsole = {
    init:       init,
    show:       show,
    hide:       hide,
    toggle:     toggle,
    update:     update,
    isVisible:  isVisible,
    getReports: getReports,
    getRecSet:  getRecSet
  };

})();
