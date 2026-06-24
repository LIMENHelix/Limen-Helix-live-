/**
 * domain-brain-adapter.js — Additive Brain→Civilization Bridge
 *
 * Listens for domain-brain-update events and merges brain-sourced
 * fields into window.LIMENDomains[domainId] using brain* prefix.
 *
 * Civilization-side persistent cache: signal-engine and refresh controllers
 * periodically rewrite window.LIMENDomains[key] which wipes brain* fields.
 * To keep Civilization consumers seeing stable brain data, the adapter
 * caches the last-seen brain payload per domain and re-applies it whenever
 * snapshot writes fire (limen:domain-update), subject to a 5-minute TTL.
 *
 * ADDITIVE ONLY — never overwrites existing Civilization fields (non-brain*).
 * Does not change brain behavior, signal-engine authority, or domain files.
 *
 * Fields cached (canonical A–M contract, all brain* prefixed, additive):
 *   A. Identity/timing:  brainDomainId, brainInstance, brainCycleNumber,
 *                        brainUpdatedAt, brainCycleIntervalMs, brainUpdated (legacy)
 *   B. V1–V2 evidence:   brainFeeds, brainSourcesLive, brainSourcesTotal,
 *                        brainFeedFreshnessSec, brainActiveConditions
 *   C. V4 patterns:      brainDiagnoses, brainNearDiagnoses, brainConvergence
 *   D. IT objects:       brainOpportunities, brainOpportunityCount
 *   E. Planning:         brainTreatments, brainResolvedContent
 *   F. Developmental:    brainPhase, brainPhaseLabel, brainPhaseConfidence,
 *                        brainPhaseVector, brainPhasePrev, brainPhaseEntropy,
 *                        brainCt, brainStress, brainStressTrend,
 *                        brainHysteresisPenalty, brainMaturity, brainTrajectory,
 *                        brainConfidence
 *   G. Cross-modal:      brainEmissions, brainIngest
 *   H. Binding:          brainCompanies
 *   I. Directives:       brainDirectives, brainDirectiveCount,
 *                        brainDirectivesTopRankCutoff
 *   J. Operator:         brainClaims, brainClaimsByStatus, brainRecentOutcomes,
 *                        brainLastOutcomeAt
 *   K. Self-audit:       brainSelfAudit, brainAuditScore, brainAuditFindings,
 *                        brainReadyForHandoff
 *   L. Biosensor:        brainBiosensor
 *   M. Provenance:       brainProducedBy, brainProducerVersion, brainValidatedAt
 *   F0. Lifecycle models: brainEnergyModel (energy), brainSupplyChainModel
 *                        (supplyChain), brainEnvironmentModel (environment),
 *                        brainGovernanceModel (governance: institutional-lifecycle
 *                        — policy regime, regulatory constraint, oversight
 *                        effectiveness), brainHealthModel (medicine),
 *                        brainEducationModel (education: human-capital-lifecycle
 *                        — curriculum-delivery phase, accreditation/credentialing
 *                        regulation, enrollment-capacity stress, prior
 *                        learning-outcome/literacy health); each null outside
 *                        its own domain
 *   Status:              brainStatus
 *
 * Fields not yet emitted by a brain read as inert defaults ([] / null) —
 * adapter shape is stable regardless of per-brain exposure maturity.
 *
 * Depends on: window.LIMENDomains (from domain-signal-engine)
 * Listens to:
 *   limen:domain-brain-update (from domain-brain-base)
 *   limen:domain-update (from domain-signal-engine, signals a snapshot write)
 * Provides: window.LIMENBrainAdapter
 */
