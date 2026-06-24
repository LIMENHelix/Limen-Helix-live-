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

    // Cognition substrate one-shot loaders (offline-safe; populate caches read by the DDP/H-layers)
    try { this._loadDiagnosisBundles(); } catch (e) {}      // G1: real artifact-source bundles (only ones that exist)
    try { this._loadTradeL1PortalDepth(); } catch (e) {}    // J1: scan L1 trade_* branches (mad-lib treatments NOT admitted; only real tickers, relevance-unverified)
    try { this._loadTradeFreightFlows(); } catch (e) {}     // FREIGHT: load the freight-flow sub-portal (real-content, unbundled) — never merged into the validated 5-diagnosis spine
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
        path: 'RESEARCHABLE',
        urgency: stress > 0.70 ? 'high' : 'medium',
        source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
      });

      // Supply chain visibility infrastructure
      if (stress >= 0.50) {
        add({
          title: dxLabel + ' — supply chain visibility and tracking infrastructure',
          rank: stress * dx.relevance * 0.9,
          path: 'INVESTABLE',
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
        path: 'RESEARCHABLE',
        urgency: 'medium',
        source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
      });
    }

    // Terminal companies
    var terminalCompanies = [] /* neutralized: distress only from validated gate (see energy-brain) */;
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
    var stressedCompanies = [] /* neutralized: distress only from validated gate */;
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
          path: 'INVESTABLE',
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
        path: 'RESEARCHABLE',
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
          path: 'RESEARCHABLE',
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
    // Lanes: investment + research ONLY (patent/grant/loan purged 2026-06-21; relaned GRANT->INVESTABLE, PATENT->RESEARCHABLE)
    var _COMP = {
      'INVESTABLE':     { type: 'invest',   base: 5, unit: 'profit%', tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
      'RESEARCHABLE':   { type: 'research', base: 5, unit: 'credit%', tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 published research briefs' },    maxTier: { tier: 3, comp: 15 } }
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
        else if (o.path === 'RESEARCHABLE' && pb.realWorld && (pb.realWorld.research || pb.realWorld.build)) target = pb.realWorld.research || pb.realWorld.build;
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
    }).then(function () {
      // PHASE B — recurrent loop step. Runs AFTER the pipeline settles, reads the
      // prior produced by the PREVIOUS cycle, computes prediction error, regulates,
      // and updates the next prior. supplyChain-local + try/caught (never breaks a cycle).
      try { self._updateSupplyChainModel(); } catch (e) {}
    });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE B — SUPPLY-CHAIN RECURRENT LOOP v1 (trade-local, additive, reversible)
  // Converts re-running inference into a recurrent loop:
  //   prior → observation → prediction error → bounded update → next prior.
  // Proof surface: window.LIMENSupplyChainBrain.state.supplyChainModel
  // Mirror of energy-brain.js _updateEnergyModel; runtime key = 'supplyChain'.
  // ════════════════════════════════════════════════════════════════════════════
  var EM_VERSION = 1;
  var EM_LEARNING_RATE = 0.25;          // bounded plasticity (fast inference)
  var EM_SLOW_RATE = 0.08;              // slow consolidation (reserved for rebuild/cron)
  var EM_STRESS_FLOOR = 0.30;           // below this → no handoff
  var EM_FLOOD_CAP = 12;                // opportunity-flood threshold
  var EM_STALE_MS = 1000 * 60 * 60 * 6; // 6h feed staleness

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

  TradeBrain.prototype._neutralSupplyChainModel = function () {
    return {
      version: EM_VERSION, cycle: 0,
      prior: { expectedStress: 0.5, expectedDiagnoses: [], expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, confidence: 0, samples: 0 },
      observation: null, predictionError: null, predictedStress: null,
      plasticity: { learningRate: EM_LEARNING_RATE, slowRate: EM_SLOW_RATE, consolidation: 'cycle-light/rebuild-heavy' },
      regulation: null, readyForHandoff: false, _lowErrorStreak: 0
    };
  };

  // B2 — normalized observation from current supply-chain state
  TradeBrain.prototype._buildObservation = function () {
    var s = this.state || {};
    var active = (s.diagnoses || []).filter(function (d) { return d.active; });
    var feeds = s.feeds || [], feedCount = 0, newest = 0;
    if (Array.isArray(feeds)) {
      feedCount = feeds.length;
      for (var fi = 0; fi < feeds.length; fi++) { var u = feeds[fi] && feeds[fi].updated; if (u && u > newest) newest = u; }
    } else {
      for (var k in feeds) { if (feeds.hasOwnProperty(k)) { feedCount++; var u2 = feeds[k] && feeds[k].updated; if (u2 && u2 > newest) newest = u2; } }
    }
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

  // B3 — prediction error: prior.expected* vs observation
  TradeBrain.prototype._computePredictionError = function (prior, obs) {
    var stressError = Math.abs(obs.stress - prior.expectedStress);
    var signalError = Math.abs(obs.signal - prior.expectedSignal);
    var diagnosisError = _emJaccardDistance(obs.activeDiagnoses, prior.expectedDiagnoses);
    var oppDenom = Math.max(1, prior.expectedOpportunityCount, obs.opportunityCount);
    var opportunityError = Math.abs(obs.opportunityCount - prior.expectedOpportunityCount) / oppDenom;
    var portalError = 0; // honest 0 — no live portal traversal yet (Phase C)
    var total = _emClamp(0.4 * stressError + 0.2 * signalError + 0.25 * diagnosisError + 0.15 * opportunityError, 0, 1);
    var novelty = Math.max(stressError, diagnosisError);
    return { total: total, stressError: stressError, signalError: signalError, diagnosisError: diagnosisError, opportunityError: opportunityError, portalError: portalError, novelty: novelty };
  };

  // B4 — bounded prior update toward observation (next cycle reads this)
  TradeBrain.prototype._updatePrior = function (prior, obs, lr) {
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

  // B5 — local regulation: inhibition / gain / homeostatic set-points
  TradeBrain.prototype._computeRegulation = function (em, obs, pe) {
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

  // The recurrent step — END of each cycle. Reads the prior from the PREVIOUS cycle,
  // so cycle N+1's interpretation (predictedStress, readyForHandoff) depends on cycle N.
  TradeBrain.prototype._updateSupplyChainModel = function () {
    var em = this.state.supplyChainModel || this._neutralSupplyChainModel();
    var priorIn = em.prior;                                   // carried from last cycle
    var obs = this._buildObservation();
    var pe = this._computePredictionError(priorIn, obs);      // prior vs now

    // reads prior BEFORE the final decision (Kalman-style blend, not raw obs):
    var gainBlend = _emClamp(pe.novelty, 0.05, 0.95);
    var predictedStress = priorIn.expectedStress * (1 - gainBlend) + obs.stress * gainBlend;
    var reg = this._computeRegulation(em, obs, pe);

    // a FINAL decision that depends on the prior, not just on raw obs:
    var readyForHandoff = (em.cycle > 0) && (predictedStress >= EM_STRESS_FLOOR) && (obs.diagnosisCount > 0) && !reg.flooding && !reg.stale;

    var nextPrior = this._updatePrior(priorIn, obs, em.plasticity.learningRate); // → next cycle reads this

    em.cycle += 1;
    em.observation = obs;
    em.predictionError = pe;
    em.predictedStress = predictedStress;
    em.regulation = reg;
    em.readyForHandoff = readyForHandoff;
    em.prior = nextPrior;
    em.updated = obs.timestamp;
    this.state.supplyChainModel = em;

    // H1-H6 — higher supply-chain brain layers (domain-level, computed once per cycle
    // BEFORE the DDP build so the packet can embed their compact summaries).
    try { this._computeSupplyChainHigherLayers(); } catch (e) {}

    // Generic cognition surface the console SELF-MODEL panel renders for ANY domain.
    try {
      this.state.cognition = {
        domain: 'supplyChain',
        model: { cycle: em.cycle, predictionError: em.predictionError, predictedStress: em.predictedStress, regulation: em.regulation },
        awareness: this.state.supplyChainAwareness || null,
        conscience: this.state.supplyChainConscience || null,
        immune: this.state.supplyChainImmune || null,
        intuition: this.state.supplyChainIntuition || null
      };
    } catch (e) {}

    // FREIGHT — trade-flow / freight-capacity sub-layer (additive; BEFORE the DDP build so the
    // primary packet's promptView advertises it). Never touches the validated 5-diagnosis spine.
    try { this._buildFreightFlowLayer(); } catch (e) {}

    // F1 — build the DomainDiagnosisPacket (schema) for the primary diagnosis,
    // and expose one per diagnosis. Schema-only: never invents data.
    try {
      var _diags = this.state.diagnoses || [];
      var _primary = _diags.filter(function (d) { return d.active; })[0] || _diags[0] || null;
      var _self = this;
      em.domainDiagnosisPacket = this._buildDomainDiagnosisPacket(_primary);
      this.state.supplyChainDomainDiagnosisPackets = _diags.map(function (d) { return _self._buildDomainDiagnosisPacket(d); });
    } catch (e) {}

    // populate outcomeLog meaningfully
    try {
      var mem = this.state.memory;
      if (mem && mem.outcomeLog) {
        mem.outcomeLog.push({ cycle: em.cycle, predictionError: Math.round(pe.total * 1000) / 1000, stress: obs.stress, activeDx: obs.diagnosisCount, readyForHandoff: readyForHandoff, regulation: reg.state, timestamp: obs.timestamp });
        if (mem.outcomeLog.length > 50) mem.outcomeLog.shift();
      }
    } catch (e) {}

    return em;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // F1 — SUPPLY-CHAIN DomainDiagnosisPacket SCHEMA (schema-only; NEVER invents data).
  // Builds the canonical 8-section contract from whatever the brain already has.
  // Absent fields are EXPLICIT null / [] / 'missing' — never silently omitted.
  // ════════════════════════════════════════════════════════════════════════════
  var DDP_SCHEMA_VERSION = 'supplyChain-ddp-1';
  function _ddpPresent(v) {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (v === 'missing' || v === '' || v === 'none') return false;
    return true;
  }
  function _ddpCompleteness(section, keys) {
    var have = 0; for (var i = 0; i < keys.length; i++) { if (_ddpPresent(section[keys[i]])) have++; }
    return { have: have, total: keys.length, pct: keys.length ? Math.round(have / keys.length * 100) : 0 };
  }

  // F3 — canonical diagnosis resolution. Prefers window.LIMENArtifactSourceIndex.aliases()
  // when loaded (single source of truth), else falls back to this local map. Non-aliased
  // diagnoses are canonical to themselves. Never asserts a bundle exists.
  var SUPPLYCHAIN_DIAGNOSIS_ALIASES = {
    SUPPLY_CHAIN_COLLAPSE: { target: 'SUPPLY_SHORTAGE_EVENT', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits SUPPLY_SHORTAGE_EVENT for sourcing/material collapse' },
    PORT_BLOCKADE: { target: 'SHIPPING_ROUTE_CONSTRAINT', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits SHIPPING_ROUTE_CONSTRAINT (chokepoint/route) for port blockade' },
    TRADE_WAR: { target: 'TARIFF_ESCALATION_EVENT', reviewStatus: 'human-approved', risk: 'medium', note: 'trade war mapped to tariff-escalation bundle; verify that tariff-specific evidence is appropriate for broader trade-policy claims' }
  };
  TradeBrain.prototype._resolveCanonicalDiagnosis = function (dxId) {
    if (!dxId) return { canonicalDiagnosisId: null, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };
    var target = null;
    try {
      var idx = (typeof window !== 'undefined') ? window.LIMENArtifactSourceIndex : null;
      if (idx && typeof idx.aliases === 'function') { var row = idx.aliases()[dxId]; if (row && row.target) target = row.target; }
    } catch (e) {}
    var local = SUPPLYCHAIN_DIAGNOSIS_ALIASES[dxId] || null;
    if (!target && local) target = local.target;
    if (target) {
      return { canonicalDiagnosisId: target, aliasUsed: true, aliasReviewStatus: (local && local.reviewStatus) || 'corpus-aliased', aliasRisk: (local && local.risk) || 'low', aliasNote: (local && local.note) || null };
    }
    return { canonicalDiagnosisId: dxId, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };   // canonical to self
  };

  // G1 — load REAL source bundles (one-shot, async). Only files that actually exist
  // resolve to 'found'; 404s are 'missing'. Never fabricates a bundle.
  TradeBrain.prototype._loadDiagnosisBundles = function () {
    var self = this;
    if (self._bundleLoadPromise) return self._bundleLoadPromise;
    self._bundleCache = self._bundleCache || {};
    self._bundleStatusMap = self._bundleStatusMap || {};
    var ids = {};
    var known = ['SUPPLY_CHAIN_COLLAPSE', 'PORT_BLOCKADE', 'TRADE_WAR', 'SHIPPING_CRISIS', 'CUSTOMS_DISRUPTION'];
    var diags = (self.state && self.state.diagnoses) || [];
    var allDxIds = diags.map(function (d) { return d.id; }).concat(known);
    for (var i = 0; i < allDxIds.length; i++) { var c = self._resolveCanonicalDiagnosis(allDxIds[i]).canonicalDiagnosisId; if (c) ids[c] = true; }   // resolve diagnosis -> canonical before fetch
    self._bundleLoadPromise = Promise.all(Object.keys(ids).map(function (cid) {
      return fetch('/assets/data/artifact-source-index/by-diagnosis/' + encodeURIComponent(cid) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) { self._bundleStatusMap[cid] = data ? 'found' : 'missing'; if (data) self._bundleCache[cid] = data; })
        .catch(function () { self._bundleStatusMap[cid] = 'missing'; });
    })).then(function () { return self._bundleCache; });
    return self._bundleLoadPromise;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE J1 — REAL L1 PORTAL DEPTH (honest finding: L1 treatments are mad-lib templates).
  // L1 treatments are NOT admitted as evidence; only the real company tickers are surfaced
  // (relevance-unverified, never into evidenceAnchors). Scans the real trade_* sub-portals.
  // ════════════════════════════════════════════════════════════════════════════
  var MADLIB_VERB = /^(Develop|Establish|Implement|Build|Launch|Design|Deploy|Operationalize|Conduct|Create|Define|Assess|Optimize|Modernize|Strengthen|Enhance|Formalize|Institute|Standardize|Coordinate|Integrate|Calibrate|Evaluate|Streamline|Institutionalize|Configure|Monitor)\b/;
  TradeBrain.prototype._isMadLibTreatment = function (label) { return !label || MADLIB_VERB.test(String(label)); };

  TradeBrain.prototype._loadTradeL1PortalDepth = function () {
    var self = this;
    if (self._l1LoadPromise) return self._l1LoadPromise;
    // BRANCH map: diagnosis -> real trade_* sub-portal file stems (file = 'trade_<branch>.json')
    var BRANCH = {
      SUPPLY_CHAIN_COLLAPSE: ['supply_resilience', 'supply_risk', 'supply_visibility', 'supply_nearshoring'],
      PORT_BLOCKADE: ['port_portops', 'port_portcompete', 'port_portinfra', 'port_portsecurity'],
      TRADE_WAR: ['tradecompliance_sanction', 'tradecompliance_embargo', 'tradecompliance_expctrl', 'customs_tariffs'],
      SHIPPING_CRISIS: ['trucking_trucktech', 'lastmile_delivery', 'warehousing_whops', 'lastmile_technology'],
      CUSTOMS_DISRUPTION: ['customs_clearance', 'customs_compliance', 'customs_automation', 'customs_classification']
    };
    self._l1Branches = BRANCH;
    var branches = {}; Object.keys(BRANCH).forEach(function (dx) { BRANCH[dx].forEach(function (b) { branches[b] = true; }); });
    var byBranch = {};
    self._l1LoadPromise = Promise.all(Object.keys(branches).map(function (b) {
      return fetch('/assets/data/domains/trade_' + encodeURIComponent(b) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) {
          if (!data) { byBranch[b] = null; return; }
          var acts = data.activations || [], tickers = {}, total = 0, mad = 0;
          acts.forEach(function (a) {
            (a.companies || []).forEach(function (c) { if (c && c.ticker_or_id) tickers[c.ticker_or_id] = c.name || c.ticker_or_id; });
            (a.treatments || []).forEach(function (t) { var l = t && (t.label || t.title); if (l) { total++; if (self._isMadLibTreatment(l)) mad++; } });
          });
          byBranch[b] = { file: 'trade_' + b, companyTickers: Object.keys(tickers).map(function (k) { return { ticker: k, name: tickers[k] }; }), treatmentTotal: total, madLibCount: mad, realTreatmentCount: total - mad };
        })
        .catch(function () { byBranch[b] = null; });
    })).then(function () {
      var byDiagnosis = {};
      Object.keys(BRANCH).forEach(function (dx) {
        var tk = {}, total = 0, mad = 0, scanned = 0;
        BRANCH[dx].forEach(function (b) { var r = byBranch[b]; if (r) { scanned++; r.companyTickers.forEach(function (c) { tk[c.ticker] = c.name; }); total += r.treatmentTotal; mad += r.madLibCount; } });
        byDiagnosis[dx] = { branchesScanned: scanned, realCompanyTickers: Object.keys(tk).map(function (k) { return { ticker: k, name: tk[k], relevanceUnverified: true }; }), treatmentTotal: total, madLibTreatments: mad, realTreatments: total - mad, admitted: false, reason: 'L1 trade-portal treatments are mad-lib templates (fixed-verb family) — not source-grade; only company tickers surfaced, relevance unverified' };
      });
      self.state._l1DepthCache = { byBranch: byBranch, byDiagnosis: byDiagnosis, scannedAt: (self.state.supplyChainModel && self.state.supplyChainModel.updated) || null };
      return self.state._l1DepthCache;
    });
    return self._l1LoadPromise;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // FREIGHT — TRADE-FLOW / FREIGHT-CAPACITY SUB-LAYER (additive brain layer).
  // The freight-flow sub-portal (trade_freight_flows.json) would carry REAL, hand-authored,
  // citation-backed diagnoses + treatments (NOT the mad-lib cortex) but has NO external source
  // bundle yet. Surfaced as a SEPARATE first-class layer — NEVER merged into the validated
  // 5-diagnosis spine (state.diagnoses stays 5) and never into evidenceAnchors. Opportunity
  // contributions are INVESTABLE only (per H3 conscience veto on patent/grant). On any absence
  // (file 404 / offline) everything stays empty/neutral — offline-safe.
  // ════════════════════════════════════════════════════════════════════════════
  // Hand-authored freight-flow diagnoses (real-content; citation-backed; SEPARATE from the spine).
  var FREIGHT_FLOW_DIAGNOSES = [
    {
      id: 'FREIGHT_COST_VOLATILITY', label: 'Freight Cost Volatility',
      summary: 'Real-time freight rate indices swinging beyond hedgeable bands — modal cost transmission risk.',
      triggers: ['freight_cost_spike', 'carrier_capacity', 'container_shortage'],
      treatments: [
        { label: 'Modal shift technology', type: 'capability', evidence: 'B', description: 'Shift volume across truck/rail/ocean/air to arbitrage rate spikes.', cite: 'FMCSA freight data; ATA truck-tonnage index; freight-rate indices', steps: ['Instrument lane-level rate exposure', 'Wire modal-substitution decision rules', 'Hedge spot vs contract mix'] }
      ],
      opportunity: { title: 'Freight cost volatility — modal shift technology', path: 'INVESTABLE', examples: ['ODFL (rate-cycle margin)', 'MATX (ocean rate transmission)', 'CHRW (brokerage spread)'] }
    },
    {
      id: 'CARRIER_CAPACITY_PINCH', label: 'Carrier Capacity Pinch',
      summary: 'Fleet utilization + new-vehicle registration data signal a tightening carrier capacity market.',
      triggers: ['carrier_capacity', 'freight_cost_spike', 'production_halt'],
      treatments: [
        { label: 'Autonomous trucking investment', type: 'capability', evidence: 'B', description: 'Capacity-multiplier technology to relieve driver/fleet constraints.', cite: 'ATA driver-shortage reports; FMCSA registrations; fleet utilization indices', steps: ['Map capacity-constrained lanes', 'Evaluate autonomy / yard-automation vendors', 'Stage pilot corridors'] }
      ],
      opportunity: { title: 'Carrier capacity pinch — autonomous trucking investment', path: 'INVESTABLE', examples: ['ODFL (LTL capacity)', 'XPO (LTL/brokerage)', 'UPS (network capacity)'] }
    },
    {
      id: 'ROUTE_CONCENTRATION_RISK', label: 'Route Concentration Risk',
      summary: 'Top-3-route dependency concentration creates fragility to single-chokepoint disruption.',
      triggers: ['route_constraint', 'chokepoint', 'port_congestion'],
      treatments: [
        { label: 'Route diversification planning', type: 'capability', evidence: 'B', description: 'Reduce single-route dependency; build alternate lane / port-pair options.', cite: 'BTS freight flows; port throughput statistics; route-concentration indices', steps: ['Compute top-3 route concentration', 'Identify alternate port-pairs/lanes', 'Pre-contract redundant capacity'] }
      ],
      opportunity: { title: 'Route concentration risk — route diversification planning', path: 'INVESTABLE', examples: ['EXPD (multi-modal routing)', 'CHRW (lane optionality)', 'ZIM (ocean route mix)'] }
    }
  ];

  TradeBrain.prototype._loadTradeFreightFlows = function () {
    var self = this;
    if (self._ffLoadPromise) return self._ffLoadPromise;
    self._ffLoadPromise = fetch('/assets/data/domains/trade_freight_flows.json')
      .then(function (r) { return (r && r.ok) ? r.json() : null; })
      .then(function (data) {
        if (!data) { self._ffPortal = null; return null; }
        self._ffPortal = { issues: data.issues || [], activations: data.activations || [], title: data.title || 'Freight Flows' };
        return self._ffPortal;
      })
      .catch(function () { self._ffPortal = null; return null; });
    return self._ffLoadPromise;
  };

  // Build the freight-flow layer once per cycle (called from _updateSupplyChainModel BEFORE the
  // main DDP build so the primary packet's promptView can advertise it). Uses the loaded
  // sub-portal if present, else falls back to the hand-authored FREIGHT_FLOW_DIAGNOSES — both are
  // real-content (NOT mad-lib) and SEPARATE from the validated spine.
  TradeBrain.prototype._buildFreightFlowLayer = function () {
    var self = this;
    var conditions = self._activeConditions || [];
    var ff = self._ffPortal;
    var issues = (ff && Array.isArray(ff.issues) && ff.issues.length) ? ff.issues : FREIGHT_FLOW_DIAGNOSES;
    var portalTitle = (ff && ff.title) || 'Freight Flows';
    if (!issues || !issues.length) {
      self.state.freightFlowDiagnoses = [];
      self.state.freightFlowTreatments = [];
      self.state.freightFlowDomainDiagnosisPackets = [];
      self.state.freightFlowLayer = { loaded: false, count: 0, activeCount: 0, diagnoses: [], note: 'freight-flow sub-layer empty' };
      return self.state.freightFlowLayer;
    }
    // 1) diagnoses (activation via the same condition-match logic as the canonical spine)
    var diagnoses = issues.map(function (iss) {
      var triggers = iss.triggers || ((self.diagnosisIndex && self.diagnosisIndex[iss.id]) || []);
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
        source: 'freight-flow', tier: 'real-content-unbundled', branch: 'freight-flow'
      };
    });
    // 2) treatments — hand-authored + citation-backed (real, not mad-lib)
    var treatments = [];
    issues.forEach(function (iss) {
      (iss.treatments || []).forEach(function (t, ti) {
        treatments.push({
          id: 'ff_treat_' + iss.id + '_' + ti,
          label: t.label, type: t.type, evidence: t.evidence, description: t.description || '',
          cite: t.cite || null, citation: t.citation || [], steps: t.steps || [],
          diagnosisId: iss.id, nodeId: iss.id,
          source: 'freight-flow', madLib: self._isMadLibTreatment ? self._isMadLibTreatment(t.label) : false
        });
      });
    });
    var evidenceRank = { A: 10, Strong: 10, B: 7, Moderate: 7, C: 4, Emerging: 1 };
    treatments.sort(function (a, b) { return (evidenceRank[b.evidence] || 0) - (evidenceRank[a.evidence] || 0); });
    self.state.freightFlowDiagnoses = diagnoses;
    self.state.freightFlowTreatments = treatments;
    // 3) opportunity contributions — INVESTABLE only (no patent/grant, per H3 conscience)
    var opportunities = [];
    issues.forEach(function (iss) {
      if (iss.opportunity) {
        opportunities.push({
          id: 'ff_opp_' + iss.id, title: iss.opportunity.title,
          path: iss.opportunity.path || 'INVESTABLE', examples: iss.opportunity.examples || [],
          diagnosisId: iss.id, source: 'freight-flow', tier: 'real-content-unbundled'
        });
      }
    });
    self.state.freightFlowOpportunities = opportunities;
    // 4) compact layer summary (read by every DDP's promptView; computed BEFORE the FF DDPs)
    self.state.freightFlowLayer = {
      loaded: true,
      portalTitle: portalTitle,
      sourceMode: (ff && ff.issues && ff.issues.length) ? 'sub-portal' : 'hand-authored-fallback',
      count: diagnoses.length,
      activeCount: diagnoses.filter(function (d) { return d.active; }).length,
      diagnoses: diagnoses.map(function (d) {
        var rc = self._resolveCanonicalDiagnosis ? self._resolveCanonicalDiagnosis(d.id) : { canonicalDiagnosisId: d.id };
        var bs = (self._bundleStatusMap && self._bundleStatusMap[rc.canonicalDiagnosisId]) || 'missing';
        return { id: d.id, label: d.label, active: d.active, branch: 'freight-flow', canonicalDiagnosisId: rc.canonicalDiagnosisId, bundleStatus: bs, treatmentCount: treatments.filter(function (t) { return t.diagnosisId === d.id; }).length };
      }),
      opportunities: opportunities.map(function (o) { return { id: o.id, title: o.title, path: o.path, examples: o.examples }; }),
      note: 'real-content (hand-authored, citation-backed: FMCSA / ATA / BTS / freight-rate indices) sub-portal diagnoses; SEPARATE from the validated 5-diagnosis spine; no external source bundle yet; never admitted to evidenceAnchors; opportunity contributions INVESTABLE only'
    };
    // 5) per-diagnosis DDPs via the SAME schema builder (canonical-to-self; bundle 'missing')
    self.state.freightFlowDomainDiagnosisPackets = diagnoses.map(function (d) {
      try { return self._buildDomainDiagnosisPacket(d); } catch (e) { return null; }
    }).filter(Boolean);
    return self.state.freightFlowLayer;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE H1-H6 — HIGHER SUPPLY-CHAIN BRAIN LAYERS (trade-local, additive, domain-level).
  // Computed once per cycle BEFORE the DDP build; each emits a COMPACT summary that the DDP
  // embeds in promptView (forwarded to the finalizer by G2) + the full object in audit.
  // Never fabricates evidence; intuition/simulation are explicitly labelled unverified/hypothetical.
  // ════════════════════════════════════════════════════════════════════════════
  TradeBrain.prototype._supplyChainBundleStates = function () {
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

  // H1 — formal immune system
  TradeBrain.prototype._computeSupplyChainImmune = function () {
    var s = this.state, em = s.supplyChainModel || {}, reg = em.regulation || {}, bs = this._supplyChainBundleStates();
    var ant = [{ type: 'synthetic-portal-contamination', severity: 'medium', action: 'quarantine', note: 'L2 sub-portal treatments ~synthetic (mad-lib)' }];
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
    if (reg.starving) ant.push({ type: 'unsupported-artifact-readiness-risk', severity: 'low', action: 'flag' });
    var _l1 = s._l1DepthCache;
    if (_l1 && _l1.byDiagnosis && Object.keys(_l1.byDiagnosis).some(function (dx) { return _l1.byDiagnosis[dx].madLibTreatments > 0; })) {
      ant.push({ type: 'l1-synthetic-treatments', severity: 'medium', action: 'quarantine', note: 'L1 trade-portal treatments are mad-lib templates (fixed-verb family); quarantined from evidence — only real tickers surfaced relevance-unverified' });
    }
    var sev = ant.some(function (a) { return a.severity === 'high'; }) ? 'high' : ant.some(function (a) { return a.severity === 'medium'; }) ? 'medium' : ant.length ? 'low' : 'none';
    var im = {
      version: 1, immuneState: sev === 'high' ? 'alert' : sev === 'medium' ? 'active' : sev === 'low' ? 'watch' : 'clear', severity: sev,
      antigens: ant.slice(0, 12),
      quarantines: ['L2-synthetic-portal-content', 'L1-portal-treatments-madlib', 'L1-L2-mad-lib-treatments'],
      allowedWithWarning: ant.filter(function (a) { return a.action === 'allow-with-warning'; }).map(function (a) { return a.type + (a.dx ? (':' + a.dx) : ''); }),
      blockedFromPrompt: ant.filter(function (a) { return a.action === 'block-from-prompt-evidence'; }).map(function (a) { return a.dx; }),
      blockedFromTraversal: ['L2'],
      immuneMemory: (((s.supplyChainImmune && s.supplyChainImmune.immuneMemory) || 0) + 1),
      lastScanAt: em.updated || null
    };
    s.supplyChainImmune = im; return im;
  };

  // H2 — awareness / metacognition
  TradeBrain.prototype._computeSupplyChainAwareness = function () {
    var s = this.state, em = s.supplyChainModel || {}, im = s.supplyChainImmune || {}, bs = this._supplyChainBundleStates();
    var covered = bs.filter(function (b) { return b.bundleStatus === 'found'; });
    var missing = bs.filter(function (b) { return b.bundleStatus === 'missing'; });
    var hv = bs.filter(function (b) { return b.humanVerification === 'required'; });
    var active = (s.diagnoses || []).filter(function (d) { return d.active; });
    var prev = s.supplyChainAwareness || {};
    var pe = (em.predictionError && em.predictionError.total) || 0;
    var aw = {
      version: 1,
      selfState: im.immuneState === 'alert' ? 'guarded' : (em.regulation && em.regulation.state) || 'unknown',
      knowns: covered.map(function (b) { return b.dxId + ' (source-backed' + (b.buildMethod === 'external-source-authored' ? ', external' : '') + ')'; }),
      unknowns: missing.map(function (b) { return b.dxId + ' (no source bundle)'; }),
      uncertainties: ['L1 trade-portal treatments are mad-lib templates (NOT real depth); L2 synthetic + blocked', 'real company tickers exist in L1 but node-bindings are templated (relevance-unverified)', 'predictionError=' + (Math.round(pe * 1000) / 1000)],
      suppressions: (im.quarantines || []).concat(['L2-traversal', 'L1-portal-treatments']),
      confidenceDrivers: ['source coverage ' + covered.length + '/' + bs.length, 'regulation ' + ((em.regulation && em.regulation.state) || '?')],
      changedSinceLastCycle: { predictionErrorDelta: Math.round((pe - (typeof prev._pe === 'number' ? prev._pe : pe)) * 1000) / 1000, coverageNow: covered.length },
      humanReviewRequired: hv.map(function (b) { return b.dxId; }),
      selfNarrative: 'Supply chain: ' + covered.length + '/' + bs.length + ' source-backed, ' + active.length + ' active dx, immune=' + (im.immuneState || '?') + ', portal-below-L1 quarantined, ' + hv.length + ' need human verification.',
      lastAwarenessAt: em.updated || null, _pe: pe
    };
    s.supplyChainAwareness = aw; return aw;
  };

  // H3 — conscience / veto (overclaim + source-sufficiency + harm-prevention)
  TradeBrain.prototype._computeSupplyChainConscience = function () {
    var s = this.state, em = s.supplyChainModel || {}, bs = this._supplyChainBundleStates();
    var pe = (em.predictionError && em.predictionError.total) || 0;
    var vetoes = [], cautions = [], allowed = [], blocked = ['patent-claim', 'grant-claim'];
    vetoes.push({ claim: 'patent/grant', reason: 'no method/mechanism/embodiment/figure candidate fields in any supply-chain bundle' });
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
      artifactReadinessDecision: { patentReady: false, grantReady: false, sbaReady: false, investmentReady: hasFound, researchReady: hasFound, note: 'patent/grant vetoed (no candidate fields); investment/research allowed-with-warning only for source-backed diagnoses' },
      reasons: ['overclaim prevention', 'source sufficiency', 'human-verification preservation'],
      lastCheckAt: em.updated || null
    };
    s.supplyChainConscience = con; return con;
  };

  // H4 — intuition / weak-signal (NOT evidence; labelled unverified)
  TradeBrain.prototype._computeSupplyChainIntuition = function () {
    var s = this.state, em = s.supplyChainModel || {}, reg = em.regulation || {};
    var log = (s.memory && s.memory.outcomeLog) || [];
    var hunches = [];
    if (log.length >= 2) {
      var a = log[log.length - 2].predictionError, b = log[log.length - 1].predictionError;
      if (typeof a === 'number' && typeof b === 'number' && b - a > 0.05) hunches.push({ hunch: 'regime shift forming (prediction error rising)', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'predictionError rose ' + a + '->' + b, verifyIf: 'error keeps rising 2+ cycles', falsifyIf: 'error returns to baseline' });
    }
    if (reg.state === 'surprised') hunches.push({ hunch: 'route concentration building', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'regulation=surprised (high novelty)', verifyIf: 'a specific diagnosis activates with source support', falsifyIf: 'novelty subsides next cycle' });
    if (reg.state === 'flooding' || reg.state === 'looping') hunches.push({ hunch: 'carrier consolidation pressure', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'regulation=' + reg.state + ' (capacity / repetition signal)', verifyIf: 'carrier-capacity diagnosis activates with source support', falsifyIf: 'opportunity flow normalizes' });
    var missing = this._supplyChainBundleStates().filter(function (x) { return x.bundleStatus === 'missing' && x.active; });
    if (missing.length) hunches.push({ hunch: 'recurring uncovered diagnosis: ' + missing[0].dxId, label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'active diagnosis with no source bundle', verifyIf: 'a real source bundle is built', falsifyIf: 'diagnosis deactivates' });

    // patternMatches: recurring regulation state + phase oscillation from real memory
    var patternMatches = [];
    var recent = log.slice(-10), regCount = {};
    recent.forEach(function (e) { if (e.regulation) regCount[e.regulation] = (regCount[e.regulation] || 0) + 1; });
    Object.keys(regCount).forEach(function (k) { if (regCount[k] >= 3) patternMatches.push({ pattern: 'recurring regulation state: ' + k, occurrences: regCount[k], window: recent.length, label: 'PATTERN', evidenceStatus: 'UNVERIFIED' }); });
    var ph = (s.memory && s.memory.phaseHistory) || [], ph5 = ph.slice(-4).map(function (x) { return x.phase; });
    if (ph5.length >= 4 && ph5[3] === ph5[1] && ph5[2] === ph5[0] && ph5[0] !== ph5[1]) patternMatches.push({ pattern: 'phase oscillation ' + ph5.slice(-2).join('<->'), label: 'PATTERN', evidenceStatus: 'UNVERIFIED' });

    // analogies: static structural-family map (analogy, NOT evidence)
    var FAMILY = { 'supply-shock': ['SUPPLY_CHAIN_COLLAPSE', 'SHIPPING_CRISIS'], 'trade-policy': ['TRADE_WAR', 'CUSTOMS_DISRUPTION'], 'route-risk': ['PORT_BLOCKADE', 'SHIPPING_CRISIS'] };
    var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var primaryId = (active[0] || (s.diagnoses || [])[0] || {}).id;
    var analogies = [];
    Object.keys(FAMILY).forEach(function (fam) { if (FAMILY[fam].indexOf(primaryId) >= 0) { FAMILY[fam].forEach(function (sib) { if (sib !== primaryId) analogies.push({ analogy: primaryId + ' resembles ' + sib, family: fam, label: 'ANALOGY', evidenceStatus: 'UNVERIFIED', note: 'shared structural failure-family — a lens for monitoring, not a claim' }); }); } });

    // promotion: a hunch recurring >=3 cycles -> monitoring TARGET only (never diagnosis/evidence)
    var hm = this._hunchMemory = this._hunchMemory || {};
    var curKeys = {}; hunches.forEach(function (h) { curKeys[h.hunch] = true; hm[h.hunch] = (hm[h.hunch] || 0) + 1; });
    var promotedToMonitoring = [], rejectedHunches = [];
    Object.keys(hm).forEach(function (k) {
      if (!curKeys[k]) { rejectedHunches.push({ hunch: k, reason: 'signal subsided across cycles (falsifier path)' }); delete hm[k]; return; }
      if (hm[k] >= 3) promotedToMonitoring.push({ target: k, basis: 'recurred ' + hm[k] + ' cycles', note: 'monitoring target ONLY — never evidence or diagnosis' });
    });

    var it = {
      version: 1, hunches: hunches.slice(0, 3), weakSignals: hunches.map(function (h) { return h.why; }),
      patternMatches: patternMatches.slice(0, 5), analogies: analogies.slice(0, 4), confidence: 'LOW', evidenceStatus: 'UNVERIFIED',
      promotedToDiagnosis: [],   // NEVER auto-promoted — verification is a human/source step
      promotedToMonitoring: promotedToMonitoring.slice(0, 4), rejectedHunches: rejectedHunches.slice(0, 4), lastIntuitionAt: em.updated || null
    };
    s.supplyChainIntuition = it; return it;
  };

  // H5 — simulation / bounded counterfactual (hypothetical only)
  TradeBrain.prototype._computeSupplyChainSimulation = function () {
    var s = this.state, em = s.supplyChainModel || {};
    var base = typeof s.stress === 'number' ? s.stress : 0;
    function cl(v) { return Math.max(0, Math.min(1, Math.round(v * 1000) / 1000)); }
    var scenarios = [
      { type: 'worsen', hypothetical: true, assumption: 'stressor intensifies', simulatedStress: cl(base + 0.2), risk: 'cascade toward systemic supply-chain stress', intervention: 'monitor freight indices / port throughput (BTS/FMCSA)', falsifier: 'stress flat or falling next cycle' },
      { type: 'stabilize', hypothetical: true, assumption: 'stressor holds', simulatedStress: cl(base), risk: 'persistent elevated baseline', intervention: 'maintain monitoring cadence', falsifier: 'stress moves materially' },
      { type: 'recover', hypothetical: true, assumption: 'stressor reverses', simulatedStress: cl(base - 0.2), risk: 'premature de-escalation', intervention: 'confirm with 2 independent sources before standing down', falsifier: 'stress re-rises' },
      { type: 'supply-shortage', hypothetical: true, assumption: 'material disruption drives a price spike', simulatedStress: cl(base + 0.3), risk: 'sourcing collapse + sectoral propagation (SUPPLY_CHAIN_COLLAPSE)', intervention: 'track supplier concentration / inventory days / commodity indices', falsifier: 'inventories stable; alt-sourcing available' },
      { type: 'port-blockade', hypothetical: true, assumption: 'chokepoint closure adds shipping cost + delay', simulatedStress: cl(base + 0.28), risk: 'route constraint + transit-time blowout (PORT_BLOCKADE)', intervention: 'BTS port throughput / Coast Guard notices / alternate port-pairs', falsifier: 'throughput normal; routes uncongested' },
      { type: 'trade-war', hypothetical: true, assumption: 'tariff escalation + retaliation', simulatedStress: cl(base + 0.25), risk: 'cost transmission + demand destruction (TRADE_WAR)', intervention: 'track USTR actions / Federal Register / HS-code tariff schedules', falsifier: 'tariff actions stall; carve-outs granted' },
      { type: 'customs-delay', hypothetical: true, assumption: 'documentation/clearance backlog builds', simulatedStress: cl(base + 0.22), risk: 'clearance failure + working-capital lock (CUSTOMS_DISRUPTION)', intervention: 'CBP notices / clearance lead-times / broker capacity', falsifier: 'clearance times normalize' },
      { type: 'carrier-stress', hypothetical: true, assumption: 'carrier capacity constraint tightens', simulatedStress: cl(base + 0.24), risk: 'freight rate spike + service failure (SHIPPING_CRISIS)', intervention: 'ATA tonnage / FMCSA registrations / spot-rate indices', falsifier: 'capacity loosens; rates fall' }
    ];
    var sim = {
      version: 1, scenarios: scenarios, assumptions: scenarios.map(function (x) { return x.assumption; }),
      simulatedStress: scenarios.map(function (x) { return x.simulatedStress; }),
      simulatedDiagnoses: ['SUPPLY_CHAIN_COLLAPSE', 'PORT_BLOCKADE', 'TRADE_WAR', 'SHIPPING_CRISIS', 'CUSTOMS_DISRUPTION'], simulatedOpportunities: [],
      risks: scenarios.map(function (x) { return x.risk; }), interventions: scenarios.map(function (x) { return x.intervention; }),
      falsifiers: scenarios.map(function (x) { return x.falsifier; }),
      themeEntities: ['FDX', 'UPS', 'EXPD', 'CHRW', 'ZIM', 'MATX', 'XPO', 'GXO', 'ODFL', 'AMKBY', 'DSDVY'],
      lastSimulatedAt: em.updated || null
    };
    s.supplyChainSimulation = sim; return sim;
  };

  // H6 — executive self-report (compact status card)
  TradeBrain.prototype._computeSupplyChainExecutiveReport = function () {
    var s = this.state, em = s.supplyChainModel || {}, im = s.supplyChainImmune || {}, aw = s.supplyChainAwareness || {}, con = s.supplyChainConscience || {}, it = s.supplyChainIntuition || {}, sim = s.supplyChainSimulation || {}, bs = this._supplyChainBundleStates();
    var covered = bs.filter(function (b) { return b.bundleStatus === 'found'; }).length;
    var hv = bs.filter(function (b) { return b.humanVerification === 'required'; }).length;
    var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var strongest = active[0] || (s.diagnoses || [])[0] || null;
    var pe = (em.predictionError && em.predictionError.total) || 0;
    var status = im.immuneState === 'alert' ? 'immune-alert' : hv > 0 ? 'human-review-required' : (bs.length && covered < bs.length) ? 'source-limited' : (em.regulation && em.regulation.starving) ? 'starving' : (em.regulation && em.regulation.state === 'surprised') ? 'surprised' : 'healthy';
    var rep = {
      version: 1, brainStatus: status,
      strongestDiagnosis: strongest ? strongest.id : null,
      strongestOpportunity: (s.opportunities && s.opportunities[0] && s.opportunities[0].title) || null,
      confidence: Math.round((1 - pe) * 100) / 100, predictionError: Math.round(pe * 1000) / 1000,
      regulationState: (em.regulation && em.regulation.state) || null, immuneState: im.immuneState || null,
      awarenessSummary: aw.selfNarrative || null, conscienceDecision: con.conscienceState || null,
      intuitionSummary: (it.hunches || []).length + ' hunch(es)', simulationSummary: (sim.scenarios || []).length + ' scenario(s)',
      artifactReadiness: con.artifactReadinessDecision || null, blockers: (con.blockedClaims || []).slice(0, 6),
      nextBestAction: covered < bs.length ? 'build/verify source for uncovered diagnoses' : hv > 0 ? 'human-verify external-source bundles' : 'monitor strongest diagnosis sources',
      lastReportAt: em.updated || null
    };
    s.supplyChainExecutiveReport = rep; return rep;
  };

  TradeBrain.prototype._computeSupplyChainHigherLayers = function () {
    this._computeSupplyChainImmune();
    this._computeSupplyChainAwareness();
    this._computeSupplyChainConscience();
    this._computeSupplyChainIntuition();
    this._computeSupplyChainSimulation();
    this._computeSupplyChainExecutiveReport();
  };

  TradeBrain.prototype._buildDomainDiagnosisPacket = function (dx) {
    var s = this.state || {};
    var em = s.supplyChainModel || {};
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

    var feeds = s.feeds || [], sourceFeeds = [];
    if (Array.isArray(feeds)) {
      feeds.forEach(function (f) { if (f && typeof f === 'object') sourceFeeds.push({ name: f.name || f.label || 'feed', updated: f.updated || null, source: f.source || null }); });
    } else {
      for (var fk in feeds) { if (feeds.hasOwnProperty(fk)) { var f = feeds[fk]; if (f && typeof f === 'object') sourceFeeds.push({ name: f.name || fk, updated: (f && f.updated) || null, source: (f && f.source) || null }); } }
    }
    if (s._primarySource && !sourceFeeds.length) sourceFeeds.push({ name: 'primary', updated: null, source: s._primarySource });

    var _canon = this._resolveCanonicalDiagnosis(dxId);
    var identity = {
      domain: 'supplyChain',
      diagnosisId: dxId,
      canonicalDiagnosisId: _canon.canonicalDiagnosisId,   // F3: alias map or canonical-to-self
      aliasUsed: _canon.aliasUsed,
      aliasReviewStatus: _canon.aliasReviewStatus,
      aliasRisk: _canon.aliasRisk,
      aliasNote: _canon.aliasNote,
      label: dx ? (dx.label || dx.id || null) : null,
      phase: s.phase || null,
      confidence: (dx && typeof dx.relevance === 'number') ? dx.relevance : (typeof s.confidence === 'number' ? s.confidence : null)
    };
    // G1 — real source bundle for this canonical id (shipped only when it exists; NEVER fabricated).
    var _bundle = (this._bundleCache && this._bundleCache[identity.canonicalDiagnosisId]) || null;
    var _bundleKnown = !!(this._bundleStatusMap && Object.prototype.hasOwnProperty.call(this._bundleStatusMap, identity.canonicalDiagnosisId));
    var _bl = (_bundle && _bundle.byLane && _bundle.byLane.patents) ? _bundle.byLane.patents : null;
    var _bArr = function (k) { return (_bl && Array.isArray(_bl[k])) ? _bl[k] : []; };
    var bundleStatus = _bundle ? 'found' : (_bundleKnown ? 'missing' : 'unknown');
    var bundleShallow = !!(_bundle && ((_bundle.maxDepth || 0) === 0 || (_bundle.portalCount || 0) <= 1));
    var bundleResolution = identity.aliasUsed
      ? (_bundle ? 'alias-resolved-and-bundle-found' : 'alias-resolved-but-bundle-missing')
      : (_bundle ? 'found' : (_bundleKnown ? 'missing' : 'unknown'));
    if (!treatments.length && _bl) treatments = _bArr('treatments');             // backfill from REAL bundle only
    if (!implementationSteps.length && _bl) implementationSteps = _bArr('implementationSteps');
    var brainState = {
      supplyChainModel: { version: em.version || null, cycle: (typeof em.cycle === 'number' ? em.cycle : null) },
      predictionError: em.predictionError || null,
      regulationState: (em.regulation && em.regulation.state) || null,
      prior: em.prior || null,
      observation: em.observation || null,
      plasticity: em.plasticity || null,
      readyForHandoff: em.readyForHandoff === true
    };
    // F2: domain-identity portal fields are KNOWN facts (this IS the trade root),
    // so they populate from constants even when the brain has not cached L0 content yet.
    var rootId = (portal && portal.domainId) || 'trade';
    var rootTitle = (portal && portal.title) || 'Supply Chain';
    var ancestry = (portal && portal.parentLabel) ? [portal.parentLabel, rootTitle] : [rootTitle];
    var portalContext = {
      portalIds: [rootId],
      portalDomain: 'trade',
      portalTitle: rootTitle,
      depth: 0,                               // brain operates at the root level only
      ancestryPath: ancestry,
      portalStatus: portal ? 'root-only' : 'pending',  // L0 cached vs not-yet; never deeper (Phase C)
      sourceCompleteness: portal ? ((Array.isArray(portal.issues) && portal.issues.length) ? 'partial' : 'thin') : 'root-only',
      bundleSource: (_bundle && Array.isArray(_bundle.sourcePortals) && _bundle.sourcePortals.length)   // G1: bundle's own corpus source (distinct from trade root)
        ? { portalIds: _bundle.sourcePortals.map(function (sp) { return sp.portalId; }), depth: _bundle.maxDepth || 0, ancestryPath: (_bundle.sourcePortals[0].ancestry || []), domains: _bundle.domains || [] }
        : null,
      // J1 — L1 scan result for this diagnosis: treatments are mad-lib (NOT admitted); only real tickers surface, relevance-unverified
      l1Depth: (s._l1DepthCache && s._l1DepthCache.byDiagnosis && s._l1DepthCache.byDiagnosis[dxId]) || (s._l1DepthCache ? { branchesScanned: 0, realCompanyTickers: [], realTreatments: 0, madLibTreatments: 0, admitted: false, reason: 'no L1 branch mapped for this diagnosis' } : null)
    };
    var citationHints = sourceFeeds.map(function (sf) { return sf.source || sf.name; }).filter(Boolean);
    var evidenceAnchors = _bArr('evidenceAnchors');   // G1: REAL bundle anchors only (empty if no bundle)
    var missingEv = [];
    if (!evidenceAnchors.length) missingEv.push('evidenceAnchors');
    if (!citationHints.length) missingEv.push('citationHints');
    var evidence = {
      sourceFeeds: sourceFeeds,               // real — brain ingests these
      evidenceAnchors: evidenceAnchors,       // real bundle anchors (empty when no bundle)
      citationHints: citationHints,           // real source/feed names only (no invention)
      bundleStatus: bundleStatus,             // G1: found | missing | unknown
      bundleResolution: bundleResolution,
      bundle: _bundle ? { portalCount: _bundle.portalCount || 0, maxDepth: _bundle.maxDepth || 0, domains: _bundle.domains || [], lane: 'patents', shallow: bundleShallow, buildMethod: _bundle.buildMethod || null, humanVerification: _bundle.humanVerification || null } : null,
      missingEvidence: missingEv
    };
    // J2 — human-authoring intake: for external-source bundles missing invention candidates, emit
    // structured empty slots (what each needs + which primary source) rather than fabricating them.
    var _isExternal = !!(_bundle && _bundle.buildMethod === 'external-source-authored');
    var _intakeSrcHint = { SUPPLY_SHORTAGE_EVENT: 'BTS freight flows / Census trade data / supplier concentration filings', SHIPPING_ROUTE_CONSTRAINT: 'BTS port throughput / USCG marine notices / 33 CFR / patent literature', TARIFF_ESCALATION_EVENT: 'USTR actions / Federal Register / HTS schedules / WTO disputes', SHIPPING_CRISIS: 'ATA truck-tonnage / FMCSA registrations / freight-rate indices', CUSTOMS_DISRUPTION: 'CBP rulings / 19 CFR / Federal Register CBP notices' };
    var authoringIntake = [];
    if (_isExternal) {
      ['methodCandidates', 'embodimentCandidates', 'figurePlaceholders'].forEach(function (field) {
        if (_bArr(field).length === 0) authoringIntake.push({ field: field, status: 'needs-human-input', count: 0, need: field === 'methodCandidates' ? 'a concrete technical method drawn from a primary source' : field === 'embodimentCandidates' ? 'a specific implementation/embodiment from a real document' : 'a figure description grounded in a real source', sourceHint: _intakeSrcHint[identity.canonicalDiagnosisId] || 'primary institutional / patent source (CBP / USTR / shipping-rate)', note: 'NOT fabricated by the brain — author from the cited source, then wire in verbatim with attribution' });
      });
    }
    var treatmentContext = {
      treatments: treatments,                 // real: brain-resolved, else real bundle treatments
      implementationSteps: implementationSteps,
      methodCandidates: _bArr('methodCandidates'),         // G1: REAL bundle only (empty if bundle lacks)
      mechanismCandidates: _bArr('mechanismCandidates'),
      embodimentCandidates: _bArr('embodimentCandidates'),
      figurePlaceholders: _bArr('figurePlaceholders'),
      authoringIntake: authoringIntake        // J2: empty-slot requests for human authoring (external-source bundles)
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
    var hasCanonical = !!identity.canonicalDiagnosisId;   // F3: now always resolves (alias or self)
    var blockers = [];
    if (hasCanonical && !hasBundle) blockers.push(identity.aliasUsed ? 'canonical-id-resolved-but-bundle-missing' : 'no-source-bundle');
    if (bundleStatus === 'missing') blockers.push('source-bundle-build-required');
    blockers.push(portalContext.portalStatus === 'root-only' ? 'portal-root-only' : 'portal-not-loaded');
    if (!hasTreat) blockers.push('no-treatments');
    if (!primaryOpp) blockers.push('no-active-opportunity');
    // artifact lanes from REAL opportunity path/compensation (present only on the gated console)
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
      patentReady: false, grantReady: false, sbaReady: false,   // patent/grant/loan lanes purged 2026-06-21 (also vetoed by H3 conscience)
      investmentReady: !!(hasTreat && primaryOpp), researchReady: ready || hasTreat,
      readinessReasons: readinessReasons,
      blockers: blockers
    };

    var comp = {
      identity:         _ddpCompleteness(identity, ['domain', 'diagnosisId', 'canonicalDiagnosisId', 'label', 'phase', 'confidence']),
      brainState:       _ddpCompleteness(brainState, ['supplyChainModel', 'predictionError', 'regulationState', 'prior', 'observation', 'plasticity']),
      portalContext:    _ddpCompleteness(portalContext, ['portalIds', 'portalDomain', 'portalTitle', 'depth', 'ancestryPath']),
      evidence:         _ddpCompleteness(evidence, ['sourceFeeds', 'evidenceAnchors', 'citationHints']),
      treatmentContext: _ddpCompleteness(treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']),
      operatorContext:  _ddpCompleteness(operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']),
      artifactContext:  _ddpCompleteness(artifactContext, ['artifactLanes'])
    };
    var totHave = 0, totAll = 0;
    for (var sk in comp) { if (comp.hasOwnProperty(sk)) { totHave += comp[sk].have; totAll += comp[sk].total; } }
    var missingFields = [];
    function _cm(name, obj, keys) { for (var i = 0; i < keys.length; i++) { if (!_ddpPresent(obj[keys[i]])) missingFields.push(name + '.' + keys[i]); } }
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
    if (!primaryOpp && (typeof s.stress !== 'number' || s.stress < EM_STRESS_FLOOR)) warnings.push('no active opportunity (offline/low-stress) — operator/lane fields stay empty');
    if (artifactContext.artifactLanes.length && !hasTreat) warnings.push('artifact lane present but treatments/evidence missing');

    var pct = totAll ? Math.round(totHave / totAll * 100) : 0;
    var proofTier = pct >= 70 ? 'full' : (pct >= 35 ? 'partial' : 'sparse');

    // G2 — prompt-facing trimming/prioritization. FULL data above is preserved; this is a
    // bounded, diagnosis-relevant subset for the finalizer prompt. Never trims scalars/warnings.
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
        'diagnosis-specific bundle anchors preferred over generic trade evidence',
        'official/primary sources retained (CBP/USTR/BTS/FMCSA/USCG/WTO where present)',
        'mechanisms prioritized over figures under prompt-space limits',
        'treatments with implementation relevance preferred over broad narrative',
        'caps applied per field; full data preserved in the stored bundle + full DDP'
      ],
      retainedWarnings: warnings
        .concat(s.supplyChainImmune ? ['immune: ' + s.supplyChainImmune.immuneState + ' (sev ' + s.supplyChainImmune.severity + ', ' + (s.supplyChainImmune.antigens || []).length + ' antigens; L2 traversal blocked)'] : [])
        .concat(s.supplyChainConscience && s.supplyChainConscience.conscienceState === 'restrictive' ? ['conscience: ' + (s.supplyChainConscience.blockedClaims || []).slice(0, 3).join(', ') + ' blocked'] : []),
      retainedBlockers: artifactContext.blockers,
      // H1-H6 — compact higher-layer summaries (forwarded to the finalizer via promptView)
      immuneSummary: s.supplyChainImmune ? { immuneState: s.supplyChainImmune.immuneState, severity: s.supplyChainImmune.severity, antigenCount: (s.supplyChainImmune.antigens || []).length, quarantines: s.supplyChainImmune.quarantines, blockedFromTraversal: s.supplyChainImmune.blockedFromTraversal, allowedWithWarning: s.supplyChainImmune.allowedWithWarning } : null,
      awarenessSummary: s.supplyChainAwareness ? { selfNarrative: s.supplyChainAwareness.selfNarrative, knowns: (s.supplyChainAwareness.knowns || []).length, unknowns: (s.supplyChainAwareness.unknowns || []).length, humanReviewRequired: s.supplyChainAwareness.humanReviewRequired } : null,
      conscienceDecision: s.supplyChainConscience ? { conscienceState: s.supplyChainConscience.conscienceState, blockedClaims: s.supplyChainConscience.blockedClaims, artifactReadinessDecision: s.supplyChainConscience.artifactReadinessDecision } : null,
      intuitionSummary: s.supplyChainIntuition ? s.supplyChainIntuition.hunches : null,
      scenarioSummary: s.supplyChainSimulation ? (s.supplyChainSimulation.scenarios || []).map(function (x) { return { type: x.type, hypothetical: x.hypothetical, risk: x.risk }; }) : null,
      executiveReport: s.supplyChainExecutiveReport || null,
      // J1 — L1 depth verdict (real tickers only; treatments mad-lib, not admitted) ; J2 — authoring intake count
      l1DepthSummary: portalContext.l1Depth ? { realCompanyTickers: (portalContext.l1Depth.realCompanyTickers || []).length, realTreatments: portalContext.l1Depth.realTreatments, madLibTreatments: portalContext.l1Depth.madLibTreatments, admitted: portalContext.l1Depth.admitted } : null,
      authoringIntake: treatmentContext.authoringIntake.length ? treatmentContext.authoringIntake : null,
      // FREIGHT — trade-flow / freight-capacity sub-layer (real-content sub-layer, SEPARATE from the validated spine, no bundle yet)
      freightFlowSummary: s.freightFlowLayer && s.freightFlowLayer.loaded ? { count: s.freightFlowLayer.count, activeCount: s.freightFlowLayer.activeCount, diagnoses: s.freightFlowLayer.diagnoses, opportunities: s.freightFlowLayer.opportunities, note: s.freightFlowLayer.note } : null
    };

    return {
      schemaVersion: DDP_SCHEMA_VERSION,
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
        schemaVersion: DDP_SCHEMA_VERSION,
        fieldCompleteness: { sections: comp, overallPct: pct },
        missingFields: missingFields,
        warnings: warnings,
        proofTier: proofTier,
        // H1-H6 — full higher-layer objects (audit only; NOT forwarded to the finalizer prompt)
        immune: s.supplyChainImmune || null,
        awareness: s.supplyChainAwareness || null,
        conscience: s.supplyChainConscience || null,
        intuition: s.supplyChainIntuition || null,
        simulation: s.supplyChainSimulation || null,
        executiveReport: s.supplyChainExecutiveReport || null
      }
    };
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
