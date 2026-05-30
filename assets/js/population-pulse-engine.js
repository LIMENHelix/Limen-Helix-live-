/**
 * population-pulse-engine.js — Live Feed Pulse Engine for Population Domain
 *
 * POPULATION DOMAIN ONLY. Evidence contracts, freshness TTLs, delta detection.
 * Self-gates: only runs when ?domain=population is in the URL.
 * Exposes: window.LIMENPopulationPulse
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var dom = params.get('domain');
  if (dom !== 'population') return;

  var FRESHNESS_TTL = {
    'census_index':         24 * 60 * 60 * 1000,    // UN Population, Census Bureau, Eurostat
    'fertility_feed':       24 * 60 * 60 * 1000,    // UNFPA, Guttmacher, CDC NCHS fertility data
    'migration_feed':       4 * 60 * 60 * 1000,     // UNHCR, IOM, CBP encounter data
    'aging_feed':           24 * 60 * 60 * 1000,    // WHO aging data, OECD Health at a Glance
    'urban_feed':           12 * 60 * 60 * 1000,    // UN Urbanization, World Bank urban
    'pandemic_feed':        2 * 60 * 60 * 1000,     // WHO outbreak, CDC MMWR, excess mortality
    'mortality_feed':       6 * 60 * 60 * 1000,     // Human Mortality Database, vital stats
    'policy_feed':          24 * 60 * 60 * 1000,    // Pro-natalist policy, immigration law
    'event_cluster':        30 * 60 * 1000,
    'structural':           24 * 60 * 60 * 1000,
    'default':              10 * 60 * 1000
  };

  var SOURCE_TYPES = {
    'World Bank Population':     'census_index',
    'UN Population':             'census_index',
    'UNFPA':                     'fertility_feed',
    'CDC NCHS':                  'fertility_feed',
    'WHO GHO':                   'pandemic_feed',
    'UNHCR Displacement':        'migration_feed',
    'IOM Migration':             'migration_feed',
    'IHME Population Health':    'pandemic_feed',
    'Guttmacher Institute':      'fertility_feed',
    'Census Bureau':             'census_index',
    'Our World in Data Pop':     'census_index',
    'Population Matters':        'policy_feed',
    'Event Registry':            'census_index',
    'RSS Population':            'census_index'
  };

  var EVIDENCE_CONTRACTS = {
    'POPULATION_COLLAPSE': {
      label: 'Population Collapse',
      requiredFamilies: ['fertility_event', 'workforce_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.fertility_feed,
      primaryIndicators: ['fertility_decline', 'workforce_imbalance', 'dependency_ratio', 'demographic_distortion'],
      secondaryConfirmation: ['aging_skew'],
      catchAllBlocked: true
    },
    'MASS_MIGRATION': {
      label: 'Mass Migration',
      requiredFamilies: ['migration_event', 'displacement_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.migration_feed,
      primaryIndicators: ['migration_surge', 'refugee_flow', 'border_pressure', 'displacement_event'],
      secondaryConfirmation: ['urban_influx'],
      catchAllBlocked: true
    },
    'AGING_CRISIS': {
      label: 'Aging Crisis',
      requiredFamilies: ['aging_event', 'healthcare_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.aging_feed,
      primaryIndicators: ['aging_skew', 'dependency_ratio', 'healthcare_overload', 'pension_strain'],
      secondaryConfirmation: ['workforce_imbalance'],
      catchAllBlocked: true
    },
    'URBANIZATION_OVERLOAD': {
      label: 'Urbanization Overload',
      requiredFamilies: ['urban_event', 'infrastructure_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.urban_feed,
      primaryIndicators: ['city_overcrowding', 'housing_shortage', 'infrastructure_strain', 'density_spike'],
      secondaryConfirmation: ['service_overload'],
      catchAllBlocked: true
    },
    'PANDEMIC_DEMOGRAPHIC_SHOCK': {
      label: 'Pandemic Demographic Shock',
      requiredFamilies: ['pandemic_event', 'mortality_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.pandemic_feed,
      primaryIndicators: ['disease_spread', 'mortality_anomaly', 'healthcare_overload', 'access_inequality'],
      secondaryConfirmation: [],
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
      // Population collapse
      if (cond === 'fertility_decline' || cond === 'workforce_imbalance' || cond === 'dependency_ratio' || cond === 'demographic_distortion') {
        addFamily('fertility_event');
        addFamily('workforce_event');
      }
      // Mass migration
      if (cond === 'migration_surge' || cond === 'refugee_flow' || cond === 'border_pressure' || cond === 'displacement_event' || cond === 'urban_influx') {
        addFamily('migration_event');
        addFamily('displacement_event');
      }
      // Aging crisis
      if (cond === 'aging_skew' || cond === 'dependency_ratio' || cond === 'healthcare_overload' || cond === 'pension_strain') {
        addFamily('aging_event');
        addFamily('healthcare_event');
      }
      // Urbanization overload
      if (cond === 'city_overcrowding' || cond === 'housing_shortage' || cond === 'infrastructure_strain' || cond === 'density_spike' || cond === 'service_overload') {
        addFamily('urban_event');
        addFamily('infrastructure_event');
      }
      // Pandemic demographic shock
      if (cond === 'disease_spread' || cond === 'mortality_anomaly' || cond === 'access_inequality') {
        addFamily('pandemic_event');
        addFamily('mortality_event');
      }
      if (cond === 'population_high_stress' || cond === 'structural_stress') addFamily('structural_event');
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

  window.LIMENPopulationPulse = {
    computePulse: computePulse,
    getPulse: function () { return _currentState; },
    getPrevious: function () { return _previousState; },
    getHistory: function () { return _history.slice(); },
    getEvidenceContracts: function () { return EVIDENCE_CONTRACTS; },
    getFreshnessTTL: function () { return FRESHNESS_TTL; },
    getSourceTypes: function () { return SOURCE_TYPES; }
  };

  console.log('[PopulationPulse] Loaded \u2014 live feed pulse engine ready');
})();
