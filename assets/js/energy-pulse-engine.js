/**
 * energy-pulse-engine.js — Live Feed Pulse Engine for Energy Domain
 *
 * ENERGY DOMAIN ONLY. Computes real-time deltas between feed snapshots.
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
 * Self-gates: only runs when ?domain=energy is in the URL.
 * Exposes: window.LIMENEnergyPulse
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  if (params.get('domain') !== 'energy') return;

  // ══════════════════════════════════════════════════════════════════════
  // FRESHNESS TTL RULES — by feed type
  // ══════════════════════════════════════════════════════════════════════

  var FRESHNESS_TTL = {
    'market_price':      5 * 60 * 1000,   // 5 minutes — price feeds
    'event_cluster':     30 * 60 * 1000,  // 30 minutes — defense/ingest events
    'structural':        24 * 60 * 60 * 1000, // 24 hours — EIA structural data
    'default':           10 * 60 * 1000   // 10 minutes
  };

  // Source → feed type classification
  var SOURCE_TYPES = {
    'EIA Petroleum':     'structural',     // Daily structural — Brent spot price
    'Massive Crude Oil': 'market_price',   // Near-real-time — Polygon previous close
    'FRED Crude Oil':    'structural'      // Daily structural
  };

  // ══════════════════════════════════════════════════════════════════════
  // DIAGNOSIS EVIDENCE CONTRACTS — what evidence each diagnosis REQUIRES
  // No diagnosis may activate without meeting its contract.
  // ══════════════════════════════════════════════════════════════════════

  var EVIDENCE_CONTRACTS = {
    'OIL_SHOCK': {
      label: 'Oil Supply Shock',
      requiredFamilies: ['oil_price'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.market_price,
      primaryIndicators: ['crude_above_90', 'crude_above_100'],
      secondaryConfirmation: ['STRAIT_DISRUPTION', 'REFINERY_ATTACK', 'SANCTIONS', 'OIL_SHOCK'],
      downgradeRule: 'If crude falls below $85, downgrade to WATCH. If below $75, deactivate.',
      deactivationRule: 'No oil-specific evidence within freshness window.',
      // energy_high_stress CANNOT activate this alone — requires oil evidence
      catchAllBlocked: true
    },
    'GRID_COLLAPSE': {
      label: 'Grid Infrastructure Collapse',
      requiredFamilies: ['grid_event', 'infrastructure_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['grid_stress', 'CYBER_ATTACK'],
      secondaryConfirmation: ['infrastructure_cross', 'weather_extreme'],
      downgradeRule: 'If grid event resolves and no secondary confirmation, downgrade.',
      deactivationRule: 'No grid or infrastructure evidence. Crude oil stress alone is NOT sufficient.',
      // structural_stress from crude oil CANNOT activate this
      catchAllBlocked: true
    },
    'PIPELINE_DISRUPTION': {
      label: 'Pipeline / Distribution Disruption',
      requiredFamilies: ['pipeline_event', 'shipping_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['STRAIT_DISRUPTION', 'PORT_DISRUPTION', 'TANKER_THREAT'],
      secondaryConfirmation: ['chokepoint'],
      downgradeRule: 'If event resolves, downgrade to WATCH.',
      deactivationRule: 'No pipeline/shipping evidence within freshness window.',
      catchAllBlocked: true
    },
    'RENEWABLE_INTERMITTENCY': {
      label: 'Renewable Output Intermittency',
      requiredFamilies: ['renewable_event', 'weather_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['weather_extreme', 'generation_mix', 'storage_low'],
      secondaryConfirmation: [],
      downgradeRule: 'If weather normalizes, downgrade.',
      deactivationRule: 'No renewable or weather evidence. Currently CANNOT activate (no feeds).',
      catchAllBlocked: true
    },
    'NUCLEAR_INCIDENT': {
      label: 'Nuclear Safety Incident',
      requiredFamilies: ['nuclear_event', 'military_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['NUCLEAR_THREAT', 'MILITARY_ESCALATION'],
      secondaryConfirmation: [],
      downgradeRule: 'If threat level drops, downgrade.',
      deactivationRule: 'No nuclear/military evidence within freshness window.',
      catchAllBlocked: true
    },
    'SYSTEMIC_ENERGY_STRESS': {
      label: 'Systemic Energy Stress',
      requiredFamilies: ['oil_price', 'macro_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.market_price,
      primaryIndicators: ['energy_high_stress', 'macro_shock'],
      secondaryConfirmation: ['structural_stress'],
      downgradeRule: 'If stress falls below 0.60, downgrade to WATCH.',
      deactivationRule: 'Stress below 0.50 with no macro event.',
      // This one CAN use stress catch-all — it's the systemic stress diagnosis
      catchAllBlocked: false
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
      if (cond === 'crude_above_90' || cond === 'crude_above_100') {
        if (evidenceFamilies.indexOf('oil_price') === -1) evidenceFamilies.push('oil_price');
      }
      if (cond === 'STRAIT_DISRUPTION' || cond === 'PORT_DISRUPTION' || cond === 'TANKER_THREAT' || cond === 'chokepoint') {
        if (evidenceFamilies.indexOf('pipeline_event') === -1) evidenceFamilies.push('pipeline_event');
        if (evidenceFamilies.indexOf('shipping_event') === -1) evidenceFamilies.push('shipping_event');
      }
      if (cond === 'grid_stress' || cond === 'infrastructure_cross') {
        if (evidenceFamilies.indexOf('grid_event') === -1) evidenceFamilies.push('grid_event');
        if (evidenceFamilies.indexOf('infrastructure_event') === -1) evidenceFamilies.push('infrastructure_event');
      }
      if (cond === 'CYBER_ATTACK') {
        if (evidenceFamilies.indexOf('grid_event') === -1) evidenceFamilies.push('grid_event');
      }
      if (cond === 'weather_extreme') {
        if (evidenceFamilies.indexOf('weather_event') === -1) evidenceFamilies.push('weather_event');
        if (evidenceFamilies.indexOf('renewable_event') === -1) evidenceFamilies.push('renewable_event');
      }
      if (cond === 'NUCLEAR_THREAT' || cond === 'MILITARY_ESCALATION') {
        if (evidenceFamilies.indexOf('nuclear_event') === -1) evidenceFamilies.push('nuclear_event');
        if (evidenceFamilies.indexOf('military_event') === -1) evidenceFamilies.push('military_event');
      }
      if (cond === 'macro_shock') {
        if (evidenceFamilies.indexOf('macro_event') === -1) evidenceFamilies.push('macro_event');
      }
      if (cond === 'energy_high_stress' || cond === 'structural_stress') {
        // These are stress-derived, not evidence families — don't add to evidence
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
          // Price change
          if (src.value && prevSrc.value && Math.abs(src.value - prevSrc.value) > 0.5) {
            var priceDelta = src.value - prevSrc.value;
            deltas.push({ type: 'price', direction: priceDelta > 0 ? 'up' : 'down', magnitude: Math.abs(priceDelta), detail: src.name + ': $' + prevSrc.value.toFixed(2) + ' → $' + src.value.toFixed(2) + ' (' + (priceDelta > 0 ? '+' : '') + priceDelta.toFixed(2) + ')' });
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

  window.LIMENEnergyPulse = {
    computePulse: computePulse,
    getPulse: function () { return _currentState; },
    getPrevious: function () { return _previousState; },
    getHistory: function () { return _history.slice(); },
    getEvidenceContracts: function () { return EVIDENCE_CONTRACTS; },
    getFreshnessTTL: function () { return FRESHNESS_TTL; },
    getSourceTypes: function () { return SOURCE_TYPES; }
  };

  console.log('[EnergyPulse] Loaded — live feed pulse engine ready');

})();
