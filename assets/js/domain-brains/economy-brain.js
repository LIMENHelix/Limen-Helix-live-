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
    Base.call(this, {
      domainId: 'economy',
      label: 'Economy',
      snapshotKey: 'economy',
      cycleInterval: 30000
    });
  }

  EconomyBrain.prototype = Object.create(Base.prototype);
  EconomyBrain.prototype.constructor = EconomyBrain;

  // ══════════════════════════════════════════════════════════════════════
  // INIT — register diagnosis index and emission rules
  // ══════════════════════════════════════════════════════════════════════

  EconomyBrain.prototype.init = function () {
    Base.prototype.init.call(this);

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
          var sigAge = sig.timestamp ? (now - new Date(sig.timestamp).getTime()) : Infinity;
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
    if (this.state.stress >= 0.65) this._activeConditions.push('economy_high_stress');
    if (this.state.stress >= 0.75) {
      this._activeConditions.push('_stress_capital_flag');
    }
    if (this.state.maturity === 'STRUCTURAL') this._activeConditions.push('structural_stress');

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
        add({ title: dxLabel + ' — labor and productivity platform demand', rank: stress * dx.relevance * 0.9, path: 'PATENTABLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      }

      if (stress >= 0.55 && dx.relevance >= 0.2) {
        add({ title: dxLabel + ' — inflation defense and margin protection', rank: stress * 0.85, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
      }

      add({ title: dxLabel + ' — essential-goods resilience and consumer staples rotation', rank: stress * dx.relevance * 0.75, path: 'INVESTABLE', urgency: 'medium', source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress });
    }

    // Terminal companies
    var terminalCompanies = [] /* neutralized: distress only from validated gate (see energy-brain) */;
    if (terminalCompanies.length > 0) {
      add({ title: 'Economy terminal entity distressed positioning', rank: 0.95, path: 'INVESTABLE', urgency: 'high', source: 'company_terminal', tier: 1, companies: terminalCompanies.map(function (c) { return c.ticker; }), stress: stress });
    }

    var stressedCompanies = [] /* neutralized: distress only from validated gate */;
    if (stressedCompanies.length >= 2 && stress >= 0.50) {
      add({ title: 'Economy stressed-but-operating entity selection', rank: stress * 0.80, path: 'INVESTABLE', urgency: 'medium', source: 'company_stressed', tier: 1, companies: stressedCompanies.slice(0, 5).map(function (c) { return c.ticker; }), stress: stress });
    }

    if (this.state.convergence && this.state.convergence.primary_signal) {
      add({ title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — economy convergence response', rank: 0.98, path: this.state.convergence.primary_signal === 'CONVERGENCE_TERMINAL' ? 'INVESTABLE' : 'GRANT-ELIGIBLE', urgency: 'high', source: 'convergence', tier: 1, signal: this.state.convergence.primary_signal, stress: stress });
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
      add({ title: 'Consumer demand infrastructure — essential goods distribution', rank: stress * 0.75, path: 'GRANT-ELIGIBLE', urgency: stress > 0.70 ? 'high' : 'medium', source: 'lagging', tier: 3, diagnosisId: 'consumer_infra', stress: stress });
      add({ title: 'Macro bottleneck positioning — structural economic gaps', rank: stress * 0.72, path: 'PATENTABLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'macro_bottleneck', stress: stress });
      add({ title: 'Workforce redeployment — retraining and labor mobility platforms', rank: stress * 0.68, path: 'GRANT-ELIGIBLE', urgency: 'medium', source: 'lagging', tier: 3, diagnosisId: 'workforce_redeploy', stress: stress });
    }

    // Near-diagnosis
    var nearDx = allDx.filter(function (d) { return !d.active && d.relevance > 0 && d.totalTriggers > 0; });
    for (var ndi = 0; ndi < nearDx.length; ndi++) {
      var nd = nearDx[ndi];
      if (stress >= 0.45) {
        add({ title: (nd.label || nd.id || '').replace(/_/g, ' ') + ' — early-stage monitoring position', rank: stress * (nd.relevance || 0.1) * 0.5, path: 'PATENTABLE', urgency: 'watching', source: 'near_diagnosis', tier: 2, diagnosisId: nd.id, stress: stress });
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
    var _COMP = {
      'GRANT-ELIGIBLE': { type: 'grant',  base: 10, unit: '%',        tier: 1, nextTier: { tier: 2, comp: 15, requirement: '3 successful grant awards' },     maxTier: { tier: 3, comp: 25 } },
      'INVESTABLE':     { type: 'invest', base: 5,  unit: 'profit%',  tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
      'PATENTABLE':     { type: 'patent', base: 10, unit: 'royalty%', tier: 1, nextTier: { tier: 2, comp: 15, requirement: '3 patents filed' },                maxTier: { tier: 3, comp: 25 } }
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
        else if (o.path === 'GRANT-ELIGIBLE' && pb.realWorld && pb.realWorld.apply) target = pb.realWorld.apply;
        else if (o.path === 'PATENTABLE' && pb.realWorld && pb.realWorld.build) target = pb.realWorld.build;
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
