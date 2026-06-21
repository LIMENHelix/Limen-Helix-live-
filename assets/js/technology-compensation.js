/**
 * technology-compensation.js — Technology Domain Compensation Model
 * Namespace: window.LIMENTechnology.economy.compensation
 */
(function () {
  'use strict';

  window.LIMENTechnology = window.LIMENTechnology || {};
  window.LIMENTechnology.economy = window.LIMENTechnology.economy || {};

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

    // Lanes: investment + research ONLY (grant/patent/loan purged 2026-06-21)
    byType: {
      invest: { label: 'Technology Investment Execution', operatorBasePct: 0.05, operatorSuccessPct: 0.10 },
      research: { label: 'Technology Research Brief', operatorBasePct: 0.05, operatorSuccessPct: 0.10 },
      portal: { label: 'Technology / SaaS Sale', operatorBasePct: 0.15, operatorSuccessPct: 0.20 }
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

  window.LIMENTechnology.economy.compensation = compensation;
  console.log('[TechnologyCompensation] Loaded');
})();
