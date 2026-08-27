/**
 * industry-brain.js — Industry Domain Cognitive Engine
 *
 * Manufacturing & industrial production: factory output, capacity utilization,
 * automation & robotics, heavy equipment & capital goods, industrial supply chains,
 * machinery & equipment, industrial maintenance, industrial capex cycles.
 *
 * Feeds: ISM Manufacturing PMI, BLS manufacturing capacity utilization, BLS manufacturing PPI,
 *   inventory indices / inventory-to-sales ratio,
 *   Fed Reg OSHA (workplace safety), Fed Reg MSHA (mine safety), Fed Reg BIS (export controls),
 *   Fed Reg DOL (labor regs), NHTSA recalls, CPSC recalls, PHMSA incidents, CSB investigations,
 *   UAW/USW strike tracker, RSS industrial news, industrial capex surveys.
 *
 * Diagnosis matching: SUPPLY_CHAIN_COLLAPSE (input shortage / supplier constraint),
 *   AUTOMATION_FAILURE (equipment failure / production halt), TOXIC_SPILL (contamination / safety incident),
 *   QUALITY_CRISIS (defect / recall), WORKFORCE_SHORTAGE (labor gap / strikes).
 *
 * Company tickers: CAT, DE, GE, HON, MMM, EMR, ITW, ETN, PH, ROK, DOV, GEV.
 * Production-capacity sub-layer (additive, real-content, INVESTABLE-only):
 *   FACTORY_CAPACITY_PINCH, AUTOMATION_INVESTMENT_OPPORTUNITY, EQUIPMENT_LIFECYCLE_RISK,
 *   PRODUCTION_THROUGHPUT_BOTTLENECK, PREDICTIVE_MAINTENANCE_EDGE.
 *
 * Cross-domain emissions: supplyChain, infrastructure, energy, economy, finance
 * Exposes: window.LIMENIndustryBrain
 */
