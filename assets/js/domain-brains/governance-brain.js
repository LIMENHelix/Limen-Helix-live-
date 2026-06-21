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
    for (var i = 0; i < activeDx.length; i++) {
      var dx = activeDx[i];
      if (adapters.getDrafts && adapters.getDrafts({ domain: 'governance', intentId: dx.id }).length > 0) continue;
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
  GovernanceBrain.prototype.cycle = function () { var self = this; return _origCycle.call(this).then(function () { return self.resolveDeepContent(); }); };

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
