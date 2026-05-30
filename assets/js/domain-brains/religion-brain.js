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
      add({ title: dxLabel + ' — institutional governance and accountability systems', rank: stress * dx.relevance, path: 'GRANT-ELIGIBLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.50) add({ title: dxLabel + ' — trust restoration and transparency infrastructure', rank: stress * dx.relevance * 0.9, path: 'GRANT-ELIGIBLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      if (stress >= 0.55 && dx.relevance >= 0.2) add({ title: dxLabel + ' — community engagement and participation rebuild', rank: stress * 0.85, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      add({ title: dxLabel + ' — interfaith stabilization and mediation platform', rank: stress * dx.relevance * 0.75, path: 'GRANT-ELIGIBLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
    }

    var termCo = companies.filter(function (c) { return c.phase === 'p7a' || c.phase === 'p9'; });
    if (termCo.length > 0) add({ title: 'Religion terminal entity distressed positioning', rank: 0.95, path: 'INVESTABLE', urgency: 'high', source: 'company_terminal', tier: 1, companies: termCo.map(function (c) { return c.ticker; }), stress: stress });

    if (this.state.convergence && this.state.convergence.primary_signal) add({ title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — religion convergence response', rank: 0.98, path: 'GRANT-ELIGIBLE', urgency: 'high', source: 'convergence', tier: 1, stress: stress });

    // ═══ TIER 2 — CROSS-DOMAIN ═══
    var emissions = this.state.crossDomainEmissions || [];
    for (var ei = 0; ei < emissions.length; ei++) {
      var em = emissions[ei];
      add({ title: 'Religion \u2192 ' + (em.targetDomain || '').replace(/_/g, ' ') + ' — ' + (em.signal || em.signalType || '').replace(/_/g, ' '), rank: (em.magnitude || 0.5) * stress * 0.8, path: 'INVESTABLE', urgency: em.magnitude > 0.6 ? 'high' : 'medium', source: 'cross_domain', tier: 2, stress: stress });
    }

    // ═══ TIER 3 — LAGGING ═══
    if (stress >= 0.50) {
      add({ title: 'Faith-based community service infrastructure', rank: stress * 0.70, path: 'GRANT-ELIGIBLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'service_infra', stress: stress });
      add({ title: 'Reputational repair and institutional accountability systems', rank: stress * 0.65, path: 'GRANT-ELIGIBLE', urgency: stress > 0.70 ? 'medium' : 'watching', source: 'lagging', tier: 3, diagnosisId: 'accountability', stress: stress });
    }
    if (stress >= 0.60) {
      add({ title: 'Youth engagement and next-generation formation platforms', rank: stress * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'youth_engage', stress: stress });
      add({ title: 'De-radicalization and counter-extremism programs', rank: stress * 0.72, path: 'GRANT-ELIGIBLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'deradicalize', stress: stress });
      add({ title: 'Interfaith dialogue and peacebuilding infrastructure', rank: stress * 0.68, path: 'GRANT-ELIGIBLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'interfaith', stress: stress });
    }

    var nearDx = allDx.filter(function (d) { return !d.active && d.relevance > 0 && d.totalTriggers > 0; });
    for (var ndi = 0; ndi < nearDx.length; ndi++) {
      if (stress >= 0.45) add({ title: (nearDx[ndi].label || '').replace(/_/g, ' ') + ' — early-stage monitoring', rank: stress * (nearDx[ndi].relevance || 0.1) * 0.5, path: 'PATENTABLE', urgency: 'watching', source: 'near_diagnosis', tier: 2, stress: stress, nearDiagnosisId: nearDx[ndi].id });
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
      'GRANT-ELIGIBLE': { type: 'grant',  base: 10, unit: '%',        tier: 1, nextTier: { tier: 2, comp: 15, requirement: '3 successful grant awards' },     maxTier: { tier: 3, comp: 25 } },
      'INVESTABLE':     { type: 'invest', base: 5,  unit: 'profit%',  tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
      'PATENTABLE':     { type: 'patent', base: 10, unit: 'royalty%', tier: 1, nextTier: { tier: 2, comp: 15, requirement: '3 patents filed' },                maxTier: { tier: 3, comp: 25 } }
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
        else if (o.path === 'GRANT-ELIGIBLE' && pb.realWorld && pb.realWorld.apply) target = pb.realWorld.apply;
        else if (o.path === 'PATENTABLE' && pb.realWorld && pb.realWorld.build) target = pb.realWorld.build;
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
  ReligionBrain.prototype.cycle = function () { var self = this; return _origCycle.call(this).then(function () { return self.resolveDeepContent(); }); };

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
