/**
 * law-directive-ranker.js — Score and rank extracted Law directive candidates
 *
 * Law-specific mechanism classification and depth-aware ranking.
 * Prevents shallow L0 items from dominating when richer L1-L5 directives exist.
 *
 * ADDITIVE ONLY. Feature-flagged: window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION
 * Exposes: window.LIMENLawDirectiveRanker
 */
(function () {
  'use strict';

  var EVIDENCE_SCORE = {
    'Strong': 1.0, 'A': 1.0,
    'Moderate': 0.7, 'B': 0.7,
    'Emerging': 0.4, 'C': 0.4,
    'Limited': 0.2, 'D': 0.2
  };

  var TYPE_ACTION_MAP = {
    'STRUCTURAL':  { paths: ['INVESTABLE', 'GRANT-ELIGIBLE'], weight: 0.9 },
    'DIAGNOSTIC':  { paths: ['PATENTABLE', 'GRANT-ELIGIBLE'], weight: 0.7 },
    'STRATEGY':    { paths: ['INVESTABLE', 'GRANT-ELIGIBLE'], weight: 0.85 },
    'strategy':    { paths: ['INVESTABLE', 'GRANT-ELIGIBLE'], weight: 0.85 },
    'regulatory':  { paths: ['GRANT-ELIGIBLE'], weight: 0.85 },
    'tools':       { paths: ['PATENTABLE', 'INVESTABLE'], weight: 0.75 },
    'coaching':    { paths: ['GRANT-ELIGIBLE'], weight: 0.5 },
    'COACHING':    { paths: ['GRANT-ELIGIBLE'], weight: 0.5 },
    'culture':     { paths: ['GRANT-ELIGIBLE'], weight: 0.4 },
    'structural':  { paths: ['INVESTABLE', 'GRANT-ELIGIBLE'], weight: 0.9 }
  };

  var ROLE_WEIGHT = {
    'executor': 1.0, 'router': 0.9, 'allocator': 0.85, 'gatekeeper': 0.95,
    'signal_detector': 0.75, 'buffer': 0.7, 'amplifier': 0.65,
    'stabilizer': 0.6, 'arbitrator': 0.85
  };

  var DEPTH_FACTOR = [1.0, 0.97, 0.92, 0.85, 0.75, 0.65, 0.55];

  // ══════════════════════════════════════════════════════════════════════
  // LAW-NATIVE MECHANISM CLASSIFICATION
  // ══════════════════════════════════════════════════════════════════════

  var MECHANISMS = {
    judicial_backlog:      { label: 'Judicial Backlog',         signals: ['court backlog', 'docket', 'delayed ruling', 'pending case', 'continuance', 'overcrowded court', 'judge shortage', 'case load', 'queue', 'case management'] },
    procedural_failure:    { label: 'Procedural Failure',       signals: ['procedural', 'process failure', 'due process', 'motion', 'filing error', 'service of process', 'deadline missed', 'statute of limitations', 'pleading', 'discovery'] },
    regulatory_burden:     { label: 'Regulatory Burden',        signals: ['regulation', 'compliance', 'rule', 'mandate', 'reporting', 'disclosure', 'filing requirement', 'registration', 'permit', 'license', 'approval', 'authorization'] },
    enforcement_action:    { label: 'Enforcement Action',       signals: ['enforcement', 'investigation', 'subpoena', 'audit', 'inspection', 'penalty', 'fine', 'consent decree', 'cease and desist', 'injunction', 'sanction', 'prosecution'] },
    rights_challenge:      { label: 'Rights Challenge',         signals: ['rights', 'civil liberties', 'constitutional', 'due process', 'equal protection', 'first amendment', 'fourth amendment', 'discrimination', 'civil rights', 'habeas'] },
    sentencing_pressure:   { label: 'Sentencing Pressure',      signals: ['sentencing', 'incarceration', 'prison', 'jail', 'recidivism', 'parole', 'probation', 'mandatory minimum', 'sentencing guidelines', 'plea bargain'] },
    treaty_friction:       { label: 'Treaty / Sanctions Friction', signals: ['treaty', 'international law', 'sanctions', 'sovereign', 'cross-border', 'extradition', 'OFAC', 'BIS', 'FCPA', 'foreign judgment', 'comity'] },
    contract_dispute:      { label: 'Contract Dispute',         signals: ['contract', 'breach', 'agreement', 'arbitration', 'mediation', 'settlement', 'damages', 'specific performance', 'covenant', 'indemnification'] },
    administrative_law:    { label: 'Administrative Law',       signals: ['agency', 'rulemaking', 'administrative', 'APA', 'notice and comment', 'guidance', 'interpretive rule', 'adjudication', 'agency action', 'judicial review'] },
    discovery_bottleneck:  { label: 'Discovery Bottleneck',     signals: ['discovery', 'e-discovery', 'production', 'privilege', 'document review', 'protective order', 'subpoena duces', 'interrogatory', 'deposition', 'spoliation'] }
  };

  var DX_VALID_MECHANISMS = {
    'JUDICIAL_CRISIS':              ['judicial_backlog', 'procedural_failure', 'discovery_bottleneck', 'administrative_law', 'contract_dispute'],
    'CONSTITUTIONAL_VIOLATION':     ['rights_challenge', 'procedural_failure', 'administrative_law', 'enforcement_action'],
    'REGULATORY_CAPTURE':           ['regulatory_burden', 'administrative_law', 'enforcement_action', 'rights_challenge'],
    'MASS_INCARCERATION':           ['sentencing_pressure', 'enforcement_action', 'rights_challenge', 'procedural_failure'],
    'INTERNATIONAL_LAW_BREAKDOWN':  ['treaty_friction', 'enforcement_action', 'contract_dispute', 'administrative_law']
  };

  var DRIFT_SIGNALS = ['equity program', 'community engagement', 'stakeholder alignment', 'cultural program', 'awareness campaign', 'workforce development', 'training curriculum', 'onboarding program', 'outreach initiative'];

  function classifyMechanism(d) {
    var text = ((d.treatmentLabel || '') + ' ' + (d.treatmentDescription || '') + ' '
      + (d.nodeLabel || '') + ' ' + (d.treatmentTarget || '') + ' '
      + ((d.treatmentSteps || []).join ? (d.treatmentSteps || []).join(' ') : '')).toLowerCase();

    var driftHits = 0;
    for (var di = 0; di < DRIFT_SIGNALS.length; di++) {
      if (text.indexOf(DRIFT_SIGNALS[di]) !== -1) driftHits++;
    }
    if (driftHits >= 2) {
      return { primary: null, secondary: null, score: 0, label: 'DRIFT', isDrift: true };
    }

    var scored = [];
    var mechKeys = Object.keys(MECHANISMS);
    for (var mi = 0; mi < mechKeys.length; mi++) {
      var mkey = mechKeys[mi];
      var mech = MECHANISMS[mkey];
      var hits = 0;
      for (var si = 0; si < mech.signals.length; si++) {
        if (text.indexOf(mech.signals[si]) !== -1) hits++;
      }
      if (hits > 0) scored.push({ key: mkey, label: mech.label, hits: hits });
    }

    scored.sort(function (a, b) { return b.hits - a.hits; });

    var primary = scored.length > 0 ? scored[0] : null;
    var secondary = scored.length > 1 ? scored[1] : null;

    var dxId = (d.diagnosisId || '').toUpperCase();
    var validMechs = DX_VALID_MECHANISMS[dxId] || [];
    var primaryValid = primary && validMechs.indexOf(primary.key) !== -1;
    var secondaryValid = secondary && validMechs.indexOf(secondary.key) !== -1;

    if (!primaryValid && secondaryValid) {
      var tmp = primary; primary = secondary; secondary = tmp;
      primaryValid = true;
    }

    var score = 0;
    if (primaryValid) score = 0.5 + Math.min(0.4, primary.hits * 0.08);
    else if (primary) score = 0.2 + Math.min(0.15, primary.hits * 0.03);
    if (driftHits > 0) score = Math.max(0, score - driftHits * 0.1);

    return {
      primary: primary ? primary.key : null,
      primaryLabel: primary ? primary.label : null,
      secondary: secondary ? secondary.key : null,
      secondaryLabel: secondary ? secondary.label : null,
      score: Math.max(0, Math.min(1, score)),
      label: primary ? primary.label : (driftHits > 0 ? 'DRIFT' : 'UNCLASSIFIED'),
      isDrift: driftHits >= 2,
      isValid: primaryValid
    };
  }

  function _scoreEconomicRelevance(d) {
    var mech = classifyMechanism(d);
    d._mechanism = mech;
    return mech.score;
  }

  function rank(directives) {
    if (!window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION) return [];
    if (!directives || directives.length === 0) return [];

    for (var i = 0; i < directives.length; i++) {
      var d = directives[i];

      var econRelevance = _scoreEconomicRelevance(d);
      var dxProximity = d.diagnosisId ? 1.0 : 0.3;
      var circuitEvidence = EVIDENCE_SCORE[d.circuitEvidence] || 0.3;
      var treatEvidence = EVIDENCE_SCORE[d.treatmentEvidence] || 0.3;
      var typeInfo = TYPE_ACTION_MAP[d.treatmentType] || TYPE_ACTION_MAP['STRUCTURAL'];
      var executionScore = typeInfo.weight;
      var roleScore = ROLE_WEIGHT[d.functionalRole] || 0.5;
      var urgencyScore = Math.min(1, (d.stress || 0) * 1.2);

      var monetizationScore = 0.2;
      if (d.companies && d.companies.length > 0) {
        var avgBinding = 0;
        for (var ci = 0; ci < d.companies.length; ci++) avgBinding += (d.companies[ci].bindingStrength || 0);
        avgBinding = avgBinding / d.companies.length;
        monetizationScore = 0.2 + (avgBinding * 0.8);
      }

      var richness = 0;
      var hasRealSteps = d.treatmentSteps && d.treatmentSteps.length > 0;
      var hasMonitoring = !!d.treatmentMonitoring;
      var hasEscalation = !!d.treatmentEscalation;
      var hasCitations = !!(d.treatmentCite || (d.treatmentCitation && d.treatmentCitation.length > 0));
      var hasTarget = !!d.treatmentTarget;
      var hasDescription = d.treatmentDescription && d.treatmentDescription.length > 80;

      if (hasRealSteps) richness += 0.25;
      if (hasMonitoring) richness += 0.20;
      if (hasEscalation) richness += 0.15;
      if (hasCitations) richness += 0.20;
      if (hasTarget) richness += 0.10;
      if (hasDescription) richness += 0.10;

      var depthIdx = Math.min(d.depth || 0, DEPTH_FACTOR.length - 1);
      var depthPenalty = DEPTH_FACTOR[depthIdx];
      if (richness >= 0.5) depthPenalty = Math.min(1, depthPenalty + 0.10);
      if (richness >= 0.8) depthPenalty = Math.min(1, depthPenalty + 0.10);

      var effectiveDxProx = dxProximity;
      if (dxProximity >= 0.8 && richness < 0.15) {
        effectiveDxProx = 0.5;
      }

      var raw = (
        effectiveDxProx * 0.10 +
        circuitEvidence * 0.05 +
        treatEvidence * 0.06 +
        executionScore * 0.08 +
        roleScore * 0.03 +
        urgencyScore * 0.10 +
        monetizationScore * 0.08 +
        richness * 0.22 +
        econRelevance * 0.18 +
        (d.branchRelevance || 0) * 0.04 +
        Math.min(0.06, (d.depth || 0) * 0.015 * richness)
      );

      var econMultiplier = econRelevance < 0.3 ? 0.6 : econRelevance < 0.5 ? 0.85 : 1.0;
      var rankScore = raw * depthPenalty * econMultiplier;

      var proofScore = (
        richness * 0.40 +
        (hasRealSteps ? 0.15 : 0) +
        (hasCitations ? 0.15 : 0) +
        (hasMonitoring ? 0.10 : 0) +
        (d.depth >= 1 ? 0.10 : 0) +
        (d.depth >= 2 ? 0.10 : 0)
      );

      d.scores = {
        dxProximity: effectiveDxProx,
        circuitEvidence: circuitEvidence,
        treatEvidence: treatEvidence,
        execution: executionScore,
        role: roleScore,
        urgency: urgencyScore,
        monetization: monetizationScore,
        richness: richness,
        econRelevance: econRelevance,
        depthPenalty: depthPenalty,
        econMultiplier: econMultiplier,
        proofScore: Math.round(proofScore * 1000) / 1000,
        raw: Math.round(raw * 1000) / 1000
      };
      d.rankScore = Math.round(rankScore * 1000) / 1000;
      d.proofScore = Math.round(proofScore * 1000) / 1000;
      d.suggestedPaths = typeInfo.paths;

      d._hasRealSteps = hasRealSteps;
      d._hasMonitoring = hasMonitoring;
      d._hasEscalation = hasEscalation;
      d._hasCitations = hasCitations;
      d._richness = richness;
    }

    directives.sort(function (a, b) { return b.rankScore - a.rankScore; });

    console.log('[LawRanker] Ranked ' + directives.length + '. Top: ' +
      (directives[0] ? directives[0].rankScore + ' (rich=' + directives[0]._richness + ', proof=' + directives[0].proofScore + ') ' + (directives[0].treatmentLabel || '').substring(0, 50) : 'none'));

    return directives;
  }

  window.LIMENLawDirectiveRanker = { rank: rank };
})();
