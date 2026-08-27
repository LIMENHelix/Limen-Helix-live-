/**
 * infrastructure-brain.js — Infrastructure Domain Cognitive Engine
 *
 * Extends DomainBrainBase with full recursive intelligence depth.
 *
 * Feeds: Construction indices, transportation stress, grid reserve margins,
 *        federal spending data, maintenance backlogs, cyber event feeds
 *
 * Diagnosis matching: maps live signal conditions to infrastructure portal files
 *   GRID_DEGRADATION → grid_stress, utility_failure, aging infrastructure
 *   SUPPLY_CHAIN_BOTTLENECK → materials shortage, logistics disruption
 *   CAPACITY_OVERLOAD → capacity constraint, demand surge, congestion
 *   FUNDING_COLLAPSE → funding gap, fiscal crisis, budget cuts
 *   MAINTENANCE_DEFICIT → maintenance critical, asset deterioration
 *   CYBER_PHYSICAL_ATTACK → cyber attack, SCADA breach, sabotage
 *
 * Cross-domain emissions:
 *   infrastructure → energy (grid stress transmission)
 *   infrastructure → economy (construction drag)
 *   infrastructure → supplyChain (logistics constraint)
 *   infrastructure → population (service disruption)
 *
 * Actions:
 *   When convergence fires → draft grant application
 *   When company hits P7a → draft investor memo
 *   When diagnosis activates → draft patent opportunity
 *
 * Exposes: window.LIMENInfrastructureBrain
 */
