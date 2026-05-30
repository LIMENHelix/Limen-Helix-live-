/**
 * operator-claim-flow.js — Global Claim Acceptance Flow
 *
 * Before an operator can claim ANY opportunity in ANY domain,
 * they must accept the execution framework terms.
 *
 * Shows modal with: opportunity summary, compensation, obligations,
 * acceptance checkbox, confirm button.
 *
 * Exposes: window.LIMENClaimFlow
 */
(function () {
  'use strict';

  var _stylesInjected = false;

  function injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    var s = document.createElement('style');
    s.textContent = [
      '.lcf-overlay{position:fixed;inset:0;z-index:600;background:rgba(3,5,10,0.90);display:flex;justify-content:center;align-items:center}',
      '.lcf-modal{background:#0e1018;border:1px solid rgba(201,169,78,0.2);border-radius:4px;padding:20px;width:min(520px,92vw);max-height:85vh;overflow-y:auto;font-family:"IBM Plex Mono",monospace}',
      '.lcf-title{font-size:0.5rem;letter-spacing:2px;color:#C9A94E;margin-bottom:12px}',
      '.lcf-section{margin-bottom:10px;padding:8px;border:1px solid rgba(201,169,78,0.08);border-radius:3px;background:rgba(0,0,0,0.15)}',
      '.lcf-section-title{font-size:0.28rem;letter-spacing:1.5px;color:rgba(201,169,78,0.85);text-transform:uppercase;margin-bottom:4px;font-weight:600}',
      '.lcf-row{display:flex;justify-content:space-between;font-size:0.36rem;color:#b0a898;padding:2px 0}',
      '.lcf-row b{color:#d0c8b8}',
      '.lcf-warn{font-size:0.32rem;color:#908878;padding:6px 8px;border-left:2px solid rgba(201,169,78,0.15);margin:8px 0;line-height:1.5}',
      '.lcf-check{display:flex;align-items:flex-start;gap:8px;font-size:0.34rem;color:#b0a898;line-height:1.5;margin:10px 0;cursor:pointer}',
      '.lcf-check input{margin-top:3px;accent-color:#C9A94E}',
      '.lcf-btns{display:flex;gap:8px;margin-top:12px}',
      '.lcf-btn{font-family:inherit;font-size:0.38rem;letter-spacing:1.5px;padding:8px 16px;border-radius:2px;cursor:pointer;transition:all 0.15s;flex:1;text-align:center}',
      '.lcf-btn-confirm{background:rgba(90,181,160,0.12);border:1px solid rgba(90,181,160,0.3);color:#5ab5a0}',
      '.lcf-btn-confirm:disabled{opacity:0.3;cursor:not-allowed}',
      '.lcf-btn-cancel{background:none;border:1px solid rgba(150,150,150,0.15);color:#888}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  /**
   * Open claim modal for any opportunity in any domain.
   * @param {object} opp — canonical opportunity object
   * @param {string} domain — domain name
   * @param {function} onConfirm — called with opp when confirmed
   */
  function openClaimModal(opp, domain, onConfirm) {
    injectStyles();

    var comp = window.LIMENCompensation;
    var pathType = (opp.path === 'GRANT-ELIGIBLE') ? 'grant' : (opp.path === 'PATENTABLE') ? 'patent' : (opp.path === 'INVESTABLE') ? 'investment' : 'grant';
    if (opp.paths && opp.paths.indexOf('BUSINESS') !== -1) pathType = 'business';
    var model = comp ? comp.getModel(pathType) : { operatorBasePct: 0.10, operatorSuccessPct: 0.15 };
    var est = comp ? comp.estimatePayout(pathType, opp.estimatedValue || null) : { estimatedValue: 0, operatorPayout: 0, platformRetained: 0 };

    var overlay = document.createElement('div');
    overlay.className = 'lcf-overlay';

    var h = '<div class="lcf-modal">';
    h += '<div class="lcf-title">CLAIM OPPORTUNITY</div>';

    // Section 1: Opportunity summary
    h += '<div class="lcf-section"><div class="lcf-section-title">OPPORTUNITY</div>';
    h += '<div class="lcf-row"><span>Title</span><b>' + esc((opp.title || '').replace(/_/g, ' ')) + '</b></div>';
    h += '<div class="lcf-row"><span>Domain</span><b>' + esc((domain || 'unknown').toUpperCase()) + '</b></div>';
    h += '<div class="lcf-row"><span>Path</span><b>' + esc(opp.path || '') + '</b></div>';
    h += '<div class="lcf-row"><span>Urgency</span><b>' + esc(opp.urgency || '') + '</b></div>';
    if (opp.window) h += '<div class="lcf-row"><span>Window</span><b>' + esc(opp.window) + '</b></div>';
    h += '</div>';

    // Section 2: Compensation
    h += '<div class="lcf-section"><div class="lcf-section-title">COMPENSATION</div>';
    h += '<div class="lcf-row"><span>Type</span><b>' + esc(model.label || pathType) + '</b></div>';
    h += '<div class="lcf-row"><span>Base rate</span><b>' + Math.round((model.operatorBasePct || 0) * 100) + '%</b></div>';
    h += '<div class="lcf-row"><span>Success rate</span><b>' + Math.round((model.operatorSuccessPct || 0) * 100) + '%</b></div>';
    h += '<div class="lcf-row"><span>Est. value</span><b>$' + (est.estimatedValue || 0).toLocaleString() + '</b></div>';
    h += '<div class="lcf-row"><span>Est. operator payout</span><b style="color:#5ab5a0">$' + (est.operatorPayout || 0).toLocaleString() + '</b></div>';
    h += '<div class="lcf-row"><span>Platform retained</span><b>$' + (est.platformRetained || 0).toLocaleString() + '</b></div>';
    h += '<div style="font-size:0.26rem;color:#706860;margin-top:4px">Estimated economics only — final value depends on actual execution outcome</div>';
    h += '</div>';

    // Section 3: Obligations
    h += '<div class="lcf-section"><div class="lcf-section-title">OPERATOR OBLIGATIONS</div>';
    h += '<div class="lcf-warn">By claiming this opportunity you agree to:</div>';
    h += '<div style="font-size:0.32rem;color:#b0a898;line-height:1.6;padding:0 8px">';
    h += '1. Execute using the provided workspace and step-by-step instructions<br>';
    h += '2. Submit truthful documentation and progress updates<br>';
    h += '3. Complete auditor review gates before final execution<br>';
    h += '4. Comply with all applicable regulations for this execution type<br>';
    h += '5. Report outcomes honestly — no fabricated results';
    h += '</div></div>';

    // Section 4: Risk / compliance
    h += '<div class="lcf-section"><div class="lcf-section-title">RISK &amp; COMPLIANCE</div>';
    h += '<div style="font-size:0.32rem;color:#908878;line-height:1.5;padding:0 8px">';
    h += 'Compensation is on successful outcomes only. No guaranteed payout. ';
    h += 'Investment losses are not charged to the operator. ';
    h += 'Grant and loan compliance violations may result in tier review. ';
    h += '<a href="/execution-framework" target="_blank" style="color:rgba(201,169,78,0.5)">View full Execution Framework</a>';
    h += '</div></div>';

    // Acceptance
    h += '<label class="lcf-check"><input type="checkbox" id="lcf-accept"> I understand this is a domain execution claim. I am responsible for truthful submission, documented progress, and compliance with the applicable workflow.</label>';

    // Buttons
    h += '<div class="lcf-btns">';
    h += '<button class="lcf-btn lcf-btn-confirm" id="lcf-confirm" disabled>CONFIRM CLAIM</button>';
    h += '<button class="lcf-btn lcf-btn-cancel" id="lcf-cancel">CANCEL</button>';
    h += '</div>';

    h += '</div>';
    overlay.innerHTML = h;
    document.body.appendChild(overlay);

    // Wire
    var checkbox = overlay.querySelector('#lcf-accept');
    var confirmBtn = overlay.querySelector('#lcf-confirm');
    var cancelBtn = overlay.querySelector('#lcf-cancel');

    checkbox.addEventListener('change', function () {
      confirmBtn.disabled = !this.checked;
    });

    cancelBtn.addEventListener('click', function () { overlay.remove(); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

    confirmBtn.addEventListener('click', function () {
      if (!checkbox.checked) return;
      overlay.remove();
      if (typeof onConfirm === 'function') onConfirm(opp, est);
    });
  }

  window.LIMENClaimFlow = {
    openClaimModal: openClaimModal
  };

  console.log('[ClaimFlow] Global claim acceptance flow loaded');
})();
