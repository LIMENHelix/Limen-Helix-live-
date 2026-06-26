/**
 * medicine-brain.js — Medicine & Health Domain Cognitive Engine
 *
 * Extends DomainBrainBase. Same architecture as trade-brain.js / infrastructure-brain.js.
 *
 * Diagnosis matching: maps live signal conditions to medicine portal issues
 *   CARE_ACCESS_FAILURE → access_gap, provider_shortage, affordability_barrier, geographic_desert, delayed_care
 *   CHRONIC_DISEASE_LOAD → metabolic_burden, cardiovascular_strain, diabetes_escalation, chronic_deterioration, treatment_demand
 *   CLINICAL_COORDINATION_BREAKDOWN → fragmented_pathway, referral_leakage, discharge_failure, interoperability_gap, multi_provider_gap
 *   THERAPEUTIC_RELIABILITY_RISK → treatment_inconsistency, evidence_lag, diagnostic_uncertainty, trial_gap, quality_variation
 *
 * Cross-domain emissions:
 *   medicine → population (health burden and care-capacity pressure)
 *   medicine → research (translational evidence and therapeutic reliability pressure)
 *   medicine → technology (diagnostic / interoperability / monitoring demand)
 *   medicine → governance (care-access and system-legitimacy pressure)
 *   medicine → economy (workforce-health and cost-burden pressure)
 *
 * Exposes: window.LIMENHealthBrain
 */
