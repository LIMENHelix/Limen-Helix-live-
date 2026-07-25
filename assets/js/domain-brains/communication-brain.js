/**
 * communication-brain.js — Communication Domain Cognitive Engine
 *
 * Portal issues: DISINFORMATION_CRISIS, TELECOM_FAILURE, CENSORSHIP_OVERREACH,
 *                MEDIA_MONOPOLY, CYBER_PROPAGANDA
 *
 * Emissions: intelligence, governance, culture, law, population
 * Exposes: window.LIMENCommunicationBrain
 */
(function () {
  'use strict';
  if (!window.LIMENDomainBrainBase) { console.warn('[CommunicationBrain] Base not loaded'); return; }
  var Base = window.LIMENDomainBrainBase;

  function CommunicationBrain() {
    Base.call(this, { groundedOnly: true,   // circularity cut 2026-07-24
       domainId: 'communication', label: 'Communication', snapshotKey: 'communication', cycleInterval: 30000 });
  }
  CommunicationBrain.prototype = Object.create(Base.prototype);
  CommunicationBrain.prototype.constructor = CommunicationBrain;

  CommunicationBrain.prototype.init = function () {
    Base.prototype.init.call(this);

    // ── ACTUATION GATE (2026-07-13) — per-actuation validity for the communication domain.
    // Mirrors energy-brain.js:76. Each flag turns a deterministic overlay ON; all are reversible.
    //   refractory: TRUE  — rate-limit repeated identical cross-domain emissions (Neuro Ref III.3).
    //   servo:      TRUE  — regulate-to-target PI controller drives inhibition toward the drive
    //                        target; effector = emission dampening (communicationModel carries a real
    //                        inhibition term + adaptive baseline). Neuro Ref V.2/XII/XIII.1.
    //   eiBrake:    TRUE  — E/I brake consumes the servo's emissionFactor and dampens the domain's
    //                        real efferent output (crossDomainEmissions magnitude + opportunity
    //                        confidence) proportionally to the drive/inhibition deficit. Neuro Ref XIII.1.
    //   phase:      FALSE — ADVISORY ONLY. The phase-coherence router is honest+deterministic, but the
    //                        phase transition is NEVER wired as external reward: communication is not a
    //                        Thing1-validated domain (no p3/p7 ground-truth distress label). K4 credit
    //                        now routes through the central honest gate (window.LIMENK4.credit) as
    //                        self-consistency calibration only (isReward=false); with phase advisory-OFF
    //                        the transition does not feed that gate. Fabricating a reward would be dishonest.
    this._actuation = { overlays: true, refractory: true, servo: true, eiBrake: true, phase: false };
    // FIX 2026-07-21 (port config sweep): _actuation.refractory was true but _refractoryParams was
    // absent, so RefractoryLimiter constructed with the DEFAULTS (absoluteWindow:0), which
    // limen-refractory-limiter.js treats as a NO-OP ("limiter not configured"). The armed brake did
    // nothing. Added the D.3 "reuse" defaults (identical to energy/finance) so the armed brake
    // actually gates duplicate drafts. Reversible: set _actuation.refractory=false to disarm.
    this._refractoryParams = {
      absoluteWindow: 900000,     // 15 min hard dead-time before the same diagnosis re-drafts (matches Energy)
      relativeWindow: 3600000,    // 1 hr raised-bar window (doc 1:4 ratio preserved)
      overrideThreshold: 0.9      // only stress >= 0.9 (or a stronger stimulus) re-fires in-window
    };

    // ── THING2 RECURSIVE-PHASE KERNEL as the phase source (2026-07-13) ──
    // The phase-coherence router and phase-transition reward previously read s.phase (a naive
    // per-cycle guess / static PHASE_M lineage). We now feed those from the REAL Thing2 kernel
    // (assets/js/limen-thing2-adapter.js -> window.LIMENThing2.phaseOfSeries), which runs the
    // validated financial phase pipeline over this domain's own stress trajectory. The kernel is
    // PURE MATH (no network, no AI) so the 30s cycle stays deterministic. Output is INTERPRETIVE
    // posture only (interpretive:true, validated:false); we never surface it as validated.
    // Fallback: if the adapter is absent or history < 8, _kernelPhase stays null and s.phase is used.
    this._kernelPhase = null;
    this._phaseSeries = [];
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        var _ps = JSON.parse(localStorage.getItem('limen:phaseseries:communication'));
        if (Array.isArray(_ps)) this._phaseSeries = _ps;
      }
    } catch (e) { this._phaseSeries = this._phaseSeries || []; }

    this.diagnosisIndex = {
      'DISINFORMATION_CRISIS':  ['misinformation_spread', 'disinformation_campaign', 'narrative_manipulation', 'amplification_bias', 'signal_degradation', 'communication_high_stress', 'macro_shock'],
      'TELECOM_FAILURE':        ['infrastructure_failure', 'network_disruption', 'connectivity_loss', 'service_outage', 'communication_high_stress'],
      'CENSORSHIP_OVERREACH':   ['speech_restriction', 'content_suppression', 'platform_censorship', 'regulatory_overreach', 'information_control'],
      'MEDIA_MONOPOLY':         ['market_concentration', 'editorial_capture', 'audience_fragmentation', 'echo_chamber', 'platform_dominance', 'structural_stress'],
      'CYBER_PROPAGANDA':       ['narrative_manipulation', 'bot_amplification', 'coordinated_inauthentic', 'information_contamination', 'disinformation_campaign', 'macro_shock']
    };

    this.emissionRules = [
      { targetDomain: 'intelligence', signalType: 'information_contamination_signal', condition: function (s) { return s.stress >= 0.15; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.55); } },
      { targetDomain: 'governance', signalType: 'public_perception_pressure', condition: function (s) { return s.stress >= 0.20; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); } },
      { targetDomain: 'culture', signalType: 'narrative_identity_shaping', condition: function (s) { return s.stress >= 0.20; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); } },
      { targetDomain: 'law', signalType: 'speech_regulatory_pressure', condition: function (s) { return s.stress >= 0.30; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.4); } },
      { targetDomain: 'population', signalType: 'behavioral_informational_influence', condition: function (s) { return s.stress >= 0.30; }, magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.4); } }
    ];

    // Cognition-parity one-shot loaders (mirror energy/culture init). Each is try/caught and
    // resolves only files that actually exist; 404s are honest 'missing'. Never fabricates.
    try { this._loadCommunicationDiagnosisBundles(); } catch (e) {}   // real artifact-source bundles (only ones that exist)
    try { this._loadCommunicationL1PortalDepth(); } catch (e) {}      // scan L1 branches (treatments mad-lib -> NOT admitted; real tickers only)
    try { this._loadCommunicationNetworkLayer(); } catch (e) {}       // NETWORK: telecom/infrastructure sub-portal (real-content, unbundled) as an additive LAYER
  };

  CommunicationBrain.prototype.normalizeSignals = function () {
    var signals = [], rawSignals = (this._rawDomain && this._rawDomain.signals) || [];
    for (var i = 0; i < rawSignals.length; i++) signals.push(rawSignals[i]);
    this._activeConditions = [];

    // Long-arc baseline — communication always has signal degradation and amplification pressure
    this._activeConditions.push('signal_degradation');
    this._activeConditions.push('amplification_bias');
    signals.push('BASELINE: Persistent information ecosystem signal degradation and amplification pressure');

    var feeds = this.state.feeds;
    for (var fi = 0; fi < feeds.length; fi++) {
      var f = feeds[fi], fn = (f.name || '').toLowerCase();
      if ((fn.indexOf('newsapi') !== -1 || fn.indexOf('headlines') !== -1) && f.value !== undefined && f.value > 0) {
        if (f.value >= 50) this._activeConditions.push('amplification_bias');
        if (f.value >= 30) this._activeConditions.push('narrative_manipulation');
        signals.push('FEED: NewsAPI headlines \u2014 ' + (f.label || f.value + ' articles'));
      }
      if (fn.indexOf('rss media') !== -1 && f.value !== undefined && f.value > 0) {
        if (f.value >= 20) this._activeConditions.push('signal_degradation');
        signals.push('FEED: RSS media \u2014 ' + (f.label || f.value));
      }
      if ((fn.indexOf('press freedom') !== -1 || fn.indexOf('rsf') !== -1 || fn.indexOf('cpj') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('speech_restriction');
        this._activeConditions.push('content_suppression');
        if (f.value >= 5) this._activeConditions.push('regulatory_overreach');
        signals.push('FEED: Press freedom incident \u2014 ' + (f.label || f.value));
      }
      if ((fn.indexOf('snopes') !== -1 || fn.indexOf('politifact') !== -1 || fn.indexOf('fact check') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('misinformation_spread');
        if (f.value >= 10) this._activeConditions.push('disinformation_campaign');
        signals.push('FEED: Fact check throughput \u2014 ' + (f.label || f.value));
      }
      if ((fn.indexOf('cloudflare radar') !== -1 || fn.indexOf('netblocks') !== -1 || fn.indexOf('outage') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('network_disruption');
        if (f.value >= 3) this._activeConditions.push('connectivity_loss');
        if (f.value >= 5) this._activeConditions.push('infrastructure_failure');
        signals.push('FEED: Connectivity outage events \u2014 ' + (f.label || f.value));
      }

      // \u2500\u2500 INSTITUTIONAL FEED-DERIVED CONDITIONS (Federal Register + CISA) \u2500\u2500

      // Fed Reg FCC \u2014 telecom regulatory volume \u2192 TELECOM_FAILURE / CENSORSHIP_OVERREACH
      if (fn.indexOf('fed reg fcc') !== -1 && f.value !== undefined && f.value >= 5) {
        this._activeConditions.push('infrastructure_failure');
        signals.push('Fed Reg FCC: ' + f.value + ' telecom regulatory docs (30d)');
      }
      if (fn.indexOf('fed reg fcc') !== -1 && f.value !== undefined && f.value >= 10) {
        this._activeConditions.push('regulatory_overreach');
        this._activeConditions.push('content_suppression');
      }

      // Fed Reg FTC \u2014 antitrust/media merger regulatory \u2192 MEDIA_MONOPOLY
      if (fn.indexOf('fed reg ftc') !== -1 && f.value !== undefined && f.value >= 3) {
        this._activeConditions.push('market_concentration');
        signals.push('Fed Reg FTC: ' + f.value + ' antitrust/media docs (30d)');
      }
      if (fn.indexOf('fed reg ftc') !== -1 && f.value !== undefined && f.value >= 6) {
        this._activeConditions.push('platform_dominance');
        this._activeConditions.push('editorial_capture');
      }

      // CISA Advisories \u2014 cyber/network \u2192 CYBER_PROPAGANDA / TELECOM_FAILURE
      if (fn.indexOf('cisa advisories') !== -1 && f.value !== undefined && f.value >= 5) {
        this._activeConditions.push('network_disruption');
        signals.push('CISA Advisories: ' + f.value + ' active advisories');
      }
      if (fn.indexOf('cisa advisories') !== -1 && f.value !== undefined && f.value >= 15) {
        this._activeConditions.push('connectivity_loss');
        this._activeConditions.push('information_contamination');
      }

      // BBC World News \u2014 editorial international news volume \u2192 broad amplification signal
      if (fn.indexOf('bbc world') !== -1 && f.value !== undefined && f.value >= 20) {
        this._activeConditions.push('amplification_bias');
        signals.push('BBC World News: ' + f.value + ' items \u2014 editorial international cadence');
      }
      if (fn.indexOf('bbc world') !== -1 && f.value !== undefined && f.value >= 50) {
        this._activeConditions.push('narrative_manipulation');
      }
    }

    for (var rsi = 0; rsi < rawSignals.length; rsi++) {
      var rs = (typeof rawSignals[rsi] === 'string' ? rawSignals[rsi] : '').toLowerCase();
      if (rs.indexOf('disinformation') !== -1 || rs.indexOf('misinformation') !== -1 || rs.indexOf('fake news') !== -1) {
        if (this._activeConditions.indexOf('misinformation_spread') === -1) this._activeConditions.push('misinformation_spread');
        if (this._activeConditions.indexOf('disinformation_campaign') === -1) this._activeConditions.push('disinformation_campaign');
      }
      if (rs.indexOf('censor') !== -1 || rs.indexOf('suppress') !== -1 || rs.indexOf('ban') !== -1 || rs.indexOf('restrict') !== -1) {
        if (this._activeConditions.indexOf('speech_restriction') === -1) this._activeConditions.push('speech_restriction');
        if (this._activeConditions.indexOf('content_suppression') === -1) this._activeConditions.push('content_suppression');
      }
      if (rs.indexOf('outage') !== -1 || rs.indexOf('telecom') !== -1 || rs.indexOf('internet shutdown') !== -1 || rs.indexOf('blackout') !== -1) {
        if (this._activeConditions.indexOf('network_disruption') === -1) this._activeConditions.push('network_disruption');
        if (this._activeConditions.indexOf('connectivity_loss') === -1) this._activeConditions.push('connectivity_loss');
      }
      if (rs.indexOf('monopol') !== -1 || rs.indexOf('consolidat') !== -1 || rs.indexOf('merger') !== -1) {
        if (this._activeConditions.indexOf('market_concentration') === -1) this._activeConditions.push('market_concentration');
        if (this._activeConditions.indexOf('platform_dominance') === -1) this._activeConditions.push('platform_dominance');
      }
      if (rs.indexOf('bot') !== -1 || rs.indexOf('troll') !== -1 || rs.indexOf('propaganda') !== -1 || rs.indexOf('influence operation') !== -1) {
        if (this._activeConditions.indexOf('bot_amplification') === -1) this._activeConditions.push('bot_amplification');
        if (this._activeConditions.indexOf('coordinated_inauthentic') === -1) this._activeConditions.push('coordinated_inauthentic');
      }
    }

    var snap = this._getSnapshot();
    if (snap && snap.defenseSignals) {
      for (var si = 0; si < snap.defenseSignals.length; si++) {
        var sig = snap.defenseSignals[si];
        if (sig.affectedDomains && sig.affectedDomains.indexOf('communication') !== -1) {
          this._activeConditions.push(sig.eventType);
          signals.push('FEED [DEFENSE]: ' + (sig.eventType || '').replace(/_/g, ' '));
        }
      }
    }
    if (snap && snap.macroShock && snap.macroShock.detected) this._activeConditions.push('macro_shock');

    if (window.LIMENDomainBrains) {
      var allBrains = window.LIMENDomainBrains.getAll();
      for (var bk in allBrains) {
        if (bk === 'communication') continue;
        var b = allBrains[bk]; if (!b || !b.state) continue;
        var bEm = b.state.crossDomainEmissions || [];
        for (var bei = 0; bei < bEm.length; bei++) {
          var be = bEm[bei];
          if (be.targetDomain === 'communication' && be.magnitude > 0.1) {
            signals.push('FEED [' + bk.toUpperCase() + ']: ' + (be.signal || '').replace(/_/g, ' ') + ' — ' + Math.round(be.magnitude * 100) + '%');
          }
        }
      }
    }

    // ── CIRCULARITY CUT (2026-07-24) — no condition may be manufactured from this
    //    domain's own stress scalar. normalizeSignals runs BEFORE scoreStress, so these
    //    gates read the PREVIOUS cycle's stress: the resulting "active diagnosis" restated
    //    one number instead of adding evidence, and because emissions are gated on an
    //    active diagnosis and peers fold received pressure back into stress, it closed a
    //    feedback ring carrying no new information. Reground to a real feed to restore a
    //    condition; never re-derive one from stress.
    //    SURVIVES on real feeds/events : 5: information_contamination, narrative_manipulation, regulatory_overreach, content_suppression, platform_dominance
    //    REMOVED, no other source in this file : 4: echo_chamber, audience_fragmentation, communication_high_stress, structural_stress

    var extPressure = this.getExternalPressure ? this.getExternalPressure() : 0;
    if (extPressure >= 0.10) this._activeConditions.push('information_control');
    if (extPressure >= 0.20) this._activeConditions.push('editorial_capture');

    this.state.signals = signals;
    return Promise.resolve();
  };

  CommunicationBrain.prototype.deriveDiagnoses = function () {
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
          window.DomainTelemetryAdapter.fromLiveCached("communication", self.state, self._runtimeOverlay || null)
            .then(function (ov) { if (ov) self._runtimeOverlay = ov; }).catch(function () {});
        }
      } catch (_e) {}
    });
  };

  CommunicationBrain.prototype.recommendTreatments = function () {
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

  CommunicationBrain.prototype.surfaceOpportunities = function () {
    Base.prototype.surfaceOpportunities.call(this);
    var opps = [], stress = this.state.stress, activeDx = this.state.diagnoses.filter(function (d) { return d.active; }), allDx = this.state.diagnoses || [], companies = this.state.companies, seen = {};
    function add(o) { var key = o.title.toLowerCase().replace(/[^a-z0-9]/g, ''); if (seen[key]) return; seen[key] = true; opps.push(o); }

    for (var di = 0; di < activeDx.length; di++) {
      var dx = activeDx[di], dxLabel = (dx.label || dx.id || '').replace(/_/g, ' ');
      add({ title: dxLabel + ' — content verification and trust infrastructure', rank: stress * dx.relevance, path: 'RESEARCHABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.50) add({ title: dxLabel + ' — platform integrity and moderation systems', rank: stress * dx.relevance * 0.9, path: 'INVESTABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.55 && dx.relevance >= 0.2) add({ title: dxLabel + ' — signal filtering and prioritization technology', rank: stress * 0.85, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      add({ title: dxLabel + ' — communication resilience and interoperability', rank: stress * dx.relevance * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
    }

    var termCo = [] /* neutralized: distress only from validated gate (see energy-brain) */;
    if (termCo.length > 0) add({ title: 'Communication terminal entity distressed positioning', rank: 0.95, path: 'INVESTABLE', urgency: 'high', source: 'company_terminal', tier: 1, companies: termCo.map(function (c) { return c.ticker; }), stress: stress });
    if (this.state.convergence && this.state.convergence.primary_signal) add({ title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — communication convergence response', rank: 0.98, path: 'INVESTABLE', urgency: 'high', source: 'convergence', tier: 1, stress: stress });

    var emissions = this.state.crossDomainEmissions || [];
    for (var ei = 0; ei < emissions.length; ei++) { var em = emissions[ei]; add({ title: 'Communication \u2192 ' + (em.targetDomain || '').replace(/_/g, ' ') + ' — ' + (em.signal || em.signalType || '').replace(/_/g, ' '), rank: (em.magnitude || 0.5) * stress * 0.8, path: 'INVESTABLE', urgency: em.magnitude > 0.6 ? 'high' : 'medium', source: 'cross_domain', tier: 2, stress: stress }); }

    if (stress >= 0.50) {
      add({ title: 'Misinformation detection and counter-narrative infrastructure', rank: stress * 0.70, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'misinfo_detect', stress: stress });
      add({ title: 'Media literacy and information resilience programs', rank: stress * 0.65, path: 'INVESTABLE', urgency: stress > 0.70 ? 'medium' : 'watching', source: 'lagging', tier: 3, diagnosisId: 'media_literacy', stress: stress });
    }
    if (stress >= 0.60) {
      add({ title: 'Secure communication and encrypted messaging infrastructure', rank: stress * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'secure_comms', stress: stress });
      add({ title: 'Content authentication and provenance tracking systems', rank: stress * 0.72, path: 'RESEARCHABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'content_auth', stress: stress });
      add({ title: 'Telecom resilience and network redundancy infrastructure', rank: stress * 0.68, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'telecom_resilience', stress: stress });
    }

    var nearDx = allDx.filter(function (d) { return !d.active && d.relevance > 0 && d.totalTriggers > 0; });
    for (var ndi = 0; ndi < nearDx.length; ndi++) { if (stress >= 0.45) add({ title: (nearDx[ndi].label || '').replace(/_/g, ' ') + ' — early-stage monitoring', rank: stress * (nearDx[ndi].relevance || 0.1) * 0.5, path: 'RESEARCHABLE', urgency: 'watching', source: 'near_diagnosis', tier: 2, stress: stress, nearDiagnosisId: nearDx[ndi].id }); }

    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });

    // ═══ CANONICAL ENRICHMENT — merge communication playbook detail per opportunity ═══
    // Playbooks are loaded from assets/js/domain-brains/data/communication-opportunity-playbooks.js.
    // All narrative (explain/action/valueRange/trigger/validation/steps/outcome/failure/
    // window/fastPath/examples/branch_up/branch_down/realWorld) is domain-authored.
    // moneyChain is composed from those fields + live state readouts — no new prose.
    var PB_LIST = window.LIMENCommunicationOpportunityPlaybooks || [];
    var _byId = {};
    for (var _pbi = 0; _pbi < PB_LIST.length; _pbi++) _byId[PB_LIST[_pbi].id] = PB_LIST[_pbi];

    // Diagnosis → playbook id
    var _PB_MAP = {
      'DISINFORMATION_CRISIS': 'disinformation_crisis',
      'TELECOM_FAILURE':       'telecom_failure',
      'CENSORSHIP_OVERREACH':  'censorship_overreach',
      'MEDIA_MONOPOLY':        'media_monopoly',
      'CYBER_PROPAGANDA':      'cyber_propaganda'
    };
    // Lagging aliases coined by this brain → playbook id (domain-authored mapping)
    var _LAGGING_MAP = {
      'misinfo_detect':     'disinformation_crisis',
      'media_literacy':     'disinformation_crisis',
      'secure_comms':       'censorship_overreach',
      'content_auth':       'disinformation_crisis',
      'telecom_resilience': 'telecom_failure'
    };

    function _resolvePbId(o) {
      if (o.diagnosisId && _PB_MAP[o.diagnosisId]) return _PB_MAP[o.diagnosisId];
      if (o.source === 'lagging' && o.diagnosisId && _LAGGING_MAP[o.diagnosisId]) return _LAGGING_MAP[o.diagnosisId];
      if (o.nearDiagnosisId && _PB_MAP[o.nearDiagnosisId]) return _PB_MAP[o.nearDiagnosisId];
      return null;
    }

    function _urgencyLabel(u) {
      if (u === 'high') return 'IMMEDIATE';
      if (u === 'medium') return 'ACTIVE';
      if (u === 'watching') return 'WATCH';
      return (u || '').toUpperCase();
    }

    // Compensation model — INVESTABLE + RESEARCHABLE only
    var _COMP = {
      'INVESTABLE':   { type: 'invest',   base: 5,  unit: 'profit%', tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
      'RESEARCHABLE': { type: 'research', base: 5,  unit: 'cite/%',  tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 research outputs delivered' },  maxTier: { tier: 3, comp: 15 } }
    };

    for (var oi = 0; oi < opps.length; oi++) {
      var o = opps[oi];

      // Stable id + domain metadata
      o.id = (o.diagnosisId || o.nearDiagnosisId || o.source || 'opp').replace(/[^a-zA-Z0-9]/g, '_') + '_' + (o.path || '').toLowerCase().replace(/[^a-z]/g, '') + '_t' + (o.tier || 0);
      o.domain = 'communication';
      o.confidence = Math.round(Math.min(1, (o.rank || 0)) * 100);
      if (!o.whyNow) o.whyNow = o.title;
      // Normalize urgency to contract vocabulary for central-page projection
      o.urgencyLabel = _urgencyLabel(o.urgency);

      // Map to playbook + attach narrative (only if legitimate mapping exists)
      var pbId = _resolvePbId(o);
      o.playbookId = pbId;
      var pb = pbId ? _byId[pbId] : null;

      if (pb) {
        o.explain     = pb.explain;
        o.action      = pb.action;
        o.valueRange  = pb.valueRange;
        o.trigger     = pb.trigger;
        o.validation  = pb.validation;
        o.steps       = pb.steps;
        o.outcome     = pb.outcome;
        o.failure     = pb.failure;
        o.window      = pb.window;
        o.fastPath    = pb.fastPath;
        o.examples    = pb.examples;
        o.branch_up   = pb.branch_up;
        o.branch_down = pb.branch_down;
        if (pb.realWorld) o.realWorld = pb.realWorld;
        if (pb.saturation) o.saturation = pb.saturation;
      }

      // Compensation (applies to all, path-based)
      o.compensation = _COMP[o.path] || null;
      if (o.compensation) o.paths = [o.path];

      // Validity lifecycle (tier-scaled expiry, matching contract)
      o.validity = {
        createdAt: Date.now(),
        lastValidated: Date.now(),
        expiryWindowDays: o.tier === 1 ? 30 : o.tier === 2 ? 60 : 90,
        requiresRevalidation: false,
        invalidationReasons: []
      };

      // moneyChain — composed strictly from playbook fields + live state. No new prose.
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

        var evidenceParts = ['Domain: communication', 'Stress: ' + stressPct + '%'];
        if (o.confidence) evidenceParts.push('Confidence: ' + o.confidence + '%');
        if (o.diagnosisId) evidenceParts.push('Diagnosis: ' + String(o.diagnosisId).replace(/_/g, ' ').toLowerCase());
        if (pb.trigger) evidenceParts.push(pb.trigger);
        var evidence = evidenceParts.join('. ') + '.';

        var whyPays = pb.outcome || '';
        if (pb.valueRange) whyPays = (whyPays ? whyPays + ' ' : '') + 'Value range: ' + pb.valueRange + '.';

        var nextStep = (pb.fastPath && pb.fastPath.length) ? pb.fastPath[0] : (pb.steps && pb.steps.length ? pb.steps[0] : '');

        o.moneyChain = {
          doThis:    pb.action || '',
          whyPays:   whyPays,
          target:    target,
          timing:    timing,
          invalidIf: pb.failure || '',
          evidence:  evidence,
          nextStep:  nextStep
        };
      }
    }

    this.state.opportunities = opps;
    this.state.opportunityCount = opps.length;
    return Promise.resolve();
  };

  CommunicationBrain.prototype._checkDiagnosisActions = function () {
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; }); if (activeDx.length === 0) return;
    var adapters = window.LIMENActionAdapters; if (!adapters) return;
    for (var i = 0; i < activeDx.length; i++) { var dx = activeDx[i]; if (adapters.getDrafts && adapters.getDrafts({ domain: 'communication', intentId: dx.id }).length > 0) continue; adapters.createDraft('REPORT_GENERATION', { domain: 'communication', sourceType: 'domain_brain', sourceId: dx.id, intentId: dx.id, title: 'Communication Alert: ' + dx.label, intent: { domain: 'communication', title: dx.label, status: 'ACTIVE', priority: this.state.stress, progress: 0, strategyType: 'diagnosis_response', steps: [{ type: 'ANALYZE', label: 'Assess ' + dx.label + ' impact on information ecosystem', status: 'PENDING' }, { type: 'INVESTIGATE', label: 'Identify affected channels, platforms, and audiences', status: 'PENDING' }, { type: 'POSITION', label: 'Evaluate integrity and resilience opportunities', status: 'PENDING' }] } }); }
  };

  CommunicationBrain.prototype.resolveDeepContent = function () {
    var self = this; var resolver = window.LIMENPortalContentResolver; if (!resolver) return Promise.resolve();
    return resolver.resolveForBrain(this.state).then(function (content) { self.state.resolvedContent = content; if (content) { var dt = []; for (var dxId in content.byDiagnosis) { var dxC = content.byDiagnosis[dxId]; for (var i = 0; i < dxC.treatments.length; i++) { var t = dxC.treatments[i]; dt.push({ id: 'deep_' + t.nodeId + '_' + i, label: t.label, type: t.type, evidence: t.evidence, description: t.description, cite: t.cite, steps: t.steps, monitoring: t.monitoring, escalation: t.escalation, diagnosisId: dxId, nodeId: t.nodeId, nodeLabel: t.nodeLabel, hasDepth: t.hasDepth, source: 'canonical_deep' }); } } if (dt.length > 0) self.state.treatments = dt; } }).catch(function () {});
  };

  var _origCycle = CommunicationBrain.prototype.cycle;
  CommunicationBrain.prototype.cycle = function () {
    var self = this;
    return _origCycle.call(this).then(function () { return self.resolveDeepContent(); }).then(function () {
      // PHASE B — recurrent loop step + higher layers + DDP build (communication-local, try/caught).
      try { self._updateCommunicationModel(); } catch (e) {}
      try { self._computeCommunicationOverlays(); } catch (e) {}   // NEURO-SUBSTRATE OVERLAY WIRING (per-domain, ported from energy 2026-07-21): invokes communication's OWN overlay modules each cycle; shadow, proposals only
    });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // NEURO-SUBSTRATE OVERLAY WIRING — per-domain copy of energy's _computeEnergyOverlays
  // (2026-07-21, full per-domain independence). Invokes communication's OWN modules
  // (window.Communication{Metaplasticity,Extinction,RetrogradeThrottle,PredictionErrorCompressor,
  // OfflineMaintenance,NeuroSubstrate,ConnectivityAudit}) against communication's OWN runtime def
  // (communication.json runtime.params + edges/issues/activations). SHADOW: writes state.communicationOverlays;
  // the only actuation is metaplasticity -> the refractory dead-time (matches energy exactly).
  // Degrade-safe: returns mode 'off' when the modules are not on the page (they load only on the
  // communication console), 'loading' until communication.json arrives.
  // ════════════════════════════════════════════════════════════════════════════
  CommunicationBrain.prototype._loadCommunicationDef = function () {
    if (this._communicationDef) return this._communicationDef;
    if (this._communicationDefLoading) return null;
    this._communicationDefLoading = true;
    var self = this;
    if (typeof fetch === 'function') {
      try {
        fetch('/assets/data/domains/communication.json').then(function (r) { return r.json(); })
          .then(function (def) { self._communicationDef = def; })
          .catch(function () { self._communicationDefLoading = false; });
      } catch (e) { this._communicationDefLoading = false; }
    }
    return null;
  };

  CommunicationBrain.prototype._computeCommunicationOverlays = function () {
    var s = this.state;
    function mod(glob, reqPath) {
      if (typeof window !== 'undefined' && window[glob]) return window[glob];
      if (typeof module !== 'undefined') { try { return require(reqPath); } catch (e) {} }
      return null;
    }
    var META = mod('CommunicationMetaplasticity', '../communication-metaplasticity.js');
    var EXT = mod('CommunicationExtinction', '../communication-extinction.js');
    var RETRO = mod('CommunicationRetrogradeThrottle', '../communication-retrograde-throttle.js');
    var PEC = mod('CommunicationPredictionErrorCompressor', '../communication-prediction-error-compressor.js');
    var OFF = mod('CommunicationOfflineMaintenance', '../communication-offline-maintenance.js');
    var NS = mod('CommunicationNeuroSubstrate', '../communication-neuro-substrate.js');
    var CONN = mod('CommunicationConnectivityAudit', '../communication-connectivity-audit.js');
    if (!(META && EXT && RETRO && PEC && OFF && NS && CONN)) {
      s.communicationOverlays = { version: 1, mode: 'off', note: 'overlay modules not loaded on this page (present only on the communication console)' };
      return null;
    }
    var def = this._loadCommunicationDef();
    if (!def) { s.communicationOverlays = { version: 1, mode: 'loading', note: 'communication.json runtime def loading; overlays compute next cycle' }; return null; }

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

    var intero = s.communicationInteroception || (s.cognition && s.cognition.interoception) || {};
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

    s.communicationOverlays = {
      version: 1, mode: 'shadow', armed: armed,
      volatility: Math.round(volatility * 1000) / 1000,
      metaplasticity: { changes: meta.changes, adapted: adapted, noop: meta.noop },
      extinction: { candidates: ext.candidates, count: ext.candidates.length, noop: ext.noop, actuation: 'PROPOSAL-ONLY (retiring a node edits communication.json — human-gated forever)' },
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
    s.communicationOverlays.mode = armed ? 'armed' : 'shadow';
    s.communicationOverlays.applied = applied;
    s.communicationOverlays.actuationScope = 'metaplasticity->refractory dead-time ONLY (bounded, fail-toward-quiet, reversible). throttle=no-live-consumer; PE=observe-only; extinction+offline-prune=PROPOSAL-ONLY (remove structure, human-gated forever).';
    s.communicationOverlays.note = 'PER-DOMAIN OVERLAY WIRING (ported from energy): communication runs its OWN 6 overlay modules + connectivity recurrenceAudit each cycle on communication.json. ARMED: metaplasticity raises the refractory dead-time with volatility (clamped, reversible). Everything else is proposal/observe-only.';

    if (s.cognition && typeof s.cognition === 'object') s.cognition.overlays = s.communicationOverlays;
    return s.communicationOverlays;
  };

  // ══════════════════════════════════════════════════════════════════════
  // COMMUNICATION COGNITION PARITY (mirrors energy/culture STRUCTURE; only
  // CONTENT is communication: telecom & networks, broadband/connectivity,
  // internet infrastructure (towers/fiber/spectrum), media/broadcasting
  // CHANNELS, journalism & news flow, information dissemination, social-media
  // platforms AS DISTRIBUTION, public-discourse infrastructure).
  // Generic predictive-coding substrate (prior → observe → prediction error →
  // regulation → update prior) + immune / awareness / conscience / intuition /
  // simulation / executive-report + network/information-integrity sub-layer +
  // the 8-section DomainDiagnosisPacket the Civilization cockpit consumes.
  // Never fabricates evidence.
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
    var P = CommunicationBrain.prototype;

    // Communication diagnosis families — an analogy lens for monitoring, NOT evidence.
    var FAMILY = {
      'information-integrity': ['DISINFORMATION_CRISIS', 'CYBER_PROPAGANDA'],
      'infrastructure': ['TELECOM_FAILURE'],
      'expression': ['CENSORSHIP_OVERREACH', 'CYBER_PROPAGANDA'],
      'concentration': ['MEDIA_MONOPOLY', 'CENSORSHIP_OVERREACH'],
      'channel-capture': ['MEDIA_MONOPOLY', 'DISINFORMATION_CRISIS']
    };

    P._neutralCommunicationModel = function () {
      return { version: CM_VERSION, cycle: 0, prior: { expectedStress: 0.5, expectedDiagnoses: [], expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, confidence: 0, samples: 0 }, observation: null, predictionError: null, predictedStress: null, regulation: null, plasticity: { learningRate: CM_LEARNING_RATE, slowRate: CM_SLOW_RATE, consolidation: 'cycle-light/rebuild-heavy' }, readyForHandoff: false, _lowErrorStreak: 0, updated: 0 };
    };
    P._buildCommunicationObservation = function () {
      var s = this.state || {};
      var active = (s.diagnoses || []).filter(function (d) { return d.active; });
      // signal = breadth of live communication feeds (NewsAPI, RSS media, press-freedom, Cloudflare Radar, CISA, BBC World)
      var feeds = s.feeds || [], fc = 0, newest = 0;
      if (Array.isArray(feeds)) {
        for (var i = 0; i < feeds.length; i++) { var fv = feeds[i]; if (fv) { fc++; var u = fv.updated; if (u && u > newest) newest = u; } }
      } else { for (var k in feeds) { if (feeds.hasOwnProperty(k)) { fc++; var u2 = feeds[k] && feeds[k].updated; if (u2 && u2 > newest) newest = u2; } } }
      // companyCount = carriers / platforms / publishers / tower-REITs
      var companyCount = (s.companies || []).length;
      return { stress: typeof s.stress === 'number' ? s.stress : 0, phase: s.phase || null, activeDiagnoses: active.map(function (d) { return d.id; }).sort(), diagnosisCount: active.length, opportunityCount: (s.opportunities || []).length, companyCount: companyCount, signal: Math.min(1, fc / 8), feedNewest: newest, timestamp: Date.now() };
    };
    P._computeCommunicationPredictionError = function (prior, obs) {
      var se = Math.abs(obs.stress - prior.expectedStress), sg = Math.abs(obs.signal - prior.expectedSignal), de = _cmJaccardDistance(obs.activeDiagnoses, prior.expectedDiagnoses);
      var od = Math.max(1, prior.expectedOpportunityCount, obs.opportunityCount), oe = Math.abs(obs.opportunityCount - prior.expectedOpportunityCount) / od;
      var total = _cmClamp(0.4 * se + 0.2 * sg + 0.25 * de + 0.15 * oe, 0, 1);
      return { total: total, stressError: se, signalError: sg, diagnosisError: de, opportunityError: oe, novelty: Math.max(se, de) };
    };
    P._updateCommunicationPrior = function (prior, obs, lr) {
      return { expectedStress: _cmClamp(prior.expectedStress + lr * (obs.stress - prior.expectedStress), 0, 1), expectedDiagnoses: obs.activeDiagnoses.slice(), expectedDiagnosisCount: prior.expectedDiagnosisCount + lr * (obs.diagnosisCount - prior.expectedDiagnosisCount), expectedOpportunityCount: prior.expectedOpportunityCount + lr * (obs.opportunityCount - prior.expectedOpportunityCount), expectedSignal: _cmClamp(prior.expectedSignal + lr * (obs.signal - prior.expectedSignal), 0, 1), confidence: _cmClamp(Math.min(1, (prior.samples + 1) / 20), 0, 1), samples: prior.samples + 1 };
    };
    P._computeCommunicationRegulation = function (cm, obs, pe) {
      var gain = _cmClamp(pe.novelty, 0.05, 0.95), inhib = _cmClamp(1 - pe.novelty, 0, 0.9);
      var starving = obs.stress >= CM_STRESS_FLOOR && obs.opportunityCount === 0, flooding = obs.opportunityCount > CM_FLOOD_CAP;
      var streak = (pe.total < 0.05) ? (cm._lowErrorStreak || 0) + 1 : 0; cm._lowErrorStreak = streak; var looping = streak >= 3;
      var stale = obs.feedNewest > 0 ? (Date.now() - obs.feedNewest) > CM_STALE_MS : false;
      var overconf = cm.prior.confidence > 0.8 && pe.total > 0.4;
      var label = flooding ? 'flooding' : starving ? 'starving' : stale ? 'stale' : looping ? 'looping' : overconf ? 'overconfident' : pe.novelty > 0.4 ? 'surprised' : 'calm';
      return { gain: gain, inhibition: inhib, starving: starving, flooding: flooding, looping: looping, stale: stale, overconfident: overconf, state: label };
    };

    // ── RECURRENT STEP — the proof surface (state.communicationModel) the cockpit reads ──
    P._updateCommunicationModel = function () {
      var cm = this.state.communicationModel || this._neutralCommunicationModel();
      var priorIn = cm.prior;
      var obs = this._buildCommunicationObservation();
      var pe = this._computeCommunicationPredictionError(priorIn, obs);
      var gainBlend = _cmClamp(pe.novelty, 0.05, 0.95);
      var predictedStress = priorIn.expectedStress * (1 - gainBlend) + obs.stress * gainBlend;
      var reg = this._computeCommunicationRegulation(cm, obs, pe);
      var readyForHandoff = (cm.cycle > 0) && (predictedStress >= CM_STRESS_FLOOR) && (obs.diagnosisCount > 0) && !reg.flooding && !reg.stale;

      // ── K4 CLOSED — credit assignment routed through the central honest reward gate
      // (window.LIMENK4.credit). Communication is NOT externalRewardEligible: it has NO
      // external realized-outcome label, so externalOutcome is ALWAYS null and its credit is
      // self-consistency calibration (interpretive), NEVER reward. The gate enforces the
      // preemption external-reward(4) > phase-consistency(3) > call-consistency(2) >
      // stress-consistency(1) > none, and returns isReward=false for every non-external tier.
      // Pure math — no AI, no network on the 30s cycle. Reads the PRIOR cycle's outcome model +
      // phase dynamics (one-cycle lag; mirrors energy-brain). The returned credit modulates the
      // learning RATE only (a calibration knob), never treated as a reward/ground-truth signal.
      var _om = this.state.communicationOutcomeModel;
      var _lr = cm.plasticity.learningRate;
      // thing2 realized phase transition: SELF-CONSISTENCY calibration (interpretive), NOT
      // external reward. phase actuation is advisory-OFF for communication (this._actuation.phase
      // = false), so phaseTransitionHit stays null (a phase transition NEVER teaches learning here).
      var _pt = (this.state.communicationPhaseDynamics || {}).transition;
      var _ptActive = !!(this._actuation && this._actuation.phase && _pt && _pt.hit != null);
      // Signal built from what the brain already computed. externalOutcome MUST be null.
      var _sig = {
        externalOutcome: null,                                                                       // NOT eligible: self-consistency only, never reward
        phaseValidated: !!(_pt && (_pt.validated || _pt.validatedPhaseInvolved)),                    // P3/P7 family gate for phase-consistency tier
        phaseTransitionHit: _ptActive ? (_pt.hit ? 1 : 0) : null,                                    // thing2 transition hit (interpretive; null while phase advisory-off)
        callHitRate: (_om && typeof _om.callHitRate === 'number') ? _om.callHitRate : null,          // TRUTH BRAKE ledger (self-consistency)
        callSamples: (_om && typeof _om.samples === 'number') ? _om.samples : 0,
        stressSelfPred: (_om && typeof _om.hitRate === 'number') ? _om.hitRate : null,               // stress self-prediction
        stressSamples: (_om && typeof _om.samples === 'number') ? _om.samples : 0
      };
      var _k4 = (typeof window !== 'undefined' && window.LIMENK4 && typeof window.LIMENK4.credit === 'function')
        ? window.LIMENK4.credit(_sig) : null;
      var _hit, _creditSource, _isReward;
      if (_k4) {
        _hit = (typeof _k4.credit === 'number') ? _k4.credit : null;
        _creditSource = _k4.creditSource;
        _isReward = !!_k4.isReward;                                                                  // ALWAYS false for communication (not externalRewardEligible)
        if (_hit !== null) _lr = _cmClamp(_lr * (1 + (1 - _hit)), CM_SLOW_RATE, 0.6);                // low self-consistency ⇒ learn faster; high ⇒ hold steady
      } else {
        // FALLBACK (gate absent) — preserve communication's PRIOR behavior: a FIXED learning
        // rate with NO credit modulation (the outcome model was historically exposed but never
        // sped the learning rate). Nothing is applied to _lr; credit source reported as 'none'.
        _hit = null; _creditSource = 'none'; _isReward = false;
      }
      cm._effectiveLearningRate = _lr;
      cm._creditSource = _creditSource;
      cm._creditIsReward = _isReward;                                                                // honest flag: false unless a real external outcome fed the gate
      var nextPrior = this._updateCommunicationPrior(priorIn, obs, _lr);

      cm.cycle += 1; cm.observation = obs; cm.predictionError = pe; cm.predictedStress = predictedStress; cm.regulation = reg; cm.readyForHandoff = readyForHandoff; cm.prior = nextPrior; cm.updated = obs.timestamp;
      this.state.communicationModel = cm;

      var mem = this.state.memory || (this.state.memory = {});
      var log = mem.outcomeLog || (mem.outcomeLog = []);
      log.push({ cycle: cm.cycle, predictionError: Math.round(pe.total * 1000) / 1000, stress: obs.stress, activeDx: obs.diagnosisCount, regulation: reg.state, timestamp: obs.timestamp }); if (log.length > 40) log.shift();

      // H1-H6 — higher communication layers (BEFORE the DDP build so the packet embeds their summaries).
      try { this._computeCommunicationHigherLayers(); } catch (e) {}

      // PHASE K — K1..K8 neuro-completion stack (ported from energy-brain, reading THIS
      // domain's state). Runs in the SAME K1..K8 order energy uses, AFTER the higher layers
      // so it reads the fresh cognition surface, and BEFORE the actuation core so K8's
      // homeostasis (deviationFromBaseline) is available to the servo. Additive/advisory;
      // 100% deterministic (no fetch, no AI). Wrapped so it can never break the cycle.
      try { this._computeCommunicationNeuroLayers(); } catch (e) {}

      // ── ACTUATION (2026-07-13) — regulate-to-target servo + E/I brake + refractory + self-audit,
      // mirroring energy-brain's actuated core but reading COMMUNICATION's own state/edges. Each is
      // behind its _actuation flag and 100% DETERMINISTIC (no AI, no fetch-to-LLM on the cycle). The
      // servo/eiBrake dampen the FRESH-rebuilt emissions/opportunities in place (regenerated every
      // cycle, so reversible), the effector = the domain's real efferent output channel. Phase is
      // advisory (see _actuation gate above). Runs AFTER surfaceOpportunities/emitCrossDomainSignals
      // (base pipeline) so the arrays it regulates already exist.
      try { if (this._actuation && this._actuation.servo) this._computeCommunicationServo(); } catch (e) {}
      try { if (this._actuation && this._actuation.eiBrake) this._computeCommunicationEIBrake(); } catch (e) {}
      try { this._computeCommunicationPhaseDynamics(); } catch (e) {}   // ADVISORY (this._actuation.phase = false)
      try { this._computeCommunicationSelfAudit(); } catch (e) {}       // SPOF/connectivity over the real 89-edge graph

      // NETWORK — telecom/infrastructure & information-integrity sub-portal layer (additive; BEFORE the
      // DDP build so the primary packet's promptView advertises it). NEVER merged into the canonical
      // 5-diagnosis spine.
      try { this._buildCommunicationNetworkLayer(); } catch (e) {}

      // DDP — build the DomainDiagnosisPacket (8-section contract) for the primary diagnosis + one per dx.
      try {
        var _diags = this.state.diagnoses || [];
        var _primary = _diags.filter(function (d) { return d.active; })[0] || _diags[0] || null;
        var _self = this;
        cm.domainDiagnosisPacket = this._buildDomainDiagnosisPacket(_primary);
        this.state.communicationDomainDiagnosisPacket = cm.domainDiagnosisPacket;
        this.state.communicationDomainDiagnosisPackets = _diags.map(function (d) { return _self._buildDomainDiagnosisPacket(d); });
      } catch (e) {}

      // state.cognition — generic surface domain-console-brain.js reads for ANY brain (SELF-MODEL panel).
      this.state.cognition = {
        domain: 'communication',
        communicationModel: cm,
        model: { cycle: cm.cycle, predictionError: cm.predictionError, predictedStress: cm.predictedStress, regulation: cm.regulation },
        communicationImmune: this.state.communicationImmune || null,
        communicationAwareness: this.state.communicationAwareness || null,
        communicationConscience: this.state.communicationConscience || null,
        communicationIntuition: this.state.communicationIntuition || null,
        communicationSimulation: this.state.communicationSimulation || null,
        communicationExecutiveReport: this.state.communicationExecutiveReport || null,
        awareness: this.state.communicationAwareness || null,
        conscience: this.state.communicationConscience || null,
        immune: this.state.communicationImmune || null,
        intuition: this.state.communicationIntuition || null,
        // ── K1..K8 neuro-completion roll-up (additive; generic consoles read this) ──
        neuro: this.state.communicationNeuro || null,
        // ── ACTUATION surfaces (2026-07-13) — additive; generic consoles read these ──
        actuation: this._actuation || null,
        communicationServo: this.state.communicationServo || null,
        communicationBrake: this.state.communicationBrake || null,
        communicationPhaseDynamics: this.state.communicationPhaseDynamics || null,
        communicationSelfAudit: this.state.communicationSelfAudit || null,
        servo: this.state.communicationServo || null,
        brake: this.state.communicationBrake || null,
        phaseDynamics: this.state.communicationPhaseDynamics || null,
        selfAudit: this.state.communicationSelfAudit || null,
        networkLayer: this.state.networkLayer || null,
        treatments: this.state.treatments || [],
        diagnoses: this.state.diagnoses || [],
        opportunities: this.state.opportunities || []
      };
      return cm;
    };

    P._computeCommunicationHigherLayers = function () {
      this._computeCommunicationImmune(); this._computeCommunicationAwareness(); this._computeCommunicationConscience(); this._computeCommunicationIntuition();
      try { this._computeCommunicationSimulation(); } catch (e) {}
      try { this._computeCommunicationExecutiveReport(); } catch (e) {}
    };

    // ── H1 — immune (antigen scan over bundle/feed/regulation state) ──
    P._computeCommunicationImmune = function () {
      var s = this.state, cm = s.communicationModel || {}, reg = cm.regulation || {}, ant = [];
      var bs = (typeof this._communicationBundleStates === 'function') ? this._communicationBundleStates() : [];
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
        ant.push({ type: 'l1-synthetic-treatments', severity: 'medium', action: 'quarantine', note: 'L1 portal treatments are mad-lib templates (fixed-verb family); quarantined from evidence — only real carrier/platform/publisher tickers surfaced relevance-unverified' });
      }
      var sev = ant.some(function (a) { return a.severity === 'high'; }) ? 'high' : ant.some(function (a) { return a.severity === 'medium'; }) ? 'medium' : ant.length ? 'low' : 'none';
      s.communicationImmune = {
        version: 1, immuneState: sev === 'high' ? 'alert' : sev === 'medium' ? 'active' : sev === 'low' ? 'watch' : 'clear', severity: sev,
        antigens: ant.slice(0, 12),
        quarantines: ['L1-portal-treatments-madlib'],
        allowedWithWarning: ant.filter(function (a) { return a.action === 'allow-with-warning'; }).map(function (a) { return a.type + (a.dx ? (':' + a.dx) : ''); }),
        blockedFromPrompt: ant.filter(function (a) { return a.action === 'block-from-prompt-evidence'; }).map(function (a) { return a.dx; }),
        blockedFromTraversal: ['L2'],
        lastScanAt: cm.updated || null
      };
      return s.communicationImmune;
    };
    // ── H2 — awareness (narrative on communication identity / information-ecosystem pressure) ──
    P._computeCommunicationAwareness = function () {
      var s = this.state, cm = s.communicationModel || {}, im = s.communicationImmune || {}, active = (s.diagnoses || []).filter(function (d) { return d.active; });
      var bs = (typeof this._communicationBundleStates === 'function') ? this._communicationBundleStates() : [];
      var covered = bs.filter(function (b) { return b.bundleStatus === 'found'; });
      var missing = bs.filter(function (b) { return b.bundleStatus === 'missing'; });
      var pe = (cm.predictionError && cm.predictionError.total) || 0, dxNames = active.map(function (d) { return d.label || d.id; });
      s.communicationAwareness = {
        version: 1, selfState: im.immuneState === 'alert' ? 'guarded' : (cm.regulation && cm.regulation.state) || 'unknown',
        knowns: covered.map(function (b) { return b.dxId + ' (source-backed' + (b.buildMethod === 'external-source-authored' ? ', external' : '') + ')'; }),
        unknowns: missing.map(function (b) { return b.dxId + ' (no source bundle)'; }),
        uncertainties: ['interpretive tracker — diagnoses are signal-driven readings of information-flow / network / channel-concentration pressure, not validated', 'L1 portal treatments are mad-lib templates (NOT real depth)', 'predictionError=' + (Math.round(pe * 1000) / 1000)],
        suppressions: (im.quarantines || []).concat(['L2-traversal', 'L1-portal-treatments']),
        confidenceDrivers: ['source coverage ' + covered.length + '/' + bs.length, 'regulation ' + ((cm.regulation && cm.regulation.state) || '?'), active.length + ' active dx'],
        selfNarrative: 'Communication: ' + covered.length + '/' + bs.length + ' source-backed, ' + active.length + ' active diagnosis pathway' + (active.length !== 1 ? 's' : '') + ' (' + (dxNames.slice(0, 3).join(', ') || 'none') + '), regulation=' + ((cm.regulation && cm.regulation.state) || '?') + ', immune=' + (im.immuneState || '?') + ', prediction-error ' + (Math.round(pe * 100) / 100) + '.',
        lastAwarenessAt: cm.updated || null
      };
      return s.communicationAwareness;
    };
    // ── H3 — conscience (artifact readiness; COMMUNICATION does INVESTABLE/RESEARCHABLE only — no patent/grant per 2026 rules) ──
    P._computeCommunicationConscience = function () {
      var s = this.state, cm = s.communicationModel || {}, pe = (cm.predictionError && cm.predictionError.total) || 0, cautions = [], blocked = ['patent-claim', 'grant-claim'];
      var bs = (typeof this._communicationBundleStates === 'function') ? this._communicationBundleStates() : [];
      var vetoes = [{ claim: 'patent/grant', reason: 'patent/grant lanes retired across all domains (2026-06-21); communication has no method/embodiment fields' }];
      bs.forEach(function (b) { if (b.bundleStatus === 'missing') { blocked.push('strong-claim:' + b.dxId); vetoes.push({ claim: 'strong-claim:' + b.dxId, reason: 'no source bundle' }); } });
      if (pe > 0.4) cautions.push({ claim: 'high-confidence-claim', reason: 'predictionError spike ' + (Math.round(pe * 1000) / 1000) });
      var hasFound = bs.some(function (b) { return b.bundleStatus === 'found'; });
      s.communicationConscience = { version: 1, conscienceState: 'restrictive', vetoes: vetoes.slice(0, 10), cautions: cautions.slice(0, 8), allowedClaims: ['source-summary'].concat(hasFound ? ['investment-memo-with-warnings'] : []), blockedClaims: blocked.slice(0, 10), artifactReadinessDecision: { patentReady: false, grantReady: false, sbaReady: false, investmentReady: hasFound, researchReady: hasFound, note: 'patent/grant vetoed (no candidate fields); investment/research allowed-with-warning only for source-backed diagnoses' }, reasons: ['overclaim prevention', 'source sufficiency', 'interpretive-not-validated'], lastCheckAt: cm.updated || null };
      return s.communicationConscience;
    };
    // ── H4 — intuition (hunches on emerging contamination / coordinated-campaign patterns; UNVERIFIED) ──
    P._computeCommunicationIntuition = function () {
      var s = this.state, cm = s.communicationModel || {}, reg = cm.regulation || {}, log = (s.memory && s.memory.outcomeLog) || [], hunches = [];
      if (log.length >= 2) { var a = log[log.length - 2].predictionError, b = log[log.length - 1].predictionError; if (typeof a === 'number' && typeof b === 'number' && b - a > 0.05) hunches.push({ hunch: 'emerging information-contamination pattern (prediction error rising) — possible coordinated campaign or signal degradation', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'predictionError rose ' + a + ' → ' + b }); }
      if (reg.state === 'surprised') hunches.push({ hunch: 'novel information-flow disruption entering the system (network event / narrative break / attention shift)', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'regulation = surprised' });
      var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
      var primaryId = (active[0] || {}).id, analogies = [];
      Object.keys(FAMILY).forEach(function (fam) { if (FAMILY[fam].indexOf(primaryId) >= 0) { FAMILY[fam].forEach(function (sib) { if (sib !== primaryId) analogies.push({ analogy: primaryId + ' resembles ' + sib, family: fam, evidenceStatus: 'UNVERIFIED', note: 'shared structural failure-family — a lens for monitoring, not a claim' }); }); } });
      s.communicationIntuition = { version: 1, hunches: hunches.slice(0, 6), analogies: analogies.slice(0, 6), confidence: 'LOW', evidenceStatus: 'UNVERIFIED', lastAt: cm.updated || null };
      return s.communicationIntuition;
    };
    // ── H5 — bounded counterfactual simulation (hypothetical only; UNVERIFIED) ──
    P._computeCommunicationSimulation = function () {
      var s = this.state, cm = s.communicationModel || {};
      var base = typeof s.stress === 'number' ? s.stress : 0;
      function cl(v) { return Math.max(0, Math.min(1, Math.round(v * 1000) / 1000)); }
      var scenarios = [
        { type: 'disinformation_surge', hypothetical: true, assumption: 'platforms manipulated; false narratives amplify faster than verification', simulatedStress: cl(base + 0.2), risk: 'information ecosystem contamination (DISINFORMATION_CRISIS)', intervention: 'content provenance / fact-check throughput / amplification-rate monitoring', falsifier: 'verification keeps pace; amplification of false claims falls' },
        { type: 'telecom_outage', hypothetical: true, assumption: 'core network infrastructure (towers/fiber/routing) fails or is attacked', simulatedStress: cl(base + 0.25), risk: 'connectivity loss / service blackout (TELECOM_FAILURE)', intervention: 'network redundancy / outage telemetry (Cloudflare Radar, CISA) / resilient routing', falsifier: 'uptime + connectivity metrics stay nominal' },
        { type: 'information_monopoly', hypothetical: true, assumption: 'one platform/carrier captures dominant share of distribution', simulatedStress: cl(base + 0.2), risk: 'channel gatekeeping / editorial capture (MEDIA_MONOPOLY)', intervention: 'distribution-pluralism watch / antitrust + interoperability signal', falsifier: 'multiple viable distribution channels persist' },
        { type: 'coordinated_attack', hypothetical: true, assumption: 'organized inauthentic actors run a synchronized influence operation', simulatedStress: cl(base + 0.3), risk: 'coordinated propaganda / bot amplification (CYBER_PROPAGANDA)', intervention: 'coordinated-inauthentic-behavior detection / network-graph anomaly tracking', falsifier: 'no synchronized amplification signature persists' },
        { type: 'speech_clampdown', hypothetical: true, assumption: 'regulatory or platform action suppresses lawful expression', simulatedStress: cl(base + 0.15), risk: 'over-broad censorship (CENSORSHIP_OVERREACH)', intervention: 'press-freedom monitoring (RSF/CPJ) / transparency-report watch', falsifier: 'expression channels stay open; takedowns remain narrowly scoped' }
      ];
      var sim = {
        version: 1, scenarios: scenarios, assumptions: scenarios.map(function (x) { return x.assumption; }),
        simulatedStress: scenarios.map(function (x) { return x.simulatedStress; }),
        simulatedDiagnoses: ['DISINFORMATION_CRISIS', 'TELECOM_FAILURE', 'CYBER_PROPAGANDA'], simulatedOpportunities: [],
        risks: scenarios.map(function (x) { return x.risk; }), interventions: scenarios.map(function (x) { return x.intervention; }),
        falsifiers: scenarios.map(function (x) { return x.falsifier; }), lastSimulatedAt: cm.updated || null
      };
      s.communicationSimulation = sim; return sim;
    };
    // ── H6 — executive self-report (compact status card) ──
    P._computeCommunicationExecutiveReport = function () {
      var s = this.state, cm = s.communicationModel || {}, im = s.communicationImmune || {}, aw = s.communicationAwareness || {}, con = s.communicationConscience || {}, it = s.communicationIntuition || {}, sim = s.communicationSimulation || {};
      var bs = (typeof this._communicationBundleStates === 'function') ? this._communicationBundleStates() : [];
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
        nextBestAction: (bs.length && covered < bs.length) ? 'build/verify source for uncovered diagnoses (ensure telecom/press-freedom/platform-transparency sources are current)' : hv > 0 ? 'human-verify external-source bundles' : 'monitor strongest diagnosis sources (network telemetry, news/amplification signals, press-freedom status)',
        lastReportAt: cm.updated || null
      };
      s.communicationExecutiveReport = rep; return rep;
    };
  })();

  // ════════════════════════════════════════════════════════════════════════════
  // ACTUATED CORE (2026-07-13) — ported + adapted from energy-brain's actuated core.
  // These are the mechanisms that CHANGE behavior (not just describe it), each behind a
  // this._actuation flag, all deterministic (no AI / no fetch-to-LLM on the 30s cycle).
  // Mapped to LIMEN_Helix_Neurology_Reference.html the way ENERGY_NEURO_AUDIT.md mapped Energy:
  //   • servo   = Neuro Ref V.2/XII (set-point homeostasis/allostasis) + XIII.1 (E/I: inhibition
  //               scales with drive) — a real sensor→PI-controller→effector→feedback loop.
  //   • eiBrake = Neuro Ref XIII.1/XIV — the load-bearing inhibitory brake; effector = proportional
  //               dampening of the domain's real efferent output (cross-domain emissions + opps).
  //   • refractory = Neuro Ref III.3 — refractory rate-limit on repeated identical emissions.
  //   • selfAudit  = Neuro Ref XIV (diaschisis / single-points-of-failure) over the REAL graph.
  //   • phase      = ADVISORY (see _actuation gate): coherence router honest; reward NOT validated.
  // ════════════════════════════════════════════════════════════════════════════

  // Inline connectivity audit (Neuro Ref XIV). Removal-based articulation-node finder over the
  // undirected projection of the communication node/edge graph (~24 nodes / 89 edges — trivial).
  // Self-contained so no other file is required (energy uses limen-connectivity-audit.js).
  function _commSpofAudit(edges) {
    var adj = {}, nodes = {};
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i]; if (!e || !e.source || !e.target) continue;
      nodes[e.source] = 1; nodes[e.target] = 1;
      (adj[e.source] = adj[e.source] || []).push(e.target);
      (adj[e.target] = adj[e.target] || []).push(e.source);
    }
    var nodeList = Object.keys(nodes);
    function componentCount(excluded) {
      var seen = {}, comps = 0;
      for (var i = 0; i < nodeList.length; i++) {
        var n = nodeList[i];
        if (n === excluded || seen[n]) continue;
        comps++; var stack = [n]; seen[n] = 1;
        while (stack.length) {
          var c = stack.pop(), nb = adj[c] || [];
          for (var k = 0; k < nb.length; k++) { if (nb[k] !== excluded && !seen[nb[k]]) { seen[nb[k]] = 1; stack.push(nb[k]); } }
        }
      }
      return comps;
    }
    var base = componentCount(null), spof = [];
    for (var j = 0; j < nodeList.length; j++) { if (componentCount(nodeList[j]) > base) spof.push(nodeList[j]); }
    var deg = nodeList.map(function (n) { return { id: n, degree: (adj[n] || []).length }; })
      .sort(function (a, b) { return b.degree - a.degree; });
    return { edgeCount: edges.length, nodeCount: nodeList.length, baseComponents: base, spof: spof, topHubs: deg.slice(0, 5) };
  }

  // ── REGULATE-TO-TARGET SERVO (actuated; Neuro Ref V.2/XII/XIII.1) ────────────────────────────
  // sensor = excitatory drive (stress + how many conditions/diagnoses fire at once) vs the live
  // inhibition term the communicationModel already computes; controller = PI (fast proportional +
  // bounded slow integral, the HPA fast+slow arms); effector = a proportional emission-dampening
  // factor the E/I brake then consumes. The adaptive baseline is the model's learned expectedStress
  // (deviation above it raises the target). Deterministic; never rewrites stress/scoring/diagnoses.
  CommunicationBrain.prototype._computeCommunicationServo = function () {
    function R(x) { return Math.round(x * 1000) / 1000; }
    var s = this.state, cm = s.communicationModel || {}, reg = cm.regulation || {}, prior = cm.prior || {};
    var stress = (typeof s.stress === 'number') ? s.stress : 0;
    var conds = Array.isArray(s._activeConditions) ? s._activeConditions.length : (Array.isArray(s.signals) ? s.signals.length : 0);
    var dxA = Array.isArray(s.diagnoses) ? s.diagnoses.filter(function (d) { return d && d.active; }).length : 0;
    var drive = Math.max(0, Math.min(2, stress + Math.min(conds, 12) / 24 + Math.min(dxA, 6) / 24));
    var inhibition = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;   // live term (1 - novelty)
    var FLOOR = 0.15;
    var baseline = (typeof prior.expectedStress === 'number') ? prior.expectedStress : stress;
    var deviation = Math.max(0, stress - baseline);
    var target = Math.max(FLOOR, Math.min(1, Math.max(drive, FLOOR + deviation)));
    var error = target - inhibition;                                             // >0 => under-braked for the drive
    this._commServoIntegral = Math.max(-0.5, Math.min(0.5, (this._commServoIntegral || 0) + error * 0.15));
    var Kp = 0.8, Ki = 0.4;
    var correction = Math.max(0, Kp * error + Ki * Math.max(0, this._commServoIntegral));   // only ADD braking
    var emissionFactor = Math.max(0.2, Math.min(1, 1 - correction));
    var state = error > 0.25 ? 'runaway-risk' : ((inhibition - target) > 0.4 ? 'over-inhibited' : 'balanced');
    var servo = {
      version: 1, actuated: true, drive: R(drive), inhibition: R(inhibition), target: R(target),
      error: R(error), integral: R(this._commServoIntegral), emissionFactor: R(emissionFactor),
      deviation: R(deviation), state: state,
      note: 'closed-loop allostasis: drives inhibition toward a drive+deviation target; effector = proportional emission dampening (consumed by the E/I brake). Neuro Ref XIII.1/V.2/XII.'
    };
    s.communicationServo = servo;
    return servo;
  };

  // ── REFRACTORY RATE-LIMIT (actuated; Neuro Ref III.3) ────────────────────────────────────────
  // An identical (targetDomain|signal) cross-domain emission repeated within the refractory window
  // is rate-limited (magnitude reduced), preventing the brain from re-shouting the same efferent
  // signal every 30s cycle. Operates on the fresh-rebuilt crossDomainEmissions — raw generation is
  // untouched; only redundant immediate repeats are damped. Reversible via _actuation.refractory.
  CommunicationBrain.prototype._applyCommunicationRefractory = function () {
    var s = this.state;
    if (!(this._actuation && this._actuation.refractory)) return { suppressed: 0, windowMs: 0 };
    var REFRACTORY_MS = 75000;   // ~2.5 cycles
    var REPEAT_FACTOR = 0.5;
    var now = (s.communicationModel && s.communicationModel.updated) || Date.now();
    var log = this._commEmissionRefractoryLog = this._commEmissionRefractoryLog || {};
    var ems = Array.isArray(s.crossDomainEmissions) ? s.crossDomainEmissions : [];
    var suppressed = 0;
    for (var i = 0; i < ems.length; i++) {
      var e = ems[i]; if (!e) continue;
      var key = (e.targetDomain || '') + '|' + (e.signal || e.signalType || '');
      var last = log[key];
      if (last && (now - last) < REFRACTORY_MS && typeof e.magnitude === 'number') {
        e.magnitude = Math.round(e.magnitude * REPEAT_FACTOR * 1000) / 1000;
        e._refractoryLimited = true; suppressed++;
      }
      log[key] = now;
    }
    return { suppressed: suppressed, windowMs: REFRACTORY_MS };
  };

  // ── E/I BRAKE (actuated; Neuro Ref XIII.1/XIV) ───────────────────────────────────────────────
  // Consumes the servo's emissionFactor + the refractory pass and dampens the domain's REAL efferent
  // output PROPORTIONALLY to the drive/inhibition deficit: cross-domain emission magnitude (the
  // afferent pressure other brains integrate) and opportunity confidence (what the console/DDP
  // publish). Effector operates on the fresh-rebuilt arrays (regenerated each cycle → reversible via
  // _actuation.eiBrake). Never rewrites stress/scoring/diagnoses/communication.json.
  CommunicationBrain.prototype._computeCommunicationEIBrake = function () {
    var s = this.state, servo = s.communicationServo || null;
    var eiFactor = 1, reasons = [];
    if (servo && typeof servo.emissionFactor === 'number') eiFactor = servo.emissionFactor;
    if (servo && servo.state === 'runaway-risk') reasons.push({ code: 'ei-imbalance', severity: 'dampen', detail: 'inhibition ' + servo.inhibition + ' below target ' + servo.target + ' (drive ' + servo.drive + ')' });
    // REFRACTORY pass first (rate-limits repeats in place), then proportional E/I dampening.
    var refr = this._applyCommunicationRefractory();
    var dampenedOpps = 0, dampenedEms = 0;
    if (eiFactor < 0.999) {
      var opps = Array.isArray(s.opportunities) ? s.opportunities : [];
      for (var i = 0; i < opps.length; i++) {
        if (typeof opps[i].confidence === 'number') { opps[i].confidence = Math.round(opps[i].confidence * eiFactor); opps[i]._eiDampened = true; dampenedOpps++; }
      }
      var ems = Array.isArray(s.crossDomainEmissions) ? s.crossDomainEmissions : [];
      for (var j = 0; j < ems.length; j++) {
        if (typeof ems[j].magnitude === 'number') { ems[j].magnitude = Math.round(ems[j].magnitude * eiFactor * 1000) / 1000; ems[j]._eiDampened = true; dampenedEms++; }
      }
    }
    var level = (eiFactor < 0.999 || refr.suppressed > 0) ? 'dampen' : 'clear';
    var brake = {
      version: 1, level: level, actuated: true,
      eiFactor: Math.round(eiFactor * 1000) / 1000,
      dampenedOpportunities: dampenedOpps, dampenedEmissions: dampenedEms,
      refractorySuppressed: refr.suppressed, refractoryWindowMs: refr.windowMs,
      reasons: reasons,
      note: level === 'clear' ? 'E/I brake clear — inhibition tracks drive; emission allowed at full magnitude'
        : 'E/I brake dampening — inhibition below drive target and/or refractory repeats; efferent output reduced proportionally. Neuro Ref XIII.1/III.3.',
      lastBrakeAt: (s.communicationModel && s.communicationModel.updated) || Date.now()
    };
    s.communicationBrake = brake;
    return brake;
  };

  // ── PHASE DYNAMICS (ADVISORY — this._actuation.phase = false) ────────────────────────────────
  // The phase-coherence ROUTER (couple to co-phased, stressed domains; patent M matrix, thing2
  // lineage) is deterministic and honest, so it is exposed. The phase-transition is NEVER wired as
  // an external reward: communication is not a Thing1-validated domain (no p3/p7 ground-truth
  // distress label). The K4 credit gate (window.LIMENK4.credit) treats every non-external tier —
  // including phase-consistency — as self-consistency calibration (interpretive, isReward=false),
  // and because phase actuation is advisory-OFF (this._actuation.phase = false) the phase transition
  // does not even feed that gate here. Fabricating a validated/dopaminergic teaching signal from a
  // phase transition would be dishonest (the same discipline ENERGY_NEURO_AUDIT.md applied). So the
  // transition read is marked advisory-self-consistency only.
  // Per-cycle: append the domain's primary STRESS scalar (finalStress/brainStress/stress; up=bad) to
  // the persistent series, cap at 60, persist, then run the Thing2 kernel over it to derive an
  // interpretive P0-P10 phase. Deterministic pure-math (no network/AI). On any failure or when the
  // adapter/history is unavailable, _kernelPhase is set to null and the caller falls back to s.phase.
  // seriesSource = STRESS (positive:false) because the communication scalar rises with distress.
  CommunicationBrain.prototype._updatePhaseKernel = function () {
    var s = this.state;
    var scalar = (typeof s.finalStress === 'number') ? s.finalStress
               : (typeof s.brainStress === 'number') ? s.brainStress
               : (typeof s.stress === 'number') ? s.stress : null;
    try {
      if (scalar != null && isFinite(scalar)) {
        this._phaseSeries.push(scalar);
        while (this._phaseSeries.length > 60) this._phaseSeries.shift();
        try {
          if (typeof localStorage !== 'undefined' && localStorage) {
            localStorage.setItem('limen:phaseseries:communication', JSON.stringify(this._phaseSeries));
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

  CommunicationBrain.prototype._computeCommunicationPhaseDynamics = function () {
    var s = this.state;
    // Refresh the Thing2 kernel phase from this domain's stress trajectory (pure math, guarded).
    try { this._updatePhaseKernel(); } catch (e) { this._kernelPhase = null; s.phaseSource = 'fallback'; }
    var PHASE_M = {
      p6: { p6: 0.06, p0: 0.04, p3: -0.05 },
      p3: { p3: 0.08, p7: 0.05, p9: 0.04, p0: -0.06 },
      p7: { p7: 0.10, p3: 0.04, p9: 0.06, p0: -0.08 }
    };
    var VALIDATED = { p3: 1, p7: 1, p7a: 1, p7b: 1 };            // P3/P7 family gate for phase-consistency tier — self-consistency, NOT external reward
    function norm(p) { if (p == null) return null; p = String(p).toLowerCase().replace(/[^a-z0-9]/g, ''); if (p.charAt(0) !== 'p') p = 'p' + p; return p; }
    // PREFER the Thing2 kernel phase (interpretive, from this domain's stress trajectory) for BOTH
    // the coherence router and the phase-transition read; fall back to the existing s.phase when the
    // kernel is unavailable (adapter missing / history < 8 / error) — fallback path unchanged.
    var myPhase = norm(this._kernelPhase != null ? this._kernelPhase : s.phase);
    var doms = (typeof window !== 'undefined' && window.LIMENDomains) || {};
    var coupled = [], couplingStrength = 0;
    if (myPhase && PHASE_M[myPhase]) {
      var row = PHASE_M[myPhase];
      Object.keys(doms).forEach(function (k) {
        if (k === 'communication') return;
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
    var hist = this._commPhaseHistory = this._commPhaseHistory || [];
    var prev = hist.length ? hist[hist.length - 1].phase : null;
    var transition = null;
    if (prev != null && myPhase != null && prev !== myPhase) {
      var validated = !!(VALIDATED[myPhase] || VALIDATED[prev]);
      transition = { from: prev, to: myPhase, validatedPhaseInvolved: validated, kind: 'advisory-self-consistency',
        note: 'NOT a validated teaching signal — communication lacks a Thing1 ground-truth distress label; never feeds learning.' };
    }
    hist.push({ phase: myPhase, t: (s.communicationModel && s.communicationModel.updated) || Date.now() });
    if (hist.length > 24) hist.shift();
    var out = {
      version: 1, actuated: false, advisory: true, myPhase: myPhase,
      phaseSource: s.phaseSource || 'fallback',       // 'thing2-kernel' when the real kernel drove myPhase, else 'fallback'
      kernelTrajectory: s.kernelTrajectory || null,
      coupled: coupled.slice(0, 5), couplingStrength: Math.round(couplingStrength * 1000) / 1000,
      transition: transition,
      note: 'phase-coherence router live (advisory); phase source = Thing2 recursive kernel over the stress trajectory (interpretive) with s.phase fallback. Phase-transition reward NOT wired as validated learning — communication is not a Thing1-validated domain.'
    };
    s.communicationPhaseDynamics = out;
    return out;
  };

  // ── SELF-AUDIT (actuated; Neuro Ref XIV diaschisis / single-points-of-failure) ────────────────
  // Consumes the domain's REAL node/edge graph (89 edges live in communication.json, NOT in the
  // /api/domain-snapshot payload — same gap energy hit). Lazily fetches + caches the edges once
  // (browser fire-and-forget; server via require) and runs the articulation-node audit on the real
  // graph every cycle thereafter. Deterministic, observe-only over structure (surfaces brittle nodes).
  CommunicationBrain.prototype._computeCommunicationSelfAudit = function () {
    var self = this, s = this.state;
    var edges = (s._rawDomain && Array.isArray(s._rawDomain.edges) && s._rawDomain.edges) ||
                (Array.isArray(s.edges) && s.edges) || this._communicationEdges || null;
    if (!edges) {
      if (typeof fetch === 'function' && !this._communicationEdgesPromise) {
        this._communicationEdgesPromise = fetch('/assets/data/domains/communication.json')
          .then(function (r) { return r.json(); })
          .then(function (j) { if (j && Array.isArray(j.edges)) self._communicationEdges = j.edges; })
          .catch(function () {});
      } else if (typeof require === 'function') {
        try { var ed = require('../../data/domains/communication.json'); if (ed && Array.isArray(ed.edges)) { this._communicationEdges = ed.edges; edges = ed.edges; } } catch (_e) {}
      }
    }
    if (!edges || !edges.length) {
      s.communicationSelfAudit = { version: 1, consumed: false, note: edges ? 'no edges' : 'edges loading (async, next cycle)' };
      return s.communicationSelfAudit;
    }
    var audit = _commSpofAudit(edges);
    s.communicationSelfAudit = {
      version: 1, consumed: true, edgeCount: audit.edgeCount, nodeCount: audit.nodeCount,
      spofCount: audit.spof.length, spof: audit.spof.slice(0, 5), topHubs: audit.topHubs,
      verdict: audit.spof.length ? (audit.spof.length + ' single-point(s) of failure in the communication connectome') : 'no articulation nodes (resilient connectome)',
      note: 'Neuro Ref XIV diaschisis/SPOF self-audit consumed over the real communication node/edge graph (deterministic).'
    };
    return s.communicationSelfAudit;
  };

  // ── AI SLOT (operator-triggered ONLY; NEVER called from the cycle) ───────────────────────────
  // Generative node→business authoring (semantic synthesis of a business from a node's live
  // diagnosis) is a genuine "code-cannot-do-this" slot. It is DELIBERATELY not wired into the
  // deterministic 30s cycle: no paid-AI/LLM call may ever run on a cycle (killswitch requirement).
  // This method (a) is never invoked by cycle()/_updateCommunicationModel(), (b) runs only on an
  // explicit operator action, and (c) routes through a server endpoint that is killswitch-gated
  // SERVER-SIDE (lib/ai-kill-switch spendDisabled()). No API key lives in client code. If the
  // endpoint is absent or spend is disabled, it returns a benign envelope. Keep this OUT of the cycle.
  CommunicationBrain.prototype.authorCommunicationBusinessFromNode = function (nodeId, opts) {
    if (typeof fetch !== 'function') return Promise.resolve({ ok: false, reason: 'no-fetch' });
    opts = opts || {};
    return fetch('/api/communication-node-business', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'communication', nodeId: nodeId, operatorTriggered: true, context: opts.context || null })
    }).then(function (r) { return r.ok ? r.json() : { ok: false, status: r.status }; })
      .catch(function () { return { ok: false, reason: 'network' }; });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE K — COMMUNICATION NEURO-COMPLETION LAYERS (K1..K8; communication-local,
  // additive, reversible). Ported from energy-brain's K1-K8 stack, reading THIS
  // domain's state/edges (communicationModel, communication feeds, communication
  // diagnoses, the communication node/edge graph). Mirrors energy STRUCTURE; the
  // CONTENT is communication (information-flow / network / channel-concentration).
  //   K1 afferent integration, K2 neuromodulatory gain, K3 slow consolidation,
  //   K4 outcome / credit learning (SELF-CONSISTENCY truth brake — realized-stress
  //      self-prediction / hitRate; NOT an external or dopaminergic reward signal),
  //   K5 deep-perception depth, K6 attention, K7 lateral inhibition, K8 homeostatic
  //      set-point.
  // ADVISORY BY DESIGN: every layer COMPUTES and EXPOSES its signal on state; NONE
  // rewires the scoring spine (stress / prior update / opportunity output). The
  // behavior CHANGE in this domain is carried by the already-wired actuation core
  // (servo + E/I brake + refractory), which these layers sit ALONGSIDE, not replace.
  // 100% DETERMINISTIC: reads cached state only — no network fetch, no AI/LLM call,
  // ever, on the cycle. Never fabricates evidence.
  // ════════════════════════════════════════════════════════════════════════════
  var CK_OUTCOME_BUFFER = 40;     // rolling predicted-vs-realized samples (K4)
  var CK_HOMEO_WINDOW = 60;       // cycles of stress baseline for the adaptive set-point (K8)

  // K1 — afferent inter-brain integration. Surfaces the cross-domain pressure other
  // brains emit INTO communication and the stress delta it contributes. Communication's
  // base scoreStress already folds getExternalPressure() into stress (shared with the
  // other 18 domains, base sets _externalPressureApplied); this READS that closed loop.
  CommunicationBrain.prototype._computeCommunicationAfferent = function () {
    var s = this.state, cm = s.communicationModel || {};
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
      externalPressure: Math.round(pressure * 1000) / 1000,          // base-capped at 0.3
      receivedSignalCount: raw.length,
      activeSignalCount: active,
      contributors: contributors.slice(0, 6),
      integrated: true,                                              // K1 CLOSED — base scoreStress folds it into stress
      appliedStressDelta: Math.round(((s._externalPressureApplied) || 0) * 1000) / 1000,
      wouldRaiseStressBy: Math.round(pressure * 1000) / 1000,
      note: 'CLOSED: communication base scoreStress adds externalPressure to stress each cycle (matches the other 18 domains).',
      lastAfferentAt: cm.updated || now
    };
    s.communicationAfferent = af; return af;
  };

  // K2 — neuromodulatory gain application. Surfaces the graded output modulation implied
  // by the model's regulation (gain / inhibition / outputScale) over the current
  // opportunity set. Communication's regulation has no outputScale term → defaults to 1
  // (no cap). ADVISORY: exposed for the console; the actual efferent-output modulation in
  // this domain is done by the servo + E/I brake, not by an opportunity-rank gate.
  CommunicationBrain.prototype._computeCommunicationGainControl = function () {
    var s = this.state, cm = s.communicationModel || {}, reg = cm.regulation || {};
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
      appliedTargets: ['predictedStress (gain-blend, in _updateCommunicationModel)'],
      unappliedTargets: ['stress', 'opportunity output', 'treatment surfacing'],
      shadow: true,
      lastGatedCount: (s._neuroGatedCount || 0),
      note: 'ADVISORY: gain reaches predictedStress via the model gain-blend; opportunity/emission modulation is carried by the servo + E/I brake, not an opportunity-rank cap.',
      lastGainAt: cm.updated || Date.now()
    };
    s.communicationGainControl = gc; return gc;
  };

  // K3 — slow consolidation / long-term plasticity. Maintains a PARALLEL slow-weight
  // track (CM_SLOW_RATE) that never touches cm.prior; fast-vs-slow divergence is a real
  // regime-shift indicator (the fast prior pulled far from the slow baseline).
  CommunicationBrain.prototype._consolidateCommunicationSlowModel = function () {
    var s = this.state, cm = s.communicationModel || {}, obs = cm.observation || null;
    var slow = s.communicationSlowModel || {
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
    s.communicationSlowModel = slow; return slow;
  };

  // K4 — outcome / credit learning (SELF-CONSISTENCY TRUTH BRAKE). Reconciles each
  // cycle's predictedStress against the NEXT cycle's realized stress (online forward
  // prediction). hitRate = fraction of predictions within 0.1 of realized — this is the
  // domain's realized-stress self-prediction calibration, NOT an external / dopaminergic
  // reward (that is a separate deferred task and is deliberately not fabricated here).
  CommunicationBrain.prototype._scoreCommunicationOutcomes = function () {
    var s = this.state, cm = s.communicationModel || {};
    var buf = this._communicationOutcomeBuffer = this._communicationOutcomeBuffer || [];
    var obs = cm.observation || null;
    if (this._communicationPrevPrediction != null && obs && typeof obs.stress === 'number') {
      buf.push({ predicted: this._communicationPrevPrediction, realized: obs.stress, err: Math.abs(this._communicationPrevPrediction - obs.stress) });
      if (buf.length > CK_OUTCOME_BUFFER) buf.shift();
    }
    this._communicationPrevPrediction = (typeof cm.predictedStress === 'number') ? cm.predictedStress : null;
    var n = buf.length, sumErr = 0, sumSq = 0, hits = 0;
    for (var i = 0; i < n; i++) { sumErr += buf[i].err; sumSq += buf[i].err * buf[i].err; if (buf[i].err <= 0.1) hits++; }
    var om = {
      version: 1,
      samples: n,
      meanRealizedError: n ? Math.round((sumErr / n) * 1000) / 1000 : null,
      brierLike: n ? Math.round((sumSq / n) * 1000) / 1000 : null,
      hitRate: n ? Math.round((hits / n) * 100) / 100 : null,                    // realized-stress self-prediction hit-rate
      callHitRate: n ? Math.round((hits / n) * 100) / 100 : null,               // TRUTH-BRAKE calibration alias (self-consistency)
      loopType: 'online-continuous (predicted-vs-next-realized) self-consistency; NOT an external reward signal',
      creditAssignmentActive: (n >= 5),
      note: 'TRUTH BRAKE (self-consistency calibration, interpretive): does the forecast come true. hitRate/callHitRate feed the central K4 credit gate (window.LIMENK4.credit) as self-consistency calibration ONLY — it modulates the learning RATE (a calibration knob), and is NEVER treated as an external / dopaminergic / ground-truth reward. Communication is not a Thing1-validated domain (no p3/p7 ground-truth distress label), so isReward is always false here.',
      lastOutcomeAt: cm.updated || Date.now()
    };
    s.communicationOutcomeModel = om; return om;
  };

  // K5 — deep hierarchical perception. Aggregates the perception depth the brain HAS
  // (existing L1 branch-scan cache + the NETWORK sub-portal layer, no new fetches) and
  // estimates the portalError the recurrent model does not yet fold in. L2 is quarantined
  // (mad-lib / synthetic). CONTENT analog of energy's datacenter layer = the network layer.
  CommunicationBrain.prototype._computeCommunicationPerceptionDepth = function () {
    var s = this.state, cm = s.communicationModel || {};
    var l1 = s._l1DepthCache || null;
    var net = s.networkLayer || null;
    var l1Real = 0, l1Mad = 0;
    if (l1 && l1.byDiagnosis) { Object.keys(l1.byDiagnosis).forEach(function (k) { l1Real += (l1.byDiagnosis[k].realTreatments || 0); l1Mad += (l1.byDiagnosis[k].madLibTreatments || 0); }); }
    var netLoaded = !!(net && (net.loaded || net.activeCount || net.count));
    var netCount = (net && (net.count || net.activeCount)) || 0;
    var levels = [
      { level: 'L0', name: 'root', status: (this._portalCache || s._portalCache) ? 'loaded' : 'pending' },
      { level: 'L1', name: 'branch-scan', status: l1 ? 'scanned' : 'pending', realTreatments: l1Real, madLibTreatments: l1Mad },
      { level: 'L2', name: 'deep-cortex', status: 'quarantined', note: 'mad-lib / synthetic (immune-blocked)' },
      { level: 'NET', name: 'network-subportal', status: netLoaded ? 'loaded' : 'absent', activeCount: netCount }
    ];
    var loadedDepth = netLoaded ? 3 : (l1 ? 1 : 0);
    var admissible = l1Real + netCount;
    var blocked = l1Mad + 1;                                        // +1 for the quarantined L2 tier
    var portalErrorEstimate = Math.round((blocked / Math.max(1, admissible + blocked)) * 1000) / 1000;
    var pd = {
      version: 1, levels: levels, deepestUsableLevel: loadedDepth,
      portalErrorEstimate: portalErrorEstimate,
      note: 'ADVISORY: perception stops at L1 (+network layer); L2 quarantined. portalErrorEstimate exposed but not folded into the model prediction error. No new fetches.',
      lastDepthAt: cm.updated || Date.now()
    };
    s.communicationPerceptionDepth = pd; return pd;
  };

  // K6 — attention / selective routing. Ranks top-down salience (active + relevance +
  // novelty, plus any operator attention-focus steer) and names focus vs suppressed,
  // without gating the pipeline (advisory).
  CommunicationBrain.prototype._computeCommunicationAttention = function () {
    var s = this.state, cm = s.communicationModel || {}, reg = cm.regulation || {};
    var pe = (cm.predictionError && cm.predictionError.total) || 0;
    var rb = this._readRequestBiases ? this._readRequestBiases() : { attentionFocus: [] };
    var focus = (rb.attentionFocus || []).map(function (f) { return String(f).toLowerCase(); });
    var scored = (s.diagnoses || []).map(function (d) {
      var sal = (d.active ? 0.5 : 0) + (d.relevance || 0) * 0.4 + pe * 0.1;
      var hay = (String(d.id) + ' ' + String(d.label || '')).toLowerCase();
      if (focus.some(function (f) { return f && hay.indexOf(f) !== -1; })) sal += 0.5;
      return { id: d.id, active: !!d.active, salience: Math.round(sal * 1000) / 1000 };
    }).sort(function (a, b) { return b.salience - a.salience; });
    var at = {
      version: 1,
      driver: reg.state === 'surprised' ? 'novelty-driven (bottom-up)' : 'goal-driven (top-down)',
      focus: scored.slice(0, 3),
      suppressed: scored.slice(3).map(function (x) { return x.id; }).slice(0, 8),
      broadenUnderSurprise: reg.state === 'surprised',
      note: 'ADVISORY: salience ranking exposed for the console; does not gate opportunity/diagnosis surfacing.',
      lastAttentionAt: cm.updated || Date.now()
    };
    s.communicationAttention = at; return at;
  };

  // K7 — lateral inhibition (microcircuit). Shows the winner-take-most ranking that
  // reg.inhibition implies among competing active diagnoses (advisory).
  CommunicationBrain.prototype._computeCommunicationInhibition = function () {
    var s = this.state, cm = s.communicationModel || {}, reg = cm.regulation || {};
    var inhib = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;
    var active = (s.diagnoses || []).filter(function (d) { return d.active; })
      .sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var winner = active[0] || null;
    var li = {
      version: 1, inhibitionStrength: inhib,
      winner: winner ? winner.id : null,
      competitors: active.slice(1).map(function (d) { return { id: d.id, relevance: d.relevance, suppressBy: Math.round((d.relevance || 0) * inhib * 1000) / 1000 }; }).slice(0, 6),
      note: 'ADVISORY: winner-take-most ranking exposed; not applied as an opportunity down-weight (the E/I brake carries efferent dampening).',
      lastInhibitionAt: cm.updated || Date.now()
    };
    s.communicationInhibition = li; return li;
  };

  // K8 — homeostatic set-point (microcircuit). Maintains an adaptive stress baseline
  // (Turrigiano-style synaptic scaling) over the recent stressHistory, alongside the
  // fixed CM_STRESS_FLOOR, without replacing it. Advisory: exposed as an allostatic
  // reference; the actuation servo computes its OWN drive-deviation (from the model's
  // learned expectedStress), so this baseline is a parallel readout, not its input.
  CommunicationBrain.prototype._computeCommunicationHomeostasis = function () {
    var s = this.state, cm = s.communicationModel || {};
    var win = ((s.memory && s.memory.stressHistory) || []).slice(-CK_HOMEO_WINDOW);
    var n = win.length, sum = 0;
    for (var i = 0; i < n; i++) sum += (win[i].stress || 0);
    var baseline = n ? sum / n : 0.5;
    var cur = (typeof s.stress === 'number') ? s.stress : 0;
    var scalingFactor = baseline > 0 ? Math.round((0.5 / Math.max(0.1, baseline)) * 1000) / 1000 : 1;
    var hm = {
      version: 1,
      fixedFloor: CM_STRESS_FLOOR,
      adaptiveBaseline: Math.round(baseline * 1000) / 1000,
      currentStress: cur,
      deviationFromBaseline: Math.round((cur - baseline) * 1000) / 1000,
      scalingFactor: scalingFactor,
      samples: n,
      note: 'adaptive set-point (synaptic scaling) alongside the fixed CM_STRESS_FLOOR; parallel allostatic readout — the actuation servo derives its own drive-deviation from the model expectedStress.',
      lastHomeostasisAt: cm.updated || Date.now()
    };
    s.communicationHomeostasis = hm; return hm;
  };

  // Assemble the K1..K8 neuro-completion surface (mirrors _computeEnergyNeuroLayers).
  // Runs all eight K-layers in the SAME order energy uses, stores each on state, and
  // attaches a compact roll-up to state.communicationNeuro (also exposed under
  // cognition.neuro). Additive; runs ALONGSIDE the existing actuation core.
  CommunicationBrain.prototype._computeCommunicationNeuroLayers = function () {
    this._computeCommunicationAfferent();          // K1 - afferent inter-brain input
    this._computeCommunicationGainControl();       // K2 - neuromodulatory gain application
    this._consolidateCommunicationSlowModel();     // K3 - slow consolidation / long-term plasticity
    this._scoreCommunicationOutcomes();            // K4 - outcome / credit learning (self-consistency truth brake)
    this._computeCommunicationPerceptionDepth();   // K5 - deep hierarchical perception
    this._computeCommunicationAttention();         // K6 - attention / selective routing
    this._computeCommunicationInhibition();        // K7 - lateral inhibition (microcircuit)
    this._computeCommunicationHomeostasis();       // K8 - adaptive set-point (microcircuit)
    var s = this.state;
    var neuro = {
      version: 1,
      status: 'advisory',                          // K-layers compute+expose; actuation core carries behavior change
      afferent: s.communicationAfferent || null,
      gainControl: s.communicationGainControl || null,
      slowModel: s.communicationSlowModel || null,
      outcomeModel: s.communicationOutcomeModel || null,
      perceptionDepth: s.communicationPerceptionDepth || null,
      attention: s.communicationAttention || null,
      inhibition: s.communicationInhibition || null,
      homeostasis: s.communicationHomeostasis || null
    };
    s.communicationNeuro = neuro;
    return neuro;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // COMMUNICATION COGNITION PARITY — fallback loaders, source-bundle machinery, L1
  // mad-lib scan, network/information-integrity sub-portal layer, and the 8-section
  // DomainDiagnosisPacket the Civilization cockpit consumes. Mirrors energy/culture
  // STRUCTURE exactly; only the CONTENT is communication (telecom & networks,
  // broadband/connectivity, internet infrastructure (towers/fiber/spectrum), media/
  // broadcasting CHANNELS, journalism & news flow, information dissemination, social-
  // media platforms AS DISTRIBUTION, public-discourse infrastructure). Never fabricates.
  // ════════════════════════════════════════════════════════════════════════════

  // ── DDP schema helpers ──
  var COMMUNICATION_DDP_SCHEMA_VERSION = 'communication-ddp-1';
  function _communicationDdpPresent(v) {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (v === 'missing' || v === '' || v === 'none') return false;
    return true;
  }
  function _communicationDdpCompleteness(section, keys) {
    var have = 0; for (var i = 0; i < keys.length; i++) { if (_communicationDdpPresent(section[keys[i]])) have++; }
    return { have: have, total: keys.length, pct: keys.length ? Math.round(have / keys.length * 100) : 0 };
  }

  // ── Canonical diagnosis resolution. Prefers window.LIMENArtifactSourceIndex.aliases(),
  //    else COMMUNICATION_DIAGNOSIS_ALIASES. Non-aliased diagnoses are canonical to themselves. ──
  var COMMUNICATION_DIAGNOSIS_ALIASES = {
    DISINFORMATION_CRISIS: { target: 'INFORMATION_CONTAMINATION_SYNDROME', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits INFORMATION_CONTAMINATION_SYNDROME for disinformation/misinformation surges' },
    TELECOM_FAILURE:       { target: 'NETWORK_INFRASTRUCTURE_DISRUPTION', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits NETWORK_INFRASTRUCTURE_DISRUPTION for outages / connectivity loss' },
    CENSORSHIP_OVERREACH:  { target: 'EXPRESSION_SUPPRESSION', reviewStatus: 'human-approved', risk: 'medium', note: 'mapped to expression-suppression bundle; verify the suppression evidence is appropriate for the specific claim' },
    MEDIA_MONOPOLY:        { target: 'CHANNEL_CONCENTRATION', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits CHANNEL_CONCENTRATION for distribution/editorial capture' },
    CYBER_PROPAGANDA:      { target: 'COORDINATED_INFLUENCE_OPERATION', reviewStatus: 'human-approved', risk: 'medium', note: 'mapped to coordinated-influence-operation bundle; verify inauthentic-behavior evidence is appropriate' }
  };
  CommunicationBrain.prototype._resolveCommunicationCanonicalDiagnosis = function (dxId) {
    if (!dxId) return { canonicalDiagnosisId: null, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };
    var target = null;
    try {
      var idx = (typeof window !== 'undefined') ? window.LIMENArtifactSourceIndex : null;
      if (idx && idx.aliases) { var row = idx.aliases()[dxId]; if (row && row.target) target = row.target; }
    } catch (e) {}
    var local = COMMUNICATION_DIAGNOSIS_ALIASES[dxId] || null;
    if (!target && local) target = local.target;
    if (target) {
      return { canonicalDiagnosisId: target, aliasUsed: true, aliasReviewStatus: (local && local.reviewStatus) || 'corpus-aliased', aliasRisk: (local && local.risk) || 'low', aliasNote: (local && local.note) || null };
    }
    return { canonicalDiagnosisId: dxId, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };   // canonical to self
  };

  // ── Load REAL source bundles (one-shot, async). Resolves aliases BEFORE fetching.
  //    Only files that exist resolve to 'found'; 404s -> 'missing'. Never fabricates. ──
  CommunicationBrain.prototype._loadCommunicationDiagnosisBundles = function () {
    var self = this;
    if (self._communicationBundleLoadPromise) return self._communicationBundleLoadPromise;
    self._bundleCache = self._bundleCache || {};
    self._bundleStatusMap = self._bundleStatusMap || {};
    var ids = {};
    var known = ['DISINFORMATION_CRISIS', 'TELECOM_FAILURE', 'CENSORSHIP_OVERREACH', 'MEDIA_MONOPOLY', 'CYBER_PROPAGANDA'];
    var diags = (self.state && self.state.diagnoses) || [];
    var allDxIds = diags.map(function (d) { return d.id; }).concat(known);
    for (var i = 0; i < allDxIds.length; i++) { var c = self._resolveCommunicationCanonicalDiagnosis(allDxIds[i]).canonicalDiagnosisId; if (c) ids[c] = true; }
    self._communicationBundleLoadPromise = Promise.all(Object.keys(ids).map(function (cid) {
      return fetch('/assets/data/artifact-source-index/by-diagnosis/' + encodeURIComponent(cid) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) { self._bundleStatusMap[cid] = data ? 'found' : 'missing'; if (data) self._bundleCache[cid] = data; })
        .catch(function () { self._bundleStatusMap[cid] = 'missing'; });
    })).then(function () { return self._bundleCache; });
    return self._communicationBundleLoadPromise;
  };

  // ── _communicationBundleStates — per-diagnosis canonical resolution + bundle status + provenance ──
  CommunicationBrain.prototype._communicationBundleStates = function () {
    var self = this; var diags = (this.state && this.state.diagnoses) || [];
    return diags.map(function (d) {
      var c = self._resolveCommunicationCanonicalDiagnosis(d.id);
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
  //    evidence. Only real carrier/platform/publisher tickers surface (relevance-unverified). ──
  var COMMUNICATION_MADLIB_VERB = /^(Develop|Establish|Implement|Build|Launch|Design|Deploy|Operationalize|Conduct|Create|Define|Assess|Optimize|Modernize|Strengthen|Enhance|Formalize|Institute|Standardize|Coordinate|Integrate|Calibrate|Evaluate|Streamline|Institutionalize|Configure|Monitor|Verify|Moderate|Amplify)\b/;
  CommunicationBrain.prototype._isCommunicationMadLibTreatment = function (label) { return !label || COMMUNICATION_MADLIB_VERB.test(String(label)); };

  CommunicationBrain.prototype._loadCommunicationL1PortalDepth = function () {
    var self = this;
    if (self._communicationL1LoadPromise) return self._communicationL1LoadPromise;
    var BRANCH = {
      DISINFORMATION_CRISIS: ['media', 'social', 'journalism'],
      TELECOM_FAILURE: ['telecom', 'broadband', 'spectrum'],
      CENSORSHIP_OVERREACH: ['pressfreedom', 'platforms', 'broadcast'],
      MEDIA_MONOPOLY: ['broadcast', 'platforms', 'publishing'],
      CYBER_PROPAGANDA: ['social', 'cyber', 'media']
    };
    self._communicationL1Branches = BRANCH;
    var branches = {}; Object.keys(BRANCH).forEach(function (dx) { BRANCH[dx].forEach(function (b) { branches[b] = true; }); });
    var byBranch = {};
    self._communicationL1LoadPromise = Promise.all(Object.keys(branches).map(function (b) {
      return fetch('/assets/data/domains/communication_' + encodeURIComponent(b) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) {
          if (!data) { byBranch[b] = null; return; }
          var acts = data.activations || [], tickers = {}, total = 0, mad = 0;
          acts.forEach(function (a) {
            (a.companies || []).forEach(function (c) { if (c && c.ticker_or_id) tickers[c.ticker_or_id] = c.name || c.ticker_or_id; });
            (a.treatments || []).forEach(function (t) { var l = t && (t.label || t.title); if (l) { total++; if (self._isCommunicationMadLibTreatment(l)) mad++; } });
          });
          byBranch[b] = { file: 'communication_' + b, companyTickers: Object.keys(tickers).map(function (k) { return { ticker: k, name: tickers[k] }; }), treatmentTotal: total, madLibCount: mad, realTreatmentCount: total - mad };
        })
        .catch(function () { byBranch[b] = null; });
    })).then(function () {
      var byDiagnosis = {};
      Object.keys(BRANCH).forEach(function (dx) {
        var tk = {}, total = 0, mad = 0, scanned = 0;
        BRANCH[dx].forEach(function (b) { var r = byBranch[b]; if (r) { scanned++; r.companyTickers.forEach(function (c) { tk[c.ticker] = c.name; }); total += r.treatmentTotal; mad += r.madLibCount; } });
        byDiagnosis[dx] = { branchesScanned: scanned, realCompanyTickers: Object.keys(tk).map(function (k) { return { ticker: k, name: tk[k], relevanceUnverified: true }; }), treatmentTotal: total, madLibTreatments: mad, realTreatments: total - mad, admitted: false, reason: 'L1 treatments are mad-lib templates (fixed-verb family) — not source-grade; only carrier/platform/publisher tickers surfaced, relevance unverified' };
      });
      self.state._l1DepthCache = { byBranch: byBranch, byDiagnosis: byDiagnosis, scannedAt: (self.state.communicationModel && self.state.communicationModel.updated) || null };
      return self.state._l1DepthCache;
    });
    return self._communicationL1LoadPromise;
  };

  // ── NETWORK sub-portal layer (counterpart to energy's data-center; culture's music scene).
  //    The NETWORK/INFRASTRUCTURE & information-integrity layer = real-content telecom/network
  //    diagnostics (telecom outages, infrastructure strain, spectrum bottlenecks) SEPARATE from
  //    the canonical 5-diagnosis spine. This is NOT a broadcast/media/content layer. ──
  CommunicationBrain.prototype._loadCommunicationNetworkLayer = function () {
    var self = this;
    if (self._communicationNetworkLoadPromise) return self._communicationNetworkLoadPromise;
    self._communicationNetworkLoadPromise = fetch('/assets/data/domains/communication_network.json')
      .then(function (r) { return (r && r.ok) ? r.json() : null; })
      .then(function (data) {
        if (!data) { self._networkPortal = null; return null; }
        self._networkPortal = { issues: data.issues || [], activations: data.activations || [], title: data.title || 'Communication Network Infrastructure' };
        return self._networkPortal;
      })
      .catch(function () { self._networkPortal = null; return null; });
    return self._communicationNetworkLoadPromise;
  };

  CommunicationBrain.prototype._buildCommunicationNetworkLayer = function () {
    var self = this;
    var np = self._networkPortal;
    // Network sub-layer canonical diagnoses (additive; NEVER merged into the validated 5-diagnosis spine).
    var NET_TICKERS = ['VZ', 'T', 'TMUS', 'AMT', 'CCI', 'SBAC', 'CSCO', 'ANET'];
    if (!np || !np.issues || !np.issues.length) {
      self.state.networkDiagnoses = [];
      self.state.networkTreatments = [];
      self.state.communicationNetworkDomainDiagnosisPackets = [];
      self.state.networkLayer = { loaded: false, count: 0, activeCount: 0, diagnoses: [], realTickers: NET_TICKERS, note: 'communication network sub-portal not loaded (offline or fetch failed)' };
      return self.state.networkLayer;
    }
    var conditions = self._activeConditions || [];
    // 1) diagnoses — same condition-match logic as the canonical spine
    var diagnoses = np.issues.map(function (iss) {
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
        source: 'network', tier: 'real-content-unbundled', branch: 'network'
      };
    });
    // 2) treatments — pull from network node activations whose brainNodeId is in a diagnosis circuit
    var nodeToDx = {};
    diagnoses.forEach(function (d) { (d.circuits || []).forEach(function (c) { if (c && c.nodeId) nodeToDx[c.nodeId] = d.id; }); });
    var treatments = [];
    (np.activations || []).forEach(function (act) {
      var dxId = nodeToDx[act.brainNodeId];
      if (!dxId) return;
      (act.treatments || []).forEach(function (t, ti) {
        treatments.push({
          id: 'net_treat_' + act.brainNodeId + '_' + ti,
          label: t.label, type: t.type, evidence: t.evidence, description: t.description || '',
          cite: t.cite || null, citation: t.citation || [], steps: t.steps || [],
          diagnosisId: dxId, nodeId: act.brainNodeId,
          source: 'network', madLib: self._isCommunicationMadLibTreatment ? self._isCommunicationMadLibTreatment(t.label) : false
        });
      });
    });
    var evidenceRank = { A: 10, Strong: 10, B: 7, Moderate: 7, C: 4, Emerging: 1 };
    treatments.sort(function (a, b) { return (evidenceRank[b.evidence] || 0) - (evidenceRank[a.evidence] || 0); });
    self.state.networkDiagnoses = diagnoses;
    self.state.networkTreatments = treatments;
    // 3) compact layer summary (read by every DDP's promptView)
    self.state.networkLayer = {
      loaded: true,
      portalTitle: np.title,
      count: diagnoses.length,
      activeCount: diagnoses.filter(function (d) { return d.active; }).length,
      realTickers: NET_TICKERS,
      diagnoses: diagnoses.map(function (d) {
        var rc = self._resolveCommunicationCanonicalDiagnosis ? self._resolveCommunicationCanonicalDiagnosis(d.id) : { canonicalDiagnosisId: d.id };
        var bsStat = (self._bundleStatusMap && self._bundleStatusMap[rc.canonicalDiagnosisId]) || 'missing';
        return { id: d.id, label: d.label, active: d.active, branch: 'network', canonicalDiagnosisId: rc.canonicalDiagnosisId, bundleStatus: bsStat, treatmentCount: treatments.filter(function (t) { return t.diagnosisId === d.id; }).length };
      }),
      note: 'real-content NETWORK/INFRASTRUCTURE sub-portal diagnoses (telecom outages, infrastructure strain, spectrum congestion: VZ/T/TMUS/AMT/CCI/SBAC/CSCO/ANET); SEPARATE from the validated 5-diagnosis spine; no external artifact-source bundle yet; never admitted to evidenceAnchors'
    };
    // 4) per-diagnosis DDPs via the SAME schema builder (canonical-to-self; bundle 'missing')
    self.state.communicationNetworkDomainDiagnosisPackets = diagnoses.map(function (d) {
      try { return self._buildDomainDiagnosisPacket(d); } catch (e) { return null; }
    }).filter(Boolean);
    return self.state.networkLayer;
  };

  // ── DDP — the 8-section DomainDiagnosisPacket the Civilization cockpit consumes.
  //    Mirrors culture's _buildDomainDiagnosisPacket exactly; only the CONTENT is communication. ──
  CommunicationBrain.prototype._buildDomainDiagnosisPacket = function (dx) {
    var s = this.state || {};
    var cm = s.communicationModel || {};
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

    var _canon = this._resolveCommunicationCanonicalDiagnosis(dxId);
    var identity = {
      domain: 'communication',
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
      communicationModel: { version: cm.version || null, cycle: (typeof cm.cycle === 'number' ? cm.cycle : null) },
      predictionError: cm.predictionError || null,
      regulationState: (cm.regulation && cm.regulation.state) || null,
      prior: cm.prior || null,
      observation: cm.observation || null,
      plasticity: cm.plasticity || null,
      readyForHandoff: cm.readyForHandoff === true
    };
    // Domain-identity portal fields are KNOWN facts (this IS the communication root).
    var rootId = (portal && portal.domainId) || 'communication';
    var rootTitle = (portal && portal.title) || 'Communication';
    var ancestry = (portal && portal.parentLabel) ? [portal.parentLabel, rootTitle] : [rootTitle];
    var portalContext = {
      portalIds: [rootId],
      portalDomain: 'communication',
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
    // empty slots (what each needs + which COMMUNICATION primary source) rather than fabricating.
    var _isExternal = !!(_bundle && _bundle.buildMethod === 'external-source-authored');
    var _intakeSrcHint = {
      INFORMATION_CONTAMINATION_SYNDROME: 'fact-check throughput (Snopes/PolitiFact) / platform transparency reports / academic disinformation studies (Stanford IO / EU DisinfoLab)',
      NETWORK_INFRASTRUCTURE_DISRUPTION: 'Cloudflare Radar outage data / NetBlocks / CISA advisories / FCC outage filings / carrier (VZ/T/TMUS) network reports',
      EXPRESSION_SUPPRESSION: 'RSF Press Freedom Index / CPJ / Freedom House / platform takedown + transparency reports',
      CHANNEL_CONCENTRATION: 'FCC/FTC media-ownership filings / antitrust dockets / market-share data (CMCSA/CHTR/NWSA/GOOGL/META)',
      COORDINATED_INFLUENCE_OPERATION: 'platform coordinated-inauthentic-behavior takedown reports / DFRLab / Stanford Internet Observatory / network-graph analyses'
    };
    var authoringIntake = [];
    if (_isExternal) {
      ['methodCandidates', 'embodimentCandidates', 'figurePlaceholders'].forEach(function (field) {
        if (_bArr(field).length === 0) authoringIntake.push({ field: field, status: 'needs-human-input', count: 0, need: field === 'methodCandidates' ? 'a concrete information-integrity/network-resilience method drawn from a primary source' : field === 'embodimentCandidates' ? 'a specific implementation/embodiment from a real document' : 'a figure description grounded in a real source', sourceHint: _intakeSrcHint[identity.canonicalDiagnosisId] || 'primary institutional / telecom / press-freedom source', note: 'NOT fabricated by the brain — author from the cited source, then wire in verbatim with attribution' });
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
    // Lanes are INVESTABLE (carriers/platforms/publishers/tower-REITs) / RESEARCHABLE (communication briefs).
    // patent/grant are VETOED by conscience (lanes retired 2026-06-21; no method/embodiment fields).
    var artifactContext = {
      artifactLanes: artifactLanes,
      patentReady: false, grantReady: false, sbaReady: false,   // patent/grant/loan vetoed by H3 conscience
      investmentReady: !!(hasTreat && primaryOpp), researchReady: ready || hasTreat,
      readinessReasons: readinessReasons,
      blockers: blockers
    };

    var comp = {
      identity:         _communicationDdpCompleteness(identity, ['domain', 'diagnosisId', 'canonicalDiagnosisId', 'label', 'phase', 'confidence']),
      brainState:       _communicationDdpCompleteness(brainState, ['communicationModel', 'predictionError', 'regulationState', 'prior', 'observation', 'plasticity']),
      portalContext:    _communicationDdpCompleteness(portalContext, ['portalIds', 'portalDomain', 'portalTitle', 'depth', 'ancestryPath']),
      evidence:         _communicationDdpCompleteness(evidence, ['sourceFeeds', 'evidenceAnchors', 'citationHints']),
      treatmentContext: _communicationDdpCompleteness(treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']),
      operatorContext:  _communicationDdpCompleteness(operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']),
      artifactContext:  _communicationDdpCompleteness(artifactContext, ['artifactLanes'])
    };
    var totHave = 0, totAll = 0;
    for (var sk in comp) { if (comp.hasOwnProperty(sk)) { totHave += comp[sk].have; totAll += comp[sk].total; } }
    var missingFields = [];
    function _cmf(name, obj, keys) { for (var i = 0; i < keys.length; i++) { if (!_communicationDdpPresent(obj[keys[i]])) missingFields.push(name + '.' + keys[i]); } }
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
        'diagnosis-specific bundle anchors preferred over generic communication evidence',
        'official/primary sources retained (FCC/RSF/CPJ/Cloudflare Radar/CISA/platform transparency reports where present)',
        'mechanisms prioritized over figures under prompt-space limits',
        'treatments with implementation relevance preferred over broad narrative',
        'caps applied per field; full data preserved in the stored bundle + full DDP'
      ],
      retainedWarnings: warnings
        .concat(s.communicationImmune ? ['immune: ' + s.communicationImmune.immuneState + ' (sev ' + s.communicationImmune.severity + ', ' + (s.communicationImmune.antigens || []).length + ' antigens; L2 traversal blocked)'] : [])
        .concat(s.communicationConscience && s.communicationConscience.conscienceState === 'restrictive' ? ['conscience: ' + (s.communicationConscience.blockedClaims || []).slice(0, 3).join(', ') + ' blocked'] : []),
      retainedBlockers: artifactContext.blockers,
      // higher-layer compact summaries (forwarded to the finalizer via promptView)
      immuneSummary: s.communicationImmune ? { immuneState: s.communicationImmune.immuneState, severity: s.communicationImmune.severity, antigenCount: (s.communicationImmune.antigens || []).length, quarantines: s.communicationImmune.quarantines, blockedFromTraversal: s.communicationImmune.blockedFromTraversal, allowedWithWarning: s.communicationImmune.allowedWithWarning } : null,
      awarenessSummary: s.communicationAwareness ? { selfNarrative: s.communicationAwareness.selfNarrative, knowns: (s.communicationAwareness.knowns || []).length, uncertainties: (s.communicationAwareness.uncertainties || []).length } : null,
      conscienceDecision: s.communicationConscience ? { conscienceState: s.communicationConscience.conscienceState, blockedClaims: s.communicationConscience.blockedClaims, artifactReadinessDecision: s.communicationConscience.artifactReadinessDecision } : null,
      intuitionSummary: s.communicationIntuition ? s.communicationIntuition.hunches : null,
      scenarioSummary: s.communicationSimulation ? (s.communicationSimulation.scenarios || []).map(function (x) { return { type: x.type, hypothetical: x.hypothetical, risk: x.risk }; }) : null,
      executiveReport: s.communicationExecutiveReport || null,
      l1DepthSummary: portalContext.l1Depth ? { realCompanyTickers: (portalContext.l1Depth.realCompanyTickers || []).length, realTreatments: portalContext.l1Depth.realTreatments, madLibTreatments: portalContext.l1Depth.madLibTreatments, admitted: portalContext.l1Depth.admitted } : null,
      authoringIntake: treatmentContext.authoringIntake.length ? treatmentContext.authoringIntake : null,
      // NETWORK — telecom/infrastructure sub-portal layer (real-content, SEPARATE from the validated spine, no bundle yet)
      networkSummary: s.networkLayer && s.networkLayer.loaded ? { count: s.networkLayer.count, activeCount: s.networkLayer.activeCount, diagnoses: s.networkLayer.diagnoses, realTickers: s.networkLayer.realTickers, note: s.networkLayer.note } : null
    };

    return {
      schemaVersion: COMMUNICATION_DDP_SCHEMA_VERSION,
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
        schemaVersion: COMMUNICATION_DDP_SCHEMA_VERSION,
        fieldCompleteness: { sections: comp, overallPct: pct },
        missingFields: missingFields,
        warnings: warnings,
        proofTier: proofTier,
        immune: s.communicationImmune || null,
        awareness: s.communicationAwareness || null,
        conscience: s.communicationConscience || null,
        intuition: s.communicationIntuition || null,
        simulation: s.communicationSimulation || null,
        executiveReport: s.communicationExecutiveReport || null
      }
    };
  };

  var brain = new CommunicationBrain(); brain.init(); brain.start();
  window.LIMENCommunicationBrain = brain;
  window.LIMENDomainBrains.register(brain);

  // ══════════════════════════════════════════════════════════════════════
  // AUTO-LOAD COMMUNICATION OPERATOR STACK ON DOMAIN-CONSOLE
  // ══════════════════════════════════════════════════════════════════════

  var _isDomainConsole = window.location.pathname.indexOf('domain-console') !== -1 || window.location.pathname.indexOf('communication-console') !== -1;
  var _domParam = (new URLSearchParams(window.location.search)).get('domain');
  var _isCommunicationDomain = _domParam === 'communication';
  if (_isDomainConsole && _isCommunicationDomain) {
    window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION = true;

    var _communicationScripts = [
      'assets/js/communication-compensation.js',
      'assets/js/communication-claim-ledger.js',
      'assets/js/communication-claim-flow.js',
      'assets/js/communication-opportunity-economics.js',
      'assets/js/communication-pulse-engine.js',
      'assets/js/communication-operator-panel.js',
      'assets/js/communication-node-business-engine.js',
      'assets/js/communication-business-review.js',
      'assets/js/communication-execution-panels.js',
      'assets/js/communication-business-build.js',
      'assets/js/communication-directive-extractor.js',
      'assets/js/communication-directive-ranker.js',
      'assets/js/communication-directive-translator.js',
      'assets/js/communication-targeting-engine.js',
      'assets/js/communication-promotion-bridge.js',
      'assets/js/communication-clarity-operator.js'
    ];
    (function loadNext(i) {
      if (i >= _communicationScripts.length) return;
      var s = document.createElement('script');
      s.src = _communicationScripts[i];
      s.onload = function () { loadNext(i + 1); };
      s.onerror = function () { console.warn('[CommunicationBrain] Failed to load ' + _communicationScripts[i]); loadNext(i + 1); };
      document.head.appendChild(s);
    })(0);
  }
})();
