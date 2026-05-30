/**
 * religion-pulse-engine.js — Live Feed Pulse Engine for Religion Domain
 *
 * RELIGION DOMAIN ONLY. Evidence contracts, freshness TTLs, delta detection.
 * Self-gates: only runs when ?domain=religion is in the URL.
 * Exposes: window.LIMENReligionPulse
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var dom = params.get('domain');
  if (dom !== 'religion') return;

  var FRESHNESS_TTL = {
    'institutional_feed':   24 * 60 * 60 * 1000,    // Vatican News, Christianity Today, Religion News Service
    'conflict_feed':        4 * 60 * 60 * 1000,     // Al Jazeera religion, Times of Israel, Hindustan Times
    'freedom_feed':         12 * 60 * 60 * 1000,    // USCIRF, Open Doors, Pew restrictions
    'demographics_feed':    24 * 60 * 60 * 1000,    // Pew Research Center, ARDA, Barna Group
    'interfaith_feed':      24 * 60 * 60 * 1000,    // BuddhistDoor Global, SikhNet
    'policy_feed':          24 * 60 * 60 * 1000,    // Religious freedom legislation, blasphemy laws
    'event_cluster':        30 * 60 * 1000,
    'structural':           24 * 60 * 60 * 1000,
    'default':              10 * 60 * 1000
  };

  var SOURCE_TYPES = {
    'Vatican News':              'institutional_feed',
    'Christianity Today':        'institutional_feed',
    'Religion News Service':     'institutional_feed',
    'Al Jazeera Religion':       'conflict_feed',
    'Times of Israel Religion':  'conflict_feed',
    'Hindustan Times Religion':  'conflict_feed',
    'USCIRF':                    'freedom_feed',
    'Pew Religion':              'demographics_feed',
    'BuddhistDoor Global':       'interfaith_feed',
    'SikhNet News':              'interfaith_feed',
    'RSS Religion Events':       'institutional_feed',
    'RSS Religion News':         'institutional_feed',
    'Event Registry':            'institutional_feed'
  };

  var EVIDENCE_CONTRACTS = {
    'SECTARIAN_CONFLICT': {
      label: 'Sectarian Conflict',
      requiredFamilies: ['conflict_event', 'persecution_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.conflict_feed,
      primaryIndicators: ['sectarian_escalation', 'identity_hardening', 'grievance_amplification', 'inter_communal_violence'],
      secondaryConfirmation: ['religion_high_stress'],
      catchAllBlocked: true
    },
    'INSTITUTIONAL_ABUSE': {
      label: 'Institutional Abuse',
      requiredFamilies: ['scandal_event', 'governance_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.institutional_feed,
      primaryIndicators: ['scandal_exposure', 'trust_collapse', 'authority_erosion', 'accountability_failure'],
      secondaryConfirmation: ['hypocrisy_perception'],
      catchAllBlocked: true
    },
    'RADICALIZATION': {
      label: 'Radicalization',
      requiredFamilies: ['extremism_event', 'security_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.conflict_feed,
      primaryIndicators: ['extremist_capture', 'polarizing_rhetoric', 'radicalization_pipeline', 'identity_hardening'],
      secondaryConfirmation: ['religion_high_stress'],
      catchAllBlocked: true
    },
    'SECULARIZATION_CRISIS': {
      label: 'Secularization Crisis',
      requiredFamilies: ['decline_event', 'demographic_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.demographics_feed,
      primaryIndicators: ['attendance_contraction', 'youth_disengagement', 'membership_decline', 'declining_legitimacy'],
      secondaryConfirmation: ['community_disengagement'],
      catchAllBlocked: true
    },
    'THEOLOGICAL_SCHISM': {
      label: 'Theological Schism',
      requiredFamilies: ['schism_event', 'governance_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.institutional_feed,
      primaryIndicators: ['doctrinal_conflict', 'denominational_splintering', 'leadership_fracture', 'organizational_schism'],
      secondaryConfirmation: ['authority_erosion'],
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
      // Sectarian conflict
      if (cond === 'sectarian_escalation' || cond === 'identity_hardening' || cond === 'grievance_amplification' || cond === 'inter_communal_violence') {
        addFamily('conflict_event');
        addFamily('persecution_event');
      }
      // Institutional abuse
      if (cond === 'scandal_exposure' || cond === 'trust_collapse' || cond === 'authority_erosion' || cond === 'accountability_failure' || cond === 'hypocrisy_perception') {
        addFamily('scandal_event');
        addFamily('governance_event');
      }
      // Radicalization
      if (cond === 'extremist_capture' || cond === 'polarizing_rhetoric' || cond === 'radicalization_pipeline') {
        addFamily('extremism_event');
        addFamily('security_event');
      }
      // Secularization crisis
      if (cond === 'attendance_contraction' || cond === 'youth_disengagement' || cond === 'membership_decline' || cond === 'declining_legitimacy' || cond === 'community_disengagement') {
        addFamily('decline_event');
        addFamily('demographic_event');
      }
      // Theological schism
      if (cond === 'doctrinal_conflict' || cond === 'denominational_splintering' || cond === 'leadership_fracture' || cond === 'organizational_schism') {
        addFamily('schism_event');
        addFamily('governance_event');
      }
      if (cond === 'religion_high_stress' || cond === 'structural_stress') addFamily('structural_event');
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

  window.LIMENReligionPulse = {
    computePulse: computePulse,
    getPulse: function () { return _currentState; },
    getPrevious: function () { return _previousState; },
    getHistory: function () { return _history.slice(); },
    getEvidenceContracts: function () { return EVIDENCE_CONTRACTS; },
    getFreshnessTTL: function () { return FRESHNESS_TTL; },
    getSourceTypes: function () { return SOURCE_TYPES; }
  };

  console.log('[ReligionPulse] Loaded \u2014 live feed pulse engine ready');
})();
