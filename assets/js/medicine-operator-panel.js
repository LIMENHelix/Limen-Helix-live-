/**
 * medicine-operator-panel.js — Medicine Operator Workflow Panel
 *
 * Collapsible panel showing operator claim summary, counts,
 * estimated payout total, and next required actions per claim.
 * Medicine-scoped only. No backend.
 *
 * Depends on: medicine-claim-ledger.js
 * Namespace: window.LIMENMedicine.economy.panel
 */
(function () {
  'use strict';

  window.LIMENMedicine = window.LIMENMedicine || {};
  window.LIMENMedicine.economy = window.LIMENMedicine.economy || {};

  // ── STYLES ──────────────────────────────────────────────────────────

  var _stylesInjected = false;
  function injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    var s = document.createElement('style');
    s.textContent = [
      '.mop-panel{margin:8px 20px;border:1px solid rgba(201,169,78,0.08);border-radius:4px;background:rgba(14,16,24,0.8)}',
      '.mop-header{display:flex;justify-content:space-between;align-items:center;padding:8px 14px;cursor:pointer;user-select:none}',
      '.mop-header:hover{background:rgba(201,169,78,0.02)}',
      '.mop-title{font-size:0.34rem;letter-spacing:2.5px;text-transform:uppercase;color:rgba(201,169,78,0.45)}',
      '.mop-summary{font-size:0.28rem;color:#807868;display:flex;gap:10px}',
      '.mop-summary-val{color:#C9A94E}',
      '.mop-toggle{font-size:0.22rem;color:rgba(201,169,78,0.25)}',
      '.mop-body{display:none;padding:0 14px 12px}',
      '.mop-body.open{display:block}',
      '.mop-stats{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:10px}',
      '.mop-stat{text-align:center;min-width:60px}',
      '.mop-stat-num{font-size:0.5rem;color:#C9A94E}',
      '.mop-stat-label{font-size:0.24rem;letter-spacing:1.5px;text-transform:uppercase;color:#807868}',
      '.mop-payout-total{font-size:0.38rem;color:#5ab5a0;padding:6px 10px;background:rgba(90,181,160,0.04);border-left:2px solid rgba(90,181,160,0.2);border-radius:0 2px 2px 0;margin-bottom:10px}',
      '.mop-actions-title{font-size:0.28rem;letter-spacing:2px;text-transform:uppercase;color:rgba(201,169,78,0.3);margin-bottom:4px}',
      '.mop-action-item{display:flex;justify-content:space-between;align-items:center;padding:4px 8px;margin-bottom:3px;background:rgba(0,0,0,0.1);border-radius:2px;font-size:0.32rem}',
      '.mop-action-title{color:#b0a898;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mop-action-next{color:#C9A94E;font-size:0.28rem;letter-spacing:0.5px}',
      '.mop-action-status{font-size:0.24rem;letter-spacing:1px;padding:1px 5px;border-radius:2px;margin-left:6px}',
      '.mop-action-status-claimed{color:#C9A94E;border:1px solid rgba(201,169,78,0.2)}',
      '.mop-action-status-in_review{color:#4a8fd4;border:1px solid rgba(74,143,212,0.2)}',
      '.mop-action-status-submitted{color:#a87adb;border:1px solid rgba(168,122,219,0.2)}',
      '.mop-action-status-approved{color:#5ab5a0;border:1px solid rgba(90,181,160,0.2)}',
      '.mop-action-status-rejected{color:#e85454;border:1px solid rgba(232,84,84,0.2)}',
      '.mop-action-status-closed{color:#908878;border:1px solid rgba(144,136,120,0.2)}',
      '.mop-empty{font-size:0.32rem;color:#605850;padding:8px 0;text-align:center}'
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

    var claims = window.LIMENMedicine.economy.claims;
    if (!claims) return '';

    var summary = claims.getSummary();
    var allClaims = claims.getAllClaims();

    var h = '<div class="mop-panel" id="mopPanel">';

    // Header
    h += '<div class="mop-header" id="mopToggle">';
    h += '<span class="mop-title">Operator Workflow</span>';
    h += '<span class="mop-summary">';
    h += '<span>Claims: <span class="mop-summary-val">' + summary.total + '</span></span>';
    if (summary.total > 0) {
      h += '<span>Active: <span class="mop-summary-val">' + (summary.claimed + summary.in_review + summary.submitted) + '</span></span>';
      h += '<span>Est. payout: <span class="mop-summary-val">$' + summary.estimatedPayoutTotal.toLocaleString() + '</span></span>';
    }
    h += '</span>';
    h += '<span class="mop-toggle">\u25BC</span>';
    h += '</div>';

    // Body
    h += '<div class="mop-body" id="mopBody">';

    if (summary.total === 0) {
      h += '<div class="mop-empty">No claimed opportunities. Claim an opportunity to begin.</div>';
    } else {
      // Stats row
      h += '<div class="mop-stats">';
      h += '<div class="mop-stat"><div class="mop-stat-num">' + summary.claimed + '</div><div class="mop-stat-label">Claimed</div></div>';
      h += '<div class="mop-stat"><div class="mop-stat-num">' + (summary.in_review + summary.submitted) + '</div><div class="mop-stat-label">In Progress</div></div>';
      h += '<div class="mop-stat"><div class="mop-stat-num">' + summary.approved + '</div><div class="mop-stat-label">Approved</div></div>';
      h += '<div class="mop-stat"><div class="mop-stat-num">' + summary.closed + '</div><div class="mop-stat-label">Closed</div></div>';
      h += '</div>';

      // Payout total
      h += '<div class="mop-payout-total">EST. OPERATOR PAYOUT: $' + summary.estimatedPayoutTotal.toLocaleString() + '</div>';

      // Action items
      h += '<div class="mop-actions-title">Next Actions</div>';
      for (var i = 0; i < allClaims.length; i++) {
        var c = allClaims[i];
        if (c.status === 'closed') continue;
        h += '<div class="mop-action-item">';
        h += '<span class="mop-action-title">' + _esc(c.title || c.opportunityId) + '</span>';
        h += '<span>';
        h += '<span class="mop-action-next">' + getNextAction(c.status) + '</span>';
        h += '<span class="mop-action-status mop-action-status-' + c.status + '">' + c.status.toUpperCase().replace(/_/g, ' ') + '</span>';
        h += '</span>';
        h += '</div>';
      }
    }

    h += '</div></div>';
    return h;
  }

  // ── INJECT ──────────────────────────────────────────────────────────

  function inject() {
    var container = document.getElementById('mopContainer');
    if (!container) {
      // Create container before the grid
      var grid = document.getElementById('oppGrid');
      if (!grid) return;
      container = document.createElement('div');
      container.id = 'mopContainer';
      grid.parentNode.insertBefore(container, grid);
    }

    var wasOpen = false;
    var existingBody = document.getElementById('mopBody');
    if (existingBody) wasOpen = existingBody.classList.contains('open');

    container.innerHTML = renderPanel();

    // Restore open state
    if (wasOpen) {
      var body = document.getElementById('mopBody');
      if (body) body.classList.add('open');
      var toggle = container.querySelector('.mop-toggle');
      if (toggle) toggle.textContent = '\u25B2';
    }

    // Wire toggle
    var header = document.getElementById('mopToggle');
    var body = document.getElementById('mopBody');
    if (header && body) {
      header.addEventListener('click', function () {
        body.classList.toggle('open');
        var t = header.querySelector('.mop-toggle');
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
  window.addEventListener('limen:medicine-claim-update', function () { setTimeout(inject, 100); });

  // ── PUBLIC API ──────────────────────────────────────────────────────

  window.LIMENMedicine.economy.panel = {
    inject: inject,
    renderPanel: renderPanel,
    getNextAction: getNextAction
  };

  console.log('[MedicineOperatorPanel] Loaded — operator workflow panel ready');
})();
