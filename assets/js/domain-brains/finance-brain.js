/**
 * finance-brain.js — Finance Domain Cognitive Engine
 *
 * Extends DomainBrainBase. Same architecture as energy-brain.js.
 *
 * Diagnosis matching: maps live signal conditions to finance portal files
 *   BANKING_CRISIS → credit freeze, systemic contagion, bank failures
 *   CREDIT_FREEZE → lending contraction, interbank stress, liquidity drain
 *   MARKET_CONTAGION → volatility cascade, correlation breakdown, flash crash
 *   SOVEREIGN_DEBT_CRISIS → yield spike, downgrade, default risk
 *   CURRENCY_CRISIS → currency collapse, capital flight, reserves depletion
 *   SYSTEMIC_FINANCIAL_STRESS → broad stress, structural, macro shock
 *
 * Cross-domain emissions:
 *   finance → economy (credit transmission)
 *   finance → industry (capital access)
 *   finance → trade/supplyChain (trade finance disruption)
 *   finance → infrastructure (investment contraction)
 *
 * Exposes: window.LIMENFinanceBrain
 */
(function () {
  'use strict';

  if (!window.LIMENDomainBrainBase) {
    console.warn('[FinanceBrain] DomainBrainBase not loaded');
    return;
  }

  var Base = window.LIMENDomainBrainBase;

  function FinanceBrain() {
    Base.call(this, {
      domainId: 'finance',
      label: 'Finance',
      snapshotKey: 'finance',
      cycleInterval: 30000
    });
  }

  FinanceBrain.prototype = Object.create(Base.prototype);
  FinanceBrain.prototype.constructor = FinanceBrain;

  // ══════════════════════════════════════════════════════════════════════
  // INIT — register diagnosis index and emission rules
  // ══════════════════════════════════════════════════════════════════════

  FinanceBrain.prototype.init = function () {
    Base.prototype.init.call(this);

    // ── THING2 KERNEL PHASE SOURCE (2026-07-13): make the REAL recursive phase kernel
    //    (assets/js/limen-thing2-adapter.js -> window.LIMENThing2.phaseOfSeries) the phase
    //    source for this brain's coherence router + phase-transition reward. The kernel needs a
    //    short rolling history of the domain's primary scalar; restore it from localStorage so
    //    it warms up across reloads. Guarded for absent localStorage; on any failure -> []. The
    //    kernel is PURE MATH (no network, no AI) — the 30s cycle stays deterministic + cost-free.
    this._kernelPhase = null;
    this._phaseSeries = [];
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        var _savedSeries = JSON.parse(localStorage.getItem('limen:phaseseries:finance'));
        if (Array.isArray(_savedSeries)) {
          this._phaseSeries = _savedSeries.filter(function (v) { return typeof v === 'number' && isFinite(v); }).slice(-60);
        }
      }
    } catch (_pse) { this._phaseSeries = []; }

    // ── OVERLAY ACTUATION (2026-07-13): port of Energy's actuation depth to Finance.
    // VALIDITY GATE (honest, per-actuation — see ENERGY_NEURO_AUDIT.md + DOMAIN_BUILDOUT_PLAYBOOK.md §E):
    //   servo    = TRUE  — Finance has a real controllable EFFECTOR: it emits opportunities +
    //                      REPORT_GENERATION action-drafts (LIMENActionAdapters). The regulate-to-target
    //                      servo drives inhibition toward a drive+deviation set-point; effector = proportional
    //                      emission-confidence dampening (Neuro Ref V.2/XII set-point + XIII.1 E/I).
    //   eiBrake  = TRUE  — E/I balance (XIII.1, the doc's most-repeated invariant): inhibition must scale
    //                      with drive. The brake dampens the SAME emission channel proportionally to the
    //                      inhibition deficit. Real effector, so honestly actuatable.
    //   phase    = TRUE  — Finance is THE Thing1-VALIDATED domain (P3/P7 family; live phase = P7; EDGAR /
    //                      bankruptcy kernel is validated in-envelope, PR-AUC 0.81/holdout 0.83). The
    //                      phase-transition reward is genuine ground-truth on P3/P7 transitions (thing2
    //                      lineage), not mere self-consistency — the exact condition the gate requires.
    //   refractory = TRUE — de-dup of the action-draft emission (a real effector). Absolute dead-time +
    //                      relative raised-bar (Neuro Ref III.3), implemented inline (deterministic; no
    //                      external module dependency). Fully reversible: flip any flag to false.
    // COST-SAFETY: every method below is 100% deterministic — NO paid-AI / LLM fetch runs on the 30s cycle.
    // The ONE generative slot (authorNodeBusinessFromServer) is NEVER called from the cycle and is
    // operator-triggered + killswitch-gated server-side (lib/ai-kill-switch spendDisabled()).
    this._actuation = { refractory: true, servo: true, eiBrake: true, phase: true };
    this._refractoryParams = {
      absoluteWindow: 900000,     // 15 min hard dead-time before the same diagnosis re-drafts (matches Energy)
      relativeWindow: 3600000,    // 1 hr raised-bar window (doc 1:4 ratio preserved)
      overrideThreshold: 0.9      // reduced sensitivity: only stress >= 0.9 (or a stronger stimulus) re-fires in-window
    };

    // ── One-shot cognition loaders (mirror energy/infrastructure/culture init): real entities,
    //    validated distress signals, real source bundles, L1 mad-lib scan, credit/liquidity sub-portal.
    //    STRICTLY ADDITIVE — never touches the validated scoreStress / deriveDiagnoses spine. ──
    try { this._loadFinanceCommandBoardCompanies(); } catch (e) {}  // real entities (state.companies starved)
    try { this._loadFinanceBrainSignals(); } catch (e) {}           // distress ONLY from the validated Thing pipeline
    try { this._loadFinanceDiagnosisBundles(); } catch (e) {}       // load real artifact-source bundles (only ones that exist)
    try { this._loadFinanceL1PortalDepth(); } catch (e) {}          // scan L1 branches (treatments mad-lib -> NOT admitted; real tickers only)
    try { this._loadFinanceSublayer(); } catch (e) {}               // CREDIT/LIQUIDITY: load credit sub-portal (real-content, unbundled) as an additive LAYER

    this.diagnosisIndex = {
      'BANKING_CRISIS':           ['BANKING_CRISIS', 'CREDIT_FREEZE', 'SYSTEMIC_CONTAGION', 'bank_failure', 'finance_high_stress'],
      'CREDIT_FREEZE':            ['CREDIT_FREEZE', 'lending_contraction', 'interbank_stress', 'liquidity_drain', 'structural_stress'],
      'MARKET_CRASH':             ['volatility_cascade', 'correlation_breakdown', 'flash_crash', 'market_panic', 'finance_high_stress'],
      'CURRENCY_COLLAPSE':        ['currency_collapse', 'capital_flight', 'reserves_depletion', 'fx_intervention', 'macro_shock'],
      'SYSTEMIC_CONTAGION':       ['finance_high_stress', 'structural_stress', 'macro_shock', 'systemic_risk'],
      'FRAUD_SCANDAL':            ['fraud_detected', 'accounting_irregularity', 'regulatory_action', 'finance_high_stress']
    };

    // Cross-domain emissions — GATED: require at least 1 active diagnosis
    this.emissionRules = [
      {
        targetDomain: 'economy',
        signalType: 'credit_transmission',
        condition: function (s) { return s.stress >= 0.55 && s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.6); }
      },
      {
        targetDomain: 'industry',
        signalType: 'capital_access_restriction',
        condition: function (s) { return s.stress >= 0.60 && s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); }
      },
      {
        targetDomain: 'supplyChain',
        signalType: 'trade_finance_disruption',
        condition: function (s) { return s.stress >= 0.60 && s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); }
      },
      {
        targetDomain: 'infrastructure',
        signalType: 'investment_contraction',
        condition: function (s) { return s.stress >= 0.65 && s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.4); }
      }
    ];
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 2: Normalize signals into finance-native semantics
  // ══════════════════════════════════════════════════════════════════════

  FinanceBrain.prototype.normalizeSignals = function () {
    var signals = [];
    var rawSignals = (this._rawDomain && this._rawDomain.signals) || [];

    for (var i = 0; i < rawSignals.length; i++) {
      signals.push(rawSignals[i]);
    }

    this._activeConditions = [];

    // Check feed values for finance-specific triggers
    var feeds = this.state.feeds;
    for (var fi = 0; fi < feeds.length; fi++) {
      var f = feeds[fi];
      // VIX / volatility
      if (f.name && f.name.indexOf('VIX') !== -1 && f.value > 30) {
        this._activeConditions.push('volatility_cascade');
        signals.push('ELEVATED: VIX above 30 — volatility cascade risk');
      }
      if (f.name && f.name.indexOf('VIX') !== -1 && f.value > 40) {
        this._activeConditions.push('market_panic');
        signals.push('CRITICAL: VIX above 40 — market panic conditions');
      }
      // Yield spreads
      if (f.name && (f.name.indexOf('Yield') !== -1 || f.name.indexOf('Treasury') !== -1) && f.value > 5) {
        this._activeConditions.push('yield_spike');
      }
      // Credit spreads
      if (f.name && f.name.indexOf('Credit') !== -1 && f.value > 400) {
        this._activeConditions.push('interbank_stress');
        this._activeConditions.push('lending_contraction');
      }
    }

    // Check for defense/geopolitical signals affecting finance — with TTL validation
    var snap = this._getSnapshot();
    var EVENT_TTL = 30 * 60 * 1000; // 30 minutes
    if (snap && snap.defenseSignals) {
      var now = Date.now();
      for (var si = 0; si < snap.defenseSignals.length; si++) {
        var sig = snap.defenseSignals[si];
        if (sig.affectedDomains && sig.affectedDomains.indexOf('finance') !== -1) {
          var sigAge = sig.timestamp ? (now - new Date(sig.timestamp).getTime()) : Infinity;
          if (sigAge <= EVENT_TTL) {
            this._activeConditions.push(sig.eventType);
          }
        }
      }
    }

    // Check macro shock
    if (snap && snap.macroShock && snap.macroShock.detected) {
      this._activeConditions.push('macro_shock');
    }

    // Stress-derived flags — tagged with _stress_ prefix to prevent
    // them from satisfying evidence family requirements in the pulse engine
    if (this.state.stress >= 0.70) this._activeConditions.push('_stress_finance_high');
    if (this.state.maturity === 'STRUCTURAL') this._activeConditions.push('_stress_structural');
    if (this.state.stress >= 0.80) this._activeConditions.push('_stress_systemic');

    // Cross-domain pressure from energy
    var extPressure = this.getExternalPressure ? this.getExternalPressure() : 0;
    if (extPressure >= 0.15) {
      this._activeConditions.push('correlation_breakdown');
    }

    // ── FEED-DERIVED CONDITIONS — more finance-specific triggers ──
    for (var f2i = 0; f2i < feeds.length; f2i++) {
      var f2 = feeds[f2i];
      var fn2 = (f2.name || '').toLowerCase();
      // S&P 500 / market index stress
      if ((fn2.indexOf('s&p') !== -1 || fn2.indexOf('spy') !== -1 || fn2.indexOf('market') !== -1) && f2.value !== undefined && f2.value < -3) {
        this._activeConditions.push('market_decline');
        signals.push('ELEVATED: market index declining — ' + f2.value.toFixed(1) + '%');
      }
      // Banking sector stress
      if ((fn2.indexOf('bank') !== -1 || fn2.indexOf('financial') !== -1) && f2.value !== undefined && f2.value < -5) {
        this._activeConditions.push('bank_failure');
        signals.push('ELEVATED: banking sector stress — ' + f2.value.toFixed(1) + '%');
      }
    }

    // ── INSTITUTIONAL FEED-DERIVED CONDITIONS (.gov / Fed / SRO) ──
    // Maps the 10 keyless institutional feeds to finance-brain diagnoses.
    for (var f3i = 0; f3i < feeds.length; f3i++) {
      var f3 = feeds[f3i];
      var fn3 = (f3.name || '').toLowerCase();

      // FDIC press — failure/enforcement velocity → bank_failure / regulatory_action
      if (fn3.indexOf('fdic') !== -1 && f3.value !== undefined && f3.value >= 1) {
        this._activeConditions.push('bank_failure');
        signals.push('FDIC: ' + f3.value + ' failure/enforcement signal(s)');
      }
      if (fn3.indexOf('fdic') !== -1 && f3.value !== undefined && f3.value >= 5) {
        this._activeConditions.push('SYSTEMIC_CONTAGION');
      }

      // NCUA distress — credit union bank_failure equivalent
      if (fn3.indexOf('ncua') !== -1 && f3.value !== undefined && f3.value >= 2) {
        this._activeConditions.push('bank_failure');
        signals.push('NCUA: ' + f3.value + ' credit union distress signal(s)');
      }

      // Treasury yield curve inversion → macro_shock
      if (fn3.indexOf('yield curve') !== -1 && f3.value !== undefined && f3.value < 0) {
        this._activeConditions.push('macro_shock');
        signals.push('Treasury: yield curve inverted ' + f3.value.toFixed(2) + 'pp');
      }

      // Treasury debt structural pressure → systemic_risk
      if (fn3.indexOf('treasury debt') !== -1 && f3.value !== undefined && f3.value >= 35) {
        this._activeConditions.push('systemic_risk');
        signals.push('Treasury: federal debt $' + f3.value.toFixed(2) + 'T');
      }

      // NY Fed SOFR — overnight repo stress → interbank_stress / liquidity_drain
      if (fn3.indexOf('sofr') !== -1 && f3.value !== undefined && f3.value >= 5.5) {
        this._activeConditions.push('interbank_stress');
        signals.push('SOFR: overnight rate ' + f3.value.toFixed(2) + '%');
      }
      if (fn3.indexOf('sofr') !== -1 && f3.value !== undefined && f3.value >= 6.5) {
        this._activeConditions.push('liquidity_drain');
        signals.push('CRITICAL: SOFR spike ' + f3.value.toFixed(2) + '%');
      }

      // OCC / CFTC / FINRA / FDIC enforcement velocity → regulatory_action
      if ((fn3.indexOf('occ') !== -1 || fn3.indexOf('cftc') !== -1 || fn3.indexOf('finra') !== -1) && f3.value !== undefined && f3.value >= 5) {
        this._activeConditions.push('regulatory_action');
        signals.push((f3.label || f3.name) + ' — elevated regulator action');
      }

      // FINRA disciplinary surge → fraud_detected
      if (fn3.indexOf('finra') !== -1 && f3.value !== undefined && f3.value >= 10) {
        this._activeConditions.push('fraud_detected');
      }

      // SEC EDGAR filing surge → accounting_irregularity / regulatory_action
      if (fn3.indexOf('sec edgar') !== -1 && f3.value !== undefined && f3.value >= 80) {
        this._activeConditions.push('accounting_irregularity');
        signals.push('SEC: filing volume surge — ' + f3.value + ' entries');
      }
    }

    this.state.signals = signals;
    return Promise.resolve();
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 4: Derive diagnoses — condition-matched from portal
  // ══════════════════════════════════════════════════════════════════════

  FinanceBrain.prototype.deriveDiagnoses = function () {
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

  FinanceBrain.prototype.recommendTreatments = function () {
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

  FinanceBrain.prototype.surfaceOpportunities = function () {
    Base.prototype.surfaceOpportunities.call(this);

    // Cognition parity: if the snapshot didn't supply companies, fall back to real
    // command-board finance entities so opportunities are real, not scaffold. Guarded.
    if ((!this.state.companies || !this.state.companies.length) && this._cbFinanceCompanies && this._cbFinanceCompanies.length) {
      this.state.companies = this._cbFinanceCompanies;
    }

    var opps = [];
    var stress = this.state.stress;
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; });
    var allDx = this.state.diagnoses || [];
    var companies = this.state.companies || [];
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

      // Risk monitoring platform
      add({
        title: dxLabel + ' — risk monitoring and early warning platform',
        rank: stress * dx.relevance,
        path: 'RESEARCHABLE',
        urgency: stress > 0.70 ? 'high' : 'medium',
        source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
      });

      // Regulatory compliance infrastructure
      if (stress >= 0.50) {
        add({
          title: dxLabel + ' — regulatory compliance and stress testing infrastructure',
          rank: stress * dx.relevance * 0.9,
          path: 'INVESTABLE',
          urgency: stress > 0.70 ? 'high' : 'medium',
          source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
        });
      }

      // Defensive positioning
      if (stress >= 0.55 && dx.relevance >= 0.2) {
        add({
          title: dxLabel + ' — defensive portfolio positioning and hedging',
          rank: stress * 0.85,
          path: 'INVESTABLE',
          urgency: 'medium',
          source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
        });
      }

      // Fintech adaptation
      add({
        title: dxLabel + ' — fintech adaptation and alternative infrastructure',
        rank: stress * dx.relevance * 0.75,
        path: 'RESEARCHABLE',
        urgency: 'medium',
        source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
      });
    }

    // Company-driven — distress comes ONLY from the validated Thing pipeline (_pubSignals),
    // NEVER from the raw command-board `phase` (noise). _pubSignals is {} until per-company
    // scoring is validated, so these stay silent rather than fabricate.
    var pub = this._pubSignals || {};
    var terminalCompanies = companies.filter(function (c) { var sg = pub[c.ticker]; return sg && sg.band === 'elevated'; });
    if (terminalCompanies.length > 0) {
      add({
        title: 'Finance terminal institution distressed positioning',
        rank: 0.95,
        path: 'INVESTABLE',
        urgency: 'high',
        source: 'company_terminal', tier: 1,
        companies: terminalCompanies.map(function (c) { return c.ticker; }),
        stress: stress
      });
    }

    // Moderate-distress institutions (validated signal only)
    var stressedCompanies = companies.filter(function (c) { var sg = pub[c.ticker]; return sg && sg.band === 'moderate'; });
    if (stressedCompanies.length >= 2 && stress >= 0.50) {
      add({
        title: 'Finance stressed-but-operating institution selection',
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
        title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — finance convergence response',
        rank: 0.98,
        path: 'INVESTABLE',
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
        title: 'Finance \u2192 ' + targetLabel + ' transmission — ' + sigLabel + ' response',
        rank: (em.magnitude || 0.5) * stress * 0.8,
        path: 'INVESTABLE',
        urgency: em.magnitude > 0.6 ? 'high' : 'medium',
        source: 'cross_domain', tier: 2,
        diagnosisId: 'finance_emission_' + em.targetDomain,
        stress: stress
      });

      // Economy specifically generates fiscal response opportunity
      if (em.targetDomain === 'economy') {
        add({
          title: 'Credit transmission — fiscal stimulus and monetary policy response',
          rank: stress * 0.7,
          path: 'RESEARCHABLE',
          urgency: 'medium',
          source: 'cross_domain', tier: 2,
          diagnosisId: 'economy_credit', stress: stress
        });
      }

      // Industry generates capital reallocation opportunity
      if (em.targetDomain === 'industry') {
        add({
          title: 'Capital access restriction — industrial credit facility restructuring',
          rank: stress * 0.75,
          path: 'INVESTABLE',
          urgency: 'medium',
          source: 'cross_domain', tier: 2,
          diagnosisId: 'industry_capital', stress: stress
        });
      }
    }

    // ═══ TIER 3 — LAGGING / SYSTEM RESPONSE ═══
    if (stress >= 0.50) {
      add({
        title: 'Financial regulatory response — compliance tooling and advisory',
        rank: stress * 0.65,
        path: 'INVESTABLE',
        urgency: stress > 0.70 ? 'medium' : 'watching',
        source: 'lagging', tier: 3,
        diagnosisId: 'regulatory_response', stress: stress
      });

      add({
        title: 'Alternative finance acceleration — DeFi, private credit, and digital assets',
        rank: stress * 0.70,
        path: 'RESEARCHABLE',
        urgency: 'medium',
        source: 'lagging', tier: 3,
        diagnosisId: 'alternative_finance', stress: stress
      });
    }

    if (stress >= 0.60) {
      add({
        title: 'Financial infrastructure hardening — clearing, settlement, and custody',
        rank: stress * 0.75,
        path: 'INVESTABLE',
        urgency: stress > 0.70 ? 'high' : 'medium',
        source: 'lagging', tier: 3,
        diagnosisId: 'infrastructure_hardening', stress: stress
      });

      add({
        title: 'Distressed asset acquisition — non-performing loan portfolios',
        rank: stress * 0.72,
        path: 'INVESTABLE',
        urgency: 'medium',
        source: 'lagging', tier: 3,
        diagnosisId: 'distressed_assets', stress: stress
      });

      add({
        title: 'Sector rotation — capital migration from finance-dependent sectors',
        rank: stress * 0.68,
        path: 'INVESTABLE',
        urgency: 'medium',
        source: 'lagging', tier: 3,
        diagnosisId: 'capital_rotation', stress: stress
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
    // Canonical enrichment — merge finance playbook detail per opportunity
    var PB_LIST = window.LIMENFinanceOpportunityPlaybooks || [];
    var _byId = {};
    for (var _pbi = 0; _pbi < PB_LIST.length; _pbi++) _byId[PB_LIST[_pbi].id] = PB_LIST[_pbi];
    var _PB_MAP = {
      'BANKING_CRISIS': 'banking_crisis',
      'CREDIT_FREEZE': 'credit_freeze',
      'MARKET_CRASH': 'market_crash',
      'CURRENCY_COLLAPSE': 'currency_collapse',
      'SYSTEMIC_CONTAGION': 'systemic_contagion',
      'FRAUD_SCANDAL': 'fraud_scandal'
    };
    var _LAGGING_MAP = {
      'alternative_finance': 'credit_freeze',
      'capital_rotation': 'market_crash',
      'distressed_assets': 'banking_crisis',
      'economy_credit': 'credit_freeze',
      'industry_capital': 'credit_freeze',
      'infrastructure_hardening': 'banking_crisis',
      'regulatory_response': 'fraud_scandal'
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
      'INVESTABLE':   { type: 'invest',   base: 5,  unit: 'profit%', tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
      'RESEARCHABLE': { type: 'research', base: 5,  unit: 'credit%', tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 published research briefs' },    maxTier: { tier: 3, comp: 15 } }
    };
    for (var oi = 0; oi < opps.length; oi++) {
      var o = opps[oi];
      o.id = (o.diagnosisId || o.nearDiagnosisId || o.source || 'opp').replace(/[^a-zA-Z0-9]/g, '_') + '_' + (o.path || '').toLowerCase().replace(/[^a-z]/g, '') + '_t' + (o.tier || 0);
      o.domain = 'finance';
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
        var evidenceParts = ['Domain: finance', 'Stress: ' + stressPct + '%'];
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

  FinanceBrain.prototype._checkDiagnosisActions = function () {
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; });
    if (activeDx.length === 0) return;

    var adapters = window.LIMENActionAdapters;
    if (!adapters) return;

    for (var i = 0; i < activeDx.length; i++) {
      var dx = activeDx[i];
      var existingDrafts = adapters.getDrafts({ domain: 'finance', intentId: dx.id });
      if (existingDrafts && existingDrafts.length > 0) continue;

      // REFRACTORY DE-DUP (Neuro Ref III.3) — real effector = action-draft emission.
      // Absolute dead-time: no re-draft of the SAME diagnosis within absoluteWindow.
      // Relative window: a raised bar — re-draft only if stress cleared overrideThreshold
      // OR exceeds the last firing's stress (a stronger stimulus breaks through). Deterministic.
      if (this._actuation && this._actuation.refractory) {
        var rp = this._refractoryParams || {};
        var now = Date.now();
        this._financeRefractory = this._financeRefractory || {};
        var last = this._financeRefractory[dx.id];
        if (last) {
          var age = now - last.t;
          if (age < (rp.absoluteWindow || 900000)) continue;                                   // absolute dead-time
          if (age < (rp.relativeWindow || 3600000) &&
              (this.state.stress || 0) < (rp.overrideThreshold || 0.9) &&
              (this.state.stress || 0) <= (last.stress || 0)) continue;                          // raised-threshold window
        }
        this._financeRefractory[dx.id] = { t: now, stress: this.state.stress || 0 };
      }

      adapters.createDraft('REPORT_GENERATION', {
        domain: 'finance',
        sourceType: 'domain_brain',
        sourceId: dx.id,
        intentId: dx.id,
        title: 'Finance Alert: ' + dx.label,
        intent: {
          domain: 'finance',
          title: dx.label,
          status: 'ACTIVE',
          priority: this.state.stress,
          progress: 0,
          strategyType: 'diagnosis_response',
          steps: [
            { type: 'ANALYZE', label: 'Assess ' + dx.label + ' impact on financial system', status: 'PENDING' },
            { type: 'INVESTIGATE', label: 'Identify affected institutions and instruments', status: 'PENDING' },
            { type: 'POSITION', label: 'Evaluate capital opportunities from ' + dx.label, status: 'PENDING' }
          ]
        }
      });
    }
  };

  FinanceBrain.prototype.resolveDeepContent = function () {
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

  var _origCycle = FinanceBrain.prototype.cycle;
  FinanceBrain.prototype.cycle = function () {
    var self = this;
    return _origCycle.call(this).then(function () {
      return self.resolveDeepContent();
    }).then(function () {
      // Pulse engine — evidence validation + delta detection
      var pulse = window.LIMENFinancePulse;
      if (pulse && typeof pulse.computePulse === 'function') {
        self.state._activeConditions = self._activeConditions || [];
        var pulseState = pulse.computePulse(self.state);
        self.state.pulse = pulseState;

        // Apply evidence contract validation — block diagnoses without proper evidence
        if (pulseState && pulseState.validatedDiagnoses) {
          for (var vdi = 0; vdi < pulseState.validatedDiagnoses.length; vdi++) {
            var vdx = pulseState.validatedDiagnoses[vdi];
            for (var sdi = 0; sdi < self.state.diagnoses.length; sdi++) {
              if (self.state.diagnoses[sdi].id === vdx.diagnosis.id) {
                if (vdx.blocked) {
                  self.state.diagnoses[sdi].active = false;
                  self.state.diagnoses[sdi].blocked = true;
                  self.state.diagnoses[sdi].blockReason = vdx.reason;
                } else {
                  self.state.diagnoses[sdi].blocked = false;
                }
                break;
              }
            }
          }
          self.state.diagnoses.sort(function (a, b) {
            if (a.active !== b.active) return a.active ? -1 : 1;
            return b.relevance - a.relevance;
          });
        }

        // Neuro-substrate telemetry (advisory): map the live pulse -> runtime overlay via the
        // generic domain adapter. Additive, guarded, async fire-and-forget; never breaks the cycle.
        try {
          if (window.DomainTelemetryAdapter && typeof window.DomainTelemetryAdapter.fromLiveCached === 'function') {
            window.DomainTelemetryAdapter.fromLiveCached('finance', self.state, self._runtimeOverlay || null)
              .then(function (ov) { if (ov) self._runtimeOverlay = ov; })
              .catch(function () {});
          }
        } catch (_e) { /* advisory overlay is best-effort */ }
      }
    }).then(function () {
      // COGNITION PORT — recurrent loop step. Runs AFTER the validated pipeline + pulse
      // validation settle, reads the prior produced by the PREVIOUS cycle, computes prediction
      // error, regulates, and updates the next prior. STRICTLY ADDITIVE + try/caught: it reads
      // state.stress / state.diagnoses but NEVER mutates the validated scoreStress / deriveDiagnoses
      // spine or any diagnosis active flag. Never breaks a cycle.
      try { self._updateFinanceModel(); } catch (e) {}
    });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // COGNITION PORT — FINANCE RECURRENT LOOP v1 (additive, reversible, energy-class depth)
  // Converts re-running inference into a recurrent loop:
  //   prior → observation → prediction error → bounded update → next prior.
  // Proof surface: window.LIMENFinanceBrain.state.financeModel
  // GUARD: this entire block ONLY READS the validated state (stress, diagnoses, opportunities)
  // and writes NEW keys (financeModel, finance{Immune,Awareness,Conscience,Intuition,Simulation,
  // ExecutiveReport}, cognition). It NEVER alters scoreStress, deriveDiagnoses, the locked
  // diagnosis set, or anything consumed by /api/limen/score or /api/helix/helix-report/score.
  // ════════════════════════════════════════════════════════════════════════════
  var FM_VERSION = 1;
  var FM_LEARNING_RATE = 0.25;          // bounded plasticity (fast inference)
  var FM_SLOW_RATE = 0.08;              // slow consolidation (reserved for rebuild/cron)
  var FM_STRESS_FLOOR = 0.30;           // below this → no handoff
  var FM_FLOOD_CAP = 12;                // opportunity-flood threshold
  var FM_STALE_MS = 1000 * 60 * 60 * 6; // 6h feed staleness
  var FK_OUTCOME_BUFFER = 40;           // K4 rolling predicted-vs-realized samples (mirrors energy EK_OUTCOME_BUFFER)
  var FK_HOMEO_WINDOW = 60;             // K8 cycles of stress baseline for the adaptive set-point (mirrors energy EK_HOMEO_WINDOW)

  function _fmClamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function _fmJaccardDistance(a, b) {
    a = a || []; b = b || [];
    if (a.length === 0 && b.length === 0) return 0;
    var union = {}, inter = 0, setB = {};
    for (var i = 0; i < b.length; i++) { setB[b[i]] = true; union[b[i]] = true; }
    var seen = {};
    for (var j = 0; j < a.length; j++) { union[a[j]] = true; if (setB[a[j]] && !seen[a[j]]) { inter++; seen[a[j]] = true; } }
    var u = Object.keys(union).length;
    return u === 0 ? 0 : 1 - (inter / u);
  }

  // ── Neutral recurrent prior (mirrors _neutralEnergyModel / _neutralCultureModel) ──
  FinanceBrain.prototype._neutralFinanceModel = function () {
    return {
      version: FM_VERSION, cycle: 0,
      prior: { expectedStress: 0.5, expectedDiagnoses: [], expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, confidence: 0, samples: 0 },
      observation: null, predictionError: null, predictedStress: null,
      plasticity: { learningRate: FM_LEARNING_RATE, slowRate: FM_SLOW_RATE, consolidation: 'cycle-light' },
      regulation: null, readyForHandoff: false, _lowErrorStreak: 0, updated: 0
    };
  };

  // ── Normalized observation of current finance state (NO SCORING; pure read) ──
  FinanceBrain.prototype._buildFinanceObservation = function () {
    var s = this.state || {};
    var active = (s.diagnoses || []).filter(function (d) { return d.active; });
    // signal = breadth of live finance feeds (VIX, yields, credit spreads, SOFR, regulatory action counts)
    var feeds = s.feeds || [], fc = 0, newest = 0;
    if (Array.isArray(feeds)) {
      for (var i = 0; i < feeds.length; i++) { var fv = feeds[i]; if (fv) { fc++; var u = fv.updated; if (u && u > newest) newest = u; } }
    } else { for (var k in feeds) { if (feeds.hasOwnProperty(k)) { fc++; var u2 = feeds[k] && feeds[k].updated; if (u2 && u2 > newest) newest = u2; } } }
    return {
      stress: typeof s.stress === 'number' ? s.stress : 0,
      phase: s.phase || null,
      activeDiagnoses: active.map(function (d) { return d.id; }).sort(),
      diagnosisCount: active.length,
      opportunityCount: (s.opportunities || []).length,
      companyCount: (s.companies || []).length,
      signal: Math.min(1, fc / 8),
      feedNewest: newest,
      timestamp: Date.now()
    };
  };

  // ── Prediction error: prior.expected* vs observation (pure arithmetic; NO evidence scoring) ──
  FinanceBrain.prototype._computeFinancePredictionError = function (prior, obs) {
    var stressError = Math.abs(obs.stress - prior.expectedStress);
    var signalError = Math.abs(obs.signal - prior.expectedSignal);
    var diagnosisError = _fmJaccardDistance(obs.activeDiagnoses, prior.expectedDiagnoses);
    var oppDenom = Math.max(1, prior.expectedOpportunityCount, obs.opportunityCount);
    var opportunityError = Math.abs(obs.opportunityCount - prior.expectedOpportunityCount) / oppDenom;
    var total = _fmClamp(0.4 * stressError + 0.2 * signalError + 0.25 * diagnosisError + 0.15 * opportunityError, 0, 1);
    var novelty = Math.max(stressError, diagnosisError);
    return { total: total, stressError: stressError, signalError: signalError, diagnosisError: diagnosisError, opportunityError: opportunityError, novelty: novelty };
  };

  // ── Bounded prior update toward observation (next cycle reads this; domain-agnostic math) ──
  FinanceBrain.prototype._updateFinancePrior = function (prior, obs, lr) {
    return {
      expectedStress: _fmClamp(prior.expectedStress + lr * (obs.stress - prior.expectedStress), 0, 1),
      expectedDiagnoses: obs.activeDiagnoses.slice(),
      expectedDiagnosisCount: prior.expectedDiagnosisCount + lr * (obs.diagnosisCount - prior.expectedDiagnosisCount),
      expectedOpportunityCount: prior.expectedOpportunityCount + lr * (obs.opportunityCount - prior.expectedOpportunityCount),
      expectedSignal: _fmClamp(prior.expectedSignal + lr * (obs.signal - prior.expectedSignal), 0, 1),
      confidence: _fmClamp(Math.min(1, (prior.samples + 1) / 20), 0, 1),
      samples: prior.samples + 1
    };
  };

  // ── Local regulation: inhibition / gain / homeostatic set-points ──
  FinanceBrain.prototype._computeFinanceRegulation = function (fm, obs, pe) {
    var gain = _fmClamp(pe.novelty, 0.05, 0.95);
    var inhibition = _fmClamp(1 - pe.novelty, 0, 0.9);
    var outputScale = _fmClamp(1 - inhibition * 0.5, 0.4, 1);
    var starving = obs.stress >= FM_STRESS_FLOOR && obs.opportunityCount === 0;
    var flooding = obs.opportunityCount > FM_FLOOD_CAP;
    var streak = (pe.total < 0.05) ? (fm._lowErrorStreak || 0) + 1 : 0;
    fm._lowErrorStreak = streak;
    var looping = streak >= 3;
    var stale = obs.feedNewest > 0 ? (Date.now() - obs.feedNewest) > FM_STALE_MS : false;
    var overconfident = fm.prior.confidence > 0.8 && pe.total > 0.4;
    var label = flooding ? 'flooding' : starving ? 'starving' : stale ? 'stale' : looping ? 'looping' : overconfident ? 'overconfident' : pe.novelty > 0.4 ? 'surprised' : 'calm';
    return { gain: gain, inhibition: inhibition, outputScale: outputScale, starving: starving, flooding: flooding, looping: looping, stale: stale, overconfident: overconfident, state: label };
  };

  // ════════════════════════════════════════════════════════════════════════════
  // ACTUATION METHODS (ported from energy-brain.js, adapted to Finance's real edges/state).
  // All deterministic; NO paid-AI / LLM fetch on the cycle. Each is gated by this._actuation.*.
  // ════════════════════════════════════════════════════════════════════════════

  // REGULATE-TO-TARGET SERVO (Neuro Ref V.2/XII set-point homeostasis/allostasis + XIII.1 E/I).
  // Real sensor->controller->effector->feedback loop: sensor = excitatory drive (stress + how many
  // things fire at once) vs current inhibition; controller = PI (fast proportional + bounded slow
  // integral, the HPA fast+slow arms); effector = proportional dampening of emission (consumed by
  // _applyFinanceEIBrake). Additive, reversible (this._actuation.servo=false); affects ONLY emission
  // confidence — NEVER rewrites stress/scoring/diagnoses/finance.json.
  FinanceBrain.prototype._computeFinanceServo = function () {
    function R(x) { return Math.round(x * 1000) / 1000; }
    var s = this.state, fm = s.financeModel || {}, reg = fm.regulation || {}, neuro = s.domainNeuro || {}, hm = neuro.homeostasis || {};
    // SENSOR: excitatory drive (stress + active conditions + active diagnoses) vs current inhibition
    var stress = (typeof s.stress === 'number') ? s.stress : 0;
    var conds = Array.isArray(s._activeConditions) ? s._activeConditions.length : (Array.isArray(s.signals) ? s.signals.length : 0);
    var dxA = Array.isArray(s.diagnoses) ? s.diagnoses.filter(function (d) { return d && d.active; }).length : 0;
    var drive = Math.max(0, Math.min(2, stress + Math.min(conds, 12) / 24 + Math.min(dxA, 6) / 24));
    var inhibition = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;   // the live regulation term
    var FLOOR = 0.15;
    // TARGET (allostatic set-point): inhibition must track drive (E/I) and rise with the adaptive
    // baseline deviation (generic K-stack homeostasis, prior cycle). Regulate-TO-target, not alert-on.
    var deviation = Math.max(0, (typeof hm.deviation === 'number') ? hm.deviation : 0);
    var target = Math.max(FLOOR, Math.min(1, Math.max(drive, FLOOR + deviation)));
    var error = target - inhibition;                                              // >0 => under-braked for the drive/regime
    // CONTROLLER: bounded integral (slow arm) + proportional (fast arm)
    this._financeServoIntegral = Math.max(-0.5, Math.min(0.5, (this._financeServoIntegral || 0) + error * 0.15));
    var Kp = 0.8, Ki = 0.4;
    var correction = Math.max(0, Kp * error + Ki * Math.max(0, this._financeServoIntegral));   // only ADD braking; never disinhibit
    // EFFECTOR: proportional dampening of emission (the E/I brake consumes this)
    var emissionFactor = Math.max(0.2, Math.min(1, 1 - correction));
    var state = error > 0.25 ? 'runaway-risk' : ((inhibition - target) > 0.4 ? 'over-inhibited' : 'balanced');
    var servo = {
      version: 1, actuated: true, drive: R(drive), inhibition: R(inhibition), target: R(target),
      error: R(error), integral: R(this._financeServoIntegral), emissionFactor: R(emissionFactor),
      state: state, deviation: R(deviation),
      note: 'closed-loop allostasis: drives inhibition toward a drive+deviation target; effector = proportional emission dampening. Neuro Ref XIII.1/V.2/XII.'
    };
    s.financeServo = servo;
    return servo;
  };

  // E/I BRAKE ACTUATION (Neuro Ref XIII.1). Consumes the servo's emissionFactor and dampens emitted-
  // opportunity confidence PROPORTIONALLY to the inhibition-vs-drive deficit. Effector = the same
  // emission channel the base generic brake gate uses. Reversible (this._actuation.eiBrake=false).
  FinanceBrain.prototype._applyFinanceEIBrake = function () {
    var s = this.state, servo = s.financeServo;
    if (!servo) { s.financeEIBrake = null; return null; }
    var f = (typeof servo.emissionFactor === 'number') ? servo.emissionFactor : 1;
    var opps = s.opportunities || [];
    var runaway = servo.state === 'runaway-risk';
    var dampened = 0;
    for (var i = 0; i < opps.length; i++) {
      if (f < 1 && typeof opps[i].confidence === 'number') {
        opps[i].confidence = Math.round(opps[i].confidence * f);
        opps[i].eiFactor = f;
        dampened++;
      }
      if (runaway) opps[i].eiDampened = true;
    }
    s.financeEIBrake = {
      version: 1, applied: f < 1, emissionFactor: (Math.round(f * 1000) / 1000),
      servoState: servo.state, dampenedCount: dampened,
      note: 'E/I brake (Neuro Ref XIII.1): emission confidence dampened proportionally to the inhibition deficit vs drive; reversible via _actuation.eiBrake.'
    };
    return s.financeEIBrake;
  };

  // PHASE-COHERENCE ROUTER + PHASE-TRANSITION REWARD (patent §3.4 Loop 1 coupling matrix M; thing2 lineage).
  //  Router: P0-P10 IS the phase variable — Finance couples to stressed domains whose PHASE is coherent with
  //          its own (positive M = same excitability window = communicate-through-coherence).
  //  Reward: a realized phase TRANSITION over time is ground-truth (thing2 "goes through time"). GATED to
  //          TRUE reward only on P3/P7-involving transitions — the phases Thing1 VALIDATES, and Finance's
  //          home envelope (EDGAR / bankruptcy kernel; live phase P7). Elsewhere it is advisory
  //          self-consistency, never a fabricated validated signal. Deterministic; no AI; no writes to finance.json.
  FinanceBrain.prototype._computeFinancePhaseDynamics = function () {
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
    var VALIDATED = { p3: 1, p7: 1, p7a: 1, p7b: 1 };            // Thing1 validates P3/P7 => ground-truth
    var BREAKING = { p1: 1, p3: 1, p7: 1, p7a: 1, p7b: 1, p9: 1 };  // recursion-arc BREAKING family = more-distressed
    function norm(p) { if (p == null) return null; p = String(p).toLowerCase().replace(/[^a-z0-9]/g, ''); if (p.charAt(0) !== 'p') p = 'p' + p; return p; }
    // PREFER the REAL Thing2 recursive phase kernel (this._kernelPhase, set in _updateFinanceModel)
    // when it produced a phase this cycle; otherwise fall back to the existing naive/static s.phase.
    // Both the coherence router AND the phase-transition reward below read this single myPhase, so
    // one source-swap covers both. Fallback path is preserved unchanged.
    var phaseSource = (this._kernelPhase != null) ? 'thing2-kernel' : 'fallback';
    var myPhase = norm((this._kernelPhase != null) ? this._kernelPhase : s.phase);

    // (A) COHERENCE ROUTER — couple to co-phased, stressed domains
    var doms = (typeof window !== 'undefined' && window.LIMENDomains) || {};
    var coupled = [], couplingStrength = 0;
    if (myPhase && PHASE_M[myPhase]) {
      var row = PHASE_M[myPhase];
      Object.keys(doms).forEach(function (k) {
        if (k === 'finance') return;
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

    // (B) PHASE-TRANSITION REWARD — did a predicted transition actually occur (through time)?
    var hist = this._financePhaseHist = this._financePhaseHist || [];
    var prev = hist.length ? hist[hist.length - 1].phase : null;
    var reward = null;
    if (prev != null && myPhase != null && prev !== myPhase) {
      var fc = (s.domainNeuro && s.domainNeuro.forecast) || {};
      var predictedUp = fc.direction === 'rising' ||
        (typeof fc.projectedStress === 'number' && typeof s.stress === 'number' && fc.projectedStress > s.stress);
      var wentUp = (BREAKING[myPhase] && !BREAKING[prev]) ? true : (BREAKING[prev] && !BREAKING[myPhase]) ? false : null;
      var hit = (wentUp !== null) ? (wentUp === !!predictedUp) : null;
      var validated = !!(VALIDATED[myPhase] || VALIDATED[prev]);
      reward = { from: prev, to: myPhase, predictedUp: !!predictedUp, wentUp: wentUp, hit: hit,
        validated: validated, kind: validated ? 'ground-truth (P3/P7 validated)' : 'advisory-self-consistency' };
    }
    hist.push({ phase: myPhase, t: (s.financeModel && s.financeModel.updated) || Date.now() });
    if (hist.length > 24) hist.shift();

    var out = {
      version: 1, myPhase: myPhase, phaseSource: phaseSource,
      coupled: coupled.slice(0, 5), couplingStrength: Math.round(couplingStrength * 1000) / 1000,
      transition: reward,
      note: 'phase-coherence router (patent M matrix) + phase-transition reward (thing2 lineage; ground-truth only on P3/P7 — Finance\'s validated envelope). Phase source = ' + phaseSource + ' (thing2-kernel = real recursive phase kernel; fallback = naive s.phase).'
    };
    s.financePhaseDynamics = out;
    return out;
  };

  // E/I BALANCE + SELF-AUDIT ADVISORIES (observe-only; Neuro Ref XIII.1 + XIV). Deterministic, no AI, no
  // writes. (1) E/I balance = is inhibition tracking drive (reads the servo). (2) Self-audit = CONSUME the
  // connectivity / single-points-of-failure audit on Finance's REAL edge graph (81 edges live in
  // finance.json, NOT in the live snapshot — lazy-fetch + cache once, matching Energy's edge loader).
  FinanceBrain.prototype._computeFinanceRegulationAdvisories = function () {
    var s = this.state, out = { version: 1, observeOnly: true };
    // (1) E/I balance advisory
    var servo = s.financeServo || null;
    out.eiBalance = servo ? {
      drive: servo.drive, inhibition: servo.inhibition, target: servo.target, error: servo.error,
      state: servo.state, balanced: servo.state === 'balanced', note: 'inhibition-tracks-drive (Neuro Ref XIII.1)'
    } : null;
    // (2) self-audit — consume the finance edge graph (81 edges / 36 nodes)
    try {
      var self = this;
      var edges = this._financeEdges || null;
      if (!edges) {
        if (typeof fetch === 'function' && !this._financeEdgesPromise) {
          this._financeEdgesPromise = fetch('/assets/data/domains/finance.json')
            .then(function (r) { return r.json(); })
            .then(function (j) { if (j && Array.isArray(j.edges)) self._financeEdges = j.edges; })
            .catch(function () {});
        } else if (typeof require === 'function') {
          try { var ed = require('../../data/domains/finance.json'); if (ed && Array.isArray(ed.edges)) { this._financeEdges = ed.edges; edges = ed.edges; } } catch (_e) {}
        }
      }
      if (edges && edges.length) out.selfAudit = this._financeConnectivityAudit(edges);
      else out.selfAudit = { consumed: false, note: edges ? 'no edges' : 'edges loading (async, next cycle)' };
    } catch (e) { out.selfAudit = { consumed: false, error: String(e && e.message || e).slice(0, 80) }; }
    s.financeRegulationAdvisories = out;
    return out;
  };

  // Deterministic connectivity self-audit (Neuro Ref XIV): degree hubs + articulation points (Tarjan) on
  // the finance node/edge graph. Self-contained (no external module). Consumed observe-only.
  FinanceBrain.prototype._financeConnectivityAudit = function (edges) {
    var adj = {}, deg = {};
    for (var e = 0; e < edges.length; e++) {
      var a = edges[e].source, b = edges[e].target;
      if (!a || !b) continue;
      (adj[a] = adj[a] || []).push(b); (adj[b] = adj[b] || []).push(a);
      deg[a] = (deg[a] || 0) + 1; deg[b] = (deg[b] || 0) + 1;
    }
    var nodes = Object.keys(deg);
    var topHubs = nodes.map(function (n) { return { node: n, degree: deg[n] }; })
      .sort(function (x, y) { return y.degree - x.degree; }).slice(0, 5);
    // Articulation points (Tarjan), iterative-safe on a 36-node graph via bounded recursion.
    var visited = {}, disc = {}, low = {}, parent = {}, ap = {}, timer = { t: 0 };
    function dfs(u) {
      visited[u] = true; disc[u] = low[u] = ++timer.t; var children = 0;
      var nb = adj[u] || [];
      for (var i = 0; i < nb.length; i++) {
        var v = nb[i];
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
    for (var k = 0; k < nodes.length; k++) { if (!visited[nodes[k]]) { parent[nodes[k]] = undefined; dfs(nodes[k]); } }
    var spof = Object.keys(ap);
    return {
      consumed: true, edgeCount: edges.length, nodeCount: nodes.length,
      spofCount: spof.length, spof: spof.slice(0, 8), topHubs: topHubs,
      verdict: spof.length ? (spof.length + ' single-point(s)-of-failure: removal disconnects the finance connectome') : 'no articulation nodes (resilient graph)',
      note: 'connectivity self-audit (Neuro Ref XIV): degree hubs + articulation points on the ' + edges.length + '-edge finance graph'
    };
  };

  // ════════════════════════════════════════════════════════════════════════════
  // OPERATOR-TRIGGERED GENERATIVE SLOT — the ONE "code-cannot-do-this" hook (generative
  // node->business authoring / semantic mapping). COST-SAFE BY CONSTRUCTION:
  //   (a) NEVER called from cycle()/_updateFinanceModel — the 30s cycle is 100% deterministic
  //       (grep-verify: no call site in the cycle pipeline);
  //   (b) runs ONLY on an explicit operator trigger (opts.operatorTriggered === true);
  //   (c) routes through a SERVER endpoint that enforces lib/ai-kill-switch spendDisabled()
  //       server-side — NO API key is ever present in this client code.
  // If no killswitch-gated endpoint is supplied it is a documented NO-OP STUB (spends nothing),
  // per the discipline "leave the slot as a documented no-op stub rather than wiring a live call."
  // ════════════════════════════════════════════════════════════════════════════
  FinanceBrain.prototype.authorNodeBusinessFromServer = function (nodeId, opts) {
    opts = opts || {};
    if (opts.operatorTriggered !== true) {
      return Promise.resolve({ status: 'blocked', reason: 'operator-trigger required; the 30s cycle must never call this (cost-safety killswitch)' });
    }
    var endpoint = opts.endpoint || null;   // server route that is killswitch-gated (spendDisabled) — no key client-side
    if (!endpoint || typeof fetch !== 'function') {
      return Promise.resolve({ status: 'noop-stub', nodeId: nodeId || null, note: 'no killswitch-gated server endpoint wired; documented no-op — no spend' });
    }
    return fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'finance', nodeId: nodeId || null, task: 'node-business-authoring' })
    })
      .then(function (r) { return r.ok ? r.json() : { status: 'server-declined', code: r.status }; })
      .catch(function (err) { return { status: 'error', error: String(err && err.message || err) }; });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE K — NEURO-COMPLETION LOOP STACK (K1..K8), ported from energy-brain.js and
  // adapted to Finance's OWN state/edges. ADVISORY BY DESIGN: every layer COMPUTES and
  // EXPOSES its signal on state, but NONE rewrites the validated scoreStress /
  // deriveDiagnoses spine or any diagnosis active flag. Two Energy-faithful closures are
  // wired into _updateFinanceModel via one-cycle lag (like Energy): K4 stress-self-pred as
  // the third credit-source fallback, and K8's adaptive floor into the (non-validated)
  // readyForHandoff gate. Reads cached state only; adds no network calls on the cycle;
  // 100% deterministic (no AI). Never fabricates evidence.
  // ════════════════════════════════════════════════════════════════════════════

  // K1 — afferent inter-brain integration (closed loop). Surfaces the cross-domain pressure
  // received via receiveExternalSignal()/getExternalPressure(). Finance uses the BASE
  // scoreStress, which folds externalPressure (base-capped 0.3, decayed) into stress each
  // cycle and also drives the correlation_breakdown condition in normalizeSignals — so the
  // loop is CLOSED for finance exactly like the other 18 domains.
  FinanceBrain.prototype._computeFinanceAfferent = function () {
    var s = this.state, fm = s.financeModel || {};
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
      integrated: true,                                           // K1 CLOSED — folded into stress by base scoreStress
      appliedStressDelta: Math.round(((s._externalPressureApplied) || 0) * 1000) / 1000,
      wouldRaiseStressBy: Math.round(pressure * 1000) / 1000,
      note: 'CLOSED: base scoreStress folds externalPressure into stress each cycle; >=0.15 also drives the correlation_breakdown condition in normalizeSignals.',
      lastAfferentAt: fm.updated || now
    };
    s.financeAfferent = af; return af;
  };

  // K2 — neuromodulatory gain application. reg.gain/inhibition/outputScale are computed by
  // _computeFinanceRegulation. This surfaces the graded output modulation outputScale WOULD
  // apply to the ranked opportunity output. ADVISORY: finance does not yet cap output (no
  // _applyNeuroGating), so shadow:true and the closure is left reversible/unapplied.
  FinanceBrain.prototype._computeFinanceGainControl = function () {
    var s = this.state, fm = s.financeModel || {}, reg = fm.regulation || {};
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
      appliedTargets: ['predictedStress (gain-blend in _updateFinanceModel)'],
      unappliedTargets: ['opportunity output', 'stress', 'treatment surfacing'],
      shadow: true,
      note: 'ADVISORY: gain-blend already shapes predictedStress; outputScale not yet capping opportunity output in finance (no _applyNeuroGating). Reversible closure available.',
      lastGainAt: fm.updated || Date.now()
    };
    s.financeGainControl = gc; return gc;
  };

  // K3 — slow consolidation / long-term plasticity (FM_SLOW_RATE). Maintains a PARALLEL
  // slow-weight track that never touches fm.prior; fast-vs-slow divergence is a real
  // regime-shift indicator (Turrigiano-style long-term average vs fast inference prior).
  FinanceBrain.prototype._consolidateFinanceSlowModel = function () {
    var s = this.state, fm = s.financeModel || {}, obs = fm.observation || null;
    var slow = s.financeSlowModel || {
      version: 1, cycle: 0,
      slow: { expectedStress: 0.5, expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, samples: 0 },
      rate: FM_SLOW_RATE, note: 'parallel slow-weight track (FM_SLOW_RATE); does NOT touch fm.prior'
    };
    if (obs) {
      var r = FM_SLOW_RATE, w = slow.slow;
      w.expectedStress = _fmClamp(w.expectedStress + r * ((obs.stress || 0) - w.expectedStress), 0, 1);
      w.expectedSignal = _fmClamp(w.expectedSignal + r * ((obs.signal || 0) - w.expectedSignal), 0, 1);
      w.expectedDiagnosisCount = w.expectedDiagnosisCount + r * ((obs.diagnosisCount || 0) - w.expectedDiagnosisCount);
      w.expectedOpportunityCount = w.expectedOpportunityCount + r * ((obs.opportunityCount || 0) - w.expectedOpportunityCount);
      w.samples += 1;
      slow.cycle += 1;
    }
    var fast = (fm.prior && typeof fm.prior.expectedStress === 'number') ? fm.prior.expectedStress : 0.5;
    slow.fastSlowDivergence = Math.round(Math.abs(fast - slow.slow.expectedStress) * 1000) / 1000;
    slow.regimeShift = slow.fastSlowDivergence > 0.25;
    slow.updated = fm.updated || Date.now();
    s.financeSlowModel = slow; return slow;
  };

  // K4 — outcome / credit learning + TRUTH BRAKE (self-consistency, NOT external reward).
  // Compares each cycle's predictedStress against the NEXT cycle's realized stress (online
  // forward-prediction). Measures whether the model's own forecast comes true; the hitRate is
  // fed back into the K4 credit hook in _updateFinanceModel (>=5 samples) as the third fallback
  // after a validated phase transition and the generic outcome ledger. This is realized-stress
  // self-prediction calibration — it fabricates NO dopaminergic/external reward signal.
  FinanceBrain.prototype._scoreFinanceOutcomes = function () {
    var s = this.state, fm = s.financeModel || {};
    var buf = this._financeOutcomeBuffer = this._financeOutcomeBuffer || [];
    var obs = fm.observation || null;
    if (this._financePrevPrediction != null && obs && typeof obs.stress === 'number') {
      buf.push({ predicted: this._financePrevPrediction, realized: obs.stress, err: Math.abs(this._financePrevPrediction - obs.stress) });
      if (buf.length > FK_OUTCOME_BUFFER) buf.shift();
    }
    this._financePrevPrediction = (typeof fm.predictedStress === 'number') ? fm.predictedStress : null;   // stash for next-cycle reconciliation
    var n = buf.length, sumErr = 0, sumSq = 0, hits = 0;
    for (var i = 0; i < n; i++) { sumErr += buf[i].err; sumSq += buf[i].err * buf[i].err; if (buf[i].err <= 0.1) hits++; }
    var om = {
      version: 1,
      samples: n,
      meanRealizedError: n ? Math.round((sumErr / n) * 1000) / 1000 : null,
      brierLike: n ? Math.round((sumSq / n) * 1000) / 1000 : null,
      hitRate: n ? Math.round((hits / n) * 100) / 100 : null,                    // fraction within 0.1 of realized
      loopType: 'online-continuous (predicted-vs-next-realized) self-consistency / TRUTH BRAKE; NOT an external reward',
      creditAssignmentActive: (n >= 5),
      effectiveLearningRate: (fm._effectiveLearningRate) || null,
      note: 'CLOSED: hitRate scales the effective learning rate in _updateFinanceModel (>=5 samples, third fallback) so persistent mis-prediction speeds adaptation.',
      lastOutcomeAt: fm.updated || Date.now()
    };
    s.financeOutcomeModel = om; return om;
  };

  // K5 — deep hierarchical perception / prediction-error depth. Aggregates the depth the brain
  // HAS from existing caches (L1 branch scan + credit/liquidity sub-portal), with NO new fetches,
  // and estimates the portalError the recurrent model does not yet observe. ADVISORY: finance's
  // validated prediction-error formula is left unchanged (weights preserved), so portalErrorEstimate
  // is surfaced but not folded into fm.predictionError.
  FinanceBrain.prototype._computeFinancePerceptionDepth = function () {
    var s = this.state, fm = s.financeModel || {};
    var l1 = s._l1DepthCache || null;
    var sub = s.creditSublayer || null;
    var l1Real = 0, l1Mad = 0;
    if (l1 && l1.byDiagnosis) { Object.keys(l1.byDiagnosis).forEach(function (k) { l1Real += (l1.byDiagnosis[k].realTreatments || 0); l1Mad += (l1.byDiagnosis[k].madLibTreatments || 0); }); }
    var levels = [
      { level: 'L0', name: 'root', status: (this._portalCache || s._portalCache) ? 'loaded' : 'pending' },
      { level: 'L1', name: 'branch-scan', status: l1 ? 'scanned' : 'pending', realTreatments: l1Real, madLibTreatments: l1Mad },
      { level: 'L2', name: 'deep-cortex', status: 'quarantined', note: 'mad-lib cortex (immune-blocked)' },
      { level: 'SUB', name: 'credit-liquidity-subportal', status: (sub && sub.loaded) ? 'loaded' : 'absent', activeCount: (sub && sub.activeCount) || 0 }
    ];
    var loadedDepth = (sub && sub.loaded) ? 3 : (l1 ? 1 : 0);
    var admissible = l1Real + ((sub && sub.count) ? sub.count : 0);
    var blocked = l1Mad + 1;                                        // +1 for the quarantined L2 tier
    var portalErrorEstimate = Math.round((blocked / Math.max(1, admissible + blocked)) * 1000) / 1000;
    var pd = {
      version: 1, levels: levels, deepestUsableLevel: loadedDepth,
      portalErrorEstimate: portalErrorEstimate,
      note: 'ADVISORY: portalErrorEstimate surfaced but NOT folded into the validated fm.predictionError formula (weights preserved). Perception stops at L1 (L2 quarantined); no new fetches.',
      lastDepthAt: fm.updated || Date.now()
    };
    s.financePerceptionDepth = pd; return pd;
  };

  // K6 — attention / selective routing. Ranks top-down salience (active + relevance + novelty)
  // over the diagnoses and names focus vs suppressed, plus honors any operator attention-focus
  // steer. ADVISORY: does not gate the pipeline (no _applyNeuroGating in finance).
  FinanceBrain.prototype._computeFinanceAttention = function () {
    var s = this.state, fm = s.financeModel || {}, reg = fm.regulation || {};
    var pe = (fm.predictionError && fm.predictionError.total) || 0;
    var rb = this._readRequestBiases ? this._readRequestBiases() : { attentionFocus: [] };
    var focus = (rb.attentionFocus || []).map(function (f) { return String(f).toLowerCase(); });
    var scored = (s.diagnoses || []).map(function (d) {
      var sal = (d.active ? 0.5 : 0) + (d.relevance || 0) * 0.4 + pe * 0.1;
      var hay = (String(d.id) + ' ' + String(d.label || '')).toLowerCase();
      if (focus.some(function (f) { return f && hay.indexOf(f) !== -1; })) sal += 0.5;   // operator steer
      return { id: d.id, active: !!d.active, salience: Math.round(sal * 1000) / 1000 };
    }).sort(function (a, b) { return b.salience - a.salience; });
    var at = {
      version: 1,
      driver: reg.state === 'surprised' ? 'novelty-driven (bottom-up)' : 'goal-driven (top-down)',
      focus: scored.slice(0, 3),
      suppressed: scored.slice(3).map(function (x) { return x.id; }).slice(0, 8),
      broadenUnderSurprise: reg.state === 'surprised',
      note: 'ADVISORY: salience ranking + operator focus surfaced; does not gate the finance opportunity pipeline.',
      lastAttentionAt: fm.updated || Date.now()
    };
    s.financeAttention = at; return at;
  };

  // K7 — lateral inhibition microcircuit. reg.inhibition implies a winner-take-most ranking among
  // competing active diagnoses; this surfaces the winner and the suppression each competitor WOULD
  // take. ADVISORY: non-winner down-weight is surfaced, not applied.
  FinanceBrain.prototype._computeFinanceInhibition = function () {
    var s = this.state, fm = s.financeModel || {}, reg = fm.regulation || {};
    var inhib = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;
    var active = (s.diagnoses || []).filter(function (d) { return d.active; })
      .sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var winner = active[0] || null;
    var li = {
      version: 1, inhibitionStrength: inhib,
      winner: winner ? winner.id : null,
      competitors: active.slice(1).map(function (d) { return { id: d.id, relevance: d.relevance, suppressBy: Math.round((d.relevance || 0) * inhib * 1000) / 1000 }; }).slice(0, 6),
      note: 'ADVISORY: winner-take-most ranking surfaced; non-winner down-weight not applied to the finance pipeline.',
      lastInhibitionAt: fm.updated || Date.now()
    };
    s.financeInhibition = li; return li;
  };

  // K8 — adaptive homeostatic set-point (Turrigiano-style synaptic scaling). Maintains an adaptive
  // stress baseline over the last FK_HOMEO_WINDOW cycles alongside the fixed FM_STRESS_FLOOR.
  // CLOSED: readyForHandoff gates on a 50/50 blend of FM_STRESS_FLOOR and this adaptive baseline
  // (>=10 samples; bounded to at most +0.15 above the fixed floor) via fm._effectiveFloor. Also
  // exposes deviation (>=0) as an allostatic-target term parallel to the generic homeostasis one.
  FinanceBrain.prototype._computeFinanceHomeostasis = function () {
    var s = this.state, fm = s.financeModel || {};
    var win = ((s.memory && s.memory.stressHistory) || []).slice(-FK_HOMEO_WINDOW);
    var n = win.length, sum = 0;
    for (var i = 0; i < n; i++) sum += (win[i].stress || 0);
    var baseline = n ? sum / n : 0.5;
    var cur = (typeof s.stress === 'number') ? s.stress : 0;
    var scalingFactor = baseline > 0 ? Math.round((0.5 / Math.max(0.1, baseline)) * 1000) / 1000 : 1;
    var deviation = Math.max(0, cur - baseline);
    var hm = {
      version: 1,
      fixedFloor: FM_STRESS_FLOOR,
      adaptiveBaseline: Math.round(baseline * 1000) / 1000,
      currentStress: cur,
      deviationFromBaseline: Math.round((cur - baseline) * 1000) / 1000,
      deviation: Math.round(deviation * 1000) / 1000,             // servo allostatic-target term (>=0)
      scalingFactor: scalingFactor,
      samples: n,
      effectiveFloor: (fm._effectiveFloor) || null,
      note: 'CLOSED: readyForHandoff blends FM_STRESS_FLOOR with adaptiveBaseline (>=10 samples, bounded) via fm._effectiveFloor; deviation exposed as an allostatic-target term.',
      lastHomeostasisAt: fm.updated || Date.now()
    };
    s.financeHomeostasis = hm; return hm;
  };

  // Assemble the neuro-completion surface (mirrors energy _computeEnergyNeuroLayers). Runs the
  // eight K-layers in Energy's K1..K8 ORDER, stores each on state, and attaches a compact roll-up
  // to state additively (new key financeNeuro). The servo / phase / E/I brake are already wired
  // inline in _updateFinanceModel (existing actuation), so they are referenced here, not re-run.
  FinanceBrain.prototype._computeFinanceNeuroLayers = function () {
    this._computeFinanceAfferent();          // K1 — afferent inter-brain input
    this._computeFinanceGainControl();       // K2 — neuromodulatory gain application
    this._consolidateFinanceSlowModel();     // K3 — slow consolidation / long-term plasticity
    this._scoreFinanceOutcomes();            // K4 — outcome / credit learning (TRUTH BRAKE, self-consistency)
    this._computeFinancePerceptionDepth();   // K5 — deep hierarchical perception
    this._computeFinanceAttention();         // K6 — attention / selective routing
    this._computeFinanceInhibition();        // K7 — lateral inhibition (microcircuit)
    this._computeFinanceHomeostasis();       // K8 — adaptive set-point (microcircuit)
    var s = this.state;
    var neuro = {
      version: 1,
      status: 'closed',                       // K1/K4/K8 wired into the spine (recurrent, one-cycle lag); K2/K5/K6/K7 advisory
      afferent: s.financeAfferent || null,
      gainControl: s.financeGainControl || null,
      slowModel: s.financeSlowModel || null,
      outcomeModel: s.financeOutcomeModel || null,
      perceptionDepth: s.financePerceptionDepth || null,
      attention: s.financeAttention || null,
      inhibition: s.financeInhibition || null,
      homeostasis: s.financeHomeostasis || null,
      // existing actuation surfaces (computed inline in _updateFinanceModel this cycle)
      servo: s.financeServo || null,
      phaseDynamics: s.financePhaseDynamics || null,
      eiBrake: s.financeEIBrake || null,
      closedLoops: [
        'K1 afferent -> base scoreStress (externalPressure folded into stress) + correlation_breakdown condition',
        'K4 outcome -> _updateFinanceModel (hitRate scales learning rate; 3rd credit fallback)',
        'K8 set-point -> readyForHandoff (blended adaptive floor via fm._effectiveFloor)'
      ]
    };
    s.financeNeuro = neuro;
    if (s.cognition && typeof s.cognition === 'object') s.cognition.neuro = neuro;   // additive: new key only
    return neuro;
  };

  // ── The recurrent step — END of each cycle. Reads the prior from the PREVIOUS cycle, so
  //    cycle N+1's interpretation (predictedStress, readyForHandoff) depends on cycle N.
  //    NEVER touches the validated stress/diagnosis spine. ──
  FinanceBrain.prototype._updateFinanceModel = function () {
    var fm = this.state.financeModel || this._neutralFinanceModel();
    var priorIn = fm.prior;                                       // carried from last cycle
    var obs = this._buildFinanceObservation();                    // pure read of validated state
    var pe = this._computeFinancePredictionError(priorIn, obs);   // prior vs now

    // reads prior BEFORE the final decision (Kalman-style blend, NOT raw obs):
    var gainBlend = _fmClamp(pe.novelty, 0.05, 0.95);
    var predictedStress = priorIn.expectedStress * (1 - gainBlend) + obs.stress * gainBlend;
    var reg = this._computeFinanceRegulation(fm, obs, pe);

    // ── THING2 KERNEL PHASE (real recursive phase kernel; PURE MATH — no network, no AI) ──
    //    Push this cycle's primary scalar onto a persisted rolling series (cap 60), then ask the
    //    REAL Thing2 kernel for the current phase. The scalar is overall STRESS (up = worse) ->
    //    positive:false. When the kernel returns a phase it PREFERENTIALLY drives the coherence
    //    router (myPhase) + phase-transition reward in _computeFinancePhaseDynamics below;
    //    otherwise this._kernelPhase stays null and the existing naive s.phase is the fallback.
    //    Fully guarded: any failure or unavailability -> phaseSource='fallback', spine untouched.
    this._kernelPhase = null;
    try {
      var _scalar = (typeof obs.stress === 'number') ? obs.stress
        : (typeof this.state.stress === 'number') ? this.state.stress : null;
      if (_scalar != null && isFinite(_scalar)) {
        var _series = this._phaseSeries || (this._phaseSeries = []);
        _series.push(_scalar);
        while (_series.length > 60) _series.shift();     // cap length 60; shift oldest
        try {
          if (typeof localStorage !== 'undefined' && localStorage) {
            localStorage.setItem('limen:phaseseries:finance', JSON.stringify(_series));
          }
        } catch (_persistErr) { /* absent/full localStorage — series stays in-memory */ }
      }
      if (typeof window !== 'undefined' && window.LIMENThing2 && this._phaseSeries && this._phaseSeries.length >= 8) {
        var _kp = window.LIMENThing2.phaseOfSeries(this._phaseSeries, { positive: false });
        if (_kp && _kp.phase) {
          this._kernelPhase = _kp.phase;
          this.state.kernelPhase = _kp.phase;
          this.state.kernelTrajectory = _kp.trajectory;
          this.state.kernelCAccum = _kp.cAccumulator;
          this.state.phaseSource = 'thing2-kernel';
        } else {
          this.state.phaseSource = 'fallback';
        }
      } else {
        this.state.phaseSource = 'fallback';
      }
    } catch (_kernelErr) {
      this._kernelPhase = null;
      this.state.phaseSource = 'fallback';
    }

    // ── ACTUATION: PHASE-COHERENCE ROUTER + PHASE-TRANSITION REWARD (reads this cycle's
    //    generic forecast in state.domainNeuro). Ground-truth only on P3/P7 transitions. ──
    try { if (this._actuation && this._actuation.phase) this._computeFinancePhaseDynamics(); } catch (e) {}
    // ── ACTUATION: REGULATE-TO-TARGET SERVO (E/I). Reads reg.inhibition + the generic
    //    homeostasis deviation; effector = proportional emission dampening applied below. ──
    try { if (this._actuation && this._actuation.servo) this._computeFinanceServo(); } catch (e) {}

    // ── K8 CLOSED — homeostatic set-point: handoff gates on a 50/50 blend of the fixed floor and
    //    the adaptive baseline (prior cycle's financeHomeostasis; needs >=10 samples, else the fixed
    //    floor). Bounded to at most +0.15 above the fixed floor so a sustained-stress baseline cannot
    //    ratchet the gate out of reach. Mirrors energy-brain.js K8 closure. ──
    var _hm = this.state.financeHomeostasis;
    var _floor = (_hm && typeof _hm.adaptiveBaseline === 'number' && _hm.samples >= 10)
      ? _fmClamp(Math.min(0.5 * FM_STRESS_FLOOR + 0.5 * _hm.adaptiveBaseline, FM_STRESS_FLOOR + 0.15), 0.15, 0.6) : FM_STRESS_FLOOR;
    fm._effectiveFloor = _floor;

    var readyForHandoff = (fm.cycle > 0) && (predictedStress >= _floor) && (obs.diagnosisCount > 0) && !reg.flooding && !reg.stale;

    // ── K4 CREDIT-SOURCE HOOK (mirrors energy-brain.js:1398-1414). A VALIDATED phase transition
    //    (P3/P7, thing2 ground-truth) PREEMPTS the generic outcome ledger, which PREEMPTS the K4
    //    stress-self-prediction TRUTH BRAKE (prior cycle's financeOutcomeModel; >=5 samples). A low
    //    hit-rate raises the effective learning rate. Bounded, reversible, self-consistency only. ──
    var _lr = fm.plasticity.learningRate;
    var _pt = (this.state.financePhaseDynamics || {}).transition;
    var _phaseReward = !!(this._actuation && this._actuation.phase && _pt && _pt.validated && _pt.hit !== null);
    var _led = (this.state.domainNeuro || {}).outcomeLedger || null;
    var _fromLedger = !_phaseReward && !!(_led && typeof _led.hitRate === 'number' && _led.samples >= 3);
    var _om = this.state.financeOutcomeModel;   // K4 self-prediction (prior cycle), third fallback
    var _hit = _phaseReward ? (_pt.hit ? 1 : 0)
      : _fromLedger ? _led.hitRate
      : (_om && typeof _om.hitRate === 'number' && _om.samples >= 5) ? _om.hitRate : null;
    if (_hit !== null) _lr = _fmClamp(_lr * (1 + (1 - _hit)), FM_SLOW_RATE, 0.6);
    fm._effectiveLearningRate = _lr;
    fm._creditSource = _phaseReward ? 'phase-transition' : (_fromLedger ? 'call-ledger' : (_hit !== null ? 'stress-self-pred' : 'none'));

    var nextPrior = this._updateFinancePrior(priorIn, obs, _lr);   // → next cycle reads this (learning rate now credit-scaled)

    fm.cycle += 1;
    fm.observation = obs;
    fm.predictionError = pe;
    fm.predictedStress = predictedStress;
    fm.regulation = reg;
    fm.readyForHandoff = readyForHandoff;
    fm.prior = nextPrior;
    fm.updated = obs.timestamp;
    this.state.financeModel = fm;

    // memory log — used by intuition (PE trends). outcomeLog was declared but never written in finance.
    try {
      var mem = this.state.memory || (this.state.memory = {});
      var log = mem.outcomeLog || (mem.outcomeLog = []);
      log.push({ cycle: fm.cycle, predictionError: Math.round(pe.total * 1000) / 1000, stress: obs.stress, activeDx: obs.diagnosisCount, regulation: reg.state, timestamp: obs.timestamp });
      if (log.length > 40) log.shift();
    } catch (e) {}

    // H1-H6 — higher finance brain layers (domain-level, computed once per cycle BEFORE the DDP build)
    try { this._computeFinanceHigherLayers(); } catch (e) {}

    // PHASE K — neuro-completion loop stack (K1..K8, Energy's order). Additive/advisory; the two
    // Energy-faithful closures (K4 stress-self-pred credit fallback, K8 adaptive handoff floor) are
    // consumed via one-cycle lag above. Reads cached state only; deterministic; never rewires the spine.
    try { this._computeFinanceNeuroLayers(); } catch (e) {}

    // ── ACTUATION: E/I BRAKE (XIII.1) — dampen emitted-opportunity confidence PROPORTIONALLY to
    //    the servo's inhibition deficit vs drive. Effector = the same emission channel the generic
    //    brake gate uses. Opportunities are rebuilt fresh each cycle, so no compounding. ──
    try { if (this._actuation && this._actuation.eiBrake) this._applyFinanceEIBrake(); } catch (e) {}
    // ── E/I balance + self-audit ADVISORIES (observe-only; Neuro Ref XIII.1 + XIV). Consumes the
    //    finance edge graph (81 edges / 36 nodes) for single-points-of-failure. Never mutates scoring. ──
    try { fm.regulationAdvisories = this._computeFinanceRegulationAdvisories(); } catch (e) { fm.regulationAdvisories = null; }

    // CREDIT/LIQUIDITY — additive sub-layer (BEFORE the DDP build so the primary packet advertises it).
    try { this._buildFinanceSublayer(); } catch (e) {}

    // DDP — build the DomainDiagnosisPacket (8-section contract) for the primary diagnosis + one per diagnosis.
    try {
      var _diags = this.state.diagnoses || [];
      var _primary = _diags.filter(function (d) { return d.active; })[0] || _diags[0] || null;
      var _self = this;
      fm.domainDiagnosisPacket = this._buildDomainDiagnosisPacket(_primary);
      this.state.financeDomainDiagnosisPackets = _diags.map(function (d) { return _self._buildDomainDiagnosisPacket(d); });
    } catch (e) {}

    // state.cognition — generic surface domain-console reads for ANY brain.
    this.state.cognition = {
      domain: 'finance',
      financeModel: fm,
      model: { cycle: fm.cycle, predictionError: fm.predictionError, predictedStress: fm.predictedStress, regulation: fm.regulation },
      financeImmune: this.state.financeImmune || null,
      financeAwareness: this.state.financeAwareness || null,
      financeConscience: this.state.financeConscience || null,
      financeIntuition: this.state.financeIntuition || null,
      financeSimulation: this.state.financeSimulation || null,
      financeExecutiveReport: this.state.financeExecutiveReport || null,
      // ── ACTUATION surfaces (additive; new keys only) ──
      servo: this.state.financeServo || null,
      phaseDynamics: this.state.financePhaseDynamics || null,
      eiBrake: this.state.financeEIBrake || null,
      neuro: this.state.financeNeuro || null,   // PHASE K — K1..K8 neuro-completion roll-up (additive)
      regulationAdvisories: this.state.financeRegulationAdvisories || null,
      awareness: this.state.financeAwareness || null,
      conscience: this.state.financeConscience || null,
      immune: this.state.financeImmune || null,
      intuition: this.state.financeIntuition || null,
      sceneLayer: null,
      creditSublayer: this.state.creditSublayer || null,
      treatments: this.state.treatments || [],
      diagnoses: this.state.diagnoses || [],
      opportunities: this.state.opportunities || []
    };
    return fm;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // COGNITION LOADERS — fallback entities, validated distress signals, real source
  // bundles, L1 mad-lib scan, credit/liquidity sub-portal. Each is one-shot + guarded.
  // ════════════════════════════════════════════════════════════════════════════

  // Real finance entities from command-board-data (state.companies starved). Guarded.
  FinanceBrain.prototype._loadFinanceCommandBoardCompanies = function () {
    var self = this;
    if (self._cbFinanceCompanies) return;            // one-shot
    self._cbFinanceCompanies = [];
    try {
      fetch('/assets/data/command-board-data.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data) return;
          var arr = Array.isArray(data) ? data : (Object.keys(data).map(function (k) { return data[k]; }).find(Array.isArray) || []);
          self._cbFinanceCompanies = arr
            .filter(function (x) { return x && x.d === 'finance' && x.t; })
            .map(function (x) { return { name: x.n, ticker: x.t, cik: x.c, phase: x.p, trajectory: x.tr }; });
        })
        .catch(function () {});
    } catch (e) {}
  };

  // Distress signals come ONLY from the validated Thing pipeline (/api/brain-signals).
  // NEVER from the raw command-board phase (noise). One-shot; {} if the gate abstains.
  FinanceBrain.prototype._loadFinanceBrainSignals = function () {
    var self = this;
    if (self._pubSignals) return;                   // one-shot
    self._pubSignals = {};
    try {
      fetch('/api/brain-signals?domain=finance')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j || !j.publishable) return;
          var m = {};
          j.publishable.forEach(function (s) { if (s.ticker) m[s.ticker] = s; });
          self._pubSignals = m;                     // {} today (gate abstains on degenerate data)
        })
        .catch(function () {});
    } catch (e) {}
  };

  // Canonical diagnosis resolution. Prefers window.LIMENArtifactSourceIndex.aliases(),
  // else FINANCE_DIAGNOSIS_ALIASES. Non-aliased diagnoses are canonical to themselves.
  var FINANCE_DIAGNOSIS_ALIASES = {
    BANKING_CRISIS:      { target: 'BANKING_CRISIS', reviewStatus: 'corpus-aliased', risk: 'low', note: 'canonical banking-crisis distress signature (bank failure / interbank stress)' },
    CREDIT_FREEZE:       { target: 'CREDIT_FREEZE', reviewStatus: 'corpus-aliased', risk: 'low', note: 'canonical credit-contraction / lending-freeze signature' },
    MARKET_CRASH:        { target: 'MARKET_CRASH', reviewStatus: 'corpus-aliased', risk: 'low', note: 'canonical equity/market dislocation signature' },
    CURRENCY_COLLAPSE:   { target: 'CURRENCY_COLLAPSE', reviewStatus: 'corpus-aliased', risk: 'low', note: 'canonical FX / reserves-depletion signature' },
    SYSTEMIC_CONTAGION:  { target: 'SYSTEMIC_CONTAGION', reviewStatus: 'corpus-aliased', risk: 'low', note: 'canonical systemic-risk / cross-institution contagion signature' },
    FRAUD_SCANDAL:       { target: 'FRAUD_SCANDAL', reviewStatus: 'corpus-aliased', risk: 'low', note: 'canonical fraud / accounting-irregularity / regulatory-action signature' }
  };
  FinanceBrain.prototype._resolveFinanceCanonicalDiagnosis = function (dxId) {
    if (!dxId) return { canonicalDiagnosisId: null, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };
    var target = null;
    try {
      var idx = (typeof window !== 'undefined') ? window.LIMENArtifactSourceIndex : null;
      if (idx && typeof idx.aliases === 'function') { var row = idx.aliases()[dxId]; if (row && row.target) target = row.target; }
    } catch (e) {}
    var local = FINANCE_DIAGNOSIS_ALIASES[dxId] || null;
    if (!target && local && local.target !== dxId) target = local.target;
    if (target && target !== dxId) {
      return { canonicalDiagnosisId: target, aliasUsed: true, aliasReviewStatus: (local && local.reviewStatus) || 'corpus-aliased', aliasRisk: (local && local.risk) || 'low', aliasNote: (local && local.note) || null };
    }
    return { canonicalDiagnosisId: dxId, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };   // canonical to self
  };

  // Load REAL source bundles (one-shot, async). Resolves aliases BEFORE fetching.
  // Only files that exist resolve to 'found'; 404s -> 'missing'. Never fabricates.
  FinanceBrain.prototype._loadFinanceDiagnosisBundles = function () {
    var self = this;
    if (self._financeBundleLoadPromise) return self._financeBundleLoadPromise;
    self._bundleCache = self._bundleCache || {};
    self._bundleStatusMap = self._bundleStatusMap || {};
    var ids = {};
    var known = ['BANKING_CRISIS', 'CREDIT_FREEZE', 'MARKET_CRASH', 'CURRENCY_COLLAPSE', 'SYSTEMIC_CONTAGION', 'FRAUD_SCANDAL'];
    var diags = (self.state && self.state.diagnoses) || [];
    var allDxIds = diags.map(function (d) { return d.id; }).concat(known);
    for (var i = 0; i < allDxIds.length; i++) { var c = self._resolveFinanceCanonicalDiagnosis(allDxIds[i]).canonicalDiagnosisId; if (c) ids[c] = true; }
    self._financeBundleLoadPromise = Promise.all(Object.keys(ids).map(function (cid) {
      return fetch('/assets/data/artifact-source-index/by-diagnosis/' + encodeURIComponent(cid) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) { self._bundleStatusMap[cid] = data ? 'found' : 'missing'; if (data) self._bundleCache[cid] = data; })
        .catch(function () { self._bundleStatusMap[cid] = 'missing'; });
    })).then(function () { return self._bundleCache; });
    return self._financeBundleLoadPromise;
  };

  // _financeBundleStates — per-diagnosis canonical resolution + bundle status + provenance.
  FinanceBrain.prototype._financeBundleStates = function () {
    var self = this; var diags = (this.state && this.state.diagnoses) || [];
    return diags.map(function (d) {
      var c = self._resolveFinanceCanonicalDiagnosis(d.id);
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

  // L1 portal mad-lib scan. L1 treatments are fixed-verb templates; quarantined from evidence.
  // Only real institution tickers surface (relevance-unverified).
  var FINANCE_MADLIB_VERB = /^(Develop|Establish|Implement|Build|Launch|Design|Deploy|Operationalize|Conduct|Create|Define|Assess|Optimize|Modernize|Strengthen|Enhance|Formalize|Institute|Standardize|Coordinate|Integrate|Calibrate|Evaluate|Streamline|Institutionalize|Configure|Monitor)\b/;
  FinanceBrain.prototype._isFinanceMadLibTreatment = function (label) { return !label || FINANCE_MADLIB_VERB.test(String(label)); };

  FinanceBrain.prototype._loadFinanceL1PortalDepth = function () {
    var self = this;
    if (self._financeL1LoadPromise) return self._financeL1LoadPromise;
    var BRANCH = {
      BANKING_CRISIS: ['banking', 'credit', 'failure'],
      CREDIT_FREEZE: ['credit', 'interbank', 'liquidity'],
      MARKET_CRASH: ['market', 'volatility', 'contagion'],
      CURRENCY_COLLAPSE: ['currency', 'fx', 'reserves'],
      SYSTEMIC_CONTAGION: ['systemic', 'contagion', 'risk'],
      FRAUD_SCANDAL: ['fraud', 'scandal', 'regulatory']
    };
    self._financeL1Branches = BRANCH;
    var branches = {}; Object.keys(BRANCH).forEach(function (dx) { BRANCH[dx].forEach(function (b) { branches[b] = true; }); });
    var byBranch = {};
    self._financeL1LoadPromise = Promise.all(Object.keys(branches).map(function (b) {
      return fetch('/assets/data/domains/finance_' + encodeURIComponent(b) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) {
          if (!data) { byBranch[b] = null; return; }
          var acts = data.activations || [], tickers = {}, total = 0, mad = 0;
          acts.forEach(function (a) {
            (a.companies || []).forEach(function (c) { if (c && c.ticker_or_id) tickers[c.ticker_or_id] = c.name || c.ticker_or_id; });
            (a.treatments || []).forEach(function (t) { var l = t && (t.label || t.title); if (l) { total++; if (self._isFinanceMadLibTreatment(l)) mad++; } });
          });
          byBranch[b] = { file: 'finance_' + b, companyTickers: Object.keys(tickers).map(function (k) { return { ticker: k, name: tickers[k] }; }), treatmentTotal: total, madLibCount: mad, realTreatmentCount: total - mad };
        })
        .catch(function () { byBranch[b] = null; });
    })).then(function () {
      var byDiagnosis = {};
      Object.keys(BRANCH).forEach(function (dx) {
        var tk = {}, total = 0, mad = 0, scanned = 0;
        BRANCH[dx].forEach(function (b) { var r = byBranch[b]; if (r) { scanned++; r.companyTickers.forEach(function (c) { tk[c.ticker] = c.name; }); total += r.treatmentTotal; mad += r.madLibCount; } });
        byDiagnosis[dx] = { branchesScanned: scanned, realCompanyTickers: Object.keys(tk).map(function (k) { return { ticker: k, name: tk[k], relevanceUnverified: true }; }), treatmentTotal: total, madLibTreatments: mad, realTreatments: total - mad, admitted: false, reason: 'L1 treatments are mad-lib templates (fixed-verb family) — not source-grade; only institution tickers surfaced, relevance unverified' };
      });
      self.state._l1DepthCache = { byBranch: byBranch, byDiagnosis: byDiagnosis, scannedAt: (self.state.financeModel && self.state.financeModel.updated) || null };
      return self.state._l1DepthCache;
    });
    return self._financeL1LoadPromise;
  };

  // CREDIT/LIQUIDITY sub-portal layer (counterpart to energy's data-center; culture's scene).
  // Real-content, citation-backed credit/liquidity diagnoses + treatments. NEVER merged into the
  // validated diagnosis spine; non-binding, research-grade only. Graceful 404.
  FinanceBrain.prototype._loadFinanceSublayer = function () {
    var self = this;
    if (self._financeSublayerLoadPromise) return self._financeSublayerLoadPromise;
    self._financeSublayerLoadPromise = fetch('/assets/data/domains/finance_credit.json')
      .then(function (r) { return (r && r.ok) ? r.json() : null; })
      .then(function (data) { if (data) return data; return fetch('/assets/data/domains/finance_liquidity.json').then(function (r2) { return (r2 && r2.ok) ? r2.json() : null; }); })
      .then(function (data) {
        if (!data) { self._creditPortal = null; return null; }
        self._creditPortal = { issues: data.issues || [], activations: data.activations || [], title: data.title || 'Credit & Liquidity' };
        return self._creditPortal;
      })
      .catch(function () { self._creditPortal = null; return null; });
    return self._financeSublayerLoadPromise;
  };

  FinanceBrain.prototype._buildFinanceSublayer = function () {
    var self = this;
    var cp = self._creditPortal;
    if (!cp || !cp.issues || !cp.issues.length) {
      self.state.creditDiagnoses = [];
      self.state.creditTreatments = [];
      self.state.financeCreditDomainDiagnosisPackets = [];
      self.state.creditSublayer = { loaded: false, count: 0, activeCount: 0, activeDiagnoses: [], triggers: ['SOFR > 5.5', 'TED > 100bp'], companies: ['JPM', 'BLK'], note: 'finance credit/liquidity sub-portal not loaded (offline or fetch failed); non-binding research-grade only' };
      return self.state.creditSublayer;
    }
    var conditions = self._activeConditions || [];
    // 1) diagnoses — same condition-match logic as the canonical spine
    var diagnoses = cp.issues.map(function (iss) {
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
        source: 'credit', tier: 'real-content-unbundled', branch: 'credit'
      };
    });
    // 2) treatments — pull from credit node activations whose brainNodeId is in a diagnosis circuit
    var nodeToDx = {};
    diagnoses.forEach(function (d) { (d.circuits || []).forEach(function (c) { if (c && c.nodeId) nodeToDx[c.nodeId] = d.id; }); });
    var treatments = [];
    (cp.activations || []).forEach(function (act) {
      var dxId = nodeToDx[act.brainNodeId];
      if (!dxId) return;
      (act.treatments || []).forEach(function (t, ti) {
        treatments.push({
          id: 'credit_treat_' + act.brainNodeId + '_' + ti,
          label: t.label, type: t.type, evidence: t.evidence, description: t.description || '',
          cite: t.cite || null, citation: t.citation || [], steps: t.steps || [],
          diagnosisId: dxId, nodeId: act.brainNodeId,
          source: 'credit', madLib: self._isFinanceMadLibTreatment ? self._isFinanceMadLibTreatment(t.label) : false
        });
      });
    });
    var evidenceRank = { A: 10, Strong: 10, B: 7, Moderate: 7, C: 4, Emerging: 1 };
    treatments.sort(function (a, b) { return (evidenceRank[b.evidence] || 0) - (evidenceRank[a.evidence] || 0); });
    self.state.creditDiagnoses = diagnoses;
    self.state.creditTreatments = treatments;
    // 3) compact layer summary (read by every DDP's promptView)
    self.state.creditSublayer = {
      loaded: true,
      portalTitle: cp.title,
      count: diagnoses.length,
      activeCount: diagnoses.filter(function (d) { return d.active; }).length,
      activeDiagnoses: diagnoses.filter(function (d) { return d.active; }).map(function (d) { return d.id; }),
      triggers: ['SOFR > 5.5', 'TED > 100bp'],
      companies: ['JPM', 'BLK'],
      diagnoses: diagnoses.map(function (d) {
        var rc = self._resolveFinanceCanonicalDiagnosis ? self._resolveFinanceCanonicalDiagnosis(d.id) : { canonicalDiagnosisId: d.id };
        var bsStat = (self._bundleStatusMap && self._bundleStatusMap[rc.canonicalDiagnosisId]) || 'missing';
        return { id: d.id, label: d.label, active: d.active, branch: 'credit', canonicalDiagnosisId: rc.canonicalDiagnosisId, bundleStatus: bsStat, treatmentCount: treatments.filter(function (t) { return t.diagnosisId === d.id; }).length };
      }),
      note: 'real-content (credit/liquidity) sub-portal diagnoses (credit spreads, SOFR, interbank lending, reserve adequacy); SEPARATE from the validated diagnosis spine; non-binding research-grade; no external artifact-source bundle yet; never admitted to evidenceAnchors'
    };
    // 4) per-diagnosis DDPs via the SAME schema builder (canonical-to-self; bundle 'missing')
    self.state.financeCreditDomainDiagnosisPackets = diagnoses.map(function (d) {
      try { return self._buildDomainDiagnosisPacket(d); } catch (e) { return null; }
    }).filter(Boolean);
    return self.state.creditSublayer;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // H1-H6 — HIGHER FINANCE BRAIN LAYERS (additive, domain-level). Computed once per cycle
  // BEFORE the DDP build; each emits a COMPACT summary the DDP embeds in promptView + the full
  // object in audit. Never fabricates evidence; intuition/simulation are labelled unverified/hypothetical.
  // ════════════════════════════════════════════════════════════════════════════
  FinanceBrain.prototype._computeFinanceHigherLayers = function () {
    this._computeFinanceImmune();
    this._computeFinanceAwareness();
    this._computeFinanceConscience();
    this._computeFinanceIntuition();
    try { this._computeFinanceSimulation(); } catch (e) {}
    try { this._computeFinanceExecutiveReport(); } catch (e) {}
  };

  // H1 — immune (antigen scan over bundle/feed/regulation state)
  FinanceBrain.prototype._computeFinanceImmune = function () {
    var s = this.state, fm = s.financeModel || {}, reg = fm.regulation || {}, ant = [];
    var bs = (typeof this._financeBundleStates === 'function') ? this._financeBundleStates() : [];
    bs.forEach(function (b) {
      if (b.bundleStatus === 'missing') ant.push({ type: 'source-bundle-missing', dx: b.dxId, severity: 'medium', action: 'block-from-prompt-evidence' });
      if (b.buildMethod === 'external-source-authored') ant.push({ type: 'external-source-authored-needs-human-verification', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
      if (b.aliasRisk === 'medium' || b.aliasRisk === 'high') ant.push({ type: 'alias-risk-bundle', dx: b.dxId, severity: b.aliasRisk, action: 'allow-with-warning' });
      if (b.bundleStatus === 'found' && b.shallow) ant.push({ type: 'root-only-shallow-bundle', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
    });
    var pe = (fm.predictionError && fm.predictionError.total) || 0;
    if (pe > 0.4) ant.push({ type: 'prediction-error-spike', severity: 'medium', action: 'lower-confidence', value: Math.round(pe * 1000) / 1000 });
    if (reg.stale) ant.push({ type: 'stale-feeds', severity: 'low', action: 'flag' });
    if (reg.flooding) ant.push({ type: 'opportunity-flood', severity: 'medium', action: 'inhibit' });
    if (reg.starving) ant.push({ type: 'stress-without-opportunity', severity: 'low', action: 'flag' });
    var _l1 = s._l1DepthCache;
    if (_l1 && _l1.byDiagnosis && Object.keys(_l1.byDiagnosis).some(function (dx) { return _l1.byDiagnosis[dx].madLibTreatments > 0; })) {
      ant.push({ type: 'l1-synthetic-treatments', severity: 'medium', action: 'quarantine', note: 'L1 portal treatments are mad-lib templates (fixed-verb family); quarantined from evidence — only real institution tickers surfaced relevance-unverified' });
    }
    var sev = ant.some(function (a) { return a.severity === 'high'; }) ? 'high' : ant.some(function (a) { return a.severity === 'medium'; }) ? 'medium' : ant.length ? 'low' : 'none';
    s.financeImmune = {
      version: 1, immuneState: sev === 'high' ? 'alert' : sev === 'medium' ? 'active' : sev === 'low' ? 'watch' : 'clear', severity: sev,
      antigens: ant.slice(0, 12),
      quarantines: ['L1-portal-treatments-madlib'],
      allowedWithWarning: ant.filter(function (a) { return a.action === 'allow-with-warning'; }).map(function (a) { return a.type + (a.dx ? (':' + a.dx) : ''); }),
      blockedFromPrompt: ant.filter(function (a) { return a.action === 'block-from-prompt-evidence'; }).map(function (a) { return a.dx; }),
      blockedFromTraversal: ['L2'],
      lastScanAt: fm.updated || null
    };
    return s.financeImmune;
  };

  // H2 — awareness (narrative on banking/credit/market/currency distress posture)
  FinanceBrain.prototype._computeFinanceAwareness = function () {
    var s = this.state, fm = s.financeModel || {}, im = s.financeImmune || {}, active = (s.diagnoses || []).filter(function (d) { return d.active; });
    var pe = (fm.predictionError && fm.predictionError.total) || 0, dxNames = active.map(function (d) { return d.label || d.id; });
    s.financeAwareness = {
      version: 1, selfState: im.immuneState === 'alert' ? 'guarded' : (fm.regulation && fm.regulation.state) || 'unknown',
      knowns: dxNames.slice(0, 6),
      uncertainties: ['interpretive cognition layer — these higher-layer readings sit ALONGSIDE the validated P3 distress scorer, never replace it', 'predictionError=' + (Math.round(pe * 1000) / 1000)],
      confidenceDrivers: ['regulation ' + ((fm.regulation && fm.regulation.state) || '?'), active.length + ' active dx'],
      selfNarrative: 'Finance: ' + active.length + ' active diagnosis pathway' + (active.length !== 1 ? 's' : '') + ' (' + (dxNames.slice(0, 3).join(', ') || 'none') + '), regulation=' + ((fm.regulation && fm.regulation.state) || '?') + ', immune=' + (im.immuneState || '?') + ', prediction-error ' + (Math.round(pe * 100) / 100) + '.',
      lastAwarenessAt: fm.updated || null
    };
    return s.financeAwareness;
  };

  // H3 — conscience (artifact readiness; FINANCE does INVESTABLE/RESEARCHABLE only — no patent/grant)
  FinanceBrain.prototype._computeFinanceConscience = function () {
    var s = this.state, fm = s.financeModel || {}, pe = (fm.predictionError && fm.predictionError.total) || 0, cautions = [];
    if (pe > 0.4) cautions.push({ claim: 'high-confidence-claim', reason: 'predictionError spike ' + (Math.round(pe * 1000) / 1000) });
    s.financeConscience = {
      version: 1, conscienceState: 'restrictive',
      vetoes: [{ claim: 'patent/grant', reason: 'finance diagnoses have no method/embodiment; patent/grant lanes retired 2026-06-21' }],
      cautions: cautions.slice(0, 8),
      allowedClaims: ['source-summary', 'finance-brief-with-warnings'],
      blockedClaims: ['patent-claim', 'grant-claim'],
      artifactReadinessDecision: { patentReady: false, grantReady: false, investmentReady: true, researchReady: true, note: 'patent/grant vetoed; investment/research allowed-with-warning' },
      reasons: ['overclaim prevention', 'cognition-layer is interpretive (the validated P3 scorer is the only certified path)'],
      lastCheckAt: fm.updated || null
    };
    return s.financeConscience;
  };

  // H4 — intuition (hunches on emerging regime shifts / novel stressors; NOT evidence)
  FinanceBrain.prototype._computeFinanceIntuition = function () {
    var s = this.state, fm = s.financeModel || {}, reg = fm.regulation || {}, log = (s.memory && s.memory.outcomeLog) || [], hunches = [];
    if (log.length >= 2) { var a = log[log.length - 2].predictionError, b = log[log.length - 1].predictionError; if (typeof a === 'number' && typeof b === 'number' && b - a > 0.05) hunches.push({ hunch: 'financial regime shift forming (prediction error rising) — emerging credit/market stressor', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'predictionError rose ' + a + ' → ' + b }); }
    if (reg.state === 'surprised') hunches.push({ hunch: 'novel financial stressor entering the system (rate shock / liquidity break / contagion onset)', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'regulation = surprised' });
    var FAMILY = { 'banking': ['BANKING_CRISIS', 'CREDIT_FREEZE'], 'contagion': ['MARKET_CRASH', 'SYSTEMIC_CONTAGION'], 'currency': ['CURRENCY_COLLAPSE'], 'fraud': ['FRAUD_SCANDAL'] };
    var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var primaryId = (active[0] || {}).id, analogies = [];
    Object.keys(FAMILY).forEach(function (fam) { if (FAMILY[fam].indexOf(primaryId) >= 0) { FAMILY[fam].forEach(function (sib) { if (sib !== primaryId) analogies.push({ analogy: primaryId + ' resembles ' + sib, family: fam, evidenceStatus: 'UNVERIFIED' }); }); } });
    s.financeIntuition = { version: 1, hunches: hunches.slice(0, 6), analogies: analogies.slice(0, 6), lastAt: fm.updated || null };
    return s.financeIntuition;
  };

  // H5 — bounded counterfactual simulation (hypothetical only; UNVERIFIED)
  FinanceBrain.prototype._computeFinanceSimulation = function () {
    var s = this.state, fm = s.financeModel || {};
    var base = typeof s.stress === 'number' ? s.stress : 0;
    function cl(v) { return Math.max(0, Math.min(1, Math.round(v * 1000) / 1000)); }
    var scenarios = [
      { type: 'credit_freeze_cascade', hypothetical: true, assumption: 'rapid credit tightening spreads across wholesale markets', simulatedStress: cl(base + 0.25), risk: 'CREDIT_FREEZE diagnosis (interbank lending seizes)', intervention: 'central bank liquidity facility / TLF activation', falsifier: 'interbank lending stays positive' },
      { type: 'bank_failure_cascade', hypothetical: true, assumption: 'a mid-size bank fails and deposit flight spreads to peers', simulatedStress: cl(base + 0.3), risk: 'BANKING_CRISIS (depositor run / counterparty stress)', intervention: 'FDIC resolution + systemic-risk exception / discount-window access', falsifier: 'deposit base stable; no peer outflows' },
      { type: 'market_contagion_spread', hypothetical: true, assumption: 'a volatility shock correlates across asset classes', simulatedStress: cl(base + 0.2), risk: 'MARKET_CRASH (correlation breakdown / forced deleveraging)', intervention: 'circuit breakers / margin relief / liquidity backstop', falsifier: 'cross-asset correlation normalizes' },
      { type: 'currency_run', hypothetical: true, assumption: 'capital flight pressures a currency and depletes reserves', simulatedStress: cl(base + 0.25), risk: 'CURRENCY_COLLAPSE (FX collapse / reserves depletion)', intervention: 'FX intervention / swap lines / capital controls', falsifier: 'reserves and FX rate stabilize' },
      { type: 'sovereign_default', hypothetical: true, assumption: 'a sovereign yield spike triggers downgrade and default risk', simulatedStress: cl(base + 0.3), risk: 'SYSTEMIC_CONTAGION (sovereign-bank doom loop)', intervention: 'multilateral backstop / debt restructuring / central-bank support', falsifier: 'yields compress; financing access restored' }
    ];
    var sim = {
      version: 1, scenarios: scenarios, assumptions: scenarios.map(function (x) { return x.assumption; }),
      simulatedStress: scenarios.map(function (x) { return x.simulatedStress; }),
      simulatedDiagnoses: ['BANKING_CRISIS', 'CREDIT_FREEZE', 'MARKET_CRASH', 'CURRENCY_COLLAPSE', 'SYSTEMIC_CONTAGION'], simulatedOpportunities: [],
      risks: scenarios.map(function (x) { return x.risk; }), interventions: scenarios.map(function (x) { return x.intervention; }),
      falsifiers: scenarios.map(function (x) { return x.falsifier; }),
      themeEntities: ['JPM', 'BAC', 'GS', 'MS', 'BLK', 'V', 'MA', 'SCHW', 'C', 'WFC', 'KKR', 'BX'],
      lastSimulatedAt: fm.updated || null
    };
    s.financeSimulation = sim; return sim;
  };

  // H6 — executive self-report (compact status card)
  FinanceBrain.prototype._computeFinanceExecutiveReport = function () {
    var s = this.state, fm = s.financeModel || {}, im = s.financeImmune || {}, aw = s.financeAwareness || {}, con = s.financeConscience || {}, it = s.financeIntuition || {}, sim = s.financeSimulation || {};
    var bs = (typeof this._financeBundleStates === 'function') ? this._financeBundleStates() : [];
    var covered = bs.filter(function (b) { return b.bundleStatus === 'found'; }).length;
    var hv = bs.filter(function (b) { return b.humanVerification === 'required'; }).length;
    var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var strongest = active[0] || (s.diagnoses || [])[0] || null;
    var pe = (fm.predictionError && fm.predictionError.total) || 0;
    var status = im.immuneState === 'alert' ? 'immune-alert' : hv > 0 ? 'human-review-required' : (bs.length && covered < bs.length) ? 'source-limited' : (fm.regulation && fm.regulation.starving) ? 'starving' : (fm.regulation && fm.regulation.state === 'surprised') ? 'surprised' : 'healthy';
    var rep = {
      version: 1, brainStatus: status,
      strongestDiagnosis: strongest ? strongest.id : null,
      strongestOpportunity: (s.opportunities && s.opportunities[0] && s.opportunities[0].title) || null,
      confidence: Math.round((1 - pe) * 100) / 100, predictionError: Math.round(pe * 1000) / 1000,
      regulationState: (fm.regulation && fm.regulation.state) || null, immuneState: im.immuneState || null,
      awarenessSummary: aw.selfNarrative || null, conscienceDecision: con.conscienceState || null,
      intuitionSummary: (it.hunches || []).length + ' hunch(es)', simulationSummary: (sim.scenarios || []).length + ' scenario(s)',
      artifactReadiness: con.artifactReadinessDecision || null, blockers: (con.blockedClaims || []).slice(0, 6),
      nextBestAction: (bs.length && covered < bs.length) ? 'build/verify source for uncovered diagnoses' : hv > 0 ? 'human-verify external-source bundles' : 'monitor strongest diagnosis sources (credit/banking/market/currency feeds, regulatory action counts)',
      lastReportAt: fm.updated || null
    };
    s.financeExecutiveReport = rep; return rep;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // DDP — the 8-section DomainDiagnosisPacket the Civilization cockpit consumes.
  // Mirrors energy/culture _buildDomainDiagnosisPacket exactly; only the CONTENT is financial.
  // Schema-only: never invents data. Absent fields are EXPLICIT null / [] / 'missing'.
  // ════════════════════════════════════════════════════════════════════════════
  var FINANCE_DDP_SCHEMA_VERSION = 'finance-ddp-1';
  function _financeDdpPresent(v) {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (v === 'missing' || v === '' || v === 'none') return false;
    return true;
  }
  function _financeDdpCompleteness(section, keys) {
    var have = 0; for (var i = 0; i < keys.length; i++) { if (_financeDdpPresent(section[keys[i]])) have++; }
    return { have: have, total: keys.length, pct: keys.length ? Math.round(have / keys.length * 100) : 0 };
  }
  FinanceBrain.prototype._buildDomainDiagnosisPacket = function (dx) {
    var s = this.state || {};
    var fm = s.financeModel || {};
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

    var _canon = this._resolveFinanceCanonicalDiagnosis(dxId);
    var identity = {
      domain: 'finance',
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
      financeModel: { version: fm.version || null, cycle: (typeof fm.cycle === 'number' ? fm.cycle : null) },
      predictionError: fm.predictionError || null,
      regulationState: (fm.regulation && fm.regulation.state) || null,
      prior: fm.prior || null,
      observation: fm.observation || null,
      plasticity: fm.plasticity || null,
      readyForHandoff: fm.readyForHandoff === true
    };
    var rootId = (portal && portal.domainId) || 'finance';
    var rootTitle = (portal && portal.title) || 'Finance';
    var ancestry = (portal && portal.parentLabel) ? [portal.parentLabel, rootTitle] : [rootTitle];
    var portalContext = {
      portalIds: [rootId],
      portalDomain: 'finance',
      portalTitle: rootTitle,
      depth: 0,
      ancestryPath: ancestry,
      portalStatus: portal ? 'root-only' : 'pending',
      sourceCompleteness: portal ? ((Array.isArray(portal.issues) && portal.issues.length) ? 'partial' : 'thin') : 'root-only',
      bundleSource: (_bundle && Array.isArray(_bundle.sourcePortals) && _bundle.sourcePortals.length)
        ? { portalIds: _bundle.sourcePortals.map(function (sp) { return sp.portalId; }), depth: _bundle.maxDepth || 0, ancestryPath: (_bundle.sourcePortals[0].ancestry || []), domains: _bundle.domains || [] }
        : null,
      l1Depth: (s._l1DepthCache && s._l1DepthCache.byDiagnosis && s._l1DepthCache.byDiagnosis[dxId]) || (s._l1DepthCache ? { branchesScanned: 0, realCompanyTickers: [], realTreatments: 0, madLibTreatments: 0, admitted: false, reason: 'no L1 branch mapped for this diagnosis' } : null)
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
    var _intakeSrcHint = {
      BANKING_CRISIS: 'FDIC bank-failure list / Fed H.8 / call reports / FSOC annual report',
      CREDIT_FREEZE: 'Fed SLOOS / NY Fed SOFR + repo data / FRED credit spreads / TED spread',
      MARKET_CRASH: 'CBOE VIX / SEC EDGAR filings / FINRA TRACE / exchange circuit-breaker logs',
      CURRENCY_COLLAPSE: 'IMF reserves data / BIS FX statistics / central-bank intervention disclosures',
      SYSTEMIC_CONTAGION: 'FSOC / OFR financial-stability reports / Fed systemic-risk monitor / BIS',
      FRAUD_SCANDAL: 'SEC enforcement actions / DOJ / FINRA disciplinary actions / PCAOB inspection reports'
    };
    var authoringIntake = [];
    if (_isExternal) {
      ['methodCandidates', 'embodimentCandidates', 'figurePlaceholders'].forEach(function (field) {
        if (_bArr(field).length === 0) authoringIntake.push({ field: field, status: 'needs-human-input', count: 0, need: field === 'methodCandidates' ? 'a concrete financial-risk/surveillance method drawn from a primary source' : field === 'embodimentCandidates' ? 'a specific implementation/embodiment from a real document' : 'a figure description grounded in a real source', sourceHint: _intakeSrcHint[identity.canonicalDiagnosisId] || 'primary institutional / financial-regulatory source', note: 'NOT fabricated by the brain — author from the cited source, then wire in verbatim with attribution' });
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
      patentReady: false, grantReady: false, sbaReady: false,   // patent/grant/loan vetoed by H3 conscience
      investmentReady: !!(hasTreat && primaryOpp), researchReady: ready || hasTreat,
      readinessReasons: readinessReasons,
      blockers: blockers
    };

    var comp = {
      identity:         _financeDdpCompleteness(identity, ['domain', 'diagnosisId', 'canonicalDiagnosisId', 'label', 'phase', 'confidence']),
      brainState:       _financeDdpCompleteness(brainState, ['financeModel', 'predictionError', 'regulationState', 'prior', 'observation', 'plasticity']),
      portalContext:    _financeDdpCompleteness(portalContext, ['portalIds', 'portalDomain', 'portalTitle', 'depth', 'ancestryPath']),
      evidence:         _financeDdpCompleteness(evidence, ['sourceFeeds', 'evidenceAnchors', 'citationHints']),
      treatmentContext: _financeDdpCompleteness(treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']),
      operatorContext:  _financeDdpCompleteness(operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']),
      artifactContext:  _financeDdpCompleteness(artifactContext, ['artifactLanes'])
    };
    var totHave = 0, totAll = 0;
    for (var sk in comp) { if (comp.hasOwnProperty(sk)) { totHave += comp[sk].have; totAll += comp[sk].total; } }
    var missingFields = [];
    function _fmf(name, obj, keys) { for (var i = 0; i < keys.length; i++) { if (!_financeDdpPresent(obj[keys[i]])) missingFields.push(name + '.' + keys[i]); } }
    _fmf('identity', identity, ['canonicalDiagnosisId', 'confidence']);
    _fmf('evidence', evidence, ['evidenceAnchors', 'citationHints']);
    _fmf('treatmentContext', treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']);
    _fmf('operatorContext', operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']);

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
    if (!primaryOpp && (typeof s.stress !== 'number' || s.stress < FM_STRESS_FLOOR)) warnings.push('no active opportunity (offline/low-stress) — operator/lane fields stay empty');
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
        'diagnosis-specific bundle anchors preferred over generic finance evidence',
        'official/primary sources retained (FDIC/Fed/SEC/FINRA/OFR/BIS/IMF where present)',
        'mechanisms prioritized over figures under prompt-space limits',
        'treatments with implementation relevance preferred over broad narrative',
        'caps applied per field; full data preserved in the stored bundle + full DDP'
      ],
      retainedWarnings: warnings
        .concat(s.financeImmune ? ['immune: ' + s.financeImmune.immuneState + ' (sev ' + s.financeImmune.severity + ', ' + (s.financeImmune.antigens || []).length + ' antigens; L2 traversal blocked)'] : [])
        .concat(s.financeConscience && s.financeConscience.conscienceState === 'restrictive' ? ['conscience: ' + (s.financeConscience.blockedClaims || []).slice(0, 3).join(', ') + ' blocked'] : []),
      retainedBlockers: artifactContext.blockers,
      immuneSummary: s.financeImmune ? { immuneState: s.financeImmune.immuneState, severity: s.financeImmune.severity, antigenCount: (s.financeImmune.antigens || []).length, quarantines: s.financeImmune.quarantines, blockedFromTraversal: s.financeImmune.blockedFromTraversal, allowedWithWarning: s.financeImmune.allowedWithWarning } : null,
      awarenessSummary: s.financeAwareness ? { selfNarrative: s.financeAwareness.selfNarrative, knowns: (s.financeAwareness.knowns || []).length, uncertainties: (s.financeAwareness.uncertainties || []).length } : null,
      conscienceDecision: s.financeConscience ? { conscienceState: s.financeConscience.conscienceState, blockedClaims: s.financeConscience.blockedClaims, artifactReadinessDecision: s.financeConscience.artifactReadinessDecision } : null,
      intuitionSummary: s.financeIntuition ? s.financeIntuition.hunches : null,
      scenarioSummary: s.financeSimulation ? (s.financeSimulation.scenarios || []).map(function (x) { return { type: x.type, hypothetical: x.hypothetical, risk: x.risk }; }) : null,
      executiveReport: s.financeExecutiveReport || null,
      l1DepthSummary: portalContext.l1Depth ? { realCompanyTickers: (portalContext.l1Depth.realCompanyTickers || []).length, realTreatments: portalContext.l1Depth.realTreatments, madLibTreatments: portalContext.l1Depth.madLibTreatments, admitted: portalContext.l1Depth.admitted } : null,
      authoringIntake: treatmentContext.authoringIntake.length ? treatmentContext.authoringIntake : null,
      // CREDIT/LIQUIDITY — sub-portal layer (real-content, SEPARATE from the validated spine, no bundle yet)
      financeSummary: s.creditSublayer && s.creditSublayer.loaded ? { count: s.creditSublayer.count, activeCount: s.creditSublayer.activeCount, diagnoses: s.creditSublayer.diagnoses, note: s.creditSublayer.note } : null
    };

    return {
      schemaVersion: FINANCE_DDP_SCHEMA_VERSION,
      promptView: promptView,
      identity: identity,
      brainState: brainState,
      portalContext: portalContext,
      evidence: evidence,
      treatmentContext: treatmentContext,
      operatorContext: operatorContext,
      artifactContext: artifactContext,
      audit: {
        generatedAt: (fm.updated || null),
        schemaVersion: FINANCE_DDP_SCHEMA_VERSION,
        fieldCompleteness: { sections: comp, overallPct: pct },
        missingFields: missingFields,
        warnings: warnings,
        proofTier: proofTier,
        immune: s.financeImmune || null,
        awareness: s.financeAwareness || null,
        conscience: s.financeConscience || null,
        intuition: s.financeIntuition || null,
        simulation: s.financeSimulation || null,
        executiveReport: s.financeExecutiveReport || null
      }
    };
  };

  // ══════════════════════════════════════════════════════════════════════
  // INSTANTIATE AND REGISTER
  // ══════════════════════════════════════════════════════════════════════

  var brain = new FinanceBrain();
  brain.init();
  brain.start();

  window.LIMENFinanceBrain = brain;
  window.LIMENDomainBrains.register(brain);

  // ══════════════════════════════════════════════════════════════════════
  // AUTO-LOAD FINANCE OPERATOR STACK ON DOMAIN-CONSOLE
  // ══════════════════════════════════════════════════════════════════════

  var _isDomainConsole = window.location.pathname.indexOf('domain-console') !== -1;
  var _isFinanceDomain = (new URLSearchParams(window.location.search)).get('domain') === 'finance';
  if (_isDomainConsole && _isFinanceDomain) {
    window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION = true;

    var _financeScripts = [
      'assets/js/finance-compensation.js',
      'assets/js/finance-claim-ledger.js',
      'assets/js/finance-claim-flow.js',
      'assets/js/finance-opportunity-economics.js',
      'assets/js/finance-pulse-engine.js',
      'assets/js/finance-operator-panel.js',
      'assets/js/finance-node-business-engine.js',
      'assets/js/finance-business-review.js',
      'assets/js/finance-execution-panels.js',
      'assets/js/finance-business-build.js',
      // C6 pilot: shared taxonomy engines + finance data load BEFORE the 4 thin shims below
      'assets/js/domain-taxonomy/shared-directive-ranker.js',
      'assets/js/domain-taxonomy/shared-targeting-engine.js',
      'assets/js/domain-taxonomy/shared-directive-translator.js',
      'assets/js/domain-taxonomy/shared-promotion-bridge.js',
      'assets/js/domain-taxonomy/finance-taxonomy-data.js',
      'assets/js/finance-directive-extractor.js',
      'assets/js/finance-directive-ranker.js',
      'assets/js/finance-directive-translator.js',
      'assets/js/finance-targeting-engine.js',
      'assets/js/finance-promotion-bridge.js',
      'assets/js/finance-clarity-operator.js'
    ];
    (function loadNext(i) {
      if (i >= _financeScripts.length) return;
      var s = document.createElement('script');
      s.src = _financeScripts[i];
      s.onload = function () { loadNext(i + 1); };
      s.onerror = function () { console.warn('[FinanceBrain] Failed to load ' + _financeScripts[i]); loadNext(i + 1); };
      document.head.appendChild(s);
    })(0);
  }

})();
