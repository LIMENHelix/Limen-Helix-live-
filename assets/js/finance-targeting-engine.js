/* finance-targeting-engine.js — thin compatibility shim (C6 finance pilot).
 * Real logic: assets/js/domain-taxonomy/shared-targeting-engine.js
 * Data:       assets/js/domain-taxonomy/finance-taxonomy-data.js
 * Preserves window.LIMENFinanceTargetingEngine with identical surface. */
(function () {
  'use strict';
  var T = window.LIMENTaxonomy, D = window.LIMENTaxData && window.LIMENTaxData.finance;
  if (!T || !T.makeTargetingEngine || !D) { console.warn('[finance-targeting-engine.js] shared taxonomy engine/data not loaded'); return; }
  window.LIMENFinanceTargetingEngine = window.LIMENTaxonomy.makeTargetingEngine(D.targetingEngine);
})();
