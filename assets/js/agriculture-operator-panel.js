/**
 * agriculture-operator-panel.js — Agriculture Operator Workflow Panel
 *
 * Collapsible panel showing operator claim summary, counts,
 * estimated payout total, and next required actions per claim.
 * Agriculture-scoped only. No backend.
 *
 * Depends on: agriculture-claim-ledger.js
 * Namespace: window.LIMENAgriculture.economy.panel
 */
(function () {
  'use strict';

  window.LIMENAgriculture = window.LIMENAgriculture || {};
  window.LIMENAgriculture.economy = window.LIMENAgriculture.economy || {};

  // ── STYLES ──────────────────────────────────────────────────────────

  var _stylesInjected = false;
  function injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    var s = document.createElement('style');
    s.textContent = [
      '.aop-panel{margin:8px 20px;border:1px solid rgba(90,181,160,0.08);border-radius:4px;background:rgba(14,16,24,0.8)}',
      '.aop-header{display:flex;justify-content:space-between;align-items:center;padding:8px 14px;cursor:pointer;user-select:none}',
      '.aop-header:hover{background:rgba(90,181,160,0.02)}',
      '.aop-title{font-size:0.34rem;letter-spacing:2.5px;text-transform:uppercase;color:rgba(90,181,160,0.45)}',
      '.aop-summary{font-size:0.28rem;color:#807868;display:flex;gap:10px}',
      '.aop-summary-val{color:#5ab5a0}',
      '.aop-toggle{font-size:0.22rem;color:rgba(90,181,160,0.25)}',
      '.aop-body{display:none;padding:0 14px 12px}',
      '.aop-body.open{display:block}',
      '.aop-stats{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:10px}',
      '.aop-stat{text-align:center;min-width:60px}',
      '.aop-stat-num{font-size:0.5rem;color:#5ab5a0}',
      '.aop-stat-label{font-size:0.24rem;letter-spacing:1.5px;text-transform:uppercase;color:#807868}',
      '.aop-payout-total{font-size:0.38rem;color:#5ab5a0;padding:6px 10px;background:rgba(90,181,160,0.04);border-left:2px solid rgba(90,181,160,0.2);border-radius:0 2px 2px 0;margin-bottom:10px}',
      '.aop-actions-title{font-size:0.28rem;letter-spacing:2px;text-transform:uppercase;color:rgba(90,181,160,0.3);margin-bottom:4px}',
      '.aop-action-item{display:flex;justify-content:space-between;align-items:center;padding:4px 8px;margin-bottom:3px;background:rgba(0,0,0,0.1);border-radius:2px;font-size:0.32rem}',
      '.aop-action-title{color:#b0a898;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.aop-action-next{color:#5ab5a0;font-size:0.28rem;letter-spacing:0.5px}',
      '.aop-action-status{font-size:0.24rem;letter-spacing:1px;padding:1px 5px;border-radius:2px;margin-left:6px}',
      '.aop-action-status-claimed{color:#5ab5a0;border:1px solid rgba(90,181,160,0.2)}',
      '.aop-action-status-in_review{color:#4a8fd4;border:1px solid rgba(74,143,212,0.2)}',
      '.aop-action-status-submitted{color:#a87adb;border:1px solid rgba(168,122,219,0.2)}',
      '.aop-action-status-approved{color:#5ab5a0;border:1px solid rgba(90,181,160,0.2)}',
      '.aop-action-status-rejected{color:#e85454;border:1px solid rgba(232,84,84,0.2)}',
      '.aop-action-status-closed{color:#908878;border:1px solid rgba(144,136,120,0.2)}',
      '.aop-empty{font-size:0.32rem;color:#605850;padding:8px 0;text-align:center}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── NEXT ACTION LOGIC ───────────────────────────────────────────────

  function getNextAction(status) {
    var map = {
      claimed: 'Start execution checklist',
      in_review: 'Complete auditor gate',
      submitted: 'Await decision / update notes',
      approved: 'Record outcome + close',
      rejected: 'Review failure notes',
      closed: 'Complete'
    };
    return map[status] || 'Unknown';
  }

  // ── RENDER ──────────────────────────────────────────────────────────

  function renderPanel() {
    injectStyles();

    var claims = window.LIMENAgriculture.economy.claims;
    if (!claims) return '';

    var summary = claims.getSummary();
    var allClaims = claims.getAllClaims();

    var h = '<div class="aop-panel" id="aopPanel">';

    h += '<div class="aop-header" id="aopToggle">';
    h += '<span class="aop-title">Operator Workflow</span>';
    h += '<span class="aop-summary">';
    h += '<span>Claims: <span class="aop-summary-val">' + summary.total + '</span></span>';
    if (summary.total > 0) {
      h += '<span>Active: <span class="aop-summary-val">' + (summary.claimed + summary.in_review + summary.submitted) + '</span></span>';
      h += '<span>Est. payout: <span class="aop-summary-val">$' + summary.estimatedPayoutTotal.toLocaleString() + '</span></span>';
    }
    h += '</span>';
    h += '<span class="aop-toggle">\u25BC</span>';
    h += '</div>';

    h += '<div class="aop-body" id="aopBody">';

    if (summary.total === 0) {
      h += '<div class="aop-empty">No claimed opportunities. Claim an opportunity to begin.</div>';
    } else {
      h += '<div class="aop-stats">';
      h += '<div class="aop-stat"><div class="aop-stat-num">' + summary.claimed + '</div><div class="aop-stat-label">Claimed</div></div>';
      h += '<div class="aop-stat"><div class="aop-stat-num">' + (summary.in_review + summary.submitted) + '</div><div class="aop-stat-label">In Progress</div></div>';
      h += '<div class="aop-stat"><div class="aop-stat-num">' + summary.approved + '</div><div class="aop-stat-label">Approved</div></div>';
      h += '<div class="aop-stat"><div class="aop-stat-num">' + summary.closed + '</div><div class="aop-stat-label">Closed</div></div>';
      h += '</div>';

      h += '<div class="aop-payout-total">EST. OPERATOR PAYOUT: $' + summary.estimatedPayoutTotal.toLocaleString() + '</div>';

      h += '<div class="aop-actions-title">Next Actions</div>';
      for (var i = 0; i < allClaims.length; i++) {
        var c = allClaims[i];
        if (c.status === 'closed') continue;
        h += '<div class="aop-action-item">';
        h += '<span class="aop-action-title">' + _esc(c.title || c.opportunityId) + '</span>';
        h += '<span>';
        h += '<span class="aop-action-next">' + getNextAction(c.status) + '</span>';
        h += '<span class="aop-action-status aop-action-status-' + c.status + '">' + c.status.toUpperCase().replace(/_/g, ' ') + '</span>';
        h += '</span>';
        h += '</div>';
      }
    }

    h += '</div></div>';
    return h;
  }

  // ── INJECT ──────────────────────────────────────────────────────────

  function inject() {
    var container = document.getElementById('aopContainer');
    if (!container) {
      var grid = document.getElementById('oppGrid');
      if (!grid) return;
      container = document.createElement('div');
      container.id = 'aopContainer';
      grid.parentNode.insertBefore(container, grid);
    }

    var wasOpen = false;
    var existingBody = document.getElementById('aopBody');
    if (existingBody) wasOpen = existingBody.classList.contains('open');

    container.innerHTML = renderPanel();

    if (wasOpen) {
      var body = document.getElementById('aopBody');
      if (body) body.classList.add('open');
      var toggle = container.querySelector('.aop-toggle');
      if (toggle) toggle.textContent = '\u25B2';
    }

    var header = document.getElementById('aopToggle');
    var body = document.getElementById('aopBody');
    if (header && body) {
      header.addEventListener('click', function () {
        body.classList.toggle('open');
        var t = header.querySelector('.aop-toggle');
        if (t) t.textContent = body.classList.contains('open') ? '\u25B2' : '\u25BC';
      });
    }
  }

  // ── HELPERS ─────────────────────────────────────────────────────────

  function _esc(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ── AUTO-INJECT ─────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(inject, 2600); });
  } else {
    setTimeout(inject, 2600);
  }

  window.addEventListener('limen:domain-update', function () { setTimeout(inject, 700); });
  window.addEventListener('limen:agriculture-claim-update', function () { setTimeout(inject, 100); });

  window.LIMENAgriculture.economy.panel = {
    inject: inject,
    renderPanel: renderPanel,
    getNextAction: getNextAction
  };

  console.log('[AgricultureOperatorPanel] Loaded — operator workflow panel ready');
})();
