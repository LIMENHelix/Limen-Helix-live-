/**
 * law-opportunity-economics.js — Economics Preview per Opportunity Card
 *
 * Injects a small economics block into each Law opportunity card
 * showing estimated value, operator payout, platform share, time window.
 * Law-scoped only. No backend.
 *
 * Depends on: law-compensation.js
 * Namespace: window.LIMENLaw.economy.economics
 */
(function () {
  'use strict';

  window.LIMENLaw = window.LIMENLaw || {};
  window.LIMENLaw.economy = window.LIMENLaw.economy || {};

  var DEFAULT_VALUES = {
    grant: 50000,
    patent: 25000,
    loan: 100000,
    investment: 10000,
    invest: 10000,
    portal: 12000,
    filing: 15000,
    build: 40000
  };

  var _stylesInjected = false;
  function injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    var s = document.createElement('style');
    s.textContent = [
      '.loe-block{margin-top:6px;padding:6px 8px;background:rgba(201,169,78,0.02);border:1px solid rgba(201,169,78,0.06);border-radius:3px}',
      '.loe-header{font-size:0.26rem;letter-spacing:2px;text-transform:uppercase;color:rgba(201,169,78,0.3);margin-bottom:4px}',
      '.loe-row{display:flex;justify-content:space-between;padding:1px 0;font-size:0.32rem}',
      '.loe-label{color:#807868}',
      '.loe-val{color:#b0a898}',
      '.loe-val.highlight{color:#C9A94E}',
      '.loe-val.payout{color:#5ab5a0}',
      '.loe-disclaimer{font-size:0.24rem;color:#605850;margin-top:3px;font-style:italic}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function parseValueFromCard(card) {
    var valueEl = card.querySelector('.opp-card-value');
    if (valueEl) {
      var text = valueEl.textContent || '';
      var match = text.match(/\$?([\d,.]+)\s*[kK]/);
      if (match) return parseFloat(match[1].replace(/,/g, '')) * 1000;
      match = text.match(/\$?([\d,.]+)\s*[mM]/);
      if (match) return parseFloat(match[1].replace(/,/g, '')) * 1000000;
      match = text.match(/\$?([\d,]+)/);
      if (match) { var v = parseFloat(match[1].replace(/,/g, '')); if (v > 100) return v; }
    }
    return null;
  }

  function renderEconomics(type, estimatedValue, timeWindow, confidence) {
    injectStyles();
    var comp = window.LIMENLaw.economy.compensation;
    if (!comp) return '';
    var est = comp.estimate(estimatedValue, type);
    var h = '<div class="loe-block">';
    h += '<div class="loe-header">Economics Preview</div>';
    h += '<div class="loe-row"><span class="loe-label">Est. value</span><span class="loe-val highlight">$' + _fmt(est.estimatedValue) + '</span></div>';
    h += '<div class="loe-row"><span class="loe-label">Est. operator payout</span><span class="loe-val payout">$' + _fmt(est.operatorBasePayout) + '</span></div>';
    h += '<div class="loe-row"><span class="loe-label">Platform share</span><span class="loe-val">$' + _fmt(est.platformRetained) + '</span></div>';
    h += '<div class="loe-row"><span class="loe-label">Execution type</span><span class="loe-val">' + (est.label || type.toUpperCase()) + '</span></div>';
    if (timeWindow) h += '<div class="loe-row"><span class="loe-label">Time window</span><span class="loe-val">' + _esc(timeWindow) + '</span></div>';
    if (confidence) h += '<div class="loe-row"><span class="loe-label">Confidence</span><span class="loe-val">' + confidence + '%</span></div>';
    h += '<div class="loe-disclaimer">Estimated only \u2014 final value depends on actual execution outcome</div>';
    h += '</div>';
    return h;
  }

  function injectIntoCards() {
    injectStyles();
    var cards = document.querySelectorAll('.opp-card[data-id]');
    cards.forEach(function (card) {
      if (card.getAttribute('data-loe')) return;
      card.setAttribute('data-loe', '1');
      var badge = card.querySelector('.opp-card-type');
      if (!badge) return;
      var type = badge.textContent.trim().toLowerCase();
      var estimatedValue = parseValueFromCard(card) || DEFAULT_VALUES[type] || 25000;
      var timeWindow = '';
      var metas = card.querySelectorAll('.opp-card-meta span');
      if (metas.length >= 6) timeWindow = metas[metas.length - 1].textContent.trim();
      var confidence = '';
      for (var i = 0; i < metas.length; i++) {
        var t = metas[i].textContent;
        if (t.indexOf('CONF:') !== -1) { confidence = t.replace('CONF:', '').replace('%', '').trim(); break; }
      }
      var html = renderEconomics(type, estimatedValue, timeWindow, confidence);
      if (!html) return;
      var div = document.createElement('div');
      div.innerHTML = html;
      var lreg = card.querySelector('.lreg-wrap');
      if (lreg) { lreg.parentNode.insertBefore(div.firstChild, lreg); }
      else { card.appendChild(div.firstChild); }
    });
  }

  function _esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function _fmt(n) { return (n || 0).toLocaleString(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(injectIntoCards, 2100); });
  } else { setTimeout(injectIntoCards, 2100); }

  window.addEventListener('limen:domain-update', function () { setTimeout(injectIntoCards, 550); });

  window.LIMENLaw.economy.economics = {
    renderEconomics: renderEconomics,
    injectIntoCards: injectIntoCards,
    DEFAULT_VALUES: DEFAULT_VALUES
  };

  console.log('[LawOpportunityEconomics] Loaded \u2014 economics preview ready');
})();