(function () {
  'use strict';

  if (!window.LIMENDomainBrainBase) {
    console.warn('[MedicineBrain] DomainBrainBase not loaded');
    return;
  }

  var Base = window.LIMENDomainBrainBase;

  function MedicineBrain() {
    Base.call(this, {
      domainId: 'health',
      label: 'Medicine & Health',
      snapshotKey: 'health',
      portalKey: 'medicine',
      cycleInterval: 30000
    });
  }

  MedicineBrain.prototype = Object.create(Base.prototype);
  MedicineBrain.prototype.constructor = MedicineBrain;

  // ══════════════════════════════════════════════════════════════════════
  // INIT — register diagnosis index and emission rules
  // ══════════════════════════════════════════════════════════════════════

  MedicineBrain.prototype.init = function () {
    Base.prototype.init.call(this);

    // Keys match medicine portal issue IDs
    this.diagnosisIndex = {
      'CARE_ACCESS_FAILURE': [
        'access_gap', 'provider_shortage', 'affordability_barrier',
        'geographic_desert', 'delayed_care', 'care_deferral',
        'health_high_stress', 'structural_stress'
      ],
      'CHRONIC_DISEASE_LOAD': [
        'metabolic_burden', 'cardiovascular_strain', 'diabetes_escalation',
        'chronic_deterioration', 'treatment_demand', 'obesity_escalation',
        'prevention_failure', 'health_high_stress'
      ],
      'CLINICAL_COORDINATION_BREAKDOWN': [
        'fragmented_pathway', 'referral_leakage', 'discharge_failure',
        'interoperability_gap', 'multi_provider_gap', 'handoff_failure',
        'care_fragmentation', 'structural_stress'
      ],
      'THERAPEUTIC_RELIABILITY_RISK': [
        'treatment_inconsistency', 'evidence_lag', 'diagnostic_uncertainty',
        'trial_gap', 'quality_variation', 'adverse_event_spike',
        'recall_pressure', 'efficacy_concern'
      ],
      // Portal-declared crisis diagnoses (2026-05-25 binding fix). Conditions
      // are drawn ONLY from medicine's producible _activeConditions so each
      // genuinely fires (not just binds). MENTAL_HEALTH_CRISIS intentionally
      // omitted pending a dedicated mental-health condition producer.
      'PANDEMIC':            ['global_epidemic_signal', 'public_health_alert', 'prevention_failure', 'health_high_stress'],
      'DRUG_RESISTANCE':     ['efficacy_concern', 'treatment_inconsistency', 'evidence_lag', 'adverse_event_spike'],
      'HEALTHCARE_COLLAPSE': ['health_high_stress', 'care_fragmentation', 'provider_shortage', 'care_deferral'],
      'MALPRACTICE_CRISIS':  ['quality_variation', 'diagnostic_uncertainty', 'adverse_event_spike', 'recall_pressure'],
      'SUPPLY_SHORTAGE':     ['drug_shortage', 'recall_pressure', 'access_gap']
    };

    // Cross-domain emissions — GATED: require at least 1 active diagnosis
    this.emissionRules = [
      {
        targetDomain: 'population',
        signalType: 'health_burden_pressure',
        condition: function (s) { return s.stress >= 0.50 && s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); }
      },
      {
        targetDomain: 'research',
        signalType: 'translational_evidence_demand',
        condition: function (s) { return s.stress >= 0.45 && s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); }
      },
      {
        targetDomain: 'technology',
        signalType: 'diagnostic_interop_demand',
        condition: function (s) { return s.stress >= 0.50 && s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.4); }
      },
      {
        targetDomain: 'governance',
        signalType: 'care_access_legitimacy_pressure',
        condition: function (s) { return s.stress >= 0.55 && s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); }
      },
      {
        targetDomain: 'economy',
        signalType: 'workforce_health_cost_burden',
        condition: function (s) { return s.stress >= 0.55 && s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.4); }
      }
    ];

    // C6-followup: load real healthcare entities from command-board-data once, and
    // load real source bundles once. Both guarded (no breakage on fetch failure).
    try { this._loadHealthCommandBoardCompanies(); } catch (e) {}
    try { this._loadDiagnosisBundles(); } catch (e) {}
    try { this._loadClinicalPipelineDiagnoses(); } catch (e) {}
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 2: Normalize signals into medicine-native semantics
  // ══════════════════════════════════════════════════════════════════════

  MedicineBrain.prototype.normalizeSignals = function () {
    var signals = [];
    var rawSignals = (this._rawDomain && this._rawDomain.signals) || [];

    for (var i = 0; i < rawSignals.length; i++) {
      signals.push(rawSignals[i]);
    }

    this._activeConditions = [];

    // Check feed values for medicine-specific triggers
    var feeds = this.state.feeds;
    for (var fi = 0; fi < feeds.length; fi++) {
      var f = feeds[fi];

      // openFDA adverse event volume
      if (f.name && f.name.indexOf('FDA Events') !== -1) {
        if (f.value > 20000000) {
          this._activeConditions.push('adverse_event_spike');
          signals.push('ELEVATED: FDA adverse event volume high — drug safety signal');
        }
        if (f.value > 22000000) {
          this._activeConditions.push('efficacy_concern');
          signals.push('CRITICAL: Adverse event volume surging — therapeutic reliability pressure');
        }
        // Adverse events always indicate some treatment demand
        if (f.value > 15000000) {
          this._activeConditions.push('treatment_demand');
        }
      }

      // openFDA recall volume (30-day window)
      if (f.name && f.name.indexOf('FDA Recalls') !== -1) {
        if (f.value > 10) {
          this._activeConditions.push('recall_pressure');
          signals.push('ELEVATED: ' + f.value + ' drug recalls in 30d — quality variation signal');
        }
        if (f.value > 25) {
          this._activeConditions.push('quality_variation');
          this._activeConditions.push('treatment_inconsistency');
          signals.push('CRITICAL: High recall volume — treatment reliability under pressure');
        }
        if (f.value > 40) {
          this._activeConditions.push('evidence_lag');
        }
      }

      // ── Medicine feed expansion pattern matches ──

      // CDC MMWR — public health surveillance / outbreak alerts (RSS, ~10-30 items)
      if (f.name === 'CDC MMWR' && f.value >= 5) {
        this._activeConditions.push('public_health_alert');
        this._activeConditions.push('care_fragmentation');
        signals.push('ELEVATED: CDC public health activity (' + f.value + ' MMWR items)');
      }

      // WHO Disease Outbreak News — global epidemic tracking (RSS, ~5-20 items)
      if (f.name === 'WHO Disease Outbreak' && f.value >= 3) {
        this._activeConditions.push('global_epidemic_signal');
        this._activeConditions.push('access_gap');
        signals.push('ELEVATED: WHO outbreak activity (' + f.value + ' items)');
      }

      // FDA Drug Shortages — pharmaceutical supply pressure (FDA API, can be 100-300)
      if (f.name === 'FDA Drug Shortages' && f.value >= 50) {
        this._activeConditions.push('drug_shortage');
        this._activeConditions.push('treatment_demand');
        signals.push('ELEVATED: ' + f.value + ' active drug shortages — supply pressure');
      }
      if (f.name === 'FDA Drug Shortages' && f.value >= 150) {
        this._activeConditions.push('access_gap');
        this._activeConditions.push('care_fragmentation');
        signals.push('CRITICAL: Severe drug shortage volume — patient access risk');
      }

      // ClinicalTrials.gov — clinical R&D pulse (API, ~1000-10000 updates / 30d)
      if (f.name === 'ClinicalTrials.gov' && f.value >= 500) {
        // High clinical trial activity is healthy R&D, not a stress signal
        // but it does confirm pharma R&D infrastructure is active
        signals.push('Active clinical research: ' + f.value + ' trial updates in 30d');
      }
      if (f.name === 'ClinicalTrials.gov' && f.value < 200 && f.value > 0) {
        // Unusually low clinical trial activity may indicate R&D pipeline drought
        this._activeConditions.push('evidence_lag');
        signals.push('REDUCED: Clinical trial activity at ' + f.value + ' (30d) — R&D pipeline drought signal');
      }

      // ── INSTITUTIONAL FEED-DERIVED CONDITIONS (research feeds + Federal Register) ──
      // Distinct collection methodologies — biomedical literature + research integrity
      // + funding flows + regulatory volume.
      var fn = (f.name || '').toLowerCase();

      // PubMed — biomedical literature volume → trial_gap / evidence_lag
      if (fn.indexOf('pubmed') !== -1 && f.value !== undefined && f.value < 100) {
        this._activeConditions.push('evidence_lag');
        this._activeConditions.push('trial_gap');
        signals.push('PubMed: only ' + f.value + ' recent articles — literature drought');
      }
      if (fn.indexOf('pubmed') !== -1 && f.value !== undefined && f.value >= 1000) {
        signals.push('PubMed: ' + f.value + ' recent articles — active research base');
      }

      // NIH Grants — research funding flow → THERAPEUTIC_RELIABILITY_RISK if low
      if (fn.indexOf('nih grants') !== -1 && f.value !== undefined && f.value < 10) {
        this._activeConditions.push('evidence_lag');
        signals.push('NIH Grants: ' + f.value + ' recent (low) — funding constraint');
      }
      if (fn.indexOf('nih grants') !== -1 && f.value !== undefined && f.value >= 50) {
        signals.push('NIH Grants: ' + f.value + ' recent — strong research funding flow');
      }

      // Retraction Watch — research integrity → diagnostic_uncertainty / quality_variation
      if (fn.indexOf('retraction watch') !== -1 && f.value !== undefined && f.value >= 5) {
        this._activeConditions.push('diagnostic_uncertainty');
        signals.push('Retraction Watch: ' + f.value + ' retraction articles — evidence integrity stress');
      }
      if (fn.indexOf('retraction watch') !== -1 && f.value !== undefined && f.value >= 15) {
        this._activeConditions.push('quality_variation');
        this._activeConditions.push('treatment_inconsistency');
      }

      // Fed Reg HHS — broad health regulatory → CARE_ACCESS_FAILURE
      if (fn.indexOf('fed reg hhs') !== -1 && f.value !== undefined && f.value >= 5) {
        this._activeConditions.push('access_gap');
        signals.push('Fed Reg HHS: ' + f.value + ' regulatory docs (30d)');
      }
      if (fn.indexOf('fed reg hhs') !== -1 && f.value !== undefined && f.value >= 10) {
        this._activeConditions.push('affordability_barrier');
        this._activeConditions.push('health_high_stress');
      }

      // Fed Reg CDC — public health regulatory → CHRONIC_DISEASE_LOAD signals
      if (fn.indexOf('fed reg cdc') !== -1 && f.value !== undefined && f.value >= 3) {
        this._activeConditions.push('prevention_failure');
        signals.push('Fed Reg CDC: ' + f.value + ' regulatory docs (30d)');
      }
      if (fn.indexOf('fed reg cdc') !== -1 && f.value !== undefined && f.value >= 6) {
        this._activeConditions.push('chronic_deterioration');
      }

      // Fed Reg CMS — Medicare/Medicaid regulatory → CARE_ACCESS_FAILURE
      if (fn.indexOf('fed reg cms') !== -1 && f.value !== undefined && f.value >= 5) {
        this._activeConditions.push('affordability_barrier');
        this._activeConditions.push('care_deferral');
        signals.push('Fed Reg CMS: ' + f.value + ' Medicare/Medicaid docs (30d)');
      }
      if (fn.indexOf('fed reg cms') !== -1 && f.value !== undefined && f.value >= 10) {
        this._activeConditions.push('delayed_care');
        this._activeConditions.push('provider_shortage');
      }

      // Fed Reg NIH — research regulatory → THERAPEUTIC_RELIABILITY_RISK / evidence
      if (fn.indexOf('fed reg nih') !== -1 && f.value !== undefined && f.value >= 3) {
        this._activeConditions.push('evidence_lag');
        signals.push('Fed Reg NIH: ' + f.value + ' regulatory docs (30d)');
      }

      // Fed Reg FDA — drug/device regulatory → THERAPEUTIC_RELIABILITY_RISK
      if (fn.indexOf('fed reg fda') !== -1 && f.value !== undefined && f.value >= 5) {
        this._activeConditions.push('recall_pressure');
        signals.push('Fed Reg FDA: ' + f.value + ' regulatory docs (30d)');
      }
      if (fn.indexOf('fed reg fda') !== -1 && f.value !== undefined && f.value >= 10) {
        this._activeConditions.push('quality_variation');
        this._activeConditions.push('adverse_event_spike');
      }

      // FDA Recalls (RSS XML — distinct from openFDA Recalls API)
      if (fn === 'fda recalls' && f.value !== undefined && f.value >= 5) {
        this._activeConditions.push('recall_pressure');
        signals.push('FDA Recalls (RSS): ' + f.value + ' recall items');
      }
      if (fn === 'fda recalls' && f.value !== undefined && f.value >= 15) {
        this._activeConditions.push('quality_variation');
      }
    }

    // Check for cross-domain signals affecting health
    var snap = this._getSnapshot();
    var EVENT_TTL = 30 * 60 * 1000;
    if (snap && snap.defenseSignals) {
      var now = Date.now();
      for (var si = 0; si < snap.defenseSignals.length; si++) {
        var sig = snap.defenseSignals[si];
        var sigAge = sig.timestamp ? (now - new Date(sig.timestamp).getTime()) : Infinity;
        if (sigAge > EVENT_TTL) continue;
        if (sig.affectedDomains && (sig.affectedDomains.indexOf('health') !== -1 || sig.affectedDomains.indexOf('medicine') !== -1)) {
          this._activeConditions.push(sig.eventType);
          if (sig.eventType === 'PANDEMIC' || sig.eventType === 'PUBLIC_HEALTH_EMERGENCY') {
            this._activeConditions.push('access_gap');
            this._activeConditions.push('provider_shortage');
            this._activeConditions.push('care_fragmentation');
          }
        }
      }
    }

    // Check macro shock
    if (snap && snap.macroShock && snap.macroShock.detected) {
      this._activeConditions.push('affordability_barrier');
      this._activeConditions.push('care_deferral');
    }

    // Baseline conditions — always present when feeds are live
    // These ensure the regulation playbook populates even at low stress
    if (feeds.length > 0) {
      this._activeConditions.push('treatment_demand');
      this._activeConditions.push('chronic_deterioration');
    }
    if (this.state.stress >= 0.15) {
      this._activeConditions.push('care_deferral');
      this._activeConditions.push('quality_variation');
    }
    if (this.state.stress >= 0.30) {
      this._activeConditions.push('metabolic_burden');
      this._activeConditions.push('diagnostic_uncertainty');
      this._activeConditions.push('delayed_care');
    }
    if (this.state.stress >= 0.45) {
      this._activeConditions.push('fragmented_pathway');
      this._activeConditions.push('evidence_lag');
    }

    // Stress-derived flags — _stress_ prefix prevents evidence family bypass
    if (this.state.stress >= 0.65) this._activeConditions.push('_stress_health_high');
    if (this.state.maturity === 'STRUCTURAL') this._activeConditions.push('_stress_structural');

    // Cross-domain pressure (from other brains via inter-brain bus)
    var extPressure = this.getExternalPressure ? this.getExternalPressure() : 0;
    if (extPressure >= 0.10) {
      this._activeConditions.push('delayed_care');
    }
    if (extPressure >= 0.20) {
      this._activeConditions.push('fragmented_pathway');
    }

    // Population pressure → chronic disease load
    if (this._externalSignals) {
      for (var ei = 0; ei < this._externalSignals.length; ei++) {
        var ext = this._externalSignals[ei];
        if (ext.source === 'population' && ext.magnitude >= 0.3) {
          this._activeConditions.push('metabolic_burden');
          this._activeConditions.push('chronic_deterioration');
        }
        if (ext.source === 'economy' && ext.magnitude >= 0.3) {
          this._activeConditions.push('affordability_barrier');
          this._activeConditions.push('care_deferral');
        }
        if (ext.source === 'governance' && ext.magnitude >= 0.3) {
          this._activeConditions.push('interoperability_gap');
        }
      }
    }

    this.state.signals = signals;
    return Promise.resolve();
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 4: Derive diagnoses — condition-matched from portal
  // ══════════════════════════════════════════════════════════════════════

  MedicineBrain.prototype.deriveDiagnoses = function () {
    var self = this;
    return this._getPortalContent().then(function (portal) {
      if (!portal) return;

      var issues = portal.issues || [];
      var conditions = self._activeConditions || [];

      self.state.diagnoses = issues.map(function (iss) {
        var triggers = self.diagnosisIndex[iss.id] || [];
        var matchCount = 0;
        for (var t = 0; t < triggers.length; t++) {
          for (var c = 0; c < conditions.length; c++) {
            if (conditions[c] === triggers[t] || conditions[c].indexOf(triggers[t]) !== -1) {
              matchCount++;
            }
          }
        }

        var active = matchCount > 0;
        var relevance = triggers.length > 0 ? matchCount / triggers.length : 0;

        return {
          id: iss.id,
          label: iss.label,
          summary: iss.summary || '',
          active: active,
          relevance: Math.round(relevance * 100) / 100,
          matchedConditions: matchCount,
          totalTriggers: triggers.length,
          circuits: iss.circuits || [],
          source: 'canonical'
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

  MedicineBrain.prototype.recommendTreatments = function () {
    var self = this;
    return this._getPortalContent().then(function (portal) {
      if (!portal) return;

      var activeDx = self.state.diagnoses.filter(function (d) { return d.active; });
      if (activeDx.length === 0) {
        self.state.treatments = [];
        return;
      }

      var activeNodeIds = {};
      for (var di = 0; di < activeDx.length; di++) {
        var circuits = activeDx[di].circuits || [];
        for (var ci = 0; ci < circuits.length; ci++) {
          activeNodeIds[circuits[ci].nodeId] = activeDx[di].id;
        }
      }

      var treatments = [];
      var activations = portal.activations || [];
      for (var ai = 0; ai < activations.length; ai++) {
        var act = activations[ai];
        var nodeId = act.brainNodeId;
        if (!activeNodeIds[nodeId]) continue;

        var actTreats = act.treatments || [];
        for (var ti = 0; ti < actTreats.length; ti++) {
          var t = actTreats[ti];
          treatments.push({
            id: 'treat_' + nodeId + '_' + ti,
            label: t.label,
            type: t.type,
            evidence: t.evidence,
            description: t.description || '',
            diagnosisId: activeNodeIds[nodeId],
            nodeId: nodeId,
            relevance: 1.0,
            source: 'canonical'
          });
        }
      }

      var evidenceRank = { A: 10, 'Strong': 10, B: 7, 'Moderate': 7, C: 4, 'Emerging': 1 };
      treatments.sort(function (a, b) {
        return (evidenceRank[b.evidence] || 0) - (evidenceRank[a.evidence] || 0);
      });

      self.state.treatments = treatments;
    });
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 6: Surface opportunities with capital classification
  // ══════════════════════════════════════════════════════════════════════

  MedicineBrain.prototype.surfaceOpportunities = function () {
    Base.prototype.surfaceOpportunities.call(this);

    // C6-followup: if the server snapshot starved state.companies, fall back to the
    // real healthcare entities loaded once from command-board-data (guarded, additive).
    if ((!this.state.companies || this.state.companies.length === 0) &&
        this._cbHealthCompanies && this._cbHealthCompanies.length > 0) {
      this.state.companies = this._cbHealthCompanies;
    }

    var opps = [];
    var stress = this.state.stress;
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; });
    var allDx = this.state.diagnoses || [];
    var companies = this.state.companies;
    var seen = {};

    function add(o) {
      var key = o.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seen[key]) return;
      seen[key] = true;
      opps.push(o);
    }

    // ═══ TIER 1 — DIRECT (diagnosis-driven) ═══
    for (var di = 0; di < activeDx.length; di++) {
      var dx = activeDx[di];
      var dxLabel = (dx.label || dx.id || '').replace(/_/g, ' ');

      // Care delivery infrastructure
      if (dx.id === 'CARE_ACCESS_FAILURE') {
        add({
          title: 'Care access infrastructure — expand provider reach and reduce geographic gaps',
          rank: stress * dx.relevance,
          path: 'INVESTABLE',
          urgency: stress > 0.70 ? 'high' : 'medium',
          source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
        });
        add({
          title: 'Affordability barrier reduction — value-based care and payment model reform',
          rank: stress * dx.relevance * 0.9,
          path: 'INVESTABLE',
          urgency: stress > 0.65 ? 'high' : 'medium',
          source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
        });
        if (stress >= 0.50) {
          add({
            title: 'Telehealth and remote care platform expansion',
            rank: stress * dx.relevance * 0.85,
            path: 'RESEARCHABLE',
            urgency: 'medium',
            source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
          });
        }
      }

      // Chronic disease management
      if (dx.id === 'CHRONIC_DISEASE_LOAD') {
        add({
          title: 'Chronic disease management systems — metabolic and cardiovascular monitoring',
          rank: stress * dx.relevance,
          path: 'INVESTABLE',
          urgency: stress > 0.70 ? 'high' : 'medium',
          source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
        });
        add({
          title: 'Prevention system strengthening — population-level chronic disease intervention',
          rank: stress * dx.relevance * 0.9,
          path: 'INVESTABLE',
          urgency: 'medium',
          source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
        });
        if (stress >= 0.50) {
          add({
            title: 'Remote patient monitoring and adherence support platforms',
            rank: stress * dx.relevance * 0.8,
            path: 'RESEARCHABLE',
            urgency: 'medium',
            source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
          });
        }
      }

      // Clinical coordination
      if (dx.id === 'CLINICAL_COORDINATION_BREAKDOWN') {
        add({
          title: 'Clinical coordination platforms — care pathway interoperability',
          rank: stress * dx.relevance,
          path: 'RESEARCHABLE',
          urgency: stress > 0.70 ? 'high' : 'medium',
          source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
        });
        add({
          title: 'Referral continuity and handoff failure reduction systems',
          rank: stress * dx.relevance * 0.9,
          path: 'INVESTABLE',
          urgency: 'medium',
          source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
        });
        if (stress >= 0.55) {
          add({
            title: 'Health information exchange and multi-provider coordination infrastructure',
            rank: stress * dx.relevance * 0.85,
            path: 'INVESTABLE',
            urgency: 'medium',
            source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
          });
        }
      }

      // Therapeutic reliability
      if (dx.id === 'THERAPEUTIC_RELIABILITY_RISK') {
        add({
          title: 'Diagnostics and treatment standardization — clinical quality consistency',
          rank: stress * dx.relevance,
          path: 'INVESTABLE',
          urgency: stress > 0.70 ? 'high' : 'medium',
          source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
        });
        add({
          title: 'Evidence translation acceleration — trial-to-practice pipeline',
          rank: stress * dx.relevance * 0.9,
          path: 'RESEARCHABLE',
          urgency: 'medium',
          source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
        });
        if (stress >= 0.50) {
          add({
            title: 'Diagnostic uncertainty reduction — AI-assisted clinical decision support',
            rank: stress * dx.relevance * 0.85,
            path: 'RESEARCHABLE',
            urgency: 'medium',
            source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
          });
        }
      }
    }

    // Terminal companies
    var terminalCompanies = [] /* neutralized: distress only from validated gate (see energy-brain) */;
    if (terminalCompanies.length > 0) {
      add({
        title: 'Medicine terminal provider/device distressed positioning',
        rank: 0.95,
        path: 'INVESTABLE',
        urgency: 'high',
        source: 'company_terminal', tier: 1,
        companies: terminalCompanies.map(function (c) { return c.ticker; }),
        stress: stress
      });
    }

    // Stressed but operating
    var stressedCompanies = [] /* neutralized: distress only from validated gate */;
    if (stressedCompanies.length >= 2 && stress >= 0.50) {
      add({
        title: 'Medicine stressed-but-operating provider and device selection',
        rank: stress * 0.80,
        path: 'INVESTABLE',
        urgency: 'medium',
        source: 'company_stressed', tier: 1,
        companies: stressedCompanies.slice(0, 5).map(function (c) { return c.ticker; }),
        stress: stress
      });
    }

    // Convergence
    if (this.state.convergence && this.state.convergence.primary_signal) {
      add({
        title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — medicine convergence response',
        rank: 0.98,
        path: this.state.convergence.primary_signal === 'CONVERGENCE_TERMINAL' ? 'INVESTABLE' : 'INVESTABLE',
        urgency: 'high',
        source: 'convergence', tier: 1,
        signal: this.state.convergence.primary_signal,
        stress: stress
      });
    }

    // ═══ TIER 2 — CROSS-DOMAIN PROPAGATION ═══
    var emissions = this.state.crossDomainEmissions || [];
    for (var ei = 0; ei < emissions.length; ei++) {
      var em = emissions[ei];
      var targetLabel = (em.targetDomain || '').replace(/_/g, ' ');
      var sigLabel = (em.signal || em.signalType || '').replace(/_/g, ' ');

      add({
        title: 'Medicine \u2192 ' + targetLabel + ' transmission — ' + sigLabel + ' response',
        rank: (em.magnitude || 0.5) * stress * 0.8,
        path: 'INVESTABLE',
        urgency: em.magnitude > 0.6 ? 'high' : 'medium',
        source: 'cross_domain', tier: 2,
        diagnosisId: 'medicine_emission_' + em.targetDomain,
        stress: stress
      });

      if (em.targetDomain === 'technology') {
        add({
          title: 'Diagnostic technology demand — clinical interoperability and monitoring systems',
          rank: stress * 0.7,
          path: 'RESEARCHABLE',
          urgency: 'medium',
          source: 'cross_domain', tier: 2,
          diagnosisId: 'tech_diagnostic', stress: stress
        });
      }

      if (em.targetDomain === 'economy') {
        add({
          title: 'Workforce health cost burden — employer health benefit optimization',
          rank: stress * 0.65,
          path: 'INVESTABLE',
          urgency: 'medium',
          source: 'cross_domain', tier: 2,
          diagnosisId: 'econ_health_cost', stress: stress
        });
      }
    }

    // ═══ TIER 3 — LAGGING / SYSTEM RESPONSE ═══
    if (stress >= 0.50) {
      add({
        title: 'Healthcare policy and regulatory response — access modernization',
        rank: stress * 0.65,
        path: 'INVESTABLE',
        urgency: stress > 0.70 ? 'medium' : 'watching',
        source: 'lagging', tier: 3,
        diagnosisId: 'regulatory_response', stress: stress
      });

      add({
        title: 'Digital health infrastructure acceleration — EHR and data exchange',
        rank: stress * 0.70,
        path: 'INVESTABLE',
        urgency: 'medium',
        source: 'lagging', tier: 3,
        diagnosisId: 'digital_health', stress: stress
      });
    }

    if (stress >= 0.60) {
      add({
        title: 'Clinical workforce capacity expansion and training infrastructure',
        rank: stress * 0.75,
        path: 'INVESTABLE',
        urgency: stress > 0.70 ? 'high' : 'medium',
        source: 'lagging', tier: 3,
        diagnosisId: 'workforce_capacity', stress: stress
      });

      add({
        title: 'Drug safety surveillance and adverse event monitoring platform',
        rank: stress * 0.72,
        path: 'RESEARCHABLE',
        urgency: 'medium',
        source: 'lagging', tier: 3,
        diagnosisId: 'safety_monitoring', stress: stress
      });

      add({
        title: 'Care delivery model innovation — value-based and outcome-driven restructuring',
        rank: stress * 0.68,
        path: 'INVESTABLE',
        urgency: 'medium',
        source: 'lagging', tier: 3,
        diagnosisId: 'care_model_innovation', stress: stress
      });
    }

    // Near-diagnosis watchlist
    var nearDx = allDx.filter(function (d) { return !d.active && d.relevance > 0 && d.totalTriggers > 0; });
    for (var ndi = 0; ndi < nearDx.length; ndi++) {
      var nd = nearDx[ndi];
      if (stress >= 0.45) {
        add({
          title: (nd.label || nd.id || '').replace(/_/g, ' ') + ' — early-stage monitoring position',
          rank: stress * (nd.relevance || 0.1) * 0.5,
          path: 'RESEARCHABLE',
          urgency: 'watching',
          source: 'near_diagnosis', tier: 2,
          diagnosisId: nd.id, stress: stress
        });
      }
    }

    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });
    // Canonical enrichment — merge medicine playbook detail per opportunity
    var PB_LIST = window.LIMENMedicineOpportunityPlaybooks || [];
    var _byId = {};
    for (var _pbi = 0; _pbi < PB_LIST.length; _pbi++) _byId[PB_LIST[_pbi].id] = PB_LIST[_pbi];
    var _PB_MAP = {
      'CARE_ACCESS_FAILURE': 'care_access_infra',
      'CHRONIC_DISEASE_LOAD': 'chronic_disease_mgmt',
      'CLINICAL_COORDINATION_BREAKDOWN': 'clinical_coordination',
      'THERAPEUTIC_RELIABILITY_RISK': 'therapeutic_reliability'
    };
    var _LAGGING_MAP = {
      'care_model_innovation': 'care_access_infra',
      'digital_health': 'clinical_coordination',
      'econ_health_cost': 'care_access_infra',
      'regulatory_response': 'health_governance',
      'safety_monitoring': 'drug_safety_surveillance',
      'tech_diagnostic': 'therapeutic_reliability',
      'workforce_capacity': 'workforce_health'
    };
    function _resolvePbId(o) {
      if (o.diagnosisId && _PB_MAP[o.diagnosisId]) return _PB_MAP[o.diagnosisId];
      if (o.source === 'lagging' && o.diagnosisId && _LAGGING_MAP[o.diagnosisId]) return _LAGGING_MAP[o.diagnosisId];
      if (o.nearDiagnosisId && _PB_MAP[o.nearDiagnosisId]) return _PB_MAP[o.nearDiagnosisId];
      return null;
    }
    function _urgencyLabel(u) { if (u === 'high') return 'IMMEDIATE'; if (u === 'medium') return 'ACTIVE'; if (u === 'watching') return 'WATCH'; return (u || '').toUpperCase(); }
    var _COMP = {
      'INVESTABLE':    { type: 'invest',   base: 5,  unit: 'profit%',   tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
      'RESEARCHABLE':  { type: 'research', base: 8,  unit: 'rev-share%', tier: 1, nextTier: { tier: 2, comp: 12, requirement: '3 research outputs published' },  maxTier: { tier: 3, comp: 20 } }
    };
    for (var oi = 0; oi < opps.length; oi++) {
      var o = opps[oi];
      o.id = (o.diagnosisId || o.nearDiagnosisId || o.source || 'opp').replace(/[^a-zA-Z0-9]/g, '_') + '_' + (o.path || '').toLowerCase().replace(/[^a-z]/g, '') + '_t' + (o.tier || 0);
      o.domain = 'medicine';
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
        var evidenceParts = ['Domain: medicine', 'Stress: ' + stressPct + '%'];
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

  MedicineBrain.prototype._checkDiagnosisActions = function () {
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; });
    if (activeDx.length === 0) return;

    var adapters = window.LIMENActionAdapters;
    if (!adapters) return;

    for (var i = 0; i < activeDx.length; i++) {
      var dx = activeDx[i];
      var existingDrafts = adapters.getDrafts({ domain: 'health', intentId: dx.id });
      if (existingDrafts && existingDrafts.length > 0) continue;

      adapters.createDraft('REPORT_GENERATION', {
        domain: 'health',
        sourceType: 'domain_brain',
        sourceId: dx.id,
        intentId: dx.id,
        title: 'Medicine Alert: ' + dx.label,
        intent: {
          domain: 'health',
          title: dx.label,
          status: 'ACTIVE',
          priority: this.state.stress,
          progress: 0,
          strategyType: 'diagnosis_response',
          steps: [
            { type: 'ANALYZE', label: 'Assess ' + dx.label + ' impact on care delivery', status: 'PENDING' },
            { type: 'INVESTIGATE', label: 'Identify affected providers, systems, and populations', status: 'PENDING' },
            { type: 'POSITION', label: 'Evaluate clinical and investment opportunities from ' + dx.label, status: 'PENDING' }
          ]
        }
      });
    }
  };

  MedicineBrain.prototype.resolveDeepContent = function () {
    var self = this;
    var resolver = window.LIMENPortalContentResolver;
    if (!resolver) return Promise.resolve();

    return resolver.resolveForBrain(this.state).then(function (content) {
      self.state.resolvedContent = content;
      if (content) {
        var deepTreats = [];
        for (var dxId in content.byDiagnosis) {
          var dxContent = content.byDiagnosis[dxId];
          for (var i = 0; i < dxContent.treatments.length; i++) {
            var t = dxContent.treatments[i];
            deepTreats.push({
              id: 'deep_' + t.nodeId + '_' + i,
              label: t.label,
              type: t.type,
              evidence: t.evidence,
              description: t.description,
              cite: t.cite,
              steps: t.steps,
              monitoring: t.monitoring,
              escalation: t.escalation,
              diagnosisId: dxId,
              nodeId: t.nodeId,
              nodeLabel: t.nodeLabel,
              hasDepth: t.hasDepth,
              source: 'canonical_deep'
            });
          }
        }
        if (deepTreats.length > 0) self.state.treatments = deepTreats;
      }
    }).catch(function () {});
  };

  var _origCycle = MedicineBrain.prototype.cycle;
  MedicineBrain.prototype.cycle = function () {
    var self = this;
    return _origCycle.call(this).then(function () {
      return self.resolveDeepContent();
    }).then(function () {
      var pulse = window.LIMENMedicinePulse;
      if (pulse && typeof pulse.computePulse === 'function') {
        self.state._activeConditions = self._activeConditions || [];
        var pulseState = pulse.computePulse(self.state);
        self.state.pulse = pulseState;
        if (pulseState && pulseState.validatedDiagnoses) {
          for (var vdi = 0; vdi < pulseState.validatedDiagnoses.length; vdi++) {
            var vdx = pulseState.validatedDiagnoses[vdi];
            for (var sdi = 0; sdi < self.state.diagnoses.length; sdi++) {
              if (self.state.diagnoses[sdi].id === vdx.diagnosis.id) {
                if (vdx.blocked) { self.state.diagnoses[sdi].active = false; self.state.diagnoses[sdi].blocked = true; self.state.diagnoses[sdi].blockReason = vdx.reason; }
                else { self.state.diagnoses[sdi].blocked = false; }
                break;
              }
            }
          }
          self.state.diagnoses.sort(function (a, b) { if (a.active !== b.active) return a.active ? -1 : 1; return b.relevance - a.relevance; });
        }
      }
    }).then(function () {
      // PHASE B — recurrent loop step. Runs AFTER the pipeline settles, reads the prior
      // from the PREVIOUS cycle, computes prediction error, regulates, updates the next
      // prior. Health-local + try/caught (never breaks a cycle).
      try { self._updateHealthModel(); } catch (e) {}
    });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE B — MEDICINE/HEALTH RECURRENT LOOP v1 (health-local, additive, reversible)
  //   prior → observation → prediction error → bounded update → next prior.
  // Proof surface: window.LIMENHealthBrain.state.healthModel
  // ════════════════════════════════════════════════════════════════════════════
  var HM_VERSION = 1;
  var HM_LEARNING_RATE = 0.25;
  var HM_SLOW_RATE = 0.08;
  var HM_STRESS_FLOOR = 0.30;
  var HM_FLOOD_CAP = 12;
  var HM_STALE_MS = 1000 * 60 * 60 * 6;

  function _hmClamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function _hmJaccardDistance(a, b) {
    a = a || []; b = b || [];
    if (a.length === 0 && b.length === 0) return 0;
    var union = {}, inter = 0, setB = {};
    for (var i = 0; i < b.length; i++) { setB[b[i]] = true; union[b[i]] = true; }
    var seen = {};
    for (var j = 0; j < a.length; j++) { union[a[j]] = true; if (setB[a[j]] && !seen[a[j]]) { inter++; seen[a[j]] = true; } }
    var u = Object.keys(union).length;
    return u === 0 ? 0 : 1 - (inter / u);
  }

  MedicineBrain.prototype._neutralHealthModel = function () {
    return {
      version: HM_VERSION, cycle: 0,
      prior: { expectedStress: 0.5, expectedDiagnoses: [], expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, confidence: 0, samples: 0 },
      observation: null, predictionError: null, predictedStress: null,
      plasticity: { learningRate: HM_LEARNING_RATE, slowRate: HM_SLOW_RATE, consolidation: 'cycle-light/rebuild-heavy' },
      regulation: null, readyForHandoff: false, _lowErrorStreak: 0
    };
  };

  MedicineBrain.prototype._buildObservation = function () {
    var s = this.state || {};
    var active = (s.diagnoses || []).filter(function (d) { return d.active; });
    var feeds = s.feeds || {}, feedCount = 0, newest = 0;
    if (Array.isArray(feeds)) { feedCount = feeds.length; }
    else { for (var k in feeds) { if (feeds.hasOwnProperty(k)) { feedCount++; var u = feeds[k] && feeds[k].updated; if (u && u > newest) newest = u; } } }
    return {
      stress: typeof s.stress === 'number' ? s.stress : 0,
      phase: s.phase || null,
      activeDiagnoses: active.map(function (d) { return d.id; }).sort(),
      diagnosisCount: active.length,
      opportunityCount: (s.opportunities || []).length,
      companyCount: (s.companies || []).length,
      signal: Math.min(1, feedCount / 8),
      feedNewest: newest,
      timestamp: Date.now()
    };
  };

  MedicineBrain.prototype._computePredictionError = function (prior, obs) {
    var stressError = Math.abs(obs.stress - prior.expectedStress);
    var signalError = Math.abs(obs.signal - prior.expectedSignal);
    var diagnosisError = _hmJaccardDistance(obs.activeDiagnoses, prior.expectedDiagnoses);
    var oppDenom = Math.max(1, prior.expectedOpportunityCount, obs.opportunityCount);
    var opportunityError = Math.abs(obs.opportunityCount - prior.expectedOpportunityCount) / oppDenom;
    var total = _hmClamp(0.4 * stressError + 0.2 * signalError + 0.25 * diagnosisError + 0.15 * opportunityError, 0, 1);
    var novelty = Math.max(stressError, diagnosisError);
    return { total: total, stressError: stressError, signalError: signalError, diagnosisError: diagnosisError, opportunityError: opportunityError, portalError: 0, novelty: novelty };
  };

  MedicineBrain.prototype._updatePrior = function (prior, obs, lr) {
    return {
      expectedStress: _hmClamp(prior.expectedStress + lr * (obs.stress - prior.expectedStress), 0, 1),
      expectedDiagnoses: obs.activeDiagnoses.slice(),
      expectedDiagnosisCount: prior.expectedDiagnosisCount + lr * (obs.diagnosisCount - prior.expectedDiagnosisCount),
      expectedOpportunityCount: prior.expectedOpportunityCount + lr * (obs.opportunityCount - prior.expectedOpportunityCount),
      expectedSignal: _hmClamp(prior.expectedSignal + lr * (obs.signal - prior.expectedSignal), 0, 1),
      confidence: _hmClamp(Math.min(1, (prior.samples + 1) / 20), 0, 1),
      samples: prior.samples + 1
    };
  };

  MedicineBrain.prototype._computeRegulation = function (hm, obs, pe) {
    var gain = _hmClamp(pe.novelty, 0.05, 0.95);
    var inhibition = _hmClamp(1 - pe.novelty, 0, 0.9);
    var outputScale = _hmClamp(1 - inhibition * 0.5, 0.4, 1);
    var starving = obs.stress >= HM_STRESS_FLOOR && obs.opportunityCount === 0;
    var flooding = obs.opportunityCount > HM_FLOOD_CAP;
    var streak = (pe.total < 0.05) ? (hm._lowErrorStreak || 0) + 1 : 0;
    hm._lowErrorStreak = streak;
    var looping = streak >= 3;
    var stale = obs.feedNewest > 0 ? (Date.now() - obs.feedNewest) > HM_STALE_MS : false;
    var overconfident = hm.prior.confidence > 0.8 && pe.total > 0.4;
    var label = flooding ? 'flooding' : starving ? 'starving' : stale ? 'stale' : looping ? 'looping' : overconfident ? 'overconfident' : pe.novelty > 0.4 ? 'surprised' : 'calm';
    return { gain: gain, inhibition: inhibition, outputScale: outputScale, starving: starving, flooding: flooding, looping: looping, stale: stale, overconfident: overconfident, state: label };
  };

  MedicineBrain.prototype._updateHealthModel = function () {
    var hm = this.state.healthModel || this._neutralHealthModel();
    var priorIn = hm.prior;
    var obs = this._buildObservation();
    var pe = this._computePredictionError(priorIn, obs);

    var gainBlend = _hmClamp(pe.novelty, 0.05, 0.95);
    var predictedStress = priorIn.expectedStress * (1 - gainBlend) + obs.stress * gainBlend;
    var reg = this._computeRegulation(hm, obs, pe);

    var readyForHandoff = (hm.cycle > 0) && (predictedStress >= HM_STRESS_FLOOR) && (obs.diagnosisCount > 0) && !reg.flooding && !reg.stale;

    var nextPrior = this._updatePrior(priorIn, obs, hm.plasticity.learningRate);

    hm.cycle += 1;
    hm.observation = obs;
    hm.predictionError = pe;
    hm.predictedStress = predictedStress;
    hm.regulation = reg;
    hm.readyForHandoff = readyForHandoff;
    hm.prior = nextPrior;
    hm.updated = obs.timestamp;
    this.state.healthModel = hm;

    // H1-H6 — higher health brain layers, computed once per cycle BEFORE the DDP build.
    try { this._computeHealthHigherLayers(); } catch (e) {}

    // Clinical-pipeline diagnosis layer (additive; BEFORE DDP build). Never merged into
    // the validated diagnosis spine.
    try { this._buildClinicalPipelineLayer(); } catch (e) {}

    // Generic cognition surface the console SELF-MODEL panel renders for ANY domain.
    // domain='medicine' = the portal/URL key (snapshot/runtime key is 'health').
    try {
      this.state.cognition = {
        domain: 'medicine',
        model: { cycle: hm.cycle, predictionError: hm.predictionError, predictedStress: hm.predictedStress, regulation: hm.regulation },
        awareness: this.state.healthAwareness || null,
        conscience: this.state.healthConscience || null,
        immune: this.state.healthImmune || null,
        intuition: this.state.healthIntuition || null
      };
    } catch (e) {}

    // F1 — build the DomainDiagnosisPacket (schema) for the primary diagnosis,
    // and expose one per diagnosis. Schema-only: never invents data.
    try {
      var _diags = this.state.diagnoses || [];
      var _primary = _diags.filter(function (d) { return d.active; })[0] || _diags[0] || null;
      var _self = this;
      hm.domainDiagnosisPacket = this._buildDomainDiagnosisPacket(_primary);
      this.state.healthDomainDiagnosisPacket = hm.domainDiagnosisPacket;
      this.state.healthDomainDiagnosisPackets = _diags.map(function (d) { return _self._buildDomainDiagnosisPacket(d); });
    } catch (e) {}

    // populate outcomeLog (memory)
    try {
      var mem = this.state.memory;
      if (mem && mem.outcomeLog) {
        mem.outcomeLog.push({ cycle: hm.cycle, predictionError: Math.round(pe.total * 1000) / 1000, stress: obs.stress, activeDx: obs.diagnosisCount, readyForHandoff: readyForHandoff, regulation: reg.state, timestamp: obs.timestamp });
        if (mem.outcomeLog.length > 50) mem.outcomeLog.shift();
      }
    } catch (e) {}

    return hm;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // C6 — load REAL healthcare entities from command-board-data (one-shot, guarded).
  // ════════════════════════════════════════════════════════════════════════════
  MedicineBrain.prototype._loadHealthCommandBoardCompanies = function () {
    var self = this;
    if (self._cbHealthCompanies) return;            // one-shot
    self._cbHealthCompanies = [];
    try {
      fetch('/assets/data/command-board-data.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data) return;
          var arr = Array.isArray(data) ? data : (Object.keys(data).map(function (k) { return data[k]; }).find(Array.isArray) || []);
          self._cbHealthCompanies = arr
            .filter(function (x) { return x && (x.d === 'medicine' || x.d === 'health') && x.t; })
            .map(function (x) { return { name: x.n, ticker: x.t, cik: x.c, phase: x.p, trajectory: x.tr }; });
        })
        .catch(function () {});
    } catch (e) {}
  };

  // ════════════════════════════════════════════════════════════════════════════
  // G1 — load REAL source bundles (one-shot, async). 404s are 'missing'; never fabricated.
  // ════════════════════════════════════════════════════════════════════════════
  var HEALTH_DIAGNOSIS_ALIASES = {};   // medicine diagnoses are canonical-to-self
  MedicineBrain.prototype._resolveCanonicalDiagnosis = function (dxId) {
    if (!dxId) return { canonicalDiagnosisId: null, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };
    var target = null;
    try {
      var idx = (typeof window !== 'undefined') ? window.LIMENArtifactSourceIndex : null;
      if (idx && typeof idx.aliases === 'function') { var row = idx.aliases()[dxId]; if (row && row.target) target = row.target; }
    } catch (e) {}
    var local = HEALTH_DIAGNOSIS_ALIASES[dxId] || null;
    if (!target && local) target = local.target;
    if (target) return { canonicalDiagnosisId: target, aliasUsed: true, aliasReviewStatus: (local && local.reviewStatus) || 'corpus-aliased', aliasRisk: (local && local.risk) || 'low', aliasNote: (local && local.note) || null };
    return { canonicalDiagnosisId: dxId, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };
  };

  MedicineBrain.prototype._loadDiagnosisBundles = function () {
    var self = this;
    if (self._bundleLoadPromise) return self._bundleLoadPromise;
    self._bundleCache = self._bundleCache || {};
    self._bundleStatusMap = self._bundleStatusMap || {};
    var ids = {};
    var known = ['CARE_ACCESS_FAILURE', 'CHRONIC_DISEASE_LOAD', 'CLINICAL_COORDINATION_BREAKDOWN', 'THERAPEUTIC_RELIABILITY_RISK', 'PANDEMIC', 'DRUG_RESISTANCE', 'HEALTHCARE_COLLAPSE', 'MALPRACTICE_CRISIS', 'SUPPLY_SHORTAGE'];
    var diags = (self.state && self.state.diagnoses) || [];
    var allDxIds = diags.map(function (d) { return d.id; }).concat(known);
    for (var i = 0; i < allDxIds.length; i++) { var c = self._resolveCanonicalDiagnosis(allDxIds[i]).canonicalDiagnosisId; if (c) ids[c] = true; }
    self._bundleLoadPromise = Promise.all(Object.keys(ids).map(function (cid) {
      return fetch('/assets/data/artifact-source-index/by-diagnosis/' + encodeURIComponent(cid) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) { self._bundleStatusMap[cid] = data ? 'found' : 'missing'; if (data) self._bundleCache[cid] = data; })
        .catch(function () { self._bundleStatusMap[cid] = 'missing'; });
    })).then(function () { return self._bundleCache; });
    return self._bundleLoadPromise;
  };

  MedicineBrain.prototype._healthBundleStates = function () {
    var self = this; var diags = this.state.diagnoses || [];
    return diags.map(function (d) {
      var c = self._resolveCanonicalDiagnosis(d.id);
      var bundle = (self._bundleCache && self._bundleCache[c.canonicalDiagnosisId]) || null;
      var known = !!(self._bundleStatusMap && Object.prototype.hasOwnProperty.call(self._bundleStatusMap, c.canonicalDiagnosisId));
      return { dxId: d.id, active: !!d.active, relevance: (typeof d.relevance === 'number' ? d.relevance : 0),
        canonical: c.canonicalDiagnosisId, aliasUsed: c.aliasUsed, aliasRisk: c.aliasRisk, aliasReviewStatus: c.aliasReviewStatus,
        bundleStatus: bundle ? 'found' : (known ? 'missing' : 'unknown'),
        buildMethod: (bundle && bundle.buildMethod) || null, humanVerification: (bundle && bundle.humanVerification) || null,
        shallow: !!(bundle && ((bundle.maxDepth || 0) === 0 || (bundle.portalCount || 0) <= 1)) };
    });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // CLINICAL-PIPELINE DIAGNOSIS LAYER (additive; mirrors energy data-center layer).
  // Real-content sub-portal (medicine_clinical-pipeline.json) carrying trial/approval
  // dynamics. NEVER merged into the validated diagnosis spine; no external bundle yet.
  // ════════════════════════════════════════════════════════════════════════════
  MedicineBrain.prototype._loadClinicalPipelineDiagnoses = function () {
    var self = this;
    if (self._cpLoadPromise) return self._cpLoadPromise;
    self._cpLoadPromise = fetch('/assets/data/domains/medicine_clinical-pipeline.json')
      .then(function (r) { return (r && r.ok) ? r.json() : null; })
      .then(function (data) {
        if (!data) { self._cpPortal = null; return null; }
        self._cpPortal = { issues: data.issues || [], activations: data.activations || [], title: data.title || 'Clinical Pipeline' };
        return self._cpPortal;
      })
      .catch(function () { self._cpPortal = null; return null; });
    return self._cpLoadPromise;
  };

  MedicineBrain.prototype._buildClinicalPipelineLayer = function () {
    var self = this;
    var cp = self._cpPortal;
    if (!cp || !cp.issues || !cp.issues.length) {
      self.state.clinicalPipelineDiagnoses = [];
      self.state.clinicalPipelineTreatments = [];
      self.state.clinicalPipelineDomainDiagnosisPackets = [];
      self.state.clinicalPipelineLayer = { loaded: false, count: 0, activeCount: 0, diagnoses: [], note: 'clinical-pipeline sub-portal not loaded (offline or fetch failed)' };
      return self.state.clinicalPipelineLayer;
    }
    var conditions = self._activeConditions || [];
    var diagnoses = cp.issues.map(function (iss) {
      var triggers = (self.diagnosisIndex && self.diagnosisIndex[iss.id]) || [];
      var matchCount = 0;
      for (var t = 0; t < triggers.length; t++) {
        for (var c = 0; c < conditions.length; c++) {
          if (conditions[c] === triggers[t] || String(conditions[c]).indexOf(triggers[t]) !== -1) matchCount++;
        }
      }
      return { id: iss.id, label: iss.label, summary: iss.summary || '',
        active: matchCount > 0,
        relevance: triggers.length ? Math.round((matchCount / triggers.length) * 100) / 100 : 0,
        circuits: iss.circuits || [], source: 'clinical-pipeline', tier: 'real-content-unbundled', branch: 'clinical-pipeline' };
    });
    var nodeToDx = {};
    diagnoses.forEach(function (d) { (d.circuits || []).forEach(function (c) { if (c && c.nodeId) nodeToDx[c.nodeId] = d.id; }); });
    var treatments = [];
    (cp.activations || []).forEach(function (act) {
      var dxId = nodeToDx[act.brainNodeId];
      if (!dxId) return;
      (act.treatments || []).forEach(function (t, ti) {
        treatments.push({ id: 'cp_treat_' + act.brainNodeId + '_' + ti, label: t.label, type: t.type, evidence: t.evidence, description: t.description || '', cite: t.cite || null, citation: t.citation || [], steps: t.steps || [], diagnosisId: dxId, nodeId: act.brainNodeId, source: 'clinical-pipeline' });
      });
    });
    var evidenceRank = { A: 10, Strong: 10, B: 7, Moderate: 7, C: 4, Emerging: 1 };
    treatments.sort(function (a, b) { return (evidenceRank[b.evidence] || 0) - (evidenceRank[a.evidence] || 0); });
    self.state.clinicalPipelineDiagnoses = diagnoses;
    self.state.clinicalPipelineTreatments = treatments;
    self.state.clinicalPipelineLayer = {
      loaded: true, portalTitle: cp.title,
      count: diagnoses.length, activeCount: diagnoses.filter(function (d) { return d.active; }).length,
      diagnoses: diagnoses.map(function (d) {
        var rc = self._resolveCanonicalDiagnosis ? self._resolveCanonicalDiagnosis(d.id) : { canonicalDiagnosisId: d.id };
        var bs = (self._bundleStatusMap && self._bundleStatusMap[rc.canonicalDiagnosisId]) || 'missing';
        return { id: d.id, label: d.label, active: d.active, branch: 'clinical-pipeline', canonicalDiagnosisId: rc.canonicalDiagnosisId, bundleStatus: bs, treatmentCount: treatments.filter(function (t) { return t.diagnosisId === d.id; }).length };
      }),
      note: 'real-content (trial/approval pipeline) sub-portal diagnoses; SEPARATE from the validated diagnosis spine; no external source bundle yet; never admitted to evidenceAnchors'
    };
    self.state.clinicalPipelineDomainDiagnosisPackets = diagnoses.map(function (d) {
      try { return self._buildDomainDiagnosisPacket(d); } catch (e) { return null; }
    }).filter(Boolean);
    return self.state.clinicalPipelineLayer;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE H1-H6 — HIGHER HEALTH BRAIN LAYERS (health-local, additive, domain-level).
  // ════════════════════════════════════════════════════════════════════════════

  // H1 — formal immune system
  MedicineBrain.prototype._computeHealthImmune = function () {
    var s = this.state, hm = s.healthModel || {}, reg = hm.regulation || {}, bs = this._healthBundleStates();
    var ant = [];
    bs.forEach(function (b) {
      if (b.bundleStatus === 'missing') ant.push({ type: 'source-bundle-missing', dx: b.dxId, severity: 'medium', action: 'block-from-prompt-evidence' });
      if (b.buildMethod === 'external-source-authored') ant.push({ type: 'external-source-authored-needs-human-verification', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
      if (b.aliasRisk === 'medium' || b.aliasRisk === 'high') ant.push({ type: 'alias-risk-bundle', dx: b.dxId, severity: b.aliasRisk, action: 'allow-with-warning' });
      if (b.bundleStatus === 'found' && b.shallow) ant.push({ type: 'root-only-shallow-bundle', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
    });
    var pe = (hm.predictionError && hm.predictionError.total) || 0;
    if (pe > 0.4) ant.push({ type: 'prediction-error-spike', severity: 'medium', action: 'lower-confidence', value: Math.round(pe * 1000) / 1000 });
    if (reg.stale) ant.push({ type: 'stale-feeds', severity: 'low', action: 'flag' });
    if (reg.flooding) ant.push({ type: 'opportunity-flood', severity: 'medium', action: 'inhibit' });
    if (reg.starving) ant.push({ type: 'unsupported-artifact-readiness-risk', severity: 'low', action: 'flag' });
    var sev = ant.some(function (a) { return a.severity === 'high'; }) ? 'high' : ant.some(function (a) { return a.severity === 'medium'; }) ? 'medium' : ant.length ? 'low' : 'none';
    var im = {
      version: 1, immuneState: sev === 'high' ? 'alert' : sev === 'medium' ? 'active' : sev === 'low' ? 'watch' : 'clear', severity: sev,
      antigens: ant.slice(0, 12),
      quarantines: ['unbundled-clinical-pipeline-content'],
      allowedWithWarning: ant.filter(function (a) { return a.action === 'allow-with-warning'; }).map(function (a) { return a.type + (a.dx ? (':' + a.dx) : ''); }),
      blockedFromPrompt: ant.filter(function (a) { return a.action === 'block-from-prompt-evidence'; }).map(function (a) { return a.dx; }),
      blockedFromTraversal: [],
      immuneMemory: (((s.healthImmune && s.healthImmune.immuneMemory) || 0) + 1),
      lastScanAt: hm.updated || null
    };
    s.healthImmune = im; return im;
  };

  // H2 — awareness / metacognition
  MedicineBrain.prototype._computeHealthAwareness = function () {
    var s = this.state, hm = s.healthModel || {}, im = s.healthImmune || {}, bs = this._healthBundleStates();
    var covered = bs.filter(function (b) { return b.bundleStatus === 'found'; });
    var missing = bs.filter(function (b) { return b.bundleStatus === 'missing'; });
    var hv = bs.filter(function (b) { return b.humanVerification === 'required'; });
    var active = (s.diagnoses || []).filter(function (d) { return d.active; });
    var prev = s.healthAwareness || {};
    var pe = (hm.predictionError && hm.predictionError.total) || 0;
    var aw = {
      version: 1,
      selfState: im.immuneState === 'alert' ? 'guarded' : (hm.regulation && hm.regulation.state) || 'unknown',
      knowns: covered.map(function (b) { return b.dxId + ' (source-backed' + (b.buildMethod === 'external-source-authored' ? ', external' : '') + ')'; }),
      unknowns: missing.map(function (b) { return b.dxId + ' (no source bundle)'; }),
      uncertainties: ['clinical-pipeline diagnoses are unbundled (real-content, no source bundle yet)', 'predictionError=' + (Math.round(pe * 1000) / 1000)],
      suppressions: (im.quarantines || []).slice(),
      confidenceDrivers: ['source coverage ' + covered.length + '/' + bs.length, 'regulation ' + ((hm.regulation && hm.regulation.state) || '?')],
      changedSinceLastCycle: { predictionErrorDelta: Math.round((pe - (typeof prev._pe === 'number' ? prev._pe : pe)) * 1000) / 1000, coverageNow: covered.length },
      humanReviewRequired: hv.map(function (b) { return b.dxId; }),
      selfNarrative: 'Medicine: ' + covered.length + '/' + bs.length + ' source-backed, ' + active.length + ' active dx, immune=' + (im.immuneState || '?') + ', ' + hv.length + ' need human verification.',
      lastAwarenessAt: hm.updated || null, _pe: pe
    };
    s.healthAwareness = aw; return aw;
  };

  // H3 — conscience / veto
  MedicineBrain.prototype._computeHealthConscience = function () {
    var s = this.state, hm = s.healthModel || {}, bs = this._healthBundleStates();
    var pe = (hm.predictionError && hm.predictionError.total) || 0;
    var vetoes = [], cautions = [], allowed = [], blocked = ['patent-claim', 'grant-claim'];
    vetoes.push({ claim: 'patent/grant', reason: 'no method/mechanism/embodiment/figure candidate fields in any medicine bundle' });
    // medicine-specific harm-prevention veto: never assert clinical/therapeutic efficacy
    vetoes.push({ claim: 'clinical-efficacy/therapeutic-recommendation', reason: 'medicine domain never asserts clinical efficacy or patient-facing treatment recommendations — care-system and investment lenses only' });
    blocked.push('clinical-efficacy-claim');
    bs.forEach(function (b) {
      if (b.bundleStatus === 'missing') { blocked.push('strong-claim:' + b.dxId); vetoes.push({ claim: 'strong-claim:' + b.dxId, reason: 'no source bundle' }); }
      else if (b.buildMethod === 'external-source-authored') { cautions.push({ claim: 'strong-claim:' + b.dxId, reason: 'external-source-authored; human-verification-required' }); allowed.push('source-routing:' + b.dxId); }
      else if (b.aliasRisk === 'medium' || b.aliasRisk === 'high') { cautions.push({ claim: 'precise-technical-claim:' + b.dxId, reason: 'aliasRisk ' + b.aliasRisk + '; include alias warning' }); allowed.push('source-summary:' + b.dxId); }
      else if (b.bundleStatus === 'found') { allowed.push('source-summary:' + b.dxId); }
    });
    if (pe > 0.4) cautions.push({ claim: 'high-confidence-claim', reason: 'predictionError spike ' + (Math.round(pe * 1000) / 1000) });
    var hasFound = bs.some(function (b) { return b.bundleStatus === 'found'; });
    var con = {
      version: 1, conscienceState: vetoes.length ? 'restrictive' : 'permissive',
      vetoes: vetoes.slice(0, 10), cautions: cautions.slice(0, 10),
      allowedClaims: ['source-summary'].concat(hasFound ? ['investment-memo-with-warnings'] : []).concat(allowed.slice(0, 6)),
      blockedClaims: blocked.slice(0, 10),
      artifactReadinessDecision: { patentReady: false, grantReady: false, sbaReady: false, investmentReady: hasFound, researchReady: hasFound, note: 'patent/grant vetoed; clinical-efficacy claims vetoed (harm prevention); investment/research allowed-with-warning only for source-backed diagnoses' },
      reasons: ['overclaim prevention', 'source sufficiency', 'patient-harm prevention (no clinical efficacy claims)', 'human-verification preservation'],
      lastCheckAt: hm.updated || null
    };
    s.healthConscience = con; return con;
  };

  // H4 — intuition / weak-signal (NOT evidence; labelled unverified)
  MedicineBrain.prototype._computeHealthIntuition = function () {
    var s = this.state, hm = s.healthModel || {}, reg = hm.regulation || {};
    var log = (s.memory && s.memory.outcomeLog) || [];
    var hunches = [];
    if (log.length >= 2) {
      var a = log[log.length - 2].predictionError, b = log[log.length - 1].predictionError;
      if (typeof a === 'number' && typeof b === 'number' && b - a > 0.05) hunches.push({ hunch: 'regime shift forming (prediction error rising)', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'predictionError rose ' + a + '->' + b, verifyIf: 'error keeps rising 2+ cycles', falsifyIf: 'error returns to baseline' });
    }
    if (reg.state === 'surprised') hunches.push({ hunch: 'novel health stressor entering the system', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'regulation=surprised (high novelty)', verifyIf: 'a specific diagnosis activates with source support', falsifyIf: 'novelty subsides next cycle' });
    var cond = s._activeConditions || this._activeConditions || [];
    if (cond.indexOf('adverse_event_spike') !== -1) hunches.push({ hunch: 'rising drug-safety pressure (adverse-event spike)', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'adverse_event_spike condition active', verifyIf: 'recall_pressure or efficacy_concern co-activate', falsifyIf: 'adverse-event volume normalizes' });
    if (cond.indexOf('recall_pressure') !== -1) hunches.push({ hunch: 'therapeutic reliability erosion (recall pressure)', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'recall_pressure condition active', verifyIf: 'quality_variation co-activates', falsifyIf: 'recall volume subsides' });
    if (cond.indexOf('treatment_inconsistency') !== -1) hunches.push({ hunch: 'treatment-consistency drift across care settings', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'treatment_inconsistency condition active', verifyIf: 'evidence_lag co-activates', falsifyIf: 'consistency signals normalize' });
    var missing = this._healthBundleStates().filter(function (x) { return x.bundleStatus === 'missing' && x.active; });
    if (missing.length) hunches.push({ hunch: 'recurring uncovered diagnosis: ' + missing[0].dxId, label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'active diagnosis with no source bundle', verifyIf: 'a real source bundle is built', falsifyIf: 'diagnosis deactivates' });

    var patternMatches = [];
    var recent = log.slice(-10), regCount = {};
    recent.forEach(function (e) { if (e.regulation) regCount[e.regulation] = (regCount[e.regulation] || 0) + 1; });
    Object.keys(regCount).forEach(function (k) { if (regCount[k] >= 3) patternMatches.push({ pattern: 'recurring regulation state: ' + k, occurrences: regCount[k], window: recent.length, label: 'PATTERN', evidenceStatus: 'UNVERIFIED' }); });

    var FAMILY = { 'access': ['CARE_ACCESS_FAILURE', 'HEALTHCARE_COLLAPSE'], 'chronic-burden': ['CHRONIC_DISEASE_LOAD'], 'coordination': ['CLINICAL_COORDINATION_BREAKDOWN'], 'reliability': ['THERAPEUTIC_RELIABILITY_RISK', 'DRUG_RESISTANCE', 'MALPRACTICE_CRISIS'], 'supply': ['SUPPLY_SHORTAGE'], 'outbreak': ['PANDEMIC'] };
    var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var primaryId = (active[0] || (s.diagnoses || [])[0] || {}).id;
    var analogies = [];
    Object.keys(FAMILY).forEach(function (fam) { if (FAMILY[fam].indexOf(primaryId) >= 0) { FAMILY[fam].forEach(function (sib) { if (sib !== primaryId) analogies.push({ analogy: primaryId + ' resembles ' + sib, family: fam, label: 'ANALOGY', evidenceStatus: 'UNVERIFIED', note: 'shared structural failure-family — a lens for monitoring, not a claim' }); }); } });

    var hmem = this._hunchMemory = this._hunchMemory || {};
    var curKeys = {}; hunches.forEach(function (h) { curKeys[h.hunch] = true; hmem[h.hunch] = (hmem[h.hunch] || 0) + 1; });
    var promotedToMonitoring = [], rejectedHunches = [];
    Object.keys(hmem).forEach(function (k) {
      if (!curKeys[k]) { rejectedHunches.push({ hunch: k, reason: 'signal subsided across cycles (falsifier path)' }); delete hmem[k]; return; }
      if (hmem[k] >= 3) promotedToMonitoring.push({ target: k, basis: 'recurred ' + hmem[k] + ' cycles', note: 'monitoring target ONLY — never evidence or diagnosis' });
    });

    var it = {
      version: 1, hunches: hunches.slice(0, 3), weakSignals: hunches.map(function (h) { return h.why; }),
      patternMatches: patternMatches.slice(0, 5), analogies: analogies.slice(0, 4), confidence: 'LOW', evidenceStatus: 'UNVERIFIED',
      promotedToDiagnosis: [], promotedToMonitoring: promotedToMonitoring.slice(0, 4), rejectedHunches: rejectedHunches.slice(0, 4), lastIntuitionAt: hm.updated || null
    };
    s.healthIntuition = it; return it;
  };

  // H5 — simulation / bounded counterfactual (hypothetical only)
  MedicineBrain.prototype._computeHealthSimulation = function () {
    var s = this.state, hm = s.healthModel || {};
    var base = typeof s.stress === 'number' ? s.stress : 0;
    function cl(v) { return Math.max(0, Math.min(1, Math.round(v * 1000) / 1000)); }
    var scenarios = [
      { type: 'worsen', hypothetical: true, assumption: 'health stressor intensifies', simulatedStress: cl(base + 0.2), risk: 'cascade toward healthcare-system collapse', intervention: 'monitor capacity / access metrics (CMS / CDC)', falsifier: 'stress flat or falling next cycle' },
      { type: 'stabilize', hypothetical: true, assumption: 'stressor holds', simulatedStress: cl(base), risk: 'persistent elevated baseline', intervention: 'maintain monitoring cadence', falsifier: 'stress moves materially' },
      { type: 'recover', hypothetical: true, assumption: 'stressor reverses', simulatedStress: cl(base - 0.2), risk: 'premature de-escalation', intervention: 'confirm with 2 independent sources before standing down', falsifier: 'stress re-rises' },
      { type: 'drug-shortage', hypothetical: true, assumption: 'pharmaceutical supply shortage worsens', simulatedStress: cl(base + 0.3), risk: 'patient access loss + therapeutic substitution (SUPPLY_SHORTAGE)', intervention: 'track FDA Drug Shortages / ASHP', falsifier: 'shortage counts stable' },
      { type: 'coordination-breakdown', hypothetical: true, assumption: 'clinical coordination cascades across care settings', simulatedStress: cl(base + 0.25), risk: 'referral leakage + discharge failure (CLINICAL_COORDINATION_BREAKDOWN)', intervention: 'monitor interoperability / handoff metrics', falsifier: 'coordination signals stable' }
    ];
    var sim = {
      version: 1, scenarios: scenarios, assumptions: scenarios.map(function (x) { return x.assumption; }),
      simulatedStress: scenarios.map(function (x) { return x.simulatedStress; }),
      simulatedDiagnoses: ['HEALTHCARE_COLLAPSE', 'SUPPLY_SHORTAGE', 'CLINICAL_COORDINATION_BREAKDOWN'], simulatedOpportunities: [],
      risks: scenarios.map(function (x) { return x.risk; }), interventions: scenarios.map(function (x) { return x.intervention; }),
      falsifiers: scenarios.map(function (x) { return x.falsifier; }), lastSimulatedAt: hm.updated || null
    };
    s.healthSimulation = sim; return sim;
  };

  // H6 — executive self-report (compact status card)
  MedicineBrain.prototype._computeHealthExecutiveReport = function () {
    var s = this.state, hm = s.healthModel || {}, im = s.healthImmune || {}, aw = s.healthAwareness || {}, con = s.healthConscience || {}, it = s.healthIntuition || {}, sim = s.healthSimulation || {}, bs = this._healthBundleStates();
    var covered = bs.filter(function (b) { return b.bundleStatus === 'found'; }).length;
    var hv = bs.filter(function (b) { return b.humanVerification === 'required'; }).length;
    var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var strongest = active[0] || (s.diagnoses || [])[0] || null;
    var pe = (hm.predictionError && hm.predictionError.total) || 0;
    var status = im.immuneState === 'alert' ? 'immune-alert' : hv > 0 ? 'human-review-required' : covered < bs.length ? 'source-limited' : (hm.regulation && hm.regulation.starving) ? 'starving' : (hm.regulation && hm.regulation.state === 'surprised') ? 'surprised' : 'healthy';
    var rep = {
      version: 1, brainStatus: status,
      strongestDiagnosis: strongest ? strongest.id : null,
      strongestOpportunity: (s.opportunities && s.opportunities[0] && s.opportunities[0].title) || null,
      confidence: Math.round((1 - pe) * 100) / 100, predictionError: Math.round(pe * 1000) / 1000,
      regulationState: (hm.regulation && hm.regulation.state) || null, immuneState: im.immuneState || null,
      awarenessSummary: aw.selfNarrative || null, conscienceDecision: con.conscienceState || null,
      intuitionSummary: (it.hunches || []).length + ' hunch(es)', simulationSummary: (sim.scenarios || []).length + ' scenario(s)',
      artifactReadiness: con.artifactReadinessDecision || null, blockers: (con.blockedClaims || []).slice(0, 6),
      nextBestAction: covered < bs.length ? 'build/verify source for uncovered diagnoses' : hv > 0 ? 'human-verify external-source bundles' : 'monitor strongest diagnosis sources',
      lastReportAt: hm.updated || null
    };
    s.healthExecutiveReport = rep; return rep;
  };

  MedicineBrain.prototype._computeHealthHigherLayers = function () {
    this._computeHealthImmune();
    this._computeHealthAwareness();
    this._computeHealthConscience();
    this._computeHealthIntuition();
    this._computeHealthSimulation();
    this._computeHealthExecutiveReport();
  };

  // ════════════════════════════════════════════════════════════════════════════
  // F1 — MEDICINE DomainDiagnosisPacket SCHEMA (schema-only; NEVER invents data).
  // Canonical 8-section contract. domain key = 'medicine' (portal/URL key).
  // ════════════════════════════════════════════════════════════════════════════
  var HDDP_SCHEMA_VERSION = 'medicine-ddp-1';
  function _hddpPresent(v) {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (v === 'missing' || v === '' || v === 'none') return false;
    return true;
  }
  function _hddpCompleteness(section, keys) {
    var have = 0; for (var i = 0; i < keys.length; i++) { if (_hddpPresent(section[keys[i]])) have++; }
    return { have: have, total: keys.length, pct: keys.length ? Math.round(have / keys.length * 100) : 0 };
  }

  MedicineBrain.prototype._buildDomainDiagnosisPacket = function (dx) {
    var s = this.state || {};
    var hm = s.healthModel || {};
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
    if (Array.isArray(feeds)) { feeds.forEach(function (f) { sourceFeeds.push({ name: (f && f.name) || null, updated: (f && f.updated) || null, source: (f && f.source) || null }); }); }
    else { for (var fk in feeds) { if (feeds.hasOwnProperty(fk)) { var f = feeds[fk]; sourceFeeds.push({ name: fk, updated: (f && f.updated) || null, source: (f && f.source) || null }); } } }
    if (s._primarySource && !sourceFeeds.length) sourceFeeds.push({ name: 'primary', updated: null, source: s._primarySource });

    var _canon = this._resolveCanonicalDiagnosis(dxId);
    var identity = {
      domain: 'medicine',
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
    var _bundle = (this._bundleCache && this._bundleCache[identity.canonicalDiagnosisId]) || null;
    var _bundleKnown = !!(this._bundleStatusMap && Object.prototype.hasOwnProperty.call(this._bundleStatusMap, identity.canonicalDiagnosisId));
    var _bl = (_bundle && _bundle.byLane && _bundle.byLane.investments) ? _bundle.byLane.investments : null;
    var _bArr = function (k) { return (_bl && Array.isArray(_bl[k])) ? _bl[k] : []; };
    var bundleStatus = _bundle ? 'found' : (_bundleKnown ? 'missing' : 'unknown');
    var bundleShallow = !!(_bundle && ((_bundle.maxDepth || 0) === 0 || (_bundle.portalCount || 0) <= 1));
    var bundleResolution = identity.aliasUsed
      ? (_bundle ? 'alias-resolved-and-bundle-found' : 'alias-resolved-but-bundle-missing')
      : (_bundle ? 'found' : (_bundleKnown ? 'missing' : 'unknown'));
    if (!treatments.length && _bl) treatments = _bArr('treatments');
    if (!implementationSteps.length && _bl) implementationSteps = _bArr('implementationSteps');
    var brainState = {
      healthModel: { version: hm.version || null, cycle: (typeof hm.cycle === 'number' ? hm.cycle : null) },
      predictionError: hm.predictionError || null,
      regulationState: (hm.regulation && hm.regulation.state) || null,
      prior: hm.prior || null,
      observation: hm.observation || null,
      plasticity: hm.plasticity || null,
      readyForHandoff: hm.readyForHandoff === true
    };
    var rootId = (portal && portal.domainId) || 'medicine';
    var rootTitle = (portal && portal.title) || 'Medicine & Health';
    var ancestry = (portal && portal.parentLabel) ? [portal.parentLabel, rootTitle] : [rootTitle];
    var portalContext = {
      portalIds: [rootId],
      portalDomain: 'medicine',
      portalTitle: rootTitle,
      depth: 0,
      ancestryPath: ancestry,
      portalStatus: portal ? 'root-only' : 'pending',
      sourceCompleteness: portal ? ((Array.isArray(portal.issues) && portal.issues.length) ? 'partial' : 'thin') : 'root-only',
      bundleSource: (_bundle && Array.isArray(_bundle.sourcePortals) && _bundle.sourcePortals.length)
        ? { portalIds: _bundle.sourcePortals.map(function (sp) { return sp.portalId; }), depth: _bundle.maxDepth || 0, ancestryPath: (_bundle.sourcePortals[0].ancestry || []), domains: _bundle.domains || [] }
        : null
    };
    var citationHints = sourceFeeds.map(function (sf) { return sf.source || sf.name; }).filter(Boolean);
    var evidenceAnchors = _bArr('evidenceAnchors');
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
    var _isExternal = !!(_bundle && _bundle.buildMethod === 'external-source-authored');
    var _intakeSrcHint = { CARE_ACCESS_FAILURE: 'CMS / KFF / HRSA shortage-area data / health-system filings', CHRONIC_DISEASE_LOAD: 'CDC WONDER / GBD / NHANES / hospital utilization', CLINICAL_COORDINATION_BREAKDOWN: 'ONC interoperability / CMS readmission / health-system data', THERAPEUTIC_RELIABILITY_RISK: 'FDA labels / openFDA adverse events / ClinicalTrials.gov / peer-reviewed literature', SUPPLY_SHORTAGE: 'FDA Drug Shortages / ASHP / manufacturing surveys', PANDEMIC: 'CDC MMWR / WHO Disease Outbreak News' };
    var authoringIntake = [];
    if (_isExternal) {
      ['methodCandidates', 'embodimentCandidates', 'figurePlaceholders'].forEach(function (field) {
        if (_bArr(field).length === 0) authoringIntake.push({ field: field, status: 'needs-human-input', count: 0, need: field === 'methodCandidates' ? 'a concrete technical method drawn from a primary source' : field === 'embodimentCandidates' ? 'a specific implementation/embodiment from a real document' : 'a figure description grounded in a real source', sourceHint: _intakeSrcHint[identity.canonicalDiagnosisId] || 'primary institutional / clinical source', note: 'NOT fabricated by the brain — author from the cited source, then wire in verbatim with attribution' });
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
    var artifactContext = {
      artifactLanes: artifactLanes,
      patentReady: false, grantReady: false, sbaReady: false,
      investmentReady: !!(hasTreat && primaryOpp), researchReady: ready || hasTreat,
      readinessReasons: readinessReasons,
      blockers: blockers
    };

    var comp = {
      identity:         _hddpCompleteness(identity, ['domain', 'diagnosisId', 'canonicalDiagnosisId', 'label', 'phase', 'confidence']),
      brainState:       _hddpCompleteness(brainState, ['healthModel', 'predictionError', 'regulationState', 'prior', 'observation', 'plasticity']),
      portalContext:    _hddpCompleteness(portalContext, ['portalIds', 'portalDomain', 'portalTitle', 'depth', 'ancestryPath']),
      evidence:         _hddpCompleteness(evidence, ['sourceFeeds', 'evidenceAnchors', 'citationHints']),
      treatmentContext: _hddpCompleteness(treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']),
      operatorContext:  _hddpCompleteness(operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']),
      artifactContext:  _hddpCompleteness(artifactContext, ['artifactLanes'])
    };
    var totHave = 0, totAll = 0;
    for (var ck in comp) { if (comp.hasOwnProperty(ck)) { totHave += comp[ck].have; totAll += comp[ck].total; } }
    var missingFields = [];
    function _cm(name, obj, keys) { for (var i = 0; i < keys.length; i++) { if (!_hddpPresent(obj[keys[i]])) missingFields.push(name + '.' + keys[i]); } }
    _cm('identity', identity, ['canonicalDiagnosisId', 'confidence']);
    _cm('evidence', evidence, ['evidenceAnchors', 'citationHints']);
    _cm('treatmentContext', treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']);
    _cm('operatorContext', operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']);

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
    if (!primaryOpp && (typeof s.stress !== 'number' || s.stress < HM_STRESS_FLOOR)) warnings.push('no active opportunity (offline/low-stress) — operator/lane fields stay empty');
    if (artifactContext.artifactLanes.length && !hasTreat) warnings.push('artifact lane present but treatments/evidence missing');

    var pct = totAll ? Math.round(totHave / totAll * 100) : 0;
    var proofTier = pct >= 70 ? 'full' : (pct >= 35 ? 'partial' : 'sparse');

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
        'diagnosis-specific bundle anchors preferred over generic medicine evidence',
        'official/primary sources retained (FDA/CDC/CMS/WHO/NIH/ClinicalTrials.gov where present)',
        'mechanisms prioritized over figures under prompt-space limits',
        'treatments with implementation relevance preferred over broad narrative',
        'caps applied per field; full data preserved in the stored bundle + full DDP'
      ],
      retainedWarnings: warnings
        .concat(s.healthImmune ? ['immune: ' + s.healthImmune.immuneState + ' (sev ' + s.healthImmune.severity + ', ' + (s.healthImmune.antigens || []).length + ' antigens)'] : [])
        .concat(s.healthConscience && s.healthConscience.conscienceState === 'restrictive' ? ['conscience: ' + (s.healthConscience.blockedClaims || []).slice(0, 3).join(', ') + ' blocked'] : []),
      retainedBlockers: artifactContext.blockers,
      immuneSummary: s.healthImmune ? { immuneState: s.healthImmune.immuneState, severity: s.healthImmune.severity, antigenCount: (s.healthImmune.antigens || []).length, quarantines: s.healthImmune.quarantines, blockedFromTraversal: s.healthImmune.blockedFromTraversal, allowedWithWarning: s.healthImmune.allowedWithWarning } : null,
      awarenessSummary: s.healthAwareness ? { selfNarrative: s.healthAwareness.selfNarrative, knowns: (s.healthAwareness.knowns || []).length, unknowns: (s.healthAwareness.unknowns || []).length, humanReviewRequired: s.healthAwareness.humanReviewRequired } : null,
      conscienceDecision: s.healthConscience ? { conscienceState: s.healthConscience.conscienceState, blockedClaims: s.healthConscience.blockedClaims, artifactReadinessDecision: s.healthConscience.artifactReadinessDecision } : null,
      intuitionSummary: s.healthIntuition ? s.healthIntuition.hunches : null,
      scenarioSummary: s.healthSimulation ? (s.healthSimulation.scenarios || []).map(function (x) { return { type: x.type, hypothetical: x.hypothetical, risk: x.risk }; }) : null,
      executiveReport: s.healthExecutiveReport || null,
      authoringIntake: treatmentContext.authoringIntake.length ? treatmentContext.authoringIntake : null,
      clinicalPipelineSummary: s.clinicalPipelineLayer && s.clinicalPipelineLayer.loaded ? { count: s.clinicalPipelineLayer.count, activeCount: s.clinicalPipelineLayer.activeCount, diagnoses: s.clinicalPipelineLayer.diagnoses, note: s.clinicalPipelineLayer.note } : null
    };

    return {
      schemaVersion: HDDP_SCHEMA_VERSION,
      promptView: promptView,
      identity: identity,
      brainState: brainState,
      portalContext: portalContext,
      evidence: evidence,
      treatmentContext: treatmentContext,
      operatorContext: operatorContext,
      artifactContext: artifactContext,
      audit: {
        generatedAt: (hm.updated || null),
        schemaVersion: HDDP_SCHEMA_VERSION,
        fieldCompleteness: { sections: comp, overallPct: pct },
        missingFields: missingFields,
        warnings: warnings,
        proofTier: proofTier,
        immune: s.healthImmune || null,
        awareness: s.healthAwareness || null,
        conscience: s.healthConscience || null,
        intuition: s.healthIntuition || null,
        simulation: s.healthSimulation || null,
        executiveReport: s.healthExecutiveReport || null
      }
    };
  };

  // ══════════════════════════════════════════════════════════════════════
  // INSTANTIATE AND REGISTER
  // ══════════════════════════════════════════════════════════════════════

  var brain = new MedicineBrain();
  brain.init();
  brain.start();

  window.LIMENHealthBrain = brain;
  window.LIMENDomainBrains.register(brain);

  // ══════════════════════════════════════════════════════════════════════
  // AUTO-LOAD MEDICINE OPERATOR STACK
  // ══════════════════════════════════════════════════════════════════════

  var _isDomainConsole = window.location.pathname.indexOf('domain-console') !== -1;
  var _isMedicineDomain = (new URLSearchParams(window.location.search)).get('domain') === 'medicine';
  if (_isDomainConsole && _isMedicineDomain) {
    window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION = true;
    var _medicineScripts = [
      'assets/js/medicine-compensation.js',
      'assets/js/medicine-claim-ledger.js',
      'assets/js/medicine-claim-flow.js',
      'assets/js/medicine-opportunity-economics.js',
      'assets/js/medicine-pulse-engine.js',
      'assets/js/medicine-operator-panel.js',
      'assets/js/medicine-node-business-engine.js',
      'assets/js/medicine-business-review.js',
      'assets/js/medicine-execution-panels.js',
      'assets/js/medicine-business-build.js',
      'assets/js/medicine-directive-extractor.js',
      'assets/js/medicine-directive-ranker.js',
      'assets/js/medicine-directive-translator.js',
      'assets/js/medicine-targeting-engine.js',
      'assets/js/medicine-promotion-bridge.js',
      'assets/js/medicine-clarity-operator.js'
    ];
    (function loadNext(i) {
      if (i >= _medicineScripts.length) return;
      var s = document.createElement('script');
      s.src = _medicineScripts[i];
      s.onload = function () { loadNext(i + 1); };
      s.onerror = function () { console.warn('[MedicineBrain] Failed to load ' + _medicineScripts[i]); loadNext(i + 1); };
      document.head.appendChild(s);
    })(0);
  }

})();
