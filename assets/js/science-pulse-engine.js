/**
 * science-pulse-engine.js — Live Feed Pulse Engine for Science / Research Domain
 *
 * SCIENCE DOMAIN ONLY. Evidence contracts, freshness TTLs, delta detection.
 * Self-gates: only runs when ?domain=science or ?domain=research is in the URL.
 * Exposes: window.LIMENSciencePulse
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var dom = params.get('domain');
  if (dom !== 'science' && dom !== 'research') return;

  var FRESHNESS_TTL = {
    'literature_index':    12 * 60 * 60 * 1000,   // PubMed / arXiv update slowly
    'preprint_index':      6 * 60 * 60 * 1000,    // arXiv preprints
    'integrity_feed':      4 * 60 * 60 * 1000,    // Retraction Watch
    'funding_feed':        24 * 60 * 60 * 1000,   // NSF / NIH announcements
    'press_feed':          2 * 60 * 60 * 1000,    // Nature/Science press
    'event_cluster':       30 * 60 * 1000,
    'structural':          24 * 60 * 60 * 1000,
    'default':             10 * 60 * 1000
  };

  var SOURCE_TYPES = {
    'PubMed':                    'literature_index',
    'arXiv All':                 'preprint_index',
    'arXiv CS':                  'preprint_index',
    'OpenAlex Institutions':     'literature_index',
    'NSF Awards':                'funding_feed',
    'NIH Grants':                'funding_feed',
    'Retraction Watch':          'integrity_feed',
    'Nature News':               'press_feed',
    'Science Magazine':          'press_feed',
    'NASA NTRS':                 'literature_index'
  };

  var EVIDENCE_CONTRACTS = {
    'REPLICATION_CRISIS': {
      label: 'Replication Crisis',
      requiredFamilies: ['integrity_event', 'literature_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.integrity_feed,
      primaryIndicators: ['replication_failure', 'methodology_weakness', 'retraction_surge'],
      secondaryConfirmation: ['data_integrity', 'data_fragmentation'],
      catchAllBlocked: true
    },
    'FUNDING_COLLAPSE': {
      label: 'Funding Collapse',
      requiredFamilies: ['funding_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.funding_feed,
      primaryIndicators: ['funding_cut', 'grant_decline', 'budget_constraint'],
      secondaryConfirmation: ['funding_gap'],
      catchAllBlocked: true
    },
    'DATA_FRAUD': {
      label: 'Data Fraud',
      requiredFamilies: ['integrity_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.integrity_feed,
      primaryIndicators: ['data_integrity', 'retraction_surge', 'misconduct', 'fraud_detected'],
      secondaryConfirmation: [],
      catchAllBlocked: true
    },
    'PARADIGM_CONFLICT': {
      label: 'Paradigm Conflict',
      requiredFamilies: ['literature_event', 'press_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['paradigm_challenge', 'theoretical_dispute', 'breakthrough_claim'],
      secondaryConfirmation: ['consensus_breakdown'],
      catchAllBlocked: false
    },
    'BRAIN_DRAIN': {
      label: 'Brain Drain',
      requiredFamilies: ['workforce_event', 'funding_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['talent_loss', 'researcher_exodus', 'workforce_gap'],
      secondaryConfirmation: ['institutional_decline'],
      catchAllBlocked: true
    },
    'PUBLICATION_BIAS': {
      label: 'Publication Bias',
      requiredFamilies: ['literature_event', 'integrity_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.literature_index,
      primaryIndicators: ['publication_skew', 'reporting_gap', 'negative_result_suppression'],
      secondaryConfirmation: ['data_fragmentation'],
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
      if (cond === 'replication_failure' || cond === 'methodology_weakness') addFamily('integrity_event');
      if (cond === 'data_integrity' || cond === 'retraction_surge' || cond === 'misconduct' || cond === 'fraud_detected') addFamily('integrity_event');
      if (cond === 'publication_skew' || cond === 'reporting_gap' || cond === 'negative_result_suppression' || cond === 'data_fragmentation') {
        addFamily('literature_event');
        addFamily('integrity_event');
      }
      if (cond === 'paradigm_challenge' || cond === 'theoretical_dispute' || cond === 'breakthrough_claim' || cond === 'consensus_breakdown') {
        addFamily('literature_event');
        addFamily('press_event');
      }
      if (cond === 'funding_cut' || cond === 'grant_decline' || cond === 'budget_constraint' || cond === 'funding_gap') addFamily('funding_event');
      if (cond === 'talent_loss' || cond === 'researcher_exodus' || cond === 'workforce_gap' || cond === 'institutional_decline') {
        addFamily('workforce_event');
        addFamily('funding_event');
      }
      if (cond === 'science_high_stress' || cond === 'structural_stress') addFamily('structural_event');
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

  window.LIMENSciencePulse = {
    computePulse: computePulse,
    getPulse: function () { return _currentState; },
    getPrevious: function () { return _previousState; },
    getHistory: function () { return _history.slice(); },
    getEvidenceContracts: function () { return EVIDENCE_CONTRACTS; },
    getFreshnessTTL: function () { return FRESHNESS_TTL; },
    getSourceTypes: function () { return SOURCE_TYPES; }
  };

  console.log('[SciencePulse] Loaded \u2014 live feed pulse engine ready');
})();
