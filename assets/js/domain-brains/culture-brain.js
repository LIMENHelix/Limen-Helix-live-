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

    // ── ACTUATION GATE (2026-07-13) — per-actuation validity, decided HONESTLY for culture ──
    //   refractory : VALID — real effector = action-draft emission (Neuro Ref III.3 refractory de-dup).
    //   servo      : VALID — culture has a real inhibition term (cultureModel.regulation.inhibition);
    //                effector = proportional opportunity-confidence dampening (Neuro Ref V.2/XII/XIII.1).
    //   eiBrake    : VALID — consumes the servo emissionFactor; same emission channel (Neuro Ref XIII.1).
    //   phase      : INVALID → ADVISORY-ONLY. Culture's domain phase is P9 and culture has NO Thing1-
    //                validated distress signal (its own awareness layer states diagnoses are interpretive,
    //                not validated; _pubSignals is {} — the validated gate abstains). So the phase-
    //                transition REWARD can never honestly be a ground-truth teaching signal here. The
    //                coherence router still runs OBSERVE-ONLY (see _computeCulturePhaseDynamics), but the
    //                reward NEVER preempts the K4 credit ledger and NEVER opens an opportunity cap.
    //   (selfAudit = the diaschisis/SPOF read on culture's real edge graph is VALID and consumed
    //                observe-only; it is not a behaviour-changing actuation, so it has no flag here.)
    // All actuations are DETERMINISTIC — no paid-AI / LLM fetch ever runs on the 30s cycle.
    this._actuation = { overlays: true, overlays: true, refractory: true, servo: true, eiBrake: true, phase: false };
    this._refractoryParams = {
      absoluteWindow: 900000,     // 15 min hard dead-time (operator-set; not in the document)
      relativeWindow: 3600000,    // 1 hr raised-bar window (1:4 ratio preserved)
      overrideThreshold: 0.9      // reduced sensitivity: only stress >= 0.9 re-fires in-window
    };

    // ── THING2 RECURSIVE-PHASE KERNEL as the phase source (2026-07-13, operator-approved) ──
    // The phase-coherence router and phase-transition READOUT previously read s.phase (a naive
    // per-cycle guess / static PHASE_M lineage). We now feed those from the REAL Thing2 kernel
    // (assets/js/limen-thing2-adapter.js -> window.LIMENThing2.phaseOfSeries), run over culture's
    // own primary STRESS scalar (this.state.stress; up = worse -> positive:false). The kernel is
    // PURE MATH (no network, no AI) so the 30s cycle stays deterministic. Output is INTERPRETIVE
    // posture only (interpretive:true, validated:false) — culture stays P9 with no validated
    // envelope, so the transition READOUT remains advisory (never a ground-truth reward; K4 is
    // NOT preempted, _actuation.phase stays false). Fallback: adapter absent or history < 8 ->
    // _kernelPhase stays null and the existing s.phase drives the router unchanged.
    this._kernelPhase = null;
    this._phaseSeries = [];
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        var _ps = JSON.parse(localStorage.getItem('limen:phaseseries:culture'));
        if (Array.isArray(_ps)) this._phaseSeries = _ps;
      }
    } catch (e) { this._phaseSeries = this._phaseSeries || []; }

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
      // Neuro-substrate telemetry (advisory): brain state (pulse-less capable) -> runtime overlay via generic adapter.
      try {
        if (window.DomainTelemetryAdapter && typeof window.DomainTelemetryAdapter.fromLiveCached === "function") {
          window.DomainTelemetryAdapter.fromLiveCached("culture", self.state, self._runtimeOverlay || null)
            .then(function (ov) { if (ov) self._runtimeOverlay = ov; }).catch(function () {});
        }
      } catch (_e) {}
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
    for (var i = 0; i < activeDx.length; i++) { var dx = activeDx[i]; if (adapters.getDrafts && adapters.getDrafts({ domain: 'culture', intentId: dx.id }).length > 0) continue;
      // REFRACTORY DE-DUP (Neuro Ref III.3) — real effector = action-draft emission. Absolute dead-time:
      // no re-draft of the SAME diagnosis within absoluteWindow. Relative window: a raised bar — re-draft
      // only if stress cleared overrideThreshold OR exceeds the last firing's stress. Deterministic.
      if (this._actuation && this._actuation.refractory) {
        var rp = this._refractoryParams || {}; var now = Date.now();
        this._cultureRefractory = this._cultureRefractory || {};
        var last = this._cultureRefractory[dx.id];
        if (last) {
          var age = now - last.t;
          if (age < (rp.absoluteWindow || 900000)) continue;                                    // absolute dead-time
          if (age < (rp.relativeWindow || 3600000) &&
              (this.state.stress || 0) < (rp.overrideThreshold || 0.9) &&
              (this.state.stress || 0) <= (last.stress || 0)) continue;                           // raised-threshold window
        }
        this._cultureRefractory[dx.id] = { t: now, stress: this.state.stress || 0 };
      }
      adapters.createDraft('REPORT_GENERATION', { domain: 'culture', sourceType: 'domain_brain', sourceId: dx.id, intentId: dx.id, title: 'Culture Alert: ' + dx.label, intent: { domain: 'culture', title: dx.label, status: 'ACTIVE', priority: this.state.stress, progress: 0, strategyType: 'diagnosis_response', steps: [{ type: 'ANALYZE', label: 'Assess ' + dx.label + ' impact on cultural systems', status: 'PENDING' }, { type: 'INVESTIGATE', label: 'Identify affected communities, institutions, and creative ecosystems', status: 'PENDING' }, { type: 'POSITION', label: 'Evaluate restoration and resilience opportunities', status: 'PENDING' }] } }); }
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
      try { self._computeCultureOverlays(); } catch (e) {}   // NEURO-SUBSTRATE OVERLAY WIRING (per-domain, ported from energy 2026-07-21): invokes culture's OWN overlay modules each cycle; shadow, proposals only
    });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // NEURO-SUBSTRATE OVERLAY WIRING — per-domain copy of energy's _computeEnergyOverlays
  // (2026-07-21, full per-domain independence). Invokes culture's OWN modules
  // (window.Culture{Metaplasticity,Extinction,RetrogradeThrottle,PredictionErrorCompressor,
  // OfflineMaintenance,NeuroSubstrate,ConnectivityAudit}) against culture's OWN runtime def
  // (culture.json runtime.params + edges/issues/activations). SHADOW: writes state.cultureOverlays;
  // the only actuation is metaplasticity -> the refractory dead-time (matches energy exactly).
  // Degrade-safe: returns mode 'off' when the modules are not on the page (they load only on the
  // culture console), 'loading' until culture.json arrives.
  // ════════════════════════════════════════════════════════════════════════════
  CultureBrain.prototype._loadCultureDef = function () {
    if (this._cultureDef) return this._cultureDef;
    if (this._cultureDefLoading) return null;
    this._cultureDefLoading = true;
    var self = this;
    if (typeof fetch === 'function') {
      try {
        fetch('/assets/data/domains/culture.json').then(function (r) { return r.json(); })
          .then(function (def) { self._cultureDef = def; })
          .catch(function () { self._cultureDefLoading = false; });
      } catch (e) { this._cultureDefLoading = false; }
    }
    return null;
  };

  CultureBrain.prototype._computeCultureOverlays = function () {
    var s = this.state;
    function mod(glob, reqPath) {
      if (typeof window !== 'undefined' && window[glob]) return window[glob];
      if (typeof module !== 'undefined') { try { return require(reqPath); } catch (e) {} }
      return null;
    }
    var META = mod('CultureMetaplasticity', '../culture-metaplasticity.js');
    var EXT = mod('CultureExtinction', '../culture-extinction.js');
    var RETRO = mod('CultureRetrogradeThrottle', '../culture-retrograde-throttle.js');
    var PEC = mod('CulturePredictionErrorCompressor', '../culture-prediction-error-compressor.js');
    var OFF = mod('CultureOfflineMaintenance', '../culture-offline-maintenance.js');
    var NS = mod('CultureNeuroSubstrate', '../culture-neuro-substrate.js');
    var CONN = mod('CultureConnectivityAudit', '../culture-connectivity-audit.js');
    if (!(META && EXT && RETRO && PEC && OFF && NS && CONN)) {
      s.cultureOverlays = { version: 1, mode: 'off', note: 'overlay modules not loaded on this page (present only on the culture console)' };
      return null;
    }
    var def = this._loadCultureDef();
    if (!def) { s.cultureOverlays = { version: 1, mode: 'loading', note: 'culture.json runtime def loading; overlays compute next cycle' }; return null; }

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

    var intero = s.cultureInteroception || (s.cognition && s.cognition.interoception) || {};
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

    s.cultureOverlays = {
      version: 1, mode: 'shadow', armed: armed,
      volatility: Math.round(volatility * 1000) / 1000,
      metaplasticity: { changes: meta.changes, adapted: adapted, noop: meta.noop },
      extinction: { candidates: ext.candidates, count: ext.candidates.length, noop: ext.noop, actuation: 'PROPOSAL-ONLY (retiring a node edits culture.json — human-gated forever)' },
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
    s.cultureOverlays.mode = armed ? 'armed' : 'shadow';
    s.cultureOverlays.applied = applied;
    s.cultureOverlays.actuationScope = 'metaplasticity->refractory dead-time ONLY (bounded, fail-toward-quiet, reversible). throttle=no-live-consumer; PE=observe-only; extinction+offline-prune=PROPOSAL-ONLY (remove structure, human-gated forever).';
    s.cultureOverlays.note = 'PER-DOMAIN OVERLAY WIRING (ported from energy): culture runs its OWN 6 overlay modules + connectivity recurrenceAudit each cycle on culture.json. ARMED: metaplasticity raises the refractory dead-time with volatility (clamped, reversible). Everything else is proposal/observe-only.';

    if (s.cognition && typeof s.cognition === 'object') s.cognition.overlays = s.cultureOverlays;
    return s.cultureOverlays;
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
      // K5 CLOSED — deep-perception error sourced from the perception-depth layer (prior cycle; 0 on cycle 1).
      var _pd = this.state.culturePerceptionDepth;
      var portalError = (_pd && typeof _pd.portalErrorEstimate === 'number') ? _pd.portalErrorEstimate : 0;
      var total = _cmClamp(0.35 * se + 0.2 * sg + 0.25 * de + 0.15 * oe + 0.05 * portalError, 0, 1);
      return { total: total, stressError: se, signalError: sg, diagnosisError: de, opportunityError: oe, portalError: portalError, novelty: Math.max(se, de) };
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

      // ── ACTUATION: PHASE-COHERENCE ROUTER (ADVISORY ONLY — culture P9, no validated p3/p7) ──
      //    Runs observe-only every cycle; it NEVER gates a decision. See _computeCulturePhaseDynamics.
      try { this._computeCulturePhaseDynamics(); } catch (e) {}
      // ── ACTUATION: REGULATE-TO-TARGET SERVO (E/I). Reads reg.inhibition + the generic homeostasis
      //    deviation (domainNeuro, prior cycle); effector = proportional opportunity dampening below. ──
      try { if (this._actuation && this._actuation.servo) this._computeCultureServo(); } catch (e) {}

      // K8 CLOSED — homeostatic set-point: handoff gates on a 50/50 blend of the fixed floor and
      // the adaptive baseline (prior cycle; needs >=10 samples, else the fixed floor). Bound the
      // adaptive floor to at most +0.15 above the fixed floor so a sustained-stress baseline cannot
      // ratchet the handoff gate out of reach.
      var _hm = this.state.cultureHomeostasis;
      var _floor = (_hm && typeof _hm.adaptiveBaseline === 'number' && _hm.samples >= 10)
        ? _cmClamp(Math.min(0.5 * CM_STRESS_FLOOR + 0.5 * _hm.adaptiveBaseline, CM_STRESS_FLOOR + 0.15), 0.15, 0.6) : CM_STRESS_FLOOR;
      cm._effectiveFloor = _floor;
      var readyForHandoff = (cm.cycle > 0) && (predictedStress >= _floor) && (obs.diagnosisCount > 0) && !reg.flooding && !reg.stale;

      // ── K4 CREDIT-SOURCE HOOK — credit assignment routed through the central honest reward gate
      //    (window.LIMENK4.credit; mirrors energy-brain.js). Culture is NOT externalRewardEligible:
      //    it is P9 with no Thing1-validated distress / external realized-outcome label, so
      //    externalOutcome is ALWAYS null and its credit is self-consistency calibration only
      //    (interpretive), NEVER reward. The gate enforces the preemption: external-reward(4) >
      //    phase-consistency(3) > call-consistency(2) > stress-consistency(1) > none. A low hit-rate
      //    raises the effective learning rate. Pure math — no AI/network on the 30s cycle. Reversible. ──
      var _lr = cm.plasticity.learningRate;
      // thing2 realized phase transition — did a predicted transition realize over time. This is
      // SELF-CONSISTENCY calibration (interpretive), NOT an external/dopaminergic reward. validated
      // => P3/P7 family gate. One-cycle lag; live ONLY when phase actuation is on — culture keeps
      // _actuation.phase=false, so this stays null/advisory and never preempts the credit ledger.
      var _pt = (this.state.culturePhaseDynamics || {}).transition;
      var _ptActive = !!(this._actuation && this._actuation.phase && _pt && _pt.hit !== null);
      var _led = (this.state.domainNeuro || {}).outcomeLedger || null;   // TRUTH BRAKE ledger
      var _om = this.state.cultureOutcomeModel;                          // realized-stress self-prediction
      // Signal built from what the brain already computed. externalOutcome MUST be null (not eligible).
      var _sig = {
        externalOutcome: null,                                           // NOT eligible: self-consistency only, never reward
        phaseValidated: !!(_pt && _pt.validated),                        // P3/P7 family gate for phase-consistency tier — self-consistency, NOT external reward
        phaseTransitionHit: _ptActive ? (_pt.hit ? 1 : 0) : null,        // thing2 transition hit (interpretive)
        callHitRate: (_led && typeof _led.hitRate === 'number') ? _led.hitRate : null,     // TRUTH BRAKE ledger
        callSamples: (_led && typeof _led.samples === 'number') ? _led.samples : 0,
        stressSelfPred: (_om && typeof _om.hitRate === 'number') ? _om.hitRate : null,      // stress self-prediction
        stressSamples: (_om && typeof _om.samples === 'number') ? _om.samples : 0
      };
      var _k4 = (typeof window !== 'undefined' && window.LIMENK4 && typeof window.LIMENK4.credit === 'function')
        ? window.LIMENK4.credit(_sig) : null;
      var _hit, _creditSource, _isReward;
      if (_k4) {
        _hit = (typeof _k4.credit === 'number') ? _k4.credit : null;
        _creditSource = _k4.creditSource;
        _isReward = !!_k4.isReward;                                       // ALWAYS false for culture (not externalRewardEligible)
      } else {
        // FALLBACK (gate absent) — prior credit behavior preserved, same preemption, in-line.
        var _phaseReward = _ptActive && !!_pt.validated;
        var _fromLedger = !_phaseReward && !!(_led && typeof _led.hitRate === 'number' && _led.samples >= 3);
        _hit = _phaseReward ? (_pt.hit ? 1 : 0)
          : _fromLedger ? _led.hitRate
          : (_om && typeof _om.hitRate === 'number' && _om.samples >= 5) ? _om.hitRate : null;
        _creditSource = _phaseReward ? 'phase-consistency' : (_fromLedger ? 'call-consistency' : (_hit !== null ? 'stress-consistency' : 'none'));
        _isReward = false;                                               // self-consistency only; never reward
      }
      if (_hit !== null) _lr = _cmClamp(_lr * (1 + (1 - _hit)), CM_SLOW_RATE, 0.6);
      cm._effectiveLearningRate = _lr;
      cm._creditSource = _creditSource;
      cm._creditIsReward = _isReward;                                     // honest flag: false unless a real external outcome fed the gate
      var nextPrior = this._updateCulturePrior(priorIn, obs, _lr);
      cm.cycle += 1; cm.observation = obs; cm.predictionError = pe; cm.predictedStress = predictedStress; cm.regulation = reg; cm.readyForHandoff = readyForHandoff; cm.prior = nextPrior; cm.updated = obs.timestamp;
      this.state.cultureModel = cm;

      var mem = this.state.memory || (this.state.memory = {});
      var log = mem.outcomeLog || (mem.outcomeLog = []);
      log.push({ cycle: cm.cycle, predictionError: Math.round(pe.total * 1000) / 1000, stress: obs.stress, activeDx: obs.diagnosisCount, regulation: reg.state, timestamp: obs.timestamp }); if (log.length > 40) log.shift();

      try { this._computeCultureHigherLayers(); } catch (e) {}

      // ── PHASE K — neuro-completion layers K1-K8 (additive; runs after higher-layers). K5 reads the
      //    L1/scene caches, K8 reads stress history — all at one-cycle lag, like Energy. K4/K5/K8 feed
      //    the recurrent spine (one-cycle lag); K1/K2/K6/K7 compute-and-expose. Deterministic; no
      //    network / paid-AI call. ──
      try { this._computeCultureNeuroLayers(); } catch (e) {}

      // ── ACTUATION: E/I BRAKE (XIII.1) — dampen emitted-opportunity confidence PROPORTIONALLY to the
      //    servo's inhibition deficit vs drive. Effector = the same emission channel the generic brake
      //    gate uses. Opportunities are rebuilt fresh each cycle by surfaceOpportunities, so no compounding. ──
      try { if (this._actuation && this._actuation.eiBrake) this._applyCultureEIBrake(); } catch (e) {}
      // ── E/I balance + self-audit ADVISORIES (observe-only; Neuro Ref XIII.1 + XIV). Consumes culture's
      //    REAL edge graph (from culture.json) for single-points-of-failure. Never mutates scoring. ──
      try { cm.regulationAdvisories = this._computeCultureRegulationAdvisories(); } catch (e) { cm.regulationAdvisories = null; }

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
        neuro: this.state.cultureNeuro || null,   // K1-K8 neuro-completion roll-up (additive)
        // ── actuation surfaces (additive; consumers read these uniformly) ──
        cultureServo: this.state.cultureServo || null,
        cultureEIBrake: this.state.cultureEIBrake || null,
        culturePhaseDynamics: this.state.culturePhaseDynamics || null,
        cultureRegulationAdvisories: this.state.cultureRegulationAdvisories || null,
        servo: this.state.cultureServo || null,
        phaseDynamics: this.state.culturePhaseDynamics || null,
        regulationAdvisories: this.state.cultureRegulationAdvisories || null,
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
  // PHASE K — CULTURE NEURO-COMPLETION LAYERS (culture-local, additive, reversible).
  // Faithful port of energy-brain.js K1-K8. Fills the eight brain functions the
  // self-model map flagged as missing/open-loop, reading THIS domain's state/edges:
  //   K1 afferent inter-brain integration, K2 neuromodulatory gain, K3 slow
  //   consolidation, K4 outcome/credit learning (SELF-CONSISTENCY / TRUTH-BRAKE —
  //   realized-stress self-prediction, NOT an external/dopaminergic reward),
  //   K5 deep-perception depth, K6 attention, K7 lateral inhibition, K8 homeostatic
  //   set-point. Every layer COMPUTES and EXPOSES its signal on state. The loops that
  //   culture's architecture supports without the opportunity-gating machinery close
  //   the same way Energy's do (one-cycle lag): K4 hitRate -> effective learning rate,
  //   K8 adaptiveBaseline -> handoff floor, K5 portalError -> prediction error. K1/K2/
  //   K6/K7 compute-and-expose (advisory). 100% DETERMINISTIC: reads cached state only,
  //   adds NO network / paid-AI / LLM call, never fabricates evidence.
  // ════════════════════════════════════════════════════════════════════════════
  var CK_OUTCOME_BUFFER = 40;     // rolling predicted-vs-realized samples
  var CK_HOMEO_WINDOW = 60;       // cycles of stress baseline for the adaptive set-point

  // K1 — afferent inter-brain integration. Surfaces received cross-domain pressure
  // (receiveExternalSignal/getExternalPressure) and the stress delta it folds in; the
  // culture scoreStress path already applies externalPressure (base-capped at 0.3).
  CultureBrain.prototype._computeCultureAfferent = function () {
    var s = this.state, cm = s.cultureModel || {};
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
      externalPressure: Math.round(pressure * 1000) / 1000,      // base-capped at 0.3
      receivedSignalCount: raw.length,
      activeSignalCount: active,
      contributors: contributors.slice(0, 6),
      integrated: true,
      appliedStressDelta: Math.round(((s._externalPressureApplied) || 0) * 1000) / 1000,
      wouldRaiseStressBy: Math.round(pressure * 1000) / 1000,
      note: 'CLOSED: culture folds externalPressure into stress each cycle (base scoreStress), matching the other domains.',
      lastAfferentAt: cm.updated || now
    };
    s.cultureAfferent = af; return af;
  };

  // K2 — neuromodulatory gain application. reg.gain/inhibition are computed by
  // _computeCultureRegulation; gain reaches predictedStress via the gainBlend. This shows
  // the graded output modulation on opportunities (outputScale derived from inhibition).
  CultureBrain.prototype._computeCultureGainControl = function () {
    var s = this.state, cm = s.cultureModel || {}, reg = cm.regulation || {};
    var opps = s.opportunities || [];
    var outputScale = (typeof reg.outputScale === 'number') ? reg.outputScale
      : _cmClamp(1 - (typeof reg.inhibition === 'number' ? reg.inhibition : 0) * 0.5, 0.2, 1);
    var wouldCapAt = Math.max(1, Math.round(opps.length * outputScale));
    var gc = {
      version: 1,
      gain: (typeof reg.gain === 'number') ? reg.gain : null,
      inhibition: (typeof reg.inhibition === 'number') ? reg.inhibition : null,
      outputScale: Math.round(outputScale * 1000) / 1000,
      currentOpportunityCount: opps.length,
      wouldCapOpportunitiesAt: wouldCapAt,                        // gain-scaled ranked cut (advisory)
      wouldSuppress: Math.max(0, opps.length - wouldCapAt),
      appliedTargets: ['predictedStress (gain-blend)'],
      unappliedTargets: ['opportunity output (no _applyNeuroGating in culture)', 'stress', 'treatment surfacing'],
      shadow: true,
      note: 'ADVISORY: gain reaches predictedStress via gainBlend; outputScale exposed but not applied to opportunity output (culture has no gating layer).',
      lastGainAt: cm.updated || Date.now()
    };
    s.cultureGainControl = gc; return gc;
  };

  // K3 — slow consolidation / long-term plasticity. Maintains a PARALLEL slow-weight track
  // (CM_SLOW_RATE) that never touches cm.prior; fast-vs-slow divergence is a regime-shift cue.
  CultureBrain.prototype._consolidateCultureSlowModel = function () {
    var s = this.state, cm = s.cultureModel || {}, obs = cm.observation || null;
    var slow = s.cultureSlowModel || {
      version: 1, cycle: 0,
      slow: { expectedStress: 0.5, expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, samples: 0 },
      rate: CM_SLOW_RATE, note: 'parallel slow-weight track (CM_SLOW_RATE); does NOT touch cm.prior'
    };
    if (obs) {
      var r = CM_SLOW_RATE, w = slow.slow;
      w.expectedStress = _cmClamp(w.expectedStress + r * ((obs.stress || 0) - w.expectedStress), 0, 1);
      w.expectedSignal = _cmClamp(w.expectedSignal + r * ((obs.signal || 0) - w.expectedSignal), 0, 1);
      w.expectedDiagnosisCount = w.expectedDiagnosisCount + r * ((obs.diagnosisCount || 0) - w.expectedDiagnosisCount);
      w.expectedOpportunityCount = w.expectedOpportunityCount + r * ((obs.opportunityCount || 0) - w.expectedOpportunityCount);
      w.samples += 1;
      slow.cycle += 1;
    }
    var fast = (cm.prior && typeof cm.prior.expectedStress === 'number') ? cm.prior.expectedStress : 0.5;
    slow.fastSlowDivergence = Math.round(Math.abs(fast - slow.slow.expectedStress) * 1000) / 1000;
    slow.regimeShift = slow.fastSlowDivergence > 0.25;
    slow.updated = cm.updated || Date.now();
    s.cultureSlowModel = slow; return slow;
  };

  // K4 — outcome / credit learning (TRUTH BRAKE, self-consistency). Reconciles each cycle's
  // predictedStress against the NEXT cycle's realized stress — the online forward-prediction
  // loop. NOT an external reward. hitRate feeds back into the effective learning rate in
  // _updateCultureModel (>=5 samples), so persistent mis-prediction speeds adaptation.
  CultureBrain.prototype._scoreCultureOutcomes = function () {
    var s = this.state, cm = s.cultureModel || {};
    var buf = this._cultureOutcomeBuffer = this._cultureOutcomeBuffer || [];
    var obs = cm.observation || null;
    if (this._culturePrevPrediction != null && obs && typeof obs.stress === 'number') {
      buf.push({ predicted: this._culturePrevPrediction, realized: obs.stress, err: Math.abs(this._culturePrevPrediction - obs.stress) });
      if (buf.length > CK_OUTCOME_BUFFER) buf.shift();
    }
    this._culturePrevPrediction = (typeof cm.predictedStress === 'number') ? cm.predictedStress : null;
    var n = buf.length, sumErr = 0, sumSq = 0, hits = 0;
    for (var i = 0; i < n; i++) { sumErr += buf[i].err; sumSq += buf[i].err * buf[i].err; if (buf[i].err <= 0.1) hits++; }
    var om = {
      version: 1,
      samples: n,
      meanRealizedError: n ? Math.round((sumErr / n) * 1000) / 1000 : null,
      brierLike: n ? Math.round((sumSq / n) * 1000) / 1000 : null,
      hitRate: n ? Math.round((hits / n) * 100) / 100 : null,                    // fraction within 0.1 of realized
      loopType: 'online-continuous (predicted-vs-next-realized self-consistency); NOT an external/dopaminergic reward',
      creditAssignmentActive: (n >= 5),
      effectiveLearningRate: ((s.cultureModel || {})._effectiveLearningRate) || null,
      note: 'CLOSED: hitRate scales the effective learning rate in _updateCultureModel (>=5 samples) when phase-reward and call-ledger are absent.',
      lastOutcomeAt: cm.updated || Date.now()
    };
    s.cultureOutcomeModel = om; return om;
  };

  // K5 — deep hierarchical perception. Aggregates the depth the brain HAS (L1 branch scan +
  // scene sub-portal, no new fetches) and estimates the portalError the recurrent model would
  // otherwise zero out. Folded into _computeCulturePredictionError (weight 0.05).
  CultureBrain.prototype._computeCulturePerceptionDepth = function () {
    var s = this.state, cm = s.cultureModel || {};
    var l1 = s._l1DepthCache || null;
    var scene = s.sceneLayer || null;
    var l1Real = 0, l1Mad = 0;
    if (l1 && l1.byDiagnosis) { Object.keys(l1.byDiagnosis).forEach(function (k) { l1Real += (l1.byDiagnosis[k].realTreatments || 0); l1Mad += (l1.byDiagnosis[k].madLibTreatments || 0); }); }
    var levels = [
      { level: 'L0', name: 'root', status: (this._portalCache || s._portalCache) ? 'loaded' : 'pending' },
      { level: 'L1', name: 'branch-scan', status: l1 ? 'scanned' : 'pending', realTreatments: l1Real, madLibTreatments: l1Mad },
      { level: 'L2', name: 'deep-cortex', status: 'quarantined', note: 'mad-lib synthetic (immune-blocked)' },
      { level: 'SCENE', name: 'music-scene-subportal', status: (scene && scene.loaded) ? 'loaded' : 'absent', activeCount: (scene && scene.activeCount) || 0 }
    ];
    var loadedDepth = (scene && scene.loaded) ? 3 : (l1 ? 1 : 0);
    var admissible = l1Real + ((scene && scene.count) ? scene.count : 0);
    var blocked = l1Mad + 1;                                        // +1 for the quarantined L2 tier
    var portalErrorEstimate = Math.round((blocked / Math.max(1, admissible + blocked)) * 1000) / 1000;
    var pd = {
      version: 1, levels: levels, deepestUsableLevel: loadedDepth,
      portalErrorEstimate: portalErrorEstimate,                     // consumed by _computeCulturePredictionError (weight 0.05)
      note: 'CLOSED: _computeCulturePredictionError folds portalErrorEstimate into total (weight 0.05). Perception stops at L1 (L2 quarantined); no new fetches.',
      lastDepthAt: cm.updated || Date.now()
    };
    s.culturePerceptionDepth = pd; return pd;
  };

  // K6 — attention / selective routing. Ranks top-down salience (active + relevance +
  // novelty) and names focus vs suppressed diagnoses, without gating the pipeline.
  CultureBrain.prototype._computeCultureAttention = function () {
    var s = this.state, cm = s.cultureModel || {}, reg = cm.regulation || {};
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
      note: 'ADVISORY: salience ranking exposed; culture has no _applyNeuroGating to bias opportunity rank.',
      lastAttentionAt: cm.updated || Date.now()
    };
    s.cultureAttention = at; return at;
  };

  // K7 — lateral inhibition (microcircuit). reg.inhibition is computed; this shows the
  // winner-take-most ranking it implies among competing active diagnoses.
  CultureBrain.prototype._computeCultureInhibition = function () {
    var s = this.state, cm = s.cultureModel || {}, reg = cm.regulation || {};
    var inhib = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;
    var active = (s.diagnoses || []).filter(function (d) { return d.active; })
      .sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var winner = active[0] || null;
    var li = {
      version: 1, inhibitionStrength: inhib,
      winner: winner ? winner.id : null,
      competitors: active.slice(1).map(function (d) { return { id: d.id, relevance: d.relevance, suppressBy: Math.round((d.relevance || 0) * inhib * 1000) / 1000 }; }).slice(0, 6),
      note: 'ADVISORY: winner-take-most implied; not applied to opportunity output (no gating layer in culture).',
      lastInhibitionAt: cm.updated || Date.now()
    };
    s.cultureInhibition = li; return li;
  };

  // K8 — homeostatic set-point (microcircuit). Maintains an adaptive stress baseline
  // (Turrigiano-style synaptic scaling) alongside the fixed CM_STRESS_FLOOR. The blended
  // adaptive floor gates readyForHandoff in _updateCultureModel (>=10 samples).
  CultureBrain.prototype._computeCultureHomeostasis = function () {
    var s = this.state, cm = s.cultureModel || {};
    var hist = (s.memory && s.memory.stressHistory) || (s.memory && s.memory.outcomeLog) || [];
    var win = hist.slice(-CK_HOMEO_WINDOW);
    var n = win.length, sum = 0;
    for (var i = 0; i < n; i++) sum += (win[i].stress || 0);
    var baseline = n ? sum / n : 0.5;                              // adaptive set-point vs fixed CM_STRESS_FLOOR
    var cur = (typeof s.stress === 'number') ? s.stress : 0;
    var scalingFactor = baseline > 0 ? Math.round((0.5 / Math.max(0.1, baseline)) * 1000) / 1000 : 1;
    var hm = {
      version: 1,
      fixedFloor: CM_STRESS_FLOOR,                                 // current hardcoded set-point
      adaptiveBaseline: Math.round(baseline * 1000) / 1000,
      currentStress: cur,
      deviationFromBaseline: Math.round((cur - baseline) * 1000) / 1000,
      scalingFactor: scalingFactor,                                // synaptic-scaling multiplier
      samples: n,
      effectiveFloor: ((s.cultureModel || {})._effectiveFloor) || null,
      note: 'CLOSED: readyForHandoff gates on a 50/50 blend of CM_STRESS_FLOOR and adaptiveBaseline (>=10 samples) via cm._effectiveFloor.',
      lastHomeostasisAt: cm.updated || Date.now()
    };
    s.cultureHomeostasis = hm; return hm;
  };

  // Assemble the culture neuro-completion surface (mirrors _computeEnergyNeuroLayers). Runs
  // all eight K-layers in the SAME order Energy uses, stores each on state, and attaches a
  // compact roll-up to state.cognition ADDITIVELY (new key `neuro`; existing keys untouched).
  // K1-K8 ONLY — no continuous-oscillation/phase-rhythm mechanism here (deferred); the
  // servo / E/I brake / phase-coherence actuation stay wired in _updateCultureModel.
  CultureBrain.prototype._computeCultureNeuroLayers = function () {
    this._computeCultureAfferent();          // K1 - afferent inter-brain input
    this._computeCultureGainControl();       // K2 - neuromodulatory gain application
    this._consolidateCultureSlowModel();     // K3 - slow consolidation / long-term plasticity
    this._scoreCultureOutcomes();            // K4 - outcome / credit learning (truth-brake self-consistency)
    this._computeCulturePerceptionDepth();   // K5 - deep hierarchical perception
    this._computeCultureAttention();         // K6 - attention / selective routing
    this._computeCultureInhibition();        // K7 - lateral inhibition (microcircuit)
    this._computeCultureHomeostasis();       // K8 - adaptive set-point (microcircuit)
    var s = this.state;
    var neuro = {
      version: 1,
      status: 'closed',                       // K4/K5/K8 feed the recurrent spine (one-cycle lag); K1/K2/K6/K7 advisory
      afferent: s.cultureAfferent || null,
      gainControl: s.cultureGainControl || null,
      slowModel: s.cultureSlowModel || null,
      outcomeModel: s.cultureOutcomeModel || null,
      perceptionDepth: s.culturePerceptionDepth || null,
      attention: s.cultureAttention || null,
      inhibition: s.cultureInhibition || null,
      homeostasis: s.cultureHomeostasis || null,
      closedLoops: [
        'K1 afferent -> scoreStress (externalPressure folded into stress)',
        'K3 slow-model -> parallel slow-weight track (regime-shift cue)',
        'K4 outcome -> _updateCultureModel (hitRate scales learning rate)',
        'K5 portalError -> _computeCulturePredictionError (weight 0.05)',
        'K8 set-point -> readyForHandoff (blended adaptive floor)'
      ],
      advisoryLoops: ['K2 gain (outputScale exposed)', 'K6 attention (salience exposed)', 'K7 inhibition (winner exposed)']
    };
    s.cultureNeuro = neuro;
    if (s.cognition && typeof s.cognition === 'object') s.cognition.neuro = neuro;   // additive: new key only
    return neuro;
  };

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
      bundle: _bundle ? { portalCount: _bundle.portalCount || 0, maxDepth: _bundle.maxDepth || 0, domains: _bundle.domains || [], lane: 'investments', shallow: bundleShallow, buildMethod: _bundle.buildMethod || null, humanVerification: _bundle.humanVerification || null } : null,
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

  // ════════════════════════════════════════════════════════════════════════════
  // ACTUATION METHODS (ported from energy-brain.js / finance-brain.js, adapted to Culture's REAL
  // edges/state). All DETERMINISTIC; NO paid-AI / LLM fetch ever runs on the 30s cycle. Each is
  // gated by this._actuation.* (reversible). None rewrites the validated stress/diagnosis spine.
  // ════════════════════════════════════════════════════════════════════════════

  // REGULATE-TO-TARGET SERVO (Neuro Ref V.2/XII set-point homeostasis/allostasis + XIII.1 E/I).
  // Real sensor->controller->effector->feedback loop: sensor = excitatory drive (stress + how many
  // things fire at once + active diagnoses) vs the current inhibition term (cultureModel.regulation.
  // inhibition); controller = PI (fast proportional + bounded slow integral, the HPA fast+slow arms);
  // effector = proportional dampening of emission (consumed by _applyCultureEIBrake). Additive,
  // reversible (_actuation.servo=false); affects ONLY opportunity confidence — never rewrites scoring.
  CultureBrain.prototype._computeCultureServo = function () {
    function R(x) { return Math.round(x * 1000) / 1000; }
    var s = this.state, cm = s.cultureModel || {}, reg = cm.regulation || {}, neuro = s.domainNeuro || {}, hm = neuro.homeostasis || {};
    // SENSOR: excitatory drive (stress + active conditions + active diagnoses) vs current inhibition
    var stress = (typeof s.stress === 'number') ? s.stress : 0;
    var conds = Array.isArray(s._activeConditions) ? s._activeConditions.length : (Array.isArray(s.signals) ? s.signals.length : 0);
    var dxA = Array.isArray(s.diagnoses) ? s.diagnoses.filter(function (d) { return d && d.active; }).length : 0;
    var drive = Math.max(0, Math.min(2, stress + Math.min(conds, 12) / 24 + Math.min(dxA, 6) / 24));
    var inhibition = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;   // the live regulation term
    var FLOOR = 0.15;
    // TARGET (allostatic set-point): inhibition must track drive (E/I) and rise with the adaptive
    // baseline deviation (generic K-stack homeostasis, prior cycle). Regulate-TO-target, not alert-on.
    var deviation = Math.max(0, (typeof hm.deviation === 'number') ? hm.deviation : 0);
    var target = Math.max(FLOOR, Math.min(1, Math.max(drive, FLOOR + deviation)));
    var error = target - inhibition;                                              // >0 => under-braked for the drive/regime
    // CONTROLLER: bounded integral (slow arm) + proportional (fast arm)
    this._cultureServoIntegral = Math.max(-0.5, Math.min(0.5, (this._cultureServoIntegral || 0) + error * 0.15));
    var Kp = 0.8, Ki = 0.4;
    var correction = Math.max(0, Kp * error + Ki * Math.max(0, this._cultureServoIntegral));   // only ADD braking; never disinhibit
    // EFFECTOR: proportional dampening of emission (the E/I brake consumes this)
    var emissionFactor = Math.max(0.2, Math.min(1, 1 - correction));
    var state = error > 0.25 ? 'runaway-risk' : ((inhibition - target) > 0.4 ? 'over-inhibited' : 'balanced');
    var servo = {
      version: 1, actuated: true, drive: R(drive), inhibition: R(inhibition), target: R(target),
      error: R(error), integral: R(this._cultureServoIntegral), emissionFactor: R(emissionFactor),
      state: state, deviation: R(deviation),
      note: 'closed-loop allostasis: drives inhibition toward a drive+deviation target; effector = proportional emission dampening. Neuro Ref XIII.1/V.2/XII.'
    };
    s.cultureServo = servo;
    return servo;
  };

  // E/I BRAKE ACTUATION (Neuro Ref XIII.1). Consumes the servo's emissionFactor and dampens emitted-
  // opportunity confidence PROPORTIONALLY to the inhibition-vs-drive deficit. Effector = the same
  // emission channel the base generic brake gate uses. Reversible (_actuation.eiBrake=false).
  CultureBrain.prototype._applyCultureEIBrake = function () {
    var s = this.state, servo = s.cultureServo;
    if (!servo) { s.cultureEIBrake = null; return null; }
    var f = (typeof servo.emissionFactor === 'number') ? servo.emissionFactor : 1;
    var opps = s.opportunities || [];
    var runaway = servo.state === 'runaway-risk';
    var dampened = 0;
    for (var i = 0; i < opps.length; i++) {
      if (f < 1 && typeof opps[i].confidence === 'number') {
        opps[i].confidence = Math.round(opps[i].confidence * f);
        opps[i].eiFactor = f;
        dampened++;
      }
      if (runaway) opps[i].eiDampened = true;
    }
    s.cultureEIBrake = {
      version: 1, applied: f < 1, emissionFactor: (Math.round(f * 1000) / 1000),
      servoState: servo.state, dampenedCount: dampened,
      note: 'E/I brake (Neuro Ref XIII.1): emission confidence dampened proportionally to the inhibition deficit vs drive; reversible via _actuation.eiBrake.'
    };
    return s.cultureEIBrake;
  };

  // PHASE-COHERENCE ROUTER + PHASE-TRANSITION READOUT — ADVISORY ONLY for culture.
  //  Culture's domain phase is P9 and culture has NO Thing1-validated distress signal (its awareness
  //  layer states diagnoses are interpretive, not validated; _pubSignals is {} — the validated gate
  //  abstains). Per the validity gate, the phase-transition REWARD cannot honestly be a ground-truth
  //  teaching signal here, so _actuation.phase = false and:
  //    • the transition is naturally validated:false (VALIDATED has no p9; culture rarely transitions),
  //    • the K4 credit hook never treats it as reward (guarded by _actuation.phase),
  //    • this router NEVER opens an opportunity cap (no cap-opening actuation exists in culture).
  //  It runs observe-only so operators can SEE culture's phase coupling — no effector is fabricated.
  //  Deterministic; no AI; no writes to culture.json.
  // Per-cycle: append culture's primary STRESS scalar (this.state.stress; up=bad) to the persistent
  // series, cap at 60, persist, then run the Thing2 kernel over it to derive an interpretive P0-P10
  // phase. Deterministic pure-math (no network / AI). On any failure or when the adapter/history is
  // unavailable, _kernelPhase is set to null and the caller falls back to s.phase. seriesSource =
  // STRESS (positive:false) because culture's scalar rises with distress.
  CultureBrain.prototype._updatePhaseKernel = function () {
    var s = this.state;
    this._phaseSeries = this._phaseSeries || [];
    var scalar = (typeof s.stress === 'number') ? s.stress : null;
    try {
      if (scalar != null && isFinite(scalar)) {
        this._phaseSeries.push(scalar);
        while (this._phaseSeries.length > 60) this._phaseSeries.shift();
        try {
          if (typeof localStorage !== 'undefined' && localStorage) {
            localStorage.setItem('limen:phaseseries:culture', JSON.stringify(this._phaseSeries));
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

  CultureBrain.prototype._computeCulturePhaseDynamics = function () {
    var s = this.state;
    // Refresh the Thing2 kernel phase from culture's stress trajectory (pure math, guarded).
    try { this._updatePhaseKernel(); } catch (e) { this._kernelPhase = null; s.phaseSource = 'fallback'; }
    // patent Section 3.4 Loop 1 phase-coupling matrix M (thing2 lineage). Positive = coherent.
    var PHASE_M = {
      p3:  { p3: 0.08, p7a: 0.05, p9: 0.04, p0: -0.06 },
      p7a: { p7a: 0.10, p3: 0.04, p9: 0.06, p0: -0.08, p4: -0.04 },
      p7:  { p7: 0.10, p3: 0.04, p9: 0.06, p0: -0.08 },
      p4:  { p4: 0.05, p5: 0.04, p0: 0.03, p3: -0.04 },
      p6:  { p6: 0.06, p0: 0.04, p3: -0.05 },
      p9:  { p9: 0.08, p7a: 0.05, p0: -0.10, p4: -0.06 },
      p10: { p10: 0.06, p0: 0.05, p6: 0.03 }
    };
    var VALIDATED = { p3: 1, p7: 1, p7a: 1, p7b: 1 };            // Thing1 validates P3/P7 — culture (P9) is NOT here
    var BREAKING = { p1: 1, p3: 1, p7: 1, p7a: 1, p7b: 1, p9: 1 };
    function norm(p) { if (p == null) return null; p = String(p).toLowerCase().replace(/[^a-z0-9]/g, ''); if (p.charAt(0) !== 'p') p = 'p' + p; return p; }
    // PREFER the Thing2 kernel phase (interpretive, from culture's stress trajectory) for BOTH the
    // coherence router and the phase-transition READOUT; fall back to the existing s.phase when the
    // kernel is unavailable (adapter missing / history < 8 / error) — fallback path unchanged.
    var myPhase = norm(this._kernelPhase != null ? this._kernelPhase : s.phase);

    // (A) COHERENCE ROUTER — couple to co-phased, stressed domains (advisory readout)
    var doms = (typeof window !== 'undefined' && window.LIMENDomains) || {};
    var coupled = [], couplingStrength = 0;
    if (myPhase && PHASE_M[myPhase]) {
      var row = PHASE_M[myPhase];
      Object.keys(doms).forEach(function (k) {
        if (k === 'culture') return;
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

    // (B) PHASE-TRANSITION READOUT — did a transition occur? For culture this is ALWAYS advisory
    //     self-consistency (validated:false), never a fabricated ground-truth reward.
    var hist = this._culturePhaseHist = this._culturePhaseHist || [];
    var prev = hist.length ? hist[hist.length - 1].phase : null;
    var reward = null;
    if (prev != null && myPhase != null && prev !== myPhase) {
      var fc = (s.domainNeuro && s.domainNeuro.forecast) || {};
      var predictedUp = fc.direction === 'rising' ||
        (typeof fc.projectedStress === 'number' && typeof s.stress === 'number' && fc.projectedStress > s.stress);
      var wentUp = (BREAKING[myPhase] && !BREAKING[prev]) ? true : (BREAKING[prev] && !BREAKING[myPhase]) ? false : null;
      var hit = (wentUp !== null) ? (wentUp === !!predictedUp) : null;
      var validated = !!(VALIDATED[myPhase] || VALIDATED[prev]);   // culture P9 => false
      reward = { from: prev, to: myPhase, predictedUp: !!predictedUp, wentUp: wentUp, hit: hit,
        validated: validated, kind: validated ? 'ground-truth (P3/P7 validated)' : 'advisory-self-consistency (culture has no validated phase envelope)' };
    }
    hist.push({ phase: myPhase, t: (s.cultureModel && s.cultureModel.updated) || Date.now() });
    if (hist.length > 24) hist.shift();

    var out = {
      version: 1, observeOnly: true, actuated: false, myPhase: myPhase,
      phaseSource: s.phaseSource || 'fallback',       // 'thing2-kernel' when the real kernel drove myPhase, else 'fallback'
      kernelTrajectory: s.kernelTrajectory || null,
      coupled: coupled.slice(0, 5), couplingStrength: Math.round(couplingStrength * 1000) / 1000,
      transition: reward,
      note: 'ADVISORY: phase source = Thing2 recursive kernel over culture\'s stress trajectory (interpretive) with s.phase fallback. Culture is P9 with no Thing1-validated p3/p7 signal — coherence router is observe-only; the transition reward is never treated as ground-truth (validated:false); no cap-opening; no K4 credit preemption.'
    };
    s.culturePhaseDynamics = out;
    return out;
  };

  // E/I BALANCE + SELF-AUDIT ADVISORIES (observe-only; Neuro Ref XIII.1 + XIV). Deterministic, no AI, no
  // writes. (1) E/I balance = is inhibition tracking drive (reads the servo). (2) Self-audit = CONSUME the
  // connectivity / single-points-of-failure audit on Culture's REAL edge graph (edges live in culture.json;
  // read from the brain's portal cache, else lazy-fetch + cache once, matching Energy's/Finance's loader).
  CultureBrain.prototype._computeCultureRegulationAdvisories = function () {
    var s = this.state, out = { version: 1, observeOnly: true };
    // (1) E/I balance advisory
    var servo = s.cultureServo || null;
    out.eiBalance = servo ? {
      drive: servo.drive, inhibition: servo.inhibition, target: servo.target, error: servo.error,
      state: servo.state, balanced: servo.state === 'balanced', note: 'inhibition-tracks-drive (Neuro Ref XIII.1)'
    } : null;
    // (2) self-audit — consume the culture edge graph
    try {
      var self = this;
      var edges = (this._portalCache && Array.isArray(this._portalCache.edges) && this._portalCache.edges) ||
                  this._cultureEdges || null;
      if (!edges) {
        if (typeof fetch === 'function' && !this._cultureEdgesPromise) {
          this._cultureEdgesPromise = fetch('/assets/data/domains/culture.json')
            .then(function (r) { return r.json(); })
            .then(function (j) { if (j && Array.isArray(j.edges)) self._cultureEdges = j.edges; })
            .catch(function () {});
        } else if (typeof require === 'function') {
          try { var ed = require('../../data/domains/culture.json'); if (ed && Array.isArray(ed.edges)) { this._cultureEdges = ed.edges; edges = ed.edges; } } catch (_e) {}
        }
      }
      if (edges && edges.length) out.selfAudit = this._cultureConnectivityAudit(edges);
      else out.selfAudit = { consumed: false, note: edges ? 'no edges' : 'edges loading (async, next cycle)' };
    } catch (e) { out.selfAudit = { consumed: false, error: String(e && e.message || e).slice(0, 80) }; }
    s.cultureRegulationAdvisories = out;
    return out;
  };

  // Deterministic connectivity self-audit (Neuro Ref XIV): degree hubs + articulation points (Tarjan) on
  // the culture node/edge graph. Self-contained (no external module). Consumed observe-only.
  CultureBrain.prototype._cultureConnectivityAudit = function (edges) {
    var adj = {}, deg = {};
    for (var e = 0; e < edges.length; e++) {
      var a = edges[e].source, b = edges[e].target;
      if (!a || !b) continue;
      (adj[a] = adj[a] || []).push(b); (adj[b] = adj[b] || []).push(a);
      deg[a] = (deg[a] || 0) + 1; deg[b] = (deg[b] || 0) + 1;
    }
    var nodes = Object.keys(deg);
    var topHubs = nodes.map(function (n) { return { node: n, degree: deg[n] }; })
      .sort(function (x, y) { return y.degree - x.degree; }).slice(0, 5);
    // Articulation points (Tarjan), bounded recursion on the small culture graph.
    var visited = {}, disc = {}, low = {}, parent = {}, ap = {}, timer = { t: 0 };
    function dfs(u) {
      visited[u] = true; disc[u] = low[u] = ++timer.t; var children = 0;
      var nb = adj[u] || [];
      for (var i = 0; i < nb.length; i++) {
        var v = nb[i];
        if (!visited[v]) {
          children++; parent[v] = u; dfs(v);
          low[u] = Math.min(low[u], low[v]);
          if (parent[u] === undefined && children > 1) ap[u] = true;
          if (parent[u] !== undefined && low[v] >= disc[u]) ap[u] = true;
        } else if (v !== parent[u]) {
          low[u] = Math.min(low[u], disc[v]);
        }
      }
    }
    for (var k = 0; k < nodes.length; k++) { if (!visited[nodes[k]]) { parent[nodes[k]] = undefined; dfs(nodes[k]); } }
    var spof = Object.keys(ap);
    return {
      consumed: true, edgeCount: edges.length, nodeCount: nodes.length,
      spofCount: spof.length, spof: spof.slice(0, 8), topHubs: topHubs,
      verdict: spof.length ? (spof.length + ' single-point(s)-of-failure: removal disconnects the culture connectome') : 'no articulation nodes (resilient graph)',
      note: 'connectivity self-audit (Neuro Ref XIV): degree hubs + articulation points on the ' + edges.length + '-edge culture graph'
    };
  };

  // ════════════════════════════════════════════════════════════════════════════
  // OPERATOR-TRIGGERED GENERATIVE SLOT — the ONE "code-cannot-do-this" hook (generative
  // node->business authoring / semantic mapping for cultural scenes). COST-SAFE BY CONSTRUCTION:
  //   (a) NEVER called from cycle()/_updateCultureModel — the 30s cycle is 100% deterministic
  //       (grep-verify: no call site in the cycle pipeline);
  //   (b) runs ONLY on an explicit operator trigger (opts.operatorTriggered === true);
  //   (c) routes through a SERVER endpoint that enforces lib/ai-kill-switch spendDisabled()
  //       server-side — NO API key is ever present in this client code.
  // If no killswitch-gated endpoint is supplied it is a documented NO-OP STUB (spends nothing),
  // per the discipline "leave the slot as a documented no-op stub rather than wiring a live call."
  // ════════════════════════════════════════════════════════════════════════════
  CultureBrain.prototype.authorNodeBusinessFromServer = function (nodeId, opts) {
    opts = opts || {};
    if (opts.operatorTriggered !== true) {
      return Promise.resolve({ status: 'blocked', reason: 'operator-trigger required; the 30s cycle must never call this (cost-safety killswitch)' });
    }
    var endpoint = opts.endpoint || null;   // server route that is killswitch-gated (spendDisabled) — no key client-side
    if (!endpoint || typeof fetch !== 'function') {
      return Promise.resolve({ status: 'noop-stub', nodeId: nodeId || null, note: 'no killswitch-gated server endpoint wired; documented no-op — no spend' });
    }
    return fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'culture', nodeId: nodeId || null, task: 'node-business-authoring' })
    })
      .then(function (r) { return r.ok ? r.json() : { status: 'server-declined', code: r.status }; })
      .catch(function (err) { return { status: 'error', error: String(err && err.message || err) }; });
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
