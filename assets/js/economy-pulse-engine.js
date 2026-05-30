/**
 * economy-pulse-engine.js — Live Feed Pulse Engine for Economy Domain
 *
 * ECONOMY DOMAIN ONLY. Computes real-time deltas between feed snapshots.
 * No fake motion. No static templates. Every output is causally grounded.
 *
 * Responsibilities:
 *   1. Track current vs previous feed state
 *   2. Detect meaningful deltas (indicator changes, source availability)
 *   3. Classify evidence families per diagnosis
 *   4. Enforce strict freshness TTLs
 *   5. Compute event novelty, acceleration, regime classification
 *   6. Produce "what changed" first-class state
 *
 * Self-gates: only runs when ?domain=economy is in the URL.
 * Exposes: window.LIMENEconomyPulse
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  if (params.get('domain') !== 'economy') return;

  // ══════════════════════════════════════════════════════════════════════
  // FRESHNESS TTL RULES — by feed type
  // ══════════════════════════════════════════════════════════════════════

  var FRESHNESS_TTL = {
    'macro_indicator':   15 * 60 * 1000,  // 15 minutes — GDP, employment, CPI feeds
    'event_cluster':     30 * 60 * 1000,  // 30 minutes — event clusters
    'structural':        24 * 60 * 60 * 1000, // 24 hours — structural data
    'default':           10 * 60 * 1000   // 10 minutes
  };

  // Source → feed type classification
  var SOURCE_TYPES = {
    'GDP Index':           'macro_indicator',
    'Employment Rate':     'macro_indicator',
    'CPI Inflation':       'macro_indicator',
    'Trade Balance':       'macro_indicator',
    'Industrial Output':   'macro_indicator',
    'Consumer Confidence': 'macro_indicator',
    'FRED Economic':       'structural',
    'Government Filing':   'structural',
    'Labor Report':        'event_cluster',
    'Policy Announcement': 'event_cluster'
  };

  // ══════════════════════════════════════════════════════════════════════
  // DIAGNOSIS EVIDENCE CONTRACTS — what evidence each diagnosis REQUIRES
  // No diagnosis may activate without meeting its contract.
  // ══════════════════════════════════════════════════════════════════════

  var EVIDENCE_CONTRACTS = {
    'RECESSION': {
      label: 'Economic Recession',
      requiredFamilies: ['demand_event', 'labor_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['gdp_decline', 'demand_contraction'],
      secondaryConfirmation: ['rising_unemployment', 'consumer_slowdown'],
      downgradeRule: 'If GDP stabilizes and employment recovers, downgrade.',
      deactivationRule: 'No demand or labor evidence within freshness window.',
      catchAllBlocked: true
    },
    'HYPERINFLATION': {
      label: 'Hyperinflation / Runaway Prices',
      requiredFamilies: ['inflation_event', 'price_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['sticky_cpi', 'services_inflation'],
      secondaryConfirmation: ['input_cost_persistence', 'price_rigidity'],
      downgradeRule: 'If CPI decelerates and input costs normalize, downgrade.',
      deactivationRule: 'No inflation or price evidence within freshness window.',
      catchAllBlocked: true
    },
    'BANKING_CRISIS': {
      label: 'Banking System Crisis',
      requiredFamilies: ['credit_event', 'banking_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['credit_tightening', 'lending_pullback'],
      secondaryConfirmation: ['credit_spread_pressure', 'capital_access_reduced'],
      downgradeRule: 'If credit conditions ease and lending resumes, downgrade.',
      deactivationRule: 'No credit or banking evidence within freshness window.',
      catchAllBlocked: true
    },
    'TRADE_WAR': {
      label: 'Trade War / Protectionist Escalation',
      requiredFamilies: ['trade_event', 'policy_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['tariff_impact', 'import_disruption'],
      secondaryConfirmation: ['export_restriction', 'trade_friction'],
      downgradeRule: 'If tariffs are rolled back and trade volumes recover, downgrade.',
      deactivationRule: 'No trade or policy evidence within freshness window.',
      catchAllBlocked: true
    },
    'DEBT_CRISIS': {
      label: 'Sovereign Debt Crisis',
      requiredFamilies: ['debt_event', 'fiscal_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['sovereign_debt_stress', 'fiscal_deficit'],
      secondaryConfirmation: ['debt_service_burden', 'downgrade_risk'],
      downgradeRule: 'If fiscal position improves and debt spreads narrow, downgrade.',
      deactivationRule: 'No debt or fiscal evidence within freshness window.',
      catchAllBlocked: true
    },
    'MARKET_CRASH': {
      label: 'Market Crash / Systemic Collapse',
      requiredFamilies: ['market_event', 'asset_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.macro_indicator,
      primaryIndicators: ['asset_collapse', 'wealth_destruction'],
      secondaryConfirmation: ['portfolio_loss', 'macro_shock'],
      downgradeRule: 'If asset prices stabilize and volatility subsides, downgrade to WATCH.',
      deactivationRule: 'Market and asset indicators below crisis threshold.',
      // This one CAN use stress catch-all — it's the systemic market diagnosis
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

      // _stress_* prefixed conditions must NOT map to any evidence family
      if (cond.indexOf('_stress_') === 0) continue;

      // gdp_decline, demand_contraction, consumer_slowdown, retail_weakness → demand_event + labor_event
      if (cond === 'gdp_decline' || cond === 'demand_contraction' || cond === 'consumer_slowdown' || cond === 'retail_weakness') {
        if (evidenceFamilies.indexOf('demand_event') === -1) evidenceFamilies.push('demand_event');
        if (evidenceFamilies.indexOf('labor_event') === -1) evidenceFamilies.push('labor_event');
      }

      // sticky_cpi, services_inflation, input_cost_persistence, price_rigidity → inflation_event + price_event
      if (cond === 'sticky_cpi' || cond === 'services_inflation' || cond === 'input_cost_persistence' || cond === 'price_rigidity') {
        if (evidenceFamilies.indexOf('inflation_event') === -1) evidenceFamilies.push('inflation_event');
        if (evidenceFamilies.indexOf('price_event') === -1) evidenceFamilies.push('price_event');
      }

      // credit_tightening, lending_pullback, credit_spread_pressure, loan_demand_weakness, capital_access_reduced → credit_event + banking_event
      if (cond === 'credit_tightening' || cond === 'lending_pullback' || cond === 'credit_spread_pressure' || cond === 'loan_demand_weakness' || cond === 'capital_access_reduced') {
        if (evidenceFamilies.indexOf('credit_event') === -1) evidenceFamilies.push('credit_event');
        if (evidenceFamilies.indexOf('banking_event') === -1) evidenceFamilies.push('banking_event');
      }

      // tariff_impact, import_disruption, export_restriction, trade_friction → trade_event + policy_event
      if (cond === 'tariff_impact' || cond === 'import_disruption' || cond === 'export_restriction' || cond === 'trade_friction') {
        if (evidenceFamilies.indexOf('trade_event') === -1) evidenceFamilies.push('trade_event');
        if (evidenceFamilies.indexOf('policy_event') === -1) evidenceFamilies.push('policy_event');
      }

      // sovereign_debt_stress, fiscal_deficit, debt_service_burden, downgrade_risk → debt_event + fiscal_event
      if (cond === 'sovereign_debt_stress' || cond === 'fiscal_deficit' || cond === 'debt_service_burden' || cond === 'downgrade_risk') {
        if (evidenceFamilies.indexOf('debt_event') === -1) evidenceFamilies.push('debt_event');
        if (evidenceFamilies.indexOf('fiscal_event') === -1) evidenceFamilies.push('fiscal_event');
      }

      // asset_collapse, wealth_destruction, portfolio_loss → market_event + asset_event
      if (cond === 'asset_collapse' || cond === 'wealth_destruction' || cond === 'portfolio_loss') {
        if (evidenceFamilies.indexOf('market_event') === -1) evidenceFamilies.push('market_event');
        if (evidenceFamilies.indexOf('asset_event') === -1) evidenceFamilies.push('asset_event');
      }

      // rising_unemployment, labor_market_active → labor_event
      if (cond === 'rising_unemployment' || cond === 'labor_market_active') {
        if (evidenceFamilies.indexOf('labor_event') === -1) evidenceFamilies.push('labor_event');
      }
      // consumer_sentiment_active, consumer_slowdown, retail_weakness → demand_event
      if (cond === 'consumer_sentiment_active' || cond === 'consumer_slowdown' || cond === 'retail_weakness') {
        if (evidenceFamilies.indexOf('demand_event') === -1) evidenceFamilies.push('demand_event');
      }

      // macro_shock → macro_event
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
            deltas.push({ type: 'indicator', direction: valueDelta > 0 ? 'up' : 'down', magnitude: Math.abs(valueDelta), detail: src.name + ': ' + prevSrc.value.toFixed(2) + ' \u2192 ' + src.value.toFixed(2) + ' (' + (valueDelta > 0 ? '+' : '') + valueDelta.toFixed(2) + ')' });
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

  window.LIMENEconomyPulse = {
    computePulse: computePulse,
    getPulse: function () { return _currentState; },
    getPrevious: function () { return _previousState; },
    getHistory: function () { return _history.slice(); },
    getEvidenceContracts: function () { return EVIDENCE_CONTRACTS; },
    getFreshnessTTL: function () { return FRESHNESS_TTL; },
    getSourceTypes: function () { return SOURCE_TYPES; }
  };

  console.log('[EconomyPulse] Loaded \u2014 live feed pulse engine ready');

})();
