/* finance-promotion-bridge.js — thin compatibility shim (C6 finance pilot).
 * Real logic: assets/js/domain-taxonomy/shared-promotion-bridge.js
 * Data:       assets/js/domain-taxonomy/finance-taxonomy-data.js
 * Preserves window.LIMENFinancePromotionBridge with identical surface. */
(function () {
  'use strict';
  var T = window.LIMENTaxonomy, D = window.LIMENTaxData && window.LIMENTaxData.finance;
  if (!T || !T.makePromotionBridge || !D) { console.warn('[finance-promotion-bridge.js] shared taxonomy engine/data not loaded'); return; }
  window.LIMENFinancePromotionBridge = window.LIMENTaxonomy.makePromotionBridge(D.promotionBridge || {}, { domain: 'finance', globalName: 'Finance' });
})();
