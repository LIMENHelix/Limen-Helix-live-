/**
 * finance-promotion-bridge.js — Inject promoted portal directives into operator surfaces
 *
 * Orchestrates the full pipeline:
 *   extract → rank → translate → inject into state.opportunities
 *
 * Lifecycle:
 *   - Runs ONCE on first operator surface open
 *   - Re-runs ONLY when input signature changes:
 *     active diagnosis keys, active node keys, stress snapshot, feature flag
 *   - Skips entirely if signature unchanged (no re-extract, no re-translate, no re-render)
 *   - Caches promoted set and re-injects from cache on unchanged calls
 *
 * Safety:
 *   - Feature-flagged: window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION
 *   - If extraction fails or times out, existing opportunities are untouched
 *   - Deduplicates against existing brain-generated opportunities
 *   - Prevents duplicate promotions from repeated bridge runs
 *
 * ADDITIVE ONLY — does not modify brain, kernel, or portal source.
 *
 * Exposes: window.LIMENFinancePromotionBridge
 */
(function () {
  'use strict';

  var _lastSignature = null;
  var _lastPromoted = [];
  var _running = false; // prevent concurrent runs

  /**
   * Compute input signature from state context.
   * If signature matches last run, skip extraction entirely.
   */
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

    // Stress bucketed to nearest 0.05 to avoid thrashing on tiny changes
    var stressBucket = Math.round((state.stress || 0) * 20) / 20;

    return [
      'finance',
      dxKeys.join(','),
      nodeKeys.join(','),
      stressBucket.toFixed(2),
      window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION ? '1' : '0'
    ].join('|');
  }

  /**
   * Run the full extraction → ranking → translation pipeline.
   * Skips if input signature is unchanged from last run.
   *
   * @param {Object} state - finance brain state
   * @param {Object} portal - L0 finance portal JSON
   * @param {Object} opts - optional: { maxDepth, limit }
   * @returns {Promise<Array>} the promoted opportunities that were added
   */
  function promote(state, portal, opts) {
    // Feature flag check
    if (!window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) {
      return Promise.resolve([]);
    }

    if (!state || !portal) return Promise.resolve([]);

    // Compute signature — skip if unchanged
    var sig = _computeSignature(state);
    if (sig === _lastSignature && _lastPromoted.length >= 0) {
      // Re-inject cached promoted opportunities (idempotent)
      if (_lastPromoted.length > 0) _injectIntoState(state, _lastPromoted);
      return Promise.resolve(_lastPromoted);
    }

    // Feature flag off in signature = clear and return
    if (!window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) {
      _lastSignature = sig;
      _lastPromoted = [];
      return Promise.resolve([]);
    }

    // Prevent concurrent runs
    if (_running) return Promise.resolve(_lastPromoted);
    _running = true;

    opts = opts || {};
    var limit = opts.limit || 5;

    var extractor = window.LIMENFinanceDirectiveExtractor;
    var ranker = window.LIMENFinanceDirectiveRanker;
    var translator = window.LIMENFinanceDirectiveTranslator;

    if (!extractor || !ranker || !translator) {
      console.warn('[FinancePromotionBridge] Missing module(s) — extractor:', !!extractor, 'ranker:', !!ranker, 'translator:', !!translator);
      _running = false;
      return Promise.resolve([]);
    }

    console.log('[FinancePromotionBridge] Input signature changed — running extraction pipeline');
    console.log('[FinancePromotionBridge] Signature: ' + sig);
    var t0 = Date.now();

    return extractor.extract(state, portal, opts)
      .then(function (candidates) {
        if (!candidates || candidates.length === 0) {
          console.log('[FinancePromotionBridge] No candidates extracted');
          _lastSignature = sig;
          _lastPromoted = [];
          _running = false;
          return [];
        }

        console.log('[FinancePromotionBridge] Extracted ' + candidates.length + ' candidates in ' + (Date.now() - t0) + 'ms');

        // Rank
        var ranked = ranker.rank(candidates);

        // ── DEPTH-AWARE SELECTION ──
        // Pass 1: Ensure top set includes at least one rich directive (richness>=0.5)
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
          console.log('[FinancePromotionBridge] Elevated proof directive from position ' + bestProofIdx + ': ' + proofItem.treatmentLabel.substring(0, 50));
        }

        // Pass 2: Force a DEEP PROOF slot — best L2+ directive into the promoted set
        // richness>=0.3, display score formula: depth*0.15 + richness*0.3 + proof*0.3 + rank*0.25
        var bestDeepIdx = -1;
        var bestDeepScore = 0;
        for (var dpi = 0; dpi < ranked.length; dpi++) {
          var dd = ranked[dpi];
          if ((dd.depth || 0) >= 2 && dd._richness >= 0.3) {
            // Score for deep proof: depth weight + richness + proof + rank
            var deepDisplayScore = (dd.depth || 0) * 0.15 + dd._richness * 0.3 + (dd.proofScore || 0) * 0.3 + (dd.rankScore || 0) * 0.25;
            if (deepDisplayScore > bestDeepScore) {
              bestDeepScore = deepDisplayScore;
              bestDeepIdx = dpi;
            }
          }
        }
        // Insert the deep proof item into the promoted set if it's not already there
        if (bestDeepIdx !== -1 && bestDeepIdx >= limit) {
          var deepItem = ranked.splice(bestDeepIdx, 1)[0];
          deepItem._isDeepProofSlot = true;
          // Insert at position 1 (after anchor candidate, before remaining)
          ranked.splice(Math.min(1, ranked.length), 0, deepItem);
          console.log('[FinancePromotionBridge] Deep proof slot: L' + deepItem.depth + ' ' + deepItem.treatmentLabel.substring(0, 50) + ' (deepScore=' + bestDeepScore.toFixed(3) + ')');
        } else if (bestDeepIdx !== -1 && bestDeepIdx < limit) {
          // Already in top set — just mark it
          ranked[bestDeepIdx]._isDeepProofSlot = true;
          console.log('[FinancePromotionBridge] Deep proof already in top set: L' + ranked[bestDeepIdx].depth);
        }

        console.log('[FinancePromotionBridge] Top 5 after depth-aware selection:');
        for (var ri = 0; ri < Math.min(5, ranked.length); ri++) {
          console.log('  ' + (ri + 1) + '. [rank=' + ranked[ri].rankScore + ' proof=' + ranked[ri].proofScore + ' rich=' + ranked[ri]._richness + '] ' + ranked[ri].treatmentLabel.substring(0, 50));
        }

        // Translate top N, then shape top 3 into deal-grade
        var promoted = translator.translate(ranked, limit);
        if (translator.shape) {
          promoted = translator.shape(promoted, 3);
        }

        // Resolve targets for shaped directives
        var targeting = window.LIMENFinanceTargetingEngine;
        if (targeting) {
          for (var ti = 0; ti < promoted.length; ti++) {
            var resolved = targeting.resolveTargets(promoted[ti]);
            if (resolved && resolved.formatted) {
              promoted[ti]._resolvedTargets = resolved;
              // Overwrite moneyChain.target with resolved targeting
              if (promoted[ti].moneyChain) {
                promoted[ti].moneyChain.target = resolved.formatted;
              }
              // Update examples with tier1 + tier3 companies
              var allCompanies = resolved.tier1.concat(resolved.tier3);
              if (allCompanies.length > 0) {
                promoted[ti].examples = allCompanies.slice(0, 5).map(function (c) {
                  return c.name + (c.ticker ? ' (' + c.ticker + ')' : '');
                });
              }
            }
          }
        }

        // Deduplicate against existing brain opportunities (title substring 40 chars)
        var existing = state.opportunities || [];
        var existingTitles = {};
        for (var ei = 0; ei < existing.length; ei++) {
          if (existing[ei].source !== 'portal_directive') {
            existingTitles[(existing[ei].title || '').toLowerCase().substring(0, 40)] = true;
          }
        }

        var dedupedPromoted = [];
        for (var pi = 0; pi < promoted.length; pi++) {
          var titleKey = (promoted[pi].title || '').toLowerCase().substring(0, 40);
          if (!existingTitles[titleKey]) {
            dedupedPromoted.push(promoted[pi]);
            existingTitles[titleKey] = true;
          }
        }

        // Cache with signature
        _lastSignature = sig;
        _lastPromoted = dedupedPromoted;
        _running = false;

        // Inject into state
        _injectIntoState(state, dedupedPromoted);

        console.log('[FinancePromotionBridge] Promoted ' + dedupedPromoted.length + ' directives (' + (Date.now() - t0) + 'ms total)');
        return dedupedPromoted;
      })
      .catch(function (err) {
        console.error('[FinancePromotionBridge] Pipeline failed — existing opportunities untouched:', err.message || err);
        _lastSignature = sig; // Don't retry same signature
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

    // ── PLAYBOOK LOOP CLOSURE ──
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
        id: 'ptreat_' + (dir.portalDomainId || 'finance') + '_' + (dir.nodeId || '') + '_' + pi,
        label: dir.treatmentLabel || opp.title,
        type: opp._directive ? (opp.path === 'INVESTABLE' ? 'STRUCTURAL' : opp.path === 'PATENTABLE' ? 'DIAGNOSTIC' : 'STRATEGY') : 'STRUCTURAL',
        evidence: opp.moneyChain ? 'Strong' : 'Moderate',
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
    var evRank = { 'Strong': 10, 'A': 10, 'Moderate': 7, 'B': 7, 'Emerging': 4, 'C': 4 };
    state.treatments.sort(function (a, b) {
      // Native treatments sort above promoted at same evidence level
      var aIsPromoted = a.source === 'portal_directive_promoted' ? 1 : 0;
      var bIsPromoted = b.source === 'portal_directive_promoted' ? 1 : 0;
      if (aIsPromoted !== bIsPromoted) return aIsPromoted - bIsPromoted;
      return (evRank[b.evidence] || 0) - (evRank[a.evidence] || 0);
    });
  }

  /**
   * Get the last promoted set (for debugging / display).
   */
  function getLastPromoted() {
    return _lastPromoted;
  }

  /**
   * Clear cache — forces re-extraction on next call.
   */
  function clearCache() {
    _lastPromoted = [];
    _lastSignature = null;
    _running = false;
  }

  window.LIMENFinancePromotionBridge = {
    promote: promote,
    getLastPromoted: getLastPromoted,
    clearCache: clearCache
  };
})();
