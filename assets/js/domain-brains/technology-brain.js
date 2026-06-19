/**
 * technology-brain.js — Technology Domain Cognitive Engine
 *
 * Portal issues: CYBER_ATTACK, AI_ALIGNMENT_FAILURE, INFRASTRUCTURE_COLLAPSE,
 *                DATA_BREACH, CHIP_SHORTAGE, PLATFORM_MONOPOLY
 *
 * Emissions: finance, defense, communication, governance, infrastructure
 * Exposes: window.LIMENTechnologyBrain
 */
(function () {
  'use strict';
  if (!window.LIMENDomainBrainBase) { console.warn('[TechnologyBrain] Base not loaded'); return; }
  var Base = window.LIMENDomainBrainBase;

  function TechnologyBrain() {
    Base.call(this, { domainId: 'technology', label: 'Technology', snapshotKey: 'technology', cycleInterval: 30000 });
  }
  TechnologyBrain.prototype = Object.create(Base.prototype);
  TechnologyBrain.prototype.constructor = TechnologyBrain;

  TechnologyBrain.prototype.init = function () {
    Base.prototype.init.call(this);

    this.diagnosisIndex = {
      'CYBER_ATTACK':               ['cyber_breach', 'network_intrusion', 'ransomware', 'infrastructure_attack', 'technology_high_stress', 'macro_shock'],
      'AI_ALIGNMENT_FAILURE':       ['ai_misalignment', 'autonomy_overreach', 'bias_amplification', 'alignment_gap', 'technology_high_stress'],
      'INFRASTRUCTURE_COLLAPSE':    ['system_failure', 'outage_cascade', 'cloud_disruption', 'dependency_failure', 'technology_high_stress'],
      'DATA_BREACH':                ['data_exfiltration', 'privacy_exposure', 'credential_compromise', 'cyber_breach', 'compliance_violation'],
      'CHIP_SHORTAGE':              ['supply_constraint', 'semiconductor_gap', 'manufacturing_bottleneck', 'component_scarcity', 'structural_stress'],
      'PLATFORM_MONOPOLY':          ['market_concentration', 'platform_lock_in', 'innovation_suppression', 'competitive_distortion', 'structural_stress']
    };

    this.emissionRules = [
      { targetDomain: 'finance', signalType: 'tech_risk_exposure', condition: function (s) { return s.stress >= 0.20; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.55); } },
      { targetDomain: 'defense', signalType: 'cyber_threat_vector', condition: function (s) { return s.stress >= 0.20; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); } },
      { targetDomain: 'communication', signalType: 'platform_integrity_pressure', condition: function (s) { return s.stress >= 0.25; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); } },
      { targetDomain: 'governance', signalType: 'tech_regulation_pressure', condition: function (s) { return s.stress >= 0.30; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); } },
      { targetDomain: 'infrastructure', signalType: 'digital_infrastructure_strain', condition: function (s) { return s.stress >= 0.30; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.4); } }
    ];
  };

  TechnologyBrain.prototype.normalizeSignals = function () {
    var signals = [], rawSignals = (this._rawDomain && this._rawDomain.signals) || [];
    for (var i = 0; i < rawSignals.length; i++) signals.push(rawSignals[i]);
    this._activeConditions = [];

    // Long-arc baseline — technology always has cyber risk and innovation pressure
    this._activeConditions.push('cyber_breach');
    this._activeConditions.push('alignment_gap');
    signals.push('BASELINE: Persistent cyber threat landscape and AI alignment posture pressure');

    var feeds = this.state.feeds;
    for (var fi = 0; fi < feeds.length; fi++) {
      var f = feeds[fi], fn = (f.name || '').toLowerCase();
      if ((fn.indexOf('patent') !== -1 || fn.indexOf('uspto') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('innovation_suppression');
        signals.push('FEED: Patent signal — ' + (f.label || f.value));
      }
      if (fn.indexOf('arxiv') !== -1 && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('autonomy_overreach');
        signals.push('FEED: CS research signal — ' + (f.label || f.value));
      }
      if ((fn.indexOf('cisa') !== -1 || fn.indexOf('kev') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('cyber_breach');
        this._activeConditions.push('network_intrusion');
        if (f.value >= 5) this._activeConditions.push('infrastructure_attack');
        signals.push('FEED: CISA Known Exploited Vulnerabilities \u2014 ' + (f.label || f.value));
      }
      if (fn.indexOf('nvd') !== -1 && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('compliance_violation');
        if (f.value >= 20) this._activeConditions.push('data_exfiltration');
        signals.push('FEED: NVD vulnerability signal \u2014 ' + (f.label || f.value));
      }
      if (fn.indexOf('krebs') !== -1 && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('ransomware');
        if (f.value >= 5) this._activeConditions.push('privacy_exposure');
        signals.push('FEED: Krebs Security signal \u2014 ' + (f.label || f.value));
      }
      if (fn.indexOf('hacker news') !== -1 && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('platform_lock_in');
        if (f.value >= 10) this._activeConditions.push('ai_misalignment');
        signals.push('FEED: Hacker News tech discourse signal \u2014 ' + (f.label || f.value));
      }
      if (fn.indexOf('github security') !== -1 && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('component_scarcity');
        if (f.value >= 5) this._activeConditions.push('dependency_failure');
        signals.push('FEED: GitHub Security Advisories \u2014 ' + (f.label || f.value));
      }

      // \u2500\u2500 INSTITUTIONAL FEED-DERIVED CONDITIONS (Federal Register) \u2500\u2500
      // Distinct collection methodology \u2014 regulatory doc-counts (different ceiling than RSS/APIs).

      // Fed Reg FCC \u2014 telecom/platform regulatory \u2192 PLATFORM_MONOPOLY / INFRASTRUCTURE_COLLAPSE
      if (fn.indexOf('fed reg fcc') !== -1 && f.value !== undefined && f.value >= 5) {
        this._activeConditions.push('platform_lock_in');
        signals.push('Fed Reg FCC: ' + f.value + ' telecom regulatory docs (30d)');
      }
      if (fn.indexOf('fed reg fcc') !== -1 && f.value !== undefined && f.value >= 10) {
        this._activeConditions.push('market_concentration');
        this._activeConditions.push('competitive_distortion');
      }

      // Fed Reg NIST \u2014 standards/AI regulatory \u2192 AI_ALIGNMENT_FAILURE
      if (fn.indexOf('fed reg nist') !== -1 && f.value !== undefined && f.value >= 3) {
        this._activeConditions.push('alignment_gap');
        signals.push('Fed Reg NIST: ' + f.value + ' standards regulatory docs (30d)');
      }
      if (fn.indexOf('fed reg nist') !== -1 && f.value !== undefined && f.value >= 6) {
        this._activeConditions.push('ai_misalignment');
        this._activeConditions.push('autonomy_overreach');
      }

      // Fed Reg FTC \u2014 antitrust/platform regulatory \u2192 PLATFORM_MONOPOLY
      if (fn.indexOf('fed reg ftc') !== -1 && f.value !== undefined && f.value >= 3) {
        this._activeConditions.push('market_concentration');
        signals.push('Fed Reg FTC: ' + f.value + ' antitrust/platform docs (30d)');
      }
      if (fn.indexOf('fed reg ftc') !== -1 && f.value !== undefined && f.value >= 6) {
        this._activeConditions.push('innovation_suppression');
        this._activeConditions.push('competitive_distortion');
      }
      if (fn.indexOf('fed reg ftc') !== -1 && f.value !== undefined && f.value >= 10) {
        this._activeConditions.push('compliance_violation');
      }
    }

    for (var rsi = 0; rsi < rawSignals.length; rsi++) {
      var rs = (typeof rawSignals[rsi] === 'string' ? rawSignals[rsi] : '').toLowerCase();
      if (rs.indexOf('cyber') !== -1 || rs.indexOf('hack') !== -1 || rs.indexOf('ransomware') !== -1 || rs.indexOf('breach') !== -1) {
        if (this._activeConditions.indexOf('network_intrusion') === -1) this._activeConditions.push('network_intrusion');
        if (this._activeConditions.indexOf('ransomware') === -1) this._activeConditions.push('ransomware');
      }
      if (rs.indexOf('ai') !== -1 || rs.indexOf('artificial intelligence') !== -1 || rs.indexOf('alignment') !== -1 || rs.indexOf('autonomous') !== -1) {
        if (this._activeConditions.indexOf('ai_misalignment') === -1) this._activeConditions.push('ai_misalignment');
        if (this._activeConditions.indexOf('bias_amplification') === -1) this._activeConditions.push('bias_amplification');
      }
      if (rs.indexOf('outage') !== -1 || rs.indexOf('downtime') !== -1 || rs.indexOf('cloud') !== -1 || rs.indexOf('infrastructure') !== -1) {
        if (this._activeConditions.indexOf('system_failure') === -1) this._activeConditions.push('system_failure');
        if (this._activeConditions.indexOf('outage_cascade') === -1) this._activeConditions.push('outage_cascade');
      }
      if (rs.indexOf('chip') !== -1 || rs.indexOf('semiconductor') !== -1 || rs.indexOf('shortage') !== -1) {
        if (this._activeConditions.indexOf('semiconductor_gap') === -1) this._activeConditions.push('semiconductor_gap');
        if (this._activeConditions.indexOf('supply_constraint') === -1) this._activeConditions.push('supply_constraint');
      }
      if (rs.indexOf('monopol') !== -1 || rs.indexOf('antitrust') !== -1 || rs.indexOf('big tech') !== -1) {
        if (this._activeConditions.indexOf('market_concentration') === -1) this._activeConditions.push('market_concentration');
        if (this._activeConditions.indexOf('platform_lock_in') === -1) this._activeConditions.push('platform_lock_in');
      }
      if (rs.indexOf('data') !== -1 && (rs.indexOf('breach') !== -1 || rs.indexOf('leak') !== -1 || rs.indexOf('exfil') !== -1)) {
        if (this._activeConditions.indexOf('data_exfiltration') === -1) this._activeConditions.push('data_exfiltration');
        if (this._activeConditions.indexOf('privacy_exposure') === -1) this._activeConditions.push('privacy_exposure');
      }
    }

    // Patent signals from enriched snapshot
    if (this._rawDomain && this._rawDomain.patentSignals) {
      var ps = this._rawDomain.patentSignals;
      if (ps.filingAcceleration) { this._activeConditions.push('innovation_suppression'); signals.push('PATENT: Filing acceleration detected'); }
      if (ps.concentrationRisk) { this._activeConditions.push('competitive_distortion'); signals.push('PATENT: Concentration risk in filings'); }
    }

    var snap = this._getSnapshot();
    if (snap && snap.defenseSignals) {
      for (var si = 0; si < snap.defenseSignals.length; si++) {
        var sig = snap.defenseSignals[si];
        if (sig.affectedDomains && sig.affectedDomains.indexOf('technology') !== -1) {
          this._activeConditions.push(sig.eventType);
          signals.push('FEED [DEFENSE]: ' + (sig.eventType || '').replace(/_/g, ' '));
        }
      }
    }
    if (snap && snap.macroShock && snap.macroShock.detected) this._activeConditions.push('macro_shock');

    if (window.LIMENDomainBrains) {
      var allBrains = window.LIMENDomainBrains.getAll();
      for (var bk in allBrains) {
        if (bk === 'technology') continue;
        var b = allBrains[bk]; if (!b || !b.state) continue;
        var bEm = b.state.crossDomainEmissions || [];
        for (var bei = 0; bei < bEm.length; bei++) {
          var be = bEm[bei];
          if (be.targetDomain === 'technology' && be.magnitude > 0.1) {
            signals.push('FEED [' + bk.toUpperCase() + ']: ' + (be.signal || '').replace(/_/g, ' ') + ' — ' + Math.round(be.magnitude * 100) + '%');
          }
        }
      }
    }

    if (this.state.stress >= 0.20) { this._activeConditions.push('dependency_failure'); this._activeConditions.push('credential_compromise'); }
    if (this.state.stress >= 0.35) { this._activeConditions.push('infrastructure_attack'); this._activeConditions.push('cloud_disruption'); }
    if (this.state.stress >= 0.50) { this._activeConditions.push('technology_high_stress'); this._activeConditions.push('compliance_violation'); }
    if (this.state.stress >= 0.60) { this._activeConditions.push('manufacturing_bottleneck'); this._activeConditions.push('component_scarcity'); }
    if (this.state.maturity === 'STRUCTURAL') this._activeConditions.push('structural_stress');
    var extPressure = this.getExternalPressure ? this.getExternalPressure() : 0;
    if (extPressure >= 0.10) this._activeConditions.push('supply_constraint');
    if (extPressure >= 0.20) this._activeConditions.push('competitive_distortion');

    this.state.signals = signals;
    return Promise.resolve();
  };

  TechnologyBrain.prototype.deriveDiagnoses = function () {
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

  TechnologyBrain.prototype.recommendTreatments = function () {
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

  TechnologyBrain.prototype.surfaceOpportunities = function () {
    Base.prototype.surfaceOpportunities.call(this);
    var opps = [], stress = this.state.stress, activeDx = this.state.diagnoses.filter(function (d) { return d.active; }), allDx = this.state.diagnoses || [], companies = this.state.companies, seen = {};
    function add(o) { var key = o.title.toLowerCase().replace(/[^a-z0-9]/g, ''); if (seen[key]) return; seen[key] = true; opps.push(o); }

    for (var di = 0; di < activeDx.length; di++) {
      var dx = activeDx[di], dxLabel = (dx.label || dx.id || '').replace(/_/g, ' ');
      add({ title: dxLabel + ' — cybersecurity and threat detection infrastructure', rank: stress * dx.relevance, path: 'INVESTABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.50) add({ title: dxLabel + ' — resilience and recovery systems', rank: stress * dx.relevance * 0.9, path: 'INVESTABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.55 && dx.relevance >= 0.2) add({ title: dxLabel + ' — AI safety and alignment infrastructure', rank: stress * 0.85, path: 'PATENTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      add({ title: dxLabel + ' — supply chain and component diversification', rank: stress * dx.relevance * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
    }

    var termCo = [] /* neutralized: distress only from validated gate (see energy-brain) */;
    if (termCo.length > 0) add({ title: 'Technology terminal entity distressed positioning', rank: 0.95, path: 'INVESTABLE', urgency: 'high', source: 'company_terminal', tier: 1, companies: termCo.map(function (c) { return c.ticker; }), stress: stress });
    if (this.state.convergence && this.state.convergence.primary_signal) add({ title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — technology convergence response', rank: 0.98, path: 'INVESTABLE', urgency: 'high', source: 'convergence', tier: 1, stress: stress });

    var emissions = this.state.crossDomainEmissions || [];
    for (var ei = 0; ei < emissions.length; ei++) { var em = emissions[ei]; add({ title: 'Technology \u2192 ' + (em.targetDomain || '').replace(/_/g, ' ') + ' — ' + (em.signal || em.signalType || '').replace(/_/g, ' '), rank: (em.magnitude || 0.5) * stress * 0.8, path: 'INVESTABLE', urgency: em.magnitude > 0.6 ? 'high' : 'medium', source: 'cross_domain', tier: 2, stress: stress }); }

    if (stress >= 0.50) {
      add({ title: 'Zero-trust architecture and identity verification systems', rank: stress * 0.70, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'zero_trust', stress: stress });
      add({ title: 'Semiconductor supply chain resilience and onshoring', rank: stress * 0.65, path: 'INVESTABLE', urgency: stress > 0.70 ? 'medium' : 'watching', source: 'lagging', tier: 3, diagnosisId: 'chip_resilience', stress: stress });
    }
    if (stress >= 0.60) {
      add({ title: 'AI governance and responsible development frameworks', rank: stress * 0.75, path: 'GRANT-ELIGIBLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'ai_governance', stress: stress });
      add({ title: 'Cloud resilience and multi-provider redundancy', rank: stress * 0.72, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'cloud_resilience', stress: stress });
      add({ title: 'Open-source alternatives and platform interoperability', rank: stress * 0.68, path: 'PATENTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'open_source', stress: stress });
    }

    var nearDx = allDx.filter(function (d) { return !d.active && d.relevance > 0 && d.totalTriggers > 0; });
    for (var ndi = 0; ndi < nearDx.length; ndi++) { if (stress >= 0.45) add({ title: (nearDx[ndi].label || '').replace(/_/g, ' ') + ' — early-stage monitoring', rank: stress * (nearDx[ndi].relevance || 0.1) * 0.5, path: 'PATENTABLE', urgency: 'watching', source: 'near_diagnosis', tier: 2, stress: stress, nearDiagnosisId: nearDx[ndi].id }); }

    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });
    // Canonical enrichment — merge technology playbook detail per opportunity
    var PB_LIST = window.LIMENTechnologyOpportunityPlaybooks || [];
    var _byId = {};
    for (var _pbi = 0; _pbi < PB_LIST.length; _pbi++) _byId[PB_LIST[_pbi].id] = PB_LIST[_pbi];
    var _PB_MAP = {
      'CYBER_ATTACK': 'cyber_attack',
      'AI_ALIGNMENT_FAILURE': 'ai_alignment',
      'INFRASTRUCTURE_COLLAPSE': 'infrastructure_collapse',
      'DATA_BREACH': 'cyber_attack',
      'CHIP_SHORTAGE': 'chip_shortage',
      'PLATFORM_MONOPOLY': 'platform_monopoly'
    };
    var _LAGGING_MAP = {
      'ai_governance': 'ai_alignment',
      'chip_resilience': 'chip_shortage',
      'cloud_resilience': 'infrastructure_collapse',
      'open_source': 'platform_monopoly',
      'zero_trust': 'cyber_attack'
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
      o.domain = 'technology';
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
        var evidenceParts = ['Domain: technology', 'Stress: ' + stressPct + '%'];
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

  TechnologyBrain.prototype._checkDiagnosisActions = function () {
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; }); if (activeDx.length === 0) return;
    var adapters = window.LIMENActionAdapters; if (!adapters) return;
    for (var i = 0; i < activeDx.length; i++) { var dx = activeDx[i]; if (adapters.getDrafts && adapters.getDrafts({ domain: 'technology', intentId: dx.id }).length > 0) continue; adapters.createDraft('REPORT_GENERATION', { domain: 'technology', sourceType: 'domain_brain', sourceId: dx.id, intentId: dx.id, title: 'Technology Alert: ' + dx.label, intent: { domain: 'technology', title: dx.label, status: 'ACTIVE', priority: this.state.stress, progress: 0, strategyType: 'diagnosis_response', steps: [{ type: 'ANALYZE', label: 'Assess ' + dx.label + ' impact on technology systems', status: 'PENDING' }, { type: 'INVESTIGATE', label: 'Identify affected infrastructure, companies, and supply chains', status: 'PENDING' }, { type: 'POSITION', label: 'Evaluate security and resilience opportunities', status: 'PENDING' }] } }); }
  };

  TechnologyBrain.prototype.resolveDeepContent = function () {
    var self = this; var resolver = window.LIMENPortalContentResolver; if (!resolver) return Promise.resolve();
    return resolver.resolveForBrain(this.state).then(function (content) { self.state.resolvedContent = content; if (content) { var dt = []; for (var dxId in content.byDiagnosis) { var dxC = content.byDiagnosis[dxId]; for (var i = 0; i < dxC.treatments.length; i++) { var t = dxC.treatments[i]; dt.push({ id: 'deep_' + t.nodeId + '_' + i, label: t.label, type: t.type, evidence: t.evidence, description: t.description, cite: t.cite, steps: t.steps, monitoring: t.monitoring, escalation: t.escalation, diagnosisId: dxId, nodeId: t.nodeId, nodeLabel: t.nodeLabel, hasDepth: t.hasDepth, source: 'canonical_deep' }); } } if (dt.length > 0) self.state.treatments = dt; } }).catch(function () {});
  };

  var _origCycle = TechnologyBrain.prototype.cycle;
  TechnologyBrain.prototype.cycle = function () { var self = this; return _origCycle.call(this).then(function () { return self.resolveDeepContent(); }); };

  var brain = new TechnologyBrain(); brain.init(); brain.start();
  window.LIMENTechnologyBrain = brain;
  window.LIMENDomainBrains.register(brain);

  // ══════════════════════════════════════════════════════════════════════
  // AUTO-LOAD TECHNOLOGY OPERATOR STACK ON DOMAIN-CONSOLE
  // ══════════════════════════════════════════════════════════════════════

  var _isDomainConsole = window.location.pathname.indexOf('domain-console') !== -1 || window.location.pathname.indexOf('technology-console') !== -1;
  var _domParam = (new URLSearchParams(window.location.search)).get('domain');
  var _isTechnologyDomain = _domParam === 'technology';
  if (_isDomainConsole && _isTechnologyDomain) {
    window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION = true;

    var _technologyScripts = [
      'assets/js/technology-compensation.js',
      'assets/js/technology-claim-ledger.js',
      'assets/js/technology-claim-flow.js',
      'assets/js/technology-opportunity-economics.js',
      'assets/js/technology-pulse-engine.js',
      'assets/js/technology-operator-panel.js',
      'assets/js/technology-node-business-engine.js',
      'assets/js/technology-business-review.js',
      'assets/js/technology-execution-panels.js',
      'assets/js/technology-business-build.js',
      'assets/js/technology-directive-extractor.js',
      'assets/js/technology-directive-ranker.js',
      'assets/js/technology-directive-translator.js',
      'assets/js/technology-targeting-engine.js',
      'assets/js/technology-promotion-bridge.js',
      'assets/js/technology-clarity-operator.js'
    ];
    (function loadNext(i) {
      if (i >= _technologyScripts.length) return;
      var s = document.createElement('script');
      s.src = _technologyScripts[i];
      s.onload = function () { loadNext(i + 1); };
      s.onerror = function () { console.warn('[TechnologyBrain] Failed to load ' + _technologyScripts[i]); loadNext(i + 1); };
      document.head.appendChild(s);
    })(0);
  }
})();
