/**
 * execution-regulatory.js — Regulatory Citation Layer
 *
 * Additive module. Provides per-opportunity-type regulatory citations
 * and injects expandable "REGULATORY" sections into opportunity cards
 * and execution panels. Read-only, never blocks flow.
 *
 * Exposes: window.LIMENRegulatory
 */
(function () {
  'use strict';

  var REGULATORY = {
    grant: {
      citation: '2 CFR Part 200 (Uniform Guidance)',
      rules: [
        'Allowable costs (\u00a7200.403)',
        'Procurement standards (\u00a7200.317\u2013326)',
        'Single Audit threshold $750K (\u00a7200.501)'
      ]
    },
    patent: {
      citation: '35 U.S.C. \u00a7111(b)',
      rules: [
        'Provisional filing requirements',
        '12-month conversion deadline',
        'USPTO specification standards'
      ]
    },
    loan: {
      citation: '15 U.S.C. \u00a7636 (SBA Loans)',
      rules: [
        'Eligibility requirements',
        'Use of proceeds',
        'Guarantee structure'
      ]
    },
    invest: {
      citation: 'SEC Rule 10b-5 + Investment Advisers Act',
      rules: [
        'No misleading statements',
        'No insider trading',
        'Not financial advice disclaimer'
      ]
    },
    procure: {
      citation: 'FAR Part 12 (Commercial Items)',
      rules: [
        'Simplified acquisition thresholds',
        'Competition requirements',
        'Fair opportunity doctrine'
      ]
    },
    build: {
      citation: 'State licensing + IBC/IRC codes',
      rules: [
        'Contractor licensing requirements',
        'Building code compliance',
        'Permitting obligations'
      ]
    }
  };

  // Alias: "investment" maps to "invest"
  REGULATORY.investment = REGULATORY.invest;

  // ── STYLES ──────────────────────────────────────────────────────────
  var _stylesInjected = false;
  function injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    var s = document.createElement('style');
    s.textContent = [
      '.lreg-wrap{margin-top:6px}',
      '.lreg-toggle{display:flex;align-items:center;gap:4px;cursor:pointer;user-select:none;padding:3px 0}',
      '.lreg-toggle:hover .lreg-label{color:rgba(201,169,78,0.7)}',
      '.lreg-icon{font-size:0.28rem;color:rgba(201,169,78,0.35);transition:transform 0.15s}',
      '.lreg-icon.open{transform:rotate(90deg)}',
      '.lreg-label{font-size:0.28rem;letter-spacing:2px;text-transform:uppercase;color:rgba(201,169,78,0.35);transition:color 0.15s}',
      '.lreg-body{display:none;padding:4px 0 4px 12px;border-left:2px solid rgba(201,169,78,0.08)}',
      '.lreg-body.open{display:block}',
      '.lreg-cite{font-size:0.32rem;color:#C9A94E;margin-bottom:3px}',
      '.lreg-rule{font-size:0.30rem;color:#908878;padding:1px 0}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── RENDER ──────────────────────────────────────────────────────────

  /**
   * Returns HTML string for an expandable regulatory section.
   * @param {string} type - opportunity type (grant, patent, loan, invest, etc.)
   * @returns {string} HTML or empty string if no data
   */
  function renderRegulatory(type) {
    var key = (type || '').toLowerCase();
    var data = REGULATORY[key];
    if (!data) return '';

    injectStyles();

    var id = 'lreg_' + Math.random().toString(36).substr(2, 6);
    var h = '<div class="lreg-wrap">';
    h += '<div class="lreg-toggle" onclick="(function(e){var b=document.getElementById(\'' + id + '\');var i=e.currentTarget.querySelector(\'.lreg-icon\');if(b){b.classList.toggle(\'open\');if(i)i.classList.toggle(\'open\')}})(event)">';
    h += '<span class="lreg-icon">\u25B6</span>';
    h += '<span class="lreg-label">REGULATORY</span>';
    h += '</div>';
    h += '<div class="lreg-body" id="' + id + '">';
    h += '<div class="lreg-cite">' + data.citation + '</div>';
    for (var i = 0; i < data.rules.length; i++) {
      h += '<div class="lreg-rule">\u2022 ' + data.rules[i] + '</div>';
    }
    h += '</div></div>';
    return h;
  }

  /**
   * Scans the DOM for opportunity cards and appends regulatory sections.
   * Safe to call multiple times — skips cards already processed.
   */
  function injectIntoCards() {
    injectStyles();
    var cards = document.querySelectorAll('.opp-card[data-id]');
    cards.forEach(function (card) {
      if (card.getAttribute('data-lreg')) return; // already injected
      // Detect type from the card's type badge
      var badge = card.querySelector('.opp-card-type');
      if (!badge) return;
      var type = badge.textContent.trim().toLowerCase();
      var html = renderRegulatory(type);
      if (!html) return;
      card.setAttribute('data-lreg', '1');
      var div = document.createElement('div');
      div.innerHTML = html;
      card.appendChild(div.firstChild);
    });
  }

  /**
   * Injects regulatory section into execution panel auditor blocks.
   * Called after panels render.
   */
  function injectIntoPanel(panelEl, type) {
    if (!panelEl || panelEl.getAttribute('data-lreg')) return;
    var html = renderRegulatory(type);
    if (!html) return;
    panelEl.setAttribute('data-lreg', '1');
    // Insert before the auditor section if present
    var auditor = panelEl.querySelector('.eep-auditor');
    var div = document.createElement('div');
    div.innerHTML = html;
    if (auditor) {
      auditor.parentNode.insertBefore(div.firstChild, auditor);
    } else {
      panelEl.appendChild(div.firstChild);
    }
  }

  // ── PUBLIC API ──────────────────────────────────────────────────────

  window.LIMENRegulatory = {
    data: REGULATORY,
    render: renderRegulatory,
    injectIntoCards: injectIntoCards,
    injectIntoPanel: injectIntoPanel
  };

  // Auto-inject into cards after DOM settles
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(injectIntoCards, 2000); });
  } else {
    setTimeout(injectIntoCards, 2000);
  }

  // Re-inject on domain updates (opportunities may re-render)
  window.addEventListener('limen:domain-update', function () { setTimeout(injectIntoCards, 500); });

  console.log('[LIMENRegulatory] Loaded — regulatory citations ready');
})();
