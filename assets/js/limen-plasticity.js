// ═══════════════════════════════════════════════════════════════════
// limen-plasticity.js — reward-gated LOCAL (three-factor) plasticity.
//
//   Δw = η · pre · post · modulator
//
// NOT backprop. No differentiable graph, no weight transport. Each K-layer
// owns a small learnable parameter vector updated by a three-factor rule
// whose third factor is a reward-prediction-error-LIKE signal derived from
// the central honest credit gate (limen-k4-selfconsistency.js).
//
// HONESTY CONTRACT (carried into every snapshot and log):
//   The modulator for non-externalRewardEligible domains (all but finance)
//   is SELF-CONSISTENCY CALIBRATION (isReward:false), never ground-truth
//   reward. Weights learned from it are calibration-tuned, not
//   reality-validated. That label must never be dropped downstream.
//
// MECHANISM (per layer, per cycle):
//   1. eligibility trace:  e ← traceDecay·e + pre·post        (every cycle)
//      Bridges the gap between activity and its delayed outcome: the truth
//      brake resolves calls 3–20 cycles after emission, so by the time the
//      modulator arrives the activity that earned it is gone. The trace is
//      what is still "eligible" for credit when the modulator lands.
//   2. RPE centering:      rpe = credit − baseline;  baseline ← EMA(credit)
//      The K4 credit is 0..1 and always positive; used raw it could only
//      grow weights. Centering makes it an ERROR signal: better-than-usual
//      calibration reinforces, worse-than-usual weakens.
//   3. three-factor apply (only on NEW resolved outcomes, not every cycle):
//      w ← w + η·modScale·rpe·e
//   4. prior shrinkage:    w ← w + priorLambda·(seed − w)      (every cycle)
//      DECAY FROM DAY ONE (the project's acquisition-without-removal
//      guardrail): absent sustained evidence, weights relax to the hand-set
//      seed. The seed IS the Bayesian prior; drift from it is the learned
//      posterior shift.
//   5. clamp to [minW, maxW] — no runaway by construction, and diagnostics
//      still flag the ATTEMPT (see below) because silent clamping hides
//      instability.
//
// CONVERGENCE DIAGNOSTICS (built in, not eyeballed later):
//   Rolling window of weight-vector L2 magnitude → flags:
//     oscillating: magnitude delta flips sign ≥ OSC_FLIPS times in window
//                  with mean amplitude above OSC_EPS (bouncing, not settling)
//     runaway:     magnitude within RUNAWAY_FRAC of the clamp ceiling, or
//                  monotone growth across the whole window
//   `stable` requires a full window with neither flag — the shadow→live
//   promotion gate reads this.
//
// SHADOW MODE: this module only computes and serializes. It never touches
// the live scoring spine; the brain logs would-be outputs alongside static
// ones. Arming is a separate, operator-gated, later change.
//
// Pure deterministic math. No network, no AI, no Date.now() dependence
// beyond timestamps in snapshots. Dual export: window.LIMENPLASTICITY
// (classic script) + module.exports (node tests).
// ═══════════════════════════════════════════════════════════════════
(function (root) {
  'use strict';

  var VERSION = 1;
  var DIAG_WINDOW = 24;      // cycles of magnitude history per layer
  var OSC_FLIPS = 6;         // sign flips of d|w| within window ⇒ oscillating
  var OSC_EPS = 0.002;       // mean |d|w|| must exceed this for oscillation to count
  var RUNAWAY_FRAC = 0.95;   // magnitude ≥ frac·(ceiling magnitude) ⇒ runaway
  var BASELINE_ALPHA = 0.1;  // EMA rate for the RPE baseline

  function clamp(x, lo, hi) { x = Number(x); if (!isFinite(x)) return lo; return Math.max(lo, Math.min(hi, x)); }
  function r4(x) { return Math.round(x * 10000) / 10000; }

  // ── Layer factory ───────────────────────────────────────────────
  // cfg: {
  //   name:        layer id, e.g. 'K5-predictionError'
  //   seed:        number[] — the hand-set weights being made learnable (= the prior)
  //   labels:      string[] — one human label per weight (same length as seed)
  //   eta:         per-layer learning rate                (NAMED, tunable)
  //   modScale:    modulator scaling factor               (NAMED, tunable)
  //   traceDecay:  eligibility trace decay per cycle 0..1 (NAMED, tunable)
  //   priorLambda: shrinkage toward seed per cycle        (NAMED, tunable)
  //   minW, maxW:  hard clamp bounds per weight
  // }
  function createLayer(cfg) {
    if (!cfg || !Array.isArray(cfg.seed) || !cfg.seed.length) throw new Error('createLayer: seed[] required');
    var n = cfg.seed.length;
    if (!Array.isArray(cfg.labels) || cfg.labels.length !== n) throw new Error('createLayer(' + cfg.name + '): labels[] must match seed length');
    return {
      version: VERSION,
      name: String(cfg.name || 'layer'),
      labels: cfg.labels.slice(),
      seed: cfg.seed.map(Number),
      w: cfg.seed.map(Number),              // learnable vector, starts at the prior
      e: cfg.seed.map(function () { return 0; }),  // eligibility traces
      hyper: {                              // named + individually tunable, never shared constants
        eta: (cfg.eta != null) ? Number(cfg.eta) : 0.02,
        modScale: (cfg.modScale != null) ? Number(cfg.modScale) : 1.0,
        traceDecay: (cfg.traceDecay != null) ? Number(cfg.traceDecay) : 0.85,
        priorLambda: (cfg.priorLambda != null) ? Number(cfg.priorLambda) : 0.002,
        minW: (cfg.minW != null) ? Number(cfg.minW) : 0,
        maxW: (cfg.maxW != null) ? Number(cfg.maxW) : 1.5
      },
      updates: 0,                           // modulator applications so far
      ticks: 0,                             // cycles seen
      magHist: [],                          // rolling L2 magnitude for diagnostics
      diag: { stable: false, oscillating: false, runaway: false, samples: 0 }
    };
  }

  function _l2(v) { var s = 0; for (var i = 0; i < v.length; i++) s += v[i] * v[i]; return Math.sqrt(s); }

  function _updateDiagnostics(layer) {
    var mag = _l2(layer.w);
    var h = layer.magHist;
    h.push(r4(mag));
    if (h.length > DIAG_WINDOW) h.shift();
    var flips = 0, monotoneUp = h.length >= DIAG_WINDOW, sumAbsD = 0, lastSign = 0;
    for (var i = 1; i < h.length; i++) {
      var d = h[i] - h[i - 1];
      sumAbsD += Math.abs(d);
      var sign = d > 0 ? 1 : d < 0 ? -1 : 0;
      if (sign !== 0 && lastSign !== 0 && sign !== lastSign) flips++;
      if (sign !== 0) lastSign = sign;
      if (d <= 0) monotoneUp = false;
    }
    var meanAbsD = h.length > 1 ? sumAbsD / (h.length - 1) : 0;
    var ceiling = _l2(layer.w.map(function () { return layer.hyper.maxW; }));
    var oscillating = h.length >= DIAG_WINDOW && flips >= OSC_FLIPS && meanAbsD > OSC_EPS;
    var runaway = (mag >= RUNAWAY_FRAC * ceiling) || monotoneUp;
    layer.diag = {
      stable: h.length >= DIAG_WINDOW && !oscillating && !runaway,
      oscillating: oscillating,
      runaway: runaway,
      magnitude: r4(mag),
      meanAbsDelta: r4(meanAbsD),
      signFlips: flips,
      samples: h.length,
      driftFromSeed: r4(_l2(layer.w.map(function (wi, k) { return wi - layer.seed[k]; })))
    };
    return layer.diag;
  }

  // ── Per-cycle tick: eligibility + shrinkage. NO weight-from-modulator here. ──
  // pre: number[] (same length as w) — the layer's input vector this cycle
  // post: number   — the layer's (shadow) output this cycle
  function tick(layer, pre, post) {
    if (!layer || !Array.isArray(pre) || pre.length !== layer.w.length) return null;
    var hp = layer.hyper, p = Number(post) || 0;
    for (var i = 0; i < layer.w.length; i++) {
      var pi = Number(pre[i]) || 0;
      layer.e[i] = hp.traceDecay * layer.e[i] + pi * p;                 // 1. eligibility
      layer.w[i] = layer.w[i] + hp.priorLambda * (layer.seed[i] - layer.w[i]); // 4. decay toward prior
      layer.w[i] = clamp(layer.w[i], hp.minW, hp.maxW);
    }
    layer.ticks++;
    return _updateDiagnostics(layer);
  }

  // ── Modulator application: call ONLY when a NEW resolved outcome arrived. ──
  // rpe: centered reward-prediction-error-like scalar (see makeModulator)
  function applyModulator(layer, rpe) {
    if (!layer || typeof rpe !== 'number' || !isFinite(rpe)) return null;
    var hp = layer.hyper;
    for (var i = 0; i < layer.w.length; i++) {
      layer.w[i] = clamp(layer.w[i] + hp.eta * hp.modScale * rpe * layer.e[i], hp.minW, hp.maxW); // 3. Δw = η·pre·post·mod (pre·post lives in e)
    }
    layer.updates++;
    return _updateDiagnostics(layer);
  }

  // ── Modulator state: turns the K4 credit stream into a centered RPE. ──
  // Detects NEW information via the resolved-sample count (the truth brake's
  // resolvedSamples), not via credit drift, so re-reads of the same ledger
  // state never double-teach.
  function createModulator() {
    return { version: VERSION, baseline: null, lastResolvedSamples: 0, lastCredit: null, lastSource: 'none', lastIsReward: false, events: 0 };
  }

  // k4: the LIMENK4.credit() result; resolvedSamples: ledger resolvedSamples count
  // returns { fresh: bool, rpe: number|null, credit, creditSource, isReward }
  function readModulator(mod, k4, resolvedSamples) {
    var out = { fresh: false, rpe: null, credit: null, creditSource: 'none', isReward: false };
    if (!mod || !k4 || typeof k4.credit !== 'number') return out;
    out.credit = k4.credit;
    out.creditSource = k4.creditSource || 'none';
    out.isReward = !!k4.isReward;          // false for every non-finance domain — carried into snapshots
    var rs = Number(resolvedSamples) || 0;
    var fresh = rs > mod.lastResolvedSamples;   // only NEW resolved outcomes teach
    if (fresh) {
      if (mod.baseline === null) mod.baseline = k4.credit;   // first sample: rpe 0, seed the baseline
      out.rpe = r4(k4.credit - mod.baseline);                 // 2. centered RPE
      mod.baseline = mod.baseline + BASELINE_ALPHA * (k4.credit - mod.baseline);
      mod.lastResolvedSamples = rs;
      mod.events++;
      out.fresh = true;
    }
    mod.lastCredit = k4.credit;
    mod.lastSource = out.creditSource;
    mod.lastIsReward = out.isReward;
    return out;
  }

  // ── Shadow output helper: the learned weighted sum next to the static one. ──
  function shadowSum(layer, pre) {
    if (!layer || !Array.isArray(pre) || pre.length !== layer.w.length) return null;
    var s = 0;
    for (var i = 0; i < layer.w.length; i++) s += layer.w[i] * (Number(pre[i]) || 0);
    return r4(s);
  }

  // ── Persistence (format the brain-weights handler stores verbatim) ──
  function serialize(layers, mod, meta) {
    var out = { version: VERSION, t: Date.now(), mode: 'shadow', isReward: !!(mod && mod.lastIsReward),
      creditSource: (mod && mod.lastSource) || 'none', modulator: null, layers: {} };
    if (mod) out.modulator = { baseline: mod.baseline, lastResolvedSamples: mod.lastResolvedSamples, lastCredit: mod.lastCredit, events: mod.events };
    for (var k in layers) {
      if (!layers.hasOwnProperty(k)) continue;
      var L = layers[k];
      out.layers[k] = { name: L.name, labels: L.labels, seed: L.seed.map(r4), w: L.w.map(r4), e: L.e.map(r4),
        hyper: L.hyper, updates: L.updates, ticks: L.ticks, magHist: L.magHist.slice(), diag: L.diag };
    }
    if (meta) out.meta = meta;
    return out;
  }

  // Rebuild live layer objects from a stored snapshot; layers whose stored
  // shape no longer matches the current seed config are RESET to seed (a
  // config change invalidates the old posterior — honest, not silent reuse).
  function hydrate(layers, snapshot) {
    var restored = [], reset = [];
    if (!snapshot || !snapshot.layers) return { restored: restored, reset: Object.keys(layers) };
    for (var k in layers) {
      if (!layers.hasOwnProperty(k)) continue;
      var L = layers[k], S = snapshot.layers[k];
      if (S && Array.isArray(S.w) && S.w.length === L.w.length &&
          Array.isArray(S.seed) && String(S.seed.map(r4)) === String(L.seed.map(r4))) {
        L.w = S.w.map(Number);
        L.e = (Array.isArray(S.e) && S.e.length === L.e.length) ? S.e.map(Number) : L.e;
        L.updates = Number(S.updates) || 0;
        L.ticks = Number(S.ticks) || 0;
        L.magHist = Array.isArray(S.magHist) ? S.magHist.slice(-DIAG_WINDOW) : [];
        _updateDiagnostics(L);
        restored.push(k);
      } else {
        reset.push(k);   // shape/seed mismatch ⇒ start from prior, say so
      }
    }
    return { restored: restored, reset: reset };
  }

  function hydrateModulator(mod, snapshot) {
    if (!mod || !snapshot || !snapshot.modulator) return false;
    var m = snapshot.modulator;
    if (typeof m.baseline === 'number') mod.baseline = m.baseline;
    mod.lastResolvedSamples = Number(m.lastResolvedSamples) || 0;
    mod.events = Number(m.events) || 0;
    return true;
  }

  var API = { createLayer: createLayer, tick: tick, applyModulator: applyModulator,
    createModulator: createModulator, readModulator: readModulator, shadowSum: shadowSum,
    serialize: serialize, hydrate: hydrate, hydrateModulator: hydrateModulator,
    DIAG_WINDOW: DIAG_WINDOW, version: VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.LIMENPLASTICITY = API;
})(typeof window !== 'undefined' ? window : this);
