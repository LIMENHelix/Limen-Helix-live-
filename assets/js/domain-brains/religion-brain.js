/**
 * religion-brain.js — Religion Domain Cognitive Engine
 *
 * Extends DomainBrainBase. Same architecture as trade/energy/finance brains.
 *
 * Portal issues: SECTARIAN_CONFLICT, INSTITUTIONAL_ABUSE, RADICALIZATION,
 *                SECULARIZATION_CRISIS, THEOLOGICAL_SCHISM
 *
 * Cross-domain emissions:
 *   religion → culture (value conflict / cohesion shifts)
 *   religion → law (institutional rights / restriction pressure)
 *   religion → population (demographic participation changes)
 *   religion → communication (ideology transmission / narrative escalation)
 *   religion → governance (legitimacy and social stability effects)
 *
 * Exposes: window.LIMENReligionBrain
 */
(function () {
  'use strict';

  if (!window.LIMENDomainBrainBase) {
    console.warn('[ReligionBrain] DomainBrainBase not loaded');
    return;
  }

  var Base = window.LIMENDomainBrainBase;

  function ReligionBrain() {
    Base.call(this, { groundedOnly: true,   // circularity cut 2026-07-24
      
      domainId: 'religion',
      label: 'Religion',
      snapshotKey: 'religion',
      cycleInterval: 30000
    });
    this.resourceAuthority = { ownerDomain: 'religion', policyId: 'religion-resource/1', sandboxLane: 'subscriber-email', lanes: ['publication', 'social', 'email'], budgets: { computeUnitsPerCycle: 512, queueCapacity: 64 }, switches: { internalCycle: true, internalEmission: true, externalAction: false, spend: false, capital: false } };
    this.motorAuthority = { ownerDomain: 'religion', contractId: 'religion-motor/1', lane: 'subscriber-email', decisionContract: 'direct-message-decision/1', budgetId: 'religion-email-budget/1', receiptClass: 'delivery-provider-receipt', outcomeClass: 'delivery-click-reply-or-unsubscribe', rollbackClass: 'suppress-or-correct', executorVerified: false, outcomeObserverVerified: false, switches: { prepare: true, simulate: true, external: false } };
  }

  ReligionBrain.prototype = Object.create(Base.prototype);
  ReligionBrain.prototype.constructor = ReligionBrain;

  // ══════════════════════════════════════════════════════════════════════
  // INIT — register diagnosis index and emission rules
  // ══════════════════════════════════════════════════════════════════════

  ReligionBrain.prototype.init = function () {
    Base.prototype.init.call(this);

    // ── ACTUATION GATE (2026-07-13) — validity-gated per Energy's actuation depth.
    // Each flag is ON only where religion has a HONEST controllable effector / signal.
    // Effector for servo/eiBrake/refractory = this domain's REAL output channel:
    // state.crossDomainEmissions (culture/law/population/communication/governance),
    // consumed by peer brains as external pressure. That is a genuine, controllable
    // efferent, so homeostatic dampening + refractory de-dup are honest here.
    //   refractory = TRUE  — de-dup / rate-limit the emission effector (Neuro Ref III.3
    //                        refractory rate-limit; a domain-agnostic emergent invariant).
    //   servo      = TRUE  — regulate-to-target allostasis (Neuro Ref V.2/XII): sensor
    //                        (drive = stress + live conditions + active dx) -> PI controller
    //                        -> effector (proportional emission dampening) -> feedback.
    //   eiBrake    = TRUE  — E/I balance (Neuro Ref XIII.1): inhibition scales with drive;
    //                        applies the servo dampening continuously to emissions. Only the
    //                        E/I SCALING RELATIONSHIP maps — ms-simultaneity is impossible on
    //                        a discrete feed (audit impossibility #2); documented, not faked.
    //   phase      = FALSE — INVALID for religion. The phase-consistency CREDIT tier would need a
    //                        Thing1-validated ground-truth label (P3/P7) to ever be external reward;
    //                        religion has none — its phase signal is self-consistency calibration only
    //                        (validated kernel = Finance + Population only; religion is a P9
    //                        interpretive tracker). A discrete event feed also has no
    //                        continuous rhythm/phase (audit impossibilities #3 + #4). The
    //                        phase-coherence router is still computed ADVISORY/observe-only
    //                        (see _computeReligionPhaseDynamics) but NEVER actuates: it does
    //                        not open the processing window and never preempts credit.
    this._actuation = { overlays: true, refractory: true, servo: true, eiBrake: true, phase: false };
    // Refractory params for the emission effector (operator-set; not from the document).
    // absolute dead-time hard-suppresses identical re-fires; within the relative window a
    // re-fire only breaks through if its magnitude ROSE by overrideDelta (a stronger stimulus
    // can still fire — the relative-refractory invariant). Fully reversible: flip refractory=false.
    this._refractoryParams = {
      absoluteWindow: 900000,     // 15 min hard dead-time per (targetDomain|signal)
      relativeWindow: 3600000,    // 1 hr raised-bar window (1:4 ratio, mirrors energy)
      overrideDelta: 0.10         // emission magnitude must rise >= this to re-fire in-window
    };

    // AFFILIATION-VITALITY sub-portal (real-content, unbundled) as an additive brain LAYER —
    // never merged into the validated diagnosis spine. One-shot async load; offline-safe.
    try { if (typeof this._loadAffiliationVitality === 'function') this._loadAffiliationVitality(); } catch (e) {}

    // Keys MUST match portal issue IDs in religion.json
    this.diagnosisIndex = {
      'SECTARIAN_CONFLICT':      ['sectarian_escalation', 'identity_hardening', 'grievance_amplification', 'inter_communal_violence', 'religion_high_stress', 'macro_shock'],
      'INSTITUTIONAL_ABUSE':     ['scandal_exposure', 'trust_collapse', 'authority_erosion', 'accountability_failure', 'hypocrisy_perception'],
      'RADICALIZATION':          ['extremist_capture', 'polarizing_rhetoric', 'identity_hardening', 'grievance_amplification', 'radicalization_pipeline', 'religion_high_stress'],
      'SECULARIZATION_CRISIS':   ['attendance_contraction', 'youth_disengagement', 'membership_decline', 'community_disengagement', 'declining_legitimacy', 'structural_stress'],
      'THEOLOGICAL_SCHISM':      ['doctrinal_conflict', 'denominational_splintering', 'leadership_fracture', 'organizational_schism', 'authority_erosion']
    };

    this.emissionRules = [
      {
        targetDomain: 'culture',
        signalType: 'value_conflict_shift',
        condition: function (s) { return s.stress >= 0.40; },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.55); }
      },
      {
        targetDomain: 'law',
        signalType: 'institutional_rights_pressure',
        condition: function (s) { return s.stress >= 0.45; },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); }
      },
      {
        targetDomain: 'population',
        signalType: 'demographic_participation_shift',
        condition: function (s) { return s.stress >= 0.50; },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.4); }
      },
      {
        targetDomain: 'communication',
        signalType: 'ideology_narrative_escalation',
        condition: function (s) { return s.stress >= 0.45; },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); }
      },
      {
        targetDomain: 'governance',
        signalType: 'legitimacy_stability_pressure',
        condition: function (s) { return s.stress >= 0.50; },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); }
      }
    ];

    // PHASE K neuro-completion state (mirrors energy's lazy K-layer buffers; initialized here).
    this._religionOutcomeBuffer = this._religionOutcomeBuffer || [];                              // K4 truth-brake rolling window
    this._religionPrevPrediction = (this._religionPrevPrediction != null) ? this._religionPrevPrediction : null;  // K4 last-cycle predictedStress

    // ── THING2 RECURSIVE-PHASE KERNEL as the phase source (2026-07-13, operator-approved) ──
    // The phase-coherence router and phase-transition self-consistency signal previously read s.phase (a naive
    // per-cycle guess / static PHASE_M lineage). We now feed those from the REAL Thing2 kernel
    // (assets/js/limen-thing2-adapter.js -> window.LIMENThing2.phaseOfSeries), which runs the
    // validated financial phase pipeline over this domain's own stress trajectory. The kernel is
    // PURE MATH (no network, no AI) so the 30s cycle stays deterministic. Output is INTERPRETIVE
    // posture only (interpretive:true, validated:false); we never surface it as validated. This is
    // still OBSERVE-ONLY for religion (_actuation.phase = false): it only changes the SOURCE of
    // myPhase, never opens the processing window or preempts credit. seriesSource = STRESS
    // (positive:false) — religion's primary scalar (finalStress/stress) rises with distress.
    // Fallback: if the adapter is absent or history < 8, _kernelPhase stays null and s.phase is used.
    this._kernelPhase = null;
    this._phaseSeries = this._phaseSeries || [];
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        var _ps = JSON.parse(localStorage.getItem('limen:phaseseries:religion'));
        if (Array.isArray(_ps)) this._phaseSeries = _ps;
      }
    } catch (e) { this._phaseSeries = this._phaseSeries || []; }
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 2: Normalize signals into religion-native semantics
  // ══════════════════════════════════════════════════════════════════════

  ReligionBrain.prototype.normalizeSignals = function () {
    var signals = [];
    var rawSignals = (this._rawDomain && this._rawDomain.signals) || [];

    for (var i = 0; i < rawSignals.length; i++) signals.push(rawSignals[i]);

    this._activeConditions = [];

    // Check feed values for religion-specific triggers
    var feeds = this.state.feeds;
    for (var fi = 0; fi < feeds.length; fi++) {
      var f = feeds[fi], fn = (f.name || '').toLowerCase();

      // Religious conflict / sectarian signals
      if ((fn.indexOf('conflict') !== -1 || fn.indexOf('sectarian') !== -1 || fn.indexOf('persecution') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('sectarian_escalation');
        this._activeConditions.push('inter_communal_violence');
        signals.push('ELEVATED: Religious conflict signal detected');
      }

      // Community / participation signals
      if ((fn.indexOf('community') !== -1 || fn.indexOf('faith') !== -1 || fn.indexOf('church') !== -1 || fn.indexOf('observance') !== -1) && f.value !== undefined && f.value > 0) {
        // Activity signal — participation volume
        if (f.channel === 'activity') {
          signals.push('FEED: Religious community activity — ' + f.value + ' articles');
        }
      }
    }

    // ── INSTITUTIONAL FEED-DERIVED CONDITIONS (15 keyless RSS by tradition) ──
    // Maps the 15 keyless feeds (one per tradition or institutional source)
    // to religion-brain diagnosis triggers.
    for (var f3i = 0; f3i < feeds.length; f3i++) {
      var f3 = feeds[f3i];
      var fn3 = (f3.name || '').toLowerCase();

      // Vatican News — Catholic institutional → INSTITUTIONAL_ABUSE / THEOLOGICAL_SCHISM
      if (fn3.indexOf('vatican') !== -1 && f3.value !== undefined && f3.value >= 30) {
        this._activeConditions.push('authority_erosion');
        signals.push('Vatican News: ' + f3.value + ' articles — Catholic institutional pressure');
      }
      if (fn3.indexOf('vatican') !== -1 && f3.value !== undefined && f3.value >= 60) {
        this._activeConditions.push('scandal_exposure');
      }

      // Al Jazeera Religion — Islam, broad geopolitical → SECTARIAN_CONFLICT / RADICALIZATION
      if (fn3.indexOf('al jazeera') !== -1 && f3.value !== undefined && f3.value >= 30) {
        this._activeConditions.push('sectarian_escalation');
        signals.push('Al Jazeera Religion: ' + f3.value + ' articles');
      }
      if (fn3.indexOf('al jazeera') !== -1 && f3.value !== undefined && f3.value >= 60) {
        this._activeConditions.push('inter_communal_violence');
        this._activeConditions.push('grievance_amplification');
      }

      // Christianity Today — Evangelical → THEOLOGICAL_SCHISM signal
      if (fn3.indexOf('christianity today') !== -1 && f3.value !== undefined && f3.value >= 30) {
        this._activeConditions.push('doctrinal_conflict');
        signals.push('Christianity Today: ' + f3.value + ' articles');
      }
      if (fn3.indexOf('christianity today') !== -1 && f3.value !== undefined && f3.value >= 60) {
        this._activeConditions.push('denominational_splintering');
      }

      // Religion News Service — interfaith broad
      if (fn3.indexOf('religion news service') !== -1 && f3.value !== undefined && f3.value >= 30) {
        this._activeConditions.push('religion_high_stress');
        signals.push('Religion News Service: ' + f3.value + ' articles');
      }

      // USCIRF — religious freedom / persecution → SECTARIAN_CONFLICT / RADICALIZATION
      if (fn3.indexOf('uscirf') !== -1 && f3.value !== undefined && f3.value >= 20) {
        this._activeConditions.push('inter_communal_violence');
        this._activeConditions.push('identity_hardening');
        signals.push('USCIRF: ' + f3.value + ' persecution articles');
      }
      if (fn3.indexOf('uscirf') !== -1 && f3.value !== undefined && f3.value >= 50) {
        this._activeConditions.push('extremist_capture');
      }

      // Pew Religion — research → SECULARIZATION_CRISIS
      if (fn3.indexOf('pew religion') !== -1 && f3.value !== undefined && f3.value >= 20) {
        this._activeConditions.push('attendance_contraction');
        this._activeConditions.push('youth_disengagement');
        signals.push('Pew Religion: ' + f3.value + ' research articles');
      }
      if (fn3.indexOf('pew religion') !== -1 && f3.value !== undefined && f3.value >= 50) {
        this._activeConditions.push('membership_decline');
      }

      // Times of Israel Religion — Israeli political → SECTARIAN_CONFLICT
      if (fn3.indexOf('times of israel') !== -1 && f3.value !== undefined && f3.value >= 30) {
        this._activeConditions.push('sectarian_escalation');
        signals.push('Times of Israel: ' + f3.value + ' religion articles');
      }
      if (fn3.indexOf('times of israel') !== -1 && f3.value !== undefined && f3.value >= 60) {
        this._activeConditions.push('grievance_amplification');
      }

      // Hindustan Times Religion — Hindu / India communal
      if (fn3.indexOf('hindustan times') !== -1 && f3.value !== undefined && f3.value >= 30) {
        this._activeConditions.push('sectarian_escalation');
        signals.push('Hindustan Times: ' + f3.value + ' religion articles');
      }
      if (fn3.indexOf('hindustan times') !== -1 && f3.value !== undefined && f3.value >= 60) {
        this._activeConditions.push('identity_hardening');
      }

      // BuddhistDoor — Buddhism (activity-channel)
      if (fn3.indexOf('buddhistdoor') !== -1 && f3.value !== undefined && f3.value >= 30) {
        this._activeConditions.push('religion_high_stress');
        signals.push('BuddhistDoor: ' + f3.value + ' articles');
      }

      // SikhNet — Sikhism (activity-channel)
      if (fn3.indexOf('sikhnet') !== -1 && f3.value !== undefined && f3.value >= 30) {
        this._activeConditions.push('religion_high_stress');
        signals.push('SikhNet: ' + f3.value + ' articles');
      }

      // Orthodox Christianity → THEOLOGICAL_SCHISM (autocephaly disputes, Russian/Ukrainian)
      if (fn3.indexOf('orthodox christianity') !== -1 && f3.value !== undefined && f3.value >= 20) {
        this._activeConditions.push('doctrinal_conflict');
        this._activeConditions.push('organizational_schism');
        signals.push('Orthodox Christianity: ' + f3.value + ' articles');
      }
      if (fn3.indexOf('orthodox christianity') !== -1 && f3.value !== undefined && f3.value >= 50) {
        this._activeConditions.push('leadership_fracture');
      }

      // JTA Jewish News — American Jewish, antisemitism focus
      if (fn3.indexOf('jta') !== -1 && f3.value !== undefined && f3.value >= 30) {
        this._activeConditions.push('inter_communal_violence');
        signals.push('JTA Jewish News: ' + f3.value + ' articles');
      }
      if (fn3.indexOf('jta') !== -1 && f3.value !== undefined && f3.value >= 60) {
        this._activeConditions.push('grievance_amplification');
      }

      // Esoteric Spirituality → SECULARIZATION_CRISIS (people leaving traditional religion)
      if (fn3.indexOf('esoteric') !== -1 && f3.value !== undefined && f3.value >= 30) {
        this._activeConditions.push('community_disengagement');
        signals.push('Esoteric: ' + f3.value + ' articles — non-traditional spirituality demand');
      }
      if (fn3.indexOf('esoteric') !== -1 && f3.value !== undefined && f3.value >= 60) {
        this._activeConditions.push('attendance_contraction');
      }

      // RSS Religion Events / RSS Religion News — broad signal
      if ((fn3.indexOf('rss religion events') !== -1 || fn3.indexOf('rss religion news') !== -1) && f3.value !== undefined && f3.value >= 50) {
        this._activeConditions.push('religion_high_stress');
      }
    }

    // Raw signal keyword analysis
    for (var rsi = 0; rsi < rawSignals.length; rsi++) {
      var rs = (typeof rawSignals[rsi] === 'string' ? rawSignals[rsi] : '').toLowerCase();
      if (rs.indexOf('sectarian') !== -1 || rs.indexOf('communal violence') !== -1 || rs.indexOf('religious war') !== -1) {
        if (this._activeConditions.indexOf('sectarian_escalation') === -1) this._activeConditions.push('sectarian_escalation');
        if (this._activeConditions.indexOf('identity_hardening') === -1) this._activeConditions.push('identity_hardening');
      }
      if (rs.indexOf('abuse') !== -1 || rs.indexOf('scandal') !== -1 || rs.indexOf('coverup') !== -1 || rs.indexOf('cover-up') !== -1) {
        if (this._activeConditions.indexOf('scandal_exposure') === -1) this._activeConditions.push('scandal_exposure');
        if (this._activeConditions.indexOf('trust_collapse') === -1) this._activeConditions.push('trust_collapse');
      }
      if (rs.indexOf('radical') !== -1 || rs.indexOf('extremis') !== -1 || rs.indexOf('jihad') !== -1 || rs.indexOf('terror') !== -1) {
        if (this._activeConditions.indexOf('extremist_capture') === -1) this._activeConditions.push('extremist_capture');
        if (this._activeConditions.indexOf('radicalization_pipeline') === -1) this._activeConditions.push('radicalization_pipeline');
      }
      if (rs.indexOf('decline') !== -1 || rs.indexOf('closing') !== -1 || rs.indexOf('empty pew') !== -1 || rs.indexOf('none') !== -1) {
        if (this._activeConditions.indexOf('attendance_contraction') === -1) this._activeConditions.push('attendance_contraction');
        if (this._activeConditions.indexOf('membership_decline') === -1) this._activeConditions.push('membership_decline');
      }
      if (rs.indexOf('schism') !== -1 || rs.indexOf('split') !== -1 || rs.indexOf('breakaway') !== -1 || rs.indexOf('faction') !== -1) {
        if (this._activeConditions.indexOf('doctrinal_conflict') === -1) this._activeConditions.push('doctrinal_conflict');
        if (this._activeConditions.indexOf('denominational_splintering') === -1) this._activeConditions.push('denominational_splintering');
      }
    }

    // Defense/geopolitical signals
    var snap = this._getSnapshot();
    if (snap && snap.defenseSignals) {
      for (var si = 0; si < snap.defenseSignals.length; si++) {
        var sig = snap.defenseSignals[si];
        if (sig.affectedDomains && sig.affectedDomains.indexOf('religion') !== -1) {
          this._activeConditions.push(sig.eventType);
          signals.push('FEED [DEFENSE]: ' + (sig.eventType || '').replace(/_/g, ' '));
        }
      }
    }
    if (snap && snap.macroShock && snap.macroShock.detected) {
      this._activeConditions.push('macro_shock');
    }

    // Cross-domain pressure
    if (window.LIMENDomainBrains) {
      var allBrains = window.LIMENDomainBrains.getAll();
      for (var bk in allBrains) {
        if (bk === 'religion') continue;
        var b = allBrains[bk]; if (!b || !b.state) continue;
        var bEm = b.state.crossDomainEmissions || [];
        for (var bei = 0; bei < bEm.length; bei++) {
          var be = bEm[bei];
          if (be.targetDomain === 'religion' && be.magnitude > 0.1) {
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
    //    SURVIVES on real feeds/events : 6: community_disengagement, attendance_contraction, youth_disengagement, authority_erosion, religion_high_stress, grievance_amplification
    //    REMOVED, no other source in this file : 3: declining_legitimacy, polarizing_rhetoric, structural_stress


    var extPressure = this.getExternalPressure ? this.getExternalPressure() : 0;
    if (extPressure >= 0.10) this._activeConditions.push('identity_hardening');
    if (extPressure >= 0.20) this._activeConditions.push('hypocrisy_perception');

    this.state.signals = signals;
    return Promise.resolve();
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 4: Derive diagnoses — condition-matched from portal
  // ══════════════════════════════════════════════════════════════════════

  ReligionBrain.prototype.deriveDiagnoses = function () {
    var self = this;
    return this._getPortalContent().then(function (portal) {
      if (!portal) return;
      var issues = portal.issues || [], conditions = self._activeConditions || [];
      self.state.diagnoses = issues.map(function (iss) {
        var triggers = self.diagnosisIndex[iss.id] || [];
        var matchCount = 0;
        for (var t = 0; t < triggers.length; t++) {
          for (var c = 0; c < conditions.length; c++) {
            if (conditions[c] === triggers[t] || conditions[c].indexOf(triggers[t]) !== -1) matchCount++;
          }
        }
        return {
          id: iss.id, label: iss.label, summary: iss.summary || '',
          active: matchCount > 0,
          relevance: Math.round((triggers.length > 0 ? matchCount / triggers.length : 0) * 100) / 100,
          matchedConditions: matchCount, totalTriggers: triggers.length,
          circuits: iss.circuits || [], source: 'canonical'
        };
      });
      self.state.diagnoses.sort(function (a, b) {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return b.relevance - a.relevance;
      });
      self._checkDiagnosisActions();
      // Neuro-substrate telemetry (advisory): brain state (pulse-less capable) -> runtime overlay via generic adapter.
      try {
        if (window.DomainTelemetryAdapter && typeof window.DomainTelemetryAdapter.fromLiveCached === "function") {
          window.DomainTelemetryAdapter.fromLiveCached("religion", self.state, self._runtimeOverlay || null)
            .then(function (ov) { if (ov) self._runtimeOverlay = ov; }).catch(function () {});
        }
      } catch (_e) {}
    });
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 5: Recommend treatments for active diagnoses
  // ══════════════════════════════════════════════════════════════════════

  ReligionBrain.prototype.recommendTreatments = function () {
    var self = this;
    return this._getPortalContent().then(function (portal) {
      if (!portal) return;
      var activeDx = self.state.diagnoses.filter(function (d) { return d.active; });
      if (activeDx.length === 0) { self.state.treatments = []; return; }
      var activeNodeIds = {};
      for (var di = 0; di < activeDx.length; di++) {
        var circuits = activeDx[di].circuits || [];
        for (var ci = 0; ci < circuits.length; ci++) activeNodeIds[circuits[ci].nodeId] = activeDx[di].id;
      }
      var treatments = [], activations = portal.activations || [];
      for (var ai = 0; ai < activations.length; ai++) {
        var act = activations[ai];
        if (!activeNodeIds[act.brainNodeId]) continue;
        var actTreats = act.treatments || [];
        for (var ti = 0; ti < actTreats.length; ti++) {
          var t = actTreats[ti];
          treatments.push({
            id: 'treat_' + act.brainNodeId + '_' + ti, label: t.label, type: t.type,
            evidence: t.evidence, description: t.description || '',
            diagnosisId: activeNodeIds[act.brainNodeId], nodeId: act.brainNodeId,
            relevance: 1.0, source: 'canonical'
          });
        }
      }
      var eR = { A: 10, 'Strong': 10, B: 7, 'Moderate': 7, C: 4, 'Emerging': 1 };
      treatments.sort(function (a, b) { return (eR[b.evidence] || 0) - (eR[a.evidence] || 0); });
      self.state.treatments = treatments;
    });
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 6: Surface opportunities with capital classification
  // ══════════════════════════════════════════════════════════════════════

  ReligionBrain.prototype.surfaceOpportunities = function () {
    Base.prototype.surfaceOpportunities.call(this);
    var opps = [], stress = this.state.stress;
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; });
    var allDx = this.state.diagnoses || [];
    var companies = this.state.companies, seen = {};

    function add(o) { var key = o.title.toLowerCase().replace(/[^a-z0-9]/g, ''); if (seen[key]) return; seen[key] = true; opps.push(o); }

    // ═══ TIER 1 — DIRECT ═══
    for (var di = 0; di < activeDx.length; di++) {
      var dx = activeDx[di], dxLabel = (dx.label || dx.id || '').replace(/_/g, ' ');
      add({ title: dxLabel + ' — institutional governance and accountability systems', rank: stress * dx.relevance, path: 'INVESTABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.50) add({ title: dxLabel + ' — trust restoration and transparency infrastructure', rank: stress * dx.relevance * 0.9, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.55 && dx.relevance >= 0.2) add({ title: dxLabel + ' — community engagement and participation rebuild', rank: stress * 0.85, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      add({ title: dxLabel + ' — interfaith stabilization and mediation platform', rank: stress * dx.relevance * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
    }

    var termCo = [] /* neutralized: distress only from validated gate (see energy-brain) */;
    if (termCo.length > 0) add({ title: 'Religion terminal entity distressed positioning', rank: 0.95, path: 'INVESTABLE', urgency: 'high', source: 'company_terminal', tier: 1, companies: termCo.map(function (c) { return c.ticker; }), stress: stress });

    if (this.state.convergence && this.state.convergence.primary_signal) add({ title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — religion convergence response', rank: 0.98, path: 'INVESTABLE', urgency: 'high', source: 'convergence', tier: 1, stress: stress });

    // ═══ TIER 2 — CROSS-DOMAIN ═══
    var emissions = this.state.crossDomainEmissions || [];
    for (var ei = 0; ei < emissions.length; ei++) {
      var em = emissions[ei];
      add({ title: 'Religion \u2192 ' + (em.targetDomain || '').replace(/_/g, ' ') + ' — ' + (em.signal || em.signalType || '').replace(/_/g, ' '), rank: (em.magnitude || 0.5) * stress * 0.8, path: 'INVESTABLE', urgency: em.magnitude > 0.6 ? 'high' : 'medium', source: 'cross_domain', tier: 2, stress: stress });
    }

    // ═══ TIER 3 — LAGGING ═══
    if (stress >= 0.50) {
      add({ title: 'Faith-based community service infrastructure', rank: stress * 0.70, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'service_infra', stress: stress });
      add({ title: 'Reputational repair and institutional accountability systems', rank: stress * 0.65, path: 'INVESTABLE', urgency: stress > 0.70 ? 'medium' : 'watching', source: 'lagging', tier: 3, diagnosisId: 'accountability', stress: stress });
    }
    if (stress >= 0.60) {
      add({ title: 'Youth engagement and next-generation formation platforms', rank: stress * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'youth_engage', stress: stress });
      add({ title: 'De-radicalization and counter-extremism programs', rank: stress * 0.72, path: 'RESEARCHABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'deradicalize', stress: stress });
      add({ title: 'Interfaith dialogue and peacebuilding infrastructure', rank: stress * 0.68, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'interfaith', stress: stress });
    }

    var nearDx = allDx.filter(function (d) { return !d.active && d.relevance > 0 && d.totalTriggers > 0; });
    for (var ndi = 0; ndi < nearDx.length; ndi++) {
      if (stress >= 0.45) add({ title: (nearDx[ndi].label || '').replace(/_/g, ' ') + ' — early-stage monitoring', rank: stress * (nearDx[ndi].relevance || 0.1) * 0.5, path: 'RESEARCHABLE', urgency: 'watching', source: 'near_diagnosis', tier: 2, stress: stress, nearDiagnosisId: nearDx[ndi].id });
    }

    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });
    // Canonical enrichment — merge religion playbook detail per opportunity
    var PB_LIST = window.LIMENReligionOpportunityPlaybooks || [];
    var _byId = {};
    for (var _pbi = 0; _pbi < PB_LIST.length; _pbi++) _byId[PB_LIST[_pbi].id] = PB_LIST[_pbi];
    var _PB_MAP = {
      'SECTARIAN_CONFLICT': 'sectarian_conflict',
      'INSTITUTIONAL_ABUSE': 'institutional_abuse',
      'RADICALIZATION': 'radicalization',
      'SECULARIZATION_CRISIS': 'secularization_crisis',
      'THEOLOGICAL_SCHISM': 'theological_schism'
    };
    var _LAGGING_MAP = {
      'accountability': 'institutional_abuse',
      'deradicalize': 'radicalization',
      'interfaith': 'sectarian_conflict',
      'service_infra': 'secularization_crisis',
      'youth_engage': 'secularization_crisis'
    };
    function _resolvePbId(o) {
      if (o.diagnosisId && _PB_MAP[o.diagnosisId]) return _PB_MAP[o.diagnosisId];
      if (o.source === 'lagging' && o.diagnosisId && _LAGGING_MAP[o.diagnosisId]) return _LAGGING_MAP[o.diagnosisId];
      if (o.nearDiagnosisId && _PB_MAP[o.nearDiagnosisId]) return _PB_MAP[o.nearDiagnosisId];
      return null;
    }
    function _urgencyLabel(u) { if (u === 'high') return 'IMMEDIATE'; if (u === 'medium') return 'ACTIVE'; if (u === 'watching') return 'WATCH'; return (u || '').toUpperCase(); }
    var _COMP = {
      'INVESTABLE':   { type: 'invest',   base: 5,  unit: 'profit%',  tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
      'RESEARCHABLE': { type: 'research', base: 10, unit: 'cite/credit%', tier: 1, nextTier: { tier: 2, comp: 15, requirement: '3 published research outputs' }, maxTier: { tier: 3, comp: 25 } }
    };
    for (var oi = 0; oi < opps.length; oi++) {
      var o = opps[oi];
      o.id = (o.diagnosisId || o.nearDiagnosisId || o.source || 'opp').replace(/[^a-zA-Z0-9]/g, '_') + '_' + (o.path || '').toLowerCase().replace(/[^a-z]/g, '') + '_t' + (o.tier || 0);
      o.domain = 'religion';
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
        var evidenceParts = ['Domain: religion', 'Stress: ' + stressPct + '%'];
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

  // ══════════════════════════════════════════════════════════════════════
  // ACTION PIPELINE
  // ══════════════════════════════════════════════════════════════════════

  ReligionBrain.prototype._checkDiagnosisActions = function () {
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; }); if (activeDx.length === 0) return;
    var adapters = window.LIMENActionAdapters; if (!adapters) return;
    for (var i = 0; i < activeDx.length; i++) {
      var dx = activeDx[i];
      if (adapters.getDrafts && adapters.getDrafts({ domain: 'religion', intentId: dx.id }).length > 0) continue;
      adapters.createDraft('REPORT_GENERATION', { domain: 'religion', sourceType: 'domain_brain', sourceId: dx.id, intentId: dx.id, title: 'Religion Alert: ' + dx.label, intent: { domain: 'religion', title: dx.label, status: 'ACTIVE', priority: this.state.stress, progress: 0, strategyType: 'diagnosis_response', steps: [{ type: 'ANALYZE', label: 'Assess ' + dx.label + ' impact on religious institutions', status: 'PENDING' }, { type: 'INVESTIGATE', label: 'Identify affected communities and organizations', status: 'PENDING' }, { type: 'POSITION', label: 'Evaluate stabilization opportunities', status: 'PENDING' }] } });
    }
  };

  ReligionBrain.prototype.resolveDeepContent = function () {
    var self = this; var resolver = window.LIMENPortalContentResolver; if (!resolver) return Promise.resolve();
    return resolver.resolveForBrain(this.state).then(function (content) { self.state.resolvedContent = content; if (content) { var dt = []; for (var dxId in content.byDiagnosis) { var dxC = content.byDiagnosis[dxId]; for (var i = 0; i < dxC.treatments.length; i++) { var t = dxC.treatments[i]; dt.push({ id: 'deep_' + t.nodeId + '_' + i, label: t.label, type: t.type, evidence: t.evidence, description: t.description, cite: t.cite, steps: t.steps, monitoring: t.monitoring, escalation: t.escalation, diagnosisId: dxId, nodeId: t.nodeId, nodeLabel: t.nodeLabel, hasDepth: t.hasDepth, source: 'canonical_deep' }); } } if (dt.length > 0) self.state.treatments = dt; } }).catch(function () {});
  };

  var _origCycle = ReligionBrain.prototype.cycle;
  ReligionBrain.prototype.cycle = function () {
    var self = this;
    return _origCycle.call(this).then(function () {
      return self.resolveDeepContent();
    }).then(function () {
      // PHASE B — recurrent loop step. Runs AFTER the pipeline settles (deriveDiagnoses
      // already ran inside the base cycle), reads the prior produced by the PREVIOUS
      // cycle, computes prediction error, regulates, and updates the next prior.
      // Religion-local + try/caught (never breaks a cycle). Sets state.cognition.
      try { self._updateReligionModel(); } catch (e) {}
      try { self._computeReligionOverlays(); } catch (e) {}   // NEURO-SUBSTRATE OVERLAY WIRING (per-domain, ported from energy 2026-07-21): invokes religion's OWN overlay modules each cycle; shadow, proposals only
      return self.state.religionModel;
    });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // NEURO-SUBSTRATE OVERLAY WIRING — per-domain copy of energy's _computeEnergyOverlays
  // (2026-07-21, full per-domain independence). Invokes religion's OWN modules
  // (window.Religion{Metaplasticity,Extinction,RetrogradeThrottle,PredictionErrorCompressor,
  // OfflineMaintenance,NeuroSubstrate,ConnectivityAudit}) against religion's OWN runtime def
  // (religion.json runtime.params + edges/issues/activations). SHADOW: writes state.religionOverlays;
  // the only actuation is metaplasticity -> the refractory dead-time (matches energy exactly).
  // Degrade-safe: returns mode 'off' when the modules are not on the page (they load only on the
  // religion console), 'loading' until religion.json arrives.
  // ════════════════════════════════════════════════════════════════════════════
  ReligionBrain.prototype._loadReligionDef = function () {
    if (this._religionDef) return this._religionDef;
    if (this._religionDefLoading) return null;
    this._religionDefLoading = true;
    var self = this;
    if (typeof fetch === 'function') {
      try {
        fetch('/assets/data/domains/religion.json').then(function (r) { return r.json(); })
          .then(function (def) { self._religionDef = def; })
          .catch(function () { self._religionDefLoading = false; });
      } catch (e) { this._religionDefLoading = false; }
    }
    return null;
  };

  ReligionBrain.prototype._computeReligionOverlays = function () {
    var s = this.state;
    function mod(glob, reqPath) {
      if (typeof window !== 'undefined' && window[glob]) return window[glob];
      if (typeof module !== 'undefined') { try { return require(reqPath); } catch (e) {} }
      return null;
    }
    var META = mod('ReligionMetaplasticity', '../religion-metaplasticity.js');
    var EXT = mod('ReligionExtinction', '../religion-extinction.js');
    var RETRO = mod('ReligionRetrogradeThrottle', '../religion-retrograde-throttle.js');
    var PEC = mod('ReligionPredictionErrorCompressor', '../religion-prediction-error-compressor.js');
    var OFF = mod('ReligionOfflineMaintenance', '../religion-offline-maintenance.js');
    var NS = mod('ReligionNeuroSubstrate', '../religion-neuro-substrate.js');
    var CONN = mod('ReligionConnectivityAudit', '../religion-connectivity-audit.js');
    if (!(META && EXT && RETRO && PEC && OFF && NS && CONN)) {
      s.religionOverlays = { version: 1, mode: 'off', note: 'overlay modules not loaded on this page (present only on the religion console)' };
      return null;
    }
    var def = this._loadReligionDef();
    if (!def) { s.religionOverlays = { version: 1, mode: 'loading', note: 'religion.json runtime def loading; overlays compute next cycle' }; return null; }

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

    var intero = s.religionInteroception || (s.cognition && s.cognition.interoception) || {};
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

    s.religionOverlays = {
      version: 1, mode: 'shadow', armed: armed,
      volatility: Math.round(volatility * 1000) / 1000,
      metaplasticity: { changes: meta.changes, adapted: adapted, noop: meta.noop },
      extinction: { candidates: ext.candidates, count: ext.candidates.length, noop: ext.noop, actuation: 'PROPOSAL-ONLY (retiring a node edits religion.json — human-gated forever)' },
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
    s.religionOverlays.mode = armed ? 'armed' : 'shadow';
    s.religionOverlays.applied = applied;
    s.religionOverlays.actuationScope = 'metaplasticity->refractory dead-time ONLY (bounded, fail-toward-quiet, reversible). throttle=no-live-consumer; PE=observe-only; extinction+offline-prune=PROPOSAL-ONLY (remove structure, human-gated forever).';
    s.religionOverlays.note = 'PER-DOMAIN OVERLAY WIRING (ported from energy): religion runs its OWN 6 overlay modules + connectivity recurrenceAudit each cycle on religion.json. ARMED: metaplasticity raises the refractory dead-time with volatility (clamped, reversible). Everything else is proposal/observe-only.';

    if (s.cognition && typeof s.cognition === 'object') s.cognition.overlays = s.religionOverlays;
    return s.religionOverlays;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE B — RELIGION RECURRENT LOOP v1 (religion-local, additive, reversible)
  // Converts re-running inference into a recurrent loop:
  //   prior → observation → prediction error → bounded update → next prior.
  // Proof surface: window.LIMENReligionBrain.state.religionModel
  // Mirrors energy-brain.js _neutralEnergyModel / _buildObservation /
  // _computePredictionError / _computeRegulation EXACTLY — only CONTENT becomes
  // religion (affiliation %, institutional trust, youth engagement — never oil prices).
  // ════════════════════════════════════════════════════════════════════════════
  var RM_VERSION = 1;
  var RM_LEARNING_RATE = 0.25;          // bounded plasticity (fast inference)
  var RM_SLOW_RATE = 0.08;              // slow consolidation (reserved for rebuild/cron)
  var RM_STRESS_FLOOR = 0.30;           // below this → no handoff
  var RM_FLOOD_CAP = 12;                // opportunity-flood threshold
  var RM_STALE_MS = 1000 * 60 * 60 * 6; // 6h feed staleness
  var RK_OUTCOME_BUFFER = 40;           // K4 rolling predicted-vs-realized samples (mirrors EK_OUTCOME_BUFFER)
  var RK_HOMEO_WINDOW = 60;             // K8 cycles of stress baseline for the adaptive set-point (mirrors EK_HOMEO_WINDOW)

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

  // ── Real religion source constants (NOT energy/oil) ──────────────────────────
  // Used to classify feeds by REAL category and to validate source names in the
  // immune layer. Analogous to energy's isCrudePriceFeed() guard + MADLIB_VERB.
  // NEVER fabricate ticker-like org IDs — religion is indicator/institution based.
  var RELIGION_SOURCES = {
    Pew: 'Pew Research Center — Religious Landscape Study',
    ARDA: 'Association of Religion Data Archives',
    Gallup: 'Gallup religion polling',
    PRRI: 'Public Religion Research Institute',
    USCIRF: 'US Commission on International Religious Freedom',
    WVS: 'World Values Survey',
    EVS: 'European Values Study'
  };
  var RELIGION_SOURCE_TOKENS = /pew|arda|association of religion data|gallup|prri|public religion|uscirf|religious freedom|world values|european values|wvs|evs/;
  var RELIGION_AFFILIATION_CATEGORIES = [
    'Catholic', 'Evangelical Protestant', 'Mainline Protestant', 'Black Protestant',
    'Orthodox Christian', 'Latter-day Saints', 'Jewish', 'Muslim', 'Hindu',
    'Buddhist', 'Sikh', 'Other Faiths', 'Unaffiliated'
  ];
  // Religious-freedom / synthetic-entity guard: a "real" religious entity must match a
  // known tradition/source category; a ticker-like all-caps token with no source backing
  // is treated as a synthetic-entity contamination antigen (never admitted).
  function _rmIsSyntheticEntity(id) {
    if (!id) return false;
    var t = String(id).trim();
    // ticker-shaped (1-5 all-caps letters, no spaces) with no whitespace = synthetic risk
    return /^[A-Z]{1,5}$/.test(t);
  }

  ReligionBrain.prototype._neutralReligionModel = function () {
    return {
      version: RM_VERSION, cycle: 0,
      prior: { expectedStress: 0.5, expectedDiagnoses: [], expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, confidence: 0, samples: 0 },
      observation: null, predictionError: null, predictedStress: null,
      plasticity: { learningRate: RM_LEARNING_RATE, slowRate: RM_SLOW_RATE, consolidation: 'cycle-light/rebuild-heavy' },
      regulation: null, readyForHandoff: false, _lowErrorStreak: 0
    };
  };

  // B2 — normalized observation from current Religion state (Pew/PRRI/ARDA feeds,
  // stress, active diagnoses). Mirrors energy _buildObservation; content is religion.
  ReligionBrain.prototype._buildReligionObservation = function () {
    var s = this.state || {};
    var active = (s.diagnoses || []).filter(function (d) { return d.active; });
    var feeds = s.feeds || {}, feedCount = 0, newest = 0, sourceBacked = 0;
    for (var k in feeds) {
      if (feeds.hasOwnProperty(k)) {
        feedCount++;
        var f = feeds[k];
        var u = f && f.updated; if (u && u > newest) newest = u;
        var ident = String((f && (f.name || f.label)) || k).toLowerCase();
        if (RELIGION_SOURCE_TOKENS.test(ident)) sourceBacked++;
      }
    }
    return {
      stress: typeof s.stress === 'number' ? s.stress : 0,
      phase: s.phase || null,
      activeDiagnoses: active.map(function (d) { return d.id; }).sort(),
      diagnosisCount: active.length,
      opportunityCount: (s.opportunities || []).length,
      companyCount: (s.companies || []).length,
      signal: Math.min(1, feedCount / 8),
      sourceBackedFeeds: sourceBacked,
      feedNewest: newest,
      timestamp: Date.now()
    };
  };

  // B3 — prediction error: prior.expected* vs observation (stressError, signalError,
  // diagnosisError via Jaccard). Identical weighting to energy.
  ReligionBrain.prototype._computeReligionPredictionError = function (prior, obs) {
    var stressError = Math.abs(obs.stress - prior.expectedStress);
    var signalError = Math.abs(obs.signal - prior.expectedSignal);
    var diagnosisError = _rmJaccardDistance(obs.activeDiagnoses, prior.expectedDiagnoses);
    var oppDenom = Math.max(1, prior.expectedOpportunityCount, obs.opportunityCount);
    var opportunityError = Math.abs(obs.opportunityCount - prior.expectedOpportunityCount) / oppDenom;
    var portalError = 0; // honest 0 — no live portal traversal yet
    var total = _rmClamp(0.4 * stressError + 0.2 * signalError + 0.25 * diagnosisError + 0.15 * opportunityError, 0, 1);
    var novelty = Math.max(stressError, diagnosisError);
    return { total: total, stressError: stressError, signalError: signalError, diagnosisError: diagnosisError, opportunityError: opportunityError, portalError: portalError, novelty: novelty };
  };

  // B4 — bounded prior update toward observation (next cycle reads this)
  ReligionBrain.prototype._updateReligionPrior = function (prior, obs, lr) {
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
  ReligionBrain.prototype._computeReligionRegulation = function (rm, obs, pe) {
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
  // so cycle N+1's interpretation depends on cycle N. Hooked AFTER deriveDiagnoses,
  // BEFORE the DDP build. Sets state.cognition (MANDATORY for the console SELF-MODEL).
  ReligionBrain.prototype._updateReligionModel = function () {
    var rm = this.state.religionModel || this._neutralReligionModel();
    var priorIn = rm.prior;                                          // carried from last cycle
    var obs = this._buildReligionObservation();
    var pe = this._computeReligionPredictionError(priorIn, obs);     // prior vs now

    var gainBlend = _rmClamp(pe.novelty, 0.05, 0.95);
    var predictedStress = priorIn.expectedStress * (1 - gainBlend) + obs.stress * gainBlend;
    var reg = this._computeReligionRegulation(rm, obs, pe);

    var readyForHandoff = (rm.cycle > 0) && (predictedStress >= RM_STRESS_FLOOR) && (obs.diagnosisCount > 0) && !reg.flooding && !reg.stale;

    // ── K4 CLOSED — credit assignment routed through the central honest reward gate ──
    // (window.LIMENK4.credit). Religion is NOT externalRewardEligible: it has no external
    // realized-outcome label, so externalOutcome is ALWAYS null and its credit is
    // self-consistency calibration only (interpretive), NEVER reward. The gate enforces the
    // preemption: external-reward(4) > phase-consistency(3) > call-consistency(2) >
    // stress-consistency(1) > none. Pure math, no AI/network on the cycle.
    // One-cycle lag: reads the PREVIOUS cycle's religionOutcomeModel + religionPhaseDynamics.
    var _om = this.state.religionOutcomeModel;
    var _pt = (this.state.religionPhaseDynamics || {}).transition;
    // Phase actuation is OFF for religion (_actuation.phase=false), so a thing2 transition is
    // ADVISORY only and NEVER feeds credit: _ptActive stays false => phaseTransitionHit=null.
    var _ptActive = !!(this._actuation && this._actuation.phase && _pt && _pt.hit !== null);
    // religionOutcomeModel = predicted-vs-next-realized STRESS self-prediction (its callHitRate
    // field measures stress agreement, not resolved external calls) => stress-consistency tier.
    // Signal built from what the brain already computed. externalOutcome MUST be null.
    var _sig = {
      externalOutcome: null,                                              // NOT eligible: self-consistency only, never reward
      phaseValidated: !!(_pt && _pt.validated),                           // P3/P7 family gate for phase-consistency tier (advisory here)
      phaseTransitionHit: _ptActive ? (_pt.hit ? 1 : 0) : null,           // thing2 transition hit (interpretive; null — phase actuation off)
      callHitRate: null,                                                  // religion has no separate resolved-calls TRUTH BRAKE ledger
      callSamples: 0,
      stressSelfPred: (_om && typeof _om.callHitRate === 'number') ? _om.callHitRate : null,  // stress self-prediction (predicted-vs-realized stress)
      stressSamples: (_om && typeof _om.samples === 'number') ? _om.samples : 0
    };
    var _k4 = (typeof window !== 'undefined' && window.LIMENK4 && typeof window.LIMENK4.credit === 'function')
      ? window.LIMENK4.credit(_sig) : null;
    var _hit, _creditSource, _isReward;
    if (_k4) {
      _hit = (typeof _k4.credit === 'number') ? _k4.credit : null;
      _creditSource = _k4.creditSource;
      _isReward = !!_k4.isReward;                                         // ALWAYS false for religion (not externalRewardEligible)
    } else {
      // FALLBACK (gate absent) — preserve PRIOR religion behavior: K4 was advisory / not fed
      // back, so the learning rate stays the raw rm.plasticity.learningRate (no modulation). No throw.
      _hit = null;
      _creditSource = 'gate-absent';
      _isReward = false;                                                  // self-consistency only; never reward
    }
    var _lr = rm.plasticity.learningRate;
    if (_hit !== null) _lr = _rmClamp(_lr * (1 + (1 - _hit)), RM_SLOW_RATE, 0.6);   // higher credit -> smaller LR bump
    rm._effectiveLearningRate = _lr;
    rm._creditSource = _creditSource;
    rm._creditIsReward = _isReward;                                       // honest flag: false unless a real external outcome fed the gate
    var nextPrior = this._updateReligionPrior(priorIn, obs, _lr);

    rm.cycle += 1;
    rm.observation = obs;
    rm.predictionError = pe;
    rm.predictedStress = predictedStress;
    rm.regulation = reg;
    rm.readyForHandoff = readyForHandoff;
    rm.prior = nextPrior;
    rm.updated = obs.timestamp;
    this.state.religionModel = rm;

    // ── PHASE K — NEURO-COMPLETION LAYERS (K1..K8, advisory, reversible) ──────────
    // Runs the eight K-loops in energy's exact K1..K8 order, BEFORE the servo/phase
    // actuation (same as energy runs K1-K8 before _computeEnergyServo). Additive readouts
    // only — none rewires the scoring spine. try/caught so it never breaks a cycle.
    try { this._computeReligionNeuroLayers(); } catch (e) {}

    // ── ACTUATION (behind this._actuation flags; reversible) ──────────────────────
    // SERVO (regulate-to-target E/I) is computed HERE (reads rm.regulation.inhibition) and
    // APPLIED next cycle by emitCrossDomainSignals -> _regulateReligionEmissions (one-cycle
    // lag, mirrors energy). PHASE dynamics is computed ADVISORY-only (phase actuation invalid
    // for religion); it never changes emissions/opportunities/credit.
    try { if (this._actuation && this._actuation.servo) this._computeReligionServo(); } catch (e) {}
    try { this._computeReligionPhaseDynamics(); } catch (e) {}
    try { this._computeReligionSelfAudit(); } catch (e) {}   // SELF-AUDIT: consume the 83-edge graph -> SPOF (observe-only advisory)

    // #8 — outcomeLog population (real cycle telemetry; feeds intuition pattern-matching)
    try {
      var mem = this.state.memory || (this.state.memory = {});
      var log = mem.outcomeLog || (mem.outcomeLog = []);
      log.push({ cycle: rm.cycle, predictionError: Math.round(pe.total * 1000) / 1000, stress: obs.stress, activeDx: obs.diagnosisCount, regulation: reg.state, readyForHandoff: readyForHandoff, timestamp: obs.timestamp });
      if (log.length > 50) log.shift();
    } catch (e) {}

    // H1-H6 — higher Religion brain layers (computed BEFORE the affiliation layer + DDP build)
    try { this._computeReligionHigherLayers(); } catch (e) {}

    // AFFILIATION-VITALITY sub-portal layer (additive; BEFORE the DDP build so the primary
    // packet's promptView advertises it). NEVER merged into the validated diagnosis spine.
    try { this._buildReligionAffiliationLayer(); } catch (e) {}

    // DDP — build the DomainDiagnosisPacket (8-section contract) for the primary diagnosis,
    // and one per diagnosis. Schema-only: never invents data. Consumed by the Civilization cockpit.
    try {
      var _diags = this.state.diagnoses || [];
      var _primary = _diags.filter(function (d) { return d.active; })[0] || _diags[0] || null;
      var _self = this;
      rm.domainDiagnosisPacket = this._buildDomainDiagnosisPacket(_primary);
      this.state.religionDomainDiagnosisPackets = _diags.map(function (d) { return _self._buildDomainDiagnosisPacket(d); });
    } catch (e) {}

    // MANDATORY — state.cognition: the generic surface domain-console-brain.js reads this for
    // ANY brain (SELF-MODEL panel + Civilization handoff). domain='religion'; model carries the
    // recurrent religionModel fields; awareness/conscience/immune/intuition exposed generically
    // AND as religionXxx aliases.
    this.state.cognition = {
      domain: 'religion',
      religionModel: rm,
      model: { cycle: rm.cycle, predictionError: rm.predictionError, predictedStress: rm.predictedStress, regulation: rm.regulation },
      religionImmune: this.state.religionImmune || null,
      religionAwareness: this.state.religionAwareness || null,
      religionConscience: this.state.religionConscience || null,
      religionIntuition: this.state.religionIntuition || null,
      religionSimulation: this.state.religionSimulation || null,
      religionExecutiveReport: this.state.religionExecutiveReport || null,
      awareness: this.state.religionAwareness || null,
      conscience: this.state.religionConscience || null,
      immune: this.state.religionImmune || null,
      intuition: this.state.religionIntuition || null,
      servo: this.state.religionServo || null,                       // ACTUATED: regulate-to-target E/I servo
      phaseDynamics: this.state.religionPhaseDynamics || null,       // ADVISORY-only (phase actuation invalid)
      emissionRegulation: this.state.religionEmissionRegulation || null,  // effector application (E/I brake + refractory)
      neuro: this.state.religionNeuro || null,                            // PHASE K neuro-completion roll-up (K1..K8, advisory)
      selfAudit: this.state.religionSelfAudit || null,                    // connectivity/SPOF self-audit (observe-only)
      sceneLayer: this.state.affiliationLayer || null,
      treatments: this.state.treatments || [],
      diagnoses: this.state.diagnoses || [],
      opportunities: this.state.opportunities || []
    };

    return rm;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // AFFILIATION-VITALITY SUB-LAYER (additive; NEVER merged into the validated spine).
  // Tracks Pew affiliation %, ARDA growth/decline, youth engagement, institutional
  // strength from /assets/data/domains/religion_affiliation-vitality.json. Diagnoses are
  // canonical-to-self, bundleStatus 'missing' (honest — no external source bundle yet).
  // Each gets a DDP; advertised in promptView like energy's datacenterSummary. Offline-safe:
  // on any absence the layer stays empty/neutral (loaded:false) and nothing breaks.
  // ════════════════════════════════════════════════════════════════════════════
  ReligionBrain.prototype._loadAffiliationVitality = function () {
    var self = this;
    if (self._affLoadPromise) return self._affLoadPromise;
    self._affLoadPromise = fetch('/assets/data/domains/religion_affiliation-vitality.json')
      .then(function (r) { return (r && r.ok) ? r.json() : null; })
      .then(function (data) {
        if (!data) { self._affPortal = null; return null; }
        self._affPortal = { issues: data.issues || [], activations: data.activations || [], title: data.title || 'Affiliation & Vitality' };
        return self._affPortal;
      })
      .catch(function () { self._affPortal = null; return null; });
    return self._affLoadPromise;
  };

  ReligionBrain.prototype._buildReligionAffiliationLayer = function () {
    var self = this;
    if (!self._affLoadPromise) { try { self._loadAffiliationVitality(); } catch (e) {} }
    var aff = self._affPortal;
    if (!aff || !aff.issues || !aff.issues.length) {
      self.state.affiliationDiagnoses = [];
      self.state.affiliationTreatments = [];
      self.state.affiliationDomainDiagnosisPackets = [];
      self.state.affiliationLayer = { loaded: false, count: 0, activeCount: 0, diagnoses: [], categories: RELIGION_AFFILIATION_CATEGORIES, sources: Object.keys(RELIGION_SOURCES), note: 'affiliation-vitality sub-portal not loaded (offline, fetch failed, or build-required) — affiliation %, ARDA growth/decline, youth engagement, institutional strength tracked here when present; honest bundleStatus=missing' };
      return self.state.affiliationLayer;
    }
    var conditions = self._activeConditions || [];
    var diagnoses = aff.issues.map(function (iss) {
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
        source: 'affiliation', tier: 'real-content-unbundled', branch: 'affiliation-vitality'
      };
    });
    var nodeToDx = {};
    diagnoses.forEach(function (d) { (d.circuits || []).forEach(function (c) { if (c && c.nodeId) nodeToDx[c.nodeId] = d.id; }); });
    var treatments = [];
    (aff.activations || []).forEach(function (act) {
      var dxId = nodeToDx[act.brainNodeId];
      if (!dxId) return;
      (act.treatments || []).forEach(function (t, ti) {
        treatments.push({ id: 'aff_treat_' + act.brainNodeId + '_' + ti, label: t.label, type: t.type, evidence: t.evidence, description: t.description || '', cite: t.cite || null, diagnosisId: dxId, nodeId: act.brainNodeId, source: 'affiliation' });
      });
    });
    var evidenceRank = { A: 10, Strong: 10, B: 7, Moderate: 7, C: 4, Emerging: 1 };
    treatments.sort(function (a, b) { return (evidenceRank[b.evidence] || 0) - (evidenceRank[a.evidence] || 0); });
    self.state.affiliationDiagnoses = diagnoses;
    self.state.affiliationTreatments = treatments;
    self.state.affiliationLayer = {
      loaded: true,
      portalTitle: aff.title,
      count: diagnoses.length,
      activeCount: diagnoses.filter(function (d) { return d.active; }).length,
      categories: RELIGION_AFFILIATION_CATEGORIES,
      sources: Object.keys(RELIGION_SOURCES),
      diagnoses: diagnoses.map(function (d) { return { id: d.id, label: d.label, active: d.active, branch: 'affiliation-vitality', canonicalDiagnosisId: d.id, bundleStatus: 'missing', treatmentCount: treatments.filter(function (t) { return t.diagnosisId === d.id; }).length }; }),
      note: 'real-content affiliation-vitality sub-portal (Pew affiliation %, ARDA growth/decline, youth engagement, institutional strength); SEPARATE from the validated diagnosis spine; no external source bundle yet (build-required); never admitted to evidenceAnchors'
    };
    self.state.affiliationDomainDiagnosisPackets = diagnoses.map(function (d) {
      try { return self._buildDomainDiagnosisPacket(d); } catch (e) { return null; }
    }).filter(Boolean);
    return self.state.affiliationLayer;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE H1-H6 — HIGHER RELIGION BRAIN LAYERS (religion-local, additive, domain-level).
  // Computed once per cycle BEFORE the DDP build; each emits a COMPACT summary the DDP
  // embeds in promptView + the full object in audit. Never fabricates evidence;
  // intuition/simulation are explicitly labelled unverified/hypothetical. Religion has
  // NO company tickers — all evidence/sources are real indicators (Pew/PRRI/ARDA/USCIRF).
  // ════════════════════════════════════════════════════════════════════════════
  ReligionBrain.prototype._religionDiagnosisStates = function () {
    var s = this.state, diags = s.diagnoses || [];
    return diags.map(function (d) {
      // source-backed = the diagnosis derives from at least one real religion-source signal;
      // honest default 'missing' (no external artifact-source bundles exist for religion yet).
      return { dxId: d.id, active: !!d.active, relevance: (typeof d.relevance === 'number' ? d.relevance : 0), canonical: d.id, bundleStatus: 'missing', sourceBacked: (d.matchedConditions || 0) > 0 };
    });
  };

  // H1 — formal immune system: scan unsourced diagnoses, prediction-error spikes, stale
  // feeds, opportunity-flooding, synthetic institutional claims. Quarantine mad-lib + synth.
  ReligionBrain.prototype._computeReligionImmune = function () {
    var s = this.state, rm = s.religionModel || {}, reg = rm.regulation || {}, bs = this._religionDiagnosisStates();
    var ant = [];
    bs.forEach(function (b) {
      if (!b.sourceBacked && b.active) ant.push({ type: 'unsourced-religious-institutional-claim', dx: b.dxId, severity: 'medium', action: 'block-from-prompt-evidence', note: 'need Pew/ARDA/PRRI/USCIRF verification' });
      if (b.bundleStatus === 'missing' && b.active) ant.push({ type: 'missing-real-source-data', dx: b.dxId, severity: 'low', action: 'flag', note: 'no external source bundle (Pew/ARDA/PRRI build-required)' });
    });
    // synthetic religious entity guard — any company that is ticker-shaped & not category-backed
    var cos = s.companies || [];
    var synth = cos.filter(function (c) { return c && _rmIsSyntheticEntity(c.ticker || c.id); }).slice(0, 5);
    if (synth.length) ant.push({ type: 'synthetic-religious-entities', severity: 'medium', action: 'quarantine', note: 'religion is indicator/institution-based — ticker-shaped entities without source backing quarantined', entities: synth.map(function (c) { return c.ticker || c.id; }) });
    var pe = (rm.predictionError && rm.predictionError.total) || 0;
    if (pe > 0.4) ant.push({ type: 'prediction-error-spike', severity: 'medium', action: 'lower-confidence', value: Math.round(pe * 1000) / 1000 });
    if (reg.stale) ant.push({ type: 'stale-feeds', severity: 'low', action: 'flag' });
    if (reg.flooding) ant.push({ type: 'opportunity-flood', severity: 'medium', action: 'inhibit' });
    if (reg.starving) ant.push({ type: 'unsupported-artifact-readiness-risk', severity: 'low', action: 'flag' });
    var sev = ant.some(function (a) { return a.severity === 'high'; }) ? 'high' : ant.some(function (a) { return a.severity === 'medium'; }) ? 'medium' : ant.length ? 'low' : 'none';
    var im = {
      version: 1, immuneState: sev === 'high' ? 'alert' : sev === 'medium' ? 'active' : sev === 'low' ? 'watch' : 'clear', severity: sev,
      antigens: ant.slice(0, 12),
      quarantines: ['L1-portal-treatments-madlib', 'synthetic-religious-entities'],
      allowedWithWarning: ant.filter(function (a) { return a.action === 'allow-with-warning'; }).map(function (a) { return a.type + (a.dx ? (':' + a.dx) : ''); }),
      blockedFromPrompt: ant.filter(function (a) { return a.action === 'block-from-prompt-evidence'; }).map(function (a) { return a.dx; }),
      blockedFromTraversal: ['L2'],
      immuneMemory: (((s.religionImmune && s.religionImmune.immuneMemory) || 0) + 1),
      lastScanAt: rm.updated || null
    };
    s.religionImmune = im; return im;
  };

  // H2 — awareness / metacognition
  ReligionBrain.prototype._computeReligionAwareness = function () {
    var s = this.state, rm = s.religionModel || {}, im = s.religionImmune || {}, bs = this._religionDiagnosisStates();
    var covered = bs.filter(function (b) { return b.sourceBacked; });
    var missing = bs.filter(function (b) { return !b.sourceBacked && b.active; });
    var active = (s.diagnoses || []).filter(function (d) { return d.active; });
    var prev = s.religionAwareness || {};
    var pe = (rm.predictionError && rm.predictionError.total) || 0;
    var aw = {
      version: 1,
      selfState: im.immuneState === 'alert' ? 'guarded' : (rm.regulation && rm.regulation.state) || 'unknown',
      knowns: ['affiliation trends (Pew Religious Landscape Study)', 'secularization rates (ARDA)', 'institutional strength (PRRI)', 'religious freedom pressure (USCIRF)', 'global values shifts (WVS/EVS)'],
      unknowns: missing.map(function (b) { return b.dxId + ' (signal-driven, no source bundle)'; }).concat(['fine-grained intra-faith dynamics unknown in some regions']),
      uncertainties: ['diagnoses are signal-driven, NOT validated against ground-truth affiliation data', 'fine-grained intra-faith and regional dynamics under-observed', 'interpretive tracker — phase labels are interpretive, not certified', 'predictionError=' + (Math.round(pe * 1000) / 1000)],
      suppressions: (im.quarantines || []).concat(['synthetic-religious-entities', 'L2-traversal']),
      confidenceDrivers: ['source-backed dx ' + covered.length + '/' + bs.length, 'regulation ' + ((rm.regulation && rm.regulation.state) || '?')],
      changedSinceLastCycle: { predictionErrorDelta: Math.round((pe - (typeof prev._pe === 'number' ? prev._pe : pe)) * 1000) / 1000, coverageNow: covered.length },
      humanReviewRequired: missing.map(function (b) { return b.dxId; }),
      selfNarrative: 'Religion: ' + active.length + ' active dx (' + active.map(function (d) { return d.id; }).slice(0, 4).join(', ') + '), regulation=' + ((rm.regulation && rm.regulation.state) || '?') + ', immune=' + (im.immuneState || '?') + ', sources=Pew/PRRI/ARDA/USCIRF/Gallup.',
      lastAwarenessAt: rm.updated || null, _pe: pe
    };
    s.religionAwareness = aw; return aw;
  };

  // H3 — conscience / veto. Religion is NOT a tangible invention → veto patent/grant (no
  // method/embodiment). Caution on unsourced diagnoses. Investment/research allowed-with-
  // warning ONLY for source-backed diagnoses (Pew/PRRI/ARDA/USCIRF).
  ReligionBrain.prototype._computeReligionConscience = function () {
    var s = this.state, rm = s.religionModel || {}, bs = this._religionDiagnosisStates();
    var pe = (rm.predictionError && rm.predictionError.total) || 0;
    var vetoes = [], cautions = [], allowed = [], blocked = ['patent-claim', 'grant-claim'];
    // retired-lane veto removed 2026-07-14: patent/grant are dead lanes; vetoing them forced
    // conscienceState 'restrictive' every cycle. Real vetoes (missing source bundles) still drive it.
    bs.forEach(function (b) {
      if (!b.sourceBacked && b.active) {
        blocked.push('strong-claim:' + b.dxId);
        cautions.push({ claim: 'unsourced-religious-institutional-claim:' + b.dxId, reason: 'need Pew/ARDA/PRRI verification' });
      } else if (b.sourceBacked) {
        allowed.push('source-summary:' + b.dxId);
      }
    });
    if (pe > 0.4) cautions.push({ claim: 'high-confidence-claim', reason: 'predictionError spike ' + (Math.round(pe * 1000) / 1000) });
    var hasSourced = bs.some(function (b) { return b.sourceBacked && b.active; });
    var con = {
      version: 1, conscienceState: vetoes.length ? 'restrictive' : 'permissive',
      vetoes: vetoes.slice(0, 10), cautions: cautions.slice(0, 10),
      allowedClaims: ['source-summary'].concat(hasSourced ? ['policy-brief-with-warnings'] : []).concat(allowed.slice(0, 6)),
      blockedClaims: blocked.concat(['strong-claim-without-Pew/PRRI/ARDA']).slice(0, 10),
      artifactReadinessDecision: { patentReady: false, grantReady: false, sbaReady: false, investmentReady: hasSourced, researchReady: hasSourced, note: 'patent/grant vetoed (religion not an invention); research/investment allowed-with-warning for source-backed diagnoses only' },
      reasons: ['overclaim prevention', 'source sufficiency (Pew/ARDA/PRRI/USCIRF)', 'no-method/embodiment veto'],
      lastCheckAt: rm.updated || null
    };
    s.religionConscience = con; return con;
  };

  // H4 — intuition / weak-signal (NOT evidence; labelled UNVERIFIED). Hunches on emerging
  // movements, affiliation-trend reversals, institutional capture, interfaith escalation.
  ReligionBrain.prototype._computeReligionIntuition = function () {
    var s = this.state, rm = s.religionModel || {}, reg = rm.regulation || {};
    var log = (s.memory && s.memory.outcomeLog) || [];
    var hunches = [];
    if (log.length >= 2) {
      var a = log[log.length - 2].predictionError, b = log[log.length - 1].predictionError;
      if (typeof a === 'number' && typeof b === 'number' && b - a > 0.05) hunches.push({ hunch: 'affiliation regime shift forming (prediction error rising)', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'predictionError rose ' + a + '->' + b, verifyIf: 'error keeps rising 2+ cycles', falsifyIf: 'error returns to baseline' });
    }
    if (reg.state === 'surprised') hunches.push({ hunch: 'institutional legitimacy collapse signal entering the system', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'regulation=surprised (high novelty)', verifyIf: 'a specific diagnosis activates with source support', falsifyIf: 'novelty subsides next cycle' });
    var missing = this._religionDiagnosisStates().filter(function (x) { return !x.sourceBacked && x.active; });
    if (missing.length) hunches.push({ hunch: 'secularization acceleration: uncovered diagnosis ' + missing[0].dxId, label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'active diagnosis with no source backing', verifyIf: 'real Pew/ARDA data confirms', falsifyIf: 'diagnosis deactivates' });

    var patternMatches = [];
    var recent = log.slice(-10), regCount = {};
    recent.forEach(function (e) { if (e.regulation) regCount[e.regulation] = (regCount[e.regulation] || 0) + 1; });
    Object.keys(regCount).forEach(function (k) { if (regCount[k] >= 3) patternMatches.push({ pattern: 'recurring regulation state: ' + k, occurrences: regCount[k], window: recent.length, label: 'PATTERN', evidenceStatus: 'UNVERIFIED' }); });

    // structural families: sectarian-violence vs institutional-failure vs disaffiliation
    var FAMILY = { 'sectarian-violence': ['SECTARIAN_CONFLICT', 'RADICALIZATION'], 'institutional-failure': ['INSTITUTIONAL_ABUSE', 'THEOLOGICAL_SCHISM'], 'disaffiliation': ['SECULARIZATION_CRISIS'] };
    var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var primaryId = (active[0] || (s.diagnoses || [])[0] || {}).id;
    var analogies = [];
    Object.keys(FAMILY).forEach(function (fam) { if (FAMILY[fam].indexOf(primaryId) >= 0) { FAMILY[fam].forEach(function (sib) { if (sib !== primaryId) analogies.push({ analogy: primaryId + ' resembles ' + sib, family: fam, label: 'ANALOGY', evidenceStatus: 'UNVERIFIED', note: 'shared structural failure-family — a lens for monitoring, not a claim' }); }); } });

    // promotion: a hunch recurring >=3 cycles → monitoring TARGET only (never diagnosis/evidence)
    var hm = this._hunchMemory = this._hunchMemory || {};
    var curKeys = {}; hunches.forEach(function (h) { curKeys[h.hunch] = true; hm[h.hunch] = (hm[h.hunch] || 0) + 1; });
    var promotedToMonitoring = [], rejectedHunches = [];
    Object.keys(hm).forEach(function (k) {
      if (!curKeys[k]) { rejectedHunches.push({ hunch: k, reason: 'signal subsided across cycles (falsifier path)' }); delete hm[k]; return; }
      if (hm[k] >= 3) promotedToMonitoring.push({ target: k, basis: 'recurred ' + hm[k] + ' cycles', note: 'monitoring target ONLY — never evidence or diagnosis' });
    });

    var it = {
      version: 1, hunches: hunches.slice(0, 3), weakSignals: hunches.map(function (h) { return h.why; }),
      patternMatches: patternMatches.slice(0, 5), analogies: analogies.slice(0, 4), confidence: 'LOW', evidenceStatus: 'UNVERIFIED',
      promotedToDiagnosis: [],
      promotedToMonitoring: promotedToMonitoring.slice(0, 4), rejectedHunches: rejectedHunches.slice(0, 4), lastIntuitionAt: rm.updated || null
    };
    s.religionIntuition = it; return it;
  };

  // H5 — simulation / bounded counterfactual (hypothetical only)
  ReligionBrain.prototype._computeReligionSimulation = function () {
    var s = this.state, rm = s.religionModel || {};
    var base = typeof s.stress === 'number' ? s.stress : 0;
    function cl(v) { return Math.max(0, Math.min(1, Math.round(v * 1000) / 1000)); }
    var scenarios = [
      { type: 'secularization-acceleration', hypothetical: true, assumption: 'affiliation decline + TFR<2.1 across cohorts', simulatedStress: cl(base + 0.2), risk: 'SECULARIZATION_CRISIS', intervention: 'track Pew/ARDA affiliation-loss + youth disengagement', falsifier: 'affiliation stabilizes next cycle' },
      { type: 'institutional-crisis-escalation', hypothetical: true, assumption: 'scandal exposure + trust collapse', simulatedStress: cl(base + 0.25), risk: 'INSTITUTIONAL_ABUSE', intervention: 'monitor PRRI institutional-trust + accountability reporting', falsifier: 'trust indicators recover' },
      { type: 'interfaith-tension-spike', hypothetical: true, assumption: 'sectarian grievance amplification', simulatedStress: cl(base + 0.3), risk: 'SECTARIAN_CONFLICT', intervention: 'track USCIRF religious-freedom pressure + communal-violence reports', falsifier: 'tensions de-escalate' },
      { type: 'stabilize', hypothetical: true, assumption: 'stressor holds', simulatedStress: cl(base), risk: 'persistent elevated baseline', intervention: 'maintain monitoring cadence (Pew/ARDA/PRRI)', falsifier: 'stress moves materially' }
    ];
    var sim = {
      version: 1, scenarios: scenarios, assumptions: scenarios.map(function (x) { return x.assumption; }),
      simulatedStress: scenarios.map(function (x) { return x.simulatedStress; }),
      simulatedDiagnoses: ['SECULARIZATION_CRISIS', 'INSTITUTIONAL_ABUSE', 'SECTARIAN_CONFLICT'], simulatedOpportunities: [],
      risks: scenarios.map(function (x) { return x.risk; }), interventions: scenarios.map(function (x) { return x.intervention; }),
      falsifiers: scenarios.map(function (x) { return x.falsifier; }), lastSimulatedAt: rm.updated || null
    };
    s.religionSimulation = sim; return sim;
  };

  // H6 — executive self-report (compact status card)
  ReligionBrain.prototype._computeReligionExecutiveReport = function () {
    var s = this.state, rm = s.religionModel || {}, im = s.religionImmune || {}, aw = s.religionAwareness || {}, con = s.religionConscience || {}, it = s.religionIntuition || {}, sim = s.religionSimulation || {}, bs = this._religionDiagnosisStates();
    var covered = bs.filter(function (b) { return b.sourceBacked; }).length;
    var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var strongest = active[0] || (s.diagnoses || [])[0] || null;
    var pe = (rm.predictionError && rm.predictionError.total) || 0;
    var status = im.immuneState === 'alert' ? 'immune-alert' : covered < bs.length ? 'source-limited' : (rm.regulation && rm.regulation.starving) ? 'starving' : (rm.regulation && rm.regulation.state === 'surprised') ? 'surprised' : 'healthy';
    var rep = {
      version: 1, brainStatus: status,
      strongestDiagnosis: strongest ? strongest.id : null,
      strongestOpportunity: (s.opportunities && s.opportunities[0] && s.opportunities[0].title) || null,
      confidence: Math.round((1 - pe) * 100) / 100, predictionError: Math.round(pe * 1000) / 1000,
      regulationState: (rm.regulation && rm.regulation.state) || null, immuneState: im.immuneState || null,
      awarenessSummary: aw.selfNarrative || null, conscienceDecision: con.conscienceState || null,
      intuitionSummary: (it.hunches || []).length + ' hunch(es)', simulationSummary: (sim.scenarios || []).length + ' scenario(s)',
      artifactReadiness: con.artifactReadinessDecision || null, blockers: (con.blockedClaims || []).slice(0, 6),
      nextBestAction: covered < bs.length ? 'verify ARDA/Pew institutional data for uncovered diagnoses' : 'human-review external-source bundles on sectarian dynamics',
      lastReportAt: rm.updated || null
    };
    s.religionExecutiveReport = rep; return rep;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // ACTUATION LAYER (validity-gated; mirrors energy-brain, adapted to religion's REAL
  // effector = state.crossDomainEmissions). All deterministic; NO paid-AI, NO fetch-to-LLM
  // ever runs on the cycle. Every actuation is reversible by flipping its _actuation flag.
  // ════════════════════════════════════════════════════════════════════════════

  // SERVO (regulate-to-target E/I allostasis, Neuro Ref XIII.1/V.2/XII). Mirrors
  // _computeEnergyServo. SENSOR = excitatory drive (stress + how many conditions/diagnoses
  // fire at once) vs the recurrent loop's inhibition term. CONTROLLER = PI (fast proportional
  // + bounded slow integral, the HPA fast+slow arms). EFFECTOR = a proportional dampening
  // factor applied next cycle to cross-domain emission magnitude (one-cycle lag, like energy).
  // Religion has no K8 adaptive-baseline module, so the target tracks drive only (honest — no
  // deviation term is fabricated). Never rewrites stress/scoring/diagnoses/religion.json.
  ReligionBrain.prototype._computeReligionServo = function () {
    function R(x) { return Math.round(x * 1000) / 1000; }
    var s = this.state, rm = s.religionModel || {}, reg = rm.regulation || {};
    var stress = (typeof s.stress === 'number') ? s.stress : 0;
    var conds = Array.isArray(s._activeConditions) ? s._activeConditions.length : (Array.isArray(s.signals) ? s.signals.length : 0);
    var dxA = Array.isArray(s.diagnoses) ? s.diagnoses.filter(function (d) { return d && d.active; }).length : 0;
    var drive = Math.max(0, Math.min(2, stress + Math.min(conds, 12) / 24 + Math.min(dxA, 6) / 24));
    var inhibition = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;   // recurrent-loop inhibition term
    var FLOOR = 0.15;
    var target = Math.max(FLOOR, Math.min(1, Math.max(drive, FLOOR)));            // allostatic set-point: inhibition must track drive
    var error = target - inhibition;                                              // >0 => under-braked for the drive
    this._servoIntegral = Math.max(-0.5, Math.min(0.5, (this._servoIntegral || 0) + error * 0.15));
    var Kp = 0.8, Ki = 0.4;
    var correction = Math.max(0, Kp * error + Ki * Math.max(0, this._servoIntegral));   // only ADD braking; never disinhibit
    var emissionFactor = Math.max(0.2, Math.min(1, 1 - correction));             // effector the eiBrake consumes
    var state = error > 0.25 ? 'runaway-risk' : ((inhibition - target) > 0.4 ? 'over-inhibited' : 'balanced');
    var servo = {
      version: 1, actuated: true, drive: R(drive), inhibition: R(inhibition), target: R(target),
      error: R(error), integral: R(this._servoIntegral), emissionFactor: R(emissionFactor), state: state,
      note: 'closed-loop allostasis (Neuro Ref XIII.1/V.2/XII): drives inhibition toward a drive target; effector = proportional dampening of cross-domain emission. E/I SCALING RELATIONSHIP only (ms-simultaneity impossible on a discrete feed).'
    };
    s.religionServo = servo;
    if (s.cognition && typeof s.cognition === 'object') s.cognition.servo = servo;   // additive: new key only
    return servo;
  };

  // PHASE-COHERENCE ROUTER + TRANSITION SIGNAL — ADVISORY / OBSERVE-ONLY for religion.
  // Ported for parity + honest self-knowledge, but _actuation.phase = false so it NEVER
  // actuates (does not open the processing window, does not preempt credit assignment).
  // (A) router: couples to co-phased, stressed peers via the patent Loop-1 M matrix.
  // (B) transition: religion has NO Thing1-validated ground-truth reward label (audit
  //     impossibility #4) and a discrete feed has no continuous phase (#3), so any transition
  //     is labelled 'advisory-self-consistency' and never becomes a validated learning signal.
  // Per-cycle: append the domain's primary STRESS scalar (finalStress/stress; up=bad) to the
  // persistent series, cap at 60, persist, then run the Thing2 kernel over it to derive an
  // interpretive P0-P10 phase. Deterministic pure-math (no network/AI). On any failure or when
  // the adapter/history is unavailable, _kernelPhase is set to null and the caller falls back to
  // s.phase. seriesSource = STRESS (positive:false) because the scalar rises with distress.
  ReligionBrain.prototype._updatePhaseKernel = function () {
    var s = this.state;
    var scalar = (typeof s.finalStress === 'number') ? s.finalStress
               : (typeof s.stress === 'number') ? s.stress : null;
    try {
      if (scalar != null && isFinite(scalar)) {
        this._phaseSeries.push(scalar);
        while (this._phaseSeries.length > 60) this._phaseSeries.shift();
        try {
          if (typeof localStorage !== 'undefined' && localStorage) {
            localStorage.setItem('limen:phaseseries:religion', JSON.stringify(this._phaseSeries));
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

  ReligionBrain.prototype._computeReligionPhaseDynamics = function () {
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
    // P3/P7 family gate for phase-consistency tier — self-consistency, NOT external reward.
    var VALIDATED = { p3: 1, p7: 1, p7a: 1, p7b: 1 };
    var BREAKING = { p1: 1, p3: 1, p7: 1, p7a: 1, p7b: 1, p9: 1 };
    function norm(p) { if (p == null) return null; p = String(p).toLowerCase().replace(/[^a-z0-9]/g, ''); if (p.charAt(0) !== 'p') p = 'p' + p; return p; }
    // PREFER the Thing2 kernel phase (interpretive, from this domain's stress trajectory) for BOTH
    // the coherence router and the phase-transition self-consistency signal; fall back to s.phase when
    // the kernel is unavailable (adapter missing / history < 8 / error) — fallback path unchanged.
    var myPhase = norm(this._kernelPhase != null ? this._kernelPhase : s.phase);

    var doms = (typeof window !== 'undefined' && window.LIMENDomains) || {};
    var coupled = [], couplingStrength = 0;
    if (myPhase && PHASE_M[myPhase]) {
      var row = PHASE_M[myPhase];
      Object.keys(doms).forEach(function (k) {
        if (k === 'religion') return;
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

    var hist = this._religionPhaseHistory = this._religionPhaseHistory || [];
    var prev = hist.length ? hist[hist.length - 1].phase : null;
    // Non-external phase transition = self-consistency calibration (interpretive), NEVER reward.
    var transition = null;
    if (prev != null && myPhase != null && prev !== myPhase) {
      var rm = s.religionModel || {};
      var predictedUp = (typeof rm.predictedStress === 'number' && typeof s.stress === 'number') ? rm.predictedStress > s.stress : false;
      var wentUp = (BREAKING[myPhase] && !BREAKING[prev]) ? true : (BREAKING[prev] && !BREAKING[myPhase]) ? false : null;
      var hit = (wentUp !== null) ? (wentUp === !!predictedUp) : null;
      var validated = !!(VALIDATED[myPhase] || VALIDATED[prev]);
      transition = { from: prev, to: myPhase, predictedUp: !!predictedUp, wentUp: wentUp, hit: hit, validated: validated,
        kind: 'advisory-self-consistency', note: 'self-consistency calibration (interpretive); religion has NO Thing1-validated distress signal -> NEVER an external/true reward; advisory only, never actuated.' };
    }
    hist.push({ phase: myPhase, t: (s.religionModel && s.religionModel.updated) || Date.now() });
    if (hist.length > 24) hist.shift();

    var out = {
      version: 1, observeOnly: true, actuated: false, myPhase: myPhase,
      phaseSource: s.phaseSource || 'fallback',       // 'thing2-kernel' when the real kernel drove myPhase, else 'fallback'
      kernelTrajectory: s.kernelTrajectory || null,
      coupled: coupled.slice(0, 5), couplingStrength: Math.round(couplingStrength * 1000) / 1000, transition: transition,
      note: 'ADVISORY-ONLY: phase-coherence router + self-consistency transition. Phase source = Thing2 recursive kernel over the stress trajectory (interpretive) with s.phase fallback. NOT actuated (audit impossibilities #3 continuous-rhythm + #4 ground-truth-reward). Never opens the processing window or preempts credit.'
    };
    s.religionPhaseDynamics = out;
    if (s.cognition && typeof s.cognition === 'object') s.cognition.phaseDynamics = out;
    return out;
  };

  // EFFECTOR APPLICATION — override emitCrossDomainSignals: run the base rule engine, then
  // apply (behind flags) the E/I brake dampening (one-cycle-lagged servo emissionFactor) and
  // refractory de-dup to state.crossDomainEmissions. When all emission-relevant flags are off,
  // this is a pure pass-through (behaviour identical to before). Deterministic; no network.
  ReligionBrain.prototype.emitCrossDomainSignals = function () {
    var self = this;
    return Base.prototype.emitCrossDomainSignals.call(this).then(function () {
      try { self._regulateReligionEmissions(); } catch (e) {}
    });
  };

  ReligionBrain.prototype._regulateReligionEmissions = function () {
    var s = this.state;
    var ems = s.crossDomainEmissions || [];
    if (!ems.length) { s.religionEmissionRegulation = null; return; }
    var act = this._actuation || {};
    // E/I BRAKE: dampen magnitude by the PRIOR cycle's servo emissionFactor (one-cycle lag).
    var servo = s.religionServo || null;
    var factor = (act.eiBrake && servo && typeof servo.emissionFactor === 'number') ? servo.emissionFactor : 1;
    var now = Date.now(), P = this._refractoryParams || { absoluteWindow: 900000, relativeWindow: 3600000, overrideDelta: 0.10 };
    var rf = this._religionRefractory = this._religionRefractory || {};
    var kept = [], damped = 0, suppressed = 0;
    for (var i = 0; i < ems.length; i++) {
      var em = ems[i];
      if (act.eiBrake && factor < 1) { em.magnitude = Math.max(0, Math.min(1, (em.magnitude || 0) * factor)); em._eiDamped = true; damped++; }
      if (act.refractory) {
        var key = (em.targetDomain || '') + '|' + (em.signal || em.signalType || '');
        var prev = rf[key], mag = em.magnitude || 0;
        if (prev) {
          var age = now - prev.lastFire;
          if (age < P.absoluteWindow) { suppressed++; continue; }                                   // absolute dead-time
          if (age < P.relativeWindow && mag < (prev.lastMag || 0) + P.overrideDelta) { suppressed++; continue; }  // relative: only a stronger re-fire breaks through
        }
        rf[key] = { lastFire: now, lastMag: mag };
      }
      kept.push(em);
    }
    if (act.refractory) s.crossDomainEmissions = kept;
    s.religionEmissionRegulation = {
      version: 1, priorEmissionFactor: Math.round(factor * 1000) / 1000,
      eiDamped: damped, suppressedByRefractory: suppressed, kept: kept.length, total: ems.length,
      note: 'servo E/I dampening (one-cycle lag) + refractory de-dup on the cross-domain emission effector; reversible via _actuation.eiBrake / _actuation.refractory.'
    };
    if (s.cognition && typeof s.cognition === 'object') s.cognition.emissionRegulation = s.religionEmissionRegulation;
  };

  // SELF-AUDIT — CONSUME the domain connectivity graph (Neuro Ref XIV diaschisis / single-
  // point-of-failure). Religion.json carries a real 83-edge graph, so this is honest (not a
  // fabricated clone): it computes articulation nodes (SPOF) + degree hubs over the REAL graph,
  // the same way energy consumes its 81 edges via CA.singlePointsOfFailure. There is no
  // religion-connectivity-audit module, so the articulation-point search is implemented inline
  // (deterministic Tarjan DFS; the graph is tiny). OBSERVE-ONLY advisory — surfaces brittle
  // nodes each cycle; actuating them into the live brake is a separate operator-scoped step
  // (same discipline as energy, whose self-audit is also observe-only). No AI, no writes.
  ReligionBrain.prototype._computeReligionSelfAudit = function () {
    var self = this, s = this.state;
    // Prefer the already-cached portal (deriveDiagnoses fetched religion.json, which has `edges`);
    // else lazy-fetch once (browser fire-and-forget / server require), mirroring energy.
    var edges = (this._portalCache && Array.isArray(this._portalCache.edges) && this._portalCache.edges)
             || (s._rawDomain && Array.isArray(s._rawDomain.edges) && s._rawDomain.edges)
             || this._religionEdges || null;
    if (!edges) {
      if (typeof fetch === 'function' && !this._religionEdgesPromise) {
        this._religionEdgesPromise = fetch('/assets/data/domains/religion.json')
          .then(function (r) { return r.json(); })
          .then(function (j) { if (j && Array.isArray(j.edges)) self._religionEdges = j.edges; })
          .catch(function () {});
      } else if (typeof require === 'function') {
        try { var ed = require('../../data/domains/religion.json'); if (ed && Array.isArray(ed.edges)) { this._religionEdges = ed.edges; edges = ed.edges; } } catch (_e) {}
      }
    }
    if (!edges || !edges.length) {
      s.religionSelfAudit = { version: 1, observeOnly: true, consumed: false, note: edges ? 'no edges' : 'edges loading (async, next cycle)' };
      if (s.cognition && typeof s.cognition === 'object') s.cognition.selfAudit = s.religionSelfAudit;
      return s.religionSelfAudit;
    }
    // Undirected adjacency + degree.
    var adj = {}, deg = {};
    function ensure(n) { if (!adj[n]) { adj[n] = []; deg[n] = 0; } }
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i], a = e.source, b = e.target;
      if (a == null || b == null) continue;
      ensure(a); ensure(b);
      if (adj[a].indexOf(b) === -1) { adj[a].push(b); deg[a]++; }
      if (adj[b].indexOf(a) === -1) { adj[b].push(a); deg[b]++; }
    }
    var nodes = Object.keys(adj);
    // Articulation points (SPOF) — standard Tarjan DFS (graph is small).
    var visited = {}, disc = {}, low = {}, parent = {}, ap = {}, timer = { t: 0 };
    function dfs(u) {
      visited[u] = true; disc[u] = low[u] = ++timer.t; var children = 0, nb = adj[u];
      for (var k = 0; k < nb.length; k++) {
        var v = nb[k];
        if (!visited[v]) {
          children++; parent[v] = u; dfs(v);
          low[u] = Math.min(low[u], low[v]);
          if (parent[u] === undefined && children > 1) ap[u] = true;
          if (parent[u] !== undefined && low[v] >= disc[u]) ap[u] = true;
        } else if (v !== parent[u]) {
          low[u] = Math.min(low[u], disc[v]);
        }
      }
    }
    for (var n = 0; n < nodes.length; n++) { if (!visited[nodes[n]]) { parent[nodes[n]] = undefined; dfs(nodes[n]); } }
    var spof = Object.keys(ap);
    var hubs = nodes.map(function (x) { return { id: x, degree: deg[x] }; })
      .sort(function (a, b) { return b.degree - a.degree; }).slice(0, 5);
    var verdict = spof.length === 0 ? 'resilient (no single point of failure)' : spof.length <= 2 ? 'mostly-resilient' : 'brittle';
    s.religionSelfAudit = {
      version: 1, observeOnly: true, consumed: true, edgeCount: edges.length, nodeCount: nodes.length,
      spofCount: spof.length, spof: spof.slice(0, 8), topHubsByDegree: hubs, verdict: verdict,
      note: 'connectivity / single-point-of-failure self-audit over the REAL religion graph (Neuro Ref XIV diaschisis/SPOF). Observe-only advisory; not yet actuated into the brake (same discipline as energy).'
    };
    if (s.cognition && typeof s.cognition === 'object') s.cognition.selfAudit = s.religionSelfAudit;
    return s.religionSelfAudit;
  };

  // ── AI SLOT (operator-triggered ONLY; DELIBERATELY NEVER called from the 30s cycle) ──────
  // Generative node->business authoring + semantic source mapping are the genuine
  // "code-cannot-do-this" slots for religion. They are intentionally NOT wired into the
  // deterministic cycle (killswitch requirement: no paid-AI / fetch-to-LLM call may ever run
  // on a cycle). This is a documented NO-OP stub. When built it MUST: (a) run only on an
  // explicit operator action, (b) POST to a server endpoint that enforces
  // lib/ai-kill-switch spendDisabled(), and (c) carry NO API key in client code. Inert until then.
  ReligionBrain.prototype.authorReligionNodeBusinessDrafts = function () {
    return { ok: false, reason: 'ai-slot-not-wired',
      note: 'operator-triggered only; must route through a killswitch-gated server endpoint (lib/ai-kill-switch spendDisabled); never called from the cycle; no client-side API key' };
  };

  ReligionBrain.prototype._computeReligionHigherLayers = function () {
    this._computeReligionImmune();
    this._computeReligionAwareness();
    this._computeReligionConscience();
    this._computeReligionIntuition();
    this._computeReligionSimulation();
    this._computeReligionExecutiveReport();
  };

  // ════════════════════════════════════════════════════════════════════════════
  // RELIGION DomainDiagnosisPacket SCHEMA (8-section contract; schema-only — NEVER invents
  // data). Same shape as energy's _buildDomainDiagnosisPacket; domain='religion', lanes are
  // INVESTABLE/RESEARCHABLE only. Consumed by the console SELF-MODEL deserialization.
  // ════════════════════════════════════════════════════════════════════════════
  var RDDP_SCHEMA_VERSION = 'religion-ddp-1';
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

  // Canonical diagnosis resolution. Non-aliased diagnoses are canonical to themselves.
  // SECULARIZATION_CRISIS may alias to an institutional-decline corpus id if present.
  var RELIGION_DIAGNOSIS_ALIASES = {
    SECULARIZATION_CRISIS: { target: 'INSTITUTIONAL_DECLINE', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus may emit INSTITUTIONAL_DECLINE for secularization/disaffiliation dynamics' }
  };
  ReligionBrain.prototype._resolveCanonicalDiagnosis = function (dxId) {
    if (!dxId) return { canonicalDiagnosisId: null, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };
    var target = null;
    try {
      var idx = (typeof window !== 'undefined') ? window.LIMENArtifactSourceIndex : null;
      if (idx && typeof idx.aliases === 'function') { var row = idx.aliases()[dxId]; if (row && row.target) target = row.target; }
    } catch (e) {}
    var local = RELIGION_DIAGNOSIS_ALIASES[dxId] || null;
    if (!target && local) target = local.target;
    if (target) {
      return { canonicalDiagnosisId: target, aliasUsed: true, aliasReviewStatus: (local && local.reviewStatus) || 'corpus-aliased', aliasRisk: (local && local.risk) || 'low', aliasNote: (local && local.note) || null };
    }
    return { canonicalDiagnosisId: dxId, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };
  };

  ReligionBrain.prototype._buildDomainDiagnosisPacket = function (dx) {
    var s = this.state || {};
    var rm = s.religionModel || {};
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
    for (var fk in feeds) { if (feeds.hasOwnProperty(fk)) { var f = feeds[fk]; sourceFeeds.push({ name: (f && (f.name || f.label)) || fk, updated: (f && f.updated) || null, source: (f && f.source) || null }); } }

    var _canon = this._resolveCanonicalDiagnosis(dxId);
    var sourceBacked = !!(dx && (dx.matchedConditions || 0) > 0);
    var identity = {
      domain: 'religion',
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
    // No external artifact-source bundles exist for religion yet → bundleStatus honest 'missing'.
    var bundleStatus = 'missing';
    var bundleResolution = identity.aliasUsed ? 'alias-resolved-but-bundle-missing' : 'missing';
    var brainState = {
      religionModel: { version: rm.version || null, cycle: (typeof rm.cycle === 'number' ? rm.cycle : null) },
      predictionError: rm.predictionError || null,
      regulationState: (rm.regulation && rm.regulation.state) || null,
      prior: rm.prior || null,
      observation: rm.observation || null,
      plasticity: rm.plasticity || null,
      readyForHandoff: rm.readyForHandoff === true
    };
    var rootId = (portal && portal.domainId) || 'religion';
    var rootTitle = (portal && portal.title) || 'Religion';
    var ancestry = (portal && portal.parentLabel) ? [portal.parentLabel, rootTitle] : [rootTitle];
    var portalContext = {
      portalIds: [rootId],
      portalDomain: 'religion',
      portalTitle: rootTitle,
      depth: 0,
      ancestryPath: ancestry,
      portalStatus: portal ? 'root-only' : 'pending',
      sourceCompleteness: portal ? ((Array.isArray(portal.issues) && portal.issues.length) ? 'partial' : 'thin') : 'root-only',
      bundleSource: null,
      affiliationLayer: (s.affiliationLayer && s.affiliationLayer.loaded) ? { count: s.affiliationLayer.count, activeCount: s.affiliationLayer.activeCount } : null
    };
    // citation hints — REAL religion sources only (Pew/PRRI/ARDA/USCIRF/Gallup); never fabricated.
    var citationHints = sourceFeeds.map(function (sf) { return sf.source || sf.name; }).filter(Boolean)
      .filter(function (n) { return RELIGION_SOURCE_TOKENS.test(String(n).toLowerCase()); });
    var evidenceAnchors = []; // real Pew/ARDA/PRRI/USCIRF anchors only — empty until a real bundle exists
    var missingEv = [];
    if (!evidenceAnchors.length) missingEv.push('evidenceAnchors');
    if (!citationHints.length) missingEv.push('citationHints');
    var evidence = {
      sourceFeeds: sourceFeeds,
      evidenceAnchors: evidenceAnchors,
      citationHints: citationHints,
      bundleStatus: bundleStatus,
      bundleResolution: bundleResolution,
      bundle: null,
      sourceBacked: sourceBacked,
      missingEvidence: missingEv
    };
    var treatmentContext = {
      treatments: treatments,
      implementationSteps: implementationSteps,
      methodCandidates: [],         // religion is not an invention → no method/embodiment candidates
      mechanismCandidates: [],
      embodimentCandidates: [],
      figurePlaceholders: [],
      authoringIntake: []
    };
    var operatorContext = {
      targets: (mc && mc.target) ? [mc.target] : [],
      monitoring: (treatments.length && treatments[0].monitoring) ? treatments[0].monitoring : null,
      escalation: (treatments.length && treatments[0].escalation) ? treatments[0].escalation : null,
      invalidIf: mc ? (mc.invalidIf || null) : null,
      nextStep: mc ? (mc.nextStep || null) : null
    };
    var hasTreat = treatments.length > 0;
    var hasCanonical = !!identity.canonicalDiagnosisId;
    var blockers = [];
    if (hasCanonical && bundleStatus !== 'found') blockers.push(identity.aliasUsed ? 'canonical-id-resolved-but-bundle-missing' : 'no-source-bundle');
    blockers.push('source-bundle-build-required');
    blockers.push(portalContext.portalStatus === 'root-only' ? 'portal-root-only' : 'portal-not-loaded');
    if (!hasTreat) blockers.push('no-treatments');
    if (!primaryOpp) blockers.push('no-active-opportunity');
    if (!sourceBacked && dxId) blockers.push('unsourced-claim-needs-pew-arda-prri');
    // artifact lanes — INVESTABLE / RESEARCHABLE only
    var lanesIn = [];
    if (primaryOpp && primaryOpp.path) lanesIn.push(primaryOpp.path);
    if (primaryOpp && Array.isArray(primaryOpp.paths)) lanesIn = lanesIn.concat(primaryOpp.paths);
    if (primaryOpp && primaryOpp.compensation && primaryOpp.compensation.type) lanesIn.push(primaryOpp.compensation.type);
    var seenLane = {}, artifactLanes = [];
    for (var li = 0; li < lanesIn.length; li++) { if (lanesIn[li] && !seenLane[lanesIn[li]]) { seenLane[lanesIn[li]] = true; artifactLanes.push(lanesIn[li]); } }
    var readinessReasons = [];
    if (hasTreat) readinessReasons.push('treatments present (' + treatments.length + ')');
    if (primaryOpp) readinessReasons.push('opportunity present (path=' + (primaryOpp.path || '?') + ')');
    if (citationHints.length) readinessReasons.push('real religion-source citations present (' + citationHints.length + ')');
    var artifactContext = {
      artifactLanes: artifactLanes,
      patentReady: false, grantReady: false, sbaReady: false,   // patent/grant vetoed by H3 conscience (religion not an invention)
      investmentReady: !!(sourceBacked && primaryOpp), researchReady: !!(sourceBacked && (hasTreat || primaryOpp)),
      readinessReasons: readinessReasons,
      blockers: blockers
    };

    var comp = {
      identity:         _rddpCompleteness(identity, ['domain', 'diagnosisId', 'canonicalDiagnosisId', 'label', 'phase', 'confidence']),
      brainState:       _rddpCompleteness(brainState, ['religionModel', 'predictionError', 'regulationState', 'prior', 'observation', 'plasticity']),
      portalContext:    _rddpCompleteness(portalContext, ['portalIds', 'portalDomain', 'portalTitle', 'depth', 'ancestryPath']),
      evidence:         _rddpCompleteness(evidence, ['sourceFeeds', 'evidenceAnchors', 'citationHints']),
      treatmentContext: _rddpCompleteness(treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']),
      operatorContext:  _rddpCompleteness(operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']),
      artifactContext:  _rddpCompleteness(artifactContext, ['artifactLanes'])
    };
    var totHave = 0, totAll = 0;
    for (var sk in comp) { if (comp.hasOwnProperty(sk)) { totHave += comp[sk].have; totAll += comp[sk].total; } }
    var missingFields = [];
    function _rcm(name, obj, keys) { for (var i = 0; i < keys.length; i++) { if (!_rddpPresent(obj[keys[i]])) missingFields.push(name + '.' + keys[i]); } }
    _rcm('identity', identity, ['canonicalDiagnosisId', 'confidence']);
    _rcm('evidence', evidence, ['evidenceAnchors', 'citationHints']);
    _rcm('treatmentContext', treatmentContext, ['treatments', 'implementationSteps']);
    _rcm('operatorContext', operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']);

    var warnings = [];
    if (portalContext.portalStatus === 'root-only') warnings.push('portalContext is root-only (no deep portal cortex)');
    if (portalContext.portalStatus === 'pending') warnings.push('root portal not yet cached on the brain (domain identity used)');
    if (identity.aliasUsed) warnings.push('alias-resolved; verify source appropriateness');
    warnings.push('source bundle missing (no artifact-source bundle for religion diagnoses yet — Pew/ARDA/PRRI/USCIRF build-required)');
    if (!sourceBacked && dxId) warnings.push('unsourced religious-institutional claim — needs Pew/ARDA/PRRI verification before strong claims');
    warnings.push('religion is not a tangible invention — no method/embodiment/figure candidates (patent/grant vetoed)');
    if (!primaryOpp && (typeof s.stress !== 'number' || s.stress < RM_STRESS_FLOOR)) warnings.push('no active opportunity (offline/low-stress) — operator/lane fields stay empty');

    var pct = totAll ? Math.round(totHave / totAll * 100) : 0;
    var proofTier = pct >= 70 ? 'full' : (pct >= 35 ? 'partial' : 'sparse');

    var G2_CAPS = { evidenceAnchors: 8, treatments: 8, implementationSteps: 8, citationHints: 8, sourceFeeds: 8 };
    function _rg2cap(arr, n) { arr = Array.isArray(arr) ? arr : []; return { sel: arr.slice(0, n), omitted: Math.max(0, arr.length - n) }; }
    var _g2ea = _rg2cap(evidenceAnchors, G2_CAPS.evidenceAnchors);
    var _g2tr = _rg2cap(treatmentContext.treatments, G2_CAPS.treatments);
    var _g2is = _rg2cap(treatmentContext.implementationSteps, G2_CAPS.implementationSteps);
    var _g2ch = _rg2cap(citationHints, G2_CAPS.citationHints);
    var _g2sf = _rg2cap(sourceFeeds, G2_CAPS.sourceFeeds);
    var promptView = {
      compact: true,
      caps: G2_CAPS,
      selectedEvidenceAnchors: _g2ea.sel,
      selectedTreatments: _g2tr.sel,
      selectedImplementationSteps: _g2is.sel,
      selectedCitationHints: _g2ch.sel,
      selectedSourceFeeds: _g2sf.sel,
      omittedCounts: { evidenceAnchors: _g2ea.omitted, treatments: _g2tr.omitted, implementationSteps: _g2is.omitted, citationHints: _g2ch.omitted, sourceFeeds: _g2sf.omitted },
      priorityReasons: [
        'diagnosis-specific real-source anchors preferred over generic religion narrative',
        'official/primary sources retained (Pew/PRRI/ARDA/USCIRF/Gallup/WVS where present)',
        'indicator-based evidence only — no fabricated tickers or synthetic entities',
        'treatments with implementation relevance preferred over broad narrative',
        'caps applied per field; full data preserved in the full DDP'
      ],
      retainedWarnings: warnings
        .concat(s.religionImmune ? ['immune: ' + s.religionImmune.immuneState + ' (sev ' + s.religionImmune.severity + ', ' + (s.religionImmune.antigens || []).length + ' antigens)'] : [])
        .concat(s.religionConscience && s.religionConscience.conscienceState === 'restrictive' ? ['conscience: ' + (s.religionConscience.blockedClaims || []).slice(0, 3).join(', ') + ' blocked'] : []),
      retainedBlockers: artifactContext.blockers,
      immuneSummary: s.religionImmune ? { immuneState: s.religionImmune.immuneState, severity: s.religionImmune.severity, antigenCount: (s.religionImmune.antigens || []).length, quarantines: s.religionImmune.quarantines, blockedFromTraversal: s.religionImmune.blockedFromTraversal, allowedWithWarning: s.religionImmune.allowedWithWarning } : null,
      awarenessSummary: s.religionAwareness ? { selfNarrative: s.religionAwareness.selfNarrative, knowns: (s.religionAwareness.knowns || []).length, unknowns: (s.religionAwareness.unknowns || []).length, humanReviewRequired: s.religionAwareness.humanReviewRequired } : null,
      conscienceDecision: s.religionConscience ? { conscienceState: s.religionConscience.conscienceState, blockedClaims: s.religionConscience.blockedClaims, artifactReadinessDecision: s.religionConscience.artifactReadinessDecision } : null,
      intuitionSummary: s.religionIntuition ? s.religionIntuition.hunches : null,
      scenarioSummary: s.religionSimulation ? (s.religionSimulation.scenarios || []).map(function (x) { return { type: x.type, hypothetical: x.hypothetical, risk: x.risk }; }) : null,
      executiveReport: s.religionExecutiveReport || null,
      affiliationSummary: s.affiliationLayer && s.affiliationLayer.loaded ? { count: s.affiliationLayer.count, activeCount: s.affiliationLayer.activeCount, diagnoses: s.affiliationLayer.diagnoses, categories: s.affiliationLayer.categories, sources: s.affiliationLayer.sources, note: s.affiliationLayer.note } : (s.affiliationLayer ? { loaded: false, note: s.affiliationLayer.note } : null)
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
        immune: s.religionImmune || null,
        awareness: s.religionAwareness || null,
        conscience: s.religionConscience || null,
        intuition: s.religionIntuition || null,
        simulation: s.religionSimulation || null,
        executiveReport: s.religionExecutiveReport || null
      }
    };
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE K — RELIGION NEURO-COMPLETION LAYERS (religion-local, additive, reversible).
  // Ports energy-brain's K1-K8 stack, reading THIS domain's state/edges (affiliation %,
  // institutional trust, active diagnoses, the religion connectome) — NEVER energy/oil.
  //   K1 afferent integration, K2 neuromodulatory gain, K3 slow consolidation,
  //   K4 outcome / credit learning (TRUTH BRAKE: predicted-vs-next-realized stress),
  //   K5 deep-perception depth, K6 attention, K7 lateral inhibition, K8 homeostatic set-point.
  // ADVISORY BY DESIGN (mirrors energy's original PHASE-K contract): every layer COMPUTES and
  // EXPOSES its signal on state, but NONE rewires the existing scoring spine (stress, prior
  // update, opportunity output, portalError). Each carries a `wouldChange` naming the one
  // existing line that would close its loop, gated on operator approval. Reads cached state
  // only; adds NO network call and NO paid-AI call. Never fabricates evidence.
  // ════════════════════════════════════════════════════════════════════════════

  // K1 — afferent inter-brain integration. Surfaces the cross-domain pressure the peers
  // (culture/law/population/communication/governance) wrote via receiveExternalSignal, and the
  // stress delta the inherited scoreStress folded in. Religion uses the base scoreStress (no
  // override), which already folds getExternalPressure() into stress for every non-energy
  // domain — so this loop is CLOSED at the base, and K1 only reports it.
  ReligionBrain.prototype._computeReligionAfferent = function () {
    var s = this.state, rm = s.religionModel || {};
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
      externalPressure: Math.round(pressure * 1000) / 1000,       // base-capped
      receivedSignalCount: raw.length,
      activeSignalCount: active,
      contributors: contributors.slice(0, 6),
      integrated: true,
      appliedStressDelta: Math.round(((s._externalPressureApplied) || 0) * 1000) / 1000,
      wouldRaiseStressBy: Math.round(pressure * 1000) / 1000,
      note: 'CLOSED at base: the inherited scoreStress folds getExternalPressure() into stress each cycle (every non-energy domain). K1 reports the received cross-domain pressure and its applied delta.',
      lastAfferentAt: rm.updated || now
    };
    s.religionAfferent = af; return af;
  };

  // K2 — neuromodulatory gain application. rm.regulation.gain/inhibition/outputScale are
  // computed by _computeReligionRegulation; only gain reaches predictedStress (gainBlend).
  // This shows the graded output modulation outputScale WOULD apply to the opportunity list.
  // Religion has no _applyNeuroGating cap, so this stays ADVISORY (wouldChange names it).
  ReligionBrain.prototype._computeReligionGainControl = function () {
    var s = this.state, rm = s.religionModel || {}, reg = rm.regulation || {};
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
      appliedTargets: ['predictedStress (gain-blend)'],
      unappliedTargets: ['opportunity output', 'stress', 'treatment surfacing'],
      shadow: true,
      wouldChange: 'surfaceOpportunities — cap ranked output at wouldCapOpportunitiesAt',
      note: 'ADVISORY: gainBlend already modulates predictedStress; the outputScale cap on opportunities is NOT applied for religion (no _applyNeuroGating). Reversible/advisory only.',
      lastGainAt: rm.updated || Date.now()
    };
    s.religionGainControl = gc; return gc;
  };

  // K3 — slow consolidation / long-term plasticity. RM_SLOW_RATE was defined but only
  // "reserved for rebuild/cron". This maintains a PARALLEL slow-weight track that never
  // touches rm.prior; fast-vs-slow divergence is a real regime-shift indicator.
  ReligionBrain.prototype._consolidateReligionSlowModel = function () {
    var s = this.state, rm = s.religionModel || {}, obs = rm.observation || null;
    var slow = s.religionSlowModel || {
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
    slow.regimeShift = slow.fastSlowDivergence > 0.25;             // fast prior pulled far from slow baseline
    slow.updated = rm.updated || Date.now();
    s.religionSlowModel = slow; return slow;
  };

  // K4 — outcome / credit learning (TRUTH BRAKE). Compares each cycle's predictedStress
  // against the NEXT cycle's realized stress — the online forward self-prediction loop.
  // SELF-CONSISTENCY calibration ONLY: it learns whether the brain's OWN stress forecast
  // comes true. It is NOT an external/dopaminergic reward (that is a separate deferred task)
  // and is NOT yet fed back into learning here (advisory — wouldChange names the close).
  ReligionBrain.prototype._scoreReligionOutcomes = function () {
    var s = this.state, rm = s.religionModel || {};
    var buf = this._religionOutcomeBuffer = this._religionOutcomeBuffer || [];
    var obs = rm.observation || null;
    if (this._religionPrevPrediction != null && obs && typeof obs.stress === 'number') {
      buf.push({ predicted: this._religionPrevPrediction, realized: obs.stress, err: Math.abs(this._religionPrevPrediction - obs.stress) });
      if (buf.length > RK_OUTCOME_BUFFER) buf.shift();
    }
    this._religionPrevPrediction = (typeof rm.predictedStress === 'number') ? rm.predictedStress : null;   // stash for next-cycle reconciliation
    var n = buf.length, sumErr = 0, sumSq = 0, hits = 0;
    for (var i = 0; i < n; i++) { sumErr += buf[i].err; sumSq += buf[i].err * buf[i].err; if (buf[i].err <= 0.1) hits++; }
    var om = {
      version: 1,
      samples: n,
      meanRealizedError: n ? Math.round((sumErr / n) * 1000) / 1000 : null,     // does the forecast come true
      brierLike: n ? Math.round((sumSq / n) * 1000) / 1000 : null,
      callHitRate: n ? Math.round((hits / n) * 100) / 100 : null,               // fraction within 0.1 of realized
      loopType: 'online-continuous self-consistency (predicted-vs-next-realized stress); TRUTH BRAKE calibration, NOT an external reward',
      creditAssignmentActive: (n >= 5),
      feedsInto: '_updateReligionModel via window.LIMENK4.credit (stress-consistency tier) — scales the effective learning rate by (1 + (1 - credit))',
      note: 'SELF-CONSISTENCY calibration (interpretive): measures whether the brain\'s own stress forecast is realized. No dopaminergic/external reward is fabricated (isReward=false). Routed through the central K4 credit gate, which modulates the effective learning rate; falls back to the raw learning rate when the gate is absent.',
      lastOutcomeAt: rm.updated || Date.now()
    };
    s.religionOutcomeModel = om; return om;
  };

  // K5 — deep hierarchical perception. _computeReligionPredictionError hardcodes portalError=0
  // ("no live portal traversal yet"). This aggregates the depth the brain HAS from the already-
  // loaded root portal + affiliation-vitality sub-portal (no new fetches) and estimates the
  // portalError the recurrent model currently zeroes out.
  ReligionBrain.prototype._computeReligionPerceptionDepth = function () {
    var s = this.state, rm = s.religionModel || {};
    var portal = this._portalCache || s._portalCache || null;
    var aff = s.affiliationLayer || null;
    var bs = (typeof this._religionDiagnosisStates === 'function') ? this._religionDiagnosisStates() : [];
    var sourceBacked = 0, activeUnsourced = 0;
    for (var i = 0; i < bs.length; i++) { if (bs[i].sourceBacked) sourceBacked++; else if (bs[i].active) activeUnsourced++; }
    var affLoaded = !!(aff && aff.loaded);
    var affActive = affLoaded ? (aff.activeCount || 0) : 0;
    var levels = [
      { level: 'L0', name: 'root-portal', status: portal ? 'loaded' : 'pending' },
      { level: 'AFF', name: 'affiliation-vitality-subportal', status: affLoaded ? 'loaded' : 'absent', activeCount: affActive },
      { level: 'L2', name: 'deep-cortex', status: 'not-traversed', note: 'no external source bundle yet (Pew/ARDA/PRRI build-required)' }
    ];
    var loadedDepth = affLoaded ? 2 : (portal ? 1 : 0);
    var admissible = sourceBacked + affActive;
    var blocked = activeUnsourced + 1;                             // +1 for the un-traversed deep tier
    var portalErrorEstimate = Math.round((blocked / Math.max(1, admissible + blocked)) * 1000) / 1000;
    var pd = {
      version: 1, levels: levels, deepestUsableLevel: loadedDepth,
      portalErrorEstimate: portalErrorEstimate,
      wouldChange: '_computeReligionPredictionError — replace the hardcoded portalError=0 with portalErrorEstimate',
      note: 'ADVISORY: perception stops at the affiliation sub-portal; deep source bundles are build-required. No new fetches. Estimates the portalError the recurrent loop zeroes out.',
      lastDepthAt: rm.updated || Date.now()
    };
    s.religionPerceptionDepth = pd; return pd;
  };

  // K6 — attention / selective routing. Ranks top-down salience (active + relevance + novelty)
  // across the diagnoses and names focus vs suppressed, honoring operator attention steer if
  // present. Advisory: does not gate the pipeline (religion has no _applyNeuroGating).
  ReligionBrain.prototype._computeReligionAttention = function () {
    var s = this.state, rm = s.religionModel || {}, reg = rm.regulation || {};
    var pe = (rm.predictionError && rm.predictionError.total) || 0;
    var rb = (typeof this._readRequestBiases === 'function') ? this._readRequestBiases() : { attentionFocus: [] };
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
      wouldChange: 'surfaceOpportunities — boost opportunity rank for focused diagnoses',
      note: 'ADVISORY salience ranking; not applied to the opportunity pipeline (no _applyNeuroGating for religion).',
      lastAttentionAt: rm.updated || Date.now()
    };
    s.religionAttention = at; return at;
  };

  // K7 — lateral inhibition (microcircuit). rm.regulation.inhibition is computed and consumed
  // by the servo; this ALSO shows the winner-take-most ranking it implies among competing
  // active diagnoses (advisory; the non-winner down-weight is not applied to opportunities).
  ReligionBrain.prototype._computeReligionInhibition = function () {
    var s = this.state, rm = s.religionModel || {}, reg = rm.regulation || {};
    var inhib = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;
    var active = (s.diagnoses || []).filter(function (d) { return d.active; })
      .sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var winner = active[0] || null;
    var li = {
      version: 1, inhibitionStrength: inhib,
      winner: winner ? winner.id : null,
      competitors: active.slice(1).map(function (d) { return { id: d.id, relevance: d.relevance, suppressBy: Math.round((d.relevance || 0) * inhib * 1000) / 1000 }; }).slice(0, 6),
      wouldChange: 'surfaceOpportunities — down-weight non-winner diagnoses by suppressBy',
      note: 'ADVISORY winner-take-most; not applied to the opportunity pipeline for religion.',
      lastInhibitionAt: rm.updated || Date.now()
    };
    s.religionInhibition = li; return li;
  };

  // K8 — homeostatic set-point (microcircuit). Religion uses fixed constants
  // (RM_STRESS_FLOOR/RM_FLOOD_CAP) as set-points. This maintains an adaptive baseline
  // (Turrigiano-style synaptic scaling) alongside them, without replacing the fixed floor.
  // Exposes deviationFromBaseline that the servo COULD later consume as an allostatic term.
  ReligionBrain.prototype._computeReligionHomeostasis = function () {
    var s = this.state, rm = s.religionModel || {};
    var win = ((s.memory && s.memory.stressHistory) || []).slice(-RK_HOMEO_WINDOW);
    if (!win.length && s.memory && Array.isArray(s.memory.outcomeLog)) win = s.memory.outcomeLog.slice(-RK_HOMEO_WINDOW);
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
      wouldChange: 'readyForHandoff — gate on a blend of RM_STRESS_FLOOR and adaptiveBaseline; servo target += deviationFromBaseline',
      note: 'ADVISORY adaptive set-point alongside the fixed RM_STRESS_FLOOR. Reversible; does not replace the fixed floor.',
      lastHomeostasisAt: rm.updated || Date.now()
    };
    s.religionHomeostasis = hm; return hm;
  };

  // Assemble the neuro-completion surface (mirrors _computeReligionHigherLayers). Runs all
  // K-layers in energy's K1..K8 order, stores each on state (like religionImmune/etc.), and
  // attaches a compact roll-up to state.religionNeuro (folded into cognition.neuro upstream).
  ReligionBrain.prototype._computeReligionNeuroLayers = function () {
    this._computeReligionAfferent();          // K1 - afferent inter-brain input
    this._computeReligionGainControl();       // K2 - neuromodulatory gain application
    this._consolidateReligionSlowModel();     // K3 - slow consolidation / long-term plasticity
    this._scoreReligionOutcomes();            // K4 - outcome / credit learning (TRUTH BRAKE)
    this._computeReligionPerceptionDepth();   // K5 - deep hierarchical perception
    this._computeReligionAttention();         // K6 - attention / selective routing
    this._computeReligionInhibition();        // K7 - lateral inhibition (microcircuit)
    this._computeReligionHomeostasis();       // K8 - adaptive set-point (microcircuit)
    var s = this.state;
    var neuro = {
      version: 1,
      status: 'advisory',                     // all K-loops computed + exposed; none rewires the scoring spine (operator-gated closes)
      afferent: s.religionAfferent || null,
      gainControl: s.religionGainControl || null,
      slowModel: s.religionSlowModel || null,
      outcomeModel: s.religionOutcomeModel || null,
      perceptionDepth: s.religionPerceptionDepth || null,
      attention: s.religionAttention || null,
      inhibition: s.religionInhibition || null,
      homeostasis: s.religionHomeostasis || null,
      advisoryLoops: [
        'K1 afferent -> base scoreStress already folds externalPressure into stress',
        'K2 gain -> surfaceOpportunities (outputScale cap) [advisory]',
        'K3 slow-consolidation -> fast/slow divergence regime-shift readout',
        'K4 outcome -> _updateReligionModel via window.LIMENK4.credit (stress-consistency scales learning rate) [CLOSED; self-consistency, never reward]',
        'K5 portalError -> _computeReligionPredictionError (replace hardcoded 0) [advisory]',
        'K6 attention -> surfaceOpportunities (focus boost) [advisory]',
        'K7 inhibition -> surfaceOpportunities (non-winner down-weight) [advisory]',
        'K8 set-point -> readyForHandoff (blended adaptive floor) / servo target [advisory]'
      ]
    };
    s.religionNeuro = neuro;
    return neuro;
  };

  // ══════════════════════════════════════════════════════════════════════
  // INSTANTIATE AND REGISTER
  // ══════════════════════════════════════════════════════════════════════

  var brain = new ReligionBrain();
  brain.init();
  brain.start();
  window.LIMENReligionBrain = brain;
  window.LIMENDomainBrains.register(brain);

  // ══════════════════════════════════════════════════════════════════════
  // AUTO-LOAD RELIGION OPERATOR STACK ON DOMAIN-CONSOLE
  // ══════════════════════════════════════════════════════════════════════

  var _isDomainConsole = window.location.pathname.indexOf('domain-console') !== -1 || window.location.pathname.indexOf('religion-console') !== -1;
  var _domParam = (new URLSearchParams(window.location.search)).get('domain');
  var _isReligionDomain = _domParam === 'religion';
  if (_isDomainConsole && _isReligionDomain) {
    window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION = true;

    var _religionScripts = [
      'assets/js/religion-compensation.js',
      'assets/js/religion-claim-ledger.js',
      'assets/js/religion-claim-flow.js',
      'assets/js/religion-opportunity-economics.js',
      'assets/js/religion-pulse-engine.js',
      'assets/js/religion-operator-panel.js',
      'assets/js/religion-node-business-engine.js',
      'assets/js/religion-business-review.js',
      'assets/js/religion-execution-panels.js',
      'assets/js/religion-business-build.js',
      'assets/js/religion-directive-extractor.js',
      'assets/js/religion-directive-ranker.js',
      'assets/js/religion-directive-translator.js',
      'assets/js/religion-targeting-engine.js',
      'assets/js/religion-promotion-bridge.js',
      'assets/js/religion-clarity-operator.js'
    ];
    (function loadNext(i) {
      if (i >= _religionScripts.length) return;
      var s = document.createElement('script');
      s.src = _religionScripts[i];
      s.onload = function () { loadNext(i + 1); };
      s.onerror = function () { console.warn('[ReligionBrain] Failed to load ' + _religionScripts[i]); loadNext(i + 1); };
      document.head.appendChild(s);
    })(0);
  }
})();
