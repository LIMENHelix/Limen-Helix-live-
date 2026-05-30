/**
 * execution-reliability-panel.js — Global Execution Memory Panel
 *
 * Compact collapsible panel showing operator performance history.
 * Activates only where execution UI exists.
 *
 * Exposes: window.LIMENExecution.reliabilityPanel
 */
(function () {
  'use strict';

  window.LIMENExecution = window.LIMENExecution || {};

  var PANEL_ID = 'limen-execution-memory';

  function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function render() {
    var stats = window.LIMENExecution.operatorStats;
    if (!stats) return '';
    var s = stats.getStats();
    var collapsed = false;
    try { collapsed = sessionStorage.getItem('lem_collapsed') === 'true'; } catch (e) {}

    var h = '<div id="' + PANEL_ID + '" style="font-family:\'IBM Plex Mono\',monospace;padding:10px 12px;border:1px solid rgba(201,169,78,0.06);border-radius:3px;background:rgba(0,0,0,0.1);margin-top:10px">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none" data-lem-toggle="1">';
    h += '<span style="font-size:0.26rem;letter-spacing:1.5px;color:rgba(201,169,78,0.85);text-transform:uppercase;font-weight:600">EXECUTION MEMORY</span>';
    h += '<span style="font-size:0.22rem;color:rgba(201,169,78,0.2)">' + (collapsed ? '\u25B6' : '\u25BC') + '</span>';
    h += '</div>';
    h += '<div style="' + (collapsed ? 'display:none' : '') + '" data-lem-body>';

    // Summary stats
    h += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px;font-size:0.32rem">';
    h += '<span style="color:#807868">Claims: <b style="color:#d0c8b8">' + s.totalClaims + '</b></span>';
    h += '<span style="color:#807868">Closed: <b style="color:#d0c8b8">' + s.totalClosed + '</b></span>';
    h += '<span style="color:' + (s.successRate >= 60 ? '#5ab5a0' : s.successRate >= 30 ? '#C9A94E' : '#e85454') + '">Success: <b>' + s.successRate + '%</b></span>';
    h += '<span style="color:#807868">Score: <b style="color:#d0c8b8">' + s.weightedScore + '</b></span>';
    h += '<span style="color:#807868">Avg cycle: <b style="color:#d0c8b8">' + s.avgCycleTime + 'd</b></span>';
    h += '<span style="color:#807868">Avg value: <b style="color:#5ab5a0">$' + (s.avgValueRealization || 0).toLocaleString() + '</b></span>';
    h += '</div>';

    // By type
    var types = Object.keys(s.byType || {});
    if (types.length > 0) {
      h += '<div style="margin-top:6px;font-size:0.28rem">';
      var best = null, worst = null;
      for (var ti = 0; ti < types.length; ti++) {
        var tp = s.byType[types[ti]];
        if (!best || tp.avgScore > s.byType[best].avgScore) best = types[ti];
        if (!worst || tp.avgScore < s.byType[worst].avgScore) worst = types[ti];
      }
      if (best) h += '<div style="color:#5ab5a0">Best: ' + esc(best) + ' (' + s.byType[best].successRate + '% success, ' + s.byType[best].total + ' outcomes)</div>';
      if (worst && worst !== best) h += '<div style="color:#C9A94E">Weakest: ' + esc(worst) + ' (' + s.byType[worst].successRate + '% success, ' + s.byType[worst].total + ' outcomes)</div>';
      h += '</div>';
    }

    // Feedback adjustment
    var fb = window.LIMENExecution.feedback;
    if (fb) {
      var relAdj = fb.getOperatorReliabilityAdjustment();
      var adjColor = relAdj > 0 ? '#5ab5a0' : relAdj < 0 ? '#e85454' : '#807868';
      h += '<div style="margin-top:4px;font-size:0.26rem;color:' + adjColor + '">Adaptive adjustment: ' + (relAdj >= 0 ? '+' : '') + relAdj.toFixed(3) + ' (max \u00b10.15)</div>';
    }

    h += '</div></div>';
    return h;
  }

  function mount(container) {
    if (!container) return;
    var existing = document.getElementById(PANEL_ID);
    if (existing) existing.remove();

    var stats = window.LIMENExecution.operatorStats;
    if (!stats) return; // Don't render if no stats system

    var div = document.createElement('div');
    div.innerHTML = render();
    if (div.firstChild) {
      container.appendChild(div.firstChild);
      // Wire toggle
      var toggle = container.querySelector('[data-lem-toggle]');
      if (toggle) {
        toggle.addEventListener('click', function () {
          var body = this.parentNode.querySelector('[data-lem-body]');
          var arrow = this.querySelector('span:last-child');
          if (body) {
            var hidden = body.style.display !== 'none';
            body.style.display = hidden ? 'none' : '';
            try { sessionStorage.setItem('lem_collapsed', hidden); } catch (e) {}
            if (arrow) arrow.textContent = hidden ? '\u25B6' : '\u25BC';
          }
        });
      }
    }
  }

  window.LIMENExecution.reliabilityPanel = {
    render: render,
    mount: mount
  };

  console.log('[ReliabilityPanel] Global execution memory panel loaded');
})();
