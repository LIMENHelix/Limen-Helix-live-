// ═══════════════════════════════════════════════════════════════════
// limen_backtest_kernel.js — Thing 2 lineage (v4 patent recursive kernel)
//
// IDENTITY: This file was previously labeled "VALIDATED DECISION KERNEL."
// That label was incorrect. This file is a Node copy of the v4 patent
// recursive kernel extracted verbatim from bk-scorer.js. It is part of
// the Thing 2 (long-arc recursive phase tracker) lineage, NOT Thing 1
// (validated financial distress scorer).
//
// THING 1 (validated financial distress scorer) is api/thing1/limen_backtest.py
// (the real `limen_backtest.py`). It is server-side only, hash-locked via
// api/thing1/VALIDATION_LOCK.json, and is the only code path that may
// emit `validation_status: "validated"`, `alert: true`, or "ALERT FIRED."
// Thing 1 is NOT this file.
//
// SOURCE: Extracted verbatim from bk-scorer.js lines 16-772. Self-consistency
// tested via bk-dataset.json (the v4 kernel regression suite). That regression
// suite is NOT a validation against the Thing 1 distress-scorer ground truth.
//
// DISTINCTION FROM limen_v4_kernel.js:
//   This file and limen_v4_kernel.js are both Thing 2 lineage. They share
//   the same math but use different configuration constants (this file
//   uses START_YEAR=1999 + HYSTERESIS_CONSEC=1 to fit the 4-quarter
//   bk-dataset; limen_v4_kernel.js uses START_YEAR=2000 + HYSTERESIS_CONSEC=2).
//   Neither is Thing 1. Neither may be cited as the validated decision kernel.
//
// AUTHORITY:
//   - Cannot emit `alert: true` / `ALERT FIRED`
//   - Cannot carry `validation_status: "validated"`
//   - Cannot authorize "validated financial distress" language
//   - Output is interpretive phase posture only
//
// DO NOT MODIFY MATH — any change here must be mirrored in bk-scorer.js
// and re-run through the v4 self-consistency suite (bk-dataset.json).
// ═══════════════════════════════════════════════════════════════════

// ─── BEGIN VERBATIM FROM bk-scorer.js lines 16–772 ──────────────

// ─── Version & Sync ──────────────────────────────────────────────
// KERNEL_VERSION: bump numeric prefix when shared math changes.
// Suffix identifies this copy's role. CONSTANTS_HASH detects drift.
// INTENTIONAL DIVERGENCES: START_YEAR=1999 (full backtest history),
//   HYSTERESIS_CONSEC=1 (4-quarter dataset needs faster triggering).
// SHARED CONSTANTS MUST STAY SYNCED: P3_ENTRY, LAMBDA, GAMMA_*,
//   COMPOSITE_THRESH_*, RUNWAY_*, RECOVERY_TH, SUSTAINED_*.
//   Re-run limen_validation.js before deploying any shared constant change.
// v4.0.2 (2026-05-13): replaced semantic GAMMA_TERMINAL bucketing
//   with empirical dynamical-class assignment (Test #3/#5 result).
//   See docs/phase-coupling-template.md Section 5b.
var KERNEL_VERSION = '4.0.2-validated';

// ─── Constants (v4.0 — exact from patent spec) ──────────────────
var LIMEN = {
  START_YEAR:           1999,  // OVERRIDE: was 2015, lowered so full dataset is evaluated
  // NOTE: HYSTERESIS_CONSEC overridden below after LIMEN declaration
  P3_ENTRY:             0.59,
  RECOVERY_TH:          0.50,
  RECOVERY_WINDOW:      6,

  // Accumulator C(t) — patent §3.6
  LAMBDA:               6,
  // v4.0.2 (2026-05-13): empirical dynamical-class gammas from
  //   diagnostic/gamma_ratio_km_correction.py (Test #5, censoring-aware
  //   geometric-hazard MLE over 32-fixture cohort, 1204 spells).
  //   Replaces the semantic {RECOVERY,TERMINAL,DEFAULT} bucketing which
  //   structurally mis-grouped p7 + p9 (transient) with p7a (attractor).
  //   See assets/data/empirical-gamma-by-phase.json for full estimates.
  GAMMA_ATTRACTOR:      0.510,  // p7a / p4 / p10 — basins
  GAMMA_RECOVERY:       0.266,  // p0 / p1 / p3 / p5 / p6 / p8 — semi-stable
  GAMMA_TRANSIENT:      0.043,  // p2 / p7 / p7b / p9 — pass-through
  // Legacy semantic constants — DEPRECATED, retained only for v4.0.1
  //   hash-history reproducibility. Do not reference in new code.
  GAMMA_TERMINAL:       0.97,
  GAMMA_DEFAULT:        0.84,

  // Legacy accumulator params
  STRESS_CHARGE_RATE:   1.0,
  P7_AMP:               0.2,
  CONSEC_BONUS_RATE:    0.20,
  MAX_CONSEC_QTRS:      6,
  RECOVERY_DECAY:       0.30,
  BASELINE_DECAY:       0.90,
  ALERT_ACCUM_THRESH:   2.5,

  COMPOSITE_THRESH_A:   1.1,
  COMPOSITE_THRESH_B:   1.5,
  COMPOSITE_THRESH_C:   1.5,

  RUPTURE_CASH_DROP:    0.30,
  RUPTURE_DEBT_SPIKE:   0.50,
  RUPTURE_VAR_JUMP:     5.0,
  RUPTURE_MIN_SIGNALS:  2,

  SUSTAINED_THRESH:     0.50,
  SUSTAINED_MIN_CONSEC: 4,
  SUSTAINED_WEIGHT:     0.20,

  // Gating thresholds — patent §3.5
  P0_SUPPRESSION_THRESH: 0.5,
  RUNWAY_ELEVATE_QTR:    4,
  RUNWAY_FORCE_QTR:      2,
  RECENCY_WEIGHT_THRESH: 0.15,
  HYSTERESIS_CONSEC:     2,
};

