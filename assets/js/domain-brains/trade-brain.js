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

    // ══════════════════════════════════════════════════════════════════════
    // ACTUATION FLAGS — per-actuation VALIDITY GATE (honest, not a clone). Each flag is ON
    // only where trade has a REAL controllable effector (and, for phase-consistency calibration, a P3/P7 signal).
    // Ported to Energy's actuation depth (energy-brain.js), reading TRADE's own state/edges.
    //
    //  refractory: FALSE (advisory) — trade's action drafts are ALREADY permanently de-duplicated by
    //     the action-adapter ledger (_checkDiagnosisActions -> adapters.getDrafts), so a refractory
    //     dead-time can never bite (a diagnosis that fired once never re-emits regardless). Adding a
    //     limiter would be cosmetic; left OFF rather than faked. (Energy's refractory rides an external
    //     energy-specific module; trade has no equivalent and would not touch other files.)
    //  servo: TRUE — real sensor->controller(PI)->effector loop. Sensor = excitatory drive (stress +
    //     concurrent conditions + active diagnoses) vs inhibition (supplyChainModel.regulation.inhibition,
    //     which trade already computes); effector = proportional dampening of emitted opportunity
    //     confidence (the same view-level channel energy dampens). No fabricated effector.
    //  eiBrake: TRUE — consumes the servo: inhibition that fails to track drive raises a proportional
    //     brake on emission continuously (Neuro Ref XIII.1). Same real effector as servo.
    //  phase: TRUE — trade has a live domain phase (state.phase) AND real P3 (THAL/NTS/CC) + P7
    //     (OFC/vmPFC) node archetypes, so a realized phase transition on the P3/P7 family raises the
    //     phase-consistency tier of the CENTRAL K4 gate (window.LIMENK4). This is self-consistency
    //     calibration (interpretive), NEVER an external / ground-truth reward. The phase-coherence
    //     router (patent matrix M) couples to co-phased stressed peers deterministically.
    //  selfAudit: TRUE — trade carries a real 70-edge connectome (trade.json .edges); the advisory
    //     consumes it each cycle for single-points-of-failure + hubs (observe-only, like energy).
    this._actuation = { overlays: true, overlays: true, refractory: false, servo: true, eiBrake: true, phase: true, selfAudit: true };
    this._servoIntegral = 0;

    // ── THING2 RECURSIVE PHASE KERNEL wiring (real kernel via window.LIMENThing2; pure math) ──
    // Persistent stress series feeding the kernel's phase read. Guarded for absent localStorage.
    try {
      var _raw = (typeof localStorage !== 'undefined' && localStorage) ? localStorage.getItem('limen:phaseseries:trade') : null;
      this._phaseSeries = (_raw ? JSON.parse(_raw) : []) || [];
    } catch (e) { this._phaseSeries = []; }
    if (!Array.isArray(this._phaseSeries)) this._phaseSeries = [];
    this._kernelPhase = null;    // null => fall back to the existing naive/static phase
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
    // ACTUATED EMISSION EFFECTOR (E/I brake + phase-coherence window) — reads the PRIOR cycle's
    // servo/phase (one-cycle lag: they are computed at the end of _updateSupplyChainModel, after
    // opportunities are built). Bounded, reversible via _actuation.eiBrake / _actuation.phase.
    try { opps = this._applyTradeEmissionActuation(opps); } catch (e) {}

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
        // Neuro-substrate telemetry (advisory): map live pulse -> runtime overlay via generic adapter.
        try {
          if (window.DomainTelemetryAdapter && typeof window.DomainTelemetryAdapter.fromLiveCached === "function") {
            window.DomainTelemetryAdapter.fromLiveCached("trade", self.state, self._runtimeOverlay || null)
              .then(function (ov) { if (ov) self._runtimeOverlay = ov; }).catch(function () {});
          }
        } catch (_e) {}

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
      try { self._computeTradeOverlays(); } catch (e) {}   // NEURO-SUBSTRATE OVERLAY WIRING (per-domain, ported from finance/energy 2026-07-21): invokes trade's OWN overlay modules each cycle; shadow, proposals only
    });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // NEURO-SUBSTRATE OVERLAY WIRING — per-domain copy of energy's _computeEnergyOverlays
  // (2026-07-21, full per-domain independence). Invokes trade's OWN modules
  // (window.Trade{Metaplasticity,Extinction,RetrogradeThrottle,PredictionErrorCompressor,
  // OfflineMaintenance,NeuroSubstrate,ConnectivityAudit}) against trade's OWN runtime def
  // (trade.json runtime.params + edges/issues/activations). SHADOW: writes state.tradeOverlays;
  // the only actuation is metaplasticity -> the refractory dead-time (matches energy exactly).
  // Degrade-safe: returns mode 'off' when the modules are not on the page (they load only on the
  // trade console), 'loading' until trade.json arrives.
  // ════════════════════════════════════════════════════════════════════════════
  TradeBrain.prototype._loadTradeDef = function () {
    if (this._tradeDef) return this._tradeDef;
    if (this._tradeDefLoading) return null;
    this._tradeDefLoading = true;
    var self = this;
    if (typeof fetch === 'function') {
      try {
        fetch('/assets/data/domains/trade.json').then(function (r) { return r.json(); })
          .then(function (def) { self._tradeDef = def; })
          .catch(function () { self._tradeDefLoading = false; });
      } catch (e) { this._tradeDefLoading = false; }
    }
    return null;
  };

  TradeBrain.prototype._computeTradeOverlays = function () {
    var s = this.state;
    function mod(glob, reqPath) {
      if (typeof window !== 'undefined' && window[glob]) return window[glob];
      if (typeof module !== 'undefined') { try { return require(reqPath); } catch (e) {} }
      return null;
    }
    var META = mod('TradeMetaplasticity', '../trade-metaplasticity.js');
    var EXT = mod('TradeExtinction', '../trade-extinction.js');
    var RETRO = mod('TradeRetrogradeThrottle', '../trade-retrograde-throttle.js');
    var PEC = mod('TradePredictionErrorCompressor', '../trade-prediction-error-compressor.js');
    var OFF = mod('TradeOfflineMaintenance', '../trade-offline-maintenance.js');
    var NS = mod('TradeNeuroSubstrate', '../trade-neuro-substrate.js');
    var CONN = mod('TradeConnectivityAudit', '../trade-connectivity-audit.js');
    if (!(META && EXT && RETRO && PEC && OFF && NS && CONN)) {
      s.tradeOverlays = { version: 1, mode: 'off', note: 'overlay modules not loaded on this page (present only on the trade console)' };
      return null;
    }
    var def = this._loadTradeDef();
    if (!def) { s.tradeOverlays = { version: 1, mode: 'loading', note: 'trade.json runtime def loading; overlays compute next cycle' }; return null; }

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

    var intero = s.tradeInteroception || (s.cognition && s.cognition.interoception) || {};
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

    s.tradeOverlays = {
      version: 1, mode: 'shadow', armed: armed,
      volatility: Math.round(volatility * 1000) / 1000,
      metaplasticity: { changes: meta.changes, adapted: adapted, noop: meta.noop },
      extinction: { candidates: ext.candidates, count: ext.candidates.length, noop: ext.noop, actuation: 'PROPOSAL-ONLY (retiring a node edits trade.json — human-gated forever)' },
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
    s.tradeOverlays.mode = armed ? 'armed' : 'shadow';
    s.tradeOverlays.applied = applied;
    s.tradeOverlays.actuationScope = 'metaplasticity->refractory dead-time ONLY (bounded, fail-toward-quiet, reversible). throttle=no-live-consumer; PE=observe-only; extinction+offline-prune=PROPOSAL-ONLY (remove structure, human-gated forever).';
    s.tradeOverlays.note = 'PER-DOMAIN OVERLAY WIRING (ported from energy): trade runs its OWN 6 overlay modules + connectivity recurrenceAudit each cycle on trade.json. ARMED: metaplasticity raises the refractory dead-time with volatility (clamped, reversible). Everything else is proposal/observe-only.';

    if (s.cognition && typeof s.cognition === 'object') s.cognition.overlays = s.tradeOverlays;
    return s.tradeOverlays;
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

    // ── ACTUATED SERVO (regulate-to-target) — reads the fresh regulation.inhibition ──
    var _servo = null;
    try { if (this._actuation && this._actuation.servo) _servo = this._computeTradeServo(reg); } catch (e) {}
    // ── THING2 KERNEL PHASE — push this cycle's stress scalar + read the REAL recursive phase
    //    kernel (pure math via window.LIMENThing2; no network, no AI). Runs every cycle regardless
    //    of _actuation.phase so the persistent series never gaps. Sets this._kernelPhase (or null).
    try { this._updateKernelPhase(); } catch (e) {}
    // ── ACTUATED PHASE DYNAMICS (coherence router + transition consistency) ──
    var _pd = null;
    try { if (this._actuation && this._actuation.phase) _pd = this._computeTradePhaseDynamics(); } catch (e) {}
    // ── SELF-AUDIT ADVISORY (E/I read + SPOF over the 70-edge connectome; observe-only) ──
    try { if (this._actuation && this._actuation.selfAudit) this._computeTradeRegulationAdvisories(_servo); } catch (e) {}

    // a FINAL decision that depends on the prior, not just on raw obs:
    var readyForHandoff = (em.cycle > 0) && (predictedStress >= EM_STRESS_FLOOR) && (obs.diagnosisCount > 0) && !reg.flooding && !reg.stale;

    // K4 credit assignment — routed through the CENTRAL honest reward gate (window.LIMENK4).
    // Trade is NOT externalRewardEligible: it has no external realized-outcome label, so
    // externalOutcome is ALWAYS null and its credit is self-consistency calibration (interpretive),
    // NEVER an external / ground-truth / dopaminergic reward. The gate's preemption order is
    // external-reward(4) > phase-consistency(3) > call-consistency(2) > stress-consistency(1) > none;
    // for trade only tiers 3/2/1 (all self-consistency) can ever fire. Low credit raises the effective
    // learning rate. Reversible via _actuation.phase. One-cycle lag on the ledger (domainNeuro) and on
    // the stress self-prediction track (tradeOutcomeModel, computed later in the cycle).
    var _lr = em.plasticity.learningRate;
    var _pt = _pd && _pd.transition;
    var _phaseOn = !!(this._actuation && this._actuation.phase);
    var _led = (this.state.domainNeuro && this.state.domainNeuro.outcomeLedger) || null;
    var _om = this.state.tradeOutcomeModel || null;   // prior cycle's realized-stress self-prediction track
    var _k4hit, _k4source, _k4reward;
    if (typeof window !== 'undefined' && window.LIMENK4) {
      var _sig = {
        externalOutcome: null,                                  // trade is NOT externalRewardEligible — never reward
        phaseValidated: _phaseOn && !!(_pt && _pt.validated),   // P3/P7 family gate for the phase-consistency tier
        phaseTransitionHit: (_phaseOn && _pt && _pt.hit !== null) ? (_pt.hit ? 1 : 0) : null,   // thing2 realized transition (self-consistency)
        callHitRate: (_led && typeof _led.hitRate === 'number') ? _led.hitRate : null,          // TRUTH BRAKE ledger
        callSamples: (_led && typeof _led.samples === 'number') ? _led.samples : 0,
        stressSelfPred: (_om && typeof _om.callHitRate === 'number') ? _om.callHitRate : null,   // stress self-prediction agreement
        stressSamples: (_om && typeof _om.samples === 'number') ? _om.samples : 0
      };
      var _k4 = window.LIMENK4.credit(_sig);
      _k4hit = (_k4 && _k4.credit != null) ? _k4.credit : null;
      _k4source = (_k4 && _k4.creditSource) || 'none';
      _k4reward = !!(_k4 && _k4.isReward);                       // always false for trade (self-consistency only)
    } else {
      // FALLBACK (central gate absent) — prior self-consistency behavior, unchanged. NEVER reward.
      var _phaseHit = !!(_phaseOn && _pt && _pt.validated && _pt.hit !== null);
      var _fromLedger = !_phaseHit && !!(_led && typeof _led.hitRate === 'number' && _led.samples >= 3);
      _k4hit = _phaseHit ? (_pt.hit ? 1 : 0) : (_fromLedger ? _led.hitRate : null);
      _k4source = _phaseHit ? 'phase-consistency' : (_fromLedger ? 'call-consistency' : 'none');
      _k4reward = false;
    }
    if (_k4hit !== null) _lr = _emClamp(_lr * (1 + (1 - _k4hit)), EM_SLOW_RATE, 0.6);
    em._effectiveLearningRate = _lr;
    em._creditSource = _k4source;
    em._creditIsReward = _k4reward;   // self-consistency calibration (interpretive), never external reward for trade
    var nextPrior = this._updatePrior(priorIn, obs, _lr); // → next cycle reads this

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
        model: { cycle: em.cycle, predictionError: em.predictionError, predictedStress: em.predictedStress, regulation: em.regulation, creditSource: em._creditSource, effectiveLearningRate: em._effectiveLearningRate },
        awareness: this.state.supplyChainAwareness || null,
        conscience: this.state.supplyChainConscience || null,
        immune: this.state.supplyChainImmune || null,
        intuition: this.state.supplyChainIntuition || null,
        // ACTUATED layers (additive; new keys only) — mirror energy's cognition.servo / .phaseDynamics
        servo: this.state.tradeServo || null,
        phaseDynamics: this.state.tradePhaseDynamics || null,
        regulationAdvisories: this.state.tradeRegulationAdvisories || null
      };
    } catch (e) {}

    // PHASE K — neuro-completion layers (K1-K8; additive, advisory; never rewires the spine).
    // Runs after the cognition surface is assembled so it can attach state.cognition.neuro, and
    // after the model/regulation/servo are fresh so each K-layer reads the current cycle. Ported
    // from energy-brain _computeEnergyNeuroLayers, reading TRADE's own state/edges. Deterministic.
    try { this._computeTradeNeuroLayers(); } catch (e) {}

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
  // ACTUATION METHODS (ported to Energy depth; TRADE's own state/edges). Deterministic, additive,
  // reversible via this._actuation.*; NO paid-AI / fetch-to-LLM ever runs from the cycle.
  // ════════════════════════════════════════════════════════════════════════════
  var SERVO_FLOOR = 0.15, SERVO_KP = 0.8, SERVO_KI = 0.4, SERVO_BASE_WINDOW = 60;

  // REGULATE-TO-TARGET SERVO (Neuro Ref XIII.1 E/I balance + V.2/XII allostasis). Mirror of
  // energy-brain _computeEnergyServo. Sensor = excitatory drive (stress + concurrent conditions +
  // active diagnoses) vs current inhibition; controller = PI (bounded integral + proportional);
  // effector = proportional emission-confidence dampening the opportunity step consumes next cycle.
  TradeBrain.prototype._computeTradeServo = function (reg) {
    function R(x) { return Math.round(x * 1000) / 1000; }
    var s = this.state;
    var stress = (typeof s.stress === 'number') ? s.stress : 0;
    var conds = Array.isArray(s._activeConditions) ? s._activeConditions.length : (Array.isArray(s.signals) ? s.signals.length : 0);
    var dxA = Array.isArray(s.diagnoses) ? s.diagnoses.filter(function (d) { return d && d.active; }).length : 0;
    var drive = Math.max(0, Math.min(2, stress + Math.min(conds, 12) / 24 + Math.min(dxA, 6) / 24));
    var inhibition = (reg && typeof reg.inhibition === 'number') ? reg.inhibition : 0;   // the live regulation term
    // deviation above a rolling baseline (adaptive set-point; same shape as the generic homeostasis)
    var hist = ((s.memory && s.memory.stressHistory) || []).slice(-SERVO_BASE_WINDOW);
    var base = 0.5; if (hist.length) { var sum = 0; for (var i = 0; i < hist.length; i++) sum += (hist[i].stress || 0); base = sum / hist.length; }
    var deviation = Math.max(0, stress - base);
    // TARGET (allostatic set-point): inhibition must track drive, and rise with deviation above baseline.
    var target = Math.max(SERVO_FLOOR, Math.min(1, Math.max(drive, SERVO_FLOOR + deviation)));
    var error = target - inhibition;                                        // >0 => under-braked for the drive/regime
    this._servoIntegral = Math.max(-0.5, Math.min(0.5, (this._servoIntegral || 0) + error * 0.15));
    var correction = Math.max(0, SERVO_KP * error + SERVO_KI * Math.max(0, this._servoIntegral));   // only ADD braking
    var emissionFactor = Math.max(0.2, Math.min(1, 1 - correction));       // effector (1 = no dampening)
    var state = error > 0.25 ? 'runaway-risk' : ((inhibition - target) > 0.4 ? 'over-inhibited' : 'balanced');
    var servo = {
      version: 1, actuated: true, drive: R(drive), inhibition: R(inhibition), target: R(target),
      error: R(error), integral: R(this._servoIntegral), emissionFactor: R(emissionFactor),
      state: state, deviation: R(deviation),
      note: 'closed-loop allostasis: drives inhibition toward a drive+deviation target; effector = proportional opportunity-confidence dampening. Neuro Ref XIII.1/V.2/XII.'
    };
    s.tradeServo = servo;
    return servo;
  };

  // THING2 RECURSIVE PHASE KERNEL read. Pushes the domain's PRIMARY scalar (state.stress — a STRESS
  // metric, up = worse, so positive:false) onto a persistent 60-sample series, then runs the REAL
  // Thing2 kernel via window.LIMENThing2.phaseOfSeries. PURE MATH: no network, no AI, deterministic.
  // On success sets this._kernelPhase + state.kernel*/phaseSource='thing2-kernel'; otherwise
  // this._kernelPhase stays null and phaseSource='fallback' (the naive/static phase is used).
  TradeBrain.prototype._updateKernelPhase = function () {
    // (1) append this cycle's primary stress scalar; cap length 60 (drop oldest); persist.
    try {
      var scalar = (typeof this.state.stress === 'number') ? this.state.stress : 0;
      if (!Array.isArray(this._phaseSeries)) this._phaseSeries = [];
      this._phaseSeries.push(scalar);
      while (this._phaseSeries.length > 60) this._phaseSeries.shift();
      try {
        if (typeof localStorage !== 'undefined' && localStorage) {
          localStorage.setItem('limen:phaseseries:trade', JSON.stringify(this._phaseSeries));
        }
      } catch (e) {}
    } catch (e) {}

    // (2) read the kernel (guarded). Default to fallback; only promote on a real phase.
    this._kernelPhase = null;
    this.state.phaseSource = 'fallback';
    try {
      if (typeof window !== 'undefined' && window.LIMENThing2 && this._phaseSeries.length >= 8) {
        var _kp = window.LIMENThing2.phaseOfSeries(this._phaseSeries, { positive: false });   // STRESS series
        if (_kp && _kp.phase) {
          this._kernelPhase = _kp.phase;
          this.state.kernelPhase = _kp.phase;
          this.state.kernelTrajectory = _kp.trajectory;
          this.state.kernelCAccum = _kp.cAccumulator;
          this.state.phaseSource = 'thing2-kernel';
        }
      }
    } catch (e) { this._kernelPhase = null; }
    return this._kernelPhase;
  };

  // PHASE-COHERENCE ROUTER + PHASE-TRANSITION CONSISTENCY. Mirror of energy-brain _computeEnergyPhaseDynamics.
  //  (A) router: couple to co-phased, stressed domains via the patent Section 3.4 Loop 1 matrix M.
  //  (B) phase consistency: whether a realized phase transition over time matched the brain's own
  //      prediction — SELF-CONSISTENCY CALIBRATION (interpretive), NEVER an external / ground-truth reward.
  //      The P3/P7 family (trade carries P3 THAL/NTS/CC + P7 OFC/vmPFC nodes) only gates the
  //      phase-consistency tier of the central K4 gate; it does NOT promote this to reward.
  TradeBrain.prototype._computeTradePhaseDynamics = function () {
    var s = this.state;
    var PHASE_M = {
      p3:  { p3: 0.08, p7a: 0.05, p9: 0.04, p0: -0.06 },
      p7a: { p7a: 0.10, p3: 0.04, p9: 0.06, p0: -0.08, p4: -0.04 },
      p7:  { p7: 0.10, p3: 0.04, p9: 0.06, p0: -0.08 },
      p4:  { p4: 0.05, p5: 0.04, p0: 0.03, p3: -0.04 },
      p5:  { p5: 0.05, p4: 0.04, p6: 0.03, p0: 0.03 },
      p6:  { p6: 0.06, p0: 0.04, p3: -0.05 },
      p9:  { p9: 0.08, p7a: 0.05, p0: -0.10, p4: -0.06 },
      p10: { p10: 0.06, p0: 0.05, p6: 0.03 }
    };
    var VALIDATED = { p3: 1, p7: 1, p7a: 1, p7b: 1 };               // P3/P7 family gate for phase-consistency tier — self-consistency, NOT external reward
    var BREAKING = { p1: 1, p3: 1, p7: 1, p7a: 1, p7b: 1, p9: 1 };  // recursion-arc BREAKING family = more-distressed
    function norm(p) { if (p == null) return null; p = String(p).toLowerCase().replace(/[^a-z0-9]/g, ''); if (p.charAt(0) !== 'p') p = 'p' + p; return p; }
    // PREFER the REAL thing2 recursive phase kernel when it produced a phase this cycle; otherwise
    // fall back to the existing naive/static domain phase (s.phase) UNCHANGED. Both the coherence
    // router (A) and the phase-transition consistency (B) below read this single myPhase.
    var myPhase = norm(this._kernelPhase || s.phase);

    // (A) COHERENCE ROUTER — couple to co-phased, stressed domains
    var doms = (typeof window !== 'undefined' && window.LIMENDomains) || {};
    var coupled = [], couplingStrength = 0;
    if (myPhase && PHASE_M[myPhase]) {
      var row = PHASE_M[myPhase];
      Object.keys(doms).forEach(function (k) {
        if (k === 'trade' || k === 'supplyChain') return;
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

    // (B) PHASE-TRANSITION CONSISTENCY — did a predicted transition actually occur (through time)?
    //     Self-consistency calibration (interpretive), NEVER an external reward.
    var hist = this._tradePhaseHistory = this._tradePhaseHistory || [];
    var prev = hist.length ? hist[hist.length - 1].phase : null;
    var transition = null;
    if (prev != null && myPhase != null && prev !== myPhase) {
      var fc = (s.domainNeuro && s.domainNeuro.forecast) || null;
      var predictedUp = fc
        ? (fc.direction === 'rising' || (typeof fc.projectedStress === 'number' && fc.projectedStress > (s.stress || 0)))
        : ((s.supplyChainModel && typeof s.supplyChainModel.predictedStress === 'number') ? (s.supplyChainModel.predictedStress > (s.stress || 0)) : false);
      var wentUp = (BREAKING[myPhase] && !BREAKING[prev]) ? true : (BREAKING[prev] && !BREAKING[myPhase]) ? false : null;
      var hit = (wentUp !== null) ? (wentUp === !!predictedUp) : null;
      var validated = !!(VALIDATED[myPhase] || VALIDATED[prev]);
      transition = { from: prev, to: myPhase, predictedUp: !!predictedUp, wentUp: wentUp, hit: hit,
        validated: validated, kind: validated ? 'self-consistency calibration (P3/P7 family, interpretive)' : 'self-consistency calibration (interpretive)' };
    }
    hist.push({ phase: myPhase, t: (s.supplyChainModel && s.supplyChainModel.updated) || Date.now() });
    if (hist.length > 24) hist.shift();

    var out = {
      version: 1, myPhase: myPhase,
      phaseSource: this.state.phaseSource || 'fallback',
      coupled: coupled.slice(0, 5), couplingStrength: Math.round(couplingStrength * 1000) / 1000,
      transition: transition,
      note: 'phase-coherence router (patent M matrix) + phase-transition consistency (thing2 lineage; self-consistency calibration only, NEVER external reward — the P3/P7 family gates only the phase-consistency tier of the central K4 gate). myPhase = REAL thing2 kernel (window.LIMENThing2, pure math) when available, else naive/static s.phase.'
    };
    s.tradePhaseDynamics = out;
    return out;
  };

  // SELF-AUDIT + E/I ADVISORY (Neuro Ref XIII.1 + XIV). Observe-only, deterministic. CONSUMES trade's
  // own 70-edge connectome (trade.json .edges — NOT in the live snapshot) for single-points-of-failure
  // + hubs, mirroring energy's _computeEnergyRegulationAdvisories. Edges lazily fetched + cached once
  // (browser fire-and-forget; server via require). Never mutates stress/scoring/trade.json.
  TradeBrain.prototype._computeTradeRegulationAdvisories = function (servo) {
    var s = this.state, out = { version: 1, observeOnly: true };
    // (1) E/I balance read from the servo (drive vs inhibition tracking).
    if (servo) out.eiBalance = { drive: servo.drive, inhibition: servo.inhibition, target: servo.target, state: servo.state, tracking: (servo.error <= 0.25) };
    // (2) SELF-AUDIT — consume the real graph.
    try {
      var self = this;
      var edges = this._tradeEdges || null;
      if (!edges) {
        if (typeof fetch === 'function' && !this._tradeEdgesPromise) {
          this._tradeEdgesPromise = fetch('/assets/data/domains/trade.json')
            .then(function (r) { return r.json(); })
            .then(function (j) { if (j && Array.isArray(j.edges)) self._tradeEdges = j.edges; })
            .catch(function () {});
        } else if (typeof require === 'function') {
          try { var ed = require('../../data/domains/trade.json'); if (ed && Array.isArray(ed.edges)) { this._tradeEdges = ed.edges; edges = ed.edges; } } catch (_e) {}
        }
      }
      if (edges && edges.length) {
        var audit = this._tradeSPOF(edges);
        out.selfAudit = { consumed: true, edgeCount: edges.length, spofCount: audit.articulationNodes.length,
          spof: audit.articulationNodes.slice(0, 5), topHubs: audit.topHubs.slice(0, 5) };
      } else {
        out.selfAudit = { consumed: false, note: 'edges loading (async, next cycle)' };
      }
    } catch (e) { out.selfAudit = { consumed: false, error: String(e && e.message || e).slice(0, 80) }; }
    s.tradeRegulationAdvisories = out;
    return out;
  };

  // Self-contained single-point-of-failure audit over the undirected connectome (Tarjan articulation
  // points + degree hubs). Small graph (~20 nodes / 70 edges) => recursion is safe. No external module.
  TradeBrain.prototype._tradeSPOF = function (edges) {
    var adj = {}, deg = {};
    function addN(n) { if (!adj[n]) { adj[n] = []; deg[n] = 0; } }
    for (var i = 0; i < edges.length; i++) {
      var a = edges[i].source, b = edges[i].target;
      if (!a || !b) continue;
      addN(a); addN(b); adj[a].push(b); adj[b].push(a); deg[a]++; deg[b]++;
    }
    var nodes = Object.keys(adj);
    var visited = {}, disc = {}, low = {}, parent = {}, ap = {}, timer = { t: 0 };
    function dfs(u) {
      visited[u] = true; disc[u] = low[u] = ++timer.t; var children = 0;
      for (var k = 0; k < adj[u].length; k++) {
        var v = adj[u][k];
        if (!visited[v]) {
          parent[v] = u; children++; dfs(v);
          low[u] = Math.min(low[u], low[v]);
          if (parent[u] === undefined && children > 1) ap[u] = true;
          if (parent[u] !== undefined && low[v] >= disc[u]) ap[u] = true;
        } else if (v !== parent[u]) {
          low[u] = Math.min(low[u], disc[v]);
        }
      }
    }
    for (var n = 0; n < nodes.length; n++) { if (!visited[nodes[n]]) { parent[nodes[n]] = undefined; dfs(nodes[n]); } }
    var hubs = nodes.map(function (x) { return { node: x, degree: deg[x] }; }).sort(function (a, b) { return b.degree - a.degree; });
    return { articulationNodes: Object.keys(ap), topHubs: hubs };
  };

  // ACTUATED EMISSION EFFECTOR — the servo/E-I brake + phase-coherence window actually ACT on the
  // emitted opportunity set (the same view-level channel energy dampens). Reads the PRIOR cycle's
  // tradeServo/tradePhaseDynamics (one-cycle lag: opportunities are built before _updateSupplyChainModel
  // computes them). Bounded [0.2,1], reversible via _actuation.eiBrake / _actuation.phase. Non-destructive:
  // opportunities are rebuilt fresh each cycle, so this never compounds.
  TradeBrain.prototype._applyTradeEmissionActuation = function (opps) {
    if (!opps || !opps.length) return opps;
    var servo = this.state.tradeServo || null;
    var pd = this.state.tradePhaseDynamics || null;
    var ei = !!(this._actuation && this._actuation.eiBrake && servo && typeof servo.emissionFactor === 'number' && servo.emissionFactor < 1);
    var factor = ei ? servo.emissionFactor : 1;
    var gated = 0;
    if (ei) {
      // proportional E/I dampening on emitted confidence (Neuro Ref XIII.1)
      for (var i = 0; i < opps.length; i++) { if (typeof opps[i].confidence === 'number') opps[i].confidence = Math.round(opps[i].confidence * factor); }
      // runaway-risk also soft-caps the ranked tail (feedback/recurrent inhibition)
      if (servo.state === 'runaway-risk' && opps.length > 1) {
        var keep = Math.max(1, Math.ceil(opps.length * factor));
        // PHASE-COHERENCE ACTUATION: coherent coupling to co-phased, stressed peers opens the window +1
        if (this._actuation && this._actuation.phase && pd && pd.couplingStrength > 0.15) keep = Math.min(opps.length, keep + 1);
        for (var k = keep; k < opps.length; k++) { opps[k].eiGated = true; gated++; }
      }
    }
    this.state._tradeEIGatedCount = gated;
    this.state._tradeEmissionFactorApplied = factor;
    return opps;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE K — TRADE NEURO-COMPLETION LAYERS (trade-local, additive, reversible).
  // Direct port of energy-brain.js K1-K8, reading TRADE's own state/edges (supplyChainModel,
  // trade feeds/diagnoses, the 70-edge trade.json connectome) — NOT energy's. Fills the brain
  // functions the self-model map flagged as missing / open-loop:
  //   K1 afferent integration, K2 neuromodulatory gain, K3 slow consolidation,
  //   K4 outcome / credit learning (TRUTH BRAKE: realized-stress self-prediction), K5 deep-
  //   perception depth, K6 attention, K7 lateral inhibition, K8 homeostatic set-point.
  // ADVISORY BY DESIGN: every layer COMPUTES and EXPOSES its signal on state; the ones that
  // CLOSE a loop do so through trade's EXISTING actuation channels (the K4 effective-learning-
  // rate already wired in _updateSupplyChainModel; the servo/E-I emission dampening in
  // _applyTradeEmissionActuation) — none rewires the validated scoring spine (stress, prior
  // update, diagnoses, portalError). Reads cached state only; NO network calls on the cycle;
  // NO paid-AI ever. Fully deterministic. Never fabricates evidence.
  // ════════════════════════════════════════════════════════════════════════════
  var TK_OUTCOME_BUFFER = 40;     // rolling predicted-vs-realized samples
  var TK_HOMEO_WINDOW = 60;       // cycles of stress baseline for the adaptive set-point

  // K1 — afferent inter-brain integration. Surfaces received cross-domain pressure and the stress
  // delta it contributes. Trade uses the BASE scoreStress (which folds getExternalPressure() into
  // stress each cycle, like the other 18 domains); this exposes that closed loop.
  TradeBrain.prototype._computeTradeAfferent = function () {
    var s = this.state, em = s.supplyChainModel || {};
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
      externalPressure: Math.round(pressure * 1000) / 1000,             // base-capped at 0.3
      receivedSignalCount: raw.length,
      activeSignalCount: active,
      contributors: contributors.slice(0, 6),
      integrated: true,                                                 // CLOSED — base scoreStress folds it into stress
      appliedStressDelta: Math.round(((s._externalPressureApplied) || 0) * 1000) / 1000,
      wouldRaiseStressBy: Math.round(pressure * 1000) / 1000,
      note: 'CLOSED: base scoreStress adds externalPressure to stress each cycle (matches the other 18 domains).',
      lastAfferentAt: em.updated || now
    };
    s.tradeAfferent = af; return af;
  };

  // K2 — neuromodulatory gain application. reg.gain/inhibition/outputScale are computed by
  // _computeRegulation. This shows the graded output modulation on opportunities. Trade's LIVE
  // effector is the servo emissionFactor applied in _applyTradeEmissionActuation (not a hard cap),
  // so this outputScale-implied cap is advisory alongside it.
  TradeBrain.prototype._computeTradeGainControl = function () {
    var s = this.state, em = s.supplyChainModel || {}, reg = em.regulation || {};
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
      appliedTargets: ['predictedStress (gain-blend in _updateSupplyChainModel)', 'opportunity emission (servo emissionFactor via _applyTradeEmissionActuation)'],
      unappliedTargets: ['stress', 'treatment surfacing'],
      lastEmissionFactorApplied: (typeof s._tradeEmissionFactorApplied === 'number') ? s._tradeEmissionFactorApplied : null,
      lastEIGatedCount: (s._tradeEIGatedCount || 0),
      note: 'CLOSED: emission confidence is scaled by the servo emissionFactor in _applyTradeEmissionActuation; predictedStress uses the same gain-blend.',
      lastGainAt: em.updated || Date.now()
    };
    s.tradeGainControl = gc; return gc;
  };

  // K3 — slow consolidation / long-term plasticity. EM_SLOW_RATE was reserved for rebuild/cron.
  // This maintains a PARALLEL slow-weight track that never touches em.prior; fast-vs-slow
  // divergence is a real regime-shift indicator.
  TradeBrain.prototype._consolidateTradeSlowModel = function () {
    var s = this.state, em = s.supplyChainModel || {}, obs = em.observation || null;
    var slow = s.tradeSlowModel || {
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
    slow.regimeShift = slow.fastSlowDivergence > 0.25;
    slow.updated = em.updated || Date.now();
    s.tradeSlowModel = slow; return slow;
  };

  // K4 — outcome / credit learning + TRUTH BRAKE (self-consistency calibration, NOT an external
  // reward). Compares each cycle's predictedStress against the NEXT cycle's realized stress — the
  // online forward-prediction loop. Measures how often the brain's own forecast comes true
  // (hitRate). NO dopaminergic/reward signal fabricated. Trade already closes the effective-
  // learning-rate loop in _updateSupplyChainModel via the central K4 gate's self-consistency credit
  // source (phase / call / stress consistency); this is the parallel realized-stress self-prediction track.
  TradeBrain.prototype._scoreTradeOutcomes = function () {
    var s = this.state, em = s.supplyChainModel || {};
    var buf = this._tradeOutcomeBuffer = this._tradeOutcomeBuffer || [];
    var obs = em.observation || null;
    if (this._tradePrevPrediction != null && obs && typeof obs.stress === 'number') {
      buf.push({ predicted: this._tradePrevPrediction, realized: obs.stress, err: Math.abs(this._tradePrevPrediction - obs.stress) });
      if (buf.length > TK_OUTCOME_BUFFER) buf.shift();
    }
    this._tradePrevPrediction = (typeof em.predictedStress === 'number') ? em.predictedStress : null;   // stash for next-cycle reconciliation
    var n = buf.length, sumErr = 0, sumSq = 0, hits = 0;
    for (var i = 0; i < n; i++) { sumErr += buf[i].err; sumSq += buf[i].err * buf[i].err; if (buf[i].err <= 0.1) hits++; }
    var callHitRate = n ? Math.round((hits / n) * 100) / 100 : null;
    var om = {
      version: 1,
      samples: n,
      meanRealizedError: n ? Math.round((sumErr / n) * 1000) / 1000 : null,     // does the forecast come true
      brierLike: n ? Math.round((sumSq / n) * 1000) / 1000 : null,
      hitRate: callHitRate,
      callHitRate: callHitRate,                                                  // fraction within 0.1 of realized (truth-brake calibration)
      loopType: 'online-continuous self-prediction (predicted-vs-next-realized stress); self-consistency truth-brake, NOT an external reward',
      creditAssignmentActive: (n >= 5),
      liveCreditSource: em._creditSource || null,                               // the source actually driving the effective learning rate this cycle
      effectiveLearningRate: (typeof em._effectiveLearningRate === 'number') ? em._effectiveLearningRate : null,
      note: 'CLOSED: _updateSupplyChainModel scales the effective learning rate from the central K4 gate self-consistency credit source; this track measures realized-stress self-prediction (truth brake).',
      lastOutcomeAt: em.updated || Date.now()
    };
    s.tradeOutcomeModel = om; return om;
  };

  // K5 — deep hierarchical perception. Aggregates the portal depth the brain HAS (from the existing
  // L1 branch-scan cache + the freight-flow sub-layer, no new fetches) and estimates the portalError
  // the recurrent model currently zeroes out (_computePredictionError hardcodes portalError=0).
  TradeBrain.prototype._computeTradePerceptionDepth = function () {
    var s = this.state, em = s.supplyChainModel || {};
    var l1 = s._l1DepthCache || null;
    var ff = s.freightFlowLayer || null;
    var l1Real = 0, l1Mad = 0;
    if (l1 && l1.byDiagnosis) { Object.keys(l1.byDiagnosis).forEach(function (k) { l1Real += (l1.byDiagnosis[k].realTreatments || 0); l1Mad += (l1.byDiagnosis[k].madLibTreatments || 0); }); }
    var levels = [
      { level: 'L0', name: 'root', status: (this._portalCache || s._portalCache) ? 'loaded' : 'pending' },
      { level: 'L1', name: 'branch-scan', status: l1 ? 'scanned' : 'pending', realTreatments: l1Real, madLibTreatments: l1Mad },
      { level: 'L2', name: 'deep-cortex', status: 'quarantined', note: 'mad-lib treatment cortex (immune-blocked)' },
      { level: 'FF', name: 'freight-flow-subportal', status: (ff && ff.loaded) ? 'loaded' : 'absent', activeCount: (ff && ff.activeCount) || 0 }
    ];
    var loadedDepth = (ff && ff.loaded) ? 3 : (l1 ? 1 : 0);
    var admissible = l1Real + ((ff && ff.count) ? ff.count : 0);
    var blocked = l1Mad + 1;                                            // +1 for the quarantined L2 tier
    var portalErrorEstimate = Math.round((blocked / Math.max(1, admissible + blocked)) * 1000) / 1000;
    var pd = {
      version: 1, levels: levels, deepestUsableLevel: loadedDepth,
      portalErrorEstimate: portalErrorEstimate,
      note: 'ADVISORY: perception stops at L1 (L2 mad-lib cortex quarantined); freight-flow is a separate real-content sub-layer. _computePredictionError still holds portalError=0 (no live traversal). No new fetches.',
      lastDepthAt: em.updated || Date.now()
    };
    s.tradePerceptionDepth = pd; return pd;
  };

  // K6 — attention / selective routing. Ranks top-down salience (active + relevance + novelty) over
  // the current diagnoses and names focus vs suppressed. Operator attention-focus steer boosts
  // salience. Observe-only (the live rank boost rides the existing opportunity emission path).
  TradeBrain.prototype._computeTradeAttention = function () {
    var s = this.state, em = s.supplyChainModel || {}, reg = em.regulation || {};
    var pe = (em.predictionError && em.predictionError.total) || 0;
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
      note: 'ADVISORY: salience ranking over the 5-diagnosis spine; operator attentionFocus boosts salience.',
      lastAttentionAt: em.updated || Date.now()
    };
    s.tradeAttention = at; return at;
  };

  // K7 — lateral inhibition (microcircuit). reg.inhibition implies a winner-take-most ranking among
  // competing active diagnoses; this surfaces it. The live non-winner down-weight rides the servo
  // E/I emission dampening in _applyTradeEmissionActuation.
  TradeBrain.prototype._computeTradeInhibition = function () {
    var s = this.state, em = s.supplyChainModel || {}, reg = em.regulation || {};
    var inhib = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;
    var active = (s.diagnoses || []).filter(function (d) { return d.active; })
      .sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var winner = active[0] || null;
    var li = {
      version: 1, inhibitionStrength: inhib,
      winner: winner ? winner.id : null,
      competitors: active.slice(1).map(function (d) { return { id: d.id, relevance: d.relevance, suppressBy: Math.round((d.relevance || 0) * inhib * 1000) / 1000 }; }).slice(0, 6),
      note: 'ADVISORY: winner-take-most among active diagnoses; the live down-weight is the servo E/I emission dampening in _applyTradeEmissionActuation.',
      lastInhibitionAt: em.updated || Date.now()
    };
    s.tradeInhibition = li; return li;
  };

  // K8 — homeostatic set-point (microcircuit). Trade uses fixed constants (EM_STRESS_FLOOR /
  // EM_FLOOD_CAP) as set-points. This maintains an adaptive baseline (Turrigiano-style synaptic
  // scaling) alongside them, without replacing the fixed floor. The servo consumes the same
  // deviation-above-baseline signal to set its allostatic target.
  TradeBrain.prototype._computeTradeHomeostasis = function () {
    var s = this.state, em = s.supplyChainModel || {};
    var win = ((s.memory && s.memory.stressHistory) || []).slice(-TK_HOMEO_WINDOW);
    var n = win.length, sum = 0;
    for (var i = 0; i < n; i++) sum += (win[i].stress || 0);
    var baseline = n ? sum / n : 0.5;                                  // adaptive set-point vs fixed EM_STRESS_FLOOR
    var cur = (typeof s.stress === 'number') ? s.stress : 0;
    var scalingFactor = baseline > 0 ? Math.round((0.5 / Math.max(0.1, baseline)) * 1000) / 1000 : 1;
    var hm = {
      version: 1,
      fixedFloor: EM_STRESS_FLOOR,                                     // current hardcoded set-point
      adaptiveBaseline: Math.round(baseline * 1000) / 1000,
      currentStress: cur,
      deviationFromBaseline: Math.round((cur - baseline) * 1000) / 1000,
      scalingFactor: scalingFactor,                                    // synaptic-scaling multiplier
      samples: n,
      note: 'ADVISORY: adaptive baseline (synaptic scaling) alongside the fixed EM_STRESS_FLOOR; the servo consumes deviationFromBaseline as its allostatic-target term.',
      lastHomeostasisAt: em.updated || Date.now()
    };
    s.tradeHomeostasis = hm; return hm;
  };

  // Assemble the neuro-completion surface. Runs all eight K-layers in the SAME order energy uses
  // (K1..K8), stores each on state (like tradeServo/tradePhaseDynamics), and attaches a compact
  // roll-up to state.cognition ADDITIVELY (new key `neuro`; existing keys untouched). Deterministic;
  // reads cached state only; no network / no AI.
  TradeBrain.prototype._computeTradeNeuroLayers = function () {
    this._computeTradeAfferent();          // K1 - afferent inter-brain input
    this._computeTradeGainControl();       // K2 - neuromodulatory gain application
    this._consolidateTradeSlowModel();     // K3 - slow consolidation / long-term plasticity
    this._scoreTradeOutcomes();            // K4 - outcome / credit learning (truth brake)
    this._computeTradePerceptionDepth();   // K5 - deep hierarchical perception
    this._computeTradeAttention();         // K6 - attention / selective routing
    this._computeTradeInhibition();        // K7 - lateral inhibition (microcircuit)
    this._computeTradeHomeostasis();       // K8 - adaptive set-point (microcircuit)
    var s = this.state;
    var neuro = {
      version: 1,
      status: 'advisory',                  // K-loops computed + exposed; closed loops ride existing actuation (servo/E-I, learning-rate)
      afferent: s.tradeAfferent || null,
      gainControl: s.tradeGainControl || null,
      slowModel: s.tradeSlowModel || null,
      outcomeModel: s.tradeOutcomeModel || null,
      perceptionDepth: s.tradePerceptionDepth || null,
      attention: s.tradeAttention || null,
      inhibition: s.tradeInhibition || null,
      homeostasis: s.tradeHomeostasis || null,
      closedLoops: [
        'K1 afferent -> base scoreStress (externalPressure folded into stress)',
        'K2 gain -> _applyTradeEmissionActuation (servo emissionFactor scales emitted confidence)',
        'K4 outcome -> _updateSupplyChainModel (credit source scales effective learning rate)',
        'K7 inhibition -> _applyTradeEmissionActuation (non-winner down-weight via servo E/I)',
        'K8 set-point -> _computeTradeServo (deviationFromBaseline sets the allostatic target)'
      ]
    };
    s.tradeNeuro = neuro;
    if (s.cognition && typeof s.cognition === 'object') s.cognition.neuro = neuro;   // additive: new key only
    return neuro;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // OPERATOR-ONLY (NEVER CALLED FROM THE CYCLE) — generative node->business authoring.
  // Turning a brain node into a written business thesis is a "code-cannot-do-this deterministically"
  // slot (semantic generation). It MUST NOT run on the 30s cycle: cost-safety / killswitch requires
  // that NO paid-AI / fetch-to-LLM call ever originates from cycle(). This documented stub is a guarded
  // NO-OP: real authoring is operator-triggered and routes through a SERVER endpoint that is killswitch-
  // gated server-side (lib/ai-kill-switch spendDisabled()); no API key ever lives in client code. The
  // live operator implementation is trade-node-business-engine.js, loaded ONLY on domain-console.
  // ════════════════════════════════════════════════════════════════════════════
  TradeBrain.prototype._authorNodeBusinessViaOperator = function (nodeId, opts) {
    // NO-OP by contract — the cycle never authors; the server enforces the ai-kill-switch.
    return { ok: false, reason: 'operator-trigger-only; cycle never authors; server enforces ai-kill-switch', nodeId: nodeId || null };
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
    // retired-lane veto removed 2026-07-14: patent/grant are dead lanes; vetoing them forced
    // conscienceState 'restrictive' every cycle. Real vetoes (missing source bundles) still drive it.
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
      bundle: _bundle ? { portalCount: _bundle.portalCount || 0, maxDepth: _bundle.maxDepth || 0, domains: _bundle.domains || [], lane: 'investments', shallow: bundleShallow, buildMethod: _bundle.buildMethod || null, humanVerification: _bundle.humanVerification || null } : null,
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
