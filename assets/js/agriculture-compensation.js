/**
 * agriculture-compensation.js — Agriculture Domain Compensation Model
 *
 * Defines operator compensation rates by opportunity type.
 * Agriculture-scoped only. No backend. No payment processing.
 *
 * Namespace: window.LIMENAgriculture.economy.compensation
 */
(function () {
  'use strict';

  window.LIMENAgriculture = window.LIMENAgriculture || {};
  window.LIMENAgriculture.economy = window.LIMENAgriculture.economy || {};

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
      grant: {
        label: 'Grant Execution',
        operatorBasePct: 0.10,
        operatorSuccessPct: 0.15
      },
      patent: {
        label: 'Patent Execution',
        operatorBasePct: 0.08,
        operatorSuccessPct: 0.12
      },
      loan: {
        label: 'Loan Execution',
        operatorBasePct: 0.10,
        operatorSuccessPct: 0.15
      },
      investment: {
        label: 'Investment Execution',
        operatorBasePct: 0.05,
        operatorSuccessPct: 0.10
      },
      invest: {
        label: 'Investment Execution',
        operatorBasePct: 0.05,
        operatorSuccessPct: 0.10
      },
      portal: {
        label: 'Portal / SaaS Sale',
        operatorBasePct: 0.15,
        operatorSuccessPct: 0.20
      }
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

  window.LIMENAgriculture.economy.compensation = compensation;

  console.log('[AgricultureCompensation] Loaded — compensation model ready');
})();
