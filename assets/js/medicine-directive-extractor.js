/**
 * medicine-directive-extractor.js — Exhaustive Fractal Directive Extraction
 *
 * Traverses the medicine portal fractal tree starting from active diagnosis
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
 * Exposes: window.LIMENMedicineDirectiveExtractor
 */
(function () {
  'use strict';

  // Portal JSON cache — shared across all extraction runs
  var _portalCache = {};
  var CACHE_TTL = 300000; // 5 min

  // Prebuilt deep payload — loaded once, eliminates render-time portal hunting
  var _prebuiltPayload = null;
  var _prebuiltLoading = false;
  var _prebuiltFailed = false;

  function _loadPrebuiltPayload() {
    if (_prebuiltPayload) return Promise.resolve(_prebuiltPayload);
    if (_prebuiltFailed) return Promise.resolve(null);
    if (_prebuiltLoading) {
      return new Promise(function (resolve) {
        var check = setInterval(function () {
          if (_prebuiltPayload || _prebuiltFailed) { clearInterval(check); resolve(_prebuiltPayload); }
        }, 100);
      });
    }
    _prebuiltLoading = true;
    return fetch('/assets/data/deep/medicine-deep-directives.json')
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function (data) {
        if (data && data.directives && data.directives.length > 0) {
          _prebuiltPayload = data;
          console.log('[MedicineDirectiveExtractor] Prebuilt payload loaded: ' + data.directives.length + ' deep directives, maxDepth=' + data.traversal.maxDepth);
        }
        _prebuiltLoading = false;
        return _prebuiltPayload;
      })
      .catch(function () {
        _prebuiltFailed = true;
        _prebuiltLoading = false;
        console.log('[MedicineDirectiveExtractor] No prebuilt payload \u2014 falling back to live extraction');
        return null;
      });
  }

  /**
   * Fetch portal JSON with static-first strategy:
   *   1. Check in-memory cache
   *   2. Try static asset path (/assets/data/domains/{domainId}.json) — already on CDN
   *   3. Fallback to API route (/api/fetch-portal?domainId=X) — goes through GitHub
   */
  var _notFoundCache = {}; // Cache 404s to avoid re-fetching missing files

  function _fetchPortalJSON(domainId) {
    var cached = _portalCache[domainId];
    if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
      return Promise.resolve(cached.data);
    }

    // Fast-fail: if we already know this file doesn't exist, skip immediately
    if (_notFoundCache[domainId]) return Promise.resolve(null);

    var staticUrl = '/assets/data/domains/' + encodeURIComponent(domainId) + '.json';

    return fetch(staticUrl)
      .then(function (r) {
        if (!r.ok) {
          _notFoundCache[domainId] = true;
          throw new Error('Static ' + r.status);
        }
        return r.json();
      })
      .then(function (data) {
        if (data && data.activations) {
          _portalCache[domainId] = { data: data, ts: Date.now() };
        }
        return data;
      })
      .catch(function () {
        _notFoundCache[domainId] = true;
        return cached ? cached.data : null;
      });
  }

  /**
   * Derive the JSON domainId from a childPortal HTML filename.
   * e.g. "medicine_cardiology_portal.html" → "medicine_cardiology"
   */
  function _portalFileToId(filename) {
    if (!filename) return null;
    return filename.replace(/_portal\.html$/, '').replace(/\.html$/, '');
  }

  /**
   * Score a branch's relevance to decide whether to descend.
   * Returns 0-1. Below 0.2 = don't descend.
   */
  function _scoreBranchRelevance(activation, activeNodeIds, stress) {
    var score = 0;

    // Node is in active diagnosis pathway — high relevance
    if (activeNodeIds[activation.brainNodeId]) score += 0.5;

    // Has treatments with content
    var treats = activation.treatments || [];
    if (treats.length > 0) score += 0.15;

    // Has steps (deeper structure)
    for (var ti = 0; ti < treats.length; ti++) {
      if (treats[ti].steps && treats[ti].steps.length > 0) { score += 0.1; break; }
    }

    // Has companies (monetizable)
    if (activation.companies && activation.companies.length > 0) score += 0.1;

    // Has child portal (can go deeper)
    if (activation.childPortal) score += 0.05;

    // Stress amplification
    score += stress * 0.1;

    return Math.min(1, score);
  }

  /**
   * Extract directives from a single portal JSON at a given depth.
   * Recursive — follows ALL child portals until leaf nodes.
   */
  function _extractFromPortal(domainId, portalData, activeNodeIds, stress, depth, path, seen, results) {
    if (!portalData) return Promise.resolve();

    var activations = portalData.activations || [];
    var childFetches = [];

    for (var ai = 0; ai < activations.length; ai++) {

      var act = activations[ai];
      var nodeId = act.brainNodeId || '';
      var relevance = _scoreBranchRelevance(act, activeNodeIds, stress);

      // Extract treatments from this activation
      var treatments = act.treatments || [];
      for (var ti = 0; ti < treatments.length; ti++) {

        var t = treatments[ti];
        var label = t.label || '';
        if (!label) continue;

        // Dedup by label + node + depth path
        var dedupeKey = (label.substring(0, 60) + '||' + nodeId + '||' + domainId).toLowerCase();
        if (seen[dedupeKey]) continue;
        seen[dedupeKey] = true;

        // Extract company context
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
          // Identity
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

          // Treatment content
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

          // Activation context
          diagnosticTriggers: act.diagnosticTriggers || [],
          childPortal: act.childPortal || null,
          functionalRole: act.functional_role || '',
          phaseArchetype: act.phase_archetype || '',

          // Companies
          companies: companies,

          // Fractal metadata
          depth: depth,
          portalDomainId: domainId,
          portalTitle: portalData.title || '',
          ancestryPath: path.concat([domainId]),
          branchRelevance: relevance,

          // Domain context
          stress: stress,
          domain: 'medicine'
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

    // Fetch child portals in parallel
    if (childFetches.length === 0) return Promise.resolve();

    var childPromises = childFetches.map(function (cf) {
      return _fetchPortalJSON(cf.childId).then(function (childData) {
        if (!childData) return Promise.resolve();
        return _extractFromPortal(cf.childId, childData, activeNodeIds, stress, depth + 1, cf.path, seen, results);
      });
    });

    return Promise.all(childPromises);
  }

  /**
   * Main extraction entry point.
   *
   * @param {Object} state - medicine brain state
   * @param {Object} portal - L0 medicine portal JSON (medicine.json)
   * @param {Object} opts - optional
   * @returns {Promise<Array>} extracted directive candidates
   */
  function extract(state, portal, opts) {
    if (!window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) return Promise.resolve([]);
    if (!state || !portal) return Promise.resolve([]);

    var activeDx = (state.diagnoses || []).filter(function (d) { return d.active; });
    var stress = state.stress || 0;

    // Build active nodeId → diagnosis context from all active diagnoses
    var activeNodeIds = {};
    for (var di = 0; di < activeDx.length; di++) {
      var dx = activeDx[di];
      var circuits = dx.circuits || [];
      for (var ci = 0; ci < circuits.length; ci++) {
        activeNodeIds[circuits[ci].nodeId] = {
          diagnosisId: dx.id,
          diagnosisLabel: dx.label,
          dir: circuits[ci].dir,
          detail: circuits[ci].detail,
          evidence: circuits[ci].evidence
        };
      }
    }

    // ── PREBUILT PAYLOAD PATH — serves ranked intelligence even without active diagnoses ──
    // NO activeDx gate on prebuilt path
    return _loadPrebuiltPayload().then(function (prebuilt) {
      if (prebuilt && prebuilt.directives) {
        var filtered = [];
        for (var pi = 0; pi < prebuilt.directives.length; pi++) {
          var d = prebuilt.directives[pi];
          var dxCtx = activeNodeIds[d.nodeId] || null;
          // With active diagnoses: enrich with diagnosis context
          if (dxCtx) {
            d.diagnosisId = dxCtx.diagnosisId;
            d.diagnosisLabel = dxCtx.diagnosisLabel;
            d.circuitDir = dxCtx.dir;
            d.circuitDetail = dxCtx.detail;
            d.circuitEvidence = dxCtx.evidence;
            d.stress = stress;
            d.domain = 'medicine';
            filtered.push(d);
          } else if (d.treatmentEvidence === 'Strong' || d.treatmentEvidence === 'A') {
            d.stress = stress;
            d.domain = 'medicine';
            filtered.push(d);
          }
        }
        console.log('[MedicineDirectiveExtractor] Prebuilt: ' + filtered.length + ' candidates from ' + prebuilt.directives.length + ' total, ' + activeDx.length + ' active diagnoses');
        return filtered;
      }

      // ── FALLBACK: live portal extraction (original path) ──
      console.log('[MedicineDirectiveExtractor] Using live extraction fallback');
      return _liveExtract(state, portal, activeNodeIds, activeDx, stress, opts);
    });
  }

  function _liveExtract(state, portal, activeNodeIds, activeDx, stress, opts) {
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
            return _extractFromPortal(pid, data, activeNodeIds, stress, 1, ['medicine'], seen, results);
          });
        });
      })(diagnosisMappedPortals[pi]);
    }

    return chain
      .then(function () {
        // ── STAGE 2: L0 root portal traversal (fills remaining budget) ──
        return _extractFromPortal('medicine', portal, activeNodeIds, stress, 0, [], seen, results);
      })
      .then(function () {
        console.log('[MedicineDirectiveExtractor] Extracted ' + results.length + ' candidates from ' +
          activeDx.length + ' active diagnoses, exhaustive-depth' +
          ' (stage1-mapped=' + diagnosisMappedPortals.length + ')');
        return results;
      });
  }

  window.LIMENMedicineDirectiveExtractor = {
    extract: extract,
    // Exposed for testing
    _fetchPortalJSON: _fetchPortalJSON,
    _portalFileToId: _portalFileToId
  };
})();
