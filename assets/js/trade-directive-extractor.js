/**
 * trade-directive-extractor.js — Exhaustive Fractal Directive Extraction
 *
 * Traverses the trade portal fractal tree starting from active diagnosis
 * circuits, following ALL childPortal references recursively until
 * terminal leaf nodes are reached. No depth caps.
 *
 * Architecture:
 *   Stage 1: Resolver-mapped portals FIRST (budget priority)
 *   Stage 2: L0 root portal traversal (fills remaining budget)
 *
 * Guards:
 *   - Branch relevance scoring before descent
 *   - Deduplication by treatment label + node lineage
 *   - Traversal terminates only at leaf nodes (no childPortal)
 *
 * ADDITIVE ONLY — does not modify portal data, diagnosis logic, or kernel.
 * Feature-flagged: window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION
 *
 * Exposes: window.LIMENTradeDirectiveExtractor
 */
(function () {
  'use strict';

  var _portalCache = {};
  var CACHE_TTL = 300000;
  var _notFoundCache = {};

  var _prebuiltPayload = null;
  var _prebuiltFailed = false;
  function _loadPrebuiltPayload() {
    if (_prebuiltPayload) return Promise.resolve(_prebuiltPayload);
    if (_prebuiltFailed) return Promise.resolve(null);
    return fetch('/assets/data/deep/trade-deep-directives.json')
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) { if (data && data.directives && data.directives.length > 0) { _prebuiltPayload = data; console.log('[TradeExtractor] Prebuilt: ' + data.directives.length + ' directives, maxDepth=' + data.traversal.maxDepth); } return _prebuiltPayload; })
      .catch(function () { _prebuiltFailed = true; return null; });
  }

  function _fetchPortalJSON(domainId) {
    var cached = _portalCache[domainId];
    if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
      return Promise.resolve(cached.data);
    }
    if (_notFoundCache[domainId]) return Promise.resolve(null);
    var staticUrl = '/assets/data/domains/' + encodeURIComponent(domainId) + '.json';
    return fetch(staticUrl)
      .then(function (r) {
        if (!r.ok) { _notFoundCache[domainId] = true; throw new Error('Static ' + r.status); }
        return r.json();
      })
      .then(function (data) {
        if (data && data.activations) { _portalCache[domainId] = { data: data, ts: Date.now() }; }
        return data;
      })
      .catch(function () {
        _notFoundCache[domainId] = true;
        return cached ? cached.data : null;
      });
  }

  function _portalFileToId(filename) {
    if (!filename) return null;
    return filename.replace(/_portal\.html$/, '').replace(/\.html$/, '');
  }

  function _scoreBranchRelevance(activation, activeNodeIds, stress) {
    var score = 0;
    if (activeNodeIds[activation.brainNodeId]) score += 0.5;
    var treats = activation.treatments || [];
    if (treats.length > 0) score += 0.15;
    for (var ti = 0; ti < treats.length; ti++) {
      if (treats[ti].steps && treats[ti].steps.length > 0) { score += 0.1; break; }
    }
    if (activation.companies && activation.companies.length > 0) score += 0.1;
    if (activation.childPortal) score += 0.05;
    score += stress * 0.1;
    return Math.min(1, score);
  }

  /**
   * Extract directives from a single portal JSON at a given depth.
   * Recursive — follows ALL child portals until leaf nodes.
   *
   * @param {string} domainId - portal domain ID being crawled
   * @param {Object} portalData - fetched portal JSON
   * @param {Object} activeNodeIds - { nodeId: diagnosisContext }
   * @param {number} stress - current domain stress 0-1
   * @param {number} depth - current recursion depth (0 = L0 root)
   * @param {Array} path - ancestry path for lineage tracking
   * @param {Object} seen - dedup map
   * @param {Array} results - accumulator
   * @returns {Promise} resolves when branch is done
   */
  function _extractFromPortal(domainId, portalData, activeNodeIds, stress, depth, path, seen, results) {
    if (!portalData) return Promise.resolve();

    var activations = portalData.activations || [];
    var childFetches = [];

    for (var ai = 0; ai < activations.length; ai++) {

      var act = activations[ai];
      var nodeId = act.brainNodeId || '';
      var relevance = _scoreBranchRelevance(act, activeNodeIds, stress);

      var treatments = act.treatments || [];
      for (var ti = 0; ti < treatments.length; ti++) {

        var t = treatments[ti];
        var label = t.label || '';
        if (!label) continue;

        var dedupeKey = (label.substring(0, 60) + '||' + nodeId + '||' + domainId).toLowerCase();
        if (seen[dedupeKey]) continue;
        seen[dedupeKey] = true;

        var companies = [];
        var actCompanies = act.companies || [];
        for (var ci = 0; ci < actCompanies.length; ci++) {
          companies.push({
            name: actCompanies[ci].name || '',
            ticker: actCompanies[ci].ticker_or_id || '',
            bindingStrength: actCompanies[ci].binding_strength || 0
          });
        }

        var dxCtx = activeNodeIds[nodeId] || null;

        results.push({
          id: 'dir_' + domainId + '_' + nodeId + '_' + ti,
          nodeId: nodeId,
          nodeLabel: act.domainLabel || nodeId,
          nodeFunction: act.domainFunction || act.domainDescription || '',
          nodeGroup: act.group || '',
          diagnosisId: dxCtx ? dxCtx.diagnosisId : null,
          diagnosisLabel: dxCtx ? dxCtx.diagnosisLabel : null,
          circuitDir: dxCtx ? dxCtx.dir : null,
          circuitDetail: dxCtx ? dxCtx.detail : null,
          circuitEvidence: dxCtx ? dxCtx.evidence : null,
          treatmentLabel: label,
          treatmentType: t.type || 'STRUCTURAL',
          treatmentDescription: t.description || '',
          treatmentEvidence: t.evidence || 'Moderate',
          treatmentSteps: t.steps || [],
          treatmentTarget: t.target || null,
          treatmentCite: t.cite || null,
          treatmentCitation: t.citation || null,
          treatmentMonitoring: t.monitoring || null,
          treatmentEscalation: t.escalation || null,
          diagnosticTriggers: act.diagnosticTriggers || [],
          childPortal: act.childPortal || null,
          functionalRole: act.functional_role || '',
          phaseArchetype: act.phase_archetype || '',
          companies: companies,
          depth: depth,
          portalDomainId: domainId,
          portalTitle: portalData.title || '',
          ancestryPath: path.concat([domainId]),
          branchRelevance: relevance,
          stress: stress,
          domain: 'trade'
        });
      }

      // Descend into child portal — no depth cap, terminate only at leaf nodes
      if (act.childPortal) {
        var childId = _portalFileToId(act.childPortal);
        if (childId && !seen['__visited__' + childId]) {
          seen['__visited__' + childId] = true;
          childFetches.push({ childId: childId, path: path.concat([domainId]) });
        }
      }
    }

    if (childFetches.length === 0) return Promise.resolve();

    return Promise.all(childFetches.map(function (cf) {
      return _fetchPortalJSON(cf.childId).then(function (childData) {
        if (!childData) return Promise.resolve();
        return _extractFromPortal(cf.childId, childData, activeNodeIds, stress, depth + 1, cf.path, seen, results);
      });
    }));
  }

  /**
   * Main extraction entry point.
   *
   * @param {Object} state - trade brain state
   * @param {Object} portal - L0 trade portal JSON (trade.json)
   * @param {Object} opts - optional
   * @returns {Promise<Array>} extracted directive candidates
   */
  function extract(state, portal, opts) {
    if (!window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) return Promise.resolve([]);
    if (!state || !portal) return Promise.resolve([]);

    var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });

    var stress = state.stress || 0;

    var activeNodeIds = {};
    for (var di = 0; di < activeDx.length; di++) {
      var dx = activeDx[di];
      var circuits = dx.circuits || [];
      for (var ci = 0; ci < circuits.length; ci++) {
        activeNodeIds[circuits[ci].nodeId] = { diagnosisId: dx.id, diagnosisLabel: dx.label, dir: circuits[ci].dir, detail: circuits[ci].detail, evidence: circuits[ci].evidence };
      }
    }

    return _loadPrebuiltPayload().then(function (prebuilt) {
      if (prebuilt && prebuilt.directives) {
        var filtered = [];
        for (var pi = 0; pi < prebuilt.directives.length; pi++) {
          var d = prebuilt.directives[pi]; var dxCtx = activeNodeIds[d.nodeId] || null;
          if (dxCtx) { d.diagnosisId = dxCtx.diagnosisId; d.diagnosisLabel = dxCtx.diagnosisLabel; d.circuitDir = dxCtx.dir; d.circuitDetail = dxCtx.detail; d.circuitEvidence = dxCtx.evidence; d.stress = stress; d.domain = 'trade'; filtered.push(d); }
          else if (d.treatmentEvidence === 'Strong' || d.treatmentEvidence === 'A') { d.stress = stress; d.domain = 'trade'; filtered.push(d); }
        }
        console.log('[TradeExtractor] Prebuilt: ' + filtered.length + ' candidates, ' + activeDx.length + ' active dx');
        return filtered;
      }
      return _liveExtract(activeNodeIds, activeDx, stress, portal);
    });
  }

  function _liveExtract(activeNodeIds, activeDx, stress, portal) {
    var results = [];
    var seen = {};

    // ── STAGE 1: Diagnosis-mapped portals FIRST (prevents budget starvation) ──
    var resolver = window.LIMENPortalContentResolver;
    var dxPortalMap = resolver ? resolver.getDiagnosisPortalMap() : null;
    var diagnosisMappedPortals = [];
    if (dxPortalMap) {
      for (var dxi = 0; dxi < activeDx.length; dxi++) {
        var mapped = dxPortalMap[activeDx[dxi].id] || [];
        for (var mi = 0; mi < mapped.length; mi++) {
          if (!seen['__visited__' + mapped[mi]]) {
            seen['__visited__' + mapped[mi]] = true;
            diagnosisMappedPortals.push(mapped[mi]);
          }
        }
      }
    }

    var chain = Promise.resolve();
    for (var pi = 0; pi < diagnosisMappedPortals.length; pi++) {
      (function (pid) {
        chain = chain.then(function () {
          return _fetchPortalJSON(pid).then(function (data) {
            if (!data) return;
            return _extractFromPortal(pid, data, activeNodeIds, stress, 1, ['trade'], seen, results);
          });
        });
      })(diagnosisMappedPortals[pi]);
    }

    return chain
      .then(function () {
        // ── STAGE 2: L0 root portal traversal (fills remaining budget) ──
        return _extractFromPortal('trade', portal, activeNodeIds, stress, 0, [], seen, results);
      })
      .then(function () {
        console.log('[TradeExtractor] Extracted ' + results.length + ' candidates from ' +
          activeDx.length + ' active diagnoses, exhaustive-depth' +
          ' (stage1-mapped=' + diagnosisMappedPortals.length + ')');
        return results;
      });
  }

  window.LIMENTradeDirectiveExtractor = {
    extract: extract,
    _fetchPortalJSON: _fetchPortalJSON,
    _portalFileToId: _portalFileToId
  };
})();
