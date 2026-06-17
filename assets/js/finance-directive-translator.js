/* finance-directive-translator.js — thin compatibility shim (C6 finance pilot).
 * Real logic: assets/js/domain-taxonomy/shared-directive-translator.js
 * Data:       assets/js/domain-taxonomy/finance-taxonomy-data.js
 * Preserves window.LIMENFinanceDirectiveTranslator with identical surface. */
(function () {
  'use strict';
  var T = window.LIMENTaxonomy, D = window.LIMENTaxData && window.LIMENTaxData.finance;
  if (!T || !T.makeDirectiveTranslator || !D) { console.warn('[finance-directive-translator.js] shared taxonomy engine/data not loaded'); return; }
  window.LIMENFinanceDirectiveTranslator = window.LIMENTaxonomy.makeDirectiveTranslator(D.directiveTranslator);
})();
