/**
 * technology-brain.js — Technology Domain Cognitive Engine
 *
 * Portal issues: CYBER_ATTACK, AI_ALIGNMENT_FAILURE, INFRASTRUCTURE_COLLAPSE,
 *                DATA_BREACH, CHIP_SHORTAGE, PLATFORM_MONOPOLY
 *
 * Emissions: finance, defense, communication, governance, infrastructure
 * Exposes: window.LIMENTechnologyBrain
 */
(function () {
  'use strict';
  if (!window.LIMENDomainBrainBase) { console.warn('[TechnologyBrain] Base not loaded'); return; }
  var Base = window.LIMENDomainBrainBase;

  function TechnologyBrain() {
    Base.call(this, { domainId: 'technology', label: 'Technology', snapshotKey: 'technology', cycleInterval: 30000 });
  }
  TechnologyBrain.prototype = Object.create(Base.prototype);
  TechnologyBrain.prototype.constructor = TechnologyBrain;

  TechnologyBrain.prototype.init = function () {
    Base.prototype.init.call(this);

    // ── THING2 RECURSIVE PHASE KERNEL as the phase source (2026-07-13) ──
    // Persistent stress series feeding window.LIMENThing2.phaseOfSeries (PURE MATH — no
    // network, no AI; the 30s cycle stays deterministic). The domain primary scalar is
    // STRESS (up = worse), so the kernel is called with positive:false. Fallback to the
    // existing naive/static PHASE_M phase whenever the kernel is unavailable or returns null.
    this._kernelPhase = null;
    this._phaseSeries = [];
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        var _ps = JSON.parse(localStorage.getItem('limen:phaseseries:technology'));
        if (Array.isArray(_ps)) this._phaseSeries = _ps;
      }
    } catch (_e) { this._phaseSeries = []; }

    // ── One-shot cognition loaders (mirror culture/infrastructure init): real entities,
    //    validated distress signals, real source bundles, L1 mad-lib scan, innovation-pipeline sub-portal. ──
    try { this._loadTechnologyCommandBoardCompanies(); } catch (e) {}  // real entities (state.companies starved)
    try { this._loadTechnologyBrainSignals(); } catch (e) {}           // distress ONLY from the validated Thing pipeline
    try { this._loadTechnologyDiagnosisBundles(); } catch (e) {}       // load real artifact-source bundles (only ones that exist)
    try { this._loadTechnologyL1PortalDepth(); } catch (e) {}          // scan L1 branches (treatments mad-lib -> NOT admitted; real tickers only)
    try { this._loadInnovationPipelineLayer(); } catch (e) {}          // INNOVATION: R&D / compute-capacity sub-portal as an additive LAYER

    // ── ACTUATION (2026-07-13): bring technology to Energy's actuation depth, VALIDITY-GATED per
    //    actuation (honest — advisory where a real effector/validated signal is absent). All four
    //    are DETERMINISTIC and reversible (flip any flag to false). NO paid-AI / fetch-to-LLM ever
    //    runs on the 30s cycle; the only network is a one-shot degrade-safe edge fetch for selfAudit.
    //
    //    refractory  VALID  — effector = withhold DUPLICATE action-draft (REPORT_GENERATION) within a
    //                          dead-time window (Neuro Ref III.3). Diagnosis stays active/displayed;
    //                          only the re-fired draft is suppressed. Real, honest de-dup.
    //    servo       VALID  — effector = proportional emission-confidence dampening. Sensor = excitatory
    //                          drive (stress + active conditions + active dx) vs technologyModel.regulation
    //                          .inhibition (a REAL live inhibition term this brain already computes);
    //                          PI controller drives inhibition toward a drive+deviation target (Neuro Ref
    //                          XIII.1/V.2/XII). Technology genuinely emits (opportunities + cross-domain
    //                          signals), so the dampener is a real controllable output effector.
    //    eiBrake     VALID  — consumes the servo emissionFactor to dampen emitted opportunity confidence
    //                          and flag runaway-risk when inhibition lags drive. Same emission channel.
    //    phase       VALID  — (A) coherence ROUTER couples to co-phased stressed peer domains (patent
    //                          Section 3.4 Loop-1 M matrix) and boosts cross-domain opportunities toward
    //                          them (comm-through-coherence). (B) phase-transition REWARD is treated as a
    //                          ground-truth learning signal ONLY on P3/P7-involving transitions (the
    //                          phases Thing1 validates); everywhere else it is advisory-self-consistency
    //                          and NEVER feeds the learning rate — so no validated signal is fabricated.
    //    (selfAudit is computed as an observe-only advisory below — technology.json carries 85 REAL
    //     edges, so the XIV connectivity / single-point-of-failure audit runs on a real graph; it is
    //     consumed for display, not actuated into the brake, matching Energy's honest boundary.)
    this._actuation = { refractory: true, servo: true, eiBrake: true, phase: true };
    this._refractoryParams = {
      absoluteWindow: 900000,     // 15 min hard dead-time (operator-set; business-scale, not in the doc)
      relativeWindow: 3600000,    // 1 hr raised-bar window (doc 1:4 ratio preserved)
      overrideThreshold: 0.9      // only stress >= 0.9 re-fires in-window (reduced sensitivity)
    };

    this.diagnosisIndex = {
      'CYBER_ATTACK':               ['cyber_breach', 'network_intrusion', 'ransomware', 'infrastructure_attack', 'technology_high_stress', 'macro_shock'],
      'AI_ALIGNMENT_FAILURE':       ['ai_misalignment', 'autonomy_overreach', 'bias_amplification', 'alignment_gap', 'technology_high_stress'],
      'INFRASTRUCTURE_COLLAPSE':    ['system_failure', 'outage_cascade', 'cloud_disruption', 'dependency_failure', 'technology_high_stress'],
      'DATA_BREACH':                ['data_exfiltration', 'privacy_exposure', 'credential_compromise', 'cyber_breach', 'compliance_violation'],
      'CHIP_SHORTAGE':              ['supply_constraint', 'semiconductor_gap', 'manufacturing_bottleneck', 'component_scarcity', 'structural_stress'],
      'PLATFORM_MONOPOLY':          ['market_concentration', 'platform_lock_in', 'innovation_suppression', 'competitive_distortion', 'structural_stress']
    };

    // Emissions gate on STRESS *and* at least one active diagnosis (evidence-grounded
    // coupling only — prevents stress-only noise flooding the cross-domain graph).
    function _hasActiveDx(s) { return s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); }
    function _hasCyberOrAi(s) {
      return s.diagnoses && s.diagnoses.some(function (d) {
        return d.active && (d.id === 'CYBER_ATTACK' || d.id === 'DATA_BREACH' || d.id === 'AI_ALIGNMENT_FAILURE');
      });
    }
    this.emissionRules = [
      { targetDomain: 'finance', signalType: 'tech_risk_exposure', condition: function (s) { return s.stress >= 0.20 && _hasActiveDx(s); }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.55); } },
      { targetDomain: 'defense', signalType: 'cyber_threat_vector', condition: function (s) { return s.stress >= 0.20 && _hasActiveDx(s); }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); } },
      { targetDomain: 'communication', signalType: 'platform_integrity_pressure', condition: function (s) { return s.stress >= 0.25 && _hasActiveDx(s); }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); } },
      { targetDomain: 'governance', signalType: 'tech_regulation_pressure', condition: function (s) { return s.stress >= 0.30 && _hasActiveDx(s); }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); } },
      { targetDomain: 'infrastructure', signalType: 'digital_infrastructure_strain', condition: function (s) { return s.stress >= 0.30 && _hasActiveDx(s); }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.4); } },
      // Richer mesh edges — fire only when a real cyber / AI-alignment diagnosis is active.
      { targetDomain: 'intelligence', signalType: 'zero_day_threat_intelligence', condition: function (s) { return s.stress >= 0.25 && _hasCyberOrAi(s); }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); } },
      { targetDomain: 'science', signalType: 'ai_safety_research_gap', condition: function (s) { return s.stress >= 0.25 && _hasCyberOrAi(s); }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); } }
    ];
  };

  TechnologyBrain.prototype.normalizeSignals = function () {
    var signals = [], rawSignals = (this._rawDomain && this._rawDomain.signals) || [];
    for (var i = 0; i < rawSignals.length; i++) signals.push(rawSignals[i]);
    this._activeConditions = [];

    // Long-arc baseline — technology always has cyber risk and innovation pressure
    this._activeConditions.push('cyber_breach');
    this._activeConditions.push('alignment_gap');
    signals.push('BASELINE: Persistent cyber threat landscape and AI alignment posture pressure');

    var feeds = this.state.feeds;
    for (var fi = 0; fi < feeds.length; fi++) {
      var f = feeds[fi], fn = (f.name || '').toLowerCase();
      if ((fn.indexOf('patent') !== -1 || fn.indexOf('uspto') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('innovation_suppression');
        signals.push('FEED: Patent signal — ' + (f.label || f.value));
      }
      if (fn.indexOf('arxiv') !== -1 && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('autonomy_overreach');
        signals.push('FEED: CS research signal — ' + (f.label || f.value));
      }
      if ((fn.indexOf('cisa') !== -1 || fn.indexOf('kev') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('cyber_breach');
        this._activeConditions.push('network_intrusion');
        if (f.value >= 5) this._activeConditions.push('infrastructure_attack');
        signals.push('FEED: CISA Known Exploited Vulnerabilities \u2014 ' + (f.label || f.value));
      }
      if (fn.indexOf('nvd') !== -1 && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('compliance_violation');
        if (f.value >= 20) this._activeConditions.push('data_exfiltration');
        signals.push('FEED: NVD vulnerability signal \u2014 ' + (f.label || f.value));
      }
      if (fn.indexOf('krebs') !== -1 && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('ransomware');
        if (f.value >= 5) this._activeConditions.push('privacy_exposure');
        signals.push('FEED: Krebs Security signal \u2014 ' + (f.label || f.value));
      }
      if (fn.indexOf('hacker news') !== -1 && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('platform_lock_in');
        if (f.value >= 10) this._activeConditions.push('ai_misalignment');
        signals.push('FEED: Hacker News tech discourse signal \u2014 ' + (f.label || f.value));
      }
      if (fn.indexOf('github security') !== -1 && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('component_scarcity');
        if (f.value >= 5) this._activeConditions.push('dependency_failure');
        signals.push('FEED: GitHub Security Advisories \u2014 ' + (f.label || f.value));
      }

      // \u2500\u2500 INSTITUTIONAL FEED-DERIVED CONDITIONS (Federal Register) \u2500\u2500
      // Distinct collection methodology \u2014 regulatory doc-counts (different ceiling than RSS/APIs).

      // Fed Reg FCC \u2014 telecom/platform regulatory \u2192 PLATFORM_MONOPOLY / INFRASTRUCTURE_COLLAPSE
      if (fn.indexOf('fed reg fcc') !== -1 && f.value !== undefined && f.value >= 5) {
        this._activeConditions.push('platform_lock_in');
        signals.push('Fed Reg FCC: ' + f.value + ' telecom regulatory docs (30d)');
      }
      if (fn.indexOf('fed reg fcc') !== -1 && f.value !== undefined && f.value >= 10) {
        this._activeConditions.push('market_concentration');
        this._activeConditions.push('competitive_distortion');
      }

      // Fed Reg NIST \u2014 standards/AI regulatory \u2192 AI_ALIGNMENT_FAILURE
      if (fn.indexOf('fed reg nist') !== -1 && f.value !== undefined && f.value >= 3) {
        this._activeConditions.push('alignment_gap');
        signals.push('Fed Reg NIST: ' + f.value + ' standards regulatory docs (30d)');
      }
      if (fn.indexOf('fed reg nist') !== -1 && f.value !== undefined && f.value >= 6) {
        this._activeConditions.push('ai_misalignment');
        this._activeConditions.push('autonomy_overreach');
      }

      // Fed Reg FTC \u2014 antitrust/platform regulatory \u2192 PLATFORM_MONOPOLY
      if (fn.indexOf('fed reg ftc') !== -1 && f.value !== undefined && f.value >= 3) {
        this._activeConditions.push('market_concentration');
        signals.push('Fed Reg FTC: ' + f.value + ' antitrust/platform docs (30d)');
      }
      if (fn.indexOf('fed reg ftc') !== -1 && f.value !== undefined && f.value >= 6) {
        this._activeConditions.push('innovation_suppression');
        this._activeConditions.push('competitive_distortion');
      }
      if (fn.indexOf('fed reg ftc') !== -1 && f.value !== undefined && f.value >= 10) {
        this._activeConditions.push('compliance_violation');
      }
    }

    for (var rsi = 0; rsi < rawSignals.length; rsi++) {
      var rs = (typeof rawSignals[rsi] === 'string' ? rawSignals[rsi] : '').toLowerCase();
      if (rs.indexOf('cyber') !== -1 || rs.indexOf('hack') !== -1 || rs.indexOf('ransomware') !== -1 || rs.indexOf('breach') !== -1) {
        if (this._activeConditions.indexOf('network_intrusion') === -1) this._activeConditions.push('network_intrusion');
        if (this._activeConditions.indexOf('ransomware') === -1) this._activeConditions.push('ransomware');
      }
      if (rs.indexOf('ai') !== -1 || rs.indexOf('artificial intelligence') !== -1 || rs.indexOf('alignment') !== -1 || rs.indexOf('autonomous') !== -1) {
        if (this._activeConditions.indexOf('ai_misalignment') === -1) this._activeConditions.push('ai_misalignment');
        if (this._activeConditions.indexOf('bias_amplification') === -1) this._activeConditions.push('bias_amplification');
      }
      if (rs.indexOf('outage') !== -1 || rs.indexOf('downtime') !== -1 || rs.indexOf('cloud') !== -1 || rs.indexOf('infrastructure') !== -1) {
        if (this._activeConditions.indexOf('system_failure') === -1) this._activeConditions.push('system_failure');
        if (this._activeConditions.indexOf('outage_cascade') === -1) this._activeConditions.push('outage_cascade');
      }
      if (rs.indexOf('chip') !== -1 || rs.indexOf('semiconductor') !== -1 || rs.indexOf('shortage') !== -1) {
        if (this._activeConditions.indexOf('semiconductor_gap') === -1) this._activeConditions.push('semiconductor_gap');
        if (this._activeConditions.indexOf('supply_constraint') === -1) this._activeConditions.push('supply_constraint');
      }
      if (rs.indexOf('monopol') !== -1 || rs.indexOf('antitrust') !== -1 || rs.indexOf('big tech') !== -1) {
        if (this._activeConditions.indexOf('market_concentration') === -1) this._activeConditions.push('market_concentration');
        if (this._activeConditions.indexOf('platform_lock_in') === -1) this._activeConditions.push('platform_lock_in');
      }
      if (rs.indexOf('data') !== -1 && (rs.indexOf('breach') !== -1 || rs.indexOf('leak') !== -1 || rs.indexOf('exfil') !== -1)) {
        if (this._activeConditions.indexOf('data_exfiltration') === -1) this._activeConditions.push('data_exfiltration');
        if (this._activeConditions.indexOf('privacy_exposure') === -1) this._activeConditions.push('privacy_exposure');
      }
    }

    // Patent signals from enriched snapshot
    if (this._rawDomain && this._rawDomain.patentSignals) {
      var ps = this._rawDomain.patentSignals;
      if (ps.filingAcceleration) { this._activeConditions.push('innovation_suppression'); signals.push('PATENT: Filing acceleration detected'); }
      if (ps.concentrationRisk) { this._activeConditions.push('competitive_distortion'); signals.push('PATENT: Concentration risk in filings'); }
    }

    var snap = this._getSnapshot();
    if (snap && snap.defenseSignals) {
      for (var si = 0; si < snap.defenseSignals.length; si++) {
        var sig = snap.defenseSignals[si];
        if (sig.affectedDomains && sig.affectedDomains.indexOf('technology') !== -1) {
          this._activeConditions.push(sig.eventType);
          signals.push('FEED [DEFENSE]: ' + (sig.eventType || '').replace(/_/g, ' '));
        }
      }
    }
    if (snap && snap.macroShock && snap.macroShock.detected) this._activeConditions.push('macro_shock');

    if (window.LIMENDomainBrains) {
      var allBrains = window.LIMENDomainBrains.getAll();
      for (var bk in allBrains) {
        if (bk === 'technology') continue;
        var b = allBrains[bk]; if (!b || !b.state) continue;
        var bEm = b.state.crossDomainEmissions || [];
        for (var bei = 0; bei < bEm.length; bei++) {
          var be = bEm[bei];
          if (be.targetDomain === 'technology' && be.magnitude > 0.1) {
            signals.push('FEED [' + bk.toUpperCase() + ']: ' + (be.signal || '').replace(/_/g, ' ') + ' — ' + Math.round(be.magnitude * 100) + '%');
          }
        }
      }
    }

    if (this.state.stress >= 0.20) { this._activeConditions.push('dependency_failure'); this._activeConditions.push('credential_compromise'); }
    if (this.state.stress >= 0.35) { this._activeConditions.push('infrastructure_attack'); this._activeConditions.push('cloud_disruption'); }
    if (this.state.stress >= 0.50) { this._activeConditions.push('technology_high_stress'); this._activeConditions.push('compliance_violation'); }
    if (this.state.stress >= 0.60) { this._activeConditions.push('manufacturing_bottleneck'); this._activeConditions.push('component_scarcity'); }
    if (this.state.maturity === 'STRUCTURAL') this._activeConditions.push('structural_stress');
    var extPressure = this.getExternalPressure ? this.getExternalPressure() : 0;
    if (extPressure >= 0.10) this._activeConditions.push('supply_constraint');
    if (extPressure >= 0.20) this._activeConditions.push('competitive_distortion');

    this.state.signals = signals;
    return Promise.resolve();
  };

  // Brain cognition lifts stress when an existential tech condition the raw composite
  // under-weighted is active — so a recognized cyber attack / AI-alignment failure
  // registers (clearing the cross-domain emission gates so technology joins the mesh).
  var _baseScoreStress = (window.LIMENDomainBrainBase && window.LIMENDomainBrainBase.prototype.scoreStress);
  TechnologyBrain.prototype.scoreStress = function () {
    if (_baseScoreStress) _baseScoreStress.call(this);
    else this.state.stress = (this._rawDomain && this._rawDomain.stress) || 0;
    var ac = this._activeConditions || [];
    var floor = 0;
    if (ac.indexOf('CYBER_ATTACK') !== -1 || ac.indexOf('cyber_breach') !== -1 || ac.indexOf('infrastructure_attack') !== -1 || ac.indexOf('ransomware') !== -1) floor = Math.max(floor, 0.65); // standing cyber presence = elevated
    if (ac.indexOf('AI_MISALIGNMENT') !== -1 || ac.indexOf('ai_misalignment') !== -1) floor = Math.max(floor, 0.60);
    if (floor > 0) {
      this.state.stress = Math.max(this.state.stress || 0, floor);
      this.state._stressFloorReason = (ac.indexOf('CYBER_ATTACK') !== -1 || ac.indexOf('cyber_breach') !== -1 || ac.indexOf('ransomware') !== -1) ? 'cyber threat' : 'ai alignment';
    }
  };

  TechnologyBrain.prototype.deriveDiagnoses = function () {
    var self = this;
    return this._getPortalContent().then(function (portal) {
      if (!portal) return;
      var issues = portal.issues || [], conditions = self._activeConditions || [];
      self.state.diagnoses = issues.map(function (iss) {
        var triggers = self.diagnosisIndex[iss.id] || [], matchCount = 0;
        for (var t = 0; t < triggers.length; t++) for (var c = 0; c < conditions.length; c++) if (conditions[c] === triggers[t] || conditions[c].indexOf(triggers[t]) !== -1) matchCount++;
        return { id: iss.id, label: iss.label, summary: iss.summary || '', active: matchCount > 0, relevance: Math.round((triggers.length > 0 ? matchCount / triggers.length : 0) * 100) / 100, matchedConditions: matchCount, totalTriggers: triggers.length, circuits: iss.circuits || [], source: 'canonical' };
      });
      self.state.diagnoses.sort(function (a, b) { if (a.active !== b.active) return a.active ? -1 : 1; return b.relevance - a.relevance; });
      self._checkDiagnosisActions();
      // Neuro-substrate telemetry (advisory, pulse-less capable): brain state -> runtime overlay.
      try {
        if (window.DomainTelemetryAdapter && typeof window.DomainTelemetryAdapter.fromLiveCached === "function") {
          window.DomainTelemetryAdapter.fromLiveCached("technology", self.state, self._runtimeOverlay || null)
            .then(function (ov) { if (ov) self._runtimeOverlay = ov; }).catch(function () {});
        }
      } catch (_e) {}
    });
  };

  TechnologyBrain.prototype.recommendTreatments = function () {
    var self = this;
    return this._getPortalContent().then(function (portal) {
      if (!portal) return;
      var activeDx = self.state.diagnoses.filter(function (d) { return d.active; });
      if (activeDx.length === 0) { self.state.treatments = []; return; }
      var activeNodeIds = {};
      for (var di = 0; di < activeDx.length; di++) { var circuits = activeDx[di].circuits || []; for (var ci = 0; ci < circuits.length; ci++) activeNodeIds[circuits[ci].nodeId] = activeDx[di].id; }
      var treatments = [], activations = portal.activations || [];
      for (var ai = 0; ai < activations.length; ai++) { var act = activations[ai]; if (!activeNodeIds[act.brainNodeId]) continue; var actTreats = act.treatments || []; for (var ti = 0; ti < actTreats.length; ti++) { var t = actTreats[ti]; treatments.push({ id: 'treat_' + act.brainNodeId + '_' + ti, label: t.label, type: t.type, evidence: t.evidence, description: t.description || '', diagnosisId: activeNodeIds[act.brainNodeId], nodeId: act.brainNodeId, relevance: 1.0, source: 'canonical' }); } }
      var eR = { A: 10, 'Strong': 10, B: 7, 'Moderate': 7, C: 4, 'Emerging': 1 };
      treatments.sort(function (a, b) { return (eR[b.evidence] || 0) - (eR[a.evidence] || 0); });
      self.state.treatments = treatments;
    });
  };

  TechnologyBrain.prototype.surfaceOpportunities = function () {
    Base.prototype.surfaceOpportunities.call(this);
    // Fallback: if the snapshot didn't supply companies, use real command-board entities.
    if ((!this.state.companies || !this.state.companies.length) && this._cbTechnologyCompanies && this._cbTechnologyCompanies.length) {
      this.state.companies = this._cbTechnologyCompanies;
    }
    var opps = [], stress = this.state.stress, activeDx = this.state.diagnoses.filter(function (d) { return d.active; }), allDx = this.state.diagnoses || [], companies = this.state.companies, seen = {};
    function add(o) { var key = o.title.toLowerCase().replace(/[^a-z0-9]/g, ''); if (seen[key]) return; seen[key] = true; opps.push(o); }

    for (var di = 0; di < activeDx.length; di++) {
      var dx = activeDx[di], dxLabel = (dx.label || dx.id || '').replace(/_/g, ' ');
      add({ title: dxLabel + ' — cybersecurity and threat detection infrastructure', rank: stress * dx.relevance, path: 'INVESTABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.50) add({ title: dxLabel + ' — resilience and recovery systems', rank: stress * dx.relevance * 0.9, path: 'INVESTABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.55 && dx.relevance >= 0.2) add({ title: dxLabel + ' — AI safety and alignment infrastructure', rank: stress * 0.85, path: 'RESEARCHABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      add({ title: dxLabel + ' — supply chain and component diversification', rank: stress * dx.relevance * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
    }

    var termCo = [] /* neutralized: distress only from validated gate (see energy-brain) */;
    if (termCo.length > 0) add({ title: 'Technology terminal entity distressed positioning', rank: 0.95, path: 'INVESTABLE', urgency: 'high', source: 'company_terminal', tier: 1, companies: termCo.map(function (c) { return c.ticker; }), stress: stress });
    if (this.state.convergence && this.state.convergence.primary_signal) add({ title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — technology convergence response', rank: 0.98, path: 'INVESTABLE', urgency: 'high', source: 'convergence', tier: 1, stress: stress });

    var emissions = this.state.crossDomainEmissions || [];
    for (var ei = 0; ei < emissions.length; ei++) { var em = emissions[ei]; add({ title: 'Technology \u2192 ' + (em.targetDomain || '').replace(/_/g, ' ') + ' — ' + (em.signal || em.signalType || '').replace(/_/g, ' '), rank: (em.magnitude || 0.5) * stress * 0.8, path: 'INVESTABLE', urgency: em.magnitude > 0.6 ? 'high' : 'medium', source: 'cross_domain', tier: 2, targetDomain: em.targetDomain || null, stress: stress }); }

    if (stress >= 0.50) {
      add({ title: 'Zero-trust architecture and identity verification systems', rank: stress * 0.70, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'zero_trust', stress: stress });
      add({ title: 'Semiconductor supply chain resilience and onshoring', rank: stress * 0.65, path: 'INVESTABLE', urgency: stress > 0.70 ? 'medium' : 'watching', source: 'lagging', tier: 3, diagnosisId: 'chip_resilience', stress: stress });
    }
    if (stress >= 0.60) {
      add({ title: 'AI governance and responsible development frameworks', rank: stress * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'ai_governance', stress: stress });
      add({ title: 'Cloud resilience and multi-provider redundancy', rank: stress * 0.72, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'cloud_resilience', stress: stress });
      add({ title: 'Open-source alternatives and platform interoperability', rank: stress * 0.68, path: 'RESEARCHABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'open_source', stress: stress });
    }

    var nearDx = allDx.filter(function (d) { return !d.active && d.relevance > 0 && d.totalTriggers > 0; });
    for (var ndi = 0; ndi < nearDx.length; ndi++) { if (stress >= 0.45) add({ title: (nearDx[ndi].label || '').replace(/_/g, ' ') + ' — early-stage monitoring', rank: stress * (nearDx[ndi].relevance || 0.1) * 0.5, path: 'RESEARCHABLE', urgency: 'watching', source: 'near_diagnosis', tier: 2, stress: stress, nearDiagnosisId: nearDx[ndi].id }); }

    // PHASE-COHERENCE ACTUATION (reversible via _actuation.phase; comm-through-coherence): when
    // technology is phase-coherent with stressed co-phased peer domains, preferentially "communicate"
    // with them by boosting the cross-domain (tier-2) opportunities aimed at those peers. Bounded
    // (max +30%) and reads the PRIOR cycle's phase dynamics (one-cycle lag, recurrent).
    if (this._actuation && this._actuation.phase) {
      var _pd = this.state.technologyPhaseDynamics;
      if (_pd && _pd.coupled && _pd.coupled.length) {
        var _coMap = {}; _pd.coupled.forEach(function (c) { _coMap[c.domain] = c.coherence * c.stress; });
        for (var _pbo = 0; _pbo < opps.length; _pbo++) {
          var _oo = opps[_pbo];
          if (_oo.tier === 2 && _oo.source === 'cross_domain' && _oo.targetDomain && _coMap[_oo.targetDomain]) {
            _oo.rank = (_oo.rank || 0) * (1 + Math.min(0.3, _coMap[_oo.targetDomain]));
          }
        }
        this.state._phaseBoostedCount = opps.filter(function (o) { return o.tier === 2 && o.targetDomain && _coMap[o.targetDomain]; }).length;
      }
    }
    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });
    // Canonical enrichment — merge technology playbook detail per opportunity
    var PB_LIST = window.LIMENTechnologyOpportunityPlaybooks || [];
    var _byId = {};
    for (var _pbi = 0; _pbi < PB_LIST.length; _pbi++) _byId[PB_LIST[_pbi].id] = PB_LIST[_pbi];
    var _PB_MAP = {
      'CYBER_ATTACK': 'cyber_attack',
      'AI_ALIGNMENT_FAILURE': 'ai_alignment',
      'INFRASTRUCTURE_COLLAPSE': 'infrastructure_collapse',
      'DATA_BREACH': 'cyber_attack',
      'CHIP_SHORTAGE': 'chip_shortage',
      'PLATFORM_MONOPOLY': 'platform_monopoly'
    };
    var _LAGGING_MAP = {
      'ai_governance': 'ai_alignment',
      'chip_resilience': 'chip_shortage',
      'cloud_resilience': 'infrastructure_collapse',
      'open_source': 'platform_monopoly',
      'zero_trust': 'cyber_attack'
    };
    function _resolvePbId(o) {
      if (o.diagnosisId && _PB_MAP[o.diagnosisId]) return _PB_MAP[o.diagnosisId];
      if (o.source === 'lagging' && o.diagnosisId && _LAGGING_MAP[o.diagnosisId]) return _LAGGING_MAP[o.diagnosisId];
      if (o.nearDiagnosisId && _PB_MAP[o.nearDiagnosisId]) return _PB_MAP[o.nearDiagnosisId];
      return null;
    }
    function _urgencyLabel(u) { if (u === 'high') return 'IMMEDIATE'; if (u === 'medium') return 'ACTIVE'; if (u === 'watching') return 'WATCH'; return (u || '').toUpperCase(); }
    // Lanes: investment + research ONLY (patent/grant/loan purged 2026-06-21; relaned GRANT->INVESTABLE, PATENT->RESEARCHABLE)
    var _COMP = {
      'INVESTABLE':   { type: 'invest',   base: 5, unit: 'profit%', tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
      'RESEARCHABLE': { type: 'research', base: 5, unit: 'credit%', tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 published research briefs' },     maxTier: { tier: 3, comp: 15 } }
    };
    for (var oi = 0; oi < opps.length; oi++) {
      var o = opps[oi];
      o.id = (o.diagnosisId || o.nearDiagnosisId || o.source || 'opp').replace(/[^a-zA-Z0-9]/g, '_') + '_' + (o.path || '').toLowerCase().replace(/[^a-z]/g, '') + '_t' + (o.tier || 0);
      o.domain = 'technology';
      o.confidence = Math.round(Math.min(1, (o.rank || 0)) * 100);
      if (!o.whyNow) o.whyNow = o.title;
      o.urgencyLabel = _urgencyLabel(o.urgency);
      var pbId = _resolvePbId(o); o.playbookId = pbId;
      var pb = pbId ? _byId[pbId] : null;
      if (pb) {
        o.explain = pb.explain; o.action = pb.action; o.valueRange = pb.valueRange;
        o.trigger = pb.trigger; o.validation = pb.validation; o.steps = pb.steps;
        o.outcome = pb.outcome; o.failure = pb.failure; o.window = pb.window;
        o.fastPath = pb.fastPath; o.examples = pb.examples;
        o.branch_up = pb.branch_up; o.branch_down = pb.branch_down;
        if (pb.realWorld) o.realWorld = pb.realWorld;
        if (pb.saturation) o.saturation = pb.saturation;
      }
      o.compensation = _COMP[o.path] || null;
      if (o.compensation) o.paths = [o.path];
      o.validity = { createdAt: Date.now(), lastValidated: Date.now(), expiryWindowDays: o.tier === 1 ? 30 : o.tier === 2 ? 60 : 90, requiresRevalidation: false, invalidationReasons: [] };
      if (pb) {
        var stressPct = Math.round((o.stress || 0) * 100);
        var target = '';
        if (o.path === 'INVESTABLE' && pb.realWorld && pb.realWorld.invest) target = pb.realWorld.invest;
        else if (o.path === 'RESEARCHABLE' && pb.realWorld && (pb.realWorld.research || pb.realWorld.build)) target = pb.realWorld.research || pb.realWorld.build;
        else if (o.companies && o.companies.length) target = 'Mapped companies: ' + o.companies.join(', ') + '.';
        var timingParts = []; if (o.urgencyLabel) timingParts.push(o.urgencyLabel); if (pb.window) timingParts.push('Window: ' + pb.window);
        var timing = timingParts.join(' \u00b7 ');
        var evidenceParts = ['Domain: technology', 'Stress: ' + stressPct + '%'];
        if (o.confidence) evidenceParts.push('Confidence: ' + o.confidence + '%');
        if (o.diagnosisId) evidenceParts.push('Diagnosis: ' + String(o.diagnosisId).replace(/_/g, ' ').toLowerCase());
        if (pb.trigger) evidenceParts.push(pb.trigger);
        var evidence = evidenceParts.join('. ') + '.';
        var whyPays = pb.outcome || '';
        if (pb.valueRange) whyPays = (whyPays ? whyPays + ' ' : '') + 'Value range: ' + pb.valueRange + '.';
        var nextStep = (pb.fastPath && pb.fastPath.length) ? pb.fastPath[0] : (pb.steps && pb.steps.length ? pb.steps[0] : '');
        o.moneyChain = { doThis: pb.action || '', whyPays: whyPays, target: target, timing: timing, invalidIf: pb.failure || '', evidence: evidence, nextStep: nextStep };
      }
    }
    this.state.opportunityCount = opps.length;

    // E/I BRAKE ACTUATION (Neuro Ref XIII.1; reversible via _actuation.eiBrake): consume the servo's
    // proportional emissionFactor to dampen emitted opportunity CONFIDENCE when inhibition is not
    // tracking drive (runaway-risk). Effector = the same emission channel the servo regulates. Reads
    // the PRIOR cycle's servo (one-cycle lag, recurrent). Additive; never rewrites rank/scoring.
    opps = this._applyTechnologyEIBrake(opps);

    this.state.opportunities = opps;
    return Promise.resolve();
  };

  TechnologyBrain.prototype._checkDiagnosisActions = function () {
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; }); if (activeDx.length === 0) return;
    var adapters = window.LIMENActionAdapters; if (!adapters) return;
    // REFRACTORY GATE (Neuro Ref III.3) — lazy-init from the doc-grounded module (deterministic, pure).
    // Best-effort + degrade-safe: if the module is absent or actuation is off, the gate is skipped and
    // prior behavior is unchanged. The module is graph/domain-agnostic (absolute dead-time + relative
    // raised-bar; a stronger stimulus can still fire), so technology reuses it without a new file.
    if (!this._refractoryLimiter && this._actuation && this._actuation.refractory &&
        typeof window !== 'undefined' && window.EnergyRefractoryLimiter) {
      try { this._refractoryLimiter = new window.EnergyRefractoryLimiter.RefractoryLimiter(this._refractoryParams); } catch (_e) { this._refractoryLimiter = null; }
    }
    for (var i = 0; i < activeDx.length; i++) { var dx = activeDx[i]; if (adapters.getDrafts && adapters.getDrafts({ domain: 'technology', intentId: dx.id }).length > 0) continue;
      // Once this diagnosis emitted a draft, suppress re-emission within the dead-time unless stress
      // clears the (reduced-sensitivity) override bar. The diagnosis stays active/displayed — only the
      // duplicate DRAFT is withheld. Never breaks the cycle.
      if (this._refractoryLimiter) {
        try {
          var _now = (this._runtimeOverlay && this._runtimeOverlay.timestamp) ||
                     (this.state.pulse && this.state.pulse.timestamp) ||
                     ((typeof Date !== 'undefined' && Date.now) ? Date.now() : 0);
          var _verdict = this._refractoryLimiter.fire(dx.id, _now, this.state.stress);
          if (!_verdict.allowed) { this.state._refractorySuppressed = (this.state._refractorySuppressed || 0) + 1; continue; }
        } catch (_e) { /* best-effort; fall through to normal emission */ }
      }
      adapters.createDraft('REPORT_GENERATION', { domain: 'technology', sourceType: 'domain_brain', sourceId: dx.id, intentId: dx.id, title: 'Technology Alert: ' + dx.label, intent: { domain: 'technology', title: dx.label, status: 'ACTIVE', priority: this.state.stress, progress: 0, strategyType: 'diagnosis_response', steps: [{ type: 'ANALYZE', label: 'Assess ' + dx.label + ' impact on technology systems', status: 'PENDING' }, { type: 'INVESTIGATE', label: 'Identify affected infrastructure, companies, and supply chains', status: 'PENDING' }, { type: 'POSITION', label: 'Evaluate security and resilience opportunities', status: 'PENDING' }] } }); }
  };

  TechnologyBrain.prototype.resolveDeepContent = function () {
    var self = this; var resolver = window.LIMENPortalContentResolver; if (!resolver) return Promise.resolve();
    return resolver.resolveForBrain(this.state).then(function (content) { self.state.resolvedContent = content; if (content) { var dt = []; for (var dxId in content.byDiagnosis) { var dxC = content.byDiagnosis[dxId]; for (var i = 0; i < dxC.treatments.length; i++) { var t = dxC.treatments[i]; dt.push({ id: 'deep_' + t.nodeId + '_' + i, label: t.label, type: t.type, evidence: t.evidence, description: t.description, cite: t.cite, steps: t.steps, monitoring: t.monitoring, escalation: t.escalation, diagnosisId: dxId, nodeId: t.nodeId, nodeLabel: t.nodeLabel, hasDepth: t.hasDepth, source: 'canonical_deep' }); } } if (dt.length > 0) self.state.treatments = dt; } }).catch(function () {});
  };

  var _origCycle = TechnologyBrain.prototype.cycle;
  TechnologyBrain.prototype.cycle = function () {
    var self = this;
    return _origCycle.call(this).then(function () {
      return self.resolveDeepContent();
    }).then(function () {
      // Higher cognition: predictive self-model + metacognition (runs AFTER diagnoses settle)
      try { self._updateTechnologyModel(); } catch (e) {}
    });
  };

  // ══════════════════════════════════════════════════════════════════════
  // HIGHER COGNITION — predictive self-model + metacognition (technology).
  // Generic predictive-coding substrate (prior → observe → prediction error →
  // regulation → update prior) + awareness / conscience / immune / intuition /
  // simulation / executive-report. Mirrors culture/infrastructure STRUCTURE exactly;
  // only the CONTENT is technological (semiconductors & compute, AI/ML, software &
  // cloud, hardware & devices, cybersecurity, R&D & innovation pipelines, platform
  // networks, data infrastructure).
  // ══════════════════════════════════════════════════════════════════════
  var TM_VERSION = 1;
  var TM_LEARNING_RATE = 0.25;
  var TM_SLOW_RATE = 0.08;
  var TM_STRESS_FLOOR = 0.30;
  var TM_FLOOD_CAP = 12;
  var TM_STALE_MS = 1000 * 60 * 60 * 6;
  var TK_OUTCOME_BUFFER = 40;     // K4: rolling predicted-vs-realized stress samples
  var TK_HOMEO_WINDOW = 60;       // K8: cycles of stress baseline for the adaptive set-point
  var _tmClamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  var _tmJaccardDistance = function (a, b) {
    a = a || []; b = b || [];
    if (!a.length && !b.length) return 0;
    var sa = {}, inter = 0;
    a.forEach(function (x) { sa[x] = 1; });
    b.forEach(function (x) { if (sa[x]) inter++; });
    var uni = a.length + b.length - inter;
    return uni ? 1 - inter / uni : 0;
  };

  (function () {
    var P = TechnologyBrain.prototype;

    // Technology diagnosis families — an analogy lens for monitoring, NOT evidence.
    var FAMILY = {
      'cyber': ['CYBER_ATTACK', 'DATA_BREACH'],
      'ai': ['AI_ALIGNMENT_FAILURE', 'PLATFORM_MONOPOLY'],
      'supply': ['CHIP_SHORTAGE', 'INFRASTRUCTURE_COLLAPSE'],
      'platform': ['PLATFORM_MONOPOLY', 'CYBER_ATTACK'],
      'infrastructure': ['INFRASTRUCTURE_COLLAPSE', 'CHIP_SHORTAGE']
    };

    P._neutralTechnologyModel = function () {
      return { version: TM_VERSION, cycle: 0, prior: { expectedStress: 0.5, expectedDiagnoses: [], expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, confidence: 0, samples: 0 }, observation: null, predictionError: null, predictedStress: null, regulation: null, plasticity: { learningRate: TM_LEARNING_RATE, slowRate: TM_SLOW_RATE, consolidation: 0 }, readyForHandoff: false, _lowErrorStreak: 0, updated: 0 };
    };
    P._buildTechnologyObservation = function () {
      var s = this.state || {};
      var active = (s.diagnoses || []).filter(function (d) { return d.active; });
      // signal = breadth of live tech feeds (CVE/CISA/arxiv/patent/security activity)
      var feeds = s.feeds || [], fc = 0, newest = 0;
      if (Array.isArray(feeds)) {
        for (var i = 0; i < feeds.length; i++) { var fv = feeds[i]; if (fv) { fc++; var u = fv.updated; if (u && u > newest) newest = u; } }
      } else { for (var k in feeds) { if (feeds.hasOwnProperty(k)) { fc++; var u2 = feeds[k] && feeds[k].updated; if (u2 && u2 > newest) newest = u2; } } }
      // companyCount = TECH ENTITIES (semiconductor/cloud/software/cyber/AI firms)
      var companyCount = (s.companies || []).length;
      return { stress: typeof s.stress === 'number' ? s.stress : 0, phase: s.phase || null, activeDiagnoses: active.map(function (d) { return d.id; }).sort(), diagnosisCount: active.length, opportunityCount: (s.opportunities || []).length, companyCount: companyCount, signal: Math.min(1, fc / 8), feedNewest: newest, timestamp: Date.now() };
    };
    P._computeTechnologyPredictionError = function (prior, obs) {
      var se = Math.abs(obs.stress - prior.expectedStress), sg = Math.abs(obs.signal - prior.expectedSignal), de = _tmJaccardDistance(obs.activeDiagnoses, prior.expectedDiagnoses);
      var od = Math.max(1, prior.expectedOpportunityCount, obs.opportunityCount), oe = Math.abs(obs.opportunityCount - prior.expectedOpportunityCount) / od;
      var total = _tmClamp(0.4 * se + 0.2 * sg + 0.25 * de + 0.15 * oe, 0, 1);
      return { total: total, stressError: se, signalError: sg, diagnosisError: de, opportunityError: oe, novelty: Math.max(se, de) };
    };
    P._updateTechnologyPrior = function (prior, obs, lr) {
      return { expectedStress: _tmClamp(prior.expectedStress + lr * (obs.stress - prior.expectedStress), 0, 1), expectedDiagnoses: obs.activeDiagnoses.slice(), expectedDiagnosisCount: prior.expectedDiagnosisCount + lr * (obs.diagnosisCount - prior.expectedDiagnosisCount), expectedOpportunityCount: prior.expectedOpportunityCount + lr * (obs.opportunityCount - prior.expectedOpportunityCount), expectedSignal: _tmClamp(prior.expectedSignal + lr * (obs.signal - prior.expectedSignal), 0, 1), confidence: _tmClamp(Math.min(1, (prior.samples + 1) / 20), 0, 1), samples: prior.samples + 1 };
    };
    P._computeTechnologyRegulation = function (cm, obs, pe) {
      var gain = _tmClamp(pe.novelty, 0.05, 0.95), inhib = _tmClamp(1 - pe.novelty, 0, 0.9);
      var starving = obs.stress >= TM_STRESS_FLOOR && obs.opportunityCount === 0, flooding = obs.opportunityCount > TM_FLOOD_CAP;
      var streak = (pe.total < 0.05) ? (cm._lowErrorStreak || 0) + 1 : 0; cm._lowErrorStreak = streak; var looping = streak >= 3;
      var stale = obs.feedNewest > 0 ? (Date.now() - obs.feedNewest) > TM_STALE_MS : false;
      var overconf = cm.prior.confidence > 0.8 && pe.total > 0.4;
      var label = flooding ? 'flooding' : starving ? 'starving' : stale ? 'stale' : looping ? 'looping' : overconf ? 'overconfident' : pe.novelty > 0.4 ? 'surprised' : 'calm';
      return { gain: gain, inhibition: inhib, starving: starving, flooding: flooding, looping: looping, stale: stale, overconfident: overconf, state: label };
    };

    // ── RECURRENT STEP — the proof surface (state.technologyModel) the Civilization cockpit reads ──
    P._updateTechnologyModel = function () {
      var cm = this.state.technologyModel || this._neutralTechnologyModel();
      var priorIn = cm.prior;
      var obs = this._buildTechnologyObservation();
      var pe = this._computeTechnologyPredictionError(priorIn, obs);
      var gainBlend = _tmClamp(pe.novelty, 0.05, 0.95);
      var predictedStress = priorIn.expectedStress * (1 - gainBlend) + obs.stress * gainBlend;
      var reg = this._computeTechnologyRegulation(cm, obs, pe);
      var readyForHandoff = (cm.cycle > 0) && (predictedStress >= TM_STRESS_FLOOR) && (obs.diagnosisCount > 0) && !reg.flooding && !reg.stale;
      // K4 CREDIT ASSIGNMENT — PHASE-TRANSITION REWARD preempt (VALIDATED P3/P7 ONLY). A realized phase
      // transition whose direction matched the prediction is a real ground-truth teaching signal (thing2
      // "goes through time"). GATED: honored as ground-truth only when the transition involves a Thing1-
      // validated phase (P3/P7); elsewhere it is advisory-self-consistency and NEVER touches the learning
      // rate, so no validated signal is fabricated. Reads the PRIOR cycle's phase dynamics (one-cycle lag).
      // Reversible via _actuation.phase. Falls back to the fixed plasticity rate (unchanged behavior).
      var _lr = cm.plasticity.learningRate;
      var _pt = (this.state.technologyPhaseDynamics || {}).transition;
      var _phaseReward = !!(this._actuation && this._actuation.phase && _pt && _pt.validated && _pt.hit !== null);
      if (_phaseReward) { var _hit = _pt.hit ? 1 : 0; _lr = _tmClamp(_lr * (1 + (1 - _hit)), TM_SLOW_RATE, 0.6); }
      cm._creditSource = _phaseReward ? 'phase-transition' : 'fixed-plasticity';
      cm._effectiveLearningRate = _lr;
      var nextPrior = this._updateTechnologyPrior(priorIn, obs, _lr);
      cm.cycle += 1; cm.observation = obs; cm.predictionError = pe; cm.predictedStress = predictedStress; cm.regulation = reg; cm.readyForHandoff = readyForHandoff; cm.prior = nextPrior; cm.updated = obs.timestamp;
      this.state.technologyModel = cm;

      var mem = this.state.memory || (this.state.memory = {});
      var log = mem.outcomeLog || (mem.outcomeLog = []);
      log.push({ cycle: cm.cycle, predictionError: Math.round(pe.total * 1000) / 1000, stress: obs.stress, activeDx: obs.diagnosisCount, regulation: reg.state, timestamp: obs.timestamp }); if (log.length > 40) log.shift();

      try { this._computeTechnologyHigherLayers(); } catch (e) {}

      // INNOVATION — R&D / compute-capacity sub-portal layer (additive; BEFORE the DDP build
      // so the primary packet's promptView advertises it). Never touches the validated spine.
      try { this._buildTechnologyInnovationLayer(); } catch (e) {}

      // DDP — build the DomainDiagnosisPacket (8-section contract) for the primary diagnosis,
      // and one per diagnosis. Schema-only: never invents data. Consumed by the Civilization cockpit.
      try {
        var _diags = this.state.diagnoses || [];
        var _primary = _diags.filter(function (d) { return d.active; })[0] || _diags[0] || null;
        var _self = this;
        cm.domainDiagnosisPacket = this._buildDomainDiagnosisPacket(_primary);
        this.state.technologyDomainDiagnosisPackets = _diags.map(function (d) { return _self._buildDomainDiagnosisPacket(d); });
      } catch (e) {}

      // ── K1..K8 NEURO LOOP STACK (ported from energy-brain; technology's own state/edges) ──
      // Runs the eight closed-loop layers in Energy's exact order, BEFORE the servo so K8's
      // adaptive set-point / deviationFromBaseline is fresh for the actuation layer. 100%
      // deterministic — no paid-AI / LLM / network on the cycle. Advisory by design (K1 is the
      // one genuinely closed loop; the rest expose observe-only surfaces). Guarded; never throws
      // into the scoring spine.
      try { this._computeTechnologyNeuroLayers(); } catch (e) {}

      // ── ACTUATION LAYER (deterministic, per-actuation validity-gated; reversible via this._actuation) ──
      // Order mirrors Energy: servo (regulate-to-target) → phase dynamics (router + reward for NEXT
      // cycle's K4) → regulation advisories (E/I balance + XIV self-audit, observe-only). Each guarded;
      // never throws into the scoring spine. Servo/phaseDynamics feed the PRIOR-cycle reads in
      // surfaceOpportunities + the K4 credit hook above (one-cycle lag, recurrent by design).
      // THING2 KERNEL PHASE — push this cycle's primary scalar (STRESS) to the persistent
      // series and derive the interpretive P0-P10 posture from the REAL recursive kernel.
      // Runs BEFORE phase dynamics so the router + transition reward read the kernel phase.
      // Pure math (no network/AI); guarded; on any failure _kernelPhase stays null and the
      // phase dynamics fall back to the naive/static PHASE_M source unchanged.
      try { this._updateTechnologyPhaseKernel(); } catch (e) {}
      try { if (this._actuation && this._actuation.servo) this._computeTechnologyServo(); } catch (e) {}
      try { if (this._actuation && this._actuation.phase) this._computeTechnologyPhaseDynamics(); } catch (e) {}
      try { this._computeTechnologyRegulationAdvisories(); } catch (e) {}

      // state.cognition — generic surface domain-console-brain.js reads for ANY brain.
      this.state.cognition = {
        domain: 'technology',
        technologyModel: cm,
        model: { cycle: cm.cycle, predictionError: cm.predictionError, predictedStress: cm.predictedStress, regulation: cm.regulation },
        technologyImmune: this.state.technologyImmune || null,
        technologyAwareness: this.state.technologyAwareness || null,
        technologyConscience: this.state.technologyConscience || null,
        technologyIntuition: this.state.technologyIntuition || null,
        technologySimulation: this.state.technologySimulation || null,
        technologyExecutiveReport: this.state.technologyExecutiveReport || null,
        awareness: this.state.technologyAwareness || null,
        conscience: this.state.technologyConscience || null,
        immune: this.state.technologyImmune || null,
        intuition: this.state.technologyIntuition || null,
        innovationLayer: this.state.innovationLayer || null,
        servo: this.state.technologyServo || null,
        eiBrake: this.state.technologyEIBrake || null,
        phaseDynamics: this.state.technologyPhaseDynamics || null,
        regulationAdvisories: this.state.technologyRegulationAdvisories || null,
        neuro: this.state.technologyNeuro || null,
        actuation: this._actuation || null,
        treatments: this.state.treatments || [],
        diagnoses: this.state.diagnoses || [],
        opportunities: this.state.opportunities || []
      };
      return cm;
    };

    P._computeTechnologyHigherLayers = function () {
      this._computeTechnologyImmune(); this._computeTechnologyAwareness(); this._computeTechnologyConscience(); this._computeTechnologyIntuition();
      try { this._computeTechnologySimulation(); } catch (e) {}
      try { this._computeTechnologyExecutiveReport(); } catch (e) {}
    };

    // ── H1 — immune (antigen scan over bundle/feed/regulation state) ──
    P._computeTechnologyImmune = function () {
      var s = this.state, cm = s.technologyModel || {}, reg = cm.regulation || {}, ant = [];
      var bs = (typeof this._technologyBundleStates === 'function') ? this._technologyBundleStates() : [];
      bs.forEach(function (b) {
        if (b.bundleStatus === 'missing') ant.push({ type: 'source-bundle-missing', dx: b.dxId, severity: 'medium', action: 'block-from-prompt-evidence' });
        if (b.buildMethod === 'external-source-authored') ant.push({ type: 'external-source-authored-needs-human-verification', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
        if (b.aliasRisk === 'medium' || b.aliasRisk === 'high') ant.push({ type: 'alias-risk-bundle', dx: b.dxId, severity: b.aliasRisk, action: 'allow-with-warning' });
        if (b.bundleStatus === 'found' && b.shallow) ant.push({ type: 'root-only-shallow-bundle', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
      });
      var pe = (cm.predictionError && cm.predictionError.total) || 0;
      if (pe > 0.4) ant.push({ type: 'prediction-error-spike', severity: 'medium', action: 'lower-confidence', value: Math.round(pe * 1000) / 1000 });
      if (reg.stale) ant.push({ type: 'stale-feeds', severity: 'low', action: 'flag' });
      if (reg.flooding) ant.push({ type: 'opportunity-flood', severity: 'medium', action: 'inhibit' });
      if (reg.starving) ant.push({ type: 'stress-without-opportunity', severity: 'low', action: 'flag' });
      var _l1 = s._l1DepthCache;
      if (_l1 && _l1.byDiagnosis && Object.keys(_l1.byDiagnosis).some(function (dx) { return _l1.byDiagnosis[dx].madLibTreatments > 0; })) {
        ant.push({ type: 'l1-synthetic-treatments', severity: 'medium', action: 'quarantine', note: 'L1 portal treatments are mad-lib templates (fixed-verb family); quarantined from evidence — only real chip/cloud/cyber/AI tickers surfaced relevance-unverified' });
      }
      var sev = ant.some(function (a) { return a.severity === 'high'; }) ? 'high' : ant.some(function (a) { return a.severity === 'medium'; }) ? 'medium' : ant.length ? 'low' : 'none';
      s.technologyImmune = {
        version: 1, immuneState: sev === 'high' ? 'alert' : sev === 'medium' ? 'active' : sev === 'low' ? 'watch' : 'clear', severity: sev,
        antigens: ant.slice(0, 12),
        quarantines: ['L1-portal-treatments-madlib'],
        allowedWithWarning: ant.filter(function (a) { return a.action === 'allow-with-warning'; }).map(function (a) { return a.type + (a.dx ? (':' + a.dx) : ''); }),
        blockedFromPrompt: ant.filter(function (a) { return a.action === 'block-from-prompt-evidence'; }).map(function (a) { return a.dx; }),
        blockedFromTraversal: ['L2'],
        lastScanAt: cm.updated || null
      };
      return s.technologyImmune;
    };
    // ── H2 — awareness (narrative on cyber / AI-alignment / supply pressure) ──
    P._computeTechnologyAwareness = function () {
      var s = this.state, cm = s.technologyModel || {}, im = s.technologyImmune || {}, active = (s.diagnoses || []).filter(function (d) { return d.active; });
      var pe = (cm.predictionError && cm.predictionError.total) || 0, dxNames = active.map(function (d) { return d.label || d.id; });
      s.technologyAwareness = {
        version: 1, selfState: im.immuneState === 'alert' ? 'guarded' : (cm.regulation && cm.regulation.state) || 'unknown',
        knowns: dxNames.slice(0, 6),
        uncertainties: ['interpretive tracker — diagnoses are signal-driven readings of cyber/AI/supply pressure, not validated', 'predictionError=' + (Math.round(pe * 1000) / 1000)],
        confidenceDrivers: ['regulation ' + ((cm.regulation && cm.regulation.state) || '?'), active.length + ' active dx'],
        selfNarrative: 'Technology: ' + active.length + ' active diagnosis pathway' + (active.length !== 1 ? 's' : '') + ' (' + (dxNames.slice(0, 3).join(', ') || 'none') + '), regulation=' + ((cm.regulation && cm.regulation.state) || '?') + ', immune=' + (im.immuneState || '?') + ', prediction-error ' + (Math.round(pe * 100) / 100) + '.',
        lastAwarenessAt: cm.updated || null
      };
      return s.technologyAwareness;
    };
    // ── H3 — conscience (artifact readiness; TECH does INVESTABLE/RESEARCHABLE only — no patent/grant
    //    per 2026 rules; PLUS a dual-use export-control veto on CYBER diagnoses) ──
    P._computeTechnologyConscience = function () {
      var s = this.state, cm = s.technologyModel || {}, pe = (cm.predictionError && cm.predictionError.total) || 0, cautions = [];
      var active = (s.diagnoses || []).filter(function (d) { return d.active; });
      var cyberActive = active.some(function (d) { return d.id === 'CYBER_ATTACK' || d.id === 'DATA_BREACH'; });
      var im = s.technologyImmune || {};
      if (pe > 0.4) cautions.push({ claim: 'high-confidence-claim', reason: 'predictionError spike ' + (Math.round(pe * 1000) / 1000) });
      if (cm.regulation && cm.regulation.starving) cautions.push({ claim: 'opportunity-claim', reason: 'stress without grounded opportunity (starving)' });
      var conscienceState = (im.immuneState === 'alert' || (cyberActive && pe > 0.4)) ? 'restrictive' : (cyberActive || pe > 0.25) ? 'cautious' : 'open';
      var vetoes = [{ claim: 'patent/grant', reason: 'patent/grant lanes retired across all domains (2026-06-21); technology surfaces source-grounded briefs, not filings' }];
      if (cyberActive) vetoes.push({ claim: 'dual-use-export', reason: 'CYBER diagnosis active — dual-use export-control risk (GPUs for AI training, high-speed networking, encryption, quantum-resistant crypto); no export-restricted claims' });
      var blockedClaims = ['patent-claim', 'grant-claim'];
      if (cyberActive) blockedClaims.push('export-restricted');
      s.technologyConscience = {
        version: 1, conscienceState: conscienceState,
        vetoes: vetoes, cautions: cautions.slice(0, 8),
        allowedClaims: ['source-summary', 'technology-brief-with-warnings'],
        blockedClaims: blockedClaims,
        artifactReadinessDecision: { patentReady: false, grantReady: false, investmentReady: true, researchReady: true, exportReady: !cyberActive, note: 'patent/grant vetoed; investment/research allowed-with-warning; export-restricted claims vetoed while a CYBER diagnosis is active' },
        reasons: ['overclaim prevention', 'interpretive-not-validated', 'dual-use conscientiousness'],
        lastCheckAt: cm.updated || null
      };
      return s.technologyConscience;
    };
    // ── H4 — intuition (hunches on emerging tech trends / virality patterns) ──
    P._computeTechnologyIntuition = function () {
      var s = this.state, cm = s.technologyModel || {}, reg = cm.regulation || {}, log = (s.memory && s.memory.outcomeLog) || [], hunches = [];
      if (log.length >= 2) { var a = log[log.length - 2].predictionError, b = log[log.length - 1].predictionError; if (typeof a === 'number' && typeof b === 'number' && b - a > 0.05) hunches.push({ hunch: 'emerging tech regime shift (prediction error rising) — novel exploit or LLM instability entering feeds', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'predictionError rose ' + a + ' → ' + b }); }
      if (reg.state === 'surprised') hunches.push({ hunch: 'novel tech stressor entering the feed (zero-day, model release, chip-roadmap break)', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'regulation = surprised' });
      var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
      var primaryId = (active[0] || {}).id, analogies = [];
      Object.keys(FAMILY).forEach(function (fam) { if (FAMILY[fam].indexOf(primaryId) >= 0) { FAMILY[fam].forEach(function (sib) { if (sib !== primaryId) analogies.push({ analogy: primaryId + ' resembles ' + sib, family: fam, evidenceStatus: 'UNVERIFIED' }); }); } });
      s.technologyIntuition = { version: 1, hunches: hunches.slice(0, 6), analogies: analogies.slice(0, 6), lastAt: cm.updated || null };
      return s.technologyIntuition;
    };
    // ── H5 — bounded counterfactual simulation (hypothetical only; UNVERIFIED) ──
    P._computeTechnologySimulation = function () {
      var s = this.state, cm = s.technologyModel || {};
      var base = typeof s.stress === 'number' ? s.stress : 0;
      function cl(v) { return Math.max(0, Math.min(1, Math.round(v * 1000) / 1000)); }
      var scenarios = [
        { type: 'unsafe_model_release', hypothetical: true, assumption: 'a major LLM vendor ships an unsafe / jailbreak-prone frontier model', simulatedStress: cl(base + 0.25), risk: 'AI alignment failure / misuse cascade (AI_ALIGNMENT_FAILURE)', intervention: 'red-team + alignment-eval pressure / staged rollout monitoring', falsifier: 'independent safety evals pass and no real-world misuse surge follows' },
        { type: 'zero_day_gpu_exploit', hypothetical: true, assumption: 'a zero-day GPU / accelerator exploit saturates compute fabric', simulatedStress: cl(base + 0.3), risk: 'cyber attack + infrastructure collapse (CYBER_ATTACK / INFRASTRUCTURE_COLLAPSE)', intervention: 'firmware patch cadence / compute-segmentation / zero-trust', falsifier: 'patch deploys before exploitation and no datacenter-wide outage occurs' },
        { type: 'taiwan_collapse', hypothetical: true, assumption: 'leading-edge Taiwan fab production halts (geopolitical or disaster)', simulatedStress: cl(base + 0.35), risk: 'chip shortage cascade (CHIP_SHORTAGE)', intervention: 'onshoring / supply diversification / inventory hedging', falsifier: 'alternate foundry capacity and inventory absorb the shock' },
        { type: 'mass_data_breach', hypothetical: true, assumption: 'a platform-scale credential / data exfiltration event', simulatedStress: cl(base + 0.25), risk: 'data breach / privacy exposure (DATA_BREACH)', intervention: 'credential rotation / identity verification / breach disclosure', falsifier: 'breach contained, no downstream credential reuse detected' },
        { type: 'platform_dominance', hypothetical: true, assumption: 'one platform/cloud captures dominant developer + compute share', simulatedStress: cl(base + 0.2), risk: 'platform monopoly / lock-in (PLATFORM_MONOPOLY)', intervention: 'interoperability / open-source alternatives / antitrust signal', falsifier: 'multiple viable platforms and migration paths persist' },
        { type: 'cloud_region_cascade', hypothetical: true, assumption: 'a hyperscaler region failure cascades across dependent services', simulatedStress: cl(base + 0.3), risk: 'infrastructure collapse / dependency failure (INFRASTRUCTURE_COLLAPSE)', intervention: 'multi-region redundancy / dependency mapping', falsifier: 'failover holds and dependent services degrade gracefully' }
      ];
      var sim = {
        version: 1, scenarios: scenarios, assumptions: scenarios.map(function (x) { return x.assumption; }),
        simulatedStress: scenarios.map(function (x) { return x.simulatedStress; }),
        simulatedDiagnoses: ['CYBER_ATTACK', 'AI_ALIGNMENT_FAILURE', 'CHIP_SHORTAGE', 'INFRASTRUCTURE_COLLAPSE'], simulatedOpportunities: [],
        risks: scenarios.map(function (x) { return x.risk; }), interventions: scenarios.map(function (x) { return x.intervention; }),
        falsifiers: scenarios.map(function (x) { return x.falsifier; }), lastSimulatedAt: cm.updated || null
      };
      s.technologySimulation = sim; return sim;
    };
    // ── H6 — executive self-report (compact status card) ──
    P._computeTechnologyExecutiveReport = function () {
      var s = this.state, cm = s.technologyModel || {}, im = s.technologyImmune || {}, aw = s.technologyAwareness || {}, con = s.technologyConscience || {}, it = s.technologyIntuition || {}, sim = s.technologySimulation || {};
      var bs = (typeof this._technologyBundleStates === 'function') ? this._technologyBundleStates() : [];
      var covered = bs.filter(function (b) { return b.bundleStatus === 'found'; }).length;
      var hv = bs.filter(function (b) { return b.humanVerification === 'required'; }).length;
      var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
      var strongest = active[0] || (s.diagnoses || [])[0] || null;
      var pe = (cm.predictionError && cm.predictionError.total) || 0;
      var status = im.immuneState === 'alert' ? 'immune-alert' : hv > 0 ? 'human-review-required' : (bs.length && covered < bs.length) ? 'source-limited' : (cm.regulation && cm.regulation.starving) ? 'starving' : (cm.regulation && cm.regulation.state === 'surprised') ? 'surprised' : 'healthy';
      var rep = {
        version: 1, brainStatus: status,
        strongestDiagnosis: strongest ? strongest.id : null,
        strongestOpportunity: (s.opportunities && s.opportunities[0] && s.opportunities[0].title) || null,
        confidence: Math.round((1 - pe) * 100) / 100, predictionError: Math.round(pe * 1000) / 1000,
        regulationState: (cm.regulation && cm.regulation.state) || null, immuneState: im.immuneState || null,
        awarenessSummary: aw.selfNarrative || null, conscienceDecision: con.conscienceState || null,
        intuitionSummary: (it.hunches || []).length + ' hunch(es)', simulationSummary: (sim.scenarios || []).length + ' scenario(s)',
        artifactReadiness: con.artifactReadinessDecision || null, blockers: (con.blockedClaims || []).slice(0, 6),
        nextBestAction: (bs.length && covered < bs.length) ? 'build/verify source for uncovered diagnoses (ensure CYBER/AI/chip sources are current)' : hv > 0 ? 'human-verify external-source bundles' : 'monitor strongest diagnosis sources (CVE/CISA velocity, AI-alignment hunches, chip-roadmap signals)',
        lastReportAt: cm.updated || null
      };
      s.technologyExecutiveReport = rep; return rep;
    };

    // ══════════════════════════════════════════════════════════════════════════
    // ACTUATION METHODS (ported + adapted from energy-brain; technology's own signals)
    // ══════════════════════════════════════════════════════════════════════════

    // SERVO — closed-loop allostasis (Neuro Ref XIII.1/V.2/XII). sensor = excitatory drive vs the
    // live technologyModel.regulation.inhibition term; controller = PI (fast proportional + bounded
    // slow integral, the HPA fast+slow arms); effector = a proportional emission-confidence dampener
    // the E/I brake then applies. Deterministic; additive; affects ONLY emission confidence.
    P._computeTechnologyServo = function () {
      function R(x) { return Math.round(x * 1000) / 1000; }
      var s = this.state, cm = s.technologyModel || {}, reg = cm.regulation || {}, dn = s.domainNeuro || {}, hm = dn.homeostasis || {};
      // SENSOR: excitatory drive (stress + how many things fire at once) vs current inhibition
      var stress = (typeof s.stress === 'number') ? s.stress : 0;
      var conds = Array.isArray(s._activeConditions) ? s._activeConditions.length : (Array.isArray(s.signals) ? s.signals.length : 0);
      var dxA = Array.isArray(s.diagnoses) ? s.diagnoses.filter(function (d) { return d && d.active; }).length : 0;
      var drive = Math.max(0, Math.min(2, stress + Math.min(conds, 12) / 24 + Math.min(dxA, 6) / 24));
      var inhibition = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;   // real live term (1 - novelty)
      var FLOOR = 0.15;
      // TARGET (allostatic set-point): inhibition must track drive (E/I), rising with the generic
      // K-stack's adaptive-baseline deviation (Turrigiano scaling). deviation defaults 0 if absent.
      var deviation = Math.max(0, (typeof hm.deviation === 'number') ? hm.deviation : 0);
      var target = Math.max(FLOOR, Math.min(1, Math.max(drive, FLOOR + deviation)));
      var error = target - inhibition;                                              // >0 => under-braked for the drive
      // CONTROLLER: bounded integral (slow arm) + proportional (fast arm)
      this._servoIntegral = Math.max(-0.5, Math.min(0.5, (this._servoIntegral || 0) + error * 0.15));
      var Kp = 0.8, Ki = 0.4;
      var correction = Math.max(0, Kp * error + Ki * Math.max(0, this._servoIntegral));   // only ADD braking
      // EFFECTOR: proportional dampening of emission (the E/I brake consumes this)
      var emissionFactor = Math.max(0.2, Math.min(1, 1 - correction));
      var state = error > 0.25 ? 'runaway-risk' : ((inhibition - target) > 0.4 ? 'over-inhibited' : 'balanced');
      var servo = {
        version: 1, actuated: true, drive: R(drive), inhibition: R(inhibition), target: R(target),
        error: R(error), integral: R(this._servoIntegral), emissionFactor: R(emissionFactor),
        state: state, deviation: R(deviation),
        note: 'closed-loop allostasis: drives inhibition toward a drive+deviation target; effector = proportional emission dampening. Neuro Ref XIII.1/V.2/XII.'
      };
      s.technologyServo = servo;
      return servo;
    };

    // E/I BRAKE — consumes the servo emissionFactor to dampen emitted opportunity CONFIDENCE
    // proportionally to the E/I imbalance (Neuro Ref XIII.1). Reversible via _actuation.eiBrake.
    P._applyTechnologyEIBrake = function (opps) {
      opps = opps || [];
      if (!(this._actuation && this._actuation.eiBrake)) { this.state.technologyEIBrake = null; return opps; }
      var servo = this.state.technologyServo;
      if (!servo || typeof servo.emissionFactor !== 'number') { this.state.technologyEIBrake = null; return opps; }
      var f = servo.emissionFactor;
      var applied = f < 1;
      this.state.technologyEIBrake = {
        version: 1, eiFactor: Math.round(f * 1000) / 1000, servoState: servo.state, applied: applied,
        note: 'E/I brake (Neuro Ref XIII.1): emission confidence dampened proportionally when inhibition lags drive (servo state ' + servo.state + '). Reversible via _actuation.eiBrake.'
      };
      if (applied) {
        for (var i = 0; i < opps.length; i++) {
          if (typeof opps[i].confidence === 'number') opps[i].confidence = Math.round(opps[i].confidence * f);
          opps[i].eiDampened = true;
        }
      }
      return opps;
    };

    // PHASE-COHERENCE ROUTER + PHASE-TRANSITION REWARD (patent Section 3.4 Loop-1 M matrix; thing2
    // lineage). (A) couples to co-phased, stressed peer domains; (B) scores a realized phase
    // transition — treated as GROUND-TRUTH only on P3/P7-involving transitions (Thing1-validated),
    // else advisory-self-consistency. Deterministic; no AI; no writes to technology.json.
    // ── THING2 RECURSIVE PHASE KERNEL — the phase SOURCE (2026-07-13) ──
    // Each cycle: push the domain's primary scalar (state.stress / finalStress / brainStress —
    // STRESS, up = worse) to a persistent 60-length series, then run the REAL Thing2 recursive
    // phase kernel via window.LIMENThing2.phaseOfSeries with positive:false. Pure math — no
    // network, no AI — so the 30s cycle stays deterministic. On any failure or when the kernel
    // is unavailable / short of history, this._kernelPhase stays null and phaseSource='fallback',
    // and the coherence router + phase-transition reward use the existing naive/static PHASE_M phase.
    P._updateTechnologyPhaseKernel = function () {
      var s = this.state || (this.state = {});
      var scalar = (typeof s.stress === 'number') ? s.stress
                 : (typeof s.finalStress === 'number') ? s.finalStress
                 : (typeof s.brainStress === 'number') ? s.brainStress : null;
      if (typeof scalar === 'number' && isFinite(scalar)) {
        if (!Array.isArray(this._phaseSeries)) this._phaseSeries = [];
        this._phaseSeries.push(scalar);
        while (this._phaseSeries.length > 60) this._phaseSeries.shift();  // cap 60, drop oldest
        try {
          if (typeof localStorage !== 'undefined' && localStorage) {
            localStorage.setItem('limen:phaseseries:technology', JSON.stringify(this._phaseSeries));
          }
        } catch (_e) {}
      }
      // Kernel phase (guarded). positive:false because the scalar is a STRESS metric (up = worse).
      this._kernelPhase = null;
      s.phaseSource = 'fallback';
      try {
        if (typeof window !== 'undefined' && window.LIMENThing2 &&
            Array.isArray(this._phaseSeries) && this._phaseSeries.length >= 8) {
          var _kp = window.LIMENThing2.phaseOfSeries(this._phaseSeries, { positive: false });
          if (_kp && _kp.phase) {
            this._kernelPhase = _kp.phase;
            s.kernelPhase = _kp.phase;
            s.kernelTrajectory = _kp.trajectory;
            s.kernelCAccum = _kp.cAccumulator;
            s.phaseSource = 'thing2-kernel';
          }
        }
      } catch (_e) { this._kernelPhase = null; s.phaseSource = 'fallback'; }
    };

    P._computeTechnologyPhaseDynamics = function () {
      var s = this.state, cm = s.technologyModel || {};
      var PHASE_M = {
        p3:  { p3: 0.08, p7a: 0.05, p9: 0.04, p0: -0.06 },
        p7a: { p7a: 0.10, p3: 0.04, p9: 0.06, p0: -0.08, p4: -0.04 },
        p7:  { p7: 0.10, p3: 0.04, p9: 0.06, p0: -0.08 },
        p4:  { p4: 0.05, p5: 0.04, p0: 0.03, p3: -0.04 },
        p6:  { p6: 0.06, p0: 0.04, p3: -0.05 },
        p9:  { p9: 0.08, p7a: 0.05, p0: -0.10, p4: -0.06 },
        p10: { p10: 0.06, p0: 0.05, p6: 0.03 }
      };
      var VALIDATED = { p3: 1, p7: 1, p7a: 1, p7b: 1 };            // Thing1 validates P3/P7 => ground-truth
      var BREAKING = { p1: 1, p3: 1, p7: 1, p7a: 1, p7b: 1, p9: 1 };  // recursion-arc BREAKING family
      function norm(p) { if (p == null) return null; p = String(p).toLowerCase().replace(/[^a-z0-9]/g, ''); if (p.charAt(0) !== 'p') p = 'p' + p; return p; }
      // PREFER the Thing2 recursive phase kernel; fall back to the existing naive/static s.phase.
      // myPhase drives BOTH (A) the coherence router and (B) the phase-transition reward below.
      var _phaseSource = (this._kernelPhase != null) ? 'thing2-kernel' : 'fallback';
      var myPhase = norm((this._kernelPhase != null) ? this._kernelPhase : s.phase);

      // (A) COHERENCE ROUTER — couple to co-phased, stressed domains
      var doms = (typeof window !== 'undefined' && window.LIMENDomains) || {};
      var coupled = [], couplingStrength = 0;
      if (myPhase && PHASE_M[myPhase]) {
        var row = PHASE_M[myPhase];
        Object.keys(doms).forEach(function (k) {
          if (k === 'technology') return;
          var d = doms[k] || {};
          var op = norm(d.brainPhase || d.phase || (d.brain && d.brain.phase));
          var st = (typeof d.brainStress === 'number') ? d.brainStress : (typeof d.stress === 'number' ? d.stress : 0);
          if (!op) return;
          var coh = (row[op] != null) ? row[op] : (op === myPhase ? 0.04 : 0);
          if (coh > 0 && st > 0.5) { coupled.push({ domain: k, phase: op, coherence: coh, stress: Math.round(st * 100) / 100 }); }
        });
        coupled.sort(function (a, b) { return (b.coherence * b.stress) - (a.coherence * a.stress); });
        couplingStrength = coupled.reduce(function (a, c) { return a + c.coherence * c.stress; }, 0);
      }

      // (B) PHASE-TRANSITION REWARD — did a predicted transition actually occur (through time)?
      var hist = this._techPhaseHist = this._techPhaseHist || [];
      var prev = hist.length ? hist[hist.length - 1].phase : null;
      var reward = null;
      if (prev != null && myPhase != null && prev !== myPhase) {
        var predictedUp = (typeof cm.predictedStress === 'number' && typeof s.stress === 'number') ? (cm.predictedStress > s.stress) : false;
        var wentUp = (BREAKING[myPhase] && !BREAKING[prev]) ? true : (BREAKING[prev] && !BREAKING[myPhase]) ? false : null;
        var hit = (wentUp !== null) ? (wentUp === !!predictedUp) : null;
        var validated = !!(VALIDATED[myPhase] || VALIDATED[prev]);
        reward = { from: prev, to: myPhase, predictedUp: !!predictedUp, wentUp: wentUp, hit: hit,
          validated: validated, kind: validated ? 'ground-truth (P3/P7 validated)' : 'advisory-self-consistency' };
      }
      hist.push({ phase: myPhase, t: (cm.updated) || Date.now() });
      if (hist.length > 24) hist.shift();

      var out = {
        version: 1, myPhase: myPhase, phaseSource: _phaseSource,
        coupled: coupled.slice(0, 5), couplingStrength: Math.round(couplingStrength * 1000) / 1000,
        transition: reward,
        note: 'phase source = ' + _phaseSource + ' (thing2 recursive kernel preferred, naive/static PHASE_M fallback); phase-coherence router (patent M matrix) + phase-transition reward (thing2 lineage; ground-truth only on P3/P7).'
      };
      s.technologyPhaseDynamics = out;
      return out;
    };

    // REGULATION ADVISORIES — E/I balance (XIII.1) + XIV connectivity/self-audit. OBSERVE-ONLY
    // (consumed for display, not actuated into the brake — the same honest boundary Energy holds).
    // technology.json carries 85 REAL edges, so the single-point-of-failure audit runs on a real
    // graph (lazily fetched once, degrade-safe). Deterministic; reuses the graph/state-generic
    // audit modules if present, else emits an honest "not loaded / loading" note.
    P._computeTechnologyRegulationAdvisories = function () {
      var s = this.state, out = { version: 1, observeOnly: true };
      // (1) E/I balance — is inhibition tracking drive?
      try {
        var EI = (typeof window !== 'undefined' && window.EnergyEIBalance) || null;
        if (EI && typeof EI.assessFromState === 'function') out.eiBalance = EI.assessFromState(s);
        else out.eiBalance = null;
      } catch (e) { out.eiBalance = null; }
      // (2) Self-audit — CONSUME the XIV connectivity / single-point-of-failure audit on the REAL
      // 85-edge technology graph. Edges live in technology.json (not the live snapshot); reuse the
      // cached portal if it carries them, else fetch once (fire-and-forget) and consume next cycle.
      try {
        var self = this;
        var edges = (s._portalCache && Array.isArray(s._portalCache.edges) && s._portalCache.edges) ||
                    (Array.isArray(s.edges) && s.edges) || this._technologyEdges || null;
        if (!edges) {
          if (typeof fetch === 'function' && !this._technologyEdgesPromise) {
            this._technologyEdgesPromise = fetch('/assets/data/domains/technology.json')
              .then(function (r) { return r.json(); })
              .then(function (j) { if (j && Array.isArray(j.edges)) self._technologyEdges = j.edges; })
              .catch(function () {});
          }
        }
        var CA = (typeof window !== 'undefined' && window.EnergyConnectivityAudit) || null;
        if (CA && edges && edges.length && typeof CA.singlePointsOfFailure === 'function') {
          var audit = CA.singlePointsOfFailure({ edges: edges });
          var spof = (audit && audit.articulationNodes) || [];
          out.selfAudit = { consumed: true, edgeCount: edges.length, spofCount: spof.length, spof: spof.slice(0, 5),
            verdict: (audit && audit.verdict) || null, topHubs: (audit && audit.topHubsByDegree) || [] };
        } else {
          out.selfAudit = { consumed: false, note: edges ? 'connectivity-audit not loaded' : 'edges loading (async, next cycle)' };
        }
      } catch (e) { out.selfAudit = { consumed: false, error: String(e && e.message || e).slice(0, 80) }; }
      s.technologyRegulationAdvisories = out;
      return out;
    };

    // ══════════════════════════════════════════════════════════════════════════
    // K1..K8 NEURO LOOP STACK (ported + adapted from energy-brain's K-stack)
    // ──────────────────────────────────────────────────────────────────────────
    // Each layer COMPUTES and EXPOSES its signal on state (mirroring Energy's
    // energyAfferent/energyGainControl/... surfaces) but reads THIS domain's own
    // state/edges. 100% DETERMINISTIC — no paid-AI / LLM / network on the cycle.
    // Advisory by default (honest per-loop notes name the one wire that would close
    // each into the scoring spine); the only genuinely CLOSED loop is K1 (the base
    // scoreStress already folds externalPressure into stress). K4 is TRUTH-BRAKE
    // self-consistency calibration, NOT an external/dopaminergic reward.
    // ══════════════════════════════════════════════════════════════════════════

    // K1 — afferent inter-brain integration. Surfaces received cross-domain pressure
    // and the stress delta it contributes. CLOSED: the base scoreStress folds
    // externalPressure into stress (universal integrate-and-fire); technology also
    // fires threshold conditions (supply_constraint/competitive_distortion) in
    // normalizeSignals off getExternalPressure.
    P._computeTechnologyAfferent = function () {
      var s = this.state, cm = s.technologyModel || {};
      var raw = this._externalSignals || [];
      var now = Date.now();
      var bySource = {}, active = 0;
      for (var i = 0; i < raw.length; i++) {
        var sig = raw[i];
        var age = now - (sig.receivedAt || now);
        var weight = age < 300000 ? 1 : Math.max(0, 1 - (age - 300000) / 600000);
        if (weight <= 0) continue;
        active++;
        var k = sig.source || 'unknown';
        if (!bySource[k]) bySource[k] = { source: k, signals: [], weightedMagnitude: 0 };
        bySource[k].signals.push(sig.signal);
        bySource[k].weightedMagnitude += (sig.magnitude || 0) * weight;
      }
      var pressure = (typeof this.getExternalPressure === 'function') ? this.getExternalPressure() : 0;
      var contributors = Object.keys(bySource).map(function (kk) { return bySource[kk]; })
        .sort(function (a, b) { return b.weightedMagnitude - a.weightedMagnitude; });
      var af = {
        version: 1,
        externalPressure: Math.round(pressure * 1000) / 1000,        // base-capped at 0.3
        receivedSignalCount: raw.length,
        activeSignalCount: active,
        contributors: contributors.slice(0, 6),
        integrated: true,                                            // K1 CLOSED — folded into stress by the base scoreStress
        appliedStressDelta: Math.round(((s._externalPressureApplied) || 0) * 1000) / 1000,
        wouldRaiseStressBy: Math.round(pressure * 1000) / 1000,
        note: 'CLOSED: the base scoreStress adds externalPressure to stress each cycle (universal integrate-and-fire); technology also fires threshold conditions (supply_constraint/competitive_distortion) in normalizeSignals.',
        lastAfferentAt: cm.updated || now
      };
      s.technologyAfferent = af; return af;
    };

    // K2 — neuromodulatory gain application. technology's regulation computes gain +
    // inhibition; inhibition already reaches emission via the servo/E-I brake. This
    // surfaces the gain-scaled ranked OUTPUT-COUNT cut it implies (advisory; not
    // applied to the opportunity count — that wire would close it in surfaceOpportunities).
    P._computeTechnologyGainControl = function () {
      var s = this.state, cm = s.technologyModel || {}, reg = cm.regulation || {};
      var opps = s.opportunities || [];
      var inhib = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;
      // technology's _computeTechnologyRegulation carries no outputScale — derive the
      // advisory scale from inhibition with Energy's formula (clamped).
      var outputScale = (typeof reg.outputScale === 'number') ? reg.outputScale : _tmClamp(1 - inhib * 0.5, 0.4, 1);
      var wouldCapAt = Math.max(1, Math.round(opps.length * outputScale));
      var gc = {
        version: 1,
        gain: (typeof reg.gain === 'number') ? reg.gain : null,
        inhibition: (typeof reg.inhibition === 'number') ? reg.inhibition : null,
        outputScale: Math.round(outputScale * 1000) / 1000,
        currentOpportunityCount: opps.length,
        wouldCapOpportunitiesAt: wouldCapAt,                         // gain-scaled ranked cut (advisory)
        wouldSuppress: Math.max(0, opps.length - wouldCapAt),
        appliedTargets: ['emission confidence (servo emissionFactor + E/I brake, inhibition-driven)'],
        unappliedTargets: ['opportunity output count', 'stress', 'treatment surfacing'],
        shadow: true,
        note: 'ADVISORY: technology already dampens emission CONFIDENCE via the servo/E-I brake; the gain-scaled opportunity-COUNT cap shown here is not applied (would close in surfaceOpportunities).',
        lastGainAt: cm.updated || Date.now()
      };
      s.technologyGainControl = gc; return gc;
    };

    // K3 — slow consolidation / long-term plasticity. Maintains a PARALLEL slow-weight
    // track (TM_SLOW_RATE) that never touches technologyModel.prior; fast-vs-slow
    // divergence is a real regime-shift indicator.
    P._consolidateTechnologySlowModel = function () {
      var s = this.state, cm = s.technologyModel || {}, obs = cm.observation || null;
      var slow = s.technologySlowModel || {
        version: 1, cycle: 0,
        slow: { expectedStress: 0.5, expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, samples: 0 },
        rate: TM_SLOW_RATE, note: 'parallel slow-weight track (TM_SLOW_RATE); does NOT touch technologyModel.prior'
      };
      if (obs) {
        var r = TM_SLOW_RATE, w = slow.slow;
        w.expectedStress = _tmClamp(w.expectedStress + r * ((obs.stress || 0) - w.expectedStress), 0, 1);
        w.expectedSignal = _tmClamp(w.expectedSignal + r * ((obs.signal || 0) - w.expectedSignal), 0, 1);
        w.expectedDiagnosisCount = w.expectedDiagnosisCount + r * ((obs.diagnosisCount || 0) - w.expectedDiagnosisCount);
        w.expectedOpportunityCount = w.expectedOpportunityCount + r * ((obs.opportunityCount || 0) - w.expectedOpportunityCount);
        w.samples += 1;
        slow.cycle += 1;
      }
      var fast = (cm.prior && typeof cm.prior.expectedStress === 'number') ? cm.prior.expectedStress : 0.5;
      slow.fastSlowDivergence = Math.round(Math.abs(fast - slow.slow.expectedStress) * 1000) / 1000;
      slow.regimeShift = slow.fastSlowDivergence > 0.25;             // fast prior pulled far from slow baseline
      slow.updated = cm.updated || Date.now();
      s.technologySlowModel = slow; return slow;
    };

    // K4 — outcome / credit learning + TRUTH BRAKE. Compares each cycle's predictedStress
    // against the NEXT cycle's realized stress (online forward-prediction self-consistency).
    // NOT an external reward — technology has no ground-truth outcome label (ENERGY_NEURO_AUDIT
    // impossibility #4); the only validated learning signal is the P3/P7 phase-transition reward
    // gated in _updateTechnologyModel. This never fabricates a dopaminergic reward.
    P._scoreTechnologyOutcomes = function () {
      var s = this.state, cm = s.technologyModel || {};
      var buf = this._technologyOutcomeBuffer = this._technologyOutcomeBuffer || [];
      var obs = cm.observation || null;
      if (this._technologyPrevPrediction != null && obs && typeof obs.stress === 'number') {
        buf.push({ predicted: this._technologyPrevPrediction, realized: obs.stress, err: Math.abs(this._technologyPrevPrediction - obs.stress) });
        if (buf.length > TK_OUTCOME_BUFFER) buf.shift();
      }
      this._technologyPrevPrediction = (typeof cm.predictedStress === 'number') ? cm.predictedStress : null;   // stash for next-cycle reconciliation
      var n = buf.length, sumErr = 0, sumSq = 0, hits = 0;
      for (var i = 0; i < n; i++) { sumErr += buf[i].err; sumSq += buf[i].err * buf[i].err; if (buf[i].err <= 0.1) hits++; }
      var om = {
        version: 1,
        samples: n,
        meanRealizedError: n ? Math.round((sumErr / n) * 1000) / 1000 : null,     // does the forecast come true
        brierLike: n ? Math.round((sumSq / n) * 1000) / 1000 : null,
        hitRate: n ? Math.round((hits / n) * 100) / 100 : null,                    // fraction within 0.1 of realized
        loopType: 'online-continuous self-consistency (predicted-vs-next-realized stress); TRUTH-BRAKE calibration, NOT an external reward',
        creditAssignmentActive: (n >= 5),
        note: 'ADVISORY (self-consistency): measures whether technology\'s own stress forecast comes true. Separate from the P3/P7 phase-transition reward (the only validated learning signal). Never fabricates a dopaminergic reward.',
        lastOutcomeAt: cm.updated || Date.now()
      };
      s.technologyOutcomeModel = om; return om;
    };

    // K5 — deep hierarchical perception. Aggregates the depth the brain HAS (L1 real vs
    // mad-lib + the innovation sub-portal, no new fetches) and estimates the portalError
    // the recurrent model currently zeroes out.
    P._computeTechnologyPerceptionDepth = function () {
      var s = this.state, cm = s.technologyModel || {};
      var l1 = s._l1DepthCache || null;
      var innov = s.innovationLayer || null;
      var l1Real = 0, l1Mad = 0;
      if (l1 && l1.byDiagnosis) { Object.keys(l1.byDiagnosis).forEach(function (k) { l1Real += (l1.byDiagnosis[k].realTreatments || 0); l1Mad += (l1.byDiagnosis[k].madLibTreatments || 0); }); }
      var levels = [
        { level: 'L0', name: 'root', status: (this._portalCache || s._portalCache) ? 'loaded' : 'pending' },
        { level: 'L1', name: 'branch-scan', status: l1 ? 'scanned' : 'pending', realTreatments: l1Real, madLibTreatments: l1Mad },
        { level: 'L2', name: 'deep-cortex', status: 'quarantined', note: 'L1 treatments are mad-lib templates (immune-quarantined)' },
        { level: 'INNOV', name: 'innovation-subportal', status: (innov && innov.loaded) ? 'loaded' : 'absent', activeCount: (innov && innov.activeCount) || 0 }
      ];
      var loadedDepth = (innov && innov.loaded) ? 3 : (l1 ? 1 : 0);
      var admissible = l1Real + ((innov && innov.count) ? innov.count : 0);
      var blocked = l1Mad + 1;                                        // +1 for the quarantined L2 tier
      var portalErrorEstimate = Math.round((blocked / Math.max(1, admissible + blocked)) * 1000) / 1000;
      var pd = {
        version: 1, levels: levels, deepestUsableLevel: loadedDepth,
        portalErrorEstimate: portalErrorEstimate,
        note: 'ADVISORY: estimates the portalError the recurrent model zeroes. Perception stops at L1 (L2 quarantined); no new fetches. Would close by folding portalErrorEstimate into _computeTechnologyPredictionError.',
        lastDepthAt: cm.updated || Date.now()
      };
      s.technologyPerceptionDepth = pd; return pd;
    };

    // K6 — attention / selective routing. Ranks top-down salience (active + relevance +
    // prediction-error + operator attentionFocus boost) and names focus vs suppressed,
    // without gating the pipeline.
    P._computeTechnologyAttention = function () {
      var s = this.state, cm = s.technologyModel || {}, reg = cm.regulation || {};
      var pe = (cm.predictionError && cm.predictionError.total) || 0;
      var rb = this._readRequestBiases ? this._readRequestBiases() : { attentionFocus: [] };
      var focus = (rb.attentionFocus || []).map(function (f) { return String(f).toLowerCase(); });
      var scored = (s.diagnoses || []).map(function (d) {
        var sal = (d.active ? 0.5 : 0) + (d.relevance || 0) * 0.4 + pe * 0.1;
        var hay = (String(d.id) + ' ' + String(d.label || '')).toLowerCase();
        if (focus.some(function (f) { return f && hay.indexOf(f) !== -1; })) sal += 0.5;   // operator steer: attention focus boost
        return { id: d.id, active: !!d.active, salience: Math.round(sal * 1000) / 1000 };
      }).sort(function (a, b) { return b.salience - a.salience; });
      var at = {
        version: 1,
        driver: reg.state === 'surprised' ? 'novelty-driven (bottom-up)' : 'goal-driven (top-down)',
        focus: scored.slice(0, 3),
        suppressed: scored.slice(3).map(function (x) { return x.id; }).slice(0, 8),
        broadenUnderSurprise: reg.state === 'surprised',
        note: 'ADVISORY: top-down salience ranking with operator attentionFocus boost; names focus vs suppressed; does not yet gate surfaceOpportunities.',
        lastAttentionAt: cm.updated || Date.now()
      };
      s.technologyAttention = at; return at;
    };

    // K7 — lateral inhibition (microcircuit). Shows the winner-take-most ranking
    // reg.inhibition implies among competing active diagnoses (Neuro Ref XIII.2/X.1).
    P._computeTechnologyInhibition = function () {
      var s = this.state, cm = s.technologyModel || {}, reg = cm.regulation || {};
      var inhib = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;
      var active = (s.diagnoses || []).filter(function (d) { return d.active; })
        .sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
      var winner = active[0] || null;
      var li = {
        version: 1, inhibitionStrength: inhib,
        winner: winner ? winner.id : null,
        competitors: active.slice(1).map(function (d) { return { id: d.id, relevance: d.relevance, suppressBy: Math.round((d.relevance || 0) * inhib * 1000) / 1000 }; }).slice(0, 6),
        note: 'ADVISORY: winner-take-most lateral inhibition among competing active diagnoses; suppressBy shows the implied down-weight. Observe-only.',
        lastInhibitionAt: cm.updated || Date.now()
      };
      s.technologyInhibition = li; return li;
    };

    // K8 — adaptive homeostatic set-point (microcircuit). Maintains a Turrigiano-style
    // adaptive baseline (rolling stress mean) alongside the fixed TM_STRESS_FLOOR.
    // deviationFromBaseline is the same regulate-to-target error the servo consumes.
    P._computeTechnologyHomeostasis = function () {
      var s = this.state, cm = s.technologyModel || {};
      var win = ((s.memory && s.memory.stressHistory) || []).slice(-TK_HOMEO_WINDOW);
      var n = win.length, sum = 0;
      for (var i = 0; i < n; i++) sum += (win[i].stress || 0);
      var baseline = n ? sum / n : 0.5;                              // adaptive set-point vs fixed TM_STRESS_FLOOR
      var cur = (typeof s.stress === 'number') ? s.stress : 0;
      var scalingFactor = baseline > 0 ? Math.round((0.5 / Math.max(0.1, baseline)) * 1000) / 1000 : 1;
      var hm = {
        version: 1,
        fixedFloor: TM_STRESS_FLOOR,                                 // current hardcoded set-point
        adaptiveBaseline: Math.round(baseline * 1000) / 1000,
        currentStress: cur,
        deviationFromBaseline: Math.round((cur - baseline) * 1000) / 1000,
        scalingFactor: scalingFactor,                                // synaptic-scaling multiplier
        samples: n,
        note: 'ADVISORY: adaptive baseline (Turrigiano scaling) alongside the fixed TM_STRESS_FLOOR; deviationFromBaseline is the regulate-to-target error the servo reads.',
        lastHomeostasisAt: cm.updated || Date.now()
      };
      s.technologyHomeostasis = hm; return hm;
    };

    // Run all eight K-loops in Energy's order (K1..K8) and roll up a compact surface.
    // Deterministic; no AI; no network. Stores each layer on state (like technologyImmune/
    // technologyAwareness) and returns the roll-up for cognition.neuro.
    P._computeTechnologyNeuroLayers = function () {
      this._computeTechnologyAfferent();          // K1 — afferent inter-brain input
      this._computeTechnologyGainControl();       // K2 — neuromodulatory gain application
      this._consolidateTechnologySlowModel();     // K3 — slow consolidation / long-term plasticity
      this._scoreTechnologyOutcomes();            // K4 — outcome / credit learning (truth brake)
      this._computeTechnologyPerceptionDepth();   // K5 — deep hierarchical perception
      this._computeTechnologyAttention();         // K6 — attention / selective routing
      this._computeTechnologyInhibition();        // K7 — lateral inhibition (microcircuit)
      this._computeTechnologyHomeostasis();       // K8 — adaptive set-point (microcircuit)
      var s = this.state;
      var neuro = {
        version: 1,
        status: 'advisory',                        // K1 closed via base scoreStress; K2-K8 observe-only surfaces
        afferent: s.technologyAfferent || null,
        gainControl: s.technologyGainControl || null,
        slowModel: s.technologySlowModel || null,
        outcomeModel: s.technologyOutcomeModel || null,
        perceptionDepth: s.technologyPerceptionDepth || null,
        attention: s.technologyAttention || null,
        inhibition: s.technologyInhibition || null,
        homeostasis: s.technologyHomeostasis || null,
        loops: [
          'K1 afferent -> base scoreStress (externalPressure folded into stress) [CLOSED]',
          'K2 gain-control (advisory count-cap; confidence already dampened by servo/E-I brake)',
          'K3 slow consolidation (parallel slow-weight track; fast/slow divergence = regime shift)',
          'K4 outcome self-consistency / TRUTH BRAKE (predicted-vs-realized stress; not a reward)',
          'K5 perception depth + portalError estimate (advisory)',
          'K6 attention salience (advisory)',
          'K7 lateral inhibition winner-take-most (advisory)',
          'K8 adaptive set-point (deviationFromBaseline consumed by the servo)'
        ]
      };
      s.technologyNeuro = neuro;
      if (s.cognition && typeof s.cognition === 'object') s.cognition.neuro = neuro;   // additive: new key only
      return neuro;
    };
  })();

  // ════════════════════════════════════════════════════════════════════════════
  // TECHNOLOGY COGNITION PARITY — fallback loaders, source-bundle machinery, L1 mad-lib
  // scan, innovation-pipeline sub-portal layer, and the 8-section DomainDiagnosisPacket the
  // Civilization cockpit consumes. Mirrors culture/infrastructure STRUCTURE exactly; only the
  // CONTENT is technological (chips, AI/ML, software/cloud, hardware, cybersecurity, R&D).
  // Never fabricates evidence.
  // ════════════════════════════════════════════════════════════════════════════

  // ── DDP schema helpers ──
  var TECH_DDP_SCHEMA_VERSION = 'technology-ddp-1';
  function _techDdpPresent(v) {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (v === 'missing' || v === '' || v === 'none') return false;
    return true;
  }
  function _techDdpCompleteness(section, keys) {
    var have = 0; for (var i = 0; i < keys.length; i++) { if (_techDdpPresent(section[keys[i]])) have++; }
    return { have: have, total: keys.length, pct: keys.length ? Math.round(have / keys.length * 100) : 0 };
  }

  // ── Fallback: real entities from command-board-data (state.companies starved). One-shot. ──
  TechnologyBrain.prototype._loadTechnologyCommandBoardCompanies = function () {
    var self = this;
    if (self._cbTechnologyCompanies) return;            // one-shot
    self._cbTechnologyCompanies = [];
    try {
      fetch('/assets/data/command-board-data.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data) return;
          var arr = Array.isArray(data) ? data : (Object.keys(data).map(function (k) { return data[k]; }).find(Array.isArray) || []);
          self._cbTechnologyCompanies = arr
            .filter(function (x) { return x && x.d === 'technology' && x.t; })
            .map(function (x) { return { name: x.n, ticker: x.t, cik: x.c, phase: x.p, trajectory: x.tr }; });
          // Real-ticker fallback so opportunity discovery is grounded even if the board lacks
          // technology rows. These are the canonical tech entities (chips/cloud/cyber/AI).
          if (!self._cbTechnologyCompanies.length) {
            self._cbTechnologyCompanies = [
              { name: 'Apple', ticker: 'AAPL' }, { name: 'Microsoft', ticker: 'MSFT' }, { name: 'NVIDIA', ticker: 'NVDA' },
              { name: 'Alphabet', ticker: 'GOOGL' }, { name: 'Meta Platforms', ticker: 'META' }, { name: 'Amazon', ticker: 'AMZN' },
              { name: 'Broadcom', ticker: 'AVGO' }, { name: 'Oracle', ticker: 'ORCL' }, { name: 'Salesforce', ticker: 'CRM' },
              { name: 'Advanced Micro Devices', ticker: 'AMD' }, { name: 'Intel', ticker: 'INTC' }, { name: 'Taiwan Semiconductor', ticker: 'TSM' },
              { name: 'ASML', ticker: 'ASML' }, { name: 'Palantir', ticker: 'PLTR' }, { name: 'CrowdStrike', ticker: 'CRWD' }, { name: 'Palo Alto Networks', ticker: 'PANW' }
            ];
          }
        })
        .catch(function () {});
    } catch (e) {}
  };

  // ── Distress signals come ONLY from the validated Thing pipeline. One-shot. ──
  TechnologyBrain.prototype._loadTechnologyBrainSignals = function () {
    var self = this;
    if (self._pubSignals) return;                  // one-shot
    self._pubSignals = {};
    try {
      fetch('/api/brain-signals?domain=technology')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j || !j.publishable) return;
          var m = {};
          j.publishable.forEach(function (s) { if (s.ticker) m[s.ticker] = s; });
          self._pubSignals = m;                    // {} today (gate abstains on degenerate data)
        })
        .catch(function () {});
    } catch (e) {}
  };

  // ── Canonical diagnosis resolution. Prefers window.LIMENArtifactSourceIndex.aliases(),
  //    else TECHNOLOGY_DIAGNOSIS_ALIASES. Non-aliased diagnoses are canonical to themselves. ──
  var TECHNOLOGY_DIAGNOSIS_ALIASES = {
    CYBER_ATTACK:            { target: 'CYBER_ATTACK', reviewStatus: null, risk: 'low', note: 'canonical to self' },
    AI_ALIGNMENT_FAILURE:    { target: 'AI_MISALIGNMENT', reviewStatus: 'human-approved', risk: 'medium', note: 'mapped to ai-misalignment bundle; verify alignment-gap evidence is appropriate' },
    INFRASTRUCTURE_COLLAPSE: { target: 'INFRASTRUCTURE_COLLAPSE', reviewStatus: null, risk: 'low', note: 'canonical to self (digital-systems sense)' },
    DATA_BREACH:             { target: 'DATA_BREACH', reviewStatus: null, risk: 'low', note: 'canonical to self' },
    CHIP_SHORTAGE:           { target: 'SEMICONDUCTOR_SHORTAGE', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits SEMICONDUCTOR_SHORTAGE for component-scarcity / fab bottleneck' },
    PLATFORM_MONOPOLY:       { target: 'PLATFORM_MONOPOLY', reviewStatus: null, risk: 'low', note: 'canonical to self' }
  };
  TechnologyBrain.prototype._resolveTechnologyCanonicalDiagnosis = function (dxId) {
    if (!dxId) return { canonicalDiagnosisId: null, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };
    var target = null;
    try {
      var idx = (typeof window !== 'undefined') ? window.LIMENArtifactSourceIndex : null;
      if (idx && idx.aliases) { var row = idx.aliases()[dxId]; if (row && row.target) target = row.target; }
    } catch (e) {}
    var local = TECHNOLOGY_DIAGNOSIS_ALIASES[dxId] || null;
    if (!target && local) target = local.target;
    if (target && target !== dxId) {
      return { canonicalDiagnosisId: target, aliasUsed: true, aliasReviewStatus: (local && local.reviewStatus) || 'corpus-aliased', aliasRisk: (local && local.risk) || 'low', aliasNote: (local && local.note) || null };
    }
    return { canonicalDiagnosisId: (target || dxId), aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };   // canonical to self
  };

  // ── Load REAL source bundles (one-shot, async). Resolves aliases BEFORE fetching.
  //    Only files that exist resolve to 'found'; 404s -> 'missing'. Never fabricates. ──
  TechnologyBrain.prototype._loadTechnologyDiagnosisBundles = function () {
    var self = this;
    if (self._technologyBundleLoadPromise) return self._technologyBundleLoadPromise;
    self._bundleCache = self._bundleCache || {};
    self._bundleStatusMap = self._bundleStatusMap || {};
    var ids = {};
    var known = ['CYBER_ATTACK', 'AI_ALIGNMENT_FAILURE', 'INFRASTRUCTURE_COLLAPSE', 'DATA_BREACH', 'CHIP_SHORTAGE', 'PLATFORM_MONOPOLY'];
    var diags = (self.state && self.state.diagnoses) || [];
    var allDxIds = diags.map(function (d) { return d.id; }).concat(known);
    for (var i = 0; i < allDxIds.length; i++) { var c = self._resolveTechnologyCanonicalDiagnosis(allDxIds[i]).canonicalDiagnosisId; if (c) ids[c] = true; }
    self._technologyBundleLoadPromise = Promise.all(Object.keys(ids).map(function (cid) {
      return fetch('/assets/data/artifact-source-index/by-diagnosis/' + encodeURIComponent(cid) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) { self._bundleStatusMap[cid] = data ? 'found' : 'missing'; if (data) self._bundleCache[cid] = data; })
        .catch(function () { self._bundleStatusMap[cid] = 'missing'; });
    })).then(function () { return self._bundleCache; });
    return self._technologyBundleLoadPromise;
  };

  // ── _technologyBundleStates — per-diagnosis canonical resolution + bundle status + provenance ──
  TechnologyBrain.prototype._technologyBundleStates = function () {
    var self = this; var diags = (this.state && this.state.diagnoses) || [];
    return diags.map(function (d) {
      var c = self._resolveTechnologyCanonicalDiagnosis(d.id);
      var bundle = (self._bundleCache && self._bundleCache[c.canonicalDiagnosisId]) || null;
      var known = !!(self._bundleStatusMap && Object.prototype.hasOwnProperty.call(self._bundleStatusMap, c.canonicalDiagnosisId));
      return {
        dxId: d.id, active: !!d.active, relevance: (typeof d.relevance === 'number' ? d.relevance : 0),
        canonical: c.canonicalDiagnosisId, aliasUsed: c.aliasUsed, aliasRisk: c.aliasRisk, aliasReviewStatus: c.aliasReviewStatus,
        bundleStatus: bundle ? 'found' : (known ? 'missing' : 'unknown'),
        buildMethod: (bundle && bundle.buildMethod) || null, humanVerification: (bundle && bundle.humanVerification) || null,
        shallow: !!(bundle && ((bundle.maxDepth || 0) === 0 || (bundle.portalCount || 0) <= 1))
      };
    });
  };

  // ── L1 portal mad-lib scan. L1 treatments are fixed-verb templates; quarantined from
  //    evidence. Only real chip/cloud/cyber/AI tickers surface (relevance-unverified). ──
  var TECHNOLOGY_MADLIB_VERB = /^(Develop|Establish|Implement|Build|Launch|Design|Deploy|Operationalize|Conduct|Create|Define|Assess|Optimize|Modernize|Strengthen|Enhance|Formalize|Institute|Standardize|Coordinate|Integrate|Calibrate|Evaluate|Streamline|Institutionalize|Configure|Monitor|Harden|Patch|Provision)\b/;
  TechnologyBrain.prototype._isTechnologyMadLibTreatment = function (label) { return !label || TECHNOLOGY_MADLIB_VERB.test(String(label)); };

  TechnologyBrain.prototype._loadTechnologyL1PortalDepth = function () {
    var self = this;
    if (self._technologyL1LoadPromise) return self._technologyL1LoadPromise;
    var BRANCH = {
      CYBER_ATTACK: ['cybersecurity', 'cloud', 'networking'],
      AI_ALIGNMENT_FAILURE: ['ai_ml', 'software', 'data_infra'],
      INFRASTRUCTURE_COLLAPSE: ['cloud', 'data_infra', 'networking'],
      DATA_BREACH: ['cybersecurity', 'data_infra', 'software'],
      CHIP_SHORTAGE: ['semiconductors', 'hardware', 'supply_chain'],
      PLATFORM_MONOPOLY: ['platforms', 'software', 'cloud']
    };
    self._technologyL1Branches = BRANCH;
    var branches = {}; Object.keys(BRANCH).forEach(function (dx) { BRANCH[dx].forEach(function (b) { branches[b] = true; }); });
    var byBranch = {};
    self._technologyL1LoadPromise = Promise.all(Object.keys(branches).map(function (b) {
      return fetch('/assets/data/domains/technology_' + encodeURIComponent(b) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) {
          if (!data) { byBranch[b] = null; return; }
          var acts = data.activations || [], tickers = {}, total = 0, mad = 0;
          acts.forEach(function (a) {
            (a.companies || []).forEach(function (c) { if (c && c.ticker_or_id) tickers[c.ticker_or_id] = c.name || c.ticker_or_id; });
            (a.treatments || []).forEach(function (t) { var l = t && (t.label || t.title); if (l) { total++; if (self._isTechnologyMadLibTreatment(l)) mad++; } });
          });
          byBranch[b] = { file: 'technology_' + b, companyTickers: Object.keys(tickers).map(function (k) { return { ticker: k, name: tickers[k] }; }), treatmentTotal: total, madLibCount: mad, realTreatmentCount: total - mad };
        })
        .catch(function () { byBranch[b] = null; });
    })).then(function () {
      var byDiagnosis = {};
      Object.keys(BRANCH).forEach(function (dx) {
        var tk = {}, total = 0, mad = 0, scanned = 0;
        BRANCH[dx].forEach(function (b) { var r = byBranch[b]; if (r) { scanned++; r.companyTickers.forEach(function (c) { tk[c.ticker] = c.name; }); total += r.treatmentTotal; mad += r.madLibCount; } });
        byDiagnosis[dx] = { branchesScanned: scanned, realCompanyTickers: Object.keys(tk).map(function (k) { return { ticker: k, name: tk[k], relevanceUnverified: true }; }), treatmentTotal: total, madLibTreatments: mad, realTreatments: total - mad, admitted: false, reason: 'L1 treatments are mad-lib templates (fixed-verb family) — not source-grade; only chip/cloud/cyber/AI tickers surfaced, relevance unverified' };
      });
      self.state._l1DepthCache = { byBranch: byBranch, byDiagnosis: byDiagnosis, scannedAt: (self.state.technologyModel && self.state.technologyModel.updated) || null };
      return self.state._l1DepthCache;
    });
    return self._technologyL1LoadPromise;
  };

  // ── INNOVATION sub-portal layer (counterpart to culture's scene; energy's data-center).
  //    The R&D / compute-capacity pipeline = the canonical technology sub-portal: real-content,
  //    citation-backed innovation diagnoses + treatments. NEVER merged into the validated spine. ──
  TechnologyBrain.prototype._loadInnovationPipelineLayer = function () {
    var self = this;
    if (self._innovationLoadPromise) return self._innovationLoadPromise;
    // Prefer a dedicated technology_innovation.json; fall back to the compute sub-portal.
    // Both share the issues/activations shape. Graceful 404.
    self._innovationLoadPromise = fetch('/assets/data/domains/technology_innovation.json')
      .then(function (r) { return (r && r.ok) ? r.json() : null; })
      .then(function (data) { if (data) return data; return fetch('/assets/data/domains/technology_compute.json').then(function (r2) { return (r2 && r2.ok) ? r2.json() : null; }); })
      .then(function (data) {
        if (!data) { self._innovationPortal = null; return null; }
        self._innovationPortal = { issues: data.issues || [], activations: data.activations || [], title: data.title || 'Innovation Pipeline' };
        return self._innovationPortal;
      })
      .catch(function () { self._innovationPortal = null; return null; });
    return self._innovationLoadPromise;
  };

  TechnologyBrain.prototype._buildTechnologyInnovationLayer = function () {
    var self = this;
    var sp = self._innovationPortal;
    if (!sp || !sp.issues || !sp.issues.length) {
      self.state.innovationDiagnoses = [];
      self.state.innovationTreatments = [];
      self.state.technologyInnovationDomainDiagnosisPackets = [];
      self.state.innovationLayer = { loaded: false, count: 0, activeCount: 0, diagnoses: [], note: 'technology innovation-pipeline sub-portal not loaded (offline or fetch failed)' };
      return self.state.innovationLayer;
    }
    var conditions = self._activeConditions || [];
    // 1) diagnoses — same condition-match logic as the canonical spine
    var diagnoses = sp.issues.map(function (iss) {
      var triggers = (self.diagnosisIndex && self.diagnosisIndex[iss.id]) || [];
      var matchCount = 0;
      for (var t = 0; t < triggers.length; t++) {
        for (var c = 0; c < conditions.length; c++) {
          if (conditions[c] === triggers[t] || String(conditions[c]).indexOf(triggers[t]) !== -1) matchCount++;
        }
      }
      return {
        id: iss.id, label: iss.label, summary: iss.summary || '',
        active: matchCount > 0,
        relevance: triggers.length ? Math.round((matchCount / triggers.length) * 100) / 100 : 0,
        circuits: iss.circuits || [],
        source: 'innovation', tier: 'real-content-unbundled', branch: 'innovation'
      };
    });
    // 2) treatments — pull from innovation node activations whose brainNodeId is in a diagnosis circuit
    var nodeToDx = {};
    diagnoses.forEach(function (d) { (d.circuits || []).forEach(function (c) { if (c && c.nodeId) nodeToDx[c.nodeId] = d.id; }); });
    var treatments = [];
    (sp.activations || []).forEach(function (act) {
      var dxId = nodeToDx[act.brainNodeId];
      if (!dxId) return;
      (act.treatments || []).forEach(function (t, ti) {
        treatments.push({
          id: 'innovation_treat_' + act.brainNodeId + '_' + ti,
          label: t.label, type: t.type, evidence: t.evidence, description: t.description || '',
          cite: t.cite || null, citation: t.citation || [], steps: t.steps || [],
          diagnosisId: dxId, nodeId: act.brainNodeId,
          source: 'innovation', madLib: self._isTechnologyMadLibTreatment ? self._isTechnologyMadLibTreatment(t.label) : false
        });
      });
    });
    var evidenceRank = { A: 10, Strong: 10, B: 7, Moderate: 7, C: 4, Emerging: 1 };
    treatments.sort(function (a, b) { return (evidenceRank[b.evidence] || 0) - (evidenceRank[a.evidence] || 0); });
    self.state.innovationDiagnoses = diagnoses;
    self.state.innovationTreatments = treatments;
    // 3) compact layer summary (read by every DDP's promptView)
    self.state.innovationLayer = {
      loaded: true,
      portalTitle: sp.title,
      count: diagnoses.length,
      activeCount: diagnoses.filter(function (d) { return d.active; }).length,
      diagnoses: diagnoses.map(function (d) {
        var rc = self._resolveTechnologyCanonicalDiagnosis ? self._resolveTechnologyCanonicalDiagnosis(d.id) : { canonicalDiagnosisId: d.id };
        var bsStat = (self._bundleStatusMap && self._bundleStatusMap[rc.canonicalDiagnosisId]) || 'missing';
        return { id: d.id, label: d.label, active: d.active, branch: 'innovation', canonicalDiagnosisId: rc.canonicalDiagnosisId, bundleStatus: bsStat, treatmentCount: treatments.filter(function (t) { return t.diagnosisId === d.id; }).length };
      }),
      note: 'real-content (innovation-pipeline) sub-portal diagnoses for the live R&D/compute surface (R&D velocity, startup/VC cohorts, open-source adoption, protocol-layer maturity); SEPARATE from the validated diagnosis spine; no external artifact-source bundle yet; never admitted to evidenceAnchors'
    };
    // 4) per-diagnosis DDPs via the SAME schema builder (canonical-to-self; bundle 'missing')
    self.state.technologyInnovationDomainDiagnosisPackets = diagnoses.map(function (d) {
      try { return self._buildDomainDiagnosisPacket(d); } catch (e) { return null; }
    }).filter(Boolean);
    return self.state.innovationLayer;
  };

  // ── DDP — the 8-section DomainDiagnosisPacket the Civilization cockpit consumes.
  //    Mirrors culture/infrastructure's _buildDomainDiagnosisPacket exactly; only the CONTENT is technological. ──
  TechnologyBrain.prototype._buildDomainDiagnosisPacket = function (dx) {
    var s = this.state || {};
    var cm = s.technologyModel || {};
    var portal = s._portalCache || null;
    var dxId = dx ? (dx.id || null) : null;

    var allTreat = Array.isArray(s.treatments) ? s.treatments : [];
    var treatments = allTreat.filter(function (t) { return !dxId || t.diagnosisId === dxId; });
    var implementationSteps = [];
    for (var ti = 0; ti < treatments.length; ti++) { if (Array.isArray(treatments[ti].steps)) implementationSteps = implementationSteps.concat(treatments[ti].steps); }

    var allOpp = Array.isArray(s.opportunities) ? s.opportunities : [];
    var opps = allOpp.filter(function (o) { return !dxId || o.diagnosisId === dxId; });
    var primaryOpp = opps[0] || null;
    var mc = primaryOpp && primaryOpp.moneyChain ? primaryOpp.moneyChain : null;

    if (primaryOpp && Array.isArray(primaryOpp.steps)) implementationSteps = implementationSteps.concat(primaryOpp.steps);
    if (primaryOpp && Array.isArray(primaryOpp.fastPath)) implementationSteps = implementationSteps.concat(primaryOpp.fastPath);

    var feeds = s.feeds || {}, sourceFeeds = [];
    if (Array.isArray(feeds)) {
      feeds.forEach(function (f) { if (f && typeof f === 'object') sourceFeeds.push({ name: f.name || f.label || 'feed', updated: f.updated || null, source: f.source || null }); });
    } else {
      for (var fk in feeds) { if (feeds.hasOwnProperty(fk)) { var f = feeds[fk]; if (f && typeof f === 'object') sourceFeeds.push({ name: f.name || fk, updated: (f && f.updated) || null, source: (f && f.source) || null }); } }
    }
    if (s._primarySource && !sourceFeeds.length) sourceFeeds.push({ name: 'primary', updated: null, source: s._primarySource });

    var _canon = this._resolveTechnologyCanonicalDiagnosis(dxId);
    var identity = {
      domain: 'technology',
      diagnosisId: dxId,
      canonicalDiagnosisId: _canon.canonicalDiagnosisId,   // alias map or canonical-to-self
      aliasUsed: _canon.aliasUsed,
      aliasReviewStatus: _canon.aliasReviewStatus,          // human-approved | corpus-aliased | null
      aliasRisk: _canon.aliasRisk,
      aliasNote: _canon.aliasNote,
      label: dx ? (dx.label || dx.id || null) : null,
      phase: s.phase || null,
      confidence: (dx && typeof dx.relevance === 'number') ? dx.relevance : (typeof s.confidence === 'number' ? s.confidence : null)
    };
    // Real source bundle for this canonical id (shipped only when it exists; NEVER fabricated).
    var _bundle = (this._bundleCache && this._bundleCache[identity.canonicalDiagnosisId]) || null;
    var _bundleKnown = !!(this._bundleStatusMap && Object.prototype.hasOwnProperty.call(this._bundleStatusMap, identity.canonicalDiagnosisId));
    var _bl = (_bundle && _bundle.byLane && _bundle.byLane.investments) ? _bundle.byLane.investments : null;
    var _bArr = function (k) { return (_bl && Array.isArray(_bl[k])) ? _bl[k] : []; };
    var bundleStatus = _bundle ? 'found' : (_bundleKnown ? 'missing' : 'unknown');
    var bundleShallow = !!(_bundle && ((_bundle.maxDepth || 0) === 0 || (_bundle.portalCount || 0) <= 1));
    var bundleResolution = identity.aliasUsed
      ? (_bundle ? 'alias-resolved-and-bundle-found' : 'alias-resolved-but-bundle-missing')
      : (_bundle ? 'found' : (_bundleKnown ? 'missing' : 'unknown'));
    if (!treatments.length && _bl) treatments = _bArr('treatments');             // backfill from REAL bundle only
    if (!implementationSteps.length && _bl) implementationSteps = _bArr('implementationSteps');
    var brainState = {
      technologyModel: { version: cm.version || null, cycle: (typeof cm.cycle === 'number' ? cm.cycle : null) },
      predictionError: cm.predictionError || null,
      regulationState: (cm.regulation && cm.regulation.state) || null,
      prior: cm.prior || null,
      observation: cm.observation || null,
      plasticity: cm.plasticity || null,
      readyForHandoff: cm.readyForHandoff === true
    };
    // Domain-identity portal fields are KNOWN facts (this IS the technology root).
    var rootId = (portal && portal.domainId) || 'technology';
    var rootTitle = (portal && portal.title) || 'Technology';
    var ancestry = (portal && portal.parentLabel) ? [portal.parentLabel, rootTitle] : [rootTitle];
    var portalContext = {
      portalIds: [rootId],
      portalDomain: 'technology',
      portalTitle: rootTitle,
      depth: 0,                               // brain operates at the root level only
      ancestryPath: ancestry,
      portalStatus: portal ? 'root-only' : 'pending',
      sourceCompleteness: portal ? ((Array.isArray(portal.issues) && portal.issues.length) ? 'partial' : 'thin') : 'root-only',
      bundleSource: (_bundle && Array.isArray(_bundle.sourcePortals) && _bundle.sourcePortals.length)
        ? { portalIds: _bundle.sourcePortals.map(function (sp) { return sp.portalId; }), depth: _bundle.maxDepth || 0, ancestryPath: (_bundle.sourcePortals[0].ancestry || []), domains: _bundle.domains || [] }
        : null,
      l1Depth: (s._l1DepthCache && s._l1DepthCache.byDiagnosis && s._l1DepthCache.byDiagnosis[dxId]) || (s._l1DepthCache ? { branchesScanned: 0, realCompanyTickers: [], realTreatments: 0, madLibTreatments: 0, admitted: false, reason: 'no L1 branch mapped for this diagnosis' } : null)
    };
    var citationHints = sourceFeeds.map(function (sf) { return sf.source || sf.name; }).filter(Boolean);
    var evidenceAnchors = _bArr('evidenceAnchors');   // REAL bundle anchors only (empty if no bundle)
    var missingEv = [];
    if (!evidenceAnchors.length) missingEv.push('evidenceAnchors');
    if (!citationHints.length) missingEv.push('citationHints');
    var evidence = {
      sourceFeeds: sourceFeeds,
      evidenceAnchors: evidenceAnchors,
      citationHints: citationHints,
      bundleStatus: bundleStatus,
      bundleResolution: bundleResolution,
      bundle: _bundle ? { portalCount: _bundle.portalCount || 0, maxDepth: _bundle.maxDepth || 0, domains: _bundle.domains || [], lane: 'investments', shallow: bundleShallow, buildMethod: _bundle.buildMethod || null, humanVerification: _bundle.humanVerification || null } : null,
      missingEvidence: missingEv
    };
    // Human-authoring intake: for external-source bundles missing candidates, emit structured
    // empty slots (what each needs + which TECHNOLOGY primary source) rather than fabricating.
    var _isExternal = !!(_bundle && _bundle.buildMethod === 'external-source-authored');
    var _intakeSrcHint = {
      CYBER_ATTACK: 'CISA Known Exploited Vulnerabilities / NVD CVE feeds / MITRE ATT&CK / vendor security advisories',
      AI_MISALIGNMENT: 'NIST AI RMF / model cards + safety evals / arXiv cs.AI alignment papers / frontier-lab system cards',
      INFRASTRUCTURE_COLLAPSE: 'cloud-provider status/postmortems / dependency-graph reports / SRE incident reviews',
      DATA_BREACH: 'breach disclosures (SEC 8-K) / HaveIBeenPwned / privacy-regulator filings / vendor incident reports',
      SEMICONDUCTOR_SHORTAGE: 'SIA/WSTS statistics / foundry capacity disclosures (TSM/INTC/ASML filings) / lead-time trackers',
      PLATFORM_MONOPOLY: 'antitrust filings (FTC/DOJ/EC) / platform transparency reports / market-share research'
    };
    var authoringIntake = [];
    if (_isExternal) {
      ['methodCandidates', 'embodimentCandidates', 'figurePlaceholders'].forEach(function (field) {
        if (_bArr(field).length === 0) authoringIntake.push({ field: field, status: 'needs-human-input', count: 0, need: field === 'methodCandidates' ? 'a concrete security/resilience/innovation method drawn from a primary source' : field === 'embodimentCandidates' ? 'a specific implementation/embodiment from a real document' : 'a figure description grounded in a real source', sourceHint: _intakeSrcHint[identity.canonicalDiagnosisId] || 'primary institutional / technical source', note: 'NOT fabricated by the brain — author from the cited source, then wire in verbatim with attribution' });
      });
    }
    var treatmentContext = {
      treatments: treatments,
      implementationSteps: implementationSteps,
      methodCandidates: _bArr('methodCandidates'),
      mechanismCandidates: _bArr('mechanismCandidates'),
      embodimentCandidates: _bArr('embodimentCandidates'),
      figurePlaceholders: _bArr('figurePlaceholders'),
      authoringIntake: authoringIntake
    };
    var operatorContext = {
      targets: (primaryOpp && primaryOpp._resolvedTargets) ? primaryOpp._resolvedTargets : (mc && mc.target ? [mc.target] : []),
      monitoring: (treatments.length && treatments[0].monitoring) ? treatments[0].monitoring : null,
      escalation: (treatments.length && treatments[0].escalation) ? treatments[0].escalation : null,
      invalidIf: mc ? (mc.invalidIf || null) : null,
      nextStep: mc ? (mc.nextStep || null) : null
    };
    var hasTreat = treatments.length > 0;
    var hasBundle = (bundleStatus === 'found');
    var hasCanonical = !!identity.canonicalDiagnosisId;
    var blockers = [];
    if (hasCanonical && !hasBundle) blockers.push(identity.aliasUsed ? 'canonical-id-resolved-but-bundle-missing' : 'no-source-bundle');
    if (bundleStatus === 'missing') blockers.push('source-bundle-build-required');
    blockers.push(portalContext.portalStatus === 'root-only' ? 'portal-root-only' : 'portal-not-loaded');
    if (!hasTreat) blockers.push('no-treatments');
    if (!primaryOpp) blockers.push('no-active-opportunity');
    var lanesIn = [];
    if (primaryOpp && primaryOpp.path) lanesIn.push(primaryOpp.path);
    if (primaryOpp && Array.isArray(primaryOpp.paths)) lanesIn = lanesIn.concat(primaryOpp.paths);
    if (primaryOpp && primaryOpp.compensation && primaryOpp.compensation.type) lanesIn.push(primaryOpp.compensation.type);
    var seenLane = {}, artifactLanes = [];
    for (var li = 0; li < lanesIn.length; li++) { if (lanesIn[li] && !seenLane[lanesIn[li]]) { seenLane[lanesIn[li]] = true; artifactLanes.push(lanesIn[li]); } }
    var readinessReasons = [];
    if (hasBundle) readinessReasons.push('source bundle found (' + bundleResolution + (bundleShallow ? ', root-only' : '') + ', evidenceAnchors=' + evidenceAnchors.length + ')');
    if (hasTreat) readinessReasons.push('treatments present (' + treatments.length + ')');
    if (primaryOpp) readinessReasons.push('opportunity present (path=' + (primaryOpp.path || '?') + ')');
    if (sourceFeeds.length) readinessReasons.push('source feeds present (' + sourceFeeds.length + ')');
    var ready = hasTreat && hasBundle && hasCanonical;
    var _con = s.technologyConscience || {};
    var _exportReady = _con.artifactReadinessDecision ? (_con.artifactReadinessDecision.exportReady !== false) : true;
    // Lanes are INVESTABLE (tech companies / chips / cloud / cyber / AI) / RESEARCHABLE (technology briefs).
    // patent/grant are VETOED by conscience (lanes retired 2026-06-21); export-restricted vetoed on CYBER dx.
    var artifactContext = {
      artifactLanes: artifactLanes,
      patentReady: false, grantReady: false, sbaReady: false,   // patent/grant/loan vetoed by H3 conscience
      exportReady: _exportReady,                                // false while a CYBER diagnosis is active (dual-use)
      investmentReady: !!(hasTreat && primaryOpp), researchReady: ready || hasTreat,
      readinessReasons: readinessReasons,
      blockers: blockers
    };

    var comp = {
      identity:         _techDdpCompleteness(identity, ['domain', 'diagnosisId', 'canonicalDiagnosisId', 'label', 'phase', 'confidence']),
      brainState:       _techDdpCompleteness(brainState, ['technologyModel', 'predictionError', 'regulationState', 'prior', 'observation', 'plasticity']),
      portalContext:    _techDdpCompleteness(portalContext, ['portalIds', 'portalDomain', 'portalTitle', 'depth', 'ancestryPath']),
      evidence:         _techDdpCompleteness(evidence, ['sourceFeeds', 'evidenceAnchors', 'citationHints']),
      treatmentContext: _techDdpCompleteness(treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']),
      operatorContext:  _techDdpCompleteness(operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']),
      artifactContext:  _techDdpCompleteness(artifactContext, ['artifactLanes'])
    };
    var totHave = 0, totAll = 0;
    for (var sk in comp) { if (comp.hasOwnProperty(sk)) { totHave += comp[sk].have; totAll += comp[sk].total; } }
    var missingFields = [];
    function _tmf(name, obj, keys) { for (var i = 0; i < keys.length; i++) { if (!_techDdpPresent(obj[keys[i]])) missingFields.push(name + '.' + keys[i]); } }
    _tmf('identity', identity, ['canonicalDiagnosisId', 'confidence']);
    _tmf('evidence', evidence, ['evidenceAnchors', 'citationHints']);
    _tmf('treatmentContext', treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']);
    _tmf('operatorContext', operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']);

    var warnings = [];
    if (portalContext.portalStatus === 'root-only') warnings.push('portalContext is root-only (no deep portal cortex)');
    if (portalContext.portalStatus === 'pending') warnings.push('root portal not yet cached on the brain (domain identity used)');
    if (identity.aliasUsed) warnings.push('alias-resolved; verify source appropriateness');
    if (bundleStatus === 'missing') warnings.push('source bundle missing (no artifact-source bundle for this diagnosis)');
    if (bundleStatus === 'unknown') warnings.push('source bundle not yet checked');
    if (bundleStatus === 'found' && _bundle && _bundle.buildMethod === 'external-source-authored') warnings.push('external-source-authored; human-verification-required (' + (_bundle.humanVerification || 'required') + ')');
    else if (bundleStatus === 'found' && bundleShallow) warnings.push('source-bundle-root-only (real bundle but portalCount<=1 / maxDepth 0)');
    var _emptyCand = [];
    if (!treatmentContext.methodCandidates.length) _emptyCand.push('method');
    if (!treatmentContext.mechanismCandidates.length) _emptyCand.push('mechanism');
    if (!treatmentContext.embodimentCandidates.length) _emptyCand.push('embodiment');
    if (!treatmentContext.figurePlaceholders.length) _emptyCand.push('figure');
    if (_emptyCand.length) warnings.push((bundleStatus === 'found' ? 'bundle found but ' : 'no bundle — ') + 'candidate types still empty: ' + _emptyCand.join(',') + ' (not invented)');
    if (!primaryOpp && (typeof s.stress !== 'number' || s.stress < TM_STRESS_FLOOR)) warnings.push('no active opportunity (offline/low-stress) — operator/lane fields stay empty');
    if (artifactContext.artifactLanes.length && !hasTreat) warnings.push('artifact lane present but treatments/evidence missing');
    if (!_exportReady) warnings.push('export-restricted claims vetoed (dual-use export-control risk; CYBER diagnosis active)');

    var pct = totAll ? Math.round(totHave / totAll * 100) : 0;
    var proofTier = pct >= 70 ? 'full' : (pct >= 35 ? 'partial' : 'sparse');

    // Prompt-facing trimming/prioritization. FULL data above is preserved; this is a bounded,
    // diagnosis-relevant subset for the finalizer prompt. Never trims scalars/warnings.
    var G2_CAPS = { evidenceAnchors: 8, treatments: 8, implementationSteps: 8, mechanismCandidates: 6, methodCandidates: 6, embodimentCandidates: 6, figurePlaceholders: 6, citationHints: 8, sourceFeeds: 8 };
    function _g2cap(arr, n) { arr = Array.isArray(arr) ? arr : []; return { sel: arr.slice(0, n), omitted: Math.max(0, arr.length - n) }; }
    var _g2ea = _g2cap(evidenceAnchors, G2_CAPS.evidenceAnchors);
    var _g2tr = _g2cap(treatmentContext.treatments, G2_CAPS.treatments);
    var _g2is = _g2cap(treatmentContext.implementationSteps, G2_CAPS.implementationSteps);
    var _g2mc = _g2cap(treatmentContext.mechanismCandidates, G2_CAPS.mechanismCandidates);
    var _g2md = _g2cap(treatmentContext.methodCandidates, G2_CAPS.methodCandidates);
    var _g2em = _g2cap(treatmentContext.embodimentCandidates, G2_CAPS.embodimentCandidates);
    var _g2fg = _g2cap(treatmentContext.figurePlaceholders, G2_CAPS.figurePlaceholders);
    var _g2ch = _g2cap(citationHints, G2_CAPS.citationHints);
    var _g2sf = _g2cap(sourceFeeds, G2_CAPS.sourceFeeds);
    var promptView = {
      compact: true,
      caps: G2_CAPS,
      selectedEvidenceAnchors: _g2ea.sel,
      selectedTreatments: _g2tr.sel,
      selectedImplementationSteps: _g2is.sel,
      selectedMechanismCandidates: _g2mc.sel,
      selectedMethodCandidates: _g2md.sel,
      selectedEmbodimentCandidates: _g2em.sel,
      selectedFigurePlaceholders: _g2fg.sel,
      selectedCitationHints: _g2ch.sel,
      selectedSourceFeeds: _g2sf.sel,
      omittedCounts: { evidenceAnchors: _g2ea.omitted, treatments: _g2tr.omitted, implementationSteps: _g2is.omitted, mechanismCandidates: _g2mc.omitted, methodCandidates: _g2md.omitted, embodimentCandidates: _g2em.omitted, figurePlaceholders: _g2fg.omitted, citationHints: _g2ch.omitted, sourceFeeds: _g2sf.omitted },
      priorityReasons: [
        'diagnosis-specific bundle anchors preferred over generic technology evidence',
        'official/primary sources retained (CISA/NVD/NIST/antitrust filings where present)',
        'mechanisms prioritized over figures under prompt-space limits',
        'treatments with implementation relevance preferred over broad narrative',
        'caps applied per field; full data preserved in the stored bundle + full DDP'
      ],
      retainedWarnings: warnings
        .concat(s.technologyImmune ? ['immune: ' + s.technologyImmune.immuneState + ' (sev ' + s.technologyImmune.severity + ', ' + (s.technologyImmune.antigens || []).length + ' antigens; L2 traversal blocked)'] : [])
        .concat(s.technologyConscience && s.technologyConscience.conscienceState === 'restrictive' ? ['conscience: ' + (s.technologyConscience.blockedClaims || []).slice(0, 3).join(', ') + ' blocked'] : []),
      retainedBlockers: artifactContext.blockers,
      // higher-layer compact summaries (forwarded to the finalizer via promptView)
      immuneSummary: s.technologyImmune ? { immuneState: s.technologyImmune.immuneState, severity: s.technologyImmune.severity, antigenCount: (s.technologyImmune.antigens || []).length, quarantines: s.technologyImmune.quarantines, blockedFromTraversal: s.technologyImmune.blockedFromTraversal, allowedWithWarning: s.technologyImmune.allowedWithWarning } : null,
      awarenessSummary: s.technologyAwareness ? { selfNarrative: s.technologyAwareness.selfNarrative, knowns: (s.technologyAwareness.knowns || []).length, uncertainties: (s.technologyAwareness.uncertainties || []).length } : null,
      conscienceDecision: s.technologyConscience ? { conscienceState: s.technologyConscience.conscienceState, blockedClaims: s.technologyConscience.blockedClaims, artifactReadinessDecision: s.technologyConscience.artifactReadinessDecision } : null,
      intuitionSummary: s.technologyIntuition ? s.technologyIntuition.hunches : null,
      scenarioSummary: s.technologySimulation ? (s.technologySimulation.scenarios || []).map(function (x) { return { type: x.type, hypothetical: x.hypothetical, risk: x.risk }; }) : null,
      executiveReport: s.technologyExecutiveReport || null,
      l1DepthSummary: portalContext.l1Depth ? { realCompanyTickers: (portalContext.l1Depth.realCompanyTickers || []).length, realTreatments: portalContext.l1Depth.realTreatments, madLibTreatments: portalContext.l1Depth.madLibTreatments, admitted: portalContext.l1Depth.admitted } : null,
      authoringIntake: treatmentContext.authoringIntake.length ? treatmentContext.authoringIntake : null,
      // INNOVATION — R&D/compute sub-portal layer (real-content, SEPARATE from the validated spine, no bundle yet)
      innovationSummary: s.innovationLayer && s.innovationLayer.loaded ? { count: s.innovationLayer.count, activeCount: s.innovationLayer.activeCount, diagnoses: s.innovationLayer.diagnoses, note: s.innovationLayer.note } : null
    };

    return {
      schemaVersion: TECH_DDP_SCHEMA_VERSION,
      promptView: promptView,
      identity: identity,
      brainState: brainState,
      portalContext: portalContext,
      evidence: evidence,
      treatmentContext: treatmentContext,
      operatorContext: operatorContext,
      artifactContext: artifactContext,
      audit: {
        generatedAt: (cm.updated || null),
        schemaVersion: TECH_DDP_SCHEMA_VERSION,
        fieldCompleteness: { sections: comp, overallPct: pct },
        missingFields: missingFields,
        warnings: warnings,
        proofTier: proofTier,
        immune: s.technologyImmune || null,
        awareness: s.technologyAwareness || null,
        conscience: s.technologyConscience || null,
        intuition: s.technologyIntuition || null,
        simulation: s.technologySimulation || null,
        executiveReport: s.technologyExecutiveReport || null
      }
    };
  };

  var brain = new TechnologyBrain(); brain.init(); brain.start();
  window.LIMENTechnologyBrain = brain;
  window.LIMENDomainBrains.register(brain);

  // ══════════════════════════════════════════════════════════════════════
  // AUTO-LOAD TECHNOLOGY OPERATOR STACK ON DOMAIN-CONSOLE
  // ══════════════════════════════════════════════════════════════════════

  var _isDomainConsole = window.location.pathname.indexOf('domain-console') !== -1 || window.location.pathname.indexOf('technology-console') !== -1;
  var _domParam = (new URLSearchParams(window.location.search)).get('domain');
  var _isTechnologyDomain = _domParam === 'technology';
  if (_isDomainConsole && _isTechnologyDomain) {
    window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION = true;

    var _technologyScripts = [
      'assets/js/technology-compensation.js',
      'assets/js/technology-claim-ledger.js',
      'assets/js/technology-claim-flow.js',
      'assets/js/technology-opportunity-economics.js',
      'assets/js/technology-pulse-engine.js',
      'assets/js/technology-operator-panel.js',
      'assets/js/technology-node-business-engine.js',
      'assets/js/technology-business-review.js',
      'assets/js/technology-execution-panels.js',
      'assets/js/technology-business-build.js',
      'assets/js/technology-directive-extractor.js',
      'assets/js/technology-directive-ranker.js',
      'assets/js/technology-directive-translator.js',
      'assets/js/technology-targeting-engine.js',
      'assets/js/technology-promotion-bridge.js',
      'assets/js/technology-clarity-operator.js'
    ];
    (function loadNext(i) {
      if (i >= _technologyScripts.length) return;
      var s = document.createElement('script');
      s.src = _technologyScripts[i];
      s.onload = function () { loadNext(i + 1); };
      s.onerror = function () { console.warn('[TechnologyBrain] Failed to load ' + _technologyScripts[i]); loadNext(i + 1); };
      document.head.appendChild(s);
    })(0);
  }
})();
