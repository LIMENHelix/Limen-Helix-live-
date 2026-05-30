/**
 * law-pulse-engine.js — Live Feed Pulse Engine for Law / Regulation Domain
 *
 * LAW DOMAIN ONLY. Evidence contracts, freshness TTLs, delta detection.
 * Self-gates: only runs when ?domain=law is in the URL.
 * Exposes: window.LIMENLawPulse
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var dom = params.get('domain');
  if (dom !== 'law') return;

  var FRESHNESS_TTL = {
    'regulatory_register': 6 * 60 * 60 * 1000,
    'docket_index':        2 * 60 * 60 * 1000,
    'enforcement_action':  4 * 60 * 60 * 1000,
    'event_cluster':       30 * 60 * 1000,
    'structural':          24 * 60 * 60 * 1000,
    'default':             10 * 60 * 1000
  };

  var SOURCE_TYPES = {
    'Federal Register':            'regulatory_register',
    'Regulations.gov':             'regulatory_register',
    'CourtListener':               'docket_index',
    'PACER Docket Activity':       'docket_index',
    'DOJ Press Releases':          'enforcement_action',
    'SEC Enforcement Actions':     'enforcement_action',
    'CFPB Enforcement':            'enforcement_action',
    'OSHA Enforcement':            'enforcement_action',
    'EPA Enforcement':             'enforcement_action',
    'USCIS Policy Alerts':         'regulatory_register',
    'U.S. Courts Federal Caseload':'docket_index',
    'HHS AFCARS Family Court':     'event_cluster',
    'Supreme Court Opinions':      'event_cluster'
  };

  var EVIDENCE_CONTRACTS = {
    'JUDICIAL_CRISIS': {
      label: 'Judicial Crisis',
      requiredFamilies: ['judicial_event', 'docket_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.docket_index,
      primaryIndicators: ['court_backlog', 'delayed_rulings', 'procedural_bottleneck'],
      secondaryConfirmation: ['permitting_slowdown', 'blocked_approvals'],
      catchAllBlocked: true
    },
    'CONSTITUTIONAL_VIOLATION': {
      label: 'Constitutional Violation',
      requiredFamilies: ['rights_event', 'judicial_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['rights_challenge', 'due_process_failure', 'overreach'],
      secondaryConfirmation: ['constitutional_conflict'],
      catchAllBlocked: true
    },
    'REGULATORY_CAPTURE': {
      label: 'Regulatory Capture',
      requiredFamilies: ['regulatory_event', 'enforcement_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.regulatory_register,
      primaryIndicators: ['regulatory_favoritism', 'enforcement_bias', 'agency_capture'],
      secondaryConfirmation: ['rule_expansion', 'compliance_burden'],
      catchAllBlocked: true
    },
    'MASS_INCARCERATION': {
      label: 'Mass Incarceration',
      requiredFamilies: ['enforcement_event', 'sentencing_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['sentencing_surge', 'overcrowding', 'recidivism_spike'],
      secondaryConfirmation: ['enforcement_escalation'],
      catchAllBlocked: false
    },
    'INTERNATIONAL_LAW_BREAKDOWN': {
      label: 'International Law Breakdown',
      requiredFamilies: ['treaty_event', 'sanctions_event'],
      minimumEvidence: 1,
      freshnessThreshold: FRESHNESS_TTL.event_cluster,
      primaryIndicators: ['treaty_violation', 'sanctions_conflict', 'sovereignty_dispute'],
      secondaryConfirmation: ['cross_border_mismatch'],
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
      if (cond === 'court_backlog' || cond === 'delayed_rulings' || cond === 'procedural_bottleneck') {
        addFamily('judicial_event');
        addFamily('docket_event');
      }
      if (cond === 'permitting_slowdown' || cond === 'blocked_approvals') {
        addFamily('docket_event');
      }
      if (cond === 'rights_challenge' || cond === 'due_process_failure' || cond === 'overreach' || cond === 'constitutional_conflict') {
        addFamily('rights_event');
        addFamily('judicial_event');
      }
      if (cond === 'rule_expansion' || cond === 'compliance_burden' || cond === 'reporting_overload') {
        addFamily('regulatory_event');
      }
      if (cond === 'regulatory_favoritism' || cond === 'enforcement_bias' || cond === 'agency_capture') {
        addFamily('regulatory_event');
        addFamily('enforcement_event');
      }
      if (cond === 'enforcement_escalation' || cond === 'sentencing_surge' || cond === 'overcrowding' || cond === 'recidivism_spike') {
        addFamily('enforcement_event');
        addFamily('sentencing_event');
      }
      if (cond === 'treaty_violation' || cond === 'sanctions_conflict' || cond === 'sovereignty_dispute' || cond === 'cross_border_mismatch') {
        addFamily('treaty_event');
        addFamily('sanctions_event');
      }
      if (cond === 'macro_shock') addFamily('macro_event');
      if (cond === 'law_high_stress' || cond === 'structural_stress') addFamily('structural_event');
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

  window.LIMENLawPulse = {
    computePulse: computePulse,
    getPulse: function () { return _currentState; },
    getPrevious: function () { return _previousState; },
    getHistory: function () { return _history.slice(); },
    getEvidenceContracts: function () { return EVIDENCE_CONTRACTS; },
    getFreshnessTTL: function () { return FRESHNESS_TTL; },
    getSourceTypes: function () { return SOURCE_TYPES; }
  };

  console.log('[LawPulse] Loaded \u2014 live feed pulse engine ready');
})();
