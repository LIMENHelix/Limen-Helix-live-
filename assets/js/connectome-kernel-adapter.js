/**
 * assets/js/connectome-kernel-adapter.js
 * EXPERIMENTAL — Transforms domain/connectome stress inputs into
 * proxy series for the (disabled) adapter chain.
 *
 * STATUS: EXPERIMENTAL / ANNOTATION ONLY
 * Output from this adapter chain must NOT be used for:
 *   - opportunity ranking or confidence scoring
 *   - investment verdict computation
 *   - paper trade execution decisions
 *
 * The Thing 2 lineage v4 patent kernel (limen_backtest_kernel.js → runLimenPipeline)
 * expects: { Revenue: {"2024Q1": val}, OCF: {...}, Cash: {...}, Debt: {...} }
 *
 * This adapter translates domain stress signals into that shape using
 * explicit, inspectable proxy mappings. The kernel math is validated;
 * the proxy input translation is NOT validated.
 *
 * PROXY MAPPING RATIONALE:
 *   Revenue  ← domain activity/throughput (inverse of stress)
 *   OCF      ← operational flow (inverse of volatility)
 *   Cash     ← resilience/capacity/optionality (inverse of sustained stress)
 *   Debt     ← systemic load/constraint/obligation (proportional to stress)
 */
