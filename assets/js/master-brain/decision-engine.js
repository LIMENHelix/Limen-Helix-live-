/**
 * LIMEN Master Brain — Decision Engine — Phase 2
 *
 * Deterministic classifier over the Observatory Input Bundle (OIB).
 * Reads window.LIMENMasterBrain.getOIB() (or an injected OIB via opts),
 * returns a fresh MasterBrainDecision[] array. No LLM. No async. No I/O.
 *
 * Exposes: window.LIMENMasterBrain.decide(opts?)
 *
 * Spec: Master Brain spec §3 (source-count), §4 (decision schema),
 * §6 (auto-emit safe classes).
 *
 * Allowed output classes (Phase 2 only):
 *   - no_action
 *   - insufficient_evidence
 *   - executive_synthesis   (high-tier gate + 3-source binding)
 *   - contradiction         (one per unique conflict)
 *
 * Invariants:
 *   - executionAllowed === false on every decision (asserted).
 *   - confidenceScore <= min(tier scores of bound refs). Never upgrades.
 *   - evidenceRefs.length >= 1 on every decision.
 *   - executive_synthesis requires >=3 refs AND civilization+domains bound.
 *
 * Not in this phase: artifact_request, strategic_option, review-queue
 * routing, persistence, telemetry, events, UI rendering, timers.
 */
