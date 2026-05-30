/**
 * phase-estimator.js
 * LIMEN HELIX — Fractal Attractor Phase Estimator
 *
 * ARCHITECTURE NOTE: This is a heuristic approximation layer ONLY.
 * It does NOT touch or replicate phase_engine.py (server-side kernel).
 * phase_engine.py remains the authoritative source for actual phi(t) computation.
 * This file exists to provide UI feedback without exposing kernel logic.
 *
 * Upgrade from first-match rule engine to continuous attractor scoring with:
 *   - Weighted distance scoring against 11 phase attractor vectors
 *   - Temporal smoothing (EMA alpha=0.3)
 *   - Phase inertia (+0.12 for current phase)
 *   - Metastable zone detection (top-2 delta < 0.08)
 *   - Phase velocity tracking
 *   - 20-entry phase history buffer
 *   - Event hooks for phase-change, transition, velocity
 *
 * Inputs (polled from global state every 500ms):
 *   entropy        — from observer-node.js     [0-1]  system disorder
 *   coherence      — from global-workspace.js  [0-1]  broadcast coherence
 *   curiosity      — from curiosity-engine.js  [0-1]  gap/conflict detection
 *   conflict       — from curiosity-engine.js  [0-1]  internal contradiction level
 *   predictionErr  — from hebbian-learning.js  [0-1]  weight update delta magnitude
 *   pruning        — from hebbian-learning.js  [0-1]  decay/pruning activity
 *   stability      — from observer-node.js     [0-1]  node stability index
 *   momentum       — from memory-layer.js      [-1-1] trend direction
 *
 * Output:
 *   window.LIMENPhase = {
 *     estimated:  "P6",
 *     label:      "ORDER",
 *     confidence: 0.74,
 *     velocity:   0.11,
 *     metastable: false,
 *     blend:      null,
 *     timestamp:  Date.now()
 *   }
 *
 * HUD: PHASE: P6 ORDER (74%)  or  PHASE: P5/P8 TRANSITION (61%)
 *
 * Load order: after global-signals.js, before portal-ui.js
 */

