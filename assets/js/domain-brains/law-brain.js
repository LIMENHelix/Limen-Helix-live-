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
      }
    ];
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
        path: 'PATENTABLE',
        urgency: stress > 0.70 ? 'high' : 'medium',
        source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
      });

      // Regtech infrastructure
      if (stress >= 0.50) {
        add({
          title: dxLabel + ' — regulatory technology and monitoring infrastructure',
          rank: stress * dx.relevance * 0.9,
          path: 'GRANT-ELIGIBLE',
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
        path: 'PATENTABLE',
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
          path: 'GRANT-ELIGIBLE',
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
        path: 'GRANT-ELIGIBLE',
        urgency: stress > 0.70 ? 'medium' : 'watching',
        source: 'lagging', tier: 3,
        diagnosisId: 'harmonization', stress: stress
      });

      add({
        title: 'Permitting acceleration — procedural bottleneck mitigation',
        rank: stress * 0.70,
        path: 'PATENTABLE',
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
        path: 'PATENTABLE',
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
          path: 'PATENTABLE',
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
    var _COMP = {
      'GRANT-ELIGIBLE': { type: 'grant',  base: 10, unit: '%',        tier: 1, nextTier: { tier: 2, comp: 15, requirement: '3 successful grant awards' },     maxTier: { tier: 3, comp: 25 } },
      'INVESTABLE':     { type: 'invest', base: 5,  unit: 'profit%',  tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
      'PATENTABLE':     { type: 'patent', base: 10, unit: 'royalty%', tier: 1, nextTier: { tier: 2, comp: 15, requirement: '3 patents filed' },                maxTier: { tier: 3, comp: 25 } }
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
        else if (o.path === 'GRANT-ELIGIBLE' && pb.realWorld && pb.realWorld.apply) target = pb.realWorld.apply;
        else if (o.path === 'PATENTABLE' && pb.realWorld && pb.realWorld.build) target = pb.realWorld.build;
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
    });
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
