// ═══════════════════════════════════════════════════════════════════
// limen-active-inference.js — ACTIVE INFERENCE v1 (staged, SHADOW).
//
// Generative model + free-energy-minimizing belief updates + expected-
// free-energy (EFE) action selection over the brain's EXISTING thin
// observation space. Stage 1 of 3 (see the plasticity spec): the model is
// HAND-SPECIFIED and deliberately narrow — a single observed channel
// (domain stress). Widening the observation model (stage 2) and learning
// its parameters through the three-factor substrate (stage 3) come only
// after this runs proven end-to-end. Narrowness here is expected, not a bug.
//
// THE MODEL (linear-Gaussian, so belief updating is EXACT Bayes):
//   hidden state  x = (level, slope) of the stress trajectory
//   transition    level' = level + slope ; slope' = slope   (+ process noise Q)
//   observation   stress ~ N(level, R)
//   beliefs       Gaussian N(mu, Sigma), updated by Kalman predict/update —
//                 which IS free-energy minimization for this model class.
//   This upgrades the prior art (_computeEnergyForecast's point-estimate
//   least-squares slope) to a real posterior with uncertainty.
//
// PREFERENCES: the homeostatic set-point the brain already maintains (K8's
// effective floor) is the prior preference over observations — the system
// prefers to observe stress near its regulated target. Interpretive framing,
// consistent with the regulation-observer thesis; never a market claim.
//
// ACTIONS (advisory; each maps to a lever the brain actually has):
//   observe          do nothing; baseline prediction
//   broaden-attention K6 broaden — hand-specified effect: higher observation
//                    precision next cycle (more channels attended)
//   emit-call        STEP 5/6 emission — sensible when beliefs are confident
//                    and trajectory elevated (call likely to confirm)
//   hold-emission    brake — sensible under high belief uncertainty
//
//   EFE(a) = risk + ambiguity
//     risk      = quadratic divergence of the action's predicted observation
//                 from the preference (pragmatic value)
//     ambiguity = expected observation entropy under the action (epistemic)
//   plus a calibration penalty on emit-call scaled by the truth brake's
//   realized callHitRate (an uncalibrated emitter should not want to emit).
//
// SHADOW: selection is LOGGED next to what the brain actually did; nothing
// here gates emission, attention, or any live path. Pure deterministic math,
// no network, no AI. Dual export: window.LIMENACTIVEINFERENCE + module.exports.
// ═══════════════════════════════════════════════════════════════════
(function (root) {
  'use strict';

  var VERSION = 1;
  var LN2PIE = Math.log(2 * Math.PI * Math.E);

  function clamp(x, lo, hi) { x = Number(x); if (!isFinite(x)) return lo; return Math.max(lo, Math.min(hi, x)); }
  function r4(x) { return Math.round(x * 10000) / 10000; }

  // cfg (all NAMED + tunable): q level/slope process noise, r observation noise,
  // prefSigma preference width, broadenPrecisionGain, emitConfidenceBar, tau softmax temp
  function create(cfg) {
    cfg = cfg || {};
    return {
      version: VERSION,
      // beliefs: mu = [level, slope]; S = 2x2 covariance (row-major)
      mu: [clamp(cfg.level0 != null ? cfg.level0 : 0.5, 0, 1), 0],
      S: [0.25, 0, 0, 0.01],            // wide initial uncertainty: we know little
      hyper: {
        qLevel: (cfg.qLevel != null) ? Number(cfg.qLevel) : 0.0004,   // process noise: level
        qSlope: (cfg.qSlope != null) ? Number(cfg.qSlope) : 0.0001,   // process noise: slope
        r: (cfg.r != null) ? Number(cfg.r) : 0.01,                    // observation noise
        prefSigma: (cfg.prefSigma != null) ? Number(cfg.prefSigma) : 0.15,  // preference width around set-point
        broadenPrecisionGain: (cfg.broadenPrecisionGain != null) ? Number(cfg.broadenPrecisionGain) : 0.5, // R multiplier when attention broadens
        emitConfidenceBar: (cfg.emitConfidenceBar != null) ? Number(cfg.emitConfidenceBar) : 0.05,  // level-variance below which emitting stops being penalized
        tau: (cfg.tau != null) ? Number(cfg.tau) : 0.05               // softmin temperature for action scores
      },
      steps: 0
    };
  }

  // One belief-update step (free-energy minimization for this model = Kalman).
  // obs: observed stress 0..1 (null = predict only, no update)
  function updateBeliefs(ai, obs) {
    var h = ai.hyper, m = ai.mu, S = ai.S;
    // predict: x' = F x, F = [[1,1],[0,1]]
    var pm = [m[0] + m[1], m[1]];
    var a = S[0], b = S[1], c = S[2], d = S[3];
    // F S F^T + Q
    var pS = [a + b + c + d + h.qLevel, b + d, c + d, d + h.qSlope];
    if (obs !== null && typeof obs === 'number' && isFinite(obs)) {
      // update with H = [1, 0]
      var innov = obs - pm[0];
      var s = pS[0] + h.r;                       // innovation variance
      var k0 = pS[0] / s, k1 = pS[2] / s;        // Kalman gain
      ai.mu = [clamp(pm[0] + k0 * innov, 0, 1), pm[1] + k1 * innov];
      ai.S = [(1 - k0) * pS[0], (1 - k0) * pS[1], pS[2] - k1 * pS[0], pS[3] - k1 * pS[1]];
      ai.lastInnovation = r4(innov);
    } else {
      ai.mu = [clamp(pm[0], 0, 1), pm[1]];
      ai.S = pS;
      ai.lastInnovation = null;
    }
    ai.steps++;
    return ai;
  }

  // Expected free energy per action, one step ahead.
  // ctx: { setpoint 0..1 (preference target), callHitRate|null, brakeActive bool }
  function selectAction(ai, ctx) {
    ctx = ctx || {};
    var h = ai.hyper;
    var setpoint = clamp(ctx.setpoint != null ? ctx.setpoint : 0.35, 0, 1);
    // predicted next observation under no intervention
    var predMean = clamp(ai.mu[0] + ai.mu[1], 0, 1);
    var predVarBase = (ai.S[0] + ai.S[1] + ai.S[2] + ai.S[3] + h.qLevel) + h.r;   // level pred var + obs noise
    var levelVar = ai.S[0];
    var hit = (typeof ctx.callHitRate === 'number') ? ctx.callHitRate : null;

    function risk(mean) { var dv = mean - setpoint; return (dv * dv) / (2 * h.prefSigma * h.prefSigma); }
    function ambiguity(v) { return 0.5 * (LN2PIE + Math.log(Math.max(1e-6, v))); }

    var actions = [
      { id: 'observe', G: risk(predMean) + ambiguity(predVarBase),
        maps: 'baseline (no intervention)' },
      { id: 'broaden-attention', G: risk(predMean) + ambiguity(predVarBase * h.broadenPrecisionGain) + 0.02,
        maps: 'K6 attention broaden (higher observation precision next cycle; small effort cost)' },
      { id: 'emit-call',
        // pragmatic: an emitted call PREFERS elevated persistent stress (it confirms);
        // penalized by belief uncertainty and by poor realized calibration.
        G: risk(predMean) + ambiguity(predVarBase)
          + Math.max(0, levelVar - h.emitConfidenceBar) * 20
          + (hit === null ? 0.5 : (1 - hit))
          + (ai.mu[1] <= 0 ? 0.3 : 0),
        maps: 'STEP 5/6 emission queue (emit while trajectory rising + beliefs confident + calibration earned)' },
      { id: 'hold-emission', G: risk(predMean) + ambiguity(predVarBase) + (hit !== null && hit > 0.7 ? 0.3 : 0)
          - Math.max(0, levelVar - h.emitConfidenceBar) * 10,
        maps: 'HALT brake posture (hold under uncertainty; costly once calibration is proven)' }
    ];

    // softmin over G (lower expected free energy = preferred)
    var minG = Infinity;
    for (var i = 0; i < actions.length; i++) if (actions[i].G < minG) minG = actions[i].G;
    var sum = 0;
    for (var j = 0; j < actions.length; j++) { actions[j].p = Math.exp(-(actions[j].G - minG) / Math.max(1e-3, h.tau)); sum += actions[j].p; }
    var best = actions[0];
    for (var k2 = 0; k2 < actions.length; k2++) { actions[k2].G = r4(actions[k2].G); actions[k2].p = r4(actions[k2].p / sum); if (actions[k2].p > best.p) best = actions[k2]; }

    return {
      selected: best.id,
      selectedMaps: best.maps,
      actions: actions,
      beliefs: { level: r4(ai.mu[0]), slope: r4(ai.mu[1]),
        levelVar: r4(ai.S[0]), slopeVar: r4(ai.S[3]), predictedNext: r4(predMean), predictedObsVar: r4(predVarBase),
        lastInnovation: ai.lastInnovation, steps: ai.steps },
      preference: { setpoint: r4(setpoint), sigma: h.prefSigma,
        framing: 'homeostatic set-point as prior preference (interpretive; regulation-observer, not a market claim)' }
    };
  }

  function serialize(ai) { return { version: VERSION, mu: ai.mu.map(r4), S: ai.S.map(r4), steps: ai.steps }; }
  function hydrate(ai, snap) {
    if (!ai || !snap || !Array.isArray(snap.mu) || snap.mu.length !== 2 || !Array.isArray(snap.S) || snap.S.length !== 4) return false;
    ai.mu = snap.mu.map(Number); ai.S = snap.S.map(Number); ai.steps = Number(snap.steps) || 0; return true;
  }

  var API = { create: create, updateBeliefs: updateBeliefs, selectAction: selectAction,
    serialize: serialize, hydrate: hydrate, version: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.LIMENACTIVEINFERENCE = API;
})(typeof window !== 'undefined' ? window : this);
