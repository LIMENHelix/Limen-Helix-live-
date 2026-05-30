/**
 * agriculture-pulse-engine.js — Live Feed Pulse Engine for Agriculture Domain
 *
 * AGRICULTURE DOMAIN ONLY. Computes real-time deltas between feed snapshots.
 * No fake motion. No static templates. Every output is causally grounded.
 *
 * Responsibilities:
 *   1. Track current vs previous feed state
 *   2. Detect meaningful deltas (price changes, source availability)
 *   3. Classify evidence families per diagnosis
 *   4. Enforce strict freshness TTLs
 *   5. Compute event novelty, acceleration, regime classification
 *   6. Produce "what changed" first-class state
 *
 * Self-gates: only runs when ?domain=agriculture is in the URL.
 * Exposes: window.LIMENAgriculturePulse
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  if (params.get('domain') !== 'agriculture') return;

  // ══════════════════════════════════════════════════════════════════════
  // FRESHNESS TTL RULES — by feed type
  // ══════════════════════════════════════════════════════════════════════

  var FRESHNESS_TTL = {
    'commodity_price':   5 * 60 * 1000,       // 5 minutes — grain/commodity prices
    'weather_event':     30 * 60 * 1000,       // 30 minutes — weather/drought events
    'market_report':     24 * 60 * 60 * 1000,  // 24 hours — USDA/FAO structural
    'supply_event':      30 * 60 * 1000,       // 30 minutes — supply chain events
    'pest_alert':        60 * 60 * 1000,       // 1 hour — pest/disease alerts
    'default':           10 * 60 * 1000        // 10 minutes
  };

  // Source → feed type classification
  var SOURCE_TYPES = {
    'USDA WASDE':        'market_report',
    'USDA Crop Progress': 'market_report',
    'FAO Food Price':    'market_report',
    'Corn Futures':      'commodity_price',
    'Wheat Futures':     'commodity_price',
    'Soybean Futures':   'commodity_price',
    'Fertilizer Index':  'commodity_price',
    'Drought Monitor':   'weather_event',
    'NOAA Precipitation': 'weather_event'
  };

  // ══════════════════════════════════════════════════════════════════════
  // DIAGNOSIS EVIDENCE CONTRACTS — what evidence each diagnosis REQUIRES
  // ══════════════════════════════════════════════════════════════════════

  var EVIDENCE_CONTRACTS = {
    'CASH_FLOW_CRISIS': {
      label: 'Cash Flow Crisis',
      requiredFamilies: ['cost_event', 'margin_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.commodity_price,
      primaryIndicators: ['cash_stress', 'margin_compression', 'input_cost_spike'],
      secondaryConfirmation: ['debt_service', 'commodity_price_drop'],
      downgradeRule: 'If input costs normalize and margins recover, downgrade to WATCH.',
      deactivationRule: 'No cost or margin evidence within freshness window.',
      catchAllBlocked: true
    },
    'SUPPLY_CHAIN_BREAKDOWN': {
      label: 'Supply Chain Breakdown',
      requiredFamilies: ['logistics_event', 'distribution_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.supply_event,
      primaryIndicators: ['supply_disruption', 'logistics_failure', 'cold_chain_break'],
      secondaryConfirmation: ['distribution_gap'],
      downgradeRule: 'If logistics normalize, downgrade to WATCH.',
      deactivationRule: 'No logistics or distribution evidence within freshness window.',
      catchAllBlocked: true
    },
    'DROUGHT': {
      label: 'Drought / Water Stress',
      requiredFamilies: ['weather_event', 'water_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.weather_event,
      primaryIndicators: ['water_stress', 'precipitation_deficit', 'soil_moisture_low'],
      secondaryConfirmation: ['irrigation_constraint', 'weather_extreme'],
      downgradeRule: 'If precipitation returns to normal, downgrade.',
      deactivationRule: 'No weather or water evidence within freshness window.',
      catchAllBlocked: true
    },
    'MARKET_COLLAPSE': {
      label: 'Market Collapse',
      requiredFamilies: ['commodity_event', 'trade_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.commodity_price,
      primaryIndicators: ['commodity_price_drop', 'demand_destruction', 'export_restriction'],
      secondaryConfirmation: ['oversupply', 'macro_shock'],
      downgradeRule: 'If prices stabilize, downgrade to WATCH.',
      deactivationRule: 'No commodity or trade evidence within freshness window.',
      catchAllBlocked: true
    },
    'EQUIPMENT_FAILURE': {
      label: 'Equipment / Infrastructure Failure',
      requiredFamilies: ['equipment_event', 'capacity_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.supply_event,
      primaryIndicators: ['equipment_downtime', 'parts_shortage', 'maintenance_backlog'],
      secondaryConfirmation: ['capacity_constraint'],
      downgradeRule: 'If equipment restored, downgrade.',
      deactivationRule: 'No equipment or capacity evidence within freshness window.',
      catchAllBlocked: true
    },
    'PEST_OUTBREAK': {
      label: 'Pest / Disease Outbreak',
      requiredFamilies: ['biological_event', 'yield_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.pest_alert,
      primaryIndicators: ['pest_detected', 'disease_detected', 'yield_loss'],
      secondaryConfirmation: ['quarantine_risk', 'biological_threat'],
      downgradeRule: 'If pest/disease contained, downgrade.',
      deactivationRule: 'No biological or yield evidence within freshness window.',
      catchAllBlocked: true
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // STATE TRACKING
  // ══════════════════════════════════════════════════════════════════════

  var _previousState = null;
  var _currentState = null;
  var _cycleCount = 0;
  var _history = [];
  var MAX_HISTORY = 20;

  // ══════════════════════════════════════════════════════════════════════
  // PULSE COMPUTATION
  // ══════════════════════════════════════════════════════════════════════

  function computePulse(brainState) {
    if (!brainState) return null;
    _cycleCount++;

    _previousState = _currentState;

    var feeds = brainState.feeds || [];
    var stress = brainState.stress || 0;
    var confidence = brainState.confidence || 0;
    var diagnoses = brainState.diagnoses || [];
    var now = Date.now();

    // ── Source analysis ──
    var sources = [];
    for (var fi = 0; fi < feeds.length; fi++) {
      var f = feeds[fi];
      var sourceType = SOURCE_TYPES[f.name] || 'default';
      var ttl = FRESHNESS_TTL[sourceType] || FRESHNESS_TTL['default'];
      var age = f.updated ? (now - f.updated) : Infinity;
      var fresh = age < ttl;
      var stale = !fresh && f.live;

      sources.push({
        name: f.name,
        value: f.value,
        live: f.live,
        fresh: fresh,
        stale: stale,
        age: age,
        ageLabel: age < 60000 ? Math.round(age / 1000) + 's' : age < 3600000 ? Math.round(age / 60000) + 'm' : Math.round(age / 3600000) + 'h',
        ttl: ttl,
        sourceType: sourceType,
        label: f.label || ''
      });
    }

    var liveFreshCount = sources.filter(function (s) { return s.live && s.fresh; }).length;
    var liveStaleCount = sources.filter(function (s) { return s.stale; }).length;
    var deadCount = sources.filter(function (s) { return !s.live; }).length;

    var freshnessScore = sources.length > 0 ? liveFreshCount / sources.length : 0;

    // ── Evidence families present ──
    var evidenceFamilies = [];
    var conditions = brainState._activeConditions || [];
    for (var ci = 0; ci < conditions.length; ci++) {
      var cond = conditions[ci];
      if (cond === 'cash_stress' || cond === 'margin_compression' || cond === 'input_cost_spike' || cond === 'debt_service') {
        if (evidenceFamilies.indexOf('cost_event') === -1) evidenceFamilies.push('cost_event');
        if (evidenceFamilies.indexOf('margin_event') === -1) evidenceFamilies.push('margin_event');
      }
      if (cond === 'supply_disruption' || cond === 'logistics_failure' || cond === 'cold_chain_break' || cond === 'distribution_gap') {
        if (evidenceFamilies.indexOf('logistics_event') === -1) evidenceFamilies.push('logistics_event');
        if (evidenceFamilies.indexOf('distribution_event') === -1) evidenceFamilies.push('distribution_event');
      }
      if (cond === 'water_stress' || cond === 'precipitation_deficit' || cond === 'soil_moisture_low' || cond === 'irrigation_constraint') {
        if (evidenceFamilies.indexOf('weather_event') === -1) evidenceFamilies.push('weather_event');
        if (evidenceFamilies.indexOf('water_event') === -1) evidenceFamilies.push('water_event');
      }
      if (cond === 'commodity_price_drop' || cond === 'demand_destruction' || cond === 'export_restriction' || cond === 'oversupply') {
        if (evidenceFamilies.indexOf('commodity_event') === -1) evidenceFamilies.push('commodity_event');
        if (evidenceFamilies.indexOf('trade_event') === -1) evidenceFamilies.push('trade_event');
      }
      if (cond === 'equipment_downtime' || cond === 'parts_shortage' || cond === 'maintenance_backlog' || cond === 'capacity_constraint') {
        if (evidenceFamilies.indexOf('equipment_event') === -1) evidenceFamilies.push('equipment_event');
        if (evidenceFamilies.indexOf('capacity_event') === -1) evidenceFamilies.push('capacity_event');
      }
      if (cond === 'pest_detected' || cond === 'disease_detected' || cond === 'yield_loss' || cond === 'quarantine_risk' || cond === 'biological_threat') {
        if (evidenceFamilies.indexOf('biological_event') === -1) evidenceFamilies.push('biological_event');
        if (evidenceFamilies.indexOf('yield_event') === -1) evidenceFamilies.push('yield_event');
      }
      if (cond === 'weather_extreme') {
        if (evidenceFamilies.indexOf('weather_event') === -1) evidenceFamilies.push('weather_event');
      }
      if (cond === 'macro_shock') {
        if (evidenceFamilies.indexOf('macro_event') === -1) evidenceFamilies.push('macro_event');
      }
    }

    // ── Validate diagnoses against evidence contracts ──
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
        if (evidenceFamilies.indexOf(contract.requiredFamilies[ri]) !== -1) {
          hasRequiredEvidence = true;
          break;
        }
      }

      var activatedByCatchAll = dx.active && !hasRequiredEvidence;
      var blocked = contract.catchAllBlocked && activatedByCatchAll;
      var valid = dx.active && !blocked;
      var reason = '';
      if (blocked) {
        reason = 'Blocked: activated by stress catch-all without ' + contract.requiredFamilies.join('/') + ' evidence';
      } else if (!dx.active) {
        reason = 'Inactive: no matching conditions';
      } else if (hasRequiredEvidence) {
        reason = 'Valid: ' + contract.requiredFamilies.filter(function (f) { return evidenceFamilies.indexOf(f) !== -1; }).join(', ') + ' evidence present';
      }

      validatedDiagnoses.push({ diagnosis: dx, valid: valid, blocked: blocked, reason: reason, contract: contract });
    }

    // ── Delta detection ──
    var deltas = [];
    if (_previousState) {
      var stressDelta = stress - (_previousState.stress || 0);
      if (Math.abs(stressDelta) > 0.02) {
        deltas.push({
          type: 'stress',
          direction: stressDelta > 0 ? 'rising' : 'falling',
          magnitude: Math.abs(stressDelta),
          detail: 'Stress ' + (stressDelta > 0 ? 'rose' : 'fell') + ' from ' + Math.round((_previousState.stress || 0) * 100) + '% to ' + Math.round(stress * 100) + '%'
        });
      }

      var confDelta = confidence - (_previousState.confidence || 0);
      if (Math.abs(confDelta) > 0.05) {
        deltas.push({
          type: 'confidence',
          direction: confDelta > 0 ? 'rising' : 'falling',
          magnitude: Math.abs(confDelta),
          detail: 'Confidence ' + (confDelta > 0 ? 'increased' : 'decreased') + ' to ' + Math.round(confidence * 100) + '%'
        });
      }

      var prevSources = _previousState.sources || [];
      for (var si = 0; si < sources.length; si++) {
        var src = sources[si];
        var prevSrc = null;
        for (var psi = 0; psi < prevSources.length; psi++) {
          if (prevSources[psi].name === src.name) { prevSrc = prevSources[psi]; break; }
        }
        if (prevSrc) {
          if (src.live && !prevSrc.live) deltas.push({ type: 'source', direction: 'recovered', detail: src.name + ' came back online' });
          if (!src.live && prevSrc.live) deltas.push({ type: 'source', direction: 'lost', detail: src.name + ' went offline' });
          if (src.stale && !prevSrc.stale) deltas.push({ type: 'source', direction: 'stale', detail: src.name + ' data is stale (age: ' + src.ageLabel + ')' });
          if (src.value && prevSrc.value && Math.abs(src.value - prevSrc.value) > 0.5) {
            var priceDelta = src.value - prevSrc.value;
            deltas.push({ type: 'price', direction: priceDelta > 0 ? 'up' : 'down', magnitude: Math.abs(priceDelta), detail: src.name + ': $' + prevSrc.value.toFixed(2) + ' \u2192 $' + src.value.toFixed(2) + ' (' + (priceDelta > 0 ? '+' : '') + priceDelta.toFixed(2) + ')' });
          }
        }
      }

      var prevDx = _previousState.validatedDiagnoses || [];
      for (var vdi = 0; vdi < validatedDiagnoses.length; vdi++) {
        var vdx = validatedDiagnoses[vdi];
        var prevValid = false;
        for (var pdi = 0; pdi < prevDx.length; pdi++) {
          if (prevDx[pdi].diagnosis.id === vdx.diagnosis.id) { prevValid = prevDx[pdi].valid; break; }
        }
        if (vdx.valid && !prevValid) deltas.push({ type: 'diagnosis', direction: 'activated', detail: vdx.diagnosis.label + ' activated (' + vdx.reason + ')' });
        if (!vdx.valid && prevValid) deltas.push({ type: 'diagnosis', direction: 'deactivated', detail: vdx.diagnosis.label + ' deactivated (' + vdx.reason + ')' });
      }
    }

    // ── Regime classification ──
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
      stress: stress,
      confidence: confidence,
      freshnessScore: freshnessScore,
      sources: sources,
      liveFreshCount: liveFreshCount,
      liveStaleCount: liveStaleCount,
      deadCount: deadCount,
      evidenceFamilies: evidenceFamilies,
      evidenceCount: evidenceFamilies.length,
      validatedDiagnoses: validatedDiagnoses,
      deltas: deltas,
      regime: regime,
      rateOfChange: Math.round(rateOfChange * 1000) / 1000,
      acceleration: acceleration,
      cycleCount: _cycleCount,
      timestamp: now
    };

    _history.push({ stress: stress, confidence: confidence, timestamp: now });
    if (_history.length > MAX_HISTORY) _history.shift();

    return _currentState;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  window.LIMENAgriculturePulse = {
    computePulse: computePulse,
    getPulse: function () { return _currentState; },
    getPrevious: function () { return _previousState; },
    getHistory: function () { return _history.slice(); },
    getEvidenceContracts: function () { return EVIDENCE_CONTRACTS; },
    getFreshnessTTL: function () { return FRESHNESS_TTL; },
    getSourceTypes: function () { return SOURCE_TYPES; }
  };

  console.log('[AgriculturePulse] Loaded — live feed pulse engine ready');

})();
