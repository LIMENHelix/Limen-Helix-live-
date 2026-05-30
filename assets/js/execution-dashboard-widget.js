/**
 * execution-dashboard-widget.js — Global Execution Summary Widget
 *
 * Small collapsible widget showing execution status across all domains.
 * Only activates on pages with execution surfaces.
 *
 * Exposes: window.LIMENExecution.phase4.dashboard
 */
(function () {
  'use strict';
  window.LIMENExecution = window.LIMENExecution || {};
  window.LIMENExecution.phase4 = window.LIMENExecution.phase4 || {};

  function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function render() {
    var ledger = window.LIMENClaimLedger;
    var stats = ledger ? ledger.getStats() : { total: 0, claimed: 0, approved: 0, closed: 0, totalEstimatedPayout: 0 };
    var opStats = window.LIMENExecution.operatorStats ? window.LIMENExecution.operatorStats.getStats() : {};
    var portfolio = window.LIMENExecution.phase4.portfolio ? window.LIMENExecution.phase4.portfolio.getStats() : { total: 0 };

    var h = '<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:0.30rem;margin:6px 0">';
    h += '<span style="color:#807868">Claims: <b style="color:#d0c8b8">' + stats.total + '</b></span>';
    h += '<span style="color:#807868">Pending: <b style="color:#C9A94E">' + (stats.claimed + stats.inReview + stats.submitted) + '</b></span>';
    h += '<span style="color:#807868">Closed: <b style="color:#5ab5a0">' + stats.closed + '</b></span>';
    h += '<span style="color:#807868">Est. payout: <b style="color:#5ab5a0">$' + (stats.totalEstimatedPayout || 0).toLocaleString() + '</b></span>';
    if (portfolio.total > 0) h += '<span style="color:#807868">Portfolio: <b style="color:#C9A94E">' + portfolio.total + ' co.</b></span>';
    h += '<a href="/policy-procedures" target="_blank" style="color:rgba(201,169,78,0.4);text-decoration:none;font-size:0.24rem;border:1px solid rgba(201,169,78,0.1);padding:1px 4px;border-radius:1px">POLICY</a>';
    h += '<a href="/operator-sop" target="_blank" style="color:rgba(201,169,78,0.4);text-decoration:none;font-size:0.24rem;border:1px solid rgba(201,169,78,0.1);padding:1px 4px;border-radius:1px">SOP</a>';
    h += '</div>';
    return h;
  }

  function mount(container) {
    if (!container) return;
    var div = document.createElement('div');
    div.innerHTML = render();
    container.appendChild(div);
  }

  window.LIMENExecution.phase4.dashboard = { render: render, mount: mount };
})();
