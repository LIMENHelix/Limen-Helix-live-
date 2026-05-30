/**
 * infrastructure-pulse-engine.js — Live Feed Pulse Engine for Infrastructure Domain
 *
 * INFRASTRUCTURE DOMAIN ONLY. Computes real-time deltas between feed snapshots.
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
 * Self-gates: only runs when ?domain=infrastructure is in the URL.
 * Exposes: window.LIMENInfrastructurePulse
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  if (params.get('domain') !== 'infrastructure') return;

  // ══════════════════════════════════════════════════════════════════════
  // FRESHNESS TTL RULES — by feed type
  // ══════════════════════════════════════════════════════════════════════

  var FRESHNESS_TTL = {
    'market_price':      5 * 60 * 1000,   // 5 minutes — price feeds
    'event_cluster':     30 * 60 * 1000,  // 30 minutes — defense/ingest events
    'structural':        24 * 60 * 60 * 1000, // 24 hours — structural data
    'default':           10 * 60 * 1000   // 10 minutes
  };

  // Source → feed type classification
  var SOURCE_TYPES = {
    'Construction Index':     'structural',      // Structural — construction activity index
    'Transportation Stress':  'structural',      // Structural — transportation system stress
    'Grid Capacity':          'market_price',    // Near-real-time — grid capacity metrics
    'Federal Infrastructure': 'structural'       // Structural — federal infrastructure data
  };

  // ══════════════════════════════════════════════════════════════════════
  // DIAGNOSIS EVIDENCE CONTRACTS — what evidence each diagnosis REQUIRES
  // No diagnosis may activate without meeting its contract.
  // ══════════════════════════════════════════════════════════════════════

  var EVIDENCE_CONTRACTS = {
    'GRID_DEGRADATION': {
      label: 'Grid Infrastructure Degradation',
      requiredFamilies: ['grid_event', 'utility_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['grid_stress', 'utility_failure', 'aging_infrastructure'],
      secondaryConfirmation: ['capacity_constraint', 'maintenance_critical'],
      downgradeRule: 'If grid event resolves and no secondary confirmation, downgrade.',
      deactivationRule: 'No grid or utility evidence within freshness window.',
      catchAllBlocked: true
    },
    'SUPPLY_CHAIN_BOTTLENECK': {
      label: 'Construction Supply Chain Bottleneck',
      requiredFamilies: ['materials_event', 'logistics_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['materials_shortage', 'construction_delay'],
      secondaryConfirmation: ['demand_surge', 'congestion'],
      downgradeRule: 'If materials availability normalizes, downgrade to WATCH.',
      deactivationRule: 'No materials/logistics evidence within freshness window.',
      catchAllBlocked: true
    },
    'CAPACITY_OVERLOAD': {
      label: 'Infrastructure Capacity Overload',
      requiredFamilies: ['capacity_event', 'demand_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['capacity_constraint', 'demand_surge', 'congestion'],
      secondaryConfirmation: ['grid_stress', 'maintenance_critical'],
      downgradeRule: 'If demand normalizes and capacity stabilizes, downgrade.',
      deactivationRule: 'No capacity or demand evidence within freshness window.',
      catchAllBlocked: true
    },
    'FUNDING_COLLAPSE': {
      label: 'Infrastructure Funding Collapse',
      requiredFamilies: ['fiscal_event', 'policy_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.structural,
      primaryIndicators: ['funding_gap', 'budget_cut', 'bond_market_stress'],
      secondaryConfirmation: ['maintenance_critical', 'deferred_maintenance'],
      downgradeRule: 'If funding is restored or policy stabilizes, downgrade to WATCH.',
      deactivationRule: 'No fiscal or policy evidence within freshness window.',
      catchAllBlocked: true
    },
    'MAINTENANCE_DEFICIT': {
      label: 'Deferred Maintenance Critical Threshold',
      requiredFamilies: ['maintenance_event', 'asset_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.structural,
      primaryIndicators: ['maintenance_critical', 'asset_deterioration', 'deferred_maintenance'],
      secondaryConfirmation: ['aging_infrastructure', 'funding_gap'],
      downgradeRule: 'If maintenance backlog decreases and assets stabilize, downgrade.',
      deactivationRule: 'No maintenance or asset evidence within freshness window.',
      catchAllBlocked: true
    },
    'CYBER_PHYSICAL_ATTACK': {
      label: 'Cyber-Physical Infrastructure Attack',
      requiredFamilies: ['cyber_event', 'physical_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['CYBER_ATTACK', 'INFRASTRUCTURE_ATTACK', 'SCADA_BREACH'],
      secondaryConfirmation: ['grid_stress', 'utility_failure'],
      downgradeRule: 'If threat is neutralized and no secondary confirmation, downgrade.',
      deactivationRule: 'No cyber or physical attack evidence within freshness window.',
      catchAllBlocked: true
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // STATE TRACKING — previous vs current
  // ══════════════════════════════════════════════════════════════════════

  var _previousState = null;
  var _currentState = null;
  var _cycleCount = 0;
  var _history = [];          // last 20 snapshots for trend
  var MAX_HISTORY = 20;

  // ══════════════════════════════════════════════════════════════════════
  // PULSE COMPUTATION — runs every brain cycle
  // ══════════════════════════════════════════════════════════════════════

  function computePulse(brainState) {
    if (!brainState) return null;
    _cycleCount++;

    _previousState = _currentState;

    var feeds = brainState.feeds || [];
    var stress = brainState.stress || 0;
    var confidence = brainState.confidence || 0;
    var diagnoses = brainState.diagnoses || [];
    var opportunities = brainState.opportunities || [];
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

    // ── Freshness score (0-1) ──
    var freshnessScore = sources.length > 0 ? liveFreshCount / sources.length : 0;

    // ── Evidence families present ──
    var evidenceFamilies = [];
    var conditions = brainState._activeConditions || [];
    // Classify conditions into evidence families
    for (var ci = 0; ci < conditions.length; ci++) {
      var cond = conditions[ci];
      // Grid / Utility events
      if (cond === 'grid_stress' || cond === 'utility_failure' || cond === 'aging_infrastructure') {
        if (evidenceFamilies.indexOf('grid_event') === -1) evidenceFamilies.push('grid_event');
        if (evidenceFamilies.indexOf('utility_event') === -1) evidenceFamilies.push('utility_event');
      }
      // Materials / Logistics events
      if (cond === 'materials_shortage' || cond === 'construction_delay') {
        if (evidenceFamilies.indexOf('materials_event') === -1) evidenceFamilies.push('materials_event');
        if (evidenceFamilies.indexOf('logistics_event') === -1) evidenceFamilies.push('logistics_event');
      }
      // Capacity / Demand events
      if (cond === 'capacity_constraint' || cond === 'demand_surge' || cond === 'congestion') {
        if (evidenceFamilies.indexOf('capacity_event') === -1) evidenceFamilies.push('capacity_event');
        if (evidenceFamilies.indexOf('demand_event') === -1) evidenceFamilies.push('demand_event');
      }
      // Fiscal / Policy events
      if (cond === 'funding_gap' || cond === 'budget_cut' || cond === 'bond_market_stress') {
        if (evidenceFamilies.indexOf('fiscal_event') === -1) evidenceFamilies.push('fiscal_event');
        if (evidenceFamilies.indexOf('policy_event') === -1) evidenceFamilies.push('policy_event');
      }
      // Maintenance / Asset events
      if (cond === 'maintenance_critical' || cond === 'asset_deterioration' || cond === 'deferred_maintenance') {
        if (evidenceFamilies.indexOf('maintenance_event') === -1) evidenceFamilies.push('maintenance_event');
        if (evidenceFamilies.indexOf('asset_event') === -1) evidenceFamilies.push('asset_event');
      }
      // Cyber / Physical attack events
      if (cond === 'CYBER_ATTACK' || cond === 'INFRASTRUCTURE_ATTACK' || cond === 'SCADA_BREACH') {
        if (evidenceFamilies.indexOf('cyber_event') === -1) evidenceFamilies.push('cyber_event');
        if (evidenceFamilies.indexOf('physical_event') === -1) evidenceFamilies.push('physical_event');
      }
      // Transmission / interconnection / substation — grid evidence
      if (cond === 'transmission_congestion' || cond === 'interconnection_delay' || cond === 'substation_bottleneck' || cond === 'transformer_backlog') {
        if (evidenceFamilies.indexOf('grid_event') === -1) evidenceFamilies.push('grid_event');
        if (evidenceFamilies.indexOf('utility_event') === -1) evidenceFamilies.push('utility_event');
      }
      // Data center demand / peak curtailment / cooling — capacity evidence
      if (cond === 'datacenter_demand' || cond === 'peak_curtailment' || cond === 'cooling_infrastructure_strain' || cond === 'self_generation_strain') {
        if (evidenceFamilies.indexOf('capacity_event') === -1) evidenceFamilies.push('capacity_event');
        if (evidenceFamilies.indexOf('demand_event') === -1) evidenceFamilies.push('demand_event');
      }
      // Transformer/interconnection delays also count as asset events
      if (cond === 'transformer_backlog' || cond === 'substation_bottleneck') {
        if (evidenceFamilies.indexOf('maintenance_event') === -1) evidenceFamilies.push('maintenance_event');
        if (evidenceFamilies.indexOf('asset_event') === -1) evidenceFamilies.push('asset_event');
      }
      // Fiscal crisis
      if (cond === 'FISCAL_CRISIS') {
        if (evidenceFamilies.indexOf('fiscal_event') === -1) evidenceFamilies.push('fiscal_event');
      }
      // Macro shock
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

      // Check if diagnosis was activated only by catch-all (stress-derived)
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
      // Stress delta
      var stressDelta = stress - (_previousState.stress || 0);
      if (Math.abs(stressDelta) > 0.02) {
        deltas.push({
          type: 'stress',
          direction: stressDelta > 0 ? 'rising' : 'falling',
          magnitude: Math.abs(stressDelta),
          detail: 'Stress ' + (stressDelta > 0 ? 'rose' : 'fell') + ' from ' + Math.round((_previousState.stress || 0) * 100) + '% to ' + Math.round(stress * 100) + '%'
        });
      }

      // Confidence delta
      var confDelta = confidence - (_previousState.confidence || 0);
      if (Math.abs(confDelta) > 0.05) {
        deltas.push({
          type: 'confidence',
          direction: confDelta > 0 ? 'rising' : 'falling',
          magnitude: Math.abs(confDelta),
          detail: 'Confidence ' + (confDelta > 0 ? 'increased' : 'decreased') + ' to ' + Math.round(confidence * 100) + '%'
        });
      }

      // Source availability changes
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
          // Value change
          if (src.value && prevSrc.value && Math.abs(src.value - prevSrc.value) > 0.5) {
            var valueDelta = src.value - prevSrc.value;
            deltas.push({ type: 'price', direction: valueDelta > 0 ? 'up' : 'down', magnitude: Math.abs(valueDelta), detail: src.name + ': ' + prevSrc.value.toFixed(2) + ' \u2192 ' + src.value.toFixed(2) + ' (' + (valueDelta > 0 ? '+' : '') + valueDelta.toFixed(2) + ')' });
          }
        }
      }

      // Diagnosis changes
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

    // Rate of change from history
    var rateOfChange = 0;
    if (_history.length >= 3) {
      var recent = _history.slice(-3);
      rateOfChange = (recent[2].stress - recent[0].stress) / 2;
    }

    // Acceleration
    var acceleration = 'stable';
    if (rateOfChange > 0.02) acceleration = 'accelerating';
    else if (rateOfChange < -0.02) acceleration = 'decelerating';

    // ── Build pulse state ──
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

    // Track history
    _history.push({ stress: stress, confidence: confidence, timestamp: now });
    if (_history.length > MAX_HISTORY) _history.shift();

    return _currentState;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  window.LIMENInfrastructurePulse = {
    computePulse: computePulse,
    getPulse: function () { return _currentState; },
    getPrevious: function () { return _previousState; },
    getHistory: function () { return _history.slice(); },
    getEvidenceContracts: function () { return EVIDENCE_CONTRACTS; },
    getFreshnessTTL: function () { return FRESHNESS_TTL; },
    getSourceTypes: function () { return SOURCE_TYPES; }
  };

  console.log('[InfrastructurePulse] Loaded \u2014 live feed pulse engine ready');

})();
