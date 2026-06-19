/**
 * environment-brain.js — Environment Domain Cognitive Engine
 *
 * Extends DomainBrainBase. Same architecture as trade/energy/finance brains.
 *
 * Diagnosis matching: maps live signal conditions to environment portal issues
 *   CLIMATE_TIPPING_POINT → temperature_anomaly, extreme_weather, climate_volatility, sea_level, ecosystem_disruption
 *   MASS_EXTINCTION → habitat_loss, species_decline, biodiversity_collapse, food_chain_imbalance, invasive_species
 *   OCEAN_ACIDIFICATION → marine_ph_decline, coral_bleaching, fishery_collapse, ocean_chemistry
 *   DEFORESTATION → forest_loss, carbon_sink_decline, soil_degradation, habitat_fragmentation
 *   TOXIC_CONTAMINATION → water_contamination, air_quality, toxic_spill, industrial_discharge, waste_accumulation
 *
 * Cross-domain emissions:
 *   environment → agriculture (ecosystem and soil stress)
 *   environment → energy (climate pressure and resource constraints)
 *   environment → infrastructure (environmental degradation impact)
 *   environment → economy (environmental cost pressure)
 *   environment → governance (regulatory pressure triggers)
 *
 * Exposes: window.LIMENEnvironmentBrain
 */
