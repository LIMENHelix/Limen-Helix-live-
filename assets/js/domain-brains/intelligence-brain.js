/**
 * intelligence-brain.js — Intelligence Domain Cognitive Engine
 *
 * Portal issues: INTELLIGENCE_FAILURE, MASS_SURVEILLANCE_SCANDAL, CYBER_ESPIONAGE,
 *                WHISTLEBLOWER_CRISIS, FOREIGN_INTERFERENCE
 *
 * Cross-domain emissions:
 *   intelligence → defense (threat visibility / adversarial intent)
 *   intelligence → communication (narrative manipulation / information contamination)
 *   intelligence → governance (institutional blind spots / coordination weakness)
 *   intelligence → finance (strategic risk visibility / hidden exposure)
 *   intelligence → technology (observability and trust-boundary pressure)
 *
 * Exposes: window.LIMENIntelligenceBrain
 */
(function () {
  'use strict';
  if (!window.LIMENDomainBrainBase) { console.warn('[IntelligenceBrain] Base not loaded'); return; }
  var Base = window.LIMENDomainBrainBase;

  function IntelligenceBrain() {
    Base.call(this, { domainId: 'intelligence', label: 'Intelligence', snapshotKey: 'intelligence', cycleInterval: 30000 });
  }
  IntelligenceBrain.prototype = Object.create(Base.prototype);
  IntelligenceBrain.prototype.constructor = IntelligenceBrain;

  IntelligenceBrain.prototype.init = function () {
    Base.prototype.init.call(this);

    this.diagnosisIndex = {
      'INTELLIGENCE_FAILURE':         ['signal_blindness', 'collection_gap', 'low_observability', 'weak_anomaly_detection', 'analytic_distortion', 'intelligence_high_stress', 'structural_stress'],
      'MASS_SURVEILLANCE_SCANDAL':    ['oversight_failure', 'trust_boundary_breach', 'privacy_violation', 'bulk_collection_excess', 'intelligence_high_stress'],
      'CYBER_ESPIONAGE':              ['adversarial_penetration', 'compromised_channel', 'deception_exposure', 'leaked_signals', 'network_intrusion', 'macro_shock'],
      'WHISTLEBLOWER_CRISIS':         ['trust_boundary_breach', 'leaked_signals', 'oversight_failure', 'institutional_exposure', 'narrative_capture'],
      'FOREIGN_INTERFERENCE':         ['adversarial_penetration', 'deception_exposure', 'narrative_manipulation', 'information_contamination', 'coordination_failure', 'macro_shock']
    };

    this.emissionRules = [
      { targetDomain: 'defense', signalType: 'threat_visibility_pressure', condition: function (s) { return s.stress >= 0.15; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.6); } },
      { targetDomain: 'communication', signalType: 'information_contamination_risk', condition: function (s) { return s.stress >= 0.20; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); } },
      { targetDomain: 'governance', signalType: 'coordination_blind_spot', condition: function (s) { return s.stress >= 0.25; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); } },
      { targetDomain: 'finance', signalType: 'strategic_risk_visibility', condition: function (s) { return s.stress >= 0.30; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.4); } },
      { targetDomain: 'technology', signalType: 'observability_trust_pressure', condition: function (s) { return s.stress >= 0.25; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); } }
    ];
  };

  IntelligenceBrain.prototype.normalizeSignals = function () {
    var signals = [], rawSignals = (this._rawDomain && this._rawDomain.signals) || [];
    for (var i = 0; i < rawSignals.length; i++) signals.push(rawSignals[i]);
    this._activeConditions = [];

    // Long-arc baseline — intelligence always has observability pressure
    this._activeConditions.push('collection_gap');
    this._activeConditions.push('low_observability');
    signals.push('BASELINE: Persistent intelligence collection and observability posture pressure');

    var feeds = this.state.feeds;
    for (var fi = 0; fi < feeds.length; fi++) {
      var f = feeds[fi], fn = (f.name || '').toLowerCase();
      if ((fn.indexOf('intel') !== -1 || fn.indexOf('espionage') !== -1 || fn.indexOf('surveillance') !== -1 || fn.indexOf('security') !== -1 || fn.indexOf('national') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('signal_blindness');
        this._activeConditions.push('weak_anomaly_detection');
        signals.push('FEED: Intelligence signal activity — ' + (f.label || f.value));
      }
      if ((fn.indexOf('cyber') !== -1 || fn.indexOf('hack') !== -1 || fn.indexOf('breach') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('adversarial_penetration');
        this._activeConditions.push('network_intrusion');
        signals.push('ELEVATED: Cyber threat signal detected');
      }

      // ── INSTITUTIONAL FEED-DERIVED CONDITIONS (CISA KEV / Federal Register / OFAC) ──
      // Distinct collection methodologies from RSS keyword feeds — different ceilings.

      // CISA KEV — curated newly-exploited CVEs → CYBER_ESPIONAGE
      if (fn.indexOf('cisa kev') !== -1 && f.value !== undefined && f.value >= 10) {
        this._activeConditions.push('compromised_channel');
        signals.push('CISA KEV: ' + f.value + ' newly-exploited CVEs (30d)');
      }
      if (fn.indexOf('cisa kev') !== -1 && f.value !== undefined && f.value >= 25) {
        this._activeConditions.push('adversarial_penetration');
        this._activeConditions.push('network_intrusion');
      }

      // Fed Reg FBI — investigative regulatory volume → INTEL_FAILURE / SURVEILLANCE
      if (fn.indexOf('fed reg fbi') !== -1 && f.value !== undefined && f.value >= 1) {
        this._activeConditions.push('privacy_violation');
        signals.push('Fed Reg FBI: ' + f.value + ' regulatory docs (30d)');
      }
      if (fn.indexOf('fed reg fbi') !== -1 && f.value !== undefined && f.value >= 3) {
        this._activeConditions.push('weak_anomaly_detection');
      }
      if (fn.indexOf('fed reg fbi') !== -1 && f.value !== undefined && f.value >= 8) {
        this._activeConditions.push('bulk_collection_excess');
      }

      // The Intercept NatSec — whistleblower/surveillance journalism beat
      // → WHISTLEBLOWER_CRISIS triggers (leaked_signals, institutional_exposure)
      if (fn.indexOf('intercept') !== -1 && f.value !== undefined && f.value >= 20) {
        this._activeConditions.push('leaked_signals');
        this._activeConditions.push('institutional_exposure');
        signals.push('The Intercept: ' + f.value + ' surveillance/whistleblower articles');
      }
      if (fn.indexOf('intercept') !== -1 && f.value !== undefined && f.value >= 50) {
        this._activeConditions.push('narrative_capture');
      }

      // Lawfare NatSec — surveillance-law critique / oversight analysis
      // → MASS_SURVEILLANCE_SCANDAL trigger (oversight_failure)
      if (fn.indexOf('lawfare') !== -1 && f.value !== undefined && f.value >= 20) {
        this._activeConditions.push('oversight_failure');
        signals.push('Lawfare: ' + f.value + ' NatSec law/policy articles');
      }
      if (fn.indexOf('lawfare') !== -1 && f.value !== undefined && f.value >= 50) {
        this._activeConditions.push('trust_boundary_breach');
      }

      // Bellingcat OSINT — open-source investigations → FOREIGN_INTERFERENCE
      if (fn.indexOf('bellingcat') !== -1 && f.value !== undefined && f.value >= 20) {
        this._activeConditions.push('deception_exposure');
        signals.push('Bellingcat: ' + f.value + ' OSINT investigation articles');
      }

      // Fed Reg CIA — foreign intel regulatory → FOREIGN_INTERFERENCE / INTEL_FAILURE
      if (fn.indexOf('fed reg cia') !== -1 && f.value !== undefined && f.value >= 1) {
        this._activeConditions.push('analytic_distortion');
        signals.push('Fed Reg CIA: ' + f.value + ' regulatory docs (30d)');
      }
      if (fn.indexOf('fed reg cia') !== -1 && f.value !== undefined && f.value >= 3) {
        this._activeConditions.push('coordination_failure');
      }

      // Fed Reg NSA — signals intel regulatory → MASS_SURVEILLANCE_SCANDAL
      if (fn.indexOf('fed reg nsa') !== -1 && f.value !== undefined && f.value >= 1) {
        this._activeConditions.push('bulk_collection_excess');
        signals.push('Fed Reg NSA: ' + f.value + ' regulatory docs (30d)');
      }
      if (fn.indexOf('fed reg nsa') !== -1 && f.value !== undefined && f.value >= 3) {
        this._activeConditions.push('oversight_failure');
        this._activeConditions.push('trust_boundary_breach');
      }

      // OFAC Recent Actions — sanctions / counterintelligence overlap
      // → FOREIGN_INTERFERENCE (sanctions often respond to interference / espionage)
      if (fn.indexOf('ofac') !== -1 && f.value !== undefined && f.value >= 15) {
        this._activeConditions.push('deception_exposure');
        signals.push('OFAC: ' + f.value + ' sanctions designation signals');
      }
      if (fn.indexOf('ofac') !== -1 && f.value !== undefined && f.value >= 30) {
        this._activeConditions.push('narrative_manipulation');
        this._activeConditions.push('information_contamination');
      }
    }

    // RSS article signals — catch generic "N articles on intelligence" patterns
    for (var rsi = 0; rsi < rawSignals.length; rsi++) {
      var rs = (typeof rawSignals[rsi] === 'string' ? rawSignals[rsi] : '').toLowerCase();
      if (rs.indexOf('espionage') !== -1 || rs.indexOf('spy') !== -1 || rs.indexOf('infiltrat') !== -1) {
        if (this._activeConditions.indexOf('adversarial_penetration') === -1) this._activeConditions.push('adversarial_penetration');
        if (this._activeConditions.indexOf('deception_exposure') === -1) this._activeConditions.push('deception_exposure');
      }
      if (rs.indexOf('surveillance') !== -1 || rs.indexOf('bulk collection') !== -1 || rs.indexOf('privacy') !== -1) {
        if (this._activeConditions.indexOf('bulk_collection_excess') === -1) this._activeConditions.push('bulk_collection_excess');
        if (this._activeConditions.indexOf('privacy_violation') === -1) this._activeConditions.push('privacy_violation');
      }
      if (rs.indexOf('leak') !== -1 || rs.indexOf('whistleblow') !== -1 || rs.indexOf('classified') !== -1) {
        if (this._activeConditions.indexOf('leaked_signals') === -1) this._activeConditions.push('leaked_signals');
        if (this._activeConditions.indexOf('institutional_exposure') === -1) this._activeConditions.push('institutional_exposure');
      }
      if (rs.indexOf('disinformation') !== -1 || rs.indexOf('foreign influence') !== -1 || rs.indexOf('interference') !== -1 || rs.indexOf('manipulation') !== -1) {
        if (this._activeConditions.indexOf('narrative_manipulation') === -1) this._activeConditions.push('narrative_manipulation');
        if (this._activeConditions.indexOf('information_contamination') === -1) this._activeConditions.push('information_contamination');
      }
      if (rs.indexOf('cyber') !== -1 || rs.indexOf('breach') !== -1 || rs.indexOf('intrusion') !== -1) {
        if (this._activeConditions.indexOf('network_intrusion') === -1) this._activeConditions.push('network_intrusion');
        if (this._activeConditions.indexOf('compromised_channel') === -1) this._activeConditions.push('compromised_channel');
      }
    }

    var snap = this._getSnapshot();
    if (snap && snap.defenseSignals) {
      for (var si = 0; si < snap.defenseSignals.length; si++) {
        var sig = snap.defenseSignals[si];
        if (sig.affectedDomains && sig.affectedDomains.indexOf('intelligence') !== -1) {
          this._activeConditions.push(sig.eventType);
          signals.push('FEED [DEFENSE]: ' + (sig.eventType || '').replace(/_/g, ' '));
        }
      }
    }
    if (snap && snap.macroShock && snap.macroShock.detected) this._activeConditions.push('macro_shock');

    if (window.LIMENDomainBrains) {
      var allBrains = window.LIMENDomainBrains.getAll();
      for (var bk in allBrains) {
        if (bk === 'intelligence') continue;
        var b = allBrains[bk]; if (!b || !b.state) continue;
        var bEm = b.state.crossDomainEmissions || [];
        for (var bei = 0; bei < bEm.length; bei++) {
          var be = bEm[bei];
          if (be.targetDomain === 'intelligence' && be.magnitude > 0.1) {
            signals.push('FEED [' + bk.toUpperCase() + ']: ' + (be.signal || '').replace(/_/g, ' ') + ' — ' + Math.round(be.magnitude * 100) + '%');
          }
        }
      }
    }

    if (this.state.stress >= 0.20) { this._activeConditions.push('coordination_failure'); this._activeConditions.push('analytic_distortion'); }
    if (this.state.stress >= 0.35) { this._activeConditions.push('weak_anomaly_detection'); this._activeConditions.push('signal_blindness'); }
    if (this.state.stress >= 0.50) { this._activeConditions.push('intelligence_high_stress'); this._activeConditions.push('narrative_capture'); }
    if (this.state.stress >= 0.60) { this._activeConditions.push('oversight_failure'); this._activeConditions.push('trust_boundary_breach'); }
    if (this.state.maturity === 'STRUCTURAL') this._activeConditions.push('structural_stress');
    var extPressure = this.getExternalPressure ? this.getExternalPressure() : 0;
    if (extPressure >= 0.10) this._activeConditions.push('trust_boundary_breach');
    if (extPressure >= 0.20) this._activeConditions.push('adversarial_penetration');

    this.state.signals = signals;
    console.log('[IntelligenceBrain] normalizeSignals: ' + this._activeConditions.length + ' conditions, ' + signals.length + ' signals, stress=' + this.state.stress);
    return Promise.resolve();
  };

  IntelligenceBrain.prototype.deriveDiagnoses = function () {
    var self = this;
    return this._getPortalContent().then(function (portal) {
      if (!portal) { console.warn('[IntelligenceBrain] deriveDiagnoses: NO PORTAL DATA'); return; }
      var issues = portal.issues || [], conditions = self._activeConditions || [];
      self.state.diagnoses = issues.map(function (iss) {
        var triggers = self.diagnosisIndex[iss.id] || [], matchCount = 0;
        for (var t = 0; t < triggers.length; t++) for (var c = 0; c < conditions.length; c++) if (conditions[c] === triggers[t] || conditions[c].indexOf(triggers[t]) !== -1) matchCount++;
        return { id: iss.id, label: iss.label, summary: iss.summary || '', active: matchCount > 0, relevance: Math.round((triggers.length > 0 ? matchCount / triggers.length : 0) * 100) / 100, matchedConditions: matchCount, totalTriggers: triggers.length, circuits: iss.circuits || [], source: 'canonical' };
      });
      self.state.diagnoses.sort(function (a, b) { if (a.active !== b.active) return a.active ? -1 : 1; return b.relevance - a.relevance; });
      var activeDxCount = self.state.diagnoses.filter(function (d) { return d.active; }).length;
      console.log('[IntelligenceBrain] deriveDiagnoses: ' + self.state.diagnoses.length + ' total, ' + activeDxCount + ' active, conditions=' + (self._activeConditions || []).length);
      if (self._activeConditions && self._activeConditions.length > 0 && activeDxCount === 0) console.error('[IntelligenceBrain] PIPELINE BREAK: conditions exist but 0 diagnoses active');
      self._checkDiagnosisActions();
    });
  };

  IntelligenceBrain.prototype.recommendTreatments = function () {
    var self = this;
    return this._getPortalContent().then(function (portal) {
      if (!portal) return;
      var activeDx = self.state.diagnoses.filter(function (d) { return d.active; });
      if (activeDx.length === 0) { self.state.treatments = []; console.log('[IntelligenceBrain] recommendTreatments: 0 active diagnoses, treatments=[]'); return; }
      var activeNodeIds = {};
      for (var di = 0; di < activeDx.length; di++) { var circuits = activeDx[di].circuits || []; for (var ci = 0; ci < circuits.length; ci++) activeNodeIds[circuits[ci].nodeId] = activeDx[di].id; }
      var treatments = [], activations = portal.activations || [];
      for (var ai = 0; ai < activations.length; ai++) { var act = activations[ai]; if (!activeNodeIds[act.brainNodeId]) continue; var actTreats = act.treatments || []; for (var ti = 0; ti < actTreats.length; ti++) { var t = actTreats[ti]; treatments.push({ id: 'treat_' + act.brainNodeId + '_' + ti, label: t.label, type: t.type, evidence: t.evidence, description: t.description || '', diagnosisId: activeNodeIds[act.brainNodeId], nodeId: act.brainNodeId, relevance: 1.0, source: 'canonical' }); } }
      var eR = { A: 10, 'Strong': 10, B: 7, 'Moderate': 7, C: 4, 'Emerging': 1 };
      treatments.sort(function (a, b) { return (eR[b.evidence] || 0) - (eR[a.evidence] || 0); });
      self.state.treatments = treatments;
      console.log('[IntelligenceBrain] recommendTreatments: ' + treatments.length + ' treatments from ' + activeDx.length + ' active diagnoses');
      if (activeDx.length > 0 && treatments.length === 0) console.error('[IntelligenceBrain] PIPELINE BREAK: diagnoses active but 0 treatments resolved');
    });
  };

  IntelligenceBrain.prototype.surfaceOpportunities = function () {
    Base.prototype.surfaceOpportunities.call(this);
    var opps = [], stress = this.state.stress, activeDx = this.state.diagnoses.filter(function (d) { return d.active; }), allDx = this.state.diagnoses || [], companies = this.state.companies, seen = {};
    function add(o) { var key = o.title.toLowerCase().replace(/[^a-z0-9]/g, ''); if (seen[key]) return; seen[key] = true; opps.push(o); }

    for (var di = 0; di < activeDx.length; di++) {
      var dx = activeDx[di], dxLabel = (dx.label || dx.id || '').replace(/_/g, ' ');
      add({ title: dxLabel + ' — observability and anomaly detection expansion', rank: stress * dx.relevance, path: 'PATENTABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.50) add({ title: dxLabel + ' — intelligence fusion and coordination infrastructure', rank: stress * dx.relevance * 0.9, path: 'INVESTABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.55 && dx.relevance >= 0.2) add({ title: dxLabel + ' — counterintelligence and trust-boundary hardening', rank: stress * 0.85, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      add({ title: dxLabel + ' — disinformation detection and narrative integrity', rank: stress * dx.relevance * 0.75, path: 'PATENTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
    }

    var termCo = [] /* neutralized: distress only from validated gate (see energy-brain) */;
    if (termCo.length > 0) add({ title: 'Intelligence terminal entity distressed positioning', rank: 0.95, path: 'INVESTABLE', urgency: 'high', source: 'company_terminal', tier: 1, companies: termCo.map(function (c) { return c.ticker; }), stress: stress });
    if (this.state.convergence && this.state.convergence.primary_signal) add({ title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — intelligence convergence response', rank: 0.98, path: 'INVESTABLE', urgency: 'high', source: 'convergence', tier: 1, stress: stress });

    var emissions = this.state.crossDomainEmissions || [];
    for (var ei = 0; ei < emissions.length; ei++) { var em = emissions[ei]; add({ title: 'Intelligence \u2192 ' + (em.targetDomain || '').replace(/_/g, ' ') + ' — ' + (em.signal || em.signalType || '').replace(/_/g, ' '), rank: (em.magnitude || 0.5) * stress * 0.8, path: 'INVESTABLE', urgency: em.magnitude > 0.6 ? 'high' : 'medium', source: 'cross_domain', tier: 2, stress: stress }); }

    if (stress >= 0.50) {
      add({ title: 'Cybersecurity and threat intelligence infrastructure', rank: stress * 0.70, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'cyber_infra', stress: stress });
      add({ title: 'Intelligence oversight and accountability systems', rank: stress * 0.65, path: 'GRANT-ELIGIBLE', urgency: stress > 0.70 ? 'medium' : 'watching', source: 'lagging', tier: 3, diagnosisId: 'oversight', stress: stress });
    }
    if (stress >= 0.60) {
      add({ title: 'Data fusion and multi-source intelligence platforms', rank: stress * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'data_fusion', stress: stress });
      add({ title: 'Strategic early warning and predictive analysis systems', rank: stress * 0.72, path: 'PATENTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'early_warning', stress: stress });
      add({ title: 'Trust verification and secure communication infrastructure', rank: stress * 0.68, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'trust_verify', stress: stress });
    }

    var nearDx = allDx.filter(function (d) { return !d.active && d.relevance > 0 && d.totalTriggers > 0; });
    for (var ndi = 0; ndi < nearDx.length; ndi++) { if (stress >= 0.45) add({ title: (nearDx[ndi].label || '').replace(/_/g, ' ') + ' — early-stage monitoring', rank: stress * (nearDx[ndi].relevance || 0.1) * 0.5, path: 'PATENTABLE', urgency: 'watching', source: 'near_diagnosis', tier: 2, stress: stress, nearDiagnosisId: nearDx[ndi].id }); }

    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });
    // Canonical enrichment — merge intelligence playbook detail per opportunity
    var PB_LIST = window.LIMENIntelligenceOpportunityPlaybooks || [];
    var _byId = {};
    for (var _pbi = 0; _pbi < PB_LIST.length; _pbi++) _byId[PB_LIST[_pbi].id] = PB_LIST[_pbi];
    var _PB_MAP = {
      'INTELLIGENCE_FAILURE': 'intelligence_failure',
      'MASS_SURVEILLANCE_SCANDAL': 'surveillance_scandal',
      'CYBER_ESPIONAGE': 'cyber_espionage',
      'WHISTLEBLOWER_CRISIS': 'whistleblower_crisis',
      'FOREIGN_INTERFERENCE': 'foreign_interference'
    };
    var _LAGGING_MAP = {
      'cyber_infra': 'cyber_espionage',
      'data_fusion': 'intelligence_failure',
      'early_warning': 'intelligence_failure',
      'oversight': 'surveillance_scandal',
      'trust_verify': 'whistleblower_crisis'
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
      o.domain = 'intelligence';
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
        var evidenceParts = ['Domain: intelligence', 'Stress: ' + stressPct + '%'];
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

  IntelligenceBrain.prototype._checkDiagnosisActions = function () {
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; }); if (activeDx.length === 0) return;
    var adapters = window.LIMENActionAdapters; if (!adapters) return;
    for (var i = 0; i < activeDx.length; i++) { var dx = activeDx[i]; if (adapters.getDrafts && adapters.getDrafts({ domain: 'intelligence', intentId: dx.id }).length > 0) continue; adapters.createDraft('REPORT_GENERATION', { domain: 'intelligence', sourceType: 'domain_brain', sourceId: dx.id, intentId: dx.id, title: 'Intelligence Alert: ' + dx.label, intent: { domain: 'intelligence', title: dx.label, status: 'ACTIVE', priority: this.state.stress, progress: 0, strategyType: 'diagnosis_response', steps: [{ type: 'ANALYZE', label: 'Assess ' + dx.label + ' impact on intelligence systems', status: 'PENDING' }, { type: 'INVESTIGATE', label: 'Identify compromised channels and collection gaps', status: 'PENDING' }, { type: 'POSITION', label: 'Evaluate hardening and observability opportunities', status: 'PENDING' }] } }); }
  };

  IntelligenceBrain.prototype.resolveDeepContent = function () {
    var self = this; var resolver = window.LIMENPortalContentResolver; if (!resolver) return Promise.resolve();
    return resolver.resolveForBrain(this.state).then(function (content) { self.state.resolvedContent = content; if (content) { var dt = []; for (var dxId in content.byDiagnosis) { var dxC = content.byDiagnosis[dxId]; for (var i = 0; i < dxC.treatments.length; i++) { var t = dxC.treatments[i]; dt.push({ id: 'deep_' + t.nodeId + '_' + i, label: t.label, type: t.type, evidence: t.evidence, description: t.description, cite: t.cite, steps: t.steps, monitoring: t.monitoring, escalation: t.escalation, diagnosisId: dxId, nodeId: t.nodeId, nodeLabel: t.nodeLabel, hasDepth: t.hasDepth, source: 'canonical_deep' }); } } if (dt.length > 0) self.state.treatments = dt; } }).catch(function () {});
  };

  var _origCycle = IntelligenceBrain.prototype.cycle;
  IntelligenceBrain.prototype.cycle = function () { var self = this; return _origCycle.call(this).then(function () { return self.resolveDeepContent(); }); };

  var brain = new IntelligenceBrain(); brain.init(); brain.start();
  window.LIMENIntelligenceBrain = brain;
  window.LIMENDomainBrains.register(brain);

  // ══════════════════════════════════════════════════════════════════════
  // AUTO-LOAD INTELLIGENCE OPERATOR STACK ON DOMAIN-CONSOLE
  // ══════════════════════════════════════════════════════════════════════

  var _isDomainConsole = window.location.pathname.indexOf('domain-console') !== -1 || window.location.pathname.indexOf('intelligence-console') !== -1;
  var _domParam = (new URLSearchParams(window.location.search)).get('domain');
  var _isIntelligenceDomain = _domParam === 'intelligence';
  if (_isDomainConsole && _isIntelligenceDomain) {
    window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION = true;

    var _intelligenceScripts = [
      'assets/js/intelligence-compensation.js',
      'assets/js/intelligence-claim-ledger.js',
      'assets/js/intelligence-claim-flow.js',
      'assets/js/intelligence-opportunity-economics.js',
      'assets/js/intelligence-pulse-engine.js',
      'assets/js/intelligence-operator-panel.js',
      'assets/js/intelligence-node-business-engine.js',
      'assets/js/intelligence-business-review.js',
      'assets/js/intelligence-execution-panels.js',
      'assets/js/intelligence-business-build.js',
      'assets/js/intelligence-directive-extractor.js',
      'assets/js/intelligence-directive-ranker.js',
      'assets/js/intelligence-directive-translator.js',
      'assets/js/intelligence-targeting-engine.js',
      'assets/js/intelligence-promotion-bridge.js',
      'assets/js/intelligence-clarity-operator.js'
    ];
    (function loadNext(i) {
      if (i >= _intelligenceScripts.length) return;
      var s = document.createElement('script');
      s.src = _intelligenceScripts[i];
      s.onload = function () { loadNext(i + 1); };
      s.onerror = function () { console.warn('[IntelligenceBrain] Failed to load ' + _intelligenceScripts[i]); loadNext(i + 1); };
      document.head.appendChild(s);
    })(0);
  }
})();
