/**
 * master-brain-readiness.js — Executive handoff readiness pipeline.
 *
 * Additive, pure computation. No DOM, no side effects beyond an
 * in-memory pathway snapshot used for transition/diff annotation.
 * Reads window.LIMENDomains (populated by domain-brain-adapter.js).
 *
 * Pathway-first intake model (primary):
 *   The Master Brain intake unit is a domain-diagnosis pathway bundle,
 *   inside a live domain posture envelope. Opportunities are leaf
 *   artifacts of a pathway, not the governing unit. collectPathways()
 *   produces the full regulated chain: posture → activation →
 *   node/circuit → deep coverage → cross-scale → leaves.
 *
 * Visibility layer (this file adds; kernels untouched):
 *   - in-memory _prevSnapshot keyed by pathway.id (session-scope, no
 *     localStorage, no fabricated timestamps)
 *   - pathway.transitions annotation (tier shift, score delta, newly
 *     active, age) computed by diffing current vs previous snapshot
 *   - buildLedger(pathway, ds) — six honest projections (no synthesis)
 *   - collectAggregate() — counts, posture-by-domain, audit summary,
 *     recent transitions, computed pulseIntensity
 *
 * Legacy opportunity-row API is preserved for backward compatibility:
 *   collect() returns the same per-opportunity record shape as before,
 *   derived from collectPathways() plus orphan opportunities.
 *   scoreOpportunity(), stableId(), WEIGHTS are unchanged by this layer.
 *
 * Exposes: window.LIMENMasterBrainReadiness
 */
