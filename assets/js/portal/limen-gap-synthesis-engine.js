/**
 * limen-gap-synthesis-engine.js — Phase 25G
 *
 * Evidence-grounded structural completion of missing fractal content.
 * Detects gaps in portal diagnosis/treatment/drill-deeper coverage,
 * generates candidate structures from live signals + templates,
 * and exposes them as PROVISIONAL content for human review.
 *
 * All generated content is:
 *   - GENERATED_CANDIDATE (never auto-promoted)
 *   - evidence-anchored (minimum 3 anchors for diagnosis, 2 for treatment)
 *   - deduplicated against existing canonical content
 *   - marked with sourceContext and confidence
 *
 * Reads: LIMENDomains, LIMENPhaseAnnotations, LIMENDefenseSignals,
 *        LIMENCrossDomain, LIMENGapTemplates, entity-registry
 * Writes: localStorage (limen_generated_*), window.LIMENGapSynthesis
 * Does NOT modify: domain state, canonical portal content, stress layer
 *
 * Exposes: window.LIMENGapSynthesis
 */
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════
  // CONSTANTS
  // ══════════════════════════════════════════════════════════════════════

  var STORAGE_KEYS = {
    diagnoses:  'limen_generated_diagnoses',
    treatments: 'limen_generated_treatments',
    drillDeeper:'limen_generated_drill_deeper',
    gapAudit:   'limen_gap_audit'
  };

  var LIMITS = { diagnoses: 50, treatments: 200, drillDeeper: 200, gapAudit: 20 };
  var MIN_STRESS_FOR_SCAN = 0.45;
  var MIN_EVIDENCE_DIAGNOSIS = 3;
  var MIN_EVIDENCE_TREATMENT = 2;
  var DEDUPE_THRESHOLD = 0.7; // title similarity threshold

  // ══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════════════

  function _uid() { return Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4); }
  function _now() { return Date.now(); }

  function _lsGet(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; }
  }
  function _lsSet(key, arr, max) {
    if (arr.length > max) arr = arr.slice(-max);
    try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) {}
  }

  // Simple title similarity (Jaccard on words)
  function _titleSimilarity(a, b) {
    if (!a || !b) return 0;
    var wa = a.toLowerCase().split(/\s+/);
    var wb = b.toLowerCase().split(/\s+/);
    var setA = {}; wa.forEach(function (w) { setA[w] = true; });
    var setB = {}; wb.forEach(function (w) { setB[w] = true; });
    var inter = 0, union = 0;
    for (var w in setA) { if (setB[w]) inter++; union++; }
    for (var w2 in setB) { if (!setA[w2]) union++; }
    return union > 0 ? inter / union : 0;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PART 1 — GAP DETECTION
  // ══════════════════════════════════════════════════════════════════════

  function _getActiveDrivers(dk) {
    var drivers = [];
    // Defense/ingest signals
    var def = window.LIMENDefenseSignals || [];
    if (Array.isArray(def)) {
      for (var i = 0; i < def.length; i++) {
        var s = def[i];
        if (s.affectedDomains && s.affectedDomains.indexOf(dk) !== -1 && s.confidence !== 'LOW') {
          drivers.push(s.eventType);
        }
      }
    }
    // Cross-domain patterns
    var cross = (window.LIMENCrossDomain && window.LIMENCrossDomain.active) || [];
    for (var j = 0; j < cross.length; j++) {
      if (cross[j].domains && cross[j].domains.indexOf(dk) !== -1) {
        drivers.push('cross_domain_' + dk);
      }
    }
    // Stress-derived drivers
    var d = (window.LIMENDomains || {})[dk] || {};
    if (d.stress >= 0.65) drivers.push(dk + '_stress_high');
    else if (d.stress >= 0.45) drivers.push(dk + '_stress_elevated');
    if (d.maturity === 'STRUCTURAL') drivers.push(dk + '_persistent');
    // Snapshot signals
    var snap = window.LIMENFastBoot ? window.LIMENFastBoot.getConsoleSnapshotSync() : null;
    if (snap && snap.macroShock && snap.macroShock.detected) drivers.push('macro_shock');
    return drivers;
  }

  function _getActiveNodes(dk) {
    var tpl = (window.LIMENGapTemplates && window.LIMENGapTemplates.DIAGNOSIS_TEMPLATES) || {};
    var templates = tpl[dk] || [];
    var nodes = {};
    for (var i = 0; i < templates.length; i++) {
      var na = templates[i].nodeAffinity || [];
      for (var j = 0; j < na.length; j++) nodes[na[j]] = true;
    }
    return Object.keys(nodes);
  }

  function scanDomain(dk) {
    var d = (window.LIMENDomains || {})[dk];
    if (!d || d.stress < MIN_STRESS_FOR_SCAN) return [];
    if (d.maturity !== 'CONFIRMED' && d.maturity !== 'STRUCTURAL') return [];

    var drivers = _getActiveDrivers(dk);
    var nodes = _getActiveNodes(dk);
    var phase = (window.LIMENPhaseAnnotations || {})[dk];
    var phaseLabel = phase ? phase.phase : 'p0';

    var gaps = [];

    // Check existing generated diagnoses for this domain
    var existing = _lsGet(STORAGE_KEYS.diagnoses).filter(function (dx) {
      return dx.domain === dk && dx.status !== 'REJECTED';
    });

    // Check if we have diagnoses covering the active drivers
    var coveredDrivers = {};
    for (var ei = 0; ei < existing.length; ei++) {
      var tc = existing[ei].triggerConditions || [];
      for (var ti = 0; ti < tc.length; ti++) coveredDrivers[tc[ti]] = true;
    }

    var uncoveredDrivers = drivers.filter(function (dr) { return !coveredDrivers[dr]; });

    if (uncoveredDrivers.length > 0) {
      gaps.push({
        domain: dk,
        gapType: 'MISSING_DIAGNOSIS',
        evidence: {
          stress: d.stress,
          phase: phaseLabel,
          drivers: uncoveredDrivers,
          nodes: nodes,
          confidence: d.confidence,
          maturity: d.maturity
        },
        reason: 'Stress elevated with uncovered drivers: ' + uncoveredDrivers.join(', ')
      });
    }

    // Check treatment coverage for existing diagnoses
    var treatments = _lsGet(STORAGE_KEYS.treatments);
    for (var di = 0; di < existing.length; di++) {
      var dxTreatments = treatments.filter(function (t) { return t.diagnosisId === existing[di].id; });
      if (dxTreatments.length < 2) {
        gaps.push({
          domain: dk,
          gapType: 'WEAK_TREATMENTS',
          evidence: { stress: d.stress, diagnosisId: existing[di].id, treatmentCount: dxTreatments.length },
          reason: 'Diagnosis "' + existing[di].title + '" has only ' + dxTreatments.length + ' treatments'
        });
      }
    }

    return gaps;
  }

  function scanAllDomains() {
    var domains = window.LIMENDomains || {};
    var allGaps = [];
    for (var dk in domains) {
      if (!domains.hasOwnProperty(dk)) continue;
      var gaps = scanDomain(dk);
      allGaps = allGaps.concat(gaps);
    }

    // Store audit
    var audit = _lsGet(STORAGE_KEYS.gapAudit);
    audit.push({ timestamp: _now(), gapCount: allGaps.length, domains: allGaps.map(function (g) { return g.domain; }) });
    _lsSet(STORAGE_KEYS.gapAudit, audit, LIMITS.gapAudit);

    // Auto-generate for detected gaps
    for (var gi = 0; gi < allGaps.length; gi++) {
      var gap = allGaps[gi];
      if (gap.gapType === 'MISSING_DIAGNOSIS') {
        generateDiagnosisCandidates(gap.domain, gap.evidence);
      }
    }

    return allGaps;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PART 2 — DIAGNOSIS GENERATION
  // ══════════════════════════════════════════════════════════════════════

  function generateDiagnosisCandidates(dk, context) {
    var templates = (window.LIMENGapTemplates && window.LIMENGapTemplates.DIAGNOSIS_TEMPLATES) || {};
    var domainTemplates = templates[dk] || [];
    if (domainTemplates.length === 0) return [];

    var drivers = context.drivers || _getActiveDrivers(dk);
    var d = (window.LIMENDomains || {})[dk] || {};
    var existing = _lsGet(STORAGE_KEYS.diagnoses);

    var generated = [];

    for (var i = 0; i < domainTemplates.length; i++) {
      var tpl = domainTemplates[i];

      // Match trigger conditions against active drivers
      var matchCount = 0;
      for (var t = 0; t < tpl.triggerConditions.length; t++) {
        for (var dr = 0; dr < drivers.length; dr++) {
          if (drivers[dr].indexOf(tpl.triggerConditions[t]) !== -1 ||
              tpl.triggerConditions[t].indexOf(drivers[dr]) !== -1 ||
              drivers[dr] === tpl.triggerConditions[t]) {
            matchCount++; break;
          }
        }
      }
      if (matchCount === 0) continue;

      // Build evidence anchors
      var anchors = [];
      anchors.push({ type: 'signal', text: dk + ' domain stress at ' + Math.round(d.stress * 100) + '% (' + d.maturity + ')' });
      for (var ai = 0; ai < Math.min(drivers.length, 3); ai++) {
        anchors.push({ type: 'event', text: 'Active driver: ' + drivers[ai].replace(/_/g, ' ') });
      }
      if (d.confidence >= 0.6) anchors.push({ type: 'confidence', text: 'Domain confidence ' + Math.round(d.confidence * 100) + '%' });

      // Minimum evidence check
      if (anchors.length < MIN_EVIDENCE_DIAGNOSIS) continue;

      // Dedupe check
      var isDupe = false;
      for (var ei = 0; ei < existing.length; ei++) {
        if (existing[ei].domain === dk && _titleSimilarity(existing[ei].title, tpl.titlePattern) > DEDUPE_THRESHOLD) {
          isDupe = true; break;
        }
      }
      if (isDupe) continue;

      var confidence = Math.min(0.85, (matchCount / tpl.triggerConditions.length) * 0.5 + (d.confidence || 0) * 0.3 + (anchors.length / 5) * 0.2);

      var diagnosis = {
        id: 'gen_diag_' + dk + '_' + _uid(),
        domain: dk,
        title: tpl.titlePattern,
        summary: tpl.mechanismPattern,
        mechanism: tpl.mechanismPattern,
        triggerConditions: tpl.triggerConditions,
        evidenceAnchors: anchors,
        linkedNodes: tpl.nodeAffinity || [],
        linkedBusinesses: tpl.businessAffinity || [],
        crossDomainRelations: [],
        confidence: Math.round(confidence * 100) / 100,
        status: 'GENERATED_CANDIDATE',
        promoted: false,
        canonical: false,
        generatedAt: _now(),
        sourceContext: {
          stress: d.stress,
          maturity: d.maturity,
          drivers: drivers,
          matchCount: matchCount
        },
        // Portal-compatible issue shape
        circuits: (tpl.nodeAffinity || []).map(function (nodeId) {
          return {
            nodeId: nodeId,
            dir: d.stress > 0.65 ? 'Hyper-stressed' : 'Altered',
            detail: tpl.mechanismPattern.substring(0, 100),
            evidence: confidence > 0.6 ? 'Moderate' : 'Emerging'
          };
        })
      };

      // Cross-domain relations
      var cross = (window.LIMENCrossDomain && window.LIMENCrossDomain.active) || [];
      for (var ci = 0; ci < cross.length; ci++) {
        if (cross[ci].domains && cross[ci].domains.indexOf(dk) !== -1) {
          for (var cdi = 0; cdi < cross[ci].domains.length; cdi++) {
            if (cross[ci].domains[cdi] !== dk) diagnosis.crossDomainRelations.push(cross[ci].domains[cdi]);
          }
        }
      }

      existing.push(diagnosis);
      generated.push(diagnosis);

      // Auto-generate treatments for this diagnosis
      generateTreatmentCandidates(dk, diagnosis);
    }

    _lsSet(STORAGE_KEYS.diagnoses, existing, LIMITS.diagnoses);
    return generated;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PART 3 — TREATMENT GENERATION
  // ══════════════════════════════════════════════════════════════════════

  function generateTreatmentCandidates(dk, diagnosis) {
    var levels = (window.LIMENGapTemplates && window.LIMENGapTemplates.TREATMENT_LEVELS) || [];
    var existing = _lsGet(STORAGE_KEYS.treatments);
    var generated = [];
    var d = (window.LIMENDomains || {})[dk] || {};
    var phase = (window.LIMENPhaseAnnotations || {})[dk];
    var phaseKey = phase ? phase.phase : 'p0';

    // Select relevant treatment levels based on phase
    var relevantLevels = [];
    for (var i = 0; i < levels.length; i++) {
      var lvl = levels[i].level;
      // Always include monitoring and operational
      if (lvl === 'monitoring' || lvl === 'operational') { relevantLevels.push(levels[i]); continue; }
      // Phase-specific inclusion
      if (phaseKey === 'p3' && (lvl === 'stabilization' || lvl === 'rerouting')) relevantLevels.push(levels[i]);
      if (phaseKey === 'p5' && (lvl === 'resilience' || lvl === 'capital')) relevantLevels.push(levels[i]);
      if (phaseKey === 'p7b' && (lvl === 'rerouting' || lvl === 'resilience' || lvl === 'recovery')) relevantLevels.push(levels[i]);
      if (lvl === 'capital' || lvl === 'policy') relevantLevels.push(levels[i]); // always useful
    }

    // Dedupe treatment levels
    var seenLevels = {};
    relevantLevels = relevantLevels.filter(function (l) {
      if (seenLevels[l.level]) return false;
      seenLevels[l.level] = true;
      return true;
    });

    for (var li = 0; li < relevantLevels.length; li++) {
      var tpl = relevantLevels[li];
      var mechanismShort = diagnosis.title.toLowerCase();
      var action = tpl.actionPattern.replace(/\{mechanism\}/g, mechanismShort);

      var anchors = [
        { type: 'diagnosis', text: 'Linked to: ' + diagnosis.title },
        { type: 'signal', text: dk + ' stress ' + Math.round(d.stress * 100) + '%' }
      ];
      if (diagnosis.evidenceAnchors.length > 0) anchors.push(diagnosis.evidenceAnchors[0]);

      if (anchors.length < MIN_EVIDENCE_TREATMENT) continue;

      var treatment = {
        id: 'gen_treat_' + dk + '_' + tpl.level + '_' + _uid(),
        diagnosisId: diagnosis.id,
        domain: dk,
        title: diagnosis.title + ' — ' + tpl.titleSuffix,
        treatmentType: tpl.level,
        type: tpl.type,
        label: diagnosis.title + ' — ' + tpl.titleSuffix,
        description: action,
        action: action,
        mechanism: 'Addresses ' + mechanismShort + ' through ' + tpl.level + '-level intervention.',
        whoExecutes: tpl.whoExecutes,
        timeHorizon: tpl.timeHorizon,
        expectedOutcome: 'Reduced impact of ' + mechanismShort + ' on ' + dk + ' domain operations.',
        evidence: diagnosis.confidence > 0.6 ? 'B' : 'C',
        evidenceAnchors: anchors,
        linkedNodes: diagnosis.linkedNodes,
        linkedBusinesses: diagnosis.linkedBusinesses,
        steps: [
          'Assess current ' + tpl.level + ' capacity for ' + dk + ' domain',
          'Deploy ' + tpl.level + ' measures targeting ' + mechanismShort,
          'Monitor effectiveness and adjust parameters'
        ],
        target: mechanismShort.toUpperCase().replace(/\s+/g, '_') + ' -> ' + tpl.level.toUpperCase() + ' -> REDUCED_IMPACT',
        status: 'GENERATED_CANDIDATE',
        promoted: false,
        canonical: false,
        generatedAt: _now(),
        sourceContext: { diagnosisId: diagnosis.id, phase: phaseKey, level: tpl.level }
      };

      existing.push(treatment);
      generated.push(treatment);

      // Auto-generate drill-deeper for this treatment
      generateDrillDeeperCandidates(dk, diagnosis, treatment);
    }

    _lsSet(STORAGE_KEYS.treatments, existing, LIMITS.treatments);
    return generated;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PART 4 — DRILL-DEEPER GENERATION
  // ══════════════════════════════════════════════════════════════════════

  function generateDrillDeeperCandidates(dk, diagnosis, treatment) {
    var nodeMap = (window.LIMENGapTemplates && window.LIMENGapTemplates.NODE_BUSINESS_MAP) || {};
    var existing = _lsGet(STORAGE_KEYS.drillDeeper);
    var generated = [];

    var nodes = diagnosis.linkedNodes || [];
    for (var ni = 0; ni < Math.min(nodes.length, 3); ni++) {
      var nodeId = nodes[ni];
      var nodeTpl = nodeMap[nodeId];
      if (!nodeTpl) continue;

      // Find business mappings for this domain from entity registry cache
      var businessNames = (diagnosis.linkedBusinesses || []).slice(0, 3);

      var drillDeeper = {
        id: 'gen_drill_' + dk + '_' + nodeId + '_' + _uid(),
        treatmentId: treatment.id,
        diagnosisId: diagnosis.id,
        domain: dk,
        node: nodeId,
        businessFunction: nodeTpl.function,
        summary: 'This node maps to ' + nodeTpl.function.toLowerCase() + ' within the ' + dk + ' domain context.',
        whyThisMatters: 'When ' + diagnosis.title.toLowerCase() + ' occurs, ' + nodeTpl.function.toLowerCase() + ' becomes a critical intervention point.',
        subActions: nodeTpl.subActions.map(function (sa) {
          return sa + ' for ' + dk + ' ' + treatment.treatmentType + ' response';
        }),
        metrics: nodeTpl.metrics,
        customerTypes: businessNames,
        capitalAngle: 'Organizations providing ' + nodeTpl.function.toLowerCase() + ' capabilities gain demand under ' + diagnosis.title.toLowerCase() + ' conditions.',
        dataGaps: ['real-time ' + dk + ' ' + nodeId + ' metrics', 'historical ' + dk + ' disruption baseline data'],
        status: 'GENERATED_CANDIDATE',
        promoted: false,
        canonical: false,
        generatedAt: _now()
      };

      existing.push(drillDeeper);
      generated.push(drillDeeper);
    }

    _lsSet(STORAGE_KEYS.drillDeeper, existing, LIMITS.drillDeeper);
    return generated;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PART 6 — CROSS-DOMAIN TRANSFER
  // ══════════════════════════════════════════════════════════════════════

  function _findSimilarDiagnosis(targetDk, sourceDk) {
    var existing = _lsGet(STORAGE_KEYS.diagnoses);
    var sourceItems = existing.filter(function (dx) { return dx.domain === sourceDk && dx.confidence >= 0.5; });
    if (sourceItems.length === 0) return null;
    // Return highest confidence source diagnosis
    sourceItems.sort(function (a, b) { return b.confidence - a.confidence; });
    return sourceItems[0];
  }

  // ══════════════════════════════════════════════════════════════════════
  // PART 7 — STATUS MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════

  function promoteCandidate(candidateId) {
    var keys = [STORAGE_KEYS.diagnoses, STORAGE_KEYS.treatments, STORAGE_KEYS.drillDeeper];
    for (var ki = 0; ki < keys.length; ki++) {
      var arr = _lsGet(keys[ki]);
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].id === candidateId) {
          arr[i].status = 'PROMOTED';
          arr[i].promoted = true;
          arr[i].promotedAt = _now();
          _lsSet(keys[ki], arr, LIMITS[Object.keys(LIMITS)[ki]]);
          return arr[i];
        }
      }
    }
    return null;
  }

  function rejectCandidate(candidateId, reason) {
    var keys = [STORAGE_KEYS.diagnoses, STORAGE_KEYS.treatments, STORAGE_KEYS.drillDeeper];
    for (var ki = 0; ki < keys.length; ki++) {
      var arr = _lsGet(keys[ki]);
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].id === candidateId) {
          arr[i].status = 'REJECTED';
          arr[i].rejectedAt = _now();
          arr[i].rejectedReason = reason || '';
          _lsSet(keys[ki], arr, LIMITS[Object.keys(LIMITS)[ki]]);
          return arr[i];
        }
      }
    }
    return null;
  }

  // ══════════════════════════════════════════════════════════════════════
  // QUERIES
  // ══════════════════════════════════════════════════════════════════════

  function getDiagnoses(dk) {
    return _lsGet(STORAGE_KEYS.diagnoses).filter(function (dx) {
      return (!dk || dx.domain === dk) && dx.status !== 'REJECTED';
    });
  }

  function getTreatments(diagnosisId) {
    return _lsGet(STORAGE_KEYS.treatments).filter(function (t) {
      return t.diagnosisId === diagnosisId && t.status !== 'REJECTED';
    });
  }

  function getDrillDeeper(treatmentId) {
    return _lsGet(STORAGE_KEYS.drillDeeper).filter(function (dd) {
      return dd.treatmentId === treatmentId && dd.status !== 'REJECTED';
    });
  }

  function getSynthesisAudit() {
    return {
      diagnoses: _lsGet(STORAGE_KEYS.diagnoses).length,
      treatments: _lsGet(STORAGE_KEYS.treatments).length,
      drillDeeper: _lsGet(STORAGE_KEYS.drillDeeper).length,
      gapScans: _lsGet(STORAGE_KEYS.gapAudit).length,
      lastScan: _lsGet(STORAGE_KEYS.gapAudit).slice(-1)[0] || null
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // START
  // ══════════════════════════════════════════════════════════════════════

  function start() {
    // Run initial scan after domain data arrives
    window.addEventListener('limen:domain-update', function () {
      // Throttle: scan at most once per 60s
      if (start._lastScan && _now() - start._lastScan < 60000) return;
      start._lastScan = _now();
      scanAllDomains();
    });

    // Initial scan if domains already loaded
    if (window.LIMENDomains && Object.keys(window.LIMENDomains).length > 0) {
      setTimeout(function () { scanAllDomains(); }, 5000); // delay to let other modules load
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  window.LIMENGapSynthesis = {
    start: start,
    scanDomain: scanDomain,
    scanAllDomains: scanAllDomains,
    generateDiagnosisCandidates: generateDiagnosisCandidates,
    generateTreatmentCandidates: generateTreatmentCandidates,
    generateDrillDeeperCandidates: generateDrillDeeperCandidates,
    getDiagnoses: getDiagnoses,
    getTreatments: getTreatments,
    getDrillDeeper: getDrillDeeper,
    promoteCandidate: promoteCandidate,
    rejectCandidate: rejectCandidate,
    getSynthesisAudit: getSynthesisAudit
  };

})();