(function () {
  'use strict';

  // Null-safe numeric formatter. Preserves null/undefined/NaN as "n/a"
  // in signal text instead of crashing on .toFixed.
  function fmtNumber(value, decimals, fallback) {
    if (value == null) return fallback || 'n/a';
    var n = Number(value);
    return Number.isFinite(n) ? n.toFixed(decimals) : (fallback || 'n/a');
  }

  if (!window.LIMENDomainBrainBase) {
    console.warn('[InfrastructureBrain] DomainBrainBase not loaded');
    return;
  }

  var Base = window.LIMENDomainBrainBase;

  var INFRA_PORTAL_TO_BRAIN = (window.LIMENDomainIdentity && window.LIMENDomainIdentity.INFRA_PORTAL_TO_BRAIN) || {};

  // ══════════════════════════════════════════════════════════════════════
  // INFRASTRUCTURE BRAIN
  // ══════════════════════════════════════════════════════════════════════

  function InfrastructureBrain() {
    Base.call(this, { groundedOnly: true,   // circularity cut 2026-07-24
      
      domainId: 'infrastructure',
      label: 'Infrastructure',
      snapshotKey: 'infrastructure',
      cycleInterval: 30000
    });
    this.resourceAuthority = { ownerDomain: 'infrastructure', policyId: 'infrastructure-resource/1', sandboxLane: 'real-estate', lanes: ['vendor-operations', 'real-estate', 'investment-advisory'], budgets: { computeUnitsPerCycle: 512, queueCapacity: 64 }, switches: { internalCycle: true, internalEmission: true, externalAction: false, spend: false, capital: false } };
    this.motorAuthority = { ownerDomain: 'infrastructure', contractId: 'infrastructure-motor/1', externalValveId: 'infrastructure:real-estate', lane: 'real-estate', decisionContract: 'property-transaction-decision/1', budgetId: 'infrastructure-real-estate-budget/1', receiptClass: 'counterparty-receipt', outcomeClass: 'accept-decline-or-close', rollbackClass: 'withdraw-or-terminate-under-policy', executorVerified: false, outcomeObserverVerified: false, switches: { prepare: true, simulate: true, external: false } };
  }

  // Inherit from base
  InfrastructureBrain.prototype = Object.create(Base.prototype);
  InfrastructureBrain.prototype.constructor = InfrastructureBrain;

  // ══════════════════════════════════════════════════════════════════════
  // INIT — register feeds, diagnosis index, emission rules
  // ══════════════════════════════════════════════════════════════════════

  InfrastructureBrain.prototype.init = function () {
    Base.prototype.init.call(this);

    // ── THING2 RECURSIVE PHASE KERNEL — persistent primary-scalar series (2026-07-13).
    // The REAL Thing2 kernel (assets/js/limen-thing2-adapter.js, pure math — NO network/AI)
    // becomes this brain's phase source for the coherence read + phase-transition
    // self-consistency calibration (interpretive; a realized transition is NEVER external reward),
    // replacing the naive per-cycle / static s.phase (kept as the fallback). We accumulate
    // the domain's primary STRESS scalar (up = worse -> positive:false) across cycles.
    this._phaseSeries = [];
    this._kernelPhase = null;
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        var _psRaw = localStorage.getItem('limen:phaseseries:infrastructure');
        if (_psRaw) { var _psArr = JSON.parse(_psRaw); if (Array.isArray(_psArr)) this._phaseSeries = _psArr; }
      }
    } catch (e) { this._phaseSeries = []; }

    // ── One-shot loaders (mirror energy-brain init): real entities, validated distress
    //    signals, real source bundles, L1 mad-lib scan, and the grid sub-portal layer. ──
    try { this._infraLoadCommandBoardCompanies(); } catch (e) {}  // C6-followup: real entities (state.companies starved)
    try { this._infraLoadBrainSignals(); } catch (e) {}           // distress ONLY from the validated Thing pipeline
    try { this._infraLoadDiagnosisBundles(); } catch (e) {}       // G1: load real artifact-source bundles (only ones that exist)
    try { this._infraLoadL1PortalDepth(); } catch (e) {}          // J1: scan L1 branches (treatments mad-lib -> NOT admitted; real tickers only)
    try { this._infraLoadGridDiagnoses(); } catch (e) {}          // GRID: load grid sub-portal (real-content, unbundled) as an additive LAYER

    // ── ACTUATION GATE (2026-07-13) — ports Energy's actuated depth, per-actuation VALIDITY-GATED.
    // Honest per-actuation decision (NOT a blanket clone):
    //  refractory : TRUE  — real effector = the REPORT_GENERATION action-draft emission in
    //                       _checkDiagnosisActions; the III.3 dead-time de-dups duplicate drafts.
    //                       Uses the shared, data-agnostic RefractoryLimiter module + the live
    //                       pulse/overlay timestamp. Same mechanism as energy-brain.
    //  servo      : TRUE  — real effector = emission dampening. A PI controller (fast proportional +
    //                       bounded slow integral, the HPA fast+slow arms) drives inhibition toward a
    //                       drive+deviation TARGET (allostasis, Neuro Ref V.2/XII). Infra emits
    //                       opportunities (with confidence) + action drafts + cross-domain signals —
    //                       a genuinely controllable output. Effector = _computeInfraBrake emissionFactor.
    //  eiBrake    : TRUE  — real effector = the same emission channel. When inhibition fails to track
    //                       drive (Neuro Ref XIII.1) the HALT brake dampens emission PROPORTIONALLY,
    //                       not just in discrete steps.
    //  phase      : FALSE — ADVISORY ONLY. A realized phase transition is SELF-CONSISTENCY
    //                       calibration (interpretive), NEVER external reward — even a validated
    //                       P3/P7 transition is self-consistency, not reward. External reward would
    //                       require a real external realized OUTCOME (Thing1's validated distress),
    //                       and the validated-kernel envelope is Finance + Population, NOT
    //                       infrastructure — so a realized infra phase transition can
    //                       never be more than advisory self-consistency here. And infra carries no
    //                       gain-control output-cap effector for a coherence router to widen (energy's
    //                       phase +1 rides on its K2 outputScale, which infra does not compute). We
    //                       COMPUTE the phase-coherence read for visibility (_computeInfraPhaseAdvisory)
    //                       but wire NO effector off it. Do NOT flip to true without a validated P3/P7
    //                       signal AND a real output-gating effector. (This mirrors Energy's own honest
    //                       UNMAPPED boundaries — see ENERGY_NEURO_AUDIT.md.)
    this._actuation = { refractory: true, servo: true, eiBrake: true, phase: false };
    // MIRRORS assets/data/domains/infrastructure.json runtime.params (the brain runs in its own
    // context and does not load that file); keep the two in sync when tuning.
    this._refractoryParams = {
      absoluteWindow: 900000,     // 15 min hard dead-time (operator-set; not in the document)
      relativeWindow: 3600000,    // 1 hr raised-bar window (doc 1:4 ratio preserved)
      overrideThreshold: 0.8      // only stress >= 0.8 re-fires a diagnosis draft in-window
    };

    // Diagnosis → signal condition mapping
    // These map live conditions to which diagnoses become active
    // Condition tokens are INFRASTRUCTURE-NATIVE feed signals (construction indices,
    // grid reserve margins, maintenance backlogs, federal spending) PLUS a small set of
    // external-domain event tokens (CYBER_ATTACK from tech/intelligence, SUPPLY_DISRUPTION).
    // The infra-native tokens (reserve_margin_low, capex_budget_decline, etc.) are emitted
    // by normalizeSignals from real feeds — grounding diagnosis activation in fed reality,
    // not borrowed energy-domain signals.
    this.diagnosisIndex = {
      'GRID_DEGRADATION':         ['grid_stress', 'utility_failure', 'INFRASTRUCTURE_ATTACK', 'aging_infrastructure', 'structural_stress', 'transmission_congestion', 'substation_bottleneck', 'transformer_backlog', 'reserve_margin_low', 'utility_capex_decline', 'substation_age_high', 'transformer_backlog_growing'],
      'SUPPLY_CHAIN_BOTTLENECK':  ['materials_shortage', 'logistics_disruption', 'SUPPLY_DISRUPTION', 'construction_delay', 'transformer_backlog', 'interconnection_delay'],
      'CAPACITY_OVERLOAD':        ['capacity_constraint', 'demand_surge', 'congestion', 'logistics_stress', 'datacenter_demand', 'peak_curtailment', 'transmission_congestion', 'cooling_infrastructure_strain', 'self_generation_strain'],
      'TRANSPORTATION_DISRUPTION':['road_network_failure', 'bridge_closure', 'transit_capacity_loss', 'port_disruption', 'modal_shift_stress', 'last_mile_failure', 'congestion', 'logistics_stress'],
      'INFRA_FUNDING_COLLAPSE':   ['funding_gap', 'FISCAL_CRISIS', 'budget_cut', 'bond_market_stress', 'capex_budget_decline', 'municipal_bond_yield_spike', 'federal_grant_unfunded'],
      'MAINTENANCE_DEFICIT':      ['maintenance_critical', 'asset_deterioration', 'inspection_failure', 'deferred_maintenance', 'substation_bottleneck', 'maintenance_backlog_cost_high', 'inspection_failure_rate', 'asset_condition_index_low'],
      'CYBER_PHYSICAL_ATTACK':    ['CYBER_ATTACK', 'INFRASTRUCTURE_ATTACK', 'SCADA_BREACH', 'physical_sabotage']
    };

    // Cross-domain emission rules — GATED: require at least 1 active diagnosis
    // Emissions from stress alone without diagnosis are suppressed
    this.emissionRules = [
      {
        targetDomain: 'energy',
        signalType: 'grid_stress_transmission',
        condition: function (s) { return s.stress >= 0.60 && s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.55); }
      },
      {
        targetDomain: 'economy',
        signalType: 'construction_drag',
        condition: function (s) { return s.stress >= 0.55 && s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); }
      },
      {
        targetDomain: 'supplyChain',
        signalType: 'logistics_constraint',
        condition: function (s) { return s.stress >= 0.60 && s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.50); }
      },
      {
        targetDomain: 'population',
        signalType: 'service_disruption',
        condition: function (s) { return s.stress >= 0.55 && s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.40); }
      },
      // ── New edges (infrastructure → finance / environment / technology) ──
      {
        // Infra distress drives capital/funding exposure (muni bonds, project finance).
        targetDomain: 'finance',
        signalType: 'capital_funding_pressure',
        condition: function (s) { return s.stress >= 0.55 && s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); }
      },
      {
        // Built-environment coupling — the infrastructure↔environment bridge (water/treatment/
        // climate-resilient systems). This is the rail Liz's environmental-engineering page rides.
        targetDomain: 'environment',
        signalType: 'built_environment_coupling',
        condition: function (s) { return s.stress >= 0.55 && s.diagnoses && s.diagnoses.some(function (d) { return d.active; }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); }
      },
      {
        // Cyber → technology, scoped to a cyber-physical diagnosis only (the vuln-surface owner).
        targetDomain: 'technology',
        signalType: 'cyber_physical_exposure',
        condition: function (s) { return s.stress >= 0.55 && s.diagnoses && s.diagnoses.some(function (d) { return d.active && /CYBER/i.test(d.id || d.name || ''); }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.50); }
      },
      {
        // Critical-infrastructure protection — cyber-physical attack on civil systems is a
        // defense concern (CISA KEV mappings, ICS/SCADA vuln, critical-facility attack surface).
        targetDomain: 'defense',
        signalType: 'critical_infrastructure_protection',
        condition: function (s) { return s.stress >= 0.60 && s.diagnoses && s.diagnoses.some(function (d) { return d.active && /CYBER/i.test(d.id || d.name || ''); }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.50); }
      },
      {
        // CISA/ICS threat-intel coupling — exploited-CVE / SCADA-breach signal feeds intelligence.
        targetDomain: 'intelligence',
        signalType: 'infrastructure_threat_intelligence',
        condition: function (s) { return s.stress >= 0.60 && s.diagnoses && s.diagnoses.some(function (d) { return d.active && /CYBER/i.test(d.id || d.name || ''); }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.55); }
      },
      {
        // Infrastructure → supplyChain transport edge — road/bridge/transit/port disruption
        // limits the physical movement of goods (distinct from the logistics_constraint edge).
        targetDomain: 'supplyChain',
        signalType: 'transport_network_capacity',
        condition: function (s) { return s.stress >= 0.55 && s.diagnoses && s.diagnoses.some(function (d) { return d.active && /TRANSPORT/i.test(d.id || d.name || ''); }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.50); }
      },
      {
        // Infrastructure is critical to food production — irrigation, drainage, rural roads,
        // grain storage. Physical-system degradation (NOT cost) constrains farm access/output.
        targetDomain: 'agriculture',
        signalType: 'irrigation_drainage_capacity',
        condition: function (s) { return s.stress >= 0.55 && s.diagnoses && s.diagnoses.some(function (d) { return d.active && /(SUPPLY_CHAIN_BOTTLENECK|MAINTENANCE_DEFICIT)/i.test(d.id || d.name || ''); }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.40); }
      },
      {
        // Infrastructure science (materials, structural resilience, sensor networks, climate-
        // adaptive design) surfaces applied-research investment opportunity. High bar.
        targetDomain: 'research',
        signalType: 'infrastructure_resilience_research_gap',
        condition: function (s) { return s.stress >= 0.60 && s.diagnoses && s.diagnoses.some(function (d) { return d.active && /(MAINTENANCE_DEFICIT|CYBER_PHYSICAL_ATTACK)/i.test(d.id || d.name || ''); }); },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); }
      }
    ];
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 2 OVERRIDE: Normalize signals into infrastructure-native semantics
  // ══════════════════════════════════════════════════════════════════════

  InfrastructureBrain.prototype.normalizeSignals = function () {
    var signals = [];
    var rawSignals = (this._rawDomain && this._rawDomain.signals) || [];
    for (var i = 0; i < rawSignals.length; i++) signals.push(rawSignals[i]);

    this._activeConditions = [];

    // ── FEED PROCESSING — infrastructure-specific indicators ──
    var feeds = this.state.feeds;
    for (var fi = 0; fi < feeds.length; fi++) {
      var f = feeds[fi];
      var fn = (f.name || '').toLowerCase();

      // Construction index declining
      if ((fn.indexOf('construction') !== -1 || fn.indexOf('building') !== -1) && f.value !== undefined && f.value < -5) {
        this._activeConditions.push('capacity_constraint');
        signals.push('ELEVATED: construction activity declining — index at ' + f.value.toFixed(1));
      }

      // Transportation stress — 3% monthly change is operationally significant
      if ((fn.indexOf('transport') !== -1 || fn.indexOf('traffic') !== -1 || fn.indexOf('freight') !== -1) && f.value !== undefined && (f.value > 3 || f.value < -3)) {
        this._activeConditions.push('logistics_stress');
        this._activeConditions.push('congestion');
        signals.push('ELEVATED: transportation stress at ' + f.value.toFixed(1) + ' — congestion pressure');
      }

      // Grid capacity — reserve margin below 10%
      if ((fn.indexOf('grid') !== -1 || fn.indexOf('reserve') !== -1 || fn.indexOf('capacity') !== -1) && f.value !== undefined && f.value < 10 && f.value >= 0) {
        this._activeConditions.push('grid_stress');
        this._activeConditions.push('reserve_margin_low');
        signals.push('CRITICAL: grid reserve margin below 10% — at ' + fmtNumber(f.value, 1) + '%');
      }

      // Utility / grid capex declining — aging-asset reinvestment shortfall
      if ((fn.indexOf('utility') !== -1 || fn.indexOf('capex') !== -1) && f.value !== undefined && f.value < -2) {
        this._activeConditions.push('utility_capex_decline');
        this._activeConditions.push('capex_budget_decline');
        signals.push('ELEVATED: utility/grid capex declining — ' + f.value.toFixed(1) + '%');
      }

      // Federal spending drop — 3% quarterly decline is a real funding signal
      if ((fn.indexOf('federal') !== -1 || fn.indexOf('spending') !== -1 || fn.indexOf('fiscal') !== -1) && f.value !== undefined && f.value < -3) {
        this._activeConditions.push('funding_gap');
        this._activeConditions.push('capex_budget_decline');
        signals.push('ELEVATED: federal infrastructure spending declining — ' + f.value.toFixed(1) + '% drop');
      }

      // Municipal bond yield spike — capital-markets funding stress for civil projects
      if ((fn.indexOf('bond') !== -1 || fn.indexOf('municipal') !== -1 || fn.indexOf('yield') !== -1) && f.value !== undefined && f.value > 3) {
        this._activeConditions.push('municipal_bond_yield_spike');
        this._activeConditions.push('bond_market_stress');
        signals.push('ELEVATED: municipal bond yield spike — funding cost stress at ' + f.value.toFixed(1));
      }

      // Maintenance backlog
      if ((fn.indexOf('maintenance') !== -1 || fn.indexOf('backlog') !== -1 || fn.indexOf('deferred') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('maintenance_critical');
        this._activeConditions.push('deferred_maintenance');
        this._activeConditions.push('maintenance_backlog_cost_high');
        signals.push('ELEVATED: maintenance backlog signal detected — value ' + f.value.toFixed(1));
      }

      // Inspection failure rate / asset condition index
      if ((fn.indexOf('inspection') !== -1 || fn.indexOf('condition index') !== -1 || fn.indexOf('asset condition') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('inspection_failure');
        this._activeConditions.push('inspection_failure_rate');
        this._activeConditions.push('asset_condition_index_low');
        signals.push('ELEVATED: inspection failure / asset deterioration signal — value ' + f.value.toFixed(1));
      }

      // Roads / bridges / transit / ports — transportation-system disruption
      if ((fn.indexOf('road') !== -1 || fn.indexOf('bridge') !== -1 || fn.indexOf('transit') !== -1 || fn.indexOf('port') !== -1 || fn.indexOf('highway') !== -1) && f.value !== undefined && (f.value > 3 || f.value < -3)) {
        this._activeConditions.push('congestion');
        if (fn.indexOf('bridge') !== -1) this._activeConditions.push('bridge_closure');
        if (fn.indexOf('road') !== -1 || fn.indexOf('highway') !== -1) this._activeConditions.push('road_network_failure');
        if (fn.indexOf('transit') !== -1) this._activeConditions.push('transit_capacity_loss');
        if (fn.indexOf('port') !== -1) this._activeConditions.push('port_disruption');
        signals.push('ELEVATED: transportation-system stress (' + (f.name || 'transport') + ') — value ' + f.value.toFixed(1));
      }

      // Cyber / SCADA threat to infrastructure — match the REAL feed identities
      // (CISA KEV, CVE, ransomware, NVD, advisories), not just the literal word "cyber".
      // A live exploited-vuln feed IS the signal; a count in the label scales severity.
      var fcid = (fn + ' ' + (f.label || '')).toLowerCase();
      if (/(cyber|scada|cve|kev|ransomware|vulnerab|exploit|cisa|advisor|nvd)/.test(fcid) && f.live !== false) {
        this._activeConditions.push('CYBER_ATTACK');
        this._activeConditions.push('INFRASTRUCTURE_ATTACK');
        var _cm = String(f.label != null ? f.label : f.value).match(/(\d+)/);
        if (_cm && parseInt(_cm[1], 10) >= 35) this._activeConditions.push('SCADA_BREACH'); // real spike, not the ~20/mo baseline
        signals.push('CRITICAL: cyber threat to infrastructure — ' + (f.label || f.name || 'CISA/KEV'));
      }

      // Transmission congestion / interconnection queue
      if ((fn.indexOf('transmission') !== -1 || fn.indexOf('interconnection') !== -1 || fn.indexOf('queue') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('transmission_congestion');
        this._activeConditions.push('interconnection_delay');
        signals.push('ELEVATED: transmission/interconnection stress — value ' + f.value.toFixed(1));
      }

      // Substation / transformer / switchgear backlog
      if ((fn.indexOf('substation') !== -1 || fn.indexOf('transformer') !== -1 || fn.indexOf('switchgear') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('substation_bottleneck');
        this._activeConditions.push('transformer_backlog');
        signals.push('ELEVATED: substation/transformer equipment backlog — value ' + f.value.toFixed(1));
      }

      // Data center / hyperscale demand surge
      if ((fn.indexOf('data center') !== -1 || fn.indexOf('datacenter') !== -1 || fn.indexOf('hyperscale') !== -1 || fn.indexOf('colocation') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('datacenter_demand');
        this._activeConditions.push('demand_surge');
        signals.push('ELEVATED: data center infrastructure demand — value ' + f.value.toFixed(1));
      }

      // Peak load / curtailment / load shedding
      if ((fn.indexOf('peak') !== -1 || fn.indexOf('curtailment') !== -1 || fn.indexOf('load shed') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('peak_curtailment');
        this._activeConditions.push('capacity_constraint');
        signals.push('CRITICAL: peak load curtailment pressure — value ' + f.value.toFixed(1));
      }

      // Cooling / water infrastructure strain
      if ((fn.indexOf('cooling') !== -1 || fn.indexOf('chilled water') !== -1 || fn.indexOf('water demand') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('cooling_infrastructure_strain');
        this._activeConditions.push('capacity_constraint');
        signals.push('ELEVATED: cooling/water infrastructure strain — value ' + f.value.toFixed(1));
      }

      // Self-generation / backup generation / onsite generation
      if ((fn.indexOf('self-generation') !== -1 || fn.indexOf('onsite generation') !== -1 || fn.indexOf('backup generation') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('self_generation_strain');
        signals.push('ELEVATED: self-generation/backup capacity strain — value ' + f.value.toFixed(1));
      }
    }

    // ── EVENT CLUSTERS — with timestamp validation and diagnosis mapping ──
    var snap = this._getSnapshot();
    var now = Date.now();
    var EVENT_TTL = 30 * 60 * 1000; // 30 minutes — events must be recent
    if (snap && snap.defenseSignals) {
      for (var si = 0; si < snap.defenseSignals.length; si++) {
        var sig = snap.defenseSignals[si];
        if (!sig.affectedDomains || sig.affectedDomains.indexOf('infrastructure') === -1) continue;

        // Timestamp validation — reject stale events
          // `timestamp` is NOT a per-signal field. handlers/defense-signals.js:152-163 builds each
          // signal with { eventType, articleCount, confidence, confidenceValue, magnitude,
          // affectedDomains, titles, earliest, latest, clusterSpanMinutes }. `timestamp` exists only
          // on the response ENVELOPE (:274), and limen-worker-snapshot.js:128 copies signals verbatim.
          // So sig.timestamp was always undefined -> sigAge Infinity -> sigFresh false -> the whole
          // event branch took the EXPIRED path on every tick, in all 6 brains that have it. `latest`
          // is the real recency: cluster.latest = max(article.pubDate) (defense-signals.js:130,138).
        var _sigT = sig.timestamp || sig.latest;
        var sigAge = _sigT ? (now - new Date(_sigT).getTime()) : Infinity;
        var sigFresh = sigAge < EVENT_TTL;
        var label = sigFresh ? 'ACTIVE' : 'STALE';

        if (sigFresh) {
          // Map event types to specific diagnosis conditions
          var et = sig.eventType;
          this._activeConditions.push(et);

          // Explicit event → diagnosis family mapping
          if (et === 'INFRASTRUCTURE_ATTACK' || et === 'CYBER_ATTACK') {
            this._activeConditions.push('SCADA_BREACH');
            signals.push(label + ': ' + et.replace(/_/g, ' ').toLowerCase() + ' — cyber-physical pathway');
          }
          if (et === 'SUPPLY_DISRUPTION' || et === 'SANCTIONS') {
            this._activeConditions.push('materials_shortage');
            signals.push(label + ': ' + et.replace(/_/g, ' ').toLowerCase() + ' — supply chain pathway');
          }
          if (et === 'FISCAL_CRISIS' || et === 'BUDGET_CUT') {
            this._activeConditions.push('funding_gap');
            signals.push(label + ': ' + et.replace(/_/g, ' ').toLowerCase() + ' — funding pathway');
          }
          if (et === 'WEATHER_EXTREME' || et === 'NATURAL_DISASTER') {
            this._activeConditions.push('grid_stress');
            this._activeConditions.push('utility_failure');
            signals.push(label + ': ' + et.replace(/_/g, ' ').toLowerCase() + ' — grid degradation pathway');
          }
        } else {
          signals.push('EXPIRED: ' + (sig.eventType || '').replace(/_/g, ' ').toLowerCase() + ' (age: ' + Math.round(sigAge / 60000) + 'm) — ignored');
        }
      }
    }

    // Macro shock
    if (snap && snap.macroShock && snap.macroShock.detected) {
      this._activeConditions.push('macro_shock');
    }

    // ── RAW SIGNAL STRING SCANNING — catch data-center / grid stress language ──
    for (var rsi = 0; rsi < rawSignals.length; rsi++) {
      var rs = (typeof rawSignals[rsi] === 'string' ? rawSignals[rsi] : '').toLowerCase();
      if ((rs.indexOf('transmission') !== -1 && (rs.indexOf('congestion') !== -1 || rs.indexOf('constraint') !== -1 || rs.indexOf('bottleneck') !== -1)) || rs.indexOf('interconnection queue') !== -1) {
        if (this._activeConditions.indexOf('transmission_congestion') === -1) this._activeConditions.push('transmission_congestion');
      }
      if (rs.indexOf('data center') !== -1 || rs.indexOf('datacenter') !== -1 || rs.indexOf('hyperscale') !== -1) {
        if (this._activeConditions.indexOf('datacenter_demand') === -1) this._activeConditions.push('datacenter_demand');
        if (this._activeConditions.indexOf('demand_surge') === -1) this._activeConditions.push('demand_surge');
      }
      if (rs.indexOf('transformer') !== -1 && (rs.indexOf('shortage') !== -1 || rs.indexOf('backlog') !== -1 || rs.indexOf('lead time') !== -1 || rs.indexOf('delay') !== -1)) {
        if (this._activeConditions.indexOf('transformer_backlog') === -1) this._activeConditions.push('transformer_backlog');
      }
      if (rs.indexOf('substation') !== -1 && (rs.indexOf('upgrade') !== -1 || rs.indexOf('bottleneck') !== -1 || rs.indexOf('overload') !== -1)) {
        if (this._activeConditions.indexOf('substation_bottleneck') === -1) this._activeConditions.push('substation_bottleneck');
      }
      if ((rs.indexOf('curtailment') !== -1 || rs.indexOf('load shed') !== -1) && rs.indexOf('peak') !== -1) {
        if (this._activeConditions.indexOf('peak_curtailment') === -1) this._activeConditions.push('peak_curtailment');
      }
    }

    // ── STRESS-DERIVED CONDITIONS ──
    // Feed values arrive as index levels (100 = FRED baseline), not deltas,
    // so the keyword+threshold filters above rarely fire. When computed stress
    // is elevated, push conditions that match real diagnosisIndex triggers so
    // diagnoses can activate. Tiered: higher stress → more categories.
    // ── CIRCULARITY CUT (2026-07-24) — no condition may be manufactured from this
    //    domain's own stress scalar. normalizeSignals runs BEFORE scoreStress, so these
    //    gates read the PREVIOUS cycle's stress: the resulting "active diagnosis" restated
    //    one number instead of adding evidence, and because emissions are gated on an
    //    active diagnosis and peers fold received pressure back into stress, it closed a
    //    feedback ring carrying no new information. Reground to a real feed to restore a
    //    condition; never re-derive one from stress.
    //    SURVIVES on real feeds/events : 5: grid_stress, utility_failure, deferred_maintenance, capacity_constraint, inspection_failure
    //    REMOVED, no other source in this file : 3: structural_stress, aging_infrastructure, asset_deterioration


    if (this.state.stress >= 0.70) this.state._stressFlag = 'HIGH';
    else if (this.state.stress >= 0.50) this.state._stressFlag = 'ELEVATED';
    else this.state._stressFlag = 'NORMAL';

    this.state.signals = signals;
    return Promise.resolve();
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 4 OVERRIDE: Derive diagnoses — condition-matched from portal
  // ══════════════════════════════════════════════════════════════════════

  // Brain cognition lifts stress when a critical condition the raw composite under-weighted
  // is active — so a recognized cyber/grid attack actually registers (and clears the 0.60
  // cross-domain emission gate, letting infrastructure join the mesh + emit its edges).
  var _baseScoreStress = (window.LIMENDomainBrainBase && window.LIMENDomainBrainBase.prototype.scoreStress);
  InfrastructureBrain.prototype.scoreStress = function () {
    if (_baseScoreStress) _baseScoreStress.call(this);
    else this.state.stress = (this._rawDomain && this._rawDomain.stress) || 0;
    var ac = this._activeConditions || [];
    var floor = 0;
    if (ac.indexOf('SCADA_BREACH') !== -1) floor = Math.max(floor, 0.80);           // real exploited-vuln spike
    else if (ac.indexOf('CYBER_ATTACK') !== -1 || ac.indexOf('INFRASTRUCTURE_ATTACK') !== -1) floor = Math.max(floor, 0.62); // standing cyber presence = elevated, not maxed
    if (ac.indexOf('grid_stress') !== -1) floor = Math.max(floor, 0.65);
    if (floor > 0) {
      this.state.stress = Math.max(this.state.stress || 0, floor);
      this.state._stressFloorReason = (ac.indexOf('CYBER_ATTACK') !== -1) ? 'cyber-physical threat' : 'grid stress';
    }
    // AFFERENT: the _baseScoreStress() call at the top of this override runs the universal
    // continuous afferent integration (base-capped 0.3) and sets _externalPressureApplied.
  };

  InfrastructureBrain.prototype.deriveDiagnoses = function () {
    var self = this;
    return this._getPortalContent().then(function (portal) {
      if (!portal) return;

      var issues = portal.issues || [];
      var conditions = self._activeConditions || [];

      // Re-resolve the portal-issue → brain-diagnosis map at RUNTIME (not just the load-time
      // capture): if domain-identity.js loaded after this brain, the load-time INFRA_PORTAL_TO_BRAIN
      // is {} and portal issues (GRID_FAILURE) never map to diagnosisIndex keys (GRID_DEGRADATION),
      // leaving every diagnosis inactive ("STRESSED / NO DX MATCH"). Bulletproofs load order.
      var _i2b = (window.LIMENDomainIdentity && window.LIMENDomainIdentity.INFRA_PORTAL_TO_BRAIN) || INFRA_PORTAL_TO_BRAIN;
      self.state.diagnoses = issues.map(function (iss) {
        var brainKey = _i2b[iss.id] || iss.id;
        var triggers = self.diagnosisIndex[brainKey] || [];
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
          id: brainKey,
          portalId: iss.id,
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

      // Sort: active diagnoses first, then by relevance
      self.state.diagnoses.sort(function (a, b) {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return b.relevance - a.relevance;
      });

      // After deriving diagnoses, trigger actions for newly activated ones
      self._checkDiagnosisActions();
    });
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 5 OVERRIDE: Recommend treatments for active diagnoses
  // ══════════════════════════════════════════════════════════════════════

  InfrastructureBrain.prototype.recommendTreatments = function () {
    var self = this;
    return this._getPortalContent().then(function (portal) {
      if (!portal) return;

      var activeDx = self.state.diagnoses.filter(function (d) { return d.active; });
      if (activeDx.length === 0) {
        self.state.treatments = [];
        return;
      }

      // Pull treatments from activations that match active diagnosis circuits
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

      // Sort by evidence grade
      var evidenceRank = { A: 10, 'Strong': 10, B: 7, 'Moderate': 7, C: 4, 'Emerging': 1 };
      treatments.sort(function (a, b) {
        return (evidenceRank[b.evidence] || 0) - (evidenceRank[a.evidence] || 0);
      });

      self.state.treatments = treatments;
    });
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 6 OVERRIDE: Surface opportunities with capital classification
  // ══════════════════════════════════════════════════════════════════════

  InfrastructureBrain.prototype.surfaceOpportunities = function () {
    // Call base to get companies + convergence
    Base.prototype.surfaceOpportunities.call(this);

    // C6-followup: if the snapshot didn't supply companies, fall back to real
    // command-board entities so opportunities are real, not scaffold.
    if ((!this.state.companies || !this.state.companies.length) && this._cbInfraCompanies && this._cbInfraCompanies.length) {
      this.state.companies = this._cbInfraCompanies;
    }

    var opps = [];
    var stress = this.state.stress;
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; });
    var allDx = this.state.diagnoses || [];
    var phase = this.state.phase;
    var companies = this.state.companies;
    var seen = {}; // dedupe by thesis, not by type

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

      // Monitoring platform
      add({
        title: dxLabel + ' — monitoring and early-warning platform',
        rank: stress * dx.relevance,
        path: 'RESEARCHABLE',
        urgency: stress > 0.70 ? 'IMMEDIATE' : 'ACTIVE',
        source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
      });

      // Resilience infrastructure
      if (stress >= 0.50) {
        add({
          title: dxLabel + ' — resilience infrastructure deployment',
          rank: stress * dx.relevance * 0.9,
          path: 'INVESTABLE',
          urgency: stress > 0.70 ? 'IMMEDIATE' : 'ACTIVE',
          source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
        });
      }

      // Sector positioning
      if (stress >= 0.55 && dx.relevance >= 0.2) {
        add({
          title: dxLabel + ' — sector positioning and exposure management',
          rank: stress * 0.85,
          path: 'INVESTABLE',
          urgency: 'ACTIVE',
          source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
        });
      }

      // Technology adaptation
      add({
        title: dxLabel + ' — adaptive technology and automation',
        rank: stress * dx.relevance * 0.75,
        path: 'RESEARCHABLE',
        urgency: 'ACTIVE',
        source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
      });
    }

    // Company-driven — terminal
    var terminalCompanies = [] /* neutralized: distress only from validated gate (see energy-brain) */;
    if (terminalCompanies.length > 0) {
      add({
        title: 'Infrastructure terminal company distressed positioning',
        rank: 0.95,
        path: 'INVESTABLE',
        urgency: 'IMMEDIATE',
        source: 'company_terminal', tier: 1,
        companies: terminalCompanies.map(function (c) { return c.ticker; }),
        stress: stress
      });
    }

    // Stressed but non-terminal companies
    var stressedCompanies = [] /* neutralized: distress only from validated gate */;
    if (stressedCompanies.length >= 2 && stress >= 0.50) {
      add({
        title: 'Infrastructure stressed-but-operating company selection',
        rank: stress * 0.80,
        path: 'INVESTABLE',
        urgency: 'ACTIVE',
        source: 'company_stressed', tier: 1,
        companies: stressedCompanies.slice(0, 5).map(function (c) { return c.ticker; }),
        stress: stress
      });
    }

    // Convergence
    if (this.state.convergence && this.state.convergence.primary_signal) {
      add({
        title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — infrastructure convergence response',
        rank: 0.98,
        path: 'INVESTABLE',
        urgency: 'IMMEDIATE',
        source: 'convergence', tier: 1,
        signal: this.state.convergence.primary_signal,
        stress: stress
      });
    }

    // ═══ TIER 2 — CROSS-DOMAIN (requires active diagnosis) ═══
    if (activeDx.length > 0) {
      var emissions = this.state.crossDomainEmissions || [];
      for (var ei = 0; ei < emissions.length; ei++) {
        var em = emissions[ei];
        var targetLabel = (em.targetDomain || '').replace(/_/g, ' ');
        var sigLabel = (em.signal || em.signalType || '').replace(/_/g, ' ');

        add({
          title: 'Infrastructure \u2192 ' + targetLabel + ' transmission \u2014 ' + sigLabel + ' response',
          rank: (em.magnitude || 0.5) * stress * 0.8,
          path: 'INVESTABLE',
          urgency: em.magnitude > 0.6 ? 'IMMEDIATE' : 'ACTIVE',
          source: 'cross_domain', tier: 2,
          diagnosisId: activeDx[0].id,
          stress: stress
        });
      }
    }

    // ═══ TIER 3 — LAGGING (requires active diagnosis) ═══
    if (activeDx.length > 0 && stress >= 0.50) {
      add({
        title: 'Infrastructure policy and regulatory response \u2014 permitting and compliance',
        rank: stress * 0.65,
        path: 'INVESTABLE',
        urgency: stress > 0.70 ? 'ACTIVE' : 'WATCH',
        source: 'lagging', tier: 3,
        diagnosisId: activeDx[0].id, stress: stress
      });

      add({
        title: 'Infrastructure modernization acceleration \u2014 smart grid and broadband',
        rank: stress * 0.70,
        path: 'RESEARCHABLE',
        urgency: 'ACTIVE',
        source: 'lagging', tier: 3,
        diagnosisId: activeDx[0].id, stress: stress
      });
    }

    if (activeDx.length > 0 && stress >= 0.60) {
      add({
        title: 'Asset rehabilitation and targeted replacement \u2014 infrastructure capital deployment',
        rank: stress * 0.75,
        path: 'INVESTABLE',
        urgency: stress > 0.70 ? 'IMMEDIATE' : 'ACTIVE',
        source: 'lagging', tier: 3,
        diagnosisId: activeDx[0].id, stress: stress
      });

      add({
        title: 'Infrastructure bottleneck positioning \u2014 constrained-capacity operators',
        rank: stress * 0.72,
        path: 'INVESTABLE',
        urgency: 'ACTIVE',
        source: 'lagging', tier: 3,
        diagnosisId: activeDx[0].id, stress: stress
      });
    }

    // Medium-confidence diagnoses (not active but close) → watchlist opportunities
    var nearDx = allDx.filter(function (d) { return !d.active && d.relevance > 0 && d.totalTriggers > 0; });
    for (var ndi = 0; ndi < nearDx.length; ndi++) {
      var nd = nearDx[ndi];
      if (stress >= 0.45) {
        add({
          title: (nd.label || nd.id || '').replace(/_/g, ' ') + ' — early-stage monitoring position',
          rank: stress * (nd.relevance || 0.1) * 0.5,
          path: 'RESEARCHABLE',
          urgency: 'WATCH',
          source: 'near_diagnosis', tier: 2,
          diagnosisId: nd.id, stress: stress
        });
      }
    }

    opps.sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); });

    // ═══ CANONICAL ENRICHMENT — merge playbook detail into each opportunity ═══
    // This is the single upstream enrichment point. Console, Opportunities page,
    // and Operator all read from state.opportunities and get the same object.

    // Diagnosis → playbook ID mapping
    var _PB_MAP = {
      'GRID_DEGRADATION': 'infra_modernization',
      'SUPPLY_CHAIN_BOTTLENECK': 'infra_maintenance',
      'CAPACITY_OVERLOAD': 'infra_modernization',
      'INFRA_FUNDING_COLLAPSE': 'infra_funding',
      'MAINTENANCE_DEFICIT': 'infra_maintenance',
      'CYBER_PHYSICAL_ATTACK': 'infra_modernization'
    };
    var _SRC_MAP = {
      'company_terminal': 'infra_modernization',
      'company_stressed': 'infra_maintenance',
      'convergence': 'infra_funding',
      'cross_domain': 'infra_funding',
      'lagging': 'infra_maintenance'
    };

    // Playbook detail registry (inline — matches infrastructure portal playbooks)
    var _PB_DETAIL = {
      'infra_funding': {
        explain: 'Infrastructure funding gaps are creating demand for federal grants, municipal bonds, and public-private partnership structures. Agencies at federal and state levels are prioritizing infrastructure investment through dedicated programs and emergency allocations.',
        action: 'Position for federal and state infrastructure grants. Monitor sam.gov for DOE, DOT, and EPA procurement. Evaluate municipal bond offerings and PPP structures for infrastructure projects.',
        valueRange: '$500K-$50M infrastructure contracts',
        trigger: 'Infrastructure stress > 0.50 with FUNDING_COLLAPSE or convergence diagnosis active.',
        validation: 'Confirm funding gap via federal spending data. Check bond market stress indicators. Verify diagnosis is evidence-grounded.',
        steps: ['Check Infrastructure console — verify diagnosis is ACTIVE with evidence', 'Search grants.gov for DOT/DOE/EPA infrastructure programs', 'Search sam.gov for state DOT and municipal infrastructure procurement', 'Evaluate IIJA (Infrastructure Investment and Jobs Act) funding streams', 'For INVEST: screen infrastructure-exposed companies', 'For GRANT: prepare multi-agency proposal with system evidence'],
        outcome: 'Infrastructure funding programs award $500K-$50M contracts. Municipal bond issuance accelerates during stress periods. PPP structures create long-duration revenue streams.',
        failure: 'Federal spending stabilizes. Bond markets normalize. Budget cuts reverse. Infrastructure stress resolves before grant cycle completes.',
        window: '30-180 days',
        fastPath: ['1. Verify Infrastructure stress > 50% with active diagnosis', '2. Search grants.gov and sam.gov for open infrastructure solicitations', '3. Execute: GRANT (federal/state programs), INVEST (infrastructure companies), or PPP (project finance)'],
        examples: ['Quanta Services (PWR)', 'AECOM (ACM)', 'Brookfield Infrastructure (BIP)', 'PAVE Infrastructure ETF', 'Vulcan Materials (VMC)']
      },
      'infra_maintenance': {
        explain: 'Aging infrastructure is creating accelerating demand for maintenance, repair, and rehabilitation services. Deferred maintenance backlogs are reaching critical levels, forcing emergency procurement and premium pricing for contractors with capacity.',
        action: 'Position in infrastructure maintenance and water/wastewater companies. Monitor state DOT emergency procurement. Identify companies with existing maintenance contracts and expansion capacity.',
        valueRange: '10-25% infrastructure sector premium',
        trigger: 'MAINTENANCE_DEFICIT or SUPPLY_CHAIN_BOTTLENECK diagnosis active. Asset deterioration signals from feeds.',
        validation: 'Confirm maintenance backlog data. Check inspection failure reports. Verify deferred maintenance is structural, not seasonal.',
        steps: ['Check Infrastructure console for MAINTENANCE_DEFICIT or SUPPLY_CHAIN_BOTTLENECK', 'Review maintenance backlog feeds for trend confirmation', 'Screen water/wastewater infrastructure companies for capacity', 'For INVEST: position in maintenance-exposed contractors', 'For GRANT: target EPA Water Infrastructure Finance programs', 'Monitor ASCE infrastructure report card for sector targeting'],
        outcome: 'Infrastructure maintenance companies capture premium pricing during backlog acceleration. Emergency procurement bypasses normal competitive processes, favoring incumbents.',
        failure: 'Maintenance backlogs stabilize. Federal investment reduces deferred maintenance. Supply chain bottlenecks resolve. Seasonal patterns dominate.',
        window: '7-120 days',
        fastPath: ['1. Check if MAINTENANCE_DEFICIT or supply chain stress is active', '2. Screen XYL, MWA, MTZ on Yahoo Finance for trend', '3. Execute: buy maintenance contractors or apply for EPA infrastructure grants'],
        examples: ['Xylem (XYL)', 'Mueller Water (MWA)', 'MasTec (MTZ)', 'Fluor (FLR)', 'Jacobs Engineering (J)']
      },
      'infra_modernization': {
        explain: 'Infrastructure modernization investment is accelerating due to grid degradation, cyber-physical threats, and capacity overload. Smart grid, broadband, and resilience technologies are capturing capital flows from both public and private sources.',
        action: 'Position in infrastructure technology companies. Search for smart grid and broadband deployment grants. Check patent gaps in infrastructure monitoring and resilience systems.',
        valueRange: '15-40% infrastructure tech returns',
        trigger: 'GRID_DEGRADATION, CAPACITY_OVERLOAD, or CYBER_PHYSICAL_ATTACK diagnosis active. Modernization investment signals from feeds.',
        validation: 'Confirm grid stress or cyber threat data. Check infrastructure technology adoption metrics. Verify modernization trend is structural.',
        steps: ['Check Infrastructure console for GRID_DEGRADATION or CYBER_PHYSICAL_ATTACK', 'Verify grid stress or cyber event feeds are FRESH', 'Review infrastructure technology company pipeline announcements', 'For INVEST: position in TRMB, BSY, ITRI, or infrastructure tech ETFs', 'For GRANT: search grants.gov for DOE smart grid and broadband programs', 'For PATENT: search patents.google.com for infrastructure monitoring gaps'],
        outcome: 'Infrastructure technology companies outperform during modernization cycles. Smart grid and broadband deployments create multi-year revenue streams. Patent filings secure IP in emerging infrastructure domains.',
        failure: 'Grid stress resolves. Cyber threats contained without systemic response. Modernization budgets cut. Technology adoption slows.',
        window: '1-90 days',
        fastPath: ['1. Verify grid degradation or cyber-physical attack diagnosis active', '2. Check TRMB/BSY on Yahoo Finance for confirmation', '3. Execute: INVEST (infrastructure tech), GRANT (DOE programs), or PATENT (monitoring IP)'],
        examples: ['Trimble (TRMB)', 'Bentley Systems (BSY)', 'Itron (ITRI)', 'American Tower (AMT)', 'Crown Castle (CCI)']
      }
    };

    for (var oi = 0; oi < opps.length; oi++) {
      var o = opps[oi];
      // Stable ID: diagnosis + path + tier hash
      o.id = (o.diagnosisId || o.source || 'opp').replace(/[^a-zA-Z0-9]/g, '_') + '_' + (o.path || '').toLowerCase().replace(/[^a-z]/g, '') + '_t' + (o.tier || 0);

      // Map to playbook
      var pbId = (o.diagnosisId && _PB_MAP[o.diagnosisId]) ? _PB_MAP[o.diagnosisId] : (_SRC_MAP[o.source] || null);
      o.playbookId = pbId;

      // Enrich with playbook detail
      var detail = pbId ? (_PB_DETAIL[pbId] || null) : null;
      if (detail) {
        o.explain = detail.explain;
        o.action = detail.action;
        o.valueRange = detail.valueRange;
        o.trigger = detail.trigger;
        o.validation = detail.validation;
        o.steps = detail.steps;
        o.outcome = detail.outcome;
        o.failure = detail.failure;
        o.window = detail.window;
        o.fastPath = detail.fastPath;
        o.examples = detail.examples;
      }

      // Domain metadata
      o.domain = 'infrastructure';
      o.confidence = Math.round(Math.min(1, Math.max(0, (o.rank || 0))) * 100);
      o.whyNow = o.title;

      // ── COMPENSATION MODEL ──
      var _COMP = {
        'INVESTABLE':   { type: 'invest',   base: 5, unit: 'profit%', tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
        'RESEARCHABLE': { type: 'research', base: 8, unit: 'cite%',   tier: 1, nextTier: { tier: 2, comp: 12, requirement: '3 research deliverables' },        maxTier: { tier: 3, comp: 20 } }
      };
      o.compensation = _COMP[o.path] || { type: 'invest', base: 5, unit: 'profit%', tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 outcomes' }, maxTier: { tier: 3, comp: 15 } };

      // Business-type opportunities get business compensation
      var titleLow = (o.title || '').toLowerCase();
      var isBizType = titleLow.indexOf('infrastructure') !== -1 || titleLow.indexOf('platform') !== -1 || titleLow.indexOf('system') !== -1 || titleLow.indexOf('monitoring') !== -1 || titleLow.indexOf('deployment') !== -1 || titleLow.indexOf('grid') !== -1 || titleLow.indexOf('modernization') !== -1 || o.source === 'lagging';
      if (isBizType) {
        o.paths = [o.path, 'BUSINESS'];
        o.compensation_business = { type: 'business', base: 20, unit: 'profit%', tier: 1, nextTier: { tier: 2, comp: 25, requirement: '3 businesses launched' }, maxTier: { tier: 3, comp: 35 } };
      } else {
        o.paths = [o.path];
      }

      // ── VALIDITY LIFECYCLE ──
      o.validity = {
        createdAt: Date.now(),
        lastValidated: Date.now(),
        expiryWindowDays: o.tier === 1 ? 30 : o.tier === 2 ? 60 : 90,
        requiresRevalidation: false,
        invalidationReasons: []
      };

      // ── WHY THIS MAKES MONEY (execution intelligence per opportunity) ──
      var stressPct = Math.round((o.stress || 0) * 100);
      var confPct = o.confidence || 0;
      var dxLabel = (o.diagnosisId || '').replace(/_/g, ' ').toLowerCase();
      var titleLc = (o.title || '').toLowerCase();
      var src = o.source || '';
      var compList = (o.companies && o.companies.length) ? o.companies.join(', ') : '';
      var exList = (o.examples && o.examples.length) ? o.examples.join(', ') : '';

      // ── DO THIS (imperative, opportunity-specific) ──
      var doThis = '';
      if (src === 'company_terminal') {
        doThis = 'Open distressed-asset positions in terminal-phase infrastructure companies (' + (compList || 'see company list') + '). Set stop-loss at -15%. Target restructuring or acquisition premium from infrastructure sector consolidation.';
      } else if (src === 'company_stressed') {
        doThis = 'Screen stressed-but-operating infrastructure companies (' + (compList || 'see company list') + ') for entry. These are not terminal — look for recovery catalysts, government contract wins, or sector tailwind re-rating from infrastructure spending.';
      } else if (src === 'convergence') {
        doThis = 'Multiple stress signals are converging on infrastructure. Position in diversified infrastructure exposure (' + (exList || 'broad infrastructure ETFs') + ') to capture systemic repricing across the sector.';
      } else if (src === 'cross_domain') {
        doThis = 'Infrastructure stress is transmitting into adjacent sectors. Position in cross-sector beneficiaries — companies with pricing power or supply-chain resilience that profit from infrastructure cost pass-through. Monitor ' + (exList || 'engineering firms, materials suppliers') + '.';
      } else if (src === 'diagnosis' && o.path === 'RESEARCHABLE') {
        if (titleLc.indexOf('monitoring') !== -1 || titleLc.indexOf('warning') !== -1) doThis = 'Commission a research brief on ' + dxLabel + ' monitoring and early-warning systems. Review existing implementations and identify the capability gap. Deliverable: a 2-page research note with benchmark systems and recommended next step.';
        else if (titleLc.indexOf('adaptive') !== -1 || titleLc.indexOf('automation') !== -1) doThis = 'Research adaptive automation approaches to ' + dxLabel + '. Survey peer-reviewed implementations, map vendor landscape, and identify the most deployable solution architecture.';
        else doThis = 'Research the technology landscape for ' + dxLabel + ' solutions. Review academic literature, industry reports, and vendor implementations to identify the best-practice response.';
      } else if (src === 'diagnosis' && o.path === 'INVESTABLE') {
        doThis = 'Open positions in infrastructure companies exposed to ' + dxLabel + '. Use sector ETFs and individual names (' + (exList || 'infrastructure sector leaders') + '). Size for the stress level — ' + stressPct + '% stress warrants meaningful allocation.';
      } else if (src === 'lagging' && o.path === 'INVESTABLE') {
        doThis = 'Position in infrastructure companies benefiting from the regulatory response to ' + dxLabel + '. These firms capture DOT/DOE procurement and compliance-driven capex. Screen ' + (exList || 'AECOM (ACM), Quanta Services (PWR), Jacobs Engineering (J)') + '.';
      } else if (src === 'lagging' && o.path === 'RESEARCHABLE') {
        doThis = 'Research smart infrastructure and predictive maintenance approaches that address the modernization gap exposed by ' + dxLabel + '. Identify the specific failure mode current systems cannot detect and survey available solutions.';
      } else if (src === 'lagging' && titleLc.indexOf('rehabilitation') !== -1) {
        doThis = 'Position in asset rehabilitation and replacement companies. Target EPC contractors, materials suppliers, and equipment vendors accelerating capex in response to infrastructure stress. Monitor ' + (exList || 'Quanta Services (PWR), AECOM (ACM), Vulcan Materials (VMC)') + '.';
      } else if (src === 'lagging' && titleLc.indexOf('bottleneck') !== -1) {
        doThis = 'Identify constrained-capacity operators benefiting from the infrastructure bottleneck. These companies have pricing power because construction and maintenance capacity cannot expand fast enough. Position in EPC firms, equipment rental companies, and specialty contractors.';
      } else if (src === 'near_diagnosis') {
        doThis = 'This diagnosis is not yet active but showing early signals. Set up a monitoring position — small paper allocation or watchlist entry. Be ready to scale if the diagnosis activates.';
      } else {
        doThis = o.action || ('Execute on ' + (o.title || 'this opportunity') + ' via the ' + (o.path || '').replace(/-/g, ' ').toLowerCase() + ' path.');
      }

      // ── WHY THIS PAYS (monetization path) ──
      var whyPays = '';
      if (o.path === 'INVESTABLE') {
        if (src === 'company_terminal') whyPays = 'Terminal-phase infrastructure companies are priced for worst case. Any restructuring, acquisition, or sector recovery creates 30-80% upside from distressed entry. Risk is bounded by stop-loss.';
        else if (src === 'company_stressed') whyPays = 'Stressed-but-operating infrastructure companies trade at a fear discount. Recovery to normal operations reprices equity 15-40% higher. Government infrastructure spending accelerates the recovery timeline.';
        else if (src === 'cross_domain') whyPays = 'Cross-sector transmission means infrastructure costs flow into margins of downstream companies. Engineering firms and materials suppliers capture the spread. ' + (o.valueRange || '10-25% sector premium during sustained stress') + '.';
        else if (titleLc.indexOf('rehabilitation') !== -1 || titleLc.indexOf('replacement') !== -1) whyPays = 'Asset rehabilitation is mandatory capex — utilities and municipalities must spend regardless of macro conditions. EPC firms and materials vendors see revenue acceleration. ' + (o.valueRange || '15-30% infrastructure premium') + '.';
        else if (titleLc.indexOf('bottleneck') !== -1) whyPays = 'Capacity constraints create pricing power. Contractors with constrained capacity earn premium margins until new workforce and equipment come online (typically 2-5 years). ' + (o.valueRange || '20-40% margin expansion') + '.';
        else whyPays = 'Market repricing follows confirmed infrastructure stress. Companies positioned to benefit see re-rating as the diagnosis persists. ' + (o.valueRange || '10-30% sector premium') + '.';
      } else if (o.path === 'RESEARCHABLE') {
        if (titleLc.indexOf('monitoring') !== -1 || titleLc.indexOf('warning') !== -1) whyPays = 'Research into infrastructure monitoring/early-warning systems informs investment screening, vendor selection, and policy positioning. The research deliverable becomes a reusable asset across multiple opportunities.';
        else if (titleLc.indexOf('modernization') !== -1 || titleLc.indexOf('smart') !== -1) whyPays = 'Research into smart infrastructure and modernization approaches identifies investable companies and technology vendors before consensus. Early mapping creates a durable advantage. ' + (o.valueRange || 'Research value: 10-30% improved investment targeting') + '.';
        else if (titleLc.indexOf('adaptive') !== -1 || titleLc.indexOf('automation') !== -1) whyPays = 'Research into adaptive automation for infrastructure stress response identifies vendors with first-mover advantage. Position in early-stage technology vendors before mainstream adoption creates outsized returns.';
        else whyPays = 'Research into the technology response to ' + dxLabel + ' identifies investable vendors and best-practice deployments. Research leads investment — the early map positions for sector re-rating. ' + (o.valueRange || '10-25% positioning advantage') + '.';
      } else {
        whyPays = o.valueRange ? ('Value range: ' + o.valueRange) : 'Revenue generated through direct service delivery to entities affected by the diagnosed infrastructure condition.';
      }

      // ── TARGET (specific counterparties) ──
      var target = '';
      if (compList) target = 'Mapped companies: ' + compList + '.';
      if (exList && !compList) target = (target ? target + ' ' : '') + 'Target names: ' + exList + '.';
      if (o.path === 'RESEARCHABLE') target += (target ? ' ' : '') + 'Research sources: ASCE, DOT, DOE, academic infrastructure journals, vendor white papers, IIJA implementation reports.';
      else if (o.path === 'INVESTABLE' && !compList && !exList) target = 'Screen infrastructure sector for companies with direct exposure to ' + dxLabel + '. Prioritize those with government contracts, maintenance backlogs, or regulatory mandates.';
      if (!target) target = 'Identify counterparties directly affected by ' + (o.title || 'this condition') + '.';

      // ── TIMING (context-specific) ──
      var timing = '';
      if (o.urgency === 'IMMEDIATE') timing = 'Immediate — stress at ' + stressPct + '% demands action within days, not weeks.';
      else if (o.urgency === 'ACTIVE') timing = 'Near-term — execute within 1-4 weeks while stress holds at ' + stressPct + '%.';
      else if (o.urgency === 'WATCH') timing = 'Watchlist — monitor for activation trigger. Prepare execution materials now, deploy when diagnosis confirms.';
      else timing = o.window || 'Execute within the current stress window.';
      if (o.path === 'RESEARCHABLE' && timing.indexOf('research') === -1) timing += ' Research sprint: 1-2 weeks for initial landscape review; 30-60 days for full investment-grade brief.';

      // ── INVALID IF (disconfirming conditions) ──
      var invalidIf = '';
      if (src === 'company_terminal') invalidIf = 'Companies exit terminal phase (restructuring succeeds or sector recovers before entry). Domain stress drops below 40%.';
      else if (src === 'company_stressed') invalidIf = 'Companies enter terminal phase (downside, not recovery). Stress resolves too quickly for re-rating to materialize.';
      else if (src === 'cross_domain') invalidIf = 'Cross-domain transmission stops — infrastructure stress contained without downstream propagation. Receiving domains absorb the shock without repricing.';
      else if (src === 'convergence') invalidIf = 'Convergence signals decouple — individual stresses resolve independently. No systemic amplification observed.';
      else if (src === 'near_diagnosis') invalidIf = 'Diagnosis fails to activate. Feed evidence contradicts the emerging signal. Stress falls below 45%.';
      else invalidIf = (o.failure || 'Diagnosis deactivates. Stress drops below 50%. Feed evidence contradicts the thesis.') + (stressPct < 55 ? ' Current stress (' + stressPct + '%) is near invalidation threshold — monitor closely.' : '');

      // ── EVIDENCE (current system state) ──
      var evidence = 'Domain: infrastructure. Stress: ' + stressPct + '%.';
      if (confPct) evidence += ' Confidence: ' + confPct + '%.';
      if (o.diagnosisId) evidence += ' Active diagnosis: ' + dxLabel + '.';
      if (src === 'cross_domain') evidence += ' Cross-domain emission detected — infrastructure stress propagating to adjacent sectors.';
      if (src === 'convergence') evidence += ' Multiple stress vectors converging — systemic infrastructure risk elevated.';
      if (compList) evidence += ' Mapped companies: ' + compList + '.';
      evidence += ' ' + (o.trigger || 'Live feed data confirms current infrastructure conditions.');

      // ── NEXT EXECUTION STEP ──
      var nextStep = '';
      if (o.path === 'INVESTABLE') {
        if (compList) nextStep = 'Pull up ' + o.companies[0] + ' on the investment console. Verify Helix phase and set entry parameters.';
        else if (exList) nextStep = 'Check ' + o.examples[0] + ' current price and Helix validation status. Set alert for entry signal.';
        else nextStep = 'Run sector screen for infrastructure companies with highest exposure to ' + dxLabel + '. Build a 5-name watchlist.';
      } else if (o.path === 'RESEARCHABLE') {
        nextStep = 'Search Google Scholar and ASCE for "' + (dxLabel || 'infrastructure monitoring') + '" — identify the 3 best-practice implementations. Draft a 1-page research brief with investment implications.';
      } else {
        nextStep = (o.fastPath && o.fastPath.length) ? o.fastPath[0] : 'Open opportunity detail and begin execution checklist.';
      }

      o.moneyChain = {
        doThis: doThis,
        whyPays: whyPays,
        target: target,
        timing: timing,
        invalidIf: invalidIf,
        evidence: evidence,
        nextStep: nextStep
      };
    }

    // HALT/E-I BRAKE (actuated) — apply the PRIOR cycle's brake to the enriched opportunity set:
    // dampen confidence proportionally (servo emissionFactor / discrete governor penalty, min wins)
    // and flag held on a full halt. One-cycle lag; fail-open when no brake exists (cycle 1).
    try { opps = this._applyInfraEmissionBrake(opps); } catch (e) {}

    this.state.opportunities = opps;
    this.state.opportunityCount = opps.length;

    return Promise.resolve();
  };

  // ════════════════════════════════════════════════════════════════════════════
  // ACTUATION METHODS (2026-07-13) — ported + adapted from energy-brain.js.
  // ALL are deterministic (no AI / no fetch-to-LLM on the cycle). The only network touch is a
  // one-time cached fetch of the static infrastructure.json edge graph for the SPOF self-audit
  // (same static-asset class as a portal read). Additive; each is gated behind this._actuation.
  // ════════════════════════════════════════════════════════════════════════════

  // ── REGULATE-TO-TARGET SERVO + E/I (Neuro Ref XIII.1 / V.2 / XII) ──────────────────────────────
  // Real sensor->controller->effector->feedback loop. SENSOR = excitatory drive (stress + how many
  // conditions/diagnoses fire at once) vs current inhibition. CONTROLLER = PI (fast proportional +
  // bounded slow integral). EFFECTOR = a proportional dampening of emission that _computeInfraBrake
  // consumes. Infra has NO K8 homeostasis module, so the allostatic set-point / deviation is computed
  // inline from the recent stress history (mirrors energy _computeEnergyHomeostasis). Additive,
  // reversible (this._actuation.servo=false), affects ONLY emission confidence — never stress/scoring.
  InfrastructureBrain.prototype._computeInfraServo = function () {
    function R(x) { return Math.round(x * 1000) / 1000; }
    var s = this.state, em = s.infraModel || {}, reg = em.regulation || {};
    var stress = (typeof s.stress === 'number') ? s.stress : 0;
    var conds = Array.isArray(s._activeConditions) ? s._activeConditions.length : (Array.isArray(s.signals) ? s.signals.length : 0);
    var dxA = Array.isArray(s.diagnoses) ? s.diagnoses.filter(function (d) { return d && d.active; }).length : 0;
    var drive = Math.max(0, Math.min(2, stress + Math.min(conds, 12) / 24 + Math.min(dxA, 6) / 24));
    var inhibition = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;   // live inhibition term from _infraRegulation
    var FLOOR = 0.15;
    // adaptive allostatic baseline (K8-equivalent) from recent stress history -> deviation
    var hist = ((s.memory && s.memory.stressHistory) || []).slice(-20);
    var base = 0.5; if (hist.length) { var sum = 0; for (var i = 0; i < hist.length; i++) sum += (hist[i].stress || 0); base = sum / hist.length; }
    var deviation = Math.max(0, stress - base);
    // TARGET: inhibition must track drive (E/I) and rise with deviation above baseline (allostasis)
    var target = Math.max(FLOOR, Math.min(1, Math.max(drive, FLOOR + deviation)));
    var error = target - inhibition;                                             // >0 => under-braked for the drive/regime
    this._servoIntegral = Math.max(-0.5, Math.min(0.5, (this._servoIntegral || 0) + error * 0.15));
    var Kp = 0.8, Ki = 0.4;
    var correction = Math.max(0, Kp * error + Ki * Math.max(0, this._servoIntegral));   // only ADD braking; never disinhibit
    var emissionFactor = Math.max(0.2, Math.min(1, 1 - correction));            // effector: proportional emission dampening
    var state = error > 0.25 ? 'runaway-risk' : ((inhibition - target) > 0.4 ? 'over-inhibited' : 'balanced');
    var servo = {
      version: 1, actuated: true, drive: R(drive), inhibition: R(inhibition), target: R(target),
      error: R(error), integral: R(this._servoIntegral), emissionFactor: R(emissionFactor),
      state: state, deviation: R(deviation),
      note: 'closed-loop allostasis: drives inhibition toward a drive+deviation target; effector = proportional emission dampening. Neuro Ref XIII.1/V.2/XII.'
    };
    s.infraServo = servo;
    if (s.cognition && typeof s.cognition === 'object') s.cognition.servo = servo;
    return servo;
  };

  // ── HALT BRAKE + E/I BRAKE (stop-circuit). Governor layers (immune / conscience / regulation)
  // previously only ANNOTATED danger; this converts them into an actual brake. Computed at cycle end
  // from the already-computed layers; CONSUMED next cycle by _checkDiagnosisActions (action drafts) and
  // _applyInfraEmissionBrake (opportunities). Recurrent, one-cycle lag. Fail-open when absent (cycle 1).
  InfrastructureBrain.prototype._computeInfraBrake = function () {
    var s = this.state, em = s.infraModel || {}, reg = em.regulation || {};
    var im = s.infraImmune || {}, con = s.infraConscience || {};
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
    // E/I BRAKE ACTUATION (Neuro Ref XIII.1): scale the brake PROPORTIONALLY with the servo's drive/
    // inhibition deficit — inhibition that does not track drive raises the brake continuously, not just
    // in discrete steps. Reversible (this._actuation.eiBrake). Effector = emission dampening.
    var servo = s.infraServo || null, eiFactor = 1;
    if (this._actuation && this._actuation.eiBrake && servo) {
      if (typeof servo.emissionFactor === 'number') eiFactor = servo.emissionFactor;
      if (servo.state === 'runaway-risk') reasons.push({ code: 'ei-imbalance', severity: 'dampen', detail: 'inhibition ' + servo.inhibition + ' below target ' + servo.target + ' (drive ' + servo.drive + ')' });
    }
    var halt = reasons.some(function (r) { return r.severity === 'halt'; });
    var dampen = reasons.some(function (r) { return r.severity === 'dampen'; });
    var level = halt ? 'halt' : dampen ? 'dampen' : 'clear';
    var brake = {
      version: 1, level: level, engaged: halt, dampen: dampen, reasons: reasons,
      suppressActions: halt, suppressOpportunities: halt,
      confidencePenalty: Math.min(halt ? 0 : dampen ? 0.5 : 1, eiFactor),   // discrete governor penalty blended with PROPORTIONAL E/I dampening (min = strongest brake wins)
      eiFactor: (Math.round(eiFactor * 1000) / 1000),
      note: level === 'clear' ? 'stop-circuit clear - emission allowed'
        : level === 'halt' ? 'STOP-CIRCUIT ENGAGED - action emission halted, opportunities held'
        : 'stop-circuit dampening - confidence reduced, emission held for review',
      lastBrakeAt: em.updated || Date.now()
    };
    s.infraBrake = brake;
    if (s.cognition && typeof s.cognition === 'object') s.cognition.brake = brake;
    return brake;
  };

  // Consumed by surfaceOpportunities (end): applies the prior cycle's brake to the opportunity set.
  // Halt -> hold + zero confidence; dampen -> proportional confidence penalty. (infra confidence is a
  // 0-100 percent; multiplying by the 0-1 penalty scales it correctly.)
  InfrastructureBrain.prototype._applyInfraEmissionBrake = function (opps) {
    var brake = this.state.infraBrake;
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

  // ── E/I BALANCE READ + SELF-AUDIT (observe-only advisory) ──────────────────────────────────────
  // Closes the audit gap of computing-and-discarding the connectivity / single-points-of-failure
  // self-audit (Neuro Ref XIV: the network, not the node, is the unit of failure). infrastructure.json
  // carries a real 78-edge node graph; the snapshot does NOT (it carries signals/stress only), so the
  // edges are lazily fetched + cached ONCE (browser fire-and-forget / server require) and the audit runs
  // on the REAL graph. Uses the shared, data-agnostic LIMENConnectivityAudit module (name is historical;
  // it takes any {edges}). Deterministic, no AI, no writes.
  InfrastructureBrain.prototype._computeInfraRegulationAdvisories = function () {
    var s = this.state, out = { version: 1, observeOnly: true };
    // (1) E/I balance read — the servo runs the live loop; this is the observe-only summary of it.
    try {
      var servo = s.infraServo || null;
      if (servo) out.eiBalance = { drive: servo.drive, inhibition: servo.inhibition, target: servo.target, state: servo.state, tracking: servo.error <= 0.25 };
    } catch (e) { out.eiBalance = null; }
    // (2) Self-audit — CONSUME the SPOF/connectivity audit on the REAL infra graph.
    try {
      var self = this;
      var edges = this._infraEdges || null;
      if (!edges) {
        if (typeof fetch === 'function' && !this._infraEdgesPromise) {
          this._infraEdgesPromise = fetch('/assets/data/domains/infrastructure.json')
            .then(function (r) { return r.json(); })
            .then(function (j) { if (j && Array.isArray(j.edges)) self._infraEdges = j.edges; })
            .catch(function () {});
        } else if (typeof require === 'function') {
          try { var ed = require('../../data/domains/infrastructure.json'); if (ed && Array.isArray(ed.edges)) { this._infraEdges = ed.edges; edges = ed.edges; } } catch (_e) {}
        }
      }
      var CA = (typeof window !== 'undefined' && window.LIMENConnectivityAudit) || null;
      if (!CA && typeof require === 'function') { try { CA = require('../limen-connectivity-audit.js'); } catch (_e) {} }
      if (CA && edges && edges.length && typeof CA.singlePointsOfFailure === 'function') {
        var audit = CA.singlePointsOfFailure({ edges: edges });
        var spof = (audit && audit.articulationNodes) || [];
        out.selfAudit = { consumed: true, edgeCount: edges.length, spofCount: spof.length, spof: spof.slice(0, 5),
          verdict: (audit && audit.verdict) || null, topHubs: (audit && audit.topHubsByDegree) || [] };
      } else {
        out.selfAudit = { consumed: false, note: edges ? 'connectivity-audit not loaded' : 'edges loading (async, next cycle)' };
      }
    } catch (e) { out.selfAudit = { consumed: false, error: String(e && e.message || e).slice(0, 80) }; }
    s.infraRegulationAdvisories = out;
    if (s.cognition && typeof s.cognition === 'object') s.cognition.regulation = out;
    return out;
  };

  // ── PHASE-COHERENCE READ — ADVISORY ONLY (this._actuation.phase = false) ───────────────────────
  // Deliberately NOT an actuation. Two honest reasons, both required to hold before this could fire:
  //   (a) a realized phase transition is SELF-CONSISTENCY calibration (interpretive), NEVER external
  //       reward; even a validated P3/P7 transition is self-consistency, not reward. External reward
  //       requires a real external realized OUTCOME (Thing1's validated distress), and that envelope
  //       is Finance + Population, NOT infrastructure — so an infra phase transition can only ever be
  //       advisory self-consistency, never a real external reward signal.
  //   (b) infra has NO gain-control output-cap effector for a coherence router to widen (energy's
  //       phase +1 rides on its K2 outputScale; infra does not compute it).
  // We compute the read for VISIBILITY (so the honest boundary is inspectable) but wire NO effector.
  // Deterministic, no AI, no writes. Do NOT flip to an actuation without satisfying (a) AND (b).
  InfrastructureBrain.prototype._computeInfraPhaseAdvisory = function () {
    var s = this.state;
    function norm(p) { if (p == null) return null; p = String(p).toLowerCase().replace(/[^a-z0-9]/g, ''); if (p.charAt(0) !== 'p') p = 'p' + p; return p; }
    var VALIDATED = { p3: 1, p7: 1, p7a: 1, p7b: 1 };            // P3/P7 family gate for phase-consistency tier — self-consistency, NOT external reward

    // ── THING2 KERNEL PHASE SOURCE (real recursive kernel; pure math, NO network/AI) ──
    // 1) Push this cycle's PRIMARY SCALAR (stress; up = worse) to the capped/persisted series.
    // 2) Once >= 8 samples exist and the adapter is loaded, derive phase from the REAL kernel.
    //    Kernel phase (when non-null) is PREFERRED as myPhase below (the coherence read) and
    //    as the phase-transition source; on any failure/unavailability we fall back to the
    //    existing naive/static s.phase. positive:false because stress up = worse.
    this._kernelPhase = null;
    var phaseSource = 'fallback';
    try {
      var _scalar = (typeof s.stress === 'number') ? s.stress
                  : (typeof s.finalStress === 'number') ? s.finalStress
                  : (typeof s.brainStress === 'number') ? s.brainStress : null;
      if (_scalar != null && isFinite(_scalar)) {
        if (!Array.isArray(this._phaseSeries)) this._phaseSeries = [];
        this._phaseSeries.push(Number(_scalar));
        while (this._phaseSeries.length > 60) this._phaseSeries.shift();
        try {
          if (typeof localStorage !== 'undefined' && localStorage) {
            localStorage.setItem('limen:phaseseries:infrastructure', JSON.stringify(this._phaseSeries));
          }
        } catch (e) {}
      }
    } catch (e) {}
    try {
      if (typeof window !== 'undefined' && window.LIMENThing2 && this._phaseSeries && this._phaseSeries.length >= 8) {
        var _kp = window.LIMENThing2.phaseOfSeries(this._phaseSeries, { positive: false });
        if (_kp && _kp.phase) {
          this._kernelPhase = _kp.phase;
          s.kernelPhase = _kp.phase;
          s.kernelTrajectory = _kp.trajectory;
          s.kernelCAccum = _kp.cAccumulator;
          phaseSource = 'thing2-kernel';
        }
      }
    } catch (e) { this._kernelPhase = null; }
    s.phaseSource = phaseSource;

    // PREFER the kernel phase (real recursive kernel) as the coherence-read / phase-transition
    // source; fall back to the existing naive/static s.phase when the kernel is unavailable.
    var myPhase = norm(this._kernelPhase || s.phase);
    var hist = this._infraPhaseHist = this._infraPhaseHist || [];
    var prev = hist.length ? hist[hist.length - 1].phase : null;
    var transition = null;
    if (prev != null && myPhase != null && prev !== myPhase) {
      transition = { from: prev, to: myPhase, validated: !!(VALIDATED[myPhase] || VALIDATED[prev]),
        kind: 'advisory-self-consistency',
        note: 'infra is not Thing1-validated for P3/P7; this transition is NOT used as a learning/reward signal' };
    }
    hist.push({ phase: myPhase, t: (s.infraModel && s.infraModel.updated) || Date.now() });
    if (hist.length > 24) hist.shift();
    var out = { version: 1, actuated: false, observeOnly: true, myPhase: myPhase, transition: transition,
      phaseSource: phaseSource, kernelPhase: this._kernelPhase, kernelTrajectory: s.kernelTrajectory || null,
      seriesLength: (this._phaseSeries && this._phaseSeries.length) || 0,
      note: 'phase-coherence read for visibility; phase SOURCE = ' + phaseSource + ' (real Thing2 kernel when >=8 samples, else naive/static fallback). NO effector wired (infra lacks validated P3/P7 ground-truth + an output-gating effector). Advisory only.' };
    s.infraPhaseDynamics = out;
    if (s.cognition && typeof s.cognition === 'object') s.cognition.phaseDynamics = out;
    return out;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE K — INFRASTRUCTURE NEURO-COMPLETION LAYERS (2026-07-13, ported from energy-brain.js).
  // The eight closed-loop stack layers Energy carries, adapted to read THIS domain's
  // infraModel (prior/observation/predictionError/regulation) and infra caches — never
  // Energy's state:
  //   K1 afferent integration, K2 neuromodulatory gain, K3 slow consolidation,
  //   K4 outcome / credit learning (self-consistency TRUTH BRAKE — realized-stress
  //      self-prediction; NOT an external/dopaminergic reward), K5 deep-perception depth,
  //   K6 attention, K7 lateral inhibition, K8 homeostatic set-point.
  // ADVISORY BY DESIGN: every layer COMPUTES and EXPOSES its signal on state, but NONE
  // rewrites the scoring spine (stress, prior update, opportunity output, predictionError).
  // Deterministic — reads cached state only; NO network / NO AI on the cycle. Never
  // fabricates evidence. Wired into _updateInfraModel in K1..K8 order, before the servo.
  // ════════════════════════════════════════════════════════════════════════════
  var INFRA_K_SLOW_RATE = 0.08;      // slow consolidation rate (mirrors energy EM_SLOW_RATE)
  var INFRA_K_OUTCOME_BUFFER = 40;   // rolling predicted-vs-realized samples
  var INFRA_K_HOMEO_WINDOW = 60;     // cycles of stress baseline for the adaptive set-point
  function _infraKClamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // K1 — afferent inter-brain integration (closed loop). Surfaces received cross-domain
  // pressure and the stress delta it contributes. The infra scoreStress override already
  // folds base external pressure into stress (sets _externalPressureApplied); this exposes
  // the integrated read (contributors, applied delta) without re-adding anything.
  InfrastructureBrain.prototype._computeInfrastructureAfferent = function () {
    var s = this.state, em = s.infraModel || {};
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
      externalPressure: Math.round(pressure * 1000) / 1000,        // base-capped at 0.3
      receivedSignalCount: raw.length,
      activeSignalCount: active,
      contributors: contributors.slice(0, 6),
      integrated: true,                                            // folded into stress by the infra scoreStress override
      appliedStressDelta: Math.round(((s._externalPressureApplied) || 0) * 1000) / 1000,
      wouldRaiseStressBy: Math.round(pressure * 1000) / 1000,
      note: 'CLOSED: the infra scoreStress override (_baseScoreStress) folds externalPressure into stress each cycle (matches the other domains).',
      lastAfferentAt: em.updated || now
    };
    s.infrastructureAfferent = af; return af;
  };

  // K2 — neuromodulatory gain application. infraModel.regulation carries gain + inhibition
  // (from _infraRegulation) but NO outputScale effector. This shows the graded output
  // modulation gain/inhibition WOULD imply on the opportunity set. ADVISORY: infra has no
  // gain-control output cap wired (honest boundary — same reason _actuation.phase=false).
  InfrastructureBrain.prototype._computeInfrastructureGainControl = function () {
    var s = this.state, em = s.infraModel || {}, reg = em.regulation || {};
    var opps = s.opportunities || [];
    // infra has no reg.outputScale; derive an advisory proxy from inhibition (more inhibition -> tighter cap)
    var inhibition = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;
    var outputScale = _infraKClamp(1 - inhibition, 0.2, 1);
    var wouldCapAt = Math.max(1, Math.round(opps.length * outputScale));
    var gc = {
      version: 1,
      gain: (typeof reg.gain === 'number') ? reg.gain : null,
      inhibition: (typeof reg.inhibition === 'number') ? reg.inhibition : null,
      outputScale: Math.round(outputScale * 1000) / 1000,          // advisory proxy (infra computes no true outputScale)
      outputScaleProxy: true,
      currentOpportunityCount: opps.length,
      wouldCapOpportunitiesAt: wouldCapAt,                         // gain-scaled ranked cut (advisory only)
      wouldSuppress: Math.max(0, opps.length - wouldCapAt),
      appliedTargets: [],
      unappliedTargets: ['stress', 'opportunity output', 'treatment surfacing'],
      shadow: true,
      note: 'ADVISORY: infra has no output-cap effector; outputScale is a 1-inhibition proxy. Not applied to the opportunity set (unlike energy K2).',
      lastGainAt: em.updated || Date.now()
    };
    s.infrastructureGainControl = gc; return gc;
  };

  // K3 — slow consolidation / long-term plasticity. Maintains a PARALLEL slow-weight track
  // (INFRA_K_SLOW_RATE) that never touches infraModel.prior; fast-vs-slow divergence is a
  // real regime-shift indicator. Reads em.observation / em.prior (same shapes energy uses).
  InfrastructureBrain.prototype._consolidateInfrastructureSlowModel = function () {
    var s = this.state, em = s.infraModel || {}, obs = em.observation || null;
    var slow = s.infrastructureSlowModel || {
      version: 1, cycle: 0,
      slow: { expectedStress: 0.5, expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, samples: 0 },
      rate: INFRA_K_SLOW_RATE, note: 'parallel slow-weight track (INFRA_K_SLOW_RATE); does NOT touch infraModel.prior'
    };
    if (obs) {
      var r = INFRA_K_SLOW_RATE, w = slow.slow;
      w.expectedStress = _infraKClamp(w.expectedStress + r * ((obs.stress || 0) - w.expectedStress), 0, 1);
      w.expectedSignal = _infraKClamp(w.expectedSignal + r * ((obs.signal || 0) - w.expectedSignal), 0, 1);
      w.expectedDiagnosisCount = w.expectedDiagnosisCount + r * ((obs.diagnosisCount || 0) - w.expectedDiagnosisCount);
      w.expectedOpportunityCount = w.expectedOpportunityCount + r * ((obs.opportunityCount || 0) - w.expectedOpportunityCount);
      w.samples += 1;
      slow.cycle += 1;
    }
    var fast = (em.prior && typeof em.prior.expectedStress === 'number') ? em.prior.expectedStress : 0.5;
    slow.fastSlowDivergence = Math.round(Math.abs(fast - slow.slow.expectedStress) * 1000) / 1000;
    slow.regimeShift = slow.fastSlowDivergence > 0.25;            // fast prior pulled far from slow baseline
    slow.updated = em.updated || Date.now();
    s.infrastructureSlowModel = slow; return slow;
  };

  // K4 — outcome / credit learning (self-consistency TRUTH BRAKE). Compares each cycle's
  // predictedStress against the NEXT cycle's realized stress — an online forward-prediction
  // loop learning from realized-stress SELF-prediction. NOT an external/dopaminergic reward
  // (that is a separate deferred task). Measurement only; exposes hitRate / meanRealizedError.
  InfrastructureBrain.prototype._scoreInfrastructureOutcomes = function () {
    var s = this.state, em = s.infraModel || {};
    var buf = this._infraOutcomeBuffer = this._infraOutcomeBuffer || [];
    var obs = em.observation || null;
    if (this._infraPrevPrediction != null && obs && typeof obs.stress === 'number') {
      buf.push({ predicted: this._infraPrevPrediction, realized: obs.stress, err: Math.abs(this._infraPrevPrediction - obs.stress) });
      if (buf.length > INFRA_K_OUTCOME_BUFFER) buf.shift();
    }
    this._infraPrevPrediction = (typeof em.predictedStress === 'number') ? em.predictedStress : null;  // stash for next-cycle reconciliation
    var n = buf.length, sumErr = 0, sumSq = 0, hits = 0;
    for (var i = 0; i < n; i++) { sumErr += buf[i].err; sumSq += buf[i].err * buf[i].err; if (buf[i].err <= 0.1) hits++; }
    var om = {
      version: 1,
      samples: n,
      meanRealizedError: n ? Math.round((sumErr / n) * 1000) / 1000 : null,   // does the forecast come true
      brierLike: n ? Math.round((sumSq / n) * 1000) / 1000 : null,
      hitRate: n ? Math.round((hits / n) * 100) / 100 : null,                  // fraction within 0.1 of realized
      loopType: 'online-continuous (predicted-vs-next-realized) self-consistency; NOT an external reward',
      creditAssignmentActive: (n >= 5),
      note: 'TRUTH BRAKE (self-consistency): learns from realized-stress self-prediction; hitRate is the calibration read. ADVISORY — not fed back into the infra scoring spine.',
      lastOutcomeAt: em.updated || Date.now()
    };
    s.infrastructureOutcomeModel = om; return om;
  };

  // K5 — deep hierarchical perception / prediction-error depth. Aggregates the perception
  // depth the brain HAS (L1 branch scan + grid sub-portal caches; NO new fetches) and
  // estimates the portalError the recurrent model currently omits. ADVISORY: infra's
  // _infraPredictionError does not consume this (honest note), unlike energy K5.
  InfrastructureBrain.prototype._computeInfrastructurePerceptionDepth = function () {
    var s = this.state, em = s.infraModel || {};
    var l1 = s._l1DepthCache || null;
    var grid = s.gridLayer || null;
    var l1Real = 0, l1Mad = 0;
    if (l1 && l1.byDiagnosis) { Object.keys(l1.byDiagnosis).forEach(function (k) { l1Real += (l1.byDiagnosis[k].realTreatments || 0); l1Mad += (l1.byDiagnosis[k].madLibTreatments || 0); }); }
    var levels = [
      { level: 'L0', name: 'root', status: (this._portalCache || s._portalCache) ? 'loaded' : 'pending' },
      { level: 'L1', name: 'branch-scan', status: l1 ? 'scanned' : 'pending', realTreatments: l1Real, madLibTreatments: l1Mad },
      { level: 'L2', name: 'deep-cortex', status: 'quarantined', note: 'synthetic (immune-blocked from traversal)' },
      { level: 'GRID', name: 'grid-subportal', status: (grid && grid.loaded) ? 'loaded' : 'absent', activeCount: (grid && grid.activeCount) || 0 }
    ];
    var loadedDepth = (grid && grid.loaded) ? 3 : (l1 ? 1 : 0);
    var admissible = l1Real + ((grid && grid.count) ? grid.count : 0);
    var blocked = l1Mad + 1;                                       // +1 for the quarantined L2 tier
    var portalErrorEstimate = Math.round((blocked / Math.max(1, admissible + blocked)) * 1000) / 1000;
    var pd = {
      version: 1, levels: levels, deepestUsableLevel: loadedDepth,
      portalErrorEstimate: portalErrorEstimate,
      note: 'ADVISORY: perception stops at L1 (L2 quarantined); portalErrorEstimate is NOT folded into _infraPredictionError. No new fetches.',
      lastDepthAt: em.updated || Date.now()
    };
    s.infrastructurePerceptionDepth = pd; return pd;
  };

  // K6 — attention / selective routing. Ranks top-down salience (active + relevance +
  // prediction-error novelty, plus any operator attention-focus steer) and names focus vs
  // suppressed diagnoses, without gating the pipeline. ADVISORY read.
  InfrastructureBrain.prototype._computeInfrastructureAttention = function () {
    var s = this.state, em = s.infraModel || {}, reg = em.regulation || {};
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
      note: 'ADVISORY: salience ranking exposed for visibility; does not gate the pipeline.',
      lastAttentionAt: em.updated || Date.now()
    };
    s.infrastructureAttention = at; return at;
  };

  // K7 — lateral inhibition (microcircuit). regulation.inhibition is computed by
  // _infraRegulation; this shows the winner-take-most ranking it implies among competing
  // active diagnoses. ADVISORY read.
  InfrastructureBrain.prototype._computeInfrastructureInhibition = function () {
    var s = this.state, em = s.infraModel || {}, reg = em.regulation || {};
    var inhib = (typeof reg.inhibition === 'number') ? reg.inhibition : 0;
    var active = (s.diagnoses || []).filter(function (d) { return d.active; })
      .sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var winner = active[0] || null;
    var li = {
      version: 1, inhibitionStrength: inhib,
      winner: winner ? winner.id : null,
      competitors: active.slice(1).map(function (d) { return { id: d.id, relevance: d.relevance, suppressBy: Math.round((d.relevance || 0) * inhib * 1000) / 1000 }; }).slice(0, 6),
      note: 'ADVISORY: winner-take-most read among active diagnoses; not applied to opportunity ranking.',
      lastInhibitionAt: em.updated || Date.now()
    };
    s.infrastructureInhibition = li; return li;
  };

  // K8 — adaptive homeostatic set-point (Turrigiano-style synaptic scaling). Maintains an
  // adaptive stress baseline from its OWN rolling window (self-sufficient; does not depend on
  // base populating memory.stressHistory) alongside the fixed INFRA_EM_STRESS_FLOOR set-point.
  InfrastructureBrain.prototype._computeInfrastructureHomeostasis = function () {
    var s = this.state, em = s.infraModel || {};
    var cur = (typeof s.stress === 'number') ? s.stress : 0;
    var win = this._infraHomeoWindow = this._infraHomeoWindow || [];
    win.push(cur);
    if (win.length > INFRA_K_HOMEO_WINDOW) win.shift();
    var n = win.length, sum = 0;
    for (var i = 0; i < n; i++) sum += win[i];
    var baseline = n ? sum / n : 0.5;                             // adaptive set-point vs fixed INFRA_EM_STRESS_FLOOR
    var scalingFactor = baseline > 0 ? Math.round((0.5 / Math.max(0.1, baseline)) * 1000) / 1000 : 1;
    var hm = {
      version: 1,
      fixedFloor: INFRA_EM_STRESS_FLOOR,                          // current hardcoded set-point
      adaptiveBaseline: Math.round(baseline * 1000) / 1000,
      currentStress: cur,
      deviationFromBaseline: Math.round((cur - baseline) * 1000) / 1000,
      scalingFactor: scalingFactor,                               // synaptic-scaling multiplier
      samples: n,
      note: 'ADVISORY: adaptive baseline maintained alongside (never replacing) the fixed INFRA_EM_STRESS_FLOOR. Consumed by the servo as a deviation reference.',
      lastHomeostasisAt: em.updated || Date.now()
    };
    s.infrastructureHomeostasis = hm; return hm;
  };

  // Assemble the neuro-completion surface (mirrors energy's _computeEnergyNeuroLayers). Runs
  // all eight K-layers in K1..K8 order, stores each on state (like infraImmune/infraAwareness),
  // and attaches a compact roll-up to state.cognition ADDITIVELY (new key `neuro`; existing
  // keys untouched). Called from _updateInfraModel BEFORE the servo, so K8's homeostasis
  // deviation is available to the servo's allostatic target the same cycle.
  InfrastructureBrain.prototype._computeInfrastructureNeuroLayers = function () {
    this._computeInfrastructureAfferent();         // K1 — afferent inter-brain input
    this._computeInfrastructureGainControl();       // K2 — neuromodulatory gain application
    this._consolidateInfrastructureSlowModel();     // K3 — slow consolidation / long-term plasticity
    this._scoreInfrastructureOutcomes();            // K4 — outcome / credit learning (self-consistency truth brake)
    this._computeInfrastructurePerceptionDepth();   // K5 — deep hierarchical perception
    this._computeInfrastructureAttention();         // K6 — attention / selective routing
    this._computeInfrastructureInhibition();        // K7 — lateral inhibition (microcircuit)
    this._computeInfrastructureHomeostasis();       // K8 — adaptive set-point (microcircuit)
    var s = this.state;
    var neuro = {
      version: 1,
      status: 'advisory',                            // K-loops computed + exposed; not wired into the scoring spine
      afferent: s.infrastructureAfferent || null,
      gainControl: s.infrastructureGainControl || null,
      slowModel: s.infrastructureSlowModel || null,
      outcomeModel: s.infrastructureOutcomeModel || null,
      perceptionDepth: s.infrastructurePerceptionDepth || null,
      attention: s.infrastructureAttention || null,
      inhibition: s.infrastructureInhibition || null,
      homeostasis: s.infrastructureHomeostasis || null
    };
    s.infrastructureNeuro = neuro;
    if (s.cognition && typeof s.cognition === 'object') s.cognition.neuro = neuro;   // additive: new key only
    return neuro;
  };

  // ── GENERATIVE NODE->BUSINESS AUTHORING — DOCUMENTED NO-OP STUB (never called from the cycle) ──
  // This is the one genuinely "code-cannot-do-this" slot: authoring net-new node->business theses in
  // natural language is a generative-LLM task, not a deterministic computation. COST-SAFETY CONTRACT:
  //   (1) This method is NEVER invoked from cycle()/_updateInfraModel — grep confirms zero call sites
  //       on the deterministic 30s loop.
  //   (2) It runs ONLY on an explicit operator trigger (a button/console action passing {operator:true}).
  //   (3) Any real implementation MUST route through a server endpoint that is killswitch-gated
  //       (server-side lib/ai-kill-switch.js spendDisabled() — the same guard handlers/*-claude.js use).
  //       NO API key ever lives in client code.
  // Until such an endpoint is wired, this stays a no-op that returns a documented note (does NOT call
  // any AI). Leaving it inert is the correct, safe default per the killswitch requirement.
  InfrastructureBrain.prototype._infraAuthorNodeBusinessFromAI = function (opts) {
    opts = opts || {};
    if (!opts.operator) {
      return { ok: false, ran: false, reason: 'operator-trigger-required', note: 'never called from the deterministic cycle; requires an explicit operator action' };
    }
    // Intentionally NOT wired to a live AI call. A future implementation would POST to a
    // killswitch-gated server route (spendDisabled() enforced server-side) — no client-side key.
    return { ok: false, ran: false, reason: 'ai-endpoint-not-wired', note: 'no-op stub: wire a killswitch-gated server endpoint before enabling generative authoring' };
  };

  // ══════════════════════════════════════════════════════════════════════
  // ACTION PIPELINE — the brain acts, not just thinks
  // ══════════════════════════════════════════════════════════════════════

  InfrastructureBrain.prototype._checkDiagnosisActions = function () {
    // HALT BRAKE (actuated) — do not emit action drafts while the stop-circuit is engaged.
    // Reads the PRIOR cycle's brake (computed at cycle end in _updateInfraModel); fail-open on
    // cycle 1 when state.infraBrake is absent. Same one-cycle-lag pattern as energy-brain.
    var _brake = this.state.infraBrake;
    if (_brake && _brake.suppressActions) { this.state._brakeHeldActions = (this.state._brakeHeldActions || 0) + 1; return; }

    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; });
    if (activeDx.length === 0) return;

    // Check if action adapters are available
    var adapters = window.LIMENActionAdapters;
    if (!adapters) return;

    // REFRACTORY GATE (III.3, actuated) — lazy-init the shared, data-agnostic RefractoryLimiter
    // (module is namespaced LIMENRefractoryLimiter but holds NO energy data; it is a generic
    // two-phase absolute+relative limiter). Best-effort: if the module is not loaded on the page or
    // actuation is off, the gate is simply skipped (prior behavior, fail-open). Never breaks the cycle.
    if (!this._refractoryLimiter && this._actuation && this._actuation.refractory &&
        typeof window !== 'undefined' && window.LIMENRefractoryLimiter) {
      try { this._refractoryLimiter = new window.LIMENRefractoryLimiter.RefractoryLimiter(this._refractoryParams); } catch (_e) { this._refractoryLimiter = null; }
    }

    // For each newly active diagnosis, create action drafts
    for (var i = 0; i < activeDx.length; i++) {
      var dx = activeDx[i];

      // Only create drafts if we haven't already for this diagnosis
      var existingDrafts = adapters.getDrafts({ domain: 'infrastructure', intentId: dx.id });
      if (existingDrafts && existingDrafts.length > 0) continue;

      // REFRACTORY GATE: once this diagnosis has emitted a draft, suppress re-emission within the
      // dead-time unless stress clears the override bar. The diagnosis stays ACTIVE and displayed —
      // only the duplicate DRAFT is withheld. Uses the live overlay/pulse timestamp so it tracks
      // real time. Best-effort; falls through to normal emission on any error.
      if (this._refractoryLimiter) {
        try {
          var _now = (this._runtimeOverlay && this._runtimeOverlay.timestamp) ||
                     (this.state.pulse && this.state.pulse.timestamp) ||
                     ((typeof Date !== 'undefined' && Date.now) ? Date.now() : 0);
          var _verdict = this._refractoryLimiter.fire(dx.id, _now, this.state.stress);
          if (!_verdict.allowed) {
            this.state._refractorySuppressed = (this.state._refractorySuppressed || 0) + 1;
            continue;
          }
        } catch (_e) { /* gate is best-effort; fall through to normal emission */ }
      }

      // Draft a report for this diagnosis
      adapters.createDraft('REPORT_GENERATION', {
        domain: 'infrastructure',
        sourceType: 'domain_brain',
        sourceId: dx.id,
        intentId: dx.id,
        title: 'Infrastructure Alert: ' + dx.label,
        intent: {
          domain: 'infrastructure',
          title: dx.label,
          status: 'ACTIVE',
          priority: this.state.stress,
          progress: 0,
          strategyType: 'diagnosis_response',
          steps: [
            { type: 'ANALYZE', label: 'Assess ' + dx.label + ' impact on infrastructure operations', status: 'PENDING' },
            { type: 'INVESTIGATE', label: 'Identify affected assets and systems', status: 'PENDING' },
            { type: 'POSITION', label: 'Evaluate capital opportunities from ' + dx.label, status: 'PENDING' }
          ]
        }
      });
    }
  };

  /**
   * Resolve deep portal content for all active diagnoses.
   * Populates this.state.resolvedContent with citations, steps, monitoring.
   */
  InfrastructureBrain.prototype.resolveDeepContent = function () {
    var self = this;
    var resolver = window.LIMENPortalContentResolver;
    if (!resolver) return Promise.resolve();

    return resolver.resolveForBrain(this.state).then(function (content) {
      self.state.resolvedContent = content;
      if (content) {
        // Update treatments with deep versions
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

  // Override cycle to include deep content resolution + pulse computation
  var _origCycle = InfrastructureBrain.prototype.cycle;
  InfrastructureBrain.prototype.cycle = function () {
    var self = this;
    return _origCycle.call(this).then(function () {
      return self.resolveDeepContent();
    }).then(function () {
      // Compute pulse — evidence validation + delta detection + freshness
      var pulse = window.LIMENInfrastructurePulse;
      if (pulse && typeof pulse.computePulse === 'function') {
        // Pass _activeConditions to the pulse engine via state
        self.state._activeConditions = self._activeConditions || [];
        var pulseState = pulse.computePulse(self.state);
        self.state.pulse = pulseState;
        // Neuro-substrate telemetry (advisory): map live pulse -> runtime overlay via generic adapter.
        try {
          if (window.DomainTelemetryAdapter && typeof window.DomainTelemetryAdapter.fromLiveCached === "function") {
            window.DomainTelemetryAdapter.fromLiveCached("infrastructure", self.state, self._runtimeOverlay || null)
              .then(function (ov) { if (ov) self._runtimeOverlay = ov; }).catch(function () {});
          }
        } catch (_e) {}

        // Apply evidence contract validation — block diagnoses without proper evidence
        if (pulseState && pulseState.validatedDiagnoses) {
          for (var vdi = 0; vdi < pulseState.validatedDiagnoses.length; vdi++) {
            var vdx = pulseState.validatedDiagnoses[vdi];
            // Find matching diagnosis in state and update active flag
            for (var sdi = 0; sdi < self.state.diagnoses.length; sdi++) {
              if (self.state.diagnoses[sdi].id === vdx.diagnosis.id) {
                if (vdx.blocked) {
                  // Evidence contract blocked this — deactivate
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
          // Re-sort after validation
          self.state.diagnoses.sort(function (a, b) {
            if (a.active !== b.active) return a.active ? -1 : 1;
            return b.relevance - a.relevance;
          });
        }
      }
      // Higher cognition: predictive self-model + metacognition (runs AFTER diagnoses settle)
      try { self._updateInfraModel(); } catch (e) {}
    });
  };

  // ==========================================================================
  // HIGHER COGNITION — predictive self-model + metacognition (civil identity).
  // Generic predictive-coding substrate (prior → observe → prediction error →
  // regulation → update prior) + awareness / conscience / immune / intuition.
  // The substrate is domain-agnostic (operates on the brain's own state) and is a
  // candidate to lift into DomainBrainBase once 2-3 domains share it. Energy keeps
  // its own richer, energy-specific version.
  // ==========================================================================
  (function () {
    var P = InfrastructureBrain.prototype;
    var LR = 0.18, STRESS_FLOOR = 0.55, FLOOD_CAP = 12, STALE_MS = 36 * 3600 * 1000;
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function jac(a, b) { a = a || []; b = b || []; if (!a.length && !b.length) return 0; var sa = {}, inter = 0; a.forEach(function (x) { sa[x] = 1; }); b.forEach(function (x) { if (sa[x]) inter++; }); var uni = a.length + b.length - inter; return uni ? 1 - inter / uni : 0; }

    // Civil diagnosis families — an analogy lens for monitoring, NOT evidence.
    var FAMILY = {
      'cyber-physical': ['CYBER_PHYSICAL', 'SCADA_BREACH', 'CYBER_GRID', 'cyber_physical_exposure'],
      'reliability': ['GRID_STRESS', 'GRID_COLLAPSE', 'POWER_RELIABILITY'],
      'structural': ['BRIDGE_DEFICIENCY', 'STRUCTURAL_FAILURE', 'DAM_LEVEE_RISK'],
      'water': ['WATER_MAIN_STRESS', 'WATER_TREATMENT_RISK'],
      'capital': ['CAPITAL_FUNDING_PRESSURE', 'DEFERRED_MAINTENANCE'],
      'transport': ['TRANSPORT_CONGESTION', 'TRANSIT_DEFICIT']
    };

    P._infraNeutralModel = function () {
      return { version: 1, cycle: 0, prior: { expectedStress: 0.5, expectedDiagnoses: [], expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, confidence: 0, samples: 0 }, observation: null, predictionError: null, predictedStress: null, regulation: null, _lowErrorStreak: 0, updated: 0 };
    };
    P._infraObservation = function () {
      var s = this.state || {}; var active = (s.diagnoses || []).filter(function (d) { return d.active; });
      var feeds = s.feeds || {}, fc = 0, newest = 0; for (var k in feeds) { if (feeds.hasOwnProperty(k)) { fc++; var u = feeds[k] && feeds[k].updated; if (u && u > newest) newest = u; } }
      return { stress: typeof s.stress === 'number' ? s.stress : 0, phase: s.phase || null, activeDiagnoses: active.map(function (d) { return d.id; }).sort(), diagnosisCount: active.length, opportunityCount: (s.opportunities || []).length, signal: Math.min(1, fc / 8), feedNewest: newest, timestamp: Date.now() };
    };
    P._infraPredictionError = function (prior, obs) {
      var se = Math.abs(obs.stress - prior.expectedStress), sg = Math.abs(obs.signal - prior.expectedSignal), de = jac(obs.activeDiagnoses, prior.expectedDiagnoses);
      var od = Math.max(1, prior.expectedOpportunityCount, obs.opportunityCount), oe = Math.abs(obs.opportunityCount - prior.expectedOpportunityCount) / od;
      var total = clamp(0.4 * se + 0.2 * sg + 0.25 * de + 0.15 * oe, 0, 1);
      return { total: total, stressError: se, signalError: sg, diagnosisError: de, opportunityError: oe, novelty: Math.max(se, de) };
    };
    P._infraUpdatePrior = function (prior, obs, lr) {
      return { expectedStress: clamp(prior.expectedStress + lr * (obs.stress - prior.expectedStress), 0, 1), expectedDiagnoses: obs.activeDiagnoses.slice(), expectedDiagnosisCount: prior.expectedDiagnosisCount + lr * (obs.diagnosisCount - prior.expectedDiagnosisCount), expectedOpportunityCount: prior.expectedOpportunityCount + lr * (obs.opportunityCount - prior.expectedOpportunityCount), expectedSignal: clamp(prior.expectedSignal + lr * (obs.signal - prior.expectedSignal), 0, 1), confidence: clamp(Math.min(1, (prior.samples + 1) / 20), 0, 1), samples: prior.samples + 1 };
    };
    P._infraRegulation = function (em, obs, pe) {
      var gain = clamp(pe.novelty, 0.05, 0.95), inhib = clamp(1 - pe.novelty, 0, 0.9);
      var starving = obs.stress >= STRESS_FLOOR && obs.opportunityCount === 0, flooding = obs.opportunityCount > FLOOD_CAP;
      var streak = (pe.total < 0.05) ? (em._lowErrorStreak || 0) + 1 : 0; em._lowErrorStreak = streak; var looping = streak >= 3;
      var stale = obs.feedNewest > 0 ? (Date.now() - obs.feedNewest) > STALE_MS : false;
      var overconf = em.prior.confidence > 0.8 && pe.total > 0.4;
      var label = flooding ? 'flooding' : starving ? 'starving' : stale ? 'stale' : looping ? 'looping' : overconf ? 'overconfident' : pe.novelty > 0.4 ? 'surprised' : 'calm';
      return { gain: gain, inhibition: inhib, starving: starving, flooding: flooding, looping: looping, stale: stale, overconfident: overconf, state: label };
    };
    P._updateInfraModel = function () {
      var em = this.state.infraModel || this._infraNeutralModel(); var priorIn = em.prior; var obs = this._infraObservation(); var pe = this._infraPredictionError(priorIn, obs);
      var gb = clamp(pe.novelty, 0.05, 0.95); var predicted = priorIn.expectedStress * (1 - gb) + obs.stress * gb; var reg = this._infraRegulation(em, obs, pe);

      // ── K4 CLOSED — credit assignment routed through the central honest reward gate
      // (window.LIMENK4.credit). Infrastructure is NOT externalRewardEligible: it has no external
      // realized-outcome label, so externalOutcome is ALWAYS null and its credit is self-consistency
      // calibration only (interpretive), NEVER reward. The gate enforces the preemption:
      // external-reward(4) > phase-consistency(3) > call-consistency(2) > stress-consistency(1) > none.
      // Pure deterministic math, no AI/network on the cycle. The returned credit modulates the K4
      // learning rate used for the prior update below (worse self-consistency -> faster relearning).
      var _om = this.state.infrastructureOutcomeModel;                    // K4 stress self-prediction (prior cycle; one-cycle lag)
      var _lr = LR;
      // thing2 realized phase transition: SELF-CONSISTENCY calibration (interpretive), NEVER external
      // reward. Infra phase is ADVISORY (_actuation.phase=false) and its transition carries no realized
      // `hit`, so _ptActive is always false here -> phaseTransitionHit stays null (honest). validated =>
      // P3/P7 family gate for the phase-consistency tier only, never reward.
      var _pt = (this.state.infraPhaseDynamics || {}).transition;
      var _ptActive = !!(this._actuation && this._actuation.phase && _pt && _pt.hit != null);
      // Infra carries no TRUTH-BRAKE call-outcome ledger, so callHitRate is null (tier 2 unavailable).
      var _sig = {
        externalOutcome: null,                                           // NOT eligible: self-consistency only, never reward
        phaseValidated: !!(_pt && _pt.validated),                        // P3/P7 family gate for phase-consistency tier
        phaseTransitionHit: _ptActive ? (_pt.hit ? 1 : 0) : null,        // thing2 transition hit (interpretive) — null (advisory phase)
        callHitRate: null,                                               // no infra call-outcome ledger
        callSamples: 0,
        stressSelfPred: (_om && typeof _om.hitRate === 'number') ? _om.hitRate : null,   // stress self-prediction (self-consistency)
        stressSamples: (_om && typeof _om.samples === 'number') ? _om.samples : 0
      };
      var _k4 = (typeof window !== 'undefined' && window.LIMENK4 && typeof window.LIMENK4.credit === 'function')
        ? window.LIMENK4.credit(_sig) : null;
      var _hit, _creditSource, _isReward;
      if (_k4) {
        _hit = (typeof _k4.credit === 'number') ? _k4.credit : null;
        _creditSource = _k4.creditSource;
        _isReward = !!_k4.isReward;                                      // ALWAYS false for infrastructure (not externalRewardEligible)
      } else {
        // FALLBACK (gate absent) — prior credit behavior preserved, same preemption, in-line. Infra
        // has only the stress-consistency tier available (no phase-actuation, no call ledger).
        var _fromStress = !!(_om && typeof _om.hitRate === 'number' && _om.samples >= 5);
        _hit = _fromStress ? _om.hitRate : null;
        _creditSource = _fromStress ? 'stress-consistency' : 'none';
        _isReward = false;                                              // self-consistency only; never reward
      }
      if (_hit !== null) _lr = clamp(LR * (1 + (1 - _hit)), INFRA_K_SLOW_RATE, 0.6);   // worse self-consistency -> faster relearning
      em._effectiveLearningRate = _lr;
      em._creditSource = _creditSource;
      em._creditIsReward = _isReward;                                    // honest flag: false unless a real external outcome fed the gate

      em.cycle += 1; em.observation = obs; em.predictionError = pe; em.predictedStress = predicted; em.regulation = reg; em.prior = this._infraUpdatePrior(priorIn, obs, _lr); em.updated = obs.timestamp; this.state.infraModel = em;
      var mem = this.state.memory || (this.state.memory = {}); var log = mem.outcomeLog || (mem.outcomeLog = []);
      log.push({ cycle: em.cycle, predictionError: Math.round(pe.total * 1000) / 1000, stress: obs.stress, activeDx: obs.diagnosisCount, regulation: reg.state, timestamp: obs.timestamp }); if (log.length > 40) log.shift();
      try { this._computeInfraHigherLayers(); } catch (e) {}

      // ── K1-K8 NEURO STACK (2026-07-13) — runs after the higher layers settle and BEFORE the servo,
      // so K8's adaptive-baseline deviation feeds the servo's allostatic target the same cycle
      // (K1..K8 order, mirroring energy). Advisory: computes + exposes; never rewrites the spine.
      try { this._computeInfrastructureNeuroLayers(); } catch (e) {}

      // ── ACTUATION LAYER (2026-07-13) — runs at cycle end so it reads the settled governor layers;
      // its outputs (infraBrake) are CONSUMED on the NEXT cycle (one-cycle lag, recurrent). Each is
      // gated behind this._actuation. Deterministic — no AI on the cycle.
      try { if (this._actuation && this._actuation.servo) this._computeInfraServo(); } catch (e) {}   // REGULATE-TO-TARGET SERVO (reads regulation.inhibition + adaptive baseline)
      try { this._computeInfraBrake(); } catch (e) {}                                                 // HALT + E/I BRAKE (reads servo eiFactor when eiBrake on)
      try { this._computeInfraRegulationAdvisories(); } catch (e) {}                                  // E/I read + SPOF self-audit (observe-only)
      try { this._computeInfraPhaseAdvisory(); } catch (e) {}                                         // PHASE read (ADVISORY only; not an actuation — see _actuation.phase=false)

      // GRID — grid sub-portal layer (additive; BEFORE the DDP build so the primary packet's
      // promptView advertises it). Never touches the validated 6-diagnosis spine.
      try { this._infraBuildGridLayer(); } catch (e) {}

      // DDP — build the DomainDiagnosisPacket (8-section contract) for the primary diagnosis,
      // and one per diagnosis. Schema-only: never invents data. Consumed by the Civilization cockpit.
      try {
        var _diags = this.state.diagnoses || [];
        var _primary = _diags.filter(function (d) { return d.active; })[0] || _diags[0] || null;
        var _self = this;
        em.domainDiagnosisPacket = this._buildDomainDiagnosisPacket(_primary);
        this.state.infrastructureDomainDiagnosisPackets = _diags.map(function (d) { return _self._buildDomainDiagnosisPacket(d); });
      } catch (e) {}
    };

    P._computeInfraHigherLayers = function () {
      this._computeInfraImmune(); this._computeInfraAwareness(); this._computeInfraConscience(); this._computeInfraIntuition();
      try { this._infraComputeSimulation(); } catch (e) {}
      try { this._infraComputeExecutiveReport(); } catch (e) {}
      // Generic cognition surface the console can render for ANY domain.
      this.state.cognition = { domain: 'infrastructure', model: { cycle: (this.state.infraModel || {}).cycle || 0, predictionError: (this.state.infraModel || {}).predictionError || null, predictedStress: (this.state.infraModel || {}).predictedStress, regulation: (this.state.infraModel || {}).regulation || null }, awareness: this.state.infraAwareness || null, conscience: this.state.infraConscience || null, immune: this.state.infraImmune || null, intuition: this.state.infraIntuition || null };
    };
    P._computeInfraImmune = function () {
      var s = this.state, em = s.infraModel || {}, reg = em.regulation || {}, ant = [];
      var bs = (typeof this._infraBundleStates === 'function') ? this._infraBundleStates() : [];
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
      // L1 portal treatments are mad-lib templates; quarantine from evidence.
      var _l1 = s._l1DepthCache;
      if (_l1 && _l1.byDiagnosis && Object.keys(_l1.byDiagnosis).some(function (dx) { return _l1.byDiagnosis[dx].madLibTreatments > 0; })) {
        ant.push({ type: 'l1-synthetic-treatments', severity: 'medium', action: 'quarantine', note: 'L1 portal treatments are mad-lib templates (fixed-verb family); quarantined from evidence — only real tickers surfaced relevance-unverified' });
      }
      var sev = ant.some(function (a) { return a.severity === 'high'; }) ? 'high' : ant.some(function (a) { return a.severity === 'medium'; }) ? 'medium' : ant.length ? 'low' : 'none';
      s.infraImmune = {
        version: 1, immuneState: sev === 'high' ? 'alert' : sev === 'medium' ? 'active' : sev === 'low' ? 'watch' : 'clear', severity: sev,
        antigens: ant.slice(0, 12),
        quarantines: ['L1-portal-treatments-madlib'],
        allowedWithWarning: ant.filter(function (a) { return a.action === 'allow-with-warning'; }).map(function (a) { return a.type + (a.dx ? (':' + a.dx) : ''); }),
        blockedFromPrompt: ant.filter(function (a) { return a.action === 'block-from-prompt-evidence'; }).map(function (a) { return a.dx; }),
        blockedFromTraversal: ['L2'],
        lastScanAt: em.updated || null
      };
      return s.infraImmune;
    };
    P._computeInfraAwareness = function () {
      var s = this.state, em = s.infraModel || {}, im = s.infraImmune || {}, active = (s.diagnoses || []).filter(function (d) { return d.active; });
      var pe = (em.predictionError && em.predictionError.total) || 0, dxNames = active.map(function (d) { return d.label || d.id; });
      s.infraAwareness = {
        version: 1, selfState: im.immuneState === 'alert' ? 'guarded' : (em.regulation && em.regulation.state) || 'unknown',
        knowns: dxNames.slice(0, 6),
        uncertainties: ['interpretive tracker — diagnoses are signal-driven readings, not validated', 'predictionError=' + (Math.round(pe * 1000) / 1000)],
        confidenceDrivers: ['regulation ' + ((em.regulation && em.regulation.state) || '?'), active.length + ' active dx'],
        selfNarrative: 'Infrastructure: ' + active.length + ' active diagnosis pathway' + (active.length !== 1 ? 's' : '') + ' (' + (dxNames.slice(0, 3).join(', ') || 'none') + '), regulation=' + ((em.regulation && em.regulation.state) || '?') + ', immune=' + (im.immuneState || '?') + ', prediction-error ' + (Math.round(pe * 100) / 100) + '.',
        lastAwarenessAt: em.updated || null
      };
      return s.infraAwareness;
    };
    P._computeInfraConscience = function () {
      var s = this.state, em = s.infraModel || {}, pe = (em.predictionError && em.predictionError.total) || 0, cautions = [];
      if (pe > 0.4) cautions.push({ claim: 'high-confidence-claim', reason: 'predictionError spike ' + (Math.round(pe * 1000) / 1000) });
      s.infraConscience = { version: 1, conscienceState: 'restrictive', vetoes: [{ claim: 'patent/grant', reason: 'no method/embodiment fields in civil diagnoses' }], cautions: cautions.slice(0, 8), allowedClaims: ['source-summary', 'infrastructure-brief-with-warnings'], blockedClaims: ['patent-claim', 'grant-claim'], artifactReadinessDecision: { patentReady: false, grantReady: false, investmentReady: true, researchReady: true, note: 'patent/grant vetoed; investment/research allowed-with-warning' }, reasons: ['overclaim prevention', 'interpretive-not-validated'], lastCheckAt: em.updated || null };
      return s.infraConscience;
    };
    P._computeInfraIntuition = function () {
      var s = this.state, em = s.infraModel || {}, reg = em.regulation || {}, log = (s.memory && s.memory.outcomeLog) || [], hunches = [];
      if (log.length >= 2) { var a = log[log.length - 2].predictionError, b = log[log.length - 1].predictionError; if (typeof a === 'number' && typeof b === 'number' && b - a > 0.05) hunches.push({ hunch: 'regime shift forming (prediction error rising)', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'predictionError rose ' + a + ' → ' + b }); }
      if (reg.state === 'surprised') hunches.push({ hunch: 'novel stressor entering the system', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', why: 'regulation = surprised' });
      var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
      var primaryId = (active[0] || {}).id, analogies = [];
      Object.keys(FAMILY).forEach(function (fam) { if (FAMILY[fam].indexOf(primaryId) >= 0) { FAMILY[fam].forEach(function (sib) { if (sib !== primaryId) analogies.push({ analogy: primaryId + ' resembles ' + sib, family: fam, evidenceStatus: 'UNVERIFIED' }); }); } });
      s.infraIntuition = { version: 1, hunches: hunches.slice(0, 6), analogies: analogies.slice(0, 6), lastAt: em.updated || null };
      return s.infraIntuition;
    };
  })();

  /**
   * Generate an investor memo for infrastructure terminal company positioning.
   */
  InfrastructureBrain.prototype.generateInvestorMemo = function (opportunityIndex) {
    var opp = this.state.opportunities[opportunityIndex || 0];
    if (!opp) return null;

    var pkg = window.LIMENPackageGenerator;
    if (!pkg) return null;

    return pkg.generatePackage({
      domain: 'infrastructure',
      title: opp.title,
      stress: opp.stress,
      sourceType: opp.source,
      confidence: this.state.confidence
    }, 'investor');
  };

  // ════════════════════════════════════════════════════════════════════════════
  // CIVIL COGNITION PARITY — fallback loaders, source-bundle machinery, L1 mad-lib
  // scan, grid sub-portal layer, bounded simulation + executive report, and the
  // 8-section DomainDiagnosisPacket the Civilization cockpit consumes.
  // Mirrors energy-brain STRUCTURE exactly; only the CONTENT is civil (roads, bridges,
  // water/sewer, the electric grid, transit, dams/levees, cyber-physical SCADA/CISA,
  // construction, deferred maintenance, capital funding). Never fabricates evidence.
  // ════════════════════════════════════════════════════════════════════════════

  // ── DDP schema helpers (mirror energy _ddpPresent / _ddpCompleteness) ──
  var INFRA_DDP_SCHEMA_VERSION = 'infrastructure-ddp-1';
  function _infraDdpPresent(v) {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (v === 'missing' || v === '' || v === 'none') return false;
    return true;
  }
  function _infraDdpCompleteness(section, keys) {
    var have = 0; for (var i = 0; i < keys.length; i++) { if (_infraDdpPresent(section[keys[i]])) have++; }
    return { have: have, total: keys.length, pct: keys.length ? Math.round(have / keys.length * 100) : 0 };
  }
  var INFRA_EM_STRESS_FLOOR = 0.30;

  // ── C6 fallback: real entities from command-board-data (state.companies starved) ──
  InfrastructureBrain.prototype._infraLoadCommandBoardCompanies = function () {
    var self = this;
    if (self._cbInfraCompanies) return;            // one-shot
    self._cbInfraCompanies = [];
    try {
      fetch('/assets/data/command-board-data.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data) return;
          var arr = Array.isArray(data) ? data : (Object.keys(data).map(function (k) { return data[k]; }).find(Array.isArray) || []);
          self._cbInfraCompanies = arr
            .filter(function (x) { return x && x.d === 'infrastructure' && x.t; })
            .map(function (x) { return { name: x.n, ticker: x.t, cik: x.c, phase: x.p, trajectory: x.tr }; });
        })
        .catch(function () {});
    } catch (e) {}
  };

  // ── Distress signals come ONLY from the validated Thing pipeline (/api/brain-signals).
  //    NEVER from raw command-board phase/ds. One-shot; on failure _pubSignals stays {}. ──
  InfrastructureBrain.prototype._infraLoadBrainSignals = function () {
    var self = this;
    if (self._pubSignals) return;                  // one-shot
    self._pubSignals = {};
    try {
      fetch('/api/brain-signals?domain=infrastructure')
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

  // ── F3 — canonical diagnosis resolution. Prefers window.LIMENDomainIdentity.INFRA_PORTAL_TO_BRAIN
  //    (single source of truth), else falls back to INFRA_DIAGNOSIS_ALIASES. Non-aliased
  //    diagnoses are canonical to themselves. Never asserts a bundle exists. ──
  var INFRA_DIAGNOSIS_ALIASES = {
    GRID_DEGRADATION:        { target: 'GRID_RELIABILITY_FAILURE', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits GRID_RELIABILITY_FAILURE (FERC/NERC reliability) for grid degradation' },
    CAPACITY_OVERLOAD:       { target: 'CAPACITY_CONSTRAINT', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits CAPACITY_CONSTRAINT for capacity overload' },
    MAINTENANCE_DEFICIT:     { target: 'DEFERRED_MAINTENANCE', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits DEFERRED_MAINTENANCE for maintenance deficit' },
    CYBER_PHYSICAL_ATTACK:   { target: 'CYBER_GRID_ATTACK', reviewStatus: 'human-approved', risk: 'medium', note: 'mapped to cyber-grid-attack bundle; verify CISA/ICS evidence is appropriate for broader civil infrastructure' }
  };
  InfrastructureBrain.prototype._infraResolveCanonicalDiagnosis = function (dxId) {
    if (!dxId) return { canonicalDiagnosisId: null, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };
    var target = null;
    try {
      var idy = (typeof window !== 'undefined') ? window.LIMENDomainIdentity : null;
      var map = idy && idy.INFRA_PORTAL_TO_BRAIN;
      if (map && map[dxId]) {
        var row = map[dxId];
        // map may yield a string target or a {target,...} object
        if (typeof row === 'string') target = row;
        else if (row && row.target) target = row.target;
      }
    } catch (e) {}
    var local = INFRA_DIAGNOSIS_ALIASES[dxId] || null;
    if (!target && local) target = local.target;
    if (target) {
      return { canonicalDiagnosisId: target, aliasUsed: true, aliasReviewStatus: (local && local.reviewStatus) || 'corpus-aliased', aliasRisk: (local && local.risk) || 'low', aliasNote: (local && local.note) || null };
    }
    return { canonicalDiagnosisId: dxId, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };   // canonical to self
  };

  // ── G1 — load REAL source bundles (one-shot, async). Resolves aliases to canonical IDs
  //    BEFORE fetching. Only files that exist resolve to 'found'; 404s -> 'missing'.
  //    Never fabricates a bundle. ──
  InfrastructureBrain.prototype._infraLoadDiagnosisBundles = function () {
    var self = this;
    if (self._infraBundleLoadPromise) return self._infraBundleLoadPromise;
    self._bundleCache = self._bundleCache || {};
    self._bundleStatusMap = self._bundleStatusMap || {};
    var ids = {};
    var known = ['GRID_DEGRADATION', 'SUPPLY_CHAIN_BOTTLENECK', 'CAPACITY_OVERLOAD', 'TRANSPORTATION_DISRUPTION', 'INFRA_FUNDING_COLLAPSE', 'MAINTENANCE_DEFICIT', 'CYBER_PHYSICAL_ATTACK'];
    var diags = (self.state && self.state.diagnoses) || [];
    var allDxIds = diags.map(function (d) { return d.id; }).concat(known);
    for (var i = 0; i < allDxIds.length; i++) { var c = self._infraResolveCanonicalDiagnosis(allDxIds[i]).canonicalDiagnosisId; if (c) ids[c] = true; }
    self._infraBundleLoadPromise = Promise.all(Object.keys(ids).map(function (cid) {
      return fetch('/assets/data/artifact-source-index/by-diagnosis/' + encodeURIComponent(cid) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) { self._bundleStatusMap[cid] = data ? 'found' : 'missing'; if (data) self._bundleCache[cid] = data; })
        .catch(function () { self._bundleStatusMap[cid] = 'missing'; });
    })).then(function () { return self._bundleCache; });
    return self._infraBundleLoadPromise;
  };

  // ── _infraBundleStates — per-diagnosis canonical resolution + bundle status + provenance ──
  InfrastructureBrain.prototype._infraBundleStates = function () {
    var self = this; var diags = (this.state && this.state.diagnoses) || [];
    return diags.map(function (d) {
      var c = self._infraResolveCanonicalDiagnosis(d.id);
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

  // ── J1 — L1 portal mad-lib scan. L1 treatments are 100% fixed-verb templates; quarantined
  //    from evidence. Only real company tickers surface (relevance-unverified). ──
  var INFRA_MADLIB_VERB = /^(Develop|Establish|Implement|Build|Launch|Design|Deploy|Operationalize|Conduct|Create|Define|Assess|Optimize|Modernize|Strengthen|Enhance|Formalize|Institute|Standardize|Coordinate|Integrate|Calibrate|Evaluate|Streamline|Institutionalize|Configure|Monitor)\b/;
  InfrastructureBrain.prototype._infraIsMadLibTreatment = function (label) { return !label || INFRA_MADLIB_VERB.test(String(label)); };

  InfrastructureBrain.prototype._infraLoadL1PortalDepth = function () {
    var self = this;
    if (self._infraL1LoadPromise) return self._infraL1LoadPromise;
    var BRANCH = {
      GRID_DEGRADATION: ['grid', 'transmission', 'substation', 'transformer'],
      SUPPLY_CHAIN_BOTTLENECK: ['materials', 'construction', 'procurement'],
      CAPACITY_OVERLOAD: ['datacenter', 'cooling', 'peak'],
      TRANSPORTATION_DISRUPTION: ['transit', 'roads', 'ports'],
      INFRA_FUNDING_COLLAPSE: ['federal', 'funding', 'bonds', 'fiscal'],
      MAINTENANCE_DEFICIT: ['maintenance', 'backlog', 'deferred'],
      CYBER_PHYSICAL_ATTACK: ['cyber', 'scada', 'ics', 'vulnerab']
    };
    self._infraL1Branches = BRANCH;
    var branches = {}; Object.keys(BRANCH).forEach(function (dx) { BRANCH[dx].forEach(function (b) { branches[b] = true; }); });
    var byBranch = {};
    self._infraL1LoadPromise = Promise.all(Object.keys(branches).map(function (b) {
      return fetch('/assets/data/domains/infrastructure_' + encodeURIComponent(b) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) {
          if (!data) { byBranch[b] = null; return; }
          var acts = data.activations || [], tickers = {}, total = 0, mad = 0;
          acts.forEach(function (a) {
            (a.companies || []).forEach(function (c) { if (c && c.ticker_or_id) tickers[c.ticker_or_id] = c.name || c.ticker_or_id; });
            (a.treatments || []).forEach(function (t) { var l = t && (t.label || t.title); if (l) { total++; if (self._infraIsMadLibTreatment(l)) mad++; } });
          });
          byBranch[b] = { file: 'infrastructure_' + b, companyTickers: Object.keys(tickers).map(function (k) { return { ticker: k, name: tickers[k] }; }), treatmentTotal: total, madLibCount: mad, realTreatmentCount: total - mad };
        })
        .catch(function () { byBranch[b] = null; });
    })).then(function () {
      var byDiagnosis = {};
      Object.keys(BRANCH).forEach(function (dx) {
        var tk = {}, total = 0, mad = 0, scanned = 0;
        BRANCH[dx].forEach(function (b) { var r = byBranch[b]; if (r) { scanned++; r.companyTickers.forEach(function (c) { tk[c.ticker] = c.name; }); total += r.treatmentTotal; mad += r.madLibCount; } });
        byDiagnosis[dx] = { branchesScanned: scanned, realCompanyTickers: Object.keys(tk).map(function (k) { return { ticker: k, name: tk[k], relevanceUnverified: true }; }), treatmentTotal: total, madLibTreatments: mad, realTreatments: total - mad, admitted: false, reason: 'L1 treatments are mad-lib templates (fixed-verb family) — not source-grade; only company tickers surfaced, relevance unverified' };
      });
      self.state._l1DepthCache = { byBranch: byBranch, byDiagnosis: byDiagnosis, scannedAt: (self.state.infraModel && self.state.infraModel.updated) || null };
      return self.state._l1DepthCache;
    });
    return self._infraL1LoadPromise;
  };

  // ── GRID sub-portal layer (counterpart to energy's data-center layer). Real-content,
  //    hand-authored, citation-backed civil grid diagnoses + treatments. NO external bundle
  //    yet (honest bundleStatus='missing'). NEVER merged into the validated 6-diagnosis spine. ──
  InfrastructureBrain.prototype._infraLoadGridDiagnoses = function () {
    var self = this;
    if (self._infraGridLoadPromise) return self._infraGridLoadPromise;
    self._infraGridLoadPromise = fetch('/assets/data/domains/infrastructure_grid.json')
      .then(function (r) { return (r && r.ok) ? r.json() : null; })
      .then(function (data) {
        if (!data) { self._gridPortal = null; return null; }
        self._gridPortal = { issues: data.issues || [], activations: data.activations || [], title: data.title || 'Electric Grid' };
        return self._gridPortal;
      })
      .catch(function () { self._gridPortal = null; return null; });
    return self._infraGridLoadPromise;
  };

  InfrastructureBrain.prototype._infraBuildGridLayer = function () {
    var self = this;
    var gp = self._gridPortal;
    if (!gp || !gp.issues || !gp.issues.length) {
      self.state.gridDiagnoses = [];
      self.state.gridTreatments = [];
      self.state.gridDomainDiagnosisPackets = [];
      self.state.gridLayer = { loaded: false, count: 0, activeCount: 0, diagnoses: [], note: 'grid sub-portal not loaded (offline or fetch failed)' };
      return self.state.gridLayer;
    }
    var conditions = self._activeConditions || [];
    // 1) diagnoses — same condition-match logic as the canonical spine
    var diagnoses = gp.issues.map(function (iss) {
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
        source: 'grid', tier: 'real-content-unbundled', branch: 'grid'
      };
    });
    // 2) treatments — pull from grid node activations whose brainNodeId is in a diagnosis circuit
    var nodeToDx = {};
    diagnoses.forEach(function (d) { (d.circuits || []).forEach(function (c) { if (c && c.nodeId) nodeToDx[c.nodeId] = d.id; }); });
    var treatments = [];
    (gp.activations || []).forEach(function (act) {
      var dxId = nodeToDx[act.brainNodeId];
      if (!dxId) return;
      (act.treatments || []).forEach(function (t, ti) {
        treatments.push({
          id: 'grid_treat_' + act.brainNodeId + '_' + ti,
          label: t.label, type: t.type, evidence: t.evidence, description: t.description || '',
          cite: t.cite || null, citation: t.citation || [], steps: t.steps || [],
          diagnosisId: dxId, nodeId: act.brainNodeId,
          source: 'grid', madLib: self._infraIsMadLibTreatment ? self._infraIsMadLibTreatment(t.label) : false
        });
      });
    });
    var evidenceRank = { A: 10, Strong: 10, B: 7, Moderate: 7, C: 4, Emerging: 1 };
    treatments.sort(function (a, b) { return (evidenceRank[b.evidence] || 0) - (evidenceRank[a.evidence] || 0); });
    self.state.gridDiagnoses = diagnoses;
    self.state.gridTreatments = treatments;
    // 3) compact layer summary (read by every DDP's promptView)
    self.state.gridLayer = {
      loaded: true,
      portalTitle: gp.title,
      count: diagnoses.length,
      activeCount: diagnoses.filter(function (d) { return d.active; }).length,
      diagnoses: diagnoses.map(function (d) {
        var rc = self._infraResolveCanonicalDiagnosis ? self._infraResolveCanonicalDiagnosis(d.id) : { canonicalDiagnosisId: d.id };
        var bsStat = (self._bundleStatusMap && self._bundleStatusMap[rc.canonicalDiagnosisId]) || 'missing';
        return { id: d.id, label: d.label, active: d.active, branch: 'grid', canonicalDiagnosisId: rc.canonicalDiagnosisId, bundleStatus: bsStat, treatmentCount: treatments.filter(function (t) { return t.diagnosisId === d.id; }).length };
      }),
      note: 'real-content (hand-authored, citation-backed) sub-portal diagnoses for grid/transmission infrastructure; SEPARATE from the validated 6-diagnosis spine; no external artifact-source bundle yet; never admitted to evidenceAnchors'
    };
    // 4) per-diagnosis DDPs via the SAME schema builder (canonical-to-self; bundle 'missing')
    self.state.gridDomainDiagnosisPackets = diagnoses.map(function (d) {
      try { return self._buildDomainDiagnosisPacket(d); } catch (e) { return null; }
    }).filter(Boolean);
    return self.state.gridLayer;
  };

  // ── H5 — bounded counterfactual simulation (hypothetical only; UNVERIFIED) ──
  InfrastructureBrain.prototype._infraComputeSimulation = function () {
    var s = this.state, em = s.infraModel || {};
    var base = typeof s.stress === 'number' ? s.stress : 0;
    function cl(v) { return Math.max(0, Math.min(1, Math.round(v * 1000) / 1000)); }
    var scenarios = [
      { type: 'grid_stress', hypothetical: true, assumption: 'reserve margin erodes below 12%', simulatedStress: cl(base + 0.25), risk: 'cascading outages (GRID_DEGRADATION)', intervention: 'NERC reliability monitoring / reserve-margin restoration', falsifier: 'reserve margins hold above 15%' },
      { type: 'supply_disruption', hypothetical: true, assumption: 'transformer backlog exceeds 12 months', simulatedStress: cl(base + 0.2), risk: 'construction delay (SUPPLY_CHAIN_BOTTLENECK)', intervention: 'supplier-capacity survey / emergency procurement', falsifier: 'transformer backlog clears' },
      { type: 'funding_collapse', hypothetical: true, assumption: 'federal infrastructure spending down >3% QoQ', simulatedStress: cl(base + 0.3), risk: 'deferred-maintenance acceleration (INFRA_FUNDING_COLLAPSE)', intervention: 'state/municipal bond-market monitor', falsifier: 'federal spending reverses' },
      { type: 'cyber_attack', hypothetical: true, assumption: 'CISA KEV / CVE count exceeds 35/mo', simulatedStress: cl(base + 0.2), risk: 'SCADA breach (CYBER_PHYSICAL_ATTACK)', intervention: 'CISA KEV scan + ICS patch-status review', falsifier: 'CVE count normalizes to baseline' },
      { type: 'weather_extreme', hypothetical: true, assumption: 'active NWS alerts exceed 150', simulatedStress: cl(base + 0.15), risk: 'utility failure / grid degradation', intervention: 'emergency-response prep / mutual-aid staging', falsifier: 'alerts clear' }
    ];
    var sim = {
      version: 1, scenarios: scenarios, assumptions: scenarios.map(function (x) { return x.assumption; }),
      simulatedStress: scenarios.map(function (x) { return x.simulatedStress; }),
      simulatedDiagnoses: ['GRID_DEGRADATION', 'INFRA_FUNDING_COLLAPSE', 'CYBER_PHYSICAL_ATTACK'], simulatedOpportunities: [],
      risks: scenarios.map(function (x) { return x.risk; }), interventions: scenarios.map(function (x) { return x.intervention; }),
      falsifiers: scenarios.map(function (x) { return x.falsifier; }), lastSimulatedAt: em.updated || null
    };
    s.infraSimulation = sim; return sim;
  };

  // ── H6 — executive self-report (compact status card) ──
  InfrastructureBrain.prototype._infraComputeExecutiveReport = function () {
    var s = this.state, em = s.infraModel || {}, im = s.infraImmune || {}, aw = s.infraAwareness || {}, con = s.infraConscience || {}, it = s.infraIntuition || {}, sim = s.infraSimulation || {};
    var bs = (typeof this._infraBundleStates === 'function') ? this._infraBundleStates() : [];
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
      nextBestAction: (bs.length && covered < bs.length) ? 'build/verify source for uncovered diagnoses (ensure CISA/DOT/EPA/FERC/NERC civil sources are current)' : hv > 0 ? 'human-verify external-source bundles' : 'monitor strongest diagnosis sources (grid reserve margin, federal spending, maintenance backlog)',
      lastReportAt: em.updated || null
    };
    s.infraExecutiveReport = rep; return rep;
  };

  // ── DDP — the 8-section DomainDiagnosisPacket the Civilization cockpit consumes.
  //    Mirrors energy's _buildDomainDiagnosisPacket exactly; only the CONTENT is civil. ──
  InfrastructureBrain.prototype._buildDomainDiagnosisPacket = function (dx) {
    var s = this.state || {};
    var em = s.infraModel || {};
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
    for (var fk in feeds) { if (feeds.hasOwnProperty(fk)) { var f = feeds[fk]; if (f && typeof f === 'object') sourceFeeds.push({ name: f.name || fk, updated: (f && f.updated) || null, source: (f && f.source) || null }); } }
    if (s._primarySource && !sourceFeeds.length) sourceFeeds.push({ name: 'primary', updated: null, source: s._primarySource });

    var _canon = this._infraResolveCanonicalDiagnosis(dxId);
    var identity = {
      domain: 'infrastructure',
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
      infraModel: { version: em.version || null, cycle: (typeof em.cycle === 'number' ? em.cycle : null) },
      predictionError: em.predictionError || null,
      regulationState: (em.regulation && em.regulation.state) || null,
      prior: em.prior || null,
      observation: em.observation || null,
      plasticity: em.plasticity || null,
      readyForHandoff: em.readyForHandoff === true
    };
    // Domain-identity portal fields are KNOWN facts (this IS the infrastructure root).
    var rootId = (portal && portal.domainId) || 'infrastructure';
    var rootTitle = (portal && portal.title) || 'Infrastructure';
    var ancestry = (portal && portal.parentLabel) ? [portal.parentLabel, rootTitle] : [rootTitle];
    var portalContext = {
      portalIds: [rootId],
      portalDomain: 'infrastructure',
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
    // J2 — human-authoring intake: for external-source bundles missing invention candidates, emit
    // structured empty slots (what each needs + which CIVIL primary source) rather than fabricating.
    var _isExternal = !!(_bundle && _bundle.buildMethod === 'external-source-authored');
    var _intakeSrcHint = {
      GRID_RELIABILITY_FAILURE: 'NERC reliability standards / FERC orders / IEEE 1547 / utility filings',
      SUPPLY_CHAIN_BOTTLENECK: 'DOT freight data / Census construction spending / supplier lead-time reports',
      CAPACITY_CONSTRAINT: 'FERC interconnection queues / ISO/RTO capacity reports / EIA load data',
      TRANSPORTATION_DISRUPTION: 'DOT/FHWA bridge inventory (NBI) / FTA transit data / BTS freight indices',
      INFRA_FUNDING_COLLAPSE: 'IIJA implementation reports / sam.gov / grants.gov / municipal bond filings (MSRB)',
      DEFERRED_MAINTENANCE: 'ASCE Infrastructure Report Card / state DOT maintenance backlogs / inspection reports',
      CYBER_GRID_ATTACK: 'CISA KEV catalog / ICS-CERT advisories / NVD CVE records / NERC CIP standards'
    };
    var authoringIntake = [];
    if (_isExternal) {
      ['methodCandidates', 'embodimentCandidates', 'figurePlaceholders'].forEach(function (field) {
        if (_bArr(field).length === 0) authoringIntake.push({ field: field, status: 'needs-human-input', count: 0, need: field === 'methodCandidates' ? 'a concrete civil-engineering method drawn from a primary source' : field === 'embodimentCandidates' ? 'a specific implementation/embodiment from a real document' : 'a figure description grounded in a real source', sourceHint: _intakeSrcHint[identity.canonicalDiagnosisId] || 'primary institutional / civil-engineering source', note: 'NOT fabricated by the brain — author from the cited source, then wire in verbatim with attribution' });
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
    // Lanes are INVESTABLE (infrastructure companies) / RESEARCHABLE (civil engineering briefs).
    // patent/grant are VETOED by conscience — no method/embodiment fields in civil diagnoses.
    var artifactContext = {
      artifactLanes: artifactLanes,
      patentReady: false, grantReady: false, sbaReady: false,   // patent/grant/loan vetoed by H3 conscience
      investmentReady: !!(hasTreat && primaryOpp), researchReady: ready || hasTreat,
      readinessReasons: readinessReasons,
      blockers: blockers
    };

    var comp = {
      identity:         _infraDdpCompleteness(identity, ['domain', 'diagnosisId', 'canonicalDiagnosisId', 'label', 'phase', 'confidence']),
      brainState:       _infraDdpCompleteness(brainState, ['infraModel', 'predictionError', 'regulationState', 'prior', 'observation', 'plasticity']),
      portalContext:    _infraDdpCompleteness(portalContext, ['portalIds', 'portalDomain', 'portalTitle', 'depth', 'ancestryPath']),
      evidence:         _infraDdpCompleteness(evidence, ['sourceFeeds', 'evidenceAnchors', 'citationHints']),
      treatmentContext: _infraDdpCompleteness(treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']),
      operatorContext:  _infraDdpCompleteness(operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']),
      artifactContext:  _infraDdpCompleteness(artifactContext, ['artifactLanes'])
    };
    var totHave = 0, totAll = 0;
    for (var sk in comp) { if (comp.hasOwnProperty(sk)) { totHave += comp[sk].have; totAll += comp[sk].total; } }
    var missingFields = [];
    function _cm(name, obj, keys) { for (var i = 0; i < keys.length; i++) { if (!_infraDdpPresent(obj[keys[i]])) missingFields.push(name + '.' + keys[i]); } }
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
    if (!primaryOpp && (typeof s.stress !== 'number' || s.stress < INFRA_EM_STRESS_FLOOR)) warnings.push('no active opportunity (offline/low-stress) — operator/lane fields stay empty');
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
        'diagnosis-specific bundle anchors preferred over generic infrastructure evidence',
        'official/primary sources retained (DOT/EPA/FERC/NERC/CISA/ASCE where present)',
        'mechanisms prioritized over figures under prompt-space limits',
        'treatments with implementation relevance preferred over broad narrative',
        'caps applied per field; full data preserved in the stored bundle + full DDP'
      ],
      retainedWarnings: warnings
        .concat(s.infraImmune ? ['immune: ' + s.infraImmune.immuneState + ' (sev ' + s.infraImmune.severity + ', ' + (s.infraImmune.antigens || []).length + ' antigens; L2 traversal blocked)'] : [])
        .concat(s.infraConscience && s.infraConscience.conscienceState === 'restrictive' ? ['conscience: ' + (s.infraConscience.blockedClaims || []).slice(0, 3).join(', ') + ' blocked'] : []),
      retainedBlockers: artifactContext.blockers,
      // higher-layer compact summaries (forwarded to the finalizer via promptView)
      immuneSummary: s.infraImmune ? { immuneState: s.infraImmune.immuneState, severity: s.infraImmune.severity, antigenCount: (s.infraImmune.antigens || []).length, quarantines: s.infraImmune.quarantines, blockedFromTraversal: s.infraImmune.blockedFromTraversal, allowedWithWarning: s.infraImmune.allowedWithWarning } : null,
      awarenessSummary: s.infraAwareness ? { selfNarrative: s.infraAwareness.selfNarrative, knowns: (s.infraAwareness.knowns || []).length, uncertainties: (s.infraAwareness.uncertainties || []).length } : null,
      conscienceDecision: s.infraConscience ? { conscienceState: s.infraConscience.conscienceState, blockedClaims: s.infraConscience.blockedClaims, artifactReadinessDecision: s.infraConscience.artifactReadinessDecision } : null,
      intuitionSummary: s.infraIntuition ? s.infraIntuition.hunches : null,
      scenarioSummary: s.infraSimulation ? (s.infraSimulation.scenarios || []).map(function (x) { return { type: x.type, hypothetical: x.hypothetical, risk: x.risk }; }) : null,
      executiveReport: s.infraExecutiveReport || null,
      l1DepthSummary: portalContext.l1Depth ? { realCompanyTickers: (portalContext.l1Depth.realCompanyTickers || []).length, realTreatments: portalContext.l1Depth.realTreatments, madLibTreatments: portalContext.l1Depth.madLibTreatments, admitted: portalContext.l1Depth.admitted } : null,
      authoringIntake: treatmentContext.authoringIntake.length ? treatmentContext.authoringIntake : null,
      // GRID — grid sub-portal layer (real-content, SEPARATE from the validated spine, no bundle yet)
      infrastructureSummary: s.gridLayer && s.gridLayer.loaded ? { count: s.gridLayer.count, activeCount: s.gridLayer.activeCount, diagnoses: s.gridLayer.diagnoses, note: s.gridLayer.note } : null
    };

    return {
      schemaVersion: INFRA_DDP_SCHEMA_VERSION,
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
        schemaVersion: INFRA_DDP_SCHEMA_VERSION,
        fieldCompleteness: { sections: comp, overallPct: pct },
        missingFields: missingFields,
        warnings: warnings,
        proofTier: proofTier,
        immune: s.infraImmune || null,
        awareness: s.infraAwareness || null,
        conscience: s.infraConscience || null,
        intuition: s.infraIntuition || null,
        simulation: s.infraSimulation || null,
        executiveReport: s.infraExecutiveReport || null
      }
    };
  };

  // ══════════════════════════════════════════════════════════════════════
  // INSTANTIATE AND REGISTER
  // ══════════════════════════════════════════════════════════════════════

  // ── INFRASTRUCTURE-LOCAL FIVE-ORGAN EXTENSION ─────────────────────────────
  // The base schedules these organs; Infrastructure owns their implementation, state and
  // authority here. Thing 2 is not consumed and external action remains inhibited.
  InfrastructureBrain.prototype._refreshInfrastructureActionOutcome = function () {
    if (typeof fetch !== 'function') return null;
    var cycle = this._cycleCount || 0;
    if (this._lastInfrastructureActionOutcomeCycle && cycle - this._lastInfrastructureActionOutcomeCycle < 12) return this._infrastructureActionOutcome || null;
    this._lastInfrastructureActionOutcomeCycle = cycle;
    var self = this;
    try {
      fetch('/api/product-domain-learning-state?domain=' + encodeURIComponent(this.domainId))
        .then(function (response) { return response.json(); })
        .then(function (result) {
          if (!result || result.ok !== true || result.domain !== self.domainId || result.schemaVersion !== 'product-domain-external-learning/1.0') return;
          self._infrastructureActionOutcome = result;
          self.state[self.domainId + 'ActionLearning'] = result;
          self.state.domainActionLearning = result;
        }).catch(function () {});
    } catch (e) {}
    return this._infrastructureActionOutcome || null;
  };

  InfrastructureBrain.prototype._computeInfrastructurePlasticity = function () {
    var s = this.state;
    if (this._plasticity === undefined) {
      try { this._initDomainPlasticity(); } catch (e) { this._plasticity = null; }
    }
    var pl = this._plasticity;
    if (!pl || !pl.P) {
      s.infrastructurePlasticity = s.domainPlasticity = { version: 2, domain: this.domainId, localOwner: true, mode: 'off', note: 'plasticity primitive unavailable' };
      return null;
    }
    try { this._refreshDomainExternalOutcome(); } catch (e) {}
    try { this._refreshInfrastructureActionOutcome(); } catch (e) {}
    var n = (s.cognition && s.cognition.neuro) || s.domainNeuro || {};
    var gc = n.gainControl || {}, at = n.attention || {}, sm = n.slowModel || {}, hm = n.homeostasis || {}, led = n.outcomeLedger || {};
    var pe = (s.cognition && s.cognition.model && ((s.cognition.model.predictionError && s.cognition.model.predictionError.total) || s.cognition.model.predictionError)) || 0;
    var dx = (s.diagnoses || []).filter(function (d) { return d.active; });
    var relevance = dx.length ? dx.reduce(function (sum, d) { return sum + (d.relevance || 0); }, 0) / dx.length : 0;
    var actionOutcome = this._infrastructureActionOutcome;
    var actionReady = !!(actionOutcome && actionOutcome.status === 'ELIGIBLE' && actionOutcome.signal && actionOutcome.learningGate && actionOutcome.learningGate.ready === true &&
      actionOutcome.signal.sourceKind === 'independent-action-outcome' && typeof actionOutcome.signal.normalizedCredit === 'number');
    var ext = actionReady ? { hit: actionOutcome.signal.normalizedCredit, resolvedCount: actionOutcome.resolvedCount, sourceKind: 'independent-action-outcome' } : this._externalOutcome;
    var sourceKind = actionReady ? 'independent-action-outcome' : 'feed-resolution';
    var k4api = typeof window !== 'undefined' ? window.LIMENK4 : null;
    var eligible = !!(k4api && k4api.externalRewardEligible && k4api.externalRewardEligible(this.domainId, sourceKind));
    var resolved = ext && ext.resolvedCount || 0;
    var externalOutcome = eligible && typeof (ext && ext.hit) === 'number' && resolved >= 5 ? { hit: ext.hit, sourceKind: sourceKind } : null;
    var credit = k4api && k4api.credit ? k4api.credit({
      domain: this.domainId, externalOutcome: externalOutcome,
      callHitRate: typeof led.hitRate === 'number' ? led.hitRate : null, callSamples: led.samples || 0,
      stressSelfPred: typeof led.hitRate === 'number' ? led.hitRate : null, stressSamples: led.samples || 0
    }) : null;
    this._plasticityRewardActive = !!(credit && credit.isReward);
    var mod = pl.P.readModulator(pl.mod, credit, typeof led.resolvedTotal === 'number' ? led.resolvedTotal : (led.samples || 0));
    var feeds = {
      K_gain: { pre: [gc.inhibition || 0], post: 1 - (typeof gc.outputScale === 'number' ? gc.outputScale : 1) },
      K_attention: { pre: [dx.length ? 1 : 0, relevance, pe], post: (at.focus && at.focus[0] && at.focus[0].salience) || 0 },
      K_slow: { pre: [Math.abs((s.stress || 0) - (sm.expectedStress == null ? 0.5 : sm.expectedStress))], post: sm.fastSlowDivergence || 0 },
      K_homeo: { pre: [hm.baseline == null ? 0.5 : hm.baseline], post: hm.adaptiveThreshold || 0.1 }
    };
    var layers = {}, live = [], stable = true;
    Object.keys(pl.layers).forEach(function (key) {
      var layer = pl.layers[key], f = feeds[key];
      pl.P.tick(layer, f.pre, f.post);
      if (mod.fresh && mod.rpe !== null) pl.P.applyModulator(layer, mod.rpe, { metaplasticity: !!(this._actuation && this._actuation.metaplasticityLive) });
      this._learnedVec(key, layer.seed);
      var blend = typeof layer._blend === 'number' ? layer._blend : 0;
      if (blend > 0) live.push(key);
      layers[key] = { w: layer.w.slice(), labels: layer.labels, updates: layer.updates, shadowOutput: pl.P.shadowSum(layer, f.pre), live: blend > 0, blend: blend, diag: layer.diag };
      if (!layer.diag.stable) stable = false;
    }, this);
    var out = {
      version: 2, domain: this.domainId, localOwner: true, mode: live.length ? 'armed' : 'shadow',
      liveLayers: live, rewardActive: !!this._plasticityRewardActive,
      creditSource: credit && credit.creditSource || 'none', creditTier: credit && credit.tier || 0,
      externalOutcome: externalOutcome ? { hit: externalOutcome.hit, resolvedCount: resolved, source: sourceKind }
        : { active: false, resolvedCount: resolved, note: 'abstaining until five eligible independent outcomes resolve' },
      layers: layers, convergence: { allStable: stable },
      persistence: { hydrated: pl.hydrated, enabled: pl.persistEnabled, failures: pl.persistFailures },
      note: 'Infrastructure-local three-factor plasticity; outcome-gated and fail-toward-seed.'
    };
    s.infrastructurePlasticity = s.domainPlasticity = out;
    if (s.cognition) s.cognition.plasticity = out;
    if ((this._cycleCount || 0) - (pl.lastPersistCycle || 0) >= 10) {
      pl.lastPersistCycle = this._cycleCount || 0;
      try { this._persistDomainPlasticity(false); } catch (e) {}
    }
    return out;
  };

  InfrastructureBrain.prototype._computeInfrastructureEmissionQueue = function () {
    var s = this.state, n = s.domainNeuro || {}, brake = n.brake || {}, forecast = n.forecast || null;
    var pool = (s.opportunities || []).filter(function (o) { return o && !o.held && (o.path === 'INVESTABLE' || o.path === 'RESEARCHABLE'); });
    var packages = pool.slice(0, 3).map(function (o) {
      var capital = o.path === 'INVESTABLE';
      return { id: o.id, title: o.title, lane: o.path, confidence: o.confidence,
        thesis: o.whyNow || o.title, moneyChain: o.moneyChain || null,
        instrument: (o.companies && o.companies.length) ? o.companies : (o.examples || []),
        forecast: forecast ? { direction: forecast.direction, projectedStress: forecast.projectedStress, horizonPeriods: forecast.horizonPeriods, falsifier: forecast.falsifier, confidence: forecast.confidence } : null,
        requiresSignoff: capital, decision: capital ? 'capital sign-off required' : 'internal research eligible',
        brakeLevel: brake.level || 'clear' };
    });
    var out = { version: 2, domain: this.domainId, localOwner: true, maxConcurrent: 3,
      poolSize: pool.length, queued: packages.length, prunedOut: Math.max(0, pool.length - packages.length),
      packages: packages, lastQueueAt: Date.now(), note: 'Infrastructure-local queue; research internal-only, capital staged.' };
    s.infrastructureEmissionQueue = s.domainEmissionQueue = out;
    return out;
  };

  InfrastructureBrain.prototype._runInfrastructureAutonomousEmission = function () {
    var s = this.state, brake = s.domainNeuro && s.domainNeuro.brake;
    var globalOn = typeof window !== 'undefined' && window.LIMEN_DOMAIN_AUTONOMY !== undefined ? !!window.LIMEN_DOMAIN_AUTONOMY : true;
    var localOn = !!(this.resourceAuthority && this.resourceAuthority.switches && this.resourceAuthority.switches.internalEmission);
    var hold = !globalOn || !localOn ? 'domain-internal-autonomy-off'
      : (!s.resourceMetabolism || !s.resourceMetabolism.gates || !s.resourceMetabolism.gates.mayEmitInternal) ? 'resource-metabolism-inhibited'
      : (!brake || brake.level !== 'clear') ? 'brake-' + (brake ? brake.level : 'absent') : null;
    var emitted = [], staged = [], queue = (s.infrastructureEmissionQueue && s.infrastructureEmissionQueue.packages) || [];
    queue.forEach(function (p) {
      if (hold) { p.status = 'held'; staged.push(p); }
      else if (p.requiresSignoff) { p.status = 'staged-for-signoff'; staged.push(p); }
      else { p.status = 'emitted-internal'; emitted.push(p); }
    });
    if (emitted.length) {
      var stream = s.infrastructureEmitted = s.infrastructureEmitted || [];
      emitted.forEach(function (p) { stream.push({ at: Date.now(), title: p.title, lane: p.lane, forecast: p.forecast }); });
      if (stream.length > 50) s.infrastructureEmitted = stream.slice(-50);
    }
    var out = { version: 2, domain: this.domainId, localOwner: true, autonomy: globalOn && localOn,
      holdReason: hold, emittedCount: emitted.length, stagedCount: staged.length, emitted: emitted, staged: staged,
      externalEffects: 0, lastEmissionAt: Date.now(), note: hold ? 'held fail-safe' : 'Infrastructure-local internal research emission; capital staged.' };
    s.infrastructureAutoEmission = s.domainAutoEmission = out;
    return out;
  };

  InfrastructureBrain.prototype._computeInfrastructureInteroception = function () {
    var s = this.state, cog = s.cognition;
    if (!cog) return null;
    var model = cog.model || {}, n = s.domainNeuro || cog.neuro || {};
    var clamp = function (x) { return Math.max(0, Math.min(1, x)); }, r = function (x) { return Math.round(x * 1000) / 1000; };
    var channels = [{ name: 'domain-stress', alarm: r(clamp(s.stress || 0)), confidence: 0.9, weight: 1, provenance: 'Infrastructure structured stress' }];
    var pe = model.predictionError && typeof model.predictionError === 'object' ? model.predictionError.total : model.predictionError;
    if (typeof pe === 'number') channels.push({ name: 'prediction', alarm: r(clamp(pe)), confidence: 0.7, weight: 0.85, provenance: 'Infrastructure prediction error' });
    var ledger = n.outcomeLedger || {};
    if (typeof ledger.hitRate === 'number' && ledger.samples >= 3) channels.push({ name: 'metacognitive', alarm: r(clamp(1 - ledger.hitRate)), confidence: ledger.samples >= 5 ? 0.7 : 0.4, weight: 0.75, provenance: 'Infrastructure outcomes' });
    var immune = cog.immune || {}, ia = { clear: 0, watch: 0.34, active: 0.4, alert: 1 };
    if (immune.immuneState) channels.push({ name: 'immune', alarm: ia[immune.immuneState] == null ? 0.34 : ia[immune.immuneState], confidence: 0.6, weight: 0.6, provenance: 'Infrastructure immune state' });
    var forecast = n.forecast;
    if (forecast && typeof forecast.projectedStress === 'number') channels.push({ name: 'allostatic', alarm: r(clamp((forecast.projectedStress - (s.stress || 0)) * 3)), confidence: typeof forecast.confidence === 'number' ? clamp(forecast.confidence) : 0.4, weight: 0.6, provenance: 'Infrastructure forecast' });
    var weighted = function (list) { var a = 0, b = 0; list.forEach(function (c) { var w = c.weight * c.confidence; a += c.alarm * w; b += w; }); return b ? a / b : 0; };
    var primary = channels[0], others = channels.slice(1), other = others.length ? weighted(others) : 0, divergence = other - primary.alarm;
    var loudest = others.slice().sort(function (a, b) { return b.alarm * b.confidence - a.alarm * a.confidence; })[0];
    var salience = divergence >= 0.22 && primary.alarm < 0.5 && loudest && loudest.alarm >= 0.4 ? 'blind-channel'
      : primary.alarm - other >= 0.22 && primary.alarm >= 0.5 ? 'primary-only' : 'aligned';
    var alarms = channels.map(function (c) { return c.alarm; });
    var out = { version: 2, domain: this.domainId, localOwner: true, method: 'domain-local-weighted-divergence',
      observeOnly: true, channels: channels, channelCount: channels.length,
      primary: 'domain-stress', primaryAlarm: primary.alarm, consensusOther: r(other),
      integrated: r(weighted(channels)), divergence: r(divergence),
      uncertainty: r(Math.max.apply(null, alarms) - Math.min.apply(null, alarms)), salience: salience,
      attend: salience === 'blind-channel' ? loudest.name : null, note: 'Infrastructure-local interoception; observe-only.' };
    s.infrastructureInteroception = s.domainInteroception = s.interoception = out;
    cog.interoception = out;
    return out;
  };

  InfrastructureBrain.prototype._computeInfrastructureActiveInference = function () {
    var s = this.state, cog = s.cognition;
    if (!cog) return null;
    if (this._activeInference === undefined) {
      try { this._initDomainActiveInference(); } catch (e) { this._activeInference = null; }
    }
    var box = this._activeInference;
    if (!box || !box.A) {
      s.infrastructureActiveInference = s.domainActiveInference = { version: 2, domain: this.domainId, localOwner: true, mode: 'off', note: 'active-inference primitive unavailable' };
      return null;
    }
    var n = s.domainNeuro || cog.neuro || {}, ledger = n.outcomeLedger || {};
    box.A.updateBeliefs(box.ai, typeof s.stress === 'number' ? s.stress : null);
    var selection = box.A.selectAction(box.ai, { setpoint: n.homeostasis && typeof n.homeostasis.adaptiveThreshold === 'number' ? n.homeostasis.adaptiveThreshold : 0.35,
      callHitRate: typeof ledger.hitRate === 'number' ? ledger.hitRate : null, brakeActive: !!(n.brake && n.brake.level === 'halt') });
    var queued = (s.infrastructureEmissionQueue && s.infrastructureEmissionQueue.packages || []).length;
    var actual = n.brake && n.brake.level === 'halt' ? 'hold-emission' : queued ? 'emit-call' : n.attention && n.attention.driver === 'novelty-driven' ? 'broaden-attention' : 'observe';
    var out = { version: 2, domain: this.domainId, localOwner: true, mode: 'shadow',
      selected: selection.selected, selectedMaps: selection.selectedMaps, actualBehavior: actual,
      agreement: selection.selected === actual, actions: selection.actions, beliefs: selection.beliefs,
      preference: selection.preference, liveConsumer: false, thing2Consumed: false,
      note: 'Infrastructure-local belief update and expected-free-energy advisory; no live consumer.' };
    s.infrastructureActiveInference = s.domainActiveInference = out;
    cog.activeInference = out;
    return out;
  };

  InfrastructureBrain.prototype._computeDomainPlasticity = InfrastructureBrain.prototype._computeInfrastructurePlasticity;
  InfrastructureBrain.prototype._computeGenericEmissionQueue = InfrastructureBrain.prototype._computeInfrastructureEmissionQueue;
  InfrastructureBrain.prototype._runGenericAutonomousEmission = InfrastructureBrain.prototype._runInfrastructureAutonomousEmission;
  InfrastructureBrain.prototype._computeGenericInteroception = InfrastructureBrain.prototype._computeInfrastructureInteroception;
  InfrastructureBrain.prototype._computeGenericActiveInference = InfrastructureBrain.prototype._computeInfrastructureActiveInference;


  var brain = new InfrastructureBrain();
  brain.init();
  brain.start();

  window.LIMENInfrastructureBrain = brain;
  window.LIMENDomainBrains.register(brain);

  // ── Auto-load infrastructure operator stack on domain-console ──
  // domain-console.html hardcodes energy scripts in its chain.
  // Infrastructure loads its own operator surface here so we don't
  // touch any energy or shared infrastructure files.
  var _isDomainConsole = window.location.pathname.indexOf('domain-console') !== -1;
  var _isInfraDomain = (new URLSearchParams(window.location.search)).get('domain') === 'infrastructure';
  if (_isDomainConsole && _isInfraDomain) {
    // Enable directive extraction for infrastructure (same feature flag energy uses)
    window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION = true;

    // Full operator stack — mirrors energy's loading chain exactly
    var _infraScripts = [
      'assets/js/infrastructure-compensation.js',
      'assets/js/infrastructure-claim-ledger.js',
      'assets/js/infrastructure-claim-flow.js',
      'assets/js/infrastructure-opportunity-economics.js',
      'assets/js/infrastructure-pulse-engine.js',
      'assets/js/infrastructure-operator-panel.js',
      'assets/js/infrastructure-node-business-engine.js',
      'assets/js/infrastructure-business-review.js',
      'assets/js/infrastructure-execution-panels.js',
      'assets/js/infrastructure-business-build.js',
      'assets/js/infrastructure-directive-extractor.js',
      'assets/js/infrastructure-directive-ranker.js',
      'assets/js/infrastructure-directive-translator.js',
      'assets/js/infrastructure-targeting-engine.js',
      'assets/js/infrastructure-promotion-bridge.js',
      'assets/js/infrastructure-clarity-operator.js'
    ];
    (function loadNext(i) {
      if (i >= _infraScripts.length) return;
      var s = document.createElement('script');
      s.src = _infraScripts[i];
      s.onload = function () { loadNext(i + 1); };
      s.onerror = function () { console.warn('[InfrastructureBrain] Failed to load ' + _infraScripts[i]); loadNext(i + 1); };
      document.head.appendChild(s);
    })(0);
  }
})();
