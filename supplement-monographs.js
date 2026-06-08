// ═══════════════════════════════════════════════════════════════
// LIMEN HELIX — SUPPLEMENT MONOGRAPH COMPATIBILITY SHIM
//
// All supplement content has been merged into nutrition-monographs.js
// as the single source of truth.
//
// This file exists for backward compatibility so that clinical.html,
// addiction.html, and psychedelic.html continue to work without
// modification. All calls to findSupplementMonograph() are proxied
// to findNutritionMonograph() in the unified file.
//
// Do not add monographs here. Edit nutrition-monographs.js instead.
// ═══════════════════════════════════════════════════════════════

// SUPPLEMENT_MONOGRAPHS is aliased to NUTRITION_MONOGRAPHS
// nutrition-monographs.js must be loaded before this shim
var SUPPLEMENT_MONOGRAPHS = (typeof NUTRITION_MONOGRAPHS !== 'undefined')
  ? NUTRITION_MONOGRAPHS
  : {};

function findSupplementMonograph(interventionName) {
  if (typeof findNutritionMonograph === 'function') {
    return findNutritionMonograph(interventionName);
  }
  return null;
}

if (typeof module !== 'undefined') {
  module.exports = {
    SUPPLEMENT_MONOGRAPHS: SUPPLEMENT_MONOGRAPHS,
    findSupplementMonograph: findSupplementMonograph
  };
}
