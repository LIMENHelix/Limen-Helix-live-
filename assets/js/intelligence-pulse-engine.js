/**
 * intelligence-pulse-engine.js — Live Feed Pulse Engine for Intelligence Domain
 * Self-gates: only runs when ?domain=intelligence
 * Exposes: window.LIMENIntelligencePulse
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var dom = params.get('domain');
  if (dom !== 'intelligence') return;

  var FRESHNESS_TTL = {
    'intel_feed':        4 * 60 * 60 * 1000,
    'cyber_feed':        1 * 60 * 60 * 1000,
    'osint_feed':        2 * 60 * 60 * 1000,
    'sigint_proxy':      6 * 60 * 60 * 1000,
    'geoint_proxy':     12 * 60 * 60 * 1000,
    'humint_proxy':     24 * 60 * 60 * 1000,
    'regulatory_feed':  24 * 60 * 60 * 1000,
    'event_cluster':    30 * 60 * 1000,
    'structural':       24 * 60 * 60 * 1000,
    'default':          10 * 60 * 1000
  };

  var SOURCE_TYPES = {
    'RSS Intelligence Signals':       'news_feed',
    'RSS Intelligence Conflict':      'conflict_feed',
    'ACLED Conflict Events':     'conflict_feed',
    'Janes Intelligence News':        'defense_industry_feed',
    'Intelligence News':              'defense_industry_feed',
    'Breaking Intelligence':          'defense_industry_feed',
    'Intelligence One':               'defense_industry_feed',
    'The War Zone':              'defense_industry_feed',
    'ISW Daily Updates':         'strategic_analysis_feed',
    'IISS Strategic Comments':   'strategic_analysis_feed',
    'RUSI Commentary':           'strategic_analysis_feed',
    'CSIS Analysis':             'strategic_analysis_feed',
    'NATO News':                 'alliance_feed',
    'SIPRI Arms Trade':          'alliance_feed',
    'CISA Advisories':           'cyber_feed',
    'NCSC UK Alerts':            'cyber_feed',
    // Adversary perspective \u2014 positional signal, NOT confirmation of fact
    'TASS (Russia)':             'adversary_state_feed',
    'Xinhua (China)':            'adversary_state_feed',
    'Global Times (China)':      'adversary_state_feed',
    'Press TV (Iran)':           'adversary_state_feed',
    'KCNA Watch (DPRK)':         'adversary_state_feed',
    'South China Morning Post':  'regional_perspective_feed'
  };

  var EVIDENCE_CONTRACTS = {
    'INTELLIGENCE_FAILURE': {
      label: 'Intelligence Failure / Strategic Surprise',
      requiredFamilies: ['intel_event', 'news_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.intel_feed,
      primaryIndicators: ['intel_gap', 'analytic_failure', 'collection_miss', 'strategic_surprise'],
      secondaryConfirmation: ['structural_stress'],
      catchAllBlocked: false
    },
    'MASS_SURVEILLANCE_SCANDAL': {
      label: 'Mass Surveillance / Privacy Scandal',
      requiredFamilies: ['oversight_event', 'news_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.regulatory_feed,
      primaryIndicators: ['surveillance_exposure', 'bulk_collection', 'privacy_breach', 'oversight_gap'],
      secondaryConfirmation: ['structural_stress'],
      catchAllBlocked: true
    },
    'CYBER_ESPIONAGE': {
      label: 'Cyber Espionage / Network Penetration',
      requiredFamilies: ['cyber_event', 'news_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.cyber_feed,
      primaryIndicators: ['cyber_espionage', 'network_intrusion', 'apt_activity', 'source_compromise'],
      secondaryConfirmation: ['macro_shock'],
      catchAllBlocked: true
    },
    'WHISTLEBLOWER_CRISIS': {
      label: 'Whistleblower / Classified Leak',
      requiredFamilies: ['oversight_event', 'news_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.intel_feed,
      primaryIndicators: ['classified_leak', 'insider_disclosure', 'whistleblower_action', 'damage_assessment'],
      secondaryConfirmation: ['structural_stress'],
      catchAllBlocked: true
    },
    'FOREIGN_INTERFERENCE': {
      label: 'Foreign Interference / Influence Operation',
      requiredFamilies: ['intel_event', 'news_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.osint_feed,
      primaryIndicators: ['foreign_influence', 'disinformation', 'election_interference', 'covert_action'],
      secondaryConfirmation: ['macro_shock'],
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
      if (cond === 'signal_blindness' || cond === 'collection_gap' || cond === 'analytic_distortion' || cond === 'low_observability' || cond === 'weak_anomaly_detection') {
        addFamily('intel_event');
        addFamily('news_event');
      }
      if (cond === 'oversight_failure' || cond === 'trust_boundary_breach' || cond === 'bulk_collection_excess' || cond === 'privacy_violation') {
        addFamily('oversight_event');
        addFamily('news_event');
      }
      if (cond === 'adversarial_penetration' || cond === 'network_intrusion' || cond === 'compromised_channel' || cond === 'deception_exposure') {
        addFamily('cyber_event');
        addFamily('news_event');
      }
      if (cond === 'leaked_signals' || cond === 'institutional_exposure' || cond === 'narrative_capture') {
        addFamily('oversight_event');
        addFamily('intel_event');
      }
      if (cond === 'narrative_manipulation' || cond === 'information_contamination' || cond === 'coordination_failure') {
        addFamily('intel_event');
        addFamily('news_event');
      }
      if (cond === 'intelligence_high_stress' || cond === 'structural_stress') addFamily('structural_event');
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

  window.LIMENIntelligencePulse = {
    computePulse: computePulse,
    getPulse: function () { return _currentState; },
    getPrevious: function () { return _previousState; },
    getHistory: function () { return _history.slice(); },
    getEvidenceContracts: function () { return EVIDENCE_CONTRACTS; },
    getFreshnessTTL: function () { return FRESHNESS_TTL; },
    getSourceTypes: function () { return SOURCE_TYPES; }
  };

  console.log('[DefensePulse] Loaded');
})();
