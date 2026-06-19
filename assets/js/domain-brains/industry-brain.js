/**
 * industry-brain.js — Industry Domain Cognitive Engine
 *
 * Portal issues: SUPPLY_CHAIN_COLLAPSE, AUTOMATION_FAILURE, TOXIC_SPILL,
 *   QUALITY_CRISIS, WORKFORCE_SHORTAGE
 * Emissions: supplyChain, infrastructure, energy, economy, finance
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
    this.diagnosisIndex = {
      'SUPPLY_CHAIN_COLLAPSE': ['input_shortage', 'supplier_constraint', 'component_scarcity', 'critical_part_delay', 'industry_high_stress', 'macro_shock'],
      'AUTOMATION_FAILURE':     ['equipment_failure', 'automation_breakdown', 'capacity_constraint', 'production_halt', 'maintenance_backlog'],
      'TOXIC_SPILL':            ['industrial_incident', 'contamination_event', 'safety_failure', 'industry_high_stress'],
      'QUALITY_CRISIS':         ['quality_defect', 'recall_risk', 'inspection_failure', 'reliability_decline', 'industry_high_stress'],
      'WORKFORCE_SHORTAGE':     ['labor_shortage', 'workforce_gap', 'contractor_limit', 'labor_stoppage', 'structural_stress']
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
    var opps = [], stress = this.state.stress, activeDx = this.state.diagnoses.filter(function (d) { return d.active; }), allDx = this.state.diagnoses || [], companies = this.state.companies, seen = {};
    function add(o) { var key = o.title.toLowerCase().replace(/[^a-z0-9]/g, ''); if (seen[key]) return; seen[key] = true; opps.push(o); }

    for (var di = 0; di < activeDx.length; di++) {
      var dx = activeDx[di], dxLabel = (dx.label || dx.id || '').replace(/_/g, ' ');
      add({ title: dxLabel + ' — production optimization and capacity platform', rank: stress * dx.relevance, path: 'PATENTABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.50) add({ title: dxLabel + ' — maintenance acceleration and reliability hardening', rank: stress * dx.relevance * 0.9, path: 'GRANT-ELIGIBLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.55 && dx.relevance >= 0.2) add({ title: dxLabel + ' — industrial automation and throughput improvement', rank: stress * 0.85, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      add({ title: dxLabel + ' — supplier diversification and input resilience', rank: stress * dx.relevance * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
    }
    var termCo = [] /* neutralized: distress only from validated gate (see energy-brain) */;
    if (termCo.length > 0) add({ title: 'Industry terminal entity distressed positioning', rank: 0.95, path: 'INVESTABLE', urgency: 'high', source: 'company_terminal', tier: 1, companies: termCo.map(function (c) { return c.ticker; }), stress: stress });
    if (this.state.convergence && this.state.convergence.primary_signal) add({ title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — industry convergence response', rank: 0.98, path: 'GRANT-ELIGIBLE', urgency: 'high', source: 'convergence', tier: 1, stress: stress });
    var emissions = this.state.crossDomainEmissions || [];
    for (var ei = 0; ei < emissions.length; ei++) { var em = emissions[ei]; add({ title: 'Industry \u2192 ' + (em.targetDomain || '').replace(/_/g, ' ') + ' — ' + (em.signal || em.signalType || '').replace(/_/g, ' '), rank: (em.magnitude || 0.5) * stress * 0.8, path: 'INVESTABLE', urgency: em.magnitude > 0.6 ? 'high' : 'medium', source: 'cross_domain', tier: 2, stress: stress }); }
    if (stress >= 0.50) { add({ title: 'Industrial capacity expansion and modernization', rank: stress * 0.65, path: 'GRANT-ELIGIBLE', urgency: 'medium', source: 'lagging', tier: 3, stress: stress }); add({ title: 'Output continuity — redundancy and backup systems', rank: stress * 0.70, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, stress: stress }); }
    if (stress >= 0.60) { add({ title: 'Industrial safety and compliance hardening', rank: stress * 0.75, path: 'GRANT-ELIGIBLE', urgency: 'medium', source: 'lagging', tier: 3, stress: stress }); add({ title: 'Smart manufacturing — IoT monitoring and predictive maintenance', rank: stress * 0.68, path: 'PATENTABLE', urgency: 'medium', source: 'lagging', tier: 3, stress: stress }); }
    var nearDx = allDx.filter(function (d) { return !d.active && d.relevance > 0 && d.totalTriggers > 0; });
    for (var ndi = 0; ndi < nearDx.length; ndi++) { if (stress >= 0.45) add({ title: (nearDx[ndi].label || '').replace(/_/g, ' ') + ' — early-stage monitoring', rank: stress * (nearDx[ndi].relevance || 0.1) * 0.5, path: 'PATENTABLE', urgency: 'watching', source: 'near_diagnosis', tier: 2, stress: stress, nearDiagnosisId: nearDx[ndi].id }); }
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
    var _COMP = {
      'GRANT-ELIGIBLE': { type: 'grant',  base: 10, unit: '%',        tier: 1, nextTier: { tier: 2, comp: 15, requirement: '3 successful grant awards' },     maxTier: { tier: 3, comp: 25 } },
      'INVESTABLE':     { type: 'invest', base: 5,  unit: 'profit%',  tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
      'PATENTABLE':     { type: 'patent', base: 10, unit: 'royalty%', tier: 1, nextTier: { tier: 2, comp: 15, requirement: '3 patents filed' },                maxTier: { tier: 3, comp: 25 } }
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
        else if (o.path === 'GRANT-ELIGIBLE' && pb.realWorld && pb.realWorld.apply) target = pb.realWorld.apply;
        else if (o.path === 'PATENTABLE' && pb.realWorld && pb.realWorld.build) target = pb.realWorld.build;
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
  IndustryBrain.prototype.cycle = function () { var self = this; return _origCycle.call(this).then(function () { return self.resolveDeepContent(); }); };

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
