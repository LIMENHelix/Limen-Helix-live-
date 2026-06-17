/* finance-directive-ranker.js — thin compatibility shim (C6 finance pilot).
 * Real logic: assets/js/domain-taxonomy/shared-directive-ranker.js
 * Data:       assets/js/domain-taxonomy/finance-taxonomy-data.js
 * Preserves window.LIMENFinanceDirectiveRanker with identical surface. */
(function () {
  'use strict';
  var T = window.LIMENTaxonomy, D = window.LIMENTaxData && window.LIMENTaxData.finance;
  if (!T || !T.makeDirectiveRanker || !D) { console.warn('[finance-directive-ranker.js] shared taxonomy engine/data not loaded'); return; }
  window.LIMENFinanceDirectiveRanker = window.LIMENTaxonomy.makeDirectiveRanker(D.directiveRanker);
})();
