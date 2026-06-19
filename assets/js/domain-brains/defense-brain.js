/**
 * defense-brain.js — Defense Domain Cognitive Engine
 * Portal issues: INVASION, CYBER_ATTACK, NUCLEAR_THREAT, INTELLIGENCE_FAILURE, LOGISTICS_COLLAPSE, CIVIL_UNREST
 * Emissions: governance, economy, technology, intelligence
 * Exposes: window.LIMENDefenseBrain
 */
(function () {
  'use strict';
  if (!window.LIMENDomainBrainBase) { console.warn('[DefenseBrain] Base not loaded'); return; }
  var Base = window.LIMENDomainBrainBase;

  function DefenseBrain() { Base.call(this, { domainId: 'defense', label: 'Defense', snapshotKey: 'defense', cycleInterval: 30000 }); }
  DefenseBrain.prototype = Object.create(Base.prototype);
  DefenseBrain.prototype.constructor = DefenseBrain;

  DefenseBrain.prototype.init = function () {
    Base.prototype.init.call(this);
    this.diagnosisIndex = {
      'INVASION':              ['invasion', 'territorial_breach', 'force_projection', 'defense_high_stress', 'macro_shock'],
      'CYBER_ATTACK':       ['cyber_breach', 'network_penetration', 'infrastructure_hack', 'defense_high_stress'],
      'NUCLEAR_THREAT':        ['nuclear_escalation', 'deterrence_failure', 'proliferation', 'defense_high_stress', 'macro_shock'],
      'INTELLIGENCE_FAILURE':      ['intel_gap', 'surveillance_miss', 'analysis_failure', 'structural_stress'],
      'LOGISTICS_COLLAPSE':    ['supply_chain_military', 'logistics_failure', 'readiness_gap', 'defense_high_stress'],
      'CIVIL_UNREST':          ['domestic_instability', 'protest_escalation', 'martial_response', 'structural_stress']
    };
    this.emissionRules = [
      { targetDomain: 'governance', signalType: 'security_policy_pressure', condition: function (s) { return s.stress >= 0.25; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.55); } },
      { targetDomain: 'economy', signalType: 'defense_spending_drag', condition: function (s) { return s.stress >= 0.30; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); } },
      { targetDomain: 'technology', signalType: 'defense_tech_demand', condition: function (s) { return s.stress >= 0.30; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); } },
      { targetDomain: 'intelligence', signalType: 'threat_assessment_pressure', condition: function (s) { return s.stress >= 0.25; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); } }
    ];
  };

  DefenseBrain.prototype.normalizeSignals = function () {
    var signals = [], rawSignals = (this._rawDomain && this._rawDomain.signals) || [];
    for (var i = 0; i < rawSignals.length; i++) signals.push(rawSignals[i]);
    this._activeConditions = [];

    // Long-arc baseline — persistent readiness/deterrence pressure
    this._activeConditions.push('readiness_gap');
    this._activeConditions.push('intel_gap');
    signals.push('BASELINE: Persistent readiness and intelligence posture pressure');

    var feeds = this.state.feeds;
    for (var fi = 0; fi < feeds.length; fi++) {
      var f = feeds[fi], fn = (f.name || '').toLowerCase();
      if ((fn.indexOf('rss defense') !== -1 || fn.indexOf('defense signals') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('force_projection');
        if (f.value >= 50) this._activeConditions.push('macro_shock');
        signals.push('FEED: Defense signals \u2014 ' + (f.label || f.value));
      }
      if ((fn.indexOf('rss defense conflict') !== -1 || fn.indexOf('conflict') !== -1 || fn.indexOf('acled') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('invasion');
        if (f.value >= 30) { this._activeConditions.push('territorial_breach'); this._activeConditions.push('force_projection'); }
        if (f.value >= 100) this._activeConditions.push('defense_high_stress');
        signals.push('FEED: Conflict events \u2014 ' + (f.label || f.value));
      }
      if ((fn.indexOf('janes') !== -1 || fn.indexOf('defense news') !== -1 || fn.indexOf('breaking defense') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('supply_chain_military');
        if (f.value >= 10) this._activeConditions.push('logistics_failure');
        signals.push('FEED: Defense industry signal \u2014 ' + (f.label || f.value));
      }
      if ((fn.indexOf('isw') !== -1 || fn.indexOf('iiss') !== -1 || fn.indexOf('rusi') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('analysis_failure');
        if (f.value >= 5) this._activeConditions.push('intel_gap');
        signals.push('FEED: Strategic analysis signal \u2014 ' + (f.label || f.value));
      }
      if ((fn.indexOf('nato') !== -1 || fn.indexOf('sipri') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('readiness_gap');
        signals.push('FEED: Alliance / arms trade signal \u2014 ' + (f.label || f.value));
      }
      if ((fn.indexOf('cisa') !== -1 || fn.indexOf('ncsc') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('cyber_breach');
        this._activeConditions.push('network_penetration');
        if (f.value >= 10) this._activeConditions.push('infrastructure_hack');
        signals.push('FEED: Cyber threat signal \u2014 ' + (f.label || f.value));
      }
      // ── ADVERSARY PERSPECTIVE FEEDS ──
      // State-controlled or state-affiliated. Treated as POSITIONAL signal of what the
      // adversary wants the world to hear, NOT as confirmation of fact. These feeds
      // produce LOWER-WEIGHT conditions (only 'force_projection' and 'analysis_failure'
      // get raised, never the high-stress flags, so we don't artificially inflate stress).
      if (fn.indexOf('tass') !== -1 && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('force_projection');
        signals.push('ADVERSARY [RUSSIA]: TASS \u2014 ' + (f.label || f.value));
      }
      if ((fn.indexOf('xinhua') !== -1 || fn.indexOf('global times') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('force_projection');
        signals.push('ADVERSARY [CHINA]: ' + (f.name || '') + ' \u2014 ' + (f.label || f.value));
      }
      if (fn.indexOf('press tv') !== -1 && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('force_projection');
        signals.push('ADVERSARY [IRAN]: Press TV \u2014 ' + (f.label || f.value));
      }
      if (fn.indexOf('kcna') !== -1 && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('force_projection');
        signals.push('ADVERSARY [DPRK]: KCNA Watch \u2014 ' + (f.label || f.value));
      }
      if (fn.indexOf('south china morning') !== -1 && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('analysis_failure');
        signals.push('REGIONAL [HK/CHINA]: SCMP \u2014 ' + (f.label || f.value));
      }

      // \u2500\u2500 INSTITUTIONAL FEED-DERIVED CONDITIONS (Federal Register / NWS / USGS / OFAC) \u2500\u2500
      // Distinct collection methodologies \u2014 different ceilings than RSS keyword feeds.

      // Fed Reg DoD \u2014 military regulatory volume \u2192 LOGISTICS_COLLAPSE / readiness
      if (fn.indexOf('fed reg dod') !== -1 && f.value !== undefined && f.value >= 5) {
        this._activeConditions.push('supply_chain_military');
        signals.push('Fed Reg DoD: ' + f.value + ' military regulatory docs (30d)');
      }
      if (fn.indexOf('fed reg dod') !== -1 && f.value !== undefined && f.value >= 10) {
        this._activeConditions.push('logistics_failure');
      }

      // Fed Reg State \u2014 diplomatic / sanctions / proliferation
      if (fn.indexOf('fed reg state') !== -1 && f.value !== undefined && f.value >= 5) {
        this._activeConditions.push('analysis_failure');
        signals.push('Fed Reg State: ' + f.value + ' diplomatic regulatory docs (30d)');
      }
      if (fn.indexOf('fed reg state') !== -1 && f.value !== undefined && f.value >= 10) {
        this._activeConditions.push('proliferation');
      }

      // Fed Reg DHS \u2014 homeland security \u2192 CIVIL_UNREST / CYBER_OPERATION
      if (fn.indexOf('fed reg dhs') !== -1 && f.value !== undefined && f.value >= 5) {
        this._activeConditions.push('domestic_instability');
        signals.push('Fed Reg DHS: ' + f.value + ' homeland security docs (30d)');
      }
      if (fn.indexOf('fed reg dhs') !== -1 && f.value !== undefined && f.value >= 10) {
        this._activeConditions.push('martial_response');
      }

      // NOAA NWS Alerts \u2014 severe weather \u2192 CIVIL_UNREST staging (mobilization for disasters)
      if (fn.indexOf('nws alerts') !== -1 && f.value !== undefined && f.value >= 200) {
        this._activeConditions.push('domestic_instability');
        signals.push('NWS: ' + f.value + ' active weather alerts \u2014 disaster mobilization staging');
      }

      // USGS Earthquakes \u2014 major seismic \u2192 LOGISTICS_COLLAPSE risk
      if (fn.indexOf('usgs earthquakes') !== -1 && f.value !== undefined && f.value >= 10) {
        this._activeConditions.push('logistics_failure');
        signals.push('USGS: ' + f.value + ' M4.5+ earthquakes 24h');
      }

      // OFAC Recent Actions \u2014 sanctions / proliferation / NUCLEAR_THREAT signal
      if (fn.indexOf('ofac') !== -1 && f.value !== undefined && f.value >= 15) {
        this._activeConditions.push('proliferation');
        signals.push('OFAC: ' + f.value + ' sanctions designation signals');
      }
      if (fn.indexOf('ofac') !== -1 && f.value !== undefined && f.value >= 30) {
        this._activeConditions.push('nuclear_escalation');
        this._activeConditions.push('deterrence_failure');
      }
    }

    for (var rsi = 0; rsi < rawSignals.length; rsi++) {
      var rs = (typeof rawSignals[rsi] === 'string' ? rawSignals[rsi] : '').toLowerCase();
      if (rs.indexOf('invasion') !== -1 || rs.indexOf('incursion') !== -1 || rs.indexOf('deploy') !== -1) {
        if (this._activeConditions.indexOf('invasion') === -1) this._activeConditions.push('invasion');
        if (this._activeConditions.indexOf('territorial_breach') === -1) this._activeConditions.push('territorial_breach');
      }
      if (rs.indexOf('cyber') !== -1 || rs.indexOf('hack') !== -1 || rs.indexOf('breach') !== -1) {
        if (this._activeConditions.indexOf('cyber_breach') === -1) this._activeConditions.push('cyber_breach');
      }
      if (rs.indexOf('nuclear') !== -1 || rs.indexOf('missile') !== -1 || rs.indexOf('warhead') !== -1) {
        if (this._activeConditions.indexOf('nuclear_escalation') === -1) this._activeConditions.push('nuclear_escalation');
      }
      if (rs.indexOf('unrest') !== -1 || rs.indexOf('protest') !== -1 || rs.indexOf('riot') !== -1) {
        if (this._activeConditions.indexOf('domestic_instability') === -1) this._activeConditions.push('domestic_instability');
      }
      if (rs.indexOf('logistics') !== -1 || rs.indexOf('supply') !== -1 && rs.indexOf('military') !== -1) {
        if (this._activeConditions.indexOf('logistics_failure') === -1) this._activeConditions.push('logistics_failure');
      }
    }

    // Cross-domain pressure
    if (window.LIMENDomainBrains) {
      var allBrains = window.LIMENDomainBrains.getAll();
      for (var bk in allBrains) {
        if (bk === 'defense') continue;
        var b = allBrains[bk]; if (!b || !b.state) continue;
        var bEm = b.state.crossDomainEmissions || [];
        for (var bei = 0; bei < bEm.length; bei++) {
          var be = bEm[bei];
          if (be.targetDomain === 'defense' && be.magnitude > 0.1) {
            signals.push('FEED [' + bk.toUpperCase() + ']: ' + (be.signal || '').replace(/_/g, ' ') + ' — ' + Math.round(be.magnitude * 100) + '%');
            if (this._activeConditions.indexOf('force_projection') === -1 && be.magnitude > 0.2) this._activeConditions.push('force_projection');
          }
        }
      }
    }

    var snap = this._getSnapshot();
    if (snap && snap.defenseSignals) {
      for (var si = 0; si < snap.defenseSignals.length; si++) {
        var sig = snap.defenseSignals[si];
        if (sig.affectedDomains && sig.affectedDomains.indexOf('defense') !== -1) {
          this._activeConditions.push(sig.eventType);
          signals.push('FEED [DEFENSE]: ' + (sig.eventType || '').replace(/_/g, ' '));
        }
      }
    }
    if (snap && snap.macroShock && snap.macroShock.detected) this._activeConditions.push('macro_shock');

    if (this.state.stress >= 0.30) { this._activeConditions.push('surveillance_miss'); this._activeConditions.push('analysis_failure'); }
    if (this.state.stress >= 0.45) { this._activeConditions.push('supply_chain_military'); this._activeConditions.push('domestic_instability'); }
    if (this.state.stress >= 0.55) this._activeConditions.push('defense_high_stress');
    if (this.state.stress >= 0.65) { this._activeConditions.push('deterrence_failure'); this._activeConditions.push('infrastructure_hack'); }
    if (this.state.maturity === 'STRUCTURAL') this._activeConditions.push('structural_stress');
    var extPressure = this.getExternalPressure ? this.getExternalPressure() : 0;
    if (extPressure >= 0.10) this._activeConditions.push('protest_escalation');

    this.state.signals = signals;
    return Promise.resolve();
  };

  DefenseBrain.prototype.deriveDiagnoses = function () {
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

  DefenseBrain.prototype.recommendTreatments = function () {
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

  DefenseBrain.prototype.surfaceOpportunities = function () {
    Base.prototype.surfaceOpportunities.call(this);
    var opps = [], stress = this.state.stress, activeDx = this.state.diagnoses.filter(function (d) { return d.active; }), allDx = this.state.diagnoses || [], companies = this.state.companies, seen = {};
    function add(o) { var key = o.title.toLowerCase().replace(/[^a-z0-9]/g, ''); if (seen[key]) return; seen[key] = true; opps.push(o); }
    for (var di = 0; di < activeDx.length; di++) {
      var dx = activeDx[di], dxLabel = (dx.label || dx.id || '').replace(/_/g, ' ');
      add({ title: dxLabel + ' — defense readiness and deterrence platform', rank: stress * dx.relevance, path: 'PATENTABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.50) add({ title: dxLabel + ' — defense procurement and modernization', rank: stress * dx.relevance * 0.9, path: 'GRANT-ELIGIBLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.55 && dx.relevance >= 0.2) add({ title: dxLabel + ' — cybersecurity and threat detection', rank: stress * 0.85, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      add({ title: dxLabel + ' — intelligence and surveillance technology', rank: stress * dx.relevance * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
    }
    var termCo = [] /* neutralized: distress only from validated gate (see energy-brain) */;
    if (termCo.length > 0) add({ title: 'Defense terminal entity distressed positioning', rank: 0.95, path: 'INVESTABLE', urgency: 'high', source: 'company_terminal', tier: 1, companies: termCo.map(function (c) { return c.ticker; }), stress: stress });
    if (this.state.convergence && this.state.convergence.primary_signal) add({ title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — defense convergence response', rank: 0.98, path: 'GRANT-ELIGIBLE', urgency: 'high', source: 'convergence', tier: 1, stress: stress });
    var emissions = this.state.crossDomainEmissions || [];
    for (var ei = 0; ei < emissions.length; ei++) { var em = emissions[ei]; add({ title: 'Defense \u2192 ' + (em.targetDomain || '').replace(/_/g, ' ') + ' — ' + (em.signal || em.signalType || '').replace(/_/g, ' '), rank: (em.magnitude || 0.5) * stress * 0.8, path: 'INVESTABLE', urgency: em.magnitude > 0.6 ? 'high' : 'medium', source: 'cross_domain', tier: 2, stress: stress }); }
    if (stress >= 0.50) { add({ title: 'Defense industrial base strengthening', rank: stress * 0.65, path: 'GRANT-ELIGIBLE', urgency: 'medium', source: 'lagging', tier: 3, stress: stress }); add({ title: 'Cybersecurity infrastructure hardening', rank: stress * 0.70, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, stress: stress }); }
    if (stress >= 0.60) { add({ title: 'Strategic deterrence modernization', rank: stress * 0.75, path: 'GRANT-ELIGIBLE', urgency: 'medium', source: 'lagging', tier: 3, stress: stress }); add({ title: 'Defense logistics and supply chain resilience', rank: stress * 0.68, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, stress: stress }); }
    var nearDx = allDx.filter(function (d) { return !d.active && d.relevance > 0 && d.totalTriggers > 0; });
    for (var ndi = 0; ndi < nearDx.length; ndi++) { if (stress >= 0.45) add({ title: (nearDx[ndi].label || '').replace(/_/g, ' ') + ' — early-stage monitoring', rank: stress * (nearDx[ndi].relevance || 0.1) * 0.5, path: 'PATENTABLE', urgency: 'watching', source: 'near_diagnosis', tier: 2, stress: stress, nearDiagnosisId: nearDx[ndi].id }); }
    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });
    // Canonical enrichment — merge defense playbook detail per opportunity
    var PB_LIST = window.LIMENDefenseOpportunityPlaybooks || [];
    var _byId = {};
    for (var _pbi = 0; _pbi < PB_LIST.length; _pbi++) _byId[PB_LIST[_pbi].id] = PB_LIST[_pbi];
    var _PB_MAP = {
      'INVASION': 'invasion_response',
      'CYBER_ATTACK': 'cyber_attack_defense',
      'NUCLEAR_THREAT': 'nuclear_threat',
      'INTELLIGENCE_FAILURE': 'intelligence_failure_defense',
      'LOGISTICS_COLLAPSE': 'logistics_collapse_defense',
      'CIVIL_UNREST': 'civil_unrest_defense'
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
    var _COMP = {
      'GRANT-ELIGIBLE': { type: 'grant',  base: 10, unit: '%',        tier: 1, nextTier: { tier: 2, comp: 15, requirement: '3 successful grant awards' },     maxTier: { tier: 3, comp: 25 } },
      'INVESTABLE':     { type: 'invest', base: 5,  unit: 'profit%',  tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
      'PATENTABLE':     { type: 'patent', base: 10, unit: 'royalty%', tier: 1, nextTier: { tier: 2, comp: 15, requirement: '3 patents filed' },                maxTier: { tier: 3, comp: 25 } }
    };
    for (var oi = 0; oi < opps.length; oi++) {
      var o = opps[oi];
      o.id = (o.diagnosisId || o.nearDiagnosisId || o.source || 'opp').replace(/[^a-zA-Z0-9]/g, '_') + '_' + (o.path || '').toLowerCase().replace(/[^a-z]/g, '') + '_t' + (o.tier || 0);
      o.domain = 'defense';
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
        var evidenceParts = ['Domain: defense', 'Stress: ' + stressPct + '%'];
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

  DefenseBrain.prototype._checkDiagnosisActions = function () {
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; }); if (activeDx.length === 0) return;
    var adapters = window.LIMENActionAdapters; if (!adapters) return;
    for (var i = 0; i < activeDx.length; i++) { var dx = activeDx[i]; if (adapters.getDrafts && adapters.getDrafts({ domain: 'defense', intentId: dx.id }).length > 0) continue; adapters.createDraft('REPORT_GENERATION', { domain: 'defense', sourceType: 'domain_brain', sourceId: dx.id, intentId: dx.id, title: 'Defense Alert: ' + dx.label, intent: { domain: 'defense', title: dx.label, status: 'ACTIVE', priority: this.state.stress, progress: 0, strategyType: 'diagnosis_response', steps: [{ type: 'ANALYZE', label: 'Assess ' + dx.label + ' impact', status: 'PENDING' }, { type: 'INVESTIGATE', label: 'Identify affected assets and forces', status: 'PENDING' }, { type: 'POSITION', label: 'Evaluate defense opportunities', status: 'PENDING' }] } }); }
  };

  DefenseBrain.prototype.resolveDeepContent = function () {
    var self = this; var resolver = window.LIMENPortalContentResolver; if (!resolver) return Promise.resolve();
    return resolver.resolveForBrain(this.state).then(function (content) { self.state.resolvedContent = content; if (content) { var dt = []; for (var dxId in content.byDiagnosis) { var dxC = content.byDiagnosis[dxId]; for (var i = 0; i < dxC.treatments.length; i++) { var t = dxC.treatments[i]; dt.push({ id: 'deep_' + t.nodeId + '_' + i, label: t.label, type: t.type, evidence: t.evidence, description: t.description, cite: t.cite, steps: t.steps, monitoring: t.monitoring, escalation: t.escalation, diagnosisId: dxId, nodeId: t.nodeId, nodeLabel: t.nodeLabel, hasDepth: t.hasDepth, source: 'canonical_deep' }); } } if (dt.length > 0) self.state.treatments = dt; } }).catch(function () {});
  };

  var _origCycle = DefenseBrain.prototype.cycle;
  DefenseBrain.prototype.cycle = function () { var self = this; return _origCycle.call(this).then(function () { return self.resolveDeepContent(); }); };

  var brain = new DefenseBrain(); brain.init(); brain.start();
  window.LIMENDefenseBrain = brain;
  window.LIMENDomainBrains.register(brain);

  // ══════════════════════════════════════════════════════════════════════
  // AUTO-LOAD DEFENSE OPERATOR STACK ON DOMAIN-CONSOLE
  // ══════════════════════════════════════════════════════════════════════

  var _isDomainConsole = window.location.pathname.indexOf('domain-console') !== -1 || window.location.pathname.indexOf('defense-console') !== -1;
  var _domParam = (new URLSearchParams(window.location.search)).get('domain');
  var _isDefenseDomain = _domParam === 'defense';
  if (_isDomainConsole && _isDefenseDomain) {
    window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION = true;

    var _defenseScripts = [
      'assets/js/defense-compensation.js',
      'assets/js/defense-claim-ledger.js',
      'assets/js/defense-claim-flow.js',
      'assets/js/defense-opportunity-economics.js',
      'assets/js/defense-pulse-engine.js',
      'assets/js/defense-operator-panel.js',
      'assets/js/defense-node-business-engine.js',
      'assets/js/defense-business-review.js',
      'assets/js/defense-execution-panels.js',
      'assets/js/defense-business-build.js',
      'assets/js/defense-directive-extractor.js',
      'assets/js/defense-directive-ranker.js',
      'assets/js/defense-directive-translator.js',
      'assets/js/defense-targeting-engine.js',
      'assets/js/defense-promotion-bridge.js',
      'assets/js/defense-clarity-operator.js'
    ];
    (function loadNext(i) {
      if (i >= _defenseScripts.length) return;
      var s = document.createElement('script');
      s.src = _defenseScripts[i];
      s.onload = function () { loadNext(i + 1); };
      s.onerror = function () { console.warn('[DefenseBrain] Failed to load ' + _defenseScripts[i]); loadNext(i + 1); };
      document.head.appendChild(s);
    })(0);
  }
})();
