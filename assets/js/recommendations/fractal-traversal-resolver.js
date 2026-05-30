/**
 * fractal-traversal-resolver.js
 * LIMEN HELIX — Fractal Traversal Resolver
 *
 * Descends portal substructures to find the deepest actionable
 * corrective answer in the domain→portal→diagnosis→treatment graph.
 *
 * Exposes: window.LIMENFractalTraversalResolver
 */
(function () {
  'use strict';

  var MAX_DEPTH = 8;

  // ═══════════════════════════════════════════════════════════════
  // Main descend function
  // ═══════════════════════════════════════════════════════════════

  /**
   * @param {string} domainId
   * @param {object} opts - { treatments, diagnoses }
   * @returns {object} { depth, path[], answer, treatment, diagnosis, confidence, portalId }
   */
  function descend(domainId, opts) {
    var mgr = window.LIMENRemedyRegistryManager;
    if (!mgr) return _empty(domainId);

    opts = opts || {};
    var seedTreatments = opts.treatments || [];
    var seedDiagnoses = opts.diagnoses || [];

    // Build a traversal starting from domain root
    var bestResult = null;
    var bestScore = -1;

    // Start with the domain's portal hierarchy
    // Walk _byPortal index: domain → domain_subportal → domain_subportal_child
    var visited = {};
    var queue = [{ portalId: domainId, depth: 0, path: [domainId] }];

    while (queue.length > 0) {
      var current = queue.shift();
      if (visited[current.portalId] || current.depth > MAX_DEPTH) continue;
      visited[current.portalId] = true;

      // Get treatments at this portal level
      var portalTx = mgr.getTreatmentsForPortal(current.portalId);
      var portalDx = mgr.getDiagnosesForDomain(current.portalId);

      // Score treatments at this level (deeper = more specific)
      for (var ti = 0; ti < portalTx.length; ti++) {
        var tx = portalTx[ti];
        var score = _scoreForDepth(tx, current.depth);

        if (score > bestScore) {
          bestScore = score;
          var parentDx = _findParentDiagnosis(tx, portalDx, seedDiagnoses);
          bestResult = {
            depth: current.depth,
            path: current.path.slice(),
            answer: _extractAnswer(tx),
            treatment: tx,
            diagnosis: parentDx,
            confidence: tx.confidence || 0.5,
            portalId: current.portalId
          };
        }
      }

      // Find child portals: look for portalIds that start with current + '_'
      var childPortals = _findChildPortals(mgr, current.portalId);
      for (var ci = 0; ci < childPortals.length; ci++) {
        queue.push({
          portalId: childPortals[ci],
          depth: current.depth + 1,
          path: current.path.concat([childPortals[ci]])
        });
      }
    }

    // Also check seed treatments for actionability
    if (!bestResult || bestScore < 0.3) {
      for (var si = 0; si < seedTreatments.length; si++) {
        var sTx = seedTreatments[si];
        if (_hasConcreteAction(sTx)) {
          var sScore = _scoreForDepth(sTx, 0);
          if (sScore > bestScore) {
            bestScore = sScore;
            bestResult = {
              depth: 0,
              path: [domainId],
              answer: _extractAnswer(sTx),
              treatment: sTx,
              diagnosis: seedDiagnoses.length > 0 ? seedDiagnoses[0] : null,
              confidence: sTx.confidence || 0.5,
              portalId: domainId
            };
          }
        }
      }
    }

    return bestResult || _empty(domainId);
  }

  // ═══════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════

  function _scoreForDepth(tx, depth) {
    // Deeper treatments are more specific → score higher
    var depthBonus = Math.min(depth * 0.15, 0.6);
    var actionBonus = _hasConcreteAction(tx) ? 0.4 : 0;
    var stepBonus = (tx.steps && tx.steps.length > 0) ? Math.min(tx.steps.length * 0.1, 0.3) : 0;
    var confBonus = (tx.confidence || 0.5) * 0.2;

    return depthBonus + actionBonus + stepBonus + confBonus;
  }

  function _hasConcreteAction(tx) {
    if (!tx) return false;
    // Has actual steps with actions
    var steps = tx.steps || [];
    for (var i = 0; i < steps.length; i++) {
      var action = steps[i].action || steps[i].description || '';
      // Reject vague actions
      if (action && action.toLowerCase().indexOf('assess and respond') === -1 &&
          action.toLowerCase().indexOf('monitor') === -1 &&
          action.length > 10) {
        return true;
      }
    }
    // Has scalePayload with concrete text
    if (tx.scalePayload) {
      var sp = tx.scalePayload;
      if (sp.policyAction || sp.businessAction || sp.systemicAction || sp.userFacingText) {
        return true;
      }
    }
    return false;
  }

  function _extractAnswer(tx) {
    if (!tx) return 'No actionable answer found';

    // Prefer the most specific action from steps
    var steps = tx.steps || [];
    for (var i = 0; i < steps.length; i++) {
      var action = steps[i].action || steps[i].description || '';
      if (action && action.toLowerCase().indexOf('assess and respond') === -1 &&
          action.toLowerCase().indexOf('monitor') === -1 &&
          action.length > 10) {
        return action;
      }
    }

    // Fallback to scalePayload
    if (tx.scalePayload) {
      return tx.scalePayload.policyAction ||
             tx.scalePayload.systemicAction ||
             tx.scalePayload.businessAction ||
             tx.scalePayload.userFacingText ||
             tx.scalePayload.treatmentLabel ||
             tx.title || 'Regulation pending';
    }

    return tx.title || 'Regulation pending';
  }

  function _findParentDiagnosis(tx, portalDx, seedDx) {
    // Check if treatment has a diagnosis link
    if (tx._diagnosisId) {
      var mgr = window.LIMENRemedyRegistryManager;
      if (mgr) {
        var dx = mgr.getDiagnosis(tx._diagnosisId);
        if (dx) return dx;
      }
    }

    // Check portal diagnoses
    for (var i = 0; i < portalDx.length; i++) {
      var dxTx = portalDx[i].treatments || [];
      for (var j = 0; j < dxTx.length; j++) {
        if (dxTx[j].id === tx.id || dxTx[j] === tx.id) return portalDx[i];
      }
    }

    // Fallback to seed diagnoses
    return seedDx.length > 0 ? seedDx[0] : null;
  }

  function _findChildPortals(mgr, parentId) {
    // Use stats to get portal keys, then filter for children
    var children = [];
    var stats = mgr.stats ? mgr.stats() : {};
    var portalCount = stats.byPortal || 0;

    // Try to enumerate portals by checking common naming patterns
    // Portal IDs follow pattern: domain, domain_sub, domain_sub_child
    var prefix = parentId + '_';

    // We can't directly enumerate _byPortal keys, so use getTreatmentsForPortal
    // to probe common portal naming patterns
    var suffixes = [
      'gdp', 'growth', 'labor', 'trade', 'fiscal', 'monetary',
      'oil', 'gas', 'solar', 'wind', 'grid', 'nuclear',
      'climate', 'water', 'air', 'biodiversity', 'waste',
      'primary', 'secondary', 'tertiary', 'research',
      'supply', 'demand', 'logistics', 'transport',
      'executive', 'legislative', 'judicial', 'regulatory',
      'digital', 'network', 'cyber', 'ai',
      'crop', 'livestock', 'irrigation',
      'manufacturing', 'mining', 'construction',
      'media', 'social', 'broadcast',
      'military', 'homeland', 'intelligence',
      'demographics', 'migration', 'urban',
      'civil', 'criminal', 'regulatory',
      'banking', 'markets', 'insurance',
      'signals', 'analysis', 'collection'
    ];

    for (var i = 0; i < suffixes.length; i++) {
      var childId = prefix + suffixes[i];
      var childTx = mgr.getTreatmentsForPortal(childId);
      if (childTx.length > 0) {
        children.push(childId);
      }
    }

    return children;
  }

  function _empty(domainId) {
    return {
      depth: 0,
      path: [domainId],
      answer: 'No actionable regulation found',
      treatment: null,
      diagnosis: null,
      confidence: 0,
      portalId: domainId
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════

  window.LIMENFractalTraversalResolver = {
    descend: descend
  };

})();
