/**
 * economy-brain.js — Economy Domain Cognitive Engine
 *
 * Extends DomainBrainBase. Same architecture as energy/finance/trade/law brains.
 *
 * Diagnosis matching: maps live signal conditions to economy portal issues
 *   RECESSION → demand contraction, GDP decline, broad slowdown
 *   HYPERINFLATION → sticky CPI, services inflation, price rigidity
 *   BANKING_CRISIS → credit tightening, lending pullback, capital access
 *   TRADE_WAR → tariff impact, import/export disruption
 *   DEBT_CRISIS → sovereign debt, fiscal deficit, debt service burden
 *   MARKET_CRASH → asset collapse, wealth effect, portfolio destruction
 *
 * Cross-domain emissions:
 *   economy → finance (credit conditions / risk appetite)
 *   economy → supplyChain (demand / throughput / inventory)
 *   economy → energy (demand-side consumption shifts)
 *   economy → governance (regulatory / labor policy pressure)
 *
 * Exposes: window.LIMENEconomyBrain
 */
(function () {
  'use strict';

  // Null-safe numeric formatter. Preserves null/undefined/NaN as "n/a"
  // in signal text instead of crashing on .toFixed or fabricating zeros.
  function fmtNumber(value, decimals, fallback) {
    if (value == null) return fallback || 'n/a';
    var n = Number(value);
    return Number.isFinite(n) ? n.toFixed(decimals) : (fallback || 'n/a');
  }

  if (!window.LIMENDomainBrainBase) {
    console.warn('[EconomyBrain] DomainBrainBase not loaded');
    return;
  }

  var Base = window.LIMENDomainBrainBase;

  function EconomyBrain() {
    Base.call(this, { groundedOnly: true,   // circularity cut 2026-07-24
      
      domainId: 'economy',
      label: 'Economy',
      snapshotKey: 'economy',
      cycleInterval: 30000
    });
    this.resourceAuthority = { ownerDomain: 'economy', policyId: 'economy-resource/1', sandboxLane: 'investments', lanes: ['research', 'investment-advisory'], budgets: { computeUnitsPerCycle: 512, queueCapacity: 64 }, switches: { internalCycle: true, internalEmission: true, externalAction: false, spend: false, capital: false } };
    this.motorAuthority = { ownerDomain: 'economy', contractId: 'economy-motor/1', lane: 'investments', decisionContract: 'capital-decision/1', budgetId: 'economy-investment-budget/1', receiptClass: 'position-command-receipt', outcomeClass: 'independent-market-resolution', rollbackClass: 'cancel-or-close', executorVerified: false, outcomeObserverVerified: false, switches: { prepare: true, simulate: true, external: false } };
  }

  EconomyBrain.prototype = Object.create(Base.prototype);
  EconomyBrain.prototype.constructor = EconomyBrain;

  // ══════════════════════════════════════════════════════════════════════
  // INIT — register diagnosis index and emission rules
  // ══════════════════════════════════════════════════════════════════════

  EconomyBrain.prototype.init = function () {
    Base.prototype.init.call(this);

    // ── One-shot cognition loaders (mirror energy/infrastructure/culture/finance init): real entities,
    //    validated distress signals, real source bundles, L1 mad-lib scan, macro-regime/business-cycle sub-portal.
    //    STRICTLY ADDITIVE — never touches the validated scoreStress / deriveDiagnoses spine. ──
    try { this._loadEconomyCommandBoardCompanies(); } catch (e) {}  // real entities (state.companies starved)
    try { this._loadEconomyBrainSignals(); } catch (e) {}           // distress ONLY from the validated Thing pipeline
    try { this._loadEconomyDiagnosisBundles(); } catch (e) {}       // load real artifact-source bundles (only ones that exist)
    try { this._loadEconomyL1PortalDepth(); } catch (e) {}          // scan L1 branches (treatments mad-lib -> NOT admitted; real tickers only)
    try { this._loadMacroRegimeSublayer(); } catch (e) {}           // BUSINESS-CYCLE: load macro-regime sub-portal (real-content, unbundled) as an additive LAYER

    // ── ACTUATION GATE (2026-07-13) — port of Energy's actuated core to economy. ──────────────────
    // VALIDITY GATE (per-actuation honesty; advisory-where-invalid is the correct answer):
    //  refractory : FALSE. Economy has NO autonomous-emission stream and NO refractory-limiter module
    //               (Energy uses limen-refractory-limiter.js + a live emission queue). There is nothing
    //               that re-fires and needs an absolute/relative dead-time. Setting it true would
    //               fabricate an effector. Left OFF (advisory / not-applicable).
    //  servo      : TRUE. Real sensor->controller->effector loop. SENSOR = excitatory drive
    //               (stress + live-condition count + active-diagnosis count) vs the recurrent model's
    //               inhibition term (economyModel.regulation.inhibition). CONTROLLER = PI (fast
    //               proportional + bounded slow integral). EFFECTOR = proportional dampening of the
    //               opportunity/emission CONFIDENCE channel — the same output channel Energy's servo
    //               drives (Energy's autonomous emission is financially gated OFF today, so its servo
    //               also only modulates opportunity confidence + held flags; economy is at parity).
    //  eiBrake    : TRUE. Neuro Ref XIII.1 (inhibition scales with drive). A real HALT/dampen
    //               stop-circuit reading economy's own governor layers (immune / regulation / PE spike /
    //               conscience) PLUS the servo's proportional E/I arm; effector = it dampens the
    //               confidence of surfaced opportunities and marks them held (one-cycle lag, like
    //               Energy's _applyEmissionBrake). This is the controllable output the gate requires.
    //  phase      : TRUE, but gated for honesty. The phase-coherence ROUTER (patent §3.4 Loop-1 matrix)
    //               is deterministic advisory coupling. The phase-transition signal is SELF-CONSISTENCY
    //               calibration (interpretive), NEVER external reward: economy is the MACRO AGGREGATE and
    //               is NOT externalRewardEligible, so its externalOutcome is always null. A P3/P7-family
    //               transition only gates the phase-consistency TIER of the central K4 gate
    //               (window.LIMENK4.credit); every other transition is advisory and never fabricates a
    //               validated/ground-truth learning signal. A validated+resolved transition preempts the
    //               recurrent stress-self-prediction as the K4 credit SOURCE (self-consistency
    //               preemption, mirrors Energy's routing through the same central gate).
    // Fully reversible: flip any flag to false and the deterministic base pipeline is unchanged.
    // COST-SAFE: every method below is 100% deterministic arithmetic/graph analysis — NO fetch-to-LLM,
    // NO paid-AI, ever runs on the 30s cycle.
    this._actuation = { overlays: true, refractory: true, servo: true, eiBrake: true, phase: true };

    // ── THING2 RECURSIVE-PHASE KERNEL as the phase source (2026-07-13, operator-approved) ──
    // The phase-coherence router and phase-transition consistency signal previously read s.phase (a naive
    // per-cycle guess / static PHASE_M lineage). We now feed those from the REAL Thing2 kernel
    // (assets/js/limen-thing2-adapter.js -> window.LIMENThing2.phaseOfSeries), which runs the
    // validated financial phase pipeline over this domain's own STRESS trajectory. The kernel is
    // PURE MATH (no network, no AI) so the 30s cycle stays deterministic. Output is INTERPRETIVE
    // posture only (interpretive:true, validated:false); we never surface it as validated.
    // Fallback: if the adapter is absent or history < 8, _kernelPhase stays null and s.phase is used.
    this._kernelPhase = null;
    this._phaseSeries = [];
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        var _ps = JSON.parse(localStorage.getItem('limen:phaseseries:economy'));
        if (Array.isArray(_ps)) this._phaseSeries = _ps;
      }
    } catch (e) { this._phaseSeries = this._phaseSeries || []; }

    // Keys MUST match portal issue IDs in economy.json
    this.diagnosisIndex = {
      'RECESSION':        ['demand_contraction', 'gdp_decline', 'consumer_slowdown', 'retail_weakness', 'broad_slowdown', 'economy_high_stress', 'structural_stress'],
      'HYPERINFLATION':   ['sticky_cpi', 'services_inflation', 'rent_pressure', 'input_cost_persistence', 'price_rigidity', 'economy_high_stress'],
      'BANKING_CRISIS': ['credit_tightening', 'lending_pullback', 'credit_spread_pressure', 'loan_demand_weakness', 'capital_access_reduced'],
      'TRADE_WAR':     ['tariff_impact', 'import_disruption', 'export_restriction', 'trade_friction', 'macro_shock'],
      'DEBT_CRISIS':      ['sovereign_debt_stress', 'fiscal_deficit', 'debt_service_burden', 'downgrade_risk', 'macro_shock'],
      'MARKET_CRASH': ['asset_collapse', 'wealth_destruction', 'portfolio_loss', 'economy_high_stress', 'macro_shock']
    };

    // Cross-domain emissions — GATED: require at least 1 active diagnosis
    this.emissionRules = [
      {
        targetDomain: 'finance',
        signalType: 'credit_conditions_shift',
        condition: function (s) { return s.stress >= 0.50 && s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.55); }
      },
      {
        targetDomain: 'supplyChain',
        signalType: 'demand_throughput_pressure',
        condition: function (s) { return s.stress >= 0.50 && s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); }
      },
      {
        targetDomain: 'energy',
        signalType: 'demand_consumption_shift',
        condition: function (s) { return s.stress >= 0.55 && s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.4); }
      },
      {
        targetDomain: 'governance',
        signalType: 'policy_response_pressure',
        condition: function (s) { return s.stress >= 0.55 && s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); }
      }
    ];
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 2: Normalize signals into economy-native semantics
  // ══════════════════════════════════════════════════════════════════════

  EconomyBrain.prototype.normalizeSignals = function () {
    var signals = [];
    var rawSignals = (this._rawDomain && this._rawDomain.signals) || [];
    for (var i = 0; i < rawSignals.length; i++) signals.push(rawSignals[i]);

    this._activeConditions = [];

    var feeds = this.state.feeds;
    for (var fi = 0; fi < feeds.length; fi++) {
      var f = feeds[fi];
      var fn = (f.name || '').toLowerCase();
      // GDP / output indicators
      if ((fn.indexOf('gdp') !== -1 || fn.indexOf('output') !== -1) && f.value !== undefined && f.value < 0) {
        this._activeConditions.push('gdp_decline');
        this._activeConditions.push('demand_contraction');
        signals.push('ALERT: GDP contraction detected — recession risk elevated');
      }
      // CPI / inflation — month-over-month change
      if ((fn.indexOf('cpi') !== -1 || fn.indexOf('pce') !== -1 || fn.indexOf('inflation') !== -1) && f.value !== undefined) {
        // Any positive CPI = inflation present (economy always monitors this)
        if (f.value > 0) {
          this._activeConditions.push('input_cost_persistence');
          signals.push('MONITORING: CPI at ' + f.value.toFixed(2) + '% — inflation tracking');
        }
        if (f.value > 0.4) {
          this._activeConditions.push('sticky_cpi');
          signals.push('ELEVATED: CPI above 0.4% m/m — sticky inflation pressure');
        }
        if (f.value > 0.6) {
          this._activeConditions.push('services_inflation');
          this._activeConditions.push('price_rigidity');
          signals.push('CRITICAL: CPI above 0.6% m/m — broad price rigidity');
        }
      }
      // Employment / labor — total nonfarm payrolls
      if ((fn.indexOf('employment') !== -1 || fn.indexOf('labor') !== -1 || fn.indexOf('payroll') !== -1 || fn.indexOf('bls') !== -1) && f.value !== undefined) {
        this._activeConditions.push('labor_market_active');
        signals.push('MONITORING: Employment at ' + (f.value == null ? 'n/a' : fmtNumber(f.value / 1000, 0)) + 'K');
      }
      // Unemployment / jobless
      if ((fn.indexOf('unemployment') !== -1 || fn.indexOf('jobless') !== -1) && f.value !== undefined && f.value > 5) {
        this._activeConditions.push('rising_unemployment');
        this._activeConditions.push('consumer_slowdown');
        signals.push('ELEVATED: Unemployment above 5% — labor market strain');
      }
      // Retail / consumer
      if ((fn.indexOf('retail') !== -1 || fn.indexOf('consumer') !== -1) && f.value !== undefined && f.value < -2) {
        this._activeConditions.push('retail_weakness');
        this._activeConditions.push('demand_contraction');
      }
      // Credit / lending
      if ((fn.indexOf('credit') !== -1 || fn.indexOf('lending') !== -1) && f.value !== undefined && f.value < -5) {
        this._activeConditions.push('lending_pullback');
        this._activeConditions.push('credit_tightening');
      }
      // Gas price — direct consumer cost pressure
      if ((fn.indexOf('gas') !== -1 || fn.indexOf('gasoline') !== -1 || fn.indexOf('fuel') !== -1) && f.value !== undefined) {
        if (f.value > 3.00) {
          this._activeConditions.push('input_cost_persistence');
          this._activeConditions.push('consumer_slowdown');
          signals.push('ELEVATED: Gas at $' + f.value.toFixed(2) + '/gal — consumer cost pressure');
        }
        if (f.value > 4.00) {
          this._activeConditions.push('demand_contraction');
          signals.push('CRITICAL: Gas above $4.00 — demand destruction risk');
        }
      }
      // Food CPI — food cost pressure
      if ((fn.indexOf('food') !== -1) && f.value !== undefined) {
        if (f.value > 0.2 || f.value < -0.2) {
          this._activeConditions.push('input_cost_persistence');
          signals.push('ELEVATED: Food prices moving ' + (f.value >= 0 ? '+' : '') + f.value.toFixed(2) + '%');
        }
        if (f.value > 0.5) {
          this._activeConditions.push('sticky_cpi');
          this._activeConditions.push('price_rigidity');
          signals.push('CRITICAL: Food inflation above 0.5% — price rigidity');
        }
      }
      // Consumer sentiment — demand/confidence indicator
      if ((fn.indexOf('sentiment') !== -1 || fn.indexOf('consumer confidence') !== -1) && f.value !== undefined) {
        this._activeConditions.push('consumer_sentiment_active');
        if (f.value < 70) {
          this._activeConditions.push('consumer_slowdown');
          this._activeConditions.push('demand_contraction');
          signals.push('ELEVATED: Consumer sentiment at ' + fmtNumber(f.value, 1) + ' — weak demand');
        }
        if (f.value < 55) {
          this._activeConditions.push('retail_weakness');
          signals.push('CRITICAL: Consumer sentiment at ' + fmtNumber(f.value, 1) + ' — recession-level pessimism');
        }
      }
    }

    // Defense/geopolitical signals — with TTL validation
    var snap = this._getSnapshot();
    var EVENT_TTL = 30 * 60 * 1000;
    if (snap && snap.defenseSignals) {
      var now = Date.now();
      for (var si = 0; si < snap.defenseSignals.length; si++) {
        var sig = snap.defenseSignals[si];
        if (sig.affectedDomains && sig.affectedDomains.indexOf('economy') !== -1) {
          // `timestamp` is NOT a per-signal field. handlers/defense-signals.js:152-163 builds each
          // signal with { eventType, articleCount, confidence, confidenceValue, magnitude,
          // affectedDomains, titles, earliest, latest, clusterSpanMinutes }. `timestamp` exists only
          // on the response ENVELOPE (:274), and limen-worker-snapshot.js:128 copies signals verbatim.
          // So sig.timestamp was always undefined -> sigAge Infinity -> sigFresh false -> the whole
          // event branch took the EXPIRED path on every tick, in all 6 brains that have it. `latest`
          // is the real recency: cluster.latest = max(article.pubDate) (defense-signals.js:130,138).
          var _sigT = sig.timestamp || sig.latest;
          var sigAge = _sigT ? (now - new Date(_sigT).getTime()) : Infinity;
          if (sigAge <= EVENT_TTL) {
            this._activeConditions.push(sig.eventType);
            if (sig.eventType === 'SANCTIONS' || sig.eventType === 'TRADE_RESTRICTION') {
              this._activeConditions.push('tariff_impact');
              this._activeConditions.push('trade_friction');
            }
          }
        }
      }
    }

    if (snap && snap.macroShock && snap.macroShock.detected) {
      this._activeConditions.push('macro_shock');
    }

    // Stress-derived flags — _stress_ prefix prevents them from satisfying evidence families
    if (this.state.stress >= 0.40) {
      this._activeConditions.push('_stress_demand_flag');
      this._activeConditions.push('_stress_consumer_flag');
    }
    if (this.state.stress >= 0.50) {
      this._activeConditions.push('_stress_slowdown_flag');
      this._activeConditions.push('_stress_credit_flag');
    }
    // ── CIRCULARITY CUT (2026-07-24) — no condition may be manufactured from this
    //    domain's own stress scalar. normalizeSignals runs BEFORE scoreStress, so these
    //    gates read the PREVIOUS cycle's stress: the resulting "active diagnosis" restated
    //    one number instead of adding evidence, and because emissions are gated on an
    //    active diagnosis and peers fold received pressure back into stress, it closed a
    //    feedback ring carrying no new information. Reground to a real feed to restore a
    //    condition; never re-derive one from stress.
    //    SURVIVES on real feeds/events : 0: the 5 _stress_* reporting flags above are KEPT — inert by prefix, and honest
    //    REMOVED, no other source in this file : 2: economy_high_stress, structural_stress
    if (this.state.stress >= 0.75) {
      this._activeConditions.push('_stress_capital_flag');
    }

    var extPressure = this.getExternalPressure ? this.getExternalPressure() : 0;
    if (extPressure >= 0.10) {
      this._activeConditions.push('broad_slowdown');
    }
    if (extPressure >= 0.20) {
      this._activeConditions.push('tariff_impact');
    }

    this.state.signals = signals;
    return Promise.resolve();
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 4: Derive diagnoses — condition-matched from portal
  // ══════════════════════════════════════════════════════════════════════

  EconomyBrain.prototype.deriveDiagnoses = function () {
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

  EconomyBrain.prototype.recommendTreatments = function () {
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

      var treatments = [];
      var activations = portal.activations || [];
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

      var evidenceRank = { A: 10, 'Strong': 10, B: 7, 'Moderate': 7, C: 4, 'Emerging': 1 };
      treatments.sort(function (a, b) { return (evidenceRank[b.evidence] || 0) - (evidenceRank[a.evidence] || 0); });
      self.state.treatments = treatments;
    });
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 6: Surface opportunities with capital classification
  // ══════════════════════════════════════════════════════════════════════

  EconomyBrain.prototype.surfaceOpportunities = function () {
    Base.prototype.surfaceOpportunities.call(this);

    // Cognition parity: if the snapshot didn't supply companies, fall back to real
    // command-board economy entities so opportunities are real, not scaffold. Guarded.
    if ((!this.state.companies || !this.state.companies.length) && this._cbEconomyCompanies && this._cbEconomyCompanies.length) {
      this.state.companies = this._cbEconomyCompanies;
    }

    var opps = [], stress = this.state.stress;
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; });
    var allDx = this.state.diagnoses || [];
    var companies = this.state.companies;
    var seen = {};

    function add(o) {
      var key = o.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seen[key]) return; seen[key] = true; opps.push(o);
    }

    // ═══ TIER 1 — DIRECT ═══
    for (var di = 0; di < activeDx.length; di++) {
      var dx = activeDx[di];
      var dxLabel = (dx.label || dx.id || '').replace(/_/g, ' ');

      add({ title: dxLabel + ' — countercyclical positioning and demand rotation', rank: stress * dx.relevance, path: 'INVESTABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });

      if (stress >= 0.50) {
        add({ title: dxLabel + ' — labor and productivity platform demand', rank: stress * dx.relevance * 0.9, path: 'RESEARCHABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      }

      if (stress >= 0.55 && dx.relevance >= 0.2) {
        add({ title: dxLabel + ' — inflation defense and margin protection', rank: stress * 0.85, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      }

      add({ title: dxLabel + ' — essential-goods resilience and consumer staples rotation', rank: stress * dx.relevance * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
    }

    // Company-driven — distress comes ONLY from the validated Thing pipeline (_pubSignals),
    // NEVER from the raw command-board phase (noise). _pubSignals is {} until per-company
    // scoring is validated, so these stay silent rather than fabricate.
    var pub = this._pubSignals || {};
    var terminalCompanies = (companies || []).filter(function (c) { var sg = pub[c.ticker]; return sg && sg.band === 'elevated'; });
    if (terminalCompanies.length > 0) {
      add({ title: 'Economy terminal entity distressed positioning', rank: 0.95, path: 'INVESTABLE', urgency: 'high', source: 'company_terminal', tier: 1, companies: terminalCompanies.map(function (c) { return c.ticker; }), stress: stress });
    }

    var stressedCompanies = (companies || []).filter(function (c) { var sg = pub[c.ticker]; return sg && sg.band === 'moderate'; });
    if (stressedCompanies.length >= 2 && stress >= 0.50) {
      add({ title: 'Economy stressed-but-operating entity selection', rank: stress * 0.80, path: 'INVESTABLE', urgency: 'medium', source: 'company_stressed', tier: 1, companies: stressedCompanies.slice(0, 5).map(function (c) { return c.ticker; }), stress: stress });
    }

    if (this.state.convergence && this.state.convergence.primary_signal) {
      add({ title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — economy convergence response', rank: 0.98, path: 'INVESTABLE', urgency: 'high', source: 'convergence', tier: 1, signal: this.state.convergence.primary_signal, stress: stress });
    }

    // ═══ TIER 2 — CROSS-DOMAIN ═══
    var emissions = this.state.crossDomainEmissions || [];
    for (var ei = 0; ei < emissions.length; ei++) {
      var em = emissions[ei];
      var targetLabel = (em.targetDomain || '').replace(/_/g, ' ');
      var sigLabel = (em.signal || em.signalType || '').replace(/_/g, ' ');
      add({ title: 'Economy \u2192 ' + targetLabel + ' transmission — ' + sigLabel + ' response', rank: (em.magnitude || 0.5) * stress * 0.8, path: 'INVESTABLE', urgency: em.magnitude > 0.6 ? 'high' : 'medium', source: 'cross_domain', tier: 2, diagnosisId: 'economy_emission_' + em.targetDomain, stress: stress });
    }

    // ═══ TIER 3 — LAGGING ═══
    if (stress >= 0.50) {
      add({ title: 'Recession preparation — defensive sector rotation', rank: stress * 0.65, path: 'INVESTABLE', urgency: stress > 0.70 ? 'medium' : 'watching', source: 'lagging', tier: 3, diagnosisId: 'recession_prep', stress: stress });
      add({ title: 'Credit liquidity repositioning — alternative capital channels', rank: stress * 0.70, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'credit_reposition', stress: stress });
    }
    if (stress >= 0.60) {
      add({ title: 'Consumer demand infrastructure — essential goods distribution', rank: stress * 0.75, path: 'INVESTABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'lagging', tier: 3, diagnosisId: 'consumer_infra', stress: stress });
      add({ title: 'Macro bottleneck positioning — structural economic gaps', rank: stress * 0.72, path: 'RESEARCHABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'macro_bottleneck', stress: stress });
      add({ title: 'Workforce redeployment — retraining and labor mobility platforms', rank: stress * 0.68, path: 'INVESTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'workforce_redeploy', stress: stress });
    }

    // Near-diagnosis
    var nearDx = allDx.filter(function (d) { return !d.active && d.relevance > 0 && d.totalTriggers > 0; });
    for (var ndi = 0; ndi < nearDx.length; ndi++) {
      var nd = nearDx[ndi];
      if (stress >= 0.45) {
        add({ title: (nd.label || nd.id || '').replace(/_/g, ' ') + ' — early-stage monitoring position', rank: stress * (nd.relevance || 0.1) * 0.5, path: 'RESEARCHABLE', urgency: 'watching', source: 'near_diagnosis', tier: 2, diagnosisId: nd.id, stress: stress });
      }
    }

    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });
    // Canonical enrichment — merge economy playbook detail per opportunity
    var PB_LIST = window.LIMENEconomyOpportunityPlaybooks || [];
    var _byId = {};
    for (var _pbi = 0; _pbi < PB_LIST.length; _pbi++) _byId[PB_LIST[_pbi].id] = PB_LIST[_pbi];
    var _PB_MAP = {
      'RECESSION': 'recession',
      'HYPERINFLATION': 'hyperinflation',
      'BANKING_CRISIS': 'banking_crisis_econ',
      'TRADE_WAR': 'trade_war_econ',
      'DEBT_CRISIS': 'debt_crisis',
      'MARKET_CRASH': 'market_crash_econ'
    };
    var _LAGGING_MAP = {
      'consumer_infra': 'recession',
      'credit_reposition': 'banking_crisis_econ',
      'macro_bottleneck': 'trade_war_econ',
      'recession_prep': 'recession',
      'workforce_redeploy': 'recession'
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
      o.domain = 'economy';
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
        var evidenceParts = ['Domain: economy', 'Stress: ' + stressPct + '%'];
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
    // E/I BRAKE EFFECTOR (one-cycle lag): apply the PRIOR cycle's stop-circuit to this cycle's
    // opportunities — halt => hold + zero confidence; dampen/E-I => proportional confidence penalty.
    // This is the controllable output the servo/eiBrake actuations drive. Reversible (flag-gated in
    // _computeEconomyBrake). Never touches diagnoses/stress.
    try { opps = this._applyEconomyEmissionBrake(opps); } catch (e) {}

    this.state.opportunityCount = opps.length;

    this.state.opportunities = opps;
    return Promise.resolve();
  };

  // ══════════════════════════════════════════════════════════════════════
  // ACTION PIPELINE
  // ══════════════════════════════════════════════════════════════════════

  EconomyBrain.prototype._checkDiagnosisActions = function () {
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; });
    if (activeDx.length === 0) return;
    var adapters = window.LIMENActionAdapters;
    if (!adapters) return;

    for (var i = 0; i < activeDx.length; i++) {
      var dx = activeDx[i];
      var existingDrafts = adapters.getDrafts({ domain: 'economy', intentId: dx.id });
      if (existingDrafts && existingDrafts.length > 0) continue;
      adapters.createDraft('REPORT_GENERATION', {
        domain: 'economy', sourceType: 'domain_brain', sourceId: dx.id, intentId: dx.id,
        title: 'Economy Alert: ' + dx.label,
        intent: { domain: 'economy', title: dx.label, status: 'ACTIVE', priority: this.state.stress, progress: 0, strategyType: 'diagnosis_response',
          steps: [
            { type: 'ANALYZE', label: 'Assess ' + dx.label + ' impact on macro economy', status: 'PENDING' },
            { type: 'INVESTIGATE', label: 'Identify affected sectors, companies, and labor markets', status: 'PENDING' },
            { type: 'POSITION', label: 'Evaluate countercyclical opportunities from ' + dx.label, status: 'PENDING' }
          ]
        }
      });
    }
  };

  EconomyBrain.prototype.resolveDeepContent = function () {
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
            deepTreats.push({ id: 'deep_' + t.nodeId + '_' + i, label: t.label, type: t.type, evidence: t.evidence, description: t.description, cite: t.cite, steps: t.steps, monitoring: t.monitoring, escalation: t.escalation, diagnosisId: dxId, nodeId: t.nodeId, nodeLabel: t.nodeLabel, hasDepth: t.hasDepth, source: 'canonical_deep' });
          }
        }
        if (deepTreats.length > 0) self.state.treatments = deepTreats;
      }
    }).catch(function () {});
  };

  var _origCycle = EconomyBrain.prototype.cycle;
  EconomyBrain.prototype.cycle = function () {
    var self = this;
    return _origCycle.call(this).then(function () {
      return self.resolveDeepContent();
    }).then(function () {
      var pulse = window.LIMENEconomyPulse;
      if (pulse && typeof pulse.computePulse === 'function') {
        self.state._activeConditions = self._activeConditions || [];
        var pulseState = pulse.computePulse(self.state);
        self.state.pulse = pulseState;
        // Neuro-substrate telemetry (advisory): map live pulse -> runtime overlay via generic adapter.
        try {
          if (window.DomainTelemetryAdapter && typeof window.DomainTelemetryAdapter.fromLiveCached === "function") {
            window.DomainTelemetryAdapter.fromLiveCached("economy", self.state, self._runtimeOverlay || null)
              .then(function (ov) { if (ov) self._runtimeOverlay = ov; }).catch(function () {});
          }
        } catch (_e) {}
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
      // COGNITION PORT — recurrent loop step. Runs AFTER the validated pipeline + pulse
      // validation settle, reads the prior produced by the PREVIOUS cycle, computes prediction
      // error, regulates, and updates the next prior. STRICTLY ADDITIVE + try/caught: it reads
      // state.stress / state.diagnoses but NEVER mutates the validated scoreStress / deriveDiagnoses
      // spine or any diagnosis active flag. Never breaks a cycle.
      try { self._updateEconomyModel(); } catch (e) {}
      try { self._computeEconomyOverlays(); } catch (e) {}   // NEURO-SUBSTRATE OVERLAY WIRING (per-domain, ported from energy 2026-07-21): invokes economy's OWN overlay modules each cycle; shadow, proposals only
    });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // NEURO-SUBSTRATE OVERLAY WIRING — per-domain copy of energy's _computeEnergyOverlays
  // (2026-07-21, full per-domain independence). Invokes economy's OWN modules
  // (window.Economy{Metaplasticity,Extinction,RetrogradeThrottle,PredictionErrorCompressor,
  // OfflineMaintenance,NeuroSubstrate,ConnectivityAudit}) against economy's OWN runtime def
  // (economy.json runtime.params + edges/issues/activations). SHADOW: writes state.economyOverlays;
  // the only actuation is metaplasticity -> the refractory dead-time (matches energy exactly).
  // Degrade-safe: returns mode 'off' when the modules are not on the page (they load only on the
  // economy console), 'loading' until economy.json arrives.
  // ════════════════════════════════════════════════════════════════════════════
  EconomyBrain.prototype._loadEconomyDef = function () {
    if (this._economyDef) return this._economyDef;
    if (this._economyDefLoading) return null;
    this._economyDefLoading = true;
    var self = this;
    if (typeof fetch === 'function') {
      try {
        fetch('/assets/data/domains/economy.json').then(function (r) { return r.json(); })
          .then(function (def) { self._economyDef = def; })
          .catch(function () { self._economyDefLoading = false; });
      } catch (e) { this._economyDefLoading = false; }
    }
    return null;
  };

  EconomyBrain.prototype._computeEconomyOverlays = function () {
    var s = this.state;
    function mod(glob, reqPath) {
      if (typeof window !== 'undefined' && window[glob]) return window[glob];
      if (typeof module !== 'undefined') { try { return require(reqPath); } catch (e) {} }
      return null;
    }
    var META = mod('EconomyMetaplasticity', '../economy-metaplasticity.js');
    var EXT = mod('EconomyExtinction', '../economy-extinction.js');
    var RETRO = mod('EconomyRetrogradeThrottle', '../economy-retrograde-throttle.js');
    var PEC = mod('EconomyPredictionErrorCompressor', '../economy-prediction-error-compressor.js');
    var OFF = mod('EconomyOfflineMaintenance', '../economy-offline-maintenance.js');
    var NS = mod('EconomyNeuroSubstrate', '../economy-neuro-substrate.js');
    var CONN = mod('EconomyConnectivityAudit', '../economy-connectivity-audit.js');
    if (!(META && EXT && RETRO && PEC && OFF && NS && CONN)) {
      s.economyOverlays = { version: 1, mode: 'off', note: 'overlay modules not loaded on this page (present only on the economy console)' };
      return null;
    }
    var def = this._loadEconomyDef();
    if (!def) { s.economyOverlays = { version: 1, mode: 'loading', note: 'economy.json runtime def loading; overlays compute next cycle' }; return null; }

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

    var intero = s.economyInteroception || (s.cognition && s.cognition.interoception) || {};
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

    s.economyOverlays = {
      version: 1, mode: 'shadow', armed: armed,
      volatility: Math.round(volatility * 1000) / 1000,
      metaplasticity: { changes: meta.changes, adapted: adapted, noop: meta.noop },
      extinction: { candidates: ext.candidates, count: ext.candidates.length, noop: ext.noop, actuation: 'PROPOSAL-ONLY (retiring a node edits economy.json — human-gated forever)' },
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
    s.economyOverlays.mode = armed ? 'armed' : 'shadow';
    s.economyOverlays.applied = applied;
    s.economyOverlays.actuationScope = 'metaplasticity->refractory dead-time ONLY (bounded, fail-toward-quiet, reversible). throttle=no-live-consumer; PE=observe-only; extinction+offline-prune=PROPOSAL-ONLY (remove structure, human-gated forever).';
    s.economyOverlays.note = 'PER-DOMAIN OVERLAY WIRING (ported from energy): economy runs its OWN 6 overlay modules + connectivity recurrenceAudit each cycle on economy.json. ARMED: metaplasticity raises the refractory dead-time with volatility (clamped, reversible). Everything else is proposal/observe-only.';

    if (s.cognition && typeof s.cognition === 'object') s.cognition.overlays = s.economyOverlays;
    return s.economyOverlays;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // COGNITION PORT — ECONOMY RECURRENT LOOP v1 (additive, reversible, energy-class depth)
  // Converts re-running inference into a recurrent loop:
  //   prior → observation → prediction error → bounded update → next prior.
  // Proof surface: window.LIMENEconomyBrain.state.economyModel
  // GUARD: this entire block ONLY READS the validated state (stress, diagnoses, opportunities)
  // and writes NEW keys (economyModel, economy{Immune,Awareness,Conscience,Intuition,Simulation,
  // ExecutiveReport}, brainEconomyModel, macroRegimeSublayer, cognition). It NEVER alters
  // scoreStress, deriveDiagnoses, the locked diagnosis set, or anything consumed by
  // /api/limen/score or /api/helix/helix-report/score. Economy is the MACRO AGGREGATE —
  // DISTINCT from finance (capital markets/credit/banks). Indicators are REAL FRED series +
  // broad-market proxies (SPY/DIA/TLT/GLD); never single-company tickers, never fabricated.
  // ════════════════════════════════════════════════════════════════════════════
  var EM_VERSION = 1;
  var EM_LEARNING_RATE = 0.25;          // bounded plasticity (fast inference)
  var EM_SLOW_RATE = 0.08;              // slow consolidation (reserved for rebuild/cron)
  var EM_STRESS_FLOOR = 0.30;           // below this → no handoff
  var EM_FLOOD_CAP = 12;                // opportunity-flood threshold
  var EM_STALE_MS = 1000 * 60 * 60 * 6; // 6h feed staleness

  // Canonical macroeconomic indicators — REAL FRED series ids + broad-market proxies.
  // Economy binds to the MACRO AGGREGATE, never to single-company tickers.
  var EM_FRED_SERIES = ['GDP', 'GDPC1', 'CPIAUCSL', 'PCEPI', 'UNRATE', 'PAYEMS', 'FEDFUNDS', 'DGS10', 'UMCSENT', 'INDPRO', 'M2SL'];
  var EM_MARKET_PROXIES = ['SPY', 'DIA', 'TLT', 'GLD'];

  function _emClamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function _emJaccardDistance(a, b) {
    a = a || []; b = b || [];
    if (a.length === 0 && b.length === 0) return 0;
    var union = {}, inter = 0, setB = {};
    for (var i = 0; i < b.length; i++) { setB[b[i]] = true; union[b[i]] = true; }
    var seen = {};
    for (var j = 0; j < a.length; j++) { union[a[j]] = true; if (setB[a[j]] && !seen[a[j]]) { inter++; seen[a[j]] = true; } }
    var u = Object.keys(union).length;
    return u === 0 ? 0 : 1 - (inter / u);
  }
  // Pull a numeric value for a named macro series out of state.feeds (null if absent — NEVER fabricate).
  function _emFeedValue(feeds, needles) {
    if (!feeds) return null;
    var arr = Array.isArray(feeds) ? feeds : Object.keys(feeds).map(function (k) { return feeds[k]; });
    for (var i = 0; i < arr.length; i++) {
      var f = arr[i]; if (!f) continue;
      var nm = String(f.name || f.label || f.id || '').toLowerCase();
      for (var n = 0; n < needles.length; n++) {
        if (nm.indexOf(needles[n]) !== -1) {
          var v = (f.value != null) ? Number(f.value) : null;
          return (v != null && isFinite(v)) ? v : null;
        }
      }
    }
    return null;
  }

  // ── Neutral recurrent prior (mirrors _neutralFinanceModel / _neutralEnergyModel) ──
  EconomyBrain.prototype._neutralEconomyModel = function () {
    return {
      version: EM_VERSION, cycle: 0,
      prior: { expectedStress: 0.5, expectedDiagnoses: [], expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, confidence: 0, samples: 0 },
      observation: null, predictionError: null, predictedStress: null,
      plasticity: { learningRate: EM_LEARNING_RATE, slowRate: EM_SLOW_RATE, consolidation: 'cycle-light' },
      regulation: null, readyForHandoff: false, _lowErrorStreak: 0, updated: 0
    };
  };

  // ── Normalized observation of current economy state (NO SCORING; pure read).
  //    Maps explicitly to REAL FRED series + broad-market proxies; fields without live data are null. ──
  EconomyBrain.prototype._buildEconomyObservation = function () {
    var s = this.state || {};
    var active = (s.diagnoses || []).filter(function (d) { return d.active; });
    // signal = breadth of live macroeconomic feeds (FRED series + market proxies)
    var feeds = s.feeds || [], fc = 0, newest = 0;
    if (Array.isArray(feeds)) {
      for (var i = 0; i < feeds.length; i++) { var fv = feeds[i]; if (fv) { fc++; var u = fv.updated; if (u && u > newest) newest = u; } }
    } else { for (var k in feeds) { if (feeds.hasOwnProperty(k)) { fc++; var u2 = feeds[k] && feeds[k].updated; if (u2 && u2 > newest) newest = u2; } } }

    // Which canonical FRED series / market proxies are actually live (real value present) — never fabricated.
    var fredActive = [];
    for (var fi = 0; fi < EM_FRED_SERIES.length; fi++) { var fid = EM_FRED_SERIES[fi]; if (_emFeedValue(feeds, [fid.toLowerCase()]) != null) fredActive.push(fid); }
    var pxActive = [];
    for (var pi = 0; pi < EM_MARKET_PROXIES.length; pi++) { var pid = EM_MARKET_PROXIES[pi]; if (_emFeedValue(feeds, [pid.toLowerCase()]) != null) pxActive.push(pid); }

    // Derived macro reads — null when the underlying series is absent (NEVER fabricated).
    var dgs10 = _emFeedValue(feeds, ['dgs10', '10-year', '10 year', 'treasury']);
    var fedfunds = _emFeedValue(feeds, ['fedfunds', 'fed funds', 'policy rate']);
    var unrate = _emFeedValue(feeds, ['unrate', 'unemployment']);
    var payems = _emFeedValue(feeds, ['payems', 'payroll', 'nonfarm', 'employment']);

    return {
      stress: typeof s.stress === 'number' ? s.stress : 0,
      phase: s.phase || null,
      activeDiagnoses: active.map(function (d) { return d.id; }).sort(),
      diagnosisCount: active.length,
      opportunityCount: (s.opportunities || []).length,
      companyCount: (s.companies || []).length,
      signal: Math.min(1, fc / 8),
      feedNewest: newest,
      // Macro-native, real-source-anchored fields (null when no live data — never fabricated):
      fredSeriesActive: fredActive,
      marketProxiesActive: pxActive,
      gdpGrowth: _emFeedValue(feeds, ['gdpc1', 'gdp', 'output']),
      inflationRate: _emFeedValue(feeds, ['cpiaucsl', 'pcepi', 'cpi', 'pce', 'inflation']),
      employmentTrend: (payems != null ? payems : unrate),
      yieldCurve: (dgs10 != null && fedfunds != null) ? (Math.round((dgs10 - fedfunds) * 100) / 100) : null,
      sentiment: _emFeedValue(feeds, ['umcsent', 'sentiment', 'consumer confidence']),
      policyRate: fedfunds,
      industrialProduction: _emFeedValue(feeds, ['indpro', 'industrial production']),
      moneySupply: _emFeedValue(feeds, ['m2sl', 'm2', 'money supply']),
      timestamp: Date.now()
    };
  };

  // ── Prediction error: prior.expected* vs observation (pure arithmetic; NO evidence scoring) ──
  EconomyBrain.prototype._computeEconomyPredictionError = function (prior, obs) {
    var stressError = Math.abs(obs.stress - prior.expectedStress);
    var signalError = Math.abs(obs.signal - prior.expectedSignal);
    var diagnosisError = _emJaccardDistance(obs.activeDiagnoses, prior.expectedDiagnoses);
    var oppDenom = Math.max(1, prior.expectedOpportunityCount, obs.opportunityCount);
    var opportunityError = Math.abs(obs.opportunityCount - prior.expectedOpportunityCount) / oppDenom;
    var total = _emClamp(0.4 * stressError + 0.2 * signalError + 0.25 * diagnosisError + 0.15 * opportunityError, 0, 1);
    var novelty = Math.max(stressError, diagnosisError);
    return { total: total, stressError: stressError, signalError: signalError, diagnosisError: diagnosisError, opportunityError: opportunityError, novelty: novelty };
  };

  // ── Bounded prior update toward observation (next cycle reads this; domain-agnostic math) ──
  EconomyBrain.prototype._updateEconomyPrior = function (prior, obs, lr) {
    return {
      expectedStress: _emClamp(prior.expectedStress + lr * (obs.stress - prior.expectedStress), 0, 1),
      expectedDiagnoses: obs.activeDiagnoses.slice(),
      expectedDiagnosisCount: prior.expectedDiagnosisCount + lr * (obs.diagnosisCount - prior.expectedDiagnosisCount),
      expectedOpportunityCount: prior.expectedOpportunityCount + lr * (obs.opportunityCount - prior.expectedOpportunityCount),
      expectedSignal: _emClamp(prior.expectedSignal + lr * (obs.signal - prior.expectedSignal), 0, 1),
      confidence: _emClamp(Math.min(1, (prior.samples + 1) / 20), 0, 1),
      samples: prior.samples + 1
    };
  };

  // ── Local regulation: inhibition / gain / homeostatic set-points ──
  EconomyBrain.prototype._computeEconomyRegulation = function (em, obs, pe) {
    var gain = _emClamp(pe.novelty, 0.05, 0.95);
    var inhibition = _emClamp(1 - pe.novelty, 0, 0.9);
    var outputScale = _emClamp(1 - inhibition * 0.5, 0.4, 1);
    var starving = obs.stress >= EM_STRESS_FLOOR && obs.opportunityCount === 0;
    var flooding = obs.opportunityCount > EM_FLOOD_CAP;
    var streak = (pe.total < 0.05) ? (em._lowErrorStreak || 0) + 1 : 0;
    em._lowErrorStreak = streak;
    var looping = streak >= 3;
    var stale = obs.feedNewest > 0 ? (Date.now() - obs.feedNewest) > EM_STALE_MS : false;
    var overconfident = em.prior.confidence > 0.8 && pe.total > 0.4;
    var label = flooding ? 'flooding' : starving ? 'starving' : stale ? 'stale' : looping ? 'looping' : overconfident ? 'overconfident' : pe.novelty > 0.4 ? 'surprised' : 'calm';
    return { gain: gain, inhibition: inhibition, outputScale: outputScale, starving: starving, flooding: flooding, looping: looping, stale: stale, overconfident: overconfident, state: label };
  };

  // ── The recurrent step — END of each cycle. Reads the prior from the PREVIOUS cycle, so
  //    cycle N+1's interpretation (predictedStress, readyForHandoff) depends on cycle N.
  //    NEVER touches the validated stress/diagnosis spine. ──
  EconomyBrain.prototype._updateEconomyModel = function () {
    var em = this.state.economyModel || this._neutralEconomyModel();
    var priorIn = em.prior;                                       // carried from last cycle
    var obs = this._buildEconomyObservation();                    // pure read of validated state
    var pe = this._computeEconomyPredictionError(priorIn, obs);   // prior vs now

    // K5 CLOSED (one-cycle lag) — fold the PRIOR cycle's perception-depth portalError estimate
    // into the recurrent prediction error (weight 0.05), mirroring Energy's K5→_computePredictionError
    // wiring. Deterministic; reads a NEW state key only; never touches the validated stress/diagnosis
    // spine or anything /api/limen/score consumes.
    try {
      var _pd0 = this.state.economyPerceptionDepth;
      if (_pd0 && typeof _pd0.portalErrorEstimate === 'number') {
        pe.portalError = _pd0.portalErrorEstimate;
        pe.total = _emClamp(pe.total * 0.95 + _pd0.portalErrorEstimate * 0.05, 0, 1);
      }
    } catch (e) {}

    // reads prior BEFORE the final decision (Kalman-style blend, NOT raw obs):
    var gainBlend = _emClamp(pe.novelty, 0.05, 0.95);
    var predictedStress = priorIn.expectedStress * (1 - gainBlend) + obs.stress * gainBlend;
    var reg = this._computeEconomyRegulation(em, obs, pe);

    // K8 CLOSED (one-cycle lag) — homeostatic set-point: handoff gates on a 50/50 blend of the fixed
    // floor and the PRIOR cycle's adaptive stress baseline (>=10 samples), bounded to at most +0.15
    // above the fixed floor so a sustained-stress baseline cannot ratchet the gate out of reach.
    // Mirrors Energy's em._effectiveFloor. Falls back to EM_STRESS_FLOOR when unavailable.
    var _hm = this.state.economyHomeostasis;
    var _floor = (_hm && typeof _hm.adaptiveBaseline === 'number' && _hm.samples >= 10)
      ? _emClamp(Math.min(0.5 * EM_STRESS_FLOOR + 0.5 * _hm.adaptiveBaseline, EM_STRESS_FLOOR + 0.15), 0.15, 0.6)
      : EM_STRESS_FLOOR;
    em._effectiveFloor = _floor;

    var readyForHandoff = (em.cycle > 0) && (predictedStress >= _floor) && (obs.diagnosisCount > 0) && !reg.flooding && !reg.stale;

    // K4 CLOSED (one-cycle lag) — credit assignment routed through the central honest reward gate
    // (window.LIMENK4.credit). Economy is the MACRO AGGREGATE and is NOT externalRewardEligible: it has
    // no external realized-outcome label, so externalOutcome is ALWAYS null and its credit is
    // self-consistency calibration only (interpretive), NEVER reward / ground-truth / dopaminergic. The
    // gate enforces the preemption: external-reward(4) > phase-consistency(3) > call-consistency(2) >
    // stress-consistency(1) > none. Inputs the brain already computed feed the gate: the realized stress
    // self-prediction (economyOutcomeModel) and the thing2 realized phase transition (PRIOR
    // economyPhaseDynamics, one-cycle lag). The returned credit scales the effective learning rate
    // (persistent mis-prediction speeds adaptation). Pure math — NO AI/network on the 30s cycle.
    var _om = this.state.economyOutcomeModel;
    var _pt0 = (this.state.economyPhaseDynamics || {}).transition;   // PRIOR cycle's transition (one-cycle lag)
    var _pt0Active = !!(this._actuation && this._actuation.phase && _pt0 && _pt0.hit !== null);
    var _lr = em.plasticity.learningRate;
    // Economy has NO call-resolution (TRUTH BRAKE) ledger — only stress self-prediction — so callHitRate
    // is null and the gate falls through call-consistency to stress-consistency.
    var _sig = {
      externalOutcome: null,                                             // NOT eligible: self-consistency only, never reward
      phaseValidated: !!(_pt0 && _pt0.validated),                        // P3/P7 family gate for phase-consistency tier — self-consistency, NOT external reward
      phaseTransitionHit: _pt0Active ? (_pt0.hit ? 1 : 0) : null,        // thing2 realized transition hit (interpretive)
      callHitRate: null,                                                 // no call-resolution ledger in economy
      callSamples: 0,
      stressSelfPred: (_om && typeof _om.hitRate === 'number' && _om.samples >= 5) ? _om.hitRate : null,
      stressSamples: (_om && typeof _om.samples === 'number') ? _om.samples : 0
    };
    var _k4 = (typeof window !== 'undefined' && window.LIMENK4 && typeof window.LIMENK4.credit === 'function')
      ? window.LIMENK4.credit(_sig) : null;
    var _hit, _creditSource, _isReward;
    if (_k4) {
      _hit = (typeof _k4.credit === 'number') ? _k4.credit : null;
      _creditSource = _k4.creditSource;
      _isReward = !!_k4.isReward;                                        // ALWAYS false for economy (not externalRewardEligible)
    } else {
      // FALLBACK (gate absent) — prior credit behavior preserved, same preemption, in-line.
      var _phaseReward = _pt0Active && !!_pt0.validated;
      _hit = _phaseReward ? (_pt0.hit ? 1 : 0)
        : (_om && typeof _om.hitRate === 'number' && _om.samples >= 5) ? _om.hitRate : null;
      _creditSource = _phaseReward ? 'phase-consistency' : (_hit !== null ? 'stress-consistency' : 'none');
      _isReward = false;                                                 // self-consistency only; never reward
    }
    if (_hit !== null) _lr = _emClamp(_lr * (1 + (1 - _hit)), EM_SLOW_RATE, 0.6);
    em._effectiveLearningRate = _lr;
    em._creditSource = _creditSource;
    em._creditIsReward = _isReward;                                      // honest flag: false unless a real external outcome fed the gate

    var nextPrior = this._updateEconomyPrior(priorIn, obs, _lr);   // → next cycle reads this (K4-scaled learning rate)

    em.cycle += 1;
    em.observation = obs;
    em.predictionError = pe;
    em.predictedStress = predictedStress;
    em.regulation = reg;
    em.readyForHandoff = readyForHandoff;
    em.prior = nextPrior;
    em.updated = obs.timestamp;
    this.state.economyModel = em;

    // ── ACTUATION (servo + phase + K4 credit source) — behind this._actuation flags. ──────────────
    // Order mirrors Energy: servo (reads regulation.inhibition) -> phase dynamics (reads predictedStress)
    // -> credit-source hook (a validated phase transition preempts the stress-self-prediction credit).
    // Recurrent, one-cycle-lag safe. NEVER touches scoreStress/deriveDiagnoses/the diagnosis set.
    try { if (this._actuation && this._actuation.servo) this._computeEconomyServo(); } catch (e) {}
    try { if (this._actuation && this._actuation.phase) this._computeEconomyPhaseDynamics(); } catch (e) {}
    try { this._applyEconomyCreditSource(em); } catch (e) {}
    // E/I balance + SPOF self-audit (Neuro Ref XIII.1 + XIV) — consumes economy.json's 79 edges. Advisory.
    try { this.state.economyRegulationAdvisories = this._computeEconomyRegulationAdvisories(); } catch (e) { this.state.economyRegulationAdvisories = null; }

    // memory log — used by intuition (PE trends).
    try {
      var mem = this.state.memory || (this.state.memory = {});
      var log = mem.outcomeLog || (mem.outcomeLog = []);
      log.push({ cycle: em.cycle, predictionError: Math.round(pe.total * 1000) / 1000, stress: obs.stress, activeDx: obs.diagnosisCount, regulation: reg.state, timestamp: obs.timestamp });
      if (log.length > 40) log.shift();
    } catch (e) {}

    // brainEconomyModel — the recurrent MACRO-AGGREGATE lifecycle model Civilization + Main Brain read.
    // DISTINCT from finance's financeModel (capital/credit/banks). Real-economy lifecycle signals.
    try { this._buildMacroModel(obs); } catch (e) {}

    // H1-H6 — higher economy brain layers (domain-level, computed once per cycle BEFORE the DDP build)
    try { this._computeEconomyHigherLayers(); } catch (e) {}

    // PHASE K — K1..K8 neuro-completion loop stack (ported from Energy; additive, advisory-where-not-
    // gated). Runs AFTER the higher layers + servo/phase so it reads the fresh cognition surface, and
    // BEFORE the brake so K7 lateral-inhibition / K2 gain are available. K1 is CLOSED via the base
    // scoreStress (external pressure folded into stress); K4 self-prediction scales the learning rate,
    // K5 portalError folds into the prediction error, and K8 sets the adaptive handoff floor — all with
    // one-cycle lag, consumed at the top of the NEXT cycle. 100% deterministic; never rewires the spine.
    try { this._computeEconomyNeuroLayers(); } catch (e) {}

    // HALT/E-I BRAKE (stop-circuit) — computed AFTER the higher layers so it can read economyImmune /
    // economyConscience (this cycle) + the servo (this cycle). Consumed NEXT cycle by
    // _applyEconomyEmissionBrake in surfaceOpportunities (one-cycle lag, exactly like Energy). Behind
    // this._actuation.eiBrake for the proportional E/I arm; the discrete governor brake always runs.
    try { this._computeEconomyBrake(); } catch (e) {}

    // BUSINESS-CYCLE / MACRO-REGIME — additive sub-layer (BEFORE the DDP build so the primary packet advertises it).
    try { this._buildMacroRegimeSublayer(); } catch (e) {}

    // DDP — build the DomainDiagnosisPacket (8-section contract) for the primary diagnosis + one per diagnosis.
    try {
      var _diags = this.state.diagnoses || [];
      var _primary = _diags.filter(function (d) { return d.active; })[0] || _diags[0] || null;
      var _self = this;
      em.domainDiagnosisPacket = this._buildDomainDiagnosisPacket(_primary);
      this.state.economyDomainDiagnosisPackets = _diags.map(function (d) { return _self._buildDomainDiagnosisPacket(d); });
    } catch (e) {}

    // state.cognition — generic surface domain-console reads for ANY brain.
    this.state.cognition = {
      domain: 'economy',
      economyModel: em,
      model: { cycle: em.cycle, predictionError: em.predictionError, predictedStress: em.predictedStress, regulation: em.regulation },
      economyImmune: this.state.economyImmune || null,
      economyAwareness: this.state.economyAwareness || null,
      economyConscience: this.state.economyConscience || null,
      economyIntuition: this.state.economyIntuition || null,
      economySimulation: this.state.economySimulation || null,
      economyExecutiveReport: this.state.economyExecutiveReport || null,
      awareness: this.state.economyAwareness || null,
      conscience: this.state.economyConscience || null,
      immune: this.state.economyImmune || null,
      intuition: this.state.economyIntuition || null,
      sceneLayer: null,
      macroRegimeSublayer: this.state.macroRegimeSublayer || null,
      brainEconomyModel: this.state.brainEconomyModel || null,
      // ── actuation surface (mirrors Energy's cognition.servo / .phaseDynamics / .neuro.regulation) ──
      servo: this.state.economyServo || null,
      brake: this.state.economyBrake || null,
      phaseDynamics: this.state.economyPhaseDynamics || null,
      regulationAdvisories: this.state.economyRegulationAdvisories || null,
      neuro: this.state.economyNeuro || null,   // K1..K8 neuro-completion roll-up (additive)
      actuation: this._actuation || null,
      creditSource: (em && em._creditSource) || null,
      treatments: this.state.treatments || [],
      diagnoses: this.state.diagnoses || [],
      opportunities: this.state.opportunities || []
    };
    return em;
  };

  // ── brainEconomyModel — recurrent MACRO-AGGREGATE lifecycle model (real-economy, FRED-anchored).
  //    DISTINCT from finance's capital-lifecycle financeModel. Tracks the business cycle, growth,
  //    inflation, employment, money-supply trends → emitted for Civilization / domain-packet-adapter. ──
  EconomyBrain.prototype._buildMacroModel = function (obs) {
    var s = this.state || {};
    obs = obs || (s.economyModel && s.economyModel.observation) || {};
    var stress = typeof s.stress === 'number' ? s.stress : 0;
    function norm01(v, lo, hi) { if (v == null || !isFinite(v)) return null; return _emClamp((v - lo) / (hi - lo), 0, 1); }

    // Trend reads — each null when the underlying real series is absent (NEVER fabricated).
    var gdpGrowthTrend = (obs.gdpGrowth != null) ? norm01(obs.gdpGrowth, -4, 6) : null;        // GDPC1 YoY %
    var inflationTrend = (obs.inflationRate != null) ? norm01(obs.inflationRate, 0, 0.8) : null; // CPI/PCE m/m %
    var employmentTrend = (obs.employmentTrend != null) ? _emClamp(1 - norm01(obs.employmentTrend, 3, 10), 0, 1) : null; // inverse of UNRATE
    var sentimentTrend = (obs.sentiment != null) ? norm01(obs.sentiment, 50, 110) : null;       // UMCSENT
    var moneySupplyTrend = (obs.moneySupply != null) ? norm01(obs.moneySupply, 15000, 22000) : null; // M2SL ($B)

    // Business-cycle momentum from the validated stress + diagnosis posture (interpretive, not validated).
    var active = (s.diagnoses || []).filter(function (d) { return d.active; });
    var activeIds = active.map(function (d) { return d.id; });
    var contractionary = activeIds.indexOf('RECESSION') !== -1 || activeIds.indexOf('MARKET_CRASH') !== -1 || activeIds.indexOf('DEBT_CRISIS') !== -1;
    var momentum = contractionary ? 'contraction' : (stress >= 0.50 ? 'stagnation' : 'expansion');

    // fiscal/monetary stance read from policy rate + inflation (coordinated/conflicted/loose/tight).
    var fiscalMonetaryState = 'unknown';
    if (obs.policyRate != null && obs.inflationRate != null) {
      var tight = obs.policyRate >= 4;
      var hotInflation = obs.inflationRate >= 0.4;
      fiscalMonetaryState = (tight && hotInflation) ? 'coordinated-tightening'
        : (tight && !hotInflation) ? 'tight'
        : (!tight && hotInflation) ? 'conflicted'
        : 'loose';
    }

    var recessionRisk = _emClamp(stress * 0.6 + (contractionary ? 0.3 : 0) + ((obs.yieldCurve != null && obs.yieldCurve < 0) ? 0.1 : 0), 0, 1);

    var em = s.economyModel || {};
    var priorGrowth = (s.brainEconomyModel && s.brainEconomyModel.priorGrowthExpectation) || { expectedGrowth: 0.5, confidence: 0, samples: 0 };
    var growthObs = (gdpGrowthTrend != null) ? gdpGrowthTrend : priorGrowth.expectedGrowth;
    var nextPriorGrowth = {
      expectedGrowth: _emClamp(priorGrowth.expectedGrowth + EM_LEARNING_RATE * (growthObs - priorGrowth.expectedGrowth), 0, 1),
      confidence: _emClamp(Math.min(1, (priorGrowth.samples + 1) / 20), 0, 1),
      samples: priorGrowth.samples + 1
    };

    this.state.brainEconomyModel = {
      version: EM_VERSION,
      cycle: em.cycle || 0,
      businessCycleMomentum: momentum,            // expansion / contraction / stagnation
      gdpGrowthTrend: gdpGrowthTrend,             // 0..1 or null
      inflationTrend: inflationTrend,             // 0..1 or null
      employmentTrend: employmentTrend,           // 0..1 or null
      consumerSentimentTrend: sentimentTrend,     // 0..1 or null
      moneySupplyTrend: moneySupplyTrend,         // 0..1 or null
      fiscalMonetaryState: fiscalMonetaryState,   // coordinated/conflicted/loose/tight
      recessionRisk: Math.round(recessionRisk * 1000) / 1000,
      yieldCurve: (obs.yieldCurve != null ? obs.yieldCurve : null),
      fredSeriesActive: obs.fredSeriesActive || [],
      marketProxiesActive: obs.marketProxiesActive || [],
      priorGrowthExpectation: nextPriorGrowth,
      anchorSeries: { growth: 'GDPC1', inflation: 'CPIAUCSL/PCEPI', employment: 'UNRATE/PAYEMS', moneySupply: 'M2SL', policy: 'FEDFUNDS', yields: 'DGS10' },
      note: 'real-economy MACRO-AGGREGATE lifecycle model (GDP/inflation/employment/money-supply), FRED-anchored; DISTINCT from finance capital-lifecycle model; interpretive (the validated P3 scorer is the only certified path)',
      updated: (em.updated || Date.now())
    };
    return this.state.brainEconomyModel;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // NEURO-COMPLETION K1..K8 LOOP STACK (2026-07-13) — ported from energy-brain.js's K-layers to the
  // economy MACRO AGGREGATE. Each K mirrors Energy's mechanism but reads THIS domain's state/edges
  // (FRED-anchored macro observation, economy regulation term, economy L1/macro-regime depth, economy
  // stress history), never Energy's. 100% DETERMINISTIC arithmetic/graph analysis — NO fetch-to-LLM,
  // NO paid-AI, ever on the 30s cycle. Strictly additive: every method writes only NEW state keys
  // (economyAfferent / economyGainControl / economySlowModel / economyOutcomeModel /
  // economyPerceptionDepth / economyAttention / economyInhibition / economyHomeostasis / economyNeuro)
  // and NEVER mutates scoreStress, deriveDiagnoses, the diagnosis set, or anything /api/limen/score or
  // /api/helix/helix-report/score consumes. Closed loops (one-cycle lag) are consumed at the top of
  // _updateEconomyModel: K4→learning rate, K5→prediction error, K8→handoff floor; K1 is closed via the
  // base scoreStress (external pressure folded into stress).
  // ════════════════════════════════════════════════════════════════════════════
  var EK_OUTCOME_BUFFER = 40;     // rolling predicted-vs-realized stress samples (K4)
  var EK_HOMEO_WINDOW = 60;       // cycles of stress baseline for the adaptive set-point (K8)

  // K1 - afferent inter-brain integration. Surfaces received cross-domain pressure and the stress
  // delta it contributes. CLOSED: the base scoreStress folds getExternalPressure() into stress each
  // cycle (base-capped at 0.3) — economy inherits that, so this reads the applied delta, never re-adds.
  EconomyBrain.prototype._computeEconomyAfferent = function () {
    var s = this.state, em = s.economyModel || {};
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
      integrated: true,                                          // K1 CLOSED via base scoreStress
      appliedStressDelta: Math.round(((s._externalPressureApplied) || 0) * 1000) / 1000,
      wouldRaiseStressBy: Math.round(pressure * 1000) / 1000,
      note: 'CLOSED: the base scoreStress folds getExternalPressure() into stress each cycle (matches the other 18 domains); economy inherits it (no override).',
      lastAfferentAt: em.updated || now
    };
    s.economyAfferent = af; return af;
  };

  // K2 - neuromodulatory gain application. Surfaces the graded output modulation the recurrent
  // regulation term implies over surfaced opportunities. Economy's actuated output channel is the
  // servo/brake CONFIDENCE dampening (already live); outputScale here is an advisory ranked-cut readout.
  EconomyBrain.prototype._computeEconomyGainControl = function () {
    var s = this.state, em = s.economyModel || {}, reg = em.regulation || {};
    var opps = s.opportunities || [];
    var outputScale = (typeof reg.outputScale === 'number') ? reg.outputScale : 1;
    var wouldCapAt = Math.max(1, Math.round(opps.length * outputScale));
    var gc = {
      version: 1,
      gain: (typeof reg.gain === 'number') ? reg.gain : null,
      inhibition: (typeof reg.inhibition === 'number') ? reg.inhibition : null,
      outputScale: outputScale,
      currentOpportunityCount: opps.length,
      wouldCapOpportunitiesAt: wouldCapAt,                       // gain-scaled ranked cut (advisory)
      wouldSuppress: Math.max(0, opps.length - wouldCapAt),
      appliedTargets: ['predictedStress (gain-blend)', 'opportunity/emission confidence (via servo+brake E/I dampening)'],
      unappliedTargets: ['hard opportunity count cap (economy uses proportional confidence dampening, not a ranked cut)'],
      note: 'ADVISORY cut + CLOSED confidence arm: gainBlend feeds predictedStress and the servo E/I factor dampens opportunity confidence via the brake; economy applies no hard ranked cap.',
      lastGainAt: em.updated || Date.now()
    };
    s.economyGainControl = gc; return gc;
  };

  // K3 - slow consolidation / long-term plasticity. Maintains a PARALLEL slow-weight track
  // (EM_SLOW_RATE) that never touches em.prior; fast-vs-slow divergence is a real regime-shift signal.
  EconomyBrain.prototype._consolidateEconomySlowModel = function () {
    var s = this.state, em = s.economyModel || {}, obs = em.observation || null;
    var slow = s.economySlowModel || {
      version: 1, cycle: 0,
      slow: { expectedStress: 0.5, expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, samples: 0 },
      rate: EM_SLOW_RATE, note: 'parallel slow-weight track (EM_SLOW_RATE); does NOT touch em.prior'
    };
    if (obs) {
      var r = EM_SLOW_RATE, w = slow.slow;
      w.expectedStress = _emClamp(w.expectedStress + r * ((obs.stress || 0) - w.expectedStress), 0, 1);
      w.expectedSignal = _emClamp(w.expectedSignal + r * ((obs.signal || 0) - w.expectedSignal), 0, 1);
      w.expectedDiagnosisCount = w.expectedDiagnosisCount + r * ((obs.diagnosisCount || 0) - w.expectedDiagnosisCount);
      w.expectedOpportunityCount = w.expectedOpportunityCount + r * ((obs.opportunityCount || 0) - w.expectedOpportunityCount);
      w.samples += 1;
      slow.cycle += 1;
    }
    var fast = (em.prior && typeof em.prior.expectedStress === 'number') ? em.prior.expectedStress : 0.5;
    slow.fastSlowDivergence = Math.round(Math.abs(fast - slow.slow.expectedStress) * 1000) / 1000;
    slow.regimeShift = slow.fastSlowDivergence > 0.25;            // fast prior pulled far from slow baseline
    slow.updated = em.updated || Date.now();
    s.economySlowModel = slow; return slow;
  };

  // K4 - outcome / credit learning (TRUTH BRAKE). Compares each cycle's predictedStress against the
  // NEXT cycle's realized stress (online forward self-prediction). SELF-CONSISTENCY only — never an
  // external reward. CLOSED: hitRate scales the effective learning rate in _updateEconomyModel (>=5
  // samples), so persistent mis-prediction speeds adaptation.
  EconomyBrain.prototype._scoreEconomyOutcomes = function () {
    var s = this.state, em = s.economyModel || {};
    var buf = this._economyOutcomeBuffer = this._economyOutcomeBuffer || [];
    var obs = em.observation || null;
    if (this._economyPrevPrediction != null && obs && typeof obs.stress === 'number') {
      buf.push({ predicted: this._economyPrevPrediction, realized: obs.stress, err: Math.abs(this._economyPrevPrediction - obs.stress) });
      if (buf.length > EK_OUTCOME_BUFFER) buf.shift();
    }
    this._economyPrevPrediction = (typeof em.predictedStress === 'number') ? em.predictedStress : null;   // stash for next-cycle reconciliation
    var n = buf.length, sumErr = 0, sumSq = 0, hits = 0;
    for (var i = 0; i < n; i++) { sumErr += buf[i].err; sumSq += buf[i].err * buf[i].err; if (buf[i].err <= 0.1) hits++; }
    var om = {
      version: 1,
      samples: n,
      meanRealizedError: n ? Math.round((sumErr / n) * 1000) / 1000 : null,     // does the forecast come true
      brierLike: n ? Math.round((sumSq / n) * 1000) / 1000 : null,
      hitRate: n ? Math.round((hits / n) * 100) / 100 : null,                    // fraction within 0.1 of realized
      loopType: 'online-continuous (predicted-vs-next-realized stress); SELF-CONSISTENCY calibration, NOT an external reward',
      creditAssignmentActive: (n >= 5),
      effectiveLearningRate: (em._effectiveLearningRate) || null,
      creditSource: em._creditSource || null,
      note: 'CLOSED: hitRate scales the effective learning rate in _updateEconomyModel (>=5 samples); a validated P3/P7 phase transition preempts it as the credit source.',
      lastOutcomeAt: em.updated || Date.now()
    };
    s.economyOutcomeModel = om; return om;
  };

  // K5 - deep hierarchical perception. Aggregates the depth the brain HAS (existing L1 branch scan +
  // macro-regime sub-portal caches; NO new fetches) and estimates the portalError the recurrent model
  // would otherwise zero out. CLOSED: _updateEconomyModel folds portalErrorEstimate into the prediction
  // error (weight 0.05, one-cycle lag).
  EconomyBrain.prototype._computeEconomyPerceptionDepth = function () {
    var s = this.state, em = s.economyModel || {};
    var l1 = s._l1DepthCache || null;
    var mr = s.macroRegimeSublayer || null;
    var l1Real = 0, l1Mad = 0;
    if (l1 && l1.byDiagnosis) { Object.keys(l1.byDiagnosis).forEach(function (k) { l1Real += (l1.byDiagnosis[k].realTreatments || 0); l1Mad += (l1.byDiagnosis[k].madLibTreatments || 0); }); }
    var levels = [
      { level: 'L0', name: 'root', status: (s._portalCache) ? 'loaded' : 'pending' },
      { level: 'L1', name: 'branch-scan', status: l1 ? 'scanned' : 'pending', realTreatments: l1Real, madLibTreatments: l1Mad },
      { level: 'L2', name: 'deep-cortex', status: 'quarantined', note: 'mad-lib treatments immune-blocked' },
      { level: 'MR', name: 'macro-regime-subportal', status: (mr && mr.loaded) ? 'loaded' : 'absent', activeCount: (mr && mr.activeCount) || 0 }
    ];
    var loadedDepth = (mr && mr.loaded) ? 3 : (l1 ? 1 : 0);
    var admissible = l1Real + ((mr && mr.count) ? mr.count : 0);
    var blocked = l1Mad + 1;                                      // +1 for the quarantined L2 tier
    var portalErrorEstimate = Math.round((blocked / Math.max(1, admissible + blocked)) * 1000) / 1000;
    var pd = {
      version: 1, levels: levels, deepestUsableLevel: loadedDepth,
      portalErrorEstimate: portalErrorEstimate,                   // consumed by _updateEconomyModel (weight 0.05)
      note: 'CLOSED: _updateEconomyModel folds portalErrorEstimate into the prediction error (weight 0.05). Perception stops at L1 (L2 quarantined); no new fetches.',
      lastDepthAt: em.updated || Date.now()
    };
    s.economyPerceptionDepth = pd; return pd;
  };

  // K6 - attention / selective routing. Ranks top-down salience (active + relevance + novelty +
  // operator focus steer) and names focus vs suppressed. Advisory read of routing priority; does not
  // gate the validated pipeline.
  EconomyBrain.prototype._computeEconomyAttention = function () {
    var s = this.state, em = s.economyModel || {}, reg = em.regulation || {};
    var pe = (em.predictionError && em.predictionError.total) || 0;
    var rb = this._readRequestBiases ? this._readRequestBiases() : { attentionFocus: [] };
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
      note: 'ADVISORY salience ranking (active + relevance + novelty + operator focus steer); does not gate the validated diagnosis pipeline.',
      lastAttentionAt: em.updated || Date.now()
    };
    s.economyAttention = at; return at;
  };

  // K7 - lateral inhibition (microcircuit). Shows the winner-take-most ranking the regulation
  // inhibition term implies among competing active diagnoses (advisory readout).
  EconomyBrain.prototype._computeEconomyInhibition = function () {
    var s = this.state, em = s.economyModel || {}, reg = em.regulation || {};
    var inhib = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;
    var active = (s.diagnoses || []).filter(function (d) { return d.active; })
      .sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var winner = active[0] || null;
    var li = {
      version: 1, inhibitionStrength: inhib,
      winner: winner ? winner.id : null,
      competitors: active.slice(1).map(function (d) { return { id: d.id, relevance: d.relevance, suppressBy: Math.round((d.relevance || 0) * inhib * 1000) / 1000 }; }).slice(0, 6),
      note: 'ADVISORY winner-take-most ranking implied by the regulation inhibition term; the actuated inhibition arm is the servo E/I dampening consumed by the brake.',
      lastInhibitionAt: em.updated || Date.now()
    };
    s.economyInhibition = li; return li;
  };

  // K8 - adaptive homeostatic set-point (Turrigiano-style synaptic scaling). Maintains an adaptive
  // stress baseline alongside the fixed EM_STRESS_FLOOR, from the base memory.stressHistory (fallback
  // to memory.outcomeLog). CLOSED: _updateEconomyModel blends this adaptiveBaseline into the handoff
  // floor (50/50, >=10 samples, bounded).
  EconomyBrain.prototype._computeEconomyHomeostasis = function () {
    var s = this.state, em = s.economyModel || {};
    var mem = s.memory || {};
    var hist = (mem.stressHistory && mem.stressHistory.length) ? mem.stressHistory : (mem.outcomeLog || []);
    var win = hist.slice(-EK_HOMEO_WINDOW);
    var n = win.length, sum = 0;
    for (var i = 0; i < n; i++) sum += (win[i].stress || 0);
    var baseline = n ? sum / n : 0.5;                            // adaptive set-point vs fixed EM_STRESS_FLOOR
    var cur = (typeof s.stress === 'number') ? s.stress : 0;
    var scalingFactor = baseline > 0 ? Math.round((0.5 / Math.max(0.1, baseline)) * 1000) / 1000 : 1;
    var hm = {
      version: 1,
      fixedFloor: EM_STRESS_FLOOR,                               // current hardcoded set-point
      adaptiveBaseline: Math.round(baseline * 1000) / 1000,
      currentStress: cur,
      deviationFromBaseline: Math.round((cur - baseline) * 1000) / 1000,
      scalingFactor: scalingFactor,                              // synaptic-scaling multiplier
      samples: n,
      effectiveFloor: (em._effectiveFloor) || null,
      note: 'CLOSED: readyForHandoff gates on a 50/50 blend of EM_STRESS_FLOOR and adaptiveBaseline (>=10 samples) via em._effectiveFloor.',
      lastHomeostasisAt: em.updated || Date.now()
    };
    s.economyHomeostasis = hm; return hm;
  };

  // Assemble the neuro-completion surface (mirrors Energy's _computeEnergyNeuroLayers). Runs all
  // K-layers in K1..K8 order, stores each on state (like economyImmune/economyAwareness), and attaches
  // a compact roll-up to state.economyNeuro (also surfaced additively on state.cognition.neuro).
  EconomyBrain.prototype._computeEconomyNeuroLayers = function () {
    this._computeEconomyAfferent();          // K1 - afferent inter-brain input (closed via base scoreStress)
    this._computeEconomyGainControl();       // K2 - neuromodulatory gain application
    this._consolidateEconomySlowModel();     // K3 - slow consolidation / long-term plasticity
    this._scoreEconomyOutcomes();            // K4 - outcome / credit learning (truth brake)
    this._computeEconomyPerceptionDepth();   // K5 - deep hierarchical perception
    this._computeEconomyAttention();         // K6 - attention / selective routing
    this._computeEconomyInhibition();        // K7 - lateral inhibition (microcircuit)
    this._computeEconomyHomeostasis();       // K8 - adaptive set-point (microcircuit)
    var s = this.state;
    var neuro = {
      version: 1,
      status: 'closed',                       // K1/K4/K5/K8 wired into the recurrent spine (one-cycle lag); K2/K6/K7 advisory + servo/brake E/I arm
      afferent: s.economyAfferent || null,
      gainControl: s.economyGainControl || null,
      slowModel: s.economySlowModel || null,
      outcomeModel: s.economyOutcomeModel || null,
      perceptionDepth: s.economyPerceptionDepth || null,
      attention: s.economyAttention || null,
      inhibition: s.economyInhibition || null,
      homeostasis: s.economyHomeostasis || null,
      servo: s.economyServo || null,
      brake: s.economyBrake || null,
      phaseDynamics: s.economyPhaseDynamics || null,
      closedLoops: [
        'K1 afferent -> base scoreStress (externalPressure folded into stress)',
        'K4 outcome -> _updateEconomyModel (hitRate scales learning rate; self-consistency, not reward)',
        'K5 portalError -> _updateEconomyModel prediction error (weight 0.05)',
        'K8 set-point -> readyForHandoff (blended adaptive floor)',
        'K2/K7 E/I -> servo emissionFactor -> brake confidence dampening'
      ]
    };
    s.economyNeuro = neuro;
    if (s.cognition && typeof s.cognition === 'object') s.cognition.neuro = neuro;   // additive: new key only
    return neuro;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // ACTUATION LAYER (2026-07-13) — ported from energy-brain.js to economy's actuation depth.
  // 100% DETERMINISTIC. No fetch-to-LLM, no paid-AI, ever runs on the 30s cycle. All reversible
  // via this._actuation. Reads the recurrent economyModel + governor layers; writes only NEW keys
  // (economyServo / economyBrake / economyPhaseDynamics / economyRegulationAdvisories); NEVER mutates
  // scoreStress, deriveDiagnoses, the diagnosis set, or anything /api/limen/score consumes.
  // ════════════════════════════════════════════════════════════════════════════

  // ── REGULATE-TO-TARGET SERVO (allostasis) + E/I DRIVE (Neuro Ref V.2/XII + XIII.1) ─────────────
  // SENSOR: excitatory drive (stress + live-condition count + active-diagnosis count) vs the recurrent
  // model's inhibition term. CONTROLLER: PI (fast proportional + bounded slow integral, the HPA
  // fast+slow arms). EFFECTOR: proportional dampening of the emission/opportunity CONFIDENCE channel
  // (consumed by _computeEconomyBrake). Economy has no K8 homeostasis layer like Energy, so the
  // allostatic deviation is taken from the recurrent prior (economyModel.prior.expectedStress) — a
  // real, economy-native baseline. Only ever ADDS braking; never disinhibits.
  EconomyBrain.prototype._computeEconomyServo = function () {
    function R(x) { return Math.round(x * 1000) / 1000; }
    var s = this.state, em = s.economyModel || {}, reg = em.regulation || {}, prior = em.prior || {};
    var stress = (typeof s.stress === 'number') ? s.stress : 0;
    var conds = Array.isArray(s._activeConditions) ? s._activeConditions.length : (Array.isArray(s.signals) ? s.signals.length : 0);
    var dxA = Array.isArray(s.diagnoses) ? s.diagnoses.filter(function (d) { return d && d.active; }).length : 0;
    var drive = Math.max(0, Math.min(2, stress + Math.min(conds, 12) / 24 + Math.min(dxA, 6) / 24));
    var inhibition = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;
    var FLOOR = 0.15;
    // allostatic deviation = how far current stress sits above the recurrent baseline expectation.
    var deviation = Math.max(0, stress - (typeof prior.expectedStress === 'number' ? prior.expectedStress : stress));
    var target = Math.max(FLOOR, Math.min(1, Math.max(drive, FLOOR + deviation)));
    var error = target - inhibition;                                              // >0 => under-braked for the drive/regime
    this._servoIntegral = Math.max(-0.5, Math.min(0.5, (this._servoIntegral || 0) + error * 0.15));
    var Kp = 0.8, Ki = 0.4;
    var correction = Math.max(0, Kp * error + Ki * Math.max(0, this._servoIntegral));   // only ADD braking
    var emissionFactor = Math.max(0.2, Math.min(1, 1 - correction));
    var state = error > 0.25 ? 'runaway-risk' : ((inhibition - target) > 0.4 ? 'over-inhibited' : 'balanced');
    var servo = {
      version: 1, actuated: true, drive: R(drive), inhibition: R(inhibition), target: R(target),
      error: R(error), integral: R(this._servoIntegral), emissionFactor: R(emissionFactor),
      state: state, deviation: R(deviation),
      note: 'closed-loop allostasis: drives inhibition toward a drive+deviation target; effector = proportional emission-confidence dampening. Neuro Ref XIII.1/V.2/XII.'
    };
    s.economyServo = servo;
    return servo;
  };

  // ── HALT / E-I BRAKE (stop-circuit; Neuro Ref IV.2/XIII.2 + XIII.1) ────────────────────────────
  // Converts the governor layers (immune / regulation / prediction-error / conscience) from
  // annotation into an actual brake, PLUS the servo's proportional E/I arm. Computed each cycle end;
  // CONSUMED next cycle by _applyEconomyEmissionBrake. The discrete governor brake always runs; the
  // proportional E/I dampening is gated by this._actuation.eiBrake. Fail-open when state absent (cycle 1).
  EconomyBrain.prototype._computeEconomyBrake = function () {
    var s = this.state, em = s.economyModel || {}, reg = em.regulation || {};
    var im = s.economyImmune || {}, con = s.economyConscience || {};
    var diags = s.diagnoses || [];
    var activeUnblocked = diags.filter(function (d) { return d.active && !d.blocked; });
    var reasons = [];
    // full-halt conditions
    if (im.immuneState === 'alert') reasons.push({ code: 'immune-alert', severity: 'halt', detail: 'immune severity ' + (im.severity || '?') });
    if (reg.stale) reasons.push({ code: 'stale-feeds', severity: 'halt', detail: 'feeds older than staleness window' });
    if (diags.length && activeUnblocked.length === 0) reasons.push({ code: 'no-evidence-backed-diagnosis', severity: 'halt', detail: 'all active diagnoses blocked by the evidence contract' });
    // dampen conditions
    var pe = (em.predictionError && em.predictionError.total) || 0;
    if (pe > 0.4) reasons.push({ code: 'prediction-error-spike', severity: 'dampen', detail: 'predictionError ' + (Math.round(pe * 1000) / 1000) });
    if (reg.flooding) reasons.push({ code: 'opportunity-flood', severity: 'dampen', detail: 'opportunity count above flood cap' });
    if (con.conscienceState === 'restrictive' && con.artifactReadinessDecision && !con.artifactReadinessDecision.researchReady && !con.artifactReadinessDecision.investmentReady) reasons.push({ code: 'conscience-no-lane', severity: 'dampen', detail: 'no artifact lane cleared by conscience' });
    // E/I BRAKE ACTUATION (Neuro Ref XIII.1): proportional to the drive/inhibition deficit via the servo.
    var servo = s.economyServo || null, eiFactor = 1;
    if (this._actuation && this._actuation.eiBrake && servo) {
      if (typeof servo.emissionFactor === 'number') eiFactor = servo.emissionFactor;
      if (servo.state === 'runaway-risk') reasons.push({ code: 'ei-imbalance', severity: 'dampen', detail: 'inhibition ' + servo.inhibition + ' below target ' + servo.target + ' (drive ' + servo.drive + ')' });
    }
    var halt = reasons.some(function (r) { return r.severity === 'halt'; });
    var dampen = reasons.some(function (r) { return r.severity === 'dampen'; });
    var level = halt ? 'halt' : dampen ? 'dampen' : 'clear';
    var brake = {
      version: 1, level: level, engaged: halt, dampen: dampen, reasons: reasons,
      suppressOpportunities: halt,
      confidencePenalty: Math.min(halt ? 0 : dampen ? 0.5 : 1, eiFactor),   // strongest brake wins (discrete governor blended with proportional E/I)
      eiFactor: (Math.round(eiFactor * 1000) / 1000),
      note: level === 'clear' ? 'stop-circuit clear — emission allowed'
        : level === 'halt' ? 'STOP-CIRCUIT ENGAGED — opportunities held'
        : 'stop-circuit dampening — confidence reduced, held for review',
      lastBrakeAt: em.updated || Date.now()
    };
    s.economyBrake = brake; return brake;
  };

  // Effector: apply the prior cycle's brake to this cycle's opportunity set (one-cycle lag).
  EconomyBrain.prototype._applyEconomyEmissionBrake = function (opps) {
    var brake = this.state.economyBrake;
    if (!brake || brake.level === 'clear') { this.state.opportunitiesHeld = false; return opps; }
    var pen = (typeof brake.confidencePenalty === 'number') ? brake.confidencePenalty : 1;
    var codes = (brake.reasons || []).map(function (r) { return r.code; }).join(',');
    for (var i = 0; i < opps.length; i++) {
      if (pen < 1 && typeof opps[i].confidence === 'number') opps[i].confidence = Math.round(opps[i].confidence * pen);
      if (brake.suppressOpportunities) { opps[i].held = true; opps[i].heldReason = codes; }
    }
    this.state.opportunitiesHeld = !!brake.suppressOpportunities;
    return opps;
  };

  // ── PHASE-COHERENCE ROUTER + PHASE-TRANSITION CONSISTENCY (patent §3.4 Loop-1 + thing2 lineage) ──
  // (A) ROUTER: deterministic advisory coupling — economy couples to co-phased, stressed domains via
  //     the phase matrix M. (B) CONSISTENCY: a realized phase TRANSITION through time; this is
  //     self-consistency calibration (interpretive), NEVER external reward. A P3/P7-family transition
  //     gates the phase-consistency TIER of the central K4 gate; every other transition is advisory.
  //     Economy is the macro-aggregate (outside the narrow kernel envelope) and is NOT
  //     externalRewardEligible — externalOutcome is always null and no transition is ever ground-truth.
  // ── THING2 KERNEL PHASE REFRESH — append the domain's primary STRESS scalar (finalStress/stress;
  //    up=bad) to the persistent series, cap at 60, persist to localStorage, then run the Thing2
  //    kernel over it to derive an interpretive P0-P10 phase. Deterministic pure-math (no network/AI).
  //    On any failure or when the adapter/history (< 8) is unavailable, _kernelPhase is set to null and
  //    the caller falls back to s.phase. positive:false because the scalar RISES with distress. ──
  EconomyBrain.prototype._updatePhaseKernel = function () {
    var s = this.state;
    var scalar = (typeof s.finalStress === 'number') ? s.finalStress
               : (typeof s.brainStress === 'number') ? s.brainStress
               : (typeof s.stress === 'number') ? s.stress : null;
    try {
      if (scalar != null && isFinite(scalar)) {
        this._phaseSeries = this._phaseSeries || [];
        this._phaseSeries.push(scalar);
        while (this._phaseSeries.length > 60) this._phaseSeries.shift();
        try {
          if (typeof localStorage !== 'undefined' && localStorage) {
            localStorage.setItem('limen:phaseseries:economy', JSON.stringify(this._phaseSeries));
          }
        } catch (e2) {}
      }
    } catch (e) {}

    this._kernelPhase = null;
    s.phaseSource = 'fallback';
    try {
      if (typeof window !== 'undefined' && window.LIMENThing2 && this._phaseSeries && this._phaseSeries.length >= 8) {
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

  EconomyBrain.prototype._computeEconomyPhaseDynamics = function () {
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
    var VALIDATED = { p3: 1, p7: 1, p7a: 1, p7b: 1 };            // P3/P7 family gate for phase-consistency tier — self-consistency, NOT external reward
    var BREAKING = { p1: 1, p3: 1, p7: 1, p7a: 1, p7b: 1, p9: 1 };  // recursion-arc BREAKING = more-distressed
    function norm(p) { if (p == null) return null; p = String(p).toLowerCase().replace(/[^a-z0-9]/g, ''); if (p.charAt(0) !== 'p') p = 'p' + p; return p; }
    // PREFER the Thing2 kernel phase (interpretive, from this domain's stress trajectory) for BOTH
    // the coherence router and the phase-transition reward; fall back to the existing s.phase when
    // the kernel is unavailable (adapter missing / history < 8 / error) — fallback path unchanged.
    var myPhase = norm(this._kernelPhase != null ? this._kernelPhase : s.phase);

    // (A) COHERENCE ROUTER — couple to co-phased, stressed peers.
    var doms = (typeof window !== 'undefined' && window.LIMENDomains) || {};
    var coupled = [], couplingStrength = 0;
    if (myPhase && PHASE_M[myPhase]) {
      var row = PHASE_M[myPhase];
      Object.keys(doms).forEach(function (k) {
        if (k === 'economy') return;
        var d = doms[k] || {};
        var op = norm(d.brainPhase || d.phase || (d.brain && d.brain.phase));
        var st = (typeof d.brainStress === 'number') ? d.brainStress : (typeof d.stress === 'number' ? d.stress : 0);
        if (!op) return;
        var coh = (row[op] != null) ? row[op] : (op === myPhase ? 0.04 : 0);
        if (coh > 0 && st > 0.5) { coupled.push({ domain: k, phase: op, coherence: coh, stress: Math.round(st * 100) / 100 }); }
      });
      coupled.sort(function (a, b) { return (b.coherence * b.stress) - (a.coherence * a.stress); });
      couplingStrength = coupled.reduce(function (a, c) { return a + c.coherence * c.stress; }, 0);
    }

    // (B) PHASE-TRANSITION CONSISTENCY — did a predicted transition actually occur (through time)?
    //     This is SELF-CONSISTENCY calibration (interpretive), NEVER external reward. validated => the
    //     P3/P7 family gate for the phase-consistency tier inside the central K4 gate.
    var hist = this._economyPhaseHistory = this._economyPhaseHistory || [];
    var prev = hist.length ? hist[hist.length - 1].phase : null;
    var transition = null;
    if (prev != null && myPhase != null && prev !== myPhase) {
      // direction prediction from the recurrent model: predictedStress above current => rising.
      var em = s.economyModel || {};
      var predictedUp = (typeof em.predictedStress === 'number' && typeof s.stress === 'number')
        ? em.predictedStress > s.stress
        : ((s.brainEconomyModel && s.brainEconomyModel.businessCycleMomentum === 'contraction') || false);
      var wentUp = (BREAKING[myPhase] && !BREAKING[prev]) ? true : (BREAKING[prev] && !BREAKING[myPhase]) ? false : null;
      var hit = (wentUp !== null) ? (wentUp === !!predictedUp) : null;
      var validated = !!(VALIDATED[myPhase] || VALIDATED[prev]);
      transition = { from: prev, to: myPhase, predictedUp: !!predictedUp, wentUp: wentUp, hit: hit,
        validated: validated, kind: validated ? 'self-consistency calibration (phase, interpretive; P3/P7 gate)' : 'self-consistency calibration (phase, interpretive; advisory)' };
    }
    hist.push({ phase: myPhase, t: (s.economyModel && s.economyModel.updated) || Date.now() });
    if (hist.length > 24) hist.shift();

    var out = {
      version: 1, myPhase: myPhase,
      phaseSource: s.phaseSource || 'fallback',       // 'thing2-kernel' when the real kernel drove myPhase, else 'fallback'
      kernelTrajectory: s.kernelTrajectory || null,
      coupled: coupled.slice(0, 5), couplingStrength: Math.round(couplingStrength * 1000) / 1000,
      transition: transition,
      note: 'phase-coherence router (patent M matrix) + phase-transition consistency. Phase source = Thing2 recursive kernel over the stress trajectory (interpretive) with s.phase fallback; a validated (P3/P7) transition is the phase-consistency tier of the central K4 gate — self-consistency calibration, NOT external reward (economy is macro-aggregate and not externalRewardEligible).'
    };
    s.economyPhaseDynamics = out;
    return out;
  };

  // ── K4 CREDIT-SOURCE HOOK — routes the CURRENT-cycle credit assignment through the central honest
  //    reward gate (window.LIMENK4.credit) using this cycle's fresh phase dynamics. A validated+resolved
  //    thing2 phase transition is the phase-consistency tier (P3/P7 family gate) — self-consistency
  //    calibration (interpretive), NEVER external reward: economy is NOT externalRewardEligible, so
  //    externalOutcome is always null and isReward is always false. On a resolved phase-consistency
  //    transition it also gently nudges the recurrent base plasticity (faster on a hit, slower on a miss),
  //    bounded — the actuation of the phase-consistency signal on learning, not just display. Pure math,
  //    no AI/network. Fallback preserves prior preemption when the gate is absent.
  EconomyBrain.prototype._applyEconomyCreditSource = function (em) {
    if (!em) return;
    var pd = (this._actuation && this._actuation.phase) ? this.state.economyPhaseDynamics : null;
    var pt = pd && pd.transition;
    var _ptActive = !!(pt && pt.hit !== null);
    var _om = this.state.economyOutcomeModel;
    var _sig = {
      externalOutcome: null,                                            // NOT eligible: self-consistency only, never reward
      phaseValidated: !!(pt && pt.validated),                           // P3/P7 family gate for phase-consistency tier — self-consistency, NOT external reward
      phaseTransitionHit: _ptActive ? (pt.hit ? 1 : 0) : null,
      callHitRate: null, callSamples: 0,                                // no call-resolution ledger in economy
      stressSelfPred: (_om && typeof _om.hitRate === 'number' && _om.samples >= 5) ? _om.hitRate : null,
      stressSamples: (_om && typeof _om.samples === 'number') ? _om.samples : 0
    };
    var _k4 = (typeof window !== 'undefined' && window.LIMENK4 && typeof window.LIMENK4.credit === 'function')
      ? window.LIMENK4.credit(_sig) : null;
    var creditSource, isReward;
    if (_k4) { creditSource = _k4.creditSource; isReward = !!_k4.isReward; }
    else {
      // FALLBACK (gate absent) — prior preemption preserved in-line.
      var phaseReward = _ptActive && !!pt.validated;
      creditSource = phaseReward ? 'phase-consistency' : (_sig.stressSelfPred !== null ? 'stress-consistency' : 'none');
      isReward = false;
    }
    em._creditSource = creditSource;
    em._creditIsReward = isReward;                                      // honest flag: false unless a real external outcome fed the gate (never, for economy)
    em._creditReward = (creditSource === 'phase-consistency' && pt) ? { from: pt.from, to: pt.to, hit: pt.hit } : null;
    // Bounded plasticity nudge ONLY on a resolved phase-consistency transition (self-consistency
    // calibration, interpretive — NOT external reward). Faster credit on a hit, slower on a miss.
    if (creditSource === 'phase-consistency' && pt && em.plasticity && typeof em.plasticity.learningRate === 'number') {
      var lr = em.plasticity.learningRate + (pt.hit ? 0.03 : -0.03);
      em.plasticity.learningRate = Math.max(0.08, Math.min(0.4, lr));
    }
    return em._creditSource;
  };

  // ── E/I BALANCE + SELF-AUDIT (SPOF) ADVISORIES (Neuro Ref XIII.1 + XIV) — observe-only. ─────────
  // (1) E/I balance: is inhibition tracking drive? (read off the servo). (2) Self-audit: CONSUME the
  // connectivity graph — run an articulation-point (single-point-of-failure) + degree-hub audit over
  // economy.json's 79 edges. Self-contained deterministic graph analysis (no external module); edges
  // are lazy-loaded once (browser fire-and-forget / server require), matching Energy's pattern — the
  // /api/domain-snapshot object carries NO edges, so reading _rawDomain.edges would be null every cycle.
  EconomyBrain.prototype._computeEconomyRegulationAdvisories = function () {
    var s = this.state, out = { version: 1, observeOnly: true };
    // (1) E/I balance — off the servo (drive vs inhibition vs target).
    try {
      var servo = s.economyServo || null;
      if (servo) {
        out.eiBalance = {
          drive: servo.drive, inhibition: servo.inhibition, target: servo.target,
          error: servo.error, state: servo.state,
          balanced: servo.state === 'balanced',
          note: 'inhibition must scale with drive; error>0 => under-braked (runaway risk).'
        };
      } else { out.eiBalance = null; }
    } catch (e) { out.eiBalance = null; }
    // (2) Self-audit — SPOF / articulation points over the economy edge graph.
    try {
      var self = this;
      var edges = (Array.isArray(s.edges) && s.edges) || this._economyEdges || null;
      if (!edges) {
        if (typeof fetch === 'function' && !this._economyEdgesPromise) {
          this._economyEdgesPromise = fetch('/assets/data/domains/economy.json')
            .then(function (r) { return r.json(); })
            .then(function (j) { if (j && Array.isArray(j.edges)) self._economyEdges = j.edges; })
            .catch(function () {});
        } else if (typeof require === 'function') {
          try { var ed = require('../../data/domains/economy.json'); if (ed && Array.isArray(ed.edges)) { this._economyEdges = ed.edges; edges = ed.edges; } } catch (_e) {}
        }
      }
      if (edges && edges.length) {
        var audit = this._economyConnectivityAudit(edges);
        out.selfAudit = { consumed: true, edgeCount: edges.length, spofCount: audit.articulationNodes.length,
          spof: audit.articulationNodes.slice(0, 5), topHubs: audit.topHubsByDegree.slice(0, 5),
          verdict: audit.articulationNodes.length ? (audit.articulationNodes.length + ' single-point(s) of failure') : 'no articulation nodes (resilient graph)' };
      } else {
        out.selfAudit = { consumed: false, note: 'edges loading (async, next cycle)' };
      }
    } catch (e) { out.selfAudit = { consumed: false, error: String(e && e.message || e).slice(0, 80) }; }
    return out;
  };

  // Self-contained connectivity audit: articulation points (Tarjan) + degree hubs on the undirected
  // graph induced by the edge list. Deterministic; O(V+E). No external dependency (only economy-brain.js
  // is edited). Mirrors what limen-connectivity-audit.js returns so downstream reads are uniform.
  EconomyBrain.prototype._economyConnectivityAudit = function (edges) {
    var adj = {}, deg = {};
    function ensure(n) { if (!adj[n]) { adj[n] = []; deg[n] = 0; } }
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i]; if (!e) continue;
      var a = e.source, b = e.target; if (a == null || b == null || a === b) continue;
      ensure(a); ensure(b);
      if (adj[a].indexOf(b) === -1) { adj[a].push(b); deg[a]++; }
      if (adj[b].indexOf(a) === -1) { adj[b].push(a); deg[b]++; }
    }
    var nodes = Object.keys(adj);
    // Tarjan articulation points (iterative to avoid deep recursion).
    var visited = {}, disc = {}, low = {}, parent = {}, ap = {}, timer = 0;
    for (var vi = 0; vi < nodes.length; vi++) {
      var root = nodes[vi];
      if (visited[root]) continue;
      var stack = [[root, 0]], rootChildren = 0;
      parent[root] = null;
      while (stack.length) {
        var frame = stack[stack.length - 1], u = frame[0], ci = frame[1];
        if (ci === 0) { visited[u] = true; disc[u] = low[u] = ++timer; }
        var nbrs = adj[u];
        if (ci < nbrs.length) {
          frame[1]++;
          var w = nbrs[ci];
          if (!visited[w]) {
            parent[w] = u;
            if (u === root) rootChildren++;
            stack.push([w, 0]);
          } else if (w !== parent[u]) {
            low[u] = Math.min(low[u], disc[w]);
          }
        } else {
          stack.pop();
          var p = parent[u];
          if (p != null) {
            low[p] = Math.min(low[p], low[u]);
            if (p !== root && low[u] >= disc[p]) ap[p] = true;
          }
        }
      }
      if (rootChildren > 1) ap[root] = true;
    }
    var articulation = Object.keys(ap);
    var hubs = nodes.map(function (n) { return { id: n, degree: deg[n] }; })
      .sort(function (a, b) { return b.degree - a.degree; });
    return { nodeCount: nodes.length, edgeCount: edges.length, articulationNodes: articulation, topHubsByDegree: hubs };
  };

  // ════════════════════════════════════════════════════════════════════════════
  // COGNITION LOADERS — fallback entities, validated distress signals, real source
  // bundles, L1 mad-lib scan, macro-regime/business-cycle sub-portal. Each is one-shot + guarded.
  // ════════════════════════════════════════════════════════════════════════════

  // Real economy entities from command-board-data (state.companies starved). Guarded.
  EconomyBrain.prototype._loadEconomyCommandBoardCompanies = function () {
    var self = this;
    if (self._cbEconomyCompanies) return;            // one-shot
    self._cbEconomyCompanies = [];
    try {
      fetch('/assets/data/command-board-data.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data) return;
          var arr = Array.isArray(data) ? data : (Object.keys(data).map(function (k) { return data[k]; }).find(Array.isArray) || []);
          self._cbEconomyCompanies = arr
            .filter(function (x) { return x && x.d === 'economy' && x.t; })
            .map(function (x) { return { name: x.n, ticker: x.t, cik: x.c, phase: x.p, trajectory: x.tr }; });
        })
        .catch(function () {});
    } catch (e) {}
  };

  // Distress signals come ONLY from the validated Thing pipeline (/api/brain-signals).
  // NEVER from the raw command-board phase (noise). One-shot; {} if the gate abstains.
  EconomyBrain.prototype._loadEconomyBrainSignals = function () {
    var self = this;
    if (self._pubSignals) return;                   // one-shot
    self._pubSignals = {};
    try {
      fetch('/api/brain-signals?domain=economy')
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
  // else ECONOMY_DIAGNOSIS_ALIASES. Non-aliased diagnoses are canonical to themselves.
  var ECONOMY_DIAGNOSIS_ALIASES = {
    RECESSION:       { target: 'RECESSION', reviewStatus: 'corpus-aliased', risk: 'low', note: 'canonical demand-contraction / GDP-decline business-cycle downturn signature' },
    HYPERINFLATION:  { target: 'HYPERINFLATION', reviewStatus: 'corpus-aliased', risk: 'low', note: 'canonical sticky-CPI / services-inflation / price-rigidity signature' },
    BANKING_CRISIS:  { target: 'BANKING_CRISIS', reviewStatus: 'corpus-aliased', risk: 'low', note: 'canonical credit-tightening / lending-pullback macro-transmission signature' },
    TRADE_WAR:       { target: 'TRADE_WAR', reviewStatus: 'corpus-aliased', risk: 'low', note: 'canonical tariff-impact / import-export-disruption signature' },
    DEBT_CRISIS:     { target: 'DEBT_CRISIS', reviewStatus: 'corpus-aliased', risk: 'low', note: 'canonical sovereign-debt / fiscal-deficit / debt-service-burden signature' },
    MARKET_CRASH:    { target: 'MARKET_CRASH', reviewStatus: 'corpus-aliased', risk: 'low', note: 'canonical asset-collapse / wealth-destruction macro signature' }
  };
  EconomyBrain.prototype._resolveEconomyCanonicalDiagnosis = function (dxId) {
    if (!dxId) return { canonicalDiagnosisId: null, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };
    var target = null;
    try {
      var idx = (typeof window !== 'undefined') ? window.LIMENArtifactSourceIndex : null;
      if (idx && typeof idx.aliases === 'function') { var row = idx.aliases()[dxId]; if (row && row.target) target = row.target; }
    } catch (e) {}
    var local = ECONOMY_DIAGNOSIS_ALIASES[dxId] || null;
    if (!target && local && local.target !== dxId) target = local.target;
    if (target && target !== dxId) {
      return { canonicalDiagnosisId: target, aliasUsed: true, aliasReviewStatus: (local && local.reviewStatus) || 'corpus-aliased', aliasRisk: (local && local.risk) || 'low', aliasNote: (local && local.note) || null };
    }
    return { canonicalDiagnosisId: dxId, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };   // canonical to self
  };

  // Load REAL source bundles (one-shot, async). Resolves aliases BEFORE fetching.
  // Only files that exist resolve to 'found'; 404s -> 'missing'. Never fabricates.
  EconomyBrain.prototype._loadEconomyDiagnosisBundles = function () {
    var self = this;
    if (self._economyBundleLoadPromise) return self._economyBundleLoadPromise;
    self._bundleCache = self._bundleCache || {};
    self._bundleStatusMap = self._bundleStatusMap || {};
    var ids = {};
    var known = ['RECESSION', 'HYPERINFLATION', 'BANKING_CRISIS', 'TRADE_WAR', 'DEBT_CRISIS', 'MARKET_CRASH'];
    var diags = (self.state && self.state.diagnoses) || [];
    var allDxIds = diags.map(function (d) { return d.id; }).concat(known);
    for (var i = 0; i < allDxIds.length; i++) { var c = self._resolveEconomyCanonicalDiagnosis(allDxIds[i]).canonicalDiagnosisId; if (c) ids[c] = true; }
    self._economyBundleLoadPromise = Promise.all(Object.keys(ids).map(function (cid) {
      return fetch('/assets/data/artifact-source-index/by-diagnosis/' + encodeURIComponent(cid) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) { self._bundleStatusMap[cid] = data ? 'found' : 'missing'; if (data) self._bundleCache[cid] = data; })
        .catch(function () { self._bundleStatusMap[cid] = 'missing'; });
    })).then(function () { return self._bundleCache; });
    return self._economyBundleLoadPromise;
  };

  // _economyBundleStates — per-diagnosis canonical resolution + bundle status + provenance.
  EconomyBrain.prototype._economyBundleStates = function () {
    var self = this; var diags = (this.state && this.state.diagnoses) || [];
    return diags.map(function (d) {
      var c = self._resolveEconomyCanonicalDiagnosis(d.id);
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
  // Only real macro/market identifiers surface (relevance-unverified).
  var ECONOMY_MADLIB_VERB = /^(Develop|Establish|Implement|Build|Launch|Design|Deploy|Operationalize|Conduct|Create|Define|Assess|Optimize|Modernize|Strengthen|Enhance|Formalize|Institute|Standardize|Coordinate|Integrate|Calibrate|Evaluate|Streamline|Institutionalize|Configure|Monitor)\b/;
  EconomyBrain.prototype._isEconomyMadLibTreatment = function (label) { return !label || ECONOMY_MADLIB_VERB.test(String(label)); };

  EconomyBrain.prototype._loadEconomyL1PortalDepth = function () {
    var self = this;
    if (self._economyL1LoadPromise) return self._economyL1LoadPromise;
    var BRANCH = {
      RECESSION: ['demand', 'labor', 'macro-demand'],
      HYPERINFLATION: ['inflation', 'prices', 'cpi'],
      BANKING_CRISIS: ['credit', 'lending', 'macro-credit'],
      TRADE_WAR: ['trade', 'tariff', 'imports'],
      DEBT_CRISIS: ['fiscal', 'debt', 'sovereign'],
      MARKET_CRASH: ['markets', 'assets', 'wealth']
    };
    self._economyL1Branches = BRANCH;
    var branches = {}; Object.keys(BRANCH).forEach(function (dx) { BRANCH[dx].forEach(function (b) { branches[b] = true; }); });
    var byBranch = {};
    self._economyL1LoadPromise = Promise.all(Object.keys(branches).map(function (b) {
      return fetch('/assets/data/domains/economy_' + encodeURIComponent(b) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) {
          if (!data) { byBranch[b] = null; return; }
          var acts = data.activations || [], tickers = {}, total = 0, mad = 0;
          acts.forEach(function (a) {
            (a.companies || []).forEach(function (c) { if (c && c.ticker_or_id) tickers[c.ticker_or_id] = c.name || c.ticker_or_id; });
            (a.treatments || []).forEach(function (t) { var l = t && (t.label || t.title); if (l) { total++; if (self._isEconomyMadLibTreatment(l)) mad++; } });
          });
          byBranch[b] = { file: 'economy_' + b, companyTickers: Object.keys(tickers).map(function (k) { return { ticker: k, name: tickers[k] }; }), treatmentTotal: total, madLibCount: mad, realTreatmentCount: total - mad };
        })
        .catch(function () { byBranch[b] = null; });
    })).then(function () {
      var byDiagnosis = {};
      Object.keys(BRANCH).forEach(function (dx) {
        var tk = {}, total = 0, mad = 0, scanned = 0;
        BRANCH[dx].forEach(function (b) { var r = byBranch[b]; if (r) { scanned++; r.companyTickers.forEach(function (c) { tk[c.ticker] = c.name; }); total += r.treatmentTotal; mad += r.madLibCount; } });
        byDiagnosis[dx] = { branchesScanned: scanned, realCompanyTickers: Object.keys(tk).map(function (k) { return { ticker: k, name: tk[k], relevanceUnverified: true }; }), treatmentTotal: total, madLibTreatments: mad, realTreatments: total - mad, admitted: false, reason: 'L1 treatments are mad-lib templates (fixed-verb family) — not source-grade; only identifiers surfaced, relevance unverified' };
      });
      self.state._l1DepthCache = { byBranch: byBranch, byDiagnosis: byDiagnosis, scannedAt: (self.state.economyModel && self.state.economyModel.updated) || null };
      return self.state._l1DepthCache;
    });
    return self._economyL1LoadPromise;
  };

  // BUSINESS-CYCLE / MACRO-REGIME sub-portal layer (counterpart to energy's data-center; finance's credit).
  // Models the recession/expansion business cycle independent of the canonical 6-diagnosis spine.
  // Real-content, citation-backed; NEVER merged into the validated diagnosis spine; non-binding,
  // research-grade only. Graceful 404. Tracks business-cycle phase + macro indicators.
  EconomyBrain.prototype._loadMacroRegimeSublayer = function () {
    var self = this;
    if (self._macroRegimeLoadPromise) return self._macroRegimeLoadPromise;
    self._macroRegimeLoadPromise = fetch('/assets/data/domains/economy_macro-regime.json')
      .then(function (r) { return (r && r.ok) ? r.json() : null; })
      .then(function (data) { if (data) return data; return fetch('/assets/data/domains/economy_business-cycle.json').then(function (r2) { return (r2 && r2.ok) ? r2.json() : null; }); })
      .then(function (data) {
        if (!data) { self._macroRegimePortal = null; return null; }
        self._macroRegimePortal = { issues: data.issues || [], activations: data.activations || [], title: data.title || 'Business Cycle & Macro Regime' };
        return self._macroRegimePortal;
      })
      .catch(function () { self._macroRegimePortal = null; return null; });
    return self._macroRegimeLoadPromise;
  };

  // Infer the current business-cycle phase from the recurrent macro model + validated stress posture.
  EconomyBrain.prototype._inferBusinessCyclePhase = function () {
    var bm = this.state.brainEconomyModel || {};
    var stress = typeof this.state.stress === 'number' ? this.state.stress : 0;
    var momentum = bm.businessCycleMomentum || 'expansion';
    var recRisk = (typeof bm.recessionRisk === 'number') ? bm.recessionRisk : stress;
    var inverted = (bm.yieldCurve != null && bm.yieldCurve < 0);
    // early expansion / late expansion / peak / contraction / trough / recovery
    if (momentum === 'contraction') { return recRisk >= 0.75 ? 'trough' : 'contraction'; }
    if (momentum === 'stagnation') { return inverted ? 'peak' : 'late-expansion'; }
    // expansion
    if (recRisk <= 0.25) return 'early-expansion';
    if (inverted || stress >= 0.40) return 'late-expansion';
    return 'recovery';
  };

  EconomyBrain.prototype._buildMacroRegimeSublayer = function () {
    var self = this;
    var bm = self.state.brainEconomyModel || {};
    var phase = self._inferBusinessCyclePhase();
    var cp = self._macroRegimePortal;
    var macroIndicators = {
      yieldCurve: (bm.yieldCurve != null ? bm.yieldCurve : null),
      recessionRisk: (typeof bm.recessionRisk === 'number' ? bm.recessionRisk : null),
      employmentTrend: (bm.employmentTrend != null ? bm.employmentTrend : null),
      fiscalMonetaryState: bm.fiscalMonetaryState || 'unknown',
      fredSeriesActive: bm.fredSeriesActive || [],
      marketProxiesActive: bm.marketProxiesActive || []
    };
    if (!cp || !cp.issues || !cp.issues.length) {
      self.state.macroRegimeDiagnoses = [];
      self.state.macroRegimeTreatments = [];
      self.state.economyMacroRegimeDomainDiagnosisPackets = [];
      self.state.macroRegimeSublayer = { loaded: false, count: 0, activeCount: 0, activeDiagnoses: [], businessCyclePhase: phase, macroIndicators: macroIndicators, triggers: ['DGS10-FEDFUNDS < 0 (yield-curve inversion)', 'UNRATE rising (Sahm rule)', 'PMI < 50'], note: 'economy business-cycle/macro-regime sub-portal not loaded (offline or fetch failed); business-cycle phase inferred from the recurrent macro model; non-binding research-grade only' };
      return self.state.macroRegimeSublayer;
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
        source: 'macro-regime', tier: 'real-content-unbundled', branch: 'macro-regime'
      };
    });
    // 2) treatments — pull from macro-regime node activations whose brainNodeId is in a diagnosis circuit
    var nodeToDx = {};
    diagnoses.forEach(function (d) { (d.circuits || []).forEach(function (c) { if (c && c.nodeId) nodeToDx[c.nodeId] = d.id; }); });
    var treatments = [];
    (cp.activations || []).forEach(function (act) {
      var dxId = nodeToDx[act.brainNodeId];
      if (!dxId) return;
      (act.treatments || []).forEach(function (t, ti) {
        treatments.push({
          id: 'macro_treat_' + act.brainNodeId + '_' + ti,
          label: t.label, type: t.type, evidence: t.evidence, description: t.description || '',
          cite: t.cite || null, citation: t.citation || [], steps: t.steps || [],
          diagnosisId: dxId, nodeId: act.brainNodeId,
          source: 'macro-regime', madLib: self._isEconomyMadLibTreatment ? self._isEconomyMadLibTreatment(t.label) : false
        });
      });
    });
    var evidenceRank = { A: 10, Strong: 10, B: 7, Moderate: 7, C: 4, Emerging: 1 };
    treatments.sort(function (a, b) { return (evidenceRank[b.evidence] || 0) - (evidenceRank[a.evidence] || 0); });
    self.state.macroRegimeDiagnoses = diagnoses;
    self.state.macroRegimeTreatments = treatments;
    // 3) compact layer summary (read by every DDP's promptView)
    self.state.macroRegimeSublayer = {
      loaded: true,
      portalTitle: cp.title,
      businessCyclePhase: phase,                 // early-expansion / late-expansion / peak / contraction / trough / recovery
      macroIndicators: macroIndicators,
      count: diagnoses.length,
      activeCount: diagnoses.filter(function (d) { return d.active; }).length,
      activeDiagnoses: diagnoses.filter(function (d) { return d.active; }).map(function (d) { return d.id; }),
      triggers: ['DGS10-FEDFUNDS < 0 (yield-curve inversion)', 'UNRATE rising (Sahm rule)', 'PMI < 50'],
      diagnoses: diagnoses.map(function (d) {
        var rc = self._resolveEconomyCanonicalDiagnosis ? self._resolveEconomyCanonicalDiagnosis(d.id) : { canonicalDiagnosisId: d.id };
        var bsStat = (self._bundleStatusMap && self._bundleStatusMap[rc.canonicalDiagnosisId]) || 'missing';
        return { id: d.id, label: d.label, active: d.active, branch: 'macro-regime', canonicalDiagnosisId: rc.canonicalDiagnosisId, bundleStatus: bsStat, treatmentCount: treatments.filter(function (t) { return t.diagnosisId === d.id; }).length };
      }),
      note: 'real-content (business-cycle/macro-regime) sub-portal diagnoses (yield curve, PMI, credit spreads, unemployment trajectory, fiscal/monetary stance); SEPARATE from the validated diagnosis spine; non-binding research-grade; no external artifact-source bundle yet (bundleStatus=missing); never admitted to evidenceAnchors'
    };
    // 4) per-diagnosis DDPs via the SAME schema builder (canonical-to-self; bundle 'missing')
    self.state.economyMacroRegimeDomainDiagnosisPackets = diagnoses.map(function (d) {
      try { return self._buildDomainDiagnosisPacket(d); } catch (e) { return null; }
    }).filter(Boolean);
    return self.state.macroRegimeSublayer;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // H1-H6 — HIGHER ECONOMY BRAIN LAYERS (additive, domain-level). Computed once per cycle
  // BEFORE the DDP build; each emits a COMPACT summary the DDP embeds in promptView + the full
  // object in audit. Never fabricates evidence; intuition/simulation are labelled unverified/hypothetical.
  // ════════════════════════════════════════════════════════════════════════════
  EconomyBrain.prototype._computeEconomyHigherLayers = function () {
    this._computeEconomyImmune();
    this._computeEconomyAwareness();
    this._computeEconomyConscience();
    this._computeEconomyIntuition();
    try { this._computeEconomySimulation(); } catch (e) {}
    try { this._computeEconomyExecutiveReport(); } catch (e) {}
  };

  // H1 — immune (antigen scan over bundle/feed/regulation state)
  EconomyBrain.prototype._computeEconomyImmune = function () {
    var s = this.state, em = s.economyModel || {}, reg = em.regulation || {}, ant = [];
    var bs = (typeof this._economyBundleStates === 'function') ? this._economyBundleStates() : [];
    bs.forEach(function (b) {
      if (b.bundleStatus === 'missing') ant.push({ type: 'source-bundle-missing', dx: b.dxId, severity: 'medium', action: 'block-from-prompt-evidence' });
      if (b.buildMethod === 'external-source-authored') ant.push({ type: 'external-source-authored-needs-human-verification', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
      if (b.aliasRisk === 'medium' || b.aliasRisk === 'high') ant.push({ type: 'alias-risk-bundle', dx: b.dxId, severity: b.aliasRisk, action: 'allow-with-warning' });
      if (b.bundleStatus === 'found' && b.shallow) ant.push({ type: 'root-only-shallow-bundle', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
    });
    var pe = (em.predictionError && em.predictionError.total) || 0;
    if (pe > 0.4) ant.push({ type: 'prediction-error-spike', severity: 'medium', action: 'lower-confidence', value: Math.round(pe * 1000) / 1000 });
    if (reg.stale) ant.push({ type: 'stale-feeds', severity: 'low', action: 'flag' });
    if (reg.flooding) ant.push({ type: 'opportunity-flood', severity: 'medium', action: 'inhibit' });
    if (reg.starving) ant.push({ type: 'stress-without-opportunity', severity: 'low', action: 'flag' });
    var _l1 = s._l1DepthCache;
    if (_l1 && _l1.byDiagnosis && Object.keys(_l1.byDiagnosis).some(function (dx) { return _l1.byDiagnosis[dx].madLibTreatments > 0; })) {
      ant.push({ type: 'l1-synthetic-treatments', severity: 'medium', action: 'quarantine', note: 'L1 portal treatments are mad-lib templates (fixed-verb family); quarantined from evidence — only real identifiers surfaced relevance-unverified' });
    }
    var sev = ant.some(function (a) { return a.severity === 'high'; }) ? 'high' : ant.some(function (a) { return a.severity === 'medium'; }) ? 'medium' : ant.length ? 'low' : 'none';
    s.economyImmune = {
      version: 1, immuneState: sev === 'high' ? 'alert' : sev === 'medium' ? 'active' : sev === 'low' ? 'watch' : 'clear', severity: sev,
      antigens: ant.slice(0, 12),
      quarantines: ['L1-portal-treatments-madlib'],
      allowedWithWarning: ant.filter(function (a) { return a.action === 'allow-with-warning'; }).map(function (a) { return a.type + (a.dx ? (':' + a.dx) : ''); }),
      blockedFromPrompt: ant.filter(function (a) { return a.action === 'block-from-prompt-evidence'; }).map(function (a) { return a.dx; }),
      blockedFromTraversal: ['L2'],
      lastScanAt: em.updated || null
    };
    return s.economyImmune;
  };

  // H2 — awareness (narrative on GDP/inflation/employment/sentiment/credit/fiscal posture)
  EconomyBrain.prototype._computeEconomyAwareness = function () {
    var s = this.state, em = s.economyModel || {}, im = s.economyImmune || {}, bm = s.brainEconomyModel || {}, active = (s.diagnoses || []).filter(function (d) { return d.active; });
    var pe = (em.predictionError && em.predictionError.total) || 0, dxNames = active.map(function (d) { return d.label || d.id; });
    var obs = em.observation || {};
    var macroKnowns = [];
    if (obs.gdpGrowth != null) macroKnowns.push('GDP growth read live (GDPC1)');
    if (obs.inflationRate != null) macroKnowns.push('inflation read live (CPI/PCE)');
    if (obs.employmentTrend != null) macroKnowns.push('employment read live (UNRATE/PAYEMS)');
    if (obs.sentiment != null) macroKnowns.push('consumer sentiment read live (UMCSENT)');
    if (obs.yieldCurve != null) macroKnowns.push('yield curve ' + obs.yieldCurve + 'pp (DGS10-FEDFUNDS)');
    s.economyAwareness = {
      version: 1, selfState: im.immuneState === 'alert' ? 'guarded' : (em.regulation && em.regulation.state) || 'unknown',
      businessCyclePhase: (s.macroRegimeSublayer && s.macroRegimeSublayer.businessCyclePhase) || (typeof this._inferBusinessCyclePhase === 'function' ? this._inferBusinessCyclePhase() : null),
      knowns: dxNames.slice(0, 6).concat(macroKnowns).slice(0, 8),
      uncertainties: ['interpretive cognition layer — these higher-layer readings sit ALONGSIDE the validated P3 distress scorer, never replace it', 'macro indicators are FRED-anchored; fields without live data stay null (never fabricated)', 'predictionError=' + (Math.round(pe * 1000) / 1000)],
      confidenceDrivers: ['regulation ' + ((em.regulation && em.regulation.state) || '?'), active.length + ' active dx', (obs.fredSeriesActive || []).length + ' live FRED series'],
      selfNarrative: 'Economy: ' + active.length + ' active diagnosis pathway' + (active.length !== 1 ? 's' : '') + ' (' + (dxNames.slice(0, 3).join(', ') || 'none') + '), business cycle=' + ((s.macroRegimeSublayer && s.macroRegimeSublayer.businessCyclePhase) || '?') + ', fiscal/monetary=' + (bm.fiscalMonetaryState || '?') + ', regulation=' + ((em.regulation && em.regulation.state) || '?') + ', immune=' + (im.immuneState || '?') + ', prediction-error ' + (Math.round(pe * 100) / 100) + '.',
      lastAwarenessAt: em.updated || null
    };
    return s.economyAwareness;
  };

  // H3 — conscience (artifact readiness; ECONOMY does INVESTABLE/RESEARCHABLE only — no patent/grant)
  EconomyBrain.prototype._computeEconomyConscience = function () {
    var s = this.state, em = s.economyModel || {}, pe = (em.predictionError && em.predictionError.total) || 0, cautions = [];
    if (pe > 0.4) cautions.push({ claim: 'high-confidence-claim', reason: 'predictionError spike ' + (Math.round(pe * 1000) / 1000) });
    s.economyConscience = {
      version: 1, conscienceState: 'restrictive',
      vetoes: [{ claim: 'patent/grant', reason: 'macroeconomic diagnoses have no method/embodiment; patent/grant lanes retired 2026-06-21' }],
      cautions: cautions.slice(0, 8),
      allowedClaims: ['source-summary', 'economy-brief-with-warnings'],
      blockedClaims: ['patent-claim', 'grant-claim'],
      artifactReadinessDecision: { patentReady: false, grantReady: false, investmentReady: true, researchReady: true, note: 'patent/grant vetoed; investment/research allowed-with-warning' },
      reasons: ['overclaim prevention', 'cognition-layer is interpretive (the validated P3 scorer is the only certified path)'],
      lastCheckAt: em.updated || null
    };
    return s.economyConscience;
  };

  // H4 — intuition (hunches on emerging regime shifts / novel macro stressors; NOT evidence)
  EconomyBrain.prototype._computeEconomyIntuition = function () {
    var s = this.state, em = s.economyModel || {}, reg = em.regulation || {}, log = (s.memory && s.memory.outcomeLog) || [], hunches = [];
    if (log.length >= 2) { var a = log[log.length - 2].predictionError, b = log[log.length - 1].predictionError; if (typeof a === 'number' && typeof b === 'number' && b - a > 0.05) hunches.push({ hunch: 'macroeconomic regime shift forming (prediction error rising) — emerging recession/inflation stressor', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'predictionError rose ' + a + ' → ' + b }); }
    if (reg.state === 'surprised') hunches.push({ hunch: 'novel macro stressor entering the system (demand collapse / inflation spike / fiscal shock)', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'regulation = surprised' });
    // Cross-regime analogies (recessions ↔ hyperinflation ↔ credit crises) — interpretive only.
    var FAMILY = { 'contraction': ['RECESSION', 'MARKET_CRASH', 'DEBT_CRISIS'], 'inflation': ['HYPERINFLATION'], 'credit': ['BANKING_CRISIS'], 'external': ['TRADE_WAR'] };
    var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var primaryId = (active[0] || {}).id, analogies = [];
    Object.keys(FAMILY).forEach(function (fam) { if (FAMILY[fam].indexOf(primaryId) >= 0) { FAMILY[fam].forEach(function (sib) { if (sib !== primaryId) analogies.push({ analogy: primaryId + ' resembles ' + sib, family: fam, evidenceStatus: 'UNVERIFIED' }); }); } });
    // Macro cross-regime analogy that always holds interpretively (1970s stagflation ↔ Weimar hyperinflation ↔ 2008 credit crisis)
    analogies.push({ analogy: 'recession ↔ hyperinflation ↔ credit-crisis are distinct macro-regime attractors that can co-occur (stagflation)', family: 'macro-regime', evidenceStatus: 'UNVERIFIED' });
    s.economyIntuition = { version: 1, hunches: hunches.slice(0, 6), analogies: analogies.slice(0, 6), lastAt: em.updated || null };
    return s.economyIntuition;
  };

  // H5 — bounded counterfactual simulation (hypothetical only; UNVERIFIED). MACRO scenarios.
  EconomyBrain.prototype._computeEconomySimulation = function () {
    var s = this.state, em = s.economyModel || {};
    var base = typeof s.stress === 'number' ? s.stress : 0;
    function cl(v) { return Math.max(0, Math.min(1, Math.round(v * 1000) / 1000)); }
    var scenarios = [
      { type: 'demand_collapse', hypothetical: true, assumption: 'consumer + business demand contracts sharply (negative GDP prints, rising unemployment)', simulatedStress: cl(base + 0.3), risk: 'RECESSION (demand contraction / output gap widens)', intervention: 'fiscal stimulus + monetary easing (rate cuts / QE)', falsifier: 'GDPC1 stays positive; UNRATE stable' },
      { type: 'stagflation', hypothetical: true, assumption: 'inflation stays sticky while growth stalls (1970s-style)', simulatedStress: cl(base + 0.3), risk: 'HYPERINFLATION + RECESSION (policy is conflicted; CPI hot, growth flat)', intervention: 'supply-side reform + credible disinflation path (Volcker-style)', falsifier: 'CPI cools without a growth collapse' },
      { type: 'credit_drought', hypothetical: true, assumption: 'lending standards tighten and credit transmits a macro slowdown', simulatedStress: cl(base + 0.25), risk: 'BANKING_CRISIS transmission (credit tightening throttles real economy)', intervention: 'central-bank liquidity + targeted lending facilities', falsifier: 'SLOOS shows no tightening; loan growth positive' },
      { type: 'fiscal_shock', hypothetical: true, assumption: 'a sovereign-debt / fiscal-deficit spiral raises debt-service burden', simulatedStress: cl(base + 0.3), risk: 'DEBT_CRISIS (downgrade risk, crowding out, fiscal dominance)', intervention: 'fiscal consolidation + credible debt path / multilateral backstop', falsifier: 'debt-to-GDP stabilizes; yields compress' },
      { type: 'trade_war_escalation', hypothetical: true, assumption: 'tariffs escalate and import/export flows disrupt', simulatedStress: cl(base + 0.2), risk: 'TRADE_WAR (supply-chain cost-push + demand drag)', intervention: 'trade de-escalation / supply diversification / targeted relief', falsifier: 'trade volumes recover; tariff schedule rolls back' }
    ];
    var sim = {
      version: 1, scenarios: scenarios, assumptions: scenarios.map(function (x) { return x.assumption; }),
      simulatedStress: scenarios.map(function (x) { return x.simulatedStress; }),
      simulatedDiagnoses: ['RECESSION', 'HYPERINFLATION', 'BANKING_CRISIS', 'DEBT_CRISIS', 'TRADE_WAR'], simulatedOpportunities: [],
      risks: scenarios.map(function (x) { return x.risk; }), interventions: scenarios.map(function (x) { return x.intervention; }),
      falsifiers: scenarios.map(function (x) { return x.falsifier; }),
      // Macro themes use broad-market proxies + FRED series, NEVER single-company tickers.
      themeIndicators: ['SPY', 'DIA', 'TLT', 'GLD', 'GDPC1', 'CPIAUCSL', 'UNRATE', 'DGS10', 'FEDFUNDS', 'M2SL'],
      lastSimulatedAt: em.updated || null
    };
    s.economySimulation = sim; return sim;
  };

  // H6 — executive self-report (compact status card)
  EconomyBrain.prototype._computeEconomyExecutiveReport = function () {
    var s = this.state, em = s.economyModel || {}, im = s.economyImmune || {}, aw = s.economyAwareness || {}, con = s.economyConscience || {}, it = s.economyIntuition || {}, sim = s.economySimulation || {}, bm = s.brainEconomyModel || {};
    var bs = (typeof this._economyBundleStates === 'function') ? this._economyBundleStates() : [];
    var covered = bs.filter(function (b) { return b.bundleStatus === 'found'; }).length;
    var hv = bs.filter(function (b) { return b.humanVerification === 'required'; }).length;
    var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var strongest = active[0] || (s.diagnoses || [])[0] || null;
    var pe = (em.predictionError && em.predictionError.total) || 0;
    var status = im.immuneState === 'alert' ? 'immune-alert' : hv > 0 ? 'human-review-required' : (bs.length && covered < bs.length) ? 'source-limited' : (em.regulation && em.regulation.starving) ? 'starving' : (em.regulation && em.regulation.state === 'surprised') ? 'surprised' : 'healthy';
    var rep = {
      version: 1, brainStatus: status,
      businessCyclePhase: (s.macroRegimeSublayer && s.macroRegimeSublayer.businessCyclePhase) || null,
      recessionRisk: (typeof bm.recessionRisk === 'number' ? bm.recessionRisk : null),
      strongestDiagnosis: strongest ? strongest.id : null,
      strongestOpportunity: (s.opportunities && s.opportunities[0] && s.opportunities[0].title) || null,
      confidence: Math.round((1 - pe) * 100) / 100, predictionError: Math.round(pe * 1000) / 1000,
      regulationState: (em.regulation && em.regulation.state) || null, immuneState: im.immuneState || null,
      awarenessSummary: aw.selfNarrative || null, conscienceDecision: con.conscienceState || null,
      intuitionSummary: (it.hunches || []).length + ' hunch(es)', simulationSummary: (sim.scenarios || []).length + ' scenario(s)',
      artifactReadiness: con.artifactReadinessDecision || null, blockers: (con.blockedClaims || []).slice(0, 6),
      nextBestAction: (bs.length && covered < bs.length) ? 'build/verify source for uncovered diagnoses' : hv > 0 ? 'human-verify external-source bundles' : 'monitor strongest diagnosis sources (FRED: GDPC1/CPIAUCSL/UNRATE/PAYEMS/FEDFUNDS/DGS10/UMCSENT + market proxies SPY/DIA/TLT/GLD)',
      lastReportAt: em.updated || null
    };
    s.economyExecutiveReport = rep; return rep;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // DDP — the 8-section DomainDiagnosisPacket the Civilization cockpit consumes.
  // Mirrors energy/finance _buildDomainDiagnosisPacket exactly; only the CONTENT is macroeconomic.
  // Schema-only: never invents data. Absent fields are EXPLICIT null / [] / 'missing'.
  // evidenceAnchors map to REAL FRED series + broad-market proxies (never single-company tickers).
  // ════════════════════════════════════════════════════════════════════════════
  var ECONOMY_DDP_SCHEMA_VERSION = 'economy-ddp-1';
  function _economyDdpPresent(v) {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (v === 'missing' || v === '' || v === 'none') return false;
    return true;
  }
  function _economyDdpCompleteness(section, keys) {
    var have = 0; for (var i = 0; i < keys.length; i++) { if (_economyDdpPresent(section[keys[i]])) have++; }
    return { have: have, total: keys.length, pct: keys.length ? Math.round(have / keys.length * 100) : 0 };
  }
  EconomyBrain.prototype._buildDomainDiagnosisPacket = function (dx) {
    var s = this.state || {};
    var em = s.economyModel || {};
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

    var _canon = this._resolveEconomyCanonicalDiagnosis(dxId);
    var identity = {
      domain: 'economy',
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
      economyModel: { version: em.version || null, cycle: (typeof em.cycle === 'number' ? em.cycle : null) },
      brainEconomyModel: s.brainEconomyModel || null,
      predictionError: em.predictionError || null,
      regulationState: (em.regulation && em.regulation.state) || null,
      prior: em.prior || null,
      observation: em.observation || null,
      plasticity: em.plasticity || null,
      readyForHandoff: em.readyForHandoff === true
    };
    var rootId = (portal && portal.domainId) || 'economy';
    var rootTitle = (portal && portal.title) || 'Economy';
    var ancestry = (portal && portal.parentLabel) ? [portal.parentLabel, rootTitle] : [rootTitle];
    var portalContext = {
      portalIds: [rootId],
      portalDomain: 'economy',
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
    // evidenceAnchors — REAL FRED series + broad-market proxies mapped per diagnosis (never single-company tickers, never fabricated).
    var _EV_ANCHOR_HINT = {
      RECESSION: ['GDPC1', 'GDP', 'UNRATE', 'PAYEMS', 'INDPRO', 'UMCSENT', 'SPY', 'DIA'],
      HYPERINFLATION: ['CPIAUCSL', 'PCEPI', 'M2SL', 'FEDFUNDS', 'DGS10', 'GLD', 'TLT'],
      BANKING_CRISIS: ['FEDFUNDS', 'DGS10', 'M2SL', 'TLT', 'INDPRO'],
      TRADE_WAR: ['INDPRO', 'CPIAUCSL', 'GDPC1', 'DIA', 'SPY'],
      DEBT_CRISIS: ['DGS10', 'FEDFUNDS', 'GDP', 'TLT', 'GLD'],
      MARKET_CRASH: ['SPY', 'DIA', 'TLT', 'GLD', 'UMCSENT', 'DGS10']
    };
    var evidenceAnchors = _bArr('evidenceAnchors');
    if (!evidenceAnchors.length) {
      var _hintIds = _EV_ANCHOR_HINT[identity.canonicalDiagnosisId] || [];
      evidenceAnchors = _hintIds.map(function (id) {
        var live = (em.observation && Array.isArray(em.observation.fredSeriesActive) && em.observation.fredSeriesActive.indexOf(id) !== -1) ||
                   (em.observation && Array.isArray(em.observation.marketProxiesActive) && em.observation.marketProxiesActive.indexOf(id) !== -1);
        return { id: id, type: (EM_MARKET_PROXIES.indexOf(id) !== -1 ? 'broad-market-proxy' : 'FRED-series'), live: !!live, relevanceUnverified: true, note: 'canonical macro indicator (no source-bundle yet; never fabricated; live=' + (!!live) + ')' };
      });
    }
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
      RECESSION: 'BEA GDP (GDPC1) / BLS employment (UNRATE/PAYEMS) / FRED INDPRO / NBER recession dating / U Mich sentiment (UMCSENT)',
      HYPERINFLATION: 'BLS CPI (CPIAUCSL) / BEA PCE (PCEPI) / Fed M2 (M2SL) / FOMC FEDFUNDS / Treasury DGS10',
      BANKING_CRISIS: 'Fed SLOOS / H.8 lending data / FRED credit spreads / FEDFUNDS / DGS10 (macro-transmission, not bank-level)',
      TRADE_WAR: 'Census trade balance / BEA net exports / USTR tariff schedule / FRED INDPRO',
      DEBT_CRISIS: 'Treasury debt-to-GDP / CBO fiscal outlook / FRED DGS10 / FEDFUNDS / sovereign rating actions',
      MARKET_CRASH: 'FRED broad-market proxies (SPY/DIA via Wilshire) / U Mich sentiment / DGS10 / TLT-GLD risk-off proxies'
    };
    var authoringIntake = [];
    if (_isExternal) {
      ['methodCandidates', 'embodimentCandidates', 'figurePlaceholders'].forEach(function (field) {
        if (_bArr(field).length === 0) authoringIntake.push({ field: field, status: 'needs-human-input', count: 0, need: field === 'methodCandidates' ? 'a concrete macroeconomic surveillance/forecasting method drawn from a primary source' : field === 'embodimentCandidates' ? 'a specific implementation/embodiment from a real document' : 'a figure description grounded in a real source', sourceHint: _intakeSrcHint[identity.canonicalDiagnosisId] || 'primary government / macroeconomic-statistical source (BEA/BLS/Fed/Treasury/Census)', note: 'NOT fabricated by the brain — author from the cited source, then wire in verbatim with attribution' });
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
      identity:         _economyDdpCompleteness(identity, ['domain', 'diagnosisId', 'canonicalDiagnosisId', 'label', 'phase', 'confidence']),
      brainState:       _economyDdpCompleteness(brainState, ['economyModel', 'predictionError', 'regulationState', 'prior', 'observation', 'plasticity']),
      portalContext:    _economyDdpCompleteness(portalContext, ['portalIds', 'portalDomain', 'portalTitle', 'depth', 'ancestryPath']),
      evidence:         _economyDdpCompleteness(evidence, ['sourceFeeds', 'evidenceAnchors', 'citationHints']),
      treatmentContext: _economyDdpCompleteness(treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']),
      operatorContext:  _economyDdpCompleteness(operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']),
      artifactContext:  _economyDdpCompleteness(artifactContext, ['artifactLanes'])
    };
    var totHave = 0, totAll = 0;
    for (var sk in comp) { if (comp.hasOwnProperty(sk)) { totHave += comp[sk].have; totAll += comp[sk].total; } }
    var missingFields = [];
    function _emf(name, obj, keys) { for (var i = 0; i < keys.length; i++) { if (!_economyDdpPresent(obj[keys[i]])) missingFields.push(name + '.' + keys[i]); } }
    _emf('identity', identity, ['canonicalDiagnosisId', 'confidence']);
    _emf('evidence', evidence, ['evidenceAnchors', 'citationHints']);
    _emf('treatmentContext', treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']);
    _emf('operatorContext', operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']);

    var warnings = [];
    if (portalContext.portalStatus === 'root-only') warnings.push('portalContext is root-only (no deep portal cortex)');
    if (portalContext.portalStatus === 'pending') warnings.push('root portal not yet cached on the brain (domain identity used)');
    if (identity.aliasUsed) warnings.push('alias-resolved; verify source appropriateness');
    if (bundleStatus === 'missing') warnings.push('source bundle missing (no artifact-source bundle for this diagnosis; evidenceAnchors are canonical FRED/market indicators, relevance-unverified)');
    if (bundleStatus === 'unknown') warnings.push('source bundle not yet checked');
    if (bundleStatus === 'found' && _bundle && _bundle.buildMethod === 'external-source-authored') warnings.push('external-source-authored; human-verification-required (' + (_bundle.humanVerification || 'required') + ')');
    else if (bundleStatus === 'found' && bundleShallow) warnings.push('source-bundle-root-only (real bundle but portalCount<=1 / maxDepth 0)');
    var _emptyCand = [];
    if (!treatmentContext.methodCandidates.length) _emptyCand.push('method');
    if (!treatmentContext.mechanismCandidates.length) _emptyCand.push('mechanism');
    if (!treatmentContext.embodimentCandidates.length) _emptyCand.push('embodiment');
    if (!treatmentContext.figurePlaceholders.length) _emptyCand.push('figure');
    if (_emptyCand.length) warnings.push((bundleStatus === 'found' ? 'bundle found but ' : 'no bundle — ') + 'candidate types still empty: ' + _emptyCand.join(',') + ' (not invented)');
    if (!primaryOpp && (typeof s.stress !== 'number' || s.stress < EM_STRESS_FLOOR)) warnings.push('no active opportunity (offline/low-stress) — operator/lane fields stay empty');
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
        'diagnosis-specific bundle anchors preferred over generic macro evidence',
        'official/primary macro sources retained (BEA/BLS/Fed/Treasury/Census/FRED where present)',
        'mechanisms prioritized over figures under prompt-space limits',
        'treatments with implementation relevance preferred over broad narrative',
        'caps applied per field; full data preserved in the stored bundle + full DDP'
      ],
      retainedWarnings: warnings
        .concat(s.economyImmune ? ['immune: ' + s.economyImmune.immuneState + ' (sev ' + s.economyImmune.severity + ', ' + (s.economyImmune.antigens || []).length + ' antigens; L2 traversal blocked)'] : [])
        .concat(s.economyConscience && s.economyConscience.conscienceState === 'restrictive' ? ['conscience: ' + (s.economyConscience.blockedClaims || []).slice(0, 3).join(', ') + ' blocked'] : []),
      retainedBlockers: artifactContext.blockers,
      immuneSummary: s.economyImmune ? { immuneState: s.economyImmune.immuneState, severity: s.economyImmune.severity, antigenCount: (s.economyImmune.antigens || []).length, quarantines: s.economyImmune.quarantines, blockedFromTraversal: s.economyImmune.blockedFromTraversal, allowedWithWarning: s.economyImmune.allowedWithWarning } : null,
      awarenessSummary: s.economyAwareness ? { selfNarrative: s.economyAwareness.selfNarrative, knowns: (s.economyAwareness.knowns || []).length, uncertainties: (s.economyAwareness.uncertainties || []).length } : null,
      conscienceDecision: s.economyConscience ? { conscienceState: s.economyConscience.conscienceState, blockedClaims: s.economyConscience.blockedClaims, artifactReadinessDecision: s.economyConscience.artifactReadinessDecision } : null,
      intuitionSummary: s.economyIntuition ? s.economyIntuition.hunches : null,
      scenarioSummary: s.economySimulation ? (s.economySimulation.scenarios || []).map(function (x) { return { type: x.type, hypothetical: x.hypothetical, risk: x.risk }; }) : null,
      executiveReport: s.economyExecutiveReport || null,
      l1DepthSummary: portalContext.l1Depth ? { realCompanyTickers: (portalContext.l1Depth.realCompanyTickers || []).length, realTreatments: portalContext.l1Depth.realTreatments, madLibTreatments: portalContext.l1Depth.madLibTreatments, admitted: portalContext.l1Depth.admitted } : null,
      authoringIntake: treatmentContext.authoringIntake.length ? treatmentContext.authoringIntake : null,
      // BUSINESS-CYCLE / MACRO-REGIME — sub-portal layer (real-content, SEPARATE from the validated spine, no bundle yet)
      macroSummary: s.macroRegimeSublayer ? { loaded: !!s.macroRegimeSublayer.loaded, businessCyclePhase: s.macroRegimeSublayer.businessCyclePhase, count: s.macroRegimeSublayer.count || 0, activeCount: s.macroRegimeSublayer.activeCount || 0, macroIndicators: s.macroRegimeSublayer.macroIndicators, diagnoses: s.macroRegimeSublayer.diagnoses || [], note: s.macroRegimeSublayer.note } : null,
      macroModelSummary: s.brainEconomyModel ? { businessCycleMomentum: s.brainEconomyModel.businessCycleMomentum, fiscalMonetaryState: s.brainEconomyModel.fiscalMonetaryState, recessionRisk: s.brainEconomyModel.recessionRisk } : null
    };

    return {
      schemaVersion: ECONOMY_DDP_SCHEMA_VERSION,
      promptView: promptView,
      identity: identity,
      brainState: brainState,
      portalContext: portalContext,
      evidence: evidence,
      treatmentContext: treatmentContext,
      operatorContext: operatorContext,
      artifactContext: artifactContext,
      audit: {
        generatedAt: (em.updated || null),
        schemaVersion: ECONOMY_DDP_SCHEMA_VERSION,
        fieldCompleteness: { sections: comp, overallPct: pct },
        missingFields: missingFields,
        warnings: warnings,
        proofTier: proofTier,
        immune: s.economyImmune || null,
        awareness: s.economyAwareness || null,
        conscience: s.economyConscience || null,
        intuition: s.economyIntuition || null,
        simulation: s.economySimulation || null,
        executiveReport: s.economyExecutiveReport || null
      }
    };
  };

  // ══════════════════════════════════════════════════════════════════════
  // INSTANTIATE AND REGISTER
  // ══════════════════════════════════════════════════════════════════════

  var brain = new EconomyBrain();
  brain.init();
  brain.start();
  window.LIMENEconomyBrain = brain;
  window.LIMENDomainBrains.register(brain);

  // ══════════════════════════════════════════════════════════════════════
  // AUTO-LOAD ECONOMY OPERATOR STACK
  // ══════════════════════════════════════════════════════════════════════

  var _isDomainConsole = window.location.pathname.indexOf('domain-console') !== -1;
  var _isEconomyDomain = (new URLSearchParams(window.location.search)).get('domain') === 'economy';
  if (_isDomainConsole && _isEconomyDomain) {
    window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION = true;
    var _economyScripts = [
      'assets/js/economy-compensation.js',
      'assets/js/economy-claim-ledger.js',
      'assets/js/economy-claim-flow.js',
      'assets/js/economy-opportunity-economics.js',
      'assets/js/economy-pulse-engine.js',
      'assets/js/economy-operator-panel.js',
      'assets/js/economy-node-business-engine.js',
      'assets/js/economy-business-review.js',
      'assets/js/economy-execution-panels.js',
      'assets/js/economy-business-build.js',
      'assets/js/economy-directive-extractor.js',
      'assets/js/economy-directive-ranker.js',
      'assets/js/economy-directive-translator.js',
      'assets/js/economy-targeting-engine.js',
      'assets/js/economy-promotion-bridge.js',
      'assets/js/economy-clarity-operator.js'
    ];
    (function loadNext(i) {
      if (i >= _economyScripts.length) return;
      var s = document.createElement('script');
      s.src = _economyScripts[i];
      s.onload = function () { loadNext(i + 1); };
      s.onerror = function () { console.warn('[EconomyBrain] Failed to load ' + _economyScripts[i]); loadNext(i + 1); };
      document.head.appendChild(s);
    })(0);
  }
})();
