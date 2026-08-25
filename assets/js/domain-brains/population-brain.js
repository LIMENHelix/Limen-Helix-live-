/**
 * population-brain.js — Population Domain Cognitive Engine
 *
 * Portal issues: POPULATION_COLLAPSE, MASS_MIGRATION, AGING_CRISIS,
 *                URBANIZATION_OVERLOAD, PANDEMIC_DEMOGRAPHIC_SHOCK
 *
 * Cross-domain emissions:
 *   population → economy (labor and demand shifts)
 *   population → infrastructure (capacity strain)
 *   population → law (migration and policy pressure)
 *   population → culture (demographic and identity shifts)
 *   population → governance (population stability and policy load)
 *
 * Exposes: window.LIMENPopulationBrain
 */
(function () {
  'use strict';
  if (!window.LIMENDomainBrainBase) { console.warn('[PopulationBrain] Base not loaded'); return; }
  var Base = window.LIMENDomainBrainBase;

  function PopulationBrain() {
    Base.call(this, { groundedOnly: true,   // circularity cut 2026-07-24
       domainId: 'population', label: 'Population', snapshotKey: 'population', cycleInterval: 30000 });
    this.resourceAuthority = { ownerDomain: 'population', policyId: 'population-resource/1', sandboxLane: 'real-estate', lanes: ['research', 'publication'], budgets: { computeUnitsPerCycle: 512, queueCapacity: 64 }, switches: { internalCycle: true, internalEmission: true, externalAction: false, spend: false, capital: false } };
    this.motorAuthority = { ownerDomain: 'population', contractId: 'population-motor/1', lane: 'real-estate', decisionContract: 'property-transaction-decision/1', budgetId: 'population-real-estate-budget/1', receiptClass: 'counterparty-receipt', outcomeClass: 'accept-decline-or-close', rollbackClass: 'withdraw-or-terminate-under-policy', executorVerified: false, outcomeObserverVerified: false, switches: { prepare: true, simulate: true, external: false } };
  }
  PopulationBrain.prototype = Object.create(Base.prototype);
  PopulationBrain.prototype.constructor = PopulationBrain;

  PopulationBrain.prototype.init = function () {
    Base.prototype.init.call(this);

    // ── OVERLAY ACTUATION (ported from energy-brain, validity-gated per domain 2026-07-13) ──
    // Population is brought to Energy's actuation depth ONLY where the domain can HONESTLY
    // support the mechanism (see the per-flag rationale below). Deterministic; no paid-AI on
    // the 30s cycle; every actuation is reversible by flipping its flag to false.
    //
    //   refractory : TRUE  — de-dup rate-limit on ACTION DRAFTS (a real effector population
    //                        already drives via _checkDiagnosisActions). Neuro Ref III.3
    //                        (absolute dead-time + relative raised-threshold). Self-contained
    //                        inline limiter (no external module dependency).
    //   servo      : TRUE  — PI regulate-to-target (E/I: inhibition tracks drive; Neuro Ref
    //                        XIII.1 / V.2). Effector = proportional dampening of EMITTED
    //                        opportunities + action drafts (a real controllable output channel).
    //                        Baseline = the recurrent model's adaptive prior (prior.expectedStress),
    //                        NOT a K8 homeostat (population has no K-stack) — honest substitution.
    //   eiBrake    : TRUE  — the HALT/DAMPEN stop-circuit consumes the servo's emissionFactor +
    //                        the already-computed governor layers (immune/conscience/regulation).
    //                        Effector = the same emission channel. Real.
    //   phase      : FALSE — ADVISORY ONLY. A thing2 phase transition is SELF-CONSISTENCY
    //                        calibration (interpretive), NEVER an external / ground-truth reward.
    //                        On the P3/P7 family it may at most qualify for the phase-consistency
    //                        TIER of the central K4 gate — still self-consistency, not reward.
    //                        Population's domain phase is P5 — outside that family AND observe-only
    //                        here — so no phase credit is emitted at all: the coherence router is
    //                        computed as OBSERVE-ONLY telemetry (never preempts credit, never opens
    //                        the opportunity gate). This is population's UNMAPPED boundary, analogous
    //                        to Energy's own E/I advisory boundary.
    // selfAudit (observe-only, not a cycle actuation): TRUE — population.json carries a real
    //   72-edge graph, so the diaschisis / single-point-of-failure audit (Neuro Ref XIV) runs on
    //   the REAL graph, not a stub. Consumed as advisory (mirrors Energy's regulation advisories).
    this._actuation = { overlays: true, refractory: true, servo: true, eiBrake: true, phase: false };
    this._refractoryParams = {
      absoluteWindow: 900000,     // 15 min hard dead-time (operator-set; not in the document)
      relativeWindow: 3600000,    // 1 hr raised-bar window (1:4 ratio preserved)
      overrideThreshold: 0.9      // reduced sensitivity: only stress >= 0.9 re-fires in-window
    };
    this._refractoryLog = Object.create(null);   // { dxId: { t, strength } } — the limiter's own state
    this._servoIntegral = 0;                      // bounded PI integral (slow arm), carried across cycles

    // ── K1-K8 NEURO STACK state (ported from energy-brain; population-local, deterministic) ──
    // The credit-learning / truth-brake loop (K4) carries its own cross-cycle buffers, exactly as
    // energy does (_energyOutcomeBuffer / _energyPrevPrediction). Initialized here so the first
    // reconciliation cycle has a defined starting point. No network, no AI — pure state.
    this._populationOutcomeBuffer = [];           // rolling predicted-vs-realized stress samples (K4)
    this._populationPrevPrediction = null;        // last cycle's predictedStress, reconciled next cycle (K4)

    // ── THING2 RECURSIVE-PHASE KERNEL as the phase source (2026-07-13, operator-approved) ──
    // The phase-coherence router and phase-transition record previously read s.phase (a naive
    // per-cycle guess / static PHASE_M lineage). We now feed those from the REAL Thing2 kernel
    // (assets/js/limen-thing2-adapter.js -> window.LIMENThing2.phaseOfSeries), which runs the
    // validated financial phase pipeline over population's own stress trajectory. The kernel is
    // PURE MATH (no network, no AI) so the 30s cycle stays deterministic. Output is INTERPRETIVE
    // posture only (interpretive:true, validated:false); we never surface it as validated, and the
    // phase layer stays OBSERVE-ONLY (a phase transition is self-consistency calibration, never reward;
    // P5 is not P3/P7, so no phase credit is emitted).
    // Fallback: if the adapter is absent or history < 8, _kernelPhase stays null and s.phase is used.
    // seriesSource = STRESS (positive:false) because population's primary scalar (s.stress) rises with
    // distress (up = worse).
    this._kernelPhase = null;
    this._phaseSeries = [];
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        var _ps = JSON.parse(localStorage.getItem('limen:phaseseries:population'));
        if (Array.isArray(_ps)) this._phaseSeries = _ps;
      }
    } catch (e) { this._phaseSeries = this._phaseSeries || []; }

    this.diagnosisIndex = {
      'POPULATION_COLLAPSE':         ['aging_skew', 'fertility_decline', 'workforce_imbalance', 'dependency_ratio', 'demographic_distortion', 'population_high_stress', 'structural_stress'],
      'MASS_MIGRATION':              ['migration_surge', 'refugee_flow', 'border_pressure', 'displacement_event', 'urban_influx', 'macro_shock'],
      'AGING_CRISIS':                ['aging_skew', 'dependency_ratio', 'healthcare_overload', 'pension_strain', 'workforce_imbalance', 'population_high_stress'],
      'URBANIZATION_OVERLOAD':       ['city_overcrowding', 'housing_shortage', 'infrastructure_strain', 'density_spike', 'service_overload'],
      'PANDEMIC_DEMOGRAPHIC_SHOCK':  ['disease_spread', 'mortality_anomaly', 'healthcare_overload', 'access_inequality', 'population_high_stress', 'macro_shock']
    };

    this.emissionRules = [
      { targetDomain: 'economy', signalType: 'labor_demand_shift', condition: function (s) { return s.stress >= 0.40; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.55); } },
      { targetDomain: 'infrastructure', signalType: 'population_capacity_strain', condition: function (s) { return s.stress >= 0.45; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); } },
      { targetDomain: 'law', signalType: 'migration_policy_pressure', condition: function (s) { return s.stress >= 0.45; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); } },
      { targetDomain: 'culture', signalType: 'demographic_identity_shift', condition: function (s) { return s.stress >= 0.50; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.4); } },
      { targetDomain: 'governance', signalType: 'population_stability_load', condition: function (s) { return s.stress >= 0.50; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); } }
    ];
  };

  PopulationBrain.prototype.normalizeSignals = function () {
    var signals = [], rawSignals = (this._rawDomain && this._rawDomain.signals) || [];
    for (var i = 0; i < rawSignals.length; i++) signals.push(rawSignals[i]);
    this._activeConditions = [];

    var feeds = this.state.feeds;
    for (var fi = 0; fi < feeds.length; fi++) {
      var f = feeds[fi], fn = (f.name || '').toLowerCase();
      // World Bank / UN Population data
      if ((fn.indexOf('population') !== -1 || fn.indexOf('demographic') !== -1 || fn.indexOf('census') !== -1) && f.value !== undefined) {
        if (f.channel === 'stress' && f.value > 0) {
          this._activeConditions.push('demographic_distortion');
          signals.push('FEED: Population stress signal — ' + (f.label || f.value));
        }
      }
      if ((fn.indexOf('migration') !== -1 || fn.indexOf('refugee') !== -1 || fn.indexOf('displacement') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('migration_surge');
        this._activeConditions.push('displacement_event');
        signals.push('ELEVATED: Migration/displacement signal detected');
      }
      if ((fn.indexOf('fertility') !== -1 || fn.indexOf('birth') !== -1) && f.value !== undefined && f.value < 2.1) {
        this._activeConditions.push('fertility_decline');
        signals.push('ALERT: Below-replacement fertility rate');
      }
      if ((fn.indexOf('aging') !== -1 || fn.indexOf('elderly') !== -1 || fn.indexOf('dependency') !== -1) && f.value !== undefined && f.value > 0.4) {
        this._activeConditions.push('aging_skew');
        this._activeConditions.push('dependency_ratio');
        signals.push('ELEVATED: Aging population pressure detected');
      }
    }

    for (var rsi = 0; rsi < rawSignals.length; rsi++) {
      var rs = (typeof rawSignals[rsi] === 'string' ? rawSignals[rsi] : '').toLowerCase();
      if (rs.indexOf('migration') !== -1 || rs.indexOf('refugee') !== -1 || rs.indexOf('border') !== -1) {
        if (this._activeConditions.indexOf('migration_surge') === -1) this._activeConditions.push('migration_surge');
        if (this._activeConditions.indexOf('border_pressure') === -1) this._activeConditions.push('border_pressure');
      }
      if (rs.indexOf('pandemic') !== -1 || rs.indexOf('outbreak') !== -1 || rs.indexOf('epidemic') !== -1) {
        if (this._activeConditions.indexOf('disease_spread') === -1) this._activeConditions.push('disease_spread');
        if (this._activeConditions.indexOf('mortality_anomaly') === -1) this._activeConditions.push('mortality_anomaly');
      }
      if (rs.indexOf('housing') !== -1 || rs.indexOf('overcrowd') !== -1 || rs.indexOf('urban') !== -1) {
        if (this._activeConditions.indexOf('city_overcrowding') === -1) this._activeConditions.push('city_overcrowding');
        if (this._activeConditions.indexOf('housing_shortage') === -1) this._activeConditions.push('housing_shortage');
      }
      if (rs.indexOf('aging') !== -1 || rs.indexOf('pension') !== -1 || rs.indexOf('elderly') !== -1) {
        if (this._activeConditions.indexOf('aging_skew') === -1) this._activeConditions.push('aging_skew');
        if (this._activeConditions.indexOf('pension_strain') === -1) this._activeConditions.push('pension_strain');
      }
    }

    var snap = this._getSnapshot();
    if (snap && snap.defenseSignals) {
      for (var si = 0; si < snap.defenseSignals.length; si++) {
        var sig = snap.defenseSignals[si];
        if (sig.affectedDomains && sig.affectedDomains.indexOf('population') !== -1) {
          this._activeConditions.push(sig.eventType);
          signals.push('FEED [DEFENSE]: ' + (sig.eventType || '').replace(/_/g, ' '));
        }
      }
    }
    if (snap && snap.macroShock && snap.macroShock.detected) this._activeConditions.push('macro_shock');

    if (window.LIMENDomainBrains) {
      var allBrains = window.LIMENDomainBrains.getAll();
      for (var bk in allBrains) {
        if (bk === 'population') continue;
        var b = allBrains[bk]; if (!b || !b.state) continue;
        var bEm = b.state.crossDomainEmissions || [];
        for (var bei = 0; bei < bEm.length; bei++) {
          var be = bEm[bei];
          if (be.targetDomain === 'population' && be.magnitude > 0.1) {
            signals.push('FEED [' + bk.toUpperCase() + ']: ' + (be.signal || '').replace(/_/g, ' ') + ' — ' + Math.round(be.magnitude * 100) + '%');
          }
        }
      }
    }

    // ── CIRCULARITY CUT (2026-07-24) — no condition may be manufactured from this
    //    domain's own stress scalar. normalizeSignals runs BEFORE scoreStress, so these
    //    gates read the PREVIOUS cycle's stress: the resulting "active diagnosis" restated
    //    one number instead of adding evidence, and because emissions are gated on an
    //    active diagnosis and peers fold received pressure back into stress, it closed a
    //    feedback ring carrying no new information. Reground to a real feed to restore a
    //    condition; never re-derive one from stress.
    //    SURVIVES on real feeds/events : 1: demographic_distortion
    //    REMOVED, no other source in this file : 8: service_overload, workforce_imbalance, infrastructure_strain, population_high_stress, urban_influx, healthcare_overload, access_inequality, structural_stress

    var extPressure = this.getExternalPressure ? this.getExternalPressure() : 0;
    if (extPressure >= 0.10) this._activeConditions.push('density_spike');
    if (extPressure >= 0.20) this._activeConditions.push('refugee_flow');

    this.state.signals = signals;
    return Promise.resolve();
  };

  PopulationBrain.prototype.deriveDiagnoses = function () {
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
    });
  };

  PopulationBrain.prototype.recommendTreatments = function () {
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

  PopulationBrain.prototype.surfaceOpportunities = function () {
    Base.prototype.surfaceOpportunities.call(this);
    var opps = [], stress = this.state.stress, activeDx = this.state.diagnoses.filter(function (d) { return d.active; }), allDx = this.state.diagnoses || [], companies = this.state.companies, seen = {};
    function add(o) { var key = o.title.toLowerCase().replace(/[^a-z0-9]/g, ''); if (seen[key]) return; seen[key] = true; opps.push(o); }

    for (var di = 0; di < activeDx.length; di++) {
      var dx = activeDx[di], dxLabel = (dx.label || dx.id || '').replace(/_/g, ' ');
      add({ title: dxLabel + ' — population analytics and planning systems', rank: stress * dx.relevance, path: 'RESEARCHABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.50) add({ title: dxLabel + ' — healthcare and service capacity expansion', rank: stress * dx.relevance * 0.9, path: 'INVESTABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.55 && dx.relevance >= 0.2) add({ title: dxLabel + ' — workforce optimization and labor mobility', rank: stress * 0.85, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      add({ title: dxLabel + ' — housing and urban development infrastructure', rank: stress * dx.relevance * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
    }

    var termCo = [] /* neutralized: distress only from validated gate (see energy-brain) */;
    if (termCo.length > 0) add({ title: 'Population terminal entity distressed positioning', rank: 0.95, path: 'INVESTABLE', urgency: 'high', source: 'company_terminal', tier: 1, companies: termCo.map(function (c) { return c.ticker; }), stress: stress });
    if (this.state.convergence && this.state.convergence.primary_signal) add({ title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — population convergence response', rank: 0.98, path: 'INVESTABLE', urgency: 'high', source: 'convergence', tier: 1, stress: stress });

    var emissions = this.state.crossDomainEmissions || [];
    for (var ei = 0; ei < emissions.length; ei++) { var em = emissions[ei]; add({ title: 'Population \u2192 ' + (em.targetDomain || '').replace(/_/g, ' ') + ' — ' + (em.signal || em.signalType || '').replace(/_/g, ' '), rank: (em.magnitude || 0.5) * stress * 0.8, path: 'INVESTABLE', urgency: em.magnitude > 0.6 ? 'high' : 'medium', source: 'cross_domain', tier: 2, stress: stress }); }

    if (stress >= 0.50) {
      add({ title: 'Migration integration and settlement systems', rank: stress * 0.70, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'migration_integration', stress: stress });
      add({ title: 'Demographic monitoring and early warning platforms', rank: stress * 0.65, path: 'RESEARCHABLE', urgency: stress > 0.70 ? 'medium' : 'watching', source: 'lagging', tier: 3, diagnosisId: 'demographic_monitoring', stress: stress });
    }
    if (stress >= 0.60) {
      add({ title: 'Elder care and pension system modernization', rank: stress * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'elder_care', stress: stress });
      add({ title: 'Urban density management and decentralization', rank: stress * 0.72, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'urban_density', stress: stress });
      add({ title: 'Preventive public health and outbreak response systems', rank: stress * 0.68, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'public_health', stress: stress });
    }

    var nearDx = allDx.filter(function (d) { return !d.active && d.relevance > 0 && d.totalTriggers > 0; });
    for (var ndi = 0; ndi < nearDx.length; ndi++) { if (stress >= 0.45) add({ title: (nearDx[ndi].label || '').replace(/_/g, ' ') + ' — early-stage monitoring', rank: stress * (nearDx[ndi].relevance || 0.1) * 0.5, path: 'RESEARCHABLE', urgency: 'watching', source: 'near_diagnosis', tier: 2, stress: stress, nearDiagnosisId: nearDx[ndi].id }); }

    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });

    // ═══ MAPPED INVESTABLE UNIVERSE (2026-07-23) — the hole: the 26 real command-board
    // companies loaded into state.companies were never attached to any call, so population
    // opportunities went out nameless. Attach the mapped universe to the top INVESTABLE calls
    // as CONTEXT (companySource:'mapped_universe'), NOT a distress claim — per-company distress
    // stays gated behind the validated _pubSignals path (termCo above). Honest + reversible. ═══
    var _uni = (companies || []).map(function (c) { return c && (c.ticker || c.t); }).filter(Boolean).slice(0, 6);
    if (_uni.length) {
      var _attached = 0;
      for (var _ui = 0; _ui < opps.length && _attached < 3; _ui++) {
        if (opps[_ui].path === 'INVESTABLE' && !opps[_ui].companies) {
          opps[_ui].companies = _uni.slice();
          opps[_ui].companySource = 'mapped_universe';
          _attached++;
        }
      }
    }

    // ═══ CANONICAL ENRICHMENT — merge population playbook detail per opportunity ═══
    // Playbooks loaded from assets/js/domain-brains/data/population-opportunity-playbooks.js.
    // All narrative (explain/action/valueRange/trigger/validation/steps/outcome/failure/
    // window/fastPath/examples/branch_up/branch_down/realWorld) is domain-authored.
    // moneyChain is composed from those fields + live state readouts — no new prose.
    var PB_LIST = window.LIMENPopulationOpportunityPlaybooks || [];
    var _byId = {};
    for (var _pbi = 0; _pbi < PB_LIST.length; _pbi++) _byId[PB_LIST[_pbi].id] = PB_LIST[_pbi];

    // Diagnosis → playbook id
    var _PB_MAP = {
      'POPULATION_COLLAPSE':        'population_collapse',
      'MASS_MIGRATION':             'mass_migration',
      'AGING_CRISIS':               'aging_crisis',
      'URBANIZATION_OVERLOAD':      'urbanization_overload',
      'PANDEMIC_DEMOGRAPHIC_SHOCK': 'pandemic_shock'
    };
    // Lagging aliases coined by this brain → playbook id (domain-authored mapping)
    var _LAGGING_MAP = {
      'migration_integration':    'mass_migration',
      'demographic_monitoring':   'population_collapse',
      'elder_care':               'aging_crisis',
      'urban_density':            'urbanization_overload',
      'public_health':            'pandemic_shock'
    };

    function _resolvePbId(o) {
      if (o.diagnosisId && _PB_MAP[o.diagnosisId]) return _PB_MAP[o.diagnosisId];
      if (o.source === 'lagging' && o.diagnosisId && _LAGGING_MAP[o.diagnosisId]) return _LAGGING_MAP[o.diagnosisId];
      if (o.nearDiagnosisId && _PB_MAP[o.nearDiagnosisId]) return _PB_MAP[o.nearDiagnosisId];
      return null;
    }

    function _urgencyLabel(u) {
      if (u === 'high') return 'IMMEDIATE';
      if (u === 'medium') return 'ACTIVE';
      if (u === 'watching') return 'WATCH';
      return (u || '').toUpperCase();
    }

    var _COMP = {
      'INVESTABLE':   { type: 'invest',   base: 5,  unit: 'profit%',  tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
      'RESEARCHABLE': { type: 'research', base: 8,  unit: 'cite/credit%', tier: 1, nextTier: { tier: 2, comp: 12, requirement: '3 research outputs published' }, maxTier: { tier: 3, comp: 20 } }
    };

    for (var oi = 0; oi < opps.length; oi++) {
      var o = opps[oi];

      o.id = (o.diagnosisId || o.nearDiagnosisId || o.source || 'opp').replace(/[^a-zA-Z0-9]/g, '_') + '_' + (o.path || '').toLowerCase().replace(/[^a-z]/g, '') + '_t' + (o.tier || 0);
      o.domain = 'population';
      o.confidence = Math.round(Math.min(1, (o.rank || 0)) * 100);
      if (!o.whyNow) o.whyNow = o.title;
      o.urgencyLabel = _urgencyLabel(o.urgency);

      var pbId = _resolvePbId(o);
      o.playbookId = pbId;
      var pb = pbId ? _byId[pbId] : null;

      if (pb) {
        o.explain     = pb.explain;
        o.action      = pb.action;
        o.valueRange  = pb.valueRange;
        o.trigger     = pb.trigger;
        o.validation  = pb.validation;
        o.steps       = pb.steps;
        o.outcome     = pb.outcome;
        o.failure     = pb.failure;
        o.window      = pb.window;
        o.fastPath    = pb.fastPath;
        o.examples    = pb.examples;
        o.branch_up   = pb.branch_up;
        o.branch_down = pb.branch_down;
        if (pb.realWorld) o.realWorld = pb.realWorld;
        if (pb.saturation) o.saturation = pb.saturation;
      }

      o.compensation = _COMP[o.path] || null;
      if (o.compensation) o.paths = [o.path];

      o.validity = {
        createdAt: Date.now(),
        lastValidated: Date.now(),
        expiryWindowDays: o.tier === 1 ? 30 : o.tier === 2 ? 60 : 90,
        requiresRevalidation: false,
        invalidationReasons: []
      };

      if (pb) {
        var stressPct = Math.round((o.stress || 0) * 100);
        var target = '';
        if (o.path === 'INVESTABLE' && pb.realWorld && pb.realWorld.invest) target = pb.realWorld.invest;
        else if (o.path === 'RESEARCHABLE' && pb.realWorld && (pb.realWorld.research || pb.realWorld.build)) target = pb.realWorld.research || pb.realWorld.build;
        else if (o.companies && o.companies.length) target = 'Mapped companies: ' + o.companies.join(', ') + '.';

        var timingParts = [];
        if (o.urgencyLabel) timingParts.push(o.urgencyLabel);
        if (pb.window) timingParts.push('Window: ' + pb.window);
        var timing = timingParts.join(' \u00b7 ');

        var evidenceParts = ['Domain: population', 'Stress: ' + stressPct + '%'];
        if (o.confidence) evidenceParts.push('Confidence: ' + o.confidence + '%');
        if (o.diagnosisId) evidenceParts.push('Diagnosis: ' + String(o.diagnosisId).replace(/_/g, ' ').toLowerCase());
        if (pb.trigger) evidenceParts.push(pb.trigger);
        var evidence = evidenceParts.join('. ') + '.';

        var whyPays = pb.outcome || '';
        if (pb.valueRange) whyPays = (whyPays ? whyPays + ' ' : '') + 'Value range: ' + pb.valueRange + '.';

        var nextStep = (pb.fastPath && pb.fastPath.length) ? pb.fastPath[0] : (pb.steps && pb.steps.length ? pb.steps[0] : '');

        o.moneyChain = {
          doThis:    pb.action || '',
          whyPays:   whyPays,
          target:    target,
          timing:    timing,
          invalidIf: pb.failure || '',
          evidence:  evidence,
          nextStep:  nextStep
        };
      }
    }

    // EMISSION BRAKE (one-cycle lag): apply the PRIOR cycle's stop-circuit to this cycle's ranked
    // opportunities — halt holds them (held+zero confidence), dampen halves confidence, plus the
    // proportional E/I dampening from the servo. Mirrors energy-brain _applyEmissionBrake. Additive.
    try { opps = this._applyPopulationEmissionBrake(opps); } catch (e) {}

    this.state.opportunities = opps;
    this.state.opportunityCount = opps.length;
    return Promise.resolve();
  };

  // Consumed at the END of surfaceOpportunities: applies the prior cycle's brake to the opportunity
  // set. Halt -> held + zero confidence; dampen/E-I -> scaled confidence. Reversible (clears when
  // the brake clears). Never removes opportunities — it holds + de-confidences them for review.
  PopulationBrain.prototype._applyPopulationEmissionBrake = function (opps) {
    var brake = this.state.populationBrake;
    if (!brake || brake.level === 'clear') { this.state.opportunitiesHeld = false; return opps; }
    var pen = (typeof brake.confidencePenalty === 'number') ? brake.confidencePenalty : 1;
    var codes = (brake.reasons || []).map(function (r) { return r.code; }).join(',');
    for (var i = 0; i < opps.length; i++) {
      if (pen < 1 && typeof opps[i].confidence === 'number') opps[i].confidence = Math.round(opps[i].confidence * pen);
      if (brake.suppressOpportunities) { opps[i].held = true; opps[i].heldReason = codes; }
    }
    this.state.opportunitiesHeld = !!brake.suppressOpportunities;
    return opps;
  };

  PopulationBrain.prototype._checkDiagnosisActions = function () {
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; }); if (activeDx.length === 0) return;
    var adapters = window.LIMENActionAdapters; if (!adapters) return;

    // HALT-BRAKE GATE (one-cycle lag): if the prior cycle's stop-circuit engaged (immune-alert,
    // stale feeds, or no evidence-backed diagnosis), suppress ALL new action drafts this cycle.
    // Same mechanic as energy-brain (brake.suppressActions). Reversible: brake clears next cycle.
    var _brake = this.state.populationBrake;
    if (_brake && _brake.suppressActions) { this.state._brakeSuppressedActions = (this.state._brakeSuppressedActions || 0) + 1; return; }
    this.state._brakeSuppressedActions = 0;

    for (var i = 0; i < activeDx.length; i++) {
      var dx = activeDx[i];
      if (adapters.getDrafts && adapters.getDrafts({ domain: 'population', intentId: dx.id }).length > 0) continue;

      // REFRACTORY GATE (Neuro Ref III.3, actuated): once a diagnosis has emitted a draft, suppress
      // re-emission within the absolute dead-time; during the relative window only a stronger-than-
      // normal stress (>= overrideThreshold) re-fires. The diagnosis stays active + displayed — only
      // the duplicate DRAFT is withheld. Self-contained inline limiter; never breaks the cycle.
      if (this._actuation && this._actuation.refractory) {
        try {
          var _now = (this._runtimeOverlay && this._runtimeOverlay.timestamp) ||
                     (this.state.pulse && this.state.pulse.timestamp) ||
                     ((typeof Date !== 'undefined' && Date.now) ? Date.now() : 0);
          var _verdict = this._populationRefractoryFire(dx.id, _now, this.state.stress);
          if (!_verdict.allowed) { this.state._refractorySuppressed = (this.state._refractorySuppressed || 0) + 1; continue; }
        } catch (_e) { /* gate is best-effort; fall through to normal emission */ }
      }

      adapters.createDraft('REPORT_GENERATION', { domain: 'population', sourceType: 'domain_brain', sourceId: dx.id, intentId: dx.id, title: 'Population Alert: ' + dx.label, intent: { domain: 'population', title: dx.label, status: 'ACTIVE', priority: this.state.stress, progress: 0, strategyType: 'diagnosis_response', steps: [{ type: 'ANALYZE', label: 'Assess ' + dx.label + ' impact on population systems', status: 'PENDING' }, { type: 'INVESTIGATE', label: 'Identify affected demographics and regions', status: 'PENDING' }, { type: 'POSITION', label: 'Evaluate intervention opportunities', status: 'PENDING' }] } });
    }
  };

  // ── REFRACTORY LIMITER (Neuro Ref III.3) — self-contained inline form of the energy-refractory-
  //    limiter module (population has no such module and this file may touch no other). Two-phase:
  //    absolute hard dead-time + relative raised-threshold. Holds its OWN log (this._refractoryLog);
  //    never reads or writes population.json. Units are caller-defined (ms, same as `now`). ──
  PopulationBrain.prototype._populationRefractoryFire = function (key, now, strength) {
    var p = this._refractoryParams || {};
    var last = this._refractoryLog[key] || null;
    var verdict;
    if (!p.absoluteWindow || p.absoluteWindow <= 0) verdict = { allowed: true, phase: 'disabled' };
    else if (!last) verdict = { allowed: true, phase: 'ready' };
    else {
      var dt = now - last.t;
      if (dt < p.absoluteWindow) verdict = { allowed: false, phase: 'absolute' };
      else if (dt < p.relativeWindow) {
        verdict = (typeof strength === 'number' && strength >= p.overrideThreshold)
          ? { allowed: true, phase: 'relative-override' }
          : { allowed: false, phase: 'relative' };
      } else verdict = { allowed: true, phase: 'ready' };
    }
    if (verdict.allowed) this._refractoryLog[key] = { t: now, strength: strength };
    return verdict;
  };

  PopulationBrain.prototype.resolveDeepContent = function () {
    var self = this; var resolver = window.LIMENPortalContentResolver; if (!resolver) return Promise.resolve();
    return resolver.resolveForBrain(this.state).then(function (content) { self.state.resolvedContent = content; if (content) { var dt = []; for (var dxId in content.byDiagnosis) { var dxC = content.byDiagnosis[dxId]; for (var i = 0; i < dxC.treatments.length; i++) { var t = dxC.treatments[i]; dt.push({ id: 'deep_' + t.nodeId + '_' + i, label: t.label, type: t.type, evidence: t.evidence, description: t.description, cite: t.cite, steps: t.steps, monitoring: t.monitoring, escalation: t.escalation, diagnosisId: dxId, nodeId: t.nodeId, nodeLabel: t.nodeLabel, hasDepth: t.hasDepth, source: 'canonical_deep' }); } } if (dt.length > 0) self.state.treatments = dt; } }).catch(function () {});
  };

  // ════════════════════════════════════════════════════════════════════════════
  // POPULATION RECEIVER — energy → population inbound coupling (additive).
  // Energy never emits toward population; population accepts energy stress as
  // 'energy_poverty_pressure' (fuel/grid access constraint → migration, healthcare
  // access, household/settlement stress). Reads energy's live state on the brain bus.
  // Real cross-domain nervous-system wire; never fabricates.
  // ════════════════════════════════════════════════════════════════════════════
  PopulationBrain.prototype._ingestEnergyCoupling = function () {
    try {
      if (!window.LIMENDomainBrains) return;
      var energy = window.LIMENDomainBrains.getAll ? window.LIMENDomainBrains.getAll().energy : null;
      if (!energy || !energy.state) return;
      var es = energy.state;
      var eStress = typeof es.stress === 'number' ? es.stress : 0;
      var eConds = es._activeConditions || [];
      var gridStress = eConds.indexOf('grid_stress') !== -1;
      var crudeHigh = eConds.indexOf('crude_above_90') !== -1;
      var intermittency = eConds.indexOf('renewable_intermittency') !== -1;
      // explicit emission magnitude if energy ever emits toward population (forward-compatible)
      var emitMag = 0;
      var eEmissions = es.crossDomainEmissions || [];
      for (var i = 0; i < eEmissions.length; i++) {
        var em = eEmissions[i];
        if (em && em.targetDomain === 'population' && (em.signal === 'energy_poverty_pressure' || em.signalType === 'energy_poverty_pressure')) {
          emitMag = Math.max(emitMag, em.magnitude || 0);
        }
      }
      var coupledMag = Math.max(emitMag, (eStress >= 0.50 && (gridStress || crudeHigh || intermittency)) ? (eStress * 0.35) : 0);
      if (coupledMag > 0.3 && (gridStress || crudeHigh)) {
        if (this._activeConditions.indexOf('energy_poverty_pressure') === -1) this._activeConditions.push('energy_poverty_pressure');
        // family formation / settlement patterns respond to energy-access constraints
        if (this._activeConditions.indexOf('demographic_distortion') === -1) this._activeConditions.push('demographic_distortion');
        if (this._activeConditions.indexOf('migration_surge') === -1) this._activeConditions.push('migration_surge');
        if (this._activeConditions.indexOf('residential_stress') === -1) this._activeConditions.push('residential_stress');
        if (this._activeConditions.indexOf('healthcare_access') === -1) this._activeConditions.push('healthcare_access');
        this.state.signals = (this.state.signals || []).concat(['FEED [ENERGY]: energy-poverty pressure ' + Math.round(coupledMag * 100) + '% → migration / settlement / residential stress']);
      }
      this.state._energyCoupling = { magnitude: Math.round(coupledMag * 1000) / 1000, gridStress: gridStress, crudeHigh: crudeHigh, intermittency: intermittency, emitMag: emitMag };
    } catch (e) {}
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE B — POPULATION RECURRENT LOOP v1 (population-local, additive, reversible)
  // prior → observation → prediction error → bounded update → next prior.
  // Mirrors energy-brain _updateEnergyModel exactly; content = demographic indicators.
  // Proof surface: window.LIMENPopulationBrain.state.populationModel
  // ════════════════════════════════════════════════════════════════════════════
  var PM_VERSION = 1;
  var PM_LEARNING_RATE = 0.25;          // bounded plasticity (fast inference)
  var PM_SLOW_RATE = 0.08;              // slow consolidation (rebuild/cron)
  var PM_STRESS_FLOOR = 0.30;           // below this → no handoff
  var PM_FLOOD_CAP = 12;                // opportunity-flood threshold
  var PM_STALE_MS = 1000 * 60 * 60 * 6; // 6h feed staleness

  function _pmClamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function _pmJaccardDistance(a, b) {
    a = a || []; b = b || [];
    if (a.length === 0 && b.length === 0) return 0;
    var union = {}, inter = 0, setB = {};
    for (var i = 0; i < b.length; i++) { setB[b[i]] = true; union[b[i]] = true; }
    var seen = {};
    for (var j = 0; j < a.length; j++) { union[a[j]] = true; if (setB[a[j]] && !seen[a[j]]) { inter++; seen[a[j]] = true; } }
    var u = Object.keys(union).length;
    return u === 0 ? 0 : 1 - (inter / u);
  }

  // Demographic feed source families recognized for signal-freshness (REAL sources only).
  var PM_DEMOGRAPHIC_FEEDS = ['census', 'world population', 'population prospects', 'bls', 'pew', 'acs', 'fertility', 'life expectancy', 'dependency', 'migration', 'urbanization', 'mortality', 'birth', 'demographic'];

  PopulationBrain.prototype._neutralPopulationModel = function () {
    return {
      version: PM_VERSION, cycle: 0,
      prior: { expectedStress: 0.5, expectedDiagnoses: [], expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, confidence: 0, samples: 0 },
      observation: null, predictionError: null, predictedStress: null,
      plasticity: { learningRate: PM_LEARNING_RATE, slowRate: PM_SLOW_RATE, consolidation: 'cycle-light/rebuild-heavy' },
      regulation: null, readyForHandoff: false, _lowErrorStreak: 0, updated: null
    };
  };

  // B2 — normalized observation from current Population state (demographic indicators)
  PopulationBrain.prototype._buildPopulationObservation = function () {
    var s = this.state || {};
    var active = (s.diagnoses || []).filter(function (d) { return d.active; });
    // signal = freshness of live demographic indicators (Census/UN/BLS/Pew/ACS), normalized 0..1
    var feeds = s.feeds || [], feedCount = 0, newest = 0, demoCount = 0;
    function _isDemoFeed(name) { var n = (name || '').toLowerCase(); for (var k = 0; k < PM_DEMOGRAPHIC_FEEDS.length; k++) { if (n.indexOf(PM_DEMOGRAPHIC_FEEDS[k]) !== -1) return true; } return false; }
    if (Array.isArray(feeds)) {
      for (var fi = 0; fi < feeds.length; fi++) { var f = feeds[fi] || {}; feedCount++; if (_isDemoFeed(f.name)) demoCount++; var u = f.updated || f.timestamp; if (u && u > newest) newest = u; }
    } else { for (var fk in feeds) { if (feeds.hasOwnProperty(fk)) { feedCount++; if (_isDemoFeed(fk)) demoCount++; var uu = feeds[fk] && feeds[fk].updated; if (uu && uu > newest) newest = uu; } } }
    var demoSignalCount = demoCount > 0 ? demoCount : feedCount; // prefer demographic feeds; fall back to any feeds
    return {
      stress: typeof s.stress === 'number' ? s.stress : 0,
      phase: s.phase || null,
      activeDiagnoses: active.map(function (d) { return d.id; }).sort(),
      diagnosisCount: active.length,
      opportunityCount: (s.opportunities || []).length,
      companyCount: (s.companies || []).length,
      signal: Math.min(1, demoSignalCount / 8),
      feedNewest: newest,
      timestamp: Date.now()
    };
  };

  // B3 — prediction error: prior.expected* vs observation (demographic-appropriate weights)
  PopulationBrain.prototype._computePopulationPredictionError = function (prior, obs) {
    var stressError = Math.abs(obs.stress - prior.expectedStress);
    var signalError = Math.abs(obs.signal - prior.expectedSignal);
    var diagnosisError = _pmJaccardDistance(obs.activeDiagnoses, prior.expectedDiagnoses);
    var oppDenom = Math.max(1, prior.expectedOpportunityCount, obs.opportunityCount);
    var opportunityError = Math.abs(obs.opportunityCount - prior.expectedOpportunityCount) / oppDenom;
    var total = _pmClamp(0.4 * stressError + 0.2 * signalError + 0.25 * diagnosisError + 0.15 * opportunityError, 0, 1);
    var novelty = Math.max(stressError, diagnosisError);
    return { total: total, stressError: stressError, signalError: signalError, diagnosisError: diagnosisError, opportunityError: opportunityError, novelty: novelty };
  };

  // B4 — bounded prior update toward observation (next cycle reads this)
  PopulationBrain.prototype._updatePopulationPrior = function (prior, obs, lr) {
    return {
      expectedStress: _pmClamp(prior.expectedStress + lr * (obs.stress - prior.expectedStress), 0, 1),
      expectedDiagnoses: obs.activeDiagnoses.slice(),
      expectedDiagnosisCount: prior.expectedDiagnosisCount + lr * (obs.diagnosisCount - prior.expectedDiagnosisCount),
      expectedOpportunityCount: prior.expectedOpportunityCount + lr * (obs.opportunityCount - prior.expectedOpportunityCount),
      expectedSignal: _pmClamp(prior.expectedSignal + lr * (obs.signal - prior.expectedSignal), 0, 1),
      confidence: _pmClamp(Math.min(1, (prior.samples + 1) / 20), 0, 1),
      samples: prior.samples + 1
    };
  };

  // B5 — local regulation: inhibition / gain / homeostatic set-points
  PopulationBrain.prototype._computePopulationRegulation = function (pm, obs, pe) {
    var gain = _pmClamp(pe.novelty, 0.05, 0.95);
    var inhibition = _pmClamp(1 - pe.novelty, 0, 0.9);
    var outputScale = _pmClamp(1 - inhibition * 0.5, 0.4, 1);
    var starving = obs.stress >= PM_STRESS_FLOOR && obs.opportunityCount === 0;
    var flooding = obs.opportunityCount > PM_FLOOD_CAP;
    var streak = (pe.total < 0.05) ? (pm._lowErrorStreak || 0) + 1 : 0;
    pm._lowErrorStreak = streak;
    var looping = streak >= 3;
    var stale = obs.feedNewest > 0 ? (Date.now() - obs.feedNewest) > PM_STALE_MS : false;
    var overconfident = pm.prior.confidence > 0.8 && pe.total > 0.4;
    var label = flooding ? 'flooding' : starving ? 'starving' : stale ? 'stale' : looping ? 'looping' : overconfident ? 'overconfident' : pe.novelty > 0.4 ? 'surprised' : 'calm';
    return { gain: gain, inhibition: inhibition, outputScale: outputScale, starving: starving, flooding: flooding, looping: looping, stale: stale, overconfident: overconfident, state: label };
  };

  // The recurrent step — END of each cycle. Reads the prior from the PREVIOUS cycle.
  PopulationBrain.prototype._updatePopulationModel = function () {
    var pm = this.state.populationModel || this._neutralPopulationModel();
    var priorIn = pm.prior;                                          // carried from last cycle
    var obs = this._buildPopulationObservation();
    var pe = this._computePopulationPredictionError(priorIn, obs);   // prior vs now

    var gainBlend = _pmClamp(pe.novelty, 0.05, 0.95);
    var predictedStress = priorIn.expectedStress * (1 - gainBlend) + obs.stress * gainBlend;
    var reg = this._computePopulationRegulation(pm, obs, pe);

    var readyForHandoff = (pm.cycle > 0) && (predictedStress >= PM_STRESS_FLOOR) && (obs.diagnosisCount > 0) && !reg.flooding && !reg.stale;

    // K4 CLOSED — credit assignment routed through the central honest reward gate
    // (window.LIMENK4.credit). Population is NOT externalRewardEligible: it has no external
    // realized-outcome label, so externalOutcome is ALWAYS null and its credit is self-consistency
    // calibration only (interpretive), NEVER reward. The gate enforces the preemption:
    // external-reward(4) > phase-consistency(3) > call-consistency(2) > stress-consistency(1) > none.
    // Pure math, no AI/network on the cycle. One-cycle lag: reads the prior cycle's K4 outcome model
    // and phase dynamics (both written later in this cycle by the neuro + actuation layers).
    var _om = this.state.populationOutcomeModel;
    var _lr = pm.plasticity.learningRate;
    // thing2 realized phase transition (interpretive self-consistency). Population's phase actuation is
    // OFF and P5 is not P3/P7, so there is no realized transition hit — phaseTransitionHit stays null
    // (observe-only). phaseValidated only flags P3/P7-family membership for the phase-consistency TIER,
    // never reward.
    var _pt = (this.state.populationPhaseDynamics || {}).transition;
    var _ptActive = !!(this._actuation && this._actuation.phase && _pt && typeof _pt.hit === 'number');
    // Signal built from what the brain already computed. externalOutcome MUST be null (not eligible).
    var _sig = {
      externalOutcome: null,                                              // NOT eligible: self-consistency only, never reward
      phaseValidated: !!(_pt && _pt.validated),                           // P3/P7 family gate for phase-consistency tier (not reward)
      phaseTransitionHit: _ptActive ? (_pt.hit ? 1 : 0) : null,           // thing2 transition hit (interpretive); null while observe-only
      callHitRate: (_om && typeof _om.callHitRate === 'number') ? _om.callHitRate : null,  // TRUTH BRAKE ledger (forward self-prediction)
      callSamples: (_om && typeof _om.samples === 'number') ? _om.samples : 0,
      stressSelfPred: (_om && typeof _om.hitRate === 'number') ? _om.hitRate : null,        // stress self-prediction (tier-1 fallback)
      stressSamples: (_om && typeof _om.samples === 'number') ? _om.samples : 0
    };
    var _k4 = (typeof window !== 'undefined' && window.LIMENK4 && typeof window.LIMENK4.credit === 'function')
      ? window.LIMENK4.credit(_sig) : null;
    var _hit, _creditSource, _isReward;
    if (_k4) {
      _hit = (typeof _k4.credit === 'number') ? _k4.credit : null;
      _creditSource = _k4.creditSource;
      _isReward = !!_k4.isReward;                                         // ALWAYS false for population (not externalRewardEligible)
    } else {
      // FALLBACK (gate absent) — prior credit behavior preserved, same preemption, in-line.
      var _fromLedger = !!(_om && typeof _om.callHitRate === 'number' && _om.samples >= 3);
      _hit = _fromLedger ? _om.callHitRate
        : (_om && typeof _om.hitRate === 'number' && _om.samples >= 5) ? _om.hitRate : null;
      _creditSource = _fromLedger ? 'call-consistency' : (_hit !== null ? 'stress-consistency' : 'none');
      _isReward = false;                                                  // self-consistency only; never reward
    }
    // Modulate the K4 learning rate by the credit (lower self-consistency => faster plasticity), bounded.
    if (_hit !== null) _lr = _pmClamp(_lr * (1 + (1 - _hit)), PM_SLOW_RATE, 0.6);
    pm._effectiveLearningRate = _lr;
    pm._creditSource = _creditSource;
    pm._creditIsReward = _isReward;                                       // honest flag: false unless a real external outcome fed the gate

    var nextPrior = this._updatePopulationPrior(priorIn, obs, _lr); // → next cycle reads this (K4-modulated learning rate)

    pm.cycle += 1;
    pm.observation = obs;
    pm.predictionError = pe;
    pm.predictedStress = predictedStress;
    pm.regulation = reg;
    pm.readyForHandoff = readyForHandoff;
    pm.prior = nextPrior;
    pm.updated = obs.timestamp;
    this.state.populationModel = pm;

    // brainPopulationModel — real-demographic lifecycle model (parallel to economy's brainEconomyModel)
    try { this._buildBrainPopulationModel(obs); } catch (e) {}

    // H1-H6 — higher Population brain layers (BEFORE the DDP build so packets embed summaries)
    try { this._computePopulationHigherLayers(); } catch (e) {}

    // ACTUATION — servo -> brake -> E/I+SPOF advisories -> phase (advisory). Runs AFTER the higher
    // layers (needs immune/conscience/regulation) and BEFORE the DDP build so packets embed it.
    // Deterministic; guarded; consumed next cycle by the action + opportunity gates (one-cycle lag).
    try { this._computePopulationActuation(); } catch (e) {}

    // K1-K8 NEURO STACK — ported from energy-brain (population-local, deterministic, additive, advisory).
    // Runs the eight closed-loop micro-circuits in Energy's K1..K8 order, ALONGSIDE the actuation layer
    // above (never replacing it). Reads cached state only; no network, no AI. Runs BEFORE the cognition
    // build below so the roll-up is exposed as cognition.neuro. Guarded; a throw never breaks the cycle.
    try { this._computePopulationNeuroLayers(); } catch (e) {}

    // demographic-transition sub-layer (additive; BEFORE the DDP build; never merged into the spine)
    try { this._buildDemographicTransitionLayer(); } catch (e) {}

    // DDP — primary diagnosis packet + one per diagnosis (schema-only; never invents data)
    try {
      var _diags = this.state.diagnoses || [];
      var _primary = _diags.filter(function (d) { return d.active; })[0] || _diags[0] || null;
      var _self = this;
      pm.domainDiagnosisPacket = this._buildDomainDiagnosisPacket(_primary);
      this.state.populationDomainDiagnosisPackets = _diags.map(function (d) { return _self._buildDomainDiagnosisPacket(d); });
    } catch (e) {}

    // outcomeLog — used by intuition (PE trends)
    try {
      var mem = this.state.memory || (this.state.memory = {});
      var log = mem.outcomeLog || (mem.outcomeLog = []);
      log.push({ cycle: pm.cycle, predictionError: Math.round(pe.total * 1000) / 1000, stress: obs.stress, activeDx: obs.diagnosisCount, readyForHandoff: readyForHandoff, regulation: reg.state, timestamp: obs.timestamp });
      if (log.length > 50) log.shift();
    } catch (e) {}

    // ── state.cognition — the MANDATORY console self-model panel (generic surface) ──
    this.state.cognition = {
      domain: 'population',
      populationModel: pm,
      model: { cycle: pm.cycle, predictionError: pm.predictionError, predictedStress: pm.predictedStress, regulation: pm.regulation },
      populationImmune: this.state.populationImmune || null,
      populationAwareness: this.state.populationAwareness || null,
      populationConscience: this.state.populationConscience || null,
      populationIntuition: this.state.populationIntuition || null,
      populationSimulation: this.state.populationSimulation || null,
      populationExecutiveReport: this.state.populationExecutiveReport || null,
      awareness: this.state.populationAwareness || null,
      conscience: this.state.populationConscience || null,
      immune: this.state.populationImmune || null,
      intuition: this.state.populationIntuition || null,
      simulation: this.state.populationSimulation || null,
      executiveReport: this.state.populationExecutiveReport || null,
      sceneLayer: null,
      // ── ACTUATION surface (parallels energy's cognition.servo / .brake / .phaseDynamics / .neuro.regulation) ──
      actuation: this._actuation || null,
      populationServo: this.state.populationServo || null,
      populationBrake: this.state.populationBrake || null,
      populationPhaseDynamics: this.state.populationPhaseDynamics || null,
      populationRegulationAdvisories: this.state.populationRegulationAdvisories || null,
      servo: this.state.populationServo || null,
      brake: this.state.populationBrake || null,
      phaseDynamics: this.state.populationPhaseDynamics || null,
      regulationAdvisories: this.state.populationRegulationAdvisories || null,
      demographicTransitionSublayer: this.state.demographicTransitionLayer || null,
      // ── K1-K8 NEURO STACK roll-up (ported from energy's cognition.neuro) ──
      neuro: this.state.populationNeuro || null,
      brainPopulationModel: this.state.brainPopulationModel || null,
      treatments: this.state.treatments || [],
      diagnoses: this.state.diagnoses || [],
      opportunities: this.state.opportunities || []
    };
    return pm;
  };

  // ── brainPopulationModel — real-demographic lifecycle model (Census/UN WPP/BLS/Pew/ACS anchored).
  //    DISTINCT from economy's business-cycle model: tracks the demographic TRANSITION life-cycle. ──
  PopulationBrain.prototype._buildBrainPopulationModel = function (obs) {
    var s = this.state || {};
    obs = obs || (s.populationModel && s.populationModel.observation) || {};
    var conds = this._activeConditions || [];
    function has(c) { return conds.indexOf(c) !== -1; }

    // Demographic-transition phase from active conditions (interpretive, NEVER validated).
    //   pre-transition → early-transition → late-transition → post-transition → declining
    var fertilityDecline = has('fertility_decline');
    var agingSkew = has('aging_skew');
    var mortalityAnomaly = has('mortality_anomaly');
    var migrationSurge = has('migration_surge') || has('refugee_flow');
    var demographicTransitionPhase = (fertilityDecline && agingSkew) ? 'declining'
      : (fertilityDecline ? 'post-transition'
      : (agingSkew ? 'late-transition'
      : (mortalityAnomaly ? 'early-transition' : 'pre-transition')));

    var pm = s.populationModel || {};
    return (this.state.brainPopulationModel = {
      version: PM_VERSION,
      cycle: pm.cycle || 0,
      demographicTransitionPhase: demographicTransitionPhase,     // pre/early/late/post-transition | declining
      fertilityTrend: fertilityDecline ? 'below-replacement' : 'stable',     // TFR posture (interpretive)
      mortalityTrend: mortalityAnomaly ? 'elevated' : 'stable',              // CDR posture
      naturalIncreaseTrend: (fertilityDecline && (agingSkew || mortalityAnomaly)) ? 'contracting' : 'stable',
      dependencyRatio: (agingSkew || has('dependency_ratio')) ? 'rising' : 'stable',
      lifeExpectancy: mortalityAnomaly ? 'pressured' : 'stable',
      migrationNetFlow: migrationSurge ? 'inflow-pressure' : (has('displacement_event') ? 'outflow-pressure' : 'balanced'),
      urbanizationRate: (has('city_overcrowding') || has('density_spike')) ? 'accelerating' : 'stable',
      agingIndex: agingSkew ? 'elevated' : 'normal',
      workforceTrend: has('workforce_imbalance') ? 'contracting' : 'stable',
      anchorSeries: { fertility: 'TFR (Total Fertility Rate)', mortality: 'CDR (Crude Death Rate)', naturalIncrease: 'natural increase %', dependency: 'dependency ratio', lifeExpectancy: 'LE', migration: 'net migration', urbanization: 'urban %' },
      dataSources: ['US Census Bureau (decennial + ACS)', 'UN World Population Prospects', 'BLS labor force', 'Pew Research', 'national statistics offices'],
      note: 'real-demographic TRANSITION lifecycle model (fertility/mortality/migration/aging), Census/UN-WPP-anchored; DISTINCT from economy business-cycle model; interpretive (no validated proxy) — never a public default',
      updated: (pm.updated || Date.now())
    });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE H1-H6 — HIGHER POPULATION BRAIN LAYERS (population-local, additive).
  // Computed once per cycle BEFORE the DDP build; immune/awareness/conscience/
  // intuition/simulation/executive. Never fabricates evidence.
  // ════════════════════════════════════════════════════════════════════════════
  PopulationBrain.prototype._populationDiagnosisStates = function () {
    var diags = this.state.diagnoses || [];
    return diags.map(function (d) {
      // Population binds to INDICATORS not source bundles — "bundle" = canonical sub-portal availability.
      return { dxId: d.id, active: !!d.active, relevance: (typeof d.relevance === 'number' ? d.relevance : 0), source: d.source || 'canonical', sourceBacked: d.source === 'canonical' || d.source === 'canonical_deep' };
    });
  };

  // H1 — formal immune system
  PopulationBrain.prototype._computePopulationImmune = function () {
    var s = this.state, pm = s.populationModel || {}, reg = pm.regulation || {}, ds = this._populationDiagnosisStates();
    var ant = [{ type: 'synthetic-migration-model-contamination', severity: 'medium', action: 'quarantine', note: 'unverified demographic proxies / synthetic migration models blocked from evidence' }];
    ds.forEach(function (d) {
      if (d.active && !d.sourceBacked) ant.push({ type: 'unsourced-demographic-proxy', dx: d.dxId, severity: 'medium', action: 'block-from-prompt-evidence' });
    });
    if (!s.feeds || (Array.isArray(s.feeds) ? s.feeds.length === 0 : Object.keys(s.feeds).length === 0)) ant.push({ type: 'missing-census-data', severity: 'medium', action: 'flag', note: 'no live demographic feed (Census/UN/BLS/Pew/ACS) ingested this cycle' });
    var pe = (pm.predictionError && pm.predictionError.total) || 0;
    if (pe > 0.4) ant.push({ type: 'prediction-error-spike', severity: 'medium', action: 'lower-confidence', value: Math.round(pe * 1000) / 1000 });
    if (reg.stale) ant.push({ type: 'stale-demographic-feeds', severity: 'low', action: 'flag' });
    if (reg.flooding) ant.push({ type: 'opportunity-flood', severity: 'medium', action: 'inhibit' });
    if (reg.starving) ant.push({ type: 'unsupported-intervention-readiness-risk', severity: 'low', action: 'flag' });
    var sev = ant.some(function (a) { return a.severity === 'high'; }) ? 'high' : ant.some(function (a) { return a.severity === 'medium'; }) ? 'medium' : ant.length ? 'low' : 'none';
    var im = {
      version: 1, immuneState: sev === 'high' ? 'alert' : sev === 'medium' ? 'active' : sev === 'low' ? 'watch' : 'clear', severity: sev,
      antigens: ant.slice(0, 12),
      quarantines: ['synthetic-migration-models', 'unverified-demographic-proxies', 'fabricated-fine-grained-internal-migration'],
      allowedWithWarning: ant.filter(function (a) { return a.action === 'allow-with-warning'; }).map(function (a) { return a.type + (a.dx ? (':' + a.dx) : ''); }),
      blockedFromPrompt: ant.filter(function (a) { return a.action === 'block-from-prompt-evidence'; }).map(function (a) { return a.dx; }),
      immuneMemory: (((s.populationImmune && s.populationImmune.immuneMemory) || 0) + 1),
      lastScanAt: pm.updated || null
    };
    s.populationImmune = im; return im;
  };

  // H2 — awareness / metacognition
  PopulationBrain.prototype._computePopulationAwareness = function () {
    var s = this.state, pm = s.populationModel || {}, im = s.populationImmune || {}, ds = this._populationDiagnosisStates();
    var active = ds.filter(function (d) { return d.active; });
    var prev = s.populationAwareness || {};
    var pe = (pm.predictionError && pm.predictionError.total) || 0;
    var aw = {
      version: 1,
      selfState: im.immuneState === 'alert' ? 'guarded' : (pm.regulation && pm.regulation.state) || 'unknown',
      knowns: ['age structure (Census/ACS)', 'fertility (TFR)', 'mortality (CDR/life tables)', 'aggregate net migration (Census/UN WPP)'],
      unknowns: ['fine-grained internal migration', 'real-time household formation', 'sub-county demographic detail between census waves'],
      uncertainties: ['demographic models are interpretive (no validated phase proxy)', 'inter-census estimates carry projection error', 'predictionError=' + (Math.round(pe * 1000) / 1000)],
      suppressions: (im.quarantines || []).concat(['synthetic-migration-models']),
      confidenceDrivers: ['active demographic diagnoses ' + active.length + '/' + ds.length, 'regulation ' + ((pm.regulation && pm.regulation.state) || '?')],
      changedSinceLastCycle: { predictionErrorDelta: Math.round((pe - (typeof prev._pe === 'number' ? prev._pe : pe)) * 1000) / 1000, activeNow: active.length },
      selfNarrative: 'Population: ' + active.length + '/' + ds.length + ' active demographic dx, immune=' + (im.immuneState || '?') + ', source=Census/UN-WPP/BLS/Pew/ACS, fine-grained internal migration unknown.',
      lastAwarenessAt: pm.updated || null, _pe: pe
    };
    s.populationAwareness = aw; return aw;
  };

  // H3 — conscience / veto
  PopulationBrain.prototype._computePopulationConscience = function () {
    var s = this.state, pm = s.populationModel || {}, ds = this._populationDiagnosisStates();
    var pe = (pm.predictionError && pm.predictionError.total) || 0;
    var vetoes = [], cautions = [], allowed = [], blocked = ['patent-claim', 'grant-claim'];
    // retired-lane veto removed 2026-07-14: patent/grant are dead lanes; vetoing them forced
    // conscienceState 'restrictive' every cycle. Real vetoes (missing source bundles) still drive it.
    ds.forEach(function (d) {
      if (d.active && !d.sourceBacked) { blocked.push('strong-claim:' + d.dxId); vetoes.push({ claim: 'strong-claim:' + d.dxId, reason: 'unsourced demographic proxy (not Census/UN/BLS/Pew/ACS-backed)' }); }
      else if (d.active) { allowed.push('source-summary:' + d.dxId); }
    });
    if (pe > 0.4) cautions.push({ claim: 'high-confidence-claim', reason: 'predictionError spike ' + (Math.round(pe * 1000) / 1000) });
    var hasSourced = ds.some(function (d) { return d.active && d.sourceBacked; });
    var con = {
      version: 1, conscienceState: vetoes.length ? 'restrictive' : 'permissive',
      vetoes: vetoes.slice(0, 10), cautions: cautions.slice(0, 10),
      allowedClaims: ['source-summary'].concat(hasSourced ? ['research-memo-with-warnings', 'investment-memo-with-warnings'] : []).concat(allowed.slice(0, 6)),
      blockedClaims: blocked.slice(0, 10),
      artifactReadinessDecision: { patentReady: false, grantReady: false, sbaReady: false, investmentReady: hasSourced, researchReady: hasSourced, note: 'patent/grant vetoed (no embodiment); research/investment allowed-with-warning only for source-backed demographic diagnoses' },
      reasons: ['overclaim prevention', 'demographic source sufficiency (Census/UN/BLS/Pew/ACS)', 'no embodiment for patents'],
      lastCheckAt: pm.updated || null
    };
    s.populationConscience = con; return con;
  };

  // H4 — intuition / weak-signal (NOT evidence; labelled unverified)
  PopulationBrain.prototype._computePopulationIntuition = function () {
    var s = this.state, pm = s.populationModel || {}, reg = pm.regulation || {};
    var log = (s.memory && s.memory.outcomeLog) || [];
    var hunches = [];
    if (log.length >= 2) {
      var a = log[log.length - 2].predictionError, b = log[log.length - 1].predictionError;
      if (typeof a === 'number' && typeof b === 'number' && b - a > 0.05) hunches.push({ hunch: 'demographic regime shift forming (fertility-collapse or migration-cycle)', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'predictionError rose ' + a + '->' + b, verifyIf: 'error keeps rising 2+ cycles', falsifyIf: 'error returns to baseline' });
    }
    if (reg.state === 'surprised') hunches.push({ hunch: 'novel demographic stressor entering the system', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'regulation=surprised (high novelty)', verifyIf: 'a diagnosis activates with Census/UN/BLS support', falsifyIf: 'novelty subsides next cycle' });
    // structural-family analogies (analogy, NOT evidence)
    var FAMILY = { 'shrinkage': ['POPULATION_COLLAPSE', 'AGING_CRISIS'], 'flow': ['MASS_MIGRATION'], 'density': ['URBANIZATION_OVERLOAD'], 'shock': ['PANDEMIC_DEMOGRAPHIC_SHOCK'] };
    var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (x, y) { return (y.relevance || 0) - (x.relevance || 0); });
    var primaryId = (active[0] || (s.diagnoses || [])[0] || {}).id;
    var analogies = [];
    Object.keys(FAMILY).forEach(function (fam) { if (FAMILY[fam].indexOf(primaryId) >= 0) { FAMILY[fam].forEach(function (sib) { if (sib !== primaryId) analogies.push({ analogy: primaryId + ' resembles ' + sib, family: fam, label: 'ANALOGY', evidenceStatus: 'UNVERIFIED', note: 'shared demographic failure-family — a lens for monitoring, not a claim' }); }); } });
    var patternMatches = [];
    var recent = log.slice(-10), regCount = {};
    recent.forEach(function (e) { if (e.regulation) regCount[e.regulation] = (regCount[e.regulation] || 0) + 1; });
    Object.keys(regCount).forEach(function (k) { if (regCount[k] >= 3) patternMatches.push({ pattern: 'recurring regulation state: ' + k, occurrences: regCount[k], window: recent.length, label: 'PATTERN', evidenceStatus: 'UNVERIFIED' }); });
    var it = {
      version: 1, hunches: hunches.slice(0, 3), weakSignals: hunches.map(function (h) { return h.why; }),
      patternMatches: patternMatches.slice(0, 5), analogies: analogies.slice(0, 4), confidence: 'LOW', evidenceStatus: 'UNVERIFIED',
      promotedToDiagnosis: [], lastIntuitionAt: pm.updated || null
    };
    s.populationIntuition = it; return it;
  };

  // H5 — simulation / bounded counterfactual (hypothetical only)
  PopulationBrain.prototype._computePopulationSimulation = function () {
    var s = this.state, pm = s.populationModel || {};
    var base = typeof s.stress === 'number' ? s.stress : 0;
    function cl(v) { return Math.max(0, Math.min(1, Math.round(v * 1000) / 1000)); }
    var scenarios = [
      { type: 'aging-acceleration', hypothetical: true, assumption: 'fertility stays below replacement + cohort ages', simulatedStress: cl(base + 0.25), risk: 'dependency-ratio spike + workforce contraction (AGING_CRISIS)', intervention: 'track Census ACS age structure / BLS labor force participation', falsifier: 'TFR recovers toward 2.1 or net in-migration offsets' },
      { type: 'migration-surge', hypothetical: true, assumption: 'displacement / border inflow intensifies', simulatedStress: cl(base + 0.3), risk: 'settlement + service overload (MASS_MIGRATION)', intervention: 'track UN WPP migration + DHS/Census ACS migration flows', falsifier: 'net migration normalizes' },
      { type: 'urbanization-overflow', hypothetical: true, assumption: 'rural→urban shift outpaces housing', simulatedStress: cl(base + 0.22), risk: 'housing shortage + density strain (URBANIZATION_OVERLOAD)', intervention: 'track Census urban %/housing starts', falsifier: 'urban growth flattens' },
      { type: 'stabilize', hypothetical: true, assumption: 'indicators hold', simulatedStress: cl(base), risk: 'persistent elevated baseline', intervention: 'maintain monitoring cadence', falsifier: 'an indicator moves materially' },
      { type: 'recover', hypothetical: true, assumption: 'stressor reverses', simulatedStress: cl(base - 0.2), risk: 'premature de-escalation', intervention: 'confirm with 2 independent demographic sources before standing down', falsifier: 'stress re-rises' }
    ];
    var sim = {
      version: 1, scenarios: scenarios, assumptions: scenarios.map(function (x) { return x.assumption; }),
      simulatedStress: scenarios.map(function (x) { return x.simulatedStress; }),
      simulatedDiagnoses: ['AGING_CRISIS', 'MASS_MIGRATION', 'URBANIZATION_OVERLOAD'], simulatedOpportunities: [],
      risks: scenarios.map(function (x) { return x.risk; }), interventions: scenarios.map(function (x) { return x.intervention; }),
      falsifiers: scenarios.map(function (x) { return x.falsifier; }), lastSimulatedAt: pm.updated || null
    };
    s.populationSimulation = sim; return sim;
  };

  // H6 — executive self-report (compact status card)
  PopulationBrain.prototype._computePopulationExecutiveReport = function () {
    var s = this.state, pm = s.populationModel || {}, im = s.populationImmune || {}, aw = s.populationAwareness || {}, con = s.populationConscience || {}, it = s.populationIntuition || {}, sim = s.populationSimulation || {}, ds = this._populationDiagnosisStates();
    var sourced = ds.filter(function (d) { return d.active && d.sourceBacked; }).length;
    var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var strongest = active[0] || (s.diagnoses || [])[0] || null;
    var pe = (pm.predictionError && pm.predictionError.total) || 0;
    var hasFeeds = s.feeds && (Array.isArray(s.feeds) ? s.feeds.length > 0 : Object.keys(s.feeds).length > 0);
    var status = im.immuneState === 'alert' ? 'immune-alert' : !hasFeeds ? 'data-incomplete' : sourced === 0 && active.length > 0 ? 'source-limited' : (pm.regulation && pm.regulation.starving) ? 'starving' : (pm.regulation && pm.regulation.state === 'surprised') ? 'surprised' : 'healthy';
    var rep = {
      version: 1, brainStatus: status,
      dataComplete: !!hasFeeds, humanVerified: false, sourceLimited: sourced === 0 && active.length > 0,
      strongestDiagnosis: strongest ? strongest.id : null,
      strongestOpportunity: (s.opportunities && s.opportunities[0] && s.opportunities[0].title) || null,
      confidence: Math.round((1 - pe) * 100) / 100, predictionError: Math.round(pe * 1000) / 1000,
      regulationState: (pm.regulation && pm.regulation.state) || null, immuneState: im.immuneState || null,
      awarenessSummary: aw.selfNarrative || null, conscienceDecision: con.conscienceState || null,
      intuitionSummary: (it.hunches || []).length + ' hunch(es)', simulationSummary: (sim.scenarios || []).length + ' scenario(s)',
      artifactReadiness: con.artifactReadinessDecision || null, blockers: (con.blockedClaims || []).slice(0, 6),
      nextBestAction: !hasFeeds ? 'ingest live demographic feed (Census/UN WPP/BLS/Pew/ACS)' : sourced === 0 ? 'source-back active demographic diagnoses' : 'monitor strongest demographic diagnosis indicators',
      lastReportAt: pm.updated || null
    };
    s.populationExecutiveReport = rep; return rep;
  };

  PopulationBrain.prototype._computePopulationHigherLayers = function () {
    this._computePopulationImmune();
    this._computePopulationAwareness();
    this._computePopulationConscience();
    this._computePopulationIntuition();
    this._computePopulationSimulation();
    this._computePopulationExecutiveReport();
  };

  // ════════════════════════════════════════════════════════════════════════════
  // DEMOGRAPHIC-TRANSITION SUB-LAYER (additive; mirrors energy's data-center layer).
  // Loads REAL population sub-portals (aging + labor-migration) as a SEPARATE first-class
  // layer. NEVER merged into the validated 5-diagnosis spine; emits per-diagnosis DDPs.
  // ════════════════════════════════════════════════════════════════════════════
  PopulationBrain.prototype._loadDemographicTransitionDiagnoses = function () {
    var self = this;
    if (self._dtLoadPromise) return self._dtLoadPromise;
    var FILES = [
      { file: 'population_lifespan_agingpop', branch: 'aging-dynamics' },
      { file: 'population_labor_migration', branch: 'migration-flow' }
    ];
    self._dtPortal = { issues: [], activations: [], title: 'Demographic Transition' };
    self._dtLoadPromise = Promise.all(FILES.map(function (entry) {
      return fetch('/assets/data/domains/' + encodeURIComponent(entry.file) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) {
          if (!data) return;
          (data.issues || []).forEach(function (iss) { self._dtPortal.issues.push({ id: iss.id, label: iss.label, summary: iss.summary || '', circuits: iss.circuits || [], branch: entry.branch }); });
          (data.activations || []).forEach(function (act) { act._branch = entry.branch; self._dtPortal.activations.push(act); });
        })
        .catch(function () {});
    })).then(function () { return self._dtPortal; });
    return self._dtLoadPromise;
  };

  PopulationBrain.prototype._buildDemographicTransitionLayer = function () {
    var self = this;
    var dt = self._dtPortal;
    if (!dt || !dt.issues || !dt.issues.length) {
      self.state.demographicTransitionDiagnoses = [];
      self.state.demographicTransitionTreatments = [];
      self.state.demographicTransitionDomainDiagnosisPackets = [];
      self.state.demographicTransitionLayer = { loaded: false, count: 0, activeCount: 0, diagnoses: [], note: 'demographic-transition sub-portals not loaded (offline or fetch failed)' };
      return self.state.demographicTransitionLayer;
    }
    var conditions = self._activeConditions || [];
    var diagnoses = dt.issues.map(function (iss) {
      var triggers = (self.diagnosisIndex && self.diagnosisIndex[iss.id]) || [];
      var matchCount = 0;
      for (var t = 0; t < triggers.length; t++) { for (var c = 0; c < conditions.length; c++) { if (conditions[c] === triggers[t] || String(conditions[c]).indexOf(triggers[t]) !== -1) matchCount++; } }
      return { id: iss.id, label: iss.label, summary: iss.summary || '', active: matchCount > 0, relevance: triggers.length ? Math.round((matchCount / triggers.length) * 100) / 100 : 0, circuits: iss.circuits || [], source: 'demographic-transition', tier: 'real-content-unbundled', branch: iss.branch };
    });
    var nodeToDx = {};
    diagnoses.forEach(function (d) { (d.circuits || []).forEach(function (c) { if (c && c.nodeId) nodeToDx[c.nodeId] = d.id; }); });
    var treatments = [];
    (dt.activations || []).forEach(function (act) {
      var dxId = nodeToDx[act.brainNodeId];
      if (!dxId) return;
      (act.treatments || []).forEach(function (t, ti) {
        treatments.push({ id: 'dt_treat_' + act.brainNodeId + '_' + ti, label: t.label, type: t.type, evidence: t.evidence, description: t.description || '', cite: t.cite || null, citation: t.citation || [], steps: t.steps || [], diagnosisId: dxId, nodeId: act.brainNodeId, source: 'demographic-transition', branch: act._branch });
      });
    });
    var evidenceRank = { A: 10, Strong: 10, B: 7, Moderate: 7, C: 4, Emerging: 1 };
    treatments.sort(function (a, b) { return (evidenceRank[b.evidence] || 0) - (evidenceRank[a.evidence] || 0); });
    self.state.demographicTransitionDiagnoses = diagnoses;
    self.state.demographicTransitionTreatments = treatments;
    self.state.demographicTransitionLayer = {
      loaded: true,
      portalTitle: dt.title,
      count: diagnoses.length,
      activeCount: diagnoses.filter(function (d) { return d.active; }).length,
      branches: ['aging-dynamics', 'migration-flow'],
      diagnoses: diagnoses.map(function (d) { return { id: d.id, label: d.label, active: d.active, branch: d.branch, treatmentCount: treatments.filter(function (t) { return t.diagnosisId === d.id; }).length }; }),
      note: 'real-content (hand-authored) demographic sub-portals (aging-dynamics + migration-flow); SEPARATE from the validated 5-diagnosis spine; additive only, never merged'
    };
    self.state.demographicTransitionDomainDiagnosisPackets = diagnoses.map(function (d) {
      try { return self._buildDomainDiagnosisPacket(d); } catch (e) { return null; }
    }).filter(Boolean);
    return self.state.demographicTransitionLayer;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // POPULATION DomainDiagnosisPacket SCHEMA (schema-only; NEVER invents data).
  // 8-section contract; domain='population'; mirrors energy's _buildDomainDiagnosisPacket.
  // ════════════════════════════════════════════════════════════════════════════
  var PM_DDP_SCHEMA_VERSION = 'population-ddp-1';
  function _pmDdpPresent(v) {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (v === 'missing' || v === '' || v === 'none') return false;
    return true;
  }
  function _pmDdpCompleteness(section, keys) {
    var have = 0; for (var i = 0; i < keys.length; i++) { if (_pmDdpPresent(section[keys[i]])) have++; }
    return { have: have, total: keys.length, pct: keys.length ? Math.round(have / keys.length * 100) : 0 };
  }

  PopulationBrain.prototype._buildDomainDiagnosisPacket = function (dx) {
    var s = this.state || {};
    var pm = s.populationModel || {};
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

    // source feeds (REAL demographic sources only)
    var feeds = s.feeds || [], sourceFeeds = [];
    if (Array.isArray(feeds)) { feeds.forEach(function (f) { sourceFeeds.push({ name: f.name || null, updated: f.updated || null, source: f.source || null }); }); }
    else { for (var fk in feeds) { if (feeds.hasOwnProperty(fk)) { var f2 = feeds[fk]; sourceFeeds.push({ name: fk, updated: (f2 && f2.updated) || null, source: (f2 && f2.source) || null }); } } }

    var identity = {
      domain: 'population',
      diagnosisId: dxId,
      canonicalDiagnosisId: dxId,          // population diagnoses are canonical to self (indicator-bound, no alias map)
      aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null,
      label: dx ? (dx.label || dx.id || null) : null,
      phase: s.phase || null,
      confidence: (dx && typeof dx.relevance === 'number') ? dx.relevance : (typeof s.confidence === 'number' ? s.confidence : null)
    };

    var brainState = {
      populationModel: { version: pm.version || null, cycle: (typeof pm.cycle === 'number' ? pm.cycle : null) },
      predictionError: pm.predictionError || null,
      regulationState: (pm.regulation && pm.regulation.state) || null,
      prior: pm.prior || null,
      observation: pm.observation || null,
      plasticity: pm.plasticity || null,
      readyForHandoff: pm.readyForHandoff === true
    };

    var rootId = (portal && portal.domainId) || 'population';
    var rootTitle = (portal && portal.title) || 'Population';
    var ancestry = (portal && portal.parentLabel) ? [portal.parentLabel, rootTitle] : [rootTitle];
    var portalContext = {
      portalIds: [rootId],
      portalDomain: 'population',
      portalTitle: rootTitle,
      depth: 0,
      ancestryPath: ancestry,
      portalStatus: portal ? 'root-only' : 'pending',
      sourceCompleteness: portal ? ((Array.isArray(portal.issues) && portal.issues.length) ? 'partial' : 'thin') : 'root-only',
      demographicTransition: (s.demographicTransitionLayer && s.demographicTransitionLayer.loaded) ? { count: s.demographicTransitionLayer.count, activeCount: s.demographicTransitionLayer.activeCount, branches: s.demographicTransitionLayer.branches } : null
    };

    var citationHints = sourceFeeds.map(function (sf) { return sf.source || sf.name; }).filter(Boolean);
    // evidence anchors = REAL demographic source families only (Census/UN WPP/BLS/Pew/ACS); never fabricated
    var evidenceAnchors = [];
    var missingEv = [];
    if (!evidenceAnchors.length) missingEv.push('evidenceAnchors');
    if (!citationHints.length) missingEv.push('citationHints');
    var sourceBacked = !!(dx && (dx.source === 'canonical' || dx.source === 'canonical_deep'));
    var evidence = {
      sourceFeeds: sourceFeeds,
      evidenceAnchors: evidenceAnchors,
      citationHints: citationHints,
      bundleStatus: sourceBacked ? 'indicator-backed' : 'missing',
      bundleResolution: sourceBacked ? 'canonical-indicator' : 'missing',
      bundle: null,
      authoritativeSources: ['US Census Bureau (decennial + ACS)', 'UN World Population Prospects', 'BLS labor force', 'Pew Research', 'ACS migration'],
      missingEvidence: missingEv
    };

    var treatmentContext = {
      treatments: treatments,
      implementationSteps: implementationSteps,
      // population interventions are POLICY recommendations — no patent/grant invention candidates
      methodCandidates: [], mechanismCandidates: [], embodimentCandidates: [], figurePlaceholders: [],
      policyContext: 'demographic interventions are policy/program recommendations (not patents/grants); evidence from Census/UN/BLS/Pew/ACS only'
    };

    var operatorContext = {
      targets: (primaryOpp && primaryOpp._resolvedTargets) ? primaryOpp._resolvedTargets : (mc && mc.target ? [mc.target] : []),
      monitoring: (treatments.length && treatments[0].monitoring) ? treatments[0].monitoring : null,
      escalation: (treatments.length && treatments[0].escalation) ? treatments[0].escalation : null,
      invalidIf: mc ? (mc.invalidIf || null) : null,
      nextStep: mc ? (mc.nextStep || null) : null
    };

    var hasTreat = treatments.length > 0;
    var blockers = [];
    if (!sourceBacked) blockers.push('indicator-not-source-backed');
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
    if (sourceBacked) readinessReasons.push('indicator source-backed (canonical demographic diagnosis)');
    if (hasTreat) readinessReasons.push('treatments present (' + treatments.length + ')');
    if (primaryOpp) readinessReasons.push('opportunity present (path=' + (primaryOpp.path || '?') + ')');
    if (sourceFeeds.length) readinessReasons.push('source feeds present (' + sourceFeeds.length + ')');
    var artifactContext = {
      artifactLanes: artifactLanes,
      patentReady: false, grantReady: false, sbaReady: false,   // demographic analysis has no embodiment (H3 vetoes)
      investmentReady: !!(hasTreat && primaryOpp), researchReady: sourceBacked || hasTreat,
      readinessReasons: readinessReasons,
      blockers: blockers
    };

    var comp = {
      identity:         _pmDdpCompleteness(identity, ['domain', 'diagnosisId', 'canonicalDiagnosisId', 'label', 'phase', 'confidence']),
      brainState:       _pmDdpCompleteness(brainState, ['populationModel', 'predictionError', 'regulationState', 'prior', 'observation', 'plasticity']),
      portalContext:    _pmDdpCompleteness(portalContext, ['portalIds', 'portalDomain', 'portalTitle', 'depth', 'ancestryPath']),
      evidence:         _pmDdpCompleteness(evidence, ['sourceFeeds', 'evidenceAnchors', 'citationHints']),
      treatmentContext: _pmDdpCompleteness(treatmentContext, ['treatments', 'implementationSteps']),
      operatorContext:  _pmDdpCompleteness(operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']),
      artifactContext:  _pmDdpCompleteness(artifactContext, ['artifactLanes'])
    };
    var totHave = 0, totAll = 0;
    for (var sk in comp) { if (comp.hasOwnProperty(sk)) { totHave += comp[sk].have; totAll += comp[sk].total; } }
    var missingFields = [];
    function _cm(name, obj, keys) { for (var i = 0; i < keys.length; i++) { if (!_pmDdpPresent(obj[keys[i]])) missingFields.push(name + '.' + keys[i]); } }
    _cm('identity', identity, ['confidence']);
    _cm('evidence', evidence, ['evidenceAnchors', 'citationHints']);
    _cm('treatmentContext', treatmentContext, ['treatments', 'implementationSteps']);
    _cm('operatorContext', operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']);

    var warnings = [];
    if (portalContext.portalStatus === 'root-only') warnings.push('portalContext is root-only (no deep portal cortex)');
    if (portalContext.portalStatus === 'pending') warnings.push('root portal not yet cached on the brain (domain identity used)');
    if (!sourceBacked) warnings.push('diagnosis is not source-backed (indicator inference only — verify against Census/UN/BLS/Pew/ACS)');
    if (!evidence.citationHints.length) warnings.push('no live demographic feed citations this cycle');
    warnings.push('demographic interventions are policy recommendations; patent/grant lanes not applicable (no embodiment)');
    if (!primaryOpp && (typeof s.stress !== 'number' || s.stress < PM_STRESS_FLOOR)) warnings.push('no active opportunity (offline/low-stress) — operator/lane fields stay empty');

    var pct = totAll ? Math.round(totHave / totAll * 100) : 0;
    var proofTier = pct >= 70 ? 'full' : (pct >= 35 ? 'partial' : 'sparse');

    var G2_CAPS = { evidenceAnchors: 8, treatments: 8, implementationSteps: 8, citationHints: 8, sourceFeeds: 8 };
    function _g2cap(arr, n) { arr = Array.isArray(arr) ? arr : []; return { sel: arr.slice(0, n), omitted: Math.max(0, arr.length - n) }; }
    var _g2ea = _g2cap(evidenceAnchors, G2_CAPS.evidenceAnchors);
    var _g2tr = _g2cap(treatmentContext.treatments, G2_CAPS.treatments);
    var _g2is = _g2cap(treatmentContext.implementationSteps, G2_CAPS.implementationSteps);
    var _g2ch = _g2cap(citationHints, G2_CAPS.citationHints);
    var _g2sf = _g2cap(sourceFeeds, G2_CAPS.sourceFeeds);
    var promptView = {
      compact: true,
      caps: G2_CAPS,
      selectedEvidenceAnchors: _g2ea.sel,
      selectedTreatments: _g2tr.sel,
      selectedImplementationSteps: _g2is.sel,
      selectedCitationHints: _g2ch.sel,
      selectedSourceFeeds: _g2sf.sel,
      omittedCounts: { evidenceAnchors: _g2ea.omitted, treatments: _g2tr.omitted, implementationSteps: _g2is.omitted, citationHints: _g2ch.omitted, sourceFeeds: _g2sf.omitted },
      priorityReasons: [
        'diagnosis-specific demographic indicators preferred over generic population narrative',
        'official/primary demographic sources retained (Census/UN WPP/BLS/Pew/ACS)',
        'policy interventions preferred over broad narrative under prompt-space limits',
        'caps applied per field; full data preserved in the full DDP'
      ],
      retainedWarnings: warnings
        .concat(s.populationImmune ? ['immune: ' + s.populationImmune.immuneState + ' (sev ' + s.populationImmune.severity + ', ' + (s.populationImmune.antigens || []).length + ' antigens)'] : [])
        .concat(s.populationConscience && s.populationConscience.conscienceState === 'restrictive' ? ['conscience: ' + (s.populationConscience.blockedClaims || []).slice(0, 3).join(', ') + ' blocked'] : []),
      retainedBlockers: artifactContext.blockers,
      // H1-H6 — compact higher-layer summaries
      immuneSummary: s.populationImmune ? { immuneState: s.populationImmune.immuneState, severity: s.populationImmune.severity, antigenCount: (s.populationImmune.antigens || []).length, quarantines: s.populationImmune.quarantines } : null,
      awarenessSummary: s.populationAwareness ? { selfNarrative: s.populationAwareness.selfNarrative, knowns: (s.populationAwareness.knowns || []).length, unknowns: (s.populationAwareness.unknowns || []).length } : null,
      conscienceDecision: s.populationConscience ? { conscienceState: s.populationConscience.conscienceState, blockedClaims: s.populationConscience.blockedClaims, artifactReadinessDecision: s.populationConscience.artifactReadinessDecision } : null,
      intuitionSummary: s.populationIntuition ? s.populationIntuition.hunches : null,
      scenarioSummary: s.populationSimulation ? (s.populationSimulation.scenarios || []).map(function (x) { return { type: x.type, hypothetical: x.hypothetical, risk: x.risk }; }) : null,
      executiveReport: s.populationExecutiveReport || null,
      demographicTransitionSummary: s.demographicTransitionLayer && s.demographicTransitionLayer.loaded ? { count: s.demographicTransitionLayer.count, activeCount: s.demographicTransitionLayer.activeCount, branches: s.demographicTransitionLayer.branches, note: s.demographicTransitionLayer.note } : null,
      brainPopulationModel: s.brainPopulationModel ? { demographicTransitionPhase: s.brainPopulationModel.demographicTransitionPhase, fertilityTrend: s.brainPopulationModel.fertilityTrend, migrationNetFlow: s.brainPopulationModel.migrationNetFlow, dependencyRatio: s.brainPopulationModel.dependencyRatio } : null
    };

    return {
      schemaVersion: PM_DDP_SCHEMA_VERSION,
      promptView: promptView,
      identity: identity,
      brainState: brainState,
      portalContext: portalContext,
      evidence: evidence,
      treatmentContext: treatmentContext,
      operatorContext: operatorContext,
      artifactContext: artifactContext,
      audit: {
        generatedAt: (pm.updated || null),
        schemaVersion: PM_DDP_SCHEMA_VERSION,
        fieldCompleteness: { sections: comp, overallPct: pct },
        missingFields: missingFields,
        warnings: warnings,
        proofTier: proofTier,
        immune: s.populationImmune || null,
        awareness: s.populationAwareness || null,
        conscience: s.populationConscience || null,
        intuition: s.populationIntuition || null,
        simulation: s.populationSimulation || null,
        executiveReport: s.populationExecutiveReport || null
      }
    };
  };

  // ════════════════════════════════════════════════════════════════════════════
  // ACTUATION LAYER (ported from energy-brain, validity-gated). Runs once per cycle
  // inside _updatePopulationModel, AFTER the higher layers (immune/conscience/reg) and
  // BEFORE the DDP build so packets can embed the actuated state. Deterministic; no AI.
  //   servo  -> brake (E/I contribution) -> regulation advisories (E/I + SPOF selfAudit)
  //   -> phase dynamics (ADVISORY). Each guarded; a throw never breaks the cycle.
  // ════════════════════════════════════════════════════════════════════════════
  PopulationBrain.prototype._computePopulationActuation = function () {
    try { if (this._actuation && this._actuation.servo) this._computePopulationServo(); } catch (e) {}
    try { this._computePopulationBrake(); } catch (e) {}                     // HALT/DAMPEN stop-circuit (E/I contribution gated by _actuation.eiBrake)
    try { this._computePopulationRegulationAdvisories(); } catch (e) {}      // E/I balance + SPOF self-audit (observe-only)
    try { this._computePopulationPhaseDynamics(); } catch (e) {}            // ADVISORY coherence router (never actuated for P5)
  };

  // ── REGULATE-TO-TARGET SERVO (Neuro Ref XIII.1 E/I + V.2/XII allostasis) ──────────────────────
  // SENSOR: excitatory drive (stress + how many things fire at once) vs current inhibition.
  // TARGET: inhibition must track drive AND rise with deviation above the recurrent model's adaptive
  //         baseline (prior.expectedStress — population's stand-in for a K8 homeostat).
  // CONTROLLER: PI (fast proportional + bounded slow integral, the HPA fast+slow arms).
  // EFFECTOR: a proportional emission-dampening factor the brake consumes (same channel the brake
  //           already uses). Only ADDS braking; never disinhibits. Affects emission confidence only —
  //           never rewrites stress / scoring / diagnoses / population.json. Reversible via _actuation.servo.
  PopulationBrain.prototype._computePopulationServo = function () {
    function R(x) { return Math.round(x * 1000) / 1000; }
    var s = this.state, pm = s.populationModel || {}, reg = pm.regulation || {}, prior = pm.prior || {};
    var stress = (typeof s.stress === 'number') ? s.stress : 0;
    var conds = Array.isArray(s._activeConditions) ? s._activeConditions.length
      : (Array.isArray(this._activeConditions) ? this._activeConditions.length : (Array.isArray(s.signals) ? s.signals.length : 0));
    var dxA = Array.isArray(s.diagnoses) ? s.diagnoses.filter(function (d) { return d && d.active; }).length : 0;
    var drive = Math.max(0, Math.min(2, stress + Math.min(conds, 12) / 24 + Math.min(dxA, 6) / 24));
    var inhibition = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;   // live regulation term
    var FLOOR = 0.15;
    // adaptive baseline: the recurrent model's prior expected stress (samples-gated so a cold prior
    // does not manufacture deviation). This is population's honest substitute for energy's K8 set-point.
    var baseline = (typeof prior.expectedStress === 'number' && prior.samples >= 5) ? prior.expectedStress : null;
    var deviation = baseline == null ? 0 : Math.max(0, stress - baseline);
    var target = Math.max(FLOOR, Math.min(1, Math.max(drive, FLOOR + deviation)));
    var error = target - inhibition;                                              // >0 => under-braked for the drive/regime
    this._servoIntegral = Math.max(-0.5, Math.min(0.5, (this._servoIntegral || 0) + error * 0.15));
    var Kp = 0.8, Ki = 0.4;
    var correction = Math.max(0, Kp * error + Ki * Math.max(0, this._servoIntegral));   // only ADD braking
    var emissionFactor = Math.max(0.2, Math.min(1, 1 - correction));
    var state = error > 0.25 ? 'runaway-risk' : ((inhibition - target) > 0.4 ? 'over-inhibited' : 'balanced');
    var servo = {
      version: 1, actuated: true, drive: R(drive), inhibition: R(inhibition), target: R(target),
      error: R(error), integral: R(this._servoIntegral), emissionFactor: R(emissionFactor),
      state: state, deviation: R(deviation), baseline: baseline == null ? null : R(baseline),
      note: 'closed-loop allostasis: drives inhibition toward a drive+deviation target; effector = proportional emission dampening. Baseline = recurrent-model prior (no K8). Neuro Ref XIII.1/V.2/XII.'
    };
    s.populationServo = servo;
    return servo;
  };

  // ── HALT BRAKE (stop-circuit) — converts the governor layers (immune/conscience/regulation) +
  //    the servo E/I signal into an actual brake, not just an annotation. Computed at cycle end,
  //    CONSUMED next cycle by _checkDiagnosisActions (action drafts) and _applyPopulationEmissionBrake
  //    (opportunities). One-cycle lag. Fail-open when brake state is absent (cycle 1). Additive;
  //    never rewrites the scoring spine. ──
  PopulationBrain.prototype._computePopulationBrake = function () {
    var s = this.state, pm = s.populationModel || {}, reg = pm.regulation || {};
    var im = s.populationImmune || {}, con = s.populationConscience || {};
    var diags = s.diagnoses || [];
    var activeUnblocked = diags.filter(function (d) { return d.active && !d.blocked; });
    var reasons = [];
    // full-halt conditions — acting here would be unsafe or unsupported
    if (im.immuneState === 'alert') reasons.push({ code: 'immune-alert', severity: 'halt', detail: 'immune severity ' + (im.severity || '?') });
    if (reg.stale) reasons.push({ code: 'stale-feeds', severity: 'halt', detail: 'demographic feeds older than staleness window' });
    if (diags.length && activeUnblocked.length === 0) reasons.push({ code: 'no-evidence-backed-diagnosis', severity: 'halt', detail: 'all active diagnoses blocked by the evidence contract' });
    // dampen conditions — emit at reduced confidence, hold for review
    var pe = (pm.predictionError && pm.predictionError.total) || 0;
    if (pe > 0.4) reasons.push({ code: 'prediction-error-spike', severity: 'dampen', detail: 'predictionError ' + (Math.round(pe * 1000) / 1000) });
    if (reg.flooding) reasons.push({ code: 'opportunity-flood', severity: 'dampen', detail: 'opportunity count above flood cap' });
    if (con.conscienceState === 'restrictive' && con.artifactReadinessDecision && !con.artifactReadinessDecision.researchReady && !con.artifactReadinessDecision.investmentReady) reasons.push({ code: 'conscience-no-lane', severity: 'dampen', detail: 'no artifact lane cleared by conscience' });
    // E/I BRAKE ACTUATION (Neuro Ref XIII.1): the brake scales PROPORTIONALLY with drive via the
    // regulate-to-target servo — inhibition that does not track drive raises the brake continuously,
    // not just in discrete steps. Reversible (this._actuation.eiBrake). Effector = emission dampening.
    var servo = s.populationServo || null, eiFactor = 1;
    if (this._actuation && this._actuation.eiBrake && servo) {
      if (typeof servo.emissionFactor === 'number') eiFactor = servo.emissionFactor;
      if (servo.state === 'runaway-risk') reasons.push({ code: 'ei-imbalance', severity: 'dampen', detail: 'inhibition ' + servo.inhibition + ' below target ' + servo.target + ' (drive ' + servo.drive + ')' });
    }
    var halt = reasons.some(function (r) { return r.severity === 'halt'; });
    var dampen = reasons.some(function (r) { return r.severity === 'dampen'; });
    var level = halt ? 'halt' : dampen ? 'dampen' : 'clear';
    var brake = {
      version: 1, level: level, engaged: halt, dampen: dampen, reasons: reasons,
      suppressActions: halt, suppressOpportunities: halt,
      confidencePenalty: Math.min(halt ? 0 : dampen ? 0.5 : 1, eiFactor),   // discrete governor penalty blended with proportional E/I (min = strongest brake wins)
      eiFactor: (Math.round(eiFactor * 1000) / 1000),
      note: level === 'clear' ? 'stop-circuit clear — emission allowed'
        : level === 'halt' ? 'STOP-CIRCUIT ENGAGED — action emission halted, opportunities held'
        : 'stop-circuit dampening — confidence reduced, emission held for review',
      lastBrakeAt: pm.updated || Date.now()
    };
    s.populationBrake = brake; return brake;
  };

  // ── E/I BALANCE + SELF-AUDIT ADVISORIES (observe-only; Neuro Ref XIII.1 + XIV) ────────────────
  // (1) E/I balance: is inhibition tracking drive? Inline assess (mirrors limen-ei-balance).
  // (2) Self-audit: CONSUME the diaschisis / single-point-of-failure audit on population.json's
  //     REAL 72-edge graph (articulation nodes + degree hubs). Edges live only in the JSON (the
  //     live snapshot carries signals/stress only), so lazily fetch + cache them once. Deterministic,
  //     no AI, no writes. The brain SEES its own runaway risk + brittle demographic nodes each cycle.
  PopulationBrain.prototype._computePopulationRegulationAdvisories = function () {
    var s = this.state, self = this, out = { version: 1, observeOnly: true };

    // (1) E/I balance — inline (population has no LIMENEIBalance module).
    try {
      var servo = s.populationServo || {};
      var drive = (typeof servo.drive === 'number') ? servo.drive : 0;
      var inhibition = (typeof servo.inhibition === 'number') ? servo.inhibition : 0;
      var FLOOR = 0.15, UNDER = 0.5, OVER = 2.0;
      var required = Math.max(FLOOR, Math.min(1, drive));
      var ratio = inhibition / Math.max(drive, 1e-6);
      var eiState = (drive > FLOOR && ratio < UNDER) ? 'runaway-risk'
        : (ratio > OVER && inhibition > FLOOR) ? 'over-inhibited' : 'balanced';
      out.eiBalance = {
        drive: Math.round(drive * 1000) / 1000, inhibition: Math.round(inhibition * 1000) / 1000,
        required: Math.round(required * 1000) / 1000, ratio: Math.round(ratio * 1000) / 1000,
        state: eiState, deficit: Math.round((required - inhibition) * 1000) / 1000,
        note: eiState === 'runaway-risk' ? 'inhibition not tracking drive; raise braking toward ' + Math.round(required * 1000) / 1000 + ' (Neuro Ref XIII.1)'
          : eiState === 'over-inhibited' ? 'braking exceeds drive; risk of silencing real demographic signal'
          : 'excitation and inhibition balanced'
      };
    } catch (e) { out.eiBalance = null; }

    // (2) Self-audit on the REAL 72-edge population graph. Lazily fetch + cache the edges.
    try {
      var edges = (Array.isArray(this._populationEdges) && this._populationEdges) || null;
      if (!edges) {
        if (typeof fetch === 'function' && !this._populationEdgesPromise) {
          this._populationEdgesPromise = fetch('/assets/data/domains/population.json')
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (j) { if (j && Array.isArray(j.edges)) self._populationEdges = j.edges; })
            .catch(function () {});
        } else if (typeof require === 'function') {
          try { var ed = require('../../data/domains/population.json'); if (ed && Array.isArray(ed.edges)) { this._populationEdges = ed.edges; edges = ed.edges; } } catch (_e) {}
        }
      }
      if (edges && edges.length) {
        out.selfAudit = _populationSPOF(edges);
      } else {
        out.selfAudit = { consumed: false, note: 'population edges loading (async, next cycle)' };
      }
    } catch (e) { out.selfAudit = { consumed: false, error: String(e && e.message || e).slice(0, 80) }; }

    s.populationRegulationAdvisories = out;
    return out;
  };

  // Inline diaschisis / SPOF audit (Neuro Ref XIV) — articulation nodes + degree hubs on the graph.
  // Self-contained (population has no LIMENConnectivityAudit module and this file touches no other).
  function _populationComponentCount(nodes, edges) {
    var adj = {}; nodes.forEach(function (n) { adj[n] = []; });
    edges.forEach(function (e) { if (adj[e.source] && adj[e.target]) { adj[e.source].push(e.target); adj[e.target].push(e.source); } });
    var seen = {}, comps = 0;
    nodes.forEach(function (n) {
      if (seen[n]) return; comps++; var stack = [n];
      while (stack.length) { var x = stack.pop(); if (seen[x]) continue; seen[x] = 1; adj[x].forEach(function (y) { if (!seen[y]) stack.push(y); }); }
    });
    return comps;
  }
  function _populationSPOF(edges) {
    var nodeSet = {};
    edges.forEach(function (e) { nodeSet[e.source] = 1; nodeSet[e.target] = 1; });
    var nodes = Object.keys(nodeSet);
    var base = _populationComponentCount(nodes, edges);
    var spof = [];
    nodes.forEach(function (n) {
      var remainingNodes = nodes.filter(function (x) { return x !== n; });
      var remainingEdges = edges.filter(function (e) { return e.source !== n && e.target !== n; });
      var c = _populationComponentCount(remainingNodes, remainingEdges);
      if (c > base) spof.push({ node: n, componentsAfterRemoval: c, baseComponents: base });
    });
    var deg = {}; edges.forEach(function (e) { deg[e.source] = (deg[e.source] || 0) + 1; deg[e.target] = (deg[e.target] || 0) + 1; });
    var hubs = Object.keys(deg).map(function (n) { return { node: n, degree: deg[n] }; }).sort(function (a, b) { return b.degree - a.degree; }).slice(0, 5);
    return {
      consumed: true, edgeCount: edges.length, baseComponents: base,
      spofCount: spof.length, spof: spof.slice(0, 5), articulationNodes: spof.slice(0, 5),
      topHubsByDegree: hubs,
      verdict: spof.length ? spof.length + ' articulation node(s) = single points of failure' : 'no articulation nodes (graph degrades gracefully)',
      rule: 'XIV diaschisis: the network, not the node, is the unit of failure. Articulation nodes are brittle single points; high-degree hubs concentrate risk.',
      note: 'read-only diagnostic on the real population 72-edge graph; adding redundant paths is a recommendation, not applied.'
    };
  }

  // ── PHASE-COHERENCE ROUTER + PHASE-TRANSITION RECORD — ADVISORY ONLY for population ────────────
  // Population's domain phase is P5, which is NOT a Thing1-validated phase (validated = P3/P7 family).
  // A thing2 phase transition is SELF-CONSISTENCY calibration (interpretive), NEVER external / ground-
  // truth reward; on the P3/P7 family it could at most feed the phase-consistency TIER of the central
  // K4 gate (still self-consistency). P5 is outside that family, so this layer is OBSERVE-ONLY: it computes the
  // coherence router (which co-phased, stressed peers population would couple to) and records any
  // transition, but ALWAYS marks the transition non-validated (advisory-self-consistency) and NEVER
  // preempts a credit source or opens the opportunity gate. This is population's UNMAPPED boundary,
  // the honest analog of Energy's observe-only E/I. To actuate, a validated P3/P7 phase signal would
  // first have to exist for population (it does not). Deterministic; no AI; no writes.
  // Per-cycle: append population's primary STRESS scalar (s.stress; up=bad) to the persistent series,
  // cap at 60, persist, then run the Thing2 kernel over it to derive an interpretive P0-P10 phase.
  // Deterministic pure-math (no network/AI). On any failure or when the adapter/history is
  // unavailable, _kernelPhase stays null and the caller falls back to s.phase (path unchanged).
  // positive:false because the scalar rises with distress (STRESS metric, up = worse).
  PopulationBrain.prototype._updatePhaseKernel = function () {
    var s = this.state;
    var scalar = (typeof s.finalStress === 'number') ? s.finalStress
               : (typeof s.brainStress === 'number') ? s.brainStress
               : (typeof s.stress === 'number') ? s.stress : null;
    try {
      if (scalar != null && isFinite(scalar)) {
        this._phaseSeries.push(scalar);
        while (this._phaseSeries.length > 60) this._phaseSeries.shift();
        try {
          if (typeof localStorage !== 'undefined' && localStorage) {
            localStorage.setItem('limen:phaseseries:population', JSON.stringify(this._phaseSeries));
          }
        } catch (e2) {}
      }
    } catch (e) {}

    this._kernelPhase = null;
    s.phaseSource = 'fallback';
    try {
      if (typeof window !== 'undefined' && window.LIMENThing2 && this._phaseSeries.length >= 8) {
        var _kp = window.LIMENThing2.phaseOfSeries(this._phaseSeries, { positive: false });  // STRESS: up = worse
        if (_kp && _kp.phase) {
          this._kernelPhase = _kp.phase;
          s.kernelPhase = _kp.phase;
          s.kernelTrajectory = _kp.trajectory;
          s.kernelCAccum = _kp.cAccumulator;
          s.phaseSource = 'thing2-kernel';
        }
      }
    } catch (e3) { this._kernelPhase = null; s.phaseSource = 'fallback'; }
  };

  PopulationBrain.prototype._computePopulationPhaseDynamics = function () {
    var s = this.state;
    // Refresh the Thing2 kernel phase from population's stress trajectory (pure math, guarded).
    try { this._updatePhaseKernel(); } catch (e) { this._kernelPhase = null; s.phaseSource = 'fallback'; }
    // Same phase-coupling matrix M as energy (patent Section 3.4 Loop 1). P5 has no row (no defined
    // coherent coupling) — that absence is honest, not a gap to fill.
    var PHASE_M = {
      p3:  { p3: 0.08, p7a: 0.05, p9: 0.04, p0: -0.06 },
      p7a: { p7a: 0.10, p3: 0.04, p9: 0.06, p0: -0.08, p4: -0.04 },
      p7:  { p7: 0.10, p3: 0.04, p9: 0.06, p0: -0.08 },
      p4:  { p4: 0.05, p5: 0.04, p0: 0.03, p3: -0.04 },
      p6:  { p6: 0.06, p0: 0.04, p3: -0.05 },
      p9:  { p9: 0.08, p7a: 0.05, p0: -0.10, p4: -0.06 },
      p10: { p10: 0.06, p0: 0.05, p6: 0.03 }
    };
    var VALIDATED = { p3: 1, p7: 1, p7a: 1, p7b: 1 };  // P3/P7 family gate for phase-consistency tier — self-consistency, NOT external reward
    var BREAKING = { p1: 1, p3: 1, p7: 1, p7a: 1, p7b: 1, p9: 1 };
    function norm(p) { if (p == null) return null; p = String(p).toLowerCase().replace(/[^a-z0-9]/g, ''); if (p.charAt(0) !== 'p') p = 'p' + p; return p; }
    // PREFER the Thing2 kernel phase (interpretive, from population's stress trajectory) for BOTH the
    // coherence router and the phase-transition record; fall back to the existing s.phase when the
    // kernel is unavailable (adapter missing / history < 8 / error) — fallback path unchanged.
    var myPhase = norm(this._kernelPhase != null ? this._kernelPhase : s.phase);

    // (A) COHERENCE ROUTER — co-phased, stressed peers (observe-only telemetry).
    var doms = (typeof window !== 'undefined' && window.LIMENDomains) || {};
    var coupled = [], couplingStrength = 0;
    if (myPhase && PHASE_M[myPhase]) {
      var row = PHASE_M[myPhase];
      Object.keys(doms).forEach(function (k) {
        if (k === 'population') return;
        var d = doms[k] || {};
        var op = norm(d.brainPhase || d.phase || (d.brain && d.brain.phase));
        var st = (typeof d.brainStress === 'number') ? d.brainStress : (typeof d.stress === 'number' ? d.stress : 0);
        if (!op) return;
        var coh = (row[op] != null) ? row[op] : (op === myPhase ? 0.04 : 0);
        if (coh > 0 && st > 0.5) coupled.push({ domain: k, phase: op, coherence: coh, stress: Math.round(st * 100) / 100 });
      });
      coupled.sort(function (a, b) { return (b.coherence * b.stress) - (a.coherence * a.stress); });
      couplingStrength = coupled.reduce(function (a, c) { return a + c.coherence * c.stress; }, 0);
    }

    // (B) PHASE-TRANSITION record — ALWAYS advisory (validated only if P3/P7 involved; P5 never is).
    var hist = this._phaseHistory = this._phaseHistory || [];
    var prev = hist.length ? hist[hist.length - 1].phase : null;
    var transition = null;
    if (prev != null && myPhase != null && prev !== myPhase) {
      var wentUp = (BREAKING[myPhase] && !BREAKING[prev]) ? true : (BREAKING[prev] && !BREAKING[myPhase]) ? false : null;
      var validated = !!(VALIDATED[myPhase] || VALIDATED[prev]);
      transition = { from: prev, to: myPhase, wentUp: wentUp, validated: validated,
        kind: validated ? 'self-consistency calibration (P3/P7 phase tier, interpretive)' : 'advisory-self-consistency',
        actuated: false, note: 'observe-only; a phase transition is self-consistency calibration (interpretive), never external reward; population phase (P5) is not P3/P7 so no phase credit is emitted' };
    }
    hist.push({ phase: myPhase, t: (s.populationModel && s.populationModel.updated) || Date.now() });
    if (hist.length > 24) hist.shift();

    var out = {
      version: 1, observeOnly: true, actuated: false, myPhase: myPhase,
      phaseSource: s.phaseSource || 'fallback',       // 'thing2-kernel' when the real kernel drove myPhase, else 'fallback'
      kernelTrajectory: s.kernelTrajectory || null,
      coupled: coupled.slice(0, 5), couplingStrength: Math.round(couplingStrength * 1000) / 1000,
      transition: transition,
      note: 'ADVISORY phase-coherence router + transition record. Phase source = Thing2 recursive kernel over population’s stress trajectory (interpretive) with s.phase fallback. NOT actuated: P5 is not a Thing1-validated phase, so no phase-transition reward and no opportunity-gate opening. Population UNMAPPED boundary.'
    };
    s.populationPhaseDynamics = out;
    return out;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE K — POPULATION NEURO-COMPLETION LAYERS (population-local, additive, reversible).
  // Ported from energy-brain's K1-K8 stack, adapted to READ THIS domain's state/edges:
  //   K1 afferent integration, K2 neuromodulatory gain, K3 slow consolidation,
  //   K4 outcome / credit learning (TRUTH BRAKE self-consistency), K5 deep-perception depth,
  //   K6 attention, K7 lateral inhibition, K8 homeostatic set-point.
  // ADVISORY BY DESIGN (mirrors energy's original K-header contract): every layer COMPUTES and
  // EXPOSES its signal on state, but NONE rewires the existing scoring spine (stress, prior update,
  // opportunity output, predictionError). Each names the one line it WOULD close. Reads cached state
  // only; adds no network calls; runs on the DETERMINISTIC cycle — no paid-AI / LLM, ever. Runs
  // ALONGSIDE the actuation layer above (servo/brake/phase), never replacing it.
  // ════════════════════════════════════════════════════════════════════════════
  var PK_OUTCOME_BUFFER = 40;     // rolling predicted-vs-realized samples (K4)
  var PK_HOMEO_WINDOW = 60;       // cycles of stress baseline for the adaptive set-point (K8)

  // K1 — afferent inter-brain integration. Surfaces received cross-domain pressure and the stress
  // delta it contributes. The base scoreStress already folds getExternalPressure() into stress (like
  // the other 18 domains); this exposes the received-signal breakdown without touching stress.
  PopulationBrain.prototype._computePopulationAfferent = function () {
    var s = this.state, pm = s.populationModel || {};
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
      externalPressure: Math.round(pressure * 1000) / 1000,           // base-capped
      receivedSignalCount: raw.length,
      activeSignalCount: active,
      contributors: contributors.slice(0, 6),
      integrated: true,                                               // CLOSED — folded into stress by base scoreStress
      appliedStressDelta: Math.round(((s._externalPressureApplied) || 0) * 1000) / 1000,
      wouldRaiseStressBy: Math.round(pressure * 1000) / 1000,
      note: 'CLOSED: base scoreStress folds getExternalPressure() into stress each cycle (population reads cross-domain pressure like the other domains). Energy->population coupling is ingested separately via _ingestEnergyCoupling.',
      lastAfferentAt: pm.updated || now
    };
    s.populationAfferent = af; return af;
  };

  // K2 — neuromodulatory gain application. reg.gain/inhibition/outputScale are computed by the
  // recurrent regulation step; gain already reaches predictedStress via the gainBlend. This shows the
  // graded output modulation on opportunities WITHOUT gating opportunity output (spine preserved).
  PopulationBrain.prototype._computePopulationGainControl = function () {
    var s = this.state, pm = s.populationModel || {}, reg = pm.regulation || {};
    var opps = s.opportunities || [];
    var outputScale = (typeof reg.outputScale === 'number') ? reg.outputScale : 1;
    var wouldCapAt = Math.max(1, Math.round(opps.length * outputScale));
    var gc = {
      version: 1,
      gain: (typeof reg.gain === 'number') ? reg.gain : null,
      inhibition: (typeof reg.inhibition === 'number') ? reg.inhibition : null,
      outputScale: outputScale,
      currentOpportunityCount: opps.length,
      wouldCapOpportunitiesAt: wouldCapAt,                            // gain-scaled ranked cut (advisory)
      wouldSuppress: Math.max(0, opps.length - wouldCapAt),
      appliedTargets: ['predictedStress (gain-blend in _updatePopulationModel)'],
      unappliedTargets: ['stress', 'opportunity output', 'treatment surfacing'],
      shadow: true,
      note: 'ADVISORY: outputScale WOULD cap ranked opportunity output; population does not gate opportunity count (scoring spine preserved). gain already blends into predictedStress via the _updatePopulationModel gainBlend.',
      lastGainAt: pm.updated || Date.now()
    };
    s.populationGainControl = gc; return gc;
  };

  // K3 — slow consolidation / long-term plasticity. PM_SLOW_RATE is otherwise reserved for
  // rebuild/cron. This maintains a PARALLEL slow-weight track that never touches pm.prior;
  // fast-vs-slow divergence is a real demographic-regime-shift indicator.
  PopulationBrain.prototype._consolidatePopulationSlowModel = function () {
    var s = this.state, pm = s.populationModel || {}, obs = pm.observation || null;
    var slow = s.populationSlowModel || {
      version: 1, cycle: 0,
      slow: { expectedStress: 0.5, expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, samples: 0 },
      rate: PM_SLOW_RATE, note: 'parallel slow-weight track (PM_SLOW_RATE); does NOT touch pm.prior'
    };
    if (obs) {
      var r = PM_SLOW_RATE, w = slow.slow;
      w.expectedStress = _pmClamp(w.expectedStress + r * ((obs.stress || 0) - w.expectedStress), 0, 1);
      w.expectedSignal = _pmClamp(w.expectedSignal + r * ((obs.signal || 0) - w.expectedSignal), 0, 1);
      w.expectedDiagnosisCount = w.expectedDiagnosisCount + r * ((obs.diagnosisCount || 0) - w.expectedDiagnosisCount);
      w.expectedOpportunityCount = w.expectedOpportunityCount + r * ((obs.opportunityCount || 0) - w.expectedOpportunityCount);
      w.samples += 1;
      slow.cycle += 1;
    }
    var fast = (pm.prior && typeof pm.prior.expectedStress === 'number') ? pm.prior.expectedStress : 0.5;
    slow.fastSlowDivergence = Math.round(Math.abs(fast - slow.slow.expectedStress) * 1000) / 1000;
    slow.regimeShift = slow.fastSlowDivergence > 0.25;                // fast prior pulled far from slow baseline
    slow.updated = pm.updated || Date.now();
    s.populationSlowModel = slow; return slow;
  };

  // K4 — outcome / credit learning + TRUTH BRAKE (self-consistency calibration). Compares each
  // cycle's predictedStress against the NEXT cycle's realized stress (online forward-prediction).
  // This is SELF-CONSISTENCY calibration — does the model's OWN stress forecast come true — NOT an
  // external/dopaminergic reward (that is a separate, deferred task and is never fabricated here).
  PopulationBrain.prototype._scorePopulationOutcomes = function () {
    var s = this.state, pm = s.populationModel || {};
    var buf = this._populationOutcomeBuffer = this._populationOutcomeBuffer || [];
    var obs = pm.observation || null;
    if (this._populationPrevPrediction != null && obs && typeof obs.stress === 'number') {
      buf.push({ predicted: this._populationPrevPrediction, realized: obs.stress, err: Math.abs(this._populationPrevPrediction - obs.stress) });
      if (buf.length > PK_OUTCOME_BUFFER) buf.shift();
    }
    this._populationPrevPrediction = (typeof pm.predictedStress === 'number') ? pm.predictedStress : null;   // stash for next-cycle reconciliation
    var n = buf.length, sumErr = 0, sumSq = 0, hits = 0;
    for (var i = 0; i < n; i++) { sumErr += buf[i].err; sumSq += buf[i].err * buf[i].err; if (buf[i].err <= 0.1) hits++; }
    var callHitRate = n ? Math.round((hits / n) * 100) / 100 : null;
    var om = {
      version: 1,
      samples: n,
      meanRealizedError: n ? Math.round((sumErr / n) * 1000) / 1000 : null,   // does the forecast come true
      brierLike: n ? Math.round((sumSq / n) * 1000) / 1000 : null,
      callHitRate: callHitRate,                                       // fraction of self-predictions within 0.1 of realized
      hitRate: callHitRate,
      loopType: 'online-continuous self-prediction (predicted-stress vs next-realized-stress); TRUTH-BRAKE self-consistency, distinct from any external reward',
      creditAssignmentActive: (n >= 5),
      note: 'SELF-CONSISTENCY truth brake: measures whether the recurrent model\'s OWN stress forecast comes true. Advisory calibration signal; NEVER a fabricated dopaminergic/external reward (deferred, separate task).',
      lastOutcomeAt: pm.updated || Date.now()
    };
    s.populationOutcomeModel = om; return om;
  };

  // K5 — deep hierarchical perception. Aggregates the perception depth the brain HAS from existing
  // caches (root portal + validated diagnosis spine + the REAL demographic-transition sub-portal),
  // no new fetches, and estimates the portalError the recurrent model currently does not fold in.
  PopulationBrain.prototype._computePopulationPerceptionDepth = function () {
    var s = this.state, pm = s.populationModel || {};
    var dt = s.demographicTransitionLayer || null;
    var portal = s._portalCache || this._portalCache || null;
    var activeDx = (s.diagnoses || []).filter(function (d) { return d.active; }).length;
    var dtReal = (dt && dt.loaded) ? (dt.count || 0) : 0;
    var dtActive = (dt && dt.loaded) ? (dt.activeCount || 0) : 0;
    var levels = [
      { level: 'L0', name: 'root-portal', status: portal ? 'loaded' : 'pending' },
      { level: 'L1', name: 'diagnosis-spine', status: (s.diagnoses && s.diagnoses.length) ? 'derived' : 'pending', activeCount: activeDx },
      { level: 'SUB', name: 'demographic-transition-subportal', status: (dt && dt.loaded) ? 'loaded' : 'absent', realDiagnoses: dtReal, activeCount: dtActive, branches: (dt && dt.branches) || [] },
      { level: 'L2', name: 'deep-cortex', status: 'quarantined', note: 'synthetic migration models immune-blocked' }
    ];
    var loadedDepth = (dt && dt.loaded) ? 2 : ((s.diagnoses && s.diagnoses.length) ? 1 : 0);
    var admissible = dtReal + activeDx;
    var blocked = 1;                                                  // the quarantined synthetic L2 tier
    var portalErrorEstimate = Math.round((blocked / Math.max(1, admissible + blocked)) * 1000) / 1000;
    var pd = {
      version: 1, levels: levels, deepestUsableLevel: loadedDepth,
      portalErrorEstimate: portalErrorEstimate,
      note: 'ADVISORY: perception depth = root portal + validated diagnosis spine + real demographic-transition sub-portal (aging + migration); L2 deep-cortex quarantined (synthetic). portalErrorEstimate EXPOSED, not folded into predictionError (population scoring spine preserved). No new fetches.',
      lastDepthAt: pm.updated || Date.now()
    };
    s.populationPerceptionDepth = pd; return pd;
  };

  // K6 — attention / selective routing. Ranks top-down salience (active + relevance + novelty +
  // operator focus) among demographic diagnoses and names focus vs suppressed, without gating the
  // pipeline (scoring spine preserved).
  PopulationBrain.prototype._computePopulationAttention = function () {
    var s = this.state, pm = s.populationModel || {}, reg = pm.regulation || {};
    var pe = (pm.predictionError && pm.predictionError.total) || 0;
    var rb = this._readRequestBiases ? this._readRequestBiases() : { attentionFocus: [] };
    var focus = ((rb && rb.attentionFocus) || []).map(function (f) { return String(f).toLowerCase(); });
    var scored = (s.diagnoses || []).map(function (d) {
      var sal = (d.active ? 0.5 : 0) + (d.relevance || 0) * 0.4 + pe * 0.1;
      var hay = (String(d.id) + ' ' + String(d.label || '')).toLowerCase();
      if (focus.some(function (f) { return f && hay.indexOf(f) !== -1; })) sal += 0.5;   // operator steer boost
      return { id: d.id, active: !!d.active, salience: Math.round(sal * 1000) / 1000 };
    }).sort(function (a, b) { return b.salience - a.salience; });
    var at = {
      version: 1,
      driver: reg.state === 'surprised' ? 'novelty-driven (bottom-up)' : 'goal-driven (top-down)',
      focus: scored.slice(0, 3),
      suppressed: scored.slice(3).map(function (x) { return x.id; }).slice(0, 8),
      broadenUnderSurprise: reg.state === 'surprised',
      note: 'ADVISORY: top-down salience over demographic diagnoses (active + relevance + prediction-error + operator focus). Exposed; does not gate the pipeline (scoring spine preserved).',
      lastAttentionAt: pm.updated || Date.now()
    };
    s.populationAttention = at; return at;
  };

  // K7 — lateral inhibition (microcircuit). Shows the winner-take-most ranking reg.inhibition implies
  // among competing active demographic diagnoses, without down-weighting output (spine preserved).
  PopulationBrain.prototype._computePopulationInhibition = function () {
    var s = this.state, pm = s.populationModel || {}, reg = pm.regulation || {};
    var inhib = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;
    var active = (s.diagnoses || []).filter(function (d) { return d.active; })
      .sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var winner = active[0] || null;
    var li = {
      version: 1, inhibitionStrength: inhib,
      winner: winner ? winner.id : null,
      competitors: active.slice(1).map(function (d) { return { id: d.id, relevance: d.relevance, suppressBy: Math.round((d.relevance || 0) * inhib * 1000) / 1000 }; }).slice(0, 6),
      note: 'ADVISORY: lateral-inhibition winner-take-most among competing active demographic diagnoses. Exposed; non-winner down-weighting NOT applied to output (scoring spine preserved).',
      lastInhibitionAt: pm.updated || Date.now()
    };
    s.populationInhibition = li; return li;
  };

  // K8 — homeostatic set-point (microcircuit). Maintains an adaptive stress baseline (Turrigiano-style
  // synaptic scaling) alongside the fixed PM_STRESS_FLOOR, from the base's stressHistory window,
  // without replacing the fixed floor (handoff floor unchanged; spine preserved).
  PopulationBrain.prototype._computePopulationHomeostasis = function () {
    var s = this.state, pm = s.populationModel || {};
    var win = ((s.memory && s.memory.stressHistory) || []).slice(-PK_HOMEO_WINDOW);
    if (!win.length) {
      // fall back to the outcomeLog stress trail (population records stress there each cycle)
      win = ((s.memory && s.memory.outcomeLog) || []).slice(-PK_HOMEO_WINDOW).map(function (e) { return { stress: e.stress }; });
    }
    var n = win.length, sum = 0;
    for (var i = 0; i < n; i++) sum += (win[i].stress || 0);
    var baseline = n ? sum / n : 0.5;                                // adaptive set-point vs fixed PM_STRESS_FLOOR
    var cur = (typeof s.stress === 'number') ? s.stress : 0;
    var scalingFactor = baseline > 0 ? Math.round((0.5 / Math.max(0.1, baseline)) * 1000) / 1000 : 1;
    var hm = {
      version: 1,
      fixedFloor: PM_STRESS_FLOOR,                                   // current hardcoded set-point
      adaptiveBaseline: Math.round(baseline * 1000) / 1000,
      currentStress: cur,
      deviationFromBaseline: Math.round((cur - baseline) * 1000) / 1000,
      scalingFactor: scalingFactor,                                  // synaptic-scaling multiplier
      samples: n,
      note: 'ADVISORY: adaptive homeostatic set-point (Turrigiano synaptic scaling) alongside the fixed PM_STRESS_FLOOR. Exposed; the servo already reads the recurrent prior as its regulate-to-target baseline. Handoff floor unchanged (scoring spine preserved).',
      lastHomeostasisAt: pm.updated || Date.now()
    };
    s.populationHomeostasis = hm; return hm;
  };

  // Assemble the neuro-completion surface (mirrors energy's _computeEnergyNeuroLayers). Runs all
  // eight K-layers in Energy's K1..K8 order, stores each on state (populationAfferent, ...), and
  // attaches a compact roll-up ADDITIVELY as cognition.neuro. Deterministic; no network; no AI.
  PopulationBrain.prototype._computePopulationNeuroLayers = function () {
    this._computePopulationAfferent();          // K1 — afferent inter-brain integration
    this._computePopulationGainControl();       // K2 — neuromodulatory gain application
    this._consolidatePopulationSlowModel();     // K3 — slow consolidation / long-term plasticity
    this._scorePopulationOutcomes();            // K4 — outcome / credit learning (TRUTH-BRAKE self-consistency)
    this._computePopulationPerceptionDepth();   // K5 — deep hierarchical perception
    this._computePopulationAttention();         // K6 — attention / selective routing
    this._computePopulationInhibition();        // K7 — lateral inhibition (microcircuit)
    this._computePopulationHomeostasis();       // K8 — adaptive homeostatic set-point (microcircuit)
    var s = this.state;
    var neuro = {
      version: 1,
      status: 'advisory',                       // all K-loops COMPUTE + EXPOSE; scoring spine untouched
      afferent: s.populationAfferent || null,
      gainControl: s.populationGainControl || null,
      slowModel: s.populationSlowModel || null,
      outcomeModel: s.populationOutcomeModel || null,
      perceptionDepth: s.populationPerceptionDepth || null,
      attention: s.populationAttention || null,
      inhibition: s.populationInhibition || null,
      homeostasis: s.populationHomeostasis || null,
      note: 'K1-K8 neuro-completion stack (population-local, deterministic, additive, advisory). Wired K1..K8 each cycle ALONGSIDE the actuation layer; exposes signals without rewriting stress/prior/opportunities/predictionError.'
    };
    s.populationNeuro = neuro;
    if (s.cognition && typeof s.cognition === 'object') s.cognition.neuro = neuro;   // additive: new key only
    return neuro;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // OPERATOR-TRIGGERED, KILLSWITCH-GATED SLOT (NEVER called from the 30s cycle).
  // Generative node->business authoring is a genuine "code-cannot-do-this" task. It is
  // NOT wired into cycle(); it only runs on an explicit operator action, and it routes
  // through a SERVER endpoint that already enforces lib/ai-kill-switch spendDisabled().
  // No API key ever lives in this client. If the endpoint is absent/gated it no-ops.
  // Kept as a documented stub so the cost-safety contract is explicit and auditable.
  // ════════════════════════════════════════════════════════════════════════════
  PopulationBrain.prototype.operatorAuthorNodeBusiness = function (nodeId, opts) {
    // GUARD: refuse to run automatically. Must be an explicit operator invocation.
    if (!opts || opts.operatorTriggered !== true) {
      return Promise.resolve({ ok: false, reason: 'operator-trigger-required', note: 'generative authoring is never run on the deterministic cycle' });
    }
    if (typeof fetch !== 'function') return Promise.resolve({ ok: false, reason: 'no-fetch' });
    // Server side is killswitch-gated (spendDisabled()); client carries NO key.
    return fetch('/api/population-node-business', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'population', nodeId: nodeId, operatorTriggered: true })
    }).then(function (r) { return r.ok ? r.json() : { ok: false, reason: 'server ' + r.status }; })
      .catch(function (e) { return { ok: false, reason: String(e && e.message || e).slice(0, 80) }; });
  };

  var _origCycle = PopulationBrain.prototype.cycle;
  PopulationBrain.prototype.cycle = function () {
    var self = this;
    return _origCycle.call(this).then(function () {
      return self.resolveDeepContent();
    }).then(function () {
      // Compute pulse — evidence validation + delta detection + freshness (if a pulse engine is loaded)
      try {
        var pulse = window.LIMENPopulationPulse;
        if (pulse && typeof pulse.computePulse === 'function') {
          self.state._activeConditions = self._activeConditions || [];
          var pulseState = pulse.computePulse(self.state);
          self.state.pulse = pulseState;
          // Neuro-substrate telemetry (advisory): map live pulse -> runtime overlay via generic adapter.
          try {
            if (window.DomainTelemetryAdapter && typeof window.DomainTelemetryAdapter.fromLiveCached === "function") {
              window.DomainTelemetryAdapter.fromLiveCached("population", self.state, self._runtimeOverlay || null)
                .then(function (ov) { if (ov) self._runtimeOverlay = ov; }).catch(function () {});
            }
          } catch (_e) {}
          if (pulseState && pulseState.validatedDiagnoses) {
            for (var vdi = 0; vdi < pulseState.validatedDiagnoses.length; vdi++) {
              var vdx = pulseState.validatedDiagnoses[vdi];
              for (var sdi = 0; sdi < self.state.diagnoses.length; sdi++) {
                if (self.state.diagnoses[sdi].id === (vdx.diagnosis && vdx.diagnosis.id)) {
                  if (vdx.blocked) { self.state.diagnoses[sdi].active = false; self.state.diagnoses[sdi].blocked = true; self.state.diagnoses[sdi].blockReason = vdx.reason; }
                  else { self.state.diagnoses[sdi].blocked = false; self.state.diagnoses[sdi].evidenceReason = vdx.reason; }
                  break;
                }
              }
            }
            self.state.diagnoses.sort(function (a, b) { if (a.active !== b.active) return a.active ? -1 : 1; return b.relevance - a.relevance; });
          }
        }
      } catch (e) {}
      // ensure sub-portals are loading (one-shot; demographic-transition layer reads the cache next cycle)
      try { self._loadDemographicTransitionDiagnoses(); } catch (e) {}
    }).then(function () {
      // PHASE B — recurrent loop step. Runs AFTER the validated diagnosis spine settles,
      // BEFORE the next cycle. Ingest energy coupling first, then the recurrent model.
      try { self._ingestEnergyCoupling(); } catch (e) {}
      try { self._updatePopulationModel(); } catch (e) {}
      try { self._computePopulationOverlays(); } catch (e) {}   // NEURO-SUBSTRATE OVERLAY WIRING (per-domain, ported from energy 2026-07-21): invokes population's OWN overlay modules each cycle; shadow, proposals only
    });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // NEURO-SUBSTRATE OVERLAY WIRING — per-domain copy of energy's _computeEnergyOverlays
  // (2026-07-21, full per-domain independence). Invokes population's OWN modules
  // (window.Population{Metaplasticity,Extinction,RetrogradeThrottle,PredictionErrorCompressor,
  // OfflineMaintenance,NeuroSubstrate,ConnectivityAudit}) against population's OWN runtime def
  // (population.json runtime.params + edges/issues/activations). SHADOW: writes state.populationOverlays;
  // the only actuation is metaplasticity -> the refractory dead-time (matches energy exactly).
  // Degrade-safe: returns mode 'off' when the modules are not on the page (they load only on the
  // population console), 'loading' until population.json arrives.
  // ════════════════════════════════════════════════════════════════════════════
  PopulationBrain.prototype._loadPopulationDef = function () {
    if (this._populationDef) return this._populationDef;
    if (this._populationDefLoading) return null;
    this._populationDefLoading = true;
    var self = this;
    if (typeof fetch === 'function') {
      try {
        fetch('/assets/data/domains/population.json').then(function (r) { return r.json(); })
          .then(function (def) { self._populationDef = def; })
          .catch(function () { self._populationDefLoading = false; });
      } catch (e) { this._populationDefLoading = false; }
    }
    return null;
  };

  PopulationBrain.prototype._computePopulationOverlays = function () {
    var s = this.state;
    function mod(glob, reqPath) {
      if (typeof window !== 'undefined' && window[glob]) return window[glob];
      if (typeof module !== 'undefined') { try { return require(reqPath); } catch (e) {} }
      return null;
    }
    var META = mod('PopulationMetaplasticity', '../population-metaplasticity.js');
    var EXT = mod('PopulationExtinction', '../population-extinction.js');
    var RETRO = mod('PopulationRetrogradeThrottle', '../population-retrograde-throttle.js');
    var PEC = mod('PopulationPredictionErrorCompressor', '../population-prediction-error-compressor.js');
    var OFF = mod('PopulationOfflineMaintenance', '../population-offline-maintenance.js');
    var NS = mod('PopulationNeuroSubstrate', '../population-neuro-substrate.js');
    var CONN = mod('PopulationConnectivityAudit', '../population-connectivity-audit.js');
    if (!(META && EXT && RETRO && PEC && OFF && NS && CONN)) {
      s.populationOverlays = { version: 1, mode: 'off', note: 'overlay modules not loaded on this page (present only on the population console)' };
      return null;
    }
    var def = this._loadPopulationDef();
    if (!def) { s.populationOverlays = { version: 1, mode: 'loading', note: 'population.json runtime def loading; overlays compute next cycle' }; return null; }

    var armed = !!(this._actuation && this._actuation.overlays);
    var ov = this._runtimeOverlay || {};
    var params = (def.runtime && def.runtime.params) || {};

    var volatility = (typeof ov.volatility === 'number') ? ov.volatility : (function () {
      var h = ((s.memory && s.memory.stressHistory) || []).slice(-12), sum = 0;
      for (var i = 1; i < h.length; i++) sum += Math.abs((h[i].stress || 0) - (h[i - 1].stress || 0));
      return h.length > 1 ? Math.max(0, Math.min(1, sum / (h.length - 1))) : 0;
    })();

    var meta = META.adaptParams(
      { offlineDownscaleFactor: params.offlineDownscaleFactor, refractoryAbsoluteWindow: params.refractoryAbsoluteWindow, predictionErrorThreshold: params.predictionErrorThreshold },
      { gain: (typeof params.metaplasticityGain === 'number') ? params.metaplasticityGain : 0, volatility: volatility }
    );
    var adapted = meta.adapted || {};

    var activeTriggers = ov.activeTriggers || this._activeConditions || [];
    var ext = EXT.proposeExtinction(def, activeTriggers);

    var overload = {}, actsOv = ov.activations || {};
    Object.keys(actsOv).forEach(function (nid) {
      var a = actsOv[nid], cap = (a && a.capacity) || 1;
      if (a && typeof a.load === 'number' && cap > 0 && a.load / cap > 1) overload[nid] = a.load / cap;
    });
    var retro = RETRO.computeThrottle(def, { overload: overload, throttleGain: (typeof params.retrogradeThrottleGain === 'number') ? params.retrogradeThrottleGain : 0 });

    var intero = s.populationInteroception || (s.cognition && s.cognition.interoception) || {};
    var chans = ((intero.channels) || []).map(function (c) { return { id: c.name, observed: c.alarm }; });
    var baseline = chans.length ? chans.reduce(function (a, c) { return a + (c.observed || 0); }, 0) / chans.length : 0;
    var peThresh = (typeof adapted.predictionErrorThreshold === 'number') ? adapted.predictionErrorThreshold : (params.predictionErrorThreshold || 0);
    var pec = PEC.compress(chans, { threshold: peThresh, predictor: 'baseline', baseline: baseline });

    var off = OFF.runOfflineMaintenance(def, {
      downscaleFactor: (typeof adapted.offlineDownscaleFactor === 'number') ? adapted.offlineDownscaleFactor : (params.offlineDownscaleFactor || 1),
      consolidateTopK: (typeof params.offlineConsolidateTopK === 'number') ? params.offlineConsolidateTopK : Infinity,
      pruneThreshold: (typeof params.offlinePruneThreshold === 'number') ? params.offlinePruneThreshold : 0
    });

    var recurrence = CONN.recurrenceAudit(def);
    var incompleteCircuits = (def.issues || []).map(function (is) { return NS.validateIncompleteCircuit(is); });
    var incompleteCount = incompleteCircuits.filter(function (v) { return v.verdict === 'INCOMPLETE_CIRCUIT'; }).length;

    s.populationOverlays = {
      version: 1, mode: 'shadow', armed: armed,
      volatility: Math.round(volatility * 1000) / 1000,
      metaplasticity: { changes: meta.changes, adapted: adapted, noop: meta.noop },
      extinction: { candidates: ext.candidates, count: ext.candidates.length, noop: ext.noop, actuation: 'PROPOSAL-ONLY (retiring a node edits population.json — human-gated forever)' },
      retrograde: { actions: retro.actions, throttled: retro.actions.length, noop: retro.noop },
      peCompression: { compressed: pec.summary.compressedCount, propagated: pec.propagated.length, ratio: pec.compressionRatio, summary: pec.summary },
      offlineMaintenance: { downscaled: (off.report.operations.downscale || {}).edgesDownscaled, pruned: (off.report.operations.prune || {}).pruned, report: off.report, actuation: 'PROPOSAL-ONLY on a deep copy; pruning is human-gated forever' },
      recurrence: { verdict: recurrence.verdict, recurrentFraction: recurrence.recurrentFraction, lateralFraction: recurrence.lateralFractionOfClassifiable },
      incompleteCircuits: incompleteCircuits, incompleteCount: incompleteCount
    };

    var applied = { refractoryAbsoluteWindow: null };
    var base = this._refractoryBaseWindow || (this._refractoryParams && this._refractoryParams.absoluteWindow) || 900000;
    if (armed) {
      var wantRaw = (typeof adapted.refractoryAbsoluteWindow === 'number') ? adapted.refractoryAbsoluteWindow : base;
      var want = Math.max(base, Math.min(base * 1.2, wantRaw));
      if (this._refractoryParams) this._refractoryParams.absoluteWindow = want;
      if (this._refractoryLimiter && this._refractoryLimiter.params) this._refractoryLimiter.params.absoluteWindow = want;
      applied.refractoryAbsoluteWindow = want;
    } else {
      if (this._refractoryParams && this._refractoryParams.absoluteWindow !== base) this._refractoryParams.absoluteWindow = base;
      if (this._refractoryLimiter && this._refractoryLimiter.params && this._refractoryLimiter.params.absoluteWindow !== base) this._refractoryLimiter.params.absoluteWindow = base;
    }
    s.populationOverlays.mode = armed ? 'armed' : 'shadow';
    s.populationOverlays.applied = applied;
    s.populationOverlays.actuationScope = 'metaplasticity->refractory dead-time ONLY (bounded, fail-toward-quiet, reversible). throttle=no-live-consumer; PE=observe-only; extinction+offline-prune=PROPOSAL-ONLY (remove structure, human-gated forever).';
    s.populationOverlays.note = 'PER-DOMAIN OVERLAY WIRING (ported from energy): population runs its OWN 6 overlay modules + connectivity recurrenceAudit each cycle on population.json. ARMED: metaplasticity raises the refractory dead-time with volatility (clamped, reversible). Everything else is proposal/observe-only.';

    if (s.cognition && typeof s.cognition === 'object') s.cognition.overlays = s.populationOverlays;
    return s.populationOverlays;
  };

  // ── POPULATION-LOCAL FIVE-ORGAN EXTENSION ─────────────────────────────
  // The base schedules these organs; Population owns their implementation, state and
  // authority here. Thing 2 is not consumed and external action remains inhibited.
  PopulationBrain.prototype._computePopulationPlasticity = function () {
    var s = this.state;
    if (this._plasticity === undefined) {
      try { this._initDomainPlasticity(); } catch (e) { this._plasticity = null; }
    }
    var pl = this._plasticity;
    if (!pl || !pl.P) {
      s.populationPlasticity = s.domainPlasticity = { version: 2, domain: this.domainId, localOwner: true, mode: 'off', note: 'plasticity primitive unavailable' };
      return null;
    }
    try { this._refreshDomainExternalOutcome(); } catch (e) {}
    var n = (s.cognition && s.cognition.neuro) || s.domainNeuro || {};
    var gc = n.gainControl || {}, at = n.attention || {}, sm = n.slowModel || {}, hm = n.homeostasis || {}, led = n.outcomeLedger || {};
    var pe = (s.cognition && s.cognition.model && ((s.cognition.model.predictionError && s.cognition.model.predictionError.total) || s.cognition.model.predictionError)) || 0;
    var dx = (s.diagnoses || []).filter(function (d) { return d.active; });
    var relevance = dx.length ? dx.reduce(function (sum, d) { return sum + (d.relevance || 0); }, 0) / dx.length : 0;
    var ext = this._externalOutcome, k4api = typeof window !== 'undefined' ? window.LIMENK4 : null;
    var eligible = !!(k4api && k4api.externalRewardEligible && k4api.externalRewardEligible(this.domainId));
    var resolved = ext && ext.resolvedCount || 0;
    var externalOutcome = eligible && typeof (ext && ext.hit) === 'number' && resolved >= 5 ? { hit: ext.hit } : null;
    var credit = k4api && k4api.credit ? k4api.credit({
      domain: this.domainId, externalOutcome: externalOutcome,
      callHitRate: typeof led.hitRate === 'number' ? led.hitRate : null, callSamples: led.samples || 0,
      stressSelfPred: typeof led.hitRate === 'number' ? led.hitRate : null, stressSamples: led.samples || 0
    }) : null;
    this._plasticityRewardActive = !!(credit && credit.isReward);
    var mod = pl.P.readModulator(pl.mod, credit, typeof led.resolvedTotal === 'number' ? led.resolvedTotal : (led.samples || 0));
    var feeds = {
      K_gain: { pre: [gc.inhibition || 0], post: 1 - (typeof gc.outputScale === 'number' ? gc.outputScale : 1) },
      K_attention: { pre: [dx.length ? 1 : 0, relevance, pe], post: (at.focus && at.focus[0] && at.focus[0].salience) || 0 },
      K_slow: { pre: [Math.abs((s.stress || 0) - (sm.expectedStress == null ? 0.5 : sm.expectedStress))], post: sm.fastSlowDivergence || 0 },
      K_homeo: { pre: [hm.baseline == null ? 0.5 : hm.baseline], post: hm.adaptiveThreshold || 0.1 }
    };
    var layers = {}, live = [], stable = true;
    Object.keys(pl.layers).forEach(function (key) {
      var layer = pl.layers[key], f = feeds[key];
      pl.P.tick(layer, f.pre, f.post);
      if (mod.fresh && mod.rpe !== null) pl.P.applyModulator(layer, mod.rpe, { metaplasticity: !!(this._actuation && this._actuation.metaplasticityLive) });
      this._learnedVec(key, layer.seed);
      var blend = typeof layer._blend === 'number' ? layer._blend : 0;
      if (blend > 0) live.push(key);
      layers[key] = { w: layer.w.slice(), labels: layer.labels, updates: layer.updates, shadowOutput: pl.P.shadowSum(layer, f.pre), live: blend > 0, blend: blend, diag: layer.diag };
      if (!layer.diag.stable) stable = false;
    }, this);
    var out = {
      version: 2, domain: this.domainId, localOwner: true, mode: live.length ? 'armed' : 'shadow',
      liveLayers: live, rewardActive: !!this._plasticityRewardActive,
      creditSource: credit && credit.creditSource || 'none', creditTier: credit && credit.tier || 0,
      externalOutcome: externalOutcome ? { hit: externalOutcome.hit, resolvedCount: resolved, source: 'independent resolver' }
        : { active: false, resolvedCount: resolved, note: 'abstaining until five eligible independent outcomes resolve' },
      layers: layers, convergence: { allStable: stable },
      persistence: { hydrated: pl.hydrated, enabled: pl.persistEnabled, failures: pl.persistFailures },
      note: 'Population-local three-factor plasticity; outcome-gated and fail-toward-seed.'
    };
    s.populationPlasticity = s.domainPlasticity = out;
    if (s.cognition) s.cognition.plasticity = out;
    if ((this._cycleCount || 0) - (pl.lastPersistCycle || 0) >= 10) {
      pl.lastPersistCycle = this._cycleCount || 0;
      try { this._persistDomainPlasticity(false); } catch (e) {}
    }
    return out;
  };

  PopulationBrain.prototype._computePopulationEmissionQueue = function () {
    var s = this.state, n = s.domainNeuro || {}, brake = n.brake || {}, forecast = n.forecast || null;
    var pool = (s.opportunities || []).filter(function (o) { return o && !o.held && (o.path === 'INVESTABLE' || o.path === 'RESEARCHABLE'); });
    var packages = pool.slice(0, 3).map(function (o) {
      var capital = o.path === 'INVESTABLE';
      return { id: o.id, title: o.title, lane: o.path, confidence: o.confidence,
        thesis: o.whyNow || o.title, moneyChain: o.moneyChain || null,
        instrument: (o.companies && o.companies.length) ? o.companies : (o.examples || []),
        forecast: forecast ? { direction: forecast.direction, projectedStress: forecast.projectedStress, horizonPeriods: forecast.horizonPeriods, falsifier: forecast.falsifier, confidence: forecast.confidence } : null,
        requiresSignoff: capital, decision: capital ? 'capital sign-off required' : 'internal research eligible',
        brakeLevel: brake.level || 'clear' };
    });
    var out = { version: 2, domain: this.domainId, localOwner: true, maxConcurrent: 3,
      poolSize: pool.length, queued: packages.length, prunedOut: Math.max(0, pool.length - packages.length),
      packages: packages, lastQueueAt: Date.now(), note: 'Population-local queue; research internal-only, capital staged.' };
    s.populationEmissionQueue = s.domainEmissionQueue = out;
    return out;
  };

  PopulationBrain.prototype._runPopulationAutonomousEmission = function () {
    var s = this.state, brake = s.domainNeuro && s.domainNeuro.brake;
    var globalOn = typeof window !== 'undefined' && window.LIMEN_DOMAIN_AUTONOMY !== undefined ? !!window.LIMEN_DOMAIN_AUTONOMY : true;
    var localOn = !!(this.resourceAuthority && this.resourceAuthority.switches && this.resourceAuthority.switches.internalEmission);
    var hold = !globalOn || !localOn ? 'domain-internal-autonomy-off'
      : (!s.resourceMetabolism || !s.resourceMetabolism.gates || !s.resourceMetabolism.gates.mayEmitInternal) ? 'resource-metabolism-inhibited'
      : (!brake || brake.level !== 'clear') ? 'brake-' + (brake ? brake.level : 'absent') : null;
    var emitted = [], staged = [], queue = (s.populationEmissionQueue && s.populationEmissionQueue.packages) || [];
    queue.forEach(function (p) {
      if (hold) { p.status = 'held'; staged.push(p); }
      else if (p.requiresSignoff) { p.status = 'staged-for-signoff'; staged.push(p); }
      else { p.status = 'emitted-internal'; emitted.push(p); }
    });
    if (emitted.length) {
      var stream = s.populationEmitted = s.populationEmitted || [];
      emitted.forEach(function (p) { stream.push({ at: Date.now(), title: p.title, lane: p.lane, forecast: p.forecast }); });
      if (stream.length > 50) s.populationEmitted = stream.slice(-50);
    }
    var out = { version: 2, domain: this.domainId, localOwner: true, autonomy: globalOn && localOn,
      holdReason: hold, emittedCount: emitted.length, stagedCount: staged.length, emitted: emitted, staged: staged,
      externalEffects: 0, lastEmissionAt: Date.now(), note: hold ? 'held fail-safe' : 'Population-local internal research emission; capital staged.' };
    s.populationAutoEmission = s.domainAutoEmission = out;
    return out;
  };

  PopulationBrain.prototype._computePopulationInteroception = function () {
    var s = this.state, cog = s.cognition;
    if (!cog) return null;
    var model = cog.model || {}, n = s.domainNeuro || cog.neuro || {};
    var clamp = function (x) { return Math.max(0, Math.min(1, x)); }, r = function (x) { return Math.round(x * 1000) / 1000; };
    var channels = [{ name: 'domain-stress', alarm: r(clamp(s.stress || 0)), confidence: 0.9, weight: 1, provenance: 'Population structured stress' }];
    var pe = model.predictionError && typeof model.predictionError === 'object' ? model.predictionError.total : model.predictionError;
    if (typeof pe === 'number') channels.push({ name: 'prediction', alarm: r(clamp(pe)), confidence: 0.7, weight: 0.85, provenance: 'Population prediction error' });
    var ledger = n.outcomeLedger || {};
    if (typeof ledger.hitRate === 'number' && ledger.samples >= 3) channels.push({ name: 'metacognitive', alarm: r(clamp(1 - ledger.hitRate)), confidence: ledger.samples >= 5 ? 0.7 : 0.4, weight: 0.75, provenance: 'Population outcomes' });
    var immune = cog.immune || {}, ia = { clear: 0, watch: 0.34, active: 0.4, alert: 1 };
    if (immune.immuneState) channels.push({ name: 'immune', alarm: ia[immune.immuneState] == null ? 0.34 : ia[immune.immuneState], confidence: 0.6, weight: 0.6, provenance: 'Population immune state' });
    var forecast = n.forecast;
    if (forecast && typeof forecast.projectedStress === 'number') channels.push({ name: 'allostatic', alarm: r(clamp((forecast.projectedStress - (s.stress || 0)) * 3)), confidence: typeof forecast.confidence === 'number' ? clamp(forecast.confidence) : 0.4, weight: 0.6, provenance: 'Population forecast' });
    var weighted = function (list) { var a = 0, b = 0; list.forEach(function (c) { var w = c.weight * c.confidence; a += c.alarm * w; b += w; }); return b ? a / b : 0; };
    var primary = channels[0], others = channels.slice(1), other = others.length ? weighted(others) : 0, divergence = other - primary.alarm;
    var loudest = others.slice().sort(function (a, b) { return b.alarm * b.confidence - a.alarm * a.confidence; })[0];
    var salience = divergence >= 0.22 && primary.alarm < 0.5 && loudest && loudest.alarm >= 0.4 ? 'blind-channel'
      : primary.alarm - other >= 0.22 && primary.alarm >= 0.5 ? 'primary-only' : 'aligned';
    var alarms = channels.map(function (c) { return c.alarm; });
    var out = { version: 2, domain: this.domainId, localOwner: true, method: 'domain-local-weighted-divergence',
      observeOnly: true, channels: channels, channelCount: channels.length,
      primary: 'domain-stress', primaryAlarm: primary.alarm, consensusOther: r(other),
      integrated: r(weighted(channels)), divergence: r(divergence),
      uncertainty: r(Math.max.apply(null, alarms) - Math.min.apply(null, alarms)), salience: salience,
      attend: salience === 'blind-channel' ? loudest.name : null, note: 'Population-local interoception; observe-only.' };
    s.populationInteroception = s.domainInteroception = s.interoception = out;
    cog.interoception = out;
    return out;
  };

  PopulationBrain.prototype._computePopulationActiveInference = function () {
    var s = this.state, cog = s.cognition;
    if (!cog) return null;
    if (this._activeInference === undefined) {
      try { this._initDomainActiveInference(); } catch (e) { this._activeInference = null; }
    }
    var box = this._activeInference;
    if (!box || !box.A) {
      s.populationActiveInference = s.domainActiveInference = { version: 2, domain: this.domainId, localOwner: true, mode: 'off', note: 'active-inference primitive unavailable' };
      return null;
    }
    var n = s.domainNeuro || cog.neuro || {}, ledger = n.outcomeLedger || {};
    box.A.updateBeliefs(box.ai, typeof s.stress === 'number' ? s.stress : null);
    var selection = box.A.selectAction(box.ai, { setpoint: n.homeostasis && typeof n.homeostasis.adaptiveThreshold === 'number' ? n.homeostasis.adaptiveThreshold : 0.35,
      callHitRate: typeof ledger.hitRate === 'number' ? ledger.hitRate : null, brakeActive: !!(n.brake && n.brake.level === 'halt') });
    var queued = (s.populationEmissionQueue && s.populationEmissionQueue.packages || []).length;
    var actual = n.brake && n.brake.level === 'halt' ? 'hold-emission' : queued ? 'emit-call' : n.attention && n.attention.driver === 'novelty-driven' ? 'broaden-attention' : 'observe';
    var out = { version: 2, domain: this.domainId, localOwner: true, mode: 'shadow',
      selected: selection.selected, selectedMaps: selection.selectedMaps, actualBehavior: actual,
      agreement: selection.selected === actual, actions: selection.actions, beliefs: selection.beliefs,
      preference: selection.preference, liveConsumer: false, thing2Consumed: false,
      note: 'Population-local belief update and expected-free-energy advisory; no live consumer.' };
    s.populationActiveInference = s.domainActiveInference = out;
    cog.activeInference = out;
    return out;
  };

  PopulationBrain.prototype._computeDomainPlasticity = PopulationBrain.prototype._computePopulationPlasticity;
  PopulationBrain.prototype._computeGenericEmissionQueue = PopulationBrain.prototype._computePopulationEmissionQueue;
  PopulationBrain.prototype._runGenericAutonomousEmission = PopulationBrain.prototype._runPopulationAutonomousEmission;
  PopulationBrain.prototype._computeGenericInteroception = PopulationBrain.prototype._computePopulationInteroception;
  PopulationBrain.prototype._computeGenericActiveInference = PopulationBrain.prototype._computePopulationActiveInference;


  var brain = new PopulationBrain(); brain.init(); brain.start();
  window.LIMENPopulationBrain = brain;
  window.LIMENDomainBrains.register(brain);

  // ── SOVEREIGN OPERATOR MODULE AUTO-LOADER ──
  var _isDomainConsole = window.location.pathname.indexOf('domain-console') !== -1;
  var _domParam = (new URLSearchParams(window.location.search)).get('domain');
  var _isPopulationDomain = _domParam === 'population';
  if (_isDomainConsole && _isPopulationDomain) {
    window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION = true;

    var _populationScripts = [
      'assets/js/population-compensation.js',
      'assets/js/population-claim-ledger.js',
      'assets/js/population-claim-flow.js',
      'assets/js/population-opportunity-economics.js',
      'assets/js/population-pulse-engine.js',
      'assets/js/population-operator-panel.js',
      'assets/js/population-node-business-engine.js',
      'assets/js/population-business-review.js',
      'assets/js/population-execution-panels.js',
      'assets/js/population-business-build.js',
      'assets/js/population-directive-extractor.js',
      'assets/js/population-directive-ranker.js',
      'assets/js/population-directive-translator.js',
      'assets/js/population-targeting-engine.js',
      'assets/js/population-promotion-bridge.js',
      'assets/js/population-clarity-operator.js'
    ];
    (function loadNext(i) {
      if (i >= _populationScripts.length) return;
      var s = document.createElement('script');
      s.src = _populationScripts[i];
      s.onload = function () { loadNext(i + 1); };
      s.onerror = function () { console.warn('[PopulationBrain] Failed to load ' + _populationScripts[i]); loadNext(i + 1); };
      document.head.appendChild(s);
    })(0);
  }
})();
