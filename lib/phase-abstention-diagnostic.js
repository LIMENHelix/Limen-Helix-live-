'use strict';

/**
 * Explain a low-precision abstention without changing it.
 *
 * phase-estimator is pure. Replaying the same bundle with a zero floor exposes the
 * channel precisions that were calculated immediately before the real call abstained.
 * Only diagnostic fields leave this module: no belief, phase, confidence, stuck state,
 * or correlation memory can be mistaken for an accepted estimate or persisted.
 */
function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function optionsAtFloor(opts, floor) {
  var copy = {};
  for (var key in opts) {
    if (Object.prototype.hasOwnProperty.call(opts, key)) copy[key] = opts[key];
  }
  copy.precisionFloor = floor;
  return copy;
}

/*
 * The estimator intentionally rounds channel precision for display. Find the
 * unrounded total at its own grounded/abstain decision boundary instead of
 * adding those rounded display values (which can cross the published floor).
 */
function inferTotalPrecision(estimator, bundle, opts, effectiveFloor) {
  var low = 0;
  var high = finite(effectiveFloor) && effectiveFloor > 0 ? effectiveFloor : 1;
  var probe = estimator.estimate(bundle, optionsAtFloor(opts, high));
  var expansions = 0;

  while (probe && probe.grounded === true && high < Number.MAX_SAFE_INTEGER / 2 && expansions < 64) {
    high *= 2;
    probe = estimator.estimate(bundle, optionsAtFloor(opts, high));
    expansions++;
  }
  if (!probe || probe.grounded !== false) return null;

  for (var i = 0; i < 60; i++) {
    var mid = low + (high - low) / 2;
    probe = estimator.estimate(bundle, optionsAtFloor(opts, mid));
    if (!probe) return null;
    if (probe.grounded === true) low = mid;
    else high = mid;
  }
  return low;
}

function inspect(estimator, bundle, opts) {
  if (!estimator || typeof estimator.estimate !== 'function') return null;

  opts = opts && typeof opts === 'object' ? opts : {};
  var effectiveFloor = finite(opts.precisionFloor)
    ? opts.precisionFloor
    : (finite(estimator.PRECISION_FLOOR) ? estimator.PRECISION_FLOOR : null);

  var replay = estimator.estimate(bundle, optionsAtFloor(opts, 0));
  if (!replay || !Array.isArray(replay.channels) || !replay.channels.length) return null;

  var total = inferTotalPrecision(estimator, bundle, opts, effectiveFloor);

  return {
    diagnosticOnly: true,
    floor: effectiveFloor,
    totalPrecision: total,
    channels: replay.channels
  };
}

module.exports = { inspect: inspect };
