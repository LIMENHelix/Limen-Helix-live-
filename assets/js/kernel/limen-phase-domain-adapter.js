/**
 * limen-phase-domain-adapter.js — Phase 24X (Honest Middle Ground)
 *
 * Maps domain health signals into provisional P0-P7b phase annotations
 * using 3 reconstructed state variables: accumulatorProxy, varianceProxy, breakProxy.
 *
 * SUPPRESSED PHASES: P7a, P9, P10, P8 (require viability/recovery inputs not available)
 * SUPPORTED PHASES:  P0, P1, P2, P3, P4, P5, P6, P7b
 *
 * All phase output is PROVISIONAL and includes phaseSupport level.
 * Phase NEVER writes back into stress/activity/confidence/maturity.
 *
 * Reads: window.LIMENDomains, window.LIMENLongMemory, window.LIMENCrossDomain
 * Writes: window.LIMENPhaseAnnotations (separate namespace)
 * Event: limen:phase-domain-update
 *
 * Exposes: window.LIMENPhaseDomainAdapter
 */
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════
  // CONSTANTS
  // ══════════════════════════════════════════════════════════════════════
  //
  // This file annotates domain stress-proxy panels with provisional
  // phase labels for civilization.html. It is NOT the validated phase
  // kernel — that lives server-side and is reached via
  // POST /api/helix-report/score. Do not import validated-kernel
  // thresholds into this file; the value below is a generic display
  // threshold, not the kernel's P3 gate.

  var STRESS_LABEL_THRESHOLD = 0.6;  // generic display cutoff (not a kernel constant)
  var DEBOUNCE_MS = 10000;
  var MAX_HISTORY = 20;           // deeper history for accumulator
  var STRESS_HISTORY_MAX = 60;    // ~10 min of 10s samples for proxies

  // Break proxy confirmation
  var BREAK_RAW_THRESHOLD = 0.18;
  var BREAK_CONFIRM_SNAPSHOTS = 3;
  var BREAK_ACCUM_GATE = 0.40;    // accumulator must be >= this for confirmed break
  var BREAK_CONF_GATE = 0.50;     // domain confidence must be >= this

  // Supported phases only — no terminal language without viability
  var PHASE_DEFS = {
    p0:  { label: 'SOURCE',      color: '#0EA5E9' },
    p1:  { label: 'RUPTURE',     color: '#06B6D4' },
    p2:  { label: 'RHYTHM',      color: '#0EA5E9' },
    p3:  { label: 'INSTABILITY', color: '#EF7346' },
    p4:  { label: 'STABILIZING', color: '#10B981' },
    p5:  { label: 'ENDURANCE',   color: '#22C55E' },
    p6:  { label: 'ORDER',       color: '#10B981' },
    p7b: { label: 'DIVERGENCE',  color: '#8B5CF6' }
  };

  var PHASE_PRIORITY = {
    p0: 0.0, p1: 0.3, p2: 0.3, p3: 0.7, p4: 0.4, p5: 0.6,
    p6: 0.3, p7b: 0.8
  };

  var PHASE_OPP_FAMILIES = {
    p3:  ['instability detection', 'rapid intervention platform', 'diagnostic intelligence'],
    p5:  ['endurance platform', 'resilience tooling', 'continuity system'],
    p7b: ['replacement infrastructure', 'restructuring advisory', 'transition platform']
  };

  var SOFT_DOMAIN_DAMPEN = {
    law: 0.7, religion: 0.7, research: 0.7,
    culture: 0.7, communication: 0.75, education: 0.8
  };

  var PHASE_ORDER = { p0:0, p2:1, p4:2, p6:3, p1:4, p5:5, p3:6, p7b:7 };

  // ══════════════════════════════════════════════════════════════════════
  // STATE
  // ══════════════════════════════════════════════════════════════════════

  var _phaseHistory = {};           // dk -> [{ phase, timestamp, stress }]
  var _stressHistory = {};          // dk -> [{ stress, timestamp }] for proxy computation
  var _breakConfirmCounter = {};    // dk -> { count, lastRaw }
  var _lastUpdate = 0;
  var _annotations = {};

  // ══════════════════════════════════════════════════════════════════════
  // A. THREE RECONSTRUCTED STATE VARIABLES
  // ══════════════════════════════════════════════════════════════════════

  /**
   * 1. ACCUMULATOR DEPTH PROXY
   *
   * C_proxy = weighted persistence of stress above thresholds.
   * Heavier weight for recent persistence. No activity input.
   * Uses in-memory stress history + LIMENLongMemory daily series.
   *
   * Separates: transient P3 from sustained P5/P7b.
   */
  function _computeAccumulatorProxy(dk, currentStress) {
    var hist = _stressHistory[dk] || [];
    if (hist.length === 0) return currentStress * 0.5; // cold start

    var now = Date.now();
    var halfLife = 120000; // 2 minutes — recent stress counts more
    var sum = 0;
    var weightSum = 0;

    for (var i = 0; i < hist.length; i++) {
      var age = now - hist[i].timestamp;
      var weight = Math.pow(2, -age / halfLife);
      var s = hist[i].stress;
      // Only accumulate stress above baseline (0.20)
      var contribution = Math.max(0, s - 0.20);
      sum += contribution * weight;
      weightSum += weight;
    }

    var shortTerm = weightSum > 0 ? sum / weightSum : 0;

    // Augment with long memory if available
    var longMem = window.LIMENLongMemory;
    var longTerm = 0;
    if (longMem && longMem.getBaseline) {
      var baseline = longMem.getBaseline(dk, 30);
      if (baseline && baseline.mean > 0) {
        // How far above 30-day baseline is the domain?
        longTerm = Math.max(0, currentStress - baseline.mean);
      }
    }

    // Blend: 70% short-term accumulation, 30% long-term deviation
    var proxy = shortTerm * 0.7 + longTerm * 0.3;
    return Math.min(1.0, r(proxy));
  }

  /**
   * 2. VARIANCE / INSTABILITY PROXY
   *
   * Measures whether stress is oscillatory, flat-high, rising-break, or stabilizing.
   * Uses rolling std, slope sign changes, burst frequency.
   *
   * Separates: instability (P3) from endurance (P5).
   */
  function _computeVarianceProxy(dk) {
    var hist = _stressHistory[dk] || [];
    if (hist.length < 5) return 0;

    // Use last 30 samples (~5 min at 10s interval)
    var window = hist.slice(-30);
    var values = window.map(function (h) { return h.stress; });
    var n = values.length;

    // Mean
    var mean = 0;
    for (var i = 0; i < n; i++) mean += values[i];
    mean /= n;

    // Std dev
    var variance = 0;
    for (var j = 0; j < n; j++) variance += (values[j] - mean) * (values[j] - mean);
    variance /= n;
    var std = Math.sqrt(variance);

    // Sign changes in diff (oscillation detector)
    var signChanges = 0;
    for (var k = 2; k < n; k++) {
      var d1 = values[k - 1] - values[k - 2];
      var d2 = values[k] - values[k - 1];
      if ((d1 > 0.01 && d2 < -0.01) || (d1 < -0.01 && d2 > 0.01)) signChanges++;
    }
    var oscillation = n > 3 ? signChanges / (n - 2) : 0;

    // Combine: high std + high oscillation = high variance proxy
    var proxy = std * 3.0 + oscillation * 0.5;
    return Math.min(1.0, r(proxy));
  }

  /**
   * 3. BREAK PROXY (with confirmation floor)
   *
   * Approximates structural break using:
   * - significant slope change between windows
   * - large regime shift (mean jump)
   * - shock persistence
   *
   * breakProxyRaw computed each cycle.
   * breakProxyConfirmed only when raw >= threshold for 3 consecutive snapshots
   * AND accumulator >= gate AND confidence >= gate.
   *
   * Separates: high-stress instability (P3/P5) from structural divergence (P7b).
   */
  function _computeBreakProxy(dk, currentStress, accumulatorProxy, confidence) {
    var hist = _stressHistory[dk] || [];
    if (hist.length < 10) return { raw: 0, confirmed: false };

    var values = hist.map(function (h) { return h.stress; });
    var n = values.length;
    var halfN = Math.floor(n / 2);

    // Mean of first half vs second half
    var mean1 = 0, mean2 = 0;
    for (var i = 0; i < halfN; i++) mean1 += values[i];
    mean1 /= halfN;
    for (var j = halfN; j < n; j++) mean2 += values[j];
    mean2 /= (n - halfN);

    var meanShift = Math.abs(mean2 - mean1);

    // Slope of first half vs second half
    function slope(arr) {
      var m = arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
      var num = 0, den = 0;
      for (var si = 0; si < arr.length; si++) {
        num += (si - (arr.length - 1) / 2) * (arr[si] - m);
        den += (si - (arr.length - 1) / 2) * (si - (arr.length - 1) / 2);
      }
      return den > 0 ? num / den : 0;
    }

    var slope1 = slope(values.slice(0, halfN));
    var slope2 = slope(values.slice(halfN));
    var slopeChange = Math.abs(slope2 - slope1);

    // Variance of second half (high = still unstable, low = settled at new level)
    var var2 = 0;
    for (var k = halfN; k < n; k++) var2 += (values[k] - mean2) * (values[k] - mean2);
    var2 /= (n - halfN);

    // Break proxy: mean shift matters most, slope change secondary
    // Cap if variance is high (oscillatory noise, not real break)
    var raw = meanShift * 2.0 + slopeChange * 5.0;
    if (var2 > 0.02) raw *= 0.6; // anti-oscillation cap

    raw = Math.min(1.0, r(raw));

    // Confirmation logic
    if (!_breakConfirmCounter[dk]) _breakConfirmCounter[dk] = { count: 0, lastRaw: 0 };
    var bc = _breakConfirmCounter[dk];

    if (raw >= BREAK_RAW_THRESHOLD) {
      bc.count++;
    } else {
      bc.count = 0;
    }
    bc.lastRaw = raw;

    var confirmed = bc.count >= BREAK_CONFIRM_SNAPSHOTS &&
                    accumulatorProxy >= BREAK_ACCUM_GATE &&
                    confidence >= BREAK_CONF_GATE;

    return { raw: raw, confirmed: confirmed, confirmCount: bc.count };
  }

  // ══════════════════════════════════════════════════════════════════════
  // STRESS HISTORY TRACKING (for proxy computation)
  // ══════════════════════════════════════════════════════════════════════

  function _recordStress(dk, stress) {
    if (!_stressHistory[dk]) _stressHistory[dk] = [];
    _stressHistory[dk].push({ stress: stress, timestamp: Date.now() });
    if (_stressHistory[dk].length > STRESS_HISTORY_MAX) _stressHistory[dk].shift();
  }

  // ══════════════════════════════════════════════════════════════════════
  // RECURSIVE PRESSURE
  // ══════════════════════════════════════════════════════════════════════

  function _computeRecursivePressure(dk) {
    var crossDomain = (window.LIMENCrossDomain && window.LIMENCrossDomain.active) || [];
    var domains = window.LIMENDomains || {};
    var pressure = 0;
    var contributions = 0;

    for (var i = 0; i < crossDomain.length; i++) {
      var pat = crossDomain[i];
      if (!pat.domains) continue;
      var involved = false;
      for (var j = 0; j < pat.domains.length; j++) {
        if (pat.domains[j] === dk) { involved = true; break; }
      }
      if (!involved) continue;
      for (var k = 0; k < pat.domains.length; k++) {
        var other = pat.domains[k];
        if (other === dk) continue;
        var otherStress = (domains[other] && domains[other].stress) || 0;
        pressure += (pat.severity || 0) * (pat.confidence || 0.5) * otherStress;
        contributions++;
      }
    }
    var hubFactor = Math.max(1, contributions * 0.7);
    return Math.min(1.0, pressure / hubFactor);
  }

  // ══════════════════════════════════════════════════════════════════════
  // PHASE CLASSIFICATION (honest rules, supported phases only)
  // ══════════════════════════════════════════════════════════════════════

  function _classifyPhase(dk, d) {
    var stress = d.stress || 0;
    var confidence = d.confidence || 0;
    var maturity = d.maturity || 'EARLY';
    var trend = d.trend || 0;
    var activity = d.activity || 0;

    // Soft-domain dampening (classification only)
    var dampen = SOFT_DOMAIN_DAMPEN[dk];
    var ps = dampen ? stress * dampen : stress;

    // Record stress for proxy computation
    _recordStress(dk, stress);

    // Compute 3 proxy state variables
    var accum = _computeAccumulatorProxy(dk, stress);
    var vari = _computeVarianceProxy(dk);
    var brk = _computeBreakProxy(dk, stress, accum, confidence);
    var recPressure = _computeRecursivePressure(dk);

    // Read long memory
    var longMem = window.LIMENLongMemory;
    var z = 0, regime = 'NORMAL';
    if (longMem) {
      if (longMem.getZScore) { var zv = longMem.getZScore(dk, 30); if (zv !== null) z = zv; }
      if (longMem.getRegime) regime = longMem.getRegime(dk, 30) || 'NORMAL';
    }

    // Phase history
    var history = _phaseHistory[dk] || [];
    var prevPhase = history.length > 0 ? history[history.length - 1].phase : 'p0';
    var wasElevated = false;
    for (var hi = 0; hi < history.length; hi++) {
      if (history[hi].phase === 'p3' || history[hi].phase === 'p5' || history[hi].phase === 'p7b') {
        wasElevated = true; break;
      }
    }

    // ── Guard rails ──
    if (ps < 0.30 && activity > 0.5 && confidence < 0.4) {
      return _result('p2', dk, stress, accum, vari, brk, recPressure, confidence, 'LOW', 'activity-only cap');
    }

    // ── Phase classification (priority order, supported phases only) ──

    // P7b DIVERGENCE: confirmed structural break + deep accumulator + high stress
    if (ps > 0.55 && brk.confirmed && accum >= 0.50 && (maturity === 'STRUCTURAL' || maturity === 'CONFIRMED')) {
      return _result('p7b', dk, stress, accum, vari, brk, recPressure, confidence, 'HIGH', 'breakConfirmed accum=' + r(accum));
    }

    // P3 INSTABILITY: stress above entry + unstable variance OR rising
    if (ps >= STRESS_LABEL_THRESHOLD && (maturity === 'CONFIRMED' || maturity === 'STRUCTURAL') && (vari > 0.15 || trend > 0.02)) {
      return _result('p3', dk, stress, accum, vari, brk, recPressure, confidence, 'MEDIUM', 'stress=' + r(ps) + ' var=' + r(vari));
    }

    // P5 ENDURANCE: high stress + deep accumulator + LOW variance (flat-high, growing under stress)
    if (ps >= 0.45 && accum >= 0.40 && vari < 0.20 && (maturity === 'STRUCTURAL' || maturity === 'CONFIRMED')) {
      return _result('p5', dk, stress, accum, vari, brk, recPressure, confidence, 'MEDIUM', 'accum=' + r(accum) + ' lowVar=' + r(vari));
    }

    // P3 (fallback): stress above entry but lower confidence about instability vs endurance
    if (ps >= STRESS_LABEL_THRESHOLD && maturity !== 'EARLY') {
      return _result('p3', dk, stress, accum, vari, brk, recPressure, confidence, 'LOW', 'stress elevated, classification undifferentiated');
    }

    // P1 RUPTURE: spike detection
    if ((z > 1.5 || (trend > 0.08 && ps > 0.30)) && (maturity === 'FORMING' || maturity === 'EARLY')) {
      return _result('p1', dk, stress, accum, vari, brk, recPressure, confidence, 'MEDIUM', 'z=' + r(z) + ' spike');
    }

    // P4 STABILIZING: declining from elevated phase
    if (ps < 0.55 && trend < -0.02 && wasElevated) {
      return _result('p4', dk, stress, accum, vari, brk, recPressure, confidence, 'LOW', 'declining from elevated');
    }

    // P6 ORDER: low stress, declining, confident
    if (ps < 0.35 && trend <= 0 && confidence >= 0.5 && accum < 0.25) {
      return _result('p6', dk, stress, accum, vari, brk, recPressure, confidence, 'MEDIUM', 'low stress ordered');
    }

    // P2 RHYTHM: moderate stress, stabilizing
    if (ps >= 0.20 && ps < 0.45 && Math.abs(trend) < 0.03) {
      return _result('p2', dk, stress, accum, vari, brk, recPressure, confidence, 'LOW', 'moderate stabilizing');
    }

    // P0 SOURCE: default
    return _result('p0', dk, stress, accum, vari, brk, recPressure, confidence, accum < 0.15 ? 'HIGH' : 'MEDIUM', 'baseline');
  }

  function _result(phase, dk, stress, accum, vari, brk, recPressure, confidence, support, reason) {
    var def = PHASE_DEFS[phase] || { label: '?', color: '#666' };

    // Phase confidence modulated by support level
    var supportMod = { HIGH: 0.9, MEDIUM: 0.6, LOW: 0.35 };
    var phaseConf = Math.min(0.90, confidence * (supportMod[support] || 0.35));

    var trajectory = _computeTrajectory(dk, phase);
    var histPhases = (_phaseHistory[dk] || []).map(function (h) { return h.phase; });

    return {
      phase: phase,
      label: def.label,
      color: def.color,
      phaseConfidence: r(phaseConf),
      phaseTrajectory: trajectory,
      phaseSupport: support,
      phaseProvisional: true,
      priorityMod: (PHASE_PRIORITY[phase] || 0) * (supportMod[support] || 0.35),
      recursivePressure: r(recPressure),
      directStress: stress,
      accumulatorProxy: accum,
      varianceProxy: vari,
      breakProxyRaw: brk.raw,
      breakProxyConfirmed: brk.confirmed,
      breakConfirmCount: brk.confirmCount,
      phaseHistory: histPhases,
      reason: reason
    };
  }

  function _computeTrajectory(dk, currentPhase) {
    var history = _phaseHistory[dk] || [];
    if (history.length < 2) return 'STABLE';
    var prev = history[history.length - 1].phase;
    var curOrd = PHASE_ORDER[currentPhase] || 0;
    var prevOrd = PHASE_ORDER[prev] || 0;
    if (curOrd > prevOrd + 1) return 'ESCALATING';
    if (curOrd < prevOrd - 1) return 'DECLINING';
    return 'STABLE';
  }

  // ══════════════════════════════════════════════════════════════════════
  // PHASE HISTORY
  // ══════════════════════════════════════════════════════════════════════

  function _updateHistory(dk, result) {
    if (!_phaseHistory[dk]) _phaseHistory[dk] = [];
    var arr = _phaseHistory[dk];
    var last = arr.length > 0 ? arr[arr.length - 1] : null;
    if (last && last.phase === result.phase && (Date.now() - last.timestamp) < 60000) return;
    arr.push({ phase: result.phase, timestamp: Date.now(), stress: result.directStress });
    if (arr.length > MAX_HISTORY) arr.shift();
  }

  // ══════════════════════════════════════════════════════════════════════
  // MAIN UPDATE
  // ══════════════════════════════════════════════════════════════════════

  function update() {
    var domains = window.LIMENDomains || {};
    var annotations = {};
    for (var dk in domains) {
      if (!domains.hasOwnProperty(dk)) continue;
      var result = _classifyPhase(dk, domains[dk]);
      annotations[dk] = result;
      _updateHistory(dk, result);
    }
    _annotations = annotations;
    window.LIMENPhaseAnnotations = annotations;
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('limen:phase-domain-update', {
        detail: { annotations: annotations, timestamp: Date.now() }
      }));
    }
  }

  function start() {
    window.addEventListener('limen:domain-update', function () {
      var now = Date.now();
      if (now - _lastUpdate < DEBOUNCE_MS) return;
      _lastUpdate = now;
      update();
    });
    if (window.LIMENDomains && Object.keys(window.LIMENDomains).length > 0) {
      update();
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  function r(v) { return Math.round(v * 100) / 100; }

  window.LIMENPhaseDomainAdapter = {
    start: start,
    update: update,
    getAnnotation: function (dk) { return _annotations[dk] || null; },
    getPhaseHistory: function (dk) { return _phaseHistory[dk] || []; },
    getStressHistory: function (dk) { return _stressHistory[dk] || []; },
    getOpportunityFamily: function (dk) {
      var ann = _annotations[dk];
      if (!ann) return null;
      return PHASE_OPP_FAMILIES[ann.phase] || null;
    },
    getPhaseDefs: function () { return PHASE_DEFS; },
    getPhasePriority: function () { return PHASE_PRIORITY; }
  };

})();
