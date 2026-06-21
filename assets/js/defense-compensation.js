/**
 * defense-compensation.js — Defense Domain Compensation Model
 * Namespace: window.LIMENDefense.economy.compensation
 */
(function () {
  'use strict';

  window.LIMENDefense = window.LIMENDefense || {};
  window.LIMENDefense.economy = window.LIMENDefense.economy || {};

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
      investment: { label: 'Defense Investment Execution', operatorBasePct: 0.05, operatorSuccessPct: 0.10 },
      invest: { label: 'Defense Investment Execution', operatorBasePct: 0.05, operatorSuccessPct: 0.10 },
      research: { label: 'Defense Research Brief Execution', operatorBasePct: 0.05, operatorSuccessPct: 0.10 },
      portal: { label: 'Defense / SaaS Sale', operatorBasePct: 0.15, operatorSuccessPct: 0.20 },
      license: { label: 'Defense IP License / Tech Transfer', operatorBasePct: 0.12, operatorSuccessPct: 0.18 }
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

  window.LIMENDefense.economy.compensation = compensation;
  console.log('[DefenseCompensation] Loaded');
})();
