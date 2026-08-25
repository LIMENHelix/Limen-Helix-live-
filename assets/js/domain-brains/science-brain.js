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

  function ScienceBrain() { Base.call(this, { groundedOnly: true,   // circularity cut 2026-07-24
       domainId: 'research', label: 'Research', snapshotKey: 'research', portalKey: 'science', cycleInterval: 30000 });
    this.resourceAuthority = { ownerDomain: 'research', policyId: 'science-resource/1', sandboxLane: 'research-papers', lanes: ['research', 'publication'], budgets: { computeUnitsPerCycle: 512, queueCapacity: 64 }, switches: { internalCycle: true, internalEmission: true, externalAction: false, spend: false, capital: false } };
  }
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

    // ── ACTUATION VALIDITY GATE (2026-07-13) ───────────────────────────────────────────────
    // Which of Energy's actuations this domain can HONESTLY support. An actuation is LIVE only
    // where a real controllable effector exists; otherwise it stays ADVISORY (flag=false) and
    // is NOT wired. Effector for servo/eiBrake = surfaced-opportunity CONFIDENCE (a real field the
    // base brake gate already consumes). Effector for phase = the researchModel's effective
    // learning rate (credit assignment). Deterministic; reversible by flipping any flag.
    //
    //   servo   = TRUE  — real closed loop: sensor = excitatory drive (stress + live conditions +
    //                     active diagnoses) vs inhibition (researchModel.regulation.inhibition, a
    //                     term the recurrent loop already computes); effector = proportional
    //                     dampening of opportunity confidence. Neuro Ref XIII.1 / V.2 / XII.
    //   eiBrake = TRUE  — the servo's emissionFactor dampens opportunity confidence proportionally
    //                     to how far inhibition trails drive (E/I invariant). NON-duplicative: the
    //                     discrete governor halt/dampen is already applied by the base
    //                     _applyGenericBrakeGate for this domain; this adds only the PROPORTIONAL
    //                     E/I arm that Energy's _computeEnergyBrake carries as eiFactor.
    //   phase   = TRUE  — P0-P10 is the same substrate Energy couples on. Coherence router couples
    //                     to co-phased stressed peers; the phase-TRANSITION credit is self-consistency
    //                     calibration (interpretive) — a P3/P7-family transition hit is NOT an external
    //                     ground-truth reward (science is not externalRewardEligible). The central
    //                     window.LIMENK4 gate owns the tiering; here the effector is credit-source into
    //                     the model's effective learning rate.
    //   refractory = FALSE (ADVISORY) — no honest effector. This brain has NO autonomous
    //                     emission/delivery stream to de-duplicate (opportunities are recomputed
    //                     fresh each cycle; action-draft de-dup is already handled in
    //                     _checkDiagnosisActions via adapters.getDrafts), and there is no
    //                     science-refractory-limiter module. Fabricating one would be a fake clone,
    //                     so it stays off. (Same honesty as Energy's UNMAPPED E/I boundary.)
    this._actuation = { overlays: true, refractory: true, servo: true, eiBrake: true, phase: true };
    this._servoIntegral = 0;
    this._sciencePhaseHistory = [];

    // ── THING2 RECURSIVE PHASE KERNEL — phase source (2026-07-13) ──────────────────────────
    // The REAL Thing2 recursive phase kernel (assets/js/limen-thing2-adapter.js -> window.LIMENThing2)
    // becomes this brain's phase source for the coherence router + phase-transition reward. It is
    // PURE MATH (no network, no AI); the 30s cycle stays deterministic. _phaseSeries is a persistent
    // rolling window (cap 60) of the domain's primary STRESS scalar. _kernelPhase stays null and
    // phaseSource='fallback' whenever the kernel is unavailable or returns no phase, in which case
    // the existing naive/static s.phase drives phase dynamics unchanged.
    this._kernelPhase = null;
    this.state.phaseSource = 'fallback';
    try {
      this._phaseSeries = (typeof localStorage !== 'undefined')
        ? (JSON.parse(localStorage.getItem('limen:phaseseries:science')) || [])
        : [];
    } catch (e) { this._phaseSeries = []; }
    if (!Array.isArray(this._phaseSeries)) this._phaseSeries = [];

    // PHASE K neuro-completion state (K1..K8): K4 truth-brake outcome log + prev self-prediction.
    // K3 slow-model, K8 set-points, and the other K-layer surfaces are stored lazily on this.state
    // (scienceSlowModel / scienceHomeostasis / scienceNeuro), exactly like Energy's K-layers.
    this._scienceOutcomeBuffer = [];   // rolling predicted-vs-realized stress samples (K4 self-consistency)
    this._sciencePrevPrediction = null; // last cycle's predictedStress, reconciled next cycle (K4)

    // G1 / discovery-pipeline — kick off one-shot async loads (real source bundles +
    // discovery/innovation sub-portal). Guarded internally; never blocks init.
    try { if (this._loadDiagnosisBundles) this._loadDiagnosisBundles(); } catch (e) {}
    try { if (this._loadResearchDiscoveryPipeline) this._loadResearchDiscoveryPipeline(); } catch (e) {}
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

    // ── CIRCULARITY CUT (2026-07-24) — no condition may be manufactured from this
    //    domain's own stress scalar. normalizeSignals runs BEFORE scoreStress, so these
    //    gates read the PREVIOUS cycle's stress: the resulting "active diagnosis" restated
    //    one number instead of adding evidence, and because emissions are gated on an
    //    active diagnosis and peers fold received pressure back into stress, it closed a
    //    feedback ring carrying no new information. Reground to a real feed to restore a
    //    condition; never re-derive one from stress.
    //    SURVIVES on real feeds/events : 0 of these tokens. The domain's OTHER conditions (funding_gap, retraction_surge, publication_skew, ...) are feed-derived and unaffected
    //    REMOVED, no other source in this file : 8: methodology_weakness, data_fragmentation, negative_result_suppression, reporting_gap, science_high_stress, consensus_breakdown, researcher_exodus, structural_stress

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

    // ═══ REAL research-sector tickers + authorities per diagnosis (never fabricated) ═══
    // Research instruments / tools / services: TMO Thermo Fisher, DHR Danaher, A Agilent,
    // MTD Mettler-Toledo, WAT Waters, ILMN Illumina, BIO Bio-Rad, RVTY Revvity, BRKR Bruker,
    // IQV IQVIA, ICLR ICON. Authorities: NSF, NIH, arXiv, Nature, OpenAlex, NASA, PubMed.
    var _RESEARCH_SECTORS = {
      'REPLICATION_CRISIS': { sectors: ['research-integrity tech', 'data-validation platforms', 'reproducibility infrastructure'], companies: ['TMO', 'DHR', 'IQV', 'ICLR'], examples: ['Thermo Fisher (TMO)', 'Danaher (DHR)', 'IQVIA (IQV)', 'ICON (ICLR)'], authorities: ['Retraction Watch', 'OpenAlex.org', 'PubMed', 'Reproducibility Project'] },
      'FUNDING_COLLAPSE':   { sectors: ['research-funding platforms', 'grant-admin tech', 'scientific instruments'], companies: ['TMO', 'A', 'MTD', 'WAT'], examples: ['Thermo Fisher (TMO)', 'Agilent (A)', 'Mettler-Toledo (MTD)', 'Waters (WAT)'], authorities: ['NSF Awards', 'NIH RePORTER', 'Federal Register', 'AAAS R&D Budget'] },
      'DATA_FRAUD':         { sectors: ['compliance-monitoring', 'research-notebook / provenance', 'audit tooling'], companies: ['ILMN', 'BIO', 'RVTY'], examples: ['Illumina (ILMN)', 'Bio-Rad (BIO)', 'Revvity (RVTY)'], authorities: ['Retraction Watch', 'Office of Research Integrity (ORI)', 'openFDA'] },
      'PARADIGM_CONFLICT':  { sectors: ['literature synthesis', 'preprint networks', 'discovery platforms'], companies: ['BRKR', 'MTD', 'WAT'], examples: ['Bruker (BRKR)', 'Mettler-Toledo (MTD)', 'Waters (WAT)'], authorities: ['arXiv.org', 'Nature Research', 'OpenAlex.org'] },
      'BRAIN_DRAIN':        { sectors: ['researcher-community platforms', 'CRO talent leverage', 'institutional development'], companies: ['IQV', 'ICLR'], examples: ['IQVIA (IQV)', 'ICON (ICLR)'], authorities: ['NSF NCSES/SESTAT', 'Nature Careers'] },
      'PUBLICATION_BIAS':   { sectors: ['open-access platforms', 'preprint servers', 'trial registries'], companies: ['TMO', 'IQV'], examples: ['Thermo Fisher (TMO)', 'IQVIA (IQV)'], authorities: ['ClinicalTrials.gov', 'OpenAlex.org', 'PubMed'] }
    };
    function _sectorFor(o) {
      if (o.diagnosisId && _RESEARCH_SECTORS[o.diagnosisId]) return _RESEARCH_SECTORS[o.diagnosisId];
      if (o.nearDiagnosisId && _RESEARCH_SECTORS[o.nearDiagnosisId]) return _RESEARCH_SECTORS[o.nearDiagnosisId];
      var lag = (o.source === 'lagging' && o.diagnosisId && _LAGGING_MAP[o.diagnosisId]) ? o.diagnosisId : null;
      var lagToDx = { 'methodology_mod': 'REPLICATION_CRISIS', 'open_science': 'PUBLICATION_BIAS', 'research_translation': 'PARADIGM_CONFLICT', 'workforce_dev': 'BRAIN_DRAIN' };
      if (lag && lagToDx[lag]) return _RESEARCH_SECTORS[lagToDx[lag]];
      return null;
    }

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

      // Real research-sector tickers + authorities (never fabricated; only diagnosis-mapped)
      var _sec = _sectorFor(o);
      if (_sec) {
        if (!o.companies || !o.companies.length) o.companies = _sec.companies.slice();
        o.examples = _sec.examples.slice();
        o.sectors = _sec.sectors.slice();
        o.citationHints = _sec.authorities.slice();
      }

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
        else if (o.examples && o.examples.length) target = 'Research-sector entities: ' + o.examples.join(', ') + (o.sectors && o.sectors.length ? ' (' + o.sectors.join('; ') + ').' : '.');
        else if (o.companies && o.companies.length) target = 'Mapped companies: ' + o.companies.join(', ') + '.';

        var timingParts = [];
        if (o.urgencyLabel) timingParts.push(o.urgencyLabel);
        if (pb.window) timingParts.push('Window: ' + pb.window);
        var timing = timingParts.join(' \u00b7 ');

        var evidenceParts = ['Domain: research', 'Stress: ' + stressPct + '%'];
        if (o.confidence) evidenceParts.push('Confidence: ' + o.confidence + '%');
        if (o.diagnosisId) evidenceParts.push('Diagnosis: ' + String(o.diagnosisId).replace(/_/g, ' ').toLowerCase());
        if (o.citationHints && o.citationHints.length) evidenceParts.push('Authorities: ' + o.citationHints.join(', '));
        if (pb.trigger) evidenceParts.push(pb.trigger);
        var evidence = evidenceParts.join('. ') + '.';

        var whyPays = pb.outcome || '';
        if (pb.valueRange) whyPays = (whyPays ? whyPays + ' ' : '') + 'Value range: ' + pb.valueRange + '.';
        var nextStep = (pb.fastPath && pb.fastPath.length) ? pb.fastPath[0] : (pb.steps && pb.steps.length ? pb.steps[0] : '');

        o.moneyChain = { doThis: pb.action || '', whyPays: whyPays, target: target, timing: timing, invalidIf: pb.failure || '', evidence: evidence, nextStep: nextStep };
      }
    }

    // E/I BRAKE EFFECTOR (actuated) — apply the PRIOR cycle's servo emissionFactor as a
    // proportional dampening of opportunity confidence (inhibition must scale with drive;
    // Neuro Ref XIII.1). One-cycle lag, recurrent by design. NON-duplicative: the discrete
    // governor halt/dampen is applied by the base _applyGenericBrakeGate; this adds only the
    // proportional E/I arm. Reversible via _actuation.eiBrake.
    try { if (this._actuation && this._actuation.eiBrake) this._applyScienceEIBrake(opps); } catch (e) {}

    this.state.opportunities = opps;
    this.state.opportunityCount = opps.length;
    return Promise.resolve();
  };

  // Diagnosis-specific REPORT_GENERATION step templates (mirrors energy _checkDiagnosisActions).
  // Real research authorities/sectors per diagnosis; falls back to a generic 3-step plan.
  var SCIENCE_ACTION_STEPS = {
    REPLICATION_CRISIS: [
      { type: 'ANALYZE', label: 'Assess replication-failure scope (Retraction Watch + OpenAlex citation decay)', status: 'PENDING' },
      { type: 'INVESTIGATE', label: 'Map affected fields, journals, and integrity-tech platforms (data-validation, e-lab notebooks)', status: 'PENDING' },
      { type: 'POSITION', label: 'Evaluate reproducibility-infrastructure positions (TMO, DHR, IQV, ICLR)', status: 'PENDING' }
    ],
    FUNDING_COLLAPSE: [
      { type: 'ANALYZE', label: 'Assess funding-impact via NSF Awards + NIH RePORTER + Federal Register appropriations', status: 'PENDING' },
      { type: 'INVESTIGATE', label: 'Identify affected institutions and grant-admin / research-funding platforms', status: 'PENDING' },
      { type: 'POSITION', label: 'Evaluate research-recovery / instrument-demand positions (TMO, A, MTD, WAT)', status: 'PENDING' }
    ],
    DATA_FRAUD: [
      { type: 'ANALYZE', label: 'Assess misconduct/retraction surge (Retraction Watch + ORI + journal corrections)', status: 'PENDING' },
      { type: 'INVESTIGATE', label: 'Map compliance-monitoring + research-notebook / provenance vendors', status: 'PENDING' },
      { type: 'POSITION', label: 'Evaluate integrity-tech and audit-tooling positions (ILMN, BIO, RVTY)', status: 'PENDING' }
    ],
    PARADIGM_CONFLICT: [
      { type: 'ANALYZE', label: 'Assess paradigm-challenge claims (arXiv + Nature/Science + OpenAlex citation networks)', status: 'PENDING' },
      { type: 'INVESTIGATE', label: 'Map literature-synthesis + preprint-network platforms', status: 'PENDING' },
      { type: 'POSITION', label: 'Evaluate instrument / discovery-platform positions exposed to the shift (BRKR, MTD, WAT)', status: 'PENDING' }
    ],
    BRAIN_DRAIN: [
      { type: 'ANALYZE', label: 'Assess researcher-exodus signals (NCSES/SESTAT workforce data + Nature Careers)', status: 'PENDING' },
      { type: 'INVESTIGATE', label: 'Identify affected institutions + researcher-community / talent platforms', status: 'PENDING' },
      { type: 'POSITION', label: 'Evaluate research-services and CRO talent-leverage positions (IQV, ICLR, IQV peers)', status: 'PENDING' }
    ],
    PUBLICATION_BIAS: [
      { type: 'ANALYZE', label: 'Assess reporting/negative-result suppression (ClinicalTrials.gov + OpenAlex + preprint registries)', status: 'PENDING' },
      { type: 'INVESTIGATE', label: 'Map open-access + preprint-server + registry platforms', status: 'PENDING' },
      { type: 'POSITION', label: 'Evaluate open-science infrastructure positions (research-tools and data platforms)', status: 'PENDING' }
    ]
  };
  ScienceBrain.prototype._checkDiagnosisActions = function () {
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; }); if (activeDx.length === 0) return;
    var adapters = window.LIMENActionAdapters; if (!adapters) return;
    for (var i = 0; i < activeDx.length; i++) {
      var dx = activeDx[i];
      if (adapters.getDrafts && adapters.getDrafts({ domain: 'research', intentId: dx.id }).length > 0) continue;
      var steps = SCIENCE_ACTION_STEPS[dx.id] || [
        { type: 'ANALYZE', label: 'Assess ' + dx.label + ' research impact (NSF/NIH/arXiv/OpenAlex)', status: 'PENDING' },
        { type: 'INVESTIGATE', label: 'Identify affected fields and institutions', status: 'PENDING' },
        { type: 'POSITION', label: 'Evaluate science/research opportunities (TMO, DHR, ILMN, IQV)', status: 'PENDING' }
      ];
      adapters.createDraft('REPORT_GENERATION', { domain: 'research', sourceType: 'domain_brain', sourceId: dx.id, intentId: dx.id, title: 'Science Alert: ' + dx.label, intent: { domain: 'research', title: dx.label, status: 'ACTIVE', priority: this.state.stress, progress: 0, strategyType: 'diagnosis_response', steps: steps } });
    }
  };

  ScienceBrain.prototype.resolveDeepContent = function () {
    var self = this; var resolver = window.LIMENPortalContentResolver; if (!resolver) return Promise.resolve();
    return resolver.resolveForBrain(this.state).then(function (content) { self.state.resolvedContent = content; if (content) { var dt = []; for (var dxId in content.byDiagnosis) { var dxC = content.byDiagnosis[dxId]; for (var i = 0; i < dxC.treatments.length; i++) { var t = dxC.treatments[i]; dt.push({ id: 'deep_' + t.nodeId + '_' + i, label: t.label, type: t.type, evidence: t.evidence, description: t.description, cite: t.cite, steps: t.steps, monitoring: t.monitoring, escalation: t.escalation, diagnosisId: dxId, nodeId: t.nodeId, nodeLabel: t.nodeLabel, hasDepth: t.hasDepth, source: 'canonical_deep' }); } } if (dt.length > 0) self.state.treatments = dt; } }).catch(function () {});
  };

  var _origCycle = ScienceBrain.prototype.cycle;
  ScienceBrain.prototype.cycle = function () {
    var self = this;
    return _origCycle.call(this).then(function () {
      return self.resolveDeepContent();
    }).then(function () {
      // Compute pulse — evidence validation + delta detection + freshness
      var pulse = window.LIMENSciencePulse || window.LIMENResearchPulse;
      if (pulse && typeof pulse.computePulse === 'function') {
        self.state._activeConditions = self._activeConditions || [];
        var pulseState = pulse.computePulse(self.state);
        self.state.pulse = pulseState;
        // Neuro-substrate telemetry (advisory): map live pulse -> runtime overlay via generic adapter.
        try {
          if (window.DomainTelemetryAdapter && typeof window.DomainTelemetryAdapter.fromLiveCached === "function") {
            window.DomainTelemetryAdapter.fromLiveCached("science", self.state, self._runtimeOverlay || null)
              .then(function (ov) { if (ov) self._runtimeOverlay = ov; }).catch(function () {});
          }
        } catch (_e) {}
        if (pulseState && pulseState.validatedDiagnoses) {
          for (var vdi = 0; vdi < pulseState.validatedDiagnoses.length; vdi++) {
            var vdx = pulseState.validatedDiagnoses[vdi];
            for (var sdi = 0; sdi < self.state.diagnoses.length; sdi++) {
              if (self.state.diagnoses[sdi].id === vdx.diagnosis.id) {
                if (vdx.blocked) { self.state.diagnoses[sdi].active = false; self.state.diagnoses[sdi].blocked = true; self.state.diagnoses[sdi].blockReason = vdx.reason; }
                else { self.state.diagnoses[sdi].blocked = false; }
                break;
              }
            }
          }
          self.state.diagnoses.sort(function (a, b) { if (a.active !== b.active) return a.active ? -1 : 1; return b.relevance - a.relevance; });
        }
      }
    }).then(function () {
      // PHASE B — recurrent loop step. Runs AFTER the pipeline settles, reads the prior
      // from the PREVIOUS cycle, computes prediction error, regulates, updates the next
      // prior. Research-local + try/caught (never breaks a cycle).
      try { self._updateResearchModel(); } catch (e) {}
      try { self._computeScienceOverlays(); } catch (e) {}   // NEURO-SUBSTRATE OVERLAY WIRING (per-domain, ported from energy 2026-07-21): invokes science's OWN overlay modules each cycle; shadow, proposals only
    });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // NEURO-SUBSTRATE OVERLAY WIRING — per-domain copy of energy's _computeEnergyOverlays
  // (2026-07-21, full per-domain independence). Invokes science's OWN modules
  // (window.Science{Metaplasticity,Extinction,RetrogradeThrottle,PredictionErrorCompressor,
  // OfflineMaintenance,NeuroSubstrate,ConnectivityAudit}) against science's OWN runtime def
  // (science.json runtime.params + edges/issues/activations). SHADOW: writes state.scienceOverlays;
  // the only actuation is metaplasticity -> the refractory dead-time (matches energy exactly).
  // Degrade-safe: returns mode 'off' when the modules are not on the page (they load only on the
  // science console), 'loading' until science.json arrives.
  // ════════════════════════════════════════════════════════════════════════════
  ScienceBrain.prototype._loadScienceDef = function () {
    if (this._scienceDef) return this._scienceDef;
    if (this._scienceDefLoading) return null;
    this._scienceDefLoading = true;
    var self = this;
    if (typeof fetch === 'function') {
      try {
        fetch('/assets/data/domains/science.json').then(function (r) { return r.json(); })
          .then(function (def) { self._scienceDef = def; })
          .catch(function () { self._scienceDefLoading = false; });
      } catch (e) { this._scienceDefLoading = false; }
    }
    return null;
  };

  ScienceBrain.prototype._computeScienceOverlays = function () {
    var s = this.state;
    function mod(glob, reqPath) {
      if (typeof window !== 'undefined' && window[glob]) return window[glob];
      if (typeof module !== 'undefined') { try { return require(reqPath); } catch (e) {} }
      return null;
    }
    var META = mod('ScienceMetaplasticity', '../science-metaplasticity.js');
    var EXT = mod('ScienceExtinction', '../science-extinction.js');
    var RETRO = mod('ScienceRetrogradeThrottle', '../science-retrograde-throttle.js');
    var PEC = mod('SciencePredictionErrorCompressor', '../science-prediction-error-compressor.js');
    var OFF = mod('ScienceOfflineMaintenance', '../science-offline-maintenance.js');
    var NS = mod('ScienceNeuroSubstrate', '../science-neuro-substrate.js');
    var CONN = mod('ScienceConnectivityAudit', '../science-connectivity-audit.js');
    if (!(META && EXT && RETRO && PEC && OFF && NS && CONN)) {
      s.scienceOverlays = { version: 1, mode: 'off', note: 'overlay modules not loaded on this page (present only on the science console)' };
      return null;
    }
    var def = this._loadScienceDef();
    if (!def) { s.scienceOverlays = { version: 1, mode: 'loading', note: 'science.json runtime def loading; overlays compute next cycle' }; return null; }

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

    var intero = s.scienceInteroception || (s.cognition && s.cognition.interoception) || {};
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

    s.scienceOverlays = {
      version: 1, mode: 'shadow', armed: armed,
      volatility: Math.round(volatility * 1000) / 1000,
      metaplasticity: { changes: meta.changes, adapted: adapted, noop: meta.noop },
      extinction: { candidates: ext.candidates, count: ext.candidates.length, noop: ext.noop, actuation: 'PROPOSAL-ONLY (retiring a node edits science.json — human-gated forever)' },
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
    s.scienceOverlays.mode = armed ? 'armed' : 'shadow';
    s.scienceOverlays.applied = applied;
    s.scienceOverlays.actuationScope = 'metaplasticity->refractory dead-time ONLY (bounded, fail-toward-quiet, reversible). throttle=no-live-consumer; PE=observe-only; extinction+offline-prune=PROPOSAL-ONLY (remove structure, human-gated forever).';
    s.scienceOverlays.note = 'PER-DOMAIN OVERLAY WIRING (ported from energy): science runs its OWN 6 overlay modules + connectivity recurrenceAudit each cycle on science.json. ARMED: metaplasticity raises the refractory dead-time with volatility (clamped, reversible). Everything else is proposal/observe-only.';

    if (s.cognition && typeof s.cognition === 'object') s.cognition.overlays = s.scienceOverlays;
    return s.scienceOverlays;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE B — SCIENCE/RESEARCH RECURRENT LOOP v1 (research-local, additive, reversible)
  //   prior → observation → prediction error → bounded update → next prior.
  // Proof surface: window.LIMENResearchBrain.state.researchModel
  // ════════════════════════════════════════════════════════════════════════════
  var RM_VERSION = 1;
  var RM_LEARNING_RATE = 0.25;          // bounded plasticity (fast inference)
  var RM_SLOW_RATE = 0.08;              // slow consolidation (reserved for rebuild/cron)
  var RM_STRESS_FLOOR = 0.30;           // below this → no handoff
  var RM_FLOOD_CAP = 12;                // opportunity-flood threshold
  var RM_STALE_MS = 1000 * 60 * 60 * 6; // 6h feed staleness

  function _rmClamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function _rmJaccardDistance(a, b) {
    a = a || []; b = b || [];
    if (a.length === 0 && b.length === 0) return 0;
    var union = {}, inter = 0, setB = {};
    for (var i = 0; i < b.length; i++) { setB[b[i]] = true; union[b[i]] = true; }
    var seen = {};
    for (var j = 0; j < a.length; j++) { union[a[j]] = true; if (setB[a[j]] && !seen[a[j]]) { inter++; seen[a[j]] = true; } }
    var u = Object.keys(union).length;
    return u === 0 ? 0 : 1 - (inter / u);
  }

  ScienceBrain.prototype._neutralResearchModel = function () {
    return {
      version: RM_VERSION, cycle: 0,
      prior: { expectedStress: 0.5, expectedDiagnoses: [], expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, confidence: 0, samples: 0 },
      observation: null, predictionError: null, predictedStress: null,
      plasticity: { learningRate: RM_LEARNING_RATE, slowRate: RM_SLOW_RATE, consolidation: 'cycle-light/rebuild-heavy' },
      regulation: null, readyForHandoff: false, _lowErrorStreak: 0
    };
  };

  // B2 — normalized observation from current Research state
  ScienceBrain.prototype._buildObservation = function () {
    var s = this.state || {};
    var active = (s.diagnoses || []).filter(function (d) { return d.active; });
    var feeds = s.feeds || {}, feedCount = 0, newest = 0;
    if (Array.isArray(feeds)) { feedCount = feeds.length; feeds.forEach(function (f) { var u = f && f.updated; if (u && u > newest) newest = u; }); }
    else { for (var k in feeds) { if (feeds.hasOwnProperty(k)) { feedCount++; var u = feeds[k] && feeds[k].updated; if (u && u > newest) newest = u; } } }
    return {
      stress: typeof s.stress === 'number' ? s.stress : 0,
      phase: s.phase || null,
      activeDiagnoses: active.map(function (d) { return d.id; }).sort(),
      diagnosisCount: active.length,
      opportunityCount: (s.opportunities || []).length,
      companyCount: (s.companies || []).length,
      signal: Math.min(1, feedCount / 8),
      feedNewest: newest,
      timestamp: Date.now()
    };
  };

  // B3 — prediction error: prior.expected* vs observation
  ScienceBrain.prototype._computePredictionError = function (prior, obs) {
    var stressError = Math.abs(obs.stress - prior.expectedStress);
    var signalError = Math.abs(obs.signal - prior.expectedSignal);
    var diagnosisError = _rmJaccardDistance(obs.activeDiagnoses, prior.expectedDiagnoses);
    var oppDenom = Math.max(1, prior.expectedOpportunityCount, obs.opportunityCount);
    var opportunityError = Math.abs(obs.opportunityCount - prior.expectedOpportunityCount) / oppDenom;
    var total = _rmClamp(0.4 * stressError + 0.2 * signalError + 0.25 * diagnosisError + 0.15 * opportunityError, 0, 1);
    var novelty = Math.max(stressError, diagnosisError);
    return { total: total, stressError: stressError, signalError: signalError, diagnosisError: diagnosisError, opportunityError: opportunityError, portalError: 0, novelty: novelty };
  };

  // B4 — bounded prior update toward observation (next cycle reads this)
  ScienceBrain.prototype._updatePrior = function (prior, obs, lr) {
    return {
      expectedStress: _rmClamp(prior.expectedStress + lr * (obs.stress - prior.expectedStress), 0, 1),
      expectedDiagnoses: obs.activeDiagnoses.slice(),
      expectedDiagnosisCount: prior.expectedDiagnosisCount + lr * (obs.diagnosisCount - prior.expectedDiagnosisCount),
      expectedOpportunityCount: prior.expectedOpportunityCount + lr * (obs.opportunityCount - prior.expectedOpportunityCount),
      expectedSignal: _rmClamp(prior.expectedSignal + lr * (obs.signal - prior.expectedSignal), 0, 1),
      confidence: _rmClamp(Math.min(1, (prior.samples + 1) / 20), 0, 1),
      samples: prior.samples + 1
    };
  };

  // B5 — local regulation: inhibition / gain / homeostatic set-points
  ScienceBrain.prototype._computeRegulation = function (rm, obs, pe) {
    var gain = _rmClamp(pe.novelty, 0.05, 0.95);
    var inhibition = _rmClamp(1 - pe.novelty, 0, 0.9);
    var outputScale = _rmClamp(1 - inhibition * 0.5, 0.4, 1);
    var starving = obs.stress >= RM_STRESS_FLOOR && obs.opportunityCount === 0;
    var flooding = obs.opportunityCount > RM_FLOOD_CAP;
    var streak = (pe.total < 0.05) ? (rm._lowErrorStreak || 0) + 1 : 0;
    rm._lowErrorStreak = streak;
    var looping = streak >= 3;
    var stale = obs.feedNewest > 0 ? (Date.now() - obs.feedNewest) > RM_STALE_MS : false;
    var overconfident = rm.prior.confidence > 0.8 && pe.total > 0.4;
    var label = flooding ? 'flooding' : starving ? 'starving' : stale ? 'stale' : looping ? 'looping' : overconfident ? 'overconfident' : pe.novelty > 0.4 ? 'surprised' : 'calm';
    return { gain: gain, inhibition: inhibition, outputScale: outputScale, starving: starving, flooding: flooding, looping: looping, stale: stale, overconfident: overconfident, state: label };
  };

  // The recurrent step — END of each cycle. Reads the prior from the PREVIOUS cycle,
  // so cycle N+1's interpretation depends on cycle N.
  ScienceBrain.prototype._updateResearchModel = function () {
    var rm = this.state.researchModel || this._neutralResearchModel();
    var priorIn = rm.prior;
    var obs = this._buildObservation();
    var pe = this._computePredictionError(priorIn, obs);

    var gainBlend = _rmClamp(pe.novelty, 0.05, 0.95);
    var predictedStress = priorIn.expectedStress * (1 - gainBlend) + obs.stress * gainBlend;
    var reg = this._computeRegulation(rm, obs, pe);

    var readyForHandoff = (rm.cycle > 0) && (predictedStress >= RM_STRESS_FLOOR) && (obs.diagnosisCount > 0) && !reg.flooding && !reg.stale;

    // K4 CREDIT ASSIGNMENT — routed through the ONE honest reward gate (window.LIMENK4).
    // THE RULE (owned centrally so it cannot be re-overclaimed): isReward is TRUE only when a REAL
    // external realized outcome is supplied. Science is NOT externalRewardEligible — it has no
    // external ground-truth outcome — so externalOutcome is ALWAYS null and its credit is
    // SELF-CONSISTENCY CALIBRATION (interpretive) only, NEVER reward. A P3/P7-family phase-transition
    // HIT is self-consistency calibration (interpretive), NEVER a ground-truth/dopaminergic reward.
    // The gate applies the preemption order: external-reward(4) > phase-consistency(3) >
    // call-consistency(2) > stress-consistency(1) > none. Effector = the model's effective learning
    // rate (lower credit => higher plasticity: learn faster from being wrong; credit=1 => stable).
    // Signal is built from what the brain already computes, read at a one-cycle lag: the PRIOR
    // cycle's sciencePhaseDynamics.transition (phase arm, gated by _actuation.phase) and the PRIOR
    // cycle's scienceOutcomeModel (stress self-prediction). Science has no surfaced-call resolution
    // ledger, so the call-consistency tier is not supplied (its stress self-prediction is tier 1).
    var _lr = rm.plasticity.learningRate;
    var _pt = (this.state.sciencePhaseDynamics || {}).transition;
    var _om = this.state.scienceOutcomeModel;
    var _phaseActive = !!(this._actuation && this._actuation.phase);
    var _sig = {
      externalOutcome: null,                                                     // NOT externalRewardEligible -> always null (self-consistency only, never reward)
      phaseValidated: !!(_phaseActive && _pt && _pt.validated),                  // P3/P7 family gate for the phase-consistency tier — self-consistency, NOT external reward
      phaseTransitionHit: (_phaseActive && _pt && _pt.hit != null) ? (_pt.hit ? 1 : 0) : null,
      stressSelfPred: (_om && typeof _om.callHitRate === 'number') ? _om.callHitRate : null,
      stressSamples: (_om && typeof _om.samples === 'number') ? _om.samples : 0
    };
    var _k4 = (typeof window !== 'undefined' && window.LIMENK4) ? window.LIMENK4.credit(_sig) : null;
    var _hit, _creditSource, _isReward;
    if (_k4) {
      _hit = (typeof _k4.credit === 'number') ? _k4.credit : null;
      _creditSource = _k4.creditSource;
      _isReward = !!_k4.isReward;                                                // always false for science (no external outcome)
    } else {
      // FALLBACK (gate absent) — preserve prior credit behavior: validated phase-transition hit only.
      var _phaseReward = !!(_phaseActive && _pt && _pt.validated && _pt.hit !== null);
      _hit = _phaseReward ? (_pt.hit ? 1 : 0) : null;
      _creditSource = _phaseReward ? 'phase-consistency' : 'prediction-error-self';
      _isReward = false;
    }
    if (_hit !== null) _lr = _rmClamp(_lr * (1 + (1 - _hit)), RM_SLOW_RATE, 0.6);
    rm._effectiveLearningRate = Math.round(_lr * 1000) / 1000;
    rm._creditSource = _creditSource || 'none';
    rm._creditIsReward = _isReward;                                              // false: science credit is self-consistency calibration, never external reward
    var nextPrior = this._updatePrior(priorIn, obs, _lr);

    rm.cycle += 1;
    rm.observation = obs;
    rm.predictionError = pe;
    rm.predictedStress = predictedStress;
    rm.regulation = reg;
    rm.readyForHandoff = readyForHandoff;
    rm.prior = nextPrior;
    rm.updated = obs.timestamp;
    this.state.researchModel = rm;

    // H1-H6 — higher research brain layers, computed once per cycle BEFORE the DDP build.
    try { this._computeScienceHigherLayers(); } catch (e) {}

    // PHASE K — neuro-completion layers (K1..K8), run in the SAME order Energy uses, BEFORE the
    // servo/phase actuation so the servo can read K8's deviation term. Advisory: each K-layer
    // COMPUTES and EXPOSES its signal on state without rewiring the scoring spine. Deterministic,
    // guarded, no AI, no network — never breaks a cycle.
    try { this._computeScienceNeuroLayers(); } catch (e) {}

    // THING2 KERNEL PHASE — push the current primary STRESS scalar into the persistent series and
    // ask the REAL recursive kernel for the phase, BEFORE phase dynamics reads it. Pure math,
    // guarded, never breaks a cycle. On failure/unavailable, _kernelPhase stays null (fallback).
    try { this._updateKernelPhase(); } catch (e) { this._kernelPhase = null; this.state.phaseSource = 'fallback'; }

    // ACTUATION LAYER — servo (regulate-to-target) + phase dynamics (coherence router +
    // P3/P7-gated transition reward) + E/I regulation advisories (E/I balance + self-audit
    // SPOF from science.json edges). Each behind its _actuation flag; the eiBrake EFFECTOR is
    // applied one cycle later inside surfaceOpportunities via _applyScienceEIBrake. Deterministic,
    // guarded, never breaks a cycle. See init() for the validity gate.
    try { if (this._actuation && this._actuation.servo) this._computeScienceServo(); } catch (e) {}
    try { if (this._actuation && this._actuation.phase) this._computeSciencePhaseDynamics(); } catch (e) {}
    try { this._computeScienceRegulationAdvisories(); } catch (e) {}

    // Research discovery/innovation pipeline layer (additive; BEFORE DDP build).
    // Never merged into the validated diagnosis spine.
    try { this._buildResearchDiscoveryLayer(); } catch (e) {}

    // Generic cognition surface the console SELF-MODEL panel renders for ANY domain.
    // domain='research' = the snapshot/runtime key (portal/URL key is 'science').
    try {
      this.state.cognition = {
        domain: 'research',
        model: { cycle: rm.cycle, predictionError: rm.predictionError, predictedStress: rm.predictedStress, regulation: rm.regulation, creditSource: rm._creditSource || null, effectiveLearningRate: rm._effectiveLearningRate || null },
        awareness: this.state.researchAwareness || null,
        conscience: this.state.researchConscience || null,
        immune: this.state.researchImmune || null,
        intuition: this.state.researchIntuition || null,
        // ACTUATION surfaces (null when the corresponding _actuation flag is off)
        actuation: this._actuation || null,
        servo: this.state.scienceServo || null,
        phaseDynamics: this.state.sciencePhaseDynamics || null,
        regulation2: this.state.scienceRegulation || null,
        // PHASE K neuro-completion roll-up (K1..K8), additive key; existing keys untouched
        neuro: this.state.scienceNeuro || null
      };
    } catch (e) {}

    // F1 — build the DomainDiagnosisPacket (schema) for the primary diagnosis,
    // and expose one per diagnosis. Schema-only: never invents data.
    try {
      var _diags = this.state.diagnoses || [];
      var _primary = _diags.filter(function (d) { return d.active; })[0] || _diags[0] || null;
      var _self = this;
      rm.domainDiagnosisPacket = this._buildDomainDiagnosisPacket(_primary);
      this.state.researchDomainDiagnosisPacket = rm.domainDiagnosisPacket;
      this.state.researchDomainDiagnosisPackets = _diags.map(function (d) { return _self._buildDomainDiagnosisPacket(d); });
    } catch (e) {}

    // populate outcomeLog (memory)
    try {
      var mem = this.state.memory;
      if (mem && mem.outcomeLog) {
        mem.outcomeLog.push({ cycle: rm.cycle, predictionError: Math.round(pe.total * 1000) / 1000, stress: obs.stress, activeDx: obs.diagnosisCount, readyForHandoff: readyForHandoff, regulation: reg.state, timestamp: obs.timestamp });
        if (mem.outcomeLog.length > 50) mem.outcomeLog.shift();
      }
    } catch (e) {}

    return rm;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // G1 — canonical resolution + REAL source bundles (one-shot, async). 404s are
  // 'missing'; never fabricated. Research diagnoses are canonical-to-self unless the
  // artifact-source-index aliases() table maps them.
  // ════════════════════════════════════════════════════════════════════════════
  var RESEARCH_DIAGNOSIS_ALIASES = {};   // science diagnoses are canonical-to-self
  ScienceBrain.prototype._resolveCanonicalDiagnosis = function (dxId) {
    if (!dxId) return { canonicalDiagnosisId: null, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };
    var target = null;
    try {
      var idx = (typeof window !== 'undefined') ? window.LIMENArtifactSourceIndex : null;
      if (idx && typeof idx.aliases === 'function') { var row = idx.aliases()[dxId]; if (row && row.target) target = row.target; }
    } catch (e) {}
    var local = RESEARCH_DIAGNOSIS_ALIASES[dxId] || null;
    if (!target && local) target = local.target;
    if (target) return { canonicalDiagnosisId: target, aliasUsed: true, aliasReviewStatus: (local && local.reviewStatus) || 'corpus-aliased', aliasRisk: (local && local.risk) || 'low', aliasNote: (local && local.note) || null };
    return { canonicalDiagnosisId: dxId, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };
  };

  ScienceBrain.prototype._loadDiagnosisBundles = function () {
    var self = this;
    if (self._bundleLoadPromise) return self._bundleLoadPromise;
    self._bundleCache = self._bundleCache || {};
    self._bundleStatusMap = self._bundleStatusMap || {};
    var ids = {};
    var known = ['REPLICATION_CRISIS', 'FUNDING_COLLAPSE', 'DATA_FRAUD', 'PARADIGM_CONFLICT', 'BRAIN_DRAIN', 'PUBLICATION_BIAS'];
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

  ScienceBrain.prototype._researchBundleStates = function () {
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

  // ════════════════════════════════════════════════════════════════════════════
  // RESEARCH DISCOVERY / INNOVATION PIPELINE LAYER (additive; mirrors energy data-center
  // / medicine clinical-pipeline layer). Real-content sub-portal carrying discovery,
  // replication-success, funding-innovation, and breakthrough dynamics + real research
  // institution tickers (TMO, DHR, A, MTD, WAT, ILMN, BIO, RVTY, BRKR, IQV, ICLR).
  // NEVER merged into the validated diagnosis spine; no external bundle yet. Surfaces
  // ONLY what exists in the data file — never fabricates researchers/papers/tickers.
  // ════════════════════════════════════════════════════════════════════════════
  ScienceBrain.prototype._loadResearchDiscoveryPipeline = function () {
    var self = this;
    if (self._rdLoadPromise) return self._rdLoadPromise;
    var SOURCES = ['/assets/data/domains/research_discoveries.json', '/assets/data/domains/research_innovation.json'];
    self._rdLoadPromise = (function tryNext(i) {
      if (i >= SOURCES.length) { self._rdPortal = null; return Promise.resolve(null); }
      return fetch(SOURCES[i])
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) {
          if (!data) return tryNext(i + 1);
          self._rdPortal = { issues: data.issues || [], activations: data.activations || [], title: data.title || 'Research Discovery Pipeline' };
          return self._rdPortal;
        })
        .catch(function () { return tryNext(i + 1); });
    })(0);
    return self._rdLoadPromise;
  };

  ScienceBrain.prototype._buildResearchDiscoveryLayer = function () {
    var self = this;
    var rd = self._rdPortal;
    if (!rd || !rd.issues || !rd.issues.length) {
      self.state.discoveryPipelineDiagnoses = [];
      self.state.discoveryPipelineTreatments = [];
      self.state.discoveryPipelineDomainDiagnosisPackets = [];
      self.state._discoveryPipelineCache = { loaded: false, count: 0, activeCount: 0, diagnoses: [], note: 'research discovery/innovation sub-portal not loaded (offline or fetch failed)' };
      return self.state._discoveryPipelineCache;
    }
    var conditions = self._activeConditions || [];
    var diagnoses = rd.issues.map(function (iss) {
      var triggers = (self.diagnosisIndex && self.diagnosisIndex[iss.id]) || [];
      var matchCount = 0;
      for (var t = 0; t < triggers.length; t++) {
        for (var c = 0; c < conditions.length; c++) {
          if (conditions[c] === triggers[t] || String(conditions[c]).indexOf(triggers[t]) !== -1) matchCount++;
        }
      }
      return { id: iss.id, label: iss.label, summary: iss.summary || '',
        active: matchCount > 0,
        relevance: triggers.length ? Math.round((matchCount / triggers.length) * 100) / 100 : 0,
        circuits: iss.circuits || [], source: 'research-discovery', tier: 'real-content-unbundled', branch: 'research-discovery' };
    });
    var nodeToDx = {};
    diagnoses.forEach(function (d) { (d.circuits || []).forEach(function (c) { if (c && c.nodeId) nodeToDx[c.nodeId] = d.id; }); });
    var treatments = [], tickers = {};
    (rd.activations || []).forEach(function (act) {
      (act.companies || []).forEach(function (c) { if (c && c.ticker_or_id) tickers[c.ticker_or_id] = c.name || c.ticker_or_id; });
      var dxId = nodeToDx[act.brainNodeId];
      if (!dxId) return;
      (act.treatments || []).forEach(function (t, ti) {
        treatments.push({ id: 'rd_treat_' + act.brainNodeId + '_' + ti, label: t.label, type: t.type, evidence: t.evidence, description: t.description || '', cite: t.cite || null, citation: t.citation || [], steps: t.steps || [], diagnosisId: dxId, nodeId: act.brainNodeId, source: 'research-discovery' });
      });
    });
    var evidenceRank = { A: 10, Strong: 10, B: 7, Moderate: 7, C: 4, Emerging: 1 };
    treatments.sort(function (a, b) { return (evidenceRank[b.evidence] || 0) - (evidenceRank[a.evidence] || 0); });
    self.state.discoveryPipelineDiagnoses = diagnoses;
    self.state.discoveryPipelineTreatments = treatments;
    self.state._discoveryPipelineCache = {
      loaded: true, portalTitle: rd.title,
      count: diagnoses.length, activeCount: diagnoses.filter(function (d) { return d.active; }).length,
      realCompanyTickers: Object.keys(tickers).map(function (k) { return { ticker: k, name: tickers[k], relevanceUnverified: true }; }),
      diagnoses: diagnoses.map(function (d) {
        var rc = self._resolveCanonicalDiagnosis ? self._resolveCanonicalDiagnosis(d.id) : { canonicalDiagnosisId: d.id };
        var bs = (self._bundleStatusMap && self._bundleStatusMap[rc.canonicalDiagnosisId]) || 'missing';
        return { id: d.id, label: d.label, active: d.active, branch: 'research-discovery', canonicalDiagnosisId: rc.canonicalDiagnosisId, bundleStatus: bs, treatmentCount: treatments.filter(function (t) { return t.diagnosisId === d.id; }).length };
      }),
      note: 'real-content (discovery/innovation pipeline) sub-portal diagnoses; SEPARATE from the validated diagnosis spine; no external source bundle yet; tickers relevance-unverified; never admitted to evidenceAnchors'
    };
    self.state.discoveryPipelineDomainDiagnosisPackets = diagnoses.map(function (d) {
      try { return self._buildDomainDiagnosisPacket(d); } catch (e) { return null; }
    }).filter(Boolean);
    return self.state._discoveryPipelineCache;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE H1-H6 — HIGHER RESEARCH BRAIN LAYERS (research-local, additive, domain-level).
  // Computed once per cycle BEFORE the DDP build; each emits a COMPACT summary the DDP
  // embeds in promptView + the full object in audit. Never fabricates evidence;
  // intuition/simulation are explicitly labelled unverified/hypothetical.
  // ════════════════════════════════════════════════════════════════════════════

  // H1 — formal immune system
  ScienceBrain.prototype._computeScienceImmune = function () {
    var s = this.state, rm = s.researchModel || {}, reg = rm.regulation || {}, bs = this._researchBundleStates();
    var ant = [];
    bs.forEach(function (b) {
      if (b.bundleStatus === 'missing') ant.push({ type: 'source-bundle-missing', dx: b.dxId, severity: 'medium', action: 'block-from-prompt-evidence' });
      if (b.buildMethod === 'external-source-authored') ant.push({ type: 'external-source-authored-needs-human-verification', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
      if (b.aliasRisk === 'medium' || b.aliasRisk === 'high') ant.push({ type: 'alias-risk-bundle', dx: b.dxId, severity: b.aliasRisk, action: 'allow-with-warning' });
      if (b.bundleStatus === 'found' && b.shallow) ant.push({ type: 'root-only-shallow-bundle', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
    });
    var pe = (rm.predictionError && rm.predictionError.total) || 0;
    if (pe > 0.4) ant.push({ type: 'prediction-error-spike', severity: 'medium', action: 'lower-confidence', value: Math.round(pe * 1000) / 1000 });
    if (reg.stale) ant.push({ type: 'stale-feeds', severity: 'low', action: 'flag' });
    if (reg.flooding) ant.push({ type: 'opportunity-flood', severity: 'medium', action: 'inhibit' });
    if (reg.starving) ant.push({ type: 'unsupported-artifact-readiness-risk', severity: 'low', action: 'flag' });
    // research-specific antigens: synthetic discovery-portal content + integrity contamination
    if (s._discoveryPipelineCache && s._discoveryPipelineCache.loaded) ant.push({ type: 'unbundled-discovery-pipeline-content', severity: 'low', action: 'allow-with-warning', note: 'discovery/innovation sub-portal is real-content but has no external source bundle yet; tickers relevance-unverified' });
    var sev = ant.some(function (a) { return a.severity === 'high'; }) ? 'high' : ant.some(function (a) { return a.severity === 'medium'; }) ? 'medium' : ant.length ? 'low' : 'none';
    var im = {
      version: 1, immuneState: sev === 'high' ? 'alert' : sev === 'medium' ? 'active' : sev === 'low' ? 'watch' : 'clear', severity: sev,
      antigens: ant.slice(0, 12),
      quarantines: ['unbundled-discovery-pipeline-content', 'publication-bias-uncorrected-citations'],
      allowedWithWarning: ant.filter(function (a) { return a.action === 'allow-with-warning'; }).map(function (a) { return a.type + (a.dx ? (':' + a.dx) : ''); }),
      blockedFromPrompt: ant.filter(function (a) { return a.action === 'block-from-prompt-evidence'; }).map(function (a) { return a.dx; }),
      blockedFromTraversal: [],
      immuneMemory: (((s.researchImmune && s.researchImmune.immuneMemory) || 0) + 1),
      lastScanAt: rm.updated || null
    };
    s.researchImmune = im; return im;
  };

  // H2 — awareness / metacognition
  ScienceBrain.prototype._computeScienceAwareness = function () {
    var s = this.state, rm = s.researchModel || {}, im = s.researchImmune || {}, bs = this._researchBundleStates();
    var covered = bs.filter(function (b) { return b.bundleStatus === 'found'; });
    var missing = bs.filter(function (b) { return b.bundleStatus === 'missing'; });
    var hv = bs.filter(function (b) { return b.humanVerification === 'required'; });
    var active = (s.diagnoses || []).filter(function (d) { return d.active; });
    var prev = s.researchAwareness || {};
    var pe = (rm.predictionError && rm.predictionError.total) || 0;
    var aw = {
      version: 1,
      selfState: im.immuneState === 'alert' ? 'guarded' : (rm.regulation && rm.regulation.state) || 'unknown',
      knowns: covered.map(function (b) { return b.dxId + ' (source-backed' + (b.buildMethod === 'external-source-authored' ? ', external' : '') + ')'; }),
      unknowns: missing.map(function (b) { return b.dxId + ' (no source bundle)'; }),
      uncertainties: ['discovery/innovation pipeline diagnoses are unbundled (real-content, no source bundle yet)', 'research institution tickers exist in the discovery layer but node-bindings are relevance-unverified', 'predictionError=' + (Math.round(pe * 1000) / 1000)],
      suppressions: (im.quarantines || []).slice(),
      confidenceDrivers: ['source coverage ' + covered.length + '/' + bs.length, 'regulation ' + ((rm.regulation && rm.regulation.state) || '?')],
      changedSinceLastCycle: { predictionErrorDelta: Math.round((pe - (typeof prev._pe === 'number' ? prev._pe : pe)) * 1000) / 1000, coverageNow: covered.length },
      humanReviewRequired: hv.map(function (b) { return b.dxId; }),
      selfNarrative: 'Research: ' + covered.length + '/' + bs.length + ' source-backed, ' + active.length + ' active dx, immune=' + (im.immuneState || '?') + ', discovery-pipeline unbundled, ' + hv.length + ' need human verification.',
      lastAwarenessAt: rm.updated || null, _pe: pe
    };
    s.researchAwareness = aw; return aw;
  };

  // H3 — conscience / veto (overclaim + source-sufficiency + research-integrity)
  ScienceBrain.prototype._computeScienceConscience = function () {
    var s = this.state, rm = s.researchModel || {}, bs = this._researchBundleStates();
    var pe = (rm.predictionError && rm.predictionError.total) || 0;
    var vetoes = [], cautions = [], allowed = [], blocked = ['patent-claim', 'grant-claim'];
    // retired-lane veto removed 2026-07-14: patent/grant are dead lanes; vetoing them forced
    // conscienceState 'restrictive' every cycle. Real vetoes (missing source bundles) still drive it.
    // research-specific integrity veto: never assert a scientific finding is replicated/validated
    vetoes.push({ claim: 'finding-replicated/scientific-validity', reason: 'research domain never asserts a finding is replicated, true, or peer-validated — only surfaces research-system stress and investable/researchable structure; replication/validity is a human peer-review step' });
    blocked.push('finding-validity-claim');
    bs.forEach(function (b) {
      if (b.bundleStatus === 'missing') { blocked.push('strong-claim:' + b.dxId); vetoes.push({ claim: 'strong-claim:' + b.dxId, reason: 'no source bundle' }); }
      else if (b.buildMethod === 'external-source-authored') { cautions.push({ claim: 'strong-claim:' + b.dxId, reason: 'external-source-authored; human-verification-required' }); allowed.push('source-routing:' + b.dxId); }
      else if (b.aliasRisk === 'medium' || b.aliasRisk === 'high') { cautions.push({ claim: 'precise-technical-claim:' + b.dxId, reason: 'aliasRisk ' + b.aliasRisk + '; include alias warning' }); allowed.push('source-summary:' + b.dxId); }
      else if (b.bundleStatus === 'found') { allowed.push('source-summary:' + b.dxId); }
    });
    if (pe > 0.4) cautions.push({ claim: 'high-confidence-claim', reason: 'predictionError spike ' + (Math.round(pe * 1000) / 1000) });
    var hasFound = bs.some(function (b) { return b.bundleStatus === 'found'; });
    var con = {
      version: 1, conscienceState: vetoes.length ? 'restrictive' : 'permissive',
      vetoes: vetoes.slice(0, 10), cautions: cautions.slice(0, 10),
      allowedClaims: ['source-summary'].concat(hasFound ? ['investment-memo-with-warnings'] : []).concat(allowed.slice(0, 6)),
      blockedClaims: blocked.slice(0, 10),
      artifactReadinessDecision: { patentReady: false, grantReady: false, sbaReady: false, investmentReady: hasFound, researchReady: hasFound, note: 'patent/grant vetoed (no candidate fields); finding-validity claims vetoed (replication is a peer-review step); investment/research allowed-with-warning only for source-backed diagnoses' },
      reasons: ['overclaim prevention', 'source sufficiency', 'research-integrity preservation (no replication/validity claims)', 'human-verification preservation'],
      lastCheckAt: rm.updated || null
    };
    s.researchConscience = con; return con;
  };

  // H4 — intuition / weak-signal (NOT evidence; labelled unverified)
  ScienceBrain.prototype._computeScienceIntuition = function () {
    var s = this.state, rm = s.researchModel || {}, reg = rm.regulation || {};
    var log = (s.memory && s.memory.outcomeLog) || [];
    var hunches = [];
    if (log.length >= 2) {
      var a = log[log.length - 2].predictionError, b = log[log.length - 1].predictionError;
      if (typeof a === 'number' && typeof b === 'number' && b - a > 0.05) hunches.push({ hunch: 'regime shift forming (prediction error rising)', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'predictionError rose ' + a + '->' + b, verifyIf: 'error keeps rising 2+ cycles', falsifyIf: 'error returns to baseline' });
    }
    if (reg.state === 'surprised') hunches.push({ hunch: 'novel research stressor entering the system', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'regulation=surprised (high novelty)', verifyIf: 'a specific diagnosis activates with source support', falsifyIf: 'novelty subsides next cycle' });
    var cond = s._activeConditions || this._activeConditions || [];
    if (cond.indexOf('retraction_surge') !== -1) hunches.push({ hunch: 'rising research-integrity pressure (retraction surge)', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'retraction_surge condition active', verifyIf: 'data_integrity or misconduct co-activate', falsifyIf: 'retraction volume normalizes' });
    if (cond.indexOf('funding_cut') !== -1) hunches.push({ hunch: 'funding-collapse pressure building across institutions', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'funding_cut condition active', verifyIf: 'budget_constraint or grant_decline co-activate', falsifyIf: 'funding signals normalize' });
    if (cond.indexOf('breakthrough_claim') !== -1) hunches.push({ hunch: 'paradigm-shift claim entering the discourse', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'breakthrough_claim condition active', verifyIf: 'consensus_breakdown or paradigm_challenge co-activate', falsifyIf: 'claim fails to propagate' });
    var missing = this._researchBundleStates().filter(function (x) { return x.bundleStatus === 'missing' && x.active; });
    if (missing.length) hunches.push({ hunch: 'recurring uncovered diagnosis: ' + missing[0].dxId, label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'active diagnosis with no source bundle', verifyIf: 'a real source bundle is built', falsifyIf: 'diagnosis deactivates' });

    var patternMatches = [];
    var recent = log.slice(-10), regCount = {};
    recent.forEach(function (e) { if (e.regulation) regCount[e.regulation] = (regCount[e.regulation] || 0) + 1; });
    Object.keys(regCount).forEach(function (k) { if (regCount[k] >= 3) patternMatches.push({ pattern: 'recurring regulation state: ' + k, occurrences: regCount[k], window: recent.length, label: 'PATTERN', evidenceStatus: 'UNVERIFIED' }); });

    // research structural-family map (analogy, NOT evidence)
    var FAMILY = { 'integrity': ['REPLICATION_CRISIS', 'DATA_FRAUD'], 'resourcing': ['FUNDING_COLLAPSE', 'BRAIN_DRAIN'], 'epistemics': ['PARADIGM_CONFLICT', 'PUBLICATION_BIAS'] };
    var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var primaryId = (active[0] || (s.diagnoses || [])[0] || {}).id;
    var analogies = [];
    Object.keys(FAMILY).forEach(function (fam) { if (FAMILY[fam].indexOf(primaryId) >= 0) { FAMILY[fam].forEach(function (sib) { if (sib !== primaryId) analogies.push({ analogy: primaryId + ' resembles ' + sib, family: fam, label: 'ANALOGY', evidenceStatus: 'UNVERIFIED', note: 'shared structural failure-family — a lens for monitoring, not a claim' }); }); } });

    var hmem = this._hunchMemory = this._hunchMemory || {};
    var curKeys = {}; hunches.forEach(function (h) { curKeys[h.hunch] = true; hmem[h.hunch] = (hmem[h.hunch] || 0) + 1; });
    var promotedToMonitoring = [], rejectedHunches = [];
    Object.keys(hmem).forEach(function (k) {
      if (!curKeys[k]) { rejectedHunches.push({ hunch: k, reason: 'signal subsided across cycles (falsifier path)' }); delete hmem[k]; return; }
      if (hmem[k] >= 3) promotedToMonitoring.push({ target: k, basis: 'recurred ' + hmem[k] + ' cycles', note: 'monitoring target ONLY — never evidence or diagnosis' });
    });

    var it = {
      version: 1, hunches: hunches.slice(0, 3), weakSignals: hunches.map(function (h) { return h.why; }),
      patternMatches: patternMatches.slice(0, 5), analogies: analogies.slice(0, 4), confidence: 'LOW', evidenceStatus: 'UNVERIFIED',
      promotedToDiagnosis: [], promotedToMonitoring: promotedToMonitoring.slice(0, 4), rejectedHunches: rejectedHunches.slice(0, 4), lastIntuitionAt: rm.updated || null
    };
    s.researchIntuition = it; return it;
  };

  // H5 — simulation / bounded counterfactual (hypothetical only)
  ScienceBrain.prototype._computeScienceSimulation = function () {
    var s = this.state, rm = s.researchModel || {};
    var base = typeof s.stress === 'number' ? s.stress : 0;
    function cl(v) { return Math.max(0, Math.min(1, Math.round(v * 1000) / 1000)); }
    var scenarios = [
      { type: 'worsen', hypothetical: true, assumption: 'research stressor intensifies (paradigm conflict + publication bias spread)', simulatedStress: cl(base + 0.2), risk: 'cascade toward systemic research-integrity stress', intervention: 'monitor Nature/Science press + arXiv submission volume + Retraction Watch', falsifier: 'stress flat or falling next cycle' },
      { type: 'stabilize', hypothetical: true, assumption: 'funding holds and integrity signals steady', simulatedStress: cl(base), risk: 'persistent elevated baseline', intervention: 'maintain monitoring cadence (NSF/NIH/arXiv)', falsifier: 'stress moves materially' },
      { type: 'recover', hypothetical: true, assumption: 'replication studies succeed and funding restores', simulatedStress: cl(base - 0.2), risk: 'premature de-escalation', intervention: 'confirm with 2 independent sources (OpenAlex + PubMed) before standing down', falsifier: 'stress re-rises' },
      { type: 'funding-shock', hypothetical: true, assumption: 'NSF/NIH appropriations cut', simulatedStress: cl(base + 0.25), risk: 'grant attrition + brain drain (FUNDING_COLLAPSE / BRAIN_DRAIN)', intervention: 'track NIH RePORTER / NSF awards / Federal Register appropriations', falsifier: 'grant volume stable' },
      { type: 'breakthrough-claim', hypothetical: true, assumption: 'major paradigm-shift announcement', simulatedStress: cl(base + 0.15), risk: 'unvalidated claim drives misallocation (PARADIGM_CONFLICT)', intervention: 'validate via peer review + preprint replication (Nature / arXiv / OpenAlex)', falsifier: 'claim fails independent replication' }
    ];
    var sim = {
      version: 1, scenarios: scenarios, assumptions: scenarios.map(function (x) { return x.assumption; }),
      simulatedStress: scenarios.map(function (x) { return x.simulatedStress; }),
      simulatedDiagnoses: ['REPLICATION_CRISIS', 'FUNDING_COLLAPSE', 'PARADIGM_CONFLICT'], simulatedOpportunities: [],
      risks: scenarios.map(function (x) { return x.risk; }), interventions: scenarios.map(function (x) { return x.intervention; }),
      falsifiers: scenarios.map(function (x) { return x.falsifier; }), lastSimulatedAt: rm.updated || null
    };
    s.researchSimulation = sim; return sim;
  };

  // H6 — executive self-report (compact status card)
  ScienceBrain.prototype._computeScienceExecutiveReport = function () {
    var s = this.state, rm = s.researchModel || {}, im = s.researchImmune || {}, aw = s.researchAwareness || {}, con = s.researchConscience || {}, it = s.researchIntuition || {}, sim = s.researchSimulation || {}, bs = this._researchBundleStates();
    var covered = bs.filter(function (b) { return b.bundleStatus === 'found'; }).length;
    var hv = bs.filter(function (b) { return b.humanVerification === 'required'; }).length;
    var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var strongest = active[0] || (s.diagnoses || [])[0] || null;
    var pe = (rm.predictionError && rm.predictionError.total) || 0;
    var status = im.immuneState === 'alert' ? 'immune-alert' : hv > 0 ? 'human-review-required' : covered < bs.length ? 'source-limited' : (rm.regulation && rm.regulation.starving) ? 'starving' : (rm.regulation && rm.regulation.state === 'surprised') ? 'surprised' : 'healthy';
    var rep = {
      version: 1, brainStatus: status,
      strongestDiagnosis: strongest ? strongest.id : null,
      strongestOpportunity: (s.opportunities && s.opportunities[0] && s.opportunities[0].title) || null,
      confidence: Math.round((1 - pe) * 100) / 100, predictionError: Math.round(pe * 1000) / 1000,
      regulationState: (rm.regulation && rm.regulation.state) || null, immuneState: im.immuneState || null,
      awarenessSummary: aw.selfNarrative || null, conscienceDecision: con.conscienceState || null,
      intuitionSummary: (it.hunches || []).length + ' hunch(es)', simulationSummary: (sim.scenarios || []).length + ' scenario(s)',
      artifactReadiness: con.artifactReadinessDecision || null, blockers: (con.blockedClaims || []).slice(0, 6),
      nextBestAction: covered < bs.length ? 'build/verify source for uncovered diagnoses' : hv > 0 ? 'human-verify external-source bundles' : 'monitor strongest diagnosis sources',
      lastReportAt: rm.updated || null
    };
    s.researchExecutiveReport = rep; return rep;
  };

  ScienceBrain.prototype._computeScienceHigherLayers = function () {
    this._computeScienceImmune();
    this._computeScienceAwareness();
    this._computeScienceConscience();
    this._computeScienceIntuition();
    this._computeScienceSimulation();
    this._computeScienceExecutiveReport();
  };

  // ════════════════════════════════════════════════════════════════════════════
  // ACTUATION LAYER — ported from energy-brain.js, validity-gated per this domain.
  // COST-SAFE: 100% deterministic (no fetch-to-LLM, no paid AI) and runs on the 30s cycle.
  // Additive + reversible (flip the _actuation flags). Effectors touch ONLY opportunity
  // confidence + the model's effective learning rate; never rewrite stress/diagnoses/science.json.
  // ════════════════════════════════════════════════════════════════════════════

  // REGULATE-TO-TARGET SERVO (Neuro Ref XIII.1 / V.2 / XII). Mirrors _computeEnergyServo but reads
  // THIS domain's real state: drive = stress + live-condition count + active-diagnosis count;
  // inhibition = researchModel.regulation.inhibition (a term the recurrent loop already produces);
  // deviation = current stress above an adaptive rolling baseline (inline homeostasis, since this
  // brain has no K8 layer). Controller = PI (fast proportional + bounded slow integral = the HPA
  // fast+slow arms). Effector = emissionFactor consumed next cycle by _applyScienceEIBrake.
  ScienceBrain.prototype._computeScienceServo = function () {
    function R(x) { return Math.round(x * 1000) / 1000; }
    var s = this.state, rm = s.researchModel || {}, reg = rm.regulation || {};
    // SENSOR: excitatory drive vs current inhibition
    var stress = (typeof s.stress === 'number') ? s.stress : 0;
    var conds = Array.isArray(s._activeConditions) ? s._activeConditions.length
              : (Array.isArray(this._activeConditions) ? this._activeConditions.length : 0);
    var dxA = Array.isArray(s.diagnoses) ? s.diagnoses.filter(function (d) { return d && d.active; }).length : 0;
    var drive = Math.max(0, Math.min(2, stress + Math.min(conds, 12) / 24 + Math.min(dxA, 6) / 24));
    var inhibition = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;
    var FLOOR = 0.15;
    // adaptive baseline (inline homeostasis over recent stress history) -> deviation above it
    var hist = ((s.memory && s.memory.stressHistory) || []).slice(-12);
    var n = hist.length, sum = 0; for (var i = 0; i < n; i++) sum += (hist[i].stress || 0);
    var baseline = n ? sum / n : 0.5;
    var deviation = Math.max(0, stress - baseline);
    // TARGET (allostatic set-point): inhibition must track drive, and rise with deviation above baseline
    var target = Math.max(FLOOR, Math.min(1, Math.max(drive, FLOOR + deviation)));
    var error = target - inhibition;                                    // >0 => under-braked for the drive/regime
    // CONTROLLER: bounded integral (slow arm) + proportional (fast arm)
    this._servoIntegral = Math.max(-0.5, Math.min(0.5, (this._servoIntegral || 0) + error * 0.15));
    var Kp = 0.8, Ki = 0.4;
    var correction = Math.max(0, Kp * error + Ki * Math.max(0, this._servoIntegral));   // only ADD braking; never disinhibit
    // EFFECTOR: proportional dampening of emission confidence
    var emissionFactor = Math.max(0.2, Math.min(1, 1 - correction));
    var state = error > 0.25 ? 'runaway-risk' : ((inhibition - target) > 0.4 ? 'over-inhibited' : 'balanced');
    var servo = {
      version: 1, actuated: true, drive: R(drive), inhibition: R(inhibition), target: R(target),
      error: R(error), integral: R(this._servoIntegral), emissionFactor: R(emissionFactor),
      deviation: R(deviation), baseline: R(baseline), state: state,
      note: 'closed-loop allostasis: drives inhibition toward a drive+deviation target; effector = proportional opportunity-confidence dampening (Neuro Ref XIII.1/V.2/XII).'
    };
    s.scienceServo = servo;
    return servo;
  };

  // E/I BRAKE EFFECTOR — consumes the PRIOR cycle's servo emissionFactor to dampen opportunity
  // confidence proportionally to how far inhibition trails drive. Mirrors the eiFactor arm of
  // _computeEnergyBrake. Records s.scienceEIBrake for observability. Non-duplicative with the base
  // generic governor brake (which handles the discrete halt/dampen for this domain).
  ScienceBrain.prototype._applyScienceEIBrake = function (opps) {
    var servo = this.state.scienceServo || null;
    var factor = (servo && typeof servo.emissionFactor === 'number') ? servo.emissionFactor : 1;
    var dampened = 0;
    if (factor < 1 && Array.isArray(opps)) {
      for (var i = 0; i < opps.length; i++) {
        if (typeof opps[i].confidence === 'number') { opps[i].confidence = Math.round(opps[i].confidence * factor); dampened++; }
        opps[i].eiFactor = Math.round(factor * 1000) / 1000;
      }
    }
    this.state.scienceEIBrake = {
      version: 1, applied: factor < 1, eiFactor: Math.round(factor * 1000) / 1000, dampenedCount: dampened,
      servoState: servo ? servo.state : null,
      note: 'proportional E/I dampening of opportunity confidence (inhibition must scale with drive; Neuro Ref XIII.1). One-cycle lag; reversible via _actuation.eiBrake.'
    };
    return opps;
  };

  // PHASE-COHERENCE ROUTER + PHASE-TRANSITION READ. Mirrors _computeEnergyPhaseDynamics.
  //  (A) coherence router: couple to co-phased, stressed peer domains via the patent Loop-1 phase
  //      matrix M (thing2 lineage). Positive M = same excitability window = communicate.
  //  (B) phase-transition read: did a predicted transition actually occur over time? The PREDICTION
  //      is this brain's OWN forward read (researchModel.predictedStress vs current stress). The hit is
  //      self-consistency calibration (interpretive) — the P3/P7-family gate (validated) selects the
  //      phase-consistency tier in the central window.LIMENK4 gate; it is NEVER an external reward
  //      (science is not externalRewardEligible). Consumed by the K4 credit hook via LIMENK4.credit.
  // THING2 KERNEL PHASE SOURCE. Push the domain's primary scalar (state.stress = STRESS, up=bad
  // -> positive:false) into a persistent rolling window (cap 60, persisted to localStorage) and
  // run the REAL Thing2 recursive phase kernel over it. Pure math (no network, no AI): the 30s
  // cycle stays deterministic. Sets this._kernelPhase (preferred phase for the coherence router +
  // phase-transition reward) or leaves it null so the existing naive/static s.phase remains the
  // fallback. seriesSource = state.stress (STRESS metric, positive:false).
  ScienceBrain.prototype._updateKernelPhase = function () {
    if (!Array.isArray(this._phaseSeries)) this._phaseSeries = [];
    var scalar = (this.state && typeof this.state.stress === 'number') ? this.state.stress : 0;
    this._phaseSeries.push(scalar);
    while (this._phaseSeries.length > 60) this._phaseSeries.shift();
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem('limen:phaseseries:science', JSON.stringify(this._phaseSeries));
    } catch (e) {}

    this._kernelPhase = null;
    this.state.phaseSource = 'fallback';
    try {
      if (typeof window !== 'undefined' && window.LIMENThing2 && this._phaseSeries.length >= 8) {
        var _kp = window.LIMENThing2.phaseOfSeries(this._phaseSeries, { positive: false });
        if (_kp && _kp.phase) {
          this._kernelPhase = _kp.phase;
          this.state.kernelPhase = _kp.phase;
          this.state.kernelTrajectory = _kp.trajectory;
          this.state.kernelCAccum = _kp.cAccumulator;
          this.state.phaseSource = 'thing2-kernel';
        }
      }
    } catch (e) { this._kernelPhase = null; this.state.phaseSource = 'fallback'; }
  };

  ScienceBrain.prototype._computeSciencePhaseDynamics = function () {
    var s = this.state, rm = s.researchModel || {};
    var PHASE_M = {
      p3:  { p3: 0.08, p7a: 0.05, p9: 0.04, p0: -0.06 },
      p7a: { p7a: 0.10, p3: 0.04, p9: 0.06, p0: -0.08, p4: -0.04 },
      p7:  { p7: 0.10, p3: 0.04, p9: 0.06, p0: -0.08 },
      p4:  { p4: 0.05, p5: 0.04, p0: 0.03, p3: -0.04 },
      p6:  { p6: 0.06, p0: 0.04, p3: -0.05 },
      p9:  { p9: 0.08, p7a: 0.05, p0: -0.10, p4: -0.06 },
      p10: { p10: 0.06, p0: 0.05, p6: 0.03 }
    };
    var VALIDATED = { p3: 1, p7: 1, p7a: 1, p7b: 1 };            // P3/P7 family gate for phase-consistency tier — self-consistency, NOT external reward
    var BREAKING = { p1: 1, p3: 1, p7: 1, p7a: 1, p7b: 1, p9: 1 };  // recursion-arc BREAKING family = more-distressed
    function norm(p) { if (p == null) return null; p = String(p).toLowerCase().replace(/[^a-z0-9]/g, ''); if (p.charAt(0) !== 'p') p = 'p' + p; return p; }
    // PREFER the Thing2 recursive kernel phase when available; else fall back to the existing
    // naive/static s.phase (unchanged fallback path). Drives BOTH the coherence router (A) and the
    // phase-transition reward (B) below, and — via _sciencePhaseHistory — the reward through time.
    var myPhase = norm((this._kernelPhase != null) ? this._kernelPhase : s.phase);

    // (A) COHERENCE ROUTER — couple to co-phased, stressed peers
    var doms = (typeof window !== 'undefined' && window.LIMENDomains) || {};
    var coupled = [], couplingStrength = 0;
    if (myPhase && PHASE_M[myPhase]) {
      var row = PHASE_M[myPhase];
      Object.keys(doms).forEach(function (k) {
        if (k === 'science' || k === 'research') return;
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

    // (B) PHASE-TRANSITION REWARD — did a predicted transition actually occur (through time)?
    var hist = this._sciencePhaseHistory = this._sciencePhaseHistory || [];
    var prev = hist.length ? hist[hist.length - 1].phase : null;
    var reward = null;
    if (prev != null && myPhase != null && prev !== myPhase) {
      // PREDICTION = the brain's own forward read: researchModel.predictedStress vs current stress.
      var predictedUp = (typeof rm.predictedStress === 'number' && typeof s.stress === 'number')
        ? rm.predictedStress > s.stress : false;
      var wentUp = (BREAKING[myPhase] && !BREAKING[prev]) ? true : (BREAKING[prev] && !BREAKING[myPhase]) ? false : null;
      var hit = (wentUp !== null) ? (wentUp === !!predictedUp) : null;
      var validated = !!(VALIDATED[myPhase] || VALIDATED[prev]);
      reward = { from: prev, to: myPhase, predictedUp: !!predictedUp, wentUp: wentUp, hit: hit,
        validated: validated, kind: validated ? 'self-consistency calibration (P3/P7 phase, interpretive)' : 'self-consistency calibration (advisory)' };
    }
    hist.push({ phase: myPhase, t: (rm.updated) || Date.now() });
    if (hist.length > 24) hist.shift();

    var out = {
      version: 1, myPhase: myPhase,
      coupled: coupled.slice(0, 5), couplingStrength: Math.round(couplingStrength * 1000) / 1000,
      transition: reward,
      note: 'phase-coherence router (patent M matrix) + phase-transition read (thing2 lineage). The transition hit is self-consistency calibration (interpretive), NEVER external reward; it feeds the central window.LIMENK4 credit gate -> effective learning rate.'
    };
    s.sciencePhaseDynamics = out;
    return out;
  };

  // E/I BALANCE + SELF-AUDIT ADVISORIES (observe-only; Neuro Ref XIII.1 + XIV). Mirrors
  // _computeEnergyRegulationAdvisories. (1) E/I balance: is inhibition tracking drive (from the servo)?
  // (2) Self-audit: CONSUME this domain's real graph (science.json edges) via a single-points-of-failure
  // audit (XIV: the network, not the node, is the unit of failure). Edges live in science.json, NOT in
  // the live snapshot, so lazily fetch+cache them once (fire-and-forget in the browser; require on server).
  // Deterministic, no AI, no writes.
  ScienceBrain.prototype._computeScienceRegulationAdvisories = function () {
    var s = this.state, out = { version: 1, observeOnly: true };
    // (1) E/I balance from the servo (drive vs inhibition ratio)
    try {
      var servo = s.scienceServo || null;
      if (servo) {
        var ratio = servo.drive > 0 ? Math.round((servo.inhibition / servo.drive) * 1000) / 1000 : null;
        out.eiBalance = { drive: servo.drive, inhibition: servo.inhibition, ratio: ratio, target: servo.target,
          state: servo.state, deficit: Math.max(0, Math.round((servo.target - servo.inhibition) * 1000) / 1000),
          note: 'XIII.1: inhibition must scale with drive; deficit = under-braked amount the servo is closing.' };
      } else out.eiBalance = null;
    } catch (e) { out.eiBalance = null; }
    // (2) Self-audit — consume the real science graph edges (SPOF / articulation nodes + hubs)
    try {
      var self = this;
      var edges = this._scienceEdges || (Array.isArray(s.edges) && s.edges) ||
                  (s._portalCache && Array.isArray(s._portalCache.edges) && s._portalCache.edges) || null;
      if (!edges) {
        if (typeof fetch === 'function' && !this._scienceEdgesPromise) {
          this._scienceEdgesPromise = fetch('/assets/data/domains/science.json')
            .then(function (r) { return r.json(); })
            .then(function (j) { if (j && Array.isArray(j.edges)) self._scienceEdges = j.edges; })
            .catch(function () {});
        } else if (typeof require === 'function') {
          try { var ed = require('../../data/domains/science.json'); if (ed && Array.isArray(ed.edges)) { this._scienceEdges = ed.edges; edges = ed.edges; } } catch (_e) {}
        }
      }
      if (edges && edges.length) {
        var audit = _scienceSpof(edges);
        out.selfAudit = { consumed: true, edgeCount: edges.length, spofCount: audit.articulationNodes.length,
          spof: audit.articulationNodes.slice(0, 5), topHubs: audit.topHubsByDegree, verdict: audit.verdict };
      } else {
        out.selfAudit = { consumed: false, note: 'edges loading (async, next cycle)' };
      }
    } catch (e) { out.selfAudit = { consumed: false, error: String(e && e.message || e).slice(0, 80) }; }
    s.scienceRegulation = out;
    return out;
  };

  // Compact, self-contained single-points-of-failure audit over an edge list (XIV diaschisis).
  // Mirrors limen-connectivity-audit.singlePointsOfFailure but inlined so it does not depend on
  // the energy-only module being loaded on the science console. Pure + deterministic + read-only.
  function _scienceComponentCount(nodes, edges) {
    var adj = {}; nodes.forEach(function (n) { adj[n] = []; });
    edges.forEach(function (e) { if (adj[e.source] && adj[e.target]) { adj[e.source].push(e.target); adj[e.target].push(e.source); } });
    var seen = {}, comps = 0;
    nodes.forEach(function (n) {
      if (seen[n]) return; comps++; var stack = [n];
      while (stack.length) { var x = stack.pop(); if (seen[x]) continue; seen[x] = 1; adj[x].forEach(function (y) { if (!seen[y]) stack.push(y); }); }
    });
    return comps;
  }
  function _scienceSpof(edges) {
    var nodeSet = {};
    edges.forEach(function (e) { nodeSet[e.source] = 1; nodeSet[e.target] = 1; });
    var nodes = Object.keys(nodeSet);
    var base = _scienceComponentCount(nodes, edges);
    var spof = [];
    nodes.forEach(function (n) {
      var remainingNodes = nodes.filter(function (x) { return x !== n; });
      var remainingEdges = edges.filter(function (e) { return e.source !== n && e.target !== n; });
      var c = _scienceComponentCount(remainingNodes, remainingEdges);
      if (c > base) spof.push({ node: n, componentsAfterRemoval: c, baseComponents: base });
    });
    var deg = {}; edges.forEach(function (e) { deg[e.source] = (deg[e.source] || 0) + 1; deg[e.target] = (deg[e.target] || 0) + 1; });
    var hubs = Object.keys(deg).map(function (n) { return { node: n, degree: deg[n] }; }).sort(function (a, b) { return b.degree - a.degree; }).slice(0, 5);
    return {
      baseComponents: base, articulationNodes: spof, topHubsByDegree: hubs,
      verdict: spof.length ? spof.length + ' articulation node(s) = single points of failure' : 'no articulation nodes (graph degrades gracefully)'
    };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // COST-SAFETY / "code-cannot-do-this" SLOT (NOT wired into the cycle — never runs on the 30s loop).
  // Generative node->business authoring + semantic diagnosis mapping are the only research-brain
  // slots that genuinely need an LLM. This stub is documented as a NO-OP: it must only ever be
  // invoked by an explicit operator trigger, and even then it must route through a server endpoint
  // that is killswitch-gated (server-side lib/ai-kill-switch spendDisabled()). NO API key lives in
  // client code, and this method makes NO network call itself — leaving it a stub is deliberate so
  // the deterministic cycle can never incur paid-AI spend. Wire a real operator-triggered call here
  // ONLY behind the server killswitch.
  ScienceBrain.prototype.authorNodeBusinessLLM = function () {
    return { ok: false, reason: 'operator-trigger-only; killswitch-gated server endpoint required; not wired (cost-safety)' };
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE K — SCIENCE NEURO-COMPLETION LAYERS (research-local, additive, reversible).
  // Ported 1:1 from energy-brain.js K1..K8 but reading THIS domain's state/edges:
  //   K1 afferent integration, K2 neuromodulatory gain, K3 slow consolidation,
  //   K4 outcome / credit learning (SELF-CONSISTENCY truth-brake calibration — realized-stress
  //      self-prediction / callHitRate; NEVER an external/dopaminergic reward), K5 deep-perception
  //   depth, K6 attention, K7 lateral inhibition, K8 homeostatic set-point.
  // COST-SAFE: 100% deterministic — reads CACHED state only, adds NO network/AI call, runs on the
  // 30s cycle. ADVISORY BY DESIGN: each layer COMPUTES and EXPOSES its signal on state; the real
  // effectors for this domain remain the servo + E/I brake actuation (see the ACTUATION LAYER).
  // Never rewrites stress/diagnoses/opportunity output/science.json. Never fabricates evidence.
  // ════════════════════════════════════════════════════════════════════════════
  var SK_OUTCOME_BUFFER = 40;     // rolling predicted-vs-realized samples
  var SK_HOMEO_WINDOW = 60;       // cycles of stress baseline for the adaptive set-point

  // K1 — afferent inter-brain integration. Surfaces received cross-domain pressure and the stress
  // delta it contributes. CLOSED via the base scoreStress, which folds getExternalPressure()
  // (base-capped at 0.3) into stress every cycle — same integrate-and-fire loop as the other domains.
  ScienceBrain.prototype._computeScienceAfferent = function () {
    var s = this.state, rm = s.researchModel || {};
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
      externalPressure: Math.round(pressure * 1000) / 1000,       // base-capped at 0.3
      receivedSignalCount: raw.length,
      activeSignalCount: active,
      contributors: contributors.slice(0, 6),
      integrated: true,                                           // K1 CLOSED — base scoreStress folds it into stress
      appliedStressDelta: Math.round(((s._externalPressureApplied) || 0) * 1000) / 1000,
      wouldRaiseStressBy: Math.round(pressure * 1000) / 1000,
      note: 'CLOSED: base scoreStress adds externalPressure to stress each cycle (matches the other 18 domains).',
      lastAfferentAt: rm.updated || now
    };
    s.scienceAfferent = af; return af;
  };

  // K2 — neuromodulatory gain application. reg.gain/inhibition/outputScale are produced by
  // _computeRegulation; this exposes the graded output modulation on opportunities (advisory).
  ScienceBrain.prototype._computeScienceGainControl = function () {
    var s = this.state, rm = s.researchModel || {}, reg = rm.regulation || {};
    var opps = s.opportunities || [];
    var outputScale = (typeof reg.outputScale === 'number') ? reg.outputScale : 1;
    var wouldCapAt = Math.max(1, Math.round(opps.length * outputScale));
    var gc = {
      version: 1,
      gain: (typeof reg.gain === 'number') ? reg.gain : null,
      inhibition: (typeof reg.inhibition === 'number') ? reg.inhibition : null,
      outputScale: outputScale,
      currentOpportunityCount: opps.length,
      wouldCapOpportunitiesAt: wouldCapAt,                        // gain-scaled ranked cut (advisory)
      wouldSuppress: Math.max(0, opps.length - wouldCapAt),
      appliedTargets: ['predictedStress (gain-blend, via _updateResearchModel)'],
      unappliedTargets: ['stress', 'treatment surfacing', 'opportunity output cap'],
      note: 'ADVISORY: gain reaches predictedStress via the model gain-blend; the opportunity cap is exposed but not applied (the servo + E/I brake are this domain’s live effectors).',
      lastGainAt: rm.updated || Date.now()
    };
    s.scienceGainControl = gc; return gc;
  };

  // K3 — slow consolidation / long-term plasticity. RM_SLOW_RATE was reserved for rebuild/cron;
  // this maintains a PARALLEL slow-weight track that never touches rm.prior. Fast-vs-slow
  // divergence is a real regime-shift indicator.
  ScienceBrain.prototype._consolidateScienceSlowModel = function () {
    var s = this.state, rm = s.researchModel || {}, obs = rm.observation || null;
    var slow = s.scienceSlowModel || {
      version: 1, cycle: 0,
      slow: { expectedStress: 0.5, expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, samples: 0 },
      rate: RM_SLOW_RATE, note: 'parallel slow-weight track (RM_SLOW_RATE); does NOT touch rm.prior'
    };
    if (obs) {
      var r = RM_SLOW_RATE, w = slow.slow;
      w.expectedStress = _rmClamp(w.expectedStress + r * ((obs.stress || 0) - w.expectedStress), 0, 1);
      w.expectedSignal = _rmClamp(w.expectedSignal + r * ((obs.signal || 0) - w.expectedSignal), 0, 1);
      w.expectedDiagnosisCount = w.expectedDiagnosisCount + r * ((obs.diagnosisCount || 0) - w.expectedDiagnosisCount);
      w.expectedOpportunityCount = w.expectedOpportunityCount + r * ((obs.opportunityCount || 0) - w.expectedOpportunityCount);
      w.samples += 1;
      slow.cycle += 1;
    }
    var fast = (rm.prior && typeof rm.prior.expectedStress === 'number') ? rm.prior.expectedStress : 0.5;
    slow.fastSlowDivergence = Math.round(Math.abs(fast - slow.slow.expectedStress) * 1000) / 1000;
    slow.regimeShift = slow.fastSlowDivergence > 0.25;            // fast prior pulled far from slow baseline
    slow.updated = rm.updated || Date.now();
    s.scienceSlowModel = slow; return slow;
  };

  // K4 — outcome / credit learning + TRUTH BRAKE (SELF-CONSISTENCY calibration). Compares each
  // cycle's predictedStress against the NEXT cycle's realized stress (online forward-prediction).
  // This is self-consistency ONLY — realized-stress self-prediction, callHitRate — NOT an external
  // reward and NOT a dopaminergic signal (that is a separate, deferred task).
  ScienceBrain.prototype._scoreScienceOutcomes = function () {
    var s = this.state, rm = s.researchModel || {};
    var buf = this._scienceOutcomeBuffer = this._scienceOutcomeBuffer || [];
    var obs = rm.observation || null;
    if (this._sciencePrevPrediction != null && obs && typeof obs.stress === 'number') {
      buf.push({ predicted: this._sciencePrevPrediction, realized: obs.stress, err: Math.abs(this._sciencePrevPrediction - obs.stress) });
      if (buf.length > SK_OUTCOME_BUFFER) buf.shift();
    }
    this._sciencePrevPrediction = (typeof rm.predictedStress === 'number') ? rm.predictedStress : null;   // stash for next-cycle reconciliation
    var n = buf.length, sumErr = 0, sumSq = 0, hits = 0;
    for (var i = 0; i < n; i++) { sumErr += buf[i].err; sumSq += buf[i].err * buf[i].err; if (buf[i].err <= 0.1) hits++; }
    var callHitRate = n ? Math.round((hits / n) * 100) / 100 : null;
    var om = {
      version: 1,
      samples: n,
      meanRealizedError: n ? Math.round((sumErr / n) * 1000) / 1000 : null,     // does the forecast come true
      brierLike: n ? Math.round((sumSq / n) * 1000) / 1000 : null,
      callHitRate: callHitRate,                                                  // fraction of self-predictions within 0.1 of realized
      hitRate: callHitRate,
      loopType: 'online-continuous SELF-CONSISTENCY (predicted-vs-next-realized stress); truth-brake calibration, NOT an external/dopaminergic reward',
      creditAssignmentActive: (n >= 5),
      effectiveLearningRate: (rm._effectiveLearningRate) || null,
      creditSource: (rm._creditSource) || null,
      note: 'TRUTH BRAKE (self-consistency): callHitRate measures whether the brain’s own stress forecast comes true; the P3/P7-gated phase-transition credit hook already modulates the effective learning rate in _updateResearchModel.',
      lastOutcomeAt: rm.updated || Date.now()
    };
    s.scienceOutcomeModel = om; return om;
  };

  // K5 — deep hierarchical perception. _computePredictionError hardcodes portalError=0. This
  // aggregates the depth the brain HAS (root portal + discovery/innovation sub-portal + source-bundle
  // coverage; no new fetches) and estimates the portalError the recurrent model currently zeroes out.
  ScienceBrain.prototype._computeSciencePerceptionDepth = function () {
    var s = this.state, rm = s.researchModel || {};
    var portal = s._portalCache || this._portalCache || null;
    var disc = s._discoveryPipelineCache || null;
    var bmap = this._bundleStatusMap || {};
    var bundlesFound = 0, bundlesMissing = 0;
    Object.keys(bmap).forEach(function (k) { if (bmap[k] === 'found') bundlesFound++; else bundlesMissing++; });
    var discActive = (disc && disc.loaded) ? (disc.activeCount || 0) : 0;
    var discLoaded = !!(disc && disc.loaded);
    var levels = [
      { level: 'L0', name: 'root-portal', status: portal ? 'loaded' : 'pending' },
      { level: 'B', name: 'source-bundles', status: (bundlesFound + bundlesMissing) ? 'checked' : 'pending', found: bundlesFound, missing: bundlesMissing },
      { level: 'DISC', name: 'discovery-innovation-subportal', status: discLoaded ? 'loaded' : 'absent', activeCount: discActive, note: 'real-content, unbundled; tickers relevance-unverified' }
    ];
    var loadedDepth = discLoaded ? 2 : (portal ? 1 : 0);
    var admissible = bundlesFound + (discLoaded ? discActive : 0);
    var blocked = bundlesMissing + (discLoaded ? 1 : 0);           // +1 for the unbundled discovery tier
    var portalErrorEstimate = Math.round((blocked / Math.max(1, admissible + blocked)) * 1000) / 1000;
    var pd = {
      version: 1, levels: levels, deepestUsableLevel: loadedDepth,
      portalErrorEstimate: portalErrorEstimate,                    // advisory estimate of the perception gap the model zeroes out
      note: 'ADVISORY: perception stops at the root portal + discovery sub-portal (no deep cortex); portalErrorEstimate = share of missing bundles + unbundled content. No new fetches.',
      lastDepthAt: rm.updated || Date.now()
    };
    s.sciencePerceptionDepth = pd; return pd;
  };

  // K6 — attention / selective routing. Ranks top-down salience (active + relevance + novelty)
  // and names focus vs suppressed, plus an operator attention-focus boost. Does not gate the pipeline.
  ScienceBrain.prototype._computeScienceAttention = function () {
    var s = this.state, rm = s.researchModel || {}, reg = rm.regulation || {};
    var pe = (rm.predictionError && rm.predictionError.total) || 0;
    var rb = this._readRequestBiases ? this._readRequestBiases() : { attentionFocus: [] };
    var focus = ((rb && rb.attentionFocus) || []).map(function (f) { return String(f).toLowerCase(); });
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
      note: 'ADVISORY: salience ranking over diagnoses (active + relevance + novelty + operator focus); exposed, not gated.',
      lastAttentionAt: rm.updated || Date.now()
    };
    s.scienceAttention = at; return at;
  };

  // K7 — lateral inhibition (microcircuit). reg.inhibition implies a winner-take-most ranking
  // among competing active diagnoses; this surfaces the winner + per-competitor suppression.
  ScienceBrain.prototype._computeScienceInhibition = function () {
    var s = this.state, rm = s.researchModel || {}, reg = rm.regulation || {};
    var inhib = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;
    var active = (s.diagnoses || []).filter(function (d) { return d.active; })
      .sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var winner = active[0] || null;
    var li = {
      version: 1, inhibitionStrength: inhib,
      winner: winner ? winner.id : null,
      competitors: active.slice(1).map(function (d) { return { id: d.id, relevance: d.relevance, suppressBy: Math.round((d.relevance || 0) * inhib * 1000) / 1000 }; }).slice(0, 6),
      note: 'ADVISORY: winner-take-most ranking implied by reg.inhibition; exposed, not applied.',
      lastInhibitionAt: rm.updated || Date.now()
    };
    s.scienceInhibition = li; return li;
  };

  // K8 — homeostatic set-point (microcircuit). Maintains an adaptive baseline (Turrigiano-style
  // synaptic scaling) alongside the fixed RM_STRESS_FLOOR, without replacing the fixed floor.
  ScienceBrain.prototype._computeScienceHomeostasis = function () {
    var s = this.state, rm = s.researchModel || {};
    var win = ((s.memory && s.memory.stressHistory) || []).slice(-SK_HOMEO_WINDOW);
    var n = win.length, sum = 0;
    for (var i = 0; i < n; i++) sum += (win[i].stress || 0);
    var baseline = n ? sum / n : 0.5;                             // adaptive set-point vs fixed RM_STRESS_FLOOR
    var cur = (typeof s.stress === 'number') ? s.stress : 0;
    var scalingFactor = baseline > 0 ? Math.round((0.5 / Math.max(0.1, baseline)) * 1000) / 1000 : 1;
    var hm = {
      version: 1,
      fixedFloor: RM_STRESS_FLOOR,                                // current hardcoded set-point
      adaptiveBaseline: Math.round(baseline * 1000) / 1000,
      currentStress: cur,
      deviationFromBaseline: Math.round((cur - baseline) * 1000) / 1000,
      scalingFactor: scalingFactor,                               // synaptic-scaling multiplier
      samples: n,
      note: 'ADVISORY: adaptive stress baseline (synaptic scaling) alongside the fixed RM_STRESS_FLOOR; the servo consumes deviationFromBaseline as its allostatic set-point term.',
      lastHomeostasisAt: rm.updated || Date.now()
    };
    s.scienceHomeostasis = hm; return hm;
  };

  // Aggregate the neuro-completion surface (mirrors _computeEnergyNeuroLayers). Runs K1..K8 in the
  // SAME order Energy uses, stores each on state, and attaches a compact roll-up to state.scienceNeuro.
  // Deterministic, guarded, no AI, no network. Runs BEFORE the servo/phase actuation each cycle so the
  // servo can read K8's deviation term.
  ScienceBrain.prototype._computeScienceNeuroLayers = function () {
    this._computeScienceAfferent();          // K1 - afferent inter-brain input
    this._computeScienceGainControl();       // K2 - neuromodulatory gain application
    this._consolidateScienceSlowModel();     // K3 - slow consolidation / long-term plasticity
    this._scoreScienceOutcomes();            // K4 - outcome / credit learning (self-consistency truth-brake)
    this._computeSciencePerceptionDepth();   // K5 - deep hierarchical perception
    this._computeScienceAttention();         // K6 - attention / selective routing
    this._computeScienceInhibition();        // K7 - lateral inhibition (microcircuit)
    this._computeScienceHomeostasis();       // K8 - adaptive set-point (microcircuit)
    var s = this.state;
    s.scienceNeuro = {
      version: 1,
      status: 'advisory',                    // computed + exposed; real effectors are the servo + E/I brake
      afferent: s.scienceAfferent || null,
      gainControl: s.scienceGainControl || null,
      slowModel: s.scienceSlowModel || null,
      outcomeModel: s.scienceOutcomeModel || null,
      perceptionDepth: s.sciencePerceptionDepth || null,
      attention: s.scienceAttention || null,
      inhibition: s.scienceInhibition || null,
      homeostasis: s.scienceHomeostasis || null
    };
    return s.scienceNeuro;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // F1 — RESEARCH DomainDiagnosisPacket SCHEMA (schema-only; NEVER invents data).
  // Canonical 8-section contract. domain key = 'research' (snapshot/runtime key);
  // portalContext.portalDomain = 'science' (portal/URL key).
  // ════════════════════════════════════════════════════════════════════════════
  var RDDP_SCHEMA_VERSION = 'research-ddp-1';
  function _rddpPresent(v) {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (v === 'missing' || v === '' || v === 'none') return false;
    return true;
  }
  function _rddpCompleteness(section, keys) {
    var have = 0; for (var i = 0; i < keys.length; i++) { if (_rddpPresent(section[keys[i]])) have++; }
    return { have: have, total: keys.length, pct: keys.length ? Math.round(have / keys.length * 100) : 0 };
  }

  ScienceBrain.prototype._buildDomainDiagnosisPacket = function (dx) {
    var s = this.state || {};
    var rm = s.researchModel || {};
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
    if (Array.isArray(feeds)) { feeds.forEach(function (f) { sourceFeeds.push({ name: (f && f.name) || null, updated: (f && f.updated) || null, source: (f && f.source) || null }); }); }
    else { for (var fk in feeds) { if (feeds.hasOwnProperty(fk)) { var f = feeds[fk]; sourceFeeds.push({ name: fk, updated: (f && f.updated) || null, source: (f && f.source) || null }); } } }
    if (s._primarySource && !sourceFeeds.length) sourceFeeds.push({ name: 'primary', updated: null, source: s._primarySource });

    var _canon = this._resolveCanonicalDiagnosis(dxId);
    var identity = {
      domain: 'research',
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
      researchModel: { version: rm.version || null, cycle: (typeof rm.cycle === 'number' ? rm.cycle : null) },
      predictionError: rm.predictionError || null,
      regulationState: (rm.regulation && rm.regulation.state) || null,
      prior: rm.prior || null,
      observation: rm.observation || null,
      plasticity: rm.plasticity || null,
      readyForHandoff: rm.readyForHandoff === true
    };
    var rootId = (portal && portal.domainId) || 'research';
    var rootTitle = (portal && portal.title) || 'Research';
    var ancestry = (portal && portal.parentLabel) ? [portal.parentLabel, rootTitle] : [rootTitle];
    var portalContext = {
      portalIds: [rootId],
      portalDomain: 'science',
      portalTitle: rootTitle,
      depth: 0,
      ancestryPath: ancestry,
      portalStatus: portal ? 'root-only' : 'pending',
      sourceCompleteness: portal ? ((Array.isArray(portal.issues) && portal.issues.length) ? 'partial' : 'thin') : 'root-only',
      bundleSource: (_bundle && Array.isArray(_bundle.sourcePortals) && _bundle.sourcePortals.length)
        ? { portalIds: _bundle.sourcePortals.map(function (sp) { return sp.portalId; }), depth: _bundle.maxDepth || 0, ancestryPath: (_bundle.sourcePortals[0].ancestry || []), domains: _bundle.domains || [] }
        : null,
      // research discovery/innovation sub-portal scan for this diagnosis (real tickers, relevance-unverified)
      discoveryPipeline: (s._discoveryPipelineCache && s._discoveryPipelineCache.loaded)
        ? { realCompanyTickers: (s._discoveryPipelineCache.realCompanyTickers || []), diagnoses: s._discoveryPipelineCache.diagnoses, admitted: false, reason: 'discovery/innovation sub-portal real-content but unbundled; tickers relevance-unverified; not admitted to evidenceAnchors' }
        : null
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
    var _intakeSrcHint = {
      REPLICATION_CRISIS: 'OpenAlex / PubMed / Retraction Watch / Reproducibility Project data / peer-reviewed literature',
      FUNDING_COLLAPSE: 'NSF Awards / NIH RePORTER / Federal Register appropriations / AAAS R&D budget data',
      DATA_FRAUD: 'Retraction Watch / Office of Research Integrity (ORI) / openFDA / journal corrections',
      PARADIGM_CONFLICT: 'arXiv / Nature / Science / OpenAlex citation networks / preprint servers',
      BRAIN_DRAIN: 'NSF SESTAT / NCSES survey data / institutional workforce reports / Nature Careers',
      PUBLICATION_BIAS: 'ClinicalTrials.gov / OpenAlex / preprint registries / journal open-access policy data'
    };
    var authoringIntake = [];
    if (_isExternal) {
      ['methodCandidates', 'embodimentCandidates', 'figurePlaceholders'].forEach(function (field) {
        if (_bArr(field).length === 0) authoringIntake.push({ field: field, status: 'needs-human-input', count: 0, need: field === 'methodCandidates' ? 'a concrete technical method drawn from a primary source' : field === 'embodimentCandidates' ? 'a specific implementation/embodiment from a real document' : 'a figure description grounded in a real source', sourceHint: _intakeSrcHint[identity.canonicalDiagnosisId] || 'primary institutional / peer-reviewed source', note: 'NOT fabricated by the brain — author from the cited source, then wire in verbatim with attribution' });
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
    var artifactContext = {
      artifactLanes: artifactLanes,
      patentReady: false, grantReady: false, sbaReady: false,
      investmentReady: !!(hasTreat && primaryOpp), researchReady: ready || hasTreat,
      readinessReasons: readinessReasons,
      blockers: blockers
    };

    var comp = {
      identity:         _rddpCompleteness(identity, ['domain', 'diagnosisId', 'canonicalDiagnosisId', 'label', 'phase', 'confidence']),
      brainState:       _rddpCompleteness(brainState, ['researchModel', 'predictionError', 'regulationState', 'prior', 'observation', 'plasticity']),
      portalContext:    _rddpCompleteness(portalContext, ['portalIds', 'portalDomain', 'portalTitle', 'depth', 'ancestryPath']),
      evidence:         _rddpCompleteness(evidence, ['sourceFeeds', 'evidenceAnchors', 'citationHints']),
      treatmentContext: _rddpCompleteness(treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']),
      operatorContext:  _rddpCompleteness(operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']),
      artifactContext:  _rddpCompleteness(artifactContext, ['artifactLanes'])
    };
    var totHave = 0, totAll = 0;
    for (var ck in comp) { if (comp.hasOwnProperty(ck)) { totHave += comp[ck].have; totAll += comp[ck].total; } }
    var missingFields = [];
    function _cm(name, obj, keys) { for (var i = 0; i < keys.length; i++) { if (!_rddpPresent(obj[keys[i]])) missingFields.push(name + '.' + keys[i]); } }
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
    if (!primaryOpp && (typeof s.stress !== 'number' || s.stress < RM_STRESS_FLOOR)) warnings.push('no active opportunity (offline/low-stress) — operator/lane fields stay empty');
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
        'diagnosis-specific bundle anchors preferred over generic research evidence',
        'official/primary sources retained (NSF/NIH/arXiv/Nature/OpenAlex/NASA/PubMed where present)',
        'mechanisms prioritized over figures under prompt-space limits',
        'treatments with implementation relevance preferred over broad narrative',
        'caps applied per field; full data preserved in the stored bundle + full DDP'
      ],
      retainedWarnings: warnings
        .concat(s.researchImmune ? ['immune: ' + s.researchImmune.immuneState + ' (sev ' + s.researchImmune.severity + ', ' + (s.researchImmune.antigens || []).length + ' antigens)'] : [])
        .concat(s.researchConscience && s.researchConscience.conscienceState === 'restrictive' ? ['conscience: ' + (s.researchConscience.blockedClaims || []).slice(0, 3).join(', ') + ' blocked'] : []),
      retainedBlockers: artifactContext.blockers,
      immuneSummary: s.researchImmune ? { immuneState: s.researchImmune.immuneState, severity: s.researchImmune.severity, antigenCount: (s.researchImmune.antigens || []).length, quarantines: s.researchImmune.quarantines, blockedFromTraversal: s.researchImmune.blockedFromTraversal, allowedWithWarning: s.researchImmune.allowedWithWarning } : null,
      awarenessSummary: s.researchAwareness ? { selfNarrative: s.researchAwareness.selfNarrative, knowns: (s.researchAwareness.knowns || []).length, unknowns: (s.researchAwareness.unknowns || []).length, humanReviewRequired: s.researchAwareness.humanReviewRequired } : null,
      conscienceDecision: s.researchConscience ? { conscienceState: s.researchConscience.conscienceState, blockedClaims: s.researchConscience.blockedClaims, artifactReadinessDecision: s.researchConscience.artifactReadinessDecision } : null,
      intuitionSummary: s.researchIntuition ? s.researchIntuition.hunches : null,
      scenarioSummary: s.researchSimulation ? (s.researchSimulation.scenarios || []).map(function (x) { return { type: x.type, hypothetical: x.hypothetical, risk: x.risk }; }) : null,
      executiveReport: s.researchExecutiveReport || null,
      authoringIntake: treatmentContext.authoringIntake.length ? treatmentContext.authoringIntake : null,
      discoveryPipelineSummary: (s._discoveryPipelineCache && s._discoveryPipelineCache.loaded) ? { count: s._discoveryPipelineCache.count, activeCount: s._discoveryPipelineCache.activeCount, realCompanyTickers: (s._discoveryPipelineCache.realCompanyTickers || []).length, diagnoses: s._discoveryPipelineCache.diagnoses, note: s._discoveryPipelineCache.note } : null
    };

    return {
      schemaVersion: RDDP_SCHEMA_VERSION,
      promptView: promptView,
      identity: identity,
      brainState: brainState,
      portalContext: portalContext,
      evidence: evidence,
      treatmentContext: treatmentContext,
      operatorContext: operatorContext,
      artifactContext: artifactContext,
      audit: {
        generatedAt: (rm.updated || null),
        schemaVersion: RDDP_SCHEMA_VERSION,
        fieldCompleteness: { sections: comp, overallPct: pct },
        missingFields: missingFields,
        warnings: warnings,
        proofTier: proofTier,
        immune: s.researchImmune || null,
        awareness: s.researchAwareness || null,
        conscience: s.researchConscience || null,
        intuition: s.researchIntuition || null,
        simulation: s.researchSimulation || null,
        executiveReport: s.researchExecutiveReport || null
      }
    };
  };

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