// OVERRIDE: with only 4 quarters per company, 2-consecutive-quarter hysteresis
// gate can't fire (PELT breaks only appear on last scored row). Reduce to 1.
LIMEN.HYSTERESIS_CONSEC = 1;

// ─── Dynamical-class taxonomy (v4.0.2) ──────────────────────────
// Each phase is assigned to one of three dynamical classes based on
// empirical spell-persistence (Test #5 KM-corrected MLE):
//   ATTRACTOR — basins, high gamma, stress persists
//   RECOVERY  — semi-stable routes, mid gamma
//   TRANSIENT — pass-through, low gamma, stress decays fast
// Source: docs/phase-coupling-template.md Section 4b.
// Source: assets/data/empirical-gamma-by-phase.json (per-phase support).
var DYNAMICAL_CLASS = {
  p0:  'RECOVERY',
  p1:  'RECOVERY',
  p2:  'TRANSIENT',
  p3:  'RECOVERY',
  p4:  'ATTRACTOR',
  p5:  'RECOVERY',
  p6:  'RECOVERY',
  p7:  'TRANSIENT',
  p7a: 'ATTRACTOR',
  p7b: 'TRANSIENT',
  p8:  'RECOVERY',
  p9:  'TRANSIENT',
  p10: 'ATTRACTOR'
};

function gammaForPhase(phase) {
  var cls = DYNAMICAL_CLASS[phase] || 'RECOVERY';
  if (cls === 'ATTRACTOR') return LIMEN.GAMMA_ATTRACTOR;
  if (cls === 'TRANSIENT') return LIMEN.GAMMA_TRANSIENT;
  return LIMEN.GAMMA_RECOVERY;
}

var CONSTANTS_HASH = [LIMEN.P3_ENTRY, LIMEN.LAMBDA, LIMEN.GAMMA_ATTRACTOR, LIMEN.GAMMA_RECOVERY, LIMEN.GAMMA_TRANSIENT, LIMEN.COMPOSITE_THRESH_A, LIMEN.COMPOSITE_THRESH_B, LIMEN.COMPOSITE_THRESH_C, LIMEN.RUNWAY_ELEVATE_QTR, LIMEN.RUNWAY_FORCE_QTR, LIMEN.RECOVERY_TH, LIMEN.SUSTAINED_THRESH].join(',');
// Expected (v4.0.2): "0.59,6,0.51,0.266,0.043,1.1,1.5,1.5,4,2,0.5,0.5"
if (typeof console !== 'undefined') console.log('[LIMEN] Kernel ' + KERNEL_VERSION + ' loaded, hash: ' + CONSTANTS_HASH);

// ─── Phase Coupling Matrix M — patent §3.4 Loop 1 ───────────────
var PHASE_KEYS = ['p0','p1','p2','p3','p4','p5','p6','p7','p7a','p7b','p8','p9','p10'];

var M_MATRIX = {
  p3:  { p3: +0.08, p7a: +0.05, p9: +0.04, p0: -0.06 },
  p7a: { p7a: +0.10, p3: +0.04, p9: +0.06, p0: -0.08, p4: -0.04 },
  p4:  { p4: +0.05, p5: +0.04, p0: +0.03, p3: -0.04 },
  p6:  { p6: +0.06, p0: +0.04, p3: -0.05 },
  p9:  { p9: +0.08, p7a: +0.05, p0: -0.10, p4: -0.06 },
  p10: { p10: +0.06, p0: +0.05, p6: +0.03 },
};

// ─── Math Helpers ────────────────────────────────────────────────
function sigmoid(x) {
  x = Math.max(-10, Math.min(10, x));
  return 1.0 / (1.0 + Math.exp(-x));
}

function robustZ(x, history) {
  if (!history || history.length === 0) return 0;
  var sorted = history.slice().sort(function(a,b){return a-b;});
  var n = sorted.length;
  var med = n % 2 === 1 ? sorted[Math.floor(n/2)] : (sorted[n/2-1]+sorted[n/2])/2;
  var absDevs = sorted.map(function(v){return Math.abs(v-med);});
  absDevs.sort(function(a,b){return a-b;});
  var mad = absDevs.length % 2 === 1 ? absDevs[Math.floor(absDevs.length/2)] : (absDevs[absDevs.length/2-1]+absDevs[absDevs.length/2])/2;
  var z = 0.6745 * (x - med) / Math.max(mad, 1e-8);
  return Math.max(-5, Math.min(5, z));
}

function nanMean(arr) {
  var s = 0, c = 0;
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] !== null && !isNaN(arr[i])) { s += arr[i]; c++; }
  }
  return c > 0 ? s / c : 0;
}

// ─── PELT Breakpoint Detection ───────────────────────────────────
function _costL2(signal, start, end) {
  var seg = signal.slice(start, end);
  if (seg.length === 0) return 0;
  var mean = seg.reduce(function(a,b){return a+b;},0) / seg.length;
  return seg.reduce(function(a,v){return a + (v-mean)*(v-mean);}, 0);
}

function peltBreakpoints(signal, pen) {
  var n = signal.length;
  if (n < 2) return [n];
  var F = new Array(n+1).fill(Infinity);
  F[0] = -pen;
  var cp = {0: []};
  var admissible = [0];
  for (var tStar = 1; tStar <= n; tStar++) {
    var bestCost = Infinity, bestT = 0;
    var costs = [];
    for (var j = 0; j < admissible.length; j++) {
      var t = admissible[j];
      var cost = F[t] + _costL2(signal, t, tStar) + pen;
      costs.push(cost);
      if (cost < bestCost) { bestCost = cost; bestT = t; }
    }
    F[tStar] = bestCost;
    cp[tStar] = (cp[bestT] || []).concat([tStar]);
    var newAdm = [];
    for (var j = 0; j < admissible.length; j++) {
      var t = admissible[j];
      if (costs[j] + _costL2(signal, t, tStar) <= F[tStar] + pen) newAdm.push(t);
    }
    newAdm.push(tStar);
    admissible = newAdm;
  }
  return cp[n] || [];
}

