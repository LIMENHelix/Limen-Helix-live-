/**
 * operator-compensation.js — Global Compensation Model
 *
 * Defines compensation rules for all execution paths across all domains.
 * Consumed by claim flow, opportunity cards, and operator panel.
 *
 * Exposes: window.LIMENCompensation
 */
(function () {
  'use strict';

  var defaultModel = {
    operatorBasePct: 0.10,
    operatorSuccessPct: 0.15,
    platformRetainedPct: 0.85,
    lossChargebackPct: 0.00,
    notes: [
      'Compensation applies only to completed qualified outcomes',
      'No guaranteed payout until outcome recorded and auditor-approved',
      'Tier advancement reviewed quarterly based on successful outcomes'
    ]
  };

  var byType = {
    grant: {
      label: 'Grant Execution',
      operatorBasePct: 0.10,
      operatorSuccessPct: 0.15,
      estimateDefault: 150000,
      description: 'Percentage of grant award value upon successful disbursement'
    },
    patent: {
      label: 'Patent Execution',
      operatorBasePct: 0.10,
      operatorSuccessPct: 0.15,
      estimateDefault: 25000,
      description: 'Percentage of licensing royalties collected'
    },
    loan: {
      label: 'Loan Execution',
      operatorBasePct: 0.10,
      operatorSuccessPct: 0.15,
      estimateDefault: 100000,
      description: 'Percentage of loan structuring fee upon funding'
    },
    investment: {
      label: 'Investment Execution',
      operatorBasePct: 0.05,
      operatorSuccessPct: 0.10,
      estimateDefault: 10000,
      description: 'Percentage of realized profit on closed positions'
    },
    business: {
      label: 'Business Build',
      operatorBasePct: 0.20,
      operatorSuccessPct: 0.25,
      estimateDefault: 75000,
      description: 'Percentage of net operating profit'
    },
    portal: {
      label: 'Portal / SaaS Sale',
      operatorBasePct: 0.15,
      operatorSuccessPct: 0.20,
      estimateDefault: 12000,
      description: 'Percentage of annual subscription revenue'
    }
  };

  function getModel(type) {
    return byType[type] || defaultModel;
  }

  function estimatePayout(type, value) {
    var model = getModel(type);
    var v = value || model.estimateDefault || 0;
    return {
      estimatedValue: v,
      operatorPayout: Math.round(v * model.operatorBasePct),
      platformRetained: Math.round(v * (1 - model.operatorBasePct)),
      successPayout: Math.round(v * model.operatorSuccessPct),
      model: model
    };
  }

  window.LIMENCompensation = {
    defaultModel: defaultModel,
    byType: byType,
    getModel: getModel,
    estimatePayout: estimatePayout
  };

  console.log('[Compensation] Global compensation model loaded — 6 execution types');
})();
