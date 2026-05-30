/**
 * trade-pulse-engine.js — Live Feed Pulse Engine for Trade / Supply Chain Domain
 *
 * TRADE DOMAIN ONLY. Evidence contracts, freshness TTLs, delta detection.
 * Self-gates: only runs when ?domain=supplyChain or ?domain=trade is in the URL.
 * Exposes: window.LIMENTradePulse
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var dom = params.get('domain');
  if (dom !== 'supplyChain' && dom !== 'trade') return;

  var FRESHNESS_TTL = {
    'freight_index':     5 * 60 * 1000,
    'event_cluster':     30 * 60 * 1000,
    'structural':        24 * 60 * 60 * 1000,
    'default':           10 * 60 * 1000
  };

  var SOURCE_TYPES = {
    'BLS Freight PPI':    'freight_index',
    'RSS Supply Chain':   'event_cluster'
  };

  var EVIDENCE_CONTRACTS = {
    'SHIPPING_CRISIS': {
      label: 'Shipping Crisis',
      requiredFamilies: ['freight_event', 'capacity_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.freight_index,
      primaryIndicators: ['freight_cost_spike', 'container_shortage', 'carrier_capacity'],
      secondaryConfirmation: ['shipping_delay'],
      catchAllBlocked: true
    },
    'PORT_BLOCKADE': {
      label: 'Port Blockade',
      requiredFamilies: ['port_event', 'route_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['port_congestion', 'route_constraint', 'chokepoint'],
      secondaryConfirmation: ['port_closure', 'shipping_delay'],
      catchAllBlocked: true
    },
    'SUPPLY_CHAIN_COLLAPSE': {
      label: 'Supply Chain Collapse',
      requiredFamilies: ['supply_event', 'structural_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['shortage', 'sourcing_disruption', 'critical_material'],
      secondaryConfirmation: ['production_halt', 'structural_stress'],
      catchAllBlocked: false
    },
    'TRADE_WAR': {
      label: 'Trade War',
      requiredFamilies: ['policy_event', 'sanctions_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['tariff_escalation', 'sanctions', 'trade_restriction'],
      secondaryConfirmation: ['retaliatory_measures', 'export_ban'],
      catchAllBlocked: true
    },
    'CUSTOMS_DISRUPTION': {
      label: 'Customs Disruption',
      requiredFamilies: ['customs_event', 'regulatory_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['customs_delay', 'clearance_failure', 'regulatory_friction'],
      secondaryConfirmation: ['documentation_backlog'],
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
        age: age, ageLabel: age < 60000 ? Math.round(age / 1000) + 's' : age < 3600000 ? Math.round(age / 60000) + 'm' : Math.round(age / 3600000) + 'h',
        ttl: ttl, sourceType: sourceType, label: f.label || ''
      });
    }

    var liveFreshCount = sources.filter(function (s) { return s.live && s.fresh; }).length;
    var liveStaleCount = sources.filter(function (s) { return s.stale; }).length;
    var deadCount = sources.filter(function (s) { return !s.live; }).length;
    var freshnessScore = sources.length > 0 ? liveFreshCount / sources.length : 0;

    var evidenceFamilies = [];
    var conditions = brainState._activeConditions || [];
    for (var ci = 0; ci < conditions.length; ci++) {
      var cond = conditions[ci];
      if (cond === 'freight_cost_spike' || cond === 'carrier_capacity' || cond === 'container_shortage') {
        if (evidenceFamilies.indexOf('freight_event') === -1) evidenceFamilies.push('freight_event');
        if (evidenceFamilies.indexOf('capacity_event') === -1) evidenceFamilies.push('capacity_event');
      }
      if (cond === 'port_congestion' || cond === 'port_closure' || cond === 'route_constraint' || cond === 'chokepoint') {
        if (evidenceFamilies.indexOf('port_event') === -1) evidenceFamilies.push('port_event');
        if (evidenceFamilies.indexOf('route_event') === -1) evidenceFamilies.push('route_event');
      }
      if (cond === 'shortage' || cond === 'sourcing_disruption' || cond === 'critical_material' || cond === 'production_halt') {
        if (evidenceFamilies.indexOf('supply_event') === -1) evidenceFamilies.push('supply_event');
      }
      if (cond === 'structural_stress' || cond === 'supply_high_stress') {
        if (evidenceFamilies.indexOf('structural_event') === -1) evidenceFamilies.push('structural_event');
      }
      if (cond === 'tariff_escalation' || cond === 'sanctions' || cond === 'trade_restriction' || cond === 'export_ban' || cond === 'retaliatory_measures') {
        if (evidenceFamilies.indexOf('policy_event') === -1) evidenceFamilies.push('policy_event');
        if (evidenceFamilies.indexOf('sanctions_event') === -1) evidenceFamilies.push('sanctions_event');
      }
      if (cond === 'customs_delay' || cond === 'clearance_failure' || cond === 'regulatory_friction' || cond === 'documentation_backlog') {
        if (evidenceFamilies.indexOf('customs_event') === -1) evidenceFamilies.push('customs_event');
        if (evidenceFamilies.indexOf('regulatory_event') === -1) evidenceFamilies.push('regulatory_event');
      }
      if (cond === 'shipping_delay') {
        if (evidenceFamilies.indexOf('freight_event') === -1) evidenceFamilies.push('freight_event');
      }
      if (cond === 'macro_shock') {
        if (evidenceFamilies.indexOf('macro_event') === -1) evidenceFamilies.push('macro_event');
      }
      if (cond === 'STRAIT_DISRUPTION' || cond === 'PORT_DISRUPTION') {
        if (evidenceFamilies.indexOf('route_event') === -1) evidenceFamilies.push('route_event');
        if (evidenceFamilies.indexOf('port_event') === -1) evidenceFamilies.push('port_event');
      }
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
    if (_history.length >= 3) { var recent = _history.slice(-3); rateOfChange = (recent[2].stress - recent[0].stress) / 2; }
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

  window.LIMENTradePulse = {
    computePulse: computePulse,
    getPulse: function () { return _currentState; },
    getPrevious: function () { return _previousState; },
    getHistory: function () { return _history.slice(); },
    getEvidenceContracts: function () { return EVIDENCE_CONTRACTS; },
    getFreshnessTTL: function () { return FRESHNESS_TTL; },
    getSourceTypes: function () { return SOURCE_TYPES; }
  };

  console.log('[TradePulse] Loaded \u2014 live feed pulse engine ready');
})();
