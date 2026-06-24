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

  function IndustryBrain() { Base.call(this, { domainId: 'industry', label: 'Industry', snapshotKey: 'industry', cycleInterval: 30000 }); }
  IndustryBrain.prototype = Object.create(Base.prototype);
  IndustryBrain.prototype.constructor = IndustryBrain;

  IndustryBrain.prototype.init = function () {
    Base.prototype.init.call(this);
    this._loadCommandBoardCompanies();        // wire real industrial company entities (state.companies was starved)
    this._loadIndustryDiagnosisBundles();     // G1: load real artifact-source bundles (only ones that exist)
    this._loadIndustryL1PortalDepth();        // J1: scan L1 portal branches (treatments mad-lib -> NOT admitted; real tickers only)
    this._loadProductionCapacityLayer();      // sub-layer: hand-authored production-capacity diagnoses (additive, never merged into the 5-spine)
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

    // Stress-derived
    if (this.state.stress >= 0.30) { this._activeConditions.push('equipment_failure'); this._activeConditions.push('reliability_decline'); }
    if (this.state.stress >= 0.45) { this._activeConditions.push('labor_shortage'); this._activeConditions.push('contractor_limit'); }
    if (this.state.stress >= 0.55) this._activeConditions.push('industry_high_stress');
    if (this.state.stress >= 0.65) { this._activeConditions.push('production_halt'); this._activeConditions.push('input_shortage'); }
    if (this.state.maturity === 'STRUCTURAL') this._activeConditions.push('structural_stress');
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
    var termCo = [] /* neutralized: distress only from validated gate (see energy-brain) */;
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
    this.state.opportunityCount = opps.length;

    this.state.opportunities = opps;
    return Promise.resolve();
  };

  IndustryBrain.prototype._checkDiagnosisActions = function () {
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; }); if (activeDx.length === 0) return;
    var adapters = window.LIMENActionAdapters; if (!adapters) return;
    for (var i = 0; i < activeDx.length; i++) { var dx = activeDx[i]; if (adapters.getDrafts && adapters.getDrafts({ domain: 'industry', intentId: dx.id }).length > 0) continue; adapters.createDraft('REPORT_GENERATION', { domain: 'industry', sourceType: 'domain_brain', sourceId: dx.id, intentId: dx.id, title: 'Industry Alert: ' + dx.label, intent: { domain: 'industry', title: dx.label, status: 'ACTIVE', priority: this.state.stress, progress: 0, strategyType: 'diagnosis_response', steps: [{ type: 'ANALYZE', label: 'Assess ' + dx.label + ' industrial impact', status: 'PENDING' }, { type: 'INVESTIGATE', label: 'Identify affected plants, lines, and suppliers', status: 'PENDING' }, { type: 'POSITION', label: 'Evaluate industrial opportunities', status: 'PENDING' }] } }); }
  };

  IndustryBrain.prototype.resolveDeepContent = function () {
    var self = this; var resolver = window.LIMENPortalContentResolver; if (!resolver) return Promise.resolve();
    return resolver.resolveForBrain(this.state).then(function (content) { self.state.resolvedContent = content; if (content) { var dt = []; for (var dxId in content.byDiagnosis) { var dxC = content.byDiagnosis[dxId]; for (var i = 0; i < dxC.treatments.length; i++) { var t = dxC.treatments[i]; dt.push({ id: 'deep_' + t.nodeId + '_' + i, label: t.label, type: t.type, evidence: t.evidence, description: t.description, cite: t.cite, steps: t.steps, monitoring: t.monitoring, escalation: t.escalation, diagnosisId: dxId, nodeId: t.nodeId, nodeLabel: t.nodeLabel, hasDepth: t.hasDepth, source: 'canonical_deep' }); } } if (dt.length > 0) self.state.treatments = dt; } }).catch(function () {});
  };

  var _origCycle = IndustryBrain.prototype.cycle;
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
    });
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

    // a FINAL decision that depends on the prior, not just on raw obs:
    var readyForHandoff = (em.cycle > 0) && (predictedStress >= IM_STRESS_FLOOR) && (obs.diagnosisCount > 0) && !reg.flooding && !reg.stale;

    var nextPrior = this._updateIndustryPrior(priorIn, obs, em.plasticity.learningRate);  // -> next cycle reads this

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

    // Production-capacity sub-layer (additive; BEFORE the DDP build so the primary packet advertises it).
    try { this._buildProductionCapacityLayer(); } catch (e) {}

    // Generic cognition surface the console SELF-MODEL panel renders for ANY domain. MANDATORY.
    try {
      this.state.cognition = {
        domain: 'industry',
        model: { cycle: em.cycle, predictionError: em.predictionError, predictedStress: em.predictedStress, regulation: em.regulation },
        awareness: this.state.industryAwareness || null,
        conscience: this.state.industryConscience || null,
        immune: this.state.industryImmune || null,
        intuition: this.state.industryIntuition || null
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
    var _bl = (_bundle && _bundle.byLane && _bundle.byLane.patents) ? _bundle.byLane.patents : null;
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
      bundle: _bundle ? { portalCount: _bundle.portalCount || 0, maxDepth: _bundle.maxDepth || 0, domains: _bundle.domains || [], lane: 'patents', shallow: bundleShallow, buildMethod: _bundle.buildMethod || null, humanVerification: _bundle.humanVerification || null } : null,
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
