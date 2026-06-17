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

      // Risk monitoring platform
      add({
        title: dxLabel + ' — risk monitoring and early warning platform',
        rank: stress * dx.relevance,
        path: 'PATENTABLE',
        urgency: stress > 0.70 ? 'high' : 'medium',
        source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
      });

      // Regulatory compliance infrastructure
      if (stress >= 0.50) {
        add({
          title: dxLabel + ' — regulatory compliance and stress testing infrastructure',
          rank: stress * dx.relevance * 0.9,
          path: 'GRANT-ELIGIBLE',
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
        path: 'PATENTABLE',
        urgency: 'medium',
        source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
      });
    }

    // Terminal companies
    var terminalCompanies = companies.filter(function (c) { return c.phase === 'p7a' || c.phase === 'p9'; });
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

    // Stressed but operating institutions
    var stressedCompanies = companies.filter(function (c) { return c.phase === 'p3' || c.phase === 'p5'; });
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
          path: 'GRANT-ELIGIBLE',
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
        path: 'GRANT-ELIGIBLE',
        urgency: stress > 0.70 ? 'medium' : 'watching',
        source: 'lagging', tier: 3,
        diagnosisId: 'regulatory_response', stress: stress
      });

      add({
        title: 'Alternative finance acceleration — DeFi, private credit, and digital assets',
        rank: stress * 0.70,
        path: 'PATENTABLE',
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
          path: 'PATENTABLE',
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
    var _COMP = {
      'GRANT-ELIGIBLE': { type: 'grant',  base: 10, unit: '%',        tier: 1, nextTier: { tier: 2, comp: 15, requirement: '3 successful grant awards' },     maxTier: { tier: 3, comp: 25 } },
      'INVESTABLE':     { type: 'invest', base: 5,  unit: 'profit%',  tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
      'PATENTABLE':     { type: 'patent', base: 10, unit: 'royalty%', tier: 1, nextTier: { tier: 2, comp: 15, requirement: '3 patents filed' },                maxTier: { tier: 3, comp: 25 } }
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
        else if (o.path === 'GRANT-ELIGIBLE' && pb.realWorld && pb.realWorld.apply) target = pb.realWorld.apply;
        else if (o.path === 'PATENTABLE' && pb.realWorld && pb.realWorld.build) target = pb.realWorld.build;
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
      }
    });
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