function detectBreaks(windowValues) {
  if (windowValues.length < 3) return 0;
  var mean = windowValues.reduce(function(a,b){return a+b;},0) / windowValues.length;
  var variance = windowValues.reduce(function(a,v){return a+(v-mean)*(v-mean);},0) / windowValues.length;
  var pen = Math.max(Math.log(windowValues.length) * variance, 1e-6);
  try {
    var bps = peltBreakpoints(windowValues, pen);
    var nBps = (bps.length > 0 && bps[bps.length-1] === windowValues.length) ? bps.length - 1 : bps.length;
    return nBps;
  } catch(e) { return 0; }
}

// ─── Feature Engineering ─────────────────────────────────────────
function computeLogDiff(seriesDict) {
  var keys = Object.keys(seriesDict).sort();
  var result = {};
  for (var i = 1; i < keys.length; i++) {
    var q = keys[i], qPrev = keys[i-1];
    var curr = seriesDict[q], prev = seriesDict[qPrev];
    if (prev === null || curr === null || prev === undefined || curr === undefined) continue;
    if (prev > 0 && curr > 0) result[q] = Math.log(curr / prev);
    else if (Math.abs(prev) > 1e-9) result[q] = (curr - prev) / Math.abs(prev);
    else result[q] = 0.0;
  }
  return result;
}

function computeRollingFeatures(logDiffs, windowSize) {
  windowSize = windowSize || 4;
  var keys = Object.keys(logDiffs).sort();
  var features = {};
  for (var i = 0; i < keys.length; i++) {
    var q = keys[i];
    var startIdx = Math.max(0, i - windowSize + 1);
    var windowVals = [];
    for (var j = startIdx; j <= i; j++) windowVals.push(logDiffs[keys[j]]);
    if (windowVals.length < Math.min(windowSize, 2)) continue;
    var feat = {};
    var mean = windowVals.reduce(function(a,b){return a+b;},0) / windowVals.length;
    feat['var'] = windowVals.reduce(function(a,v){return a+(v-mean)*(v-mean);},0) / windowVals.length;
    var std = Math.sqrt(feat['var']);
    if (std < 1e-12) {
      feat.ac = 0;
    } else {
      var ac = 0;
      for (var k = 1; k < windowVals.length; k++) ac += (windowVals[k]-mean)*(windowVals[k-1]-mean);
      ac /= ((windowVals.length-1)*feat['var']);
      feat.ac = Math.max(-1, Math.min(1, ac));
    }
    var n = windowVals.length, xMean = (n-1)/2, num = 0, den = 0;
    for (var k = 0; k < n; k++) { num += (k-xMean)*(windowVals[k]-mean); den += (k-xMean)*(k-xMean); }
    feat.slope = den > 1e-12 ? num/den : 0;
    if (windowVals.length >= 3) {
      var diffs2 = [];
      for (var k = 2; k < windowVals.length; k++) diffs2.push((windowVals[k]-windowVals[k-1])-(windowVals[k-1]-windowVals[k-2]));
      feat.accel = diffs2.reduce(function(a,b){return a+b;},0)/diffs2.length;
    } else feat.accel = 0;
    feat['break'] = detectBreaks(windowVals);
    features[q] = feat;
  }
  return features;
}

function dateToQuarter(dt) {
  var y = dt.getFullYear(), m = dt.getMonth()+1;
  return y+'Q'+(Math.floor((m-1)/3)+1);
}
function quarterToDate(qKey) {
  var parts = qKey.split('Q'), y = parseInt(parts[0]), q = parseInt(parts[1]);
  return new Date(y, q*3-1, [0,31,30,30,31][q]);
}
function quarterDiff(q1, q2) {
  var p1=q1.split('Q'), p2=q2.split('Q');
  return (parseInt(p2[0])-parseInt(p1[0]))*4+(parseInt(p2[1])-parseInt(p1[1]));
}
function quarterYear(qKey) { return parseInt(qKey.split('Q')[0]); }

