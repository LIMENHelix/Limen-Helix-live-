/**
 * education-brain.js — Education Domain Cognitive Engine
 *
 * Portal issues: FUNDING_CRISIS, TEACHER_SHORTAGE, ACHIEVEMENT_GAP,
 *                ACCREDITATION_FAILURE, TECHNOLOGY_DISRUPTION
 *
 * Emissions: economy, governance, population, technology, culture
 * Exposes: window.LIMENEducationBrain
 */
(function () {
  'use strict';
  if (!window.LIMENDomainBrainBase) { console.warn('[EducationBrain] Base not loaded'); return; }
  var Base = window.LIMENDomainBrainBase;

  function EducationBrain() {
    Base.call(this, { domainId: 'education', label: 'Education', snapshotKey: 'education', cycleInterval: 30000 });
  }
  EducationBrain.prototype = Object.create(Base.prototype);
  EducationBrain.prototype.constructor = EducationBrain;

  EducationBrain.prototype.init = function () {
    Base.prototype.init.call(this);

    this.diagnosisIndex = {
      'FUNDING_CRISIS':           ['budget_shortfall', 'resource_scarcity', 'institutional_decline', 'infrastructure_degradation', 'education_high_stress', 'structural_stress'],
      'TEACHER_SHORTAGE':         ['workforce_gap', 'retention_failure', 'recruitment_deficit', 'burnout_epidemic', 'education_high_stress'],
      'ACHIEVEMENT_GAP':          ['outcome_disparity', 'access_inequality', 'performance_decline', 'equity_failure', 'structural_stress'],
      'ACCREDITATION_FAILURE':    ['quality_degradation', 'standards_erosion', 'oversight_failure', 'credential_devaluation', 'institutional_decline'],
      'TECHNOLOGY_DISRUPTION':    ['digital_divide', 'platform_transition', 'pedagogical_mismatch', 'automation_displacement', 'adaptive_failure']
    };

    this.emissionRules = [
      { targetDomain: 'economy', signalType: 'workforce_preparation_gap', condition: function (s) { return s.stress >= 0.20; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.55); } },
      { targetDomain: 'governance', signalType: 'education_policy_pressure', condition: function (s) { return s.stress >= 0.25; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); } },
      { targetDomain: 'population', signalType: 'human_capital_strain', condition: function (s) { return s.stress >= 0.30; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); } },
      { targetDomain: 'technology', signalType: 'edtech_demand_pressure', condition: function (s) { return s.stress >= 0.30; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.4); } },
      { targetDomain: 'culture', signalType: 'knowledge_transmission_strain', condition: function (s) { return s.stress >= 0.35; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.4); } }
    ];
  };

  EducationBrain.prototype.normalizeSignals = function () {
    var signals = [], rawSignals = (this._rawDomain && this._rawDomain.signals) || [];
    for (var i = 0; i < rawSignals.length; i++) signals.push(rawSignals[i]);
    this._activeConditions = [];

    // Long-arc baseline — education always has achievement and access pressure
    this._activeConditions.push('outcome_disparity');
    this._activeConditions.push('access_inequality');
    signals.push('BASELINE: Persistent educational achievement and access equity pressure');

    var feeds = this.state.feeds;
    for (var fi = 0; fi < feeds.length; fi++) {
      var f = feeds[fi], fn = (f.name || '').toLowerCase();
      if ((fn.indexOf('world bank education') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('institutional_decline');
        signals.push('FEED: World Bank education signal — ' + (f.label || f.value));
      }
      if ((fn.indexOf('openal') !== -1 || fn.indexOf('institution') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('quality_degradation');
        signals.push('FEED: OpenAlex institutional research signal — ' + (f.label || f.value));
      }
      if (fn.indexOf('ed.gov') !== -1 && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('policy_pressure');
        if (f.value >= 8) this._activeConditions.push('budget_shortfall');
        signals.push('FEED: U.S. Dept of Education policy signal — ' + (f.label || f.value));
      }
      if (fn.indexOf('nces') !== -1 && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('performance_decline');
        if (f.value >= 5) this._activeConditions.push('equity_failure');
        signals.push('FEED: NCES statistics signal — ' + (f.label || f.value));
      }
      if (fn.indexOf('edweek') !== -1 && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('workforce_gap');
        if (f.value >= 10) this._activeConditions.push('retention_failure');
        signals.push('FEED: EdWeek news signal — ' + (f.label || f.value));
      }
      if (fn.indexOf('ies') !== -1 && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('standards_erosion');
        signals.push('FEED: IES research signal — ' + (f.label || f.value));
      }
      if (fn.indexOf('chronicle') !== -1 && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('institutional_decline');
        if (f.value >= 8) this._activeConditions.push('credential_devaluation');
        signals.push('FEED: Chronicle of Higher Ed signal — ' + (f.label || f.value));
      }
    }

    for (var rsi = 0; rsi < rawSignals.length; rsi++) {
      var rs = (typeof rawSignals[rsi] === 'string' ? rawSignals[rsi] : '').toLowerCase();
      if (rs.indexOf('funding') !== -1 || rs.indexOf('budget') !== -1 || rs.indexOf('cut') !== -1) {
        if (this._activeConditions.indexOf('budget_shortfall') === -1) this._activeConditions.push('budget_shortfall');
        if (this._activeConditions.indexOf('resource_scarcity') === -1) this._activeConditions.push('resource_scarcity');
      }
      if (rs.indexOf('teacher') !== -1 || rs.indexOf('shortage') !== -1 || rs.indexOf('staffing') !== -1) {
        if (this._activeConditions.indexOf('workforce_gap') === -1) this._activeConditions.push('workforce_gap');
        if (this._activeConditions.indexOf('retention_failure') === -1) this._activeConditions.push('retention_failure');
      }
      if (rs.indexOf('achievement') !== -1 || rs.indexOf('test score') !== -1 || rs.indexOf('literacy') !== -1 || rs.indexOf('dropout') !== -1) {
        if (this._activeConditions.indexOf('performance_decline') === -1) this._activeConditions.push('performance_decline');
        if (this._activeConditions.indexOf('equity_failure') === -1) this._activeConditions.push('equity_failure');
      }
      if (rs.indexOf('accredit') !== -1 || rs.indexOf('credential') !== -1 || rs.indexOf('diploma') !== -1) {
        if (this._activeConditions.indexOf('standards_erosion') === -1) this._activeConditions.push('standards_erosion');
        if (this._activeConditions.indexOf('credential_devaluation') === -1) this._activeConditions.push('credential_devaluation');
      }
      if (rs.indexOf('online') !== -1 || rs.indexOf('edtech') !== -1 || rs.indexOf('ai') !== -1 || rs.indexOf('digital') !== -1) {
        if (this._activeConditions.indexOf('digital_divide') === -1) this._activeConditions.push('digital_divide');
        if (this._activeConditions.indexOf('platform_transition') === -1) this._activeConditions.push('platform_transition');
      }
    }

    var snap = this._getSnapshot();
    if (snap && snap.defenseSignals) {
      for (var si = 0; si < snap.defenseSignals.length; si++) {
        var sig = snap.defenseSignals[si];
        if (sig.affectedDomains && sig.affectedDomains.indexOf('education') !== -1) {
          this._activeConditions.push(sig.eventType);
          signals.push('FEED [DEFENSE]: ' + (sig.eventType || '').replace(/_/g, ' '));
        }
      }
    }
    if (snap && snap.macroShock && snap.macroShock.detected) this._activeConditions.push('macro_shock');

    if (window.LIMENDomainBrains) {
      var allBrains = window.LIMENDomainBrains.getAll();
      for (var bk in allBrains) {
        if (bk === 'education') continue;
        var b = allBrains[bk]; if (!b || !b.state) continue;
        var bEm = b.state.crossDomainEmissions || [];
        for (var bei = 0; bei < bEm.length; bei++) {
          var be = bEm[bei];
          if (be.targetDomain === 'education' && be.magnitude > 0.1) {
            signals.push('FEED [' + bk.toUpperCase() + ']: ' + (be.signal || '').replace(/_/g, ' ') + ' — ' + Math.round(be.magnitude * 100) + '%');
          }
        }
      }
    }

    if (this.state.stress >= 0.20) { this._activeConditions.push('infrastructure_degradation'); this._activeConditions.push('burnout_epidemic'); }
    if (this.state.stress >= 0.35) { this._activeConditions.push('recruitment_deficit'); this._activeConditions.push('pedagogical_mismatch'); }
    if (this.state.stress >= 0.50) { this._activeConditions.push('education_high_stress'); this._activeConditions.push('automation_displacement'); }
    if (this.state.stress >= 0.60) { this._activeConditions.push('oversight_failure'); this._activeConditions.push('adaptive_failure'); }
    if (this.state.maturity === 'STRUCTURAL') this._activeConditions.push('structural_stress');
    var extPressure = this.getExternalPressure ? this.getExternalPressure() : 0;
    if (extPressure >= 0.10) this._activeConditions.push('resource_scarcity');
    if (extPressure >= 0.20) this._activeConditions.push('workforce_gap');

    this.state.signals = signals;
    return Promise.resolve();
  };

  EducationBrain.prototype.deriveDiagnoses = function () {
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

  EducationBrain.prototype.recommendTreatments = function () {
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

  EducationBrain.prototype.surfaceOpportunities = function () {
    Base.prototype.surfaceOpportunities.call(this);
    var opps = [], stress = this.state.stress, activeDx = this.state.diagnoses.filter(function (d) { return d.active; }), allDx = this.state.diagnoses || [], companies = this.state.companies, seen = {};
    function add(o) { var key = o.title.toLowerCase().replace(/[^a-z0-9]/g, ''); if (seen[key]) return; seen[key] = true; opps.push(o); }

    for (var di = 0; di < activeDx.length; di++) {
      var dx = activeDx[di], dxLabel = (dx.label || dx.id || '').replace(/_/g, ' ');
      add({ title: dxLabel + ' — educational technology and adaptive learning', rank: stress * dx.relevance, path: 'INVESTABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.50) add({ title: dxLabel + ' — institutional capacity and workforce development', rank: stress * dx.relevance * 0.9, path: 'GRANT-ELIGIBLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.55 && dx.relevance >= 0.2) add({ title: dxLabel + ' — equity and access infrastructure', rank: stress * 0.85, path: 'GRANT-ELIGIBLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      add({ title: dxLabel + ' — credentialing and quality assurance systems', rank: stress * dx.relevance * 0.75, path: 'PATENTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
    }

    var termCo = companies.filter(function (c) { return c.phase === 'p7a' || c.phase === 'p9'; });
    if (termCo.length > 0) add({ title: 'Education terminal entity distressed positioning', rank: 0.95, path: 'INVESTABLE', urgency: 'high', source: 'company_terminal', tier: 1, companies: termCo.map(function (c) { return c.ticker; }), stress: stress });
    if (this.state.convergence && this.state.convergence.primary_signal) add({ title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — education convergence response', rank: 0.98, path: 'GRANT-ELIGIBLE', urgency: 'high', source: 'convergence', tier: 1, stress: stress });

    var emissions = this.state.crossDomainEmissions || [];
    for (var ei = 0; ei < emissions.length; ei++) { var em = emissions[ei]; add({ title: 'Education \u2192 ' + (em.targetDomain || '').replace(/_/g, ' ') + ' — ' + (em.signal || em.signalType || '').replace(/_/g, ' '), rank: (em.magnitude || 0.5) * stress * 0.8, path: 'INVESTABLE', urgency: em.magnitude > 0.6 ? 'high' : 'medium', source: 'cross_domain', tier: 2, stress: stress }); }

    if (stress >= 0.50) {
      add({ title: 'Teacher recruitment and retention systems', rank: stress * 0.70, path: 'GRANT-ELIGIBLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'teacher_retain', stress: stress });
      add({ title: 'Digital literacy and access equity programs', rank: stress * 0.65, path: 'GRANT-ELIGIBLE', urgency: stress > 0.70 ? 'medium' : 'watching', source: 'lagging', tier: 3, diagnosisId: 'digital_access', stress: stress });
    }
    if (stress >= 0.60) {
      add({ title: 'Curriculum modernization and skills alignment', rank: stress * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'curriculum_mod', stress: stress });
      add({ title: 'Alternative credentialing and micro-certification', rank: stress * 0.72, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'alt_credential', stress: stress });
      add({ title: 'School infrastructure and facility modernization', rank: stress * 0.68, path: 'GRANT-ELIGIBLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'school_infra', stress: stress });
    }

    var nearDx = allDx.filter(function (d) { return !d.active && d.relevance > 0 && d.totalTriggers > 0; });
    for (var ndi = 0; ndi < nearDx.length; ndi++) { if (stress >= 0.45) add({ title: (nearDx[ndi].label || '').replace(/_/g, ' ') + ' — early-stage monitoring', rank: stress * (nearDx[ndi].relevance || 0.1) * 0.5, path: 'PATENTABLE', urgency: 'watching', source: 'near_diagnosis', tier: 2, stress: stress, nearDiagnosisId: nearDx[ndi].id }); }

    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });
    // Canonical enrichment — merge education playbook detail per opportunity
    var PB_LIST = window.LIMENEducationOpportunityPlaybooks || [];
    var _byId = {};
    for (var _pbi = 0; _pbi < PB_LIST.length; _pbi++) _byId[PB_LIST[_pbi].id] = PB_LIST[_pbi];
    var _PB_MAP = {
      'FUNDING_CRISIS': 'funding_crisis',
      'TEACHER_SHORTAGE': 'teacher_shortage',
      'ACHIEVEMENT_GAP': 'achievement_gap',
      'ACCREDITATION_FAILURE': 'accreditation_failure',
      'TECHNOLOGY_DISRUPTION': 'technology_disruption'
    };
    var _LAGGING_MAP = {
      'teacher_retain': 'teacher_shortage',
      'digital_access': 'achievement_gap',
      'curriculum_mod': 'technology_disruption',
      'alt_credential': 'accreditation_failure',
      'school_infra': 'funding_crisis'
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
      o.domain = 'education';
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
        var evidenceParts = ['Domain: education', 'Stress: ' + stressPct + '%'];
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

  EducationBrain.prototype._checkDiagnosisActions = function () {
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; }); if (activeDx.length === 0) return;
    var adapters = window.LIMENActionAdapters; if (!adapters) return;
    for (var i = 0; i < activeDx.length; i++) { var dx = activeDx[i]; if (adapters.getDrafts && adapters.getDrafts({ domain: 'education', intentId: dx.id }).length > 0) continue; adapters.createDraft('REPORT_GENERATION', { domain: 'education', sourceType: 'domain_brain', sourceId: dx.id, intentId: dx.id, title: 'Education Alert: ' + dx.label, intent: { domain: 'education', title: dx.label, status: 'ACTIVE', priority: this.state.stress, progress: 0, strategyType: 'diagnosis_response', steps: [{ type: 'ANALYZE', label: 'Assess ' + dx.label + ' impact on education systems', status: 'PENDING' }, { type: 'INVESTIGATE', label: 'Identify affected institutions, students, and communities', status: 'PENDING' }, { type: 'POSITION', label: 'Evaluate reform and capacity opportunities', status: 'PENDING' }] } }); }
  };

  EducationBrain.prototype.resolveDeepContent = function () {
    var self = this; var resolver = window.LIMENPortalContentResolver; if (!resolver) return Promise.resolve();
    return resolver.resolveForBrain(this.state).then(function (content) { self.state.resolvedContent = content; if (content) { var dt = []; for (var dxId in content.byDiagnosis) { var dxC = content.byDiagnosis[dxId]; for (var i = 0; i < dxC.treatments.length; i++) { var t = dxC.treatments[i]; dt.push({ id: 'deep_' + t.nodeId + '_' + i, label: t.label, type: t.type, evidence: t.evidence, description: t.description, cite: t.cite, steps: t.steps, monitoring: t.monitoring, escalation: t.escalation, diagnosisId: dxId, nodeId: t.nodeId, nodeLabel: t.nodeLabel, hasDepth: t.hasDepth, source: 'canonical_deep' }); } } if (dt.length > 0) self.state.treatments = dt; } }).catch(function () {});
  };

  var _origCycle = EducationBrain.prototype.cycle;
  EducationBrain.prototype.cycle = function () { var self = this; return _origCycle.call(this).then(function () { return self.resolveDeepContent(); }); };

  var brain = new EducationBrain(); brain.init(); brain.start();
  window.LIMENEducationBrain = brain;
  window.LIMENDomainBrains.register(brain);

  // ══════════════════════════════════════════════════════════════════════
  // AUTO-LOAD EDUCATION OPERATOR STACK ON DOMAIN-CONSOLE
  // ══════════════════════════════════════════════════════════════════════

  var _isDomainConsole = window.location.pathname.indexOf('domain-console') !== -1 || window.location.pathname.indexOf('education-console') !== -1;
  var _domParam = (new URLSearchParams(window.location.search)).get('domain');
  var _isEducationDomain = _domParam === 'education';
  if (_isDomainConsole && _isEducationDomain) {
    window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION = true;

    var _educationScripts = [
      'assets/js/education-compensation.js',
      'assets/js/education-claim-ledger.js',
      'assets/js/education-claim-flow.js',
      'assets/js/education-opportunity-economics.js',
      'assets/js/education-pulse-engine.js',
      'assets/js/education-operator-panel.js',
      'assets/js/education-node-business-engine.js',
      'assets/js/education-business-review.js',
      'assets/js/education-execution-panels.js',
      'assets/js/education-business-build.js',
      'assets/js/education-directive-extractor.js',
      'assets/js/education-directive-ranker.js',
      'assets/js/education-directive-translator.js',
      'assets/js/education-targeting-engine.js',
      'assets/js/education-promotion-bridge.js',
      'assets/js/education-clarity-operator.js'
    ];
    (function loadNext(i) {
      if (i >= _educationScripts.length) return;
      var s = document.createElement('script');
      s.src = _educationScripts[i];
      s.onload = function () { loadNext(i + 1); };
      s.onerror = function () { console.warn('[EducationBrain] Failed to load ' + _educationScripts[i]); loadNext(i + 1); };
      document.head.appendChild(s);
    })(0);
  }
})();
