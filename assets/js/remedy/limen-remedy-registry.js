/**
 * LIMEN HELIX — Remedy Registry
 * ══════════════════════════════
 *
 * Centralized registry that:
 *   1. Harvests treatments from portal domain JSONs
 *   2. Indexes by diagnosis, domain, circuit, pattern, scale
 *   3. Provides deterministic query methods
 *   4. Supports cross-domain propagation lookups
 *   5. Caches scanned portals to prevent re-scanning
 *   6. Validates all outputs against fractal-report-schema
 *
 * Populates window.LIMENRemedyRegistry in the shape
 * expected by remedy-resolver.js:
 *   { remedies: [], index: { byScale, byPattern, byNode, byDomain, byPortal, byType, byEvidence } }
 *
 * IIFE — exposes window.LIMENRemedyRegistryManager
 *        populates window.LIMENRemedyRegistry
 */
(function () {
  'use strict';

  var _global = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {});

  // ═══════════════════════════════════════════════════════════════
  // INTERNAL STATE
  // ═══════════════════════════════════════════════════════════════

  // Master stores
  var _treatments = {};   // treatmentId → treatment (fractal schema shape)
  var _diagnoses  = {};   // diagnosisId → diagnosis (fractal schema shape)
  var _steps      = {};   // stepId → step (fractal schema shape)

  // Indexes
  var _byDiagnosis = {};  // diagnosisId → [treatmentId]
  var _byDomain    = {};  // domainId → [treatmentId]
  var _byCircuit   = {};  // nodeId → [treatmentId]
  var _byType      = {};  // treatmentType → [treatmentId]
  var _byScale     = {};  // scaleTag → [treatmentId]
  var _byPattern   = {};  // patternClass → [treatmentId]
  var _byEvidence  = {};  // evidenceGrade → [treatmentId]
  var _byPortal    = {};  // portalId → [treatmentId]

  // Diagnosis indexes
  var _dxByDomain  = {};  // domainId → [diagnosisId]
  var _dxByCircuit = {};  // nodeId → [diagnosisId]

  // Cache: scanned portal domainIds
  var _scannedPortals = {};

  // Negative cache for harvest urls that 404. Populated by harvestFromUrl
  // on failure; checked at entry. Optional missing files (e.g. health.json,
  // research.json, supplyChain.json, agriculture.json) are skipped on
  // subsequent harvests instead of refetched + re-warned per file.
  var _harvestNegCache = {};

  // Resolver-compatible remedies (the shape remedy-resolver.js expects)
  var _resolverRemedies = [];

  // Priority cache
  var _priorityCache = null;

  // ═══════════════════════════════════════════════════════════════
  // EVIDENCE GRADE RANKING (for sorting)
  // ═══════════════════════════════════════════════════════════════

  var EVIDENCE_RANK = {
    'A': 10, 'Strong': 10,
    'A-': 9,
    'B+': 8,
    'B': 7, 'Moderate': 7,
    'B-': 6,
    'C+': 5,
    'C': 4, 'Limited': 4,
    'None': 0
  };

  var SEVERITY_RANK = {
    'critical': 5,
    'high': 4,
    'moderate': 3,
    'low': 2,
    'info': 1
  };

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════

  function _addToIndex(index, key, value) {
    if (!key) return;
    var k = String(key);
    if (!index[k]) index[k] = [];
    if (index[k].indexOf(value) === -1) index[k].push(value);
  }

  function _getSchema() {
    return _global.LIMENFractalSchema || null;
  }

  function _validate(level, obj) {
    var schema = _getSchema();
    if (!schema) return { valid: true, errors: [] };
    var fn = schema['validate' + level.charAt(0).toUpperCase() + level.slice(1)];
    if (!fn) return { valid: true, errors: [] };
    return fn(obj);
  }

  function _generateId(prefix) {
    var ts = Date.now().toString(36);
    var rnd = Math.random().toString(36).substring(2, 8);
    return prefix + '-' + ts + '-' + rnd;
  }

  function _evidenceScore(grade) {
    return EVIDENCE_RANK[grade] || 0;
  }

  function _severityScore(sev) {
    return SEVERITY_RANK[sev] || 0;
  }

  // ═══════════════════════════════════════════════════════════════
  // CORE: registerStep
  // ═══════════════════════════════════════════════════════════════

  function registerStep(step) {
    if (!step || !step.id) return null;
    var v = _validate('step', step);
    if (!v.valid) {
      console.warn('[LIMENRemedyRegistry] Invalid step ' + step.id + ':', v.errors[0].message);
      return null;
    }
    _steps[step.id] = step;
    return step.id;
  }

  // ═══════════════════════════════════════════════════════════════
  // CORE: registerTreatment
  // ═══════════════════════════════════════════════════════════════

  function registerTreatment(treatment, meta) {
    if (!treatment || !treatment.id) return null;

    var v = _validate('treatment', treatment);
    if (!v.valid) {
      console.warn('[LIMENRemedyRegistry] Invalid treatment ' + treatment.id + ':', v.errors[0].message);
      return null;
    }

    // ── Stamp provenance onto treatment object ──
    if (meta) {
      if (meta.diagnosisId) treatment._diagnosisId = meta.diagnosisId;
      if (meta.domainId) treatment._domainId = meta.domainId;
      if (meta.portalId) treatment._portalId = meta.portalId;
      if (meta.portalUrl) treatment._portalUrl = meta.portalUrl;
      if (meta.circuits && meta.circuits.length > 0) treatment._circuits = meta.circuits.slice();
    }
    treatment._registeredAt = Date.now();

    // Store treatment
    _treatments[treatment.id] = treatment;
    _priorityCache = null;

    // Index by type
    _addToIndex(_byType, treatment.type, treatment.id);

    // Index by scale tags
    var scales = treatment.scaleTags || [];
    for (var si = 0; si < scales.length; si++) {
      _addToIndex(_byScale, scales[si], treatment.id);
    }

    // Index by evidence grade
    if (treatment.evidence && treatment.evidence.grade) {
      _addToIndex(_byEvidence, treatment.evidence.grade, treatment.id);
    }

    // Index by spillover targets
    var spills = treatment.spillover || [];
    for (var spi = 0; spi < spills.length; spi++) {
      if (spills[spi].targetDomainId) {
        _addToIndex(_byDomain, spills[spi].targetDomainId, treatment.id);
      }
    }

    // Register steps
    var steps = treatment.steps || [];
    for (var sti = 0; sti < steps.length; sti++) {
      registerStep(steps[sti]);
    }

    // Meta-based indexing (diagnosis, domain, circuits, portal, patterns)
    if (meta) {
      if (meta.diagnosisId) _addToIndex(_byDiagnosis, meta.diagnosisId, treatment.id);
      if (meta.domainId) _addToIndex(_byDomain, meta.domainId, treatment.id);
      if (meta.portalId) _addToIndex(_byPortal, meta.portalId, treatment.id);
      var circuits = meta.circuits || [];
      for (var ci = 0; ci < circuits.length; ci++) {
        _addToIndex(_byCircuit, circuits[ci], treatment.id);
      }
      var patterns = meta.patterns || [];
      for (var pi = 0; pi < patterns.length; pi++) {
        _addToIndex(_byPattern, patterns[pi], treatment.id);
      }
    }

    return treatment.id;
  }

  // ═══════════════════════════════════════════════════════════════
  // CORE: registerDiagnosis
  // ═══════════════════════════════════════════════════════════════

  function registerDiagnosis(diagnosis, meta) {
    if (!diagnosis || !diagnosis.id) return null;

    var v = _validate('diagnosis', diagnosis);
    if (!v.valid) {
      console.warn('[LIMENRemedyRegistry] Invalid diagnosis ' + diagnosis.id + ':', v.errors[0].message);
      return null;
    }

    // ── Stamp provenance onto diagnosis object ──
    if (meta) {
      if (meta.domainId) diagnosis._domainId = meta.domainId;
      if (meta.portalId) diagnosis._portalId = meta.portalId;
      if (meta.portalUrl) diagnosis._portalUrl = meta.portalUrl;
      if (meta.signalIds) diagnosis._signalIds = meta.signalIds.slice();
    }
    diagnosis._registeredAt = Date.now();

    _diagnoses[diagnosis.id] = diagnosis;

    // Index diagnosis by domain
    if (meta && meta.domainId) {
      _addToIndex(_dxByDomain, meta.domainId, diagnosis.id);
    }

    // Index diagnosis by circuits
    var circuits = diagnosis.circuits || [];
    for (var ci = 0; ci < circuits.length; ci++) {
      if (circuits[ci].nodeId) {
        _addToIndex(_dxByCircuit, circuits[ci].nodeId, diagnosis.id);
      }
    }

    // Register all treatments within diagnosis
    var treatments = diagnosis.treatments || [];
    var circuitIds = circuits.map(function (c) { return c.nodeId; }).filter(Boolean);
    for (var ti = 0; ti < treatments.length; ti++) {
      registerTreatment(treatments[ti], {
        diagnosisId: diagnosis.id,
        domainId: meta ? meta.domainId : null,
        portalId: meta ? meta.portalId : null,
        circuits: circuitIds
      });
    }

    // Index propagation
    var props = diagnosis.propagation || [];
    for (var pi = 0; pi < props.length; pi++) {
      if (props[pi].targetDomainId) {
        _addToIndex(_dxByDomain, props[pi].targetDomainId, diagnosis.id);
      }
    }

    return diagnosis.id;
  }

  // ═══════════════════════════════════════════════════════════════
  // QUERY METHODS
  // ═══════════════════════════════════════════════════════════════

  function getTreatmentsForDiagnosis(diagnosisId) {
    var ids = _byDiagnosis[diagnosisId] || [];
    return _resolveTreatments(ids);
  }

  function getTreatmentsForDomain(domainId) {
    var ids = _byDomain[domainId] || [];
    return _resolveTreatments(ids);
  }

  function getTreatmentsForCircuit(circuitId) {
    var ids = _byCircuit[String(circuitId)] || [];
    return _resolveTreatments(ids);
  }

  function getStepsForTreatment(treatmentId) {
    var t = _treatments[treatmentId];
    if (!t) return [];
    return (t.steps || []).slice();
  }

  function getTreatmentsForPattern(patternClass) {
    var ids = _byPattern[patternClass] || [];
    return _resolveTreatments(ids);
  }

  function getTreatmentsForScale(scaleTag) {
    var ids = _byScale[scaleTag] || [];
    return _resolveTreatments(ids);
  }

  function getTreatmentsForPortal(portalId) {
    var ids = _byPortal[portalId] || [];
    return _resolveTreatments(ids);
  }

  function getDiagnosis(diagnosisId) {
    return _diagnoses[diagnosisId] || null;
  }

  function getDiagnosesForDomain(domainId) {
    var ids = _dxByDomain[domainId] || [];
    var result = [];
    for (var i = 0; i < ids.length; i++) {
      if (_diagnoses[ids[i]]) result.push(_diagnoses[ids[i]]);
    }
    return result;
  }

  function getDiagnosesForCircuit(circuitId) {
    var ids = _dxByCircuit[String(circuitId)] || [];
    var result = [];
    for (var i = 0; i < ids.length; i++) {
      if (_diagnoses[ids[i]]) result.push(_diagnoses[ids[i]]);
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  // PROVENANCE — full chain reconstruction
  // ═══════════════════════════════════════════════════════════════

  /**
   * Given a treatment ID, return the full provenance chain:
   *   signal → diagnosis → treatment → portal
   *
   * @param {string} treatmentId
   * @returns {object} { treatment, diagnosis, signals, portal, chain }
   */
  function getProvenance(treatmentId) {
    var t = _treatments[treatmentId];
    if (!t) return null;

    // Find parent diagnosis
    var diagnosisId = t._diagnosisId || null;
    var diagnosis = diagnosisId ? (_diagnoses[diagnosisId] || null) : null;

    // If no direct link, reverse-search indexes
    if (!diagnosis) {
      for (var dxId in _byDiagnosis) {
        if (!_byDiagnosis.hasOwnProperty(dxId)) continue;
        var txIds = _byDiagnosis[dxId];
        for (var i = 0; i < txIds.length; i++) {
          if (txIds[i] === treatmentId) {
            diagnosis = _diagnoses[dxId] || null;
            diagnosisId = dxId;
            break;
          }
        }
        if (diagnosis) break;
      }
    }

    // Extract signals from diagnosis indicators
    var signals = [];
    if (diagnosis) {
      var indicators = diagnosis.indicators || [];
      for (var si = 0; si < indicators.length; si++) {
        signals.push({
          id: indicators[si].id,
          label: indicators[si].label,
          value: indicators[si].value,
          threshold: indicators[si].threshold,
          direction: indicators[si].direction,
          sourceSignalId: indicators[si]._sourceSignalId || null
        });
      }
    }

    // Portal source
    var portalId = t._portalId || (diagnosis ? diagnosis._portalId : null) || null;
    var portalUrl = t._portalUrl || (diagnosis ? diagnosis._portalUrl : null) || null;
    var domainId = t._domainId || (diagnosis ? diagnosis._domainId : null) || null;

    // Build readable chain
    var chain = [];
    if (signals.length > 0) {
      chain.push('SIGNAL: ' + signals.map(function (s) { return s.label + '=' + s.value; }).join(', '));
    }
    if (diagnosis) {
      chain.push('DIAGNOSIS: [' + diagnosis.severity + '] ' + diagnosis.title + ' (id:' + diagnosisId + ')');
    }
    chain.push('TREATMENT: ' + t.title + ' (id:' + t.id + ', type:' + t.type + ')');
    if (portalId) {
      chain.push('SOURCE: portal=' + portalId + (portalUrl ? ' url=' + portalUrl : ''));
    }
    if (domainId) {
      chain.push('DOMAIN: ' + domainId);
    }

    return {
      treatment: t,
      treatmentId: treatmentId,
      diagnosis: diagnosis,
      diagnosisId: diagnosisId,
      signals: signals,
      portal: { id: portalId, url: portalUrl },
      domainId: domainId,
      circuits: t._circuits || (diagnosis ? (diagnosis.circuits || []).map(function (c) { return c.nodeId; }) : []),
      registeredAt: t._registeredAt || null,
      chain: chain
    };
  }

  function _resolveTreatments(ids) {
    var result = [];
    var seen = {};
    for (var i = 0; i < ids.length; i++) {
      if (!seen[ids[i]] && _treatments[ids[i]]) {
        result.push(_treatments[ids[i]]);
        seen[ids[i]] = true;
      }
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  // CROSS-DOMAIN PROPAGATION QUERIES
  // ═══════════════════════════════════════════════════════════════

  /**
   * Returns treatments relevant when a circuit activates.
   * Looks up: direct circuit matches + diagnoses with that circuit + their treatments.
   */
  function getTreatmentsOnCircuitActivation(nodeId) {
    var direct = getTreatmentsForCircuit(nodeId);
    var dxIds = _dxByCircuit[String(nodeId)] || [];
    var fromDx = [];
    for (var i = 0; i < dxIds.length; i++) {
      var dx = _diagnoses[dxIds[i]];
      if (dx && dx.treatments) {
        for (var j = 0; j < dx.treatments.length; j++) {
          fromDx.push(dx.treatments[j]);
        }
      }
    }
    return _dedup(direct.concat(fromDx));
  }

  /**
   * Returns treatments when domain stress exceeds threshold.
   * Gets all treatments for that domain + propagation targets.
   */
  function getTreatmentsOnDomainStress(domainId, stressLevel) {
    var threshold = stressLevel || 0;
    var treatments = getTreatmentsForDomain(domainId);

    // Also find diagnoses in this domain and check severity
    var dxIds = _dxByDomain[domainId] || [];
    for (var i = 0; i < dxIds.length; i++) {
      var dx = _diagnoses[dxIds[i]];
      if (!dx) continue;
      var sev = _severityScore(dx.severity);
      // Include if severity aligns with stress
      if (sev >= 3 || threshold >= 0.5) {
        var txs = dx.treatments || [];
        for (var j = 0; j < txs.length; j++) {
          treatments.push(txs[j]);
        }
      }
    }
    return _dedup(treatments);
  }

  /**
   * Returns treatments when a diagnosis matches given indicators.
   * Checks indicator thresholds against provided values.
   */
  function getTreatmentsOnIndicatorMatch(indicatorValues) {
    if (!indicatorValues || typeof indicatorValues !== 'object') return [];
    var treatments = [];

    for (var dxId in _diagnoses) {
      if (!_diagnoses.hasOwnProperty(dxId)) continue;
      var dx = _diagnoses[dxId];
      var indicators = dx.indicators || [];
      var matched = false;

      for (var ii = 0; ii < indicators.length; ii++) {
        var ind = indicators[ii];
        if (ind.id && indicatorValues[ind.id] !== undefined) {
          var val = indicatorValues[ind.id];
          var thresh = ind.threshold;
          var dir = ind.direction;
          if (thresh !== undefined && thresh !== null) {
            if ((dir === 'rising' && val >= thresh) ||
                (dir === 'falling' && val <= thresh) ||
                (!dir && Math.abs(val) >= Math.abs(thresh))) {
              matched = true;
              break;
            }
          } else {
            matched = true;
            break;
          }
        }
      }

      if (matched) {
        var txs = dx.treatments || [];
        for (var ti = 0; ti < txs.length; ti++) {
          treatments.push(txs[ti]);
        }
      }
    }
    return _dedup(treatments);
  }

  function _dedup(arr) {
    var seen = {};
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var id = arr[i].id;
      if (id && !seen[id]) {
        seen[id] = true;
        out.push(arr[i]);
      }
    }
    return out;
  }

  // ═══════════════════════════════════════════════════════════════
  // DETERMINISTIC PRIORITY ORDERING
  // ═══════════════════════════════════════════════════════════════

  /**
   * Sorts treatments by composite priority score.
   * Factors:
   *   severity (of parent diagnosis) × 0.30
   *   evidence grade × 0.25
   *   domain urgency (stress) × 0.25
   *   propagation risk × 0.20
   *
   * @param {Treatment[]} treatments
   * @param {object} context — { domainStress: {domainId → 0–1}, diagnosisSeverity: {diagnosisId → severity} }
   * @returns {Treatment[]} sorted copy
   */
  // ── Outcome weight factor for treatments ──
  // Reads pathway weights from localStorage (written by console-clarity).
  // Maps treatment's linked domains to connectome nodes, applies hub-specificity.
  var _RX_PATHWAY_MAP = {
    energy: ['THAL','dlPFC','BLA'], health: ['NTS','AI','HIPP'],
    finance: ['BLA','vmPFC','NAcc'], technology: ['dlPFC','THAL','BDNF'],
    defense: ['BLA','PAG','dACC'], environment: ['NTS','THAL','AI'],
    education: ['HIPP','PCC','DMN'], governance: ['dlPFC','dACC','mPFC'],
    industry: ['THAL','dlPFC','GP'], trade: ['THAL','dlPFC','NAcc']
  };
  var _RX_HUB_FREQ = {};
  (function() {
    for (var d in _RX_PATHWAY_MAP) {
      for (var i = 0; i < _RX_PATHWAY_MAP[d].length; i++) {
        _RX_HUB_FREQ[_RX_PATHWAY_MAP[d][i]] = (_RX_HUB_FREQ[_RX_PATHWAY_MAP[d][i]] || 0) + 1;
      }
    }
  })();

  function _outcomeWeightFactor(treatment) {
    if (typeof localStorage === 'undefined') return 1.0;
    var weights;
    try { weights = JSON.parse(localStorage.getItem('limen_pathway_weights') || '{}'); } catch(e) { return 1.0; }
    // Find domains linked to this treatment
    var linkedDomains = [];
    for (var domId in _byDomain) {
      if (_byDomain.hasOwnProperty(domId) && _byDomain[domId].indexOf(treatment.id) !== -1) {
        linkedDomains.push(domId);
      }
    }
    if (linkedDomains.length === 0) return 1.0;
    // Use first linked domain for pathway lookup
    var domain = linkedDomains[0];
    var nodes = _RX_PATHWAY_MAP[domain];
    if (!nodes) return 1.0; // unmapped = no adjustment
    var nodeFactors = [];
    for (var i = 0; i < nodes.length; i++) {
      var w = weights[nodes[i]];
      if (!w || !w.total) continue;
      var raw = w.factor;
      var isDirect = w.domains && w.domains[domain];
      if (isDirect) {
        nodeFactors.push(raw);
      } else {
        var spec = 1 / Math.sqrt(_RX_HUB_FREQ[nodes[i]] || 1);
        nodeFactors.push(1.0 + (raw - 1.0) * spec);
      }
    }
    if (nodeFactors.length === 0) return 1.0;
    nodeFactors.sort(function(a, b) { return Math.abs(b - 1.0) - Math.abs(a - 1.0); });
    var anchor = nodeFactors[0];
    if (nodeFactors.length === 1) return Math.max(0.8, Math.min(1.2, anchor));
    var restSum = 0;
    for (var j = 1; j < nodeFactors.length; j++) restSum += nodeFactors[j];
    var blended = anchor * 0.6 + (restSum / (nodeFactors.length - 1)) * 0.4;
    return Math.max(0.8, Math.min(1.2, blended));
  }

  function prioritize(treatments, context) {
    if (!treatments || treatments.length === 0) return [];
    var ctx = context || {};
    var domainStress = ctx.domainStress || {};
    var dxSeverity = ctx.diagnosisSeverity || {};

    var scored = treatments.map(function (t) {
      // Evidence score (0–1 normalized)
      var evGrade = (t.evidence && t.evidence.grade) ? t.evidence.grade : 'None';
      var evScore = _evidenceScore(evGrade) / 10;

      // Severity score — find parent diagnosis
      var sevScore = 0;
      for (var dxId in _byDiagnosis) {
        if (_byDiagnosis.hasOwnProperty(dxId)) {
          var txIds = _byDiagnosis[dxId];
          if (txIds.indexOf(t.id) !== -1) {
            var dx = _diagnoses[dxId];
            if (dx) {
              sevScore = _severityScore(dxSeverity[dxId] || dx.severity) / 5;
            }
            break;
          }
        }
      }

      // Domain urgency — average stress of linked domains
      var urgency = 0;
      var urgCount = 0;
      for (var domId in _byDomain) {
        if (_byDomain.hasOwnProperty(domId)) {
          var domTxIds = _byDomain[domId];
          if (domTxIds.indexOf(t.id) !== -1 && domainStress[domId] !== undefined) {
            urgency += domainStress[domId];
            urgCount++;
          }
        }
      }
      if (urgCount > 0) urgency /= urgCount;

      // Propagation risk — number of spillover targets × mean magnitude
      var propRisk = 0;
      var spills = t.spillover || [];
      if (spills.length > 0) {
        var totalMag = 0;
        for (var si = 0; si < spills.length; si++) {
          totalMag += (spills[si].magnitude || 0);
        }
        propRisk = Math.min(1, (totalMag / spills.length) * (spills.length / 3));
      }

      var composite = (sevScore * 0.30) + (evScore * 0.25) + (urgency * 0.25) + (propRisk * 0.20);

      // Outcome weight: boost/suppress based on pathway learning (0.8x–1.2x)
      var outcomeFactor = _outcomeWeightFactor(t);
      composite *= outcomeFactor;

      return { treatment: t, score: composite };
    });

    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      // Tie-break: alphabetical by id for determinism
      return a.treatment.id < b.treatment.id ? -1 : 1;
    });

    return scored.map(function (s) { return s.treatment; });
  }

  // ═══════════════════════════════════════════════════════════════
  // PORTAL HARVESTING
  // ═══════════════════════════════════════════════════════════════

  /**
   * Harvest treatments from a legacy domain JSON (portal definition).
   * Uses LIMENFractalSchema.fromLegacyDomain() to convert, then registers all.
   *
   * @param {object} domainJson — raw domain JSON from assets/data/domains/
   * @param {object} opts — { domainId, parentDomain }
   * @returns {number} count of treatments registered
   */
  function harvestFromPortal(domainJson, opts) {
    if (!domainJson) return 0;
    var domainId = (opts && opts.domainId) || domainJson.domainId || 'unknown';

    // Check cache
    if (_scannedPortals[domainId]) return 0;

    var schema = _getSchema();
    var portal;
    if (schema && schema.fromLegacyDomain) {
      portal = schema.fromLegacyDomain(domainJson);
    } else {
      portal = _legacyToPortalFallback(domainJson);
    }
    if (!portal) return 0;

    _scannedPortals[domainId] = true;
    var count = 0;
    var parentDomain = (opts && opts.parentDomain) || _extractParentDomain(domainId);
    var portalUrl = (opts && opts.portalUrl) || null;

    var diagnoses = portal.diagnoses || [];
    for (var di = 0; di < diagnoses.length; di++) {
      var dx = diagnoses[di];
      var registered = registerDiagnosis(dx, {
        domainId: parentDomain,
        portalId: domainId,
        portalUrl: portalUrl
      });
      if (registered) {
        count += (dx.treatments || []).length;
      }
    }

    console.log('[LIMENRemedyRegistry] Harvested ' + count + ' treatments from ' + domainId);
    return count;
  }

  /**
   * Harvest from multiple portal JSONs at once.
   * @param {object[]} domainJsons
   * @returns {number} total treatments registered
   */
  function harvestBatch(domainJsons) {
    if (!Array.isArray(domainJsons)) return 0;
    var total = 0;
    for (var i = 0; i < domainJsons.length; i++) {
      total += harvestFromPortal(domainJsons[i]);
    }
    return total;
  }

  /**
   * Fetch and harvest a portal by URL.
   * @param {string} url — path to domain JSON
   * @param {function} callback — (err, count)
   */
  function harvestFromUrl(url, callback) {
    if (typeof fetch === 'undefined') {
      if (callback) callback(new Error('fetch not available'), 0);
      return;
    }
    // Skip urls that already 404'd this session — optional missing files
    // (health.json, research.json, supplyChain.json, agriculture.json,
    // etc.) are not retried per harvest cycle.
    if (_harvestNegCache[url]) {
      if (callback) callback(new Error('cached miss'), 0);
      return;
    }
    fetch(url).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (json) {
      var count = harvestFromPortal(json, { portalUrl: url });
      if (callback) callback(null, count);
    }).catch(function (err) {
      // Treat as optional missing file. No per-file warn; harvestFromUrls
      // emits one consolidated summary line at end of the batch.
      _harvestNegCache[url] = Date.now();
      if (callback) callback(err, 0);
    });
  }

  /**
   * Fetch and harvest multiple portals by URL.
   * @param {string[]} urls
   * @param {function} callback — (totalCount)
   */
  function harvestFromUrls(urls, callback) {
    if (!Array.isArray(urls) || urls.length === 0) {
      if (callback) callback(0);
      return;
    }
    // Sequential fetch — avoids network saturation from 20+ parallel requests
    var total = 0;
    var missed = 0;
    var idx = 0;
    function next() {
      if (idx >= urls.length) {
        // One concise summary instead of N per-file warnings.
        if (missed > 0) {
          console.log('[LIMENRemedyRegistry] skipped ' + missed + ' optional missing domain files');
        }
        if (callback) callback(total);
        return;
      }
      harvestFromUrl(urls[idx++], function (err, count) {
        total += count;
        if (err) missed++;
        next();
      });
    }
    next();
  }

  // Fallback converter if fractal schema module not loaded
  function _legacyToPortalFallback(domainJson) {
    var issues = domainJson.issues || [];
    var activations = domainJson.activations || [];
    var actMap = {};
    for (var a = 0; a < activations.length; a++) {
      if (activations[a].brainNodeId) actMap[activations[a].brainNodeId] = activations[a];
    }

    var diagnoses = [];
    for (var ii = 0; ii < issues.length; ii++) {
      var issue = issues[ii];
      var circuits = (issue.circuits || []).map(function (c) {
        return { nodeId: String(c.nodeId), dir: c.dir || 'Altered', detail: c.detail || '', evidence: c.evidence || 'Limited' };
      });

      var treatments = [];
      var seen = {};
      for (var ci = 0; ci < (issue.circuits || []).length; ci++) {
        var act = actMap[(issue.circuits[ci]).nodeId];
        if (!act || !act.treatments) continue;
        for (var ti = 0; ti < act.treatments.length; ti++) {
          var rt = act.treatments[ti];
          var key = rt.label || rt.description;
          if (seen[key]) continue;
          seen[key] = true;
          var typeMap = { STRATEGY: 'strategy', COACHING: 'coaching', STRUCTURAL: 'structural', CULTURE: 'culture', TOOLS: 'tools', DIAGNOSTIC: 'diagnostic' };
          var steps = (rt.steps || []).map(function (s, si) {
            return {
              id: (issue.id || 'dx') + '_t' + ti + '_s' + (si + 1),
              action: s,
              sequence: si + 1,
              targetLevel: 'portal',
              expectedEffect: 'Progress toward ' + (rt.target || 'operational resilience'),
              dependencies: si > 0 ? [(issue.id || 'dx') + '_t' + ti + '_s' + si] : []
            };
          });
          if (steps.length === 0) {
            steps = [{ id: (issue.id || 'dx') + '_t' + ti + '_s1', action: 'Implement ' + (rt.label || 'treatment'), sequence: 1, targetLevel: 'portal', expectedEffect: 'Improvement', dependencies: [] }];
          }
          treatments.push({
            id: (issue.id || 'dx') + '_t' + ti,
            title: rt.label || rt.description || 'Treatment',
            type: typeMap[(rt.type || '').toUpperCase()] || 'strategy',
            rationale: rt.description || rt.label || '',
            prerequisites: [],
            scaleTags: ['local'],
            timeTags: ['near-term'],
            steps: steps,
            evidence: { sources: rt.cite ? [rt.cite] : [], method: 'literature-review', temporal: 'current', grade: rt.evidence || 'C' },
            monitoring: rt.monitoring || '',
            escalation: rt.escalation || '',
            citations: (rt.citation || []).map(function (ref) { return { author: ref.author || '', title: ref.title || '', year: ref.year || null }; }),
            status: 'static',
            confidence: 0.5,
            uncertainty: 0.3
          });
        }
      }

      if (treatments.length === 0) {
        treatments = [{
          id: (issue.id || 'dx_' + ii) + '_t0',
          title: 'General Intervention',
          type: 'strategy',
          rationale: 'Default intervention pending specific mapping',
          prerequisites: [],
          scaleTags: ['local'],
          timeTags: ['near-term'],
          steps: [{ id: (issue.id || 'dx_' + ii) + '_t0_s1', action: 'Assess and respond', sequence: 1, targetLevel: 'portal', expectedEffect: 'Baseline established', dependencies: [] }],
          status: 'fallback',
          confidence: 0.25,
          uncertainty: 0.5
        }];
      }

      diagnoses.push({
        id: issue.id || 'dx_' + ii,
        title: issue.label || 'Diagnosis',
        description: issue.summary || issue.label || '',
        severity: 'moderate',
        indicators: [{ id: (issue.id || 'dx_' + ii) + '_ind', label: 'Affected circuits', value: circuits.length }],
        circuits: circuits,
        treatments: treatments,
        status: 'static',
        confidence: 0.5
      });
    }

    if (diagnoses.length === 0) return null;

    return {
      id: domainJson.domainId || 'unknown',
      title: domainJson.title || 'Unknown',
      domainId: domainJson.domainId || 'unknown',
      diagnoses: diagnoses,
      status: 'static'
    };
  }

  // Extract parent domain from hierarchical domainId
  // e.g., "defense_special_ops_directact_hostageresc" → "defense"
  // e.g., "p2_agri_research_agronomy" → "p2_agri"
  function _extractParentDomain(domainId) {
    if (!domainId) return 'unknown';
    // Known top-level mappings
    var prefixes = {
      'defense': 'defense',
      'industry_defense': 'defense',
      'legal_defense': 'defense',
      'economy': 'economy',
      'energy': 'energy',
      'environment': 'environment',
      'health': 'health',
      'technology': 'technology',
      'research': 'research',
      'p2_agri': 'agriculture',
      'social': 'culture',
      'governance': 'governance',
      'security': 'defense',
      'infrastructure': 'infrastructure',
      'agriculture': 'agriculture',
      'industry': 'industry',
      'education': 'education',
      'communication': 'communication',
      'culture': 'culture',
      'religion': 'religion',
      'population': 'population',
      'law': 'law',
      'finance': 'finance',
      'intelligence': 'intelligence'
    };
    for (var prefix in prefixes) {
      if (prefixes.hasOwnProperty(prefix) && domainId.indexOf(prefix) === 0) {
        return prefixes[prefix];
      }
    }
    // Fallback: first segment
    return domainId.split('_')[0];
  }

  // ═══════════════════════════════════════════════════════════════
  // RESOLVER BRIDGE — build window.LIMENRemedyRegistry shape
  // ═══════════════════════════════════════════════════════════════

  /**
   * Converts a fractal treatment + its context into the shape
   * remedy-resolver.js expects in window.LIMENRemedyRegistry.remedies[].
   */
  function _toResolverRemedy(treatment, diagnosisId) {
    var dx = _diagnoses[diagnosisId] || {};
    var circuits = dx.circuits || [];

    // Determine linked nodes
    var linkedNodes = circuits.map(function (c) {
      var dirMap = { 'Hyper-active': 'hyper', 'Hypo-active': 'hypo', 'Altered': 'altered' };
      return {
        nodeId: c.nodeId,
        nodeLabel: c.nodeId,
        targetDirection: dirMap[c.dir] || 'altered',
        effectDirection: c.dir === 'Hyper-active' ? 'down' : (c.dir === 'Hypo-active' ? 'up' : 'stabilize'),
        weight: 0.8
      };
    });

    // Determine scale
    var scaleTags = treatment.scaleTags || ['local'];
    var scaleMap = { 'global': 'civilization', 'local': 'domain', 'user': 'portalUser' };
    var scale = scaleMap[scaleTags[0]] || 'domain';

    // Determine linked domains
    var linkedDomains = [];
    for (var domId in _byDomain) {
      if (_byDomain.hasOwnProperty(domId)) {
        if (_byDomain[domId].indexOf(treatment.id) !== -1) {
          linkedDomains.push(domId);
        }
      }
    }

    // Determine linked portals
    var linkedPortals = [];
    for (var pId in _byPortal) {
      if (_byPortal.hasOwnProperty(pId)) {
        if (_byPortal[pId].indexOf(treatment.id) !== -1) {
          linkedPortals.push(pId);
        }
      }
    }

    // Build addressesPatterns from diagnosis propagation + treatment type
    var patterns = [];
    for (var patCls in _byPattern) {
      if (_byPattern.hasOwnProperty(patCls)) {
        if (_byPattern[patCls].indexOf(treatment.id) !== -1) {
          patterns.push({ patternClass: patCls, applicability: 0.7, nodeSignature: linkedNodes.map(function (n) { return n.nodeId; }) });
        }
      }
    }
    // Default pattern if none
    if (patterns.length === 0) {
      patterns.push({
        patternClass: 'regulation_failure',
        applicability: 0.5,
        nodeSignature: linkedNodes.map(function (n) { return n.nodeId; })
      });
    }

    var evGrade = (treatment.evidence && treatment.evidence.grade) ? treatment.evidence.grade : 'C';

    // Determine dominant direction
    var dirCounts = { hyper: 0, hypo: 0, altered: 0 };
    for (var ni = 0; ni < linkedNodes.length; ni++) {
      var d = linkedNodes[ni].targetDirection;
      if (dirCounts[d] !== undefined) dirCounts[d]++;
    }
    var targetDir = 'altered';
    if (dirCounts.hyper >= dirCounts.hypo && dirCounts.hyper >= dirCounts.altered) targetDir = 'hyper';
    else if (dirCounts.hypo >= dirCounts.altered) targetDir = 'hypo';

    // Build scale payload
    var scalePayload = {};
    if (scale === 'portalUser') {
      scalePayload.treatmentLabel = treatment.title;
      scalePayload.treatmentType = (treatment.type || 'strategy').toUpperCase();
      scalePayload.steps = (treatment.steps || []).map(function (s) { return s.action; });
      scalePayload.monitoring = treatment.monitoring || '';
      scalePayload.escalation = treatment.escalation || '';
      scalePayload.target = treatment.rationale;
      scalePayload.sourcePortalId = linkedPortals[0] || null;
      scalePayload.sourceBrainNodeId = linkedNodes[0] ? linkedNodes[0].nodeId : null;
    } else if (scale === 'civilization') {
      scalePayload.systemicAction = treatment.title + ' — ' + treatment.rationale;
      scalePayload.affectedDomains = linkedDomains;
      scalePayload.stabilityTarget = treatment.confidence || 0.5;
      scalePayload.precedent = treatment.citations && treatment.citations[0] ? treatment.citations[0].title : '';
    } else {
      scalePayload.policyAction = treatment.title;
      scalePayload.affectedDomains = linkedDomains;
    }

    var timeMap = { 'immediate': 'short', 'near-term': 'medium', 'structural': 'structural' };
    var timeTags = treatment.timeTags || ['near-term'];

    return {
      id: treatment.id,
      version: 1,
      state: 'ACTIVE',
      scale: scale,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      linkedDomains: linkedDomains,
      linkedPortals: linkedPortals,
      linkedNodes: linkedNodes,
      linkedSystems: [],
      linkedChannels: [],
      remedyType: (treatment.type || 'strategy').toUpperCase(),
      targetDirection: targetDir,
      mechanism: treatment.rationale || '',
      addressesPatterns: patterns,
      contraindications: [],
      evidenceType: evGrade,
      citations: treatment.citations || [],
      cite: treatment.citations && treatment.citations[0] ? (treatment.citations[0].author + ' ' + (treatment.citations[0].year || '')) : '',
      timeHorizon: timeMap[timeTags[0]] || 'medium',
      onsetDelay: timeTags[0] === 'immediate' ? '0-7 days' : (timeTags[0] === 'structural' ? '6-18 months' : '2-8 weeks'),
      duration: timeTags[0] === 'structural' ? 'Permanent institutional change' : '4-12 weeks',
      expectedEffect: {
        expectedShift: 'Improvement in ' + (dx.title || 'target domain'),
        monitoringSignal: dx.indicators && dx.indicators[0] ? dx.indicators[0].label : 'Domain stress',
        successCriteria: 'Indicator returns below threshold',
        failureCriteria: 'No measurable improvement after 90 days'
      },
      confidence: treatment.confidence || 0.5,
      confidenceDetail: {
        confidenceScore: treatment.confidence || 0.5,
        confidenceFactors: {
          evidenceStrength: _evidenceScore(evGrade) / 10,
          patternSpecificity: patterns[0] ? patterns[0].applicability : 0.5,
          outcomeClarity: treatment.uncertainty !== undefined ? (1 - treatment.uncertainty) : 0.5,
          historicalSuccess: 0.5
        },
        confidenceTier: (treatment.confidence || 0.5) >= 0.7 ? 'high' : ((treatment.confidence || 0.5) >= 0.4 ? 'moderate' : 'low')
      },
      confidenceTier: (treatment.confidence || 0.5) >= 0.7 ? 'high' : ((treatment.confidence || 0.5) >= 0.4 ? 'moderate' : 'low'),
      historicalExamples: [],
      scalePayload: scalePayload
    };
  }

  /**
   * Build the full window.LIMENRemedyRegistry object.
   * Called after harvesting to populate the resolver-compatible global.
   */
  function buildResolverRegistry() {
    var remedies = [];
    var idxByScale = {};
    var idxByPattern = {};
    var idxByNode = {};
    var idxByDomain = {};
    var idxByPortal = {};
    var idxByType = {};
    var idxByEvidence = {};

    for (var tId in _treatments) {
      if (!_treatments.hasOwnProperty(tId)) continue;

      // Find parent diagnosis
      var parentDxId = null;
      for (var dxId in _byDiagnosis) {
        if (_byDiagnosis.hasOwnProperty(dxId)) {
          if (_byDiagnosis[dxId].indexOf(tId) !== -1) {
            parentDxId = dxId;
            break;
          }
        }
      }

      var rem = _toResolverRemedy(_treatments[tId], parentDxId);
      remedies.push(rem);

      // Build indexes
      _addToIndex(idxByScale, rem.scale, rem.id);
      for (var pi = 0; pi < rem.addressesPatterns.length; pi++) {
        _addToIndex(idxByPattern, rem.addressesPatterns[pi].patternClass, rem.id);
      }
      for (var ni = 0; ni < rem.linkedNodes.length; ni++) {
        _addToIndex(idxByNode, String(rem.linkedNodes[ni].nodeId), rem.id);
      }
      for (var di = 0; di < rem.linkedDomains.length; di++) {
        _addToIndex(idxByDomain, rem.linkedDomains[di], rem.id);
      }
      for (var ppi = 0; ppi < rem.linkedPortals.length; ppi++) {
        _addToIndex(idxByPortal, rem.linkedPortals[ppi], rem.id);
      }
      _addToIndex(idxByType, rem.remedyType, rem.id);
      _addToIndex(idxByEvidence, rem.evidenceType, rem.id);
    }

    var scaleBreakdown = {};
    for (var s in idxByScale) {
      if (idxByScale.hasOwnProperty(s)) scaleBreakdown[s] = idxByScale[s].length;
    }

    var registry = {
      version: '1.0.0',
      generatedAt: Date.now(),
      remedyCount: remedies.length,
      scaleBreakdown: scaleBreakdown,
      remedies: remedies,
      index: {
        byScale: idxByScale,
        byPattern: idxByPattern,
        byNode: idxByNode,
        byDomain: idxByDomain,
        byPortal: idxByPortal,
        byType: idxByType,
        byEvidence: idxByEvidence
      }
    };

    // Install globally for remedy-resolver.js
    _global.LIMENRemedyRegistry = registry;
    console.log('[LIMENRemedyRegistry] Built resolver registry: ' + remedies.length + ' remedies');
    return registry;
  }

  // ═══════════════════════════════════════════════════════════════
  // DEBUG: window.dumpRemedyRegistry()
  // ═══════════════════════════════════════════════════════════════

  function dumpRemedyRegistry() {
    var lines = [];
    lines.push('╔════════════════════════════════════════════════════════╗');
    lines.push('║         LIMEN REMEDY REGISTRY — DEBUG DUMP            ║');
    lines.push('╚════════════════════════════════════════════════════════╝');
    lines.push('');

    // Domains
    var domIds = Object.keys(_byDomain);
    lines.push('DOMAINS (' + domIds.length + '):');
    for (var di = 0; di < domIds.length; di++) {
      lines.push('  ' + domIds[di] + ' → ' + _byDomain[domIds[di]].length + ' treatments');
    }
    lines.push('');

    // Diagnoses
    var dxIds = Object.keys(_diagnoses);
    lines.push('DIAGNOSES (' + dxIds.length + '):');
    for (var dxi = 0; dxi < dxIds.length; dxi++) {
      var dx = _diagnoses[dxIds[dxi]];
      lines.push('  ' + dx.id + ' | ' + dx.severity + ' | ' + dx.title.substring(0, 60));
      lines.push('    circuits: ' + (dx.circuits || []).length + ' | treatments: ' + (dx.treatments || []).length);
    }
    lines.push('');

    // Treatments
    var txIds = Object.keys(_treatments);
    lines.push('TREATMENTS (' + txIds.length + '):');
    for (var txi = 0; txi < txIds.length; txi++) {
      var tx = _treatments[txIds[txi]];
      lines.push('  ' + tx.id + ' | ' + tx.type + ' | conf:' + (tx.confidence || '?'));
      lines.push('    ' + tx.title.substring(0, 70));
      lines.push('    steps: ' + (tx.steps || []).length + ' | scale: ' + (tx.scaleTags || []).join(',') + ' | time: ' + (tx.timeTags || []).join(','));
    }
    lines.push('');

    // Steps
    var stepIds = Object.keys(_steps);
    lines.push('STEPS (' + stepIds.length + '):');
    for (var sti = 0; sti < Math.min(stepIds.length, 20); sti++) {
      var st = _steps[stepIds[sti]];
      lines.push('  ' + st.id + ' [' + st.sequence + '] → ' + st.action.substring(0, 60));
    }
    if (stepIds.length > 20) lines.push('  ... and ' + (stepIds.length - 20) + ' more');
    lines.push('');

    // Index summary
    lines.push('INDEXES:');
    lines.push('  byDiagnosis:  ' + Object.keys(_byDiagnosis).length + ' keys');
    lines.push('  byDomain:     ' + Object.keys(_byDomain).length + ' keys');
    lines.push('  byCircuit:    ' + Object.keys(_byCircuit).length + ' keys');
    lines.push('  byType:       ' + Object.keys(_byType).length + ' keys');
    lines.push('  byScale:      ' + Object.keys(_byScale).length + ' keys');
    lines.push('  byPattern:    ' + Object.keys(_byPattern).length + ' keys');
    lines.push('  byEvidence:   ' + Object.keys(_byEvidence).length + ' keys');
    lines.push('  byPortal:     ' + Object.keys(_byPortal).length + ' keys');
    lines.push('');

    // Cache
    lines.push('SCANNED PORTALS (' + Object.keys(_scannedPortals).length + '):');
    var scanned = Object.keys(_scannedPortals);
    for (var sci = 0; sci < Math.min(scanned.length, 30); sci++) {
      lines.push('  ' + scanned[sci]);
    }
    if (scanned.length > 30) lines.push('  ... and ' + (scanned.length - 30) + ' more');

    lines.push('');
    lines.push('═══════════════════════════════════════════════════════');

    var output = lines.join('\n');
    console.log(output);
    return output;
  }

  // ═══════════════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════════════

  function stats() {
    return {
      treatments: Object.keys(_treatments).length,
      diagnoses: Object.keys(_diagnoses).length,
      steps: Object.keys(_steps).length,
      scannedPortals: Object.keys(_scannedPortals).length,
      indexKeys: {
        byDiagnosis: Object.keys(_byDiagnosis).length,
        byDomain: Object.keys(_byDomain).length,
        byCircuit: Object.keys(_byCircuit).length,
        byType: Object.keys(_byType).length,
        byScale: Object.keys(_byScale).length,
        byPattern: Object.keys(_byPattern).length,
        byPortal: Object.keys(_byPortal).length
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // CLEAR (for testing)
  // ═══════════════════════════════════════════════════════════════

  function clear() {
    _treatments = {};
    _diagnoses = {};
    _steps = {};
    _byDiagnosis = {};
    _byDomain = {};
    _byCircuit = {};
    _byType = {};
    _byScale = {};
    _byPattern = {};
    _byEvidence = {};
    _byPortal = {};
    _dxByDomain = {};
    _dxByCircuit = {};
    _scannedPortals = {};
    _resolverRemedies = [];
    _priorityCache = null;
    _global.LIMENRemedyRegistry = { remedies: [], index: null };
  }

  // ═══════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════

  var _export = {
    // Core registration
    registerTreatment:   registerTreatment,
    registerDiagnosis:   registerDiagnosis,
    registerStep:        registerStep,

    // Query methods
    getTreatmentsForDiagnosis: getTreatmentsForDiagnosis,
    getTreatmentsForDomain:    getTreatmentsForDomain,
    getTreatmentsForCircuit:   getTreatmentsForCircuit,
    getStepsForTreatment:      getStepsForTreatment,
    getTreatmentsForPattern:   getTreatmentsForPattern,
    getTreatmentsForScale:     getTreatmentsForScale,
    getTreatmentsForPortal:    getTreatmentsForPortal,
    getDiagnosis:              getDiagnosis,
    getDiagnosesForDomain:     getDiagnosesForDomain,
    getDiagnosesForCircuit:    getDiagnosesForCircuit,

    // Cross-domain propagation
    getTreatmentsOnCircuitActivation: getTreatmentsOnCircuitActivation,
    getTreatmentsOnDomainStress:      getTreatmentsOnDomainStress,
    getTreatmentsOnIndicatorMatch:    getTreatmentsOnIndicatorMatch,

    // Priority ordering
    prioritize: prioritize,

    // Portal harvesting
    harvestFromPortal:  harvestFromPortal,
    harvestBatch:       harvestBatch,
    harvestFromUrl:     harvestFromUrl,
    harvestFromUrls:    harvestFromUrls,

    // Resolver bridge
    buildResolverRegistry: buildResolverRegistry,

    // Provenance
    getProvenance: getProvenance,

    // Debug & stats
    dump:  dumpRemedyRegistry,
    stats: stats,
    clear: clear
  };

  // Initialize empty resolver registry
  if (!_global.LIMENRemedyRegistry) {
    _global.LIMENRemedyRegistry = { remedies: [], index: null };
  }

  // Install debug command
  _global.dumpRemedyRegistry = dumpRemedyRegistry;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = _export;
  }
  if (typeof window !== 'undefined') {
    window.LIMENRemedyRegistryManager = _export;
  }

})();
