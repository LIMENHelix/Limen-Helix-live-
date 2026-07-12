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

    // ── One-shot cognition loaders (mirror technology/culture init): real entities,
    //    validated distress signals, real source bundles, L1 mad-lib scan, readiness sub-layer. ──
    try { this._loadDefenseCommandBoardCompanies(); } catch (e) {}  // real defense entities (state.companies starved)
    try { this._loadDefenseBrainSignals(); } catch (e) {}           // distress ONLY from the validated Thing pipeline
    try { this._loadDefenseDiagnosisBundles(); } catch (e) {}       // load real artifact-source bundles (only ones that exist)
    try { this._loadDefenseL1PortalDepth(); } catch (e) {}          // scan L1 branches (treatments mad-lib -> NOT admitted; real tickers only)
    try { this._loadDefenseSublayer(); } catch (e) {}               // readiness / threat-posture sub-portal (SIPRI/NATO/CSIS/ISW)

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
      // Neuro-substrate telemetry (advisory): brain state (pulse-less capable) -> runtime overlay via generic adapter.
      try {
        if (window.DomainTelemetryAdapter && typeof window.DomainTelemetryAdapter.fromLiveCached === "function") {
          window.DomainTelemetryAdapter.fromLiveCached("defense", self.state, self._runtimeOverlay || null)
            .then(function (ov) { if (ov) self._runtimeOverlay = ov; }).catch(function () {});
        }
      } catch (_e) {}
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
      add({ title: dxLabel + ' — defense readiness and deterrence platform', rank: stress * dx.relevance, path: 'RESEARCHABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.50) add({ title: dxLabel + ' — defense procurement and modernization', rank: stress * dx.relevance * 0.9, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.55 && dx.relevance >= 0.2) add({ title: dxLabel + ' — cybersecurity and threat detection', rank: stress * 0.85, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      add({ title: dxLabel + ' — intelligence and surveillance technology', rank: stress * dx.relevance * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
    }
    // Defense entities come from command-board-data (real defense-industrial-base tickers) with a
    // canonical fallback (LMT/RTX/NOC/GD/BA/LHX/HII/LDOS/BAH/KTOS/AVAV). Distress band ('elevated') is
    // applied ONLY from the validated Thing pipeline (_pubSignals) — never inferred from raw phase.
    var coList = (companies && companies.length) ? companies : (this._cbDefenseCompanies || []);
    var pub = this._pubSignals || {};
    var termCo = coList.filter(function (c) { var p = c && c.ticker && pub[c.ticker]; return p && p.band === 'elevated'; });
    var stressedCo = coList.filter(function (c) { var p = c && c.ticker && pub[c.ticker]; return p && (p.band === 'elevated' || p.band === 'watch'); });
    if (termCo.length > 0) add({ title: 'Defense terminal entity distressed positioning', rank: 0.95, path: 'INVESTABLE', urgency: 'high', source: 'company_terminal', tier: 1, companies: termCo.map(function (c) { return c.ticker; }), stress: stress });
    if (stress >= 0.55 && activeDx.length > 0 && coList.length > 0) {
      add({ title: 'Military readiness surge — defense contractor positioning', rank: stress * 0.9, path: 'INVESTABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'company_surge', tier: 1, companies: coList.slice(0, 6).map(function (c) { return c.ticker; }).filter(Boolean), stress: stress });
      add({ title: 'Cyber warfare capability acceleration — defense tech investment', rank: stress * 0.82, path: 'INVESTABLE', urgency: 'medium', source: 'company_surge', tier: 1, companies: coList.map(function (c) { return c.ticker; }).filter(Boolean).slice(0, 4), stress: stress });
      add({ title: 'Deterrence modernization — strategic weapons programs', rank: stress * 0.78, path: 'RESEARCHABLE', urgency: 'medium', source: 'company_surge', tier: 1, companies: coList.map(function (c) { return c.ticker; }).filter(Boolean).slice(0, 5), stress: stress });
    }
    if (stressedCo.length > 0) add({ title: 'Defense industrial-base stress monitoring', rank: 0.6, path: 'RESEARCHABLE', urgency: 'watching', source: 'company_stressed', tier: 2, companies: stressedCo.map(function (c) { return c.ticker; }), stress: stress });
    if (this.state.convergence && this.state.convergence.primary_signal) add({ title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — defense convergence response', rank: 0.98, path: 'INVESTABLE', urgency: 'high', source: 'convergence', tier: 1, stress: stress });
    var emissions = this.state.crossDomainEmissions || [];
    for (var ei = 0; ei < emissions.length; ei++) { var em = emissions[ei]; add({ title: 'Defense \u2192 ' + (em.targetDomain || '').replace(/_/g, ' ') + ' — ' + (em.signal || em.signalType || '').replace(/_/g, ' '), rank: (em.magnitude || 0.5) * stress * 0.8, path: 'INVESTABLE', urgency: em.magnitude > 0.6 ? 'high' : 'medium', source: 'cross_domain', tier: 2, stress: stress }); }
    if (stress >= 0.50) { add({ title: 'Defense industrial base strengthening', rank: stress * 0.65, path: 'RESEARCHABLE', urgency: 'medium', source: 'lagging', tier: 3, stress: stress }); add({ title: 'Cybersecurity infrastructure hardening', rank: stress * 0.70, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, stress: stress }); }
    if (stress >= 0.60) { add({ title: 'Strategic deterrence modernization', rank: stress * 0.75, path: 'RESEARCHABLE', urgency: 'medium', source: 'lagging', tier: 3, stress: stress }); add({ title: 'Defense logistics and supply chain resilience', rank: stress * 0.68, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, stress: stress }); }
    var nearDx = allDx.filter(function (d) { return !d.active && d.relevance > 0 && d.totalTriggers > 0; });
    for (var ndi = 0; ndi < nearDx.length; ndi++) { if (stress >= 0.45) add({ title: (nearDx[ndi].label || '').replace(/_/g, ' ') + ' — early-stage monitoring', rank: stress * (nearDx[ndi].relevance || 0.1) * 0.5, path: 'RESEARCHABLE', urgency: 'watching', source: 'near_diagnosis', tier: 2, stress: stress, nearDiagnosisId: nearDx[ndi].id }); }
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
      'INVASION': 'invasion_response',
      'CYBER_ATTACK': 'cyber_attack_defense',
      'NUCLEAR_THREAT': 'nuclear_threat',
      'INTELLIGENCE_FAILURE': 'intelligence_failure_defense',
      'LOGISTICS_COLLAPSE': 'logistics_collapse_defense',
      'CIVIL_UNREST': 'civil_unrest_defense'
    };
    function _resolvePbId(o) {
      if (o.diagnosisId && _PB_MAP[o.diagnosisId]) return _PB_MAP[o.diagnosisId];
      if (o.source === 'lagging' && o.diagnosisId && _LAGGING_MAP[o.diagnosisId]) return _LAGGING_MAP[o.diagnosisId];
      if (o.nearDiagnosisId && _PB_MAP[o.nearDiagnosisId]) return _PB_MAP[o.nearDiagnosisId];
      return null;
    }
    function _urgencyLabel(u) { if (u === 'high') return 'IMMEDIATE'; if (u === 'medium') return 'ACTIVE'; if (u === 'watching') return 'WATCH'; return (u || '').toUpperCase(); }
    var _COMP = {
      'INVESTABLE':   { type: 'invest',   base: 5,  unit: 'profit%', tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
      'RESEARCHABLE': { type: 'research', base: 8,  unit: 'cite%',   tier: 1, nextTier: { tier: 2, comp: 12, requirement: '3 published research outputs' },  maxTier: { tier: 3, comp: 20 } }
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
        else if (o.path === 'RESEARCHABLE' && pb.realWorld && (pb.realWorld.research || pb.realWorld.build)) target = pb.realWorld.research || pb.realWorld.build;
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

  // ── COGNITION PORT (GUARD: reads the validated spine — state.{stress,diagnoses,opportunities,feeds} —
  //    and writes ONLY NEW keys: state.defenseModel, state.defense{Immune,Awareness,Conscience,Intuition,
  //    Simulation,ExecutiveReport}, state.cognition, state.readinessPostureLayer. NEVER alters scoreStress
  //    or deriveDiagnoses. The recurrent update is try/catch-guarded so it can never break the cycle.) ──
  var _origCycle = DefenseBrain.prototype.cycle;
  DefenseBrain.prototype.cycle = function () {
    var self = this;
    return _origCycle.call(this).then(function () {
      return self.resolveDeepContent();
    }).then(function () {
      // Higher cognition: predictive self-model + metacognition (runs AFTER diagnoses settle)
      try { self._updateDefenseModel(); } catch (e) {}
    });
  };

  // ══════════════════════════════════════════════════════════════════════
  // HIGHER COGNITION — predictive self-model + metacognition (defense).
  // Generic predictive-coding substrate (prior → observe → prediction error →
  // regulation → update prior) + awareness / conscience / immune / intuition /
  // simulation / executive-report. Mirrors technology/culture STRUCTURE exactly;
  // only the CONTENT is defense (military spending & procurement, the defense
  // industrial base, geopolitical conflict & deterrence, weapons systems, military
  // readiness, alliances & basing, electronic/kinetic warfare, strategic deterrence).
  // ══════════════════════════════════════════════════════════════════════
  var DM_VERSION = 1;
  var DM_LEARNING_RATE = 0.25;
  var DM_SLOW_RATE = 0.08;
  var DM_STRESS_FLOOR = 0.30;
  var DM_FLOOD_CAP = 12;
  var DM_STALE_MS = 1000 * 60 * 60 * 6;
  var _dmClamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  var _dmJaccardDistance = function (a, b) {
    a = a || []; b = b || [];
    if (!a.length && !b.length) return 0;
    var sa = {}, inter = 0;
    a.forEach(function (x) { sa[x] = 1; });
    b.forEach(function (x) { if (sa[x]) inter++; });
    var uni = a.length + b.length - inter;
    return uni ? 1 - inter / uni : 0;
  };

  (function () {
    var P = DefenseBrain.prototype;

    // Defense diagnosis families — an analogy lens for monitoring, NOT evidence.
    var FAMILY = {
      'kinetic': ['INVASION', 'NUCLEAR_THREAT'],
      'cyber': ['CYBER_ATTACK', 'INTELLIGENCE_FAILURE'],
      'logistics': ['LOGISTICS_COLLAPSE', 'INVASION'],
      'domestic': ['CIVIL_UNREST', 'INTELLIGENCE_FAILURE'],
      'strategic': ['NUCLEAR_THREAT', 'INVASION']
    };

    P._neutralDefenseModel = function () {
      return { version: DM_VERSION, cycle: 0, prior: { expectedStress: 0.5, expectedDiagnoses: [], expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, confidence: 0, samples: 0 }, observation: null, predictionError: null, predictedStress: null, regulation: null, plasticity: { learningRate: DM_LEARNING_RATE, slowRate: DM_SLOW_RATE, consolidation: 0 }, readyForHandoff: false, _lowErrorStreak: 0, updated: 0 };
    };
    P._buildDefenseObservation = function () {
      var s = this.state || {};
      var active = (s.diagnoses || []).filter(function (d) { return d.active; });
      // signal = breadth of live defense feeds (SIPRI/CSIS/ACLED/CISA/OFAC/Jane's/ISW + threat-feed freshness)
      var feeds = s.feeds || [], fc = 0, newest = 0;
      if (Array.isArray(feeds)) {
        for (var i = 0; i < feeds.length; i++) { var fv = feeds[i]; if (fv) { fc++; var u = fv.updated; if (u && u > newest) newest = u; } }
      } else { for (var k in feeds) { if (feeds.hasOwnProperty(k)) { fc++; var u2 = feeds[k] && feeds[k].updated; if (u2 && u2 > newest) newest = u2; } } }
      // companyCount = DEFENSE ENTITIES (prime contractors / defense industrial base firms)
      var companyCount = (s.companies || []).length;
      return { stress: typeof s.stress === 'number' ? s.stress : 0, phase: s.phase || null, activeDiagnoses: active.map(function (d) { return d.id; }).sort(), diagnosisCount: active.length, opportunityCount: (s.opportunities || []).length, companyCount: companyCount, signal: Math.min(1, fc / 8), feedNewest: newest, timestamp: Date.now() };
    };
    P._computeDefensePredictionError = function (prior, obs) {
      var se = Math.abs(obs.stress - prior.expectedStress), sg = Math.abs(obs.signal - prior.expectedSignal), de = _dmJaccardDistance(obs.activeDiagnoses, prior.expectedDiagnoses);
      var od = Math.max(1, prior.expectedOpportunityCount, obs.opportunityCount), oe = Math.abs(obs.opportunityCount - prior.expectedOpportunityCount) / od;
      var total = _dmClamp(0.4 * se + 0.2 * sg + 0.25 * de + 0.15 * oe, 0, 1);
      return { total: total, stressError: se, signalError: sg, diagnosisError: de, opportunityError: oe, novelty: Math.max(se, de) };
    };
    P._updateDefensePrior = function (prior, obs, lr) {
      return { expectedStress: _dmClamp(prior.expectedStress + lr * (obs.stress - prior.expectedStress), 0, 1), expectedDiagnoses: obs.activeDiagnoses.slice(), expectedDiagnosisCount: prior.expectedDiagnosisCount + lr * (obs.diagnosisCount - prior.expectedDiagnosisCount), expectedOpportunityCount: prior.expectedOpportunityCount + lr * (obs.opportunityCount - prior.expectedOpportunityCount), expectedSignal: _dmClamp(prior.expectedSignal + lr * (obs.signal - prior.expectedSignal), 0, 1), confidence: _dmClamp(Math.min(1, (prior.samples + 1) / 20), 0, 1), samples: prior.samples + 1 };
    };
    P._computeDefenseRegulation = function (dm, obs, pe) {
      var gain = _dmClamp(pe.novelty, 0.05, 0.95), inhib = _dmClamp(1 - pe.novelty, 0, 0.9);
      var starving = obs.stress >= DM_STRESS_FLOOR && obs.opportunityCount === 0, flooding = obs.opportunityCount > DM_FLOOD_CAP;
      var streak = (pe.total < 0.05) ? (dm._lowErrorStreak || 0) + 1 : 0; dm._lowErrorStreak = streak; var looping = streak >= 3;
      var stale = obs.feedNewest > 0 ? (Date.now() - obs.feedNewest) > DM_STALE_MS : false;
      var overconf = dm.prior.confidence > 0.8 && pe.total > 0.4;
      var label = flooding ? 'flooding' : starving ? 'starving' : stale ? 'stale' : looping ? 'looping' : overconf ? 'overconfident' : pe.novelty > 0.4 ? 'surprised' : 'calm';
      return { gain: gain, inhibition: inhib, starving: starving, flooding: flooding, looping: looping, stale: stale, overconfident: overconf, state: label };
    };

    // ── RECURRENT STEP — the proof surface (state.defenseModel) the Civilization cockpit reads ──
    P._updateDefenseModel = function () {
      var dm = this.state.defenseModel || this._neutralDefenseModel();
      var priorIn = dm.prior;
      var obs = this._buildDefenseObservation();
      var pe = this._computeDefensePredictionError(priorIn, obs);
      var gainBlend = _dmClamp(pe.novelty, 0.05, 0.95);
      var predictedStress = priorIn.expectedStress * (1 - gainBlend) + obs.stress * gainBlend;
      var reg = this._computeDefenseRegulation(dm, obs, pe);
      var readyForHandoff = (dm.cycle > 0) && (predictedStress >= DM_STRESS_FLOOR) && (obs.diagnosisCount > 0) && !reg.flooding && !reg.stale;
      var nextPrior = this._updateDefensePrior(priorIn, obs, dm.plasticity.learningRate);
      dm.cycle += 1; dm.observation = obs; dm.predictionError = pe; dm.predictedStress = predictedStress; dm.regulation = reg; dm.readyForHandoff = readyForHandoff; dm.prior = nextPrior; dm.updated = obs.timestamp;
      this.state.defenseModel = dm;

      var mem = this.state.memory || (this.state.memory = {});
      var log = mem.outcomeLog || (mem.outcomeLog = []);
      log.push({ cycle: dm.cycle, predictionError: Math.round(pe.total * 1000) / 1000, stress: obs.stress, activeDx: obs.diagnosisCount, regulation: reg.state, timestamp: obs.timestamp }); if (log.length > 40) log.shift();

      try { this._computeDefenseHigherLayers(); } catch (e) {}

      // READINESS — force-posture / threat-environment sub-portal layer (additive; BEFORE the DDP build
      // so the primary packet's promptView advertises it). Never touches the validated spine.
      try { this._buildDefenseReadinessSublayer(); } catch (e) {}

      // DDP — build the DomainDiagnosisPacket (8-section contract) for the primary diagnosis,
      // and one per diagnosis. Schema-only: never invents data. Consumed by the Civilization cockpit.
      try {
        var _diags = this.state.diagnoses || [];
        var _primary = _diags.filter(function (d) { return d.active; })[0] || _diags[0] || null;
        var _self = this;
        dm.domainDiagnosisPacket = this._buildDomainDiagnosisPacket(_primary);
        this.state.defenseDomainDiagnosisPackets = _diags.map(function (d) { return _self._buildDomainDiagnosisPacket(d); });
      } catch (e) {}

      // state.cognition — generic surface domain-console-brain.js reads for ANY brain.
      this.state.cognition = {
        domain: 'defense',
        defenseModel: dm,
        model: { cycle: dm.cycle, predictionError: dm.predictionError, predictedStress: dm.predictedStress, regulation: dm.regulation },
        defenseImmune: this.state.defenseImmune || null,
        defenseAwareness: this.state.defenseAwareness || null,
        defenseConscience: this.state.defenseConscience || null,
        defenseIntuition: this.state.defenseIntuition || null,
        defenseSimulation: this.state.defenseSimulation || null,
        defenseExecutiveReport: this.state.defenseExecutiveReport || null,
        awareness: this.state.defenseAwareness || null,
        conscience: this.state.defenseConscience || null,
        immune: this.state.defenseImmune || null,
        intuition: this.state.defenseIntuition || null,
        sceneLayer: this.state.readinessPostureLayer || null,
        readinessLayer: this.state.readinessPostureLayer || null,
        treatments: this.state.treatments || [],
        diagnoses: this.state.diagnoses || [],
        opportunities: this.state.opportunities || []
      };
      return dm;
    };

    P._computeDefenseHigherLayers = function () {
      this._computeDefenseImmune(); this._computeDefenseAwareness(); this._computeDefenseConscience(); this._computeDefenseIntuition();
      try { this._computeDefenseSimulation(); } catch (e) {}
      try { this._computeDefenseExecutiveReport(); } catch (e) {}
    };

    // ── H1 — immune (antigen scan over bundle/feed/regulation state) ──
    P._computeDefenseImmune = function () {
      var s = this.state, dm = s.defenseModel || {}, reg = dm.regulation || {}, ant = [];
      var bs = (typeof this._defenseBundleStates === 'function') ? this._defenseBundleStates() : [];
      bs.forEach(function (b) {
        if (b.bundleStatus === 'missing') ant.push({ type: 'source-bundle-missing', dx: b.dxId, severity: 'medium', action: 'block-from-prompt-evidence' });
        if (b.buildMethod === 'external-source-authored') ant.push({ type: 'external-source-authored-needs-human-verification', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
        if (b.aliasRisk === 'medium' || b.aliasRisk === 'high') ant.push({ type: 'alias-risk-bundle', dx: b.dxId, severity: b.aliasRisk, action: 'allow-with-warning' });
        if (b.bundleStatus === 'found' && b.shallow) ant.push({ type: 'root-only-shallow-bundle', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
      });
      var pe = (dm.predictionError && dm.predictionError.total) || 0;
      if (pe > 0.4) ant.push({ type: 'prediction-error-spike', severity: 'medium', action: 'lower-confidence', value: Math.round(pe * 1000) / 1000 });
      if (reg.stale) ant.push({ type: 'stale-feeds', severity: 'low', action: 'flag' });
      if (reg.flooding) ant.push({ type: 'opportunity-flood', severity: 'medium', action: 'inhibit' });
      if (reg.starving) ant.push({ type: 'stress-without-opportunity', severity: 'low', action: 'flag' });
      var _l1 = s._l1DepthCache;
      if (_l1 && _l1.byDiagnosis && Object.keys(_l1.byDiagnosis).some(function (dx) { return _l1.byDiagnosis[dx].madLibTreatments > 0; })) {
        ant.push({ type: 'l1-synthetic-treatments', severity: 'medium', action: 'quarantine', note: 'L1 portal treatments are mad-lib templates (fixed-verb family); quarantined from evidence — only real defense contractor tickers surfaced relevance-unverified' });
      }
      var sev = ant.some(function (a) { return a.severity === 'high'; }) ? 'high' : ant.some(function (a) { return a.severity === 'medium'; }) ? 'medium' : ant.length ? 'low' : 'none';
      s.defenseImmune = {
        version: 1, immuneState: sev === 'high' ? 'alert' : sev === 'medium' ? 'active' : sev === 'low' ? 'watch' : 'clear', severity: sev,
        antigens: ant.slice(0, 12),
        quarantines: ['L1-portal-treatments-madlib'],
        allowedWithWarning: ant.filter(function (a) { return a.action === 'allow-with-warning'; }).map(function (a) { return a.type + (a.dx ? (':' + a.dx) : ''); }),
        blockedFromPrompt: ant.filter(function (a) { return a.action === 'block-from-prompt-evidence'; }).map(function (a) { return a.dx; }),
        blockedFromTraversal: ['L2'],
        lastScanAt: dm.updated || null
      };
      return s.defenseImmune;
    };
    // ── H2 — awareness (narrative on readiness / deterrence / threat-posture pressure) ──
    P._computeDefenseAwareness = function () {
      var s = this.state, dm = s.defenseModel || {}, im = s.defenseImmune || {}, active = (s.diagnoses || []).filter(function (d) { return d.active; });
      var pe = (dm.predictionError && dm.predictionError.total) || 0, dxNames = active.map(function (d) { return d.label || d.id; });
      s.defenseAwareness = {
        version: 1, selfState: im.immuneState === 'alert' ? 'guarded' : (dm.regulation && dm.regulation.state) || 'unknown',
        knowns: dxNames.slice(0, 6),
        uncertainties: ['interpretive tracker — diagnoses are signal-driven readings of readiness/deterrence/threat pressure, not validated', 'predictionError=' + (Math.round(pe * 1000) / 1000)],
        confidenceDrivers: ['regulation ' + ((dm.regulation && dm.regulation.state) || '?'), active.length + ' active dx'],
        selfNarrative: 'Defense: ' + active.length + ' active diagnosis pathway' + (active.length !== 1 ? 's' : '') + ' (' + (dxNames.slice(0, 3).join(', ') || 'none') + '), regulation=' + ((dm.regulation && dm.regulation.state) || '?') + ', immune=' + (im.immuneState || '?') + ', prediction-error ' + (Math.round(pe * 100) / 100) + '.',
        lastAwarenessAt: dm.updated || null
      };
      return s.defenseAwareness;
    };
    // ── H3 — conscience (artifact readiness; DEFENSE does INVESTABLE/RESEARCHABLE only — no patent/grant
    //    per 2026 rules; PLUS a dual-use / export-control veto (ITAR/EAR) on kinetic & nuclear diagnoses) ──
    P._computeDefenseConscience = function () {
      var s = this.state, dm = s.defenseModel || {}, pe = (dm.predictionError && dm.predictionError.total) || 0, cautions = [];
      var active = (s.diagnoses || []).filter(function (d) { return d.active; });
      var sensitiveActive = active.some(function (d) { return d.id === 'NUCLEAR_THREAT' || d.id === 'INVASION' || d.id === 'CYBER_ATTACK'; });
      var im = s.defenseImmune || {};
      if (pe > 0.4) cautions.push({ claim: 'high-confidence-claim', reason: 'predictionError spike ' + (Math.round(pe * 1000) / 1000) });
      if (dm.regulation && dm.regulation.starving) cautions.push({ claim: 'opportunity-claim', reason: 'stress without grounded opportunity (starving)' });
      cautions.push({ claim: 'high-PE-procurement-claim', reason: 'defense procurement claims require validated readiness evidence, not feed-driven inference' });
      var conscienceState = (im.immuneState === 'alert' || (sensitiveActive && pe > 0.4)) ? 'restrictive' : (sensitiveActive || pe > 0.25) ? 'cautious' : 'open';
      var vetoes = [{ claim: 'patent/grant', reason: 'patent/grant lanes retired across all domains (2026-06-21); defense surfaces source-grounded readiness briefs, not filings' }];
      if (sensitiveActive) vetoes.push({ claim: 'dual-use-export', reason: 'kinetic/nuclear/cyber diagnosis active — ITAR/EAR export-control risk (weapons platforms, munitions, crypto, strategic systems); no export-restricted claims' });
      var blockedClaims = ['patent-claim', 'grant-claim'];
      if (sensitiveActive) blockedClaims.push('export-restricted');
      s.defenseConscience = {
        version: 1, conscienceState: conscienceState,
        vetoes: vetoes, cautions: cautions.slice(0, 8),
        allowedClaims: ['source-summary', 'defense-readiness-brief-with-warnings'],
        blockedClaims: blockedClaims,
        artifactReadinessDecision: { patentReady: false, grantReady: false, investmentReady: true, researchReady: true, exportReady: !sensitiveActive, note: 'patent/grant vetoed; investment/research allowed-with-warning; export-restricted (ITAR/EAR) claims vetoed while a kinetic/nuclear/cyber diagnosis is active' },
        reasons: ['overclaim prevention', 'interpretive-not-validated', 'dual-use / export-control conscientiousness'],
        lastCheckAt: dm.updated || null
      };
      return s.defenseConscience;
    };
    // ── H4 — intuition (hunches on emerging threat vectors / adversary doctrine shift) ──
    P._computeDefenseIntuition = function () {
      var s = this.state, dm = s.defenseModel || {}, reg = dm.regulation || {}, log = (s.memory && s.memory.outcomeLog) || [], hunches = [];
      if (log.length >= 2) { var a = log[log.length - 2].predictionError, b = log[log.length - 1].predictionError; if (typeof a === 'number' && typeof b === 'number' && b - a > 0.05) hunches.push({ hunch: 'emerging threat-vector regime shift (prediction error rising) — adversary doctrine change or new conflict signal entering feeds (TASS/Xinhua/Press TV surge, OFAC escalation, SIPRI arms-race signal)', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'predictionError rose ' + a + ' → ' + b }); }
      if (reg.state === 'surprised') hunches.push({ hunch: 'novel defense stressor entering the feed (force mobilization, missile test, alliance fracture, cyber campaign)', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'regulation = surprised' });
      var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
      var primaryId = (active[0] || {}).id, analogies = [];
      Object.keys(FAMILY).forEach(function (fam) { if (FAMILY[fam].indexOf(primaryId) >= 0) { FAMILY[fam].forEach(function (sib) { if (sib !== primaryId) analogies.push({ analogy: primaryId + ' resembles ' + sib, family: fam, evidenceStatus: 'UNVERIFIED' }); }); } });
      s.defenseIntuition = { version: 1, hunches: hunches.slice(0, 6), analogies: analogies.slice(0, 6), lastAt: dm.updated || null };
      return s.defenseIntuition;
    };
    // ── H5 — bounded counterfactual simulation (hypothetical only; UNVERIFIED) ──
    P._computeDefenseSimulation = function () {
      var s = this.state, dm = s.defenseModel || {};
      var base = typeof s.stress === 'number' ? s.stress : 0;
      function cl(v) { return Math.max(0, Math.min(1, Math.round(v * 1000) / 1000)); }
      var scenarios = [
        { type: 'taiwan_strait_escalation', hypothetical: true, assumption: 'a PRC blockade/quarantine of Taiwan triggers an Indo-Pacific force-projection crisis', simulatedStress: cl(base + 0.35), risk: 'territorial breach / force projection (INVASION)', intervention: 'carrier-group repositioning / allied coordination / munitions surge', falsifier: 'deterrence holds, no kinetic escalation and shipping lanes stay open' },
        { type: 'nato_article5_trigger', hypothetical: true, assumption: 'an attack on a NATO member invokes Article 5 collective defense', simulatedStress: cl(base + 0.3), risk: 'alliance-wide mobilization / deterrence failure (INVASION / NUCLEAR_THREAT)', intervention: 'rapid-reaction force deployment / ammo-stock drawdown / basing reinforcement', falsifier: 'crisis de-escalates diplomatically before collective-defense activation' },
        { type: 'nuclear_posture_shift', hypothetical: true, assumption: 'an adversary raises strategic-forces alert level / breaks an arms-control regime', simulatedStress: cl(base + 0.4), risk: 'strategic deterrence failure / proliferation (NUCLEAR_THREAT)', intervention: 'strategic-deterrence modernization / signaling / NC3 hardening', falsifier: 'verification regimes confirm no real posture change and signaling de-escalates' },
        { type: 'cyber_critical_infrastructure', hypothetical: true, assumption: 'a state cyber campaign targets grid / C2 / comms critical infrastructure', simulatedStress: cl(base + 0.3), risk: 'cyber attack on military and civil systems (CYBER_ATTACK)', intervention: 'zero-trust segmentation / CISA advisory cadence / C2 resilience', falsifier: 'intrusions contained, no degradation of command-control or critical services' },
        { type: 'logistics_node_collapse', hypothetical: true, assumption: 'a forward logistics node / munitions production line is disabled or saturated', simulatedStress: cl(base + 0.28), risk: 'readiness gap / supply-chain failure (LOGISTICS_COLLAPSE)', intervention: 'production-rate surge / onshoring / pre-positioned stock', falsifier: 'alternate logistics throughput and stockpiles absorb the disruption' },
        { type: 'domestic_mobilization', hypothetical: true, assumption: 'sustained civil unrest forces a domestic military / National Guard response', simulatedStress: cl(base + 0.22), risk: 'domestic instability / martial response (CIVIL_UNREST)', intervention: 'measured Guard activation / civil-military coordination / de-escalation', falsifier: 'unrest subsides under civilian law enforcement without military deployment' }
      ];
      var sim = {
        version: 1, scenarios: scenarios, assumptions: scenarios.map(function (x) { return x.assumption; }),
        simulatedStress: scenarios.map(function (x) { return x.simulatedStress; }),
        simulatedDiagnoses: ['INVASION', 'NUCLEAR_THREAT', 'CYBER_ATTACK', 'LOGISTICS_COLLAPSE'], simulatedOpportunities: [],
        risks: scenarios.map(function (x) { return x.risk; }), interventions: scenarios.map(function (x) { return x.intervention; }),
        falsifiers: scenarios.map(function (x) { return x.falsifier; }), lastSimulatedAt: dm.updated || null
      };
      s.defenseSimulation = sim; return sim;
    };
    // ── H6 — executive self-report (compact status card) ──
    P._computeDefenseExecutiveReport = function () {
      var s = this.state, dm = s.defenseModel || {}, im = s.defenseImmune || {}, aw = s.defenseAwareness || {}, con = s.defenseConscience || {}, it = s.defenseIntuition || {}, sim = s.defenseSimulation || {};
      var bs = (typeof this._defenseBundleStates === 'function') ? this._defenseBundleStates() : [];
      var covered = bs.filter(function (b) { return b.bundleStatus === 'found'; }).length;
      var hv = bs.filter(function (b) { return b.humanVerification === 'required'; }).length;
      var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
      var strongest = active[0] || (s.diagnoses || [])[0] || null;
      var pe = (dm.predictionError && dm.predictionError.total) || 0;
      var status = im.immuneState === 'alert' ? 'immune-alert' : hv > 0 ? 'human-review-required' : (bs.length && covered < bs.length) ? 'source-limited' : (dm.regulation && dm.regulation.starving) ? 'starving' : (dm.regulation && dm.regulation.state === 'surprised') ? 'surprised' : 'healthy';
      var rep = {
        version: 1, brainStatus: status,
        strongestDiagnosis: strongest ? strongest.id : null,
        strongestOpportunity: (s.opportunities && s.opportunities[0] && s.opportunities[0].title) || null,
        confidence: Math.round((1 - pe) * 100) / 100, predictionError: Math.round(pe * 1000) / 1000,
        regulationState: (dm.regulation && dm.regulation.state) || null, immuneState: im.immuneState || null,
        awarenessSummary: aw.selfNarrative || null, conscienceDecision: con.conscienceState || null,
        intuitionSummary: (it.hunches || []).length + ' hunch(es)', simulationSummary: (sim.scenarios || []).length + ' scenario(s)',
        readinessDecision: (dm.regulation && dm.regulation.state === 'calm' && status === 'healthy') ? 'posture-nominal' : (status === 'starving' || status === 'surprised') ? 'posture-elevated' : 'posture-watch',
        artifactReadiness: con.artifactReadinessDecision || null, blockers: (con.blockedClaims || []).slice(0, 6),
        nextBestAction: (bs.length && covered < bs.length) ? 'build/verify source for uncovered diagnoses (ensure conflict/cyber/nuclear/logistics sources are current)' : hv > 0 ? 'human-verify external-source bundles' : 'monitor strongest diagnosis sources (ACLED/ISW conflict velocity, CISA cyber advisories, OFAC/SIPRI escalation, NATO readiness signals)',
        lastReportAt: dm.updated || null
      };
      s.defenseExecutiveReport = rep; return rep;
    };
  })();

  // ════════════════════════════════════════════════════════════════════════════
  // DEFENSE COGNITION PARITY — fallback loaders, source-bundle machinery, L1 mad-lib
  // scan, readiness/threat-posture sub-portal layer, and the 8-section DomainDiagnosisPacket the
  // Civilization cockpit consumes. Mirrors technology/culture STRUCTURE exactly; only the
  // CONTENT is defense (procurement, defense industrial base, deterrence, weapons systems,
  // readiness, alliances/basing, kinetic/electronic warfare). Never fabricates evidence.
  // ════════════════════════════════════════════════════════════════════════════

  // ── DDP schema helpers ──
  var DEF_DDP_SCHEMA_VERSION = 'defense-ddp-1';
  function _defDdpPresent(v) {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (v === 'missing' || v === '' || v === 'none') return false;
    return true;
  }
  function _defDdpCompleteness(section, keys) {
    var have = 0; for (var i = 0; i < keys.length; i++) { if (_defDdpPresent(section[keys[i]])) have++; }
    return { have: have, total: keys.length, pct: keys.length ? Math.round(have / keys.length * 100) : 0 };
  }

  // ── Fallback: real defense entities from command-board-data (state.companies starved). One-shot. ──
  DefenseBrain.prototype._loadDefenseCommandBoardCompanies = function () {
    var self = this;
    if (self._cbDefenseCompanies) return;            // one-shot
    self._cbDefenseCompanies = [];
    try {
      fetch('/assets/data/command-board-data.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data) return;
          var arr = Array.isArray(data) ? data : (Object.keys(data).map(function (k) { return data[k]; }).find(Array.isArray) || []);
          self._cbDefenseCompanies = arr
            .filter(function (x) { return x && x.d === 'defense' && x.t; })
            .map(function (x) { return { name: x.n, ticker: x.t, cik: x.c, phase: x.p, trajectory: x.tr }; });
          // Real-ticker fallback so opportunity discovery is grounded even if the board lacks
          // defense rows. These are the canonical defense industrial-base entities (primes/contractors).
          if (!self._cbDefenseCompanies.length) {
            self._cbDefenseCompanies = [
              { name: 'Lockheed Martin', ticker: 'LMT' }, { name: 'RTX (Raytheon)', ticker: 'RTX' }, { name: 'Northrop Grumman', ticker: 'NOC' },
              { name: 'General Dynamics', ticker: 'GD' }, { name: 'Boeing', ticker: 'BA' }, { name: 'L3Harris Technologies', ticker: 'LHX' },
              { name: 'Huntington Ingalls Industries', ticker: 'HII' }, { name: 'Leidos', ticker: 'LDOS' }, { name: 'Booz Allen Hamilton', ticker: 'BAH' },
              { name: 'Kratos Defense', ticker: 'KTOS' }, { name: 'AeroVironment', ticker: 'AVAV' }
            ];
          }
        })
        .catch(function () {});
    } catch (e) {}
  };

  // ── Distress signals come ONLY from the validated Thing pipeline. One-shot. ──
  DefenseBrain.prototype._loadDefenseBrainSignals = function () {
    var self = this;
    if (self._pubSignals) return;                  // one-shot
    self._pubSignals = {};
    try {
      fetch('/api/brain-signals?domain=defense')
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
  //    else DEFENSE_DIAGNOSIS_ALIASES. Non-aliased diagnoses are canonical to themselves. ──
  var DEFENSE_DIAGNOSIS_ALIASES = {
    INVASION:             { target: 'INVASION', reviewStatus: null, risk: 'low', note: 'canonical to self' },
    CYBER_ATTACK:         { target: 'CYBER_ATTACK', reviewStatus: null, risk: 'low', note: 'canonical to self (military/critical-infrastructure sense)' },
    NUCLEAR_THREAT:       { target: 'NUCLEAR_THREAT', reviewStatus: null, risk: 'low', note: 'canonical to self' },
    INTELLIGENCE_FAILURE: { target: 'INTELLIGENCE_FAILURE', reviewStatus: null, risk: 'low', note: 'canonical to self (defense-readiness sense; collection/analysis is the intelligence domain)' },
    LOGISTICS_COLLAPSE:   { target: 'LOGISTICS_COLLAPSE', reviewStatus: null, risk: 'low', note: 'canonical to self (military supply-chain / readiness sense)' },
    CIVIL_UNREST:         { target: 'CIVIL_UNREST', reviewStatus: null, risk: 'low', note: 'canonical to self (domestic-mobilization sense)' }
  };
  DefenseBrain.prototype._resolveDefenseCanonicalDiagnosis = function (dxId) {
    if (!dxId) return { canonicalDiagnosisId: null, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };
    var target = null;
    try {
      var idx = (typeof window !== 'undefined') ? window.LIMENArtifactSourceIndex : null;
      if (idx && idx.aliases) { var row = idx.aliases()[dxId]; if (row && row.target) target = row.target; }
    } catch (e) {}
    var local = DEFENSE_DIAGNOSIS_ALIASES[dxId] || null;
    if (!target && local) target = local.target;
    if (target && target !== dxId) {
      return { canonicalDiagnosisId: target, aliasUsed: true, aliasReviewStatus: (local && local.reviewStatus) || 'corpus-aliased', aliasRisk: (local && local.risk) || 'low', aliasNote: (local && local.note) || null };
    }
    return { canonicalDiagnosisId: (target || dxId), aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };   // canonical to self
  };

  // ── Load REAL source bundles (one-shot, async). Resolves aliases BEFORE fetching.
  //    Only files that exist resolve to 'found'; 404s -> 'missing'. Never fabricates. ──
  DefenseBrain.prototype._loadDefenseDiagnosisBundles = function () {
    var self = this;
    if (self._defenseBundleLoadPromise) return self._defenseBundleLoadPromise;
    self._bundleCache = self._bundleCache || {};
    self._bundleStatusMap = self._bundleStatusMap || {};
    var ids = {};
    var known = ['INVASION', 'CYBER_ATTACK', 'NUCLEAR_THREAT', 'INTELLIGENCE_FAILURE', 'LOGISTICS_COLLAPSE', 'CIVIL_UNREST'];
    var diags = (self.state && self.state.diagnoses) || [];
    var allDxIds = diags.map(function (d) { return d.id; }).concat(known);
    for (var i = 0; i < allDxIds.length; i++) { var c = self._resolveDefenseCanonicalDiagnosis(allDxIds[i]).canonicalDiagnosisId; if (c) ids[c] = true; }
    self._defenseBundleLoadPromise = Promise.all(Object.keys(ids).map(function (cid) {
      return fetch('/assets/data/artifact-source-index/by-diagnosis/' + encodeURIComponent(cid) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) { self._bundleStatusMap[cid] = data ? 'found' : 'missing'; if (data) self._bundleCache[cid] = data; })
        .catch(function () { self._bundleStatusMap[cid] = 'missing'; });
    })).then(function () { return self._bundleCache; });
    return self._defenseBundleLoadPromise;
  };

  // ── _defenseBundleStates — per-diagnosis canonical resolution + bundle status + provenance ──
  DefenseBrain.prototype._defenseBundleStates = function () {
    var self = this; var diags = (this.state && this.state.diagnoses) || [];
    return diags.map(function (d) {
      var c = self._resolveDefenseCanonicalDiagnosis(d.id);
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
  //    evidence. Only real defense contractor tickers surface (relevance-unverified). ──
  var DEFENSE_MADLIB_VERB = /^(Develop|Establish|Implement|Build|Launch|Design|Deploy|Operationalize|Conduct|Create|Define|Assess|Optimize|Modernize|Strengthen|Enhance|Formalize|Institute|Standardize|Coordinate|Integrate|Calibrate|Evaluate|Streamline|Institutionalize|Configure|Monitor|Harden|Mobilize|Reposition|Reinforce)\b/;
  DefenseBrain.prototype._isDefenseMadLibTreatment = function (label) { return !label || DEFENSE_MADLIB_VERB.test(String(label)); };

  DefenseBrain.prototype._loadDefenseL1PortalDepth = function () {
    var self = this;
    if (self._defenseL1LoadPromise) return self._defenseL1LoadPromise;
    var BRANCH = {
      INVASION: ['land_forces', 'air_power', 'naval'],
      CYBER_ATTACK: ['cyber_warfare', 'c4isr', 'electronic_warfare'],
      NUCLEAR_THREAT: ['strategic_forces', 'missile_defense', 'deterrence'],
      INTELLIGENCE_FAILURE: ['c4isr', 'surveillance', 'reconnaissance'],
      LOGISTICS_COLLAPSE: ['logistics', 'industrial_base', 'sustainment'],
      CIVIL_UNREST: ['homeland_defense', 'national_guard', 'force_protection']
    };
    self._defenseL1Branches = BRANCH;
    var branches = {}; Object.keys(BRANCH).forEach(function (dx) { BRANCH[dx].forEach(function (b) { branches[b] = true; }); });
    var byBranch = {};
    self._defenseL1LoadPromise = Promise.all(Object.keys(branches).map(function (b) {
      return fetch('/assets/data/domains/defense_' + encodeURIComponent(b) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) {
          if (!data) { byBranch[b] = null; return; }
          var acts = data.activations || [], tickers = {}, total = 0, mad = 0;
          acts.forEach(function (a) {
            (a.companies || []).forEach(function (c) { if (c && c.ticker_or_id) tickers[c.ticker_or_id] = c.name || c.ticker_or_id; });
            (a.treatments || []).forEach(function (t) { var l = t && (t.label || t.title); if (l) { total++; if (self._isDefenseMadLibTreatment(l)) mad++; } });
          });
          byBranch[b] = { file: 'defense_' + b, companyTickers: Object.keys(tickers).map(function (k) { return { ticker: k, name: tickers[k] }; }), treatmentTotal: total, madLibCount: mad, realTreatmentCount: total - mad };
        })
        .catch(function () { byBranch[b] = null; });
    })).then(function () {
      var byDiagnosis = {};
      Object.keys(BRANCH).forEach(function (dx) {
        var tk = {}, total = 0, mad = 0, scanned = 0;
        BRANCH[dx].forEach(function (b) { var r = byBranch[b]; if (r) { scanned++; r.companyTickers.forEach(function (c) { tk[c.ticker] = c.name; }); total += r.treatmentTotal; mad += r.madLibCount; } });
        byDiagnosis[dx] = { branchesScanned: scanned, realCompanyTickers: Object.keys(tk).map(function (k) { return { ticker: k, name: tk[k], relevanceUnverified: true }; }), treatmentTotal: total, madLibTreatments: mad, realTreatments: total - mad, admitted: false, reason: 'L1 treatments are mad-lib templates (fixed-verb family) — not source-grade; only defense contractor tickers surfaced, relevance unverified' };
      });
      self.state._l1DepthCache = { byBranch: byBranch, byDiagnosis: byDiagnosis, scannedAt: (self.state.defenseModel && self.state.defenseModel.updated) || null };
      return self.state._l1DepthCache;
    });
    return self._defenseL1LoadPromise;
  };

  // ── READINESS / THREAT-POSTURE sub-portal layer (counterpart to culture's scene; energy's data-center;
  //    technology's innovation). Force-posture by theater + industrial capacity + doctrine/alliance signals =
  //    the canonical defense sub-portal: real-content, source-anchored (SIPRI/NATO/CSIS/ISW) readiness diagnoses
  //    + treatments. NEVER merged into the validated spine; never fabricated. ──
  DefenseBrain.prototype._loadDefenseSublayer = function () {
    var self = this;
    if (self._readinessLoadPromise) return self._readinessLoadPromise;
    // Prefer a dedicated defense-readiness-index.json; fall back to a defense_readiness sub-portal.
    // Both share the issues/activations shape. Graceful 404.
    self._readinessLoadPromise = fetch('/assets/data/defense-readiness-index.json')
      .then(function (r) { return (r && r.ok) ? r.json() : null; })
      .then(function (data) { if (data) return data; return fetch('/assets/data/domains/defense_readiness.json').then(function (r2) { return (r2 && r2.ok) ? r2.json() : null; }); })
      .then(function (data) {
        if (!data) { self._readinessPortal = null; return null; }
        self._readinessPortal = { issues: data.issues || [], activations: data.activations || [], title: data.title || 'Readiness & Threat Posture' };
        return self._readinessPortal;
      })
      .catch(function () { self._readinessPortal = null; return null; });
    return self._readinessLoadPromise;
  };

  DefenseBrain.prototype._buildDefenseReadinessSublayer = function () {
    var self = this;
    var sp = self._readinessPortal;
    if (!sp || !sp.issues || !sp.issues.length) {
      self.state.readinessDiagnoses = [];
      self.state.readinessTreatments = [];
      self.state.defenseReadinessDomainDiagnosisPackets = [];
      self.state.readinessPostureLayer = { loaded: false, count: 0, activeCount: 0, diagnoses: [], postureState: 'unknown', note: 'defense readiness/threat-posture sub-portal not loaded (offline or fetch failed); SIPRI/NATO/CSIS/ISW real-source index expected' };
      return self.state.readinessPostureLayer;
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
        source: 'readiness', tier: 'real-content-unbundled', branch: 'readiness'
      };
    });
    // 2) treatments — pull from readiness node activations whose brainNodeId is in a diagnosis circuit
    var nodeToDx = {};
    diagnoses.forEach(function (d) { (d.circuits || []).forEach(function (c) { if (c && c.nodeId) nodeToDx[c.nodeId] = d.id; }); });
    var treatments = [];
    (sp.activations || []).forEach(function (act) {
      var dxId = nodeToDx[act.brainNodeId];
      if (!dxId) return;
      (act.treatments || []).forEach(function (t, ti) {
        treatments.push({
          id: 'readiness_treat_' + act.brainNodeId + '_' + ti,
          label: t.label, type: t.type, evidence: t.evidence, description: t.description || '',
          cite: t.cite || null, citation: t.citation || [], steps: t.steps || [],
          diagnosisId: dxId, nodeId: act.brainNodeId,
          source: 'readiness', madLib: self._isDefenseMadLibTreatment ? self._isDefenseMadLibTreatment(t.label) : false
        });
      });
    });
    var evidenceRank = { A: 10, Strong: 10, B: 7, Moderate: 7, C: 4, Emerging: 1 };
    treatments.sort(function (a, b) { return (evidenceRank[b.evidence] || 0) - (evidenceRank[a.evidence] || 0); });
    self.state.readinessDiagnoses = diagnoses;
    self.state.readinessTreatments = treatments;
    // posture state — peacetime / heightened / war-footing derived from stress + active readiness diagnoses
    var stress = typeof self.state.stress === 'number' ? self.state.stress : 0;
    var activeReadiness = diagnoses.filter(function (d) { return d.active; }).length;
    var postureState = (stress >= 0.65 || activeReadiness >= 3) ? 'war-footing' : (stress >= 0.40 || activeReadiness >= 1) ? 'heightened' : 'peacetime';
    // 3) compact layer summary (read by every DDP's promptView)
    self.state.readinessPostureLayer = {
      loaded: true,
      portalTitle: sp.title,
      count: diagnoses.length,
      activeCount: activeReadiness,
      postureState: postureState,
      diagnoses: diagnoses.map(function (d) {
        var rc = self._resolveDefenseCanonicalDiagnosis ? self._resolveDefenseCanonicalDiagnosis(d.id) : { canonicalDiagnosisId: d.id };
        var bsStat = (self._bundleStatusMap && self._bundleStatusMap[rc.canonicalDiagnosisId]) || 'missing';
        return { id: d.id, label: d.label, active: d.active, branch: 'readiness', canonicalDiagnosisId: rc.canonicalDiagnosisId, bundleStatus: bsStat, treatmentCount: treatments.filter(function (t) { return t.diagnosisId === d.id; }).length };
      }),
      note: 'real-content (readiness/threat-posture) sub-portal diagnoses for the live force-posture surface (force-posture by theater, munitions production rate, doctrine/training tempo, alliance coherence, equipment availability) anchored to SIPRI/NATO/CSIS/ISW; SEPARATE from the validated diagnosis spine; no external artifact-source bundle yet; never admitted to evidenceAnchors'
    };
    // 4) per-diagnosis DDPs via the SAME schema builder (canonical-to-self; bundle 'missing')
    self.state.defenseReadinessDomainDiagnosisPackets = diagnoses.map(function (d) {
      try { return self._buildDomainDiagnosisPacket(d); } catch (e) { return null; }
    }).filter(Boolean);
    return self.state.readinessPostureLayer;
  };

  // ── DDP — the 8-section DomainDiagnosisPacket the Civilization cockpit consumes.
  //    Mirrors technology/culture's _buildDomainDiagnosisPacket exactly; only the CONTENT is defense. ──
  DefenseBrain.prototype._buildDomainDiagnosisPacket = function (dx) {
    var s = this.state || {};
    var dm = s.defenseModel || {};
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

    var _canon = this._resolveDefenseCanonicalDiagnosis(dxId);
    var identity = {
      domain: 'defense',
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
      defenseModel: { version: dm.version || null, cycle: (typeof dm.cycle === 'number' ? dm.cycle : null) },
      predictionError: dm.predictionError || null,
      regulationState: (dm.regulation && dm.regulation.state) || null,
      prior: dm.prior || null,
      observation: dm.observation || null,
      plasticity: dm.plasticity || null,
      readyForHandoff: dm.readyForHandoff === true
    };
    // Domain-identity portal fields are KNOWN facts (this IS the defense root).
    var rootId = (portal && portal.domainId) || 'defense';
    var rootTitle = (portal && portal.title) || 'Defense';
    var ancestry = (portal && portal.parentLabel) ? [portal.parentLabel, rootTitle] : [rootTitle];
    var portalContext = {
      portalIds: [rootId],
      portalDomain: 'defense',
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
    // empty slots (what each needs + which DEFENSE primary source) rather than fabricating.
    var _isExternal = !!(_bundle && _bundle.buildMethod === 'external-source-authored');
    var _intakeSrcHint = {
      INVASION: 'ACLED conflict events / ISW campaign assessments / IISS Military Balance / DoD theater posture statements / SIPRI arms transfers',
      CYBER_ATTACK: 'CISA Known Exploited Vulnerabilities / NSA-CISA advisories / MITRE ATT&CK / DoD cyber posture / vendor advisories',
      NUCLEAR_THREAT: 'SIPRI Yearbook nuclear forces / Federation of American Scientists / arms-control treaty status (New START) / OFAC proliferation designations',
      INTELLIGENCE_FAILURE: 'ODNI threat assessments / GAO oversight reports / RUSI/IISS analysis / congressional intelligence-committee findings',
      LOGISTICS_COLLAPSE: 'CSIS defense-industrial-base assessments / GAO readiness reports / DoD sustainment data / SIPRI arms-production statistics',
      CIVIL_UNREST: 'ACLED domestic-unrest data / DHS homeland advisories / National Guard activation records / Federal Register DHS docs'
    };
    var authoringIntake = [];
    if (_isExternal) {
      ['methodCandidates', 'embodimentCandidates', 'figurePlaceholders'].forEach(function (field) {
        if (_bArr(field).length === 0) authoringIntake.push({ field: field, status: 'needs-human-input', count: 0, need: field === 'methodCandidates' ? 'a concrete readiness/deterrence/response method drawn from a primary source' : field === 'embodimentCandidates' ? 'a specific force-structure/program embodiment from a real document' : 'a figure description grounded in a real source', sourceHint: _intakeSrcHint[identity.canonicalDiagnosisId] || 'primary institutional / defense source', note: 'NOT fabricated by the brain — author from the cited source, then wire in verbatim with attribution' });
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
    var _con = s.defenseConscience || {};
    var _exportReady = _con.artifactReadinessDecision ? (_con.artifactReadinessDecision.exportReady !== false) : true;
    // Lanes are INVESTABLE (defense contractors / primes / industrial base) / RESEARCHABLE (defense briefs).
    // patent/grant are VETOED by conscience (lanes retired 2026-06-21); export-restricted vetoed on kinetic/nuclear/cyber dx.
    var artifactContext = {
      artifactLanes: artifactLanes,
      patentReady: false, grantReady: false, sbaReady: false,   // patent/grant/loan vetoed by H3 conscience
      exportReady: _exportReady,                                // false while a kinetic/nuclear/cyber diagnosis is active (ITAR/EAR)
      investmentReady: !!(hasTreat && primaryOpp), researchReady: ready || hasTreat,
      readinessReasons: readinessReasons,
      blockers: blockers
    };

    var comp = {
      identity:         _defDdpCompleteness(identity, ['domain', 'diagnosisId', 'canonicalDiagnosisId', 'label', 'phase', 'confidence']),
      brainState:       _defDdpCompleteness(brainState, ['defenseModel', 'predictionError', 'regulationState', 'prior', 'observation', 'plasticity']),
      portalContext:    _defDdpCompleteness(portalContext, ['portalIds', 'portalDomain', 'portalTitle', 'depth', 'ancestryPath']),
      evidence:         _defDdpCompleteness(evidence, ['sourceFeeds', 'evidenceAnchors', 'citationHints']),
      treatmentContext: _defDdpCompleteness(treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']),
      operatorContext:  _defDdpCompleteness(operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']),
      artifactContext:  _defDdpCompleteness(artifactContext, ['artifactLanes'])
    };
    var totHave = 0, totAll = 0;
    for (var sk in comp) { if (comp.hasOwnProperty(sk)) { totHave += comp[sk].have; totAll += comp[sk].total; } }
    var missingFields = [];
    function _dmf(name, obj, keys) { for (var i = 0; i < keys.length; i++) { if (!_defDdpPresent(obj[keys[i]])) missingFields.push(name + '.' + keys[i]); } }
    _dmf('identity', identity, ['canonicalDiagnosisId', 'confidence']);
    _dmf('evidence', evidence, ['evidenceAnchors', 'citationHints']);
    _dmf('treatmentContext', treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']);
    _dmf('operatorContext', operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']);

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
    if (!primaryOpp && (typeof s.stress !== 'number' || s.stress < DM_STRESS_FLOOR)) warnings.push('no active opportunity (offline/low-stress) — operator/lane fields stay empty');
    if (artifactContext.artifactLanes.length && !hasTreat) warnings.push('artifact lane present but treatments/evidence missing');
    if (!_exportReady) warnings.push('export-restricted claims vetoed (ITAR/EAR dual-use export-control risk; kinetic/nuclear/cyber diagnosis active)');

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
        'diagnosis-specific bundle anchors preferred over generic defense evidence',
        'official/primary sources retained (ACLED/ISW/CISA/SIPRI/CSIS/OFAC where present)',
        'mechanisms prioritized over figures under prompt-space limits',
        'treatments with implementation relevance preferred over broad narrative',
        'caps applied per field; full data preserved in the stored bundle + full DDP'
      ],
      retainedWarnings: warnings
        .concat(s.defenseImmune ? ['immune: ' + s.defenseImmune.immuneState + ' (sev ' + s.defenseImmune.severity + ', ' + (s.defenseImmune.antigens || []).length + ' antigens; L2 traversal blocked)'] : [])
        .concat(s.defenseConscience && s.defenseConscience.conscienceState === 'restrictive' ? ['conscience: ' + (s.defenseConscience.blockedClaims || []).slice(0, 3).join(', ') + ' blocked'] : []),
      retainedBlockers: artifactContext.blockers,
      // higher-layer compact summaries (forwarded to the finalizer via promptView)
      immuneSummary: s.defenseImmune ? { immuneState: s.defenseImmune.immuneState, severity: s.defenseImmune.severity, antigenCount: (s.defenseImmune.antigens || []).length, quarantines: s.defenseImmune.quarantines, blockedFromTraversal: s.defenseImmune.blockedFromTraversal, allowedWithWarning: s.defenseImmune.allowedWithWarning } : null,
      awarenessSummary: s.defenseAwareness ? { selfNarrative: s.defenseAwareness.selfNarrative, knowns: (s.defenseAwareness.knowns || []).length, uncertainties: (s.defenseAwareness.uncertainties || []).length } : null,
      conscienceDecision: s.defenseConscience ? { conscienceState: s.defenseConscience.conscienceState, blockedClaims: s.defenseConscience.blockedClaims, artifactReadinessDecision: s.defenseConscience.artifactReadinessDecision } : null,
      intuitionSummary: s.defenseIntuition ? s.defenseIntuition.hunches : null,
      scenarioSummary: s.defenseSimulation ? (s.defenseSimulation.scenarios || []).map(function (x) { return { type: x.type, hypothetical: x.hypothetical, risk: x.risk }; }) : null,
      executiveReport: s.defenseExecutiveReport || null,
      l1DepthSummary: portalContext.l1Depth ? { realCompanyTickers: (portalContext.l1Depth.realCompanyTickers || []).length, realTreatments: portalContext.l1Depth.realTreatments, madLibTreatments: portalContext.l1Depth.madLibTreatments, admitted: portalContext.l1Depth.admitted } : null,
      authoringIntake: treatmentContext.authoringIntake.length ? treatmentContext.authoringIntake : null,
      // READINESS — force-posture / threat-environment sub-portal layer (real-content, SEPARATE from the validated spine, no bundle yet)
      readinessSummary: s.readinessPostureLayer && s.readinessPostureLayer.loaded ? { count: s.readinessPostureLayer.count, activeCount: s.readinessPostureLayer.activeCount, postureState: s.readinessPostureLayer.postureState, diagnoses: s.readinessPostureLayer.diagnoses, note: s.readinessPostureLayer.note } : null
    };

    return {
      schemaVersion: DEF_DDP_SCHEMA_VERSION,
      promptView: promptView,
      identity: identity,
      brainState: brainState,
      portalContext: portalContext,
      evidence: evidence,
      treatmentContext: treatmentContext,
      operatorContext: operatorContext,
      artifactContext: artifactContext,
      audit: {
        generatedAt: (dm.updated || null),
        schemaVersion: DEF_DDP_SCHEMA_VERSION,
        fieldCompleteness: { sections: comp, overallPct: pct },
        missingFields: missingFields,
        warnings: warnings,
        proofTier: proofTier,
        immune: s.defenseImmune || null,
        awareness: s.defenseAwareness || null,
        conscience: s.defenseConscience || null,
        intuition: s.defenseIntuition || null,
        simulation: s.defenseSimulation || null,
        executiveReport: s.defenseExecutiveReport || null
      }
    };
  };

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
