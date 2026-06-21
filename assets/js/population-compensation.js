/**
 * environment-compensation.js — Population Domain Compensation Model
 *
 * Defines operator compensation rates by opportunity type for Science.
 * Science-scoped only. No backend. No payment processing.
 *
 * Namespace: window.LIMENPopulation.economy.compensation
 */
(function () {
  'use strict';

  window.LIMENPopulation = window.LIMENPopulation || {};
  window.LIMENPopulation.economy = window.LIMENPopulation.economy || {};

  var compensation = {
    defaultModel: {
      operatorBasePct: 0.10,
      operatorSuccessPct: 0.15,
      platformRetainedPct: 0.85,
      lossChargebackPct: 0.00,
      notes: [
        'Start operator compensation low and increase later if performance supports it',
        'Compensation only applies to completed qualified outcomes',
        'No guaranteed payout until outcome recorded'
      ]
    },

    byType: {
      investment: { label: 'Investment Execution', operatorBasePct: 0.05, operatorSuccessPct: 0.10 },
      invest: { label: 'Investment Execution', operatorBasePct: 0.05, operatorSuccessPct: 0.10 },
      research: { label: 'Research Output', operatorBasePct: 0.08, operatorSuccessPct: 0.12 },
      portal: { label: 'SciTech / SaaS Sale', operatorBasePct: 0.15, operatorSuccessPct: 0.20 },
      license: { label: 'IP License / Tech Transfer', operatorBasePct: 0.12, operatorSuccessPct: 0.18 }
    },

    getForType: function (type) {
      var key = (type || '').toLowerCase();
      var model = compensation.byType[key];
      if (!model) {
        return {
          label: key.charAt(0).toUpperCase() + key.slice(1) + ' Execution',
          operatorBasePct: compensation.defaultModel.operatorBasePct,
          operatorSuccessPct: compensation.defaultModel.operatorSuccessPct
        };
      }
      return model;
    },

    estimate: function (estimatedValue, type) {
      var model = compensation.getForType(type);
      var operatorBase = estimatedValue * model.operatorBasePct;
      var operatorSuccess = estimatedValue * model.operatorSuccessPct;
      var platformRetained = estimatedValue - operatorBase;
      return {
        estimatedValue: estimatedValue,
        operatorBasePayout: Math.round(operatorBase),
        operatorSuccessPayout: Math.round(operatorSuccess),
        platformRetained: Math.round(platformRetained),
        operatorBasePct: model.operatorBasePct,
        operatorSuccessPct: model.operatorSuccessPct,
        label: model.label
      };
    }
  };

  window.LIMENPopulation.economy.compensation = compensation;

  console.log('[ScienceCompensation] Loaded \u2014 compensation model ready');
})();