function computeAllFeatures(companyData, fredDelta) {
  var metrics = ['Revenue','OCF','Cash','Debt'];
  var logDiffs = {};
  metrics.forEach(function(m) { logDiffs[m] = companyData[m] ? computeLogDiff(companyData[m]) : {}; });
  var rolling4q = {}, rolling8q = {};
  metrics.forEach(function(m) {
    rolling4q[m] = Object.keys(logDiffs[m]).length > 0 ? computeRollingFeatures(logDiffs[m], 4) : {};
    rolling8q[m] = Object.keys(logDiffs[m]).length > 0 ? computeRollingFeatures(logDiffs[m], 8) : {};
  });
  var allQuarters = {};
  metrics.forEach(function(m) { Object.keys(rolling4q[m]).forEach(function(q){allQuarters[q]=true;}); });
  // Also include raw quarter keys so rows are created even when rolling window is too wide
  metrics.forEach(function(m) { if (companyData[m]) Object.keys(companyData[m]).forEach(function(q){allQuarters[q]=true;}); });
  allQuarters = Object.keys(allQuarters).sort();
  if (allQuarters.length === 0) return [];
  var history = {}, history8q = {};
  metrics.forEach(function(m) {
    history[m] = {'var':[],'ac':[],'slope':[],'accel':[]};
    history8q[m] = {'var':[],'ac':[],'slope':[],'accel':[]};
  });
  var runwayHistory = [], dffHistory = [];
  var prevVar = {};
  metrics.forEach(function(m) { prevVar[m] = null; });
  var rows = [];
  allQuarters.forEach(function(q) {
    var row = {quarter: q};
    metrics.forEach(function(m) {
      row[m] = (companyData[m] && companyData[m][q] !== undefined) ? companyData[m][q] : NaN;
    });
    metrics.forEach(function(m) {
      var feat = rolling4q[m][q] || {};
      ['var','ac','slope','accel'].forEach(function(stat) {
        var val = feat[stat] !== undefined ? feat[stat] : NaN;
        var col = stat+'_'+m;
        row[col] = val;
        if (!isNaN(val)) { history[m][stat].push(val); row['z_'+col] = robustZ(val, history[m][stat]); }
        else row['z_'+col] = NaN;
      });
      row['break_'+m] = feat['break'] !== undefined ? feat['break'] : 0;
      var curVar = feat['var'] !== undefined ? feat['var'] : NaN;
      row['delta_var_'+m] = (!isNaN(curVar) && prevVar[m] !== null) ? curVar-prevVar[m] : NaN;
      if (!isNaN(curVar)) prevVar[m] = curVar;
    });
    metrics.forEach(function(m) {
      var feat8 = rolling8q[m][q] || {};
      ['var','ac','slope','accel'].forEach(function(stat) {
        var val = feat8[stat] !== undefined ? feat8[stat] : NaN;
        var col8 = stat+'_'+m+'_8q';
        row[col8] = val;
        if (!isNaN(val)) { history8q[m][stat].push(val); row['z_'+col8] = robustZ(val, history8q[m][stat]); }
        else row['z_'+col8] = NaN;
      });
      row['break_'+m+'_8q'] = feat8['break'] !== undefined ? feat8['break'] : 0;
    });
    var cashVal = (companyData.Cash && companyData.Cash[q] !== undefined) ? companyData.Cash[q] : NaN;
    var ocfVal  = (companyData.OCF  && companyData.OCF[q]  !== undefined) ? companyData.OCF[q]  : NaN;
    if (!isNaN(cashVal) && !isNaN(ocfVal)) {
      var runway = cashVal / Math.max(1.0, Math.abs(ocfVal));
      runwayHistory.push(runway);
      row.runway = runway;
      row.z_runway = robustZ(runway, runwayHistory);
    } else { row.runway = NaN; row.z_runway = NaN; }
    var dff = (fredDelta && fredDelta[q] !== undefined) ? fredDelta[q] : NaN;
    if (!isNaN(dff)) {
      dffHistory.push(dff);
      row.delta_fedfunds = dff;
      row.z_delta_fedfunds = robustZ(dff, dffHistory);
    } else { row.delta_fedfunds = NaN; row.z_delta_fedfunds = NaN; }
    rows.push(row);
  });
  return rows;
}

function computePathModifier(H) {
  if (!H || H.length === 0) return 0;
  var n = H.length;
  var consecStress = 0;
  for (var i = n - 1; i >= 0; i--) {
    if (H[i] === 'p3' || H[i] === 'p7a' || H[i] === 'p9') consecStress++;
    else break;
  }
  var consecRecovery = 0;
  for (var i = n - 1; i >= 0; i--) {
    if (H[i] === 'p4' || H[i] === 'p5' || H[i] === 'p6' || H[i] === 'p0') consecRecovery++;
    else break;
  }
  var priorCollapse = H.some(function(p){ return p === 'p9'; });
  var bias = 0;
  bias += Math.min(consecStress, 8) * 0.04;
  bias -= Math.min(consecRecovery, 6) * 0.03;
  if (priorCollapse) bias += 0.05;
  return Math.max(-0.3, Math.min(0.3, bias));
}

function phaseCouplingBias(prevPhase) {
  var biases = {};
  PHASE_KEYS.forEach(function(k) { biases[k] = 0; });
  if (!prevPhase || !M_MATRIX[prevPhase]) return biases;
  var row = M_MATRIX[prevPhase];
  Object.keys(row).forEach(function(k) { biases[k] = row[k] || 0; });
  return biases;
}

function checkViabilityBreach(row) {
  var runway = isNaN(row.runway) ? 999 : row.runway;
  var breach = runway < LIMEN.RUNWAY_ELEVATE_QTR;
  return { breach: breach, forced: runway < LIMEN.RUNWAY_FORCE_QTR, runway: runway };
}

function computeRecencyWeight(rows, currentIdx) {
  var lookback = Math.min(8, currentIdx + 1);
  var recent = 0, total = 0;
  for (var i = currentIdx - lookback + 1; i <= currentIdx; i++) {
    if (i < 0) continue;
    var cashPrev = i > 0 ? rows[i-1].Cash : NaN;
    var cashCurr = rows[i].Cash;
    if (!isNaN(cashPrev) && !isNaN(cashCurr) && cashPrev > 0) {
      var decline = Math.max(0, (cashPrev - cashCurr) / cashPrev);
      total += decline;
      if (i >= currentIdx - Math.floor(lookback/2)) recent += decline;
    }
  }
  return total > 1e-9 ? recent / total : 0;
}

function computeAccumulator(stressHistory, dominantPhaseHistory) {
  var n = stressHistory.length;
  if (n === 0) return 0;
  var C = 0;
  var lambda = LIMEN.LAMBDA;
  for (var k = 0; k < n; k++) {
    var age = n - 1 - k;
    var weight = Math.pow(2, -age / lambda);
    var phase = dominantPhaseHistory[k] || 'p0';
    // v4.0.2: gamma now reflects empirical per-phase persistence via the
    // ATTRACTOR/RECOVERY/TRANSIENT dynamical class. Test #5 confirmed the
    // old semantic bucketing (p7 + p9 lumped with p7a) is empirically wrong.
    var gamma = gammaForPhase(phase);
    var phaseWeight = weight * Math.pow(gamma, age);
    C += phaseWeight * Math.max(0, stressHistory[k]);
  }
  return Math.max(0, C);
}

