/**
 * finance-pulse-engine.js — Live Feed Pulse Engine for Finance Domain
 *
 * FINANCE DOMAIN ONLY. Computes real-time deltas between feed snapshots.
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
 * Self-gates: only runs when ?domain=finance is in the URL.
 * Exposes: window.LIMENFinancePulse
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  if (params.get('domain') !== 'finance') return;

  // ══════════════════════════════════════════════════════════════════════
  // FRESHNESS TTL RULES — by feed type
  // ══════════════════════════════════════════════════════════════════════

  var FRESHNESS_TTL = {
    'market_price':      5 * 60 * 1000,   // 5 minutes — price feeds
    'event_cluster':     30 * 60 * 1000,  // 30 minutes — event clusters
    'structural':        24 * 60 * 60 * 1000, // 24 hours — structural data
    'default':           10 * 60 * 1000   // 10 minutes
  };

  // Source → feed type classification
  var SOURCE_TYPES = {
    'Market Index':      'market_price',
    'Bond Yield':        'market_price',
    'Credit Spread':     'market_price',
    'FX Rate':           'market_price',
    'Interbank Rate':    'market_price',
    'FRED Financial':    'structural',
    'Regulatory Filing': 'structural',
    'Banking Stress':    'event_cluster',
    'Credit Event':      'event_cluster'
  };

  // ══════════════════════════════════════════════════════════════════════
  // DIAGNOSIS EVIDENCE CONTRACTS — what evidence each diagnosis REQUIRES
  // No diagnosis may activate without meeting its contract.
  // ══════════════════════════════════════════════════════════════════════

  var EVIDENCE_CONTRACTS = {
    'BANKING_CRISIS': {
      label: 'Banking System Crisis',
      requiredFamilies: ['banking_event', 'credit_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['bank_failure', 'interbank_stress'],
      secondaryConfirmation: ['lending_contraction', 'liquidity_drain'],
      downgradeRule: 'If interbank stress resolves and no secondary confirmation, downgrade.',
      deactivationRule: 'No banking or credit evidence within freshness window.',
      catchAllBlocked: true
    },
    'CREDIT_FREEZE': {
      label: 'Credit Market Freeze',
      requiredFamilies: ['credit_event', 'liquidity_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['lending_contraction', 'liquidity_drain'],
      secondaryConfirmation: ['interbank_stress', 'bank_failure'],
      downgradeRule: 'If credit spreads normalize and no secondary confirmation, downgrade.',
      deactivationRule: 'No credit or liquidity evidence within freshness window.',
      catchAllBlocked: true
    },
    'MARKET_CRASH': {
      label: 'Market Crash / Flash Event',
      requiredFamilies: ['market_event', 'volatility_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.market_price,
      primaryIndicators: ['market_panic', 'flash_crash', 'volatility_cascade'],
      secondaryConfirmation: ['correlation_breakdown', 'market_decline'],
      downgradeRule: 'If volatility falls below crisis threshold and no secondary confirmation, downgrade.',
      deactivationRule: 'No market or volatility evidence within freshness window.',
      catchAllBlocked: true
    },
    'CURRENCY_COLLAPSE': {
      label: 'Currency / FX Collapse',
      requiredFamilies: ['currency_event', 'reserves_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['currency_collapse', 'capital_flight'],
      secondaryConfirmation: ['reserves_depletion', 'fx_intervention'],
      downgradeRule: 'If FX stabilizes and reserves stop depleting, downgrade.',
      deactivationRule: 'No currency or reserves evidence within freshness window.',
      catchAllBlocked: true
    },
    'SYSTEMIC_CONTAGION': {
      label: 'Systemic Financial Contagion',
      requiredFamilies: ['systemic_event', 'contagion_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.market_price,
      primaryIndicators: ['volatility_cascade', 'correlation_breakdown'],
      secondaryConfirmation: ['bank_failure', 'market_panic'],
      downgradeRule: 'If contagion indicators recede below 0.60, downgrade to WATCH.',
      deactivationRule: 'Contagion below 0.50 with no systemic event.',
      // This one CAN use stress catch-all — it's the systemic contagion diagnosis
      catchAllBlocked: false
    },
    'FRAUD_SCANDAL': {
      label: 'Fraud / Accounting Scandal',
      requiredFamilies: ['fraud_event', 'regulatory_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['fraud_detected', 'accounting_irregularity'],
      secondaryConfirmation: ['regulatory_action'],
      downgradeRule: 'If regulatory response is contained and no further fraud detected, downgrade.',
      deactivationRule: 'No fraud or regulatory evidence within freshness window.',
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

      // _stress_* prefixed conditions must NOT map to any evidence family
      if (cond.indexOf('_stress_') === 0) continue;

      // volatility_cascade, market_panic, flash_crash, correlation_breakdown → market_event + volatility_event
      if (cond === 'volatility_cascade' || cond === 'market_panic' || cond === 'flash_crash' || cond === 'correlation_breakdown') {
        if (evidenceFamilies.indexOf('market_event') === -1) evidenceFamilies.push('market_event');
        if (evidenceFamilies.indexOf('volatility_event') === -1) evidenceFamilies.push('volatility_event');
      }

      // bank_failure, lending_contraction, interbank_stress, liquidity_drain → banking_event + credit_event + liquidity_event
      if (cond === 'bank_failure' || cond === 'lending_contraction' || cond === 'interbank_stress' || cond === 'liquidity_drain') {
        if (evidenceFamilies.indexOf('banking_event') === -1) evidenceFamilies.push('banking_event');
        if (evidenceFamilies.indexOf('credit_event') === -1) evidenceFamilies.push('credit_event');
        if (evidenceFamilies.indexOf('liquidity_event') === -1) evidenceFamilies.push('liquidity_event');
      }

      // currency_collapse, capital_flight, reserves_depletion, fx_intervention → currency_event + reserves_event
      if (cond === 'currency_collapse' || cond === 'capital_flight' || cond === 'reserves_depletion' || cond === 'fx_intervention') {
        if (evidenceFamilies.indexOf('currency_event') === -1) evidenceFamilies.push('currency_event');
        if (evidenceFamilies.indexOf('reserves_event') === -1) evidenceFamilies.push('reserves_event');
      }

      // fraud_detected, accounting_irregularity, regulatory_action → fraud_event + regulatory_event
      if (cond === 'fraud_detected' || cond === 'accounting_irregularity' || cond === 'regulatory_action') {
        if (evidenceFamilies.indexOf('fraud_event') === -1) evidenceFamilies.push('fraud_event');
        if (evidenceFamilies.indexOf('regulatory_event') === -1) evidenceFamilies.push('regulatory_event');
      }

      // yield_spike → market_event
      if (cond === 'yield_spike') {
        if (evidenceFamilies.indexOf('market_event') === -1) evidenceFamilies.push('market_event');
      }

      // market_decline → market_event + volatility_event
      if (cond === 'market_decline') {
        if (evidenceFamilies.indexOf('market_event') === -1) evidenceFamilies.push('market_event');
        if (evidenceFamilies.indexOf('volatility_event') === -1) evidenceFamilies.push('volatility_event');
      }

      // macro_shock → macro_event
      if (cond === 'macro_shock') {
        if (evidenceFamilies.indexOf('macro_event') === -1) evidenceFamilies.push('macro_event');
      }

      // Systemic/contagion classification — volatility_cascade and correlation_breakdown
      // also map to systemic/contagion when present together or with banking events
      if (cond === 'volatility_cascade' || cond === 'correlation_breakdown') {
        if (evidenceFamilies.indexOf('systemic_event') === -1) evidenceFamilies.push('systemic_event');
        if (evidenceFamilies.indexOf('contagion_event') === -1) evidenceFamilies.push('contagion_event');
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

  window.LIMENFinancePulse = {
    computePulse: computePulse,
    getPulse: function () { return _currentState; },
    getPrevious: function () { return _previousState; },
    getHistory: function () { return _history.slice(); },
    getEvidenceContracts: function () { return EVIDENCE_CONTRACTS; },
    getFreshnessTTL: function () { return FRESHNESS_TTL; },
    getSourceTypes: function () { return SOURCE_TYPES; }
  };

  console.log('[FinancePulse] Loaded — live feed pulse engine ready');

})();
