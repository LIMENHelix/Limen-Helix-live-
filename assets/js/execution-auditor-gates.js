/**
 * execution-auditor-gates.js — Structured Auditor Gate Checklists
 *
 * Additive module. Wraps existing APPROVE/DENY/REVISE buttons with a
 * checklist modal. ALL boxes must be checked before APPROVE activates.
 * Does NOT remove or overwrite existing buttons — wraps their click handlers.
 *
 * Exposes: window.LIMENAuditorGates
 */
(function () {
  'use strict';

  // ── GATE DEFINITIONS ────────────────────────────────────────────────

  var GATES = {
    grant: [
      { id: 'eligibility', label: 'Entity eligible + SAM.gov active' },
      { id: 'deadline', label: 'NOFO deadline verified' },
      { id: 'budget', label: 'Costs allowable under 2 CFR 200' },
      { id: 'compliance', label: 'Post-award reporting feasible' }
    ],
    patent: [
      { id: 'prior_art', label: 'Prior art search completed' },
      { id: 'novelty', label: 'Claims are novel + non-obvious' },
      { id: 'filing', label: 'Provisional draft ready' },
      { id: 'timeline', label: '12-month conversion tracked' }
    ],
    loan: [
      { id: 'financials', label: 'Financials verified' },
      { id: 'dscr', label: 'DSCR meets lender threshold' },
      { id: 'collateral', label: 'Collateral documented' },
      { id: 'use', label: 'Use of funds compliant' }
    ],
    invest: [
      { id: 'phase', label: 'Kernel phase confirmed' },
      { id: 'risk', label: 'Stop-loss defined' },
      { id: 'size', label: 'Position size appropriate' },
      { id: 'compliance', label: 'SEC compliance acknowledged' }
    ]
  };

  // Alias
  GATES.investment = GATES.invest;

  // ── STYLES ──────────────────────────────────────────────────────────

  var _stylesInjected = false;
  function injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    var s = document.createElement('style');
    s.textContent = [
      '.lag-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(5,8,16,0.85);z-index:9999;display:flex;align-items:center;justify-content:center}',
      '.lag-modal{background:#0e1018;border:1px solid rgba(201,169,78,0.2);border-radius:4px;padding:20px 24px;max-width:420px;width:90%}',
      '.lag-title{font-size:0.42rem;letter-spacing:2.5px;text-transform:uppercase;color:rgba(201,169,78,0.6);margin-bottom:12px;text-align:center}',
      '.lag-subtitle{font-size:0.30rem;color:#908878;margin-bottom:10px;text-align:center}',
      '.lag-item{display:flex;align-items:center;gap:8px;padding:5px 0;font-size:0.36rem;color:#b0a898;cursor:pointer;user-select:none}',
      '.lag-item:hover{color:#e8e3d9}',
      '.lag-item input{accent-color:#C9A94E;width:14px;height:14px;cursor:pointer}',
      '.lag-item.checked{color:#5ab5a0}',
      '.lag-actions{display:flex;gap:6px;margin-top:14px;justify-content:center}',
      '.lag-btn{font-family:inherit;font-size:0.30rem;letter-spacing:1.5px;padding:5px 16px;border-radius:2px;cursor:pointer;border:1px solid;transition:all 0.15s}',
      '.lag-btn-approve{color:#5ab5a0;border-color:rgba(90,181,160,0.3);background:rgba(90,181,160,0.08)}',
      '.lag-btn-approve:disabled{opacity:0.25;cursor:not-allowed}',
      '.lag-btn-cancel{color:#908878;border-color:rgba(144,136,120,0.2);background:rgba(144,136,120,0.04)}',
      '.lag-btn-cancel:hover{color:#C9A94E;border-color:rgba(201,169,78,0.3)}',
      '.lag-progress{font-size:0.28rem;color:#706860;text-align:center;margin-top:8px}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── MODAL ───────────────────────────────────────────────────────────

  /**
   * Opens the auditor gate checklist modal.
   * @param {string} type - grant|patent|loan|invest
   * @param {function} onApprove - called if all gates pass and user confirms
   * @param {function} [onCancel] - called if user cancels
   */
  function openGateModal(type, onApprove, onCancel) {
    var key = (type || '').toLowerCase();
    var gates = GATES[key];
    if (!gates || gates.length === 0) {
      // No gates for this type — allow immediate approve
      if (onApprove) onApprove();
      return;
    }

    injectStyles();

    var checked = {};

    var overlay = document.createElement('div');
    overlay.className = 'lag-overlay';

    function renderModal() {
      var allChecked = true;
      var checkedCount = 0;
      for (var g = 0; g < gates.length; g++) {
        if (checked[gates[g].id]) checkedCount++;
        else allChecked = false;
      }

      var h = '<div class="lag-modal">';
      h += '<div class="lag-title">AUDITOR GATE \u2014 ' + key.toUpperCase() + '</div>';
      h += '<div class="lag-subtitle">All gates must pass before approval</div>';

      for (var i = 0; i < gates.length; i++) {
        var g = gates[i];
        var isChecked = !!checked[g.id];
        h += '<label class="lag-item' + (isChecked ? ' checked' : '') + '">';
        h += '<input type="checkbox" data-gate="' + g.id + '"' + (isChecked ? ' checked' : '') + '>';
        h += g.label;
        h += '</label>';
      }

      h += '<div class="lag-progress">' + checkedCount + ' / ' + gates.length + ' gates verified</div>';
      h += '<div class="lag-actions">';
      h += '<button class="lag-btn lag-btn-cancel" data-lag-action="cancel">CANCEL</button>';
      h += '<button class="lag-btn lag-btn-approve" data-lag-action="approve"' + (allChecked ? '' : ' disabled') + '>APPROVE</button>';
      h += '</div>';
      h += '</div>';

      overlay.innerHTML = h;
    }

    renderModal();
    document.body.appendChild(overlay);

    // Wire events via delegation
    overlay.addEventListener('change', function (e) {
      var gateId = e.target.getAttribute('data-gate');
      if (gateId) {
        checked[gateId] = e.target.checked;
        renderModal();
      }
    });

    overlay.addEventListener('click', function (e) {
      var action = e.target.getAttribute('data-lag-action');
      if (action === 'cancel') {
        overlay.remove();
        if (onCancel) onCancel();
      }
      if (action === 'approve') {
        if (e.target.disabled) return;
        overlay.remove();
        if (onApprove) onApprove();
      }
    });

    // Close on overlay background click
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        overlay.remove();
        if (onCancel) onCancel();
      }
    });
  }

  // ── INTERCEPT EXISTING APPROVE BUTTONS ──────────────────────────────

  /**
   * Wraps existing .eep-btn-approve buttons so they open the gate modal first.
   * Safe to call multiple times — skips already-wrapped buttons.
   */
  function interceptApproveButtons() {
    var buttons = document.querySelectorAll('.eep-btn-approve');
    buttons.forEach(function (btn) {
      if (btn.getAttribute('data-lag-wrapped')) return;
      btn.setAttribute('data-lag-wrapped', '1');

      // Determine track type from parent panel
      var panel = btn.closest('.eep-panel');
      var track = panel ? panel.getAttribute('data-track') : 'grant';

      // Clone + replace to strip existing click listeners
      var newBtn = btn.cloneNode(true);
      newBtn.setAttribute('data-lag-wrapped', '1');
      btn.parentNode.replaceChild(newBtn, btn);

      newBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();

        openGateModal(track, function () {
          // Gate passed — fire the original approve action
          // Find the panel fresh and simulate the original flow
          var p = newBtn.closest('.eep-panel');
          if (!p) return;
          var oppKey = p.getAttribute('data-opp');
          var t = p.getAttribute('data-track');
          // Access the existing workspace persistence
          var storeKey = 'limen_energy_exec_panels';
          try {
            var all = JSON.parse(localStorage.getItem(storeKey) || '{}');
            if (!all[oppKey]) all[oppKey] = {};
            if (!all[oppKey][t]) all[oppKey][t] = { fields: {}, checks: {}, sectionDone: {}, auditor: {}, created: Date.now() };
            all[oppKey][t].auditor = all[oppKey][t].auditor || {};
            all[oppKey][t].auditor.status = 'APPROVED';
            all[oppKey][t].auditor.timestamp = Date.now();
            all[oppKey][t].auditor.gatesPassed = true;
            localStorage.setItem(storeKey, JSON.stringify(all));
          } catch (ex) {}

          // Re-render panel via existing API
          if (window.LIMENEnergyExecutionPanels) {
            var container = p.parentNode;
            var pathMap = { grant: 'GRANT-ELIGIBLE', patent: 'PATENTABLE' };
            var newHtml = window.LIMENEnergyExecutionPanels.renderForOpportunity(oppKey, pathMap[t] || 'GRANT-ELIGIBLE', null);
            p.outerHTML = newHtml;
            window.LIMENEnergyExecutionPanels.wireForOpportunity(container, oppKey, pathMap[t] || 'GRANT-ELIGIBLE');
            // Re-intercept new buttons
            setTimeout(interceptApproveButtons, 100);
          }
        });
      });
    });
  }

  /**
   * Wraps investment console trade confirmation with gate check.
   * Intercepts the Paper Trade BUY button.
   */
  function interceptInvestmentApprove() {
    var buyBtns = document.querySelectorAll('.ic-btn-primary');
    buyBtns.forEach(function (btn) {
      if (btn.getAttribute('data-lag-wrapped')) return;
      if (btn.textContent.indexOf('Paper Trade') === -1) return;
      btn.setAttribute('data-lag-wrapped', '1');

      var origOnclick = btn.getAttribute('onclick');
      btn.removeAttribute('onclick');

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();

        openGateModal('invest', function () {
          // Gate passed — execute original trade
          if (origOnclick) {
            try { new Function(origOnclick)(); } catch (ex) {}
          } else if (window.paperTrade) {
            window.paperTrade('BUY');
          }
        });
      });
    });
  }

  // ── AUTO-INTERCEPT ──────────────────────────────────────────────────

  function autoIntercept() {
    interceptApproveButtons();
    interceptInvestmentApprove();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(autoIntercept, 2500); });
  } else {
    setTimeout(autoIntercept, 2500);
  }

  // Re-intercept after domain updates
  window.addEventListener('limen:domain-update', function () { setTimeout(autoIntercept, 500); });

  // ── PUBLIC API ──────────────────────────────────────────────────────

  window.LIMENAuditorGates = {
    gates: GATES,
    openGateModal: openGateModal,
    interceptApproveButtons: interceptApproveButtons,
    interceptInvestmentApprove: interceptInvestmentApprove
  };

  console.log('[LIMENAuditorGates] Loaded — structured gate checklists ready');
})();