function scoreAllPhases(rows) {
  if (!rows || rows.length === 0) return rows;
  function _sig(row, col, negate) {
    var v = isNaN(row[col]) ? 0 : row[col];
    return sigmoid(negate ? -v : v);
  }
  rows.forEach(function(r) {
    r.risk_var_rev      = _sig(r,'z_var_Revenue');
    r.risk_ac_rev       = _sig(r,'z_ac_Revenue');
    r.risk_slope_rev    = _sig(r,'z_slope_Revenue', true);
    r.risk_accel_rev    = _sig(r,'z_accel_Revenue', true);
    r.risk_var_ocf      = _sig(r,'z_var_OCF');
    r.risk_ac_ocf       = _sig(r,'z_ac_OCF');
    r.risk_slope_ocf    = _sig(r,'z_slope_OCF', true);
    r.risk_accel_ocf    = _sig(r,'z_accel_OCF', true);
    r.risk_slope_debt   = _sig(r,'z_slope_Debt');
    r.risk_accel_debt   = _sig(r,'z_accel_Debt');
    r.risk_slope_cash   = _sig(r,'z_slope_Cash');
    r.risk_break_rev    = (r.break_Revenue  > 1) ? 1.0 : 0.0;
    r.risk_break_ocf    = (r.break_OCF      > 1) ? 1.0 : 0.0;
    r.risk_break_rev_8q = (r.break_Revenue_8q > 1) ? 1.0 : 0.0;
    r.risk_liq          = sigmoid(-(isNaN(r.z_runway) ? 0 : r.z_runway));
    r.stab_var_rev          = 1.0 - r.risk_var_rev;
    r.stab_var_ocf          = 1.0 - r.risk_var_ocf;
    r.health_slope_rev      = 1.0 - r.risk_slope_rev;
    r.health_slope_ocf      = 1.0 - r.risk_slope_ocf;
    r.health_accel_rev      = 1.0 - r.risk_accel_rev;
    r.health_slope_cash     = _sig(r,'z_slope_Cash');
    r.health_slope_debt_neg = _sig(r,'z_slope_Debt', true);
    var dvRev = isNaN(r.delta_var_Revenue) ? 0 : r.delta_var_Revenue;
    var dvOcf = isNaN(r.delta_var_OCF)     ? 0 : r.delta_var_OCF;
    r.var_decreasing_rev = sigmoid(-10.0 * dvRev);
    r.var_decreasing_ocf = sigmoid(-10.0 * dvOcf);
    r.burn_decelerating  = _sig(r,'z_accel_OCF');
    r.rev_diversity      = 1.0 - r.risk_ac_rev;
    r.p0_base = (r.stab_var_rev + r.stab_var_ocf + r.health_slope_rev + sigmoid(isNaN(r.z_slope_Revenue) ? 0 : r.z_slope_Revenue)) / 4;
    var varSpikeRev = sigmoid(10.0 * dvRev);
    r.p1_base  = (varSpikeRev + r.risk_slope_rev + r.risk_accel_rev) / 3;
    r.p2_base  = (r.rev_diversity + r.health_slope_rev + r.health_accel_rev + r.health_slope_ocf) / 4;
    r.p3_base  = (r.risk_var_rev + r.risk_ac_rev + r.risk_slope_rev + r.risk_accel_rev + r.risk_var_ocf + r.risk_ac_ocf) / 6;
    var slopeFlat = Math.max(0, Math.min(1, 1.0 - Math.abs(r.risk_slope_rev - 0.5) * 2));
    r.p4_base  = (r.var_decreasing_rev + r.var_decreasing_ocf + r.burn_decelerating + slopeFlat) / 4;
    r.p5_base  = (r.health_slope_rev + r.health_slope_ocf + r.risk_var_rev + r.health_slope_debt_neg) / 4;
    var acFlat = Math.max(0, Math.min(1, 1.0 - Math.abs(r.risk_ac_rev - 0.5) * 2));
    r.p6_base  = (r.stab_var_rev + r.stab_var_ocf + r.health_slope_cash + r.health_slope_debt_neg + acFlat) / 5;
    r.p7_base  = (r.risk_break_rev + r.risk_break_ocf + r.risk_accel_debt) / 3;
    r.p8_base  = (r.risk_break_rev + r.health_slope_rev + r.rev_diversity + r.risk_break_rev_8q) / 4;
    if (r.p3_base > 0.6) {
      var zDff = isNaN(r.z_delta_fedfunds) ? 0 : r.z_delta_fedfunds;
      var raw  = 0.5 * r.p3_base + 0.3 * r.risk_liq + 0.2 * r.risk_break_rev + 0.2 * Math.max(0, zDff);
      r.p9_base = sigmoid(raw);
    } else {
      r.p9_base = 0.0;
    }
    r.p10_base = (r.risk_break_rev_8q + r.stab_var_rev + r.stab_var_ocf + slopeFlat) / 4;
    r.p7a_base = r.p7_base;
    r.p7b_base = r.p7_base;
  });
  var H = [];
  var stressHistory = [];
  var phaseHistory  = [];
  rows.forEach(function(r, idx) {
    var gH = computePathModifier(H);
    var prevPhase = H.length > 0 ? H[H.length - 1] : null;
    var mBias = phaseCouplingBias(prevPhase);
    var phases = ['p0','p1','p2','p3','p4','p5','p6','p7','p8','p9','p10','p7a','p7b'];
    phases.forEach(function(p) {
      var riskPhases = ['p3','p7','p7a','p9'];
      var gBias = riskPhases.indexOf(p) >= 0 ? gH : -gH * 0.5;
      var raw = r[p+'_base'] + gBias + (mBias[p] || 0);
      r[p] = Math.max(0, Math.min(1, raw));
    });
    var stressThisQ = r.p3 >= LIMEN.P3_ENTRY ? r.p3 : 0;
    stressHistory.push(stressThisQ);
    var curDominant = _getDominantRaw(r);
    phaseHistory.push(curDominant);
    var C = computeAccumulator(stressHistory, phaseHistory);
    r.C_t = C;
    if (C > LIMEN.P0_SUPPRESSION_THRESH) {
      var suppression = Math.min(0.35, (C - LIMEN.P0_SUPPRESSION_THRESH) * 0.4);
      r.p0 = Math.max(0, r.p0 - suppression);
    }
    var hasPeltBreak = (r.risk_break_rev > 0 || r.risk_break_ocf > 0);
    var via = checkViabilityBreach(r);
    if (hasPeltBreak && via.breach) {
      if (via.forced) {
        r.p7a = Math.max(r.p7a, 0.80);
      } else {
        r.p7a = Math.min(1, r.p7_base + 0.15 + (4 - Math.min(via.runway, 4)) * 0.05);
      }
      r.p7b = r.p7_base * 0.3;
    } else if (hasPeltBreak && !via.breach) {
      r.p7b = Math.min(1, r.p7_base + 0.10);
      r.p7a = r.p7_base * 0.2;
    } else {
      r.p7a = r.p7_base * 0.5;
      r.p7b = r.p7_base * 0.5;
    }
    if (!hasPeltBreak && via.runway < LIMEN.RUNWAY_ELEVATE_QTR) {
      r.p7a = Math.min(1, r.p7a + (LIMEN.RUNWAY_ELEVATE_QTR - via.runway) * 0.04);
    }
    H.push(_getDominantResolved(r));
    r.H_length = H.length;
  });
  var alertActive = false;
  var consecAbove = 0, consecBelow = 0;
  var THRESH = LIMEN.P3_ENTRY;
  rows.forEach(function(r) {
    if (r.p3 >= THRESH || r.p7a >= 0.6) {
      consecAbove++;
      consecBelow = 0;
      if (consecAbove >= LIMEN.HYSTERESIS_CONSEC) alertActive = true;
    } else {
      consecBelow++;
      consecAbove = 0;
      if (consecBelow >= LIMEN.HYSTERESIS_CONSEC) alertActive = false;
    }
    r.hysteresis_alert = alertActive;
  });
  rows.forEach(function(r, idx) {
    r.recency_weight = computeRecencyWeight(rows, idx);
    r.recency_gate_active = r.recency_weight > LIMEN.RECENCY_WEIGHT_THRESH;
  });
  return rows;
}

