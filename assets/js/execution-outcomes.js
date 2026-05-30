/**
 * execution-outcomes.js — Global Outcome Recording System
 *
 * Records execution results for closed claims across all domains.
 * Feeds into feedback engine for adaptive opportunity ranking.
 *
 * Exposes: window.LIMENExecution.outcomes
 */
(function () {
  'use strict';

  window.LIMENExecution = window.LIMENExecution || {};

  var STORE_KEY = 'LIMEN_EXECUTION_OUTCOMES';

  function loadAll() { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch (e) { return []; } }
  function saveAll(d) { try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); } catch (e) {} }

  var SCORE_MAP = { success: 1.00, partial: 0.50, fail: -0.75, abandoned: -1.00 };

  function recordOutcome(claimId, payload) {
    var outcomes = loadAll();
    // Prevent duplicate
    for (var i = 0; i < outcomes.length; i++) { if (outcomes[i].claimId === claimId) return outcomes[i]; }

    var record = {
      id: 'out_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      claimId: claimId,
      opportunityId: payload.opportunityId || '',
      domain: payload.domain || '',
      type: payload.type || '',
      title: payload.title || '',
      recordedAt: Date.now(),
      result: payload.result || 'partial',
      outcomeValue: payload.outcomeValue || null,
      expectedValue: payload.expectedValue || null,
      notes: payload.notes || '',
      operatorConfidenceAtClaim: payload.operatorConfidenceAtClaim || 0,
      finalPayoutEstimate: payload.finalPayoutEstimate || 0,
      cycleTimeDays: payload.cycleTimeDays || 0,
      normalizedScore: SCORE_MAP[payload.result] || 0
    };
    outcomes.push(record);
    saveAll(outcomes);

    // Update operator stats
    if (window.LIMENExecution.operatorStats) window.LIMENExecution.operatorStats.recompute();

    return record;
  }

  function getAllOutcomes() { return loadAll(); }

  function getOutcomeByClaimId(claimId) {
    var all = loadAll();
    for (var i = 0; i < all.length; i++) { if (all[i].claimId === claimId) return all[i]; }
    return null;
  }

  function hasOutcomeForClaim(claimId) { return !!getOutcomeByClaimId(claimId); }

  function getOutcomesByDomain(domain) {
    return loadAll().filter(function (o) { return o.domain === domain; });
  }

  function getOutcomesByType(type) {
    return loadAll().filter(function (o) { return o.type === type; });
  }

  function computeCycleTimeDays(claim) {
    if (!claim || !claim.claimedAt) return 0;
    var end = claim.closedAt || Date.now();
    return Math.round((end - claim.claimedAt) / (24 * 60 * 60 * 1000));
  }

  function normalizeOutcomeScore(outcome) {
    return SCORE_MAP[outcome.result] || 0;
  }

  window.LIMENExecution.outcomes = {
    recordOutcome: recordOutcome,
    getAllOutcomes: getAllOutcomes,
    getOutcomeByClaimId: getOutcomeByClaimId,
    hasOutcomeForClaim: hasOutcomeForClaim,
    getOutcomesByDomain: getOutcomesByDomain,
    getOutcomesByType: getOutcomesByType,
    computeCycleTimeDays: computeCycleTimeDays,
    normalizeOutcomeScore: normalizeOutcomeScore,
    SCORE_MAP: SCORE_MAP
  };

  console.log('[ExecutionOutcomes] Global outcome recording loaded — ' + loadAll().length + ' existing outcomes');
})();
