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
      if (stress >= 0.50) add({ title: dxLabel + ' — institutional capacity and workforce development', rank: stress * dx.relevance * 0.9, path: 'INVESTABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.55 && dx.relevance >= 0.2) add({ title: dxLabel + ' — equity and access infrastructure', rank: stress * 0.85, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      add({ title: dxLabel + ' — credentialing and quality assurance systems', rank: stress * dx.relevance * 0.75, path: 'RESEARCHABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
    }

    var termCo = [] /* neutralized: distress only from validated gate (see energy-brain) */;
    if (termCo.length > 0) add({ title: 'Education terminal entity distressed positioning', rank: 0.95, path: 'INVESTABLE', urgency: 'high', source: 'company_terminal', tier: 1, companies: termCo.map(function (c) { return c.ticker; }), stress: stress });
    if (this.state.convergence && this.state.convergence.primary_signal) add({ title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — education convergence response', rank: 0.98, path: 'INVESTABLE', urgency: 'high', source: 'convergence', tier: 1, stress: stress });

    var emissions = this.state.crossDomainEmissions || [];
    for (var ei = 0; ei < emissions.length; ei++) { var em = emissions[ei]; add({ title: 'Education \u2192 ' + (em.targetDomain || '').replace(/_/g, ' ') + ' — ' + (em.signal || em.signalType || '').replace(/_/g, ' '), rank: (em.magnitude || 0.5) * stress * 0.8, path: 'INVESTABLE', urgency: em.magnitude > 0.6 ? 'high' : 'medium', source: 'cross_domain', tier: 2, stress: stress }); }

    if (stress >= 0.50) {
      add({ title: 'Teacher recruitment and retention systems', rank: stress * 0.70, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'teacher_retain', stress: stress });
      add({ title: 'Digital literacy and access equity programs', rank: stress * 0.65, path: 'INVESTABLE', urgency: stress > 0.70 ? 'medium' : 'watching', source: 'lagging', tier: 3, diagnosisId: 'digital_access', stress: stress });
    }
    if (stress >= 0.60) {
      add({ title: 'Curriculum modernization and skills alignment', rank: stress * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'curriculum_mod', stress: stress });
      add({ title: 'Alternative credentialing and micro-certification', rank: stress * 0.72, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'alt_credential', stress: stress });
      add({ title: 'School infrastructure and facility modernization', rank: stress * 0.68, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'school_infra', stress: stress });
    }

    var nearDx = allDx.filter(function (d) { return !d.active && d.relevance > 0 && d.totalTriggers > 0; });
    for (var ndi = 0; ndi < nearDx.length; ndi++) { if (stress >= 0.45) add({ title: (nearDx[ndi].label || '').replace(/_/g, ' ') + ' — early-stage monitoring', rank: stress * (nearDx[ndi].relevance || 0.1) * 0.5, path: 'RESEARCHABLE', urgency: 'watching', source: 'near_diagnosis', tier: 2, stress: stress, nearDiagnosisId: nearDx[ndi].id }); }

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
    // Lanes: investment + research ONLY (grant/patent/loan purged 2026-06-21; GRANT-ELIGIBLE→INVESTABLE, PATENTABLE→RESEARCHABLE)
    var _COMP = {
      'INVESTABLE':   { type: 'invest',   base: 5, unit: 'profit%', tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
      'RESEARCHABLE': { type: 'research', base: 5, unit: 'credit%', tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 published research briefs' },    maxTier: { tier: 3, comp: 15 } }
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
        else if (o.path === 'RESEARCHABLE' && pb.realWorld && (pb.realWorld.research || pb.realWorld.build)) target = pb.realWorld.research || pb.realWorld.build;
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
  EducationBrain.prototype.cycle = function () {
    var self = this;
    return _origCycle.call(this).then(function () {
      return self.resolveDeepContent();
    }).then(function () {
      // Recurrent loop step — END of each cycle. Reads the prior produced by the
      // PREVIOUS cycle, computes prediction error, regulates, runs the higher layers,
      // assigns state.cognition, and builds the per-diagnosis DDPs. Education-local +
      // try/caught (never breaks a cycle).
      try { self._loadLearningOutcomesLayer(); } catch (e) {}
      try { self._updateEducationModel(); } catch (e) {}
    });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // EDUCATION RECURRENT LOOP + HIGHER LAYERS + DDP (energy-brain parity port)
  //   prior -> observation -> prediction error -> bounded update -> next prior.
  // Proof surface: window.LIMENEducationBrain.state.educationModel
  // Identity: schools & universities (K-12 + higher ed), edtech & online learning,
  // student outcomes & literacy, teaching & curriculum, funding & access/equity,
  // workforce training & skills, credentialing & enrollment, student debt.
  // ════════════════════════════════════════════════════════════════════════════
  var ED_VERSION = 1;
  var ED_LEARNING_RATE = 0.25;          // bounded plasticity (fast inference — enrollment/funding signals)
  var ED_SLOW_RATE = 0.08;              // slow consolidation (demographic shifts; reserved for rebuild/cron)
  var ED_STRESS_FLOOR = 0.30;           // below this → no handoff
  var ED_FLOOD_CAP = 12;                // concurrent-crisis / opportunity-flood threshold
  var ED_STALE_MS = 1000 * 60 * 60 * 6; // 6h feed staleness

  function _edClamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function _edJaccardDistance(a, b) {
    a = a || []; b = b || [];
    if (a.length === 0 && b.length === 0) return 0;
    var union = {}, inter = 0, setB = {}, seen = {};
    for (var i = 0; i < b.length; i++) { setB[b[i]] = true; union[b[i]] = true; }
    for (var j = 0; j < a.length; j++) { union[a[j]] = true; if (setB[a[j]] && !seen[a[j]]) { inter++; seen[a[j]] = true; } }
    var u = Object.keys(union).length;
    return u === 0 ? 0 : 1 - (inter / u);
  }

  EducationBrain.prototype._neutralEducationModel = function () {
    return {
      version: ED_VERSION, cycle: 0,
      prior: { expectedStress: 0.5, expectedDiagnoses: [], expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, confidence: 0, samples: 0 },
      observation: null, predictionError: null, predictedStress: null,
      plasticity: { learningRate: ED_LEARNING_RATE, slowRate: ED_SLOW_RATE, consolidation: 'cycle-light/rebuild-heavy' },
      regulation: null, readyForHandoff: false, _lowErrorStreak: 0
    };
  };

  // Count of distinct institutional education feeds (ED.gov, NCES, IES, EdWeek,
  // World Bank education, Chronicle of Higher Ed, OpenAlex)
  EducationBrain.prototype._educationFeedSignalCount = function () {
    var feeds = this.state.feeds || [];
    var arr = Array.isArray(feeds) ? feeds : Object.keys(feeds).map(function (k) { return feeds[k]; });
    var keys = ['ed.gov', 'nces', 'ies', 'edweek', 'world bank education', 'chronicle', 'openal', 'enrollment', 'graduation', 'funding'];
    var hit = {};
    for (var i = 0; i < arr.length; i++) {
      var f = arr[i]; if (!f) continue;
      var nm = (f.name || '').toLowerCase();
      for (var k = 0; k < keys.length; k++) { if (nm.indexOf(keys[k]) !== -1 && f.value !== undefined && f.value !== null) { hit[keys[k]] = true; break; } }
    }
    return { count: Object.keys(hit).length, total: keys.length };
  };

  // B2 — normalized observation from current Education state
  EducationBrain.prototype._buildEducationObservation = function () {
    var s = this.state || {};
    var active = (s.diagnoses || []).filter(function (d) { return d.active; });
    var fc = this._educationFeedSignalCount();
    var feeds = s.feeds || [];
    var arr = Array.isArray(feeds) ? feeds : Object.keys(feeds).map(function (k) { return feeds[k]; });
    var newest = 0;
    for (var i = 0; i < arr.length; i++) { var u = arr[i] && arr[i].updated; if (u && u > newest) newest = u; }
    var stress = typeof s.stress === 'number' ? s.stress : 0;
    var signal = Math.max(stress, fc.total ? fc.count / fc.total : 0);
    return {
      educationStress: stress,
      stress: stress,
      phase: s.phase || null,
      activeDiagnoses: active.map(function (d) { return d.id; }).sort(),
      activeDiagnosisCount: active.length,
      diagnosisCount: active.length,
      enrollmentMetrics: { feedCount: fc.count, feedTotal: fc.total },
      teacherRetentionRate: null,   // honest null — no live HR feed yet
      fundingGap: null,             // honest null — no live appropriations feed yet
      opportunityCount: (s.opportunities || []).length,
      companyCount: (s.companies || []).length,
      signal: _edClamp(signal, 0, 1),
      feedNewest: newest,
      timestamp: Date.now()
    };
  };

  // B3 — prediction error: prior.expected* vs observation (pure arithmetic; no evidence scoring)
  EducationBrain.prototype._computeEducationPredictionError = function (prior, obs) {
    var stressError = Math.abs(obs.stress - prior.expectedStress);
    var signalError = Math.abs(obs.signal - prior.expectedSignal);
    var diagnosisError = _edJaccardDistance(obs.activeDiagnoses, prior.expectedDiagnoses);
    var oppDenom = Math.max(1, prior.expectedOpportunityCount, obs.opportunityCount);
    var opportunityError = Math.abs(obs.opportunityCount - prior.expectedOpportunityCount) / oppDenom;
    var total = _edClamp(0.4 * stressError + 0.2 * signalError + 0.25 * diagnosisError + 0.15 * opportunityError, 0, 1);
    var novelty = _edClamp(Math.max(stressError, diagnosisError), 0.05, 0.95);
    return { total: total, stressError: stressError, signalError: signalError, diagnosisError: diagnosisError, opportunityError: opportunityError, novelty: novelty };
  };

  // B4 — bounded prior update toward observation (next cycle reads this)
  EducationBrain.prototype._updateEducationPrior = function (prior, obs, lr) {
    return {
      expectedStress: _edClamp(prior.expectedStress + lr * (obs.stress - prior.expectedStress), 0, 1),
      expectedDiagnoses: obs.activeDiagnoses.slice(),
      expectedDiagnosisCount: prior.expectedDiagnosisCount + lr * (obs.diagnosisCount - prior.expectedDiagnosisCount),
      expectedOpportunityCount: prior.expectedOpportunityCount + lr * (obs.opportunityCount - prior.expectedOpportunityCount),
      expectedSignal: _edClamp(prior.expectedSignal + lr * (obs.signal - prior.expectedSignal), 0, 1),
      confidence: _edClamp(Math.min(1, (prior.samples + 1) / 20), 0, 1),
      samples: prior.samples + 1
    };
  };

  // B5 — homeostatic regulation: gain / inhibition / state machine.
  // States: starving (unmet demand), flooding (too many concurrent crises),
  // looping (converged/stable), stale (stale feeds), surprised (novel conditions).
  EducationBrain.prototype._computeEducationRegulation = function (em, obs, pe) {
    var gain = _edClamp(pe.novelty, 0.05, 0.95);
    var inhibition = _edClamp(1 - pe.novelty, 0, 0.9);
    var outputScale = _edClamp(1 - inhibition * 0.5, 0.4, 1);
    var starving = obs.stress >= ED_STRESS_FLOOR && obs.opportunityCount === 0;
    var flooding = obs.opportunityCount > ED_FLOOD_CAP || obs.activeDiagnosisCount > ED_FLOOD_CAP;
    var stale = obs.feedNewest > 0 ? (Date.now() - obs.feedNewest) > ED_STALE_MS : false;
    var diagMismatch = _edJaccardDistance(obs.activeDiagnoses, em.prior.expectedDiagnoses) > 0.5;
    var surprised = pe.novelty > 0.6 && diagMismatch;
    var streak = (pe.total < 0.05) ? (em._lowErrorStreak || 0) + 1 : 0;
    em._lowErrorStreak = streak;
    var looping = streak >= 3;
    var overconfident = em.prior.confidence > 0.8 && pe.total > 0.4;
    var label = flooding ? 'flooding' : starving ? 'starving' : stale ? 'stale' : surprised ? 'surprised' : looping ? 'looping' : overconfident ? 'overconfident' : pe.novelty > 0.4 ? 'surprised' : 'calm';
    return { gain: gain, inhibition: inhibition, outputScale: outputScale, starving: starving, flooding: flooding, stale: stale, surprised: surprised, looping: looping, overconfident: overconfident, state: label };
  };

  // The recurrent step — END of each cycle. cycle N+1's interpretation depends on cycle N.
  EducationBrain.prototype._updateEducationModel = function () {
    var em = this.state.educationModel || this._neutralEducationModel();
    var priorIn = em.prior;                                            // carried from last cycle
    var obs = this._buildEducationObservation();
    var pe = this._computeEducationPredictionError(priorIn, obs);      // prior vs now

    // reads prior BEFORE the final decision (Kalman-style blend, not raw obs):
    var gainBlend = _edClamp(pe.novelty, 0.05, 0.95);
    var predictedStress = priorIn.expectedStress * (1 - gainBlend) + obs.stress * gainBlend;
    var reg = this._computeEducationRegulation(em, obs, pe);

    // a FINAL decision that depends on the prior, not just on raw obs:
    var readyForHandoff = (em.cycle > 0) && (predictedStress >= ED_STRESS_FLOOR) && (obs.diagnosisCount > 0) && !reg.flooding && !reg.stale;

    var nextPrior = this._updateEducationPrior(priorIn, obs, em.plasticity.learningRate);  // -> next cycle reads this

    em.cycle += 1;
    em.observation = obs;
    em.predictionError = pe;
    em.predictedStress = predictedStress;
    em.regulation = reg;
    em.readyForHandoff = readyForHandoff;
    em.prior = nextPrior;
    em.updated = obs.timestamp;
    this.state.educationModel = em;

    // H1-H6 — higher Education brain layers (computed BEFORE the DDP build so packets embed summaries).
    try { this._computeEducationHigherLayers(); } catch (e) {}

    // Learning-outcomes sub-layer (additive; BEFORE the DDP build so the primary packet advertises it).
    try { this._buildLearningOutcomesLayer(); } catch (e) {}

    // Generic cognition surface the console SELF-MODEL panel renders for ANY domain. MANDATORY.
    try {
      this.state.cognition = {
        domain: 'education',
        model: { cycle: em.cycle, predictionError: em.predictionError, predictedStress: em.predictedStress, regulation: em.regulation },
        awareness: this.state.educationAwareness || null,
        conscience: this.state.educationConscience || null,
        immune: this.state.educationImmune || null,
        intuition: this.state.educationIntuition || null
      };
    } catch (e) {}

    // Build the per-diagnosis DomainDiagnosisPackets (schema-only; never invents data).
    try {
      var _diags = this.state.diagnoses || [];
      var _primary = _diags.filter(function (d) { return d.active; })[0] || _diags[0] || null;
      var _self = this;
      this.state.educationDomainDiagnosisPacket = this._buildDomainDiagnosisPacket(_primary);
      this.state.educationDomainDiagnosisPackets = _diags.map(function (d) { return _self._buildDomainDiagnosisPacket(d); });
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
  // EMITTED RECURRENT MODEL — education lifecycle telemetry for Civilization /
  // domain-brain-adapter consumption (analogous to energyModel). Pure read of the
  // recurrent model + state; derived, never fabricated. Stored on state.educationModel
  // (already present) with this enriched lifecycle view under .lifecycle.
  // ════════════════════════════════════════════════════════════════════════════
  EducationBrain.prototype._educationLifecycleView = function () {
    var s = this.state || {}, em = s.educationModel || {}, reg = em.regulation || {}, prior = em.prior || {};
    var stress = typeof s.stress === 'number' ? s.stress : 0;
    var enforcement = (s.diagnoses || []).filter(function (d) { return d.active; }).length;
    var accessGap = (s.diagnoses || []).filter(function (d) { return d.active && (d.id === 'ACHIEVEMENT_GAP' || d.id === 'FUNDING_CRISIS'); }).length ? _edClamp(stress, 0, 1) : _edClamp(stress * 0.5, 0, 1);
    return {
      curriculumDeliveryPhase: _edClamp((em.cycle % 11) / 11, 0, 1),   // K-12 → higher ed → workforce cycle position
      pedagogicalAccessRegulation: {
        state: reg.state === 'flooding' || reg.state === 'surprised' ? 'restrictive' : reg.state === 'starving' ? 'permissive' : 'balanced',
        tightening: (em.predictedStress || 0) - (prior.expectedStress || 0),
        enforcement: enforcement
      },
      enrollmentCapacityRisk: _edClamp(stress * 0.7, 0, 1),
      credentialDevaluationRisk: (s.diagnoses || []).some(function (d) { return d.active && d.id === 'ACCREDITATION_FAILURE'; }) ? _edClamp(stress, 0, 1) : _edClamp(stress * 0.4, 0, 1),
      priorEducationHealth: { expectedStress: prior.expectedStress, confidence: prior.confidence, samples: prior.samples },
      enrollmentTrend: _edClamp(em.predictedStress || stress, 0, 1),
      studentOutcomeTrend: accessGap,
      credentialValueTrend: _edClamp(1 - stress, 0, 1),
      teacherCapacityTrend: (s.diagnoses || []).some(function (d) { return d.active && d.id === 'TEACHER_SHORTAGE'; }) ? _edClamp(stress, 0, 1) : _edClamp(stress * 0.4, 0, 1),
      accessEquityGap: accessGap,
      debtBurdenTrend: _edClamp(stress * 0.6, 0, 1),
      curriculumModernizationTrend: (s.diagnoses || []).some(function (d) { return d.active && d.id === 'TECHNOLOGY_DISRUPTION'; }) ? _edClamp(stress, 0, 1) : _edClamp(stress * 0.4, 0, 1),
      stemPipelineTrend: _edClamp(1 - stress * 0.5, 0, 1),
      readyForHandoff: em.readyForHandoff === true
    };
  };

  // ════════════════════════════════════════════════════════════════════════════
  // F3 — canonical diagnosis resolution (alias map). Prefers the global
  // window.LIMENArtifactSourceIndex.aliases() when present, else this local map.
  // Never asserts a bundle exists; only resolves an ID for fetch.
  // ════════════════════════════════════════════════════════════════════════════
  var EDUCATION_DIAGNOSIS_ALIASES = {
    FUNDING_CRISIS:          { target: 'EDUCATION_BUDGET_SHORTFALL', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits EDUCATION_BUDGET_SHORTFALL for appropriations/funding collapse' },
    TEACHER_SHORTAGE:        { target: 'EDUCATOR_WORKFORCE_GAP', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits EDUCATOR_WORKFORCE_GAP for staffing/retention scarcity' },
    ACHIEVEMENT_GAP:         { target: 'STUDENT_OUTCOME_DISPARITY', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits STUDENT_OUTCOME_DISPARITY for achievement/equity gaps' },
    ACCREDITATION_FAILURE:   { target: 'CREDENTIAL_QUALITY_EROSION', reviewStatus: 'human-approved', risk: 'medium', note: 'accreditation failure mapped to credential-quality bundle; verify scope before strong claims about specific institutions' },
    TECHNOLOGY_DISRUPTION:   { target: 'EDTECH_TRANSITION_EVENT', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits EDTECH_TRANSITION_EVENT for digital/platform transitions' }
  };
  EducationBrain.prototype._resolveCanonicalDiagnosis = function (dxId) {
    if (!dxId) return { canonicalDiagnosisId: null, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };
    var target = null;
    try {
      var idx = (typeof window !== 'undefined') ? window.LIMENArtifactSourceIndex : null;
      if (idx && typeof idx.aliases === 'function') { var row = idx.aliases()[dxId]; if (row && row.target) target = row.target; }
    } catch (e) {}
    var local = EDUCATION_DIAGNOSIS_ALIASES[dxId] || null;
    if (!target && local) target = local.target;
    if (target) {
      return { canonicalDiagnosisId: target, aliasUsed: true, aliasReviewStatus: (local && local.reviewStatus) || 'corpus-aliased', aliasRisk: (local && local.risk) || 'low', aliasNote: (local && local.note) || null };
    }
    return { canonicalDiagnosisId: dxId, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };
  };

  // L1 mad-lib treatment detector (parity with energy/industry)
  var ED_MADLIB_VERB = /^(Develop|Establish|Implement|Build|Launch|Design|Deploy|Operationalize|Conduct|Create|Define|Assess|Optimize|Modernize|Strengthen|Enhance|Formalize|Institute|Standardize|Coordinate|Integrate|Calibrate|Evaluate|Streamline|Institutionalize|Configure|Monitor)\b/;
  EducationBrain.prototype._isMadLibTreatment = function (label) { return !label || ED_MADLIB_VERB.test(String(label)); };

  // ════════════════════════════════════════════════════════════════════════════
  // LEARNING-OUTCOMES SUB-LAYER (additive brain layer; mirrors the energy DC layer).
  // Real-content (hand-authored, citation-backed) edtech / enrollment / credentialing
  // diagnoses + treatments surfaced as a SEPARATE first-class layer. NEVER merged into
  // the validated 5-diagnosis spine (state.diagnoses stays 5) and never enters
  // evidenceAnchors. Real education-sector tickers only (CHGG/COUR/DUOL/LRN/TWOU + peers).
  // ════════════════════════════════════════════════════════════════════════════
  EducationBrain.prototype._loadLearningOutcomesLayer = function () {
    var self = this;
    if (self._loLoadPromise) return self._loLoadPromise;
    self._loLoadPromise = fetch('/assets/data/domains/education_learning_outcomes.json')
      .then(function (r) { return (r && r.ok) ? r.json() : null; })
      .then(function (data) {
        if (data && data.issues) { self._loPortal = { issues: data.issues, activations: data.activations || [], title: data.title || 'Learning Outcomes', sourceMode: 'file' }; return self._loPortal; }
        self._loPortal = self._handAuthoredLearningOutcomes(); return self._loPortal;
      })
      .catch(function () { self._loPortal = self._handAuthoredLearningOutcomes(); return self._loPortal; });
    return self._loLoadPromise;
  };

  EducationBrain.prototype._handAuthoredLearningOutcomes = function () {
    return {
      title: 'Learning Outcomes, Enrollment & Credentialing',
      sourceMode: 'hand-authored',
      issues: [
        { id: 'ENROLLMENT_DECLINE_RISK', label: 'Enrollment Decline Risk', summary: 'Higher-ed enrollment contraction (demographic cliff + value perception) pressuring tuition-dependent institutions and online platforms.', circuits: [{ nodeId: 'lo_enrollment' }] },
        { id: 'ONLINE_LEARNING_SHIFT', label: 'Online & Adaptive Learning Shift', summary: 'Structural shift to online / adaptive / AI-tutoring delivery reshaping edtech demand and unit economics.', circuits: [{ nodeId: 'lo_online' }] },
        { id: 'LITERACY_OUTCOME_GAP', label: 'Literacy & Outcome Gap', summary: 'Persistent reading/math proficiency gaps (NAEP) sustaining demand for outcome-tracking and intervention tooling.', circuits: [{ nodeId: 'lo_literacy' }] },
        { id: 'CREDENTIAL_SUPPLY_MISMATCH', label: 'Credential-Skills Supply Mismatch', summary: 'Skills-credential mismatch driving alternative credentialing, bootcamps, and workforce upskilling platforms.', circuits: [{ nodeId: 'lo_credential' }] },
        { id: 'STUDENT_DEBT_PRESSURE', label: 'Student Debt Pressure', summary: 'Debt burden and ROI scrutiny shifting demand toward lower-cost, outcome-accountable providers.', circuits: [{ nodeId: 'lo_debt' }] }
      ],
      activations: [
        { brainNodeId: 'lo_enrollment', companies: [{ ticker_or_id: 'COUR', name: 'Coursera' }, { ticker_or_id: 'STRA', name: 'Strategic Education' }, { ticker_or_id: 'LAUR', name: 'Laureate Education' }],
          treatments: [{ label: 'Track IPEDS enrollment series against tuition-dependent institution exposure', type: 'monitoring', evidence: 'B', description: 'NCES IPEDS fall enrollment data flags contraction by sector.', steps: ['Pull IPEDS enrollment series', 'Flag sustained YoY decline by sector'], cite: 'NCES IPEDS' }] },
        { brainNodeId: 'lo_online', companies: [{ ticker_or_id: 'COUR', name: 'Coursera' }, { ticker_or_id: 'DUOL', name: 'Duolingo' }, { ticker_or_id: 'CHGG', name: 'Chegg' }, { ticker_or_id: 'TWOU', name: '2U' }],
          treatments: [{ label: 'Track online-platform MAU / paid-conversion vs AI-tutoring disruption risk', type: 'position', evidence: 'B', description: 'Online learning MAU growth tied to AI-tutoring substitution (Chegg downside, Duolingo upside).', steps: ['Track platform MAU and paid conversion', 'Cross against AI-tutor substitution signals'], cite: 'Company 10-Q KPI disclosures' }] },
        { brainNodeId: 'lo_literacy', companies: [{ ticker_or_id: 'LRN', name: 'Stride (K12 Inc)' }, { ticker_or_id: 'CHGG', name: 'Chegg' }],
          treatments: [{ label: 'Map NAEP proficiency gaps to intervention / outcome-tracking demand', type: 'research', evidence: 'C', description: 'Persistent NAEP gaps sustain demand for literacy intervention tooling.', steps: ['Baseline NAEP proficiency by grade', 'Model intervention-tooling addressable demand'], cite: 'NAEP / NCES' }] },
        { brainNodeId: 'lo_credential', companies: [{ ticker_or_id: 'COUR', name: 'Coursera' }, { ticker_or_id: 'LOPE', name: 'Grand Canyon Education' }, { ticker_or_id: 'ATGE', name: 'Adtalem Global Education' }, { ticker_or_id: 'UTI', name: 'Universal Technical Institute' }],
          treatments: [{ label: 'Map BLS skills-gap data to alternative-credential and workforce-upskilling demand', type: 'position', evidence: 'B', description: 'Skills-credential mismatch drives bootcamp / micro-credential / vocational demand.', steps: ['Pull BLS occupational skill-gap data', 'Map to credential-provider exposure'], cite: 'BLS / O*NET' }] },
        { brainNodeId: 'lo_debt', companies: [{ ticker_or_id: 'STRA', name: 'Strategic Education' }, { ticker_or_id: 'LOPE', name: 'Grand Canyon Education' }, { ticker_or_id: 'ATGE', name: 'Adtalem Global Education' }],
          treatments: [{ label: 'Track student-debt / ROI scrutiny shifting demand to outcome-accountable providers', type: 'analyze', evidence: 'C', description: 'Debt-burden and gainful-employment scrutiny favors lower-cost outcome-accountable providers.', steps: ['Track Fed student-loan balance series', 'Model demand shift to low-cost providers'], cite: 'Federal Reserve G.19 / ED.gov' }] }
      ]
    };
  };

  EducationBrain.prototype._buildLearningOutcomesLayer = function () {
    var self = this;
    var lo = self._loPortal;
    if (!lo || !lo.issues || !lo.issues.length) {
      self.state.learningOutcomesLayer = { loaded: false, count: 0, activeCount: 0, diagnoses: [], note: 'learning-outcomes sub-portal not loaded (offline or fetch failed)' };
      self.state.educationSubLayer = self.state.learningOutcomesLayer;
      self.state.educationSubLayerDiagnoses = [];
      self.state.educationSubLayerTreatments = [];
      self.state.learningOutcomesDomainDiagnosisPackets = [];
      return self.state.learningOutcomesLayer;
    }
    var conditions = self._activeConditions || [];
    // Sub-layer-specific condition index (these issue IDs are NOT in the canonical diagnosisIndex)
    var LO_INDEX = {
      'ENROLLMENT_DECLINE_RISK':    ['institutional_decline', 'budget_shortfall', 'resource_scarcity', 'credential_devaluation'],
      'ONLINE_LEARNING_SHIFT':      ['digital_divide', 'platform_transition', 'pedagogical_mismatch', 'automation_displacement'],
      'LITERACY_OUTCOME_GAP':       ['performance_decline', 'equity_failure', 'outcome_disparity', 'access_inequality'],
      'CREDENTIAL_SUPPLY_MISMATCH': ['standards_erosion', 'credential_devaluation', 'workforce_gap', 'quality_degradation'],
      'STUDENT_DEBT_PRESSURE':      ['resource_scarcity', 'access_inequality', 'institutional_decline']
    };
    var diagnoses = lo.issues.map(function (iss) {
      var triggers = LO_INDEX[iss.id] || [];
      var matchCount = 0;
      for (var t = 0; t < triggers.length; t++) {
        for (var c = 0; c < conditions.length; c++) {
          if (conditions[c] === triggers[t] || String(conditions[c]).indexOf(triggers[t]) !== -1) matchCount++;
        }
      }
      return { id: iss.id, label: iss.label, summary: iss.summary || '', active: matchCount > 0, relevance: triggers.length ? Math.round((matchCount / triggers.length) * 100) / 100 : 0, circuits: iss.circuits || [], source: 'learning-outcomes', tier: 'real-content-unbundled', branch: 'learning-outcomes' };
    });
    var nodeToDx = {};
    diagnoses.forEach(function (d) { (d.circuits || []).forEach(function (c) { if (c && c.nodeId) nodeToDx[c.nodeId] = d.id; }); });
    var treatments = [];
    (lo.activations || []).forEach(function (act) {
      var dxId = nodeToDx[act.brainNodeId]; if (!dxId) return;
      (act.treatments || []).forEach(function (t, ti) {
        treatments.push({ id: 'lo_treat_' + act.brainNodeId + '_' + ti, label: t.label, type: t.type, evidence: t.evidence, description: t.description || '', cite: t.cite || null, steps: t.steps || [], diagnosisId: dxId, nodeId: act.brainNodeId, source: 'learning-outcomes', madLib: self._isMadLibTreatment ? self._isMadLibTreatment(t.label) : false });
      });
    });
    var evidenceRank = { A: 10, Strong: 10, B: 7, Moderate: 7, C: 4, Emerging: 1 };
    treatments.sort(function (a, b) { return (evidenceRank[b.evidence] || 0) - (evidenceRank[a.evidence] || 0); });
    self.state.educationSubLayerDiagnoses = diagnoses;
    self.state.educationSubLayerTreatments = treatments;
    self.state.learningOutcomesLayer = {
      loaded: true, portalTitle: lo.title, sourceMode: lo.sourceMode || 'hand-authored',
      count: diagnoses.length, activeCount: diagnoses.filter(function (d) { return d.active; }).length,
      diagnoses: diagnoses.map(function (d) {
        var rc = self._resolveCanonicalDiagnosis ? self._resolveCanonicalDiagnosis(d.id) : { canonicalDiagnosisId: d.id };
        var bs = (self._bundleStatusMap && self._bundleStatusMap[rc.canonicalDiagnosisId]) || 'missing';
        return { id: d.id, label: d.label, active: d.active, branch: 'learning-outcomes', canonicalDiagnosisId: rc.canonicalDiagnosisId, bundleStatus: bs, treatmentCount: treatments.filter(function (t) { return t.diagnosisId === d.id; }).length };
      }),
      note: 'real-content (hand-authored, citation-backed) learning-outcomes / enrollment / credentialing diagnoses; SEPARATE from the validated 5-diagnosis spine; no external source bundle yet (build-required); never admitted to evidenceAnchors; INVESTABLE/RESEARCHABLE only'
    };
    self.state.educationSubLayer = self.state.learningOutcomesLayer;
    self.state.learningOutcomesDomainDiagnosisPackets = diagnoses.map(function (d) {
      try { return self._buildDomainDiagnosisPacket(d); } catch (e) { return null; }
    }).filter(Boolean);
    return self.state.learningOutcomesLayer;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // H1-H6 — HIGHER EDUCATION BRAIN LAYERS (education-local, additive, domain-level).
  // ════════════════════════════════════════════════════════════════════════════
  EducationBrain.prototype._educationBundleStates = function () {
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
  EducationBrain.prototype._computeEducationImmune = function () {
    var s = this.state, em = s.educationModel || {}, reg = em.regulation || {}, bs = this._educationBundleStates();
    var ant = [{ type: 'synthetic-portal-contamination', severity: 'medium', action: 'quarantine', note: 'L1/L2 portal treatments mad-lib templated' }];
    bs.forEach(function (b) {
      if (b.bundleStatus === 'missing') ant.push({ type: 'source-bundle-missing', dx: b.dxId, severity: 'medium', action: 'block-from-prompt-evidence' });
      if (b.buildMethod === 'external-source-authored') ant.push({ type: 'external-source-authored-needs-human-verification', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
      if (b.aliasRisk === 'medium' || b.aliasRisk === 'high') ant.push({ type: 'alias-risk-bundle', dx: b.dxId, severity: b.aliasRisk, action: 'allow-with-warning' });
      if (b.bundleStatus === 'found' && b.shallow) ant.push({ type: 'root-only-shallow-bundle', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
    });
    var pe = (em.predictionError && em.predictionError.total) || 0;
    if (pe > 0.4) ant.push({ type: 'prediction-error-spike', severity: 'medium', action: 'lower-confidence', value: Math.round(pe * 1000) / 1000 });
    if (reg.stale) ant.push({ type: 'stale-feeds', severity: 'low', action: 'flag' });
    if (reg.flooding) ant.push({ type: 'concurrent-crisis-flood', severity: 'medium', action: 'inhibit' });
    if (reg.starving) ant.push({ type: 'unmet-demand-no-opportunity', severity: 'low', action: 'flag' });
    if (reg.surprised) ant.push({ type: 'novel-education-condition', severity: 'medium', action: 'flag', note: 'unexpected regime shift (e.g., ACCREDITATION_FAILURE active where FUNDING_CRISIS predicted)' });
    // enrollment-data-gap antigen (honest: no live enrollment/HR feed yet)
    var obs = em.observation || {};
    if (obs.teacherRetentionRate == null || obs.fundingGap == null) ant.push({ type: 'enrollment-data-gap', severity: 'low', action: 'flag', note: 'no live teacher-retention / funding-gap feed; observation fields null' });
    var sev = ant.some(function (a) { return a.severity === 'high'; }) ? 'high' : ant.some(function (a) { return a.severity === 'medium'; }) ? 'medium' : ant.length ? 'low' : 'none';
    var im = {
      version: 1, immuneState: sev === 'high' ? 'alert' : sev === 'medium' ? 'active' : sev === 'low' ? 'watch' : 'clear', severity: sev,
      antigens: ant.slice(0, 12),
      quarantines: ['L2-synthetic-portal-content', 'L1-portal-treatments-madlib'],
      allowedWithWarning: ant.filter(function (a) { return a.action === 'allow-with-warning'; }).map(function (a) { return a.type + (a.dx ? (':' + a.dx) : ''); }),
      blockedFromPrompt: ant.filter(function (a) { return a.action === 'block-from-prompt-evidence'; }).map(function (a) { return a.dx; }),
      blockedFromTraversal: ['L2'],
      immuneMemory: (((s.educationImmune && s.educationImmune.immuneMemory) || 0) + 1),
      lastScanAt: em.updated || null
    };
    s.educationImmune = im; return im;
  };

  // H2 — awareness / metacognition
  EducationBrain.prototype._computeEducationAwareness = function () {
    var s = this.state, em = s.educationModel || {}, im = s.educationImmune || {}, bs = this._educationBundleStates();
    var covered = bs.filter(function (b) { return b.bundleStatus === 'found'; });
    var missing = bs.filter(function (b) { return b.bundleStatus === 'missing'; });
    var hv = bs.filter(function (b) { return b.humanVerification === 'required'; });
    var active = (s.diagnoses || []).filter(function (d) { return d.active; });
    var prev = s.educationAwareness || {};
    var pe = (em.predictionError && em.predictionError.total) || 0;
    var aw = {
      version: 1,
      selfState: im.immuneState === 'alert' ? 'guarded' : (em.regulation && em.regulation.state) || 'unknown',
      knowns: covered.map(function (b) { return b.dxId + ' (source-backed)'; }).concat(['ED.gov / NCES / IES / EdWeek / World Bank / Chronicle feeds', active.length + ' active diagnoses']),
      unknowns: missing.map(function (b) { return b.dxId + ' (no source bundle)'; }).concat(['live enrollment (IPEDS) depth', 'teacher attrition rate', 'district appropriations gap', 'accreditation review pipeline', 'AI-tutor substitution velocity']),
      uncertainties: ['L1 portal treatments are mad-lib templates (NOT real depth); L2 synthetic + blocked', 'real edtech tickers exist in L1 but node-bindings are templated (relevance-unverified)', 'predictionError=' + (Math.round(pe * 1000) / 1000)],
      suppressions: (im.quarantines || []).concat(['L2-traversal', 'L1-portal-treatments']),
      confidenceDrivers: ['source coverage ' + covered.length + '/' + bs.length, 'regulation ' + ((em.regulation && em.regulation.state) || '?')],
      changedSinceLastCycle: { predictionErrorDelta: Math.round((pe - (typeof prev._pe === 'number' ? prev._pe : pe)) * 1000) / 1000, coverageNow: covered.length },
      humanReviewRequired: hv.map(function (b) { return b.dxId; }),
      selfNarrative: 'Education: ' + covered.length + '/' + bs.length + ' source-backed, ' + active.length + ' active dx, immune=' + (im.immuneState || '?') + '; posture from ED.gov/NCES/IES/EdWeek feeds; portal-below-L1 quarantined, ' + hv.length + ' need human verification.',
      lastAwarenessAt: em.updated || null, _pe: pe
    };
    s.educationAwareness = aw; return aw;
  };

  // H3 — conscience / veto (overclaim + source-sufficiency; patent/grant purged)
  EducationBrain.prototype._computeEducationConscience = function () {
    var s = this.state, em = s.educationModel || {}, im = s.educationImmune || {}, bs = this._educationBundleStates();
    var pe = (em.predictionError && em.predictionError.total) || 0;
    var vetoes = [], cautions = [], allowed = [], blocked = ['patent-claim', 'grant-claim'];
    vetoes.push({ claim: 'patent/grant', reason: 'lanes purged 2026-06-21; no method/mechanism/embodiment/figure candidate fields in any education bundle' });
    vetoes.push({ claim: 'unsubstantiated-student-outcome-claim', reason: 'no verified source bundle backing equity/outcome assertions about specific students or institutions' });
    bs.forEach(function (b) {
      if (b.bundleStatus === 'missing') { blocked.push('strong-claim:' + b.dxId); vetoes.push({ claim: 'strong-claim:' + b.dxId, reason: 'no source bundle' }); }
      else if (b.buildMethod === 'external-source-authored') { cautions.push({ claim: 'strong-claim:' + b.dxId, reason: 'external-source-authored; human-verification-required' }); allowed.push('source-routing:' + b.dxId); }
      else if (b.aliasRisk === 'medium' || b.aliasRisk === 'high') { cautions.push({ claim: 'precise-technical-claim:' + b.dxId, reason: 'aliasRisk ' + b.aliasRisk + '; include alias warning' }); allowed.push('source-summary:' + b.dxId); }
      else if (b.bundleStatus === 'found') { allowed.push('source-summary:' + b.dxId); }
    });
    if (pe > 0.4) cautions.push({ claim: 'high-confidence-claim', reason: 'predictionError spike ' + (Math.round(pe * 1000) / 1000) });
    if (im.immuneState === 'alert') cautions.push({ claim: 'artifact-generation', reason: 'immune alert — hold artifact lanes' });
    var hasFound = bs.some(function (b) { return b.bundleStatus === 'found'; });
    var con = {
      version: 1, conscienceState: vetoes.length ? 'restrictive' : 'permissive',
      vetoes: vetoes.slice(0, 10), cautions: cautions.slice(0, 10),
      allowedClaims: ['source-summary'].concat(hasFound ? ['investment-memo-with-warnings'] : []).concat(allowed.slice(0, 6)),
      blockedClaims: blocked.slice(0, 10),
      artifactReadinessDecision: { patentReady: false, grantReady: false, sbaReady: false, investmentReady: hasFound, researchReady: hasFound, note: 'patent/grant vetoed (lanes purged + no candidate fields); INVESTABLE/RESEARCHABLE allowed-with-warning only for source-backed diagnoses; unsubstantiated student-outcome/equity claims vetoed' },
      reasons: ['overclaim prevention', 'source sufficiency', 'student-outcome/equity claim guard', 'human-verification preservation'],
      lastCheckAt: em.updated || null
    };
    s.educationConscience = con; return con;
  };

  // H4 — intuition / weak-signal (NOT evidence; labelled unverified)
  EducationBrain.prototype._computeEducationIntuition = function () {
    var s = this.state, em = s.educationModel || {}, reg = em.regulation || {};
    var log = (s.memory && s.memory.outcomeLog) || [];
    var hunches = [];
    if (log.length >= 2) {
      var a = log[log.length - 2].predictionError, b = log[log.length - 1].predictionError;
      if (typeof a === 'number' && typeof b === 'number' && b - a > 0.05) hunches.push({ hunch: 'teacher-burnout / dropout spike forming (prediction error rising)', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'predictionError rose ' + a + '->' + b, verifyIf: 'error keeps rising 2+ cycles with a staffing/attendance feed', falsifyIf: 'error returns to baseline' });
    }
    if (reg.state === 'surprised') hunches.push({ hunch: 'novel education stressor entering the system (accreditation shock or enrollment cliff)', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'regulation=surprised (high novelty + diagnosis mismatch)', verifyIf: 'a specific diagnosis activates with source support', falsifyIf: 'novelty subsides next cycle' });
    var missing = this._educationBundleStates().filter(function (x) { return x.bundleStatus === 'missing' && x.active; });
    if (missing.length) hunches.push({ hunch: 'recurring uncovered diagnosis: ' + missing[0].dxId, label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'active diagnosis with no source bundle', verifyIf: 'a real source bundle is built', falsifyIf: 'diagnosis deactivates' });

    var patternMatches = [];
    var recent = log.slice(-10), regCount = {};
    recent.forEach(function (e) { if (e.regulation) regCount[e.regulation] = (regCount[e.regulation] || 0) + 1; });
    Object.keys(regCount).forEach(function (k) { if (regCount[k] >= 3) patternMatches.push({ pattern: 'recurring regulation state: ' + k, occurrences: regCount[k], window: recent.length, label: 'PATTERN', evidenceStatus: 'UNVERIFIED' }); });

    var FAMILY = { 'resourcing': ['FUNDING_CRISIS', 'TEACHER_SHORTAGE'], 'outcomes': ['ACHIEVEMENT_GAP'], 'quality': ['ACCREDITATION_FAILURE'], 'modernization': ['TECHNOLOGY_DISRUPTION'] };
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
    s.educationIntuition = it; return it;
  };

  // H5 — simulation / bounded counterfactual (hypothetical only)
  EducationBrain.prototype._computeEducationSimulation = function () {
    var s = this.state, em = s.educationModel || {};
    var base = typeof s.stress === 'number' ? s.stress : 0;
    function cl(v) { return Math.max(0, Math.min(1, Math.round(v * 1000) / 1000)); }
    var scenarios = [
      { type: 'worsen', hypothetical: true, assumption: 'funding cut deepens, teacher attrition accelerates', simulatedStress: cl(base + 0.25), risk: 'cascading institutional decline', intervention: 'track ED.gov appropriations + EdWeek staffing reports', falsifier: 'appropriations restored / attrition cools' },
      { type: 'stabilize', hypothetical: true, assumption: 'stressor holds', simulatedStress: cl(base), risk: 'persistent elevated baseline', intervention: 'maintain monitoring cadence', falsifier: 'stress moves materially' },
      { type: 'recover', hypothetical: true, assumption: 'stressor reverses', simulatedStress: cl(base - 0.2), risk: 'premature de-escalation', intervention: 'confirm with 2 independent sources before standing down', falsifier: 'stress re-rises' },
      { type: 'enrollment-shrink', hypothetical: true, assumption: 'demographic cliff + value perception cut enrollment', simulatedStress: cl(base + 0.3), risk: 'tuition-dependent institution closures', intervention: 'track NCES IPEDS enrollment series', falsifier: 'enrollment stabilizes' },
      { type: 'tech-adoption-accelerates', hypothetical: true, assumption: 'AI-tutoring adoption accelerates', simulatedStress: cl(base + 0.2), risk: 'incumbent edtech substitution (Chegg-style)', intervention: 'track platform MAU / paid-conversion KPIs', falsifier: 'adoption plateaus' },
      { type: 'accreditation-shock', hypothetical: true, assumption: 'accreditor sanctions widen', simulatedStress: cl(base + 0.25), risk: 'credential devaluation / aid eligibility loss', intervention: 'monitor accreditor actions + ED.gov gainful-employment', falsifier: 'sanctions narrow' }
    ];
    var sim = {
      version: 1, scenarios: scenarios, assumptions: scenarios.map(function (x) { return x.assumption; }),
      simulatedStress: scenarios.map(function (x) { return x.simulatedStress; }),
      simulatedDiagnoses: ['FUNDING_CRISIS', 'TEACHER_SHORTAGE', 'TECHNOLOGY_DISRUPTION'], simulatedOpportunities: [],
      risks: scenarios.map(function (x) { return x.risk; }), interventions: scenarios.map(function (x) { return x.intervention; }),
      falsifiers: scenarios.map(function (x) { return x.falsifier; }), lastSimulatedAt: em.updated || null
    };
    s.educationSimulation = sim; return sim;
  };

  // H6 — executive self-report (compact status card)
  EducationBrain.prototype._computeEducationExecutiveReport = function () {
    var s = this.state, em = s.educationModel || {}, im = s.educationImmune || {}, aw = s.educationAwareness || {}, con = s.educationConscience || {}, it = s.educationIntuition || {}, sim = s.educationSimulation || {}, bs = this._educationBundleStates();
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
    s.educationExecutiveReport = rep; return rep;
  };

  EducationBrain.prototype._computeEducationHigherLayers = function () {
    this._computeEducationImmune();
    this._computeEducationAwareness();
    this._computeEducationConscience();
    this._computeEducationIntuition();
    this._computeEducationSimulation();
    this._computeEducationExecutiveReport();
  };

  // ════════════════════════════════════════════════════════════════════════════
  // DomainDiagnosisPacket SCHEMA (schema-only; NEVER invents data). domain='education'.
  // ════════════════════════════════════════════════════════════════════════════
  var ED_DDP_SCHEMA_VERSION = 'education-ddp-1';
  function _edDdpPresent(v) {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (v === 'missing' || v === '' || v === 'none') return false;
    return true;
  }
  function _edDdpCompleteness(section, keys) {
    var have = 0; for (var i = 0; i < keys.length; i++) { if (_edDdpPresent(section[keys[i]])) have++; }
    return { have: have, total: keys.length, pct: keys.length ? Math.round(have / keys.length * 100) : 0 };
  }

  EducationBrain.prototype._buildDomainDiagnosisPacket = function (dx) {
    var s = this.state || {};
    var em = s.educationModel || {};
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
      domain: 'education',
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
      educationModel: { version: em.version || null, cycle: (typeof em.cycle === 'number' ? em.cycle : null) },
      predictionError: em.predictionError || null,
      regulationState: (em.regulation && em.regulation.state) || null,
      prior: em.prior || null,
      observation: em.observation || null,
      plasticity: em.plasticity || null,
      readyForHandoff: em.readyForHandoff === true
    };
    var rootId = (portal && portal.domainId) || 'education';
    var rootTitle = (portal && portal.title) || 'Education';
    var ancestry = (portal && portal.parentLabel) ? [portal.parentLabel, rootTitle] : [rootTitle];
    var portalContext = {
      portalIds: [rootId],
      portalDomain: 'education',
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
    var _intakeSrcHint = { EDUCATION_BUDGET_SHORTFALL: 'ED.gov appropriations / NCES finance / state education agency filings', EDUCATOR_WORKFORCE_GAP: 'BLS OES educator series / DOL / EdWeek staffing reports', STUDENT_OUTCOME_DISPARITY: 'NAEP / NCES / IES What Works Clearinghouse', CREDENTIAL_QUALITY_EROSION: 'CHEA / accreditor actions / ED.gov gainful-employment data', EDTECH_TRANSITION_EVENT: 'company 10-K KPI disclosures / IPEDS distance-education data' };
    var authoringIntake = [];
    if (_isExternal) {
      ['methodCandidates', 'embodimentCandidates', 'figurePlaceholders'].forEach(function (field) {
        if (_bArr(field).length === 0) authoringIntake.push({ field: field, status: 'needs-human-input', count: 0, need: field === 'methodCandidates' ? 'a concrete pedagogical/program method drawn from a primary source' : field === 'embodimentCandidates' ? 'a specific program implementation from a real document' : 'a figure description grounded in a real source', sourceHint: _intakeSrcHint[identity.canonicalDiagnosisId] || 'primary institutional source', note: 'NOT fabricated by the brain — author from the cited source, then wire in verbatim with attribution' });
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
      identity:         _edDdpCompleteness(identity, ['domain', 'diagnosisId', 'canonicalDiagnosisId', 'label', 'phase', 'confidence']),
      brainState:       _edDdpCompleteness(brainState, ['educationModel', 'predictionError', 'regulationState', 'prior', 'observation', 'plasticity']),
      portalContext:    _edDdpCompleteness(portalContext, ['portalIds', 'portalDomain', 'portalTitle', 'depth', 'ancestryPath']),
      evidence:         _edDdpCompleteness(evidence, ['sourceFeeds', 'evidenceAnchors', 'citationHints']),
      treatmentContext: _edDdpCompleteness(treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']),
      operatorContext:  _edDdpCompleteness(operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']),
      artifactContext:  _edDdpCompleteness(artifactContext, ['artifactLanes'])
    };
    var totHave = 0, totAll = 0;
    for (var sk in comp) { if (comp.hasOwnProperty(sk)) { totHave += comp[sk].have; totAll += comp[sk].total; } }
    var missingFields = [];
    function _cm(name, obj, keys) { for (var i = 0; i < keys.length; i++) { if (!_edDdpPresent(obj[keys[i]])) missingFields.push(name + '.' + keys[i]); } }
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
    if (!primaryOpp && (typeof s.stress !== 'number' || s.stress < ED_STRESS_FLOOR)) warnings.push('no active opportunity (offline/low-stress) — operator/lane fields stay empty');
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
        'diagnosis-specific bundle anchors preferred over generic education evidence',
        'official/primary sources retained (ED.gov/NCES/IES/NAEP/BLS/CHEA where present)',
        'mechanisms prioritized over figures under prompt-space limits',
        'treatments with implementation relevance preferred over broad narrative',
        'caps applied per field; full data preserved in the stored bundle + full DDP'
      ],
      retainedWarnings: warnings
        .concat(s.educationImmune ? ['immune: ' + s.educationImmune.immuneState + ' (sev ' + s.educationImmune.severity + ', ' + (s.educationImmune.antigens || []).length + ' antigens; L2 traversal blocked)'] : [])
        .concat(s.educationConscience && s.educationConscience.conscienceState === 'restrictive' ? ['conscience: ' + (s.educationConscience.blockedClaims || []).slice(0, 3).join(', ') + ' blocked'] : []),
      retainedBlockers: artifactContext.blockers,
      immuneSummary: s.educationImmune ? { immuneState: s.educationImmune.immuneState, severity: s.educationImmune.severity, antigenCount: (s.educationImmune.antigens || []).length, quarantines: s.educationImmune.quarantines, blockedFromTraversal: s.educationImmune.blockedFromTraversal, allowedWithWarning: s.educationImmune.allowedWithWarning } : null,
      awarenessSummary: s.educationAwareness ? { selfNarrative: s.educationAwareness.selfNarrative, knowns: (s.educationAwareness.knowns || []).length, unknowns: (s.educationAwareness.unknowns || []).length, humanReviewRequired: s.educationAwareness.humanReviewRequired } : null,
      conscienceDecision: s.educationConscience ? { conscienceState: s.educationConscience.conscienceState, blockedClaims: s.educationConscience.blockedClaims, artifactReadinessDecision: s.educationConscience.artifactReadinessDecision } : null,
      intuitionSummary: s.educationIntuition ? s.educationIntuition.hunches : null,
      scenarioSummary: s.educationSimulation ? (s.educationSimulation.scenarios || []).map(function (x) { return { type: x.type, hypothetical: x.hypothetical, risk: x.risk }; }) : null,
      executiveReport: s.educationExecutiveReport || null,
      l1DepthSummary: portalContext.l1Depth ? { realCompanyTickers: (portalContext.l1Depth.realCompanyTickers || []).length, realTreatments: portalContext.l1Depth.realTreatments, madLibTreatments: portalContext.l1Depth.madLibTreatments, admitted: portalContext.l1Depth.admitted } : null,
      authoringIntake: treatmentContext.authoringIntake.length ? treatmentContext.authoringIntake : null,
      learningOutcomesSummary: s.learningOutcomesLayer && s.learningOutcomesLayer.loaded ? { count: s.learningOutcomesLayer.count, activeCount: s.learningOutcomesLayer.activeCount, diagnoses: s.learningOutcomesLayer.diagnoses, note: s.learningOutcomesLayer.note } : null
    };

    return {
      schemaVersion: ED_DDP_SCHEMA_VERSION,
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
        schemaVersion: ED_DDP_SCHEMA_VERSION,
        fieldCompleteness: { sections: comp, overallPct: pct },
        missingFields: missingFields,
        warnings: warnings,
        proofTier: proofTier,
        lifecycle: this._educationLifecycleView ? this._educationLifecycleView() : null,
        immune: s.educationImmune || null,
        awareness: s.educationAwareness || null,
        conscience: s.educationConscience || null,
        intuition: s.educationIntuition || null,
        simulation: s.educationSimulation || null,
        executiveReport: s.educationExecutiveReport || null
      }
    };
  };

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