function _getDominantRaw(r) {
  var phases = ['p0','p1','p2','p3','p4','p5','p6','p7','p8','p9','p10'];
  var best = 'p0', bestVal = -1;
  phases.forEach(function(p) { if ((r[p+'_base']||0) > bestVal) { bestVal = r[p+'_base']||0; best = p; } });
  return best;
}

function _getDominantResolved(r) {
  var phases = ['p0','p1','p2','p3','p4','p5','p6','p7a','p7b','p8','p9','p10'];
  var best = 'p0', bestVal = -1;
  phases.forEach(function(p) { if ((r[p]||0) > bestVal) { bestVal = r[p]||0; best = p; } });
  return best;
}

function _cashSlope(rows, i, lookback) {
  lookback = lookback || 6;
  var vals = [];
  for (var j = Math.max(0, i-lookback+1); j <= i; j++) {
    var c = rows[j].Cash;
    if (!isNaN(c) && c > 0) vals.push([j, Math.log(c)]);
  }
  if (vals.length < 3) return 0.0;
  var tMean = vals.reduce(function(a,v){return a+v[0];},0) / vals.length;
  var cMean = vals.reduce(function(a,v){return a+v[1];},0) / vals.length;
  var num = 0, den = 0;
  vals.forEach(function(v) { num += (v[0]-tMean)*(v[1]-cMean); den += (v[0]-tMean)*(v[0]-tMean); });
  return den > 1e-12 ? num/den : 0;
}

function analyseTrajectory(rows) {
  if (!rows || rows.length === 0) return rows;
  var n = rows.length;
  var curAccum = 0, consecStress = 0, nEval = 0;
  for (var i = 0; i < n; i++) {
    var r = rows[i];
    if (quarterYear(r.quarter) < LIMEN.START_YEAR) {
      r.stress_accum = 0; r.distress_score = 0; r.recovered = false;
      curAccum = 0; consecStress = 0; continue;
    }
    nEval++;
    var hasRevData = !isNaN(r.z_var_Revenue);
    var hasOcfData = !isNaN(r.z_var_OCF);
    if (!hasRevData && !hasOcfData) {
      r.stress_accum = curAccum;
      r.distress_score = curAccum / Math.max(Math.sqrt(nEval), 1);
      r.recovered = false; continue;
    }
    var cslope = _cashSlope(rows, i, 6);
    if (r.p3 >= LIMEN.P3_ENTRY) {
      consecStress++;
      var baseCharge  = r.p3 * LIMEN.STRESS_CHARGE_RATE;
      var amplifier   = 1.0 + LIMEN.P7_AMP * (r.p7a || r.p7 || 0);
      var consecBonus = 1.0 + LIMEN.CONSEC_BONUS_RATE * Math.min(consecStress, LIMEN.MAX_CONSEC_QTRS);
      var vulnAmp     = 1.0;
      if (cslope < -0.15) vulnAmp += 1.0;
      else if (cslope < -0.05) vulnAmp += 0.5;
      curAccum += baseCharge * amplifier * consecBonus * vulnAmp;
      r.recovered = false;
    } else {
      consecStress = Math.max(consecStress - 1, 0);
      var recoveryMean = (r.p4 + r.p5 + r.p6) / 3.0;
      if (recoveryMean > r.p3 + 0.01) {
        var decay = LIMEN.RECOVERY_DECAY;
        if (cslope > 0.03) decay *= 0.7;
        curAccum *= decay;
        r.recovered = true;
      } else {
        curAccum *= LIMEN.BASELINE_DECAY;
        r.recovered = false;
      }
    }
    r.stress_accum  = r.C_t || Math.max(curAccum, 0);
    r.distress_score = r.stress_accum / Math.max(Math.sqrt(nEval), 1);
  }
  return rows;
}

