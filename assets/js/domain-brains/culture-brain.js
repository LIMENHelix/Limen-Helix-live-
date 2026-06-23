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

    // ── One-shot cognition loaders (mirror infrastructure-brain init): real entities,
    //    validated distress signals, real source bundles, L1 mad-lib scan, music-scene sub-portal. ──
    try { this._loadCultureCommandBoardCompanies(); } catch (e) {}  // real entities (state.companies starved)
    try { this._loadCultureBrainSignals(); } catch (e) {}           // distress ONLY from the validated Thing pipeline
    try { this._loadCultureDiagnosisBundles(); } catch (e) {}       // load real artifact-source bundles (only ones that exist)
    try { this._loadCultureL1PortalDepth(); } catch (e) {}          // scan L1 branches (treatments mad-lib -> NOT admitted; real tickers only)
    try { this._loadCultureSceneLayer(); } catch (e) {}             // SCENE: load music-scene sub-portal (real-content, unbundled) as an additive LAYER

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
    // Fallback: if the snapshot didn't supply companies, use real command-board entities.
    if ((!this.state.companies || !this.state.companies.length) && this._cbCultureCompanies && this._cbCultureCompanies.length) {
      this.state.companies = this._cbCultureCompanies;
    }
    var opps = [], stress = this.state.stress, activeDx = this.state.diagnoses.filter(function (d) { return d.active; }), allDx = this.state.diagnoses || [], companies = this.state.companies, seen = {};
    function add(o) { var key = o.title.toLowerCase().replace(/[^a-z0-9]/g, ''); if (seen[key]) return; seen[key] = true; opps.push(o); }

    for (var di = 0; di < activeDx.length; di++) {
      var dx = activeDx[di], dxLabel = (dx.label || dx.id || '').replace(/_/g, ' ');
      add({ title: dxLabel + ' — cultural participation and community cohesion platforms', rank: stress * dx.relevance, path: 'INVESTABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.50) add({ title: dxLabel + ' — narrative resilience and interpretive diversity infrastructure', rank: stress * dx.relevance * 0.9, path: 'RESEARCHABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.55 && dx.relevance >= 0.2) add({ title: dxLabel + ' — identity restoration and trust systems', rank: stress * 0.85, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      add({ title: dxLabel + ' — creative ecosystem and cultural production support', rank: stress * dx.relevance * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
    }

    var termCo = [] /* neutralized: distress only from validated gate (see energy-brain) */;
    if (termCo.length > 0) add({ title: 'Culture terminal entity distressed positioning', rank: 0.95, path: 'INVESTABLE', urgency: 'high', source: 'company_terminal', tier: 1, companies: termCo.map(function (c) { return c.ticker; }), stress: stress });
    if (this.state.convergence && this.state.convergence.primary_signal) add({ title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — culture convergence response', rank: 0.98, path: 'INVESTABLE', urgency: 'high', source: 'convergence', tier: 1, stress: stress });

    var emissions = this.state.crossDomainEmissions || [];
    for (var ei = 0; ei < emissions.length; ei++) { var em = emissions[ei]; add({ title: 'Culture \u2192 ' + (em.targetDomain || '').replace(/_/g, ' ') + ' — ' + (em.signal || em.signalType || '').replace(/_/g, ' '), rank: (em.magnitude || 0.5) * stress * 0.8, path: 'INVESTABLE', urgency: em.magnitude > 0.6 ? 'high' : 'medium', source: 'cross_domain', tier: 2, stress: stress }); }

    if (stress >= 0.50) {
      add({ title: 'Heritage preservation and digital archive infrastructure', rank: stress * 0.70, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'heritage_preserve', stress: stress });
      add({ title: 'Community engagement and civic participation platforms', rank: stress * 0.65, path: 'INVESTABLE', urgency: stress > 0.70 ? 'medium' : 'watching', source: 'lagging', tier: 3, diagnosisId: 'civic_engage', stress: stress });
    }
    if (stress >= 0.60) {
      add({ title: 'Creative economy and arts funding infrastructure', rank: stress * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'creative_economy', stress: stress });
      add({ title: 'Cultural literacy and norm transmission systems', rank: stress * 0.72, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'cultural_literacy', stress: stress });
      add({ title: 'Intercultural dialogue and social bridging platforms', rank: stress * 0.68, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'intercultural', stress: stress });
    }

    var nearDx = allDx.filter(function (d) { return !d.active && d.relevance > 0 && d.totalTriggers > 0; });
    for (var ndi = 0; ndi < nearDx.length; ndi++) { if (stress >= 0.45) add({ title: (nearDx[ndi].label || '').replace(/_/g, ' ') + ' — early-stage monitoring', rank: stress * (nearDx[ndi].relevance || 0.1) * 0.5, path: 'RESEARCHABLE', urgency: 'watching', source: 'near_diagnosis', tier: 2, stress: stress, nearDiagnosisId: nearDx[ndi].id }); }

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
    // Lanes: investment + research ONLY (patent/grant/loan purged 2026-06-21; relaned GRANT->INVESTABLE, PATENT->RESEARCHABLE)
    var _COMP = {
      'INVESTABLE':   { type: 'invest',   base: 5, unit: 'profit%', tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
      'RESEARCHABLE': { type: 'research', base: 5, unit: 'credit%', tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 published research briefs' },     maxTier: { tier: 3, comp: 15 } }
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
        else if (o.path === 'RESEARCHABLE' && pb.realWorld && (pb.realWorld.research || pb.realWorld.build)) target = pb.realWorld.research || pb.realWorld.build;
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
  CultureBrain.prototype.cycle = function () {
    var self = this;
    return _origCycle.call(this).then(function () {
      return self.resolveDeepContent();
    }).then(function () {
      // Higher cognition: predictive self-model + metacognition (runs AFTER diagnoses settle)
      try { self._updateCultureModel(); } catch (e) {}
    });
  };

  // ══════════════════════════════════════════════════════════════════════
  // HIGHER COGNITION — predictive self-model + metacognition (cultural identity).
  // Generic predictive-coding substrate (prior → observe → prediction error →
  // regulation → update prior) + awareness / conscience / immune / intuition.
  // Mirrors infrastructure-brain STRUCTURE exactly; only the CONTENT is cultural
  // (music scenes, artists/creators, genres, streaming/virality, fanbases, the
  // attention economy, festivals/venues, taste-making, cultural movements).
  // ══════════════════════════════════════════════════════════════════════
  var CM_VERSION = 1;
  var CM_LEARNING_RATE = 0.25;
  var CM_SLOW_RATE = 0.08;
  var CM_STRESS_FLOOR = 0.30;
  var CM_FLOOD_CAP = 12;
  var CM_STALE_MS = 1000 * 60 * 60 * 6;
  var _cmClamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  var _cmJaccardDistance = function (a, b) {
    a = a || []; b = b || [];
    if (!a.length && !b.length) return 0;
    var sa = {}, inter = 0;
    a.forEach(function (x) { sa[x] = 1; });
    b.forEach(function (x) { if (sa[x]) inter++; });
    var uni = a.length + b.length - inter;
    return uni ? 1 - inter / uni : 0;
  };

  (function () {
    var P = CultureBrain.prototype;

    // Cultural diagnosis families — an analogy lens for monitoring, NOT evidence.
    var FAMILY = {
      'erasure': ['CULTURAL_ERASURE', 'HERITAGE_DESTRUCTION', 'IDENTITY_CRISIS'],
      'expression': ['CENSORSHIP', 'CREATIVE_STAGNATION'],
      'audience': ['CREATIVE_STAGNATION', 'IDENTITY_CRISIS'],
      'heritage': ['HERITAGE_DESTRUCTION', 'CULTURAL_ERASURE'],
      'identity': ['IDENTITY_CRISIS', 'CULTURAL_ERASURE']
    };

    P._neutralCultureModel = function () {
      return { version: CM_VERSION, cycle: 0, prior: { expectedStress: 0.5, expectedDiagnoses: [], expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, confidence: 0, samples: 0 }, observation: null, predictionError: null, predictedStress: null, regulation: null, plasticity: { learningRate: CM_LEARNING_RATE, slowRate: CM_SLOW_RATE, consolidation: 0 }, readyForHandoff: false, _lowErrorStreak: 0, updated: 0 };
    };
    P._buildCultureObservation = function () {
      var s = this.state || {};
      var active = (s.diagnoses || []).filter(function (d) { return d.active; });
      // signal = breadth of live cultural feeds (artist/scene/streaming activity)
      var feeds = s.feeds || [], fc = 0, newest = 0;
      if (Array.isArray(feeds)) {
        for (var i = 0; i < feeds.length; i++) { var fv = feeds[i]; if (fv) { fc++; var u = fv.updated; if (u && u > newest) newest = u; } }
      } else { for (var k in feeds) { if (feeds.hasOwnProperty(k)) { fc++; var u2 = feeds[k] && feeds[k].updated; if (u2 && u2 > newest) newest = u2; } } }
      // companyCount = ARTISTS / ORGS (labels/platforms/creator-orgs)
      var companyCount = (s.companies || []).length;
      return { stress: typeof s.stress === 'number' ? s.stress : 0, phase: s.phase || null, activeDiagnoses: active.map(function (d) { return d.id; }).sort(), diagnosisCount: active.length, opportunityCount: (s.opportunities || []).length, companyCount: companyCount, signal: Math.min(1, fc / 8), feedNewest: newest, timestamp: Date.now() };
    };
    P._computeCulturePredictionError = function (prior, obs) {
      var se = Math.abs(obs.stress - prior.expectedStress), sg = Math.abs(obs.signal - prior.expectedSignal), de = _cmJaccardDistance(obs.activeDiagnoses, prior.expectedDiagnoses);
      var od = Math.max(1, prior.expectedOpportunityCount, obs.opportunityCount), oe = Math.abs(obs.opportunityCount - prior.expectedOpportunityCount) / od;
      var total = _cmClamp(0.4 * se + 0.2 * sg + 0.25 * de + 0.15 * oe, 0, 1);
      return { total: total, stressError: se, signalError: sg, diagnosisError: de, opportunityError: oe, novelty: Math.max(se, de) };
    };
    P._updateCulturePrior = function (prior, obs, lr) {
      return { expectedStress: _cmClamp(prior.expectedStress + lr * (obs.stress - prior.expectedStress), 0, 1), expectedDiagnoses: obs.activeDiagnoses.slice(), expectedDiagnosisCount: prior.expectedDiagnosisCount + lr * (obs.diagnosisCount - prior.expectedDiagnosisCount), expectedOpportunityCount: prior.expectedOpportunityCount + lr * (obs.opportunityCount - prior.expectedOpportunityCount), expectedSignal: _cmClamp(prior.expectedSignal + lr * (obs.signal - prior.expectedSignal), 0, 1), confidence: _cmClamp(Math.min(1, (prior.samples + 1) / 20), 0, 1), samples: prior.samples + 1 };
    };
    P._computeCultureRegulation = function (cm, obs, pe) {
      var gain = _cmClamp(pe.novelty, 0.05, 0.95), inhib = _cmClamp(1 - pe.novelty, 0, 0.9);
      var starving = obs.stress >= CM_STRESS_FLOOR && obs.opportunityCount === 0, flooding = obs.opportunityCount > CM_FLOOD_CAP;
      var streak = (pe.total < 0.05) ? (cm._lowErrorStreak || 0) + 1 : 0; cm._lowErrorStreak = streak; var looping = streak >= 3;
      var stale = obs.feedNewest > 0 ? (Date.now() - obs.feedNewest) > CM_STALE_MS : false;
      var overconf = cm.prior.confidence > 0.8 && pe.total > 0.4;
      var label = flooding ? 'flooding' : starving ? 'starving' : stale ? 'stale' : looping ? 'looping' : overconf ? 'overconfident' : pe.novelty > 0.4 ? 'surprised' : 'calm';
      return { gain: gain, inhibition: inhib, starving: starving, flooding: flooding, looping: looping, stale: stale, overconfident: overconf, state: label };
    };

    // ── RECURRENT STEP — the proof surface (state.cultureModel) the Civilization cockpit reads ──
    P._updateCultureModel = function () {
      var cm = this.state.cultureModel || this._neutralCultureModel();
      var priorIn = cm.prior;
      var obs = this._buildCultureObservation();
      var pe = this._computeCulturePredictionError(priorIn, obs);
      var gainBlend = _cmClamp(pe.novelty, 0.05, 0.95);
      var predictedStress = priorIn.expectedStress * (1 - gainBlend) + obs.stress * gainBlend;
      var reg = this._computeCultureRegulation(cm, obs, pe);
      var readyForHandoff = (cm.cycle > 0) && (predictedStress >= CM_STRESS_FLOOR) && (obs.diagnosisCount > 0) && !reg.flooding && !reg.stale;
      var nextPrior = this._updateCulturePrior(priorIn, obs, cm.plasticity.learningRate);
      cm.cycle += 1; cm.observation = obs; cm.predictionError = pe; cm.predictedStress = predictedStress; cm.regulation = reg; cm.readyForHandoff = readyForHandoff; cm.prior = nextPrior; cm.updated = obs.timestamp;
      this.state.cultureModel = cm;

      var mem = this.state.memory || (this.state.memory = {});
      var log = mem.outcomeLog || (mem.outcomeLog = []);
      log.push({ cycle: cm.cycle, predictionError: Math.round(pe.total * 1000) / 1000, stress: obs.stress, activeDx: obs.diagnosisCount, regulation: reg.state, timestamp: obs.timestamp }); if (log.length > 40) log.shift();

      try { this._computeCultureHigherLayers(); } catch (e) {}

      // SCENE — music-scene sub-portal layer (additive; BEFORE the DDP build so the primary packet's
      // promptView advertises it). Never touches the validated diagnosis spine.
      try { this._buildCultureSceneLayer(); } catch (e) {}

      // DDP — build the DomainDiagnosisPacket (8-section contract) for the primary diagnosis,
      // and one per diagnosis. Schema-only: never invents data. Consumed by the Civilization cockpit.
      try {
        var _diags = this.state.diagnoses || [];
        var _primary = _diags.filter(function (d) { return d.active; })[0] || _diags[0] || null;
        var _self = this;
        cm.domainDiagnosisPacket = this._buildDomainDiagnosisPacket(_primary);
        this.state.cultureDomainDiagnosisPackets = _diags.map(function (d) { return _self._buildDomainDiagnosisPacket(d); });
      } catch (e) {}

      // state.cognition — generic surface domain-console-brain.js reads for ANY brain.
      this.state.cognition = {
        domain: 'culture',
        cultureModel: cm,
        model: { cycle: cm.cycle, predictionError: cm.predictionError, predictedStress: cm.predictedStress, regulation: cm.regulation },
        cultureImmune: this.state.cultureImmune || null,
        cultureAwareness: this.state.cultureAwareness || null,
        cultureConscience: this.state.cultureConscience || null,
        cultureIntuition: this.state.cultureIntuition || null,
        cultureSimulation: this.state.cultureSimulation || null,
        cultureExecutiveReport: this.state.cultureExecutiveReport || null,
        awareness: this.state.cultureAwareness || null,
        conscience: this.state.cultureConscience || null,
        immune: this.state.cultureImmune || null,
        intuition: this.state.cultureIntuition || null,
        sceneLayer: this.state.sceneLayer || null,
        treatments: this.state.treatments || [],
        diagnoses: this.state.diagnoses || [],
        opportunities: this.state.opportunities || []
      };
      return cm;
    };

    P._computeCultureHigherLayers = function () {
      this._computeCultureImmune(); this._computeCultureAwareness(); this._computeCultureConscience(); this._computeCultureIntuition();
      try { this._computeCultureSimulation(); } catch (e) {}
      try { this._computeCultureExecutiveReport(); } catch (e) {}
    };

    // ── H1 — immune (antigen scan over bundle/feed/regulation state) ──
    P._computeCultureImmune = function () {
      var s = this.state, cm = s.cultureModel || {}, reg = cm.regulation || {}, ant = [];
      var bs = (typeof this._cultureBundleStates === 'function') ? this._cultureBundleStates() : [];
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
        ant.push({ type: 'l1-synthetic-treatments', severity: 'medium', action: 'quarantine', note: 'L1 portal treatments are mad-lib templates (fixed-verb family); quarantined from evidence — only real artist/label/platform tickers surfaced relevance-unverified' });
      }
      var sev = ant.some(function (a) { return a.severity === 'high'; }) ? 'high' : ant.some(function (a) { return a.severity === 'medium'; }) ? 'medium' : ant.length ? 'low' : 'none';
      s.cultureImmune = {
        version: 1, immuneState: sev === 'high' ? 'alert' : sev === 'medium' ? 'active' : sev === 'low' ? 'watch' : 'clear', severity: sev,
        antigens: ant.slice(0, 12),
        quarantines: ['L1-portal-treatments-madlib'],
        allowedWithWarning: ant.filter(function (a) { return a.action === 'allow-with-warning'; }).map(function (a) { return a.type + (a.dx ? (':' + a.dx) : ''); }),
        blockedFromPrompt: ant.filter(function (a) { return a.action === 'block-from-prompt-evidence'; }).map(function (a) { return a.dx; }),
        blockedFromTraversal: ['L2'],
        lastScanAt: cm.updated || null
      };
      return s.cultureImmune;
    };
    // ── H2 — awareness (narrative on cultural identity / participation pressure) ──
    P._computeCultureAwareness = function () {
      var s = this.state, cm = s.cultureModel || {}, im = s.cultureImmune || {}, active = (s.diagnoses || []).filter(function (d) { return d.active; });
      var pe = (cm.predictionError && cm.predictionError.total) || 0, dxNames = active.map(function (d) { return d.label || d.id; });
      s.cultureAwareness = {
        version: 1, selfState: im.immuneState === 'alert' ? 'guarded' : (cm.regulation && cm.regulation.state) || 'unknown',
        knowns: dxNames.slice(0, 6),
        uncertainties: ['interpretive tracker — diagnoses are signal-driven readings of cultural identity/participation pressure, not validated', 'predictionError=' + (Math.round(pe * 1000) / 1000)],
        confidenceDrivers: ['regulation ' + ((cm.regulation && cm.regulation.state) || '?'), active.length + ' active dx'],
        selfNarrative: 'Culture: ' + active.length + ' active diagnosis pathway' + (active.length !== 1 ? 's' : '') + ' (' + (dxNames.slice(0, 3).join(', ') || 'none') + '), regulation=' + ((cm.regulation && cm.regulation.state) || '?') + ', immune=' + (im.immuneState || '?') + ', prediction-error ' + (Math.round(pe * 100) / 100) + '.',
        lastAwarenessAt: cm.updated || null
      };
      return s.cultureAwareness;
    };
    // ── H3 — conscience (artifact readiness; CULTURE does INVESTABLE/RESEARCHABLE only — no patent/grant per 2026 rules) ──
    P._computeCultureConscience = function () {
      var s = this.state, cm = s.cultureModel || {}, pe = (cm.predictionError && cm.predictionError.total) || 0, cautions = [];
      if (pe > 0.4) cautions.push({ claim: 'high-confidence-claim', reason: 'predictionError spike ' + (Math.round(pe * 1000) / 1000) });
      s.cultureConscience = { version: 1, conscienceState: 'restrictive', vetoes: [{ claim: 'patent/grant', reason: 'patent/grant lanes retired across all domains (2026-06-21); culture has no method/embodiment fields' }], cautions: cautions.slice(0, 8), allowedClaims: ['source-summary', 'culture-brief-with-warnings'], blockedClaims: ['patent-claim', 'grant-claim'], artifactReadinessDecision: { patentReady: false, grantReady: false, investmentReady: true, researchReady: true, note: 'patent/grant vetoed; investment/research allowed-with-warning' }, reasons: ['overclaim prevention', 'interpretive-not-validated'], lastCheckAt: cm.updated || null };
      return s.cultureConscience;
    };
    // ── H4 — intuition (hunches on emerging genres / virality patterns) ──
    P._computeCultureIntuition = function () {
      var s = this.state, cm = s.cultureModel || {}, reg = cm.regulation || {}, log = (s.memory && s.memory.outcomeLog) || [], hunches = [];
      if (log.length >= 2) { var a = log[log.length - 2].predictionError, b = log[log.length - 1].predictionError; if (typeof a === 'number' && typeof b === 'number' && b - a > 0.05) hunches.push({ hunch: 'cultural regime shift forming (prediction error rising) — emerging genre or virality pattern', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'predictionError rose ' + a + ' → ' + b }); }
      if (reg.state === 'surprised') hunches.push({ hunch: 'novel cultural stressor entering the scene (trend break / attention shift)', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'regulation = surprised' });
      var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
      var primaryId = (active[0] || {}).id, analogies = [];
      Object.keys(FAMILY).forEach(function (fam) { if (FAMILY[fam].indexOf(primaryId) >= 0) { FAMILY[fam].forEach(function (sib) { if (sib !== primaryId) analogies.push({ analogy: primaryId + ' resembles ' + sib, family: fam, evidenceStatus: 'UNVERIFIED' }); }); } });
      s.cultureIntuition = { version: 1, hunches: hunches.slice(0, 6), analogies: analogies.slice(0, 6), lastAt: cm.updated || null };
      return s.cultureIntuition;
    };
    // ── H5 — bounded counterfactual simulation (hypothetical only; UNVERIFIED) ──
    P._computeCultureSimulation = function () {
      var s = this.state, cm = s.cultureModel || {};
      var base = typeof s.stress === 'number' ? s.stress : 0;
      function cl(v) { return Math.max(0, Math.min(1, Math.round(v * 1000) / 1000)); }
      var scenarios = [
        { type: 'virality_spike', hypothetical: true, assumption: 'a genre/scene goes viral; attention concentrates on a few breakout artists', simulatedStress: cl(base + 0.2), risk: 'audience whiplash / creative monoculture (CREATIVE_STAGNATION)', intervention: 'diversify discovery surfaces / support mid-tail artists', falsifier: 'attention distribution stays broad across the long tail' },
        { type: 'artist_exodus', hypothetical: true, assumption: 'creators leave a platform/label over royalties or moderation', simulatedStress: cl(base + 0.25), risk: 'creator-base erosion (CREATIVE_STAGNATION / IDENTITY_CRISIS)', intervention: 'creator-economics monitor / royalty + rights transparency', falsifier: 'net creator inflow holds positive' },
        { type: 'platform_dominance', hypothetical: true, assumption: 'one streaming/distribution platform captures dominant share', simulatedStress: cl(base + 0.2), risk: 'narrative/discovery gatekeeping (CENSORSHIP / narrative monopolization)', intervention: 'distribution-pluralism watch / antitrust + interoperability signal', falsifier: 'multiple viable distribution channels persist' },
        { type: 'heritage_loss', hypothetical: true, assumption: 'archives/venues/catalogs degrade or are demolished', simulatedStress: cl(base + 0.3), risk: 'heritage destruction (HERITAGE_DESTRUCTION)', intervention: 'digital-archive preservation / venue + catalog rescue', falsifier: 'preservation funding and digitization keep pace' },
        { type: 'discourse_polarization', hypothetical: true, assumption: 'cultural discourse fractures into hostile tribes', simulatedStress: cl(base + 0.15), risk: 'identity fracture / social cohesion erosion (IDENTITY_CRISIS)', intervention: 'intercultural bridging / shared-canon programming', falsifier: 'cross-audience engagement holds' }
      ];
      var sim = {
        version: 1, scenarios: scenarios, assumptions: scenarios.map(function (x) { return x.assumption; }),
        simulatedStress: scenarios.map(function (x) { return x.simulatedStress; }),
        simulatedDiagnoses: ['CREATIVE_STAGNATION', 'HERITAGE_DESTRUCTION', 'IDENTITY_CRISIS'], simulatedOpportunities: [],
        risks: scenarios.map(function (x) { return x.risk; }), interventions: scenarios.map(function (x) { return x.intervention; }),
        falsifiers: scenarios.map(function (x) { return x.falsifier; }), lastSimulatedAt: cm.updated || null
      };
      s.cultureSimulation = sim; return sim;
    };
    // ── H6 — executive self-report (compact status card) ──
    P._computeCultureExecutiveReport = function () {
      var s = this.state, cm = s.cultureModel || {}, im = s.cultureImmune || {}, aw = s.cultureAwareness || {}, con = s.cultureConscience || {}, it = s.cultureIntuition || {}, sim = s.cultureSimulation || {};
      var bs = (typeof this._cultureBundleStates === 'function') ? this._cultureBundleStates() : [];
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
        nextBestAction: (bs.length && covered < bs.length) ? 'build/verify source for uncovered diagnoses (ensure heritage/arts-policy/streaming sources are current)' : hv > 0 ? 'human-verify external-source bundles' : 'monitor strongest diagnosis sources (scene activity, streaming/virality signals, heritage status)',
        lastReportAt: cm.updated || null
      };
      s.cultureExecutiveReport = rep; return rep;
    };
  })();

  // ════════════════════════════════════════════════════════════════════════════
  // CULTURE COGNITION PARITY — fallback loaders, source-bundle machinery, L1 mad-lib
  // scan, music-scene sub-portal layer, and the 8-section DomainDiagnosisPacket the
  // Civilization cockpit consumes. Mirrors infrastructure-brain STRUCTURE exactly;
  // only the CONTENT is cultural (music scenes, artists/creators, genres, streaming/
  // virality, fanbases, festivals/venues, heritage, the attention economy).
  // Never fabricates evidence.
  // ════════════════════════════════════════════════════════════════════════════

  // ── DDP schema helpers ──
  var CULTURE_DDP_SCHEMA_VERSION = 'culture-ddp-1';
  function _cultureDdpPresent(v) {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (v === 'missing' || v === '' || v === 'none') return false;
    return true;
  }
  function _cultureDdpCompleteness(section, keys) {
    var have = 0; for (var i = 0; i < keys.length; i++) { if (_cultureDdpPresent(section[keys[i]])) have++; }
    return { have: have, total: keys.length, pct: keys.length ? Math.round(have / keys.length * 100) : 0 };
  }

  // ── Fallback: real entities from command-board-data (state.companies starved) ──
  CultureBrain.prototype._loadCultureCommandBoardCompanies = function () {
    var self = this;
    if (self._cbCultureCompanies) return;            // one-shot
    self._cbCultureCompanies = [];
    try {
      fetch('/assets/data/command-board-data.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data) return;
          var arr = Array.isArray(data) ? data : (Object.keys(data).map(function (k) { return data[k]; }).find(Array.isArray) || []);
          self._cbCultureCompanies = arr
            .filter(function (x) { return x && x.d === 'culture' && x.t; })
            .map(function (x) { return { name: x.n, ticker: x.t, cik: x.c, phase: x.p, trajectory: x.tr }; });
        })
        .catch(function () {});
    } catch (e) {}
  };

  // ── Distress signals come ONLY from the validated Thing pipeline. One-shot. ──
  CultureBrain.prototype._loadCultureBrainSignals = function () {
    var self = this;
    if (self._pubSignals) return;                  // one-shot
    self._pubSignals = {};
    try {
      fetch('/api/brain-signals?domain=culture')
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
  //    else CULTURE_DIAGNOSIS_ALIASES. Non-aliased diagnoses are canonical to themselves. ──
  var CULTURE_DIAGNOSIS_ALIASES = {
    CULTURAL_ERASURE:      { target: 'CULTURAL_ERASURE_SYNDROME', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits CULTURAL_ERASURE_SYNDROME for identity/cohesion loss' },
    HERITAGE_DESTRUCTION:  { target: 'HERITAGE_LOSS', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits HERITAGE_LOSS for archive/monument/catalog degradation' },
    CENSORSHIP:            { target: 'NARRATIVE_MONOPOLIZATION', reviewStatus: 'human-approved', risk: 'medium', note: 'mapped to narrative-monopolization bundle; verify expression-suppression evidence is appropriate' },
    IDENTITY_CRISIS:       { target: 'CULTURAL_IDENTITY_FRACTURE', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits CULTURAL_IDENTITY_FRACTURE for value-conflict / tribal segmentation' },
    CREATIVE_STAGNATION:   { target: 'ARTIST_EXODUS', reviewStatus: 'human-approved', risk: 'medium', note: 'mapped to artist-exodus / participation-decay bundle; verify creator-economics evidence is appropriate' }
  };
  CultureBrain.prototype._resolveCultureCanonicalDiagnosis = function (dxId) {
    if (!dxId) return { canonicalDiagnosisId: null, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };
    var target = null;
    try {
      var idx = (typeof window !== 'undefined') ? window.LIMENArtifactSourceIndex : null;
      if (idx && idx.aliases) { var row = idx.aliases()[dxId]; if (row && row.target) target = row.target; }
    } catch (e) {}
    var local = CULTURE_DIAGNOSIS_ALIASES[dxId] || null;
    if (!target && local) target = local.target;
    if (target) {
      return { canonicalDiagnosisId: target, aliasUsed: true, aliasReviewStatus: (local && local.reviewStatus) || 'corpus-aliased', aliasRisk: (local && local.risk) || 'low', aliasNote: (local && local.note) || null };
    }
    return { canonicalDiagnosisId: dxId, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };   // canonical to self
  };

  // ── Load REAL source bundles (one-shot, async). Resolves aliases BEFORE fetching.
  //    Only files that exist resolve to 'found'; 404s -> 'missing'. Never fabricates. ──
  CultureBrain.prototype._loadCultureDiagnosisBundles = function () {
    var self = this;
    if (self._cultureBundleLoadPromise) return self._cultureBundleLoadPromise;
    self._bundleCache = self._bundleCache || {};
    self._bundleStatusMap = self._bundleStatusMap || {};
    var ids = {};
    var known = ['CULTURAL_ERASURE', 'HERITAGE_DESTRUCTION', 'CENSORSHIP', 'IDENTITY_CRISIS', 'CREATIVE_STAGNATION'];
    var diags = (self.state && self.state.diagnoses) || [];
    var allDxIds = diags.map(function (d) { return d.id; }).concat(known);
    for (var i = 0; i < allDxIds.length; i++) { var c = self._resolveCultureCanonicalDiagnosis(allDxIds[i]).canonicalDiagnosisId; if (c) ids[c] = true; }
    self._cultureBundleLoadPromise = Promise.all(Object.keys(ids).map(function (cid) {
      return fetch('/assets/data/artifact-source-index/by-diagnosis/' + encodeURIComponent(cid) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) { self._bundleStatusMap[cid] = data ? 'found' : 'missing'; if (data) self._bundleCache[cid] = data; })
        .catch(function () { self._bundleStatusMap[cid] = 'missing'; });
    })).then(function () { return self._bundleCache; });
    return self._cultureBundleLoadPromise;
  };

  // ── _cultureBundleStates — per-diagnosis canonical resolution + bundle status + provenance ──
  CultureBrain.prototype._cultureBundleStates = function () {
    var self = this; var diags = (this.state && this.state.diagnoses) || [];
    return diags.map(function (d) {
      var c = self._resolveCultureCanonicalDiagnosis(d.id);
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
  //    evidence. Only real artist/label/platform tickers surface (relevance-unverified). ──
  var CULTURE_MADLIB_VERB = /^(Develop|Establish|Implement|Build|Launch|Design|Deploy|Operationalize|Conduct|Create|Define|Assess|Optimize|Modernize|Strengthen|Enhance|Formalize|Institute|Standardize|Coordinate|Integrate|Calibrate|Evaluate|Streamline|Institutionalize|Configure|Monitor|Curate|Program|Activate)\b/;
  CultureBrain.prototype._isCultureMadLibTreatment = function (label) { return !label || CULTURE_MADLIB_VERB.test(String(label)); };

  CultureBrain.prototype._loadCultureL1PortalDepth = function () {
    var self = this;
    if (self._cultureL1LoadPromise) return self._cultureL1LoadPromise;
    var BRANCH = {
      CULTURAL_ERASURE: ['music', 'heritage', 'festivals'],
      HERITAGE_DESTRUCTION: ['heritage', 'museums', 'film'],
      CENSORSHIP: ['cultpolicy', 'literature', 'criticism'],
      IDENTITY_CRISIS: ['music', 'festivals', 'digital_cult'],
      CREATIVE_STAGNATION: ['music', 'visual', 'theater']
    };
    self._cultureL1Branches = BRANCH;
    var branches = {}; Object.keys(BRANCH).forEach(function (dx) { BRANCH[dx].forEach(function (b) { branches[b] = true; }); });
    var byBranch = {};
    self._cultureL1LoadPromise = Promise.all(Object.keys(branches).map(function (b) {
      return fetch('/assets/data/domains/culture_' + encodeURIComponent(b) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) {
          if (!data) { byBranch[b] = null; return; }
          var acts = data.activations || [], tickers = {}, total = 0, mad = 0;
          acts.forEach(function (a) {
            (a.companies || []).forEach(function (c) { if (c && c.ticker_or_id) tickers[c.ticker_or_id] = c.name || c.ticker_or_id; });
            (a.treatments || []).forEach(function (t) { var l = t && (t.label || t.title); if (l) { total++; if (self._isCultureMadLibTreatment(l)) mad++; } });
          });
          byBranch[b] = { file: 'culture_' + b, companyTickers: Object.keys(tickers).map(function (k) { return { ticker: k, name: tickers[k] }; }), treatmentTotal: total, madLibCount: mad, realTreatmentCount: total - mad };
        })
        .catch(function () { byBranch[b] = null; });
    })).then(function () {
      var byDiagnosis = {};
      Object.keys(BRANCH).forEach(function (dx) {
        var tk = {}, total = 0, mad = 0, scanned = 0;
        BRANCH[dx].forEach(function (b) { var r = byBranch[b]; if (r) { scanned++; r.companyTickers.forEach(function (c) { tk[c.ticker] = c.name; }); total += r.treatmentTotal; mad += r.madLibCount; } });
        byDiagnosis[dx] = { branchesScanned: scanned, realCompanyTickers: Object.keys(tk).map(function (k) { return { ticker: k, name: tk[k], relevanceUnverified: true }; }), treatmentTotal: total, madLibTreatments: mad, realTreatments: total - mad, admitted: false, reason: 'L1 treatments are mad-lib templates (fixed-verb family) — not source-grade; only artist/label/platform tickers surfaced, relevance unverified' };
      });
      self.state._l1DepthCache = { byBranch: byBranch, byDiagnosis: byDiagnosis, scannedAt: (self.state.cultureModel && self.state.cultureModel.updated) || null };
      return self.state._l1DepthCache;
    });
    return self._cultureL1LoadPromise;
  };

  // ── SCENE sub-portal layer (counterpart to infrastructure's grid layer; energy's data-center).
  //    The music scene = the canonical cultural sub-portal: real-content, citation-backed scene
  //    diagnoses + treatments. NEVER merged into the validated diagnosis spine. ──
  CultureBrain.prototype._loadCultureSceneLayer = function () {
    var self = this;
    if (self._cultureSceneLoadPromise) return self._cultureSceneLoadPromise;
    // Prefer a dedicated culture_scene.json if present; fall back to the music sub-portal
    // (the canonical music scene). Both share the issues/activations shape. Graceful 404.
    self._cultureSceneLoadPromise = fetch('/assets/data/domains/culture_scene.json')
      .then(function (r) { return (r && r.ok) ? r.json() : null; })
      .then(function (data) { if (data) return data; return fetch('/assets/data/domains/culture_music.json').then(function (r2) { return (r2 && r2.ok) ? r2.json() : null; }); })
      .then(function (data) {
        if (!data) { self._scenePortal = null; return null; }
        self._scenePortal = { issues: data.issues || [], activations: data.activations || [], title: data.title || 'Music Scene' };
        return self._scenePortal;
      })
      .catch(function () { self._scenePortal = null; return null; });
    return self._cultureSceneLoadPromise;
  };

  CultureBrain.prototype._buildCultureSceneLayer = function () {
    var self = this;
    var sp = self._scenePortal;
    if (!sp || !sp.issues || !sp.issues.length) {
      self.state.sceneDiagnoses = [];
      self.state.sceneTreatments = [];
      self.state.cultureSceneDomainDiagnosisPackets = [];
      self.state.sceneLayer = { loaded: false, count: 0, activeCount: 0, diagnoses: [], note: 'culture scene sub-portal not loaded (offline or fetch failed)' };
      return self.state.sceneLayer;
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
        source: 'scene', tier: 'real-content-unbundled', branch: 'scene'
      };
    });
    // 2) treatments — pull from scene node activations whose brainNodeId is in a diagnosis circuit
    var nodeToDx = {};
    diagnoses.forEach(function (d) { (d.circuits || []).forEach(function (c) { if (c && c.nodeId) nodeToDx[c.nodeId] = d.id; }); });
    var treatments = [];
    (sp.activations || []).forEach(function (act) {
      var dxId = nodeToDx[act.brainNodeId];
      if (!dxId) return;
      (act.treatments || []).forEach(function (t, ti) {
        treatments.push({
          id: 'scene_treat_' + act.brainNodeId + '_' + ti,
          label: t.label, type: t.type, evidence: t.evidence, description: t.description || '',
          cite: t.cite || null, citation: t.citation || [], steps: t.steps || [],
          diagnosisId: dxId, nodeId: act.brainNodeId,
          source: 'scene', madLib: self._isCultureMadLibTreatment ? self._isCultureMadLibTreatment(t.label) : false
        });
      });
    });
    var evidenceRank = { A: 10, Strong: 10, B: 7, Moderate: 7, C: 4, Emerging: 1 };
    treatments.sort(function (a, b) { return (evidenceRank[b.evidence] || 0) - (evidenceRank[a.evidence] || 0); });
    self.state.sceneDiagnoses = diagnoses;
    self.state.sceneTreatments = treatments;
    // 3) compact layer summary (read by every DDP's promptView)
    self.state.sceneLayer = {
      loaded: true,
      portalTitle: sp.title,
      count: diagnoses.length,
      activeCount: diagnoses.filter(function (d) { return d.active; }).length,
      diagnoses: diagnoses.map(function (d) {
        var rc = self._resolveCultureCanonicalDiagnosis ? self._resolveCultureCanonicalDiagnosis(d.id) : { canonicalDiagnosisId: d.id };
        var bsStat = (self._bundleStatusMap && self._bundleStatusMap[rc.canonicalDiagnosisId]) || 'missing';
        return { id: d.id, label: d.label, active: d.active, branch: 'scene', canonicalDiagnosisId: rc.canonicalDiagnosisId, bundleStatus: bsStat, treatmentCount: treatments.filter(function (t) { return t.diagnosisId === d.id; }).length };
      }),
      note: 'real-content (music-scene) sub-portal diagnoses for the live scene (artists, venues, festivals, streaming/virality); SEPARATE from the validated diagnosis spine; no external artifact-source bundle yet; never admitted to evidenceAnchors'
    };
    // 4) per-diagnosis DDPs via the SAME schema builder (canonical-to-self; bundle 'missing')
    self.state.cultureSceneDomainDiagnosisPackets = diagnoses.map(function (d) {
      try { return self._buildDomainDiagnosisPacket(d); } catch (e) { return null; }
    }).filter(Boolean);
    return self.state.sceneLayer;
  };

  // ── DDP — the 8-section DomainDiagnosisPacket the Civilization cockpit consumes.
  //    Mirrors infrastructure's _buildDomainDiagnosisPacket exactly; only the CONTENT is cultural. ──
  CultureBrain.prototype._buildDomainDiagnosisPacket = function (dx) {
    var s = this.state || {};
    var cm = s.cultureModel || {};
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

    var _canon = this._resolveCultureCanonicalDiagnosis(dxId);
    var identity = {
      domain: 'culture',
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
    var _bl = (_bundle && _bundle.byLane && _bundle.byLane.patents) ? _bundle.byLane.patents : null;
    var _bArr = function (k) { return (_bl && Array.isArray(_bl[k])) ? _bl[k] : []; };
    var bundleStatus = _bundle ? 'found' : (_bundleKnown ? 'missing' : 'unknown');
    var bundleShallow = !!(_bundle && ((_bundle.maxDepth || 0) === 0 || (_bundle.portalCount || 0) <= 1));
    var bundleResolution = identity.aliasUsed
      ? (_bundle ? 'alias-resolved-and-bundle-found' : 'alias-resolved-but-bundle-missing')
      : (_bundle ? 'found' : (_bundleKnown ? 'missing' : 'unknown'));
    if (!treatments.length && _bl) treatments = _bArr('treatments');             // backfill from REAL bundle only
    if (!implementationSteps.length && _bl) implementationSteps = _bArr('implementationSteps');
    var brainState = {
      cultureModel: { version: cm.version || null, cycle: (typeof cm.cycle === 'number' ? cm.cycle : null) },
      predictionError: cm.predictionError || null,
      regulationState: (cm.regulation && cm.regulation.state) || null,
      prior: cm.prior || null,
      observation: cm.observation || null,
      plasticity: cm.plasticity || null,
      readyForHandoff: cm.readyForHandoff === true
    };
    // Domain-identity portal fields are KNOWN facts (this IS the culture root).
    var rootId = (portal && portal.domainId) || 'culture';
    var rootTitle = (portal && portal.title) || 'Culture';
    var ancestry = (portal && portal.parentLabel) ? [portal.parentLabel, rootTitle] : [rootTitle];
    var portalContext = {
      portalIds: [rootId],
      portalDomain: 'culture',
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
      bundle: _bundle ? { portalCount: _bundle.portalCount || 0, maxDepth: _bundle.maxDepth || 0, domains: _bundle.domains || [], lane: 'patents', shallow: bundleShallow, buildMethod: _bundle.buildMethod || null, humanVerification: _bundle.humanVerification || null } : null,
      missingEvidence: missingEv
    };
    // Human-authoring intake: for external-source bundles missing candidates, emit structured
    // empty slots (what each needs + which CULTURAL primary source) rather than fabricating.
    var _isExternal = !!(_bundle && _bundle.buildMethod === 'external-source-authored');
    var _intakeSrcHint = {
      CULTURAL_ERASURE_SYNDROME: 'UNESCO cultural-diversity reports / national arts-council statistics / census cultural-participation data',
      HERITAGE_LOSS: 'UNESCO World Heritage in Danger list / national heritage registries / archive + venue inventories',
      NARRATIVE_MONOPOLIZATION: 'Freedom House / RSF press-freedom index / platform transparency reports / antitrust filings',
      CULTURAL_IDENTITY_FRACTURE: 'arts-participation surveys (NEA SPPA) / social-cohesion studies / audience-segmentation research',
      ARTIST_EXODUS: 'streaming-royalty disclosures (SPOT/UMG/WMG filings) / creator-economy reports / union (SAG-AFTRA, AFM) data'
    };
    var authoringIntake = [];
    if (_isExternal) {
      ['methodCandidates', 'embodimentCandidates', 'figurePlaceholders'].forEach(function (field) {
        if (_bArr(field).length === 0) authoringIntake.push({ field: field, status: 'needs-human-input', count: 0, need: field === 'methodCandidates' ? 'a concrete cultural-programming/preservation method drawn from a primary source' : field === 'embodimentCandidates' ? 'a specific implementation/embodiment from a real document' : 'a figure description grounded in a real source', sourceHint: _intakeSrcHint[identity.canonicalDiagnosisId] || 'primary institutional / cultural-policy source', note: 'NOT fabricated by the brain — author from the cited source, then wire in verbatim with attribution' });
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
    // Lanes are INVESTABLE (culture companies / artists / platforms) / RESEARCHABLE (cultural briefs).
    // patent/grant are VETOED by conscience (lanes retired 2026-06-21; no method/embodiment fields).
    var artifactContext = {
      artifactLanes: artifactLanes,
      patentReady: false, grantReady: false, sbaReady: false,   // patent/grant/loan vetoed by H3 conscience
      investmentReady: !!(hasTreat && primaryOpp), researchReady: ready || hasTreat,
      readinessReasons: readinessReasons,
      blockers: blockers
    };

    var comp = {
      identity:         _cultureDdpCompleteness(identity, ['domain', 'diagnosisId', 'canonicalDiagnosisId', 'label', 'phase', 'confidence']),
      brainState:       _cultureDdpCompleteness(brainState, ['cultureModel', 'predictionError', 'regulationState', 'prior', 'observation', 'plasticity']),
      portalContext:    _cultureDdpCompleteness(portalContext, ['portalIds', 'portalDomain', 'portalTitle', 'depth', 'ancestryPath']),
      evidence:         _cultureDdpCompleteness(evidence, ['sourceFeeds', 'evidenceAnchors', 'citationHints']),
      treatmentContext: _cultureDdpCompleteness(treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']),
      operatorContext:  _cultureDdpCompleteness(operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']),
      artifactContext:  _cultureDdpCompleteness(artifactContext, ['artifactLanes'])
    };
    var totHave = 0, totAll = 0;
    for (var sk in comp) { if (comp.hasOwnProperty(sk)) { totHave += comp[sk].have; totAll += comp[sk].total; } }
    var missingFields = [];
    function _cmf(name, obj, keys) { for (var i = 0; i < keys.length; i++) { if (!_cultureDdpPresent(obj[keys[i]])) missingFields.push(name + '.' + keys[i]); } }
    _cmf('identity', identity, ['canonicalDiagnosisId', 'confidence']);
    _cmf('evidence', evidence, ['evidenceAnchors', 'citationHints']);
    _cmf('treatmentContext', treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']);
    _cmf('operatorContext', operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']);

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
    if (!primaryOpp && (typeof s.stress !== 'number' || s.stress < CM_STRESS_FLOOR)) warnings.push('no active opportunity (offline/low-stress) — operator/lane fields stay empty');
    if (artifactContext.artifactLanes.length && !hasTreat) warnings.push('artifact lane present but treatments/evidence missing');

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
        'diagnosis-specific bundle anchors preferred over generic culture evidence',
        'official/primary sources retained (UNESCO/NEA/Freedom House/streaming filings where present)',
        'mechanisms prioritized over figures under prompt-space limits',
        'treatments with implementation relevance preferred over broad narrative',
        'caps applied per field; full data preserved in the stored bundle + full DDP'
      ],
      retainedWarnings: warnings
        .concat(s.cultureImmune ? ['immune: ' + s.cultureImmune.immuneState + ' (sev ' + s.cultureImmune.severity + ', ' + (s.cultureImmune.antigens || []).length + ' antigens; L2 traversal blocked)'] : [])
        .concat(s.cultureConscience && s.cultureConscience.conscienceState === 'restrictive' ? ['conscience: ' + (s.cultureConscience.blockedClaims || []).slice(0, 3).join(', ') + ' blocked'] : []),
      retainedBlockers: artifactContext.blockers,
      // higher-layer compact summaries (forwarded to the finalizer via promptView)
      immuneSummary: s.cultureImmune ? { immuneState: s.cultureImmune.immuneState, severity: s.cultureImmune.severity, antigenCount: (s.cultureImmune.antigens || []).length, quarantines: s.cultureImmune.quarantines, blockedFromTraversal: s.cultureImmune.blockedFromTraversal, allowedWithWarning: s.cultureImmune.allowedWithWarning } : null,
      awarenessSummary: s.cultureAwareness ? { selfNarrative: s.cultureAwareness.selfNarrative, knowns: (s.cultureAwareness.knowns || []).length, uncertainties: (s.cultureAwareness.uncertainties || []).length } : null,
      conscienceDecision: s.cultureConscience ? { conscienceState: s.cultureConscience.conscienceState, blockedClaims: s.cultureConscience.blockedClaims, artifactReadinessDecision: s.cultureConscience.artifactReadinessDecision } : null,
      intuitionSummary: s.cultureIntuition ? s.cultureIntuition.hunches : null,
      scenarioSummary: s.cultureSimulation ? (s.cultureSimulation.scenarios || []).map(function (x) { return { type: x.type, hypothetical: x.hypothetical, risk: x.risk }; }) : null,
      executiveReport: s.cultureExecutiveReport || null,
      l1DepthSummary: portalContext.l1Depth ? { realCompanyTickers: (portalContext.l1Depth.realCompanyTickers || []).length, realTreatments: portalContext.l1Depth.realTreatments, madLibTreatments: portalContext.l1Depth.madLibTreatments, admitted: portalContext.l1Depth.admitted } : null,
      authoringIntake: treatmentContext.authoringIntake.length ? treatmentContext.authoringIntake : null,
      // SCENE — music-scene sub-portal layer (real-content, SEPARATE from the validated spine, no bundle yet)
      cultureSummary: s.sceneLayer && s.sceneLayer.loaded ? { count: s.sceneLayer.count, activeCount: s.sceneLayer.activeCount, diagnoses: s.sceneLayer.diagnoses, note: s.sceneLayer.note } : null
    };

    return {
      schemaVersion: CULTURE_DDP_SCHEMA_VERSION,
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
        schemaVersion: CULTURE_DDP_SCHEMA_VERSION,
        fieldCompleteness: { sections: comp, overallPct: pct },
        missingFields: missingFields,
        warnings: warnings,
        proofTier: proofTier,
        immune: s.cultureImmune || null,
        awareness: s.cultureAwareness || null,
        conscience: s.cultureConscience || null,
        intuition: s.cultureIntuition || null,
        simulation: s.cultureSimulation || null,
        executiveReport: s.cultureExecutiveReport || null
      }
    };
  };

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
