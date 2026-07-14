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

    // ── ACTUATION GATE (2026-07-13) — ported from Energy, HONESTLY gated per the neurology audit.
    // The rule (DOMAIN_BUILDOUT_PLAYBOOK.md §E-3): an actuation is valid ONLY where the domain has a
    // real controllable EFFECTOR (servo/eiBrake) and, for the phase REWARD, a Thing1-VALIDATED P3/P7
    // signal. Per-slot verdict for DEFENSE:
    //   refractory : TRUE  — defense emits real action drafts (_checkDiagnosisActions -> LIMENActionAdapters.
    //                        createDraft). Rate-limiting duplicate alerts is a genuine effector. Inline
    //                        limiter (no external module), deterministic (Neuro Ref III.3).
    //   servo      : TRUE  — effector = the brain's OWN emission (opportunity-confidence dampening + the
    //                        brake). Same effector Energy regulates; it controls output, not the real world
    //                        (does NOT claim to steer procurement/readiness). Neuro Ref V.2/XII.
    //   eiBrake    : TRUE  — depends on servo; proportional emission-confidence dampening. Neuro Ref XIII.1.
    //   phase      : FALSE — ADVISORY ONLY. Defense's phase is authored/snapshot, NOT a Thing1-validated
    //                        P3/P7 signal (the validated kernel is FENCED to Finance + Population per
    //                        kernel-watchlist-scoping). A realized phase transition is therefore never
    //                        ground-truth reward here; _computeDefensePhaseDynamics runs observe-only and
    //                        drives no credit/learning/emission gating. Do NOT flip true without validation.
    //   selfAudit  : TRUE  — defense.json carries a real 87-edge graph, so the SPOF/diaschisis self-audit
    //                        (Neuro Ref XIV) runs on the true graph (observe-only). Fully reversible.
    // All actuations affect ONLY emission (the same channel the generic brake uses); never stress/scoring/
    // diagnoses/defense.json. 100% deterministic on the 30s cycle — NO paid-AI/fetch-to-LLM ever runs here.
    this._actuation = { refractory: true, servo: true, eiBrake: true, phase: false, selfAudit: true };
    this._refractoryParams = {
      absoluteWindow: 900000,     // 15 min hard dead-time (operator-set; not in the document)
      relativeWindow: 3600000,    // 1 hr raised-bar window (1:4 ratio, mirrors Energy)
      overrideThreshold: 0.9      // reduced sensitivity: only stress >= 0.9 re-fires within the window
    };

    // ── K1-K8 NEURO CLOSED-LOOP STACK state (2026-07-13) — ported from Energy's PHASE K.
    // K4 (outcome / TRUTH-BRAKE self-consistency) needs a rolling predicted-vs-realized buffer and a
    // stash for last cycle's prediction; K3 (slow consolidation) keeps a parallel slow-weight track on
    // state.defenseSlowModel (lazily created). Initialized here like Energy inits its buffers; the
    // methods also lazy-init defensively so a hot-reload never NPEs. 100% deterministic — no AI/fetch.
    this._defenseOutcomeBuffer = this._defenseOutcomeBuffer || [];   // K4: rolling predicted-vs-next-realized samples
    this._defensePrevPrediction = (this._defensePrevPrediction != null) ? this._defensePrevPrediction : null;  // K4: stash for next-cycle reconciliation

    // ── THING2 KERNEL PHASE SOURCE (2026-07-13) — persistent primary-scalar series ──
    // Rolling buffer of the domain's primary STRESS scalar (state.stress; up = worse) fed
    // to the REAL Thing2 recursive phase kernel each cycle. Loaded from localStorage so the
    // phase posture survives reloads; guarded for absent/blocked localStorage.
    try { this._phaseSeries = JSON.parse(localStorage.getItem('limen:phaseseries:defense')) || []; }
    catch (e) { this._phaseSeries = []; }
    if (!Array.isArray(this._phaseSeries)) this._phaseSeries = [];
    this._kernelPhase = null;
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

  // REFRACTORY LIMITER (Neuro Ref III.3) — inline, deterministic, no external module, no AI.
  // Absolute dead-time (hard block) + relative window (raised threshold: a stronger stimulus can still
  // fire). The diagnosis stays active/displayed; only the duplicate action DRAFT is withheld. Reversible
  // via this._actuation.refractory=false. This is the ACTUATED overlay (a real effector on emission).
  DefenseBrain.prototype._defenseRefractoryFire = function (dxId, now, stress) {
    var p = this._refractoryParams || {};
    var map = this._defenseRefractoryMap || (this._defenseRefractoryMap = {});
    var rec = map[dxId];
    if (rec) {
      var age = now - rec.lastFire;
      if (age < (p.absoluteWindow || 900000)) return { allowed: false, reason: 'absolute-refractory' };
      if (age < (p.relativeWindow || 3600000) && stress < (p.overrideThreshold || 0.9)) return { allowed: false, reason: 'relative-refractory' };
    }
    map[dxId] = { lastFire: now, lastStress: stress };
    return { allowed: true };
  };

  DefenseBrain.prototype._checkDiagnosisActions = function () {
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; }); if (activeDx.length === 0) return;
    var adapters = window.LIMENActionAdapters; if (!adapters) return;
    var _refractoryOn = !!(this._actuation && this._actuation.refractory);
    var _now = (this.state.pulse && this.state.pulse.timestamp) || (this._runtimeOverlay && this._runtimeOverlay.timestamp) || Date.now();
    var _stress = this.state.stress || 0;
    for (var i = 0; i < activeDx.length; i++) {
      var dx = activeDx[i];
      if (adapters.getDrafts && adapters.getDrafts({ domain: 'defense', intentId: dx.id }).length > 0) continue;
      // REFRACTORY GATE (actuated): suppress re-emission of the same diagnosis's draft within the
      // dead-time unless stress clears the reduced-sensitivity override bar. Best-effort; never breaks the cycle.
      if (_refractoryOn) {
        try { var _v = this._defenseRefractoryFire(dx.id, _now, _stress); if (!_v.allowed) { this.state._refractorySuppressed = (this.state._refractorySuppressed || 0) + 1; continue; } } catch (_e) {}
      }
      adapters.createDraft('REPORT_GENERATION', { domain: 'defense', sourceType: 'domain_brain', sourceId: dx.id, intentId: dx.id, title: 'Defense Alert: ' + dx.label, intent: { domain: 'defense', title: dx.label, status: 'ACTIVE', priority: this.state.stress, progress: 0, strategyType: 'diagnosis_response', steps: [{ type: 'ANALYZE', label: 'Assess ' + dx.label + ' impact', status: 'PENDING' }, { type: 'INVESTIGATE', label: 'Identify affected assets and forces', status: 'PENDING' }, { type: 'POSITION', label: 'Evaluate defense opportunities', status: 'PENDING' }] } });
    }
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
      // THING2 KERNEL PHASE — extend the persistent primary-scalar series and derive the
      // interpretive P0-P10 posture BEFORE the phase-coherence router / transition read run
      // (they execute later via _computeDefenseActuation). Pure math, no AI/fetch.
      try { this._updateDefensePhaseSeries(); } catch (e) {}
      var dm = this.state.defenseModel || this._neutralDefenseModel();
      var priorIn = dm.prior;
      var obs = this._buildDefenseObservation();
      var pe = this._computeDefensePredictionError(priorIn, obs);
      var gainBlend = _dmClamp(pe.novelty, 0.05, 0.95);
      var predictedStress = priorIn.expectedStress * (1 - gainBlend) + obs.stress * gainBlend;
      var reg = this._computeDefenseRegulation(dm, obs, pe);
      var readyForHandoff = (dm.cycle > 0) && (predictedStress >= DM_STRESS_FLOOR) && (obs.diagnosisCount > 0) && !reg.flooding && !reg.stale;

      // ── K4 CREDIT ASSIGNMENT — routed through the ONE central honest reward gate (window.LIMENK4).
      // The gate decides the tier + whether the signal is reward; the brain only supplies what it already
      // computes. DEFENSE IS NOT externalRewardEligible (the validated kernel is fenced to Finance +
      // Population): externalOutcome is ALWAYS null — no external realized ground-truth outcome exists here,
      // so its credit is SELF-CONSISTENCY CALIBRATION ONLY, never reward. The gate preempts
      // external-reward(4) > phase-consistency(3) > call-consistency(2) > stress-consistency(1) > none.
      // Signal is read from the PRIOR cycle's K4/phase telemetry (those layers run later this cycle — a
      // one-cycle lag, matching Energy). Pure deterministic math — NO AI, NO fetch. Guarded: if the gate is
      // absent the fixed prior learning-rate behavior is preserved (never throws).
      var _lr = dm.plasticity.learningRate;
      var _om = this.state.defenseOutcomeModel || null;                             // K4 TRUTH-BRAKE self-consistency (prev cycle)
      var _pt = (this.state.defensePhaseDynamics || {}).transition || null;         // advisory transition (hit ALWAYS null for defense)
      if (typeof window !== 'undefined' && window.LIMENK4) {
        var _sig = {
          // Defense NOT externalRewardEligible -> externalOutcome MUST stay null (externalOutcomeSupplied=false).
          externalOutcome: null,
          phaseValidated: !!(_pt && _pt.validated),                                 // false for defense (advisory phase, not a P3/P7-validated kernel signal)
          phaseTransitionHit: (_pt && _pt.hit != null) ? _pt.hit : null,            // null for defense (a realized transition is never ground-truth here)
          callHitRate: (_om && typeof _om.callHitRate === 'number') ? _om.callHitRate : null,  // TRUTH BRAKE ledger hit-rate (self-consistency)
          callSamples: (_om && typeof _om.samples === 'number') ? _om.samples : 0,
          stressSelfPred: (_om && typeof _om.meanRealizedError === 'number') ? Math.max(0, 1 - _om.meanRealizedError) : null,  // raw stress self-prediction agreement
          stressSamples: (_om && typeof _om.samples === 'number') ? _om.samples : 0
        };
        var _cr = window.LIMENK4.credit(_sig);
        dm._credit = (_cr && _cr.credit != null) ? _cr.credit : null;
        dm._creditSource = (_cr && _cr.creditSource) || 'none';
        dm._creditIsReward = !!(_cr && _cr.isReward);                               // ALWAYS false for defense (no external outcome supplied)
        dm._creditTier = (_cr && typeof _cr.tier === 'number') ? _cr.tier : 0;
        dm._creditLabel = (_cr && _cr.label) || '';
        // Low self-consistency credit RAISES the effective learning rate (learn faster when the forecast misses).
        if (dm._credit != null) _lr = _dmClamp(_lr * (1 + (1 - dm._credit)), DM_SLOW_RATE, 0.6);
      } else {
        // FALLBACK — central gate absent: preserve the prior fixed-rate behavior, no credit modulation.
        dm._credit = null; dm._creditSource = 'no-gate'; dm._creditIsReward = false; dm._creditTier = 0; dm._creditLabel = 'gate-absent';
      }
      dm._effectiveLearningRate = _lr;
      var nextPrior = this._updateDefensePrior(priorIn, obs, _lr);
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

      // K1-K8 NEURO STACK — the eight closed-loop completion layers, in Energy's K1..K8 order.
      // Runs AFTER cognition is assembled and BEFORE actuation, so the servo/E-I brake consume the
      // fresh K8 adaptive baseline / K7 inhibition. Each layer COMPUTES and EXPOSES its signal on
      // state (state.defense{Afferent,GainControl,SlowModel,OutcomeModel,PerceptionDepth,Attention,
      // Inhibition,Homeostasis}) + a compact roll-up on state.cognition.neuro. Deterministic, cached
      // state only, no AI/fetch. Guarded so it can never break the cycle. K4 is TRUTH-BRAKE
      // self-consistency (predicted-vs-realized), NOT an external reward.
      try { this._computeDefenseNeuroLayers(); } catch (e) {}

      // ACTUATION — servo / E/I brake / self-audit / phase (advisory), each behind its _actuation flag.
      // Runs AFTER cognition is assembled so it can attach additively; guarded so it never breaks the cycle.
      try { this._computeDefenseActuation(); } catch (e) {}

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
  // ACTUATION LAYER (2026-07-13) — ported from Energy, gated by this._actuation.
  // Mirrors Energy's structure + math but reads DEFENSE's own state/edges. Every method is
  // deterministic (no AI, no fetch-to-LLM); the only network call is a one-shot static fetch of
  // defense.json edges for the self-audit. Additive: touches ONLY emission (opportunity confidence
  // + action-draft rate-limiting) — never stress/scoring/diagnoses/defense.json. See §E of the
  // playbook and ENERGY_NEURO_AUDIT.md for the neurology mapping.
  // ════════════════════════════════════════════════════════════════════════════

  // REGULATE-TO-TARGET SERVO (Neuro Ref V.2/XII allostasis + XIII.1 E/I). Real sensor->controller->
  // effector->feedback loop: sensor = excitatory drive (stress + how many things fire at once) vs the
  // current inhibition term; controller = PI (fast proportional + bounded slow integral, the HPA fast+
  // slow arms); effector = a proportional dampening of emission the E/I brake consumes. Reversible via
  // this._actuation.servo=false. Reads DEFENSE's regulation + stress history (never Energy's).
  DefenseBrain.prototype._computeDefenseServo = function () {
    function R(x) { return Math.round(x * 1000) / 1000; }
    var s = this.state, dm = s.defenseModel || {}, reg = dm.regulation || {};
    // SENSOR: excitatory drive
    var stress = (typeof s.stress === 'number') ? s.stress : 0;
    var conds = Array.isArray(s._activeConditions) ? s._activeConditions.length : (Array.isArray(s.signals) ? s.signals.length : 0);
    var dxA = Array.isArray(s.diagnoses) ? s.diagnoses.filter(function (d) { return d && d.active; }).length : 0;
    var drive = Math.max(0, Math.min(2, stress + Math.min(conds, 12) / 24 + Math.min(dxA, 6) / 24));
    var inhibition = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;   // from _computeDefenseRegulation
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
    this._defenseServoIntegral = Math.max(-0.5, Math.min(0.5, (this._defenseServoIntegral || 0) + error * 0.15));
    var Kp = 0.8, Ki = 0.4;
    var correction = Math.max(0, Kp * error + Ki * Math.max(0, this._defenseServoIntegral));   // only ADD braking; never disinhibit
    // EFFECTOR: proportional dampening of emission (the E/I brake consumes this)
    var emissionFactor = Math.max(0.2, Math.min(1, 1 - correction));
    var state = error > 0.25 ? 'runaway-risk' : ((inhibition - target) > 0.4 ? 'over-inhibited' : 'balanced');
    var servo = {
      version: 1, actuated: true, drive: R(drive), inhibition: R(inhibition), target: R(target),
      error: R(error), integral: R(this._defenseServoIntegral), emissionFactor: R(emissionFactor),
      state: state, deviation: R(deviation),
      note: 'closed-loop allostasis: drives inhibition toward a drive+deviation target; effector = proportional emission dampening. Neuro Ref XIII.1/V.2/XII.'
    };
    s.defenseServo = servo;
    return servo;
  };

  // E/I BRAKE ACTUATION (Neuro Ref XIII.1: inhibition scales with drive). Consumes the servo's
  // emissionFactor and dampens opportunity-emission confidence PROPORTIONALLY — the same channel the
  // generic brake uses. Reversible via this._actuation.eiBrake=false. Non-destructive: opportunities are
  // rebuilt each cycle by surfaceOpportunities, so this re-applies from the fresh servo without compounding.
  DefenseBrain.prototype._applyDefenseEIBrake = function (opps) {
    opps = opps || this.state.opportunities || [];
    var servo = this.state.defenseServo;
    if (!(this._actuation && this._actuation.eiBrake && servo)) { this.state.defenseEIBrake = null; return opps; }
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
    this.state.defenseEIBrake = brake;
    return opps;
  };

  // E/I BALANCE + SELF-AUDIT ADVISORIES (observe-only; Neuro Ref XIII.1 + XIV). CONSUMES the real
  // 87-edge defense graph (lazily fetched + cached from defense.json — edges are NOT in the live
  // snapshot). Mirrors _computeEnergyRegulationAdvisories. Deterministic, no writes, no AI. Reversible
  // via this._actuation.selfAudit=false. Degrades safe: if the shared audit modules aren't loaded,
  // selfAudit reports consumed:false rather than fabricating.
  DefenseBrain.prototype._computeDefenseRegulationAdvisories = function () {
    var s = this.state, out = { version: 1, observeOnly: true };
    // (1) E/I balance — is inhibition tracking drive? (shared module, generic despite the name)
    try {
      var EI = (typeof window !== 'undefined' && window.EnergyEIBalance) || null;
      if (!EI && typeof require === 'function') { try { EI = require('../energy-ei-balance.js'); } catch (_e) {} }
      if (EI && typeof EI.assessFromState === 'function') out.eiBalance = EI.assessFromState(s);
    } catch (e) { out.eiBalance = null; }
    // (2) Self-audit — connectivity / single-points-of-failure on the REAL defense graph.
    try {
      var self = this;
      var edges = (Array.isArray(s.edges) && s.edges) || this._defenseEdges || null;
      if (!edges) {
        if (typeof fetch === 'function' && !this._defenseEdgesPromise) {
          this._defenseEdgesPromise = fetch('/assets/data/domains/defense.json')
            .then(function (r) { return r.json(); })
            .then(function (j) { if (j && Array.isArray(j.edges)) self._defenseEdges = j.edges; })
            .catch(function () {});
        } else if (typeof require === 'function') {
          try { var ed = require('../../data/domains/defense.json'); if (ed && Array.isArray(ed.edges)) { this._defenseEdges = ed.edges; edges = ed.edges; } } catch (_e) {}
        }
      }
      var CA = (typeof window !== 'undefined' && window.EnergyConnectivityAudit) || null;
      if (!CA && typeof require === 'function') { try { CA = require('../energy-connectivity-audit.js'); } catch (_e) {} }
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

  // ── THING2 KERNEL PHASE SOURCE (2026-07-13) ──────────────────────────────────────────────
  // Feed the domain's primary STRESS scalar (state.stress; up = worse) into the REAL Thing2
  // recursive phase kernel (window.LIMENThing2.phaseOfSeries) and use its interpretive P0-P10
  // posture as the phase for the coherence router + the (advisory) phase-transition read. The
  // kernel adapter is PURE MATH — no network, no AI — so the 30s cycle stays deterministic.
  // seriesSource: state.stress is a STRESS metric (up = worse) -> positive:false. On any failure,
  // absent kernel, blocked localStorage, or <8 samples, this._kernelPhase stays null and the
  // existing authored/snapshot state.phase is used unchanged (fallback path never deleted).
  DefenseBrain.prototype._updateDefensePhaseSeries = function () {
    // (1) extend + persist the rolling primary-scalar series (cap 60, shift oldest)
    var scalar = (typeof this.state.stress === 'number' && isFinite(this.state.stress)) ? this.state.stress : 0;
    var series = this._phaseSeries || (this._phaseSeries = []);
    series.push(scalar);
    while (series.length > 60) series.shift();
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.setItem('limen:phaseseries:defense', JSON.stringify(series));
      }
    } catch (_e) {}
    // (2) kernel phase (guarded, pure math). Default to fallback; only promote on a real phase.
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
    } catch (_e) { this._kernelPhase = null; this.state.phaseSource = 'fallback'; }
  };

  // PHASE-COHERENCE ROUTER + TRANSITION READ — ADVISORY ONLY (this._actuation.phase === false).
  // Defense's phase is authored/snapshot, NOT a Thing1-validated P3/P7 signal (the validated kernel is
  // FENCED to Finance + Population). So a realized phase TRANSITION is NEVER treated as ground-truth
  // reward here: it stays advisory-self-consistency and drives NO credit / learning / emission gating.
  // Pure observe-only telemetry, mirroring the SHAPE of _computeEnergyPhaseDynamics without the reward.
  DefenseBrain.prototype._computeDefensePhaseDynamics = function () {
    var s = this.state;
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
    // PREFER the Thing2 recursive kernel's interpretive phase when available; otherwise fall back
    // to the authored/snapshot state.phase (unchanged legacy path). Both the coherence router (A)
    // and the transition read (B) below read myPhase, so both consume the kernel when it is live.
    var myPhase = (this._kernelPhase != null) ? norm(this._kernelPhase) : norm(s.phase);
    // (A) COHERENCE ROUTER — advisory read of co-phased, stressed peer domains.
    var doms = (typeof window !== 'undefined' && window.LIMENDomains) || {};
    var coupled = [], couplingStrength = 0;
    if (myPhase && PHASE_M[myPhase]) {
      var row = PHASE_M[myPhase];
      Object.keys(doms).forEach(function (k) {
        if (k === 'defense') return;
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
    // (B) TRANSITION READ — computed for telemetry; ALWAYS advisory (never ground-truth for defense).
    var hist = this._defensePhaseHistory = this._defensePhaseHistory || [];
    var prev = hist.length ? hist[hist.length - 1].phase : null;
    var transition = null;
    if (prev != null && myPhase != null && prev !== myPhase) {
      var wentUp = (BREAKING[myPhase] && !BREAKING[prev]) ? true : (BREAKING[prev] && !BREAKING[myPhase]) ? false : null;
      transition = { from: prev, to: myPhase, wentUp: wentUp, hit: null, validated: false, groundTruthEligible: false,
        kind: 'advisory-self-consistency', reason: 'defense is not a Thing1-validated kernel domain (fenced to Finance+Population); no ground-truth phase reward' };
    }
    hist.push({ phase: myPhase, t: (s.defenseModel && s.defenseModel.updated) || Date.now() });
    if (hist.length > 24) hist.shift();
    var out = {
      version: 1, actuated: false, advisoryOnly: true, myPhase: myPhase,
      phaseSource: this.state.phaseSource || 'fallback',
      coupled: coupled.slice(0, 5), couplingStrength: Math.round(couplingStrength * 1000) / 1000, transition: transition,
      note: 'ADVISORY phase-coherence router + transition read; NOT actuated (defense lacks a Thing1-validated P3/P7 signal). Feeds no credit/learning/emission gating.'
    };
    s.defensePhaseDynamics = out;
    return out;
  };

  // ORCHESTRATOR — runs the actuation stack in Energy's order (servo BEFORE the E/I brake consumes it;
  // self-audit + phase telemetry alongside), each behind its _actuation flag. Called at the END of
  // _updateDefenseModel (after cognition is assembled). try/catch-guarded so it can never break the cycle.
  DefenseBrain.prototype._computeDefenseActuation = function () {
    var A = this._actuation || {};
    if (A.servo) { try { this._computeDefenseServo(); } catch (e) {} }                                   // regulate-to-target (before the brake)
    if (A.selfAudit) { try { this.state.defenseRegulation = this._computeDefenseRegulationAdvisories(); } catch (e) { this.state.defenseRegulation = null; } }
    try { this._computeDefensePhaseDynamics(); } catch (e) {}                                            // advisory only (phase actuation OFF)
    if (A.eiBrake) { try { this._applyDefenseEIBrake(this.state.opportunities); } catch (e) {} }          // effector: proportional emission dampening
    // Attach to the generic cognition surface (ADDITIVE keys only — never overwrites existing).
    var cog = this.state.cognition;
    if (cog && typeof cog === 'object') {
      cog.servo = this.state.defenseServo || null;
      cog.eiBrake = this.state.defenseEIBrake || null;
      cog.phaseDynamics = this.state.defensePhaseDynamics || null;
      cog.regulation = this.state.defenseRegulation || null;
      cog.actuation = A;
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // K1-K8 NEURO CLOSED-LOOP COMPLETION STACK (defense-local, additive, reversible).
  // Ported from energy-brain.js PHASE K. Mirrors Energy's K1..K8 MATH exactly but reads
  // DEFENSE's own state/edges/sub-portals (never Energy's). Each layer COMPUTES and EXPOSES
  // its signal on state; the live emission effector defense already owns is the servo + E/I
  // brake (the actuation layer), which these feed. Deterministic: reads cached state only, adds
  // NO network call, NO AI. Never fabricates evidence. Neuro mapping per LIMEN_Helix_Neurology_
  // Reference + ENERGY_NEURO_AUDIT: K1 afferent integration, K2 neuromodulatory gain, K3 slow
  // consolidation (long-term plasticity), K4 outcome/credit (TRUTH-BRAKE self-consistency),
  // K5 deep hierarchical perception, K6 attention, K7 lateral inhibition, K8 homeostatic set-point.
  // ════════════════════════════════════════════════════════════════════════════
  var DK_OUTCOME_BUFFER = 40;     // K4: rolling predicted-vs-realized samples (mirrors EK_OUTCOME_BUFFER)
  var DK_HOMEO_WINDOW = 60;       // K8: cycles of stress baseline for the adaptive set-point (mirrors EK_HOMEO_WINDOW)

  // K1 - afferent inter-brain integration. Surfaces received cross-domain pressure and the stress
  // delta it contributes. Defense's stress folds afferent (external pressure) via the base scoreStress
  // (like the other 18 domains); this exposes the received-signal breakdown without re-adding it.
  DefenseBrain.prototype._computeDefenseAfferent = function () {
    var s = this.state, dm = s.defenseModel || {};
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
      integrated: true,                                           // CLOSED - folded into stress by the base scoreStress
      appliedStressDelta: Math.round(((s._externalPressureApplied) || 0) * 1000) / 1000,
      wouldRaiseStressBy: Math.round(pressure * 1000) / 1000,
      note: 'CLOSED: base scoreStress folds externalPressure into stress each cycle (matches the other 18 domains); this exposes the cross-domain source breakdown.',
      lastAfferentAt: dm.updated || now
    };
    s.defenseAfferent = af; return af;
  };

  // K2 - neuromodulatory gain application. reg.gain/inhibition are computed by _computeDefenseRegulation;
  // this surfaces the graded output modulation the gain implies over opportunities. ADVISORY for defense:
  // the LIVE emission effector is the servo + E/I brake (proportional confidence dampening), not a gain cap.
  DefenseBrain.prototype._computeDefenseGainControl = function () {
    var s = this.state, dm = s.defenseModel || {}, reg = dm.regulation || {};
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
      appliedTargets: ['servo emissionFactor (drive-tracked)', 'opportunity confidence (via E/I brake)'],
      unappliedTargets: ['stress', 'treatment surfacing', 'diagnoses'],
      note: 'ADVISORY gain read; the LIVE emission effector for defense is the servo + E/I brake (proportional confidence dampening), computed in _computeDefenseActuation. Reg.gain/inhibition drive that loop.',
      lastGainAt: dm.updated || Date.now()
    };
    s.defenseGainControl = gc; return gc;
  };

  // K3 - slow consolidation / long-term plasticity. Maintains a PARALLEL slow-weight track (DM_SLOW_RATE)
  // that never touches dm.prior; fast-vs-slow divergence is a real regime-shift indicator.
  DefenseBrain.prototype._consolidateDefenseSlowModel = function () {
    var s = this.state, dm = s.defenseModel || {}, obs = dm.observation || null;
    var slow = s.defenseSlowModel || {
      version: 1, cycle: 0,
      slow: { expectedStress: 0.5, expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, samples: 0 },
      rate: DM_SLOW_RATE, note: 'parallel slow-weight track (DM_SLOW_RATE); does NOT touch dm.prior'
    };
    if (obs) {
      var r = DM_SLOW_RATE, w = slow.slow;
      w.expectedStress = _dmClamp(w.expectedStress + r * ((obs.stress || 0) - w.expectedStress), 0, 1);
      w.expectedSignal = _dmClamp(w.expectedSignal + r * ((obs.signal || 0) - w.expectedSignal), 0, 1);
      w.expectedDiagnosisCount = w.expectedDiagnosisCount + r * ((obs.diagnosisCount || 0) - w.expectedDiagnosisCount);
      w.expectedOpportunityCount = w.expectedOpportunityCount + r * ((obs.opportunityCount || 0) - w.expectedOpportunityCount);
      w.samples += 1;
      slow.cycle += 1;
    }
    var fast = (dm.prior && typeof dm.prior.expectedStress === 'number') ? dm.prior.expectedStress : 0.5;
    slow.fastSlowDivergence = Math.round(Math.abs(fast - slow.slow.expectedStress) * 1000) / 1000;
    slow.regimeShift = slow.fastSlowDivergence > 0.25;            // fast prior pulled far from slow baseline
    slow.updated = dm.updated || Date.now();
    s.defenseSlowModel = slow; return slow;
  };

  // K4 - outcome / credit learning = TRUTH-BRAKE self-consistency. Compares each cycle's predictedStress
  // against the NEXT cycle's realized stress (online forward-prediction loop). This is SELF-CONSISTENCY
  // calibration (does the brain's own forecast come true), NOT an external/dopaminergic reward. This model's
  // callHitRate/meanRealizedError are fed to the ONE central honest reward gate (window.LIMENK4) in
  // _updateDefenseModel, which classifies them as self-consistency (never reward — defense supplies no
  // external outcome). Measurement only here; no writes to scoring.
  DefenseBrain.prototype._scoreDefenseOutcomes = function () {
    var s = this.state, dm = s.defenseModel || {};
    var buf = this._defenseOutcomeBuffer = this._defenseOutcomeBuffer || [];
    var obs = dm.observation || null;
    if (this._defensePrevPrediction != null && obs && typeof obs.stress === 'number') {
      buf.push({ predicted: this._defensePrevPrediction, realized: obs.stress, err: Math.abs(this._defensePrevPrediction - obs.stress) });
      if (buf.length > DK_OUTCOME_BUFFER) buf.shift();
    }
    this._defensePrevPrediction = (typeof dm.predictedStress === 'number') ? dm.predictedStress : null;   // stash for next-cycle reconciliation
    var n = buf.length, sumErr = 0, sumSq = 0, hits = 0;
    for (var i = 0; i < n; i++) { sumErr += buf[i].err; sumSq += buf[i].err * buf[i].err; if (buf[i].err <= 0.1) hits++; }
    var om = {
      version: 1,
      samples: n,
      meanRealizedError: n ? Math.round((sumErr / n) * 1000) / 1000 : null,     // does the forecast come true
      brierLike: n ? Math.round((sumSq / n) * 1000) / 1000 : null,
      callHitRate: n ? Math.round((hits / n) * 100) / 100 : null,                // fraction within 0.1 of realized (TRUTH-BRAKE calibration)
      loopType: 'online-continuous (predicted-vs-next-realized) SELF-CONSISTENCY; NOT an external reward',
      creditAssignmentActive: (n >= 5),
      note: 'TRUTH BRAKE: realized-stress self-prediction calibration. A persistently low callHitRate means the brain should widen its own uncertainty. Routed through the central honest gate (window.LIMENK4) as self-consistency calibration — NEVER reward (defense supplies no external outcome).',
      lastOutcomeAt: dm.updated || Date.now()
    };
    s.defenseOutcomeModel = om; return om;
  };

  // K5 - deep hierarchical perception. Aggregates the perceptual depth the brain HAS (root portal + L1
  // branch scan + the readiness/threat-posture sub-portal), with L2 quarantined (mad-lib), and estimates
  // the portalError the recurrent model does not yet see. Reads existing caches only; no new fetches.
  DefenseBrain.prototype._computeDefensePerceptionDepth = function () {
    var s = this.state, dm = s.defenseModel || {};
    var l1 = s._l1DepthCache || null;
    var rp = s.readinessPostureLayer || null;             // defense sub-portal (counterpart to energy's datacenterLayer)
    var l1Real = 0, l1Mad = 0;
    if (l1 && l1.byDiagnosis) { Object.keys(l1.byDiagnosis).forEach(function (k) { l1Real += (l1.byDiagnosis[k].realTreatments || 0); l1Mad += (l1.byDiagnosis[k].madLibTreatments || 0); }); }
    var levels = [
      { level: 'L0', name: 'root', status: (this._portalCache || s._portalCache) ? 'loaded' : 'pending' },
      { level: 'L1', name: 'branch-scan', status: l1 ? 'scanned' : 'pending', realTreatments: l1Real, madLibTreatments: l1Mad },
      { level: 'L2', name: 'deep-cortex', status: 'quarantined', note: 'mad-lib templates (immune-blocked)' },
      { level: 'RD', name: 'readiness-subportal', status: (rp && rp.loaded) ? 'loaded' : 'absent', activeCount: (rp && rp.activeCount) || 0 }
    ];
    var loadedDepth = (rp && rp.loaded) ? 3 : (l1 ? 1 : 0);
    var admissible = l1Real + ((rp && rp.count) ? rp.count : 0);
    var blocked = l1Mad + 1;                                       // +1 for the quarantined L2 tier
    var portalErrorEstimate = Math.round((blocked / Math.max(1, admissible + blocked)) * 1000) / 1000;
    var pd = {
      version: 1, levels: levels, deepestUsableLevel: loadedDepth,
      portalErrorEstimate: portalErrorEstimate,                    // advisory: unmodeled perceptual error
      note: 'ADVISORY: perception stops at L1 (L2 quarantined mad-lib); portalErrorEstimate is the unmodeled depth the recurrent prediction-error does not yet fold. No new fetches.',
      lastDepthAt: dm.updated || Date.now()
    };
    s.defensePerceptionDepth = pd; return pd;
  };

  // K6 - attention / selective routing. Ranks top-down salience (active + relevance + novelty, plus any
  // operator attention-focus steer) and names focus vs suppressed diagnoses, without gating the pipeline.
  DefenseBrain.prototype._computeDefenseAttention = function () {
    var s = this.state, dm = s.defenseModel || {}, reg = dm.regulation || {};
    var pe = (dm.predictionError && dm.predictionError.total) || 0;
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
      note: 'ADVISORY attentional salience ranking over defense diagnoses; names focus vs suppressed without gating the pipeline.',
      lastAttentionAt: dm.updated || Date.now()
    };
    s.defenseAttention = at; return at;
  };

  // K7 - lateral inhibition (microcircuit). reg.inhibition implies a winner-take-most ranking among the
  // competing active diagnoses; this surfaces the winner and the down-weight each competitor would take.
  DefenseBrain.prototype._computeDefenseInhibition = function () {
    var s = this.state, dm = s.defenseModel || {}, reg = dm.regulation || {};
    var inhib = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;
    var active = (s.diagnoses || []).filter(function (d) { return d.active; })
      .sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var winner = active[0] || null;
    var li = {
      version: 1, inhibitionStrength: inhib,
      winner: winner ? winner.id : null,
      competitors: active.slice(1).map(function (d) { return { id: d.id, relevance: d.relevance, suppressBy: Math.round((d.relevance || 0) * inhib * 1000) / 1000 }; }).slice(0, 6),
      note: 'ADVISORY winner-take-most read among competing active diagnoses; feeds the servo/E-I brake drive term (reg.inhibition), which is the live emission effector.',
      lastInhibitionAt: dm.updated || Date.now()
    };
    s.defenseInhibition = li; return li;
  };

  // K8 - homeostatic set-point (microcircuit). Maintains an adaptive stress baseline (Turrigiano-style
  // synaptic scaling) alongside the fixed DM_STRESS_FLOOR, without replacing it. The servo's allostatic
  // target consumes this deviation-above-baseline (regulate-to-target), closing the K8 loop into emission.
  DefenseBrain.prototype._computeDefenseHomeostasis = function () {
    var s = this.state, dm = s.defenseModel || {};
    var win = ((s.memory && s.memory.stressHistory) || []).slice(-DK_HOMEO_WINDOW);
    var n = win.length, sum = 0;
    for (var i = 0; i < n; i++) sum += (win[i].stress || 0);
    var baseline = n ? sum / n : 0.5;                             // adaptive set-point vs fixed DM_STRESS_FLOOR
    var cur = (typeof s.stress === 'number') ? s.stress : 0;
    var scalingFactor = baseline > 0 ? Math.round((0.5 / Math.max(0.1, baseline)) * 1000) / 1000 : 1;
    var hm = {
      version: 1,
      fixedFloor: DM_STRESS_FLOOR,                                // current hardcoded set-point
      adaptiveBaseline: Math.round(baseline * 1000) / 1000,
      currentStress: cur,
      deviationFromBaseline: Math.round((cur - baseline) * 1000) / 1000,
      scalingFactor: scalingFactor,                               // synaptic-scaling multiplier
      samples: n,
      note: 'CLOSED via actuation: the servo allostatic target rises with deviationFromBaseline (regulate-to-target), so K8 drives the E/I brake emission effector. adaptiveBaseline never replaces DM_STRESS_FLOOR.',
      lastHomeostasisAt: dm.updated || Date.now()
    };
    s.defenseHomeostasis = hm; return hm;
  };

  // ORCHESTRATOR — run K1..K8 in Energy's exact order, store each on state, and attach a compact
  // neuro roll-up to state.cognition ADDITIVELY (new key `neuro`; existing keys untouched). Called from
  // _updateDefenseModel BEFORE _computeDefenseActuation so the servo/E-I brake consume the fresh K7/K8
  // terms. 100% deterministic — reads cached state only, NO AI, NO fetch.
  DefenseBrain.prototype._computeDefenseNeuroLayers = function () {
    this._computeDefenseAfferent();          // K1 - afferent inter-brain input
    this._computeDefenseGainControl();       // K2 - neuromodulatory gain application
    this._consolidateDefenseSlowModel();     // K3 - slow consolidation / long-term plasticity
    this._scoreDefenseOutcomes();            // K4 - outcome / credit learning (TRUTH-BRAKE self-consistency)
    this._computeDefensePerceptionDepth();   // K5 - deep hierarchical perception
    this._computeDefenseAttention();         // K6 - attention / selective routing
    this._computeDefenseInhibition();        // K7 - lateral inhibition (microcircuit)
    this._computeDefenseHomeostasis();       // K8 - adaptive set-point (microcircuit)
    var s = this.state;
    var neuro = {
      version: 1,
      status: 'k1-k8-computed',
      afferent: s.defenseAfferent || null,
      gainControl: s.defenseGainControl || null,
      slowModel: s.defenseSlowModel || null,
      outcomeModel: s.defenseOutcomeModel || null,
      perceptionDepth: s.defensePerceptionDepth || null,
      attention: s.defenseAttention || null,
      inhibition: s.defenseInhibition || null,
      homeostasis: s.defenseHomeostasis || null,
      loops: [
        'K1 afferent -> scoreStress (externalPressure folded into stress by base)',
        'K2 gain -> servo/E-I brake (reg.gain/inhibition drive emission dampening)',
        'K3 slow consolidation -> regime-shift indicator (parallel track; never touches dm.prior)',
        'K4 outcome -> TRUTH-BRAKE self-consistency (callHitRate; NOT an external reward)',
        'K5 perception depth -> advisory portalErrorEstimate (unmodeled depth)',
        'K6 attention -> advisory salience ranking (focus vs suppressed)',
        'K7 inhibition -> servo/E-I brake drive term (winner-take-most)',
        'K8 set-point -> servo allostatic target (deviationFromBaseline regulate-to-target)'
      ]
    };
    s.defenseNeuro = neuro;
    if (s.cognition && typeof s.cognition === 'object') s.cognition.neuro = neuro;   // additive: new key only
    return neuro;
  };

  // ── AI SLOT (documented, INERT stub — NEVER called from the cycle) ─────────────────────────────
  // Node->business authoring / semantic mapping is a genuine "code-cannot-do-this" slot. Per the
  // killswitch requirement it is DELIBERATELY not wired to a live call: it is never invoked from
  // cycle()/_updateDefenseModel/_computeDefenseActuation (grep-verifiable), so the deterministic 30s
  // cycle can never trigger paid AI. When the operator wires this, it MUST (a) run only on an explicit
  // operator trigger, (b) POST to a SERVER endpoint that enforces lib/ai-kill-switch spendDisabled(),
  // and (c) carry NO API key in client code. Until then it is a no-op returning its contract.
  DefenseBrain.prototype.authorDefenseNodeBusiness = function (nodeId, opts) {
    return {
      ok: false, stub: true, nodeId: nodeId || null, operatorTriggered: !!(opts && opts.operatorTriggered),
      reason: 'documented AI slot; intentionally inert until wired to a killswitch-gated /api endpoint by explicit operator action (never runs on the cycle)'
    };
  };

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