function computeRuptureScore(rows) {
  if (!rows || rows.length === 0) return { score: 0, quarter: null, details: {} };
  var btRows = rows.filter(function(r){ return quarterYear(r.quarter) >= LIMEN.START_YEAR; });
  if (btRows.length === 0) return { score: 0, quarter: null, details: {} };
  var n = btRows.length;
  var ruptureEvents = [];
  var maxCashDrop = 0, maxDebtSpike = 0, maxVarRatio = 0;
  for (var i = 1; i < n; i++) {
    var signals = 0, cashDropPct = 0, debtSpikePct = 0, varRatio = 0;
    var prevCash = btRows[i-1].Cash, currCash = btRows[i].Cash;
    if (!isNaN(prevCash) && !isNaN(currCash) && prevCash > 0) {
      cashDropPct = (prevCash - currCash) / prevCash;
      if (cashDropPct > LIMEN.RUPTURE_CASH_DROP) { signals++; maxCashDrop = Math.max(maxCashDrop, cashDropPct); }
    }
    var prevDebt = btRows[i-1].Debt, currDebt = btRows[i].Debt;
    if (!isNaN(prevDebt) && !isNaN(currDebt) && prevDebt > 0) {
      debtSpikePct = (currDebt - prevDebt) / prevDebt;
      if (debtSpikePct > LIMEN.RUPTURE_DEBT_SPIKE) { signals++; maxDebtSpike = Math.max(maxDebtSpike, debtSpikePct); }
    } else if (!isNaN(currDebt) && currDebt > 0 && (isNaN(prevDebt) || prevDebt === 0)) {
      debtSpikePct = 1.0; signals++; maxDebtSpike = Math.max(maxDebtSpike, 1.0);
    }
    var currVar = btRows[i].var_Revenue;
    if (!isNaN(currVar) && i >= 4) {
      var trailing = [];
      for (var k = Math.max(0, i-8); k < i; k++) if (!isNaN(btRows[k].var_Revenue)) trailing.push(btRows[k].var_Revenue);
      if (trailing.length >= 2) {
        trailing.sort(function(a,b){return a-b;});
        var medVar = trailing.length%2===1 ? trailing[Math.floor(trailing.length/2)] : (trailing[trailing.length/2-1]+trailing[trailing.length/2])/2;
        if (medVar > 1e-12) { varRatio = currVar/medVar; if (varRatio > LIMEN.RUPTURE_VAR_JUMP) { signals++; maxVarRatio = Math.max(maxVarRatio, varRatio); } }
      }
    }
    if (signals >= LIMEN.RUPTURE_MIN_SIGNALS) {
      var intensity = signals * (0.5 + Math.max(cashDropPct,0) + Math.max(debtSpikePct,0) + Math.min(varRatio,20.0)/10.0);
      ruptureEvents.push({ idx: i, quarter: btRows[i].quarter, intensity: intensity, signals: signals, cashDrop: cashDropPct });
    }
  }
  var RECOVERY_HORIZON = 4, SURVIVORSHIP_QUARTERS = 8;
  var unrecovered = [];
  ruptureEvents.forEach(function(evt) {
    var remaining = n - evt.idx - 1;
    if (remaining < 2) { unrecovered.push(evt); return; }
    if (remaining >= SURVIVORSHIP_QUARTERS) return;
    var ruptureCash = btRows[evt.idx].Cash;
    var recovered = false;
    var checkEnd = Math.min(evt.idx + RECOVERY_HORIZON, n-1);
    for (var ci = evt.idx+1; ci <= checkEnd; ci++) {
      var postCash = btRows[ci].Cash;
      if (!isNaN(ruptureCash) && ruptureCash > 0) {
        if (!isNaN(postCash) && postCash >= ruptureCash) { recovered = true; break; }
      } else if (!isNaN(postCash) && postCash > 0) { recovered = true; break; }
    }
    if (!recovered) unrecovered.push(evt);
  });
  var bestScore = 0, firstQ = null;
  if (unrecovered.length > 0) {
    unrecovered.forEach(function(e){ if (e.intensity > bestScore) bestScore = e.intensity; });
    firstQ = unrecovered.reduce(function(a,e){ return !a || e.quarter < a ? e.quarter : a; }, null);
  }
  return { score: bestScore, quarter: firstQ, details: { nRuptureQ: ruptureEvents.length, nUnrecovered: unrecovered.length, maxCashDrop: maxCashDrop, maxDebtSpike: maxDebtSpike, maxVarRatio: maxVarRatio } };
}

