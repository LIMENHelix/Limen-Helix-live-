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
          path: 'GRANT-ELIGIBLE',
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
            path: 'PATENTABLE',
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
          path: 'GRANT-ELIGIBLE',
          urgency: 'medium',
          source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
        });
        if (stress >= 0.50) {
          add({
            title: 'Remote patient monitoring and adherence support platforms',
            rank: stress * dx.relevance * 0.8,
            path: 'PATENTABLE',
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
          path: 'PATENTABLE',
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
            path: 'GRANT-ELIGIBLE',
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
          path: 'PATENTABLE',
          urgency: 'medium',
          source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
        });
        if (stress >= 0.50) {
          add({
            title: 'Diagnostic uncertainty reduction — AI-assisted clinical decision support',
            rank: stress * dx.relevance * 0.85,
            path: 'PATENTABLE',
            urgency: 'medium',
            source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
          });
        }
      }
    }

    // Terminal companies
    var terminalCompanies = companies.filter(function (c) { return c.phase === 'p7a' || c.phase === 'p9'; });
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
    var stressedCompanies = companies.filter(function (c) { return c.phase === 'p3' || c.phase === 'p5'; });
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
        path: this.state.convergence.primary_signal === 'CONVERGENCE_TERMINAL' ? 'INVESTABLE' : 'GRANT-ELIGIBLE',
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
          path: 'PATENTABLE',
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
        path: 'GRANT-ELIGIBLE',
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
        path: 'GRANT-ELIGIBLE',
        urgency: stress > 0.70 ? 'high' : 'medium',
        source: 'lagging', tier: 3,
        diagnosisId: 'workforce_capacity', stress: stress
      });

      add({
        title: 'Drug safety surveillance and adverse event monitoring platform',
        rank: stress * 0.72,
        path: 'PATENTABLE',
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
          path: 'PATENTABLE',
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
      'GRANT-ELIGIBLE': { type: 'grant',  base: 10, unit: '%',        tier: 1, nextTier: { tier: 2, comp: 15, requirement: '3 successful grant awards' },     maxTier: { tier: 3, comp: 25 } },
      'INVESTABLE':     { type: 'invest', base: 5,  unit: 'profit%',  tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
      'PATENTABLE':     { type: 'patent', base: 10, unit: 'royalty%', tier: 1, nextTier: { tier: 2, comp: 15, requirement: '3 patents filed' },                maxTier: { tier: 3, comp: 25 } }
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
        else if (o.path === 'GRANT-ELIGIBLE' && pb.realWorld && pb.realWorld.apply) target = pb.realWorld.apply;
        else if (o.path === 'PATENTABLE' && pb.realWorld && pb.realWorld.build) target = pb.realWorld.build;
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
    });
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
