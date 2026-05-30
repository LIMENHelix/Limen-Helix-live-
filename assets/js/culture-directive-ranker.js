/**
 * environment-directive-ranker.js — Score and rank extracted Culture directive candidates
 *
 * Science-specific mechanism classification and depth-aware ranking.
 * Prevents shallow L0 items from dominating when richer L1-L5 directives exist.
 *
 * ADDITIVE ONLY. Feature-flagged: window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION
 * Exposes: window.LIMENCultureDirectiveRanker
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
    'regulatory':  { paths: ['GRANT-ELIGIBLE'], weight: 0.75 },
    'tools':       { paths: ['PATENTABLE', 'INVESTABLE'], weight: 0.85 },
    'coaching':    { paths: ['GRANT-ELIGIBLE'], weight: 0.5 },
    'COACHING':    { paths: ['GRANT-ELIGIBLE'], weight: 0.5 },
    'culture':     { paths: ['GRANT-ELIGIBLE'], weight: 0.4 },
    'structural':  { paths: ['INVESTABLE', 'GRANT-ELIGIBLE'], weight: 0.9 }
  };

  var ROLE_WEIGHT = {
    'executor': 1.0, 'router': 0.85, 'allocator': 0.9, 'gatekeeper': 0.85,
    'signal_detector': 0.95, 'buffer': 0.7, 'amplifier': 0.7,
    'stabilizer': 0.65, 'arbitrator': 0.75
  };

  var DEPTH_FACTOR = [1.0, 0.97, 0.92, 0.85, 0.75, 0.65, 0.55];

  // ══════════════════════════════════════════════════════════════════════
  // CULTURE-NATIVE MECHANISM CLASSIFICATION
  // ══════════════════════════════════════════════════════════════════════

  var MECHANISMS = {
    identity_fracture:           { label: 'Identity Fracture',           signals: ['identity', 'diaspora', 'assimilation', 'cultural loss', 'language death', 'endangered language', 'indigenous', 'minority culture', 'ethnic identity', 'cultural extinction'] },
    cultural_loss:               { label: 'Cultural Loss',               signals: ['cultural loss', 'tradition', 'folk art', 'oral history', 'intangible heritage', 'endangered', 'disappearing', 'last speaker', 'practitioner', 'craft'] },
    symbolic_disunity:           { label: 'Symbolic Disunity',           signals: ['monument', 'statue', 'flag', 'symbol', 'rename', 'contested', 'memorial', 'public art', 'national symbol', 'iconoclasm'] },
    social_cohesion_erosion:     { label: 'Social Cohesion Erosion',     signals: ['polarization', 'trust', 'social cohesion', 'division', 'fragmentation', 'civic', 'community', 'bridging', 'common ground', 'solidarity'] },
    heritage_loss:               { label: 'Heritage Loss',               signals: ['heritage', 'UNESCO', 'world heritage', 'preservation', 'conservation', 'restoration', 'cultural property', 'antiquities', 'archaeological', 'historic site'] },
    monument_destruction:        { label: 'Monument Destruction',        signals: ['destruction', 'demolition', 'damage', 'fire', 'earthquake', 'conflict', 'looting', 'vandalism', 'Notre-Dame', 'Palmyra'] },
    archive_degradation:         { label: 'Archive Degradation',         signals: ['archive', 'library', 'museum', 'collection', 'digitization', 'preservation', 'deterioration', 'film vault', 'manuscript', 'catalog'] },
    cultural_manipulation:       { label: 'Cultural Manipulation',       signals: ['propaganda', 'rewriting history', 'revisionism', 'cultural appropriation', 'weaponized narrative', 'state media', 'disinformation', 'cultural warfare'] },
    expression_suppression:      { label: 'Expression Suppression',      signals: ['censorship', 'ban', 'suppress', 'book ban', 'deplatform', 'content removal', 'artistic freedom', 'free speech', 'takedown', 'silenced'] },
    narrative_monopolization:    { label: 'Narrative Monopolization',    signals: ['monopoly', 'state media', 'propaganda', 'single narrative', 'media consolidation', 'platform power', 'algorithm', 'amplification', 'echo chamber'] },
    ideology_lockin:             { label: 'Ideology Lock-in',            signals: ['ideology', 'orthodoxy', 'dogma', 'cancel culture', 'DEI', 'compelled speech', 'loyalty oath', 'indoctrination', 'groupthink', 'conformity'] },
    interpretive_narrowing:      { label: 'Interpretive Narrowing',      signals: ['interpretation', 'criticism', 'canon', 'curriculum', 'approved reading', 'authorized version', 'decolonize', 'gatekeeping', 'academic freedom'] },
    value_conflict:              { label: 'Value Conflict',              signals: ['culture war', 'values', 'generational', 'traditionalist', 'progressive', 'conservative', 'liberal', 'moral', 'ethical divide', 'worldview'] },
    tribal_segmentation:         { label: 'Tribal Segmentation',         signals: ['tribe', 'bubble', 'echo chamber', 'silo', 'partisan', 'us vs them', 'in-group', 'out-group', 'identity politics', 'faction'] },
    norm_instability:            { label: 'Norm Instability',            signals: ['norms', 'shifting', 'gender roles', 'family structure', 'workplace culture', 'etiquette', 'manners', 'acceptable behavior', 'social change'] },
    ritual_confusion:            { label: 'Ritual Confusion',            signals: ['ritual', 'ceremony', 'tradition', 'holiday', 'rite of passage', 'funeral', 'wedding', 'graduation', 'celebration', 'gathering'] },
    participation_decay:         { label: 'Participation Decay',         signals: ['attendance', 'participation', 'engagement', 'declining audience', 'empty seats', 'ticket sales', 'membership', 'viewership', 'readership'] },
    audience_collapse:           { label: 'Audience Collapse',           signals: ['audience loss', 'subscriber', 'churn', 'cord-cutting', 'newspaper', 'magazine', 'classical music', 'indie film', 'arts funding'] },
    creative_weakness:           { label: 'Creative Weakness',           signals: ['sequel', 'franchise', 'derivative', 'risk-averse', 'formulaic', 'stagnant', 'repetitive', 'innovation', 'originality', 'creative decline'] },
    institutional_decline:       { label: 'Institutional Decline',       signals: ['museum closure', 'theater closure', 'orchestra', 'bankruptcy', 'funding cut', 'endowment', 'deficit', 'staff reduction', 'institutional crisis'] }
  };

  var DX_VALID_MECHANISMS = {
    'CULTURAL_ERASURE':       ['identity_fracture', 'cultural_loss', 'symbolic_disunity', 'social_cohesion_erosion'],
    'HERITAGE_DESTRUCTION':   ['heritage_loss', 'monument_destruction', 'archive_degradation', 'cultural_manipulation'],
    'CENSORSHIP':             ['expression_suppression', 'narrative_monopolization', 'ideology_lockin', 'interpretive_narrowing'],
    'IDENTITY_CRISIS':        ['value_conflict', 'tribal_segmentation', 'norm_instability', 'ritual_confusion'],
    'CREATIVE_STAGNATION':    ['participation_decay', 'audience_collapse', 'creative_weakness', 'institutional_decline']
  };

  var DRIFT_SIGNALS = ['general awareness', 'stakeholder alignment', 'community engagement', 'cultural sensitivity training', 'diversity workshop', 'inclusion program', 'general outreach', 'onboarding program'];

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

    console.log('[ScienceRanker] Ranked ' + directives.length + '. Top: ' +
      (directives[0] ? directives[0].rankScore + ' (rich=' + directives[0]._richness + ', proof=' + directives[0].proofScore + ') ' + (directives[0].treatmentLabel || '').substring(0, 50) : 'none'));

    return directives;
  }

  window.LIMENCultureDirectiveRanker = { rank: rank };
})();