(function() {
'use strict';

// ═══════════════════════════════════════════════════
// 1. PROXY SERIES BUILDER
// ═══════════════════════════════════════════════════

// Base scale for proxy values (arbitrary units; kernel only cares about
// relative changes between quarters, not absolute scale)
var BASE_REVENUE = 1000;
var BASE_OCF     = 200;
var BASE_CASH    = 500;
var BASE_DEBT    = 300;

// How many synthetic quarters to generate from a stress snapshot.
// The kernel needs a time series to compute rolling features (4Q window minimum).
// We generate 8 quarters: 4 "baseline" + 4 representing current stress state.
// This is the minimum viable series for the kernel's feature engineering.
var BASELINE_QUARTERS = 4;
var STRESS_QUARTERS   = 4;

/**
 * Generate a quarter label string.
 * @param {number} yearsAgo - 0 = current year
 * @param {number} q - 1-4
 */
function makeQuarterLabel(yearsAgo, q) {
  var year = new Date().getFullYear() - yearsAgo;
  return year + 'Q' + q;
}

/**
 * Build the 8-quarter label sequence.
 * Returns array of quarter strings from ~2 years ago to now.
 */
function buildQuarterSequence() {
  var quarters = [];
  // 4 baseline quarters (2 years ago)
  for (var i = BASELINE_QUARTERS; i >= 1; i--) {
    var yearsAgo = Math.ceil(i / 4);
    var q = 4 - ((i - 1) % 4);
    quarters.push(makeQuarterLabel(yearsAgo, q));
  }
  // 4 stress quarters (last year to now)
  for (var j = STRESS_QUARTERS; j >= 1; j--) {
    var ya = j <= 2 ? 0 : 1;
    var qq = j <= 2 ? (3 - j + 1) : (4 - (j - 2) + 1);
    // Simpler: just count backwards from current quarter
    quarters.push(makeQuarterLabel(0, Math.max(1, 5 - j)));
  }
  // Deduplicate and ensure sorted
  var seen = {};
  var unique = [];
  for (var k = 0; k < quarters.length; k++) {
    if (!seen[quarters[k]]) { seen[quarters[k]] = true; unique.push(quarters[k]); }
  }
  return unique.sort();
}

/**
 * Transform domain/connectome stress data into kernel-compatible proxy series.
 *
 * @param {Object} stressData - {
 *   domains: { domainId: { stress: 0-1, status: string } },
 *   nodeActivations: [{ nodeId, activationStrength, crossDomainNode, domainCount }],
 *   oppDomains: [string] - which domains this opportunity covers
 * }
 * @returns {Object} { companyData: {Revenue, OCF, Cash, Debt}, fredDelta, proxyMapping }
 *
 * proxyMapping documents exactly how each proxy was derived so the
 * mapping is inspectable and auditable.
 */
function adaptToKernelInput(stressData) {
  var domains = stressData.domains || {};
  var nodes = stressData.nodeActivations || [];
  var oppDomains = stressData.oppDomains || [];

  // ── Compute raw stress metrics ──
  // Average stress across opportunity's domains
  var avgStress = 0;
  var stressCount = 0;
  for (var i = 0; i < oppDomains.length; i++) {
    var d = domains[oppDomains[i]];
    if (d && d.stress > 0) { avgStress += d.stress; stressCount++; }
  }
  avgStress = stressCount > 0 ? avgStress / stressCount : 0;

  // Node instability: variance proxy from activation spread
  var nodeStrengths = [];
  var crossDomainCount = 0;
  for (var ni = 0; ni < Math.min(nodes.length, 20); ni++) {
    nodeStrengths.push(nodes[ni].activationStrength || 0);
    if (nodes[ni].crossDomainNode) crossDomainCount++;
  }
  var nodeVariance = _variance(nodeStrengths);

  // Resilience: inverse of stress, boosted by domain diversity
  var domainDiversity = stressCount > 0 ? Math.min(stressCount / oppDomains.length, 1.0) : 0;

  // Systemic load: stress * cross-domain amplification
  var crossDomainRatio = nodes.length > 0 ? crossDomainCount / nodes.length : 0;
  var systemicLoad = avgStress * (1 + crossDomainRatio * 0.5);

  // ── Build proxy series (deterministic, no random noise) ──
  // Design: smooth baseline growth (4Q) → gradual stress degradation (4Q).
  // No noise — the kernel signal comes entirely from the stress-driven
  // slope/acceleration changes between baseline and stress quarters.
  // This avoids false PELT breaks from noise discontinuities.
  var quarters = buildQuarterSequence();
  var Revenue = {};
  var OCF = {};
  var Cash = {};
  var Debt = {};

  // Baseline quarterly growth rate (small, positive, steady)
  var BASE_GROWTH = 0.02; // 2% per quarter baseline growth

  for (var qi = 0; qi < quarters.length; qi++) {
    var q = quarters[qi];
    var isBaseline = qi < BASELINE_QUARTERS;

    if (isBaseline) {
      // Baseline: smooth mild growth, no noise
      var growthFactor = 1 + BASE_GROWTH * qi;
      Revenue[q] = BASE_REVENUE * growthFactor;
      OCF[q]     = BASE_OCF * growthFactor;
      Cash[q]    = BASE_CASH * growthFactor;
      Debt[q]    = BASE_DEBT * (1 - BASE_GROWTH * 0.3 * qi); // debt slowly improves in baseline
    } else {
      // Stress quarters: smooth degradation proportional to stress
      // Progression ramps from 0.25 to 1.0 across 4 quarters
      var stressProgression = (qi - BASELINE_QUARTERS + 1) / STRESS_QUARTERS;
      var stressFactor = avgStress * stressProgression;

      // Start from where baseline ended (smooth transition)
      var baselineEnd = 1 + BASE_GROWTH * (BASELINE_QUARTERS - 1);

      // Revenue: declines as stress increases
      // At max stress (1.0), final quarter Revenue ≈ 30% of baseline (severe)
      Revenue[q] = BASE_REVENUE * baselineEnd * (1 - stressFactor * 0.7);

      // OCF: drops faster than revenue; node variance adds alternating volatility
      var ocfVolatility = nodeVariance * 0.5 * ((qi % 2 === 0) ? 1 : -1);
      OCF[q] = BASE_OCF * baselineEnd * (1 - stressFactor * 0.85 + ocfVolatility);

      // Cash: erodes under sustained stress; resilience slows erosion
      var resilience = (1 - avgStress) * domainDiversity;
      Cash[q] = BASE_CASH * baselineEnd * (1 - stressFactor * 0.65 * (1 - resilience * 0.3));

      // Debt: grows under systemic load
      var baselineDebtEnd = 1 - BASE_GROWTH * 0.3 * (BASELINE_QUARTERS - 1);
      Debt[q] = BASE_DEBT * baselineDebtEnd * (1 + systemicLoad * stressProgression * 0.6);
    }

    // Floor values
    Revenue[q] = Math.max(Revenue[q], 1);
    OCF[q] = OCF[q]; // OCF can be negative (burn)
    Cash[q] = Math.max(Cash[q], 1);
    Debt[q] = Math.max(Debt[q], 0);
  }

  return {
    companyData: {
      Revenue: Revenue,
      OCF: OCF,
      Cash: Cash,
      Debt: Debt
    },
    fredDelta: {}, // no macro rate data in this experiment
    proxyMapping: {
      avgStress: Math.round(avgStress * 1000) / 1000,
      nodeVariance: Math.round(nodeVariance * 1000) / 1000,
      domainDiversity: Math.round(domainDiversity * 1000) / 1000,
      systemicLoad: Math.round(systemicLoad * 1000) / 1000,
      crossDomainRatio: Math.round(crossDomainRatio * 1000) / 1000,
      quartersGenerated: quarters.length,
      baselineQuarters: BASELINE_QUARTERS,
      stressQuarters: STRESS_QUARTERS,
      oppDomains: oppDomains,
      activatedNodes: nodes.length,
      mappingRationale: {
        Revenue: 'BASE * baselineEnd * (1 - avgStress * progression * 0.7)',
        OCF: 'BASE * baselineEnd * (1 - avgStress * progression * 0.85 + nodeVariance * alternating)',
        Cash: 'BASE * baselineEnd * (1 - avgStress * progression * 0.65 * (1 - resilience * 0.3))',
        Debt: 'BASE * baselineDebtEnd * (1 + systemicLoad * progression * 0.6)'
      }
    }
  };
}

function _variance(arr) {
  if (arr.length === 0) return 0;
  var mean = 0;
  for (var i = 0; i < arr.length; i++) mean += arr[i];
  mean /= arr.length;
  var v = 0;
  for (var j = 0; j < arr.length; j++) v += (arr[j] - mean) * (arr[j] - mean);
  return v / arr.length;
}


// ═══════════════════════════════════════════════════
// 2. KERNEL CALL (via serverless endpoint)
// ═══════════════════════════════════════════════════

/**
 * NEUTRALIZED — formerly POSTed proxy companyData to /api/kernel-experiment.
 *
 * That public arbitrary-input scoring endpoint has been removed from the
 * Helix Report architecture. The browser may not submit raw companyData,
 * thresholds, or kernel internals to any route. The only public report
 * path is POST /api/helix-report/score (CIK + safe context only).
 *
 * This adapter is annotation-only and unvalidated; its proxy pipeline
 * (stress → companyData) is not wired through the protected endpoint.
 * Until the proxy translation is itself validated and the protected
 * endpoint exposes a "validated_financial_distress" path, callKernel
 * returns an error and produces no kernel output.
 *
 * @param {Object} adapted - output of adaptToKernelInput()
 * @param {Function} callback - receives (error, kernelOutput)
 */
function callKernel(adapted, callback) {
  callback(
    'connectome-kernel-adapter is disabled: /api/kernel-experiment is not a ' +
    'public scoring endpoint. Use the protected /api/helix-report/score ' +
    'route with a CIK; do not submit synthesized companyData to any kernel.',
    null
  );
}

// ═══════════════════════════════════════════════════
// 3. PUBLIC API
// ═══════════════════════════════════════════════════

window.LIMENKernelAdapter = {
  adaptToKernelInput: adaptToKernelInput,
  callKernel: callKernel,

  /**
   * Full adapter pipeline: build input → call kernel → return result.
   * @param {Object} stressData - same as adaptToKernelInput param
   * @param {Function} callback - (error, { kernelOutput, proxyMapping })
   */
  run: function(stressData, callback) {
    var adapted = adaptToKernelInput(stressData);
    callKernel(adapted, function(err, output) {
      if (err) {
        callback(err, { kernelOutput: null, proxyMapping: adapted.proxyMapping });
      } else {
        callback(null, { kernelOutput: output, proxyMapping: adapted.proxyMapping });
      }
    });
  }
};

})();
