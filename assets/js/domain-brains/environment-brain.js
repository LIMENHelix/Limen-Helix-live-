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
        path: 'RESEARCHABLE',
        urgency: stress > 0.70 ? 'high' : 'medium',
        source: 'diagnosis', diagnosisId: dx.id, tier: 1, stress: stress
      });

      if (stress >= 0.50) {
        add({
          title: dxLabel + ' — remediation and restoration infrastructure',
          rank: stress * dx.relevance * 0.9,
          path: 'INVESTABLE',
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
        path: 'INVESTABLE',
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
        path: 'INVESTABLE',
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
        path: 'INVESTABLE',
        urgency: 'medium',
        source: 'lagging', tier: 3,
        diagnosisId: 'biodiversity_restoration', stress: stress
      });

      add({
        title: 'Carbon capture and atmospheric intervention technology',
        rank: stress * 0.68,
        path: 'RESEARCHABLE',
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
          path: 'RESEARCHABLE',
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
      'INVESTABLE':   { type: 'invest',   base: 5,  unit: 'profit%', tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 profitable positions closed' }, maxTier: { tier: 3, comp: 15 } },
      'RESEARCHABLE': { type: 'research', base: 5,  unit: 'cite%',   tier: 1, nextTier: { tier: 2, comp: 10, requirement: '3 research briefs published' },   maxTier: { tier: 3, comp: 15 } }
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
        else if (o.path === 'RESEARCHABLE' && pb.realWorld && (pb.realWorld.research || pb.realWorld.build)) target = pb.realWorld.research || pb.realWorld.build;
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

  // ════════════════════════════════════════════════════════════════════════════
  // COGNITIVE SUBSTRATE — ENVIRONMENT RECURRENT LOOP v1 (additive, reversible)
  // Mirrors energy-brain lines 1156–1302 / infrastructure-brain port. Content =
  // climate/pollution/ecosystems; structure identical. Proof surface:
  //   window.LIMENEnvironmentBrain.state.environmentModel  /  .state.cognition
  // ════════════════════════════════════════════════════════════════════════════
  var ENV_EM_VERSION = 1;
  var ENV_LEARNING_RATE = 0.25;
  var ENV_SLOW_RATE = 0.08;
  var ENV_STRESS_FLOOR = 0.30;
  var ENV_FLOOD_CAP = 8;                 // env opportunity-flood threshold (>8 concurrent diagnoses)
  var ENV_STALE_MS = 1000 * 60 * 30;     // 30m feed staleness (climate feeds expected fresher)

  function _envClamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function _envJaccardDistance(a, b) {
    a = a || []; b = b || [];
    if (a.length === 0 && b.length === 0) return 0;
    var union = {}, inter = 0, setB = {};
    for (var i = 0; i < b.length; i++) { setB[b[i]] = true; union[b[i]] = true; }
    var seen = {};
    for (var j = 0; j < a.length; j++) { union[a[j]] = true; if (setB[a[j]] && !seen[a[j]]) { inter++; seen[a[j]] = true; } }
    var u = Object.keys(union).length;
    return u === 0 ? 0 : 1 - (inter / u);
  }

  EnvironmentBrain.prototype._neutralEnvironmentModel = function () {
    return {
      version: ENV_EM_VERSION, cycle: 0,
      prior: { expectedStress: 0.5, expectedDiagnoses: [], expectedDiagnosisCount: 0, expectedOpportunityCount: 0, expectedSignal: 0.5, confidence: 0, samples: 0 },
      observation: null, predictionError: null, predictedStress: null,
      plasticity: { learningRate: ENV_LEARNING_RATE, slowRate: ENV_SLOW_RATE, consolidation: 'cycle-light/rebuild-heavy' },
      regulation: null, readyForHandoff: false, _lowErrorStreak: 0
    };
  };

  // Observation — aggregate climate / pollution / ecosystem feeds into stress + timestamp.
  // state.feeds is an ARRAY of { name, value, updated } here (not an object).
  EnvironmentBrain.prototype._buildObservation = function () {
    var s = this.state || {};
    var active = (s.diagnoses || []).filter(function (d) { return d.active; });
    var feeds = Array.isArray(s.feeds) ? s.feeds : [];
    var feedCount = 0, newest = 0;
    for (var k = 0; k < feeds.length; k++) {
      feedCount++;
      var u = feeds[k] && feeds[k].updated;
      if (u && u > newest) newest = u;
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

  EnvironmentBrain.prototype._computePredictionError = function (prior, obs) {
    var stressError = Math.abs(obs.stress - prior.expectedStress);
    var signalError = Math.abs(obs.signal - prior.expectedSignal);
    var diagnosisError = _envJaccardDistance(obs.activeDiagnoses, prior.expectedDiagnoses);
    var oppDenom = Math.max(1, prior.expectedOpportunityCount, obs.opportunityCount);
    var opportunityError = Math.abs(obs.opportunityCount - prior.expectedOpportunityCount) / oppDenom;
    var portalError = 0;
    var total = _envClamp(0.4 * stressError + 0.2 * signalError + 0.25 * diagnosisError + 0.15 * opportunityError, 0, 1);
    var novelty = Math.max(stressError, diagnosisError);
    return { total: total, stressError: stressError, signalError: signalError, diagnosisError: diagnosisError, opportunityError: opportunityError, portalError: portalError, novelty: novelty };
  };

  EnvironmentBrain.prototype._updatePrior = function (prior, obs, lr) {
    return {
      expectedStress: _envClamp(prior.expectedStress + lr * (obs.stress - prior.expectedStress), 0, 1),
      expectedDiagnoses: obs.activeDiagnoses.slice(),
      expectedDiagnosisCount: prior.expectedDiagnosisCount + lr * (obs.diagnosisCount - prior.expectedDiagnosisCount),
      expectedOpportunityCount: prior.expectedOpportunityCount + lr * (obs.opportunityCount - prior.expectedOpportunityCount),
      expectedSignal: _envClamp(prior.expectedSignal + lr * (obs.signal - prior.expectedSignal), 0, 1),
      confidence: _envClamp(Math.min(1, (prior.samples + 1) / 20), 0, 1),
      samples: prior.samples + 1
    };
  };

  // Regulation — opportunity flooding (>8 concurrent diagnoses), feed staleness (>30m), plasticity.
  EnvironmentBrain.prototype._computeRegulation = function (em, obs, pe) {
    var gain = _envClamp(pe.novelty, 0.05, 0.95);
    var inhibition = _envClamp(1 - pe.novelty, 0, 0.9);
    var outputScale = _envClamp(1 - inhibition * 0.5, 0.4, 1);
    var starving = obs.stress >= ENV_STRESS_FLOOR && obs.opportunityCount === 0;
    var flooding = obs.diagnosisCount > ENV_FLOOD_CAP || obs.opportunityCount > (ENV_FLOOD_CAP + 6);
    var streak = (pe.total < 0.05) ? (em._lowErrorStreak || 0) + 1 : 0;
    em._lowErrorStreak = streak;
    var looping = streak >= 3;
    var stale = obs.feedNewest > 0 ? (Date.now() - obs.feedNewest) > ENV_STALE_MS : false;
    var overconfident = em.prior.confidence > 0.8 && pe.total > 0.4;
    var label = flooding ? 'flooding' : starving ? 'starving' : stale ? 'stale' : looping ? 'looping' : overconfident ? 'overconfident' : pe.novelty > 0.4 ? 'surprised' : 'calm';
    return { gain: gain, inhibition: inhibition, outputScale: outputScale, starving: starving, flooding: flooding, looping: looping, stale: stale, overconfident: overconfident, state: label };
  };

  // The recurrent step — END of each cycle. Reads the prior from the PREVIOUS cycle.
  EnvironmentBrain.prototype._updateEnvironmentModel = function () {
    var em = this.state.environmentModel || this._neutralEnvironmentModel();
    var priorIn = em.prior;
    var obs = this._buildObservation();
    var pe = this._computePredictionError(priorIn, obs);

    var gainBlend = _envClamp(pe.novelty, 0.05, 0.95);
    var predictedStress = priorIn.expectedStress * (1 - gainBlend) + obs.stress * gainBlend;
    var reg = this._computeRegulation(em, obs, pe);

    var readyForHandoff = (em.cycle > 0) && (predictedStress >= ENV_STRESS_FLOOR) && (obs.diagnosisCount > 0) && !reg.flooding && !reg.stale;
    var nextPrior = this._updatePrior(priorIn, obs, em.plasticity.learningRate);

    em.cycle += 1;
    em.observation = obs;
    em.predictionError = pe;
    em.predictedStress = predictedStress;
    em.regulation = reg;
    em.readyForHandoff = readyForHandoff;
    em.prior = nextPrior;
    em.updated = obs.timestamp;
    this.state.environmentModel = em;

    // brainEnvironmentModel — the recurrent CLIMATE/EMISSIONS/ECOSYSTEM LIFECYCLE model the
    // Civilization cockpit + Main Brain (via domain-packet-adapter's environment branch) read.
    // Tracks climateRegulationState / pollutionAccumulation / ecosystemResilience / emissionCycle
    // (climateCycle) / remediationLag. DISTINCT from energy power-generation lifecycle (couples via
    // emissions/carbon). Field names mirror the adapter's `_ben` envelope contract exactly.
    try { this._buildEnvironmentLifecycleModel(obs); } catch (e) {}

    // Higher environment layers (immune/awareness/conscience/intuition/simulation/exec)
    try { this._computeEnvironmentHigherLayers(); } catch (e) {}

    // Climate-risk sub-layer (additive; BEFORE the DDP build) — never touches the 5-dx spine.
    try { this._buildClimateRiskLayer(); } catch (e) {}

    // DomainDiagnosisPacket (schema) for primary + one per diagnosis.
    try {
      var _diags = this.state.diagnoses || [];
      var _primary = _diags.filter(function (d) { return d.active; })[0] || _diags[0] || null;
      var _self = this;
      em.domainDiagnosisPacket = this._buildDomainDiagnosisPacket(_primary);
      this.state.environmentDomainDiagnosisPackets = _diags.map(function (d) { return _self._buildDomainDiagnosisPacket(d); });
    } catch (e) {}

    // outcomeLog
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
  // brainEnvironmentModel — recurrent CLIMATE/EMISSIONS/ECOSYSTEM LIFECYCLE model.
  // Emits the EXACT field names the domain-packet-adapter environment branch (`_ben`) maps onto
  // the shared deepBrain envelope: climateCycle, climateRegulationState (regulation signal),
  // ecosystemCollapseRisk / predictedClimateStress, priorEnvironmentalHealth, and the lifecycle
  // telemetry trends (atmosphericCarbonTrend / pollutionStockTrend / remediationLagTrend /
  // biodiversityTrend / ecosystemServiceTrend / carbonMarketTrend / regulatoryTighteningTrend) +
  // domainEnvironmentPacket. Plain-language lifecycle fields (climateRegulationState /
  // pollutionAccumulation / ecosystemResilience / emissionCycle / remediationLag) sit alongside.
  // EPA/IPCC/IUCN-anchored; interpretive (the validated P3 scorer is the only certified path).
  // DISTINCT from energy's power-generation lifecycle (environment couples via emissions/carbon).
  // ════════════════════════════════════════════════════════════════════════════
  EnvironmentBrain.prototype._buildEnvironmentLifecycleModel = function (obs) {
    var s = this.state || {};
    var em = s.environmentModel || {};
    obs = obs || em.observation || {};
    var stress = typeof s.stress === 'number' ? s.stress : 0;
    var active = (s.diagnoses || []).filter(function (d) { return d.active; });
    var activeIds = active.map(function (d) { return d.id; });
    var conds = s._activeConditions || [];
    function hasCond(c) { return conds.indexOf(c) !== -1; }

    // emissionCycle / climateCycle — macro phase of the emissions trajectory (IPCC framing).
    //   pre-industrial-baseline → accelerating → peaking → declining.
    var climateAcute = activeIds.indexOf('CLIMATE_TIPPING_POINT') !== -1 || hasCond('temperature_anomaly');
    var extremes = hasCond('extreme_weather') || hasCond('sea_level');
    var emissionCycle = extremes ? 'peaking'
      : climateAcute ? 'accelerating'
      : (stress >= 0.5 ? 'accelerating' : 'pre-industrial-baseline');

    // climateRegulationState — emissions caps / discharge permits / remediation mandates stance.
    //   Read from EPA regulatory volume (Federal Register) + stress posture: loose/balanced/strict.
    var epaPressure = hasCond('environment_high_stress') || hasCond('industrial_discharge');
    var climateRegulationStateStr = epaPressure ? 'strict' : (stress >= 0.45 ? 'balanced' : 'loose');

    // pollutionAccumulation — air/water/soil contamination stock trajectory: rising/stable/declining.
    var pollutionActive = activeIds.indexOf('TOXIC_CONTAMINATION') !== -1 || hasCond('air_quality_degradation') || hasCond('water_contamination') || hasCond('waste_accumulation');
    var pollutionAccumulation = pollutionActive ? 'rising' : (stress >= 0.5 ? 'stable' : 'declining');

    // ecosystemResilience — biodiversity / species-loss trajectory / habitat regeneration capacity.
    var biodiversityActive = activeIds.indexOf('MASS_EXTINCTION') !== -1 || activeIds.indexOf('DEFORESTATION') !== -1 || hasCond('biodiversity_collapse') || hasCond('habitat_loss');
    var ecosystemResilience = biodiversityActive ? (stress >= 0.6 ? 'collapsing' : 'degraded') : (stress >= 0.6 ? 'degraded' : (stress >= 0.4 ? 'stable' : 'resilient'));

    // remediationLag — cleanup backlog / Superfund queue depth proxy (0..1).
    var remediationLag = _envClamp(stress * 0.6 + (pollutionActive ? 0.3 : 0) + (hasCond('toxic_spill') ? 0.1 : 0), 0, 1);

    // ecosystemCollapseRisk — environment predicted-stress signal (adapter's predictedStress source).
    var ecosystemCollapseRisk = _envClamp(
      (typeof em.predictedStress === 'number' ? em.predictedStress : stress) * 0.7 +
      (biodiversityActive ? 0.2 : 0) + (extremes ? 0.1 : 0), 0, 1);

    // Lifecycle telemetry trends (0..1; rough interpretive reads, never fabricated precision).
    var atmosphericCarbonTrend     = _envClamp((emissionCycle === 'peaking' ? 0.85 : emissionCycle === 'accelerating' ? 0.6 : emissionCycle === 'declining' ? 0.35 : 0.5), 0, 1);
    var pollutionStockTrend        = _envClamp(pollutionActive ? 0.7 : (stress >= 0.5 ? 0.5 : 0.3), 0, 1);
    var remediationLagTrend        = Math.round(remediationLag * 1000) / 1000;
    var biodiversityTrend          = _envClamp(biodiversityActive ? 0.7 : (stress >= 0.5 ? 0.5 : 0.3), 0, 1);
    var ecosystemServiceTrend      = _envClamp(1 - ecosystemCollapseRisk, 0, 1); // higher = healthier services
    var carbonMarketTrend          = _envClamp((climateRegulationStateStr === 'strict' ? 0.7 : climateRegulationStateStr === 'balanced' ? 0.5 : 0.35) + (climateAcute ? 0.1 : 0), 0, 1);
    var regulatoryTighteningTrend  = _envClamp(climateRegulationStateStr === 'strict' ? 0.8 : climateRegulationStateStr === 'balanced' ? 0.5 : 0.3, 0, 1);

    // priorEnvironmentalHealth — recurrent prior on ecosystem/environmental health (adapter reads this).
    var priorHealth = (s.brainEnvironmentModel && s.brainEnvironmentModel.priorEnvironmentalHealth) || { expectedStress: 0.5, confidence: 0, samples: 0 };
    var healthObs = ecosystemCollapseRisk;
    var nextPriorHealth = {
      expectedStress: _envClamp(priorHealth.expectedStress + ENV_LEARNING_RATE * (healthObs - priorHealth.expectedStress), 0, 1),
      confidence: _envClamp(Math.min(1, (priorHealth.samples + 1) / 20), 0, 1),
      samples: priorHealth.samples + 1
    };

    this.state.brainEnvironmentModel = {
      version: ENV_EM_VERSION,
      // ── adapter-envelope contract fields (`_ben` in domain-packet-adapter) ──
      climateCycle: em.cycle || 0,                                   // → deepBrain.cycle
      predictionError: em.predictionError || null,
      climateRegulationState: climateRegulationStateStr,            // → deepBrain.regulationState (loose/balanced/strict)
      readyForHandoff: em.readyForHandoff === true,
      ecosystemCollapseRisk: Math.round(ecosystemCollapseRisk * 1000) / 1000, // → deepBrain.predictedStress
      predictedClimateStress: Math.round(ecosystemCollapseRisk * 1000) / 1000,
      priorEnvironmentalHealth: nextPriorHealth,                    // → deepBrain.prior
      atmosphericCarbonTrend: atmosphericCarbonTrend,
      pollutionStockTrend: pollutionStockTrend,
      remediationLagTrend: remediationLagTrend,
      biodiversityTrend: biodiversityTrend,
      ecosystemServiceTrend: ecosystemServiceTrend,
      carbonMarketTrend: carbonMarketTrend,
      regulatoryTighteningTrend: regulatoryTighteningTrend,
      domainEnvironmentPacket: em.domainDiagnosisPacket || null,    // → deepBrain.domainDiagnosisPacket
      // ── plain-language lifecycle fields (gap spec) ──
      emissionCycle: emissionCycle,                                // pre-industrial-baseline / accelerating / peaking / declining
      pollutionAccumulation: pollutionAccumulation,                // rising / stable / declining
      ecosystemResilience: ecosystemResilience,                    // resilient / stable / degraded / collapsing
      remediationLag: Math.round(remediationLag * 1000) / 1000,
      // ── provenance ──
      sectorTickers: ['WM', 'RSG', 'WCN', 'CWST', 'AWK', 'WTRG', 'XYL', 'ECL', 'LIN', 'APD', 'DAR', 'AY'],
      anchorSources: { climate: 'NOAA/NASA GISTEMP temperature anomaly', emissions: 'EPA GHG Inventory + IPCC scenario pathways', pollution: 'EPA AQI / TRI', biodiversity: 'IUCN Red List', regulation: 'Federal Register EPA/Interior', carbonMarket: 'compliance + voluntary carbon pricing' },
      note: 'climate/emissions/ecosystem lifecycle model (emission-cycle phase, pollution stock, ecosystem resilience, regulation stance, remediation backlog); EPA/IPCC/IUCN-anchored; DISTINCT from energy power-generation lifecycle (couples via emissions/carbon); interpretive (the validated P3 scorer is the only certified path)',
      updated: em.updated || Date.now()
    };

    // Mirror the adapter-contract LIFECYCLE fields onto state.environmentModel itself. The
    // domain-brain-adapter carries state.environmentModel → slot.brainEnvironmentModel, which the
    // Civilization domain-packet-adapter `_ben` branch maps onto the shared deepBrain envelope.
    // Without this, `_ben` only sees the recurrent-loop fields (cycle/regulation/predictedStress/
    // prior/domainDiagnosisPacket via fallbacks) and the climate-lifecycle fields read null. We
    // attach them additively so climateCycle / climateRegulationState / ecosystemCollapseRisk /
    // priorEnvironmentalHealth / domainEnvironmentPacket + the lifecycle trends all populate. This
    // NEVER alters the recurrent loop's own fields (prior/predictionError/regulation/predictedStress).
    if (em && typeof em === 'object') {
      var bm = this.state.brainEnvironmentModel;
      em.climateCycle = bm.climateCycle;
      em.climateRegulationState = bm.climateRegulationState;
      em.ecosystemCollapseRisk = bm.ecosystemCollapseRisk;
      em.predictedClimateStress = bm.predictedClimateStress;
      em.priorEnvironmentalHealth = bm.priorEnvironmentalHealth;
      em.atmosphericCarbonTrend = bm.atmosphericCarbonTrend;
      em.pollutionStockTrend = bm.pollutionStockTrend;
      em.remediationLagTrend = bm.remediationLagTrend;
      em.biodiversityTrend = bm.biodiversityTrend;
      em.ecosystemServiceTrend = bm.ecosystemServiceTrend;
      em.carbonMarketTrend = bm.carbonMarketTrend;
      em.regulatoryTighteningTrend = bm.regulatoryTighteningTrend;
      // domainEnvironmentPacket intentionally NOT mirrored: the recurrent model's own
      // em.domainDiagnosisPacket is rebuilt later THIS cycle (fresh), and the adapter falls
      // back to it — mirroring would serve last cycle's stale packet ahead of the fresh one.
      em.emissionCycle = bm.emissionCycle;
      em.pollutionAccumulation = bm.pollutionAccumulation;
      em.ecosystemResilience = bm.ecosystemResilience;
      em.remediationLag = bm.remediationLag;
    }
    return this.state.brainEnvironmentModel;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // DIAGNOSIS ALIAS MAP (F3 canonical resolution) — env diagnoses → corpus bundles.
  // Prefers window.LIMENArtifactSourceIndex.aliases() (single source of truth) when
  // loaded; else falls back to this local map. Non-aliased = canonical to self.
  // ════════════════════════════════════════════════════════════════════════════
  var ENVIRONMENT_DIAGNOSIS_ALIASES = {
    CLIMATE_TIPPING_POINT: { target: 'CLIMATE_CRISIS', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits CLIMATE_CRISIS for climate tipping-point signals' },
    OCEAN_ACIDIFICATION: { target: 'MARINE_PH_COLLAPSE', reviewStatus: 'human-approved', risk: 'medium', note: 'ocean acidification mapped to marine pH-collapse bundle; verify pH-specific evidence applies to broader acidification claims' },
    DEFORESTATION: { target: 'FOREST_LOSS_ECOSYSTEM', reviewStatus: 'corpus-aliased', risk: 'low', note: 'corpus emits FOREST_LOSS_ECOSYSTEM for deforestation' }
  };
  EnvironmentBrain.prototype._resolveCanonicalEnvironmentDiagnosis = function (dxId) {
    if (!dxId) return { canonicalDiagnosisId: null, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };
    var target = null;
    try {
      var idx = (typeof window !== 'undefined') ? window.LIMENArtifactSourceIndex : null;
      if (idx && typeof idx.aliases === 'function') { var row = idx.aliases()[dxId]; if (row && row.target) target = row.target; }
    } catch (e) {}
    var local = ENVIRONMENT_DIAGNOSIS_ALIASES[dxId] || null;
    if (!target && local) target = local.target;
    if (target) {
      return { canonicalDiagnosisId: target, aliasUsed: true, aliasReviewStatus: (local && local.reviewStatus) || 'corpus-aliased', aliasRisk: (local && local.risk) || 'low', aliasNote: (local && local.note) || null };
    }
    return { canonicalDiagnosisId: dxId, aliasUsed: false, aliasReviewStatus: null, aliasRisk: null, aliasNote: null };
  };

  // ════════════════════════════════════════════════════════════════════════════
  // COMMAND-BOARD COMPANIES + BRAIN SIGNALS + SOURCE BUNDLES + L1 DEPTH (one-shot)
  // Real environmental-sector tickers only. Brain signals gate distressed positioning.
  // ════════════════════════════════════════════════════════════════════════════
  var ENVIRONMENT_TICKERS = {
    waste: [{ ticker: 'WM', name: 'Waste Management' }, { ticker: 'RSG', name: 'Republic Services' }, { ticker: 'WCN', name: 'Waste Connections' }, { ticker: 'CWST', name: 'Casella Waste Systems' }],
    water: [{ ticker: 'AWK', name: 'American Water Works' }, { ticker: 'WTRG', name: 'Essential Utilities' }],
    climatetech: [{ ticker: 'XYL', name: 'Xylem' }, { ticker: 'LIN', name: 'Linde' }],
    remediation: [{ ticker: 'ECL', name: 'Ecolab' }, { ticker: 'APD', name: 'Air Products' }, { ticker: 'DAR', name: 'Darling Ingredients' }, { ticker: 'AY', name: 'Atlantica Sustainable Infrastructure' }]
  };
  EnvironmentBrain.prototype._loadEnvironmentCommandBoardCompanies = function () {
    var self = this;
    if (self._envCompanyPromise) return self._envCompanyPromise;
    var all = [];
    Object.keys(ENVIRONMENT_TICKERS).forEach(function (k) { ENVIRONMENT_TICKERS[k].forEach(function (c) { all.push({ ticker: c.ticker, name: c.name, segment: k }); }); });
    self._envCompanies = all;
    self._envCompanyPromise = Promise.resolve(all);
    return self._envCompanyPromise;
  };

  EnvironmentBrain.prototype._loadBrainSignals = function () {
    var self = this;
    if (self._sigLoadPromise) return self._sigLoadPromise;
    self._pubSignals = self._pubSignals || [];
    self._sigLoadPromise = fetch('/api/brain-signals?domain=environment')
      .then(function (r) { return (r && r.ok) ? r.json() : null; })
      .then(function (data) { self._pubSignals = (data && (data.signals || data.validated)) || []; return self._pubSignals; })
      .catch(function () { self._pubSignals = []; return self._pubSignals; });
    return self._sigLoadPromise;
  };

  EnvironmentBrain.prototype._loadEnvironmentDiagnosisBundles = function () {
    var self = this;
    if (self._bundleLoadPromise) return self._bundleLoadPromise;
    self._bundleCache = self._bundleCache || {};
    self._bundleStatusMap = self._bundleStatusMap || {};
    var ids = {};
    var known = ['CLIMATE_TIPPING_POINT', 'MASS_EXTINCTION', 'OCEAN_ACIDIFICATION', 'DEFORESTATION', 'TOXIC_CONTAMINATION'];
    var diags = (self.state && self.state.diagnoses) || [];
    var allDxIds = diags.map(function (d) { return d.id; }).concat(known);
    for (var i = 0; i < allDxIds.length; i++) { var c = self._resolveCanonicalEnvironmentDiagnosis(allDxIds[i]).canonicalDiagnosisId; if (c) ids[c] = true; }
    self._bundleLoadPromise = Promise.all(Object.keys(ids).map(function (cid) {
      return fetch('/assets/data/artifact-source-index/by-diagnosis/' + encodeURIComponent(cid) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) { self._bundleStatusMap[cid] = data ? 'found' : 'missing'; if (data) self._bundleCache[cid] = data; })
        .catch(function () { self._bundleStatusMap[cid] = 'missing'; });
    })).then(function () { return self._bundleCache; });
    return self._bundleLoadPromise;
  };

  var ENV_MADLIB_VERB = /^(Develop|Establish|Implement|Build|Launch|Design|Deploy|Operationalize|Conduct|Create|Define|Assess|Optimize|Modernize|Strengthen|Enhance|Formalize|Institute|Standardize|Coordinate|Integrate|Calibrate|Evaluate|Streamline|Institutionalize|Configure|Monitor)\b/;
  EnvironmentBrain.prototype._isMadLibTreatment = function (label) { return !label || ENV_MADLIB_VERB.test(String(label)); };

  EnvironmentBrain.prototype._loadL1PortalDepth = function () {
    var self = this;
    if (self._l1LoadPromise) return self._l1LoadPromise;
    var BRANCH = { CLIMATE_TIPPING_POINT: ['climate'], MASS_EXTINCTION: ['ecosystems'], OCEAN_ACIDIFICATION: ['ocean'], DEFORESTATION: ['forests'], TOXIC_CONTAMINATION: ['water', 'pollution'] };
    self._l1Branches = BRANCH;
    var branches = {}; Object.keys(BRANCH).forEach(function (dx) { BRANCH[dx].forEach(function (b) { branches[b] = true; }); });
    var byBranch = {};
    self._l1LoadPromise = Promise.all(Object.keys(branches).map(function (b) {
      return fetch('/assets/data/domains/environment_' + encodeURIComponent(b) + '.json')
        .then(function (r) { return (r && r.ok) ? r.json() : null; })
        .then(function (data) {
          if (!data) { byBranch[b] = null; return; }
          var acts = data.activations || [], tickers = {}, total = 0, mad = 0;
          acts.forEach(function (a) {
            (a.companies || []).forEach(function (c) { if (c && c.ticker_or_id) tickers[c.ticker_or_id] = c.name || c.ticker_or_id; });
            (a.treatments || []).forEach(function (t) { var l = t && (t.label || t.title); if (l) { total++; if (self._isMadLibTreatment(l)) mad++; } });
          });
          byBranch[b] = { file: 'environment_' + b, companyTickers: Object.keys(tickers).map(function (k) { return { ticker: k, name: tickers[k] }; }), treatmentTotal: total, madLibCount: mad, realTreatmentCount: total - mad };
        })
        .catch(function () { byBranch[b] = null; });
    })).then(function () {
      var byDiagnosis = {};
      Object.keys(BRANCH).forEach(function (dx) {
        var tk = {}, total = 0, mad = 0, scanned = 0;
        BRANCH[dx].forEach(function (b) { var r = byBranch[b]; if (r) { scanned++; r.companyTickers.forEach(function (c) { tk[c.ticker] = c.name; }); total += r.treatmentTotal; mad += r.madLibCount; } });
        byDiagnosis[dx] = { branchesScanned: scanned, realCompanyTickers: Object.keys(tk).map(function (k) { return { ticker: k, name: tk[k], relevanceUnverified: true }; }), treatmentTotal: total, madLibTreatments: mad, realTreatments: total - mad, admitted: false, reason: 'L1 treatments are mad-lib templates (fixed-verb family) — only company tickers surfaced, relevance unverified' };
      });
      self.state._l1DepthCache = { byBranch: byBranch, byDiagnosis: byDiagnosis, scannedAt: (self.state.environmentModel && self.state.environmentModel.updated) || null };
      return self.state._l1DepthCache;
    });
    return self._l1LoadPromise;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // CLIMATE-RISK SUB-LAYER (additive; analogous to energy data-center sub-portal).
  // Climate change creates a natural climate-risk / emissions / carbon-markets sub-domain.
  // Triggered when a primary climate/contamination diagnosis fires. NEVER merged into the
  // validated 5-diagnosis spine (state.diagnoses stays 5).
  // ════════════════════════════════════════════════════════════════════════════
  EnvironmentBrain.prototype._loadClimateRiskSublayer = function () {
    var self = this;
    if (self._crLoadPromise) return self._crLoadPromise;
    function tryFetch(path) { return fetch(path).then(function (r) { return (r && r.ok) ? r.json() : null; }).catch(function () { return null; }); }
    self._crLoadPromise = tryFetch('/assets/data/domains/environment_climate_risk.json')
      .then(function (data) { return data || tryFetch('/assets/data/domains/environment_emissions.json'); })
      .then(function (data) {
        if (!data) { self._crPortal = null; return null; }
        self._crPortal = { issues: data.issues || [], activations: data.activations || [], title: data.title || 'Climate Risk & Emissions' };
        return self._crPortal;
      });
    return self._crLoadPromise;
  };

  // Hand-authored sub-diagnoses (real-content; activate if a primary diagnosis fires).
  var ENV_CLIMATE_RISK_DX = [
    { id: 'CLIMATE_TRANSITION_RISK', label: 'Climate Transition Risk', summary: 'Carbon-intensive asset stranding and regulatory phase-out exposure.', triggers: ['CLIMATE_TIPPING_POINT', 'TOXIC_CONTAMINATION'], tickers: ['WM', 'LIN', 'AWK'] },
    { id: 'EMISSIONS_REPORTING_PRESSURE', label: 'Emissions Reporting Pressure', summary: 'ESG / SEC climate-disclosure mandates and scope-3 accounting burden.', triggers: ['CLIMATE_TIPPING_POINT'], tickers: ['ECL', 'XYL'] },
    { id: 'CARBON_MARKET_VOLATILITY', label: 'Carbon Market Volatility', summary: 'ETS / CDM / VCS carbon-credit price swings and arbitrage exposure.', triggers: ['CLIMATE_TIPPING_POINT', 'DEFORESTATION'], tickers: ['LIN', 'DAR'] },
    { id: 'NET_ZERO_TRANSITION_GAP', label: 'Net-Zero Transition Gap', summary: 'Capex misalignment with 2030–2050 decarbonization pathways.', triggers: ['CLIMATE_TIPPING_POINT', 'TOXIC_CONTAMINATION'], tickers: ['APD', 'AY', 'WTRG'] }
  ];
  EnvironmentBrain.prototype._buildClimateRiskLayer = function () {
    var self = this;
    var active = (self.state.diagnoses || []).filter(function (d) { return d.active; }).map(function (d) { return d.id; });
    var diagnoses = ENV_CLIMATE_RISK_DX.map(function (cr) {
      var fired = cr.triggers.some(function (tg) { return active.indexOf(tg) !== -1; });
      return {
        id: cr.id, label: cr.label, summary: cr.summary,
        active: fired,
        relevance: fired ? 0.6 : 0,
        tickers: cr.tickers.slice(),
        triggeredBy: cr.triggers.filter(function (tg) { return active.indexOf(tg) !== -1; }),
        source: 'climate-risk', tier: 'real-content-unbundled', branch: 'climate-risk'
      };
    });
    self.state.climateRiskLayer = {
      loaded: true,
      portalTitle: (self._crPortal && self._crPortal.title) || 'Climate Risk & Emissions',
      count: diagnoses.length,
      activeCount: diagnoses.filter(function (d) { return d.active; }).length,
      diagnoses: diagnoses.map(function (d) {
        var rc = self._resolveCanonicalEnvironmentDiagnosis(d.id);
        var bs = (self._bundleStatusMap && self._bundleStatusMap[rc.canonicalDiagnosisId]) || 'missing';
        return { id: d.id, label: d.label, active: d.active, branch: 'climate-risk', canonicalDiagnosisId: rc.canonicalDiagnosisId, bundleStatus: bs, tickers: d.tickers };
      }),
      note: 'real-content (hand-authored) climate-risk / emissions / carbon-market sub-portal diagnoses; SEPARATE from the validated 5-diagnosis spine; no external source bundle yet; never admitted to evidenceAnchors'
    };
    self.state.emissionsSublayer = self.state.climateRiskLayer;
    return self.state.climateRiskLayer;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // HIGHER ENVIRONMENT BRAIN LAYERS (immune / awareness / conscience / intuition /
  // simulation / executive). Compact form mirrors infrastructure-brain port.
  // ════════════════════════════════════════════════════════════════════════════
  EnvironmentBrain.prototype._environmentBundleStates = function () {
    var self = this; var diags = this.state.diagnoses || [];
    return diags.map(function (d) {
      var c = self._resolveCanonicalEnvironmentDiagnosis(d.id);
      var bundle = (self._bundleCache && self._bundleCache[c.canonicalDiagnosisId]) || null;
      var known = !!(self._bundleStatusMap && Object.prototype.hasOwnProperty.call(self._bundleStatusMap, c.canonicalDiagnosisId));
      return { dxId: d.id, active: !!d.active, relevance: (typeof d.relevance === 'number' ? d.relevance : 0),
        canonical: c.canonicalDiagnosisId, aliasUsed: c.aliasUsed, aliasRisk: c.aliasRisk, aliasReviewStatus: c.aliasReviewStatus,
        bundleStatus: bundle ? 'found' : (known ? 'missing' : 'unknown'),
        buildMethod: (bundle && bundle.buildMethod) || null, humanVerification: (bundle && bundle.humanVerification) || null,
        shallow: !!(bundle && ((bundle.maxDepth || 0) === 0 || (bundle.portalCount || 0) <= 1)) };
    });
  };

  // Immune — antigen scan (bundles, prediction-error, staleness, opportunity flood, L1 mad-lib,
  // env-specific: ecosystem-data-integrity, emissions-estimation-uncertainty, regulatory-volatility).
  EnvironmentBrain.prototype._computeEnvironmentImmune = function () {
    var s = this.state, em = s.environmentModel || {}, reg = em.regulation || {}, bs = this._environmentBundleStates();
    var ant = [];
    bs.forEach(function (b) {
      if (b.bundleStatus === 'missing') ant.push({ type: 'source-bundle-missing', dx: b.dxId, severity: 'medium', action: 'block-from-prompt-evidence' });
      if (b.buildMethod === 'external-source-authored') ant.push({ type: 'external-source-authored-needs-human-verification', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
      if (b.aliasRisk === 'medium' || b.aliasRisk === 'high') ant.push({ type: 'alias-risk-bundle', dx: b.dxId, severity: b.aliasRisk, action: 'allow-with-warning' });
      if (b.bundleStatus === 'found' && b.shallow) ant.push({ type: 'root-only-shallow-bundle', dx: b.dxId, severity: 'low', action: 'allow-with-warning' });
    });
    var pe = (em.predictionError && em.predictionError.total) || 0;
    if (pe > 0.4) ant.push({ type: 'prediction-error-spike', severity: 'medium', action: 'lower-confidence', value: Math.round(pe * 1000) / 1000 });
    if (reg.stale) ant.push({ type: 'climate-feed-staleness', severity: 'low', action: 'flag', note: 'climate feed >30m old' });
    if (reg.flooding) ant.push({ type: 'opportunity-flood', severity: 'medium', action: 'inhibit', note: '>8 concurrent diagnoses' });
    if (reg.starving) ant.push({ type: 'stress-without-opportunity', severity: 'low', action: 'flag' });
    // Env-specific structural antigens (always present — honest data-quality caveats).
    ant.push({ type: 'ecosystem-data-integrity', severity: 'low', action: 'allow-with-warning', note: 'rare-species / IUCN red-list data is sparse; low-confidence claims must be hedged' });
    ant.push({ type: 'emissions-estimation-uncertainty', severity: 'low', action: 'allow-with-warning', note: 'carbon-footprint models carry ±30% bounds' });
    ant.push({ type: 'regulatory-volatility', severity: 'low', action: 'flag', note: 'ESG / climate policy changes frequently' });
    var _l1 = s._l1DepthCache;
    if (_l1 && _l1.byDiagnosis && Object.keys(_l1.byDiagnosis).some(function (dx) { return _l1.byDiagnosis[dx].madLibTreatments > 0; })) {
      ant.push({ type: 'l1-synthetic-treatments', severity: 'medium', action: 'quarantine', note: 'L1 portal treatments are mad-lib templates; quarantined from evidence — only real tickers surfaced relevance-unverified' });
    }
    var sev = ant.some(function (a) { return a.severity === 'high'; }) ? 'high' : ant.some(function (a) { return a.severity === 'medium'; }) ? 'medium' : ant.length ? 'low' : 'none';
    var im = {
      version: 1, immuneState: sev === 'high' ? 'alert' : sev === 'medium' ? 'active' : sev === 'low' ? 'watch' : 'clear', severity: sev,
      antigens: ant.slice(0, 12),
      quarantines: ['L1-portal-treatments-madlib'],
      allowedWithWarning: ant.filter(function (a) { return a.action === 'allow-with-warning'; }).map(function (a) { return a.type + (a.dx ? (':' + a.dx) : ''); }),
      blockedFromPrompt: ant.filter(function (a) { return a.action === 'block-from-prompt-evidence'; }).map(function (a) { return a.dx; }),
      blockedFromTraversal: ['L2'],
      immuneMemory: (((s.environmentImmune && s.environmentImmune.immuneMemory) || 0) + 1),
      lastScanAt: em.updated || null
    };
    s.environmentImmune = im; return im;
  };

  // Awareness — narrative of active diagnoses + confidence drivers + knowns/unknowns.
  EnvironmentBrain.prototype._computeEnvironmentAwareness = function () {
    var s = this.state, em = s.environmentModel || {}, im = s.environmentImmune || {}, bs = this._environmentBundleStates();
    var covered = bs.filter(function (b) { return b.bundleStatus === 'found'; });
    var missing = bs.filter(function (b) { return b.bundleStatus === 'missing'; });
    var active = (s.diagnoses || []).filter(function (d) { return d.active; });
    var dxNames = active.map(function (d) { return d.label || d.id; });
    var pe = (em.predictionError && em.predictionError.total) || 0;
    var aw = {
      version: 1,
      selfState: im.immuneState === 'alert' ? 'guarded' : (em.regulation && em.regulation.state) || 'unknown',
      knowns: dxNames.slice(0, 6),
      unknowns: missing.map(function (b) { return b.dxId + ' (no source bundle)'; }),
      uncertainties: ['interpretive tracker — diagnoses are signal-driven readings, not validated', 'emissions-estimation ±30%', 'ecosystem data sparse for rare species', 'predictionError=' + (Math.round(pe * 1000) / 1000)],
      confidenceDrivers: ['regulation ' + ((em.regulation && em.regulation.state) || '?') + ' (ESG/SEC/Paris)', active.length + ' active dx', 'climate feed freshness', 'source coverage ' + covered.length + '/' + bs.length],
      humanReviewRequired: bs.filter(function (b) { return b.humanVerification === 'required'; }).map(function (b) { return b.dxId; }),
      selfNarrative: 'Environment: ' + active.length + ' active diagnosis pathway' + (active.length !== 1 ? 's' : '') + ' (' + (dxNames.slice(0, 3).join(', ') || 'none') + '), regulation=' + ((em.regulation && em.regulation.state) || '?') + ', immune=' + (im.immuneState || '?') + ', prediction-error=' + (Math.round(pe * 100) / 100) + ', feeds=' + ((em.regulation && em.regulation.stale) ? 'stale' : 'fresh') + '.',
      lastAwarenessAt: em.updated || null
    };
    s.environmentAwareness = aw; return aw;
  };

  // Conscience — blocks false alarms on sparse ecosystem data; vetoes artifact readiness.
  EnvironmentBrain.prototype._computeEnvironmentConscience = function () {
    var s = this.state, em = s.environmentModel || {}, bs = this._environmentBundleStates();
    var pe = (em.predictionError && em.predictionError.total) || 0;
    var vetoes = [{ claim: 'patent/grant', reason: 'no method/mechanism/embodiment/figure fields in any environment bundle' }];
    var cautions = [], allowed = [], blocked = ['patent-claim', 'grant-claim'];
    var active = (s.diagnoses || []).filter(function (d) { return d.active; });
    function dxRel(id) { for (var i = 0; i < active.length; i++) { if (active[i].id === id) return (typeof active[i].relevance === 'number') ? active[i].relevance : 0; } return null; }
    // Env-specific data-quality blocks.
    var meRel = dxRel('MASS_EXTINCTION');
    if (meRel !== null && meRel < 0.4) { blocked.push('species-decline-claim'); vetoes.push({ claim: 'species-decline-claim', reason: 'MASS_EXTINCTION confidence ' + meRel + ' < 0.4; IUCN red-list data sparse, taxonomy uncertain' }); }
    var dfRel = dxRel('DEFORESTATION');
    if (dfRel !== null && dfRel < 0.5) { cautions.push({ claim: 'carbon-sink-decline-claim', reason: 'DEFORESTATION confidence ' + dfRel + ' < 0.5; satellite cloud cover + soil-carbon validation gaps' }); }
    var oaRel = dxRel('OCEAN_ACIDIFICATION');
    if (oaRel !== null && oaRel < 0.4) { cautions.push({ claim: 'ocean-acidification-claim', reason: 'OCEAN_ACIDIFICATION confidence ' + oaRel + ' < 0.4; marine-pH data collection irregular' }); }
    bs.forEach(function (b) {
      if (b.bundleStatus === 'missing') { blocked.push('strong-claim:' + b.dxId); }
      else if (b.buildMethod === 'external-source-authored') { cautions.push({ claim: 'strong-claim:' + b.dxId, reason: 'external-source-authored; human-verification-required' }); allowed.push('source-routing:' + b.dxId); }
      else if (b.bundleStatus === 'found') { allowed.push('source-summary:' + b.dxId); }
    });
    if (pe > 0.3) cautions.push({ claim: 'high-confidence-claim', reason: 'predictionError ' + (Math.round(pe * 1000) / 1000) + ' (allow-with-warning, low confidence)' });
    var hasFound = bs.some(function (b) { return b.bundleStatus === 'found'; });
    var con = {
      version: 1, conscienceState: 'restrictive',
      vetoes: vetoes.slice(0, 10), cautions: cautions.slice(0, 10),
      allowedClaims: ['source-summary', 'environment-brief-with-warnings'].concat(allowed.slice(0, 6)),
      blockedClaims: blocked.slice(0, 10),
      artifactReadinessDecision: { patentReady: false, grantReady: false, sbaReady: false, investmentReady: hasFound, researchReady: hasFound || active.length > 0, note: 'patent/grant vetoed; sparse-data claims (species/carbon-sink/ocean-pH) blocked below confidence floor; investment/research allowed-with-warning for source-backed diagnoses' },
      reasons: ['overclaim prevention', 'sparse-ecosystem-data sufficiency', 'interpretive-not-validated'],
      lastCheckAt: em.updated || null
    };
    s.environmentConscience = con; return con;
  };

  // Intuition — early-warning hunches (ocean/coral, climate, deforestation feedback, contamination).
  EnvironmentBrain.prototype._computeEnvironmentIntuition = function () {
    var s = this.state, em = s.environmentModel || {}, reg = em.regulation || {};
    var active = (s.diagnoses || []).filter(function (d) { return d.active; }).map(function (d) { return d.id; });
    var conds = s._activeConditions || [];
    function has(c) { return conds.indexOf(c) !== -1; }
    var hunches = [];
    if (active.indexOf('OCEAN_ACIDIFICATION') !== -1 || has('coral_bleaching') || has('marine_ph_decline')) {
      hunches.push({ hunch: 'OCEAN_ACIDIFICATION imminent: marine pH-decline + coral-bleaching temperature anomaly >1.5C -> reef collapse 12-24m', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', timeframe: '12-24m', implication: 'fishery + tourism + marine-ecosystem cascade' });
    }
    if (active.indexOf('CLIMATE_TIPPING_POINT') !== -1 || has('temperature_anomaly')) {
      hunches.push({ hunch: 'CLIMATE_TIPPING_POINT: temperature anomaly >1.7C + precipitation volatility 40%+ -> ecosystem synchronization loss 6-12m', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', timeframe: '6-12m', implication: 'phenology mismatch, crop + pollinator stress' });
    }
    if (active.indexOf('DEFORESTATION') !== -1 || (has('forest_loss') && has('carbon_sink_decline'))) {
      hunches.push({ hunch: 'DEFORESTATION feedback: forest-loss >0.5M ha/yr + carbon-sink decline 15% YoY -> tipping point 2-4y', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', timeframe: '2-4y', implication: 'biome flip (rainforest -> savanna), accelerated emissions' });
    }
    if (has('industrial_discharge') && has('water_contamination')) {
      hunches.push({ hunch: 'TOXIC_CONTAMINATION escalation: industrial discharge + water contamination both active -> bioaccumulation risk 3-6m', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', timeframe: '3-6m', implication: 'food-chain toxin concentration, remediation-demand spike' });
    }
    if (reg.state === 'surprised') hunches.push({ hunch: 'novel environmental stressor entering the system', label: 'HUNCH', confidence: 'LOW', evidenceStatus: 'UNVERIFIED', timeframe: 'next-cycle', implication: 'watch for a new diagnosis to activate with source support' });
    var it = {
      version: 1, hunches: hunches.slice(0, 4),
      weakSignals: hunches.map(function (h) { return h.hunch; }),
      confidence: 'LOW', evidenceStatus: 'UNVERIFIED',
      dominantHunch: hunches[0] || null,
      promotedToDiagnosis: [],
      lastHunch: em.updated || null, lastIntuitionAt: em.updated || null
    };
    s.environmentIntuition = it; return it;
  };

  // Simulation — emissions scenarios (BAU 2C+ / Paris 2C / net-zero 2050).
  EnvironmentBrain.prototype._computeEnvironmentSimulation = function () {
    var s = this.state, em = s.environmentModel || {};
    var base = typeof s.stress === 'number' ? s.stress : 0;
    function cl(v) { return Math.max(0, Math.min(1, Math.round(v * 1000) / 1000)); }
    var scenarios = [
      { type: 'business-as-usual', hypothetical: true, assumption: 'no incremental decarbonization', simulatedStress: cl(base + 0.3), warming: '+2.7C by 2100', risk: 'HIGH', detail: 'biodiversity loss 70%+, food-security stress, regulatory whiplash, stranded carbon-intensive assets', intervention: 'track NDC gap / IPCC AR / UNEP Emissions Gap Report', falsifier: 'global emissions peak + decline next cycle' },
      { type: 'delayed-action-paris', hypothetical: true, assumption: '2C Paris pathway (delayed)', simulatedStress: cl(base + 0.1), warming: '+2.1C', risk: 'MEDIUM', detail: 'ecosystem disruption 40-50%, transition capex 2-3% global GDP, carbon price EUR150-200/t, compliance-driven positioning', intervention: 'monitor EU ETS / national carbon pricing / SEC climate disclosure', falsifier: 'policy acceleration toward 1.5C' },
      { type: 'net-zero-2050', hypothetical: true, assumption: 'IPCC 1.5C aggressive transition', simulatedStress: cl(base - 0.15), warming: '+1.5C', risk: 'LOW-MEDIUM', detail: 'early-mover capex advantage, ecosystem recovery potential, carbon price EUR300+/t, climate-tech scaling; uncertainty HIGH', intervention: 'track green-investment flows / clean-tech adoption curves', falsifier: 'transition stalls, emissions plateau' }
    ];
    var sim = {
      version: 1, scenarios: scenarios,
      assumptions: scenarios.map(function (x) { return x.assumption; }),
      simulatedStress: scenarios.map(function (x) { return x.simulatedStress; }),
      simulatedDiagnoses: ['CLIMATE_TIPPING_POINT', 'OCEAN_ACIDIFICATION', 'DEFORESTATION'], simulatedOpportunities: [],
      risks: scenarios.map(function (x) { return x.risk; }), interventions: scenarios.map(function (x) { return x.intervention; }),
      falsifiers: scenarios.map(function (x) { return x.falsifier; }),
      dominantScenario: scenarios[1],
      lastSimulatedAt: em.updated || null, timestamp: em.updated || null
    };
    s.environmentSimulation = sim; return sim;
  };

  // Executive report — quarterly climate risk / regulatory pressure / transition capex.
  EnvironmentBrain.prototype._computeEnvironmentExecutiveReport = function () {
    var s = this.state, em = s.environmentModel || {}, im = s.environmentImmune || {}, aw = s.environmentAwareness || {}, con = s.environmentConscience || {}, it = s.environmentIntuition || {}, sim = s.environmentSimulation || {}, bs = this._environmentBundleStates();
    var covered = bs.filter(function (b) { return b.bundleStatus === 'found'; }).length;
    var active = (s.diagnoses || []).filter(function (d) { return d.active; }).sort(function (a, b) { return (b.relevance || 0) - (a.relevance || 0); });
    var strongest = active[0] || (s.diagnoses || [])[0] || null;
    var pe = (em.predictionError && em.predictionError.total) || 0;
    var stress = typeof s.stress === 'number' ? s.stress : 0;
    var climateRiskIndex = Math.round(_envClamp(stress * 100, 0, 100));
    var status = im.immuneState === 'alert' ? 'immune-alert' : covered < bs.length ? 'source-limited' : (em.regulation && em.regulation.starving) ? 'starving' : (em.regulation && em.regulation.state === 'surprised') ? 'surprised' : 'healthy';
    var rep = {
      version: 1, brainStatus: status,
      summary: 'Environment Q-report: climate-risk index ' + climateRiskIndex + '/100, ' + active.length + ' active diagnosis pathway(s), strongest=' + (strongest ? (strongest.label || strongest.id) : 'none') + ', immune=' + (im.immuneState || '?') + '.',
      riskProfile: { climateRiskIndex: climateRiskIndex, scale: '0-100 (temperature anomaly, ecosystem loss, sea-level rise)', dominantExposure: strongest ? (strongest.label || strongest.id) : null },
      regulatoryPressure: { level: stress >= 0.6 ? 'high' : stress >= 0.4 ? 'elevated' : 'baseline', drivers: ['ESG disclosure', 'SEC climate rule', 'Paris/NDC compliance'], note: 'fine + stranded-asset risk for high-emitting / water-stressed exposures' },
      transitionCapexForecast: { pathway: (sim.dominantScenario && sim.dominantScenario.type) || 'delayed-action-paris', estimate: '2-3% global GDP (2C) scaling toward net-zero-2050', greenInvestmentOpportunity: 'early-mover capex advantage in remediation / water / climate-tech', phaseOutTimeline: '2030 interim / 2050 net-zero' },
      primaryExposures: ['high-emitting industrial sectors', 'water-stressed regions', 'biodiversity hotspots'],
      marketImplications: ['carbon-credit prices (ETS/VCS)', 'clean-energy + remediation demand', 'stranded-asset write-downs'],
      strongestDiagnosis: strongest ? strongest.id : null,
      strongestOpportunity: (s.opportunities && s.opportunities[0] && s.opportunities[0].title) || null,
      confidence: Math.round((1 - pe) * 100) / 100, predictionError: Math.round(pe * 1000) / 1000,
      awarenessSummary: aw.selfNarrative || null, conscienceDecision: con.conscienceState || null,
      intuitionSummary: (it.hunches || []).length + ' hunch(es)', simulationSummary: (sim.scenarios || []).length + ' scenario(s)',
      blockers: (con.blockedClaims || []).slice(0, 6),
      lastReportAt: em.updated || null
    };
    s.environmentExecutiveReport = rep; return rep;
  };

  EnvironmentBrain.prototype._computeEnvironmentHigherLayers = function () {
    this._computeEnvironmentImmune();
    this._computeEnvironmentAwareness();
    this._computeEnvironmentConscience();
    this._computeEnvironmentIntuition();
    this._computeEnvironmentSimulation();
    this._computeEnvironmentExecutiveReport();
    // MANDATORY — generic cognition surface the domain-console SELF-MODEL panel reads.
    this.state.cognition = {
      domain: 'environment',
      model: {
        cycle: (this.state.environmentModel || {}).cycle || 0,
        predictionError: (this.state.environmentModel || {}).predictionError || null,
        predictedStress: (this.state.environmentModel || {}).predictedStress,
        regulation: (this.state.environmentModel || {}).regulation || null
      },
      awareness: this.state.environmentAwareness || null,
      conscience: this.state.environmentConscience || null,
      immune: this.state.environmentImmune || null,
      intuition: this.state.environmentIntuition || null,
      brainEnvironmentModel: this.state.brainEnvironmentModel || null,
      climateRiskLayer: this.state.climateRiskLayer || null
    };
  };

  // ════════════════════════════════════════════════════════════════════════════
  // DomainDiagnosisPacket (schema-only; NEVER invents data). 8-section contract.
  // ════════════════════════════════════════════════════════════════════════════
  var ENV_DDP_SCHEMA_VERSION = 'environment-ddp-1';
  function _envDdpPresent(v) {
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (v === 'missing' || v === '' || v === 'none') return false;
    return true;
  }
  function _envDdpCompleteness(section, keys) {
    var have = 0; for (var i = 0; i < keys.length; i++) { if (_envDdpPresent(section[keys[i]])) have++; }
    return { have: have, total: keys.length, pct: keys.length ? Math.round(have / keys.length * 100) : 0 };
  }
  EnvironmentBrain.prototype._buildDomainDiagnosisPacket = function (dx) {
    var s = this.state || {};
    var em = s.environmentModel || {};
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

    var feeds = Array.isArray(s.feeds) ? s.feeds : [];
    var sourceFeeds = feeds.map(function (f) { return { name: (f && f.name) || null, updated: (f && f.updated) || null, source: (f && f.source) || (f && f.channel) || null }; });

    var _canon = this._resolveCanonicalEnvironmentDiagnosis(dxId);
    var identity = {
      domain: 'environment',
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
      environmentModel: { version: em.version || null, cycle: (typeof em.cycle === 'number' ? em.cycle : null) },
      predictionError: em.predictionError || null,
      regulationState: (em.regulation && em.regulation.state) || null,
      prior: em.prior || null,
      observation: em.observation || null,
      plasticity: em.plasticity || null,
      readyForHandoff: em.readyForHandoff === true
    };
    var rootId = (portal && portal.domainId) || 'environment';
    var rootTitle = (portal && portal.title) || 'Environment';
    var ancestry = (portal && portal.parentLabel) ? [portal.parentLabel, rootTitle] : [rootTitle];
    var portalContext = {
      portalIds: [rootId],
      portalDomain: 'environment',
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
    var _intakeSrcHint = { CLIMATE_CRISIS: 'IPCC AR / NOAA NCEI / NASA GISS / UNEP Emissions Gap', MASS_EXTINCTION: 'IUCN Red List / GBIF / Living Planet Index', MARINE_PH_COLLAPSE: 'NOAA OA Program / GOA-ON / IPCC SROCC', FOREST_LOSS_ECOSYSTEM: 'Global Forest Watch / FAO FRA / Hansen GFC', TOXIC_CONTAMINATION: 'EPA ECHO / TRI / 40 CFR / openFDA' };
    var authoringIntake = [];
    if (_isExternal) {
      ['methodCandidates', 'embodimentCandidates', 'figurePlaceholders'].forEach(function (field) {
        if (_bArr(field).length === 0) authoringIntake.push({ field: field, status: 'needs-human-input', count: 0, need: field === 'methodCandidates' ? 'a concrete mitigation/adaptation method drawn from a primary source' : field === 'embodimentCandidates' ? 'a specific remediation implementation from a real document' : 'a figure description grounded in a real source', sourceHint: _intakeSrcHint[identity.canonicalDiagnosisId] || 'primary institutional / scientific source', note: 'NOT fabricated by the brain — author from the cited source, then wire in verbatim with attribution' });
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
    if (((em.predictionError && em.predictionError.total) || 0) > 0.4) blockers.push('prediction-error-high');
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
      patentReady: false, grantReady: false, sbaReady: false,
      investmentReady: !!(hasTreat && primaryOpp), researchReady: ready || hasTreat,
      readinessReasons: readinessReasons,
      blockers: blockers
    };

    var comp = {
      identity:         _envDdpCompleteness(identity, ['domain', 'diagnosisId', 'canonicalDiagnosisId', 'label', 'phase', 'confidence']),
      brainState:       _envDdpCompleteness(brainState, ['environmentModel', 'predictionError', 'regulationState', 'prior', 'observation', 'plasticity']),
      portalContext:    _envDdpCompleteness(portalContext, ['portalIds', 'portalDomain', 'portalTitle', 'depth', 'ancestryPath']),
      evidence:         _envDdpCompleteness(evidence, ['sourceFeeds', 'evidenceAnchors', 'citationHints']),
      treatmentContext: _envDdpCompleteness(treatmentContext, ['treatments', 'implementationSteps', 'methodCandidates', 'mechanismCandidates', 'embodimentCandidates', 'figurePlaceholders']),
      operatorContext:  _envDdpCompleteness(operatorContext, ['targets', 'monitoring', 'escalation', 'invalidIf', 'nextStep']),
      artifactContext:  _envDdpCompleteness(artifactContext, ['artifactLanes'])
    };
    var totHave = 0, totAll = 0;
    for (var sk in comp) { if (comp.hasOwnProperty(sk)) { totHave += comp[sk].have; totAll += comp[sk].total; } }
    var missingFields = [];
    function _cm(name, obj, keys) { for (var i = 0; i < keys.length; i++) { if (!_envDdpPresent(obj[keys[i]])) missingFields.push(name + '.' + keys[i]); } }
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
    if (!primaryOpp && (typeof s.stress !== 'number' || s.stress < ENV_STRESS_FLOOR)) warnings.push('no active opportunity (offline/low-stress) — operator/lane fields stay empty');
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
        'diagnosis-specific bundle anchors preferred over generic environment evidence',
        'official/primary sources retained (IPCC/NOAA/NASA/IUCN/EPA/Global Forest Watch where present)',
        'mechanisms prioritized over figures under prompt-space limits',
        'treatments with implementation relevance preferred over broad narrative',
        'caps applied per field; full data preserved in the stored bundle + full DDP'
      ],
      retainedWarnings: warnings
        .concat(s.environmentImmune ? ['immune: ' + s.environmentImmune.immuneState + ' (sev ' + s.environmentImmune.severity + ', ' + (s.environmentImmune.antigens || []).length + ' antigens; L2 traversal blocked)'] : [])
        .concat(s.environmentConscience && s.environmentConscience.conscienceState === 'restrictive' ? ['conscience: ' + (s.environmentConscience.blockedClaims || []).slice(0, 3).join(', ') + ' blocked'] : []),
      retainedBlockers: artifactContext.blockers,
      immuneSummary: s.environmentImmune ? { immuneState: s.environmentImmune.immuneState, severity: s.environmentImmune.severity, antigenCount: (s.environmentImmune.antigens || []).length, quarantines: s.environmentImmune.quarantines, blockedFromTraversal: s.environmentImmune.blockedFromTraversal, allowedWithWarning: s.environmentImmune.allowedWithWarning } : null,
      awarenessSummary: s.environmentAwareness ? { selfNarrative: s.environmentAwareness.selfNarrative, knowns: (s.environmentAwareness.knowns || []).length, unknowns: (s.environmentAwareness.unknowns || []).length, humanReviewRequired: s.environmentAwareness.humanReviewRequired } : null,
      conscienceDecision: s.environmentConscience ? { conscienceState: s.environmentConscience.conscienceState, blockedClaims: s.environmentConscience.blockedClaims, artifactReadinessDecision: s.environmentConscience.artifactReadinessDecision } : null,
      intuitionSummary: s.environmentIntuition ? s.environmentIntuition.hunches : null,
      scenarioSummary: s.environmentSimulation ? (s.environmentSimulation.scenarios || []).map(function (x) { return { type: x.type, hypothetical: x.hypothetical, risk: x.risk }; }) : null,
      executiveReport: s.environmentExecutiveReport || null,
      l1DepthSummary: portalContext.l1Depth ? { realCompanyTickers: (portalContext.l1Depth.realCompanyTickers || []).length, realTreatments: portalContext.l1Depth.realTreatments, madLibTreatments: portalContext.l1Depth.madLibTreatments, admitted: portalContext.l1Depth.admitted } : null,
      authoringIntake: treatmentContext.authoringIntake.length ? treatmentContext.authoringIntake : null,
      climateRiskSummary: s.climateRiskLayer && s.climateRiskLayer.loaded ? { count: s.climateRiskLayer.count, activeCount: s.climateRiskLayer.activeCount, diagnoses: s.climateRiskLayer.diagnoses, note: s.climateRiskLayer.note } : null
    };

    return {
      schemaVersion: ENV_DDP_SCHEMA_VERSION,
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
        schemaVersion: ENV_DDP_SCHEMA_VERSION,
        fieldCompleteness: { sections: comp, overallPct: pct },
        missingFields: missingFields,
        warnings: warnings,
        proofTier: proofTier,
        immune: s.environmentImmune || null,
        awareness: s.environmentAwareness || null,
        conscience: s.environmentConscience || null,
        intuition: s.environmentIntuition || null,
        simulation: s.environmentSimulation || null,
        executiveReport: s.environmentExecutiveReport || null
      }
    };
  };

  var _origCycle = EnvironmentBrain.prototype.cycle;
  EnvironmentBrain.prototype.cycle = function () {
    var self = this;
    // One-shot async loaders (guarded internally) — fire-and-forget; offline-safe.
    try { self._loadEnvironmentCommandBoardCompanies(); } catch (e) {}
    try { self._loadBrainSignals(); } catch (e) {}
    try { self._loadEnvironmentDiagnosisBundles(); } catch (e) {}
    try { self._loadL1PortalDepth(); } catch (e) {}
    try { self._loadClimateRiskSublayer(); } catch (e) {}
    return _origCycle.call(this).then(function () {
      return self.resolveDeepContent();
    }).then(function () {
      // PHASE B — cognitive substrate recurrent step at the END of the cycle.
      try { self._updateEnvironmentModel(); } catch (e) {}
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
