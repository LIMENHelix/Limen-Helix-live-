/**
 * law-brain.js — Law Domain Cognitive Engine
 *
 * Extends DomainBrainBase. Same architecture as energy/finance/trade brains.
 *
 * Diagnosis matching: maps live signal conditions to law portal issues
 *   JUDICIAL_CRISIS → court backlog, delayed rulings, procedural bottleneck
 *   CONSTITUTIONAL_VIOLATION → rights challenge, due process failure, overreach
 *   REGULATORY_CAPTURE → regulatory favoritism, enforcement bias, agency capture
 *   MASS_INCARCERATION → sentencing surge, overcrowding, recidivism spike
 *   INTERNATIONAL_LAW_BREAKDOWN → treaty violation, sanctions conflict, sovereignty dispute
 *
 * Cross-domain emissions:
 *   law → finance (compliance cost / legal overhang)
 *   law → supplyChain (customs / regulatory friction)
 *   law → governance (policy conflict / institutional strain)
 *   law → energy (sector regulation pressure)
 *
 * Exposes: window.LIMENLawBrain
 */
(function () {
  'use strict';

  if (!window.LIMENDomainBrainBase) {
    console.warn('[LawBrain] DomainBrainBase not loaded');
    return;
  }

  var Base = window.LIMENDomainBrainBase;

  function LawBrain() {
    Base.call(this, {
      domainId: 'law',
      label: 'Law',
      snapshotKey: 'law',
      cycleInterval: 30000
    });
  }

  LawBrain.prototype = Object.create(Base.prototype);
  LawBrain.prototype.constructor = LawBrain;

  // ══════════════════════════════════════════════════════════════════════
  // INIT — register diagnosis index and emission rules
  // ══════════════════════════════════════════════════════════════════════

  LawBrain.prototype.init = function () {
    Base.prototype.init.call(this);

    // Keys MUST match portal issue IDs in law.json
    this.diagnosisIndex = {
      'JUDICIAL_CRISIS':              ['court_backlog', 'delayed_rulings', 'procedural_bottleneck', 'permitting_slowdown', 'blocked_approvals', 'law_high_stress'],
      'CONSTITUTIONAL_VIOLATION':     ['rights_challenge', 'due_process_failure', 'overreach', 'constitutional_conflict', 'law_high_stress', 'structural_stress'],
      'REGULATORY_CAPTURE':           ['regulatory_favoritism', 'enforcement_bias', 'agency_capture', 'rule_expansion', 'compliance_burden', 'reporting_overload'],
      'MASS_INCARCERATION':           ['sentencing_surge', 'overcrowding', 'recidivism_spike', 'enforcement_escalation', 'law_high_stress'],
      'INTERNATIONAL_LAW_BREAKDOWN':  ['treaty_violation', 'sanctions_conflict', 'sovereignty_dispute', 'cross_border_mismatch', 'macro_shock']
    };

    this.emissionRules = [
      {
        targetDomain: 'governance',
        signalType: 'rule_legitimacy_load',
        condition: function (s) { return s.stress >= 0.40; },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.55); }
      },
      {
        targetDomain: 'finance',
        signalType: 'compliance_litigation_pressure',
        condition: function (s) { return s.stress >= 0.45; },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); }
      },
      {
        targetDomain: 'communication',
        signalType: 'speech_information_constraint',
        condition: function (s) { return s.stress >= 0.50; },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.4); }
      },
      {
        targetDomain: 'population',
        signalType: 'migration_civil_rights_pressure',
        condition: function (s) { return s.stress >= 0.50; },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); }
      },
      {
        targetDomain: 'religion',
        signalType: 'institutional_rights_restriction',
        condition: function (s) { return s.stress >= 0.55; },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.35); }
      },
      // ── ADDED: diagnosis-gated cross-domain paths (parity with energy; law = JUDICIAL system) ──
      // Each requires an ACTIVE diagnosis (not stress alone) per the energy gating contract.
      {
        targetDomain: 'finance',
        signalType: 'compliance_litigation_pressure',
        condition: function (s) { return s.diagnoses && s.diagnoses.some(function (d) { return d.active && (d.id === 'JUDICIAL_CRISIS' || d.id === 'REGULATORY_CAPTURE'); }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); }
      },
      {
        targetDomain: 'governance',
        signalType: 'rule_legitimacy_load',
        condition: function (s) { return s.diagnoses && s.diagnoses.some(function (d) { return d.active && (d.id === 'CONSTITUTIONAL_VIOLATION' || d.id === 'INTERNATIONAL_LAW_BREAKDOWN'); }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.55); }
      },
      {
        targetDomain: 'supplyChain',
        signalType: 'regulatory_friction',
        condition: function (s) { return s.diagnoses && s.diagnoses.some(function (d) { return d.active && d.id === 'REGULATORY_CAPTURE'; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); }
      },
      {
        targetDomain: 'population',
        signalType: 'rights_restriction_pressure',
        condition: function (s) { return s.diagnoses && s.diagnoses.some(function (d) { return d.active && (d.id === 'MASS_INCARCERATION' || d.id === 'CONSTITUTIONAL_VIOLATION'); }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); }
      },
      {
        targetDomain: 'technology',
        signalType: 'antitrust_ip_enforcement',
        condition: function (s) { return s.diagnoses && s.diagnoses.some(function (d) { return d.active && d.id === 'REGULATORY_CAPTURE'; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.4); }
      }
    ];

    // ── COGNITION PARITY bootstrap loaders (one-shot, offline-safe) ──
    try { this._loadLawOperators(); } catch (e) {}                  // real legal-services / regtech / court-tech operators (state.companies starved)
    try { this._loadLawBrainSignals(); } catch (e) {}              // distress ONLY from the validated Thing pipeline
    try { this._loadLawDiagnosisBundles(); } catch (e) {}         // load real artifact-source bundles (only ones that exist)
    try { this._loadLawL1PortalDepth(); } catch (e) {}           // scan L1 branches (treatments mad-lib -> NOT admitted; real entities only)
    try { this._loadLawRuleOfLawSublayer(); } catch (e) {}      // rule-of-law sub-portal (real-content, unbundled) as an additive LAYER

    // Inbound external-signal handler: ingest cross-domain pressure as a PRIOR modifier
    // (governance/communication/medicine/infrastructure/technology -> law), NOT a second scorer.
    try { this._installLawExternalSignalHandler(); } catch (e) {}
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 1: Ingest feeds — base ingest from /api/domain-snapshot pulls all
  // 10 law feeds (Federal Register, Regulations.gov, CourtListener, PACER,
  // DOJ, SEC Enforcement, CFPB, U.S. Courts caseload, AFCARS, SCOTUS).
  //
  // This override is a DEFENSIVE FALLBACK only: if the API returns fewer
  // feeds than the registry catalog declares (e.g. a fetch function fails
  // or is removed), the missing entries get appended as placeholders so
  // the pipeline trace still shows the full configured catalog.
  // Under normal operation the override appends nothing.
  // ══════════════════════════════════════════════════════════════════════

  LawBrain.prototype.ingestFeeds = function () {
    var self = this;
    return Base.prototype.ingestFeeds.call(this).then(function () {
      var registry = window.LIMENDomainRegistry;
      if (!registry || typeof registry.getById !== 'function') return;
      var lawConfig = registry.getById('law');
      if (!lawConfig || !lawConfig.feeds) return;

      if (!Array.isArray(self.state.feeds)) self.state.feeds = [];
      var existing = {};
      for (var i = 0; i < self.state.feeds.length; i++) {
        if (self.state.feeds[i] && self.state.feeds[i].name) {
          existing[self.state.feeds[i].name] = true;
        }
      }

      for (var ci = 0; ci < lawConfig.feeds.length; ci++) {
        var f = lawConfig.feeds[ci];
        if (!f || !f.name || existing[f.name]) continue;
        self.state.feeds.push({
          name: f.name,
          live: false,                  // Placeholder — awaiting API integration
          value: 0,
          label: f.endpoint || '',
          channel: 'stress',
          updated: null,
          configured: true              // Marker so UI can show "configured but not yet wired"
        });
      }
    });
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 2: Normalize signals into law-native semantics
  // ══════════════════════════════════════════════════════════════════════

  LawBrain.prototype.normalizeSignals = function () {
    var signals = [];
    var rawSignals = (this._rawDomain && this._rawDomain.signals) || [];

    for (var i = 0; i < rawSignals.length; i++) {
      signals.push(rawSignals[i]);
    }

    this._activeConditions = [];

    // ── LAW FEED THRESHOLDS (calibrated to actual feed regimes) ──
    //
    // Law feeds come in three value regimes that need different thresholds:
    //   1. JSON catalog APIs (Federal Register, Regulations.gov)
    //      → return TOTAL counts in the thousands (e.g. 10000 federal rules)
    //      → threshold > 200 is appropriate for these high-volume catalogs
    //   2. RSS proxy (Google News keyword search via _fetchRSS in api/)
    //      → return article counts saturated at ~100 per query
    //      → threshold > 30 captures elevated activity, > 60 is sustained
    //   3. Direct .gov / blog RSS (uscourts.gov, scotusblog.com)
    //      → return small item counts (5-20 items per RSS feed)
    //      → threshold ≥ 5 is the natural elevated baseline
    //
    // Lowering generically would create false positives. Per-feed-name
    // thresholds keep the brain calibrated to each source's actual scale.

    var feeds = this.state.feeds;
    for (var fi = 0; fi < feeds.length; fi++) {
      var f = feeds[fi];
      var name = f.name || '';
      var val = f.value || 0;

      // ── Regime 1: JSON catalog APIs (high-volume) ──
      if ((name === 'Federal Register' || name === 'Regulations.gov') && val > 200) {
        this._activeConditions.push('rule_expansion');
        this._activeConditions.push('compliance_burden');
        signals.push('ELEVATED: Regulatory volume high (' + name + ' ' + val + ') — compliance burden increasing');
      }

      // ── Regime 2: Enforcement (RSS proxy ~100 max, threshold 30) ──
      if ((name === 'DOJ Press Releases' || name === 'SEC Enforcement Actions' || name === 'CFPB Enforcement' || name.indexOf('Enforcement') !== -1) && val >= 30) {
        this._activeConditions.push('enforcement_escalation');
        signals.push('ELEVATED: Enforcement activity (' + name + ' ' + val + ')');
      }

      // ── Regime 3a: Direct .gov / blog RSS court feeds (small item counts) ──
      // uscourts.gov news RSS publishes ~10-20 items at a time
      if ((name === 'U.S. Courts Federal Caseload') && val >= 5) {
        this._activeConditions.push('court_backlog');
        this._activeConditions.push('delayed_rulings');
        signals.push('ELEVATED: Federal court news activity (' + val + ' items)');
      }

      // ── Regime 3b: RSS proxy court / docket feeds (saturate at ~100) ──
      // PACER/CourtListener Google News proxies — 30+ articles is meaningful
      if ((name === 'PACER Docket Activity' || name === 'CourtListener') && val >= 30) {
        this._activeConditions.push('court_backlog');
        this._activeConditions.push('delayed_rulings');
        signals.push('ELEVATED: Federal docket activity (' + name + ' ' + val + ')');
      }

      // ── Generic Court/Docket fallback for any other feed names ──
      // Higher threshold to avoid double-counting the named feeds above
      if (name && (name.indexOf('Court') !== -1 || name.indexOf('Docket') !== -1)
          && name !== 'U.S. Courts Federal Caseload'
          && name !== 'PACER Docket Activity'
          && name !== 'CourtListener'
          && name !== 'Supreme Court Opinions'
          && name !== 'HHS AFCARS Family Court'
          && val >= 50) {
        this._activeConditions.push('court_backlog');
        this._activeConditions.push('delayed_rulings');
      }

      // ── Supreme Court constitutional rulings (direct RSS, low counts) ──
      if (name === 'Supreme Court Opinions' && val >= 5) {
        this._activeConditions.push('constitutional_conflict');
        this._activeConditions.push('rights_challenge');
        signals.push('ELEVATED: Supreme Court activity (' + val + ' items)');
      }
      // Family law / child welfare / parental rights
      if (f.name && (f.name.indexOf('AFCARS') !== -1 || f.name.indexOf('Family') !== -1 || f.name.indexOf('Children') !== -1) && f.value > 50) {
        this._activeConditions.push('rights_challenge');
        this._activeConditions.push('due_process_failure');
        signals.push('ELEVATED: Family law / parental-rights pressure rising');
      }

      // ── INSTITUTIONAL FEED-DERIVED CONDITIONS (Federal Register agency-specific + cross-domain) ──
      // These target the "laws not worth the paper" decay angle: regulatory bloat
      // + enforcement escalation = REGULATORY_CAPTURE; carceral state expansion =
      // MASS_INCARCERATION; cross-border enforcement = INTERNATIONAL_LAW_BREAKDOWN.
      var fn = (name || '').toLowerCase();

      // Fed Reg DOJ — Justice Department regulatory + enforcement coupling
      // High DOJ rule volume = enforcement-machinery growth → REGULATORY_CAPTURE / MASS_INCARCERATION
      if (fn.indexOf('fed reg doj') !== -1 && val >= 5) {
        this._activeConditions.push('enforcement_escalation');
        signals.push('Fed Reg DOJ: ' + val + ' regulatory docs (30d)');
      }
      if (fn.indexOf('fed reg doj') !== -1 && val >= 10) {
        this._activeConditions.push('rule_expansion');
        this._activeConditions.push('compliance_burden');
        this._activeConditions.push('agency_capture');
      }

      // Fed Reg DEA — drug enforcement → MASS_INCARCERATION
      if (fn.indexOf('fed reg dea') !== -1 && val >= 3) {
        this._activeConditions.push('enforcement_escalation');
        signals.push('Fed Reg DEA: ' + val + ' drug-enforcement docs (30d)');
      }
      if (fn.indexOf('fed reg dea') !== -1 && val >= 6) {
        this._activeConditions.push('sentencing_surge');
        this._activeConditions.push('overcrowding');
      }

      // Fed Reg Bureau of Prisons — direct carceral-system policy
      if (fn.indexOf('fed reg bop') !== -1 && val >= 2) {
        this._activeConditions.push('overcrowding');
        signals.push('Fed Reg BOP: ' + val + ' Bureau of Prisons docs (30d)');
      }
      if (fn.indexOf('fed reg bop') !== -1 && val >= 5) {
        this._activeConditions.push('recidivism_spike');
        this._activeConditions.push('sentencing_surge');
      }

      // OFAC Recent Actions — sanctions / extraterritorial enforcement → INTERNATIONAL_LAW_BREAKDOWN
      if (fn.indexOf('ofac') !== -1 && val >= 15) {
        this._activeConditions.push('sanctions_conflict');
        signals.push('OFAC: ' + val + ' sanctions designations — extraterritorial enforcement');
      }
      if (fn.indexOf('ofac') !== -1 && val >= 30) {
        this._activeConditions.push('treaty_violation');
        this._activeConditions.push('cross_border_mismatch');
      }

      // CISA KEV — emerging cyber-law gap (laws lag tech)
      if (fn.indexOf('cisa kev') !== -1 && val >= 10) {
        this._activeConditions.push('regulatory_favoritism');
        signals.push('CISA KEV: ' + val + ' newly-exploited CVEs — cyber-law enforcement gap');
      }
      if (fn.indexOf('cisa kev') !== -1 && val >= 25) {
        this._activeConditions.push('overreach');
        this._activeConditions.push('constitutional_conflict');
      }

      // ── INSTITUTIONAL DECAY CO-FIRE: high regulatory volume + low Court activity ──
      // If Federal Register / Regulations.gov is high (rule expansion) AND federal
      // caseload moderate, this is "rules without enforcement teeth" → regulatory
      // capture. Brain checks rule_expansion + enforcement_escalation co-presence
      // at end of feed loop.
      if (this._activeConditions.indexOf('rule_expansion') !== -1 &&
          this._activeConditions.indexOf('enforcement_escalation') !== -1) {
        if (this._activeConditions.indexOf('regulatory_favoritism') === -1) {
          this._activeConditions.push('regulatory_favoritism');
        }
        if (this._activeConditions.indexOf('enforcement_bias') === -1) {
          this._activeConditions.push('enforcement_bias');
        }
      }
    }

    // Check for defense/geopolitical signals affecting law
    var snap = this._getSnapshot();
    if (snap && snap.defenseSignals) {
      for (var si = 0; si < snap.defenseSignals.length; si++) {
        var sig = snap.defenseSignals[si];
        if (sig.affectedDomains && sig.affectedDomains.indexOf('law') !== -1) {
          this._activeConditions.push(sig.eventType);
          if (sig.eventType === 'SANCTIONS' || sig.eventType === 'TREATY_VIOLATION') {
            this._activeConditions.push('sanctions_conflict');
            this._activeConditions.push('cross_border_mismatch');
          }
        }
      }
    }

    // Check macro shock
    if (snap && snap.macroShock && snap.macroShock.detected) {
      this._activeConditions.push('macro_shock');
    }

    // Stress-derived conditions
    if (this.state.stress >= 0.65) this._activeConditions.push('law_high_stress');
    if (this.state.maturity === 'STRUCTURAL') this._activeConditions.push('structural_stress');

    // Check cross-domain pressure
    var extPressure = this.getExternalPressure ? this.getExternalPressure() : 0;
    if (extPressure >= 0.15) {
      this._activeConditions.push('regulatory_favoritism');
    }

    this.state.signals = signals;
    return Promise.resolve();
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 4: Derive diagnoses — condition-matched from portal
  // ══════════════════════════════════════════════════════════════════════

  LawBrain.prototype.deriveDiagnoses = function () {
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
      // Neuro-substrate telemetry (advisory): brain state (pulse-less capable) -> runtime overlay via generic adapter.
      try {
        if (window.DomainTelemetryAdapter && typeof window.DomainTelemetryAdapter.fromLiveCached === "function") {
          window.DomainTelemetryAdapter.fromLiveCached("law", self.state, self._runtimeOverlay || null)
            .then(function (ov) { if (ov) self._runtimeOverlay = ov; }).catch(function () {});
        }
      } catch (_e) {}
    });
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 5: Recommend treatments for active diagnoses
  // ══════════════════════════════════════════════════════════════════════

  LawBrain.prototype.recommendTreatments = function () {
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

  LawBrain.prototype.surfaceOpportunities = function () {
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

      // Compliance automation platform
      add({
        title: dxLabel + ' — compliance automation and workflow platform',
        rank: stress * dx.relevance,
        path: 'RESEARCHABLE',
        urgency: stress > 0.70 ? 'high' : 'medium',
        source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
      });

      // Regtech infrastructure
      if (stress >= 0.50) {
        add({
          title: dxLabel + ' — regulatory technology and monitoring infrastructure',
          rank: stress * dx.relevance * 0.9,
          path: 'INVESTABLE',
          urgency: stress > 0.70 ? 'high' : 'medium',
          source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
        });
      }

      // Legal ops / case management
      if (stress >= 0.55 && dx.relevance >= 0.2) {
        add({
          title: dxLabel + ' — legal operations and case management optimization',
          rank: stress * 0.85,
          path: 'INVESTABLE',
          urgency: 'medium',
          source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
        });
      }

      // Evidence management
      add({
        title: dxLabel + ' — evidence management and legal analytics',
        rank: stress * dx.relevance * 0.75,
        path: 'RESEARCHABLE',
        urgency: 'medium',
        source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
      });
    }

    // Terminal companies
    var terminalCompanies = [] /* neutralized: distress only from validated gate (see energy-brain) */;
    if (terminalCompanies.length > 0) {
      add({
        title: 'Law terminal entity distressed positioning',
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
        title: 'Law stressed-but-operating entity selection',
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
        title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — law convergence response',
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
        title: 'Law \u2192 ' + targetLabel + ' transmission — ' + sigLabel + ' response',
        rank: (em.magnitude || 0.5) * stress * 0.8,
        path: 'INVESTABLE',
        urgency: em.magnitude > 0.6 ? 'high' : 'medium',
        source: 'cross_domain', tier: 2,
        diagnosisId: 'law_emission_' + em.targetDomain,
        stress: stress
      });

      if (em.targetDomain === 'finance') {
        add({
          title: 'Compliance cost transmission — financial compliance tooling demand',
          rank: stress * 0.7,
          path: 'INVESTABLE',
          urgency: 'medium',
          source: 'cross_domain', tier: 2,
          diagnosisId: 'finance_compliance', stress: stress
        });
      }

      if (em.targetDomain === 'governance') {
        add({
          title: 'Policy conflict strain — governance harmonization advisory',
          rank: stress * 0.75,
          path: 'INVESTABLE',
          urgency: 'medium',
          source: 'cross_domain', tier: 2,
          diagnosisId: 'governance_policy', stress: stress
        });
      }
    }

    // ═══ TIER 3 — LAGGING / SYSTEM RESPONSE ═══
    if (stress >= 0.50) {
      add({
        title: 'Regulatory harmonization and simplification advisory',
        rank: stress * 0.65,
        path: 'INVESTABLE',
        urgency: stress > 0.70 ? 'medium' : 'watching',
        source: 'lagging', tier: 3,
        diagnosisId: 'harmonization', stress: stress
      });

      add({
        title: 'Permitting acceleration — procedural bottleneck mitigation',
        rank: stress * 0.70,
        path: 'RESEARCHABLE',
        urgency: 'medium',
        source: 'lagging', tier: 3,
        diagnosisId: 'permitting_accel', stress: stress
      });
    }

    if (stress >= 0.60) {
      add({
        title: 'Legal infrastructure hardening — court modernization and e-filing',
        rank: stress * 0.75,
        path: 'INVESTABLE',
        urgency: stress > 0.70 ? 'high' : 'medium',
        source: 'lagging', tier: 3,
        diagnosisId: 'court_modernization', stress: stress
      });

      add({
        title: 'Policy navigation platform — multi-jurisdiction compliance mapping',
        rank: stress * 0.72,
        path: 'RESEARCHABLE',
        urgency: 'medium',
        source: 'lagging', tier: 3,
        diagnosisId: 'policy_navigation', stress: stress
      });

      add({
        title: 'Legal bottleneck positioning — alternative dispute resolution',
        rank: stress * 0.68,
        path: 'INVESTABLE',
        urgency: 'medium',
        source: 'lagging', tier: 3,
        diagnosisId: 'adr_positioning', stress: stress
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
    // Canonical enrichment — merge law playbook detail per opportunity
    var PB_LIST = window.LIMENLawOpportunityPlaybooks || [];
    var _byId = {};
    for (var _pbi = 0; _pbi < PB_LIST.length; _pbi++) _byId[PB_LIST[_pbi].id] = PB_LIST[_pbi];
    var _PB_MAP = {
      'JUDICIAL_CRISIS': 'judicial_crisis',
      'CONSTITUTIONAL_VIOLATION': 'constitutional_violation',
      'REGULATORY_CAPTURE': 'regulatory_capture',
      'MASS_INCARCERATION': 'mass_incarceration',
      'INTERNATIONAL_LAW_BREAKDOWN': 'international_law_breakdown'
    };
    var _LAGGING_MAP = {
      'adr_positioning': 'judicial_crisis',
      'court_modernization': 'judicial_crisis',
      'finance_compliance': 'regulatory_capture',
      'governance_policy': 'regulatory_capture',
      'harmonization': 'international_law_breakdown',
      'permitting_accel': 'regulatory_capture',
      'policy_navigation': 'regulatory_capture'
    };
    function _resolvePbId(o) {
      if (o.diagnosisId && _PB_MAP[o.diagnosisId]) return _PB_MAP[o.diagnosisId];
      if (o.source === 'lagging' && o.diagnosisId && _LAGGING_MAP[o.diagnosisId]) return _LAGGING_MAP[o.diagnosisId];
      if (o.nearDiagnosisId && _PB_MAP[o.nearDiagnosisId]) return _PB_MAP[o.nearDiagnosisId];
      return null;
    }
    function _urgencyLabel(u) { if (u === 'high') return 'IMMEDIATE'; if (u === 'medium') return 'ACTIVE'; if (u === 'watching') return 'WATCH'; return (u || '').toUpperCase(); }
    // Lanes: investment + research ONLY (patent/grant/loan purged 2026-06-21; relaned GRANT->INVESTABLE, PATENT->RESEARCHABLE)
    var _COMP = {
      'INVESTABLE':   { type: 'invest',   base: 5, unit: 'profit%', tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
      'RESEARCHABLE': { type: 'research', base: 5, unit: 'credit%', tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 published research briefs' },     maxTier: { tier: 3, comp: 15 } }
    };
    for (var oi = 0; oi < opps.length; oi++) {
      var o = opps[oi];
      o.id = (o.diagnosisId || o.nearDiagnosisId || o.source || 'opp').replace(/[^a-zA-Z0-9]/g, '_') + '_' + (o.path || '').toLowerCase().replace(/[^a-z]/g, '') + '_t' + (o.tier || 0);
      o.domain = 'law';
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
        var evidenceParts = ['Domain: law', 'Stress: ' + stressPct + '%'];
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

  LawBrain.prototype._checkDiagnosisActions = function () {
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; });
    if (activeDx.length === 0) return;

    var adapters = window.LIMENActionAdapters;
    if (!adapters) return;

    for (var i = 0; i < activeDx.length; i++) {
      var dx = activeDx[i];
      var existingDrafts = adapters.getDrafts({ domain: 'law', intentId: dx.id });
      if (existingDrafts && existingDrafts.length > 0) continue;

      adapters.createDraft('REPORT_GENERATION', {
        domain: 'law',
        sourceType: 'domain_brain',
        sourceId: dx.id,
        intentId: dx.id,
        title: 'Law Alert: ' + dx.label,
        intent: {
          domain: 'law',
          title: dx.label,
          status: 'ACTIVE',
          priority: this.state.stress,
          progress: 0,
          strategyType: 'diagnosis_response',
          steps: [
            { type: 'ANALYZE', label: 'Assess ' + dx.label + ' impact on legal/regulatory system', status: 'PENDING' },
            { type: 'INVESTIGATE', label: 'Identify affected entities, jurisdictions, and obligations', status: 'PENDING' },
            { type: 'POSITION', label: 'Evaluate compliance and legal ops opportunities from ' + dx.label, status: 'PENDING' }
          ]
        }
      });
    }
  };

  LawBrain.prototype.resolveDeepContent = function () {
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

  var _origCycle = LawBrain.prototype.cycle;
  LawBrain.prototype.cycle = function () {
    var self = this;
    return _origCycle.call(this).then(function () {
      return self.resolveDeepContent();
    }).then(function () {
      // Higher cognition: predictive self-model + metacognition (runs AFTER diagnoses settle)
      try { self._updateLawModel(); } catch (e) {}
    });
  };

  // ══════════════════════════════════════════════════════════════════════
  // HIGHER COGNITION — predictive self-model + metacognition (law).
  // Generic predictive-coding substrate (prior → observe → prediction error →
  // regulation → update prior) + awareness / conscience / immune / intuition /
  // simulation / executive-report, a rule-of-law sub-portal LAYER, and the
  // 8-section DomainDiagnosisPacket the console SELF-MODEL panel consumes.
  // Mirrors energy/governance STRUCTURE exactly; only the CONTENT is law
  // (legal system & courts, judiciary & rule of law, litigation & dispute
  // resolution, regulation & compliance, contracts & enforcement, IP law,
  // criminal justice, legal services & access to justice). Distinct from
  // governance (policy/administration/elections), intelligence (espionage),
  // and finance (capital markets). Never fabricates evidence. Real legal-sector
  // / index identifiers only (US Courts caseload, PACER, Federal Register, OFAC,
  // ABA, DOJ, SCOTUS, World Justice Project Rule-of-Law Index, V-Dem judiciary).
  // ══════════════════════════════════════════════════════════════════════
  var LM_VERSION = 1;
  var LM_LEARNING_RATE = 0.25;
  var LM_SLOW_RATE = 0.08;
  var LM_STRESS_FLOOR = 0.35;        // legal disputes need lower activation than energy infrastructure
  var LM_FLOOD_CAP = 8;             // flooding = opportunities > 8
  var LM_STALE_MS = 1000 * 60 * 60 * 6;
  var _lmClamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  var _lmJaccardDistance = function (a, b) {
    a = a || []; b = b || [];
    if (!a.length && !b.length) return 0;
    var sa = {}, inter = 0;
    a.forEach(function (x) { sa[x] = 1; });
    b.forEach(function (x) { if (sa[x]) inter++; });
    var uni = a.length + b.length - inter;
    return uni ? 1 - inter / uni : 0;
  };

  (function () {
    var P = LawBrain.prototype;

    // Law diagnosis families — an analogy lens for monitoring, NOT evidence.
    // Structural analogies: supply-disruption -> sanctions; reliability -> judicial crisis.
    var FAMILY = {
      'judicial-failure': ['JUDICIAL_CRISIS', 'MASS_INCARCERATION'],
      'rights-erosion': ['CONSTITUTIONAL_VIOLATION', 'MASS_INCARCERATION'],
      'capture-breach': ['REGULATORY_CAPTURE', 'CONSTITUTIONAL_VIOLATION'],
      'external-rupture': ['INTERNATIONAL_LAW_BREAKDOWN', 'REGULATORY_CAPTURE'],
      'order-vs-legitimacy': ['JUDICIAL_CRISIS', 'CONSTITUTIONAL_VIOLATION']
    };

    P._neutralLawModel = function () {
      return { version: LM_VERSION, cycle: 0, prior: { expectedStress: 0.5, expectedLitigationLoad: 0.5, expectedDiagnoses: [], expectedDiagnosesCount: 0, expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, confidence: 0, samples: 0 }, observation: null, predictionError: null, predictedStress: null, regulation: null, plasticity: { learningRate: LM_LEARNING_RATE, slowRate: LM_SLOW_RATE, consolidation: 0 }, readyForHandoff: false, _lowErrorStreak: 0, updated: 0 };
    };
    // law-local observation: court metrics, caseload, case types, regulatory volume
    P._buildLawObservation = function () {
      var s = this.state || {};
      var active = (s.diagnoses || []).filter(function (d) { return d.active; });
      var feeds = s.feeds || [], fc = 0, newest = 0;
      // courtloadAvg / caseStartCount / regulatoryDocCount derived from named law feeds
      var courtloadAvg = 0, courtSamples = 0, caseStartCount = 0, regulatoryDocCount = 0;
      function _scanFeed(f) {
        if (!f) return; fc++; var u = f.updated; if (u && u > newest) newest = u;
        var nm = (f.name || '').toLowerCase(), val = f.value || 0;
        if (nm.indexOf('court') !== -1 || nm.indexOf('caseload') !== -1 || nm.indexOf('docket') !== -1 || nm.indexOf('pacer') !== -1) { courtloadAvg += val; courtSamples++; caseStartCount += val; }
        if (nm.indexOf('federal register') !== -1 || nm.indexOf('regulations.gov') !== -1 || nm.indexOf('fed reg') !== -1) { regulatoryDocCount += val; }
      }
      if (Array.isArray(feeds)) { for (var i = 0; i < feeds.length; i++) _scanFeed(feeds[i]); }
      else { for (var k in feeds) { if (feeds.hasOwnProperty(k)) _scanFeed(feeds[k]); } }
      var companyCount = (s.companies || []).length;
      // litigation-load index = normalized court/docket activity breadth
      var litigationLoad = Math.min(1, (courtSamples ? (courtloadAvg / courtSamples) / 100 : 0));
      return { stress: typeof s.stress === 'number' ? s.stress : 0, phase: s.phase || null, activeDiagnoses: active.map(function (d) { return d.id; }).sort(), diagnosisCount: active.length, opportunityCount: (s.opportunities || []).length, companyCount: companyCount, signal: Math.min(1, fc / 8), courtloadAvg: courtSamples ? courtloadAvg / courtSamples : 0, caseStartCount: caseStartCount, regulatoryDocCount: regulatoryDocCount, litigationLoad: litigationLoad, feedNewest: newest, timestamp: Date.now() };
    };
    // prediction error: prior judicial-load expectations vs observed
    P._computeLawPredictionError = function (prior, obs) {
      var se = Math.abs(obs.stress - prior.expectedStress), sg = Math.abs(obs.signal - prior.expectedSignal), de = _lmJaccardDistance(obs.activeDiagnoses, prior.expectedDiagnoses);
      var loadError = Math.abs(obs.litigationLoad - (prior.expectedLitigationLoad || 0));
      var od = Math.max(1, prior.expectedOpportunityCount, obs.opportunityCount), oe = Math.abs(obs.opportunityCount - prior.expectedOpportunityCount) / od;
      var diagnosisError = Math.abs(obs.diagnosisCount - (prior.expectedDiagnosesCount || 0)) / Math.max(1, obs.diagnosisCount, prior.expectedDiagnosesCount || 0);
      var total = _lmClamp(0.35 * se + 0.15 * sg + 0.2 * de + 0.15 * loadError + 0.15 * oe, 0, 1);
      return { total: total, stressError: se, signalError: sg, diagnosisError: diagnosisError, loadError: loadError, regulatoryError: Math.abs(obs.regulatoryDocCount > 0 ? Math.min(1, obs.regulatoryDocCount / 1000) : 0 - (prior.expectedSignal || 0)), opportunityError: oe, novelty: Math.max(se, de, loadError) };
    };
    // bounded prior update
    P._updateLawPrior = function (prior, obs, lr) {
      return { expectedStress: _lmClamp(prior.expectedStress + lr * (obs.stress - prior.expectedStress), 0, 1), expectedLitigationLoad: _lmClamp((prior.expectedLitigationLoad || 0) + lr * (obs.litigationLoad - (prior.expectedLitigationLoad || 0)), 0, 1), expectedDiagnoses: obs.activeDiagnoses.slice(), expectedDiagnosesCount: (prior.expectedDiagnosesCount || 0) + lr * (obs.diagnosisCount - (prior.expectedDiagnosesCount || 0)), expectedDiagnosisCount: (prior.expectedDiagnosesCount || 0) + lr * (obs.diagnosisCount - (prior.expectedDiagnosesCount || 0)), expectedOpportunityCount: prior.expectedOpportunityCount + lr * (obs.opportunityCount - prior.expectedOpportunityCount), expectedSignal: _lmClamp(prior.expectedSignal + lr * (obs.signal - prior.expectedSignal), 0, 1), confidence: _lmClamp(Math.min(1, (prior.samples + 1) / 20), 0, 1), samples: prior.samples + 1 };
    };
    // regulation state (flooding/starving/looping/stale)
    P._computeLawRegulation = function (lm, obs, pe) {
      var gain = _lmClamp(pe.novelty, 0.05, 0.95), inhib = _lmClamp(1 - pe.novelty, 0, 0.9);
      var starving = obs.stress >= LM_STRESS_FLOOR && obs.diagnosisCount === 0, flooding = obs.opportunityCount > LM_FLOOD_CAP;
      var streak = (pe.total < 0.05) ? (lm._lowErrorStreak || 0) + 1 : 0; lm._lowErrorStreak = streak; var looping = streak >= 3;
      var stale = obs.feedNewest > 0 ? (Date.now() - obs.feedNewest) > LM_STALE_MS : false;
      var overconf = lm.prior.confidence > 0.8 && pe.total > 0.4;
      var label = flooding ? 'flooding' : starving ? 'starving' : stale ? 'stale' : looping ? 'looping' : overconf ? 'overconfident' : pe.novelty > 0.4 ? 'surprised' : 'calm';
      return { gain: gain, inhibition: inhib, starving: starving, flooding: flooding, looping: looping, stale: stale, overconfident: overconf, state: label };
    };

    // ── RECURRENT STEP — the proof surface (state.lawModel) the console SELF-MODEL reads ──
    P._updateLawModel = function () {
      var lm = this.state.lawModel || this._neutralLawModel();
      var priorIn = lm.prior;
      var obs = this._buildLawObservation();
      var pe = this._computeLawPredictionError(priorIn, obs);
      var gainBlend = _lmClamp(pe.novelty, 0.05, 0.95);
      var predictedStress = priorIn.expectedStress * (1 - gainBlend) + obs.stress * gainBlend;
      var reg = this._computeLawRegulation(lm, obs, pe);
      var readyForHandoff = (lm.cycle > 0) && (predictedStress >= LM_STRESS_FLOOR) && (obs.diagnosisCount > 0) && !reg.flooding && !reg.stale;
      var nextPrior = this._updateLawPrior(priorIn, obs, lm.plasticity.learningRate);
      lm.cycle += 1; lm.observation = obs; lm.predictionError = pe; lm.predictedStress = predictedStress; lm.regulation = reg; lm.readyForHandoff = readyForHandoff; lm.prior = nextPrior; lm.updated = obs.timestamp;
      this.state.lawModel = lm;

      var mem = this.state.memory || (this.state.memory = {});
      var log = mem.outcomeLog || (mem.outcomeLog = []);
      log.push({ cycle: lm.cycle, predictionError: Math.round(pe.total * 1000) / 1000, stress: obs.stress, activeDx: obs.diagnosisCount, regulation: reg.state, timestamp: obs.timestamp }); if (log.length > 40) log.shift();

      // H1–H6 higher layers BEFORE the DDP build
      try { this._computeLawHigherLayers(); } catch (e) {}

      // RULE-OF-LAW — law sub-portal layer (additive; BEFORE the DDP build so the
      // primary packet's promptView advertises it). Never touches the validated 5-diagnosis spine.
      try { this._buildLawRuleOfLawSublayer(); } catch (e) {}

      // DDP — build the DomainDiagnosisPacket (8-section contract) for the primary diagnosis,
      // and one per diagnosis. Schema-only: never invents data. Consumed by the console SELF-MODEL.
      try {
        var _diags = this.state.diagnoses || [];
        var _primary = _diags.filter(function (d) { return d.active; })[0] || _diags[0] || null;
        var _self = this;
        lm.domainDiagnosisPacket = this._buildDomainDiagnosisPacket(_primary);
        this.state.lawDomainDiagnosisPackets = _diags.map(function (d) { return _self._buildDomainDiagnosisPacket(d); });
      } catch (e) {}

      // MANDATORY: state.cognition — generic surface domain-console-brain.js reads for ANY brain.
      this.state.cognition = {
        domain: 'law',
        lawModel: lm,
        model: { cycle: lm.cycle, predictionError: lm.predictionError, predictedStress: lm.predictedStress, regulation: lm.regulation },
        lawImmune: this.state.lawImmune || null,
        lawAwareness: this.state.lawAwareness || null,
        lawConscience: this.state.lawConscience || null,
        lawIntuition: this.state.lawIntuition || null,
        lawSimulation: this.state.lawSimulation || null,
        lawExecutiveReport: this.state.lawExecutiveReport || null,
        awareness: this.state.lawAwareness || null,
        conscience: this.state.lawConscience || null,
        immune: this.state.lawImmune || null,
        intuition: this.state.lawIntuition || null,
        ruleOfLawSublayer: this.state.lawRuleOfLawLayer || null,
        treatments: this.state.treatments || [],
        diagnoses: this.state.diagnoses || [],
        opportunities: this.state.opportunities || []
      };
      return lm;
    };

    P._computeLawHigherLayers = function () {
      this._computeLawImmune(); this._computeLawAwareness(); this._computeLawConscience(); this._computeLawIntuition();
      try { this._computeLawSimulation(); } catch (e) {}
      try { this._computeLawExecutiveReport(); } catch (e) {}
    };

    // ── H1 — immune (antigen scan over bundle/feed/regulation state) ──
    P._computeLawImmune = function () {
      var s = this.state, lm = s.lawModel || {}, reg = lm.regulation || {}, ant = [];
      var bs = (typeof this._lawBundleStates === 'function') ? this._lawBundleStates() : [];
      bs.forEach(function (b) {
        if (b.bundleStatus === 'missing') ant.push({ type: 'source-bundle-missing', dx: b.dxId, severity: 'medium', action: 'block-from-prompt-evidence' });
        if (b.buildMethod === 'external-source-authored') ant.push({ type: 'external-source-authored-needs-human-verification', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
        if (b.aliasRisk === 'medium' || b.aliasRisk === 'high') ant.push({ type: 'alias-risk-bundle', dx: b.dxId, severity: b.aliasRisk, action: 'allow-with-warning' });
        if (b.bundleStatus === 'found' && b.shallow) ant.push({ type: 'root-only-shallow-bundle', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
      });
      var pe = (lm.predictionError && lm.predictionError.total) || 0;
      if (pe > 0.4) ant.push({ type: 'prediction-error-spike', severity: 'medium', action: 'lower-confidence', value: Math.round(pe * 1000) / 1000 });
      if (reg.stale) ant.push({ type: 'stale-feeds', severity: 'low', action: 'flag' });
      if (reg.flooding) ant.push({ type: 'opportunity-flood', severity: 'medium', action: 'inhibit' });
      if (reg.starving) ant.push({ type: 'stress-without-diagnosis', severity: 'low', action: 'flag' });
      var _l1 = s._l1DepthCache;
      if (_l1 && _l1.byDiagnosis && Object.keys(_l1.byDiagnosis).some(function (dx) { return _l1.byDiagnosis[dx].madLibTreatments > 0; })) {
        ant.push({ type: 'l1-synthetic-treatments', severity: 'medium', action: 'quarantine', note: 'L1 portal treatments are mad-lib templates (fixed-verb family); quarantined from evidence — only real legal-services/regtech/court-tech identifiers surfaced relevance-unverified' });
      }
      var sev = ant.some(function (a) { return a.severity === 'high'; }) ? 'high' : ant.some(function (a) { return a.severity === 'medium'; }) ? 'medium' : ant.length ? 'low' : 'none';
      s.lawImmune = {
        version: 1, immuneState: sev === 'high' ? 'alert' : sev === 'medium' ? 'active' : sev === 'low' ? 'watch' : 'clear', severity: sev,
        antigens: ant.slice(0, 12),
        quarantines: ['L1-portal-treatments-madlib'],
        allowedWithWarning: ant.filter(function (a) { return a.action === 'allow-with-warning'; }).map(function (a) { return a.type + (a.dx ? (':' + a.dx) : ''); }),
        blockedFromPrompt: ant.filter(function (a) { return a.action === 'block-from-prompt-evidence'; }).map(function (a) { return a.dx; }),
        blockedFromTraversal: ['L2'],
        lastScanAt: lm.updated || null
      };
      return s.lawImmune;
    };
    // ── H2 — awareness (narrative on rule-of-law integrity / judicial-independence pressure / regulatory-capture signal) ──
    P._computeLawAwareness = function () {
      var s = this.state, lm = s.lawModel || {}, im = s.lawImmune || {}, active = (s.diagnoses || []).filter(function (d) { return d.active; });
      var pe = (lm.predictionError && lm.predictionError.total) || 0, dxNames = active.map(function (d) { return d.label || d.id; });
      // regulatory-capture signal: rule_expansion + enforcement_escalation co-fire
      var cond = s._activeConditions || [];
      var captureSignal = cond.indexOf('rule_expansion') !== -1 && cond.indexOf('enforcement_escalation') !== -1;
      s.lawAwareness = {
        version: 1, selfState: im.immuneState === 'alert' ? 'guarded' : (lm.regulation && lm.regulation.state) || 'unknown',
        knowns: dxNames.slice(0, 6),
        uncertainties: ['interpretive tracker — diagnoses are signal-driven readings of judicial-load / rule-of-law / regulatory-coherence pressure, not validated', 'high-stress diagnoses require corroboration by institutionally strong sources (US Courts caseload / PACER / DOJ / SCOTUS / World Justice Project Rule-of-Law Index / V-Dem judiciary)', 'predictionError=' + (Math.round(pe * 1000) / 1000)],
        ruleOfLawIntegrity: captureSignal ? 'regulatory-capture signal present (rule_expansion + enforcement_escalation co-fire)' : 'no capture co-fire detected',
        judicialIndependencePressure: cond.indexOf('court_backlog') !== -1 || cond.indexOf('delayed_rulings') !== -1 ? 'elevated (docket/disposition pressure)' : 'baseline',
        confidenceDrivers: ['regulation ' + ((lm.regulation && lm.regulation.state) || '?'), active.length + ' active dx'],
        selfNarrative: 'Law: ' + active.length + ' active diagnosis pathway' + (active.length !== 1 ? 's' : '') + ' (' + (dxNames.slice(0, 3).join(', ') || 'none') + '), regulation=' + ((lm.regulation && lm.regulation.state) || '?') + ', immune=' + (im.immuneState || '?') + ', litigation-load=' + (Math.round(((lm.observation && lm.observation.litigationLoad) || 0) * 100) / 100) + ', prediction-error ' + (Math.round(pe * 100) / 100) + '.',
        lastAwarenessAt: lm.updated || null
      };
      return s.lawAwareness;
    };
    // ── H3 — conscience (artifact readiness; LAW does INVESTABLE/RESEARCHABLE only — no patent/grant per 2026 rules) ──
    P._computeLawConscience = function () {
      var s = this.state, lm = s.lawModel || {}, pe = (lm.predictionError && lm.predictionError.total) || 0, cautions = [];
      if (pe > 0.4) cautions.push({ claim: 'high-confidence-claim', reason: 'predictionError spike ' + (Math.round(pe * 1000) / 1000) });
      var bs = (typeof this._lawBundleStates === 'function') ? this._lawBundleStates() : [];
      bs.forEach(function (b) {
        if (b.buildMethod === 'external-source-authored') cautions.push({ claim: 'strong-claim:' + b.dxId, reason: 'external-source-authored; human-verification-required' });
      });
      s.lawConscience = { version: 1, conscienceState: 'restrictive', vetoes: [{ claim: 'patent/grant', reason: 'patent/grant lanes retired across all domains (2026-06-21); legal bundles have no method/embodiment/figure fields' }], cautions: cautions.slice(0, 8), allowedClaims: ['source-summary', 'legal-brief-with-warnings'], blockedClaims: ['patent-claim', 'grant-claim'], artifactReadinessDecision: { patentReady: false, grantReady: false, investmentReady: true, researchReady: true, note: 'patent/grant vetoed; investment/research allowed-with-warning (high-stress legal claims need US Courts/PACER/DOJ/SCOTUS/WJP Rule-of-Law corroboration)' }, reasons: ['overclaim prevention', 'interpretive-not-validated', 'legal-source-sufficiency'], lastCheckAt: lm.updated || null };
      return s.lawConscience;
    };
    // ── H4 — intuition (hunches on regime drift / novel enforcement authority / uncovered diagnoses / structural analogies) ──
    P._computeLawIntuition = function () {
      var s = this.state, lm = s.lawModel || {}, reg = lm.regulation || {}, log = (s.memory && s.memory.outcomeLog) || [], hunches = [];
      if (log.length >= 2) { var a = log[log.length - 2].predictionError, b = log[log.length - 1].predictionError; if (typeof a === 'number' && typeof b === 'number' && b - a > 0.05) hunches.push({ hunch: 'legal regime drift forming (prediction error rising) — emerging enforcement escalation or rule-of-law strain', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'predictionError rose ' + a + ' → ' + b, verifyIf: 'error keeps rising 2+ cycles', falsifyIf: 'error returns to baseline' }); }
      if (reg.state === 'surprised') hunches.push({ hunch: 'novel enforcement authority / abrupt judicial reversal entering the system', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'regulation = surprised', verifyIf: 'a specific diagnosis activates with institutional source support (DOJ/SCOTUS/Federal Register)', falsifyIf: 'novelty subsides next cycle' });
      var missing = (typeof this._lawBundleStates === 'function' ? this._lawBundleStates() : []).filter(function (x) { return x.bundleStatus === 'missing' && x.active; });
      if (missing.length) hunches.push({ hunch: 'recurring uncovered diagnosis: ' + missing[0].dxId, confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'active diagnosis with no source bundle', verifyIf: 'a real legal source bundle is built', falsifyIf: 'diagnosis deactivates' });
      var patternMatches = [], recent = log.slice(-10), regCount = {};
      recent.forEach(function (e) { if (e.regulation) regCount[e.regulation] = (regCount[e.regulation] || 0) + 1; });
      Object.keys(regCount).forEach(function (k) { if (regCount[k] >= 3) patternMatches.push({ pattern: 'recurring regulation state: ' + k, occurrences: regCount[k], window: recent.length, evidenceStatus: 'UNVERIFIED' }); });
      var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
      var primaryId = (active[0] || {}).id, analogies = [];
      Object.keys(FAMILY).forEach(function (fam) { if (FAMILY[fam].indexOf(primaryId) >= 0) { FAMILY[fam].forEach(function (sib) { if (sib !== primaryId) analogies.push({ analogy: primaryId + ' resembles ' + sib, family: fam, evidenceStatus: 'UNVERIFIED', note: 'shared legal failure-family — a lens for monitoring, not a claim (structural: supply-disruption→OFAC/sanctions; reliability→JUDICIAL_CRISIS)' }); }); } });
      var hm = this._lawHunchMemory = this._lawHunchMemory || {};
      var curKeys = {}; hunches.forEach(function (h) { curKeys[h.hunch] = true; hm[h.hunch] = (hm[h.hunch] || 0) + 1; });
      var promotedToMonitoring = [], rejectedHunches = [];
      Object.keys(hm).forEach(function (k) {
        if (!curKeys[k]) { rejectedHunches.push({ hunch: k, reason: 'signal subsided across cycles (falsifier path)' }); delete hm[k]; return; }
        if (hm[k] >= 3) promotedToMonitoring.push({ target: k, basis: 'recurred ' + hm[k] + ' cycles', note: 'monitoring target ONLY — never evidence or diagnosis' });
      });
      s.lawIntuition = { version: 1, hunches: hunches.slice(0, 6), patternMatches: patternMatches.slice(0, 5), analogies: analogies.slice(0, 6), promotedToDiagnosis: [], promotedToMonitoring: promotedToMonitoring.slice(0, 4), rejectedHunches: rejectedHunches.slice(0, 4), confidence: 'LOW', evidenceStatus: 'UNVERIFIED', lastAt: lm.updated || null };
      return s.lawIntuition;
    };
    // ── H5 — bounded counterfactual simulation (hypothetical only; UNVERIFIED) ──
    // 5 scenarios: worsen, stabilize, recover, litigation-shock, regulatory-cascade
    P._computeLawSimulation = function () {
      var s = this.state, lm = s.lawModel || {};
      var base = typeof s.stress === 'number' ? s.stress : 0;
      function cl(v) { return Math.max(0, Math.min(1, Math.round(v * 1000) / 1000)); }
      var scenarios = [
        { type: 'worsen', hypothetical: true, assumption: 'judicial stressor intensifies (docket backlog deepens / disposition time extends)', simulatedStress: cl(base + 0.2), risk: 'cascade toward systemic court paralysis (JUDICIAL_CRISIS)', intervention: 'track US Courts caseload + PACER docket activity + average disposition time per court tier', falsifier: 'stress flat or falling next cycle' },
        { type: 'stabilize', hypothetical: true, assumption: 'legal stressor holds at an elevated baseline', simulatedStress: cl(base), risk: 'persistent rule-of-law drag / chronic access-to-justice gap', intervention: 'maintain monitoring cadence on WJP Rule-of-Law Index + V-Dem judiciary + ABA legal-profession data', falsifier: 'stress moves materially' },
        { type: 'recover', hypothetical: true, assumption: 'legal stressor reverses (reform passes / backlog clears)', simulatedStress: cl(base - 0.2), risk: 'premature de-escalation before structural reform lands', intervention: 'confirm with 2 independent institutional sources before standing down', falsifier: 'stress re-rises' },
        { type: 'litigation-shock', hypothetical: true, assumption: 'sudden mass-litigation event (multidistrict / class action / enforcement wave)', simulatedStress: cl(base + 0.3), risk: 'litigation overload concentrates in already-stressed courts (JUDICIAL_CRISIS / compliance-cost transmission to finance)', intervention: 'track DOJ press releases + SEC/CFPB enforcement + CourtListener case starts', falsifier: 'case-start rate normalizes' },
        { type: 'regulatory-cascade', hypothetical: true, assumption: 'rule expansion + enforcement escalation co-fire (regulatory capture advances)', simulatedStress: cl(base + 0.25), risk: 'agency capture / enforcement bias entrenchment (REGULATORY_CAPTURE)', intervention: 'track Federal Register / Regulations.gov volume vs enforcement evenness + OFAC sanctions actions', falsifier: 'rule volume and enforcement decouple' }
      ];
      var sim = {
        version: 1, scenarios: scenarios, assumptions: scenarios.map(function (x) { return x.assumption; }),
        simulatedStress: scenarios.map(function (x) { return x.simulatedStress; }),
        simulatedDiagnoses: ['JUDICIAL_CRISIS', 'REGULATORY_CAPTURE', 'CONSTITUTIONAL_VIOLATION', 'MASS_INCARCERATION'], simulatedOpportunities: [],
        risks: scenarios.map(function (x) { return x.risk; }), interventions: scenarios.map(function (x) { return x.intervention; }),
        falsifiers: scenarios.map(function (x) { return x.falsifier; }), lastSimulatedAt: lm.updated || null
      };
      s.lawSimulation = sim; return sim;
    };
    // ── H6 — executive self-report (compact brain-status card) ──
    P._computeLawExecutiveReport = function () {
      var s = this.state, lm = s.lawModel || {}, im = s.lawImmune || {}, aw = s.lawAwareness || {}, con = s.lawConscience || {}, it = s.lawIntuition || {}, sim = s.lawSimulation || {};
      var bs = (typeof this._lawBundleStates === 'function') ? this._lawBundleStates() : [];
      var covered = bs.filter(function (b) { return b.bundleStatus === 'found'; }).length;
      var hv = bs.filter(function (b) { return b.humanVerification === 'required'; }).length;
      var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
      var strongest = active[0] || (s.diagnoses || [])[0] || null;
      var pe = (lm.predictionError && lm.predictionError.total) || 0;
      var status = im.immuneState === 'alert' ? 'immune-alert' : hv > 0 ? 'human-review-required' : (bs.length && covered < bs.length) ? 'source-limited' : (lm.regulation && lm.regulation.starving) ? 'starving' : (lm.regulation && lm.regulation.state === 'surprised') ? 'surprised' : 'healthy';
      var rep = {
        version: 1, brainStatus: status,
        litigationLoad: Math.round(((lm.observation && lm.observation.litigationLoad) || 0) * 1000) / 1000,
        strongestDiagnosis: strongest ? strongest.id : null,
        strongestOpportunity: (s.opportunities && s.opportunities[0] && s.opportunities[0].title) || null,
        confidence: Math.round((1 - pe) * 100) / 100, predictionError: Math.round(pe * 1000) / 1000,
        regulationState: (lm.regulation && lm.regulation.state) || null, immuneState: im.immuneState || null,
        awarenessSummary: aw.selfNarrative || null, conscienceDecision: con.conscienceState || null,
        intuitionSummary: (it.hunches || []).length + ' hunch(es)', simulationSummary: (sim.scenarios || []).length + ' scenario(s)',
        artifactReadiness: con.artifactReadinessDecision || null, blockers: (con.blockedClaims || []).slice(0, 6),
        nextBestAction: (bs.length && covered < bs.length) ? 'build/verify legal source bundles for uncovered diagnoses (US Courts/PACER/DOJ/SCOTUS/WJP)' : hv > 0 ? 'human-verify external-source bundles' : 'monitor strongest diagnosis sources (docket cadence, enforcement actions, rule-of-law indices)',
        lastReportAt: lm.updated || null
      };
      s.lawExecutiveReport = rep; return rep;
    };
  })();

  // ════════════════════════════════════════════════════════════════════════════
  // LAW COGNITION PARITY — fallback loaders, source-bundle machinery, L1 mad-lib
  // scan, rule-of-law sub-portal layer, the 8-section DomainDiagnosisPacket the
  // console SELF-MODEL consumes, and the inbound external-signal handler. Mirrors
  // governance/energy STRUCTURE exactly; only the CONTENT is law. Real legal-sector
  // / index identifiers only. Never fabricates evidence.
  // ════════════════════════════════════════════════════════════════════════════

  // ── DDP schema helpers ──
  var LAW_DDP_SCHEMA_VERSION = 'law-ddp-1';
  function _lawDdpPresent(v) {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (v === 'missing' || v === '' || v === 'none') return false;
    return true;
  }
  function _lawDdpCompleteness(section, keys) {
    var have = 0; for (var i = 0; i < keys.length; i++) { if (_lawDdpPresent(section[keys[i]])) have++; }
    return { have: have, total: keys.length, pct: keys.length ? Math.round(have / keys.length * 100) : 0 };
  }

  // ── Fallback: REAL legal-sector operators (state.companies starved). Law binds
  //    mostly to courts/indices/institutions, not single companies; where entities are
  //    needed these are real, listed, law-sector-exposed operators. Prefer command-board-data
  //    (d='law' && ticker); else this curated real map. Only VERIFIED public tickers with
  //    law-sector binding (legal-services / regtech-compliance / court-tech / legal-ops). ──
  var LAW_REAL_OPERATORS = [
    { ticker: 'RELX', name: 'RELX (LexisNexis)', type: 'legal-services', domain: 'law', law_focus: 'legal research, IP/litigation analytics, risk & compliance data' },
    { ticker: 'TRI', name: 'Thomson Reuters (Westlaw)', type: 'legal-services', domain: 'law', law_focus: 'legal research (Westlaw), legal-ops & tax/compliance software' },
    { ticker: 'VERX', name: 'Vertex', type: 'regtech', domain: 'law', law_focus: 'tax compliance automation & regulatory determination' },
    { ticker: 'CSGP', name: 'CoStar Group', type: 'legal-ops', domain: 'law', law_focus: 'records/analytics infrastructure adjacent to regulatory/compliance workflows' },
    { ticker: 'TYL', name: 'Tyler Technologies', type: 'court-tech', domain: 'law', law_focus: 'court case management, e-filing & justice-system modernization' },
    { ticker: 'AXON', name: 'Axon Enterprise', type: 'court-tech', domain: 'law', law_focus: 'law-enforcement evidence data, digital-evidence & court records' }
  ];
  // Real institutional / index sources (evidence-anchor authoring targets; NOT companies).
  var LAW_INDEX_SOURCES = ['U.S. Courts caseload', 'PACER', 'CourtListener', 'Federal Register', 'Regulations.gov', 'DOJ', 'SEC Enforcement', 'CFPB', 'OFAC', 'SCOTUS', 'ABA', 'Federal Judicial Center', 'World Justice Project Rule-of-Law Index', 'V-Dem Judiciary Component'];

  LawBrain.prototype._loadLawOperators = function () {
    var self = this;
    if (self._lawOperators) return;            // one-shot
    self._lawOperators = LAW_REAL_OPERATORS.slice();   // curated real default; merged with command-board below
    try {
      fetch('/assets/data/command-board-data.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data) return;
          var arr = Array.isArray(data) ? data : (Object.keys(data).map(function (k) { return data[k]; }).find(Array.isArray) || []);
          var cb = arr
            .filter(function (x) { return x && x.d === 'law' && x.t; })
            .map(function (x) { return { name: x.n, ticker: x.t, cik: x.c, phase: x.p, trajectory: x.tr, type: 'legal-sector', domain: 'law' }; });
          if (cb.length) {
            var seen = {}; self._lawOperators.forEach(function (o) { seen[o.ticker] = true; });
            cb.forEach(function (o) { if (!seen[o.ticker]) { seen[o.ticker] = true; self._lawOperators.push(o); } });
          }
        })
        .catch(function () {});
    } catch (e) {}
  };

  // ── Distress signals come ONLY from the validated Thing pipeline. One-shot. ──
  LawBrain.prototype._loadLawBrainSignals = function () {
    var self = this;
    if (self._pubSignals) return;                  // one-shot
    self._pubSignals = {};
    try {
      fetch('/api/brain-signals?domain=law')
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
  //    else LAW_DIAGNOSIS_ALIASES. Non-aliased diagnoses are canonical to themselves. ──
  var LAW_DIAGNOSIS_ALIASES = {
    JUDICIAL_CRISIS:             { target: 'JUDICIAL_SYSTEM_OVERLOAD', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits JUDICIAL_SYSTEM_OVERLOAD for docket backlog / delayed rulings / procedural bottleneck' },
    CONSTITUTIONAL_VIOLATION:    { target: 'CONSTITUTIONAL_RIGHTS_BREACH', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits CONSTITUTIONAL_RIGHTS_BREACH for rights challenge / due-process failure / overreach' },
    REGULATORY_CAPTURE:          { target: 'REGULATORY_CAPTURE_EVENT', reviewStatus: 'human-approved', risk: 'medium', note: 'mapped to regulatory-capture bundle; verify enforcement-bias evidence is appropriate before strong claims' },
    MASS_INCARCERATION:          { target: 'CARCERAL_SYSTEM_STRAIN', reviewStatus: 'human-approved', risk: 'medium', note: 'mapped to carceral-strain bundle; verify sentencing/overcrowding evidence is appropriate' },
    INTERNATIONAL_LAW_BREAKDOWN: { target: 'INTERNATIONAL_LEGAL_RUPTURE', reviewStatus: 'human-approved', risk: 'medium', note: 'mapped to international-legal-rupture bundle; verify treaty/sanctions evidence is appropriate' }
  };
  LawBrain.prototype._resolveLawCanonicalDiagnosis = function (dxId) {
    if (!dxId) return { canonicalDiagnosisId: null, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };
    var target = null;
    try {
      var idx = (typeof window !== 'undefined') ? window.LIMENArtifactSourceIndex : null;
      if (idx && idx.aliases) { var row = idx.aliases()[dxId]; if (row && row.target) target = row.target; }
    } catch (e) {}
    var local = LAW_DIAGNOSIS_ALIASES[dxId] || null;
    if (!target && local) target = local.target;
    if (target) {
      return { canonicalDiagnosisId: target, aliasUsed: true, aliasReviewStatus: (local && local.reviewStatus) || 'corpus-aliased', aliasRisk: (local && local.risk) || 'low', aliasNote: (local && local.note) || null };
    }
    return { canonicalDiagnosisId: dxId, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };   // canonical to self
  };

  // ── Load REAL source bundles (one-shot, async). Resolves aliases BEFORE fetching.
  //    Only files that exist resolve to 'found'; 404s -> 'missing'. Never fabricates. ──
  LawBrain.prototype._loadLawDiagnosisBundles = function () {
    var self = this;
    if (self._lawBundleLoadPromise) return self._lawBundleLoadPromise;
    self._bundleCache = self._bundleCache || {};
    self._bundleStatusMap = self._bundleStatusMap || {};
    var ids = {};
    var known = ['JUDICIAL_CRISIS', 'CONSTITUTIONAL_VIOLATION', 'REGULATORY_CAPTURE', 'MASS_INCARCERATION', 'INTERNATIONAL_LAW_BREAKDOWN'];
    var diags = (self.state && self.state.diagnoses) || [];
    var allDxIds = diags.map(function (d) { return d.id; }).concat(known);
    for (var i = 0; i < allDxIds.length; i++) { var c = self._resolveLawCanonicalDiagnosis(allDxIds[i]).canonicalDiagnosisId; if (c) ids[c] = true; }
    self._lawBundleLoadPromise = Promise.all(Object.keys(ids).map(function (cid) {
      return fetch('/assets/data/artifact-source-index/by-diagnosis/' + encodeURIComponent(cid) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) { self._bundleStatusMap[cid] = data ? 'found' : 'missing'; if (data) self._bundleCache[cid] = data; })
        .catch(function () { self._bundleStatusMap[cid] = 'missing'; });
    })).then(function () { return self._bundleCache; });
    return self._lawBundleLoadPromise;
  };

  // ── _lawBundleStates — per-diagnosis canonical resolution + bundle status + provenance ──
  LawBrain.prototype._lawBundleStates = function () {
    var self = this; var diags = (this.state && this.state.diagnoses) || [];
    return diags.map(function (d) {
      var c = self._resolveLawCanonicalDiagnosis(d.id);
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
  //    evidence. Only real legal identifiers surface (relevance-unverified). ──
  var LAW_MADLIB_VERB = /^(Develop|Establish|Implement|Build|Launch|Design|Deploy|Operationalize|Conduct|Create|Define|Assess|Optimize|Modernize|Strengthen|Enhance|Formalize|Institute|Standardize|Coordinate|Integrate|Calibrate|Evaluate|Streamline|Institutionalize|Configure|Monitor|Reform|Audit|Oversee|Adjudicate|Litigate|Mediate|Arbitrate)\b/;
  LawBrain.prototype._isLawMadLibTreatment = function (label) { return !label || LAW_MADLIB_VERB.test(String(label)); };

  LawBrain.prototype._loadLawL1PortalDepth = function () {
    var self = this;
    if (self._lawL1LoadPromise) return self._lawL1LoadPromise;
    // L1 mad-lib scanner: diagnoses -> portal branches. REAL law sub-portal branch files.
    var BRANCH = {
      JUDICIAL_CRISIS: ['courts', 'caseload'],
      CONSTITUTIONAL_VIOLATION: ['constitutional', 'dueprocess'],
      REGULATORY_CAPTURE: ['regcompliance', 'enforcement'],
      MASS_INCARCERATION: ['sentencing', 'crim_procedure'],
      INTERNATIONAL_LAW_BREAKDOWN: ['intllaw', 'sanctions']
    };
    self._lawL1Branches = BRANCH;
    var branches = {}; Object.keys(BRANCH).forEach(function (dx) { BRANCH[dx].forEach(function (b) { branches[b] = true; }); });
    var byBranch = {};
    self._lawL1LoadPromise = Promise.all(Object.keys(branches).map(function (b) {
      return fetch('/assets/data/domains/law_' + encodeURIComponent(b) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) {
          if (!data) { byBranch[b] = null; return; }
          var acts = data.activations || [], tickers = {}, total = 0, mad = 0;
          acts.forEach(function (a) {
            (a.companies || []).forEach(function (c) { if (c && c.ticker_or_id) tickers[c.ticker_or_id] = c.name || c.ticker_or_id; });
            (a.treatments || []).forEach(function (t) { var l = t && (t.label || t.title); if (l) { total++; if (self._isLawMadLibTreatment(l)) mad++; } });
          });
          byBranch[b] = { file: 'law_' + b, companyTickers: Object.keys(tickers).map(function (k) { return { ticker: k, name: tickers[k] }; }), treatmentTotal: total, madLibCount: mad, realTreatmentCount: total - mad };
        })
        .catch(function () { byBranch[b] = null; });
    })).then(function () {
      var byDiagnosis = {};
      Object.keys(BRANCH).forEach(function (dx) {
        var tk = {}, total = 0, mad = 0, scanned = 0;
        BRANCH[dx].forEach(function (b) { var r = byBranch[b]; if (r) { scanned++; r.companyTickers.forEach(function (c) { tk[c.ticker] = c.name; }); total += r.treatmentTotal; mad += r.madLibCount; } });
        byDiagnosis[dx] = { branchesScanned: scanned, realCompanyTickers: Object.keys(tk).map(function (k) { return { ticker: k, name: tk[k], relevanceUnverified: true }; }), treatmentTotal: total, madLibTreatments: mad, realTreatments: total - mad, admitted: false, reason: 'L1 treatments are mad-lib templates (fixed-verb family) — not source-grade; only legal-services/regtech/court-tech identifiers surfaced, relevance unverified' };
      });
      self.state._l1DepthCache = { byBranch: byBranch, byDiagnosis: byDiagnosis, scannedAt: (self.state.lawModel && self.state.lawModel.updated) || null };
      return self.state._l1DepthCache;
    });
    return self._lawL1LoadPromise;
  };

  // ── RULE-OF-LAW sub-portal layer (law-specific institution-level layer, distinct from
  //    governance policy/admin). Tracks judicial independence, equal access to justice,
  //    enforcement evenness, regulatory compliance. Real-content, citation-backed.
  //    NEVER merged into the validated 5-diagnosis spine. Prefer a hand-authored
  //    law_rule-of-law.json; fall back to a real internal sub-portal. Graceful 404. ──
  LawBrain.prototype._loadLawRuleOfLawSublayer = function () {
    var self = this;
    if (self._lawRoLLoadPromise) return self._lawRoLLoadPromise;
    self._lawRoLLoadPromise = fetch('/assets/data/domains/law_rule-of-law.json')
      .then(function (r) { return (r && r.ok) ? r.json() : null; })
      .then(function (data) { if (data) return data; return fetch('/assets/data/domains/law_courts.json').then(function (r2) { return (r2 && r2.ok) ? r2.json() : null; }); })
      .then(function (data) {
        if (!data) { self._rolPortal = null; return null; }
        self._rolPortal = { issues: data.issues || [], activations: data.activations || [], title: data.title || 'Rule of Law' };
        return self._rolPortal;
      })
      .catch(function () { self._rolPortal = null; return null; });
    return self._lawRoLLoadPromise;
  };

  LawBrain.prototype._computeLawRuleOfLawSublayer = function () { return this._buildLawRuleOfLawSublayer(); };

  LawBrain.prototype._buildLawRuleOfLawSublayer = function () {
    var self = this;
    var s = self.state, lm = s.lawModel || {}, obs = lm.observation || {}, cond = s._activeConditions || [];
    // Rule-of-law activation signals (real-data-grounded heuristics; UNVERIFIED interpretive layer):
    var activation = {
      judicial_independence_threat: cond.indexOf('constitutional_conflict') !== -1 || cond.indexOf('overreach') !== -1,
      access_disparity: cond.indexOf('court_backlog') !== -1 && cond.indexOf('delayed_rulings') !== -1,
      enforcement_bias: cond.indexOf('enforcement_bias') !== -1 || (cond.indexOf('rule_expansion') !== -1 && cond.indexOf('enforcement_escalation') !== -1),
      litigation_overload: (obs.litigationLoad || 0) > 0.5
    };
    // four institution-level tracks (real source bindings; metrics interpretive, not validated)
    var tracks = [
      { id: 'judicial_independence', label: 'Judicial independence', active: activation.judicial_independence_threat, metrics: 'tenure standards, case-assignment randomization, appeals-court diversity', sources: ['Federal Judicial Center', 'V-Dem Judiciary Component Index', 'World Justice Project Rule-of-Law Index'] },
      { id: 'equal_access', label: 'Equal access to justice', active: activation.access_disparity, metrics: 'legal-aid funding %, pro-bono capacity vs demand, court fee schedules', sources: ['ABA Legal Profession surveys', 'World Justice Project Rule-of-Law Index'] },
      { id: 'enforcement_evenness', label: 'Enforcement evenness', active: activation.enforcement_bias, metrics: 'sentencing variance across jurisdictions, disparate-impact metrics, plea-bargain asymmetry', sources: ['PACER case metrics', 'U.S. Courts caseload', 'DOJ'] },
      { id: 'regulatory_compliance', label: 'Regulatory compliance', active: activation.litigation_overload, metrics: 'OFAC sanction fairness, administrative due-process delays, licensing bottlenecks, average disposition time trending', sources: ['Federal Register', 'OFAC', 'Regulations.gov'] }
    ];
    var ruleOfLawSublayer = {
      loaded: true,
      portalTitle: (self._rolPortal && self._rolPortal.title) || 'Rule of Law',
      version: 1,
      activation: activation,
      tracks: tracks,
      activeCount: tracks.filter(function (t) { return t.active; }).length,
      // institution-level summary metrics (interpretive readings, UNVERIFIED)
      judicialIndependence: tracks[0].active ? 'pressure detected' : 'baseline',
      equalAccess: tracks[1].active ? 'access disparity signal' : 'baseline',
      enforcementEvenness: tracks[2].active ? 'enforcement-bias signal' : 'baseline',
      litigationLoadDistribution: Math.round((obs.litigationLoad || 0) * 1000) / 1000,
      note: 'rule-of-law sub-layer (institution-level: judicial independence, equal access to justice, enforcement evenness, regulatory compliance) — DISTINCT from governance policy/administration; interpretive, not validated; SEPARATE from the validated 5-diagnosis spine; real indices (WJP Rule-of-Law Index, V-Dem judiciary, Federal Judicial Center, ABA) bind here but metrics are unverified',
      lastBuiltAt: lm.updated || null
    };
    s.lawRuleOfLawLayer = ruleOfLawSublayer;
    // Also surface real-content diagnoses/treatments from the sub-portal if loaded
    var rol = self._rolPortal;
    if (rol && rol.issues && rol.issues.length) {
      var conditions = self._activeConditions || [];
      var diagnoses = rol.issues.map(function (iss) {
        var triggers = (self.diagnosisIndex && self.diagnosisIndex[iss.id]) || [];
        var matchCount = 0;
        for (var t = 0; t < triggers.length; t++) { for (var c = 0; c < conditions.length; c++) { if (conditions[c] === triggers[t] || String(conditions[c]).indexOf(triggers[t]) !== -1) matchCount++; } }
        return { id: iss.id, label: iss.label, summary: iss.summary || '', active: matchCount > 0, relevance: triggers.length ? Math.round((matchCount / triggers.length) * 100) / 100 : 0, circuits: iss.circuits || [], source: 'rule-of-law', tier: 'real-content-unbundled', branch: 'rule-of-law' };
      });
      s.lawRuleOfLawDiagnoses = diagnoses;
      ruleOfLawSublayer.portalDiagnoses = diagnoses.map(function (d) { return { id: d.id, label: d.label, active: d.active }; });
    } else {
      s.lawRuleOfLawDiagnoses = [];
    }
    return ruleOfLawSublayer;
  };

  // ── INBOUND external-signal handler. Ingest cross-domain pressure (governance/communication/
  //    medicine/infrastructure/technology -> law) as a PRIOR docket-capacity / judicial-efficiency
  //    modifier AFTER the validated scorer runs — NOT a second scorer. Mirrors the base-class
  //    receiveExternalSignal pattern; chains the prior handler if present. One-shot install. ──
  LawBrain.prototype._installLawExternalSignalHandler = function () {
    if (this._lawExternalSignalInstalled) return;
    this._lawExternalSignalInstalled = true;
    var prior = (typeof this.receiveExternalSignal === 'function') ? this.receiveExternalSignal : null;
    // Mapping: inbound signalType -> law-local prior-modifier semantics (additive external-stress only).
    var INBOUND = {
      policy_conflict_enforcement: { from: 'governance', note: 'conflicting directives / agency incoherence -> legal-authority-gap', weight: 0.5 },
      speech_regulation_pressure: { from: 'communication', note: 'platform-carriage / content-moderation regulation -> compliance-burden', weight: 0.45 },
      liability_risk_escalation: { from: 'medicine', note: 'malpractice / adverse-event trends -> litigation-docket stress', weight: 0.5 },
      permitting_delay: { from: 'infrastructure', note: 'capital-project / environmental litigation -> docket-capacity strain', weight: 0.4 },
      environmental_litigation: { from: 'infrastructure', note: 'environmental litigation surge -> docket-capacity strain', weight: 0.4 },
      antitrust_enforcement: { from: 'technology', note: 'antitrust / IP / data-privacy enforcement -> litigation exposure', weight: 0.45 },
      accreditation_pressure: { from: 'education', note: 'accreditation disputes -> administrative-law caseload', weight: 0.35 }
    };
    this.receiveExternalSignal = function (signal) {
      try {
        if (signal && signal.signalType && INBOUND[signal.signalType]) {
          var map = INBOUND[signal.signalType];
          var mag = Math.min(1, (typeof signal.magnitude === 'number' ? signal.magnitude : 0.3) * map.weight);
          // Record as an external-pressure modifier on the prior (does NOT bypass the validated scorer).
          var s = this.state || (this.state = {});
          var inbox = s._lawExternalSignals || (s._lawExternalSignals = []);
          inbox.push({ signalType: signal.signalType, sourceDomain: signal.sourceDomain || map.from, magnitude: mag, note: map.note, ts: Date.now() });
          if (inbox.length > 20) inbox.shift();
          // Nudge the model prior's docket-capacity / judicial-efficiency expectation upward (bounded).
          if (s.lawModel && s.lawModel.prior) {
            s.lawModel.prior.expectedLitigationLoad = _lmClamp((s.lawModel.prior.expectedLitigationLoad || 0) + mag * 0.15, 0, 1);
          }
        }
      } catch (e) {}
      if (prior) { try { return prior.call(this, signal); } catch (e) {} }
      return undefined;
    };
  };

  // ── DDP — the 8-section DomainDiagnosisPacket the console SELF-MODEL consumes.
  //    Mirrors governance/energy _buildDomainDiagnosisPacket exactly; CONTENT is law. ──
  LawBrain.prototype._buildDomainDiagnosisPacket = function (dx) {
    var s = this.state || {};
    var lm = s.lawModel || {};
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

    var _canon = this._resolveLawCanonicalDiagnosis(dxId);
    var identity = {
      domain: 'law',
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
      lawModel: { version: lm.version || null, cycle: (typeof lm.cycle === 'number' ? lm.cycle : null) },
      predictionError: lm.predictionError || null,
      regulationState: (lm.regulation && lm.regulation.state) || null,
      prior: lm.prior || null,
      observation: lm.observation || null,
      plasticity: lm.plasticity || null,
      readyForHandoff: lm.readyForHandoff === true
    };
    var rootId = (portal && portal.domainId) || 'law';
    var rootTitle = (portal && portal.title) || 'Law';
    var ancestry = (portal && portal.parentLabel) ? [portal.parentLabel, rootTitle] : [rootTitle];
    var portalContext = {
      portalIds: [rootId],
      portalDomain: 'law',
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
    if (!citationHints.length) citationHints = LAW_INDEX_SOURCES.slice();
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
    // empty slots (what each needs + which LAW primary/institutional source) — never fabricated.
    var _isExternal = !!(_bundle && _bundle.buildMethod === 'external-source-authored');
    var _intakeSrcHint = {
      JUDICIAL_SYSTEM_OVERLOAD: 'U.S. Courts caseload / PACER dockets / Federal Judicial Center disposition-time data / CourtListener case starts',
      CONSTITUTIONAL_RIGHTS_BREACH: 'SCOTUS opinions / Federal Register / Brennan Center civil-liberties reports / ABA constitutional-law materials',
      REGULATORY_CAPTURE_EVENT: 'Federal Register / Regulations.gov rule volume / DOJ + SEC + CFPB enforcement actions / OFAC',
      CARCERAL_SYSTEM_STRAIN: 'Bureau of Prisons data / DOJ sentencing statistics / U.S. Sentencing Commission / AFCARS family-court data',
      INTERNATIONAL_LEGAL_RUPTURE: 'OFAC Recent Actions / treaty databases / UN voting records / State Dept. reports'
    };
    var authoringIntake = [];
    if (_isExternal) {
      ['methodCandidates', 'embodimentCandidates', 'figurePlaceholders'].forEach(function (field) {
        if (_bArr(field).length === 0) authoringIntake.push({ field: field, status: 'needs-human-input', count: 0, need: field === 'methodCandidates' ? 'a concrete litigation-strategy / judicial-procedure-reform method drawn from a primary source' : field === 'embodimentCandidates' ? 'a specific court-modernization / ADR-protocol implementation from a real document' : 'a caseload-graph / disposition-time-timeline figure grounded in a real source', sourceHint: _intakeSrcHint[identity.canonicalDiagnosisId] || 'primary legal / rule-of-law-index source', note: 'NOT fabricated by the brain — author from the cited source, then wire in verbatim with attribution' });
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
    var _opTargets = (primaryOpp && primaryOpp._resolvedTargets) ? primaryOpp._resolvedTargets : (mc && mc.target ? [mc.target] : []);
    if (!_opTargets.length && this._lawOperators && this._lawOperators.length) {
      _opTargets = this._lawOperators.slice(0, 4).map(function (o) { return o.name + ' (' + o.ticker + ') — ' + (o.law_focus || o.type); });
    }
    var operatorContext = {
      targets: _opTargets,
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
      patentReady: false, grantReady: false, sbaReady: false,   // patent/grant/loan vetoed by H3 conscience
      investmentReady: !!(hasTreat && primaryOpp), researchReady: ready || hasTreat,
      readinessReasons: readinessReasons,
      blockers: blockers
    };

    var comp = {
      identity:         _lawDdpCompleteness(identity, ['domain', 'diagnosisId', 'canonicalDiagnosisId', 'label', 'phase', 'confidence']),
      brainState:       _lawDdpCompleteness(brainState, ['lawModel', 'predictionError', 'regulationState', 'prior', 'observation', 'plasticity']),
      portalContext:    _lawDdpCompleteness(portalContext, ['portalIds', 'portalDomain', 'portalTitle', 'depth', 'ancestryPath']),
      evidence:         _lawDdpCompleteness(evidence, ['sourceFeeds', 'evidenceAnchors', 'citationHints']),
      treatmentContext: _lawDdpCompleteness(treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']),
      operatorContext:  _lawDdpCompleteness(operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']),
      artifactContext:  _lawDdpCompleteness(artifactContext, ['artifactLanes'])
    };
    var totHave = 0, totAll = 0;
    for (var sk in comp) { if (comp.hasOwnProperty(sk)) { totHave += comp[sk].have; totAll += comp[sk].total; } }
    var missingFields = [];
    function _lmf(name, obj, keys) { for (var i = 0; i < keys.length; i++) { if (!_lawDdpPresent(obj[keys[i]])) missingFields.push(name + '.' + keys[i]); } }
    _lmf('identity', identity, ['canonicalDiagnosisId', 'confidence']);
    _lmf('evidence', evidence, ['evidenceAnchors', 'citationHints']);
    _lmf('treatmentContext', treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']);
    _lmf('operatorContext', operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']);

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
    if (!primaryOpp && (typeof s.stress !== 'number' || s.stress < LM_STRESS_FLOOR)) warnings.push('no active opportunity (offline/low-stress) — operator/lane fields stay empty');
    if (artifactContext.artifactLanes.length && !hasTreat) warnings.push('artifact lane present but treatments/evidence missing');

    var pct = totAll ? Math.round(totHave / totAll * 100) : 0;
    var proofTier = pct >= 70 ? 'full' : (pct >= 35 ? 'partial' : 'sparse');

    var L2_CAPS = { evidenceAnchors: 8, treatments: 8, implementationSteps: 8, mechanismCandidates: 6, methodCandidates: 6, embodimentCandidates: 6, figurePlaceholders: 6, citationHints: 8, sourceFeeds: 8 };
    function _l2cap(arr, n) { arr = Array.isArray(arr) ? arr : []; return { sel: arr.slice(0, n), omitted: Math.max(0, arr.length - n) }; }
    var _l2ea = _l2cap(evidenceAnchors, L2_CAPS.evidenceAnchors);
    var _l2tr = _l2cap(treatmentContext.treatments, L2_CAPS.treatments);
    var _l2is = _l2cap(treatmentContext.implementationSteps, L2_CAPS.implementationSteps);
    var _l2mc = _l2cap(treatmentContext.mechanismCandidates, L2_CAPS.mechanismCandidates);
    var _l2md = _l2cap(treatmentContext.methodCandidates, L2_CAPS.methodCandidates);
    var _l2em = _l2cap(treatmentContext.embodimentCandidates, L2_CAPS.embodimentCandidates);
    var _l2fg = _l2cap(treatmentContext.figurePlaceholders, L2_CAPS.figurePlaceholders);
    var _l2ch = _l2cap(citationHints, L2_CAPS.citationHints);
    var _l2sf = _l2cap(sourceFeeds, L2_CAPS.sourceFeeds);
    var promptView = {
      compact: true,
      caps: L2_CAPS,
      selectedEvidenceAnchors: _l2ea.sel,
      selectedTreatments: _l2tr.sel,
      selectedImplementationSteps: _l2is.sel,
      selectedMechanismCandidates: _l2mc.sel,
      selectedMethodCandidates: _l2md.sel,
      selectedEmbodimentCandidates: _l2em.sel,
      selectedFigurePlaceholders: _l2fg.sel,
      selectedCitationHints: _l2ch.sel,
      selectedSourceFeeds: _l2sf.sel,
      omittedCounts: { evidenceAnchors: _l2ea.omitted, treatments: _l2tr.omitted, implementationSteps: _l2is.omitted, mechanismCandidates: _l2mc.omitted, methodCandidates: _l2md.omitted, embodimentCandidates: _l2em.omitted, figurePlaceholders: _l2fg.omitted, citationHints: _l2ch.omitted, sourceFeeds: _l2sf.omitted },
      priorityReasons: [
        'diagnosis-specific bundle anchors preferred over generic law evidence',
        'official/primary legal sources retained (U.S. Courts caseload/PACER/DOJ/SCOTUS/Federal Register/OFAC/WJP Rule-of-Law/V-Dem judiciary where present)',
        'mechanisms prioritized over figures under prompt-space limits',
        'treatments with implementation relevance preferred over broad narrative',
        'caps applied per field; full data preserved in the stored bundle + full DDP'
      ],
      retainedWarnings: warnings
        .concat(s.lawImmune ? ['immune: ' + s.lawImmune.immuneState + ' (sev ' + s.lawImmune.severity + ', ' + (s.lawImmune.antigens || []).length + ' antigens; L2 traversal blocked)'] : [])
        .concat(s.lawConscience && s.lawConscience.conscienceState === 'restrictive' ? ['conscience: ' + (s.lawConscience.blockedClaims || []).slice(0, 3).join(', ') + ' blocked'] : []),
      retainedBlockers: artifactContext.blockers,
      immuneSummary: s.lawImmune ? { immuneState: s.lawImmune.immuneState, severity: s.lawImmune.severity, antigenCount: (s.lawImmune.antigens || []).length, quarantines: s.lawImmune.quarantines, blockedFromTraversal: s.lawImmune.blockedFromTraversal, allowedWithWarning: s.lawImmune.allowedWithWarning } : null,
      awarenessSummary: s.lawAwareness ? { selfNarrative: s.lawAwareness.selfNarrative, knowns: (s.lawAwareness.knowns || []).length, uncertainties: (s.lawAwareness.uncertainties || []).length } : null,
      conscienceDecision: s.lawConscience ? { conscienceState: s.lawConscience.conscienceState, blockedClaims: s.lawConscience.blockedClaims, artifactReadinessDecision: s.lawConscience.artifactReadinessDecision } : null,
      intuitionSummary: s.lawIntuition ? s.lawIntuition.hunches : null,
      scenarioSummary: s.lawSimulation ? (s.lawSimulation.scenarios || []).map(function (x) { return { type: x.type, hypothetical: x.hypothetical, risk: x.risk }; }) : null,
      executiveReport: s.lawExecutiveReport || null,
      l1DepthSummary: portalContext.l1Depth ? { realCompanyTickers: (portalContext.l1Depth.realCompanyTickers || []).length, realTreatments: portalContext.l1Depth.realTreatments, madLibTreatments: portalContext.l1Depth.madLibTreatments, admitted: portalContext.l1Depth.admitted } : null,
      authoringIntake: treatmentContext.authoringIntake.length ? treatmentContext.authoringIntake : null,
      // RULE-OF-LAW — sub-portal layer (real-content, SEPARATE from the validated spine, no bundle yet)
      ruleOfLawSummary: s.lawRuleOfLawLayer && s.lawRuleOfLawLayer.loaded ? { activeCount: s.lawRuleOfLawLayer.activeCount, tracks: (s.lawRuleOfLawLayer.tracks || []).map(function (t) { return { id: t.id, label: t.label, active: t.active }; }), litigationLoadDistribution: s.lawRuleOfLawLayer.litigationLoadDistribution, note: s.lawRuleOfLawLayer.note } : null,
      externalSignals: (s._lawExternalSignals && s._lawExternalSignals.length) ? s._lawExternalSignals.slice(-6) : null
    };

    return {
      schemaVersion: LAW_DDP_SCHEMA_VERSION,
      promptView: promptView,
      identity: identity,
      brainState: brainState,
      portalContext: portalContext,
      evidence: evidence,
      treatmentContext: treatmentContext,
      operatorContext: operatorContext,
      artifactContext: artifactContext,
      audit: {
        generatedAt: (lm.updated || null),
        schemaVersion: LAW_DDP_SCHEMA_VERSION,
        fieldCompleteness: { sections: comp, overallPct: pct },
        missingFields: missingFields,
        warnings: warnings,
        proofTier: proofTier,
        lawModel: lm || null,
        lawImmune: s.lawImmune || null,
        lawAwareness: s.lawAwareness || null,
        lawConscience: s.lawConscience || null,
        lawIntuition: s.lawIntuition || null,
        lawSimulation: s.lawSimulation || null,
        lawExecutiveReport: s.lawExecutiveReport || null,
        immune: s.lawImmune || null,
        awareness: s.lawAwareness || null,
        conscience: s.lawConscience || null,
        intuition: s.lawIntuition || null,
        simulation: s.lawSimulation || null,
        executiveReport: s.lawExecutiveReport || null
      }
    };
  };

  // ══════════════════════════════════════════════════════════════════════
  // INSTANTIATE AND REGISTER
  // ══════════════════════════════════════════════════════════════════════

  var brain = new LawBrain();
  brain.init();
  brain.start();

  window.LIMENLawBrain = brain;
  window.LIMENDomainBrains.register(brain);

  // ══════════════════════════════════════════════════════════════════════
  // AUTO-LOAD LAW OPERATOR STACK ON DOMAIN-CONSOLE
  // ══════════════════════════════════════════════════════════════════════

  var _isDomainConsole = window.location.pathname.indexOf('domain-console') !== -1;
  var _isLawDomain = (new URLSearchParams(window.location.search)).get('domain') === 'law';
  if (_isDomainConsole && _isLawDomain) {
    window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION = true;

    var _lawScripts = [
      'assets/js/law-compensation.js',
      'assets/js/law-claim-ledger.js',
      'assets/js/law-claim-flow.js',
      'assets/js/law-opportunity-economics.js',
      'assets/js/law-pulse-engine.js',
      'assets/js/law-operator-panel.js',
      'assets/js/law-node-business-engine.js',
      'assets/js/law-business-review.js',
      'assets/js/law-execution-panels.js',
      'assets/js/law-business-build.js',
      'assets/js/law-directive-extractor.js',
      'assets/js/law-directive-ranker.js',
      'assets/js/law-directive-translator.js',
      'assets/js/law-targeting-engine.js',
      'assets/js/law-promotion-bridge.js',
      'assets/js/law-clarity-operator.js'
    ];
    (function loadNext(i) {
      if (i >= _lawScripts.length) return;
      var s = document.createElement('script');
      s.src = _lawScripts[i];
      s.onload = function () { loadNext(i + 1); };
      s.onerror = function () { console.warn('[LawBrain] Failed to load ' + _lawScripts[i]); loadNext(i + 1); };
      document.head.appendChild(s);
    })(0);
  }

})();
