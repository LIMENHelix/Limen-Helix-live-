/**
 * culture-brain.js — Culture Domain Cognitive Engine
 *
 * Portal issues: CULTURAL_ERASURE, HERITAGE_DESTRUCTION, CENSORSHIP,
 *                IDENTITY_CRISIS, CREATIVE_STAGNATION
 *
 * Emissions: communication, religion, population, governance, education
 * Exposes: window.LIMENCultureBrain
 */
(function () {
  'use strict';
  if (!window.LIMENDomainBrainBase) { console.warn('[CultureBrain] Base not loaded'); return; }
  var Base = window.LIMENDomainBrainBase;

  function CultureBrain() {
    Base.call(this, { domainId: 'culture', label: 'Culture', snapshotKey: 'culture', cycleInterval: 30000 });
  }
  CultureBrain.prototype = Object.create(Base.prototype);
  CultureBrain.prototype.constructor = CultureBrain;

  CultureBrain.prototype.init = function () {
    Base.prototype.init.call(this);

    this.diagnosisIndex = {
      'CULTURAL_ERASURE':       ['identity_fracture', 'social_cohesion_erosion', 'symbolic_disunity', 'cultural_loss', 'culture_high_stress', 'structural_stress'],
      'HERITAGE_DESTRUCTION':   ['heritage_loss', 'monument_destruction', 'archive_degradation', 'cultural_loss', 'symbolic_disunity'],
      'CENSORSHIP':             ['narrative_monopolization', 'ideology_lockin', 'interpretive_narrowing', 'cultural_manipulation', 'expression_suppression'],
      'IDENTITY_CRISIS':        ['identity_fracture', 'value_conflict', 'tribal_segmentation', 'norm_instability', 'ritual_confusion', 'culture_high_stress'],
      'CREATIVE_STAGNATION':    ['participation_decay', 'audience_collapse', 'creative_weakness', 'disengagement', 'institutional_decline', 'structural_stress']
    };

    this.emissionRules = [
      { targetDomain: 'communication', signalType: 'narrative_symbolic_pressure', condition: function (s) { return s.stress >= 0.20; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.55); } },
      { targetDomain: 'religion', signalType: 'value_ritual_coherence_shift', condition: function (s) { return s.stress >= 0.25; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); } },
      { targetDomain: 'population', signalType: 'identity_participation_change', condition: function (s) { return s.stress >= 0.30; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.4); } },
      { targetDomain: 'governance', signalType: 'legitimacy_cohesion_effect', condition: function (s) { return s.stress >= 0.30; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); } },
      { targetDomain: 'education', signalType: 'norm_transmission_pressure', condition: function (s) { return s.stress >= 0.35; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.4); } }
    ];
  };

  CultureBrain.prototype.normalizeSignals = function () {
    var signals = [], rawSignals = (this._rawDomain && this._rawDomain.signals) || [];
    for (var i = 0; i < rawSignals.length; i++) signals.push(rawSignals[i]);
    this._activeConditions = [];

    // Long-arc baseline — culture always has identity and cohesion pressure
    this._activeConditions.push('identity_fracture');
    this._activeConditions.push('participation_decay');
    signals.push('BASELINE: Persistent cultural identity and participation posture pressure');

    var feeds = this.state.feeds;
    for (var fi = 0; fi < feeds.length; fi++) {
      var f = feeds[fi], fn = (f.name || '').toLowerCase();
      if ((fn.indexOf('culture') !== -1 || fn.indexOf('event') !== -1 || fn.indexOf('arts') !== -1 || fn.indexOf('heritage') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('disengagement');
        signals.push('FEED: Cultural signal — ' + (f.label || f.value + ' articles'));
      }
      if ((fn.indexOf('social') !== -1 || fn.indexOf('movement') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('value_conflict');
        signals.push('FEED: Social movement signal — ' + (f.label || f.value));
      }
    }

    for (var rsi = 0; rsi < rawSignals.length; rsi++) {
      var rs = (typeof rawSignals[rsi] === 'string' ? rawSignals[rsi] : '').toLowerCase();
      if (rs.indexOf('censor') !== -1 || rs.indexOf('ban') !== -1 || rs.indexOf('suppress') !== -1) {
        if (this._activeConditions.indexOf('expression_suppression') === -1) this._activeConditions.push('expression_suppression');
        if (this._activeConditions.indexOf('narrative_monopolization') === -1) this._activeConditions.push('narrative_monopolization');
      }
      if (rs.indexOf('heritage') !== -1 || rs.indexOf('monument') !== -1 || rs.indexOf('destruction') !== -1) {
        if (this._activeConditions.indexOf('heritage_loss') === -1) this._activeConditions.push('heritage_loss');
        if (this._activeConditions.indexOf('monument_destruction') === -1) this._activeConditions.push('monument_destruction');
      }
      if (rs.indexOf('identity') !== -1 || rs.indexOf('polariz') !== -1 || rs.indexOf('division') !== -1) {
        if (this._activeConditions.indexOf('tribal_segmentation') === -1) this._activeConditions.push('tribal_segmentation');
        if (this._activeConditions.indexOf('social_cohesion_erosion') === -1) this._activeConditions.push('social_cohesion_erosion');
      }
      if (rs.indexOf('arts') !== -1 || rs.indexOf('funding') !== -1 || rs.indexOf('creative') !== -1) {
        if (this._activeConditions.indexOf('creative_weakness') === -1) this._activeConditions.push('creative_weakness');
      }
    }

    var snap = this._getSnapshot();
    if (snap && snap.defenseSignals) {
      for (var si = 0; si < snap.defenseSignals.length; si++) {
        var sig = snap.defenseSignals[si];
        if (sig.affectedDomains && sig.affectedDomains.indexOf('culture') !== -1) {
          this._activeConditions.push(sig.eventType);
          signals.push('FEED [DEFENSE]: ' + (sig.eventType || '').replace(/_/g, ' '));
        }
      }
    }
    if (snap && snap.macroShock && snap.macroShock.detected) this._activeConditions.push('macro_shock');

    if (window.LIMENDomainBrains) {
      var allBrains = window.LIMENDomainBrains.getAll();
      for (var bk in allBrains) {
        if (bk === 'culture') continue;
        var b = allBrains[bk]; if (!b || !b.state) continue;
        var bEm = b.state.crossDomainEmissions || [];
        for (var bei = 0; bei < bEm.length; bei++) {
          var be = bEm[bei];
          if (be.targetDomain === 'culture' && be.magnitude > 0.1) {
            signals.push('FEED [' + bk.toUpperCase() + ']: ' + (be.signal || '').replace(/_/g, ' ') + ' — ' + Math.round(be.magnitude * 100) + '%');
          }
        }
      }
    }

    if (this.state.stress >= 0.20) { this._activeConditions.push('norm_instability'); this._activeConditions.push('symbolic_disunity'); }
    if (this.state.stress >= 0.35) { this._activeConditions.push('cultural_loss'); this._activeConditions.push('audience_collapse'); }
    if (this.state.stress >= 0.50) { this._activeConditions.push('culture_high_stress'); this._activeConditions.push('cultural_manipulation'); }
    if (this.state.stress >= 0.60) { this._activeConditions.push('ideology_lockin'); this._activeConditions.push('ritual_confusion'); }
    if (this.state.maturity === 'STRUCTURAL') this._activeConditions.push('structural_stress');
    var extPressure = this.getExternalPressure ? this.getExternalPressure() : 0;
    if (extPressure >= 0.10) this._activeConditions.push('interpretive_narrowing');
    if (extPressure >= 0.20) this._activeConditions.push('institutional_decline');

    this.state.signals = signals;
    return Promise.resolve();
  };

  CultureBrain.prototype.deriveDiagnoses = function () {
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

  CultureBrain.prototype.recommendTreatments = function () {
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

  CultureBrain.prototype.surfaceOpportunities = function () {
    Base.prototype.surfaceOpportunities.call(this);
    var opps = [], stress = this.state.stress, activeDx = this.state.diagnoses.filter(function (d) { return d.active; }), allDx = this.state.diagnoses || [], companies = this.state.companies, seen = {};
    function add(o) { var key = o.title.toLowerCase().replace(/[^a-z0-9]/g, ''); if (seen[key]) return; seen[key] = true; opps.push(o); }

    for (var di = 0; di < activeDx.length; di++) {
      var dx = activeDx[di], dxLabel = (dx.label || dx.id || '').replace(/_/g, ' ');
      add({ title: dxLabel + ' — cultural participation and community cohesion platforms', rank: stress * dx.relevance, path: 'GRANT-ELIGIBLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.50) add({ title: dxLabel + ' — narrative resilience and interpretive diversity infrastructure', rank: stress * dx.relevance * 0.9, path: 'GRANT-ELIGIBLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.55 && dx.relevance >= 0.2) add({ title: dxLabel + ' — identity restoration and trust systems', rank: stress * 0.85, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      add({ title: dxLabel + ' — creative ecosystem and cultural production support', rank: stress * dx.relevance * 0.75, path: 'GRANT-ELIGIBLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
    }

    var termCo = [] /* neutralized: distress only from validated gate (see energy-brain) */;
    if (termCo.length > 0) add({ title: 'Culture terminal entity distressed positioning', rank: 0.95, path: 'INVESTABLE', urgency: 'high', source: 'company_terminal', tier: 1, companies: termCo.map(function (c) { return c.ticker; }), stress: stress });
    if (this.state.convergence && this.state.convergence.primary_signal) add({ title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — culture convergence response', rank: 0.98, path: 'GRANT-ELIGIBLE', urgency: 'high', source: 'convergence', tier: 1, stress: stress });

    var emissions = this.state.crossDomainEmissions || [];
    for (var ei = 0; ei < emissions.length; ei++) { var em = emissions[ei]; add({ title: 'Culture \u2192 ' + (em.targetDomain || '').replace(/_/g, ' ') + ' — ' + (em.signal || em.signalType || '').replace(/_/g, ' '), rank: (em.magnitude || 0.5) * stress * 0.8, path: 'INVESTABLE', urgency: em.magnitude > 0.6 ? 'high' : 'medium', source: 'cross_domain', tier: 2, stress: stress }); }

    if (stress >= 0.50) {
      add({ title: 'Heritage preservation and digital archive infrastructure', rank: stress * 0.70, path: 'GRANT-ELIGIBLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'heritage_preserve', stress: stress });
      add({ title: 'Community engagement and civic participation platforms', rank: stress * 0.65, path: 'GRANT-ELIGIBLE', urgency: stress > 0.70 ? 'medium' : 'watching', source: 'lagging', tier: 3, diagnosisId: 'civic_engage', stress: stress });
    }
    if (stress >= 0.60) {
      add({ title: 'Creative economy and arts funding infrastructure', rank: stress * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'creative_economy', stress: stress });
      add({ title: 'Cultural literacy and norm transmission systems', rank: stress * 0.72, path: 'GRANT-ELIGIBLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'cultural_literacy', stress: stress });
      add({ title: 'Intercultural dialogue and social bridging platforms', rank: stress * 0.68, path: 'GRANT-ELIGIBLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'intercultural', stress: stress });
    }

    var nearDx = allDx.filter(function (d) { return !d.active && d.relevance > 0 && d.totalTriggers > 0; });
    for (var ndi = 0; ndi < nearDx.length; ndi++) { if (stress >= 0.45) add({ title: (nearDx[ndi].label || '').replace(/_/g, ' ') + ' — early-stage monitoring', rank: stress * (nearDx[ndi].relevance || 0.1) * 0.5, path: 'PATENTABLE', urgency: 'watching', source: 'near_diagnosis', tier: 2, stress: stress, nearDiagnosisId: nearDx[ndi].id }); }

    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });
    // Canonical enrichment — merge culture playbook detail per opportunity
    var PB_LIST = window.LIMENCultureOpportunityPlaybooks || [];
    var _byId = {};
    for (var _pbi = 0; _pbi < PB_LIST.length; _pbi++) _byId[PB_LIST[_pbi].id] = PB_LIST[_pbi];
    var _PB_MAP = {
      'CULTURAL_ERASURE': 'cultural_erasure',
      'HERITAGE_DESTRUCTION': 'heritage_destruction',
      'CENSORSHIP': 'censorship_response',
      'IDENTITY_CRISIS': 'identity_crisis',
      'CREATIVE_STAGNATION': 'creative_stagnation'
    };
    var _LAGGING_MAP = {
      'civic_engage': 'identity_crisis',
      'creative_economy': 'creative_stagnation',
      'cultural_literacy': 'identity_crisis',
      'heritage_preserve': 'heritage_destruction',
      'intercultural': 'identity_crisis'
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
      o.domain = 'culture';
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
        var evidenceParts = ['Domain: culture', 'Stress: ' + stressPct + '%'];
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

  CultureBrain.prototype._checkDiagnosisActions = function () {
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; }); if (activeDx.length === 0) return;
    var adapters = window.LIMENActionAdapters; if (!adapters) return;
    for (var i = 0; i < activeDx.length; i++) { var dx = activeDx[i]; if (adapters.getDrafts && adapters.getDrafts({ domain: 'culture', intentId: dx.id }).length > 0) continue; adapters.createDraft('REPORT_GENERATION', { domain: 'culture', sourceType: 'domain_brain', sourceId: dx.id, intentId: dx.id, title: 'Culture Alert: ' + dx.label, intent: { domain: 'culture', title: dx.label, status: 'ACTIVE', priority: this.state.stress, progress: 0, strategyType: 'diagnosis_response', steps: [{ type: 'ANALYZE', label: 'Assess ' + dx.label + ' impact on cultural systems', status: 'PENDING' }, { type: 'INVESTIGATE', label: 'Identify affected communities, institutions, and creative ecosystems', status: 'PENDING' }, { type: 'POSITION', label: 'Evaluate restoration and resilience opportunities', status: 'PENDING' }] } }); }
  };

  CultureBrain.prototype.resolveDeepContent = function () {
    var self = this; var resolver = window.LIMENPortalContentResolver; if (!resolver) return Promise.resolve();
    return resolver.resolveForBrain(this.state).then(function (content) { self.state.resolvedContent = content; if (content) { var dt = []; for (var dxId in content.byDiagnosis) { var dxC = content.byDiagnosis[dxId]; for (var i = 0; i < dxC.treatments.length; i++) { var t = dxC.treatments[i]; dt.push({ id: 'deep_' + t.nodeId + '_' + i, label: t.label, type: t.type, evidence: t.evidence, description: t.description, cite: t.cite, steps: t.steps, monitoring: t.monitoring, escalation: t.escalation, diagnosisId: dxId, nodeId: t.nodeId, nodeLabel: t.nodeLabel, hasDepth: t.hasDepth, source: 'canonical_deep' }); } } if (dt.length > 0) self.state.treatments = dt; } }).catch(function () {});
  };

  var _origCycle = CultureBrain.prototype.cycle;
  CultureBrain.prototype.cycle = function () { var self = this; return _origCycle.call(this).then(function () { return self.resolveDeepContent(); }); };

  var brain = new CultureBrain(); brain.init(); brain.start();
  window.LIMENCultureBrain = brain;
  window.LIMENDomainBrains.register(brain);

  // ── SOVEREIGN OPERATOR MODULE AUTO-LOADER ──
  var _isDomainConsole = window.location.pathname.indexOf('domain-console') !== -1;
  var _domParam = (new URLSearchParams(window.location.search)).get('domain');
  var _isCultureDomain = _domParam === 'culture';
  if (_isDomainConsole && _isCultureDomain) {
    window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION = true;

    var _cultureScripts = [
      'assets/js/culture-compensation.js',
      'assets/js/culture-claim-ledger.js',
      'assets/js/culture-claim-flow.js',
      'assets/js/culture-opportunity-economics.js',
      'assets/js/culture-pulse-engine.js',
      'assets/js/culture-operator-panel.js',
      'assets/js/culture-node-business-engine.js',
      'assets/js/culture-business-review.js',
      'assets/js/culture-execution-panels.js',
      'assets/js/culture-business-build.js',
      'assets/js/culture-directive-extractor.js',
      'assets/js/culture-directive-ranker.js',
      'assets/js/culture-directive-translator.js',
      'assets/js/culture-targeting-engine.js',
      'assets/js/culture-promotion-bridge.js',
      'assets/js/culture-clarity-operator.js'
    ];
    (function loadNext(i) {
      if (i >= _cultureScripts.length) return;
      var s = document.createElement('script');
      s.src = _cultureScripts[i];
      s.onload = function () { loadNext(i + 1); };
      s.onerror = function () { console.warn('[CultureBrain] Failed to load ' + _cultureScripts[i]); loadNext(i + 1); };
      document.head.appendChild(s);
    })(0);
  }
})();
