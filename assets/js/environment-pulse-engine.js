/**
 * environment-pulse-engine.js — Live Feed Pulse Engine for Environment Domain
 *
 * ENVIRONMENT DOMAIN ONLY. Evidence contracts, freshness TTLs, delta detection.
 * Self-gates: only runs when ?domain=environment is in the URL.
 * Exposes: window.LIMENEnvironmentPulse
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var dom = params.get('domain');
  if (dom !== 'environment') return;

  var FRESHNESS_TTL = {
    'climate_index':      6 * 60 * 60 * 1000,    // NOAA / NASA climate updates
    'weather_alert':      30 * 60 * 1000,        // NOAA weather alerts
    'biodiversity_feed':  24 * 60 * 60 * 1000,   // IUCN Red List / IPBES
    'ocean_feed':         12 * 60 * 60 * 1000,   // NOAA CoralReefWatch / NASA ocean
    'forest_feed':        24 * 60 * 60 * 1000,   // Global Forest Watch
    'air_quality':        2 * 60 * 60 * 1000,    // EPA AQS, AirNow
    'water_quality':      6 * 60 * 60 * 1000,    // EPA WQP, USGS
    'pollution_event':    1 * 60 * 60 * 1000,    // EPA emergency response
    'emissions_index':    24 * 60 * 60 * 1000,   // Global Carbon Atlas, Climate TRACE
    'regulatory_event':   24 * 60 * 60 * 1000,   // EPA rulemakings
    'event_cluster':      30 * 60 * 1000,
    'structural':         24 * 60 * 60 * 1000,
    'default':            10 * 60 * 1000
  };

  var SOURCE_TYPES = {
    'NOAA Climate':              'climate_index',
    'NASA GISTEMP':              'climate_index',
    'NOAA NCEI':                 'climate_index',
    'NOAA Weather Alerts':       'weather_alert',
    'USGS Earthquake Feed':      'weather_alert',
    'NOAA CoralReefWatch':       'ocean_feed',
    'NASA Ocean Color':          'ocean_feed',
    'Global Forest Watch':       'forest_feed',
    'IUCN Red List':             'biodiversity_feed',
    'IPBES':                     'biodiversity_feed',
    'EPA AirNow':                'air_quality',
    'EPA AQS':                   'air_quality',
    'EPA Water Quality Portal':  'water_quality',
    'USGS Water Data':           'water_quality',
    'EPA ECHO Enforcement':      'pollution_event',
    'Climate TRACE':             'emissions_index',
    'Global Carbon Atlas':       'emissions_index',
    'UNFCCC':                    'regulatory_event'
  };

  var EVIDENCE_CONTRACTS = {
    'CLIMATE_TIPPING_POINT': {
      label: 'Climate Tipping Point',
      requiredFamilies: ['climate_event', 'weather_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.climate_index,
      primaryIndicators: ['temperature_anomaly', 'extreme_weather', 'climate_volatility', 'sea_level_rise'],
      secondaryConfirmation: ['ecosystem_disruption', 'carbon_budget_breach'],
      catchAllBlocked: true
    },
    'MASS_EXTINCTION': {
      label: 'Mass Extinction',
      requiredFamilies: ['biodiversity_event', 'ecosystem_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.biodiversity_feed,
      primaryIndicators: ['species_decline', 'habitat_loss', 'biodiversity_collapse', 'invasive_spread'],
      secondaryConfirmation: ['food_chain_imbalance', 'pollinator_collapse'],
      catchAllBlocked: true
    },
    'OCEAN_ACIDIFICATION': {
      label: 'Ocean Acidification',
      requiredFamilies: ['ocean_event', 'climate_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.ocean_feed,
      primaryIndicators: ['marine_ph_decline', 'coral_bleaching', 'fishery_collapse', 'dead_zone'],
      secondaryConfirmation: ['marine_pollution', 'ocean_chemistry_shift'],
      catchAllBlocked: true
    },
    'DEFORESTATION': {
      label: 'Deforestation',
      requiredFamilies: ['forest_event', 'satellite_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.forest_feed,
      primaryIndicators: ['forest_loss', 'primary_forest_clearance', 'habitat_fragmentation'],
      secondaryConfirmation: ['carbon_sink_decline', 'soil_degradation'],
      catchAllBlocked: true
    },
    'TOXIC_CONTAMINATION': {
      label: 'Toxic Contamination',
      requiredFamilies: ['pollution_event', 'regulatory_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.pollution_event,
      primaryIndicators: ['water_contamination', 'air_quality_degradation', 'toxic_spill', 'industrial_discharge'],
      secondaryConfirmation: ['waste_accumulation', 'pfas_detected'],
      catchAllBlocked: true
    }
  };

  var _previousState = null;
  var _currentState = null;
  var _cycleCount = 0;
  var _history = [];
  var MAX_HISTORY = 20;

  function computePulse(brainState) {
    if (!brainState) return null;
    _cycleCount++;
    _previousState = _currentState;

    var feeds = brainState.feeds || [];
    var stress = brainState.stress || 0;
    var confidence = brainState.confidence || 0;
    var diagnoses = brainState.diagnoses || [];
    var now = Date.now();

    var sources = [];
    for (var fi = 0; fi < feeds.length; fi++) {
      var f = feeds[fi];
      var sourceType = SOURCE_TYPES[f.name] || 'default';
      var ttl = FRESHNESS_TTL[sourceType] || FRESHNESS_TTL['default'];
      var age = f.updated ? (now - f.updated) : Infinity;
      var fresh = age < ttl;
      var stale = !fresh && f.live;
      sources.push({
        name: f.name, value: f.value, live: f.live, fresh: fresh, stale: stale,
        age: age,
        ageLabel: age < 60000 ? Math.round(age / 1000) + 's' : age < 3600000 ? Math.round(age / 60000) + 'm' : Math.round(age / 3600000) + 'h',
        ttl: ttl, sourceType: sourceType, label: f.label || ''
      });
    }

    var liveFreshCount = sources.filter(function (s) { return s.live && s.fresh; }).length;
    var liveStaleCount = sources.filter(function (s) { return s.stale; }).length;
    var deadCount = sources.filter(function (s) { return !s.live; }).length;
    var freshnessScore = sources.length > 0 ? liveFreshCount / sources.length : 0;

    var evidenceFamilies = [];
    var conditions = brainState._activeConditions || [];
    function addFamily(fam) { if (evidenceFamilies.indexOf(fam) === -1) evidenceFamilies.push(fam); }

    for (var ci = 0; ci < conditions.length; ci++) {
      var cond = conditions[ci];
      // Climate
      if (cond === 'temperature_anomaly' || cond === 'climate_volatility' || cond === 'sea_level' || cond === 'carbon_budget_breach') {
        addFamily('climate_event');
      }
      if (cond === 'extreme_weather') {
        addFamily('weather_event');
        addFamily('climate_event');
      }
      // Biodiversity
      if (cond === 'species_decline' || cond === 'biodiversity_collapse' || cond === 'invasive_species' || cond === 'food_chain_imbalance' || cond === 'habitat_loss') {
        addFamily('biodiversity_event');
        addFamily('ecosystem_event');
      }
      // Ocean
      if (cond === 'marine_ph_decline' || cond === 'coral_bleaching' || cond === 'fishery_collapse' || cond === 'ocean_chemistry' || cond === 'marine_pollution' || cond === 'dead_zone') {
        addFamily('ocean_event');
      }
      // Forest
      if (cond === 'forest_loss' || cond === 'carbon_sink_decline' || cond === 'habitat_fragmentation' || cond === 'primary_forest_clearance') {
        addFamily('forest_event');
        addFamily('satellite_event');
      }
      // Pollution / toxicity
      if (cond === 'water_contamination' || cond === 'air_quality_degradation' || cond === 'toxic_spill' || cond === 'industrial_discharge' || cond === 'waste_accumulation' || cond === 'pfas_detected') {
        addFamily('pollution_event');
      }
      // Regulatory response
      if (cond === 'regulatory_action' || cond === 'emissions_rule' || cond === 'enforcement_event') addFamily('regulatory_event');
      if (cond === 'environment_high_stress' || cond === 'structural_stress') addFamily('structural_event');
      if (cond === 'macro_shock') addFamily('macro_event');
    }

    var validatedDiagnoses = [];
    for (var di = 0; di < diagnoses.length; di++) {
      var dx = diagnoses[di];
      var contract = EVIDENCE_CONTRACTS[dx.id];
      if (!contract) {
        validatedDiagnoses.push({ diagnosis: dx, valid: dx.active, blocked: false, reason: 'No contract defined' });
        continue;
      }
      var hasRequiredEvidence = false;
      for (var ri = 0; ri < contract.requiredFamilies.length; ri++) {
        if (evidenceFamilies.indexOf(contract.requiredFamilies[ri]) !== -1) { hasRequiredEvidence = true; break; }
      }
      var activatedByCatchAll = dx.active && !hasRequiredEvidence;
      var blocked = contract.catchAllBlocked && activatedByCatchAll;
      var valid = dx.active && !blocked;
      var reason = '';
      if (blocked) reason = 'Blocked: activated by stress catch-all without ' + contract.requiredFamilies.join('/') + ' evidence';
      else if (!dx.active) reason = 'Inactive: no matching conditions';
      else if (hasRequiredEvidence) reason = 'Valid: ' + contract.requiredFamilies.filter(function (f) { return evidenceFamilies.indexOf(f) !== -1; }).join(', ') + ' evidence present';
      validatedDiagnoses.push({ diagnosis: dx, valid: valid, blocked: blocked, reason: reason, contract: contract });
    }

    var deltas = [];
    if (_previousState) {
      var stressDelta = stress - (_previousState.stress || 0);
      if (Math.abs(stressDelta) > 0.02) deltas.push({ type: 'stress', direction: stressDelta > 0 ? 'rising' : 'falling', magnitude: Math.abs(stressDelta), detail: 'Stress moved to ' + Math.round(stress * 100) + '%' });
      var confDelta = confidence - (_previousState.confidence || 0);
      if (Math.abs(confDelta) > 0.05) deltas.push({ type: 'confidence', direction: confDelta > 0 ? 'rising' : 'falling', magnitude: Math.abs(confDelta), detail: 'Confidence at ' + Math.round(confidence * 100) + '%' });
      var prevSources = _previousState.sources || [];
      for (var si = 0; si < sources.length; si++) {
        var src = sources[si]; var prevSrc = null;
        for (var psi = 0; psi < prevSources.length; psi++) { if (prevSources[psi].name === src.name) { prevSrc = prevSources[psi]; break; } }
        if (prevSrc) {
          if (src.live && !prevSrc.live) deltas.push({ type: 'source', direction: 'recovered', detail: src.name + ' came back online' });
          if (!src.live && prevSrc.live) deltas.push({ type: 'source', direction: 'lost', detail: src.name + ' went offline' });
          if (src.stale && !prevSrc.stale) deltas.push({ type: 'source', direction: 'stale', detail: src.name + ' data is stale' });
        }
      }
      var prevDx = _previousState.validatedDiagnoses || [];
      for (var vdi = 0; vdi < validatedDiagnoses.length; vdi++) {
        var vdx = validatedDiagnoses[vdi]; var prevValid = false;
        for (var pdi = 0; pdi < prevDx.length; pdi++) { if (prevDx[pdi].diagnosis.id === vdx.diagnosis.id) { prevValid = prevDx[pdi].valid; break; } }
        if (vdx.valid && !prevValid) deltas.push({ type: 'diagnosis', direction: 'activated', detail: vdx.diagnosis.label + ' activated' });
        if (!vdx.valid && prevValid) deltas.push({ type: 'diagnosis', direction: 'deactivated', detail: vdx.diagnosis.label + ' deactivated' });
      }
    }

    var regime = 'stable';
    if (stress >= 0.70) regime = 'crisis';
    else if (stress >= 0.50) regime = 'elevated';
    else if (stress >= 0.30) regime = 'watchful';

    var rateOfChange = 0;
    if (_history.length >= 3) {
      var recent = _history.slice(-3);
      rateOfChange = (recent[2].stress - recent[0].stress) / 2;
    }
    var acceleration = 'stable';
    if (rateOfChange > 0.02) acceleration = 'accelerating';
    else if (rateOfChange < -0.02) acceleration = 'decelerating';

    _currentState = {
      stress: stress, confidence: confidence, freshnessScore: freshnessScore,
      sources: sources, liveFreshCount: liveFreshCount, liveStaleCount: liveStaleCount, deadCount: deadCount,
      evidenceFamilies: evidenceFamilies, evidenceCount: evidenceFamilies.length,
      validatedDiagnoses: validatedDiagnoses, deltas: deltas,
      regime: regime, rateOfChange: Math.round(rateOfChange * 1000) / 1000, acceleration: acceleration,
      cycleCount: _cycleCount, timestamp: now
    };

    _history.push({ stress: stress, confidence: confidence, timestamp: now });
    if (_history.length > MAX_HISTORY) _history.shift();

    return _currentState;
  }

  window.LIMENEnvironmentPulse = {
    computePulse: computePulse,
    getPulse: function () { return _currentState; },
    getPrevious: function () { return _previousState; },
    getHistory: function () { return _history.slice(); },
    getEvidenceContracts: function () { return EVIDENCE_CONTRACTS; },
    getFreshnessTTL: function () { return FRESHNESS_TTL; },
    getSourceTypes: function () { return SOURCE_TYPES; }
  };

  console.log('[SciencePulse] Loaded \u2014 live feed pulse engine ready');
})();
