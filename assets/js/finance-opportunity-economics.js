/**
 * finance-opportunity-economics.js — Economics Preview per Opportunity Card
 *
 * Injects a small economics block into each Finance opportunity card
 * showing estimated value, operator payout, platform share, time window.
 * Finance-scoped only. No backend.
 *
 * Depends on: finance-compensation.js
 * Namespace: window.LIMENFinance.economy.economics
 */
(function () {
  'use strict';

  window.LIMENFinance = window.LIMENFinance || {};
  window.LIMENFinance.economy = window.LIMENFinance.economy || {};

  // ── DEFAULT VALUES BY TYPE ──────────────────────────────────────────

  var DEFAULT_VALUES = {
    grant: 50000,
    patent: 25000,
    loan: 100000,
    investment: 10000,
    invest: 10000,
    portal: 12000,
    procure: 30000,
    build: 40000
  };

  // ── STYLES ──────────────────────────────────────────────────────────

  var _stylesInjected = false;
  function injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    var s = document.createElement('style');
    s.textContent = [
      '.foe-block{margin-top:6px;padding:6px 8px;background:rgba(201,169,78,0.02);border:1px solid rgba(201,169,78,0.06);border-radius:3px}',
      '.foe-header{font-size:0.26rem;letter-spacing:2px;text-transform:uppercase;color:rgba(201,169,78,0.3);margin-bottom:4px}',
      '.foe-row{display:flex;justify-content:space-between;padding:1px 0;font-size:0.32rem}',
      '.foe-label{color:#807868}',
      '.foe-val{color:#b0a898}',
      '.foe-val.highlight{color:#C9A94E}',
      '.foe-val.payout{color:#5ab5a0}',
      '.foe-disclaimer{font-size:0.24rem;color:#605850;margin-top:3px;font-style:italic}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── PARSE VALUE FROM CARD ───────────────────────────────────────────

  function parseValueFromCard(card) {
    var valueEl = card.querySelector('.opp-card-value');
    if (valueEl) {
      var text = valueEl.textContent || '';
      // Try to extract a numeric value from patterns like "$50K-200K" or "5-20% return"
      var match = text.match(/\$?([\d,.]+)\s*[kK]/);
      if (match) return parseFloat(match[1].replace(/,/g, '')) * 1000;
      match = text.match(/\$?([\d,.]+)\s*[mM]/);
      if (match) return parseFloat(match[1].replace(/,/g, '')) * 1000000;
      match = text.match(/\$?([\d,]+)/);
      if (match) {
        var v = parseFloat(match[1].replace(/,/g, ''));
        if (v > 100) return v;
      }
    }
    return null;
  }

  // ── RENDER ECONOMICS BLOCK ──────────────────────────────────────────

  function renderEconomics(type, estimatedValue, timeWindow, confidence) {
    injectStyles();

    var comp = window.LIMENFinance.economy.compensation;
    if (!comp) return '';

    var est = comp.estimate(estimatedValue, type);

    var h = '<div class="foe-block">';
    h += '<div class="foe-header">Economics Preview</div>';
    h += '<div class="foe-row"><span class="foe-label">Est. value</span><span class="foe-val highlight">$' + _fmt(est.estimatedValue) + '</span></div>';
    h += '<div class="foe-row"><span class="foe-label">Est. operator payout</span><span class="foe-val payout">$' + _fmt(est.operatorBasePayout) + '</span></div>';
    h += '<div class="foe-row"><span class="foe-label">Platform share</span><span class="foe-val">$' + _fmt(est.platformRetained) + '</span></div>';
    h += '<div class="foe-row"><span class="foe-label">Execution type</span><span class="foe-val">' + (est.label || type.toUpperCase()) + '</span></div>';
    if (timeWindow) {
      h += '<div class="foe-row"><span class="foe-label">Time window</span><span class="foe-val">' + _esc(timeWindow) + '</span></div>';
    }
    if (confidence) {
      h += '<div class="foe-row"><span class="foe-label">Confidence</span><span class="foe-val">' + confidence + '%</span></div>';
    }
    h += '<div class="foe-disclaimer">Estimated only \u2014 final value depends on actual execution outcome</div>';
    h += '</div>';

    return h;
  }

  // ── INJECT INTO CARDS ───────────────────────────────────────────────

  function injectIntoCards() {
    injectStyles();
    var cards = document.querySelectorAll('.opp-card[data-id]');

    cards.forEach(function (card) {
      if (card.getAttribute('data-foe')) return; // already injected
      card.setAttribute('data-foe', '1');

      // Detect type
      var badge = card.querySelector('.opp-card-type');
      if (!badge) return;
      var type = badge.textContent.trim().toLowerCase();

      // Get estimated value
      var estimatedValue = parseValueFromCard(card) || DEFAULT_VALUES[type] || 25000;

      // Get time window from meta
      var timeWindow = '';
      var metas = card.querySelectorAll('.opp-card-meta span');
      if (metas.length >= 6) timeWindow = metas[metas.length - 1].textContent.trim();

      // Get confidence
      var confidence = '';
      for (var i = 0; i < metas.length; i++) {
        var t = metas[i].textContent;
        if (t.indexOf('CONF:') !== -1) {
          confidence = t.replace('CONF:', '').replace('%', '').trim();
          break;
        }
      }

      var html = renderEconomics(type, estimatedValue, timeWindow, confidence);
      if (!html) return;

      var div = document.createElement('div');
      div.innerHTML = html;
      // Insert before the regulatory section if present, else append
      var lreg = card.querySelector('.lreg-wrap');
      if (lreg) {
        lreg.parentNode.insertBefore(div.firstChild, lreg);
      } else {
        card.appendChild(div.firstChild);
      }
    });
  }

  // ── HELPERS ─────────────────────────────────────────────────────────

  function _esc(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function _fmt(n) {
    return (n || 0).toLocaleString();
  }

  // ── AUTO-INJECT ─────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(injectIntoCards, 2100); });
  } else {
    setTimeout(injectIntoCards, 2100);
  }

  window.addEventListener('limen:domain-update', function () { setTimeout(injectIntoCards, 550); });

  // ── PUBLIC API ──────────────────────────────────────────────────────

  window.LIMENFinance.economy.economics = {
    renderEconomics: renderEconomics,
    injectIntoCards: injectIntoCards,
    DEFAULT_VALUES: DEFAULT_VALUES
  };

  console.log('[FinanceOpportunityEconomics] Loaded — economics preview ready');
})();
