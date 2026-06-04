/**
 * live-discoveries.js — Feed → Discovery (Stage 1).
 *
 * The brain-region atlas found that the live feed→domain intelligence never
 * reaches "discoveries": discovery-engine.js weights by stress but only over
 * ~21 hardcoded seed phrases, and renders nowhere. This module closes the gap
 * with REAL, feed-derived discoveries: it reads the 20 domain brains' live
 * ACTIVE diagnoses (which are feed→signal→diagnosis), weights each by the
 * domain's live feed-stress, and surfaces the top ones. console-clarity folds
 * the rendered section in (one flag-gated line).
 *
 * A "discovery" here = a domain's currently-active, feed-driven diagnosis,
 * ranked by feed pressure. Epistemically these are INFERRED (a diagnosis), NOT
 * proven — the render badges them as such; raw feed numbers never appear as
 * proven findings.
 *
 * DARK BY DEFAULT. With window.LIMEN_ENABLE_LIVE_DISCOVERIES falsy, renderInto()
 * produces nothing (console-clarity appends nothing) and compute() is harmless
 * read-only. Flip the flag to surface the section.
 *
 * Loads via bootstrap CONSOLE_MODULES; api: LIMENLiveDiscoveriesUI.
 */
(function () {
  'use strict';

  var MAX = 16;
  var _debounce = null;
  var _cube = null, _cubeTried = false;

  // Stage 2: fetch the slim per-domain cube discovery index once. Exists on the
  // full deployment (where the cube lives); 404s harmlessly elsewhere (then only
  // the Stage-1 brain-diagnosis discoveries show).
  function _fetchCube() {
    if (_cubeTried) return; _cubeTried = true;
    try {
      if (typeof fetch !== 'function') return;
      fetch('/assets/data/treatment-discovery/discoveries-by-domain.json', { cache: 'force-cache' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { if (j && j.byDomain) { _cube = j.byDomain; compute(); } })
        .catch(function () {});
    } catch (e) {}
  }

  function _enabled() {
    try { return !!(typeof window !== 'undefined' && window.LIMEN_ENABLE_LIVE_DISCOVERIES); }
    catch (e) { return false; }
  }

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function _states() {
    try {
      if (window.LIMENDomainBrainBase && typeof window.LIMENDomainBrainBase.getAllStates === 'function') {
        return window.LIMENDomainBrainBase.getAllStates() || {};
      }
      if (window.LIMENDomainBrains && typeof window.LIMENDomainBrains.getAllStates === 'function') {
        return window.LIMENDomainBrains.getAllStates() || {};
      }
    } catch (e) {}
    return {};
  }

  // Build feed-weighted discoveries from live active diagnoses. Score blends the
  // domain's live feed-stress (0.6) with the diagnosis relevance (0.4), so a
  // high-stress domain's strongly-matched diagnosis rises to the top.
  function compute() {
    var states = _states();
    var out = [];
    for (var domain in states) {
      if (!Object.prototype.hasOwnProperty.call(states, domain)) continue;
      var s = states[domain];
      if (!s) continue;
      var stress = (typeof s.stress === 'number') ? s.stress
                 : (typeof s.brainStress === 'number') ? s.brainStress : 0;
      var phase = s.phaseLabel || s.phase || '';
      var dxs = s.diagnoses || [];
      for (var i = 0; i < dxs.length; i++) {
        var dx = dxs[i];
        if (!dx || !dx.active) continue;
        var rel = (typeof dx.relevance === 'number') ? dx.relevance : 0;
        var score = Math.round((stress * 0.6 + rel * 0.4) * 1000) / 1000;
        out.push({
          domain: domain, type: 'diagnosis',
          label: dx.label || dx.id || 'diagnosis',
          summary: dx.summary || '',
          stress: Math.round(stress * 100) / 100,
          phase: phase,
          relevance: rel,
          matched: dx.matchedConditions, total: dx.totalTriggers,
          score: score,
          source: dx.source || 'canonical',
          evidenceState: 'inferred' // a diagnosis — inferred, never "proven"
        });
      }
    }
    // Stage 2: merge the cube's real residual-discoveries for each domain,
    // weighted by the SAME live feed-stress (0.6*stress + 0.4*novelty*feasibility).
    if (_cube) {
      for (var dom2 in states) {
        if (!Object.prototype.hasOwnProperty.call(states, dom2)) continue;
        var s2 = states[dom2]; if (!s2) continue;
        var stress2 = (typeof s2.stress === 'number') ? s2.stress
                    : (typeof s2.brainStress === 'number') ? s2.brainStress : 0;
        var cubeList = _cube[dom2]; if (!cubeList || !cubeList.length) continue;
        for (var ci = 0; ci < cubeList.length; ci++) {
          var cd = cubeList[ci];
          var nf = (cd.novelty || 0) * (cd.feasibility || 0);
          out.push({
            domain: dom2, type: 'discovery',
            label: (cd.treatment || 'discovery') + ' → ' + dom2,
            summary: cd.rationale || '',
            stress: Math.round(stress2 * 100) / 100,
            phase: (s2.phaseLabel || s2.phase || ''),
            novelty: cd.novelty, feasibility: cd.feasibility, node: cd.node,
            percentVerified: cd.percentVerified,
            score: Math.round((stress2 * 0.6 + nf * 0.4) * 1000) / 1000,
            source: 'cube-residual',
            evidenceState: (cd.percentVerified >= 0.5 ? 'partly-verified' : 'inferred')
          });
        }
      }
    }
    out.sort(function (a, b) { return b.score - a.score; });
    var top = out.slice(0, MAX);
    try { window.LIMENLiveDiscoveries = top; } catch (e) {}
    _dispatch('limen:live-discoveries-updated', { count: top.length });
    return top;
  }

  function _dispatch(type, detail) {
    try {
      if (typeof window !== 'undefined' && typeof window.CustomEvent === 'function' && window.dispatchEvent) {
        window.dispatchEvent(new window.CustomEvent(type, { detail: detail }));
      }
    } catch (e) {}
  }

  // Render the section INTO the provided element. DARK → leaves it empty so
  // console-clarity appends nothing. Diagnoses are badged INFERRED, never proven.
  function renderInto(el) {
    if (!el) return;
    if (!_enabled()) { el.innerHTML = ''; return; }
    var list = (window.LIMENLiveDiscoveries && window.LIMENLiveDiscoveries.length)
      ? window.LIMENLiveDiscoveries : compute();
    if (!list || !list.length) { el.innerHTML = ''; return; }
    var html = '<div class="clr-section-title">LIVE DISCOVERIES — feed-driven</div>';
    for (var i = 0; i < list.length; i++) {
      var d = list[i];
      var relTxt = (d.matched != null && d.total != null) ? (d.matched + '/' + d.total) : (d.relevance != null ? d.relevance : '?');
      var badge = (d.type === 'discovery')
        ? 'DISCOVERY · nov ' + _esc(d.novelty != null ? d.novelty : '?')
        : 'DIAGNOSIS · ' + _esc(relTxt);
      html += '<div class="clr-disc-row">' +
        '<span class="clr-disc-dom">' + _esc(d.domain) + '</span>' +
        '<span class="clr-disc-label">' + _esc(d.label) + '</span>' +
        '<span class="clr-disc-badge">' + badge + '</span>' +
        '<span class="clr-disc-meta">stress ' + _esc(d.stress) + (d.phase ? ' · ' + _esc(d.phase) : '') + '</span>' +
        (d.summary ? '<div class="clr-disc-sum">' + _esc(d.summary) + '</div>' : '') +
        '</div>';
    }
    el.innerHTML = html;
  }

  function _injectStyle() {
    try {
      if (typeof document === 'undefined' || document.getElementById('clr-disc-style')) return;
      var st = document.createElement('style');
      st.id = 'clr-disc-style';
      st.textContent = [
        '.clr-disc-row{padding:3px 0;border-top:1px solid rgba(201,169,78,0.06);font-size:0.46rem;line-height:1.5}',
        '.clr-disc-dom{display:inline-block;min-width:78px;color:rgba(201,169,78,0.7);text-transform:uppercase;letter-spacing:1px;font-size:0.4rem}',
        '.clr-disc-label{color:#e8e3d9}',
        '.clr-disc-badge{margin-left:6px;color:#b08fd6;font-size:0.38rem;letter-spacing:0.5px}',
        '.clr-disc-meta{margin-left:6px;color:rgba(200,195,184,0.55);font-size:0.38rem}',
        '.clr-disc-sum{color:rgba(200,195,184,0.6);font-size:0.4rem;margin:1px 0 2px 78px}'
      ].join('');
      (document.head || document.documentElement).appendChild(st);
    } catch (e) {}
  }

  function init() {
    try {
      if (init._wired) return; init._wired = true;
      _injectStyle();
      if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('limen:domain-brain-update', function () {
          if (_debounce) return;
          try { _debounce = setTimeout(function () { _debounce = null; compute(); }, 600); }
          catch (e) { _debounce = null; }
        });
      }
      _fetchCube();   // Stage 2: pull the cube discovery index (async; recomputes on load)
      compute();
    } catch (e) {}
  }

  var API = {
    start: init, init: init, compute: compute, renderInto: renderInto,
    isEnabled: _enabled, get: function () { return window.LIMENLiveDiscoveries || []; }
  };
  try {
    if (typeof window !== 'undefined') {
      window.LIMENLiveDiscoveriesUI = API;
      if (typeof document !== 'undefined' && document.addEventListener) {
        if (document.readyState !== 'loading') init();
        else document.addEventListener('DOMContentLoaded', init);
      }
    }
  } catch (e) {}
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
})();
