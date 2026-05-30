/**
 * execution-feedback-engine.js — Global Adaptive Ranking Feedback
 *
 * Post-ranking adaptation layer. Does NOT replace existing scoring.
 * Adds small bounded adjustment (-0.15 to +0.15) based on execution history.
 *
 * Integration: runs AFTER opportunity generation, BEFORE final render.
 *
 * Exposes: window.LIMENExecution.feedback
 */
(function () {
  'use strict';

  window.LIMENExecution = window.LIMENExecution || {};

  var MAX_ADJUSTMENT = 0.15;
  var MIN_SAMPLE = 3; // Minimum outcomes before type/domain adjustments apply
  var CONFIDENCE_DISCOUNT = 0.75; // Reduce effect by 75% when sample < MIN_SAMPLE

  function getOpportunityFeedbackScore(opp) {
    var adj = 0;
    adj += getTypeFeedbackAdjustment(opp.type || mapPathToType(opp.path));
    adj += getDomainFeedbackAdjustment(opp.domain);
    adj += getOperatorReliabilityAdjustment();
    return clamp(adj);
  }

  function getTypeFeedbackAdjustment(type) {
    var stats = window.LIMENExecution.operatorStats;
    if (!stats) return 0;
    var perf = stats.getTypePerformance(type);
    if (!perf || perf.total === 0) return 0;
    var confidence = perf.total >= MIN_SAMPLE ? 1.0 : CONFIDENCE_DISCOUNT;
    // Positive = good history, negative = bad history
    return clamp(perf.avgScore * 0.08 * confidence);
  }

  function getDomainFeedbackAdjustment(domain) {
    if (!domain) return 0;
    var stats = window.LIMENExecution.operatorStats;
    if (!stats) return 0;
    var perf = stats.getDomainPerformance(domain);
    if (!perf || perf.total === 0) return 0;
    var confidence = perf.total >= MIN_SAMPLE ? 1.0 : CONFIDENCE_DISCOUNT;
    var avgScore = perf.total > 0 ? perf.score / perf.total : 0;
    return clamp(avgScore * 0.05 * confidence);
  }

  function getOperatorReliabilityAdjustment() {
    var stats = window.LIMENExecution.operatorStats;
    if (!stats) return 0;
    return stats.getReliabilityAdjustment();
  }

  function getCompositeAdaptiveScore(opp) {
    var base = opp.rank || 0;
    var adjustment = getOpportunityFeedbackScore(opp);
    return { base: base, adjustment: adjustment, composite: base + adjustment };
  }

  function sortOpportunitiesAdaptive(opps) {
    if (!opps || opps.length === 0) return opps;
    // Compute adaptive scores
    for (var i = 0; i < opps.length; i++) {
      var scores = getCompositeAdaptiveScore(opps[i]);
      opps[i]._adaptiveScore = scores.composite;
      opps[i]._adaptiveAdjustment = scores.adjustment;
    }
    // Sort by adaptive score descending
    opps.sort(function (a, b) { return (b._adaptiveScore || b.rank || 0) - (a._adaptiveScore || a.rank || 0); });
    return opps;
  }

  function mapPathToType(path) {
    if (path === 'GRANT-ELIGIBLE') return 'grant';
    if (path === 'PATENTABLE') return 'patent';
    if (path === 'INVESTABLE') return 'investment';
    return 'grant';
  }

  function clamp(v) { return Math.max(-MAX_ADJUSTMENT, Math.min(MAX_ADJUSTMENT, v)); }

  window.LIMENExecution.feedback = {
    getOpportunityFeedbackScore: getOpportunityFeedbackScore,
    getTypeFeedbackAdjustment: getTypeFeedbackAdjustment,
    getDomainFeedbackAdjustment: getDomainFeedbackAdjustment,
    getOperatorReliabilityAdjustment: getOperatorReliabilityAdjustment,
    getCompositeAdaptiveScore: getCompositeAdaptiveScore,
    sortOpportunitiesAdaptive: sortOpportunitiesAdaptive,
    MAX_ADJUSTMENT: MAX_ADJUSTMENT
  };

  console.log('[FeedbackEngine] Global adaptive ranking feedback loaded — max adjustment +/-' + MAX_ADJUSTMENT);
})();
