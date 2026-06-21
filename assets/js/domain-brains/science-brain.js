/**
 * science-brain.js — Science/Research Domain Cognitive Engine
 * domainId: 'research', portalKey: 'research'
 * Portal issues: REPLICATION_CRISIS, FUNDING_COLLAPSE, DATA_FRAUD,
 *   PARADIGM_CONFLICT, BRAIN_DRAIN, PUBLICATION_BIAS
 * Emissions: technology, health, industry, defense
 * Exposes: window.LIMENResearchBrain
 */
(function () {
  'use strict';
  if (!window.LIMENDomainBrainBase) { console.warn('[ScienceBrain] Base not loaded'); return; }
  var Base = window.LIMENDomainBrainBase;

  function ScienceBrain() { Base.call(this, { domainId: 'research', label: 'Research', snapshotKey: 'research', portalKey: 'science', cycleInterval: 30000 }); }
  ScienceBrain.prototype = Object.create(Base.prototype);
  ScienceBrain.prototype.constructor = ScienceBrain;

  ScienceBrain.prototype.init = function () {
    Base.prototype.init.call(this);
    this.diagnosisIndex = {
      'REPLICATION_CRISIS':  ['replication_failure', 'methodology_weakness', 'research_stagnation', 'science_high_stress', 'structural_stress'],
      'FUNDING_COLLAPSE':    ['funding_cut', 'grant_decline', 'budget_constraint', 'funding_gap', 'science_high_stress'],
      'DATA_FRAUD':          ['data_integrity', 'retraction_surge', 'misconduct', 'fraud_detected', 'science_high_stress'],
      'PARADIGM_CONFLICT':   ['paradigm_challenge', 'theoretical_dispute', 'breakthrough_claim', 'consensus_breakdown'],
      'BRAIN_DRAIN':         ['talent_loss', 'researcher_exodus', 'workforce_gap', 'institutional_decline', 'structural_stress'],
      'PUBLICATION_BIAS':    ['publication_skew', 'reporting_gap', 'negative_result_suppression', 'data_fragmentation']
    };
    this.emissionRules = [
      { targetDomain: 'technology', signalType: 'innovation_pipeline_pressure', condition: function (s) { return s.stress >= 0.25; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.55); } },
      { targetDomain: 'health', signalType: 'clinical_evidence_strain', condition: function (s) { return s.stress >= 0.30; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); } },
      { targetDomain: 'industry', signalType: 'r_and_d_translation_lag', condition: function (s) { return s.stress >= 0.30; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); } },
      { targetDomain: 'defense', signalType: 'strategic_research_gap', condition: function (s) { return s.stress >= 0.35; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.4); } }
    ];
  };

  ScienceBrain.prototype.normalizeSignals = function () {
    var signals = [], rawSignals = (this._rawDomain && this._rawDomain.signals) || [];
    for (var i = 0; i < rawSignals.length; i++) signals.push(rawSignals[i]);
    this._activeConditions = [];

    // Long-arc baseline
    this._activeConditions.push('research_stagnation');
    this._activeConditions.push('funding_gap');
    signals.push('BASELINE: Persistent research funding pressure and publication pipeline strain');

    // ── SCIENCE FEED THRESHOLDS (calibrated to actual feed regimes) ──
    //
    // Three regimes:
    //   1. Literature volume (PubMed, arXiv): high counts (10000+)
    //      → threshold > 100 captures publication volume spikes
    //   2. RSS-direct .gov / publisher feeds (NSF, NIH, Nature): 10-50 items
    //      → threshold ≥ 5 captures elevated activity
    //   3. Integrity feeds (Retraction Watch): 10-30 items per cycle
    //      → threshold ≥ 3 captures any retraction activity (low baseline)
    //
    // Each branch is explainable from the actual feed scale.

    var feeds = this.state.feeds;
    for (var fi = 0; fi < feeds.length; fi++) {
      var f = feeds[fi];
      var name = f.name || '';
      var fn = name.toLowerCase();
      var val = f.value || 0;

      // ── Regime 1: Publication volume ──
      if ((fn.indexOf('pubmed') !== -1 || fn.indexOf('arxiv') !== -1 || fn.indexOf('publication') !== -1) && val > 100) {
        this._activeConditions.push('publication_skew');
        signals.push('ELEVATED: Publication volume surge \u2014 potential bias pressure (' + name + ' ' + val + ')');
      }

      // ── Regime 2: NSF / NIH / federal funding feeds ──
      // These come from real .gov RSS or Google News proxy. Counts are 5-100.
      if ((name === 'NSF Awards' || name === 'NIH Grants') && val >= 5) {
        // Active funding news baseline — no alert, but it confirms the feed is live
        // and contributes to the funding-event family in pulse engine.
        // Funding cuts only fire on negative deltas (handled separately below).
      }

      // ── Regime 3: Retraction Watch — research integrity ──
      if (name === 'Retraction Watch' && val >= 3) {
        this._activeConditions.push('retraction_surge');
        this._activeConditions.push('data_integrity');
        signals.push('ELEVATED: Research integrity activity (Retraction Watch ' + val + ' items)');
      }

      // ── Regime 4: Nature / Science press — paradigm signal ──
      if (name === 'Nature / Science Press' && val >= 10) {
        // High-volume Nature press cycles often correlate with breakthrough claims
        // and paradigm-challenge announcements. Below 10 is normal weekly cadence.
        this._activeConditions.push('breakthrough_claim');
        signals.push('ELEVATED: Nature/Science press activity (' + val + ' items)');
      }

      // ── Legacy negative-value funding cut detection (preserved) ──
      if ((fn.indexOf('grant') !== -1 || fn.indexOf('funding') !== -1 || fn.indexOf('nsf') !== -1 || fn.indexOf('nih') !== -1) && f.value !== undefined && f.value < -5) {
        this._activeConditions.push('funding_cut'); this._activeConditions.push('grant_decline');
        signals.push('ALERT: Research funding declining');
      }
    }

    for (var rsi = 0; rsi < rawSignals.length; rsi++) {
      var rs = (typeof rawSignals[rsi] === 'string' ? rawSignals[rsi] : '').toLowerCase();
      if (rs.indexOf('retract') !== -1 || rs.indexOf('fraud') !== -1 || rs.indexOf('misconduct') !== -1) {
        if (this._activeConditions.indexOf('retraction_surge') === -1) this._activeConditions.push('retraction_surge');
        if (this._activeConditions.indexOf('data_integrity') === -1) this._activeConditions.push('data_integrity');
      }
      if (rs.indexOf('replicat') !== -1 && (rs.indexOf('fail') !== -1 || rs.indexOf('crisis') !== -1)) {
        if (this._activeConditions.indexOf('replication_failure') === -1) this._activeConditions.push('replication_failure');
      }
      if (rs.indexOf('breakthrough') !== -1 || rs.indexOf('paradigm') !== -1 || rs.indexOf('discovery') !== -1) {
        if (this._activeConditions.indexOf('breakthrough_claim') === -1) this._activeConditions.push('breakthrough_claim');
      }
      if (rs.indexOf('brain drain') !== -1 || rs.indexOf('talent') !== -1 && rs.indexOf('loss') !== -1) {
        if (this._activeConditions.indexOf('talent_loss') === -1) this._activeConditions.push('talent_loss');
      }
      if (rs.indexOf('funding') !== -1 && (rs.indexOf('cut') !== -1 || rs.indexOf('reduc') !== -1 || rs.indexOf('slash') !== -1)) {
        if (this._activeConditions.indexOf('funding_cut') === -1) this._activeConditions.push('funding_cut');
        if (this._activeConditions.indexOf('budget_constraint') === -1) this._activeConditions.push('budget_constraint');
      }
    }

    // Cross-domain pressure
    if (window.LIMENDomainBrains) {
      var allBrains = window.LIMENDomainBrains.getAll();
      for (var bk in allBrains) {
        if (bk === 'research') continue;
        var b = allBrains[bk]; if (!b || !b.state) continue;
        var bEm = b.state.crossDomainEmissions || [];
        for (var bei = 0; bei < bEm.length; bei++) {
          var be = bEm[bei];
          if (be.targetDomain === 'research' && be.magnitude > 0.1) {
            signals.push('FEED [' + bk.toUpperCase() + ']: ' + (be.signal || '').replace(/_/g, ' ') + ' — ' + Math.round(be.magnitude * 100) + '%');
            if (this._activeConditions.indexOf('institutional_decline') === -1 && be.magnitude > 0.2) this._activeConditions.push('institutional_decline');
          }
        }
      }
    }

    var snap = this._getSnapshot();
    if (snap && snap.defenseSignals) { for (var si = 0; si < snap.defenseSignals.length; si++) { var sig = snap.defenseSignals[si]; if (sig.affectedDomains && (sig.affectedDomains.indexOf('research') !== -1 || sig.affectedDomains.indexOf('science') !== -1)) { this._activeConditions.push(sig.eventType); signals.push('FEED [DEFENSE]: ' + (sig.eventType || '').replace(/_/g, ' ')); } } }
    if (snap && snap.macroShock && snap.macroShock.detected) this._activeConditions.push('macro_shock');

    if (this.state.stress >= 0.30) { this._activeConditions.push('methodology_weakness'); this._activeConditions.push('data_fragmentation'); }
    if (this.state.stress >= 0.45) { this._activeConditions.push('negative_result_suppression'); this._activeConditions.push('reporting_gap'); }
    if (this.state.stress >= 0.55) this._activeConditions.push('science_high_stress');
    if (this.state.stress >= 0.65) { this._activeConditions.push('consensus_breakdown'); this._activeConditions.push('researcher_exodus'); }
    if (this.state.maturity === 'STRUCTURAL') this._activeConditions.push('structural_stress');
    var extPressure = this.getExternalPressure ? this.getExternalPressure() : 0;
    if (extPressure >= 0.10) this._activeConditions.push('workforce_gap');

    this.state.signals = signals;
    return Promise.resolve();
  };

  ScienceBrain.prototype.deriveDiagnoses = function () {
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

  ScienceBrain.prototype.recommendTreatments = function () {
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

  ScienceBrain.prototype.surfaceOpportunities = function () {
    Base.prototype.surfaceOpportunities.call(this);
    var opps = [], stress = this.state.stress, activeDx = this.state.diagnoses.filter(function (d) { return d.active; }), allDx = this.state.diagnoses || [], companies = this.state.companies, seen = {};
    function add(o) { var key = o.title.toLowerCase().replace(/[^a-z0-9]/g, ''); if (seen[key]) return; seen[key] = true; opps.push(o); }
    for (var di = 0; di < activeDx.length; di++) {
      var dx = activeDx[di], dxLabel = (dx.label || dx.id || '').replace(/_/g, ' ');
      add({ title: dxLabel + ' — research integrity and replication platform', rank: stress * dx.relevance, path: 'RESEARCHABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.50) add({ title: dxLabel + ' — research funding and infrastructure', rank: stress * dx.relevance * 0.9, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.55 && dx.relevance >= 0.2) add({ title: dxLabel + ' — data quality and reproducibility infrastructure', rank: stress * 0.85, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      add({ title: dxLabel + ' — scientific talent retention and mobility', rank: stress * dx.relevance * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
    }
    var termCo = [] /* neutralized: distress only from validated gate (see energy-brain) */;
    if (termCo.length > 0) add({ title: 'Science terminal entity distressed positioning', rank: 0.95, path: 'INVESTABLE', urgency: 'high', source: 'company_terminal', tier: 1, companies: termCo.map(function (c) { return c.ticker; }), stress: stress });
    if (this.state.convergence && this.state.convergence.primary_signal) add({ title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — science convergence response', rank: 0.98, path: 'INVESTABLE', urgency: 'high', source: 'convergence', tier: 1, stress: stress });
    var emissions = this.state.crossDomainEmissions || [];
    for (var ei = 0; ei < emissions.length; ei++) { var em = emissions[ei]; add({ title: 'Science \u2192 ' + (em.targetDomain || '').replace(/_/g, ' ') + ' — ' + (em.signal || em.signalType || '').replace(/_/g, ' '), rank: (em.magnitude || 0.5) * stress * 0.8, path: 'INVESTABLE', urgency: em.magnitude > 0.6 ? 'high' : 'medium', source: 'cross_domain', tier: 2, stress: stress }); }
    if (stress >= 0.50) { add({ title: 'Research methodology modernization', rank: stress * 0.65, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'methodology_mod', stress: stress }); add({ title: 'Open science infrastructure — data sharing and transparency', rank: stress * 0.70, path: 'RESEARCHABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'open_science', stress: stress }); }
    if (stress >= 0.60) { add({ title: 'Research-to-market translation acceleration', rank: stress * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'research_translation', stress: stress }); add({ title: 'Scientific workforce development and retention', rank: stress * 0.68, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'workforce_dev', stress: stress }); }
    var nearDx = allDx.filter(function (d) { return !d.active && d.relevance > 0 && d.totalTriggers > 0; });
    for (var ndi = 0; ndi < nearDx.length; ndi++) { if (stress >= 0.45) add({ title: (nearDx[ndi].label || '').replace(/_/g, ' ') + ' — early-stage monitoring', rank: stress * (nearDx[ndi].relevance || 0.1) * 0.5, path: 'RESEARCHABLE', urgency: 'watching', source: 'near_diagnosis', tier: 2, stress: stress, nearDiagnosisId: nearDx[ndi].id }); }
    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });

    // ═══ CANONICAL ENRICHMENT — merge science playbook detail per opportunity ═══
    var PB_LIST = window.LIMENScienceOpportunityPlaybooks || window.LIMENResearchOpportunityPlaybooks || [];
    var _byId = {};
    for (var _pbi = 0; _pbi < PB_LIST.length; _pbi++) _byId[PB_LIST[_pbi].id] = PB_LIST[_pbi];

    var _PB_MAP = {
      'REPLICATION_CRISIS': 'replication_crisis',
      'FUNDING_COLLAPSE':   'funding_collapse',
      'DATA_FRAUD':         'data_fraud',
      'PARADIGM_CONFLICT':  'paradigm_conflict',
      'BRAIN_DRAIN':        'brain_drain',
      'PUBLICATION_BIAS':   'publication_bias'
    };
    var _LAGGING_MAP = {
      'methodology_mod':      'replication_crisis',
      'open_science':         'publication_bias',
      'research_translation': 'paradigm_conflict',
      'workforce_dev':        'brain_drain'
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
      o.domain = 'research';
      o.confidence = Math.round(Math.min(1, (o.rank || 0)) * 100);
      if (!o.whyNow) o.whyNow = o.title;
      o.urgencyLabel = _urgencyLabel(o.urgency);

      var pbId = _resolvePbId(o);
      o.playbookId = pbId;
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

        var timingParts = [];
        if (o.urgencyLabel) timingParts.push(o.urgencyLabel);
        if (pb.window) timingParts.push('Window: ' + pb.window);
        var timing = timingParts.join(' \u00b7 ');

        var evidenceParts = ['Domain: research', 'Stress: ' + stressPct + '%'];
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

    this.state.opportunities = opps;
    this.state.opportunityCount = opps.length;
    return Promise.resolve();
  };

  ScienceBrain.prototype._checkDiagnosisActions = function () {
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; }); if (activeDx.length === 0) return;
    var adapters = window.LIMENActionAdapters; if (!adapters) return;
    for (var i = 0; i < activeDx.length; i++) { var dx = activeDx[i]; if (adapters.getDrafts && adapters.getDrafts({ domain: 'research', intentId: dx.id }).length > 0) continue; adapters.createDraft('REPORT_GENERATION', { domain: 'research', sourceType: 'domain_brain', sourceId: dx.id, intentId: dx.id, title: 'Science Alert: ' + dx.label, intent: { domain: 'research', title: dx.label, status: 'ACTIVE', priority: this.state.stress, progress: 0, strategyType: 'diagnosis_response', steps: [{ type: 'ANALYZE', label: 'Assess ' + dx.label + ' research impact', status: 'PENDING' }, { type: 'INVESTIGATE', label: 'Identify affected fields and institutions', status: 'PENDING' }, { type: 'POSITION', label: 'Evaluate science/research opportunities', status: 'PENDING' }] } }); }
  };

  ScienceBrain.prototype.resolveDeepContent = function () {
    var self = this; var resolver = window.LIMENPortalContentResolver; if (!resolver) return Promise.resolve();
    return resolver.resolveForBrain(this.state).then(function (content) { self.state.resolvedContent = content; if (content) { var dt = []; for (var dxId in content.byDiagnosis) { var dxC = content.byDiagnosis[dxId]; for (var i = 0; i < dxC.treatments.length; i++) { var t = dxC.treatments[i]; dt.push({ id: 'deep_' + t.nodeId + '_' + i, label: t.label, type: t.type, evidence: t.evidence, description: t.description, cite: t.cite, steps: t.steps, monitoring: t.monitoring, escalation: t.escalation, diagnosisId: dxId, nodeId: t.nodeId, nodeLabel: t.nodeLabel, hasDepth: t.hasDepth, source: 'canonical_deep' }); } } if (dt.length > 0) self.state.treatments = dt; } }).catch(function () {});
  };

  var _origCycle = ScienceBrain.prototype.cycle;
  ScienceBrain.prototype.cycle = function () { var self = this; return _origCycle.call(this).then(function () { return self.resolveDeepContent(); }); };

  var brain = new ScienceBrain(); brain.init(); brain.start();
  window.LIMENResearchBrain = brain;
  window.LIMENDomainBrains.register(brain);

  // ══════════════════════════════════════════════════════════════════════
  // AUTO-LOAD SCIENCE OPERATOR STACK ON DOMAIN-CONSOLE
  // ══════════════════════════════════════════════════════════════════════

  var _isDomainConsole = window.location.pathname.indexOf('domain-console') !== -1;
  var _domParam = (new URLSearchParams(window.location.search)).get('domain');
  var _isScienceDomain = _domParam === 'science' || _domParam === 'research';
  if (_isDomainConsole && _isScienceDomain) {
    window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION = true;

    var _scienceScripts = [
      'assets/js/science-compensation.js',
      'assets/js/science-claim-ledger.js',
      'assets/js/science-claim-flow.js',
      'assets/js/science-opportunity-economics.js',
      'assets/js/science-pulse-engine.js',
      'assets/js/science-operator-panel.js',
      'assets/js/science-node-business-engine.js',
      'assets/js/science-business-review.js',
      'assets/js/science-execution-panels.js',
      'assets/js/science-business-build.js',
      'assets/js/science-directive-extractor.js',
      'assets/js/science-directive-ranker.js',
      'assets/js/science-directive-translator.js',
      'assets/js/science-targeting-engine.js',
      'assets/js/science-promotion-bridge.js',
      'assets/js/science-clarity-operator.js'
    ];
    (function loadNext(i) {
      if (i >= _scienceScripts.length) return;
      var s = document.createElement('script');
      s.src = _scienceScripts[i];
      s.onload = function () { loadNext(i + 1); };
      s.onerror = function () { console.warn('[ScienceBrain] Failed to load ' + _scienceScripts[i]); loadNext(i + 1); };
      document.head.appendChild(s);
    })(0);
  }
})();