(function () {
  'use strict';

  var _TTL_MS = 5 * 60 * 1000; // 5 minutes per cached domain payload

  var _mergeCount = 0;
  var _reapplyCount = 0;
  var _lastMergedDomains = {};
  // Per-domain cache of last-seen brain payload.
  // Shape: { [domainId]: { payload: { brain* fields }, capturedAt: number } }
  var _payloadCache = {};

  function _arr(v)    { return Array.isArray(v) ? v : []; }
  function _num(v)    { return typeof v === 'number' ? v : null; }
  function _val(v)    { return v != null ? v : null; }
  function _obj(v)    { return (v && typeof v === 'object' && !Array.isArray(v)) ? v : null; }

  function _buildPayload(bs) {
    var opps = _arr(bs.opportunities);
    var dirs = _arr(bs.directives);
    return {
      // === Existing 10 fields — unchanged, preserved verbatim ===
      brainDiagnoses:     _arr(bs.diagnoses),
      brainTreatments:    _arr(bs.treatments),
      brainOpportunities: opps,
      brainPhase:         _val(bs.phase),
      brainPhaseLabel:    _val(bs.phaseLabel),
      brainStress:        _num(bs.stress),
      brainConfidence:    _num(bs.confidence),
      brainEmissions:     _arr(bs.crossDomainEmissions),
      brainStatus:        _val(bs.status),
      brainUpdated:       _val(bs.updated),
      brainEnergyModel:   _obj(bs.energyModel),   // F0: carry recurrent brain model (energy; null elsewhere)
      brainSupplyChainModel: _obj(bs.supplyChainModel), // F0.trade: carry recurrent logistics-lifecycle model (trade/supplyChain)
      brainEnvironmentModel: _obj(bs.environmentModel), // F0.environment: carry recurrent climate/emissions/ecosystem lifecycle model (environment; null elsewhere)
      brainGovernanceModel: _obj(bs.governanceModel), // F0.governance: carry recurrent institutional-lifecycle model (policy regime, regulatory constraint, oversight effectiveness; governance only, null elsewhere)
      brainHealthModel: _obj(bs.healthModel), // F0.medicine: carry recurrent disease-burden/clinical-pipeline lifecycle model (medicine uses 'health' snapshot key; null elsewhere)
      brainEducationModel: _obj(bs.educationModel), // F0.education: carry recurrent human-capital-lifecycle model (curriculum-delivery phase, accreditation/credentialing regulation, enrollment-capacity stress, prior learning-outcome/literacy health; education only, null elsewhere)

      // === A. Identity & timing (additive) ===
      brainDomainId:              _val(bs.domainId),
      brainInstance:              _val(bs.brainInstance),
      brainCycleNumber:           _num(bs.cycleNumber),
      brainUpdatedAt:             _num(bs.updatedAt),
      brainCycleIntervalMs:       _num(bs.cycleIntervalMs),

      // === B. V1–V2 evidence ===
      brainFeeds:                 _arr(bs.feeds),
      brainSourcesLive:           _num(bs.sourcesLive),
      brainSourcesTotal:          _num(bs.sourcesTotal),
      brainFeedFreshnessSec:      _num(bs.feedFreshnessSec),
      brainActiveConditions:      _arr(bs.activeConditions),

      // === C. V4 pattern layer ===
      brainNearDiagnoses:         _arr(bs.nearDiagnoses),
      brainConvergence:           _obj(bs.convergence),

      // === D. IT object layer ===
      brainOpportunityCount:      typeof bs.opportunityCount === 'number'
                                    ? bs.opportunityCount
                                    : opps.length,

      // === E. Planning / treatment layer ===
      brainResolvedContent:       _obj(bs.resolvedContent),
      // Agriculture-only node-first opportunity matrix (see
      // agriculture-opportunity-matrix.js). Projected here so when the
      // brain cycles, the adapter re-applies the matrix alongside other
      // brain* fields after snapshot writes. Safe for non-ag brains: field
      // is undefined on their state and _arr() yields [].
      brainOpportunityMatrix:     _arr(bs.opportunityMatrix),
      brainOpportunityMatrixMeta: _obj(bs.opportunityMatrixMeta),

      // === F. Developmental state (long-arc kernel, uncollapsed) ===
      brainPhaseConfidence:       _num(bs.phaseConfidence),
      brainPhaseVector:           _arr(bs.phaseVector),
      brainPhasePrev:             _arr(bs.phasePrev),
      brainPhaseEntropy:          _num(bs.phaseEntropy),
      brainCt:                    _num(bs.C_t),
      brainStressTrend:           _val(bs.stressTrend),
      brainHysteresisPenalty:     _num(bs.hysteresisPenalty),
      brainMaturity:              _val(bs.maturity),
      brainTrajectory:            _val(bs.trajectory),

      // === G. Cross-modal ===
      brainIngest:                _arr(bs.crossDomainIngest),

      // === H. Company / target binding ===
      brainCompanies:             _arr(bs.companies),

      // === I. Directive layer (the gold) ===
      brainDirectives:            dirs,
      brainDirectiveCount:        typeof bs.directiveCount === 'number'
                                    ? bs.directiveCount
                                    : dirs.length,
      brainDirectivesTopRankCutoff: _num(bs.directivesTopRankCutoff),

      // === J. Operator state ===
      brainClaims:                _arr(bs.claims),
      brainClaimsByStatus:        _obj(bs.claimsByStatus),
      brainRecentOutcomes:        _arr(bs.recentOutcomes),
      brainLastOutcomeAt:         _num(bs.lastOutcomeAt),

      // === K. Self-audit ===
      brainSelfAudit:             _obj(bs.selfAudit),
      brainAuditScore:            _num(bs.auditScore),
      brainAuditFindings:         _arr(bs.auditFindings),
      brainReadyForHandoff:       typeof bs.readyForHandoff === 'boolean'
                                    ? bs.readyForHandoff
                                    : null,

      // === L. Biosensor ===
      brainBiosensor:             _obj(bs.biosensor),

      // === M. Provenance ===
      brainProducedBy:            _val(bs.produced_by),
      brainProducerVersion:       _val(bs.producer_version),
      brainValidatedAt:           _num(bs.validated_at)
    };
  }

  function _applyPayload(slot, payload) {
    if (!slot || typeof slot !== 'object' || !payload) return;
    for (var k in payload) {
      if (payload.hasOwnProperty(k)) slot[k] = payload[k];
    }
  }

  function _onBrainUpdate(e) {
    try {
      var detail = e.detail;
      if (!detail || !detail.domainId || !detail.state) return;

      var domainId = detail.domainId;
      var bs = detail.state;
      var target = window.LIMENDomains;

      // If LIMENDomains doesn't exist yet, still cache so we can apply later
      var payload = _buildPayload(bs);
      _payloadCache[domainId] = { payload: payload, capturedAt: Date.now() };

      if (!target || typeof target !== 'object') return;
      if (!target[domainId]) target[domainId] = {};
      _applyPayload(target[domainId], payload);

      _mergeCount++;
      _lastMergedDomains[domainId] = Date.now();
    } catch (err) { /* silent — diagnostic layer only */ }
  }

  function _onDomainUpdate() {
    try {
      var target = window.LIMENDomains;
      if (!target || typeof target !== 'object') return;

      var now = Date.now();
      var reapplied = 0;
      for (var domainId in _payloadCache) {
        if (!_payloadCache.hasOwnProperty(domainId)) continue;
        var entry = _payloadCache[domainId];
        if (!entry || !entry.payload) continue;

        // TTL — drop if stale
        if (now - entry.capturedAt > _TTL_MS) {
          delete _payloadCache[domainId];
          continue;
        }

        // Re-apply cached brain fields if the slot exists (signal-engine wiped them)
        var slot = target[domainId];
        if (!slot || typeof slot !== 'object') continue;

        // Only re-apply if fields are missing / were wiped — avoid overwriting
        // fresher brain-update writes that may already be present.
        var needsReapply = false;
        var p = entry.payload;
        for (var k in p) {
          if (p.hasOwnProperty(k) && slot[k] === undefined) { needsReapply = true; break; }
        }
        if (!needsReapply) continue;

        _applyPayload(slot, p);
        reapplied++;
      }
      if (reapplied > 0) _reapplyCount++;
    } catch (err) { /* silent */ }
  }

  // Listen for brain cycle completions
  window.addEventListener('limen:domain-brain-update', _onBrainUpdate);
  // Listen for snapshot writes so we can restore brain fields that were wiped
  window.addEventListener('limen:domain-update', _onDomainUpdate);

  // Public API (diagnostics only)
  window.LIMENBrainAdapter = {
    getMergeCount: function () { return _mergeCount; },
    getReapplyCount: function () { return _reapplyCount; },
    getLastMerged: function () { return _lastMergedDomains; },
    getCachedDomains: function () {
      var out = {};
      var now = Date.now();
      for (var k in _payloadCache) {
        if (_payloadCache.hasOwnProperty(k)) {
          var e = _payloadCache[k];
          out[k] = {
            capturedAt: e.capturedAt,
            ageMs: now - e.capturedAt,
            ageSeconds: Math.round((now - e.capturedAt) / 1000),
            dxCount: e.payload.brainDiagnoses ? e.payload.brainDiagnoses.length : 0,
            txCount: e.payload.brainTreatments ? e.payload.brainTreatments.length : 0,
            oppCount: e.payload.brainOpportunities ? e.payload.brainOpportunities.length : 0
          };
        }
      }
      return out;
    },
    isActive: function () { return _mergeCount > 0; }
  };

})();
