/**
 * LIMEN Report Exporter
 *
 * Exports recommendation/regulation reports to:
 *   - HTML (standalone, print-ready)
 *   - PDF-ready print layout (triggers window.print with formatted content)
 *   - JSON (raw data download)
 *
 * Does not modify any locked engine. Read-only consumer.
 *
 * Depends on:
 *   window.LIMENReportSynthesizer  (report data)
 *   window.LIMENRegulationReports  (regulation plans)
 *
 * Exposes: window.LIMENReportExporter
 */
(function () {
  'use strict';

  var REPORT_TYPES = ['mainUser', 'portalUser', 'business', 'domain', 'civilization', 'patentOpportunity', 'globalRemedyReport'];

  // ═══════════════════════════════════════════════════════════════════════════
  // Style for standalone HTML reports
  // ═══════════════════════════════════════════════════════════════════════════

  var PRINT_CSS = [
    '* { box-sizing:border-box; margin:0; padding:0; }',
    'body { font-family:"IBM Plex Mono","Courier New",monospace; color:#1a1a1a; background:#fff;',
    '  max-width:800px; margin:0 auto; padding:40px 24px; font-size:11px; line-height:1.6; }',
    'h1 { font-size:16px; letter-spacing:3px; text-transform:uppercase; border-bottom:2px solid #C9A94E;',
    '  padding-bottom:8px; margin-bottom:16px; color:#222; }',
    'h2 { font-size:13px; letter-spacing:2px; text-transform:uppercase; color:#C9A94E; margin:20px 0 8px; }',
    'h3 { font-size:11px; letter-spacing:1px; text-transform:uppercase; color:#555; margin:12px 0 6px; }',
    '.meta { color:#888; font-size:9px; margin-bottom:20px; }',
    '.section { border:1px solid #e0e0e0; border-radius:4px; padding:12px 16px; margin-bottom:12px; break-inside:avoid; }',
    '.row { display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px solid #f5f5f5; }',
    '.row:last-child { border-bottom:none; }',
    '.label { color:#666; }',
    '.value { color:#222; font-weight:600; }',
    '.value.high { color:#2e7d32; }',
    '.value.moderate { color:#e65100; }',
    '.value.low { color:#c62828; }',
    '.value.insufficient { color:#9e9e9e; }',
    '.bar-container { display:flex; align-items:center; gap:8px; padding:4px 0; }',
    '.bar-label { width:100px; font-size:10px; color:#666; }',
    '.bar-track { flex:1; height:6px; background:#f0f0f0; border-radius:3px; overflow:hidden; }',
    '.bar-fill { height:100%; border-radius:3px; background:linear-gradient(90deg,#4a8fd4,#e85454); }',
    '.bar-value { width:50px; text-align:right; font-size:10px; }',
    'ul { list-style:none; padding-left:16px; }',
    'ul li:before { content:"→ "; color:#C9A94E; }',
    'ul li { padding:2px 0; }',
    '.chain { position:relative; padding-left:20px; margin:12px 0; }',
    '.chain-step { position:relative; padding:6px 0 6px 12px; border-left:2px solid #C9A94E; font-size:10px; }',
    '.chain-step .step-name { font-weight:600; text-transform:uppercase; letter-spacing:1px; color:#C9A94E; }',
    '.chain-step .step-detail { color:#666; }',
    '.conflict { background:#fff8e1; border-left:3px solid #ffc107; padding:6px 10px; margin:4px 0; font-size:10px; }',
    '.footer { margin-top:30px; padding-top:12px; border-top:1px solid #ccc; color:#999; font-size:9px; text-align:center; }',
    '@media print { body { padding:20px; } .section { break-inside:avoid; } }'
  ].join('\n');

  // ═══════════════════════════════════════════════════════════════════════════
  // HTML generators per report type
  // ═══════════════════════════════════════════════════════════════════════════

  function _htmlMainUser(report) {
    var h = '';
    h += _htmlSection('Summary', [
      _htmlRow('Headline', report.summary.headline),
      _htmlRow('Confidence', report.summary.confidenceLabel, _tierClass(report.summary.confidenceLabel)),
      _htmlRow('Urgency', report.summary.urgency.toFixed(2)),
      _htmlRow('Time Horizon', report.summary.timeHorizon),
      _htmlRow('Trajectory', report.temporal.trajectory)
    ]);

    if (report.actions && report.actions.length > 0) {
      h += '<h2>Recommended Actions</h2><ul>';
      for (var i = 0; i < report.actions.length; i++) {
        h += '<li>' + _esc(report.actions[i].text) + '</li>';
      }
      h += '</ul>';
    }

    if (report.dataNote) {
      h += _htmlSection('Data Note', [_htmlRow('Quality', report.dataNote)]);
    }

    h += _htmlSourceChain(report.sourceChain);
    return h;
  }

  function _htmlPortalUser(report) {
    var h = '';
    h += _htmlSection('Clinical Summary', [
      _htmlRow('Pattern', report.summary.patternLabel),
      _htmlRow('Confidence', (report.summary.confidence * 100).toFixed(0) + '% (' + report.summary.confidenceTier + ')', report.summary.confidenceTier),
      _htmlRow('Urgency', report.summary.urgency.toFixed(2)),
      _htmlRow('Time Horizon', report.summary.timeHorizon),
      _htmlRow('Affected Nodes', (report.summary.affectedNodes || []).join(', ')),
      _htmlRow('Affected Systems', (report.summary.affectedSystems || []).join(', '))
    ]);

    if (report.suggestions && report.suggestions.length > 0) {
      h += '<h2>Treatment Suggestions</h2>';
      for (var i = 0; i < report.suggestions.length; i++) {
        var s = report.suggestions[i];
        h += _htmlSection('#' + s.rank + ' — ' + _esc(s.treatment), [
          _htmlRow('Type', s.type),
          _htmlRow('Direction', s.direction),
          _htmlRow('Target', s.node ? 'Node ' + s.node.id : ''),
          _htmlRow('Relevance', (s.relevance * 100).toFixed(0) + '%'),
          _htmlRow('Evidence', s.evidence || '')
        ]);
      }
    }

    h += _htmlEvidence(report.evidence);
    h += _htmlConflicts(report.conflicts);
    h += _htmlSourceChain(report.sourceChain);
    return h;
  }

  function _htmlBusiness(report) {
    var h = '';
    h += _htmlSection('Business Summary', [
      _htmlRow('Pattern', report.summary.patternLabel),
      _htmlRow('Confidence', (report.summary.confidence * 100).toFixed(0) + '%', report.summary.confidenceTier),
      _htmlRow('Urgency', report.summary.urgency.toFixed(2)),
      _htmlRow('Time Horizon', report.summary.timeHorizon)
    ]);

    if (report.kpis && report.kpis.length > 0) {
      h += '<h2>KPI Impact</h2>';
      for (var i = 0; i < report.kpis.length; i++) {
        var k = report.kpis[i];
        h += _htmlSection(k.metric, [
          _htmlRow('Impact', k.impact),
          _htmlRow('Timeframe', k.timeframe),
          _htmlRow('Risk', k.risk)
        ]);
      }
    }

    h += _htmlEvidence(report.evidence);
    h += _htmlConflicts(report.conflicts);
    return h;
  }

  function _htmlDomain(report) {
    var h = '';
    h += _htmlSection('Domain Report Summary', [
      _htmlRow('Pattern', report.summary.patternLabel),
      _htmlRow('Confidence', (report.summary.confidence * 100).toFixed(0) + '%', report.summary.confidenceTier),
      _htmlRow('Propagation', report.propagationSteps + ' steps, converged: ' + report.convergenceAchieved),
      _htmlRow('Urgency', report.summary.urgency.toFixed(2))
    ]);

    // Domain stress bars
    if (report.domainStress) {
      h += '<h2>Domain Stress Map</h2><div class="section">';
      var dk = Object.keys(report.domainStress);
      for (var i = 0; i < dk.length; i++) {
        var d = report.domainStress[dk[i]];
        h += '<div class="bar-container">' +
          '<span class="bar-label">' + _esc(dk[i]) + '</span>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + (d.stress * 100) + '%"></div></div>' +
          '<span class="bar-value">' + d.stress.toFixed(2) + ' ' + d.trend + '</span></div>';
      }
      h += '</div>';
    }

    // Signals
    if (report.signals && report.signals.length > 0) {
      h += '<h2>Repair Signals</h2>';
      for (var s = 0; s < report.signals.length; s++) {
        var sig = report.signals[s];
        h += _htmlSection(sig.type, [
          _htmlRow('Narrative', sig.narrative),
          _htmlRow('Severity', sig.severity.toFixed(2)),
          _htmlRow('Recommendation', sig.recommendation || 'n/a')
        ]);
      }
    }

    // Registry diagnoses & treatments
    h += _htmlRegistryData(report);

    h += _htmlEvidence(report.evidence);
    h += _htmlConflicts(report.conflicts);
    return h;
  }

  function _htmlCivilization(report) {
    var h = '';
    h += _htmlSection('Global State', [
      _htmlRow('Mode', report.summary.globalMode),
      _htmlRow('Score', report.summary.globalScore.toFixed(2)),
      _htmlRow('Confidence', report.summary.globalConfidence.toFixed(2)),
      _htmlRow('Top Drivers', (report.summary.topDrivers || []).join(', ')),
      _htmlRow('Pattern', report.summary.patternLabel)
    ]);

    // Domain overview bars
    if (report.domainOverview && report.domainOverview.length > 0) {
      h += '<h2>Domain Overview</h2><div class="section">';
      for (var i = 0; i < report.domainOverview.length; i++) {
        var d = report.domainOverview[i];
        h += '<div class="bar-container">' +
          '<span class="bar-label">' + _esc(d.domain) + '</span>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + (d.stress * 100) + '%"></div></div>' +
          '<span class="bar-value">' + d.stress.toFixed(2) + ' ' + d.trend + '</span></div>';
      }
      h += '</div>';
    }

    // Scale summary
    if (report.scaleSummary) {
      h += _htmlSection('Recommendation Counts', [
        _htmlRow('Main User', report.scaleSummary.mainUser),
        _htmlRow('Portal User', report.scaleSummary.portalUser),
        _htmlRow('Business', report.scaleSummary.business),
        _htmlRow('Domain', report.scaleSummary.domain),
        _htmlRow('Civilization', report.scaleSummary.civilization),
        _htmlRow('Total', report.scaleSummary.total)
      ]);
    }

    // Registry diagnoses & treatments
    h += _htmlRegistryData(report);

    h += _htmlEvidence(report.evidence);
    h += _htmlConflicts(report.conflicts);
    return h;
  }

  function _htmlPatent(report) {
    var h = '';
    h += _htmlSection('Patent Opportunity Summary', [
      _htmlRow('Opportunity Score', report.summary.opportunityScore.toFixed(2)),
      _htmlRow('Signal Count', report.summary.signalCount),
      _htmlRow('Top Domain', report.summary.topDomain || 'none'),
      _htmlRow('Tech Hub Activation', report.techHubActivation.toFixed(2)),
      _htmlRow('Legal Review', report.legalReviewRequired ? 'Required' : 'Not Required'),
      _htmlRow('Confidence', (report.summary.confidence * 100).toFixed(0) + '%', report.summary.confidenceTier)
    ]);

    if (report.signals && report.signals.length > 0) {
      h += '<h2>Patent Signals</h2>';
      for (var i = 0; i < report.signals.length; i++) {
        var sig = report.signals[i];
        h += _htmlSection(sig.type.replace(/_/g, ' '), [
          _htmlRow('Indication', sig.indication),
          _htmlRow('Score', (sig.opportunityScore || 0).toFixed(2))
        ]);
      }
    }

    if (report.patentData && report.patentData.noveltySignal) {
      h += _htmlSection('Novelty Signal', [
        _htmlRow('Spike', report.patentData.noveltySignal.spikeDetected ? 'Yes' : 'No'),
        _htmlRow('Prediction Error', ((report.patentData.noveltySignal.predictionError || 0) * 100).toFixed(0) + '%')
      ]);
    }

    h += _htmlEvidence(report.evidence);
    return h;
  }

  function _htmlGlobalRemedy(report) {
    var h = '';
    if (report.globalState) {
      h += _htmlSection('Global State', [
        _htmlRow('Mode', report.globalState.mode),
        _htmlRow('Score', report.globalState.score.toFixed(2)),
        _htmlRow('Confidence', report.globalState.confidence.toFixed(2)),
        _htmlRow('Top Drivers', (report.globalState.topDrivers || []).join(', '))
      ]);
    }

    // Domain stress map
    if (report.domainStressMap) {
      h += '<h2>Domain Stress Map</h2><div class="section">';
      var dk = Object.keys(report.domainStressMap);
      for (var i = 0; i < dk.length; i++) {
        var d = report.domainStressMap[dk[i]];
        h += '<div class="bar-container">' +
          '<span class="bar-label">' + _esc(dk[i]) + '</span>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + (d.stress * 100) + '%"></div></div>' +
          '<span class="bar-value">' + d.stress.toFixed(2) + ' ' + d.trend + '</span></div>';
      }
      h += '</div>';
    }

    // Systemic risks
    if (report.systemicRisks && report.systemicRisks.length > 0) {
      h += '<h2>Systemic Risks</h2>';
      for (var r = 0; r < report.systemicRisks.length; r++) {
        var risk = report.systemicRisks[r];
        h += '<div class="conflict">' + _esc(risk.domain) + ': ' + _esc(risk.severity) + ' (' + risk.stress.toFixed(2) + ', ' + risk.trend + ')</div>';
      }
    }

    // Recommended interventions
    h += '<h2>Recommended Interventions</h2>';
    var interventions = report.recommendedInterventions || {};
    var scales = ['user', 'portal', 'business', 'domain', 'civilization'];
    for (var s = 0; s < scales.length; s++) {
      var plan = interventions[scales[s]];
      if (!plan) continue;
      h += '<h3>' + scales[s].toUpperCase() + '</h3>';
      h += '<div class="section">';
      if (plan.pattern) h += _htmlRow('Pattern', plan.pattern);
      if (plan.confidence !== undefined) h += _htmlRow('Confidence', typeof plan.confidence === 'number' ? (plan.confidence * 100).toFixed(0) + '%' : plan.confidence);
      h += '</div>';
    }

    // Innovation opportunities
    if (report.innovationOpportunities) {
      var pat = report.innovationOpportunities;
      h += _htmlSection('Innovation Opportunities', [
        _htmlRow('Opportunity Score', (pat.opportunityScore || 0).toFixed(2)),
        _htmlRow('Suggested Field', pat.suggestedField || 'n/a'),
        _htmlRow('Signal Count', pat.signalCount || 0)
      ]);
    }

    // Cross-domain conflicts
    if (report.crossDomainConflicts && report.crossDomainConflicts.length > 0) {
      h += '<h2>Cross-Domain Conflicts</h2>';
      for (var c = 0; c < report.crossDomainConflicts.length; c++) {
        var cf = report.crossDomainConflicts[c];
        h += '<div class="conflict">' + _esc(cf.type || '') + ': ' + _esc(cf.scaleA || '') + ' vs ' + _esc(cf.scaleB || '') + '</div>';
      }
    }

    if (report.summary) {
      h += _htmlSection('Summary', [{ html: '<pre style="white-space:pre-wrap;font-size:10px;color:#555">' + _esc(report.summary) + '</pre>' }]);
    }

    return h;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Registry data renderer — diagnoses, treatments, steps
  // ═══════════════════════════════════════════════════════════════════════════

  function _htmlRegistryData(report) {
    var regDx = report ? report.registryDiagnoses : null;
    var regTx = report ? report.registryTreatments : null;
    var regSteps = report ? report.registrySteps : null;

    if (!regDx || Object.keys(regDx).length === 0) {
      return '<h2>Registry Diagnoses &amp; Treatments</h2><div class="section"><div class="row"><span class="label">Status</span><span class="value insufficient">Registry empty — no portal data harvested</span></div></div>';
    }

    var h = '<h2>Registry Diagnoses &amp; Treatments</h2>';
    var domKeys = Object.keys(regDx);

    for (var i = 0; i < domKeys.length; i++) {
      var domId = domKeys[i];
      var dxList = regDx[domId] || [];
      var txList = regTx ? (regTx[domId] || []) : [];

      if (dxList.length === 0 && txList.length === 0) continue;

      h += '<h3>' + _esc(domId.toUpperCase()) + '</h3>';

      // Diagnoses
      if (dxList.length > 0) {
        h += '<div class="section">';
        for (var dxi = 0; dxi < Math.min(dxList.length, 5); dxi++) {
          var dx = dxList[dxi];
          var sevClass = dx.severity === 'critical' ? 'low' : (dx.severity === 'high' ? 'moderate' : '');
          h += _htmlRow(dx.title, dx.severity + (dx.confidence ? ' (' + (dx.confidence * 100).toFixed(0) + '%)' : ''), sevClass);
          if (dx.description) {
            h += '<div style="font-size:9px;color:#888;padding:0 0 4px 0">' + _esc(dx.description.substring(0, 120)) + '</div>';
          }
          // Propagation
          if (dx.propagation && dx.propagation.length > 0) {
            for (var pi = 0; pi < dx.propagation.length; pi++) {
              var p = dx.propagation[pi];
              h += '<div style="font-size:9px;color:#c62828;padding:0 0 2px 8px">→ spillover: ' + _esc(p.targetDomainId) + ' (' + (p.magnitude * 100).toFixed(0) + '%)</div>';
            }
          }
        }
        h += '</div>';
      }

      // Treatments with steps
      if (txList.length > 0) {
        for (var txi = 0; txi < Math.min(txList.length, 3); txi++) {
          var tx = txList[txi];
          var rows = [
            _htmlRow('Type', tx.type || '?'),
            _htmlRow('Confidence', tx.confidence ? (tx.confidence * 100).toFixed(0) + '%' : '?'),
            _htmlRow('Evidence', tx.evidence && tx.evidence.grade ? tx.evidence.grade : '?'),
            _htmlRow('Scale', (tx.scaleTags || []).join(', ')),
            _htmlRow('Time', (tx.timeTags || []).join(', '))
          ];
          h += _htmlSection(tx.title, rows);

          // Steps
          var txSteps = tx.steps || [];
          if (txSteps.length > 0) {
            h += '<ul>';
            for (var si = 0; si < txSteps.length; si++) {
              h += '<li>[' + txSteps[si].sequence + '] ' + _esc(txSteps[si].action) + '</li>';
            }
            h += '</ul>';
          }
        }
      }
    }

    return h;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Shared HTML helpers
  // ═══════════════════════════════════════════════════════════════════════════

  function _htmlSection(title, rows) {
    var h = '<h2>' + _esc(title) + '</h2><div class="section">';
    for (var i = 0; i < rows.length; i++) {
      h += rows[i].html || rows[i];
    }
    h += '</div>';
    return h;
  }

  function _htmlRow(label, value, tierClass) {
    return '<div class="row"><span class="label">' + _esc(label) + '</span>' +
      '<span class="value' + (tierClass ? ' ' + tierClass : '') + '">' + _esc(String(value || '')) + '</span></div>';
  }

  function _htmlEvidence(evidence) {
    if (!evidence) return '';
    var rows = [];
    if (evidence.overallConfidence !== undefined) {
      rows.push(_htmlRow('Overall Confidence', (evidence.overallConfidence * 100).toFixed(0) + '%'));
    }
    if (evidence.uncertaintyStatement) {
      rows.push(_htmlRow('Uncertainty', evidence.uncertaintyStatement));
    }
    if (evidence.historical) {
      var h = evidence.historical;
      rows.push(_htmlRow('Historical', h.available !== false
        ? (h.analogueCount || h.precedentCount || 0) + ' records'
        : 'None'));
      if (h.summary) rows.push(_htmlRow('Summary', h.summary.substring(0, 150)));
    }
    if (evidence.predictive) {
      var p = evidence.predictive;
      rows.push(_htmlRow('Trajectory', p.trajectory || p.dominantTrajectory || 'unknown'));
    }
    return rows.length > 0 ? _htmlSection('Evidence', rows) : '';
  }

  function _htmlConflicts(conflicts) {
    if (!conflicts || conflicts.length === 0) return '';
    var h = '<h2>Conflicts (' + conflicts.length + ')</h2>';
    for (var i = 0; i < conflicts.length; i++) {
      var c = conflicts[i];
      h += '<div class="conflict">' + _esc(c.type || '') + ': ' + _esc(c.scaleA || '') + ' vs ' + _esc(c.scaleB || '') +
        (c.resolution ? ' → ' + _esc(c.resolution.strategy) : '') + '</div>';
    }
    return h;
  }

  function _htmlSourceChain(chain) {
    if (!chain) return '';
    var h = '<h2>Source Chain</h2><div class="chain">';
    h += _chainStepHTML('Feeds', (chain.feeds || []).join(', ') || 'none');
    h += _chainStepHTML('Seed Nodes', chain.seedNodes ? Object.keys(chain.seedNodes).length + ' nodes' : 'none');
    h += _chainStepHTML('Propagation', chain.propagationSteps + ' steps' + (chain.convergenceStep ? ', converged step ' + chain.convergenceStep : ''));
    if (chain.patternsDetected) {
      var pd = chain.patternsDetected;
      h += _chainStepHTML('Patterns', pd.hotClusters + ' hot clusters, ' + pd.coldGaps + ' cold gaps');
    }
    h += _chainStepHTML('Remedy Lookups', chain.remedyLookups || 0);
    h += '</div>';
    return h;
  }

  function _chainStepHTML(name, detail) {
    return '<div class="chain-step"><span class="step-name">' + _esc(name) + '</span> ' +
      '<span class="step-detail">' + _esc(String(detail)) + '</span></div>';
  }

  function _esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _tierClass(label) {
    if (!label) return '';
    var l = label.toLowerCase();
    if (l.indexOf('high') >= 0) return 'high';
    if (l.indexOf('moderate') >= 0) return 'moderate';
    if (l.indexOf('low') >= 0) return 'low';
    if (l.indexOf('insufficient') >= 0) return 'insufficient';
    return '';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Type label map
  // ═══════════════════════════════════════════════════════════════════════════

  var TYPE_TITLES = {
    mainUser: 'Main User Report',
    portalUser: 'Portal User Clinical Report',
    business: 'Business Portal Report',
    businessPortal: 'Business Portal Report',
    domain: 'Domain Repair Report',
    civilization: 'Civilization System Report',
    patentOpportunity: 'Patent Opportunity Report',
    globalRemedyReport: 'Global Remedy Report'
  };

  var TYPE_RENDERERS = {
    mainUser: _htmlMainUser,
    portalUser: _htmlPortalUser,
    business: _htmlBusiness,
    businessPortal: _htmlBusiness,
    domain: _htmlDomain,
    civilization: _htmlCivilization,
    patentOpportunity: _htmlPatent,
    globalRemedyReport: _htmlGlobalRemedy
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Main export function
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Export a report to the specified format.
   *
   * @param {string} type — report type (mainUser, portalUser, business, domain, civilization, patentOpportunity, globalRemedyReport)
   * @param {Object} reportObject — the report data from LIMENReportSynthesizer or LIMENRegulationReports
   * @param {string} [format='html'] — 'html', 'pdf', 'json'
   */
  function exportReport(type, reportObject, format) {
    format = format || 'html';

    if (format === 'json') {
      return _downloadJSON(type, reportObject);
    }

    var renderer = TYPE_RENDERERS[type];
    if (!renderer) {
      console.warn('[LIMENReportExporter] Unknown report type:', type);
      return;
    }

    var title = TYPE_TITLES[type] || type;
    var body = renderer(reportObject);

    var html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
      '<title>LIMEN — ' + _esc(title) + '</title>' +
      '<style>' + PRINT_CSS + '</style></head><body>' +
      '<h1>' + _esc(title) + '</h1>' +
      '<div class="meta">Generated: ' + new Date().toISOString() + ' | LIMEN Helix v' + (reportObject.version || '0.1.0') + '</div>' +
      body +
      '<div class="footer">LIMEN Helix — Insight &amp; Regulation Report | Confidential</div>' +
      '</body></html>';

    if (format === 'pdf') {
      // Open in new window for printing
      var win = window.open('', '_blank', 'width=850,height=1100');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.onload = function () { win.print(); };
      }
      return;
    }

    // Default: download HTML
    var blob = new Blob([html], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'limen-' + type + '-' + Date.now() + '.html';
    a.click();
    URL.revokeObjectURL(url);
  }

  function _downloadJSON(type, reportObject) {
    var data = { reportType: type, exportedAt: new Date().toISOString(), data: reportObject };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'limen-' + type + '-' + Date.now() + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Export all reports at once (zip not available, exports as single HTML).
   */
  function exportAll(reports, format) {
    if (!reports || typeof reports !== 'object' || Object.keys(reports).length === 0) {
      throw new Error('No LIMEN reports available to export');
    }
    format = format || 'html';
    if (format === 'json') {
      return _downloadJSON('all-reports', reports);
    }

    var html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
      '<title>LIMEN — Complete Report Bundle</title>' +
      '<style>' + PRINT_CSS + '</style></head><body>' +
      '<h1>LIMEN Complete Report Bundle</h1>' +
      '<div class="meta">Generated: ' + new Date().toISOString() + '</div>';

    var types = Object.keys(reports);
    for (var i = 0; i < types.length; i++) {
      var t = types[i];
      var renderer = TYPE_RENDERERS[t];
      if (renderer && reports[t]) {
        html += '<h1 style="margin-top:40px;page-break-before:always">' + _esc(TYPE_TITLES[t] || t) + '</h1>';
        html += renderer(reports[t]);
      }
    }

    html += '<div class="footer">LIMEN Helix — Complete Report Bundle | Confidential</div></body></html>';

    if (format === 'pdf') {
      var win = window.open('', '_blank', 'width=850,height=1100');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.onload = function () { win.print(); };
      }
      return;
    }

    var blob = new Blob([html], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'limen-complete-report-' + Date.now() + '.html';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════════════════

  window.LIMENReportExporter = {
    exportReport:  exportReport,
    exportAll:     exportAll,
    REPORT_TYPES:  REPORT_TYPES
  };

})();
