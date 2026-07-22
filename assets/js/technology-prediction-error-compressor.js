/*
 * technology-prediction-error-compressor.js  — ADDITIVE reference implementation
 * ----------------------------------------------------------------------------
 * Concrete form of the PREDICTION_ERROR_COMPRESSION build-target
 * (docs/technology-prediction-error-compression-proposal.md).
 * Source (only): LIMEN Helix Neurology Reference XIII.5 (mismatch propagation) + XIII.7
 * (gain/precision) + Neuro<->Business Cross-Reference unified rule (management-by-exception).
 *
 * CONTRACT:
 *   - Pure/read-only. NEVER reads or writes assets/data/domains/technology.json as a side effect.
 *   - Propagates only signals whose (precision-weighted) prediction error clears the threshold;
 *     the rest are SUMMARIZED, not deleted (faithful to "matches are summarized away").
 *   - Default threshold = 0 => everything propagates => NO-OP until the operator configures it.
 *   - A signal with no available prediction is PROPAGATED and surfaced (cannot compress against
 *     a prediction you don't have).
 * ----------------------------------------------------------------------------
 */
(function (root) {
  'use strict';

  var DEFAULTS = {
    threshold: 0,       // min weighted |error| to propagate; 0 => no compression (no-op). operator-set.
    precision: 1,       // scalar, or a { id: number } map. XIII.7 enhancement; 1 = neutral.
    predictor: 'given', // 'given' (use signal.predicted) | 'baseline' (use params.baseline)
    baseline: null      // prediction used when predictor === 'baseline'
  };

  function precisionFor(p, id) {
    if (p == null) return 1;
    if (typeof p === 'number') return p;
    return (typeof p[id] === 'number') ? p[id] : 1;
  }

  /* signals: [{ id, observed, predicted? }] */
  function compress(signals, params) {
    var p = Object.assign({}, DEFAULTS, params || {});
    var propagated = [], summarized = [], noPrediction = [];

    (signals || []).forEach(function (s) {
      var predicted = (p.predictor === 'baseline') ? p.baseline
        : (s.predicted !== undefined ? s.predicted : null);

      if (predicted === null || predicted === undefined || typeof s.observed !== 'number') {
        noPrediction.push(s.id);
        propagated.push({ id: s.id, observed: s.observed, predicted: null, error: null, reason: 'no prediction; propagated by default' });
        return;
      }
      var error = s.observed - predicted;
      var weighted = Math.abs(error) * precisionFor(p.precision, s.id);
      if (weighted >= p.threshold) {
        propagated.push({ id: s.id, observed: s.observed, predicted: predicted, error: error, weightedError: weighted });
      } else {
        summarized.push({ id: s.id, error: error, weightedError: weighted });
      }
    });

    var sumAbs = summarized.reduce(function (a, x) { return a + Math.abs(x.error); }, 0);
    return {
      propagated: propagated,
      summary: {
        compressedCount: summarized.length,
        sumAbsError: sumAbs,
        meanAbsError: summarized.length ? sumAbs / summarized.length : 0,
        ids: summarized.map(function (x) { return x.id; })
      },
      noPrediction: noPrediction,
      noop: (p.threshold === 0),
      compressionRatio: (signals && signals.length) ? (summarized.length / signals.length) : 0
    };
  }

  /* Baseline predictor: mean of an array of numbers (a simple "expected value"). */
  function baselinePredictor(values) {
    var nums = (values || []).filter(function (v) { return typeof v === 'number'; });
    return nums.length ? nums.reduce(function (a, b) { return a + b; }, 0) / nums.length : null;
  }

  var API = { compress: compress, baselinePredictor: baselinePredictor, DEFAULTS: DEFAULTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root && !root.TechnologyPredictionErrorCompressor) root.TechnologyPredictionErrorCompressor = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
