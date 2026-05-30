/**
 * operator-panel.js — Global Operator Workflow Panel
 *
 * Collapsible panel showing operator's claimed opportunities,
 * status counts, estimated payouts, and next required actions.
 * Works for any domain.
 *
 * Exposes: window.LIMENOperatorPanel
 */
(function () {
  'use strict';

  var PANEL_ID = 'limen-operator-panel';
  var _stylesInjected = false;

  function injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    var s = document.createElement('style');
    s.textContent = [
      '#' + PANEL_ID + '{font-family:"IBM Plex Mono",monospace;padding:12px;border:1px solid rgba(201,169,78,0.08);border-radius:3px;background:rgba(0,0,0,0.15);margin-top:10px}',
      '.lop-title{font-size:0.28rem;letter-spacing:1.5px;color:rgba(201,169,78,0.85);text-transform:uppercase;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none;font-weight:600;text-shadow:0 0 6px rgba(201,169,78,0.2)}',
      '.lop-stats{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px;font-size:0.34rem}',
      '.lop-stat{color:#807868}',
      '.lop-stat b{color:#d0c8b8}',
      '.lop-claims{margin-top:6px}',
      '.lop-claim{padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.02);font-size:0.32rem;display:flex;justify-content:space-between;align-items:center;gap:8px}',
      '.lop-claim-title{color:#b0a898;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.lop-claim-status{font-size:0.24rem;letter-spacing:1px;padding:1px 5px;border-radius:2px}',
      '.lop-s-claimed{color:#C9A94E;border:1px solid rgba(201,169,78,0.2)}',
      '.lop-s-in_review{color:#4a8fd4;border:1px solid rgba(74,143,212,0.2)}',
      '.lop-s-submitted{color:#a87adb;border:1px solid rgba(168,122,219,0.2)}',
      '.lop-s-approved{color:#5ab5a0;border:1px solid rgba(90,181,160,0.2)}',
      '.lop-s-rejected{color:#e85454;border:1px solid rgba(232,84,84,0.2)}',
      '.lop-s-closed{color:#807868;border:1px solid rgba(128,120,104,0.2)}',
      '.lop-action{font-size:0.28rem;color:#908878;white-space:nowrap}',
      '.lop-payout{font-size:0.36rem;color:#5ab5a0;margin-top:6px;padding-top:6px;border-top:1px solid rgba(201,169,78,0.06)}',
      '.lop-body{overflow:hidden;transition:max-height 0.25s ease}',
      '.lop-body.collapsed{max-height:0;padding:0;margin:0}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  var ACTION_MAP = {
    'claimed': 'Start execution checklist',
    'in_review': 'Complete auditor gate',
    'submitted': 'Await decision',
    'approved': 'Record outcome and close',
    'rejected': 'Review failure notes',
    'closed': 'Complete'
  };

  function render(domain) {
    injectStyles();
    var ledger = window.LIMENClaimLedger;
    if (!ledger) return '';

    var claims = domain ? ledger.getClaimsByDomain(domain) : ledger.getAllClaims();
    var stats = ledger.getStats(domain || null);
    var collapsed = false;
    try { collapsed = sessionStorage.getItem('lop_collapsed') === 'true'; } catch (e) {}

    var h = '<div id="' + PANEL_ID + '">';
    h += '<div class="lop-title" data-lop-toggle="1">';
    h += '<span>OPERATOR WORKFLOW' + (domain ? ' \u00b7 ' + domain.toUpperCase() : ' \u00b7 ALL DOMAINS') + ' \u00b7 ' + stats.total + ' claims</span>';
    h += '<span style="font-size:0.22rem;color:rgba(201,169,78,0.25)">' + (collapsed ? '\u25B6' : '\u25BC') + '</span>';
    h += '</div>';
    h += '<div class="lop-body' + (collapsed ? ' collapsed' : '') + '">';

    // Stats
    h += '<div class="lop-stats">';
    h += '<span class="lop-stat">Claimed: <b>' + stats.claimed + '</b></span>';
    h += '<span class="lop-stat">In review: <b>' + stats.inReview + '</b></span>';
    h += '<span class="lop-stat">Submitted: <b>' + stats.submitted + '</b></span>';
    h += '<span class="lop-stat" style="color:#5ab5a0">Approved: <b>' + stats.approved + '</b></span>';
    h += '<span class="lop-stat" style="color:#e85454">Rejected: <b>' + stats.rejected + '</b></span>';
    h += '<span class="lop-stat">Closed: <b>' + stats.closed + '</b></span>';
    h += '</div>';

    // Payout summary
    h += '<div class="lop-payout">Est. total payout: <b>$' + stats.totalEstimatedPayout.toLocaleString() + '</b>';
    if (stats.totalActualPayout > 0) h += ' \u00b7 Actual: <b>$' + stats.totalActualPayout.toLocaleString() + '</b>';
    h += '</div>';

    // Claims list
    if (claims.length > 0) {
      h += '<div class="lop-claims">';
      // Sort: active first, then by date
      claims.sort(function (a, b) {
        if (a.status === 'closed' && b.status !== 'closed') return 1;
        if (a.status !== 'closed' && b.status === 'closed') return -1;
        return (b.claimedAt || 0) - (a.claimedAt || 0);
      });
      for (var i = 0; i < claims.length; i++) {
        var c = claims[i];
        var statusCls = 'lop-s-' + (c.status || 'claimed').replace(/ /g, '_');
        h += '<div class="lop-claim">';
        h += '<span class="lop-claim-title">' + esc(c.title) + '</span>';
        h += '<span style="font-size:0.26rem;color:#706860">' + esc((c.domain || '').toUpperCase()) + '</span>';
        h += '<span class="lop-claim-status ' + statusCls + '">' + (c.status || 'claimed').toUpperCase() + '</span>';
        h += '<span style="font-size:0.26rem;color:#5ab5a0">$' + (c.estimatedOperatorPayout || 0).toLocaleString() + '</span>';
        h += '<span class="lop-action">' + (ACTION_MAP[c.status] || '') + '</span>';
        h += '</div>';
      }
      h += '</div>';
    } else {
      h += '<div style="font-size:0.32rem;color:#706860;padding:8px 0">No claimed opportunities yet. Claim an opportunity to begin execution.</div>';
    }

    h += '</div></div>';
    return h;
  }

  function mount(container, domain) {
    if (!container) return;
    var existing = document.getElementById(PANEL_ID);
    if (existing) existing.remove();
    var div = document.createElement('div');
    div.innerHTML = render(domain);
    container.appendChild(div.firstChild);

    // Wire collapse toggle
    var toggle = container.querySelector('[data-lop-toggle]');
    if (toggle) {
      toggle.addEventListener('click', function () {
        var body = this.parentNode.querySelector('.lop-body');
        if (body) {
          body.classList.toggle('collapsed');
          try { sessionStorage.setItem('lop_collapsed', body.classList.contains('collapsed')); } catch (e) {}
          var arrow = this.querySelector('span:last-child');
          if (arrow) arrow.textContent = body.classList.contains('collapsed') ? '\u25B6' : '\u25BC';
        }
      });
    }
  }

  window.LIMENOperatorPanel = {
    render: render,
    mount: mount
  };

  console.log('[OperatorPanel] Global operator workflow panel loaded');
})();
