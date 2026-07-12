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
    Base.call(this, {
      domainId: 'religion',
      label: 'Religion',
      snapshotKey: 'religion',
      cycleInterval: 30000
    });
  }

  ReligionBrain.prototype = Object.create(Base.prototype);
  ReligionBrain.prototype.constructor = ReligionBrain;

  // ══════════════════════════════════════════════════════════════════════
  // INIT — register diagnosis index and emission rules
  // ══════════════════════════════════════════════════════════════════════

  ReligionBrain.prototype.init = function () {
    Base.prototype.init.call(this);

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

    // Stress-derived conditions — tiered activation
    if (this.state.stress >= 0.30) {
      this._activeConditions.push('community_disengagement');
      this._activeConditions.push('declining_legitimacy');
    }
    if (this.state.stress >= 0.45) {
      this._activeConditions.push('attendance_contraction');
      this._activeConditions.push('youth_disengagement');
    }
    if (this.state.stress >= 0.55) {
      this._activeConditions.push('authority_erosion');
      this._activeConditions.push('religion_high_stress');
    }
    if (this.state.stress >= 0.65) {
      this._activeConditions.push('polarizing_rhetoric');
      this._activeConditions.push('grievance_amplification');
    }
    if (this.state.maturity === 'STRUCTURAL') this._activeConditions.push('structural_stress');

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
      return self.state.religionModel;
    });
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
    var nextPrior = this._updateReligionPrior(priorIn, obs, rm.plasticity.learningRate);

    rm.cycle += 1;
    rm.observation = obs;
    rm.predictionError = pe;
    rm.predictedStress = predictedStress;
    rm.regulation = reg;
    rm.readyForHandoff = readyForHandoff;
    rm.prior = nextPrior;
    rm.updated = obs.timestamp;
    this.state.religionModel = rm;

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
    vetoes.push({ claim: 'patent/grant', reason: 'religion is not a tangible invention — no method/mechanism/embodiment/figure candidate fields exist' });
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
