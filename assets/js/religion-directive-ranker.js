/**
 * environment-directive-ranker.js — Score and rank extracted Religion directive candidates
 *
 * Science-specific mechanism classification and depth-aware ranking.
 * Prevents shallow L0 items from dominating when richer L1-L5 directives exist.
 *
 * ADDITIVE ONLY. Feature-flagged: window.LIMEN_ENABLE_DIRECTIVE_EXTRACTION
 * Exposes: window.LIMENReligionDirectiveRanker
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
    'religion':     { paths: ['GRANT-ELIGIBLE'], weight: 0.4 },
    'structural':  { paths: ['INVESTABLE', 'GRANT-ELIGIBLE'], weight: 0.9 }
  };

  var ROLE_WEIGHT = {
    'executor': 1.0, 'router': 0.85, 'allocator': 0.9, 'gatekeeper': 0.85,
    'signal_detector': 0.95, 'buffer': 0.7, 'amplifier': 0.7,
    'stabilizer': 0.65, 'arbitrator': 0.75
  };

  var DEPTH_FACTOR = [1.0, 0.97, 0.92, 0.85, 0.75, 0.65, 0.55];

  // ══════════════════════════════════════════════════════════════════════
  // RELIGION-NATIVE MECHANISM CLASSIFICATION
  // ══════════════════════════════════════════════════════════════════════

  var MECHANISMS = {
    sectarian_escalation:        { label: 'Sectarian Escalation',        signals: ['sectarian', 'sunni', 'shia', 'hindu muslim', 'christian muslim', 'communal violence', 'religious war', 'ethnic cleansing', 'pogrom', 'riot', 'mob violence'] },
    identity_hardening:          { label: 'Identity Hardening',          signals: ['hindutva', 'islamist', 'christian nationalist', 'ultra-orthodox', 'zionist', 'jihadist', 'religious identity', 'us vs them', 'in-group', 'out-group', 'purity'] },
    grievance_amplification:     { label: 'Grievance Amplification',     signals: ['blasphemy', 'desecration', 'insult', 'cartoon', 'provocation', 'hate speech', 'incitement', 'inflammatory', 'viral', 'outrage', 'disinformation'] },
    inter_communal_violence:     { label: 'Inter-Communal Violence',     signals: ['lynch', 'arson', 'massacre', 'attack', 'bombing', 'shooting', 'stabbing', 'mosque attack', 'church attack', 'synagogue attack', 'temple attack', 'hate crime'] },
    scandal_exposure:            { label: 'Scandal Exposure',            signals: ['abuse', 'sexual abuse', 'cover-up', 'coverup', 'scandal', 'molestation', 'misconduct', 'predator', 'victim', 'survivor', 'SNAP', 'grand jury', 'investigation'] },
    trust_collapse:              { label: 'Trust Collapse',              signals: ['trust', 'confidence', 'credibility', 'disaffiliation', 'leaving church', 'deconversion', 'ex-muslim', 'ex-mormon', 'none', 'spiritual but not religious', 'distrust'] },
    authority_erosion:           { label: 'Authority Erosion',           signals: ['resignation', 'fired pastor', 'defrocked', 'excommunication', 'papal criticism', 'bishop removed', 'leadership crisis', 'accountability', 'transparency'] },
    accountability_failure:      { label: 'Accountability Failure',      signals: ['background check', 'safeguarding', 'mandatory reporting', 'whistleblower', 'internal investigation', 'independent review', 'Guidepost', 'Praesidium', 'insurance requirement'] },
    extremist_capture:           { label: 'Extremist Capture',           signals: ['ISIS', 'al-Qaeda', 'RSS', 'VHP', 'settler violence', 'militia church', 'patriot church', 'dominionist', 'salafist', 'wahhabist', 'taliban', 'boko haram'] },
    polarizing_rhetoric:         { label: 'Polarizing Rhetoric',         signals: ['sermon', 'fatwa', 'encyclical', 'broadcast', 'TBN', 'Daystar', 'religious media', 'preacher', 'imam', 'rabbi', 'televangelist', 'podcast'] },
    radicalization_pipeline:     { label: 'Radicalization Pipeline',     signals: ['radicalization', 'recruitment', 'lone wolf', 'foreign fighter', 'CVE', 'deradicalization', 'counter-extremism', 'encrypted', 'telegram', 'manifesto'] },
    attendance_contraction:      { label: 'Attendance Contraction',      signals: ['attendance', 'empty pews', 'church closing', 'decline', 'shrinking', 'membership loss', 'consolidation', 'merger', 'closure', 'Lifeway'] },
    youth_disengagement:         { label: 'Youth Disengagement',         signals: ['youth', 'millennial', 'gen z', 'young adult', 'leaving faith', 'deconstructing', 'deconstruction', 'spiritual', 'unaffiliated', 'none', 'Barna'] },
    membership_decline:          { label: 'Membership Decline',          signals: ['membership', 'disaffiliation', 'transfer', 'rolls', 'baptism decline', 'confirmation decline', 'giving decline', 'tithe', 'stewardship', 'budget cut'] },
    declining_legitimacy:        { label: 'Declining Legitimacy',        signals: ['legitimacy', 'relevance', 'irrelevant', 'outdated', 'hypocrisy', 'moral authority', 'public trust', 'Gallup confidence', 'favorability', 'approval'] },
    doctrinal_conflict:          { label: 'Doctrinal Conflict',          signals: ['doctrine', 'heresy', 'orthodoxy', 'liberal theology', 'conservative theology', 'biblical authority', 'inerrancy', 'homosexuality', 'same-sex', 'women ordination', 'LGBTQ'] },
    denominational_splintering:  { label: 'Denominational Splintering',  signals: ['split', 'disaffiliation', 'breakaway', 'new denomination', 'Global Methodist', 'ACNA', 'GAFCON', 'ECO', 'EPC', 'realignment'] },
    leadership_fracture:         { label: 'Leadership Fracture',         signals: ['pope', 'archbishop', 'patriarch', 'moderator', 'presiding bishop', 'convention president', 'synod', 'primates meeting', 'dubia', 'contested election'] },
    organizational_schism:       { label: 'Organizational Schism',       signals: ['schism', 'autocephaly', 'property dispute', 'trust clause', 'pension split', 'mission agency', 'publishing house', 'seminary closure', 'institutional separation'] }
  };

  var DX_VALID_MECHANISMS = {
    'SECTARIAN_CONFLICT':    ['sectarian_escalation', 'identity_hardening', 'grievance_amplification', 'inter_communal_violence'],
    'INSTITUTIONAL_ABUSE':   ['scandal_exposure', 'trust_collapse', 'authority_erosion', 'accountability_failure'],
    'RADICALIZATION':        ['extremist_capture', 'polarizing_rhetoric', 'radicalization_pipeline', 'identity_hardening'],
    'SECULARIZATION_CRISIS': ['attendance_contraction', 'youth_disengagement', 'membership_decline', 'declining_legitimacy'],
    'THEOLOGICAL_SCHISM':    ['doctrinal_conflict', 'denominational_splintering', 'leadership_fracture', 'organizational_schism']
  };

  var DRIFT_SIGNALS = ['general awareness', 'stakeholder alignment', 'community engagement', 'interfaith sensitivity training', 'diversity workshop', 'inclusion program', 'general outreach', 'onboarding program'];

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

  window.LIMENReligionDirectiveRanker = { rank: rank };
})();
