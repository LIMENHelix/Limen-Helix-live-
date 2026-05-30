/**
 * trade-brain.js — Trade / Supply Chain Domain Cognitive Engine
 *
 * Extends DomainBrainBase. Same architecture as energy-brain.js / finance-brain.js.
 *
 * Diagnosis matching: maps live signal conditions to trade portal issues
 *   SUPPLY_CHAIN_COLLAPSE → shortage, production halt, sourcing disruption, critical material
 *   PORT_BLOCKADE → port congestion, shipping delays, route constraint
 *   TRADE_WAR → tariff escalation, sanctions, trade restriction, retaliatory measures
 *   SHIPPING_CRISIS → freight cost spike, container shortage, carrier capacity
 *   CUSTOMS_DISRUPTION → customs delay, clearance failure, regulatory friction
 *
 * Cross-domain emissions:
 *   trade → finance (margin compression / cost transmission)
 *   trade → energy (fuel logistics sensitivity)
 *   trade → infrastructure (transport throughput strain)
 *   trade → agriculture (food supply chain stress)
 *
 * Exposes: window.LIMENSupplyChainBrain
 */
(function () {
  'use strict';

  if (!window.LIMENDomainBrainBase) {
    console.warn('[TradeBrain] DomainBrainBase not loaded');
    return;
  }

  var Base = window.LIMENDomainBrainBase;

  function TradeBrain() {
    Base.call(this, {
      domainId: 'supplyChain',
      label: 'Supply Chain',
      snapshotKey: 'supplyChain',
      portalKey: 'trade',
      cycleInterval: 30000
    });
  }

  TradeBrain.prototype = Object.create(Base.prototype);
  TradeBrain.prototype.constructor = TradeBrain;

  // ══════════════════════════════════════════════════════════════════════
  // INIT — register diagnosis index and emission rules
  // ══════════════════════════════════════════════════════════════════════

  TradeBrain.prototype.init = function () {
    Base.prototype.init.call(this);

    // Keys MUST match portal issue IDs in trade.json
    this.diagnosisIndex = {
      'SUPPLY_CHAIN_COLLAPSE':  ['shortage', 'production_halt', 'sourcing_disruption', 'critical_material', 'supply_high_stress', 'structural_stress', 'macro_shock'],
      'PORT_BLOCKADE':          ['port_congestion', 'shipping_delay', 'route_constraint', 'port_closure', 'chokepoint'],
      'TRADE_WAR':              ['tariff_escalation', 'sanctions', 'trade_restriction', 'retaliatory_measures', 'export_ban', 'macro_shock'],
      'SHIPPING_CRISIS':        ['freight_cost_spike', 'container_shortage', 'carrier_capacity', 'shipping_delay', 'supply_high_stress'],
      'CUSTOMS_DISRUPTION':     ['customs_delay', 'clearance_failure', 'regulatory_friction', 'documentation_backlog']
    };

    this.emissionRules = [
      {
        targetDomain: 'finance',
        signalType: 'margin_compression',
        condition: function (s) { return s.stress >= 0.55; },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); }
      },
      {
        targetDomain: 'energy',
        signalType: 'fuel_logistics_sensitivity',
        condition: function (s) { return s.stress >= 0.50; },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); }
      },
      {
        targetDomain: 'infrastructure',
        signalType: 'transport_throughput_strain',
        condition: function (s) { return s.stress >= 0.55; },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); }
      },
      {
        targetDomain: 'agriculture',
        signalType: 'food_supply_chain_stress',
        condition: function (s) { return s.stress >= 0.50; },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.4); }
      }
    ];
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 2: Normalize signals into trade-native semantics
  // ══════════════════════════════════════════════════════════════════════

  TradeBrain.prototype.normalizeSignals = function () {
    var signals = [];
    var rawSignals = (this._rawDomain && this._rawDomain.signals) || [];

    for (var i = 0; i < rawSignals.length; i++) {
      signals.push(rawSignals[i]);
    }

    this._activeConditions = [];

    // Check feed values for trade-specific triggers
    var feeds = this.state.feeds;
    for (var fi = 0; fi < feeds.length; fi++) {
      var f = feeds[fi];
      // Freight PPI / shipping cost indicators
      if (f.name && (f.name.indexOf('Freight') !== -1 || f.name.indexOf('PPI') !== -1) && f.value > 5) {
        this._activeConditions.push('freight_cost_spike');
        signals.push('ELEVATED: Freight costs rising — logistics cost pressure');
      }
      if (f.name && (f.name.indexOf('Freight') !== -1 || f.name.indexOf('PPI') !== -1) && f.value > 10) {
        this._activeConditions.push('carrier_capacity');
        signals.push('CRITICAL: Freight PPI spike — carrier capacity constraints');
      }
      // Container / shipping rate indicators
      if (f.name && (f.name.indexOf('Container') !== -1 || f.name.indexOf('Shipping') !== -1 || f.name.indexOf('Baltic') !== -1) && f.value > 3000) {
        this._activeConditions.push('container_shortage');
        this._activeConditions.push('shipping_delay');
      }
      // Port congestion indicators
      if (f.name && f.name.indexOf('Port') !== -1 && f.value > 0.7) {
        this._activeConditions.push('port_congestion');
      }
    }

    // ── INSTITUTIONAL FEED-DERIVED CONDITIONS (.gov / NWS / CISA / Treasury) ──
    // Maps the 10 keyless institutional feeds to trade-brain diagnosis triggers.
    for (var f3i = 0; f3i < feeds.length; f3i++) {
      var f3 = feeds[f3i];
      var fn3 = (f3.name || '').toLowerCase();

      // NWS active alerts — severe weather → route + port disruption
      if (fn3.indexOf('nws alerts') !== -1 && f3.value !== undefined && f3.value >= 100) {
        this._activeConditions.push('route_constraint');
        signals.push('NWS: ' + f3.value + ' active alerts — route disruption pressure');
      }
      if (fn3.indexOf('nws alerts') !== -1 && f3.stress !== undefined && f3.stress >= 0.5) {
        this._activeConditions.push('port_closure');
        signals.push('NWS: severe weather concentration — port/marine impact');
      }

      // USGS earthquakes — major seismic activity → sourcing / production
      if (fn3.indexOf('earthquakes') !== -1 && f3.value !== undefined && f3.value >= 5) {
        this._activeConditions.push('sourcing_disruption');
        signals.push('USGS: ' + f3.value + ' M4.5+ earthquakes in 24h');
      }
      if (fn3.indexOf('earthquakes') !== -1 && f3.value !== undefined && f3.value >= 15) {
        this._activeConditions.push('production_halt');
      }

      // CISA KEV — newly-exploited vulns → critical_material (cyber-physical)
      if (fn3.indexOf('cisa kev') !== -1 && f3.value !== undefined && f3.value >= 10) {
        this._activeConditions.push('critical_material');
        signals.push('CISA: ' + f3.value + ' newly-exploited CVEs in 30d');
      }
      if (fn3.indexOf('cisa kev') !== -1 && f3.value !== undefined && f3.value >= 25) {
        this._activeConditions.push('sourcing_disruption');
      }

      // Fed Reg CBP — customs notice volume → customs_delay
      if (fn3.indexOf('fed reg cbp') !== -1 && f3.value !== undefined && f3.value >= 5) {
        this._activeConditions.push('customs_delay');
        signals.push('Fed Reg CBP: ' + f3.value + ' customs notices (30d)');
      }
      if (fn3.indexOf('fed reg cbp') !== -1 && f3.value !== undefined && f3.value >= 10) {
        this._activeConditions.push('regulatory_friction');
      }

      // Fed Reg Coast Guard — port / marine regs → port_closure / chokepoint
      if (fn3.indexOf('fed reg coast guard') !== -1 && f3.value !== undefined && f3.value >= 5) {
        this._activeConditions.push('port_closure');
        signals.push('Fed Reg Coast Guard: ' + f3.value + ' marine safety notices (30d)');
      }
      if (fn3.indexOf('fed reg coast guard') !== -1 && f3.value !== undefined && f3.value >= 10) {
        this._activeConditions.push('chokepoint');
      }

      // Fed Reg FAA — airspace regs → route_constraint
      if (fn3.indexOf('fed reg faa') !== -1 && f3.value !== undefined && f3.value >= 5) {
        this._activeConditions.push('route_constraint');
        signals.push('Fed Reg FAA: ' + f3.value + ' aviation notices (30d)');
      }

      // Fed Reg NHTSA — vehicle recalls / safety regs → production_halt
      if (fn3.indexOf('fed reg nhtsa') !== -1 && f3.value !== undefined && f3.value >= 5) {
        this._activeConditions.push('production_halt');
        signals.push('Fed Reg NHTSA: ' + f3.value + ' vehicle safety actions (30d)');
      }
      if (fn3.indexOf('fed reg nhtsa') !== -1 && f3.value !== undefined && f3.value >= 10) {
        this._activeConditions.push('shortage');
      }

      // Fed Reg FMCSA — motor carrier regs → carrier_capacity
      if (fn3.indexOf('fed reg fmcsa') !== -1 && f3.value !== undefined && f3.value >= 5) {
        this._activeConditions.push('carrier_capacity');
        signals.push('Fed Reg FMCSA: ' + f3.value + ' motor carrier notices (30d)');
      }
      if (fn3.indexOf('fed reg fmcsa') !== -1 && f3.value !== undefined && f3.value >= 10) {
        this._activeConditions.push('freight_cost_spike');
      }

      // Fed Reg USTR — tariff / trade actions → TRADE_WAR triggers
      if (fn3.indexOf('fed reg ustr') !== -1 && f3.value !== undefined && f3.value >= 3) {
        this._activeConditions.push('tariff_escalation');
        signals.push('Fed Reg USTR: ' + f3.value + ' trade actions (30d)');
      }
      if (fn3.indexOf('fed reg ustr') !== -1 && f3.value !== undefined && f3.value >= 5) {
        this._activeConditions.push('trade_restriction');
      }

      // OFAC Recent Actions — sanctions activity → TRADE_WAR + CUSTOMS_DISRUPTION triggers
      // Heavy OFAC activity creates CBP clearance friction (cross-feed inference: sanctions
      // enforcement = CBP burden = customs delay risk).
      if (fn3.indexOf('ofac') !== -1 && f3.value !== undefined && f3.value >= 8) {
        this._activeConditions.push('sanctions');
        signals.push('OFAC: ' + f3.value + ' sanctions / SDN designation signals');
      }
      if (fn3.indexOf('ofac') !== -1 && f3.value !== undefined && f3.value >= 15) {
        this._activeConditions.push('export_ban');
      }
      if (fn3.indexOf('ofac') !== -1 && f3.value !== undefined && f3.value >= 25) {
        this._activeConditions.push('trade_restriction');
        this._activeConditions.push('regulatory_friction');
      }
      if (fn3.indexOf('ofac') !== -1 && f3.value !== undefined && f3.value >= 50) {
        this._activeConditions.push('clearance_failure');
        this._activeConditions.push('documentation_backlog');
      }
    }

    // Check for defense/geopolitical signals affecting supply chain
    var snap = this._getSnapshot();
    if (snap && snap.defenseSignals) {
      for (var si = 0; si < snap.defenseSignals.length; si++) {
        var sig = snap.defenseSignals[si];
        if (sig.affectedDomains && (sig.affectedDomains.indexOf('supplyChain') !== -1 || sig.affectedDomains.indexOf('trade') !== -1)) {
          this._activeConditions.push(sig.eventType);
          // Map defense events to trade conditions
          if (sig.eventType === 'STRAIT_DISRUPTION' || sig.eventType === 'PORT_DISRUPTION') {
            this._activeConditions.push('route_constraint');
            this._activeConditions.push('chokepoint');
          }
          if (sig.eventType === 'SANCTIONS' || sig.eventType === 'EXPORT_BAN') {
            this._activeConditions.push('trade_restriction');
            this._activeConditions.push('sanctions');
          }
        }
      }
    }

    // Check macro shock
    if (snap && snap.macroShock && snap.macroShock.detected) {
      this._activeConditions.push('macro_shock');
    }

    // Stress-derived conditions
    if (this.state.stress >= 0.65) this._activeConditions.push('supply_high_stress');
    if (this.state.maturity === 'STRUCTURAL') this._activeConditions.push('structural_stress');

    // Check cross-domain pressure
    var extPressure = this.getExternalPressure ? this.getExternalPressure() : 0;
    if (extPressure >= 0.15) {
      this._activeConditions.push('sourcing_disruption');
    }

    this.state.signals = signals;
    return Promise.resolve();
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 4: Derive diagnoses — condition-matched from portal
  // ══════════════════════════════════════════════════════════════════════

  TradeBrain.prototype.deriveDiagnoses = function () {
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

  TradeBrain.prototype.recommendTreatments = function () {
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

  TradeBrain.prototype.surfaceOpportunities = function () {
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

      // Logistics optimization platform
      add({
        title: dxLabel + ' — logistics optimization and routing platform',
        rank: stress * dx.relevance,
        path: 'PATENTABLE',
        urgency: stress > 0.70 ? 'high' : 'medium',
        source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
      });

      // Supply chain visibility infrastructure
      if (stress >= 0.50) {
        add({
          title: dxLabel + ' — supply chain visibility and tracking infrastructure',
          rank: stress * dx.relevance * 0.9,
          path: 'GRANT-ELIGIBLE',
          urgency: stress > 0.70 ? 'high' : 'medium',
          source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
        });
      }

      // Inventory and throughput hedging
      if (stress >= 0.55 && dx.relevance >= 0.2) {
        add({
          title: dxLabel + ' — inventory rebalancing and throughput hedging',
          rank: stress * 0.85,
          path: 'INVESTABLE',
          urgency: 'medium',
          source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
        });
      }

      // Freight alternative technology
      add({
        title: dxLabel + ' — freight alternative and modal shift technology',
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
        title: 'Trade terminal carrier/operator distressed positioning',
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
        title: 'Trade stressed-but-operating carrier selection',
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
        title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — trade convergence response',
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
        title: 'Trade \u2192 ' + targetLabel + ' transmission — ' + sigLabel + ' response',
        rank: (em.magnitude || 0.5) * stress * 0.8,
        path: 'INVESTABLE',
        urgency: em.magnitude > 0.6 ? 'high' : 'medium',
        source: 'cross_domain', tier: 2,
        diagnosisId: 'trade_emission_' + em.targetDomain,
        stress: stress
      });

      if (em.targetDomain === 'finance') {
        add({
          title: 'Margin compression — trade finance restructuring and factoring',
          rank: stress * 0.7,
          path: 'INVESTABLE',
          urgency: 'medium',
          source: 'cross_domain', tier: 2,
          diagnosisId: 'finance_margin', stress: stress
        });
      }

      if (em.targetDomain === 'agriculture') {
        add({
          title: 'Food supply chain stress — cold chain and distribution resilience',
          rank: stress * 0.75,
          path: 'GRANT-ELIGIBLE',
          urgency: 'medium',
          source: 'cross_domain', tier: 2,
          diagnosisId: 'agri_supply', stress: stress
        });
      }
    }

    // ═══ TIER 3 — LAGGING / SYSTEM RESPONSE ═══
    if (stress >= 0.50) {
      add({
        title: 'Supply chain policy and regulatory response — customs modernization',
        rank: stress * 0.65,
        path: 'GRANT-ELIGIBLE',
        urgency: stress > 0.70 ? 'medium' : 'watching',
        source: 'lagging', tier: 3,
        diagnosisId: 'regulatory_response', stress: stress
      });

      add({
        title: 'Nearshoring and regionalization acceleration',
        rank: stress * 0.70,
        path: 'INVESTABLE',
        urgency: 'medium',
        source: 'lagging', tier: 3,
        diagnosisId: 'nearshoring', stress: stress
      });
    }

    if (stress >= 0.60) {
      add({
        title: 'Warehousing and throughput infrastructure hardening',
        rank: stress * 0.75,
        path: 'INVESTABLE',
        urgency: stress > 0.70 ? 'high' : 'medium',
        source: 'lagging', tier: 3,
        diagnosisId: 'warehouse_hardening', stress: stress
      });

      add({
        title: 'Bottleneck positioning — constrained route and port alternatives',
        rank: stress * 0.72,
        path: 'INVESTABLE',
        urgency: 'medium',
        source: 'lagging', tier: 3,
        diagnosisId: 'bottleneck_position', stress: stress
      });

      add({
        title: 'Supplier diversification — multi-source procurement restructuring',
        rank: stress * 0.68,
        path: 'INVESTABLE',
        urgency: 'medium',
        source: 'lagging', tier: 3,
        diagnosisId: 'supplier_diversification', stress: stress
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
    // Canonical enrichment — merge supplyChain playbook detail per opportunity
    var PB_LIST = window.LIMENTradeOpportunityPlaybooks || [];
    var _byId = {};
    for (var _pbi = 0; _pbi < PB_LIST.length; _pbi++) _byId[PB_LIST[_pbi].id] = PB_LIST[_pbi];
    var _PB_MAP = {
      'SUPPLY_CHAIN_COLLAPSE': 'supply_chain_collapse_trade',
      'PORT_BLOCKADE': 'port_blockade',
      'TRADE_WAR': 'trade_war_trade',
      'SHIPPING_CRISIS': 'shipping_crisis',
      'CUSTOMS_DISRUPTION': 'customs_disruption'
    };
    var _LAGGING_MAP = {
      'agri_supply': 'supply_chain_collapse_trade',
      'bottleneck_position': 'shipping_crisis',
      'finance_margin': 'trade_war_trade',
      'nearshoring': 'trade_war_trade',
      'regulatory_response': 'trade_war_trade',
      'supplier_diversification': 'supply_chain_collapse_trade',
      'warehouse_hardening': 'supply_chain_collapse_trade'
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
      o.domain = 'supplyChain';
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
        var evidenceParts = ['Domain: supplyChain', 'Stress: ' + stressPct + '%'];
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

  TradeBrain.prototype._checkDiagnosisActions = function () {
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; });
    if (activeDx.length === 0) return;

    var adapters = window.LIMENActionAdapters;
    if (!adapters) return;

    for (var i = 0; i < activeDx.length; i++) {
      var dx = activeDx[i];
      var existingDrafts = adapters.getDrafts({ domain: 'supplyChain', intentId: dx.id });
      if (existingDrafts && existingDrafts.length > 0) continue;

      adapters.createDraft('REPORT_GENERATION', {
        domain: 'supplyChain',
        sourceType: 'domain_brain',
        sourceId: dx.id,
        intentId: dx.id,
        title: 'Trade Alert: ' + dx.label,
        intent: {
          domain: 'supplyChain',
          title: dx.label,
          status: 'ACTIVE',
          priority: this.state.stress,
          progress: 0,
          strategyType: 'diagnosis_response',
          steps: [
            { type: 'ANALYZE', label: 'Assess ' + dx.label + ' impact on supply chain', status: 'PENDING' },
            { type: 'INVESTIGATE', label: 'Identify affected routes, carriers, and commodities', status: 'PENDING' },
            { type: 'POSITION', label: 'Evaluate logistics opportunities from ' + dx.label, status: 'PENDING' }
          ]
        }
      });
    }
  };

  TradeBrain.prototype.resolveDeepContent = function () {
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

  var _origCycle = TradeBrain.prototype.cycle;
  TradeBrain.prototype.cycle = function () {
    var self = this;
    return _origCycle.call(this).then(function () {
      return self.resolveDeepContent();
    }).then(function () {
      // Compute pulse — evidence validation + delta detection + freshness
      var pulse = window.LIMENTradePulse;
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
                  self.state.diagnoses[sdi].evidenceReason = vdx.reason;
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

  var brain = new TradeBrain();
  brain.init();
  brain.start();

  window.LIMENSupplyChainBrain = brain;
  window.LIMENDomainBrains.register(brain);

  // ══════════════════════════════════════════════════════════════════════
  // AUTO-LOAD TRADE OPERATOR STACK ON DOMAIN-CONSOLE
  // ══════════════════════════════════════════════════════════════════════

  var _isDomainConsole = window.location.pathname.indexOf('domain-console') !== -1;
  var _isTradeDomain = (new URLSearchParams(window.location.search)).get('domain') === 'supplyChain' ||
                       (new URLSearchParams(window.location.search)).get('domain') === 'trade';
  if (_isDomainConsole && _isTradeDomain) {
    window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION = true;

    var _tradeScripts = [
      'assets/js/trade-compensation.js',
      'assets/js/trade-claim-ledger.js',
      'assets/js/trade-claim-flow.js',
      'assets/js/trade-opportunity-economics.js',
      'assets/js/trade-pulse-engine.js',
      'assets/js/trade-operator-panel.js',
      'assets/js/trade-node-business-engine.js',
      'assets/js/trade-business-review.js',
      'assets/js/trade-execution-panels.js',
      'assets/js/trade-business-build.js',
      'assets/js/trade-directive-extractor.js',
      'assets/js/trade-directive-ranker.js',
      'assets/js/trade-directive-translator.js',
      'assets/js/trade-targeting-engine.js',
      'assets/js/trade-promotion-bridge.js',
      'assets/js/trade-clarity-operator.js'
    ];
    (function loadNext(i) {
      if (i >= _tradeScripts.length) return;
      var s = document.createElement('script');
      s.src = _tradeScripts[i];
      s.onload = function () { loadNext(i + 1); };
      s.onerror = function () { console.warn('[TradeBrain] Failed to load ' + _tradeScripts[i]); loadNext(i + 1); };
      document.head.appendChild(s);
    })(0);
  }

})();
