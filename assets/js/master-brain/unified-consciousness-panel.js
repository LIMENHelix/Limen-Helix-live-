/**
 * unified-consciousness-panel.js — the visible surface of the master brain.
 *
 * The master-brain scaffold (oib-assembler getOIB -> decision-engine decide ->
 * action-selection-gate winner-take-all) was fully built but DARK: it computes
 * every tick yet nothing renders it, so the "unified consciousness" looked gone.
 * This panel is its readout. It shows, across all 20 domains at once:
 *   1. OIB intake  — how many domains the master brain is reading + admissibility.
 *   2. Arbiter     — what decide() concluded (class + proposal + proposedNext).
 *   3. Selection   — the single winner-take-all pick + what it suppressed/vetoed.
 *
 * OBSERVE-ONLY BY DESIGN. It never arms anything: execution stays hard-false,
 * the action broadcast stays off (LIMEN_ENABLE_ACTION_GATE untouched). Calling
 * LIMENActionGate.run('unified-panel') only recomputes the observe-only state;
 * in DARK mode run() emits nothing, suppresses nothing, writes nothing. This
 * file adds a readout, not a behavior.
 *
 * Deterministic JS, no network, no token cost. ES5.
 */
(function () {
  'use strict';

  var GOLD = 'rgba(201,169,78,';
  var REFRESH_MS = 3000;
  var PANEL_ID = 'limen-unified-consciousness';
  var _el = null, _timer = null;

  function _n(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }

  // ── Reads (all defensive: a missing layer contributes '-' not a throw) ──

  function readOIB() {
    try {
      var mb = window.LIMENMasterBrain;
      if (!mb || typeof mb.getOIB !== 'function') return null;
      return mb.getOIB();
    } catch (e) { return null; }
  }

  function domainReach(oib) {
    // How many domains the master brain can actually read right now.
    var total = 20, available = null, freshMs = null, tier = null;
    try {
      if (oib && oib.sources && oib.sources.domains && typeof oib.sources.domains === 'object') {
        available = Object.keys(oib.sources.domains).length;
      }
      var env = oib && oib.envelopes && oib.envelopes.perSource && oib.envelopes.perSource.domains;
      if (env) {
        if (_n(env.available) != null) available = env.available;
        freshMs = _n(env.freshnessMs);
        tier = env.trustTier || null;
      }
    } catch (e) {}
    if (available == null) {
      try {
        var all = window.LIMENDomainBrains && window.LIMENDomainBrains.getAll && window.LIMENDomainBrains.getAll();
        if (all) available = Object.keys(all).length;
      } catch (e2) {}
    }
    return { total: total, available: available, freshMs: freshMs, tier: tier };
  }

  function readDecisions(oib) {
    try {
      var mb = window.LIMENMasterBrain;
      if (!mb || typeof mb.decide !== 'function') return [];
      var d = mb.decide(oib ? { oib: oib } : undefined);
      return Array.isArray(d) ? d : [];
    } catch (e) { return []; }
  }

  function readSelection() {
    // Recompute observe-only (safe in DARK) then read the recorded state.
    try {
      var g = window.LIMENActionGate;
      if (g && typeof g.run === 'function') g.run('unified-panel');
      if (g && typeof g.getState === 'function') {
        var s = g.getState();
        return (s && s.lastSelection) ? s.lastSelection : null;
      }
    } catch (e) {}
    return null;
  }

  // ── Render helpers ──

  function pill(text, tone) {
    var bg = tone === 'live' ? GOLD + '0.14)' : 'rgba(140,170,200,0.10)';
    var bd = tone === 'live' ? GOLD + '0.35)' : 'rgba(140,170,200,0.22)';
    var fg = tone === 'live' ? GOLD + '0.95)' : 'rgba(160,185,210,0.85)';
    return '<span style="display:inline-block;padding:2px 8px;border-radius:10px;background:' + bg +
      ';border:1px solid ' + bd + ';color:' + fg + ';font-size:0.62rem;letter-spacing:0.5px">' + text + '</span>';
  }

  function line(label, value) {
    return '<div style="display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-top:1px solid rgba(140,170,200,0.08)">' +
      '<span style="color:rgba(150,175,200,0.55);font-size:0.62rem;letter-spacing:0.5px;text-transform:uppercase">' + label + '</span>' +
      '<span style="color:rgba(200,220,240,0.92);font-size:0.72rem;text-align:right">' + value + '</span></div>';
  }

  function summarizeDecision(decisions) {
    if (!decisions || !decisions.length) return { klass: 'idle', text: 'no arbiter signal', next: 'none' };
    // Prefer the most consequential: contradiction > synthesis > no_action.
    var order = { insufficient_evidence: 3, contradiction: 4, executive_synthesis: 2, no_action: 1 };
    var best = decisions[0], bestScore = -1;
    for (var i = 0; i < decisions.length; i++) {
      var k = decisions[i] && decisions[i].class;
      var sc = (k && order[k] != null) ? order[k] : 0;
      if (sc > bestScore) { bestScore = sc; best = decisions[i]; }
    }
    var prop = best && best.proposal ? best.proposal : {};
    return {
      klass: (best && best.class) || 'unknown',
      text: (prop && typeof prop.text === 'string') ? prop.text : '(no proposal text)',
      next: (prop && prop.proposedNext) || 'none',
      count: decisions.length
    };
  }

  function render() {
    if (!_el) return;
    var oib = readOIB();
    var reach = domainReach(oib);
    var decisions = readDecisions(oib);
    var dec = summarizeDecision(decisions);
    var sel = readSelection();

    var reachStr = (reach.available == null ? '-' : reach.available) + ' / ' + reach.total +
      (reach.tier ? '  ' + pill(String(reach.tier).toUpperCase(), reach.tier === 'high' ? 'live' : 'dim') : '');
    var admTier = '-';
    try { if (oib && oib.admissibility && oib.admissibility.overallTier) admTier = String(oib.admissibility.overallTier).toUpperCase(); } catch (e) {}

    var decStr = pill(dec.klass.replace(/_/g, ' '), dec.klass === 'no_action' || dec.klass === 'idle' ? 'dim' : 'live') +
      ' <span style="color:rgba(150,175,200,0.55)">to</span> ' + (dec.next || 'none').replace(/_/g, ' ');

    var selStr;
    if (sel && sel.winner && sel.winner.label) {
      selStr = '<span style="color:' + GOLD + '0.95)">' + sel.winner.label + '</span>' +
        ' <span style="color:rgba(150,175,200,0.5);font-size:0.62rem">(' + (sel.winner.source || '?') +
        (sel.winner.score != null ? ', ' + sel.winner.score : '') + ')</span>';
    } else {
      selStr = '<span style="color:rgba(150,175,200,0.5)">no candidate this cycle</span>';
    }
    var supStr = sel ? ((sel.suppressedCount || 0) + ' suppressed · ' + (sel.vetoed || 0) + ' vetoed · ' + (sel.candidateCount || 0) + ' candidates') : '-';

    _el.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
        '<div style="color:' + GOLD + '0.9);font-size:0.72rem;letter-spacing:2px;font-weight:600">UNIFIED CONSCIOUSNESS</div>' +
        pill('OBSERVE ONLY', 'dim') +
      '</div>' +
      '<div style="color:rgba(150,175,200,0.5);font-size:0.6rem;letter-spacing:1px;margin-bottom:6px">MASTER BRAIN reading all domains, selecting one</div>' +
      line('Reading domains', reachStr) +
      line('Admissibility', admTier) +
      line('Arbiter', decStr) +
      line('Proposal', '<span style="color:rgba(200,220,240,0.8);font-size:0.66rem">' + dec.text + '</span>') +
      line('Would select', selStr) +
      line('Suppression', supStr) +
      '<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(140,170,200,0.08);color:rgba(150,175,200,0.45);font-size:0.58rem;letter-spacing:0.5px">' +
        'Execution FALSE (hard-pinned) · action broadcast OFF' +
      '</div>';
  }

  function build() {
    var el = document.getElementById(PANEL_ID);
    if (el) { _el = el; return true; }
    el = document.createElement('div');
    el.id = PANEL_ID;
    el.style.cssText =
      'background:rgba(8,12,22,0.92);border:1px solid ' + GOLD + '0.18);border-radius:8px;' +
      'padding:12px 14px;margin:0 0 12px 0;font-family:inherit;box-shadow:0 2px 18px rgba(0,0,0,0.4)';
    // Prefer the center column; fall back to a fixed card so it is never orphaned.
    var col = document.getElementById('col-center');
    if (col) {
      col.insertBefore(el, col.firstChild);
    } else {
      el.style.position = 'fixed';
      el.style.top = '70px';
      el.style.left = '50%';
      el.style.transform = 'translateX(-50%)';
      el.style.width = 'min(420px,92vw)';
      el.style.zIndex = '40';
      document.body.appendChild(el);
    }
    _el = el;
    return true;
  }

  function start() {
    if (_timer) return;
    var tries = 0;
    var boot = setInterval(function () {
      tries++;
      if (build() || tries > 20) {
        clearInterval(boot);
        render();
        _timer = setInterval(render, REFRESH_MS);
        // Re-render promptly when the brain actually moves.
        try {
          window.addEventListener('limen:domain-update', render);
          window.addEventListener('limen:civilization-packets-update', render);
        } catch (e) {}
      }
    }, 500);
  }

  try {
    if (typeof window !== 'undefined') {
      window.LIMENUnifiedConsciousness = { render: render, start: start };
      if (document.readyState !== 'loading') start();
      else document.addEventListener('DOMContentLoaded', start);
    }
  } catch (e) {}
})();