(function () {
  'use strict';

  // ─── Phase attractor definitions ─────────────────────────────────────────

  var ATTRACTORS = {

    P0: {
      label: 'SOURCE', color: '#6B8FA3',
      description: 'DMN baseline active — autobiographical autopilot',
      vector:  { entropy: 0.20, coherence: 0.55, conflict: 0.15, stability: 0.75 },
      weights: { entropy: 0.20, coherence: 0.30, conflict: 0.20, stability: 0.30 }
    },

    P1: {
      label: 'RUPTURE', color: '#E05C3A',
      description: 'Salience network fires — prediction error, insula activation',
      vector:  { entropy: 0.65, predictionErr: 0.70, conflict: 0.60, stability: 0.20 },
      weights: { entropy: 0.25, predictionErr: 0.35, conflict: 0.25, stability: 0.15 }
    },

    P2: {
      label: 'RHYTHM', color: '#4A9B8E',
      description: 'Vagal entrainment — mirror systems, co-regulation',
      vector:  { stability: 0.65, coherence: 0.55, conflict: 0.25, entropy: 0.30 },
      weights: { stability: 0.30, coherence: 0.30, conflict: 0.25, entropy: 0.15 }
    },

    P3: {
      label: 'DARKNESS', color: '#2C1F3D',
      description: 'DMN hyperconnected — amygdala-driven threat loops',
      vector:  { entropy: 0.85, conflict: 0.70, predictionErr: 0.60, coherence: 0.20 },
      weights: { entropy: 0.40, conflict: 0.30, predictionErr: 0.20, coherence: 0.10 }
    },

    P4: {
      label: 'PEACE', color: '#7EB8A4',
      description: 'Ventral vagal dominance — parasympathetic restoration',
      vector:  { entropy: 0.15, conflict: 0.10, stability: 0.80, coherence: 0.60 },
      weights: { entropy: 0.25, conflict: 0.25, stability: 0.30, coherence: 0.20 }
    },

    P5: {
      label: 'AWARENESS', color: '#A8C8E0',
      description: 'DMN decoupled — salience switching, metacognition',
      vector:  { momentum: 0.40, curiosity: 0.55, entropy: 0.45, coherence: 0.45 },
      weights: { momentum: 0.25, curiosity: 0.30, entropy: 0.20, coherence: 0.25 }
    },

    P6: {
      label: 'ORDER', color: '#D4AF37',
      description: 'Executive-DMN coupling — DLPFC structured integration',
      vector:  { coherence: 0.75, conflict: 0.10, entropy: 0.25, stability: 0.70 },
      weights: { coherence: 0.35, conflict: 0.25, entropy: 0.20, stability: 0.20 }
    },

    P7: {
      label: 'DISSOLUTION', color: '#7B5EA7',
      description: 'Entropic brain — ego dissolution, PCC-mPFC decoupling',
      vector:  { pruning: 0.70, entropy: 0.65, coherence: 0.20, stability: 0.15 },
      weights: { pruning: 0.40, entropy: 0.30, coherence: 0.15, stability: 0.15 }
    },

    P8: {
      label: 'WITNESS', color: '#B0C4D8',
      description: 'Decentered awareness — PCC reconfiguration',
      vector:  { coherence: 0.55, curiosity: 0.20, conflict: 0.15, stability: 0.65 },
      weights: { coherence: 0.30, curiosity: 0.25, conflict: 0.20, stability: 0.25 }
    },

    P9: {
      label: 'THRESHOLD', color: '#F0E040',
      description: 'Global DMN dissolution — gamma coherence, thalamic shift',
      vector:  { entropy: 0.90, coherence: 0.80, curiosity: 0.70, predictionErr: 0.65 },
      weights: { entropy: 0.30, coherence: 0.30, curiosity: 0.20, predictionErr: 0.20 }
    },

    P10: {
      label: 'RESURRECTION', color: '#88C070',
      description: 'Novel DMN topology — neuroplastic consolidation',
      vector:  { momentum: 0.70, coherence: 0.65, predictionErr: 0.45, pruning: 0.30 },
      weights: { momentum: 0.30, coherence: 0.30, predictionErr: 0.20, pruning: 0.20 }
    }
  };

  var PHASE_KEYS = ['P0','P1','P2','P3','P4','P5','P6','P7','P8','P9','P10'];

  // ─── State ───────────────────────────────────────────────────────────────

  var _prevSmoothed = null;       // previous smoothed signals for EMA
  var _prevPhase = null;          // previous estimated phase key
  var _prevScore = 0;             // previous winning score for velocity
  var _history = [];              // rolling 20-entry phase history
  var HISTORY_MAX = 20;
  var INERTIA_BONUS = 0.12;
  var METASTABLE_THRESHOLD = 0.08;
  var SMOOTH_ALPHA = 0.3;         // current weight in EMA (0.3 current, 0.7 previous)

  // ─── Signal accessor ──────────────────────────────────────────────────────
  // Verified mappings from actual module APIs. DO NOT CHANGE.

  function readSignals() {
    var obs  = window.LIMENObserver   || {};
    var gw   = window.LIMENWorkspace  || {};
    var ce   = window.LIMENCuriosity  || {};
    var hebb = window.LIMENHebbian    || {};
    var mem  = window.LIMENMemory     || {};

    // entropy: obs.entropy is already 0-1
    var entropy = obs.entropy || 0;

    // stability: obs.stability is a STRING ("STABLE"/"TRANSITIONING"/"UNSTABLE")
    var stabilityStr = obs.stability || 'STABLE';
    var stability = 0.5;
    if (stabilityStr === 'STABLE') stability = 0.8;
    else if (stabilityStr === 'TRANSITIONING') stability = 0.5;
    else if (stabilityStr === 'UNSTABLE') stability = 0.2;

    // coherence: from workspace attentionScore (0-1)
    var coherence = gw.attentionScore || 0;

    // curiosity: from top curiosity hotNode score
    var curiosity = 0;
    if (ce.hotNodes && ce.hotNodes.length > 0) {
      curiosity = ce.hotNodes[0].score || 0;
    }

    // conflict: from conflicts array — maxSeverity*0.6 + countFactor*0.4
    var conflict = 0;
    if (ce.conflicts && ce.conflicts.length > 0) {
      var maxSev = 0;
      for (var i = 0; i < ce.conflicts.length; i++) {
        if (ce.conflicts[i].severity > maxSev) maxSev = ce.conflicts[i].severity;
      }
      var countFactor = Math.min(1, ce.conflicts.length / 5);
      conflict = maxSev * 0.6 + countFactor * 0.4;
    }

    // predictionErr: avg |delta| across strengthened + weakened edges, normalized by 0.2
    var predictionErr = 0;
    var hebbEntries = (hebb.strengthened || []).concat(hebb.weakened || []);
    if (hebbEntries.length > 0) {
      var sumDelta = 0;
      for (var d = 0; d < hebbEntries.length; d++) {
        sumDelta += Math.abs(hebbEntries[d].delta || 0);
      }
      predictionErr = Math.min(1, (sumDelta / hebbEntries.length) / 0.2);
    }

    // pruning: weakened count*0.5 + magnitude*0.5
    var pruning = 0;
    if (hebb.weakened && hebb.weakened.length > 0) {
      var weakSum = 0;
      for (var w = 0; w < hebb.weakened.length; w++) {
        weakSum += Math.abs(hebb.weakened[w].delta || 0);
      }
      var weakCount = Math.min(1, hebb.weakened.length / 5);
      var weakMag = Math.min(1, (weakSum / hebb.weakened.length) / 0.2);
      pruning = weakCount * 0.5 + weakMag * 0.5;
    }

    // momentum: (risingN - fallingN) / 3, dampened by oscillation
    var momentum = 0;
    var risingN  = (mem.risingPredictions  || []).length;
    var fallingN = (mem.fallingPredictions || []).length;
    var totalPred = risingN + fallingN;
    if (totalPred > 0) {
      momentum = (risingN - fallingN) / 3;
    }
    if (mem.oscillatingNodes && mem.oscillatingNodes.length > 2) {
      momentum *= 0.5;
    }

    return {
      entropy:       clamp(entropy, 0, 1),
      stability:     clamp(stability, 0, 1),
      coherence:     clamp(coherence, 0, 1),
      curiosity:     clamp(curiosity, 0, 1),
      conflict:      clamp(conflict, 0, 1),
      predictionErr: clamp(predictionErr, 0, 1),
      pruning:       clamp(pruning, 0, 1),
      momentum:      clamp(momentum, -1, 1)
    };
  }

  // ─── Temporal smoothing (EMA) ────────────────────────────────────────────

  function smoothSignals(raw) {
    if (!_prevSmoothed) {
      _prevSmoothed = {};
      for (var k in raw) {
        if (raw.hasOwnProperty(k)) _prevSmoothed[k] = raw[k];
      }
      return raw;
    }

    var smoothed = {};
    for (var key in raw) {
      if (raw.hasOwnProperty(key)) {
        smoothed[key] = _prevSmoothed[key] * (1 - SMOOTH_ALPHA) + raw[key] * SMOOTH_ALPHA;
      }
    }
    _prevSmoothed = smoothed;
    return smoothed;
  }

  // ─── Attractor scoring ───────────────────────────────────────────────────
  // score = sum( weight_i * (1 - |signal_i - attractor_i|) ), clamped 0-1

  function scoreAttractor(signals, attractor) {
    var vec = attractor.vector;
    var wts = attractor.weights;
    var sum = 0;

    for (var dim in vec) {
      if (vec.hasOwnProperty(dim)) {
        var sig = signals[dim] !== undefined ? signals[dim] : 0;
        var dist = Math.abs(sig - vec[dim]);
        sum += (wts[dim] || 0) * (1 - dist);
      }
    }

    return clamp(sum, 0, 1);
  }

  function scoreAllPhases(signals) {
    var scores = {};
    for (var i = 0; i < PHASE_KEYS.length; i++) {
      var pk = PHASE_KEYS[i];
      scores[pk] = scoreAttractor(signals, ATTRACTORS[pk]);
    }
    return scores;
  }

  // ─── Core estimator ───────────────────────────────────────────────────────

  function estimatePhase() {
    var raw = readSignals();
    var signals = smoothSignals(raw);
    var scores = scoreAllPhases(signals);

    // Apply phase inertia
    if (_prevPhase && scores[_prevPhase] !== undefined) {
      scores[_prevPhase] += INERTIA_BONUS;
      scores[_prevPhase] = clamp(scores[_prevPhase], 0, 1);
    }

    // Find top two phases
    var sorted = [];
    for (var i = 0; i < PHASE_KEYS.length; i++) {
      sorted.push({ phase: PHASE_KEYS[i], score: scores[PHASE_KEYS[i]] });
    }
    sorted.sort(function (a, b) { return b.score - a.score; });

    var top = sorted[0];
    var second = sorted[1];

    // Metastable detection
    var metastable = false;
    var blend = null;
    var delta = top.score - second.score;

    if (delta < METASTABLE_THRESHOLD) {
      metastable = true;
      blend = [top.phase, second.phase];
    }

    // Phase velocity
    var velocity = parseFloat((top.score - _prevScore).toFixed(3));
    window.LIMENPhaseVelocity = velocity;

    // Determine display phase and color
    var estPhase = top.phase;
    var estLabel = ATTRACTORS[estPhase].label;
    var estColor = ATTRACTORS[estPhase].color;
    var confidence = clamp(parseFloat(top.score.toFixed(2)), 0, 1);

    // Build result
    var result = {
      estimated:  estPhase,
      label:      estLabel,
      color:      estColor,
      confidence: confidence,
      velocity:   velocity,
      metastable: metastable,
      blend:      blend,
      signals:    signals,
      timestamp:  Date.now()
    };

    // Detect phase change
    var phaseChanged = _prevPhase !== null && _prevPhase !== estPhase;
    var transitionChanged = false;

    // Publish to global namespace
    var prevResult = window.LIMENPhase || {};
    transitionChanged = (!!prevResult.metastable) !== metastable;
    window.LIMENPhase = result;

    // Update history buffer
    _history.push({
      estimated:  estPhase,
      confidence: confidence,
      velocity:   velocity,
      metastable: metastable,
      blend:      blend,
      timestamp:  result.timestamp
    });
    if (_history.length > HISTORY_MAX) {
      _history.shift();
    }
    window.LIMENPhaseHistory = _history;

    // Update state for next tick
    _prevScore = top.score;
    _prevPhase = estPhase;

    // ── Events ──
    _dispatch('limen:phase', result);

    if (phaseChanged) {
      _dispatch('limen:phase-change', {
        from: prevResult.estimated || null,
        to: estPhase,
        confidence: confidence
      });
    }

    if (transitionChanged) {
      _dispatch('limen:phase-transition', {
        metastable: metastable,
        blend: blend,
        phase: estPhase,
        confidence: confidence
      });
    }

    _dispatch('limen:phase-velocity', {
      velocity: velocity,
      phase: estPhase
    });

    return result;
  }

  // ─── Get all current scores (public API) ─────────────────────────────────

  function getScores() {
    var signals = _prevSmoothed || readSignals();
    return scoreAllPhases(signals);
  }

  function getHistory() {
    return _history.slice();
  }

  // ─── HUD renderer ─────────────────────────────────────────────────────────

  var phaseEl = null;

  function _ensurePhaseEl() {
    // Re-check DOM in case element was orphaned by innerHTML overwrite
    if (phaseEl && phaseEl.parentNode) return;
    var hud = document.getElementById('observer-hud');
    if (!hud) return;
    // Remove stale element if it exists
    var existing = document.getElementById('limen-phase-display');
    if (existing) existing.parentNode.removeChild(existing);
    phaseEl = document.createElement('span');
    phaseEl.id = 'limen-phase-display';
    phaseEl.style.cssText = 'display:block;margin-top:4px;font-weight:bold;letter-spacing:1.5px';
    hud.appendChild(phaseEl);
  }

  function renderHUD(phase) {
    _ensurePhaseEl();
    if (!phaseEl) return;

    var pct = Math.round(phase.confidence * 100);

    if (phase.metastable && phase.blend) {
      phaseEl.textContent = 'PHASE: ' + phase.blend[0] + '/' + phase.blend[1] + ' TRANSITION (' + pct + '%)';
      // Use primary phase color
      phaseEl.style.color = ATTRACTORS[phase.blend[0]].color;
    } else {
      phaseEl.textContent = 'PHASE: ' + phase.estimated + ' ' + phase.label + ' (' + pct + '%)';
      phaseEl.style.color = phase.color;
    }

    // HEURISTIC source badge — civilization Phase Display is not wired to validated kernel.
    // Rebuilt every render because textContent above clears all children.
    var heurChip = document.createElement('span');
    heurChip.style.cssText = 'display:inline-block;margin-left:6px;padding:0 4px;' +
      'font-size:0.6em;letter-spacing:1px;border-radius:2px;' +
      'background:rgba(201,169,78,0.18);color:#C9A94E;vertical-align:middle';
    heurChip.textContent = '[HEURISTIC]';
    heurChip.title = 'Civilization-side heuristic estimate; not wired to validated kernel /health.';
    phaseEl.appendChild(heurChip);

    // Expose for portal-ui.js theming
    window.LIMENPhaseColor = phase.color;
  }

  // ─── Polling loop ─────────────────────────────────────────────────────────

  var _interval = null;
  var _tickCount = 0;

  function start() {
    if (_interval) return;
    _tickCount = 0;
    _interval = setInterval(function () {
      if (document.hidden) return;
      var phase = estimatePhase();
      renderHUD(phase);
      _tickCount++;
      // Log every 30s (15 ticks at 2s) instead of every 5s
      if (_tickCount % 15 === 0) {
        _logPhase(phase);
      }
    }, 2000);

    // Immediate first read
    var phase = estimatePhase();
    renderHUD(phase);
    _logPhase(phase);
  }

  function _logPhase(phase) {
    var meta = phase.metastable ? ' METASTABLE ' + (phase.blend ? phase.blend.join('/') : '') : '';
    console.log(
      '[LIMEN Phase] ' + phase.estimated + ' ' + phase.label +
      ' | confidence=' + phase.confidence +
      ' | velocity=' + phase.velocity +
      meta +
      ' | t=' + phase.timestamp
    );
  }

  function stop() {
    if (_interval) {
      clearInterval(_interval);
      _interval = null;
    }
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
  }

  function _dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) { /* silent */ }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  window.LIMENPhaseEstimator = {
    start: start,
    stop: stop,
    estimate: estimatePhase,
    getScores: getScores,
    getHistory: getHistory,
    phases: ATTRACTORS
  };

})();
