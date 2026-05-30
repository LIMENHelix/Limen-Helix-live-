/**
 * law-claim-flow.js — Law Domain Claim Acceptance Flow
 *
 * Adds CLAIM button to Law opportunity cards. On click, opens
 * modal requiring acceptance of framework terms before creating
 * a claim record. Law-scoped only. No backend.
 *
 * Depends on: law-compensation.js, law-claim-ledger.js
 * Namespace: window.LIMENLaw.economy.claimFlow
 */
(function () {
  'use strict';

  window.LIMENLaw = window.LIMENLaw || {};
  window.LIMENLaw.economy = window.LIMENLaw.economy || {};

  var _stylesInjected = false;
  function injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    var s = document.createElement('style');
    s.textContent = [
      '.lcf-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(5,8,16,0.88);z-index:9998;display:flex;align-items:center;justify-content:center}',
      '.lcf-modal{background:#0e1018;border:1px solid rgba(201,169,78,0.2);border-radius:4px;padding:20px 24px;max-width:480px;width:92%;max-height:85vh;overflow-y:auto}',
      '.lcf-title{font-size:0.44rem;letter-spacing:2.5px;text-transform:uppercase;color:rgba(201,169,78,0.6);margin-bottom:14px;text-align:center}',
      '.lcf-section{margin-bottom:10px}',
      '.lcf-section-label{font-size:0.28rem;letter-spacing:2px;text-transform:uppercase;color:rgba(201,169,78,0.35);margin-bottom:3px}',
      '.lcf-section-body{font-size:0.34rem;color:#b0a898;line-height:1.5;padding:4px 8px;background:rgba(0,0,0,0.15);border-left:2px solid rgba(201,169,78,0.08);border-radius:0 2px 2px 0}',
      '.lcf-comp-row{display:flex;justify-content:space-between;padding:2px 0;font-size:0.34rem}',
      '.lcf-comp-label{color:#908878}',
      '.lcf-comp-val{color:#C9A94E}',
      '.lcf-accept{display:flex;align-items:flex-start;gap:8px;margin:14px 0 10px;padding:8px;background:rgba(201,169,78,0.03);border:1px solid rgba(201,169,78,0.1);border-radius:3px;cursor:pointer}',
      '.lcf-accept input{margin-top:2px;accent-color:#C9A94E;width:14px;height:14px;flex-shrink:0;cursor:pointer}',
      '.lcf-accept-text{font-size:0.32rem;color:#b0a898;line-height:1.5}',
      '.lcf-actions{display:flex;gap:8px;justify-content:center;margin-top:12px}',
      '.lcf-btn{font-family:inherit;font-size:0.30rem;letter-spacing:1.5px;padding:6px 18px;border-radius:2px;cursor:pointer;border:1px solid;transition:all 0.15s}',
      '.lcf-btn-confirm{color:#5ab5a0;border-color:rgba(90,181,160,0.3);background:rgba(90,181,160,0.08)}',
      '.lcf-btn-confirm:disabled{opacity:0.25;cursor:not-allowed}',
      '.lcf-btn-cancel{color:#908878;border-color:rgba(144,136,120,0.2);background:rgba(144,136,120,0.04)}',
      '.lcf-btn-cancel:hover{color:#C9A94E;border-color:rgba(201,169,78,0.3)}',
      '.lcf-claim-btn{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;font-family:inherit;font-size:0.30rem;letter-spacing:1.5px;text-transform:uppercase;background:rgba(201,169,78,0.08);border:1px solid rgba(201,169,78,0.2);color:#C9A94E;border-radius:2px;cursor:pointer;transition:all 0.15s;margin-top:6px}',
      '.lcf-claim-btn:hover{background:rgba(201,169,78,0.15);border-color:rgba(201,169,78,0.4)}',
      '.lcf-claimed-badge{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;font-family:inherit;font-size:0.28rem;letter-spacing:1.5px;text-transform:uppercase;background:rgba(90,181,160,0.06);border:1px solid rgba(90,181,160,0.15);color:#5ab5a0;border-radius:2px;margin-top:6px}',
      '.lcf-closed-badge{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;font-family:inherit;font-size:0.28rem;letter-spacing:1.5px;text-transform:uppercase;background:rgba(144,136,120,0.06);border:1px solid rgba(144,136,120,0.15);color:#908878;border-radius:2px;margin-top:6px}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function openClaimModal(opportunity) {
    injectStyles();

    var comp = window.LIMENLaw.economy.compensation;
    var type = (opportunity.type || 'grant').toLowerCase();
    var est = comp ? comp.estimate(opportunity.estimatedValue || _defaultValue(type), type) : null;

    var overlay = document.createElement('div');
    overlay.className = 'lcf-overlay';

    var h = '<div class="lcf-modal">';
    h += '<div class="lcf-title">Claim Law Opportunity</div>';

    h += '<div class="lcf-section">';
    h += '<div class="lcf-section-label">Opportunity</div>';
    h += '<div class="lcf-section-body">';
    h += '<div style="color:#e8e3d9;font-size:0.38rem;margin-bottom:3px">' + _esc(opportunity.title) + '</div>';
    h += '<div>Type: ' + type.toUpperCase() + '</div>';
    if (opportunity.valueRange) h += '<div>Value range: ' + _esc(opportunity.valueRange) + '</div>';
    h += '</div></div>';

    if (est) {
      h += '<div class="lcf-section">';
      h += '<div class="lcf-section-label">Compensation Model</div>';
      h += '<div class="lcf-section-body">';
      h += '<div class="lcf-comp-row"><span class="lcf-comp-label">Estimated value</span><span class="lcf-comp-val">$' + _fmt(est.estimatedValue) + '</span></div>';
      h += '<div class="lcf-comp-row"><span class="lcf-comp-label">Operator base (' + Math.round(est.operatorBasePct * 100) + '%)</span><span class="lcf-comp-val">$' + _fmt(est.operatorBasePayout) + '</span></div>';
      h += '<div class="lcf-comp-row"><span class="lcf-comp-label">Success bonus (' + Math.round(est.operatorSuccessPct * 100) + '%)</span><span class="lcf-comp-val">$' + _fmt(est.operatorSuccessPayout) + '</span></div>';
      h += '<div class="lcf-comp-row"><span class="lcf-comp-label">Platform share</span><span class="lcf-comp-val">$' + _fmt(est.platformRetained) + '</span></div>';
      h += '<div style="font-size:0.26rem;color:#706860;margin-top:4px">Estimated economics only \u2014 final value depends on actual execution outcome</div>';
      h += '</div></div>';
    }

    h += '<div class="lcf-section">';
    h += '<div class="lcf-section-label">Operator Obligations</div>';
    h += '<div class="lcf-section-body">';
    h += '<div>\u2022 Complete all required execution checklist sections</div>';
    h += '<div>\u2022 Submit truthful, documented work product</div>';
    h += '<div>\u2022 Respond to auditor review within 7 days</div>';
    h += '<div>\u2022 Record actual outcome when execution closes</div>';
    h += '</div></div>';

    h += '<div class="lcf-section">';
    h += '<div class="lcf-section-label">Risk / Compliance</div>';
    h += '<div class="lcf-section-body">';
    h += '<div>\u2022 No payout guaranteed until outcome is recorded and approved</div>';
    h += '<div>\u2022 Fraudulent submissions result in claim rejection</div>';
    h += '<div>\u2022 Operator is responsible for unauthorized practice of law restrictions in their jurisdiction</div>';
    h += '<div>\u2022 Operator is responsible for applicable bar admission and ethical compliance</div>';
    h += '</div></div>';

    h += '<label class="lcf-accept">';
    h += '<input type="checkbox" id="lcfAcceptCheck">';
    h += '<span class="lcf-accept-text">I understand this is a Law-domain execution claim, I am responsible for truthful submission, documented progress, and compliance with applicable bar/ethics rules and unauthorized-practice-of-law restrictions.</span>';
    h += '</label>';

    h += '<div class="lcf-actions">';
    h += '<button class="lcf-btn lcf-btn-cancel" id="lcfCancel">CANCEL</button>';
    h += '<button class="lcf-btn lcf-btn-confirm" id="lcfConfirm" disabled>CONFIRM CLAIM</button>';
    h += '</div>';

    h += '</div>';
    overlay.innerHTML = h;
    document.body.appendChild(overlay);

    var checkbox = overlay.querySelector('#lcfAcceptCheck');
    var confirmBtn = overlay.querySelector('#lcfConfirm');
    var cancelBtn = overlay.querySelector('#lcfCancel');

    checkbox.addEventListener('change', function () {
      confirmBtn.disabled = !this.checked;
    });

    cancelBtn.addEventListener('click', function () { overlay.remove(); });

    confirmBtn.addEventListener('click', function () {
      if (this.disabled) return;
      var claims = window.LIMENLaw.economy.claims;
      if (claims) {
        claims.createClaimRecord({
          id: opportunity.id,
          title: opportunity.title,
          type: type,
          estimatedValue: est ? est.estimatedValue : _defaultValue(type)
        });
      }
      overlay.remove();
      injectIntoCards();
    });

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });
  }

  function injectIntoCards() {
    injectStyles();
    var cards = document.querySelectorAll('.opp-card[data-id]');
    var claims = window.LIMENLaw.economy.claims;

    cards.forEach(function (card) {
      var oppId = card.getAttribute('data-id');
      if (!oppId) return;

      var old = card.querySelector('.lcf-claim-btn, .lcf-claimed-badge, .lcf-closed-badge');
      if (old) old.parentNode.removeChild(old);

      var existing = claims ? claims.getClaimByOppId(oppId) : null;

      var el;
      if (existing && (existing.status === 'closed' || existing.status === 'rejected')) {
        el = document.createElement('span');
        el.className = 'lcf-closed-badge';
        el.textContent = existing.status === 'rejected' ? '\u2717 REJECTED' : '\u2713 CLOSED';
      } else if (existing) {
        el = document.createElement('span');
        el.className = 'lcf-claimed-badge';
        el.textContent = '\u2713 CLAIMED';
      } else {
        el = document.createElement('button');
        el.className = 'lcf-claim-btn';
        el.textContent = '\u25CB CLAIM';
        el.addEventListener('click', (function (id) {
          return function (e) {
            e.stopPropagation();
            var titleEl = card.querySelector('.opp-card-title');
            var typeEl = card.querySelector('.opp-card-type');
            var valueEl = card.querySelector('.opp-card-value');
            openClaimModal({
              id: id,
              title: titleEl ? titleEl.textContent.trim() : '',
              type: typeEl ? typeEl.textContent.trim().toLowerCase() : 'grant',
              valueRange: valueEl ? valueEl.textContent.replace('POTENTIAL: ', '').trim() : ''
            });
          };
        })(oppId));
      }

      card.appendChild(el);
    });
  }

  function _esc(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function _fmt(n) { return (n || 0).toLocaleString(); }

  function _defaultValue(type) {
    var defaults = { grant: 50000, patent: 25000, loan: 100000, investment: 10000, invest: 10000, portal: 12000, filing: 15000, build: 40000 };
    return defaults[type] || 25000;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(injectIntoCards, 2400); });
  } else {
    setTimeout(injectIntoCards, 2400);
  }

  window.addEventListener('limen:domain-update', function () { setTimeout(injectIntoCards, 600); });
  window.addEventListener('limen:law-claim-update', function () { setTimeout(injectIntoCards, 100); });

  window.LIMENLaw.economy.claimFlow = {
    openClaimModal: openClaimModal,
    injectIntoCards: injectIntoCards
  };

  console.log('[LawClaimFlow] Loaded \u2014 claim acceptance flow ready');
})();