(function () {
  'use strict';

  // ── Tier scoring (midpoints of evidence-builder bands) ─────────────
  var TIER_SCORE = { high: 0.85, moderate: 0.65, low: 0.45, insufficient: 0.25 };
  var TIER_BANDS = [
    { min: 0.75, tier: 'high' },
    { min: 0.55, tier: 'moderate' },
    { min: 0.40, tier: 'low' }
  ];

  // ── Penalty tables ────────────────────────────────────────────────
  var RULE_PENALTY = {
    no_action:             1.0,
    insufficient_evidence: 1.0,
    contradiction:         1.0,
    executive_synthesis:   0.9
  };
  var FRESHNESS_HIGH_MS     = 60000;
  var FRESHNESS_STALE_PEN   = 0.1;
  var FRESHNESS_NULL_PEN    = 0.2;
  var INSUFFICIENT_CAP      = 0.39; // floors.admissibility − ε

  // ── Decision-id counter (monotonic per session) ───────────────────
  var _decisionCounter = 0;
  function _nextDecisionId(cycleId) {
    _decisionCounter += 1;
    return 'mbd-' + cycleId + '-' + _decisionCounter;
  }

  function _isFiniteNumber(x) { return typeof x === 'number' && isFinite(x); }

  function _tierScore(tier) {
    return Object.prototype.hasOwnProperty.call(TIER_SCORE, tier)
      ? TIER_SCORE[tier] : TIER_SCORE.insufficient;
  }

  function _deriveTier(score) {
    for (var i = 0; i < TIER_BANDS.length; i++) {
      if (score >= TIER_BANDS[i].min) return TIER_BANDS[i].tier;
    }
    return 'insufficient';
  }

  function _freshnessPenalty(refs) {
    var hasNull  = false;
    var hasStale = false;
    for (var i = 0; i < refs.length; i++) {
      var f = refs[i].freshnessMs;
      if (f === null || typeof f === 'undefined') { hasNull = true; continue; }
      if (_isFiniteNumber(f) && f >= FRESHNESS_HIGH_MS) hasStale = true;
    }
    if (hasNull)  return FRESHNESS_NULL_PEN;
    if (hasStale) return FRESHNESS_STALE_PEN;
    return 0.0;
  }

  function _buildRef(source, pointerPath, envelope) {
    return {
      source:       source,
      pointerPath:  pointerPath,
      freshnessMs:  envelope ? envelope.freshnessMs : null,
      trustTier:    envelope ? envelope.trustTier   : 'insufficient'
    };
  }

  function _envOf(oib, key) {
    return oib && oib.envelopes && oib.envelopes.perSource
      ? oib.envelopes.perSource[key] : null;
  }

  // ── Admissibility gate ────────────────────────────────────────────
  function _admissibilityCheck(oib) {
    var reasons = [];
    var refs    = [];
    var adm     = oib.admissibility || {};
    var floors  = adm.floors || {};
    var civEnv  = _envOf(oib, 'civilization');
    var domEnv  = _envOf(oib, 'domains');

    if (!_isFiniteNumber(adm.overallConfidence)) {
      reasons.push('overallConfidence_null');
      refs.push(_buildRef('admissibility', '/admissibility/overallConfidence', civEnv));
    } else if (adm.overallConfidence < (floors.admissibility != null ? floors.admissibility : 0.40)) {
      reasons.push('overallConfidence_below_floor');
      refs.push(_buildRef('admissibility', '/admissibility/overallConfidence', civEnv));
    }
    if (!civEnv || civEnv.available === false) {
      reasons.push('civilization_unavailable');
      refs.push(_buildRef('envelopes.civilization', '/envelopes/perSource/civilization', civEnv));
    }
    if (!domEnv || domEnv.available === false) {
      reasons.push('domains_unavailable');
      refs.push(_buildRef('envelopes.domains', '/envelopes/perSource/domains', domEnv));
    }
    return { pass: reasons.length === 0, reasons: reasons, failingRefs: refs };
  }

  // ── Conflict enumeration (defensive re-dedup on type:scaleA:scaleB) ─
  function _enumerateConflicts(oib) {
    var list  = [];
    var seen  = {};
    var civ   = oib.sources && oib.sources.civilization ? oib.sources.civilization : null;
    var src   = (civ && Array.isArray(civ.conflicts)) ? civ.conflicts : [];
    for (var i = 0; i < src.length; i++) {
      var c   = src[i] || {};
      var key = (c.type || '') + ':' + (c.scaleA || '') + ':' + (c.scaleB || '');
      if (seen[key]) continue;
      seen[key] = true;
      list.push({ index: i, conflict: c });
    }
    return list;
  }

  // ── Synthesis ref binding (civilization + domains + >=1 extra) ────
  function _bindSynthesisRefs(oib) {
    var civEnv = _envOf(oib, 'civilization');
    var domEnv = _envOf(oib, 'domains');
    if (!civEnv || civEnv.available === false) return null;
    if (!domEnv || domEnv.available === false) return null;
    var refs = [
      _buildRef('civilization', '/sources/civilization',       civEnv),
      _buildRef('domains',      '/sources/domains',            domEnv)
    ];
    var extras = ['reports', 'globalState', 'polarity', 'regulation', 'patentOpp'];
    for (var i = 0; i < extras.length; i++) {
      var e = _envOf(oib, extras[i]);
      if (e && e.available) {
        refs.push(_buildRef(extras[i], '/sources/' + extras[i], e));
        break;
      }
    }
    return refs.length >= 3 ? refs : null;
  }

  function _heuristicLabels(klass, oib) {
    if (klass !== 'executive_synthesis') return [];
    var civ = oib.sources && oib.sources.civilization ? oib.sources.civilization : null;
    var pred = civ && civ.evidence ? civ.evidence.predictive : null;
    return pred ? ['civilization-evidence-heuristic'] : [];
  }

  function _projectConfidence(klass, refs) {
    if (!refs || refs.length === 0) return 0;
    var minScore = 1;
    for (var i = 0; i < refs.length; i++) {
      var s = _tierScore(refs[i].trustTier);
      if (s < minScore) minScore = s;
    }
    var penalty = Object.prototype.hasOwnProperty.call(RULE_PENALTY, klass)
      ? RULE_PENALTY[klass] : 1.0;
    var score = minScore * penalty * (1 - _freshnessPenalty(refs));
    if (score < 0) score = 0;
    if (score > 1) score = 1;
    if (klass === 'insufficient_evidence' && score > INSUFFICIENT_CAP) score = INSUFFICIENT_CAP;
    return score;
  }

  function _buildDecision(spec) {
    var score = _projectConfidence(spec.klass, spec.refs);
    var tier  = _deriveTier(score);
    // Safety downgrade: executive_synthesis must be high; else fall to no_action.
    if (spec.klass === 'executive_synthesis' && tier !== 'high') {
      spec.klass          = 'no_action';
      spec.heuristicLabels = [];
      spec.proposal       = {
        text: 'No action: synthesis confidence did not clear high-tier gate.',
        proposedNext: 'none',
        payload: {}
      };
      score = _projectConfidence('no_action', spec.refs);
      tier  = _deriveTier(score);
    }
    var d = {
      id:                  _nextDecisionId(spec.oib.cycleId),
      cycleId:             spec.oib.cycleId,
      generatedAt:         Date.now(),
      class:               spec.klass,
      subject:             spec.subject || {},
      confidenceScore:     score,
      confidenceTier:      tier,
      evidenceRefs:        spec.refs.slice(),
      contradictions:      spec.contradictions || [],
      proposal:            spec.proposal,
      heuristicLabels:     spec.heuristicLabels || [],
      humanReviewRequired: false,
      executionAllowed:    false
    };
    if (d.executionAllowed !== false) {
      throw new Error('LIMENMasterBrain.decide: executionAllowed invariant violated');
    }
    return d;
  }

  function _proposalForInsufficient(reasons) {
    return {
      text: 'Insufficient evidence: ' + (reasons.join(', ') || 'unspecified') + '.',
      proposedNext: 'archive',
      payload: { reasons: reasons.slice() }
    };
  }

  function _proposalForContradiction(c) {
    return {
      text: (c.type || 'contradiction') + ': ' + (c.scaleA || '?') + ' vs ' + (c.scaleB || '?') + '.',
      proposedNext: 'schedule_review',
      payload: { conflict: {
        type:          c.type          || null,
        scaleA:        c.scaleA        || null,
        scaleB:        c.scaleB        || null,
        confidenceGap: _isFiniteNumber(c.confidenceGap) ? c.confidenceGap : null
      } }
    };
  }

  function _proposalForSynthesis(oib, refCount) {
    var civ = oib.sources && oib.sources.civilization ? oib.sources.civilization : null;
    var txt = (civ && typeof civ.summary === 'string' && civ.summary)
      ? civ.summary
      : 'Executive synthesis bound to ' + refCount + ' evidence refs.';
    return { text: txt, proposedNext: 'route_to_domain', payload: { refCount: refCount } };
  }

  function _proposalForNoAction() {
    return { text: 'No action: admissibility passed; no synthesis signal.', proposedNext: 'none', payload: {} };
  }

  // ── Public entry ──────────────────────────────────────────────────
  function decide(opts) {
    var oib = (opts && opts.oib) ? opts.oib :
      (typeof window !== 'undefined' && window.LIMENMasterBrain && typeof window.LIMENMasterBrain.getOIB === 'function')
        ? window.LIMENMasterBrain.getOIB() : null;
    if (!oib || !oib.cycleId || !oib.admissibility || !oib.envelopes) return [];

    var decisions = [];
    var adm       = _admissibilityCheck(oib);
    var civEnv    = _envOf(oib, 'civilization');

    if (!adm.pass) {
      decisions.push(_buildDecision({
        klass:          'insufficient_evidence',
        oib:            oib,
        refs:           adm.failingRefs.length ? adm.failingRefs
                         : [_buildRef('admissibility', '/admissibility', civEnv)],
        contradictions: [],
        subject:        {},
        heuristicLabels: [],
        proposal:       _proposalForInsufficient(adm.reasons)
      }));
      return decisions;
    }

    var conflicts = _enumerateConflicts(oib);
    for (var i = 0; i < conflicts.length; i++) {
      var c  = conflicts[i].conflict;
      var ix = conflicts[i].index;
      decisions.push(_buildDecision({
        klass: 'contradiction',
        oib:   oib,
        refs:  [
          _buildRef('civilization.conflicts', '/sources/civilization/conflicts/' + ix, civEnv),
          _buildRef('civilization',           '/sources/civilization',                 civEnv)
        ],
        contradictions: [{
          refA:      { scale: c.scaleA || null },
          refB:      { scale: c.scaleB || null },
          type:      c.type || 'contradiction',
          magnitude: _isFiniteNumber(c.confidenceGap) ? c.confidenceGap : null
        }],
        subject:         { scale: c.scaleA || null, patternClass: c.type || null },
        heuristicLabels: [],
        proposal:        _proposalForContradiction(c)
      }));
    }

    if (conflicts.length === 0) {
      var synthRefs = (oib.admissibility.overallTier === 'high') ? _bindSynthesisRefs(oib) : null;
      var floors    = oib.admissibility.floors || {};
      var minSrcs   = _isFiniteNumber(floors.synthesisMinSources) ? floors.synthesisMinSources : 3;
      if (synthRefs && synthRefs.length >= minSrcs) {
        decisions.push(_buildDecision({
          klass:           'executive_synthesis',
          oib:             oib,
          refs:            synthRefs,
          contradictions:  [],
          subject:         { scale: 'civilization' },
          heuristicLabels: _heuristicLabels('executive_synthesis', oib),
          proposal:        _proposalForSynthesis(oib, synthRefs.length)
        }));
      } else {
        decisions.push(_buildDecision({
          klass:           'no_action',
          oib:             oib,
          refs:            [_buildRef('civilization', '/sources/civilization', civEnv)],
          contradictions:  [],
          subject:         {},
          heuristicLabels: [],
          proposal:        _proposalForNoAction()
        }));
      }
    }
    return decisions;
  }

  if (typeof window !== 'undefined') {
    window.LIMENMasterBrain = window.LIMENMasterBrain || {};
    window.LIMENMasterBrain.decide = decide;
  }
})();
