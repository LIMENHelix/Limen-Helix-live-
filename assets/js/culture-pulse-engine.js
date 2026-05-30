/**
 * culture-pulse-engine.js — Live Feed Pulse Engine for Culture Domain
 *
 * CULTURE DOMAIN ONLY. Evidence contracts, freshness TTLs, delta detection.
 * Self-gates: only runs when ?domain=culture is in the URL.
 * Exposes: window.LIMENCulturePulse
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var dom = params.get('domain');
  if (dom !== 'culture') return;

  var FRESHNESS_TTL = {
    'heritage_feed':        6 * 60 * 60 * 1000,    // UNESCO, NEA, NEH heritage reports
    'expression_feed':      4 * 60 * 60 * 1000,    // PEN America, press freedom, book bans
    'arts_institutional':   12 * 60 * 60 * 1000,   // NEA/NEH grants, Smithsonian, Getty
    'cultural_media':       2 * 60 * 60 * 1000,    // Art Newspaper, Variety, cultural journalism
    'cultural_trend':       1 * 60 * 60 * 1000,    // Hypebeast, Pitchfork, trend signals
    'identity_feed':        12 * 60 * 60 * 1000,   // Pew cultural attitudes, Gallup social cohesion
    'creative_feed':        6 * 60 * 60 * 1000,    // Billboard, box office, streaming data
    'event_cluster':        30 * 60 * 1000,
    'structural':           24 * 60 * 60 * 1000,
    'default':              10 * 60 * 1000
  };

  var SOURCE_TYPES = {
    'NEA News':                  'arts_institutional',
    'NEH News':                  'arts_institutional',
    'UNESCO Culture':            'heritage_feed',
    'PEN America':               'expression_feed',
    'Art Newspaper':             'cultural_media',
    'Variety Entertainment':     'cultural_media',
    'Hypebeast Trends':          'cultural_trend',
    'Pitchfork Music':           'cultural_trend',
    'Event Registry':            'cultural_media',
    'RSS Culture':               'cultural_media'
  };

  var EVIDENCE_CONTRACTS = {
    'CULTURAL_ERASURE': {
      label: 'Cultural Erasure',
      requiredFamilies: ['heritage_event', 'identity_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.heritage_feed,
      primaryIndicators: ['identity_fracture', 'cultural_loss', 'symbolic_disunity', 'social_cohesion_erosion'],
      secondaryConfirmation: ['heritage_loss'],
      catchAllBlocked: true
    },
    'HERITAGE_DESTRUCTION': {
      label: 'Heritage Destruction',
      requiredFamilies: ['heritage_event', 'institutional_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.heritage_feed,
      primaryIndicators: ['heritage_loss', 'monument_destruction', 'archive_degradation', 'cultural_manipulation'],
      secondaryConfirmation: [],
      catchAllBlocked: true
    },
    'CENSORSHIP': {
      label: 'Censorship',
      requiredFamilies: ['expression_event', 'institutional_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.expression_feed,
      primaryIndicators: ['expression_suppression', 'narrative_monopolization', 'ideology_lockin', 'interpretive_narrowing'],
      secondaryConfirmation: [],
      catchAllBlocked: true
    },
    'IDENTITY_CRISIS': {
      label: 'Identity Crisis',
      requiredFamilies: ['identity_event', 'cohesion_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.identity_feed,
      primaryIndicators: ['value_conflict', 'tribal_segmentation', 'norm_instability', 'ritual_confusion'],
      secondaryConfirmation: ['social_cohesion_erosion'],
      catchAllBlocked: true
    },
    'CREATIVE_STAGNATION': {
      label: 'Creative Stagnation',
      requiredFamilies: ['creative_event', 'institutional_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.creative_feed,
      primaryIndicators: ['participation_decay', 'audience_collapse', 'creative_weakness', 'institutional_decline'],
      secondaryConfirmation: ['structural_stress'],
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
      // Cultural erasure
      if (cond === 'identity_fracture' || cond === 'cultural_loss' || cond === 'symbolic_disunity' || cond === 'social_cohesion_erosion') {
        addFamily('heritage_event');
        addFamily('identity_event');
      }
      // Heritage destruction
      if (cond === 'heritage_loss' || cond === 'monument_destruction' || cond === 'archive_degradation' || cond === 'cultural_manipulation') {
        addFamily('heritage_event');
        addFamily('institutional_event');
      }
      // Censorship
      if (cond === 'expression_suppression' || cond === 'narrative_monopolization' || cond === 'ideology_lockin' || cond === 'interpretive_narrowing') {
        addFamily('expression_event');
        addFamily('institutional_event');
      }
      // Identity crisis
      if (cond === 'value_conflict' || cond === 'tribal_segmentation' || cond === 'norm_instability' || cond === 'ritual_confusion') {
        addFamily('identity_event');
        addFamily('cohesion_event');
      }
      // Creative stagnation
      if (cond === 'participation_decay' || cond === 'audience_collapse' || cond === 'creative_weakness' || cond === 'institutional_decline' || cond === 'disengagement') {
        addFamily('creative_event');
        addFamily('institutional_event');
      }
      if (cond === 'culture_high_stress' || cond === 'structural_stress') addFamily('structural_event');
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

  window.LIMENCulturePulse = {
    computePulse: computePulse,
    getPulse: function () { return _currentState; },
    getPrevious: function () { return _previousState; },
    getHistory: function () { return _history.slice(); },
    getEvidenceContracts: function () { return EVIDENCE_CONTRACTS; },
    getFreshnessTTL: function () { return FRESHNESS_TTL; },
    getSourceTypes: function () { return SOURCE_TYPES; }
  };

  console.log('[CulturePulse] Loaded \u2014 live feed pulse engine ready');
})();