(function () {
  'use strict';

  if (!window.LIMENDomainBrainBase) {
    console.warn('[EnvironmentBrain] DomainBrainBase not loaded');
    return;
  }

  var Base = window.LIMENDomainBrainBase;

  function EnvironmentBrain() {
    Base.call(this, {
      domainId: 'environment',
      label: 'Environment',
      snapshotKey: 'environment',
      cycleInterval: 30000
    });
  }

  EnvironmentBrain.prototype = Object.create(Base.prototype);
  EnvironmentBrain.prototype.constructor = EnvironmentBrain;

  // ══════════════════════════════════════════════════════════════════════
  // INIT — register diagnosis index and emission rules
  // ══════════════════════════════════════════════════════════════════════

  EnvironmentBrain.prototype.init = function () {
    Base.prototype.init.call(this);

    // Keys MUST match portal issue IDs in environment.json
    this.diagnosisIndex = {
      'CLIMATE_TIPPING_POINT':  ['temperature_anomaly', 'extreme_weather', 'climate_volatility', 'sea_level', 'ecosystem_disruption', 'environment_high_stress', 'structural_stress', 'macro_shock'],
      'MASS_EXTINCTION':        ['habitat_loss', 'species_decline', 'biodiversity_collapse', 'food_chain_imbalance', 'invasive_species', 'ecosystem_disruption'],
      'OCEAN_ACIDIFICATION':    ['marine_ph_decline', 'coral_bleaching', 'fishery_collapse', 'ocean_chemistry', 'marine_pollution'],
      'DEFORESTATION':          ['forest_loss', 'carbon_sink_decline', 'soil_degradation', 'habitat_fragmentation', 'land_use_conflict'],
      'TOXIC_CONTAMINATION':    ['water_contamination', 'air_quality_degradation', 'toxic_spill', 'industrial_discharge', 'waste_accumulation', 'environment_high_stress']
    };

    this.emissionRules = [
      {
        targetDomain: 'agriculture',
        signalType: 'ecosystem_soil_stress',
        condition: function (s) { return s.stress >= 0.40; },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.55); }
      },
      {
        targetDomain: 'energy',
        signalType: 'climate_resource_constraint',
        condition: function (s) { return s.stress >= 0.45; },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.45); }
      },
      {
        targetDomain: 'infrastructure',
        signalType: 'environmental_degradation_impact',
        condition: function (s) { return s.stress >= 0.50; },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); }
      },
      {
        targetDomain: 'economy',
        signalType: 'environmental_cost_pressure',
        condition: function (s) { return s.stress >= 0.55; },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.4); }
      },
      {
        targetDomain: 'governance',
        signalType: 'environmental_regulatory_pressure',
        condition: function (s) { return s.stress >= 0.45; },
        magnitudeFormula: function (s) { return Math.min(1, s.stress * 0.5); }
      }
    ];
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 2: Normalize signals into environment-native semantics
  // ══════════════════════════════════════════════════════════════════════

  EnvironmentBrain.prototype.normalizeSignals = function () {
    var signals = [];
    var rawSignals = (this._rawDomain && this._rawDomain.signals) || [];

    for (var i = 0; i < rawSignals.length; i++) {
      signals.push(rawSignals[i]);
    }

    this._activeConditions = [];

    // Check feed values for environment-specific triggers
    var feeds = this.state.feeds;
    for (var fi = 0; fi < feeds.length; fi++) {
      var f = feeds[fi], fn = (f.name || '').toLowerCase();

      // NOAA Climate data — temperature anomalies
      if ((fn.indexOf('climate') !== -1 || fn.indexOf('noaa') !== -1 || fn.indexOf('temperature') !== -1) && f.value !== undefined) {
        if (f.value > 1.5) {
          this._activeConditions.push('temperature_anomaly');
          this._activeConditions.push('climate_volatility');
          signals.push('ELEVATED: Temperature anomaly above 1.5°C threshold');
        }
        if (f.value > 2.0) {
          this._activeConditions.push('extreme_weather');
          signals.push('CRITICAL: Temperature anomaly exceeding 2.0°C — extreme weather risk');
        }
      }

      // NOAA Alerts — environmental disturbance
      if ((fn.indexOf('alert') !== -1 || fn.indexOf('disturbance') !== -1) && f.value !== undefined && f.value > 0) {
        this._activeConditions.push('extreme_weather');
        signals.push('ALERT: ' + (f.value || 'Active') + ' environmental alerts detected');
      }

      // Air quality / pollution indicators
      if ((fn.indexOf('air') !== -1 || fn.indexOf('pollution') !== -1 || fn.indexOf('emission') !== -1) && f.value !== undefined && f.value > 100) {
        this._activeConditions.push('air_quality_degradation');
        this._activeConditions.push('industrial_discharge');
        signals.push('ELEVATED: Air quality index above safe threshold');
      }

      // Water quality indicators
      if ((fn.indexOf('water') !== -1 || fn.indexOf('contamina') !== -1) && f.value !== undefined && f.value > 0.5) {
        this._activeConditions.push('water_contamination');
        signals.push('ELEVATED: Water contamination detected');
      }

      // ── INSTITUTIONAL FEED-DERIVED CONDITIONS (USGS / Federal Register) ──
      // Distinct collection methodologies — geo data API + regulatory doc-counts.

      // USGS Earthquakes — major seismic events → CLIMATE_TIPPING_POINT proxy via ecosystem disruption
      if (fn.indexOf('usgs earthquakes') !== -1 && f.value !== undefined && f.value >= 5) {
        this._activeConditions.push('ecosystem_disruption');
        signals.push('USGS: ' + f.value + ' M4.5+ earthquakes 24h — ecosystem disruption');
      }
      if (fn.indexOf('usgs earthquakes') !== -1 && f.value !== undefined && f.value >= 10) {
        this._activeConditions.push('ocean_chemistry');
      }

      // Fed Reg EPA — EPA regulatory volume → TOXIC_CONTAMINATION
      if (fn.indexOf('fed reg epa') !== -1 && f.value !== undefined && f.value >= 5) {
        this._activeConditions.push('industrial_discharge');
        signals.push('Fed Reg EPA: ' + f.value + ' EPA regulatory docs (30d)');
      }
      if (fn.indexOf('fed reg epa') !== -1 && f.value !== undefined && f.value >= 10) {
        this._activeConditions.push('air_quality_degradation');
        this._activeConditions.push('water_contamination');
      }
      if (fn.indexOf('fed reg epa') !== -1 && f.value !== undefined && f.value >= 15) {
        this._activeConditions.push('environment_high_stress');
      }

      // Fed Reg Interior — DOI regulatory → DEFORESTATION / MASS_EXTINCTION
      if (fn.indexOf('fed reg interior') !== -1 && f.value !== undefined && f.value >= 3) {
        this._activeConditions.push('land_use_conflict');
        signals.push('Fed Reg Interior: ' + f.value + ' DOI regulatory docs (30d)');
      }
      if (fn.indexOf('fed reg interior') !== -1 && f.value !== undefined && f.value >= 6) {
        this._activeConditions.push('habitat_fragmentation');
        this._activeConditions.push('habitat_loss');
      }
      if (fn.indexOf('fed reg interior') !== -1 && f.value !== undefined && f.value >= 10) {
        this._activeConditions.push('species_decline');
      }

      // Global Forest Watch + IUCN — explicit name rules to fire DEFORESTATION + MASS_EXTINCTION
      // (These RSS feeds have specific subject focus that warrants explicit mapping.)
      if (fn.indexOf('global forest watch') !== -1 && f.value !== undefined && f.value >= 20) {
        this._activeConditions.push('forest_loss');
        this._activeConditions.push('carbon_sink_decline');
        signals.push('Global Forest Watch: ' + f.value + ' deforestation articles');
      }
      if (fn.indexOf('global forest watch') !== -1 && f.value !== undefined && f.value >= 50) {
        this._activeConditions.push('soil_degradation');
      }
      if (fn.indexOf('iucn') !== -1 && f.value !== undefined && f.value >= 20) {
        this._activeConditions.push('species_decline');
        this._activeConditions.push('biodiversity_collapse');
        signals.push('IUCN: ' + f.value + ' biodiversity articles');
      }
      if (fn.indexOf('iucn') !== -1 && f.value !== undefined && f.value >= 50) {
        this._activeConditions.push('food_chain_imbalance');
      }
    }

    // Raw signal keyword analysis
    for (var rsi = 0; rsi < rawSignals.length; rsi++) {
      var rs = (typeof rawSignals[rsi] === 'string' ? rawSignals[rsi] : '').toLowerCase();
      if (rs.indexOf('deforest') !== -1 || rs.indexOf('forest loss') !== -1) {
        if (this._activeConditions.indexOf('forest_loss') === -1) this._activeConditions.push('forest_loss');
        if (this._activeConditions.indexOf('carbon_sink_decline') === -1) this._activeConditions.push('carbon_sink_decline');
      }
      if (rs.indexOf('species') !== -1 || rs.indexOf('extinct') !== -1 || rs.indexOf('biodiversity') !== -1) {
        if (this._activeConditions.indexOf('species_decline') === -1) this._activeConditions.push('species_decline');
        if (this._activeConditions.indexOf('biodiversity_collapse') === -1) this._activeConditions.push('biodiversity_collapse');
      }
      if (rs.indexOf('ocean') !== -1 || rs.indexOf('coral') !== -1 || rs.indexOf('marine') !== -1) {
        if (this._activeConditions.indexOf('marine_ph_decline') === -1) this._activeConditions.push('marine_ph_decline');
      }
      if (rs.indexOf('spill') !== -1 || rs.indexOf('toxic') !== -1 || rs.indexOf('contamin') !== -1) {
        if (this._activeConditions.indexOf('toxic_spill') === -1) this._activeConditions.push('toxic_spill');
        if (this._activeConditions.indexOf('waste_accumulation') === -1) this._activeConditions.push('waste_accumulation');
      }
      if (rs.indexOf('flood') !== -1 || rs.indexOf('hurricane') !== -1 || rs.indexOf('wildfire') !== -1 || rs.indexOf('drought') !== -1) {
        if (this._activeConditions.indexOf('extreme_weather') === -1) this._activeConditions.push('extreme_weather');
        if (this._activeConditions.indexOf('climate_volatility') === -1) this._activeConditions.push('climate_volatility');
      }
    }

    // Use NOAA disturbance signals from enriched snapshot
    if (this._rawDomain) {
      if (this._rawDomain.disturbanceIntensity > 0.3) {
        this._activeConditions.push('extreme_weather');
        signals.push('NOAA: Disturbance intensity ' + Math.round(this._rawDomain.disturbanceIntensity * 100) + '%');
      }
      if (this._rawDomain.activeAlerts > 5) {
        this._activeConditions.push('climate_volatility');
        signals.push('NOAA: ' + this._rawDomain.activeAlerts + ' active environmental alerts');
      }
    }

    // Defense/geopolitical signals affecting environment
    var snap = this._getSnapshot();
    if (snap && snap.defenseSignals) {
      for (var si = 0; si < snap.defenseSignals.length; si++) {
        var sig = snap.defenseSignals[si];
        if (sig.affectedDomains && sig.affectedDomains.indexOf('environment') !== -1) {
          this._activeConditions.push(sig.eventType);
          if (sig.eventType === 'REFINERY_ATTACK' || sig.eventType === 'OIL_SHOCK') {
            this._activeConditions.push('toxic_spill');
            this._activeConditions.push('industrial_discharge');
          }
        }
      }
    }

    if (snap && snap.macroShock && snap.macroShock.detected) {
      this._activeConditions.push('macro_shock');
    }

    // Cross-domain pressure
    if (window.LIMENDomainBrains) {
      var allBrains = window.LIMENDomainBrains.getAll();
      for (var bk in allBrains) {
        if (bk === 'environment') continue;
        var b = allBrains[bk]; if (!b || !b.state) continue;
        var bEm = b.state.crossDomainEmissions || [];
        for (var bei = 0; bei < bEm.length; bei++) {
          var be = bEm[bei];
          if (be.targetDomain === 'environment' && be.magnitude > 0.1) {
            signals.push('FEED [' + bk.toUpperCase() + ']: ' + (be.signal || '').replace(/_/g, ' ') + ' — ' + Math.round(be.magnitude * 100) + '%');
          }
        }
      }
    }

    // Stress-derived conditions — tiered activation
    if (this.state.stress >= 0.35) {
      this._activeConditions.push('ecosystem_disruption');
      this._activeConditions.push('habitat_loss');
    }
    if (this.state.stress >= 0.50) {
      this._activeConditions.push('soil_degradation');
      this._activeConditions.push('habitat_fragmentation');
    }
    if (this.state.stress >= 0.60) {
      this._activeConditions.push('environment_high_stress');
      this._activeConditions.push('food_chain_imbalance');
    }
    if (this.state.stress >= 0.70) {
      this._activeConditions.push('sea_level');
      this._activeConditions.push('land_use_conflict');
    }
    if (this.state.maturity === 'STRUCTURAL') this._activeConditions.push('structural_stress');

    var extPressure = this.getExternalPressure ? this.getExternalPressure() : 0;
    if (extPressure >= 0.10) {
      this._activeConditions.push('industrial_discharge');
    }
    if (extPressure >= 0.20) {
      this._activeConditions.push('waste_accumulation');
    }

    this.state.signals = signals;
    return Promise.resolve();
  };

  // ══════════════════════════════════════════════════════════════════════
  // STEP 4: Derive diagnoses — condition-matched from portal
  // ══════════════════════════════════════════════════════════════════════

  EnvironmentBrain.prototype.deriveDiagnoses = function () {
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

        return {
          id: iss.id,
          label: iss.label,
          summary: iss.summary || '',
          active: matchCount > 0,
          relevance: Math.round((triggers.length > 0 ? matchCount / triggers.length : 0) * 100) / 100,
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

  EnvironmentBrain.prototype.recommendTreatments = function () {
    var self = this;
    return this._getPortalContent().then(function (portal) {
      if (!portal) return;

      var activeDx = self.state.diagnoses.filter(function (d) { return d.active; });
      if (activeDx.length === 0) { self.state.treatments = []; return; }

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
        if (!activeNodeIds[act.brainNodeId]) continue;
        var actTreats = act.treatments || [];
        for (var ti = 0; ti < actTreats.length; ti++) {
          var t = actTreats[ti];
          treatments.push({
            id: 'treat_' + act.brainNodeId + '_' + ti,
            label: t.label,
            type: t.type,
            evidence: t.evidence,
            description: t.description || '',
            diagnosisId: activeNodeIds[act.brainNodeId],
            nodeId: act.brainNodeId,
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

  EnvironmentBrain.prototype.surfaceOpportunities = function () {
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

      add({
        title: dxLabel + ' — environmental monitoring and early warning systems',
        rank: stress * dx.relevance,
        path: 'PATENTABLE',
        urgency: stress > 0.70 ? 'high' : 'medium',
        source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
      });

      if (stress >= 0.50) {
        add({
          title: dxLabel + ' — remediation and restoration infrastructure',
          rank: stress * dx.relevance * 0.9,
          path: 'GRANT-ELIGIBLE',
          urgency: stress > 0.70 ? 'high' : 'medium',
          source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
        });
      }

      if (stress >= 0.55 && dx.relevance >= 0.2) {
        add({
          title: dxLabel + ' — climate adaptation and resilience engineering',
          rank: stress * 0.85,
          path: 'INVESTABLE',
          urgency: 'medium',
          source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
        });
      }

      add({
        title: dxLabel + ' — conservation technology and biodiversity protection',
        rank: stress * dx.relevance * 0.75,
        path: 'GRANT-ELIGIBLE',
        urgency: 'medium',
        source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
      });
    }

    // Terminal companies
    var terminalCompanies = [] /* neutralized: distress only from validated gate (see energy-brain) */;
    if (terminalCompanies.length > 0) {
      add({
        title: 'Environment terminal entity distressed positioning',
        rank: 0.95,
        path: 'INVESTABLE',
        urgency: 'high',
        source: 'company_terminal', tier: 1,
        companies: terminalCompanies.map(function (c) { return c.ticker; }),
        stress: stress
      });
    }

    var stressedCompanies = [] /* neutralized: distress only from validated gate */;
    if (stressedCompanies.length >= 2 && stress >= 0.50) {
      add({
        title: 'Environment stressed-but-operating entity selection',
        rank: stress * 0.80,
        path: 'INVESTABLE',
        urgency: 'medium',
        source: 'company_stressed', tier: 1,
        companies: stressedCompanies.slice(0, 5).map(function (c) { return c.ticker; }),
        stress: stress
      });
    }

    if (this.state.convergence && this.state.convergence.primary_signal) {
      add({
        title: this.state.convergence.primary_signal.replace(/_/g, ' ').toLowerCase() + ' — environment convergence response',
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
        title: 'Environment \u2192 ' + targetLabel + ' transmission — ' + sigLabel + ' response',
        rank: (em.magnitude || 0.5) * stress * 0.8,
        path: 'INVESTABLE',
        urgency: em.magnitude > 0.6 ? 'high' : 'medium',
        source: 'cross_domain', tier: 2,
        diagnosisId: 'environment_emission_' + em.targetDomain,
        stress: stress
      });
    }

    // ═══ TIER 3 — LAGGING / SYSTEM RESPONSE ═══
    if (stress >= 0.50) {
      add({
        title: 'Water resource management and purification systems',
        rank: stress * 0.70,
        path: 'INVESTABLE',
        urgency: 'medium',
        source: 'lagging', tier: 3,
        diagnosisId: 'water_management', stress: stress
      });

      add({
        title: 'Environmental regulatory compliance and monitoring expansion',
        rank: stress * 0.65,
        path: 'GRANT-ELIGIBLE',
        urgency: stress > 0.70 ? 'medium' : 'watching',
        source: 'lagging', tier: 3,
        diagnosisId: 'regulatory_compliance', stress: stress
      });
    }

    if (stress >= 0.60) {
      add({
        title: 'Pollution mitigation and remediation infrastructure',
        rank: stress * 0.75,
        path: 'INVESTABLE',
        urgency: stress > 0.70 ? 'high' : 'medium',
        source: 'lagging', tier: 3,
        diagnosisId: 'pollution_mitigation', stress: stress
      });

      add({
        title: 'Biodiversity restoration and habitat rehabilitation',
        rank: stress * 0.72,
        path: 'GRANT-ELIGIBLE',
        urgency: 'medium',
        source: 'lagging', tier: 3,
        diagnosisId: 'biodiversity_restoration', stress: stress
      });

      add({
        title: 'Carbon capture and atmospheric intervention technology',
        rank: stress * 0.68,
        path: 'PATENTABLE',
        urgency: 'medium',
        source: 'lagging', tier: 3,
        diagnosisId: 'carbon_capture', stress: stress
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
    // Canonical enrichment — merge environment playbook detail per opportunity
    var PB_LIST = window.LIMENEnvironmentOpportunityPlaybooks || [];
    var _byId = {};
    for (var _pbi = 0; _pbi < PB_LIST.length; _pbi++) _byId[PB_LIST[_pbi].id] = PB_LIST[_pbi];
    var _PB_MAP = {
      'CLIMATE_TIPPING_POINT': 'climate_tipping_point',
      'MASS_EXTINCTION': 'mass_extinction',
      'OCEAN_ACIDIFICATION': 'ocean_acidification',
      'DEFORESTATION': 'deforestation',
      'TOXIC_CONTAMINATION': 'toxic_contamination'
    };
    var _LAGGING_MAP = {
      'biodiversity_restoration': 'mass_extinction',
      'carbon_capture': 'deforestation',
      'pollution_mitigation': 'toxic_contamination',
      'regulatory_compliance': 'toxic_contamination',
      'water_management': 'toxic_contamination'
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
      o.domain = 'environment';
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
        var evidenceParts = ['Domain: environment', 'Stress: ' + stressPct + '%'];
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

  EnvironmentBrain.prototype._checkDiagnosisActions = function () {
    var activeDx = this.state.diagnoses.filter(function (d) { return d.active; });
    if (activeDx.length === 0) return;

    var adapters = window.LIMENActionAdapters;
    if (!adapters) return;

    for (var i = 0; i < activeDx.length; i++) {
      var dx = activeDx[i];
      var existingDrafts = adapters.getDrafts({ domain: 'environment', intentId: dx.id });
      if (existingDrafts && existingDrafts.length > 0) continue;

      adapters.createDraft('REPORT_GENERATION', {
        domain: 'environment',
        sourceType: 'domain_brain',
        sourceId: dx.id,
        intentId: dx.id,
        title: 'Environment Alert: ' + dx.label,
        intent: {
          domain: 'environment',
          title: dx.label,
          status: 'ACTIVE',
          priority: this.state.stress,
          progress: 0,
          strategyType: 'diagnosis_response',
          steps: [
            { type: 'ANALYZE', label: 'Assess ' + dx.label + ' impact on environmental systems', status: 'PENDING' },
            { type: 'INVESTIGATE', label: 'Identify affected ecosystems, resources, and communities', status: 'PENDING' },
            { type: 'POSITION', label: 'Evaluate remediation and adaptation opportunities from ' + dx.label, status: 'PENDING' }
          ]
        }
      });
    }
  };

  EnvironmentBrain.prototype.resolveDeepContent = function () {
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

  var _origCycle = EnvironmentBrain.prototype.cycle;
  EnvironmentBrain.prototype.cycle = function () {
    var self = this;
    return _origCycle.call(this).then(function () {
      return self.resolveDeepContent();
    });
  };

  // ══════════════════════════════════════════════════════════════════════
  // INSTANTIATE AND REGISTER
  // ══════════════════════════════════════════════════════════════════════

  var brain = new EnvironmentBrain();
  brain.init();
  brain.start();

  window.LIMENEnvironmentBrain = brain;
  window.LIMENDomainBrains.register(brain);

  // ══════════════════════════════════════════════════════════════════════
  // AUTO-LOAD ENVIRONMENT OPERATOR STACK ON DOMAIN-CONSOLE
  // ══════════════════════════════════════════════════════════════════════

  var _isDomainConsole = window.location.pathname.indexOf('domain-console') !== -1;
  var _domParam = (new URLSearchParams(window.location.search)).get('domain');
  var _isEnvironmentDomain = _domParam === 'environment';
  if (_isDomainConsole && _isEnvironmentDomain) {
    window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION = true;

    var _environmentScripts = [
      'assets/js/environment-compensation.js',
      'assets/js/environment-claim-ledger.js',
      'assets/js/environment-claim-flow.js',
      'assets/js/environment-opportunity-economics.js',
      'assets/js/environment-pulse-engine.js',
      'assets/js/environment-operator-panel.js',
      'assets/js/environment-node-business-engine.js',
      'assets/js/environment-business-review.js',
      'assets/js/environment-execution-panels.js',
      'assets/js/environment-business-build.js',
      'assets/js/environment-directive-extractor.js',
      'assets/js/environment-directive-ranker.js',
      'assets/js/environment-directive-translator.js',
      'assets/js/environment-targeting-engine.js',
      'assets/js/environment-promotion-bridge.js',
      'assets/js/environment-clarity-operator.js'
    ];
    (function loadNext(i) {
      if (i >= _environmentScripts.length) return;
      var s = document.createElement('script');
      s.src = _environmentScripts[i];
      s.onload = function () { loadNext(i + 1); };
      s.onerror = function () { console.warn('[EnvironmentBrain] Failed to load ' + _environmentScripts[i]); loadNext(i + 1); };
      document.head.appendChild(s);
    })(0);
  }

})();