function computeCompositeScore(rows) {
  if (!rows || rows.length === 0) return { composite: 0, firstQ: null, details: {}, alert: false };
  var btRows = rows.filter(function(r){ return quarterYear(r.quarter) >= LIMEN.START_YEAR; });
  if (btRows.length === 0) return { composite: 0, firstQ: null, details: {}, alert: false };
  var nEval = btRows.length;
  var p3Vals   = btRows.map(function(r){ return r.p3; });
  var cashVals = btRows.map(function(r){ return r.Cash; });
  var stressedMask = p3Vals.map(function(v){ return v >= LIMEN.P3_ENTRY; });
  var nStressed    = stressedMask.filter(Boolean).length;
  var stressRate   = nStressed / Math.max(nEval, 1);
  var maxConsec    = 0, curC = 0;
  stressedMask.forEach(function(s){ curC = s ? curC+1 : 0; maxConsec = Math.max(maxConsec, curC); });
  var maxP3 = Math.max.apply(null, p3Vals);
  var validCash = [];
  cashVals.forEach(function(v,i){ if (!isNaN(v) && v > 0) validCash.push({i:i,v:v}); });
  var cashDecline = 0;
  if (validCash.length >= 2) cashDecline = Math.max(0, Math.min(1, 1.0 - validCash[validCash.length-1].v / validCash[0].v));
  var latestRow = btRows[btRows.length - 1];
  var recencyGateActive = latestRow && latestRow.recency_gate_active;
  var sustainedMask = p3Vals.map(function(v){ return v >= LIMEN.SUSTAINED_THRESH; });
  var maxConsecSustained = 0, curCS = 0;
  sustainedMask.forEach(function(s){ curCS = s ? curCS+1 : 0; maxConsecSustained = Math.max(maxConsecSustained, curCS); });
  var tailN = Math.min(2, p3Vals.length);
  var stillStressed = tailN > 0 && p3Vals.slice(-tailN).every(function(v){ return v >= LIMEN.P3_ENTRY; });
  var sustainedBonus = 0;
  if (stillStressed && maxConsecSustained >= LIMEN.SUSTAINED_MIN_CONSEC) {
    sustainedBonus = Math.max(0, maxConsecSustained - (LIMEN.SUSTAINED_MIN_CONSEC-1)) * LIMEN.SUSTAINED_WEIGHT;
  }
  var pathA = 2.5*stressRate + 0.5*maxConsec/10.0 + 0.5*Math.max(maxP3-LIMEN.P3_ENTRY,0) + sustainedBonus;
  var pathB = recencyGateActive ? 1.0*stressRate + 2.0*cashDecline : 0.5*stressRate + 0.5*cashDecline;
  var rupture = computeRuptureScore(rows);
  var pathC   = rupture.score;
  var composite = Math.max(pathA, pathB, pathC);
  var hystAlert = latestRow && latestRow.hysteresis_alert;
  var alertA = pathA >= LIMEN.COMPOSITE_THRESH_A;
  var alertB = pathB >= LIMEN.COMPOSITE_THRESH_B;
  var alertC = pathC >= LIMEN.COMPOSITE_THRESH_C;
  var alert  = (alertA || alertB || alertC) && hystAlert;
  var firstQ = null;
  if (alert) {
    var candidates = [];
    if (alertC && rupture.quarter) candidates.push(rupture.quarter);
    if (alertA || alertB) {
      var accumVals = btRows.map(function(r){ return r.stress_accum || 0; });
      var maxAccum  = Math.max.apply(null, accumVals);
      if (maxAccum > 0) {
        var halfPeak = maxAccum * 0.5;
        for (var i = 0; i < accumVals.length; i++) { if (accumVals[i] >= halfPeak) { candidates.push(btRows[i].quarter); break; } }
      }
    }
    if (candidates.length === 0 && nStressed > 0) {
      for (var i = 0; i < stressedMask.length; i++) { if (stressedMask[i]) { candidates.push(btRows[i].quarter); break; } }
    }
    if (candidates.length > 0) firstQ = candidates.sort()[0];
  }
  var everP3        = stressedMask.some(Boolean);
  var everRecovered = btRows.some(function(r){ return r.recovered; });
  var p7aVals    = btRows.map(function(r){ return r.p7a || 0; });
  var maxP7a     = Math.max.apply(null, p7aVals);
  var trajectory;
  if (alert && pathC >= LIMEN.COMPOSITE_THRESH_C) trajectory = 'TERMINAL_DIVERGENCE';
  else if (alert && maxP7a > 0.65)               trajectory = 'TERMINAL_DIVERGENCE';
  else if (alert)                                trajectory = 'UNRECOVERED';
  else if (!everP3)                              trajectory = 'STABLE';
  else if (everRecovered && !alert)              trajectory = 'RECOVERED';
  else                                           trajectory = 'MILD_STRESS';
  return {
    composite: composite, firstQ: firstQ, alert: alert, trajectory: trajectory,
    details: {
      stressRate: stressRate, nStressed: nStressed, maxConsec: maxConsec,
      maxConsecSustained: maxConsecSustained, sustainedBonus: sustainedBonus,
      maxP3: maxP3, cashDecline: cashDecline, recencyGateActive: recencyGateActive,
      pathA: pathA, pathB: pathB, pathC: pathC,
      ruptureMaxCashDrop:  rupture.details.maxCashDrop  || 0,
      ruptureMaxDebtSpike: rupture.details.maxDebtSpike || 0,
      ruptureMaxVarRatio:  rupture.details.maxVarRatio  || 0,
    }
  };
}

function runLimenPipeline(companyData, fredDelta) {
  var rows = computeAllFeatures(companyData, fredDelta || {});
  rows = scoreAllPhases(rows);
  rows = analyseTrajectory(rows);
  var result = computeCompositeScore(rows);
  result.rows = rows;
  return result;
}

function getDominantPhase(row) {
  if (!row) return null;
  var phases = ['p0','p1','p2','p3','p4','p5','p6','p7a','p7b','p8','p9','p10'];
  var best = null, bestVal = -1;
  phases.forEach(function(p) { if ((row[p]||0) > bestVal) { bestVal = row[p]||0; best = p; } });
  return best;
}

// ─── END VERBATIM FROM bk-scorer.js ─────────────────────────────

// ─── ESM Exports (only addition to bk-scorer.js kernel) ─────────
export {
  LIMEN,
  KERNEL_VERSION,
  CONSTANTS_HASH,
  runLimenPipeline,
  getDominantPhase,
  computeAccumulator,
  dateToQuarter,
  quarterToDate,
  quarterDiff,
  quarterYear,
};