(function () {
  'use strict';

  // ── Legacy opportunity-row scoring weights (unchanged) ──
  var WEIGHTS = {
    rank: 0.22,
    urgency: 0.08,
    confidence: 0.15,
    evidence: 0.15,
    handoff: 0.15,
    audit: 0.10,
    provenance: 0.10,
    freshness: 0.05
  };

  // ── Pathway-composite weights (independent of WEIGHTS) ──
  var PATHWAY_WEIGHTS = {
    relevance: 0.25,
    nodeDepth: 0.20,
    phaseGravity: 0.15,
    stressEnvelope: 0.10,
    crossScale: 0.15,
    freshness: 0.10,
    provenance: 0.05
  };

  // ── Visibility-layer state (session-scope, in-memory only) ──
  var _prevSnapshot = {};            // { [pathway.id]: { tier, score, capturedAt, domain, dxId, dxLabel } }
  var _initialized = false;          // first-call gate so we don't flood transitions on cold start
  var _recentTransitions = [];       // newest-first; capped
  var _MAX_RECENT_TRANSITIONS = 12;

  function _now() { return Date.now(); }

  function _captureTransition(t) {
    _recentTransitions.unshift(t);
    if (_recentTransitions.length > _MAX_RECENT_TRANSITIONS) {
      _recentTransitions.length = _MAX_RECENT_TRANSITIONS;
    }
  }

  function _num(v, d) { return typeof v === 'number' && isFinite(v) ? v : (d != null ? d : null); }
  function _urg(u)    { return u === 'IMMEDIATE' ? 1.0 : u === 'ACTIVE' ? 0.5 : 0.0; }

  function _engineFromPath(path) {
    switch (path) {
      case 'INVESTABLE':     return 'invest';
      case 'PATENTABLE':     return 'patent';
      case 'GRANT-ELIGIBLE': return 'grant';
      default:               return 'other';
    }
  }

  // djb2-based deterministic id from stable inputs.
  function stableId(opp, domainId) {
    var key = domainId + '|' + (opp.source || '?') + '|' +
              (opp.diagnosisId || opp.signal || (opp.companies && opp.companies[0]) || '') + '|' +
              (opp.title || '');
    var h = 5381;
    for (var i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) | 0;
    return 'mb_' + (h >>> 0).toString(36);
  }

  // ── Whitelisted projections for handoff contract stability ──
  var _DX_KEYS      = ['id','label','summary','active','relevance','circuits',
                       'matchedConditions','totalTriggers','blocked','blockReason',
                       'evidenceReason','source'];
  var _TX_KEYS      = ['id','label','type','evidence','description','diagnosisId',
                       'nodeId','relevance','source'];
  var _DEEP_TX_KEYS = _TX_KEYS.concat(['cite','steps','monitoring','escalation',
                                       'nodeLabel','hasDepth',
                                       'portalDomain','portalDomainId','portalTitle',
                                       'depth','ancestryPath']);

  function _project(obj, keys) {
    if (!obj || typeof obj !== 'object') return null;
    var out = {};
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (obj[k] !== undefined) out[k] = obj[k];
    }
    return out;
  }

  function _findDiagnosis(ds, diagnosisId) {
    if (!diagnosisId) return null;
    var arr = Array.isArray(ds.brainDiagnoses) ? ds.brainDiagnoses : [];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] && arr[i].id === diagnosisId) return _project(arr[i], _DX_KEYS);
    }
    return null;
  }

  function _findTreatments(ds, diagnosisId) {
    if (!diagnosisId) return [];
    var arr = Array.isArray(ds.brainTreatments) ? ds.brainTreatments : [];
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var t = arr[i];
      if (t && t.diagnosisId === diagnosisId) {
        var p = _project(t, _TX_KEYS);
        if (p) out.push(p);
      }
    }
    return out;
  }

  function _findDeepTreatments(ds, diagnosisId) {
    if (!diagnosisId) return [];
    var rc = ds.brainResolvedContent;
    if (!rc || typeof rc !== 'object') return [];
    var byDx = rc.byDiagnosis;
    if (!byDx || typeof byDx !== 'object') return [];
    var bucket = byDx[diagnosisId];
    if (!bucket || !Array.isArray(bucket.treatments)) return [];
    var out = [];
    for (var i = 0; i < bucket.treatments.length; i++) {
      var p = _project(bucket.treatments[i], _DEEP_TX_KEYS);
      if (p) out.push(p);
    }
    return out;
  }

  function _corroboratingDomains(doms, thisDomainId, diagnosisId, signal) {
    var out = [];
    for (var otherId in doms) {
      if (!doms.hasOwnProperty(otherId) || otherId === thisDomainId) continue;
      var other = doms[otherId] || {};
      var matched = false;
      if (diagnosisId) {
        var odx = Array.isArray(other.brainDiagnoses) ? other.brainDiagnoses : [];
        for (var i = 0; i < odx.length; i++) {
          if (odx[i] && odx[i].id === diagnosisId && odx[i].active) { matched = true; break; }
        }
      }
      if (!matched && signal) {
        var oc = other.brainConvergence;
        if (oc && oc.primary_signal === signal) matched = true;
      }
      if (matched) out.push(otherId);
    }
    return out;
  }

  // Consumer-side evidence derivation.
  // Brains never project sourcesLive / sourcesTotal / feedFreshnessSec as
  // scalars onto observable state.*, but brainFeeds[] IS forwarded by the
  // adapter and carries the same information. Prefer explicit adapter fields
  // when populated, fall back to derived values from brainFeeds. This
  // surfaces already-forwarded evidence — it does not fabricate anything.
  // activeConditions, self-audit, and provenance signature are NOT derived
  // here; those remain honest gaps until brains project them upstream.
  function _deriveEvidence(ds) {
    var feeds = Array.isArray(ds.brainFeeds) ? ds.brainFeeds : [];
    var derivedTotal = feeds.length;
    var derivedLive = 0;
    var newestLive = null;
    for (var i = 0; i < feeds.length; i++) {
      var f = feeds[i];
      if (f && f.live === true) {
        derivedLive++;
        var u = f.updated;
        if (typeof u === 'number' && (newestLive == null || u > newestLive)) newestLive = u;
      }
    }
    var explicitLive  = _num(ds.brainSourcesLive,      null);
    var explicitTotal = _num(ds.brainSourcesTotal,     null);
    var explicitFresh = _num(ds.brainFeedFreshnessSec, null);
    var derivedFresh  = (newestLive != null)
      ? Math.max(0, Math.round((Date.now() - newestLive) / 1000))
      : null;
    return {
      sourcesLive:      explicitLive  != null ? explicitLive  : derivedLive,
      sourcesTotal:     explicitTotal != null ? explicitTotal : derivedTotal,
      feedFreshnessSec: explicitFresh != null ? explicitFresh : derivedFresh
    };
  }

  // ── Legacy opportunity-row scoring (formula / thresholds unchanged;
  //    evidence/freshness inputs are now honestly derived from brainFeeds) ──
  function scoreOpportunity(opp, ds) {
    var reasons = [];
    var missing = [];

    var rank = _num(opp.rank, 0);
    var urg = _urg(opp.urgency);
    var conf = _num(ds.brainConfidence, 0);
    var ev = _deriveEvidence(ds);
    var sLive = ev.sourcesLive != null ? ev.sourcesLive : 0;
    var sTotal = ev.sourcesTotal != null ? ev.sourcesTotal : 0;
    var evidence = (sTotal > 0) ? (sLive / sTotal) : 0;
    var handoffRaw = ds.brainReadyForHandoff;
    var handoff = handoffRaw === true ? 1 : 0;
    var audit = _num(ds.brainAuditScore, null);
    var prov = (ds.brainProducedBy && ds.brainValidatedAt) ? 1 : 0;
    var freshSec = ev.feedFreshnessSec;
    var fresh = (freshSec == null) ? 0
              : freshSec < 300 ? 1
              : freshSec < 900 ? 0.6
              : freshSec < 3600 ? 0.3 : 0;

    var components = {
      rank:       { v: rank,                         w: WEIGHTS.rank },
      urgency:    { v: urg,                          w: WEIGHTS.urgency },
      confidence: { v: conf,                         w: WEIGHTS.confidence },
      evidence:   { v: evidence,                     w: WEIGHTS.evidence },
      handoff:    { v: handoff,                      w: WEIGHTS.handoff },
      audit:      { v: audit != null ? audit : 0,    w: WEIGHTS.audit },
      provenance: { v: prov,                         w: WEIGHTS.provenance },
      freshness:  { v: fresh,                        w: WEIGHTS.freshness }
    };
    var score = 0;
    for (var k in components) score += components[k].v * components[k].w;

    if (rank >= 0.7)             reasons.push('strong rank (' + rank.toFixed(2) + ')');
    if (urg === 1)               reasons.push('immediate urgency');
    if (conf >= 0.7)             reasons.push('high domain confidence');
    if (evidence >= 0.8)         reasons.push('strong live-feed coverage');
    if (handoffRaw === true)     reasons.push('domain self-audit cleared handoff');
    if (audit != null && audit >= 0.7) reasons.push('audit score \u2265 0.7');
    if (prov === 1)              reasons.push('provenance signed');
    if (fresh === 1)             reasons.push('feeds fresh (<5m)');

    var findingCount = Array.isArray(ds.brainAuditFindings) ? ds.brainAuditFindings.length : 0;
    if (sTotal === 0 || sLive === 0) missing.push('no live feed evidence');
    if (freshSec != null && freshSec > 900) missing.push('feed stale (>15m)');
    if (handoffRaw === false)    missing.push('domain self-audit did not clear handoff');
    if (handoffRaw == null)      missing.push('no self-audit signal from domain');
    if (audit == null)           missing.push('no audit score from domain');
    if (prov === 0)              missing.push('missing provenance signature');
    if (findingCount > 0)        missing.push(findingCount + ' audit finding(s)');

    var noEvidence    = (sTotal === 0 || sLive === 0);
    var failedHandoff = (handoffRaw === false);
    var noProvenance  = (prov === 0);

    var tier;
    if (score >= 0.75 && !noEvidence && !failedHandoff && !noProvenance)  tier = 'READY';
    else if (score >= 0.50 && !noEvidence && !failedHandoff)              tier = 'NEAR_READY';
    else                                                                   tier = 'BLOCKED';

    return {
      score: Math.round(score * 1000) / 1000,
      tier: tier,
      reasons: reasons,
      missing: missing,
      components: components
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // PATHWAY LAYER — domain-diagnosis pathway as primary intake unit
  // ══════════════════════════════════════════════════════════════════════

  function _buildPosture(ds) {
    return {
      phase: ds.brainPhase || null,
      phaseConfidence: _num(ds.brainPhaseConfidence, null),
      stress: _num(ds.brainStress, null),
      stressTrend: ds.brainStressTrend || null,
      confidence: _num(ds.brainConfidence, null),
      trajectory: ds.brainTrajectory || null,
      maturity: ds.brainMaturity || null,
      hysteresisPenalty: _num(ds.brainHysteresisPenalty, null),
      Ct: _num(ds.brainCt, null)
    };
  }

  function _buildAudit(ds) {
    var ev = _deriveEvidence(ds);
    return {
      readyForHandoff: (typeof ds.brainReadyForHandoff === 'boolean') ? ds.brainReadyForHandoff : null,
      auditScore: _num(ds.brainAuditScore, null),
      auditFindings: Array.isArray(ds.brainAuditFindings) ? ds.brainAuditFindings.slice() : [],
      producedBy: ds.brainProducedBy || null,
      producerVersion: ds.brainProducerVersion || null,
      validatedAt: _num(ds.brainValidatedAt, null),
      feedFreshnessSec: ev.feedFreshnessSec,
      sourcesLive: ev.sourcesLive,
      sourcesTotal: ev.sourcesTotal
    };
  }

  function _gatePosture(ds) {
    var stress = _num(ds.brainStress, 0);
    var phase = (ds.brainPhase || 'P0').toString().toUpperCase();
    var phaseBand = parseInt(phase.replace(/[^0-9]/g, ''), 10) || 0;
    var maturity = ds.brainMaturity;
    var activeDxCount = Array.isArray(ds.brainDiagnoses)
      ? ds.brainDiagnoses.filter(function (d) { return d && d.active; }).length
      : 0;
    var open = stress >= 0.35 || phaseBand >= 3 || maturity === 'STRUCTURAL' || activeDxCount >= 1;
    var reasons = [];
    if (stress >= 0.35) reasons.push('stress \u2265 0.35');
    if (phaseBand >= 3) reasons.push('phase \u2265 P3');
    if (maturity === 'STRUCTURAL') reasons.push('structural maturity');
    if (activeDxCount >= 1) reasons.push(activeDxCount + ' active diagnosis');
    return {
      open: open,
      reason: open ? reasons.join(' \u00b7 ') : 'nominal posture \u2014 intake suppressed'
    };
  }

  function _gateActivation(dx) {
    if (!dx || dx.active !== true) return { open: false, reason: 'diagnosis not active' };
    var rel = _num(dx.relevance, 0);
    if (rel < 0.4) return { open: false, reason: 'relevance ' + rel.toFixed(2) + ' below 0.40' };
    if (dx.matchedConditions != null && dx.matchedConditions < 1) return { open: false, reason: 'no matched conditions' };
    if (dx.blocked === true) return { open: false, reason: dx.blockReason || 'diagnosis blocked' };
    return { open: true, reason: 'active \u00b7 relevance ' + rel.toFixed(2) };
  }

  function _gateNodes(dx, ds) {
    var circuits = (dx && Array.isArray(dx.circuits)) ? dx.circuits : [];
    if (circuits.length === 0) return { open: false, reason: 'diagnosis has no circuits' };
    var rc = ds.brainResolvedContent;
    var byDx = rc && rc.byDiagnosis;
    var bucket = byDx && byDx[dx.id];
    var treatments = (bucket && Array.isArray(bucket.treatments)) ? bucket.treatments : [];
    if (treatments.length === 0) return { open: false, reason: 'no portal-resolved treatments' };
    return {
      open: true,
      reason: treatments.length + ' treatment(s) across ' + circuits.length + ' circuit(s)'
    };
  }

  function _buildNodes(dx, deepTreatments) {
    var circuits = Array.isArray(dx.circuits) ? dx.circuits : [];
    var circuitNodeIds = {};
    for (var ci = 0; ci < circuits.length; ci++) {
      var c = circuits[ci];
      if (c && c.nodeId) circuitNodeIds[c.nodeId] = true;
    }
    var nodeIdx = {};
    for (var i = 0; i < deepTreatments.length; i++) {
      var t = deepTreatments[i];
      var nid = t.nodeId || '';
      if (!nid) continue;
      if (!nodeIdx[nid]) {
        nodeIdx[nid] = { nodeId: nid, nodeLabel: t.nodeLabel || nid, inCircuits: !!circuitNodeIds[nid], treatmentCount: 0, hasDepthCount: 0 };
      }
      nodeIdx[nid].treatmentCount++;
      if (t.hasDepth === true) nodeIdx[nid].hasDepthCount++;
    }
    for (var cid in circuitNodeIds) {
      if (!nodeIdx[cid]) {
        nodeIdx[cid] = { nodeId: cid, nodeLabel: cid, inCircuits: true, treatmentCount: 0, hasDepthCount: 0 };
      }
    }
    var list = [];
    for (var nid2 in nodeIdx) {
      var n = nodeIdx[nid2];
      n.deepCoverageRatio = n.treatmentCount > 0 ? n.hasDepthCount / n.treatmentCount : 0;
      list.push(n);
    }
    list.sort(function (a, b) { return b.treatmentCount - a.treatmentCount; });
    return list;
  }

  function _groupDeepByNode(deepTreatments) {
    var out = {};
    for (var i = 0; i < deepTreatments.length; i++) {
      var t = deepTreatments[i];
      var nid = t.nodeId || '_unknown';
      if (!out[nid]) out[nid] = [];
      out[nid].push(t);
    }
    return out;
  }

  function _phaseGravity(posture) {
    var phase = (posture.phase || 'P0').toString().toUpperCase();
    var band = parseInt(phase.replace(/[^0-9]/g, ''), 10) || 0;
    var phaseScore = Math.min(1, band / 9);
    var structural = posture.maturity === 'STRUCTURAL' ? 0.15 : 0;
    var traj = 0;
    var t = (posture.trajectory || '').toString().toLowerCase();
    if (t === 'escalating' || t === 'deepening' || t === 'rising') traj = 0.1;
    else if (t === 'improving' || t === 'recovering' || t === 'falling') traj = -0.05;
    return Math.max(0, Math.min(1, phaseScore + structural + traj));
  }

  function _stressEnvelope(posture) {
    var s = _num(posture.stress, 0);
    var trend = (posture.stressTrend || '').toString().toLowerCase();
    var bonus = trend === 'rising' ? 0.1 : trend === 'falling' ? -0.05 : 0;
    var hyst = _num(posture.hysteresisPenalty, 0);
    return Math.max(0, Math.min(1, s + bonus - hyst));
  }

  function _crossScale(emissions, ingest) {
    var emSum = 0, inSum = 0;
    var ems = Array.isArray(emissions) ? emissions : [];
    var ing = Array.isArray(ingest) ? ingest : [];
    for (var i = 0; i < ems.length; i++) emSum += _num(ems[i].magnitude, 0);
    for (var j = 0; j < ing.length; j++) inSum += _num(ing[j].magnitude, 0);
    var total = emSum + inSum;
    if (total === 0) return 0;
    return Math.min(1, total / 2);
  }

  function _nodeDepthScore(nodes) {
    if (!nodes || !nodes.length) return 0;
    var impacted = [];
    for (var i = 0; i < nodes.length; i++) if (nodes[i].treatmentCount > 0) impacted.push(nodes[i]);
    if (!impacted.length) return 0;
    var meanCoverage = 0;
    for (var j = 0; j < impacted.length; j++) meanCoverage += impacted[j].deepCoverageRatio;
    meanCoverage /= impacted.length;
    var countComponent = Math.min(0.5, impacted.length / 10);
    return countComponent + meanCoverage * 0.5;
  }

  function scorePathway(pathway) {
    var reasons = [];
    var missing = [];
    var gates = pathway.salience && pathway.salience.gates ? pathway.salience.gates : {};

    if (gates.posture && gates.posture.open === false) {
      return { score: 0, tier: 'BLOCKED', reasons: [], missing: [gates.posture.reason], gates: gates };
    }

    var dx = pathway.diagnosis || {};
    var rel = _num(dx.relevance, 0);
    var matchRatio = (dx.matchedConditions != null && dx.totalTriggers)
                       ? (dx.matchedConditions / dx.totalTriggers)
                       : 1;
    var relComponent = rel * Math.max(0.3, matchRatio);
    var nodeDepth = _nodeDepthScore(pathway.nodes);
    var phaseGrav = _phaseGravity(pathway.posture);
    var stressEnv = _stressEnvelope(pathway.posture);
    var crossScale = _crossScale(pathway.emissions, pathway.ingest);

    var audit = pathway.audit || {};
    var freshSec = _num(audit.feedFreshnessSec, null);
    var fresh = (freshSec == null) ? 0
              : freshSec < 300 ? 1
              : freshSec < 900 ? 0.6
              : freshSec < 3600 ? 0.3 : 0;
    var sL = _num(audit.sourcesLive, 0);
    var sT = _num(audit.sourcesTotal, 0);
    var evidence = (sT > 0) ? sL / sT : 0;
    var freshComponent = (fresh + evidence) / 2;

    var provSigned = !!(audit.producedBy && audit.validatedAt);
    var auditScore = _num(audit.auditScore, null);
    var auditFloor = auditScore != null ? auditScore : 0;
    var prov = provSigned ? 1 : 0;
    var provComponent = (prov + auditFloor) / 2;

    var score = relComponent * PATHWAY_WEIGHTS.relevance +
                nodeDepth * PATHWAY_WEIGHTS.nodeDepth +
                phaseGrav * PATHWAY_WEIGHTS.phaseGravity +
                stressEnv * PATHWAY_WEIGHTS.stressEnvelope +
                crossScale * PATHWAY_WEIGHTS.crossScale +
                freshComponent * PATHWAY_WEIGHTS.freshness +
                provComponent * PATHWAY_WEIGHTS.provenance;

    if (rel >= 0.7)                      reasons.push('strong diagnosis relevance (' + rel.toFixed(2) + ')');
    if (nodeDepth >= 0.5)                reasons.push('deep node coverage');
    if (phaseGrav >= 0.5)                reasons.push('advanced phase posture');
    if (stressEnv >= 0.6)                reasons.push('elevated stress envelope');
    if (crossScale >= 0.4)               reasons.push('cross-scale pressure');
    if (pathway.posture && pathway.posture.maturity === 'STRUCTURAL') reasons.push('structural pattern');
    if (provSigned)                      reasons.push('provenance signed');
    if (auditScore != null && auditScore >= 0.7) reasons.push('audit score \u2265 0.7');

    var findingCount = Array.isArray(audit.auditFindings) ? audit.auditFindings.length : 0;
    if (audit.readyForHandoff === false) missing.push('domain self-audit did not clear handoff');
    if (audit.readyForHandoff == null)   missing.push('no self-audit signal from domain');
    if (auditScore == null)              missing.push('no audit score from domain');
    if (!provSigned)                     missing.push('missing provenance signature');
    if (freshSec != null && freshSec > 900) missing.push('feeds stale (>15m)');
    if (sT === 0 || sL === 0)            missing.push('no live feed evidence');
    if (findingCount > 0)                missing.push(findingCount + ' audit finding(s)');

    var tier;
    if (gates.nodes && gates.nodes.open === false) {
      tier = 'BLOCKED';
      missing.unshift('NO_DEEP_COVERAGE');
    } else if (score >= 0.70 && audit.readyForHandoff !== false && provSigned) {
      tier = 'READY';
    } else if (score >= 0.50 && audit.readyForHandoff !== false) {
      tier = 'NEAR_READY';
    } else {
      tier = 'BLOCKED';
    }

    return {
      score: Math.round(score * 1000) / 1000,
      tier: tier,
      reasons: reasons,
      missing: missing,
      gates: gates
    };
  }

  function collectPathways() {
    var out = [];
    var doms = (typeof window !== 'undefined') ? (window.LIMENDomains || {}) : {};
    var now = _now();
    var seenIds = {};

    for (var domainId in doms) {
      if (!doms.hasOwnProperty(domainId)) continue;
      var ds = doms[domainId] || {};

      var postureGate = _gatePosture(ds);
      if (!postureGate.open) continue;

      var posture = _buildPosture(ds);
      var activeConditions = Array.isArray(ds.brainActiveConditions) ? ds.brainActiveConditions.slice() : [];
      var emissions = Array.isArray(ds.brainEmissions) ? ds.brainEmissions.slice() : [];
      var ingest    = Array.isArray(ds.brainIngest)    ? ds.brainIngest.slice()    : [];
      var convergence = ds.brainConvergence || null;
      var audit = _buildAudit(ds);

      var dxList = Array.isArray(ds.brainDiagnoses) ? ds.brainDiagnoses : [];
      for (var di = 0; di < dxList.length; di++) {
        var dx = dxList[di];

        var activationGate = _gateActivation(dx);
        if (!activationGate.open) continue;

        var projectedDx = _project(dx, _DX_KEYS);
        if (projectedDx && Array.isArray(dx.circuits)) projectedDx.circuits = dx.circuits;

        var deepTx = _findDeepTreatments(ds, dx.id);
        var nodesGate = _gateNodes(dx, ds);
        var nodes = _buildNodes(dx, deepTx);
        var deepByNode = _groupDeepByNode(deepTx);

        var allOpps = Array.isArray(ds.brainOpportunities) ? ds.brainOpportunities : [];
        var leafOpps = [];
        for (var oi = 0; oi < allOpps.length; oi++) {
          var op = allOpps[oi];
          if (!op || op.diagnosisId !== dx.id) continue;
          leafOpps.push({
            id: stableId(op, domainId),
            title: op.title || '(untitled)',
            engine: _engineFromPath(op.path),
            urgency: op.urgency || null,
            rank: _num(op.rank, null),
            source: op.source || null,
            companies: Array.isArray(op.companies) ? op.companies.slice(0, 5) : [],
            signal: op.signal || null,
            path: op.path || null
          });
        }

        var allDirs = Array.isArray(ds.brainDirectives) ? ds.brainDirectives : [];
        var scopedDirs = [];
        for (var dri = 0; dri < allDirs.length; dri++) {
          var drv = allDirs[dri];
          if (!drv || drv.diagnosisId !== dx.id) continue;
          scopedDirs.push({
            id: drv.id || null,
            label: drv.label || drv.treatmentLabel || null,
            rank: _num(drv.rank, null),
            score: _num(drv.score, null),
            mechanism: drv.mechanism || null,
            paths: Array.isArray(drv.paths) ? drv.paths.slice() : [],
            nodeId: drv.nodeId || null,
            portalDomain: drv.portalDomain != null ? drv.portalDomain : null,
            portalDomainId: drv.portalDomainId != null ? drv.portalDomainId : null,
            portalTitle: drv.portalTitle != null ? drv.portalTitle : null,
            depth: drv.depth != null ? drv.depth : null,
            ancestryPath: Array.isArray(drv.ancestryPath) ? drv.ancestryPath.slice() : null
          });
        }

        var pathway = {
          id: 'path_' + domainId + '_' + (dx.id || '?'),
          domain: domainId,
          posture: posture,
          activeConditions: activeConditions,
          diagnosis: projectedDx,
          nodes: nodes,
          deepTreatmentsByNode: deepByNode,
          emissions: emissions,
          ingest: ingest,
          convergence: convergence,
          opportunities: leafOpps,
          directives: scopedDirs,
          audit: audit,
          salience: {
            gates: {
              posture: postureGate,
              activation: activationGate,
              nodes: nodesGate
            }
          }
        };

        var sal = scorePathway(pathway);
        pathway.salience.score = sal.score;
        pathway.salience.tier = sal.tier;
        pathway.salience.reasons = sal.reasons;
        pathway.salience.missing = sal.missing;

        // ── Transition annotation (in-memory diff vs previous snapshot) ──
        var prev = _prevSnapshot[pathway.id];
        var transitions = null;
        if (_initialized) {
          if (!prev) {
            transitions = {
              newlyActive: true,
              tierTo: pathway.salience.tier,
              score: pathway.salience.score,
              ageMs: 0,
              at: now
            };
            _captureTransition({
              id: pathway.id,
              domain: pathway.domain,
              dxId: pathway.diagnosis && pathway.diagnosis.id,
              dxLabel: (pathway.diagnosis && pathway.diagnosis.label) || (pathway.diagnosis && pathway.diagnosis.id) || pathway.id,
              kind: 'newly_active',
              tierTo: pathway.salience.tier,
              score: pathway.salience.score,
              ageMs: 0,
              at: now
            });
          } else {
            var tierChanged = prev.tier !== pathway.salience.tier;
            var scoreDelta = pathway.salience.score - prev.score;
            var ageMs = now - prev.capturedAt;
            transitions = {
              newlyActive: false,
              tierFrom: prev.tier,
              tierTo: pathway.salience.tier,
              scoreDelta: scoreDelta,
              ageMs: ageMs,
              at: now
            };
            if (tierChanged) {
              _captureTransition({
                id: pathway.id,
                domain: pathway.domain,
                dxId: pathway.diagnosis && pathway.diagnosis.id,
                dxLabel: (pathway.diagnosis && pathway.diagnosis.label) || (pathway.diagnosis && pathway.diagnosis.id) || pathway.id,
                kind: 'tier_change',
                tierFrom: prev.tier,
                tierTo: pathway.salience.tier,
                scoreDelta: scoreDelta,
                ageMs: ageMs,
                at: now
              });
            } else if (Math.abs(scoreDelta) >= 0.05) {
              _captureTransition({
                id: pathway.id,
                domain: pathway.domain,
                dxId: pathway.diagnosis && pathway.diagnosis.id,
                dxLabel: (pathway.diagnosis && pathway.diagnosis.label) || (pathway.diagnosis && pathway.diagnosis.id) || pathway.id,
                kind: 'score_shift',
                tierFrom: prev.tier,
                tierTo: pathway.salience.tier,
                scoreDelta: scoreDelta,
                ageMs: ageMs,
                at: now
              });
            }
          }
        }
        pathway.transitions = transitions;

        seenIds[pathway.id] = true;
        out.push(pathway);
      }
    }

    // Detect deactivations: ids in previous snapshot no longer present.
    if (_initialized) {
      for (var oldId in _prevSnapshot) {
        if (!_prevSnapshot.hasOwnProperty(oldId)) continue;
        if (seenIds[oldId]) continue;
        var prevP = _prevSnapshot[oldId];
        _captureTransition({
          id: oldId,
          domain: prevP.domain,
          dxId: prevP.dxId,
          dxLabel: prevP.dxLabel,
          kind: 'deactivated',
          tierFrom: prevP.tier,
          ageMs: now - prevP.capturedAt,
          at: now
        });
      }
    }

    // Update snapshot.
    var nextSnapshot = {};
    for (var pi = 0; pi < out.length; pi++) {
      var p = out[pi];
      nextSnapshot[p.id] = {
        tier: p.salience.tier,
        score: p.salience.score,
        capturedAt: now,
        domain: p.domain,
        dxId: p.diagnosis && p.diagnosis.id,
        dxLabel: (p.diagnosis && p.diagnosis.label) || (p.diagnosis && p.diagnosis.id) || p.id
      };
    }
    _prevSnapshot = nextSnapshot;
    _initialized = true;

    out.sort(function (a, b) { return b.salience.score - a.salience.score; });
    return out;
  }

  // ══════════════════════════════════════════════════════════════════════
  // TRUTH LEDGER — buildLedger(pathway, ds)
  // Six honest projections over already-emitted state. No synthesis.
  // ══════════════════════════════════════════════════════════════════════

  // Resolve a brain instance's diagnosisIndex (trigger-set map) without
  // modifying any brain. Convention: window.LIMEN<Capitalized>Brain.
  // Returns null when the registry/brain is not reachable — the ledger
  // then falls back to honest minimal output.
  function _resolveTriggerSet(ds, dxId) {
    if (!dxId || typeof window === 'undefined') return null;
    var domainId = ds.brainDomainId;
    if (!domainId) return null;
    var key = 'LIMEN' + domainId.charAt(0).toUpperCase() + domainId.slice(1) + 'Brain';
    var brain = window[key];
    if (!brain || !brain.diagnosisIndex) return null;
    var arr = brain.diagnosisIndex[dxId];
    if (!Array.isArray(arr)) return null;
    var set = {};
    for (var i = 0; i < arr.length; i++) set[arr[i]] = true;
    return set;
  }

  function _firedConditionsFor(ds, dxId) {
    var active = Array.isArray(ds.brainActiveConditions) ? ds.brainActiveConditions : [];
    if (active.length) {
      var triggerSet = _resolveTriggerSet(ds, dxId);
      if (!triggerSet) {
        // Trigger map not reachable; surface domain-level active conditions
        // as the honest superset. Caller-side phrasing must remain truthful.
        return active.slice(0, 8);
      }
      var out = [];
      for (var i = 0; i < active.length; i++) {
        if (triggerSet[active[i]]) out.push(active[i]);
      }
      return out;
    }
    // Fallback: activeConditions not forwarded by brain. Cite live feed
    // contributors so the ledger stops falsely implying no evidence exists
    // when feeds are confirmed live. Narrower than a condition list but
    // honestly grounded in already-forwarded data. The "live source: "
    // prefix keeps callers aware this is a feed-level fallback, not a
    // fired condition — used by whatWouldFalsify to phrase honestly.
    var feeds = Array.isArray(ds.brainFeeds) ? ds.brainFeeds : [];
    var live = [];
    for (var j = 0; j < feeds.length; j++) {
      var f = feeds[j];
      if (f && f.live === true && f.name) live.push('live source: ' + f.name);
    }
    return live.slice(0, 6);
  }

  function _fmtAgeMs(ms) {
    if (ms == null || !isFinite(ms)) return 'unknown';
    if (ms < 60000) return Math.max(1, Math.round(ms / 1000)) + 's';
    if (ms < 3600000) return Math.round(ms / 60000) + 'm';
    return (ms / 3600000).toFixed(1) + 'h';
  }

  // Evidence rank ordering (higher = stronger)
  var _EVIDENCE_RANK = {
    'A': 5, 'STRONG': 5,
    'B': 4, 'MODERATE': 4,
    'C': 2, 'EMERGING': 2
  };

  function buildLedger(pathway, ds) {
    pathway = pathway || {};
    ds = ds || {};
    var dx = pathway.diagnosis || {};
    var dxId = dx.id || null;

    // WHAT CHANGED — derived from pathway.transitions
    var whatChanged = [];
    var t = pathway.transitions;
    if (t) {
      if (t.newlyActive) {
        whatChanged.push('newly active pathway · tier ' + (t.tierTo || '?').replace('_', ' ') + ' · score ' + (pathway.salience && pathway.salience.score != null ? pathway.salience.score.toFixed(2) : '?'));
      } else {
        var fragments = [];
        if (t.tierFrom !== t.tierTo) {
          fragments.push('tier ' + String(t.tierFrom || '?').replace('_', ' ') + ' \u2192 ' + String(t.tierTo || '?').replace('_', ' '));
        }
        if (typeof t.scoreDelta === 'number' && Math.abs(t.scoreDelta) >= 0.01) {
          var sign = t.scoreDelta > 0 ? '+' : '';
          fragments.push('score ' + sign + t.scoreDelta.toFixed(2));
        }
        if (fragments.length) {
          whatChanged.push(fragments.join(' \u00b7 ') + ' \u00b7 ' + _fmtAgeMs(t.ageMs) + ' ago');
        }
      }
    }

    // WHAT FIRED — active conditions in this diagnosis's trigger set (or
    // domain-level active conditions if the trigger map is unreachable).
    var whatFired = _firedConditionsFor(ds, dxId);

    // WHAT NODES MATTERED — top 3 nodes by treatmentCount × deepCoverageRatio
    var whatNodesMattered = [];
    var nodes = (pathway.nodes || []).slice();
    var ranked = nodes.filter(function (n) { return n.treatmentCount > 0; }).sort(function (a, b) {
      return (b.treatmentCount * b.deepCoverageRatio) - (a.treatmentCount * a.deepCoverageRatio);
    }).slice(0, 3);
    for (var i = 0; i < ranked.length; i++) {
      var n = ranked[i];
      whatNodesMattered.push((n.nodeLabel || n.nodeId) + ' (' + n.treatmentCount + ' tx, ' + n.hasDepthCount + ' deep)');
    }

    // WHAT BRANCHES SUPPORTED IT — top 3 deep treatments by evidence grade
    var whatBranchesSupportedIt = [];
    var deepAll = [];
    var byNode = pathway.deepTreatmentsByNode || {};
    for (var nid in byNode) {
      var list = byNode[nid] || [];
      for (var j = 0; j < list.length; j++) deepAll.push(list[j]);
    }
    deepAll.sort(function (a, b) {
      var ra = _EVIDENCE_RANK[(a.evidence || '').toString().toUpperCase()] || 1;
      var rb = _EVIDENCE_RANK[(b.evidence || '').toString().toUpperCase()] || 1;
      return rb - ra;
    });
    var picked = deepAll.slice(0, 3);
    for (var k = 0; k < picked.length; k++) {
      var tx = picked[k];
      var ev = tx.evidence ? ' [' + tx.evidence + ']' : '';
      whatBranchesSupportedIt.push((tx.label || tx.id || 'unnamed') + ev);
    }

    // WHAT EVIDENCE IS MISSING — direct projection from salience.missing
    var whatEvidenceIsMissing = (pathway.salience && Array.isArray(pathway.salience.missing))
                                  ? pathway.salience.missing.slice() : [];

    // WHAT WOULD FALSIFY — joint clearance of currently-matched triggers.
    // If whatFired is the feed-level fallback (brainActiveConditions not
    // forwarded), phrase honestly instead of claiming falsification
    // against feed names, which would be misleading.
    var whatWouldFalsify = [];
    if (whatFired.length) {
      var isFeedFallback = String(whatFired[0]).indexOf('live source: ') === 0;
      var triggerSet = _resolveTriggerSet(ds, dxId);
      if (isFeedFallback) {
        whatWouldFalsify.push('activeConditions not yet forwarded by brain \u2014 falsification path requires upstream projection');
      } else if (triggerSet) {
        whatWouldFalsify.push('if all of {' + whatFired.join(', ') + '} clear, diagnosis deactivates');
      } else {
        // Trigger map not reachable; surface honest framing only.
        whatWouldFalsify.push('falsification path not derivable without trigger map');
      }
    }

    return {
      whatChanged: whatChanged,
      whatFired: whatFired,
      whatNodesMattered: whatNodesMattered,
      whatBranchesSupportedIt: whatBranchesSupportedIt,
      whatEvidenceIsMissing: whatEvidenceIsMissing,
      whatWouldFalsify: whatWouldFalsify
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // AGGREGATE — collectAggregate() drives the live Executive Center
  // ══════════════════════════════════════════════════════════════════════

  function _phaseBand(phase) {
    var p = (phase || 'P0').toString().toUpperCase();
    return parseInt(p.replace(/[^0-9]/g, ''), 10) || 0;
  }

  function _buildPostureByDomain(doms) {
    var list = [];
    for (var domainId in doms) {
      if (!doms.hasOwnProperty(domainId)) continue;
      var ds = doms[domainId] || {};
      var phase = ds.brainPhase || null;
      var stress = _num(ds.brainStress, null);
      var hasReported = (phase != null) || (stress != null);
      var dxArr = Array.isArray(ds.brainDiagnoses) ? ds.brainDiagnoses : [];
      var activeDxCount = 0;
      for (var i = 0; i < dxArr.length; i++) {
        if (dxArr[i] && dxArr[i].active) activeDxCount++;
      }
      list.push({
        domain: domainId,
        hasReported: hasReported,
        phase: phase,
        phaseBand: _phaseBand(phase),
        stress: stress,
        confidence: _num(ds.brainConfidence, null),
        trajectory: ds.brainTrajectory || null,
        maturity: ds.brainMaturity || null,
        stressTrend: ds.brainStressTrend || null,
        activeDxCount: activeDxCount,
        sourcesLive: _num(ds.brainSourcesLive, null),
        sourcesTotal: _num(ds.brainSourcesTotal, null),
        feedFreshnessSec: _num(ds.brainFeedFreshnessSec, null)
      });
    }
    list.sort(function (a, b) {
      // Reported domains first, then by phase band desc, then by stress desc.
      if (a.hasReported !== b.hasReported) return a.hasReported ? -1 : 1;
      if (a.phaseBand !== b.phaseBand) return b.phaseBand - a.phaseBand;
      return (_num(b.stress, 0) || 0) - (_num(a.stress, 0) || 0);
    });
    return list;
  }

  function _buildAuditSummary(doms) {
    var totalDomains = 0, signedCount = 0, freshCount = 0, handoffClearedCount = 0, openFindings = 0, reportedCount = 0;
    for (var domainId in doms) {
      if (!doms.hasOwnProperty(domainId)) continue;
      var ds = doms[domainId] || {};
      var ev = _deriveEvidence(ds);
      totalDomains++;
      var hasReported = (ds.brainPhase != null) || (_num(ds.brainStress, null) != null);
      if (hasReported) reportedCount++;
      if (ds.brainProducedBy && ds.brainValidatedAt) signedCount++;
      var freshSec = ev.feedFreshnessSec;
      if (freshSec != null && freshSec < 900) freshCount++;
      if (ds.brainReadyForHandoff === true) handoffClearedCount++;
      var findings = Array.isArray(ds.brainAuditFindings) ? ds.brainAuditFindings.length : 0;
      openFindings += findings;
    }
    return {
      totalDomains: totalDomains,
      reportedCount: reportedCount,
      signedCount: signedCount,
      freshCount: freshCount,
      handoffClearedCount: handoffClearedCount,
      openFindings: openFindings
    };
  }

  function _computePulseIntensity(pathways) {
    if (!pathways || !pathways.length) return 0.10; // visible baseline floor
    var sum = 0;
    for (var i = 0; i < pathways.length; i++) {
      var p = pathways[i];
      var s = (p.salience && _num(p.salience.score, 0)) || 0;
      var stress = (p.posture && _num(p.posture.stress, 0)) || 0;
      // READY/NEAR contribute fully; BLOCKED contributes at 0.3 weight.
      var w = (p.salience && (p.salience.tier === 'READY' || p.salience.tier === 'NEAR_READY')) ? 1 : 0.3;
      sum += s * (0.6 + 0.4 * stress) * w;
    }
    // Normalize: ~6 strong active pathways saturates the pulse.
    var v = 0.10 + sum / 6;
    return Math.max(0.10, Math.min(1, v));
  }

  function collectAggregate() {
    var doms = (typeof window !== 'undefined') ? (window.LIMENDomains || {}) : {};
    var pathways = collectPathways();

    var counts = {
      total: pathways.length,
      READY: 0,
      NEAR_READY: 0,
      BLOCKED: 0,
      NO_DEEP_COVERAGE: 0
    };
    for (var i = 0; i < pathways.length; i++) {
      var p = pathways[i];
      var t = p.salience && p.salience.tier;
      if (counts[t] != null) counts[t]++;
      if (p.salience && p.salience.gates && p.salience.gates.nodes && p.salience.gates.nodes.open === false) {
        counts.NO_DEEP_COVERAGE++;
      }
    }

    return {
      counts: counts,
      postureByDomain: _buildPostureByDomain(doms),
      auditSummary: _buildAuditSummary(doms),
      recentTransitions: _recentTransitions.slice(),
      pulseIntensity: _computePulseIntensity(pathways)
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // LEGACY FLAT-RECORD API — derived flattener over collectPathways()
  // ══════════════════════════════════════════════════════════════════════

  function _buildLegacyRecord(opp, ds, domainId, doms) {
    var r = scoreOpportunity(opp, ds);
    var ev = _deriveEvidence(ds);
    var dxObj      = _findDiagnosis(ds, opp.diagnosisId);
    var txList     = _findTreatments(ds, opp.diagnosisId);
    var deepTxList = _findDeepTreatments(ds, opp.diagnosisId);
    var corroDoms  = _corroboratingDomains(doms, domainId, opp.diagnosisId, opp.signal);
    return {
      id: stableId(opp, domainId),
      title: opp.title || '(untitled opportunity)',
      domain: domainId,
      engine: _engineFromPath(opp.path),
      source: opp.source || null,
      diagnosisId: opp.diagnosisId || null,
      signal: opp.signal || null,
      companies: Array.isArray(opp.companies) ? opp.companies.slice(0, 5) : [],
      urgency: opp.urgency || null,
      rank: _num(opp.rank, null),
      domainStress: _num(ds.brainStress, null),
      domainPhase: ds.brainPhase || null,
      domainConfidence: _num(ds.brainConfidence, null),
      sourcesLive: ev.sourcesLive,
      sourcesTotal: ev.sourcesTotal,
      feedFreshnessSec: ev.feedFreshnessSec,
      producedBy: ds.brainProducedBy || null,
      validatedAt: _num(ds.brainValidatedAt, null),
      readyForHandoff: (typeof ds.brainReadyForHandoff === 'boolean') ? ds.brainReadyForHandoff : null,
      auditScore: _num(ds.brainAuditScore, null),
      auditFindings: Array.isArray(ds.brainAuditFindings) ? ds.brainAuditFindings.length : 0,
      diagnosis: dxObj,
      treatments: txList,
      deepTreatments: deepTxList,
      hasDeepTreatment: deepTxList.length > 0,
      corroboratingDomains: corroDoms,
      corroboration: corroDoms.length,
      readiness: r
    };
  }

  function collect() {
    var result = [];
    var doms = (typeof window !== 'undefined') ? (window.LIMENDomains || {}) : {};
    var pathways = collectPathways();
    var covered = {};

    for (var pi = 0; pi < pathways.length; pi++) {
      var p = pathways[pi];
      var ds = doms[p.domain] || {};
      var domainOpps = Array.isArray(ds.brainOpportunities) ? ds.brainOpportunities : [];
      var dxId = p.diagnosis && p.diagnosis.id;
      for (var oi = 0; oi < domainOpps.length; oi++) {
        var op = domainOpps[oi];
        if (!op || op.diagnosisId !== dxId) continue;
        var rec = _buildLegacyRecord(op, ds, p.domain, doms);
        covered[rec.id] = true;
        result.push(rec);
      }
    }

    for (var domainId in doms) {
      if (!doms.hasOwnProperty(domainId)) continue;
      var ds2 = doms[domainId] || {};
      var opps2 = Array.isArray(ds2.brainOpportunities) ? ds2.brainOpportunities : [];
      for (var oi2 = 0; oi2 < opps2.length; oi2++) {
        var op2 = opps2[oi2];
        if (!op2) continue;
        var id = stableId(op2, domainId);
        if (covered[id]) continue;
        result.push(_buildLegacyRecord(op2, ds2, domainId, doms));
      }
    }

    result.sort(function (a, b) { return b.readiness.score - a.readiness.score; });
    return result;
  }

  window.LIMENMasterBrainReadiness = {
    collect: collect,
    collectPathways: collectPathways,
    collectAggregate: collectAggregate,
    buildLedger: buildLedger,
    scoreOpportunity: scoreOpportunity,
    scorePathway: scorePathway,
    stableId: stableId,
    WEIGHTS: WEIGHTS,
    PATHWAY_WEIGHTS: PATHWAY_WEIGHTS
  };
})();
