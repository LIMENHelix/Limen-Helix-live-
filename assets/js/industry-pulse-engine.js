/**
 * environment-pulse-engine.js — Live Feed Pulse Engine for Industry Domain
 *
 * INDUSTRY DOMAIN ONLY. Evidence contracts, freshness TTLs, delta detection.
 * Self-gates: only runs when ?domain=industry is in the URL.
 * Exposes: window.LIMENIndustryPulse
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var dom = params.get('domain');
  if (dom !== 'industry') return;

  var FRESHNESS_TTL = {
    'pmi_index':          24 * 60 * 60 * 1000,    // ISM / S&P Global PMI (monthly)
    'capacity_index':     24 * 60 * 60 * 1000,    // FRED MCUMFN capacity utilization
    'labor_index':        24 * 60 * 60 * 1000,    // BLS JOLTS, CES manufacturing wages
    'recall_feed':        4 * 60 * 60 * 1000,     // NHTSA / CPSC / FDA recall RSS
    'safety_incident':    1 * 60 * 60 * 1000,     // PHMSA / NTSB / CSB incident feeds
    'strike_feed':        4 * 60 * 60 * 1000,     // UAW / USW / BLS strike data
    'regulatory_event':   24 * 60 * 60 * 1000,    // OSHA, EPA RMP, FDA 483 rulemakings
    'supply_feed':        6 * 60 * 60 * 1000,     // BLS PPI industrial, ISM supplier deliveries
    'event_cluster':      30 * 60 * 1000,
    'structural':         24 * 60 * 60 * 1000,
    'default':            10 * 60 * 1000
  };

  var SOURCE_TYPES = {
    'ISM Manufacturing PMI':       'pmi_index',
    'S&P Global US Manufacturing': 'pmi_index',
    'FRED MCUMFN Capacity':        'capacity_index',
    'FRED IndProd':                'capacity_index',
    'BLS Manufacturing Wages':     'labor_index',
    'BLS JOLTS Manufacturing':     'labor_index',
    'NHTSA Recalls':               'recall_feed',
    'CPSC Recalls':                'recall_feed',
    'FDA MDR Recalls':             'recall_feed',
    'PHMSA Incidents':             'safety_incident',
    'NTSB Accident':               'safety_incident',
    'CSB Investigations':          'safety_incident',
    'OSHA Fatality Reports':       'safety_incident',
    'UAW Strike Tracker':          'strike_feed',
    'BLS Work Stoppages':          'strike_feed',
    'BLS Industrial PPI':          'supply_feed',
    'ISM Supplier Deliveries':     'supply_feed',
    'EPA RMP':                     'regulatory_event'
  };

  var EVIDENCE_CONTRACTS = {
    'SUPPLY_CHAIN_COLLAPSE': {
      label: 'Supply Chain Collapse',
      requiredFamilies: ['supply_event', 'pmi_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.supply_feed,
      primaryIndicators: ['input_shortage', 'supplier_constraint', 'component_scarcity', 'critical_part_delay'],
      secondaryConfirmation: ['capacity_constraint', 'production_halt'],
      catchAllBlocked: true
    },
    'AUTOMATION_FAILURE': {
      label: 'Automation Failure',
      requiredFamilies: ['capacity_event', 'pmi_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.capacity_index,
      primaryIndicators: ['equipment_failure', 'automation_breakdown', 'capacity_constraint', 'production_halt'],
      secondaryConfirmation: ['maintenance_backlog'],
      catchAllBlocked: true
    },
    'TOXIC_SPILL': {
      label: 'Toxic Spill',
      requiredFamilies: ['safety_event', 'regulatory_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.safety_incident,
      primaryIndicators: ['industrial_incident', 'contamination_event', 'safety_failure'],
      secondaryConfirmation: [],
      catchAllBlocked: true
    },
    'QUALITY_CRISIS': {
      label: 'Quality Crisis',
      requiredFamilies: ['recall_event', 'regulatory_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.recall_feed,
      primaryIndicators: ['quality_defect', 'recall_risk', 'inspection_failure', 'reliability_decline'],
      secondaryConfirmation: [],
      catchAllBlocked: true
    },
    'WORKFORCE_SHORTAGE': {
      label: 'Workforce Shortage',
      requiredFamilies: ['labor_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.labor_index,
      primaryIndicators: ['labor_shortage', 'workforce_gap', 'contractor_limit', 'labor_stoppage'],
      secondaryConfirmation: ['structural_stress'],
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
      // Supply chain
      if (cond === 'input_shortage' || cond === 'supplier_constraint' || cond === 'component_scarcity' || cond === 'critical_part_delay') {
        addFamily('supply_event');
        addFamily('pmi_event');
      }
      // Automation / capacity
      if (cond === 'equipment_failure' || cond === 'automation_breakdown' || cond === 'capacity_constraint' || cond === 'production_halt' || cond === 'maintenance_backlog') {
        addFamily('capacity_event');
        addFamily('pmi_event');
      }
      // Safety / incident
      if (cond === 'industrial_incident' || cond === 'contamination_event' || cond === 'safety_failure') {
        addFamily('safety_event');
        addFamily('regulatory_event');
      }
      // Quality / recall
      if (cond === 'quality_defect' || cond === 'recall_risk' || cond === 'inspection_failure' || cond === 'reliability_decline') {
        addFamily('recall_event');
        addFamily('regulatory_event');
      }
      // Labor / workforce
      if (cond === 'labor_shortage' || cond === 'workforce_gap' || cond === 'contractor_limit' || cond === 'labor_stoppage') {
        addFamily('labor_event');
      }
      if (cond === 'industry_high_stress' || cond === 'structural_stress') addFamily('structural_event');
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

  window.LIMENIndustryPulse = {
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