(function () {
  'use strict';
  if (!window.LIMENDomainBrainBase) { console.warn('[IndustryBrain] Base not loaded'); return; }
  var Base = window.LIMENDomainBrainBase;

  function IndustryBrain() { Base.call(this, { groundedOnly: true,   // circularity cut 2026-07-24
       domainId: 'industry', label: 'Industry', snapshotKey: 'industry', cycleInterval: 30000 });
    this.resourceAuthority = { ownerDomain: 'industry', policyId: 'industry-resource/1', sandboxLane: 'crm', lanes: ['vendor-operations', 'commerce', 'investment-advisory'], budgets: { computeUnitsPerCycle: 512, queueCapacity: 64 }, switches: { internalCycle: true, internalEmission: true, externalAction: false, spend: false, capital: false } };
    this.motorAuthority = { ownerDomain: 'industry', contractId: 'industry-motor/1', externalValveId: 'industry:crm', lane: 'crm', decisionContract: 'relationship-operation-decision/1', budgetId: 'industry-crm-budget/1', receiptClass: 'crm-receipt', outcomeClass: 'stage-transition-or-revenue', rollbackClass: 'revert-close-or-suppress', executorVerified: false, outcomeObserverVerified: false, switches: { prepare: true, simulate: true, external: false } };
  }
  IndustryBrain.prototype = Object.create(Base.prototype);
  IndustryBrain.prototype.constructor = IndustryBrain;

  IndustryBrain.prototype.init = function () {
    Base.prototype.init.call(this);
    this._loadCommandBoardCompanies();        // wire real industrial company entities (state.companies was starved)
    try { this._loadIndustryBrainSignals(); } catch (e) {}   // validated per-company distress (kernel gate)
    this._loadIndustryDiagnosisBundles();     // G1: load real artifact-source bundles (only ones that exist)
    this._loadIndustryL1PortalDepth();        // J1: scan L1 portal branches (treatments mad-lib -> NOT admitted; real tickers only)
    this._loadProductionCapacityLayer();      // sub-layer: hand-authored production-capacity diagnoses (additive, never merged into the 5-spine)

    // ── OVERLAY ACTUATION (2026-07-13): port of the Energy actuation depth to Industry. ──────────
    // VALIDITY GATE (per-actuation honesty; see ENERGY_NEURO_AUDIT.md discipline). Industry earns
    // all four because it has REAL controllable effectors and a Thing1-validated phase:
    //   refractory=true  — effector = action-draft (REPORT_GENERATION) emission in _checkDiagnosisActions.
    //                      Neuro Ref III.3 refractory (absolute dead-time + relative raised-threshold;
    //                      a stronger stimulus can still re-fire). Inline limiter (no energy module dep).
    //   servo=true       — effector = opportunity-emission confidence (real output channel Industry
    //                      already emits). PI regulate-to-target (E/I: inhibition tracks drive). Ref XIII.1/V.2/XII.
    //   eiBrake=true     — effector = SAME opportunity-emission channel; consumes servo.emissionFactor
    //                      and dampens proportionally with drive. Ref XIII.1.
    //   phase=true       — Industry's domain phase IS P3 (industry.json), a Thing1-VALIDATED phase.
    //                      A realized P3/P7-involving phase TRANSITION is self-consistency calibration
    //                      (interpretive): it drives the K4 credit-source preemption of the learning rate
    //                      (patent 3.4 M matrix + thing2 lineage) but is NEVER an external reward. Industry
    //                      is NOT externalRewardEligible (only Finance is), so externalOutcome is always
    //                      null and isReward is always false — all credit here is calibration, not reward.
    //                      Off-family transitions stay advisory self-consistency too (never fabricate a
    //                      validated signal — the same honest boundary the central LIMENK4 gate enforces).
    // Every actuation is additive + reversible (flip a flag to false) and touches ONLY the emission/
    // credit channels — never rewrites stress, scoring, diagnoses, or any data file. Deterministic:
    // NO paid-AI / fetch-to-LLM ever runs on the 30s cycle (see _authorNodeBusinessViaOperator stub).
    this._actuation = { overlays: true, refractory: true, servo: true, eiBrake: true, phase: true };
    // Refractory windows MIRROR assets/data/domains/industry.json runtime.params (the brain runs in
    // its own context and does not load that file); keep the two in sync when tuning. 1:4 doc ratio.
    this._refractoryParams = {
      absoluteWindow: 900000,     // 15 min hard dead-time (operator-set)
      relativeWindow: 3600000,    // 1 hr raised-bar window (1:4 ratio preserved)
      overrideThreshold: 0.9      // reduced sensitivity: only stress >= 0.9 re-fires a diagnosis in-window
    };
    this._servoIntegral = 0;      // bounded slow arm of the PI servo (persists across cycles)

    // ── K1-K8 NEURO-COMPLETION STATE (Energy-parity port; deterministic, additive) ──────────────
    // Slow-model store, outcome (self-prediction) log, and set-point buffers the K-layers persist
    // across cycles. Mirrors Energy's lazily-created stores but declared here for clarity. Every
    // K-layer is advisory-by-default; the two that CLOSE a loop (K4 self-consistency truth-brake →
    // effective learning rate; K8 adaptive set-point → handoff floor) do so with a one-cycle lag,
    // only in the branch the existing phase-consistency credit source (self-consistency, not reward) leaves untouched, and are read at
    // the TOP of _updateIndustryModel (so cycle 1, with empty stores, preserves current behavior).
    this._industryOutcomeBuffer = [];   // rolling {predicted, realized, err} (K4)
    this._industryPrevPrediction = null; // last cycle's predictedStress, reconciled next cycle (K4)
    this._industrySlowModel = null;      // parallel slow-weight track (K3); created lazily in K3

    // ── THING2 RECURSIVE PHASE KERNEL as the phase source (2026-07-13) ──────────────────────────
    // The REAL Thing2 recursive phase kernel (assets/js/limen-thing2-adapter.js, PURE MATH — no
    // network, no AI) becomes the phase source for the coherence router + phase-transition calibration,
    // with the naive/static state.phase kept as an UNCHANGED fallback. We persist a rolling window
    // of the domain's PRIMARY STRESS scalar (this.state.stress; up = worse) across cycles and feed
    // it to the kernel with positive:false (STRESS axis). Deterministic; guarded so cycle 1 (short
    // series) and any kernel failure fall back to the existing naive phase (current behavior).
    this._kernelPhase = null;            // set each cycle when the kernel returns a phase; else null
    this._phaseSeries = [];
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        var _ps0 = JSON.parse(localStorage.getItem('limen:phaseseries:industry'));
        if (Array.isArray(_ps0)) this._phaseSeries = _ps0;
      }
    } catch (_psErr) { this._phaseSeries = this._phaseSeries || []; }

    this.diagnosisIndex = {
      'SUPPLY_CHAIN_COLLAPSE': ['input_shortage', 'supplier_constraint', 'component_scarcity', 'critical_part_delay', 'industry_high_stress', 'macro_shock'],
      'AUTOMATION_FAILURE':     ['equipment_failure', 'automation_breakdown', 'capacity_constraint', 'production_halt', 'maintenance_backlog'],
      'TOXIC_SPILL':            ['industrial_incident', 'contamination_event', 'safety_failure', 'industry_high_stress'],
      'QUALITY_CRISIS':         ['quality_defect', 'recall_risk', 'inspection_failure', 'reliability_decline', 'industry_high_stress'],
      'WORKFORCE_SHORTAGE':     ['labor_shortage', 'workforce_gap', 'contractor_limit', 'labor_stoppage', 'structural_stress'],
      // Production-capacity sub-layer — activation conditions (real-content, additive)
      'FACTORY_CAPACITY_PINCH':            ['capacity_constraint', 'maintenance_backlog', 'labor_shortage', 'production_halt'],
      'AUTOMATION_INVESTMENT_OPPORTUNITY': ['automation_breakdown', 'labor_shortage', 'capacity_constraint', 'reliability_decline'],
      'EQUIPMENT_LIFECYCLE_RISK':          ['equipment_failure', 'reliability_decline', 'maintenance_backlog'],
      'PRODUCTION_THROUGHPUT_BOTTLENECK':  ['production_halt', 'input_shortage', 'capacity_constraint', 'automation_breakdown'],
      'PREDICTIVE_MAINTENANCE_EDGE':       ['maintenance_backlog', 'equipment_failure', 'reliability_decline']
    };
    this.emissionRules = [
      { targetDomain: 'supplyChain', signalType: 'output_bottleneck', condition: function (s) { return s.stress >= 0.25; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.55); } },
      { targetDomain: 'infrastructure', signalType: 'plant_throughput_strain', condition: function (s) { return s.stress >= 0.30; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); } },
      { targetDomain: 'energy', signalType: 'industrial_load_pressure', condition: function (s) { return s.stress >= 0.30; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.4); } },
      { targetDomain: 'economy', signalType: 'production_slowdown', condition: function (s) { return s.stress >= 0.25; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); } },
      { targetDomain: 'finance', signalType: 'industrial_margin_pressure', condition: function (s) { return s.stress >= 0.35; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); } }
    ];
  };

  IndustryBrain.prototype.normalizeSignals = function () {
    var signals = [], rawSignals = (this._rawDomain && this._rawDomain.signals) || [];
    for (var i = 0; i < rawSignals.length; i++) signals.push(rawSignals[i]);
    this._activeConditions = [];

    // Long-arc baseline — industrial systems always have maintenance/capacity pressure
    this._activeConditions.push('maintenance_backlog');
    this._activeConditions.push('capacity_constraint');
    signals.push('BASELINE: Industrial maintenance backlog and capacity utilization — persistent pressure');

    var feeds = this.state.feeds;
    for (var fi = 0; fi < feeds.length; fi++) {
      var f = feeds[fi], fn = (f.name || '').toLowerCase();
      if ((fn.indexOf('pmi') !== -1 || fn.indexOf('manufacturing') !== -1 || fn.indexOf('production') !== -1) && f.value !== undefined) {
        if (f.value < 50) { this._activeConditions.push('production_halt'); signals.push('ALERT: Manufacturing PMI below 50 — contraction'); }
        if (f.value < 45) { this._activeConditions.push('industrial_incident'); }
      }
      if ((fn.indexOf('inventory') !== -1 || fn.indexOf('supply') !== -1) && f.value !== undefined && f.value < -5) {
        this._activeConditions.push('input_shortage'); this._activeConditions.push('component_scarcity');
      }
    }

    // ── INSTITUTIONAL FEED-DERIVED CONDITIONS (Federal Register / RSS counts) ──
    for (var f3i = 0; f3i < feeds.length; f3i++) {
      var f3 = feeds[f3i];
      var fn3 = (f3.name || '').toLowerCase();

      // Fed Reg OSHA — workplace safety regs → safety_failure / labor_stoppage
      if (fn3.indexOf('fed reg osha') !== -1 && f3.value !== undefined && f3.value >= 3) {
        this._activeConditions.push('safety_failure');
        signals.push('Fed Reg OSHA: ' + f3.value + ' workplace safety docs (30d)');
      }
      if (fn3.indexOf('fed reg osha') !== -1 && f3.value !== undefined && f3.value >= 6) {
        this._activeConditions.push('inspection_failure');
        this._activeConditions.push('labor_stoppage');
      }

      // Fed Reg MSHA — mine safety → industrial_incident / contamination_event
      if (fn3.indexOf('fed reg msha') !== -1 && f3.value !== undefined && f3.value >= 3) {
        this._activeConditions.push('industrial_incident');
        signals.push('Fed Reg MSHA: ' + f3.value + ' mine safety docs (30d)');
      }
      if (fn3.indexOf('fed reg msha') !== -1 && f3.value !== undefined && f3.value >= 6) {
        this._activeConditions.push('contamination_event');
      }

      // Fed Reg BIS — export controls → input_shortage / supplier_constraint
      if (fn3.indexOf('fed reg bis') !== -1 && f3.value !== undefined && f3.value >= 3) {
        this._activeConditions.push('supplier_constraint');
        signals.push('Fed Reg BIS: ' + f3.value + ' export-control docs (30d)');
      }
      if (fn3.indexOf('fed reg bis') !== -1 && f3.value !== undefined && f3.value >= 6) {
        this._activeConditions.push('input_shortage');
        this._activeConditions.push('critical_part_delay');
      }

      // Fed Reg DOL — labor regs → workforce_gap / labor_shortage
      if (fn3.indexOf('fed reg dol') !== -1 && f3.value !== undefined && f3.value >= 3) {
        this._activeConditions.push('workforce_gap');
        signals.push('Fed Reg DOL: ' + f3.value + ' labor regulatory docs (30d)');
      }
      if (fn3.indexOf('fed reg dol') !== -1 && f3.value !== undefined && f3.value >= 6) {
        this._activeConditions.push('labor_shortage');
        this._activeConditions.push('contractor_limit');
      }

      // RSS keyword feeds (NHTSA / CPSC / PHMSA / CSB / UAW) — value = article count
      if (fn3.indexOf('nhtsa recalls') !== -1 && f3.value !== undefined && f3.value >= 5) {
        this._activeConditions.push('quality_defect');
        this._activeConditions.push('recall_risk');
        signals.push('NHTSA: ' + f3.value + ' recall articles');
      }
      if (fn3.indexOf('cpsc recalls') !== -1 && f3.value !== undefined && f3.value >= 5) {
        this._activeConditions.push('quality_defect');
        this._activeConditions.push('recall_risk');
        signals.push('CPSC: ' + f3.value + ' recall articles');
      }
      if (fn3.indexOf('phmsa incidents') !== -1 && f3.value !== undefined && f3.value >= 5) {
        this._activeConditions.push('industrial_incident');
        this._activeConditions.push('contamination_event');
        signals.push('PHMSA: ' + f3.value + ' incident articles');
      }
      if (fn3.indexOf('csb investigations') !== -1 && f3.value !== undefined && f3.value >= 5) {
        this._activeConditions.push('industrial_incident');
        this._activeConditions.push('safety_failure');
        signals.push('CSB: ' + f3.value + ' investigation articles');
      }
      if (fn3.indexOf('uaw strike tracker') !== -1 && f3.value !== undefined && f3.value >= 5) {
        this._activeConditions.push('labor_stoppage');
        signals.push('UAW/USW: ' + f3.value + ' strike articles');
      }
      if (fn3.indexOf('uaw strike tracker') !== -1 && f3.value !== undefined && f3.value >= 10) {
        this._activeConditions.push('labor_shortage');
      }

      // BLS Manufacturing PPI — high level = input cost spike → margin / production
      if (fn3.indexOf('bls manufacturing ppi') !== -1 && f3.value !== undefined && f3.value >= 130) {
        this._activeConditions.push('reliability_decline');
        signals.push('BLS PPI: manufacturing input price index ' + f3.value.toFixed(1));
      }
      if (fn3.indexOf('bls manufacturing ppi') !== -1 && f3.value !== undefined && f3.value >= 145) {
        this._activeConditions.push('production_halt');
      }
    }

    for (var rsi = 0; rsi < rawSignals.length; rsi++) {
      var rs = (typeof rawSignals[rsi] === 'string' ? rawSignals[rsi] : '').toLowerCase();
      if (rs.indexOf('shortage') !== -1 || rs.indexOf('scarcity') !== -1 || rs.indexOf('supply') !== -1 && rs.indexOf('disrupt') !== -1) {
        if (this._activeConditions.indexOf('input_shortage') === -1) this._activeConditions.push('input_shortage');
        if (this._activeConditions.indexOf('supplier_constraint') === -1) this._activeConditions.push('supplier_constraint');
      }
      if (rs.indexOf('outage') !== -1 || rs.indexOf('halt') !== -1 || rs.indexOf('shutdown') !== -1 || rs.indexOf('stoppage') !== -1) {
        if (this._activeConditions.indexOf('production_halt') === -1) this._activeConditions.push('production_halt');
      }
      if (rs.indexOf('spill') !== -1 || rs.indexOf('toxic') !== -1 || rs.indexOf('contamina') !== -1 || rs.indexOf('leak') !== -1) {
        if (this._activeConditions.indexOf('contamination_event') === -1) this._activeConditions.push('contamination_event');
        if (this._activeConditions.indexOf('safety_failure') === -1) this._activeConditions.push('safety_failure');
      }
      if (rs.indexOf('recall') !== -1 || rs.indexOf('defect') !== -1 || rs.indexOf('quality') !== -1) {
        if (this._activeConditions.indexOf('quality_defect') === -1) this._activeConditions.push('quality_defect');
      }
      if (rs.indexOf('labor') !== -1 || rs.indexOf('worker') !== -1 || rs.indexOf('strike') !== -1 || rs.indexOf('workforce') !== -1) {
        if (this._activeConditions.indexOf('labor_shortage') === -1) this._activeConditions.push('labor_shortage');
      }
      if (rs.indexOf('automat') !== -1 && (rs.indexOf('fail') !== -1 || rs.indexOf('break') !== -1 || rs.indexOf('down') !== -1)) {
        if (this._activeConditions.indexOf('automation_breakdown') === -1) this._activeConditions.push('automation_breakdown');
      }
    }

    // Cross-domain pressure as short-arc feed
    if (window.LIMENDomainBrains) {
      var allBrains = window.LIMENDomainBrains.getAll();
      for (var bk in allBrains) {
        if (bk === 'industry') continue;
        var b = allBrains[bk]; if (!b || !b.state) continue;
        var bEm = b.state.crossDomainEmissions || [];
        for (var bei = 0; bei < bEm.length; bei++) {
          var be = bEm[bei];
          if (be.targetDomain === 'industry' && be.magnitude > 0.1) {
            signals.push('FEED [' + bk.toUpperCase() + ']: ' + (be.signal || '').replace(/_/g, ' ') + ' — ' + Math.round(be.magnitude * 100) + '%');
            if (this._activeConditions.indexOf('supplier_constraint') === -1 && be.magnitude > 0.2) this._activeConditions.push('supplier_constraint');
          }
        }
      }
    }

    var snap = this._getSnapshot();
    if (snap && snap.defenseSignals) { for (var si = 0; si < snap.defenseSignals.length; si++) { var sig = snap.defenseSignals[si]; if (sig.affectedDomains && sig.affectedDomains.indexOf('industry') !== -1) { this._activeConditions.push(sig.eventType); signals.push('FEED [DEFENSE]: ' + (sig.eventType || '').replace(/_/g, ' ')); } } }
    if (snap && snap.macroShock && snap.macroShock.detected) this._activeConditions.push('macro_shock');

    // ── CIRCULARITY CUT (2026-07-24) — no condition may be manufactured from this
    //    domain's own stress scalar. normalizeSignals runs BEFORE scoreStress, so these
    //    gates read the PREVIOUS cycle's stress: the resulting "active diagnosis" restated
    //    one number instead of adding evidence, and because emissions are gated on an
    //    active diagnosis and peers fold received pressure back into stress, it closed a
    //    feedback ring carrying no new information. Reground to a real feed to restore a
    //    condition; never re-derive one from stress.
    //    SURVIVES on real feeds/events : 5: reliability_decline, labor_shortage, contractor_limit, production_halt, input_shortage
    //    REMOVED, no other source in this file : 3: equipment_failure, industry_high_stress, structural_stress

    var extPressure = this.getExternalPressure ? this.getExternalPressure() : 0;
    if (extPressure >= 0.10) this._activeConditions.push('critical_part_delay');

    this.state.signals = signals;
    return Promise.resolve();
  };

  IndustryBrain.prototype.deriveDiagnoses = function () {
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
          window.DomainTelemetryAdapter.fromLiveCached("industry", self.state, self._runtimeOverlay || null)
            .then(function (ov) { if (ov) self._runtimeOverlay = ov; }).catch(function () {});
        }
      } catch (_e) {}
    });
  };

  IndustryBrain.prototype.recommendTreatments = function () {
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

  IndustryBrain.prototype.surfaceOpportunities = function () {
    Base.prototype.surfaceOpportunities.call(this);
    // Fall back to real command-board industrial entities (or the static ticker list) when the
    // snapshot didn't supply companies — so opportunities reference real tickers, not scaffold.
    if ((!this.state.companies || !this.state.companies.length)) {
      if (this._cbIndustryCompanies && this._cbIndustryCompanies.length) this.state.companies = this._cbIndustryCompanies;
      else if (this._industryTickers && this._industryTickers.length) this.state.companies = this._industryTickers.slice();
    }
    var opps = [], stress = this.state.stress, activeDx = this.state.diagnoses.filter(function (d) { return d.active; }), allDx = this.state.diagnoses || [], companies = this.state.companies, seen = {};
    function add(o) { var key = o.title.toLowerCase().replace(/[^a-z0-9]/g, ''); if (seen[key]) return; seen[key] = true; opps.push(o); }

    for (var di = 0; di < activeDx.length; di++) {
      var dx = activeDx[di], dxLabel = (dx.label || dx.id || '').replace(/_/g, ' ');
      add({ title: dxLabel + ' — production optimization and capacity platform', rank: stress * dx.relevance, path: 'RESEARCHABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.50) add({ title: dxLabel + ' — maintenance acceleration and reliability hardening', rank: stress * dx.relevance * 0.9, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.55 && dx.relevance >= 0.2) add({ title: dxLabel + ' — industrial automation and throughput improvement', rank: stress * 0.85, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      add({ title: dxLabel + ' — supplier diversification and input resilience', rank: stress * dx.relevance * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
    }
    var _pub = this._pubSignals || {};
    var termCo = (this.state.companies || []).filter(function (c) { var sg = _pub[c.ticker]; return sg && sg.band === 'elevated'; });
    if (termCo.length > 0) add({ title: 'Industry terminal entity distressed positioning', rank: 0.95, path: 'INVESTABLE', urgency: 'high', source: 'company_terminal', tier: 1, companies: termCo.map(function (c) { return c.ticker; }), stress: stress });
    if (this.state.convergence && this.state.convergence.primary_signal) add({ title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — industry convergence response', rank: 0.98, path: 'INVESTABLE', urgency: 'high', source: 'convergence', tier: 1, stress: stress });
    var emissions = this.state.crossDomainEmissions || [];
    for (var ei = 0; ei < emissions.length; ei++) { var em = emissions[ei]; add({ title: 'Industry \u2192 ' + (em.targetDomain || '').replace(/_/g, ' ') + ' — ' + (em.signal || em.signalType || '').replace(/_/g, ' '), rank: (em.magnitude || 0.5) * stress * 0.8, path: 'INVESTABLE', urgency: em.magnitude > 0.6 ? 'high' : 'medium', source: 'cross_domain', tier: 2, stress: stress }); }
    if (stress >= 0.50) { add({ title: 'Industrial capacity expansion and modernization', rank: stress * 0.65, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, stress: stress }); add({ title: 'Output continuity — redundancy and backup systems', rank: stress * 0.70, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, stress: stress }); }
    if (stress >= 0.60) { add({ title: 'Industrial safety and compliance hardening', rank: stress * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, stress: stress }); add({ title: 'Smart manufacturing — IoT monitoring and predictive maintenance', rank: stress * 0.68, path: 'RESEARCHABLE', urgency: 'medium', source: 'lagging', tier: 3, stress: stress }); }
    var nearDx = allDx.filter(function (d) { return !d.active && d.relevance > 0 && d.totalTriggers > 0; });
    for (var ndi = 0; ndi < nearDx.length; ndi++) { if (stress >= 0.45) add({ title: (nearDx[ndi].label || '').replace(/_/g, ' ') + ' — early-stage monitoring', rank: stress * (nearDx[ndi].relevance || 0.1) * 0.5, path: 'RESEARCHABLE', urgency: 'watching', source: 'near_diagnosis', tier: 2, stress: stress, nearDiagnosisId: nearDx[ndi].id }); }

    // ═══ PRODUCTION-CAPACITY SUB-LAYER → opportunities (real-content, INVESTABLE-only) ═══
    // Mirrors energy's DC layer / trade's freight-flow layer. Companies are the real industrial
    // tickers bound to each diagnosis's circuit nodes. Conscience vetoes patent/grant, so only
    // the investment lane is offered.
    var pcDiags = this.state.productionCapacityDiagnoses || [];
    var pcPortal = this._pcPortal;
    if (pcDiags.length && pcPortal) {
      var nodeCos = {};
      (pcPortal.activations || []).forEach(function (a) { if (a.brainNodeId) nodeCos[a.brainNodeId] = (a.companies || []).map(function (c) { return c.ticker_or_id || c.name; }); });
      for (var pci = 0; pci < pcDiags.length; pci++) {
        var pdx = pcDiags[pci];
        var plab = (pdx.label || pdx.id || '').replace(/_/g, ' ');
        var cosSet = {};
        (pdx.circuits || []).forEach(function (c) { (nodeCos[c.nodeId] || []).forEach(function (tk) { cosSet[tk] = true; }); });
        var coList = Object.keys(cosSet);
        if (pdx.active) {
          add({ title: plab + ' — production-capacity positioning', rank: stress * (pdx.relevance || 0.5) * 0.9, path: 'INVESTABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'production_capacity', diagnosisId: pdx.id, tier: 1, stress: stress, companies: coList, productionCapacity: true });
          add({ title: plab + ' — monitoring and capital-allocation platform', rank: stress * (pdx.relevance || 0.5) * 0.7, path: 'INVESTABLE', urgency: 'medium', source: 'production_capacity', diagnosisId: pdx.id, tier: 1, stress: stress, companies: coList, productionCapacity: true });
        } else if (stress >= 0.45) {
          add({ title: plab + ' — capacity-trend monitoring (early-stage)', rank: stress * (pdx.relevance || 0.1) * 0.5, path: 'INVESTABLE', urgency: 'watching', source: 'production_capacity', diagnosisId: pdx.id, tier: 2, stress: stress, companies: coList, productionCapacity: true });
        }
      }
    }

    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });
    // Canonical enrichment — merge industry playbook detail per opportunity
    var PB_LIST = window.LIMENIndustryOpportunityPlaybooks || [];
    var _byId = {};
    for (var _pbi = 0; _pbi < PB_LIST.length; _pbi++) _byId[PB_LIST[_pbi].id] = PB_LIST[_pbi];
    var _PB_MAP = {
      'SUPPLY_CHAIN_COLLAPSE': 'supply_chain_collapse_industry',
      'AUTOMATION_FAILURE': 'automation_failure',
      'TOXIC_SPILL': 'toxic_spill_industry',
      'QUALITY_CRISIS': 'quality_crisis',
      'WORKFORCE_SHORTAGE': 'workforce_shortage_industry'
    };
    var _LAGGING_MAP = {
      
    };
    function _resolvePbId(o) {
      if (o.diagnosisId && _PB_MAP[o.diagnosisId]) return _PB_MAP[o.diagnosisId];
      if (o.source === 'lagging' && o.diagnosisId && _LAGGING_MAP[o.diagnosisId]) return _LAGGING_MAP[o.diagnosisId];
      if (o.nearDiagnosisId && _PB_MAP[o.nearDiagnosisId]) return _PB_MAP[o.nearDiagnosisId];
      return null;
    }
    function _urgencyLabel(u) { if (u === 'high') return 'IMMEDIATE'; if (u === 'medium') return 'ACTIVE'; if (u === 'watching') return 'WATCH'; return (u || '').toUpperCase(); }
    // Lanes: investment + research ONLY (patent/grant/loan purged; relaned GRANT->INVESTABLE, PATENT->RESEARCHABLE)
    var _COMP = {
      'INVESTABLE':   { type: 'invest',   base: 5, unit: 'profit%', tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
      'RESEARCHABLE': { type: 'research', base: 5, unit: 'credit%', tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 published research briefs' },    maxTier: { tier: 3, comp: 15 } }
    };
    for (var oi = 0; oi < opps.length; oi++) {
      var o = opps[oi];
      o.id = (o.diagnosisId || o.nearDiagnosisId || o.source || 'opp').replace(/[^a-zA-Z0-9]/g, '_') + '_' + (o.path || '').toLowerCase().replace(/[^a-z]/g, '') + '_t' + (o.tier || 0);
      o.domain = 'industry';
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
        var evidenceParts = ['Domain: industry', 'Stress: ' + stressPct + '%'];
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
    // ── E/I BRAKE + PHASE-COHERENCE ACTUATION (consumes the PRIOR cycle's servo + phase dynamics;
    // no-op on cycle 1). Recurrent, one-cycle lag — mirrors energy's _applyEmissionBrake/_applyNeuroGating. ──
    opps = this._applyIndustryActuationGate(opps);

    this.state.opportunityCount = opps.length;

    this.state.opportunities = opps;
    return Promise.resolve();
  };

  // Consumed at the END of surfaceOpportunities: applies the prior cycle's E/I servo dampening to
  // the emitted opportunity confidences (the real output channel). Phase-coherent coupling to
  // stressed, co-phased peers opens the processing window (comm-through-coherence) and RELAXES the
  // dampening a bounded amount. Reads only prior-cycle state (industryServo / industryPhaseDynamics);
  // both absent on cycle 1 → opps returned unchanged. Deterministic; touches only o.confidence.
  IndustryBrain.prototype._applyIndustryActuationGate = function (opps) {
    var servo = this.state.industryServo || null;
    var pd = this.state.industryPhaseDynamics || null;
    if (!this._actuation || !this._actuation.eiBrake || !servo || typeof servo.emissionFactor !== 'number') { this.state._industryGatedCount = 0; return opps; }
    var factor = servo.emissionFactor;   // 0.2..1 (1 = no dampening; <1 = under-braked drive → dampen)
    // PHASE-COHERENCE window: coherent coupling relaxes the brake a bounded amount (never above 1).
    if (this._actuation.phase && pd && typeof pd.couplingStrength === 'number' && pd.couplingStrength > 0.15) {
      factor = Math.min(1, factor + Math.min(0.15, pd.couplingStrength));
    }
    if (factor >= 1) { this.state._industryGatedCount = 0; return opps; }
    var gated = 0;
    for (var i = 0; i < opps.length; i++) {
      if (typeof opps[i].confidence === 'number') {
        var before = opps[i].confidence;
        opps[i].confidence = Math.round(before * factor);
        opps[i].eiDampened = true;
        if (opps[i].confidence < before) gated++;
      }
    }
    this.state._industryGatedCount = gated;
    this.state._industryEmissionFactor = Math.round(factor * 1000) / 1000;
    return opps;
  };

  IndustryBrain.prototype._checkDiagnosisActions = function () {
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; }); if (activeDx.length === 0) return;
    var adapters = window.LIMENActionAdapters; if (!adapters) return;
    var _now = Date.now(), _stress = this.state.stress;
    for (var i = 0; i < activeDx.length; i++) {
      var dx = activeDx[i];
      if (adapters.getDrafts && adapters.getDrafts({ domain: 'industry', intentId: dx.id }).length > 0) continue;
      // REFRACTORY ACTUATION (Neuro Ref III.3): suppress a re-fire of the same diagnosis's action
      // draft inside the dead-time / raised-threshold window. A stronger stimulus (stress >= override)
      // still breaks through. Reversible via _actuation.refractory. Effector = REPORT_GENERATION emission.
      if (this._actuation && this._actuation.refractory && !this._industryRefractoryFire(dx.id, _now, _stress)) {
        this.state._refractorySuppressed = (this.state._refractorySuppressed || 0) + 1;
        continue;
      }
      adapters.createDraft('REPORT_GENERATION', { domain: 'industry', sourceType: 'domain_brain', sourceId: dx.id, intentId: dx.id, title: 'Industry Alert: ' + dx.label, intent: { domain: 'industry', title: dx.label, status: 'ACTIVE', priority: this.state.stress, progress: 0, strategyType: 'diagnosis_response', steps: [{ type: 'ANALYZE', label: 'Assess ' + dx.label + ' industrial impact', status: 'PENDING' }, { type: 'INVESTIGATE', label: 'Identify affected plants, lines, and suppliers', status: 'PENDING' }, { type: 'POSITION', label: 'Evaluate industrial opportunities', status: 'PENDING' }] } });
    }
  };

  // Inline refractory limiter (Neuro Ref III.3) — no external module dependency (energy uses
  // limen-refractory-limiter.js; that module is not loaded on the Industry console). Returns TRUE
  // if the diagnosis may fire, FALSE if suppressed. Absolute window = hard dead-time; relative
  // window = raised bar (a stimulus at/above overrideThreshold still fires). Deterministic.
  IndustryBrain.prototype._industryRefractoryFire = function (id, now, stress) {
    var p = this._refractoryParams || { absoluteWindow: 900000, relativeWindow: 3600000, overrideThreshold: 0.9 };
    var mem = this._refractoryMem = this._refractoryMem || {};
    var last = mem[id];
    if (last != null) {
      var dt = now - last;
      if (dt < p.absoluteWindow) return false;                                    // hard dead-time: never re-fire
      if (dt < p.relativeWindow && (stress || 0) < p.overrideThreshold) return false; // raised bar: only strong re-fires
    }
    mem[id] = now;
    return true;
  };

  IndustryBrain.prototype.resolveDeepContent = function () {
    var self = this; var resolver = window.LIMENPortalContentResolver; if (!resolver) return Promise.resolve();
    return resolver.resolveForBrain(this.state).then(function (content) { self.state.resolvedContent = content; if (content) { var dt = []; for (var dxId in content.byDiagnosis) { var dxC = content.byDiagnosis[dxId]; for (var i = 0; i < dxC.treatments.length; i++) { var t = dxC.treatments[i]; dt.push({ id: 'deep_' + t.nodeId + '_' + i, label: t.label, type: t.type, evidence: t.evidence, description: t.description, cite: t.cite, steps: t.steps, monitoring: t.monitoring, escalation: t.escalation, diagnosisId: dxId, nodeId: t.nodeId, nodeLabel: t.nodeLabel, hasDepth: t.hasDepth, source: 'canonical_deep' }); } } if (dt.length > 0) self.state.treatments = dt; } }).catch(function () {});
  };

  var _origCycle = IndustryBrain.prototype.cycle;
  // Validated per-company distress from the kernel gate (/api/brain-signals). One-shot; {} if it abstains.
  IndustryBrain.prototype._loadIndustryBrainSignals = function () {
    var self = this;
    if (self._pubSignals) return;
    self._pubSignals = {};
    try {
      fetch('/api/brain-signals?domain=industry')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j || !j.publishable) return;
          var m = {};
          j.publishable.forEach(function (s) { if (s.ticker) m[s.ticker] = s; });
          self._pubSignals = m;
        })
        .catch(function () {});
    } catch (e) {}
  };

  IndustryBrain.prototype.cycle = function () {
    var self = this;
    return _origCycle.call(this).then(function () {
      return self.resolveDeepContent();
    }).then(function () {
      // Recurrent loop step — END of each cycle. Reads the prior produced by the
      // PREVIOUS cycle, computes prediction error, regulates, runs the higher layers,
      // assigns state.cognition, and builds the per-diagnosis DDPs. Industry-local +
      // try/caught (never breaks a cycle).
      try { self._updateIndustryModel(); } catch (e) {}
      try { self._computeIndustryOverlays(); } catch (e) {}   // NEURO-SUBSTRATE OVERLAY WIRING (per-domain, ported from finance 2026-07-21): invokes industry's OWN overlay modules each cycle; shadow, proposals only
    });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // NEURO-SUBSTRATE OVERLAY WIRING — per-domain copy of finance's _computeFinanceOverlays
  // (2026-07-21, full per-domain independence). Invokes industry's OWN modules
  // (window.Industry{Metaplasticity,Extinction,RetrogradeThrottle,PredictionErrorCompressor,
  // OfflineMaintenance,NeuroSubstrate,ConnectivityAudit}) against industry's OWN runtime def
  // (industry.json runtime.params + edges/issues/activations). SHADOW: writes state.industryOverlays;
  // the only actuation is metaplasticity -> the refractory dead-time (matches finance exactly).
  // Degrade-safe: returns mode 'off' when the modules are not on the page (they load only on the
  // industry console), 'loading' until industry.json arrives.
  // ════════════════════════════════════════════════════════════════════════════
  IndustryBrain.prototype._loadIndustryDef = function () {
    if (this._industryDef) return this._industryDef;
    if (this._industryDefLoading) return null;
    this._industryDefLoading = true;
    var self = this;
    if (typeof fetch === 'function') {
      try {
        fetch('/assets/data/domains/industry.json').then(function (r) { return r.json(); })
          .then(function (def) { self._industryDef = def; })
          .catch(function () { self._industryDefLoading = false; });
      } catch (e) { this._industryDefLoading = false; }
    }
    return null;
  };

  IndustryBrain.prototype._computeIndustryOverlays = function () {
    var s = this.state;
    function mod(glob, reqPath) {
      if (typeof window !== 'undefined' && window[glob]) return window[glob];
      if (typeof module !== 'undefined') { try { return require(reqPath); } catch (e) {} }
      return null;
    }
    var META = mod('IndustryMetaplasticity', '../industry-metaplasticity.js');
    var EXT = mod('IndustryExtinction', '../industry-extinction.js');
    var RETRO = mod('IndustryRetrogradeThrottle', '../industry-retrograde-throttle.js');
    var PEC = mod('IndustryPredictionErrorCompressor', '../industry-prediction-error-compressor.js');
    var OFF = mod('IndustryOfflineMaintenance', '../industry-offline-maintenance.js');
    var NS = mod('IndustryNeuroSubstrate', '../industry-neuro-substrate.js');
    var CONN = mod('IndustryConnectivityAudit', '../industry-connectivity-audit.js');
    if (!(META && EXT && RETRO && PEC && OFF && NS && CONN)) {
      s.industryOverlays = { version: 1, mode: 'off', note: 'overlay modules not loaded on this page (present only on the industry console)' };
      return null;
    }
    var def = this._loadIndustryDef();
    if (!def) { s.industryOverlays = { version: 1, mode: 'loading', note: 'industry.json runtime def loading; overlays compute next cycle' }; return null; }

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

    var intero = s.industryInteroception || (s.cognition && s.cognition.interoception) || {};
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

    s.industryOverlays = {
      version: 1, mode: 'shadow', armed: armed,
      volatility: Math.round(volatility * 1000) / 1000,
      metaplasticity: { changes: meta.changes, adapted: adapted, noop: meta.noop },
      extinction: { candidates: ext.candidates, count: ext.candidates.length, noop: ext.noop, actuation: 'PROPOSAL-ONLY (retiring a node edits industry.json — human-gated forever)' },
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
    s.industryOverlays.mode = armed ? 'armed' : 'shadow';
    s.industryOverlays.applied = applied;
    s.industryOverlays.actuationScope = 'metaplasticity->refractory dead-time ONLY (bounded, fail-toward-quiet, reversible). throttle=no-live-consumer; PE=observe-only; extinction+offline-prune=PROPOSAL-ONLY (remove structure, human-gated forever).';
    s.industryOverlays.note = 'PER-DOMAIN OVERLAY WIRING (ported from finance): industry runs its OWN 6 overlay modules + connectivity recurrenceAudit each cycle on industry.json. ARMED: metaplasticity raises the refractory dead-time with volatility (clamped, reversible). Everything else is proposal/observe-only.';

    if (s.cognition && typeof s.cognition === 'object') s.cognition.overlays = s.industryOverlays;
    return s.industryOverlays;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // INDUSTRY RECURRENT LOOP + HIGHER LAYERS + DDP (energy-brain parity port)
  //   prior -> observation -> prediction error -> bounded update -> next prior.
  // Proof surface: window.LIMENIndustryBrain.state.industryModel
  // ════════════════════════════════════════════════════════════════════════════
  var IM_VERSION = 1;
  var IM_LEARNING_RATE = 0.25;          // bounded plasticity (fast inference)
  var IM_SLOW_RATE = 0.08;              // slow consolidation (reserved for rebuild/cron)
  var IM_STRESS_FLOOR = 0.25;           // domain-specific floor — persistent maintenance/capacity pressure
  var IM_FLOOD_CAP = 12;                // institutional-feed / opportunity-flood threshold
  var IM_STALE_MS = 1000 * 60 * 60 * 6; // 6h feed staleness
  var IK_OUTCOME_BUFFER = 40;           // K4 rolling predicted-vs-realized samples
  var IK_HOMEO_WINDOW = 60;             // K8 cycles of stress baseline for the adaptive set-point

  function _imClamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function _imJaccardDistance(a, b) {
    a = a || []; b = b || [];
    if (a.length === 0 && b.length === 0) return 0;
    var union = {}, inter = 0, setB = {}, seen = {};
    for (var i = 0; i < b.length; i++) { setB[b[i]] = true; union[b[i]] = true; }
    for (var j = 0; j < a.length; j++) { union[a[j]] = true; if (setB[a[j]] && !seen[a[j]]) { inter++; seen[a[j]] = true; } }
    var u = Object.keys(union).length;
    return u === 0 ? 0 : 1 - (inter / u);
  }

  IndustryBrain.prototype._neutralIndustryModel = function () {
    return {
      version: IM_VERSION, cycle: 0,
      prior: { expectedStress: 0.5, expectedDiagnoses: [], expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, confidence: 0, samples: 0 },
      observation: null, predictionError: null, predictedStress: null,
      plasticity: { learningRate: IM_LEARNING_RATE, slowRate: IM_SLOW_RATE, consolidation: 'cycle-light/rebuild-heavy' },
      regulation: null, readyForHandoff: false, _lowErrorStreak: 0
    };
  };

  // Count of distinct institutional feeds (OSHA, MSHA, BIS, DOL, NHTSA, CPSC, PHMSA, CSB, UAW, PPI, inventory, supply, PMI)
  IndustryBrain.prototype._industryFeedSignalCount = function () {
    var feeds = this.state.feeds || [];
    var arr = Array.isArray(feeds) ? feeds : Object.keys(feeds).map(function (k) { return feeds[k]; });
    var keys = ['fed reg osha', 'fed reg msha', 'fed reg bis', 'fed reg dol', 'nhtsa', 'cpsc', 'phmsa', 'csb', 'uaw', 'bls manufacturing ppi', 'inventory', 'supply', 'pmi', 'manufacturing', 'production'];
    var hit = {};
    for (var i = 0; i < arr.length; i++) {
      var f = arr[i]; if (!f) continue;
      var nm = (f.name || '').toLowerCase();
      for (var k = 0; k < keys.length; k++) { if (nm.indexOf(keys[k]) !== -1 && f.value !== undefined && f.value !== null) { hit[keys[k]] = true; break; } }
    }
    return { count: Object.keys(hit).length, total: keys.length };
  };

  // B2 — normalized observation from current Industry state
  IndustryBrain.prototype._buildIndustryObservation = function () {
    var s = this.state || {};
    var active = (s.diagnoses || []).filter(function (d) { return d.active; });
    var fc = this._industryFeedSignalCount();
    var feeds = s.feeds || [];
    var arr = Array.isArray(feeds) ? feeds : Object.keys(feeds).map(function (k) { return feeds[k]; });
    var newest = 0;
    for (var i = 0; i < arr.length; i++) { var u = arr[i] && arr[i].updated; if (u && u > newest) newest = u; }
    var stress = typeof s.stress === 'number' ? s.stress : 0;
    var signal = Math.max(stress, fc.total ? fc.count / fc.total : 0);
    return {
      stress: stress,
      phase: s.phase || null,
      activeDiagnoses: active.map(function (d) { return d.id; }).sort(),
      diagnosisCount: active.length,
      feedSignalCount: fc.count,
      opportunityCount: (s.opportunities || []).length,
      companyCount: (s.companies || []).length,
      signal: _imClamp(signal, 0, 1),
      feedNewest: newest,
      timestamp: Date.now()
    };
  };

  // B3 — prediction error: prior.expected* vs observation (pure arithmetic; no evidence scoring)
  IndustryBrain.prototype._computeIndustryPredictionError = function (prior, obs) {
    var stressError = Math.abs(obs.stress - prior.expectedStress);
    var signalError = Math.abs(obs.signal - prior.expectedSignal);
    var diagnosisError = _imJaccardDistance(obs.activeDiagnoses, prior.expectedDiagnoses);
    var total = _imClamp(0.5 * stressError + 0.3 * signalError + 0.2 * diagnosisError, 0, 1);
    var novelty = _imClamp(Math.max(stressError, diagnosisError), 0.05, 0.95);
    return { total: total, stressError: stressError, signalError: signalError, diagnosisError: diagnosisError, novelty: novelty };
  };

  // B4 — bounded prior update toward observation (next cycle reads this)
  IndustryBrain.prototype._updateIndustryPrior = function (prior, obs, lr) {
    return {
      expectedStress: _imClamp(prior.expectedStress + lr * (obs.stress - prior.expectedStress), 0, 1),
      expectedDiagnoses: obs.activeDiagnoses.slice(),
      expectedDiagnosisCount: prior.expectedDiagnosisCount + lr * (obs.diagnosisCount - prior.expectedDiagnosisCount),
      expectedOpportunityCount: prior.expectedOpportunityCount + lr * (obs.opportunityCount - prior.expectedOpportunityCount),
      expectedSignal: _imClamp(prior.expectedSignal + lr * (obs.signal - prior.expectedSignal), 0, 1),
      confidence: _imClamp(Math.min(1, (prior.samples + 1) / 20), 0, 1),
      samples: prior.samples + 1
    };
  };

  // B5 — homeostatic regulation: gain / inhibition / state machine
  IndustryBrain.prototype._computeIndustryRegulation = function (em, obs, pe) {
    var gain = _imClamp(pe.novelty, 0.05, 0.95);
    var inhibition = _imClamp(1 - pe.novelty, 0, 0.9);
    var outputScale = _imClamp(1 - inhibition * 0.5, 0.4, 1);
    var flooding = obs.feedSignalCount > IM_FLOOD_CAP || obs.opportunityCount > IM_FLOOD_CAP;
    var starving = obs.feedSignalCount < 3;
    var stale = obs.feedNewest > 0 ? (Date.now() - obs.feedNewest) > IM_STALE_MS : false;
    var diagMismatch = _imJaccardDistance(obs.activeDiagnoses, em.prior.expectedDiagnoses) > 0.5;
    var surprised = pe.novelty > 0.6 && diagMismatch;
    var streak = (pe.total < 0.05) ? (em._lowErrorStreak || 0) + 1 : 0;
    em._lowErrorStreak = streak;
    var looping = streak >= 3;
    var overconfident = em.prior.confidence > 0.8 && pe.total > 0.4;
    var label = flooding ? 'flooding' : starving ? 'starving' : stale ? 'stale' : surprised ? 'surprised' : looping ? 'looping' : overconfident ? 'overconfident' : pe.novelty > 0.4 ? 'surprised' : 'normal';
    return { gain: gain, inhibition: inhibition, outputScale: outputScale, flooding: flooding, starving: starving, stale: stale, surprised: surprised, looping: looping, overconfident: overconfident, state: label };
  };

  // The recurrent step — END of each cycle. cycle N+1's interpretation depends on cycle N.
  IndustryBrain.prototype._updateIndustryModel = function () {
    var em = this.state.industryModel || this._neutralIndustryModel();
    var priorIn = em.prior;                                          // carried from last cycle
    var obs = this._buildIndustryObservation();
    var pe = this._computeIndustryPredictionError(priorIn, obs);     // prior vs now

    // reads prior BEFORE the final decision (Kalman-style blend, not raw obs):
    var gainBlend = _imClamp(pe.novelty, 0.05, 0.95);
    var predictedStress = priorIn.expectedStress * (1 - gainBlend) + obs.stress * gainBlend;
    var reg = this._computeIndustryRegulation(em, obs, pe);

    // K8 CLOSED — homeostatic set-point: the handoff gate blends the fixed floor with the adaptive
    // baseline (prior cycle's industryHomeostasis; needs >=10 samples, else the fixed floor). The
    // adaptive floor is bounded to at most +0.15 above IM_STRESS_FLOOR so a sustained-stress baseline
    // cannot ratchet the gate out of reach. On cycle 1 (no homeostasis yet) this is exactly IM_STRESS_FLOOR.
    var _hm = this.state.industryHomeostasis;
    var _floor = (_hm && typeof _hm.adaptiveBaseline === 'number' && _hm.samples >= 10)
      ? _imClamp(Math.min(0.5 * IM_STRESS_FLOOR + 0.5 * _hm.adaptiveBaseline, IM_STRESS_FLOOR + 0.15), 0.15, 0.6) : IM_STRESS_FLOOR;
    em._effectiveFloor = _floor;

    // a FINAL decision that depends on the prior, not just on raw obs:
    var readyForHandoff = (em.cycle > 0) && (predictedStress >= _floor) && (obs.diagnosisCount > 0) && !reg.flooding && !reg.stale;

    // ── K4 CREDIT ASSIGNMENT — routed through the CENTRAL honest reward gate (window.LIMENK4). ──
    // The single rule (assets/js/limen-k4-selfconsistency.js): isReward is TRUE only for a REAL
    // external realized outcome. Industry is NOT externalRewardEligible (only Finance is), so
    // externalOutcome is ALWAYS null here — every credit is self-consistency calibration (interpretive),
    // NEVER reward. The gate enforces the preemption order: external(4) > phase-consistency(3) >
    // call-consistency(2) > stress-consistency(1) > none. Industry supplies:
    //   phaseTransitionHit — realized thing2 phase-transition hit (or null when direction undetermined),
    //   phaseValidated     — transition is in the P3/P7 family (gates the phase-consistency TIER; this is
    //                        self-consistency, NOT external reward),
    //   stressSelfPred/stressSamples — the TRUTH BRAKE: prior cycle's predicted-vs-realized stress
    //                        agreement (industryOutcomeModel; >=5 samples). Industry has no separate
    //                        surfaced-call ledger, so callHitRate is omitted.
    // The returned credit modulates the learning rate (a low credit RAISES plasticity so persistent
    // mis-calibration speeds adaptation). Reads the PRIOR cycle's stores (one-cycle lag); cycle 1
    // (empty stores) leaves _lr at the default. Reversible via _actuation.phase. Pure math, no AI/network.
    var _lr = em.plasticity.learningRate;
    var _pt = (this.state.industryPhaseDynamics || {}).transition;
    var _om = this.state.industryOutcomeModel;
    var _sig = {
      externalOutcome: null,   // NOT externalRewardEligible → always null (calibration only, never reward)
      phaseValidated: !!(this._actuation && this._actuation.phase && _pt && _pt.validated),
      phaseTransitionHit: (this._actuation && this._actuation.phase && _pt && _pt.hit != null) ? (_pt.hit ? 1 : 0) : null,
      stressSelfPred: (_om && typeof _om.hitRate === 'number') ? _om.hitRate : null,
      stressSamples: (_om && typeof _om.samples === 'number') ? _om.samples : 0
    };
    var _hit, _creditSource, _isReward, _creditTier;
    var _k4 = null;
    if (typeof window !== 'undefined' && window.LIMENK4 && typeof window.LIMENK4.credit === 'function') {
      try { _k4 = window.LIMENK4.credit(_sig); } catch (_k4e) { _k4 = null; }
    }
    if (_k4) {
      _hit = _k4.credit;                 // 0..1 | null (self-consistency calibration)
      _creditSource = _k4.creditSource;  // 'phase-consistency' | 'stress-consistency' | 'none'
      _isReward = !!_k4.isReward;        // ALWAYS false for Industry (externalOutcome is null)
      _creditTier = (typeof _k4.tier === 'number') ? _k4.tier : null;
    } else {
      // FALLBACK — central gate absent: preserve the prior self-consistency behavior + preemption order
      // (phase-consistency over stress-consistency). No throw. Still NEVER reward.
      var _phaseReward = _sig.phaseValidated && _sig.phaseTransitionHit != null;
      var _fromOutcome = !_phaseReward && _sig.stressSelfPred != null && _sig.stressSamples >= 5;
      _hit = _phaseReward ? _sig.phaseTransitionHit : (_fromOutcome ? _sig.stressSelfPred : null);
      _creditSource = _phaseReward ? 'phase-consistency' : (_fromOutcome ? 'stress-consistency' : 'none');
      _isReward = false;                 // self-consistency calibration (interpretive), never reward
      _creditTier = _phaseReward ? 3 : (_fromOutcome ? 1 : 0);
    }
    if (_hit !== null && _hit !== undefined) _lr = _imClamp(_lr * (1 + (1 - _hit)), IM_SLOW_RATE, 0.6);
    em._effectiveLearningRate = _lr;
    em._creditSource = _creditSource;
    em._creditIsReward = _isReward;      // exposed so the console can show reward vs calibration honestly
    em._creditTier = _creditTier;
    var nextPrior = this._updateIndustryPrior(priorIn, obs, _lr);  // -> next cycle reads this (effective LR)

    em.cycle += 1;
    em.observation = obs;
    em.predictionError = pe;
    em.predictedStress = predictedStress;
    em.regulation = reg;
    em.readyForHandoff = readyForHandoff;
    em.prior = nextPrior;
    em.updated = obs.timestamp;
    this.state.industryModel = em;

    // H1-H6 — higher Industry brain layers (computed BEFORE the DDP build so packets embed summaries).
    try { this._computeIndustryHigherLayers(); } catch (e) {}

    // ── K1-K8 NEURO-COMPLETION LOOPS (Energy-parity port). Runs in the SAME order Energy uses.
    // Deterministic; each stores its signal on state; K4/K8 close a loop read at the TOP of the NEXT
    // cycle's _updateIndustryModel (one-cycle lag). Never rewrites stress/diagnoses/data files. ──
    try { this._computeIndustryNeuroLayers(); } catch (e) {}

    // ── THING2 KERNEL PHASE SOURCE (deterministic, PURE MATH; runs BEFORE the phase router below).
    // Push this cycle's primary STRESS scalar to the rolling series, persist it, and ask the REAL
    // Thing2 recursive phase kernel for the interpretive phase. On success it becomes this._kernelPhase,
    // which _computeIndustryPhaseDynamics prefers over the naive state.phase; on any failure/short
    // history it stays null and the router falls back to state.phase (unchanged). No network / no AI. ──
    try { this._updateIndustryKernelPhase(); } catch (e) { this._kernelPhase = null; this.state.phaseSource = 'fallback'; }

    // ── ACTUATION LAYER (computed here so NEXT cycle's surfaceOpportunities / K4 hook read them;
    // one-cycle lag, recurrent by design). Each behind its _actuation flag; all deterministic. ──
    try { if (this._actuation && this._actuation.servo) this._computeIndustryServo(); } catch (e) {}   // REGULATE-TO-TARGET PI SERVO → emissionFactor
    try { this._computeIndustryRegulationAdvisories(); } catch (e) {}                                   // E/I balance + self-audit SPOF (observe-only)
    try { if (this._actuation && this._actuation.phase) this._computeIndustryPhaseDynamics(); } catch (e) {}   // phase-coherence router + phase-transition self-consistency calibration

    // Production-capacity sub-layer (additive; BEFORE the DDP build so the primary packet advertises it).
    try { this._buildProductionCapacityLayer(); } catch (e) {}

    // Generic cognition surface the console SELF-MODEL panel renders for ANY domain. MANDATORY.
    try {
      this.state.cognition = {
        domain: 'industry',
        model: { cycle: em.cycle, predictionError: em.predictionError, predictedStress: em.predictedStress, regulation: em.regulation, creditSource: em._creditSource || null, creditIsReward: !!em._creditIsReward, creditTier: (typeof em._creditTier === 'number' ? em._creditTier : null), effectiveLearningRate: em._effectiveLearningRate || null },
        awareness: this.state.industryAwareness || null,
        conscience: this.state.industryConscience || null,
        immune: this.state.industryImmune || null,
        intuition: this.state.industryIntuition || null,
        servo: this.state.industryServo || null,                        // actuated PI servo
        phaseDynamics: this.state.industryPhaseDynamics || null,        // actuated phase router + self-consistency calibration
        regulation2: this.state.industryRegulationAdvisories || null,   // E/I balance + SPOF self-audit (additive key; distinct from model.regulation)
        neuro: this.state.industryNeuro || null                         // K1-K8 neuro-completion roll-up (additive)
      };
    } catch (e) {}

    // Build the per-diagnosis DomainDiagnosisPackets (schema-only; never invents data).
    try {
      var _diags = this.state.diagnoses || [];
      var _primary = _diags.filter(function (d) { return d.active; })[0] || _diags[0] || null;
      var _self = this;
      this.state.industryDomainDiagnosisPacket = this._buildDomainDiagnosisPacket(_primary);
      this.state.industryDomainDiagnosisPackets = _diags.map(function (d) { return _self._buildDomainDiagnosisPacket(d); });
    } catch (e) {}

    // outcomeLog (parity with energy)
    try {
      var mem = this.state.memory;
      if (mem && mem.outcomeLog) {
        mem.outcomeLog.push({ cycle: em.cycle, predictionError: Math.round(pe.total * 1000) / 1000, stress: obs.stress, activeDx: obs.diagnosisCount, readyForHandoff: readyForHandoff, regulation: reg.state, timestamp: obs.timestamp });
        if (mem.outcomeLog.length > 50) mem.outcomeLog.shift();
      }
    } catch (e) {}

    return em;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // COMMAND-BOARD COMPANIES — real industrial entities (state.companies was starved).
  // Falls back to command-board-data filtered to d==='industry'. Guarded: any failure
  // leaves _cbIndustryCompanies as [] and behavior is unchanged.
  // ════════════════════════════════════════════════════════════════════════════
  IndustryBrain.prototype._loadCommandBoardCompanies = function () {
    var self = this;
    if (self._cbIndustryCompanies) return;            // one-shot
    self._cbIndustryCompanies = [];
    // Canonical real industrial tickers (used as a static fallback when command-board has none).
    self._industryTickers = [
      { name: 'Caterpillar', ticker: 'CAT' }, { name: 'Deere & Co', ticker: 'DE' },
      { name: 'General Electric', ticker: 'GE' }, { name: 'Honeywell', ticker: 'HON' },
      { name: '3M', ticker: 'MMM' }, { name: 'Emerson Electric', ticker: 'EMR' },
      { name: 'Illinois Tool Works', ticker: 'ITW' }, { name: 'Eaton', ticker: 'ETN' },
      { name: 'Parker Hannifin', ticker: 'PH' }, { name: 'Rockwell Automation', ticker: 'ROK' },
      { name: 'Dover', ticker: 'DOV' }, { name: 'GE Vernova', ticker: 'GEV' }
    ];
    try {
      fetch('/assets/data/command-board-data.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data) return;
          var arr = Array.isArray(data) ? data : (Object.keys(data).map(function (k) { return data[k]; }).find(Array.isArray) || []);
          self._cbIndustryCompanies = arr
            .filter(function (x) { return x && x.d === 'industry' && x.t; })
            .map(function (x) { return { name: x.n, ticker: x.t, cik: x.c, phase: x.p, trajectory: x.tr }; });
        })
        .catch(function () {});
    } catch (e) {}
  };

  // ════════════════════════════════════════════════════════════════════════════
  // F3 — canonical diagnosis resolution (alias map). Prefers the global
  // window.LIMENArtifactSourceIndex.aliases() when present, else this local map.
  // Never asserts a bundle exists; only resolves an ID for fetch.
  // ════════════════════════════════════════════════════════════════════════════
  var INDUSTRY_DIAGNOSIS_ALIASES = {
    SUPPLY_CHAIN_COLLAPSE: { target: 'SUPPLY_SHORTAGE_EVENT', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits SUPPLY_SHORTAGE_EVENT for material/sourcing collapse' },
    AUTOMATION_FAILURE:    { target: 'EQUIPMENT_FAILURE_CASCADE', reviewStatus: 'corpus-aliased', risk: 'low', note: 'automation failure mapped to equipment-failure-cascade bundle' },
    TOXIC_SPILL:           { target: 'HAZMAT_INCIDENT', reviewStatus: 'human-approved', risk: 'medium', note: 'toxic spill mapped to hazmat-incident bundle; verify environmental scope appropriateness' },
    QUALITY_CRISIS:        { target: 'PRODUCT_DEFECT_EVENT', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits PRODUCT_DEFECT_EVENT for defect/recall crisis' },
    WORKFORCE_SHORTAGE:    { target: 'LABOR_CONSTRAINT_EVENT', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits LABOR_CONSTRAINT_EVENT for labor scarcity' }
  };
  IndustryBrain.prototype._resolveCanonicalDiagnosis = function (dxId) {
    if (!dxId) return { canonicalDiagnosisId: null, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };
    var target = null;
    try {
      var idx = (typeof window !== 'undefined') ? window.LIMENArtifactSourceIndex : null;
      if (idx && typeof idx.aliases === 'function') { var row = idx.aliases()[dxId]; if (row && row.target) target = row.target; }
    } catch (e) {}
    var local = INDUSTRY_DIAGNOSIS_ALIASES[dxId] || null;
    if (!target && local) target = local.target;
    if (target) {
      return { canonicalDiagnosisId: target, aliasUsed: true, aliasReviewStatus: (local && local.reviewStatus) || 'corpus-aliased', aliasRisk: (local && local.risk) || 'low', aliasNote: (local && local.note) || null };
    }
    return { canonicalDiagnosisId: dxId, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };  // canonical to self
  };

  // G1 — load REAL source bundles (one-shot, async). Only files that exist resolve to 'found'.
  IndustryBrain.prototype._loadIndustryDiagnosisBundles = function () {
    var self = this;
    if (self._bundleLoadPromise) return self._bundleLoadPromise;
    self._bundleCache = self._bundleCache || {};
    self._bundleStatusMap = self._bundleStatusMap || {};
    var ids = {};
    var known = ['SUPPLY_CHAIN_COLLAPSE', 'AUTOMATION_FAILURE', 'TOXIC_SPILL', 'QUALITY_CRISIS', 'WORKFORCE_SHORTAGE'];
    var diags = (self.state && self.state.diagnoses) || [];
    var allDxIds = diags.map(function (d) { return d.id; }).concat(known);
    for (var i = 0; i < allDxIds.length; i++) { var c = self._resolveCanonicalDiagnosis(allDxIds[i]).canonicalDiagnosisId; if (c) ids[c] = true; }
    self._bundleLoadPromise = Promise.all(Object.keys(ids).map(function (cid) {
      return fetch('/assets/data/artifact-source-index/by-diagnosis/' + encodeURIComponent(cid) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) { self._bundleStatusMap[cid] = data ? 'found' : 'missing'; if (data) self._bundleCache[cid] = data; })
        .catch(function () { self._bundleStatusMap[cid] = 'missing'; });
    })).then(function () { return self._bundleCache; });
    return self._bundleLoadPromise;
  };

  // J1 — REAL L1 PORTAL DEPTH. L1 treatments are mad-lib templates (fixed-verb family),
  // NOT admitted as evidence; only real company tickers are surfaced (relevance-unverified).
  var IM_MADLIB_VERB = /^(Develop|Establish|Implement|Build|Launch|Design|Deploy|Operationalize|Conduct|Create|Define|Assess|Optimize|Modernize|Strengthen|Enhance|Formalize|Institute|Standardize|Coordinate|Integrate|Calibrate|Evaluate|Streamline|Institutionalize|Configure|Monitor)\b/;
  IndustryBrain.prototype._isMadLibTreatment = function (label) { return !label || IM_MADLIB_VERB.test(String(label)); };

  IndustryBrain.prototype._loadIndustryL1PortalDepth = function () {
    var self = this;
    if (self._l1LoadPromise) return self._l1LoadPromise;
    var BRANCH = {
      SUPPLY_CHAIN_COLLAPSE: ['supply', 'supply_procurement', 'supply_inventory'],
      AUTOMATION_FAILURE: ['automation', 'automation_robassembl', 'automation_processaut'],
      TOXIC_SPILL: ['safety', 'safety_hazard', 'safety_chemsafety'],
      QUALITY_CRISIS: ['design', 'design_dfm', 'assembly_assemblytesting'],
      WORKFORCE_SHORTAGE: ['assembly', 'assembly_ergonomics', 'assembly_lean']
    };
    self._l1Branches = BRANCH;
    var branches = {}; Object.keys(BRANCH).forEach(function (dx) { BRANCH[dx].forEach(function (b) { branches[b] = true; }); });
    var byBranch = {};
    self._l1LoadPromise = Promise.all(Object.keys(branches).map(function (b) {
      return fetch('/assets/data/domains/industry_' + encodeURIComponent(b) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) {
          if (!data) { byBranch[b] = null; return; }
          var acts = data.activations || [], tickers = {}, total = 0, mad = 0;
          acts.forEach(function (a) {
            (a.companies || []).forEach(function (c) { if (c && c.ticker_or_id) tickers[c.ticker_or_id] = c.name || c.ticker_or_id; });
            (a.treatments || []).forEach(function (t) { var l = t && (t.label || t.title); if (l) { total++; if (self._isMadLibTreatment(l)) mad++; } });
          });
          byBranch[b] = { file: 'industry_' + b, companyTickers: Object.keys(tickers).map(function (k) { return { ticker: k, name: tickers[k] }; }), treatmentTotal: total, madLibCount: mad, realTreatmentCount: total - mad };
        })
        .catch(function () { byBranch[b] = null; });
    })).then(function () {
      var byDiagnosis = {};
      Object.keys(BRANCH).forEach(function (dx) {
        var tk = {}, total = 0, mad = 0, scanned = 0;
        BRANCH[dx].forEach(function (b) { var r = byBranch[b]; if (r) { scanned++; r.companyTickers.forEach(function (c) { tk[c.ticker] = c.name; }); total += r.treatmentTotal; mad += r.madLibCount; } });
        byDiagnosis[dx] = { branchesScanned: scanned, realCompanyTickers: Object.keys(tk).map(function (k) { return { ticker: k, name: tk[k], relevanceUnverified: true }; }), treatmentTotal: total, madLibTreatments: mad, realTreatments: total - mad, admitted: false, reason: 'L1 treatments are mad-lib templates (fixed-verb family) — not source-grade; only company tickers surfaced, relevance unverified' };
      });
      self.state._l1DepthCache = { byBranch: byBranch, byDiagnosis: byDiagnosis, scannedAt: (self.state.industryModel && self.state.industryModel.updated) || null };
      return self.state._l1DepthCache;
    });
    return self._l1LoadPromise;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PRODUCTION-CAPACITY SUB-LAYER (additive; mirrors energy DC / trade freight-flow).
  // Hand-authored, real-content diagnoses + treatments (NOT mad-lib) + INVESTABLE-only
  // opportunities. NEVER merged into the validated 5-diagnosis spine (state.diagnoses
  // stays 5). No external source bundle yet → bundleStatus 'missing' (honest).
  // ════════════════════════════════════════════════════════════════════════════
  IndustryBrain.prototype._loadProductionCapacityLayer = function () {
    var self = this;
    if (self._pcLoadPromise) return self._pcLoadPromise;
    // Try a real data file; on absence use the hand-authored fallback (no fabrication of evidence).
    self._pcLoadPromise = fetch('/assets/data/domains/industry_capacity_flows.json')
      .then(function (r) { return (r && r.ok) ? r.json() : null; })
      .then(function (data) {
        if (data && data.issues) { self._pcPortal = { issues: data.issues, activations: data.activations || [], title: data.title || 'Production Capacity', sourceMode: 'file' }; return self._pcPortal; }
        self._pcPortal = self._handAuthoredProductionCapacity(); return self._pcPortal;
      })
      .catch(function () { self._pcPortal = self._handAuthoredProductionCapacity(); return self._pcPortal; });
    return self._pcLoadPromise;
  };

  IndustryBrain.prototype._handAuthoredProductionCapacity = function () {
    return {
      title: 'Production Capacity & Industrial Output',
      sourceMode: 'hand-authored',
      issues: [
        { id: 'FACTORY_CAPACITY_PINCH', label: 'Factory Capacity Pinch', summary: 'Utilization constrained by maintenance backlog and labor shortage; output below capacity trend.', circuits: [{ nodeId: 'pc_capacity' }] },
        { id: 'AUTOMATION_INVESTMENT_OPPORTUNITY', label: 'Automation Investment Window', summary: 'Robotics / IIoT capex window when labor scarcity and rates favor automation deployment.', circuits: [{ nodeId: 'pc_automation' }] },
        { id: 'EQUIPMENT_LIFECYCLE_RISK', label: 'Equipment Lifecycle Risk', summary: 'Aging industrial asset base entering replacement cycles (e.g., earth-moving / power-gen fleets).', circuits: [{ nodeId: 'pc_lifecycle' }] },
        { id: 'PRODUCTION_THROUGHPUT_BOTTLENECK', label: 'Production Throughput Bottleneck', summary: 'Supply / labor / automation grid-lock constraining line throughput.', circuits: [{ nodeId: 'pc_throughput' }] },
        { id: 'PREDICTIVE_MAINTENANCE_EDGE', label: 'Predictive Maintenance Edge', summary: 'Sensor-based predictive maintenance reduces unplanned downtime and maintenance cost.', circuits: [{ nodeId: 'pc_maint' }] }
      ],
      activations: [
        { brainNodeId: 'pc_capacity', companies: [{ ticker_or_id: 'CAT', name: 'Caterpillar' }, { ticker_or_id: 'DE', name: 'Deere & Co' }, { ticker_or_id: 'ITW', name: 'Illinois Tool Works' }],
          treatments: [{ label: 'Stage utilization-trend monitoring against BLS capacity-utilization series', type: 'monitoring', evidence: 'B', description: 'BLS G.17 industrial capacity utilization reports.', steps: ['Pull BLS capacity-utilization series', 'Flag <78% sustained as pinch'], cite: 'BLS G.17' }] },
        { brainNodeId: 'pc_automation', companies: [{ ticker_or_id: 'ROK', name: 'Rockwell Automation' }, { ticker_or_id: 'HON', name: 'Honeywell' }, { ticker_or_id: 'EMR', name: 'Emerson Electric' }],
          treatments: [{ label: 'Track automation-vendor order books vs labor-cost indices', type: 'position', evidence: 'B', description: 'ROK/HON/EMR order growth tied to labor scarcity.', steps: ['Track vendor order-book growth', 'Cross against wage-rate indices'], cite: 'Vendor 10-Q order data' }] },
        { brainNodeId: 'pc_lifecycle', companies: [{ ticker_or_id: 'CAT', name: 'Caterpillar' }, { ticker_or_id: 'GEV', name: 'GE Vernova' }, { ticker_or_id: 'DOV', name: 'Dover' }],
          treatments: [{ label: 'Map fleet-age replacement cycles to equipment-maker revenue', type: 'position', evidence: 'C', description: 'Aging asset base drives replacement demand.', steps: ['Estimate installed-base age', 'Model replacement-cycle revenue'], cite: 'Industry CAPEX surveys' }] },
        { brainNodeId: 'pc_throughput', companies: [{ ticker_or_id: 'ETN', name: 'Eaton' }, { ticker_or_id: 'PH', name: 'Parker Hannifin' }, { ticker_or_id: 'ITW', name: 'Illinois Tool Works' }],
          treatments: [{ label: 'Diagnose line bottleneck (supply vs labor vs automation) before capacity bet', type: 'analyze', evidence: 'B', description: 'Identify the binding constraint per line.', steps: ['Decompose throughput loss', 'Target the binding constraint'], cite: 'Plant throughput audit' }] },
        { brainNodeId: 'pc_maint', companies: [{ ticker_or_id: 'ROK', name: 'Rockwell Automation' }, { ticker_or_id: 'EMR', name: 'Emerson Electric' }, { ticker_or_id: 'HON', name: 'Honeywell' }],
          treatments: [{ label: 'Quantify downtime-cost reduction from sensor-based predictive maintenance', type: 'research', evidence: 'B', description: 'Predictive maintenance lowers unplanned downtime.', steps: ['Baseline unplanned downtime', 'Model sensor-driven reduction'], cite: 'Automation vendor case studies' }] }
      ]
    };
  };

  IndustryBrain.prototype._buildProductionCapacityLayer = function () {
    var self = this;
    var pc = self._pcPortal;
    if (!pc || !pc.issues || !pc.issues.length) {
      self.state.productionCapacityLayer = { loaded: false, count: 0, activeCount: 0, diagnoses: [], note: 'production-capacity sub-portal not loaded (offline or fetch failed)' };
      self.state.productionCapacityDiagnoses = [];
      self.state.productionCapacityTreatments = [];
      self.state.productionCapacityDomainDiagnosisPackets = [];
      return self.state.productionCapacityLayer;
    }
    var conditions = self._activeConditions || [];
    var diagnoses = pc.issues.map(function (iss) {
      var triggers = (self.diagnosisIndex && self.diagnosisIndex[iss.id]) || [];
      var matchCount = 0;
      for (var t = 0; t < triggers.length; t++) {
        for (var c = 0; c < conditions.length; c++) {
          if (conditions[c] === triggers[t] || String(conditions[c]).indexOf(triggers[t]) !== -1) matchCount++;
        }
      }
      return { id: iss.id, label: iss.label, summary: iss.summary || '', active: matchCount > 0, relevance: triggers.length ? Math.round((matchCount / triggers.length) * 100) / 100 : 0, circuits: iss.circuits || [], source: 'production-capacity', tier: 'real-content-unbundled', branch: 'production-capacity' };
    });
    var nodeToDx = {};
    diagnoses.forEach(function (d) { (d.circuits || []).forEach(function (c) { if (c && c.nodeId) nodeToDx[c.nodeId] = d.id; }); });
    var treatments = [];
    (pc.activations || []).forEach(function (act) {
      var dxId = nodeToDx[act.brainNodeId]; if (!dxId) return;
      (act.treatments || []).forEach(function (t, ti) {
        treatments.push({ id: 'pc_treat_' + act.brainNodeId + '_' + ti, label: t.label, type: t.type, evidence: t.evidence, description: t.description || '', cite: t.cite || null, steps: t.steps || [], diagnosisId: dxId, nodeId: act.brainNodeId, source: 'production-capacity', madLib: self._isMadLibTreatment ? self._isMadLibTreatment(t.label) : false });
      });
    });
    var evidenceRank = { A: 10, Strong: 10, B: 7, Moderate: 7, C: 4, Emerging: 1 };
    treatments.sort(function (a, b) { return (evidenceRank[b.evidence] || 0) - (evidenceRank[a.evidence] || 0); });
    self.state.productionCapacityDiagnoses = diagnoses;
    self.state.productionCapacityTreatments = treatments;
    self.state.productionCapacityLayer = {
      loaded: true, portalTitle: pc.title, sourceMode: pc.sourceMode || 'hand-authored',
      count: diagnoses.length, activeCount: diagnoses.filter(function (d) { return d.active; }).length,
      diagnoses: diagnoses.map(function (d) {
        var rc = self._resolveCanonicalDiagnosis ? self._resolveCanonicalDiagnosis(d.id) : { canonicalDiagnosisId: d.id };
        var bs = (self._bundleStatusMap && self._bundleStatusMap[rc.canonicalDiagnosisId]) || 'missing';
        return { id: d.id, label: d.label, active: d.active, branch: 'production-capacity', canonicalDiagnosisId: rc.canonicalDiagnosisId, bundleStatus: bs, treatmentCount: treatments.filter(function (t) { return t.diagnosisId === d.id; }).length };
      }),
      note: 'real-content (hand-authored) production-capacity diagnoses; SEPARATE from the validated 5-diagnosis spine; no external source bundle yet (build-required); never admitted to evidenceAnchors; opportunities INVESTABLE-only'
    };
    self.state.productionCapacityDomainDiagnosisPackets = diagnoses.map(function (d) {
      try { return self._buildDomainDiagnosisPacket(d); } catch (e) { return null; }
    }).filter(Boolean);
    return self.state.productionCapacityLayer;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // H1-H6 — HIGHER INDUSTRY BRAIN LAYERS (industry-local, additive, domain-level).
  // ════════════════════════════════════════════════════════════════════════════
  IndustryBrain.prototype._industryBundleStates = function () {
    var self = this; var diags = this.state.diagnoses || [];
    return diags.map(function (d) {
      var c = self._resolveCanonicalDiagnosis(d.id);
      var bundle = (self._bundleCache && self._bundleCache[c.canonicalDiagnosisId]) || null;
      var known = !!(self._bundleStatusMap && Object.prototype.hasOwnProperty.call(self._bundleStatusMap, c.canonicalDiagnosisId));
      return { dxId: d.id, active: !!d.active, relevance: (typeof d.relevance === 'number' ? d.relevance : 0),
        canonical: c.canonicalDiagnosisId, aliasUsed: c.aliasUsed, aliasRisk: c.aliasRisk, aliasReviewStatus: c.aliasReviewStatus,
        bundleStatus: bundle ? 'found' : (known ? 'missing' : 'unknown'),
        buildMethod: (bundle && bundle.buildMethod) || null, humanVerification: (bundle && bundle.humanVerification) || null,
        shallow: !!(bundle && ((bundle.maxDepth || 0) === 0 || (bundle.portalCount || 0) <= 1)) };
    });
  };

  // H1 — formal immune system
  IndustryBrain.prototype._computeIndustryImmune = function () {
    var s = this.state, em = s.industryModel || {}, reg = em.regulation || {}, bs = this._industryBundleStates();
    var ant = [{ type: 'synthetic-portal-contamination', severity: 'medium', action: 'quarantine', note: 'L2 portal cortex ~synthetic' }];
    bs.forEach(function (b) {
      if (b.bundleStatus === 'missing') ant.push({ type: 'source-bundle-missing', dx: b.dxId, severity: 'medium', action: 'block-from-prompt-evidence' });
      if (b.buildMethod === 'external-source-authored') ant.push({ type: 'external-source-authored-needs-human-verification', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
      if (b.aliasRisk === 'medium' || b.aliasRisk === 'high') ant.push({ type: 'alias-risk-bundle', dx: b.dxId, severity: b.aliasRisk, action: 'allow-with-warning' });
      if (b.bundleStatus === 'found' && b.shallow) ant.push({ type: 'root-only-shallow-bundle', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
    });
    var pe = (em.predictionError && em.predictionError.total) || 0;
    if (pe > 0.4) ant.push({ type: 'prediction-error-spike', severity: 'medium', action: 'lower-confidence', value: Math.round(pe * 1000) / 1000 });
    if (reg.stale) ant.push({ type: 'stale-feeds', severity: 'low', action: 'flag' });
    if (reg.flooding) ant.push({ type: 'signal-flood', severity: 'medium', action: 'inhibit' });
    if (reg.starving) ant.push({ type: 'insufficient-feed-diversity', severity: 'low', action: 'flag' });
    if (reg.surprised) ant.push({ type: 'novel-production-shock', severity: 'medium', action: 'flag', note: 'unexpected regime shift (e.g., QUALITY_CRISIS active where SUPPLY_CHAIN_COLLAPSE predicted)' });
    var _l1 = s._l1DepthCache;
    if (_l1 && _l1.byDiagnosis && Object.keys(_l1.byDiagnosis).some(function (dx) { return _l1.byDiagnosis[dx].madLibTreatments > 0; })) {
      ant.push({ type: 'l1-synthetic-treatments', severity: 'medium', action: 'quarantine', note: 'L1 portal treatments are mad-lib templates; quarantined from evidence — only real tickers surfaced relevance-unverified' });
    }
    var sev = ant.some(function (a) { return a.severity === 'high'; }) ? 'high' : ant.some(function (a) { return a.severity === 'medium'; }) ? 'medium' : ant.length ? 'low' : 'none';
    var im = {
      version: 1, immuneState: sev === 'high' ? 'alert' : sev === 'medium' ? 'active' : sev === 'low' ? 'watch' : 'clear', severity: sev,
      antigens: ant.slice(0, 12),
      quarantines: ['L2-synthetic-portal-content', 'L1-portal-treatments-madlib'],
      allowedWithWarning: ant.filter(function (a) { return a.action === 'allow-with-warning'; }).map(function (a) { return a.type + (a.dx ? (':' + a.dx) : ''); }),
      blockedFromPrompt: ant.filter(function (a) { return a.action === 'block-from-prompt-evidence'; }).map(function (a) { return a.dx; }),
      blockedFromTraversal: ['L2'],
      immuneMemory: (((s.industryImmune && s.industryImmune.immuneMemory) || 0) + 1),
      lastScanAt: em.updated || null
    };
    s.industryImmune = im; return im;
  };

  // H2 — awareness / metacognition
  IndustryBrain.prototype._computeIndustryAwareness = function () {
    var s = this.state, em = s.industryModel || {}, im = s.industryImmune || {}, bs = this._industryBundleStates();
    var covered = bs.filter(function (b) { return b.bundleStatus === 'found'; });
    var missing = bs.filter(function (b) { return b.bundleStatus === 'missing'; });
    var hv = bs.filter(function (b) { return b.humanVerification === 'required'; });
    var active = (s.diagnoses || []).filter(function (d) { return d.active; });
    var prev = s.industryAwareness || {};
    var pe = (em.predictionError && em.predictionError.total) || 0;
    var aw = {
      version: 1,
      selfState: im.immuneState === 'alert' ? 'guarded' : (em.regulation && em.regulation.state) || 'unknown',
      knowns: covered.map(function (b) { return b.dxId + ' (source-backed)'; }).concat(['PMI / capacity-utilization / Fed Reg (OSHA·MSHA·BIS·DOL) / recall feeds', active.length + ' active diagnoses']),
      unknowns: missing.map(function (b) { return b.dxId + ' (no source bundle)'; }).concat(['supplier inventory depth', 'planned automation capex', 'competitor capacity moves', 'BOM tariff exposure', 'workforce attrition rate']),
      uncertainties: ['L1 portal treatments are mad-lib templates (NOT real depth); L2 synthetic + blocked', 'real industrial tickers exist in L1 but node-bindings are templated (relevance-unverified)', 'predictionError=' + (Math.round(pe * 1000) / 1000)],
      suppressions: (im.quarantines || []).concat(['L2-traversal', 'L1-portal-treatments']),
      confidenceDrivers: ['source coverage ' + covered.length + '/' + bs.length, 'regulation ' + ((em.regulation && em.regulation.state) || '?')],
      changedSinceLastCycle: { predictionErrorDelta: Math.round((pe - (typeof prev._pe === 'number' ? prev._pe : pe)) * 1000) / 1000, coverageNow: covered.length },
      humanReviewRequired: hv.map(function (b) { return b.dxId; }),
      selfNarrative: 'Industry: ' + covered.length + '/' + bs.length + ' source-backed, ' + active.length + ' active dx, immune=' + (im.immuneState || '?') + '; manufacturing posture from PMI/capacity/labor/quality feeds; portal-below-L1 quarantined, ' + hv.length + ' need human verification.',
      lastAwarenessAt: em.updated || null, _pe: pe
    };
    s.industryAwareness = aw; return aw;
  };

  // H3 — conscience / veto (overclaim + source-sufficiency; patent/grant/SBA purged)
  IndustryBrain.prototype._computeIndustryConscience = function () {
    var s = this.state, em = s.industryModel || {}, im = s.industryImmune || {}, bs = this._industryBundleStates();
    var pe = (em.predictionError && em.predictionError.total) || 0;
    var vetoes = [], cautions = [], allowed = [], blocked = ['patent-claim', 'grant-claim', 'sba-claim'];
    vetoes.push({ claim: 'patent/grant/SBA', reason: 'lanes purged 2026-06-21; no industrial method/embodiment/figure candidate admitted without verified source; only INVESTABLE/RESEARCHABLE allowed' });
    bs.forEach(function (b) {
      if (b.bundleStatus === 'missing') { blocked.push('strong-claim:' + b.dxId); vetoes.push({ claim: 'strong-claim:' + b.dxId, reason: 'no source bundle' }); }
      else if (b.buildMethod === 'external-source-authored') { cautions.push({ claim: 'strong-claim:' + b.dxId, reason: 'external-source-authored; human-verification-required' }); allowed.push('source-routing:' + b.dxId); }
      else if (b.aliasRisk === 'medium' || b.aliasRisk === 'high') { cautions.push({ claim: 'precise-technical-claim:' + b.dxId, reason: 'aliasRisk ' + b.aliasRisk + '; include alias warning' }); allowed.push('source-summary:' + b.dxId); }
      else if (b.bundleStatus === 'found') { allowed.push('source-summary:' + b.dxId); }
    });
    if (pe > 0.4) cautions.push({ claim: 'high-confidence-claim', reason: 'predictionError spike ' + (Math.round(pe * 1000) / 1000) });
    if (typeof s.stress === 'number' && s.stress > 0.70) {
      var topRel = (s.diagnoses || []).filter(function (d) { return d.active; }).reduce(function (m, d) { return Math.max(m, d.relevance || 0); }, 0);
      if (topRel < 0.4) cautions.push({ claim: 'high-stress-low-relevance', reason: 'stress>0.70 but strongest active diagnosis relevance<0.4 — low confidence' });
    }
    if (im.immuneState === 'alert') cautions.push({ claim: 'artifact-generation', reason: 'immune alert — hold artifact lanes' });
    var hasFound = bs.some(function (b) { return b.bundleStatus === 'found'; });
    var con = {
      version: 1, conscienceState: vetoes.length ? 'restrictive' : 'permissive',
      vetoes: vetoes.slice(0, 10), cautions: cautions.slice(0, 10),
      allowedClaims: ['source-summary'].concat(hasFound ? ['investment-memo-with-warnings'] : []).concat(allowed.slice(0, 6)),
      blockedClaims: blocked.slice(0, 10),
      artifactReadinessDecision: { patentReady: false, grantReady: false, sbaReady: false, investmentReady: hasFound, researchReady: hasFound, note: 'patent/grant/SBA vetoed (lanes purged + no candidate fields); INVESTABLE/RESEARCHABLE allowed-with-warning only for source-backed diagnoses' },
      reasons: ['overclaim prevention', 'source sufficiency', 'human-verification preservation'],
      lastCheckAt: em.updated || null
    };
    s.industryConscience = con; return con;
  };

  // H4 — intuition / weak-signal (NOT evidence; labelled unverified)
  IndustryBrain.prototype._computeIndustryIntuition = function () {
    var s = this.state, em = s.industryModel || {}, reg = em.regulation || {};
    var log = (s.memory && s.memory.outcomeLog) || [];
    var hunches = [];
    if (log.length >= 2) {
      var a = log[log.length - 2].predictionError, b = log[log.length - 1].predictionError;
      if (typeof a === 'number' && typeof b === 'number' && b - a > 0.05) hunches.push({ hunch: 'production cliff forming (prediction error rising; PMI/labor trending)', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'predictionError rose ' + a + '->' + b, verifyIf: 'error keeps rising 2+ cycles', falsifyIf: 'PMI reverses / error returns to baseline' });
    }
    if (reg.state === 'surprised') hunches.push({ hunch: 'novel production shock entering the system (quality regime shift or supply cascade)', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'regulation=surprised (high novelty + diagnosis mismatch)', verifyIf: 'a specific diagnosis activates with source support', falsifyIf: 'novelty subsides next cycle' });
    var missing = this._industryBundleStates().filter(function (x) { return x.bundleStatus === 'missing' && x.active; });
    if (missing.length) hunches.push({ hunch: 'recurring uncovered diagnosis: ' + missing[0].dxId, label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'active diagnosis with no source bundle', verifyIf: 'a real source bundle is built', falsifyIf: 'diagnosis deactivates' });

    var patternMatches = [];
    var recent = log.slice(-10), regCount = {};
    recent.forEach(function (e) { if (e.regulation) regCount[e.regulation] = (regCount[e.regulation] || 0) + 1; });
    Object.keys(regCount).forEach(function (k) { if (regCount[k] >= 3) patternMatches.push({ pattern: 'recurring regulation state: ' + k, occurrences: regCount[k], window: recent.length, label: 'PATTERN', evidenceStatus: 'UNVERIFIED' }); });

    var FAMILY = { 'output-bottleneck': ['SUPPLY_CHAIN_COLLAPSE', 'WORKFORCE_SHORTAGE', 'PRODUCTION_THROUGHPUT_BOTTLENECK'], 'reliability': ['AUTOMATION_FAILURE', 'EQUIPMENT_LIFECYCLE_RISK'], 'safety-incident': ['TOXIC_SPILL'], 'quality': ['QUALITY_CRISIS'], 'capacity': ['FACTORY_CAPACITY_PINCH', 'AUTOMATION_INVESTMENT_OPPORTUNITY'] };
    var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var primaryId = (active[0] || (s.diagnoses || [])[0] || {}).id;
    var analogies = [];
    Object.keys(FAMILY).forEach(function (fam) { if (FAMILY[fam].indexOf(primaryId) >= 0) { FAMILY[fam].forEach(function (sib) { if (sib !== primaryId) analogies.push({ analogy: primaryId + ' resembles ' + sib, family: fam, label: 'ANALOGY', evidenceStatus: 'UNVERIFIED', note: 'shared structural failure-family — a lens for monitoring, not a claim' }); }); } });

    var hm = this._hunchMemory = this._hunchMemory || {};
    var curKeys = {}; hunches.forEach(function (h) { curKeys[h.hunch] = true; hm[h.hunch] = (hm[h.hunch] || 0) + 1; });
    var promotedToMonitoring = [], rejectedHunches = [];
    Object.keys(hm).forEach(function (k) {
      if (!curKeys[k]) { rejectedHunches.push({ hunch: k, reason: 'signal subsided across cycles (falsifier path)' }); delete hm[k]; return; }
      if (hm[k] >= 3) promotedToMonitoring.push({ target: k, basis: 'recurred ' + hm[k] + ' cycles', note: 'monitoring target ONLY — never evidence or diagnosis' });
    });

    var it = {
      version: 1, hunches: hunches.slice(0, 3), weakSignals: hunches.map(function (h) { return h.why; }),
      patternMatches: patternMatches.slice(0, 5), analogies: analogies.slice(0, 4), confidence: 'LOW', evidenceStatus: 'UNVERIFIED',
      promotedToDiagnosis: [], promotedToMonitoring: promotedToMonitoring.slice(0, 4), rejectedHunches: rejectedHunches.slice(0, 4), lastIntuitionAt: em.updated || null
    };
    s.industryIntuition = it; return it;
  };

  // H5 — simulation / bounded counterfactual (hypothetical only)
  IndustryBrain.prototype._computeIndustrySimulation = function () {
    var s = this.state, em = s.industryModel || {};
    var base = typeof s.stress === 'number' ? s.stress : 0;
    function cl(v) { return Math.max(0, Math.min(1, Math.round(v * 1000) / 1000)); }
    var scenarios = [
      { type: 'worsen', hypothetical: true, assumption: 'PMI contraction accelerates, labor shortage intensifies', simulatedStress: cl(base + 0.25), risk: 'cascading production halt', intervention: 'monitor capacity-utilization trend, track labor indices', falsifier: 'PMI reverses 2+ points' },
      { type: 'stabilize', hypothetical: true, assumption: 'stressor holds', simulatedStress: cl(base), risk: 'persistent elevated baseline', intervention: 'maintain monitoring cadence', falsifier: 'stress moves materially' },
      { type: 'recover', hypothetical: true, assumption: 'stressor reverses', simulatedStress: cl(base - 0.2), risk: 'premature de-escalation', intervention: 'confirm with 2 independent sources before standing down', falsifier: 'stress re-rises' },
      { type: 'supply-shock', hypothetical: true, assumption: 'input scarcity deepens', simulatedStress: cl(base + 0.3), risk: 'cost pass-through failure', intervention: 'track BLS PPI, supplier announcements', falsifier: 'inventory builds' },
      { type: 'quality-cliff', hypothetical: true, assumption: 'recall authority action widens', simulatedStress: cl(base + 0.2), risk: 'reputational / margin collapse', intervention: 'NHTSA / CPSC recall tracking', falsifier: 'recall velocity slows' },
      { type: 'labor-exit', hypothetical: true, assumption: 'unionization / strikes spread', simulatedStress: cl(base + 0.25), risk: 'wage-inflation transmission', intervention: 'UAW/USW tracker, wage-rate indices', falsifier: 'labor markets cool' }
    ];
    var sim = {
      version: 1, scenarios: scenarios, assumptions: scenarios.map(function (x) { return x.assumption; }),
      simulatedStress: scenarios.map(function (x) { return x.simulatedStress; }),
      simulatedDiagnoses: ['SUPPLY_CHAIN_COLLAPSE', 'QUALITY_CRISIS', 'WORKFORCE_SHORTAGE'], simulatedOpportunities: [],
      risks: scenarios.map(function (x) { return x.risk; }), interventions: scenarios.map(function (x) { return x.intervention; }),
      falsifiers: scenarios.map(function (x) { return x.falsifier; }), lastSimulatedAt: em.updated || null
    };
    s.industrySimulation = sim; return sim;
  };

  // H6 — executive self-report (compact status card)
  IndustryBrain.prototype._computeIndustryExecutiveReport = function () {
    var s = this.state, em = s.industryModel || {}, im = s.industryImmune || {}, aw = s.industryAwareness || {}, con = s.industryConscience || {}, it = s.industryIntuition || {}, sim = s.industrySimulation || {}, bs = this._industryBundleStates();
    var covered = bs.filter(function (b) { return b.bundleStatus === 'found'; }).length;
    var hv = bs.filter(function (b) { return b.humanVerification === 'required'; }).length;
    var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var strongest = active[0] || (s.diagnoses || [])[0] || null;
    var pe = (em.predictionError && em.predictionError.total) || 0;
    var status = im.immuneState === 'alert' ? 'immune-alert' : hv > 0 ? 'human-review-required' : covered < bs.length ? 'source-limited' : (em.regulation && em.regulation.starving) ? 'starving' : (em.regulation && em.regulation.state === 'surprised') ? 'surprised' : 'healthy';
    var rep = {
      version: 1, brainStatus: status,
      strongestDiagnosis: strongest ? strongest.id : null,
      strongestOpportunity: (s.opportunities && s.opportunities[0] && s.opportunities[0].title) || null,
      confidence: Math.round((1 - pe) * 100) / 100, predictionError: Math.round(pe * 1000) / 1000,
      regulationState: (em.regulation && em.regulation.state) || null, immuneState: im.immuneState || null,
      awarenessSummary: aw.selfNarrative || null, conscienceDecision: con.conscienceState || null,
      intuitionSummary: (it.hunches || []).length + ' hunch(es)', simulationSummary: (sim.scenarios || []).length + ' scenario(s)',
      artifactReadiness: con.artifactReadinessDecision || null, blockers: (con.blockedClaims || []).slice(0, 6),
      nextBestAction: covered < bs.length ? 'build source bundles for active diagnoses' : hv > 0 ? 'human-verify external-source bundles' : (em.regulation && em.regulation.starving) ? 'extend / validate feed freshness' : 'monitor strongest diagnosis sources',
      lastReportAt: em.updated || null
    };
    s.industryExecutiveReport = rep; return rep;
  };

  IndustryBrain.prototype._computeIndustryHigherLayers = function () {
    this._computeIndustryImmune();
    this._computeIndustryAwareness();
    this._computeIndustryConscience();
    this._computeIndustryIntuition();
    this._computeIndustrySimulation();
    this._computeIndustryExecutiveReport();
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE K — INDUSTRY NEURO-COMPLETION LAYERS (industry-local, additive, reversible).
  // Direct parity port of Energy's K1-K8. Each layer COMPUTES and EXPOSES its signal on
  // state; the two that CLOSE a loop (K4 self-consistency truth-brake → effective learning
  // rate; K8 adaptive set-point → handoff floor) are consumed at the TOP of _updateIndustryModel
  // with a one-cycle lag, only in the branch the validated-phase credit source leaves untouched.
  // Reads cached state only; adds NO network calls, NO paid-AI. Never fabricates evidence.
  // ════════════════════════════════════════════════════════════════════════════

  // K1 — afferent inter-brain integration. Surfaces received cross-domain pressure and the stress
  // delta it contributes. Industry (like every non-energy domain) already folds getExternalPressure()
  // into stress via the base scoreStress; this is the read-out of that closed loop.
  IndustryBrain.prototype._computeIndustryAfferent = function () {
    var s = this.state, em = s.industryModel || {};
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
      externalPressure: Math.round(pressure * 1000) / 1000,
      receivedSignalCount: raw.length,
      activeSignalCount: active,
      contributors: contributors.slice(0, 6),
      integrated: true,
      appliedStressDelta: Math.round(((s._externalPressureApplied) || 0) * 1000) / 1000,
      wouldRaiseStressBy: Math.round(pressure * 1000) / 1000,
      note: 'CLOSED: the base scoreStress folds externalPressure into stress each cycle (same as the other domains); normalizeSignals also lifts it into critical_part_delay/supplier_constraint conditions.',
      lastAfferentAt: em.updated || now
    };
    s.industryAfferent = af; return af;
  };

  // K2 — neuromodulatory gain application. reg.gain/inhibition/outputScale are computed by
  // _computeIndustryRegulation; gain reaches predictedStress via the gainBlend. This shows the graded
  // output modulation (outputScale is advisory here — emission dampening is done by the PI servo + E/I
  // brake in _applyIndustryActuationGate, not by an outputScale opportunity cap).
  IndustryBrain.prototype._computeIndustryGainControl = function () {
    var s = this.state, em = s.industryModel || {}, reg = em.regulation || {};
    var opps = s.opportunities || [];
    var outputScale = (typeof reg.outputScale === 'number') ? reg.outputScale : 1;
    var wouldCapAt = Math.max(1, Math.round(opps.length * outputScale));
    var gc = {
      version: 1,
      gain: (typeof reg.gain === 'number') ? reg.gain : null,
      inhibition: (typeof reg.inhibition === 'number') ? reg.inhibition : null,
      outputScale: outputScale,
      currentOpportunityCount: opps.length,
      wouldCapOpportunitiesAt: wouldCapAt,
      wouldSuppress: Math.max(0, opps.length - wouldCapAt),
      appliedTargets: ['predictedStress (gain-blend)'],
      unappliedTargets: ['opportunity output cap (handled instead by PI servo + E/I brake)', 'stress', 'treatment surfacing'],
      lastGatedCount: (s._industryGatedCount || 0),
      note: 'gain reaches predictedStress via the gainBlend; emission dampening runs through the PI servo/E/I brake (emissionFactor), not an outputScale cap.',
      lastGainAt: em.updated || Date.now()
    };
    s.industryGainControl = gc; return gc;
  };

  // K3 — slow consolidation / long-term plasticity. Maintains a PARALLEL slow-weight track (IM_SLOW_RATE)
  // that never touches em.prior; fast-vs-slow divergence is a real regime-shift indicator.
  IndustryBrain.prototype._consolidateIndustrySlowModel = function () {
    var s = this.state, em = s.industryModel || {}, obs = em.observation || null;
    var slow = s.industrySlowModel || this._industrySlowModel || {
      version: 1, cycle: 0,
      slow: { expectedStress: 0.5, expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, samples: 0 },
      rate: IM_SLOW_RATE, note: 'parallel slow-weight track (IM_SLOW_RATE); does NOT touch em.prior'
    };
    if (obs) {
      var r = IM_SLOW_RATE, w = slow.slow;
      w.expectedStress = _imClamp(w.expectedStress + r * ((obs.stress || 0) - w.expectedStress), 0, 1);
      w.expectedSignal = _imClamp(w.expectedSignal + r * ((obs.signal || 0) - w.expectedSignal), 0, 1);
      w.expectedDiagnosisCount = w.expectedDiagnosisCount + r * ((obs.diagnosisCount || 0) - w.expectedDiagnosisCount);
      w.expectedOpportunityCount = w.expectedOpportunityCount + r * ((obs.opportunityCount || 0) - w.expectedOpportunityCount);
      w.samples += 1;
      slow.cycle += 1;
    }
    var fast = (em.prior && typeof em.prior.expectedStress === 'number') ? em.prior.expectedStress : 0.5;
    slow.fastSlowDivergence = Math.round(Math.abs(fast - slow.slow.expectedStress) * 1000) / 1000;
    slow.regimeShift = slow.fastSlowDivergence > 0.25;
    slow.updated = em.updated || Date.now();
    s.industrySlowModel = slow; this._industrySlowModel = slow; return slow;
  };

  // K4 — outcome / credit learning (SELF-CONSISTENCY TRUTH BRAKE). Compares each cycle's predictedStress
  // against the NEXT cycle's realized stress — the online forward-prediction loop. hitRate feeds the
  // central LIMENK4 gate as the stress-consistency tier (>=5 samples); it is consumed by the credit hook
  // in _updateIndustryModel only when the higher phase-consistency tier is absent. This is self-consistency
  // calibration (interpretive), NOT an external reward.
  IndustryBrain.prototype._scoreIndustryOutcomes = function () {
    var s = this.state, em = s.industryModel || {};
    var buf = this._industryOutcomeBuffer = this._industryOutcomeBuffer || [];
    var obs = em.observation || null;
    if (this._industryPrevPrediction != null && obs && typeof obs.stress === 'number') {
      buf.push({ predicted: this._industryPrevPrediction, realized: obs.stress, err: Math.abs(this._industryPrevPrediction - obs.stress) });
      if (buf.length > IK_OUTCOME_BUFFER) buf.shift();
    }
    this._industryPrevPrediction = (typeof em.predictedStress === 'number') ? em.predictedStress : null;
    var n = buf.length, sumErr = 0, sumSq = 0, hits = 0;
    for (var i = 0; i < n; i++) { sumErr += buf[i].err; sumSq += buf[i].err * buf[i].err; if (buf[i].err <= 0.1) hits++; }
    var om = {
      version: 1,
      samples: n,
      meanRealizedError: n ? Math.round((sumErr / n) * 1000) / 1000 : null,
      brierLike: n ? Math.round((sumSq / n) * 1000) / 1000 : null,
      hitRate: n ? Math.round((hits / n) * 100) / 100 : null,
      loopType: 'online-continuous (predicted-vs-next-realized) self-consistency; NOT a dopaminergic reward',
      creditAssignmentActive: (n >= 5),
      effectiveLearningRate: (em._effectiveLearningRate) || null,
      creditSource: em._creditSource || null,
      note: 'TRUTH BRAKE: hitRate = stress-consistency tier of the central LIMENK4 gate; scales the effective learning rate in _updateIndustryModel (>=5 samples) when the phase-consistency tier is absent — persistent mis-calibration speeds adaptation. Self-consistency calibration (interpretive), NOT external reward.',
      lastOutcomeAt: em.updated || Date.now()
    };
    s.industryOutcomeModel = om; return om;
  };

  // K5 — deep hierarchical perception. Aggregates the depth the brain HAS (L1 branch-scan cache +
  // the production-capacity sub-layer; no new fetches) and estimates the portalError the recurrent
  // model does not yet fold in (advisory — perception stops at L1; L2 is synthetic/quarantined).
  IndustryBrain.prototype._computeIndustryPerceptionDepth = function () {
    var s = this.state, em = s.industryModel || {};
    var l1 = s._l1DepthCache || null;
    var pc = s.productionCapacityLayer || null;
    var l1Real = 0, l1Mad = 0;
    if (l1 && l1.byDiagnosis) { Object.keys(l1.byDiagnosis).forEach(function (k) { l1Real += (l1.byDiagnosis[k].realTreatments || 0); l1Mad += (l1.byDiagnosis[k].madLibTreatments || 0); }); }
    var levels = [
      { level: 'L0', name: 'root', status: (this._portalCache || s._portalCache) ? 'loaded' : 'pending' },
      { level: 'L1', name: 'branch-scan', status: l1 ? 'scanned' : 'pending', realTreatments: l1Real, madLibTreatments: l1Mad },
      { level: 'L2', name: 'deep-cortex', status: 'quarantined', note: 'synthetic (immune-blocked)' },
      { level: 'PC', name: 'production-capacity-sublayer', status: (pc && pc.loaded) ? 'loaded' : 'absent', activeCount: (pc && pc.activeCount) || 0 }
    ];
    var loadedDepth = (pc && pc.loaded) ? 3 : (l1 ? 1 : 0);
    var admissible = l1Real + ((pc && pc.count) ? pc.count : 0);
    var blocked = l1Mad + 1;                                        // +1 for the quarantined L2 tier
    var portalErrorEstimate = Math.round((blocked / Math.max(1, admissible + blocked)) * 1000) / 1000;
    var pd = {
      version: 1, levels: levels, deepestUsableLevel: loadedDepth,
      portalErrorEstimate: portalErrorEstimate,
      note: 'ADVISORY estimate: perception stops at L1 (L2 quarantined); production-capacity sub-layer is real-content/hand-authored. Prediction error does not yet fold this term (no new fetches).',
      lastDepthAt: em.updated || Date.now()
    };
    s.industryPerceptionDepth = pd; return pd;
  };

  // K6 — attention / selective routing. Ranks top-down salience (active + relevance + prediction-error)
  // and names focus vs suppressed diagnoses, without gating the pipeline. Advisory read-out.
  IndustryBrain.prototype._computeIndustryAttention = function () {
    var s = this.state, em = s.industryModel || {}, reg = em.regulation || {};
    var pe = (em.predictionError && em.predictionError.total) || 0;
    var rb = this._readRequestBiases ? this._readRequestBiases() : { attentionFocus: [] };
    var focus = (rb.attentionFocus || []).map(function (f) { return String(f).toLowerCase(); });
    var scored = (s.diagnoses || []).map(function (d) {
      var sal = (d.active ? 0.5 : 0) + (d.relevance || 0) * 0.4 + pe * 0.1;
      var hay = (String(d.id) + ' ' + String(d.label || '')).toLowerCase();
      if (focus.some(function (f) { return f && hay.indexOf(f) !== -1; })) sal += 0.5;
      return { id: d.id, active: !!d.active, salience: Math.round(sal * 1000) / 1000 };
    }).sort(function (a, b) { return b.salience - a.salience; });
    var at = {
      version: 1,
      driver: reg.state === 'surprised' ? 'novelty-driven (bottom-up)' : 'goal-driven (top-down)',
      focus: scored.slice(0, 3),
      suppressed: scored.slice(3).map(function (x) { return x.id; }).slice(0, 8),
      broadenUnderSurprise: reg.state === 'surprised',
      note: 'ADVISORY: salience ranking of active/near diagnoses; operator attentionFocus boosts salience. Does not hard-gate the pipeline.',
      lastAttentionAt: em.updated || Date.now()
    };
    s.industryAttention = at; return at;
  };

  // K7 — lateral inhibition (microcircuit). reg.inhibition implies a winner-take-most ranking among
  // competing active diagnoses; this surfaces the winner and the suppress-weight on the competitors.
  IndustryBrain.prototype._computeIndustryInhibition = function () {
    var s = this.state, em = s.industryModel || {}, reg = em.regulation || {};
    var inhib = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;
    var active = (s.diagnoses || []).filter(function (d) { return d.active; })
      .sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var winner = active[0] || null;
    var li = {
      version: 1, inhibitionStrength: inhib,
      winner: winner ? winner.id : null,
      competitors: active.slice(1).map(function (d) { return { id: d.id, relevance: d.relevance, suppressBy: Math.round((d.relevance || 0) * inhib * 1000) / 1000 }; }).slice(0, 6),
      note: 'ADVISORY: winner-take-most among competing active diagnoses (reg.inhibition). Down-weighting is advisory (not applied to the emitted ranking).',
      lastInhibitionAt: em.updated || Date.now()
    };
    s.industryInhibition = li; return li;
  };

  // K8 — homeostatic set-point (microcircuit). Maintains an adaptive baseline (Turrigiano-style scaling)
  // alongside the fixed IM_STRESS_FLOOR. CLOSED: _updateIndustryModel blends this adaptiveBaseline with
  // the fixed floor to gate readyForHandoff (>=10 samples), bounded to +0.15 above the fixed floor.
  IndustryBrain.prototype._computeIndustryHomeostasis = function () {
    var s = this.state, em = s.industryModel || {};
    var win = ((s.memory && s.memory.stressHistory) || []).slice(-IK_HOMEO_WINDOW);
    var n = win.length, sum = 0;
    for (var i = 0; i < n; i++) sum += (win[i].stress || 0);
    var baseline = n ? sum / n : 0.5;
    var cur = (typeof s.stress === 'number') ? s.stress : 0;
    var scalingFactor = baseline > 0 ? Math.round((0.5 / Math.max(0.1, baseline)) * 1000) / 1000 : 1;
    var hm = {
      version: 1,
      fixedFloor: IM_STRESS_FLOOR,
      adaptiveBaseline: Math.round(baseline * 1000) / 1000,
      currentStress: cur,
      deviationFromBaseline: Math.round((cur - baseline) * 1000) / 1000,
      deviation: Math.max(0, Math.round((cur - baseline) * 1000) / 1000),
      scalingFactor: scalingFactor,
      samples: n,
      effectiveFloor: (em._effectiveFloor) || null,
      note: 'CLOSED: readyForHandoff gates on a 50/50 blend of IM_STRESS_FLOOR and adaptiveBaseline (>=10 samples) via em._effectiveFloor.',
      lastHomeostasisAt: em.updated || Date.now()
    };
    s.industryHomeostasis = hm; return hm;
  };

  // Assemble the neuro-completion surface. Runs K1-K8 in the SAME order Energy uses, stores each on
  // state, and attaches a compact roll-up to state.industryNeuro (surfaced additively in cognition.neuro).
  IndustryBrain.prototype._computeIndustryNeuroLayers = function () {
    this._computeIndustryAfferent();          // K1 — afferent inter-brain input
    this._computeIndustryGainControl();       // K2 — neuromodulatory gain application
    this._consolidateIndustrySlowModel();     // K3 — slow consolidation / long-term plasticity
    this._scoreIndustryOutcomes();            // K4 — outcome / credit learning (self-consistency truth brake)
    this._computeIndustryPerceptionDepth();   // K5 — deep hierarchical perception
    this._computeIndustryAttention();         // K6 — attention / selective routing
    this._computeIndustryInhibition();        // K7 — lateral inhibition (microcircuit)
    this._computeIndustryHomeostasis();       // K8 — adaptive set-point (microcircuit)
    var s = this.state;
    var neuro = {
      version: 1,
      status: 'wired',                        // K4/K8 close a loop; K1-K3/K5-K7 advisory read-outs
      afferent: s.industryAfferent || null,
      gainControl: s.industryGainControl || null,
      slowModel: s.industrySlowModel || null,
      outcomeModel: s.industryOutcomeModel || null,
      perceptionDepth: s.industryPerceptionDepth || null,
      attention: s.industryAttention || null,
      inhibition: s.industryInhibition || null,
      homeostasis: s.industryHomeostasis || null
    };
    s.industryNeuro = neuro;
    return neuro;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // ACTUATION METHODS (Energy-parity port). All deterministic; NO paid-AI / fetch-to-LLM
  // ever runs here. Additive + reversible; touch only the emission-confidence / credit channels.
  // ════════════════════════════════════════════════════════════════════════════

  // REGULATE-TO-TARGET SERVO + E/I (Neuro Ref XIII.1 / V.2 / XII). Sensor = excitatory drive
  // (stress + how many things fire at once). Controller = PI (fast proportional + bounded slow
  // integral, the HPA fast+slow arms). Effector = a proportional emissionFactor the E/I brake
  // consumes in _applyIndustryActuationGate. Deviation is read from the generic K-stack's adaptive
  // baseline (prior cycle), with an inline stressHistory fallback so it works before that exists.
  // Only ever ADDS braking (never disinhibits). Never rewrites stress/scoring/diagnoses/data files.
  IndustryBrain.prototype._computeIndustryServo = function () {
    function R(x) { return Math.round(x * 1000) / 1000; }
    var s = this.state;
    var stress = (typeof s.stress === 'number') ? s.stress : 0;
    var conds = Array.isArray(s._activeConditions) ? s._activeConditions.length : (Array.isArray(s.signals) ? s.signals.length : 0);
    var dxA = Array.isArray(s.diagnoses) ? s.diagnoses.filter(function (d) { return d && d.active; }).length : 0;
    var drive = Math.max(0, Math.min(2, stress + Math.min(conds, 12) / 24 + Math.min(dxA, 6) / 24));
    // inhibition proxy: how much braking is already engaged (generic brake reasons + gain gating).
    var neuro = s.domainNeuro || (s.cognition && s.cognition.neuro) || {};
    var brake = neuro.brake || {};
    var brakeReasons = Array.isArray(brake.reasons) ? brake.reasons.length : 0;
    var inhibition = Math.max(0, Math.min(1, brakeReasons / 5 + (brake.level === 'dampen' ? 0.3 : brake.level === 'halt' ? 0.6 : 0)));
    // deviation from the adaptive baseline (K8 analogue): prefer the generic K-stack homeostasis,
    // else compute from local stress history.
    var deviation = 0;
    if (neuro.homeostasis && typeof neuro.homeostasis.deviation === 'number') {
      deviation = Math.max(0, neuro.homeostasis.deviation);
    } else {
      var hist = (s.memory && s.memory.stressHistory) || [];
      var win = hist.slice(-60), n = win.length, sum = 0;
      for (var i = 0; i < n; i++) sum += (win[i].stress || 0);
      var baseline = n ? sum / n : 0.5;
      deviation = Math.max(0, stress - baseline);
    }
    var FLOOR = 0.15;
    var target = Math.max(FLOOR, Math.min(1, Math.max(drive, FLOOR + deviation)));   // allostatic set-point
    var error = target - inhibition;                                                 // >0 => under-braked for the drive/regime
    this._servoIntegral = Math.max(-0.5, Math.min(0.5, (this._servoIntegral || 0) + error * 0.15));
    var Kp = 0.8, Ki = 0.4;
    var correction = Math.max(0, Kp * error + Ki * Math.max(0, this._servoIntegral));  // only ADD braking
    var emissionFactor = Math.max(0.2, Math.min(1, 1 - correction));                   // effector
    var state = error > 0.25 ? 'runaway-risk' : ((inhibition - target) > 0.4 ? 'over-inhibited' : 'balanced');
    var servo = {
      version: 1, actuated: true, drive: R(drive), inhibition: R(inhibition), target: R(target),
      error: R(error), integral: R(this._servoIntegral), emissionFactor: R(emissionFactor),
      state: state, deviation: R(deviation),
      note: 'closed-loop allostasis: drives inhibition toward a drive+deviation target; effector = proportional emission dampening (consumed by _applyIndustryActuationGate). Neuro Ref XIII.1/V.2/XII.'
    };
    s.industryServo = servo;
    return servo;
  };

  // THING2 RECURSIVE PHASE KERNEL → phase source. Push this cycle's PRIMARY STRESS scalar
  // (this.state.stress; up = worse => positive:false) onto a rolling series (cap 60, persisted to
  // localStorage), then run the REAL Thing2 adapter (PURE MATH; no network, no AI). When the kernel
  // returns a phase (>=8 samples) it becomes this._kernelPhase and phaseSource='thing2-kernel';
  // otherwise this._kernelPhase stays null and phaseSource='fallback' (naive state.phase used).
  // seriesSource = this.state.stress (STRESS metric, positive:false). Deterministic; fully guarded.
  IndustryBrain.prototype._updateIndustryKernelPhase = function () {
    var scalar = (typeof this.state.stress === 'number' && isFinite(this.state.stress)) ? this.state.stress : 0;
    if (!Array.isArray(this._phaseSeries)) this._phaseSeries = [];
    this._phaseSeries.push(scalar);
    while (this._phaseSeries.length > 60) this._phaseSeries.shift();   // cap length 60 (shift oldest)
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.setItem('limen:phaseseries:industry', JSON.stringify(this._phaseSeries));
      }
    } catch (_persistErr) {}

    this._kernelPhase = null;
    this.state.phaseSource = 'fallback';
    try {
      if (typeof window !== 'undefined' && window.LIMENThing2 && this._phaseSeries.length >= 8) {
        var _kp = window.LIMENThing2.phaseOfSeries(this._phaseSeries, { positive: false });   // STRESS series
        if (_kp && _kp.phase) {
          this._kernelPhase = _kp.phase;
          this.state.kernelPhase = _kp.phase;
          this.state.kernelTrajectory = _kp.trajectory;
          this.state.kernelCAccum = _kp.cAccumulator;
          this.state.phaseSource = 'thing2-kernel';
        }
      }
    } catch (_kernelErr) { this._kernelPhase = null; this.state.phaseSource = 'fallback'; }
  };

  // PHASE-COHERENCE ROUTER + PHASE-TRANSITION CALIBRATION (patent 3.4 Loop-1 M matrix + thing2 lineage).
  //  (A) Router: Industry couples to OTHER domains whose phase is coherent with its own (positive M)
  //      AND are stressed — communication-through-coherence (same excitability window). Advisory
  //      coupling strength opens the emission window a bounded amount in _applyIndustryActuationGate.
  //  (B) Calibration: a realized phase TRANSITION over time is self-consistency calibration
  //      (interpretive) — NEVER an external reward. The P3/P7 family (the phases Thing1 validates;
  //      Industry's canonical phase = P3) only gates the higher phase-consistency TIER of the central
  //      LIMENK4 gate; off-family transitions stay advisory self-consistency. Consumed by the K4 hook.
  // Deterministic; no AI; no writes to any data file.
  IndustryBrain.prototype._computeIndustryPhaseDynamics = function () {
    var s = this.state;
    var PHASE_M = {
      p3:  { p3: 0.08, p7a: 0.05, p9: 0.04, p0: -0.06 },
      p7a: { p7a: 0.10, p3: 0.04, p9: 0.06, p0: -0.08, p4: -0.04 },
      p7:  { p7: 0.10, p3: 0.04, p9: 0.06, p0: -0.08 },
      p4:  { p4: 0.05, p5: 0.04, p0: 0.03, p3: -0.04 },
      p6:  { p6: 0.06, p0: 0.04, p3: -0.05 },
      p9:  { p9: 0.08, p7a: 0.05, p0: -0.10, p4: -0.06 },
      p10: { p10: 0.06, p0: 0.05, p6: 0.03 }
    };
    var VALIDATED = { p3: 1, p7: 1, p7a: 1, p7b: 1 };               // P3/P7 family gate for phase-consistency tier — self-consistency, NOT external reward
    var BREAKING = { p1: 1, p3: 1, p7: 1, p7a: 1, p7b: 1, p9: 1 };  // recursion-arc BREAKING family = more-distressed
    function norm(p) { if (p == null) return null; p = String(p).toLowerCase().replace(/[^a-z0-9]/g, ''); if (p.charAt(0) !== 'p') p = 'p' + p; return p; }
    // PREFER the REAL Thing2 kernel phase when available; else the naive/static state.phase (fallback).
    // This single myPhase feeds BOTH (A) the coherence router and (B) the phase-transition calibration.
    var phaseSource = (this._kernelPhase != null) ? 'thing2-kernel' : 'fallback';
    var myPhase = norm((this._kernelPhase != null) ? this._kernelPhase : s.phase);

    // (A) COHERENCE ROUTER — couple to co-phased, stressed peers via the registered brains.
    var coupled = [], couplingStrength = 0;
    if (myPhase && PHASE_M[myPhase] && window.LIMENDomainBrains) {
      var row = PHASE_M[myPhase];
      var all = window.LIMENDomainBrains.getAll();
      Object.keys(all).forEach(function (k) {
        if (k === 'industry') return;
        var b = all[k]; if (!b || !b.state) return;
        var op = norm(b.state.phase);
        var st = (typeof b.state.stress === 'number') ? b.state.stress : 0;
        if (!op) return;
        var coh = (row[op] != null) ? row[op] : (op === myPhase ? 0.04 : 0);
        if (coh > 0 && st > 0.5) coupled.push({ domain: k, phase: op, coherence: coh, stress: Math.round(st * 100) / 100 });
      });
      coupled.sort(function (a, b) { return (b.coherence * b.stress) - (a.coherence * a.stress); });
      couplingStrength = coupled.reduce(function (a, c) { return a + c.coherence * c.stress; }, 0);
    }

    // (B) PHASE-TRANSITION SELF-CONSISTENCY — did a predicted transition actually occur (through time)?
    // This is self-consistency calibration (interpretive), NEVER an external reward.
    var hist = this._industryPhaseHistory = this._industryPhaseHistory || [];
    var prev = hist.length ? hist[hist.length - 1].phase : null;
    var transitionCalib = null;
    if (prev != null && myPhase != null && prev !== myPhase) {
      var em = s.industryModel || {};
      var neuro = s.domainNeuro || (s.cognition && s.cognition.neuro) || {};
      var fc = neuro.forecast || {};
      var predictedUp = fc.direction === 'rising' ||
        (typeof fc.projectedStress === 'number' && typeof s.stress === 'number' && fc.projectedStress > s.stress) ||
        (typeof em.predictedStress === 'number' && typeof s.stress === 'number' && em.predictedStress > s.stress);
      var wentUp = (BREAKING[myPhase] && !BREAKING[prev]) ? true : (BREAKING[prev] && !BREAKING[myPhase]) ? false : null;
      var hit = (wentUp !== null) ? (wentUp === !!predictedUp) : null;
      var validated = !!(VALIDATED[myPhase] || VALIDATED[prev]);
      transitionCalib = { from: prev, to: myPhase, predictedUp: !!predictedUp, wentUp: wentUp, hit: hit,
        validated: validated, kind: validated ? 'self-consistency calibration (phase, P3/P7 family — interpretive, NOT external reward)' : 'advisory self-consistency calibration (interpretive)' };
    }
    hist.push({ phase: myPhase, t: (s.industryModel && s.industryModel.updated) || Date.now() });
    if (hist.length > 24) hist.shift();

    var out = {
      version: 1, myPhase: myPhase, phaseSource: phaseSource,
      coupled: coupled.slice(0, 5), couplingStrength: Math.round(couplingStrength * 1000) / 1000,
      transition: transitionCalib,
      note: 'phase source = ' + phaseSource + ' (REAL Thing2 recursive kernel when available, else naive state.phase). phase-coherence router (patent M matrix) + phase-transition self-consistency calibration (thing2 lineage; P3/P7 family only gates the phase-consistency tier of the central LIMENK4 gate — interpretive, NEVER external reward; Industry is P3).'
    };
    s.industryPhaseDynamics = out;
    return out;
  };

  // E/I BALANCE + SELF-AUDIT (SPOF) ADVISORIES — observe-only (Neuro Ref XIII.1 + XIV). Consumes the
  // domain's 81-edge graph (industry.json edges, NOT in the live snapshot) via the connectivity
  // audit: prefers window.LIMENConnectivityAudit (pure edge function) when present, else an inline
  // articulation/hub computation. Lazily fetches + caches the edges once (fire-and-forget). No AI,
  // no writes. The brain SEES its own runaway risk + brittle nodes each cycle.
  IndustryBrain.prototype._computeIndustryRegulationAdvisories = function () {
    var s = this.state, out = { version: 1, observeOnly: true };
    // (1) E/I balance — is inhibition tracking drive? Prefer the shared module, else inline.
    try {
      var servo = s.industryServo || {};
      var drive = (typeof servo.drive === 'number') ? servo.drive : (typeof s.stress === 'number' ? s.stress : 0);
      var inhibition = (typeof servo.inhibition === 'number') ? servo.inhibition : 0;
      var EI = (typeof window !== 'undefined' && window.LIMENEIBalance) || null;
      if (EI && typeof EI.assess === 'function') {
        out.eiBalance = EI.assess({ drive: drive, inhibition: inhibition });
      } else {
        var floor = 0.15, required = Math.max(floor, Math.min(1, drive));
        var ratio = inhibition / Math.max(drive, 1e-6);
        var state = (drive > floor && ratio < 0.6) ? 'runaway-risk' : (ratio > 1.8 && inhibition > floor) ? 'over-inhibited' : 'balanced';
        out.eiBalance = { drive: Math.round(drive * 1000) / 1000, inhibition: Math.round(inhibition * 1000) / 1000, required: Math.round(required * 1000) / 1000, ratio: Math.round(ratio * 1000) / 1000, state: state, deficit: Math.round((required - inhibition) * 1000) / 1000, note: 'inline E/I (Neuro Ref XIII.1): inhibition must track drive' };
      }
    } catch (e) { out.eiBalance = null; }
    // (2) Self-audit — CONSUME the connectivity / SPOF audit on the REAL graph (81 edges).
    try {
      var self = this;
      var edges = this._industryEdges || null;
      if (!edges) {
        if (typeof fetch === 'function' && !this._industryEdgesPromise) {
          this._industryEdgesPromise = fetch('/assets/data/domains/industry.json')
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (j) { if (j && Array.isArray(j.edges)) self._industryEdges = j.edges; })
            .catch(function () {});
        }
      }
      var CA = (typeof window !== 'undefined' && window.LIMENConnectivityAudit) || null;
      if (edges && edges.length && CA && typeof CA.singlePointsOfFailure === 'function') {
        var audit = CA.singlePointsOfFailure({ edges: edges });
        var spof = (audit && audit.articulationNodes) || [];
        out.selfAudit = { consumed: true, source: 'LIMENConnectivityAudit', edgeCount: edges.length, spofCount: spof.length, spof: spof.slice(0, 5), verdict: (audit && audit.verdict) || null, topHubs: (audit && audit.topHubsByDegree) || [] };
      } else if (edges && edges.length) {
        out.selfAudit = this._industrySpofInline(edges);
      } else {
        out.selfAudit = { consumed: false, note: 'edges loading (async, next cycle)' };
      }
    } catch (e) { out.selfAudit = { consumed: false, error: String(e && e.message || e).slice(0, 80) }; }
    s.industryRegulationAdvisories = out;
    return out;
  };

  // Inline single-point-of-failure / hub audit (Neuro Ref XIV diaschisis) — self-contained fallback
  // when window.LIMENConnectivityAudit is not loaded on the Industry console. Pure function of edges.
  IndustryBrain.prototype._industrySpofInline = function (edges) {
    function componentCount(nodes, es) {
      var adj = {}; nodes.forEach(function (n) { adj[n] = []; });
      es.forEach(function (e) { if (adj[e.source] && adj[e.target]) { adj[e.source].push(e.target); adj[e.target].push(e.source); } });
      var seen = {}, comps = 0;
      nodes.forEach(function (n) {
        if (seen[n]) return; comps++; var stack = [n];
        while (stack.length) { var x = stack.pop(); if (seen[x]) continue; seen[x] = 1; adj[x].forEach(function (y) { if (!seen[y]) stack.push(y); }); }
      });
      return comps;
    }
    var nodeSet = {}; edges.forEach(function (e) { nodeSet[e.source] = 1; nodeSet[e.target] = 1; });
    var nodes = Object.keys(nodeSet);
    var base = componentCount(nodes, edges);
    var spof = [];
    nodes.forEach(function (n) {
      var rn = nodes.filter(function (x) { return x !== n; });
      var re = edges.filter(function (e) { return e.source !== n && e.target !== n; });
      var c = componentCount(rn, re);
      if (c > base) spof.push({ node: n, componentsAfterRemoval: c, baseComponents: base });
    });
    var deg = {}; edges.forEach(function (e) { deg[e.source] = (deg[e.source] || 0) + 1; deg[e.target] = (deg[e.target] || 0) + 1; });
    var hubs = Object.keys(deg).map(function (n) { return { node: n, degree: deg[n] }; }).sort(function (a, b) { return b.degree - a.degree; }).slice(0, 5);
    return { consumed: true, source: 'inline', edgeCount: edges.length, spofCount: spof.length, spof: spof.slice(0, 5), topHubs: hubs, verdict: spof.length ? spof.length + ' articulation node(s) = single points of failure' : 'no articulation nodes (graph degrades gracefully)' };
  };

  // ════════════════════════════════════════════════════════════════════════════
  // AI SLOT (generative node→business authoring) — NEVER called from the 30s cycle.
  // This is the one genuinely "code-cannot-do-this" step (semantic authoring of a
  // business thesis from a node motif). It is an EXPLICIT operator trigger ONLY, routes
  // through a server endpoint that is killswitch-gated (server enforces
  // lib/ai-kill-switch spendDisabled()), and carries NO API key in client code. If the
  // endpoint is absent it stays a documented no-op — it must never fabricate content or
  // spend on the deterministic cycle. COST-SAFE by construction.
  IndustryBrain.prototype._authorNodeBusinessViaOperator = function (nodeId, opts) {
    // Guard: this must never be reachable from cycle()/_updateIndustryModel — operator UI only.
    if (!opts || opts.operatorTriggered !== true) {
      return Promise.resolve({ ok: false, reason: 'operator-trigger-required (never runs on the deterministic cycle)' });
    }
    if (typeof fetch !== 'function') return Promise.resolve({ ok: false, reason: 'no-fetch' });
    return fetch('/api/industry-node-business', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'industry', nodeId: nodeId, diagnosisId: (opts && opts.diagnosisId) || null })
    })
      .then(function (r) { return r.ok ? r.json() : { ok: false, reason: 'endpoint ' + r.status + ' (killswitch may be engaged server-side)' }; })
      .catch(function () { return { ok: false, reason: 'endpoint-unavailable (no-op; no spend)' }; });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // DomainDiagnosisPacket SCHEMA (schema-only; NEVER invents data). domain='industry'.
  // ════════════════════════════════════════════════════════════════════════════
  var IM_DDP_SCHEMA_VERSION = 'industry-ddp-1';
  function _imDdpPresent(v) {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (v === 'missing' || v === '' || v === 'none') return false;
    return true;
  }
  function _imDdpCompleteness(section, keys) {
    var have = 0; for (var i = 0; i < keys.length; i++) { if (_imDdpPresent(section[keys[i]])) have++; }
    return { have: have, total: keys.length, pct: keys.length ? Math.round(have / keys.length * 100) : 0 };
  }

  IndustryBrain.prototype._buildDomainDiagnosisPacket = function (dx) {
    var s = this.state || {};
    var em = s.industryModel || {};
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
    if (Array.isArray(feeds)) { for (var afi = 0; afi < feeds.length; afi++) { var af = feeds[afi]; sourceFeeds.push({ name: (af && af.name) || ('feed_' + afi), updated: (af && af.updated) || null, source: (af && af.source) || null }); } }
    else { for (var fk in feeds) { if (feeds.hasOwnProperty(fk)) { var f = feeds[fk]; sourceFeeds.push({ name: fk, updated: (f && f.updated) || null, source: (f && f.source) || null }); } } }

    var _canon = this._resolveCanonicalDiagnosis(dxId);
    var identity = {
      domain: 'industry',
      diagnosisId: dxId,
      canonicalDiagnosisId: _canon.canonicalDiagnosisId,
      aliasUsed: _canon.aliasUsed,
      aliasReviewStatus: _canon.aliasReviewStatus,
      aliasRisk: _canon.aliasRisk,
      aliasNote: _canon.aliasNote,
      label: dx ? (dx.label || dx.id || null) : null,
      phase: s.phase || null,
      confidence: (dx && typeof dx.relevance === 'number') ? dx.relevance : (typeof s.confidence === 'number' ? s.confidence : null)
    };
    var _bundle = (this._bundleCache && this._bundleCache[identity.canonicalDiagnosisId]) || null;
    var _bundleKnown = !!(this._bundleStatusMap && Object.prototype.hasOwnProperty.call(this._bundleStatusMap, identity.canonicalDiagnosisId));
    var _bl = (_bundle && _bundle.byLane && _bundle.byLane.investments) ? _bundle.byLane.investments : null;
    var _bArr = function (k) { return (_bl && Array.isArray(_bl[k])) ? _bl[k] : []; };
    var bundleStatus = _bundle ? 'found' : (_bundleKnown ? 'missing' : 'unknown');
    var bundleShallow = !!(_bundle && ((_bundle.maxDepth || 0) === 0 || (_bundle.portalCount || 0) <= 1));
    var bundleResolution = identity.aliasUsed
      ? (_bundle ? 'alias-resolved-and-bundle-found' : 'alias-resolved-but-bundle-missing')
      : (_bundle ? 'found' : (_bundleKnown ? 'missing' : 'unknown'));
    if (!treatments.length && _bl) treatments = _bArr('treatments');
    if (!implementationSteps.length && _bl) implementationSteps = _bArr('implementationSteps');
    var brainState = {
      industryModel: { version: em.version || null, cycle: (typeof em.cycle === 'number' ? em.cycle : null) },
      predictionError: em.predictionError || null,
      regulationState: (em.regulation && em.regulation.state) || null,
      prior: em.prior || null,
      observation: em.observation || null,
      plasticity: em.plasticity || null,
      readyForHandoff: em.readyForHandoff === true
    };
    var rootId = (portal && portal.domainId) || 'industry';
    var rootTitle = (portal && portal.title) || 'Industry';
    var ancestry = (portal && portal.parentLabel) ? [portal.parentLabel, rootTitle] : [rootTitle];
    var portalContext = {
      portalIds: [rootId],
      portalDomain: 'industry',
      portalTitle: rootTitle,
      depth: 0,
      ancestryPath: ancestry,
      portalStatus: portal ? 'root-only' : 'pending',
      sourceCompleteness: portal ? ((Array.isArray(portal.issues) && portal.issues.length) ? 'partial' : 'thin') : 'root-only',
      bundleSource: (_bundle && Array.isArray(_bundle.sourcePortals) && _bundle.sourcePortals.length)
        ? { portalIds: _bundle.sourcePortals.map(function (sp) { return sp.portalId; }), depth: _bundle.maxDepth || 0, ancestryPath: (_bundle.sourcePortals[0].ancestry || []), domains: _bundle.domains || [] }
        : null,
      l1Depth: (s._l1DepthCache && s._l1DepthCache.byDiagnosis && s._l1DepthCache.byDiagnosis[dxId]) || (s._l1DepthCache ? { branchesScanned: 0, realCompanyTickers: [], realTreatments: 0, madLibTreatments: 0, admitted: false, reason: 'no L1 branch mapped for this diagnosis' } : null)
    };
    var citationHints = sourceFeeds.map(function (sf) { return sf.source || sf.name; }).filter(Boolean);
    var evidenceAnchors = _bArr('evidenceAnchors');
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
    var _isExternal = !!(_bundle && _bundle.buildMethod === 'external-source-authored');
    var _intakeSrcHint = { SUPPLY_SHORTAGE_EVENT: 'BLS PPI / Census M3 / supplier filings / patent literature', EQUIPMENT_FAILURE_CASCADE: 'OSHA incident reports / OEM service bulletins / patent literature', HAZMAT_INCIDENT: 'CSB investigations / PHMSA incident reports / 49 CFR / EPA', PRODUCT_DEFECT_EVENT: 'NHTSA / CPSC recall databases / ISO 9001 / patent literature', LABOR_CONSTRAINT_EVENT: 'BLS JOLTS / DOL filings / UAW/USW reports' };
    var authoringIntake = [];
    if (_isExternal) {
      ['methodCandidates', 'embodimentCandidates', 'figurePlaceholders'].forEach(function (field) {
        if (_bArr(field).length === 0) authoringIntake.push({ field: field, status: 'needs-human-input', count: 0, need: field === 'methodCandidates' ? 'a concrete technical method drawn from a primary source' : field === 'embodimentCandidates' ? 'a specific implementation/embodiment from a real document' : 'a figure description grounded in a real source', sourceHint: _intakeSrcHint[identity.canonicalDiagnosisId] || 'primary institutional / patent source', note: 'NOT fabricated by the brain — author from the cited source, then wire in verbatim with attribution' });
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
      targets: (primaryOpp && primaryOpp._resolvedTargets) ? primaryOpp._resolvedTargets : (mc && mc.target ? [mc.target] : (primaryOpp && primaryOpp.companies) ? primaryOpp.companies : []),
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
    var artifactContext = {
      artifactLanes: artifactLanes,
      patentReady: false, grantReady: false, sbaReady: false,   // lanes purged 2026-06-21 (also vetoed by H3 conscience)
      investmentReady: !!(hasTreat && primaryOpp), researchReady: ready || hasTreat,
      readinessReasons: readinessReasons,
      blockers: blockers
    };

    var comp = {
      identity:         _imDdpCompleteness(identity, ['domain', 'diagnosisId', 'canonicalDiagnosisId', 'label', 'phase', 'confidence']),
      brainState:       _imDdpCompleteness(brainState, ['industryModel', 'predictionError', 'regulationState', 'prior', 'observation', 'plasticity']),
      portalContext:    _imDdpCompleteness(portalContext, ['portalIds', 'portalDomain', 'portalTitle', 'depth', 'ancestryPath']),
      evidence:         _imDdpCompleteness(evidence, ['sourceFeeds', 'evidenceAnchors', 'citationHints']),
      treatmentContext: _imDdpCompleteness(treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']),
      operatorContext:  _imDdpCompleteness(operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']),
      artifactContext:  _imDdpCompleteness(artifactContext, ['artifactLanes'])
    };
    var totHave = 0, totAll = 0;
    for (var sk in comp) { if (comp.hasOwnProperty(sk)) { totHave += comp[sk].have; totAll += comp[sk].total; } }
    var missingFields = [];
    function _cm(name, obj, keys) { for (var i = 0; i < keys.length; i++) { if (!_imDdpPresent(obj[keys[i]])) missingFields.push(name + '.' + keys[i]); } }
    _cm('identity', identity, ['canonicalDiagnosisId', 'confidence']);
    _cm('evidence', evidence, ['evidenceAnchors', 'citationHints']);
    _cm('treatmentContext', treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']);
    _cm('operatorContext', operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']);

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
    if (!primaryOpp && (typeof s.stress !== 'number' || s.stress < IM_STRESS_FLOOR)) warnings.push('no active opportunity (offline/low-stress) — operator/lane fields stay empty');
    if (artifactContext.artifactLanes.length && !hasTreat) warnings.push('artifact lane present but treatments/evidence missing');

    var pct = totAll ? Math.round(totHave / totAll * 100) : 0;
    var proofTier = pct >= 70 ? 'full' : (pct >= 35 ? 'partial' : 'sparse');

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
        'diagnosis-specific bundle anchors preferred over generic industry evidence',
        'official/primary sources retained (BLS/Census/OSHA/MSHA/NHTSA/CPSC/PHMSA/CSB where present)',
        'mechanisms prioritized over figures under prompt-space limits',
        'treatments with implementation relevance preferred over broad narrative',
        'caps applied per field; full data preserved in the stored bundle + full DDP'
      ],
      retainedWarnings: warnings
        .concat(s.industryImmune ? ['immune: ' + s.industryImmune.immuneState + ' (sev ' + s.industryImmune.severity + ', ' + (s.industryImmune.antigens || []).length + ' antigens; L2 traversal blocked)'] : [])
        .concat(s.industryConscience && s.industryConscience.conscienceState === 'restrictive' ? ['conscience: ' + (s.industryConscience.blockedClaims || []).slice(0, 3).join(', ') + ' blocked'] : []),
      retainedBlockers: artifactContext.blockers,
      immuneSummary: s.industryImmune ? { immuneState: s.industryImmune.immuneState, severity: s.industryImmune.severity, antigenCount: (s.industryImmune.antigens || []).length, quarantines: s.industryImmune.quarantines, blockedFromTraversal: s.industryImmune.blockedFromTraversal, allowedWithWarning: s.industryImmune.allowedWithWarning } : null,
      awarenessSummary: s.industryAwareness ? { selfNarrative: s.industryAwareness.selfNarrative, knowns: (s.industryAwareness.knowns || []).length, unknowns: (s.industryAwareness.unknowns || []).length, humanReviewRequired: s.industryAwareness.humanReviewRequired } : null,
      conscienceDecision: s.industryConscience ? { conscienceState: s.industryConscience.conscienceState, blockedClaims: s.industryConscience.blockedClaims, artifactReadinessDecision: s.industryConscience.artifactReadinessDecision } : null,
      intuitionSummary: s.industryIntuition ? s.industryIntuition.hunches : null,
      scenarioSummary: s.industrySimulation ? (s.industrySimulation.scenarios || []).map(function (x) { return { type: x.type, hypothetical: x.hypothetical, risk: x.risk }; }) : null,
      executiveReport: s.industryExecutiveReport || null,
      l1DepthSummary: portalContext.l1Depth ? { realCompanyTickers: (portalContext.l1Depth.realCompanyTickers || []).length, realTreatments: portalContext.l1Depth.realTreatments, madLibTreatments: portalContext.l1Depth.madLibTreatments, admitted: portalContext.l1Depth.admitted } : null,
      authoringIntake: treatmentContext.authoringIntake.length ? treatmentContext.authoringIntake : null,
      productionCapacitySummary: s.productionCapacityLayer && s.productionCapacityLayer.loaded ? { count: s.productionCapacityLayer.count, activeCount: s.productionCapacityLayer.activeCount, diagnoses: s.productionCapacityLayer.diagnoses, note: s.productionCapacityLayer.note } : null
    };

    return {
      schemaVersion: IM_DDP_SCHEMA_VERSION,
      promptView: promptView,
      identity: identity,
      brainState: brainState,
      portalContext: portalContext,
      evidence: evidence,
      treatmentContext: treatmentContext,
      operatorContext: operatorContext,
      artifactContext: artifactContext,
      audit: {
        generatedAt: (em.updated || null),
        schemaVersion: IM_DDP_SCHEMA_VERSION,
        fieldCompleteness: { sections: comp, overallPct: pct },
        missingFields: missingFields,
        warnings: warnings,
        proofTier: proofTier,
        immune: s.industryImmune || null,
        awareness: s.industryAwareness || null,
        conscience: s.industryConscience || null,
        intuition: s.industryIntuition || null,
        simulation: s.industrySimulation || null,
        executiveReport: s.industryExecutiveReport || null
      }
    };
  };

  // ── INDUSTRY-LOCAL FIVE-ORGAN EXTENSION ─────────────────────────────
  // The base schedules these organs; Industry owns their implementation, state and
  // authority here. Thing 2 is not consumed and external action remains inhibited.
  IndustryBrain.prototype._refreshIndustryActionOutcome = function () {
    if (typeof fetch !== 'function') return null;
    var cycle = this._cycleCount || 0;
    if (this._lastIndustryActionOutcomeCycle && cycle - this._lastIndustryActionOutcomeCycle < 12) return this._industryActionOutcome || null;
    this._lastIndustryActionOutcomeCycle = cycle;
    var self = this;
    try {
      fetch('/api/product-domain-learning-state?domain=' + encodeURIComponent(this.domainId))
        .then(function (response) { return response.json(); })
        .then(function (result) {
          if (!result || result.ok !== true || result.domain !== self.domainId || result.schemaVersion !== 'product-domain-external-learning/1.0') return;
          self._industryActionOutcome = result;
          self.state[self.domainId + 'ActionLearning'] = result;
          self.state.domainActionLearning = result;
        }).catch(function () {});
    } catch (e) {}
    return this._industryActionOutcome || null;
  };

  IndustryBrain.prototype._computeIndustryPlasticity = function () {
    var s = this.state;
    if (this._plasticity === undefined) {
      try { this._initDomainPlasticity(); } catch (e) { this._plasticity = null; }
    }
    var pl = this._plasticity;
    if (!pl || !pl.P) {
      s.industryPlasticity = s.domainPlasticity = { version: 2, domain: this.domainId, localOwner: true, mode: 'off', note: 'plasticity primitive unavailable' };
      return null;
    }
    try { this._refreshDomainExternalOutcome(); } catch (e) {}
    try { this._refreshIndustryActionOutcome(); } catch (e) {}
    var n = (s.cognition && s.cognition.neuro) || s.domainNeuro || {};
    var gc = n.gainControl || {}, at = n.attention || {}, sm = n.slowModel || {}, hm = n.homeostasis || {}, led = n.outcomeLedger || {};
    var pe = (s.cognition && s.cognition.model && ((s.cognition.model.predictionError && s.cognition.model.predictionError.total) || s.cognition.model.predictionError)) || 0;
    var dx = (s.diagnoses || []).filter(function (d) { return d.active; });
    var relevance = dx.length ? dx.reduce(function (sum, d) { return sum + (d.relevance || 0); }, 0) / dx.length : 0;
    var actionOutcome = this._industryActionOutcome;
    var actionReady = !!(actionOutcome && actionOutcome.status === 'ELIGIBLE' && actionOutcome.signal && actionOutcome.learningGate && actionOutcome.learningGate.ready === true &&
      actionOutcome.signal.sourceKind === 'independent-action-outcome' && typeof actionOutcome.signal.normalizedCredit === 'number');
    var ext = actionReady ? { hit: actionOutcome.signal.normalizedCredit, resolvedCount: actionOutcome.resolvedCount, sourceKind: 'independent-action-outcome' } : this._externalOutcome;
    var sourceKind = actionReady ? 'independent-action-outcome' : 'feed-resolution';
    var k4api = typeof window !== 'undefined' ? window.LIMENK4 : null;
    var eligible = !!(k4api && k4api.externalRewardEligible && k4api.externalRewardEligible(this.domainId, sourceKind));
    var resolved = ext && ext.resolvedCount || 0;
    var externalOutcome = eligible && typeof (ext && ext.hit) === 'number' && resolved >= 5 ? { hit: ext.hit, sourceKind: sourceKind } : null;
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
      externalOutcome: externalOutcome ? { hit: externalOutcome.hit, resolvedCount: resolved, source: sourceKind }
        : { active: false, resolvedCount: resolved, note: 'abstaining until five eligible independent outcomes resolve' },
      layers: layers, convergence: { allStable: stable },
      persistence: { hydrated: pl.hydrated, enabled: pl.persistEnabled, failures: pl.persistFailures },
      note: 'Industry-local three-factor plasticity; outcome-gated and fail-toward-seed.'
    };
    s.industryPlasticity = s.domainPlasticity = out;
    if (s.cognition) s.cognition.plasticity = out;
    if ((this._cycleCount || 0) - (pl.lastPersistCycle || 0) >= 10) {
      pl.lastPersistCycle = this._cycleCount || 0;
      try { this._persistDomainPlasticity(false); } catch (e) {}
    }
    return out;
  };

  IndustryBrain.prototype._computeIndustryEmissionQueue = function () {
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
      packages: packages, lastQueueAt: Date.now(), note: 'Industry-local queue; research internal-only, capital staged.' };
    s.industryEmissionQueue = s.domainEmissionQueue = out;
    return out;
  };

  IndustryBrain.prototype._runIndustryAutonomousEmission = function () {
    var s = this.state, brake = s.domainNeuro && s.domainNeuro.brake;
    var globalOn = typeof window !== 'undefined' && window.LIMEN_DOMAIN_AUTONOMY !== undefined ? !!window.LIMEN_DOMAIN_AUTONOMY : true;
    var localOn = !!(this.resourceAuthority && this.resourceAuthority.switches && this.resourceAuthority.switches.internalEmission);
    var hold = !globalOn || !localOn ? 'domain-internal-autonomy-off'
      : (!s.resourceMetabolism || !s.resourceMetabolism.gates || !s.resourceMetabolism.gates.mayEmitInternal) ? 'resource-metabolism-inhibited'
      : (!brake || brake.level !== 'clear') ? 'brake-' + (brake ? brake.level : 'absent') : null;
    var emitted = [], staged = [], queue = (s.industryEmissionQueue && s.industryEmissionQueue.packages) || [];
    queue.forEach(function (p) {
      if (hold) { p.status = 'held'; staged.push(p); }
      else if (p.requiresSignoff) { p.status = 'staged-for-signoff'; staged.push(p); }
      else { p.status = 'emitted-internal'; emitted.push(p); }
    });
    if (emitted.length) {
      var stream = s.industryEmitted = s.industryEmitted || [];
      emitted.forEach(function (p) { stream.push({ at: Date.now(), title: p.title, lane: p.lane, forecast: p.forecast }); });
      if (stream.length > 50) s.industryEmitted = stream.slice(-50);
    }
    var out = { version: 2, domain: this.domainId, localOwner: true, autonomy: globalOn && localOn,
      holdReason: hold, emittedCount: emitted.length, stagedCount: staged.length, emitted: emitted, staged: staged,
      externalEffects: 0, lastEmissionAt: Date.now(), note: hold ? 'held fail-safe' : 'Industry-local internal research emission; capital staged.' };
    s.industryAutoEmission = s.domainAutoEmission = out;
    return out;
  };

  IndustryBrain.prototype._computeIndustryInteroception = function () {
    var s = this.state, cog = s.cognition;
    if (!cog) return null;
    var model = cog.model || {}, n = s.domainNeuro || cog.neuro || {};
    var clamp = function (x) { return Math.max(0, Math.min(1, x)); }, r = function (x) { return Math.round(x * 1000) / 1000; };
    var channels = [{ name: 'domain-stress', alarm: r(clamp(s.stress || 0)), confidence: 0.9, weight: 1, provenance: 'Industry structured stress' }];
    var pe = model.predictionError && typeof model.predictionError === 'object' ? model.predictionError.total : model.predictionError;
    if (typeof pe === 'number') channels.push({ name: 'prediction', alarm: r(clamp(pe)), confidence: 0.7, weight: 0.85, provenance: 'Industry prediction error' });
    var ledger = n.outcomeLedger || {};
    if (typeof ledger.hitRate === 'number' && ledger.samples >= 3) channels.push({ name: 'metacognitive', alarm: r(clamp(1 - ledger.hitRate)), confidence: ledger.samples >= 5 ? 0.7 : 0.4, weight: 0.75, provenance: 'Industry outcomes' });
    var immune = cog.immune || {}, ia = { clear: 0, watch: 0.34, active: 0.4, alert: 1 };
    if (immune.immuneState) channels.push({ name: 'immune', alarm: ia[immune.immuneState] == null ? 0.34 : ia[immune.immuneState], confidence: 0.6, weight: 0.6, provenance: 'Industry immune state' });
    var forecast = n.forecast;
    if (forecast && typeof forecast.projectedStress === 'number') channels.push({ name: 'allostatic', alarm: r(clamp((forecast.projectedStress - (s.stress || 0)) * 3)), confidence: typeof forecast.confidence === 'number' ? clamp(forecast.confidence) : 0.4, weight: 0.6, provenance: 'Industry forecast' });
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
      attend: salience === 'blind-channel' ? loudest.name : null, note: 'Industry-local interoception; observe-only.' };
    s.industryInteroception = s.domainInteroception = s.interoception = out;
    cog.interoception = out;
    return out;
  };

  IndustryBrain.prototype._computeIndustryActiveInference = function () {
    var s = this.state, cog = s.cognition;
    if (!cog) return null;
    if (this._activeInference === undefined) {
      try { this._initDomainActiveInference(); } catch (e) { this._activeInference = null; }
    }
    var box = this._activeInference;
    if (!box || !box.A) {
      s.industryActiveInference = s.domainActiveInference = { version: 2, domain: this.domainId, localOwner: true, mode: 'off', note: 'active-inference primitive unavailable' };
      return null;
    }
    var n = s.domainNeuro || cog.neuro || {}, ledger = n.outcomeLedger || {};
    box.A.updateBeliefs(box.ai, typeof s.stress === 'number' ? s.stress : null);
    var selection = box.A.selectAction(box.ai, { setpoint: n.homeostasis && typeof n.homeostasis.adaptiveThreshold === 'number' ? n.homeostasis.adaptiveThreshold : 0.35,
      callHitRate: typeof ledger.hitRate === 'number' ? ledger.hitRate : null, brakeActive: !!(n.brake && n.brake.level === 'halt') });
    var queued = (s.industryEmissionQueue && s.industryEmissionQueue.packages || []).length;
    var actual = n.brake && n.brake.level === 'halt' ? 'hold-emission' : queued ? 'emit-call' : n.attention && n.attention.driver === 'novelty-driven' ? 'broaden-attention' : 'observe';
    var out = { version: 2, domain: this.domainId, localOwner: true, mode: 'shadow',
      selected: selection.selected, selectedMaps: selection.selectedMaps, actualBehavior: actual,
      agreement: selection.selected === actual, actions: selection.actions, beliefs: selection.beliefs,
      preference: selection.preference, liveConsumer: false, thing2Consumed: false,
      note: 'Industry-local belief update and expected-free-energy advisory; no live consumer.' };
    s.industryActiveInference = s.domainActiveInference = out;
    cog.activeInference = out;
    return out;
  };

  IndustryBrain.prototype._computeDomainPlasticity = IndustryBrain.prototype._computeIndustryPlasticity;
  IndustryBrain.prototype._computeGenericEmissionQueue = IndustryBrain.prototype._computeIndustryEmissionQueue;
  IndustryBrain.prototype._runGenericAutonomousEmission = IndustryBrain.prototype._runIndustryAutonomousEmission;
  IndustryBrain.prototype._computeGenericInteroception = IndustryBrain.prototype._computeIndustryInteroception;
  IndustryBrain.prototype._computeGenericActiveInference = IndustryBrain.prototype._computeIndustryActiveInference;


  var brain = new IndustryBrain(); brain.init(); brain.start();
  window.LIMENIndustryBrain = brain;
  window.LIMENDomainBrains.register(brain);

  // ══════════════════════════════════════════════════════════════════════
  // AUTO-LOAD INDUSTRY OPERATOR STACK ON DOMAIN-CONSOLE
  // ══════════════════════════════════════════════════════════════════════

  var _isDomainConsole = window.location.pathname.indexOf('domain-console') !== -1;
  var _domParam = (new URLSearchParams(window.location.search)).get('domain');
  var _isIndustryDomain = _domParam === 'industry';
  if (_isDomainConsole && _isIndustryDomain) {
    window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION = true;

    var _industryScripts = [
      'assets/js/industry-compensation.js',
      'assets/js/industry-claim-ledger.js',
      'assets/js/industry-claim-flow.js',
      'assets/js/industry-opportunity-economics.js',
      'assets/js/industry-pulse-engine.js',
      'assets/js/industry-operator-panel.js',
      'assets/js/industry-node-business-engine.js',
      'assets/js/industry-business-review.js',
      'assets/js/industry-execution-panels.js',
      'assets/js/industry-business-build.js',
      'assets/js/industry-directive-extractor.js',
      'assets/js/industry-directive-ranker.js',
      'assets/js/industry-directive-translator.js',
      'assets/js/industry-targeting-engine.js',
      'assets/js/industry-promotion-bridge.js',
      'assets/js/industry-clarity-operator.js'
    ];
    (function loadNext(i) {
      if (i >= _industryScripts.length) return;
      var s = document.createElement('script');
      s.src = _industryScripts[i];
      s.onload = function () { loadNext(i + 1); };
      s.onerror = function () { console.warn('[IndustryBrain] Failed to load ' + _industryScripts[i]); loadNext(i + 1); };
      document.head.appendChild(s);
    })(0);
  }
})();
