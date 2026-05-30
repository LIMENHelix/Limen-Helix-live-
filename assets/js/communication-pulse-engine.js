/**
 * communication-pulse-engine.js — Live Feed Pulse Engine for Communication Domain
 * Self-gates: only runs when ?domain=communication
 * Exposes: window.LIMENCommunicationPulse
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var dom = params.get('domain');
  if (dom !== 'communication') return;

  var FRESHNESS_TTL = {
    'communication_indicator': 24 * 60 * 60 * 1000,
    'institutional_index': 12 * 60 * 60 * 1000,
    'policy_feed':         6 * 60 * 60 * 1000,
    'workforce_feed':      6 * 60 * 60 * 1000,
    'news_feed':           2 * 60 * 60 * 1000,
    'event_cluster':       30 * 60 * 1000,
    'structural':          24 * 60 * 60 * 1000,
    'default':             10 * 60 * 1000
  };

  var SOURCE_TYPES = {
    'NewsAPI Headlines':              'news_feed',
    'RSS Media':                      'news_feed',
    'Reporters Without Borders':      'rights_feed',
    'CPJ Press Freedom':              'rights_feed',
    'Snopes Fact Checks':             'fact_check_feed',
    'Cloudflare Radar Outages':       'outage_feed',
    'Netblocks':                      'outage_feed',
    'Stanford Internet Observatory':  'research_feed'
  };

  var EVIDENCE_CONTRACTS = {
    'DISINFORMATION_CRISIS': {
      label: 'Disinformation Crisis',
      requiredFamilies: ['news_event', 'fact_check_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.news_feed,
      primaryIndicators: ['misinformation_spread', 'disinformation_campaign', 'narrative_manipulation', 'amplification_bias'],
      secondaryConfirmation: ['signal_degradation'],
      catchAllBlocked: true
    },
    'TELECOM_FAILURE': {
      label: 'Telecom / Network Failure',
      requiredFamilies: ['outage_event', 'news_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.news_feed,
      primaryIndicators: ['infrastructure_failure', 'network_disruption', 'connectivity_loss', 'service_outage'],
      secondaryConfirmation: [],
      catchAllBlocked: true
    },
    'CENSORSHIP_OVERREACH': {
      label: 'Censorship Overreach',
      requiredFamilies: ['rights_event', 'news_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.news_feed,
      primaryIndicators: ['speech_restriction', 'content_suppression', 'platform_censorship', 'regulatory_overreach', 'information_control'],
      secondaryConfirmation: [],
      catchAllBlocked: false
    },
    'MEDIA_MONOPOLY': {
      label: 'Media Concentration',
      requiredFamilies: ['news_event', 'research_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.news_feed,
      primaryIndicators: ['market_concentration', 'editorial_capture', 'audience_fragmentation', 'echo_chamber', 'platform_dominance'],
      secondaryConfirmation: ['structural_stress'],
      catchAllBlocked: true
    },
    'CYBER_PROPAGANDA': {
      label: 'Cyber Propaganda Campaign',
      requiredFamilies: ['news_event', 'research_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.news_feed,
      primaryIndicators: ['narrative_manipulation', 'bot_amplification', 'coordinated_inauthentic', 'information_contamination', 'disinformation_campaign'],
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
      if (cond === 'budget_shortfall' || cond === 'resource_scarcity' || cond === 'infrastructure_degradation') addFamily('policy_event');
      if (cond === 'institutional_decline' || cond === 'quality_degradation' || cond === 'standards_erosion' || cond === 'credential_devaluation') addFamily('institutional_event');
      if (cond === 'workforce_gap' || cond === 'retention_failure' || cond === 'recruitment_deficit' || cond === 'burnout_epidemic') {
        addFamily('workforce_event');
        addFamily('policy_event');
      }
      if (cond === 'outcome_disparity' || cond === 'access_inequality' || cond === 'performance_decline' || cond === 'equity_failure') {
        addFamily('indicator_event');
        addFamily('policy_event');
      }
      if (cond === 'oversight_failure') {
        addFamily('institutional_event');
        addFamily('policy_event');
      }
      if (cond === 'digital_divide' || cond === 'platform_transition' || cond === 'pedagogical_mismatch' || cond === 'automation_displacement' || cond === 'adaptive_failure') {
        addFamily('news_event');
        addFamily('institutional_event');
      }
      if (cond === 'communication_high_stress' || cond === 'structural_stress') addFamily('structural_event');
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

  window.LIMENCommunicationPulse = {
    computePulse: computePulse,
    getPulse: function () { return _currentState; },
    getPrevious: function () { return _previousState; },
    getHistory: function () { return _history.slice(); },
    getEvidenceContracts: function () { return EVIDENCE_CONTRACTS; },
    getFreshnessTTL: function () { return FRESHNESS_TTL; },
    getSourceTypes: function () { return SOURCE_TYPES; }
  };

  console.log('[CommunicationPulse] Loaded');
})();
