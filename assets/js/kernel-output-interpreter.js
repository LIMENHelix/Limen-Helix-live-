/**
 * assets/js/kernel-output-interpreter.js
 * Display-label translator for the connectome adapter chain.
 *
 * STATUS: ADAPTER CHAIN DISABLED — module is currently unused.
 * The adapter chain (connectome-kernel-adapter.js → /api/kernel-experiment)
 * has been disabled. /api/kernel-experiment returns 410 Gone. The only
 * production scoring path is POST /api/helix-report/score (CIK + safe
 * context only), which returns a sectioned safe packet rendered by
 * helix-report.html / company-portal.html / business.html directly.
 *
 * This module did not score anything. If a future internal
 * (non-public) Thing-2 routing path is added, this interpreter may
 * be reused to translate Thing 2 phase posture into display labels;
 * until then it is dead code.
 *
 * Output must NEVER affect opportunity ranking, investment verdicts,
 * or paper trade execution.
 */
(function() {
'use strict';

// ═══════════════════════════════════════════════════
// 1. INTERPRET KERNEL OUTPUT
// ═══════════════════════════════════════════════════

/**
 * (DEAD CODE) Interpret raw kernel output into opportunity-context annotations.
 * @param {Object} kernelOutput - formerly from /api/kernel-experiment (now disabled)
 * @param {Object} proxyMapping - from adapter (documents how input was derived)
 * @returns {Object} interpreted annotation
 */
function interpret(kernelOutput, proxyMapping) {
  if (!kernelOutput) {
    return {
      available: false,
      reason: 'Kernel output not available',
      experiment: true
    };
  }

  var composite = kernelOutput.composite || 0;
  var alert = kernelOutput.alert || false;
  var trajectory = kernelOutput.trajectory || 'UNKNOWN';
  var firstQ = kernelOutput.firstQ || null;
  var lastRow = kernelOutput.lastRow || {};
  var details = kernelOutput.details || {};

  // ── Trajectory interpretation ──
  var trajectoryLabel, trajectoryColor;
  switch (trajectory) {
    case 'TERMINAL_DIVERGENCE':
      trajectoryLabel = 'TERMINAL DIVERGENCE';
      trajectoryColor = '#e85454';
      break;
    case 'UNRECOVERED':
      trajectoryLabel = 'UNRECOVERED STRESS';
      trajectoryColor = '#C9A94E';
      break;
    case 'MILD_STRESS':
      trajectoryLabel = 'MILD STRESS';
      trajectoryColor = '#C9A94E';
      break;
    case 'RECOVERED':
      trajectoryLabel = 'RECOVERED';
      trajectoryColor = '#5ab5a0';
      break;
    case 'STABLE':
      trajectoryLabel = 'STABLE';
      trajectoryColor = '#5ab5a0';
      break;
    default:
      trajectoryLabel = trajectory;
      trajectoryColor = '#888';
  }

  // ── Dominant phase label ──
  var phaseLabels = {
    p0: 'Peace', p1: 'Variance Spike', p2: 'Resilience', p3: 'Stress',
    p4: 'Stabilization', p5: 'Recovery', p6: 'Order',
    p7a: 'Terminal Break', p7b: 'Controlled Separation',
    p8: 'Surprise', p9: 'Collapse', p10: 'Resurrection'
  };
  var dominantPhase = lastRow.dominantPhase || null;
  var phaseLabel = dominantPhase ? (phaseLabels[dominantPhase] || dominantPhase) : 'Unknown';
  var phaseColor = '#888';
  if (dominantPhase === 'p3' || dominantPhase === 'p7a' || dominantPhase === 'p9') phaseColor = '#e85454';
  else if (dominantPhase === 'p1' || dominantPhase === 'p7b' || dominantPhase === 'p8') phaseColor = '#C9A94E';
  else if (dominantPhase === 'p0' || dominantPhase === 'p5' || dominantPhase === 'p6' || dominantPhase === 'p10') phaseColor = '#5ab5a0';
  else if (dominantPhase === 'p4') phaseColor = '#4a8fd4';

  // ── Alert interpretation ──
  var alertLabel = alert ? 'ALERT ACTIVE' : 'NO ALERT';
  var alertColor = alert ? '#e85454' : '#5ab5a0';

  // ── Composite interpretation ──
  // composite is a raw score (can be > 1.0). Thresholds from kernel:
  // Path A >= 1.1, Path B >= 1.5, Path C >= 1.5
  var compositeLabel;
  if (composite >= 2.0) compositeLabel = 'SEVERE';
  else if (composite >= 1.5) compositeLabel = 'HIGH';
  else if (composite >= 1.1) compositeLabel = 'ELEVATED';
  else if (composite >= 0.5) compositeLabel = 'MODERATE';
  else compositeLabel = 'LOW';

  // ── Stress accumulator ──
  var C_t = lastRow.C_t || 0;

  // ── Path details ──
  var pathA = details.pathA || 0;
  var pathB = details.pathB || 0;
  var pathC = details.pathC || 0;
  var dominantPath = 'A';
  if (pathB > pathA && pathB > pathC) dominantPath = 'B';
  else if (pathC > pathA && pathC > pathB) dominantPath = 'C';

  return {
    available: true,
    experiment: true,

    // Core kernel output (unmodified)
    composite: Math.round(composite * 100) / 100,
    alert: alert,
    trajectory: trajectory,
    firstQ: firstQ,

    // Display annotations (interpretation only, not new scores)
    display: {
      trajectoryLabel: trajectoryLabel,
      trajectoryColor: trajectoryColor,
      phaseLabel: phaseLabel,
      phaseColor: phaseColor,
      dominantPhase: dominantPhase,
      alertLabel: alertLabel,
      alertColor: alertColor,
      compositeLabel: compositeLabel,
      C_t: Math.round(C_t * 100) / 100,
      dominantPath: dominantPath,
      pathA: Math.round(pathA * 100) / 100,
      pathB: Math.round(pathB * 100) / 100,
      pathC: Math.round(pathC * 100) / 100
    },

    // Proxy provenance (how input was derived — for inspection)
    proxyMapping: proxyMapping || null,

    // Confidence disclaimer
    disclaimer: 'Experimental: adapter chain is currently disabled. This translator is dead code retained for possible future internal Thing 2 routing. Annotation only — not used for trade decisions.'
  };
}

// ═══════════════════════════════════════════════════
// 2. PUBLIC API
// ═══════════════════════════════════════════════════

window.LIMENKernelInterpreter = {
  interpret: interpret
};

})();
