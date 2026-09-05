/**
 * kernel-reading-helper.js — kernel-agnostic reading resolver for every surface.
 *
 * Rendering must NOT gate on K1 (financial). The system has three kernel slots:
 *
 *   K1 — financial / autonomic (EDGAR composite + p0–p10 + alert).
 *        Doesn't fire for banks, ETFs, private, pre-revenue, bankrupt with
 *        sparse data, off-CB portals. K1-null is informational, not failure.
 *
 *   K2 — financial × relational / polyvagal (Pass 2 phase_engine.py).
 *        Post 2026-05-29 gate relaxation: fires for every portal with any
 *        polyvagal context — even when EDGAR is empty (neutral intrinsic
 *        prior + polyvagal bias). Target: 100% coverage post-persist.
 *
 *   K3 — relational topology fallback. For portals K1/K2 can't reach, K3
 *        reports whether a broad, tagged, sourced relationship map exists.
 *        It deliberately emits no financial phase, composite, or alert.
 *
 * Use this helper in every place that wants to render a phase / score / state
 * from a portal. Surfaces should not read `portal.financialHealth.composite`
 * directly any more — go through getPrimaryReading() so the surface stays
 * kernel-agnostic when K3 lands.
 *
 * Usage:
 *   var r = LIMENKernelReading.getPrimaryReading(portal);
 *   if (r) { renderPhase(r.phase); renderScore(r.score); renderBadge(r.kind); }
 *   else   { renderEmpty('no kernel reading yet — K3 slot reserved'); }
 *
 *   var badge = LIMENKernelReading.getKernelBadge(portal);
 *   // → { kind: 'K2', label: 'POLYVAGAL', phase: 'p3', color: '#C9A94E', source: 'neutral_prior' }
 */
(function (g) {
  'use strict';

  var KIND_LABELS = { k1: 'FINANCIAL', k2: 'POLYVAGAL', k3: 'RELATIONAL' };
  var KIND_COLORS = { k1: '#5ab5a0', k2: '#C9A94E', k3: '#4a8fd4' };

  function _has(o) { return o && typeof o === 'object'; }
  function _phaseOf(r) { return r && (r.phase || r.dominantPhase) || null; }
  function _stateOf(r) { return r && (r.state || _phaseOf(r)) || null; }
  function _scoreOf(r) { return r && (typeof r.composite === 'number' ? r.composite : (typeof r.score === 'number' ? r.score : null)); }

  // Read the K1 reading from a portal. Honors the new kernelReadings shape AND
  // the legacy financialHealth shape (still on most portals during migration).
  function readK1(portal) {
    if (!portal) return null;
    var kr = portal.kernelReadings;
    if (_has(kr) && _has(kr.k1) && _phaseOf(kr.k1)) return kr.k1;
    var fh = portal.financialHealth;
    if (_has(fh)) {
      // Field-name drift: portals store the score as `compositeScore` (not
      // `composite`), so the old check read undefined → K1 rendered phase but a
      // NULL score. Accept either field.
      var _comp = (typeof fh.composite === 'number') ? fh.composite
                : (typeof fh.compositeScore === 'number') ? fh.compositeScore : null;
      if (_comp !== null || fh.dominantPhase) {
        return {
          phase: fh.dominantPhase || null,
          composite: _comp,
          alert: !!fh.alert,
          trajectory: fh.trajectory || null,
          kernelId: fh.kernelId || 'legacy_financialHealth',
          lastScored: fh.lastScored || fh.lastKernelRun || null
        };
      }
    }
    return null;
  }
  function readK2(portal) {
    if (!portal) return null;
    var kr = portal.kernelReadings;
    if (_has(kr) && _has(kr.k2) && (_phaseOf(kr.k2) || kr.k2.coupling_mode)) return kr.k2;
    return null;
  }
  function readK3(portal) {
    if (!portal) return null;
    var kr = portal.kernelReadings;
    if (_has(kr) && _has(kr.k3) && _stateOf(kr.k3)) return kr.k3;
    return null;
  }

  // Pick the best available reading. Order of preference:
  //   explicit kernelReadings.primary → matching slot if it carries a phase
  //   K2 (post-relaxation: universal coverage target)
  //   K1 (legacy + EDGAR-backed)
  //   K3 (reserved slot)
  function getPrimaryReading(portal) {
    if (!portal) return null;
    var k1 = readK1(portal), k2 = readK2(portal), k3 = readK3(portal);
    var kr = portal.kernelReadings;
    var preferred = kr && kr.primary;
    if (preferred === 'k2' && k2) return _enrich('k2', k2);
    if (preferred === 'k1' && k1) return _enrich('k1', k1);
    if (preferred === 'k3' && k3) return _enrich('k3', k3);
    // Default fallback: K2 first (universal target), then K1, then K3
    if (k2 && _phaseOf(k2)) return _enrich('k2', k2);
    if (k1 && _phaseOf(k1)) return _enrich('k1', k1);
    if (k3 && _stateOf(k3)) return _enrich('k3', k3);
    return null;
  }
  function _enrich(kind, r) {
    return {
      kind: kind,
      label: KIND_LABELS[kind],
      color: KIND_COLORS[kind],
      phase: _phaseOf(r),
      state: _stateOf(r),
      score: _scoreOf(r),
      alert: !!r.alert,
      trajectory: r.trajectory || null,
      coupling_mode: r.coupling_mode || null,
      intrinsic_source: r.intrinsic_source || null,
      polyvagal_context_source: r.polyvagal_context_source || null,
      kernelId: r.kernelId || null,
      lastScored: r.lastScored || null,
      coverage: r.coverage || null,
      limitations: r.limitations || null,
      raw: r
    };
  }

  // UI badge — small chip describing which kernel is being rendered.
  function getKernelBadge(portal) {
    var p = getPrimaryReading(portal);
    if (!p) return { kind: 'none', label: 'NO KERNEL', phase: null, color: 'rgba(200,195,184,0.3)', source: null };
    return { kind: p.kind.toUpperCase(), label: p.label, phase: p.phase, state: p.state, color: p.color, source: p.intrinsic_source || p.polyvagal_context_source || null, alert: p.alert };
  }

  // Coverage check — what kernels does this portal have readings from?
  function getCoverage(portal) {
    return { k1: !!readK1(portal), k2: !!readK2(portal), k3: !!readK3(portal) };
  }

  g.LIMENKernelReading = { getPrimaryReading: getPrimaryReading, getKernelBadge: getKernelBadge, getCoverage: getCoverage, readK1: readK1, readK2: readK2, readK3: readK3 };
})(typeof window !== 'undefined' ? window : globalThis);
