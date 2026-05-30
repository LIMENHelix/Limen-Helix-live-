/**
 * execution-operator-stats.js — Global Operator Performance Memory
 *
 * Tracks local operator performance across all domains and types.
 * Feeds reliability adjustment into feedback engine.
 *
 * Exposes: window.LIMENExecution.operatorStats
 */
(function () {
  'use strict';

  window.LIMENExecution = window.LIMENExecution || {};

  var STORE_KEY = 'LIMEN_EXECUTION_OPERATOR_STATS';

  function loadStats() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { return null; } }
  function saveStats(s) { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) {} }

  function recompute() {
    var outcomes = window.LIMENExecution.outcomes ? window.LIMENExecution.outcomes.getAllOutcomes() : [];
    var stats = {
      totalClaims: 0, totalClosed: outcomes.length,
      successes: 0, partials: 0, fails: 0, abandoned: 0,
      successRate: 0, weightedScore: 0,
      avgCycleTime: 0, avgValueRealization: 0,
      byType: {}, byDomain: {},
      computedAt: Date.now()
    };

    var ledger = window.LIMENClaimLedger;
    if (ledger) stats.totalClaims = ledger.getStats().total;

    var totalScore = 0, totalCycle = 0, totalValue = 0, count = outcomes.length;

    for (var i = 0; i < outcomes.length; i++) {
      var o = outcomes[i];
      if (o.result === 'success') stats.successes++;
      else if (o.result === 'partial') stats.partials++;
      else if (o.result === 'fail') stats.fails++;
      else if (o.result === 'abandoned') stats.abandoned++;

      totalScore += (o.normalizedScore || 0);
      totalCycle += (o.cycleTimeDays || 0);
      totalValue += (o.outcomeValue || 0);

      // By type
      var t = o.type || 'other';
      if (!stats.byType[t]) stats.byType[t] = { total: 0, successes: 0, partials: 0, fails: 0, abandoned: 0, score: 0, value: 0, cycle: 0 };
      stats.byType[t].total++;
      if (o.result === 'success') stats.byType[t].successes++;
      else if (o.result === 'partial') stats.byType[t].partials++;
      else if (o.result === 'fail') stats.byType[t].fails++;
      else if (o.result === 'abandoned') stats.byType[t].abandoned++;
      stats.byType[t].score += (o.normalizedScore || 0);
      stats.byType[t].value += (o.outcomeValue || 0);
      stats.byType[t].cycle += (o.cycleTimeDays || 0);

      // By domain
      var d = o.domain || 'unknown';
      if (!stats.byDomain[d]) stats.byDomain[d] = { total: 0, successes: 0, fails: 0, score: 0, value: 0 };
      stats.byDomain[d].total++;
      if (o.result === 'success') stats.byDomain[d].successes++;
      if (o.result === 'fail') stats.byDomain[d].fails++;
      stats.byDomain[d].score += (o.normalizedScore || 0);
      stats.byDomain[d].value += (o.outcomeValue || 0);
    }

    if (count > 0) {
      stats.successRate = Math.round((stats.successes / count) * 100);
      stats.weightedScore = Math.round((totalScore / count) * 100) / 100;
      stats.avgCycleTime = Math.round(totalCycle / count);
      stats.avgValueRealization = Math.round(totalValue / count);
    }

    // Compute type success rates
    for (var tk in stats.byType) {
      var bt = stats.byType[tk];
      bt.successRate = bt.total > 0 ? Math.round((bt.successes / bt.total) * 100) : 0;
      bt.avgScore = bt.total > 0 ? Math.round((bt.score / bt.total) * 100) / 100 : 0;
    }

    saveStats(stats);
    return stats;
  }

  function getStats() {
    return loadStats() || recompute();
  }

  function getReliabilityAdjustment() {
    var stats = getStats();
    if (stats.totalClosed < 5) return 0; // Not enough data
    // Bounded between -0.05 and +0.05
    var raw = stats.weightedScore * 0.05;
    return Math.max(-0.05, Math.min(0.05, raw));
  }

  function getTypePerformance(type) {
    var stats = getStats();
    return stats.byType[type] || { total: 0, successes: 0, partials: 0, fails: 0, abandoned: 0, successRate: 0, avgScore: 0 };
  }

  function getDomainPerformance(domain) {
    var stats = getStats();
    return stats.byDomain[domain] || { total: 0, successes: 0, fails: 0, score: 0, value: 0 };
  }

  window.LIMENExecution.operatorStats = {
    recompute: recompute,
    getStats: getStats,
    getReliabilityAdjustment: getReliabilityAdjustment,
    getTypePerformance: getTypePerformance,
    getDomainPerformance: getDomainPerformance
  };

  console.log('[OperatorStats] Global operator performance memory loaded');
})();
