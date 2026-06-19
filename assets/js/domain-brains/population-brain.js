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
    Base.call(this, { domainId: 'population', label: 'Population', snapshotKey: 'population', cycleInterval: 30000 });
  }
  PopulationBrain.prototype = Object.create(Base.prototype);
  PopulationBrain.prototype.constructor = PopulationBrain;

  PopulationBrain.prototype.init = function () {
    Base.prototype.init.call(this);

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

    if (this.state.stress >= 0.30) { this._activeConditions.push('demographic_distortion'); this._activeConditions.push('service_overload'); }
    if (this.state.stress >= 0.45) { this._activeConditions.push('workforce_imbalance'); this._activeConditions.push('infrastructure_strain'); }
    if (this.state.stress >= 0.55) { this._activeConditions.push('population_high_stress'); this._activeConditions.push('urban_influx'); }
    if (this.state.stress >= 0.65) { this._activeConditions.push('healthcare_overload'); this._activeConditions.push('access_inequality'); }
    if (this.state.maturity === 'STRUCTURAL') this._activeConditions.push('structural_stress');
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
      add({ title: dxLabel + ' — population analytics and planning systems', rank: stress * dx.relevance, path: 'PATENTABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.50) add({ title: dxLabel + ' — healthcare and service capacity expansion', rank: stress * dx.relevance * 0.9, path: 'GRANT-ELIGIBLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.55 && dx.relevance >= 0.2) add({ title: dxLabel + ' — workforce optimization and labor mobility', rank: stress * 0.85, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      add({ title: dxLabel + ' — housing and urban development infrastructure', rank: stress * dx.relevance * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
    }

    var termCo = [] /* neutralized: distress only from validated gate (see energy-brain) */;
    if (termCo.length > 0) add({ title: 'Population terminal entity distressed positioning', rank: 0.95, path: 'INVESTABLE', urgency: 'high', source: 'company_terminal', tier: 1, companies: termCo.map(function (c) { return c.ticker; }), stress: stress });
    if (this.state.convergence && this.state.convergence.primary_signal) add({ title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — population convergence response', rank: 0.98, path: 'GRANT-ELIGIBLE', urgency: 'high', source: 'convergence', tier: 1, stress: stress });

    var emissions = this.state.crossDomainEmissions || [];
    for (var ei = 0; ei < emissions.length; ei++) { var em = emissions[ei]; add({ title: 'Population \u2192 ' + (em.targetDomain || '').replace(/_/g, ' ') + ' — ' + (em.signal || em.signalType || '').replace(/_/g, ' '), rank: (em.magnitude || 0.5) * stress * 0.8, path: 'INVESTABLE', urgency: em.magnitude > 0.6 ? 'high' : 'medium', source: 'cross_domain', tier: 2, stress: stress }); }

    if (stress >= 0.50) {
      add({ title: 'Migration integration and settlement systems', rank: stress * 0.70, path: 'GRANT-ELIGIBLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'migration_integration', stress: stress });
      add({ title: 'Demographic monitoring and early warning platforms', rank: stress * 0.65, path: 'PATENTABLE', urgency: stress > 0.70 ? 'medium' : 'watching', source: 'lagging', tier: 3, diagnosisId: 'demographic_monitoring', stress: stress });
    }
    if (stress >= 0.60) {
      add({ title: 'Elder care and pension system modernization', rank: stress * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'elder_care', stress: stress });
      add({ title: 'Urban density management and decentralization', rank: stress * 0.72, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'urban_density', stress: stress });
      add({ title: 'Preventive public health and outbreak response systems', rank: stress * 0.68, path: 'GRANT-ELIGIBLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'public_health', stress: stress });
    }

    var nearDx = allDx.filter(function (d) { return !d.active && d.relevance > 0 && d.totalTriggers > 0; });
    for (var ndi = 0; ndi < nearDx.length; ndi++) { if (stress >= 0.45) add({ title: (nearDx[ndi].label || '').replace(/_/g, ' ') + ' — early-stage monitoring', rank: stress * (nearDx[ndi].relevance || 0.1) * 0.5, path: 'PATENTABLE', urgency: 'watching', source: 'near_diagnosis', tier: 2, stress: stress, nearDiagnosisId: nearDx[ndi].id }); }

    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });

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
      'GRANT-ELIGIBLE': { type: 'grant',  base: 10, unit: '%',        tier: 1, nextTier: { tier: 2, comp: 15, requirement: '3 successful grant awards' },     maxTier: { tier: 3, comp: 25 } },
      'INVESTABLE':     { type: 'invest', base: 5,  unit: 'profit%',  tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
      'PATENTABLE':     { type: 'patent', base: 10, unit: 'royalty%', tier: 1, nextTier: { tier: 2, comp: 15, requirement: '3 patents filed' },                maxTier: { tier: 3, comp: 25 } }
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
        else if (o.path === 'GRANT-ELIGIBLE' && pb.realWorld && pb.realWorld.apply) target = pb.realWorld.apply;
        else if (o.path === 'PATENTABLE' && pb.realWorld && pb.realWorld.build) target = pb.realWorld.build;
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

    this.state.opportunities = opps;
    this.state.opportunityCount = opps.length;
    return Promise.resolve();
  };

  PopulationBrain.prototype._checkDiagnosisActions = function () {
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; }); if (activeDx.length === 0) return;
    var adapters = window.LIMENActionAdapters; if (!adapters) return;
    for (var i = 0; i < activeDx.length; i++) { var dx = activeDx[i]; if (adapters.getDrafts && adapters.getDrafts({ domain: 'population', intentId: dx.id }).length > 0) continue; adapters.createDraft('REPORT_GENERATION', { domain: 'population', sourceType: 'domain_brain', sourceId: dx.id, intentId: dx.id, title: 'Population Alert: ' + dx.label, intent: { domain: 'population', title: dx.label, status: 'ACTIVE', priority: this.state.stress, progress: 0, strategyType: 'diagnosis_response', steps: [{ type: 'ANALYZE', label: 'Assess ' + dx.label + ' impact on population systems', status: 'PENDING' }, { type: 'INVESTIGATE', label: 'Identify affected demographics and regions', status: 'PENDING' }, { type: 'POSITION', label: 'Evaluate intervention opportunities', status: 'PENDING' }] } }); }
  };

  PopulationBrain.prototype.resolveDeepContent = function () {
    var self = this; var resolver = window.LIMENPortalContentResolver; if (!resolver) return Promise.resolve();
    return resolver.resolveForBrain(this.state).then(function (content) { self.state.resolvedContent = content; if (content) { var dt = []; for (var dxId in content.byDiagnosis) { var dxC = content.byDiagnosis[dxId]; for (var i = 0; i < dxC.treatments.length; i++) { var t = dxC.treatments[i]; dt.push({ id: 'deep_' + t.nodeId + '_' + i, label: t.label, type: t.type, evidence: t.evidence, description: t.description, cite: t.cite, steps: t.steps, monitoring: t.monitoring, escalation: t.escalation, diagnosisId: dxId, nodeId: t.nodeId, nodeLabel: t.nodeLabel, hasDepth: t.hasDepth, source: 'canonical_deep' }); } } if (dt.length > 0) self.state.treatments = dt; } }).catch(function () {});
  };

  var _origCycle = PopulationBrain.prototype.cycle;
  PopulationBrain.prototype.cycle = function () { var self = this; return _origCycle.call(this).then(function () { return self.resolveDeepContent(); }); };

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
