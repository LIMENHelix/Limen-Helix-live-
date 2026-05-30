/**
 * execution-payout-finalizer.js — Outcome to Payout Finalization
 *
 * Converts closed outcomes into final payout estimates using policy rules.
 *
 * Exposes: window.LIMENExecution.phase4.payoutFinalizer
 */
(function () {
  'use strict';
  window.LIMENExecution = window.LIMENExecution || {};
  window.LIMENExecution.phase4 = window.LIMENExecution.phase4 || {};

  function getCompensationForType(type) {
    var policy = window.LIMENExecution.policy;
    if (policy && policy.compensation && policy.compensation.byType && policy.compensation.byType[type]) {
      return policy.compensation.byType[type];
    }
    return { operatorBasePct: 0.10, operatorSuccessPct: 0.15 };
  }

  function computeFinalPayout(claim, outcome) {
    var comp = getCompensationForType(claim.type || 'grant');
    var value = (outcome && outcome.outcomeValue) || claim.estimatedValue || 0;
    var result = (outcome && outcome.result) || 'partial';

    var operatorPayout = 0;
    var platformRetained = 0;

    if (result === 'success') {
      operatorPayout = Math.round(value * comp.operatorSuccessPct);
    } else if (result === 'partial') {
      operatorPayout = Math.round(value * comp.operatorSuccessPct * 0.5);
    } else {
      operatorPayout = 0;
    }

    platformRetained = Math.max(0, value - operatorPayout);

    return {
      result: result,
      outcomeValue: value,
      operatorPayout: operatorPayout,
      platformRetained: platformRetained,
      compensationType: comp,
      computed: true,
      computedAt: Date.now()
    };
  }

  function getEstimatedBasePayout(claim) {
    var comp = getCompensationForType(claim.type || 'grant');
    return Math.round((claim.estimatedValue || 0) * comp.operatorBasePct);
  }

  function getEstimatedSuccessPayout(claim) {
    var comp = getCompensationForType(claim.type || 'grant');
    return Math.round((claim.estimatedValue || 0) * comp.operatorSuccessPct);
  }

  window.LIMENExecution.phase4.payoutFinalizer = {
    getCompensationForType: getCompensationForType,
    computeFinalPayout: computeFinalPayout,
    getEstimatedBasePayout: getEstimatedBasePayout,
    getEstimatedSuccessPayout: getEstimatedSuccessPayout
  };
})();
