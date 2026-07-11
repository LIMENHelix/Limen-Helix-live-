/**
 * trade-promotion-bridge.js — Inject promoted portal directives into operator surfaces
 *
 * Orchestrates: extract -> rank -> translate -> inject into state.opportunities
 *
 * Lifecycle:
 *   - Runs ONCE on first operator surface open
 *   - Re-runs ONLY when input signature changes
 *   - Caches promoted set and re-injects from cache on unchanged calls
 *
 * ADDITIVE ONLY — does not modify brain, kernel, or portal source.
 * Exposes: window.LIMENTradePromotionBridge
 */
(function () {
  'use strict';

  var _lastSignature = null;
  var _lastPromoted = [];
  var _running = false;

  function _computeSignature(state) {
    var dxKeys = [];
    var nodeKeys = [];
    var diagnoses = (state.diagnoses || []).filter(function (d) { return d.active; });

    for (var di = 0; di < diagnoses.length; di++) {
      dxKeys.push(diagnoses[di].id);
      var circuits = diagnoses[di].circuits || [];
      for (var ci = 0; ci < circuits.length; ci++) {
        nodeKeys.push(circuits[ci].nodeId);
      }
    }

    dxKeys.sort();
    nodeKeys.sort();
    var stressBucket = Math.round((state.stress || 0) * 20) / 20;

    return [
      'trade',
      dxKeys.join(','),
      nodeKeys.join(','),
      stressBucket.toFixed(2),
      window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION ? '1' : '0'
    ].join('|');
  }

  function promote(state, portal, opts) {
    if (!window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) return Promise.resolve([]);
    if (!state || !portal) return Promise.resolve([]);

    var sig = _computeSignature(state);
    if (sig === _lastSignature && _lastPromoted.length >= 0) {
      if (_lastPromoted.length > 0) _injectIntoState(state, _lastPromoted);
      return Promise.resolve(_lastPromoted);
    }

    if (!window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) {
      _lastSignature = sig;
      _lastPromoted = [];
      return Promise.resolve([]);
    }

    if (_running) return Promise.resolve(_lastPromoted);
    _running = true;

    opts = opts || {};
    var limit = opts.limit || 5;

    var extractor = window.LIMENTradeDirectiveExtractor;
    var ranker = window.LIMENTradeDirectiveRanker;
    var translator = window.LIMENTradeDirectiveTranslator;

    if (!extractor || !ranker || !translator) {
      console.warn('[TradePromotionBridge] Missing pipeline component');
      _running = false;
      return Promise.resolve([]);
    }

    console.log('[TradePromotionBridge] Input signature changed \u2014 running extraction pipeline');
    console.log('[TradePromotionBridge] Signature: ' + sig);

    return extractor.extract(state, portal, opts)
      .then(function (candidates) {
        if (!candidates || candidates.length === 0) {
          console.log('[TradePromotionBridge] No candidates extracted');
          _lastSignature = sig;
          _lastPromoted = [];
          _running = false;
          return [];
        }

        var ranked = ranker.rank(candidates);

        // ── DEPTH-AWARE SELECTION ──
        // Pass 1: Ensure top set includes at least one rich directive (any depth)
        var bestProofIdx = -1;
        var bestProof = 0;
        for (var bpi = 0; bpi < ranked.length; bpi++) {
          if (ranked[bpi]._richness >= 0.5 && ranked[bpi].proofScore > bestProof) {
            bestProof = ranked[bpi].proofScore;
            bestProofIdx = bpi;
          }
        }
        if (bestProofIdx > limit - 1 && bestProofIdx !== -1) {
          var proofItem = ranked.splice(bestProofIdx, 1)[0];
          ranked.splice(0, 0, proofItem);
          console.log('[TradePromotionBridge] Elevated proof directive from position ' + bestProofIdx);
        }

        // Pass 2: Force a DEEP PROOF slot — best L2+ directive
        var bestDeepIdx = -1;
        var bestDeepScore = 0;
        for (var dpi = 0; dpi < ranked.length; dpi++) {
          var dd = ranked[dpi];
          if ((dd.depth || 0) >= 2 && dd._richness >= 0.3) {
            var deepDisplayScore = (dd.depth || 0) * 0.15 + dd._richness * 0.3 + (dd.proofScore || 0) * 0.3 + (dd.rankScore || 0) * 0.25;
            if (deepDisplayScore > bestDeepScore) {
              bestDeepScore = deepDisplayScore;
              bestDeepIdx = dpi;
            }
          }
        }
        if (bestDeepIdx !== -1 && bestDeepIdx >= limit) {
          var deepItem = ranked.splice(bestDeepIdx, 1)[0];
          deepItem._isDeepProofSlot = true;
          ranked.splice(Math.min(1, ranked.length), 0, deepItem);
          console.log('[TradePromotionBridge] Deep proof slot: L' + deepItem.depth + ' (deepScore=' + bestDeepScore.toFixed(3) + ')');
        } else if (bestDeepIdx !== -1 && bestDeepIdx < limit) {
          ranked[bestDeepIdx]._isDeepProofSlot = true;
        }

        var promoted = translator.translate(ranked, limit);
        if (translator.shape) promoted = translator.shape(promoted, 3);

        // Resolve targets for shaped directives
        var targeting = window.LIMENTradeTargetingEngine;
        if (targeting) {
          for (var ti = 0; ti < promoted.length; ti++) {
            var resolved = targeting.resolveTargets(promoted[ti]);
            if (resolved && resolved.formatted) {
              promoted[ti]._resolvedTargets = resolved;
              if (promoted[ti].moneyChain) {
                promoted[ti].moneyChain.target = resolved.formatted;
              }
              var allCompanies = resolved.tier1.concat(resolved.tier3);
              if (allCompanies.length > 0) {
                promoted[ti].examples = allCompanies.slice(0, 5).map(function (c) {
                  return c.name + (c.ticker ? ' (' + c.ticker + ')' : '');
                });
              }
            }
          }
        }

        // Deduplicate against existing brain opportunities
        var existing = state.opportunities || [];
        var existingTitles = {};
        for (var ei = 0; ei < existing.length; ei++) {
          if (existing[ei].source !== 'portal_directive') {
            existingTitles[(existing[ei].title || '').toLowerCase().substring(0, 40)] = true;
          }
        }
        var dedupedPromoted = [];
        for (var pi2 = 0; pi2 < promoted.length; pi2++) {
          var titleKey = (promoted[pi2].title || '').toLowerCase().substring(0, 40);
          if (!existingTitles[titleKey]) {
            dedupedPromoted.push(promoted[pi2]);
            existingTitles[titleKey] = true;
          }
        }

        _lastSignature = sig;
        _lastPromoted = dedupedPromoted;
        _running = false;

        _injectIntoState(state, dedupedPromoted);

        console.log('[TradePromotionBridge] Promoted ' + dedupedPromoted.length + ' directives');
        return dedupedPromoted;
      })
      .catch(function (err) {
        console.error('[TradePromotionBridge] Pipeline failed — existing opportunities untouched:', err.message || err);
        _lastSignature = sig;
        _lastPromoted = [];
        _running = false;
        return [];
      });
  }

  /**
   * Inject promoted opportunities into state.opportunities array.
   * Removes any previously promoted directives first, then adds new set.
   */
  function _injectIntoState(state, promoted) {
    if (!state) return;
    if (!state.opportunities) state.opportunities = [];

    // Remove old promoted directives from opportunities
    state.opportunities = state.opportunities.filter(function (o) {
      return o.source !== 'portal_directive';
    });

    // Add new promoted directives as opportunities
    for (var i = 0; i < promoted.length; i++) {
      state.opportunities.push(promoted[i]);
    }

    // Re-sort by rank
    state.opportunities.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });

    // Also inject treatment-shaped overlays into state.treatments so the
    // Regulation Playbook reflects the same promoted intelligence.
    _injectTreatmentOverlays(state, promoted);
  }

  /**
   * Build treatment-shaped overlay objects from promoted opportunities and
   * inject them into state.treatments for Regulation Playbook display.
   *
   * These are ADDITIVE — native brain treatments remain untouched.
   * Marked with source='portal_directive_promoted' for traceability.
   */
  function _injectTreatmentOverlays(state, promoted) {
    if (!state || !promoted || promoted.length === 0) return;
    if (!state.treatments) state.treatments = [];

    // Remove old promoted treatment overlays
    state.treatments = state.treatments.filter(function (t) {
      return t.source !== 'portal_directive_promoted';
    });

    // Build treatment-shaped objects from promoted opportunities
    var existingLabels = {};
    for (var ei = 0; ei < state.treatments.length; ei++) {
      existingLabels[(state.treatments[ei].label || '').toLowerCase().substring(0, 50)] = true;
    }

    for (var pi = 0; pi < promoted.length; pi++) {
      var opp = promoted[pi];
      var dir = opp._directive || {};

      // Dedupe against native treatments by label
      var labelKey = (dir.treatmentLabel || opp.title || '').toLowerCase().substring(0, 50);
      if (existingLabels[labelKey]) continue;
      existingLabels[labelKey] = true;

      var overlay = {
        id: 'ptreat_' + (dir.portalDomainId || 'trade') + '_' + (dir.nodeId || '') + '_' + pi,
        label: dir.treatmentLabel || opp.title,
        type: opp._directive ? (opp.path === 'INVESTABLE' ? 'STRUCTURAL' : opp.path === 'PATENTABLE' ? 'DIAGNOSTIC' : 'STRATEGY') : 'STRUCTURAL',
        evidence: (opp._deepIntel && opp._deepIntel.citations && opp._deepIntel.citations.length) ? 'Cited' : (opp.moneyChain ? 'Pathway traced' : 'Indicative'),
        description: opp.explain || opp.title,
        diagnosisId: opp.diagnosisId || null,
        nodeId: dir.nodeId || '',
        relevance: opp.rank || 0.5,
        source: 'portal_directive_promoted',

        // Extended fields for playbook renderer
        steps: opp.steps || [],
        cite: (opp._deepIntel && opp._deepIntel.cite) ? opp._deepIntel.cite : null,
        monitoring: (opp._deepIntel && opp._deepIntel.monitoring) ? opp._deepIntel.monitoring : null,
        target: opp.moneyChain ? opp.moneyChain.target : null,
        escalation: (opp._deepIntel && opp._deepIntel.escalation) ? opp._deepIntel.escalation : null,
        targetPathway: (opp._deepIntel && opp._deepIntel.targetPathway) ? opp._deepIntel.targetPathway : null,
        citations: (opp._deepIntel && opp._deepIntel.citations) ? opp._deepIntel.citations : null,

        // Traceability metadata
        _promotedFrom: {
          portalDomainId: dir.portalDomainId,
          portalTitle: dir.portalTitle,
          depth: dir.depth,
          ancestryPath: dir.ancestryPath,
          nodeLabel: dir.nodeLabel,
          rankScore: dir.rankScore,
          opportunityId: opp.id
        }
      };

      state.treatments.push(overlay);
    }

    // Re-sort treatments by evidence grade (native treatments first, promoted appended)
    var evRank = { 'Cited': 10, 'Strong': 10, 'A': 10, 'Pathway traced': 7, 'Moderate': 7, 'B': 7, 'Indicative': 4, 'Emerging': 4, 'C': 4 };
    state.treatments.sort(function (a, b) {
      // Native treatments sort above promoted at same evidence level
      var aIsPromoted = a.source === 'portal_directive_promoted' ? 1 : 0;
      var bIsPromoted = b.source === 'portal_directive_promoted' ? 1 : 0;
      if (aIsPromoted !== bIsPromoted) return aIsPromoted - bIsPromoted;
      return (evRank[b.evidence] || 0) - (evRank[a.evidence] || 0);
    });
  }

  function getLastPromoted() {
    return _lastPromoted;
  }

  window.LIMENTradePromotionBridge = {
    promote: promote,
    getLastPromoted: getLastPromoted
  };
})();
