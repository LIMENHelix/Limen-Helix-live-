/**
 * medicine-pulse-engine.js — Live Feed Pulse Engine for Medicine Domain
 *
 * MEDICINE DOMAIN ONLY. Computes real-time deltas between feed snapshots.
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
 * Self-gates: only runs when ?domain=medicine is in the URL.
 * Exposes: window.LIMENMedicinePulse
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  if (params.get('domain') !== 'medicine') return;

  // ══════════════════════════════════════════════════════════════════════
  // FRESHNESS TTL RULES — by feed type
  // ══════════════════════════════════════════════════════════════════════

  var FRESHNESS_TTL = {
    'clinical_indicator':  15 * 60 * 1000,  // 15 minutes — patient outcomes, ICU capacity
    'event_cluster':       30 * 60 * 1000,  // 30 minutes — outbreak events, safety incidents
    'structural':          24 * 60 * 60 * 1000, // 24 hours — policy changes, infrastructure data
    'default':             10 * 60 * 1000   // 10 minutes
  };

  // Source → feed type classification
  var SOURCE_TYPES = {
    'Hospital Capacity':      'clinical_indicator',
    'ICU Occupancy':          'clinical_indicator',
    'Patient Outcomes':       'clinical_indicator',
    'Mortality Rate':         'clinical_indicator',
    'Infection Rate':         'clinical_indicator',
    'Drug Supply Index':      'clinical_indicator',
    'WHO Advisory':           'structural',
    'FDA Announcement':       'structural',
    'CDC Report':             'structural',
    'Clinical Trial Update':  'event_cluster',
    'Outbreak Report':        'event_cluster',
    'Safety Alert':           'event_cluster',
    // ── Medicine feed expansion ──
    'openFDA Events':         'structural',
    'openFDA Recalls':        'event_cluster',
    'CDC MMWR':               'structural',
    'WHO Disease Outbreak':   'event_cluster',
    'FDA Drug Shortages':     'clinical_indicator',
    'ClinicalTrials.gov':     'event_cluster'
  };

  // ══════════════════════════════════════════════════════════════════════
  // DIAGNOSIS EVIDENCE CONTRACTS — what evidence each diagnosis REQUIRES
  // No diagnosis may activate without meeting its contract.
  // ══════════════════════════════════════════════════════════════════════

  var EVIDENCE_CONTRACTS = {
    'PANDEMIC': {
      label: 'Pandemic / Infectious Disease Outbreak',
      requiredFamilies: ['pandemic_event', 'clinical_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['outbreak_detected', 'transmission_surge'],
      secondaryConfirmation: ['hospital_overflow', 'mortality_spike'],
      downgradeRule: 'If transmission rate declines and hospital capacity recovers, downgrade.',
      deactivationRule: 'No pandemic or clinical evidence within freshness window.',
      catchAllBlocked: true
    },
    'DRUG_RESISTANCE': {
      label: 'Antimicrobial / Drug Resistance Crisis',
      requiredFamilies: ['resistance_event', 'pharmaceutical_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['resistance_detected', 'treatment_failure'],
      secondaryConfirmation: ['resistance_spread', 'antibiotic_shortage'],
      downgradeRule: 'If resistance patterns stabilize and new treatments emerge, downgrade.',
      deactivationRule: 'No resistance or pharmaceutical evidence within freshness window.',
      catchAllBlocked: true
    },
    'HEALTHCARE_COLLAPSE': {
      label: 'Healthcare System Collapse',
      requiredFamilies: ['system_event', 'clinical_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['capacity_breach', 'staffing_crisis'],
      secondaryConfirmation: ['er_diversion', 'service_shutdown'],
      downgradeRule: 'If hospital capacity recovers and staffing stabilizes, downgrade.',
      deactivationRule: 'No system or clinical evidence within freshness window.',
      catchAllBlocked: true
    },
    'MALPRACTICE_CRISIS': {
      label: 'Malpractice / Patient Safety Crisis',
      requiredFamilies: ['safety_event', 'clinical_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['adverse_event_spike', 'malpractice_surge'],
      secondaryConfirmation: ['litigation_wave', 'safety_violation'],
      downgradeRule: 'If adverse events decline and safety protocols restore confidence, downgrade.',
      deactivationRule: 'No safety or clinical evidence within freshness window.',
      catchAllBlocked: true
    },
    'SUPPLY_SHORTAGE': {
      label: 'Medical Supply / Drug Shortage',
      requiredFamilies: ['supply_event', 'pharmaceutical_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['supply_disruption', 'drug_stockout'],
      secondaryConfirmation: ['manufacturing_halt', 'distribution_failure'],
      downgradeRule: 'If supply chains recover and stockpiles rebuild, downgrade.',
      deactivationRule: 'No supply or pharmaceutical evidence within freshness window.',
      catchAllBlocked: true
    },
    'MENTAL_HEALTH_CRISIS': {
      label: 'Mental Health System Crisis',
      requiredFamilies: ['mental_health_event', 'access_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['crisis_volume_surge', 'provider_shortage'],
      secondaryConfirmation: ['wait_time_spike', 'suicide_rate_increase'],
      downgradeRule: 'If crisis volumes normalize and provider capacity expands, downgrade.',
      deactivationRule: 'No mental health or access evidence within freshness window.',
      catchAllBlocked: true
    },
    'CARE_ACCESS_FAILURE': {
      label: 'Healthcare Access Failure',
      requiredFamilies: ['access_event', 'system_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['access_denial', 'coverage_gap'],
      secondaryConfirmation: ['uninsured_spike', 'rural_closure'],
      downgradeRule: 'If coverage expands and facility access restores, downgrade.',
      deactivationRule: 'No access or system evidence within freshness window.',
      catchAllBlocked: true
    },
    'CHRONIC_DISEASE_LOAD': {
      label: 'Chronic Disease Burden Overload',
      requiredFamilies: ['chronic_event', 'clinical_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.structural,
      primaryIndicators: ['chronic_prevalence_rise', 'comorbidity_burden'],
      secondaryConfirmation: ['readmission_spike', 'cost_escalation'],
      downgradeRule: 'If chronic disease management improves and readmissions decline, downgrade.',
      deactivationRule: 'No chronic or clinical evidence within freshness window.',
      // CHRONIC_DISEASE_LOAD CAN use stress catch-all — it's the systemic chronic diagnosis
      catchAllBlocked: false
    },
    'CLINICAL_COORDINATION_BREAKDOWN': {
      label: 'Clinical Coordination Breakdown',
      requiredFamilies: ['coordination_event', 'system_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['handoff_failure', 'referral_breakdown'],
      secondaryConfirmation: ['information_gap', 'duplicate_testing'],
      downgradeRule: 'If care coordination metrics improve and handoff errors decline, downgrade.',
      deactivationRule: 'No coordination or system evidence within freshness window.',
      catchAllBlocked: true
    },
    'THERAPEUTIC_RELIABILITY_RISK': {
      label: 'Therapeutic Reliability Risk',
      requiredFamilies: ['therapeutic_event', 'pharmaceutical_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['efficacy_decline', 'recall_event'],
      secondaryConfirmation: ['adverse_reaction_cluster', 'protocol_deviation'],
      downgradeRule: 'If therapeutic outcomes stabilize and recalls resolve, downgrade.',
      deactivationRule: 'No therapeutic or pharmaceutical evidence within freshness window.',
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

      // outbreak_detected, transmission_surge, hospital_overflow, mortality_spike → pandemic_event + clinical_event
      if (cond === 'outbreak_detected' || cond === 'transmission_surge' || cond === 'hospital_overflow' || cond === 'mortality_spike') {
        if (evidenceFamilies.indexOf('pandemic_event') === -1) evidenceFamilies.push('pandemic_event');
        if (evidenceFamilies.indexOf('clinical_event') === -1) evidenceFamilies.push('clinical_event');
      }

      // resistance_detected, treatment_failure, resistance_spread, antibiotic_shortage → resistance_event + pharmaceutical_event
      if (cond === 'resistance_detected' || cond === 'treatment_failure' || cond === 'resistance_spread' || cond === 'antibiotic_shortage') {
        if (evidenceFamilies.indexOf('resistance_event') === -1) evidenceFamilies.push('resistance_event');
        if (evidenceFamilies.indexOf('pharmaceutical_event') === -1) evidenceFamilies.push('pharmaceutical_event');
      }

      // capacity_breach, staffing_crisis, er_diversion, service_shutdown → system_event + clinical_event
      if (cond === 'capacity_breach' || cond === 'staffing_crisis' || cond === 'er_diversion' || cond === 'service_shutdown') {
        if (evidenceFamilies.indexOf('system_event') === -1) evidenceFamilies.push('system_event');
        if (evidenceFamilies.indexOf('clinical_event') === -1) evidenceFamilies.push('clinical_event');
      }

      // adverse_event_spike, malpractice_surge, litigation_wave, safety_violation → safety_event + clinical_event
      if (cond === 'adverse_event_spike' || cond === 'malpractice_surge' || cond === 'litigation_wave' || cond === 'safety_violation') {
        if (evidenceFamilies.indexOf('safety_event') === -1) evidenceFamilies.push('safety_event');
        if (evidenceFamilies.indexOf('clinical_event') === -1) evidenceFamilies.push('clinical_event');
      }

      // supply_disruption, drug_stockout, manufacturing_halt, distribution_failure → supply_event + pharmaceutical_event
      if (cond === 'supply_disruption' || cond === 'drug_stockout' || cond === 'manufacturing_halt' || cond === 'distribution_failure') {
        if (evidenceFamilies.indexOf('supply_event') === -1) evidenceFamilies.push('supply_event');
        if (evidenceFamilies.indexOf('pharmaceutical_event') === -1) evidenceFamilies.push('pharmaceutical_event');
      }

      // crisis_volume_surge, provider_shortage, wait_time_spike, suicide_rate_increase → mental_health_event + access_event
      if (cond === 'crisis_volume_surge' || cond === 'provider_shortage' || cond === 'wait_time_spike' || cond === 'suicide_rate_increase') {
        if (evidenceFamilies.indexOf('mental_health_event') === -1) evidenceFamilies.push('mental_health_event');
        if (evidenceFamilies.indexOf('access_event') === -1) evidenceFamilies.push('access_event');
      }

      // access_denial, coverage_gap, uninsured_spike, rural_closure → access_event + system_event
      if (cond === 'access_denial' || cond === 'coverage_gap' || cond === 'uninsured_spike' || cond === 'rural_closure') {
        if (evidenceFamilies.indexOf('access_event') === -1) evidenceFamilies.push('access_event');
        if (evidenceFamilies.indexOf('system_event') === -1) evidenceFamilies.push('system_event');
      }

      // chronic_prevalence_rise, comorbidity_burden, readmission_spike, cost_escalation → chronic_event + clinical_event
      if (cond === 'chronic_prevalence_rise' || cond === 'comorbidity_burden' || cond === 'readmission_spike' || cond === 'cost_escalation') {
        if (evidenceFamilies.indexOf('chronic_event') === -1) evidenceFamilies.push('chronic_event');
        if (evidenceFamilies.indexOf('clinical_event') === -1) evidenceFamilies.push('clinical_event');
      }

      // handoff_failure, referral_breakdown, information_gap, duplicate_testing → coordination_event + system_event
      if (cond === 'handoff_failure' || cond === 'referral_breakdown' || cond === 'information_gap' || cond === 'duplicate_testing') {
        if (evidenceFamilies.indexOf('coordination_event') === -1) evidenceFamilies.push('coordination_event');
        if (evidenceFamilies.indexOf('system_event') === -1) evidenceFamilies.push('system_event');
      }

      // efficacy_decline, recall_event, adverse_reaction_cluster, protocol_deviation → therapeutic_event + pharmaceutical_event
      if (cond === 'efficacy_decline' || cond === 'recall_event' || cond === 'adverse_reaction_cluster' || cond === 'protocol_deviation') {
        if (evidenceFamilies.indexOf('therapeutic_event') === -1) evidenceFamilies.push('therapeutic_event');
        if (evidenceFamilies.indexOf('pharmaceutical_event') === -1) evidenceFamilies.push('pharmaceutical_event');
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

  window.LIMENMedicinePulse = {
    computePulse: computePulse,
    getPulse: function () { return _currentState; },
    getPrevious: function () { return _previousState; },
    getHistory: function () { return _history.slice(); },
    getEvidenceContracts: function () { return EVIDENCE_CONTRACTS; },
    getFreshnessTTL: function () { return FRESHNESS_TTL; },
    getSourceTypes: function () { return SOURCE_TYPES; }
  };

  console.log('[MedicinePulse] Loaded \u2014 live feed pulse engine ready');

})();
