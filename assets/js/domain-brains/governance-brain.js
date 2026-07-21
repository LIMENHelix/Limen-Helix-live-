/**
 * governance-brain.js — Governance Domain Cognitive Engine
 *
 * Portal issues: CONSTITUTIONAL_CRISIS, REGIME_INSTABILITY, POLICY_FAILURE,
 *   CORRUPTION_SCANDAL, DIPLOMATIC_BREAKDOWN, MILITARY_OVERREACH
 *
 * Emissions: law, economy, supplyChain, finance
 * Exposes: window.LIMENGovernanceBrain
 */
(function () {
  'use strict';
  if (!window.LIMENDomainBrainBase) { console.warn('[GovernanceBrain] DomainBrainBase not loaded'); return; }
  var Base = window.LIMENDomainBrainBase;

  function GovernanceBrain() {
    Base.call(this, { domainId: 'governance', label: 'Governance', snapshotKey: 'governance', cycleInterval: 30000 });
  }
  GovernanceBrain.prototype = Object.create(Base.prototype);
  GovernanceBrain.prototype.constructor = GovernanceBrain;

  GovernanceBrain.prototype.init = function () {
    Base.prototype.init.call(this);

    // ── THING2 RECURSIVE-PHASE KERNEL as the phase source (2026-07-13, operator-approved) ──
    // The phase-coherence router and phase-transition read previously read s.phase (a naive
    // per-cycle guess / static PHASE_M lineage). We now feed those from the REAL Thing2 kernel
    // (assets/js/limen-thing2-adapter.js -> window.LIMENThing2.phaseOfSeries), which runs the
    // validated financial phase pipeline over THIS domain's own stress trajectory. The kernel is
    // PURE MATH (no network, no AI) so the 30s cycle stays deterministic. Output is INTERPRETIVE
    // posture only (interpretive:true, validated:false); we never surface it as validated, and it
    // stays advisory here (governance is fenced OUT of the validated kernel — Finance+Population only).
    // Fallback: if the adapter is absent or history < 8, _kernelPhase stays null and s.phase is used.
    this._kernelPhase = null;
    this._phaseSeries = [];
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        var _ps = JSON.parse(localStorage.getItem('limen:phaseseries:governance'));
        if (Array.isArray(_ps)) this._phaseSeries = _ps;
      }
    } catch (e) { this._phaseSeries = this._phaseSeries || []; }

    this.diagnosisIndex = {
      'CONSTITUTIONAL_CRISIS':  ['legislative_stalemate', 'constitutional_stress', 'governance_credibility_shock', 'governance_high_stress', 'structural_stress'],
      'REGIME_INSTABILITY':     ['leadership_instability', 'trust_erosion', 'confidence_collapse', 'governance_high_stress', 'macro_shock'],
      'POLICY_FAILURE':         ['contradictory_directives', 'fragmented_agency', 'inconsistent_execution', 'cross_branch_incoherence', 'policy_conflict'],
      'CORRUPTION_SCANDAL':     ['corruption_detected', 'oversight_breakdown', 'accountability_failure', 'governance_high_stress'],
      'DIPLOMATIC_BREAKDOWN':   ['diplomatic_failure', 'alliance_strain', 'treaty_risk', 'sovereignty_dispute', 'macro_shock'],
      'MILITARY_OVERREACH':     ['military_expansion', 'civil_military_tension', 'defense_overcommit', 'governance_high_stress']
    };
    this.emissionRules = [
      { targetDomain: 'law', signalType: 'policy_conflict_enforcement', condition: function (s) { return s.stress >= 0.25; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.55); } },
      { targetDomain: 'economy', signalType: 'institutional_confidence_drag', condition: function (s) { return s.stress >= 0.25; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); } },
      { targetDomain: 'supplyChain', signalType: 'administrative_friction', condition: function (s) { return s.stress >= 0.30; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); } },
      { targetDomain: 'finance', signalType: 'policy_uncertainty_premium', condition: function (s) { return s.stress >= 0.25; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); } }
    ];

    // ── ACTUATION GATE (2026-07-13) — ported from Energy, HONESTLY gated per the neurology audit.
    // The rule (DOMAIN_BUILDOUT_PLAYBOOK.md §E-3): an actuation is valid ONLY where the domain has a
    // real controllable EFFECTOR (servo/eiBrake) and, for the phase REWARD, a Thing1-VALIDATED P3/P7
    // signal. Per-slot verdict for GOVERNANCE:
    //   refractory : TRUE  — governance emits real action drafts (_checkDiagnosisActions ->
    //                        LIMENActionAdapters.createDraft: 'Governance Alert: ...'). Rate-limiting
    //                        duplicate alerts of the same diagnosis is a genuine effector on emission.
    //                        Inline limiter (no external module), deterministic (Neuro Ref III.3).
    //   servo      : TRUE  — effector = the brain's OWN emission (opportunity-confidence dampening + the
    //                        E/I brake). Same effector Energy regulates; it controls OUTPUT, not the real
    //                        world (does NOT claim to steer legislation/rulemaking). Neuro Ref V.2/XII.
    //   eiBrake    : TRUE  — depends on servo; proportional emission-confidence dampening. Neuro Ref XIII.1.
    //   phase      : FALSE — ADVISORY ONLY. Governance's phase is authored/snapshot (governance.json = P7),
    //                        NOT a Thing1-validated LIVE P3/P7 signal (the validated kernel is FENCED to
    //                        Finance + Population per kernel-watchlist-scoping). A realized phase transition
    //                        is therefore never ground-truth reward here; _computeGovernancePhaseDynamics
    //                        runs observe-only and drives no credit/learning/emission gating. Do NOT flip
    //                        true without validation.
    //   selfAudit  : TRUE  — governance.json carries a real 85-edge / 40-node graph, so the SPOF/diaschisis
    //                        self-audit (Neuro Ref XIV) runs on the true graph (observe-only). Degrades safe
    //                        (reports consumed:false rather than fabricating if the shared audit module is
    //                        absent). Fully reversible.
    // All actuations affect ONLY emission (the same channel the generic brake uses); never stress/scoring/
    // diagnoses/governance.json. 100% deterministic on the 30s cycle — NO paid-AI/fetch-to-LLM ever runs here.
    this._actuation = { refractory: true, servo: true, eiBrake: true, phase: false, selfAudit: true };
    this._refractoryParams = {
      absoluteWindow: 900000,     // 15 min hard dead-time (operator-set; not in the document)
      relativeWindow: 3600000,    // 1 hr raised-bar window (1:4 ratio, mirrors Energy)
      overrideThreshold: 0.9      // reduced sensitivity: only stress >= 0.9 re-fires within the window
    };

    // ── COGNITION PARITY bootstrap loaders (one-shot, offline-safe) ──
    try { this._loadGovernanceOperators(); } catch (e) {}                       // real govtech / public-sector entities (state.companies starved)
    try { this._loadGovernanceBrainSignals(); } catch (e) {}                    // distress ONLY from the validated Thing pipeline
    try { this._loadGovernanceDiagnosisBundles(); } catch (e) {}                // load real artifact-source bundles (only ones that exist)
    try { this._loadGovernanceL1PortalDepth(); } catch (e) {}                   // scan L1 branches (treatments mad-lib -> NOT admitted; real entities only)
    try { this._loadGovernanceInstitutionalIntegritySublayer(); } catch (e) {} // institutional-integrity sub-portal (real-content, unbundled) as an additive LAYER
  };

  GovernanceBrain.prototype.normalizeSignals = function () {
    var signals = [];
    var rawSignals = (this._rawDomain && this._rawDomain.signals) || [];
    for (var i = 0; i < rawSignals.length; i++) signals.push(rawSignals[i]);
    this._activeConditions = [];

    // Long-arc baseline — persistent institutional / oversight pressure
    this._activeConditions.push('policy_conflict');
    signals.push('BASELINE: Persistent institutional coordination and oversight pressure');

    var feeds = this.state.feeds;
    for (var fi = 0; fi < feeds.length; fi++) {
      var f = feeds[fi];
      var fn = (f.name || '').toLowerCase();

      // ── INSTITUTIONALLY STRONG SOURCES (can independently raise high-stress) ──
      if ((fn.indexOf('world bank governance') !== -1 || fn.indexOf('worldbank') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('trust_erosion');
        if (f.value >= 50) this._activeConditions.push('governance_high_stress');
        signals.push('FEED [WORLD BANK]: Governance indicators \u2014 ' + (f.label || f.value));
      }
      if ((fn.indexOf('govtrack') !== -1 || fn.indexOf('congress.gov') !== -1 || fn.indexOf('congress ') !== -1 || fn.indexOf('legislat') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('legislative_stalemate');
        if (f.value >= 30) { this._activeConditions.push('contradictory_directives'); this._activeConditions.push('policy_conflict'); }
        if (f.value >= 75) this._activeConditions.push('governance_high_stress');
        signals.push('FEED [CONGRESS]: Legislative activity \u2014 ' + (f.label || f.value));
      }
      if ((fn.indexOf('gao') !== -1 || fn.indexOf('government accountability') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('oversight_breakdown');
        this._activeConditions.push('accountability_failure');
        if (f.value >= 10) this._activeConditions.push('corruption_detected');
        if (f.value >= 25) this._activeConditions.push('governance_high_stress');
        signals.push('FEED [GAO]: Oversight findings \u2014 ' + (f.label || f.value));
      }
      if ((fn.indexOf('cbo') !== -1 || fn.indexOf('congressional budget') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('inconsistent_execution');
        if (f.value >= 10) this._activeConditions.push('fragmented_agency');
        signals.push('FEED [CBO]: Fiscal projections \u2014 ' + (f.label || f.value));
      }
      if ((fn.indexOf('omb') !== -1 || fn.indexOf('management and budget') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('inconsistent_execution');
        if (f.value >= 10) this._activeConditions.push('contradictory_directives');
        signals.push('FEED [OMB]: Executive budget activity \u2014 ' + (f.label || f.value));
      }
      if ((fn.indexOf('federal register') !== -1 || fn.indexOf('regulations.gov') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('contradictory_directives');
        if (f.value >= 50) { this._activeConditions.push('fragmented_agency'); this._activeConditions.push('policy_conflict'); }
        signals.push('FEED [FEDERAL REGISTER]: Regulatory activity \u2014 ' + (f.label || f.value));
      }
      if ((fn.indexOf('brennan center') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('trust_erosion');
        if (f.value >= 5) this._activeConditions.push('constitutional_stress');
        signals.push('FEED [BRENNAN]: Election / civil liberties \u2014 ' + (f.label || f.value));
      }
      if ((fn.indexOf('pogo') !== -1 || fn.indexOf('project on government oversight') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('corruption_detected');
        this._activeConditions.push('oversight_breakdown');
        if (f.value >= 5) this._activeConditions.push('accountability_failure');
        signals.push('FEED [POGO]: Government oversight \u2014 ' + (f.label || f.value));
      }
      if ((fn.indexOf('rss governance') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('trust_erosion');
        if (f.value >= 10) this._activeConditions.push('governance_credibility_shock');
        signals.push('FEED [RSS GOV]: Governance news \u2014 ' + (f.label || f.value));
      }

      // Generic approval/trust feeds
      if ((fn.indexOf('approval') !== -1 || fn.indexOf('trust') !== -1 || fn.indexOf('confidence') !== -1) && f.value !== undefined && f.value < 35) {
        this._activeConditions.push('trust_erosion');
        this._activeConditions.push('confidence_collapse');
        signals.push('ALERT: Public confidence below 35% \u2014 legitimacy strain');
      }

      // ── PARTISAN PERSPECTIVE FEEDS ──
      // Positional signal only — what one side of the spectrum WANTS the public to hear,
      // NOT confirmation of fact. These feeds raise only LOW-WEIGHT directional conditions
      // and never the high-stress flags (governance_high_stress, structural_stress,
      // governance_credibility_shock). High-stress diagnoses must still be corroborated
      // by institutionally stronger sources (GAO, CBO, IGs, mainstream press, World Bank).
      if ((fn.indexOf('mother jones') !== -1 || fn.indexOf('huffpost') !== -1 || fn.indexOf('the nation') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('trust_erosion');
        signals.push('PARTISAN [LEFT]: ' + (f.name || '') + ' \u2014 ' + (f.label || f.value) + ' (positional only)');
      }
      if ((fn.indexOf('breitbart') !== -1 || fn.indexOf('washington times') !== -1 || fn.indexOf('national review') !== -1 || fn.indexOf('daily caller') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('trust_erosion');
        signals.push('PARTISAN [RIGHT]: ' + (f.name || '') + ' \u2014 ' + (f.label || f.value) + ' (positional only)');
      }

      // \u2500\u2500 INSTITUTIONAL FEED-DERIVED CONDITIONS (Fed Reg EOP / CISA KEV) \u2500\u2500
      // Distinct collection methodologies \u2014 Federal Register doc-count + curated CVE list.

      // Fed Reg EOP \u2014 Executive Office of the President regulatory volume
      // \u2192 POLICY_FAILURE (contradictory_directives, fragmented_agency)
      if (fn.indexOf('fed reg eop') !== -1 && f.value !== undefined && f.value >= 3) {
        this._activeConditions.push('contradictory_directives');
        signals.push('Fed Reg EOP: ' + f.value + ' executive office regulatory docs (30d)');
      }
      if (fn.indexOf('fed reg eop') !== -1 && f.value !== undefined && f.value >= 6) {
        this._activeConditions.push('inconsistent_execution');
        this._activeConditions.push('cross_branch_incoherence');
      }
      if (fn.indexOf('fed reg eop') !== -1 && f.value !== undefined && f.value >= 10) {
        this._activeConditions.push('governance_credibility_shock');
      }

      // CISA KEV \u2014 newly-exploited CVEs \u2192 CONSTITUTIONAL_CRISIS (election/gov system integrity)
      if (fn.indexOf('cisa kev') !== -1 && f.value !== undefined && f.value >= 10) {
        this._activeConditions.push('governance_credibility_shock');
        signals.push('CISA KEV: ' + f.value + ' newly-exploited CVEs (30d) \u2014 government cyber integrity');
      }
      if (fn.indexOf('cisa kev') !== -1 && f.value !== undefined && f.value >= 25) {
        this._activeConditions.push('constitutional_stress');
      }
    }

    for (var rsi = 0; rsi < rawSignals.length; rsi++) {
      var rs = (typeof rawSignals[rsi] === 'string' ? rawSignals[rsi] : '').toLowerCase();
      if (rs.indexOf('shutdown') !== -1 || rs.indexOf('gridlock') !== -1 || rs.indexOf('deadlock') !== -1 || rs.indexOf('stalemate') !== -1) {
        if (this._activeConditions.indexOf('legislative_stalemate') === -1) this._activeConditions.push('legislative_stalemate');
      }
      if (rs.indexOf('corruption') !== -1 || rs.indexOf('scandal') !== -1 || rs.indexOf('investigation') !== -1) {
        if (this._activeConditions.indexOf('corruption_detected') === -1) this._activeConditions.push('corruption_detected');
      }
      if (rs.indexOf('diplomat') !== -1 || rs.indexOf('alliance') !== -1 || rs.indexOf('treaty') !== -1) {
        if (this._activeConditions.indexOf('diplomatic_failure') === -1) this._activeConditions.push('diplomatic_failure');
      }
      if (rs.indexOf('military') !== -1 && (rs.indexOf('deploy') !== -1 || rs.indexOf('escala') !== -1 || rs.indexOf('expand') !== -1)) {
        if (this._activeConditions.indexOf('military_expansion') === -1) this._activeConditions.push('military_expansion');
      }
    }

    var snap = this._getSnapshot();
    if (snap && snap.defenseSignals) {
      for (var si = 0; si < snap.defenseSignals.length; si++) {
        var sig = snap.defenseSignals[si];
        if (sig.affectedDomains && sig.affectedDomains.indexOf('governance') !== -1) {
          this._activeConditions.push(sig.eventType);
        }
      }
    }
    if (snap && snap.macroShock && snap.macroShock.detected) this._activeConditions.push('macro_shock');

    if (this.state.stress >= 0.35) { this._activeConditions.push('trust_erosion'); this._activeConditions.push('policy_conflict'); }
    if (this.state.stress >= 0.50) { this._activeConditions.push('fragmented_agency'); this._activeConditions.push('inconsistent_execution'); }
    if (this.state.stress >= 0.60) this._activeConditions.push('governance_high_stress');
    if (this.state.maturity === 'STRUCTURAL') this._activeConditions.push('structural_stress');

    var extPressure = this.getExternalPressure ? this.getExternalPressure() : 0;
    if (extPressure >= 0.10) this._activeConditions.push('cross_branch_incoherence');

    this.state.signals = signals;
    return Promise.resolve();
  };

  GovernanceBrain.prototype.deriveDiagnoses = function () {
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
          window.DomainTelemetryAdapter.fromLiveCached("governance", self.state, self._runtimeOverlay || null)
            .then(function (ov) { if (ov) self._runtimeOverlay = ov; }).catch(function () {});
        }
      } catch (_e) {}
    });
  };

  GovernanceBrain.prototype.recommendTreatments = function () {
    var self = this;
    return this._getPortalContent().then(function (portal) {
      if (!portal) return;
      var activeDx = self.state.diagnoses.filter(function (d) { return d.active; });
      if (activeDx.length === 0) { self.state.treatments = []; return; }
      var activeNodeIds = {};
      for (var di = 0; di < activeDx.length; di++) { var circuits = activeDx[di].circuits || []; for (var ci = 0; ci < circuits.length; ci++) activeNodeIds[circuits[ci].nodeId] = activeDx[di].id; }
      var treatments = [], activations = portal.activations || [];
      for (var ai = 0; ai < activations.length; ai++) { var act = activations[ai]; if (!activeNodeIds[act.brainNodeId]) continue; var actTreats = act.treatments || []; for (var ti = 0; ti < actTreats.length; ti++) { var t = actTreats[ti]; treatments.push({ id: 'treat_' + act.brainNodeId + '_' + ti, label: t.label, type: t.type, evidence: t.evidence, description: t.description || '', diagnosisId: activeNodeIds[act.brainNodeId], nodeId: act.brainNodeId, relevance: 1.0, source: 'canonical' }); } }
      var evidenceRank = { A: 10, 'Strong': 10, B: 7, 'Moderate': 7, C: 4, 'Emerging': 1 };
      treatments.sort(function (a, b) { return (evidenceRank[b.evidence] || 0) - (evidenceRank[a.evidence] || 0); });
      self.state.treatments = treatments;
    });
  };

  GovernanceBrain.prototype.surfaceOpportunities = function () {
    Base.prototype.surfaceOpportunities.call(this);
    var opps = [], stress = this.state.stress, activeDx = this.state.diagnoses.filter(function (d) { return d.active; }), allDx = this.state.diagnoses || [], companies = this.state.companies, seen = {};
    function add(o) { var key = o.title.toLowerCase().replace(/[^a-z0-9]/g, ''); if (seen[key]) return; seen[key] = true; opps.push(o); }

    for (var di = 0; di < activeDx.length; di++) {
      var dx = activeDx[di], dxLabel = (dx.label || dx.id || '').replace(/_/g, ' ');
      add({ title: dxLabel + ' — administrative workflow modernization', rank: stress * dx.relevance, path: 'RESEARCHABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.50) add({ title: dxLabel + ' — institutional bottleneck mitigation platform', rank: stress * dx.relevance * 0.9, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.55 && dx.relevance >= 0.2) add({ title: dxLabel + ' — transparency and records system', rank: stress * 0.85, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      add({ title: dxLabel + ' — policy harmonization and coordination tool', rank: stress * dx.relevance * 0.75, path: 'RESEARCHABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
    }

    var terminalCompanies = [] /* neutralized: distress only from validated gate (see energy-brain) */;
    if (terminalCompanies.length > 0) add({ title: 'Governance terminal entity distressed positioning', rank: 0.95, path: 'INVESTABLE', urgency: 'high', source: 'company_terminal', tier: 1, companies: terminalCompanies.map(function (c) { return c.ticker; }), stress: stress });
    if (this.state.convergence && this.state.convergence.primary_signal) add({ title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — governance convergence response', rank: 0.98, path: 'INVESTABLE', urgency: 'high', source: 'convergence', tier: 1, stress: stress });

    var emissions = this.state.crossDomainEmissions || [];
    for (var ei = 0; ei < emissions.length; ei++) { var em = emissions[ei]; add({ title: 'Governance \u2192 ' + (em.targetDomain || '').replace(/_/g, ' ') + ' — ' + (em.signal || em.signalType || '').replace(/_/g, ' '), rank: (em.magnitude || 0.5) * stress * 0.8, path: 'INVESTABLE', urgency: em.magnitude > 0.6 ? 'high' : 'medium', source: 'cross_domain', tier: 2, stress: stress }); }

    if (stress >= 0.50) { add({ title: 'Public-sector coordination and execution platform', rank: stress * 0.65, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, stress: stress }); add({ title: 'Governance stabilization — trust infrastructure', rank: stress * 0.70, path: 'RESEARCHABLE', urgency: 'medium', source: 'lagging', tier: 3, stress: stress }); }
    if (stress >= 0.60) { add({ title: 'Procedural efficiency — administrative process automation', rank: stress * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, stress: stress }); add({ title: 'Policy navigation — multi-agency compliance mapping', rank: stress * 0.68, path: 'RESEARCHABLE', urgency: 'medium', source: 'lagging', tier: 3, stress: stress }); }

    var nearDx = allDx.filter(function (d) { return !d.active && d.relevance > 0 && d.totalTriggers > 0; });
    for (var ndi = 0; ndi < nearDx.length; ndi++) { if (stress >= 0.45) add({ title: (nearDx[ndi].label || '').replace(/_/g, ' ') + ' — early-stage monitoring', rank: stress * (nearDx[ndi].relevance || 0.1) * 0.5, path: 'RESEARCHABLE', urgency: 'watching', source: 'near_diagnosis', tier: 2, stress: stress, nearDiagnosisId: nearDx[ndi].id }); }

    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });
    // Canonical enrichment — merge governance playbook detail per opportunity
    var PB_LIST = window.LIMENGovernanceOpportunityPlaybooks || [];
    var _byId = {};
    for (var _pbi = 0; _pbi < PB_LIST.length; _pbi++) _byId[PB_LIST[_pbi].id] = PB_LIST[_pbi];
    var _PB_MAP = {
      'CONSTITUTIONAL_CRISIS': 'constitutional_crisis',
      'REGIME_INSTABILITY': 'regime_instability',
      'POLICY_FAILURE': 'policy_failure',
      'CORRUPTION_SCANDAL': 'corruption_scandal',
      'DIPLOMATIC_BREAKDOWN': 'diplomatic_breakdown',
      'MILITARY_OVERREACH': 'military_overreach'
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
    // Lanes: investment + research ONLY (patent/grant/loan purged 2026-06-21; relaned GRANT->INVESTABLE, PATENT->RESEARCHABLE)
    var _COMP = {
      'INVESTABLE':   { type: 'invest',   base: 5, unit: 'profit%', tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
      'RESEARCHABLE': { type: 'research', base: 5, unit: 'credit%', tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 published research briefs' },     maxTier: { tier: 3, comp: 15 } }
    };
    for (var oi = 0; oi < opps.length; oi++) {
      var o = opps[oi];
      o.id = (o.diagnosisId || o.nearDiagnosisId || o.source || 'opp').replace(/[^a-zA-Z0-9]/g, '_') + '_' + (o.path || '').toLowerCase().replace(/[^a-z]/g, '') + '_t' + (o.tier || 0);
      o.domain = 'governance';
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
        var evidenceParts = ['Domain: governance', 'Stress: ' + stressPct + '%'];
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

  GovernanceBrain.prototype._checkDiagnosisActions = function () {
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; });
    if (activeDx.length === 0) return;
    var adapters = window.LIMENActionAdapters; if (!adapters) return;
    var _refractoryOn = !!(this._actuation && this._actuation.refractory);
    var _now = (this.state.pulse && this.state.pulse.timestamp) || (this._runtimeOverlay && this._runtimeOverlay.timestamp) || Date.now();
    var _stress = this.state.stress || 0;
    for (var i = 0; i < activeDx.length; i++) {
      var dx = activeDx[i];
      if (adapters.getDrafts && adapters.getDrafts({ domain: 'governance', intentId: dx.id }).length > 0) continue;
      // REFRACTORY GATE (actuated, Neuro Ref III.3): suppress re-emission of the same diagnosis's action
      // draft within the dead-time unless stress clears the reduced-sensitivity override bar. The diagnosis
      // stays active/displayed; only the duplicate DRAFT is withheld. Reversible via _actuation.refractory=false.
      if (_refractoryOn) {
        try { var _v = this._governanceRefractoryFire(dx.id, _now, _stress); if (!_v.allowed) { this.state._refractorySuppressed = (this.state._refractorySuppressed || 0) + 1; continue; } } catch (_e) {}
      }
      adapters.createDraft('REPORT_GENERATION', { domain: 'governance', sourceType: 'domain_brain', sourceId: dx.id, intentId: dx.id, title: 'Governance Alert: ' + dx.label,
        intent: { domain: 'governance', title: dx.label, status: 'ACTIVE', priority: this.state.stress, progress: 0, strategyType: 'diagnosis_response', steps: [{ type: 'ANALYZE', label: 'Assess ' + dx.label + ' institutional impact', status: 'PENDING' }, { type: 'INVESTIGATE', label: 'Identify affected agencies and policy areas', status: 'PENDING' }, { type: 'POSITION', label: 'Evaluate governance modernization opportunities', status: 'PENDING' }] }
      });
    }
  };

  GovernanceBrain.prototype.resolveDeepContent = function () {
    var self = this; var resolver = window.LIMENPortalContentResolver; if (!resolver) return Promise.resolve();
    return resolver.resolveForBrain(this.state).then(function (content) {
      self.state.resolvedContent = content;
      if (content) { var deepTreats = []; for (var dxId in content.byDiagnosis) { var dxC = content.byDiagnosis[dxId]; for (var i = 0; i < dxC.treatments.length; i++) { var t = dxC.treatments[i]; deepTreats.push({ id: 'deep_' + t.nodeId + '_' + i, label: t.label, type: t.type, evidence: t.evidence, description: t.description, cite: t.cite, steps: t.steps, monitoring: t.monitoring, escalation: t.escalation, diagnosisId: dxId, nodeId: t.nodeId, nodeLabel: t.nodeLabel, hasDepth: t.hasDepth, source: 'canonical_deep' }); } } if (deepTreats.length > 0) self.state.treatments = deepTreats; }
    }).catch(function () {});
  };

  var _origCycle = GovernanceBrain.prototype.cycle;
  GovernanceBrain.prototype.cycle = function () {
    var self = this;
    return _origCycle.call(this).then(function () {
      return self.resolveDeepContent();
    }).then(function () {
      // Higher cognition: predictive self-model + metacognition (runs AFTER diagnoses settle)
      try { self._updateGovernanceModel(); } catch (e) {}
    });
  };

  // ══════════════════════════════════════════════════════════════════════
  // HIGHER COGNITION — predictive self-model + metacognition (governance).
  // Generic predictive-coding substrate (prior → observe → prediction error →
  // regulation → update prior) + awareness / conscience / immune / intuition /
  // simulation / executive-report, an institutional-integrity sub-portal LAYER,
  // and the 8-section DomainDiagnosisPacket the console SELF-MODEL panel consumes.
  // Mirrors culture/energy STRUCTURE exactly; only the CONTENT is governance
  // (institutions & indicators, public policy & rulemaking, regulation & oversight,
  // elections & democratic institutions, public finance, rule of law & integrity,
  // public-service delivery, political stability & legitimacy). Distinct from
  // economy (macro), finance (capital), law (judicial), and intelligence.
  // Never fabricates evidence. Real govtech/index identifiers only.
  // ══════════════════════════════════════════════════════════════════════
  var GM_VERSION = 1;
  var GM_LEARNING_RATE = 0.25;
  var GM_SLOW_RATE = 0.08;
  var GM_STRESS_FLOOR = 0.30;
  var GM_FLOOD_CAP = 12;
  var GM_STALE_MS = 1000 * 60 * 60 * 6;
  var _gmClamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  var _gmJaccardDistance = function (a, b) {
    a = a || []; b = b || [];
    if (!a.length && !b.length) return 0;
    var sa = {}, inter = 0;
    a.forEach(function (x) { sa[x] = 1; });
    b.forEach(function (x) { if (sa[x]) inter++; });
    var uni = a.length + b.length - inter;
    return uni ? 1 - inter / uni : 0;
  };

  (function () {
    var P = GovernanceBrain.prototype;

    // Governance diagnosis families — an analogy lens for monitoring, NOT evidence.
    var FAMILY = {
      'institutional-failure': ['CONSTITUTIONAL_CRISIS', 'POLICY_FAILURE'],
      'legitimacy-erosion': ['REGIME_INSTABILITY', 'CORRUPTION_SCANDAL'],
      'integrity-breach': ['CORRUPTION_SCANDAL', 'POLICY_FAILURE'],
      'external-rupture': ['DIPLOMATIC_BREAKDOWN', 'MILITARY_OVERREACH'],
      'order-vs-stability': ['CONSTITUTIONAL_CRISIS', 'REGIME_INSTABILITY']
    };

    P._neutralGovernanceModel = function () {
      return { version: GM_VERSION, cycle: 0, prior: { expectedStress: 0.5, expectedDiagnoses: [], expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, confidence: 0, samples: 0 }, observation: null, predictionError: null, predictedStress: null, regulation: null, plasticity: { learningRate: GM_LEARNING_RATE, slowRate: GM_SLOW_RATE, consolidation: 0 }, readyForHandoff: false, _lowErrorStreak: 0, updated: 0 };
    };
    P._buildGovernanceObservation = function () {
      var s = this.state || {};
      var active = (s.diagnoses || []).filter(function (d) { return d.active; });
      // signal = breadth of live governance feeds (institutional / oversight / indicator activity)
      var feeds = s.feeds || [], fc = 0, newest = 0;
      if (Array.isArray(feeds)) {
        for (var i = 0; i < feeds.length; i++) { var fv = feeds[i]; if (fv) { fc++; var u = fv.updated; if (u && u > newest) newest = u; } }
      } else { for (var k in feeds) { if (feeds.hasOwnProperty(k)) { fc++; var u2 = feeds[k] && feeds[k].updated; if (u2 && u2 > newest) newest = u2; } } }
      // companyCount = institutions / govtech operators / public-sector entities
      var companyCount = (s.companies || []).length;
      return { stress: typeof s.stress === 'number' ? s.stress : 0, phase: s.phase || null, activeDiagnoses: active.map(function (d) { return d.id; }).sort(), diagnosisCount: active.length, opportunityCount: (s.opportunities || []).length, companyCount: companyCount, signal: Math.min(1, fc / 8), feedNewest: newest, timestamp: Date.now() };
    };
    P._computeGovernancePredictionError = function (prior, obs) {
      var se = Math.abs(obs.stress - prior.expectedStress), sg = Math.abs(obs.signal - prior.expectedSignal), de = _gmJaccardDistance(obs.activeDiagnoses, prior.expectedDiagnoses);
      var od = Math.max(1, prior.expectedOpportunityCount, obs.opportunityCount), oe = Math.abs(obs.opportunityCount - prior.expectedOpportunityCount) / od;
      var total = _gmClamp(0.4 * se + 0.2 * sg + 0.25 * de + 0.15 * oe, 0, 1);
      return { total: total, stressError: se, signalError: sg, diagnosisError: de, opportunityError: oe, novelty: Math.max(se, de) };
    };
    P._updateGovernancePrior = function (prior, obs, lr) {
      return { expectedStress: _gmClamp(prior.expectedStress + lr * (obs.stress - prior.expectedStress), 0, 1), expectedDiagnoses: obs.activeDiagnoses.slice(), expectedDiagnosisCount: prior.expectedDiagnosisCount + lr * (obs.diagnosisCount - prior.expectedDiagnosisCount), expectedOpportunityCount: prior.expectedOpportunityCount + lr * (obs.opportunityCount - prior.expectedOpportunityCount), expectedSignal: _gmClamp(prior.expectedSignal + lr * (obs.signal - prior.expectedSignal), 0, 1), confidence: _gmClamp(Math.min(1, (prior.samples + 1) / 20), 0, 1), samples: prior.samples + 1 };
    };
    P._computeGovernanceRegulation = function (gm, obs, pe) {
      var gain = _gmClamp(pe.novelty, 0.05, 0.95), inhib = _gmClamp(1 - pe.novelty, 0, 0.9);
      var starving = obs.stress >= GM_STRESS_FLOOR && obs.opportunityCount === 0, flooding = obs.opportunityCount > GM_FLOOD_CAP;
      var streak = (pe.total < 0.05) ? (gm._lowErrorStreak || 0) + 1 : 0; gm._lowErrorStreak = streak; var looping = streak >= 3;
      var stale = obs.feedNewest > 0 ? (Date.now() - obs.feedNewest) > GM_STALE_MS : false;
      var overconf = gm.prior.confidence > 0.8 && pe.total > 0.4;
      var label = flooding ? 'flooding' : starving ? 'starving' : stale ? 'stale' : looping ? 'looping' : overconf ? 'overconfident' : pe.novelty > 0.4 ? 'surprised' : 'calm';
      return { gain: gain, inhibition: inhib, starving: starving, flooding: flooding, looping: looping, stale: stale, overconfident: overconf, state: label };
    };

    // ── RECURRENT STEP — the proof surface (state.governanceModel) the console SELF-MODEL reads ──
    P._updateGovernanceModel = function () {
      var gm = this.state.governanceModel || this._neutralGovernanceModel();
      var priorIn = gm.prior;
      var obs = this._buildGovernanceObservation();
      var pe = this._computeGovernancePredictionError(priorIn, obs);
      var gainBlend = _gmClamp(pe.novelty, 0.05, 0.95);
      var predictedStress = priorIn.expectedStress * (1 - gainBlend) + obs.stress * gainBlend;
      var reg = this._computeGovernanceRegulation(gm, obs, pe);
      var readyForHandoff = (gm.cycle > 0) && (predictedStress >= GM_STRESS_FLOOR) && (obs.diagnosisCount > 0) && !reg.flooding && !reg.stale;

      // K4 CLOSED — credit assignment routed through the central honest reward gate
      // (window.LIMENK4.credit). Governance is NOT externalRewardEligible (the validated kernel is
      // fenced to Finance + Population): it has no external realized-outcome label, so externalOutcome
      // is ALWAYS null and its credit is self-consistency calibration only (interpretive), NEVER reward.
      // The gate enforces the preemption: external-reward(4) > phase-consistency(3) > call-consistency(2)
      // > stress-consistency(1) > none. Pure math, no AI/network on the cycle. One-cycle lag: reads the
      // PRIOR cycle's outcome model + phase dynamics (both are set later this same cycle in the neuro /
      // actuation stack). The returned credit modulates the K4 learning rate for _updateGovernancePrior.
      var _om = this.state.governanceOutcomeModel;
      var _lr = gm.plasticity.learningRate;
      // thing2 realized phase transition — SELF-CONSISTENCY calibration (interpretive), NOT external
      // reward. Governance's phase actuation is OFF (_actuation.phase === false), so the transition hit
      // is never live here and phaseTransitionHit stays null; `validated` would be the P3/P7 family gate
      // only if the kernel were ever validated for this domain (it is not).
      var _pt = (this.state.governancePhaseDynamics || {}).transition;
      var _ptActive = !!(this._actuation && this._actuation.phase && _pt && _pt.hit !== null);
      // Signal built from what the brain already computed. externalOutcome MUST be null (not eligible).
      var _sig = {
        externalOutcome: null,                                              // NOT eligible: self-consistency only, never reward
        phaseValidated: !!(_pt && _pt.validated),                           // P3/P7 family gate for phase-consistency tier — self-consistency, NOT external reward
        phaseTransitionHit: _ptActive ? (_pt.hit ? 1 : 0) : null,           // thing2 transition hit (interpretive); null while phase actuation is off
        callHitRate: (_om && typeof _om.callHitRate === 'number') ? _om.callHitRate : null,  // TRUTH BRAKE ledger (predicted-vs-realized self-consistency)
        callSamples: (_om && typeof _om.samples === 'number') ? _om.samples : 0,
        stressSelfPred: (_om && typeof _om.hitRate === 'number') ? _om.hitRate : null,        // raw stress self-prediction
        stressSamples: (_om && typeof _om.samples === 'number') ? _om.samples : 0
      };
      var _k4 = (typeof window !== 'undefined' && window.LIMENK4 && typeof window.LIMENK4.credit === 'function')
        ? window.LIMENK4.credit(_sig) : null;
      var _hit, _creditSource, _isReward;
      if (_k4) {
        _hit = (typeof _k4.credit === 'number') ? _k4.credit : null;
        _creditSource = _k4.creditSource;
        _isReward = !!_k4.isReward;                                         // ALWAYS false for governance (not externalRewardEligible)
      } else {
        // FALLBACK (gate absent) — preserve the prior credit behavior: no learning-rate modulation
        // (governance never modulated K4 before this wiring). Never throws.
        _hit = null;
        _creditSource = 'none';
        _isReward = false;                                                  // self-consistency only; never reward
      }
      if (_hit !== null) _lr = _gmClamp(_lr * (1 + (1 - _hit)), GM_SLOW_RATE, 0.6);
      gm._effectiveLearningRate = _lr;
      gm._creditSource = _creditSource;
      gm._creditIsReward = _isReward;                                       // honest flag: false unless a real external outcome fed the gate

      var nextPrior = this._updateGovernancePrior(priorIn, obs, _lr);
      gm.cycle += 1; gm.observation = obs; gm.predictionError = pe; gm.predictedStress = predictedStress; gm.regulation = reg; gm.readyForHandoff = readyForHandoff; gm.prior = nextPrior; gm.updated = obs.timestamp;
      this.state.governanceModel = gm;

      var mem = this.state.memory || (this.state.memory = {});
      var log = mem.outcomeLog || (mem.outcomeLog = []);
      log.push({ cycle: gm.cycle, predictionError: Math.round(pe.total * 1000) / 1000, stress: obs.stress, activeDx: obs.diagnosisCount, regulation: reg.state, timestamp: obs.timestamp }); if (log.length > 40) log.shift();

      try { this._computeGovernanceHigherLayers(); } catch (e) {}

      // INSTITUTIONAL-INTEGRITY — governance sub-portal layer (additive; BEFORE the DDP build so the
      // primary packet's promptView advertises it). Never touches the validated 6-diagnosis spine.
      try { this._buildGovernanceInstitutionalIntegritySublayer(); } catch (e) {}

      // DDP — build the DomainDiagnosisPacket (8-section contract) for the primary diagnosis,
      // and one per diagnosis. Schema-only: never invents data. Consumed by the console SELF-MODEL.
      try {
        var _diags = this.state.diagnoses || [];
        var _primary = _diags.filter(function (d) { return d.active; })[0] || _diags[0] || null;
        var _self = this;
        gm.domainDiagnosisPacket = this._buildDomainDiagnosisPacket(_primary);
        this.state.governanceDomainDiagnosisPackets = _diags.map(function (d) { return _self._buildDomainDiagnosisPacket(d); });
      } catch (e) {}

      // state.cognition — generic surface domain-console-brain.js reads for ANY brain.
      this.state.cognition = {
        domain: 'governance',
        governanceModel: gm,
        model: { cycle: gm.cycle, predictionError: gm.predictionError, predictedStress: gm.predictedStress, regulation: gm.regulation },
        governanceImmune: this.state.governanceImmune || null,
        governanceAwareness: this.state.governanceAwareness || null,
        governanceConscience: this.state.governanceConscience || null,
        governanceIntuition: this.state.governanceIntuition || null,
        governanceSimulation: this.state.governanceSimulation || null,
        governanceExecutiveReport: this.state.governanceExecutiveReport || null,
        awareness: this.state.governanceAwareness || null,
        conscience: this.state.governanceConscience || null,
        immune: this.state.governanceImmune || null,
        intuition: this.state.governanceIntuition || null,
        institutionalIntegritySublayer: this.state.governanceInstitutionalIntegrityLayer || null,
        policyRegimeSublayer: this.state.policyRegimeSublayer || null,
        treatments: this.state.treatments || [],
        diagnoses: this.state.diagnoses || [],
        opportunities: this.state.opportunities || []
      };

      // K1..K8 NEURO-COMPLETION LOOPS (ported from Energy). Runs AFTER cognition is assembled and
      // BEFORE actuation, so K8's fresh stress-history feeds the servo. Guarded; never breaks the cycle.
      try { this._computeGovernanceNeuroLayers(); } catch (e) {}

      // ACTUATION — servo / E/I brake / self-audit / phase (advisory), each behind its _actuation flag.
      // Runs AFTER cognition is assembled so it attaches additively; guarded so it never breaks the cycle.
      try { this._computeGovernanceActuation(); } catch (e) {}

      return gm;
    };

    P._computeGovernanceHigherLayers = function () {
      this._computeGovernanceImmune(); this._computeGovernanceAwareness(); this._computeGovernanceConscience(); this._computeGovernanceIntuition();
      try { this._computeGovernanceSimulation(); } catch (e) {}
      try { this._computeGovernanceExecutiveReport(); } catch (e) {}
    };

    // ── H1 — immune (antigen scan over bundle/feed/regulation state) ──
    P._computeGovernanceImmune = function () {
      var s = this.state, gm = s.governanceModel || {}, reg = gm.regulation || {}, ant = [];
      var bs = (typeof this._governanceBundleStates === 'function') ? this._governanceBundleStates() : [];
      bs.forEach(function (b) {
        if (b.bundleStatus === 'missing') ant.push({ type: 'source-bundle-missing', dx: b.dxId, severity: 'medium', action: 'block-from-prompt-evidence' });
        if (b.buildMethod === 'external-source-authored') ant.push({ type: 'external-source-authored-needs-human-verification', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
        if (b.aliasRisk === 'medium' || b.aliasRisk === 'high') ant.push({ type: 'alias-risk-bundle', dx: b.dxId, severity: b.aliasRisk, action: 'allow-with-warning' });
        if (b.bundleStatus === 'found' && b.shallow) ant.push({ type: 'root-only-shallow-bundle', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
      });
      var pe = (gm.predictionError && gm.predictionError.total) || 0;
      if (pe > 0.4) ant.push({ type: 'prediction-error-spike', severity: 'medium', action: 'lower-confidence', value: Math.round(pe * 1000) / 1000 });
      if (reg.stale) ant.push({ type: 'stale-feeds', severity: 'low', action: 'flag' });
      if (reg.flooding) ant.push({ type: 'opportunity-flood', severity: 'medium', action: 'inhibit' });
      if (reg.starving) ant.push({ type: 'stress-without-opportunity', severity: 'low', action: 'flag' });
      var _l1 = s._l1DepthCache;
      if (_l1 && _l1.byDiagnosis && Object.keys(_l1.byDiagnosis).some(function (dx) { return _l1.byDiagnosis[dx].madLibTreatments > 0; })) {
        ant.push({ type: 'l1-synthetic-treatments', severity: 'medium', action: 'quarantine', note: 'L1 portal treatments are mad-lib templates (fixed-verb family); quarantined from evidence — only real govtech/public-sector identifiers surfaced relevance-unverified' });
      }
      var sev = ant.some(function (a) { return a.severity === 'high'; }) ? 'high' : ant.some(function (a) { return a.severity === 'medium'; }) ? 'medium' : ant.length ? 'low' : 'none';
      s.governanceImmune = {
        version: 1, immuneState: sev === 'high' ? 'alert' : sev === 'medium' ? 'active' : sev === 'low' ? 'watch' : 'clear', severity: sev,
        antigens: ant.slice(0, 12),
        quarantines: ['L1-portal-treatments-madlib'],
        allowedWithWarning: ant.filter(function (a) { return a.action === 'allow-with-warning'; }).map(function (a) { return a.type + (a.dx ? (':' + a.dx) : ''); }),
        blockedFromPrompt: ant.filter(function (a) { return a.action === 'block-from-prompt-evidence'; }).map(function (a) { return a.dx; }),
        blockedFromTraversal: ['L2'],
        lastScanAt: gm.updated || null
      };
      return s.governanceImmune;
    };
    // ── H2 — awareness (narrative on institutional integrity / legitimacy pressure) ──
    P._computeGovernanceAwareness = function () {
      var s = this.state, gm = s.governanceModel || {}, im = s.governanceImmune || {}, active = (s.diagnoses || []).filter(function (d) { return d.active; });
      var pe = (gm.predictionError && gm.predictionError.total) || 0, dxNames = active.map(function (d) { return d.label || d.id; });
      s.governanceAwareness = {
        version: 1, selfState: im.immuneState === 'alert' ? 'guarded' : (gm.regulation && gm.regulation.state) || 'unknown',
        knowns: dxNames.slice(0, 6),
        uncertainties: ['interpretive tracker — diagnoses are signal-driven readings of institutional integrity / legitimacy / policy-coherence pressure, not validated', 'high-stress diagnoses require corroboration by institutionally strong sources (GAO/CBO/OMB/World Bank WGI/V-Dem); partisan feeds are positional-only', 'predictionError=' + (Math.round(pe * 1000) / 1000)],
        confidenceDrivers: ['regulation ' + ((gm.regulation && gm.regulation.state) || '?'), active.length + ' active dx'],
        selfNarrative: 'Governance: ' + active.length + ' active diagnosis pathway' + (active.length !== 1 ? 's' : '') + ' (' + (dxNames.slice(0, 3).join(', ') || 'none') + '), regulation=' + ((gm.regulation && gm.regulation.state) || '?') + ', immune=' + (im.immuneState || '?') + ', prediction-error ' + (Math.round(pe * 100) / 100) + '.',
        lastAwarenessAt: gm.updated || null
      };
      return s.governanceAwareness;
    };
    // ── H3 — conscience (artifact readiness; GOVERNANCE does INVESTABLE/RESEARCHABLE only — no patent/grant per 2026 rules) ──
    P._computeGovernanceConscience = function () {
      var s = this.state, gm = s.governanceModel || {}, pe = (gm.predictionError && gm.predictionError.total) || 0, cautions = [];
      if (pe > 0.4) cautions.push({ claim: 'high-confidence-claim', reason: 'predictionError spike ' + (Math.round(pe * 1000) / 1000) });
      var bs = (typeof this._governanceBundleStates === 'function') ? this._governanceBundleStates() : [];
      bs.forEach(function (b) {
        if (b.buildMethod === 'external-source-authored') cautions.push({ claim: 'strong-claim:' + b.dxId, reason: 'external-source-authored; human-verification-required' });
      });
      s.governanceConscience = { version: 1, conscienceState: 'restrictive', vetoes: [{ claim: 'patent/grant', reason: 'patent/grant lanes retired across all domains (2026-06-21); governance has no method/embodiment fields' }], cautions: cautions.slice(0, 8), allowedClaims: ['source-summary', 'policy-brief-with-warnings'], blockedClaims: ['patent-claim', 'grant-claim'], artifactReadinessDecision: { patentReady: false, grantReady: false, investmentReady: true, researchReady: true, note: 'patent/grant vetoed; investment/research allowed-with-warning (high-stress institutional claims need GAO/CBO/OMB/WGI corroboration)' }, reasons: ['overclaim prevention', 'interpretive-not-validated', 'institutional-source-sufficiency'], lastCheckAt: gm.updated || null };
      return s.governanceConscience;
    };
    // ── H4 — intuition (hunches on emerging institutional stress / regime drift) ──
    P._computeGovernanceIntuition = function () {
      var s = this.state, gm = s.governanceModel || {}, reg = gm.regulation || {}, log = (s.memory && s.memory.outcomeLog) || [], hunches = [];
      if (log.length >= 2) { var a = log[log.length - 2].predictionError, b = log[log.length - 1].predictionError; if (typeof a === 'number' && typeof b === 'number' && b - a > 0.05) hunches.push({ hunch: 'institutional regime shift forming (prediction error rising) — emerging policy incoherence or legitimacy drift', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'predictionError rose ' + a + ' → ' + b, verifyIf: 'error keeps rising 2+ cycles', falsifyIf: 'error returns to baseline' }); }
      if (reg.state === 'surprised') hunches.push({ hunch: 'novel governance stressor entering the system (institutional shock / abrupt policy reversal)', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'regulation = surprised', verifyIf: 'a specific diagnosis activates with institutional source support', falsifyIf: 'novelty subsides next cycle' });
      var missing = (typeof this._governanceBundleStates === 'function' ? this._governanceBundleStates() : []).filter(function (x) { return x.bundleStatus === 'missing' && x.active; });
      if (missing.length) hunches.push({ hunch: 'recurring uncovered diagnosis: ' + missing[0].dxId, confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'active diagnosis with no source bundle', verifyIf: 'a real institutional source bundle is built', falsifyIf: 'diagnosis deactivates' });
      // patternMatches — recurring regulation state from real memory
      var patternMatches = [], recent = log.slice(-10), regCount = {};
      recent.forEach(function (e) { if (e.regulation) regCount[e.regulation] = (regCount[e.regulation] || 0) + 1; });
      Object.keys(regCount).forEach(function (k) { if (regCount[k] >= 3) patternMatches.push({ pattern: 'recurring regulation state: ' + k, occurrences: regCount[k], window: recent.length, evidenceStatus: 'UNVERIFIED' }); });
      var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
      var primaryId = (active[0] || {}).id, analogies = [];
      Object.keys(FAMILY).forEach(function (fam) { if (FAMILY[fam].indexOf(primaryId) >= 0) { FAMILY[fam].forEach(function (sib) { if (sib !== primaryId) analogies.push({ analogy: primaryId + ' resembles ' + sib, family: fam, evidenceStatus: 'UNVERIFIED', note: 'shared institutional failure-family — a lens for monitoring, not a claim' }); }); } });
      // promotion — a hunch recurring >=3 cycles -> monitoring target only (never diagnosis/evidence)
      var hm = this._governanceHunchMemory = this._governanceHunchMemory || {};
      var curKeys = {}; hunches.forEach(function (h) { curKeys[h.hunch] = true; hm[h.hunch] = (hm[h.hunch] || 0) + 1; });
      var promotedToMonitoring = [], rejectedHunches = [];
      Object.keys(hm).forEach(function (k) {
        if (!curKeys[k]) { rejectedHunches.push({ hunch: k, reason: 'signal subsided across cycles (falsifier path)' }); delete hm[k]; return; }
        if (hm[k] >= 3) promotedToMonitoring.push({ target: k, basis: 'recurred ' + hm[k] + ' cycles', note: 'monitoring target ONLY — never evidence or diagnosis' });
      });
      s.governanceIntuition = { version: 1, hunches: hunches.slice(0, 6), patternMatches: patternMatches.slice(0, 5), analogies: analogies.slice(0, 6), promotedToDiagnosis: [], promotedToMonitoring: promotedToMonitoring.slice(0, 4), rejectedHunches: rejectedHunches.slice(0, 4), confidence: 'LOW', evidenceStatus: 'UNVERIFIED', lastAt: gm.updated || null };
      return s.governanceIntuition;
    };
    // ── H5 — bounded counterfactual simulation (hypothetical only; UNVERIFIED) ──
    P._computeGovernanceSimulation = function () {
      var s = this.state, gm = s.governanceModel || {};
      var base = typeof s.stress === 'number' ? s.stress : 0;
      function cl(v) { return Math.max(0, Math.min(1, Math.round(v * 1000) / 1000)); }
      var scenarios = [
        { type: 'escalate', hypothetical: true, assumption: 'institutional stressor intensifies (gridlock deepens / shutdown extends)', simulatedStress: cl(base + 0.2), risk: 'cascade toward constitutional/policy paralysis (CONSTITUTIONAL_CRISIS / POLICY_FAILURE)', intervention: 'track legislative cadence (Congress.gov/GovTrack), CBO/OMB execution signals', falsifier: 'stress flat or falling next cycle' },
        { type: 'hold', hypothetical: true, assumption: 'institutional stressor holds at an elevated baseline', simulatedStress: cl(base), risk: 'persistent legitimacy drag / chronic coordination failure', intervention: 'maintain monitoring cadence on GAO oversight + WGI/V-Dem indicators', falsifier: 'stress moves materially' },
        { type: 'de-escalate', hypothetical: true, assumption: 'institutional stressor reverses (compromise / reform passes)', simulatedStress: cl(base - 0.2), risk: 'premature de-escalation before structural fix lands', intervention: 'confirm with 2 independent institutional sources before standing down', falsifier: 'stress re-rises' },
        { type: 'institutional-capture', hypothetical: true, assumption: 'oversight weakens; regulatory/agency capture advances', simulatedStress: cl(base + 0.3), risk: 'accountability collapse / corruption entrenchment (CORRUPTION_SCANDAL)', intervention: 'track GAO + POGO oversight findings, IG referrals, ethics-commission actions', falsifier: 'independent oversight findings rise and bind' },
        { type: 'trust-collapse', hypothetical: true, assumption: 'public confidence/legitimacy falls below the durable threshold', simulatedStress: cl(base + 0.25), risk: 'regime instability / contested legitimacy (REGIME_INSTABILITY)', intervention: 'track approval/confidence series + World Bank WGI voice-and-accountability', falsifier: 'confidence stabilizes above threshold' }
      ];
      var sim = {
        version: 1, scenarios: scenarios, assumptions: scenarios.map(function (x) { return x.assumption; }),
        simulatedStress: scenarios.map(function (x) { return x.simulatedStress; }),
        simulatedDiagnoses: ['CONSTITUTIONAL_CRISIS', 'POLICY_FAILURE', 'CORRUPTION_SCANDAL', 'REGIME_INSTABILITY'], simulatedOpportunities: [],
        risks: scenarios.map(function (x) { return x.risk; }), interventions: scenarios.map(function (x) { return x.intervention; }),
        falsifiers: scenarios.map(function (x) { return x.falsifier; }), lastSimulatedAt: gm.updated || null
      };
      s.governanceSimulation = sim; return sim;
    };
    // ── H6 — executive self-report (compact status card) ──
    P._computeGovernanceExecutiveReport = function () {
      var s = this.state, gm = s.governanceModel || {}, im = s.governanceImmune || {}, aw = s.governanceAwareness || {}, con = s.governanceConscience || {}, it = s.governanceIntuition || {}, sim = s.governanceSimulation || {};
      var bs = (typeof this._governanceBundleStates === 'function') ? this._governanceBundleStates() : [];
      var covered = bs.filter(function (b) { return b.bundleStatus === 'found'; }).length;
      var hv = bs.filter(function (b) { return b.humanVerification === 'required'; }).length;
      var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
      var strongest = active[0] || (s.diagnoses || [])[0] || null;
      var pe = (gm.predictionError && gm.predictionError.total) || 0;
      var status = im.immuneState === 'alert' ? 'immune-alert' : hv > 0 ? 'human-review-required' : (bs.length && covered < bs.length) ? 'source-limited' : (gm.regulation && gm.regulation.starving) ? 'starving' : (gm.regulation && gm.regulation.state === 'surprised') ? 'surprised' : 'healthy';
      var rep = {
        version: 1, brainStatus: status,
        strongestDiagnosis: strongest ? strongest.id : null,
        strongestOpportunity: (s.opportunities && s.opportunities[0] && s.opportunities[0].title) || null,
        confidence: Math.round((1 - pe) * 100) / 100, predictionError: Math.round(pe * 1000) / 1000,
        regulationState: (gm.regulation && gm.regulation.state) || null, immuneState: im.immuneState || null,
        awarenessSummary: aw.selfNarrative || null, conscienceDecision: con.conscienceState || null,
        intuitionSummary: (it.hunches || []).length + ' hunch(es)', simulationSummary: (sim.scenarios || []).length + ' scenario(s)',
        artifactReadiness: con.artifactReadinessDecision || null, blockers: (con.blockedClaims || []).slice(0, 6),
        nextBestAction: (bs.length && covered < bs.length) ? 'build/verify institutional source bundles for uncovered diagnoses (GAO/CBO/OMB/WGI/V-Dem)' : hv > 0 ? 'human-verify external-source bundles' : 'monitor strongest diagnosis sources (legislative cadence, oversight findings, governance indicators)',
        lastReportAt: gm.updated || null
      };
      s.governanceExecutiveReport = rep; return rep;
    };
  })();

  // ════════════════════════════════════════════════════════════════════════════
  // ACTUATION LAYER (2026-07-13) — ported from Energy, gated by this._actuation.
  // Mirrors Energy's structure + math but reads GOVERNANCE's own state/edges. Every method is
  // deterministic (no AI, no fetch-to-LLM); the only network call is a one-shot static fetch of
  // governance.json edges for the self-audit. Additive: touches ONLY emission (opportunity confidence
  // + action-draft rate-limiting) — never stress/scoring/diagnoses/governance.json. See §E of the
  // playbook and ENERGY_NEURO_AUDIT.md for the neurology mapping.
  // ════════════════════════════════════════════════════════════════════════════

  // REFRACTORY LIMITER (Neuro Ref III.3) — inline, deterministic, no external module, no AI.
  // Absolute dead-time (hard block) + relative window (raised threshold: a stronger stimulus can still
  // fire). The diagnosis stays active/displayed; only the duplicate action DRAFT is withheld. Reversible
  // via this._actuation.refractory=false. This is the ACTUATED overlay (a real effector on emission).
  GovernanceBrain.prototype._governanceRefractoryFire = function (dxId, now, stress) {
    var p = this._refractoryParams || {};
    var map = this._governanceRefractoryMap || (this._governanceRefractoryMap = {});
    var rec = map[dxId];
    if (rec) {
      var age = now - rec.lastFire;
      if (age < (p.absoluteWindow || 900000)) return { allowed: false, reason: 'absolute-refractory' };
      if (age < (p.relativeWindow || 3600000) && stress < (p.overrideThreshold || 0.9)) return { allowed: false, reason: 'relative-refractory' };
    }
    map[dxId] = { lastFire: now, lastStress: stress };
    return { allowed: true };
  };

  // REGULATE-TO-TARGET SERVO (Neuro Ref V.2/XII allostasis + XIII.1 E/I). Real sensor->controller->
  // effector->feedback loop: sensor = excitatory drive (stress + how many things fire at once) vs the
  // current inhibition term; controller = PI (fast proportional + bounded slow integral, the HPA fast+
  // slow arms); effector = a proportional dampening of emission the E/I brake consumes. Reversible via
  // this._actuation.servo=false. Reads GOVERNANCE's regulation + stress history (never Energy's).
  GovernanceBrain.prototype._computeGovernanceServo = function () {
    function R(x) { return Math.round(x * 1000) / 1000; }
    var s = this.state, gm = s.governanceModel || {}, reg = gm.regulation || {};
    // SENSOR: excitatory drive
    var stress = (typeof s.stress === 'number') ? s.stress : 0;
    var conds = Array.isArray(s._activeConditions) ? s._activeConditions.length : (Array.isArray(s.signals) ? s.signals.length : 0);
    var dxA = Array.isArray(s.diagnoses) ? s.diagnoses.filter(function (d) { return d && d.active; }).length : 0;
    var drive = Math.max(0, Math.min(2, stress + Math.min(conds, 12) / 24 + Math.min(dxA, 6) / 24));
    var inhibition = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;   // from _computeGovernanceRegulation
    // Adaptive baseline (K8 allostasis): deviation above the rolling stress mean.
    var hist = ((s.memory && s.memory.stressHistory) || []).slice(-60);
    var sum = 0; for (var i = 0; i < hist.length; i++) sum += (hist[i].stress || 0);
    var baseline = hist.length ? sum / hist.length : 0.5;
    var deviation = Math.max(0, stress - baseline);
    var FLOOR = 0.15;
    // TARGET (allostatic set-point): inhibition must track drive AND rise with deviation above baseline.
    var target = Math.max(FLOOR, Math.min(1, Math.max(drive, FLOOR + deviation)));
    var error = target - inhibition;                                             // >0 => under-braked for the drive/regime
    // CONTROLLER: bounded integral (slow arm) + proportional (fast arm)
    this._governanceServoIntegral = Math.max(-0.5, Math.min(0.5, (this._governanceServoIntegral || 0) + error * 0.15));
    var Kp = 0.8, Ki = 0.4;
    var correction = Math.max(0, Kp * error + Ki * Math.max(0, this._governanceServoIntegral));   // only ADD braking; never disinhibit
    // EFFECTOR: proportional dampening of emission (the E/I brake consumes this)
    var emissionFactor = Math.max(0.2, Math.min(1, 1 - correction));
    var state = error > 0.25 ? 'runaway-risk' : ((inhibition - target) > 0.4 ? 'over-inhibited' : 'balanced');
    var servo = {
      version: 1, actuated: true, drive: R(drive), inhibition: R(inhibition), target: R(target),
      error: R(error), integral: R(this._governanceServoIntegral), emissionFactor: R(emissionFactor),
      state: state, deviation: R(deviation),
      note: 'closed-loop allostasis: drives inhibition toward a drive+deviation target; effector = proportional emission dampening. Neuro Ref XIII.1/V.2/XII.'
    };
    s.governanceServo = servo;
    return servo;
  };

  // E/I BRAKE ACTUATION (Neuro Ref XIII.1: inhibition scales with drive). Consumes the servo's
  // emissionFactor and dampens opportunity-emission confidence PROPORTIONALLY — the same channel the
  // generic brake uses. Reversible via this._actuation.eiBrake=false. Non-destructive: opportunities are
  // rebuilt each cycle by surfaceOpportunities, so this re-applies from the fresh servo without compounding.
  GovernanceBrain.prototype._applyGovernanceEIBrake = function (opps) {
    opps = opps || this.state.opportunities || [];
    var servo = this.state.governanceServo;
    if (!(this._actuation && this._actuation.eiBrake && servo)) { this.state.governanceEIBrake = null; return opps; }
    var eiFactor = (typeof servo.emissionFactor === 'number') ? servo.emissionFactor : 1;
    var reasons = [];
    if (servo.state === 'runaway-risk') reasons.push({ code: 'ei-imbalance', severity: 'dampen', detail: 'inhibition ' + servo.inhibition + ' below target ' + servo.target + ' (drive ' + servo.drive + ')' });
    if (eiFactor < 1) {
      for (var i = 0; i < opps.length; i++) {
        if (typeof opps[i].confidence === 'number') { opps[i].confidence = Math.round(opps[i].confidence * eiFactor); opps[i].eiDamped = true; }
      }
    }
    var brake = {
      version: 1, actuated: true, eiFactor: Math.round(eiFactor * 1000) / 1000, engaged: eiFactor < 1,
      reasons: reasons, dampenedCount: eiFactor < 1 ? opps.length : 0,
      note: 'E/I brake (Neuro Ref XIII.1): inhibition scales with drive via the servo; effector = proportional emission-confidence dampening. Reversible via _actuation.eiBrake.'
    };
    this.state.governanceEIBrake = brake;
    return opps;
  };

  // E/I BALANCE + SELF-AUDIT ADVISORIES (observe-only; Neuro Ref XIII.1 + XIV). CONSUMES the real
  // 85-edge / 40-node governance graph (lazily fetched + cached from governance.json — edges are NOT in
  // the live snapshot). Mirrors _computeEnergyRegulationAdvisories. Deterministic, no writes, no AI.
  // Reversible via this._actuation.selfAudit=false. Degrades safe: if the shared audit modules aren't
  // loaded, selfAudit reports consumed:false rather than fabricating.
  GovernanceBrain.prototype._computeGovernanceRegulationAdvisories = function () {
    var s = this.state, out = { version: 1, observeOnly: true };
    // (1) E/I balance — is inhibition tracking drive? (shared module, generic despite the name)
    try {
      var EI = (typeof window !== 'undefined' && window.LIMENEIBalance) || null;
      if (!EI && typeof require === 'function') { try { EI = require('../limen-ei-balance.js'); } catch (_e) {} }
      if (EI && typeof EI.assessFromState === 'function') out.eiBalance = EI.assessFromState(s);
    } catch (e) { out.eiBalance = null; }
    // (2) Self-audit — connectivity / single-points-of-failure on the REAL governance graph.
    try {
      var self = this;
      var edges = (Array.isArray(s.edges) && s.edges) || this._governanceEdges || null;
      if (!edges) {
        if (typeof fetch === 'function' && !this._governanceEdgesPromise) {
          this._governanceEdgesPromise = fetch('/assets/data/domains/governance.json')
            .then(function (r) { return r.json(); })
            .then(function (j) { if (j && Array.isArray(j.edges)) self._governanceEdges = j.edges; })
            .catch(function () {});
        } else if (typeof require === 'function') {
          try { var ed = require('../../data/domains/governance.json'); if (ed && Array.isArray(ed.edges)) { this._governanceEdges = ed.edges; edges = ed.edges; } } catch (_e) {}
        }
      }
      var CA = (typeof window !== 'undefined' && window.LIMENConnectivityAudit) || null;
      if (!CA && typeof require === 'function') { try { CA = require('../limen-connectivity-audit.js'); } catch (_e) {} }
      if (CA && edges && edges.length && typeof CA.singlePointsOfFailure === 'function') {
        var audit = CA.singlePointsOfFailure({ edges: edges });
        var spof = (audit && audit.articulationNodes) || [];
        out.selfAudit = { consumed: true, edgeCount: edges.length, spofCount: spof.length, spof: spof.slice(0, 5),
          verdict: (audit && audit.verdict) || null, topHubs: (audit && audit.topHubsByDegree) || [] };
      } else {
        out.selfAudit = { consumed: false, note: edges ? 'connectivity-audit not loaded' : 'edges loading (async, next cycle)' };
      }
    } catch (e) { out.selfAudit = { consumed: false, error: String(e && e.message || e).slice(0, 80) }; }
    return out;
  };

  // Per-cycle: append the domain's primary STRESS scalar (finalStress/stress; up=bad) to the
  // persistent series, cap at 60, persist, then run the Thing2 kernel over it to derive an
  // interpretive P0-P10 phase. Deterministic pure-math (no network/AI). On any failure or when
  // the adapter/history is unavailable, _kernelPhase is set to null and the caller falls back to
  // s.phase. seriesSource = STRESS (positive:false) because governance's scalar rises with distress.
  GovernanceBrain.prototype._updatePhaseKernel = function () {
    var s = this.state;
    var scalar = (typeof s.finalStress === 'number') ? s.finalStress
               : (typeof s.stress === 'number') ? s.stress : null;
    try {
      if (scalar != null && isFinite(scalar)) {
        this._phaseSeries.push(scalar);
        while (this._phaseSeries.length > 60) this._phaseSeries.shift();
        try {
          if (typeof localStorage !== 'undefined' && localStorage) {
            localStorage.setItem('limen:phaseseries:governance', JSON.stringify(this._phaseSeries));
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

  // PHASE-COHERENCE ROUTER + TRANSITION READ — ADVISORY ONLY (this._actuation.phase === false).
  // Governance's phase is authored/snapshot (governance.json = P7), NOT a Thing1-validated LIVE P3/P7
  // signal (the validated kernel is FENCED to Finance + Population). So a realized phase TRANSITION is
  // NEVER treated as ground-truth reward here: it stays advisory-self-consistency and drives NO credit /
  // learning / emission gating. Pure observe-only telemetry, mirroring the SHAPE of
  // _computeEnergyPhaseDynamics without the reward.
  // PHASE SOURCE: the interpretive Thing2 recursive kernel over this domain's stress trajectory
  // (this._kernelPhase) when available; otherwise the existing naive/static s.phase (unchanged fallback).
  GovernanceBrain.prototype._computeGovernancePhaseDynamics = function () {
    var s = this.state;
    // Refresh the Thing2 kernel phase from this domain's stress trajectory (pure math, guarded).
    try { this._updatePhaseKernel(); } catch (e) { this._kernelPhase = null; s.phaseSource = 'fallback'; }
    var PHASE_M = {
      p3:  { p3: 0.08, p7a: 0.05, p9: 0.04, p0: -0.06 },
      p7a: { p7a: 0.10, p3: 0.04, p9: 0.06, p0: -0.08, p4: -0.04 },
      p7:  { p7: 0.10, p3: 0.04, p9: 0.06, p0: -0.08 },
      p4:  { p4: 0.05, p5: 0.04, p0: 0.03, p3: -0.04 },
      p6:  { p6: 0.06, p0: 0.04, p3: -0.05 },
      p9:  { p9: 0.08, p7a: 0.05, p0: -0.10, p4: -0.06 },
      p10: { p10: 0.06, p0: 0.05, p6: 0.03 }
    };
    var BREAKING = { p1: 1, p3: 1, p7: 1, p7a: 1, p7b: 1, p9: 1 };
    function norm(p) { if (p == null) return null; p = String(p).toLowerCase().replace(/[^a-z0-9]/g, ''); if (p.charAt(0) !== 'p') p = 'p' + p; return p; }
    // PREFER the Thing2 kernel phase (interpretive) for both the coherence router and the transition
    // read; fall back to the existing naive/static s.phase when the kernel is unavailable.
    var myPhase = norm(this._kernelPhase != null ? this._kernelPhase : s.phase);
    // (A) COHERENCE ROUTER — advisory read of co-phased, stressed peer domains.
    var doms = (typeof window !== 'undefined' && window.LIMENDomains) || {};
    var coupled = [], couplingStrength = 0;
    if (myPhase && PHASE_M[myPhase]) {
      var row = PHASE_M[myPhase];
      Object.keys(doms).forEach(function (k) {
        if (k === 'governance') return;
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
    // (B) TRANSITION READ — computed for telemetry; ALWAYS advisory (never ground-truth for governance).
    var hist = this._governancePhaseHistory = this._governancePhaseHistory || [];
    var prev = hist.length ? hist[hist.length - 1].phase : null;
    var transition = null;
    if (prev != null && myPhase != null && prev !== myPhase) {
      var wentUp = (BREAKING[myPhase] && !BREAKING[prev]) ? true : (BREAKING[prev] && !BREAKING[myPhase]) ? false : null;
      transition = { from: prev, to: myPhase, wentUp: wentUp, hit: null, validated: false, groundTruthEligible: false,
        kind: 'advisory-self-consistency', reason: 'governance is not a Thing1-validated kernel domain (fenced to Finance+Population); no ground-truth phase reward' };
    }
    hist.push({ phase: myPhase, t: (s.governanceModel && s.governanceModel.updated) || Date.now() });
    if (hist.length > 24) hist.shift();
    var out = {
      version: 1, actuated: false, advisoryOnly: true, myPhase: myPhase,
      phaseSource: s.phaseSource || 'fallback',       // 'thing2-kernel' when the real kernel drove myPhase, else 'fallback'
      kernelPhase: this._kernelPhase || null, kernelTrajectory: s.kernelTrajectory || null,
      coupled: coupled.slice(0, 5), couplingStrength: Math.round(couplingStrength * 1000) / 1000, transition: transition,
      note: 'ADVISORY phase-coherence router + transition read. Phase source = Thing2 recursive kernel over the stress trajectory (interpretive) with s.phase fallback; NOT actuated (governance lacks a Thing1-validated P3/P7 signal). Feeds no credit/learning/emission gating.'
    };
    s.governancePhaseDynamics = out;
    return out;
  };

  // ORCHESTRATOR — runs the actuation stack in Energy's order (servo BEFORE the E/I brake consumes it;
  // self-audit + phase telemetry alongside), each behind its _actuation flag. Called at the END of
  // _updateGovernanceModel (after cognition is assembled). try/catch-guarded so it can never break the cycle.
  GovernanceBrain.prototype._computeGovernanceActuation = function () {
    var A = this._actuation || {};
    if (A.servo) { try { this._computeGovernanceServo(); } catch (e) {} }                                   // regulate-to-target (before the brake)
    if (A.selfAudit) { try { this.state.governanceRegulation = this._computeGovernanceRegulationAdvisories(); } catch (e) { this.state.governanceRegulation = null; } }
    try { this._computeGovernancePhaseDynamics(); } catch (e) {}                                            // advisory only (phase actuation OFF)
    if (A.eiBrake) { try { this._applyGovernanceEIBrake(this.state.opportunities); } catch (e) {} }          // effector: proportional emission dampening
    // Attach to the generic cognition surface (ADDITIVE keys only — never overwrites existing).
    var cog = this.state.cognition;
    if (cog && typeof cog === 'object') {
      cog.servo = this.state.governanceServo || null;
      cog.eiBrake = this.state.governanceEIBrake || null;
      cog.phaseDynamics = this.state.governancePhaseDynamics || null;
      cog.regulation = this.state.governanceRegulation || null;
      cog.actuation = A;
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE K — GOVERNANCE NEURO-COMPLETION LAYERS (governance-local, additive, reversible).
  // Ported from energy-brain.js (K1..K8), reading THIS domain's state/edges. Fills the brain
  // functions the self-model map flags as missing or open-loop:
  //   K1 afferent integration, K2 neuromodulatory gain, K3 slow consolidation,
  //   K4 outcome / credit learning (TRUTH-BRAKE self-consistency), K5 deep-perception depth,
  //   K6 attention, K7 lateral inhibition, K8 homeostatic set-point.
  // Each layer COMPUTES and EXPOSES its signal on state (governanceAfferent, governanceSlowModel,
  // …). Runs on the deterministic 30s cycle — NO paid-AI / LLM fetch, ever. Never fabricates
  // evidence; reads cached state only, adds no network calls. Wired in _updateGovernanceModel
  // BEFORE the existing actuation stack (so K8's stress-history feeds the servo), leaving the
  // servo / E/I brake / phase / self-audit actuation and all exports untouched.
  // K4 is SELF-CONSISTENCY / TRUTH-BRAKE calibration (predicted-vs-next-realized stress), NOT an
  // external/dopaminergic reward. Credit assignment is routed through the central honest reward gate
  // (window.LIMENK4.credit) in _updateGovernanceModel; governance is NOT externalRewardEligible, so
  // externalOutcome is always null and isReward is always false (self-consistency calibration, interpretive).
  // ════════════════════════════════════════════════════════════════════════════
  var GK_OUTCOME_BUFFER = 40;   // rolling predicted-vs-realized samples
  var GK_HOMEO_WINDOW = 60;     // cycles of stress baseline for the adaptive set-point

  // K1 — afferent inter-brain integration. Surfaces received cross-domain pressure and the stress
  // delta it WOULD add. The base scoreStress already folds getExternalPressure() into stress
  // (governance's normalizeSignals also reads it), so this is CLOSED: report, don't re-apply.
  GovernanceBrain.prototype._computeGovernanceAfferent = function () {
    var s = this.state, gm = s.governanceModel || {};
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
      integrated: true,                                          // K1 CLOSED — external pressure reaches stress via base scoreStress
      appliedStressDelta: Math.round(((s._externalPressureApplied) || 0) * 1000) / 1000,
      wouldRaiseStressBy: Math.round(pressure * 1000) / 1000,
      note: 'CLOSED: getExternalPressure() is folded into stress each cycle (base scoreStress + normalizeSignals cross_branch_incoherence hook); matches the other domains.',
      lastAfferentAt: gm.updated || now
    };
    s.governanceAfferent = af; return af;
  };

  // K2 — neuromodulatory gain application. Shows the graded output modulation implied by the
  // regulation gain/inhibition on the opportunity set (advisory; the E/I brake is the live effector).
  GovernanceBrain.prototype._computeGovernanceGainControl = function () {
    var s = this.state, gm = s.governanceModel || {}, reg = gm.regulation || {};
    var opps = s.opportunities || [];
    var outputScale = (typeof reg.outputScale === 'number') ? reg.outputScale : 1;
    var wouldCapAt = Math.max(1, Math.round(opps.length * outputScale));
    var gc = {
      version: 1,
      gain: (typeof reg.gain === 'number') ? reg.gain : null,
      inhibition: (typeof reg.inhibition === 'number') ? reg.inhibition : null,
      outputScale: outputScale,
      currentOpportunityCount: opps.length,
      wouldCapOpportunitiesAt: wouldCapAt,
      wouldSuppress: Math.max(0, opps.length - wouldCapAt),
      appliedTargets: ['predictedStress (gain-blend in _updateGovernanceModel)', 'emission confidence (via E/I brake)'],
      unappliedTargets: ['stress', 'treatment surfacing'],
      shadow: false,
      note: 'Advisory gain read; the live effector on emission is the servo -> E/I brake path. Neuro Ref XIII.1.',
      lastGainAt: gm.updated || Date.now()
    };
    s.governanceGainControl = gc; return gc;
  };

  // K3 — slow consolidation / long-term plasticity. Maintains a PARALLEL slow-weight track
  // (GM_SLOW_RATE) that never touches gm.prior; fast-vs-slow divergence is a regime-shift indicator.
  GovernanceBrain.prototype._consolidateGovernanceSlowModel = function () {
    var s = this.state, gm = s.governanceModel || {}, obs = gm.observation || null;
    var slow = s.governanceSlowModel || {
      version: 1, cycle: 0,
      slow: { expectedStress: 0.5, expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, samples: 0 },
      rate: GM_SLOW_RATE, note: 'parallel slow-weight track (GM_SLOW_RATE); does NOT touch gm.prior'
    };
    if (obs) {
      var r = GM_SLOW_RATE, w = slow.slow;
      w.expectedStress = _gmClamp(w.expectedStress + r * ((obs.stress || 0) - w.expectedStress), 0, 1);
      w.expectedSignal = _gmClamp(w.expectedSignal + r * ((obs.signal || 0) - w.expectedSignal), 0, 1);
      w.expectedDiagnosisCount = w.expectedDiagnosisCount + r * ((obs.diagnosisCount || 0) - w.expectedDiagnosisCount);
      w.expectedOpportunityCount = w.expectedOpportunityCount + r * ((obs.opportunityCount || 0) - w.expectedOpportunityCount);
      w.samples += 1;
      slow.cycle += 1;
    }
    var fast = (gm.prior && typeof gm.prior.expectedStress === 'number') ? gm.prior.expectedStress : 0.5;
    slow.fastSlowDivergence = Math.round(Math.abs(fast - slow.slow.expectedStress) * 1000) / 1000;
    slow.regimeShift = slow.fastSlowDivergence > 0.25;
    slow.updated = gm.updated || Date.now();
    s.governanceSlowModel = slow; return slow;
  };

  // K4 — outcome / credit learning (TRUTH BRAKE, self-consistency). Compares each cycle's
  // predictedStress against the NEXT cycle's realized stress. Measurement / calibration only —
  // a self-prediction hit-rate, NOT an external reward. This hit-rate feeds the central honest reward
  // gate (window.LIMENK4.credit) as a self-consistency calibration tier only — never ground-truth/dopaminergic reward.
  GovernanceBrain.prototype._scoreGovernanceOutcomes = function () {
    var s = this.state, gm = s.governanceModel || {};
    var buf = this._governanceOutcomeBuffer = this._governanceOutcomeBuffer || [];
    var obs = gm.observation || null;
    if (this._governancePrevPrediction != null && obs && typeof obs.stress === 'number') {
      buf.push({ predicted: this._governancePrevPrediction, realized: obs.stress, err: Math.abs(this._governancePrevPrediction - obs.stress) });
      if (buf.length > GK_OUTCOME_BUFFER) buf.shift();
    }
    this._governancePrevPrediction = (typeof gm.predictedStress === 'number') ? gm.predictedStress : null;
    var n = buf.length, sumErr = 0, sumSq = 0, hits = 0;
    for (var i = 0; i < n; i++) { sumErr += buf[i].err; sumSq += buf[i].err * buf[i].err; if (buf[i].err <= 0.1) hits++; }
    var om = {
      version: 1,
      samples: n,
      meanRealizedError: n ? Math.round((sumErr / n) * 1000) / 1000 : null,
      brierLike: n ? Math.round((sumSq / n) * 1000) / 1000 : null,
      hitRate: n ? Math.round((hits / n) * 100) / 100 : null,          // fraction within 0.1 of realized
      callHitRate: n ? Math.round((hits / n) * 100) / 100 : null,      // truth-brake calibration alias
      loopType: 'online-continuous truth-brake (predicted-vs-next-realized self-consistency); NOT an external reward',
      creditAssignmentActive: (n >= 5),
      note: 'SELF-CONSISTENCY calibration only. Governance is not a Thing1-validated kernel domain (fenced to Finance+Population); no ground-truth phase/dopamine reward is fabricated.',
      lastOutcomeAt: gm.updated || Date.now()
    };
    s.governanceOutcomeModel = om; return om;
  };

  // K5 — deep hierarchical perception. Aggregates the depth the brain HAS (L1 branch scan +
  // institutional-integrity sublayer, no new fetches) and estimates the portalError the recurrent
  // model currently zeroes out. L2 deep-cortex stays immune-quarantined (mostly synthetic).
  GovernanceBrain.prototype._computeGovernancePerceptionDepth = function () {
    var s = this.state, gm = s.governanceModel || {};
    var l1 = s._l1DepthCache || null;
    var sub = s.governanceInstitutionalIntegrityLayer || null;
    var l1Real = 0, l1Mad = 0;
    if (l1 && l1.byDiagnosis) { Object.keys(l1.byDiagnosis).forEach(function (k) { l1Real += (l1.byDiagnosis[k].realTreatments || 0); l1Mad += (l1.byDiagnosis[k].madLibTreatments || 0); }); }
    var subLoaded = !!(sub && (sub.loaded || sub.active || (sub.count || 0) > 0));
    var subCount = (sub && (sub.count || sub.activeCount)) || 0;
    var levels = [
      { level: 'L0', name: 'root', status: (this._portalCache || s._portalCache) ? 'loaded' : 'pending' },
      { level: 'L1', name: 'branch-scan', status: l1 ? 'scanned' : 'pending', realTreatments: l1Real, madLibTreatments: l1Mad },
      { level: 'L2', name: 'deep-cortex', status: 'quarantined', note: '~synthetic (immune-blocked)' },
      { level: 'SUB', name: 'institutional-integrity-sublayer', status: subLoaded ? 'loaded' : 'absent', activeCount: subCount }
    ];
    var loadedDepth = subLoaded ? 3 : (l1 ? 1 : 0);
    var admissible = l1Real + (subCount || 0);
    var blocked = l1Mad + 1;                                        // +1 for the quarantined L2 tier
    var portalErrorEstimate = Math.round((blocked / Math.max(1, admissible + blocked)) * 1000) / 1000;
    var pd = {
      version: 1, levels: levels, deepestUsableLevel: loadedDepth,
      portalErrorEstimate: portalErrorEstimate,
      note: 'Perception stops at L1 + the institutional-integrity sublayer (L2 quarantined); no new fetches. Estimates the portalError the recurrent model zeroes out.',
      lastDepthAt: gm.updated || Date.now()
    };
    s.governancePerceptionDepth = pd; return pd;
  };

  // K6 — attention / selective routing. Ranks top-down salience (active + relevance + novelty)
  // and names focus vs suppressed, plus any operator attention-focus steer. Advisory (does not gate).
  GovernanceBrain.prototype._computeGovernanceAttention = function () {
    var s = this.state, gm = s.governanceModel || {}, reg = gm.regulation || {};
    var pe = (gm.predictionError && gm.predictionError.total) || 0;
    var rb = this._readRequestBiases ? this._readRequestBiases() : { attentionFocus: [] };
    var focus = (rb.attentionFocus || []).map(function (f) { return String(f).toLowerCase(); });
    var scored = (s.diagnoses || []).map(function (d) {
      var sal = (d.active ? 0.5 : 0) + (d.relevance || 0) * 0.4 + pe * 0.1;
      var hay = (String(d.id) + ' ' + String(d.label || '')).toLowerCase();
      if (focus.some(function (f) { return f && hay.indexOf(f) !== -1; })) sal += 0.5;   // operator steer
      return { id: d.id, active: !!d.active, salience: Math.round(sal * 1000) / 1000 };
    }).sort(function (a, b) { return b.salience - a.salience; });
    var at = {
      version: 1,
      driver: reg.state === 'surprised' ? 'novelty-driven (bottom-up)' : 'goal-driven (top-down)',
      focus: scored.slice(0, 3),
      suppressed: scored.slice(3).map(function (x) { return x.id; }).slice(0, 8),
      broadenUnderSurprise: reg.state === 'surprised',
      note: 'Top-down salience ranking over active diagnoses; broadens under surprise. Advisory (no pipeline gate).',
      lastAttentionAt: gm.updated || Date.now()
    };
    s.governanceAttention = at; return at;
  };

  // K7 — lateral inhibition (microcircuit). Shows the winner-take-most ranking reg.inhibition implies
  // among competing active diagnoses (non-winners down-weighted proportionally to inhibition).
  GovernanceBrain.prototype._computeGovernanceInhibition = function () {
    var s = this.state, gm = s.governanceModel || {}, reg = gm.regulation || {};
    var inhib = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;
    var active = (s.diagnoses || []).filter(function (d) { return d.active; })
      .sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var winner = active[0] || null;
    var li = {
      version: 1, inhibitionStrength: inhib,
      winner: winner ? winner.id : null,
      competitors: active.slice(1).map(function (d) { return { id: d.id, relevance: d.relevance, suppressBy: Math.round((d.relevance || 0) * inhib * 1000) / 1000 }; }).slice(0, 6),
      note: 'Winner-take-most among active diagnoses; competitor down-weighting = relevance * inhibition. Neuro Ref XIII.1.',
      lastInhibitionAt: gm.updated || Date.now()
    };
    s.governanceInhibition = li; return li;
  };

  // K8 — homeostatic set-point (microcircuit). Maintains an adaptive stress baseline (Turrigiano-style
  // synaptic scaling) alongside the fixed GM_STRESS_FLOOR. Also APPENDS to memory.stressHistory so the
  // existing servo's allostatic-deviation arm has a real rolling baseline to read. Deterministic; once
  // per cycle (dedup on gm.updated). Never replaces the fixed floor.
  GovernanceBrain.prototype._computeGovernanceHomeostasis = function () {
    var s = this.state, gm = s.governanceModel || {};
    var mem = s.memory || (s.memory = {});
    var hist = mem.stressHistory || (mem.stressHistory = []);
    var cur = (typeof s.stress === 'number') ? s.stress : 0;
    var stamp = gm.updated || Date.now();
    // append once per cycle (guard against double-invocation within the same model update)
    if (!hist.length || hist[hist.length - 1]._t !== stamp) {
      hist.push({ stress: cur, _t: stamp });
      if (hist.length > 240) hist.shift();
    }
    var win = hist.slice(-GK_HOMEO_WINDOW);
    var n = win.length, sum = 0;
    for (var i = 0; i < n; i++) sum += (win[i].stress || 0);
    var baseline = n ? sum / n : 0.5;                              // adaptive set-point vs fixed GM_STRESS_FLOOR
    var scalingFactor = baseline > 0 ? Math.round((0.5 / Math.max(0.1, baseline)) * 1000) / 1000 : 1;
    var hm = {
      version: 1,
      fixedFloor: GM_STRESS_FLOOR,
      adaptiveBaseline: Math.round(baseline * 1000) / 1000,
      currentStress: cur,
      deviationFromBaseline: Math.round((cur - baseline) * 1000) / 1000,
      scalingFactor: scalingFactor,                                // synaptic-scaling multiplier
      samples: n,
      note: 'Adaptive baseline (Turrigiano scaling) alongside the fixed GM_STRESS_FLOOR; also feeds the servo allostatic-deviation arm via memory.stressHistory. Neuro Ref V.2/XII.',
      lastHomeostasisAt: gm.updated || Date.now()
    };
    s.governanceHomeostasis = hm; return hm;
  };

  // Orchestrator — runs the K1..K8 loops in Energy's exact order. Called from _updateGovernanceModel
  // BEFORE _computeGovernanceActuation so K8's stress-history is fresh for the servo. Each layer is
  // additive on state; the roll-up attaches to state.cognition under a new `neuro` key (existing keys
  // untouched). Fully deterministic — no network / AI. Reversible: guarded try/catch at the call site.
  GovernanceBrain.prototype._computeGovernanceNeuroLayers = function () {
    this._computeGovernanceAfferent();          // K1 — afferent inter-brain input
    this._computeGovernanceGainControl();       // K2 — neuromodulatory gain application
    this._consolidateGovernanceSlowModel();     // K3 — slow consolidation / long-term plasticity
    this._scoreGovernanceOutcomes();            // K4 — outcome / credit learning (truth-brake self-consistency)
    this._computeGovernancePerceptionDepth();   // K5 — deep hierarchical perception
    this._computeGovernanceAttention();         // K6 — attention / selective routing
    this._computeGovernanceInhibition();        // K7 — lateral inhibition (microcircuit)
    this._computeGovernanceHomeostasis();       // K8 — adaptive set-point (microcircuit)
    var s = this.state;
    var neuro = {
      version: 1,
      status: 'advisory',                        // K-loops compute + expose; live emission effector stays the servo/E-I brake
      afferent: s.governanceAfferent || null,
      gainControl: s.governanceGainControl || null,
      slowModel: s.governanceSlowModel || null,
      outcomeModel: s.governanceOutcomeModel || null,
      perceptionDepth: s.governancePerceptionDepth || null,
      attention: s.governanceAttention || null,
      inhibition: s.governanceInhibition || null,
      homeostasis: s.governanceHomeostasis || null
    };
    s.governanceNeuro = neuro;
    if (s.cognition && typeof s.cognition === 'object') s.cognition.neuro = neuro;   // additive: new key only
    return neuro;
  };

  // ── AI SLOT (documented, INERT stub — NEVER called from the cycle) ─────────────────────────────
  // Node->business authoring / semantic mapping is a genuine "code-cannot-do-this" slot. Per the
  // killswitch requirement it is DELIBERATELY not wired to a live call: it is never invoked from
  // cycle()/_updateGovernanceModel/_computeGovernanceActuation (grep-verifiable), so the deterministic
  // 30s cycle can never trigger paid AI. When the operator wires this, it MUST (a) run only on an explicit
  // operator trigger, (b) POST to a SERVER endpoint that enforces lib/ai-kill-switch spendDisabled(),
  // and (c) carry NO API key in client code. Until then it is a no-op returning its contract.
  GovernanceBrain.prototype.authorGovernanceNodeBusiness = function (nodeId, opts) {
    return {
      ok: false, stub: true, nodeId: nodeId || null, operatorTriggered: !!(opts && opts.operatorTriggered),
      reason: 'documented AI slot; intentionally inert until wired to a killswitch-gated /api endpoint by explicit operator action (never runs on the cycle)'
    };
  };

  // ════════════════════════════════════════════════════════════════════════════
  // GOVERNANCE COGNITION PARITY — fallback loaders, source-bundle machinery, L1
  // mad-lib scan, institutional-integrity sub-portal layer, and the 8-section
  // DomainDiagnosisPacket the console SELF-MODEL consumes. Mirrors culture/energy
  // STRUCTURE exactly; only the CONTENT is governance (institutions & indicators,
  // public policy & rulemaking, regulation & oversight, elections, public finance,
  // rule of law & institutional integrity). Real govtech/index identifiers only.
  // Never fabricates evidence.
  // ════════════════════════════════════════════════════════════════════════════

  // ── DDP schema helpers ──
  var GOV_DDP_SCHEMA_VERSION = 'governance-ddp-1';
  function _govDdpPresent(v) {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (v === 'missing' || v === '' || v === 'none') return false;
    return true;
  }
  function _govDdpCompleteness(section, keys) {
    var have = 0; for (var i = 0; i < keys.length; i++) { if (_govDdpPresent(section[keys[i]])) have++; }
    return { have: have, total: keys.length, pct: keys.length ? Math.round(have / keys.length * 100) : 0 };
  }

  // ── Fallback: REAL govtech / public-sector entities (state.companies starved).
  //    Governance binds mostly to INSTITUTIONS & INDICATORS, not single companies;
  //    where entities are needed these are real, listed, public-sector-exposed operators.
  //    Prefer command-board-data (d='governance' && ticker); else this curated real map. ──
  var GOV_REAL_OPERATORS = [
    { ticker: 'TYL', name: 'Tyler Technologies', type: 'govtech', domain: 'governance', governance_focus: 'county/municipal administration & courts modernization' },
    { ticker: 'MMS', name: 'Maximus', type: 'govtech', domain: 'governance', governance_focus: 'human-services & public-benefits administration' },
    { ticker: 'BAH', name: 'Booz Allen Hamilton', type: 'govtech', domain: 'governance', governance_focus: 'federal digital modernization & analytics' },
    { ticker: 'LDOS', name: 'Leidos', type: 'govtech', domain: 'governance', governance_focus: 'federal IT, civil & defense systems' },
    { ticker: 'ACN', name: 'Accenture (Federal Services)', type: 'govtech', domain: 'governance', governance_focus: 'public-sector digital transformation' },
    { ticker: 'GDIT', name: 'General Dynamics Information Technology', type: 'govtech', domain: 'governance', governance_focus: 'federal IT, mission & enterprise services' }
  ];
  // Real institutional / index sources (evidence-anchor authoring targets; NOT companies).
  var GOV_INDEX_SOURCES = ['GAO', 'CBO', 'OMB', 'Federal Register', 'regulations.gov', 'Congress.gov', 'GovTrack', 'World Bank WGI', 'V-Dem', 'OECD', 'Congressional Research Service', 'Brennan Center', 'POGO'];

  GovernanceBrain.prototype._loadGovernanceOperators = function () {
    var self = this;
    if (self._governanceOperators) return;            // one-shot
    self._governanceOperators = GOV_REAL_OPERATORS.slice();   // curated real default; merged with command-board below
    try {
      fetch('/assets/data/command-board-data.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data) return;
          var arr = Array.isArray(data) ? data : (Object.keys(data).map(function (k) { return data[k]; }).find(Array.isArray) || []);
          var cb = arr
            .filter(function (x) { return x && x.d === 'governance' && x.t; })
            .map(function (x) { return { name: x.n, ticker: x.t, cik: x.c, phase: x.p, trajectory: x.tr, type: 'govtech', domain: 'governance' }; });
          if (cb.length) {
            var seen = {}; self._governanceOperators.forEach(function (o) { seen[o.ticker] = true; });
            cb.forEach(function (o) { if (!seen[o.ticker]) { seen[o.ticker] = true; self._governanceOperators.push(o); } });
          }
        })
        .catch(function () {});
    } catch (e) {}
  };

  // ── Distress signals come ONLY from the validated Thing pipeline. One-shot. ──
  GovernanceBrain.prototype._loadGovernanceBrainSignals = function () {
    var self = this;
    if (self._pubSignals) return;                  // one-shot
    self._pubSignals = {};
    try {
      fetch('/api/brain-signals?domain=governance')
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
  //    else GOV_DIAGNOSIS_ALIASES. Non-aliased diagnoses are canonical to themselves. ──
  var GOV_DIAGNOSIS_ALIASES = {
    CONSTITUTIONAL_CRISIS: { target: 'INSTITUTIONAL_LEGITIMACY_CRISIS', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits INSTITUTIONAL_LEGITIMACY_CRISIS for constitutional/separation-of-powers stress' },
    REGIME_INSTABILITY:    { target: 'POLITICAL_STABILITY_EROSION', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits POLITICAL_STABILITY_EROSION for leadership/confidence collapse' },
    POLICY_FAILURE:        { target: 'POLICY_IMPLEMENTATION_FAILURE', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits POLICY_IMPLEMENTATION_FAILURE for fragmented/contradictory execution' },
    CORRUPTION_SCANDAL:    { target: 'INTEGRITY_BREACH', reviewStatus: 'human-approved', risk: 'medium', note: 'mapped to integrity-breach bundle; verify oversight/IG evidence is appropriate before strong claims' },
    DIPLOMATIC_BREAKDOWN:  { target: 'DIPLOMATIC_RUPTURE_EVENT', reviewStatus: 'human-approved', risk: 'medium', note: 'mapped to diplomatic-rupture bundle; verify treaty/alliance evidence is appropriate' },
    MILITARY_OVERREACH:    { target: 'CIVIL_MILITARY_IMBALANCE', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits CIVIL_MILITARY_IMBALANCE for defense overcommit / civil-military tension' }
  };
  GovernanceBrain.prototype._resolveGovernanceCanonicalDiagnosis = function (dxId) {
    if (!dxId) return { canonicalDiagnosisId: null, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };
    var target = null;
    try {
      var idx = (typeof window !== 'undefined') ? window.LIMENArtifactSourceIndex : null;
      if (idx && idx.aliases) { var row = idx.aliases()[dxId]; if (row && row.target) target = row.target; }
    } catch (e) {}
    var local = GOV_DIAGNOSIS_ALIASES[dxId] || null;
    if (!target && local) target = local.target;
    if (target) {
      return { canonicalDiagnosisId: target, aliasUsed: true, aliasReviewStatus: (local && local.reviewStatus) || 'corpus-aliased', aliasRisk: (local && local.risk) || 'low', aliasNote: (local && local.note) || null };
    }
    return { canonicalDiagnosisId: dxId, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };   // canonical to self
  };

  // ── Load REAL source bundles (one-shot, async). Resolves aliases BEFORE fetching.
  //    Only files that exist resolve to 'found'; 404s -> 'missing'. Never fabricates. ──
  GovernanceBrain.prototype._loadGovernanceDiagnosisBundles = function () {
    var self = this;
    if (self._governanceBundleLoadPromise) return self._governanceBundleLoadPromise;
    self._bundleCache = self._bundleCache || {};
    self._bundleStatusMap = self._bundleStatusMap || {};
    var ids = {};
    var known = ['CONSTITUTIONAL_CRISIS', 'REGIME_INSTABILITY', 'POLICY_FAILURE', 'CORRUPTION_SCANDAL', 'DIPLOMATIC_BREAKDOWN', 'MILITARY_OVERREACH'];
    var diags = (self.state && self.state.diagnoses) || [];
    var allDxIds = diags.map(function (d) { return d.id; }).concat(known);
    for (var i = 0; i < allDxIds.length; i++) { var c = self._resolveGovernanceCanonicalDiagnosis(allDxIds[i]).canonicalDiagnosisId; if (c) ids[c] = true; }
    self._governanceBundleLoadPromise = Promise.all(Object.keys(ids).map(function (cid) {
      return fetch('/assets/data/artifact-source-index/by-diagnosis/' + encodeURIComponent(cid) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) { self._bundleStatusMap[cid] = data ? 'found' : 'missing'; if (data) self._bundleCache[cid] = data; })
        .catch(function () { self._bundleStatusMap[cid] = 'missing'; });
    })).then(function () { return self._bundleCache; });
    return self._governanceBundleLoadPromise;
  };

  // ── _governanceBundleStates — per-diagnosis canonical resolution + bundle status + provenance ──
  GovernanceBrain.prototype._governanceBundleStates = function () {
    var self = this; var diags = (this.state && this.state.diagnoses) || [];
    return diags.map(function (d) {
      var c = self._resolveGovernanceCanonicalDiagnosis(d.id);
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
  //    evidence. Only real govtech/public-sector identifiers surface (relevance-unverified). ──
  var GOV_MADLIB_VERB = /^(Develop|Establish|Implement|Build|Launch|Design|Deploy|Operationalize|Conduct|Create|Define|Assess|Optimize|Modernize|Strengthen|Enhance|Formalize|Institute|Standardize|Coordinate|Integrate|Calibrate|Evaluate|Streamline|Institutionalize|Configure|Monitor|Reform|Audit|Oversee)\b/;
  GovernanceBrain.prototype._isGovernanceMadLibTreatment = function (label) { return !label || GOV_MADLIB_VERB.test(String(label)); };

  GovernanceBrain.prototype._loadGovernanceL1PortalDepth = function () {
    var self = this;
    if (self._governanceL1LoadPromise) return self._governanceL1LoadPromise;
    // Map each canonical diagnosis to REAL governance sub-portal branch files that exist on disk.
    var BRANCH = {
      CONSTITUTIONAL_CRISIS: ['federalism_fedstate', 'federalism_stateauton', 'humanrights_dueprocess'],
      REGIME_INSTABILITY: ['electoral_results', 'electoral_voting', 'civicpart_voterengg'],
      POLICY_FAILURE: ['digitalgov_egovplat', 'digitalgov_digservstd', 'intergovt_coopfed'],
      CORRUPTION_SCANDAL: ['anticorruption_corruptidx', 'anticorruption_procintegr', 'govaudit_intaudit'],
      DIPLOMATIC_BREAKDOWN: ['diplomatic_foreignaid'],
      MILITARY_OVERREACH: ['intelligence_oversight', 'crisis_martiallaw']
    };
    self._governanceL1Branches = BRANCH;
    var branches = {}; Object.keys(BRANCH).forEach(function (dx) { BRANCH[dx].forEach(function (b) { branches[b] = true; }); });
    var byBranch = {};
    self._governanceL1LoadPromise = Promise.all(Object.keys(branches).map(function (b) {
      return fetch('/assets/data/domains/governance_' + encodeURIComponent(b) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) {
          if (!data) { byBranch[b] = null; return; }
          var acts = data.activations || [], tickers = {}, total = 0, mad = 0;
          acts.forEach(function (a) {
            (a.companies || []).forEach(function (c) { if (c && c.ticker_or_id) tickers[c.ticker_or_id] = c.name || c.ticker_or_id; });
            (a.treatments || []).forEach(function (t) { var l = t && (t.label || t.title); if (l) { total++; if (self._isGovernanceMadLibTreatment(l)) mad++; } });
          });
          byBranch[b] = { file: 'governance_' + b, companyTickers: Object.keys(tickers).map(function (k) { return { ticker: k, name: tickers[k] }; }), treatmentTotal: total, madLibCount: mad, realTreatmentCount: total - mad };
        })
        .catch(function () { byBranch[b] = null; });
    })).then(function () {
      var byDiagnosis = {};
      Object.keys(BRANCH).forEach(function (dx) {
        var tk = {}, total = 0, mad = 0, scanned = 0;
        BRANCH[dx].forEach(function (b) { var r = byBranch[b]; if (r) { scanned++; r.companyTickers.forEach(function (c) { tk[c.ticker] = c.name; }); total += r.treatmentTotal; mad += r.madLibCount; } });
        byDiagnosis[dx] = { branchesScanned: scanned, realCompanyTickers: Object.keys(tk).map(function (k) { return { ticker: k, name: tk[k], relevanceUnverified: true }; }), treatmentTotal: total, madLibTreatments: mad, realTreatments: total - mad, admitted: false, reason: 'L1 treatments are mad-lib templates (fixed-verb family) — not source-grade; only govtech/public-sector identifiers surfaced, relevance unverified' };
      });
      self.state._l1DepthCache = { byBranch: byBranch, byDiagnosis: byDiagnosis, scannedAt: (self.state.governanceModel && self.state.governanceModel.updated) || null };
      return self.state._l1DepthCache;
    });
    return self._governanceL1LoadPromise;
  };

  // ── INSTITUTIONAL-INTEGRITY sub-portal layer (counterpart to energy's data-center;
  //    culture's music-scene). Real-content, citation-backed institutional-integrity
  //    diagnoses + treatments (agency coordination failures, policy-implementation gaps,
  //    regulatory capture, institutional reform). NEVER merged into the validated 6-diagnosis
  //    spine. Prefer a dedicated hand-authored governance_institutional-integrity.json; fall
  //    back to the real internal-audit sub-portal (governance_govaudit_intaudit). Graceful 404. ──
  GovernanceBrain.prototype._loadGovernanceInstitutionalIntegritySublayer = function () {
    var self = this;
    if (self._governanceIILoadPromise) return self._governanceIILoadPromise;
    self._governanceIILoadPromise = fetch('/assets/data/domains/governance_institutional-integrity.json')
      .then(function (r) { return (r && r.ok) ? r.json() : null; })
      .then(function (data) { if (data) return data; return fetch('/assets/data/domains/governance_govaudit_intaudit.json').then(function (r2) { return (r2 && r2.ok) ? r2.json() : null; }); })
      .then(function (data) {
        if (!data) { self._iiPortal = null; return null; }
        self._iiPortal = { issues: data.issues || [], activations: data.activations || [], title: data.title || 'Institutional Integrity' };
        return self._iiPortal;
      })
      .catch(function () { self._iiPortal = null; return null; });
    return self._governanceIILoadPromise;
  };

  GovernanceBrain.prototype._buildGovernanceInstitutionalIntegritySublayer = function () {
    var self = this;
    var ii = self._iiPortal;
    if (!ii || !ii.issues || !ii.issues.length) {
      self.state.governanceInstitutionalIntegrityDiagnoses = [];
      self.state.governanceInstitutionalIntegrityTreatments = [];
      self.state.governanceInstitutionalIntegrityDomainDiagnosisPackets = [];
      self.state.governanceInstitutionalIntegrityLayer = { loaded: false, count: 0, activeCount: 0, diagnoses: [], note: 'governance institutional-integrity sub-portal not loaded (offline or fetch failed)' };
      return self.state.governanceInstitutionalIntegrityLayer;
    }
    var conditions = self._activeConditions || [];
    // 1) diagnoses — same condition-match logic as the canonical spine
    var diagnoses = ii.issues.map(function (iss) {
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
        source: 'institutional-integrity', tier: 'real-content-unbundled', branch: 'institutional-integrity'
      };
    });
    // 2) treatments — pull from sub-portal node activations whose brainNodeId is in a diagnosis circuit
    var nodeToDx = {};
    diagnoses.forEach(function (d) { (d.circuits || []).forEach(function (c) { if (c && c.nodeId) nodeToDx[c.nodeId] = d.id; }); });
    var treatments = [];
    (ii.activations || []).forEach(function (act) {
      var dxId = nodeToDx[act.brainNodeId];
      if (!dxId) return;
      (act.treatments || []).forEach(function (t, ti) {
        treatments.push({
          id: 'ii_treat_' + act.brainNodeId + '_' + ti,
          label: t.label, type: t.type, evidence: t.evidence, description: t.description || '',
          cite: t.cite || null, citation: t.citation || [], steps: t.steps || [],
          diagnosisId: dxId, nodeId: act.brainNodeId,
          source: 'institutional-integrity', madLib: self._isGovernanceMadLibTreatment ? self._isGovernanceMadLibTreatment(t.label) : false
        });
      });
    });
    var evidenceRank = { A: 10, Strong: 10, B: 7, Moderate: 7, C: 4, Emerging: 1 };
    treatments.sort(function (a, b) { return (evidenceRank[b.evidence] || 0) - (evidenceRank[a.evidence] || 0); });
    self.state.governanceInstitutionalIntegrityDiagnoses = diagnoses;
    self.state.governanceInstitutionalIntegrityTreatments = treatments;
    // 3) compact layer summary (read by every DDP's promptView)
    self.state.governanceInstitutionalIntegrityLayer = {
      loaded: true,
      portalTitle: ii.title,
      count: diagnoses.length,
      activeCount: diagnoses.filter(function (d) { return d.active; }).length,
      diagnoses: diagnoses.map(function (d) {
        var rc = self._resolveGovernanceCanonicalDiagnosis ? self._resolveGovernanceCanonicalDiagnosis(d.id) : { canonicalDiagnosisId: d.id };
        var bsStat = (self._bundleStatusMap && self._bundleStatusMap[rc.canonicalDiagnosisId]) || 'missing';
        return { id: d.id, label: d.label, active: d.active, branch: 'institutional-integrity', canonicalDiagnosisId: rc.canonicalDiagnosisId, bundleStatus: bsStat, treatmentCount: treatments.filter(function (t) { return t.diagnosisId === d.id; }).length };
      }),
      note: 'real-content (hand-authored, citation-backed) institutional-integrity sub-portal — agency coordination failures, policy-implementation gaps, regulatory capture, institutional reform; SEPARATE from the validated 6-diagnosis spine; no external artifact-source bundle yet (build-required); never admitted to evidenceAnchors'
    };
    // 4) per-diagnosis DDPs via the SAME schema builder (canonical-to-self; bundle 'missing')
    self.state.governanceInstitutionalIntegrityDomainDiagnosisPackets = diagnoses.map(function (d) {
      try { return self._buildDomainDiagnosisPacket(d); } catch (e) { return null; }
    }).filter(Boolean);
    return self.state.governanceInstitutionalIntegrityLayer;
  };

  // ── DDP — the 8-section DomainDiagnosisPacket the console SELF-MODEL consumes.
  //    Mirrors culture/energy _buildDomainDiagnosisPacket exactly; CONTENT is governance. ──
  GovernanceBrain.prototype._buildDomainDiagnosisPacket = function (dx) {
    var s = this.state || {};
    var gm = s.governanceModel || {};
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

    var _canon = this._resolveGovernanceCanonicalDiagnosis(dxId);
    var identity = {
      domain: 'governance',
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
      governanceModel: { version: gm.version || null, cycle: (typeof gm.cycle === 'number' ? gm.cycle : null) },
      predictionError: gm.predictionError || null,
      regulationState: (gm.regulation && gm.regulation.state) || null,
      prior: gm.prior || null,
      observation: gm.observation || null,
      plasticity: gm.plasticity || null,
      readyForHandoff: gm.readyForHandoff === true
    };
    // Domain-identity portal fields are KNOWN facts (this IS the governance root).
    var rootId = (portal && portal.domainId) || 'governance';
    var rootTitle = (portal && portal.title) || 'Governance';
    var ancestry = (portal && portal.parentLabel) ? [portal.parentLabel, rootTitle] : [rootTitle];
    var portalContext = {
      portalIds: [rootId],
      portalDomain: 'governance',
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
    // citationHints — real source/feed names; backfill with institutional index sources (real, named).
    var citationHints = sourceFeeds.map(function (sf) { return sf.source || sf.name; }).filter(Boolean);
    if (!citationHints.length) citationHints = GOV_INDEX_SOURCES.slice();
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
    // empty slots (what each needs + which GOVERNANCE primary/institutional source) — never fabricated.
    var _isExternal = !!(_bundle && _bundle.buildMethod === 'external-source-authored');
    var _intakeSrcHint = {
      INSTITUTIONAL_LEGITIMACY_CRISIS: 'Federal Register / Congress.gov legislative history / Brennan Center / CRS constitutional-law reports',
      POLITICAL_STABILITY_EROSION: 'World Bank WGI (voice & accountability, political stability) / V-Dem / approval & confidence series',
      POLICY_IMPLEMENTATION_FAILURE: 'CBO cost & implementation estimates / OMB execution data / GAO program-evaluation reports',
      INTEGRITY_BREACH: 'GAO oversight findings / POGO investigations / Inspector-General referrals / ethics-commission actions',
      DIPLOMATIC_RUPTURE_EVENT: 'State Dept. reports / USTR filings / treaty databases / UN voting records',
      CIVIL_MILITARY_IMBALANCE: 'GAO defense reports / Congressional armed-services committee reports / DoD budget justifications'
    };
    var authoringIntake = [];
    if (_isExternal) {
      ['methodCandidates', 'embodimentCandidates', 'figurePlaceholders'].forEach(function (field) {
        if (_bArr(field).length === 0) authoringIntake.push({ field: field, status: 'needs-human-input', count: 0, need: field === 'methodCandidates' ? 'a concrete institutional/policy method drawn from a primary source' : field === 'embodimentCandidates' ? 'a specific implementation/embodiment from a real document' : 'a figure description grounded in a real source', sourceHint: _intakeSrcHint[identity.canonicalDiagnosisId] || 'primary institutional / governance-index source', note: 'NOT fabricated by the brain — author from the cited source, then wire in verbatim with attribution' });
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
    // operator targets — prefer the opportunity's resolved targets / moneyChain target; else REAL
    // govtech operators (never generic). Governance binds to institutions & indicators primarily.
    var _opTargets = (primaryOpp && primaryOpp._resolvedTargets) ? primaryOpp._resolvedTargets : (mc && mc.target ? [mc.target] : []);
    if (!_opTargets.length && this._governanceOperators && this._governanceOperators.length) {
      _opTargets = this._governanceOperators.slice(0, 4).map(function (o) { return o.name + ' (' + o.ticker + ') — ' + (o.governance_focus || o.type); });
    }
    var operatorContext = {
      targets: _opTargets,
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
    // Lanes are INVESTABLE (govtech operators / public-sector entities) / RESEARCHABLE (policy briefs).
    // patent/grant are VETOED by conscience (lanes retired 2026-06-21; no method/embodiment fields).
    var artifactContext = {
      artifactLanes: artifactLanes,
      patentReady: false, grantReady: false, sbaReady: false,   // patent/grant/loan vetoed by H3 conscience
      investmentReady: !!(hasTreat && primaryOpp), researchReady: ready || hasTreat,
      readinessReasons: readinessReasons,
      blockers: blockers
    };

    var comp = {
      identity:         _govDdpCompleteness(identity, ['domain', 'diagnosisId', 'canonicalDiagnosisId', 'label', 'phase', 'confidence']),
      brainState:       _govDdpCompleteness(brainState, ['governanceModel', 'predictionError', 'regulationState', 'prior', 'observation', 'plasticity']),
      portalContext:    _govDdpCompleteness(portalContext, ['portalIds', 'portalDomain', 'portalTitle', 'depth', 'ancestryPath']),
      evidence:         _govDdpCompleteness(evidence, ['sourceFeeds', 'evidenceAnchors', 'citationHints']),
      treatmentContext: _govDdpCompleteness(treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']),
      operatorContext:  _govDdpCompleteness(operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']),
      artifactContext:  _govDdpCompleteness(artifactContext, ['artifactLanes'])
    };
    var totHave = 0, totAll = 0;
    for (var sk in comp) { if (comp.hasOwnProperty(sk)) { totHave += comp[sk].have; totAll += comp[sk].total; } }
    var missingFields = [];
    function _gmf(name, obj, keys) { for (var i = 0; i < keys.length; i++) { if (!_govDdpPresent(obj[keys[i]])) missingFields.push(name + '.' + keys[i]); } }
    _gmf('identity', identity, ['canonicalDiagnosisId', 'confidence']);
    _gmf('evidence', evidence, ['evidenceAnchors', 'citationHints']);
    _gmf('treatmentContext', treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']);
    _gmf('operatorContext', operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']);

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
    if (!primaryOpp && (typeof s.stress !== 'number' || s.stress < GM_STRESS_FLOOR)) warnings.push('no active opportunity (offline/low-stress) — operator/lane fields stay empty');
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
        'diagnosis-specific bundle anchors preferred over generic governance evidence',
        'official/primary institutional sources retained (GAO/CBO/OMB/Federal Register/World Bank WGI/V-Dem where present); partisan feeds positional-only',
        'mechanisms prioritized over figures under prompt-space limits',
        'treatments with implementation relevance preferred over broad narrative',
        'caps applied per field; full data preserved in the stored bundle + full DDP'
      ],
      retainedWarnings: warnings
        .concat(s.governanceImmune ? ['immune: ' + s.governanceImmune.immuneState + ' (sev ' + s.governanceImmune.severity + ', ' + (s.governanceImmune.antigens || []).length + ' antigens; L2 traversal blocked)'] : [])
        .concat(s.governanceConscience && s.governanceConscience.conscienceState === 'restrictive' ? ['conscience: ' + (s.governanceConscience.blockedClaims || []).slice(0, 3).join(', ') + ' blocked'] : []),
      retainedBlockers: artifactContext.blockers,
      // higher-layer compact summaries (forwarded to the finalizer via promptView)
      immuneSummary: s.governanceImmune ? { immuneState: s.governanceImmune.immuneState, severity: s.governanceImmune.severity, antigenCount: (s.governanceImmune.antigens || []).length, quarantines: s.governanceImmune.quarantines, blockedFromTraversal: s.governanceImmune.blockedFromTraversal, allowedWithWarning: s.governanceImmune.allowedWithWarning } : null,
      awarenessSummary: s.governanceAwareness ? { selfNarrative: s.governanceAwareness.selfNarrative, knowns: (s.governanceAwareness.knowns || []).length, uncertainties: (s.governanceAwareness.uncertainties || []).length } : null,
      conscienceDecision: s.governanceConscience ? { conscienceState: s.governanceConscience.conscienceState, blockedClaims: s.governanceConscience.blockedClaims, artifactReadinessDecision: s.governanceConscience.artifactReadinessDecision } : null,
      intuitionSummary: s.governanceIntuition ? s.governanceIntuition.hunches : null,
      scenarioSummary: s.governanceSimulation ? (s.governanceSimulation.scenarios || []).map(function (x) { return { type: x.type, hypothetical: x.hypothetical, risk: x.risk }; }) : null,
      executiveReport: s.governanceExecutiveReport || null,
      l1DepthSummary: portalContext.l1Depth ? { realCompanyTickers: (portalContext.l1Depth.realCompanyTickers || []).length, realTreatments: portalContext.l1Depth.realTreatments, madLibTreatments: portalContext.l1Depth.madLibTreatments, admitted: portalContext.l1Depth.admitted } : null,
      authoringIntake: treatmentContext.authoringIntake.length ? treatmentContext.authoringIntake : null,
      // INSTITUTIONAL-INTEGRITY — sub-portal layer (real-content, SEPARATE from the validated spine, no bundle yet)
      institutionalIntegritySummary: s.governanceInstitutionalIntegrityLayer && s.governanceInstitutionalIntegrityLayer.loaded ? { count: s.governanceInstitutionalIntegrityLayer.count, activeCount: s.governanceInstitutionalIntegrityLayer.activeCount, diagnoses: s.governanceInstitutionalIntegrityLayer.diagnoses, note: s.governanceInstitutionalIntegrityLayer.note } : null
    };

    return {
      schemaVersion: GOV_DDP_SCHEMA_VERSION,
      promptView: promptView,
      identity: identity,
      brainState: brainState,
      portalContext: portalContext,
      evidence: evidence,
      treatmentContext: treatmentContext,
      operatorContext: operatorContext,
      artifactContext: artifactContext,
      audit: {
        generatedAt: (gm.updated || null),
        schemaVersion: GOV_DDP_SCHEMA_VERSION,
        fieldCompleteness: { sections: comp, overallPct: pct },
        missingFields: missingFields,
        warnings: warnings,
        proofTier: proofTier,
        immune: s.governanceImmune || null,
        awareness: s.governanceAwareness || null,
        conscience: s.governanceConscience || null,
        intuition: s.governanceIntuition || null,
        simulation: s.governanceSimulation || null,
        executiveReport: s.governanceExecutiveReport || null
      }
    };
  };

  var brain = new GovernanceBrain(); brain.init(); brain.start();
  window.LIMENGovernanceBrain = brain;
  window.LIMENDomainBrains.register(brain);

  // ══════════════════════════════════════════════════════════════════════
  // AUTO-LOAD GOVERNANCE OPERATOR STACK ON DOMAIN-CONSOLE
  // ══════════════════════════════════════════════════════════════════════

  var _isDomainConsole = window.location.pathname.indexOf('domain-console') !== -1 || window.location.pathname.indexOf('governance-console') !== -1;
  var _domParam = (new URLSearchParams(window.location.search)).get('domain');
  var _isGovernanceDomain = _domParam === 'governance';
  if (_isDomainConsole && _isGovernanceDomain) {
    window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION = true;

    var _governanceScripts = [
      'assets/js/governance-compensation.js',
      'assets/js/governance-claim-ledger.js',
      'assets/js/governance-claim-flow.js',
      'assets/js/governance-opportunity-economics.js',
      'assets/js/governance-pulse-engine.js',
      'assets/js/governance-operator-panel.js',
      'assets/js/governance-node-business-engine.js',
      'assets/js/governance-business-review.js',
      'assets/js/governance-execution-panels.js',
      'assets/js/governance-business-build.js',
      'assets/js/governance-directive-extractor.js',
      'assets/js/governance-directive-ranker.js',
      'assets/js/governance-directive-translator.js',
      'assets/js/governance-targeting-engine.js',
      'assets/js/governance-promotion-bridge.js',
      'assets/js/governance-clarity-operator.js'
    ];
    (function loadNext(i) {
      if (i >= _governanceScripts.length) return;
      var s = document.createElement('script');
      s.src = _governanceScripts[i];
      s.onload = function () { loadNext(i + 1); };
      s.onerror = function () { console.warn('[GovernanceBrain] Failed to load ' + _governanceScripts[i]); loadNext(i + 1); };
      document.head.appendChild(s);
    })(0);
  }
})();
