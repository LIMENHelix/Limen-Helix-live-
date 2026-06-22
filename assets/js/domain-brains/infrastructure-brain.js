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
    Base.call(this, {
      domainId: 'infrastructure',
      label: 'Infrastructure',
      snapshotKey: 'infrastructure',
      cycleInterval: 30000
    });
  }

  // Inherit from base
  InfrastructureBrain.prototype = Object.create(Base.prototype);
  InfrastructureBrain.prototype.constructor = InfrastructureBrain;

  // ══════════════════════════════════════════════════════════════════════
  // INIT — register feeds, diagnosis index, emission rules
  // ══════════════════════════════════════════════════════════════════════

  InfrastructureBrain.prototype.init = function () {
    Base.prototype.init.call(this);

    // Diagnosis → signal condition mapping
    // These map live conditions to which diagnoses become active
    this.diagnosisIndex = {
      'GRID_DEGRADATION':         ['grid_stress', 'utility_failure', 'INFRASTRUCTURE_ATTACK', 'aging_infrastructure', 'structural_stress', 'transmission_congestion', 'substation_bottleneck', 'transformer_backlog'],
      'SUPPLY_CHAIN_BOTTLENECK':  ['materials_shortage', 'logistics_disruption', 'SUPPLY_DISRUPTION', 'construction_delay', 'transformer_backlog', 'interconnection_delay'],
      'CAPACITY_OVERLOAD':        ['capacity_constraint', 'demand_surge', 'congestion', 'logistics_stress', 'datacenter_demand', 'peak_curtailment', 'transmission_congestion', 'cooling_infrastructure_strain', 'self_generation_strain'],
      'INFRA_FUNDING_COLLAPSE':   ['funding_gap', 'FISCAL_CRISIS', 'budget_cut', 'bond_market_stress'],
      'MAINTENANCE_DEFICIT':      ['maintenance_critical', 'asset_deterioration', 'inspection_failure', 'deferred_maintenance', 'substation_bottleneck'],
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
        signals.push('CRITICAL: grid reserve margin below 10% — at ' + fmtNumber(f.value, 1) + '%');
      }

      // Federal spending drop — 3% quarterly decline is a real funding signal
      if ((fn.indexOf('federal') !== -1 || fn.indexOf('spending') !== -1 || fn.indexOf('fiscal') !== -1) && f.value !== undefined && f.value < -3) {
        this._activeConditions.push('funding_gap');
        signals.push('ELEVATED: federal infrastructure spending declining — ' + f.value.toFixed(1) + '% drop');
      }

      // Maintenance backlog
      if ((fn.indexOf('maintenance') !== -1 || fn.indexOf('backlog') !== -1 || fn.indexOf('deferred') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('maintenance_critical');
        this._activeConditions.push('deferred_maintenance');
        signals.push('ELEVATED: maintenance backlog signal detected — value ' + f.value.toFixed(1));
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
        var sigAge = sig.timestamp ? (now - sig.timestamp) : Infinity;
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
    if (this.state.stress >= 0.40) {
      this._activeConditions.push('structural_stress');
      this._activeConditions.push('aging_infrastructure');
    }
    if (this.state.stress >= 0.55) {
      this._activeConditions.push('grid_stress');
      this._activeConditions.push('utility_failure');
      this._activeConditions.push('deferred_maintenance');
    }
    if (this.state.stress >= 0.70) {
      this._activeConditions.push('capacity_constraint');
      this._activeConditions.push('asset_deterioration');
      this._activeConditions.push('inspection_failure');
    }

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
  };

  InfrastructureBrain.prototype.deriveDiagnoses = function () {
    var self = this;
    return this._getPortalContent().then(function (portal) {
      if (!portal) return;

      var issues = portal.issues || [];
      var conditions = self._activeConditions || [];

      self.state.diagnoses = issues.map(function (iss) {
        var brainKey = INFRA_PORTAL_TO_BRAIN[iss.id] || iss.id;
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

    this.state.opportunities = opps;
    this.state.opportunityCount = opps.length;

    return Promise.resolve();
  };

  // ══════════════════════════════════════════════════════════════════════
  // ACTION PIPELINE — the brain acts, not just thinks
  // ══════════════════════════════════════════════════════════════════════

  InfrastructureBrain.prototype._checkDiagnosisActions = function () {
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; });
    if (activeDx.length === 0) return;

    // Check if action adapters are available
    var adapters = window.LIMENActionAdapters;
    if (!adapters) return;

    // For each newly active diagnosis, create action drafts
    for (var i = 0; i < activeDx.length; i++) {
      var dx = activeDx[i];

      // Only create drafts if we haven't already for this diagnosis
      var existingDrafts = adapters.getDrafts({ domain: 'infrastructure', intentId: dx.id });
      if (existingDrafts && existingDrafts.length > 0) continue;

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
    });
  };

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

  // ══════════════════════════════════════════════════════════════════════
  // INSTANTIATE AND REGISTER
  // ══════════════════════════════════════════════════════════════════════

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
