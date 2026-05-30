/**
 * agriculture-opportunity-economics.js — Economics Preview per Opportunity Card
 *
 * Injects a small economics block into each Agriculture opportunity card
 * showing estimated value, operator payout, platform share, time window.
 * Agriculture-scoped only. No backend.
 *
 * Depends on: agriculture-compensation.js
 * Namespace: window.LIMENAgriculture.economy.economics
 */
(function () {
  'use strict';

  window.LIMENAgriculture = window.LIMENAgriculture || {};
  window.LIMENAgriculture.economy = window.LIMENAgriculture.economy || {};

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
      '.aoe-block{margin-top:6px;padding:6px 8px;background:rgba(201,169,78,0.02);border:1px solid rgba(201,169,78,0.06);border-radius:3px}',
      '.aoe-header{font-size:0.26rem;letter-spacing:2px;text-transform:uppercase;color:rgba(201,169,78,0.3);margin-bottom:4px}',
      '.aoe-row{display:flex;justify-content:space-between;padding:1px 0;font-size:0.32rem}',
      '.aoe-label{color:#807868}',
      '.aoe-val{color:#b0a898}',
      '.aoe-val.highlight{color:#C9A94E}',
      '.aoe-val.payout{color:#5ab5a0}',
      '.aoe-disclaimer{font-size:0.24rem;color:#605850;margin-top:3px;font-style:italic}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── PARSE VALUE FROM CARD ───────────────────────────────────────────

  function parseValueFromCard(card) {
    var valueEl = card.querySelector('.opp-card-value');
    if (valueEl) {
      var text = valueEl.textContent || '';
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

    var comp = window.LIMENAgriculture.economy.compensation;
    if (!comp) return '';

    var est = comp.estimate(estimatedValue, type);

    var h = '<div class="aoe-block">';
    h += '<div class="aoe-header">Economics Preview</div>';
    h += '<div class="aoe-row"><span class="aoe-label">Est. value</span><span class="aoe-val highlight">$' + _fmt(est.estimatedValue) + '</span></div>';
    h += '<div class="aoe-row"><span class="aoe-label">Est. operator payout</span><span class="aoe-val payout">$' + _fmt(est.operatorBasePayout) + '</span></div>';
    h += '<div class="aoe-row"><span class="aoe-label">Platform share</span><span class="aoe-val">$' + _fmt(est.platformRetained) + '</span></div>';
    h += '<div class="aoe-row"><span class="aoe-label">Execution type</span><span class="aoe-val">' + (est.label || type.toUpperCase()) + '</span></div>';
    if (timeWindow) {
      h += '<div class="aoe-row"><span class="aoe-label">Time window</span><span class="aoe-val">' + _esc(timeWindow) + '</span></div>';
    }
    if (confidence) {
      h += '<div class="aoe-row"><span class="aoe-label">Confidence</span><span class="aoe-val">' + confidence + '%</span></div>';
    }
    h += '<div class="aoe-disclaimer">Estimated only \u2014 final value depends on actual execution outcome</div>';
    h += '</div>';

    return h;
  }

  // ── INJECT INTO CARDS ───────────────────────────────────────────────

  function injectIntoCards() {
    injectStyles();
    var cards = document.querySelectorAll('.opp-card[data-id]');

    cards.forEach(function (card) {
      if (card.getAttribute('data-aoe')) return; // already injected
      card.setAttribute('data-aoe', '1');

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

  window.LIMENAgriculture.economy.economics = {
    renderEconomics: renderEconomics,
    injectIntoCards: injectIntoCards,
    DEFAULT_VALUES: DEFAULT_VALUES
  };

  console.log('[AgricultureOpportunityEconomics] Loaded — economics preview ready');
})();
